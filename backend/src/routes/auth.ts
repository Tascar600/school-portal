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
    const { name, email, password, role, class_id } = req.body;
    const existing = await query<UserRow[]>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }
    const hashed = hashPassword(password);
    const result = await execute(
      'INSERT INTO users (name, email, password, role, class_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashed, role, class_id || null]
    );
    const payload: TokenPayload = { id: result.insertId, email, role };
    const token = generateToken(payload);
    res.status(201).json({ token, user: { id: result.insertId, name, email, role, class_id } });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Registration failed' });
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
    const users = await query<UserRow[]>('SELECT id, name, email, role, class_id FROM users WHERE id = ?', [req.user!.id]);
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
