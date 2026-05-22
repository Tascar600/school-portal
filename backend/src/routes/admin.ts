import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { query, execute, dbPath, transaction } from '../config/database';
import db from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../config/auth';
import bcrypt from 'bcryptjs';

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
    const { sql, params } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ message: 'SQL query is required' });
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

// ── Seed test data ──
router.post('/seed', async (_req: AuthRequest, res: Response) => {
  try {
    const hash = (p: string) => bcrypt.hashSync(p, 10);

    // Check if already seeded (200+ students)
    const existing = await query("SELECT COUNT(*) as cnt FROM users WHERE role='student'");
    if (existing[0]?.cnt >= 200) {
      res.json({ message: 'Database already has 200+ students. No action taken.' });
      return;
    }

    transaction(() => {
      const classList = ['ECD A','ECD B','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7'];

      // Clear all data except admin
      db.run("DELETE FROM users WHERE email NOT IN ('punhamasiwa@gmail.com')");
      const tables = ['payments','fee_accounts','attendance','results','homework_submissions','homework','timetables','subjects','courses','sport_participants'];
      for (const t of tables) db.run(`DELETE FROM ${t}`);

      // Classes
      for (const name of classList) {
        const grade = name.includes('ECD') ? 'ECD' : name.replace('Grade ', '');
        const section = name === 'ECD A' ? 'A' : name === 'ECD B' ? 'B' : '';
        db.run('INSERT OR IGNORE INTO classes (name, grade, section) VALUES (?,?,?)', [name, grade, section]);
      }
      const clsRows = db.exec("SELECT id, name FROM classes ORDER BY id")[0].values.map((v: any) => [v[0], v[1] as string]);
      const cls: Record<string, number> = {};
      for (const [id, name] of clsRows) cls[name as string] = Number(id);

      // Teachers
      const tFNs = ['Tendai','Chido','Tafadzwa','Rumbidzai','Kudzai','Nyasha','Tanaka','Tariro','Anesu','Mufaro'];
      const tLNs = ['Moyo','Ndlovu','Sithole','Dube','Khumalo','Nyoni','Tshuma','Ncube','Mpofu','Sibanda'];
      const teacherIds: number[] = [];
      for (let i = 0; i < 10; i++) {
        const name = `${tFNs[i % 10]} ${tLNs[i % 10]}`;
        const email = `teacher${i + 1}@school.com`;
        const cid = i < 9 ? cls[classList[i]] : null;
        db.run("INSERT INTO users (name, email, password, role, class_id, is_active) VALUES (?,?,?,?,?,1)",
          [name, email, hash('1234'), 'teacher', cid]);
        teacherIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
      }

      // Subjects
      const pool = ['English','Mathematics','Science','History','Geography','Art','Music','PE','ICT','Shona',
        'Agriculture','Religion','Home Economics','French'];
      const assignCnt = [6,6,6,7,7,7,7,7,7];
      for (let ci = 0; ci < 9; ci++) {
        const cid = cls[classList[ci]];
        const tid = teacherIds[ci % 10];
        for (let i = 0; i < assignCnt[ci]; i++) {
          const sn = pool[(ci * 7 + i * 3) % pool.length];
          db.run('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?,?,?)', [`${sn}`, cid, tid]);
        }
      }

      // 200 students
      const sFNs = ['Takudzwa','Rutendo','Tatenda','Kundai','Makanaka','Panashe','Tadiwa','Kudzanai','Tanyaradzwa',
        'Shamiso','Munyaradzi','Tafara','Ropafadzo','Muchaneta','Masimba','Chiedza','Tanatswa','Nokutenda','Simba','Chipo',
        'Tawana','Kudakwashe','Munashe','Tariro','Tinevimbo','Mufaro','Zvikomborero','Tonderai','Rufaro','Chengetai'];
      const sLNs = ['Muzenda','Makoni','Chigumba','Mkandla','Mlambo','Ndlovu','Sithole','Mpofu','Ncube','Tshuma',
        'Dube','Khumalo','Nyoni','Moyo','Sibanda','Nkala','Maphosa','Ngwenya','Mthembu','Zulu'];
      const studentIds: number[] = [];
      const keys = Object.keys(cls);
      for (let i = 0; i < 200; i++) {
        const name = `${sFNs[i % sFNs.length]} ${sLNs[Math.floor(i / sFNs.length) % sLNs.length]}`;
        const seq = String(i + 1).padStart(5, '0');
        const regNum = `c26${seq}c`;
        const ck = keys[i % keys.length];
        const cid = cls[ck];
        db.run("INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?,?,?,?,?,?,1)",
          [name, `${regNum}@temp.school`, hash('1234'), 'student', cid, regNum]);
        studentIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
      }

      // Fees
      const sdc = 100, ssf = 60;
      db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('sdc_fee',?)", [String(sdc)]);
      db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('ssf_fee',?)", [String(ssf)]);
      for (const sid of studentIds) {
        db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)', [sid, 'SDC', sdc, sdc]);
        db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)', [sid, 'SSF', ssf, ssf]);
      }

      // Payments
      for (const sid of studentIds) {
        if (Math.random() > 0.6) continue;
        const at = Math.random() > 0.5 ? 'SDC' : 'SSF';
        const maxAmt = at === 'SDC' ? sdc : ssf;
        const amt = Math.round((5 + Math.random() * (maxAmt - 5)) * 100) / 100;
        const st = Math.random() > 0.15 ? 'verified' : 'pending';
        const days = Math.floor(Math.random() * 30);
        const date = new Date(Date.now() - days * 86400000).toISOString();
        const receipt = `RCP-${String(sid).padStart(4, '0')}-${String(100 + Math.floor(Math.random() * 900))}`;
        db.run("INSERT INTO payments (student_id, account_type, amount, proof_file, notes, receipt_number, status, created_at) VALUES (?,?,?,'',?,?,?,?)",
          [sid, at, amt, `Payment for ${at}`, receipt, st, date]);
        if (st === 'verified') {
          db.run('UPDATE fee_accounts SET balance = balance - ? WHERE student_id = ? AND account_type = ?', [amt, sid, at]);
        }
      }
    });

    res.json({ message: 'Database seeded with 200 students, 10 teachers, fees, payments, subjects, and timetable!' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
