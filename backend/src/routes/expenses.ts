import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ensureTermOpen } from '../utils/finance';
import { nextNo } from '../utils/sequences';

const router = Router();

// ── Record an expense (Payment Voucher) ──────────────
router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { exp_date, term_id, category_id, account_id, payee, description, amount, reference, attachment } = req.body;
    if (!exp_date || !account_id || !amount) {
      return res.status(400).json({ message: 'exp_date, account_id and amount are required' });
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ message: 'Amount must be greater than zero' });

    // Resolve the term: explicit term_id, else the term whose date range brackets exp_date, else the current term.
    let termId: number | null = term_id ? Number(term_id) : null;
    if (!termId) {
      const byDate = await queryOne<any>(
        'SELECT id FROM terms WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= ? AND end_date >= ?',
        [exp_date, exp_date]
      );
      if (byDate) termId = byDate.id;
      else {
        const current = await queryOne<any>('SELECT id FROM terms WHERE is_current = 1');
        termId = current ? current.id : null;
      }
    }
    if (termId) await ensureTermOpen(termId);

    const voucherNo = await nextNo('PV', 'PV');
    const { insertId } = await execute(
      `INSERT INTO expenses (voucher_no, exp_date, term_id, category_id, account_id, payee, description, amount, reference, attachment, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [voucherNo, exp_date, termId, category_id || null, account_id, payee || '', description || '', amt, reference || '', attachment || '', req.user!.id]
    );
    res.status(201).json({ id: insertId, voucher_no: voucherNo, message: `Expense saved as voucher ${voucherNo}` });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── List / search / filter expenses ──────────────────
router.get('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { term_id, category_id, account_id, status, q } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: any[] = [];
    if (term_id) { where.push('x.term_id = ?'); params.push(term_id); }
    if (category_id) { where.push('x.category_id = ?'); params.push(category_id); }
    if (account_id) { where.push('x.account_id = ?'); params.push(account_id); }
    if (status) { where.push('x.status = ?'); params.push(status); }
    if (q) { where.push('(x.payee LIKE ? OR x.description LIKE ? OR x.voucher_no LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const sql = `SELECT x.*, c.name AS category_name, a.name AS account_name FROM expenses x
      LEFT JOIN expense_categories c ON c.id = x.category_id
      LEFT JOIN accounts a ON a.id = x.account_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY x.exp_date DESC, x.id DESC`;
    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Single expense / voucher ──────────────────────────
router.get('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const x = await queryOne<any>(
      `SELECT x.*, c.name AS category_name, a.name AS account_name FROM expenses x
       LEFT JOIN expense_categories c ON c.id = x.category_id
       LEFT JOIN accounts a ON a.id = x.account_id WHERE x.id = ?`,
      [req.params.id]
    );
    if (!x) return res.status(404).json({ message: 'Expense not found' });
    res.json(x);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Cancel (never hard-delete) ───────────────────────
router.put('/:id/cancel', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'A cancellation reason is required' });
    const x = await queryOne<any>('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (!x) return res.status(404).json({ message: 'Expense not found' });
    if (x.status === 'cancelled') return res.status(400).json({ message: 'Expense already cancelled' });
    if (x.term_id) await ensureTermOpen(x.term_id);
    await execute("UPDATE expenses SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [reason, req.params.id]);
    res.json({ message: `Voucher ${x.voucher_no} cancelled` });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

export default router;
