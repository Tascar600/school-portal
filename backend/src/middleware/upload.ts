import multer from 'multer';
import path from 'path';

const paymentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/payments'));
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const homeworkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/homework'));
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, images, and document files are allowed'));
  }
};

export const uploadPayment = multer({
  storage: paymentStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('proof');

export const uploadHomework = multer({
  storage: homeworkStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');
