import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import { query, queryOne } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ensureTermOpen, recordPayment, reversePayment, studentBalance } from '../utils/finance';
import { amountInWords } from '../utils/numberToWords';

const router = Router();

// ── Record a payment (Receive Payment screen) ────────
router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, term_id, pay_date, amount_paid, currency, fx_rate, method, reference, account_id, sponsor_id, notes } = req.body;
    if (!student_id || !term_id || !amount_paid || !method) {
      return res.status(400).json({ message: 'student_id, term_id, amount_paid and method are required' });
    }
    await ensureTermOpen(term_id);
    if (method === 'sponsor' && !sponsor_id) {
      return res.status(400).json({ message: 'A sponsor must be selected for sponsor payments' });
    }
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
      sponsorId: sponsor_id || null,
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
    const { term_id, student_id, method, status, q } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: any[] = [];
    if (term_id) { where.push('p.term_id = ?'); params.push(term_id); }
    if (student_id) { where.push('p.student_id = ?'); params.push(student_id); }
    if (method) { where.push('p.method = ?'); params.push(method); }
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (q) { where.push('(u.name LIKE ? OR p.receipt_no LIKE ? OR p.reference LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const sql = `SELECT p.*, u.name AS student_name FROM fee_payments p
      JOIN users u ON u.id = p.student_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.created_at DESC`;
    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Student self-service: own payment history ────────
router.get('/my', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>(
      "SELECT * FROM fee_payments WHERE student_id = ? ORDER BY created_at DESC", [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Single payment / receipt data ────────────────────
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const p = await queryOne<any>(
      `SELECT p.*, u.name AS student_name FROM fee_payments p JOIN users u ON u.id = p.student_id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    if (req.user!.role === 'student' && p.student_id !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to view this payment' });
    }
    const balance = await studentBalance(p.student_id);
    res.json({ ...p, balanceAfter: balance });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Reverse (never delete) ───────────────────────────
router.put('/:id/reverse', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
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
router.get('/:id/receipt.pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const p = await queryOne<any>(
      `SELECT p.*, u.name AS student_name FROM fee_payments p JOIN users u ON u.id = p.student_id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!p) return res.status(404).json({ message: 'Payment not found' });
    if (req.user!.role === 'student' && p.student_id !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to view this receipt' });
    }
    const balanceAfter = await studentBalance(p.student_id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${p.receipt_no}.pdf"`);
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text('Tascar School Portal', { align: 'center' });
    doc.fontSize(10).fillColor('#666').text('Official Receipt', { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('#000').fontSize(11);
    doc.text(`Receipt No: ${p.receipt_no}`);
    doc.text(`Date: ${p.pay_date}`);
    doc.moveDown(0.5);
    doc.text(`Received from: ${p.student_name}`);
    doc.text(`Amount: ${p.currency} ${p.amount_paid.toFixed(2)}`);
    doc.text(`In words: ${amountInWords(p.amount_paid)}`);
    doc.text(`Method: ${p.method}${p.reference ? ` (Ref: ${p.reference})` : ''}`);
    if (p.notes) doc.text(`Notes: ${p.notes}`);
    doc.moveDown(0.5);
    doc.text(`Balance after this payment: ${p.currency} ${balanceAfter.toFixed(2)}`);
    if (balanceAfter <= 0) doc.fontSize(13).fillColor('#0a0').text('PAID UP', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#666').text('This is a computer-generated receipt from Tascar School Portal.', { align: 'center' });
    doc.end();
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
