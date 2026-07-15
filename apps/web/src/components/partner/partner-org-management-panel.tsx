'use client';

import {
  partnerAdjustCapacity,
  partnerExtendTrial,
  partnerSetDiscount,
  type PartnerActionState,
} from '@/actions/partner';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

type Props = {
  organizationId: string;
  currentDiscountPercent: number;
  currentDiscountNote: string;
  currentExtraMembers: number;
  currentExtraStaff: number;
  currentExtraDevices: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

const initialState: PartnerActionState = {};

export function PartnerOrgManagementPanel({
  organizationId,
  currentDiscountPercent,
  currentDiscountNote,
  currentExtraMembers,
  currentExtraStaff,
  currentExtraDevices,
  trialEndsAt,
  currentPeriodEnd,
}: Props) {
  const t = useTranslations('partner.detail');

  const [trialState, trialAction, trialPending] = useActionState(partnerExtendTrial, initialState);
  const [discountState, discountAction, discountPending] = useActionState(partnerSetDiscount, initialState);
  const [capacityState, capacityAction, capacityPending] = useActionState(
    partnerAdjustCapacity,
    initialState,
  );

  const currentEnd = trialEndsAt ?? currentPeriodEnd;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form action={trialAction} className="card space-y-3 p-5">
        <h3 className="font-semibold">{t('trialTitle')}</h3>
        <p className="muted text-xs leading-5">{t('trialHint')}</p>
        {currentEnd ? (
          <p className="text-xs">
            {t('trialCurrentEnd')}: {new Date(currentEnd).toLocaleDateString('tr-TR')}
          </p>
        ) : null}
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="space-y-1">
          <label htmlFor="days" className="muted text-xs">
            {t('trialDaysLabel')}
          </label>
          <input
            id="days"
            name="days"
            type="number"
            min={1}
            max={30}
            defaultValue={7}
            required
            className="input"
          />
        </div>
        {trialState.error ? <p className="text-xs text-rose-300">{trialState.error}</p> : null}
        {trialState.success ? <p className="text-xs text-emerald-300">{trialState.success}</p> : null}
        <button type="submit" disabled={trialPending} className="button button-gold w-full py-2 text-sm">
          {trialPending ? t('saving') : t('trialSubmit')}
        </button>
      </form>

      <form action={discountAction} className="card space-y-3 p-5">
        <h3 className="font-semibold">{t('discountTitle')}</h3>
        <p className="muted text-xs leading-5">{t('discountHint')}</p>
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="space-y-1">
          <label htmlFor="discountPercent" className="muted text-xs">
            {t('discountPercentLabel')}
          </label>
          <input
            id="discountPercent"
            name="discountPercent"
            type="number"
            min={0}
            max={30}
            defaultValue={currentDiscountPercent}
            required
            className="input"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="note" className="muted text-xs">
            {t('discountNoteLabel')}
          </label>
          <input
            id="note"
            name="note"
            type="text"
            maxLength={200}
            defaultValue={currentDiscountNote}
            className="input"
            placeholder={t('discountNotePlaceholder')}
          />
        </div>
        {discountState.error ? <p className="text-xs text-rose-300">{discountState.error}</p> : null}
        {discountState.success ? <p className="text-xs text-emerald-300">{discountState.success}</p> : null}
        <button
          type="submit"
          disabled={discountPending}
          className="button button-gold w-full py-2 text-sm"
        >
          {discountPending ? t('saving') : t('discountSubmit')}
        </button>
      </form>

      <form action={capacityAction} className="card space-y-3 p-5">
        <h3 className="font-semibold">{t('capacityTitle')}</h3>
        <p className="muted text-xs leading-5">{t('capacityHint')}</p>
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label htmlFor="extraMembers" className="muted text-xs">
              {t('capacityMembersLabel')}
            </label>
            <input
              id="extraMembers"
              name="extraMembers"
              type="number"
              min={0}
              max={100}
              defaultValue={currentExtraMembers}
              required
              className="input"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="extraStaff" className="muted text-xs">
              {t('capacityStaffLabel')}
            </label>
            <input
              id="extraStaff"
              name="extraStaff"
              type="number"
              min={0}
              max={10}
              defaultValue={currentExtraStaff}
              required
              className="input"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="extraDevices" className="muted text-xs">
              {t('capacityDevicesLabel')}
            </label>
            <input
              id="extraDevices"
              name="extraDevices"
              type="number"
              min={0}
              max={5}
              defaultValue={currentExtraDevices}
              required
              className="input"
            />
          </div>
        </div>
        {capacityState.error ? <p className="text-xs text-rose-300">{capacityState.error}</p> : null}
        {capacityState.success ? <p className="text-xs text-emerald-300">{capacityState.success}</p> : null}
        <button
          type="submit"
          disabled={capacityPending}
          className="button button-gold w-full py-2 text-sm"
        >
          {capacityPending ? t('saving') : t('capacitySubmit')}
        </button>
      </form>
    </div>
  );
}
