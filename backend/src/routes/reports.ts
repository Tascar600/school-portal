import { Router, Response } from 'express';
import { query, queryOne } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { studentBalance } from '../utils/finance';
import { sendXlsx } from '../utils/exportXlsx';

const router = Router();

// ── Daily collections ────────────────────────────────
async function dailyReport(date: string) {
  const payments = await query<any[]>(
    `SELECT p.*, u.name AS student_name FROM fee_payments p JOIN users u ON u.id = p.student_id
     WHERE p.pay_date = ? AND p.status = 'active' ORDER BY p.created_at`,
    [date]
  );
  const byMethod = await query<any[]>(
    `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount_paid),0) AS total FROM fee_payments
     WHERE pay_date = ? AND status = 'active' GROUP BY method ORDER BY method`,
    [date]
  );
  const grandTotal = byMethod.reduce((s, m) => s + m.total, 0);
  return { date, byMethod, grandTotal, payments };
}

// ── Collections by class ─────────────────────────────
async function collectionsReport(termId: number) {
  return query<any[]>(
    `SELECT c.id AS class_id, c.name AS class_name,
       COALESCE((SELECT SUM(i.total) FROM invoices i JOIN users u ON u.id = i.student_id
                 WHERE u.class_id = c.id AND i.term_id = ? AND i.status = 'active'), 0) AS billed,
       COALESCE((SELECT SUM(p.amount) FROM fee_payments p JOIN users u ON u.id = p.student_id
                 WHERE u.class_id = c.id AND p.term_id = ? AND p.status = 'active'), 0) AS collected
     FROM classes c ORDER BY c.id`,
    [termId, termId]
  ).then((rows) => rows.map((r) => ({ ...r, outstanding: r.billed - r.collected })));
}

// ── Collections by fee item (proportional allocation) ─
async function feeItemsReport(termId: number) {
  const totals = await queryOne<any>(
    `SELECT COALESCE((SELECT SUM(total) FROM invoices WHERE term_id = ? AND status = 'active'), 0) AS billed,
            COALESCE((SELECT SUM(amount) FROM fee_payments WHERE term_id = ? AND status = 'active'), 0) AS collected`,
    [termId, termId]
  );
  const ratio = totals.billed > 0 ? totals.collected / totals.billed : 0;
  const items = await query<any[]>(
    `SELECT fi.id, fi.name,
       COALESCE((SELECT SUM(il.amount) FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
                 WHERE il.fee_item_id = fi.id AND i.term_id = ? AND i.status = 'active'), 0) AS billed
     FROM fee_items fi WHERE fi.active = 1 ORDER BY fi.sort_order, fi.name`,
    [termId]
  );
  return items.map((i) => ({ ...i, collected: Math.round(i.billed * ratio * 100) / 100 }));
}

// ── Debtors ───────────────────────────────────────────
async function debtorsReport() {
  const students = await query<any[]>(
    `SELECT u.id, u.name, u.student_number, c.name AS class_name
     FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.role = 'student' ORDER BY u.name`
  );
  const rows: any[] = [];
  for (const s of students) {
    const balance = await studentBalance(s.id);
    if (balance > 0) rows.push({ student_id: s.id, student_name: s.name, student_number: s.student_number, class_name: s.class_name, balance });
  }
  rows.sort((a, b) => b.balance - a.balance);
  return rows;
}

// ── Aged arrears (FIFO allocation of payments against invoices) ──
async function agedReport(asOf: string) {
  const students = await query<any[]>(`SELECT id, name FROM users WHERE role = 'student' ORDER BY name`);
  const dayMs = 86400000;
  const results: any[] = [];
  for (const s of students) {
    const invoices = await query<any[]>(
      "SELECT total, inv_date FROM invoices WHERE student_id = ? AND status = 'active' ORDER BY inv_date ASC", [s.id]
    );
    if (!invoices.length) continue;
    const payments = await query<any[]>(
      "SELECT amount FROM fee_payments WHERE student_id = ? AND status = 'active'", [s.id]
    );
    let pool = payments.reduce((sum, p) => sum + p.amount, 0);
    const buckets = { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0 };
    let total = 0;
    for (const inv of invoices) {
      const applied = Math.min(pool, inv.total);
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
    if (total > 0) results.push({ student_id: s.id, student_name: s.name, ...buckets, total: Math.round(total * 100) / 100 });
  }
  results.sort((a, b) => b.total - a.total);
  return results;
}

// ── Income & expenditure ─────────────────────────────
async function incomeExpenditureReport(termId: number) {
  const income = await queryOne<any>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM fee_payments WHERE term_id = ? AND status = 'active'", [termId]
  );
  const expenditure = await queryOne<any>(
    "SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE term_id = ? AND status = 'active'", [termId]
  );
  const byCategory = await query<any[]>(
    `SELECT ec.name, COALESCE(SUM(x.amount),0) AS total FROM expense_categories ec
     LEFT JOIN expenses x ON x.category_id = ec.id AND x.term_id = ? AND x.status = 'active'
     WHERE ec.active = 1 GROUP BY ec.id ORDER BY total DESC`,
    [termId]
  );
  return { income: income.t, expenditure: expenditure.t, surplus: income.t - expenditure.t, byCategory };
}

// ── Sponsor claims ────────────────────────────────────
async function sponsorsReport(termId: number) {
  const sponsors = await query<any[]>('SELECT * FROM sponsors WHERE active = 1 ORDER BY name');
  const rows: any[] = [];
  for (const sp of sponsors) {
    const expected = await queryOne<any>(
      "SELECT COALESCE(SUM(sponsor_amount),0) AS t FROM invoices WHERE sponsor_id = ? AND term_id = ? AND status = 'active'",
      [sp.id, termId]
    );
    const received = await queryOne<any>(
      "SELECT COALESCE(SUM(amount),0) AS t FROM fee_payments WHERE sponsor_id = ? AND term_id = ? AND status = 'active'",
      [sp.id, termId]
    );
    rows.push({ sponsor_id: sp.id, sponsor_name: sp.name, expected: expected.t, received: received.t, outstanding: expected.t - received.t });
  }
  return rows;
}

// ── Payment methods ───────────────────────────────────
async function methodsReport(termId: number) {
  return query<any[]>(
    `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount_paid),0) AS total FROM fee_payments
     WHERE term_id = ? AND status = 'active' GROUP BY method ORDER BY total DESC`,
    [termId]
  );
}

// ── Budget vs actual (mirrors GET /api/budgets/:termId) ──
async function budgetReport(termId: number) {
  return query<any[]>(
    `SELECT c.id, c.name, COALESCE(b.amount, 0) AS budget,
            COALESCE((SELECT SUM(x.amount) FROM expenses x WHERE x.category_id = c.id AND x.term_id = ? AND x.status = 'active'), 0) AS spent
     FROM expense_categories c
     LEFT JOIN budgets b ON b.category_id = c.id AND b.term_id = ?
     WHERE c.active = 1 ORDER BY c.name`,
    [termId, termId]
  );
}

// ── Class list with live balances ────────────────────
async function classListReport(classId: number) {
  const students = await query<any[]>(
    "SELECT id, name, student_number FROM users WHERE role = 'student' AND class_id = ? ORDER BY name", [classId]
  );
  const rows: any[] = [];
  for (const s of students) rows.push({ ...s, balance: await studentBalance(s.id) });
  return rows;
}

const REPORTS: Record<string, (req: AuthRequest) => Promise<any>> = {
  daily: (req) => dailyReport(String(req.query.date || new Date().toISOString().slice(0, 10))),
  collections: (req) => collectionsReport(Number(req.query.term_id)),
  'fee-items': (req) => feeItemsReport(Number(req.query.term_id)),
  debtors: () => debtorsReport(),
  aged: (req) => agedReport(String(req.query.asOf || new Date().toISOString().slice(0, 10))),
  'income-expenditure': (req) => incomeExpenditureReport(Number(req.query.term_id)),
  budget: (req) => budgetReport(Number(req.query.term_id)),
  sponsors: (req) => sponsorsReport(Number(req.query.term_id)),
  methods: (req) => methodsReport(Number(req.query.term_id)),
  'class-list': (req) => classListReport(Number(req.query.class_id)),
};

for (const [name, handler] of Object.entries(REPORTS)) {
  router.get(`/${name}`, authenticate, async (req: AuthRequest, res: Response) => {
    try { res.json(await handler(req)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  router.get(`/${name}/export.xlsx`, authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const data = await handler(req);
      const rows: any[] = Array.isArray(data) ? data : (data.rows || data.payments || data.byCategory || [data]);
      const headers = rows.length ? Object.keys(rows[0]) : ['message'];
      await sendXlsx(res, `${name}-report`, headers, rows.length ? rows : [{ message: 'No data' }]);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}

export default router;
