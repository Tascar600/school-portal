import { Router, Response } from 'express';
import { getSchoolInfo } from '../utils/settings';
import { sendInvoice } from '../utils/financePdf';
import { query, queryOne } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { actingStudent, mayActFor } from '../utils/acting';
import { cancelInvoice, ensureTermOpen, studentBalance } from '../utils/finance';

const router = Router();

// ── List / search invoices ───────────────────────────
router.get('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { term_id, student_id, type, status, q, from, to } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: any[] = [];
    if (term_id) { where.push('i.term_id = ?'); params.push(term_id); }
    if (from) { where.push('i.inv_date >= ?'); params.push(from); }
    if (to) { where.push('i.inv_date <= ?'); params.push(to); }
    if (student_id) { where.push('i.student_id = ?'); params.push(student_id); }
    if (type) { where.push('i.type = ?'); params.push(type); }
    if (status) { where.push('i.status = ?'); params.push(status); }
    if (q) { where.push('(u.name LIKE ? OR i.invoice_no LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const sql = `SELECT i.*, u.name AS student_name, u.student_number, c.name AS class_name FROM invoices i
      JOIN users u ON u.id = i.student_id LEFT JOIN classes c ON c.id = u.class_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY i.inv_date DESC, i.id DESC`;
    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Student self-service: own invoices ───────────────
router.get('/my', authenticate, authorize('student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const sid = await actingStudent(req, res); if (sid === null) return;
    const rows = await query<any[]>('SELECT * FROM invoices WHERE student_id = ? ORDER BY created_at DESC', [sid]);
    for (const inv of rows) {
      inv.lines = await query<any[]>('SELECT * FROM invoice_lines WHERE invoice_id = ?', [inv.id]);
    }
    const balance = await studentBalance(sid);
    res.json({ invoices: rows, balance });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Single invoice with lines ────────────────────────
router.get('/:id', authenticate, authorize('admin', 'bursary', 'student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const inv = await queryOne<any>(
      `SELECT i.*, u.name AS student_name FROM invoices i JOIN users u ON u.id = i.student_id WHERE i.id = ?`,
      [req.params.id]
    );
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    if ((req.user!.role === 'student' || req.user!.role === 'parent') && !(await mayActFor(req, inv.student_id))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    inv.lines = await query<any[]>('SELECT * FROM invoice_lines WHERE invoice_id = ?', [inv.id]);
    res.json(inv);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Cancel (never hard-delete) ───────────────────────
router.put('/:id/cancel', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
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
router.get('/:id/pdf', authenticate, authorize('admin', 'bursary', 'student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const inv = await queryOne<any>(
      `SELECT i.*, u.name AS student_name, u.student_number, c.name AS class_name, sp.guardian_name, t.year, t.term_no
       FROM invoices i JOIN users u ON u.id = i.student_id LEFT JOIN classes c ON c.id = u.class_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN terms t ON t.id = i.term_id WHERE i.id = ?`,
      [req.params.id]
    );
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    if ((req.user!.role === 'student' || req.user!.role === 'parent') && !(await mayActFor(req, inv.student_id))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    const lines = await query<any[]>('SELECT description, amount FROM invoice_lines WHERE invoice_id = ?', [inv.id]);
    const printer = await queryOne<any>('SELECT name FROM users WHERE id = ?', [req.user!.id]);
    sendInvoice(res, await getSchoolInfo(), {
      invoice_no: inv.invoice_no, type: inv.type, inv_date: inv.inv_date, student_name: inv.student_name, student_number: inv.student_number || '',
      class_name: inv.class_name || '', guardian: inv.guardian_name || '', term_label: inv.term_no ? `Term ${inv.term_no}, ${inv.year}` : '-',
      lines, gross: inv.gross, discount: inv.discount, total: inv.total, balance: await studentBalance(inv.student_id),
      notes: inv.notes || '', status: inv.status, cancel_reason: inv.cancel_reason || '',
    }, printer?.name || '');
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
