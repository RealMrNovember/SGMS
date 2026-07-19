import { renderHelpMarkdown } from '@/lib/help/markdown';

export function HelpMarkdown({ source }: { source: string }) {
  return (
    <div
      className="help-markdown space-y-3 text-sm leading-7 text-[var(--text)]"
      dangerouslySetInnerHTML={{ __html: renderHelpMarkdown(source) }}
    />
  );
}
