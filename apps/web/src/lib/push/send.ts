import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:support@cicibyte.com';

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Bir kullanıcının tüm tarayıcı aboneliklerine push bildirimi gönderir (masaüstü/mobil
 * uygulama şart değil). Geçersiz/süresi dolmuş abonelikler (410/404) otomatik temizlenir.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    return;
  }

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('[push] send failed:', sub.id, error);
        }
      }
    }),
  );
}

/** Aynı bildirim birden fazla kullanıcıya (ör. tüm resepsiyon rolleri) gönderilir. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((userId) => sendPushToUser(userId, payload)));
}
