import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';

export type AvatarEntityType = 'user' | 'gym_member';

export type AvatarUploadInput = {
  organizationId: string;
  entityType: AvatarEntityType;
  entityId: string;
  buffer: Buffer;
  mimeType: string;
};

export type AvatarUploadResult = {
  url: string;
  key: string;
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type StorageAdapter = {
  uploadAvatar(input: AvatarUploadInput): Promise<AvatarUploadResult>;
  deleteAvatar(key: string): Promise<void>;
};

function buildAvatarKey(input: AvatarUploadInput): string {
  const extension = MIME_EXTENSION[input.mimeType] ?? 'bin';
  return `${input.organizationId}/${input.entityType}_${input.entityId}.${extension}`;
}

function buildPublicUrl(key: string): string {
  return `/uploads/avatars/${key}`;
}

class LocalStorageAdapter implements StorageAdapter {
  private baseDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');

  async uploadAvatar(input: AvatarUploadInput): Promise<AvatarUploadResult> {
    const key = buildAvatarKey(input);
    const absolutePath = path.join(this.baseDir, key);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);
    return { key, url: buildPublicUrl(key) };
  }

  async deleteAvatar(key: string): Promise<void> {
    const absolutePath = path.join(this.baseDir, key);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files during replacement
    }
  }
}

class S3StorageAdapter implements StorageAdapter {
  async uploadAvatar(): Promise<AvatarUploadResult> {
    throw new Error('S3 storage is not configured yet. Set STORAGE_PROVIDER=local or implement S3 adapter.');
  }

  async deleteAvatar(): Promise<void> {
    throw new Error('S3 storage is not configured yet.');
  }
}

function getStorageAdapter(): StorageAdapter {
  const provider = process.env.STORAGE_PROVIDER ?? 'local';
  if (provider === 's3') {
    return new S3StorageAdapter();
  }
  return new LocalStorageAdapter();
}

const storage = getStorageAdapter();

export function validateAvatarFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: 'Yalnızca JPEG, PNG veya WebP yüklenebilir.' };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: 'Dosya boyutu 2 MB sınırını aşıyor.' };
  }

  return { ok: true };
}

export async function readAvatarBuffer(file: File) {
  const validation = validateAvatarFile(file);
  if (!validation.ok) {
    return validation;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength > MAX_AVATAR_BYTES) {
    return { ok: false as const, error: 'Dosya boyutu 2 MB sınırını aşıyor.' };
  }

  return { ok: true as const, buffer, mimeType: file.type };
}

export async function uploadAvatar(input: AvatarUploadInput): Promise<AvatarUploadResult> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error('Unsupported avatar mime type');
  }

  const key = buildAvatarKey(input);
  await storage.deleteAvatar(key);
  return storage.uploadAvatar(input);
}

export function avatarKeyFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith('/uploads/avatars/')) {
    return null;
  }
  return url.replace('/uploads/avatars/', '');
}
