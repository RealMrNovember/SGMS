'use client';

import { useState } from 'react';

export function CopyEmailBlock({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy(text: string, kind: 'subject' | 'body') {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="muted">Alıcı:</span> {to}
        </p>
        <a href={mailto} className="button button-gold px-3 py-1.5 text-xs">
          E-posta istemcisinde aç
        </a>
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{subject}</p>
          <button
            type="button"
            className="button px-2 py-1 text-xs"
            onClick={() => copy(subject, 'subject')}
          >
            {copied === 'subject' ? 'Kopyalandı' : 'Konu'}
          </button>
        </div>
        <pre className="muted max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[rgba(0,0,0,0.25)] p-3 text-xs leading-6">
          {body}
        </pre>
        <button type="button" className="button px-3 py-1.5 text-xs" onClick={() => copy(body, 'body')}>
          {copied === 'body' ? 'Metin kopyalandı' : 'Metni kopyala'}
        </button>
      </div>
    </div>
  );
}
