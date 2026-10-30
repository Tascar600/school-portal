import { Router, Response } from 'express';
import { query, queryOne } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { sendXlsx } from '../utils/exportXlsx';
import { periodFrom, pupilBalances } from './stats';

const router = Router();
const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

// ── Daily collections (one day or any range): every receipt, and totals by method ──
async function dailyReport(from: string, to: string) {
  const payments = await query<any[]>(
    `SELECT p.id, p.receipt_no, p.pay_date, p.amount_paid, p.currency, p.amount, p.method, p.reference, p.notes, u.name AS student_name, c.name AS class_name
     FROM fee_payments p JOIN users u ON u.id = p.student_id LEFT JOIN classes c ON c.id = u.class_id
     WHERE p.pay_date >= ? AND p.pay_date <= ? AND p.status = 'active' ORDER BY p.pay_date, p.created_at`, [from, to]);
  const byMethod = await query<any[]>(
    `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM fee_payments
     WHERE pay_date >= ? AND pay_date <= ? AND status = 'active' GROUP BY method ORDER BY method`, [from, to]);
  const grandTotal = byMethod.reduce((s, m) => s + m.total, 0);
  return { from, to, date: from, byMethod, grandTotal: r2(grandTotal), payments };
}

// ── Collections by class: billed and collected in the period, plus what is owing right now ──
async function collectionsReport(from: string, to: string) {
  const classes = await query<any[]>('SELECT id, name FROM classes ORDER BY id');
  const billed = await query<any[]>(`SELECT u.class_id AS id, SUM(i.total) AS t FROM invoices i JOIN users u ON u.id = i.student_id WHERE i.status='active' AND i.inv_date >= ? AND i.inv_date <= ? GROUP BY u.class_id`, [from, to]);
  const paid = await query<any[]>(`SELECT u.class_id AS id, SUM(p.amount) AS t FROM fee_payments p JOIN users u ON u.id = p.student_id WHERE p.status='active' AND p.pay_date >= ? AND p.pay_date <= ? GROUP BY u.class_id`, [from, to]);
  const bm = new Map(billed.map((r) => [r.id, r.t])), pm = new Map(paid.map((r) => [r.id, r.t]));
  const balances = await pupilBalances();
  return classes.map((c) => {
    const b = bm.get(c.id) || 0, p = pm.get(c.id) || 0;
    const owing = balances.filter((x) => x.class_id === c.id && x.balance > 0.004);
    return {
      class_id: c.id, class_name: c.name, billed: r2(b), collected: r2(p),
      collection_rate: b > 0 ? Math.round((p / b) * 1000) / 10 : null,
      owing_now: r2(owing.reduce((s, x) => s + x.balance, 0)), pupils_owing: owing.length,
    };
  });
}

// ── Collections by fee item (payments are spread in proportion to what was billed) ──
async function feeItemsReport(from: string, to: string) {
  const totals = await queryOne<any>(
    `SELECT COALESCE((SELECT SUM(total) FROM invoices WHERE inv_date >= ? AND inv_date <= ? AND status = 'active'), 0) AS billed,
            COALESCE((SELECT SUM(amount) FROM fee_payments WHERE pay_date >= ? AND pay_date <= ? AND status = 'active'), 0) AS collected`,
    [from, to, from, to]);
  const ratio = totals.billed > 0 ? totals.collected / totals.billed : 0;
  const items = await query<any[]>(
    `SELECT COALESCE(fi.name, il.description) AS name, SUM(il.amount) AS billed FROM invoice_lines il
     JOIN invoices i ON i.id = il.invoice_id LEFT JOIN fee_items fi ON fi.id = il.fee_item_id
     WHERE i.status = 'active' AND i.inv_date >= ? AND i.inv_date <= ? GROUP BY name ORDER BY billed DESC`, [from, to]);
  return items.map((i) => ({ name: i.name, billed: r2(i.billed), collected: r2(i.billed * ratio) }));
}

// ── Debtors: every pupil who owes, largest first (optionally one class / a minimum amount) ──
async function debtorsReport(classId?: number, min = 0) {
  const rows = (await pupilBalances())
    .filter((b) => b.balance > Math.max(0.004, min) && (!classId || b.class_id === classId))
    .map((b) => ({ student_id: b.id, student_name: b.name, student_number: b.student_number, class_name: b.class_name, balance: b.balance }));
  rows.sort((a, b) => b.balance - a.balance);
  return rows;
}

// ── Aged arrears (payments are applied to the oldest bills first) ──
async function agedReport(asOf: string) {
  const students = await query<any[]>(`SELECT u.id, u.name, c.name AS class_name FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.role = 'student' ORDER BY u.name`);
  const dayMs = 86400000;
  const results: any[] = [];
  for (const s of students) {
    const invoices = await query<any[]>("SELECT total, inv_date FROM invoices WHERE student_id = ? AND status = 'active' AND inv_date <= ? ORDER BY inv_date ASC, id ASC", [s.id, asOf]);
    if (!invoices.length) continue;
    const payments = await query<any[]>("SELECT amount FROM fee_payments WHERE student_id = ? AND status = 'active' AND pay_date <= ?", [s.id, asOf]);
    let pool = payments.reduce((sum, p) => sum + p.amount, 0);
    const buckets = { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0 };
    let total = 0;
    for (const inv of invoices) {
      const applied = Math.min(pool, Math.max(inv.total, 0));
      pool -= applied;
      const unpaid = Math.round((inv.total - applied) * 100) / 100;
      if (unpaid <= 0) continue;
      const age = Math.floor((new Date(asOf).getTime() - new Date(inv.inv_date).getTime()) / dayMs);
      if (age <= 30) buckets.bucket_0_30 += unpaid;
      else if (age <= 60) buckets.bucket_31_60 += unpaid;
      else if (age <= 90) buckets.bucket_61_90 += unpaid;
      else buckets.bucket_90_plus += unpaid;
      total += unpaid;
    }
    if (total > 0) results.push({ student_id: s.id, student_name: s.name, class_name: s.class_name, ...buckets, total: Math.round(total * 100) / 100 });
  }
  results.sort((a, b) => b.total - a.total);
  return results;
}

// ── Income & expenditure for the period ──
async function incomeExpenditureReport(from: string, to: string) {
  const income = await queryOne<any>("SELECT COALESCE(SUM(amount),0) AS t FROM fee_payments WHERE pay_date >= ? AND pay_date <= ? AND status = 'active'", [from, to]);
  const expenditure = await queryOne<any>("SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE exp_date >= ? AND exp_date <= ? AND status = 'active'", [from, to]);
  const byCategory = await query<any[]>(
    `SELECT COALESCE(ec.name, 'Uncategorised') AS name, COUNT(x.id) AS count, COALESCE(SUM(x.amount),0) AS total FROM expenses x
     LEFT JOIN expense_categories ec ON ec.id = x.category_id
     WHERE x.exp_date >= ? AND x.exp_date <= ? AND x.status = 'active' GROUP BY name ORDER BY total DESC`, [from, to]);
  return { from, to, income: r2(income.t), expenditure: r2(expenditure.t), surplus: r2(income.t - expenditure.t), byCategory };
}

// ── Payment methods ──
async function methodsReport(from: string, to: string) {
  return query<any[]>(
    `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM fee_payments
     WHERE pay_date >= ? AND pay_date <= ? AND status = 'active' GROUP BY method ORDER BY total DESC`, [from, to]);
}

// ── Class list with live balances ──
async function classListReport(classId: number) {
  const students = await query<any[]>("SELECT id, name, student_number FROM users WHERE role = 'student' AND class_id = ? ORDER BY name", [classId]);
  const bal = new Map((await pupilBalances()).map((b) => [b.id, b.balance]));
  return students.map((s) => ({ ...s, balance: bal.get(s.id) ?? 0 }));
}

const REPORTS: Record<string, (req: AuthRequest) => Promise<any>> = {
  daily: (req) => { const { from, to } = periodFrom({ from: req.query.from || req.query.date || today(), to: req.query.to || req.query.date || today() }); return dailyReport(from, to); },
  collections: (req) => { const { from, to } = periodFrom(req.query); return collectionsReport(from, to); },
  'fee-items': (req) => { const { from, to } = periodFrom(req.query); return feeItemsReport(from, to); },
  debtors: (req) => debtorsReport(req.query.class_id ? Number(req.query.class_id) : undefined, req.query.min ? Number(req.query.min) : 0),
  aged: (req) => agedReport(String(req.query.asOf || req.query.to || today())),
  'income-expenditure': (req) => { const { from, to } = periodFrom(req.query); return incomeExpenditureReport(from, to); },
  methods: (req) => { const { from, to } = periodFrom(req.query); return methodsReport(from, to); },
  'class-list': (req) => classListReport(Number(req.query.class_id)),
};

for (const [name, handler] of Object.entries(REPORTS)) {
  router.get(`/${name}`, authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
    try { res.json(await handler(req)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  router.get(`/${name}/export.xlsx`, authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
    try {
      const data = await handler(req);
      const rows: any[] = Array.isArray(data) ? data : (data.rows || data.payments || data.byCategory || [data]);
      const headers = rows.length ? Object.keys(rows[0]) : ['message'];
      await sendXlsx(res, `${name}-report`, headers, rows.length ? rows : [{ message: 'No data' }]);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}

export default router;
