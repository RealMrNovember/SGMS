'use client';

import { HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HELP_TOPIC_BY_PATH } from '@/lib/help/types';

export function ContextualHelpButton({
  topic,
  className = '',
}: {
  /** Sabit slug; verilmezse pathname eşlemesi kullanılır */
  topic?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const t = useTranslations('help');
  const slug = topic ?? HELP_TOPIC_BY_PATH[pathname] ?? null;
  if (!slug) return null;

  return (
    <Link
      href={`/help/${slug}`}
      className={`icon-btn inline-flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-white ${className}`}
      title={t('contextualTitle')}
      aria-label={t('contextualTitle')}
    >
      <HelpCircle className="h-4 w-4" />
    </Link>
  );
}
