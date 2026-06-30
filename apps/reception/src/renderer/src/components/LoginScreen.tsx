import { FormEvent, useState } from 'react';
import type { ReceptionConfig } from '../../../shared/types';
import { Logo } from './Logo';

type Props = {
  onSuccess: (config: ReceptionConfig) => void;
  initialApiUrl?: string;
  initialSoketiKey?: string;
};

export function LoginScreen({ onSuccess, initialApiUrl, initialSoketiKey }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const config = await window.reception.login({
        apiBaseUrl: String(form.get('apiBaseUrl')).trim(),
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
        soketiKey: String(form.get('soketiKey')).trim(),
        soketiWsPath: '/realtime/app',
      });
      onSuccess(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bağlantı kurulamadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-visual">
        <div className="login-visual-glow" />
        <Logo size={96} />
        <p className="eyebrow">CiCiByte SGMS</p>
        <h1>Resepsiyon Kontrol Merkezi</h1>
        <p className="login-lead">
          Turnike giriş ve çıkışları anında Windows bildirimi olarak iletilir. Salon operasyonunuz
          arka planda, kesintisiz ve güvenli kalır.
        </p>
        <ul className="login-features">
          <li>
            <span>01</span>
            Canlı Soketi bağlantısı
          </li>
          <li>
            <span>02</span>
            Giriş / çıkış toast bildirimleri
          </li>
          <li>
            <span>03</span>
            Tepsi modunda 7/24 dinleme
          </li>
        </ul>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-form-head">
          <h2>Salon bağlantısı</h2>
          <p>Personel hesabınızla oturum açın. Ayarlar cihazınızda güvenle saklanır.</p>
        </div>

        <label>
          <span>SGMS sunucu adresi</span>
          <input name="apiBaseUrl" defaultValue={initialApiUrl ?? 'https://sgms.cicibyte.com'} required />
        </label>

        <label>
          <span>Soketi anahtarı</span>
          <input
            name="soketiKey"
            defaultValue={initialSoketiKey ?? ''}
            placeholder="NEXT_PUBLIC_SOKETI_KEY"
            required
          />
        </label>

        <label>
          <span>Personel e-posta</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>

        <label>
          <span>Parola</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Bağlanılıyor…' : 'Canlı dinlemeyi başlat'}
        </button>
      </form>
    </div>
  );
}
