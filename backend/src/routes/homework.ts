import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { uploadHomework } from '../middleware/upload';

const router = Router();

// Teacher: create homework
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, subject_id, title, description, due_date } = req.body;
    await execute(
      'INSERT INTO homework (class_id, subject_id, teacher_id, title, description, due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [class_id, subject_id, req.user!.id, title, description || '', new Date(due_date).toISOString()]
    );
    res.status(201).json({ message: 'Homework assigned' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: get homework they created
router.get('/my-classes', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const homework = await query<any[]>(
      `SELECT h.*, s.name AS subject_name, c.name AS class_name,
       (SELECT COUNT(*) FROM homework_submissions WHERE homework_id = h.id) AS submission_count
       FROM homework h
       JOIN subjects s ON s.id = h.subject_id
       JOIN classes c ON c.id = h.class_id
       WHERE h.teacher_id = ?
       ORDER BY h.created_at DESC`,
      [req.user!.id]
    );
    res.json(homework);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: get homework for their class (with submission and grade info)
router.get('/my', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await query<any[]>('SELECT class_id FROM users WHERE id = ?', [req.user!.id]);
    const classId = student[0]?.class_id;
    if (!classId) { res.json([]); return; }

    const homework = await query<any[]>(
      `SELECT h.*, s.name AS subject_name, u.name AS teacher_name FROM homework h
       JOIN subjects s ON s.id = h.subject_id
       JOIN users u ON u.id = h.teacher_id
       WHERE h.class_id = ?
       ORDER BY h.due_date ASC`,
      [classId]
    );

    for (const h of homework) {
      const subs = await query<any[]>(
        'SELECT id, file, notes, submitted_at, grade, feedback FROM homework_submissions WHERE homework_id = ? AND student_id = ?',
        [h.id, req.user!.id]
      );
      h.submission = subs.length > 0 ? subs[0] : null;
    }
    res.json(homework);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: submit homework (file is optional)
router.post('/submit/:homeworkId', authenticate, authorize('student'), (req: AuthRequest, res: Response) => {
  uploadHomework(req, res, async (err) => {
    if (err) {
      res.status(400).json({ message: err.message });
      return;
    }
    try {
      const { notes } = req.body;
      const homeworkId = parseInt(req.params.homeworkId);

      const existing = await query<any[]>(
        'SELECT id FROM homework_submissions WHERE homework_id = ? AND student_id = ?',
        [homeworkId, req.user!.id]
      );
      if (existing.length > 0) {
        res.status(400).json({ message: 'Already submitted. Contact your teacher to resubmit.' });
        return;
      }

      const filePath = req.file ? '/uploads/homework/' + req.file.filename : '';
      await execute(
        'INSERT INTO homework_submissions (homework_id, student_id, file, notes) VALUES (?, ?, ?, ?)',
        [homeworkId, req.user!.id, filePath, notes || '']
      );
      res.status(201).json({ message: 'Homework submitted', file: filePath || 'no file' });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
});

// Teacher: view submissions for a homework (with stats)
router.get('/submissions/:homeworkId', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const homework = await queryOne<any>('SELECT * FROM homework WHERE id = ?', [req.params.homeworkId]);
    const subs = await query<any[]>(
      `SELECT hs.*, u.name AS student_name FROM homework_submissions hs
       JOIN users u ON u.id = hs.student_id
       WHERE hs.homework_id = ?
       ORDER BY hs.submitted_at`,
      [req.params.homeworkId]
    );
    res.json({ homework, submissions: subs });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: grade submission with marks and corrections
router.put('/grade/:submissionId', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { grade, feedback } = req.body;
    await execute(
      'UPDATE homework_submissions SET grade = ?, feedback = ? WHERE id = ?',
      [grade, feedback || '', req.params.submissionId]
    );
    res.json({ message: 'Submission graded. Student can now view marks and feedback.' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: delete homework
router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM homework WHERE id = ?', [req.params.id]);
    res.json({ message: 'Homework deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
