// Full database seed script — run directly: node seed_full.js
// Deletes all existing data (except admin) and populates every table
const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = 'school_portal.db';
const hash = p => bcrypt.hashSync(p, 10);

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  const db = buf ? new SQL.Database(buf) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');

  // ─── WIPE ALL DATA (keep admin) ───
  const tables = ['payments','fee_accounts','attendance','results','homework_submissions','homework',
    'timetables','subjects','courses','sport_participants','nominations','votes'];
  for (const t of tables) db.run(`DELETE FROM ${t}`);
  db.run("DELETE FROM users WHERE role IN ('student','teacher')");
  db.run("DELETE FROM classes");

  // ─── CLASSES ───
  const classNames = ['ECD A','ECD B','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7'];
  for (const n of classNames) {
    const grade = n.includes('ECD') ? 'ECD' : n.replace('Grade ', '');
    const section = n === 'ECD A' ? 'A' : n === 'ECD B' ? 'B' : '';
    db.run('INSERT INTO classes (name, grade, section) VALUES (?,?,?)', [n, grade, section]);
  }
  const clsRows = db.exec("SELECT id, name FROM classes ORDER BY id")[0].values;
  const cls = {};
  for (const [id, name] of clsRows) cls[name] = Number(id);

  // ─── TEACHERS (10) ───
  const tdata = [
    ['Tendai Moyo','teacher1@school.com', cls['ECD A']],
    ['Chido Ndlovu','teacher2@school.com', cls['ECD B']],
    ['Tafadzwa Sithole','teacher3@school.com', cls['Grade 1']],
    ['Rumbidzai Dube','teacher4@school.com', cls['Grade 2']],
    ['Kudzai Khumalo','teacher5@school.com', cls['Grade 3']],
    ['Nyasha Nyoni','teacher6@school.com', cls['Grade 4']],
    ['Tanaka Tshuma','teacher7@school.com', cls['Grade 5']],
    ['Tariro Ncube','teacher8@school.com', cls['Grade 6']],
    ['Anesu Mpofu','teacher9@school.com', cls['Grade 7']],
    ['Mufaro Sibanda','teacher10@school.com', null],
  ];
  for (const [name, email, cid] of tdata) {
    db.run("INSERT INTO users (name, email, password, role, class_id, is_active) VALUES (?,?,?,?,?,1)",
      [name, email, hash('1234'), 'teacher', cid]);
  }
  const tIds = (db.exec("SELECT id FROM users WHERE role='teacher' ORDER BY id")[0]?.values || []).map(v => Number(v[0]));

  // ─── SUBJECTS (per class) ───
  const subjPool = ['English','Mathematics','Science','History','Geography','Art','Music','PE','ICT','Shona',
    'Agriculture','Religion','Home Economics','French'];
  const subjCnt = [6,6,6,7,7,7,7,7,7];
  for (let ci = 0; ci < 9; ci++) {
    const cid = cls[classNames[ci]];
    const tid = tIds[ci % 10];
    for (let i = 0; i < subjCnt[ci]; i++) {
      const sn = subjPool[(ci * 7 + i * 3) % subjPool.length];
      db.run('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?,?,?)', [sn, cid, tid]);
    }
  }
  const subjs = (db.exec("SELECT id, class_id FROM subjects ORDER BY id")[0]?.values || []);

  // ─── 200 STUDENTS ───
  const sFNs = ['Takudzwa','Rutendo','Tatenda','Kundai','Makanaka','Panashe','Tadiwa','Kudzanai','Tanyaradzwa',
    'Shamiso','Munyaradzi','Tafara','Ropafadzo','Muchaneta','Masimba','Chiedza','Tanatswa','Nokutenda','Simba','Chipo',
    'Tawana','Kudakwashe','Munashe','Tariro','Tinevimbo','Mufaro','Zvikomborero','Tonderai','Rufaro','Chengetai'];
  const sLNs = ['Muzenda','Makoni','Chigumba','Mkandla','Mlambo','Ndlovu','Sithole','Mpofu','Ncube','Tshuma',
    'Dube','Khumalo','Nyoni','Moyo','Sibanda','Nkala','Maphosa','Ngwenya','Mthembu','Zulu'];

  const sIds = [];
  const keys = Object.keys(cls);
  for (let i = 0; i < 200; i++) {
    const name = `${sFNs[i % sFNs.length]} ${sLNs[Math.floor(i / sFNs.length) % sLNs.length]}`;
    const seq = String(i + 1).padStart(5, '0');
    const reg = `c26${seq}c`;
    db.run("INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?,?,?,?,?,?,1)",
      [name, `${reg}@temp.school`, hash('1234'), 'student', cls[keys[i % keys.length]], reg]);
    sIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
  }

  // ─── FEE SETTINGS ───
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('sdc_fee','100')");
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('ssf_fee','60')");

  // ─── FEE ACCOUNTS ───
  for (const sid of sIds) {
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)', [sid, 'SDC', 100, 100]);
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)', [sid, 'SSF', 60, 60]);
  }

  // ─── PAYMENTS ───
  for (const sid of sIds) {
    if (Math.random() > 0.6) continue;
    const at = Math.random() > 0.5 ? 'SDC' : 'SSF';
    const maxAmt = at === 'SDC' ? 100 : 60;
    const amt = Math.round((5 + Math.random() * (maxAmt - 5)) * 100) / 100;
    const st = Math.random() > 0.15 ? 'verified' : 'pending';
    const days = Math.floor(Math.random() * 30);
    const date = new Date(Date.now() - days * 86400000).toISOString();
    const rec = `RCP-${String(sid).padStart(4, '0')}-${String(100 + Math.floor(Math.random() * 900))}`;
    db.run("INSERT INTO payments (student_id, account_type, amount, proof_file, notes, receipt_number, status, created_at) VALUES (?,?,?,'',?,?,?,?)",
      [sid, at, amt, `Payment for ${at}`, rec, st, date]);
    if (st === 'verified') {
      db.run('UPDATE fee_accounts SET balance = balance - ? WHERE student_id = ? AND account_type = ?', [amt, sid, at]);
    }
  }

  // ─── RESULTS ───

  for (const sid of sIds) {
    const cid = cls[keys[sIds.indexOf(sid) % keys.length]];
    for (const [subjId, scid] of subjs) {
      if (Number(scid) !== cid) continue;
      if (Math.random() > 0.85) continue;
      const score = Math.round(30 + Math.random() * 70);
      const grade = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 40 ? 'D' : 'E';
      db.run('INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, score, grade) VALUES (?,?,?,?,?,?,?)',
        [sid, subjId, tIds[Number(scid) % 10], 'Term 1', '2026', score, grade]);
    }
  }

  // ─── TIMETABLE ───
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  for (let ci = 0; ci < 9; ci++) {
    const cid = cls[classNames[ci]];
    const classSubjs = subjs.filter(v => Number(v[1]) === cid);
    for (let di = 0; di < 5; di++) {
      const subj = classSubjs[di % classSubjs.length];
      if (!subj) continue;
      const hr = 8 + di * 2;
      db.run("INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room, status) VALUES (?,?,?,?,?,?,?,?)",
        [cid, subj[0], tIds[ci % 10], days[di], `${hr}:00`, `${hr + 1}:00`, `Room ${101 + di}`, 'published']);
    }
  }

  // ─── ATTENDANCE ───
  const attStatuses = ['present','present','present','late','absent'];
  for (let d = 0; d < 10; d++) {
    const date = new Date(2026, 4, 12 + d).toISOString().slice(0, 10);
    for (let ci = 0; ci < 5; ci++) {
      const cid = cls[classNames[ci]];
      const tid = tIds[ci % 10];
      const classSids = sIds.filter((_, i) => i % keys.length === ci % keys.length);
      const records = classSids.map(sid => ({
        student_id: sid,
        status: attStatuses[Math.floor(Math.random() * attStatuses.length)]
      }));
      db.run('INSERT INTO attendance (class_id, teacher_id, date, records) VALUES (?,?,?,?)',
        [cid, tid, date, JSON.stringify(records)]);
    }
  }

  // ─── HOMEWORK ───
  for (let ci = 0; ci < 5; ci++) {
    const cid = cls[classNames[ci]];
    const tid = tIds[ci % 10];
    const classSubjs = subjs.filter(v => Number(v[1]) === cid);
    for (const [subjId] of classSubjs.slice(0, 2)) {
      db.run("INSERT INTO homework (subject_id, teacher_id, class_id, title, description, due_date) VALUES (?,?,?,?,?,?)",
        [subjId, tid, cid, `Assignment ${classNames[ci]}`, 'Complete the exercises', '2026-06-15']);
    }
  }

  // ─── COURSES ───
  for (let i = 0; i < 5; i++) {
    db.run("INSERT INTO courses (name, code, description, teacher_id) VALUES (?,?,?,?)",
      [`Course ${i + 1}`, `CRS00${i + 1}`, `Sample course ${i + 1}`, tIds[i]]);
  }

  // ─── SPORTS ───
  const sports = ['Soccer','Netball','Athletics','Basketball','Volleyball'];
  for (const sport of sports) {
    const teamSids = sIds.filter(() => Math.random() > 0.85);
    for (const sid of teamSids) {
      db.run("INSERT INTO sport_participants (sport, student_id, team) VALUES (?,?,?)",
        [sport, sid, `${sport} Team`]);
    }
  }

  // ─── NOMINATIONS + VOTES ───
  const positions = ['Head Boy','Head Girl','Sports Captain','Prefect'];
  for (const pos of positions) {
    const candidates = sIds.filter(() => Math.random() > 0.97);
    for (const candId of candidates) {
      const candName = db.exec(`SELECT name FROM users WHERE id = ${candId}`)[0].values[0][0];
      db.run("INSERT INTO nominations (position, candidate_name, class_id) VALUES (?,?,?)",
        [pos, candName, cls[keys[Math.floor(Math.random() * keys.length)]]]);
      const nomId = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
      // Add a few votes
      for (const voterId of sIds.filter(() => Math.random() > 0.95)) {
        db.run("INSERT INTO votes (nomination_id, voter_id) VALUES (?,?)", [nomId, voterId]);
      }
    }
  }

  // ─── COUNTS ───
  const getCount = (tbl, where = '') => {
    const r = db.exec(`SELECT COUNT(*) FROM ${tbl} ${where}`)[0];
    return r ? r.values[0][0] : 0;
  };
  const counts = {
    students: getCount('users', "WHERE role='student'"),
    teachers: getCount('users', "WHERE role='teacher'"),
    subjects: getCount('subjects'),
    payments: getCount('payments'),
    results: getCount('results'),
    timetable: getCount('timetables'),
    attendance: getCount('attendance'),
    homework: getCount('homework'),
    courses: getCount('courses'),
    sports: getCount('sport_participants'),
    nominations: getCount('nominations'),
    votes: getCount('votes'),
  };

  // ─── SAVE ───
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();

  console.log('✅ Database seeded successfully!');
  console.table(counts);
  console.log('\nCredentials:');
  console.log('  Admin:    punhamasiwa@gmail.com / 1234');
  console.log('  Students: any student, password 1234');
  console.log('  Teachers: teacher1@school.com through teacher10@school.com, password 1234');
})();
