'use client';

import { rsvpToGymEvent, type GymEventActionState } from '@/actions/gym-events';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

type EventListItem = {
  id: string;
  title: string;
  description: string | null;
  eventType: 'WALK' | 'RUN' | 'SPORT' | 'OTHER';
  startsAt: string;
  location: string | null;
  goingCount: number;
  myStatus: 'GOING' | 'CANCELLED' | null;
};

export function AthleteEventList({ events }: { events: EventListItem[] }) {
  const t = useTranslations('athlete.events');
  const tEvents = useTranslations('events');
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [state, setState] = useState<GymEventActionState>({});

  function handleRsvp(eventId: string, going: boolean) {
    setBusyId(eventId);
    startTransition(async () => {
      const result = await rsvpToGymEvent(eventId, going);
      setState(result);
      setBusyId(null);
    });
  }

  if (events.length === 0) {
    return <p className="muted text-sm">{t('noEvents')}</p>;
  }

  return (
    <div className="space-y-3">
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}

      {events.map((event) => {
        const going = event.myStatus === 'GOING';
        return (
          <div key={event.id} className="card space-y-2 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{event.title}</p>
              <span className="badge text-[10px]">{tEvents(`eventTypes.${event.eventType}`)}</span>
            </div>
            <p className="muted text-sm">
              {new Date(event.startsAt).toLocaleString()}
              {event.location ? ` · ${event.location}` : ''}
            </p>
            {event.description ? <p className="muted text-xs">{event.description}</p> : null}
            <p className="muted text-xs">{t('goingCount', { count: event.goingCount })}</p>

            {going ? (
              <button
                type="button"
                className="button px-3 py-1.5 text-xs opacity-80"
                disabled={pending && busyId === event.id}
                onClick={() => handleRsvp(event.id, false)}
              >
                {t('cancelRsvp')}
              </button>
            ) : (
              <button
                type="button"
                className="button button-gold px-3 py-1.5 text-xs"
                disabled={pending && busyId === event.id}
                onClick={() => handleRsvp(event.id, true)}
              >
                {t('going')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
