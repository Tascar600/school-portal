import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Teacher: create/update result for a student+subject+term
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, subject_id, subject_name, term, academic_year, coursework, test_score, exam, grade, remarks } = req.body;
    const total = (parseFloat(coursework || 0) + parseFloat(test_score || 0) + parseFloat(exam || 0)).toFixed(1);
    const existing = await query<any[]>('SELECT id FROM results WHERE student_id=? AND subject_id=? AND term=? AND academic_year=?', 
      [student_id, subject_id, term, academic_year]);
    if (existing.length > 0) {
      await execute(
        'UPDATE results SET coursework=?, test_score=?, exam=?, score=?, grade=?, remarks=?, subject_name=?, updated_at=? WHERE id=?',
        [parseFloat(coursework || 0), parseFloat(test_score || 0), parseFloat(exam || 0), parseFloat(total), grade || '', remarks || '', subject_name || '', new Date().toISOString(), existing[0].id]
      );
      res.json({ message: 'Result updated' });
    } else {
      await execute(
        'INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, coursework, test_score, exam, score, grade, remarks, subject_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [student_id, subject_id, req.user!.id, term, academic_year, parseFloat(coursework || 0), parseFloat(test_score || 0), parseFloat(exam || 0), parseFloat(total), grade || '', remarks || '', subject_name || '']
      );
      res.status(201).json({ message: 'Result created' });
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: get results they entered
router.get('/entered', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { term, status } = req.query;
    let sql = `SELECT r.*, s.name AS subject_name, u.name AS student_name FROM results r
               JOIN subjects s ON s.id = r.subject_id
               JOIN users u ON u.id = r.student_id WHERE r.teacher_id=?`;
    const params: any[] = [req.user!.id];
    if (term) { sql += ' AND r.term=?'; params.push(term); }
    if (status) { sql += ' AND r.status=?'; params.push(status); }
    sql += ' ORDER BY r.created_at DESC';
    const results = await query<any[]>(sql, params);
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
       WHERE r.student_id = ? ORDER BY r.academic_year DESC, r.term DESC, s.name`,
      [req.user!.id]
    );
    res.json(results);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: get all results with filtering
router.get('/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, term, student_id } = req.query;
    let sql = `SELECT r.*, s.name AS subject_name, u.name AS student_name, t.name AS teacher_name, u2.class_id
               FROM results r
               JOIN subjects s ON s.id = r.subject_id
               JOIN users u ON u.id = r.student_id
               JOIN users t ON t.id = r.teacher_id
               JOIN users u2 ON u2.id = r.student_id WHERE 1=1`;
    const params: any[] = [];
    if (class_id) { sql += ' AND u2.class_id=?'; params.push(class_id); }
    if (term) { sql += ' AND r.term=?'; params.push(term); }
    if (student_id) { sql += ' AND r.student_id=?'; params.push(student_id); }
    sql += ' ORDER BY r.academic_year DESC, r.term DESC, u.name';
    const results = await query<any[]>(sql, params);
    res.json(results);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get class performance summary
router.get('/class-summary/:classId', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { term, academic_year } = req.query;
    const summary = await query<any[]>(
      `SELECT r.student_id, u.name AS student_name, u.student_number,
              AVG(r.score) AS avg_score, COUNT(r.id) AS subjects_count,
              SUM(CASE WHEN r.score>=75 THEN 1 ELSE 0 END) AS As,
              SUM(CASE WHEN r.score>=65 AND r.score<75 THEN 1 ELSE 0 END) AS Bs,
              SUM(CASE WHEN r.score>=50 AND r.score<65 THEN 1 ELSE 0 END) AS Cs,
              SUM(CASE WHEN r.score>=40 AND r.score<50 THEN 1 ELSE 0 END) AS Ds,
              SUM(CASE WHEN r.score<40 THEN 1 ELSE 0 END) AS Es
       FROM results r JOIN users u ON u.id=r.student_id
       WHERE u.class_id=? AND r.status='active'
       GROUP BY r.student_id ORDER BY avg_score DESC`,
      [req.params.classId]
    );
    res.json(summary);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get subject breakdown for a class
router.get('/subject-breakdown/:classId', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await query<any[]>(
      `SELECT r.subject_id, s.name AS subject_name,
              AVG(r.score) AS avg_score, MAX(r.score) AS max_score, MIN(r.score) AS min_score,
              AVG(r.coursework) AS avg_coursework, AVG(r.test_score) AS avg_test, AVG(r.exam) AS avg_exam,
              COUNT(r.id) AS entries
       FROM results r JOIN subjects s ON s.id=r.subject_id
       WHERE s.class_id=? AND r.status='active'
       GROUP BY r.subject_id`,
      [req.params.classId]
    );
    res.json(data);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student full stats
router.get('/student-stats/:studentId', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await query<any[]>('SELECT * FROM users WHERE id=?', [req.params.studentId]);
    if (!student.length) { res.status(404).json({ message: 'Student not found' }); return; }
    
    const results = await query<any[]>(
      `SELECT r.*, s.name AS subject_name FROM results r
       JOIN subjects s ON s.id=r.subject_id WHERE r.student_id=? ORDER BY r.term, s.name`,
      [req.params.studentId]
    );
    
    const attendance = await query<any[]>(
      `SELECT a.date, a.records FROM attendance a
       WHERE a.class_id=? ORDER BY a.date DESC LIMIT 60`,
      [student[0].class_id]
    );
    
    const myAttendance = [];
    for (const a of attendance) {
      const parsed = typeof a.records === 'string' ? JSON.parse(a.records) : a.records;
      const my = parsed.find((p: any) => p.student_id == req.params.studentId);
      if (my) myAttendance.push({ date: a.date, status: my.status });
    }
    
    const hwSubs = await query<any[]>(
      `SELECT h.title, hs.grade, hs.submitted_at FROM homework_submissions hs
       JOIN homework h ON h.id=hs.homework_id WHERE hs.student_id=? ORDER BY hs.submitted_at DESC`,
      [req.params.studentId]
    );
    
    const quizAttempts = await query<any[]>(
      `SELECT q.title, qa.score, qa.total, qa.attempted_at FROM quiz_attempts qa
       JOIN quizzes q ON q.id=qa.quiz_id WHERE qa.student_id=? ORDER BY qa.attempted_at DESC`,
      [req.params.studentId]
    );
    
    const sports = await query<any[]>(
      `SELECT sp.name, sp2.role FROM sport_participants sp2
       JOIN sports sp ON sp.id=sp2.sport_id WHERE sp2.student_id=?`,
      [req.params.studentId]
    );
    
    res.json({ student: student[0], results, attendance: myAttendance, homework: hwSubs, quizzes: quizAttempts, sports });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Report card for a student in a given term
router.get('/report-card/:studentId', authenticate, authorize('admin', 'teacher', 'student'), async (req: AuthRequest, res: Response) => {
  try {
    const { term, academic_year } = req.query;
    const [student] = await query<any[]>('SELECT u.*, c.name AS class_name FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.id=?', [req.params.studentId]);
    if (!student) { res.status(404).json({ message: 'Student not found' }); return; }

    const results = await query<any[]>(
      `SELECT r.*, s.name AS subject_name FROM results r
       JOIN subjects s ON s.id=r.subject_id
       WHERE r.student_id=? AND r.term=? AND r.academic_year=?
       ORDER BY s.name`,
      [req.params.studentId, term, academic_year]
    );

    const totalScore = results.reduce((sum: number, r: any) => sum + (parseFloat(r.coursework||0) + parseFloat(r.test_score||0) + parseFloat(r.exam||0)), 0);
    const avgScore = results.length ? Math.round(totalScore / results.length) : 0;

    const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const r of results) {
      const tot = parseFloat(r.coursework||0) + parseFloat(r.test_score||0) + parseFloat(r.exam||0);
      const g = tot >= 75 ? 'A' : tot >= 65 ? 'B' : tot >= 50 ? 'C' : tot >= 40 ? 'D' : 'E';
      gradeCounts[g]++;
    }

    res.json({ student, results, avgScore, gradeCounts, term, academic_year });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Term-end archive: archive all active results for a given term
router.post('/archive-term', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { term, academic_year } = req.body;
    await execute('UPDATE results SET status=? WHERE term=? AND academic_year=? AND status=?',
      ['archived', term, academic_year, 'active']);
    res.json({ message: `Term ${term} ${academic_year} results archived` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Edit result
router.put('/:id', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { coursework, test_score, exam, grade, remarks } = req.body;
    const total = (parseFloat(coursework || 0) + parseFloat(test_score || 0) + parseFloat(exam || 0)).toFixed(1);
    await execute(
      'UPDATE results SET coursework=?, test_score=?, exam=?, score=?, grade=?, remarks=?, updated_at=? WHERE id=?',
      [parseFloat(coursework || 0), parseFloat(test_score || 0), parseFloat(exam || 0), parseFloat(total), grade || '', remarks || '', new Date().toISOString(), req.params.id]
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
