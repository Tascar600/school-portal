// Run: node seed_test_data.js
// Creates a fresh database with 200 students + realistic data
// WARNING: Deletes existing school_portal.db

const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = 'school_portal.db';
const hash = (p) => bcrypt.hashSync(p, 10);

async function main() {
  const SQL = await initSqlJs();

  // Delete existing DB so we start fresh
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON; PRAGMA journal_mode=WAL');

  // ── Create all tables (mirrors database.ts) ──
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
      class_id INTEGER,
      student_number TEXT UNIQUE DEFAULT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      section TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_id INTEGER NOT NULL,
      teacher_id INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS timetables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published'))
    );
    CREATE TABLE IF NOT EXISTS fee_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('SDC','SSF')),
      total_fee REAL NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('SDC','SSF')),
      amount REAL NOT NULL,
      proof_file TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      receipt_number TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      term TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      score REAL NOT NULL,
      grade TEXT DEFAULT '',
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      records TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      due_date TEXT NOT NULL,
      file_path TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS homework_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      homework_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      file_path TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      submitted_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT DEFAULT '',
      teacher_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sport_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sport TEXT NOT NULL,
      student_id INTEGER NOT NULL,
      team TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS nominations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      class_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomination_id INTEGER NOT NULL,
      voter_id INTEGER NOT NULL
    );
  `;
  db.run(schema);
  console.log('Tables created');

  // ── Ensure admin exists ──
  const admins = db.exec("SELECT id FROM users WHERE email = 'punhamasiwa@gmail.com'");
  if (!admins[0]?.values.length) {
    db.run("INSERT INTO users (name, email, password, role, is_active) VALUES (?,?,?,?,1)",
      ['Admin', 'punhamasiwa@gmail.com', hash('1234'), 'admin']);
    console.log('Admin seeded');
  }

  // ── Classes ──
  const classList = [
    'ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3',
    'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'
  ];
  for (const name of classList) {
    const grade = name.includes('ECD') ? 'ECD' : name.replace('Grade ', '');
    const section = name === 'ECD A' ? 'A' : name === 'ECD B' ? 'B' : '';
    db.run('INSERT INTO classes (name, grade, section) VALUES (?,?,?)', [name, grade, section]);
  }
  const clsRows = db.exec("SELECT id, name FROM classes ORDER BY id")[0].values;
  const cls = {};
  for (const c of clsRows) cls[c[1]] = c[0];
  console.log('Classes:', Object.keys(cls).length);

  // ── Teachers ──
  const firstNames = ['Tendai','Chido','Tafadzwa','Rumbidzai','Kudzai','Nyasha','Tanaka','Tariro','Anesu','Mufaro'];
  const lastNames = ['Moyo','Ndlovu','Sithole','Dube','Khumalo','Nyoni','Tshuma','Ncube','Mpofu','Sibanda'];
  const teacherIds = [];

  for (let i = 0; i < 10; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const name = `${fn} ${ln}`;
    const email = `teacher${i + 1}@school.com`;
    const classId = i < 9 ? cls[classList[i]] : null;
    db.run(
      'INSERT INTO users (name, email, password, role, class_id, is_active) VALUES (?,?,?,?,?,1)',
      [name, email, hash('1234'), 'teacher', classId]
    );
    teacherIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
  }
  console.log('Teachers:', teacherIds.length);

  // ── Subjects per class ──
  const subjectPool = ['English','Mathematics','Science','History','Geography','Art','Music','PE','ICT','Shona',
    'Agriculture','Religion','Home Economics','French'];
  const assignCnt = [6,6,6,7,7,7,7,7,7]; // subjects per class
  let subjCount = 0;
  const allSubj = [];
  for (let ci = 0; ci < classList.length; ci++) {
    const cn = classList[ci];
    const cid = cls[cn];
    const tid = teacherIds[ci % 10];
    for (let i = 0; i < assignCnt[ci]; i++) {
      const sn = subjectPool[(ci * 7 + i * 3) % subjectPool.length];
      db.run('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?,?,?)',
        [`${sn}`, cid, tid]);
      allSubj.push([Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]), cid]);
      subjCount++;
    }
  }
  console.log('Subjects:', subjCount);

  // ── 200 Students ──
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
    const classKey = classKeys[i % classKeys.length];
    const classId = cls[classKey];

    db.run(
      'INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?,?,?,?,?,?,1)',
      [name, email, hash('1234'), 'student', classId, regNum]
    );
    const id = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
    studentIds.push(id);
    studentClassMap[id] = classId;
  }
  console.log('Students:', studentIds.length);

  // ── Fee settings ──
  const sdcFee = 100;
  const ssfFee = 60;
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('sdc_fee',?)", [sdcFee.toString()]);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('ssf_fee',?)", [ssfFee.toString()]);

  // ── Fee accounts ──
  for (const sid of studentIds) {
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)',
      [sid, 'SDC', sdcFee, sdcFee]);
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)',
      [sid, 'SSF', ssfFee, ssfFee]);
  }
  console.log('Fee accounts: 400 (SDC+SSF per student)');

  // ── Payments (~60% of students, varying amounts & statuses) ──
  let payCount = 0;
  for (const sid of studentIds) {
    if (Math.random() > 0.6) continue;
    const at = Math.random() > 0.5 ? 'SDC' : 'SSF';
    const maxAmt = at === 'SDC' ? sdcFee : ssfFee;
    const amt = Math.round((5 + Math.random() * (maxAmt - 5)) * 100) / 100;
    const status = Math.random() > 0.15 ? 'verified' : 'pending';
    const days = Math.floor(Math.random() * 30);
    const date = new Date(Date.now() - days * 86400000).toISOString();
    const receipt = `RCP-${String(sid).padStart(4, '0')}-${String(100 + Math.floor(Math.random() * 900))}`;
    db.run(
      "INSERT INTO payments (student_id, account_type, amount, proof_file, notes, receipt_number, status, created_at) VALUES (?,?,?,'',?,?,?,?)",
      [sid, at, amt, `Payment for ${at}`, receipt, status, date]
    );
    payCount++;
    // Reduce balance
    if (status === 'verified') {
      db.run('UPDATE fee_accounts SET balance = balance - ? WHERE student_id = ? AND account_type = ?',
        [amt, sid, at]);
    }
  }
  console.log('Payments:', payCount);

  // ── Results ──
  let resCount = 0;
  for (const sid of studentIds) {
    const cid = studentClassMap[sid];
    const classSubjects = allSubj.filter(s => s[1] === cid);
    for (const [subjId] of classSubjects) {
      if (Math.random() > 0.85) continue;
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

  // ── Attendance ──
  const statuses = ['present','present','present','late','absent'];
  let attCount = 0;
  for (let d = 0; d < 10; d++) {
    const date = new Date(2026, 4, 12 + d).toISOString().slice(0, 10);
    for (const tid of teacherIds.slice(0, 5)) {
      const ci = teacherIds.indexOf(tid);
      if (ci >= classList.length) continue;
      const cid = cls[classList[ci]];
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

  // ── Timetable ──
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  let ttCount = 0;
  for (let ci = 0; ci < classList.length; ci++) {
    const cn = classList[ci];
    const cid = cls[cn];
    const classSubjects = allSubj.filter(s => s[1] === cid);
    for (let di = 0; di < 5; di++) {
      const subj = classSubjects[di % classSubjects.length];
      if (!subj) continue;
      const hour = 8 + di * 2;
      const tid = teacherIds[ci % 10];
      db.run(
        'INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room, status) VALUES (?,?,?,?,?,?,?,?)',
        [cid, subj[0], tid, days[di],
         `${String(hour).padStart(2, '0')}:00`, `${String(hour + 1).padStart(2, '0')}:00`,
         `Room ${101 + di}`, 'published']
      );
      ttCount++;
    }
  }
  console.log('Timetable entries:', ttCount);

  // ── Save ──
  const data = db.export();
  // Avoid writing to a file that's in use - write to temp then rename
  const tmpPath = dbPath + '.tmp';
  fs.writeFileSync(tmpPath, Buffer.from(data));
  fs.renameSync(tmpPath, dbPath);
  db.close();

  console.log('\n✅ Database saved to', dbPath);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:      punhamasiwa@gmail.com / 1234');
  console.log('Teachers:   teacher1@school.com through teacher10@school.com / 1234');
  console.log('Students:   200 students across all classes, password: 1234');
  console.log('Fees:       SDC $100, SSF $60');
  console.log('Payments:   ~60% of students with partial payments');
  console.log('Results:    ~15% of subjects per student with grades');
  console.log('Attendance: 10 days of records for classes 1-5');
  console.log('Timetable:  5 periods per class, published');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
