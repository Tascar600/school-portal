import { query, queryOne, execute } from '../config/database';
import { DEFAULT_GRADE_SCALE, DEFAULT_WEIGHTS, GradeBand, AssessmentWeights } from '../config/curriculum';

// School details shown in the portal and on every printed document. Editable by the Admin.
export interface SchoolInfo {
  name: string;          // short portal name
  full_name: string;     // used in document letterheads
  motto: string;
  slogan: string;
  district: string;
  province: string;
  country: string;
  address: string;
  po_box: string;
  phone: string;
  email: string;
  headmaster: string;
  bursar_name: string;
  bank_details: string;  // printed on invoices and statements
  receipt_footer: string;
}

export const SCHOOL_DEFAULTS: SchoolInfo = {
  name: 'CHAKARI GVT PRI SCHO',
  full_name: 'CHAKARI GVT PRIMARY SCHOOL',
  motto: 'Towards the Light',
  slogan: 'Pilgrim’s Progress',
  district: 'Sanyati District',
  province: 'Mashonaland West',
  country: 'Zimbabwe',
  address: '',
  po_box: '',
  phone: '',
  email: '',
  headmaster: '',
  bursar_name: '',
  bank_details: '',
  receipt_footer: 'Thank you. Please keep this receipt as proof of payment.',
};

export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<any>('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await getSetting(key);
  if (existing === null) await execute('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
  else await execute('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
}

export async function getSchoolInfo(): Promise<SchoolInfo> {
  const rows = await query<any[]>("SELECT key, value FROM settings WHERE key LIKE 'school_%'");
  const info: any = { ...SCHOOL_DEFAULTS };
  for (const r of rows) {
    const k = String(r.key).slice('school_'.length);
    if (k in info) info[k] = r.value;
  }
  return info as SchoolInfo;
}

export async function saveSchoolInfo(patch: Partial<SchoolInfo>): Promise<void> {
  for (const k of Object.keys(SCHOOL_DEFAULTS)) {
    if (k in patch && typeof (patch as any)[k] === 'string') await setSetting(`school_${k}`, (patch as any)[k].trim());
  }
}

export async function getGradeScale(): Promise<GradeBand[]> {
  const raw = await getSetting('grading_scale');
  if (!raw) return DEFAULT_GRADE_SCALE;
  try { return JSON.parse(raw); } catch { return DEFAULT_GRADE_SCALE; }
}

export async function getWeights(): Promise<AssessmentWeights> {
  const raw = await getSetting('assessment_weights');
  if (!raw) return DEFAULT_WEIGHTS;
  try { return { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) }; } catch { return DEFAULT_WEIGHTS; }
}
