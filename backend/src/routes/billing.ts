import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { billClass, createAdjustment, ensureTermOpen } from '../utils/finance';

const router = Router();

// ── Bill every active student in a class for a term (idempotent) ──
router.post('/run', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { term_id, class_id, date } = req.body;
    if (!term_id || !class_id) return res.status(400).json({ message: 'term_id and class_id are required' });
    await ensureTermOpen(term_id);
    const result = await billClass(Number(class_id), Number(term_id), date || new Date().toISOString().slice(0, 10), req.user!.id);
    res.json({ message: `Billed ${result.billed} student(s), skipped ${result.skipped} (already billed or no fee structure)`, ...result });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

// ── Ad-hoc charge or credit note against one student ──
router.post('/charge', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, term_id, date, lines, notes } = req.body;
    if (!student_id || !term_id || !Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ message: 'student_id, term_id and at least one line are required' });
    }
    await ensureTermOpen(term_id);
    const result = await createAdjustment(
      Number(student_id), Number(term_id), 'charge',
      date || new Date().toISOString().slice(0, 10), lines, notes || '', req.user!.id
    );
    res.status(201).json({ message: `Charge ${result.invoiceNo} created`, ...result });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

router.post('/credit-note', authenticate, authorize('admin', 'bursary'), async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, term_id, date, lines, notes } = req.body;
    if (!student_id || !term_id || !Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ message: 'student_id, term_id and at least one line are required' });
    }
    await ensureTermOpen(term_id);
    const result = await createAdjustment(
      Number(student_id), Number(term_id), 'credit',
      date || new Date().toISOString().slice(0, 10), lines, notes || '', req.user!.id
    );
    res.status(201).json({ message: `Credit note ${result.invoiceNo} created`, ...result });
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

export default router;
