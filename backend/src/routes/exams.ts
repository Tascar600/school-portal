import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ALL_AREA_NAMES } from '../config/curriculum';

const router = Router();

// Grade 7 examination results. The marks and units come from the examination itself (ZIMSEC, or the school's trial
// papers) and are typed in here. The portal does not decide who passes: it records, totals and compares.
// Allowed: the Administrator, and the teacher of Grade 7.

async function grade7ClassId(): Promise<number | null> {
  const c = await queryOne<any>("SELECT id FROM classes WHERE name = 'Grade 7' LIMIT 1");
  return c?.id ?? null;
}

async function mayUse(req: AuthRequest): Promise<{ ok: boolean; classId: number | null; message?: string }> {
  const classId = await grade7ClassId();
  if (!classId) return { ok: false, classId, message: 'This school has no Grade 7 class' };
  if (req.user!.role === 'admin') return { ok: true, classId };
  const me = await queryOne<any>('SELECT class_id FROM users WHERE id = ?', [req.user!.id]);
  if (me?.class_id === classId) return { ok: true, classId };
  return { ok: false, classId, message: 'Only the Grade 7 teacher and the Administrator can use the Grade 7 results' };
}

const UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const round1 = (n: number) => Math.round(n * 10) / 10;

router.get('/grade7', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const use = await mayUse(req);
    if (!use.ok) return res.status(use.classId ? 403 : 404).json({ message: use.message });
    const year = String(req.query.year || new Date().getFullYear());
    const pupils = await query<any[]>("SELECT id, name, student_number FROM users WHERE role = 'student' AND archived = 0 AND class_id = ? ORDER BY name", [use.classId]);
    const rows = await query<any[]>('SELECT student_id, area, mark, unit FROM exam_results WHERE academic_year = ?', [year]);
    const byPupil = new Map<number, Record<string, { mark: number | null; unit: number | null }>>();
    for (const r of rows) {
      const m = byPupil.get(r.student_id) || {};
      m[r.area] = { mark: r.mark, unit: r.unit };
      byPupil.set(r.student_id, m);
    }
    const list = pupils.map((p) => {
      const results = byPupil.get(p.id) || {};
      const entered = Object.values(results);
      const marks = entered.map((e) => e.mark).filter((m): m is number => m !== null);
      const units = entered.map((e) => e.unit).filter((u): u is number => u !== null);
      return {
        ...p, results, areasEntered: entered.length,
        averageMark: marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : null,
        totalUnits: units.length ? units.reduce((a, b) => a + b, 0) : null, unitsCounted: units.length,
      };
    });
    const summary = ALL_AREA_NAMES.map((area) => {
      const entries = list.map((p) => p.results[area]).filter(Boolean) as { mark: number | null; unit: number | null }[];
      const marks = entries.map((e) => e.mark).filter((m): m is number => m !== null);
      const distribution = Object.fromEntries(UNITS.map((u) => [u, entries.filter((e) => e.unit === u).length]));
      return { area, sat: entries.length, averageMark: marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : null, highest: marks.length ? Math.max(...marks) : null, lowest: marks.length ? Math.min(...marks) : null, distribution };
    });
    res.json({ year, areas: ALL_AREA_NAMES, units: UNITS, pupils: list, summary });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Save (or clear) marks and units. A row with neither a mark nor a unit removes that result.
router.put('/grade7', authenticate, authorize('admin', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const use = await mayUse(req);
    if (!use.ok) return res.status(use.classId ? 403 : 404).json({ message: use.message });
    const year = String(req.body.academic_year || '');
    const entries: any[] = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (!/^\d{4}$/.test(year)) return res.status(400).json({ message: 'Give the year of the examination, for example 2026' });
    if (!entries.length) return res.status(400).json({ message: 'There is nothing to save' });

    const pupils = new Set((await query<any[]>("SELECT id FROM users WHERE role = 'student' AND archived = 0 AND class_id = ?", [use.classId])).map((p) => p.id));
    const clean: { student_id: number; area: string; mark: number | null; unit: number | null }[] = [];
    for (const [i, e] of entries.entries()) {
      const where = `Row ${i + 1}`;
      if (!pupils.has(Number(e.student_id))) return res.status(400).json({ message: `${where}: that pupil is not in Grade 7` });
      if (!ALL_AREA_NAMES.includes(e.area)) return res.status(400).json({ message: `${where}: "${e.area}" is not a learning area` });
      const blank = (v: any) => v === '' || v === null || v === undefined;
      let mark: number | null = null, unit: number | null = null;
      if (!blank(e.mark)) { mark = Number(e.mark); if (!Number.isFinite(mark) || mark < 0 || mark > 100) return res.status(400).json({ message: `${where}: a mark must be between 0 and 100` }); }
      if (!blank(e.unit)) { unit = Number(e.unit); if (!Number.isInteger(unit) || unit < 1 || unit > 9) return res.status(400).json({ message: `${where}: a unit must be a whole number from 1 to 9` }); }
      clean.push({ student_id: Number(e.student_id), area: e.area, mark, unit });
    }

    let saved = 0, cleared = 0;
    for (const e of clean) {
      if (e.mark === null && e.unit === null) {
        await execute('DELETE FROM exam_results WHERE student_id = ? AND academic_year = ? AND area = ?', [e.student_id, year, e.area]);
        cleared++;
      } else {
        await execute(
          `INSERT INTO exam_results (student_id, academic_year, area, mark, unit, entered_by) VALUES (?,?,?,?,?,?)
           ON CONFLICT (student_id, academic_year, area) DO UPDATE SET mark = excluded.mark, unit = excluded.unit, entered_by = excluded.entered_by, updated_at = datetime('now')`,
          [e.student_id, year, e.area, e.mark, e.unit, req.user!.id]);
        saved++;
      }
    }
    res.json({ message: `${saved} result${saved === 1 ? '' : 's'} saved${cleared ? `, ${cleared} cleared` : ''}`, saved, cleared });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
