import { requireTenantApiContext } from '@/lib/api/guard';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, userId } = authResult.context;
  const box = new URL(request.url).searchParams.get('box') ?? 'inbox';

  const messages =
    box === 'sent'
      ? await prisma.directMessage.findMany({
          where: { organizationId, senderId: userId },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            receiver: { select: { id: true, name: true, email: true } },
          },
        })
      : await prisma.directMessage.findMany({
          where: { organizationId, receiverId: userId },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            sender: { select: { id: true, name: true, email: true } },
          },
        });

  return apiOk({ messages, count: messages.length, box });
}

export async function POST(request: Request) {
  const authResult = await requireTenantApiContext();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, userId } = authResult.context;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('Geçersiz JSON gövdesi.', 400);
  }

  const receiverId = typeof body.receiverId === 'string' ? body.receiverId : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!receiverId || !content) {
    return apiError('receiverId ve content zorunludur.', 400);
  }

  if (receiverId === userId) {
    return apiError('Kendinize mesaj gönderemezsiniz.', 400);
  }

  const receiverMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: receiverId,
      isActive: true,
    },
  });

  const receiverAthlete = await prisma.gymMember.findFirst({
    where: {
      organizationId,
      userId: receiverId,
      status: 'ACTIVE',
    },
  });

  if (!receiverMembership && !receiverAthlete) {
    return apiError('Alıcı bu organizasyonda bulunamadı.', 404);
  }

  const message = await prisma.directMessage.create({
    data: {
      organizationId,
      senderId: userId,
      receiverId,
      content,
    },
  });

  return apiOk({ message }, 201);
}
