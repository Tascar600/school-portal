// Tests scripts/import-register.ts (loading a class list and its register from the school's Excel sheets) against a real portal.
// The sheets are made here from invented names; no real pupil appears anywhere in the tests.
//
//   cd backend
//   npm run test:import        (node --test tests/import-register.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSX = path.join(BACKEND, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const ExcelJS = createRequire(import.meta.url)(path.join(BACKEND, 'node_modules', 'exceljs'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (s) => new Date(s + 'T00:00:00.000Z');

/** A workbook laid out like the school's scanned-register sheets. */
async function makeBook(file, { cls, nRule, pupils, matrix, attendance }) {
  const wb = new ExcelJS.Workbook();
  const ps = wb.addWorksheet('Pupils');
  ps.addRow([`Test School - ${cls} 2026 class list`]);
  ps.addRow(['Transcribed from the scanned class register.']);
  ps.addRow([]);
  ps.addRow(['Register No', 'First Name', 'Surname', 'Gender', 'Date of Birth', 'DOB as written', 'Class 2026', 'Class 2027', 'Status', 'Promote?', 'Check / Notes']);
  for (const p of pupils) ps.addRow([p.no, p.first, p.last, p.gender, p.dob ? D(p.dob) : null, p.written ?? null, cls, 'next', p.status || 'Active', 'Yes', p.check || null]);
  ps.addRow([]);
  ps.addRow(['Totals']);
  ps.addRow(['Pupils on register', null, pupils.length]);

  const reg = wb.addWorksheet('Attendance Register');
  reg.addRow([`${cls} 2026 - Register of Attendance`]);
  reg.addRow([`Codes: P = present, A = absent, N = admitted that day (${nRule}, as in the register), H = holiday / school closed, T = transferred, - = not on roll`]);
  reg.addRow([]);
  reg.addRow(['No', 'First Name', 'Surname', 'Gender', ...matrix.dates.map(() => 'W/E 11/09/26'), 'Days Present', 'Days Absent', 'Possible Days', 'Attendance %']);
  reg.addRow(['No', 'First Name', 'Surname', 'Gender', ...matrix.dates.map(D), 'Days Present', 'Days Absent', 'Possible Days', 'Attendance %']);
  for (const row of matrix.rows) reg.addRow([row.no, row.first, row.last, row.g, ...row.marks, null, null, null, null]);

  const at = wb.addWorksheet('Attendance Import');
  at.addRow(['Register No', 'First Name', 'Surname', 'Class', 'Date', 'Status Code', 'Status']);
  for (const [no, first, last, date, code] of attendance) at.addRow([no, first, last, cls, D(date), code, code]);
  await wb.xlsx.writeFile(file);
}

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });

test('import-register: class list and register go into the right classes, once, and nothing real is touched twice', { timeout: 240000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-register-'));
  let server;
  let serverLog = '';
  try {
    // ── ECD A: "N" is not counted. Dates: Mon 7th is a holiday ──
    const A = path.join(dir, 'ecd_a_Pupils_and_Attendance.xlsx');
    await makeBook(A, {
      cls: 'ECD A', nRule: 'not counted',
      pupils: [
        { no: 1, first: 'ANNA', last: 'TESTONE', gender: 'Female', dob: '2022-06-26', written: '26.06.22' },
        { no: 2, first: 'BEN', last: 'SAMPLE', gender: 'Male', written: '21.01.22', check: 'DOB year cut off in scan' },
        { no: 4, first: 'CARA', last: 'EXAMPLE', gender: 'Female', check: 'Surname unclear - confirm' },
        { no: 5, first: '(NAME MISSING)', last: null, gender: 'Male' },
      ],
      matrix: {
        dates: ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'],
        rows: [
          { no: 1, first: 'ANNA', last: 'TESTONE', g: 'F', marks: ['H', 'P', 'A', 'P'] },
          { no: 2, first: 'BEN', last: 'SAMPLE', g: 'M', marks: ['H', 'N', 'P', 'P'] },
          { no: 3, first: 'MIRA', last: 'LEFTOUT', g: 'F', marks: ['H', 'P', 'P', 'P'] },     // in the register all term, but not on the class list
          { no: 4, first: 'CARA', last: 'EXAMPLE', g: 'F', marks: ['H', 'P', 'P', 'A'] },
          { no: 7, first: 'DAN', last: 'GONE', g: 'M', marks: ['H', 'P', 'A', 'T'] },        // transferred out
        ],
      },
      attendance: [
        [1, 'ANNA', 'TESTONE', '2026-09-08', 'P'], [1, 'ANNA', 'TESTONE', '2026-09-09', 'A'], [1, 'ANNA', 'TESTONE', '2026-09-10', 'P'],
        [2, 'BEN', 'SAMPLE', '2026-09-08', 'N'], [2, 'BEN', 'SAMPLE', '2026-09-09', 'P'], [2, 'BEN', 'SAMPLE', '2026-09-10', 'P'],
        [3, 'MIRA', 'LEFTOUT', '2026-09-08', 'P'], [3, 'MIRA', 'LEFTOUT', '2026-09-09', 'P'], [3, 'MIRA', 'LEFTOUT', '2026-09-10', 'P'],
        [4, 'CARA', 'EXAMPLE', '2026-09-08', 'P'], [4, 'CARA', 'EXAMPLE', '2026-09-09', 'P'], [4, 'CARA', 'EXAMPLE', '2026-09-10', 'A'],
        [5, '(NAME MISSING)', null, '2026-09-08', 'P'],
        [7, 'DAN', 'GONE', '2026-09-08', 'P'], [7, 'DAN', 'GONE', '2026-09-09', 'A'],
      ],
    });
    // ── ECD B: "N" is counted as present ──
    const Bk = path.join(dir, 'ecd_b_Pupils_and_Attendance.xlsx');
    await makeBook(Bk, {
      cls: 'ECD B', nRule: 'counted as present',
      pupils: [{ no: 1, first: 'ELLA', last: 'NEWCOMER', gender: 'Female' }],
      matrix: { dates: ['2026-09-08', '2026-09-09'], rows: [{ no: 1, first: 'ELLA', last: 'NEWCOMER', g: 'F', marks: ['N', 'P'] }] },
      attendance: [[1, 'ELLA', 'NEWCOMER', '2026-09-08', 'N'], [1, 'ELLA', 'NEWCOMER', '2026-09-09', 'P']],
    });
    const wrongClass = path.join(dir, 'nowhere_Pupils_and_Attendance.xlsx');
    await makeBook(wrongClass, { cls: 'Grade 9', nRule: 'not counted', pupils: [{ no: 1, first: 'ZED', last: 'ZERO', gender: 'Male' }], matrix: { dates: ['2026-09-08'], rows: [] }, attendance: [[1, 'ZED', 'ZERO', '2026-09-08', 'P']] });

    // ── a real portal, with the Administrator able to log in ──
    const port = await freePort();
    const env = { ...process.env, PORT: String(port), DATA_DIR: path.join(dir, 'data'), JWT_SECRET: 'import-test', FIRST_LOGIN_PASSWORD_CHANGE: 'off', AUTH_RATE_LIMIT: '2000' };
    for (const k of Object.keys(env)) if (/^BACKUP[_-]|^RESET_STARTING|^DB_PATH$/.test(k)) delete env[k];
    server = spawn(process.execPath, [TSX, 'src/index.ts'], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', (d) => { serverLog += d; }); server.stderr.on('data', (d) => { serverLog += d; });
    const url = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up && server.exitCode === null; i++) { try { up = (await fetch(url + '/api/health')).ok; } catch { /* starting */ } if (!up) await sleep(500); }
    assert.ok(up, 'the test portal did not start');
    const login = await (await fetch(url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'punhamasiwa@gmail.com', password: '1234' }) })).json();
    assert.ok(login.token, 'the test Administrator could not log in: ' + JSON.stringify(login));
    const sql = async (q, params = []) => (await (await fetch(url + '/api/admin/sql', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + login.token }, body: JSON.stringify({ sql: q, params }) })).json()).rows;
    // The importer runs as a separate program, waited for without blocking this test's own network connections.
    const importer = (args) => new Promise((resolve) => {
      const p = spawn(process.execPath, [TSX, 'scripts/import-register.ts', ...args], { cwd: BACKEND });
      let stdout = '', stderr = '';
      p.stdout.on('data', (d) => { stdout += d; }); p.stderr.on('data', (d) => { stderr += d; });
      p.on('close', (status) => resolve({ status, stdout, stderr }));
    });
    const run = (files, extra = []) => importer([...files, '--url', url, '--email', 'punhamasiwa@gmail.com', '--password', '1234', ...extra]);
    const count = async () => (await sql("SELECT COUNT(*) n FROM users WHERE role = 'student'"))[0].n;

    // dry run: says what it would do, changes nothing
    const dry = await run([A, Bk], ['--dry-run']);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Dry run: nothing was changed/);
    assert.match(dry.stdout, /class ECD A/); assert.match(dry.stdout, /class ECD B/);
    assert.match(dry.stdout, /SKIPPED +register no\. 5: no name written/);
    assert.match(dry.stdout, /"N" \(admitted that day\) is left out of the count/);
    assert.match(dry.stdout, /"N" \(admitted that day\) is counted as present/);
    assert.equal(await count(), 0, 'a dry run adds nothing');

    // a class the portal does not have is refused before anything is added
    const bad = await run([wrongClass, '--yes']);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /no class called "Grade 9"/);
    assert.equal(await count(), 0);

    // a wrong password stops at once
    const wrong = await importer([A, '--url', url, '--email', 'punhamasiwa@gmail.com', '--password', 'nope', '--yes']);
    assert.equal(wrong.status, 1);
    assert.match(wrong.stderr, /email or password was not accepted/);

    // the real import
    const go = await run([A, Bk], ['--yes']);
    assert.equal(go.status, 0, go.stdout + go.stderr);
    assert.match(go.stdout, /added 5 pupil\(s\) and 3 register day\(s\), closed 1 who left/);
    assert.match(go.stdout, /added 1 pupil\(s\) and 2 register day\(s\)/);

    const classes = await (await fetch(url + '/api/admin/classes', { headers: { Authorization: 'Bearer ' + login.token } })).json();
    const cid = (n) => classes.find((c) => c.name === n).id;
    const pupil = async (name) => (await sql('SELECT u.id, u.class_id, u.archived, u.is_active, u.student_number, p.gender, p.dob, p.status, p.enrolled_on, p.notes FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id WHERE u.name = ?', [name]))[0];

    const anna = await pupil('ANNA TESTONE');
    assert.equal(anna.class_id, cid('ECD A')); assert.equal(anna.gender, 'F'); assert.equal(anna.dob, '2022-06-26'); assert.equal(anna.is_active, 0);
    assert.match(anna.student_number, /^c\d{7}c$/);
    const ben = await pupil('BEN SAMPLE');
    assert.equal(ben.dob, null, 'an unclear date of birth is not entered'); assert.equal(ben.gender, 'M');
    assert.match(ben.notes, /21\.01\.22/); assert.match(ben.notes, /CHECK: DOB year cut off in scan/);
    assert.equal(ben.enrolled_on, '2026-09-08', 'the day a pupil was admitted is kept');
    const cara = await pupil('CARA EXAMPLE'); assert.match(cara.notes, /CHECK: Surname unclear/);
    const mira = await pupil('MIRA LEFTOUT');
    assert.equal(mira.class_id, cid('ECD A')); assert.equal(mira.archived, 0); assert.match(mira.notes, /NOT ON THE CLASS LIST/);
    const dan = await pupil('DAN GONE');
    assert.equal(dan.archived, 1); assert.equal(dan.class_id, null); assert.equal(dan.status, 'left'); assert.match(dan.notes, /transferred \(T\)/);
    assert.equal(await sql("SELECT COUNT(*) n FROM users WHERE name LIKE '%MISSING%'").then((r) => r[0].n), 0, 'a pupil with no name is not added');
    const ella = await pupil('ELLA NEWCOMER'); assert.equal(ella.class_id, cid('ECD B'));

    // registers: one per school day (not the holiday), "N" handled as each sheet says, the Administrator as owner
    const regsA = await sql('SELECT date, teacher_id, records FROM attendance WHERE class_id = ? ORDER BY date', [cid('ECD A')]);
    assert.deepEqual(regsA.map((r) => r.date), ['2026-09-08', '2026-09-09', '2026-09-10']);
    assert.ok(regsA.every((r) => r.teacher_id === login.user.id));
    const rec = (r) => Object.fromEntries(JSON.parse(r.records).map((x) => [x.student_id, x.status]));
    const day1 = rec(regsA[0]), day2 = rec(regsA[1]);
    assert.equal(day1[anna.id], 'present'); assert.equal(day2[anna.id], 'absent');
    assert.equal(ben.id in day1, false, 'ECD A: "N" (admitted that day) is not counted');
    assert.equal(day2[ben.id], 'present');
    assert.equal(day2[dan.id], 'absent'); assert.equal(rec(regsA[2])[dan.id], undefined, 'nothing after the transfer');
    assert.equal(day1[mira.id], 'present');
    const regsB = await sql('SELECT date, records FROM attendance WHERE class_id = ? ORDER BY date', [cid('ECD B')]);
    assert.equal(rec(regsB[0])[ella.id], 'present', 'ECD B: "N" counts as present, as that sheet says');

    // the portal's own attendance figures agree
    const stats = await (await fetch(`${url}/api/admin/analytics/attendance/${cid('ECD A')}`, { headers: { Authorization: 'Bearer ' + login.token } })).json();
    const s = Object.fromEntries(stats.map((x) => [x.name, x]));
    assert.deepEqual([s['ANNA TESTONE'].present, s['ANNA TESTONE'].absent, s['ANNA TESTONE'].total], [2, 1, 3]);
    assert.deepEqual([s['BEN SAMPLE'].present, s['BEN SAMPLE'].absent, s['BEN SAMPLE'].total], [2, 0, 2]);
    assert.deepEqual([s['CARA EXAMPLE'].present, s['CARA EXAMPLE'].absent, s['CARA EXAMPLE'].total], [2, 1, 3]);

    // again: nothing is added twice
    const again = await run([A, Bk], ['--yes']);
    assert.equal(again.status, 0);
    assert.match(again.stdout, /Everything in these sheets is already in the portal/);
    assert.equal(await count(), 6);
    assert.equal((await sql('SELECT COUNT(*) n FROM attendance'))[0].n, 5);

    // something already in the portal is never overwritten
    await sql("UPDATE users SET name = name WHERE id = ?", [anna.id]);
    await sql("UPDATE student_profiles SET notes = 'edited by the school' WHERE user_id = ?", [anna.id]);
    await run([A], ['--yes']);
    assert.equal((await pupil('ANNA TESTONE')).notes, 'edited by the school');
  } catch (err) {
    console.error('--- the test portal said:\n' + serverLog.slice(-3000)); // so a failure explains itself
    throw err;
  } finally {
    if (server && server.exitCode === null) { server.kill(); await new Promise((r) => server.on('exit', r)); }
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
