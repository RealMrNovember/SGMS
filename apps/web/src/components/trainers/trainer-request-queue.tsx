'use client';

import { reviewTrainerRequest, type TrainerRequestActionState } from '@/actions/trainer-requests';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

export type TrainerRequestQueueItem = {
  id: string;
  requestType: string;
  status: string;
  reason: string | null;
  createdAt: string;
  memberName: string;
  currentTrainerName: string | null;
  preferredTrainerName: string | null;
  preferredTrainerId: string | null;
};

type TrainerOption = {
  id: string;
  name: string;
};

export function TrainerRequestQueue({
  requests,
  trainerOptions,
}: {
  requests: TrainerRequestQueueItem[];
  trainerOptions: TrainerOption[];
}) {
  const t = useTranslations('faz42.queue');
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TrainerRequestActionState>({});
  const [selectedTrainer, setSelectedTrainer] = useState<Record<string, string>>({});

  function handleReview(requestId: string, decision: 'APPROVE' | 'REJECT', requestType: string) {
    startTransition(async () => {
      const resultingTrainerId =
        decision === 'APPROVE' && requestType !== 'REMOVE' ? selectedTrainer[requestId] : undefined;
      const result = await reviewTrainerRequest({ requestId, decision, resultingTrainerId });
      setState(result);
    });
  }

  if (requests.length === 0) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">{t('empty')}</p>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-1 text-xs">{t('hint')}</p>
      </div>
      {state.error ? <p className="px-6 pt-4 text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="px-6 pt-4 text-sm text-emerald-300">{state.success}</p> : null}
      <ul className="divide-y divide-[var(--border)]">
        {requests.map((req) => (
          <li key={req.id} className="space-y-3 px-6 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{req.memberName}</p>
                <p className="muted text-sm">
                  {t(`types.${req.requestType}`)} · {new Date(req.createdAt).toLocaleString()}
                </p>
                <p className="muted mt-1 text-xs">
                  {t('currentTrainer')}: {req.currentTrainerName ?? t('none')}
                </p>
                {req.preferredTrainerName ? (
                  <p className="muted text-xs">
                    {t('preferred')}: {req.preferredTrainerName}
                  </p>
                ) : (
                  <p className="muted text-xs">{t('noPreference')}</p>
                )}
                {req.reason ? (
                  <p className="mt-2 rounded-md border border-[var(--border)] bg-white/5 px-3 py-2 text-sm">
                    <span className="muted text-xs">{t('reason')}: </span>
                    {req.reason}
                  </p>
                ) : null}
              </div>
              <span className="badge shrink-0 text-[10px]">{t(`status.${req.status}`)}</span>
            </div>

            {req.requestType !== 'REMOVE' ? (
              <div className="space-y-1">
                <label className="muted text-xs">{t('assignTrainer')}</label>
                <select
                  className="input"
                  value={selectedTrainer[req.id] ?? req.preferredTrainerId ?? ''}
                  onChange={(e) =>
                    setSelectedTrainer((prev) => ({ ...prev, [req.id]: e.target.value }))
                  }
                >
                  <option value="" disabled>
                    {t('selectTrainer')}
                  </option>
                  {trainerOptions.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                className="button py-2 text-sm"
                disabled={pending}
                onClick={() => handleReview(req.id, 'APPROVE', req.requestType)}
              >
                {t('approve')}
              </button>
              <button
                type="button"
                className="button py-2 text-sm opacity-70"
                disabled={pending}
                onClick={() => handleReview(req.id, 'REJECT', req.requestType)}
              >
                {t('reject')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
