import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import {
  deleteAvatarFromR2,
  isR2PublicUrl,
  relativeKeyFromR2Url,
  uploadAvatarToR2,
  uploadProgressPhotoToR2,
} from '@/lib/storage-r2';

export type AvatarEntityType = 'user' | 'gym_member' | 'expense_category';

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

export type ProgressPhotoUploadInput = {
  organizationId: string;
  gymMemberId: string;
  photoId: string;
  buffer: Buffer;
  mimeType: string;
};

export type ProgressPhotoUploadResult = {
  url: string;
  key: string;
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_PROGRESS_PHOTO_BYTES = 2 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type StorageAdapter = {
  uploadAvatar(input: AvatarUploadInput): Promise<AvatarUploadResult>;
  deleteAvatar(key: string): Promise<void>;
  uploadProgressPhoto(input: ProgressPhotoUploadInput): Promise<ProgressPhotoUploadResult>;
};

function buildAvatarKey(input: AvatarUploadInput): string {
  const extension = MIME_EXTENSION[input.mimeType] ?? 'bin';
  return `${input.organizationId}/${input.entityType}_${input.entityId}.${extension}`;
}

function buildProgressPhotoRelativeKey(input: ProgressPhotoUploadInput): string {
  const extension = MIME_EXTENSION[input.mimeType] ?? 'bin';
  return `${input.organizationId}/progress-photos/${input.gymMemberId}/${input.photoId}.${extension}`;
}

function buildLocalPublicUrl(key: string): string {
  return `/uploads/avatars/${key}`;
}

function buildProgressPhotoPublicUrl(key: string): string {
  return `/uploads/progress-photos/${key}`;
}

class LocalStorageAdapter implements StorageAdapter {
  private avatarBaseDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
  private progressPhotoBaseDir = path.join(process.cwd(), 'public', 'uploads', 'progress-photos');

  async uploadAvatar(input: AvatarUploadInput): Promise<AvatarUploadResult> {
    const key = buildAvatarKey(input);
    const absolutePath = path.join(this.avatarBaseDir, key);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);
    return { key, url: buildLocalPublicUrl(key) };
  }

  async deleteAvatar(key: string): Promise<void> {
    const absolutePath = path.join(this.avatarBaseDir, key);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files during replacement
    }
  }

  async uploadProgressPhoto(input: ProgressPhotoUploadInput): Promise<ProgressPhotoUploadResult> {
    const key = buildProgressPhotoRelativeKey(input);
    const absolutePath = path.join(this.progressPhotoBaseDir, key);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);
    return { key, url: buildProgressPhotoPublicUrl(key) };
  }
}

class R2StorageAdapter implements StorageAdapter {
  async uploadAvatar(input: AvatarUploadInput): Promise<AvatarUploadResult> {
    return uploadAvatarToR2(input);
  }

  async deleteAvatar(key: string): Promise<void> {
    return deleteAvatarFromR2(key);
  }

  async uploadProgressPhoto(input: ProgressPhotoUploadInput): Promise<ProgressPhotoUploadResult> {
    return uploadProgressPhotoToR2(input);
  }
}

function getStorageAdapter(): StorageAdapter {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (provider === 'r2' || provider === 's3') {
    return new R2StorageAdapter();
  }
  return new LocalStorageAdapter();
}

const storage = getStorageAdapter();

export function validateImageFile(
  file: File,
  maxBytes = MAX_AVATAR_BYTES,
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: 'Yalnızca JPEG, PNG veya WebP yüklenebilir.' };
  }

  if (file.size > maxBytes) {
    return { ok: false, error: 'Dosya boyutu 2 MB sınırını aşıyor.' };
  }

  return { ok: true };
}

export function validateAvatarFile(file: File): { ok: true } | { ok: false; error: string } {
  return validateImageFile(file, MAX_AVATAR_BYTES);
}

export function validateProgressPhotoFile(
  file: File,
): { ok: true } | { ok: false; error: string } {
  return validateImageFile(file, MAX_PROGRESS_PHOTO_BYTES);
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

export async function readProgressPhotoBuffer(file: File) {
  const validation = validateProgressPhotoFile(file);
  if (!validation.ok) {
    return validation;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength > MAX_PROGRESS_PHOTO_BYTES) {
    return { ok: false as const, error: 'Dosya boyutu 2 MB sınırını aşıyor.' };
  }

  return { ok: true as const, buffer, mimeType: file.type };
}

export async function uploadProgressPhoto(
  input: ProgressPhotoUploadInput,
): Promise<ProgressPhotoUploadResult> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error('Unsupported progress photo mime type');
  }

  return storage.uploadProgressPhoto(input);
}

export function avatarKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith('/uploads/avatars/')) {
    return url.replace('/uploads/avatars/', '');
  }

  if (isR2PublicUrl(url)) {
    return relativeKeyFromR2Url(url);
  }

  return null;
}

export function getStorageProvider(): 'local' | 'r2' {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  return provider === 'r2' || provider === 's3' ? 'r2' : 'local';
}
