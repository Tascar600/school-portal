import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

// An encrypted copy of the whole database, kept OFF the portal's own computer: in a PRIVATE GitHub repository.
// It is what brings the school back when the host loses its disk (a free Render service does that on every redeploy, restart
// and sleep). See the README, "Off-site backup to GitHub".
//
// Switched on only when all three of these settings exist; with any of them missing this file does nothing at all.
//   BACKUP_GITHUB_TOKEN  a fine-grained token with "Contents: Read and write" on ONE repository
//   BACKUP_GITHUB_REPO   owner/name of that repository. It must be PRIVATE
//   BACKUP_PASSPHRASE    a long secret phrase. Write it down: without it no snapshot can ever be read again
// Optional:
//   BACKUP_BRANCH        the branch the snapshot lives on (default data-backup; made from the default branch if missing)
//   BACKUP_FILE          the file name inside the repository (default snapshot.bin)
//   BACKUP_INTERVAL_MS   how often to look for changes (default 60000). Every upload is one more commit on the branch
//   BACKUP_API_URL       GitHub's API address (default https://api.github.com; the tests point it at a pretend GitHub)
//
// What happens:
//  * Every interval, if the database changed, a consistent copy is taken from memory (never by copying the file), packed
//    as JSON, gzipped, encrypted with AES-256-GCM (key from the passphrase by scrypt) and put on the branch.
//  * When the portal is told to stop (SIGTERM from a redeploy, Ctrl+C) it waits for any upload, makes one last one, then exits.
//  * When the portal starts and has NO database file, the latest snapshot is downloaded, decrypted, checked and written
//    before the database is opened. A database that is already there is never touched.
//  * If that restore fails the portal refuses to start. Carrying on with an empty school would, a minute later, replace the
//    good snapshot with the empty one. "No snapshot exists yet" is the one normal case (the very first start).
// Uploaded files (homework pictures, payment proofs) are NOT in the snapshot; the emailed backups carry those.

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const scrypt = promisify(crypto.scrypt) as (pass: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

export type BackupErrorCode = 'CONFIG' | 'NETWORK' | 'GITHUB' | 'PUBLIC_REPO' | 'WRONG_PASSPHRASE' | 'CORRUPT';
export class BackupError extends Error {
  constructor(public code: BackupErrorCode, message: string) { super(message); this.name = 'BackupError'; }
}

// ── settings ─────────────────────────────────────────────────────────────────

export interface OffsiteConfig { token: string; repo: string; passphrase: string; branch: string; file: string; intervalMs: number; apiUrl: string }

const REQUIRED = ['BACKUP_GITHUB_TOKEN', 'BACKUP_GITHUB_REPO', 'BACKUP_PASSPHRASE'];
const OPTIONAL = ['BACKUP_BRANCH', 'BACKUP_FILE', 'BACKUP_INTERVAL_MS', 'BACKUP_API_URL'];

/** The settings, or null when the feature is off (any of the three required settings missing). */
export function offsiteConfig(env: NodeJS.ProcessEnv = process.env): OffsiteConfig | null {
  const token = (env.BACKUP_GITHUB_TOKEN || '').trim();
  const repo = (env.BACKUP_GITHUB_REPO || '').trim();
  const passphrase = (env.BACKUP_PASSPHRASE || '').trim();
  if (!token || !repo || !passphrase) return null;
  const interval = Number(env.BACKUP_INTERVAL_MS);
  return {
    token, repo, passphrase,
    branch: (env.BACKUP_BRANCH || '').trim() || 'data-backup',
    file: (env.BACKUP_FILE || '').trim() || 'snapshot.bin',
    intervalMs: Number.isFinite(interval) && interval > 0 ? Math.max(50, interval) : 60000,
    apiUrl: (env.BACKUP_API_URL || '').trim() || 'https://api.github.com',
  };
}

/** Warnings about a half-finished or mistyped set-up (names only, never values). Empty when all is well or nothing is set. */
export function offsiteSetupWarnings(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  // A setting typed with dashes instead of underscores is silently ignored by the host, which looks exactly like "not set"
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    const dashed = name.replace(/_/g, '-');
    if (env[dashed] !== undefined) out.push(`The setting ${dashed} is ignored: its name must use underscores, ${name}.`);
  }
  const missing = REQUIRED.filter((n) => !(env[n] || '').trim());
  if (missing.length && missing.length < REQUIRED.length) out.push(`Off-site backup is OFF because ${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set (all three of ${REQUIRED.join(', ')} are needed).`);
  return out;
}

// ── encryption ───────────────────────────────────────────────────────────────
// file = MAGIC (8) | salt (16) | iv (12) | auth tag (16) | ciphertext
const MAGIC = Buffer.from('SPBKUP\x00\x01', 'latin1');
const SALT = 16, IV = 12, TAG = 16;
const HEADER = MAGIC.length + SALT + IV + TAG;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export async function seal(plain: Buffer, passphrase: string): Promise<Buffer> {
  const salt = crypto.randomBytes(SALT), iv = crypto.randomBytes(IV);
  const key = await scrypt(passphrase, salt, 32, SCRYPT);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export async function open(sealed: Buffer, passphrase: string): Promise<Buffer> {
  if (sealed.length < HEADER || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new BackupError('CORRUPT', 'The off-site backup file is not one of ours (it does not start with the expected header) or it was cut short. It was not used.');
  }
  let at = MAGIC.length;
  const salt = sealed.subarray(at, at += SALT), iv = sealed.subarray(at, at += IV), tag = sealed.subarray(at, at += TAG);
  const key = await scrypt(passphrase, salt, 32, SCRYPT);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(sealed.subarray(at)), decipher.final()]);
  } catch {
    throw new BackupError('WRONG_PASSPHRASE', 'The off-site backup could not be decrypted: BACKUP_PASSPHRASE is not the phrase it was made with (or the file is damaged). It was not used.');
  }
}

/** {v:1, db, key} as JSON, then gzip. `key` is a small secret file that must travel with the database; this portal has none. */
export async function pack(db: Buffer, key: Buffer | null = null): Promise<Buffer> {
  return gzip(Buffer.from(JSON.stringify({ v: 1, db: db.toString('base64'), key: key ? key.toString('base64') : null }), 'utf8'));
}

export async function unpack(packed: Buffer): Promise<{ db: Buffer; key: Buffer | null }> {
  let json: any;
  try { json = JSON.parse((await gunzip(packed)).toString('utf8')); } catch { throw new BackupError('CORRUPT', 'The off-site backup decrypted but its contents are damaged. It was not used.'); }
  if (!json || json.v !== 1 || typeof json.db !== 'string' || !json.db) throw new BackupError('CORRUPT', 'The off-site backup is in a format this portal does not know. It was not used.');
  return { db: Buffer.from(json.db, 'base64'), key: typeof json.key === 'string' ? Buffer.from(json.key, 'base64') : null };
}

// ── GitHub (Contents API, plain fetch) ───────────────────────────────────────

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export class GitHubStore {
  private checked = false;
  private defaultBranch = 'main';

  constructor(private cfg: OffsiteConfig) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cfg.repo)) throw new BackupError('CONFIG', 'BACKUP_GITHUB_REPO must look like owner/name, for example "myschool/portal-backups".');
  }

  /** Never lets the token or the passphrase into a message, whatever GitHub or the network said. */
  private scrub(text: string): string {
    let t = String(text);
    for (const secret of [this.cfg.token, this.cfg.passphrase]) if (secret) t = t.split(secret).join('[hidden]');
    return t;
  }

  private async call(method: string, route: string, o: { json?: unknown; accept?: string } = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.token}`, Accept: o.accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'school-portal-offsite-backup',
    };
    if (o.json !== undefined) headers['Content-Type'] = 'application/json';
    try {
      return await fetch(this.cfg.apiUrl.replace(/\/+$/, '') + route, { method, headers, body: o.json !== undefined ? JSON.stringify(o.json) : undefined, signal: AbortSignal.timeout(60000) });
    } catch (e: any) {
      throw new BackupError('NETWORK', this.scrub(`Could not reach GitHub (${e?.cause?.code || e?.message || e}). Check the internet connection (and BACKUP_API_URL if it is set).`));
    }
  }

  private async fail(res: Response, doing: string): Promise<BackupError> {
    const hint = res.status === 401 ? 'the token (BACKUP_GITHUB_TOKEN) was refused: it may be wrong, expired or revoked'
      : res.status === 403 ? 'the token may not do that (it needs "Contents: Read and write" on this repository), or GitHub is limiting requests'
      : res.status === 404 ? 'not found: check BACKUP_GITHUB_REPO, and that the token was given access to that repository'
      : 'unexpected answer';
    let detail = '';
    try { detail = String((await res.json() as any)?.message || '').slice(0, 160); } catch { /* no body */ }
    return new BackupError('GITHUB', this.scrub(`${doing} failed: GitHub answered ${res.status} (${hint})${detail ? `: ${detail}` : ''}.`));
  }

  /** The repository must be reachable and PRIVATE. Checked once. */
  async checkRepo(): Promise<void> {
    if (this.checked) return;
    const res = await this.call('GET', `/repos/${this.cfg.repo}`);
    if (!res.ok) throw await this.fail(res, 'Opening the backup repository');
    const info: any = await res.json();
    if (info.private === false) throw new BackupError('PUBLIC_REPO', `The repository ${this.cfg.repo} is PUBLIC. Children's records must not go to a public place, even encrypted. Make it private in GitHub (Settings, Danger Zone), then start again.`);
    this.defaultBranch = info.default_branch || 'main';
    this.checked = true;
  }

  private async ensureBranch(): Promise<void> {
    const { repo, branch } = this.cfg;
    const have = await this.call('GET', `/repos/${repo}/branches/${enc(branch)}`);
    if (have.ok) return;
    if (have.status !== 404) throw await this.fail(have, 'Looking for the backup branch');
    const base = await this.call('GET', `/repos/${repo}/git/ref/heads/${enc(this.defaultBranch)}`);
    if (base.status === 404 || base.status === 409) throw new BackupError('GITHUB', `The repository ${repo} is empty, so the branch "${branch}" cannot be made from it. Add any file (for example a README) to its ${this.defaultBranch} branch in GitHub, then start again.`);
    if (!base.ok) throw await this.fail(base, `Reading the ${this.defaultBranch} branch`);
    const sha = ((await base.json()) as any)?.object?.sha;
    const made = await this.call('POST', `/repos/${repo}/git/refs`, { json: { ref: `refs/heads/${branch}`, sha } });
    if (!made.ok && made.status !== 422) throw await this.fail(made, `Making the branch "${branch}"`); // 422: it appeared in the meantime
  }

  private async fileSha(): Promise<string | null> {
    const { repo, branch, file } = this.cfg;
    const res = await this.call('GET', `/repos/${repo}/contents/${enc(file)}?ref=${encodeURIComponent(branch)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw await this.fail(res, 'Looking for the backup file');
    return ((await res.json()) as any)?.sha || null;
  }

  async upload(content: Buffer): Promise<void> {
    await this.checkRepo();
    await this.ensureBranch();
    const { repo, branch, file } = this.cfg;
    for (let attempt = 0; ; attempt++) {
      const sha = await this.fileSha();
      const res = await this.call('PUT', `/repos/${repo}/contents/${enc(file)}`, {
        json: { message: `Automatic backup ${new Date().toISOString()}`, content: content.toString('base64'), branch, ...(sha ? { sha } : {}) },
      });
      if (res.ok) return;
      if ((res.status === 409 || res.status === 422) && attempt === 0) continue; // changed under us: look again once
      throw await this.fail(res, 'Uploading the backup');
    }
  }

  /** The latest snapshot's bytes, or null when none has been uploaded yet (no such branch or file). */
  async download(): Promise<Buffer | null> {
    await this.checkRepo();
    const { repo, branch, file } = this.cfg;
    const res = await this.call('GET', `/repos/${repo}/contents/${enc(file)}?ref=${encodeURIComponent(branch)}`, { accept: 'application/vnd.github.raw+json' });
    if (res.status === 404) return null;
    if (!res.ok) throw await this.fail(res, 'Downloading the backup');
    return Buffer.from(await res.arrayBuffer());
  }
}

// ── restore, before the database is opened ───────────────────────────────────

export interface RestoreOptions {
  dbFile: string;
  /** Says what is wrong with a database file, or null when it can be used (config/database.ts checkDatabaseFile). */
  validate?: (db: Buffer) => Promise<string | null>;
  /** Where to put the snapshot's key file, if it has one. */
  keyFile?: string;
}
export type RestoreResult = { status: 'off' } | { status: 'present' } | { status: 'none' } | { status: 'restored'; bytes: number };

export const REFUSAL = 'The portal is refusing to start. It has no database, and starting with an empty one would later replace your good off-site backup with an empty school. Fix the problem above and start again. (If you really do want to start empty, remove the BACKUP_GITHUB_TOKEN, BACKUP_GITHUB_REPO and BACKUP_PASSPHRASE settings.)';

/**
 * Call once, first thing, before the database is opened. Throws a BackupError when a restore was needed and failed:
 * the caller must then refuse to start.
 */
export async function restoreIfNeeded(opts: RestoreOptions, env: NodeJS.ProcessEnv = process.env): Promise<RestoreResult> {
  const cfg = offsiteConfig(env);
  if (!cfg) return { status: 'off' };
  if (fs.existsSync(opts.dbFile) && fs.statSync(opts.dbFile).size > 0) return { status: 'present' }; // never touch a database that is there

  const sealed = await new GitHubStore(cfg).download();
  if (!sealed) return { status: 'none' }; // the very first start: nothing has been backed up yet
  const { db, key } = await unpack(await open(sealed, cfg.passphrase));
  const problem = opts.validate ? await opts.validate(db) : null;
  if (problem) throw new BackupError('CORRUPT', `The off-site backup decrypted, but the database inside is not usable: ${problem}`);

  fs.mkdirSync(path.dirname(opts.dbFile), { recursive: true });
  const tmp = opts.dbFile + '.restoring';
  fs.writeFileSync(tmp, db);
  fs.renameSync(tmp, opts.dbFile); // a whole file or nothing
  if (key && opts.keyFile && !fs.existsSync(opts.keyFile)) fs.writeFileSync(opts.keyFile, key, { mode: 0o600 });
  return { status: 'restored', bytes: db.length };
}

// ── uploading ────────────────────────────────────────────────────────────────

export interface OffsiteSource {
  /** A consistent copy of the database as it is right now. */
  snapshot(): Buffer | Promise<Buffer>;
  /** Goes up whenever the database is saved; cheap, so it is asked before every copy is taken. */
  version(): number;
  /** False while the school holds nothing but its starting accounts: such a copy is never worth sending. */
  worthBackingUp?(): boolean | Promise<boolean>;
  /** The small secret file to travel with the database, if the portal has one. */
  key?(): Buffer | null;
}
export type RunResult = 'uploaded' | 'unchanged' | 'skipped' | 'busy' | 'failed';

export class OffsiteRunner {
  lastOkAt: string | null = null;
  lastError: string | null = null;
  uploads = 0;
  private lastVersion = -1;
  private lastDigest = '';
  private running: Promise<RunResult> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private store: GitHubStore;
  private lastLogged = '';

  constructor(private source: OffsiteSource, private cfg: OffsiteConfig, private log: Pick<Console, 'log' | 'error'> = console) {
    this.store = new GitHubStore(cfg);
  }

  start(): void {
    this.timer = setInterval(() => { void this.runOnce(); }, this.cfg.intervalMs);
    this.timer.unref();
  }

  /** One look: send a new snapshot if (and only if) the database changed. Never two at once. */
  runOnce(): Promise<RunResult> {
    if (this.running) return Promise.resolve('busy');
    this.running = this.attempt().finally(() => { this.running = null; });
    return this.running;
  }

  private async attempt(): Promise<RunResult> {
    try {
      const version = this.source.version();
      if (version === this.lastVersion) return 'unchanged';
      if (this.source.worthBackingUp && !(await this.source.worthBackingUp())) return 'skipped';
      const snapshot = await this.source.snapshot();
      const digest = crypto.createHash('sha256').update(snapshot).digest('hex');
      if (digest === this.lastDigest) { this.lastVersion = version; return 'unchanged'; } // saved again, but nothing in it differs
      const sealed = await seal(await pack(snapshot, this.source.key?.() ?? null), this.cfg.passphrase);
      await this.store.upload(sealed);
      this.lastVersion = version; this.lastDigest = digest;
      this.lastOkAt = new Date().toISOString(); this.lastError = null; this.uploads++;
      this.log.log(`Off-site backup: uploaded ${(sealed.length / 1024).toFixed(0)} KB to ${this.cfg.repo} (branch ${this.cfg.branch}).`);
      this.lastLogged = '';
      return 'uploaded';
    } catch (err: any) {
      this.lastError = String(err?.message || err);
      if (this.lastError !== this.lastLogged) { this.log.error(`Off-site backup FAILED (it will try again): ${this.lastError}`); this.lastLogged = this.lastError; } // not once a minute
      return 'failed';
    }
  }

  /** Stop the schedule, wait for an upload in progress, then make one last one. */
  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try { await this.running; } catch { /* already reported */ }
    await this.runOnce();
  }
}

let runner: OffsiteRunner | null = null;

/** Starts the schedule and the last upload on SIGTERM / SIGINT. Does nothing (returns null) unless all three settings exist. */
export function startOffsiteBackups(source: OffsiteSource, env: NodeJS.ProcessEnv = process.env): OffsiteRunner | null {
  const cfg = offsiteConfig(env);
  if (!cfg || runner) return runner;
  runner = new OffsiteRunner(source, cfg);
  runner.start();
  const stop = (signal: string) => {
    console.log(`Off-site backup: ${signal} received, making a last backup before the portal stops.`);
    const last = runner!.shutdown().catch(() => {});
    const patience = new Promise((r) => setTimeout(r, 20000)); // a stuck connection must not keep the portal from stopping
    void Promise.race([last, patience]).then(() => process.exit(0));
  };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
  console.log(`Off-site backup is ON: ${cfg.repo}, branch ${cfg.branch}, looking for changes every ${Math.round(cfg.intervalMs / 1000)} s.`);
  return runner;
}

export const offsiteRunner = (): OffsiteRunner | null => runner;
