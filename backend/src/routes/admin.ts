import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { query, execute, dbPath, ensureSubjectsForClass, checkDatabaseFile, replaceDatabase } from '../config/database';
import { noteDownload, backupStatus, makeCopy, copyBeforeRestore, copyPath } from '../utils/backup';
import { recordsOfUser, recordsOfClass, describeRecords, integrityReport } from '../utils/integrity';
import { ALL_AREA_NAMES } from '../config/curriculum';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../config/auth';


const router = Router();

// Admin only routes
router.use(authenticate, authorize('admin'));

// Get all users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<any[]>(
      `SELECT u.id, u.name, u.email, u.role, u.class_id, u.student_number, u.is_active, u.archived, c.name AS class_name
       FROM users u LEFT JOIN classes c ON c.id = u.class_id ORDER BY u.role, u.name`
    );
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Generate unique reg number — format: c260001 (student) or t260001 (teacher)
async function generateRegNumber(prefix: string): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2);
  const rows = await query<any[]>("SELECT COALESCE(MAX(CAST(SUBSTR(student_number, 4) AS INTEGER)), 0) + 1 AS next FROM users WHERE student_number LIKE '" + prefix + year + "%" + prefix + "'");
  const next = rows[0]?.next || 1;
  return prefix + year + String(next).padStart(5, '0') + prefix;
}

// Create user
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { first_name, last_name, name, email, password, role, class_id } = req.body;

    if (role === 'student' || role === 'teacher') {
      const prefix = role === 'student' ? 'c' : 't';
      const reg_number = await generateRegNumber(prefix);
      const fullName = (first_name || '') + ' ' + (last_name || '');
      const userName = fullName.trim() || name || '';
      const userEmail = email || (reg_number + '@temp.school');
      const userPass = password ? hashPassword(password) : '';
      await execute(
        'INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [userName, userEmail, userPass, role, class_id || null, reg_number]
      );
      if (role === 'teacher' && class_id) ensureSubjectsForClass(Number(class_id));
      return res.status(201).json({ message: role === 'student' ? 'Student created' : 'Teacher created', reg_number });
    }

    if (!password) return res.status(400).json({ message: 'A password is required for this role' });
    const hashed = hashPassword(password);
    await execute(
      'INSERT INTO users (name, email, password, role, class_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [name, email, hashed, role, class_id || null]
    );
    res.status(201).json({ message: 'User created' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update user
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, role, class_id } = req.body;
    await execute(
      'UPDATE users SET name = ?, email = ?, role = ?, class_id = ? WHERE id = ?',
      [name, email, role, class_id || null, req.params.id]
    );
    if (role === 'teacher' && class_id) ensureSubjectsForClass(Number(class_id));
    res.json({ message: 'User updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Passwords: pending "forgot password" requests, and temporary passwords
router.get('/password-requests', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>(
      `SELECT r.id, r.created_at, u.id AS user_id, u.name, u.email, u.role, u.student_number, c.name AS class_name
       FROM password_requests r JOIN users u ON u.id = r.user_id LEFT JOIN classes c ON c.id = u.class_id
       WHERE r.resolved = 0 ORDER BY r.created_at`
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/users/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const user = await query<any[]>('SELECT id, name, role FROM users WHERE id = ?', [req.params.id]);
    if (!user[0]) return res.status(404).json({ message: 'User not found' });
    // Easy to read out loud: no 0/O or 1/l
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let temp = '';
    for (let i = 0; i < 4; i++) temp += alphabet[Math.floor(Math.random() * alphabet.length)];
    temp += '-' + (Math.floor(Math.random() * 9000) + 1000) + '-';
    for (let i = 0; i < 3; i++) temp += alphabet[Math.floor(Math.random() * alphabet.length)];
    await execute("UPDATE users SET password = ?, must_change_password = 1, password_changed_at = datetime('now') WHERE id = ?", [hashPassword(temp), req.params.id]);
    await execute("UPDATE password_requests SET resolved = 1, resolved_at = datetime('now') WHERE user_id = ? AND resolved = 0", [req.params.id]);
    res.json({ message: 'Temporary password created', temporary_password: temp, name: user[0].name });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/password-requests/:id/dismiss', async (req: AuthRequest, res: Response) => {
  try {
    await execute("UPDATE password_requests SET resolved = 1, resolved_at = datetime('now') WHERE id = ?", [req.params.id]);
    res.json({ message: 'Request dismissed' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Delete user
// Someone who still has marks, bills or receipts is never deleted: that would erase the school's history.
// A person who has left the school is closed instead (see below).
async function mayRemove(id: number, actingId: number): Promise<{ user: any; problem?: string; status?: number }> {
  const user = (await query<any[]>('SELECT id, name, role FROM users WHERE id = ?', [id]))[0];
  if (!user) return { user, problem: 'That account does not exist', status: 404 };
  if (user.id === actingId) return { user, problem: 'You cannot close or delete your own account', status: 400 };
  for (const [role, label] of [['admin', 'an Administrator'], ['bursary', 'a Bursar']]) {
    if (user.role === role && ((await query<any[]>('SELECT COUNT(*) AS n FROM users WHERE role = ? AND archived = 0', [role]))[0]?.n ?? 0) <= 1) return { user, problem: `The school must always have ${label}. Add another one first.`, status: 400 };
  }
  return { user };
}

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const check = await mayRemove(id, req.user!.id);
    if (check.problem) return res.status(check.status || 400).json({ message: check.problem });
    const records = await recordsOfUser(id);
    if (records.length) {
      return res.status(409).json({ message: `${check.user.name} has ${describeRecords(records)}. Deleting the account would erase all of that, so it is refused. If they have left the school, use "Close" instead: their history stays, but they can no longer log in.`, records });
    }
    await execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Classes CRUD
router.get('/classes', async (req: AuthRequest, res: Response) => {
  try {
    const classes = await query<any[]>('SELECT * FROM classes ORDER BY grade, name');
    res.json(classes);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/classes', async (req: AuthRequest, res: Response) => {
  try {
    const { name, grade, section } = req.body;
    const created = await execute('INSERT INTO classes (name, grade, section) VALUES (?, ?, ?)', [name, grade, section || '']);
    ensureSubjectsForClass(created.insertId);
    res.status(201).json({ message: 'Class created' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/classes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, grade, section } = req.body;
    await execute('UPDATE classes SET name = ?, grade = ?, section = ? WHERE id = ?',
      [name, grade, section || '', req.params.id]);
    res.json({ message: 'Class updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Close the account of someone who has left the school: the history stays, the person can no longer log in
router.post('/users/:id/close', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const check = await mayRemove(id, req.user!.id);
    if (check.problem) return res.status(check.status || 400).json({ message: check.problem });
    // password_changed_at signs out every device they were logged in on
    await execute("UPDATE users SET archived = 1, is_active = 0, class_id = NULL, password_changed_at = datetime('now') WHERE id = ?", [id]);
    res.json({ message: `${check.user.name}'s account is closed. Their marks, bills and receipts are kept.` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/users/:id/reopen', async (req: AuthRequest, res: Response) => {
  try {
    const u = (await query<any[]>('SELECT id, name, password FROM users WHERE id = ?', [req.params.id]))[0];
    if (!u) return res.status(404).json({ message: 'That account does not exist' });
    await execute('UPDATE users SET archived = 0, is_active = ? WHERE id = ?', [u.password ? 1 : 0, u.id]);
    res.json({ message: `${u.name}'s account is open again. Give them a class with Edit.` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Is the database healthy? (broken links between records, and SQLite's own check)
router.get('/db/integrity', async (_req: AuthRequest, res: Response) => {
  try { res.json(await integrityReport()); } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete('/classes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const inside = await recordsOfClass(Number(req.params.id));
    if (inside.length) return res.status(409).json({ message: `This class still has ${describeRecords(inside)}. Move or remove those first; deleting the class would erase them.`, records: inside });
    await execute('DELETE FROM classes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Class deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Subjects CRUD
router.get('/subjects', async (req: AuthRequest, res: Response) => {
  try {
    const subjects = await query<any[]>(
      `SELECT s.*, c.name AS class_name, u.name AS teacher_name FROM subjects s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users u ON u.id = s.teacher_id
       ORDER BY c.name, s.name`
    );
    res.json(subjects);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/subjects', async (req: AuthRequest, res: Response) => {
  try {
    const { name, class_id } = req.body;
    if (!ALL_AREA_NAMES.some((n) => n.toLowerCase() === String(name || '').trim().toLowerCase())) {
      return res.status(400).json({ message: 'Only the Heritage-Based Curriculum learning areas can be added: ' + ALL_AREA_NAMES.join(', ') });
    }
    // Auto-assign teacher who owns this class
    const teachers = await query<any[]>('SELECT id FROM users WHERE role = ? AND class_id = ? LIMIT 1', ['teacher', class_id]);
    const teacher_id = teachers[0]?.id || null;
    await execute('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?, ?, ?)',
      [name, class_id, teacher_id]);
    res.status(201).json({ message: 'Subject created' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/subjects/:id', async (req: AuthRequest, res: Response) => {
  try {
    const subject = await query<any[]>('SELECT name FROM subjects WHERE id = ?', [req.params.id]);
    if (subject[0] && ALL_AREA_NAMES.includes(subject[0].name)) {
      return res.status(400).json({ message: 'Learning areas are part of the curriculum and cannot be deleted' });
    }
    const inUse = (await query<any[]>(
      'SELECT (SELECT COUNT(*) FROM results WHERE subject_id = ?) + (SELECT COUNT(*) FROM homework WHERE subject_id = ?) + (SELECT COUNT(*) FROM quizzes WHERE subject_id = ?) + (SELECT COUNT(*) FROM timetables WHERE subject_id = ?) AS n',
      [req.params.id, req.params.id, req.params.id, req.params.id]))[0]?.n ?? 0;
    if (inUse) return res.status(409).json({ message: `This subject is used by ${inUse} mark(s), homework, quiz or timetable record(s). Deleting it would erase them.` });
    await execute('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Subject deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// SQL console — run raw queries (super admin only)
router.post('/sql', async (req: AuthRequest, res: Response) => {
  try {
    let { sql, params } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ message: 'SQL query is required' });
    }

    // Support multi-statement SQL (split on semicolons)
    const statements = sql.split(';').filter((s: string) => s.trim());

    // The Bursary audit trail may be read here but never changed (or dropped, or hidden by editing the schema)
    const writes = (statements.length > 1 ? statements : [sql]).filter((s: string) => {
      const t = s.trim().toLowerCase();
      return !(t.startsWith('select') || t.startsWith('pragma')) || /writable_schema/.test(t);
    });
    if (writes.some((s: string) => /\baudit_log\b|\bsqlite_(master|schema)\b|writable_schema/i.test(s))) {
      return res.status(403).json({ message: 'The Bursary audit trail can be read but never changed.' });
    }
    if (statements.length > 1) {
      const results: any[] = [];
      for (const stmt of statements) {
        const trimmed = stmt.trim().toLowerCase();
        if (!trimmed) continue;
        const isRead = trimmed.startsWith('select') || trimmed.startsWith('pragma');
        if (isRead) {
          const rows = await query<any[]>(stmt);
          results.push({ type: 'select', rows });
        } else {
          const result = await execute(stmt);
          results.push({ type: 'write', ...result });
        }
      }
      return res.json({ type: 'multi', results });
    }

    const trimmed = sql.trim().toLowerCase();
    const isRead = trimmed.startsWith('select') || trimmed.startsWith('pragma');

    if (isRead) {
      const rows = await query<any[]>(sql, params || []);
      return res.json({ rows, type: 'select' });
    }

    const result = await execute(sql, params || []);
    return res.json({ type: 'write', ...result });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── Database Backup / Restore ────────────────────────

// GET /admin/db/info — database status (super admin only)
router.get('/db/info', async (_req: AuthRequest, res: Response) => {
  try {
    const stats = fs.statSync(dbPath);
    const tables = await query<any[]>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const r = await query<any[]>(`SELECT COUNT(*) AS cnt FROM \`${t.name}\``);
      counts[t.name] = r[0]?.cnt || 0;
    }
    res.json({
      exists: fs.existsSync(dbPath),
      sizeBytes: stats.size,
      lastModified: stats.mtime,
      tables: tables.map((t: any) => t.name),
      rowCounts: counts,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// GET /admin/db/export — download the SQLite database file (super admin only)
router.get('/db/export', async (req: AuthRequest, res: Response) => {
  try {
    if (!fs.existsSync(dbPath)) return res.status(404).json({ message: 'Database file not found' });
    const date = new Date().toISOString().slice(0, 10);
    const me = await query<any[]>('SELECT name FROM users WHERE id = ?', [req.user!.id]);
    await noteDownload(me[0]?.name || 'Administrator');
    res.download(dbPath, `school_portal_backup_${date}.db`);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// GET /admin/backups — when a copy was last downloaded, and the automatic copies kept on the server
router.get('/backups', async (_req: AuthRequest, res: Response) => {
  try { res.json(await backupStatus()); } catch (err: any) { res.status(500).json({ message: err.message }); }
});
// POST /admin/backups/now — make today's automatic copy right now
router.post('/backups/now', async (_req: AuthRequest, res: Response) => {
  try { makeCopy(); res.json(await backupStatus()); } catch (err: any) { res.status(500).json({ message: err.message }); }
});
// GET /admin/backups/:name — download one of the automatic copies (this counts as a downloaded backup)
router.get('/backups/:name', async (req: AuthRequest, res: Response) => {
  try {
    const p = copyPath(req.params.name);
    if (!p) return res.status(404).json({ message: 'That copy does not exist' });
    const me = await query<any[]>('SELECT name FROM users WHERE id = ?', [req.user!.id]);
    await noteDownload(me[0]?.name || 'Administrator');
    res.download(p, req.params.name);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// POST /admin/db/restore — upload a database file to restore
const uploadDb = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.dirname(dbPath)),
    filename: (_req, _file, cb) => cb(null, 'restored_' + Date.now() + '.db'),
  }),
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') return cb(null, true);
    cb(new Error('Only .db / .sqlite / .sqlite3 files allowed'));
  }
}).single('database');

router.post('/db/restore', (req: AuthRequest, res: Response) => {
  uploadDb(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    const temp = req.file?.path;
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const uploaded = fs.readFileSync(req.file.path);
      // Refuse anything that is not a healthy backup of this portal, before anything is touched
      const problem = await checkDatabaseFile(uploaded);
      if (problem) return res.status(400).json({ message: problem });
      // Keep what the portal holds now, so that restoring the wrong file can be undone (it shows in the backup list)
      const kept = copyBeforeRestore();
      // Switch the running portal onto the backup (writing the file alone would be undone by the next save)
      await replaceDatabase(uploaded);
      res.json({ message: `Database restored. The portal is now using the backup you chose. What it held just before is kept in the backup list as ${kept.name}.`, kept: kept.name });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
    finally { if (temp) try { fs.unlinkSync(temp); } catch { /* already gone */ } }
  });
});

// ── Analytics Routes ──

// Get all students with attendance stats
router.get('/analytics/attendance/:classId', async (req: AuthRequest, res: Response) => {
  try {
    const { classId } = req.params;
    const students = await query<any[]>('SELECT id, name, student_number FROM users WHERE role=? AND class_id=? ORDER BY name', ['student', classId]);
    const records = await query<any[]>('SELECT date, records FROM attendance WHERE class_id=? ORDER BY date', [classId]);
    const stats = students.map((s: any) => {
      let present = 0, absent = 0, late = 0, total = 0;
      for (const r of records) {
        const parsed = typeof r.records === 'string' ? JSON.parse(r.records) : r.records;
        const match = parsed.find((p: any) => p.student_id === s.id);
        if (match) {
          total++;
          if (match.status === 'present') present++;
          else if (match.status === 'absent') absent++;
          else if (match.status === 'late') late++;
        }
      }
      return { ...s, present, absent, late, total, attendance_pct: total ? Math.round(present/total*100) : 0 };
    });
    res.json(stats);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Class sports stats
router.get('/analytics/sports/:classId', async (req: AuthRequest, res: Response) => {
  try {
    const data = await query<any[]>(
      `SELECT sp.name AS sport_name, COUNT(sp2.id) AS participants,
              SUM(CASE WHEN sp2.role='captain' THEN 1 ELSE 0 END) AS captains
       FROM sports sp
       LEFT JOIN sport_participants sp2 ON sp2.sport_id=sp.id
       LEFT JOIN users u ON u.id=sp2.student_id AND u.class_id=?
       GROUP BY sp.id`,
      [req.params.classId]
    );
    res.json(data);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Homework completion stats
router.get('/analytics/homework/:classId', async (req: AuthRequest, res: Response) => {
  try {
    const data = await query<any[]>(
      `SELECT u.id AS student_id, u.name, u.student_number,
              COUNT(DISTINCT h.id) AS total_hw,
              COUNT(DISTINCT hs.id) AS submitted,
              AVG(hs.grade) AS avg_grade
       FROM users u
       LEFT JOIN homework h ON h.class_id=u.class_id
       LEFT JOIN homework_submissions hs ON hs.homework_id=h.id AND hs.student_id=u.id
       WHERE u.role='student' AND u.class_id=?
       GROUP BY u.id ORDER BY u.name`,
      [req.params.classId]
    );
    res.json(data);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
