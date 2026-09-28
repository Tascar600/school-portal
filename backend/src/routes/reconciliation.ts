import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Items not yet cleared on a bank statement ────────
router.get('/:accountId/unreconciled', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const accountId = Number(req.params.accountId);
    const upTo = (req.query.upTo as string) || new Date().toISOString().slice(0, 10);

    const payments = await query<any[]>(
      `SELECT p.id, p.pay_date, p.receipt_no, p.amount_paid AS amount, u.name AS student_name
       FROM fee_payments p JOIN users u ON u.id = p.student_id
       WHERE p.account_id = ? AND p.status = 'active' AND p.cleared = 0 AND p.pay_date <= ?
       ORDER BY p.pay_date`,
      [accountId, upTo]
    );
    const expenses = await query<any[]>(
      `SELECT x.id, x.exp_date, x.voucher_no, x.amount, x.payee, x.description
       FROM expenses x WHERE x.account_id = ? AND x.status = 'active' AND x.cleared = 0 AND x.exp_date <= ?
       ORDER BY x.exp_date`,
      [accountId, upTo]
    );
    const transfersOut = await query<any[]>(
      `SELECT t.id, t.tr_date, t.amount, t.reference, a.name AS to_name
       FROM transfers t JOIN accounts a ON a.id = t.to_account
       WHERE t.from_account = ? AND t.cleared_from = 0 AND t.tr_date <= ?
       ORDER BY t.tr_date`,
      [accountId, upTo]
    );
    const transfersIn = await query<any[]>(
      `SELECT t.id, t.tr_date, t.amount, t.reference, a.name AS from_name
       FROM transfers t JOIN accounts a ON a.id = t.from_account
       WHERE t.to_account = ? AND t.cleared_to = 0 AND t.tr_date <= ?
       ORDER BY t.tr_date`,
      [accountId, upTo]
    );

    res.json({ payments, expenses, transfersOut, transfersIn });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Save a reconciliation: mark selected items cleared, snapshot the result ──
router.post('/:accountId', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const accountId = Number(req.params.accountId);
    const {
      statement_date, statement_balance, notes,
      cleared_payment_ids, cleared_expense_ids, cleared_transfer_out_ids, cleared_transfer_in_ids,
    } = req.body;
    if (!statement_date || statement_balance === undefined || statement_balance === null || statement_balance === '') {
      return res.status(400).json({ message: 'Statement date and closing balance are required' });
    }
    const acc = await queryOne<any>('SELECT * FROM accounts WHERE id = ?', [accountId]);
    if (!acc) return res.status(404).json({ message: 'Account not found' });

    for (const id of (cleared_payment_ids || []) as number[]) {
      await execute('UPDATE fee_payments SET cleared = 1, cleared_on = ? WHERE id = ? AND account_id = ?', [statement_date, id, accountId]);
    }
    for (const id of (cleared_expense_ids || []) as number[]) {
      await execute('UPDATE expenses SET cleared = 1, cleared_on = ? WHERE id = ? AND account_id = ?', [statement_date, id, accountId]);
    }
    for (const id of (cleared_transfer_out_ids || []) as number[]) {
      await execute('UPDATE transfers SET cleared_from = 1 WHERE id = ? AND from_account = ?', [id, accountId]);
    }
    for (const id of (cleared_transfer_in_ids || []) as number[]) {
      await execute('UPDATE transfers SET cleared_to = 1 WHERE id = ? AND to_account = ?', [id, accountId]);
    }

    const pay = await queryOne<any>(
      "SELECT COALESCE(SUM(amount_paid),0) AS t FROM fee_payments WHERE account_id = ? AND status='active' AND cleared = 1 AND pay_date <= ?",
      [accountId, statement_date]
    );
    const exp = await queryOne<any>(
      "SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE account_id = ? AND status='active' AND cleared = 1 AND exp_date <= ?",
      [accountId, statement_date]
    );
    const trIn = await queryOne<any>(
      'SELECT COALESCE(SUM(amount),0) AS t FROM transfers WHERE to_account = ? AND cleared_to = 1 AND tr_date <= ?',
      [accountId, statement_date]
    );
    const trOut = await queryOne<any>(
      'SELECT COALESCE(SUM(amount),0) AS t FROM transfers WHERE from_account = ? AND cleared_from = 1 AND tr_date <= ?',
      [accountId, statement_date]
    );
    const clearedBalance = Math.round(((acc.opening_balance || 0) + (pay?.t || 0) - (exp?.t || 0) + (trIn?.t || 0) - (trOut?.t || 0)) * 100) / 100;
    const stmtBal = parseFloat(statement_balance);
    const difference = Math.round((stmtBal - clearedBalance) * 100) / 100;

    const { insertId } = await execute(
      `INSERT INTO reconciliations (account_id, statement_date, statement_balance, cleared_balance, difference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, statement_date, stmtBal, clearedBalance, difference, notes || '', req.user!.id]
    );

    res.status(201).json({ cleared_balance: clearedBalance, difference, reconciliationId: insertId, message: 'Reconciliation saved' });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── Past reconciliations for an account ──────────────
router.get('/:accountId/history', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>(
      `SELECT r.*, u.name AS created_by_name FROM reconciliations r LEFT JOIN users u ON u.id = r.created_by
       WHERE r.account_id = ? ORDER BY r.statement_date DESC, r.id DESC`,
      [req.params.accountId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
