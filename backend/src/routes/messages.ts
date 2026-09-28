import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { studentBalance } from '../utils/finance';

const router = Router();

function waUrl(phone: string, body: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

// ── Message history ──────────────────────────────────
router.get('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, kind } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: any[] = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (kind) { where.push('kind = ?'); params.push(kind); }
    const rows = await query<any[]>(
      `SELECT m.*, u.name AS student_name FROM messages m LEFT JOIN users u ON u.id = m.student_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.created_at DESC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Log a single message attempt, return its wa.me link ──
router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, phone, body, kind } = req.body;
    if (!phone || !body) return res.status(400).json({ message: 'Phone and message body are required' });
    const { insertId } = await execute(
      "INSERT INTO messages (student_id, phone, body, kind, channel, status, created_by) VALUES (?, ?, ?, ?, 'whatsapp', 'pending', ?)",
      [student_id || null, phone, body, kind || 'general', req.user!.id]
    );
    res.status(201).json({ id: insertId, waUrl: waUrl(phone, body) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/sent', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute("UPDATE messages SET status = 'sent', sent_at = datetime('now') WHERE id = ?", [req.params.id]);
    res.json({ message: 'Marked as sent' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Bulk fee reminders ───────────────────────────────
router.post('/bulk-reminder', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, min_balance, template } = req.body;
    if (!template) return res.status(400).json({ message: 'A message template is required' });
    const where: string[] = ["u.role = 'student'"];
    const params: any[] = [];
    if (class_id) { where.push('u.class_id = ?'); params.push(class_id); }
    const students = await query<any[]>(
      `SELECT u.id, u.name, c.name AS class_name, sp.guardian_phone
       FROM users u LEFT JOIN classes c ON c.id = u.class_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE ${where.join(' AND ')} ORDER BY u.name`,
      params
    );
    const minBal = min_balance ? parseFloat(min_balance) : 0;
    const recipients: any[] = [];
    for (const s of students) {
      const balance = await studentBalance(s.id);
      if (balance < minBal) continue;
      const message = fillTemplate(template, {
        student: s.name, class: s.class_name || '', balance: balance.toFixed(2), school: 'Tascar School Portal',
      });
      const phone = s.guardian_phone || '';
      const { insertId } = await execute(
        "INSERT INTO messages (student_id, phone, body, kind, channel, status, created_by) VALUES (?, ?, ?, 'reminder', 'whatsapp', 'pending', ?)",
        [s.id, phone, message, req.user!.id]
      );
      recipients.push({ message_id: insertId, student_id: s.id, student_name: s.name, phone, message, waUrl: phone ? waUrl(phone, message) : null });
    }
    res.json(recipients);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
