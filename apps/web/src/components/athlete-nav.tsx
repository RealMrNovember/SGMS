'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const NAV_ITEMS = [
  { href: '/athlete', exact: true, key: 'home' as const },
  { href: '/athlete/measurements', exact: false, key: 'measurements' as const },
  { href: '/athlete/programs', exact: false, key: 'programs' as const },
  { href: '/athlete/messages', exact: false, key: 'messages' as const },
  { href: '/athlete/account', exact: false, key: 'account' as const },
];

type AthleteNavProps = {
  unreadMessages?: number;
};

export function AthleteNav({ unreadMessages = 0 }: AthleteNavProps) {
  const pathname = usePathname();
  const t = useTranslations('athlete.nav');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[rgba(17,24,39,0.95)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-lg px-2 py-2 text-center text-xs font-medium transition ${
                active ? 'bg-white/10 text-white' : 'muted hover:text-white'
              }`}
            >
              {t(item.key)}
              {item.key === 'messages' && unreadMessages > 0 ? (
                <span className="absolute right-1 top-0.5 flex min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
