'use client';

import { toggleTrainingProgramActive } from '@/actions/programs';
import { useTransition } from 'react';

export function ToggleProgramButton({
  programId,
  isActive,
}: {
  programId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="button px-3 py-1.5 text-xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleTrainingProgramActive(programId);
        });
      }}
    >
      {pending ? '…' : isActive ? 'Pasifleştir' : 'Aktifleştir'}
    </button>
  );
}
