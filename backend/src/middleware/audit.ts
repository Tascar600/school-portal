import { Response, NextFunction } from 'express';
import { queryOne, execute } from '../config/database';
import { AuthRequest } from './auth';

/**
 * The Bursary audit trail. Put in front of the money routes, it writes one line to audit_log for every change that
 * succeeds (a payment received, a receipt reversed, an invoice cancelled, a fee changed ...), saying who did it and when.
 * Reading is never recorded, and a request that is refused changes nothing, so it is not recorded either.
 *
 * The lines are written here in one place instead of inside every route, so a route that is added later is still
 * caught: anything without its own rule below is recorded with a general description.
 */

interface Entry { action: string; entity: string; entityId?: number | null; studentId?: number | null; amount?: number | null; summary: string }
interface Ctx { params: Record<string, string>; in: any; out: any }

const usd = (n: number) => '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nameOf = async (id: any) => (id ? (await queryOne<any>('SELECT name FROM users WHERE id = ?', [id]))?.name : '') || 'an unknown pupil';
const termName = async (id: any) => { const t = id ? await queryOne<any>('SELECT year, term_no FROM terms WHERE id = ?', [id]) : null; return t ? `Term ${t.term_no} ${t.year}` : 'a term'; };
const className = async (id: any) => (id ? (await queryOne<any>('SELECT name FROM classes WHERE id = ?', [id]))?.name : '') || 'a class';
const accountName = async (id: any) => (id ? (await queryOne<any>('SELECT name FROM accounts WHERE id = ?', [id]))?.name : '') || 'an account';
const feeItemName = async (id: any) => (id ? (await queryOne<any>('SELECT name FROM fee_items WHERE id = ?', [id]))?.name : '') || 'a fee item';
const because = (reason?: string) => (reason ? ` Reason given: ${reason}` : '');
const METHOD: Record<string, string> = { cash: 'cash', bank: 'bank deposit or transfer', ecocash: 'EcoCash', swipe: 'card (swipe)', in_kind: 'goods in kind' };
// "$12.50", or "ZWG 299.25 ($11.25)" when it was paid in another currency
const paid = (p: any, fallback: any) => {
  const cur = p?.currency || fallback.currency || 'USD';
  return cur === 'USD' ? usd(p?.amount ?? parseFloat(fallback.amount_paid)) : `${cur} ${(p?.amount_paid ?? parseFloat(fallback.amount_paid)).toFixed(2)} (${usd(p?.amount ?? 0)})`;
};
const linesTotal = (lines: any[] = []) => Math.round(lines.reduce((t, l) => t + (parseFloat(l.amount) || 0), 0) * 100) / 100;
const idOf = (c: Ctx) => Number(c.params.id) || null;
// A rule that only needs a label: what the route itself said ("Voucher EX-12 cancelled") is the description
const plain = (action: string, entity: string, id: (c: Ctx) => number | null = idOf) => (c: Ctx): Entry => ({ action, entity, entityId: id(c), summary: String(c.out?.message || action) });

const RULES: Record<string, (c: Ctx) => Promise<Entry | null> | Entry | null> = {
  'POST /payments': async (c) => {
    const p = await queryOne<any>('SELECT * FROM fee_payments WHERE id = ?', [c.out?.paymentId]);
    return { action: 'Received payment', entity: 'payment', entityId: p?.id, studentId: c.in.student_id, amount: p?.amount,
      summary: `Receipt ${p?.receipt_no || c.out?.receiptNo} from ${await nameOf(c.in.student_id)}: ${paid(p, c.in)}, paid by ${METHOD[p?.method || c.in.method] || p?.method || c.in.method}.` };
  },
  'PUT /payments/:id/reverse': async (c) => {
    const p = await queryOne<any>('SELECT * FROM fee_payments WHERE id = ?', [idOf(c)]);
    return { action: 'Reversed receipt', entity: 'payment', entityId: idOf(c), studentId: p?.student_id, amount: p?.amount,
      summary: `Receipt ${p?.receipt_no} for ${await nameOf(p?.student_id)} (${usd(p?.amount ?? 0)}) was reversed.${because(c.in.reason)}` };
  },
  'PUT /invoices/:id/cancel': async (c) => {
    const i = await queryOne<any>('SELECT * FROM invoices WHERE id = ?', [idOf(c)]);
    return { action: 'Cancelled invoice', entity: 'invoice', entityId: idOf(c), studentId: i?.student_id, amount: i?.total,
      summary: `${i?.invoice_no} for ${await nameOf(i?.student_id)} (${usd(i?.total ?? 0)}) was cancelled.${because(c.in.reason)}` };
  },
  'POST /billing/run': async (c) => ({ action: 'Billed fees', entity: 'invoice', summary: `${await termName(c.in.term_id)}${c.in.class_id ? `, ${await className(c.in.class_id)}` : ', all classes'}: ${c.out?.message || 'billing run'}` }),
  'POST /billing/charge': async (c) => ({ action: 'Added a charge', entity: 'invoice', studentId: c.in.student_id, amount: linesTotal(c.in.lines), summary: `${c.out?.invoiceNo || 'Charge'} for ${await nameOf(c.in.student_id)}: ${(c.in.lines || []).map((l: any) => `${l.description} ${usd(parseFloat(l.amount))}`).join(', ')}` }),
  'POST /billing/credit-note': async (c) => ({ action: 'Issued a credit note', entity: 'invoice', studentId: c.in.student_id, amount: linesTotal(c.in.lines), summary: `${c.out?.invoiceNo || 'Credit note'} for ${await nameOf(c.in.student_id)}: ${(c.in.lines || []).map((l: any) => `${l.description} ${usd(parseFloat(l.amount))}`).join(', ')}` }),

  'POST /expenses': (c) => ({ action: 'Recorded expense', entity: 'expense', entityId: c.out?.id, amount: parseFloat(c.in.amount) || null, summary: `${c.out?.voucher_no || 'Voucher'}: ${usd(parseFloat(c.in.amount))} to ${c.in.payee || 'unknown payee'}${c.in.description ? ` for ${c.in.description}` : ''}.` }),
  'PUT /expenses/:id/cancel': async (c) => {
    const x = await queryOne<any>('SELECT * FROM expenses WHERE id = ?', [idOf(c)]);
    return { action: 'Cancelled expense voucher', entity: 'expense', entityId: idOf(c), amount: x?.amount, summary: `${x?.voucher_no} (${usd(x?.amount ?? 0)} to ${x?.payee}) was cancelled.${because(c.in.reason)}` };
  },
  'POST /expense-categories': plain('Added expense category', 'expense_category', (c) => c.out?.id ?? null),
  'PUT /expense-categories/:id': plain('Changed expense category', 'expense_category'),
  'DELETE /expense-categories/:id': plain('Removed expense category', 'expense_category'),

  'POST /accounts': (c) => ({ action: 'Added cash or bank account', entity: 'account', entityId: c.out?.id, summary: `${c.in.name} (${c.in.type || 'account'}, ${c.in.currency || 'USD'}), opening balance ${usd(parseFloat(c.in.opening_balance) || 0)}.` }),
  'PUT /accounts/:id': async (c) => ({ action: 'Changed account', entity: 'account', entityId: idOf(c), summary: `${await accountName(idOf(c))} was changed.` }),
  'DELETE /accounts/:id': async (c) => ({ action: 'Deactivated account', entity: 'account', entityId: idOf(c), summary: `${await accountName(idOf(c))} was deactivated.` }),
  'POST /accounts/transfer': async (c) => ({ action: 'Transferred money', entity: 'transfer', entityId: c.out?.id, amount: parseFloat(c.in.amount) || null, summary: `${usd(parseFloat(c.in.amount))} from ${await accountName(c.in.from_account)} to ${await accountName(c.in.to_account)}.` }),
  'DELETE /accounts/transfer/:id': plain('Deleted a transfer', 'transfer'),

  'POST /terms': (c) => ({ action: 'Added a term', entity: 'term', entityId: c.out?.id, summary: `Term ${c.in.term_no} ${c.in.year}, ${c.in.start_date || '?'} to ${c.in.end_date || '?'}.` }),
  'PUT /terms/:id': async (c) => ({ action: 'Changed term dates', entity: 'term', entityId: idOf(c), summary: `${await termName(idOf(c))} now runs ${c.in.start_date || '?'} to ${c.in.end_date || '?'}.` }),
  'PUT /terms/:id/set-current': async (c) => ({ action: 'Set current term', entity: 'term', entityId: idOf(c), summary: `${await termName(idOf(c))} is now the current term.` }),
  'PUT /terms/:id/lock': async (c) => ({ action: c.in.locked ? 'Locked a term' : 'Unlocked a term', entity: 'term', entityId: idOf(c), summary: `${await termName(idOf(c))} was ${c.in.locked ? 'locked: no more bills or payments can be added to it' : 'unlocked'}.` }),

  'POST /fee-items': (c) => ({ action: 'Added fee item', entity: 'fee_item', entityId: c.out?.id, summary: `${c.in.name}${c.in.is_optional ? ' (optional)' : ''}.` }),
  'PUT /fee-items/:id': async (c) => ({ action: 'Changed fee item', entity: 'fee_item', entityId: idOf(c), summary: `${await feeItemName(idOf(c))} was changed.` }),
  'DELETE /fee-items/:id': plain('Removed fee item', 'fee_item'),
  'PUT /fee-items/structure/:termId/:classId/:feeItemId': async (c) => ({ action: 'Set a fee', entity: 'fee_structure', amount: parseFloat(c.in.amount), summary: `${await feeItemName(c.params.feeItemId)} for ${await className(c.params.classId)}, ${await termName(c.params.termId)}: now ${usd(parseFloat(c.in.amount))}.` }),
  'POST /fee-items/structure/:fromTermId/copy-to/:toTermId': async (c) => ({ action: 'Copied the fee structure', entity: 'fee_structure', summary: `${await termName(c.params.fromTermId)} copied to ${await termName(c.params.toTermId)}${c.in.percentChange ? ` with ${c.in.percentChange}% change` : ''}.` }),

  'POST /currencies': (c) => ({ action: 'Added currency', entity: 'currency', summary: `${c.in.code} at ${c.in.rate} per US dollar.` }),
  'PUT /currencies/:code': (c) => ({ action: 'Changed exchange rate', entity: 'currency', summary: `${c.params.code}: ${c.in.rate !== undefined ? `rate is now ${c.in.rate} per US dollar` : 'changed'}${c.in.active === false ? ' (switched off)' : ''}.` }),

  'POST /discounts': plain('Added discount', 'discount', (c) => c.out?.id ?? null),
  'PUT /discounts/:id': plain('Changed discount', 'discount'),
  'DELETE /discounts/:id': plain('Removed discount', 'discount'),

  'PUT /student-profiles/:studentId': async (c) => ({ action: 'Updated pupil fee details', entity: 'student_profile', entityId: Number(c.params.studentId), studentId: Number(c.params.studentId), summary: `Guardian, fee category or discount changed for ${await nameOf(c.params.studentId)}.` }),

  'POST /messages': async (c) => ({ action: 'Prepared fee reminder', entity: 'message', studentId: c.in.student_id, summary: `For the guardian of ${await nameOf(c.in.student_id)}.` }),
  'POST /messages/bulk-reminder': plain('Prepared fee reminders', 'message'),
  'POST /messages/:id/send-sms': async (c) => ({ action: 'Sent fee reminder by SMS', entity: 'message', entityId: idOf(c), summary: 'A fee reminder text message was sent to a guardian.' }),
  'POST /messages/send-sms-batch': (c) => ({ action: 'Sent fee reminders by SMS', entity: 'message', summary: `${c.out?.sent ?? 0} text message(s) sent, ${c.out?.failed ?? 0} could not be sent.` }),
  'PUT /messages/:id/sent': () => null, // only marks a reminder as sent; the line above already records it

  'POST /finance-students/import/preview': () => null, // looks at the file, changes nothing
  'POST /finance-students/import/confirm': plain('Imported pupils', 'student'),
  'POST /finance-students/promote': plain('Promoted pupils to the next class', 'student'),
};

// Request details worth keeping, minus anything secret or very long (a scanned slip, for instance)
function safe(body: any): string {
  if (!body || typeof body !== 'object') return '';
  const out: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (/pass|token|secret|attachment/i.test(k)) continue;
    out[k] = typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v;
  }
  const text = JSON.stringify(out);
  return text.length > 1500 ? text.slice(0, 1500) + '…' : text;
}

export function auditTrail(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') { next(); return; }

  // What the route knew when it answered: who asked, which route matched, and what it sent back
  let snap: { params: Record<string, string>; route: string; base: string; out: any; userId?: number; role?: string } | null = null;
  const send = res.json.bind(res);
  res.json = (body?: any) => {
    snap = { params: { ...req.params }, route: String(req.route?.path ?? ''), base: req.baseUrl, out: body, userId: req.user?.id, role: req.user?.role };
    return send(body);
  };

  res.on('finish', () => {
    if (!snap || res.statusCode >= 400 || !snap.userId) return;
    const s = snap;
    const key = `${req.method} ${s.base.replace(/^\/api/, '')}${s.route === '/' ? '' : s.route}`;
    void (async () => {
      try {
        const ctx: Ctx = { params: s.params, in: req.body || {}, out: s.out };
        const rule = RULES[key];
        const entry = rule ? await rule(ctx) : { action: 'Changed records', entity: 'other', summary: `${key}${s.out?.message ? ': ' + s.out.message : ''}` } as Entry;
        if (!entry) return;
        const who = await queryOne<any>('SELECT name FROM users WHERE id = ?', [s.userId]);
        await execute(
          `INSERT INTO audit_log (user_id, user_name, user_role, action, entity, entity_id, student_id, amount, summary, details) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [s.userId, who?.name || '', s.role || '', entry.action, entry.entity, entry.entityId ?? null, entry.studentId ?? null, entry.amount ?? null, entry.summary, safe(req.body)]
        );
      } catch (err) { console.error('Audit trail could not be written:', err); }
    })();
  });
  next();
}
