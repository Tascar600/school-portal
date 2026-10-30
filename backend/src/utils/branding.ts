import fs from 'fs';
import path from 'path';

// One logo for the whole system. The Admin can upload a replacement (Admin Panel > School Details);
// until then the crest in backend/assets is used.
export const UPLOAD_DIR = path.join(__dirname, '../../uploads/branding');
const ASSET_DIR = path.join(__dirname, '../../assets');

export function uploadedLogoPath(): string | null {
  for (const ext of ['png', 'jpg']) {
    const p = path.join(UPLOAD_DIR, `logo.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// full = for documents; small = for the screen
export function logoPath(size: 'full' | 'small' = 'full'): string {
  const uploaded = uploadedLogoPath();
  if (uploaded) return uploaded;
  return path.join(ASSET_DIR, size === 'small' ? 'logo-small.png' : 'logo.png');
}

// School colours: green, cream and gold
export const COLORS = {
  green: '#1f5a2e',
  greenDark: '#143d1f',
  greenSoft: '#e6f0e3',
  cream: '#f7f1de',
  creamDark: '#e9dfc0',
  gold: '#b8902a',
  goldSoft: '#f3e7bf',
  ink: '#1c1c1c',
  grey: '#5f6368',
  line: '#cfc7ad',
  red: '#a4262c',
};
