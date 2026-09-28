import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>('SELECT * FROM expense_categories ORDER BY name');
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const { insertId } = await execute('INSERT INTO expense_categories (name) VALUES (?)', [name]);
    res.status(201).json({ id: insertId, message: 'Category created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, active } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    await execute('UPDATE expense_categories SET name=?, active=? WHERE id=?', [name, active === false ? 0 : 1, req.params.id]);
    res.json({ message: 'Category updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('UPDATE expense_categories SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deactivated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
