import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const TYPES = ['BEAM', 'NGO', 'Church', 'Company', 'Individual', 'Other'];

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>('SELECT * FROM sponsors ORDER BY name');
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, contact_person, phone, email, coverage_percent } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (type && !TYPES.includes(type)) return res.status(400).json({ message: 'Invalid sponsor type' });
    const { insertId } = await execute(
      'INSERT INTO sponsors (name, type, contact_person, phone, email, coverage_percent) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type || 'Other', contact_person || '', phone || '', email || '', coverage_percent !== undefined && coverage_percent !== '' ? parseFloat(coverage_percent) : 100]
    );
    res.status(201).json({ id: insertId, message: 'Sponsor created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, contact_person, phone, email, coverage_percent, active } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (type && !TYPES.includes(type)) return res.status(400).json({ message: 'Invalid sponsor type' });
    await execute(
      'UPDATE sponsors SET name=?, type=?, contact_person=?, phone=?, email=?, coverage_percent=?, active=? WHERE id=?',
      [name, type || 'Other', contact_person || '', phone || '', email || '', coverage_percent !== undefined && coverage_percent !== '' ? parseFloat(coverage_percent) : 100, active === false ? 0 : 1, req.params.id]
    );
    res.json({ message: 'Sponsor updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('UPDATE sponsors SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Sponsor deactivated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
