import type {
  AuditAction,
  CentralLicenseStatus,
  Prisma,
  PrismaClient,
} from '@sgms/database';
import { resolveLicenseClientConfig, licenseApiUrl } from './config.js';
import type {
  EnsureLicenseInput,
  EnsureLicenseResult,
  LicenseApiPayload,
  LicenseApiResponse,
  LicenseCheckResult,
  LicenseClientConfig,
} from './types.js';

 * Merkezi lisans sunucusu (license.cicibyte.com) ile iletişim.
 *
 * Akış:
 * 1. Organization oluşturulduğunda veya ilk girişte → trial (14 gün)
 * 2. Lisans anahtarı girildiğinde → activate
 * 3. Her oturum/giriş → check (validate / heartbeat eşdeğeri)
 */
export class LicenseClientService {
  private readonly config: ReturnType<typeof resolveLicenseClientConfig>;

  constructor(
    private readonly prisma: PrismaClient,
    config: LicenseClientConfig,
  ) {
    this.config = resolveLicenseClientConfig(config);
  }

  /** Yeni kurulum veya ilk giriş: trial başlat, yoksa mevcut lisansı doğrula. */
  async ensureOrganizationLicense(
    organizationId: string,
    input: EnsureLicenseInput,
  ): Promise<EnsureLicenseResult> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (input.licenseKey ?? organization.centralLicenseKey) {
      const activateResult = await this.activate(
        input.installationId,
        input.licenseKey ?? organization.centralLicenseKey!,
      );

      if (activateResult.ok && activateResult.payload) {
        await this.syncOrganizationLicense(organization.id, activateResult.payload, {
          licenseKey: input.licenseKey ?? organization.centralLicenseKey ?? undefined,
        });

        return {
          ok: true,
          status: 'activated',
          message: activateResult.message,
          payload: activateResult.payload,
          licenseKey: input.licenseKey ?? organization.centralLicenseKey ?? undefined,
        };
      }
    }

    const validateResult = await this.validate(input.installationId);

    if (validateResult.ok && validateResult.payload) {
      await this.syncOrganizationLicense(organization.id, validateResult.payload);

      return {
        ok: true,
        status: 'validated',
        message: validateResult.message,
        payload: validateResult.payload,
        licenseKey: organization.centralLicenseKey ?? undefined,
      };
    }

    const trialResult = await this.startTrial(input.installationId);

    if (trialResult.ok && trialResult.payload) {
      await this.syncOrganizationLicense(organization.id, trialResult.payload, {
        licenseKey: trialResult.licenseKey,
        trialStartedAt: new Date(),
      });

      await this.writeAuditLog(organization.id, 'LICENSE_TRIAL_STARTED', {
        installationId: input.installationId,
        expiresAt: trialResult.payload.expires_at,
      });

      return {
        ok: true,
        status: 'trial_started',
        message: trialResult.message,
        payload: trialResult.payload,
        licenseKey: trialResult.licenseKey,
      };
    }

    return {
      ok: false,
      status: 'error',
      message: trialResult.message || validateResult.message || 'Lisans doğrulanamadı.',
    };
  }

  /** Oturum açılışında periyodik doğrulama (check / heartbeat). */
  async validateOnLogin(organizationId: string, installationId: string): Promise<LicenseCheckResult> {
    const result = await this.validate(installationId);

    if (result.ok && result.payload) {
      await this.syncOrganizationLicense(organizationId, result.payload);
      await this.writeAuditLog(organizationId, 'LICENSE_VALIDATED', {
        installationId,
        expiresAt: result.payload.expires_at,
      });
    } else {
      await this.markLicenseExpired(organizationId, result.message);
      await this.writeAuditLog(organizationId, 'LICENSE_EXPIRED', {
        installationId,
        reason: result.message,
      });
    }

    return result;
  }

  /** Periyodik heartbeat — validate ile aynı endpoint (license sunucusu uyumluluğu). */
  async heartbeat(installationId: string): Promise<LicenseCheckResult> {
    const result = await this.validate(installationId);

    if (result.ok) {
      await this.writeAuditLog(null, 'LICENSE_HEARTBEAT', {
        installationId,
        expiresAt: result.payload?.expires_at,
      });
    }

    return result;
  }

  async startTrial(installationId: string): Promise<LicenseCheckResult & { licenseKey?: string }> {
    return this.postLicenseEndpoint('/v1/license/trial', {
      app_code: this.config.appCode,
      hwid: installationId,
    });
  }

  async activate(installationId: string, licenseKey: string): Promise<LicenseCheckResult> {
    return this.postLicenseEndpoint('/v1/license/activate', {
      app_code: this.config.appCode,
      license_key: licenseKey,
      hwid: installationId,
    });
  }

  async validate(installationId: string): Promise<LicenseCheckResult> {
    return this.postLicenseEndpoint('/v1/license/check', {
      app_code: this.config.appCode,
      hwid: installationId,
    });
  }

  private async postLicenseEndpoint(
    path: string,
    body: Record<string, string>,
  ): Promise<LicenseCheckResult & { licenseKey?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['X-Api-Key'] = this.config.apiKey;
      }

      const response = await fetch(licenseApiUrl(this.config.baseUrl, path), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const json = (await response.json()) as LicenseApiResponse;

      if (!response.ok || !json.success || !json.data) {
        return {
          ok: false,
          statusCode: response.status,
          message: json.message ?? `Lisans API hatası (${response.status}).`,
        };
      }

      return {
        ok: true,
        statusCode: response.status,
        message: json.message ?? 'Lisans doğrulandı.',
        payload: json.data,
        licenseKey: body.license_key,
      };
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Lisans sunucusuna bağlanırken zaman aşımı oluştu.'
          : 'Lisans sunucusuna bağlanılamadı.';

      return {
        ok: false,
        statusCode: 503,
        message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async syncOrganizationLicense(
    organizationId: string,
    payload: LicenseApiPayload,
    extras?: {
      licenseKey?: string;
      trialStartedAt?: Date;
    },
  ): Promise<void> {
    const centralLicenseStatus = mapCentralLicenseStatus(payload);

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        centralLicenseStatus,
        centralLicenseType: payload.type,
        licenseExpiresAt: payload.expires_at ? new Date(payload.expires_at) : null,
        lastLicenseCheckAt: new Date(),
        ...(extras?.licenseKey ? { centralLicenseKey: extras.licenseKey } : {}),
        ...(extras?.trialStartedAt ? { trialStartedAt: extras.trialStartedAt } : {}),
        status: centralLicenseStatus === 'EXPIRED' || centralLicenseStatus === 'REVOKED' ? 'SUSPENDED' : 'ACTIVE',
      },
    });
  }

  private async markLicenseExpired(organizationId: string, reason: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        centralLicenseStatus: 'EXPIRED',
        lastLicenseCheckAt: new Date(),
        status: 'SUSPENDED',
        settings: {
          licenseError: reason,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async writeAuditLog(
    organizationId: string | null,
    action: AuditAction,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: organizationId ?? undefined,
        action,
        entityType: 'organization',
        entityId: organizationId ?? undefined,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

function mapCentralLicenseStatus(payload: LicenseApiPayload): CentralLicenseStatus {
  if (payload.status !== 'active') {
    return 'EXPIRED';
  }

  if (payload.type === 'trial') {
    return 'TRIAL';
  }

  return 'ACTIVE';
}
