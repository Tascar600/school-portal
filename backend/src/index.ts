import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import { UPLOADS_DIR, storageIsTemporary } from './config/paths';
import { trustProxySetting } from './config/proxy';
import authRoutes from './routes/auth';
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
import themeRoutes from './routes/themes';
import termRoutes from './routes/terms';
import feeItemRoutes from './routes/feeItems';
import billingRoutes from './routes/billing';
import invoiceRoutes from './routes/invoices';
import paymentRoutes from './routes/payments';
import accountRoutes from './routes/accounts';
import expenseCategoryRoutes from './routes/expenseCategories';
import expenseRoutes from './routes/expenses';
import discountRoutes from './routes/discounts';
import studentProfileRoutes from './routes/studentProfiles';
import reportRoutes from './routes/reports';
import messageRoutes from './routes/messages';
import financeStudentRoutes from './routes/financeStudents';
import currencyRoutes from './routes/currencies';
import brandingRoutes from './routes/branding';
import statsRoutes from './routes/stats';
import manualRoutes from './routes/manual';
import statementRoutes from './routes/statements';
import { auditTrail } from './middleware/audit';
import { startAutomaticCopies } from './utils/backup';
import { startEmailedBackups } from './utils/emailBackup';
import auditRoutes from './routes/audit';
import examRoutes from './routes/exams';
import parentRoutes from './routes/parents';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Which addresses are proxies, so each visitor is told apart (config/proxy.ts). Must be set before anything that reads req.ip.
app.set('trust proxy', trustProxySetting());
// Shows, for the first two visitors after each start, how the portal sees them, and warns when that is plainly wrong.
let addressChecks = 0;
if (trustProxySetting() !== false) {
  app.use((req, _res, next) => {
    if (addressChecks < 2 && req.headers['x-forwarded-for']) {
      addressChecks++;
      console.log(`Visitor address check: the portal sees this visitor as ${req.ip}. X-Forwarded-For: "${req.headers['x-forwarded-for']}", connection from ${req.socket.remoteAddress}.`);
      // Wrong if the address picked is one of the portal's own proxies (every hop was trusted), or is simply the address the
      // connection came from although a proxy header is present (the proxy that connected was not recognised as one).
      // Either way every visitor would share one log in limit again.
      if (app.get('trust proxy fn')(req.ip, 0) || req.ip === req.socket.remoteAddress) {
        console.error(`\n!! WARNING: the portal sees this visitor as ${req.ip}, which is a proxy and not the visitor, so everyone shares one log in limit. Set TRUST_PROXY (README, "Settings").\n`);
      }
    }
    next();
  });
}

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
  max: Number(process.env.AUTH_RATE_LIMIT) || 100,
  message: { message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Block direct access to the SQLite database file
app.use('/school_portal.db', (_req, res) => res.status(403).json({ message: 'Forbidden' }));
app.use('/backend/school_portal.db', (_req, res) => res.status(403).json({ message: 'Forbidden' }));

app.use('/uploads', express.static(UPLOADS_DIR));

// Serve built frontend
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

app.use('/api/auth', authLimiter, authRoutes);
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
app.use('/api/themes', themeRoutes);
app.use('/api/terms', auditTrail, termRoutes);
app.use('/api/fee-items', auditTrail, feeItemRoutes);
app.use('/api/billing', auditTrail, billingRoutes);
app.use('/api/invoices', auditTrail, invoiceRoutes);
app.use('/api/payments', auditTrail, paymentRoutes);
app.use('/api/accounts', auditTrail, accountRoutes);
app.use('/api/expense-categories', auditTrail, expenseCategoryRoutes);
app.use('/api/expenses', auditTrail, expenseRoutes);
app.use('/api/discounts', auditTrail, discountRoutes);
app.use('/api/student-profiles', auditTrail, studentProfileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/messages', auditTrail, messageRoutes);
app.use('/api/finance-students', auditTrail, financeStudentRoutes);
app.use('/api/currencies', auditTrail, currencyRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/manual', manualRoutes);
app.use('/api/statements', statementRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/parents', parentRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for any non-API path
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Make sure the upload folders exist (a new host, or a freshly attached disk, starts without them)
for (const dir of ['payments', 'homework', 'branding']) fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });

initDatabase().then(() => {
  if (storageIsTemporary()) {
    console.error('\n!! WARNING: this portal keeps its data on the host\'s temporary disk. Pupils, marks, payments and uploads are erased whenever the host\n!! restarts, redeploys or goes to sleep. Attach a permanent disk and set DATA_DIR to its mount path (README, "Deploying (Render)").\n');
  }
  startAutomaticCopies();
  startEmailedBackups();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

export default app;
