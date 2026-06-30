import { createHash, randomBytes } from 'crypto';

export const DEVICE_KEY_PREFIX = 'sgms_dev_';

export function hashDeviceKey(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex');
}

export function generatePlainDeviceKey(): string {
  return `${DEVICE_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function extractDeviceKey(request: Request): string | null {
  const deviceHeader = request.headers.get('x-device-key')?.trim();
  if (deviceHeader) {
    return deviceHeader;
  }

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Device ')) {
    const key = auth.slice('Device '.length).trim();
    return key.length > 0 ? key : null;
  }

  return null;
}
