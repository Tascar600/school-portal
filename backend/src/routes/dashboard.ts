import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;
    const userId = req.user!.id;
    let data: any = { role };

    if (role === 'admin') {
      const [students] = await query<any[]>('SELECT COUNT(*) AS count FROM users WHERE role = ?', ['student']);
      const [teachers] = await query<any[]>('SELECT COUNT(*) AS count FROM users WHERE role = ?', ['teacher']);
      const [classes] = await query<any[]>('SELECT COUNT(*) AS count FROM classes');
      const [pendingPayments] = await query<any[]>('SELECT COUNT(*) AS count FROM payments WHERE status = ?', ['pending']);
      data.students = students.count;
      data.teachers = teachers.count;
      data.classes = classes.count;
      data.pendingPayments = pendingPayments.count;
    } else if (role === 'teacher') {
      const [subjects] = await query<any[]>('SELECT COUNT(*) AS count FROM subjects WHERE teacher_id = ?', [userId]);
      const [myClasses] = await query<any[]>(
        'SELECT COUNT(DISTINCT class_id) AS count FROM subjects WHERE teacher_id = ?', [userId]
      );
      data.subjects = subjects.count;
      data.classes = myClasses.count;
    } else if (role === 'student') {
      const [classInfo] = await query<any[]>(
        'SELECT c.name FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ?', [userId]
      );
      data.className = classInfo?.name || 'N/A';

      const feeAccounts = await query<any[]>('SELECT * FROM fee_accounts WHERE student_id = ?', [userId]);
      data.feeAccounts = feeAccounts;

      const [notices] = await query<any[]>('SELECT COUNT(*) AS count FROM notices WHERE target_role IN (?,?)',
        ['all', 'students']);
      data.notices = notices.count;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
