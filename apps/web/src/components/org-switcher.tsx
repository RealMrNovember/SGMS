'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type MembershipOption = { organizationId: string; organizationName: string; role: string };

/**
 * Aynı kişi birden fazla salonda personel olabiliyor (Faz 36.6) — bu bileşen tek
 * bir üyelik varsa sade metin, birden fazlaysa tek tıkla geçiş yapılabilen bir
 * "workspace switcher" dropdown'ı gösterir. Geçiş, sayfa yenilenmeden
 * `useSession().update()` ile JWT'yi günceller, ardından sunucu verisini
 * tazelemek için `router.refresh()` çağrılır.
 */
export function OrgSwitcher({ className }: { className?: string }) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const memberships = (session?.user?.availableMemberships ?? []) as MembershipOption[];
  const currentName = session?.user?.organizationName ?? '—';

  if (memberships.length <= 1) {
    return <span className={className}>{currentName}</span>;
  }

  function switchTo(organizationId: string) {
    setOpen(false);
    startTransition(async () => {
      await update({ organizationId });
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`${className ?? ''} inline-flex items-center gap-1`}
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
      >
        <span className="truncate">{pending ? '…' : currentName}</span>
        <span aria-hidden="true" className="muted text-xs">▾</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--card,#111827)] p-1 shadow-lg">
          {memberships.map((m) => (
            <button
              key={m.organizationId}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-white/5"
              onClick={() => switchTo(m.organizationId)}
              disabled={pending}
            >
              <span className="truncate">{m.organizationName}</span>
              <span className="muted text-[10px]">{m.role}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
