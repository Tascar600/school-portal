import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const terms = await query<any[]>('SELECT * FROM terms ORDER BY year DESC, term_no DESC');
    res.json(terms);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/current', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const term = await queryOne<any>('SELECT * FROM terms WHERE is_current = 1');
    res.json(term || null);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { year, term_no, start_date, end_date } = req.body;
    if (!year || !term_no) return res.status(400).json({ message: 'Year and term number are required' });
    const { insertId } = await execute(
      'INSERT INTO terms (year, term_no, start_date, end_date) VALUES (?, ?, ?, ?)',
      [year, term_no, start_date || null, end_date || null]
    );
    res.status(201).json({ id: insertId, message: 'Term created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.body;
    await execute('UPDATE terms SET start_date = ?, end_date = ? WHERE id = ?', [start_date || null, end_date || null, req.params.id]);
    res.json({ message: 'Term updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/set-current', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('UPDATE terms SET is_current = 0');
    await execute('UPDATE terms SET is_current = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Current term updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/lock', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { locked } = req.body;
    await execute('UPDATE terms SET is_locked = ? WHERE id = ?', [locked ? 1 : 0, req.params.id]);
    res.json({ message: locked ? 'Term locked' : 'Term unlocked' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
