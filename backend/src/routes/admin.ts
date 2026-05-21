import { Router, Response } from 'express';
import { query, execute } from '../config/database';
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

// Generate unique student number — format: c260001
async function generateStudentNumber(): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2);
  const rows = await query<any[]>("SELECT COALESCE(MAX(CAST(SUBSTR(student_number, 4) AS INTEGER)), 0) + 1 AS next FROM users WHERE student_number LIKE 'c" + year + "%'");
  const next = rows[0]?.next || 1;
  return 'c' + year + String(next).padStart(5, '0');
}

// Create user
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { first_name, last_name, name, email, password, role, class_id } = req.body;

    if (role === 'student') {
      const student_number = await generateStudentNumber();
      const fullName = (first_name || '') + ' ' + (last_name || '');
      const studentName = fullName.trim() || name || '';
      const studentEmail = email || (student_number + '@temp.school');
      const studentPass = password ? hashPassword(password) : '';
      await execute(
        'INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [studentName, studentEmail, studentPass, role, class_id || null, student_number]
      );
      return res.status(201).json({ message: 'Student created', student_number });
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
       JOIN users u ON u.id = s.teacher_id
       ORDER BY c.name, s.name`
    );
    res.json(subjects);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/subjects', async (req: AuthRequest, res: Response) => {
  try {
    const { name, class_id, teacher_id } = req.body;
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

// SQL console — run raw queries (admin only)
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

export default router;
