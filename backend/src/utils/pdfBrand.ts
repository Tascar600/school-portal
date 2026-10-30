import PDFDocument from 'pdfkit';
import { COLORS, logoPath } from './branding';
import { SchoolInfo } from './settings';

// Shared look for every PDF the portal produces: school letterhead, a double page border in the school
// colours, the crest as a watermark, and "Page X of Y" in the footer.

export type Doc = InstanceType<typeof PDFDocument>;

export interface Brand {
  doc: Doc;
  school: SchoolInfo;
  logo: string;
  W: number;
  H: number;
  M: number; // content margin
}

const A4: [number, number] = [595.28, 841.89];
const A5: [number, number] = [419.53, 595.28];

export const money = (n: number, dp = 2) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function createBrandedDoc(
  school: SchoolInfo,
  opts: { size?: 'A4' | 'A5'; landscape?: boolean; title: string; margin?: number; watermark?: boolean }
): Brand {
  const base = opts.size === 'A5' ? A5 : A4;
  const size: [number, number] = opts.landscape ? [base[1], base[0]] : base;
  const M = opts.margin ?? 40;
  const doc = new PDFDocument({
    size, margin: M, bufferPages: true,
    info: { Title: opts.title, Author: school.full_name, Creator: `${school.name} portal` },
  });
  const brand: Brand = { doc, school, logo: logoPath('full'), W: size[0], H: size[1], M };
  const dress = () => drawFrame(brand, opts.watermark !== false);
  dress();
  doc.on('pageAdded', dress);
  return brand;
}

// Border (green outside, gold inside) and the crest watermark. Drawn first on every page, so content sits on top.
function drawFrame(b: Brand, watermark: boolean) {
  const { doc, W, H } = b;
  doc.save();
  if (watermark) {
    try {
      const w = Math.min(W, H) * 0.62;
      doc.opacity(0.07).image(b.logo, (W - w) / 2, (H - w * 0.88) / 2, { width: w });
    } catch { /* a missing logo must never stop a receipt from printing */ }
    doc.opacity(1);
  }
  doc.lineWidth(2.2).strokeColor(COLORS.green).rect(12, 12, W - 24, H - 24).stroke();
  doc.lineWidth(0.8).strokeColor(COLORS.gold).rect(17, 17, W - 34, H - 34).stroke();
  doc.restore();
  doc.x = b.M; doc.y = b.M;
}

// School name, crest and contact line across the top. Returns the y where the page body can start.
export function letterhead(b: Brand, compact = false): number {
  const { doc, school, W, M } = b;
  const top = 30;
  const logoH = compact ? 44 : 58;
  try { doc.image(b.logo, M, top, { height: logoH }); } catch { /* ignore */ }
  const textX = M + logoH * 1.15 + 10;
  const textW = W - M - textX;
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(compact ? 13.5 : 16.5)
    .text(school.full_name, textX, top + 1, { width: textW, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(8.2)
    .text([school.district, school.province, school.country].filter(Boolean).join('  ·  '), textX, top + (compact ? 19 : 23), { width: textW, align: 'center', lineBreak: false });
  const contact = [school.po_box && `P.O. Box ${school.po_box}`, school.address, school.phone && `Tel: ${school.phone}`, school.email].filter(Boolean).join('   |   ');
  let y = top + (compact ? 30 : 35);
  if (contact) { doc.fontSize(7.8).text(contact, textX, y, { width: textW, align: 'center', lineBreak: false }); y += 11; }
  if (!compact && school.motto) {
    doc.fillColor(COLORS.gold).font('Helvetica-Oblique').fontSize(9.5).text(`“${school.motto}”`, textX, y, { width: textW, align: 'center', lineBreak: false });
  }
  const ruleY = top + logoH + 8;
  doc.lineWidth(2).strokeColor(COLORS.green).moveTo(M, ruleY).lineTo(W - M, ruleY).stroke();
  doc.lineWidth(0.7).strokeColor(COLORS.gold).moveTo(M, ruleY + 3.2).lineTo(W - M, ruleY + 3.2).stroke();
  return ruleY + 12;
}

// Green banner with the document title (and a reference on the right)
export function titleBar(b: Brand, y: number, title: string, right?: string): number {
  const { doc, W, M } = b;
  doc.save().roundedRect(M, y, W - 2 * M, 22, 3).fill(COLORS.green).restore();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11.5).text(title, M + 10, y + 6, { lineBreak: false });
  if (right) doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10.5).text(right, M, y + 6.5, { width: W - 2 * M - 10, align: 'right', lineBreak: false });
  return y + 32;
}

// Small label above a bold value, laid out in columns
export function fields(b: Brand, y: number, items: { label: string; value: string; span?: number }[], perRow = 3): number {
  const { doc, W, M } = b;
  const full = W - 2 * M;
  const colW = full / perRow;
  let col = 0, rowY = y, rowMax = 0;
  for (const it of items) {
    const span = Math.min(perRow, Math.max(1, it.span ?? 1));
    if (col + span > perRow) { col = 0; rowY += rowMax; rowMax = 0; }
    const x = M + col * colW;
    const w = colW * span - 8;
    doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7).text(it.label.toUpperCase(), x, rowY, { width: w, lineBreak: false });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9.5);
    const h = doc.heightOfString(it.value || '-', { width: w });
    doc.text(it.value || '-', x, rowY + 9.5, { width: w });
    rowMax = Math.max(rowMax, 9.5 + h + 7);
    col += span;
    if (col >= perRow) { col = 0; rowY += rowMax; rowMax = 0; }
  }
  return rowY + rowMax + (col ? 0 : 0);
}

export interface Col { header: string; width: number; align?: 'left' | 'right' | 'center' }

// Table with a green header, zebra rows and automatic page breaks (the header repeats on each page).
export function table(b: Brand, y: number, cols: Col[], rows: (string | number)[][], opts: { fontSize?: number; boldLast?: boolean } = {}): number {
  const { doc, W, H, M } = b;
  const fs = opts.fontSize ?? 8.6;
  const total = cols.reduce((s, c) => s + c.width, 0);
  const scale = (W - 2 * M) / total;
  const widths = cols.map((c) => c.width * scale);
  const bottom = H - 46;

  const header = (yy: number) => {
    doc.save().rect(M, yy, W - 2 * M, 17).fill(COLORS.greenDark).restore();
    let x = M;
    cols.forEach((c, i) => {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(fs - 0.3).text(c.header, x + 4, yy + 5, { width: widths[i] - 8, align: c.align || 'left', lineBreak: false });
      x += widths[i];
    });
    return yy + 17;
  };

  y = header(y);
  rows.forEach((row, r) => {
    doc.font('Helvetica').fontSize(fs);
    const heights = row.map((cell, i) => doc.heightOfString(String(cell ?? ''), { width: widths[i] - 8 }));
    const h = Math.max(15, Math.max(...heights) + 7);
    if (y + h > bottom) { doc.addPage(); y = header(letterheadOffset(b)); }
    if (r % 2 === 0) doc.save().rect(M, y, W - 2 * M, h).fill(COLORS.cream).restore();
    const last = opts.boldLast && r === rows.length - 1;
    doc.fillColor(COLORS.ink).font(last ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
    let x = M;
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), x + 4, y + 3.5, { width: widths[i] - 8, align: cols[i].align || 'left' });
      x += widths[i];
    });
    y += h;
  });
  doc.lineWidth(0.6).strokeColor(COLORS.line).moveTo(M, y).lineTo(W - M, y).stroke();
  return y + 6;
}

// Pages after the first start under a thin version of the letterhead
function letterheadOffset(b: Brand): number {
  return letterhead(b, true) + 4;
}

export function sectionHeading(b: Brand, y: number, text: string): number {
  const { doc, W, M } = b;
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(10).text(text.toUpperCase(), M, y, { lineBreak: false });
  doc.lineWidth(0.8).strokeColor(COLORS.gold).moveTo(M, y + 13).lineTo(W - M, y + 13).stroke();
  return y + 20;
}

export function signatureLine(b: Brand, x: number, y: number, width: number, label: string, name?: string) {
  const { doc } = b;
  if (name) doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8.5).text(name, x, y - 12, { width, align: 'center', lineBreak: false });
  doc.lineWidth(0.6).strokeColor(COLORS.grey).moveTo(x, y).lineTo(x + width, y).stroke();
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7.5).text(label, x, y + 3, { width, align: 'center', lineBreak: false });
}

// Big diagonal word across the page (CANCELLED, REVERSED, PAID ...)
export function stamp(b: Brand, text: string, color = COLORS.red) {
  const { doc, W, H } = b;
  doc.save();
  doc.rotate(-28, { origin: [W / 2, H / 2] });
  doc.opacity(0.18).fillColor(color).font('Helvetica-Bold').fontSize(Math.min(W, H) * 0.16);
  const w = doc.widthOfString(text);
  doc.text(text, (W - w) / 2, H / 2 - 30, { lineBreak: false });
  doc.restore();
}

// Footer on every page, then close the document.
export function finish(b: Brand, generatedBy?: string) {
  const { doc, W, H, M, school } = b;
  const range = doc.bufferedPageRange();
  const stampText = `Printed ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}${generatedBy ? ` by ${generatedBy}` : ''}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // text in the bottom margin would otherwise add a blank page
    doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7.2);
    doc.text(`${school.full_name}  ·  ${stampText}`, M, H - 31, { width: W - 2 * M - 70, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, W - M - 70, H - 31, { width: 70, align: 'right', lineBreak: false });
    doc.page.margins.bottom = keep;
  }
  doc.end();
}
