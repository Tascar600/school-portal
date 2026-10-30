import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
// The built-in fallback is public. That is fine on your own computer, never on a host that other people can reach.
export const usingDefaultSecret = !process.env.JWT_SECRET;
export const onAHost = !!process.env.RENDER || process.env.NODE_ENV === 'production';
if (usingDefaultSecret && onAHost) {
  console.error('\n!! SECURITY WARNING: JWT_SECRET is not set, so the public built-in secret is being used to sign log ins.\n!! Anyone could forge an Administrator login. Set JWT_SECRET to a long random value in your host\'s settings.\n');
}

export interface TokenPayload {
  id: number;
  email: string;
  role: 'admin' | 'teacher' | 'student' | 'bursary' | 'parent';
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
