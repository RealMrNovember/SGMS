import { FormEvent, useState } from 'react';
import type { ReceptionConfig } from '../../../shared/types';
import { Logo } from './Logo';

type Props = {
  onSuccess: (config: ReceptionConfig) => void;
};

export function LoginScreen({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const config = await window.reception.login({
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      });
      onSuccess(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı');
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
            Anlık giriş / çıkış bildirimleri
          </li>
          <li>
            <span>02</span>
            Arka planda 7/24 dinleme
          </li>
          <li>
            <span>03</span>
            Tek tıkla tepsiye küçültme
          </li>
        </ul>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-form-head">
          <h2>Personel girişi</h2>
          <p>Resepsiyon veya salon yönetimi hesabınızla oturum açın.</p>
        </div>

        <label>
          <span>E-posta</span>
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>

        <label>
          <span>Parola</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş yap ve dinlemeyi başlat'}
        </button>
      </form>
    </div>
  );
}
