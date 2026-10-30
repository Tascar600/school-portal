import { Router, Response } from 'express';
import { queryOne } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getSchoolInfo } from '../utils/settings';
import { MANUALS } from '../manual/content';
import { buildManual } from '../manual/render';
import { Role } from '../manual/types';

const router = Router();

// "Download Manual": a PDF written for the kind of account the person is logged in with,
// with their own name and login email filled in (never their password).
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role as Role;
    const manual = MANUALS[role];
    if (!manual) return res.status(404).json({ message: 'There is no manual for this account type' });
    const me = await queryOne<any>(
      `SELECT u.name, u.email, u.student_number, c.name AS class_name FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ?`,
      [req.user!.id]
    );
    const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
    const portalUrl = `${forwarded || req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const pdf = await buildManual(manual, await getSchoolInfo(), me, portalUrl);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="User Manual - ${manual.roleLabel}.pdf"`);
    res.send(pdf);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
