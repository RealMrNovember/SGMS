'use client';

import { UserAvatar } from '@/components/user-avatar';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

type AvatarUploadProps = {
  name: string;
  currentUrl?: string | null;
  targetType: 'user' | 'gym_member';
  gymMemberId?: string;
  userId?: string;
  canUpload: boolean;
  size?: 'md' | 'lg' | 'xl';
};

export function AvatarUpload({
  name,
  currentUrl,
  targetType,
  gymMemberId,
  userId,
  canUpload,
  size = 'lg',
}: AvatarUploadProps) {
  const t = useTranslations('avatar');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(currentUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetType', targetType);
    if (targetType === 'gym_member' && gymMemberId) {
      formData.append('gymMemberId', gymMemberId);
    }
    if (targetType === 'user' && userId) {
      formData.append('userId', userId);
    }

    try {
      const response = await fetch('/api/v1/upload/avatar', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { avatarUrl: string };
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.data?.avatarUrl) {
        setError(payload.error ?? t('uploadFailed'));
        return;
      }

      setAvatarUrl(payload.data.avatarUrl);
      router.refresh();
    } catch {
      setError(t('uploadFailed'));
    } finally {
      setPending(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="relative">
        <UserAvatar name={name} avatarUrl={avatarUrl} size={size} />
        {pending ? (
          <span className="avatar-upload-overlay muted text-xs">{t('uploading')}</span>
        ) : null}
      </div>

      {canUpload ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id={`avatar-upload-${targetType}-${gymMemberId ?? userId ?? 'self'}`}
            onChange={handleFileChange}
            disabled={pending}
          />
          <label
            htmlFor={`avatar-upload-${targetType}-${gymMemberId ?? userId ?? 'self'}`}
            className="button cursor-pointer px-4 py-2 text-xs"
          >
            {avatarUrl ? t('changePhoto') : t('uploadPhoto')}
          </label>
          <p className="muted max-w-xs text-xs">{t('hint')}</p>
        </>
      ) : null}

      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
