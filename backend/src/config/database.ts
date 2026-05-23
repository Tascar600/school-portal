import initSqlJs from 'sql.js';
type SqlJsDatabase = Awaited<ReturnType<typeof initSqlJs>>;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { hashPassword } from './auth';

dotenv.config();

let db: SqlJsDatabase;
export const dbPath = path.resolve(__dirname, '../../school_portal.db');

function createTables(): void {
  db.run(`
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
      teacher_id INTEGER NOT NULL,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS fee_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('SDC','SSF')),
      total_fee REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(student_id, account_type)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('SDC','SSF')),
      amount REAL NOT NULL,
      proof_file TEXT NOT NULL DEFAULT '',
      notes TEXT DEFAULT '',
      receipt_number TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
      verified_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS timetables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      day TEXT NOT NULL CHECK(day IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
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
      remarks TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(student_id, subject_id, term, academic_year)
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      target_role TEXT DEFAULT 'all' CHECK(target_role IN ('all','teachers','students','class')),
      class_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      due_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS homework_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      homework_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      file TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      submitted_at TEXT DEFAULT (datetime('now')),
      grade REAL,
      feedback TEXT DEFAULT '',
      FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(homework_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      duration_minutes INTEGER DEFAULT 10,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      score INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      attempted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
    );

    -- Teacher courses
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      class_id INTEGER,
      description TEXT DEFAULT '',
      day_of_week TEXT DEFAULT '',
      start_time TEXT DEFAULT '',
      end_time TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
    );

    -- Attendance / Register
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER,
      teacher_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      records TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );

    -- Sports categories
    CREATE TABLE IF NOT EXISTS sports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      coach_id INTEGER,
      max_participants INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Sport participants
    CREATE TABLE IF NOT EXISTS sport_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sport_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(sport_id, student_id)
    );

    -- Voting sessions
    CREATE TABLE IF NOT EXISTS voting_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      position TEXT NOT NULL DEFAULT 'Prefect',
      status TEXT DEFAULT 'closed' CHECK(status IN ('open','closed')),
      start_date TEXT,
      end_date TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Prefect nominations
    CREATE TABLE IF NOT EXISTS nominations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      manifesto TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES voting_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );

    -- Votes
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      voter_id INTEGER NOT NULL,
      voted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES voting_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (candidate_id) REFERENCES nominations(id) ON DELETE CASCADE,
      FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(session_id, voter_id)
    );

    -- User settings (themes)
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      theme TEXT DEFAULT 'default',
      accent_color TEXT DEFAULT '#1a237e',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Global fee settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function seedZimbabweClasses(): void {
  const existing = db.exec("SELECT COUNT(*) AS cnt FROM classes");
  if (existing[0]?.values[0][0] > 0) return;

  const classes = [
    { name: 'ECD A', grade: 'ECD', section: 'A' },
    { name: 'ECD B', grade: 'ECD', section: 'B' },
    { name: 'Grade 1', grade: '1', section: '' },
    { name: 'Grade 2', grade: '2', section: '' },
    { name: 'Grade 3', grade: '3', section: '' },
    { name: 'Grade 4', grade: '4', section: '' },
    { name: 'Grade 5', grade: '5', section: '' },
    { name: 'Grade 6', grade: '6', section: '' },
    { name: 'Grade 7', grade: '7', section: '' },
  ];
  const stmt = db.prepare('INSERT INTO classes (name, grade, section) VALUES (?, ?, ?)');
  for (const c of classes) {
    stmt.bind([c.name, c.grade, c.section]);
    stmt.step();
    stmt.reset();
  }
  stmt.free();
  console.log('Seeded Zimbabwe primary classes (ECD A – Grade 7)');
}

function seedAdmin(): void {
  const existing = db.exec("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'");
  if (existing[0]?.values[0][0] > 0) return;

  const hashed = hashPassword('1234');
  db.run(
    "INSERT INTO users (name, email, password, role, is_active) VALUES ('Super Admin', 'punhamasiwa@gmail.com', ?, 'admin', 1)",
    [hashed]
  );
  console.log('Seeded admin account: punhamasiwa@gmail.com / 1234');
}

function seedTestData(): void {
  const existing = db.exec("SELECT COUNT(*) AS cnt FROM users WHERE role='student'");
  if (existing[0]?.values[0][0] > 0) return;

  const hash = (p: string) => hashPassword(p);
  const clsRows = db.exec("SELECT id, name FROM classes ORDER BY id")[0]?.values || [];
  const cls: Record<string, number> = {};
  for (const [id, name] of clsRows) cls[name as string] = Number(id);
  if (Object.keys(cls).length === 0) return;

  const classNames = Object.keys(cls);

  // Teachers
  const tdata: [string, string, number | null][] = [
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
  const tIds: number[] = [];
  for (const [name, email, cid] of tdata) {
    db.run("INSERT INTO users (name, email, password, role, class_id, is_active) VALUES (?,?,?,?,?,1)",
      [name, email, hash('1234'), 'teacher', cid]);
    tIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
  }

  // Subjects
  const subjPool = ['English','Mathematics','Science','History','Geography','Art','Music','PE','ICT','Shona',
    'Agriculture','Religion','Home Economics','French'];
  const subjCnt = [6,6,6,7,7,7,7,7,7];
  for (let ci = 0; ci < 9; ci++) {
    const cid = cls[classNames[ci]]; if (!cid) continue;
    const tid = tIds[ci % 10];
    for (let i = 0; i < subjCnt[ci]; i++) {
      db.run('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?,?,?)',
        [subjPool[(ci * 7 + i * 3) % subjPool.length], cid, tid]);
    }
  }

  // 200 students
  const sFNs = ['Takudzwa','Rutendo','Tatenda','Kundai','Makanaka','Panashe','Tadiwa','Kudzanai','Tanyaradzwa',
    'Shamiso','Munyaradzi','Tafara','Ropafadzo','Muchaneta','Masimba','Chiedza','Tanatswa','Nokutenda','Simba','Chipo',
    'Tawana','Kudakwashe','Munashe','Tariro','Tinevimbo','Mufaro','Zvikomborero','Tonderai','Rufaro','Chengetai'];
  const sLNs = ['Muzenda','Makoni','Chigumba','Mkandla','Mlambo','Ndlovu','Sithole','Mpofu','Ncube','Tshuma',
    'Dube','Khumalo','Nyoni','Moyo','Sibanda','Nkala','Maphosa','Ngwenya','Mthembu','Zulu'];
  const sIds: number[] = [];
  for (let i = 0; i < 200; i++) {
    const name = `${sFNs[i % sFNs.length]} ${sLNs[Math.floor(i / sFNs.length) % sLNs.length]}`;
    const seq = String(i + 1).padStart(5, '0');
    const reg = `c26${seq}c`;
    db.run("INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES (?,?,?,?,?,?,1)",
      [name, `${reg}@temp.school`, hash('1234'), 'student', cls[classNames[i % 9]], reg]);
    sIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
  }

  // Fee settings
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('sdc_fee','100')");
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('ssf_fee','60')");

  // Fee accounts (SDC + SSF per student)
  for (const sid of sIds) {
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)', [sid, 'SDC', 100, 100]);
    db.run('INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?,?,?,?)', [sid, 'SSF', 60, 60]);
  }

  // Payments (~60% random)
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

  // Results (~85% of subject-student combos)
  const subjs = (db.exec("SELECT id, class_id FROM subjects ORDER BY id")[0]?.values || []);
  for (const sid of sIds) {
    const cid = cls[classNames[sIds.indexOf(sid) % 9]];
    for (const [subjId, scid] of subjs) {
      if (Number(scid) !== cid) continue;
      if (Math.random() > 0.85) continue;
      const score = Math.round(30 + Math.random() * 70);
      const grade = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 40 ? 'D' : 'E';
      db.run('INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, score, grade) VALUES (?,?,?,?,?,?,?)',
        [sid, subjId, tIds[cid % 10], 'Term 1', '2026', score, grade]);
    }
  }

  // Timetable (5 periods per class)
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  for (let ci = 0; ci < 9; ci++) {
    const cid = cls[classNames[ci]]; if (!cid) continue;
    const classSubjs = subjs.filter((v: any) => Number(v[1]) === cid);
    for (let di = 0; di < 5; di++) {
      const subj = classSubjs[di % classSubjs.length]; if (!subj) continue;
      const hr = 8 + di * 2;
      db.run("INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room, status) VALUES (?,?,?,?,?,?,?,?)",
        [cid, subj[0], tIds[ci % 10], days[di], `${hr}:00`, `${hr+1}:00`, `Room ${101+di}`, 'published']);
    }
  }

  // Attendance (10 days, first 5 classes)
  const attS = ['present','present','present','late','absent'];
  for (let d = 0; d < 10; d++) {
    const date = new Date(2026, 4, 12 + d).toISOString().slice(0, 10);
    for (let ci = 0; ci < 5; ci++) {
      const cid = cls[classNames[ci]]; if (!cid) continue;
      const tid = tIds[ci % 10];
      const classSids = sIds.filter((_, i) => i % 9 === ci % 9);
      const records = classSids.map(sid => ({ student_id: sid, status: attS[Math.floor(Math.random() * attS.length)] }));
      db.run('INSERT INTO attendance (class_id, teacher_id, date, records) VALUES (?,?,?,?)',
        [cid, tid, date, JSON.stringify(records)]);
    }
  }

  // Homework
  for (let ci = 0; ci < 5; ci++) {
    const cid = cls[classNames[ci]]; if (!cid) continue;
    const tid = tIds[ci % 10];
    const classSubjs = subjs.filter((v: any) => Number(v[1]) === cid);
    for (const [subjId] of classSubjs.slice(0, 2)) {
      db.run("INSERT INTO homework (subject_id, teacher_id, class_id, title, description, due_date) VALUES (?,?,?,?,?,?)",
        [subjId, tid, cid, `Assignment ${classNames[ci]}`, 'Complete the exercises', '2026-06-15']);
    }
  }

  // Courses
  for (let i = 0; i < 5; i++) {
    db.run("INSERT INTO courses (name, code, description, teacher_id) VALUES (?,?,?,?)",
      [`Course ${i+1}`, `CRS00${i+1}`, `Sample course ${i+1}`, tIds[i]]);
  }

  // Sports + participants
  const sportNames = ['Soccer','Netball','Athletics','Basketball','Volleyball'];
  const sportIds: number[] = [];
  for (const sn of sportNames) {
    db.run("INSERT INTO sports (name) VALUES (?)", [sn]);
    sportIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
  }
  for (const sid of sportIds) {
    for (const stuId of sIds.filter(() => Math.random() > 0.85)) {
      db.run("INSERT INTO sport_participants (sport_id, student_id, role) VALUES (?,?,?)",
        [sid, stuId, 'member']);
    }
  }

  // Voting session + nominations + votes
  const votingSessions = ['Head Boy','Head Girl','Sports Captain','Prefect'];
  const sessionIds: number[] = [];
  for (const pos of votingSessions) {
    db.run("INSERT INTO voting_sessions (title, position, status) VALUES (?,?,?)",
      [pos + ' Election', pos, 'closed']);
    sessionIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
  }
  for (const sessId of sessionIds) {
    const candidates = sIds.filter(() => Math.random() > 0.97);
    const nomIds: number[] = [];
    for (const candId of candidates) {
      db.run("INSERT INTO nominations (session_id, student_id) VALUES (?,?)",
        [sessId, candId]);
      nomIds.push(Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
    }
    for (const nomId of nomIds) {
      for (const voterId of sIds.filter(() => Math.random() > 0.95)) {
        db.run("INSERT INTO votes (session_id, candidate_id, voter_id) VALUES (?,?,?)",
          [sessId, nomId, voterId]);
      }
    }
  }

  const counts = {
    students: (db.exec("SELECT COUNT(*) FROM users WHERE role='student'")[0]?.values[0][0] || 0) as number,
    teachers: (db.exec("SELECT COUNT(*) FROM users WHERE role='teacher'")[0]?.values[0][0] || 0) as number,
    subjects: (db.exec("SELECT COUNT(*) FROM subjects")[0]?.values[0][0] || 0) as number,
    payments: (db.exec("SELECT COUNT(*) FROM payments")[0]?.values[0][0] || 0) as number,
    results: (db.exec("SELECT COUNT(*) FROM results")[0]?.values[0][0] || 0) as number,
    timetable: (db.exec("SELECT COUNT(*) FROM timetables")[0]?.values[0][0] || 0) as number,
    attendance: (db.exec("SELECT COUNT(*) FROM attendance")[0]?.values[0][0] || 0) as number,
    homework: (db.exec("SELECT COUNT(*) FROM homework")[0]?.values[0][0] || 0) as number,
    courses: (db.exec("SELECT COUNT(*) FROM courses")[0]?.values[0][0] || 0) as number,
    sports: (db.exec("SELECT COUNT(*) FROM sport_participants")[0]?.values[0][0] || 0) as number,
    nominations: (db.exec("SELECT COUNT(*) FROM nominations")[0]?.values[0][0] || 0) as number,
    votes: (db.exec("SELECT COUNT(*) FROM votes")[0]?.values[0][0] || 0) as number,
  };
  const c = counts;
  console.log(`Auto-seeded: ${c.students} students, ${c.teachers} teachers, ${c.subjects} subjects, ${c.payments} payments, ${c.results} results, ${c.timetable} tt, ${c.attendance} att, ${c.homework} hw, ${c.courses} courses, ${c.sports} sports, ${c.nominations} noms, ${c.votes} votes`);
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  createTables();
  try { db.run("ALTER TABLE payments ADD COLUMN notes TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE payments ADD COLUMN receipt_number TEXT DEFAULT ''"); } catch {}
  try { db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"); } catch {}
  seedZimbabweClasses();
  seedAdmin();
  seedTestData();
  save();
  console.log('Database initialized at', dbPath);
}

function save(): void {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows as T;
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
  const rows = await query<any[]>(sql, params);
  return rows[0] as T | undefined;
}

export async function execute(
  sql: string,
  params?: any[]
): Promise<{ insertId: number; affectedRows: number }> {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  stmt.step();
  const insertId = Number(db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] || 0);
  const affectedRows = Number(db.getRowsModified());
  stmt.free();
  save();
  return { insertId, affectedRows };
}

export function transaction(fn: () => void): void {
  db.run('BEGIN');
  try {
    fn();
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  save();
}

export default db;
