'use client';

import {
  completeLeadFollowUp,
  convertLeadToMember,
  scheduleLeadFollowUp,
  updateLeadStatus,
  type LeadActionState,
} from '@/actions/leads';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

type FollowUp = {
  id: string;
  scheduledAt: string;
  method: string;
  notes: string | null;
  completedAt: string | null;
};

export type LeadItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  interestedPlan: string | null;
  notes: string | null;
  status: string;
  assignedToName: string | null;
  convertedMemberId: string | null;
  createdAt: string;
  followUps: FollowUp[];
};

const COLUMNS = ['NEW', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'CLOSED'] as const;
type Column = (typeof COLUMNS)[number];

function columnForStatus(status: string): Column {
  if (status === 'CONVERTED' || status === 'LOST') return 'CLOSED';
  if (status === 'FOLLOW_UP_SCHEDULED') return 'FOLLOW_UP_SCHEDULED';
  if (status === 'CONTACTED') return 'CONTACTED';
  return 'NEW';
}

export function LeadsBoard({ leads }: { leads: LeadItem[] }) {
  const t = useTranslations('leads');

  const grouped: Record<Column, LeadItem[]> = {
    NEW: [],
    CONTACTED: [],
    FOLLOW_UP_SCHEDULED: [],
    CLOSED: [],
  };
  for (const lead of leads) {
    grouped[columnForStatus(lead.status)].push(lead);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {COLUMNS.map((column) => (
        <div key={column} className="space-y-3">
          <h4 className="muted text-sm font-semibold uppercase tracking-wide">
            {t(`columns.${column}`)} · {grouped[column].length}
          </h4>
          <div className="space-y-3">
            {grouped[column].length === 0 ? (
              <p className="muted rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs">
                {t('empty')}
              </p>
            ) : (
              grouped[column].map((lead) => <LeadCard key={lead.id} lead={lead} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadItem }) {
  const t = useTranslations('leads');
  const [pending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<LeadActionState>({});
  const [showSchedule, setShowSchedule] = useState(false);

  const nextFollowUp = lead.followUps.find((followUp) => !followUp.completedAt);
  const isOverdue = nextFollowUp ? new Date(nextFollowUp.scheduledAt).getTime() < Date.now() : false;
  const isClosed = lead.status === 'CONVERTED' || lead.status === 'LOST';

  function runStatusChange(status: 'CONTACTED' | 'LOST') {
    startTransition(async () => {
      setActionState(await updateLeadStatus(lead.id, status));
    });
  }

  function runConvert() {
    startTransition(async () => {
      setActionState(await convertLeadToMember(lead.id));
    });
  }

  function runCompleteFollowUp(followUpId: string) {
    startTransition(async () => {
      setActionState(await completeLeadFollowUp(followUpId));
    });
  }

  return (
    <article className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{lead.name}</p>
          <p className="muted text-xs">{t(`sources.${lead.source}`)}</p>
        </div>
        {lead.status === 'CONVERTED' ? (
          <span className="badge bg-emerald-500/10 text-emerald-300">{t('convertedBadge')}</span>
        ) : null}
        {lead.status === 'LOST' ? (
          <span className="badge bg-rose-500/10 text-rose-300">{t('lostBadge')}</span>
        ) : null}
      </div>

      {lead.phone ? <p className="muted text-xs">{lead.phone}</p> : null}
      {lead.email ? <p className="muted text-xs">{lead.email}</p> : null}
      {lead.interestedPlan ? <p className="text-xs">{lead.interestedPlan}</p> : null}
      {lead.notes ? <p className="muted text-xs italic">{lead.notes}</p> : null}
      {lead.assignedToName ? <p className="muted text-xs">{lead.assignedToName}</p> : null}

      {nextFollowUp ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            isOverdue ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-[var(--border)]'
          }`}
        >
          <p>
            {t(`methods.${nextFollowUp.method}`)} · {new Date(nextFollowUp.scheduledAt).toLocaleString('tr-TR')}
            {isOverdue ? ` · ${t('overdue')}` : ''}
          </p>
          {nextFollowUp.notes ? <p className="muted mt-1">{nextFollowUp.notes}</p> : null}
          <button
            type="button"
            className="mt-1 font-medium text-emerald-400 hover:text-emerald-300"
            onClick={() => runCompleteFollowUp(nextFollowUp.id)}
            disabled={pending}
          >
            {t('completeFollowUp')}
          </button>
        </div>
      ) : null}

      {actionState.error ? <p className="text-xs text-rose-400">{actionState.error}</p> : null}

      {!isClosed ? (
        <div className="flex flex-wrap gap-3 text-xs">
          {lead.status === 'NEW' ? (
            <button
              type="button"
              className="text-sky-400 hover:text-sky-300"
              onClick={() => runStatusChange('CONTACTED')}
              disabled={pending}
            >
              {t('markContacted')}
            </button>
          ) : null}

          <button
            type="button"
            className="text-sky-400 hover:text-sky-300"
            onClick={() => setShowSchedule((value) => !value)}
            disabled={pending}
          >
            {t('scheduleFollowUp')}
          </button>

          <button
            type="button"
            className="font-medium text-emerald-400 hover:text-emerald-300"
            onClick={runConvert}
            disabled={pending}
          >
            {pending ? t('converting') : t('convert')}
          </button>

          <button
            type="button"
            className="text-rose-400 hover:text-rose-300"
            onClick={() => runStatusChange('LOST')}
            disabled={pending}
          >
            {t('markLost')}
          </button>
        </div>
      ) : null}

      {showSchedule ? <ScheduleFollowUpForm leadId={lead.id} onDone={() => setShowSchedule(false)} /> : null}
    </article>
  );
}

function ScheduleFollowUpForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const t = useTranslations('leads');
  const [state, setState] = useState<LeadActionState>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await scheduleLeadFollowUp({}, formData);
          setState(result);
          if (result.success) {
            onDone();
          }
        });
      }}
      className="space-y-2 rounded-lg border border-[var(--border)] p-3"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input type="datetime-local" name="scheduledAt" className="input" required />
        <select name="method" className="input" defaultValue="CALL">
          <option value="CALL">{t('methods.CALL')}</option>
          <option value="MESSAGE">{t('methods.MESSAGE')}</option>
          <option value="EMAIL">{t('methods.EMAIL')}</option>
        </select>
      </div>
      <textarea name="notes" rows={2} className="input" placeholder={t('followUpNotes')} />
      {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="button px-4 py-1.5 text-xs" disabled={pending}>
          {pending ? t('scheduling') : t('scheduleSubmit')}
        </button>
        <button type="button" className="muted text-xs hover:text-white" onClick={onDone} disabled={pending}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
