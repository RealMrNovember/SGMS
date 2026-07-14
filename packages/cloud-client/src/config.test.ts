import { describe, expect, it } from 'vitest';
import { cloudApiUrl, normalizeCloudBaseUrl, resolveCloudClientConfig } from './config.js';

describe('normalizeCloudBaseUrl', () => {
  it('appends /api to a bare host', () => {
    expect(normalizeCloudBaseUrl('https://cloud.cicibyte.com')).toBe(
      'https://cloud.cicibyte.com/api',
    );
  });

  it('leaves an already-correct base URL untouched', () => {
    expect(normalizeCloudBaseUrl('https://cloud.cicibyte.com/api')).toBe(
      'https://cloud.cicibyte.com/api',
    );
  });

  it('strips trailing slashes before checking the suffix', () => {
    expect(normalizeCloudBaseUrl('https://cloud.cicibyte.com/api/')).toBe(
      'https://cloud.cicibyte.com/api',
    );
  });
});

describe('cloudApiUrl', () => {
  it('joins base and path without duplicating slashes', () => {
    expect(cloudApiUrl('https://cloud.cicibyte.com/api', 'v1/health')).toBe(
      'https://cloud.cicibyte.com/api/v1/health',
    );
    expect(cloudApiUrl('https://cloud.cicibyte.com/api/', '/v1/health')).toBe(
      'https://cloud.cicibyte.com/api/v1/health',
    );
  });
});

describe('resolveCloudClientConfig', () => {
  it('falls back to the cloud.cicibyte.com default when nothing is provided', () => {
    const config = resolveCloudClientConfig({});
    expect(config.baseUrl).toBe('https://cloud.cicibyte.com/api');
    expect(config.productSlug).toBe('sgms');
    expect(config.timeoutMs).toBe(15_000);
  });

  it('prefers explicit config over defaults', () => {
    const config = resolveCloudClientConfig({
      baseUrl: 'https://staging.cloud.cicibyte.com',
      productSlug: 'sgms-staging',
      apiKey: 'cbcloud_test',
      timeoutMs: 5000,
    });

    expect(config.baseUrl).toBe('https://staging.cloud.cicibyte.com/api');
    expect(config.productSlug).toBe('sgms-staging');
    expect(config.apiKey).toBe('cbcloud_test');
    expect(config.timeoutMs).toBe(5000);
  });
});
