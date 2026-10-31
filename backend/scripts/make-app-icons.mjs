/**
 * Draws the app icons that make the portal installable on a phone or computer, from the school badge.
 *
 *   cd backend
 *   node scripts/make-app-icons.mjs
 *
 * Writes the pictures into frontend/public/. Run it again if backend/assets/logo.png is ever replaced,
 * then rebuild the frontend. Needs Google Chrome (the browser tests use it too).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const logo = fs.readFileSync(path.join(here, '../assets/logo.png')).toString('base64');
const out = path.resolve(here, '../../frontend/public');
fs.mkdirSync(out, { recursive: true });

const CREAM = '#f3eddb';

// share = how much of the icon's width the badge may take.
// A "maskable" icon is cropped to a circle or rounded square by the phone, so its badge has to stay well inside the middle.
const icons = [
  { file: 'icon-192.png', size: 192, share: 0.8 },
  { file: 'icon-512.png', size: 512, share: 0.8 },
  { file: 'icon-maskable-512.png', size: 512, share: 0.6 },
  { file: 'apple-touch-icon.png', size: 180, share: 0.72 }, // iPhones round the corners themselves and need a solid background
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
for (const { file, size, share } of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0"><div style="width:${size}px;height:${size}px;background:${CREAM};display:flex;align-items:center;justify-content:center">` +
    `<img src="data:image/png;base64,${logo}" style="width:${Math.round(size * share)}px;height:auto"></div></body>`
  );
  await page.waitForFunction(() => document.images[0].complete);
  await page.screenshot({ path: path.join(out, file), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join(out, file));
}
await browser.close();
