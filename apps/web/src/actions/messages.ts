'use server';

import { auth } from '@/lib/auth';
import { consumeMessageRateLimit, consumeTypingRateLimit } from '@/lib/rate-limit';
import { publishMessageEvent } from '@/lib/realtime/hub';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const sendMessageSchema = z.object({
  receiverId: z.string().cuid(),
  content: z.string().min(1).max(4000),
});

export type SendMessageState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

async function getMessageContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;

  if (!organizationId) {
    return { error: 'Aktif salon bulunamadı.' as const };
  }

  return { organizationId, userId };
}

export async function sendDirectMessage(
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const context = await getMessageContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const rate = await consumeMessageRateLimit(context.userId, context.organizationId);
  if (!rate.allowed) {
    return { error: 'Çok hızlı mesaj gönderiyorsunuz. Lütfen bir dakika bekleyin.' };
  }

  const parsed = sendMessageSchema.safeParse({
    receiverId: formData.get('receiverId'),
    content: formData.get('content'),
  });

  if (!parsed.success) {
    const fieldErrors: SendMessageState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const { receiverId, content } = parsed.data;

  if (receiverId === context.userId) {
    return { error: 'Kendinize mesaj gönderemezsiniz.' };
  }

  const [receiverMembership, receiverAthlete] = await Promise.all([
    prisma.organizationMember.findFirst({
      where: { organizationId: context.organizationId, userId: receiverId, isActive: true },
    }),
    prisma.gymMember.findFirst({
      where: { organizationId: context.organizationId, userId: receiverId, status: 'ACTIVE' },
    }),
  ]);

  if (!receiverMembership && !receiverAthlete) {
    return { error: 'Alıcı bu salonda bulunamadı.' };
  }

  const message = await prisma.directMessage.create({
    data: {
      organizationId: context.organizationId,
      senderId: context.userId,
      receiverId,
      content: content.trim(),
      deliveredAt: new Date(),
    },
  });

  publishMessageEvent({
    type: 'message.created',
    organizationId: context.organizationId,
    userIds: [receiverId, context.userId],
    message: {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    },
  });

  revalidatePath('/dashboard/messages');
  revalidatePath('/athlete/messages');

  return { success: 'Mesaj gönderildi.' };
}

export async function sendTypingPulse(receiverId: string): Promise<void> {
  const context = await getMessageContext();
  if ('error' in context || receiverId === context.userId) {
    return;
  }

  const rate = await consumeTypingRateLimit(context.userId, context.organizationId);
  if (!rate.allowed) {
    return;
  }

  const { publishTypingEvent } = await import('@/lib/realtime/hub');
  publishTypingEvent({
    type: 'message.typing',
    organizationId: context.organizationId,
    userIds: [receiverId],
    senderId: context.userId,
    receiverId,
  });
}

export async function markMessageRead(messageId: string): Promise<{ error?: string }> {
  const context = await getMessageContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const message = await prisma.directMessage.findFirst({
    where: {
      id: messageId,
      organizationId: context.organizationId,
      receiverId: context.userId,
    },
  });

  if (!message) {
    return { error: 'Mesaj bulunamadı.' };
  }

  if (!message.isRead) {
    await prisma.directMessage.update({
      where: { id: messageId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  revalidatePath('/dashboard/messages');
  revalidatePath('/athlete/messages');
  revalidatePath('/athlete');

  return {};
}
