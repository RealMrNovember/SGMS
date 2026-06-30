type AdminBadgeProps = {
  label: string;
  tone?: 'gold' | 'success' | 'warning' | 'danger' | 'muted';
};

const toneClass: Record<NonNullable<AdminBadgeProps['tone']>, string> = {
  gold: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  muted: 'border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--muted)]',
};

export function AdminBadge({ label, tone = 'muted' }: AdminBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass[tone]}`}
    >
      {label}
    </span>
  );
}
