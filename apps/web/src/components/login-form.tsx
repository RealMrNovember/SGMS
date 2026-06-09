'use client';

import { DEMO_ACCOUNTS, type DemoAccountKey } from '@/lib/demo-accounts';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

const DEMO_LABEL_KEYS: Record<DemoAccountKey, 'demoAdmin' | 'demoOwner' | 'demoStaff' | 'demoAthlete'> = {
  admin: 'demoAdmin',
  owner: 'demoOwner',
  staff: 'demoStaff',
  athlete: 'demoAthlete',
};

export function LoginForm() {
  const t = useTranslations('auth');
  const tLogin = useTranslations('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeDemo, setActiveDemo] = useState<DemoAccountKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function applyDemo(key: DemoAccountKey) {
    const account = DEMO_ACCOUNTS.find((item) => item.key === key);
    if (!account) {
      return;
    }

    setActiveDemo(key);
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError(t('invalidCredentials'));
      return;
    }

    router.push(result?.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="login-divider">{tLogin('demoSection')}</p>
        <div className="login-demo-grid">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.key}
              type="button"
              className="login-demo-btn"
              data-active={activeDemo === account.key}
              onClick={() => applyDemo(account.key)}
            >
              {tLogin(DEMO_LABEL_KEYS[account.key])}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="muted text-sm">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(event) => {
              setActiveDemo(null);
              setEmail(event.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="muted text-sm">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(event) => {
              setActiveDemo(null);
              setPassword(event.target.value);
            }}
          />
        </div>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <button type="submit" className="button button-gold w-full" disabled={loading}>
          {loading ? t('loggingIn') : t('login')}
        </button>
      </form>
    </div>
  );
}
