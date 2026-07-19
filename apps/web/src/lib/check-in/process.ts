import { verifyAndConsumeCheckInQrToken } from '@/lib/check-in/qr-token';
import {
  hashGuestPassToken,
  isGuestPassQrToken,
  verifyGuestPassQrToken,
} from '@/lib/check-in/guest-qr';
import { publishCheckInEvent, type CheckInCreatedPayload } from '@/lib/realtime/hub';
import { sendPushToUsers } from '@/lib/push/send';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rate-limit';
import type { AccessDirection, AccessSubjectType, CheckInMethod, OrganizationRole } from '@sgms/database';

/** Aynı üye/personelin saniyeler içinde çift ENTRY üretmesini engeller. */
const CHECK_IN_DEBOUNCE_SECONDS = 8;

const RECEPTION_PUSH_ROLES: OrganizationRole[] = ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'];

/** Resepsiyon rolündeki personele salon girişi/çıkışı bildirimi gönderir — masaüstü/mobil
 * uygulama şart değil, tarayıcı push aboneliği yeterli. */
async function notifyReceptionOfCheckIn(
  organizationId: string,
  payload: CheckInCreatedPayload,
): Promise<void> {
  try {
    const staff = await prisma.organizationMember.findMany({
      where: { organizationId, isActive: true, role: { in: RECEPTION_PUSH_ROLES } },
      select: { userId: true },
    });
    if (staff.length === 0) return;

    const directionLabel = payload.direction === 'ENTRY' ? 'girişi' : 'çıkışı';
    await sendPushToUsers(
      staff.map((s) => s.userId),
      {
        title: `Salon ${directionLabel}`,
        body: `${payload.personName} salona ${directionLabel === 'girişi' ? 'girdi' : 'çıktı'}.`,
        url: '/dashboard/check-in',
        tag: 'sgms-checkin',
      },
    );
  } catch (error) {
    console.error('[push] check-in notify failed:', error);
  }
}

export type ProcessCheckInInput = {
  organizationId: string;
  method: CheckInMethod;
  direction?: AccessDirection | null;
  deviceId?: string | null;
  actorId?: string | null;
  gymMemberId?: string;
  staffUserId?: string;
  qrToken?: string;
  rfidTag?: string;
  clientEventId?: string | null;
  checkedInAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  skipRealtime?: boolean;
  conflictPolicy?: 'last-write-wins' | 'server-wins' | 'client-wins' | 'reject-if-newer-exists';
};

export type ProcessCheckInResult =
  | {
      ok: true;
      checkIn: CheckInCreatedPayload;
      duplicateWithinHour: boolean;
      idempotent: boolean;
    }
  | {
      ok: false;
      code:
        | 'member_not_found'
        | 'member_inactive'
        | 'membership_expired'
        | 'invalid_qr'
        | 'qr_already_used'
        | 'invalid_guest_pass'
        | 'guest_pass_expired'
        | 'guest_pass_revoked'
        | 'guest_pass_used'
        | 'org_mismatch'
        | 'sync_conflict'
        | 'too_rapid';
    };

type ResolvedSubject =
  | {
      subjectType: 'GYM_MEMBER';
      gymMemberId: string;
      staffUserId: null;
      guestPassId: null;
      personName: string;
      subtitle: string;
      avatarUrl: string | null;
    }
  | {
      subjectType: 'STAFF';
      gymMemberId: null;
      staffUserId: string;
      guestPassId: null;
      personName: string;
      subtitle: string;
      avatarUrl: string | null;
      role: OrganizationRole;
    }
  | {
      subjectType: 'GUEST';
      gymMemberId: null;
      staffUserId: null;
      guestPassId: string;
      personName: string;
      subtitle: string;
      avatarUrl: null;
    };

function parseDirection(value: unknown): AccessDirection | null {
  if (value === 'ENTRY' || value === 'EXIT') {
    return value;
  }
  return null;
}

export { parseDirection };

async function resolveSubject(input: ProcessCheckInInput): Promise<
  | ResolvedSubject
  | {
      error:
        | 'member_not_found'
        | 'invalid_qr'
        | 'qr_already_used'
        | 'org_mismatch'
        | 'member_inactive'
        | 'invalid_guest_pass'
        | 'guest_pass_expired'
        | 'guest_pass_revoked'
        | 'guest_pass_used';
    }
> {
  if (input.staffUserId) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.staffUserId,
        isActive: true,
      },
      include: { user: { select: { name: true, avatarUrl: true, status: true } } },
    });
    if (!membership || membership.user.status !== 'ACTIVE') {
      return { error: 'member_inactive' };
    }
    return {
      subjectType: 'STAFF',
      gymMemberId: null,
      staffUserId: input.staffUserId,
      guestPassId: null,
      personName: membership.user.name,
      subtitle: `Personel · ${membership.role}`,
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
    };
  }

  if (input.gymMemberId) {
    const member = await prisma.gymMember.findFirst({
      where: { id: input.gymMemberId, organizationId: input.organizationId },
      include: { plan: { select: { name: true } } },
    });
    if (!member) {
      return { error: 'member_not_found' };
    }
    if (member.status !== 'ACTIVE') {
      return { error: 'member_inactive' };
    }
    return {
      subjectType: 'GYM_MEMBER',
      gymMemberId: member.id,
      staffUserId: null,
      guestPassId: null,
      personName: `${member.firstName} ${member.lastName}`,
      subtitle: member.plan?.name ? `Üye · ${member.plan.name}` : 'Üye',
      avatarUrl: member.avatarUrl,
    };
  }

  if (input.qrToken && isGuestPassQrToken(input.qrToken)) {
    const payload = verifyGuestPassQrToken(input.qrToken);
    if (!payload) {
      return { error: 'invalid_guest_pass' };
    }
    if (payload.organizationId !== input.organizationId) {
      return { error: 'org_mismatch' };
    }

    const tokenHash = hashGuestPassToken(input.qrToken);
    const pass = await prisma.guestPass.findFirst({
      where: { id: payload.guestPassId, organizationId: input.organizationId, qrTokenHash: tokenHash },
    });
    if (!pass) {
      return { error: 'invalid_guest_pass' };
    }
    const now = new Date();
    if (pass.revokedAt) {
      return { error: 'guest_pass_revoked' };
    }
    if (pass.validFrom > now || pass.validUntil < now) {
      return { error: 'guest_pass_expired' };
    }
    if (pass.usedAt) {
      return { error: 'guest_pass_used' };
    }

    return {
      subjectType: 'GUEST',
      gymMemberId: null,
      staffUserId: null,
      guestPassId: pass.id,
      personName: pass.guestName,
      subtitle: 'Misafir',
      avatarUrl: null,
    };
  }

  if (input.qrToken) {
    const verified = await verifyAndConsumeCheckInQrToken(input.qrToken);
    if (!verified.ok) {
      return { error: verified.reason === 'already_used' ? 'qr_already_used' : 'invalid_qr' };
    }
    if (verified.payload.organizationId !== input.organizationId) {
      return { error: 'org_mismatch' };
    }
    return resolveSubject({
      ...input,
      gymMemberId: verified.payload.gymMemberId,
      qrToken: undefined,
    });
  }

  if (input.rfidTag) {
    const tag = input.rfidTag.trim();
    const member = await prisma.gymMember.findFirst({
      where: { organizationId: input.organizationId, rfidTag: tag },
      include: { plan: { select: { name: true } } },
    });
    if (member) {
      if (member.status !== 'ACTIVE') {
        return { error: 'member_inactive' };
      }
      return {
        subjectType: 'GYM_MEMBER',
        gymMemberId: member.id,
        staffUserId: null,
        guestPassId: null,
        personName: `${member.firstName} ${member.lastName}`,
        subtitle: member.plan?.name ? `Üye · ${member.plan.name}` : 'Üye',
        avatarUrl: member.avatarUrl,
      };
    }

    const staffMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: input.organizationId,
        rfidTag: tag,
        isActive: true,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true, status: true } } },
    });
    if (staffMembership && staffMembership.user.status === 'ACTIVE') {
      return {
        subjectType: 'STAFF',
        gymMemberId: null,
        staffUserId: staffMembership.user.id,
        guestPassId: null,
        personName: staffMembership.user.name,
        subtitle: `Personel · ${staffMembership.role}`,
        avatarUrl: staffMembership.user.avatarUrl,
        role: staffMembership.role,
      };
    }

    return { error: 'member_not_found' };
  }

  return { error: 'member_not_found' };
}

async function inferDirection(
  organizationId: string,
  subject: ResolvedSubject,
  explicit: AccessDirection | null | undefined,
  at: Date,
): Promise<AccessDirection> {
  if (explicit) {
    return explicit;
  }

  const last = await prisma.checkIn.findFirst({
    where: {
      organizationId,
      checkedInAt: { lte: at },
      ...(subject.subjectType === 'GYM_MEMBER'
        ? { gymMemberId: subject.gymMemberId }
        : subject.subjectType === 'STAFF'
          ? { staffUserId: subject.staffUserId }
          : { guestPassId: subject.guestPassId }),
    },
    orderBy: { checkedInAt: 'desc' },
    select: { direction: true },
  });

  return last?.direction === 'ENTRY' ? 'EXIT' : 'ENTRY';
}

function toPayload(
  checkIn: {
    id: string;
    method: CheckInMethod;
    direction: AccessDirection;
    subjectType: AccessSubjectType;
    checkedInAt: Date;
    gymMemberId: string | null;
    staffUserId: string | null;
  },
  subject: ResolvedSubject,
  deviceId: string | null,
  deviceName: string | null,
): CheckInCreatedPayload {
  return {
    id: checkIn.id,
    subjectType: checkIn.subjectType,
    direction: checkIn.direction,
    gymMemberId: checkIn.gymMemberId,
    staffUserId: checkIn.staffUserId,
    personName: subject.personName,
    subtitle: subject.subtitle,
    avatarUrl: subject.avatarUrl,
    role: subject.subjectType === 'STAFF' ? subject.role : null,
    memberName: subject.personName,
    method: checkIn.method,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    deviceId,
    deviceName,
  };
}

export async function processCheckIn(input: ProcessCheckInInput): Promise<ProcessCheckInResult> {
  if (input.clientEventId && input.deviceId) {
    const existing = await prisma.checkIn.findFirst({
      where: { deviceId: input.deviceId, clientEventId: input.clientEventId },
      include: {
        gymMember: { select: { firstName: true, lastName: true, avatarUrl: true, plan: { select: { name: true } } } },
        staffUser: { select: { name: true, avatarUrl: true } },
        device: { select: { name: true } },
      },
    });
    if (existing) {
      const policy = input.conflictPolicy ?? 'last-write-wins';

      if (
        policy === 'client-wins' &&
        input.checkedInAt &&
        input.checkedInAt.getTime() > existing.checkedInAt.getTime()
      ) {
        const updated = await prisma.checkIn.update({
          where: { id: existing.id },
          data: { checkedInAt: input.checkedInAt },
          include: {
            gymMember: { select: { firstName: true, lastName: true, avatarUrl: true, plan: { select: { name: true } } } },
            staffUser: { select: { name: true, avatarUrl: true } },
            device: { select: { name: true } },
          },
        });
        existing.checkedInAt = updated.checkedInAt;
      } else if (
        policy === 'reject-if-newer-exists' &&
        input.checkedInAt &&
        existing.checkedInAt.getTime() >= input.checkedInAt.getTime()
      ) {
        return { ok: false, code: 'sync_conflict' };
      }

      const personName = existing.gymMember
        ? `${existing.gymMember.firstName} ${existing.gymMember.lastName}`
        : (existing.staffUser?.name ?? '—');
      const subtitle =
        existing.subjectType === 'STAFF'
          ? 'Personel'
          : existing.gymMember?.plan?.name
            ? `Üye · ${existing.gymMember.plan.name}`
            : 'Üye';
      return {
        ok: true,
        checkIn: {
          id: existing.id,
          subjectType: existing.subjectType,
          direction: existing.direction,
          gymMemberId: existing.gymMemberId,
          staffUserId: existing.staffUserId,
          personName,
          subtitle,
          avatarUrl: existing.gymMember?.avatarUrl ?? existing.staffUser?.avatarUrl ?? null,
          role: null,
          memberName: personName,
          method: existing.method,
          checkedInAt: existing.checkedInAt.toISOString(),
          deviceId: existing.deviceId,
          deviceName: existing.device?.name ?? null,
        },
        duplicateWithinHour: true,
        idempotent: true,
      };
    }
  }

  const subject = await resolveSubject(input);
  if ('error' in subject) {
    return { ok: false, code: subject.error === 'member_inactive' ? 'member_inactive' : subject.error };
  }

  const checkedInAt = input.checkedInAt ?? new Date();

  if (subject.subjectType === 'GYM_MEMBER') {
    const member = await prisma.gymMember.findFirst({
      where: { id: subject.gymMemberId!, organizationId: input.organizationId },
      select: { membershipEndsAt: true },
    });
    if (member?.membershipEndsAt && member.membershipEndsAt.getTime() < checkedInAt.getTime()) {
      return { ok: false, code: 'membership_expired' };
    }
  }

  const direction = await inferDirection(input.organizationId, subject, input.direction, checkedInAt);

  // Aynı üye + aynı yön, birkaç saniye içinde → istatistik şişmesini önle.
  // Offline senkron (tarihsel checkedInAt) için DB penceresi; canlı için Redis kilidi (yarış koruması).
  const subjectKey =
    subject.subjectType === 'GYM_MEMBER'
      ? subject.gymMemberId!
      : subject.subjectType === 'STAFF'
        ? subject.staffUserId!
        : subject.guestPassId!;
  const isNearRealtime = Math.abs(Date.now() - checkedInAt.getTime()) < 60_000;

  if (isNearRealtime) {
    const debounce = await consumeRateLimit(
      `rl:checkin:${input.organizationId}:${subjectKey}:${direction}`,
      1,
      CHECK_IN_DEBOUNCE_SECONDS,
    );
    if (!debounce.allowed) {
      return { ok: false, code: 'too_rapid' };
    }
  } else {
    const rapidWindowStart = new Date(checkedInAt.getTime() - CHECK_IN_DEBOUNCE_SECONDS * 1000);
    const rapidSame = await prisma.checkIn.findFirst({
      where: {
        organizationId: input.organizationId,
        direction,
        checkedInAt: { gte: rapidWindowStart, lte: checkedInAt },
        ...(subject.subjectType === 'GYM_MEMBER'
          ? { gymMemberId: subject.gymMemberId }
          : subject.subjectType === 'STAFF'
            ? { staffUserId: subject.staffUserId }
            : { guestPassId: subject.guestPassId }),
      },
      select: { id: true },
    });
    if (rapidSame) {
      return { ok: false, code: 'too_rapid' };
    }
  }

  const hourBefore = new Date(checkedInAt.getTime() - 60 * 60 * 1000);
  const recent = await prisma.checkIn.findFirst({
    where: {
      organizationId: input.organizationId,
      checkedInAt: { gte: hourBefore, lte: checkedInAt },
      ...(subject.subjectType === 'GYM_MEMBER'
        ? { gymMemberId: subject.gymMemberId }
        : subject.subjectType === 'STAFF'
          ? { staffUserId: subject.staffUserId }
          : { guestPassId: subject.guestPassId }),
    },
    orderBy: { checkedInAt: 'desc' },
  });

  const device = input.deviceId
    ? await prisma.device.findFirst({
        where: { id: input.deviceId },
        select: { name: true },
      })
    : null;

  const checkIn = await prisma.checkIn.create({
    data: {
      organizationId: input.organizationId,
      subjectType: subject.subjectType,
      direction,
      gymMemberId: subject.gymMemberId,
      staffUserId: subject.staffUserId,
      guestPassId: subject.guestPassId,
      deviceId: input.deviceId ?? null,
      clientEventId: input.clientEventId ?? null,
      method: input.method,
      checkedInAt,
      metadata: {},
    },
  });

  if (subject.subjectType === 'GUEST' && direction === 'ENTRY') {
    await prisma.guestPass.update({
      where: { id: subject.guestPassId },
      data: { usedAt: checkedInAt },
    });
  }

  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: 'MEMBER_CHECK_IN',
      entityType: 'CheckIn',
      entityId: checkIn.id,
      metadata: {
        subjectType: subject.subjectType,
        direction,
        gymMemberId: subject.gymMemberId,
        staffUserId: subject.staffUserId,
        method: input.method,
        deviceId: input.deviceId ?? null,
        clientEventId: input.clientEventId ?? null,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  if (input.deviceId) {
    const deviceRow = await prisma.device.findFirst({
      where: { id: input.deviceId },
      select: { status: true },
    });
    await prisma.device.update({
      where: { id: input.deviceId },
      data: {
        lastSeenAt: new Date(),
        // DRAINING penceresini bozma — offline boşaltma tamamlanana kadar korunur.
        ...(deviceRow?.status === 'DRAINING' ? {} : { status: 'ONLINE' as const }),
      },
    });
  }

  const payload = toPayload(checkIn, subject, input.deviceId ?? null, device?.name ?? null);

  if (!input.skipRealtime) {
    publishCheckInEvent({
      type: 'checkin.created',
      organizationId: input.organizationId,
      checkIn: payload,
    });
  }

  if (subject.subjectType === 'GYM_MEMBER') {
    void notifyReceptionOfCheckIn(input.organizationId, payload);
  }

  return {
    ok: true,
    checkIn: payload,
    duplicateWithinHour: Boolean(recent),
    idempotent: false,
  };
}
