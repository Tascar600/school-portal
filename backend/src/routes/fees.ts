import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { uploadPayment } from '../middleware/upload';

const router = Router();

// ── Helpers ──────────────────────────────────────────
const getSetting = async (key: string): Promise<string | null> => {
  const rows = await query<any[]>('SELECT value FROM settings WHERE key = ?', [key]);
  return rows[0]?.value || null;
};
const setSetting = async (key: string, value: string) => {
  await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
};
const ensureFeeAccounts = async (studentId: number) => {
  const existing = await query<any[]>(
    'SELECT COUNT(*) AS cnt FROM fee_accounts WHERE student_id = ?', [studentId]
  );
  if (existing[0]?.cnt > 0) return;
  const sdc = await getSetting('sdc_fee');
  const ssf = await getSetting('ssf_fee');
  if (sdc) {
    await execute(
      'INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?, ?, ?, ?)',
      [studentId, 'SDC', parseFloat(sdc), parseFloat(sdc)]
    );
  }
  if (ssf) {
    await execute(
      'INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) VALUES (?, ?, ?, ?)',
      [studentId, 'SSF', parseFloat(ssf), parseFloat(ssf)]
    );
  }
};

// ── Global fee settings ──────────────────────────────
router.post('/settings', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { sdc_fee, ssf_fee } = req.body;
    if (!sdc_fee || !ssf_fee) return res.status(400).json({ message: 'Both SDC and SSF fee amounts are required' });
    const sdc = parseFloat(sdc_fee), ssf = parseFloat(ssf_fee);
    if (isNaN(sdc) || isNaN(ssf) || sdc <= 0 || ssf <= 0) return res.status(400).json({ message: 'Fee amounts must be positive numbers' });
    await setSetting('sdc_fee', sdc.toString());
    await setSetting('ssf_fee', ssf.toString());
    res.json({ message: `Fee amounts set: SDC $${sdc.toFixed(2)}, SSF $${ssf.toFixed(2)}` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/settings', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const sdc = await getSetting('sdc_fee'), ssf = await getSetting('ssf_fee');
    res.json({ sdc_fee: sdc ? parseFloat(sdc) : null, ssf_fee: ssf ? parseFloat(ssf) : null });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Student: get own fee accounts ────────────────────
router.get('/my', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    await ensureFeeAccounts(req.user!.id);
    const accounts = await query<any[]>('SELECT * FROM fee_accounts WHERE student_id = ?', [req.user!.id]);
    for (const acc of accounts) {
      acc.payments = await query<any[]>(
        'SELECT * FROM payments WHERE student_id = ? AND account_type = ? ORDER BY created_at DESC',
        [req.user!.id, acc.account_type]
      );
    }
    res.json(accounts);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Student: make a payment ──────────────────────────
router.post('/pay', authenticate, authorize('student'), (req: AuthRequest, res: Response) => {
  uploadPayment(req, res, async (err) => {
    if (err) { res.status(400).json({ message: err.message }); return; }
    try {
      const { account_type, amount, notes, receipt_number } = req.body;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) { res.status(400).json({ message: 'Invalid amount' }); return; }

      await ensureFeeAccounts(req.user!.id);
      const [account] = await query<any[]>('SELECT * FROM fee_accounts WHERE student_id = ? AND account_type = ?', [req.user!.id, account_type]);
      if (!account) { res.status(400).json({ message: 'No fee account found for this type' }); return; }
      if (parsedAmount > account.balance) {
        return res.status(400).json({ message: `Payment exceeds balance ($${account.balance.toFixed(2)}). You cannot pay more than the amount owing.` });
      }

      const proofPath = req.file ? '/uploads/payments/' + req.file.filename : '';
      await execute(
        'INSERT INTO payments (student_id, account_type, amount, proof_file, notes, receipt_number) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user!.id, account_type, parsedAmount, proofPath, notes || '', receipt_number || '']
      );
      await execute('UPDATE fee_accounts SET balance = balance - ? WHERE student_id = ? AND account_type = ?', [parsedAmount, req.user!.id, account_type]);
      res.status(201).json({ message: 'Payment submitted for verification' });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
});

// ── Admin: get pending payments ──────────────────────
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

// ── Admin: get all fee accounts ─────────────────────
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

// ── Admin: fees statistics ───────────────────────────
router.get('/stats', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const totalSDC = await query<any[]>('SELECT COUNT(*), COALESCE(SUM(total_fee),0) AS t, COALESCE(SUM(balance),0) AS b FROM fee_accounts WHERE account_type=?', ['SDC']);
    const totalSSF = await query<any[]>('SELECT COUNT(*), COALESCE(SUM(total_fee),0) AS t, COALESCE(SUM(balance),0) AS b FROM fee_accounts WHERE account_type=?', ['SSF']);
    const verifiedPayments = await query<any[]>("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status='verified'");
    const fullyPaidSDC = await query<any[]>('SELECT COUNT(*) AS cnt FROM fee_accounts WHERE account_type=? AND balance<=0', ['SDC']);
    const fullyPaidSSF = await query<any[]>('SELECT COUNT(*) AS cnt FROM fee_accounts WHERE account_type=? AND balance<=0', ['SSF']);
    const pendingCount = await query<any[]>("SELECT COUNT(*) AS cnt FROM payments WHERE status='pending'");
    res.json({
      sdc: { accounts: totalSDC[0]['COUNT(*)'], total: totalSDC[0].t, outstanding: totalSDC[0].b, fullyPaid: fullyPaidSDC[0].cnt },
      ssf: { accounts: totalSSF[0]['COUNT(*)'], total: totalSSF[0].t, outstanding: totalSSF[0].b, fullyPaid: fullyPaidSSF[0].cnt },
      totalCollected: verifiedPayments[0].total,
      pendingVerifications: pendingCount[0].cnt
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Teacher: student fees breakdown per class ────────
router.get('/teacher-view', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const [teacher] = await query<any[]>('SELECT class_id FROM users WHERE id=?', [req.user!.id]);
    if (!teacher?.class_id) return res.json([]);
    const students = await query<any[]>(
      'SELECT id, name FROM users WHERE role=? AND class_id=? ORDER BY name',
      ['student', teacher.class_id]
    );
    const result: any[] = [];
    for (const s of students) {
      await ensureFeeAccounts(s.id);
      const accounts = await query<any[]>('SELECT * FROM fee_accounts WHERE student_id=?', [s.id]);
      const studentRow: any = { id: s.id, name: s.name, sdc: null, ssf: null };
      for (const a of accounts) {
        studentRow[a.account_type.toLowerCase()] = {
          totalFee: a.total_fee, balance: a.balance, paid: a.total_fee - a.balance
        };
      }
      result.push(studentRow);
    }
    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Teacher: get fee accounts for their students ─────
router.get('/accounts/my-students', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const [teacherInfo] = await query<any[]>('SELECT class_id FROM users WHERE id=?', [req.user!.id]);
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

// ── Admin: verify / reject payment ──────────────────
router.put('/verify/:paymentId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body;
    const status = action === 'verified' ? 'verified' : 'rejected';
    await execute('UPDATE payments SET status=?, verified_by=?, updated_at=? WHERE id=?',
      [status, req.user!.id, new Date().toISOString(), req.params.paymentId]);
    if (status === 'rejected') {
      const payment = await query<any[]>('SELECT * FROM payments WHERE id=?', [req.params.paymentId]);
      if (payment[0]) {
        await execute('UPDATE fee_accounts SET balance=balance+? WHERE student_id=? AND account_type=?',
          [payment[0].amount, payment[0].student_id, payment[0].account_type]);
      }
    }
    res.json({ message: `Payment ${status}` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Admin: undo a verification/rejection (revert to pending) ──
router.post('/undo/:paymentId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const [payment] = await query<any[]>('SELECT * FROM payments WHERE id=?', [req.params.paymentId]);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'pending') return res.status(400).json({ message: 'Payment is already pending' });

    const wasVerified = payment.status === 'verified';
    await execute('UPDATE payments SET status=?, updated_at=? WHERE id=?',
      ['pending', new Date().toISOString(), req.params.paymentId]);

    if (wasVerified) {
      // Re-verify: reverse the balance deduction that was applied during verification
      // Actually when a payment is verified, balance was already deducted at submission time.
      // Verified status just means admin confirmed it. If we undo the verification,
      // we need to add the balance back (same as rejecting)
      await execute('UPDATE fee_accounts SET balance=balance+? WHERE student_id=? AND account_type=?',
        [payment.amount, payment.student_id, payment.account_type]);
    } else {
      // Was rejected — balance was refunded, so deduct again
      await execute('UPDATE fee_accounts SET balance=balance-? WHERE student_id=? AND account_type=?',
        [payment.amount, payment.student_id, payment.account_type]);
    }
    res.json({ message: 'Payment reverted to pending' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Admin: TERM END ──────────────────────────────────
router.post('/term-end', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { sdc_fee, ssf_fee } = req.body;
    if (!sdc_fee || !ssf_fee) return res.status(400).json({ message: 'Both sdc_fee and ssf_fee amounts are required' });
    const feeSDC = parseFloat(sdc_fee), feeSSF = parseFloat(ssf_fee);
    if (isNaN(feeSDC) || isNaN(feeSSF) || feeSDC <= 0 || feeSSF <= 0) return res.status(400).json({ message: 'Invalid fee amounts' });

    await setSetting('sdc_fee', feeSDC.toString());
    await setSetting('ssf_fee', feeSSF.toString());

    const accounts = await query<any[]>('SELECT * FROM fee_accounts');
    let updated = 0;
    for (const acc of accounts) {
      const credit = Math.max(0, -acc.balance);
      const newFee = acc.account_type === 'SDC' ? feeSDC : feeSSF;
      const newBalance = newFee - credit;
      await execute('UPDATE fee_accounts SET total_fee=?, balance=? WHERE id=?', [newFee, newBalance, acc.id]);
      updated++;
    }
    res.json({ message: `Term ended. ${updated} accounts reset. Credits carried forward.` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Admin: YEAR END ──────────────────────────────────
router.post('/year-end', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const classes = await query<any[]>('SELECT id FROM classes ORDER BY id');
    const classIds = classes.map((c: any) => c.id);
    const students = await query<any[]>('SELECT id, class_id FROM users WHERE role=?', ['student']);
    let promoted = 0, graduated = 0;
    for (const s of students) {
      if (!s.class_id) continue;
      const idx = classIds.indexOf(s.class_id);
      if (idx === -1 || idx === classIds.length - 1) {
        await execute('UPDATE users SET class_id=NULL WHERE id=?', [s.id]); graduated++;
      } else {
        await execute('UPDATE users SET class_id=? WHERE id=?', [classIds[idx + 1], s.id]); promoted++;
      }
    }
    await execute("UPDATE users SET class_id=NULL WHERE role='teacher'");
    res.json({ message: `Year ended. ${promoted} promoted, ${graduated} graduated. Teacher assignments reset.` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
