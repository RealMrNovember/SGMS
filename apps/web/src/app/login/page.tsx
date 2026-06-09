import { LocaleSwitcher } from '@/components/locale-switcher';
import { LoginForm } from '@/components/login-form';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  const tLogin = await getTranslations('login');
  const tCommon = await getTranslations('common');

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <p className="login-kicker">{tLogin('brandKicker')}</p>
          <LocaleSwitcher />
        </div>

        <div className="relative z-10 mt-auto pt-16">
          <h1 className="login-title">{tLogin('brandTitle')}</h1>
          <p className="muted mt-5 max-w-md text-sm leading-7">{tLogin('brandSubtitle')}</p>
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
