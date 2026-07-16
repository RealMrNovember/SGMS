import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/member-balance';

export type ProgressEntry = { completedSets: number; weightUsed: number | null };

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getTodayProgressMap(
  organizationId: string,
  gymMemberId: string,
  trainingProgramId: string,
  now = new Date(),
): Promise<Record<string, ProgressEntry>> {
  const { start, end } = dayBounds(now);

  const logs = await prisma.exerciseSetLog.findMany({
    where: {
      organizationId,
      gymMemberId,
      trainingProgramId,
      performedDate: { gte: start, lt: end },
    },
    select: {
      dayIndex: true,
      exerciseIndex: true,
      completedSets: true,
      weightUsed: true,
    },
  });

  const map: Record<string, ProgressEntry> = {};
  for (const log of logs) {
    map[`${log.dayIndex}-${log.exerciseIndex}`] = {
      completedSets: log.completedSets,
      weightUsed: log.weightUsed != null ? decimalToNumber(log.weightUsed) : null,
    };
  }
  return map;
}
