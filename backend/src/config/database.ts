import initSqlJs from 'sql.js';
type SqlJsDatabase = Awaited<ReturnType<typeof initSqlJs>>;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { hashPassword } from './auth';
import { ALL_AREA_NAMES, LEGACY_AREA_NAMES } from './curriculum';
import { dbPath } from './paths';

dotenv.config();

let db: SqlJsDatabase;
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
// Where the database file lives (DB_PATH, or DATA_DIR, or backend/school_portal.db): see config/paths.ts
export { dbPath };

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
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
      coursework REAL DEFAULT 0,
      test_score REAL DEFAULT 0,
      exam REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','archived')),
      subject_name TEXT DEFAULT '',
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
    -- ===== Bursary / finance module =====

    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT NOT NULL,
      term_no INTEGER NOT NULL CHECK(term_no IN (1,2,3)),
      start_date TEXT,
      end_date TEXT,
      is_current INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(year, term_no)
    );

    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY,
      next_val INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rate REAL NOT NULL DEFAULT 1,
      is_base INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Other' CHECK(type IN ('BEAM','NGO','Church','Company','Individual','Other')),
      contact_person TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      coverage_percent REAL NOT NULL DEFAULT 100,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('percent','fixed')),
      value REAL NOT NULL DEFAULT 0,
      fee_item_id INTEGER,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (fee_item_id) REFERENCES fee_items(id) ON DELETE SET NULL
    );

    -- Finance-specific extension of a role=student user row
    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id INTEGER PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'day' CHECK(category IN ('day','staff_child','beam','sponsored')),
      discount_id INTEGER,
      sponsor_id INTEGER,
      guardian_name TEXT DEFAULT '',
      guardian_phone TEXT DEFAULT '',
      guardian_email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      family_code TEXT DEFAULT '',
      gender TEXT CHECK(gender IS NULL OR gender IN ('M','F')),
      dob TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','left')),
      enrolled_on TEXT,
      notes TEXT DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE SET NULL,
      FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS fee_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_optional INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS fee_structure (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      fee_item_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_item_id) REFERENCES fee_items(id) ON DELETE CASCADE,
      UNIQUE(term_id, class_id, fee_item_id)
    );

    CREATE TABLE IF NOT EXISTS student_optional_items (
      student_id INTEGER NOT NULL,
      fee_item_id INTEGER NOT NULL,
      PRIMARY KEY (student_id, fee_item_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_item_id) REFERENCES fee_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('term','charge','credit')),
      student_id INTEGER NOT NULL,
      term_id INTEGER NOT NULL,
      inv_date TEXT NOT NULL,
      gross REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      sponsor_id INTEGER,
      sponsor_amount REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
      cancel_reason TEXT DEFAULT '',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE,
      FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      fee_item_id INTEGER,
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_item_id) REFERENCES fee_items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cash','bank','mobile','petty')),
      account_no TEXT DEFAULT '',
      currency TEXT DEFAULT 'USD',
      opening_balance REAL NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (currency) REFERENCES currencies(code) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS fee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL,
      term_id INTEGER NOT NULL,
      pay_date TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      fx_rate REAL NOT NULL DEFAULT 1,
      amount_paid REAL NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('cash','bank','ecocash','swipe','in_kind','sponsor')),
      reference TEXT DEFAULT '',
      account_id INTEGER,
      sponsor_id INTEGER,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reversed')),
      reverse_reason TEXT DEFAULT '',
      reversed_by INTEGER,
      reversed_at TEXT,
      cleared INTEGER DEFAULT 0,
      cleared_on TEXT,
      received_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL,
      FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_no TEXT UNIQUE NOT NULL,
      exp_date TEXT NOT NULL,
      term_id INTEGER,
      category_id INTEGER,
      account_id INTEGER NOT NULL,
      payee TEXT DEFAULT '',
      description TEXT DEFAULT '',
      amount REAL NOT NULL,
      reference TEXT DEFAULT '',
      attachment TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
      cancel_reason TEXT DEFAULT '',
      cleared INTEGER DEFAULT 0,
      cleared_on TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tr_date TEXT NOT NULL,
      from_account INTEGER NOT NULL,
      to_account INTEGER NOT NULL,
      amount REAL NOT NULL,
      reference TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      cleared_from INTEGER DEFAULT 0,
      cleared_to INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (from_account) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (to_account) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reconciliations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      statement_date TEXT NOT NULL,
      statement_balance REAL NOT NULL,
      cleared_balance REAL NOT NULL,
      difference REAL NOT NULL,
      notes TEXT DEFAULT '',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE,
      UNIQUE(term_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      phone TEXT DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'general' CHECK(kind IN ('reminder','receipt','general')),
      channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK(channel IN ('sms','whatsapp')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
      error TEXT DEFAULT '',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity TEXT NOT NULL DEFAULT '',
      entity_id INTEGER,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      user_name TEXT DEFAULT '',
      user_role TEXT DEFAULT '',
      student_id INTEGER,
      amount REAL,
      summary TEXT DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
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

// A brand-new portal starts with well-known passwords (1234 and 12345678), so the first person to log in to each
// of those two accounts must choose their own. Set FIRST_LOGIN_PASSWORD_CHANGE=off only on a local test computer.
const FIRST_LOGIN_CHANGE = process.env.FIRST_LOGIN_PASSWORD_CHANGE === 'off' ? 0 : 1;

function seedAdmin(): void {
  const existing = db.exec("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'");
  if (existing[0]?.values[0][0] > 0) return;

  const hashed = hashPassword('1234');
  db.run(
    "INSERT INTO users (name, email, password, role, is_active, must_change_password) VALUES ('Super Admin', 'punhamasiwa@gmail.com', ?, 'admin', 1, ?)",
    [hashed, FIRST_LOGIN_CHANGE]
  );
  console.log('Seeded admin account: punhamasiwa@gmail.com / 1234');
}

function seedBursary(): void {
  const existing = db.exec("SELECT COUNT(*) AS cnt FROM users WHERE email = 'tascarmasiwa@gmail.com'");
  if (existing[0]?.values[0][0] > 0) return;
  const hashed = hashPassword('12345678');
  db.run(
    "INSERT INTO users (name, email, password, role, is_active, must_change_password) VALUES ('Bursar', 'tascarmasiwa@gmail.com', ?, 'bursary', 1, ?)",
    [hashed, FIRST_LOGIN_CHANGE]
  );
  console.log('Seeded bursary account: tascarmasiwa@gmail.com / 12345678');
}

function seedFinanceDefaults(): void {
  const existing = db.exec("SELECT COUNT(*) AS cnt FROM currencies");
  if (!(existing[0]?.values[0][0] > 0)) {
    db.run("INSERT INTO currencies (code, name, rate, is_base, active) VALUES ('USD', 'US Dollar', 1, 1, 1)");
    // ZWG (Zimbabwe Gold, "ZiG") — the official interbank rate moves regularly.
    // Starting rate is a reasonable default only; update it in Finance > Setup as it changes.
    db.run("INSERT INTO currencies (code, name, rate, is_base, active) VALUES ('ZWG', 'Zimbabwe Gold (ZiG)', 26.6, 0, 1)");
  }
  const acct = db.exec("SELECT COUNT(*) AS cnt FROM accounts");
  if (!(acct[0]?.values[0][0] > 0)) {
    db.run("INSERT INTO accounts (name, type, currency, opening_balance, active) VALUES ('Main Cash', 'cash', 'USD', 0, 1)");
  }
}

export async function initDatabase(): Promise<void> {
  SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  prepareDatabase();
  save();
  console.log('Database initialized at', dbPath);
}

// Is this file a healthy backup of this portal? Returns what is wrong with it, or null when it can be used.
export async function checkDatabaseFile(file: Buffer): Promise<string | null> {
  if (!SQL) SQL = await initSqlJs();
  let probe: SqlJsDatabase | undefined;
  try {
    probe = new SQL.Database(file);
    const integrity = probe.exec('PRAGMA integrity_check')[0]?.values[0][0];
    if (integrity !== 'ok') return 'That file is damaged, so it was not used. Nothing was changed.';
    if (!probe.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'")[0]) return 'That file is not a backup of this portal, so it was not used. Nothing was changed.';
    return null;
  } catch {
    return 'That file is not a database, so it was not used. Nothing was changed.';
  } finally {
    try { probe?.close(); } catch { /* nothing to close */ }
  }
}

// Switches the running portal onto a backup file (Admin Panel > Database > Restore). Writing the file alone is not enough:
// the portal works from a copy of the database held in memory and saves it over the file on the next change, which
// would silently undo the restore. An older backup is brought up to date exactly as at start-up. If anything goes
// wrong the portal carries on with the data it had.
export async function replaceDatabase(file: Buffer): Promise<void> {
  if (!SQL) SQL = await initSqlJs();
  const before = db;
  db = new SQL.Database(file);
  try {
    prepareDatabase();
    save();
  } catch (err) {
    db = before;
    save();
    throw err;
  }
  try { before.close(); } catch { /* already closed */ }
}

// Brings a freshly opened database up to the current layout and makes sure the starting records exist
function prepareDatabase(): void {
  db.run('PRAGMA foreign_keys = ON');
  createTables();
  try { db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"); } catch {}
  try { db.run("ALTER TABLE results ADD COLUMN coursework REAL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE results ADD COLUMN test_score REAL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE results ADD COLUMN exam REAL DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE results ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active','archived'))"); } catch {}
  try { db.run("ALTER TABLE results ADD COLUMN subject_name TEXT DEFAULT ''"); } catch {}
  // Retired by the bursary-module rewrite — kept under new names for audit history, never dropped.
  try { db.run("ALTER TABLE fee_accounts RENAME TO legacy_fee_accounts"); } catch {}
  try { db.run("ALTER TABLE payments RENAME TO legacy_fee_payments"); } catch {}
  try { db.run("ALTER TABLE fee_archives RENAME TO legacy_fee_archives"); } catch {}
  // Heritage-Based Curriculum, passwords and report-card additions
  try { db.run("ALTER TABLE results ADD COLUMN project_title TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE fee_payments ADD COLUMN payer TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE fee_payments ADD COLUMN balance_after REAL"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN archived INTEGER DEFAULT 0"); } catch {} // a closed account: someone who has left the school
  // The Bursary audit trail (middleware/audit.ts) keeps who, what and how much in the old audit_log table
  for (const col of ["user_name TEXT DEFAULT ''", "user_role TEXT DEFAULT ''", 'student_id INTEGER', 'amount REAL', "summary TEXT DEFAULT ''"]) {
    try { db.run('ALTER TABLE audit_log ADD COLUMN ' + col); } catch {}
  }
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at)');
  try { db.run("ALTER TABLE users ADD COLUMN password_changed_at TEXT"); } catch {}
  createExtraTables();
  migrateCurriculum();
  seedZimbabweClasses();
  seedAdmin();
  seedBursary();
  seedFinanceDefaults();
  migrateCurriculum(); // again, so the classes seeded above also get their learning areas
}

function createExtraTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS password_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT
    );
    -- Grade 7 examination results: the mark and unit each pupil was given in each learning area (routes/exams.ts)
    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      area TEXT NOT NULL,
      mark REAL,
      unit INTEGER,
      entered_by INTEGER,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (student_id, academic_year, area),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL
    );
    -- Which pupils a parent account may look at (routes/parents.ts, utils/acting.ts)
    CREATE TABLE IF NOT EXISTS parent_students (
      parent_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      relationship TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (parent_id, student_id),
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS report_comments (
      student_id INTEGER NOT NULL,
      term TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      teacher_comment TEXT DEFAULT '',
      head_comment TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (student_id, term, academic_year)
    );
  `);
}

// Move old subject names onto the six learning areas and make sure every class has all seven.
function migrateCurriculum(): void {
  for (const [legacy, current] of Object.entries(LEGACY_AREA_NAMES)) {
    db.run('UPDATE subjects SET name = ? WHERE name = ?', [current, legacy]);
    db.run('UPDATE results SET subject_name = ? WHERE subject_name = ?', [current, legacy]);
  }
  const classes = db.exec('SELECT id FROM classes');
  for (const row of classes[0]?.values || []) ensureSubjectsForClass(Number(row[0]));
}

// Every class gets the six compulsory learning areas plus ICT and Robotics. Idempotent.
export function ensureSubjectsForClass(classId: number): void {
  const t = db.exec("SELECT id FROM users WHERE role = 'teacher' AND class_id = ? LIMIT 1", [classId]);
  const teacherId = Number(t[0]?.values[0][0] ?? 0);
  // A learning area must belong to a real teacher (subjects.teacher_id is required and points at a user), so a class
  // gets its seven areas the moment a teacher is given to it (routes/admin.ts calls this then). Before that there is nothing to create.
  if (!teacherId) return;
  for (const name of ALL_AREA_NAMES) {
    const has = db.exec('SELECT 1 FROM subjects WHERE class_id = ? AND name = ?', [classId, name]);
    if (!has[0]) db.run('INSERT INTO subjects (name, class_id, teacher_id) VALUES (?, ?, ?)', [name, classId, teacherId]);
  }
  db.run('UPDATE subjects SET teacher_id = ? WHERE class_id = ? AND (teacher_id = 0 OR teacher_id IS NULL)', [teacherId, classId]);
  save();
}

function save(): void {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  // sql.js switches foreign-key checking off every time it exports the database; switch it back on so the rules
  // (no mark without a pupil, no receipt without a pupil ...) hold for the whole time the portal is running
  db.run('PRAGMA foreign_keys = ON');
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
