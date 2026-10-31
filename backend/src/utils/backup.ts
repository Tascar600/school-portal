import fs from 'fs';
import path from 'path';
import { dbPath } from '../config/database';
import { getSetting, setSetting } from './settings';

// Copies of the whole database, for the Administrator.
//  * Automatic copies: one file per day in a "backups" folder beside the database (backend/backups/, or inside DATA_DIR),
//    refreshed every few hours, the newest 14 days kept.
//    They protect against mistakes (a wrong delete, a bad restore). They do NOT protect against the computer or the
//    host losing its files, because they sit next to the database. Only a downloaded copy kept elsewhere does that.
//  * Downloaded copies: when the Administrator downloads the database the date is remembered, so the dashboard can
//    say how long it has been.
// The folder sits next to the database being used, so a test database never writes into the real school's backups
export const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(path.dirname(dbPath), 'backups');
const KEEP_DAYS = 14;
const EVERY_MS = 6 * 60 * 60 * 1000;
// school_portal-2026-10-31.db is the daily copy; school_portal-2026-10-31-before-restore-143005.db is what the portal
// held just before a restore, kept so that a restore of the wrong file can be undone
const NAME = /^school_portal-\d{4}-\d{2}-\d{2}(-before-restore-\d{6})?\.db$/;
export const STALE_AFTER_DAYS = 7;

export interface Copy { name: string; size: number; at: string }

export function makeCopy(tag = ''): Copy {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const name = `school_portal-${day}${tag}.db`;
  fs.copyFileSync(dbPath, path.join(BACKUP_DIR, name));
  prune();
  const st = fs.statSync(path.join(BACKUP_DIR, name));
  return { name, size: st.size, at: st.mtime.toISOString() };
}

// Saves what the portal holds right now under its own name, just before a restore replaces it
export function copyBeforeRestore(): Copy {
  return makeCopy('-before-restore-' + new Date().toISOString().slice(11, 19).replace(/:/g, ''));
}

export function listCopies(): Copy[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR).filter((n) => NAME.test(n)).map((name) => {
    const st = fs.statSync(path.join(BACKUP_DIR, name));
    return { name, size: st.size, at: st.mtime.toISOString() };
  }).sort((a, b) => b.name.localeCompare(a.name));
}

function prune(): void {
  for (const c of listCopies().slice(KEEP_DAYS)) fs.rmSync(path.join(BACKUP_DIR, c.name), { force: true });
}

// A file name asked for by the browser is only ever one of our own copies, never a path
export function copyPath(name: string): string | null {
  if (!NAME.test(name)) return null;
  const p = path.join(BACKUP_DIR, name);
  return fs.existsSync(p) ? p : null;
}

export function startAutomaticCopies(): void {
  const run = () => { try { if (fs.existsSync(dbPath)) makeCopy(); } catch (err) { console.error('Automatic backup copy failed:', err); } };
  run();
  setInterval(run, EVERY_MS).unref();
}

export async function noteDownload(who: string): Promise<void> {
  await setSetting('last_backup_download_at', new Date().toISOString());
  await setSetting('last_backup_download_by', who);
}

export async function backupStatus() {
  const at = await getSetting('last_backup_download_at');
  const by = await getSetting('last_backup_download_by');
  const daysSince = at ? Math.floor((Date.now() - Date.parse(at)) / 86400000) : null;
  return { lastDownloadAt: at, lastDownloadBy: by, daysSince, stale: daysSince === null || daysSince >= STALE_AFTER_DAYS, staleAfterDays: STALE_AFTER_DAYS, copies: listCopies() };
}
