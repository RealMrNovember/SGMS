'use server';

import { auth } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/admin/guards';
import { parseOrganizationSettings } from '@/lib/admin/org-settings';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type MessageReportState = {
  error?: string;
  success?: string;
};

const reportSchema = z.object({
  messageId: z.string().cuid(),
  reason: z.string().min(3).max(2000),
});

export async function reportMessage(
  _prev: MessageReportState,
  formData: FormData,
): Promise<MessageReportState> {
  const parsed = reportSchema.safeParse({
    messageId: formData.get('messageId'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return { error: 'Şikayet metni en az 3 karakter olmalıdır.' };
  }

  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: 'Oturum gerekli.' };
  }
  if (session.user.isDemo) {
    return { error: 'Demo hesaplar değişiklik yapamaz. Bu bir inceleme hesabıdır — gerçek kullanım için ücretsiz deneme oluşturun.' };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });
  const settings = parseOrganizationSettings(org?.settings);
  if (settings.features?.messageReports === false) {
    return { error: 'Mesaj şikayeti bu salonda devre dışı.' };
  }

  const message = await prisma.directMessage.findFirst({
    where: {
      id: parsed.data.messageId,
      organizationId: session.user.organizationId,
      OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
    },
  });

  if (!message) {
    return { error: 'Mesaj bulunamadı.' };
  }

  await prisma.$transaction([
    prisma.messageReport.create({
      data: {
        organizationId: session.user.organizationId,
        messageId: message.id,
        reporterId: session.user.id,
        reason: parsed.data.reason.trim(),
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        actorId: session.user.id,
        action: 'MESSAGE_REPORTED',
        entityType: 'direct_message',
        entityId: message.id,
        metadata: {
          reason: parsed.data.reason.trim(),
          senderId: message.senderId,
          receiverId: message.receiverId,
        },
      },
    }),
  ]);

  revalidatePath('/admin/moderation');
  return { success: 'Şikayetiniz kaydedildi. İnceleme ekibimiz bilgilendirildi.' };
}

export async function reviewMessageReport(input: {
  reportId: string;
  status: 'REVIEWED' | 'DISMISSED';
  reviewNotes?: string;
}): Promise<MessageReportState> {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Master Admin yetkisi gerekir.' };
  }

  const report = await prisma.messageReport.findUnique({ where: { id: input.reportId } });
  if (!report) {
    return { error: 'Şikayet bulunamadı.' };
  }

  await prisma.messageReport.update({
    where: { id: report.id },
    data: {
      status: input.status,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: report.organizationId,
      actorId: session.user.id,
      action: 'SETTINGS_CHANGED',
      entityType: 'message_report',
      entityId: report.id,
      metadata: {
        moderation: true,
        status: input.status,
        reviewNotes: input.reviewNotes ?? null,
      },
    },
  });

  revalidatePath('/admin/moderation');
  revalidatePath('/admin/audit');
  return { success: 'Şikayet güncellendi.' };
}
