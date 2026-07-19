'use client';

import {
  createDisciplinaryRecord,
  createPerformanceReview,
  exportStaffCompensationCsv,
  updateStaffCompensation,
  type HrActionState,
} from '@/actions/hr';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';

const initial: HrActionState = {};

const SEVERITIES = ['WARNING', 'REPRIMAND', 'SUSPENSION'] as const;

export function PerformanceReviewForm({ staff }: { staff: { id: string; label: string }[] }) {
  const t = useTranslations('faz22.performance');
  const [state, action, pending] = useActionState(createPerformanceReview, initial);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('createTitle')}</h3>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">{t('subject')}</label>
          <select name="subjectUserId" className="input" required defaultValue="">
            <option value="" disabled>
              {t('selectStaff')}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('periodLabel')}</label>
          <input name="periodLabel" className="input" placeholder="2026 Q1" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('score')}</label>
          <input name="score" type="number" className="input" min={1} max={5} defaultValue={3} required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('notes')}</label>
          <textarea name="notes" className="input min-h-[80px]" required />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('submit')}
        </button>
      </form>
    </section>
  );
}

export function DisciplinaryRecordForm({ staff }: { staff: { id: string; label: string }[] }) {
  const t = useTranslations('faz22.disciplinary');
  const [state, action, pending] = useActionState(createDisciplinaryRecord, initial);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('createTitle')}</h3>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">{t('subject')}</label>
          <select name="subjectUserId" className="input" required defaultValue="">
            <option value="" disabled>
              {t('selectStaff')}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('severity')}</label>
          <select name="severity" className="input" defaultValue="WARNING">
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`severities.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('title')}</label>
          <input name="title" className="input" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('occurredAt')}</label>
          <input name="occurredAt" type="datetime-local" className="input" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('description')}</label>
          <textarea name="description" className="input min-h-[80px]" required />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('submit')}
        </button>
      </form>
    </section>
  );
}

type CompensationMember = {
  id: string;
  userId: string;
  label: string;
  role: string;
  baseSalary: string;
  bonusSummary: string;
};

export function CompensationSection({ members }: { members: CompensationMember[] }) {
  const t = useTranslations('faz22.compensation');
  const [exportError, setExportError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleExport() {
    setExportError(null);
    startTransition(async () => {
      const result = await exportStaffCompensationCsv();
      if (!result.success) {
        setExportError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <section className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <button type="button" className="button py-1.5 text-sm" disabled={pending} onClick={handleExport}>
          {t('exportCsv')}
        </button>
      </div>
      <p className="muted text-sm">{t('hint')}</p>
      {exportError ? <p className="text-sm text-rose-300">{exportError}</p> : null}
      <div className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
        {members.map((member) => (
          <CompensationRow key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}

function CompensationRow({ member }: { member: CompensationMember }) {
  const t = useTranslations('faz22.compensation');
  const [state, action, pending] = useActionState(updateStaffCompensation, initial);

  return (
    <form action={action} className="grid gap-3 p-4 md:grid-cols-4">
      <input type="hidden" name="organizationMemberId" value={member.id} />
      <div className="md:col-span-4">
        <p className="font-medium">{member.label}</p>
        <p className="muted text-xs">
          {member.role}
        </p>
      </div>
      {state.error ? <p className="text-sm text-rose-300 md:col-span-4">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300 md:col-span-4">{state.success}</p> : null}
      <div className="space-y-1">
        <label className="muted text-xs">{t('baseSalary')}</label>
        <input
          name="baseSalary"
          className="input py-1.5 text-sm"
          defaultValue={member.baseSalary}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="muted text-xs">{t('bonusSummary')}</label>
        <input name="bonusSummary" className="input py-1.5 text-sm" defaultValue={member.bonusSummary} />
      </div>
      <div className="flex items-end">
        <button type="submit" className="button w-full py-1.5 text-sm" disabled={pending}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}
