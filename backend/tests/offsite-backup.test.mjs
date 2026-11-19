// Tests for the off-site backup (src/utils/offsiteBackup.ts). Nothing real is contacted: GitHub is a pretend server
// (tests/fake-github.mjs) on a local port, and the portals started here use throw-away folders.
//
//   cd backend
//   npm run test:backup        (node --import tsx --test tests/offsite-backup.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { startFakeGitHub } from './fake-github.mjs';

// The portal's TypeScript is CommonJS; tsx (loaded by `--import tsx`) makes require() understand it, with all its named exports
const require = createRequire(import.meta.url);
const ob = require('../src/utils/offsiteBackup.ts');
const { checkDatabaseFile } = require('../src/config/database.ts');

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSX = path.join(BACKEND, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const PASS = 'a long test passphrase for the school portal';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-test-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = (...dirs) => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); };

/** A real (tiny) SQLite database with the one table checkDatabaseFile looks for. */
async function tinyDb(names = ['Admin', 'Bursar', 'Pupil']) {
  const SQL = await initSqlJs();
  const d = new SQL.Database();
  d.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
  for (const n of names) d.run('INSERT INTO users (name) VALUES (?)', [n]);
  const bytes = Buffer.from(d.export());
  d.close();
  return bytes;
}
/** Puts a snapshot on the pretend GitHub the way the portal does it. */
async function publish(gh, dbBytes, passphrase = PASS) {
  const cfg = ob.offsiteConfig(gh.env());
  await new ob.GitHubStore(cfg).upload(await ob.seal(await ob.pack(dbBytes), passphrase));
}
const rejectsWith = (promise, code, pattern) => assert.rejects(promise, (e) => {
  assert.ok(e instanceof ob.BackupError, `expected a BackupError, got ${e?.name}: ${e?.message}`);
  assert.equal(e.code, code, e.message);
  if (pattern) assert.match(e.message, pattern);
  return true;
});

// ── encryption and packing ───────────────────────────────────────────────────

test('seal and open: a round trip, and every seal is different', async () => {
  const plain = crypto.randomBytes(100_000);
  const a = await ob.seal(plain, PASS), b = await ob.seal(plain, PASS);
  assert.ok(!a.equals(b), 'a fresh salt and iv every time');
  assert.equal(a.subarray(0, 6).toString('latin1'), 'SPBKUP', 'starts with the magic header');
  assert.ok(!a.includes(plain.subarray(0, 64)), 'the plain bytes are not in the file');
  assert.ok((await ob.open(a, PASS)).equals(plain));
  assert.ok((await ob.open(b, PASS)).equals(plain));
  assert.ok((await ob.open(await ob.seal(Buffer.alloc(0), PASS), PASS)).equals(Buffer.alloc(0)), 'even nothing');
});

test('a wrong passphrase gives a clear error, and so does damage', async () => {
  const sealed = await ob.seal(Buffer.from('the whole school'), PASS);
  await rejectsWith(ob.open(sealed, 'not the passphrase'), 'WRONG_PASSPHRASE', /BACKUP_PASSPHRASE/);
  const flipped = Buffer.from(sealed); flipped[flipped.length - 1] ^= 1;
  await rejectsWith(ob.open(flipped, PASS), 'WRONG_PASSPHRASE');
  const wrongHeader = Buffer.from(sealed); wrongHeader[0] = 0x58;
  await rejectsWith(ob.open(wrongHeader, PASS), 'CORRUPT', /not one of ours/);
  await rejectsWith(ob.open(sealed.subarray(0, 30), PASS), 'CORRUPT');
  await rejectsWith(ob.open(Buffer.from('hello'), PASS), 'CORRUPT');
});

test('pack and unpack: a round trip, with and without a key file', async () => {
  const db = await tinyDb();
  const withKey = await ob.unpack(await ob.pack(db, Buffer.from('secret-key-bytes')));
  assert.ok(withKey.db.equals(db)); assert.equal(withKey.key.toString(), 'secret-key-bytes');
  const without = await ob.unpack(await ob.pack(db));
  assert.ok(without.db.equals(db)); assert.equal(without.key, null);
  const json = JSON.parse(zlib.gunzipSync(await ob.pack(db)).toString());
  assert.deepEqual(Object.keys(json).sort(), ['db', 'key', 'v'], 'the {v, db, key} layout');
  await rejectsWith(ob.unpack(Buffer.from('not gzip at all')), 'CORRUPT');
  await rejectsWith(ob.unpack(zlib.gzipSync('not json')), 'CORRUPT');
  await rejectsWith(ob.unpack(zlib.gzipSync(JSON.stringify({ v: 2, db: 'AAAA' }))), 'CORRUPT', /format/);
  await rejectsWith(ob.unpack(zlib.gzipSync(JSON.stringify({ v: 1 }))), 'CORRUPT');
});

// ── settings ─────────────────────────────────────────────────────────────────

test('the feature is off unless all three settings exist, and defaults fill the rest', () => {
  assert.equal(ob.offsiteConfig({}), null);
  assert.equal(ob.offsiteConfig({ BACKUP_GITHUB_TOKEN: 't', BACKUP_GITHUB_REPO: 'o/r' }), null);
  assert.equal(ob.offsiteConfig({ BACKUP_GITHUB_TOKEN: 't', BACKUP_PASSPHRASE: 'p' }), null);
  assert.equal(ob.offsiteConfig({ BACKUP_GITHUB_REPO: 'o/r', BACKUP_PASSPHRASE: 'p' }), null);
  assert.equal(ob.offsiteConfig({ BACKUP_GITHUB_TOKEN: '  ', BACKUP_GITHUB_REPO: 'o/r', BACKUP_PASSPHRASE: 'p' }), null, 'blank counts as missing');
  const c = ob.offsiteConfig({ BACKUP_GITHUB_TOKEN: 't', BACKUP_GITHUB_REPO: 'o/r', BACKUP_PASSPHRASE: 'p' });
  assert.deepEqual(c, { token: 't', repo: 'o/r', passphrase: 'p', branch: 'data-backup', file: 'snapshot.bin', intervalMs: 60000, apiUrl: 'https://api.github.com' });
  const o = ob.offsiteConfig({ BACKUP_GITHUB_TOKEN: 't', BACKUP_GITHUB_REPO: 'o/r', BACKUP_PASSPHRASE: 'p', BACKUP_BRANCH: 'b', BACKUP_FILE: 'f.bin', BACKUP_INTERVAL_MS: '5000', BACKUP_API_URL: 'http://x' });
  assert.deepEqual([o.branch, o.file, o.intervalMs, o.apiUrl], ['b', 'f.bin', 5000, 'http://x']);
  assert.equal(ob.offsiteConfig({ BACKUP_GITHUB_TOKEN: 't', BACKUP_GITHUB_REPO: 'o/r', BACKUP_PASSPHRASE: 'p', BACKUP_INTERVAL_MS: 'soon' }).intervalMs, 60000);
});

test('a half-finished or mistyped set-up is called out by name, never by value', () => {
  assert.deepEqual(ob.offsiteSetupWarnings({}), []);
  const partial = ob.offsiteSetupWarnings({ BACKUP_GITHUB_TOKEN: 'ghp_secretvalue' });
  assert.equal(partial.length, 1);
  assert.match(partial[0], /BACKUP_GITHUB_REPO and BACKUP_PASSPHRASE/);
  assert.ok(!partial.join().includes('ghp_secretvalue'));
  const dashed = ob.offsiteSetupWarnings({ 'BACKUP-PASSPHRASE': 'hunter2' });
  assert.ok(dashed.some((w) => /BACKUP-PASSPHRASE is ignored.*BACKUP_PASSPHRASE/.test(w)) && !dashed.join().includes('hunter2'));
  assert.deepEqual(ob.offsiteSetupWarnings({ BACKUP_GITHUB_TOKEN: 't', BACKUP_GITHUB_REPO: 'o/r', BACKUP_PASSPHRASE: 'p' }), []);
});

// ── GitHub ───────────────────────────────────────────────────────────────────

test('GitHub: the branch is made from the default branch, then updated; download returns the latest', async () => {
  const gh = await startFakeGitHub();
  try {
    const store = new ob.GitHubStore(ob.offsiteConfig(gh.env()));
    assert.equal(await store.download(), null, 'no snapshot yet is not an error');
    await store.upload(Buffer.from('first'));
    assert.equal(gh.state.branches.get('data-backup'), gh.state.branches.get('main'), 'branch made from the default branch');
    assert.equal(gh.stored().toString(), 'first');
    await store.upload(Buffer.from('second'));
    assert.equal(gh.state.commits, 2);
    assert.equal(gh.stored().toString(), 'second');
    assert.equal((await new ob.GitHubStore(ob.offsiteConfig(gh.env())).download()).toString(), 'second', 'a fresh client sees the latest');
    assert.ok(gh.state.requests.every((r) => !r.includes(gh.token)), 'the token is only ever in a header');
  } finally { await gh.close(); }
});

test('GitHub: a snapshot larger than 1 MB goes up and comes back whole', async () => {
  const gh = await startFakeGitHub();
  try {
    const store = new ob.GitHubStore(ob.offsiteConfig(gh.env()));
    const big = crypto.randomBytes(3 * 1024 * 1024);
    await store.upload(big);
    await store.upload(crypto.randomBytes(2 * 1024 * 1024)); // an update has to find the sha of a file the JSON view cannot show
    const again = crypto.randomBytes(2 * 1024 * 1024);
    await store.upload(again);
    assert.ok((await store.download()).equals(again));
  } finally { await gh.close(); }
});

test('GitHub: a public repository is refused, and nothing is sent to it', async () => {
  const gh = await startFakeGitHub({ isPrivate: false });
  try {
    const store = new ob.GitHubStore(ob.offsiteConfig(gh.env()));
    await rejectsWith(store.upload(Buffer.from('x')), 'PUBLIC_REPO', /PUBLIC/);
    await rejectsWith(store.download(), 'PUBLIC_REPO');
    assert.equal(gh.state.commits, 0);
    assert.equal(gh.state.branches.has('data-backup'), false);
  } finally { await gh.close(); }
});

test('GitHub: errors say what to check and never contain the token or the passphrase', async () => {
  const gh = await startFakeGitHub();
  try {
    const bad = new ob.GitHubStore(ob.offsiteConfig(gh.env({ BACKUP_GITHUB_TOKEN: 'ghp_WRONGSECRETTOKEN' })));
    await assert.rejects(bad.download(), (e) => { assert.equal(e.code, 'GITHUB'); assert.match(e.message, /401.*BACKUP_GITHUB_TOKEN/); assert.ok(!e.message.includes('ghp_WRONGSECRETTOKEN')); return true; });
    const lost = new ob.GitHubStore(ob.offsiteConfig(gh.env({ BACKUP_GITHUB_REPO: 'owner/some-other-repo' })));
    await rejectsWith(lost.download(), 'GITHUB', /404.*BACKUP_GITHUB_REPO/);
    const outage = await startFakeGitHub(); outage.state.failWith = 503;
    await rejectsWith(new ob.GitHubStore(ob.offsiteConfig(outage.env())).upload(Buffer.from('x')), 'GITHUB', /503/);
    await outage.close();
    const down = new ob.GitHubStore(ob.offsiteConfig(gh.env({ BACKUP_API_URL: 'http://127.0.0.1:1' })));
    await assert.rejects(down.download(), (e) => { assert.equal(e.code, 'NETWORK'); assert.match(e.message, /Could not reach GitHub/); assert.ok(!e.message.includes(gh.token) && !e.message.includes(PASS)); return true; });
    assert.throws(() => new ob.GitHubStore({ ...ob.offsiteConfig(gh.env()), repo: 'not a repo' }), (e) => e.code === 'CONFIG' && /owner\/name/.test(e.message));
  } finally { await gh.close(); }
});

test('GitHub: an empty repository (no default branch yet) says to add a README', async () => {
  const gh = await startFakeGitHub({ empty: true });
  try {
    await rejectsWith(new ob.GitHubStore(ob.offsiteConfig(gh.env())).upload(Buffer.from('x')), 'GITHUB', /empty.*README/);
  } finally { await gh.close(); }
});

// ── the schedule ─────────────────────────────────────────────────────────────

function fakeSchool(first = 'one') {
  const school = { data: Buffer.from(first), version: 0, worth: true, delay: 0 };
  school.source = {
    version: () => school.version,
    worthBackingUp: () => school.worth,
    // like the real database, the copy is taken at once; only handing it over can be slow
    snapshot: async () => { const copy = school.data; if (school.delay) await sleep(school.delay); return copy; },
  };
  school.change = (text) => { school.data = Buffer.from(text); school.version++; };
  return school;
}
const quietLog = () => { const lines = { log: [], error: [] }; return { lines, log: { log: (m) => lines.log.push(m), error: (m) => lines.error.push(m) } }; };
const readStored = async (gh) => (await ob.unpack(await ob.open(gh.stored(), PASS))).db.toString();

test('the runner uploads only what changed, encrypted, and never two at once', async () => {
  const gh = await startFakeGitHub();
  try {
    const school = fakeSchool('first state');
    const { log } = quietLog();
    const runner = new ob.OffsiteRunner(school.source, ob.offsiteConfig(gh.env()), log);

    assert.equal(await runner.runOnce(), 'uploaded');
    assert.equal(await readStored(gh), 'first state', 'what was stored decrypts to the database');
    assert.ok(!gh.stored().includes(Buffer.from('first state')), 'and is not readable as stored');

    const requests = gh.state.requests.length;
    assert.equal(await runner.runOnce(), 'unchanged');
    assert.equal(gh.state.requests.length, requests, 'nothing changed, so GitHub was not even asked');

    school.version++; // saved again, but byte for byte the same
    assert.equal(await runner.runOnce(), 'unchanged');
    assert.equal(gh.state.commits, 1);

    school.change('second state');
    assert.equal(await runner.runOnce(), 'uploaded');
    assert.equal(await readStored(gh), 'second state');
    assert.equal(gh.state.commits, 2);

    school.change('third state'); school.delay = 150;
    const first = runner.runOnce();
    assert.equal(await runner.runOnce(), 'busy', 'a second upload cannot start while one is running');
    assert.equal(await first, 'uploaded');
    assert.equal(gh.state.commits, 3);
  } finally { await gh.close(); }
});

test('a school with nothing but its starting accounts is never uploaded', async () => {
  const gh = await startFakeGitHub();
  try {
    const school = fakeSchool(); school.worth = false;
    const runner = new ob.OffsiteRunner(school.source, ob.offsiteConfig(gh.env()), quietLog().log);
    assert.equal(await runner.runOnce(), 'skipped');
    assert.equal(gh.state.commits, 0);
    school.worth = true;
    assert.equal(await runner.runOnce(), 'uploaded');
  } finally { await gh.close(); }
});

test('a failed upload is reported once, retried, and clears when GitHub is back', async () => {
  const gh = await startFakeGitHub();
  try {
    const school = fakeSchool();
    const { lines, log } = quietLog();
    const runner = new ob.OffsiteRunner(school.source, ob.offsiteConfig(gh.env()), log);
    gh.state.failWith = 500;
    assert.equal(await runner.runOnce(), 'failed');
    assert.equal(await runner.runOnce(), 'failed');
    assert.match(runner.lastError, /500/);
    assert.equal(lines.error.length, 1, 'the same problem is not logged every minute');
    gh.state.failWith = 0;
    assert.equal(await runner.runOnce(), 'uploaded', 'the change that could not be sent is sent now');
    assert.equal(runner.lastError, null);
    assert.ok(!lines.log.concat(lines.error).join('\n').match(new RegExp(`${gh.token}|${PASS}`)), 'no secret in the log');
  } finally { await gh.close(); }
});

test('on the schedule, a change is found and sent without anyone asking', async () => {
  const gh = await startFakeGitHub();
  try {
    const school = fakeSchool();
    const runner = new ob.OffsiteRunner(school.source, ob.offsiteConfig(gh.env({ BACKUP_INTERVAL_MS: '80' })), quietLog().log);
    runner.start();
    for (let i = 0; i < 60 && gh.state.commits < 1; i++) await sleep(50);
    assert.equal(gh.state.commits, 1);
    await sleep(300);
    assert.equal(gh.state.commits, 1, 'and then nothing more while nothing changes');
    school.change('changed');
    for (let i = 0; i < 60 && gh.state.commits < 2; i++) await sleep(50);
    assert.equal(await readStored(gh), 'changed');
    await runner.shutdown();
  } finally { await gh.close(); }
});

test('shutdown waits for an upload in progress, then makes one last upload of the final state', async () => {
  const gh = await startFakeGitHub();
  try {
    const school = fakeSchool('state A'); school.delay = 200;
    const runner = new ob.OffsiteRunner(school.source, ob.offsiteConfig(gh.env({ BACKUP_INTERVAL_MS: '600000' })), quietLog().log);
    runner.start();
    const inFlight = runner.runOnce();
    await sleep(60); // the copy of state A has been taken and is on its way
    school.change('state B (made while the upload was running)');
    await runner.shutdown();
    assert.equal(await inFlight, 'uploaded');
    assert.equal(gh.state.commits, 2, 'the one in progress, then the last one');
    assert.equal(await readStored(gh), 'state B (made while the upload was running)');
    assert.equal(await runner.runOnce(), 'unchanged');
  } finally { await gh.close(); }
});

test('SIGTERM: the stop handler makes the last upload, then exits cleanly', { timeout: 60000 }, async () => {
  const gh = await startFakeGitHub();
  try {
    const env = { ...process.env, ...gh.env({ BACKUP_INTERVAL_MS: '600000' }) }; // so only the stop can have uploaded anything
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(BACKEND, 'tests', 'offsite-signal-child.mjs')], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    const code = await Promise.race([new Promise((r) => child.on('exit', r)), sleep(40000).then(() => { child.kill(); return 'timeout'; })]);
    assert.equal(code, 0, out);
    assert.match(out, /SIGTERM received, making a last backup/);
    assert.equal(gh.state.commits, 1);
    assert.equal(await readStored(gh), 'state 2: the last change before the host stopped the portal');
  } finally { await gh.close(); }
});

test('with the feature off, no signal handler is installed and nothing starts', () => {
  const before = [process.listenerCount('SIGTERM'), process.listenerCount('SIGINT')];
  assert.equal(ob.startOffsiteBackups({ snapshot: () => Buffer.alloc(0), version: () => 0 }, { BACKUP_GITHUB_TOKEN: 't', BACKUP_GITHUB_REPO: 'o/r' }), null);
  assert.deepEqual([process.listenerCount('SIGTERM'), process.listenerCount('SIGINT')], before);
});

// ── restore ──────────────────────────────────────────────────────────────────

test('restore: does nothing at all unless all three settings exist', async () => {
  const gh = await startFakeGitHub();
  const dir = tmp();
  try {
    await publish(gh, await tinyDb());
    const dbFile = path.join(dir, 'school_portal.db');
    const requests = gh.state.requests.length;
    assert.deepEqual(await ob.restoreIfNeeded({ dbFile, validate: checkDatabaseFile }, { BACKUP_GITHUB_TOKEN: gh.token, BACKUP_GITHUB_REPO: gh.repo, BACKUP_API_URL: gh.url }), { status: 'off' });
    assert.equal(fs.existsSync(dbFile), false);
    assert.equal(gh.state.requests.length, requests, 'GitHub was not contacted');
  } finally { await gh.close(); cleanup(dir); }
});

test('restore: a missing database is brought back, whole, and the folder is made if needed', async () => {
  const gh = await startFakeGitHub();
  const dir = tmp();
  try {
    const bytes = await tinyDb(['Admin', 'Bursar', 'Rudo', 'Tendai']);
    await publish(gh, bytes);
    const dbFile = path.join(dir, 'a', 'new', 'disk', 'school_portal.db');
    const result = await ob.restoreIfNeeded({ dbFile, validate: checkDatabaseFile }, gh.env());
    assert.deepEqual(result, { status: 'restored', bytes: bytes.length });
    assert.ok(fs.readFileSync(dbFile).equals(bytes));
    assert.deepEqual(fs.readdirSync(path.dirname(dbFile)), ['school_portal.db'], 'no half-written file left behind');
  } finally { await gh.close(); cleanup(dir); }
});

test('restore: an empty (zero byte) database file counts as missing', async () => {
  const gh = await startFakeGitHub();
  const dir = tmp();
  try {
    const bytes = await tinyDb();
    await publish(gh, bytes);
    const dbFile = path.join(dir, 'school_portal.db');
    fs.writeFileSync(dbFile, '');
    assert.equal((await ob.restoreIfNeeded({ dbFile, validate: checkDatabaseFile }, gh.env())).status, 'restored');
    assert.ok(fs.readFileSync(dbFile).equals(bytes));
  } finally { await gh.close(); cleanup(dir); }
});

test('restore: refuses to overwrite a database that is there, and does not even contact GitHub', async () => {
  const gh = await startFakeGitHub();
  const dir = tmp();
  try {
    await publish(gh, await tinyDb(['from the backup']));
    const dbFile = path.join(dir, 'school_portal.db');
    const mine = Buffer.from('the school as it is today: precious, and not even a valid database');
    fs.writeFileSync(dbFile, mine);
    const requests = gh.state.requests.length;
    assert.deepEqual(await ob.restoreIfNeeded({ dbFile, validate: checkDatabaseFile }, gh.env()), { status: 'present' });
    assert.ok(fs.readFileSync(dbFile).equals(mine), 'untouched');
    assert.equal(gh.state.requests.length, requests, 'no network was needed');
    gh.state.failWith = 500; // and an outage cannot stop a portal that has its data
    assert.deepEqual(await ob.restoreIfNeeded({ dbFile, validate: checkDatabaseFile }, gh.env()), { status: 'present' });
  } finally { await gh.close(); cleanup(dir); }
});

test('restore: no snapshot yet is the normal first start, not an error', async () => {
  const gh = await startFakeGitHub();
  const dir = tmp();
  try {
    const dbFile = path.join(dir, 'school_portal.db');
    assert.deepEqual(await ob.restoreIfNeeded({ dbFile, validate: checkDatabaseFile }, gh.env()), { status: 'none' });
    assert.equal(fs.existsSync(dbFile), false);
  } finally { await gh.close(); cleanup(dir); }
});

test('restore: every way it can fail throws, and writes nothing', async () => {
  const gh = await startFakeGitHub();
  const dir = tmp();
  const dbFile = path.join(dir, 'school_portal.db');
  const attempt = (env = gh.env()) => ob.restoreIfNeeded({ dbFile, validate: checkDatabaseFile }, env);
  try {
    await publish(gh, await tinyDb());
    await rejectsWith(attempt(gh.env({ BACKUP_PASSPHRASE: 'some other phrase' })), 'WRONG_PASSPHRASE', /passphrase/i);
    await rejectsWith(attempt(gh.env({ BACKUP_API_URL: 'http://127.0.0.1:1' })), 'NETWORK');
    gh.state.failWith = 502;
    await rejectsWith(attempt(), 'GITHUB', /502/);
    gh.state.failWith = 0;

    await new ob.GitHubStore(ob.offsiteConfig(gh.env())).upload(Buffer.from('this is not a backup at all'));
    await rejectsWith(attempt(), 'CORRUPT', /not one of ours/);

    await publish(gh, Buffer.from('decrypts fine but is not a database'));
    await rejectsWith(attempt(), 'CORRUPT', /not usable/);

    const noUsers = await (async () => { const SQL = await initSqlJs(); const d = new SQL.Database(); d.run('CREATE TABLE other (x)'); const b = Buffer.from(d.export()); d.close(); return b; })();
    await publish(gh, noUsers);
    await rejectsWith(attempt(), 'CORRUPT', /not a backup of this portal/);

    assert.equal(fs.existsSync(dbFile), false, 'through all of that no database file was written');
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { await gh.close(); cleanup(dir); }
});

// ── the real portal ──────────────────────────────────────────────────────────

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });

async function startPortal(dataDir, backupEnv) {
  const port = await freePort();
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^BACKUP[_-]/i.test(k) || k === 'DB_PATH' || k === 'RENDER') delete env[k]; // never inherit the developer's real settings
  const child = spawn(process.execPath, [TSX, 'src/index.ts'], {
    cwd: BACKEND, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...env, ...backupEnv, PORT: String(port), DATA_DIR: dataDir, JWT_SECRET: 'offsite-test-secret', AUTH_RATE_LIMIT: '2000', FIRST_LOGIN_PASSWORD_CHANGE: 'off' },
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  const portal = { child, port, url: `http://127.0.0.1:${port}`, output: () => output, exited, stopped: false };
  portal.stop = async () => { if (!portal.stopped) { portal.stopped = true; child.kill(); } await exited; };
  portal.healthy = async (ms = 60000) => {
    for (let waited = 0; waited < ms; waited += 250) {
      if (child.exitCode !== null) throw new Error(`the portal exited with code ${child.exitCode}:\n${output}`);
      try { if ((await fetch(`${portal.url}/api/health`)).ok) return; } catch { /* not up yet */ }
      await sleep(250);
    }
    throw new Error(`the portal did not start in ${ms} ms:\n${output}`);
  };
  portal.api = async (method, route, token, body) => {
    const r = await fetch(portal.url + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data = text; try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, data };
  };
  return portal;
}

test('start-up: configured, no database, and the snapshot cannot be read -> the portal REFUSES to start', { timeout: 120000 }, async () => {
  const gh = await startFakeGitHub();
  const dir = tmp();
  let portal;
  try {
    await new ob.GitHubStore(ob.offsiteConfig(gh.env())).upload(Buffer.from('a snapshot that is not readable'));
    portal = await startPortal(dir, gh.env());
    const code = await Promise.race([portal.exited, sleep(60000).then(() => 'timeout')]);
    assert.equal(code, 1, `exit code (output:\n${portal.output()})`);
    assert.match(portal.output(), /refusing to start/);
    assert.match(portal.output(), /Off-site backup/);
    assert.ok(!portal.output().includes(gh.token) && !portal.output().includes(PASS), 'no secret printed');
    assert.equal(fs.existsSync(path.join(dir, 'school_portal.db')), false, 'no empty database was made');
    await assert.rejects(fetch(`${portal.url}/api/health`), 'and nothing is listening');
    assert.equal(gh.state.commits, 1, 'the good snapshot was not replaced');
  } finally { await portal?.stop(); await gh.close(); cleanup(dir); }
});

test('start-up: configured, no database, and GitHub cannot be reached -> the portal REFUSES to start', { timeout: 120000 }, async () => {
  const dir = tmp();
  let portal;
  try {
    portal = await startPortal(dir, { BACKUP_GITHUB_TOKEN: 'ghp_x', BACKUP_GITHUB_REPO: 'o/r', BACKUP_PASSPHRASE: PASS, BACKUP_API_URL: 'http://127.0.0.1:1' });
    assert.equal(await Promise.race([portal.exited, sleep(60000).then(() => 'timeout')]), 1, portal.output());
    assert.match(portal.output(), /Could not reach GitHub/);
    assert.match(portal.output(), /refusing to start/);
    assert.equal(fs.existsSync(path.join(dir, 'school_portal.db')), false);
  } finally { await portal?.stop(); cleanup(dir); }
});

test('REDEPLOY: delete the disk, start again, and the school comes back', { timeout: 180000 }, async () => {
  const gh = await startFakeGitHub();
  const diskA = tmp(), diskB = tmp();
  let a, b;
  try {
    // ── the first life of the portal ──
    a = await startPortal(diskA, gh.env({ BACKUP_INTERVAL_MS: '300' }));
    await a.healthy();
    assert.match(a.output(), /Off-site backup is ON/);
    assert.match(a.output(), /no copy exists yet/, 'the very first start is normal, not an error');
    const login = await a.api('POST', '/api/auth/login', null, { email: 'punhamasiwa@gmail.com', password: '1234' });
    assert.equal(login.status, 200);
    const token = login.data.token;

    await sleep(1500);
    assert.equal(gh.state.commits, 0, 'a school with only its two starting accounts is not uploaded');

    const classes = (await a.api('GET', '/api/admin/classes', token)).data;
    const made = await a.api('POST', '/api/admin/users', token, { first_name: 'Redeploy', last_name: 'Pupil', role: 'student', class_id: classes[0].id });
    assert.equal(made.status, 201);
    const notice = await a.api('POST', '/api/notices', token, { title: 'This notice survives a redeploy', content: 'It was written before the disk was lost.', target_role: 'all' });
    assert.equal(notice.status, 201);

    // wait until the uploads have caught up with the last change
    let seen = -1, steady = 0;
    for (let i = 0; i < 100 && steady < 5; i++) { await sleep(300); steady = gh.state.commits === seen && gh.state.commits > 0 ? steady + 1 : 0; seen = gh.state.commits; }
    assert.ok(gh.state.commits >= 1, 'the change was uploaded on the schedule');
    const stored = (await ob.unpack(await ob.open(gh.stored(), PASS))).db;
    const SQL = await initSqlJs();
    const peek = new SQL.Database(stored);
    assert.equal(peek.exec("SELECT COUNT(*) FROM users WHERE name = 'Redeploy Pupil'")[0].values[0][0], 1, 'the stored snapshot holds the pupil');
    assert.equal(peek.exec("SELECT COUNT(*) FROM notices WHERE title = 'This notice survives a redeploy'")[0].values[0][0], 1, 'and the notice');
    peek.close();

    // ── the redeploy: the process dies and the disk is gone ──
    await a.stop();
    cleanup(diskA);
    assert.equal(fs.existsSync(diskA), false);

    // ── the second life, on a brand-new empty disk ──
    b = await startPortal(diskB, gh.env({ BACKUP_INTERVAL_MS: '300' }));
    await b.healthy();
    assert.match(b.output(), /restored from the off-site copy/);
    const again = await b.api('POST', '/api/auth/login', null, { email: 'punhamasiwa@gmail.com', password: '1234' });
    assert.equal(again.status, 200, 'the same accounts');
    const users = (await b.api('GET', '/api/admin/users', again.data.token)).data;
    assert.ok(users.some((u) => u.name === 'Redeploy Pupil' && u.role === 'student'), 'the pupil is back');
    const notices = (await b.api('GET', '/api/notices', again.data.token)).data;
    assert.ok(notices.some((n) => n.title === 'This notice survives a redeploy'), 'the notice is back');
    assert.equal((await b.api('GET', '/school_portal.db')).status, 403, 'the database file is never served');
    assert.ok(!b.output().includes(gh.token) && !b.output().includes(PASS), 'no secret printed');
  } finally { await a?.stop(); await b?.stop(); await gh.close(); cleanup(diskA, diskB); }
});
