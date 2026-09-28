import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ensureTermOpen } from '../utils/finance';

const router = Router();

// ── Budget vs actual for a term ──────────────────────
router.get('/:termId', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const termId = Number(req.params.termId);
    const rows = await query<any[]>(
      `SELECT c.id, c.name, COALESCE(b.amount, 0) AS budget,
              COALESCE((SELECT SUM(x.amount) FROM expenses x WHERE x.category_id = c.id AND x.term_id = ? AND x.status = 'active'), 0) AS spent
       FROM expense_categories c
       LEFT JOIN budgets b ON b.category_id = c.id AND b.term_id = ?
       WHERE c.active = 1
       ORDER BY c.name`,
      [termId, termId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Upsert one category's budget for a term ──────────
router.put('/:termId/:categoryId', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { termId, categoryId } = req.params;
    await ensureTermOpen(Number(termId));
    const { amount } = req.body;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return res.status(400).json({ message: 'Invalid amount' });
    const existing = await query<any[]>('SELECT id FROM budgets WHERE term_id = ? AND category_id = ?', [termId, categoryId]);
    if (existing.length) {
      await execute('UPDATE budgets SET amount = ? WHERE id = ?', [amt, existing[0].id]);
    } else {
      await execute('INSERT INTO budgets (term_id, category_id, amount) VALUES (?, ?, ?)', [termId, categoryId, amt]);
    }
    res.json({ message: 'Budget updated' });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── Copy an entire term's budget into another term ───
router.post('/:fromTermId/copy-to/:toTermId', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { fromTermId, toTermId } = req.params;
    await ensureTermOpen(Number(toTermId));
    const rows = await query<any[]>('SELECT * FROM budgets WHERE term_id = ?', [fromTermId]);
    let copied = 0;
    for (const r of rows) {
      const existing = await query<any[]>('SELECT id FROM budgets WHERE term_id = ? AND category_id = ?', [toTermId, r.category_id]);
      if (existing.length) continue; // skip categories that already have a budget row in the target term
      await execute('INSERT INTO budgets (term_id, category_id, amount) VALUES (?, ?, ?)', [toTermId, r.category_id, r.amount]);
      copied++;
    }
    res.json({ message: `Copied ${copied} budget row(s)`, copied });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

export default router;
