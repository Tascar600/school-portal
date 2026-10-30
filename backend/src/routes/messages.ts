import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { studentBalance } from '../utils/finance';
import { getSchoolInfo } from '../utils/settings';
import { smsConfigured, smsSender, normalisePhone, sendSms } from '../utils/sms';

const router = Router();

// WhatsApp needs the number with its country code (263...), so 0771234567 is turned into 263771234567 first
function waUrl(phone: string, body: string): string {
  const digits = (normalisePhone(phone) || phone).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}
// Opens the messages app on a phone with the text already written
function smsUrl(phone: string, body: string): string | null {
  const e164 = normalisePhone(phone);
  return e164 ? `sms:${e164}?&body=${encodeURIComponent(body)}` : null;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

// ── Is automatic SMS set up? ─────────────────────────
router.get('/config', authenticate, authorize('admin', 'bursary'), (_req: AuthRequest, res: Response) => {
  res.json({ smsEnabled: smsConfigured(), sender: smsSender() });
});

// ── Send one logged message as an SMS through the portal's SMS service ──
async function deliver(id: number): Promise<{ id: number; status: 'sent' | 'failed'; error: string }> {
  const m = (await query<any[]>('SELECT * FROM messages WHERE id = ?', [id]))[0];
  if (!m) return { id, status: 'failed', error: 'That message does not exist' };
  const to = normalisePhone(m.phone);
  if (!to) { await execute("UPDATE messages SET status = 'failed', channel = 'sms', error = ? WHERE id = ?", ['There is no valid phone number for this guardian', id]); return { id, status: 'failed', error: 'There is no valid phone number for this guardian' }; }
  const r = await sendSms(to, m.body);
  if (r.ok) { await execute("UPDATE messages SET status = 'sent', channel = 'sms', error = '', sent_at = datetime('now') WHERE id = ?", [id]); return { id, status: 'sent', error: '' }; }
  await execute("UPDATE messages SET status = 'failed', channel = 'sms', error = ? WHERE id = ?", [r.error || 'Not sent', id]);
  return { id, status: 'failed', error: r.error || 'Not sent' };
}

router.post('/:id/send-sms', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
  try {
    if (!smsConfigured()) return res.status(400).json({ message: 'Automatic SMS is not set up on this portal. Use "SMS from this device" or WhatsApp, or ask whoever looks after the portal to set it up.' });
    const r = await deliver(Number(req.params.id));
    res.status(r.status === 'sent' ? 200 : 502).json(r);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Send several at once (the whole preview). Each one is tried separately, so one bad number does not stop the rest.
router.post('/send-sms-batch', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
  try {
    if (!smsConfigured()) return res.status(400).json({ message: 'Automatic SMS is not set up on this portal.' });
    const ids: number[] = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean).slice(0, 500) : [];
    if (!ids.length) return res.status(400).json({ message: 'There is nothing to send' });
    const results = [];
    for (const id of ids) results.push(await deliver(id));
    res.json({ sent: results.filter((r) => r.status === 'sent').length, failed: results.filter((r) => r.status === 'failed').length, results });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

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
router.post('/', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, phone, body, kind } = req.body;
    const channel = req.body.channel === 'sms' ? 'sms' : 'whatsapp';
    if (!phone || !body) return res.status(400).json({ message: 'Phone and message body are required' });
    const { insertId } = await execute(
      "INSERT INTO messages (student_id, phone, body, kind, channel, status, created_by) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
      [student_id || null, phone, body, kind || 'general', channel, req.user!.id]
    );
    res.status(201).json({ id: insertId, waUrl: waUrl(phone, body), smsUrl: smsUrl(phone, body) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/sent', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute("UPDATE messages SET status = 'sent', sent_at = datetime('now') WHERE id = ?", [req.params.id]);
    res.json({ message: 'Marked as sent' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Bulk fee reminders ───────────────────────────────
router.post('/bulk-reminder', authenticate, authorize('bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, min_balance, template } = req.body;
    const channel = req.body.channel === 'sms' ? 'sms' : 'whatsapp';
    const school = await getSchoolInfo();
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
        student: s.name, class: s.class_name || '', balance: balance.toFixed(2), school: school.name,
      });
      const phone = s.guardian_phone || '';
      const { insertId } = await execute(
        "INSERT INTO messages (student_id, phone, body, kind, channel, status, created_by) VALUES (?, ?, ?, 'reminder', ?, 'pending', ?)",
        [s.id, phone, message, channel, req.user!.id]
      );
      recipients.push({ message_id: insertId, student_id: s.id, student_name: s.name, phone, e164: normalisePhone(phone), message, waUrl: phone ? waUrl(phone, message) : null, smsUrl: phone ? smsUrl(phone, message) : null });
    }
    res.json(recipients);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
