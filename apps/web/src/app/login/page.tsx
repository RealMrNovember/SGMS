import { LocaleSwitcher } from '@/components/locale-switcher';
import { SgmsLogo } from '@/components/brand/sgms-logo';
import { LoginForm } from '@/components/login-form';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  const tLogin = await getTranslations('login');
  const tCommon = await getTranslations('common');

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <SgmsLogo size="sm" href={null} showWordmark />
          </Link>
          <LocaleSwitcher />
        </div>

        <div className="relative z-10 mt-auto pt-16">
          <h1 className="login-title">{tLogin('brandTitle')}</h1>
          <p className="muted mt-5 max-w-md text-sm leading-7">{tLogin('brandSubtitle')}</p>
          <Link href="/" className="muted mt-6 inline-block text-sm hover:text-white">
            ← {tLogin('backToSite')}
          </Link>
        </div>

        <p className="relative z-10 mt-10 text-xs tracking-[0.2em] text-[rgba(201,169,98,0.55)] uppercase">
          {tCommon('appName')}
        </p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="badge">{t('badgeAdmin')}</span>
          <h2 className="mt-5 text-2xl font-medium tracking-tight">{t('loginTitle')}</h2>
          <p className="muted mt-2 mb-6 text-sm leading-6">{t('loginSubtitle')}</p>

          <Suspense fallback={<div className="muted text-sm">{tCommon('loading')}</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
