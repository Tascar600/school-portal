import { Router, Response } from 'express';
import { queryOne, execute } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Exactly four looks. "system" is the professional default and follows the computer's light/dark setting.
const THEMES = [
  { id: 'system', name: 'Professional (default)' },
  { id: 'light', name: 'White' },
  { id: 'dark', name: 'Dark' },
  { id: 'black', name: 'Extra dark' },
];
const valid = (t: any) => THEMES.some((x) => x.id === t);

// Anyone who picked one of the old coloured themes simply gets the professional default.
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await queryOne<any>('SELECT theme FROM user_settings WHERE user_id=?', [req.user!.id]);
    res.json({ theme: settings && valid(settings.theme) ? settings.theme : 'system' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const theme = valid(req.body.theme) ? req.body.theme : 'system';
    const existing = await queryOne<any>('SELECT id FROM user_settings WHERE user_id=?', [req.user!.id]);
    if (existing) await execute('UPDATE user_settings SET theme=? WHERE user_id=?', [theme, req.user!.id]);
    else await execute('INSERT INTO user_settings (user_id, theme, accent_color) VALUES (?, ?, ?)', [req.user!.id, theme, '#1f5a2e']);
    res.json({ message: 'Theme updated', theme });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/list', authenticate, async (_req: AuthRequest, res: Response) => {
  res.json(THEMES);
});

export default router;
