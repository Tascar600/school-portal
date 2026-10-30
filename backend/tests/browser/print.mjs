// Prints pages exactly as the browser's Print button would (A4, with the print layout) and saves them as PDFs in
// tests/browser/output/printed/, so you can look at the letterhead, border, watermark and page breaks with your own eyes.
//   npm run print:samples
import fs from 'fs';
import path from 'path';
import { SITE, OUT, open, finish, BURSAR, TEACHER, STUDENT, ADMIN } from './lib.mjs';

const dir = path.join(OUT, 'printed');
fs.mkdirSync(dir, { recursive: true });
const jobs = [
  [BURSAR, ['/finance', '/finance/payments', '/finance/students', '/finance/reports', '/finance/expenses', '/finance/accounts', '/finance/invoices']],
  [ADMIN, ['/finance/audit']],
  [TEACHER, ['/results', '/register']],
  [STUDENT, ['/report-cards', '/results', '/fees']],
];

for (const [who, routes] of jobs) {
  const { ctx, page } = await open(...who);
  for (const r of routes) {
    await page.goto(SITE + r); await page.waitForTimeout(1500);
    if (r === '/results' && who === TEACHER) { await page.click('button.tab:has-text("Marks I have entered")'); await page.waitForTimeout(700); }
    const file = path.join(dir, `${who[0].split('@')[0]}${r.replace(/\//g, '-')}.pdf`);
    await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log('saved', path.relative(OUT, file));
  }
  await ctx.close();
}
console.log(`\nOpen the PDFs in ${dir}`);
await finish('print');
