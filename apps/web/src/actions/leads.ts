'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit, getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { LeadSource, LeadStatus } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type LeadActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<'name' | 'phone' | 'email' | 'source', string>>;
};

// Faz 17.0 — lead pipeline resepsiyon/satış görevi; TRAINER kapsam dışı (bkz. Faz 36.5 gerekçesi).
async function getLeadContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' as const };
  }

  return { organizationId, actorId: session.user.id };
}

const LEAD_SOURCES = ['WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'WEBSITE', 'OTHER'] as const satisfies readonly LeadSource[];
const LEAD_MANUAL_STATUSES = ['NEW', 'CONTACTED', 'LOST'] as const satisfies readonly LeadStatus[];

const createLeadSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.enum(LEAD_SOURCES),
  interestedPlan: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});

export async function createLead(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const context = await getLeadContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createLeadSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    source: formData.get('source') ?? 'WALK_IN',
    interestedPlan: formData.get('interestedPlan') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: LeadActionState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field as keyof typeof fieldErrors] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        organizationId: context.organizationId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        source: data.source,
        interestedPlan: data.interestedPlan || null,
        notes: data.notes || null,
        createdById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'LEAD_CREATED',
        entityType: 'lead',
        entityId: created.id,
        metadata: { name: created.name, source: created.source },
      },
    });

    return created;
  });

  revalidatePath('/dashboard/leads');
  return { success: `${lead.name} aday olarak eklendi.` };
}

export async function updateLeadStatus(
  leadId: string,
  status: (typeof LEAD_MANUAL_STATUSES)[number],
): Promise<LeadActionState> {
  const context = await getLeadContext();
  if ('error' in context) {
    return { error: context.error };
  }
  if (!LEAD_MANUAL_STATUSES.includes(status)) {
    return { error: 'Geçersiz durum.' };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: context.organizationId } });
  if (!lead) {
    return { error: 'Aday bulunamadı.' };
  }
  if (lead.status === 'CONVERTED') {
    return { error: 'Üyeye dönüştürülmüş bir adayın durumu değiştirilemez.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: { status, lostAt: status === 'LOST' ? new Date() : null },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'LEAD_STATUS_CHANGED',
        entityType: 'lead',
        entityId: leadId,
        metadata: { from: lead.status, to: status },
      },
    });
  });

  revalidatePath('/dashboard/leads');
  return { success: 'Aday durumu güncellendi.' };
}

const scheduleFollowUpSchema = z.object({
  leadId: z.string().cuid(),
  scheduledAt: z.string().min(1),
  method: z.enum(['CALL', 'MESSAGE', 'EMAIL']),
  notes: z.string().max(500).optional(),
});

export async function scheduleLeadFollowUp(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const context = await getLeadContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = scheduleFollowUpSchema.safeParse({
    leadId: formData.get('leadId'),
    scheduledAt: formData.get('scheduledAt'),
    method: formData.get('method') ?? 'CALL',
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { error: 'Lütfen form alanlarını kontrol edin.' };
  }

  const data = parsed.data;
  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: 'Geçersiz tarih.' };
  }

  const lead = await prisma.lead.findFirst({ where: { id: data.leadId, organizationId: context.organizationId } });
  if (!lead) {
    return { error: 'Aday bulunamadı.' };
  }
  if (lead.status === 'CONVERTED' || lead.status === 'LOST') {
    return { error: 'Kapanmış bir aday için takip planlanamaz.' };
  }

  await prisma.$transaction(async (tx) => {
    const followUp = await tx.leadFollowUp.create({
      data: {
        organizationId: context.organizationId,
        leadId: data.leadId,
        scheduledAt,
        method: data.method,
        notes: data.notes || null,
        createdById: context.actorId,
      },
    });

    await tx.lead.update({ where: { id: data.leadId }, data: { status: 'FOLLOW_UP_SCHEDULED' } });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'LEAD_FOLLOW_UP_SCHEDULED',
        entityType: 'lead_follow_up',
        entityId: followUp.id,
        metadata: { leadId: data.leadId, scheduledAt: scheduledAt.toISOString(), method: data.method },
      },
    });
  });

  revalidatePath('/dashboard/leads');
  return { success: 'Takip planlandı.' };
}

export async function completeLeadFollowUp(followUpId: string): Promise<LeadActionState> {
  const context = await getLeadContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const followUp = await prisma.leadFollowUp.findFirst({
    where: { id: followUpId, organizationId: context.organizationId },
  });
  if (!followUp) {
    return { error: 'Takip kaydı bulunamadı.' };
  }
  if (followUp.completedAt) {
    return { error: 'Bu takip zaten tamamlanmış.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leadFollowUp.update({
      where: { id: followUpId },
      data: { completedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'LEAD_FOLLOW_UP_COMPLETED',
        entityType: 'lead_follow_up',
        entityId: followUpId,
        metadata: { leadId: followUp.leadId },
      },
    });
  });

  revalidatePath('/dashboard/leads');
  return { success: 'Takip tamamlandı olarak işaretlendi.' };
}

export async function convertLeadToMember(leadId: string): Promise<LeadActionState> {
  const context = await getLeadContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: context.organizationId } });
  if (!lead) {
    return { error: 'Aday bulunamadı.' };
  }
  if (lead.status === 'CONVERTED') {
    return { error: 'Bu aday zaten üyeye dönüştürülmüş.' };
  }

  const memberLimitError = await assertWithinMemberLimit(context.organizationId);
  if (memberLimitError) {
    return { error: memberLimitError };
  }

  const nameParts = lead.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? lead.name;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';

  await prisma.$transaction(async (tx) => {
    const created = await tx.gymMember.create({
      data: {
        organizationId: context.organizationId,
        firstName,
        lastName,
        phone: lead.phone,
        email: lead.email,
        notes: `Lead'den dönüştürüldü (kaynak: ${lead.source}).`,
      },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { status: 'CONVERTED', convertedMemberId: created.id, convertedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'LEAD_CONVERTED',
        entityType: 'lead',
        entityId: leadId,
        metadata: { memberId: created.id },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_REGISTERED',
        entityType: 'gym_member',
        entityId: created.id,
        metadata: { firstName, lastName, source: 'lead_conversion' },
      },
    });
  });

  revalidatePath('/dashboard/leads');
  revalidatePath('/dashboard/members');
  return { success: `${lead.name} üyeye dönüştürüldü.` };
}
