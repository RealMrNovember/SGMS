import { useEffect, useState } from 'react';
import {
  addExpense,
  fetchMembers,
  fetchOpenBalance,
  recordPayment,
  type GymMemberRow,
} from '../lib/api';

type Props = {
  initialMemberId?: string;
};

const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

export function PosPanel({ initialMemberId }: Props) {
  const [members, setMembers] = useState<GymMemberRow[]>([]);
  const [memberId, setMemberId] = useState(initialMemberId ?? '');
  const [balance, setBalance] = useState(0);
  const [expenses, setExpenses] = useState<
    Array<{ id: string; amount: string; description: string | null; category?: { name: string } | null }>
  >([]);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNote, setChargeNote] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    if (initialMemberId) {
      setMemberId(initialMemberId);
    }
  }, [initialMemberId]);

  useEffect(() => {
    if (!memberId) {
      setBalance(0);
      setExpenses([]);
      return;
    }
    void fetchOpenBalance(memberId).then((snapshot) => {
      setBalance(snapshot.balance);
      setExpenses(snapshot.expenses);
    });
  }, [memberId, message]);

  async function handleCharge() {
    const amount = Number(chargeAmount);
    if (!memberId || !Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    const result = await addExpense(memberId, amount, chargeNote.trim() || 'Resepsiyon tahakkuku');
    setBusy(false);
    setMessage(result.ok ? 'Borç eklendi' : (result.error ?? 'Borç eklenemedi'));
    if (result.ok) {
      setChargeAmount('');
      setChargeNote('');
    }
  }

  async function handlePayment() {
    const amount = Number(payAmount);
    if (!memberId || !Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    const result = await recordPayment(memberId, amount, payMethod);
    setBusy(false);
    setMessage(result.ok ? 'Tahsilat kaydedildi' : (result.error ?? 'Tahsilat kaydedilemedi'));
    if (result.ok) {
      setPayAmount('');
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Kasa</p>
          <h2>Borç &amp; tahsilat</h2>
          <p className="panel-lead">Üye cari hesabına borç yazın veya ödeme alın.</p>
        </div>
      </header>

      <div className="pos-layout">
        <div className="card-form">
          <label>
            Üye seçin
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Sporcu seçin…</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </label>

          {memberId ? (
            <div className="balance-card">
              <span>Açık bakiye</span>
              <strong>{money.format(balance)}</strong>
            </div>
          ) : null}

          {message ? <p className="inline-message">{message}</p> : null}

          <div className="pos-grid">
            <div className="pos-card">
              <h3>Borç ekle</h3>
              <label>
                Tutar (TRY)
                <input type="number" min="0" step="0.01" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
              </label>
              <label>
                Açıklama
                <input value={chargeNote} onChange={(e) => setChargeNote(e.target.value)} placeholder="Örn. Protein shake" />
              </label>
              <button type="button" className="primary-btn" disabled={!memberId || busy} onClick={() => void handleCharge()}>
                Borç yaz
              </button>
            </div>

            <div className="pos-card">
              <h3>Tahsilat al</h3>
              <label>
                Tutar (TRY)
                <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </label>
              <label>
                Ödeme yöntemi
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}>
                  <option value="CASH">Nakit</option>
                  <option value="CARD">Kart</option>
                  <option value="TRANSFER">Havale/EFT</option>
                </select>
              </label>
              <button type="button" className="primary-btn" disabled={!memberId || busy} onClick={() => void handlePayment()}>
                Tahsilat kaydet
              </button>
            </div>
          </div>
        </div>

        <aside className="pos-side">
          <h3>Açık kalemler</h3>
          {expenses.length === 0 ? (
            <p className="muted">Açık borç kalemi yok.</p>
          ) : (
            <ul className="pos-expense-list">
              {expenses.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.description ?? row.category?.name ?? 'Borç'}</strong>
                    <span>{money.format(Number(row.amount))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
