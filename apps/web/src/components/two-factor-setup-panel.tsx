'use client';

import {
  disableTwoFactor,
  generateTwoFactorSetup,
  regenerateBackupCodes,
  verifyAndEnableTwoFactor,
} from '@/actions/two-factor';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import QRCode from 'react-qr-code';

type Props = {
  twoFactorEnabled: boolean;
  mandatory: boolean;
};

type SetupState =
  | { stage: 'idle' }
  | { stage: 'setup'; secret: string; otpauthUrl: string }
  | { stage: 'backup-codes'; codes: string[] };

export function TwoFactorSetupPanel({ twoFactorEnabled, mandatory }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [enabled, setEnabled] = useState(twoFactorEnabled);
  const [state, setState] = useState<SetupState>({ stage: 'idle' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);

  async function startSetup() {
    setError(null);
    setLoading(true);
    const result = await generateTwoFactorSetup();
    setLoading(false);
    setState({ stage: 'setup', secret: result.secret, otpauthUrl: result.otpauthUrl });
  }

  async function onVerify() {
    if (state.stage !== 'setup') return;
    setLoading(true);
    setError(null);
    const result = await verifyAndEnableTwoFactor({ secret: state.secret, code });
    setLoading(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }

    await update({ twoFactorEnabled: true });
    setEnabled(true);
    setState({ stage: 'backup-codes', codes: result.backupCodes });
    setCode('');
  }

  async function onRegenerateBackupCodes() {
    if (!disablePassword || !disableCode) {
      setError('Yeniden kod üretmek için parola ve mevcut 2FA kodunu girin.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await regenerateBackupCodes({ password: disablePassword, code: disableCode });
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setState({ stage: 'backup-codes', codes: result.backupCodes });
    setShowDisableForm(false);
    setDisablePassword('');
    setDisableCode('');
  }

  async function onDisable() {
    if (!disablePassword || !disableCode) {
      setError('Devre dışı bırakmak için parola ve mevcut 2FA kodunu girin.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await disableTwoFactor({ password: disablePassword, code: disableCode });
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    await update({ twoFactorEnabled: false });
    setEnabled(false);
    setState({ stage: 'idle' });
    setShowDisableForm(false);
    setDisablePassword('');
    setDisableCode('');
    router.refresh();
  }

  if (state.stage === 'backup-codes') {
    return (
      <div className="card space-y-4 p-6">
        <h3 className="text-lg font-semibold">Yedek kodlarınız</h3>
        <p className="muted text-sm">
          Bu kodları güvenli bir yere kaydedin. Telefonunuza erişemediğinizde her biri yalnızca bir
          kez kullanılabilecek şekilde giriş yapmanızı sağlar. Bu ekranı kapattıktan sonra tekrar
          gösterilmeyecektir.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/20 p-4 font-mono text-sm">
          {state.codes.map((backupCode) => (
            <div key={backupCode}>{backupCode}</div>
          ))}
        </div>
        <button
          type="button"
          className="button button-gold"
          onClick={() => {
            setState({ stage: 'idle' });
            router.refresh();
          }}
        >
          Kaydettim, devam et
        </button>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            Etkin
          </span>
          <h3 className="text-lg font-semibold">İki Faktörlü Doğrulama</h3>
        </div>
        <p className="muted text-sm">
          Hesabınız authenticator uygulaması ile ek olarak korunuyor.
        </p>

        {!showDisableForm ? (
          <button
            type="button"
            className="button-outline-gold"
            onClick={() => setShowDisableForm(true)}
          >
            Yönet (devre dışı bırak / yedek kodları yenile)
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Mevcut parola"
              className="input"
              value={disablePassword}
              onChange={(event) => setDisablePassword(event.target.value)}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Authenticator kodu"
              className="input"
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
            />
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="button-outline-gold"
                disabled={loading}
                onClick={onRegenerateBackupCodes}
              >
                Yedek kodları yenile
              </button>
              {!mandatory ? (
                <button
                  type="button"
                  className="button-danger"
                  disabled={loading}
                  onClick={onDisable}
                >
                  2FA&apos;yı devre dışı bırak
                </button>
              ) : null}
              <button
                type="button"
                className="muted text-sm"
                onClick={() => {
                  setShowDisableForm(false);
                  setError(null);
                }}
              >
                Vazgeç
              </button>
            </div>
            {mandatory ? (
              <p className="muted text-xs">
                Bu hesap rolü için 2FA zorunludur, devre dışı bırakılamaz — yalnızca yedek kodları
                yenileyebilirsiniz.
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (state.stage === 'setup') {
    return (
      <div className="card space-y-4 p-6">
        <h3 className="text-lg font-semibold">Authenticator uygulamasını bağlayın</h3>
        <p className="muted text-sm">
          Google Authenticator, Microsoft Authenticator veya Authy gibi bir uygulamayla aşağıdaki
          QR kodu okutun, ardından uygulamada görünen 6 haneli kodu girin.
        </p>
        <div className="w-fit rounded-lg bg-white p-4">
          <QRCode value={state.otpauthUrl} size={176} />
        </div>
        <p className="muted text-xs">
          QR okutamıyorsanız, uygulamaya manuel olarak şu anahtarı girin:{' '}
          <span className="font-mono text-white">{state.secret}</span>
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            className="input max-w-[160px]"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="button" className="button button-gold" disabled={loading} onClick={onVerify}>
            Doğrula ve etkinleştir
          </button>
        </div>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
          {mandatory ? 'Zorunlu — kurulmadı' : 'Kapalı'}
        </span>
        <h3 className="text-lg font-semibold">İki Faktörlü Doğrulama (2FA)</h3>
      </div>
      <p className="muted text-sm">
        {mandatory
          ? 'Rolünüz (Yönetici/Sahip) için 2FA zorunludur. Devam etmeden önce kurulumu tamamlamanız gerekiyor.'
          : 'Hesabınıza authenticator uygulaması ile ek bir güvenlik katmanı ekleyin.'}
      </p>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <button type="button" className="button button-gold" disabled={loading} onClick={startSetup}>
        Kuruluma başla
      </button>
    </div>
  );
}
