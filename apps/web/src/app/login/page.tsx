import { LocaleSwitcher } from '@/components/locale-switcher';
import { LoginForm } from '@/components/login-form';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  const tCommon = await getTranslations('common');

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <span className="badge">{t('badgeAdmin')}</span>
          <LocaleSwitcher />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">{t('loginTitle')}</h1>
        <p className="muted mt-2 mb-6 text-sm leading-6">{t('loginSubtitle')}</p>

        <Suspense fallback={<div className="muted text-sm">{tCommon('loading')}</div>}>
          <LoginForm />
        </Suspense>

        <p className="muted mt-6 text-xs leading-5">
          Super Admin: <strong>admin@demo.sgms.local</strong> / <strong>Admin123!</strong> → /admin
          <br />
          Gym Sahibi: <strong>owner@demo-gym.local</strong> / <strong>Owner123!</strong> → /dashboard
        </p>
      </div>
    </main>
  );
}
