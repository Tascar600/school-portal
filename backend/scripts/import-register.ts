/**
 * Loads a class list and its register of attendance from the school's Excel sheets into the portal.
 *
 *   cd backend
 *   npm run import:register -- "C:\path\Chakari_ECD_A_2026_Pupils_and_Attendance.xlsx" "C:\path\...ECD_B....xlsx"
 *
 * (or double-click "Import Class Registers.bat" in the project folder). It asks for the portal's address, the Administrator's
 * email and password (typed in this window only), shows exactly what it is going to do, and waits for you to type IMPORT.
 * Nothing is changed before that. It only ADDS: it never edits or deletes anything that is already in the portal, and it is
 * safe to run again (pupils and days already there are skipped).
 *
 * With --names-only (double-click "Import Pupil Names.bat") only the pupils and their details are added, no attendance registers;
 * running it later without --names-only adds the registers for the pupils already there.
 *
 * What each workbook must contain (the layout the school's scanned-register sheets use):
 *   sheet "Pupils"             First Name, Surname, Gender, Date of Birth, Status, Class 2026, Check / Notes (and optionally
 *                              No / Register No, DOB as written, Transferred In From)
 *   sheet "Attendance Import"  one row per pupil per day: No, First Name, Surname, Class, Date, Status Code (P present, A absent,
 *                              N admitted that day; L late and E excused are also understood)
 *   sheet "Attendance Register" (optional) only used to find a pupil's gender when the class list lacks them
 *
 * How it files things:
 *  - every pupil goes into the class named in the sheet (the class must exist: ECD A, ECD B, Grade 1 ...). Pupils are created the
 *    way Admin Panel > Users creates them (inactive, with a registration number); each pupil activates their own account later;
 *  - gender, date of birth (only when the sheet gives a clear one) and the sheet's notes go in the pupil's profile, so anything
 *    marked "check" in the sheet stays visible; the day a pupil was admitted becomes the "enrolled on" date;
 *  - every school day becomes one register for the class, kept under the Administrator (a register belongs to one account, and one
 *    that belongs to a teacher is deleted if that teacher is ever deleted);
 *  - a pupil who has attendance but is not on the class list (they left during the term) is created and closed, so their days stay in
 *    the registers; a pupil with no name is skipped and listed, so the sheet can be fixed and run again.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import ExcelJS from 'exceljs';

const LIVE = 'https://school-portal-r4h0.onrender.com';

// ── reading the workbooks ────────────────────────────────────────────────────

interface Pupil {
  no: number | null; first: string; last: string; name: string; gender: 'M' | 'F' | null; dob: string | null; dobWritten: string; from: string; check: string; left: boolean; leftWhy: string; enrolledOn: string | null;
  category: string;                    // the portal's fee category: day, staff_child, beam or sponsored
  guardian: string; phone: string;     // only what is clear enough to be used (the phone is what fee reminders are sent to)
  address: string;
  extra: string[];                     // details the portal has no box for (birth certificate, religion, doubtful phone ...), kept in the notes
}
const blankDetails = { category: 'day', guardian: '', phone: '', address: '', extra: [] as string[] };
interface AttRow { no: number | null; name: string; date: string; code: string }
interface Book { file: string; className: string; pupils: Pupil[]; attendance: AttRow[]; admitted: 'skip' | 'present'; skipped: string[]; warnings: string[] }

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const key = (s: string) => clean(s).toUpperCase();
const iso = (d: Date) => d.toISOString().slice(0, 10);

function plain(v: any): any {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return plain(v.result);
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return v.text;
  }
  return v;
}
const text = (v: any) => { const p = plain(v); return p instanceof Date ? iso(p) : clean(p); };

/** Finds the header row (the first row holding a "First Name" cell) and maps each wanted column to its position. */
function headers(ws: ExcelJS.Worksheet, wanted: Record<string, string[]>): { row: number; col: Record<string, number> } | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    const cells = (ws.getRow(r).values as any[]).map((v) => text(v).toLowerCase());
    if (!cells.includes('first name')) continue;
    const col: Record<string, number> = {};
    for (const [field, names] of Object.entries(wanted)) { const i = cells.findIndex((c) => names.includes(c)); if (i > 0) col[field] = i; }
    return { row: r, col };
  }
  return null;
}

// a name that is only a remark such as "(NAME MISSING)", "(first name crossed out)" or "(surname not given)" is not a name
const wholeBracket = (s: string) => /^\(.*\)$/.test(s);
const isPlaceholder = (first: string, last: string) => !first || wholeBracket(first) || wholeBracket(last) || (!last && /missing|unknown/i.test(first));

/** A date of birth is only used when it is a real date written in full (day first: 26/06/2022, 26.06.2022 or 2022-06-26). */
function clearDob(v: any): string | null {
  if (v instanceof Date) return iso(v);
  const t = text(v);
  let y = '', m = '', d = '';
  let hit = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (hit) [, y, m, d] = hit;
  else if ((hit = t.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/))) { d = hit[1].padStart(2, '0'); m = hit[2].padStart(2, '0'); y = hit[3]; }
  else return null;
  const when = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  return !Number.isNaN(when.getTime()) && iso(when) === `${y}-${m}-${d}` && Number(y) >= 1990 && Number(y) <= 2025 ? `${y}-${m}-${d}` : null;
}

/** The guardian's phone goes in only when it is a whole number the sheet does not doubt; otherwise it is kept in the notes as written. */
function phoneDetails(raw: string, doubted: boolean): { use: string; written: string } {
  const t = clean(raw);
  if (!t) return { use: '', written: '' };
  const digits = (s: string) => s.replace(/[\s-]/g, '');
  const good = (s: string) => /^0\d{9}$/.test(digits(s)) || /^\+?263\d{9}$/.test(digits(s));
  const tokens = t.split(/\s*(?:\/|,|;|\band\b|\bor\b)\s*/i).map(clean).filter(Boolean);
  const use = !doubted ? (tokens.find(good) ? digits(tokens.find(good)!) : '') : '';
  return { use, written: use && tokens.length === 1 && digits(t) === use ? '' : t };
}

async function readBook(file: string): Promise<Book> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ps = wb.getWorksheet('Pupils'), at = wb.getWorksheet('Attendance Import'), reg = wb.getWorksheet('Attendance Register');
  if (!ps) throw new Error(`${path.basename(file)} needs a sheet called "Pupils" (a sheet called "Attendance Import" is only needed to load registers)`);
  const book: Book = { file, className: '', pupils: [], attendance: [], admitted: 'skip', skipped: [], warnings: [] };

  // "N = admitted that day (not counted, as in the register)" or "(counted as present ...)"
  if (reg) for (let r = 1; r <= 4; r++) {
    const t = text(reg.getRow(r).getCell(1).value);
    const m = t.match(/N\s*=\s*admitted[^(]*\(([^)]*)\)/i);
    if (m) book.admitted = /not counted/i.test(m[1]) ? 'skip' : 'present';
  }

  // gender, when the class list does not say; and who the register marks T (transferred out) part way through the term
  const genderByNo = new Map<number, 'M' | 'F'>();
  const transferred = new Set<number>();
  if (reg) {
    const h = headers(reg, { no: ['no', 'register no'], gender: ['gender'] });
    if (h?.col.no && h.col.gender) for (let r = h.row + 1; r <= reg.rowCount; r++) {
      const row = reg.getRow(r);
      const no = Number(plain(row.getCell(h.col.no).value)), g = text(row.getCell(h.col.gender).value).toUpperCase();
      if (!Number.isFinite(no) || no <= 0) continue;
      if (g === 'M' || g === 'F') genderByNo.set(no, g);
      const marks = (row.values as any[]).slice(h.col.gender + 1).map((v) => text(v).toUpperCase());
      if (marks.includes('T')) transferred.add(no);
    }
  }

  // the class list
  const ph = headers(ps, {
    no: ['no', 'no.', 'register no'], first: ['first name'], last: ['surname'], gender: ['gender', 'sex'], dob: ['date of birth'], written: ['dob as written'],
    cls: ['class 2026', 'class'], status: ['status'], from: ['transferred in from'], check: ['check / notes', 'check/notes', 'notes'],
    category: ['category'], religion: ['religion'], dayBoarder: ['day / boarder', 'boarder / day scholar', 'day/boarder'],
    birthCert: ['birth cert no.', 'birth cert no', 'birth certificate no', 'birth certificate no.'],
    guardian: ['parent / guardian name', 'parent / guardian', 'parent/guardian', 'guardian name', 'guardian'],
    phone: ['contact phone', 'guardian phone', 'phone'], address: ['residential address', 'address', 'address (occupation)'],
  });
  if (!ph?.col.first || !ph.col.last) throw new Error(`${path.basename(file)}: the "Pupils" sheet has no First Name / Surname columns`);
  for (let r = ph.row + 1; r <= ps.rowCount; r++) {
    const row = ps.getRow(r);
    const get = (f: string) => (ph.col[f] ? plain(row.getCell(ph.col[f]).value) : null);
    const first = text(get('first')), last = text(get('last'));
    const noText = text(get('no'));
    if (noText && !/^\d+$/.test(noText)) break; // "Totals", "Pupils on register" ...: the list is over
    const no = /^\d+$/.test(noText) && Number(noText) > 0 ? Number(noText) : null;
    if (!first && !last) { if (no !== null) book.skipped.push(`register no. ${no}: no name written (add it in the sheet and run this again)`); continue; }
    if (isPlaceholder(first, last)) {
      const part = first && last && (wholeBracket(first) || wholeBracket(last)); // one half of the name is only a remark
      book.skipped.push(`register no. ${no ?? '?'}: ${part ? `the name is incomplete ("${first} ${last}")` : 'no name written'} (add it in the sheet and run this again)`);
      continue;
    }
    const cls = text(get('cls'));
    if (cls && !book.className) book.className = cls;
    const g = text(get('gender')).toLowerCase();
    const dobCell = get('dob'), writtenCell = get('written');
    const status = text(get('status')) || 'Active';
    const left = !/^active$/i.test(status);
    const dobClear = clearDob(dobCell);
    // a date typed into "DOB as written" is ambiguous (10/2/2021: 10 February or 2 October?), so it is only quoted, never used
    const writtenText = writtenCell instanceof Date ? `${writtenCell.getUTCMonth() + 1}/${writtenCell.getUTCDate()}/${writtenCell.getUTCFullYear()} (day and month order unclear)` : text(writtenCell);
    // a date of birth the sheet gives that is not a whole, real date (21.01.2?, Age 10, 02/__/2017) is quoted in the notes, never entered
    const written = writtenText || (dobClear || dobCell instanceof Date ? '' : text(dobCell));
    const check = text(get('check'));

    // guardian, phone and address: only clear ones are entered; the rest is quoted in the notes so nothing is lost
    const extra: string[] = [];
    const birthCert = text(get('birthCert')), religion = text(get('religion')), dayBoarder = text(get('dayBoarder'));
    if (birthCert) extra.push(`Birth cert no. ${birthCert}`);
    if (religion) extra.push(`Religion: ${religion}`);
    if (/boarder/i.test(dayBoarder) && !/day/i.test(dayBoarder)) extra.push('Boarder (the portal has no boarder category)');
    const guardianRaw = text(get('guardian'));
    const guardianCut = /\.\.\.|…$/.test(guardianRaw) || /parent|guardian/i.test(check);
    if (guardianRaw && guardianCut) extra.push(`Parent/guardian as written: ${guardianRaw}`);
    // the sheet's own remark casts doubt on the number ("Phone overwritten", "Contact written one row up", "First number has only 9 digits")
    const ph2 = phoneDetails(text(get('phone')), /phone|contact|\bnumber\b/i.test(check));
    if (ph2.written) extra.push(`Phone as written: ${ph2.written}`);
    const cat = text(get('category')).toLowerCase().replace(/[\s-]+/g, '_');

    book.pupils.push({
      no, first, last, name: `${first} ${last}`.trim(),
      gender: g.startsWith('f') ? 'F' : g.startsWith('m') ? 'M' : (no !== null ? genderByNo.get(no) ?? null : null),
      dob: dobClear, dobWritten: written, from: text(get('from')), check,
      left, leftWhy: left ? `Status in the sheet: ${status}` : '', enrolledOn: null,
      category: ['day', 'staff_child', 'beam', 'sponsored'].includes(cat) ? cat : 'day',
      guardian: guardianRaw && !guardianCut ? guardianRaw : '', phone: ph2.use, address: text(get('address')), extra,
    });
  }

  // the register (only needed to load attendance; a class list on its own has no such sheet)
  const ah = at ? headers(at, { no: ['no', 'register no'], first: ['first name'], last: ['surname'], cls: ['class'], date: ['date'], code: ['status code', 'code'] }) : null;
  if (at && (!ah?.col.first || !ah.col.date || !ah.col.code)) throw new Error(`${path.basename(file)}: the "Attendance Import" sheet needs First Name, Surname, Date and Status Code columns`);
  if (at && ah) for (let r = ah.row + 1; r <= at.rowCount; r++) {
    const row = at.getRow(r);
    const first = text(row.getCell(ah.col.first).value), last = ah.col.last ? text(row.getCell(ah.col.last).value) : '';
    const dateRaw = plain(row.getCell(ah.col.date).value), code = text(row.getCell(ah.col.code).value).toUpperCase();
    if (!first && !last) continue;
    if (isPlaceholder(first, last)) continue; // listed already, as a pupil with no name
    const date = dateRaw instanceof Date ? iso(dateRaw) : text(dateRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { book.warnings.push(`row ${r}: "${date}" is not a date; skipped`); continue; }
    const cls = ah.col.cls ? text(row.getCell(ah.col.cls).value) : '';
    if (cls && !book.className) book.className = cls;
    const noRaw = ah.col.no ? Number(plain(row.getCell(ah.col.no).value)) : NaN;
    book.attendance.push({ no: Number.isFinite(noRaw) && noRaw > 0 ? noRaw : null, name: `${first} ${last}`.trim(), date, code });
  }
  if (!book.className) throw new Error(`${path.basename(file)}: could not tell which class this is (a "Class 2026" column is needed)`);

  // Pupils who have days in the register but are not on the class list. If the register marks them T (transferred out) they left
  // during the term: they are added and closed, so their days stay in the registers. Anyone else is simply missing from the list
  // (they were in class right to the end), so they are added as ordinary pupils and flagged.
  const known = new Set(book.pupils.map((p) => key(p.name)));
  const extra = new Map<string, AttRow>();
  for (const a of book.attendance) if (!known.has(key(a.name)) && !extra.has(key(a.name))) extra.set(key(a.name), a);
  for (const a of extra.values()) {
    const parts = a.name.split(' ');
    const last = parts.pop() || '';
    const gone = a.no !== null && transferred.has(a.no);
    book.pupils.push({
      no: a.no, first: parts.join(' '), last, name: a.name, gender: a.no !== null ? genderByNo.get(a.no) ?? null : null, dob: null, dobWritten: '', from: '',
      check: gone ? '' : 'NOT ON THE CLASS LIST, yet marked in the register for the whole term: added as an ordinary pupil. Please confirm they belong in this class',
      left: gone, leftWhy: gone ? 'Not on the class list: the register marks them transferred (T) part way through the term' : '', enrolledOn: null,
      ...blankDetails, extra: [],
    });
  }
  for (const p of book.pupils) {
    const n = book.attendance.find((a) => key(a.name) === key(p.name) && a.code === 'N');
    if (n) p.enrolledOn = n.date;
  }
  return book;
}

// ── talking to the portal ────────────────────────────────────────────────────

interface Api { call: (method: string, route: string, body?: any) => Promise<{ status: number; data: any }>; sql: (q: string, params?: any[]) => Promise<any[]>; write: (q: string, params?: any[]) => Promise<{ insertId: number; affectedRows: number }>; adminId: number }

async function connect(base: string, email: string, password: string): Promise<Api> {
  const url = base.replace(/\/+$/, '') + '/api';
  let token = '';
  const call = async (method: string, route: string, body?: any) => {
    const r = await fetch(url + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
    const t = await r.text();
    let data: any = t; try { data = JSON.parse(t); } catch { /* not JSON */ }
    return { status: r.status, data };
  };
  const health = await call('GET', '/health').catch((e) => { throw new Error(`Could not reach ${base} (${e?.cause?.code || e?.message}). Check the address and the internet connection.`); });
  if (health.status !== 200) throw new Error(`${base} answered ${health.status} when asked if it is running. Wait a minute and try again (a sleeping portal takes a moment to wake).`);
  const login = await call('POST', '/auth/login', { email, password });
  if (login.status === 401) throw new Error('The email or password was not accepted.');
  if (login.status === 429) throw new Error('Too many log in attempts. Wait 15 minutes and try again.');
  if (login.status !== 200) throw new Error(`Log in failed (${login.status}): ${login.data?.message || ''}`);
  if (login.data.user?.role !== 'admin') throw new Error('This must be the Administrator\'s log in (not the Bursar\'s or a teacher\'s).');
  if (login.data.user?.must_change_password) throw new Error('This account has not chosen its own password yet. Log in to the portal in the browser once, choose a password, then run this again.');
  token = login.data.token;
  const sql = async (q: string, params: any[] = []) => {
    const r = await call('POST', '/admin/sql', { sql: q, params });
    if (r.status !== 200) throw new Error(`The portal refused a request (${r.status}): ${r.data?.message || JSON.stringify(r.data).slice(0, 120)}`);
    return r.data.rows || [];
  };
  const write = async (q: string, params: any[] = []) => {
    const r = await call('POST', '/admin/sql', { sql: q, params });
    if (r.status !== 200) throw new Error(`The portal refused a change (${r.status}): ${r.data?.message || JSON.stringify(r.data).slice(0, 120)}`);
    return { insertId: Number(r.data.insertId || 0), affectedRows: Number(r.data.affectedRows || 0) };
  };
  return { call, sql, write, adminId: Number(login.data.user.id) };
}

// ── the plan ─────────────────────────────────────────────────────────────────

const STATUS: Record<string, string> = { P: 'present', A: 'absent', L: 'late', E: 'excused' };

interface Plan { book: Book; classId: number; create: Pupil[]; have: Map<string, number>; skipDates: string[]; newDates: string[]; unknownCodes: string[]; ownedBy: number }

async function plan(api: Api, book: Book, classes: any[], namesOnly: boolean): Promise<Plan> {
  const cls = classes.find((c) => key(c.name) === key(book.className));
  if (!cls) throw new Error(`${path.basename(book.file)}: the portal has no class called "${book.className}" (it has: ${classes.map((c) => c.name).join(', ')})`);
  const people = await api.sql("SELECT id, name, class_id, archived FROM users WHERE role = 'student'");
  const have = new Map<string, number>();
  for (const p of people) if (p.class_id === cls.id || p.archived) have.set(key(p.name), p.id);
  const create = book.pupils.filter((p) => !have.has(key(p.name)));
  // names and details only: the register days are not looked at, so none are added
  const existing = new Set(namesOnly ? [] : (await api.sql('SELECT date FROM attendance WHERE class_id = ?', [cls.id])).map((r: any) => r.date));
  const dates = namesOnly ? [] : [...new Set(book.attendance.map((a) => a.date))].sort();
  const unknownCodes = [...new Set(book.attendance.map((a) => a.code).filter((c) => !STATUS[c] && c !== 'N'))];
  return { book, classId: cls.id, create, have, skipDates: dates.filter((d) => existing.has(d)), newDates: dates.filter((d) => !existing.has(d)), unknownCodes, ownedBy: api.adminId };
}

const profileNote = (p: Pupil) => [
  p.no !== null ? `Register no. ${p.no}` : '',
  ...p.extra,
  p.dobWritten ? `Date of birth as written: ${p.dobWritten} (not entered: unclear, please confirm)` : '',
  p.from ? `Transferred in: ${p.from}` : '',
  p.check ? `CHECK: ${p.check}` : '',
  p.leftWhy,
].filter(Boolean).join(' | ');

function describe(pl: Plan, namesOnly: boolean) {
  const b = pl.book;
  const lines: string[] = [];
  lines.push(`\n${path.basename(b.file)}  ->  class ${b.className}`);
  lines.push(`  pupils on the list: ${b.pupils.filter((p) => !p.left).length}` + (b.pupils.some((p) => p.left) ? `, and ${b.pupils.filter((p) => p.left).length} who left the class (added as closed accounts${namesOnly ? '' : ' so their days stay in the register'})` : ''));
  lines.push(`  new pupils to add: ${pl.create.length}   already in the portal (left as they are): ${b.pupils.length - pl.create.length}`);
  if (namesOnly) {
    lines.push('  attendance registers: NOT loaded (names and details only)');
  } else {
    lines.push(`  school days in the register: ${pl.newDates.length + pl.skipDates.length}  (to add: ${pl.newDates.length}${pl.skipDates.length ? `, already there: ${pl.skipDates.length}` : ''})` + (pl.newDates.length ? `, ${pl.newDates[0]} to ${pl.newDates[pl.newDates.length - 1]}` : ''));
    lines.push(`  "N" (admitted that day) is ${b.admitted === 'skip' ? 'left out of the count, as the register does' : 'counted as present, as the register does'}`);
  }
  for (const s of b.skipped) lines.push(`  SKIPPED  ${s}`);
  for (const w of b.warnings.slice(0, 5)) lines.push(`  note     ${w}`);
  if (pl.unknownCodes.length) lines.push(`  note     status codes not understood and left out: ${pl.unknownCodes.join(', ')}`);
  const details = pl.create.filter((p) => p.guardian || p.phone || p.address);
  if (details.length) lines.push(`  details to enter: guardian names ${pl.create.filter((p) => p.guardian).length}, phone numbers ${pl.create.filter((p) => p.phone).length}, addresses ${pl.create.filter((p) => p.address).length}`);
  const doubtful = (p: Pupil) => p.extra.filter((e) => /^(Phone|Parent\/guardian) as written/.test(e));
  const check = pl.create.filter((p) => p.check || p.dobWritten || p.left || doubtful(p).length);
  if (check.length) {
    lines.push(`  to check with the school (their notes are kept in the pupil's profile):`);
    for (const p of check) lines.push(`    ${String(p.no ?? '').padStart(2)} ${p.name}: ${[p.check, p.dobWritten && `date of birth as written ${p.dobWritten}`, ...doubtful(p).map((e) => e.charAt(0).toLowerCase() + e.slice(1)), p.left && p.leftWhy].filter(Boolean).join('; ')}`);
  }
  return lines.join('\n');
}

// ── doing it ─────────────────────────────────────────────────────────────────

async function apply(api: Api, pl: Plan): Promise<{ pupils: number; registers: number; closed: number }> {
  const b = pl.book;
  const ids = new Map(pl.have);
  let pupils = 0, registers = 0, closed = 0;

  for (const p of [...pl.create].sort((x, y) => (x.no ?? 1e9) - (y.no ?? 1e9))) {
    const made = await api.call('POST', '/admin/users', { first_name: p.first, last_name: p.last, role: 'student', class_id: pl.classId });
    if (made.status !== 201 || !made.data.reg_number) throw new Error(`Could not add ${p.name}: ${made.status} ${made.data?.message || ''}`);
    const found = await api.sql('SELECT id FROM users WHERE student_number = ?', [made.data.reg_number]);
    const id = Number(found[0]?.id);
    if (!id) throw new Error(`Added ${p.name} but could not find them again`);
    ids.set(key(p.name), id);
    const keep = (col: string) => `${col} = CASE WHEN COALESCE(student_profiles.${col}, '') = '' THEN excluded.${col} ELSE student_profiles.${col} END`;
    await api.write(
      `INSERT INTO student_profiles (user_id, category, status, gender, dob, enrolled_on, guardian_name, guardian_phone, address, notes) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET gender = COALESCE(student_profiles.gender, excluded.gender), dob = COALESCE(student_profiles.dob, excluded.dob),
         enrolled_on = COALESCE(student_profiles.enrolled_on, excluded.enrolled_on), ${keep('guardian_name')}, ${keep('guardian_phone')}, ${keep('address')}, ${keep('notes')}`,
      [id, p.category, p.gender, p.dob, p.enrolledOn, p.guardian, p.phone, p.address, profileNote(p)]);
    pupils++;
  }

  for (const date of pl.newDates) {
    const records: { student_id: number; status: string }[] = [];
    for (const a of b.attendance.filter((x) => x.date === date)) {
      const id = ids.get(key(a.name));
      const status = a.code === 'N' ? (b.admitted === 'present' ? 'present' : '') : STATUS[a.code];
      if (id && status) records.push({ student_id: id, status });
    }
    if (!records.length) continue;
    await api.write('INSERT INTO attendance (class_id, subject_id, teacher_id, date, records) VALUES (?, NULL, ?, ?, ?)', [pl.classId, pl.ownedBy, date, JSON.stringify(records)]);
    registers++;
  }

  // last: closing a pupil clears their class, so it comes after their days are in the registers
  for (const p of pl.create.filter((x) => x.left)) {
    const id = ids.get(key(p.name))!;
    const r = await api.call('POST', `/admin/users/${id}/close`);
    if (r.status !== 200) throw new Error(`Could not close ${p.name}: ${r.status} ${r.data?.message || ''}`);
    await api.write("UPDATE student_profiles SET status = 'left' WHERE user_id = ?", [id]);
    closed++;
  }
  return { pupils, registers, closed };
}

// ── asking questions ─────────────────────────────────────────────────────────

const rl = () => readline.createInterface({ input: process.stdin, output: process.stdout });
// When the answers are piped in (not typed in a window, as in the automated test) all of them arrive at once, so read them all
// first and hand them out one question at a time; a window the person types in is handled question by question below.
let piped: string[] | null = null;
async function pipedAnswer(question: string): Promise<string> {
  process.stdout.write(question + '\n');
  if (!piped) { let all = ''; for await (const chunk of process.stdin) all += chunk; piped = all.split(/\r?\n/); }
  return (piped.shift() ?? '').trim();
}
function ask(question: string, hidden = false): Promise<string> {
  if (!process.stdin.isTTY) return pipedAnswer(question);
  return new Promise((resolve) => {
    if (!hidden) { const i = rl(); i.question(question, (a) => { i.close(); resolve(a.trim()); }); return; }
    process.stdout.write(question);
    let value = '';
    const stdin = process.stdin as any;
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); resolve(value); return; }
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1); else value += c;
      }
    };
    process.stdin.on('data', onData);
  });
}

// With no files named, look on the Desktop and in Downloads, and in any folder there whose name has "class", "register" or "pupil" in it
function findWorkbooks(): string[] {
  const out: string[] = [];
  const wanted = (f: string) => /(Pupils_and_Attendance|Pupil_Details).*\.xlsx$/i.test(f) && !f.startsWith('~$');
  for (const top of [path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'Downloads')]) {
    const dirs = [top];
    try { for (const d of fs.readdirSync(top, { withFileTypes: true })) if (d.isDirectory() && /class|register|pupil/i.test(d.name)) dirs.push(path.join(top, d.name)); } catch { /* no such folder */ }
    for (const dir of dirs) { try { for (const f of fs.readdirSync(dir)) if (wanted(f)) out.push(path.join(dir, f)); } catch { /* unreadable folder */ } }
  }
  return [...new Set(out)].sort();
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const has = (n: string) => { const i = args.indexOf(`--${n}`); if (i < 0) return false; args.splice(i, 1); return true; };           // --yes
  const val = (n: string) => { const i = args.indexOf(`--${n}`); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; }; // --url X
  const url = val('url'), email = val('email'), pw = val('password') ?? process.env.IMPORT_PASSWORD, yes = has('yes'), dry = has('dry-run'), namesOnly = has('names-only');
  let files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    files = findWorkbooks();
    if (!files.length) { console.error('Give the Excel file(s) to load, for example:\n  npm run import:register -- "C:\\Users\\me\\Desktop\\Chakari_ECD_A_2026_Pupils_and_Attendance.xlsx"'); return 1; }
    console.log('Found these class sheets:\n' + files.map((f) => '  ' + f).join('\n'));
  }
  for (const f of files) if (!fs.existsSync(f)) { console.error(`There is no file ${f}`); return 1; }

  const books: Book[] = [];
  for (const f of files) books.push(await readBook(f));
  // two sheets for the same class would each be planned before either is added, and so add every pupil twice
  const seenClass = new Map<string, string>();
  for (const b of books) {
    const prior = seenClass.get(key(b.className));
    if (prior) { console.error(`Two files are for the class ${b.className}: ${path.basename(prior)} and ${path.basename(b.file)}. Load only one of them (move the other out of the way).`); return 1; }
    seenClass.set(key(b.className), b.file);
  }

  const base = url || (await ask(`Portal address [${LIVE}]: `)) || LIVE;
  const mail = email || (await ask('Administrator email: '));
  const secret = pw ?? (await ask('Administrator password (typed here only, not shown): ', true));
  const api = await connect(base, mail, secret);
  const classes = (await api.call('GET', '/admin/classes')).data as any[];
  const plans: Plan[] = [];
  for (const b of books) plans.push(await plan(api, b, classes, namesOnly));

  console.log(`\nPortal: ${base}\nThis will ADD the following. Nothing that is already in the portal is changed or removed.`);
  for (const p of plans) console.log(describe(p, namesOnly));
  const nothing = plans.every((p) => !p.create.length && !p.newDates.length);
  if (nothing) { console.log('\nEverything in these sheets is already in the portal. Nothing to do.'); return 0; }
  if (dry) { console.log('\nDry run: nothing was changed.'); return 0; }

  if (!yes) {
    const word = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base) ? 'yes' : 'IMPORT';
    const answer = await ask(`\nType ${word} to add this to ${base} (anything else cancels): `);
    if (answer !== word) { console.log('Cancelled. Nothing was changed.'); return 0; }
  }

  let bad = 0;
  for (const p of plans) {
    try {
      const done = await apply(api, p);
      console.log(`\n${path.basename(p.book.file)}: added ${done.pupils} pupil(s)${namesOnly ? '' : ` and ${done.registers} register day(s)`}${done.closed ? `, closed ${done.closed} who left` : ''}.`);
    } catch (err: any) {
      bad++;
      console.error(`\n!! ${path.basename(p.book.file)}: stopped part way: ${err.message}\n   Nothing already added was removed. Fix the problem and run this again: it carries on where it stopped.`);
    }
  }
  return bad ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((err) => { console.error('\n!! ' + (err?.message || err)); process.exit(1); });
