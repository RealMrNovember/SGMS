import { createHmac, timingSafeEqual } from 'crypto';

/**
 * cloud.cicibyte.com'un WebhookEndpoint::signaturesFor() ile ürettiği imzayı doğrular:
 * hash_hmac('sha256', json_encode($payload), $secret). Karşılaştırma ham gövde (raw body)
 * üzerinden yapılmalı — parse edilmiş JSON'u yeniden stringify etmek imzayı bozar.
 */
export function verifyCloudWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CLOUD_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signatureHeader, 'hex');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
