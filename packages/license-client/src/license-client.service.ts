import type {
  AuditAction,
  CentralLicenseStatus,
  Prisma,
  PrismaClient,
} from '@sgms/database';
import { resolveLicenseClientConfig, licenseApiUrl, postJsonPreserveMethod, type LicenseEndpoint } from './config.js';
import type {
  EnsureLicenseInput,
  EnsureLicenseResult,
  LicenseApiPayload,
  LicenseApiResponse,
  LicenseCheckResult,
  LicenseClientConfig,
  LicenseClientMetadata,
} from './types.js';

/**
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

    const metadata = pickLicenseMetadata(input);

    if (input.licenseKey ?? organization.centralLicenseKey) {
      const activateResult = await this.activate(
        input.installationId,
        input.licenseKey ?? organization.centralLicenseKey!,
        metadata,
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

    const validateResult = await this.validate(input.installationId, metadata);

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

    const trialResult = await this.startTrial(input.installationId, metadata);

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
  async validateOnLogin(
    organizationId: string,
    installationId: string,
    metadata?: LicenseClientMetadata,
  ): Promise<LicenseCheckResult> {
    const result = await this.validate(installationId, metadata);

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

  /** Periyodik heartbeat — org kaydını günceller (cron). */
  async refreshOrganizationLicense(
    organizationId: string,
    metadata?: LicenseClientMetadata,
  ): Promise<LicenseCheckResult> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { installationId: true },
    });

    const result = await this.validate(organization.installationId, metadata);

    if (result.ok && result.payload) {
      await this.syncOrganizationLicense(organizationId, result.payload);
      await this.writeAuditLog(organizationId, 'LICENSE_HEARTBEAT', {
        installationId: organization.installationId,
        expiresAt: result.payload.expires_at,
      });
    } else {
      await this.markLicenseExpired(organizationId, result.message);
      await this.writeAuditLog(organizationId, 'LICENSE_EXPIRED', {
        installationId: organization.installationId,
        reason: result.message,
        source: 'heartbeat',
      });
    }

    return result;
  }

  async startTrial(
    installationId: string,
    metadata?: LicenseClientMetadata,
  ): Promise<LicenseCheckResult & { licenseKey?: string }> {
    return this.postLicenseEndpoint('trial', this.buildLicenseBody(installationId, metadata));
  }

  async activate(
    installationId: string,
    licenseKey: string,
    metadata?: LicenseClientMetadata,
  ): Promise<LicenseCheckResult> {
    return this.postLicenseEndpoint(
      'activate',
      this.buildLicenseBody(installationId, metadata, { license_key: licenseKey }),
    );
  }

  async validate(
    installationId: string,
    metadata?: LicenseClientMetadata,
  ): Promise<LicenseCheckResult> {
    return this.postLicenseEndpoint('check', this.buildLicenseBody(installationId, metadata));
  }

  private buildLicenseBody(
    installationId: string,
    metadata?: LicenseClientMetadata,
    extras?: Record<string, string>,
  ): Record<string, string> {
    const body: Record<string, string> = {
      app_code: this.config.appCode,
      hwid: installationId,
      ...extras,
    };

    if (metadata?.clientName?.trim()) {
      body.client_name = metadata.clientName.trim();
    }
    if (metadata?.email?.trim()) {
      body.email = metadata.email.trim().toLowerCase();
    }
    if (metadata?.deviceName?.trim()) {
      body.device_name = metadata.deviceName.trim();
    }
    if (metadata?.platform) {
      body.platform = metadata.platform;
    }

    return body;
  }

  private async postLicenseEndpoint(
    endpoint: LicenseEndpoint,
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
        headers['X-Api-Key'] = this.config.apiKey.trim();
      }

      const response = await postJsonPreserveMethod(licenseApiUrl(this.config.baseUrl, endpoint), {
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const rawText = await response.text();
      let json: LicenseApiResponse;
      try {
        json = JSON.parse(rawText) as LicenseApiResponse;
      } catch {
        return {
          ok: false,
          statusCode: response.status,
          message: rawText.slice(0, 240) || `Lisans API hatası (${response.status}).`,
        };
      }

      if (!response.ok || !json.success || !json.data) {
        return {
          ok: false,
          statusCode: response.status,
          message:
            json.message ??
            (typeof json.data === 'object' && json.data !== null
              ? JSON.stringify(json.data).slice(0, 200)
              : `Lisans API hatası (${response.status}).`),
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
      },
    });
  }

  private async markLicenseExpired(organizationId: string, reason: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        centralLicenseStatus: 'EXPIRED',
        lastLicenseCheckAt: new Date(),
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

function pickLicenseMetadata(input: EnsureLicenseInput): LicenseClientMetadata {
  return {
    clientName: input.clientName,
    email: input.email,
    deviceName: input.deviceName,
    platform: input.platform,
  };
}
