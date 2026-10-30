import { Router, Response } from 'express';
import { query, queryOne } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { actingStudent, mayActFor } from '../utils/acting';
import { getSchoolInfo } from '../utils/settings';
import { sendStatement, StatementData } from '../utils/financePdf';
import { periodFrom } from './stats';

const router = Router();
const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

// A pupil's history of bills and payments between two dates, with a running balance.
export async function buildStatement(studentId: number, from: string, to: string): Promise<StatementData | null> {
  const s = await queryOne<any>(
    `SELECT u.id, u.name, u.student_number, c.name AS class_name, sp.guardian_name, sp.guardian_phone
     FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.id = ? AND u.role = 'student'`, [studentId]);
  if (!s) return null;
  const billedBefore = await queryOne<any>("SELECT COALESCE(SUM(total),0) AS t FROM invoices WHERE student_id = ? AND status='active' AND inv_date < ?", [studentId, from]);
  const paidBefore = await queryOne<any>("SELECT COALESCE(SUM(amount),0) AS t FROM fee_payments WHERE student_id = ? AND status='active' AND pay_date < ?", [studentId, from]);
  const opening = r2(billedBefore.t - paidBefore.t);

  const invoices = await query<any[]>(
    `SELECT i.id, i.invoice_no, i.type, i.inv_date AS date, i.total, i.notes, i.created_at, t.year, t.term_no
     FROM invoices i LEFT JOIN terms t ON t.id = i.term_id
     WHERE i.student_id = ? AND i.status='active' AND i.inv_date >= ? AND i.inv_date <= ?`, [studentId, from, to]);
  const payments = await query<any[]>(
    `SELECT p.id, p.receipt_no, p.pay_date AS date, p.amount, p.amount_paid, p.currency, p.method, p.reference, p.notes, p.created_at
     FROM fee_payments p WHERE p.student_id = ? AND p.status='active' AND p.pay_date >= ? AND p.pay_date <= ?`, [studentId, from, to]);

  const events = [
    ...invoices.map((i) => ({
      date: i.date, at: i.created_at, ref: i.invoice_no,
      description: (i.type === 'term' ? `Term ${i.term_no} ${i.year} school fees` : i.type === 'credit' ? 'Credit note' : 'Additional charge') + (i.notes ? ` – ${i.notes}` : ''),
      charge: i.total > 0 ? i.total : 0, payment: i.total < 0 ? -i.total : 0,
    })),
    ...payments.map((p) => ({
      date: p.date, at: p.created_at, ref: p.receipt_no,
      description: `Payment (${p.method}${p.reference ? ', ref ' + p.reference : ''})${p.currency !== 'USD' ? ` – ${p.currency} ${r2(p.amount_paid).toFixed(2)}` : ''}${p.notes ? ` – ${p.notes}` : ''}`,
      charge: 0, payment: p.amount,
    })),
  ].sort((a, b) => (a.date === b.date ? String(a.at).localeCompare(String(b.at)) : a.date.localeCompare(b.date)));

  let running = opening, totalCharges = 0, totalPayments = 0;
  const lines = events.map((e) => {
    running = r2(running + e.charge - e.payment);
    totalCharges += e.charge; totalPayments += e.payment;
    return { date: e.date, ref: e.ref, description: e.description, charge: r2(e.charge), payment: r2(e.payment), balance: running };
  });
  return {
    student_name: s.name, student_number: s.student_number || '', class_name: s.class_name || '', guardian: s.guardian_name || '', guardian_phone: s.guardian_phone || '',
    from, to, opening, closing: running, total_charges: r2(totalCharges), total_payments: r2(totalPayments), lines,
  };
}

// Bursar / Admin: any pupil. A student can only open their own (see /my below).
router.get('/student/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = periodFrom({ from: req.query.from || '2000-01-01', to: req.query.to });
    const data = await buildStatement(Number(req.params.id), from, to);
    if (!data) return res.status(404).json({ message: 'Pupil not found' });
    res.json(data);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/student/:id/pdf', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = periodFrom({ from: req.query.from || '2000-01-01', to: req.query.to });
    const data = await buildStatement(Number(req.params.id), from, to);
    if (!data) return res.status(404).json({ message: 'Pupil not found' });
    const who = await queryOne<any>('SELECT name FROM users WHERE id = ?', [req.user!.id]);
    sendStatement(res, await getSchoolInfo(), data, who?.name || '');
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/my', authenticate, authorize('student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const sid = await actingStudent(req, res); if (sid === null) return;
    const { from, to } = periodFrom({ from: req.query.from || '2000-01-01', to: req.query.to });
    res.json(await buildStatement(sid, from, to));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/my/pdf', authenticate, authorize('student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const sid = await actingStudent(req, res); if (sid === null) return;
    const { from, to } = periodFrom({ from: req.query.from || '2000-01-01', to: req.query.to });
    const data = await buildStatement(sid, from, to);
    if (!data) return res.status(404).json({ message: 'Not found' });
    sendStatement(res, await getSchoolInfo(), data, data.student_name);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
