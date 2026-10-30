// Everyday classroom work through the screens: homework, quizzes, the register, grading and notices.
// These use the sample school (npm run seed:sample): its quiz "Know Your Zimbabwe" and its English homework.
// Every test that creates something deletes it again.
import { SITE, check, run, open, finish, TEACHER, OTHER_TEACHER, STUDENT } from './lib.mjs';

const PUPIL = ['tatenda.gumbo5@chakari.school', 'Student@123'];     // ECD A
const PUPIL_B = ['tendai.moyo1@chakari.school', 'Student@123'];     // ECD A
const label = (scope, text) => scope.locator(`label:text-is("${text}") + input, label:text-is("${text}") + select, label:text-is("${text}") + textarea`).first();
const quiet = (problems) => problems.filter((e) => !/favicon/.test(e));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// A session whose pop-up boxes are answered: the first "prompt" with a grade, the next with feedback
async function session(who) {
  const s = await open(...who);
  let prompts = 0;
  s.page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (prompts++ % 2 === 0 ? '7' : 'Nice work, keep it up.') : undefined));
  return s;
}

await run('teacher homework', async () => {
  const s = await session(TEACHER); const { page } = s;
  await page.goto(`${SITE}/homework`);
  const form = page.locator('form:has(button:text-is("Assign Homework"))');
  const titles = ['UI TEST homework one', 'UI TEST homework two'];
  for (const t of titles) {
    await form.locator('select').first().selectOption({ index: 1 });
    await label(form, 'Title').fill(t);
    await form.locator('input[type=datetime-local]').fill('2026-12-15T10:00');
    await form.locator('button:text-is("Assign Homework")').click();
    await page.locator('tr', { hasText: t }).waitFor({ timeout: 8000 });
    check(`"${t}" appears in My Homework Assignments`, true);
    check("the class field keeps the teacher's class after saving", (await label(form, 'Class').inputValue()) !== '');
  }
  for (const t of titles) {
    await page.locator('tr', { hasText: t }).locator('button:text-is("Delete")').click();
    await page.locator('tr', { hasText: t }).waitFor({ state: 'detached', timeout: 8000 });
  }
  check('both test tasks are deleted again', true);
  check('no JS errors / failed API calls', quiet(s.problems).length === 0, quiet(s.problems).join(' | '));
  await s.ctx.close();
});

await run('teacher quiz', async () => {
  const s = await session(TEACHER); const { page } = s;
  await page.goto(`${SITE}/quizzes`);
  const form = page.locator('form:has(button:text-is("Create Quiz"))');
  const titles = ['UI TEST quiz one', 'UI TEST quiz two'];
  for (const t of titles) {
    await form.locator('select').first().selectOption({ index: 1 });
    await label(form, 'Quiz Title').fill(t);
    await form.locator('.question-card input').first().fill('What is 2 + 2?');
    const opts = form.locator('input[placeholder^="Option"]');
    for (const [i, v] of ['3', '4', '5', '6'].entries()) await opts.nth(i).fill(v);
    await label(form, 'Correct Answer (text)').fill('4');
    await form.locator('button:text-is("Create Quiz")').click();
    await page.locator('tr', { hasText: t }).waitFor({ timeout: 8000 });
    check(`"${t}" appears in My Quizzes`, true);
  }
  await page.locator('tr', { hasText: titles[0] }).locator('button:text-is("Attempts")').click();
  await page.locator('.modal:has-text("No attempts yet")').waitFor({ timeout: 8000 });
  check('the Attempts window opens ("No attempts yet")', true);
  await page.locator('.modal button:text-is("Close")').click();
  for (const t of titles) {
    await page.locator('tr', { hasText: t }).locator('button:text-is("Delete")').click();
    await page.locator('tr', { hasText: t }).waitFor({ state: 'detached', timeout: 8000 });
  }
  check('both test quizzes are deleted again', true);
  check('no JS errors / failed API calls', quiet(s.problems).length === 0, quiet(s.problems).join(' | '));
  await s.ctx.close();
});

await run('teacher register', async () => {
  const s = await session(TEACHER); const { page } = s;
  const days = []; for (let d = new Date(); days.length < 2; d.setDate(d.getDate() - 1)) if (d.getDay() % 6) days.push(d.toISOString().slice(0, 10));
  await page.goto(`${SITE}/register`);
  await page.locator('input[type=date]').first().fill(days[1]);
  await page.locator('button:text-is("Load Register")').click();
  await page.waitForTimeout(800);
  const selects = page.locator('table select');
  const n = await selects.count();
  const values = []; for (let i = 0; i < Math.min(n, 5); i++) values.push(await selects.nth(i).inputValue());
  check('the 5 pupils are listed with their saved statuses', n >= 5 && values.every((v) => v), `statuses: ${values.join(',')}`);
  await page.locator('button:text-is("Save Register")').click();
  await page.locator('.alert:has-text("Attendance saved")').waitFor({ timeout: 8000 });
  check('saving the register works', true);
  check('no JS errors / failed API calls', quiet(s.problems).length === 0, quiet(s.problems).join(' | '));
  await s.ctx.close();
});

await run('pupil quiz', async () => {
  const s = await session(PUPIL); const { page } = s;
  await page.goto(`${SITE}/quizzes`);
  const row = page.locator('tr', { hasText: 'Know Your Zimbabwe' });
  if ((await row.locator('button:text-is("Take Quiz")').count()) === 0) {
    check('already taken on an earlier run (the row shows a score)', (await row.innerText()).includes('Score'));
  } else {
    await row.locator('button:text-is("Take Quiz")').click();
    const modal = page.locator('.modal'); await modal.waitFor();
    for (const ans of ['Harare', 'Victoria Falls', 'Great Zimbabwe', '1980', '10']) await modal.locator(`input[type=radio][value="${ans}"]`).check();
    await modal.locator('button:text-is("Submit Quiz")').click();
    await page.locator('text=PASSED').waitFor({ timeout: 8000 });
    check('the quiz is marked 5/5 and shown as PASSED', (await page.locator('.stat-card h3').innerText()).trim() === '5/5');
    await page.waitForTimeout(600);
    const after = await row.innerText();
    check('the quiz list now shows the score, with no second "Take Quiz"', after.includes('5/5') && !after.includes('Take Quiz'), after);
  }
  check('no JS errors / failed API calls', quiet(s.problems).length === 0, quiet(s.problems).join(' | '));
  await s.ctx.close();
});

await run('pupil homework', async () => {
  const s = await session(PUPIL); const { page } = s;
  await page.goto(`${SITE}/homework`);
  const heading = page.locator('h3:has-text("English Language homework (Due soon)")');
  await heading.waitFor({ timeout: 8000 });
  const card = page.locator('div', { has: heading }).last();
  if ((await card.locator('button:text-is("Submit")').count()) === 0) {
    check('already handed in on an earlier run', (await card.innerText()).includes('Submitted'));
  } else {
    await card.locator('textarea').fill('My answers are in the attached photo.');
    await card.locator('input[type=file]').setInputFiles({ name: 'answers.png', mimeType: 'image/png', buffer: PNG });
    await card.locator('button:text-is("Submit")').click();
    await page.locator('.alert:has-text("Homework submitted")').first().waitFor({ timeout: 8000 });
    check('homework with a photo is handed in and shows "Submitted"', true);
    await page.waitForTimeout(600);
    const after = await card.innerText();
    check('the card shows the date handed in and no form any more', /Submitted/.test(after) && !(await card.locator('button:text-is("Submit")').count()), after.slice(0, 100));
  }
  check('no JS errors / failed API calls', quiet(s.problems).length === 0, quiet(s.problems).join(' | '));
  await s.ctx.close();
});

await run('teacher grading', async () => {
  const s = await session(TEACHER); const { page } = s;
  await page.goto(`${SITE}/homework`);
  await page.locator('tr', { hasText: 'English Language homework (Due soon)' }).locator('button:has-text("Submissions")').click();
  await page.locator('.modal h2:text-is("Submissions")').waitFor({ timeout: 8000 });
  const row = page.locator('.modal tr', { hasText: 'Tatenda Gumbo' });
  await row.waitFor({ timeout: 8000 });
  check('the submissions list shows the pupil, with a link to the file', (await row.locator('a:text-is("View")').count()) === 1, await row.innerText());
  const href = await row.locator('a:text-is("View")').getAttribute('href');
  check('the file link works on the live site too (it does not start with http://localhost)', !!href && href.startsWith('/uploads/'), String(href));
  const file = await fetch(SITE + href);
  check('the link downloads the uploaded picture', file.status === 200 && (file.headers.get('content-type') || '').startsWith('image/'), `status ${file.status}`);
  await row.locator('button:text-is("Grade")').click();
  await page.locator('.modal tr', { hasText: 'Tatenda Gumbo' }).locator('td:nth-child(4):text-is("7")').waitFor({ timeout: 8000 });
  check('grade 7 is saved and shown', true);
  const p2 = await session(PUPIL);
  await p2.page.goto(`${SITE}/homework`);
  await p2.page.locator('h3:has-text("English Language homework (Due soon)")').waitFor({ timeout: 8000 });
  const txt = await p2.page.locator('main').innerText();
  check('the pupil sees "Grade: 7" and the teacher\'s feedback', /Grade: 7/.test(txt) && /Nice work, keep it up\./.test(txt), txt.replace(/\s+/g, ' ').slice(0, 220));
  await p2.ctx.close();
  check('no JS errors / failed API calls', quiet(s.problems).length === 0, quiet(s.problems).join(' | '));
  await s.ctx.close();
});

await run('notices', async () => {
  const t = await session(TEACHER);
  const post = async (title, audience) => {
    await t.page.goto(`${SITE}/notices`);
    const form = t.page.locator('form:has(button:text-is("Post Notice"))');
    await label(form, 'Title').fill(title);
    await label(form, 'Content').fill('Posted by the browser test.');
    await label(form, 'Audience').selectOption({ label: audience });
    await form.locator('button:text-is("Post Notice")').click();
    await t.page.locator('h3', { hasText: title }).waitFor({ timeout: 8000 });
  };
  await post('UI TEST for students', 'Students Only');
  check('a "Students Only" notice saves', true);
  await post('UI TEST for teachers', 'Teachers Only');
  check('a "Teachers Only" notice saves', true);

  const s = await session(PUPIL_B);
  await s.page.goto(`${SITE}/notices`);
  await s.page.locator('h3', { hasText: 'UI TEST for students' }).waitFor({ timeout: 8000 });
  check('a pupil sees the notice meant for pupils', true);
  check('a pupil does NOT see the notice meant for teachers', (await s.page.locator('h3', { hasText: 'UI TEST for teachers' }).count()) === 0);
  check('a pupil has no Delete buttons', (await s.page.locator('button:text-is("Delete")').count()) === 0);
  await s.ctx.close();

  const other = await session(OTHER_TEACHER);
  await other.page.goto(`${SITE}/notices`);
  await other.page.locator('h3', { hasText: 'UI TEST for teachers' }).waitFor({ timeout: 8000 });
  const theirs = other.page.locator('div[style*="border-bottom"]', { has: other.page.locator('h3:text-is("UI TEST for teachers")') });
  check('another teacher sees the teachers-only notice but has no Delete button on it', (await theirs.count()) === 1 && (await theirs.locator('button:text-is("Delete")').count()) === 0);
  await other.ctx.close();

  await t.page.goto(`${SITE}/notices`);
  for (const title of ['UI TEST for students', 'UI TEST for teachers']) {
    const card = t.page.locator('div[style*="border-bottom"]', { has: t.page.locator(`h3:text-is("${title}")`) });
    await card.waitFor({ timeout: 8000 });
    check(`the author sees a Delete button on "${title}"`, (await card.locator('button:text-is("Delete")').count()) === 1);
    await card.locator('button:text-is("Delete")').click();
    await t.page.locator('h3', { hasText: title }).waitFor({ state: 'detached', timeout: 8000 });
  }
  check('the author deleted both test notices', true);
  check('no JS errors / failed API calls', quiet(t.problems).length === 0, quiet(t.problems).join(' | '));
  await t.ctx.close();
});

void STUDENT;
await finish('classwork');
