import {
  requireMemberScopedApiContext,
  requireTenantWriteAccess,
} from '@/lib/api/guard';
import { isStaffContext } from '@/lib/api/auth-context';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { publishMessageEvent } from '@/lib/realtime/hub';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const box = new URL(request.url).searchParams.get('box') ?? 'inbox';
  const { limit, cursor } = parseListParams(request);

  const { items, hasMore, nextCursor } =
    box === 'sent'
      ? await fetchPage(limit, cursor, (page) =>
          prisma.directMessage.findMany({
            where: { organizationId: context.organizationId, senderId: context.userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: {
              receiver: { select: { id: true, name: true, email: true } },
            },
            ...page,
          }),
        )
      : await fetchPage(limit, cursor, (page) =>
          prisma.directMessage.findMany({
            where: { organizationId: context.organizationId, receiverId: context.userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: {
              sender: { select: { id: true, name: true, email: true } },
            },
            ...page,
          }),
        );

  return apiOk({ messages: items, count: items.length, box, hasMore, nextCursor });
}

export async function POST(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;

  if (isStaffContext(context)) {
    const writeBlock = await requireTenantWriteAccess(context.organizationId, request);
    if (writeBlock) {
      return writeBlock.response;
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const receiverId = typeof body.receiverId === 'string' ? body.receiverId : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!receiverId || !content) {
    return apiErrorI18n('receiverContentRequired', 400, request);
  }

  if (receiverId === context.userId) {
    return apiErrorI18n('cannotMessageSelf', 400, request);
  }

  const receiverMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: context.organizationId,
      userId: receiverId,
      isActive: true,
    },
  });

  const receiverAthlete = await prisma.gymMember.findFirst({
    where: {
      organizationId: context.organizationId,
      userId: receiverId,
      status: 'ACTIVE',
    },
  });

  if (!receiverMembership && !receiverAthlete) {
    return apiErrorI18n('receiverNotInOrg', 404, request);
  }

  const message = await prisma.directMessage.create({
    data: {
      organizationId: context.organizationId,
      senderId: context.userId,
      receiverId,
      content,
      deliveredAt: new Date(),
    },
  });

  publishMessageEvent({
    type: 'message.created',
    organizationId: context.organizationId,
    userIds: [receiverId, context.userId],
    message: {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    },
  });

  return apiOk({ message }, 201);
}
