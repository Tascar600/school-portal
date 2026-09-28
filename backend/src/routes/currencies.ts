import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// ── List currencies (rate = units of this currency per 1 base unit) ──
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any[]>('SELECT * FROM currencies ORDER BY is_base DESC, code');
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Add a currency (e.g. ZWG) ────────────────────────
router.post('/', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, rate } = req.body;
    if (!code || !name) return res.status(400).json({ message: 'Code and name are required' });
    const r = parseFloat(rate);
    if (isNaN(r) || r <= 0) return res.status(400).json({ message: 'Rate must be a positive number' });
    await execute('INSERT INTO currencies (code, name, rate, is_base, active) VALUES (?, ?, ?, 0, 1)', [code.toUpperCase(), name, r]);
    res.status(201).json({ message: `${code.toUpperCase()} added` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ── Update a currency's exchange rate / active flag (base currency's rate stays 1) ──
router.put('/:code', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const code = req.params.code.toUpperCase();
    const existing = await query<any[]>('SELECT * FROM currencies WHERE code = ?', [code]);
    if (!existing.length) return res.status(404).json({ message: 'Currency not found' });
    if (existing[0].is_base) return res.status(400).json({ message: "The base currency's rate is always 1 and can't be changed" });
    const { rate, active } = req.body;
    const r = parseFloat(rate);
    if (isNaN(r) || r <= 0) return res.status(400).json({ message: 'Rate must be a positive number' });
    await execute('UPDATE currencies SET rate = ?, active = ? WHERE code = ?', [r, active === false ? 0 : 1, code]);
    res.json({ message: `${code} updated` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
