// Run: node seed_test_data.js
// This populates the local database with 200 students + realistic data

const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = 'school_portal.db';
const hash = (p) => bcrypt.hashSync(p, 10);

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
  const db = buf ? new SQL.Database(buf) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');

  // ── 1. Clear existing test data (keep classes, users, settings) ──
  const tables = ['payments', 'fee_accounts', 'attendance', 'results', 'homework_submissions',
    'homework', 'timetables', 'subjects', 'courses', 'sport_participants', 'nominations', 'votes'];
  for (const t of tables) db.run(`DELETE FROM ${t}`);
  db.run("DELETE FROM users WHERE role IN ('student','teacher')");

  // ── 2. Ensure classes exist ──
  const classList = [
    'ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3',
    'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'
  ];
  const existing = db.exec("SELECT id, name FROM classes");
  const classMap = {};
  for (const c of existing[0]?.values || []) classMap[c[1]] = c[0];

  for (const name of classList) {
    if (!classMap[name]) {
      const grade = name.includes('ECD') ? 'ECD' : name.replace('Grade ', '');
      const section = name === 'ECD A' ? 'A' : name === 'ECD B' ? 'B' : '';
      db.run('INSERT INTO classes (name, grade, section) VALUES (?,?,?)', [name, grade, section]);
    }
  }
  // Re-fetch class IDs
  const allClasses = db.exec("SELECT id, name FROM classes ORDER BY id")[0].values;
  const cls = {};
  for (const c of allClasses) cls[c[1]] = c[0];
  console.log('Classes:', Object.keys(cls).length);

  // ── 3. Create 10 teachers ──
  const firstNames = ['Tendai','Chido','Tafadzwa','Rumbidzai','Kudzai','Nyasha','Tanaka','Tariro','Anesu','Mufaro'];
  const lastNames = ['Moyo','Ndlovu','Sithole','Dube','Khumalo','Nyoni','Tshuma','Ncube','Mpofu','Sibanda'];
  const teacherNames = [];
  const teacherIds = [];

  for (let i = 0; i < 10; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const name = `${fn} ${ln}`;
    const email = `teacher${i + 1}@school.com`;
    const pass = hash('1234');
    // Assign each teacher a class (first 9 get one class each, 10th is spare)
    const classId = i < 9 ? cls[classList[i]] : null;
    db.run(
      'INSERT INTO users (name, email, password, role, class_id, is_active) VALUES (?,?,?,?,?,1)',
      [name, email, pass, 'teacher', classId]
    );
    const id = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
    teacherNames.push(name);
    teacherIds.push(id);
  }
  console.log('Teachers:', teacherIds.length);

  // ── 4. Create subjects for each class ──
  const subjectPool = ['English','Mathematics','Science','History','Geography','Art','Music','PE','ICT','Shona',
    'Agriculture','Religion','Home Economics','French'];
  let subjCount = 0;
  for (const [cn, cid] of Object.entries(cls)) {
    const teacherId = teacherIds[Object.keys(cls).indexOf(cn) % 10];
    // Each class gets 4-6 subjects
    const count = 4 + (Math.abs(hash(cn).charCodeAt(0)) % 3);
    for (let i = 0; i < count; i++) {
      const sn = subjectPool[(subjectPool.indexOf(cn) + i * 3) % subjectPool.length];
      db.run('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?,?,?)',
        [`${sn}`, cid, teacherId]);
      subjCount++;
    }
  }
  console.log('Subjects:', subjCount);

  // Re-fetch subjects with IDs
  const allSubj = db.exec("SELECT id, class_id FROM subjects ORDER BY id")[0].values;

  // ── 5. Create 200 students ──
  const studFirstNames = ['Takudzwa','Rutendo','Tatenda','Kundai','Makanaka','Panashe','Tadiwa','Kudzanai','Tanyaradzwa',
    'Shamiso','Munyaradzi','Tafara','Ropafadzo','Muchaneta','Masimba','Chiedza','Tanatswa','Nokutenda','Simba','Chipo',
    'Tawana','Kudakwashe','Munashe','Tariro','Tinevimbo','Mufaro','Zvikomborero','Tonderai','Rufaro','Chengetai'];
  const studLastNames = ['Muzenda','Makoni','Chigumba','Mkandla','Mlambo','Ndlovu','Sithole','Mpofu','Ncube','Tshuma',
    'Dube','Khumalo','Nyoni','Moyo','Sibanda','Nkala','Maphosa','Ngwenya','Mthembu','Zulu'];

  const studentIds = [];
  const studentClassMap = {};

  const classKeys = Object.keys(cls);
  for (let i = 0; i < 200; i++) {
    const fn = studFirstNames[i % studFirstNames.length];
    const ln = studLastNames[Math.floor(i / studFirstNames.length) % studLastNames.length];
    const name = `${fn} ${ln}`;
    const year = '26';
    const prefix = 'c';
    const seq = String(i + 1).padStart(5, '0');
    const regNum = `${prefix}${year}${seq}${prefix}`;
    const email = `${regNum}@temp.school`;
    const pass = hash('1234');
    const classKey = classKeys[i % classKeys.length];
    const classId = cls[classKey];

    db.run(
      'INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?,?,?,?,?,?,1)',
      [name, email, pass, 'student', classId, regNum]
    );
    const id = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
    studentIds.push(id);
    studentClassMap[id] = classId;
  }
  console.log('Students:', studentIds.length);

  // ── 6. Create fee accounts + settings ──
  const sdcFee = 100;
  const ssfFee = 60;
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('sdc_fee',?)", [sdcFee.toString()]);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('ssf_fee',?)", [ssfFee.toString()]);

  for (const sid of studentIds) {
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)',
      [sid, 'SDC', sdcFee, sdcFee]);
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)',
      [sid, 'SSF', ssfFee, ssfFee]);
  }
  console.log('Fee accounts: 400 (SDC+SSF per student)');

  // ── 7. Create payments (random ~60% of students have made payments) ──
  let payCount = 0;
  for (const sid of studentIds) {
    if (Math.random() > 0.6) continue; // 40% haven't paid
    const types = ['SDC', 'SSF'];
    for (const at of types) {
      if (Math.random() > 0.7) continue; // 70% have SDC, 50% of those also have SSF
      const amt = at === 'SDC'
        ? Math.round((20 + Math.random() * 80) * 100) / 100
        : Math.round((10 + Math.random() * 50) * 100) / 100;
      const status = Math.random() > 0.2 ? 'verified' : 'pending';
      const days = Math.floor(Math.random() * 30);
      const date = new Date(Date.now() - days * 86400000).toISOString();
      const receipt = `RCP-${String(sid).padStart(4, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      db.run(
        "INSERT INTO payments (student_id, account_type, amount, proof_file, notes, receipt_number, status, created_at) VALUES (?,?,?,'',?,?,?,?)",
        [sid, at, amt, `Payment for ${at}`, receipt, status, date]
      );
      const payId = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
      payCount++;
      // Update balance
      if (status === 'verified' || status === 'pending') {
        db.run('UPDATE fee_accounts SET balance = balance - ? WHERE student_id = ? AND account_type = ?',
          [amt, sid, at]);
      }
    }
  }
  console.log('Payments:', payCount);

  // ── 8. Create results for all students ──
  let resCount = 0;
  for (const sid of studentIds) {
    const cid = studentClassMap[sid];
    const classSubjects = allSubj.filter(s => s[1] === cid);
    for (const [subjId] of classSubjects) {
      if (Math.random() > 0.85) continue; // ~15% per subject
      const score = Math.round(30 + Math.random() * 70);
      const grd = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 40 ? 'D' : 'E';
      db.run(
        'INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, score, grade) VALUES (?,?,?,?,?,?,?)',
        [sid, subjId, teacherIds[cid % 10], 'Term 1', '2026', score, grd]
      );
      resCount++;
    }
  }
  console.log('Results:', resCount);

  // ── 9. Create attendance records ──
  let attCount = 0;
  const statuses = ['present', 'present', 'present', 'late', 'absent']; // weighted
  for (const sid of studentIds) {
    const cid = studentClassMap[sid];
    for (let d = 0; d < 5; d++) {
      const date = new Date(2026, 4, 12 + d).toISOString().slice(0, 10);
      const s = statuses[Math.floor(Math.random() * statuses.length)];
      // Simplified: store as individual records in JSON array or use attendance table
      // The attendance table uses a JSON records column, so let's do per-date teacher entries
    }
  }
  // Simpler approach: create attendance records per teacher per date
  for (let d = 0; d < 10; d++) {
    const date = new Date(2026, 4, 12 + d).toISOString().slice(0, 10);
    for (const tid of teacherIds.slice(0, 5)) {
      const cid = teacherIds.indexOf(tid) < classKeys.length ? cls[classKeys[teacherIds.indexOf(tid)]] : null;
      if (!cid) continue;
      const classStudents = studentIds.filter(sid => studentClassMap[sid] === cid);
      const records = classStudents.map(sid => ({
        student_id: sid,
        status: statuses[Math.floor(Math.random() * statuses.length)]
      }));
      db.run('INSERT INTO attendance (class_id, teacher_id, date, records) VALUES (?,?,?,?)',
        [cid, tid, date, JSON.stringify(records)]);
      attCount++;
    }
  }
  console.log('Attendance records:', attCount);

  // ── 10. Create some timetable entries ──
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let ttCount = 0;
  for (const [cn, cid] of Object.entries(cls)) {
    const classSubjects = allSubj.filter(s => s[1] === cid);
    for (let di = 0; di < 3; di++) {
      const subj = classSubjects[di % classSubjects.length];
      if (!subj) continue;
      const hour = 8 + di * 2;
      db.run(
        'INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room, status) VALUES (?,?,?,?,?,?,?,?)',
        [cid, subj[0], teacherIds[Object.keys(cls).indexOf(cn) % 10], days[di],
         `${String(hour).padStart(2, '0')}:00`, `${String(hour + 1).padStart(2, '0')}:00`,
         `Room ${101 + di}`, 'published']
      );
      ttCount++;
    }
  }
  console.log('Timetable entries:', ttCount);

  // ── Save ──
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('\n✅ Database saved to', dbPath);
  console.log('Admin login: any admin account');
  console.log('Student login: any student can activate via reg number or has password 1234');
  console.log('Teacher login: teacher1@school.com through teacher10@school.com, password: 1234');
  console.log('\nSDC fee: $100  |  SSF fee: $60');
  console.log('Payments: ~60% of students have made partial payments');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
