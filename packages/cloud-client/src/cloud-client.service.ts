import type { AuditAction, CentralLicenseStatus, Prisma, PrismaClient } from '@sgms/database';
import { cloudApiUrl, requestJsonPreserveMethod, resolveCloudClientConfig } from './config.js';
import type {
  CheckoutPayload,
  CloudApiResponse,
  CloudApiResult,
  CloudClientConfig,
  CloudHealthResult,
  CloudTenantStatus,
  LicenseApiPayload,
  OfflineTokenPayload,
  PaymentStatusPayload,
  SendMailInput,
  SendMailPayload,
  StartCheckoutInput,
  TenantSyncInput,
  TenantSyncPayload,
} from './types.js';

/**
 * CiciByte Cloud (cloud.cicibyte.com) ile iletişim.
 *
 * SGMS kendi Subscription/Plan modeliyle abonelik durumunu zaten yerelde yönetir
 * (bkz. lib/billing/subscription-gate.ts) — bu client dış bir "lisans kapısı" değil,
 * merkezi platforma tenant durumunu raporlayan bir senkron istemcisidir. Erişim
 * kararı her zaman yerel Subscription kaydına göre verilir; cloud.cicibyte.com
 * yalnızca şirket çapında merkezi görünürlük sağlar.
 */
export class CloudClientService {
  private readonly config: ReturnType<typeof resolveCloudClientConfig>;

  constructor(
    private readonly prisma: PrismaClient,
    config: CloudClientConfig = {},
  ) {
    this.config = resolveCloudClientConfig(config);
  }

  /** Organizasyonun güncel Subscription/Plan durumunu cloud.cicibyte.com'a iter. */
  async syncOrganization(organizationId: string): Promise<CloudApiResult<TenantSyncPayload>> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
      },
    });

    const subscription = organization.subscriptions[0];
    const status = mapSubscriptionToCloudStatus(subscription?.status);
    const expiresAt = subscription?.currentPeriodEnd ?? subscription?.trialEndsAt ?? null;
    const referrerName = extractReferrerName(organization.settings);

    const result = await this.syncTenant({
      tenantSlug: organization.slug,
      tenantName: organization.name,
      email: organization.email,
      planCode: subscription?.plan.code ?? null,
      status,
      trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
      seats: subscription?.plan.maxStaff ?? null,
      referrerName,
    });

    if (result.ok && result.payload) {
      await this.applySyncResult(organization.id, status, result.payload, expiresAt);
      await this.writeAuditLog(organization.id, 'CLOUD_TENANT_SYNCED', {
        status,
        planCode: subscription?.plan.code ?? null,
      });
    } else {
      await this.writeAuditLog(organization.id, 'CLOUD_SYNC_FAILED', {
        reason: result.message,
      });
    }

    return result;
  }

  /** Tüm aktif organizasyonları cloud.cicibyte.com ile senkronize eder (cron / heartbeat). */
  async syncAllOrganizations(): Promise<{ ok: number; failed: number }> {
    const organizations = await this.prisma.organization.findMany({
      where: { status: { in: ['ACTIVE', 'SUSPENDED', 'PENDING'] } },
      select: { id: true, slug: true },
    });

    let ok = 0;
    let failed = 0;

    for (const org of organizations) {
      const result = await this.syncOrganization(org.id);
      if (result.ok) {
        ok += 1;
        console.log(`[cloud:sync] OK ${org.slug}`);
      } else {
        failed += 1;
        console.log(`[cloud:sync] FAIL ${org.slug}: ${result.message}`);
      }
    }

    return { ok, failed };
  }

  /** cloud.cicibyte.com platform sağlık durumu (public uç, API key gerektirmez). */
  async checkPlatformHealth(): Promise<CloudHealthResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(cloudApiUrl(this.config.baseUrl, 'v1/health'), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      return (await response.json()) as CloudHealthResult;
    } catch {
      return { ok: false, checks: {}, time: new Date().toISOString() };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async syncTenant(input: TenantSyncInput): Promise<CloudApiResult<TenantSyncPayload>> {
    return this.request<TenantSyncPayload>('PUT', `v2/${this.config.productSlug}/tenants`, {
      tenant_slug: input.tenantSlug,
      tenant_name: input.tenantName,
      email: input.email ?? undefined,
      plan_code: input.planCode ?? undefined,
      status: input.status,
      trial_ends_at: input.trialEndsAt ?? undefined,
      seats: input.seats ?? undefined,
      referrer_name: input.referrerName ?? undefined,
    });
  }

  // --- Mail relay (v2) — SGMS'in kendi SMTP'si yok, gönderim mail.cicibyte.com üzerinden. ---

  async sendMail(input: SendMailInput): Promise<CloudApiResult<SendMailPayload>> {
    return this.request<SendMailPayload>('POST', `v2/${this.config.productSlug}/mail/send`, {
      to: input.to,
      subject: input.subject,
      html: input.html,
      category: input.category ?? 'transactional',
    });
  }

  // --- Commerce checkout (v2) — gerçek ödeme ağ geçidi entegrasyonu cloud.cicibyte.com'da. ---

  async startCheckout(input: StartCheckoutInput): Promise<CloudApiResult<CheckoutPayload>> {
    return this.request<CheckoutPayload>('POST', `v2/${this.config.productSlug}/commerce/checkout`, {
      tenant_slug: input.tenantSlug,
      tenant_name: input.tenantName,
      email: input.email ?? undefined,
      plan_code: input.planCode ?? undefined,
      billing_interval: input.billingInterval ?? undefined,
      amount: input.amount,
      currency: input.currency ?? 'TRY',
      provider: input.provider ?? 'iyzico',
      buyer: input.buyer
        ? {
            name: input.buyer.name,
            surname: input.buyer.surname,
            gsm_number: input.buyer.gsmNumber,
            identity_number: input.buyer.identityNumber,
            address: input.buyer.address,
            city: input.buyer.city,
            country: input.buyer.country,
            zip_code: input.buyer.zipCode,
          }
        : undefined,
      return_url: input.returnUrl,
    });
  }

  async checkPaymentStatus(paymentId: number | string): Promise<CloudApiResult<PaymentStatusPayload>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.config.apiKey) {
        headers['X-Api-Key'] = this.config.apiKey.trim();
      }

      const response = await fetch(
        cloudApiUrl(this.config.baseUrl, `v2/${this.config.productSlug}/commerce/payments/${paymentId}`),
        { headers, signal: controller.signal },
      );

      const json = (await response.json()) as CloudApiResponse<PaymentStatusPayload>;

      if (!response.ok || !json.success || !json.data) {
        return { ok: false, statusCode: response.status, message: json.message ?? 'Ödeme durumu alınamadı.' };
      }

      return { ok: true, statusCode: response.status, message: json.message ?? 'OK', payload: json.data };
    } catch {
      return { ok: false, statusCode: 503, message: 'cloud.cicibyte.com bağlantısı kurulamadı.' };
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Legacy v1 hwid tabanlı uçlar — masaüstü/offline cihaz senaryoları (Faz 10 turnike/resepsiyon) için saklanıyor ---

  /** Aktive edilmiş bir cihaz için offline doğrulanabilir Ed25519 imzalı token ister. */
  async issueOfflineToken(
    licenseKey: string,
    hwid: string,
  ): Promise<CloudApiResult<OfflineTokenPayload>> {
    return this.request<OfflineTokenPayload>('POST', `v2/${this.config.productSlug}/offline-token`, {
      license_key: licenseKey,
      hwid,
    });
  }

  /** Cihaz bazlı (hwid) periyodik lisans doğrulaması — çoğunlukla masaüstü istemciler için. */
  async checkDeviceLicense(
    licenseKey: string,
    hwid: string,
  ): Promise<CloudApiResult<LicenseApiPayload>> {
    return this.request<LicenseApiPayload>('POST', 'v1/license/check', {
      license_key: licenseKey,
      hwid,
    });
  }

  private async request<T>(
    method: 'POST' | 'PUT',
    path: string,
    body: Record<string, unknown>,
  ): Promise<CloudApiResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['X-Api-Key'] = this.config.apiKey.trim();
      }

      const response = await requestJsonPreserveMethod(
        method,
        cloudApiUrl(this.config.baseUrl, path),
        { headers, body: JSON.stringify(body), signal: controller.signal },
      );

      const rawText = await response.text();
      let json: CloudApiResponse<T>;
      try {
        json = JSON.parse(rawText) as CloudApiResponse<T>;
      } catch {
        return {
          ok: false,
          statusCode: response.status,
          message: rawText.slice(0, 240) || `CiciByte Cloud API hatası (${response.status}).`,
        };
      }

      if (!response.ok || !json.success || !json.data) {
        return {
          ok: false,
          statusCode: response.status,
          message: json.message ?? `CiciByte Cloud API hatası (${response.status}).`,
        };
      }

      return {
        ok: true,
        statusCode: response.status,
        message: json.message ?? 'Senkronize edildi.',
        payload: json.data,
      };
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'cloud.cicibyte.com bağlantısında zaman aşımı oluştu.'
          : 'cloud.cicibyte.com bağlantısı kurulamadı.';

      return { ok: false, statusCode: 503, message };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async applySyncResult(
    organizationId: string,
    status: CloudTenantStatus,
    payload: TenantSyncPayload,
    expiresAt: Date | null,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        centralLicenseKey: payload.license_key,
        centralLicenseStatus: mapCloudStatusToCentralLicenseStatus(status),
        centralLicenseType: status === 'trialing' ? 'trial' : 'subscription',
        licenseExpiresAt: expiresAt,
        lastLicenseCheckAt: new Date(),
      },
    });
  }

  private async writeAuditLog(
    organizationId: string,
    action: AuditAction,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        action,
        entityType: 'organization',
        entityId: organizationId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

function extractReferrerName(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return null;
  }
  const value = (settings as Record<string, unknown>).referrerName;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapSubscriptionToCloudStatus(status?: string): CloudTenantStatus {
  switch (status) {
    case 'TRIALING':
      return 'trialing';
    case 'ACTIVE':
      return 'active';
    case 'PAST_DUE':
      return 'past_due';
    case 'CANCELED':
    case 'EXPIRED':
    default:
      return 'cancelled';
  }
}

function mapCloudStatusToCentralLicenseStatus(status: CloudTenantStatus): CentralLicenseStatus {
  switch (status) {
    case 'trialing':
      return 'TRIAL';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      // Yerel subscription-gate zaten billing_only moduna düşürür; merkezi kayıt
      // "hâlâ var" görünsün diye ACTIVE tutulur — cloud tarafı ödeme durumunu ayrıca izler.
      return 'ACTIVE';
    case 'cancelled':
    default:
      return 'EXPIRED';
  }
}
