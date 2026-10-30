// A rehearsal of a real deployment, on this computer only. Needs the frontend built (npm run test:production does that).
// Starts the portal the way a host would (built pages served by the backend, brand-new empty database, RENDER=true) on
// port 5057 and checks what a visitor gets, and that the security warning appears when JWT_SECRET is missing.
//   npm run test:production
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    return { log, dash };
  } finally {
    try { server.kill(); } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 600));
    fs.rmSync(DB, { force: true });
  }
}

const insecure = await rehearse('no JWT_SECRET', {});
check('without JWT_SECRET the server says so loudly in its log', /SECURITY WARNING: JWT_SECRET is not set/.test(insecure.log), insecure.log.slice(-300));
check('and the Administrator\'s dashboard is told to fix it', insecure.dash.insecureSecret === true, JSON.stringify(insecure.dash).slice(0, 160));
const secure = await rehearse('with JWT_SECRET', { JWT_SECRET: 'rehearsal-secret-' + 'x'.repeat(40) });
check('with JWT_SECRET set there is no warning', !/SECURITY WARNING/.test(secure.log) && secure.dash.insecureSecret === false, secure.log.slice(-200));

console.log(`\n${ok}/${ok + failed} production-rehearsal checks passed`);
process.exit(failed ? 1 : 0);
