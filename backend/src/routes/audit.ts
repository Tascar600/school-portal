import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { periodFrom } from './stats';

const router = Router();

// The Bursary audit trail, for the Administrator to read. There is deliberately no way to add to, change or delete it
// through the portal: the only routes here are reads.
router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = periodFrom(req.query);
    const where = ['date(created_at) >= ?', 'date(created_at) <= ?'];
    const params: any[] = [from, to];
    if (req.query.action) { where.push('action = ?'); params.push(String(req.query.action)); }
    if (req.query.user_id) { where.push('user_id = ?'); params.push(Number(req.query.user_id)); }
    if (req.query.student_id) { where.push('student_id = ?'); params.push(Number(req.query.student_id)); }
    const q = String(req.query.q || '').trim();
    if (q) { where.push('(summary LIKE ? OR user_name LIKE ? OR action LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const filter = where.join(' AND ');

    const rows = await query<any[]>(`SELECT * FROM audit_log WHERE ${filter} ORDER BY id DESC LIMIT 1000`, params);
    const total = (await query<any[]>(`SELECT COUNT(*) AS n FROM audit_log WHERE ${filter}`, params))[0]?.n ?? 0;
    const counts = await query<any[]>(`SELECT action, COUNT(*) AS n FROM audit_log WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY action ORDER BY n DESC`, [from, to]);
    const users = await query<any[]>(`SELECT DISTINCT user_id AS id, user_name AS name, user_role AS role FROM audit_log ORDER BY user_name`);
    res.json({ from, to, total, shown: rows.length, rows, counts, users });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
