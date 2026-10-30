import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../config/auth';
import { queryOne } from '../config/database';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

// Someone logged in with a temporary (or first-login) password may do nothing except choose their own password
const ALLOWED_WHILE_CHANGING = ['/api/auth/me', '/api/auth/change-password', '/api/themes'];

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  try {
    const payload = verifyToken(header.split(' ')[1]) as TokenPayload & { iat?: number };
    // The token must still belong to a live account, and must pre-date no password change.
    const account = await queryOne<any>('SELECT id, email, role, password_changed_at, must_change_password, archived FROM users WHERE id = ?', [payload.id]);
    if (!account) {
      res.status(401).json({ message: 'This account no longer exists' });
      return;
    }
    if (account.archived) {
      res.status(401).json({ message: 'This account has been closed.' });
      return;
    }
    if (account.password_changed_at && payload.iat) {
      const changedAt = Math.floor(Date.parse(String(account.password_changed_at).replace(' ', 'T') + 'Z') / 1000);
      if (payload.iat < changedAt) {
        res.status(401).json({ message: 'Your password was changed. Please log in again.' });
        return;
      }
    }
    if (account.must_change_password && !ALLOWED_WHILE_CHANGING.includes(req.originalUrl.split('?')[0])) {
      res.status(403).json({ message: 'Please choose your own password first.', must_change_password: true });
      return;
    }
    req.user = { id: account.id, email: account.email, role: account.role };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
