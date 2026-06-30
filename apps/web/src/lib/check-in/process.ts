import { verifyCheckInQrToken } from '@/lib/check-in/qr-token';
import { prisma } from '@/lib/prisma';
import type { CheckInMethod } from '@sgms/database';

export type ProcessCheckInInput = {
  organizationId: string;
  method: CheckInMethod;
  deviceId?: string | null;
  actorId?: string | null;
  gymMemberId?: string;
  qrToken?: string;
  rfidTag?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ProcessCheckInResult =
  | {
      ok: true;
      checkIn: {
        id: string;
        gymMemberId: string;
        method: CheckInMethod;
        checkedInAt: Date;
        memberName: string;
      };
      duplicateWithinHour: boolean;
    }
  | { ok: false; code: 'member_not_found' | 'member_inactive' | 'membership_expired' | 'invalid_qr' | 'org_mismatch' };

async function resolveMemberId(input: ProcessCheckInInput): Promise<
  | { gymMemberId: string }
  | { error: 'member_not_found' | 'invalid_qr' | 'org_mismatch' }
> {
  if (input.gymMemberId) {
    return { gymMemberId: input.gymMemberId };
  }

  if (input.qrToken) {
    const payload = verifyCheckInQrToken(input.qrToken);
    if (!payload) {
      return { error: 'invalid_qr' };
    }
    if (payload.organizationId !== input.organizationId) {
      return { error: 'org_mismatch' };
    }
    return { gymMemberId: payload.gymMemberId };
  }

  if (input.rfidTag) {
    const member = await prisma.gymMember.findFirst({
      where: {
        organizationId: input.organizationId,
        rfidTag: input.rfidTag.trim(),
      },
      select: { id: true },
    });
    if (!member) {
      return { error: 'member_not_found' };
    }
    return { gymMemberId: member.id };
  }

  return { error: 'member_not_found' };
}

export async function processCheckIn(input: ProcessCheckInInput): Promise<ProcessCheckInResult> {
  const resolved = await resolveMemberId(input);
  if ('error' in resolved) {
    return { ok: false, code: resolved.error };
  }

  const member = await prisma.gymMember.findFirst({
    where: {
      id: resolved.gymMemberId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      membershipEndsAt: true,
    },
  });

  if (!member) {
    return { ok: false, code: 'member_not_found' };
  }

  if (member.status !== 'ACTIVE') {
    return { ok: false, code: 'member_inactive' };
  }

  if (member.membershipEndsAt && member.membershipEndsAt.getTime() < Date.now()) {
    return { ok: false, code: 'membership_expired' };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.checkIn.findFirst({
    where: {
      organizationId: input.organizationId,
      gymMemberId: member.id,
      checkedInAt: { gte: hourAgo },
    },
    orderBy: { checkedInAt: 'desc' },
  });

  const checkIn = await prisma.checkIn.create({
    data: {
      organizationId: input.organizationId,
      gymMemberId: member.id,
      deviceId: input.deviceId ?? null,
      method: input.method,
      metadata: {},
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: 'MEMBER_CHECK_IN',
      entityType: 'CheckIn',
      entityId: checkIn.id,
      metadata: {
        gymMemberId: member.id,
        method: input.method,
        deviceId: input.deviceId ?? null,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  if (input.deviceId) {
    await prisma.device.update({
      where: { id: input.deviceId },
      data: { lastSeenAt: new Date(), status: 'ONLINE' },
    });
  }

  return {
    ok: true,
    checkIn: {
      id: checkIn.id,
      gymMemberId: member.id,
      method: checkIn.method,
      checkedInAt: checkIn.checkedInAt,
      memberName: `${member.firstName} ${member.lastName}`,
    },
    duplicateWithinHour: Boolean(recent),
  };
}
