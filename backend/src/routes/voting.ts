import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Admin: create voting session
router.post('/sessions', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, position, start_date, end_date } = req.body;
    await execute(
      'INSERT INTO voting_sessions (title, description, position, status, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', position || 'Prefect', 'closed', start_date || null, end_date || null, req.user!.id]
    );
    res.status(201).json({ message: 'Voting session created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: toggle voting status (open/close)
router.put('/sessions/:id/status', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body; // 'open' or 'closed'
    await execute('UPDATE voting_sessions SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: `Voting ${status}` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get all voting sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await query<any[]>(
      `SELECT vs.*, u.name AS created_by_name,
       (SELECT COUNT(*) FROM nominations WHERE session_id=vs.id) AS candidate_count,
       (SELECT COUNT(*) FROM votes WHERE session_id=vs.id) AS vote_count
       FROM voting_sessions vs JOIN users u ON u.id=vs.created_by
       ORDER BY vs.created_at DESC`
    );
    // Check if user already voted in each session
    if (req.user!.role === 'student') {
      for (const s of sessions) {
        const vote = await queryOne<any>('SELECT id FROM votes WHERE session_id=? AND voter_id=?', [s.id, req.user!.id]);
        s.has_voted = !!vote;
      }
    }
    res.json(sessions);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: nominate a student
router.post('/nominate', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { session_id, student_id, manifesto } = req.body;
    const existing = await query<any[]>('SELECT id FROM nominations WHERE session_id=? AND student_id=?', [session_id, student_id]);
    if (existing.length > 0) {
      res.status(400).json({ message: 'Student already nominated' });
      return;
    }
    await execute('INSERT INTO nominations (session_id, student_id, manifesto) VALUES (?, ?, ?)',
      [session_id, student_id, manifesto || '']);
    res.json({ message: 'Candidate nominated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get nominations for a session (without vote count for students)
router.get('/sessions/:id/candidates', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const candidates = await query<any[]>(
      `SELECT n.*, u.name AS student_name, u.class_id
       FROM nominations n JOIN users u ON u.id=n.student_id
       WHERE n.session_id=? ORDER BY u.name`,
      [req.params.id]
    );
    // If voting is closed or user is admin, include vote counts
    const session = await queryOne<any>('SELECT status FROM voting_sessions WHERE id=?', [req.params.id]);
    if (session?.status === 'closed' || req.user!.role !== 'student') {
      for (const c of candidates) {
        const count = await queryOne<any>('SELECT COUNT(*) AS c FROM votes WHERE candidate_id=?', [c.id]);
        c.vote_count = count?.c || 0;
      }
    }
    res.json({ candidates, session });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: cast vote
router.post('/vote', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { session_id, candidate_id } = req.body;
    const session = await queryOne<any>('SELECT status FROM voting_sessions WHERE id=?', [session_id]);
    if (!session || session.status !== 'open') {
      res.status(400).json({ message: 'Voting is not open' });
      return;
    }
    const existing = await queryOne<any>('SELECT id FROM votes WHERE session_id=? AND voter_id=?', [session_id, req.user!.id]);
    if (existing) {
      res.status(400).json({ message: 'You have already voted' });
      return;
    }
    await execute('INSERT INTO votes (session_id, candidate_id, voter_id) VALUES (?, ?, ?)',
      [session_id, candidate_id, req.user!.id]);
    res.json({ message: 'Vote cast successfully' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: delete session
router.delete('/sessions/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM voting_sessions WHERE id=?', [req.params.id]);
    res.json({ message: 'Session deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
