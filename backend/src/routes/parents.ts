import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../config/auth';
import { studentBalance } from '../utils/finance';
import { tempPassword } from '../utils/acting';
import { passwordProblem } from './auth';

const router = Router();

// ── For a parent: my children ────────────────────────────────────────────────
export async function childrenWithBalances(parentId: number) {
  const kids = await query<any[]>(
    `SELECT u.id, u.name, u.student_number, u.class_id, u.archived, c.name AS class_name, ps.relationship
     FROM parent_students ps JOIN users u ON u.id = ps.student_id LEFT JOIN classes c ON c.id = u.class_id
     WHERE ps.parent_id = ? ORDER BY u.name`, [parentId]);
  for (const k of kids) { k.balance = await studentBalance(k.id); k.left = !!k.archived; }
  return kids;
}

router.get('/children', authenticate, authorize('parent'), async (req: AuthRequest, res: Response) => {
  try { res.json(await childrenWithBalances(req.user!.id)); } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── For the Administrator: parent accounts and which pupils they can see ─────
router.get('/', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const parents = await query<any[]>("SELECT id, name, email, is_active, archived FROM users WHERE role = 'parent' ORDER BY name");
    const links = await query<any[]>(
      `SELECT ps.parent_id, ps.relationship, u.id, u.name, u.student_number, c.name AS class_name
       FROM parent_students ps JOIN users u ON u.id = ps.student_id LEFT JOIN classes c ON c.id = u.class_id ORDER BY u.name`);
    res.json(parents.map((p) => ({ ...p, children: links.filter((l) => l.parent_id === p.id).map(({ parent_id, ...kid }) => kid) })));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

async function checkPupils(ids: any): Promise<{ ids: number[]; problem?: string }> {
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!list.length) return { ids: [], problem: 'Choose at least one pupil for this parent to see' };
  for (const id of list) {
    if (!(await queryOne<any>("SELECT id FROM users WHERE id = ? AND role = 'student'", [id]))) return { ids: [], problem: 'One of the pupils chosen does not exist' };
  }
  return { ids: [...new Set(list)] };
}

router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const relationship = String(req.body.relationship || '').trim();
    if (!name) return res.status(400).json({ message: 'The parent\'s name is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'A valid email address is required: the parent logs in with it' });
    if (await queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ?', [email])) return res.status(409).json({ message: 'Someone already has that email address' });
    const pupils = await checkPupils(req.body.student_ids);
    if (pupils.problem) return res.status(400).json({ message: pupils.problem });

    // Either the Administrator chooses the first password, or a temporary one is made that must be replaced at once
    const chosen = String(req.body.password || '');
    if (chosen) { const weak = passwordProblem(chosen); if (weak) return res.status(400).json({ message: weak.replace('The new password', 'The password') }); }
    const temp = chosen ? null : tempPassword();
    const { insertId } = await execute(
      "INSERT INTO users (name, email, password, role, is_active, must_change_password) VALUES (?, ?, ?, 'parent', 1, ?)",
      [name, email, hashPassword(chosen || temp!), temp ? 1 : 0]);
    for (const sid of pupils.ids) await execute('INSERT INTO parent_students (parent_id, student_id, relationship) VALUES (?, ?, ?)', [insertId, sid, relationship]);
    res.status(201).json({ id: insertId, message: `${name} can now log in with ${email}`, ...(temp ? { temporary_password: temp } : {}) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/children', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const parent = await queryOne<any>("SELECT id, name FROM users WHERE id = ? AND role = 'parent'", [req.params.id]);
    if (!parent) return res.status(404).json({ message: 'That parent does not exist' });
    const pupils = await checkPupils([req.body.student_id]);
    if (pupils.problem) return res.status(400).json({ message: pupils.problem });
    await execute('INSERT OR REPLACE INTO parent_students (parent_id, student_id, relationship) VALUES (?, ?, ?)', [parent.id, pupils.ids[0], String(req.body.relationship || '')]);
    res.json({ message: `${parent.name} can now see this pupil` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id/children/:studentId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const left = (await query<any[]>('SELECT COUNT(*) AS n FROM parent_students WHERE parent_id = ?', [req.params.id]))[0]?.n ?? 0;
    if (left <= 1) return res.status(400).json({ message: 'A parent must be linked to at least one pupil. Close the account instead if they no longer need it.' });
    await execute('DELETE FROM parent_students WHERE parent_id = ? AND student_id = ?', [req.params.id, req.params.studentId]);
    res.json({ message: 'The pupil is no longer linked to this parent' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
