import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/class/:classId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const subjects = await query<any[]>(
      'SELECT id, name FROM subjects WHERE class_id = ? ORDER BY name',
      [req.params.classId]
    );
    res.json(subjects);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get students by class
router.get('/students/:classId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const students = await query<any[]>(
      "SELECT id, name FROM users WHERE role = 'student' AND class_id = ? ORDER BY name",
      [req.params.classId]
    );
    res.json(students);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
