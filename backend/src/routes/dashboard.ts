import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { pupilBalances } from './stats';
import { backupStatus } from '../utils/backup';
import { childrenWithBalances } from './parents';
import { usingDefaultSecret, onAHost } from '../config/auth';
import { storageIsTemporary } from '../config/paths';

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
      const balances = await pupilBalances();
      data.students = students.count;
      data.teachers = teachers.count;
      data.classes = classes.count;
      data.outstandingFees = Math.round(balances.reduce((s, b) => s + b.balance, 0) * 100) / 100;
      data.debtorCount = balances.filter((b) => b.balance > 0.004).length;
      data.insecureSecret = usingDefaultSecret && onAHost;
      data.temporaryStorage = storageIsTemporary();
      const b = await backupStatus();
      data.backup = { daysSince: b.daysSince, stale: b.stale, lastDownloadAt: b.lastDownloadAt, staleAfterDays: b.staleAfterDays };
    } else if (role === 'teacher') {
      const [teacherInfo] = await query<any[]>('SELECT class_id FROM users WHERE id = ?', [userId]);
      const classId = teacherInfo?.class_id;
      const [subjects] = await query<any[]>('SELECT COUNT(*) AS count FROM subjects WHERE class_id = ?', [classId || 0]);
      data.subjects = subjects.count;
      data.classes = classId ? 1 : 0;
      data.className = classId ? (await query<any[]>('SELECT name FROM classes WHERE id = ?', [classId]))[0]?.name : 'N/A';
    } else if (role === 'bursary') {
      const [invoiceCount] = await query<any[]>("SELECT COUNT(*) AS count FROM invoices WHERE status='active'");
      const balances = await pupilBalances();
      const [today] = await query<any[]>(
        "SELECT COALESCE(SUM(amount),0) AS total FROM fee_payments WHERE status='active' AND pay_date = date('now')"
      );
      const [term] = await query<any[]>(
        `SELECT COALESCE(SUM(p.amount),0) AS total FROM fee_payments p
         JOIN terms t ON t.id = p.term_id WHERE p.status='active' AND t.is_current = 1`
      );
      data.invoiceCount = invoiceCount.count;
      data.outstandingFees = Math.round(balances.reduce((s, b) => s + b.balance, 0) * 100) / 100;
      data.collectedToday = today.total;
      data.collectedThisTerm = term.total;
      data.debtorCount = balances.filter((b) => b.balance > 0.004).length;
    } else if (role === 'parent') {
      data.children = await childrenWithBalances(userId);
      data.notices = (await query<any[]>("SELECT COUNT(*) AS count FROM notices WHERE target_role IN ('all', 'students')"))[0].count;
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
