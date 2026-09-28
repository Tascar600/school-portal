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
      const [outstanding] = await query<any[]>(
        `SELECT COALESCE((SELECT SUM(total) FROM invoices WHERE status='active'),0) -
                COALESCE((SELECT SUM(amount) FROM fee_payments WHERE status='active'),0) AS total`
      );
      data.students = students.count;
      data.teachers = teachers.count;
      data.classes = classes.count;
      data.outstandingFees = outstanding.total;
    } else if (role === 'teacher') {
      const [teacherInfo] = await query<any[]>('SELECT class_id FROM users WHERE id = ?', [userId]);
      const classId = teacherInfo?.class_id;
      const [subjects] = await query<any[]>('SELECT COUNT(*) AS count FROM subjects WHERE class_id = ?', [classId || 0]);
      data.subjects = subjects.count;
      data.classes = classId ? 1 : 0;
      data.className = classId ? (await query<any[]>('SELECT name FROM classes WHERE id = ?', [classId]))[0]?.name : 'N/A';
    } else if (role === 'bursary') {
      const [invoiceCount] = await query<any[]>("SELECT COUNT(*) AS count FROM invoices WHERE status='active'");
      const [outstanding] = await query<any[]>(
        `SELECT COALESCE((SELECT SUM(total) FROM invoices WHERE status='active'),0) -
                COALESCE((SELECT SUM(amount) FROM fee_payments WHERE status='active'),0) AS total`
      );
      data.invoiceCount = invoiceCount.count;
      data.outstandingFees = outstanding.total;
    } else if (role === 'student') {
      const [classInfo] = await query<any[]>(
        'SELECT c.name FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ?', [userId]
      );
      data.className = classInfo?.name || 'N/A';

      const [inv] = await query<any[]>("SELECT COALESCE(SUM(total),0) AS t FROM invoices WHERE student_id=? AND status='active'", [userId]);
      const [pay] = await query<any[]>("SELECT COALESCE(SUM(amount),0) AS t FROM fee_payments WHERE student_id=? AND status='active'", [userId]);
      data.feeBalance = inv.t - pay.t;

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
