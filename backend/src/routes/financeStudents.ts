import { Router, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../config/auth';
import { studentBalance } from '../utils/finance';
import { sendXlsx } from '../utils/exportXlsx';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Roster ────────────────────────────────────────────
router.get('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, q } = req.query as Record<string, string>;
    const where: string[] = ["u.role = 'student'"];
    const params: any[] = [];
    if (class_id) { where.push('u.class_id = ?'); params.push(class_id); }
    if (q) { where.push('(u.name LIKE ? OR u.student_number LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const students = await query<any[]>(
      `SELECT u.id, u.name, u.email, u.student_number, u.is_active, u.class_id, c.name AS class_name,
              COALESCE(sp.category,'day') AS category, sp.family_code, sp.guardian_name, sp.guardian_phone, sp.status
       FROM users u LEFT JOIN classes c ON c.id = u.class_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE ${where.join(' AND ')} ORDER BY u.name`,
      params
    );
    for (const s of students) s.balance = await studentBalance(s.id);
    res.json(students);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/export.xlsx', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, q } = req.query as Record<string, string>;
    const where: string[] = ["u.role = 'student'"];
    const params: any[] = [];
    if (class_id) { where.push('u.class_id = ?'); params.push(class_id); }
    if (q) { where.push('(u.name LIKE ? OR u.student_number LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const students = await query<any[]>(
      `SELECT u.id, u.name, u.student_number, c.name AS class_name, sp.guardian_name, sp.guardian_phone
       FROM users u LEFT JOIN classes c ON c.id = u.class_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE ${where.join(' AND ')} ORDER BY u.name`,
      params
    );
    const rows: any[] = [];
    for (const s of students) {
      rows.push({
        Name: s.name, 'Student Number': s.student_number, Class: s.class_name || '',
        'Guardian Name': s.guardian_name || '', 'Guardian Phone': s.guardian_phone || '',
        Balance: (await studentBalance(s.id)).toFixed(2),
      });
    }
    await sendXlsx(res, 'student-roster', ['Name', 'Student Number', 'Class', 'Guardian Name', 'Guardian Phone', 'Balance'], rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Excel/CSV import ──────────────────────────────────
const HEADER_ALIASES: Record<string, string> = {
  name: 'name', 'full name': 'name', 'student name': 'name', 'learner name': 'name',
  class: 'class_name', 'class name': 'class_name', grade: 'class_name',
  'student number': 'student_number', 'adm no': 'student_number', 'admission number': 'student_number',
  'reg number': 'student_number', 'registration number': 'student_number',
  email: 'email',
  'guardian name': 'guardian_name', 'parent name': 'guardian_name',
  'guardian phone': 'guardian_phone', 'parent phone': 'guardian_phone', phone: 'guardian_phone',
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f !== '')) rows.push(row); }
  return rows;
}

async function parseUpload(buffer: Buffer, filename: string): Promise<string[][]> {
  if (filename.toLowerCase().endsWith('.csv')) {
    return parseCsv(buffer.toString('utf-8'));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets[0];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const vals = (row.values as any[]).slice(1).map((v) => (v === null || v === undefined ? '' : String(v)));
    rows.push(vals);
  });
  return rows;
}

async function resolveClassId(className: string, classCache: any[]): Promise<number | null> {
  const norm = className.trim().toLowerCase();
  const exact = classCache.find((c) => c.name.toLowerCase() === norm);
  if (exact) return exact.id;
  const gradeMatch = norm.match(/(\d+)/);
  if (gradeMatch) {
    const byGrade = classCache.find((c) => c.grade === gradeMatch[1]);
    if (byGrade) return byGrade.id;
  }
  return null;
}

async function nextStudentNumber(): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2);
  const rows = await query<any[]>(
    "SELECT COALESCE(MAX(CAST(SUBSTR(student_number, 4) AS INTEGER)), 0) + 1 AS next FROM users WHERE student_number LIKE 'c" + year + "%c'"
  );
  const next = rows[0]?.next || 1;
  return 'c' + year + String(next).padStart(5, '0') + 'c';
}

router.post('/import/preview', authenticate, authorize('admin', 'bursary'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'A file is required' });
    const grid = await parseUpload(req.file.buffer, req.file.originalname);
    if (grid.length < 2) return res.status(400).json({ message: 'File has no data rows' });

    const headerRow = grid[0].map((h) => h.trim().toLowerCase());
    const fieldByCol: (string | null)[] = headerRow.map((h) => HEADER_ALIASES[h] || null);
    const classes = await query<any[]>('SELECT id, name, grade FROM classes');

    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const errors: any[] = [];

    for (let r = 1; r < grid.length; r++) {
      const raw = grid[r];
      if (!raw.some((v) => v && v.trim())) continue;
      const record: Record<string, string> = {};
      fieldByCol.forEach((field, i) => { if (field) record[field] = (raw[i] || '').trim(); });

      if (!record.name) { errors.push({ row: r + 1, reason: 'Missing name' }); continue; }
      if (!record.class_name) { errors.push({ row: r + 1, reason: 'Missing class' }); continue; }
      const classId = await resolveClassId(record.class_name, classes);
      if (!classId) { errors.push({ row: r + 1, reason: `Class "${record.class_name}" not found` }); continue; }

      const entry = { ...record, class_id: classId, row: r + 1 };
      if (record.student_number) {
        const existing = await queryOne<any>('SELECT id FROM users WHERE student_number = ?', [record.student_number]);
        if (existing) { toUpdate.push({ ...entry, user_id: existing.id }); continue; }
      } else {
        // No student number given — fall back to matching an existing active student
        // by the same name in the same class, so re-uploading a roster to update
        // guardian info doesn't create duplicate students.
        const existing = await queryOne<any>(
          "SELECT id FROM users WHERE role = 'student' AND class_id = ? AND LOWER(name) = LOWER(?)",
          [classId, record.name]
        );
        if (existing) { toUpdate.push({ ...entry, user_id: existing.id }); continue; }
      }
      toCreate.push(entry);
    }

    res.json({ toCreate, toUpdate, errors });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/import/confirm', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { toCreate, toUpdate } = req.body as { toCreate: any[]; toUpdate: any[] };
    let created = 0, updated = 0;

    for (const s of toCreate || []) {
      const studentNumber = s.student_number || (await nextStudentNumber());
      const email = s.email || `${studentNumber}@temp.school`;
      const { insertId } = await execute(
        "INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?, ?, '', 'student', ?, ?, 0)",
        [s.name, email, s.class_id, studentNumber]
      );
      if (s.guardian_name || s.guardian_phone) {
        await execute(
          'INSERT INTO student_profiles (user_id, guardian_name, guardian_phone) VALUES (?, ?, ?)',
          [insertId, s.guardian_name || '', s.guardian_phone || '']
        );
      }
      created++;
    }

    for (const s of toUpdate || []) {
      await execute('UPDATE users SET name = ?, class_id = ? WHERE id = ?', [s.name, s.class_id, s.user_id]);
      const existingProfile = await queryOne<any>('SELECT user_id FROM student_profiles WHERE user_id = ?', [s.user_id]);
      if (existingProfile) {
        await execute('UPDATE student_profiles SET guardian_name = ?, guardian_phone = ? WHERE user_id = ?', [s.guardian_name || '', s.guardian_phone || '', s.user_id]);
      } else if (s.guardian_name || s.guardian_phone) {
        await execute('INSERT INTO student_profiles (user_id, guardian_name, guardian_phone) VALUES (?, ?, ?)', [s.user_id, s.guardian_name || '', s.guardian_phone || '']);
      }
      updated++;
    }

    res.json({ created, updated, message: `Imported: ${created} new, ${updated} updated` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Year-end promotion ────────────────────────────────
router.post('/promote', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const classes = await query<any[]>('SELECT id FROM classes ORDER BY id');
    const classIds = classes.map((c) => c.id);
    const students = await query<any[]>(
      `SELECT u.id, u.class_id, COALESCE(sp.status,'active') AS status FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.role = 'student'`
    );
    let promoted = 0, graduated = 0;
    for (const s of students) {
      if (s.status !== 'active' || !s.class_id) continue;
      const idx = classIds.indexOf(s.class_id);
      if (idx === -1) continue;
      if (idx === classIds.length - 1) {
        const existing = await queryOne<any>('SELECT user_id FROM student_profiles WHERE user_id = ?', [s.id]);
        if (existing) await execute("UPDATE student_profiles SET status = 'left' WHERE user_id = ?", [s.id]);
        else await execute("INSERT INTO student_profiles (user_id, status) VALUES (?, 'left')", [s.id]);
        graduated++;
      } else {
        await execute('UPDATE users SET class_id = ? WHERE id = ?', [classIds[idx + 1], s.id]);
        promoted++;
      }
    }
    res.json({ message: `Promotion complete: ${promoted} promoted, ${graduated} graduated`, promoted, graduated });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
