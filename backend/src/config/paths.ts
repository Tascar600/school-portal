import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { onAHost } from './auth';

dotenv.config(); // so DATA_DIR and DB_PATH can also be written in backend/.env

// Where the portal keeps everything that has to survive a restart: the database, its automatic daily copies, and every
// uploaded file (homework, payment proofs, the school logo).
//
// On a host with a permanent disk (Render: Disks) set DATA_DIR to the disk's mount path, e.g. /var/data, and all of it lives there.
// Without DATA_DIR everything stays inside the project folder: fine on your own computer, but a free host wipes that folder
// on every restart, redeploy and idle sleep.
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : '';
if (DATA_DIR) fs.mkdirSync(DATA_DIR, { recursive: true });

// DB_PATH lets a test run use a throw-away database; normally it is DATA_DIR/school_portal.db, or backend/school_portal.db
export const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : DATA_DIR ? path.join(DATA_DIR, 'school_portal.db') : path.resolve(__dirname, '../../school_portal.db');

export const UPLOADS_DIR = DATA_DIR ? path.join(DATA_DIR, 'uploads') : path.resolve(__dirname, '../../uploads');

// True when the portal is on a host and its files would be lost at the next restart: either DATA_DIR was never set, or it
// is only a folder on the host's temporary disk (a mistyped mount path) and not the permanent disk itself.
export function storageIsTemporary(): boolean {
  if (!onAHost) return false;                  // your own computer's disk is permanent
  if (process.env.DB_PATH) return false;       // someone chose the location on purpose (the tests do)
  if (!DATA_DIR) return true;
  if (process.platform !== 'linux') return false; // cannot tell; hosts run Linux
  // A mounted disk is a separate file system from the one the host's own files are on
  try { return fs.statSync(DATA_DIR).dev === fs.statSync('/').dev; } catch { return false; }
}
