import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyCloudWebhookSignature } from './cloud-webhook';

describe('verifyCloudWebhookSignature', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUD_WEBHOOK_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a signature computed over the exact raw body with the shared secret', () => {
    const rawBody = '{"payment_id":1,"tenant_slug":"pilates-studio"}';
    const signature = createHmac('sha256', 'test-secret').update(rawBody).digest('hex');

    expect(verifyCloudWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const rawBody = '{"payment_id":1,"tenant_slug":"pilates-studio"}';
    const signature = createHmac('sha256', 'wrong-secret').update(rawBody).digest('hex');

    expect(verifyCloudWebhookSignature(rawBody, signature)).toBe(false);
  });

  it('rejects when the body was tampered with after signing', () => {
    const original = '{"payment_id":1,"tenant_slug":"pilates-studio"}';
    const signature = createHmac('sha256', 'test-secret').update(original).digest('hex');
    const tampered = '{"payment_id":2,"tenant_slug":"pilates-studio"}';

    expect(verifyCloudWebhookSignature(tampered, signature)).toBe(false);
  });

  it('rejects when no signature header is present', () => {
    expect(verifyCloudWebhookSignature('{}', null)).toBe(false);
  });

  it('rejects when CLOUD_WEBHOOK_SECRET is not configured', () => {
    vi.stubEnv('CLOUD_WEBHOOK_SECRET', '');
    const signature = createHmac('sha256', 'test-secret').update('{}').digest('hex');

    expect(verifyCloudWebhookSignature('{}', signature)).toBe(false);
  });
});
