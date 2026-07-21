'use client';

import { cancelGymEvent, createGymEvent, type GymEventActionState } from '@/actions/gym-events';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';

const EVENT_TYPES = ['WALK', 'RUN', 'SPORT', 'OTHER'] as const;

type GymEventListItem = {
  id: string;
  title: string;
  description: string | null;
  eventType: (typeof EVENT_TYPES)[number];
  startsAt: string;
  location: string | null;
  goingCount: number;
};

const initialState: GymEventActionState = {};

export function GymEventPanel({
  events,
  canManage,
  canDelete,
}: {
  events: GymEventListItem[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('events');
  const [createState, createAction, createPending] = useActionState(createGymEvent, initialState);
  const [deletePending, startDelete] = useTransition();
  const [deleteState, setDeleteState] = useState<GymEventActionState>({});

  function handleDelete(eventId: string) {
    startDelete(async () => {
      const result = await cancelGymEvent(eventId);
      setDeleteState(result);
    });
  }

  return (
    <div className="space-y-8">
      {canManage ? (
        <form action={createAction} className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold">{t('createTitle')}</h3>

          {createState.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {createState.error}
            </p>
          ) : null}
          {createState.success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {createState.success}
            </p>
          ) : null}

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="event-title">
              {t('fields.title')}
            </label>
            <input id="event-title" name="title" className="input w-full" required minLength={3} maxLength={120} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="event-type">
                {t('fields.eventType')}
              </label>
              <select id="event-type" name="eventType" className="input w-full" defaultValue="WALK">
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`eventTypes.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="event-starts-at">
                {t('fields.startsAt')}
              </label>
              <input id="event-starts-at" name="startsAt" type="datetime-local" className="input w-full" required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="event-location">
              {t('fields.location')}
            </label>
            <input id="event-location" name="location" className="input w-full" maxLength={200} />
          </div>

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="event-description">
              {t('fields.description')}
            </label>
            <textarea id="event-description" name="description" className="input min-h-[80px] w-full" maxLength={1000} />
          </div>

          <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={createPending}>
            {createPending ? t('submitting') : t('submit')}
          </button>
        </form>
      ) : null}

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('listTitle')}</h3>
        </div>

        {deleteState.error ? (
          <p className="px-6 pt-4 text-sm text-rose-300">{deleteState.error}</p>
        ) : null}
        {deleteState.success ? (
          <p className="px-6 pt-4 text-sm text-emerald-300">{deleteState.success}</p>
        ) : null}

        <div className="divide-y divide-[var(--border)]">
          {events.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('noEvents')}</p>
          ) : (
            events.map((event) => (
              <article key={event.id} className="flex items-start justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-medium">
                    {event.title} <span className="badge ml-2 text-[10px]">{t(`eventTypes.${event.eventType}`)}</span>
                  </p>
                  <p className="muted mt-1 text-sm">
                    {new Date(event.startsAt).toLocaleString()}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                  {event.description ? <p className="muted mt-1 text-xs">{event.description}</p> : null}
                  <p className="muted mt-1 text-xs">{t('goingCount', { count: event.goingCount })}</p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    className="button px-3 py-1.5 text-xs opacity-80"
                    disabled={deletePending}
                    onClick={() => handleDelete(event.id)}
                  >
                    {t('cancelEvent')}
                  </button>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
