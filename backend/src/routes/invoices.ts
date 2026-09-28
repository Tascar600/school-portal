import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import { query, queryOne } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { cancelInvoice, ensureTermOpen, studentBalance } from '../utils/finance';

const router = Router();

// ── List / search invoices ───────────────────────────
router.get('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { term_id, student_id, type, status, q } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: any[] = [];
    if (term_id) { where.push('i.term_id = ?'); params.push(term_id); }
    if (student_id) { where.push('i.student_id = ?'); params.push(student_id); }
    if (type) { where.push('i.type = ?'); params.push(type); }
    if (status) { where.push('i.status = ?'); params.push(status); }
    if (q) { where.push('(u.name LIKE ? OR i.invoice_no LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const sql = `SELECT i.*, u.name AS student_name FROM invoices i
      JOIN users u ON u.id = i.student_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY i.created_at DESC`;
    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Student self-service: own invoices ───────────────
router.get('/my', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>('SELECT * FROM invoices WHERE student_id = ? ORDER BY created_at DESC', [req.user!.id]);
    for (const inv of rows) {
      inv.lines = await query<any[]>('SELECT * FROM invoice_lines WHERE invoice_id = ?', [inv.id]);
    }
    const balance = await studentBalance(req.user!.id);
    res.json({ invoices: rows, balance });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Single invoice with lines ────────────────────────
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const inv = await queryOne<any>(
      `SELECT i.*, u.name AS student_name FROM invoices i JOIN users u ON u.id = i.student_id WHERE i.id = ?`,
      [req.params.id]
    );
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user!.role === 'student' && inv.student_id !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    inv.lines = await query<any[]>('SELECT * FROM invoice_lines WHERE invoice_id = ?', [inv.id]);
    res.json(inv);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Cancel (never hard-delete) ───────────────────────
router.put('/:id/cancel', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'A cancellation reason is required' });
    const inv = await queryOne<any>('SELECT term_id FROM invoices WHERE id = ?', [req.params.id]);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    await ensureTermOpen(inv.term_id);
    await cancelInvoice(Number(req.params.id), reason);
    res.json({ message: 'Invoice cancelled' });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── Printable invoice (PDF) ───────────────────────────
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const inv = await queryOne<any>(
      `SELECT i.*, u.name AS student_name FROM invoices i JOIN users u ON u.id = i.student_id WHERE i.id = ?`,
      [req.params.id]
    );
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user!.role === 'student' && inv.student_id !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    const lines = await query<any[]>('SELECT * FROM invoice_lines WHERE invoice_id = ?', [inv.id]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${inv.invoice_no}.pdf"`);
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text('Tascar School Portal', { align: 'center' });
    doc.fontSize(10).fillColor('#666').text(inv.type === 'credit' ? 'Credit Note' : inv.type === 'charge' ? 'Charge' : 'Invoice', { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('#000').fontSize(11);
    doc.text(`${inv.invoice_no}`);
    doc.text(`Date: ${inv.inv_date}`);
    doc.text(`Student: ${inv.student_name}`);
    if (inv.status === 'cancelled') doc.fillColor('#c00').text(`CANCELLED: ${inv.cancel_reason}`).fillColor('#000');
    doc.moveDown(0.5);
    for (const l of lines) {
      doc.text(`${l.description}`, { continued: true, width: 260 });
      doc.text(`${l.amount.toFixed(2)}`, { align: 'right' });
    }
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total: ${inv.total.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#666').text('This is a computer-generated document from Tascar School Portal.', { align: 'center' });
    doc.end();
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
