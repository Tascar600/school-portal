import { Router, Response } from 'express';
import { queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const CATEGORIES = ['day', 'staff_child', 'beam', 'sponsored'];

// ── Get a student's finance profile (sensible defaults if none yet) ──
router.get('/:studentId', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne<any>('SELECT * FROM student_profiles WHERE user_id = ?', [req.params.studentId]);
    res.json(
      row || {
        user_id: Number(req.params.studentId), category: 'day', discount_id: null, sponsor_id: null, status: 'active',
        guardian_name: '', guardian_phone: '', guardian_email: '', address: '', family_code: '', gender: null, dob: null, notes: '',
      }
    );
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Upsert a student's finance profile ───────────────
router.put('/:studentId', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = Number(req.params.studentId);
    const {
      category, discount_id, sponsor_id, guardian_name, guardian_phone, guardian_email,
      address, family_code, gender, dob, notes,
    } = req.body;
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid category' });
    if (gender && !['M', 'F'].includes(gender)) return res.status(400).json({ message: 'Invalid gender' });

    const existing = await queryOne<any>('SELECT user_id FROM student_profiles WHERE user_id = ?', [studentId]);
    if (existing) {
      await execute(
        `UPDATE student_profiles SET category=?, discount_id=?, sponsor_id=?, guardian_name=?, guardian_phone=?, guardian_email=?, address=?, family_code=?, gender=?, dob=?, notes=? WHERE user_id=?`,
        [category || 'day', discount_id || null, sponsor_id || null, guardian_name || '', guardian_phone || '', guardian_email || '', address || '', family_code || '', gender || null, dob || null, notes || '', studentId]
      );
    } else {
      await execute(
        `INSERT INTO student_profiles (user_id, category, discount_id, sponsor_id, guardian_name, guardian_phone, guardian_email, address, family_code, gender, dob, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, category || 'day', discount_id || null, sponsor_id || null, guardian_name || '', guardian_phone || '', guardian_email || '', address || '', family_code || '', gender || null, dob || null, notes || '']
      );
    }
    res.json({ message: 'Student profile updated' });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

export default router;
