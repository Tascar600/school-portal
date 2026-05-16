import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Teacher: mark attendance
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, subject_id, date, records } = req.body;
    // records: [{student_id, status}], status: present|absent|late|excused
    const existing = await query<any[]>(
      'SELECT id FROM attendance WHERE teacher_id=? AND class_id=? AND date=?',
      [req.user!.id, class_id, date]
    );
    if (existing.length > 0) {
      await execute(
        'UPDATE attendance SET records=? WHERE id=?',
        [JSON.stringify(records), existing[0].id]
      );
    } else {
      await execute(
        'INSERT INTO attendance (class_id, subject_id, teacher_id, date, records) VALUES (?, ?, ?, ?, ?)',
        [class_id, subject_id || null, req.user!.id, date, JSON.stringify(records)]
      );
    }
    res.json({ message: 'Attendance saved' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: get attendance records
router.get('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, date } = req.query;
    let sql = 'SELECT * FROM attendance WHERE teacher_id=?';
    const params: any[] = [req.user!.id];
    if (class_id) { sql += ' AND class_id=?'; params.push(class_id); }
    if (date) { sql += ' AND date=?'; params.push(date); }
    sql += ' ORDER BY date DESC';
    const records = await query<any[]>(sql, params);
    // Parse records JSON
    for (const r of records) {
      r.records = typeof r.records === 'string' ? JSON.parse(r.records) : r.records;
    }
    res.json(records);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: view own attendance
router.get('/my', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await queryOne<any>('SELECT class_id FROM users WHERE id=?', [req.user!.id]);
    if (!student?.class_id) { res.json([]); return; }
    const records = await query<any[]>(
      'SELECT * FROM attendance WHERE class_id=? ORDER BY date DESC LIMIT 50',
      [student.class_id]
    );
    const myRecords = [];
    for (const r of records) {
      const parsed = typeof r.records === 'string' ? JSON.parse(r.records) : r.records;
      const myRec = parsed.find((p: any) => p.student_id === req.user!.id);
      if (myRec) {
        myRecords.push({ date: r.date, subject_id: r.subject_id, status: myRec.status, class_id: r.class_id });
      }
    }
    res.json(myRecords);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get students in a class (for marking register)
router.get('/students/:classId', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const students = await query<any[]>(
      'SELECT id, name FROM users WHERE role=? AND class_id=? ORDER BY name',
      ['student', req.params.classId]
    );
    res.json(students);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
