import { Router, Response } from 'express';
import fs from 'fs';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { uploadHomework } from '../middleware/upload';
import { teacherOwnsClass, studentInClass } from '../utils/ownership';

// Homework belongs to the teacher who set it.
async function ownsHomework(req: AuthRequest, homeworkId: number | string): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
  const hw = await queryOne<any>('SELECT teacher_id FROM homework WHERE id = ?', [homeworkId]);
  return !!hw && hw.teacher_id === req.user!.id;
}

const router = Router();

// Teacher: create homework
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, subject_id, title, description, due_date } = req.body;
    if (!(await teacherOwnsClass(req.user!.id, Number(class_id)))) {
      return res.status(403).json({ message: 'You can only set homework for your own class' });
    }
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
    // A rejected submission must not leave its uploaded file behind.
    const reject = async (status: number, message: string) => {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      res.status(status).json({ message });
    };
    try {
      const { notes } = req.body;
      const homeworkId = parseInt(req.params.homeworkId);

      const hw = await queryOne<any>('SELECT class_id FROM homework WHERE id = ?', [homeworkId]);
      if (!hw) { await reject(404, 'Homework not found'); return; }
      if (!(await studentInClass(req.user!.id, hw.class_id))) { await reject(403, 'This homework is not for your class'); return; }

      const existing = await query<any[]>(
        'SELECT id FROM homework_submissions WHERE homework_id = ? AND student_id = ?',
        [homeworkId, req.user!.id]
      );
      if (existing.length > 0) {
        await reject(400, 'Already submitted. Contact your teacher to resubmit.');
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
    if (!(await ownsHomework(req, req.params.homeworkId))) return res.status(403).json({ message: 'This is not your homework' });
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
    const sub = await queryOne<any>('SELECT homework_id FROM homework_submissions WHERE id = ?', [req.params.submissionId]);
    if (!sub) return res.status(404).json({ message: 'Submission not found' });
    if (!(await ownsHomework(req, sub.homework_id))) return res.status(403).json({ message: 'This is not your homework' });
    if (grade !== null && grade !== undefined && grade !== '' && !Number.isFinite(Number(grade))) {
      return res.status(400).json({ message: 'Grade must be a number' });
    }
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
    if (!(await ownsHomework(req, req.params.id))) return res.status(403).json({ message: 'This is not your homework' });
    await execute('DELETE FROM homework WHERE id = ?', [req.params.id]);
    res.json({ message: 'Homework deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
