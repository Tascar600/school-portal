import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Every log in is signed with a secret. The fallback below is written in the public source code, so it is only ever
// used on your own computer. On a host that other people can reach, a missing JWT_SECRET must NOT mean "use the public
// one" (anyone could then forge an Administrator login): a random secret is made each time the portal starts instead.
// The only cost is that everyone has to log in again after a restart. Set JWT_SECRET to keep log ins across restarts.
export const onAHost = !!process.env.RENDER || process.env.NODE_ENV === 'production';
export const usingDefaultSecret = !process.env.JWT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || (onAHost ? crypto.randomBytes(48).toString('hex') : 'fallback_secret_do_not_use_in_prod');
if (usingDefaultSecret && onAHost) {
  console.error('\n!! SECURITY WARNING: JWT_SECRET is not set. A random secret was made for this run, so log ins are safe,\n!! but everyone will be logged out whenever the portal restarts. Set JWT_SECRET to a long random value in your host\'s settings.\n');
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
