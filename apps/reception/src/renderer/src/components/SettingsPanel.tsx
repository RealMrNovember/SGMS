import type { ReceptionConfig } from '../../../shared/types';

type Props = {
  config: ReceptionConfig;
  launchAtStartup: boolean;
  onLaunchAtStartupChange: (enabled: boolean) => void;
};

export function SettingsPanel({ config, launchAtStartup, onLaunchAtStartupChange }: Props) {
  return (
    <section className="panel panel--narrow">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Ayarlar</p>
          <h2>Uygulama tercihleri</h2>
        </div>
      </header>

      <div className="settings-grid">
        <article className="settings-card">
          <h3>Bağlantı</h3>
          <dl className="detail-list">
            <div>
              <dt>Sunucu</dt>
              <dd>{config.apiBaseUrl}</dd>
            </div>
            <div>
              <dt>Salon</dt>
              <dd>{config.organizationName}</dd>
            </div>
            <div>
              <dt>Canlı bildirim</dt>
              <dd>{config.soketiKey ? 'Soketi etkin' : 'Yalnızca periyodik senkron'}</dd>
            </div>
          </dl>
        </article>

        <article className="settings-card">
          <h3>Windows</h3>
          <label className="setting-toggle setting-toggle--card">
            <div>
              <strong>Windows açılışında başlat</strong>
              <p>Bilgisayar açıldığında tepsi modunda otomatik dinleme</p>
            </div>
            <input
              type="checkbox"
              checked={launchAtStartup}
              onChange={(event) => onLaunchAtStartupChange(event.target.checked)}
            />
            <span className="setting-toggle-ui" />
          </label>
          <p className="muted settings-note">
            Pencereyi kapatsanız bile Windows bildirimleri ve tepsi dinleyicisi çalışmaya devam eder.
          </p>
        </article>

        <article className="settings-card">
          <h3>Kısayollar</h3>
          <ul className="settings-list">
            <li>Üye arama ve yeni kayıt → <strong>Üyeler</strong></li>
            <li>Manuel giriş/çıkış → <strong>Giriş Kaydı</strong></li>
            <li>Borç ve tahsilat → <strong>Kasa</strong></li>
            <li>Turnike olayları → <strong>Canlı Akış</strong></li>
          </ul>
        </article>
      </div>
    </section>
  );
}
