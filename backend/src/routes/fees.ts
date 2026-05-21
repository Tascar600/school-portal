import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { uploadPaymentProof } from '../middleware/upload';

const router = Router();

// Admin: create fee account for a student
router.post('/accounts', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, account_type, total_fee } = req.body;
    await execute(
      'INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?, ?, ?, ?)',
      [student_id, account_type, total_fee, total_fee]
    );
    res.status(201).json({ message: 'Fee account created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: get own fee accounts
router.get('/my', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await query<any[]>(
      'SELECT * FROM fee_accounts WHERE student_id = ?',
      [req.user!.id]
    );
    for (const acc of accounts) {
      acc.payments = await query<any[]>(
        'SELECT * FROM payments WHERE student_id = ? AND account_type = ? ORDER BY created_at DESC',
        [req.user!.id, acc.account_type]
      );
    }
    res.json(accounts);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Student: make a payment (proof file is optional)
router.post('/pay', authenticate, authorize('student'), (req: AuthRequest, res: Response) => {
  uploadPaymentProof(req, res, async (err) => {
    if (err) { res.status(400).json({ message: err.message }); return; }
    try {
      const { account_type, amount, notes } = req.body;
      const proofPath = req.file ? '/uploads/payments/' + req.file.filename : '';
      await execute(
        'INSERT INTO payments (student_id, account_type, amount, proof_file, notes) VALUES (?, ?, ?, ?, ?)',
        [req.user!.id, account_type, parseFloat(amount), proofPath, notes || '']
      );
      // Update balance
      await execute(
        'UPDATE fee_accounts SET balance = balance - ? WHERE student_id = ? AND account_type = ?',
        [parseFloat(amount), req.user!.id, account_type]
      );
      res.status(201).json({ message: 'Payment submitted for verification', proof: proofPath || 'text reference' });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
});

// Admin: get pending payments
router.get('/pending', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const payments = await query<any[]>(
      `SELECT p.*, u.name AS student_name FROM payments p
       JOIN users u ON u.id = p.student_id
       WHERE p.status = 'pending'
       ORDER BY p.created_at DESC`
    );
    res.json(payments);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: get all fee accounts
router.get('/accounts', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await query<any[]>(
      `SELECT fa.*, u.name AS student_name FROM fee_accounts fa
       JOIN users u ON u.id = fa.student_id
       ORDER BY u.name`
    );
    for (const acc of accounts) {
      acc.payments = await query<any[]>(
        'SELECT * FROM payments WHERE student_id = ? AND account_type = ? ORDER BY created_at DESC',
        [acc.student_id, acc.account_type]
      );
    }
    res.json(accounts);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Teacher: get fee accounts for their students
router.get('/accounts/my-students', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const [teacherInfo] = await query<any[]>('SELECT class_id FROM users WHERE id = ?', [req.user!.id]);
    const classIds = teacherInfo?.class_id ? [teacherInfo.class_id] : [];
    if (classIds.length === 0) { res.json([]); return; }
    const placeholders = classIds.map(() => '?').join(',');
    const accounts = await query<any[]>(
      `SELECT fa.*, u.name AS student_name FROM fee_accounts fa
       JOIN users u ON u.id = fa.student_id
       WHERE fa.student_id IN (SELECT id FROM users WHERE class_id IN (${placeholders}))
       ORDER BY u.name`,
      classIds
    );
    for (const acc of accounts) {
      acc.payments = await query<any[]>(
        'SELECT * FROM payments WHERE student_id = ? AND account_type = ? ORDER BY created_at DESC',
        [acc.student_id, acc.account_type]
      );
    }
    res.json(accounts);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admin: verify payment
router.put('/verify/:paymentId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body;
    const status = action === 'verified' ? 'verified' : 'rejected';
    await execute(
      'UPDATE payments SET status = ?, verified_by = ?, updated_at = ? WHERE id = ?',
      [status, req.user!.id, new Date().toISOString(), req.params.paymentId]
    );
    if (status === 'rejected') {
      // Refund the balance
      const payment = await query<any[]>('SELECT * FROM payments WHERE id = ?', [req.params.paymentId]);
      if (payment[0]) {
        await execute(
          'UPDATE fee_accounts SET balance = balance + ? WHERE student_id = ? AND account_type = ?',
          [payment[0].amount, payment[0].student_id, payment[0].account_type]
        );
      }
    }
    res.json({ message: `Payment ${status}` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
