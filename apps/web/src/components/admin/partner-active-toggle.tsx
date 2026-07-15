'use client';

import { setPartnerActive } from '@/actions/admin-partners';
import { useTransition } from 'react';

export function PartnerActiveToggle({ partnerId, isActive }: { partnerId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const formData = new FormData();
    formData.set('partnerId', partnerId);
    formData.set('isActive', String(!isActive));
    startTransition(async () => {
      await setPartnerActive({}, formData);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`badge ${isActive ? '' : 'opacity-60'}`}
    >
      {pending ? '…' : isActive ? 'Aktif' : 'Pasif'}
    </button>
  );
}
