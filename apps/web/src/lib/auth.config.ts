import type { OrganizationRole } from '@sgms/database';
import type { NextAuthConfig } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isSuperAdmin: boolean;
      organizationId: string | null;
      organizationName: string | null;
      role: OrganizationRole | null;
      locale: string;
      gymMemberId: string | null;
    };
  }

  interface User {
    isSuperAdmin?: boolean;
    organizationId?: string | null;
    organizationName?: string | null;
    role?: OrganizationRole | null;
    locale?: string;
    gymMemberId?: string | null;
  }
}

export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
        token.organizationId = user.organizationId ?? null;
        token.organizationName = user.organizationName ?? null;
        token.role = user.role ?? null;
        token.locale = user.locale ?? 'tr';
        token.gymMemberId = user.gymMemberId ?? null;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        session.user.organizationId = (token.organizationId as string | null | undefined) ?? null;
        session.user.organizationName = (token.organizationName as string | null | undefined) ?? null;
        session.user.role = (token.role as OrganizationRole | null | undefined) ?? null;
        session.user.locale = (token.locale as string | undefined) ?? 'tr';
        session.user.gymMemberId = (token.gymMemberId as string | null | undefined) ?? null;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
