import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from '@/lib/auth.config';
import { syncLicenseOnLogin } from '@/lib/license';
import { prisma } from '@/lib/prisma';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'E-posta', type: 'email' },
        password: { label: 'Parola', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
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

        if (!user || user.status !== 'ACTIVE') {
          return null;
        }

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          return null;
        }

        const membership = user.memberships[0] ?? null;
        const gymMember =
          user.gymMemberProfile?.status === 'ACTIVE' ? user.gymMemberProfile : null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            organizationId: membership?.organizationId,
            action: 'USER_LOGIN',
            entityType: 'user',
            entityId: user.id,
          },
        });

        if (!user.isSuperAdmin && membership?.organization) {
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
