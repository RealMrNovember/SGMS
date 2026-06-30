import type { MemberStatementData } from '@/lib/member-statement';
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

function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date, locale: string) {
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function drawLine(page: PDFPage, y: number, margin: number, width: number) {
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.78),
  });
}

function drawTableHeader(
  page: PDFPage,
  font: PDFFont,
  y: number,
  labels: string[],
  cols: number[],
  margin: number,
) {
  let x = margin;
  for (let i = 0; i < labels.length; i += 1) {
    page.drawText(labels[i]!, {
      x,
      y,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.5),
    });
    x += cols[i]!;
  }
}

function truncate(text: string, max = 42): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

type StatementLabels = {
  title: string;
  organization: string;
  member: string;
  memberId: string;
  currency: string;
  openBalance: string;
  generatedAt: string;
  charges: string;
  payments: string;
  colDate: string;
  colDescription: string;
  colAmount: string;
  colStatus: string;
  emptyCharges: string;
  emptyPayments: string;
};

const LABELS_TR: StatementLabels = {
  title: 'Üye Cari Ekstre',
  organization: 'Salon',
  member: 'Üye',
  memberId: 'Üye No',
  currency: 'Para Birimi',
  openBalance: 'Açık Bakiye',
  generatedAt: 'Oluşturulma',
  charges: 'Borç / Harcamalar',
  payments: 'Tahsilatlar',
  colDate: 'Tarih',
  colDescription: 'Açıklama',
  colAmount: 'Tutar',
  colStatus: 'Durum',
  emptyCharges: 'Kayıtlı harcama yok.',
  emptyPayments: 'Kayıtlı tahsilat yok.',
};

const LABELS_EN: StatementLabels = {
  title: 'Member Account Statement',
  organization: 'Gym',
  member: 'Member',
  memberId: 'Member ID',
  currency: 'Currency',
  openBalance: 'Open Balance',
  generatedAt: 'Generated',
  charges: 'Charges',
  payments: 'Payments',
  colDate: 'Date',
  colDescription: 'Description',
  colAmount: 'Amount',
  colStatus: 'Status',
  emptyCharges: 'No charges recorded.',
  emptyPayments: 'No payments recorded.',
};

function labelsForLocale(locale: string): StatementLabels {
  return locale.startsWith('tr') ? LABELS_TR : LABELS_EN;
}

export async function buildMemberStatementPdf(
  data: MemberStatementData,
  locale = 'tr-TR',
): Promise<{ bytes: Uint8Array; filename: string }> {
  const labels = labelsForLocale(locale);
  const fontBytes = await loadUnicodeFont();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(fontBytes);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const draw = (text: string, size: number, color = rgb(0.12, 0.12, 0.14)) => {
    if (y < margin + 40) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(text, { x: margin, y, size, font, color });
    y -= size + 8;
  };

  draw('SGMS', 10, rgb(0.5, 0.5, 0.55));
  draw(labels.title, 18, rgb(0.95, 0.95, 0.97));
  y -= 4;
  drawLine(page, y, margin, pageWidth);
  y -= 18;

  draw(`${labels.organization}: ${data.organizationName}`, 11);
  draw(`${labels.member}: ${data.memberName}`, 11);
  draw(`${labels.memberId}: ${data.memberId}`, 10, rgb(0.45, 0.45, 0.5));
  draw(`${labels.currency}: ${data.currency}`, 10, rgb(0.45, 0.45, 0.5));
  draw(`${labels.generatedAt}: ${formatDate(data.generatedAt, locale)}`, 10, rgb(0.45, 0.45, 0.5));
  y -= 6;
  draw(
    `${labels.openBalance}: ${formatMoney(data.openBalance, data.currency, locale)}`,
    14,
    rgb(0.92, 0.75, 0.35),
  );
  y -= 10;

  const colWidths = [95, 230, 80, 70];
  const drawSection = (title: string, rows: MemberStatementData['charges'], emptyText: string) => {
    draw(title, 12, rgb(0.85, 0.85, 0.9));
    y -= 4;
    drawTableHeader(
      page,
      font,
      y,
      [labels.colDate, labels.colDescription, labels.colAmount, labels.colStatus],
      colWidths,
      margin,
    );
    y -= 14;
    drawLine(page, y, margin, pageWidth);
    y -= 12;

    if (rows.length === 0) {
      draw(emptyText, 10, rgb(0.55, 0.55, 0.6));
      y -= 8;
      return;
    }

    for (const row of rows) {
      if (y < margin + 30) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(formatDate(row.date, locale).slice(0, 16), {
        x: margin,
        y,
        size: 9,
        font,
      });
      page.drawText(truncate(row.description), {
        x: margin + colWidths[0]!,
        y,
        size: 9,
        font,
      });
      page.drawText(formatMoney(row.amount, data.currency, locale), {
        x: margin + colWidths[0]! + colWidths[1]!,
        y,
        size: 9,
        font,
      });
      page.drawText(truncate(row.status ?? row.paymentMethod ?? '—', 12), {
        x: margin + colWidths[0]! + colWidths[1]! + colWidths[2]!,
        y,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.55),
      });
      y -= 16;
    }
    y -= 8;
  };

  drawSection(labels.charges, data.charges, labels.emptyCharges);
  drawSection(labels.payments, data.payments, labels.emptyPayments);

  const safeName = data.memberName.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const filename = `statement_${safeName}_${data.generatedAt.toISOString().slice(0, 10)}.pdf`;

  return { bytes: await pdf.save(), filename };
}
