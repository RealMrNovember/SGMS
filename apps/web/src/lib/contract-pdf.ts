import { fillEmailTemplate } from '@/lib/admin/email-templates';
import { prisma } from '@/lib/prisma';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const NOTO_SANS_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';

let cachedFontBytes: Uint8Array | null = null;

async function loadUnicodeFont(): Promise<Uint8Array> {
  if (cachedFontBytes) {
    return cachedFontBytes;
  }
  const response = await fetch(NOTO_SANS_URL);
  if (!response.ok) {
    throw new Error('PDF font could not be loaded.');
  }
  cachedFontBytes = new Uint8Array(await response.arrayBuffer());
  return cachedFontBytes;
}

export const DEFAULT_CONTRACT_BODY = `ÜYELİK SÖZLEŞMESİ

Salon: {salonAdi}
Üye: {uyeAdi}
Plan: {planAdi}
Ücret: {fiyat}
Tarih: {tarih}

Sağlık formu / risk rıza onayı: {rizaTarihi} — {rizaKullanici}

Bu sözleşme, üyenin salon kurallarına ve sağlık beyanına uyacağını kabul ettiğini belgeler.

İmza: _________________________`;

export function fillContractTemplate(bodyText: string, vars: Record<string, string>): string {
  return fillEmailTemplate(
    { id: 'contract', category: 'onboarding', title: '', subject: '', body: bodyText },
    vars,
  ).body;
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawParagraph(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
): number {
  let y = startY;
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      y -= lineHeight;
      continue;
    }
    const lines = wrapLine(trimmed, font, size, maxWidth);
    for (const line of lines) {
      page.drawText(line, { x, y, size, font, color: rgb(0.12, 0.12, 0.14) });
      y -= lineHeight;
    }
    y -= 4;
  }

  return y;
}

export async function buildContractPdf(
  organizationId: string,
  gymMemberId: string,
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
    include: {
      plan: true,
      organization: { select: { name: true } },
      healthConsentBy: { select: { name: true, email: true } },
    },
  });

  if (!member) return null;

  let template = await prisma.contractTemplate.findFirst({
    where: { organizationId, type: 'MEMBERSHIP', isDefault: true, isActive: true },
  });

  if (!template) {
    template = await prisma.contractTemplate.create({
      data: {
        organizationId,
        name: 'Üyelik Sözleşmesi',
        type: 'MEMBERSHIP',
        bodyText: DEFAULT_CONTRACT_BODY,
        isDefault: true,
        isActive: true,
      },
    });
  }

  const locale = member.locale?.startsWith('en') ? 'en-GB' : 'tr-TR';
  const today = new Date();
  const price =
    member.plan?.price != null
      ? new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: member.plan.currency ?? 'TRY',
        }).format(Number(member.plan.price.toString()))
      : '—';

  const vars: Record<string, string> = {
    uyeAdi: `${member.firstName} ${member.lastName}`,
    planAdi: member.plan?.name ?? '—',
    tarih: today.toLocaleDateString(locale),
    fiyat: price,
    salonAdi: member.organization.name,
    rizaTarihi: member.healthConsentAcceptedAt
      ? member.healthConsentAcceptedAt.toLocaleString(locale)
      : '—',
    rizaKullanici:
      member.healthConsentBy?.name ?? member.healthConsentBy?.email ?? '—',
  };

  const body = fillContractTemplate(template.bodyText, vars);

  const fontBytes = await loadUnicodeFont();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(fontBytes);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText('SGMS', { x: margin, y, size: 10, font, color: rgb(0.5, 0.5, 0.55) });
  y -= 22;
  page.drawText(template.name, {
    x: margin,
    y,
    size: 16,
    font,
    color: rgb(0.95, 0.95, 0.97),
  });
  y -= 24;

  const maxWidth = pageWidth - margin * 2;
  const lines = body.split('\n');
  for (const rawLine of lines) {
    if (y < margin + 40) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (!rawLine.trim()) {
      y -= 14;
      continue;
    }
    const wrapped = wrapLine(rawLine, font, 11, maxWidth);
    for (const line of wrapped) {
      if (y < margin + 40) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: 11, font });
      y -= 14;
    }
  }

  if (member.healthConsentAcceptedAt) {
    y -= 8;
    if (y < margin + 60) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    const consentLine = `Sağlık rızası: ${vars.rizaTarihi} — ${vars.rizaKullanici}${member.healthConsentVersion ? ` (v${member.healthConsentVersion})` : ''}`;
    y = drawParagraph(page, font, consentLine, margin, y, maxWidth, 10, 13);
  }

  const safeName = `${member.firstName}_${member.lastName}`.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const filename = `contract_${safeName}_${today.toISOString().slice(0, 10)}.pdf`;

  return { bytes: await pdf.save(), filename };
}
