// What a brand-new portal does the first time the Administrator and the Bursar log in.
// Starts a second copy of the portal on port 5055 with an EMPTY throw-away database (your real one is never touched),
// checks it, and shuts it down again.        npm run test:first-login
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const PORT = 5055, API = `http://localhost:${PORT}/api`;
const DB = path.join(HERE, 'browser', 'output', 'first-login-test.db');
fs.mkdirSync(path.dirname(DB), { recursive: true });
fs.rmSync(DB, { force: true });

let ok = 0, failed = 0;
const check = (name, pass, detail = '') => { pass ? ok++ : failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : '  -> ' + detail}`); };
const call = async (method, p, token, body) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// FIRST_LOGIN_PASSWORD_CHANGE is deliberately NOT set to "off": this is the behaviour of a real new portal
const env = { ...process.env, PORT: String(PORT), DB_PATH: DB };
delete env.FIRST_LOGIN_PASSWORD_CHANGE;
const server = spawn(process.execPath, [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], { cwd: BACKEND, env, stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* already gone */ } };
process.on('exit', stop);

try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(API + '/branding')).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
  check('a throw-away portal started on port 5055', (await fetch(API + '/branding').catch(() => ({ ok: false }))).ok === true);

  for (const [who, email, pw, area] of [['Administrator', 'punhamasiwa@gmail.com', '1234', '/admin/users'], ['Bursar', 'tascarmasiwa@gmail.com', '12345678', '/finance-students']]) {
    const login = await call('POST', '/auth/login', null, { email, password: pw });
    check(`${who}: the first log in with the starting password works`, login.status === 200 && !!login.data.token);
    check(`${who}: and is told to choose a new password`, login.data.user?.must_change_password === 1, JSON.stringify(login.data.user?.must_change_password));
    const t = login.data.token;
    check(`${who}: until then, the portal refuses everything else`, (await call('GET', area, t)).status === 403);
    check(`${who}: but the "who am I" check still works (so the page can ask for a new password)`, (await call('GET', '/auth/me', t)).status === 200);
    check(`${who}: a new password that is too short is refused`, (await call('POST', '/auth/change-password', t, { current_password: pw, new_password: 'abc1' })).status === 400);
    const changed = await call('POST', '/auth/change-password', t, { current_password: pw, new_password: 'Chakari2026!' });
    check(`${who}: choosing a proper password works`, changed.status === 200 && !!changed.data.token, JSON.stringify(changed.data));
    check(`${who}: after that everything is open`, (await call('GET', area, changed.data.token)).status === 200);
    check(`${who}: the starting password no longer works`, (await call('POST', '/auth/login', null, { email, password: pw })).status === 401);
    const again = await call('POST', '/auth/login', null, { email, password: 'Chakari2026!' });
    check(`${who}: the new password logs in, with no further demand`, again.status === 200 && !again.data.user?.must_change_password);
  }
} finally {
  stop();
  await new Promise((r) => setTimeout(r, 500));
  fs.rmSync(DB, { force: true });
}
console.log(`\n${ok}/${ok + failed} first-login checks passed`);
process.exit(failed ? 1 : 0);
