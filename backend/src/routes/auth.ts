import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { generateToken, hashPassword, comparePassword, TokenPayload } from '../config/auth';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// At least 8 characters with a letter and a number. Returns the problem, or null when fine.
export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'The new password must be at least 8 characters long';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'The new password must contain both letters and numbers';
  return null;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'student' | 'bursary' | 'parent';
  class_id: number | null;
}

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    if (role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be registered' });
    }
    if (role === 'student') {
      return res.status(403).json({ message: 'Students must activate via student number' });
    }
    if (role === 'teacher') {
      return res.status(403).json({ message: 'Teachers must be created by admin' });
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
    const { student_number, email, password } = req.body;
    if (!student_number || !email || !password) {
      return res.status(400).json({ message: 'Registration number, email, and password are required' });
    }
    const weak = passwordProblem(password);
    if (weak) return res.status(400).json({ message: weak.replace('The new password', 'Your password') });
    const users = await query<any[]>('SELECT id, name, email, role, class_id, is_active, archived FROM users WHERE student_number = ?', [student_number]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Invalid registration number' });
    }
    const user = users[0];
    if (user.archived) return res.status(403).json({ message: 'This account has been closed. Please see the school office.' });
    if (user.is_active) {
      return res.status(400).json({ message: 'Account already activated' });
    }
    const emailExists = await query<any[]>('SELECT id FROM users WHERE email = ? AND id != ?', [email, user.id]);
    if (emailExists.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    const hashed = hashPassword(password);
    await execute(
      'UPDATE users SET email = ?, password = ?, is_active = 1 WHERE id = ?',
      [email, hashed, user.id]
    );
    const payload: TokenPayload = { id: user.id, email, role: user.role };
    const token = generateToken(payload);
    res.json({ token, user: { id: user.id, name: user.name, email, role: user.role, class_id: user.class_id } });
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
    if ((user as any).archived) {
      res.status(403).json({ message: 'This account has been closed. Please see the school office.' });
      return;
    }
    if (!comparePassword(password, user.password)) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const payload: TokenPayload = { id: user.id, email: user.email, role: user.role };
    const token = generateToken(payload);
    const { password: _, ...safeUser } = user;
    const cls = user.class_id ? await query<any[]>('SELECT name FROM classes WHERE id = ?', [user.class_id]) : [];
    res.json({ token, user: { ...safeUser, class_name: cls[0]?.name ?? null } });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<any[]>('SELECT id, name, email, role, class_id, (SELECT name FROM classes WHERE id = users.class_id) AS class_name, student_number, is_active, must_change_password FROM users WHERE id = ?', [req.user!.id]);
    if (users.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(users[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message || '/me failed' });
  }
});

// Change your own password (also used when the Admin has issued a temporary one)
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'Enter your current password and a new one' });
    const problem = passwordProblem(new_password);
    if (problem) return res.status(400).json({ message: problem });
    const user = await query<any[]>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (!user[0] || !comparePassword(current_password, user[0].password)) {
      return res.status(400).json({ message: 'Your current password is not correct' });
    }
    if (current_password === new_password) return res.status(400).json({ message: 'The new password must be different from the current one' });
    await execute("UPDATE users SET password = ?, must_change_password = 0, password_changed_at = datetime('now') WHERE id = ?", [hashPassword(new_password), req.user!.id]);
    // Every older login (including anyone who had learned the old password) stops working; this session gets a fresh token.
    const token = generateToken({ id: user[0].id, email: user[0].email, role: user[0].role });
    res.json({ message: 'Password changed. Other devices have been signed out.', token });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// "Forgot password": tells the Administrator. Always answers the same way so nobody can probe which accounts exist.
router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
  try {
    const identifier = String(req.body.identifier || '').trim();
    if (!identifier) return res.status(400).json({ message: 'Enter your email address or registration number' });
    const user = await query<any[]>('SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR student_number = ?', [identifier, identifier]);
    if (user[0]) {
      const pending = await query<any[]>('SELECT id FROM password_requests WHERE user_id = ? AND resolved = 0', [user[0].id]);
      if (!pending.length) await execute('INSERT INTO password_requests (user_id) VALUES (?)', [user[0].id]);
    }
    res.json({ message: 'Your request has been sent. The school administrator will give you a temporary password; you will be asked to choose your own when you log in.' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
