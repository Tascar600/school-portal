import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Teacher: create course
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, class_id, day_of_week, start_time, end_time } = req.body;
    await execute(
      'INSERT INTO courses (name, description, teacher_id, class_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description || '', req.user!.id, class_id, day_of_week || '', start_time || '', end_time || '']
    );
    res.status(201).json({ message: 'Course created. Students in this class can now view it.' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: get courses they created
router.get('/my', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const courses = await query<any[]>(
      `SELECT c.*, cls.name AS class_name,
       (SELECT COUNT(*) FROM users WHERE class_id = c.class_id AND role = 'student') AS enrolled_count
       FROM courses c
       JOIN classes cls ON cls.id = c.class_id
       WHERE c.teacher_id = ?
       ORDER BY c.created_at DESC`,
      [req.user!.id]
    );
    res.json(courses);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: get courses for their class
router.get('/enrolled', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await query<any[]>('SELECT class_id FROM users WHERE id = ?', [req.user!.id]);
    if (!student[0]?.class_id) { res.json([]); return; }
    const courses = await query<any[]>(
      `SELECT c.*, u.name AS teacher_name FROM courses c
       JOIN users u ON u.id = c.teacher_id
       WHERE c.class_id = ?
       ORDER BY c.created_at DESC`,
      [student[0].class_id]
    );
    res.json(courses);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get courses by class id (for any role)
router.get('/class/:classId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const courses = await query<any[]>(
      `SELECT c.*, u.name AS teacher_name FROM courses c
       JOIN users u ON u.id = c.teacher_id
       WHERE c.class_id = ?
       ORDER BY c.created_at DESC`,
      [req.params.classId]
    );
    res.json(courses);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: update course
router.put('/:id', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, day_of_week, start_time, end_time } = req.body;
    await execute(
      'UPDATE courses SET name = ?, description = ?, day_of_week = ?, start_time = ?, end_time = ? WHERE id = ? AND teacher_id = ?',
      [name, description, day_of_week || '', start_time || '', end_time || '', req.params.id, req.user!.id]
    );
    res.json({ message: 'Course updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Delete course
router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM courses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Course deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
