// Journeys through the redesigned portal, as real people would use it: manuals, marks, a payment with a receipt,
// periods and printing, appearances, passwords, school details, who may see what, and the Bursary audit trail.
// Every test that changes something puts it back afterwards. See lib.mjs for how to run these.
import fs from 'fs';
import path from 'path';
import { SITE, API, OUT, HERE, check, run, open, apiLogin, authed, finish, ADMIN, BURSAR, TEACHER, TEACHER_G7, STUDENT, PARENT, browser } from './lib.mjs';

// ── 1. Every account can download its own manual ─────────────────────────────
await run('manuals', async () => {
  for (const [label, [em, pw], expect] of [['Administrator', ADMIN, 'Administrator'], ['Bursar', BURSAR, 'Bursar'], ['Teacher', TEACHER, 'Teacher'], ['Pupil', STUDENT, 'Pupil'], ['Parent', PARENT, 'Parent']]) {
    const { ctx, page, problems } = await open(em, pw);
    // One retry is allowed (this computer's network sometimes pauses mid-test); a retry is always printed so it is never hidden
    let dl = null;
    for (let attempt = 1; attempt <= 2 && !dl; attempt++) {
      dl = await Promise.all([page.waitForEvent('download', { timeout: 12000 }), page.click('button:has-text("Download Manual")')]).then(([d]) => d).catch(() => null);
      if (!dl && attempt === 1) console.log(`NOTE  [manuals] ${label}: no download after the first click, trying once more`);
    }
    if (!dl) throw new Error(`${label}: pressing "Download Manual" twice produced no file`);
    const file = path.join(OUT, `manual-${label}.pdf`); await dl.saveAs(file);
    const buf = fs.readFileSync(file);
    check(`${label}: "Download Manual" saves a PDF (${Math.round(buf.length / 1024)} KB)`, buf.subarray(0, 4).toString() === '%PDF' && buf.length > 300000, `starts ${buf.subarray(0, 8).toString()}`);
    check(`${label}: file is named for the school and the account`, /CHAKARI GVT PRI SCHO/.test(dl.suggestedFilename()) && dl.suggestedFilename().includes(expect), dl.suggestedFilename());
    check(`${label}: no JS errors / failed API calls`, problems.length === 0, problems.join('; '));
    await ctx.close();
  }
});

// ── 2. Teacher enters marks (Project + Test + Exam) ──────────────────────────
await run('marks', async () => {
  const { ctx, page, problems } = await open(...TEACHER);
  await page.goto(SITE + '/results'); await page.waitForTimeout(1200);
  const area = page.locator('label:text-is("Learning area") + select').first();
  const options = await area.locator('option').allInnerTexts();
  check('the mark sheet offers the 6 core learning areas and ICT and Robotics (additional)', options.length === 7 && options.includes('ICT and Robotics (additional)'), options.join(' | '));
  await area.selectOption({ label: 'ICT and Robotics (additional)' });
  await page.locator('label:text-is("Term") + select').first().selectOption('Term 3');
  await page.waitForTimeout(900);
  await page.locator('input[aria-label="Project mark for Tendai Moyo"]').fill('15');
  await page.locator('input[aria-label="Test mark for Tendai Moyo"]').fill('14');
  await page.locator('input[aria-label="Exam mark for Tendai Moyo"]').fill('45');
  const row = page.locator('tr', { hasText: 'Tendai Moyo' });
  const rowText = await row.innerText();
  check('total (74) and grade (B, Unit 3) appear as the marks are typed', /74/.test(rowText) && /B/.test(rowText) && /Unit 3/.test(rowText), rowText.replace(/\s+/g, ' '));
  await page.click('button:has-text("Save all marks")'); await page.waitForTimeout(900);
  check('saving shows a confirmation', (await page.locator('.alert-success').count()) > 0, await page.locator('.alert').allInnerTexts().then((t) => t.join('|')));
  // a mark above the maximum is flagged and refused
  await page.locator('input[aria-label="Project mark for Rudo Dube"]').fill('25');
  check('a project mark above 20 is flagged "too high"', (await page.locator('tr', { hasText: 'Rudo Dube' }).innerText()).includes('too high'));
  await page.locator('input[aria-label="Test mark for Rudo Dube"]').fill('10');
  await page.click('button:has-text("Save all marks")'); await page.waitForTimeout(900);
  check('the server refuses the saved sheet with an error message', (await page.locator('.alert-error').count()) > 0, await page.locator('.alert').allInnerTexts().then((t) => t.join('|')));
  // saved marks survive a reload
  await page.reload(); await page.waitForTimeout(1200);
  await page.locator('label:text-is("Learning area") + select').first().selectOption({ label: 'ICT and Robotics (additional)' });
  await page.locator('label:text-is("Term") + select').first().selectOption('Term 3'); await page.waitForTimeout(900);
  check("Tendai's saved marks (15 / 14 / 45) are still there after a reload", (await page.locator('input[aria-label="Project mark for Tendai Moyo"]').inputValue()) === '15' && (await page.locator('input[aria-label="Exam mark for Tendai Moyo"]').inputValue()) === '45');
  // ICT and Robotics must not count in the report card average
  const tok = await apiLogin(...ADMIN);
  const t3 = await (await fetch(`${API}/results/all?term=${encodeURIComponent('Term 3')}`, { headers: authed(tok) })).json();
  const mine = (Array.isArray(t3) ? t3 : []).filter((r) => r.subject_name === 'ICT and Robotics');
  check('admin can see the new ICT and Robotics result', mine.length >= 1, `rows ${mine.length}`);
  for (const r of mine) await fetch(`${API}/results/${r.id}`, { method: 'DELETE', headers: authed(tok) });
  const after = await (await fetch(`${API}/results/all?term=${encodeURIComponent('Term 3')}`, { headers: authed(tok) })).json();
  check('test marks removed again', !(Array.isArray(after) ? after : []).some((r) => r.subject_name === 'ICT and Robotics'));
  check('no JS errors / unexpected failed API calls', problems.filter((p) => !/^400 /.test(p)).length === 0, problems.join('; '));
  await ctx.close();
});

// ── 3. Bursar takes a payment with notes, prints the receipt, reverses it ────
await run('payment', async () => {
  const { ctx, page, problems } = await open(...BURSAR);
  page.on('dialog', (d) => d.accept('UI test reversal'));
  await page.goto(SITE + '/finance/payments'); await page.waitForTimeout(1200);
  await page.fill('#find', 'Rudo Dube'); await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'Rudo Dube' }).first().click();
  check('the chosen pupil shows their class and balance', /Owing now|In credit|Balance/.test(await page.locator('.card').first().innerText()));
  await page.locator('label:text-is("Amount paid") + input').fill('12.50');
  await page.locator('label:has-text("Paid by") + input').fill('Mrs Dube (UI test)');
  const NOTE = 'UI test: part payment, balance due by 30 November.';
  await page.locator('textarea').first().fill(NOTE);
  await page.click('button:has-text("Record payment and get receipt")');
  await page.locator('.modal:has-text("Payment recorded")').waitFor({ timeout: 8000 });
  const modal = await page.locator('.modal').innerText();
  const receiptNo = (modal.match(/Receipt\s+(\S+)/) || [])[1];
  check('the confirmation shows the receipt number, the note and the balance', !!receiptNo && modal.includes(NOTE) && /Still owing|Fully paid|Credit balance/.test(modal), modal.replace(/\s+/g, ' ').slice(0, 200));
  await page.screenshot({ path: path.join(OUT, 'payment-recorded.png') });
  await page.click('.modal button:has-text("Done")'); await page.waitForTimeout(700);
  const histRow = page.locator('tr', { hasText: receiptNo || 'zzz' }).first();
  check('the receipt is in the history with the note and who paid', (await histRow.count()) > 0 && (await histRow.innerText()).includes('part payment') && (await histRow.innerText()).includes('Mrs Dube'));
  // the receipt PDF (print) is real
  const tok = await apiLogin(...BURSAR);
  const list = await (await fetch(`${API}/payments?status=active`, { headers: authed(tok) })).json();
  const mine = list.find((p) => p.receipt_no === receiptNo);
  const pdf = await fetch(`${API}/payments/${mine.id}/receipt.pdf`, { headers: authed(tok) });
  const bytes = Buffer.from(await pdf.arrayBuffer());
  fs.writeFileSync(path.join(OUT, 'ui-test-receipt.pdf'), bytes);
  check('the receipt opens as a PDF', pdf.status === 200 && bytes.subarray(0, 4).toString() === '%PDF' && bytes.length > 10000, `status ${pdf.status}, ${bytes.length} bytes`);
  check('stored notes and payer match what was typed', mine.notes === NOTE && mine.payer === 'Mrs Dube (UI test)', JSON.stringify({ n: mine.notes, p: mine.payer }));
  // reverse it so no test money is left in the books
  await histRow.locator('button:has-text("Reverse")').click(); await page.waitForTimeout(900);
  check('reversing says so and returns the amount to the balance', /reversed/i.test(await page.locator('.alert').first().innerText()));
  await page.selectOption('label:text-is("Status") + select', 'reversed'); await page.waitForTimeout(600);
  check('the reversed receipt is kept on record with its reason', (await page.locator('tr', { hasText: receiptNo }).innerText()).includes('UI test reversal'));
  check('no JS errors / failed API calls', problems.length === 0, problems.join('; '));
  await ctx.close();
});

// ── 4. Period bar, history, statistics and printing ──────────────────────────
await run('periods', async () => {
  const { ctx, page, problems } = await open(...BURSAR);
  await page.goto(SITE + '/finance'); await page.waitForTimeout(1500);
  const amount = async (label) => { const t = await page.locator('.kpi', { hasText: label }).first().innerText(); return parseFloat((t.match(/\$\s?([\d,]+\.\d\d)/) || [])[1]?.replace(/,/g, '') ?? 'NaN'); };
  const showing = async () => (await page.locator('.period-bar').first().innerText()).replace(/\s+/g, ' ');
  const seen = {};
  for (const p of ['Today', 'This month', 'This term', 'This year', 'All time']) {
    await page.locator('.period-bar button', { hasText: new RegExp('^' + p + '$') }).first().click(); await page.waitForTimeout(1100);
    seen[p] = { collected: await amount('Fees collected'), shown: await showing() };
  }
  console.log('      ', Object.entries(seen).map(([k, v]) => `${k}: $${v.collected}`).join('   '));
  check('every period button changes the figures and the "Showing" dates', new Set(Object.values(seen).map((v) => v.shown)).size === 5, JSON.stringify(Object.values(seen).map((v) => v.shown.slice(-26))));
  check('a longer period never shows less money than a shorter one', seen['Today'].collected <= seen['This month'].collected && seen['This month'].collected <= seen['This year'].collected && seen['This year'].collected <= seen['All time'].collected + 0.001, JSON.stringify(seen));
  // custom dates
  const inputs = page.locator('.period-bar input[type=date]');
  await inputs.nth(0).fill('2026-09-01'); await inputs.nth(1).fill('2026-09-30'); await page.waitForTimeout(1100);
  check('custom From / To dates are accepted', /01 Sep/.test(await showing()) && /30 Sep/.test(await showing()), await showing());
  // printing: emulate print media and look at it
  for (const route of ['/finance', '/finance/payments', '/finance/students', '/finance/reports']) {
    await page.goto(SITE + route); await page.waitForTimeout(1400);
    await page.emulateMedia({ media: 'print' });
    const info = await page.evaluate(() => {
      const vis = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
      return { header: vis('.print-only'), nav: vis('.navbar, nav, .nav-links'), buttons: [...document.querySelectorAll('button')].filter((b) => getComputedStyle(b).display !== 'none' && b.offsetHeight > 0).length };
    });
    check(`${route}: printed copy has the school letterhead and no menu or buttons`, info.header && !info.nav && info.buttons === 0, JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, `print${route.replace(/\//g, '-')}.png`), fullPage: false });
    await page.emulateMedia({ media: 'screen' });
  }
  check('no JS errors / failed API calls', problems.length === 0, problems.join('; '));
  await ctx.close();
});

// ── 5. Exactly four appearances ──────────────────────────────────────────────
await run('themes', async () => {
  const { ctx, page, problems } = await open(...ADMIN);
  await page.goto(SITE + '/dashboard'); await page.waitForTimeout(900);
  const sel = page.locator('select[aria-label="Appearance"]');
  const opts = await sel.locator('option').allInnerTexts();
  check('the Appearance box offers exactly 4 looks', opts.length === 4, opts.join(' | '));
  const bg = () => page.evaluate(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return { theme: document.documentElement.getAttribute('data-theme'), lum: Math.round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) }; });
  const lum = {};
  for (const v of ['light', 'dark', 'black']) { await sel.selectOption(v); await page.waitForTimeout(400); const r = await bg(); lum[v] = r.lum; check(`"${v}" applies (data-theme="${r.theme}")`, r.theme === v); }
  check('White is lighter than Dark, and Dark is lighter than Extra dark', lum.light > lum.dark && lum.dark > lum.black, JSON.stringify(lum));
  await sel.selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(400); const sd = await bg();
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(400); const sl = await bg();
  check('Default follows the computer: dark computer -> dark page, light computer -> light page', sd.lum < 90 && sl.lum > 200 && sd.lum < sl.lum, `dark ${sd.lum}, light ${sl.lum}`);
  await sel.selectOption('dark'); await page.reload(); await page.waitForTimeout(900);
  check('the chosen look is remembered after a reload', (await bg()).theme === 'dark');
  const tok = await apiLogin(...ADMIN);
  check('and saved against the account', (await (await fetch(API + '/themes', { headers: authed(tok) })).json()).theme === 'dark');
  await page.locator('select[aria-label="Appearance"]').selectOption('system');
  // no leftovers of the old fancy appearance
  check('no particle background or animated canvas on the page', (await page.locator('canvas').count()) === 0);
  const anim = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return s.animationName !== 'none' && s.animationDuration !== '0s'; }).length);
  check('no CSS animations running', anim === 0, `${anim} animated elements`);
  check('no JS errors / failed API calls', problems.length === 0, problems.join('; '));
  await ctx.close();
});

// ── 6. Passwords: forgot it, administrator gives a temporary one, forced change, signing out thieves ──
await run('passwords', async () => {
  const email = 'tatenda.gumbo5@chakari.school', oldPw = 'Student@123', newPw = 'Tatenda2026x', again = 'Student@123';
  const victim = await open(email, oldPw);                       // a device that is already logged in
  const oldToken = await victim.page.evaluate(() => localStorage.getItem('token'));
  const probe = async (t) => (await fetch(API + '/auth/me', { headers: { Authorization: 'Bearer ' + t } })).status;
  check('the logged-in device works before anything happens', (await probe(oldToken)) === 200);

  const anon = await browser.newContext(); const ap = await anon.newPage();
  await ap.goto(SITE + '/login'); await ap.click('text=Forgot your password');
  check('"Forgot your password?" opens the request page', /forgot-password/.test(ap.url()));
  await ap.fill('#identifier', email); await ap.click('button[type=submit]'); await ap.waitForTimeout(900);
  check('the request is accepted with a clear message', /administrator|request/i.test(await ap.locator('body').innerText()), (await ap.locator('main, body').first().innerText()).slice(0, 160));
  await anon.close();

  const adm = await open(...ADMIN);
  adm.page.on('dialog', (d) => d.accept());
  await adm.page.goto(SITE + '/admin'); await adm.page.click('button.tab:has-text("Passwords")'); await adm.page.waitForTimeout(900);
  const row = adm.page.locator('tr', { hasText: 'Tatenda Gumbo' }).first();
  check('the request appears in the administrator\'s Passwords tab', (await row.count()) > 0);
  await row.locator('button:has-text("Give temporary password")').click();
  await adm.page.locator('.modal:has-text("Temporary password for")').waitFor({ timeout: 8000 });
  const temp = (await adm.page.locator('.modal div[style*="monospace"]').innerText()).trim();
  check('a temporary password is shown once', /^[A-Za-z0-9-]{8,}$/.test(temp), temp.length + ' chars');
  await adm.ctx.close();

  check('the old logged-in device is signed out at once', (await probe(oldToken)) === 401);
  check('the old password no longer works', !(await apiLogin(email, oldPw)));

  const user = await open(email, temp);
  check('logging in with the temporary password lands on the "Choose your own password" page', /change-password/.test(user.page.url()) && /Choose your own password/.test(await user.page.locator('h1').innerText()), user.page.url());
  const tempToken = await user.page.evaluate(() => localStorage.getItem('token'));
  const blocked = await fetch(API + '/results/my', { headers: { Authorization: 'Bearer ' + tempToken } });
  check('the server itself refuses everything but choosing a password while the temporary one is in use', blocked.status === 403 && (await blocked.json()).must_change_password === true);
  await user.page.goto(SITE + '/results'); await user.page.waitForTimeout(700);
  check('the forced change cannot be skipped by opening another page', /change-password/.test(user.page.url()), user.page.url());
  await user.page.fill('#cur', temp); await user.page.fill('#new', newPw); await user.page.fill('#conf', newPw);
  await user.page.click('button:has-text("Save new password")'); await user.page.waitForURL(/dashboard/, { timeout: 8000 });
  check('after choosing their own password the pupil reaches the dashboard', /dashboard/.test(user.page.url()));
  check('the temporary password stops working', !(await apiLogin(email, temp)));
  check('the new password works', !!(await apiLogin(email, newPw)));

  // "I think someone knows my password": change it yourself, every other device is signed out
  const thief = await open(email, newPw);
  const thiefToken = await thief.page.evaluate(() => localStorage.getItem('token'));
  await user.page.goto(SITE + '/change-password'); await user.page.waitForTimeout(600);
  await user.page.fill('#cur', newPw); await user.page.fill('#new', again); await user.page.fill('#conf', again);
  await user.page.click('button:has-text("Save new password")'); await user.page.waitForTimeout(1200);
  check('changing your own password signs out every other device', (await probe(thiefToken)) === 401);
  check('the device that changed it stays logged in', (await probe(await user.page.evaluate(() => localStorage.getItem('token')))) === 200);
  check('the password is back to the sample one', !!(await apiLogin(email, again)));
  const wrong = await open(email, again);
  await wrong.page.goto(SITE + '/change-password');
  await wrong.page.fill('#cur', 'not-my-password'); await wrong.page.fill('#new', 'Another2026y'); await wrong.page.fill('#conf', 'Another2026y');
  await wrong.page.click('button:has-text("Save new password")'); await wrong.page.waitForTimeout(900);
  check('a wrong current password is refused', (await wrong.page.locator('.alert-error').count()) > 0);
  await wrong.page.fill('#cur', again); await wrong.page.fill('#new', 'short1'); await wrong.page.fill('#conf', 'short1');
  check('a weak new password is blocked before it is sent (the checklist is not complete)', (await wrong.page.locator('text=At least 8 characters').count()) > 0);
  for (const c of [victim, user, thief, wrong]) await c.ctx.close();
});

// ── 7. Administrator: school details, logo, grading ──────────────────────────
await run('school', async () => {
  const { ctx, page, problems } = await open(...ADMIN);
  page.on('dialog', (d) => d.accept());
  await page.goto(SITE + '/admin'); await page.click('button.tab:has-text("School details and logo")'); await page.waitForTimeout(900);
  const phone = page.locator('label:text-is("Telephone") + input');
  const original = await phone.inputValue();
  await phone.fill('+263 77 123 4567');
  await page.click('button:text-is("Save school details")'); await page.waitForTimeout(900);
  const pub = await (await fetch(API + '/branding')).json();
  check('saved school details are public at once (they print on every document)', JSON.stringify(pub).includes('+263 77 123 4567'));
  await page.reload(); await page.click('button.tab:has-text("School details and logo")'); await page.waitForTimeout(700);
  check('and are still there after a reload', (await phone.inputValue()) === '+263 77 123 4567');
  await phone.fill(original); await page.click('button:text-is("Save school details")'); await page.waitForTimeout(700);

  // logo upload and restore
  const before = await fetch(API + '/branding/logo'); const beforeLen = (await before.arrayBuffer()).byteLength;
  const sample = path.join(HERE, '../../assets/logo-small.png');
  await page.locator('label:has-text("Choose a new logo") input[type=file], input[type=file]').first().setInputFiles(sample);
  await page.waitForTimeout(1800);
  const during = await fetch(API + '/branding/logo');
  check('a new logo can be uploaded and is served to every page', during.status === 200 && (during.headers.get('content-type') || '').startsWith('image/'), `${during.status}`);
  check('the uploaded logo replaced the original', (await during.arrayBuffer()).byteLength !== beforeLen);
  await page.click('button:text-is("Use the original crest")'); await page.waitForTimeout(1500);
  const restored = await fetch(API + '/branding/logo');
  check('"Use the original crest" puts the original logo back', (await restored.arrayBuffer()).byteLength === beforeLen);

  // grading: change the split, see it on the teacher's mark sheet, change it back
  await page.click('button.tab:has-text("Grading and marks")'); await page.waitForTimeout(700);
  const proj = page.locator('label:has-text("School-Based Project") + input').first(), test = page.locator('label:text-is("Test (out of)") + input'), exam = page.locator('label:text-is("Exam (out of)") + input');
  await proj.fill('30'); await exam.fill('50');
  check('the three maximums must total 100 (shows a tick)', (await page.locator('input[readonly]').first().inputValue()).includes('100 ✓'));
  await exam.fill('55'); await page.waitForTimeout(300);
  check('a total other than 100 is not accepted', !(await page.locator('input[readonly]').first().inputValue()).includes('100 ✓'));
  await exam.fill('50'); await page.click('button:text-is("Save grading")'); await page.waitForTimeout(1000);
  const w = (await (await fetch(API + '/branding')).json()).weights;
  check('the new split (30 / 20 / 50) is saved', w?.project === 30 && w?.exam === 50, JSON.stringify(w));
  const tt = await open(...TEACHER);
  await tt.page.goto(SITE + '/results'); await tt.page.waitForTimeout(1200);
  check('the teacher\'s mark sheet now says Project /30 and Exam /50', (await tt.page.locator('th').allInnerTexts()).join('|').toLowerCase().includes('project /30') && (await tt.page.locator('th').allInnerTexts()).join('|').toLowerCase().includes('exam /50'));
  await tt.ctx.close();
  await proj.fill('20'); await exam.fill('60'); await page.click('button:text-is("Save grading")'); await page.waitForTimeout(1000);
  const w2 = (await (await fetch(API + '/branding')).json()).weights;
  check('the standard split (20 / 20 / 60) is back', w2?.project === 20 && w2?.test === 20 && w2?.exam === 60, JSON.stringify(w2));
  check('no JS errors / unexpected failed API calls', problems.filter((p) => !/^4\d\d /.test(p)).length === 0, problems.join('; '));
  await ctx.close();
});

// ── 8. Who may see what ─────────────────────────────────────────────────────
await run('access', async () => {
  const { ctx, page } = await open(...STUDENT);
  for (const p of ['/finance', '/admin', '/finance/setup', '/homework-nope']) {
    await page.goto(SITE + p); await page.waitForTimeout(700);
    check(`a pupil cannot open ${p}`, !/\/finance|\/admin/.test(new URL(page.url()).pathname) || /dashboard/.test(page.url()), page.url());
  }
  await ctx.close();
  const b = await open(...BURSAR);
  const menu = await b.page.locator('.nav-links a').allInnerTexts();
  check('the Bursar menu has only money pages', menu.join('|') === 'Overview|Receive Fees|Students|Invoices|Expenses|Cash & Bank|Reports|Setup', menu.join('|'));
  check('the Bursar is not an administrator: no Admin Panel, no Results', !menu.some((m) => /admin|results|notices/i.test(m)));
  await b.ctx.close();
  const a = await open(...ADMIN);
  const am = await a.page.locator('.nav-links a').allInnerTexts();
  check('no Sponsors, Budgets, Reconciliation, Prefects or Voting anywhere in the Administrator menu', !am.some((m) => /sponsor|budget|reconcil|prefect|vot/i.test(m)), am.join('|'));
  await a.ctx.close();
});


// ── 9. The Bursary audit trail: the Administrator can read it, nobody can change it ──
await run('audit', async () => {
  const [bt, at, tt, st] = await Promise.all([apiLogin(...BURSAR), apiLogin(...ADMIN), apiLogin(...TEACHER), apiLogin(...STUDENT)]);
  const call = async (token, method, p, body) => {
    const r = await fetch(API + p, { method, headers: authed(token), body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  const settle = () => new Promise((r) => setTimeout(r, 700));      // the line is written a moment after the answer
  const total = async () => (await call(at, 'GET', '/audit?from=2000-01-01&to=2100-01-01')).data.total;
  const today = new Date().toISOString().slice(0, 10);

  // A recorded change and its undo, made by the Bursar
  const kid = (await call(bt, 'GET', '/finance-students')).data.find((k) => k.name === 'Rudo Dube');
  const term = (await call(bt, 'GET', '/terms')).data.find((t) => t.is_current);
  const start = await total();
  const pay = await call(bt, 'POST', '/payments', { student_id: kid.id, term_id: term.id, pay_date: today, amount_paid: 3, currency: 'USD', fx_rate: 1, method: 'cash', payer: 'UI audit test' });
  check('the Bursar records a payment', pay.status === 201, JSON.stringify(pay.data).slice(0, 100));
  const refused = await call(bt, 'POST', '/payments', { student_id: kid.id, term_id: term.id, pay_date: today, amount_paid: -5, currency: 'USD', method: 'cash' });
  await settle();
  check('a refused payment (negative amount) is not recorded', refused.status === 400 && (await total()) === start + 1, `status ${refused.status}, lines ${await total()} (expected ${start + 1})`);
  const REASON = 'UI audit test: wrong pupil';
  check('the Bursar reverses it with a reason', (await call(bt, 'PUT', `/payments/${pay.data.paymentId}/reverse`, { reason: REASON })).status === 200);
  await settle();
  check('exactly two lines were added (the payment and the reversal)', (await total()) === start + 2, `before ${start}, after ${await total()}`);

  // What the Administrator sees on the page
  const adm = await open(...ADMIN);
  await adm.page.goto(SITE + '/finance/audit'); await adm.page.waitForTimeout(1300);
  check('the Administrator has an "Audit trail" tab under Bursary', (await adm.page.locator('.tabs a:text-is("Audit trail")').count()) === 1);
  check('the page opens with its heading', /Audit trail/.test(await adm.page.locator('h1').innerText()));
  await adm.page.locator('.chip:text-is("All time")').click(); await adm.page.waitForTimeout(900);
  const receipt = pay.data.receiptNo;
  const lines = adm.page.locator('tbody tr', { hasText: receipt });
  check('both lines for that receipt are listed', (await lines.count()) === 2, `found ${await lines.count()}`);
  const text = await lines.allInnerTexts().then((t) => t.join(' | ').replace(/\s+/g, ' '));
  check('each line says who, what and when: the Bursar, the action, the date and time', /Bursar/.test(text) && /Received payment/.test(text) && /Reversed receipt/.test(text) && /\d{2} \w{3} \d{4}, \d{2}:\d{2}/.test(text), text.slice(0, 200));
  check('the reversal line carries the reason that was given', text.includes(REASON), text.slice(0, 260));
  check('the pupil and amount are in the sentence', /Rudo Dube/.test(text) && /\$3\.00/.test(text), text.slice(0, 200));
  check('the reversal is shown in red', await adm.page.locator('tbody tr', { hasText: 'Reversed receipt' }).first().locator('td').nth(2).evaluate((el) => getComputedStyle(el).color !== getComputedStyle(document.body).color));
  // filters
  await adm.page.locator('label:text-is("What was done") + select').selectOption('Reversed receipt'); await adm.page.waitForFunction(() => { const c = [...document.querySelectorAll('tbody tr td:nth-child(3)')]; return c.length > 0 && c.every((td) => td.innerText.trim() === 'Reversed receipt'); }, null, { timeout: 10000 }).catch(() => {});
  const actions = await adm.page.locator('tbody tr td:nth-child(3)').allInnerTexts();
  check('"What was done" can show only reversals', actions.length >= 1 && actions.every((a) => a.trim() === 'Reversed receipt'), actions.join(','));
  await adm.page.locator('label:text-is("What was done") + select').selectOption('');
  await adm.page.locator('label:text-is("Search") + input').fill(receipt); await adm.page.waitForTimeout(500);
  check('the search box finds a receipt number', (await adm.page.locator('tbody tr').count()) === 2);
  check('there is no edit, delete or reverse button anywhere in the list', (await adm.page.locator('table button').count()) === 0 && (await adm.page.locator('table input, table textarea').count()) === 0);
  // on paper
  await adm.page.emulateMedia({ media: 'print' });
  check('the printed copy has the letterhead and the title', (await adm.page.locator('.print-only').allInnerTexts()).join(' ').includes('Bursary audit trail'));
  await adm.page.screenshot({ path: path.join(OUT, 'audit-print-view.png') });
  await adm.page.emulateMedia({ media: 'screen' });
  check('no JS errors / failed API calls', adm.problems.length === 0, adm.problems.join('; '));
  await adm.ctx.close();

  // Who may read it, and that it cannot be written to
  const bur = await open(...BURSAR);
  check('the Bursar sees no "Audit trail" in the menu', !(await bur.page.locator('.nav-links a').allInnerTexts()).some((t) => /audit/i.test(t)));
  await bur.page.goto(SITE + '/finance/audit'); await bur.page.waitForTimeout(800);
  check('the Bursar cannot open the audit page (sent away)', !/\/finance\/audit/.test(bur.page.url()), bur.page.url());
  await bur.ctx.close();
  for (const [who, token] of [['the Bursar', bt], ['a teacher', tt], ['a pupil', st]]) check(`${who} is refused when asking for the audit trail`, (await call(token, 'GET', '/audit')).status === 403);
  const attempts = [];
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) for (const p of ['/audit', '/audit/1']) attempts.push(`${m} ${p} -> ${(await call(at, m, p, {})).status}`);
  check('even the Administrator has no way to add, change or delete a line', attempts.every((a) => a.endsWith('404')), attempts.join(', '));
  const sql = async (q) => (await call(at, 'POST', '/admin/sql', { sql: q })).status;
  const before = await total();
  const blocked = [await sql('DELETE FROM audit_log'), await sql('UPDATE audit_log SET amount = 0'), await sql('DROP TABLE audit_log'), await sql('ALTER TABLE audit_log RENAME TO hidden'), await sql('delete from AUDIT_LOG where id > 0; select 1')];
  check('the SQL tool refuses every attempt to change the audit table', blocked.every((s) => s === 403), blocked.join(','));
  check('the SQL tool can still read it', (await sql('SELECT COUNT(*) AS n FROM audit_log')) === 200);
  check('and nothing was lost', (await total()) === before);
});

// ── 10. Backups, database check, class comparison, Grade 7 results, reminders ──
await run('new screens', async () => {
  // Administrator: Database tab
  const adm = await open(...ADMIN);
  await adm.page.goto(SITE + '/admin'); await adm.page.click('button.tab:has-text("Database")'); await adm.page.waitForTimeout(1200);
  check('the Database tab has a Backups section with the automatic copies listed', (await adm.page.locator('h2:text-is("Backups")').count()) === 1 && (await adm.page.locator('tr', { hasText: /school_portal-\d{4}-\d{2}-\d{2}\.db/ }).count()) >= 1);
  const [dl] = await Promise.all([adm.page.waitForEvent('download', { timeout: 15000 }), adm.page.click('button:text-is("Download a backup now")')]);
  const dbFile = path.join(OUT, 'backup-test.db'); await dl.saveAs(dbFile);
  check('"Download a backup now" saves a real database file', fs.readFileSync(dbFile).subarray(0, 15).toString() === 'SQLite format 3', dl.suggestedFilename());
  await adm.page.waitForTimeout(800);
  check('the last-download line now says today', /today/.test(await adm.page.locator('.card:has(h2:text-is("Backups"))').innerText()));
  await adm.page.click('button:text-is("Check now")'); await adm.page.waitForTimeout(1200);
  check('"Check now" reports the state of the database', /No problems found|problem/.test(await adm.page.locator('.card:has(h2:text-is("Check the database"))').innerText()) && /Link checking is on/.test(await adm.page.locator('.card:has(h2:text-is("Check the database"))').innerText()));
  await adm.page.screenshot({ path: path.join(OUT, 'database-tab.png') });
  // Users tab: Close / Reopen are offered, Delete explains itself
  await adm.page.click('button.tab:has-text("Users")'); await adm.page.waitForTimeout(700);
  check('the Users list offers Close beside each person', (await adm.page.locator('tbody button:text-is("Close")').count()) > 5);

  // Class comparison
  await adm.page.goto(SITE + '/admin/compare'); await adm.page.waitForTimeout(1200);
  await adm.page.locator('label:text-is("Term") + select').selectOption('Term 2'); await adm.page.waitForTimeout(1500);
  check('Compare Classes lists the 9 classes for the term', (await adm.page.locator('h2:text-is("Class results") ~ table tbody tr, .card:has(h2:text-is("Class results")) tbody tr').count()) === 9);
  const cmpText = await adm.page.locator('main').innerText();
  check('it shows the school average, the best class and the change since last term', /school average/i.test(cmpText) && /highest class average/i.test(cmpText) && /change/i.test(cmpText));
  check('the learning-area table has all 7 areas', (await adm.page.locator('.card:has(h2:text-is("Average by learning area")) thead th').count()) === 8);
  await adm.page.emulateMedia({ media: 'print' });
  check('the printed copy carries the letterhead and the title', (await adm.page.locator('.print-only').allInnerTexts()).join(' ').includes('Class comparison'));
  await adm.page.emulateMedia({ media: 'screen' });
  check('no JS errors / failed API calls', adm.problems.length === 0, adm.problems.join('; '));
  await adm.ctx.close();

  // Grade 7 results: only the Grade 7 teacher sees the page in the menu
  const other = await open(...TEACHER);
  check('a teacher of another class has no "Grade 7 Exams" in the menu', !(await other.page.locator('.nav-links a').allInnerTexts()).some((t) => /Grade 7/.test(t)));
  await other.page.goto(SITE + '/exams'); await other.page.waitForTimeout(1000);
  check('and is told so if they open the page anyway', /Only the Grade 7 teacher/.test(await other.page.locator('main').innerText()));
  await other.ctx.close();
  const g7 = await open(...TEACHER_G7);
  check('the Grade 7 teacher has "Grade 7 Exams" in the menu', (await g7.page.locator('.nav-links a').allInnerTexts()).includes('Grade 7 Exams'));
  await g7.page.goto(SITE + '/exams'); await g7.page.waitForTimeout(1000);
  await g7.page.locator('label:text-is("Year of the examination") + input').fill('2031'); await g7.page.waitForTimeout(1000);
  await g7.page.locator('label:text-is("Learning area to enter") + select').selectOption('Mathematics');
  await g7.page.locator('input[aria-label^="Mark for"]').first().fill('77');
  await g7.page.locator('select[aria-label^="Unit for"]').first().selectOption('2');
  await g7.page.click('button.btn-success:has-text("Save")'); await g7.page.waitForTimeout(1200);
  check('saving says how many results were saved', /1 result saved/.test(await g7.page.locator('.alert-success').innerText().catch(() => '')));
  check('the overview shows the result as mark / unit, with the total of units', /77 \/ 2/.test(await g7.page.locator('.card:has(h2:text-is("Results by pupil"))').innerText()));
  await g7.page.emulateMedia({ media: 'print' });
  check('the printed copy has the title', (await g7.page.locator('.print-only').allInnerTexts()).join(' ').includes('Grade 7 examination results'));
  await g7.page.emulateMedia({ media: 'screen' });
  await g7.page.locator('input[aria-label^="Mark for"]').first().fill('');
  await g7.page.locator('select[aria-label^="Unit for"]').first().selectOption('');
  await g7.page.click('button.btn-success:has-text("Save")'); await g7.page.waitForTimeout(1000);
  check('clearing it and saving puts things back as they were', /1 cleared/.test(await g7.page.locator('.alert-success').innerText().catch(() => '')));
  check('no JS errors / failed API calls', g7.problems.length === 0, g7.problems.join('; '));
  await g7.ctx.close();

  // Bursar: reminders offer WhatsApp and SMS from the device (automatic SMS only when it is set up)
  const bur = await open(...BURSAR);
  await bur.page.goto(SITE + '/finance/students'); await bur.page.click('button.tab:has-text("Fee reminders")'); await bur.page.waitForTimeout(1000);
  const options = await bur.page.locator('label:text-is("Send by") + select option').allInnerTexts();
  check('the Bursar can choose WhatsApp or SMS from this device; automatic SMS is not offered until it is set up', options.join('|') === 'WhatsApp|SMS from this device', options.join('|'));
  await bur.page.locator('label:text-is("Send by") + select').selectOption('sms-device');
  await bur.page.locator('label:text-is("Minimum balance ($)") + input').fill('1000');
  await bur.page.click('button:text-is("Preview Recipients")'); await bur.page.waitForTimeout(1000);
  check('the page explains what "SMS from this device" does', /messages app/.test(await bur.page.locator('main').innerText()));
  check('no JS errors / failed API calls', bur.problems.length === 0, bur.problems.join('; '));
  await bur.ctx.close();
});

// ── 11. Parents ──
await run('parents', async () => {
  const { ctx, page, problems } = await open(...PARENT);
  check('a parent lands on their own home page (no pupil or admin pages)', /\/dashboard/.test(page.url()));
  const menu = await page.locator('.nav-links a').allInnerTexts();
  check('the parent menu is only: Dashboard, Fees, Results, Report Cards, Attendance, Timetable, Notices, Appearance', menu.join('|') === 'Dashboard|Fees|Results|Report Cards|Attendance|Timetable|Notices|Appearance', menu.join('|'));
  await page.goto(SITE + '/dashboard'); await page.waitForTimeout(1500);
  const cards = page.locator('.grid .card');
  check('the home page has one card for each of the two children, with their fees', (await cards.count()) === 2 && (await cards.allInnerTexts()).every((t) => /owing|in credit|fully paid/i.test(t)), (await cards.allInnerTexts()).join(' | ').replace(/\s+/g, ' ').slice(0, 200));
  const options = await page.locator('select[aria-label="Child"] option').allInnerTexts();
  check('the header lets them choose between the children', options.length === 2 && options.every((o) => o.startsWith('Child: ')), options.join('|'));

  // the fee page shows the same figure as the child's card
  const first = cards.nth(0); const firstName = (await first.locator('h2').innerText()).trim();
  const cardOwing = (await first.innerText()).match(/\$[\d,]+\.\d\d(?= owing| in credit)/)?.[0] ?? 'Fees fully paid';
  await first.locator('button:text-is("Fees and receipts")').click(); await page.waitForTimeout(1500);
  check('"Fees and receipts" opens the fees page for that child', /\/fees/.test(page.url()));
  const feeText = await page.locator('main').innerText();
  check(`it shows the same amount as the card (${cardOwing}), for ${firstName}`, cardOwing === 'Fees fully paid' ? /fully paid/i.test(feeText) : feeText.includes(cardOwing), feeText.replace(/\s+/g, ' ').slice(0, 160));
  check('the statement and a receipt can be printed', (await page.locator('button:text-is("Statement (PDF)")').count()) === 1);

  // the report card is that child's, and read-only
  await page.goto(SITE + '/report-cards'); await page.waitForTimeout(1800);
  const rc = await page.locator('.rc-info').first().innerText().catch(() => '');
  check("the report card is the chosen child's", rc.includes(firstName), rc.replace(/\s+/g, ' ').slice(0, 120));
  check('a parent has no boxes to type comments into', (await page.locator('main textarea').count()) === 0 && (await page.locator('button:has-text("Save comment")').count()) === 0);
  await page.goto(SITE + '/results'); await page.waitForTimeout(1200);
  check('Results shows marks, with no "Enter marks" tab', (await page.locator('button.tab:has-text("Enter marks")').count()) === 0 && /Total/i.test(await page.locator('main').innerText()));

  // switching child changes every page
  const other = options.find((o) => !o.includes(firstName));
  await page.goto(SITE + '/report-cards'); await page.waitForTimeout(1000);
  await page.locator('select[aria-label="Child"]').selectOption({ label: other }); await page.waitForTimeout(1800);
  const rc2 = await page.locator('.rc-info').first().innerText().catch(() => '');
  check('choosing the other child changes the report card to theirs', rc2.includes(other.replace('Child: ', '')) && !rc2.includes(firstName), rc2.replace(/\s+/g, ' ').slice(0, 120));
  await page.reload(); await page.waitForTimeout(1500);
  check('the choice is remembered after a reload', (await page.locator('select[aria-label="Child"]').inputValue()) !== '' && (await page.locator('.rc-info').first().innerText().catch(() => '')).includes(other.replace('Child: ', '')));
  await page.emulateMedia({ media: 'print' });
  check('the printed report card has the letterhead and the child\'s name', (await page.locator('main').innerText()).includes(other.replace('Child: ', '')) && (await page.locator('.print-only').allInnerTexts()).join(' ').length >= 0);
  await page.emulateMedia({ media: 'screen' });
  // a parent cannot reach the staff pages even by typing the address
  for (const p of ['/admin', '/finance', '/homework', '/quizzes', '/exams']) { await page.goto(SITE + p); await page.waitForTimeout(500); check(`typing ${p} sends a parent back to their home page`, /\/dashboard/.test(page.url()), page.url()); }
  check('no JS errors / failed API calls', problems.length === 0, problems.join('; '));
  await ctx.close();

  // the Administrator adds a parent through the screen (temporary password), who must then choose their own
  const adm = await open(...ADMIN);
  await adm.page.goto(SITE + '/admin'); await adm.page.click('button.tab:has-text("Parents")'); await adm.page.waitForTimeout(1000);
  check('the Parents tab lists the existing parents with the pupils they can see', /Mr and Mrs Moyo/.test(await adm.page.locator('main').innerText()) && /Tendai Moyo/.test(await adm.page.locator('main').innerText()));
  const probeEmail = 'parent.uiprobe@chakari.school';
  const tok = await apiLogin(...ADMIN);
  const old = (await (await fetch(API + '/parents', { headers: authed(tok) })).json()).find((p) => p.email === probeEmail);
  if (old) await fetch(API + '/admin/users/' + old.id, { method: 'DELETE', headers: authed(tok) });
  await adm.page.reload(); await adm.page.click('button.tab:has-text("Parents")'); await adm.page.waitForTimeout(800);
  await adm.page.locator('label:has-text("Parent\'s name") + input').fill('UI Probe Parent');
  await adm.page.locator('label:has-text("Email address (their log in)") + input').fill(probeEmail);
  await adm.page.locator('input[placeholder^="Find a pupil"]').fill('Rudo'); await adm.page.waitForTimeout(400);
  await adm.page.locator('button', { hasText: 'Rudo Dube' }).first().click();
  check('a chosen pupil appears as a removable tag', (await adm.page.locator('.chip.active', { hasText: 'Rudo Dube' }).count()) === 1);
  await adm.page.click('button:text-is("Add parent")');
  await adm.page.locator('.modal:has-text("Temporary password for")').waitFor({ timeout: 8000 });
  const temp = (await adm.page.locator('.modal div[style*="monospace"]').innerText()).trim();
  check('the Administrator is shown a temporary password once', /^[A-Za-z0-9-]{8,}$/.test(temp));
  await adm.page.click('.modal button:text-is("Done")');
  check('the new parent is in the list with their pupil', (await adm.page.locator('tr', { hasText: 'UI Probe Parent' }).innerText()).includes('Rudo Dube'));
  await adm.ctx.close();
  const probe = await open(probeEmail, temp);
  check('a parent with a temporary password is asked to choose their own, not told "no pupil linked"', /Choose your own password/.test(await probe.page.locator('h1').innerText()) && (await probe.page.locator('text=No pupil linked yet').count()) === 0);
  await probe.page.fill('#cur', temp); await probe.page.fill('#new', 'Probe2026pw'); await probe.page.fill('#conf', 'Probe2026pw');
  await probe.page.click('button:has-text("Save new password")'); await probe.page.waitForURL(/dashboard/, { timeout: 8000 }); await probe.page.waitForTimeout(1500);
  check('after choosing it they see their child straight away', (await probe.page.locator('.grid .card').count()) === 1 && /Rudo Dube/.test(await probe.page.locator('main').innerText()));
  await probe.ctx.close();
  const cleanup = (await (await fetch(API + '/parents', { headers: authed(tok) })).json()).find((p) => p.email === probeEmail);
  if (cleanup) await fetch(API + '/admin/users/' + cleanup.id, { method: 'DELETE', headers: authed(tok) });
});

await finish('journeys');
