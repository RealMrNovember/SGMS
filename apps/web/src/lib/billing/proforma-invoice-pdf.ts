import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';

const NOTO_SANS_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
const NOTO_SANS_BOLD_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

let cachedRegular: Uint8Array | null = null;
let cachedBold: Uint8Array | null = null;

async function loadFont(url: string, cache: Uint8Array | null): Promise<Uint8Array> {
  if (cache) return cache;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('PDF font could not be loaded.');
  }
  return new Uint8Array(await response.arrayBuffer());
}

// CiCiByte "Quiet Luxury" marka paleti (bkz. apps/web/src/app/globals.css)
const GOLD = rgb(0.788, 0.663, 0.384); // #c9a962
const GOLD_DARK = rgb(0.043, 0.071, 0.125); // #0b1220
const CYAN = rgb(0.055, 0.647, 0.914); // #0ea5e9
const INK = rgb(0.05, 0.07, 0.11);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.85, 0.88);

export type ProformaInvoiceData = {
  invoiceNo: string;
  issuedAt: Date;
  organizationName: string;
  organizationEmail: string | null;
  planName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: string;
  paymentMethodLabel: string;
  bankTransfer?: {
    ibanHolderName: string | null;
    ibanNumber: string | null;
    ibanBankName: string | null;
  } | null;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date) {
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** logo.svg'deki altıgen rozeti pdf-lib çizim primitifleriyle sadeleştirilmiş biçimde yeniden üretir. */
function drawHexBadge(page: PDFPage, cx: number, cy: number, r: number) {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  for (let i = 0; i < 6; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % 6]!;
    page.drawLine({ start: a, end: b, thickness: 1.6, color: GOLD });
  }
}

export async function buildProformaInvoicePdf(
  data: ProformaInvoiceData,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const [regularBytes, boldBytes] = await Promise.all([
    loadFont(NOTO_SANS_URL, cachedRegular),
    loadFont(NOTO_SANS_BOLD_URL, cachedBold),
  ]);
  cachedRegular = regularBytes;
  cachedBold = boldBytes;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(regularBytes);
  const bold = await pdf.embedFont(boldBytes);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 56;
  const page = pdf.addPage([pageWidth, pageHeight]);

  // Header band
  page.drawRectangle({ x: 0, y: pageHeight - 130, width: pageWidth, height: 130, color: GOLD_DARK });
  page.drawRectangle({ x: 0, y: pageHeight - 132, width: pageWidth, height: 2, color: GOLD });
  drawHexBadge(page, margin + 14, pageHeight - 65, 16);
  page.drawText('SGMS', {
    x: margin + 40,
    y: pageHeight - 72,
    size: 16,
    font: bold,
    color: GOLD,
  });
  page.drawText('PROFORMA FATURA', {
    x: pageWidth - margin - 190,
    y: pageHeight - 58,
    size: 18,
    font: bold,
    color: rgb(0.97, 0.97, 0.98),
  });
  page.drawText('Bu belge resmi bir fatura değildir — yalnızca ödeme bilgilendirmesidir.', {
    x: pageWidth - margin - 260,
    y: pageHeight - 78,
    size: 8,
    font,
    color: rgb(0.75, 0.75, 0.8),
  });
  page.drawText(`Belge No: ${data.invoiceNo}`, {
    x: pageWidth - margin - 190,
    y: pageHeight - 100,
    size: 9,
    font,
    color: rgb(0.8, 0.8, 0.85),
  });
  page.drawText(`Tarih: ${formatDate(data.issuedAt)}`, {
    x: pageWidth - margin - 190,
    y: pageHeight - 114,
    size: 9,
    font,
    color: rgb(0.8, 0.8, 0.85),
  });

  let y = pageHeight - 170;

  page.drawText('MÜŞTERİ', { x: margin, y, size: 9, font: bold, color: MUTED });
  y -= 16;
  page.drawText(data.organizationName, { x: margin, y, size: 13, font: bold, color: INK });
  y -= 16;
  if (data.organizationEmail) {
    page.drawText(data.organizationEmail, { x: margin, y, size: 10, font, color: MUTED });
    y -= 16;
  }

  y -= 20;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: LINE });
  y -= 28;

  // Line item table
  const col1 = margin;
  const col2 = pageWidth - margin - 200;
  const col3 = pageWidth - margin - 90;

  page.drawText('AÇIKLAMA', { x: col1, y, size: 9, font: bold, color: MUTED });
  page.drawText('DÖNEM', { x: col2, y, size: 9, font: bold, color: MUTED });
  page.drawText('TUTAR', { x: col3, y, size: 9, font: bold, color: MUTED });
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: LINE });
  y -= 24;

  page.drawText(`SGMS — ${data.planName} Aboneliği`, { x: col1, y, size: 11, font, color: INK });
  page.drawText(data.billingCycle === 'YEARLY' ? 'Yıllık' : 'Aylık', { x: col2, y, size: 11, font, color: INK });
  page.drawText(formatMoney(data.amount, data.currency), { x: col3, y, size: 11, font: bold, color: INK });
  y -= 30;

  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: LINE });
  y -= 30;

  page.drawRectangle({
    x: col2 - 10,
    y: y - 6,
    width: pageWidth - margin - col2 + 10,
    height: 26,
    color: rgb(0.97, 0.95, 0.89),
    opacity: 0.6,
  });
  page.drawText('TOPLAM', { x: col2, y, size: 12, font: bold, color: INK });
  page.drawText(formatMoney(data.amount, data.currency), {
    x: col3,
    y,
    size: 14,
    font: bold,
    color: rgb(0.53, 0.42, 0.15),
  });

  y -= 50;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: CYAN });
  y -= 26;

  page.drawText('ÖDEME YÖNTEMİ', { x: margin, y, size: 9, font: bold, color: MUTED });
  y -= 16;
  page.drawText(data.paymentMethodLabel, { x: margin, y, size: 11, font, color: INK });
  y -= 24;

  if (data.bankTransfer) {
    page.drawText('Banka Havalesi / EFT Bilgileri', { x: margin, y, size: 10, font: bold, color: INK });
    y -= 16;
    if (data.bankTransfer.ibanHolderName) {
      page.drawText(`Hesap sahibi: ${data.bankTransfer.ibanHolderName}`, { x: margin, y, size: 9, font, color: MUTED });
      y -= 14;
    }
    if (data.bankTransfer.ibanNumber) {
      page.drawText(`IBAN: ${data.bankTransfer.ibanNumber}`, { x: margin, y, size: 9, font, color: MUTED });
      y -= 14;
    }
    if (data.bankTransfer.ibanBankName) {
      page.drawText(`Banka: ${data.bankTransfer.ibanBankName}`, { x: margin, y, size: 9, font, color: MUTED });
      y -= 14;
    }
  }

  page.drawText(
    'CiCiByte SGMS · sgms.cicibyte.com — Bu belge otomatik oluşturulmuştur ve resmi/vergisel bir fatura yerine geçmez.',
    { x: margin, y: 40, size: 8, font, color: MUTED },
  );

  const filename = `proforma_${data.invoiceNo}.pdf`;
  return { bytes: await pdf.save(), filename };
}
