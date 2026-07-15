'use client';

import Link from 'next/link';
import { useEffect } from 'react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
};

export function ErrorBoundaryPanel({ error, reset, homeHref = '/', homeLabel = 'Ana Sayfaya Dön' }: Props) {
  useEffect(() => {
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-2xl">
        !
      </span>
      <h1 className="mt-5 text-xl font-semibold">Beklenmedik bir sorun oluştu</h1>
      <p className="muted mt-3 text-sm leading-7">
        Bu ekran yüklenirken geçici bir hata oluştu — bu genellikle sistemin az önce güncellenmiş
        olmasından kaynaklanır. Lütfen tekrar deneyin; sorun devam ederse sayfayı yenileyin.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => reset()} className="button button-gold px-5 py-2.5 text-sm">
          Tekrar Dene
        </button>
        <Link href={homeHref} className="button px-5 py-2.5 text-sm">
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
