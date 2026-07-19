import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from '@/lib/auth.config';
import {
  getRequestAuditContext,
  writeAuditLog,
  writeLoginFailedAudit,
} from '@/lib/audit/logger';
import { syncOrganizationToCloud } from '@/lib/cloud-sync';
import { prisma } from '@/lib/prisma';
import { consumeLoginRateLimit } from '@/lib/rate-limit';
import { isStaffDeactivatedCache } from '@/lib/api/staff-revoke-cache';
import { matchBackupCode, verifyTotpToken } from '@/lib/two-factor';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totp: z.string().optional(),
});

export const { handlers, auth: baseAuth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    signOut: async (message) => {
      const userId = 'token' in message ? message.token?.sub : null;
      if (!userId) return;

      const ctx = await getRequestAuditContext();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          memberships: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { organizationId: true },
          },
        },
      });

      if (!user) return;

      void writeAuditLog({
        actorId: user.id,
        organizationId: user.memberships[0]?.organizationId ?? null,
        action: 'USER_LOGOUT',
        entityType: 'user',
        entityId: user.id,
        metadata: { source: 'web' },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    },
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'E-posta', type: 'email' },
        password: { label: 'Parola', type: 'password' },
      },
      authorize: async (credentials) => {
        const ctx = await getRequestAuditContext();
        const rawEmail = String(credentials?.email ?? '').toLowerCase();

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          void writeLoginFailedAudit({
            email: rawEmail || 'unknown',
            reason: 'invalid_credentials_format',
            source: 'web',
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          });
          return null;
        }

        const rateLimit = await consumeLoginRateLimit(parsed.data.email, ctx.ipAddress ?? 'unknown');
        if (!rateLimit.allowed) {
          void writeLoginFailedAudit({
            email: parsed.data.email.toLowerCase(),
            reason: 'rate_limited',
            source: 'web',
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: {
            memberships: {
              where: { isActive: true },
              include: {
                organization: {
                  select: { id: true, name: true, installationId: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            gymMemberProfile: {
              select: {
                id: true,
                organizationId: true,
                status: true,
                organization: { select: { name: true } },
              },
            },
            partnerProfile: {
              select: { id: true, isActive: true },
            },
            hierarchyMemberships: {
              where: { isActive: true },
              select: { id: true },
              take: 1,
            },
          },
        });

        if (!user) {
          void writeLoginFailedAudit({
            email: parsed.data.email.toLowerCase(),
            reason: 'user_not_found',
            source: 'web',
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          });
          return null;
        }

        if (user.status !== 'ACTIVE') {
          void writeLoginFailedAudit({
            email: parsed.data.email.toLowerCase(),
            reason: 'user_inactive',
            actorId: user.id,
            organizationId: user.memberships[0]?.organizationId ?? null,
            source: 'web',
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          });
          return null;
        }

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          void writeLoginFailedAudit({
            email: parsed.data.email.toLowerCase(),
            reason: 'invalid_password',
            actorId: user.id,
            organizationId: user.memberships[0]?.organizationId ?? null,
            source: 'web',
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          });
          return null;
        }

        if (user.twoFactorEnabledAt) {
          const totp = parsed.data.totp?.trim();
          let totpValid = false;

          if (totp && user.totpSecret && verifyTotpToken(totp, user.totpSecret)) {
            totpValid = true;
          } else if (totp) {
            const backupCodes = await prisma.twoFactorBackupCode.findMany({
              where: { userId: user.id, usedAt: null },
              select: { id: true, codeHash: true },
            });
            const matchedId = await matchBackupCode(totp, backupCodes);
            if (matchedId) {
              await prisma.twoFactorBackupCode.update({
                where: { id: matchedId },
                data: { usedAt: new Date() },
              });
              totpValid = true;
            }
          }

          if (!totpValid) {
            void writeLoginFailedAudit({
              email: parsed.data.email.toLowerCase(),
              reason: 'invalid_totp',
              actorId: user.id,
              organizationId: user.memberships[0]?.organizationId ?? null,
              source: 'web',
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
            });
            return null;
          }
        }

        const membership = user.memberships[0] ?? null;
        const gymMember =
          user.gymMemberProfile?.status === 'ACTIVE' ? user.gymMemberProfile : null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        void writeAuditLog({
          actorId: user.id,
          organizationId: membership?.organizationId ?? gymMember?.organizationId ?? null,
          action: 'USER_LOGIN',
          entityType: 'user',
          entityId: user.id,
          metadata: { source: 'web' },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });

        if (!user.isSuperAdmin && membership?.organization) {
          const { syncSubscriptionLifecycle, resolveSubscriptionAccess } = await import(
            '@/lib/billing/subscription-gate'
          );
          await syncSubscriptionLifecycle(membership.organization.id);
          const access = await resolveSubscriptionAccess(membership.organization.id);

          // cloud.cicibyte.com hata verse bile geçerli SaaS aboneliği varsa oturumu kilitleme.
          if (access.mode !== 'full') {
            void syncOrganizationToCloud(membership.organization.id);
          }
        }

        const activePartnerProfile =
          user.isPartner && user.partnerProfile?.isActive ? user.partnerProfile : null;

        // Faz 36.6 — aynı kişi birden fazla salonda personel olabilir; tüm aktif
        // üyelikler token'a taşınır ki dashboard'daki organizasyon switcher'ı
        // sayfa yenilemeden şubeler arasında geçiş yapabilsin.
        const availableMemberships = user.memberships.map((m) => ({
          organizationId: m.organizationId,
          organizationName: m.organization.name,
          role: m.role,
        }));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          isDemo: user.isDemo,
          isPartner: Boolean(activePartnerProfile),
          partnerId: activePartnerProfile?.id ?? null,
          isHierarchyMember: user.hierarchyMemberships.length > 0,
          organizationId: membership?.organizationId ?? gymMember?.organizationId ?? null,
          organizationName:
            membership?.organization.name ?? gymMember?.organization.name ?? null,
          role: membership?.role ?? null,
          locale: user.locale,
          gymMemberId: gymMember?.id ?? null,
          twoFactorEnabled: Boolean(user.twoFactorEnabledAt),
          availableMemberships,
        };
      },
    }),
  ],
});

/**
 * `baseAuth()` yalnızca giriş anındaki JWT'yi çözer — bir personel sonradan
 * çıkarılsa/devre dışı bırakılsa bile mevcut oturum kendiliğinden geçersiz olmaz.
 * Bu sarmalayıcı, her `auth()` çağrısında (yalnızca Node.js çalışma zamanında —
 * middleware.ts kendi hafif Edge NextAuth örneğini kullanır, bunu değil)
 * Redis'teki "devre dışı bırakıldı" işaretini kontrol eder (bkz. roadmap.md Faz 36.4).
 */
export async function auth() {
  const session = await baseAuth();

  if (session?.user && !session.user.isSuperAdmin && session.user.organizationId) {
    const deactivated = await isStaffDeactivatedCache(session.user.organizationId, session.user.id);
    if (deactivated) {
      return null;
    }
  }

  return session;
}
