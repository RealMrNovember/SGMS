'use client';

import {
  createMasterAdmin,
  demoteMasterAdmin,
  promoteUserToMasterAdmin,
  resetMasterAdminPassword,
  toggleMasterAdminStatus,
  updateMasterAdminProfile,
  type MasterAdminState,
} from '@/actions/admin-master-admins';
import { AdminBadge } from '@/components/admin/admin-badge';
import { formatDateTimeTr } from '@/lib/admin/format';
import { useActionState, useState } from 'react';

export type MasterAdminRow = {
  id: string;
  email: string;
  name: string;
  status: string;
  locale: string;
  lastLoginAt: string | null;
  createdAt: string;
  membershipCount: number;
  activeTokens: number;
};

const LOCALES = ['tr', 'en', 'de', 'fr', 'es', 'ru', 'az'] as const;

function FeedbackBanner({ state }: { state: MasterAdminState }) {
  if (state.error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        {state.success}
        {state.temporaryPassword ? (
          <span className="mt-2 block font-mono text-[#c9a962]">
            Geçici parola: {state.temporaryPassword}
          </span>
        ) : null}
      </p>
    );
  }
  return null;
}

function MasterAdminRowActions({
  admin,
  currentUserId,
  onFeedback,
}: {
  admin: MasterAdminRow;
  currentUserId: string;
  onFeedback: (state: MasterAdminState) => void;
}) {
  const wrap =
    (fn: typeof updateMasterAdminProfile) =>
    async (prev: MasterAdminState, formData: FormData) => {
      const result = await fn(prev, formData);
      onFeedback(result);
      return result;
    };

  const [, profileAction] = useActionState(wrap(updateMasterAdminProfile), {} as MasterAdminState);
  const [, toggleAction] = useActionState(wrap(toggleMasterAdminStatus), {} as MasterAdminState);
  const [, resetAction, resetPending] = useActionState(
    wrap(resetMasterAdminPassword),
    {} as MasterAdminState,
  );
  const [, demoteAction, demotePending] = useActionState(wrap(demoteMasterAdmin), {} as MasterAdminState);

  const isSelf = admin.id === currentUserId;

  return (
    <tr className="border-b border-[var(--border)] align-top last:border-none">
      <td className="px-4 py-4" colSpan={2}>
        <form action={profileAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="userId" value={admin.id} />
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="muted">Ad soyad</span>
            <input name="name" defaultValue={admin.name} className="input w-full text-sm" required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="muted">E-posta</span>
            <p className="text-sm">{admin.email}</p>
            {isSelf ? (
              <span className="inline-flex text-[10px] text-[#c9a962]">Sizin hesabınız</span>
            ) : null}
          </label>
          <label className="space-y-1 text-sm">
            <span className="muted">Dil</span>
            <select name="locale" defaultValue={admin.locale} className="input w-full text-xs">
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="button px-2 py-1 text-xs">
              Profili kaydet
            </button>
          </div>
        </form>
      </td>
      <td className="px-4 py-4">
        <AdminBadge
          label={admin.status === 'ACTIVE' ? 'Aktif' : 'Devre dışı'}
          tone={admin.status === 'ACTIVE' ? 'success' : 'danger'}
        />
      </td>
      <td className="px-4 py-4 muted text-xs">
        {formatDateTimeTr(admin.lastLoginAt ? new Date(admin.lastLoginAt) : null)}
      </td>
      <td className="px-4 py-4 muted text-xs">
        {formatDateTimeTr(new Date(admin.createdAt))}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-2">
          <form action={toggleAction}>
            <input type="hidden" name="userId" value={admin.id} />
            <input
              type="hidden"
              name="status"
              value={admin.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'}
            />
            <button
              type="submit"
              className="button px-2 py-1 text-xs"
              disabled={isSelf && admin.status === 'ACTIVE'}
            >
              {admin.status === 'ACTIVE' ? 'Devre dışı bırak' : 'Aktifleştir'}
            </button>
          </form>
          <form action={resetAction}>
            <input type="hidden" name="userId" value={admin.id} />
            <button type="submit" className="button px-2 py-1 text-xs" disabled={resetPending}>
              Parola sıfırla
            </button>
          </form>
          {!isSelf ? (
            <form
              action={demoteAction}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    `${admin.email} kullanıcısının Master Admin yetkisini kaldırmak istediğinize emin misiniz?`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="userId" value={admin.id} />
              <button
                type="submit"
                className="admin-audit-delete-btn px-2 py-1 text-xs"
                disabled={demotePending}
              >
                Yetkiyi kaldır
              </button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function MasterAdminPanel({
  admins,
  currentUserId,
  stats,
}: {
  admins: MasterAdminRow[];
  currentUserId: string;
  stats: { total: number; active: number; disabled: number };
}) {
  const [createState, createAction, createPending] = useActionState(createMasterAdmin, {} as MasterAdminState);
  const [promoteState, promoteAction, promotePending] = useActionState(
    promoteUserToMasterAdmin,
    {} as MasterAdminState,
  );
  const [rowFeedback, setRowFeedback] = useState<MasterAdminState>({});

  const banner = createState.error || createState.success
    ? createState
    : promoteState.error || promoteState.success
      ? promoteState
      : rowFeedback;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Toplam admin</p>
          <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Aktif</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{stats.active}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Devre dışı</p>
          <p className="mt-2 text-3xl font-semibold text-rose-300">{stats.disabled}</p>
        </article>
      </section>

      <FeedbackBanner state={banner} />

      <section className="grid gap-6 xl:grid-cols-2">
        <form action={createAction} className="card space-y-4 p-5">
          <div>
            <h3 className="text-lg font-semibold">Yeni Master Admin</h3>
            <p className="muted mt-1 text-sm">
              Platform yönetim paneline erişecek yeni bir süper yönetici oluşturun. Parola boş
              bırakılırsa otomatik üretilir.
            </p>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="muted">Ad soyad</span>
            <input name="name" className="input w-full" required placeholder="Örn. Ayşe Yılmaz" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="muted">E-posta</span>
            <input name="email" type="email" className="input w-full" required />
            {createState.fieldErrors?.email ? (
              <span className="text-xs text-rose-300">{createState.fieldErrors.email}</span>
            ) : null}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="muted">Dil</span>
              <select name="locale" className="input w-full" defaultValue="tr">
                {LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">Parola (opsiyonel)</span>
              <input
                name="password"
                type="password"
                className="input w-full"
                minLength={8}
                placeholder="Boş = otomatik"
                autoComplete="new-password"
              />
            </label>
          </div>
          <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={createPending}>
            {createPending ? 'Ekleniyor…' : 'Master Admin ekle'}
          </button>
        </form>

        <form action={promoteAction} className="card space-y-4 p-5">
          <div>
            <h3 className="text-lg font-semibold">Mevcut hesabı yükselt</h3>
            <p className="muted mt-1 text-sm">
              Sistemde kayıtlı bir kullanıcıyı Master Admin yapın. Salon üyelikleri ve aktif API
              tokenları kaldırılır.
            </p>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="muted">Kullanıcı e-postası</span>
            <input name="email" type="email" className="input w-full" required />
            {promoteState.fieldErrors?.email ? (
              <span className="text-xs text-rose-300">{promoteState.fieldErrors.email}</span>
            ) : null}
          </label>
          <button type="submit" className="button px-4 py-2 text-sm" disabled={promotePending}>
            {promotePending ? 'Yükseltiliyor…' : 'Master Admin yap'}
          </button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">Master Admin listesi</h3>
          <p className="muted mt-1 text-sm">
            En az bir aktif Master Admin kalmalıdır. Kendi hesabınızı devre dışı bırakamaz veya
            yetkisini kaldıramazsınız.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase">
              <tr>
                <th className="px-4 py-3" colSpan={2}>
                  Yönetici
                </th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Son giriş</th>
                <th className="px-4 py-3">Oluşturulma</th>
                <th className="px-4 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <MasterAdminRowActions
                  key={admin.id}
                  admin={admin}
                  currentUserId={currentUserId}
                  onFeedback={setRowFeedback}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
