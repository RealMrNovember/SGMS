import { PrismaClient } from '@sgms/database';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CloudClientService } from './cloud-client.service.js';

const REMINDER_WINDOW_DAYS = 3;

function loadWebEnv(): void {
  const candidates = [
    resolve(process.cwd(), '../../apps/web/.env.local'),
    resolve(process.cwd(), '../../../apps/web/.env.local'),
    '/www/wwwroot/sgms.cicibyte.com/apps/web/.env.local',
  ];

  for (const file of candidates) {
    if (!existsSync(file)) {
      continue;
    }

    const content = readFileSync(file, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/\r$/, '').trim();
      }
    }
    break;
  }
}

function buildReminderHtml(memberName: string, orgName: string, planName: string, endsAt: Date, daysLeft: number) {
  const dateLabel = endsAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <div style="font-family: Arial, sans-serif; color: #0b1220;">
      <h2 style="color:#a8792f;">${orgName}</h2>
      <p>Merhaba ${memberName},</p>
      <p><strong>${planName}</strong> üyeliğiniz <strong>${dateLabel}</strong> tarihinde
      (${daysLeft} gün içinde) sona erecek.</p>
      <p>Üyeliğinizi kesintisiz sürdürmek için salonunuzla iletişime geçerek yenileyebilirsiniz.</p>
      <p style="color:#64748b; font-size:12px; margin-top:24px;">Bu e-posta ${orgName} tarafından SGMS üzerinden otomatik gönderilmiştir.</p>
    </div>
  `.trim();
}

async function main() {
  loadWebEnv();

  const prisma = new PrismaClient();
  const client = new CloudClientService(prisma);

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const members = await prisma.gymMember.findMany({
    where: {
      status: 'ACTIVE',
      membershipEndsAt: { gte: now, lte: windowEnd },
      email: { not: null },
    },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const member of members) {
    const endsAt = member.membershipEndsAt!;
    const reminderThreshold = new Date(endsAt.getTime() - REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    if (member.lastReminderSentAt && member.lastReminderSentAt >= reminderThreshold) {
      skipped += 1;
      continue;
    }

    const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const memberName = `${member.firstName} ${member.lastName}`.trim();
    const orgName = member.organization.name;
    const planName = member.plan?.name ?? 'Üyelik';

    const result = await client.sendMail({
      to: member.email!,
      subject: `${orgName} — üyeliğiniz ${daysLeft} gün içinde sona eriyor`,
      html: buildReminderHtml(memberName, orgName, planName, endsAt, daysLeft),
      category: 'reminder',
    });

    if (result.ok) {
      sent += 1;
      await prisma.gymMember.update({
        where: { id: member.id },
        data: { lastReminderSentAt: now },
      });
      await prisma.auditLog.create({
        data: {
          organizationId: member.organization.id,
          actorId: null,
          action: 'MEMBERSHIP_REMINDER_SENT',
          entityType: 'gym_member',
          entityId: member.id,
          metadata: { daysLeft, membershipEndsAt: endsAt.toISOString() },
        },
      });
    } else {
      failed += 1;
      console.error(`[reminders] mail failed for ${member.id}:`, result.message);
    }
  }

  console.log(`Üyelik hatırlatmaları: ${sent} gönderildi, ${skipped} atlandı, ${failed} başarısız.`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
