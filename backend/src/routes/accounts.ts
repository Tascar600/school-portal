import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { accountBalance } from '../utils/finance';

const router = Router();
const TYPES = ['cash', 'bank', 'mobile', 'petty'];

// ── List active accounts ─────────────────────────────
router.get('/', authenticate, authorize('admin', 'bursary'), async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>('SELECT * FROM accounts WHERE active = 1 ORDER BY name');
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Create account ────────────────────────────────────
router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, account_no, currency, opening_balance } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
    if (!TYPES.includes(type)) return res.status(400).json({ message: 'Invalid account type' });
    const { insertId } = await execute(
      'INSERT INTO accounts (name, type, account_no, currency, opening_balance, active) VALUES (?, ?, ?, ?, ?, 1)',
      [name, type, account_no || '', currency || 'USD', opening_balance ? parseFloat(opening_balance) : 0]
    );
    res.status(201).json({ id: insertId, message: 'Account created' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Update account ────────────────────────────────────
router.put('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, account_no, currency, opening_balance, active } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
    if (!TYPES.includes(type)) return res.status(400).json({ message: 'Invalid account type' });
    await execute(
      'UPDATE accounts SET name=?, type=?, account_no=?, currency=?, opening_balance=?, active=? WHERE id=?',
      [name, type, account_no || '', currency || 'USD', opening_balance ? parseFloat(opening_balance) : 0, active === false ? 0 : 1, req.params.id]
    );
    res.json({ message: 'Account updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Soft delete (deactivate) — never hard-delete ─────
router.delete('/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('UPDATE accounts SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Account deactivated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Live balance (opening_balance + payments - expenses + transfers) ──
router.get('/:id/balance', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { as_of } = req.query as Record<string, string>;
    const balance = await accountBalance(Number(req.params.id), as_of || undefined);
    res.json({ balance });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Cash book / ledger: chronological entries + running balance ──
router.get('/:id/ledger', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const acc = await queryOne<any>('SELECT * FROM accounts WHERE id = ?', [id]);
    if (!acc) return res.status(404).json({ message: 'Account not found' });

    const payments = await query<any[]>(
      `SELECT p.id, p.pay_date AS date, p.receipt_no AS reference, ('Fees: ' || u.name) AS description,
              p.amount_paid AS amount, p.created_at
       FROM fee_payments p JOIN users u ON u.id = p.student_id
       WHERE p.account_id = ? AND p.status = 'active'`,
      [id]
    );
    const expenses = await query<any[]>(
      `SELECT x.id, x.exp_date AS date, x.voucher_no AS reference,
              (x.payee || ' — ' || x.description) AS description, x.amount, x.created_at
       FROM expenses x WHERE x.account_id = ? AND x.status = 'active'`,
      [id]
    );
    const transfersIn = await query<any[]>(
      `SELECT t.id, t.tr_date AS date, COALESCE(NULLIF(t.reference, ''), 'TR-' || t.id) AS reference,
              ('Transfer from ' || a.name) AS description, t.amount, t.created_at
       FROM transfers t JOIN accounts a ON a.id = t.from_account WHERE t.to_account = ?`,
      [id]
    );
    const transfersOut = await query<any[]>(
      `SELECT t.id, t.tr_date AS date, COALESCE(NULLIF(t.reference, ''), 'TR-' || t.id) AS reference,
              ('Transfer to ' || a.name) AS description, t.amount, t.created_at
       FROM transfers t JOIN accounts a ON a.id = t.to_account WHERE t.from_account = ?`,
      [id]
    );

    const entries = [
      ...payments.map((r) => ({ ...r, type: 'payment' as const, inflow: r.amount, outflow: 0 })),
      ...expenses.map((r) => ({ ...r, type: 'expense' as const, inflow: 0, outflow: r.amount })),
      ...transfersIn.map((r) => ({ ...r, type: 'transfer_in' as const, inflow: r.amount, outflow: 0 })),
      ...transfersOut.map((r) => ({ ...r, type: 'transfer_out' as const, inflow: 0, outflow: r.amount })),
    ];
    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
      return 0;
    });

    let running = acc.opening_balance || 0;
    const rows = entries.map((e) => {
      running += e.inflow - e.outflow;
      running = Math.round(running * 100) / 100;
      return {
        id: e.id, type: e.type, date: e.date, reference: e.reference,
        description: e.description, amount: e.inflow || -e.outflow, balance: running,
      };
    });

    res.json({ account: acc, opening_balance: acc.opening_balance, rows });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Transfer between accounts ────────────────────────
router.post('/transfer', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { tr_date, from_account, to_account, amount, reference, notes } = req.body;
    if (!tr_date || !from_account || !to_account) {
      return res.status(400).json({ message: 'Date, from account and to account are required' });
    }
    if (Number(from_account) === Number(to_account)) {
      return res.status(400).json({ message: 'From and to accounts must be different' });
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ message: 'Amount must be greater than zero' });
    const { insertId } = await execute(
      'INSERT INTO transfers (tr_date, from_account, to_account, amount, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tr_date, from_account, to_account, amt, reference || '', notes || '', req.user!.id]
    );
    res.status(201).json({ id: insertId, message: 'Transfer recorded' });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── Delete transfer (blocked once reconciled) ────────
router.delete('/transfer/:id', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const t = await queryOne<any>('SELECT * FROM transfers WHERE id = ?', [req.params.id]);
    if (!t) return res.status(404).json({ message: 'Transfer not found' });
    if (t.cleared_from || t.cleared_to) {
      return res.status(400).json({ message: 'This transfer is already reconciled with a bank statement and cannot be deleted' });
    }
    await execute('DELETE FROM transfers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Transfer deleted' });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

export default router;
