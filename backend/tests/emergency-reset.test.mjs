// Tests the emergency way back in (src/utils/emergencyReset.ts): RESET_STARTING_ACCOUNTS puts the Administrator and the Bursar
// back to the starting passwords, once for each different word, and keeps all the school's data.
//
//   cd backend
//   npm run test:reset        (node --test tests/emergency-reset.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSX = path.join(BACKEND, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const ADMIN = 'punhamasiwa@gmail.com', BURSAR = 'tascarmasiwa@gmail.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });

/** Starts the real portal on the given data folder, the way a host does (first-log-in rules ON), with the extra settings given. */
async function startPortal(dataDir, extraEnv = {}) {
  const port = await freePort();
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^BACKUP[_-]|^RESET_STARTING|^DB_PATH$|^RENDER$|^FIRST_LOGIN/i.test(k)) delete env[k];
  const child = spawn(process.execPath, [TSX, 'src/index.ts'], {
    cwd: BACKEND, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...env, PORT: String(port), DATA_DIR: dataDir, JWT_SECRET: 'emergency-reset-test-secret', AUTH_RATE_LIMIT: '2000', ...extraEnv },
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  for (let waited = 0; waited < 60000; waited += 250) {
    if (child.exitCode !== null) throw new Error(`the portal exited:\n${output}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* starting */ }
    await sleep(250);
  }
  const call = async (method, route, token, body) => {
    const r = await fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data = text; try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, data };
  };
  const login = (email, password) => call('POST', '/api/auth/login', null, { email, password });
  return { call, login, output: () => output, stop: async () => { child.kill(); await exited; } };
}

test('RESET_STARTING_ACCOUNTS: puts both accounts back to the starting passwords, keeps the data, and works once for each word', { timeout: 240000 }, async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'emergency-reset-'));
  let p;
  try {
    // ── 1. a school in use: both accounts have chosen their own passwords, and there is some data ──
    p = await startPortal(data);
    const a1 = await p.login(ADMIN, '1234');
    assert.equal(a1.status, 200);
    assert.equal((await p.call('POST', '/api/auth/change-password', a1.data.token, { current_password: '1234', new_password: 'Admin-Own-Pass-1' })).status, 200);
    const b1 = await p.login(BURSAR, '12345678');
    assert.equal((await p.call('POST', '/api/auth/change-password', b1.data.token, { current_password: '12345678', new_password: 'Bursar-Own-Pass-1' })).status, 200);
    const admin1 = await p.login(ADMIN, 'Admin-Own-Pass-1');
    assert.equal((await p.call('POST', '/api/notices', admin1.data.token, { title: 'This notice must survive the reset', content: 'Written before the lock-out.', target_role: 'all' })).status, 201);
    const oldSession = admin1.data.token;
    await p.stop();

    // ── 2. started again with nothing asked: nothing is reset ──
    p = await startPortal(data);
    assert.equal((await p.login(ADMIN, '1234')).status, 401, 'no reset unless it is asked for');
    assert.equal((await p.login(ADMIN, 'Admin-Own-Pass-1')).status, 200);
    assert.doesNotMatch(p.output(), /RESET_STARTING_ACCOUNTS was used/);
    await sleep(1100); // so the reset below is certainly later than every log in made so far
    await p.stop();

    // ── 3. started with the switch: both accounts are back to the starting passwords ──
    p = await startPortal(data, { RESET_STARTING_ACCOUNTS: 'reset1' });
    assert.match(p.output(), /RESET_STARTING_ACCOUNTS was used: Administrator \(punhamasiwa@gmail\.com\) and Bursar \(tascarmasiwa@gmail\.com\)/);
    assert.doesNotMatch(p.output(), /\b1234\b|\b12345678\b/, 'the log never prints a password (whole words, so a port number like 51234 cannot trip it)');
    const a3 = await p.login(ADMIN, '1234');
    assert.equal(a3.status, 200, 'the Administrator can log in with the starting password');
    assert.equal(a3.data.user.must_change_password, 1, 'and must choose their own at once');
    assert.equal((await p.call('GET', '/api/dashboard', a3.data.token)).status, 403, 'nothing else is open until they do');
    const b3 = await p.login(BURSAR, '12345678');
    assert.equal(b3.status, 200);
    assert.equal(b3.data.user.must_change_password, 1);
    assert.equal((await p.login(ADMIN, 'Admin-Own-Pass-1')).status, 401, 'the password they had before no longer works');
    assert.equal((await p.login(BURSAR, 'Bursar-Own-Pass-1')).status, 401);
    assert.equal((await p.call('GET', '/api/auth/me', oldSession)).status, 401, 'and a log in made before the reset is shut out');

    // the data is all still there
    assert.equal((await p.call('POST', '/api/auth/change-password', a3.data.token, { current_password: '1234', new_password: 'Admin-Own-Pass-2' })).status, 200);
    const admin3 = await p.login(ADMIN, 'Admin-Own-Pass-2');
    const notices = (await p.call('GET', '/api/notices', admin3.data.token)).data;
    assert.ok(notices.some((n) => n.title === 'This notice must survive the reset'), 'the school’s data is kept');
    await p.stop();

    // ── 4. the same word again: it is not applied a second time, even though the setting is still there ──
    p = await startPortal(data, { RESET_STARTING_ACCOUNTS: 'reset1' });
    assert.doesNotMatch(p.output(), /RESET_STARTING_ACCOUNTS was used/);
    assert.equal((await p.login(ADMIN, '1234')).status, 401, 'leaving the setting in place does not keep resetting passwords');
    const admin4 = await p.login(ADMIN, 'Admin-Own-Pass-2');
    assert.equal(admin4.status, 200);
    // the Administrator account gets closed by mistake: another way to be locked out
    const closed = await p.call('POST', '/api/admin/sql', admin4.data.token, { sql: "UPDATE users SET archived = 1, is_active = 0 WHERE role = 'admin'" });
    assert.equal(closed.status, 200, JSON.stringify(closed.data));
    assert.notEqual((await p.login(ADMIN, 'Admin-Own-Pass-2')).status, 200, 'a closed account cannot log in');
    await sleep(1100);
    await p.stop();

    // ── 5. a new word: it works again, and opens a closed account ──
    p = await startPortal(data, { RESET_STARTING_ACCOUNTS: 'reset2' });
    assert.match(p.output(), /RESET_STARTING_ACCOUNTS was used/);
    const a5 = await p.login(ADMIN, '1234');
    assert.equal(a5.status, 200, 'a new word resets again, and the closed account is open again');
    assert.equal(a5.data.user.must_change_password, 1);
    await p.stop();
  } finally {
    await p?.stop();
    fs.rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
