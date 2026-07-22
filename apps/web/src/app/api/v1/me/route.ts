import { resolveApiContext } from '@/lib/api/auth-context';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { decimalToNumber, getMemberOpenBalance } from '@/lib/member-balance';
import { resolveOnDutyReception } from '@/lib/messaging/on-duty-reception';
import { prisma } from '@/lib/prisma';
export async function GET(request: Request) {
  const authResult = await resolveApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;

  if (context.scope === 'athlete') {
    const member = await prisma.gymMember.findFirst({
      where: { id: context.gymMemberId, organizationId: context.organizationId },
      include: {
        plan: { select: { id: true, name: true, durationDays: true, price: true, currency: true } },
        trainer: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!member) {
      return apiErrorI18n('athleteProfileNotFound', 404, request);
    }

    const [measurementCount, activeProgramCount, unreadMessages, openBalance, reception] =
      await Promise.all([
        prisma.healthMeasurement.count({
          where: { organizationId: context.organizationId, gymMemberId: member.id },
        }),
        prisma.trainingProgram.count({
          where: {
            organizationId: context.organizationId,
            gymMemberId: member.id,
            isActive: true,
          },
        }),
        prisma.directMessage.count({
          where: {
            organizationId: context.organizationId,
            receiverId: context.userId,
            isRead: false,
          },
        }),
        getMemberOpenBalance(context.organizationId, member.id),
        resolveOnDutyReception(context.organizationId, context.userId),
      ]);
    return apiOk({
      scope: 'athlete',
      user: {
        id: context.userId,
        email: context.email,
        name: context.name,
        locale: context.locale,
      },
      organization: member.organization,
      gymMember: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        status: member.status,
        email: member.email,
        phone: member.phone,
        avatarUrl: member.avatarUrl,
        locale: member.locale,
        membershipStartsAt: member.membershipStartsAt,
        membershipEndsAt: member.membershipEndsAt,
        plan: member.plan,
        trainer: member.trainer,
      },
      receptionOnDuty: reception
        ? {
            id: reception.userId,
            name: reception.name,
            email: reception.email,
            source: reception.source,
            role: reception.role,
          }
        : null,
      stats: {
        measurements: measurementCount,
        activePrograms: activeProgramCount,
        unreadMessages,
        openBalance: decimalToNumber(openBalance),
        currency: member.plan?.currency ?? 'TRY',
      },
    });
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: context.organizationId,
      userId: context.userId,
      isActive: true,
    },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!membership) {
    return apiErrorI18n('orgMembershipNotFound', 404, request);
  }

  return apiOk({
    scope: 'staff',
    user: {
      id: context.userId,
      email: context.email,
      name: context.name,
      locale: context.locale,
    },
    organization: membership.organization,
    role: context.role,
    gymMemberId: context.gymMemberId,
  });
}
