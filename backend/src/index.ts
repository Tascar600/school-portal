import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import authRoutes from './routes/auth';
import feeRoutes from './routes/fees';
import timetableRoutes from './routes/timetables';
import resultRoutes from './routes/results';
import noticeRoutes from './routes/notices';
import homeworkRoutes from './routes/homework';
import quizRoutes from './routes/quizzes';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import subjectRoutes from './routes/subjects';
import courseRoutes from './routes/courses';
import attendanceRoutes from './routes/attendance';
import sportRoutes from './routes/sports';
import votingRoutes from './routes/voting';
import themeRoutes from './routes/themes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — allow the deployed frontend only
const allowedOrigins = [
  'https://school-portal-r4h0.onrender.com',
  'http://localhost:5173',
  'http://localhost:5000',
];
app.use(cors({
  origin: (origin, cb) => { cb(null, !origin || allowedOrigins.includes(origin)); },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Block direct access to the SQLite database file
app.use('/school_portal.db', (_req, res) => res.status(403).json({ message: 'Forbidden' }));
app.use('/backend/school_portal.db', (_req, res) => res.status(403).json({ message: 'Forbidden' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve built frontend
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/sports', sportRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/themes', themeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for any non-API path
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Ensure upload directories exist (Render ephemeral filesystem)
const uploadDirs = ['uploads/payments', 'uploads/homework'];
for (const dir of uploadDirs) {
  const p = path.join(__dirname, '..', dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

export default app;
