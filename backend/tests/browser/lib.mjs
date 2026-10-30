// Shared by the browser tests in this folder. They drive the real portal in Google Chrome, on THIS computer only.
//
//   cd backend
//   npm run seed:sample        # once: fills the local portal with the sample school (see the README)
//   npm run test:browser       # all browser tests;  or  test:pages / test:journeys / test:classwork
//
// The portal must be running (backend on :5000, frontend on :3000) and the backend started with AUTH_RATE_LIMIT=2000.
// Pictures, printed PDFs and a JSON report are written to tests/browser/output/ (not part of the project).
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SITE = process.env.SITE || 'http://localhost:3000';
export const API = process.env.API || 'http://localhost:5000/api';
export const OUT = path.join(HERE, 'output');
fs.mkdirSync(OUT, { recursive: true });

const isLocal = (u) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(u);
if (!isLocal(SITE) || !isLocal(API)) { console.error('Refusing to run: these tests change data, so they only run against localhost.'); process.exit(2); }

// The sample school's accounts (created by `npm run seed:sample`)
export const ADMIN = ['punhamasiwa@gmail.com', '1234'];
export const BURSAR = ['tascarmasiwa@gmail.com', '12345678'];
export const TEACHER = ['rumbidzai.moyo0@chakari.school', 'Teacher@123'];       // ECD A
export const TEACHER_G7 = ['josephine.zhou0@chakari.school', 'Teacher@123'];    // Grade 7
export const OTHER_TEACHER = ['tapiwa.ncube0@chakari.school', 'Teacher@123'];   // ECD B
export const STUDENT = ['nyasha.chuma4@chakari.school', 'Student@123'];         // ECD A
export const PARENT = ['parent.moyo@chakari.school', 'Parent@123'];             // parent of Tendai Moyo (ECD A) and Netsai Moyo (Grade 2)

// ── results ────────────────────────────────────────────────────────────────
export const state = { section: '' };
const results = [];
export const check = (name, ok, detail = '') => {
  results.push({ section: state.section, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${state.section}] ${name}${ok || !detail ? '' : '  -> ' + detail}`);
};
const only = process.argv.slice(2);
export async function run(name, fn) {
  if (only.length && !only.includes(name)) return;
  state.section = name;
  try { await fn(); } catch (e) { check('journey completed without crashing', false, String(e.message).split('\n')[0]); }
}

// ── the browser ────────────────────────────────────────────────────────────
export const browser = await chromium.launch({ channel: 'chrome', headless: true });

// Log in through the real log in form. `problems` collects script errors and failed calls the page made.
export async function open(email, password, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('js: ' + String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) problems.push('console: ' + m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400 && !/auth\/login/.test(r.url())) problems.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '').replace(SITE, '')}`); });
  await page.goto(SITE + '/login');
  await page.fill('#email', email); await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page, problems, shot: (n) => page.screenshot({ path: path.join(OUT, n + '.png') }) };
}

export async function apiLogin(email, password) {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).token;
}
export const authed = (token) => ({ Authorization: 'Bearer ' + token, 'content-type': 'application/json' });

// Prints the summary, saves the report, closes Chrome and sets the exit code
export async function finish(reportName) {
  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} browser checks passed`);
  if (bad.length) { console.log('\nFAILURES:'); for (const r of bad) console.log(` - [${r.section}] ${r.name}\n     ${r.detail}`); }
  fs.writeFileSync(path.join(OUT, `${reportName}-report.json`), JSON.stringify(results, null, 2));
  process.exit(bad.length ? 1 : 0);
}
