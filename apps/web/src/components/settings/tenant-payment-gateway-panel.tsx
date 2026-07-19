'use client';

import {
  updateTenantPaymentSettings,
  type TenantPaymentGatewayState,
} from '@/actions/tenant-payment-gateway';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

type MaskedGateway = {
  provider: string;
  isActive: boolean;
  apiKeyMasked: string | null;
  secretKeyMasked: string | null;
  merchantIdMasked: string | null;
  merchantKeyMasked: string | null;
  merchantSaltMasked: string | null;
  baseUrl: string;
  sandbox: boolean;
  ibanHolderName: string | null;
  ibanNumber: string | null;
  ibanBankName: string | null;
  bankTransferNote: string | null;
  configured: boolean;
} | null;

export type TenantPaymentSettingsProps = {
  iyzico: MaskedGateway;
  paytr: MaskedGateway;
  bankTransfer: MaskedGateway;
};

const initialState: TenantPaymentGatewayState = {};

export function TenantPaymentGatewayPanel({ iyzico, paytr, bankTransfer }: TenantPaymentSettingsProps) {
  const t = useTranslations('settings.paymentGateway');
  const [state, action, pending] = useActionState(updateTenantPaymentSettings, initialState);
  const initialActive: 'NONE' | 'IYZICO' | 'PAYTR' = iyzico?.isActive
    ? 'IYZICO'
    : paytr?.isActive
      ? 'PAYTR'
      : 'NONE';
  const [activeProvider, setActiveProvider] = useState(initialActive);

  return (
    <div className="space-y-4">
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

      <form action={action} className="space-y-6">
        <div>
          <h4 className="font-semibold">{t('activeProviderLabel')}</h4>
          <p className="muted mt-1 text-sm leading-6">{t('activeProviderHint')}</p>
          <select
            name="activeCardProvider"
            value={activeProvider}
            onChange={(event) => setActiveProvider(event.target.value as typeof activeProvider)}
            className="input mt-3 w-full max-w-xs"
          >
            <option value="NONE">{t('providerNone')}</option>
            <option value="IYZICO">{t('providerIyzico')}</option>
            <option value="PAYTR">{t('providerPaytr')}</option>
          </select>
          {activeProvider !== 'NONE' &&
          !(activeProvider === 'IYZICO' ? iyzico?.configured : paytr?.configured) ? (
            <p className="mt-2 text-xs text-amber-400">{t('notConfiguredWarning')}</p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <h4 className="font-semibold">{t('iyzicoSectionTitle')}</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="muted">
                {t('apiKeyLabel')}
                {iyzico?.apiKeyMasked ? ` ${t('currentValueSuffix', { value: iyzico.apiKeyMasked })}` : ''}
              </span>
              <input
                name="iyzicoApiKey"
                type="password"
                className="input w-full"
                placeholder={t('placeholderNewValue')}
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">
                {t('secretKeyLabel')}
                {iyzico?.secretKeyMasked
                  ? ` ${t('currentValueSuffix', { value: iyzico.secretKeyMasked })}`
                  : ''}
              </span>
              <input
                name="iyzicoSecretKey"
                type="password"
                className="input w-full"
                placeholder={t('placeholderNewValue')}
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">{t('baseUrlLabel')}</span>
              <select
                name="iyzicoBaseUrl"
                defaultValue={iyzico?.baseUrl ?? 'https://sandbox-api.iyzipay.com'}
                className="input w-full"
              >
                <option value="https://sandbox-api.iyzipay.com">{t('baseUrlSandbox')}</option>
                <option value="https://api.iyzipay.com">{t('baseUrlProduction')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="iyzicoSandbox" value="on" defaultChecked={iyzico?.sandbox ?? true} />
              <span className="muted">{t('sandboxLabel')}</span>
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <h4 className="font-semibold">{t('paytrSectionTitle')}</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="muted">
                {t('merchantIdLabel')}
                {paytr?.merchantIdMasked
                  ? ` ${t('currentValueSuffix', { value: paytr.merchantIdMasked })}`
                  : ''}
              </span>
              <input
                name="paytrMerchantId"
                type="password"
                className="input w-full"
                placeholder={t('placeholderNewValue')}
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">
                {t('merchantKeyLabel')}
                {paytr?.merchantKeyMasked
                  ? ` ${t('currentValueSuffix', { value: paytr.merchantKeyMasked })}`
                  : ''}
              </span>
              <input
                name="paytrMerchantKey"
                type="password"
                className="input w-full"
                placeholder={t('placeholderNewValue')}
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">
                {t('merchantSaltLabel')}
                {paytr?.merchantSaltMasked
                  ? ` ${t('currentValueSuffix', { value: paytr.merchantSaltMasked })}`
                  : ''}
              </span>
              <input
                name="paytrMerchantSalt"
                type="password"
                className="input w-full"
                placeholder={t('placeholderNewValue')}
                autoComplete="off"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="paytrSandbox" value="on" defaultChecked={paytr?.sandbox ?? true} />
              <span className="muted">{t('testModeLabel')}</span>
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bankTransferEnabled"
              name="bankTransferEnabled"
              value="on"
              defaultChecked={bankTransfer?.isActive ?? false}
            />
            <label htmlFor="bankTransferEnabled" className="font-semibold">
              {t('bankTransferEnableLabel')}
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="muted">{t('ibanHolderLabel')}</span>
              <input name="ibanHolderName" defaultValue={bankTransfer?.ibanHolderName ?? ''} className="input w-full" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">{t('ibanNumberLabel')}</span>
              <input
                name="ibanNumber"
                defaultValue={bankTransfer?.ibanNumber ?? ''}
                className="input w-full"
                placeholder="TR00 0000 0000 0000 0000 0000 00"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">{t('ibanBankNameLabel')}</span>
              <input name="ibanBankName" defaultValue={bankTransfer?.ibanBankName ?? ''} className="input w-full" />
            </label>
            <label className="block space-y-1 text-sm md:col-span-2">
              <span className="muted">{t('bankNoteLabel')}</span>
              <textarea
                name="bankTransferNote"
                defaultValue={bankTransfer?.bankTransferNote ?? ''}
                className="input w-full"
                rows={2}
                placeholder={t('bankNotePlaceholder')}
              />
            </label>
          </div>
        </div>

        <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </button>
      </form>
    </div>
  );
}
