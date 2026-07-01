import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AvatarUploadInput, AvatarUploadResult } from '@/lib/storage';

const AVATAR_PREFIX = 'avatars';

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new Error(
      'R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL.',
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const { accountId, accessKeyId, secretAccessKey } = getR2Config();
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return cachedClient;
}

export function buildR2ObjectKey(relativeKey: string): string {
  return `${AVATAR_PREFIX}/${relativeKey}`;
}

export function buildR2PublicUrl(relativeKey: string): string {
  const { publicBaseUrl } = getR2Config();
  return `${publicBaseUrl}/${buildR2ObjectKey(relativeKey)}`;
}

export function isR2PublicUrl(url: string): boolean {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  return Boolean(base && url.startsWith(`${base}/`));
}

export function relativeKeyFromR2Url(url: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!base || !url.startsWith(`${base}/`)) {
    return null;
  }
  const objectKey = url.slice(base.length + 1);
  if (!objectKey.startsWith(`${AVATAR_PREFIX}/`)) {
    return null;
  }
  return objectKey.slice(AVATAR_PREFIX.length + 1);
}

export async function getSignedAvatarUrl(
  relativeKey: string,
  expiresInSeconds = Number(process.env.R2_SIGNED_URL_TTL_SECONDS ?? 3600),
): Promise<string> {
  const { bucket } = getR2Config();
  const client = getR2Client();
  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600;

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: buildR2ObjectKey(relativeKey),
    }),
    { expiresIn: ttl },
  );
}

export async function uploadAvatarToR2(input: AvatarUploadInput): Promise<AvatarUploadResult> {
  const { bucket } = getR2Config();
  const client = getR2Client();
  const relativeKey = `${input.organizationId}/${input.entityType}_${input.entityId}.${mimeExtension(input.mimeType)}`;
  const objectKey = buildR2ObjectKey(relativeKey);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: input.buffer,
      ContentType: input.mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const useSigned =
    process.env.R2_USE_SIGNED_URLS === 'true' || process.env.R2_USE_SIGNED_URLS === '1';

  return {
    key: relativeKey,
    url: useSigned ? await getSignedAvatarUrl(relativeKey) : buildR2PublicUrl(relativeKey),
  };
}

export async function deleteAvatarFromR2(relativeKey: string): Promise<void> {
  const { bucket } = getR2Config();
  const client = getR2Client();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: buildR2ObjectKey(relativeKey),
      }),
    );
  } catch {
    // replacement flow — missing object is fine
  }
}

function mimeExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}
