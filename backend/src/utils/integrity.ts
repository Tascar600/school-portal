import { query } from '../config/database';

// What a person or a class has in the portal, so a delete that would erase their history can be refused.
const USER_RECORDS: [string, string, number][] = [
  ['marks', 'SELECT COUNT(*) AS n FROM results WHERE student_id = ? OR teacher_id = ?', 2],
  ['homework set', 'SELECT COUNT(*) AS n FROM homework WHERE teacher_id = ?', 1],
  ['homework handed in', 'SELECT COUNT(*) AS n FROM homework_submissions WHERE student_id = ?', 1],
  ['quizzes set', 'SELECT COUNT(*) AS n FROM quizzes WHERE teacher_id = ?', 1],
  ['quiz attempts', 'SELECT COUNT(*) AS n FROM quiz_attempts WHERE student_id = ?', 1],
  ['register records', 'SELECT COUNT(*) AS n FROM attendance WHERE teacher_id = ?', 1],
  ['timetable lessons', 'SELECT COUNT(*) AS n FROM timetables WHERE teacher_id = ?', 1],
  ['courses', 'SELECT COUNT(*) AS n FROM courses WHERE teacher_id = ?', 1],
  ['notices', 'SELECT COUNT(*) AS n FROM notices WHERE author_id = ?', 1],
  ['Grade 7 exam results', 'SELECT COUNT(*) AS n FROM exam_results WHERE student_id = ?', 1],
  ['invoices', 'SELECT COUNT(*) AS n FROM invoices WHERE student_id = ?', 1],
  ['receipts', 'SELECT COUNT(*) AS n FROM fee_payments WHERE student_id = ?', 1],
];

export async function recordsOfUser(id: number): Promise<{ label: string; n: number }[]> {
  const found: { label: string; n: number }[] = [];
  for (const [label, sql, binds] of USER_RECORDS) {
    const n = (await query<any[]>(sql, Array(binds).fill(id)))[0]?.n ?? 0;
    if (n > 0) found.push({ label, n });
  }
  return found;
}

const CLASS_RECORDS: [string, string][] = [
  ['pupils', 'SELECT COUNT(*) AS n FROM users WHERE role = \'student\' AND class_id = ?'],
  ['teachers', 'SELECT COUNT(*) AS n FROM users WHERE role = \'teacher\' AND class_id = ?'],
  ['homework tasks', 'SELECT COUNT(*) AS n FROM homework WHERE class_id = ?'],
  ['quizzes', 'SELECT COUNT(*) AS n FROM quizzes WHERE class_id = ?'],
  ['register records', 'SELECT COUNT(*) AS n FROM attendance WHERE class_id = ?'],
  ['timetable lessons', 'SELECT COUNT(*) AS n FROM timetables WHERE class_id = ?'],
  ['marks', 'SELECT COUNT(*) AS n FROM results r JOIN subjects s ON s.id = r.subject_id WHERE s.class_id = ?'],
  ['fee structure rows', 'SELECT COUNT(*) AS n FROM fee_structure WHERE class_id = ?'],
];

export async function recordsOfClass(id: number): Promise<{ label: string; n: number }[]> {
  const found: { label: string; n: number }[] = [];
  for (const [label, sql] of CLASS_RECORDS) {
    const n = (await query<any[]>(sql, [id]))[0]?.n ?? 0;
    if (n > 0) found.push({ label, n });
  }
  return found;
}

export const describeRecords = (r: { label: string; n: number }[]) => r.map((x) => `${x.n} ${x.label}`).join(', ');

// ── The database health check ────────────────────────────────────────────────
const WHAT: Record<string, string> = {
  'results.student_id': 'marks for a pupil who no longer exists', 'results.teacher_id': 'marks entered by a teacher who no longer exists',
  'results.subject_id': 'marks for a learning area that no longer exists',
  'invoices.student_id': 'invoices for a pupil who no longer exists (these inflate "Fees outstanding")',
  'fee_payments.student_id': 'receipts for a pupil who no longer exists',
  'homework_submissions.student_id': 'homework handed in by a pupil who no longer exists',
  'subjects.teacher_id': 'learning areas whose teacher no longer exists',
};

export async function integrityReport() {
  const integrity = String((await query<any[]>('PRAGMA integrity_check'))[0]?.integrity_check ?? 'unknown');
  const foreignKeysOn = Number((await query<any[]>('PRAGMA foreign_keys'))[0]?.foreign_keys ?? 0) === 1;
  const rows = await query<any[]>('PRAGMA foreign_key_check');
  const groups = new Map<string, { table: string; parent: string; count: number; sample: number[] }>();
  for (const r of rows) {
    const key = `${r.table}\u0000${r.parent}\u0000${r.fkid}`;
    const g = groups.get(key) || { table: r.table as string, parent: r.parent as string, count: 0, sample: [] as number[] };
    g.count++; if (g.sample.length < 5) g.sample.push(r.rowid);
    groups.set(key, g);
  }
  // A "no teacher" marker that points at nobody
  const noTeacher = (await query<any[]>('SELECT COUNT(*) AS n FROM subjects WHERE teacher_id = 0 OR teacher_id IS NULL'))[0]?.n ?? 0;
  const problems: any[] = [...groups.values()].map((g) => ({
    table: g.table, parent: g.parent, count: g.count, sampleIds: g.sample,
    what: `${g.count} row${g.count === 1 ? '' : 's'} in "${g.table}" point at a record in "${g.parent}" that is gone`,
    meaning: Object.entries(WHAT).find(([k]) => k.startsWith(g.table + '.'))?.[1] || `${g.table} rows whose ${g.parent} was deleted`,
  }));
  if (noTeacher && !problems.some((p) => p.table === 'subjects' && p.parent === 'users')) problems.push({ table: 'subjects', parent: 'users', count: noTeacher, sampleIds: [], what: `${noTeacher} learning area${noTeacher === 1 ? ' has' : 's have'} no teacher`, meaning: 'They are repaired automatically when a teacher is assigned to the class.' });
  return { ok: integrity === 'ok' && problems.length === 0, integrity, foreignKeysOn, problems };
}
