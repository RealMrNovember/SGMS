import { prisma } from '@/lib/prisma';
import {
  buildConversationSummaries,
  type PeerProfile,
} from '@/lib/messaging/conversations';
import { publishMessageReadEvent } from '@/lib/realtime/hub';

export async function loadPeerDirectory(
  organizationId: string,
  currentUserId: string,
  athleteLabel: string,
) {
  const [staffMembers, athleteMembers] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId, isActive: true, userId: { not: currentUserId } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.gymMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        AND: [{ userId: { not: null } }, { userId: { not: currentUserId } }],
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  const peerMeta = new Map<string, Omit<PeerProfile, 'id'>>();
  const recipients: { id: string; label: string }[] = [];

  for (const member of staffMembers) {
    const subtitle = member.role;
    peerMeta.set(member.user.id, {
      name: member.user.name ?? member.user.email,
      subtitle,
      avatarUrl: member.user.avatarUrl,
    });
    recipients.push({
      id: member.user.id,
      label: `${member.user.name ?? member.user.email} (${member.role})`,
    });
  }

  for (const athlete of athleteMembers) {
    if (!athlete.user) continue;
    peerMeta.set(athlete.user.id, {
      name: athlete.user.name ?? athlete.user.email,
      subtitle: athleteLabel,
      avatarUrl: athlete.user.avatarUrl,
    });
    recipients.push({
      id: athlete.user.id,
      label: `${athlete.user.name ?? athlete.user.email} (${athleteLabel})`,
    });
  }

  return { peerMeta, recipients };
}

export async function loadConversationSummaries(
  organizationId: string,
  currentUserId: string,
  peerMeta: Map<string, Omit<PeerProfile, 'id'>>,
) {
  const messages = await prisma.directMessage.findMany({
    where: {
      organizationId,
      OR: [{ senderId: currentUserId }, { receiverId: currentUserId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
    include: {
      sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return buildConversationSummaries(messages, currentUserId, peerMeta);
}

export async function loadThreadMessages(
  organizationId: string,
  currentUserId: string,
  peerId: string,
) {
  return prisma.directMessage.findMany({
    where: {
      organizationId,
      OR: [
        { senderId: currentUserId, receiverId: peerId },
        { senderId: peerId, receiverId: currentUserId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      content: true,
      createdAt: true,
      senderId: true,
      deliveredAt: true,
      readAt: true,
      sender: { select: { name: true, email: true } },
    },
  });
}

export async function markPeerMessagesRead(
  organizationId: string,
  currentUserId: string,
  peerId: string,
) {
  const readAt = new Date();
  const { count } = await prisma.directMessage.updateMany({
    where: {
      organizationId,
      senderId: peerId,
      receiverId: currentUserId,
      isRead: false,
    },
    data: { isRead: true, readAt },
  });

  if (count > 0) {
    publishMessageReadEvent({
      type: 'message.read',
      organizationId,
      userIds: [peerId],
      readerId: currentUserId,
      peerId: currentUserId,
      readAt: readAt.toISOString(),
    });
  }
}
