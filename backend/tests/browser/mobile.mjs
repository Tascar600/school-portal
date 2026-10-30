// Opens every page of every account at the width of a phone (390 px) and checks that nothing pushes the page wider than
// the screen: a page that has to be dragged sideways is the commonest way a portal fails on a phone. A wide table is
// fine as long as it scrolls inside its own box. Also saves a picture of each page in tests/browser/output/mobile/.
import fs from 'fs';
import path from 'path';
import { SITE, OUT, check, run, browser, API, finish, ADMIN, BURSAR, TEACHER, TEACHER_G7, STUDENT, PARENT } from './lib.mjs';

const shots = path.join(OUT, 'mobile');
fs.mkdirSync(shots, { recursive: true });

const FINANCE = ['/finance', '/finance/payments', '/finance/students', '/finance/invoices', '/finance/expenses', '/finance/accounts', '/finance/reports', '/finance/setup'];
const TEACHER_PAGES = ['/dashboard', '/register', '/results', '/report-cards', '/homework', '/quizzes', '/timetable', '/courses', '/notices', '/sports', '/admin/student-stats', '/themes'];
const ROLES = {
  admin: { login: ADMIN, pages: ['/dashboard', ...FINANCE, '/finance/audit', '/results', '/report-cards', '/timetable', '/notices', '/quizzes', '/sports', '/admin/analytics', '/admin/compare', '/exams', '/admin/student-stats', '/admin', '/themes'] },
  bursar: { login: BURSAR, pages: FINANCE },
  teacher: { login: TEACHER, pages: TEACHER_PAGES },
  'teacher (Grade 7)': { login: TEACHER_G7, pages: ['/exams'] },
  parent: { login: PARENT, pages: ['/dashboard', '/fees', '/results', '/report-cards', '/register', '/timetable', '/notices', '/themes'] },
  pupil: { login: STUDENT, pages: ['/dashboard', '/results', '/report-cards', '/fees', '/timetable', '/homework', '/quizzes', '/courses', '/register', '/notices', '/sports', '/themes'] },
};

// Elements that stick out past the right edge of the screen and are not inside a box that scrolls sideways
const findOverflow = () => {
  const vw = window.innerWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue;
    let a = el.parentElement, scrolls = false;
    while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') { scrolls = true; break; } a = a.parentElement; }
    if (!scrolls && getComputedStyle(el).position !== 'fixed') out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} (${Math.round(r.right)}px)`);
  }
  return { vw, scrollWidth: document.documentElement.scrollWidth, offenders: out.slice(0, 4) };
};

for (const [role, cfg] of Object.entries(ROLES)) {
  await run(role, async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(SITE + '/login');
    await page.fill('#email', cfg.login[0]); await page.fill('#password', cfg.login[1]); await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
    let wide = 0;
    for (const p of cfg.pages) {
      await page.goto(SITE + p, { waitUntil: 'load' }); await page.waitForTimeout(1100);
      const r = await page.evaluate(findOverflow);
      await page.screenshot({ path: path.join(shots, `${role.replace(/\W+/g, '-')}${p.replace(/\//g, '-')}.png`) });
      if (r.scrollWidth > r.vw + 1 || r.offenders.length) { wide++; check(`${p} fits the width of a phone`, false, `page is ${r.scrollWidth}px wide on a ${r.vw}px screen; sticking out: ${r.offenders.join(' | ')}`); }
    }
    if (!wide) check(`all ${cfg.pages.length} pages fit the width of a phone`, true);
    await ctx.close();
  });
}
void API;
await finish('mobile');
