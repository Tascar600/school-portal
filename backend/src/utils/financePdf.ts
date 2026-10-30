import { Response } from 'express';
import { createBrandedDoc, letterhead, titleBar, fields, table, sectionHeading, signatureLine, stamp, finish, money, Brand } from './pdfBrand';
import { COLORS } from './branding';
import { SchoolInfo } from './settings';
import { amountInWords } from './numberToWords';

export const fmtDate = (d?: string | null) => {
  if (!d) return '-';
  const dt = new Date(String(d).length <= 10 ? d + 'T00:00:00' : String(d).replace(' ', 'T') + 'Z');
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', bank: 'Bank deposit / transfer', ecocash: 'EcoCash', swipe: 'Card / swipe (POS)', in_kind: 'In kind' };

function begin(res: Response, school: SchoolInfo, opts: { size: 'A4' | 'A5'; title: string; file: string; margin?: number; landscape?: boolean }): Brand {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${opts.file}"`);
  const b = createBrandedDoc(school, { size: opts.size, title: opts.title, margin: opts.margin, landscape: opts.landscape });
  b.doc.pipe(res);
  return b;
}

// ── Official receipt ─────────────────────────────────────────────────────────
export interface ReceiptData {
  receipt_no: string; pay_date: string; payer: string; student_name: string; student_number: string; class_name: string;
  term_label: string; method: string; reference: string; account_name: string; currency: string; amount_paid: number;
  fx_rate: number; amount_usd: number; billed_to_date: number; paid_to_date: number; balance_after: number;
  notes: string; received_by: string; status: string; reverse_reason: string;
}

export function sendReceipt(res: Response, school: SchoolInfo, r: ReceiptData, printedBy: string) {
  const b = begin(res, school, { size: 'A5', title: `Receipt ${r.receipt_no}`, file: `receipt-${r.receipt_no}.pdf`, margin: 30 });
  const { doc, W, M } = b;
  let y = letterhead(b);
  y = titleBar(b, y, 'OFFICIAL RECEIPT', `No. ${r.receipt_no}`);
  y = fields(b, y, [
    { label: 'Received from', value: r.payer || r.student_name, span: 2 },
    { label: 'Date received', value: fmtDate(r.pay_date) },
    { label: 'Pupil', value: r.student_name, span: 2 },
    { label: 'Reg. number', value: r.student_number },
    { label: 'Class', value: r.class_name },
    { label: 'Term', value: r.term_label },
    { label: 'Method', value: METHOD_LABEL[r.method] || r.method },
    { label: 'Reference / slip no.', value: r.reference || '-', span: 2 },
    { label: 'Paid into', value: r.account_name || '-' },
  ], 3);

  // The amount, in figures and in words
  y += 2;
  doc.save().roundedRect(M, y, W - 2 * M, 54, 4).lineWidth(1.2).fillAndStroke(COLORS.greenSoft, COLORS.green).restore();
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7).text('AMOUNT RECEIVED', M + 10, y + 7, { lineBreak: false });
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(21).text(`${r.currency} ${money(r.amount_paid)}`, M + 10, y + 18, { lineBreak: false });
  const words = amountInWords(r.amount_paid, r.currency === 'USD' ? 'Dollars' : r.currency === 'ZWG' ? 'ZiG' : r.currency);
  doc.fillColor(COLORS.ink).font('Helvetica-Oblique').fontSize(8.2).text(words, M + 10, y + 43, { width: W - 2 * M - 20, lineBreak: false });
  if (r.currency !== 'USD') {
    doc.fillColor(COLORS.grey).font('Helvetica').fontSize(8).text(`= USD ${money(r.amount_usd)} at ${money(r.fx_rate, 4)} ${r.currency} per USD`, M, y + 8, { width: W - 2 * M - 10, align: 'right', lineBreak: false });
  }
  y += 66;

  y = table(b, y, [
    { header: 'Account summary (USD)', width: 3 },
    { header: 'Amount', width: 1.2, align: 'right' },
  ], [
    ['Fees billed to date', money(r.billed_to_date)],
    ['Total paid to date (including this receipt)', money(r.paid_to_date)],
    [r.balance_after > 0.004 ? 'BALANCE STILL OWING' : r.balance_after < -0.004 ? 'CREDIT BALANCE (paid in advance)' : 'BALANCE — PAID UP', money(Math.abs(r.balance_after))],
  ], { boldLast: true });

  if (r.notes) {
    y = sectionHeading(b, y + 2, 'Notes');
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(r.notes, M, y, { width: W - 2 * M });
    y = doc.y + 6;
  }

  const sigY = Math.max(y + 36, b.H - 112);
  signatureLine(b, M, sigY, 130, 'Received by (name & signature)', r.received_by);
  signatureLine(b, W - M - 130, sigY, 130, 'Official school stamp');
  if (school.receipt_footer) {
    doc.fillColor(COLORS.green).font('Helvetica-Oblique').fontSize(8.2).text(school.receipt_footer, M, sigY + 20, { width: W - 2 * M, align: 'center' });
  }
  if (r.status === 'reversed') {
    stamp(b, 'REVERSED');
    doc.fillColor(COLORS.red).font('Helvetica-Bold').fontSize(8.5).text(`This receipt was reversed: ${r.reverse_reason || 'no reason recorded'}`, M, sigY - 30, { width: W - 2 * M, align: 'center' });
  }
  finish(b, printedBy);
}

// ── Invoice / charge / credit note ───────────────────────────────────────────
export interface InvoiceData {
  invoice_no: string; type: string; inv_date: string; student_name: string; student_number: string; class_name: string;
  guardian: string; term_label: string; lines: { description: string; amount: number }[]; gross: number; discount: number; total: number;
  balance: number; notes: string; status: string; cancel_reason: string;
}

export function sendInvoice(res: Response, school: SchoolInfo, i: InvoiceData, printedBy: string) {
  const b = begin(res, school, { size: 'A4', title: `${i.invoice_no}`, file: `invoice-${i.invoice_no}.pdf` });
  const { doc, W, M } = b;
  const kind = i.type === 'credit' ? 'CREDIT NOTE' : i.type === 'charge' ? 'CHARGE NOTE' : 'FEES INVOICE';
  let y = letterhead(b);
  y = titleBar(b, y, kind, `No. ${i.invoice_no}`);
  y = fields(b, y, [
    { label: 'Billed to (parent / guardian of)', value: i.student_name, span: 2 },
    { label: 'Date', value: fmtDate(i.inv_date) },
    { label: 'Guardian', value: i.guardian || '-', span: 2 },
    { label: 'Reg. number', value: i.student_number },
    { label: 'Class', value: i.class_name },
    { label: 'Term', value: i.term_label },
  ], 3);
  y += 4;
  y = table(b, y, [
    { header: '#', width: 0.4 },
    { header: 'Description', width: 5 },
    { header: 'Amount (USD)', width: 1.6, align: 'right' },
  ], i.lines.map((l, n) => [n + 1, l.description, money(l.amount)]));
  const labelX = W - M - 230;
  const rowsOut: [string, string, boolean][] = [];
  if (i.type === 'term') { rowsOut.push(['Total fees before discount', money(i.gross), false]); if (i.discount) rowsOut.push(['Discount', '- ' + money(i.discount), false]); }
  rowsOut.push([i.type === 'credit' ? 'CREDIT TOTAL' : 'INVOICE TOTAL', money(i.total), true]);
  rowsOut.push([i.balance > 0.004 ? 'Account balance owing (all terms)' : 'Account balance (all terms)', money(i.balance), false]);
  for (const [label, value, bold] of rowsOut) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10.5 : 9).fillColor(bold ? COLORS.green : COLORS.ink)
      .text(label, labelX, y, { width: 140, lineBreak: false }).text(value, labelX + 140, y, { width: 90, align: 'right', lineBreak: false });
    y += bold ? 17 : 14;
  }
  y += 10;
  if (i.notes) { y = sectionHeading(b, y, 'Notes'); doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(i.notes, M, y, { width: W - 2 * M }); y = doc.y + 8; }
  if (school.bank_details) {
    y = sectionHeading(b, y, 'How to pay');
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(school.bank_details, M, y, { width: W - 2 * M });
    y = doc.y + 8;
  }
  const sigY = Math.max(y + 40, b.H - 110);
  signatureLine(b, M, sigY, 170, 'Bursar', school.bursar_name);
  signatureLine(b, W - M - 170, sigY, 170, 'Official school stamp');
  if (i.status === 'cancelled') {
    stamp(b, 'CANCELLED');
    doc.fillColor(COLORS.red).font('Helvetica-Bold').fontSize(9).text(`Cancelled: ${i.cancel_reason || 'no reason recorded'}`, M, sigY - 30, { width: W - 2 * M, align: 'center' });
  }
  finish(b, printedBy);
}

// ── Fee statement (history of bills and payments for a period) ───────────────
export interface StatementData {
  student_name: string; student_number: string; class_name: string; guardian: string; guardian_phone: string;
  from: string; to: string; opening: number; closing: number; total_charges: number; total_payments: number;
  lines: { date: string; ref: string; description: string; charge: number; payment: number; balance: number }[];
}

export function sendStatement(res: Response, school: SchoolInfo, s: StatementData, printedBy: string) {
  const b = begin(res, school, { size: 'A4', title: `Fee statement - ${s.student_name}`, file: `statement-${s.student_number || 'pupil'}.pdf` });
  const { doc, W, M } = b;
  let y = letterhead(b);
  y = titleBar(b, y, 'STUDENT FEE STATEMENT', `${fmtDate(s.from)}  to  ${fmtDate(s.to)}`);
  y = fields(b, y, [
    { label: 'Pupil', value: s.student_name, span: 2 },
    { label: 'Reg. number', value: s.student_number },
    { label: 'Class', value: s.class_name },
    { label: 'Parent / guardian', value: s.guardian || '-' },
    { label: 'Guardian phone', value: s.guardian_phone || '-' },
  ], 3);
  y += 2;
  const rows: (string | number)[][] = [['', '', 'Balance brought forward', '', '', money(s.opening)]];
  for (const l of s.lines) rows.push([fmtDate(l.date), l.ref, l.description, l.charge ? money(l.charge) : '', l.payment ? money(l.payment) : '', money(l.balance)]);
  rows.push(['', '', 'BALANCE CARRIED FORWARD', money(s.total_charges), money(s.total_payments), money(s.closing)]);
  y = table(b, y, [
    { header: 'Date', width: 1.1 }, { header: 'Reference', width: 1.3 }, { header: 'Description', width: 3.4 },
    { header: 'Charges', width: 1.1, align: 'right' }, { header: 'Payments', width: 1.1, align: 'right' }, { header: 'Balance', width: 1.2, align: 'right' },
  ], rows, { boldLast: true });
  y += 4;
  doc.fillColor(s.closing > 0.004 ? COLORS.red : COLORS.green).font('Helvetica-Bold').fontSize(11)
    .text(s.closing > 0.004 ? `Amount owing: USD ${money(s.closing)}` : s.closing < -0.004 ? `Credit balance: USD ${money(-s.closing)}` : 'This account is fully paid up.', M, y, { width: W - 2 * M, align: 'right' });
  y = doc.y + 10;
  if (school.bank_details && s.closing > 0.004) { y = sectionHeading(b, y, 'How to pay'); doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(school.bank_details, M, y, { width: W - 2 * M }); }
  finish(b, printedBy);
}

// ── Payment voucher (expense) ────────────────────────────────────────────────
export interface VoucherData {
  voucher_no: string; exp_date: string; payee: string; description: string; category: string; account: string;
  amount: number; reference: string; created_by: string; status: string; cancel_reason: string;
}

export function sendVoucher(res: Response, school: SchoolInfo, v: VoucherData, printedBy: string) {
  const b = begin(res, school, { size: 'A5', title: `Voucher ${v.voucher_no}`, file: `voucher-${v.voucher_no}.pdf`, margin: 30 });
  const { doc, W, M } = b;
  let y = letterhead(b);
  y = titleBar(b, y, 'PAYMENT VOUCHER', `No. ${v.voucher_no}`);
  y = fields(b, y, [
    { label: 'Paid to', value: v.payee, span: 2 },
    { label: 'Date', value: fmtDate(v.exp_date) },
    { label: 'Category', value: v.category || '-' },
    { label: 'Paid from', value: v.account || '-' },
    { label: 'Reference / invoice no.', value: v.reference || '-' },
  ], 3);
  y = sectionHeading(b, y + 2, 'Being payment for');
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10).text(v.description || '-', M, y, { width: W - 2 * M });
  y = doc.y + 10;
  doc.save().roundedRect(M, y, W - 2 * M, 46, 4).lineWidth(1.2).fillAndStroke(COLORS.greenSoft, COLORS.green).restore();
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(7).text('AMOUNT PAID', M + 10, y + 6, { lineBreak: false });
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(19).text(`USD ${money(v.amount)}`, M + 10, y + 15, { lineBreak: false });
  doc.fillColor(COLORS.ink).font('Helvetica-Oblique').fontSize(8).text(amountInWords(v.amount), M + 10, y + 36, { width: W - 2 * M - 20, lineBreak: false });
  y += 62;
  const sigY = Math.max(y + 40, b.H - 105);
  signatureLine(b, M, sigY, 100, 'Prepared by', v.created_by);
  signatureLine(b, M + (W - 2 * M) / 2 - 50, sigY, 100, 'Approved by (Head)', school.headmaster);
  signatureLine(b, W - M - 100, sigY, 100, 'Received by (payee)');
  if (v.status === 'cancelled') { stamp(b, 'CANCELLED'); doc.fillColor(COLORS.red).font('Helvetica-Bold').fontSize(8.5).text(`Cancelled: ${v.cancel_reason || ''}`, M, sigY - 30, { width: W - 2 * M, align: 'center' }); }
  finish(b, printedBy);
}
