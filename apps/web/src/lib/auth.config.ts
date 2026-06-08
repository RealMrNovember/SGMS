import type { OrganizationRole } from '@sgms/database';
import type { NextAuthConfig } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      organizationId: string | null;
      organizationName: string | null;
      role: OrganizationRole | null;
    };
  }

  interface User {
    organizationId?: string | null;
    organizationName?: string | null;
    role?: OrganizationRole | null;
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
        token.organizationId = user.organizationId ?? null;
        token.organizationName = user.organizationName ?? null;
        token.role = user.role ?? null;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.organizationId = (token.organizationId as string | null | undefined) ?? null;
        session.user.organizationName = (token.organizationName as string | null | undefined) ?? null;
        session.user.role = (token.role as OrganizationRole | null | undefined) ?? null;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
