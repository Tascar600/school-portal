import express from 'express';
import cors from 'cors';
import path from 'path';
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
import courseRoutes from './routes/courses';
import attendanceRoutes from './routes/attendance';
import sportRoutes from './routes/sports';
import votingRoutes from './routes/voting';
import themeRoutes from './routes/themes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/sports', sportRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/themes', themeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

export default app;
