'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

/**
 * Ürün fotoğrafı yükleme — Faz 40. Faz 6.2'deki avatar yükleme akışını
 * (`/api/v1/upload/avatar`, `targetType` ayrımlı) yeniden kullanır, yeni bir
 * yükleme mekanizması icat edilmez.
 */
export function ExpenseCategoryImageUpload({
  categoryId,
  currentUrl,
}: {
  categoryId: string;
  currentUrl?: string | null;
}) {
  const t = useTranslations('pos.store');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(currentUrl ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetType', 'expense_category');
    formData.append('categoryId', categoryId);

    try {
      const response = await fetch('/api/v1/upload/avatar', { method: 'POST', body: formData });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { avatarUrl: string };
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.data?.avatarUrl) {
        setError(payload.error ?? t('uploadError'));
        return;
      }

      setImageUrl(payload.data.avatarUrl);
      router.refresh();
    } catch {
      setError(t('uploadError'));
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        id={`category-image-upload-${categoryId}`}
        onChange={handleFileChange}
        disabled={pending}
      />
      <label
        htmlFor={`category-image-upload-${categoryId}`}
        className="button cursor-pointer px-3 py-1.5 text-xs"
      >
        {pending ? t('uploading') : imageUrl ? t('changePhoto') : t('addPhoto')}
      </label>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
