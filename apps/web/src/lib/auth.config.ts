import type { OrganizationRole } from '@sgms/database';
import type { NextAuthConfig } from 'next-auth';

export type MembershipOption = {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isSuperAdmin: boolean;
      isDemo: boolean;
      isPartner: boolean;
      partnerId: string | null;
      isHierarchyMember: boolean;
      organizationId: string | null;
      organizationName: string | null;
      role: OrganizationRole | null;
      locale: string;
      gymMemberId: string | null;
      twoFactorEnabled: boolean;
      needsTwoFactorSetup: boolean;
      /** Faz 36.6 — aynı kişi birden fazla salonda personel olabilir. */
      availableMemberships: MembershipOption[];
    };
  }

  interface User {
    isSuperAdmin?: boolean;
    isDemo?: boolean;
    isPartner?: boolean;
    partnerId?: string | null;
    isHierarchyMember?: boolean;
    organizationId?: string | null;
    organizationName?: string | null;
    role?: OrganizationRole | null;
    locale?: string;
    gymMemberId?: string | null;
    twoFactorEnabled?: boolean;
    availableMemberships?: MembershipOption[];
  }
}

export const authConfig = {
  trustHost: true,
  // maxAge: personel çıkarıldığında oturumun en fazla bu kadar geçerli kalması için üst
  // sınır (bkz. lib/auth.ts'teki Redis tabanlı anlık iptal ile birlikte çalışır — Faz 36.4).
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 },
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.sub = user.id;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
        token.isDemo = user.isDemo ?? false;
        token.isPartner = user.isPartner ?? false;
        token.partnerId = user.partnerId ?? null;
        token.isHierarchyMember = user.isHierarchyMember ?? false;
        token.organizationId = user.organizationId ?? null;
        token.organizationName = user.organizationName ?? null;
        token.role = user.role ?? null;
        token.locale = user.locale ?? 'tr';
        token.gymMemberId = user.gymMemberId ?? null;
        token.twoFactorEnabled = user.twoFactorEnabled ?? false;
        token.availableMemberships = user.availableMemberships ?? [];
      }

      // Faz 36.6 — organizasyon switcher `session.update({ organizationId })` çağırır;
      // yalnızca kullanıcının gerçekten üye olduğu bir org'a geçişe izin verilir (token'daki
      // availableMemberships listesi istemciden gelen değeri değil, giriş anında DB'den
      // gelen listeyi doğrular — sahte bir organizationId enjekte edilemez).
      if (trigger === 'update' && session && typeof session.organizationId === 'string') {
        const options = (token.availableMemberships as MembershipOption[] | undefined) ?? [];
        const target = options.find((m) => m.organizationId === session.organizationId);
        if (target) {
          token.organizationId = target.organizationId;
          token.organizationName = target.organizationName;
          token.role = target.role;
        }
      }

      // 2FA kurulumu/kaldırımı `verifyAndEnableTwoFactor`/`disableTwoFactor` server action'ları
      // içinde zaten TOTP koduyla doğrulanmış olarak DB'ye yazılıyor — burada yalnızca o
      // değişikliği JWT'ye yansıtıyoruz. Bu olmadan token.twoFactorEnabled bir sonraki girişe
      // kadar bayat kalır ve kullanıcı kurulumu tamamladıktan sonra bile /dashboard/account/security
      // sayfasına geri yönlendirilmeye devam eder (bkz. roadmap.md — canlıda doğrulanan hata).
      if (trigger === 'update' && session && typeof session.twoFactorEnabled === 'boolean') {
        token.twoFactorEnabled = session.twoFactorEnabled;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        session.user.isDemo = Boolean(token.isDemo);
        session.user.isPartner = Boolean(token.isPartner);
        session.user.partnerId = (token.partnerId as string | null | undefined) ?? null;
        session.user.isHierarchyMember = Boolean(token.isHierarchyMember);
        session.user.organizationId = (token.organizationId as string | null | undefined) ?? null;
        session.user.organizationName = (token.organizationName as string | null | undefined) ?? null;
        session.user.role = (token.role as OrganizationRole | null | undefined) ?? null;
        session.user.locale = (token.locale as string | undefined) ?? 'tr';
        session.user.gymMemberId = (token.gymMemberId as string | null | undefined) ?? null;
        session.user.twoFactorEnabled = Boolean(token.twoFactorEnabled);
        session.user.availableMemberships = (token.availableMemberships as MembershipOption[] | undefined) ?? [];

        const privilegedRole =
          session.user.isSuperAdmin || session.user.role === 'OWNER' || session.user.role === 'ADMIN';
        // Demo hesaplar (login sayfasındaki tek tıkla giriş) zaten hiçbir mutasyon yapamaz —
        // 2FA zorunluluğu prospektif müşterinin paneli incelemesini engellememeli.
        session.user.needsTwoFactorSetup =
          privilegedRole && !session.user.twoFactorEnabled && !session.user.isDemo;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
