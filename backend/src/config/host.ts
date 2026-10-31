import dotenv from 'dotenv';

dotenv.config(); // so every setting (JWT_SECRET, DATA_DIR, DB_PATH ...) can also be written in backend/.env

// True when the portal runs on a host that other people can reach (Render sets RENDER), and not on your own computer.
// Kept apart from auth.ts and paths.ts because both of them need it.
export const onAHost = !!process.env.RENDER || process.env.NODE_ENV === 'production';
