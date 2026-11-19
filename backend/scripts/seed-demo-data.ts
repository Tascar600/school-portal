/**
 * Demo top-up: turns the sample school into a bigger, busier one for showing people.
 *
 *   cd backend
 *   npm run seed:sample      (first: 9 teachers, 5 pupils per class, the bursary)
 *   npm run seed:demo        (then this one)
 *
 * Adds 5 more pupils to every class (10 per class, 90 in all), 15 parent accounts with brothers and sisters,
 * two more weeks of register, 6 more homework tasks and 4 more quizzes per class with hand-ins and marks, Terms 1 and 2
 * results for the new pupils, Grade 7 examination marks, 14 more notices, sports teams, fees (bills, part payments,
 * arrears, one-off charges, fee waivers, expenses, transfers, reminders).
 *
 * Safe to run again: every step looks for what is already there. Most easily started with `npm run demo`, which keeps the
 * demo school apart from your real database. Refuses to run against anything but localhost.
 * (Do not run seed:sample again on a school that has had this added: it counts exactly 5 pupils per class.)
 */

const BASE = (process.env.BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  console.error(`Refusing to fill a non-local server (${BASE}).`);
  process.exit(1);
}
const YEAR = '2026';
const TEACHER_PASSWORD = 'Teacher@123';
const STUDENT_PASSWORD = 'Student@123';
const PARENT_PASSWORD = 'Parent@123';

// ── tiny HTTP + report helpers (the same shape as seed-sample-data.ts) ──────

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
  try { data = JSON.parse(text); } catch { /* plain text */ }
  return { status: r.status, data };
}
const get = (p: string, t?: string) => call('GET', p, t);
const post = (p: string, t?: string, b?: any) => call('POST', p, t, b ?? {});
const put = (p: string, t?: string, b?: any) => call('PUT', p, t, b ?? {});

const results: { area: string; name: string; ok: boolean; detail: string }[] = [];
let area = '';
function section(a: string) { area = a; console.log(`\n== ${a} ==`); }
function check(name: string, ok: boolean, detail = '') {
  results.push({ area, name, ok, detail: ok ? '' : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
}
const brief = (r: Res) => `HTTP ${r.status} ${typeof r.data === 'string' ? r.data.slice(0, 120) : JSON.stringify(r.data).slice(0, 160)}`;
/** One line for a loop of many calls: how many worked, and the first thing that went wrong. */
function tally(name: string, ok: number, total: number, firstError = '') {
  if (total === 0) { console.log(`skip  ${name} (already there)`); return; }
  check(`${name} (${ok}/${total})`, ok === total, firstError);
}

/** A repeatable stand-in for chance: the same words always give the same number in [0, 1), so a second run decides the same way. */
function h(...parts: (string | number)[]): number {
  let x = 2166136261;
  for (const ch of parts.join('|')) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); }
  x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13; x = Math.imul(x, 3266489917); x ^= x >>> 16;
  return ((x >>> 0) % 100000) / 100000;
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const money = (n: number) => Math.round(n * 100) / 100;
const email = (first: string, last: string, n: number) => `${first}.${last}${n}@chakari.school`.toLowerCase();
const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// ── cast ─────────────────────────────────────────────────────────────────────

const CLASS_ORDER = ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];
const AGE: Record<string, number> = { 'ECD A': 4, 'ECD B': 5, 'Grade 1': 6, 'Grade 2': 7, 'Grade 3': 8, 'Grade 4': 9, 'Grade 5': 10, 'Grade 6': 11, 'Grade 7': 12 };
const SUBJECTS = ['Indigenous Language', 'English Language', 'Mathematics', 'Science and Technology', 'Social Science', 'Physical Education and Art'];
const EXTRA_AREA = 'ICT and Robotics';
const isLower = (className: string) => CLASS_ORDER.indexOf(className) < 4; // ECD A to Grade 2

// Five new pupils for each class, in class order. Some share a surname with a pupil in another class: brothers and sisters.
const NEW_PUPILS: [string, string, string][] = [
  // ECD A
  ['Tariro', 'Chirwa', 'F'], ['Takunda', 'Nyathi', 'M'], ['Rutendo', 'Madziva', 'F'], ['Tawanda', 'Sithole', 'M'], ['Anotida', 'Hove', 'F'],
  // ECD B
  ['Tichaona', 'Mudzingwa', 'M'], ['Mercy', 'Khumalo', 'F'], ['Tonderai', 'Shumba', 'M'], ['Ruvarashe', 'Mlambo', 'F'], ['Wellington', 'Muchemwa', 'M'],
  // Grade 1
  ['Natasha', 'Mashingaidze', 'F'], ['Admire', 'Zvobgo', 'M'], ['Yeukai', 'Rusike', 'F'], ['Tinashe', 'Chikomo', 'M'], ['Sharon', 'Mapuranga', 'F'],
  // Grade 2
  ['Kudakwashe', 'Sithole', 'M'], ['Latoya', 'Nyathi', 'F'], ['Prosper', 'Chirwa', 'M'], ['Charmaine', 'Madziva', 'F'], ['Nigel', 'Hove', 'M'],
  // Grade 3
  ['Patience', 'Khumalo', 'F'], ['Lovemore', 'Shumba', 'M'], ['Primrose', 'Mlambo', 'F'], ['Tendekai', 'Muchemwa', 'M'], ['Tracy', 'Mashingaidze', 'F'],
  // Grade 4
  ['Clever', 'Zvobgo', 'M'], ['Eunice', 'Rusike', 'F'], ['Blessed', 'Chikomo', 'M'], ['Nomalanga', 'Mapuranga', 'F'], ['Ryan', 'Mudzingwa', 'M'],
  // Grade 5
  ['Thando', 'Khumalo', 'F'], ['Themba', 'Ncube', 'M'], ['Zodwa', 'Dube', 'F'], ['Dumisani', 'Sibanda', 'M'], ['Busisiwe', 'Moyo', 'F'],
  // Grade 6
  ['Vusumuzi', 'Mpofu', 'M'], ['Nkululeko', 'Ndlovu', 'M'], ['Ntombi', 'Banda', 'F'], ['Alois', 'Makoni', 'M'], ['Chantelle', 'Gumbo', 'F'],
  // Grade 7
  ['Brian', 'Marufu', 'M'], ['Cleopas', 'Tshuma', 'M'], ['Kuziva', 'Zimunya', 'F'], ['Esther', 'Chuma', 'F'], ['Joshua', 'Chigumba', 'M'],
];
const NEW_FIRST_NUMBER = 46; // the sample school's 45 pupils are numbered 1 to 45 in their log in emails

const FAMILIES: { name: string; email: string; relationship: string; kids: string[] }[] = [
  { name: 'Mr and Mrs Chirwa', email: 'parent.chirwa@chakari.school', relationship: 'Parent', kids: ['Tariro Chirwa', 'Prosper Chirwa'] },
  { name: 'Mrs Sithole', email: 'parent.sithole@chakari.school', relationship: 'Parent', kids: ['Tawanda Sithole', 'Kudakwashe Sithole'] },
  { name: 'Mr Nyathi', email: 'parent.nyathi@chakari.school', relationship: 'Parent', kids: ['Takunda Nyathi', 'Latoya Nyathi'] },
  { name: 'Mrs Madziva', email: 'parent.madziva@chakari.school', relationship: 'Guardian', kids: ['Rutendo Madziva', 'Charmaine Madziva'] },
  { name: 'Mr and Mrs Hove', email: 'parent.hove@chakari.school', relationship: 'Parent', kids: ['Anotida Hove', 'Nigel Hove'] },
  { name: 'Mrs Khumalo', email: 'parent.khumalo@chakari.school', relationship: 'Parent', kids: ['Mercy Khumalo', 'Patience Khumalo', 'Thando Khumalo'] }, // three children, three classes
  { name: 'Mr Mashingaidze', email: 'parent.mashingaidze@chakari.school', relationship: 'Parent', kids: ['Natasha Mashingaidze', 'Tracy Mashingaidze'] },
  { name: 'Mrs Shumba', email: 'parent.shumba@chakari.school', relationship: 'Grandparent', kids: ['Tonderai Shumba', 'Lovemore Shumba'] },
  { name: 'Mr and Mrs Mlambo', email: 'parent.mlambo@chakari.school', relationship: 'Parent', kids: ['Ruvarashe Mlambo', 'Primrose Mlambo'] },
  { name: 'Mrs Zvobgo', email: 'parent.zvobgo@chakari.school', relationship: 'Parent', kids: ['Admire Zvobgo', 'Clever Zvobgo'] },
  { name: 'Mr Rusike', email: 'parent.rusike@chakari.school', relationship: 'Parent', kids: ['Yeukai Rusike', 'Eunice Rusike'] },
  { name: 'Mrs Mudzingwa', email: 'parent.mudzingwa@chakari.school', relationship: 'Aunt', kids: ['Tichaona Mudzingwa', 'Ryan Mudzingwa'] },
  { name: 'Mr Chikomo', email: 'parent.chikomo@chakari.school', relationship: 'Parent', kids: ['Tinashe Chikomo', 'Blessed Chikomo'] },
  { name: 'Mrs Mapuranga', email: 'parent.mapuranga@chakari.school', relationship: 'Parent', kids: ['Sharon Mapuranga', 'Nomalanga Mapuranga'] },
  { name: 'Mr Muchemwa', email: 'parent.muchemwa@chakari.school', relationship: 'Parent', kids: ['Wellington Muchemwa', 'Tendekai Muchemwa'] },
];

interface Person { id: number; name: string; first: string; last: string; email: string; token: string; classId: number; className: string; isNew: boolean }

const ability = (p: { email: string }) => 0.45 + h(p.email, 'ability') * 0.5; // 0.45 to 0.95
function statusOn(p: Person, date: string): string {
  const absent = 0.02 + h(p.email, 'habit') ** 2 * 0.25; // most pupils are rarely away, a few often
  const r = h(p.email, date);
  return r < absent ? 'absent' : r < absent + 0.07 ? 'late' : r < absent + 0.1 ? 'excused' : 'present';
}

// ── homework, quizzes, notices ───────────────────────────────────────────────

const HW_NEW = [
  { subject: 'Indigenous Language', due: -7, title: 'Write about my family', lower: 'Draw your family and say the name of everyone in the picture.', upper: 'Write six sentences in your home language about your family and the people who live with you.' },
  { subject: 'Mathematics', due: -1, title: 'Times tables and counting practice', lower: 'Count from 1 to 50 out loud and write the numbers 1 to 20 in your book.', upper: 'Practise the 6, 7 and 8 times tables and answer the ten questions on page 42.' },
  { subject: 'English Language', due: 4, title: 'Reading and spelling', lower: 'Read the story on page 5 with a grown-up and learn to spell the five words on the board.', upper: 'Read the passage on page 18 and answer questions 1 to 6 in full sentences.' },
  { subject: 'Social Science', due: 2, title: 'My home area', lower: 'Draw the place where you live and name two things you can see near your home.', upper: 'Draw a simple map of your home area and label the school, the clinic, the shops and the nearest road.' },
  { subject: 'ICT and Robotics', due: 6, title: 'Parts of a computer', lower: 'Draw a computer and colour the screen, the keyboard and the mouse.', upper: 'List five parts of a computer and write one sentence about what each part does.' },
  { subject: 'Physical Education and Art', due: 14, title: 'My favourite sport', lower: 'Draw your favourite game and colour it in.', upper: 'Draw your favourite sport and write three sentences about why you enjoy it.' },
];
const hwTitle = (t: { subject: string; title: string }) => `${t.subject}: ${t.title}`;
const HW_NOTES = ['Done, thank you teacher.', 'My mother helped me check it.', 'Finished.', 'I did all the questions.', 'Please see my work.'];
const feedbackFor = (g: number) => (g >= 9 ? 'Excellent work!' : g >= 7 ? 'Good effort, well done.' : g >= 5 ? 'Fair. Look again at the questions you missed.' : 'Please see me and we will go through this together.');

type Q = { question: string; options: string[]; correct_answer: string };
const q = (question: string, options: string[], correct_answer: string): Q => ({ question, options, correct_answer });
const QUIZ_BANKS: Record<'lower' | 'upper', { subject: string; title: string; description: string; questions: Q[] }[]> = {
  lower: [
    { subject: 'Science and Technology', title: 'Science and Technology Quiz', description: 'Animals, plants and our bodies.', questions: [
      q('Which of these is an animal?', ['Chair', 'Dog', 'Stone', 'Table'], 'Dog'),
      q('What do plants need to grow?', ['Water and sunlight', 'Plastic', 'Sand only', 'Paper'], 'Water and sunlight'),
      q('Which part of the body do we use to see?', ['Ears', 'Eyes', 'Nose', 'Hands'], 'Eyes'),
      q('Which animal gives us milk?', ['Cow', 'Snake', 'Frog', 'Fish'], 'Cow'),
      q('What colour is the sky on a clear day?', ['Blue', 'Red', 'Green', 'Black'], 'Blue'),
    ] },
    { subject: 'English Language', title: 'English Language Quiz', description: 'Letters, words and opposites.', questions: [
      q('Which word starts with the letter B?', ['Apple', 'Ball', 'Cat', 'Dog'], 'Ball'),
      q('Which word rhymes with "cat"?', ['Hat', 'Dog', 'Sun', 'Pen'], 'Hat'),
      q('What is the opposite of "big"?', ['Small', 'Tall', 'Long', 'Fat'], 'Small'),
      q('Which of these is a naming word?', ['Run', 'Tree', 'Quickly', 'Happy'], 'Tree'),
      q('How many letters are in the word "sun"?', ['2', '3', '4', '5'], '3'),
    ] },
    { subject: 'ICT and Robotics', title: 'ICT and Robotics Quiz', description: 'Computers and the things we use with them.', questions: [
      q('Which one do we use to type?', ['Keyboard', 'Spoon', 'Pencil', 'Shoe'], 'Keyboard'),
      q('Which part shows the pictures on a computer?', ['Screen', 'Mouse', 'Keyboard', 'Cable'], 'Screen'),
      q('Which device do we click with?', ['Mouse', 'Printer', 'Speaker', 'Screen'], 'Mouse'),
      q('Which device do we use to make a phone call?', ['Phone', 'Book', 'Spoon', 'Ball'], 'Phone'),
      q('A printer puts words and pictures on ...', ['Paper', 'Water', 'Wood', 'Cloth'], 'Paper'),
    ] },
    { subject: 'Mathematics', title: 'Mathematics Quiz: Number Practice', description: 'Counting and small sums.', questions: [
      q('How many fingers are on two hands?', ['5', '10', '15', '20'], '10'),
      q('What number comes after 7?', ['6', '8', '9', '10'], '8'),
      q('What is 2 + 3?', ['4', '5', '6', '7'], '5'),
      q('Which shape has 3 sides?', ['Circle', 'Square', 'Triangle', 'Rectangle'], 'Triangle'),
      q('What is 10 - 4?', ['5', '6', '7', '8'], '6'),
    ] },
  ],
  upper: [
    { subject: 'Science and Technology', title: 'Science and Technology Quiz', description: 'Plants, matter and the human body.', questions: [
      q('Which gas do plants take in to make their food?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 'Carbon dioxide'),
      q('Which state of matter has a fixed shape?', ['Solid', 'Liquid', 'Gas', 'Steam'], 'Solid'),
      q('At what temperature does water boil at sea level?', ['50 °C', '80 °C', '100 °C', '150 °C'], '100 °C'),
      q('Which organ pumps blood around the body?', ['Lungs', 'Heart', 'Liver', 'Kidney'], 'Heart'),
      q('Which is the closest star to Earth?', ['Moon', 'Sun', 'Mars', 'Sirius'], 'Sun'),
    ] },
    { subject: 'English Language', title: 'English Language Quiz', description: 'Grammar and vocabulary.', questions: [
      q('Choose the correct sentence.', ['She go to school.', 'She goes to school.', 'She going to school.', 'She gone to school.'], 'She goes to school.'),
      q('What is the plural of "child"?', ['Childs', 'Childes', 'Children', 'Childrens'], 'Children'),
      q('Which word means the same as "happy"?', ['Sad', 'Joyful', 'Angry', 'Tired'], 'Joyful'),
      q('Which of these words is an adverb?', ['Quickly', 'Quick', 'Run', 'Table'], 'Quickly'),
      q('What is the past tense of "write"?', ['Writed', 'Wrote', 'Writes', 'Writing'], 'Wrote'),
    ] },
    { subject: 'ICT and Robotics', title: 'ICT and Robotics Quiz', description: 'Computer basics.', questions: [
      q('What does CPU stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Control Panel Unit'], 'Central Processing Unit'),
      q('Which of these is an output device?', ['Printer', 'Keyboard', 'Mouse', 'Scanner'], 'Printer'),
      q('Which of these is a web browser?', ['Chrome', 'Excel', 'Paint', 'Notepad'], 'Chrome'),
      q('What does "www" stand for?', ['World Wide Web', 'World Wide Wire', 'Web With Words', 'Wide World Web'], 'World Wide Web'),
      q('Which key deletes the character before the cursor?', ['Backspace', 'Enter', 'Shift', 'Tab'], 'Backspace'),
    ] },
    { subject: 'Mathematics', title: 'Mathematics Quiz: Number Practice', description: 'Times tables, fractions and percentages.', questions: [
      q('What is 7 × 8?', ['54', '56', '58', '64'], '56'),
      q('What is 1/2 + 1/4?', ['3/4', '2/6', '1/8', '1/6'], '3/4'),
      q('What is 15% of 200?', ['15', '20', '30', '45'], '30'),
      q('What is the perimeter of a square with sides of 6 cm?', ['12 cm', '24 cm', '36 cm', '18 cm'], '24 cm'),
      q('What is 144 ÷ 12?', ['10', '11', '12', '14'], '12'),
    ] },
  ],
};
// Answer key for every quiz question the sample school can contain: the two quizzes the first seed made, and the four above.
const KEY = new Map<string, string>();
for (let ci = 0; ci < 9; ci++) for (let i = 1; i <= 5; i++) { const a = i + ci, b = i + 1; KEY.set(`What is ${a} + ${b}?`, String(a + b)); }
for (const [qs, ans] of [['What is the capital city of Zimbabwe?', 'Harare'], ['Which famous waterfall is on the Zambezi River in Zimbabwe?', 'Victoria Falls'], ['Which ancient stone city gave Zimbabwe its name?', 'Great Zimbabwe'], ['In which year did Zimbabwe gain independence?', '1980'], ['How many provinces does Zimbabwe have?', '10']]) KEY.set(qs, ans);
for (const level of [QUIZ_BANKS.lower, QUIZ_BANKS.upper]) for (const quiz of level) for (const x of quiz.questions) KEY.set(x.question, x.correct_answer);
const DEMO_QUIZ_TITLES = new Set(QUIZ_BANKS.lower.map((x) => x.title));

const NOTICES: { by: 'admin' | number; to: 'all' | 'teachers' | 'students'; title: string; content: string; daysAgo: number }[] = [
  { by: 'admin', to: 'all', daysAgo: 20, title: 'Term 3 examination timetable', content: 'End of term examinations run from Monday 16 to Friday 27 November. Pupils must bring a pen, a pencil and a ruler. The timetable for each class is on the Timetable page.' },
  { by: 'admin', to: 'all', daysAgo: 17, title: 'Parents meeting on Thursday 19 November', content: 'Parents and guardians are invited to meet the class teachers on Thursday 19 November from 2pm to 5pm in the classrooms.' },
  { by: 'admin', to: 'all', daysAgo: 14, title: 'Term 3 fees: please clear your balance', content: 'Please clear any Term 3 balance with the Bursar before the examinations begin. Payments are accepted in USD cash, EcoCash, bank deposit and by swipe. Ask the Bursar for your receipt.' },
  { by: 'admin', to: 'all', daysAgo: 11, title: 'School uniform reminder', content: 'All pupils must come to school in full uniform, including the school badge and black shoes, from Monday.' },
  { by: 'admin', to: 'all', daysAgo: 6, title: 'Closing day and report cards', content: 'Term 3 closes on Friday 4 December. Report cards can be opened in the portal once all marks have been entered.' },
  { by: 'admin', to: 'teachers', daysAgo: 9, title: 'Deadline for Term 3 marks', content: 'Please enter all Term 3 marks by Friday 27 November so that report cards can be printed on time.' },
  { by: 'admin', to: 'teachers', daysAgo: 4, title: 'Register reminder', content: 'Please mark the register before 9am every morning. The head checks the attendance figures each Friday.' },
  { by: 'admin', to: 'students', daysAgo: 12, title: 'Library week', content: 'Library week starts next Monday. Bring a book you have read and tell your class about it.' },
  { by: 'admin', to: 'students', daysAgo: 5, title: 'Athletics trials this Friday', content: 'Inter-house athletics trials are this Friday after break. Wear your sports kit and bring water.' },
  { by: 8, to: 'students', daysAgo: 8, title: 'Grade 7 revision classes', content: 'Revision classes for Grade 7 run every day after lessons until the examinations. Bring your past papers.' },
  { by: 7, to: 'students', daysAgo: 7, title: 'Grade 6 art project', content: 'Please bring old magazines, glue and scissors on Wednesday for our art project.' },
  { by: 5, to: 'students', daysAgo: 3, title: 'Grade 4 class trip permission slips', content: 'Permission slips for the class trip must be signed by a parent and returned by Friday.' },
  { by: 2, to: 'students', daysAgo: 10, title: 'Grade 1 reading books', content: 'Reading books go home on Fridays. Please read with a grown-up and return the book on Monday.' },
  { by: 0, to: 'students', daysAgo: 2, title: 'ECD A show and tell', content: 'On Wednesday each child may bring one small toy or picture to show the class.' },
];

// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  const started = Date.now();
  const health = await get('/health').catch(() => null);
  if (!health || health.status !== 200) { console.error(`Backend not reachable at ${BASE}. Start it first.`); process.exit(1); }

  section('Sign-in');
  const adminLogin = await post('/auth/login', undefined, { email: 'punhamasiwa@gmail.com', password: '1234' });
  const bursarLogin = await post('/auth/login', undefined, { email: 'tascarmasiwa@gmail.com', password: '12345678' });
  if (adminLogin.status !== 200 || bursarLogin.status !== 200) {
    console.error('Could not log in as the Administrator and the Bursar. Start the portal with FIRST_LOGIN_PASSWORD_CHANGE=off on a school that has had `npm run seed:sample`.');
    process.exit(1);
  }
  const A = adminLogin.data.token as string;
  const B = bursarLogin.data.token as string;
  const classes: any[] = (await get('/admin/classes', A)).data;
  const classId = new Map<string, number>(classes.map((c) => [c.name, c.id]));
  const className = new Map<number, string>(classes.map((c) => [c.id, c.name]));
  const users = (await get('/admin/users', A)).data as any[];

  const teachers = new Map<number, Person>(); // by class id
  for (const u of users.filter((x) => x.role === 'teacher' && !x.archived)) {
    const l = await post('/auth/login', undefined, { email: u.email, password: TEACHER_PASSWORD });
    if (l.status === 200) teachers.set(u.class_id, { id: u.id, name: u.name, first: '', last: '', email: u.email, token: l.data.token, classId: u.class_id, className: className.get(u.class_id)!, isNew: false });
  }
  check('the sample school is there (9 teachers can log in)', teachers.size === 9, `${teachers.size} teachers; run "npm run seed:sample" first`);
  if (teachers.size !== 9) { finish(started, null); return; }

  // ── 1. More pupils ───────────────────────────────────────
  section('Pupils: 10 in every class');
  const known = new Map<string, any>(users.map((u) => [u.email, u]));
  const newEmails = new Set<string>();
  const students = new Map<number, Person[]>(CLASS_ORDER.map((cn) => [classId.get(cn)!, []]));
  const byName = new Map<string, Person>();
  let created = 0, ensured = 0, pupilFail = '';
  const ensurePupil = async (first: string, last: string, mail: string, cid: number, isNew: boolean) => {
    if (!known.has(mail)) {
      const c = await post('/admin/users', A, { first_name: first, last_name: last, role: 'student', class_id: cid });
      if (c.status !== 201 || !c.data.reg_number) { pupilFail ||= `create ${mail}: ${brief(c)}`; return; }
      const a = await post('/auth/activate', undefined, { student_number: c.data.reg_number, email: mail, password: STUDENT_PASSWORD });
      if (a.status !== 200) { pupilFail ||= `activate ${mail}: ${brief(a)}`; return; }
      created++;
      const person: Person = { id: a.data.user.id, name: a.data.user.name, first, last, email: mail, token: a.data.token, classId: cid, className: className.get(cid)!, isNew };
      students.get(cid)!.push(person); byName.set(person.name, person);
      ensured++;
      return;
    }
    const l = await post('/auth/login', undefined, { email: mail, password: STUDENT_PASSWORD });
    if (l.status !== 200) { pupilFail ||= `login ${mail}: ${brief(l)}`; return; }
    const u = known.get(mail);
    const [f, ...rest] = String(u.name).split(' ');
    const person: Person = { id: u.id, name: u.name, first: f, last: rest.join(' '), email: mail, token: l.data.token, classId: cid, className: className.get(cid)!, isNew };
    students.get(cid)!.push(person); byName.set(person.name, person);
    ensured++;
  };
  NEW_PUPILS.forEach(([first, last], i) => newEmails.add(email(first, last, NEW_FIRST_NUMBER + i)));
  for (const u of users.filter((x) => x.role === 'student' && !x.archived && !newEmails.has(x.email))) await ensurePupil('', '', u.email, u.class_id, false);
  for (let i = 0; i < NEW_PUPILS.length; i++) {
    const [first, last] = NEW_PUPILS[i];
    await ensurePupil(first, last, email(first, last, NEW_FIRST_NUMBER + i), classId.get(CLASS_ORDER[Math.floor(i / 5)])!, true);
  }
  for (const list of students.values()) list.sort((x, y) => x.id - y.id);
  tally('90 pupils set up', ensured, 90, pupilFail);
  console.log(`      (${created} created, ${ensured - created} already existed)`);
  for (const cn of CLASS_ORDER) {
    const n = students.get(classId.get(cn)!)!.length;
    if (n !== 10) check(`${cn} has 10 pupils`, false, `has ${n}`);
  }
  if ([...students.values()].some((l) => l.length !== 10)) { console.error('Some pupils could not be set up; stopping.'); finish(started, null); return; }
  const all = [...students.values()].flat();
  const people = (cn: string) => students.get(classId.get(cn)!)!;

  // ── 2. Fees set-up for the new pupils ────────────────────
  section('Fees: profiles, discounts, bills');
  const terms = (await get('/terms', B)).data as any[];
  const t2 = terms.find((t) => t.year === YEAR && t.term_no === 2), t3 = terms.find((t) => t.year === YEAR && t.term_no === 3);
  if (!t2 || !t3) { check('Terms 2 and 3 of 2026 exist', false, 'run npm run seed:sample first'); finish(started, null); return; }
  const discounts = (await get('/discounts', B)).data as any[];
  const freshExtras = !discounts.some((d) => d.name === 'Sibling 10%'); // the one-off extras below are done only once
  if (freshExtras) await post('/discounts', B, { name: 'Sibling 10%', type: 'percent', value: 10, fee_item_id: null });
  const disc = (await get('/discounts', B)).data as any[];
  const siblingId = disc.find((d) => d.name === 'Sibling 10%')?.id, staffId = disc.find((d) => d.name === 'Staff child 50%')?.id;
  check('the "Sibling 10%" and "Staff child 50%" discounts exist', !!siblingId && !!staffId);

  const familyOf = new Map<string, { code: string; index: number }>();
  for (const f of FAMILIES) f.kids.forEach((k, index) => familyOf.set(k, { code: 'F-' + f.email.split('.')[1].split('@')[0].toUpperCase(), index }));
  const staffKids = new Set(['Esther Chuma', 'Zodwa Dube']);
  const STREETS = ['Chakari, Sanyati', 'Hillside, Kadoma', 'Eiffel Flats', 'Rimuka, Kadoma', 'Sanyati Growth Point'];
  const guardianOf = new Map<number, string>();
  let profOk = 0, profFail = '', profTotal = 0;
  for (const p of all) {
    const cur = (await get(`/student-profiles/${p.id}`, B)).data;
    let patch: Record<string, any> | null = null;
    if (p.isNew) {
      if (cur.guardian_name) continue; // saved on an earlier run; do not undo anything changed since
      const fam = familyOf.get(p.name);
      const staff = staffKids.has(p.name);
      const sibling = !!fam && fam.index > 0;
      const gender = NEW_PUPILS.find(([f, l]) => `${f} ${l}` === p.name)![2];
      const born = 2026 - AGE[p.className];
      patch = {
        category: staff ? 'staff_child' : 'day', discount_id: staff ? staffId : sibling ? siblingId : null,
        guardian_name: `Mr/Mrs ${p.last}`, guardian_phone: `+26377${1000000 + Math.floor(h(p.email, 'phone') * 8999999)}`, guardian_email: '',
        address: STREETS[Math.floor(h(p.email, 'street') * STREETS.length)], family_code: fam?.code || '', gender,
        dob: `${born}-${String(1 + Math.floor(h(p.email, 'm') * 12)).padStart(2, '0')}-${String(1 + Math.floor(h(p.email, 'd') * 28)).padStart(2, '0')}`, notes: '',
      };
      guardianOf.set(p.id, patch.guardian_name);
    } else if (cur.dob === '2016-03-15') {
      // the first seed gave every pupil the same birthday; give the older pupils one that fits their class
      const born = 2026 - AGE[p.className];
      patch = { dob: `${born}-${String(1 + Math.floor(h(p.email, 'm') * 12)).padStart(2, '0')}-${String(1 + Math.floor(h(p.email, 'd') * 28)).padStart(2, '0')}` };
    }
    if (!patch) continue;
    profTotal++;
    const r = await put(`/student-profiles/${p.id}`, B, { ...cur, ...patch });
    if (r.status === 200) profOk++; else profFail ||= brief(r);
  }
  tally('guardian profiles saved (new pupils) and birthdays fitted (older pupils)', profOk, profTotal, profFail);

  let billed = 0, billFail = '';
  for (const [, cid] of classId) for (const [term, date] of [[t2, '2026-05-06'], [t3, '2026-09-02']] as const) {
    const r = await post('/billing/run', B, { term_id: term.id, class_id: cid, date });
    if (r.status === 200) billed += r.data.billed; else billFail ||= brief(r);
  }
  check(`bills raised for the new pupils (${billed} new bills)`, billFail === '', billFail);
  const invoices = (await get('/invoices', B)).data as any[];
  const termInvoices = invoices.filter((i) => i.type === 'term' && i.status === 'active');
  check('every one of the 90 pupils has a Term 2 and a Term 3 bill (180)', termInvoices.length >= 180, `${termInvoices.length} term bills`);
  const total = (sid: number, tid: number) => termInvoices.find((i) => i.student_id === sid && i.term_id === tid)?.total || 0;
  const sib = termInvoices.find((i) => i.student_id === byName.get('Prosper Chirwa')!.id && i.term_id === t3.id);
  const fullGrade2 = termInvoices.find((i) => i.student_id === people('Grade 2')[0].id && i.term_id === t3.id);
  check('a younger brother gets 10% off (Prosper Chirwa)', !!sib && !!fullGrade2 && Math.abs(sib.total - fullGrade2.total * 0.9) < 0.02, `${sib?.total} vs full ${fullGrade2?.total}`);

  // ── 3. Parents ───────────────────────────────────────────
  section('Parents (brothers and sisters in different classes)');
  const haveParents = (await get('/parents', A)).data as any[];
  let parOk = 0, parFail = '', parTotal = 0;
  for (const f of FAMILIES) {
    if (haveParents.some((p) => p.email === f.email)) continue;
    parTotal++;
    const ids = f.kids.map((k) => byName.get(k)?.id).filter(Boolean);
    const r = await post('/parents', A, { name: f.name, email: f.email, password: PARENT_PASSWORD, student_ids: ids, relationship: f.relationship });
    if (r.status === 201 && ids.length === f.kids.length) parOk++; else parFail ||= `${f.email}: ${brief(r)}`;
  }
  tally('15 parent accounts created', parOk, parTotal, parFail);
  const khumalo = await post('/auth/login', undefined, { email: 'parent.khumalo@chakari.school', password: PARENT_PASSWORD });
  check('a parent with three children in three classes sees all three', khumalo.status === 200 && ((await get('/parents/children', khumalo.data.token)).data as any[]).length === 3, brief(khumalo));

  // ── 4. Register: every pupil, 15 school days ─────────────
  section('Register (15 school days for every pupil)');
  let regOk = 0, regTotal = 0, regFail = '';
  const REGISTER_DAYS = 15;
  for (const [cid, t] of teachers) {
    const kids = students.get(cid)!;
    const rows = (await get(`/attendance?class_id=${cid}`, t.token)).data as any[];
    const dates = new Set<string>(rows.map((r) => r.date));
    for (const r of rows) {
      const recs = r.records as any[];
      const missing = kids.filter((k) => !recs.some((x) => x.student_id === k.id));
      if (!missing.length) continue;
      regTotal++;
      const res = await post('/attendance', t.token, { class_id: cid, subject_id: r.subject_id ?? null, date: r.date, records: [...recs, ...missing.map((k) => ({ student_id: k.id, status: statusOn(k, r.date) }))] });
      if (res.status === 200) regOk++; else regFail ||= brief(res);
    }
    let d = dates.size ? new Date([...dates].sort()[0] + 'T12:00:00') : new Date();
    while (dates.size < REGISTER_DAYS) {
      d = addDays(d, -1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const date = ymd(d);
      regTotal++;
      const res = await post('/attendance', t.token, { class_id: cid, subject_id: null, date, records: kids.map((k) => ({ student_id: k.id, status: statusOn(k, date) })) });
      if (res.status === 200) { regOk++; dates.add(date); } else { regFail ||= brief(res); break; }
    }
  }
  tally('registers filled in', regOk, regTotal, regFail);

  // ── 5. Homework ──────────────────────────────────────────
  section('Homework (set, handed in, marked)');
  const subj = new Map<number, Map<string, number>>();
  for (const [cid] of teachers) subj.set(cid, new Map(((await get(`/subjects/class/${cid}`, A)).data as any[]).map((s) => [s.name, s.id])));
  const demoHwTitles = new Set(HW_NEW.map(hwTitle));
  let hwMade = 0, hwTotal = 0, hwFail = '', subOk = 0, subTotal = 0, subFail = '', markOk = 0, markTotal = 0, markFail = '';
  const now = Date.now();
  for (const [cid, t] of teachers) {
    const lower = isLower(t.className);
    let mine = ((await get('/homework/my-classes', t.token)).data as any[]).filter((x) => !String(x.title).startsWith('PROBE'));
    for (const task of HW_NEW) {
      if (mine.some((x) => x.title === hwTitle(task))) continue;
      hwTotal++;
      const r = await post('/homework', t.token, { class_id: cid, subject_id: subj.get(cid)!.get(task.subject), title: hwTitle(task), description: lower ? task.lower : task.upper, due_date: ymd(addDays(new Date(), task.due)) });
      if (r.status === 201) hwMade++; else hwFail ||= brief(r);
    }
    mine = ((await get('/homework/my-classes', t.token)).data as any[]).filter((x) => !String(x.title).startsWith('PROBE'));
    // The first seed left some old pupils' homework deliberately unfinished; only touch old tasks for the new pupils.
    const managed = (pupil: Person, task: any) => pupil.isNew || demoHwTitles.has(task.title);
    for (const kid of students.get(cid)!) {
      const list = (await get('/homework/my', kid.token)).data as any[];
      for (const task of list) {
        if (task.submission || !managed(kid, task)) continue;
        const past = new Date(task.due_date).getTime() < now;
        const p = past ? 0.55 + ability(kid) * 0.4 : 0.12 + ability(kid) * 0.35;
        if (h(kid.email, 'hw', task.id) >= p) continue;
        subTotal++;
        const fd = new FormData();
        fd.append('notes', HW_NOTES[Math.floor(h(kid.email, 'note', task.id) * HW_NOTES.length)]);
        if (h(kid.email, 'file', task.id) < 0.15) fd.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'my-homework.png');
        const r = await call('POST', `/homework/submit/${task.id}`, kid.token, fd);
        if (r.status === 201) subOk++; else subFail ||= brief(r);
      }
    }
    const newIds = new Set(students.get(cid)!.filter((k) => k.isNew).map((k) => k.id));
    for (const task of mine) {
      const past = new Date(task.due_date).getTime() < now;
      const subs = ((await get(`/homework/submissions/${task.id}`, t.token)).data.submissions as any[]) || [];
      for (const s of subs) {
        if (s.grade != null) continue;
        if (!(newIds.has(s.student_id) || demoHwTitles.has(task.title))) continue;
        if (h(s.student_id, 'mark', task.id) >= (past ? 0.85 : 0.25)) continue; // some are left for the teacher to mark
        const kid = students.get(cid)!.find((k) => k.id === s.student_id)!;
        const grade = clamp(Math.round(10 * clamp(ability(kid) + (h(kid.email, 'g', task.id) - 0.5) * 0.3, 0.2, 1)), 2, 10);
        markTotal++;
        const r = await put(`/homework/grade/${s.id}`, t.token, { grade, feedback: feedbackFor(grade) });
        if (r.status === 200) markOk++; else markFail ||= brief(r);
      }
    }
  }
  tally('6 more homework tasks set in each class', hwMade, hwTotal, hwFail);
  tally('pupils handed in homework (some with a picture)', subOk, subTotal, subFail);
  tally('teachers marked homework with feedback', markOk, markTotal, markFail);

  // ── 6. Quizzes ───────────────────────────────────────────
  section('Quizzes (made, attempted, auto-marked)');
  let qzMade = 0, qzTotal = 0, qzFail = '', attOk = 0, attTotal = 0, attFail = '';
  for (const [cid, t] of teachers) {
    const bank = QUIZ_BANKS[isLower(t.className) ? 'lower' : 'upper'];
    const mine = ((await get('/quizzes/my', t.token)).data as any[]).filter((x) => !String(x.title).startsWith('PROBE'));
    for (const quiz of bank) {
      if (mine.some((x) => x.title === quiz.title)) continue;
      qzTotal++;
      const r = await post('/quizzes', t.token, { class_id: cid, subject_id: subj.get(cid)!.get(quiz.subject), title: quiz.title, description: quiz.description, duration_minutes: 10, questions: quiz.questions });
      if (r.status === 201) qzMade++; else qzFail ||= brief(r);
    }
    for (const kid of students.get(cid)!) {
      const avail = (await get('/quizzes/available', kid.token)).data as any[];
      for (const quiz of avail) {
        if (quiz.attempts.length > 0) continue;
        if (!kid.isNew && !DEMO_QUIZ_TITLES.has(quiz.title)) continue; // leave the first seed's quizzes as they were for the old pupils
        if (h(kid.email, 'quiz', quiz.id) >= 0.9) continue;                 // a few pupils have not tried it yet
        const qs = ((await get(`/quizzes/${quiz.id}/questions`, kid.token)).data.questions as any[]) || [];
        const pRight = 0.3 + ability(kid) * 0.7;
        const answers = qs.map((x, idx) => {
          const opts: string[] = typeof x.options === 'string' ? JSON.parse(x.options) : x.options;
          const right = KEY.get(x.question) ?? opts[0];
          const wrong = opts.filter((o) => o !== right);
          return { question_id: x.id, selected_answer: h(kid.email, quiz.id, idx) < pRight ? right : wrong[Math.floor(h(kid.email, 'w', quiz.id, idx) * wrong.length)] };
        });
        attTotal++;
        const r = await post(`/quizzes/${quiz.id}/attempt`, kid.token, { answers });
        if (r.status === 200) attOk++; else attFail ||= brief(r);
      }
    }
  }
  tally('4 more quizzes made in each class', qzMade, qzTotal, qzFail);
  tally('pupils took quizzes and were marked automatically', attOk, attTotal, attFail);

  // ── 7. Results and report cards ──────────────────────────
  section('Results (Terms 1 and 2 for the new pupils) and Grade 7 examination marks');
  const gradeOf = (n: number) => (n >= 75 ? 'A' : n >= 65 ? 'B' : n >= 50 ? 'C' : n >= 40 ? 'D' : 'E');
  const REMARK: Record<string, string> = { A: 'Outstanding performance.', B: 'Very good, keep it up.', C: 'Satisfactory; aim higher.', D: 'Needs more effort.', E: 'Requires extra support.' };
  let resOk = 0, resTotal = 0, resFail = '';
  for (const [cid, t] of teachers) {
    const entered = new Set<number>(((await get('/results/entered', t.token)).data as any[]).map((r) => r.student_id));
    for (const kid of students.get(cid)!) {
      if (entered.has(kid.id)) continue;
      for (const [ti, term] of ['Term 1', 'Term 2'].entries()) for (const name of SUBJECTS) {
        const frac = () => clamp(ability(kid) + (h(kid.email, term, name) - 0.5) * 0.25 + ti * 0.02, 0.1, 1);
        const project = Math.round(20 * frac()), test = Math.round(20 * frac()), exam = Math.round(60 * frac());
        const sum = project + test + exam;
        resTotal++;
        const r = await post('/results', t.token, { student_id: kid.id, subject_name: name, term, academic_year: YEAR, coursework: project, test_score: test, exam, grade: gradeOf(sum), remarks: REMARK[gradeOf(sum)] });
        if (r.status === 201 || r.status === 200) resOk++; else resFail ||= brief(r);
      }
    }
  }
  tally('marks entered for the new pupils (6 learning areas x 2 terms)', resOk, resTotal, resFail);

  // Grade 7 examination marks and units: the units follow the portal's own default bands (Admin Panel > Grading and marks)
  const unitOf = (m: number) => (m >= 90 ? 1 : m >= 80 ? 2 : m >= 70 ? 3 : m >= 60 ? 4 : m >= 50 ? 5 : m >= 40 ? 6 : m >= 30 ? 7 : m >= 20 ? 8 : 9);
  const g7Teacher = teachers.get(classId.get('Grade 7')!)!;
  const entries = people('Grade 7').flatMap((p) => SUBJECTS.concat(EXTRA_AREA).map((area2) => {
    const mark = Math.round(100 * clamp(ability(p) + (h(p.email, 'exam', area2) - 0.5) * 0.3, 0.15, 0.98));
    return { student_id: p.id, area: area2, mark, unit: unitOf(mark) };
  }));
  const ex = await put('/exams/grade7', g7Teacher.token, { academic_year: YEAR, entries });
  check('Grade 7 examination marks saved for all 10 pupils in the 7 learning areas', ex.status === 200 && ex.data.saved === 70, brief(ex));

  // ── 8. Notices ───────────────────────────────────────────
  section('Notices');
  const haveNotices = new Set<string>(((await get('/notices', A)).data as any[]).map((n) => n.title));
  const teacherList = CLASS_ORDER.map((cn) => teachers.get(classId.get(cn)!)!);
  let noOk = 0, noTotal = 0, noFail = '';
  for (const n of NOTICES) {
    if (haveNotices.has(n.title)) continue;
    noTotal++;
    const token = n.by === 'admin' ? A : teacherList[n.by].token;
    const r = await post('/notices', token, { title: n.title, content: n.content, target_role: n.to });
    if (r.status === 201) {
      noOk++;
      // spread them over the last three weeks so the list looks lived-in
      await post('/admin/sql', A, { sql: `UPDATE notices SET created_at = datetime('now', '-${n.daysAgo} days', '-${Math.floor(h(n.title) * 600)} minutes') WHERE title = '${n.title.replace(/'/g, "''")}'` });
    } else noFail ||= brief(r);
  }
  tally('14 more notices posted by the Administrator and teachers', noOk, noTotal, noFail);

  // ── 9. Sports ────────────────────────────────────────────
  section('Sports');
  const sports = (await get('/sports', A)).data as any[];
  const sp = (n: string) => sports.find((x) => x.name === n);
  let joined = 0;
  const teams: [string, (i: number, p: Person) => boolean][] = [
    ['Football', (i) => i % 3 === 1], ['Netball', (i) => i % 4 === 3], ['Athletics', (i, p) => h(p.email, 'ath') < 0.35], ['Volleyball', (i) => i % 6 === 5],
  ];
  for (const [name, pick] of teams) {
    if (!sp(name)) continue;
    for (const [i, p] of all.entries()) if (p.isNew && pick(i, p) && !(p.classId === classId.get('ECD A') || p.classId === classId.get('ECD B'))) { if ((await post(`/sports/join/${sp(name).id}`, p.token)).status === 200) joined++; }
  }
  console.log(`      (${joined} more pupils joined a team)`);
  check('every team has players', (await Promise.all(['Football', 'Netball', 'Athletics', 'Volleyball'].filter(sp).map(async (n) => ((await get(`/sports/${sp(n).id}/participants`, A)).data as any[]).length))).every((c) => c > 0));

  // ── 10. Fees: payments, charges, waivers, expenses, transfers, reminders ──
  section('Fees: payments in every currency and method, arrears, charges, waivers, expenses');
  const accounts = (await get('/accounts', B)).data as any[];
  const acct = (n: string) => accounts.find((x) => x.name === n)?.id;
  const zwgRate = ((await get('/currencies', B)).data as any[]).find((c) => c.code === 'ZWG')?.rate || 26.6;
  const paid = new Set<number>(((await get('/payments', B)).data as any[]).map((p) => p.student_id));
  const recent = ymd(addDays(new Date(), -2));
  type Pay = { term: 't2' | 't3'; frac: number; method: 'cash' | 'bank' | 'ecocash' | 'swipe'; date: string; zwg?: boolean; note?: string };
  const SCENARIOS: Pay[][] = [
    [{ term: 't2', frac: 1, method: 'cash', date: '2026-05-18' }, { term: 't3', frac: 1, method: 'ecocash', date: '2026-09-10' }],                                  // paid early, in full
    [{ term: 't2', frac: 1, method: 'bank', date: '2026-05-22' }, { term: 't3', frac: 0.6, method: 'bank', date: '2026-09-14', zwg: true }],                         // part paid in ZWG
    [{ term: 't2', frac: 1, method: 'ecocash', date: '2026-05-25' }],                                                                                             // Term 3 not paid yet
    [{ term: 't2', frac: 0.5, method: 'cash', date: '2026-05-28', note: 'First instalment' }, { term: 't2', frac: 0.25, method: 'ecocash', date: '2026-07-02', note: 'Second instalment' }, { term: 't3', frac: 1, method: 'swipe', date: recent }], // instalments
    [{ term: 't3', frac: 0.25, method: 'cash', date: '2026-10-20', note: 'Deposit' }],                                                                           // owes Term 2 and most of Term 3
  ];
  let payOk = 0, payTotal = 0, payFail = '', seq = 0;
  for (const [ci, cn] of CLASS_ORDER.entries()) {
    const fresh = people(cn).filter((p) => p.isNew);
    for (const [j, p] of fresh.entries()) {
      if (paid.has(p.id)) continue;
      for (const s of SCENARIOS[(j + ci) % 5]) {
        const term = s.term === 't2' ? t2 : t3;
        const usd = money(total(p.id, term.id) * s.frac);
        if (usd <= 0) continue;
        payTotal++; seq++;
        const accountId = s.method === 'cash' ? acct('Main Cash') : s.method === 'ecocash' ? acct('Ecocash Merchant') : acct('CBZ School Account');
        const r = await post('/payments', B, {
          student_id: p.id, term_id: term.id, pay_date: s.date, amount_paid: s.zwg ? money(usd * zwgRate) : usd, currency: s.zwg ? 'ZWG' : 'USD', fx_rate: s.zwg ? zwgRate : 1,
          method: s.method, reference: s.method === 'cash' ? '' : `${s.method.toUpperCase()}-D${seq}-${p.id}`, account_id: accountId, payer: guardianOf.get(p.id) || '', notes: s.note || '',
        });
        if (r.status === 201) payOk++; else payFail ||= brief(r);
      }
    }
  }
  tally('payments recorded for the new pupils (cash, bank, EcoCash, swipe, ZWG, instalments)', payOk, payTotal, payFail);

  if (freshExtras) {
    const person = (n: string) => byName.get(n)!;
    let chOk = 0, chFail = '';
    const charges: [string, string, number][] = [
      ['Tonderai Shumba', 'Replacement exercise books', 4], ['Prosper Chirwa', 'Lost library book', 5],
      ['Ryan Mudzingwa', 'Class trip: Great Zimbabwe', 8], ['Thando Khumalo', 'Class trip: Great Zimbabwe', 8], ['Vusumuzi Mpofu', 'Class trip: Great Zimbabwe', 8], ['Alois Makoni', 'Class trip: Great Zimbabwe', 8],
      ['Brian Marufu', 'Grade 7 revision pack', 6], ['Cleopas Tshuma', 'Grade 7 revision pack', 6], ['Joshua Chigumba', 'Grade 7 revision pack', 6],
    ];
    for (const [who, what, amount] of charges) {
      const r = await post('/billing/charge', B, { student_id: person(who).id, term_id: t3.id, lines: [{ fee_item_id: null, description: what, amount }], notes: 'Added by the Bursar' });
      if (r.status === 201) chOk++; else chFail ||= brief(r);
    }
    tally('one-off charges raised (trip, books, revision packs)', chOk, charges.length, chFail);
    let crOk = 0, crFail = '';
    const credits: [string, string, number][] = [['Kuziva Zimunya', 'Fee waiver: family hardship', 20], ['Chantelle Gumbo', 'Scholarship contribution', 15], ['Patience Khumalo', 'Correction of an overcharge', 5]];
    for (const [who, what, amount] of credits) {
      const r = await post('/billing/credit-note', B, { student_id: person(who).id, term_id: t3.id, lines: [{ fee_item_id: null, description: what, amount }], notes: 'Approved by the head' });
      if (r.status === 201) crOk++; else crFail ||= brief(r);
    }
    tally('credit notes raised (waivers and a scholarship)', crOk, credits.length, crFail);

    const cats = (await get('/expense-categories', B)).data as any[];
    const cat = (n: string) => cats.find((c) => c.name === n)?.id;
    const expenses: [string, string, string, number, string, string][] = [
      ['Utilities', 'ZESA', 'Electricity for October', 92, 'CBZ School Account', '2026-10-21'], ['Stationery', 'Kadoma Stationers', 'Examination papers and printing paper', 140, 'Main Cash', '2026-10-28'],
      ['Maintenance', 'Sanyati Hardware', 'Repair of the staff room door', 55, 'Main Cash', '2026-10-15'], ['Allowances', 'Ground staff', 'Cleaning allowance for October', 40, 'Main Cash', '2026-10-30'],
      ['Transport', 'Chakari Transport', 'Grade 6 and 7 educational trip', 150, 'CBZ School Account', '2026-10-27'], ['Utilities', 'ZINWA', 'Water bill for October', 30, 'Ecocash Merchant', '2026-10-14'],
      ['Stationery', 'Book Centre', 'Library books for Grades 1 to 3', 110, 'CBZ School Account', '2026-09-18'], ['Maintenance', 'Mbare Paints', 'Paint for the Grade 4 classroom', 75, 'Main Cash', '2026-09-29'],
      ['Allowances', 'Invigilators', 'Allowance for end of term invigilation', 60, 'Main Cash', '2026-11-02'], ['Utilities', 'Econet', 'Internet for the computer room', 35, 'Ecocash Merchant', '2026-11-01'],
    ];
    let exOk = 0, exFail = '';
    for (const [c, payee, desc, amount, a, date] of expenses) {
      const r = await post('/expenses', B, { exp_date: date, category_id: cat(c), account_id: acct(a), payee, description: desc, amount, reference: '' });
      if (r.status === 201) exOk++; else exFail ||= `${payee}: ${brief(r)}`;
    }
    tally('expense vouchers recorded', exOk, expenses.length, exFail);
    let trOk = 0, trFail = '';
    for (const t of [{ tr_date: '2026-10-23', from_account: acct('Main Cash'), to_account: acct('CBZ School Account'), amount: 150, reference: 'DEP-0057', notes: 'Banking' }, { tr_date: '2026-10-29', from_account: acct('Ecocash Merchant'), to_account: acct('CBZ School Account'), amount: 80, reference: 'EC-TRF-3', notes: 'EcoCash cash-out to the bank' }]) {
      const r = await post('/accounts/transfer', B, t);
      if (r.status === 201) trOk++; else trFail ||= brief(r);
    }
    tally('transfers between the cash, EcoCash and bank accounts', trOk, 2, trFail);

    let remOk = 0, remFail = '';
    for (const cn of ['Grade 5', 'Grade 6', 'Grade 7']) {
      const r = await post('/messages/bulk-reminder', B, { class_id: classId.get(cn), min_balance: 10, template: 'Dear parent/guardian, {student} of {class} owes {balance}. Thank you. {school}' });
      if (r.status !== 200) { remFail ||= brief(r); continue; }
      remOk++;
      for (const m of (r.data as any[]).slice(0, 2)) await put(`/messages/${m.message_id}/sent`, B);
    }
    tally('fee reminders prepared for Grades 5, 6 and 7 (some marked as sent)', remOk, 3, remFail);
  }

  // ── Does it all add up? ──────────────────────────────────
  section('Does it all add up?');
  const roster = (await get('/finance-students', B)).data as any[];
  check('the Bursar sees 90 pupils with balances', roster.length === 90 && roster.every((s) => typeof s.balance === 'number'), `rows ${roster.length}`);
  const dB = (await get('/dashboard', B)).data, dA = (await get('/dashboard', A)).data;
  check('the Administrator dashboard counts 90 pupils, 9 teachers, 9 classes', dA.students === 90 && dA.teachers === 9 && dA.classes === 9, JSON.stringify(dA));
  check('"Outstanding Fees" equals the total of every pupil\'s balance', Math.abs(dB.outstandingFees - roster.reduce((s, x) => s + x.balance, 0)) < 0.01, `dashboard ${dB.outstandingFees}`);
  check('the fees owed by the Administrator\'s and Bursar\'s views agree', Math.abs(dA.outstandingFees - dB.outstandingFees) < 0.01, `${dA.outstandingFees} vs ${dB.outstandingFees}`);
  const debtors = (await get('/reports/debtors', B)).data as any[];
  check('the debtors report lists pupils who owe, largest first', debtors.length > 20 && debtors.every((d, i) => i === 0 || debtors[i - 1].balance >= d.balance), `rows ${debtors.length}`);
  const integrity = await get('/admin/db/integrity', A);
  check('the database check is clean (no broken links between records)', integrity.status === 200 && integrity.data.integrity === 'ok' && integrity.data.foreignKeysOn === true && (integrity.data.problems as any[]).length === 0, JSON.stringify(integrity.data).slice(0, 300));
  const kid = byName.get('Tariro Chirwa')!;
  const [hw, qz, ntc, att, myRes] = await Promise.all(['/homework/my', '/quizzes/available', '/notices', '/attendance/my', '/results/my'].map((p) => get(p, kid.token)));
  check('a new ECD A pupil sees homework, quizzes, notices, 15 days of register and results', hw.data.length >= 9 && qz.data.length >= 6 && ntc.data.length >= 12 && att.data.length === 15 && myRes.data.length === 12, JSON.stringify([hw.data.length, qz.data.length, ntc.data.length, att.data.length, myRes.data.length]));
  const g7 = (await get('/exams/grade7?year=' + YEAR, A)).data;
  check('the Grade 7 examination page shows 10 pupils with marks', g7.pupils?.length === 10 && g7.pupils.every((p: any) => p.areasEntered === 7), JSON.stringify(g7.pupils?.map((p: any) => p.areasEntered)));

  finish(started, { teachers: teacherList, students: students, classId });
}

// ═════════════════════════════════════════════════════════════════════════════

function finish(started: number, cast: { teachers: Person[]; students: Map<number, Person[]>; classId: Map<string, number> } | null) {
  const failed = results.filter((r) => !r.ok);
  console.log('\n══════════════════ SUMMARY ══════════════════');
  console.log(`${results.length - failed.length}/${results.length} checks passed in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  if (failed.length) { console.log('\nPROBLEMS:'); for (const f of failed) console.log(` - [${f.area}] ${f.name}\n     ${f.detail}`); }
  if (cast) {
    console.log('\nDemo logins (password in brackets):');
    console.log('  Administrator  punhamasiwa@gmail.com [1234]');
    console.log('  Bursar         tascarmasiwa@gmail.com [12345678]');
    for (const t of cast.teachers) console.log(`  Teacher ${t.className.padEnd(8)} ${t.email} [${TEACHER_PASSWORD}]`);
    for (const cn of CLASS_ORDER) { const p = cast.students.get(cast.classId.get(cn)!)![0]; console.log(`  Pupil   ${cn.padEnd(8)} ${p.email} [${STUDENT_PASSWORD}]`); }
    console.log(`  Parents: parent.moyo@chakari.school, parent.dube@chakari.school and ${FAMILIES.length} more (parent.<surname>@chakari.school) [${PARENT_PASSWORD}]`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('Demo seed crashed:', e); process.exit(2); });
