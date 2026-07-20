'use client';

import { uploadMeasurementPhoto, type UploadMeasurementPhotoState } from '@/actions/measurements';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: UploadMeasurementPhotoState = {};

export function UploadMeasurementPhotoForm({
  gymMemberId,
  canManage,
  healthMeasurementId,
}: {
  gymMemberId: string;
  canManage: boolean;
  healthMeasurementId?: string;
}) {
  const t = useTranslations('measurements');
  const [state, formAction, pending] = useActionState(uploadMeasurementPhoto, initialState);

  if (!canManage) {
    return null;
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('photoUploadTitle')}</h3>
        <p className="muted mt-1 text-sm">{t('photoUploadSubtitle')}</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="gymMemberId" value={gymMemberId} />
        {healthMeasurementId ? (
          <input type="hidden" name="healthMeasurementId" value={healthMeasurementId} />
        ) : null}

        <div className="space-y-2">
          <label htmlFor="angle" className="muted text-sm">
            {t('photoAngle')}
          </label>
          <select id="angle" name="angle" className="input">
            <option value="FRONT">{t('photoAngles.front')}</option>
            <option value="SIDE">{t('photoAngles.side')}</option>
            <option value="BACK">{t('photoAngles.back')}</option>
            <option value="OTHER">{t('photoAngles.other')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="file" className="muted text-sm">
            {t('photoFile')}
          </label>
          <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-5 py-2.5" disabled={pending}>
            {pending ? t('photoUploading') : t('photoUploadSubmit')}
          </button>
        </div>
      </form>
    </section>
  );
}
