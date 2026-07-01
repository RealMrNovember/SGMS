import { useEffect, useState } from 'react';
import { fetchMembers, manualCheckIn, type GymMemberRow } from '../lib/api';

export function ManualCheckInPanel() {
  const [members, setMembers] = useState<GymMemberRow[]>([]);
  const [memberId, setMemberId] = useState('');
  const [direction, setDirection] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetchMembers()
      .then((rows) => setMembers(rows.filter((m) => m.status === 'ACTIVE')))
      .catch(() => setMembers([]));
  }, []);

  async function submit() {
    if (!memberId) return;
    setPending(true);
    setMessage(null);
    const result = await manualCheckIn(memberId, direction);
    setPending(false);

    if (!result.ok) {
      setMessage({ type: 'err', text: result.error ?? 'Giriş kaydedilemedi' });
      return;
    }

    setMessage({
      type: 'ok',
      text: direction === 'ENTRY' ? 'Giriş başarıyla kaydedildi' : 'Çıkış başarıyla kaydedildi',
    });
    setMemberId('');
  }

  return (
    <section className="panel panel--narrow">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Manuel işlem</p>
          <h2>Giriş / çıkış kaydı</h2>
          <p className="panel-lead">Turnike olmadan resepsiyondan giriş veya çıkış işaretleyin.</p>
        </div>
      </header>

      <div className="card-form card-form--large">
        {message ? (
          <p className={`inline-message ${message.type === 'err' ? 'inline-message--error' : 'inline-message--ok'}`}>
            {message.text}
          </p>
        ) : null}

        <label>
          Sporcu
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Sporcu seçin…</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
                {member.phone ? ` · ${member.phone}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="direction-toggle">
          <button
            type="button"
            className={direction === 'ENTRY' ? 'active' : ''}
            onClick={() => setDirection('ENTRY')}
          >
            Giriş
          </button>
          <button
            type="button"
            className={direction === 'EXIT' ? 'active' : ''}
            onClick={() => setDirection('EXIT')}
          >
            Çıkış
          </button>
        </div>

        <button type="button" className="primary-btn primary-btn--wide" disabled={!memberId || pending} onClick={() => void submit()}>
          {pending ? 'Kaydediliyor…' : 'Kaydı tamamla'}
        </button>
      </div>
    </section>
  );
}
