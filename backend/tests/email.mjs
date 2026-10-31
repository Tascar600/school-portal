// Emailed backups, checked against a pretend mail server. Nothing real is ever sent.
// Starts a pretend SMTP server on port 5097 and throw-away copies of the portal on port 5059 (each with its own data folder),
// then checks what arrives: the database, the new uploaded files only, the daily automatic send, and how failures are reported.
//                                                                                            npm run test:email
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const JSZip = createRequire(import.meta.url)('jszip');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const PORT = 5059, API = `http://localhost:${PORT}/api`, SMTP = 5097;
const OUT = path.join(HERE, 'browser', 'output');
const DATA1 = path.join(OUT, 'email-data-1'), DATA2 = path.join(OUT, 'email-data-2'), DATA3 = path.join(OUT, 'email-data-3');
const USER = 'portal-sender@example.com', PASS = 'abcd efgh ijkl mnop', TO = 'punhamasiwa@gmail.com';
for (const d of [DATA1, DATA2, DATA3]) fs.rmSync(d, { recursive: true, force: true });
const strayUploads = fs.existsSync(path.join(BACKEND, 'uploads/homework')) ? fs.readdirSync(path.join(BACKEND, 'uploads/homework')).length : 0;

let ok = 0, failed = 0;
const check = (name, pass, detail = '') => { pass ? ok++ : failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : '  -> ' + detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, p, token, body) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
async function waitFor(fn, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(250); } return false; }

// ── the pretend mail server: accepts one user name and password, keeps every message it is given ────────────────────
const messages = [];
let rejectLogin = false;
const smtp = net.createServer((socket) => {
  socket.setEncoding('latin1');
  let buffer = '', inData = false, searchFrom = 0, current = null;
  const send = (s) => socket.write(s + '\r\n');
  send('220 localhost pretend mail server');
  socket.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      if (inData) {
        const end = buffer.indexOf('\r\n.\r\n', searchFrom);
        if (end < 0) { searchFrom = Math.max(0, buffer.length - 4); return; }
        current.raw = buffer.slice(0, end).replace(/\r\n\.\./g, '\r\n.');
        buffer = buffer.slice(end + 5); inData = false; searchFrom = 0;
        messages.push(current); current = null; send('250 queued');
        continue;
      }
      const nl = buffer.indexOf('\r\n'); if (nl < 0) return;
      const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO' || cmd === 'HELO') socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n');
      else if (cmd === 'AUTH') {
        const [, user, pass] = Buffer.from(line.split(' ')[2] || '', 'base64').toString().split('\0');
        if (rejectLogin || user !== USER || pass !== PASS) send('535 5.7.8 Username and Password not accepted'); else send('235 2.7.0 Accepted');
      }
      else if (cmd === 'MAIL') { current = { from: line.slice(10).replace(/[<>]/g, ''), to: [], raw: '' }; send('250 OK'); }
      else if (cmd === 'RCPT') { current.to.push(line.slice(8).replace(/[<>]/g, '')); send('250 OK'); }
      else if (cmd === 'DATA') { inData = true; searchFrom = 0; send('354 go ahead'); }
      else if (cmd === 'QUIT') { send('221 bye'); socket.end(); }
      else send('250 OK');
    }
  });
  socket.on('error', () => {});
});
await new Promise((r) => smtp.listen(SMTP, '127.0.0.1', r));

// What a message says: subject, the plain text, and every attachment with its bytes
function parse(msg) {
  const [head, ...bodyParts] = msg.raw.split('\r\n\r\n');
  const headers = head.replace(/\r\n[ \t]+/g, ' ');
  const header = (h, name) => new RegExp('^' + name + ':\\s*(.*)$', 'im').exec(h)?.[1]?.trim() || '';
  const boundary = /boundary="?([^";\r\n]+)"?/i.exec(headers)?.[1];
  const out = { subject: header(headers, 'Subject'), text: '', attachments: [] };
  for (const part of msg.raw.split('--' + boundary).slice(1)) {
    const [ph, ...pb] = part.replace(/^\r\n/, '').split('\r\n\r\n');
    const body = pb.join('\r\n\r\n').replace(/\r\n$/, '');
    const hd = ph.replace(/\r\n[ \t]+/g, ' ');
    const enc = header(hd, 'Content-Transfer-Encoding').toLowerCase();
    const name = /filename="?([^";\r\n]+)"?/i.exec(hd)?.[1];
    if (name) out.attachments.push({ filename: name, data: Buffer.from(body.replace(/\r\n/g, ''), 'base64') });
    else if (/text\/plain/i.test(hd)) out.text = enc === 'base64' ? Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString() : enc === 'quoted-printable' ? body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : body;
  }
  return out;
}

// ── a throw-away portal ──────────────────────────────────────────────────────────────────────────────────────────────
function startPortal(dataDir, { email = true, delay = '1500' } = {}) {
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, FIRST_LOGIN_PASSWORD_CHANGE: 'off', AUTH_RATE_LIMIT: '2000', BACKUP_EMAIL_START_DELAY_MS: delay };
  for (const k of ['DB_PATH', 'BACKUP_EMAIL_TO', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'RENDER']) delete env[k];
  if (email) Object.assign(env, { BACKUP_EMAIL_TO: TO, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(SMTP), SMTP_USER: USER, SMTP_PASS: PASS });
  const server = spawn(process.execPath, [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], { cwd: BACKEND, env, stdio: 'ignore' });
  return server;
}
async function up() { for (let i = 0; i < 40; i++) { try { if ((await fetch(API + '/branding')).ok) return; } catch { /* not up yet */ } await sleep(500); } }
let current;
const run = async (...a) => { current = startPortal(...a); await up(); };
const stop = async () => { try { current?.kill(); } catch { /* gone */ } current = null; await sleep(800); };
process.on('exit', () => { try { current?.kill(); } catch { /* gone */ } try { smtp.close(); } catch { /* closed */ } });
const login = async () => (await call('POST', '/auth/login', null, { email: 'punhamasiwa@gmail.com', password: '1234' })).data.token;

try {
  // 1. A brand-new school has nothing worth emailing: the daily automatic send stays quiet
  await run(DATA1);
  await sleep(4000);
  check('a school with only the two starting accounts is not emailed automatically', messages.length === 0, `${messages.length} message(s)`);

  const A = await login();
  const status0 = (await call('GET', '/admin/backups', A)).data;
  check('the Administrator is told emailed backups are on, and where they go', status0.email?.configured === true && status0.email.to === TO && status0.email.lastAt === null && status0.email.lastError === null, JSON.stringify(status0.email));

  // 2. "Email me a backup now": the database, then the uploaded files in zips of under 15 MB
  const up1 = path.join(DATA1, 'uploads/homework'), up2 = path.join(DATA1, 'uploads/payments');
  fs.mkdirSync(up1, { recursive: true }); fs.mkdirSync(up2, { recursive: true });
  const files = [
    [path.join(up1, '1000-first.png'), crypto.randomBytes(6 * 1024 * 1024)],
    [path.join(up1, '2000-second.png'), crypto.randomBytes(6 * 1024 * 1024)],
    [path.join(up1, '3000-third.png'), crypto.randomBytes(6 * 1024 * 1024)],
    [path.join(up2, '4000-proof.png'), crypto.randomBytes(10 * 1024)],
  ];
  const t0 = Date.now() - 60000;
  files.forEach(([f, data], i) => { fs.writeFileSync(f, data); fs.utimesSync(f, new Date(t0 + i * 1000), new Date(t0 + i * 1000)); });

  const r1 = await call('POST', '/admin/backups/email', A);
  check('pressing "Email me a backup now" works', r1.status === 200 && r1.data.sent?.emails === 3 && r1.data.sent.files === 4 && r1.data.sent.filesLeft === 0, JSON.stringify(r1.data).slice(0, 300));
  check('three emails arrived: the database and two zips of uploaded files (18 MB does not fit in one)', messages.length === 3, `${messages.length}`);
  const [m1, m2, m3] = messages.map(parse);
  const db = m1?.attachments[0];
  check('email 1 carries the database as the plain file Restore Database accepts', /^school_portal-\d{4}-\d{2}-\d{2}\.db$/.test(db?.filename || '') && db.data.subarray(0, 15).toString() === 'SQLite format 3' && db.data.length > 1000, db?.filename);
  check('it says how to restore, and asks to be kept private', /Restore Database/.test(m1?.text) && /private/i.test(m1.text) && /4 new uploaded files/.test(m1.text), m1?.text.slice(0, 300));
  check('it goes to the chosen address, from the mail account', messages.every((m) => m.to.includes(TO) && m.from === USER), JSON.stringify(messages.map((m) => [m.from, m.to])));
  check('the uploaded files follow in parts 1 of 2 and 2 of 2', /uploaded files 1 of 2/.test(m2?.subject) && /uploaded files 2 of 2/.test(m3?.subject), `${m2?.subject} | ${m3?.subject}`);
  const z2 = await JSZip.loadAsync(m2.attachments[0].data), z3 = await JSZip.loadAsync(m3.attachments[0].data);
  const names = [...Object.keys(z2.files), ...Object.keys(z3.files)].filter((n) => !n.endsWith('/')).sort();
  check('together the zips hold exactly the four uploaded files, in their folders', JSON.stringify(names) === JSON.stringify(['homework/1000-first.png', 'homework/2000-second.png', 'homework/3000-third.png', 'payments/4000-proof.png']), JSON.stringify(names));
  const back = Buffer.concat([await z2.file('homework/1000-first.png').async('nodebuffer')]);
  check('and the files come out byte for byte the same', back.equals(files[0][1]) && (await z3.file('payments/4000-proof.png').async('nodebuffer')).equals(files[3][1]));

  const status1 = (await call('GET', '/admin/backups', A)).data;
  check('afterwards the portal shows when it last emailed, with no error', !!status1.email.lastAt && status1.email.lastError === null && status1.email.backlog === false, JSON.stringify(status1.email));
  check('an emailed copy counts as a downloaded backup (the dashboard stops asking for one)', /email to/.test(status1.lastDownloadBy || '') && status1.stale === false, `${status1.lastDownloadBy} stale=${status1.stale}`);

  // 3. Only NEW uploaded files go out next time
  const before = messages.length;
  const r2 = await call('POST', '/admin/backups/email', A);
  check('pressing it again with nothing new sends just the database', r2.status === 200 && messages.length === before + 1 && r2.data.sent.files === 0 && /no new uploaded files/i.test(parse(messages[before]).text), `${messages.length - before} email(s)`);
  const fresh = path.join(up1, '5000-new.png'); fs.writeFileSync(fresh, crypto.randomBytes(2048));
  const before2 = messages.length;
  const r3 = await call('POST', '/admin/backups/email', A);
  const zNew = messages.length === before2 + 2 ? await JSZip.loadAsync(parse(messages[before2 + 1]).attachments[0].data) : null;
  check('a newly uploaded file goes out alone, the old ones are not sent again', r3.status === 200 && !!zNew && JSON.stringify(Object.keys(zNew.files).filter((n) => !n.endsWith('/'))) === JSON.stringify(['homework/5000-new.png']), `${messages.length - before2} email(s)`);

  // 4. When the mail server says no, the Administrator is told why, in plain words, and the password is never shown
  rejectLogin = true;
  const before3 = messages.length;
  const bad = await call('POST', '/admin/backups/email', A);
  check('a refused log in is reported with advice, not a stack trace', bad.status === 502 && /App Password/.test(bad.data.message) && messages.length === before3, JSON.stringify(bad.data).slice(0, 200));
  check('the password never appears in what the Administrator sees', !JSON.stringify(bad.data).includes('abcd efgh'));
  const status2 = (await call('GET', '/admin/backups', A)).data;
  check('the failure stays visible in the Backups panel', /App Password/.test(status2.email.lastError || ''), status2.email.lastError);
  rejectLogin = false;
  const good = await call('POST', '/admin/backups/email', A);
  check('once the mail server accepts again it works, and the error clears', good.status === 200 && (await call('GET', '/admin/backups', A)).data.email.lastError === null);

  // 5. Only the Administrator may do this
  const bursar = (await call('POST', '/auth/login', null, { email: 'tascarmasiwa@gmail.com', password: '12345678' })).data.token;
  check('nobody but the Administrator can send it (or see where it goes)', (await call('POST', '/admin/backups/email', bursar)).status === 403 && (await call('POST', '/admin/backups/email')).status === 401);
  await stop();

  // 6. The daily automatic send: once the school has pupils, it goes out by itself, and then not again the same day
  await run(DATA2, { delay: '60000' });
  const A2 = await login();
  const grade1 = (await call('GET', '/admin/classes', A2)).data.find((c) => c.name === 'Grade 1').id;
  await call('POST', '/admin/users', A2, { first_name: 'Anna', last_name: 'Moyo', role: 'student', class_id: grade1 });
  const autoBefore = messages.length;
  await stop(); await run(DATA2, { delay: '1500' });
  const arrived = await waitFor(() => messages.length > autoBefore);
  check('with a pupil in the school, the portal emails the backup by itself after starting', arrived && parse(messages[autoBefore]).attachments[0]?.filename.endsWith('.db'), `${messages.length - autoBefore} new message(s)`);
  const sent = messages.length;
  await stop(); await run(DATA2, { delay: '1500' });
  await sleep(4500);
  check('and does not send another the same day, however often the portal restarts', messages.length === sent, `${messages.length - sent} extra message(s)`);
  await stop();

  // 7. Not set up: switched off, and says so
  await run(DATA3, { email: false });
  const A3 = await login();
  const off = await call('GET', '/admin/backups', A3);
  const offTry = await call('POST', '/admin/backups/email', A3);
  check('without the mail settings the feature is off and says how to switch it on', off.data.email?.configured === false && offTry.status === 400 && /not set up/.test(offTry.data.message), JSON.stringify(offTry.data));
  await stop();

  check('nothing was written into the project\'s own uploads folder', (fs.existsSync(path.join(BACKEND, 'uploads/homework')) ? fs.readdirSync(path.join(BACKEND, 'uploads/homework')).length : 0) === strayUploads);
} finally {
  await stop();
  smtp.close();
  for (const d of [DATA1, DATA2, DATA3]) fs.rmSync(d, { recursive: true, force: true });
}

console.log(`\n${ok}/${ok + failed} emailed-backup checks passed`);
process.exit(failed ? 1 : 0);
