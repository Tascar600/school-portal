import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// A parent looks at the school through one child at a time. A pupil's own pages ("my results", "my fees", ...) are
// reused for this: the parent says which child (?child=ID) and these helpers decide whether that is allowed.
// A pupil may only ever act for themselves; a parent only for pupils linked to their account.

export async function childIdsOf(parentId: number): Promise<number[]> {
  return (await query<any[]>('SELECT student_id FROM parent_students WHERE parent_id = ?', [parentId])).map((r) => r.student_id);
}

// May this logged-in pupil or parent see this pupil's own information?
export async function mayActFor(req: AuthRequest, studentId: number): Promise<boolean> {
  const me = req.user!;
  if (me.role === 'student') return me.id === studentId;
  if (me.role === 'parent') return (await childIdsOf(me.id)).includes(Number(studentId));
  return false;
}

// Which pupil is this request about? A pupil: themselves. A parent: the child named in ?child= (or their only child).
// Sends the refusal itself and returns null when the answer is "none".
export async function actingStudent(req: AuthRequest, res: Response): Promise<number | null> {
  const me = req.user!;
  if (me.role === 'student') return me.id;
  if (me.role === 'parent') {
    const kids = await childIdsOf(me.id);
    if (!kids.length) { res.status(404).json({ message: 'No pupil is linked to your account yet. Please ask the school office.' }); return null; }
    const asked = Number(req.query.child);
    const id = asked || (kids.length === 1 ? kids[0] : 0);
    if (!id) { res.status(400).json({ message: 'Choose which child you mean' }); return null; }
    if (!kids.includes(id)) { res.status(403).json({ message: 'That pupil is not linked to your account' }); return null; }
    return id;
  }
  res.status(403).json({ message: 'Not allowed' });
  return null;
}

// Easy to read out loud: no 0/O or 1/l
export function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const pick = () => alphabet[Math.floor(Math.random() * alphabet.length)];
  return pick() + pick() + pick() + pick() + '-' + (Math.floor(Math.random() * 9000) + 1000) + '-' + pick() + pick() + pick();
}
