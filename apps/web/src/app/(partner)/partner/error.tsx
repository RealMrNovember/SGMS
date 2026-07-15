'use client';

import { ErrorBoundaryPanel } from '@/components/error-boundary-panel';

export default function PartnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryPanel error={error} reset={reset} homeHref="/partner" homeLabel="Panele Dön" />;
}
