/**
 * Opt-in sample data + end-to-end feature check for a LOCAL dev server.
 *
 *   cd backend
 *   npx tsx scripts/seed-sample-data.ts
 *   BASE_URL=http://localhost:3000/api npx tsx scripts/seed-sample-data.ts
 *
 * Drives the real HTTP API as each role (admin, bursar, 9 teachers, 45 students), so seeding
 * doubles as a test of every feature: accounts, timetable, register, homework, quizzes,
 * results/projects, report cards, notices, sports, courses, themes, and the whole bursary.
 * Safe to re-run: existing records are reused. Refuses to run against a non-local server.
 * Start the backend with AUTH_RATE_LIMIT=2000 so creating 54 accounts doesn't trip the limiter.
 */

const BASE = (process.env.BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  console.error(`Refusing to seed a non-local server (${BASE}).`);
  process.exit(1);
}
const ORIGIN = BASE.replace(/\/api$/, '');
const YEAR = '2026';
const TEACHER_PASSWORD = 'Teacher@123';
const STUDENT_PASSWORD = 'Student@123';

import fs from 'fs';
import path from 'path';

// ── tiny HTTP + assertion helpers ────────────────────────────────────────────

interface Res { status: number; data: any }

async function call(method: string, path: string, token?: string, body?: any): Promise<Res> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: any;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers, body: payload });
  const text = await r.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch { /* binary or plain text */ }
  return { status: r.status, data };
}
const get = (p: string, t?: string) => call('GET', p, t);
const post = (p: string, t?: string, b?: any) => call('POST', p, t, b ?? {});
const put = (p: string, t?: string, b?: any) => call('PUT', p, t, b ?? {});
const del = (p: string, t?: string) => call('DELETE', p, t);

const results: { area: string; name: string; ok: boolean; detail: string }[] = [];
let area = '';
function section(a: string) { area = a; console.log(`\n== ${a} ==`); }
function check(name: string, ok: boolean, detail = '') {
  results.push({ area, name, ok, detail: ok ? '' : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
}
const brief = (r: Res) => `HTTP ${r.status} ${typeof r.data === 'string' ? r.data.slice(0, 120) : JSON.stringify(r.data).slice(0, 160)}`;
function expectStatus(name: string, r: Res, status: number) { check(name, r.status === status, `expected ${status}, got ${brief(r)}`); }
// For loops of hundreds of calls: one line, first error shown.
function bulk(name: string, ok: number, total: number, firstError = '') {
  check(`${name} (${ok}/${total})`, ok === total, firstError);
}

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ── cast ─────────────────────────────────────────────────────────────────────

const TEACHERS = [
  { cls: 'ECD A', first: 'Rumbidzai', last: 'Moyo' },
  { cls: 'ECD B', first: 'Tapiwa', last: 'Ncube' },
  { cls: 'Grade 1', first: 'Chiedza', last: 'Sibanda' },
  { cls: 'Grade 2', first: 'Takudzwa', last: 'Mutasa' },
  { cls: 'Grade 3', first: 'Nomsa', last: 'Dube' },
  { cls: 'Grade 4', first: 'Blessing', last: 'Chikwanha' },
  { cls: 'Grade 5', first: 'Loveness', last: 'Mhlanga' },
  { cls: 'Grade 6', first: 'Farai', last: 'Mapfumo' },
  { cls: 'Grade 7', first: 'Josephine', last: 'Zhou' },
];
const FIRST = [
  'Tendai', 'Rudo', 'Chipo', 'Nyasha', 'Tatenda', 'Farai', 'Ruvimbo', 'Tinotenda', 'Vimbai', 'Kudzai',
  'Shamiso', 'Memory', 'Precious', 'Tsitsi', 'Anesu', 'Netsai', 'Rufaro', 'Chenai', 'Mazvita', 'Panashe',
  'Thabo', 'Sipho', 'Nokuthula', 'Lindiwe', 'Bongani', 'Zanele', 'Mthabisi', 'Thandiwe', 'Nkosana', 'Gugulethu',
  'Tafadzwa', 'Munashe', 'Tanaka', 'Kuda', 'Simbarashe', 'Fadzai', 'Chiedza', 'Ropafadzo', 'Leeroy', 'Joyline',
  'Tapuwa', 'Brighton', 'Samantha', 'Prince', 'Gift',
];
const LAST = [
  'Moyo', 'Ncube', 'Sibanda', 'Dube', 'Ndlovu', 'Mpofu', 'Chigumba', 'Mutasa', 'Banda', 'Chuma',
  'Makoni', 'Zimunya', 'Gumbo', 'Tshuma', 'Marufu',
];
// The six compulsory Heritage-Based Curriculum learning areas (ICT and Robotics is the extra seventh)
const SUBJECTS = ['Indigenous Language', 'English Language', 'Mathematics', 'Science and Technology', 'Social Science', 'Physical Education and Art'];
const EXTRA_AREA = 'ICT and Robotics';
const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

interface Person { id: number; name: string; email: string; token: string; classId: number }
const email = (first: string, last: string, n: number) => `${first}.${last}${n}@chakari.school`.toLowerCase();

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const started = Date.now();
  const health = await get('/health').catch(() => null);
  if (!health || health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Start it first.`);
    process.exit(1);
  }

  // ── Admin + bursar sign in ───────────────────────────────
  section('Sign-in (seeded admin and bursar)');
  const adminLogin = await post('/auth/login', undefined, { email: 'punhamasiwa@gmail.com', password: '1234' });
  expectStatus('admin can log in', adminLogin, 200);
  const bursarLogin = await post('/auth/login', undefined, { email: 'tascarmasiwa@gmail.com', password: '12345678' });
  expectStatus('bursar can log in', bursarLogin, 200);
  check('admin role is admin / bursar role is bursary', adminLogin.data.user?.role === 'admin' && bursarLogin.data.user?.role === 'bursary');
  const A = adminLogin.data.token as string;
  const B = bursarLogin.data.token as string;
  expectStatus('wrong password is rejected', await post('/auth/login', undefined, { email: 'punhamasiwa@gmail.com', password: 'nope' }), 401);
  expectStatus('unknown email is rejected', await post('/auth/login', undefined, { email: 'ghost@nowhere.zw', password: 'x' }), 401);
  expectStatus('no token is rejected', await get('/dashboard'), 401);
  expectStatus('garbage token is rejected', await get('/dashboard', 'not.a.token'), 401);
  expectStatus('anyone can read /auth/me with a token', await get('/auth/me', A), 200);

  // ── Classes ──────────────────────────────────────────────
  section('Classes');
  const classes: any[] = (await get('/admin/classes', A)).data;
  const classId = new Map<string, number>(classes.map((c) => [c.name, c.id]));
  check('9 classes exist (ECD A/B, Grade 1-7)', TEACHERS.every((t) => classId.has(t.cls)), `have: ${[...classId.keys()].join(', ')}`);

  // ── Teachers + students: create, activate ────────────────
  section('Accounts: create + activate teachers and students');
  const existing = new Map<string, any>(((await get('/admin/users', A)).data as any[]).map((u) => [u.email, u]));
  let created = 0, reused = 0, failed = '';

  async function ensurePerson(role: 'teacher' | 'student', first: string, last: string, mail: string, cid: number, password: string): Promise<Person | null> {
    if (existing.has(mail)) {
      const l = await post('/auth/login', undefined, { email: mail, password });
      if (l.status !== 200) { failed ||= `login ${mail}: ${brief(l)}`; return null; }
      reused++;
      return { id: l.data.user.id, name: l.data.user.name, email: mail, token: l.data.token, classId: cid };
    }
    const c = await post('/admin/users', A, { first_name: first, last_name: last, role, class_id: cid });
    if (c.status !== 201 || !c.data.reg_number) { failed ||= `create ${mail}: ${brief(c)}`; return null; }
    const a = await post('/auth/activate', undefined, { student_number: c.data.reg_number, email: mail, password });
    if (a.status !== 200) { failed ||= `activate ${mail}: ${brief(a)}`; return null; }
    created++;
    return { id: a.data.user.id, name: a.data.user.name, email: mail, token: a.data.token, classId: cid };
  }

  const teachers: Person[] = [];
  const students = new Map<number, Person[]>(); // classId -> 5 students
  let n = 0;
  for (let ci = 0; ci < TEACHERS.length; ci++) {
    const t = TEACHERS[ci];
    const cid = classId.get(t.cls)!;
    const tp = await ensurePerson('teacher', t.first, t.last, email(t.first, t.last, 0), cid, TEACHER_PASSWORD);
    if (tp) teachers.push(tp);
    const kids: Person[] = [];
    for (let k = 0; k < 5; k++) {
      const first = FIRST[ci * 5 + k];
      const last = LAST[(ci * 5 + k * 3) % LAST.length];
      n++;
      const sp = await ensurePerson('student', first, last, email(first, last, n), cid, STUDENT_PASSWORD);
      if (sp) kids.push(sp);
    }
    students.set(cid, kids);
  }
  bulk('9 teachers set up', teachers.length, 9, failed);
  bulk('45 students set up', [...students.values()].reduce((s, a) => s + a.length, 0), 45, failed);
  console.log(`      (${created} created, ${reused} already existed)`);
  if (teachers.length !== 9) { console.error('Cannot continue without all teachers.'); finish(started); return; }

  const roster = (await get('/admin/users', A)).data as any[];
  for (const t of TEACHERS) {
    const cid = classId.get(t.cls)!;
    const count = roster.filter((u) => u.role === 'student' && u.class_id === cid).length;
    check(`${t.cls} has exactly 5 students`, count === 5, `has ${count}`);
  }
  const tByClass = new Map<number, Person>(teachers.map((t) => [t.classId, t]));
  const allStudents = [...students.values()].flat();
  const me = await get('/auth/me', allStudents[0].token);
  check('student /auth/me returns role=student and a class', me.data.role === 'student' && !!me.data.class_id, brief(me));
  if (created > 0) {
    const reg = (await get('/admin/users', A)).data.find((u: any) => u.email === allStudents[0].email);
    expectStatus('re-activating an active account is rejected', await post('/auth/activate', undefined, { student_number: reg.student_number, email: 'x@y.zw', password: 'z' }), 400);
    expectStatus('activating with an unknown registration number is rejected', await post('/auth/activate', undefined, { student_number: 'c99999999c', email: 'x@y.zw', password: 'z' }), 404);
    expectStatus('activation without fields is rejected', await post('/auth/activate', undefined, {}), 400);
  }

  // ── Subjects ─────────────────────────────────────────────
  section('Subjects');
  const subj = new Map<number, Map<string, number>>(); // classId -> name -> id
  let subjMade = 0, subjFail = '';
  for (const t of TEACHERS) {
    const cid = classId.get(t.cls)!;
    // Every class gets the curriculum learning areas automatically; nothing has to be created by hand
    const have: any[] = (await get(`/subjects/class/${cid}`, A)).data;
    if (!SUBJECTS.concat(EXTRA_AREA).every((n) => have.some((s) => s.name === n))) subjFail ||= 'missing: ' + SUBJECTS.concat(EXTRA_AREA).filter((n) => !have.some((s) => s.name === n)).join(', ');
    subj.set(cid, new Map(have.map((s) => [s.name, s.id])));
  }
  void subjMade;
  bulk('every class has the 6 core learning areas + ICT and Robotics automatically', [...subj.values()].filter((m) => SUBJECTS.concat(EXTRA_AREA).every((s) => m.has(s)) && m.size === 7).length, 9, subjFail);
  expectStatus('a subject outside the curriculum is refused', await post('/admin/subjects', A, { name: 'Home Economics', class_id: subj.keys().next().value }), 400);
  const allSubjects = (await get('/admin/subjects', A)).data as any[];
  check('every subject has its class teacher assigned', allSubjects.every((s) => s.teacher_name), 'some subjects have no teacher');

  // ── Timetable ────────────────────────────────────────────
  section('Timetable (teacher proposes -> admin publishes -> everyone views)');
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const SLOTS = [['07:30', '08:10'], ['08:10', '08:50'], ['09:30', '10:10']];
  let ttFail = '', ttMade = 0;
  const firstClass = classId.get('ECD A')!;
  let freshTimetable = false;
  for (const t of teachers) {
    const proposals = (await get(`/timetables/proposals/${t.classId}`, A)).data as any[];
    if (proposals.length > 0) continue;
    freshTimetable = true;
    for (let d = 0; d < DAYS.length; d++) {
      for (let s = 0; s < SLOTS.length; s++) {
        const name = SUBJECTS[(d * SLOTS.length + s) % SUBJECTS.length];
        const lastOfFirst = t.classId === firstClass && d === 4 && s === 2;
        const body: any = { class_id: t.classId, day: DAYS[d], start_time: SLOTS[s][0], end_time: SLOTS[s][1], room: `Room ${t.classId}` };
        // one entry goes through the "subject by name" path the UI uses
        if (lastOfFirst) body.subject_name = name; else body.subject_id = subj.get(t.classId)!.get(name);
        const r = await post('/timetables', t.token, body);
        if (r.status === 201) ttMade++; else ttFail ||= brief(r);
      }
    }
  }
  if (freshTimetable) {
    bulk('teachers proposed 15 lessons each', ttMade, 135, ttFail);
    const pre = await get(`/timetables/class/${firstClass}`, students.get(firstClass)![0].token);
    check('students do NOT see draft lessons before publishing', pre.data.entries?.length === 0, brief(pre));
    const prop = (await get(`/timetables/proposals/${firstClass}`, A)).data as any[];
    expectStatus('admin edits a lesson (room change)', await put(`/timetables/${prop[0].id}`, A, { room: 'Hall' }), 200);
    expectStatus('admin deletes a lesson', await del(`/timetables/${prop[1].id}`, A), 200);
    expectStatus('teacher re-proposes the deleted lesson', await post('/timetables', tByClass.get(firstClass)!.token, { class_id: firstClass, subject_id: prop[1].subject_id, day: prop[1].day, start_time: prop[1].start_time, end_time: prop[1].end_time, room: 'Room 1' }), 201);
  }
  let published = 0;
  for (const t of teachers) {
    const r = await post(`/timetables/publish/${t.classId}`, A);
    if (r.status === 200 && r.data.total_entries === 15) published++;
  }
  bulk('admin published a 15-lesson timetable for each class', published, 9);
  const stuTT = await get(`/timetables/class/${firstClass}`, students.get(firstClass)![0].token);
  check('students now see all 15 lessons grouped by day', stuTT.data.entries?.length === 15 && Object.keys(stuTT.data.organized).length === 5, brief(stuTT));
  check('teacher sees own proposals', ((await get('/timetables/my', teachers[0].token)).data as any[]).length === 15);
  check('admin sees every class timetable', ((await get('/timetables/all', A)).data as any[]).length >= 135);

  // ── Register / attendance ────────────────────────────────
  section('Register (attendance)');
  const schoolDays: string[] = [];
  for (let d = new Date(); schoolDays.length < 5; d = addDays(d, -1)) if (d.getDay() !== 0 && d.getDay() !== 6) schoolDays.push(ymd(d));
  const statusFor = (k: number, di: number) => ((k + di) % 7 === 0 ? 'absent' : (k * (di + 1)) % 5 === 0 && k > 0 ? 'late' : (k + di) % 11 === 0 ? 'excused' : 'present');
  let attOk = 0, attFail = '';
  const attendanceNew: boolean[] = [];
  for (const t of teachers) {
    const have = (await get(`/attendance?class_id=${t.classId}`, t.token)).data as any[];
    if (have.length >= 5) { attendanceNew.push(false); continue; }
    attendanceNew.push(true);
    const kids = students.get(t.classId)!;
    for (let di = 0; di < schoolDays.length; di++) {
      const records = kids.map((s, k) => ({ student_id: s.id, status: statusFor(k, di) }));
      const r = await post('/attendance', t.token, { class_id: t.classId, subject_id: null, date: schoolDays[di], records });
      if (r.status === 200) attOk++; else attFail ||= brief(r);
    }
  }
  if (attendanceNew.some(Boolean)) bulk('registers marked (5 days x classes)', attOk, attendanceNew.filter(Boolean).length * 5, attFail);
  const tAtt = (await get(`/attendance?class_id=${teachers[0].classId}`, teachers[0].token)).data as any[];
  check('teacher can read back the register', tAtt.length >= 5 && Array.isArray(tAtt[0].records), brief({ status: 200, data: tAtt.slice(0, 1) }));
  check('class roster for marking has 5 students', ((await get(`/attendance/students/${teachers[0].classId}`, teachers[0].token)).data as any[]).length === 5);
  {
    // Re-saving a date must update that day's register (not add a second one). Statuses are the same
    // ones that belong to that day, so this is also a no-op for the data.
    const kids = students.get(teachers[0].classId)!;
    const r = await post('/attendance', teachers[0].token, { class_id: teachers[0].classId, subject_id: null, date: schoolDays[0], records: kids.map((s, k) => ({ student_id: s.id, status: statusFor(k, 0) })) });
    const again = (await get(`/attendance?class_id=${teachers[0].classId}&date=${schoolDays[0]}`, teachers[0].token)).data as any[];
    check('a teacher CAN re-save their register; it updates instead of duplicating', r.status === 200 && again.length === 1, `status ${r.status}, rows for that date: ${again.length}`);
  }
  let attMismatch = 0;
  for (const t of teachers) {
    const kids = students.get(t.classId)!;
    for (let k = 0; k < kids.length; k++) {
      const mine = (await get('/attendance/my', kids[k].token)).data as any[];
      for (let di = 0; di < schoolDays.length; di++) {
        const rec = mine.find((m) => m.date === schoolDays[di]);
        if (!rec || rec.status !== statusFor(k, di)) attMismatch++;
      }
    }
  }
  check('every student sees exactly their own status for all 5 days (225 checks)', attMismatch === 0, `${attMismatch} mismatches`);

  // ── Homework ─────────────────────────────────────────────
  section('Homework (assign -> submit with/without file -> grade -> student sees marks)');
  const today = new Date();
  const hwPlan = [
    { subject: 'Mathematics', due: ymd(addDays(today, -3)), label: 'Past due' },
    { subject: 'English Language', due: ymd(addDays(today, 3)), label: 'Due soon' },
    { subject: 'Science and Technology', due: ymd(addDays(today, 10)), label: 'Next week' },
  ];
  const PNG = PNG_BYTES;
  let hwMade = 0, hwFail = '', subsOk = 0, subsTotal = 0, subsFail = '', gradedOk = 0, gradedTotal = 0, gradeFail = '';
  let uploadedFile = '';
  for (const t of teachers) {
    let mine = (await get('/homework/my-classes', t.token)).data as any[];
    mine = mine.filter((h) => !String(h.title).startsWith('PROBE'));
    const fresh = mine.length === 0;
    if (fresh) {
      for (const p of hwPlan) {
        const r = await post('/homework', t.token, { class_id: t.classId, subject_id: subj.get(t.classId)!.get(p.subject), title: `${p.subject} homework (${p.label})`, description: `Complete the exercises on the board for ${p.subject}.`, due_date: p.due });
        if (r.status === 201) hwMade++; else hwFail ||= brief(r);
      }
      mine = ((await get('/homework/my-classes', t.token)).data as any[]).filter((h) => !String(h.title).startsWith('PROBE'));
    }
    if (!fresh) continue;

    const kids = students.get(t.classId)!;
    const byDue = [...mine].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const submitters = [kids, kids.slice(0, 3), [] as Person[]]; // hw1: all 5, hw2: 3, hw3: none
    for (let h = 0; h < 3; h++) {
      for (let k = 0; k < submitters[h].length; k++) {
        subsTotal++;
        let r: Res;
        if (h === 0 && k === 0) {
          const fd = new FormData();
          fd.append('file', new Blob([PNG], { type: 'image/png' }), 'my-homework.png');
          fd.append('notes', 'See my photo of the exercise book.');
          r = await call('POST', `/homework/submit/${byDue[h].id}`, submitters[h][k].token, fd);
          if (r.status === 201 && !uploadedFile) uploadedFile = r.data.file;
        } else {
          const fd = new FormData();
          fd.append('notes', `Answers by ${submitters[h][k].name}`);
          r = await call('POST', `/homework/submit/${byDue[h].id}`, submitters[h][k].token, fd);
        }
        if (r.status === 201) subsOk++; else subsFail ||= brief(r);
      }
      const subs = (await get(`/homework/submissions/${byDue[h].id}`, t.token)).data.submissions as any[];
      const ungraded = h === 1 ? 1 : 0; // leave one hw2 submission ungraded
      for (let i = 0; i < subs.length - ungraded; i++) {
        gradedTotal++;
        const r = await put(`/homework/grade/${subs[i].id}`, t.token, { grade: 10 - (i % 5), feedback: i % 2 ? 'Good effort, check question 3.' : 'Excellent work!' });
        if (r.status === 200) gradedOk++; else gradeFail ||= brief(r);
      }
    }
  }
  if (hwMade) bulk('teachers assigned 3 homework tasks each', hwMade, 27, hwFail);
  if (subsTotal) bulk('students submitted homework', subsOk, subsTotal, subsFail);
  if (gradedTotal) bulk('teachers graded submissions with feedback', gradedOk, gradedTotal, gradeFail);
  if (uploadedFile) {
    const f = await fetch(ORIGIN + uploadedFile);
    check('uploaded homework file can be downloaded', f.status === 200, `GET ${uploadedFile} -> ${f.status}`);
  }
  {
    const t = teachers[0], k0 = students.get(t.classId)![0], k4 = students.get(t.classId)![4];
    const list = (await get('/homework/my', k0.token)).data as any[];
    check('student sees 3 homework tasks for their class', list.length === 3, `got ${list.length}`);
    const graded = list.filter((h) => h.submission && h.submission.grade != null);
    check('student sees own grade + feedback on graded work', graded.length >= 1 && graded.every((h) => h.submission.feedback), brief({ status: 200, data: list.map((h) => h.submission) }));
    const l4 = (await get('/homework/my', k4.token)).data as any[];
    const neverSubmitted = l4.find((h) => String(h.title).startsWith('Science and Technology'));
    check('a homework task the student has not handed in shows no submission', !!neverSubmitted && neverSubmitted.submission === null, JSON.stringify(neverSubmitted?.submission));
    const dup = await call('POST', `/homework/submit/${list[0].id}`, k0.token, (() => { const f = new FormData(); f.append('notes', 'again'); return f; })());
    expectStatus('submitting the same homework twice is rejected', dup, 400);
    const bad = new FormData(); bad.append('file', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'virus.exe');
    expectStatus('uploading a .exe is rejected', await call('POST', `/homework/submit/${list[2].id}`, k4.token, bad), 400);
  }

  // ── Quizzes ──────────────────────────────────────────────
  section('Quizzes (create -> student attempts -> auto-marked -> teacher sees scores)');
  const ci0 = (cid: number) => TEACHERS.findIndex((t) => classId.get(t.cls) === cid);
  function mathQuestions(ci: number) {
    return [1, 2, 3, 4, 5].map((i) => {
      const a = i + ci, b = i + 1, sum = a + b;
      return { question: `What is ${a} + ${b}?`, options: [String(sum - 1), String(sum), String(sum + 1), String(sum + 2)], correct_answer: String(sum) };
    });
  }
  const GK = [
    { question: 'What is the capital city of Zimbabwe?', options: ['Bulawayo', 'Harare', 'Gweru', 'Mutare'], correct_answer: 'Harare' },
    { question: 'Which famous waterfall is on the Zambezi River in Zimbabwe?', options: ['Victoria Falls', 'Mutarazi Falls', 'Bridal Veil Falls', 'Kariba Falls'], correct_answer: 'Victoria Falls' },
    { question: 'Which ancient stone city gave Zimbabwe its name?', options: ['Khami', 'Great Zimbabwe', 'Danamombe', 'Naletale'], correct_answer: 'Great Zimbabwe' },
    { question: 'In which year did Zimbabwe gain independence?', options: ['1965', '1975', '1980', '1990'], correct_answer: '1980' },
    { question: 'How many provinces does Zimbabwe have?', options: ['8', '9', '10', '12'], correct_answer: '10' },
  ];
  const quizByClass = new Map<number, any[]>();
  let quizMade = 0, quizFail = '';
  for (const t of teachers) {
    let mine = ((await get('/quizzes/my', t.token)).data as any[]).filter((q) => !String(q.title).startsWith('PROBE'));
    if (mine.length === 0) {
      const q1 = await post('/quizzes', t.token, { class_id: t.classId, subject_id: subj.get(t.classId)!.get('Mathematics'), title: 'Mathematics Quiz: Addition', description: 'Five quick addition questions.', duration_minutes: 10, questions: mathQuestions(ci0(t.classId)) });
      const q2 = await post('/quizzes', t.token, { class_id: t.classId, subject_id: subj.get(t.classId)!.get('Social Science'), title: 'Know Your Zimbabwe', description: 'General knowledge about Zimbabwe.', duration_minutes: 15, questions: GK });
      for (const r of [q1, q2]) { if (r.status === 201) quizMade++; else quizFail ||= brief(r); }
      mine = ((await get('/quizzes/my', t.token)).data as any[]).filter((q) => !String(q.title).startsWith('PROBE'));
      mine.sort((a, b) => a.id - b.id);
      const kids = students.get(t.classId)!;
      const ci = ci0(t.classId);
      for (const [qi, quiz] of mine.entries()) {
        const bank = qi === 0 ? mathQuestions(ci) : GK;
        const qs = (await get(`/quizzes/${quiz.id}/questions`, kids[0].token)).data;
        if (qi === 0 && t === teachers[0]) {
          check('quiz questions sent to students never include the answer key', qs.questions.every((q: any) => !('correct_answer' in q)) && qs.questions.length === 5, brief({ status: 200, data: qs.questions?.[0] }));
        }
        const attempters = qi === 0 ? kids : kids.slice(0, 3);
        let quizProblem = '';
        for (let k = 0; k < attempters.length; k++) {
          const nCorrect = qi === 0 ? 5 - k : [5, 3, 0][k];
          const fresh = (await get(`/quizzes/${quiz.id}/questions`, attempters[k].token)).data.questions as any[];
          const answers = fresh.map((q: any, idx: number) => {
            const truth = bank.find((b) => b.question === q.question)!;
            const opts: string[] = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            const wrong = opts.find((o) => o !== truth.correct_answer)!;
            // student 1 on quiz 1 leaves their last question blank
            if (qi === 0 && k === 1 && idx === 4) return { question_id: q.id, selected_answer: '' };
            return { question_id: q.id, selected_answer: idx < nCorrect ? truth.correct_answer : wrong };
          });
          const r = await post(`/quizzes/${quiz.id}/attempt`, attempters[k].token, { answers });
          if (!(r.status === 200 && r.data.score === nCorrect && r.data.total === 5)) quizProblem ||= `student ${k}: expected ${nCorrect}/5, got ${brief(r)}`;
        }
        const attempts = (await get(`/quizzes/${quiz.id}/attempts`, t.token)).data as any[];
        const scores = attempts.map((a) => a.score).sort((x, y) => y - x).join(',');
        const wanted = (qi === 0 ? [5, 4, 3, 2, 1] : [5, 3, 0]).join(',');
        check(`${t.name}: "${quiz.title}" — ${attempters.length} attempts auto-marked (${wanted})`, quizProblem === '' && scores === wanted, quizProblem || `teacher sees scores ${scores}, expected ${wanted}`);
      }
    }
    quizByClass.set(t.classId, mine);
  }
  if (quizMade) bulk('teachers created 2 quizzes each', quizMade, 18, quizFail);
  {
    const k = students.get(teachers[0].classId)![0];
    const avail = (await get('/quizzes/available', k.token)).data as any[];
    check('student sees both class quizzes with their own score', avail.length === 2 && avail.every((q) => Array.isArray(q.attempts)) && avail.some((q) => q.attempts.length === 1 && q.attempts[0].total === 5), brief({ status: 200, data: avail.map((q: any) => q.attempts) }));
  }

  // ── Results (School-Based Project + Test + Exam) ─────────
  section('Results: School-Based Project, Test, Exam, grades, report cards');
  const rand = rng(2026);
  const gradeOf = (t: number) => (t >= 75 ? 'A' : t >= 65 ? 'B' : t >= 50 ? 'C' : t >= 40 ? 'D' : 'E');
  const REMARK: Record<string, string> = { A: 'Outstanding performance.', B: 'Very good, keep it up.', C: 'Satisfactory; aim higher.', D: 'Needs more effort.', E: 'Requires extra support.' };
  const expectedTotals = new Map<number, Record<string, number[]>>(); // studentId -> term -> totals
  let resOk = 0, resTotal = 0, resFail = '', freshResults = false;
  for (const t of teachers) {
    const have = (await get('/results/entered', t.token)).data as any[];
    if (Array.isArray(have) && have.length > 0) continue;
    freshResults = true;
    const kids = students.get(t.classId)!;
    for (const kid of kids) {
      const ability = 0.45 + rand() * 0.55;
      expectedTotals.set(kid.id, {});
      for (const term of ['Term 1', 'Term 2']) {
        expectedTotals.get(kid.id)![term] = [];
        for (const name of SUBJECTS) {
          const frac = () => Math.min(1, Math.max(0.1, ability + (rand() - 0.5) * 0.25));
          const project = Math.round(20 * frac()), test = Math.round(20 * frac()), exam = Math.round(60 * frac());
          const total = project + test + exam;
          resTotal++;
          // Exactly what the Results page sends: a subject NAME, not an id.
          const r = await post('/results', t.token, { student_id: kid.id, subject_name: name, term, academic_year: YEAR, coursework: project, test_score: test, exam, grade: gradeOf(total), remarks: REMARK[gradeOf(total)] });
          if (r.status === 201 || r.status === 200) { resOk++; expectedTotals.get(kid.id)![term].push(total); } else resFail ||= brief(r);
        }
      }
    }
  }
  if (freshResults) bulk('540 results entered (45 students x 6 subjects x 2 terms)', resOk, resTotal, resFail);
  {
    const t = teachers[0], kid = students.get(t.classId)![0];
    const mine = (await get('/results/my', kid.token)).data as any[];
    check('student sees own results for both terms', mine.length === 12, brief({ status: 200, data: `rows=${Array.isArray(mine) ? mine.length : mine}` }));
    const rc = (await get(`/results/report-card/${kid.id}?term=${encodeURIComponent('Term 1')}&academic_year=${YEAR}`, kid.token)).data;
    check('student opens own report card (6 subjects)', rc.results?.length === 6 && typeof rc.avgScore === 'number', brief({ status: 200, data: rc }));
    check('report card never contains a password hash', !JSON.stringify(rc).includes('$2a$') && !('password' in (rc.student || {})), 'the student object includes the bcrypt hash');
    const exp = expectedTotals.get(kid.id)?.['Term 1'];
    if (exp?.length === 6) check('report card average = mean of the 6 term totals', rc.avgScore === Math.round(exp.reduce((a, b) => a + b, 0) / 6), `card ${rc.avgScore} vs expected ${Math.round(exp.reduce((a, b) => a + b, 0) / 6)}`);
    check('teacher sees own entered results', ((await get('/results/entered', t.token)).data as any[]).length === 60);
    check('teacher can filter results by term', ((await get(`/results/entered?term=${encodeURIComponent('Term 1')}`, t.token)).data as any[]).length === 30);
    const all = await get(`/results/all?class_id=${t.classId}`, A);
    check('admin sees all results for a class', Array.isArray(all.data) && all.data.length === 60, brief(all));
    const sum = await get(`/results/class-summary/${t.classId}`, t.token);
    check('class summary ranks 5 students', Array.isArray(sum.data) && sum.data.length === 5, brief(sum));
    const bd = await get(`/results/subject-breakdown/${t.classId}`, A);
    check('subject breakdown covers 6 subjects', Array.isArray(bd.data) && bd.data.length === 6, brief(bd));
    const st = await get(`/results/student-stats/${kid.id}`, A);
    check('student stats never contain a password hash', !JSON.stringify(st.data).includes('$2a$'), 'the student object includes the bcrypt hash');
    check('student stats combine results, attendance, homework, quizzes', st.status === 200 && st.data.results?.length === 12 && st.data.attendance?.length === 5 && st.data.homework?.length >= 1 && st.data.quizzes?.length >= 1, brief(st));
    const rows = (await get('/results/entered', t.token)).data as any[];
    const target = rows.find((r) => r.student_id === kid.id && r.term === 'Term 1');
    if (target) {
      expectStatus('teacher edits a result', await put(`/results/${target.id}`, t.token, { coursework: 20, test_score: 20, exam: 60, grade: 'A', remarks: 'Perfect' }), 200);
      const after = ((await get('/results/my', kid.token)).data as any[]).find((r) => r.id === target.id);
      check('edited result recalculates the total score to 100', after?.score === 100, `score=${after?.score}`);
      expectStatus('teacher cannot delete results (admin only)', await del(`/results/${target.id}`, t.token), 403);
    }
    const g7 = teachers[8], g7kids = students.get(g7.classId)!;
    const hist = await post('/results', g7.token, { student_id: g7kids[0].id, subject_name: 'Mathematics', term: 'Term 3', academic_year: '2025', coursework: 15, test_score: 14, exam: 40, grade: 'C', remarks: 'Last year' });
    check('a result from a previous year can be entered', hist.status === 201 || hist.status === 200, brief(hist));
    if (hist.status === 201) {
      expectStatus('admin archives Term 3 2025', await post('/results/archive-term', A, { term: 'Term 3', academic_year: '2025' }), 200);
      const arch = (await get('/results/entered?status=archived', g7.token)).data as any[];
      check('archived results are listed under status=archived', arch.length === 1, `archived rows: ${arch.length}`);
    }
  }

  // ── Notices ──────────────────────────────────────────────
  section('Notices');
  const noticeTitles = ['Welcome back to Term 3', 'Staff meeting Friday 2pm', 'Sports day next month', 'Fees reminder from the bursar'];
  const haveNotices = (await get('/notices', A)).data as any[];
  if (!haveNotices.some((x) => x.title === noticeTitles[0])) {
    expectStatus('admin posts a notice to everyone', await post('/notices', A, { title: noticeTitles[0], content: 'Term 3 opened on 1 September. Please check your timetable.', target_role: 'all' }), 201);
    expectStatus('admin posts a notice to teachers only', await post('/notices', A, { title: noticeTitles[1], content: 'Staff room, 2pm. Bring your registers.', target_role: 'teachers' }), 201);
    expectStatus('admin posts a notice to students only', await post('/notices', A, { title: noticeTitles[2], content: 'Sports day is on the last Friday of the month. Join a team!', target_role: 'students' }), 201);
    for (const t of teachers.slice(0, 3)) expectStatus(`${t.name} posts a notice to students`, await post('/notices', t.token, { title: `Message from ${t.name}`, content: 'Please bring your exercise books tomorrow.', target_role: 'students' }), 201);
  }
  const stuNotices = (await get('/notices', students.get(teachers[0].classId)![0].token)).data as any[];
  check('students see "all" + "students" notices only', stuNotices.length >= 4 && stuNotices.every((x) => ['all', 'students'].includes(x.target_role)) && !stuNotices.some((x) => x.title === noticeTitles[1]), brief({ status: 200, data: stuNotices.map((x) => x.title) }));
  const teaNotices = (await get('/notices', teachers[5].token)).data as any[];
  check('teachers see staff notices', teaNotices.some((x) => x.title === noticeTitles[1]));
  expectStatus('students cannot post notices', await post('/notices', students.get(teachers[0].classId)![0].token, { title: 'x', content: 'x' }), 403);
  const mineN = (await get('/notices', teachers[0].token)).data as any[];
  const adminNotice = mineN.find((x) => x.title === noticeTitles[0]);
  const delOther = await del(`/notices/${adminNotice.id}`, teachers[0].token);
  const stillThere = ((await get('/notices', A)).data as any[]).some((x) => x.id === adminNotice.id);
  check("a teacher cannot delete the admin's notice (and is told so)", stillThere && delOther.status === 403, `notice was ${stillThere ? 'kept' : 'DELETED'} (HTTP ${delOther.status})`);

  // ── Sports ───────────────────────────────────────────────
  section('Sports');
  let sports = (await get('/sports', A)).data as any[];
  const plan = [
    { name: 'Football', description: 'Inter-house football', max_participants: 0, coach: teachers[7] },
    { name: 'Netball', description: 'Girls and boys netball', max_participants: 0, coach: teachers[4] },
    { name: 'Athletics', description: 'Track and field', max_participants: 0, coach: teachers[8] },
    { name: 'Chess Club', description: 'Limited places', max_participants: 3, coach: teachers[2] },
  ];
  for (const s of plan) {
    if (sports.some((x) => x.name === s.name)) continue;
    expectStatus(`${s.name} created`, await post('/sports', A, { name: s.name, description: s.description, coach_id: s.coach.id, max_participants: s.max_participants }), 201);
  }
  if (!sports.some((x) => x.name === 'Volleyball')) expectStatus('a teacher can also create a sport', await post('/sports', teachers[3].token, { name: 'Volleyball', description: 'Teacher-created' }), 201);
  sports = (await get('/sports', A)).data as any[];
  const sp = (n: string) => sports.find((x) => x.name === n);
  const g1kids = students.get(teachers[2].classId)!;
  if (sp('Chess Club').participant_count === 0) {
    let joined = 0, full = 0;
    for (const s of [...g1kids, ...students.get(teachers[3].classId)!].slice(0, 5)) {
      const r = await post(`/sports/join/${sp('Chess Club').id}`, s.token);
      if (r.status === 200) joined++; else if (r.status === 400 && /full/i.test(r.data.message)) full++;
    }
    check('chess club accepts 3 players then reports "full"', joined === 3 && full === 2, `joined=${joined} full=${full}`);
    expectStatus('joining twice is rejected', await post(`/sports/join/${sp('Chess Club').id}`, g1kids[0].token), 400);
    expectStatus('a student can leave a sport', await del(`/sports/leave/${sp('Chess Club').id}`, g1kids[2].token), 200);
    let fb = 0;
    for (const s of allStudents.filter((_, i) => i % 3 === 0)) if ((await post(`/sports/join/${sp('Football').id}`, s.token)).status === 200) fb++;
    check('15 students joined Football', fb === 15, `joined ${fb}`);
    let nb = 0;
    for (const s of allStudents.filter((_, i) => i % 4 === 1)) if ((await post(`/sports/join/${sp('Netball').id}`, s.token)).status === 200) nb++;
    check('students joined Netball', nb > 8, `joined ${nb}`);
  }
  const parts = (await get(`/sports/${sp('Football').id}/participants`, teachers[7].token)).data as any[];
  check('participant list shows names', parts.length >= 15 && parts.every((p) => p.student_name), brief({ status: 200, data: parts.slice(0, 1) }));

  // ── Courses ──────────────────────────────────────────────
  section('Courses');
  let courseOk = 0, courseFail = '', courseFresh = false;
  for (const t of teachers) {
    if (((await get('/courses/my', t.token)).data as any[]).length > 0) continue;
    courseFresh = true;
    for (const c of [{ name: 'Reading Club', day_of_week: 'Wednesday', start_time: '14:00', end_time: '15:00' }, { name: 'Extra Maths Lesson', day_of_week: 'Thursday', start_time: '14:00', end_time: '15:00' }]) {
      const r = await post('/courses', t.token, { ...c, description: `${c.name} for ${t.name}'s class`, class_id: t.classId });
      if (r.status === 201) courseOk++; else courseFail ||= brief(r);
    }
  }
  if (courseFresh) bulk('teachers created 2 courses each', courseOk, 18, courseFail);
  const enrolled = (await get('/courses/enrolled', students.get(teachers[0].classId)![0].token)).data as any[];
  check('student sees their class courses with teacher name', enrolled.length === 2 && enrolled.every((c) => c.teacher_name), brief({ status: 200, data: enrolled }));
  const myCourses = (await get('/courses/my', teachers[0].token)).data as any[];
  check('teacher sees enrolment count', myCourses.length === 2 && myCourses.every((c) => c.enrolled_count === 5), brief({ status: 200, data: myCourses }));
  expectStatus('teacher updates a course', await put(`/courses/${myCourses[0].id}`, teachers[0].token, { name: myCourses[0].name, description: 'Updated', day_of_week: 'Monday', start_time: '14:00', end_time: '15:30' }), 200);

  // ── Themes ───────────────────────────────────────────────
  section('Themes');
  const themes = await get('/themes/list', A);
  check('exactly 4 themes: default (follows the computer), white, dark, extra dark', themes.data.length === 4 && ['system', 'light', 'dark', 'black'].every((id) => themes.data.some((t: any) => t.id === id)), `got ${JSON.stringify(themes.data)}`);
  const pick = ['light', 'dark', 'black', 'system'];
  const themed = [A, B, teachers[0].token, allStudents[0].token];
  let themeOk = 0;
  for (let i = 0; i < themed.length; i++) {
    await put('/themes', themed[i], { theme: pick[i] });
    if ((await get('/themes', themed[i])).data.theme === pick[i]) themeOk++;
  }
  bulk('each role can save and reload its theme', themeOk, 4);
  await put('/themes', A, { theme: 'zimheritage' });
  check('an old coloured theme falls back to the professional default', (await get('/themes', A)).data.theme === 'system');

  // ── Dashboards ───────────────────────────────────────────
  section('Dashboards');
  const dA = (await get('/dashboard', A)).data, dT = (await get('/dashboard', teachers[0].token)).data, dS = (await get('/dashboard', allStudents[0].token)).data;
  check('admin dashboard counts: 45 students, 9 teachers, 9 classes', dA.students === 45 && dA.teachers === 9 && dA.classes === 9, JSON.stringify(dA));
  check('teacher dashboard: class name + 7 learning areas', dT.className === 'ECD A' && dT.subjects === 7, JSON.stringify(dT));
  check('student dashboard: class + notices', dS.className === 'ECD A' && dS.notices >= 3, JSON.stringify(dS));

  // ── Bursary ──────────────────────────────────────────────
  await bursary(B, A, allStudents, classId, students);

  // ── Permissions ──────────────────────────────────────────
  await permissions(A, B, teachers, students, subj, quizByClass);

  finish(started);
}

// ═════════════════════════════════════════════════════════════════════════════
// Bursary
// ═════════════════════════════════════════════════════════════════════════════

async function bursary(B: string, A: string, allStudents: Person[], classId: Map<string, number>, students: Map<number, Person[]>) {
  section('Bursary: setup (terms, fee items, fee structure, currencies, accounts)');
  let terms = (await get('/terms', B)).data as any[];
  const ensureTerm = async (no: number, start: string, end: string) => {
    let t = terms.find((x) => x.year === YEAR && x.term_no === no);
    if (!t) { await post('/terms', B, { year: YEAR, term_no: no, start_date: start, end_date: end }); terms = (await get('/terms', B)).data; t = terms.find((x) => x.year === YEAR && x.term_no === no); }
    return t;
  };
  const t2 = await ensureTerm(2, '2026-05-05', '2026-08-14');
  const t3 = await ensureTerm(3, '2026-09-01', '2026-12-04');
  check('Term 2 and Term 3 of 2026 exist', !!t2 && !!t3);
  expectStatus('bursar sets Term 3 as current', await put(`/terms/${t3.id}/set-current`, B), 200);
  check('current term is Term 3', (await get('/terms/current', B)).data?.id === t3.id);

  const curr = (await get('/currencies', B)).data as any[];
  check('USD (base) and ZWG currencies exist', curr.some((c) => c.code === 'USD' && c.is_base) && curr.some((c) => c.code === 'ZWG'), JSON.stringify(curr));
  expectStatus('bursar updates the ZWG rate', await put('/currencies/ZWG', B, { rate: 26.6 }), 200);

  let items = (await get('/fee-items', B)).data as any[];
  for (const it of [
    { name: 'Tuition', description: 'Core tuition fee', is_optional: false },
    { name: 'Levy', description: 'SDC levy', is_optional: false },
    { name: 'Building Fund', description: 'Infrastructure fund', is_optional: false },
    { name: 'Examination Fees', description: 'Grade 7 ZIMSEC exam fee', is_optional: false },
    { name: 'Sports Levy', description: 'Optional sports levy', is_optional: true },
  ]) if (!items.some((x) => x.name === it.name)) await post('/fee-items', B, it);
  items = (await get('/fee-items', B)).data as any[];
  const item = (n: string) => items.find((x) => x.name === n).id;
  check('5 fee items exist', ['Tuition', 'Levy', 'Building Fund', 'Examination Fees', 'Sports Levy'].every((n) => items.some((x) => x.name === n)));

  let structOk = 0, structTotal = 0;
  const tuition = (cn: string) => (cn.startsWith('ECD') ? 30 : /Grade [123]$/.test(cn) ? 45 : /Grade [456]$/.test(cn) ? 55 : 65);
  for (const [cn, cid] of classId) {
    for (const term of [t2, t3]) {
      const lines: [string, number][] = [['Tuition', tuition(cn)], ['Levy', 10], ['Building Fund', 5]];
      if (cn === 'Grade 7') lines.push(['Examination Fees', 12]);
      for (const [name, amt] of lines) { structTotal++; if ((await put(`/fee-items/structure/${term.id}/${cid}/${item(name)}`, B, { amount: amt })).status === 200) structOk++; }
    }
  }
  bulk('fee structure set for every class, Terms 2 and 3', structOk, structTotal);
  const struct = (await get(`/fee-items/structure/${t3.id}`, B)).data as any[];
  check('fee structure reads back', struct.length >= 28, `rows ${struct.length}`);

  let accounts = (await get('/accounts', B)).data as any[];
  for (const a of [{ name: 'CBZ School Account', type: 'bank', currency: 'USD', opening_balance: 500, account_no: '0123456789' }, { name: 'Ecocash Merchant', type: 'mobile', currency: 'USD', opening_balance: 0 }])
    if (!accounts.some((x) => x.name === a.name)) await post('/accounts', B, a);
  accounts = (await get('/accounts', B)).data as any[];
  const acct = (n: string) => accounts.find((x) => x.name === n).id;
  check('Main Cash, CBZ and Ecocash accounts exist', ['Main Cash', 'CBZ School Account', 'Ecocash Merchant'].every((n) => accounts.some((x) => x.name === n)));

  section('Bursary: student profiles, discounts, billing');
  const disc = (await get('/discounts', B)).data as any[];
  if (!disc.some((d) => d.name === 'Staff child 50%')) await post('/discounts', B, { name: 'Staff child 50%', type: 'percent', value: 50, fee_item_id: null });
  const discountId = ((await get('/discounts', B)).data as any[]).find((d) => d.name === 'Staff child 50%').id;
  const g4 = classId.get('Grade 4')!, g6 = classId.get('Grade 6')!;
  const staffKids = [students.get(g4)![0], students.get(g6)![1]];
  const rand = rng(77);
  let profOk = 0, profFail = '';
  for (const s of allStudents) {
    const staff = staffKids.some((k) => k.id === s.id);
    const last = s.name.split(' ').pop();
    const r = await put(`/student-profiles/${s.id}`, B, {
      category: staff ? 'staff_child' : 'day', discount_id: staff ? discountId : null,
      guardian_name: `Mr/Mrs ${last}`, guardian_phone: `+2637${7000000 + Math.floor(rand() * 2999999)}`, guardian_email: '',
      address: 'Chakari, Sanyati', family_code: '', gender: rand() > 0.5 ? 'M' : 'F', dob: '2016-03-15', notes: '',
    });
    if (r.status === 200) profOk++; else profFail ||= brief(r);
  }
  bulk('guardian profiles saved for all 45 students', profOk, 45, profFail);

  let billed = 0, billFail = '';
  for (const [, cid] of classId) {
    for (const [term, date] of [[t2, '2026-05-06'], [t3, '2026-09-02']] as const) {
      const r = await post('/billing/run', B, { term_id: term.id, class_id: cid, date });
      if (r.status === 200) billed += r.data.billed; else billFail ||= brief(r);
    }
  }
  const allInv = (await get('/invoices', B)).data as any[];
  const termInv = allInv.filter((i) => i.type === 'term' && i.status === 'active');
  check('every student has a Term 2 and a Term 3 invoice (90)', termInv.length === 90, `${termInv.length} term invoices ${billFail}`);
  const staffInv = termInv.find((i) => i.student_id === staffKids[0].id && i.term_id === t3.id);
  const fullInv = termInv.find((i) => i.student_id === students.get(g4)![1].id && i.term_id === t3.id);
  check('staff-child invoice is exactly half of a normal Grade 4 invoice', !!staffInv && !!fullInv && Math.abs(staffInv.total * 2 - fullInv.total) < 0.01, `staff ${staffInv?.total} vs full ${fullInv?.total}`);
  check('Grade 7 invoice includes the examination fee (65+10+5+12=92)', termInv.some((i) => i.term_id === t3.id && i.total === 92), 'no invoice with total 92');
  const rebill = await post('/billing/run', B, { term_id: t3.id, class_id: g4, date: '2026-09-02' });
  check('running billing twice does not double-bill', rebill.status === 200 && rebill.data.billed === 0, brief(rebill));
  const inv1 = (await get(`/invoices/${fullInv.id}`, B)).data;
  check('invoice detail has its line items', inv1.lines?.length === 3, brief({ status: 200, data: inv1.lines }));
  const pdf = await fetch(`${BASE}/invoices/${fullInv.id}/pdf`, { headers: { Authorization: `Bearer ${B}` } });
  check('invoice PDF downloads', pdf.status === 200 && (pdf.headers.get('content-type') || '').includes('pdf'), `status ${pdf.status}`);

  const existingPay = (await get('/payments', B)).data as any[];
  const freshFinance = existingPay.length === 0;
  const probeStudent = students.get(classId.get('Grade 3')!)![0];
  const chg = freshFinance ? await post('/billing/charge', B, { student_id: probeStudent.id, term_id: t3.id, lines: [{ fee_item_id: null, description: 'Lost library book', amount: 5 }], notes: 'Charge' }) : null;
  if (chg) expectStatus('bursar raises a one-off charge', chg, 201);
  if (freshFinance) expectStatus('bursar raises a credit note', await post('/billing/credit-note', B, { student_id: students.get(classId.get('Grade 5')!)![2].id, term_id: t3.id, lines: [{ fee_item_id: null, description: 'Fee waiver', amount: 10 }], notes: 'Credit' }), 201);
  if (chg && chg.status === 201) {
    const before = (await get(`/finance-students?class_id=${classId.get('Grade 3')}`, B)).data.find((s: any) => s.id === probeStudent.id).balance;
    expectStatus('bursar cancels the charge with a reason', await put(`/invoices/${chg.data.invoiceId}/cancel`, B, { reason: 'Book found' }), 200);
    const after = (await get(`/finance-students?class_id=${classId.get('Grade 3')}`, B)).data.find((s: any) => s.id === probeStudent.id).balance;
    check('cancelling the charge lowers the balance by 5', Math.abs(before - after - 5) < 0.01, `before ${before} after ${after}`);
    expectStatus('cancelling without a reason is rejected', await put(`/invoices/${allInv[0].id}/cancel`, B, {}), 400);
  }

  section('Bursary: receiving payments (USD cash, Ecocash, ZWG bank, swipe), reversals, receipts');
  let payOk = 0, payTotal = 0, payFail = '';
  if (freshFinance) {
    const pay = async (s: Person, termId: number, usd: number, method: string, date: string, extra: any = {}) => {
      payTotal++;
      const ref = method === 'cash' ? '' : `${method.toUpperCase()}-${s.id}-${termId}`;
      const accountId = method === 'cash' ? acct('Main Cash') : method === 'ecocash' ? acct('Ecocash Merchant') : acct('CBZ School Account');
      const zwg = extra.currency === 'ZWG';
      const r = await post('/payments', B, { student_id: s.id, term_id: termId, pay_date: date, amount_paid: zwg ? +(usd * 26.6).toFixed(2) : usd, currency: extra.currency || 'USD', fx_rate: zwg ? 26.6 : 1, method, reference: ref, account_id: accountId, notes: '' });
      if (r.status === 201) payOk++; else payFail ||= brief(r);
      return r;
    };
    const invTotal = (sid: number, tid: number) => termInv.find((i) => i.student_id === sid && i.term_id === tid)?.total || 0;
    for (const [, cid] of classId) {
      const kids = students.get(cid)!;
      // Term 2 (past): 3 paid in full, one half, one nothing (arrears)
      for (let k = 0; k < 3; k++) await pay(kids[k], t2.id, invTotal(kids[k].id, t2.id), k === 1 ? 'bank' : 'cash', '2026-05-20');
      await pay(kids[3], t2.id, invTotal(kids[3].id, t2.id) / 2, 'ecocash', '2026-06-10');
      // Term 3 (current): full cash / half ecocash / quarter ZWG bank / none / full swipe
      await pay(kids[0], t3.id, invTotal(kids[0].id, t3.id), 'cash', '2026-09-15');
      await pay(kids[1], t3.id, invTotal(kids[1].id, t3.id) / 2, 'ecocash', '2026-09-18');
      await pay(kids[2], t3.id, invTotal(kids[2].id, t3.id) / 4, 'bank', '2026-09-22', { currency: 'ZWG' });
      await pay(kids[4], t3.id, invTotal(kids[4].id, t3.id), 'swipe', ymd(new Date()));
    }
    bulk('payments recorded across cash / bank / ecocash / swipe / ZWG', payOk, payTotal, payFail);
  }
  const pays = (await get('/payments', B)).data as any[];
  check('payments list shows receipts (72 recorded)', pays.length >= 72 && pays.every((p) => p.receipt_no), `rows ${pays.length}`);
  const zwg = pays.find((p) => p.currency === 'ZWG');
  check('ZWG payment converts to USD at 26.6', !!zwg && Math.abs(zwg.amount - zwg.amount_paid / 26.6) < 0.01, JSON.stringify(zwg));
  const dupRef = pays.find((p) => p.method === 'ecocash');
  expectStatus('re-using an Ecocash reference is rejected', await post('/payments', B, { student_id: dupRef.student_id, term_id: dupRef.term_id, amount_paid: 1, method: 'ecocash', reference: dupRef.reference, account_id: acct('Ecocash Merchant') }), 400);
  expectStatus('zero amount is rejected', await post('/payments', B, { student_id: dupRef.student_id, term_id: dupRef.term_id, amount_paid: 0, method: 'cash' }), 400);
  const rp = pays.find((p) => p.method === 'cash' && p.term_id === t3.id && p.status === 'active');
  expectStatus('reversal without a reason is rejected', await put(`/payments/${rp.id}/reverse`, B, {}), 400);
  const rec = await fetch(`${BASE}/payments/${rp.id}/receipt.pdf`, { headers: { Authorization: `Bearer ${B}` } });
  check('receipt PDF downloads', rec.status === 200 && (rec.headers.get('content-type') || '').includes('pdf'), `status ${rec.status}`);
  if (freshFinance) {
    // Reverse once, and put the money back with a correct receipt (only on the first run, so re-runs don't pile up reversals).
    const balBefore = (await get('/finance-students', B)).data.find((s: any) => s.id === rp.student_id).balance;
    expectStatus('bursar reverses a payment with a reason', await put(`/payments/${rp.id}/reverse`, B, { reason: 'Banked to wrong child' }), 200);
    const balAfter = (await get('/finance-students', B)).data.find((s: any) => s.id === rp.student_id).balance;
    check('reversal puts the amount back on the balance', Math.abs(balAfter - balBefore - rp.amount) < 0.01, `before ${balBefore} after ${balAfter} amount ${rp.amount}`);
    expectStatus('reversing again is rejected', await put(`/payments/${rp.id}/reverse`, B, { reason: 'again' }), 400);
    expectStatus('bursar re-records the reversed payment correctly', await post('/payments', B, { student_id: rp.student_id, term_id: rp.term_id, pay_date: '2026-09-16', amount_paid: rp.amount_paid, currency: 'USD', fx_rate: 1, method: 'cash', account_id: acct('Main Cash') }), 201);
  }
  const lockT = await put(`/terms/${t2.id}/lock`, B, { locked: true });
  expectStatus('bursar locks Term 2', lockT, 200);
  expectStatus('a locked term refuses new payments', await post('/payments', B, { student_id: rp.student_id, term_id: t2.id, amount_paid: 1, method: 'cash' }), 400);
  expectStatus('bursar unlocks Term 2', await put(`/terms/${t2.id}/lock`, B, { locked: false }), 200);

  section('Bursary: expenses, accounts, transfers, ledger');
  let cats = (await get('/expense-categories', B)).data as any[];
  for (const n of ['Utilities', 'Stationery', 'Maintenance', 'Allowances', 'Transport']) if (!cats.some((c) => c.name === n)) await post('/expense-categories', B, { name: n });
  cats = (await get('/expense-categories', B)).data as any[];
  check('5 expense categories exist', ['Utilities', 'Stationery', 'Maintenance', 'Allowances', 'Transport'].every((n) => cats.some((c) => c.name === n)));
  const cat = (n: string) => cats.find((c) => c.name === n).id;
  const haveExp = (await get('/expenses', B)).data as any[];
  if (haveExp.length === 0) {
    const ex = [
      ['Utilities', 'ZESA', 'Electricity for September', 85, 'CBZ School Account', '2026-09-20'],
      ['Stationery', 'Kadoma Stationers', 'Chalk, exercise books, markers', 60, 'Main Cash', '2026-09-05'],
      ['Maintenance', 'Sanyati Hardware', 'Repair classroom windows', 120, 'CBZ School Account', '2026-09-25'],
      ['Allowances', 'Ground staff', 'Cleaning allowance', 40, 'Main Cash', '2026-10-01'],
      ['Transport', 'Chakari Transport', 'Sports day bus hire', 70, 'Main Cash', '2026-10-10'],
      ['Utilities', 'ZINWA', 'Water bill', 25, 'Ecocash Merchant', '2026-10-12'],
    ] as const;
    let exOk = 0;
    for (const [c, payee, desc, amount, a, date] of ex) if ((await post('/expenses', B, { exp_date: date, category_id: cat(c), account_id: acct(a), payee, description: desc, amount, reference: '' })).status === 201) exOk++;
    bulk('6 expense vouchers recorded', exOk, 6);
  }
  const exps = (await get('/expenses', B)).data as any[];
  check('expenses carry voucher numbers and category names', exps.length >= 6 && exps.every((x) => x.voucher_no) && exps.some((x) => x.category_name), brief({ status: 200, data: exps[0] }));
  expectStatus('expense detail loads', await get(`/expenses/${exps[0].id}`, B), 200);
  const cx = exps.find((x) => x.payee === 'ZINWA');
  if (cx && cx.status === 'active') {
    expectStatus('bursar cancels an expense with a reason', await put(`/expenses/${cx.id}/cancel`, B, { reason: 'Paid by the council instead' }), 200);
  }
  expectStatus('expense with no amount is rejected', await post('/expenses', B, { exp_date: '2026-10-01', account_id: acct('Main Cash') }), 400);
  if (((await get(`/accounts/${acct('CBZ School Account')}/ledger`, B)).data.rows as any[]).filter((r) => r.type.startsWith('transfer')).length === 0) {
    expectStatus('bursar banks $200 from Main Cash to CBZ', await post('/accounts/transfer', B, { tr_date: '2026-10-02', from_account: acct('Main Cash'), to_account: acct('CBZ School Account'), amount: 200, reference: 'DEP-0042', notes: 'Weekly banking' }), 201);
  }
  const ledger = (await get(`/accounts/${acct('CBZ School Account')}/ledger`, B)).data;
  const bal = (await get(`/accounts/${acct('CBZ School Account')}/balance`, B)).data.balance;
  check('ledger shows payments, expenses and the transfer', ledger.rows.some((r: any) => r.type === 'payment') && ledger.rows.some((r: any) => r.type === 'expense') && ledger.rows.some((r: any) => r.type === 'transfer_in'), brief({ status: 200, data: ledger.rows.map((r: any) => r.type) }));
  check('ledger running balance equals the account balance', Math.abs(ledger.rows[ledger.rows.length - 1].balance - bal) < 0.01, `ledger ${ledger.rows[ledger.rows.length - 1]?.balance} vs balance ${bal}`);
  // Independent expectation, computed from the payments/expenses/transfers rather than from the same SQL:
  // a USD account must grow by the USD value of each receipt, not by the raw ZWG figure.
  const cbzId = acct('CBZ School Account');
  const cbzPays = ((await get('/payments', B)).data as any[]).filter((p) => p.account_id === cbzId && p.status === 'active');
  const cbzExp = ((await get('/expenses', B)).data as any[]).filter((x) => x.account_id === cbzId && x.status === 'active');
  const expectedCbz = 500 + cbzPays.reduce((s, p) => s + p.amount, 0) - cbzExp.reduce((s, x) => s + x.amount, 0) + 200;
  check('USD account balance counts ZWG receipts at their USD value', Math.abs(expectedCbz - bal) < 0.01, `expected ${expectedCbz.toFixed(2)} (500 opening + USD value of ${cbzPays.length} receipts - expenses + 200 banked) but the account says ${bal.toFixed(2)}`);
  expectStatus('transfer to the same account is rejected', await post('/accounts/transfer', B, { tr_date: '2026-10-02', from_account: acct('Main Cash'), to_account: acct('Main Cash'), amount: 5 }), 400);

  section('Bursary: reminders, reports, exports');
  // Building a reminder list logs one 'pending' message per recipient, so only do it on the first run.
  if (freshFinance) {
    const rem = await post('/messages/bulk-reminder', B, { class_id: g4, min_balance: 1, template: 'Dear parent/guardian, {student} of {class} owes {balance}. Thank you — {school}' });
    check('reminder list is built with WhatsApp links and merged names', rem.status === 200 && rem.data.length > 0 && rem.data.every((r: any) => r.waUrl && r.message.includes(r.student_name)), brief(rem));
    if (rem.status === 200 && rem.data.length) expectStatus('bursar marks a reminder as sent', await put(`/messages/${rem.data[0].message_id}/sent`, B), 200);
  }
  check('message history lists reminders', ((await get('/messages', B)).data as any[]).some((m) => m.status === 'sent'));
  const t3Period = `from=${t3.start_date}&to=${t3.end_date}`; // the reports take any period; this is the whole of Term 3
  const rep: [string, string][] = [
    ['daily', `date=${ymd(new Date())}`], ['collections', t3Period], ['fee-items', t3Period], ['debtors', ''],
    ['aged', `asOf=${ymd(new Date())}`], ['income-expenditure', t3Period], ['methods', t3Period], ['class-list', `class_id=${g4}`],
  ];
  for (const [name, qs] of rep) {
    const r = await get(`/reports/${name}?${qs}`, B);
    const x = await fetch(`${BASE}/reports/${name}/export.xlsx?${qs}`, { headers: { Authorization: `Bearer ${B}` } });
    check(`report "${name}" loads and exports to Excel`, r.status === 200 && x.status === 200 && (x.headers.get('content-type') || '').includes('spreadsheet'), `json ${r.status}, xlsx ${x.status}`);
  }
  const debtors = (await get('/reports/debtors', B)).data as any[];
  check('debtors report lists students who owe, largest first', debtors.length > 10 && debtors.every((d, i) => i === 0 || debtors[i - 1].balance >= d.balance), `rows ${debtors.length}`);
  const methodsRep = (await get(`/reports/methods?${t3Period}`, B)).data as any[];
  const bankUsd = ((await get('/payments', B)).data as any[]).filter((p) => p.term_id === t3.id && p.method === 'bank' && p.status === 'active').reduce((sum, p) => sum + p.amount, 0);
  const bankRep = methodsRep.find((m) => m.method === 'bank')?.total ?? 0;
  check('payment-methods report totals ZWG bank receipts at their USD value', Math.abs(bankRep - bankUsd) < 0.01, `report says ${bankRep.toFixed(2)}, receipts are worth $${bankUsd.toFixed(2)}`);
  const coll = (await get(`/reports/collections?${t3Period}`, B)).data as any[];
  check('collections-by-class report covers 9 classes', coll.length === 9, `rows ${coll.length}`);
  const aged = (await get(`/reports/aged?asOf=${ymd(new Date())}`, B)).data as any[];
  check('aged arrears shows students with Term 2 balances', aged.length > 0, `rows ${aged.length}`);
  const roster = await get('/finance-students', B);
  check('bursar roster has 45 students with balances', roster.data.length === 45 && roster.data.every((s: any) => typeof s.balance === 'number'), `rows ${roster.data?.length}`);
  const bx = await fetch(`${BASE}/finance-students/export.xlsx`, { headers: { Authorization: `Bearer ${B}` } });
  check('roster exports to Excel', bx.status === 200, `status ${bx.status}`);

  section('Student fees view + bursar dashboard');
  const s0 = students.get(g4)![1];
  const myInvRes = (await get('/invoices/my', s0.token)).data, myPay = (await get('/payments/my', s0.token)).data as any[];
  const myInv = myInvRes.invoices as any[];
  check('student sees own invoices (with lines) and payments', myInv?.length >= 2 && myInv.every((i) => Array.isArray(i.lines)) && myPay.length >= 2, `invoices ${myInv?.length}, payments ${myPay.length}`);
  check("student's invoice balance matches the bursar view", Math.abs(myInvRes.balance - (await get('/finance-students', B)).data.find((s: any) => s.id === s0.id).balance) < 0.01, `student sees ${myInvRes.balance}`);
  const dS = (await get('/dashboard', s0.token)).data;
  const rosterBal = roster.data.find((s: any) => s.id === s0.id).balance;
  check('student dashboard fee balance equals the bursar view', Math.abs(dS.feeBalance - rosterBal) < 0.01, `student ${dS.feeBalance} vs bursar ${rosterBal}`);
  const dB = (await get('/dashboard', B)).data;
  check('bursar dashboard has collection figures', dB.collectedThisTerm > 0 && dB.debtorCount > 0 && dB.invoiceCount >= 90, JSON.stringify(dB));
  const rosterTotal = (roster.data as any[]).reduce((sum, s) => sum + s.balance, 0);
  check('dashboard "Outstanding Fees" equals the sum of every pupil\'s balance', Math.abs(dB.outstandingFees - rosterTotal) < 0.01, `dashboard ${dB.outstandingFees}, pupils add up to ${rosterTotal.toFixed(2)} (rows for deleted pupils?)`);
  const dA = (await get('/dashboard', A)).data;
  check('admin outstanding fees equals bursar outstanding fees', Math.abs(dA.outstandingFees - dB.outstandingFees) < 0.01, `${dA.outstandingFees} vs ${dB.outstandingFees}`);

  // ── The Bursary audit trail ──────────────────────────────
  section('Audit trail (Bursary changes are recorded, only the Administrator reads it, nobody can write to it)');
  const auditTotal = async () => ((await get('/audit?from=2000-01-01&to=2100-01-01', A)).data.total as number);
  const settle = () => new Promise((r) => setTimeout(r, 600)); // the line is written a moment after the answer
  const n0 = await auditTotal();
  const probe = await post('/payments', B, { student_id: s0.id, term_id: t3.id, pay_date: ymd(new Date()), amount_paid: 2, currency: 'USD', fx_rate: 1, method: 'cash', payer: 'Audit probe' });
  await post('/payments', B, { student_id: s0.id, term_id: t3.id, pay_date: ymd(new Date()), amount_paid: -1, currency: 'USD', method: 'cash' }); // refused: must not be recorded
  const undone = await put(`/payments/${probe.data.paymentId}/reverse`, B, { reason: 'Audit probe reversal' });
  await settle();
  const log = (await get('/audit?from=2000-01-01&to=2100-01-01', A)).data;
  check('a payment and its reversal add exactly two lines (a refused payment adds none)', probe.status === 201 && undone.status === 200 && log.total === n0 + 2, `before ${n0}, after ${log.total}`);
  const top = (log.rows as any[]).slice(0, 2);
  check('the lines say who did it, what, the receipt number and the reason given', top.some((l) => l.action === 'Reversed receipt' && l.user_role === 'bursary' && l.summary.includes(probe.data.receiptNo) && l.summary.includes('Audit probe reversal')) && top.some((l) => l.action === 'Received payment' && l.summary.includes(probe.data.receiptNo)), JSON.stringify(top.map((l) => l.summary)));
  expectStatus('the Bursar cannot read the audit trail', await get('/audit', B), 403);
  expectStatus('a pupil cannot read the audit trail', await get('/audit', s0.token), 403);
  for (const m of ['POST', 'PUT', 'DELETE']) expectStatus(`${m} on the audit trail does not exist, even for the Administrator`, await call(m, '/audit/1', A, {}), 404);
  expectStatus('the SQL tool refuses to delete audit lines', await post('/admin/sql', A, { sql: 'DELETE FROM audit_log' }), 403);
  expectStatus('the SQL tool refuses to change them', await post('/admin/sql', A, { sql: 'UPDATE audit_log SET amount = 0' }), 403);
  expectStatus('the SQL tool can still read them', await post('/admin/sql', A, { sql: 'SELECT COUNT(*) AS n FROM audit_log' }), 200);
  check('the audit lines are all still there after those attempts', (await auditTotal()) === n0 + 2);

  // ── Backups ──────────────────────────────────────────────
  section('Backups (automatic copies, download reminder)');
  expectStatus('the Bursar cannot see the backups', await get('/admin/backups', B), 403);
  const made = await post('/admin/backups/now', A);
  const copy = (made.data.copies as any[] | undefined)?.[0];
  check("\"Make a copy now\" produces today's automatic copy", made.status === 200 && /^school_portal-\d{4}-\d{2}-\d{2}\.db$/.test(copy?.name || '') && copy.size > 10000, brief(made));
  const file = await fetch(BASE + '/admin/backups/' + copy.name, { headers: { Authorization: 'Bearer ' + A } });
  const head = Buffer.from(await file.arrayBuffer()).subarray(0, 15).toString();
  check('an automatic copy downloads as a real SQLite database file', file.status === 200 && head === 'SQLite format 3', `status ${file.status}, starts "${head}"`);
  expectStatus('a made-up copy name is refused', await get('/admin/backups/school_portal-2000-01-01.db', A), 404);
  expectStatus('a path cannot be smuggled in as a copy name', await get('/admin/backups/..%2F..%2Fschool_portal.db', A), 404);
  const exported = await fetch(BASE + '/admin/db/export', { headers: { Authorization: 'Bearer ' + A } });
  const after = (await get('/admin/backups', A)).data;
  check('downloading the database is remembered, so the reminder clears', exported.status === 200 && after.daysSince === 0 && after.stale === false, JSON.stringify({ s: exported.status, d: after.daysSince, st: after.stale }));
  const dash = (await get('/dashboard', A)).data;
  check('the Administrator dashboard carries the backup age', dash.backup && dash.backup.daysSince === 0 && dash.backup.stale === false, JSON.stringify(dash.backup));
  check('the Bursar dashboard does not', (await get('/dashboard', B)).data.backup === undefined);

  // ── Deleting people, closing accounts, and the database check ─────────────
  section('Records are protected (no deleting history, closing accounts, database check)');
  const fk = (await post('/admin/sql', A, { sql: 'PRAGMA foreign_keys' })).data.rows?.[0]?.foreign_keys;
  check('the database keeps its link rules switched on after the portal has been saving data', fk === 1, 'foreign_keys = ' + fk);
  expectStatus('the Bursar cannot run the database check', await get('/admin/db/integrity', B), 403);
  const health = await get('/admin/db/integrity', A);
  check('the database check runs and says whether link checking is on', health.status === 200 && health.data.foreignKeysOn === true && health.data.integrity === 'ok', brief(health));
  check('the check finds no broken money records (bills or receipts without a pupil)', !(health.data.problems as any[]).some((p) => p.table === 'invoices' || p.table === 'fee_payments'), JSON.stringify(health.data.problems));

  const owed = (await get('/finance-students', B)).data.find((p: any) => p.balance > 0);
  const refusedPupil = await call('DELETE', '/admin/users/' + owed.id, A);
  check('a pupil who has bills or receipts cannot be deleted', refusedPupil.status === 409 && /invoices|receipts/.test(refusedPupil.data.message), brief(refusedPupil));
  check('...and is still there afterwards', (await get('/finance-students', B)).data.some((p: any) => p.id === owed.id));
  const markedTeacher = allStudents.length ? (await get('/admin/users', A)).data.find((u: any) => u.role === 'teacher') : null;
  const refusedTeacher = await call('DELETE', '/admin/users/' + markedTeacher.id, A);
  check('a teacher who has entered marks cannot be deleted', refusedTeacher.status === 409 && /marks/.test(refusedTeacher.data.message), brief(refusedTeacher));
  const adminId = (await get('/admin/users', A)).data.find((u: any) => u.role === 'admin').id;
  expectStatus('you cannot delete your own account', await call('DELETE', '/admin/users/' + adminId, A), 400);
  const bursarId = (await get('/admin/users', A)).data.find((u: any) => u.role === 'bursary').id;
  expectStatus('the only Bursar cannot be deleted', await call('DELETE', '/admin/users/' + bursarId, A), 400);
  expectStatus('the only Bursar cannot be closed', await post('/admin/users/' + bursarId + '/close', A), 400);
  const anyClass = [...classId.values()][0];
  const refusedClass = await call('DELETE', '/admin/classes/' + anyClass, A);
  check('a class that still has pupils cannot be deleted', refusedClass.status === 409 && /pupils/.test(refusedClass.data.message), brief(refusedClass));

  // A throw-away pupil: close, try to log in, reopen, delete
  const probeEmail = 'closeprobe@chakari.school';
  const old = (await get('/admin/users', A)).data.find((u: any) => u.email === probeEmail);
  if (old) await call('DELETE', '/admin/users/' + old.id, A);
  const made2 = await post('/admin/users', A, { name: 'Close Probe', email: probeEmail, password: 'Probe2026pw', role: 'student', class_id: anyClass });
  const closeProbe = (await get('/admin/users', A)).data.find((u: any) => u.email === probeEmail);
  const probeLogin = await post('/auth/login', undefined, { email: probeEmail, password: 'Probe2026pw' });
  check('a throw-away pupil can log in', made2.status === 201 && closeProbe && probeLogin.status === 200, brief(made2) + ' ' + brief(probeLogin));
  const closed = await post('/admin/users/' + closeProbe.id + '/close', A);
  check('closing an account says their history is kept', closed.status === 200 && /kept/.test(closed.data.message), brief(closed));
  expectStatus('a closed account can no longer log in', await post('/auth/login', undefined, { email: probeEmail, password: 'Probe2026pw' }), 403);
  expectStatus('and its old log-in token stops working at once', await get('/auth/me', probeLogin.data.token), 401);
  check('the closed pupil is out of the class list but still in the Users list, marked closed', (await get('/admin/users', A)).data.find((u: any) => u.id === closeProbe.id)?.archived === 1);
  await post('/admin/users/' + closeProbe.id + '/reopen', A);
  expectStatus('a reopened account can log in again', await post('/auth/login', undefined, { email: probeEmail, password: 'Probe2026pw' }), 200);
  expectStatus('someone with no records can be deleted', await call('DELETE', '/admin/users/' + closeProbe.id, A), 200);

  // An empty class can be removed
  const probeClass = await post('/admin/classes', A, { name: 'Probe Class', grade: 'X', section: 'P' });
  expectStatus('an empty class can be created', probeClass, 201);
  const pc = (await get('/admin/classes', A)).data.find((c: any) => c.name === 'Probe Class');
  expectStatus('and deleted again', await call('DELETE', '/admin/classes/' + pc.id, A), 200);

  // ── Class comparison ─────────────────────────────────────
  section('Class comparison (head\'s end-of-term view)');
  const q = `term=${encodeURIComponent('Term 1')}&academic_year=${YEAR}`;
  expectStatus('the Bursar cannot open the class comparison', await get('/results/class-comparison?' + q, B), 403);
  expectStatus('a pupil cannot open the class comparison', await get('/results/class-comparison?' + q, allStudents[0].token), 403);
  expectStatus('a term that does not exist is refused', await get('/results/class-comparison?term=Term%209&academic_year=' + YEAR, A), 400);
  const cmp = await get('/results/class-comparison?' + q, A);
  check('it lists all 9 classes and all 7 learning areas for each', cmp.status === 200 && cmp.data.classes.length === 9 && cmp.data.classes.every((c: any) => Object.keys(c.areas).length === 7), brief(cmp));
  const first = cmp.data.classes.find((c: any) => c.id === anyClass);
  const kids = students.get(anyClass)!;
  const cardAverages = [] as number[];
  for (const k of kids) cardAverages.push((await get(`/results/report-card/${k.id}?term=${encodeURIComponent('Term 1')}&academic_year=${YEAR}`, A)).data.average);
  const expected = Math.round((cardAverages.reduce((a, b) => a + b, 0) / cardAverages.length) * 10) / 10;
  check("a class's average equals the average of its pupils' own report cards", Math.abs(first.average - expected) <= 0.11, `comparison ${first.average}, report cards ${expected}`);
  check('the school average is the average of the classes weighted by pupils marked', Math.abs(cmp.data.school.average - cmp.data.classes.reduce((t: number, c: any) => t + (c.average ?? 0) * c.marked, 0) / cmp.data.school.marked) <= 0.11, JSON.stringify(cmp.data.school));
  check('attendance is a percentage (or blank when no register was taken)', cmp.data.classes.every((c: any) => c.attendance.rate === null || (c.attendance.rate >= 0 && c.attendance.rate <= 100)));
  const cmpT2 = await get(`/results/class-comparison?term=${encodeURIComponent('Term 2')}&academic_year=${YEAR}`, A);
  const c2 = cmpT2.data.classes.find((c: any) => c.id === anyClass);
  check('Term 2 is compared with Term 1: change = Term 2 average - Term 1 average', cmpT2.data.previous.term === 'Term 1' && Math.abs(c2.change - (c2.average - first.average)) <= 0.11, `T2 ${c2.average}, T1 ${first.average}, change ${c2.change}`);
  const empty = await get(`/results/class-comparison?term=${encodeURIComponent('Term 3')}&academic_year=${YEAR}`, A);
  check('a term with no marks gives blanks, not errors', empty.status === 200 && empty.data.classes.every((c: any) => c.average === null) && empty.data.school.average === null);

  // ── Grade 7 exam results ─────────────────────────────────
  section('Grade 7 exam results (Administrator and the Grade 7 teacher only)');
  const g7Teacher = (await post('/auth/login', undefined, { email: 'josephine.zhou0@chakari.school', password: 'Teacher@123' })).data.token as string;
  const otherTeacher = (await post('/auth/login', undefined, { email: 'rumbidzai.moyo0@chakari.school', password: 'Teacher@123' })).data.token as string;
  const g7 = students.get(classId.get('Grade 7')!)!;
  const ecd = students.get(classId.get('ECD A')!)![0];
  const examYear = '2031';   // a year no sample data uses, so this section can always clean up after itself
  expectStatus('a teacher of another class cannot open the Grade 7 results', await get('/exams/grade7?year=' + examYear, otherTeacher), 403);
  expectStatus('a pupil cannot open them', await get('/exams/grade7?year=' + examYear, g7[0].token), 403);
  expectStatus('the Bursar cannot open them', await get('/exams/grade7?year=' + examYear, B), 403);
  const opened = await get('/exams/grade7?year=' + examYear, g7Teacher);
  check('the Grade 7 teacher sees the 5 Grade 7 pupils and the 7 learning areas', opened.status === 200 && opened.data.pupils.length === 5 && opened.data.areas.length === 7, brief(opened));
  const bad = (entries: any[], who = g7Teacher) => put('/exams/grade7', who, { academic_year: examYear, entries });
  expectStatus('a mark above 100 is refused', await bad([{ student_id: g7[0].id, area: 'Mathematics', mark: 101, unit: 1 }]), 400);
  expectStatus('a unit of 10 is refused', await bad([{ student_id: g7[0].id, area: 'Mathematics', mark: 50, unit: 10 }]), 400);
  expectStatus('a half unit is refused', await bad([{ student_id: g7[0].id, area: 'Mathematics', mark: 50, unit: 2.5 }]), 400);
  expectStatus('a made-up learning area is refused', await bad([{ student_id: g7[0].id, area: 'Home Economics', mark: 50, unit: 3 }]), 400);
  expectStatus('a pupil from another class is refused', await bad([{ student_id: ecd.id, area: 'Mathematics', mark: 50, unit: 3 }]), 400);
  expectStatus('the other class\'s teacher cannot save results', await bad([{ student_id: g7[0].id, area: 'Mathematics', mark: 50, unit: 3 }], otherTeacher), 403);
  const saved = await bad([
    { student_id: g7[0].id, area: 'Mathematics', mark: 80, unit: 2 }, { student_id: g7[1].id, area: 'Mathematics', mark: 60, unit: 4 },
    { student_id: g7[0].id, area: 'English Language', mark: 70, unit: 3 }, { student_id: g7[2].id, area: 'Mathematics', mark: '', unit: 6 },
  ]);
  check('good results are saved', saved.status === 200 && saved.data.saved === 4, brief(saved));
  const read = (await get('/exams/grade7?year=' + examYear, A)).data;
  const p0 = read.pupils.find((p: any) => p.id === g7[0].id);
  const maths = read.summary.find((x: any) => x.area === 'Mathematics');
  check("a pupil's average mark and total of units are worked out", p0.averageMark === 75 && p0.totalUnits === 5 && p0.areasEntered === 2, JSON.stringify({ avg: p0.averageMark, units: p0.totalUnits }));
  check("the class summary counts who sat, the average and the units", maths.sat === 3 && maths.averageMark === 70 && maths.highest === 80 && maths.lowest === 60 && maths.distribution[2] === 1 && maths.distribution[4] === 1 && maths.distribution[6] === 1, JSON.stringify(maths));
  check('a unit with no mark is kept (the mark stays blank)', read.pupils.find((p: any) => p.id === g7[2].id).results['Mathematics'].mark === null);
  const cleared = await bad(read.pupils.flatMap((p: any) => Object.keys(p.results).map((a) => ({ student_id: p.id, area: a, mark: '', unit: '' }))), A);
  check('clearing a result removes it', cleared.status === 200 && cleared.data.cleared === 4 && (await get('/exams/grade7?year=' + examYear, A)).data.pupils.every((p: any) => p.areasEntered === 0), brief(cleared));


  // ── Text messages when no SMS service is set up (the normal state) ───
  section('Text messages: automatic SMS is off until a service is set up');
  const smsCfg = await get('/messages/config', B);
  check('the Bursar is told automatic SMS is switched off', smsCfg.status === 200 && smsCfg.data.smsEnabled === false, brief(smsCfg));
  const anyMsg = (await get('/messages', B)).data[0];
  const refusedSms = anyMsg ? await post('/messages/' + anyMsg.id + '/send-sms', B) : { status: 400, data: { message: 'not set up (no message to try)' } } as Res;
  check('trying to send one anyway is refused with a clear explanation', refusedSms.status === 400 && /not set up/i.test(refusedSms.data.message), brief(refusedSms));
  expectStatus('sending a batch is refused too', await post('/messages/send-sms-batch', B, { ids: [1] }), 400);
  expectStatus('a pupil cannot ask about it', await get('/messages/config', allStudents[0].token), 403);

  // ── Parents ──────────────────────────────────────────────
  section('Parents (see only their own children; nothing else)');
  const pupil = (name: string) => allStudents.find((p) => p.name === name)!;
  const tendai = pupil('Tendai Moyo'), netsai = pupil('Netsai Moyo'), rudo = pupil('Rudo Dube');
  const existing = (await get('/parents', A)).data as any[];
  const ensureParent = async (name: string, email: string, pKids: number[]) => {
    if (!existing.some((p) => p.email === email)) expectStatus(`parent account for ${name} is created`, await post('/parents', A, { name, email, password: 'Parent@123', student_ids: pKids, relationship: 'Parent' }), 201);
    return (await post('/auth/login', undefined, { email, password: 'Parent@123' })).data.token as string;
  };
  const moyo = await ensureParent('Mr and Mrs Moyo', 'parent.moyo@chakari.school', [tendai.id, netsai.id]);   // two children, two classes
  const dube = await ensureParent('Mrs Dube', 'parent.dube@chakari.school', [rudo.id]);                      // one child
  check('both parents can log in', !!moyo && !!dube);

  // who may manage parent accounts
  for (const [who, tok] of [['the Bursar', B], ['a pupil', tendai.token], ['a parent', moyo]] as [string, string][]) expectStatus(`${who} cannot list or create parent accounts`, await get('/parents', tok), 403);
  expectStatus('a parent account needs at least one pupil', await post('/parents', A, { name: 'No Child', email: 'nochild@chakari.school', password: 'Parent@123', student_ids: [] }), 400);
  expectStatus('it needs a real email address', await post('/parents', A, { name: 'Bad Email', email: 'not-an-email', password: 'Parent@123', student_ids: [tendai.id] }), 400);
  expectStatus('the email cannot already belong to someone', await post('/parents', A, { name: 'Copy', email: 'parent.moyo@chakari.school', password: 'Parent@123', student_ids: [tendai.id] }), 409);
  expectStatus('a weak first password is refused', await post('/parents', A, { name: 'Weak', email: 'weak@chakari.school', password: '123', student_ids: [tendai.id] }), 400);
  const tempParent = await post('/parents', A, { name: 'Temp Probe', email: 'tempprobe@chakari.school', student_ids: [tendai.id] });
  check('without a password a temporary one is made and shown once', tempParent.status === 201 && /^[A-Za-z0-9]{4}-\d{4}-[A-Za-z0-9]{3}$/.test(tempParent.data.temporary_password || ''), brief(tempParent));
  const tempLogin = await post('/auth/login', undefined, { email: 'tempprobe@chakari.school', password: tempParent.data.temporary_password });
  check('that parent must choose their own password before anything else', tempLogin.data.user?.must_change_password === 1 && (await get('/parents/children', tempLogin.data.token)).status === 403);
  await call('DELETE', '/admin/users/' + tempParent.data.id, A);

  // what a parent sees
  const pKids = (await get('/parents/children', moyo)).data as any[];
  const bursarView = (await get('/finance-students', B)).data as any[];
  check('a parent sees exactly their own children, with the fee balance the Bursar sees', pKids.length === 2 && pKids.every((k) => Math.abs(k.balance - bursarView.find((p) => p.id === k.id).balance) < 0.01) && pKids.some((k) => k.name === 'Tendai Moyo') && pKids.some((k) => k.name === 'Netsai Moyo'), JSON.stringify(pKids.map((k) => [k.name, k.balance])));
  const pDash = (await get('/dashboard', moyo)).data;
  check('the parent dashboard lists the children', pDash.role === 'parent' && pDash.children.length === 2, JSON.stringify(pDash).slice(0, 160));

  // each pupil page through a child
  const asChild = (path: string, kid: any, tok = moyo) => get(path + (path.includes('?') ? '&' : '?') + 'child=' + kid.id, tok);
  const ownResults = (await get('/results/my', tendai.token)).data as any[];
  const viaParent = await asChild('/results/my', tendai);
  check("results through a parent are exactly the child's own results", viaParent.status === 200 && viaParent.data.length === ownResults.length && ownResults.length > 0, brief(viaParent));
  expectStatus('with two children the parent must say which one', await get('/results/my', moyo), 400);
  expectStatus("another family's child is refused", await asChild('/results/my', rudo), 403);
  expectStatus('a made-up child number is refused', await get('/results/my?child=999999', moyo), 403);
  check('a parent with one child needs no choosing', (await get('/results/my', dube)).status === 200);
  const cardUrl = (p: any) => `/results/report-card/${p.id}?term=${encodeURIComponent('Term 1')}&academic_year=${YEAR}`;
  const card = await get(cardUrl(tendai), moyo);
  check("a parent can open their child's report card", card.status === 200 && card.data.student.name === 'Tendai Moyo' && card.data.core_count === 6, brief(card));
  expectStatus("but not another family's", await get(cardUrl(rudo), moyo), 403);
  const pOwnInv = (await get('/invoices/my', tendai.token)).data;
  const kidInv = (await asChild('/invoices/my', tendai)).data;
  check("fees through a parent match the child's own: invoices and balance", kidInv.invoices.length === pOwnInv.invoices.length && Math.abs(kidInv.balance - pOwnInv.balance) < 0.01);
  check("and the child's receipts", (await asChild('/payments/my', tendai)).data.length === ((await get('/payments/my', tendai.token)).data as any[]).length);
  const stm = await asChild('/statements/my', tendai);
  check('the dated statement opens', stm.status === 200 && Array.isArray(stm.data.lines), brief(stm));
  const stmPdf = await fetch(BASE + '/statements/my/pdf?child=' + tendai.id, { headers: { Authorization: 'Bearer ' + moyo } });
  check('and prints as a PDF', stmPdf.status === 200 && (stmPdf.headers.get('content-type') || '').includes('pdf'), String(stmPdf.status));
  const ownPay = ((await get('/payments/my', tendai.token)).data as any[])[0];
  const rcpt = ownPay ? await fetch(BASE + '/payments/' + ownPay.id + '/receipt.pdf', { headers: { Authorization: 'Bearer ' + moyo } }) : null;
  check("a parent can print their child's receipt", !!rcpt && rcpt.status === 200 && (rcpt.headers.get('content-type') || '').includes('pdf'), String(rcpt?.status));
  const otherPay = ((await get('/payments', B)).data as any[]).find((p) => p.student_id === rudo.id);
  expectStatus("but not another family's receipt", await get('/payments/' + otherPay.id + '/receipt.pdf', moyo), 403);
  const otherInv = ((await get('/invoices', B)).data as any[]).find((i) => i.student_id === rudo.id);
  expectStatus("or another family's invoice", await get('/invoices/' + otherInv.id, moyo), 403);
  expectStatus("or another family's invoice as a PDF", await get('/invoices/' + otherInv.id + '/pdf', moyo), 403);
  expectStatus("the child's attendance opens", await asChild('/attendance/my', tendai), 200);
  expectStatus('notices open', await get('/notices', moyo), 200);

  // what a parent must NOT be able to do
  const forbidden: [string, Res][] = [
    ['list users', await get('/admin/users', moyo)], ['see the bursar roster', await get('/finance-students', moyo)], ['read the audit trail', await get('/audit', moyo)],
    ['take a payment', await post('/payments', moyo, { student_id: tendai.id, amount_paid: 1 })], ['enter marks', await post('/results', moyo, { student_id: tendai.id })],
    ["see a teacher's marks list", await get('/results/entered', moyo)], ["open a pupil's homework", await get('/homework/my', moyo)], ["open a pupil's quizzes", await get('/quizzes/available', moyo)],
    ['open the Grade 7 results', await get('/exams/grade7?year=2026', moyo)], ['run SQL', await post('/admin/sql', moyo, { sql: 'select 1' })], ['read the class comparison', await get('/results/class-comparison?term=Term%201&academic_year=2026', moyo)],
  ];
  for (const [what, r] of forbidden) check(`a parent cannot ${what}`, r.status === 403, brief(r));

  // linking and unlinking
  const moyoId = (await get('/parents', A)).data.find((p: any) => p.email === 'parent.moyo@chakari.school').id;
  expectStatus('the Administrator can link another pupil', await post(`/parents/${moyoId}/children`, A, { student_id: rudo.id }), 200);
  check('the parent now sees that child too', ((await get('/parents/children', moyo)).data as any[]).length === 3 && (await asChild('/results/my', rudo)).status === 200);
  expectStatus('and can unlink them again', await call('DELETE', `/parents/${moyoId}/children/${rudo.id}`, A), 200);
  check('the parent no longer sees that child', (await asChild('/results/my', rudo)).status === 403);
  expectStatus('the last child cannot be unlinked', await call('DELETE', `/parents/${(await get('/parents', A)).data.find((p: any) => p.email === 'parent.dube@chakari.school').id}/children/${rudo.id}`, A), 400);
  expectStatus("a pupil's own endpoints still refuse a parent's token for other pupils", await get('/payments/' + otherPay.id, moyo), 403);
}

// ═════════════════════════════════════════════════════════════════════════════
// Permission matrix + ownership probes (probe items are created, tried, and removed)
// ═════════════════════════════════════════════════════════════════════════════

async function permissions(A: string, B: string, teachers: Person[], students: Map<number, Person[]>, subj: Map<number, Map<string, number>>, quizByClass: Map<number, any[]>) {
  section('Permissions: who may NOT do what');
  const T0 = teachers[0], T1 = teachers[1];
  const S0 = students.get(T0.classId)![0], S1 = students.get(T1.classId)![0];
  const denied: [string, Res][] = [
    ['student cannot list users', await get('/admin/users', S0.token)],
    ['teacher cannot list users', await get('/admin/users', T0.token)],
    ['bursar cannot list users', await get('/admin/users', B)],
    ['student cannot run SQL', await post('/admin/sql', S0.token, { sql: 'select 1' })],
    ['teacher cannot run SQL', await post('/admin/sql', T0.token, { sql: 'select 1' })],
    ['bursar cannot run SQL', await post('/admin/sql', B, { sql: 'select 1' })],
    ['bursar cannot download the database', await get('/admin/db/export', B)],
    ['student cannot see all results', await get('/results/all', S0.token)],
    ['bursar cannot see results', await get('/results/all', B)],
    ['bursar cannot see student stats', await get(`/results/student-stats/${S0.id}`, B)],
    ['student cannot see another student\'s stats', await get(`/results/student-stats/${S1.id}`, S0.token)],
    ['student cannot read the teacher register', await get('/attendance', S0.token)],
    ['bursar cannot mark attendance', await post('/attendance', B, { class_id: T0.classId, date: '2026-01-01', records: [] })],
    ['student cannot see all timetables', await get('/timetables/all', S0.token)],
    ['teacher cannot publish timetables', await post(`/timetables/publish/${T0.classId}`, T0.token)],
    ['student cannot assign homework', await post('/homework', S0.token, { class_id: T0.classId, subject_id: 1, title: 'x', due_date: '2026-12-01' })],
    ['student cannot create quizzes', await post('/quizzes', S0.token, { class_id: T0.classId, subject_id: 1, title: 'x', questions: [] })],
    ['teacher cannot take a quiz', await post(`/quizzes/${quizByClass.get(T0.classId)![0].id}/attempt`, T0.token, { answers: [] })],
    ['teacher cannot record payments', await post('/payments', T0.token, { student_id: S0.id, term_id: 1, amount_paid: 5, method: 'cash' })],
    ['student cannot record payments', await post('/payments', S0.token, { student_id: S0.id, term_id: 1, amount_paid: 5, method: 'cash' })],
    ['teacher cannot see finance roster', await get('/finance-students', T0.token)],
    ['student cannot see debtors', await get('/reports/debtors', S0.token)],
    ['teacher cannot see invoices list', await get('/invoices', T0.token)],
    ['teacher cannot bill a class', await post('/billing/run', T0.token, { term_id: 1, class_id: T0.classId })],
    ['admin cannot receive payments (bursar only)', await post('/payments', A, { student_id: S0.id, term_id: 1, amount_paid: 5, method: 'cash' })],
    ['student cannot delete sports', await del('/sports/1', S0.token)],
    ['teacher cannot delete sports', await del('/sports/1', T0.token)],
    ['bursar cannot access the homework student list', await get('/homework/my', B)],
    ['bursar cannot access courses', await get('/courses/enrolled', B)],
    ['bursar cannot read school notices', await get('/notices', B)],
    ["a student cannot open another student's report card", await get(`/results/report-card/${S1.id}?term=Term%201&academic_year=2026`, S0.token)],
    ["a teacher cannot open another class's report card", await get(`/results/report-card/${S1.id}?term=Term%201&academic_year=2026`, T0.token)],
    ["a teacher cannot open another class's pupil stats", await get(`/results/student-stats/${S1.id}`, T0.token)],
    ["a teacher cannot mark another class's register", await post('/attendance', T0.token, { class_id: T1.classId, date: '1999-01-01', records: [] })],
    ['a teacher cannot propose lessons for another class', await post('/timetables', T0.token, { class_id: T1.classId, subject_id: subj.get(T1.classId)!.get('Mathematics'), day: 'Monday', start_time: '06:00', end_time: '06:05' })],
    ['a teacher cannot set homework for another class', await post('/homework', T0.token, { class_id: T1.classId, subject_id: subj.get(T1.classId)!.get('Mathematics'), title: 'PROBE x', due_date: '2026-12-31' })],
    ['a teacher cannot create a quiz for another class', await post('/quizzes', T0.token, { class_id: T1.classId, subject_id: subj.get(T1.classId)!.get('Mathematics'), title: 'PROBE x', questions: [] })],
    ['a teacher cannot create a course for another class', await post('/courses', T0.token, { name: 'PROBE x', class_id: T1.classId })],
    ["a teacher cannot read another teacher's quiz attempts", await get(`/quizzes/${quizByClass.get(T1.classId)![0].id}/attempts`, T0.token)],
    ["a teacher cannot read another teacher's homework submissions", await get(`/homework/submissions/${(await get('/homework/my-classes', T1.token)).data[0].id}`, T0.token)],
  ];
  for (const [name, r] of denied) check(name, r.status === 403 || r.status === 401, brief(r));

  section('Permissions: cross-class and cross-teacher ownership (throw-away probe items)');
  // Notices: the bursar should not broadcast to the school
  const nb = await post('/notices', B, { title: 'PROBE bursar notice', content: 'probe', target_role: 'all' });
  check('bursar cannot post school notices', nb.status === 403, brief(nb));
  if (nb.status === 201) {
    const list = (await get('/notices', A)).data as any[];
    for (const n of list.filter((x) => x.title === 'PROBE bursar notice')) await del(`/notices/${n.id}`, A);
  }

  // Quiz taken/read by a student of another class
  const probeQuiz = await post('/quizzes', T1.token, { class_id: T1.classId, subject_id: subj.get(T1.classId)!.get('Mathematics'), title: 'PROBE quiz', description: '', duration_minutes: 5, questions: [{ question: 'p?', options: ['a', 'b'], correct_answer: 'a' }] });
  if (probeQuiz.status === 201) {
    const qid = probeQuiz.data.quizId;
    const read = await get(`/quizzes/${qid}/questions`, S0.token);
    check("a student cannot open another class's quiz questions", read.status === 403, brief(read));
    const att = await post(`/quizzes/${qid}/attempt`, S0.token, { answers: [] });
    check("a student cannot attempt another class's quiz", att.status === 403, brief(att));
    const ownRead = await get(`/quizzes/${qid}/questions`, S1.token);
    check('a student CAN open their own class quiz', ownRead.status === 200 && ownRead.data.questions?.length === 1, brief(ownRead));
    const own = await post(`/quizzes/${qid}/attempt`, S1.token, { answers: [] });
    const again = await post(`/quizzes/${qid}/attempt`, S1.token, { answers: [] });
    check('a student cannot attempt the same quiz twice', own.status === 200 && again.status === 400, `first ${own.status}, second -> ${brief(again)}`);
    const ownAttempts = await get(`/quizzes/${qid}/attempts`, T1.token);
    check('the owning teacher sees exactly one attempt', ownAttempts.status === 200 && ownAttempts.data.length === 1, brief(ownAttempts));
    check('attempt with a malformed body is rejected', (await post(`/quizzes/${qid}/attempt`, S1.token, { answers: 'nope' })).status === 400);
    const others = await del(`/quizzes/${qid}`, T0.token);
    check("a teacher cannot delete another teacher's quiz", others.status === 403, brief(others));
    await del(`/quizzes/${qid}`, T1.token);
  } else check('probe quiz created', false, brief(probeQuiz));

  // Homework: submit across classes, grade/delete across teachers
  const probeHw = await post('/homework', T1.token, { class_id: T1.classId, subject_id: subj.get(T1.classId)!.get('Mathematics'), title: 'PROBE homework', description: '', due_date: '2026-12-31' });
  if (probeHw.status === 201) {
    const hw = ((await get('/homework/my-classes', T1.token)).data as any[]).find((h) => h.title === 'PROBE homework');
    const sub = await call('POST', `/homework/submit/${hw.id}`, S0.token, (() => { const f = new FormData(); f.append('notes', 'wrong class'); return f; })());
    check("a student cannot submit to another class's homework", sub.status === 403, brief(sub));
    const ok = await call('POST', `/homework/submit/${hw.id}`, S1.token, (() => { const f = new FormData(); f.append('notes', 'mine'); return f; })());
    check('a student CAN submit homework for their own class', ok.status === 201, brief(ok));
    const uploadDir = path.join(__dirname, '../uploads/homework');
    const filesBefore = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0;
    const withFile = new FormData(); withFile.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'second-try.png');
    const dupWithFile = await call('POST', `/homework/submit/${hw.id}`, S1.token, withFile);
    const filesAfter = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0;
    check('a rejected submission leaves no uploaded file behind', dupWithFile.status === 400 && filesAfter === filesBefore, `status ${dupWithFile.status}, files ${filesBefore} -> ${filesAfter}`);
    const crossFile = new FormData(); crossFile.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'wrong-class.png');
    await call('POST', `/homework/submit/${hw.id}`, S0.token, crossFile);
    check('a cross-class submission leaves no uploaded file behind', (fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0) === filesBefore, 'file was kept');
    const subs = (await get(`/homework/submissions/${hw.id}`, T1.token)).data.submissions as any[];
    check('the owning teacher sees the submission', subs.length === 1 && subs[0].student_id === S1.id, `submissions: ${subs.length}`);
    if (ok.status === 201 && subs.length) {
      const mine = await put(`/homework/grade/${subs[0].id}`, T1.token, { grade: 8, feedback: 'ok' });
      check('the owning teacher CAN grade it', mine.status === 200, brief(mine));
      const badGrade = await put(`/homework/grade/${subs[0].id}`, T1.token, { grade: 'abc' });
      check('a non-numeric grade is rejected', badGrade.status === 400, brief(badGrade));
      const g = await put(`/homework/grade/${subs.find((s) => s.student_id === S1.id).id}`, T0.token, { grade: 1, feedback: 'not my class' });
      check("a teacher cannot grade another teacher's submissions", g.status === 403, brief(g));
    }
    const d = await del(`/homework/${hw.id}`, T0.token);
    check("a teacher cannot delete another teacher's homework", d.status === 403, brief(d));
    await del(`/homework/${hw.id}`, T1.token);
  } else check('probe homework created', false, brief(probeHw));

  // Results: a teacher writing marks for a pupil in someone else's class
  const rr = await post('/results', T1.token, { student_id: S0.id, subject_name: 'Mathematics', term: 'Term 1', academic_year: '1999', coursework: 1, test_score: 1, exam: 1, grade: 'E', remarks: 'PROBE' });
  check("a teacher cannot enter results for another class's pupil", rr.status === 403, brief(rr));
  if (rr.status === 200 || rr.status === 201) {
    const row = ((await get(`/results/all?student_id=${S0.id}`, A)).data as any[]).find((r) => r.academic_year === '1999');
    if (row) await del(`/results/${row.id}`, A);
  }

  // A teacher CAN still use their own class's timetable
  const lesson = await post('/timetables', T0.token, { class_id: T0.classId, subject_id: subj.get(T0.classId)!.get('Mathematics'), day: 'Friday', start_time: '13:00', end_time: '13:40', room: 'PROBE' });
  check('a teacher CAN propose a lesson for their own class', lesson.status === 201, brief(lesson));
  if (lesson.status === 201) {
    const probeLesson = ((await get(`/timetables/proposals/${T0.classId}`, A)).data as any[]).find((e) => e.room === 'PROBE');
    if (probeLesson) await del(`/timetables/${probeLesson.id}`, A);
  }
  const noDate = await post('/attendance', T0.token, { class_id: T0.classId, records: [] });
  check('a register without a date is rejected', noDate.status === 400, brief(noDate));

  // Editing a result owned by another teacher (identical values are sent, so an allowed edit is a no-op)
  const t1Row = ((await get('/results/entered', T1.token)).data as any[])[0];
  if (t1Row) {
    const e = await put(`/results/${t1Row.id}`, T0.token, { coursework: t1Row.coursework, test_score: t1Row.test_score, exam: t1Row.exam, grade: t1Row.grade, remarks: t1Row.remarks });
    check("a teacher cannot edit another teacher's result", e.status === 403, brief(e));
  }

  // Courses
  const pc = await post('/courses', T1.token, { name: 'PROBE course', description: '', class_id: T1.classId });
  if (pc.status === 201) {
    const course = ((await get('/courses/my', T1.token)).data as any[]).find((c) => c.name === 'PROBE course');
    const d = await del(`/courses/${course.id}`, T0.token);
    check("a teacher cannot delete another teacher's course", d.status === 403, brief(d));
    await del(`/courses/${course.id}`, T1.token);
  }

  // The database does not enforce foreign keys (sql.js resets the pragma on every save), so deleting the
  // probe quiz/homework above leaves their attempts, answers, questions and submissions behind. Sweep them.
  for (const sql of [
    'DELETE FROM homework_submissions WHERE homework_id NOT IN (SELECT id FROM homework)',
    'DELETE FROM quiz_answers WHERE attempt_id NOT IN (SELECT id FROM quiz_attempts) OR question_id NOT IN (SELECT id FROM quiz_questions)',
    'DELETE FROM quiz_attempts WHERE quiz_id NOT IN (SELECT id FROM quizzes)',
    'DELETE FROM quiz_questions WHERE quiz_id NOT IN (SELECT id FROM quizzes)',
    'DELETE FROM quiz_answers WHERE attempt_id NOT IN (SELECT id FROM quiz_attempts)',
  ]) await post('/admin/sql', A, { sql });
}

// ═════════════════════════════════════════════════════════════════════════════

function finish(started: number) {
  const failed = results.filter((r) => !r.ok);
  const byArea = new Map<string, { pass: number; fail: number }>();
  for (const r of results) {
    const a = byArea.get(r.area) || { pass: 0, fail: 0 };
    r.ok ? a.pass++ : a.fail++;
    byArea.set(r.area, a);
  }
  console.log('\n══════════════════ SUMMARY ══════════════════');
  for (const [a, v] of byArea) console.log(`${v.fail ? 'FAIL' : ' ok '}  ${a.padEnd(78)} ${v.pass}/${v.pass + v.fail}`);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  if (failed.length) {
    console.log('\nFAILURES:');
    for (const f of failed) console.log(` - [${f.area}] ${f.name}\n     ${f.detail}`);
  }
  console.log('\nSample logins (password in brackets):');
  console.log(`  Admin   punhamasiwa@gmail.com [1234]`);
  console.log(`  Bursar  tascarmasiwa@gmail.com [12345678]`);
  for (const t of TEACHERS) console.log(`  Teacher ${t.cls.padEnd(8)} ${email(t.first, t.last, 0)} [${TEACHER_PASSWORD}]`);
  console.log(`  Students: ${email(FIRST[0], LAST[0], 1)} ... [${STUDENT_PASSWORD}]  (5 per class, 45 total)`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('Harness crashed:', e); process.exit(2); });
