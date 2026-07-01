import { FormEvent, useEffect, useState } from 'react';
import {
  createMember,
  fetchMemberDetail,
  fetchMembers,
  manualCheckIn,
  type GymMemberRow,
} from '../lib/api';

type Props = {
  onOpenPos: (memberId: string) => void;
};

export function MembersPanel({ onOpenPos }: Props) {
  const [members, setMembers] = useState<GymMemberRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GymMemberRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', nationalId: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadMembers(query = search) {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMembers(query);
      setMembers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers('');
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    void fetchMemberDetail(selectedId)
      .then(setSelected)
      .catch(() => setSelected(null));
  }, [selectedId]);

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await createMember({
      firstName: addForm.firstName.trim(),
      lastName: addForm.lastName.trim(),
      phone: addForm.phone.trim() || undefined,
      nationalId: addForm.nationalId.trim() || undefined,
    });
    setBusy(false);

    if (!result.ok) {
      setMessage(result.error ?? 'Üye eklenemedi');
      return;
    }

    setShowAdd(false);
    setAddForm({ firstName: '', lastName: '', phone: '', nationalId: '' });
    setMessage('Üye başarıyla eklendi');
    await loadMembers();
  }

  async function handleQuickCheckIn(direction: 'ENTRY' | 'EXIT') {
    if (!selectedId) return;
    setBusy(true);
    const result = await manualCheckIn(selectedId, direction);
    setBusy(false);
    setMessage(result.ok ? `${direction === 'ENTRY' ? 'Giriş' : 'Çıkış'} kaydedildi` : (result.error ?? 'İşlem başarısız'));
  }

  return (
    <section className="panel panel--split">
      <div className="panel-column">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Üye yönetimi</p>
            <h2>Sporcu listesi</h2>
          </div>
          <button type="button" className="primary-btn" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'İptal' : '+ Yeni üye'}
          </button>
        </header>

        {showAdd ? (
          <form className="card-form" onSubmit={handleAddMember}>
            <div className="form-grid">
              <label>
                Ad
                <input value={addForm.firstName} onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })} required />
              </label>
              <label>
                Soyad
                <input value={addForm.lastName} onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })} required />
              </label>
              <label>
                Telefon
                <input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              </label>
              <label>
                TC Kimlik No
                <input value={addForm.nationalId} onChange={(e) => setAddForm({ ...addForm, nationalId: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="primary-btn" disabled={busy}>
              Kaydet
            </button>
          </form>
        ) : null}

        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Ad, soyad, telefon veya TC ile ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void loadMembers(search);
            }}
          />
          <button type="button" className="ghost-btn" onClick={() => void loadMembers(search)}>
            Ara
          </button>
        </div>

        {message ? <p className="inline-message">{message}</p> : null}
        {error ? <p className="inline-message inline-message--error">{error}</p> : null}

        <div className="data-table-wrap">
          {loading ? (
            <p className="muted">Yükleniyor…</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Üye</th>
                  <th>Telefon</th>
                  <th>Plan</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className={selectedId === member.id ? 'data-table__row--active' : ''}
                    onClick={() => setSelectedId(member.id)}
                  >
                    <td>
                      <strong>
                        {member.firstName} {member.lastName}
                      </strong>
                    </td>
                    <td>{member.phone ?? '—'}</td>
                    <td>{member.plan?.name ?? '—'}</td>
                    <td>
                      <span className={`status-pill status-pill--${member.status.toLowerCase()}`}>{member.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <aside className="detail-pane">
        {selected ? (
          <>
            <p className="eyebrow">Üye detayı</p>
            <h3>
              {selected.firstName} {selected.lastName}
            </h3>
            <dl className="detail-list">
              <div>
                <dt>Telefon</dt>
                <dd>{selected.phone ?? '—'}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{selected.plan?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Antrenör</dt>
                <dd>{selected.trainer?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Durum</dt>
                <dd>{selected.status}</dd>
              </div>
            </dl>
            <div className="detail-actions">
              <button type="button" className="primary-btn" disabled={busy} onClick={() => void handleQuickCheckIn('ENTRY')}>
                Giriş kaydet
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => void handleQuickCheckIn('EXIT')}>
                Çıkış kaydet
              </button>
              <button type="button" className="ghost-btn" onClick={() => onOpenPos(selected.id)}>
                Kasaya git
              </button>
            </div>
          </>
        ) : (
          <div className="detail-empty">
            <p className="eyebrow">Detay</p>
            <h3>Üye seçin</h3>
            <p className="muted">Listeden bir sporcu seçerek hızlı işlem yapabilirsiniz.</p>
          </div>
        )}
      </aside>
    </section>
  );
}
