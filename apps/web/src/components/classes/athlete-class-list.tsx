'use client';

import { bookClassSession, cancelClassBooking } from '@/actions/classes';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

export function AthleteClassBookingList({
  sessions,
  bookingsBySession,
}: {
  sessions: {
    id: string;
    startsAt: string;
    className: string;
    roomName: string | null;
    bookedCount: number;
    capacity: number;
  }[];
  bookingsBySession: Record<string, { id: string; status: string } | undefined>;
}) {
  const t = useTranslations('faz17.classes');
  const [pending, startTransition] = useTransition();

  return (
    <div className="divide-y divide-[var(--border)]">
      {sessions.length === 0 ? (
        <p className="muted px-5 py-6 text-center text-sm">{t('noUpcoming')}</p>
      ) : (
        sessions.map((session) => {
          const booking = bookingsBySession[session.id];
          const full = session.bookedCount >= session.capacity;
          return (
            <article key={session.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{session.className}</p>
                <p className="muted text-sm">
                  {new Date(session.startsAt).toLocaleString()} · {session.roomName ?? '—'} ·{' '}
                  {session.bookedCount}/{session.capacity}
                </p>
                {booking ? <span className="badge mt-1 inline-flex text-[10px]">{booking.status}</span> : null}
              </div>
              <div>
                {booking && booking.status !== 'CANCELLED' ? (
                  <button
                    type="button"
                    className="button py-2 text-sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void cancelClassBooking(booking.id);
                      })
                    }
                  >
                    {t('cancelBooking')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button py-2 text-sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void bookClassSession(session.id);
                      })
                    }
                  >
                    {full ? t('joinWaitlist') : t('book')}
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
