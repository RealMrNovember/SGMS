'use client';

import { createEquipment, type EquipmentActionState } from '@/actions/equipment';
import QRCode from 'react-qr-code';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

export function EquipmentCreateForm() {
  const t = useTranslations('faz23');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('createTitle')}</h3>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            setError(null);
            const result: EquipmentActionState = await createEquipment({}, fd);
            if (result.error) {
              setError(result.error);
              return;
            }
            if (result.equipmentId && result.qrToken && result.publicCode) {
              const params = new URLSearchParams({
                qr: result.qrToken,
                publicCode: result.publicCode,
              });
              router.push(`/dashboard/equipment/${result.equipmentId}?${params.toString()}`);
              return;
            }
            router.refresh();
          });
        }}
      >
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('name')}</label>
          <input name="name" className="input" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('category')}</label>
          <select name="category" className="input" defaultValue="OTHER">
            <option value="CARDIO">{t('categories.CARDIO')}</option>
            <option value="STRENGTH">{t('categories.STRENGTH')}</option>
            <option value="GROUP_CLASS">{t('categories.GROUP_CLASS')}</option>
            <option value="OTHER">{t('categories.OTHER')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('serialNumber')}</label>
          <input name="serialNumber" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('location')}</label>
          <input name="location" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('purchaseDate')}</label>
          <input name="purchaseDate" type="date" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('purchasePrice')}</label>
          <input name="purchasePrice" type="number" step="0.01" min="0" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('warrantyExpiresAt')}</label>
          <input name="warrantyExpiresAt" type="date" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('photoUrl')}</label>
          <input name="photoUrl" type="url" className="input" placeholder="https://" />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('createSubmit')}
        </button>
      </form>
    </section>
  );
}

export function EquipmentQrBanner({ qrToken, publicCode }: { qrToken: string; publicCode: string }) {
  const t = useTranslations('faz23');

  return (
    <section className="card flex flex-col items-center gap-4 border-emerald-500/30 bg-emerald-500/5 p-6">
      <h3 className="text-lg font-semibold">{t('qrTitle')}</h3>
      <p className="muted text-center text-sm">{t('qrHint')}</p>
      <p className="text-sm">
        {t('publicCodeLabel')}: <span className="font-mono font-semibold">{publicCode}</span>
      </p>
      <div className="rounded-xl bg-white p-4">
        <QRCode value={qrToken} size={200} />
      </div>
    </section>
  );
}

export function EquipmentReportIssueForm({ equipmentId }: { equipmentId: string }) {
  const t = useTranslations('faz23');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('reportIssueTitle')}</h3>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set('equipmentId', equipmentId);
          startTransition(async () => {
            setError(null);
            setSuccess(null);
            const { reportIssue } = await import('@/actions/equipment');
            const result = await reportIssue({}, fd);
            if (result.error) setError(result.error);
            if (result.success) setSuccess(result.success);
          });
        }}
      >
        <div className="space-y-2">
          <label className="muted text-sm">{t('issueDescription')}</label>
          <textarea name="issueDescription" className="input min-h-24" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('photoUrl')}</label>
          <input name="photoUrl" type="url" className="input" placeholder="https://" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="setUnderMaintenance" value="true" />
          {t('setUnderMaintenance')}
        </label>
        <button type="submit" className="button" disabled={pending}>
          {t('reportIssueSubmit')}
        </button>
      </form>
    </section>
  );
}

export function EquipmentServiceLogForm({ equipmentId }: { equipmentId: string }) {
  const t = useTranslations('faz23');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('addServiceLogTitle')}</h3>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set('equipmentId', equipmentId);
          startTransition(async () => {
            setError(null);
            setSuccess(null);
            const { addServiceLog } = await import('@/actions/equipment');
            const result = await addServiceLog({}, fd);
            if (result.error) setError(result.error);
            if (result.success) setSuccess(result.success);
          });
        }}
      >
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('issueDescription')}</label>
          <textarea name="issueDescription" className="input min-h-20" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('serviceProvider')}</label>
          <input name="serviceProvider" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('serviceDate')}</label>
          <input name="serviceDate" type="date" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('cost')}</label>
          <input name="cost" type="number" step="0.01" min="0" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('photoUrl')}</label>
          <input name="photoUrl" type="url" className="input" placeholder="https://" />
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="warrantyClaim" value="true" />
          {t('warrantyClaim')}
        </label>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('addServiceLogSubmit')}
        </button>
      </form>
    </section>
  );
}

export function EquipmentMaintenanceForm({ equipmentId }: { equipmentId: string }) {
  const t = useTranslations('faz23');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('maintenanceScheduleTitle')}</h3>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set('equipmentId', equipmentId);
          startTransition(async () => {
            setError(null);
            setSuccess(null);
            const { createMaintenanceSchedule } = await import('@/actions/equipment');
            const result = await createMaintenanceSchedule({}, fd);
            if (result.error) setError(result.error);
            if (result.success) setSuccess(result.success);
          });
        }}
      >
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('maintenanceTitle')}</label>
          <input name="title" className="input" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('frequency')}</label>
          <select name="frequency" className="input" defaultValue="MONTHLY">
            <option value="MONTHLY">{t('frequencies.MONTHLY')}</option>
            <option value="QUARTERLY">{t('frequencies.QUARTERLY')}</option>
            <option value="YEARLY">{t('frequencies.YEARLY')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('nextDueDate')}</label>
          <input name="nextDueDate" type="date" className="input" required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('notes')}</label>
          <textarea name="notes" className="input min-h-16" />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('maintenanceScheduleSubmit')}
        </button>
      </form>
    </section>
  );
}

export function EquipmentStatusSelect({
  equipmentId,
  currentStatus,
}: {
  equipmentId: string;
  currentStatus: string;
}) {
  const t = useTranslations('faz23');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <label className="muted text-sm">{t('status')}</label>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      <select
        className="input"
        defaultValue={currentStatus}
        disabled={pending}
        onChange={(e) => {
          const status = e.target.value;
          startTransition(async () => {
            setError(null);
            const { updateEquipmentStatus } = await import('@/actions/equipment');
            const result = await updateEquipmentStatus(
              equipmentId,
              status as 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'RETIRED',
            );
            if (result.error) setError(result.error);
          });
        }}
      >
        <option value="OPERATIONAL">{t('statuses.OPERATIONAL')}</option>
        <option value="UNDER_MAINTENANCE">{t('statuses.UNDER_MAINTENANCE')}</option>
        <option value="OUT_OF_SERVICE">{t('statuses.OUT_OF_SERVICE')}</option>
        <option value="RETIRED">{t('statuses.RETIRED')}</option>
      </select>
    </div>
  );
}

export function MaintenanceDoneButton({ scheduleId }: { scheduleId: string }) {
  const t = useTranslations('faz23');
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { markMaintenanceDone } = await import('@/actions/equipment');
          await markMaintenanceDone(scheduleId);
        })
      }
    >
      {t('markMaintenanceDone')}
    </button>
  );
}
