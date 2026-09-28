import { query, queryOne, execute } from '../config/database';
import { nextNo } from './sequences';

export interface BillLine { fee_item_id: number | null; description: string; amount: number }

async function studentClassId(studentId: number): Promise<number | null> {
  const u = await queryOne<any>('SELECT class_id FROM users WHERE id = ?', [studentId]);
  return u?.class_id ?? null;
}

async function studentProfile(studentId: number): Promise<any> {
  return (
    (await queryOne<any>('SELECT * FROM student_profiles WHERE user_id = ?', [studentId])) || {
      user_id: studentId, category: 'day', discount_id: null, sponsor_id: null, status: 'active',
    }
  );
}

export async function ensureTermOpen(termId: number): Promise<void> {
  const term = await queryOne<any>('SELECT is_locked FROM terms WHERE id = ?', [termId]);
  if (!term) throw new Error('Term not found');
  if (term.is_locked) throw new Error('This term is locked — no changes are allowed');
}

export async function computeTermBill(studentId: number, termId: number) {
  const classId = await studentClassId(studentId);
  if (!classId) throw new Error('Student has no class assigned');
  const profile = await studentProfile(studentId);

  const structure = await query<any[]>(
    `SELECT fs.*, fi.name AS item_name, fi.is_optional FROM fee_structure fs
     JOIN fee_items fi ON fi.id = fs.fee_item_id
     WHERE fs.term_id = ? AND fs.class_id = ? AND fi.active = 1`,
    [termId, classId]
  );
  const optedIn = new Set(
    (await query<any[]>('SELECT fee_item_id FROM student_optional_items WHERE student_id = ?', [studentId])).map(
      (r: any) => r.fee_item_id
    )
  );

  const lines: BillLine[] = [];
  let gross = 0;
  for (const row of structure) {
    if (row.is_optional && !optedIn.has(row.fee_item_id)) continue;
    lines.push({ fee_item_id: row.fee_item_id, description: row.item_name, amount: row.amount });
    gross += row.amount;
  }

  let discount = 0;
  if (profile.discount_id) {
    const d = await queryOne<any>('SELECT * FROM discounts WHERE id = ? AND active = 1', [profile.discount_id]);
    if (d) {
      let base = gross;
      if (d.fee_item_id) {
        const targetLine = lines.find((l) => l.fee_item_id === d.fee_item_id);
        base = targetLine ? targetLine.amount : 0;
      }
      discount = d.type === 'percent' ? base * (d.value / 100) : Math.min(d.value, base);
      if (discount > 0) lines.push({ fee_item_id: null, description: `Less: ${d.name}`, amount: -discount });
    }
  }

  const total = gross - discount;

  let sponsorAmount = 0;
  if (profile.sponsor_id) {
    const s = await queryOne<any>('SELECT * FROM sponsors WHERE id = ? AND active = 1', [profile.sponsor_id]);
    if (s) sponsorAmount = total * (s.coverage_percent / 100);
  }

  return { lines, gross, discount, total, sponsorId: profile.sponsor_id || null, sponsorAmount };
}

export async function billStudent(studentId: number, termId: number, date: string, createdBy: number | null) {
  const already = await queryOne<any>(
    "SELECT id FROM invoices WHERE student_id = ? AND term_id = ? AND type = 'term' AND status = 'active'",
    [studentId, termId]
  );
  if (already) return { skipped: true as const, reason: 'already-billed', invoiceId: already.id };

  const bill = await computeTermBill(studentId, termId);
  if (bill.lines.length === 0) return { skipped: true as const, reason: 'no-fee-structure' };

  const invoiceNo = await nextNo('INV', 'INV');
  const { insertId } = await execute(
    `INSERT INTO invoices (invoice_no, type, student_id, term_id, inv_date, gross, discount, total, sponsor_id, sponsor_amount, created_by)
     VALUES (?, 'term', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoiceNo, studentId, termId, date, bill.gross, bill.discount, bill.total, bill.sponsorId, bill.sponsorAmount, createdBy]
  );
  for (const line of bill.lines) {
    await execute('INSERT INTO invoice_lines (invoice_id, fee_item_id, description, amount) VALUES (?, ?, ?, ?)', [
      insertId, line.fee_item_id, line.description, line.amount,
    ]);
  }
  return { skipped: false as const, invoiceId: insertId, invoiceNo, total: bill.total };
}

export async function billClass(classId: number, termId: number, date: string, createdBy: number | null) {
  const students = await query<any[]>(
    `SELECT u.id FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'student' AND u.class_id = ? AND COALESCE(sp.status, 'active') = 'active'`,
    [classId]
  );
  let billed = 0, skipped = 0;
  for (const s of students) {
    const r = await billStudent(s.id, termId, date, createdBy);
    if (r.skipped) skipped++; else billed++;
  }
  return { billed, skipped, total: students.length };
}

export async function createAdjustment(
  studentId: number,
  termId: number,
  type: 'charge' | 'credit',
  date: string,
  lines: BillLine[],
  notes: string,
  createdBy: number | null
) {
  if (!lines.length) throw new Error('At least one line item is required');
  const signed = lines.map((l) => ({ ...l, amount: type === 'credit' ? -Math.abs(l.amount) : Math.abs(l.amount) }));
  const total = signed.reduce((sum, l) => sum + l.amount, 0);
  const invoiceNo = await nextNo(type === 'credit' ? 'CN' : 'INV', type === 'credit' ? 'CN' : 'INV');
  const { insertId } = await execute(
    `INSERT INTO invoices (invoice_no, type, student_id, term_id, inv_date, gross, discount, total, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [invoiceNo, type, studentId, termId, date, total, total, notes || '', createdBy]
  );
  for (const line of signed) {
    await execute('INSERT INTO invoice_lines (invoice_id, fee_item_id, description, amount) VALUES (?, ?, ?, ?)', [
      insertId, line.fee_item_id, line.description, line.amount,
    ]);
  }
  return { invoiceId: insertId, invoiceNo, total };
}

export async function cancelInvoice(invoiceId: number, reason: string) {
  const inv = await queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!inv) throw new Error('Invoice not found');
  if (inv.status === 'cancelled') throw new Error('Invoice already cancelled');
  await execute("UPDATE invoices SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [reason, invoiceId]);
}

export async function recordPayment(p: {
  studentId: number;
  termId: number;
  payDate: string;
  amountPaid: number;
  currency: string;
  fxRate: number;
  method: 'cash' | 'bank' | 'ecocash' | 'swipe' | 'in_kind' | 'sponsor';
  reference?: string;
  accountId?: number | null;
  sponsorId?: number | null;
  notes?: string;
  receivedBy: number | null;
}) {
  if (p.amountPaid <= 0) throw new Error('Amount must be greater than zero');
  if (p.method !== 'cash' && p.reference) {
    const dup = await queryOne<any>(
      "SELECT id FROM fee_payments WHERE method = ? AND reference = ? AND status = 'active'",
      [p.method, p.reference]
    );
    if (dup) throw new Error('A payment with this reference has already been recorded for this method');
  }
  const fxRate = p.fxRate || 1;
  const amount = p.amountPaid / fxRate;
  const receiptNo = await nextNo('RC', 'RC');
  const { insertId } = await execute(
    `INSERT INTO fee_payments (receipt_no, student_id, term_id, pay_date, amount, currency, fx_rate, amount_paid, method, reference, account_id, sponsor_id, notes, received_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receiptNo, p.studentId, p.termId, p.payDate, amount, p.currency || 'USD', fxRate, p.amountPaid,
      p.method, p.reference || '', p.accountId || null, p.sponsorId || null, p.notes || '', p.receivedBy,
    ]
  );
  return { paymentId: insertId, receiptNo, amount };
}

export async function reversePayment(paymentId: number, reason: string, userId: number | null) {
  const pay = await queryOne<any>('SELECT * FROM fee_payments WHERE id = ?', [paymentId]);
  if (!pay) throw new Error('Payment not found');
  if (pay.status === 'reversed') throw new Error('Payment already reversed');
  if (!reason) throw new Error('A reversal reason is required');
  await execute(
    "UPDATE fee_payments SET status = 'reversed', reverse_reason = ?, reversed_by = ?, reversed_at = datetime('now') WHERE id = ?",
    [reason, userId, paymentId]
  );
}

// Balances are always computed live from invoices/payments — never stored — to avoid drift.
export async function studentBalance(studentId: number): Promise<number> {
  const inv = await queryOne<any>(
    "SELECT COALESCE(SUM(total),0) AS t FROM invoices WHERE student_id = ? AND status = 'active'",
    [studentId]
  );
  const pay = await queryOne<any>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM fee_payments WHERE student_id = ? AND status = 'active'",
    [studentId]
  );
  return (inv?.t || 0) - (pay?.t || 0);
}

export async function accountBalance(accountId: number, asOf?: string): Promise<number> {
  const acc = await queryOne<any>('SELECT opening_balance FROM accounts WHERE id = ?', [accountId]);
  if (!acc) throw new Error('Account not found');
  const payWhere = asOf ? "AND pay_date <= ?" : '';
  const expWhere = asOf ? "AND exp_date <= ?" : '';
  const trWhere = asOf ? "AND tr_date <= ?" : '';
  const payArgs = asOf ? [accountId, asOf] : [accountId];
  const pay = await queryOne<any>(
    `SELECT COALESCE(SUM(amount_paid),0) AS t FROM fee_payments WHERE account_id = ? AND status='active' ${payWhere}`,
    payArgs
  );
  const exp = await queryOne<any>(
    `SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE account_id = ? AND status='active' ${expWhere}`,
    payArgs
  );
  const transIn = await queryOne<any>(
    `SELECT COALESCE(SUM(amount),0) AS t FROM transfers WHERE to_account = ? ${trWhere}`,
    payArgs
  );
  const transOut = await queryOne<any>(
    `SELECT COALESCE(SUM(amount),0) AS t FROM transfers WHERE from_account = ? ${trWhere}`,
    payArgs
  );
  return (acc.opening_balance || 0) + (pay?.t || 0) - (exp?.t || 0) + (transIn?.t || 0) - (transOut?.t || 0);
}
