import { processCheckIn, parseDirection, type ProcessCheckInResult } from '@/lib/check-in/process';
import { prisma } from '@/lib/prisma';
import type { CheckInMethod, SyncBatchStatus } from '@sgms/database';

export type SyncPushEvent = {
  clientEventId: string;
  method?: CheckInMethod;
  direction?: 'ENTRY' | 'EXIT';
  gymMemberId?: string;
  staffUserId?: string;
  rfidTag?: string;
  qrToken?: string;
  checkedInAt?: string;
  /** last-write-wins (default) | server-wins | client-wins | reject-if-newer-exists */
  conflictPolicy?: 'last-write-wins' | 'server-wins' | 'client-wins' | 'reject-if-newer-exists';
};

export type SyncPushEventResult = {
  clientEventId: string;
  ok: boolean;
  code?: string;
  checkInId?: string;
  idempotent?: boolean;
};

function parseCheckedInAt(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveMethod(event: SyncPushEvent): CheckInMethod {
  if (event.method) {
    return event.method;
  }
  if (event.qrToken) {
    return 'QR';
  }
  if (event.rfidTag) {
    return 'RFID';
  }
  return 'DEVICE';
}

export async function processSyncPushBatch(input: {
  organizationId: string;
  deviceId: string;
  events: SyncPushEvent[];
}): Promise<{
  batchId: string;
  status: SyncBatchStatus;
  results: SyncPushEventResult[];
}> {
  const results: SyncPushEventResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const event of input.events) {
    if (!event.clientEventId) {
      failedCount += 1;
      results.push({ clientEventId: '', ok: false, code: 'missing_client_event_id' });
      continue;
    }

    const result: ProcessCheckInResult = await processCheckIn({
      organizationId: input.organizationId,
      deviceId: input.deviceId,
      method: resolveMethod(event),
      direction: parseDirection(event.direction),
      clientEventId: event.clientEventId,
      gymMemberId: event.gymMemberId,
      staffUserId: event.staffUserId,
      rfidTag: event.rfidTag,
      qrToken: event.qrToken,
      checkedInAt: parseCheckedInAt(event.checkedInAt),
      conflictPolicy: event.conflictPolicy,
    });

    if (result.ok) {
      successCount += 1;
      results.push({
        clientEventId: event.clientEventId,
        ok: true,
        checkInId: result.checkIn.id,
        idempotent: result.idempotent,
      });
    } else {
      failedCount += 1;
      results.push({
        clientEventId: event.clientEventId,
        ok: false,
        code: result.code,
      });
    }
  }

  const status: SyncBatchStatus =
    failedCount === 0 ? 'COMPLETED' : successCount === 0 ? 'FAILED' : 'PARTIAL';

  const batch = await prisma.syncBatch.create({
    data: {
      organizationId: input.organizationId,
      deviceId: input.deviceId,
      eventCount: input.events.length,
      successCount,
      failedCount,
      status,
      result: results,
      syncedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      action: 'MEMBER_CHECK_IN',
      entityType: 'SyncBatch',
      entityId: batch.id,
      metadata: {
        deviceId: input.deviceId,
        eventCount: input.events.length,
        successCount,
        failedCount,
        status,
      },
    },
  });

  await prisma.device.update({
    where: { id: input.deviceId },
    data: { lastSeenAt: new Date(), status: 'ONLINE' },
  });

  return { batchId: batch.id, status, results };
}

export async function pullMemberCache(organizationId: string) {
  const [members, staff] = await Promise.all([
    prisma.gymMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rfidTag: true,
        membershipEndsAt: true,
        status: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.organizationMember.findMany({
      where: { organizationId, isActive: true, rfidTag: { not: null } },
      select: {
        userId: true,
        role: true,
        rfidTag: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return {
    syncedAt: new Date().toISOString(),
    memberCount: members.length,
    staffCount: staff.length,
    members: members.map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      rfidTag: m.rfidTag,
      membershipEndsAt: m.membershipEndsAt?.toISOString() ?? null,
      status: m.status,
    })),
    staff: staff.map((s) => ({
      userId: s.userId,
      name: s.user.name,
      role: s.role,
      rfidTag: s.rfidTag,
    })),
  };
}
