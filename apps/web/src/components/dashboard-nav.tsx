'use client';

import { LocaleSwitcher } from '@/components/locale-switcher';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export type DashboardNavItem = {
  href: string;
  label: string;
  badge?: number;
};

export type DashboardComingSoonItem = {
  href: string;
  label: string;
};

type Props = {
  navItems: DashboardNavItem[];
  comingSoonItems?: DashboardComingSoonItem[];
  comingSoonGroupLabel?: string;
  logoutLabel: string;
  logoutAction: () => Promise<void>;
};

function NavBadge({ value }: { value?: number }) {
  if (!value || value <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
      {value > 99 ? '99+' : value}
    </span>
  );
}

export function DashboardNav({
  navItems,
  comingSoonItems = [],
  comingSoonGroupLabel,
  logoutLabel,
  logoutAction,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Desktop: horizontal nav, hidden below md */}
      <nav className="hidden items-center gap-4 md:flex md:flex-wrap">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="muted relative text-sm hover:text-white">
            {item.label}
            <NavBadge value={item.badge} />
          </Link>
        ))}
        {comingSoonItems.length > 0 ? (
          <DesktopComingSoonMenu label={comingSoonGroupLabel ?? 'Coming Soon'} items={comingSoonItems} />
        ) : null}
        <LocaleSwitcher />
        <form action={logoutAction}>
          <button type="submit" className="button px-4 py-2 text-sm">
            {logoutLabel}
          </button>
        </form>
      </nav>

      {/* Mobile: hamburger trigger, hidden md and up */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        className="button flex h-10 w-10 items-center justify-center p-0 md:hidden"
      >
        <span className="sr-only">Menu</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 right-0 flex w-[85vw] max-w-sm flex-col gap-1 overflow-y-auto border-l border-[var(--border)] bg-[rgba(17,24,39,0.98)] px-5 py-6">
            <div className="mb-3 flex items-center justify-between">
              <LocaleSwitcher compact />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="button flex h-9 w-9 items-center justify-center p-0"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="relative rounded-lg px-3 py-3 text-sm hover:bg-white/5"
              >
                {item.label}
                <NavBadge value={item.badge} />
              </Link>
            ))}

            {comingSoonItems.length > 0 ? (
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <p className="muted px-3 pb-1 text-xs tracking-[0.14em] uppercase">{comingSoonGroupLabel}</p>
                {comingSoonItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="muted flex items-center justify-between rounded-lg px-3 py-3 text-sm hover:bg-white/5"
                  >
                    {item.label}
                    <span className="badge text-[10px]">✨</span>
                  </Link>
                ))}
              </div>
            ) : null}

            <form action={logoutAction} className="mt-4 border-t border-[var(--border)] pt-4">
              <button type="submit" className="button w-full py-2.5 text-sm">
                {logoutLabel}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DesktopComingSoonMenu({ label, items }: { label: string; items: DashboardComingSoonItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="muted flex items-center gap-1 text-sm hover:text-white"
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="card absolute right-0 top-full z-40 mt-2 w-64 p-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="muted flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/5 hover:text-white"
            >
              {item.label}
              <span className="badge text-[10px]">✨</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
