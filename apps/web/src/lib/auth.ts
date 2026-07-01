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
import { syncLicenseOnLogin } from '@/lib/license';
import { prisma } from '@/lib/prisma';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
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
              take: 1,
            },
            gymMemberProfile: {
              select: {
                id: true,
                organizationId: true,
                status: true,
                organization: { select: { name: true } },
              },
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
          const { syncSubscriptionLifecycle } = await import('@/lib/billing/subscription-gate');
          await syncSubscriptionLifecycle(membership.organization.id);
          void syncLicenseOnLogin(
            membership.organization.id,
            membership.organization.installationId,
            {
              clientName: membership.organization.name,
              email: user.email,
              deviceName: 'SGMS Web Login',
              platform: 'web',
            },
          );
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          organizationId: membership?.organizationId ?? gymMember?.organizationId ?? null,
          organizationName:
            membership?.organization.name ?? gymMember?.organization.name ?? null,
          role: membership?.role ?? null,
          locale: user.locale,
          gymMemberId: gymMember?.id ?? null,
        };
      },
    }),
  ],
});
