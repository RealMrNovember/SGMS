'use client';

import { approvePendingMember, rejectPendingMember } from '@/actions/members';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

type PendingSignup = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

/**
 * Mobil self-servis kayıttan (`/api/v1/auth/signup`) gelen, salon slug'ı
 * dışında hiçbir doğrulaması olmayan hesapları — onaylanana/reddedilene kadar
 * giriş yapamazlar — burada gösterir. `PendingStoreDeliveries` ile aynı desen.
 */
export function PendingMemberApprovals({ items }: { items: PendingSignup[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="card space-y-4 border-amber-500/30 p-6">
      <div>
        <h3 className="text-lg font-semibold">Bekleyen Kayıt Onayları</h3>
        <p className="muted mt-1 text-sm">
          Mobil uygulamadan kendi kendine kayıt olmuş, henüz onaylanmamış hesaplar. Onaylanmadan giriş
          yapamazlar.
        </p>
      </div>

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">
                {item.firstName} {item.lastName}
              </p>
              <p className="muted text-xs">
                {item.email ?? '—'} {item.phone ? `· ${item.phone}` : ''} ·{' '}
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                className="button button-gold px-3 py-1.5 text-xs"
                onClick={() => {
                  startTransition(async () => {
                    await approvePendingMember(item.id);
                    router.refresh();
                  });
                }}
              >
                Onayla
              </button>
              <button
                type="button"
                disabled={pending}
                className="button px-3 py-1.5 text-xs"
                onClick={() => {
                  startTransition(async () => {
                    await rejectPendingMember(item.id);
                    router.refresh();
                  });
                }}
              >
                Reddet
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
