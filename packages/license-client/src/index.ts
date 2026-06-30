export { LicenseClientService } from './license-client.service.js';
export { resolveLicenseClientConfig, licenseApiUrl, postJsonPreserveMethod, normalizeLicenseBaseUrl } from './config.js';
export type { LicenseEndpoint } from './config.js';
export type {
  LicenseClientConfig,
  LicenseClientMetadata,
  LicenseApiPayload,
  LicenseApiResponse,
  LicenseCheckResult,
  EnsureLicenseInput,
  EnsureLicenseResult,
} from './types.js';
