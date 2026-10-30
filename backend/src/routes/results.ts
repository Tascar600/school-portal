import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { actingStudent, mayActFor } from '../utils/acting';
import { teacherTeachesStudent } from '../utils/ownership';
import { ALL_AREA_NAMES, CORE_AREA_NAMES, gradeFor } from '../config/curriculum';
import { getGradeScale, getWeights } from '../utils/settings';

const router = Router();

const num = (v: any) => (v === '' || v === null || v === undefined ? 0 : Number(v));

// Adds total, grade, unit and descriptor (from the school's current grading scale) to result rows.
async function withGrades(rows: any[]): Promise<any[]> {
  const scale = await getGradeScale();
  return rows.map((r) => {
    const total = Math.round((num(r.coursework) + num(r.test_score) + num(r.exam)) * 10) / 10;
    const g = gradeFor(total, scale);
    return { ...r, total, grade: g.grade, unit: g.unit, descriptor: g.descriptor, core: CORE_AREA_NAMES.includes(r.subject_name) };
  });
}

// Each part of a learning area has its own maximum; together they make a mark out of 100.
async function marksProblem(project: number, test: number, exam: number): Promise<string | null> {
  const w = await getWeights();
  for (const [label, value, max] of [['School-Based Project', project, w.project], ['Test', test, w.test], ['Exam', exam, w.exam]] as const) {
    if (!Number.isFinite(value) || value < 0) return `${label} must be a number of 0 or more`;
    if (value > max) return `${label} cannot be more than ${max}`;
  }
  return null;
}

async function teacherClassId(userId: number): Promise<number | null> {
  const t = await queryOne<any>('SELECT class_id FROM users WHERE id = ?', [userId]);
  return t?.class_id ?? null;
}

// Finds the learning area in the pupil's class (they are created for every class automatically).
async function subjectFor(classId: number, name: string): Promise<{ id: number; name: string } | null> {
  const clean = name.trim().toLowerCase();
  const official = ALL_AREA_NAMES.find((n) => n.toLowerCase() === clean);
  if (!official) return null;
  const s = await queryOne<any>('SELECT id, name FROM subjects WHERE class_id = ? AND name = ?', [classId, official]);
  return s || null;
}

// Student list: admin sees everyone, a teacher sees their own class
router.get('/students', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const isTeacher = req.user!.role === 'teacher';
    const me = isTeacher ? await queryOne<any>('SELECT class_id FROM users WHERE id = ?', [req.user!.id]) : null;
    const students = await query<any[]>(
      `SELECT id, name, email, class_id, student_number FROM users WHERE role='student'${isTeacher ? ' AND class_id = ?' : ''} ORDER BY name`,
      isTeacher ? [me?.class_id ?? -1] : []
    );
    res.json(students);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: save one learning-area result for one pupil
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, subject_name, term, academic_year, coursework, test_score, exam, remarks, project_title } = req.body;
    if (!student_id || !term || !academic_year || !String(subject_name || '').trim()) {
      return res.status(400).json({ message: 'Pupil, learning area, term and year are required' });
    }
    if (!(await teacherTeachesStudent(req.user!.id, Number(student_id)))) {
      return res.status(403).json({ message: 'You can only enter results for pupils in your own class' });
    }
    const pupil = await queryOne<any>('SELECT class_id FROM users WHERE id = ?', [student_id]);
    const subject = await subjectFor(pupil.class_id, String(subject_name));
    if (!subject) return res.status(400).json({ message: 'Choose one of the Heritage-Based Curriculum learning areas: ' + ALL_AREA_NAMES.join(', ') });
    const project = num(coursework), test = num(test_score), ex = num(exam);
    const problem = await marksProblem(project, test, ex);
    if (problem) return res.status(400).json({ message: problem });

    const total = project + test + ex;
    const g = gradeFor(total, await getGradeScale());
    const existing = await query<any[]>('SELECT id FROM results WHERE student_id=? AND subject_id=? AND term=? AND academic_year=?', [student_id, subject.id, term, academic_year]);
    if (existing.length > 0) {
      await execute(
        'UPDATE results SET coursework=?, test_score=?, exam=?, score=?, grade=?, remarks=?, subject_name=?, project_title=?, updated_at=? WHERE id=?',
        [project, test, ex, total, g.grade, remarks || '', subject.name, project_title || '', new Date().toISOString(), existing[0].id]
      );
      res.json({ message: 'Result updated' });
    } else {
      await execute(
        'INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, coursework, test_score, exam, score, grade, remarks, subject_name, project_title) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [student_id, subject.id, req.user!.id, term, academic_year, project, test, ex, total, g.grade, remarks || '', subject.name, project_title || '']
      );
      res.status(201).json({ message: 'Result created' });
    }
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: the mark sheet for one learning area (every pupil in the class, with any marks already saved)
router.get('/sheet', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { subject, term, academic_year } = req.query as Record<string, string>;
    const classId = await teacherClassId(req.user!.id);
    if (!classId) return res.status(400).json({ message: 'You have not been given a class yet' });
    const sub = await subjectFor(classId, subject || '');
    if (!sub) return res.status(400).json({ message: 'Choose a learning area' });
    const rows = await query<any[]>(
      `SELECT u.id, u.name, u.student_number, r.coursework, r.test_score, r.exam, r.project_title, r.remarks
       FROM users u LEFT JOIN results r ON r.student_id = u.id AND r.subject_id = ? AND r.term = ? AND r.academic_year = ?
       WHERE u.role = 'student' AND u.class_id = ? ORDER BY u.name`,
      [sub.id, term, academic_year, classId]
    );
    res.json({ subject: sub.name, weights: await getWeights(), rows: await withGrades(rows.map((r) => ({ ...r, subject_name: sub.name }))) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: save the whole mark sheet at once
router.post('/bulk', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { subject_name, term, academic_year, project_title, entries } = req.body;
    if (!Array.isArray(entries) || !term || !academic_year) return res.status(400).json({ message: 'Learning area, term, year and marks are required' });
    const classId = await teacherClassId(req.user!.id);
    if (!classId) return res.status(400).json({ message: 'You have not been given a class yet' });
    const subject = await subjectFor(classId, String(subject_name || ''));
    if (!subject) return res.status(400).json({ message: 'Choose one of the Heritage-Based Curriculum learning areas' });
    const scale = await getGradeScale();
    const classmates = new Set((await query<any[]>("SELECT id FROM users WHERE role='student' AND class_id = ?", [classId])).map((r) => r.id));

    // Check everything first, so a typo on row 20 does not leave 19 rows saved.
    const clean: any[] = [];
    for (const e of entries) {
      const blank = (v: any) => v === '' || v === null || v === undefined;
      if (blank(e.coursework) && blank(e.test_score) && blank(e.exam)) continue; // not marked yet
      if (!classmates.has(Number(e.student_id))) return res.status(403).json({ message: 'That list includes a pupil who is not in your class' });
      const p = num(e.coursework), t = num(e.test_score), x = num(e.exam);
      const problem = await marksProblem(p, t, x);
      if (problem) {
        const who = await queryOne<any>('SELECT name FROM users WHERE id = ?', [e.student_id]);
        return res.status(400).json({ message: `${who?.name || 'Pupil'}: ${problem}` });
      }
      clean.push({ id: Number(e.student_id), p, t, x, remarks: e.remarks || '' });
    }
    let created = 0, updated = 0;
    for (const c of clean) {
      const total = c.p + c.t + c.x;
      const g = gradeFor(total, scale);
      const existing = await queryOne<any>('SELECT id FROM results WHERE student_id=? AND subject_id=? AND term=? AND academic_year=?', [c.id, subject.id, term, academic_year]);
      if (existing) {
        await execute('UPDATE results SET coursework=?, test_score=?, exam=?, score=?, grade=?, remarks=?, subject_name=?, project_title=?, updated_at=? WHERE id=?',
          [c.p, c.t, c.x, total, g.grade, c.remarks, subject.name, project_title || '', new Date().toISOString(), existing.id]);
        updated++;
      } else {
        await execute('INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, coursework, test_score, exam, score, grade, remarks, subject_name, project_title) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [c.id, subject.id, req.user!.id, term, academic_year, c.p, c.t, c.x, total, g.grade, c.remarks, subject.name, project_title || '']);
        created++;
      }
    }
    res.json({ message: `${subject.name}: ${created} new, ${updated} updated`, created, updated });
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
    res.json(await withGrades(await query<any[]>(sql, params)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: get own results
router.get('/my', authenticate, authorize('student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const sid = await actingStudent(req, res); if (sid === null) return;
    const results = await query<any[]>(
      `SELECT r.*, s.name AS subject_name, u.name AS teacher_name
       FROM results r
       JOIN subjects s ON s.id = r.subject_id
       JOIN users u ON u.id = r.teacher_id
       WHERE r.student_id = ? ORDER BY r.academic_year DESC, r.term DESC, s.name`,
      [sid]
    );
    res.json(await withGrades(results));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: get all results with filtering
router.get('/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, term, student_id, academic_year } = req.query;
    let sql = `SELECT r.*, s.name AS subject_name, u.name AS student_name, t.name AS teacher_name, u2.class_id
               FROM results r
               JOIN subjects s ON s.id = r.subject_id
               JOIN users u ON u.id = r.student_id
               JOIN users t ON t.id = r.teacher_id
               JOIN users u2 ON u2.id = r.student_id WHERE 1=1`;
    const params: any[] = [];
    if (class_id) { sql += ' AND u2.class_id=?'; params.push(class_id); }
    if (term) { sql += ' AND r.term=?'; params.push(term); }
    if (academic_year) { sql += ' AND r.academic_year=?'; params.push(academic_year); }
    if (student_id) { sql += ' AND r.student_id=?'; params.push(student_id); }
    sql += ' ORDER BY r.academic_year DESC, r.term DESC, u.name';
    res.json(await withGrades(await query<any[]>(sql, params)));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Average (of the six core learning areas) and position for every pupil in a class
async function classRanking(classId: number, term: string, year: string) {
  const rows = await query<any[]>(
    `SELECT r.student_id, u.name AS student_name, u.student_number, r.coursework, r.test_score, r.exam, s.name AS subject_name
     FROM results r JOIN subjects s ON s.id = r.subject_id JOIN users u ON u.id = r.student_id
     WHERE u.class_id = ? AND r.term = ? AND r.academic_year = ? AND r.status = 'active'`,
    [classId, term, year]
  );
  const scale = await getGradeScale();
  type Entry = { id: number; name: string; student_number: string; totals: number[]; grades: Record<string, number> };
  const byStudent = new Map<number, Entry>();
  for (const r of rows) {
    const total = num(r.coursework) + num(r.test_score) + num(r.exam);
    const e: Entry = byStudent.get(r.student_id) || { id: r.student_id, name: r.student_name, student_number: r.student_number, totals: [], grades: {} };
    if (CORE_AREA_NAMES.includes(r.subject_name)) {
      e.totals.push(total);
      const g = gradeFor(total, scale).grade;
      e.grades[g] = (e.grades[g] || 0) + 1;
    }
    byStudent.set(r.student_id, e);
  }
  const list = [...byStudent.values()].filter((e) => e.totals.length > 0)
    .map((e) => ({ ...e, average: Math.round((e.totals.reduce((a, b) => a + b, 0) / e.totals.length) * 10) / 10 }))
    .sort((a, b) => b.average - a.average);
  let pos = 0, last = Infinity, seen = 0;
  return list.map((e) => { seen++; if (e.average !== last) { pos = seen; last = e.average; } return { ...e, position: pos }; });
}

// Class performance summary (core learning areas), ranked
router.get('/class-summary/:classId', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const classId = Number(req.params.classId);
    const year = String(req.query.academic_year || new Date().getFullYear());
    let term = req.query.term ? String(req.query.term) : '';
    if (!term) {
      const latest = await queryOne<any>(
        `SELECT r.term FROM results r JOIN users u ON u.id = r.student_id WHERE u.class_id = ? AND r.academic_year = ? AND r.status = 'active' ORDER BY r.term DESC LIMIT 1`,
        [classId, year]
      );
      term = latest?.term || 'Term 1';
    }
    const ranking = await classRanking(classId, term, year);
    res.json(ranking.map((e) => ({
      student_id: e.id, student_name: e.name, student_number: e.student_number,
      avg_score: e.average, subjects_count: e.totals.length, position: e.position, term, academic_year: year,
      As: e.grades.A || 0, Bs: e.grades.B || 0, Cs: e.grades.C || 0, Ds: e.grades.D || 0, Es: e.grades.E || 0, Us: e.grades.U || 0,
    })));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Subject breakdown for a class
router.get('/subject-breakdown/:classId', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { term, academic_year } = req.query;
    let sql = `SELECT r.subject_id, s.name AS subject_name,
              AVG(r.score) AS avg_score, MAX(r.score) AS max_score, MIN(r.score) AS min_score,
              AVG(r.coursework) AS avg_coursework, AVG(r.test_score) AS avg_test, AVG(r.exam) AS avg_exam,
              COUNT(r.id) AS entries
       FROM results r JOIN subjects s ON s.id=r.subject_id
       WHERE s.class_id=? AND r.status='active'`;
    const params: any[] = [req.params.classId];
    if (term) { sql += ' AND r.term = ?'; params.push(term); }
    if (academic_year) { sql += ' AND r.academic_year = ?'; params.push(academic_year); }
    sql += ' GROUP BY r.subject_id ORDER BY s.name';
    res.json(await query<any[]>(sql, params));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student full stats
router.get('/student-stats/:studentId', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await query<any[]>('SELECT id, name, email, role, class_id, student_number FROM users WHERE id=?', [req.params.studentId]);
    if (!student.length) { res.status(404).json({ message: 'Student not found' }); return; }
    if (req.user!.role === 'teacher' && !(await teacherTeachesStudent(req.user!.id, Number(req.params.studentId)))) {
      res.status(403).json({ message: 'You can only view pupils in your own class' }); return;
    }

    const results = await withGrades(await query<any[]>(
      `SELECT r.*, s.name AS subject_name FROM results r
       JOIN subjects s ON s.id=r.subject_id WHERE r.student_id=? ORDER BY r.academic_year, r.term, s.name`,
      [req.params.studentId]
    ));

    const attendance = await query<any[]>(`SELECT a.date, a.records FROM attendance a WHERE a.class_id=? ORDER BY a.date DESC LIMIT 60`, [student[0].class_id]);
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

// Report card for a pupil in a given term
router.get('/report-card/:studentId', authenticate, authorize('admin', 'teacher', 'student', 'parent'), async (req: AuthRequest, res: Response) => {
  try {
    const { term, academic_year } = req.query as Record<string, string>;
    const studentId = Number(req.params.studentId);
    if ((req.user!.role === 'student' || req.user!.role === 'parent') && !(await mayActFor(req, studentId))) {
      res.status(403).json({ message: 'You can only view your own report card' }); return;
    }
    if (req.user!.role === 'teacher' && !(await teacherTeachesStudent(req.user!.id, studentId))) {
      res.status(403).json({ message: 'You can only view pupils in your own class' }); return;
    }
    const [student] = await query<any[]>(
      'SELECT u.id, u.name, u.email, u.role, u.class_id, u.student_number, c.name AS class_name FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.id=?',
      [studentId]
    );
    if (!student) { res.status(404).json({ message: 'Student not found' }); return; }

    const all = await withGrades(await query<any[]>(
      `SELECT r.*, s.name AS subject_name, t.name AS teacher_name FROM results r
       JOIN subjects s ON s.id=r.subject_id LEFT JOIN users t ON t.id = r.teacher_id
       WHERE r.student_id=? AND r.term=? AND r.academic_year=? ORDER BY s.name`,
      [studentId, term, academic_year]
    ));
    // Core learning areas in curriculum order, then the additional subject
    const order = (n: string) => ALL_AREA_NAMES.indexOf(n);
    const results = all.sort((a, b) => order(a.subject_name) - order(b.subject_name));
    const core = results.filter((r) => r.core);

    const ranking = student.class_id ? await classRanking(student.class_id, term, academic_year) : [];
    const mine = ranking.find((r) => r.id === studentId);
    const average = core.length ? Math.round((core.reduce((s, r) => s + r.total, 0) / core.length) * 10) / 10 : 0;
    const scale = await getGradeScale();
    const overall = gradeFor(average, scale);

    const gradeCounts: Record<string, number> = {};
    for (const r of core) gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;

    // Attendance for the term (or the whole year when the bursar has not set term dates)
    const termNo = parseInt(String(term).replace(/\D/g, ''), 10);
    const termRow = termNo ? await queryOne<any>('SELECT start_date, end_date FROM terms WHERE year = ? AND term_no = ?', [academic_year, termNo]) : null;
    const from = termRow?.start_date || `${academic_year}-01-01`;
    const to = termRow?.end_date || `${academic_year}-12-31`;
    const days = student.class_id
      ? await query<any[]>('SELECT records FROM attendance WHERE class_id = ? AND date >= ? AND date <= ?', [student.class_id, from, to])
      : [];
    const att = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    for (const d of days) {
      const rec = (typeof d.records === 'string' ? JSON.parse(d.records) : d.records).find((p: any) => p.student_id === studentId);
      if (rec && rec.status in att) { (att as any)[rec.status]++; att.total++; }
    }

    const comments = await queryOne<any>('SELECT teacher_comment, head_comment FROM report_comments WHERE student_id = ? AND term = ? AND academic_year = ?', [studentId, term, academic_year]);
    const teacher = student.class_id ? await queryOne<any>("SELECT name FROM users WHERE role='teacher' AND class_id = ? LIMIT 1", [student.class_id]) : null;

    res.json({
      student, results, term, academic_year,
      average, avgScore: Math.round(average), overall_grade: overall.grade, overall_unit: overall.unit,
      total_marks: core.reduce((s, r) => s + r.total, 0), core_count: core.length,
      position: mine?.position ?? null, class_size: ranking.length,
      gradeCounts, attendance: att, period: { from, to },
      comments: comments || { teacher_comment: '', head_comment: '' },
      class_teacher: teacher?.name || '',
      scale,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Comments printed on the report card
router.put('/comments/:studentId', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = Number(req.params.studentId);
    const { term, academic_year, teacher_comment, head_comment } = req.body;
    if (!term || !academic_year) return res.status(400).json({ message: 'Term and year are required' });
    if (req.user!.role === 'teacher' && !(await teacherTeachesStudent(req.user!.id, studentId))) {
      return res.status(403).json({ message: 'You can only comment on pupils in your own class' });
    }
    const existing = await queryOne<any>('SELECT * FROM report_comments WHERE student_id = ? AND term = ? AND academic_year = ?', [studentId, term, academic_year]);
    const teacherText = teacher_comment !== undefined ? String(teacher_comment) : existing?.teacher_comment || '';
    const headText = req.user!.role === 'admin' && head_comment !== undefined ? String(head_comment) : existing?.head_comment || '';
    if (existing) {
      await execute("UPDATE report_comments SET teacher_comment = ?, head_comment = ?, updated_at = datetime('now') WHERE student_id = ? AND term = ? AND academic_year = ?", [teacherText, headText, studentId, term, academic_year]);
    } else {
      await execute('INSERT INTO report_comments (student_id, term, academic_year, teacher_comment, head_comment) VALUES (?,?,?,?,?)', [studentId, term, academic_year, teacherText, headText]);
    }
    res.json({ message: 'Comment saved' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Term-end archive: archive all active results for a given term
// The first and last day of a term: the bursar's term dates when they are set, otherwise the whole calendar year
async function termDates(term: string, year: string): Promise<{ from: string; to: string }> {
  const termNo = parseInt(String(term).replace(/\D/g, ''), 10);
  const row = termNo ? await queryOne<any>('SELECT start_date, end_date FROM terms WHERE year = ? AND term_no = ?', [year, termNo]) : null;
  return { from: row?.start_date || `${year}-01-01`, to: row?.end_date || `${year}-12-31` };
}

// Attendance of a class over a period: "present" counts present and late days; excused days are left out
async function classAttendance(classId: number, from: string, to: string) {
  const days = await query<any[]>('SELECT records FROM attendance WHERE class_id = ? AND date >= ? AND date <= ?', [classId, from, to]);
  const t = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const d of days) {
    for (const p of (typeof d.records === 'string' ? JSON.parse(d.records) : d.records) as any[]) if (p.status in t) (t as any)[p.status]++;
  }
  const counted = t.present + t.late + t.absent;
  return { ...t, days: days.length, rate: counted ? Math.round(((t.present + t.late) / counted) * 1000) / 10 : null };
}

// Admin: every class side by side for one term (the head's end-of-term view), with the change since the term before
router.get('/class-comparison', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const term = String(req.query.term || '');
    const year = String(req.query.academic_year || new Date().getFullYear());
    if (!/^Term [123]$/.test(term)) return res.status(400).json({ message: 'Choose Term 1, Term 2 or Term 3' });
    const no = Number(term.slice(5));
    const before = no > 1 ? { term: `Term ${no - 1}`, year } : { term: 'Term 3', year: String(Number(year) - 1) };
    const scale = await getGradeScale();
    const { from, to } = await termDates(term, year);

    const classes = await query<any[]>('SELECT id, name FROM classes ORDER BY id');
    const pupilCount = new Map((await query<any[]>("SELECT class_id, COUNT(*) AS n FROM users WHERE role = 'student' AND archived = 0 AND class_id IS NOT NULL GROUP BY class_id")).map((r) => [r.class_id, r.n]));
    const areaRows = await query<any[]>(
      `SELECT s.class_id, s.name AS area, AVG(r.coursework + r.test_score + r.exam) AS average
       FROM results r JOIN subjects s ON s.id = r.subject_id
       WHERE r.term = ? AND r.academic_year = ? AND r.status = 'active' GROUP BY s.class_id, s.name`, [term, year]);
    const areaAvg = new Map<string, number>(areaRows.map((r) => [`${r.class_id}|${r.area}`, Math.round(r.average * 10) / 10]));

    const out: any[] = [];
    for (const c of classes) {
      const ranking = await classRanking(c.id, term, year);
      const previous = await classRanking(c.id, before.term, before.year);
      const mean = (l: { average: number }[]) => (l.length ? Math.round((l.reduce((s, p) => s + p.average, 0) / l.length) * 10) / 10 : null);
      const average = mean(ranking), prevAverage = mean(previous);
      const g = average === null ? null : gradeFor(average, scale);
      out.push({
        id: c.id, name: c.name, pupils: pupilCount.get(c.id) || 0, marked: ranking.length,
        average, grade: g?.grade ?? null, unit: g?.unit ?? null,
        previousAverage: prevAverage, change: average !== null && prevAverage !== null ? Math.round((average - prevAverage) * 10) / 10 : null,
        attendance: await classAttendance(c.id, from, to),
        top: ranking[0] ? { name: ranking[0].name, average: ranking[0].average } : null,
        areas: Object.fromEntries(ALL_AREA_NAMES.map((a) => [a, areaAvg.get(`${c.id}|${a}`) ?? null])),
      });
    }
    const withMarks = out.filter((c) => c.average !== null);
    const marked = withMarks.reduce((s, c) => s + c.marked, 0);
    const school = marked ? Math.round((withMarks.reduce((s, c) => s + c.average * c.marked, 0) / marked) * 10) / 10 : null;
    res.json({ term, academic_year: year, previous: before, period: { from, to }, areas: ALL_AREA_NAMES, core: CORE_AREA_NAMES, classes: out, school: { average: school, marked, grade: school === null ? null : gradeFor(school, scale).grade } });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/archive-term', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { term, academic_year } = req.body;
    await execute('UPDATE results SET status=? WHERE term=? AND academic_year=? AND status=?', ['archived', term, academic_year, 'active']);
    res.json({ message: `Term ${term} ${academic_year} results archived` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Edit result
router.put('/:id', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { coursework, test_score, exam, remarks, project_title } = req.body;
    if (req.user!.role === 'teacher') {
      const row = await queryOne<any>('SELECT teacher_id FROM results WHERE id = ?', [req.params.id]);
      if (!row) { res.status(404).json({ message: 'Result not found' }); return; }
      if (row.teacher_id !== req.user!.id) { res.status(403).json({ message: 'You can only edit results you entered' }); return; }
    }
    const p = num(coursework), t = num(test_score), x = num(exam);
    const problem = await marksProblem(p, t, x);
    if (problem) { res.status(400).json({ message: problem }); return; }
    const total = p + t + x;
    const g = gradeFor(total, await getGradeScale());
    await execute(
      'UPDATE results SET coursework=?, test_score=?, exam=?, score=?, grade=?, remarks=?, project_title=?, updated_at=? WHERE id=?',
      [p, t, x, total, g.grade, remarks || '', project_title || '', new Date().toISOString(), req.params.id]
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
