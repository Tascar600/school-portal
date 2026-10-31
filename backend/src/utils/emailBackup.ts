import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import JSZip from 'jszip';
import { dbPath, queryOne } from '../config/database';
import { UPLOADS_DIR } from '../config/paths';
import { getSetting, setSetting, getSchoolInfo } from './settings';
import { noteDownload } from './backup';

// Emailing the backup to the Administrator, so a copy always exists somewhere other than the portal's own computer.
//
// The portal has no mail account of its own. Point it at any mail server by setting these before starting the backend:
//
//   BACKUP_EMAIL_TO   who receives the backup (several addresses may be separated by commas)
//   SMTP_HOST         the mail server, e.g. smtp.gmail.com
//   SMTP_PORT         optional; 465 (the default, encrypted from the start) or 587
//   SMTP_USER         the log in for that mail server, e.g. the Gmail address that sends
//   SMTP_PASS         its password. For Gmail this must be an "App Password", not the normal password
//   SMTP_FROM         optional; the From address (defaults to SMTP_USER)
//
// Without these the feature is simply switched off. Render's FREE plan blocks outgoing mail on ports 25, 465 and 587,
// so this needs a paid instance there.
//
// What is sent, about once a day and whenever the Administrator presses "Email me a backup now":
//  * one email with the whole database (the file Restore Database accepts), and
//  * the uploaded files (homework, payment proofs, the logo) that are new since the last email, zipped, in as many
//    further emails as it takes. Only new files are sent, so a day's email stays small.
// A mail message may not be over 25 MB, and attachments grow by about a third when sent, so each stays under 15 MB.

const MAX_RAW = 15 * 1024 * 1024;
const MAX_UPLOAD_EMAILS = 4;                 // per run; any left over go out on the next run
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const DUE_AFTER_MS = 23 * 60 * 60 * 1000;

const config = () => ({
  to: (process.env.BACKUP_EMAIL_TO || '').trim(),
  host: (process.env.SMTP_HOST || '').trim(),
  port: Number(process.env.SMTP_PORT) || 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
});

export const emailBackupConfigured = () => {
  const c = config();
  return !!(c.to && c.host && c.user && c.pass);
};

export async function emailBackupStatus() {
  return {
    configured: emailBackupConfigured(),
    to: config().to || null,
    lastAt: (await getSetting('last_backup_email_at')) || null,
    lastError: (await getSetting('last_backup_email_error')) || null,
    backlog: (await getSetting('backup_email_backlog')) === '1', // uploaded files still waiting for the next email
  };
}

interface UploadFile { full: string; rel: string; size: number; mtime: number }

function walk(dir: string, base = ''): UploadFile[] {
  if (!fs.existsSync(dir)) return [];
  const out: UploadFile[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(full, rel));
    else if (e.isFile()) { const st = fs.statSync(full); out.push({ full, rel, size: st.size, mtime: st.mtimeMs }); }
  }
  return out;
}

// Groups files, oldest first, so that no group is over the size limit
function inGroups(files: UploadFile[]): UploadFile[][] {
  const groups: UploadFile[][] = [];
  let current: UploadFile[] = [];
  let size = 0;
  for (const f of files) {
    if (current.length && size + f.size > MAX_RAW) { groups.push(current); current = []; size = 0; }
    current.push(f); size += f.size;
  }
  if (current.length) groups.push(current);
  return groups;
}

const mb = (bytes: number) => (bytes / 1048576).toFixed(1);

// Turns a mail library error into something the Administrator can act on. Never includes the password.
function explain(err: any): string {
  const c = config();
  if (err?.code === 'EAUTH') return 'The mail server refused the user name or password (SMTP_USER and SMTP_PASS). For Gmail you need an App Password, not the normal password.';
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS'].includes(err?.code)) {
    return `The mail server ${c.host}:${c.port} could not be reached (${err.message}).${process.env.RENDER ? " Render's free plan blocks outgoing email; a paid instance is needed." : ''}`;
  }
  return String(err?.message || err);
}

let sending = false;

export interface EmailResult { to: string; emails: number; files: number; filesLeft: number; databaseMb: string }

export async function sendBackupEmail(): Promise<EmailResult> {
  if (!emailBackupConfigured()) throw new Error('Emailed backups are not set up on this portal (see the README, "Emailed backups").');
  if (sending) throw new Error('A backup email is already being sent. Please wait a moment.');
  sending = true;
  try {
    const result = await deliver();
    await setSetting('last_backup_email_at', new Date().toISOString());
    await setSetting('last_backup_email_error', '');
    await setSetting('backup_email_backlog', result.filesLeft > 0 ? '1' : '0');
    await noteDownload('email to ' + result.to); // a copy kept somewhere else counts as a downloaded backup
    return result;
  } catch (err: any) {
    const message = explain(err);
    await setSetting('last_backup_email_error', message).catch(() => {});
    throw new Error(message);
  } finally { sending = false; }
}

async function deliver(): Promise<EmailResult> {
  const c = config();
  const school = await getSchoolInfo();
  const day = new Date().toISOString().slice(0, 10);
  const mail = nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass },
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 90000,
  });

  // 1. The database. Sent as the plain file Restore Database accepts; zipped only if it is too big to send as it is.
  let database: Buffer = fs.readFileSync(dbPath);
  let databaseName = `school_portal-${day}.db`;
  if (database.length > MAX_RAW) {
    const zip = new JSZip();
    zip.file(databaseName, database);
    database = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    databaseName += '.zip';
    if (database.length > MAX_RAW) throw new Error(`The database is ${mb(database.length)} MB even when compressed, which is too big to send by email (the limit is about 20 MB). Download it from the Admin Panel instead.`);
  }

  // 2. The uploaded files that are new since the last email
  const since = Number(await getSetting('backup_email_uploads_upto')) || 0;
  const fresh = walk(UPLOADS_DIR).filter((f) => f.mtime > since).sort((a, b) => a.mtime - b.mtime || a.rel.localeCompare(b.rel));
  const groups = inGroups(fresh);
  const sendNow = groups.slice(0, MAX_UPLOAD_EMAILS);
  const filesLeft = groups.slice(MAX_UPLOAD_EMAILS).reduce((n, g) => n + g.length, 0);

  const header = `${school.full_name}\nBackup made ${new Date().toUTCString()}\n\n`;
  const privacy = 'Keep this email private. It holds children\'s records and fee details. Do not forward it, and keep the mailbox it arrives in well protected.\n';
  await mail.sendMail({
    from: c.from, to: c.to, subject: `${school.name} backup - ${day}`,
    text: header +
      `Attached: ${databaseName}, the whole database (pupils, teachers, marks, fees, payments, notices).\n\n` +
      `To use it: log in as Administrator, open Admin Panel, then Database, then Restore Database, and choose this file` +
      `${databaseName.endsWith('.zip') ? ' (unzip it first)' : ''}. That replaces everything the portal holds, so the portal first keeps what it held in the backup list.\n\n` +
      (sendNow.length
        ? `${fresh.length - filesLeft} new uploaded file${fresh.length - filesLeft === 1 ? '' : 's'} (homework, payment proofs) follow in ${sendNow.length} more email${sendNow.length === 1 ? '' : 's'}${filesLeft ? `; ${filesLeft} more will follow in the next backup` : ''}. The portal has no button to put those back: unzip them into the portal's uploads folder.\n\n`
        : 'There are no new uploaded files since the last backup email.\n\n') +
      privacy +
      '\nThis is sent automatically about once a day by the school portal.\n',
    attachments: [{ filename: databaseName, content: database }],
  });

  let files = 0;
  for (let i = 0; i < sendNow.length; i++) {
    const zip = new JSZip();
    for (const f of sendNow[i]) zip.file(f.rel, fs.readFileSync(f.full), { date: new Date(f.mtime) });
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await mail.sendMail({
      from: c.from, to: c.to, subject: `${school.name} uploaded files ${i + 1} of ${sendNow.length} - ${day}`,
      text: header + `Attached: ${sendNow[i].length} uploaded file${sendNow[i].length === 1 ? '' : 's'} (homework, payment proofs), zipped. Part ${i + 1} of ${sendNow.length}.\n\n` + privacy,
      attachments: [{ filename: `uploaded-files-${day}-part${i + 1}.zip`, content: buffer }],
    });
    // Remember how far we got after each email, so a failure part-way does not send the earlier ones again
    await setSetting('backup_email_uploads_upto', String(Math.max(...sendNow[i].map((f) => f.mtime))));
    files += sendNow[i].length;
  }
  return { to: c.to, emails: 1 + sendNow.length, files, filesLeft, databaseMb: mb(database.length) };
}

// A school with only the two starting accounts has nothing worth emailing yet
async function schoolIsEmpty(): Promise<boolean> {
  const row = await queryOne<any>('SELECT COUNT(*) AS n FROM users');
  return Number(row?.n || 0) <= 2;
}

export function startEmailedBackups(): void {
  if (!emailBackupConfigured()) return;
  const run = async () => {
    try {
      if (await schoolIsEmpty()) return;
      const last = Date.parse((await getSetting('last_backup_email_at')) || '');
      const backlog = (await getSetting('backup_email_backlog')) === '1';
      if (!backlog && Number.isFinite(last) && Date.now() - last < DUE_AFTER_MS) return;
      const r = await sendBackupEmail();
      console.log(`Backup emailed to ${r.to} (${r.emails} email${r.emails === 1 ? '' : 's'}, ${r.files} uploaded file${r.files === 1 ? '' : 's'}).`);
    } catch (err: any) { console.error('Emailed backup failed:', err.message); }
  };
  // The first check a minute after start-up (BACKUP_EMAIL_START_DELAY_MS is for the tests), so starting is never slowed
  setTimeout(run, Number(process.env.BACKUP_EMAIL_START_DELAY_MS) || 60000).unref();
  setInterval(run, CHECK_EVERY_MS).unref();
}
