import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ensureTermOpen } from '../utils/finance';

const router = Router();

// ── Fee items catalogue ──────────────────────────────
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const items = await query<any[]>('SELECT * FROM fee_items ORDER BY sort_order, name');
    res.json(items);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, is_optional, sort_order } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const { insertId } = await execute(
      'INSERT INTO fee_items (name, description, is_optional, sort_order) VALUES (?, ?, ?, ?)',
      [name, description || '', is_optional ? 1 : 0, sort_order || 0]
    );
    res.status(201).json({ id: insertId, message: 'Fee item created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, is_optional, sort_order, active } = req.body;
    await execute(
      'UPDATE fee_items SET name=?, description=?, is_optional=?, sort_order=?, active=? WHERE id=?',
      [name, description || '', is_optional ? 1 : 0, sort_order || 0, active === false ? 0 : 1, req.params.id]
    );
    res.json({ message: 'Fee item updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('UPDATE fee_items SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Fee item deactivated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Fee structure matrix (term × class × item) ───────
router.get('/structure/:termId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>(
      `SELECT fs.*, fi.name AS item_name, fi.is_optional, c.name AS class_name
       FROM fee_structure fs
       JOIN fee_items fi ON fi.id = fs.fee_item_id
       JOIN classes c ON c.id = fs.class_id
       WHERE fs.term_id = ?
       ORDER BY c.id, fi.sort_order`,
      [req.params.termId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put(
  '/structure/:termId/:classId/:feeItemId',
  authenticate, authorize('admin', 'bursary'),
  async (req: AuthRequest, res: Response) => {
    try {
      await ensureTermOpen(Number(req.params.termId));
      const { amount } = req.body;
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt < 0) return res.status(400).json({ message: 'Invalid amount' });
      const existing = await query<any[]>(
        'SELECT id FROM fee_structure WHERE term_id=? AND class_id=? AND fee_item_id=?',
        [req.params.termId, req.params.classId, req.params.feeItemId]
      );
      if (existing.length) {
        await execute('UPDATE fee_structure SET amount=? WHERE id=?', [amt, existing[0].id]);
      } else {
        await execute(
          'INSERT INTO fee_structure (term_id, class_id, fee_item_id, amount) VALUES (?,?,?,?)',
          [req.params.termId, req.params.classId, req.params.feeItemId, amt]
        );
      }
      res.json({ message: 'Fee structure updated' });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  }
);

// Copy an entire term's fee structure to another term, with an optional % adjustment
router.post(
  '/structure/:fromTermId/copy-to/:toTermId',
  authenticate, authorize('admin', 'bursary'),
  async (req: AuthRequest, res: Response) => {
    try {
      await ensureTermOpen(Number(req.params.toTermId));
      const pct = parseFloat(req.body.percentChange) || 0;
      const rows = await query<any[]>('SELECT * FROM fee_structure WHERE term_id = ?', [req.params.fromTermId]);
      let copied = 0;
      for (const r of rows) {
        const amount = Math.round(r.amount * (1 + pct / 100) * 100) / 100;
        const existing = await query<any[]>(
          'SELECT id FROM fee_structure WHERE term_id=? AND class_id=? AND fee_item_id=?',
          [req.params.toTermId, r.class_id, r.fee_item_id]
        );
        if (existing.length) {
          await execute('UPDATE fee_structure SET amount=? WHERE id=?', [amount, existing[0].id]);
        } else {
          await execute(
            'INSERT INTO fee_structure (term_id, class_id, fee_item_id, amount) VALUES (?,?,?,?)',
            [req.params.toTermId, r.class_id, r.fee_item_id, amount]
          );
        }
        copied++;
      }
      res.json({ message: `Copied ${copied} fee structure rows`, copied });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  }
);

export default router;
