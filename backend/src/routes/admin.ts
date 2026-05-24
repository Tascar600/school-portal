import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { query, execute, dbPath } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../config/auth';


const router = Router();

// Admin only routes
router.use(authenticate, authorize('admin'));

// Get all users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<any[]>(
      `SELECT u.id, u.name, u.email, u.role, u.class_id, u.student_number, u.is_active, c.name AS class_name
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
      return res.status(201).json({ message: role === 'student' ? 'Student created' : 'Teacher created', reg_number });
    }

    const hashed = hashPassword(password);
    await execute(
      'INSERT INTO users (name, email, password, role, class_id) VALUES (?, ?, ?, ?, ?)',
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
    res.json({ message: 'User updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM users WHERE id = ?', [req.params.id]);
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
    await execute('INSERT INTO classes (name, grade, section) VALUES (?, ?, ?)', [name, grade, section || '']);
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

router.delete('/classes/:id', async (req: AuthRequest, res: Response) => {
  try {
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
router.get('/db/export', async (_req: AuthRequest, res: Response) => {
  try {
    if (!fs.existsSync(dbPath)) return res.status(404).json({ message: 'Database file not found' });
    const date = new Date().toISOString().slice(0, 10);
    res.download(dbPath, `school_portal_backup_${date}.db`);
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
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      // Overwrite the live database with the uploaded file
      const uploaded = fs.readFileSync(req.file.path);
      fs.writeFileSync(dbPath, uploaded);
      // Cleanup temp upload
      try { fs.unlinkSync(req.file.path); } catch {}
      res.json({ message: 'Database restored. Restart the app or wait for auto-reload.' });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
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
