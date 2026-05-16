import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Admin: create sport
router.post('/', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, coach_id, max_participants } = req.body;
    await execute(
      'INSERT INTO sports (name, description, coach_id, max_participants) VALUES (?, ?, ?, ?)',
      [name, description || '', coach_id || null, max_participants || 0]
    );
    res.status(201).json({ message: 'Sport created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get all sports
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sports = await query<any[]>(
      `SELECT s.*, u.name AS coach_name,
       (SELECT COUNT(*) FROM sport_participants WHERE sport_id=s.id) AS participant_count
       FROM sports s LEFT JOIN users u ON u.id=s.coach_id ORDER BY s.name`
    );
    res.json(sports);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: join sport
router.post('/join/:sportId', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const sportId = parseInt(req.params.sportId);
    const existing = await query<any[]>('SELECT id FROM sport_participants WHERE sport_id=? AND student_id=?', [sportId, req.user!.id]);
    if (existing.length > 0) {
      res.status(400).json({ message: 'Already joined' });
      return;
    }
    const sport = await queryOne<any>('SELECT max_participants FROM sports WHERE id=?', [sportId]);
    if (sport && sport.max_participants > 0) {
      const count = await queryOne<any>('SELECT COUNT(*) AS c FROM sport_participants WHERE sport_id=?', [sportId]);
      if (count && count.c >= sport.max_participants) {
        res.status(400).json({ message: 'Sport is full' });
        return;
      }
    }
    await execute('INSERT INTO sport_participants (sport_id, student_id) VALUES (?, ?)', [sportId, req.user!.id]);
    res.json({ message: 'Joined sport' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: leave sport
router.delete('/leave/:sportId', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM sport_participants WHERE sport_id=? AND student_id=?', [req.params.sportId, req.user!.id]);
    res.json({ message: 'Left sport' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get participants of a sport
router.get('/:sportId/participants', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const participants = await query<any[]>(
      `SELECT sp.*, u.name AS student_name FROM sport_participants sp
       JOIN users u ON u.id=sp.student_id WHERE sp.sport_id=? ORDER BY u.name`,
      [req.params.sportId]
    );
    res.json(participants);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: delete sport
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM sports WHERE id=?', [req.params.id]);
    res.json({ message: 'Sport deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
