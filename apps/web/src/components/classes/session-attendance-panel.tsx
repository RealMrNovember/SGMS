'use client';

import { markAttendance } from '@/actions/classes';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

export function SessionAttendancePanel({
  bookings,
}: {
  bookings: {
    id: string;
    status: string;
    memberName: string;
    waitlistPos: number | null;
  }[];
}) {
  const t = useTranslations('faz17.classes');
  const [pending, startTransition] = useTransition();

  return (
    <ul className="divide-y divide-[var(--border)]">
      {bookings.map((booking) => (
        <li key={booking.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{booking.memberName}</p>
            <p className="muted text-sm">
              <span className="badge text-[10px]">{booking.status}</span>
              {booking.waitlistPos ? ` · ${t('waitlist')} #${booking.waitlistPos}` : ''}
            </p>
          </div>
          {booking.status === 'BOOKED' || booking.status === 'ATTENDED' || booking.status === 'NO_SHOW' ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="button py-1 text-xs"
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void markAttendance(booking.id, 'ATTENDED');
                  })
                }
              >
                {t('attended')}
              </button>
              <button
                type="button"
                className="button py-1 text-xs opacity-70"
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void markAttendance(booking.id, 'NO_SHOW');
                  })
                }
              >
                {t('noShow')}
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
