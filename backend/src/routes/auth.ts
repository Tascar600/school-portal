import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { generateToken, hashPassword, comparePassword, TokenPayload } from '../config/auth';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

interface UserRow {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'student';
  class_id: number | null;
}

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    if (role === 'student') {
      return res.status(403).json({ message: 'Students must activate via student number' });
    }
    const existing = await query<UserRow[]>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const hashed = hashPassword(password);
    const result = await execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashed, role]
    );
    const payload: TokenPayload = { id: result.insertId, email, role };
    const token = generateToken(payload);
    res.status(201).json({ token, user: { id: result.insertId, name, email, role } });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
});

// Student activation — use student_number to set email & password
router.post('/activate', async (req: AuthRequest, res: Response) => {
  try {
    const { student_number, name, email, password } = req.body;
    if (!student_number || !email || !password) {
      return res.status(400).json({ message: 'student_number, email, and password are required' });
    }
    const users = await query<any[]>('SELECT id, name, email, role, class_id, is_active FROM users WHERE student_number = ?', [student_number]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Invalid student number' });
    }
    const user = users[0];
    if (user.is_active) {
      return res.status(400).json({ message: 'Account already activated' });
    }
    const emailExists = await query<UserRow[]>('SELECT id FROM users WHERE email = ? AND id != ?', [email, user.id]);
    if (emailExists.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    const hashed = hashPassword(password);
    await execute(
      'UPDATE users SET name = ?, email = ?, password = ?, is_active = 1 WHERE id = ?',
      [name || user.name, email, hashed, user.id]
    );
    const payload: TokenPayload = { id: user.id, email, role: user.role };
    const token = generateToken(payload);
    res.json({ token, user: { id: user.id, name: name || user.name, email, role: user.role, class_id: user.class_id } });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Activation failed' });
  }
});

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    const users = await query<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const user = users[0];
    if (!comparePassword(password, user.password)) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const payload: TokenPayload = { id: user.id, email: user.email, role: user.role };
    const token = generateToken(payload);
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<any[]>('SELECT id, name, email, role, class_id, student_number, is_active FROM users WHERE id = ?', [req.user!.id]);
    if (users.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(users[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message || '/me failed' });
  }
});

export default router;
