import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const TYPES = ['percent', 'fixed'];

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>(
      `SELECT d.*, fi.name AS fee_item_name FROM discounts d
       LEFT JOIN fee_items fi ON fi.id = d.fee_item_id ORDER BY d.name`
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, value, fee_item_id } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
    if (!TYPES.includes(type)) return res.status(400).json({ message: 'Invalid discount type' });
    const { insertId } = await execute(
      'INSERT INTO discounts (name, type, value, fee_item_id) VALUES (?, ?, ?, ?)',
      [name, type, value ? parseFloat(value) : 0, fee_item_id || null]
    );
    res.status(201).json({ id: insertId, message: 'Discount created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, value, fee_item_id, active } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
    if (!TYPES.includes(type)) return res.status(400).json({ message: 'Invalid discount type' });
    await execute(
      'UPDATE discounts SET name=?, type=?, value=?, fee_item_id=?, active=? WHERE id=?',
      [name, type, value ? parseFloat(value) : 0, fee_item_id || null, active === false ? 0 : 1, req.params.id]
    );
    res.json({ message: 'Discount updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('UPDATE discounts SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Discount deactivated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
