import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { onAHost } from './host';
import { DATA_DIR, storageIsTemporary } from './paths';

export { onAHost };

// Every log in is signed with a secret. The fallback at the bottom is written in the public source code, so it is only
// ever used on your own computer. On a host that other people can reach, a missing JWT_SECRET must NOT mean "use the
// public one" (anyone could then forge an Administrator login). On a host the secret comes from, in this order:
//   1. the JWT_SECRET setting, if there is one;
//   2. a secret the portal made itself and keeps on the permanent disk (DATA_DIR/jwt-secret), so log ins survive restarts;
//   3. a random secret made at each start, when there is no permanent disk: safe, but everyone must log in again after a
//      restart, and the Administrator is shown a notice.
const SECRET_FILE_NAME = 'jwt-secret'; // lives beside the database, never inside backups/ or uploads/ (so never in a backup)

// Reads the secret kept on the disk, or makes one and keeps it. A damaged or too short file is replaced, never used.
function keptSecret(file: string): { secret: string; made: boolean } {
  try {
    const kept = fs.readFileSync(file, 'utf8').trim();
    if (kept.length >= 32) return { secret: kept, made: false };
  } catch (err: any) { if (err.code !== 'ENOENT') throw err; }
  const secret = crypto.randomBytes(48).toString('hex');
  const aside = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(aside, secret + '\n', { mode: 0o600 }); // written aside and then renamed, so a crash cannot leave half a secret
  fs.renameSync(aside, file);
  return { secret, made: true };
}

function chooseSecret(): { secret: string; random: boolean } {
  if (process.env.JWT_SECRET) return { secret: process.env.JWT_SECRET, random: false };
  if (!onAHost) return { secret: 'fallback_secret_do_not_use_in_prod', random: false };
  if (DATA_DIR && !storageIsTemporary()) {
    try {
      const { secret, made } = keptSecret(path.join(DATA_DIR, SECRET_FILE_NAME));
      console.log(`Log in secret: JWT_SECRET is not set, so the portal ${made ? 'made its own and keeps it' : 'is using the one it keeps'} on the permanent disk (${SECRET_FILE_NAME}). Log ins survive restarts. Set JWT_SECRET in the host's settings to use your own instead.`);
      return { secret, random: false };
    } catch (err: any) {
      console.error(`Could not keep a log in secret on the disk (${err.message}).`);
    }
  }
  console.error('\n!! SECURITY WARNING: JWT_SECRET is not set. A random secret was made for this run, so log ins are safe,\n!! but everyone will be logged out whenever the portal restarts. Set JWT_SECRET to a long random value in your host\'s settings.\n');
  return { secret: crypto.randomBytes(48).toString('hex'), random: true };
}

const chosen = chooseSecret();
const JWT_SECRET = chosen.secret;
// True when log ins will not survive a restart: the Administrator's dashboard then says so
export const insecureSecret = chosen.random;

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
