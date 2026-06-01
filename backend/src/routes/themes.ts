import { Router, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user theme settings
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let settings = await queryOne<any>('SELECT * FROM user_settings WHERE user_id=?', [req.user!.id]);
    if (!settings) {
      settings = { theme: 'default', accent_color: '#1a237e' };
      await execute('INSERT INTO user_settings (user_id, theme, accent_color) VALUES (?, ?, ?)',
        [req.user!.id, 'default', '#1a237e']);
    }
    res.json(settings);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Update theme
router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { theme, accent_color } = req.body;
    const existing = await queryOne<any>('SELECT id FROM user_settings WHERE user_id=?', [req.user!.id]);
    if (existing) {
      await execute(
        'UPDATE user_settings SET theme=?, accent_color=? WHERE user_id=?',
        [theme || 'default', accent_color || '#1a237e', req.user!.id]
      );
    } else {
      await execute(
        'INSERT INTO user_settings (user_id, theme, accent_color) VALUES (?, ?, ?)',
        [req.user!.id, theme || 'default', accent_color || '#1a237e']
      );
    }
    res.json({ message: 'Theme updated' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Get available themes list
router.get('/list', authenticate, async (_req: AuthRequest, res: Response) => {
  const themes = [
    { id: 'default', name: 'Nexus Blue', color: '#00f0ff', bg: '#0a0a1a', neon: '#00f0ff' },
    { id: 'cyberpunk', name: 'Cyberpunk', color: '#ff006e', bg: '#12001a', neon: '#ff006e' },
    { id: 'matrix', name: 'Matrix', color: '#00ff41', bg: '#000a00', neon: '#00ff41' },
    { id: 'hologram', name: 'Hologram', color: '#22d3ee', bg: '#0a1a2e', neon: '#22d3ee' },
    { id: 'solar', name: 'Solar Flare', color: '#ff6b35', bg: '#1a0a00', neon: '#ff6b35' },
    { id: 'nebula', name: 'Nebula', color: '#a855f7', bg: '#0a001a', neon: '#a855f7' },
    { id: 'quantum', name: 'Quantum', color: '#00bcd4', bg: '#00101a', neon: '#00e5ff' },
    { id: 'plasma', name: 'Plasma', color: '#39ff14', bg: '#000a0a', neon: '#39ff14' },
    { id: 'void', name: 'Void', color: '#bb86fc', bg: '#000000', neon: '#bb86fc' },
    { id: 'aurora', name: 'Aurora', color: '#2dd4bf', bg: '#001a14', neon: '#5eead4' },
    { id: 'starlight', name: 'Starlight', color: '#fbbf24', bg: '#0a0a1a', neon: '#fde047' },
    { id: 'crimson', name: 'Crimson Storm', color: '#ef4444', bg: '#1a0000', neon: '#f87171' },
    { id: 'deepsea', name: 'Deep Sea', color: '#0ea5e9', bg: '#000a1a', neon: '#38bdf8' },
    { id: 'midnight', name: 'Midnight', color: '#6366f1', bg: '#0a0a1a', neon: '#818cf8' },
    { id: 'sunset', name: 'Sunset', color: '#f97316', bg: '#1a0a05', neon: '#fb923c' },
    { id: 'emerald', name: 'Emerald City', color: '#10b981', bg: '#001a0a', neon: '#34d399' },
    { id: 'daylight', name: 'Daylight', color: '#2563eb', bg: '#f0f4ff', neon: '#3b82f6', light: true },
  ];
  res.json(themes);
});

export default router;
