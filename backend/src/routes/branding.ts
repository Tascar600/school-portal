import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { LEARNING_AREAS, validateScale } from '../config/curriculum';
import { getSchoolInfo, saveSchoolInfo, getGradeScale, getWeights, setSetting } from '../utils/settings';
import { logoPath, uploadedLogoPath, UPLOAD_DIR } from '../utils/branding';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

// Public: the login page needs the school name and logo before anyone is signed in.
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json({ school: await getSchoolInfo(), areas: LEARNING_AREAS, scale: await getGradeScale(), weights: await getWeights() });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get('/logo', (req: Request, res: Response) => {
  const file = logoPath(req.query.size === 'small' ? 'small' : 'full');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.resolve(file));
});

// Admin: school details, grading scale and assessment weights
router.put('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { school, scale, weights } = req.body;
    if (school && typeof school === 'object') await saveSchoolInfo(school);
    if (scale !== undefined) {
      const problem = validateScale(scale);
      if (problem) return res.status(400).json({ message: problem });
      await setSetting('grading_scale', JSON.stringify(scale));
    }
    if (weights !== undefined) {
      const p = Number(weights.project), t = Number(weights.test), e = Number(weights.exam);
      if (![p, t, e].every((n) => Number.isFinite(n) && n >= 0)) return res.status(400).json({ message: 'Marks must be numbers of 0 or more' });
      if (p + t + e !== 100) return res.status(400).json({ message: `Project + Test + Exam must add up to 100 (they add up to ${p + t + e})` });
      await setSetting('assessment_weights', JSON.stringify({ project: p, test: t, exam: e }));
    }
    res.json({ message: 'Saved', school: await getSchoolInfo(), scale: await getGradeScale(), weights: await getWeights() });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post('/logo', authenticate, authorize('admin'), upload.single('logo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PNG or JPG file' });
    const isPng = req.file.buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const isJpg = req.file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    if (!isPng && !isJpg) return res.status(400).json({ message: 'The logo must be a PNG or JPG picture' });
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    for (const f of ['logo.png', 'logo.jpg']) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, isPng ? 'logo.png' : 'logo.jpg'), req.file.buffer);
    res.json({ message: 'Logo updated. It now appears on every page and printed document.' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete('/logo', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const p = uploadedLogoPath();
  if (p) fs.rmSync(p, { force: true });
  res.json({ message: 'The original school crest is back.' });
});

export default router;
