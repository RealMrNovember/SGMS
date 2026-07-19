'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

export function HelpSearchForm({
  initialQuery = '',
  actionPath = '/help',
}: {
  initialQuery?: string;
  actionPath?: string;
}) {
  const t = useTranslations('help');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const q = String(fd.get('q') || '').trim();
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        startTransition(() => {
          router.push(params.toString() ? `${actionPath}?${params}` : actionPath);
        });
      }}
    >
      <input
        name="q"
        defaultValue={initialQuery}
        placeholder={t('searchPlaceholder')}
        className="input min-w-[220px] flex-1"
        aria-label={t('searchPlaceholder')}
      />
      <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
        {pending ? '…' : t('search')}
      </button>
    </form>
  );
}
