// Automatic text messages, checked against a pretend SMS service. Nothing real is ever sent.
// Starts (1) a mock SMS service on port 5098 and (2) a second, throw-away copy of the portal on port 5056 with an empty
// database and SMS switched on, pointed at that mock; then checks what the portal sends and how it copes when the
// service says no, or never answers.       npm run test:sms
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const PORT = 5056, API = `http://localhost:${PORT}/api`, MOCK = 5098;
const DB = path.join(HERE, 'browser', 'output', 'sms-test.db');
fs.mkdirSync(path.dirname(DB), { recursive: true });
fs.rmSync(DB, { force: true });

let ok = 0, failed = 0;
const check = (name, pass, detail = '') => { pass ? ok++ : failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : '  -> ' + detail}`); };
const call = async (method, p, token, body) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// The pretend SMS service: records every request; answers 500 for numbers ending 999, never answers for numbers ending 888
const received = [];
const mock = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    received.push({ auth: req.headers.authorization, body });
    if (String(body.to).endsWith('888')) return; // no answer
    if (String(body.to).endsWith('999')) { res.statusCode = 500; return res.end('provider is down'); }
    res.statusCode = 200; res.end('{"queued":true}');
  });
});
await new Promise((r) => mock.listen(MOCK, r));

const env = { ...process.env, PORT: String(PORT), DB_PATH: DB, FIRST_LOGIN_PASSWORD_CHANGE: 'off', AUTH_RATE_LIMIT: '2000', SMS_WEBHOOK_URL: `http://localhost:${MOCK}/send`, SMS_WEBHOOK_TOKEN: 'test-token', SMS_SENDER_ID: 'CHAKARI' };
const server = spawn(process.execPath, [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], { cwd: BACKEND, env, stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* already gone */ } try { mock.close(); } catch { /* already closed */ } };
process.on('exit', stop);

try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(API + '/branding')).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
  const A = (await call('POST', '/auth/login', null, { email: 'punhamasiwa@gmail.com', password: '1234' })).data.token;
  const B = (await call('POST', '/auth/login', null, { email: 'tascarmasiwa@gmail.com', password: '12345678' })).data.token;
  check('the throw-away portal is running and both accounts log in', !!A && !!B);

  const classes = (await call('GET', '/admin/classes', A)).data;
  const grade1 = classes.find((c) => c.name === 'Grade 1').id;
  const people = [['Anna', 'Moyo', '0771234567'], ['Ben', 'Dube', '+263 71 222 3333'], ['Cara', 'Ncube', ''], ['Dan', 'Sibanda', '0770000999'], ['Eve', 'Zhou', '12345'], ['Finn', 'Banda', '0770000888']];
  for (const [first, last] of people) await call('POST', '/admin/users', A, { first_name: first, last_name: last, role: 'student', class_id: grade1 });
  const users = (await call('GET', '/admin/users', A)).data;
  const id = Object.fromEntries(people.map(([first, last]) => [first, users.find((u) => u.name === `${first} ${last}`).id]));
  for (const [first, last, phone] of people) await call('PUT', `/student-profiles/${id[first]}`, B, { guardian_name: `Guardian of ${first}`, guardian_phone: phone });

  const cfg = await call('GET', '/messages/config', B);
  check('the Bursar is told automatic SMS is switched on, and from whom', cfg.data.smsEnabled === true && cfg.data.sender === 'CHAKARI', JSON.stringify(cfg.data));
  check('someone who is not logged in is told nothing', (await call('GET', '/messages/config', null)).status === 401);

  const list = (await call('POST', '/messages/bulk-reminder', B, { template: 'Dear parent, {student} of {class} owes {balance}. {school}', min_balance: 0, channel: 'sms' })).data;
  const by = (first) => list.find((r) => r.student_name.startsWith(first));
  check('the preview lists every pupil with their number written in international form', list.length === 6 && by('Anna').e164 === '+263771234567' && by('Ben').e164 === '+263712223333' && by('Dan').e164 === '+263770000999', JSON.stringify(list.map((r) => [r.student_name, r.e164])));
  check('a missing or invalid number is flagged, not guessed', by('Cara').e164 === null && by('Eve').e164 === null);
  check('the "open in messages" link is ready for a phone', by('Anna').smsUrl.startsWith('sms:+263771234567?&body=') && decodeURIComponent(by('Anna').smsUrl).includes('Anna Moyo'), by('Anna').smsUrl);
  check('the WhatsApp link now carries the country code (a number typed as 077… used to break it)', by('Anna').waUrl.startsWith('https://wa.me/263771234567?text='), by('Anna').waUrl);

  // sending
  const sent = await call('POST', `/messages/${by('Anna').message_id}/send-sms`, B);
  check('sending one text works and reports it was sent', sent.status === 200 && sent.data.status === 'sent', JSON.stringify(sent.data));
  const one = received[0];
  check('the SMS service received the right number, the message and the sender name', one?.body.to === '+263771234567' && one.body.message.includes('Anna Moyo') && one.body.from === 'CHAKARI', JSON.stringify(one?.body));
  check('and the secret token, so only this portal can use the service', one?.auth === 'Bearer test-token', String(one?.auth));
  const failedOne = await call('POST', `/messages/${by('Dan').message_id}/send-sms`, B);
  check('when the service refuses, the text is marked "failed" with the reason', failedOne.status === 502 && failedOne.data.status === 'failed' && /500/.test(failedOne.data.error) && /provider is down/.test(failedOne.data.error), JSON.stringify(failedOne.data));
  const noNumber = await call('POST', `/messages/${by('Cara').message_id}/send-sms`, B);
  check('a guardian with no number is "failed" with a plain reason, and nothing is sent', noNumber.status === 502 && /no valid phone/i.test(noNumber.data.error) && received.length === 2, JSON.stringify({ r: noNumber.data, calls: received.length }));
  const t0 = Date.now();
  const silent = await call('POST', `/messages/${by('Finn').message_id}/send-sms`, B);
  check('a service that never answers is given up on after about 10 seconds', silent.status === 502 && /did not answer/.test(silent.data.error) && Date.now() - t0 < 14000, `${Date.now() - t0} ms, ${JSON.stringify(silent.data)}`);

  const batch = await call('POST', '/messages/send-sms-batch', B, { ids: [by('Ben').message_id, by('Dan').message_id, by('Eve').message_id] });
  check('"send all" tries each one separately: one sent, two failed, none stops the rest', batch.data.sent === 1 && batch.data.failed === 2, JSON.stringify(batch.data));

  const history = (await call('GET', '/messages', B)).data;
  const row = (first) => history.find((h) => h.id === by(first).message_id);
  check('the history shows who got a text, who failed, and why', row('Anna').status === 'sent' && row('Anna').channel === 'sms' && row('Ben').status === 'sent' && row('Dan').status === 'failed' && /500/.test(row('Dan').error) && row('Cara').status === 'failed', JSON.stringify(['Anna', 'Ben', 'Dan', 'Cara'].map((n) => [n, row(n).status])));
  const log = (await call('GET', '/audit?from=2000-01-01&to=2100-01-01', A)).data.rows;
  await new Promise((r) => setTimeout(r, 500));
  const log2 = (await call('GET', '/audit?from=2000-01-01&to=2100-01-01', A)).data.rows;
  check('the audit trail records the texts that were sent', log2.some((l) => l.action === 'Sent fee reminder by SMS') && log2.some((l) => l.action === 'Sent fee reminders by SMS'), JSON.stringify([...new Set(log2.map((l) => l.action))]));
  void log;
  check('the Administrator cannot send texts (money messages are the Bursar\'s)', (await call('POST', `/messages/${by('Ben').message_id}/send-sms`, A)).status === 403);
} finally {
  stop();
  await new Promise((r) => setTimeout(r, 500));
  fs.rmSync(DB, { force: true });
}
console.log(`\n${ok}/${ok + failed} text-message checks passed`);
process.exit(failed ? 1 : 0);
