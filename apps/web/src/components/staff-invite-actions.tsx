'use client';

import { cancelStaffInvite, resendStaffInvite } from '@/actions/team';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function StaffInviteActions({ membershipId }: { membershipId: string }) {
  const t = useTranslations('team');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        window.alert(result.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="text-xs text-sky-300 hover:text-sky-200 disabled:opacity-50"
        disabled={pending}
        onClick={() => run(() => resendStaffInvite(membershipId))}
      >
        {t('resendInvite')}
      </button>
      <button
        type="button"
        className="text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t('cancelInviteConfirm'))) {
            run(() => cancelStaffInvite(membershipId));
          }
        }}
      >
        {t('cancelInvite')}
      </button>
    </div>
  );
}
