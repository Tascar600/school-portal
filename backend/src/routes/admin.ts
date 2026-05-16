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
    const users = await query<any[]>('SELECT id, name, email, role, class_id FROM users ORDER BY role, name');
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create user
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, class_id } = req.body;
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

export default router;
