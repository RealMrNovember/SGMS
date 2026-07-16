'use client';

import { Activity, ClipboardList, Home, MessageSquare, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const NAV_ITEMS = [
  { href: '/athlete', exact: true, key: 'home' as const, icon: Home },
  { href: '/athlete/measurements', exact: false, key: 'measurements' as const, icon: Activity },
  { href: '/athlete/programs', exact: false, key: 'programs' as const, icon: ClipboardList },
  { href: '/athlete/messages', exact: false, key: 'messages' as const, icon: MessageSquare },
  { href: '/athlete/account', exact: false, key: 'account' as const, icon: User },
];

type AthleteNavProps = {
  unreadMessages?: number;
};

export function AthleteNav({ unreadMessages = 0 }: AthleteNavProps) {
  const pathname = usePathname();
  const t = useTranslations('athlete.nav');

  return (
    <nav className="athlete-bottom-nav">
      <div className="app-bottom-nav-grid mx-auto max-w-lg">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="app-bottom-nav-link relative" data-active={active ? 'true' : 'false'}>
              <Icon />
              <span>{t(item.key)}</span>
              {item.key === 'messages' && unreadMessages > 0 ? (
                <span className="absolute right-2 top-0.5 flex min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
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
