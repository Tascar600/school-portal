// Logs in as each kind of account, opens every page in its menu (and the pages reached from inside the pages),
// and looks for: a missing or surprise menu item, a script error, a failed call to the server, a blank page,
// and an error message on screen.
import { SITE, check, state, run, open, finish, browser, ADMIN, BURSAR, TEACHER, TEACHER_G7, STUDENT, PARENT } from './lib.mjs';

const CREDIT = 'For all your system development contact 0710325831';

const FINANCE = ['/finance', '/finance/payments', '/finance/students', '/finance/invoices', '/finance/expenses', '/finance/accounts', '/finance/reports', '/finance/setup'];
const TEACHER_MENU = ['/dashboard', '/register', '/results', '/report-cards', '/homework', '/quizzes', '/timetable', '/courses', '/notices', '/sports', '/admin/student-stats', '/themes'];

const ROLES = {
  admin: { login: ADMIN, menu: ['/dashboard', '/finance', '/results', '/report-cards', '/timetable', '/notices', '/quizzes', '/sports', '/admin/analytics', '/admin/compare', '/exams', '/admin/student-stats', '/admin', '/themes'], inside: [...FINANCE.slice(1), '/finance/audit'] },
  bursar: { login: BURSAR, menu: FINANCE, inside: ['/change-password'] },
  teacher: { login: TEACHER, menu: TEACHER_MENU, inside: [] },
  'teacher (Grade 7)': { login: TEACHER_G7, menu: [...TEACHER_MENU.slice(0, -1), '/exams', TEACHER_MENU[TEACHER_MENU.length - 1]], inside: [] },
  parent: { login: PARENT, menu: ['/dashboard', '/fees', '/results', '/report-cards', '/register', '/timetable', '/notices', '/themes'], inside: [] },
  pupil: { login: STUDENT, menu: ['/dashboard', '/results', '/report-cards', '/fees', '/timetable', '/homework', '/quizzes', '/courses', '/register', '/notices', '/sports', '/themes'], inside: [] },
};

for (const [role, cfg] of Object.entries(ROLES)) {
  await run(role, async () => {
    const { ctx, page, problems } = await open(...cfg.login);
    const links = await page.$$eval('.nav-links a', (as) => as.map((a) => new URL(a.href).pathname));
    const missing = cfg.menu.filter((p) => !links.includes(p)), extra = links.filter((p) => !cfg.menu.includes(p));
    check('the menu has exactly the expected pages', !missing.length && !extra.length, `missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);
    let bad = 0;
    for (const p of [...cfg.menu, ...cfg.inside]) {
      const before = problems.length;
      await page.goto(SITE + p, { waitUntil: 'load' });
      await page.waitForTimeout(1100);
      const text = (await page.evaluate(() => (document.querySelector('main')?.innerText || '').trim()));
      const footers = await page.$$eval('.dev-footer', (els) => els.map((e) => e.textContent));
      const here = new URL(page.url()).pathname;
      const faults = [
        ...(footers.length !== 1 || footers[0] !== CREDIT ? [`developer contact footer: ${JSON.stringify(footers)}`] : []),
        ...(here !== p && !(p === '/dashboard' && here === '/finance') ? [`redirected to ${here}`] : []),
        ...(text.length < 15 ? ['blank page'] : []),
        ...(/something went wrong|cannot read|undefined is not|unexpected application error/i.test(text) ? ['error text on screen'] : []),
        ...problems.slice(before),
      ];
      if (faults.length) { bad++; check(`${p} opens cleanly`, false, faults.join('; ')); }
    }
    if (!bad) check(`all ${cfg.menu.length + cfg.inside.length} pages open with no script errors, failed calls, blanks or redirects`, true);
    await ctx.close();
  });
}
// The developer's contact line: at the foot of the pages you see before logging in, and on paper from the print layout
// (every page you see after logging in is checked in the loop above).
await run('footer', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const p of ['/login', '/activate', '/forgot-password']) {
    await page.goto(SITE + p); await page.waitForTimeout(700);
    const footers = await page.$$eval('.dev-footer', (els) => els.map((e) => ({ text: e.textContent, px: parseFloat(getComputedStyle(e).fontSize) })));
    check(`${p} ends with the contact line, in a small font`, footers.length === 1 && footers[0].text === CREDIT && footers[0].px <= 12, JSON.stringify(footers));
  }
  await ctx.close();

  const { ctx: c2, page: p2 } = await open(...ADMIN);
  await p2.goto(SITE + '/dashboard'); await p2.waitForTimeout(900);
  await p2.emulateMedia({ media: 'print' });
  const printed = await p2.evaluate(() => {
    const credit = document.querySelector('.print-footer .print-credit');
    const screen = document.querySelector('.dev-footer');
    return { credit: credit && getComputedStyle(credit).display !== 'none' ? credit.textContent : null, screenFooter: screen ? getComputedStyle(screen).display : 'missing' };
  });
  check('on paper the print footer carries the contact line (and the screen footer steps aside)', printed.credit === CREDIT && printed.screenFooter === 'none', JSON.stringify(printed));
  await c2.close();
});

void state;
await finish('pages');
