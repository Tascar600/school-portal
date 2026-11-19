/**
 * One-step demo: starts the portal on this computer with a complete sample school, with no internet needed.
 *
 *   cd backend
 *   npm run demo               start (the first time it also loads the sample school: about two minutes)
 *   npm run demo -- --reset    throw the demo school away and load a fresh one
 *   npm run demo -- --no-open  do not open the browser
 *
 * The demo school lives in its own folder, demo-data/ beside backend/, so your real database is never touched
 * (npm start still uses backend/school_portal.db). Set DEMO_PORT to use another port than 5050.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(backend, '..');
const DEMO_DIR = path.join(root, 'demo-data');
const PORT = String(process.env.DEMO_PORT || '5050');
const SITE = `http://localhost:${PORT}`;
const READY = path.join(DEMO_DIR, '.demo-ready');
const tsx = path.join(backend, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const args = new Set(process.argv.slice(2));

const say = (m = '') => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function healthy() {
  try { return (await fetch(`${SITE}/api/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}
function openBrowser() {
  if (args.has('--no-open')) return;
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', SITE], { detached: true, stdio: 'ignore' }).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [SITE], { detached: true, stdio: 'ignore' }).unref();
  } catch { /* the address is printed anyway */ }
}

if (!fs.existsSync(tsx)) { say('The portal has not been installed yet. Run "npm install" in the backend folder first.'); process.exit(1); }

if (await healthy()) {
  say(`The demo is already running at ${SITE}`);
  openBrowser();
  process.exit(0);
}

if (args.has('--reset') && fs.existsSync(DEMO_DIR)) {
  say('Throwing away the old demo school ...');
  fs.rmSync(DEMO_DIR, { recursive: true, force: true }); // only ever this one folder
}
fs.mkdirSync(DEMO_DIR, { recursive: true });

const env = {
  ...process.env,
  PORT, DATA_DIR: DEMO_DIR,
  AUTH_RATE_LIMIT: '2000',                  // so the loader and a busy demo do not hit the log in limit
  FIRST_LOGIN_PASSWORD_CHANGE: 'off',       // so the sample log ins work straight away; never set this on a real school
};
const logFile = fs.openSync(path.join(DEMO_DIR, 'server.log'), 'a');
const server = spawn(process.execPath, [tsx, 'src/index.ts'], { cwd: backend, env, stdio: ['ignore', logFile, logFile] });
let stopping = false;
const stop = () => { stopping = true; try { server.kill(); } catch { /* already gone */ } };
process.on('SIGINT', () => { say('\nStopping the demo ...'); stop(); setTimeout(() => process.exit(0), 300); });
process.on('SIGTERM', stop);
process.on('exit', stop);
server.on('exit', (code) => {
  if (!stopping) { say(`\nThe portal stopped unexpectedly (code ${code}). See ${path.join(DEMO_DIR, 'server.log')}`); process.exit(1); }
});

say('Starting the portal ...');
for (let i = 0; i < 90 && !(await healthy()); i++) await sleep(1000);
if (!(await healthy())) { say(`The portal did not start. See ${path.join(DEMO_DIR, 'server.log')}`); stop(); process.exit(1); }

if (!fs.existsSync(READY)) {
  say('Loading the sample school (9 teachers, 90 pupils, parents, fees, homework, quizzes, results) ...');
  say('This happens only once and takes about two minutes. Please wait.');
  let ok = true;
  for (const script of ['seed-sample-data.ts', 'seed-demo-data.ts']) {
    const log = path.join(DEMO_DIR, script.replace('.ts', '.log'));
    const r = spawnSync(process.execPath, [tsx, path.join('scripts', script)], { cwd: backend, env: { ...env, BASE_URL: `${SITE}/api` }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(log, (r.stdout || '') + (r.stderr || ''));
    const summary = ((r.stdout || '').match(/\d+\/\d+ checks passed[^\n]*/) || [''])[0];
    say(`  ${script}: ${summary || 'no summary'}${r.status === 0 ? '' : `  (exit ${r.status}; details in ${log})`}`);
    if (r.status !== 0 && r.status !== 1) ok = false; // 1 only means a check failed, the data is still there; anything else is a crash
  }
  if (ok) fs.writeFileSync(READY, new Date().toISOString());
  else say('The sample school did not load completely. Run this again to finish it.');
}

say();
say(`The demo school is ready:  ${SITE}`);
say('  Administrator   punhamasiwa@gmail.com            1234');
say('  Bursar          tascarmasiwa@gmail.com           12345678');
say('  Teacher (Gr 7)  josephine.zhou0@chakari.school   Teacher@123');
say('  Pupil (ECD A)   tendai.moyo1@chakari.school      Student@123');
say('  Parent          parent.moyo@chakari.school       Parent@123');
say('More log ins: README, "Sample Data". Press Ctrl+C in this window to stop the demo.');
openBrowser();
await new Promise(() => {}); // keep running until Ctrl+C
