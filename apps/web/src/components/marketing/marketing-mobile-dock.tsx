'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const DOCK_ITEMS = [
  { href: '/#features', labelKey: 'features', icon: '◆' },
  { href: '/#how-it-works', labelKey: 'howItWorks', icon: '◇' },
  { href: '/trial', labelKey: 'trialShort', icon: '★' },
  { href: '/login', labelKey: 'loginShort', icon: '→' },
] as const;

export function MarketingMobileDock() {
  const t = useTranslations('marketing.nav');

  return (
    <nav className="marketing-mobile-dock" aria-label="Mobile navigation">
      <div className="marketing-mobile-dock-inner">
        {DOCK_ITEMS.map((item) => {
          const label = t(item.labelKey);
          const className = 'marketing-mobile-dock-item';
          const isRoute = item.href.startsWith('/') && !item.href.includes('#');

          if (isRoute) {
            return (
              <Link key={item.href} href={item.href} className={className}>
                <span aria-hidden>{item.icon}</span>
                <span>{label}</span>
              </Link>
            );
          }

          return (
            <a key={item.href} href={item.href} className={className}>
              <span aria-hidden>{item.icon}</span>
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
