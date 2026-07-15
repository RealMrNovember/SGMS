'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export type PushActionState = {
  error?: string;
  success?: string;
};

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(300).optional(),
});

/** Tarayıcıdan gelen Web Push aboneliğini kaydeder — masaüstü/mobil uygulama gerekmez. */
export async function subscribeToPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<PushActionState> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Geçersiz abonelik verisi.' };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Oturum bulunamadı.' };
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      update: {
        userId: session.user.id,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userAgent: parsed.data.userAgent ?? null,
      },
      create: {
        userId: session.user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userAgent: parsed.data.userAgent ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        organizationId: session.user.organizationId ?? null,
        action: 'PUSH_SUBSCRIBED',
        entityType: 'user',
        entityId: session.user.id,
        metadata: { source: 'browser' },
      },
    });

    return { success: 'Tarayıcı bildirimleri etkinleştirildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Abonelik kaydedilemedi.' };
  }
}

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function unsubscribeFromPush(input: { endpoint: string }): Promise<PushActionState> {
  const parsed = unsubscribeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Geçersiz istek.' };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Oturum bulunamadı.' };
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: session.user.id },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        organizationId: session.user.organizationId ?? null,
        action: 'PUSH_UNSUBSCRIBED',
        entityType: 'user',
        entityId: session.user.id,
        metadata: { source: 'browser' },
      },
    });

    return { success: 'Tarayıcı bildirimleri kapatıldı.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Abonelik kaldırılamadı.' };
  }
}
