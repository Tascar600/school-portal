/**
 * Takes the pictures used in the PDF user manuals (backend/assets/manual/*.jpg).
 *
 * Needs the portal running with the sample school loaded (npm run seed:sample) and Google Chrome installed.
 *   cd backend
 *   npm run capture-manual                      # all pictures
 *   npm run capture-manual -- bursary           # only one account type
 *   SITE=http://localhost:3000 npm run capture-manual
 *
 * For every control a manual explains, a gold numbered marker is drawn over the control, so the numbers in the
 * picture match the numbers in the table beside it. Controls that cannot be found are listed at the end.
 */
import fs from 'fs';
import path from 'path';
import { chromium, Page } from 'playwright-core';
import { MANUALS } from '../src/manual/content';
import { commonPages } from '../src/manual/content/common';
import { Callout, ManualPage, Step } from '../src/manual/types';

const SITE = process.env.SITE || 'http://localhost:3000';
const OUT = path.join(__dirname, '../assets/manual');
const WIDTH = 1100;
const MAX_HEIGHT = 1250; // taller pictures are shrunk to fit the PDF page, so controls must sit inside this
const only = process.argv[2];

const missing: string[] = [];

async function runSteps(page: Page, steps: Step[] = []) {
  for (const s of steps) {
    if (s.click) await page.locator(s.click).first().click({ timeout: 5000 });
    if (s.fill) await page.locator(s.fill[0]).first().fill(s.fill[1]);
    if (s.select) {
      const [sel, v] = s.select;
      const loc = page.locator(sel).first();
      if (v.startsWith('index=')) await loc.selectOption({ index: Number(v.slice(6)) }); else await loc.selectOption(v);
    }
    await page.waitForTimeout(s.wait ?? 350);
  }
}

// Draw a gold box and a numbered dot over each control, then report where they are.
async function mark(page: Page, name: string, callouts: Callout[], top: number): Promise<number> {
  const found: { n: number; x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < callouts.length; i++) {
    const c = callouts[i];
    if (!c.target) continue;
    const loc = page.locator(c.target).first();
    try {
      await loc.waitFor({ state: 'visible', timeout: 2500 });
      const box = await loc.boundingBox();
      const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
      if (!box) throw new Error('no box');
      const y = box.y + scroll.y, limit = top + MAX_HEIGHT - 8;
      if (y > limit - 40) { missing.push(`${name}: [${i + 1}] ${c.press}  <-  ${c.target}  (below the bottom of the picture)`); continue; }
      found.push({ n: i + 1, x: box.x + scroll.x, y, w: box.width, h: Math.min(box.height, limit - y) });
    } catch { missing.push(`${name}: [${i + 1}] ${c.press}  <-  ${c.target}`); }
  }
  await page.evaluate((items) => {
    for (const it of items) {
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;left:${it.x - 3}px;top:${it.y - 3}px;width:${it.w + 6}px;height:${it.h + 6}px;border:2.5px solid #d4a017;border-radius:5px;background:rgba(212,160,23,0.10);pointer-events:none;z-index:99998;`;
      const dot = document.createElement('div');
      dot.textContent = String(it.n);
      dot.style.cssText = `position:absolute;left:${it.x - 16}px;top:${it.y - 16}px;width:24px;height:24px;border-radius:50%;background:#b8860b;color:#fff;font:700 13px/24px Arial,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:none;z-index:99999;`;
      document.body.appendChild(box); document.body.appendChild(dot);
    }
  }, found);
  return found.length ? Math.max(...found.map((f) => f.y + f.h)) : 0;
}

async function shoot(page: Page, name: string, lowest: number, top: number) {
  const height = Math.min(MAX_HEIGHT, Math.max(top ? 420 : 690, Math.ceil(lowest - top + 60)));
  const buf = await page.screenshot({ type: 'jpeg', quality: 74, fullPage: true, clip: { x: 0, y: top, width: WIDTH, height } });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.jpg`), buf);
  console.log(`  saved ${name}.jpg  (${WIDTH}x${height})`);
}

async function login(page: Page, email: string, password: string, landing: string) {
  await page.goto(`${SITE}/login`);
  await page.fill('#email', email); await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForTimeout(600);
  void landing;
}

async function capture(page: Page, name: string, p: ManualPage, landing: string) {
  const route = p.route === '__landing__' ? landing : p.route;
  await page.goto(`${SITE}${route}`);
  await page.waitForTimeout(1300);
  await runSteps(page, p.steps);
  await page.waitForTimeout(500);
  let top = 0;
  if (p.cropFrom) {
    const box = await page.locator(p.cropFrom).first().boundingBox();
    const scroll = await page.evaluate(() => window.scrollY);
    if (box) top = Math.max(0, Math.floor(box.y + scroll - 24));
  }
  const lowest = await mark(page, name, p.callouts, top);
  await shoot(page, name, lowest, top);
}

// A pending password request, so the Administrator's Passwords tab has a row to point at (cleared again afterwards)
const API = process.env.API || 'http://localhost:5000/api';
async function withPasswordRequest<T>(adminEmail: string, adminPassword: string, run: () => Promise<T>): Promise<T> {
  await fetch(API + '/auth/forgot-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: 'tendai.moyo1@chakari.school' }) });
  try { return await run(); } finally {
    const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: adminPassword }) })).json();
    const h = { Authorization: 'Bearer ' + login.token };
    const open = await (await fetch(API + '/admin/password-requests', { headers: h })).json();
    for (const r of open) await fetch(API + `/admin/password-requests/${r.id}/dismiss`, { method: 'POST', headers: h });
  }
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 690 }, deviceScaleFactor: 1.5 });
    await ctx.addInitScript(() => localStorage.setItem('theme', 'system'));
    return { ctx, page: await ctx.newPage() };
  };

  // Pages anyone can open (no log in)
  if (!only) {
    const { ctx, page } = await newPage();
    for (const p of commonPages('student')) if (['login', 'activate', 'forgot'].includes(p.id)) { console.log(`common-${p.id}`); await capture(page, `common-${p.id}`, p, '/'); }
    await ctx.close();
    // The change-password page looks the same for everyone, so one picture is shared
    const b = newPage(); const { ctx: c2, page: p2 } = await b;
    await login(p2, MANUALS.bursary.sampleLogin.email, MANUALS.bursary.sampleLogin.password, '/finance');
    const pw = commonPages('bursary').find((x) => x.id === 'password')!;
    console.log('common-password'); await capture(p2, 'common-password', pw, '/finance');
    await c2.close();
  }

  for (const manual of Object.values(MANUALS)) {
    if (only && manual.role !== only) continue;
    console.log(`\n${manual.roleLabel}`);
    const { ctx, page } = await newPage();
    await login(page, manual.sampleLogin.email, manual.sampleLogin.password, manual.sampleLogin.landing);
    const landing = manual.sampleLogin.landing;
    const layout = commonPages(manual.role).find((x) => x.id === 'layout')!;
    await capture(page, `${manual.role}-layout`, layout, landing);
    const takeAll = async () => {
      for (const p of manual.pages) {
        if (p.noImage) continue;
        const name = p.image || `${manual.role}-${p.id}`;
        console.log(name);
        try { await capture(page, name, p, landing); } catch (e: any) { missing.push(`${name}: page failed: ${String(e.message).split('\n')[0]}`); }
      }
    };
    if (manual.role === 'admin') await withPasswordRequest(manual.sampleLogin.email, manual.sampleLogin.password, takeAll); else await takeAll();
    await ctx.close();
  }

  await browser.close();
  if (missing.length) { console.log(`\n${missing.length} control(s) could not be found, so they have no marker:`); missing.forEach((m) => console.log('  - ' + m)); process.exitCode = 1; }
  else console.log('\nEvery marker was placed.');
}
main();
