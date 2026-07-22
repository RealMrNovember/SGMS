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
 * Bir kullanıcının tüm tarayıcı aboneliklerine + native Expo push token'larına
 * bildirim gönderir. Geçersiz/süresi dolmuş abonelikler otomatik temizlenir.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  await Promise.all([sendWebPushToUser(userId, payload), sendExpoPushToUser(userId, payload)]);
}

async function sendWebPushToUser(userId: string, payload: PushPayload): Promise<void> {
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

async function sendExpoPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const tokens = await prisma.deviceToken.findMany({ where: { userId }, select: { id: true, token: true } });
  if (tokens.length === 0) {
    return;
  }

  const messages = tokens.map((row) => ({
    to: row.token,
    sound: 'default' as const,
    title: payload.title,
    body: payload.body,
    data: { url: payload.url ?? '/', tag: payload.tag ?? null },
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      console.error('[push/expo] HTTP', response.status, await response.text().catch(() => ''));
      return;
    }
    const result = (await response.json()) as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    };
    const rows = Array.isArray(result.data) ? result.data : [];
    await Promise.all(
      rows.map(async (ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const tokenId = tokens[index]?.id;
          if (tokenId) {
            await prisma.deviceToken.delete({ where: { id: tokenId } }).catch(() => {});
          }
        }
      }),
    );
  } catch (error) {
    console.error('[push/expo] send failed', error);
  }
}

/** Aynı bildirim birden fazla kullanıcıya (ör. tüm resepsiyon rolleri) gönderilir. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((userId) => sendPushToUser(userId, payload)));
}
