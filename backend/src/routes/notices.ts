import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Anyone with auth: create notice (teachers can post, admin can post)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, target_role } = req.body;
    const role = req.user!.role;
    if (role === 'student') {
      res.status(403).json({ message: 'Students cannot post notices' });
      return;
    }
    await execute(
      'INSERT INTO notices (title, content, author_id, target_role) VALUES (?, ?, ?, ?)',
      [title, content, req.user!.id, target_role || 'all']
    );
    res.status(201).json({ message: 'Notice posted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teachers see their own notices + admin notices
// Students see notices intended for them + all
// Admin sees all
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let sql: string;
    let params: any[];

    if (req.user!.role === 'admin') {
      sql = `SELECT n.*, u.name AS author_name, u.role AS author_role
             FROM notices n JOIN users u ON u.id = n.author_id
             ORDER BY n.created_at DESC`;
      params = [];
    } else if (req.user!.role === 'teacher') {
      sql = `SELECT n.*, u.name AS author_name, u.role AS author_role
             FROM notices n JOIN users u ON u.id = n.author_id
             WHERE n.target_role IN ('all', 'teachers', 'students') OR n.author_id = ?
             ORDER BY n.created_at DESC`;
      params = [req.user!.id];
    } else {
      sql = `SELECT n.*, u.name AS author_name, u.role AS author_role
             FROM notices n JOIN users u ON u.id = n.author_id
             WHERE n.target_role IN ('all', 'students')
             ORDER BY n.created_at DESC`;
      params = [];
    }
    const notices = await query<any[]>(sql, params);
    res.json(notices);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher can delete own notice, admin can delete any
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'admin') {
      await execute('DELETE FROM notices WHERE id = ?', [req.params.id]);
      res.json({ message: 'Notice deleted by admin' });
    } else if (req.user!.role === 'teacher') {
      await execute('DELETE FROM notices WHERE id = ? AND author_id = ?', [req.params.id, req.user!.id]);
      res.json({ message: 'Notice deleted' });
    } else {
      res.status(403).json({ message: 'Unauthorized' });
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
