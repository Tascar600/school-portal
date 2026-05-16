import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Teacher: propose a timetable entry
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, subject_id, day, start_time, end_time, room } = req.body;
    await execute(
      'INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [class_id, subject_id, req.user!.id, day, start_time, end_time, room || '']
    );
    res.status(201).json({ message: 'Timetable entry proposed' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: get their proposed entries
router.get('/my', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, c.name AS class_name FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN classes c ON c.id = t.class_id
       WHERE t.teacher_id = ? ORDER BY t.day, t.start_time`,
      [req.user!.id]
    );
    res.json(entries);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: get all timetable entries
router.get('/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, c.name AS class_name, u.name AS teacher_name
       FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN classes c ON c.id = t.class_id
       JOIN users u ON u.id = t.teacher_id
       ORDER BY t.day, t.start_time`
    );
    res.json(entries);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: publish/draft timetable entry
router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    await execute('UPDATE timetables SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Timetable updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: delete entry
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM timetables WHERE id = ?', [req.params.id]);
    res.json({ message: 'Timetable entry deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: auto-generate timetable by class
router.post('/generate/:classId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, u.name AS teacher_name FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN users u ON u.id = t.teacher_id
       WHERE t.class_id = ? AND t.status = 'published'
       ORDER BY
         CASE t.day
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5 ELSE 6
         END, t.start_time`,
      [classId]
    );

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timetable: any = {};
    for (const day of days) {
      const dayEntries = entries.filter((e: any) => e.day === day);
      dayEntries.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      timetable[day] = dayEntries;
    }

    res.json({
      class_id: classId,
      generated_at: new Date().toISOString(),
      total_entries: entries.length,
      timetable,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get published timetables for a class
router.get('/class/:classId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, u.name AS teacher_name FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN users u ON u.id = t.teacher_id
       WHERE t.class_id = ? AND t.status = 'published'
       ORDER BY
         CASE t.day
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5 ELSE 6
         END, t.start_time`,
      [req.params.classId]
    );
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const organized: any = {};
    for (const day of days) {
      const dayEntries = entries.filter((e: any) => e.day === day);
      if (dayEntries.length > 0) organized[day] = dayEntries;
    }
    res.json({ entries, organized });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
