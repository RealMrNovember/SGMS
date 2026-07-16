import { Dumbbell } from 'lucide-react';

type Props = {
  size?: number;
  label?: string;
};

export function GymLoader({ size = 40, label }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <span className="gym-loader" style={{ width: size, height: size }} aria-hidden="true">
        <Dumbbell size={size} strokeWidth={1.75} />
      </span>
      <svg width={size * 1.4} height="4" viewBox="0 0 56 4" aria-hidden="true">
        <rect className="gym-loader-bar" x="0" y="0" width="56" height="4" rx="2" fill="var(--gold)" opacity="0.35" />
      </svg>
      {label ? <p className="muted text-sm">{label}</p> : null}
    </div>
  );
}
