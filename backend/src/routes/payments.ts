import { Router, Response } from 'express';
import { query, queryOne } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { actingStudent, mayActFor } from '../utils/acting';
import { ensureTermOpen, recordPayment, reversePayment, studentBalance } from '../utils/finance';
import { getSchoolInfo } from '../utils/settings';
import { sendReceipt } from '../utils/financePdf';

const router = Router();

// ── Record a payment (Receive Payment screen) ────────
router.post('/', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, term_id, pay_date, amount_paid, currency, fx_rate, method, reference, account_id, payer, notes } = req.body;
    if (!student_id || !term_id || !amount_paid || !method) {
      return res.status(400).json({ message: 'student_id, term_id, amount_paid and method are required' });
    }
    await ensureTermOpen(term_id);
    const result = await recordPayment({
      studentId: Number(student_id),
      termId: Number(term_id),
      payDate: pay_date || new Date().toISOString().slice(0, 10),
      amountPaid: parseFloat(amount_paid),
      currency: currency || 'USD',
      fxRate: fx_rate ? parseFloat(fx_rate) : 1,
      method,
      reference: reference || '',
      accountId: account_id || null,
      payer: payer || '',
      notes: notes || '',
      receivedBy: req.user!.id,
    });
    const balance = await studentBalance(Number(student_id));
    res.status(201).json({ message: `Receipt ${result.receiptNo} recorded`, ...result, balance });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── List / search payments ───────────────────────────
router.get('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { term_id, student_id, method, status, q, from, to } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: any[] = [];
    if (term_id) { where.push('p.term_id = ?'); params.push(term_id); }
    if (from) { where.push('p.pay_date >= ?'); params.push(from); }
    if (to) { where.push('p.pay_date <= ?'); params.push(to); }
    if (student_id) { where.push('p.student_id = ?'); params.push(student_id); }
    if (method) { where.push('p.method = ?'); params.push(method); }
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (q) { where.push('(u.name LIKE ? OR p.receipt_no LIKE ? OR p.reference LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const sql = `SELECT p.*, u.name AS student_name, u.student_number, c.name AS class_name, rb.name AS received_by_name FROM fee_payments p
      JOIN users u ON u.id = p.student_id LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN users rb ON rb.id = p.received_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.pay_date DESC, p.id DESC`;
    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Student self-service: own payment history ────────
router.get('/my', authenticate, authorize('student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const sid = await actingStudent(req, res); if (sid === null) return;
    const rows = await query<any[]>(
      "SELECT * FROM fee_payments WHERE student_id = ? ORDER BY created_at DESC", [sid]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Single payment / receipt data ────────────────────
router.get('/:id', authenticate, authorize('admin', 'bursary', 'student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const p = await queryOne<any>(
      `SELECT p.*, u.name AS student_name FROM fee_payments p JOIN users u ON u.id = p.student_id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    if ((req.user!.role === 'student' || req.user!.role === 'parent') && !(await mayActFor(req, p.student_id))) {
      return res.status(403).json({ message: 'Not authorized to view this payment' });
    }
    const balance = await studentBalance(p.student_id);
    res.json({ ...p, balanceAfter: balance });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Reverse (never delete) ───────────────────────────
router.put('/:id/reverse', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const p = await queryOne<any>('SELECT term_id FROM fee_payments WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    await ensureTermOpen(p.term_id);
    await reversePayment(Number(req.params.id), reason, req.user!.id);
    res.json({ message: 'Payment reversed' });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── Printable receipt (PDF) ───────────────────────────
router.get('/:id/receipt.pdf', authenticate, authorize('admin', 'bursary', 'student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const p = await queryOne<any>(
      `SELECT p.*, u.name AS student_name, u.student_number, c.name AS class_name, sp.guardian_name, t.year, t.term_no,
              a.name AS account_name, rb.name AS received_by_name
       FROM fee_payments p JOIN users u ON u.id = p.student_id
       LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN terms t ON t.id = p.term_id LEFT JOIN accounts a ON a.id = p.account_id LEFT JOIN users rb ON rb.id = p.received_by
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    if ((req.user!.role === 'student' || req.user!.role === 'parent') && !(await mayActFor(req, p.student_id))) {
      return res.status(403).json({ message: 'Not authorized to view this receipt' });
    }
    // Paid to date = every active receipt up to and including this one (receipt numbers only ever go up)
    const paid = await queryOne<any>("SELECT COALESCE(SUM(amount),0) AS t FROM fee_payments WHERE student_id = ? AND status = 'active' AND id <= ?", [p.student_id, p.id]);
    const balanceAfter = p.balance_after ?? (await studentBalance(p.student_id));
    const printer = await queryOne<any>('SELECT name FROM users WHERE id = ?', [req.user!.id]);
    sendReceipt(res, await getSchoolInfo(), {
      receipt_no: p.receipt_no, pay_date: p.pay_date, payer: p.payer || p.guardian_name || '', student_name: p.student_name,
      student_number: p.student_number || '', class_name: p.class_name || '', term_label: p.term_no ? `Term ${p.term_no}, ${p.year}` : '-',
      method: p.method, reference: p.reference, account_name: p.account_name || '', currency: p.currency, amount_paid: p.amount_paid,
      fx_rate: p.fx_rate, amount_usd: p.amount, billed_to_date: Math.round((balanceAfter + paid.t) * 100) / 100, paid_to_date: Math.round(paid.t * 100) / 100,
      balance_after: balanceAfter, notes: p.notes || '', received_by: p.received_by_name || '', status: p.status, reverse_reason: p.reverse_reason || '',
    }, printer?.name || '');
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
