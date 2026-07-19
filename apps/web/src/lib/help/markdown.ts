/**
 * Güvenli, bağımlılıksız markdown alt kümesi (başlık, liste, kalın, link, paragraf).
 * Ham HTML girdisi kaçırılır.
 */
export function renderHelpMarkdown(source: string): string {
  const escaped = escapeHtml(source.replace(/\r\n/g, '\n').trim());
  const blocks = escaped.split(/\n{2,}/);

  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
          .join('');
        return `<ul class="help-md-list">${items}</ul>`;
      }
      if (lines.every((line) => /^\d+\.\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`)
          .join('');
        return `<ol class="help-md-list">${items}</ol>`;
      }
      const first = lines[0] ?? '';
      if (first.startsWith('### ')) {
        return `<h4 class="help-md-h4">${inline(first.slice(4))}</h4>${
          lines.length > 1 ? `<p class="help-md-p">${inline(lines.slice(1).join(' '))}</p>` : ''
        }`;
      }
      if (first.startsWith('## ')) {
        return `<h3 class="help-md-h3">${inline(first.slice(3))}</h3>${
          lines.length > 1 ? `<p class="help-md-p">${inline(lines.slice(1).join(' '))}</p>` : ''
        }`;
      }
      if (first.startsWith('# ')) {
        return `<h2 class="help-md-h2">${inline(first.slice(2))}</h2>${
          lines.length > 1 ? `<p class="help-md-p">${inline(lines.slice(1).join(' '))}</p>` : ''
        }`;
      }
      return `<p class="help-md-p">${inline(lines.join(' '))}</p>`;
    })
    .join('\n');
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text: string) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" class="help-md-a" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="help-md-code">$1</code>');
}
