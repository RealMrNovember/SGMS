import {
  resolveDeviceCheckInAccess,
  type DeviceCheckInAccess,
} from '@/lib/billing/device-checkin-access';
import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { getCloudClient } from '@/lib/cloud-sync';
import { prisma } from '@/lib/prisma';
import { redisSetNx } from '@/lib/redis';
import { siteConfig } from '@/lib/site-config';

/**
 * Cihaz/turnike check-in için abonelik + nezaket penceresi.
 * Panel `billing_only` olsa bile grace içinde allowed=true döner.
 */
export async function assertDeviceCheckInAllowed(
  organizationId: string,
): Promise<
  | { ok: true; deviceAccess: DeviceCheckInAccess }
  | { ok: false; deviceAccess: DeviceCheckInAccess; code: 'subscription_device_blocked' }
> {
  const access = await resolveSubscriptionAccess(organizationId);
  const deviceAccess = resolveDeviceCheckInAccess(access);

  if (deviceAccess.phase === 'grace') {
    void maybeNotifyDeviceGrace(organizationId, deviceAccess);
  }

  if (!deviceAccess.allowed) {
    return { ok: false, deviceAccess, code: 'subscription_device_blocked' };
  }

  return { ok: true, deviceAccess };
}

/** Nezaket penceresine ilk girişte sahibe tek seferlik e-posta (Redis NX). */
async function maybeNotifyDeviceGrace(
  organizationId: string,
  deviceAccess: DeviceCheckInAccess,
): Promise<void> {
  if (deviceAccess.phase !== 'grace' || deviceAccess.graceDaysRemaining == null) {
    return;
  }

  const claimed = await redisSetNx(
    `billing:device-grace-mail:${organizationId}`,
    60 * 60 * 24 * 40,
    '1',
  );
  // Redis yoksa her istekte mail atmamak için sessizce çık.
  if (claimed !== true) {
    return;
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
        email: true,
        members: {
          where: { role: 'OWNER', isActive: true },
          take: 1,
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });

    const to = org?.email ?? org?.members[0]?.user.email;
    if (!to || !org) {
      return;
    }

    const days = deviceAccess.graceDaysRemaining;
    const ends = deviceAccess.graceEndsAt
      ? deviceAccess.graceEndsAt.toLocaleDateString('tr-TR')
      : '—';
    const billingUrl = `${siteConfig.url}/dashboard/billing`;

    await getCloudClient().sendMail({
      to,
      subject: `SGMS — Turnike ${days} gün içinde kapanacak`,
      html: `
        <p>Merhaba ${org.members[0]?.user.name ?? org.name},</p>
        <p><strong>${org.name}</strong> panel erişimi kilitlendi; turnike/cihaz check-in
        henüz açık (nezaket penceresi). <strong>${ends}</strong> tarihinde
        (${days} gün) turnike de kapanacak.</p>
        <p>Kesinti yaşamamak için aboneliğinizi yenileyin:</p>
        <p><a href="${billingUrl}">${billingUrl}</a></p>
      `.trim(),
      category: 'transactional',
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: null,
        action: 'SUBSCRIPTION_CHANGED',
        entityType: 'organization',
        entityId: organizationId,
        metadata: {
          kind: 'device_grace_notified',
          graceDaysRemaining: days,
          graceEndsAt: deviceAccess.graceEndsAt?.toISOString() ?? null,
        },
      },
    });
  } catch (error) {
    console.error('[billing] device grace mail failed:', error);
  }
}
