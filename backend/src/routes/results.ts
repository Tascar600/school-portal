import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Teacher: create result
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, subject_id, term, academic_year, score, grade, remarks } = req.body;
    await execute(
      'INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, score, grade, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [student_id, subject_id, req.user!.id, term, academic_year, parseFloat(score), grade || '', remarks || '']
    );
    res.status(201).json({ message: 'Result created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: get results they entered
router.get('/entered', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const results = await query<any[]>(
      `SELECT r.*, s.name AS subject_name, u.name AS student_name
       FROM results r
       JOIN subjects s ON s.id = r.subject_id
       JOIN users u ON u.id = r.student_id
       WHERE r.teacher_id = ?
       ORDER BY r.created_at DESC`,
      [req.user!.id]
    );
    res.json(results);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: get own results
router.get('/my', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const results = await query<any[]>(
      `SELECT r.*, s.name AS subject_name, u.name AS teacher_name
       FROM results r
       JOIN subjects s ON s.id = r.subject_id
       JOIN users u ON u.id = r.teacher_id
       WHERE r.student_id = ?
       ORDER BY r.created_at DESC`,
      [req.user!.id]
    );
    res.json(results);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: get all results
router.get('/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const results = await query<any[]>(
      `SELECT r.*, s.name AS subject_name, u.name AS student_name, t.name AS teacher_name
       FROM results r
       JOIN subjects s ON s.id = r.subject_id
       JOIN users u ON u.id = r.student_id
       JOIN users t ON t.id = r.teacher_id
       ORDER BY r.created_at DESC`
    );
    res.json(results);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Edit result
router.put('/:id', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { score, grade, remarks } = req.body;
    await execute(
      'UPDATE results SET score = ?, grade = ?, remarks = ?, updated_at = ? WHERE id = ?',
      [parseFloat(score), grade || '', remarks || '', new Date().toISOString(), req.params.id]
    );
    res.json({ message: 'Result updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Delete result
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM results WHERE id = ?', [req.params.id]);
    res.json({ message: 'Result deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
