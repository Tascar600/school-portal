import { Router, Response } from 'express';
import { query, queryOne } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000) + 1;

export function periodFrom(q: Record<string, any>): { from: string; to: string } {
  const today = new Date();
  const from = DATE.test(String(q.from || '')) ? String(q.from) : iso(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = DATE.test(String(q.to || '')) ? String(q.to) : iso(today);
  return from <= to ? { from, to } : { from: to, to: from };
}

const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

// Every pupil's balance right now (billed minus paid), ignoring cancelled bills and reversed receipts.
export async function pupilBalances(): Promise<{ id: number; name: string; student_number: string; class_id: number | null; class_name: string | null; balance: number }[]> {
  const rows = await query<any[]>(
    `SELECT u.id, u.name, u.student_number, u.class_id, c.name AS class_name,
       COALESCE((SELECT SUM(total) FROM invoices WHERE student_id = u.id AND status = 'active'), 0)
       - COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = u.id AND status = 'active'), 0) AS balance
     FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.role = 'student'`
  );
  return rows.map((r) => ({ ...r, balance: r2(r.balance) }));
}

async function totalsFor(from: string, to: string) {
  const billed = await queryOne<any>("SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS n FROM invoices WHERE status='active' AND inv_date >= ? AND inv_date <= ?", [from, to]);
  const collected = await queryOne<any>("SELECT COALESCE(SUM(amount),0) AS t, COUNT(*) AS n FROM fee_payments WHERE status='active' AND pay_date >= ? AND pay_date <= ?", [from, to]);
  const spent = await queryOne<any>("SELECT COALESCE(SUM(amount),0) AS t, COUNT(*) AS n FROM expenses WHERE status='active' AND exp_date >= ? AND exp_date <= ?", [from, to]);
  return {
    billed: r2(billed.t), billed_count: billed.n,
    collected: r2(collected.t), payments_count: collected.n,
    expenses: r2(spent.t), expenses_count: spent.n,
    net: r2(collected.t - spent.t),
    collection_rate: billed.t > 0 ? Math.round((collected.t / billed.t) * 1000) / 10 : null,
  };
}

// ── overview: totals for a period, compared with the period just before it ───
router.get('/overview', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = periodFrom(req.query);
    const len = daysBetween(from, to);
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(len - 1));
    const balances = await pupilBalances();
    const debtors = balances.filter((b) => b.balance > 0.004);
    res.json({
      from, to, days: len,
      ...(await totalsFor(from, to)),
      previous: { from: prevFrom, to: prevTo, ...(await totalsFor(prevFrom, prevTo)) },
      outstanding: r2(balances.reduce((s, b) => s + b.balance, 0)),
      owed_by_debtors: r2(debtors.reduce((s, b) => s + b.balance, 0)),
      debtors_count: debtors.length,
      paid_up_count: balances.filter((b) => b.balance <= 0.004).length,
      pupils_count: balances.length,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── trend: money in and out over time (daily for short periods, monthly for long ones) ──
router.get('/trend', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = periodFrom(req.query);
    const len = daysBetween(from, to);
    const group: 'day' | 'month' = len <= 62 ? 'day' : 'month';
    const key = (col: string) => (group === 'day' ? col : `SUBSTR(${col}, 1, 7)`);
    const [paid, billed, spent] = await Promise.all([
      query<any[]>(`SELECT ${key('pay_date')} AS k, SUM(amount) AS t, COUNT(*) AS n FROM fee_payments WHERE status='active' AND pay_date >= ? AND pay_date <= ? GROUP BY k`, [from, to]),
      query<any[]>(`SELECT ${key('inv_date')} AS k, SUM(total) AS t FROM invoices WHERE status='active' AND inv_date >= ? AND inv_date <= ? GROUP BY k`, [from, to]),
      query<any[]>(`SELECT ${key('exp_date')} AS k, SUM(amount) AS t FROM expenses WHERE status='active' AND exp_date >= ? AND exp_date <= ? GROUP BY k`, [from, to]),
    ]);
    const pm = new Map(paid.map((r) => [r.k, r])), bm = new Map(billed.map((r) => [r.k, r.t])), em = new Map(spent.map((r) => [r.k, r.t]));
    const keys: string[] = [];
    if (group === 'day') for (let d = from; d <= to; d = addDays(d, 1)) keys.push(d);
    else {
      const d = new Date(from.slice(0, 7) + '-01T00:00:00');
      while (iso(d).slice(0, 7) <= to.slice(0, 7)) { keys.push(iso(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); }
    }
    res.json({
      from, to, group,
      points: keys.map((k) => ({ key: k, collected: r2(pm.get(k)?.t || 0), payments: pm.get(k)?.n || 0, billed: r2(bm.get(k) || 0), expenses: r2(em.get(k) || 0) })),
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── breakdown: where the money came from and where it went ───────────────────
router.get('/breakdown', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = periodFrom(req.query);
    const by_method = await query<any[]>(
      `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM fee_payments
       WHERE status='active' AND pay_date >= ? AND pay_date <= ? GROUP BY method ORDER BY total DESC`, [from, to]);
    const by_currency = await query<any[]>(
      `SELECT currency, COUNT(*) AS count, COALESCE(SUM(amount_paid),0) AS paid, COALESCE(SUM(amount),0) AS usd FROM fee_payments
       WHERE status='active' AND pay_date >= ? AND pay_date <= ? GROUP BY currency ORDER BY usd DESC`, [from, to]);
    const balances = await pupilBalances();
    const classes = await query<any[]>('SELECT id, name FROM classes ORDER BY id');
    const classBilled = await query<any[]>(
      `SELECT u.class_id AS id, SUM(i.total) AS t FROM invoices i JOIN users u ON u.id = i.student_id
       WHERE i.status='active' AND i.inv_date >= ? AND i.inv_date <= ? GROUP BY u.class_id`, [from, to]);
    const classPaid = await query<any[]>(
      `SELECT u.class_id AS id, SUM(p.amount) AS t FROM fee_payments p JOIN users u ON u.id = p.student_id
       WHERE p.status='active' AND p.pay_date >= ? AND p.pay_date <= ? GROUP BY u.class_id`, [from, to]);
    const cb = new Map(classBilled.map((r) => [r.id, r.t])), cp = new Map(classPaid.map((r) => [r.id, r.t]));
    const by_class = classes.map((c) => {
      const owing = balances.filter((b) => b.class_id === c.id && b.balance > 0.004);
      const billed = cb.get(c.id) || 0, collected = cp.get(c.id) || 0;
      return {
        class_id: c.id, class_name: c.name, billed: r2(billed), collected: r2(collected),
        rate: billed > 0 ? Math.round((collected / billed) * 1000) / 10 : null,
        owing_now: r2(owing.reduce((s, b) => s + b.balance, 0)), debtors: owing.length,
        pupils: balances.filter((b) => b.class_id === c.id).length,
      };
    });
    const by_fee_item = await query<any[]>(
      `SELECT COALESCE(fi.name, il.description) AS name, SUM(il.amount) AS billed FROM invoice_lines il
       JOIN invoices i ON i.id = il.invoice_id LEFT JOIN fee_items fi ON fi.id = il.fee_item_id
       WHERE i.status='active' AND i.inv_date >= ? AND i.inv_date <= ? GROUP BY name ORDER BY billed DESC`, [from, to]);
    const by_category = await query<any[]>(
      `SELECT COALESCE(ec.name, 'Uncategorised') AS name, COUNT(*) AS count, SUM(x.amount) AS total FROM expenses x
       LEFT JOIN expense_categories ec ON ec.id = x.category_id
       WHERE x.status='active' AND x.exp_date >= ? AND x.exp_date <= ? GROUP BY name ORDER BY total DESC`, [from, to]);
    const topRaw = balances.filter((b) => b.balance > 0.004).sort((a, b) => b.balance - a.balance).slice(0, 10);
    const top_debtors = [];
    for (const d of topRaw) {
      const last = await queryOne<any>("SELECT MAX(pay_date) AS d FROM fee_payments WHERE student_id = ? AND status = 'active'", [d.id]);
      const phone = await queryOne<any>('SELECT guardian_phone FROM student_profiles WHERE user_id = ?', [d.id]);
      top_debtors.push({ ...d, last_payment: last?.d || null, guardian_phone: phone?.guardian_phone || '' });
    }
    // Pupils whose balance is overdue, grouped by size of debt
    const bands = [['Under $50', 0, 50], ['$50 – $99', 50, 100], ['$100 – $199', 100, 200], ['$200 and over', 200, Infinity]] as const;
    const debt_bands = bands.map(([label, lo, hi]) => ({ label, count: balances.filter((b) => b.balance > lo && b.balance <= hi).length, total: r2(balances.filter((b) => b.balance > lo && b.balance <= hi).reduce((s, b) => s + b.balance, 0)) }));
    res.json({
      from, to, by_method: by_method.map((r) => ({ ...r, total: r2(r.total) })),
      by_currency: by_currency.map((r) => ({ ...r, paid: r2(r.paid), usd: r2(r.usd) })),
      by_class, by_fee_item: by_fee_item.map((r) => ({ ...r, billed: r2(r.billed) })),
      by_category: by_category.map((r) => ({ ...r, total: r2(r.total) })), top_debtors, debt_bands,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
