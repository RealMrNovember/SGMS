'use client';

import { registerDevice, disableDevice, type DeviceFormState } from '@/actions/devices';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const initialState: DeviceFormState = {};

type DeviceRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  hardwareId: string;
  location: string | null;
  lastSeenAt: Date | string | null;
};

export function DeviceManagementPanel({
  devices,
  canManage,
}: {
  devices: DeviceRow[];
  canManage: boolean;
}) {
  const t = useTranslations('checkIn.devices');
  const router = useRouter();
  const [state, formAction, pending] = useActionState(registerDevice, initialState);
  const [busy, startTransition] = useTransition();

  if (!canManage) {
    return (
      <section className="card p-6">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-2 text-sm">{t('viewOnly')}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {devices.length === 0 ? (
            <li className="muted">{t('empty')}</li>
          ) : (
            devices.map((d) => (
              <li key={d.id} className="flex justify-between gap-2 border-b border-white/5 py-2">
                <span>{d.name}</span>
                <span className="badge">{d.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    );
  }

  function runDisable(deviceId: string, force: boolean) {
    startTransition(async () => {
      await disableDevice(deviceId, { force });
      router.refresh();
    });
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <p>{state.success}</p>
          {state.apiKey ? (
            <code className="mt-2 block break-all rounded-lg bg-black/30 p-2 text-xs text-white">
              {state.apiKey}
            </code>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="muted text-xs">{t('name')}</label>
          <input name="name" className="input w-full" placeholder={t('namePlaceholder')} required />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">{t('hardwareId')}</label>
          <input name="hardwareId" className="input w-full" placeholder="TURNIKE-01" required />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">{t('location')}</label>
          <input name="location" className="input w-full" placeholder={t('locationPlaceholder')} />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">{t('type')}</label>
          <select name="type" className="input w-full" defaultValue="TURNSTILE">
            <option value="TURNSTILE">{t('types.turnstile')}</option>
            <option value="KIOSK">{t('types.kiosk')}</option>
            <option value="SCANNER">{t('types.scanner')}</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <button type="submit" className="button px-4 py-2 text-sm" disabled={pending}>
            {pending ? t('registering') : t('register')}
          </button>
        </div>
      </form>

      <ul className="divide-y divide-white/5 text-sm">
        {devices.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-medium">{d.name}</p>
              <p className="muted text-xs">
                {d.hardwareId}
                {d.location ? ` · ${d.location}` : ''}
              </p>
              {d.status === 'DRAINING' ? (
                <p className="mt-1 text-xs text-amber-200/90">{t('drainingHint')}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge">{d.status}</span>
              {d.status !== 'DISABLED' ? (
                <>
                  <button
                    type="button"
                    className="text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => runDisable(d.id, false)}
                  >
                    {d.status === 'DRAINING' ? t('finalizeDisable') : t('disable')}
                  </button>
                  {d.status === 'DRAINING' ? (
                    <button
                      type="button"
                      className="text-xs text-amber-300/90 hover:text-amber-200 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(t('forceDisableConfirm'))) {
                          runDisable(d.id, true);
                        }
                      }}
                    >
                      {t('forceDisable')}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
