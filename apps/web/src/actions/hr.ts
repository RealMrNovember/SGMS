'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { LeaveRequestStatus, LeaveType } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const HR_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF', 'TRAINER'] as const);
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN'] as const);

const LEAVE_TYPES = ['ANNUAL', 'EXCUSED', 'MEDICAL'] as const satisfies readonly LeaveType[];
const LEAVE_DECISIONS = ['APPROVE', 'REJECT'] as const;

export type HrActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

async function getHrMemberContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const { organizationId, role, id: actorId } = session.user;
  if (!organizationId || !role || !(HR_ROLES as Set<string>).has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' as const };
  }
  return { organizationId, actorId, role };
}

async function getHrAdminContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const { organizationId, role, id: actorId } = session.user;
  if (!organizationId || !role || !ADMIN_ROLES.has(role as 'OWNER' | 'ADMIN')) {
    return { error: 'Bu işlem için OWNER veya ADMIN yetkisi gerekir.' as const };
  }
  return { organizationId, actorId, role };
}

function parseTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    return NaN;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  if ([s1, e1, s2, e2].some(Number.isNaN)) {
    return false;
  }
  return s1 < e2 && s2 < e1;
}

async function findShiftOverlap(
  organizationId: string,
  userId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeShiftId?: string,
): Promise<{ shiftName: string; startTime: string; endTime: string } | null> {
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      organizationId,
      userId,
      shift: {
        isActive: true,
        dayOfWeek,
        ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
      },
    },
    include: { shift: { select: { name: true, startTime: true, endTime: true } } },
  });

  for (const assignment of assignments) {
    if (timesOverlap(startTime, endTime, assignment.shift.startTime, assignment.shift.endTime)) {
      return {
        shiftName: assignment.shift.name,
        startTime: assignment.shift.startTime,
        endTime: assignment.shift.endTime,
      };
    }
  }
  return null;
}

const leaveRequestSchema = z.object({
  type: z.enum(LEAVE_TYPES),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(2000).optional(),
});

export async function requestLeave(_prev: HrActionState, formData: FormData): Promise<HrActionState> {
  const context = await getHrMemberContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = leaveRequestSchema.safeParse({
    type: formData.get('type') ?? 'ANNUAL',
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    reason: formData.get('reason') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Lütfen izin tarihlerini kontrol edin.' };
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) {
    return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' };
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.leaveRequest.create({
      data: {
        organizationId: context.organizationId,
        userId: context.actorId,
        type: parsed.data.type,
        startDate,
        endDate,
        reason: parsed.data.reason,
        status: 'PENDING',
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'LEAVE_REQUESTED',
        entityType: 'leave_request',
        entityId: row.id,
        metadata: {
          type: parsed.data.type,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });

    return row;
  });

  revalidatePath('/dashboard/hr');
  revalidatePath('/dashboard/hr/leaves');
  return { success: 'İzin talebiniz alındı.', ...(created ? {} : {}) };
}

const reviewLeaveSchema = z.object({
  leaveId: z.string().cuid(),
  decision: z.enum(LEAVE_DECISIONS),
  reviewNotes: z.string().max(2000).optional(),
});

export async function reviewLeave(_prev: HrActionState, formData: FormData): Promise<HrActionState> {
  const context = await getHrAdminContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = reviewLeaveSchema.safeParse({
    leaveId: formData.get('leaveId'),
    decision: formData.get('decision'),
    reviewNotes: formData.get('reviewNotes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz izin inceleme isteği.' };
  }

  const leave = await prisma.leaveRequest.findFirst({
    where: {
      id: parsed.data.leaveId,
      organizationId: context.organizationId,
      status: 'PENDING',
    },
  });

  if (!leave) {
    return { error: 'Bekleyen izin talebi bulunamadı.' };
  }

  const newStatus: LeaveRequestStatus = parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const auditAction = parsed.data.decision === 'APPROVE' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED';

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: newStatus,
        reviewedById: context.actorId,
        reviewedAt: new Date(),
        reviewNotes: parsed.data.reviewNotes,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: auditAction,
        entityType: 'leave_request',
        entityId: leave.id,
        metadata: {
          userId: leave.userId,
          decision: parsed.data.decision,
        },
      },
    });
  });

  revalidatePath('/dashboard/hr');
  revalidatePath('/dashboard/hr/leaves');
  return {
    success: parsed.data.decision === 'APPROVE' ? 'İzin talebi onaylandı.' : 'İzin talebi reddedildi.',
  };
}

const createShiftSchema = z.object({
  name: z.string().min(1).max(120),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/),
});

export async function createShift(_prev: HrActionState, formData: FormData): Promise<HrActionState> {
  const context = await getHrAdminContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createShiftSchema.safeParse({
    name: formData.get('name'),
    dayOfWeek: formData.get('dayOfWeek'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
  });

  if (!parsed.success) {
    return { error: 'Vardiya bilgilerini kontrol edin.' };
  }

  if (parseTimeToMinutes(parsed.data.endTime) <= parseTimeToMinutes(parsed.data.startTime)) {
    return { error: 'Bitiş saati başlangıçtan sonra olmalıdır.' };
  }

  const created = await prisma.$transaction(async (tx) => {
    const shift = await tx.shift.create({
      data: {
        organizationId: context.organizationId,
        name: parsed.data.name,
        dayOfWeek: parsed.data.dayOfWeek,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        createdById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'SHIFT_CREATED',
        entityType: 'shift',
        entityId: shift.id,
        metadata: {
          name: parsed.data.name,
          dayOfWeek: parsed.data.dayOfWeek,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
        },
      },
    });

    return shift;
  });

  revalidatePath('/dashboard/hr');
  revalidatePath('/dashboard/hr/shifts');
  return { success: `"${created.name}" vardiyası oluşturuldu.` };
}

const assignShiftSchema = z.object({
  shiftId: z.string().cuid(),
  userId: z.string().cuid(),
  weekStartDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function assignShift(_prev: HrActionState, formData: FormData): Promise<HrActionState> {
  const context = await getHrAdminContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = assignShiftSchema.safeParse({
    shiftId: formData.get('shiftId'),
    userId: formData.get('userId'),
    weekStartDate: formData.get('weekStartDate') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Vardiya atama bilgilerini kontrol edin.' };
  }

  const shift = await prisma.shift.findFirst({
    where: {
      id: parsed.data.shiftId,
      organizationId: context.organizationId,
      isActive: true,
    },
  });

  if (!shift) {
    return { error: 'Vardiya bulunamadı.' };
  }

  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: context.organizationId,
      userId: parsed.data.userId,
      isActive: true,
      role: { in: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'] },
    },
  });

  if (!member) {
    return { error: 'Personel bulunamadı.' };
  }

  const overlap = await findShiftOverlap(
    context.organizationId,
    parsed.data.userId,
    shift.dayOfWeek,
    shift.startTime,
    shift.endTime,
    shift.id,
  );

  if (overlap) {
    return {
      error: `Çakışan vardiya: ${overlap.shiftName} (${overlap.startTime}–${overlap.endTime}).`,
    };
  }

  const weekStartDate = parsed.data.weekStartDate ? new Date(parsed.data.weekStartDate) : null;

  try {
    await prisma.$transaction(async (tx) => {
      const assignment = await tx.shiftAssignment.create({
        data: {
          organizationId: context.organizationId,
          shiftId: shift.id,
          userId: parsed.data.userId,
          weekStartDate,
          notes: parsed.data.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: context.actorId,
          organizationId: context.organizationId,
          action: 'SHIFT_ASSIGNED',
          entityType: 'shift_assignment',
          entityId: assignment.id,
          metadata: {
            shiftId: shift.id,
            userId: parsed.data.userId,
            weekStartDate: weekStartDate?.toISOString() ?? null,
          },
        },
      });
    });
  } catch {
    return { error: 'Bu personel bu vardiyaya zaten atanmış.' };
  }

  revalidatePath('/dashboard/hr');
  revalidatePath('/dashboard/hr/shifts');
  return { success: 'Vardiya ataması kaydedildi.' };
}

const performanceReviewSchema = z.object({
  subjectUserId: z.string().cuid(),
  periodLabel: z.string().min(1).max(120),
  score: z.coerce.number().int().min(1).max(5),
  notes: z.string().min(1).max(5000),
});

export async function createPerformanceReview(
  _prev: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  const context = await getHrAdminContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = performanceReviewSchema.safeParse({
    subjectUserId: formData.get('subjectUserId'),
    periodLabel: formData.get('periodLabel'),
    score: formData.get('score'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    return { error: 'Performans değerlendirme bilgilerini kontrol edin.' };
  }

  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: context.organizationId,
      userId: parsed.data.subjectUserId,
      isActive: true,
    },
  });

  if (!member) {
    return { error: 'Personel bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    const review = await tx.performanceReview.create({
      data: {
        organizationId: context.organizationId,
        subjectUserId: parsed.data.subjectUserId,
        reviewerId: context.actorId,
        periodLabel: parsed.data.periodLabel,
        score: parsed.data.score,
        notes: parsed.data.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'PERFORMANCE_REVIEW_CREATED',
        entityType: 'performance_review',
        entityId: review.id,
        metadata: {
          subjectUserId: parsed.data.subjectUserId,
          score: parsed.data.score,
          periodLabel: parsed.data.periodLabel,
        },
      },
    });
  });

  revalidatePath('/dashboard/hr');
  return { success: 'Performans değerlendirmesi kaydedildi.' };
}

const disciplinaryRecordSchema = z.object({
  subjectUserId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: z.enum(['WARNING', 'REPRIMAND', 'SUSPENSION']),
  occurredAt: z.string().optional(),
});

export async function createDisciplinaryRecord(
  _prev: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  const context = await getHrAdminContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = disciplinaryRecordSchema.safeParse({
    subjectUserId: formData.get('subjectUserId'),
    title: formData.get('title'),
    description: formData.get('description'),
    severity: formData.get('severity') ?? 'WARNING',
    occurredAt: formData.get('occurredAt') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Disiplin kaydı bilgilerini kontrol edin.' };
  }

  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: context.organizationId,
      userId: parsed.data.subjectUserId,
      isActive: true,
    },
  });

  if (!member) {
    return { error: 'Personel bulunamadı.' };
  }

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();

  await prisma.$transaction(async (tx) => {
    const record = await tx.disciplinaryRecord.create({
      data: {
        organizationId: context.organizationId,
        subjectUserId: parsed.data.subjectUserId,
        createdById: context.actorId,
        title: parsed.data.title,
        description: parsed.data.description,
        severity: parsed.data.severity,
        occurredAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'DISCIPLINARY_RECORD_CREATED',
        entityType: 'disciplinary_record',
        entityId: record.id,
        metadata: {
          subjectUserId: parsed.data.subjectUserId,
          severity: parsed.data.severity,
          title: parsed.data.title,
        },
      },
    });
  });

  revalidatePath('/dashboard/hr');
  return { success: 'Disiplin kaydı oluşturuldu.' };
}

const compensationSchema = z.object({
  organizationMemberId: z.string().cuid(),
  baseSalary: z.string().optional(),
  bonusSummary: z.string().max(2000).optional(),
});

export async function updateStaffCompensation(
  _prev: HrActionState,
  formData: FormData,
): Promise<HrActionState> {
  const context = await getHrAdminContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = compensationSchema.safeParse({
    organizationMemberId: formData.get('organizationMemberId'),
    baseSalary: formData.get('baseSalary') || undefined,
    bonusSummary: formData.get('bonusSummary') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Maaş bilgilerini kontrol edin.' };
  }

  const member = await prisma.organizationMember.findFirst({
    where: {
      id: parsed.data.organizationMemberId,
      organizationId: context.organizationId,
      isActive: true,
    },
  });

  if (!member) {
    return { error: 'Personel bulunamadı.' };
  }

  const baseSalaryRaw = parsed.data.baseSalary?.trim();
  let baseSalary: string | null = null;
  if (baseSalaryRaw && baseSalaryRaw.length > 0) {
    const amount = Number(baseSalaryRaw.replace(',', '.'));
    if (Number.isNaN(amount) || amount < 0) {
      return { error: 'Geçerli bir maaş tutarı girin.' };
    }
    baseSalary = amount.toFixed(2);
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.update({
      where: { id: member.id },
      data: {
        baseSalary: baseSalary ?? null,
        bonusSummary: parsed.data.bonusSummary?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'STAFF_COMPENSATION_UPDATED',
        entityType: 'organization_member',
        entityId: member.id,
        metadata: {
          userId: member.userId,
          baseSalary,
          bonusSummary: parsed.data.bonusSummary?.trim() || null,
        },
      },
    });
  });

  revalidatePath('/dashboard/hr');
  return { success: 'Personel maaş bilgisi güncellendi.' };
}

function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportStaffCompensationCsv(): Promise<
  { success: true; csv: string; filename: string } | { success: false; error: string }
> {
  const context = await getHrAdminContext();
  if ('error' in context) {
    return { success: false, error: context.error ?? 'Bu işlem için yetkiniz yok.' };
  }

  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: context.organizationId,
      isActive: true,
      role: { in: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'] },
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  const headers = ['name', 'email', 'role', 'baseSalary', 'bonusSummary'];
  const rows = members.map((m) => [
    m.user.name ?? '',
    m.user.email,
    m.role,
    m.baseSalary?.toString() ?? '',
    m.bonusSummary ?? '',
  ]);

  const lines = [headers, ...rows].map((row) => row.map(toCsvValue).join(','));
  const csv = '\uFEFF' + lines.join('\r\n');
  const datePart = new Date().toISOString().slice(0, 10);

  await prisma.auditLog.create({
    data: {
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: 'STAFF_COMPENSATION_UPDATED',
      entityType: 'organization',
      entityId: context.organizationId,
      metadata: { export: true, rowCount: members.length },
    },
  });

  return { success: true, csv, filename: `staff_compensation_${datePart}.csv` };
}
