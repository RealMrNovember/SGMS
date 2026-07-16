'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { decimalToNumber } from '@/lib/member-balance';

export type LogSetProgressResult =
  | { error: string }
  | { completedSets: number; totalSets: number; weightUsed: number | null };

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function logSetProgress(input: {
  trainingProgramId: string;
  dayIndex: number;
  exerciseIndex: number;
  totalSets: number;
  weightUsed?: number;
}): Promise<LogSetProgressResult> {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }

  const organizationId = session.user.organizationId;
  const gymMemberId = session.user.gymMemberId;

  const writeBlock = await getTenantWriteBlockReason(organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const program = await prisma.trainingProgram.findFirst({
    where: { id: input.trainingProgramId, organizationId, gymMemberId },
    select: { id: true },
  });

  if (!program) {
    return { error: 'Program bulunamadı.' };
  }

  const performedDate = dayBounds(new Date());

  const existing = await prisma.exerciseSetLog.findUnique({
    where: {
      trainingProgramId_gymMemberId_dayIndex_exerciseIndex_performedDate: {
        trainingProgramId: input.trainingProgramId,
        gymMemberId,
        dayIndex: input.dayIndex,
        exerciseIndex: input.exerciseIndex,
        performedDate,
      },
    },
  });

  const log = existing
    ? await prisma.exerciseSetLog.update({
        where: { id: existing.id },
        data: {
          completedSets: existing.completedSets + 1,
          ...(input.weightUsed != null ? { weightUsed: input.weightUsed } : {}),
        },
      })
    : await prisma.exerciseSetLog.create({
        data: {
          organizationId,
          trainingProgramId: input.trainingProgramId,
          gymMemberId,
          dayIndex: input.dayIndex,
          exerciseIndex: input.exerciseIndex,
          performedDate,
          completedSets: 1,
          totalSets: input.totalSets,
          weightUsed: input.weightUsed ?? null,
        },
      });

  return {
    completedSets: log.completedSets,
    totalSets: log.totalSets,
    weightUsed: log.weightUsed != null ? decimalToNumber(log.weightUsed) : null,
  };
}
