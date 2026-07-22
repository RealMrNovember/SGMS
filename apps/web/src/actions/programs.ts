'use server';

import {
  parseProgramContentJson,
  sanitizeProgramContent,
  validateProgramContent,
} from '@/lib/program-content';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { trainerScopedMemberWhere } from '@/lib/trainers/member-scope';
import type { OrganizationRole, Prisma, ProgramType } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const PROGRAM_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'TRAINER']);

const createProgramSchema = z.object({
  gymMemberId: z.string().cuid(),
  title: z.string().min(2).max(120),
  type: z.enum(['WORKOUT', 'NUTRITION']),
  contentJson: z.string().optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  trainerId: z.string().cuid().optional().or(z.literal('')),
});

export type CreateProgramState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

async function getProgramContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const userId = session.user.id;

  if (!organizationId || !role || !PROGRAM_MANAGER_ROLES.has(role)) {
    return { error: 'Program oluşturmak için TRAINER, ADMIN veya OWNER yetkisi gerekir.' as const };
  }

  return { organizationId, role, userId };
}

function parseOptionalDate(value: string | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseContentJson(raw: string | undefined, type: ProgramType): Prisma.InputJsonValue {
  const parsed = parseProgramContentJson(raw, type);
  const validationError = validateProgramContent(parsed, type);
  if (validationError) {
    throw new Error(validationError);
  }
  return sanitizeProgramContent(parsed, type) as Prisma.InputJsonValue;
}

export async function createTrainingProgram(
  _prevState: CreateProgramState,
  formData: FormData,
): Promise<CreateProgramState> {
  const context = await getProgramContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createProgramSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    title: formData.get('title'),
    type: formData.get('type'),
    contentJson: formData.get('contentJson') ?? '',
    startDate: formData.get('startDate') ?? '',
    endDate: formData.get('endDate') ?? '',
    trainerId: formData.get('trainerId') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: CreateProgramState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;
  const gymMember = await prisma.gymMember.findFirst({
    where: {
      id: data.gymMemberId,
      organizationId: context.organizationId,
      ...trainerScopedMemberWhere(context.role, context.userId),
    },
  });

  if (!gymMember) {
    return { error: 'Sporcu bulunamadı veya size atanmamış.' };
  }

  if (context.role === 'TRAINER' && gymMember.trainerId !== context.userId) {
    return { error: 'Yalnızca kendi sporcularınıza program yazabilirsiniz.' };
  }

  const trainerId =
    context.role === 'TRAINER'
      ? context.userId
      : data.trainerId || gymMember.trainerId || context.userId;

  const trainerMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: context.organizationId,
      userId: trainerId,
      isActive: true,
      role: { in: ['TRAINER', 'ADMIN', 'OWNER'] },
    },
  });

  if (!trainerMembership) {
    return { fieldErrors: { trainerId: 'Atanan antrenör bu salonda geçerli değil.' } };
  }

  let content: Prisma.InputJsonValue;
  try {
    content = parseContentJson(data.contentJson, data.type);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Program içeriği geçersiz.';
    return { error: message };
  }

  await prisma.trainingProgram.create({
    data: {
      organizationId: context.organizationId,
      gymMemberId: data.gymMemberId,
      trainerId,
      title: data.title,
      type: data.type as ProgramType,
      content,
      startDate: parseOptionalDate(data.startDate) ?? new Date(),
      endDate: parseOptionalDate(data.endDate),
      isActive: true,
    },
  });

  revalidatePath('/dashboard/programs');

  return { success: `"${data.title}" programı oluşturuldu.` };
}

export async function toggleTrainingProgramActive(programId: string): Promise<{ error?: string }> {
  const context = await getProgramContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const program = await prisma.trainingProgram.findFirst({
    where: {
      id: programId,
      organizationId: context.organizationId,
      ...(context.role === 'TRAINER' ? { trainerId: context.userId } : {}),
    },
  });

  if (!program) {
    return { error: 'Program bulunamadı.' };
  }

  await prisma.trainingProgram.update({
    where: { id: programId },
    data: { isActive: !program.isActive },
  });

  revalidatePath('/dashboard/programs');
  return {};
}
