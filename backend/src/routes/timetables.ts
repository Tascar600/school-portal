import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

const dayOrder = `CASE t.day WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END`;

// Teacher: propose a timetable entry
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, subject_name, subject_id, day, start_time, end_time, room } = req.body;

    // If subject_name provided, find or create the subject
    let finalSubjectId = subject_id;
    if (subject_name && !subject_id) {
      const existing = await query<any[]>('SELECT id FROM subjects WHERE name = ? AND class_id = ?', [subject_name, class_id]);
      if (existing.length > 0) {
        finalSubjectId = existing[0].id;
      } else {
        // Auto-create subject for this class
        const teachers = await query<any[]>('SELECT id FROM users WHERE role = ? AND class_id = ? LIMIT 1', ['teacher', class_id]);
        const teacher_id = teachers[0]?.id || req.user!.id;
        const result = await execute('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?, ?, ?)',
          [subject_name, class_id, teacher_id]);
        finalSubjectId = result.insertId;
      }
    }

    if (!finalSubjectId) {
      return res.status(400).json({ message: 'Subject is required' });
    }

    await execute(
      'INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [class_id, finalSubjectId, req.user!.id, day, start_time, end_time, room || '']
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
       WHERE t.teacher_id = ? ORDER BY ${dayOrder}, t.start_time`,
      [req.user!.id]
    );
    res.json(entries);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: get all proposals for a class (draft + published)
router.get('/proposals/:classId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, u.name AS teacher_name FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN users u ON u.id = t.teacher_id
       WHERE t.class_id = ? ORDER BY ${dayOrder}, t.start_time`,
      [req.params.classId]
    );
    res.json(entries);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: get all timetable entries (all classes)
router.get('/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, c.name AS class_name, u.name AS teacher_name
       FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN classes c ON c.id = t.class_id
       JOIN users u ON u.id = t.teacher_id
       ORDER BY ${dayOrder}, t.start_time`
    );
    res.json(entries);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: update entry (edit fields + change status)
router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { subject_id, day, start_time, end_time, room, status } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (subject_id !== undefined) { updates.push('subject_id = ?'); params.push(subject_id); }
    if (day !== undefined) { updates.push('day = ?'); params.push(day); }
    if (start_time !== undefined) { updates.push('start_time = ?'); params.push(start_time); }
    if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time); }
    if (room !== undefined) { updates.push('room = ?'); params.push(room); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    await execute(`UPDATE timetables SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Timetable entry updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: publish all draft entries for a class (Generate Timetable)
router.post('/publish/:classId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    await execute("UPDATE timetables SET status = 'published' WHERE class_id = ? AND status = 'draft'", [classId]);

    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, u.name AS teacher_name FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN users u ON u.id = t.teacher_id
       WHERE t.class_id = ? AND t.status = 'published'
       ORDER BY ${dayOrder}, t.start_time`,
      [classId]
    );

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timetable: any = {};
    for (const day of days) {
      const dayEntries = entries.filter((e: any) => e.day === day);
      if (dayEntries.length > 0) timetable[day] = dayEntries;
    }

    res.json({
      class_id: classId,
      published_at: new Date().toISOString(),
      total_entries: entries.length,
      timetable,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: delete entry
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM timetables WHERE id = ?', [req.params.id]);
    res.json({ message: 'Timetable entry deleted' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get published timetables for a class (students, teachers, admin)
router.get('/class/:classId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entries = await query<any[]>(
      `SELECT t.*, s.name AS subject_name, u.name AS teacher_name FROM timetables t
       JOIN subjects s ON s.id = t.subject_id
       JOIN users u ON u.id = t.teacher_id
       WHERE t.class_id = ? AND t.status = 'published'
       ORDER BY ${dayOrder}, t.start_time`,
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
