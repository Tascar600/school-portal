// A rehearsal of a real deployment, on this computer only. Needs the frontend built (npm run test:production does that).
// Starts the portal the way a host would (built pages served by the backend, brand-new empty database, RENDER=true) on
// port 5057 and checks what a visitor gets, that the security warning appears when JWT_SECRET is missing, and that with a
// permanent disk (DATA_DIR) the database and uploads live on it and survive a restart.
//   npm run test:production
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const jwt = createRequire(import.meta.url)('jsonwebtoken');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const DIST = path.resolve(BACKEND, '../frontend/dist');
const PORT = 5057, SITE = `http://localhost:${PORT}`, API = SITE + '/api';
const DB = path.join(HERE, 'browser', 'output', 'production-test.db');
fs.mkdirSync(path.dirname(DB), { recursive: true });

let ok = 0, failed = 0;
const check = (name, pass, detail = '') => { pass ? ok++ : failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : '  -> ' + detail}`); };
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('The frontend is not built. Run: npm run test:production'); process.exit(2); }

async function rehearse(label, extraEnv) {
  fs.rmSync(DB, { force: true });
  const env = { ...process.env, PORT: String(PORT), DB_PATH: DB, RENDER: 'true', ...extraEnv };
  delete env.FIRST_LOGIN_PASSWORD_CHANGE; delete env.AUTH_RATE_LIMIT; delete env.SMS_WEBHOOK_URL;
  if (!extraEnv.JWT_SECRET) delete env.JWT_SECRET;
  let log = '';
  const server = spawn(process.execPath, [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(API + '/branding')).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
    const page = await fetch(SITE + '/'); const html = await page.text();
    check(`[${label}] the home page is the built portal`, page.status === 200 && /<div id="root">/.test(html) && /assets\/index-.*\.js/.test(html), html.slice(0, 120));
    const deep = await fetch(SITE + '/finance/payments');
    check(`[${label}] opening a page address directly (a bookmark, a refresh) still gives the portal`, deep.status === 200 && /<div id="root">/.test(await deep.text()));
    const js = html.match(/assets\/index-[^"]+\.js/)?.[0];
    const asset = await fetch(SITE + '/' + js);
    check(`[${label}] the script file is served`, asset.status === 200 && /javascript/.test(asset.headers.get('content-type') || ''), String(asset.status));
    check(`[${label}] the public school details are served`, (await (await fetch(API + '/branding')).json()).school?.full_name === 'CHAKARI GVT PRIMARY SCHOOL');
    check(`[${label}] nothing private is open without logging in`, (await fetch(API + '/admin/users')).status === 401 && (await fetch(API + '/audit')).status === 401);
    const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'punhamasiwa@gmail.com', password: '1234' }) })).json();
    check(`[${label}] a brand-new portal makes the Administrator choose a password first`, login.user?.must_change_password === 1);
    const changed = await (await fetch(API + '/auth/change-password', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + login.token }, body: JSON.stringify({ current_password: '1234', new_password: 'Chakari2026!' }) })).json();
    const dash = await (await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + changed.token } })).json();
    // A token signed with the secret that is written in the public source code must be useless on a host
    const forged = jwt.sign({ id: 1, email: 'punhamasiwa@gmail.com', role: 'admin' }, 'fallback_secret_do_not_use_in_prod', { expiresIn: '5m' });
    const forgedTry = await fetch(API + '/auth/me', { headers: { Authorization: 'Bearer ' + forged } });
    check(`[${label}] a login forged with the public fallback secret is refused`, forgedTry.status === 401, String(forgedTry.status));
    return { log, dash };
  } finally {
    try { server.kill(); } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 600));
    fs.rmSync(DB, { force: true });
  }
}

const insecure = await rehearse('no JWT_SECRET', {});
check('without JWT_SECRET the server says so in its log, and tells the Administrator on the dashboard', /SECURITY WARNING: JWT_SECRET is not set/.test(insecure.log) && /random secret was made/.test(insecure.log), insecure.log.slice(-300));
check('and the Administrator\'s dashboard is told to fix it', insecure.dash.insecureSecret === true, JSON.stringify(insecure.dash).slice(0, 160));
const secure = await rehearse('with JWT_SECRET', { JWT_SECRET: 'rehearsal-secret-' + 'x'.repeat(40) });
check('with JWT_SECRET set there is no warning', !/SECURITY WARNING/.test(secure.log) && secure.dash.insecureSecret === false, secure.log.slice(-200));

// ── A host with a permanent disk: everything lives under DATA_DIR and survives a restart ─────────────────────────────
// The disk is pretended by an ordinary folder. Nothing may be written into the project folder (a host wipes that one).
const DATA = path.join(HERE, 'browser', 'output', 'production-data');
const PASSWORD = 'Chakari2026!';
const LOGO = fs.readFileSync(path.join(BACKEND, 'assets/logo-small.png'));
const strayLogo = path.join(BACKEND, 'uploads/branding/logo.png');

async function startOnDisk() {
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: DATA, RENDER: 'true', JWT_SECRET: 'rehearsal-secret-' + 'x'.repeat(40) };
  for (const k of ['DB_PATH', 'FIRST_LOGIN_PASSWORD_CHANGE', 'AUTH_RATE_LIMIT', 'SMS_WEBHOOK_URL', 'BACKUP_DIR']) delete env[k];
  let log = '';
  const server = spawn(process.execPath, [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 40; i++) { try { if ((await fetch(API + '/branding')).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
  return { server, getLog: () => log };
}
const stop = async (s) => { try { s.kill(); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 800)); };
const post = (url, token, body) => fetch(API + url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }).then((r) => r.json());

fs.rmSync(DATA, { recursive: true, force: true });
fs.rmSync(strayLogo, { force: true });
let first;
try {
  first = await startOnDisk();
  const login = await post('/auth/login', null, { email: 'punhamasiwa@gmail.com', password: '1234' });
  const changed = await post('/auth/change-password', login.token, { current_password: '1234', new_password: PASSWORD });
  const form = new FormData(); form.append('logo', new Blob([LOGO], { type: 'image/png' }), 'logo.png');
  const up = await fetch(API + '/branding/logo', { method: 'POST', headers: { Authorization: 'Bearer ' + changed.token }, body: form });
  check('[disk] the Administrator can choose a password and upload a logo', !!changed.token && up.status === 200, `${up.status}`);
  check('[disk] the database is made inside DATA_DIR', fs.existsSync(path.join(DATA, 'school_portal.db')));
  check('[disk] the uploaded logo is kept inside DATA_DIR', fs.existsSync(path.join(DATA, 'uploads/branding/logo.png')));
  check('[disk] the upload folders for homework and payments are made inside DATA_DIR', fs.existsSync(path.join(DATA, 'uploads/homework')) && fs.existsSync(path.join(DATA, 'uploads/payments')));
  check('[disk] the automatic daily copy is kept on the disk too', fs.existsSync(path.join(DATA, 'backups')) && fs.readdirSync(path.join(DATA, 'backups')).some((n) => /^school_portal-.*\.db$/.test(n)));
  check('[disk] nothing is written into the project folder (a host wipes it)', !fs.existsSync(strayLogo) && !fs.existsSync(path.join(BACKEND, 'school_portal.db')));
  await stop(first.server);

  // The host restarts: a new process, the same disk
  const second = await startOnDisk(); first = second;
  const again = await post('/auth/login', null, { email: 'punhamasiwa@gmail.com', password: PASSWORD });
  check('[disk] after a restart the Administrator\'s own password still works (the database survived)', !!again.token && !again.user?.must_change_password, JSON.stringify(again).slice(0, 120));
  const logo = Buffer.from(await (await fetch(API + '/branding/logo')).arrayBuffer());
  check('[disk] after a restart the uploaded logo is still served', logo.equals(LOGO), `${logo.length} bytes, expected ${LOGO.length}`);
  const dash2 = await (await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + again.token } })).json();
  check('[disk] with DATA_DIR set the dashboard shows no temporary-storage warning', dash2.temporaryStorage === false && !/WARNING: this portal keeps its data/.test(second.getLog()), JSON.stringify(dash2).slice(0, 160));
} finally {
  if (first) await stop(first.server);
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.rmSync(strayLogo, { force: true });
}

// ── Restore Database must really bring the backed-up data back ───────────────────────────────────────────────────────
// It used to answer "restored" while the running portal kept its old data in memory and saved it over the restored file at
// the next change, so a restore after a host wiped the database was silently lost.
let restoring;
try {
  fs.rmSync(DATA, { recursive: true, force: true });
  restoring = await startOnDisk();
  const login = await post('/auth/login', null, { email: 'punhamasiwa@gmail.com', password: '1234' });
  const t = (await post('/auth/change-password', login.token, { current_password: '1234', new_password: PASSWORD })).token;
  const auth = { Authorization: 'Bearer ' + t };
  const setMotto = (motto) => fetch(API + '/branding', { method: 'PUT', headers: { 'content-type': 'application/json', ...auth }, body: JSON.stringify({ school: { motto } }) });
  const motto = async () => (await (await fetch(API + '/branding')).json()).school.motto;
  const restoreFile = async (bytes, name = 'backup.db') => { const fd = new FormData(); fd.append('database', new Blob([bytes]), name); return fetch(API + '/admin/db/restore', { method: 'POST', headers: auth, body: fd }); };

  await setMotto('STATE-A');
  const backup = Buffer.from(await (await fetch(API + '/admin/db/export', { headers: auth })).arrayBuffer());
  await setMotto('STATE-B');

  const bad = await restoreFile(Buffer.from('this is not a database, just some text that someone chose by mistake'), 'notes.db');
  check('[restore] a file that is not a database is refused and nothing changes', bad.status === 400 && (await motto()) === 'STATE-B', `${bad.status} ${await motto()}`);

  const res = await restoreFile(backup);
  const body = await res.json();
  check('[restore] a real backup is accepted', res.status === 200 && /^school_portal-.*-before-restore-\d{6}\.db$/.test(body.kept || ''), JSON.stringify(body).slice(0, 200));
  check('[restore] the restored data shows at once, without a restart', (await motto()) === 'STATE-A', `got "${await motto()}"`);

  await setMotto('STATE-A');            // any ordinary save afterwards must not bring the old data back
  await fetch(API + '/branding', { method: 'PUT', headers: { 'content-type': 'application/json', ...auth }, body: JSON.stringify({ school: { district: 'Another change' } }) });
  check('[restore] it stays restored after more changes are saved', (await motto()) === 'STATE-A');

  const list = await (await fetch(API + '/admin/backups', { headers: auth })).json();
  check('[restore] what the portal held before the restore is kept in the backup list', list.copies.some((c) => c.name === body.kept), JSON.stringify(list.copies.map((c) => c.name)));
  const kept = Buffer.from(await (await fetch(API + '/admin/backups/' + body.kept, { headers: auth })).arrayBuffer());
  check('[restore] and that copy can be downloaded and restored again (an undo)', kept.length > 1000 && (await restoreFile(kept, body.kept)).status === 200 && (await motto()) === 'STATE-B', `motto now "${await motto()}"`);
  check('[restore] no stray upload files are left beside the database', !fs.readdirSync(DATA).some((n) => /^restored_/.test(n)), fs.readdirSync(DATA).join(', '));

  await stop(restoring.server);
  restoring = await startOnDisk();
  check('[restore] after the host restarts the restored data is still there', (await motto()) === 'STATE-B', `got "${await motto()}"`);
} finally {
  if (restoring) await stop(restoring.server);
  fs.rmSync(DATA, { recursive: true, force: true });
}

// And the warning itself: on a host with no DATA_DIR the portal must say its storage is temporary.
// (Checked on the setting alone, so no database is made in the project folder.)
function temporary(env) {
  const e = { ...process.env, ...env };
  for (const k of ['RENDER', 'NODE_ENV', 'DATA_DIR', 'DB_PATH']) if (!(k in env)) delete e[k];
  const r = spawnSync(process.execPath, [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), '-e', "console.log('TEMPORARY=' + require('./src/config/paths').storageIsTemporary())"], { cwd: BACKEND, env: e, encoding: 'utf8' });
  return /TEMPORARY=(true|false)/.exec(r.stdout || '')?.[1] ?? 'error: ' + (r.stderr || r.stdout).slice(-200);
}
check('on a host with no DATA_DIR the storage is reported as temporary', temporary({ RENDER: 'true' }) === 'true', temporary({ RENDER: 'true' }));
check('on a host with DATA_DIR set it is not reported as temporary (on Windows the disk cannot be told apart; real hosts run Linux)', temporary({ RENDER: 'true', DATA_DIR: DATA }) === 'false');
check('on your own computer it is never reported as temporary', temporary({}) === 'false');
fs.rmSync(DATA, { recursive: true, force: true });

console.log(`\n${ok}/${ok + failed} production-rehearsal checks passed`);
process.exit(failed ? 1 : 0);
