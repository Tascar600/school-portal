import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { createBrandedDoc, finish, Brand } from '../utils/pdfBrand';
import { COLORS } from '../utils/branding';
import { SchoolInfo } from '../utils/settings';
import { Callout, Kind, ManualPage, RoleManual, Task } from './types';
import { commonPages, ROLE_INTRO } from './content/common';

export const SHOT_DIR = path.join(__dirname, '../../assets/manual');

interface Who { name: string; email: string; student_number?: string | null; class_name?: string | null }

// How each kind of control is drawn next to its explanation
const CHIP: Record<Kind, { fill: string; text: string; stroke: string; radius: number }> = {
  primary: { fill: COLORS.green, text: '#ffffff', stroke: COLORS.green, radius: 4 },
  success: { fill: '#1c7a38', text: '#ffffff', stroke: '#1c7a38', radius: 4 },
  default: { fill: '#ffffff', text: COLORS.ink, stroke: '#8a8f94', radius: 4 },
  danger: { fill: '#ffffff', text: COLORS.red, stroke: COLORS.red, radius: 4 },
  field: { fill: '#ffffff', text: COLORS.grey, stroke: '#8a8f94', radius: 2 },
  link: { fill: '#ffffff', text: '#1d5f8a', stroke: '#ffffff', radius: 2 },
  area: { fill: COLORS.cream, text: COLORS.ink, stroke: COLORS.line, radius: 2 },
};

// Width and height of a JPEG, read from its header
function jpegSize(file: string): { w: number; h: number } | null {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function render(manual: RoleManual, school: SchoolInfo, who: Who, portalUrl: string, tocPages: Map<string, number>): Promise<{ buf: Buffer; toc: { title: string; level: number }[]; pages: Map<string, number> }> {
  const b: Brand = createBrandedDoc(school, { size: 'A4', title: `${school.name} – ${manual.roleLabel} manual`, margin: 50 });
  const { doc, W, H, M } = b;
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on('data', (c) => chunks.push(c));
  doc.pipe(sink);

  const bottom = H - 52;
  const width = W - 2 * M;
  let y = M;
  const toc: { title: string; level: number }[] = [];
  const pages = new Map<string, number>();
  let pageNo = () => doc.bufferedPageRange().count;

  // every page after the cover carries a slim running header
  const runningHeader = () => {
    doc.fillColor(COLORS.grey).font('Helvetica').fontSize(8)
      .text(school.name, M, 28, { width: width / 2, lineBreak: false })
      .text(`${manual.roleLabel} manual`, M + width / 2, 28, { width: width / 2, align: 'right', lineBreak: false });
    doc.lineWidth(0.6).strokeColor(COLORS.gold).moveTo(M, 42).lineTo(W - M, 42).stroke();
  };
  const newPage = () => { doc.addPage(); runningHeader(); y = 56; };
  const ensure = (h: number) => { if (y + h > bottom) newPage(); };

  const heading = (text: string, level: 1 | 2, key: string) => {
    ensure(level === 1 ? 70 : 50);
    void key; pages.set(text, pageNo()); // contents page numbers are keyed by the heading's own words
    toc.push({ title: text, level });
    try { (doc as any).outline.addItem(text); } catch { /* bookmarks are a bonus */ }
    if (level === 1) {
      doc.save().rect(M, y, width, 30).fill(COLORS.green).restore();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text(text, M + 12, y + 8, { width: width - 24, lineBreak: false });
      doc.lineWidth(2).strokeColor(COLORS.gold).moveTo(M, y + 32).lineTo(W - M, y + 32).stroke();
      y += 46;
    } else {
      doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(13).text(text, M, y, { width, lineBreak: false });
      doc.lineWidth(0.8).strokeColor(COLORS.gold).moveTo(M, y + 17).lineTo(W - M, y + 17).stroke();
      y += 26;
    }
  };

  const para = (text: string, o: { size?: number; color?: string; bold?: boolean; gap?: number } = {}) => {
    doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size ?? 10);
    const h = doc.heightOfString(text, { width });
    ensure(h + 4);
    doc.fillColor(o.color ?? COLORS.ink).text(text, M, y, { width });
    y += h + (o.gap ?? 7);
  };

  const box = (label: string, text: string, tone: 'tip' | 'warn') => {
    doc.font('Helvetica').fontSize(9.2);
    const h = doc.heightOfString(text, { width: width - 76 });
    const bh = Math.max(28, h + 14);
    ensure(bh + 6);
    const col = tone === 'tip' ? COLORS.green : COLORS.red;
    doc.save().rect(M, y, width, bh).fill(tone === 'tip' ? COLORS.greenSoft : '#fbe9e7').restore();
    doc.save().rect(M, y, 4, bh).fill(col).restore();
    doc.fillColor(col).font('Helvetica-Bold').fontSize(8.5).text(label, M + 12, y + 8, { width: 56, lineBreak: false });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.2).text(text, M + 68, y + 7, { width: width - 76 });
    y += bh + 7;
  };

  const numberDot = (n: number | string, x: number, yy: number, r = 8.5, fill = COLORS.gold) => {
    doc.save().circle(x, yy, r).fill(fill).restore();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(r > 8 ? 9 : 8).text(String(n), x - r, yy - 4.6, { width: 2 * r, align: 'center', lineBreak: false });
  };

  const chip = (label: string, kind: Kind, x: number, yy: number, w: number): number => {
    const c = CHIP[kind];
    doc.font(kind === 'field' ? 'Helvetica-Oblique' : 'Helvetica-Bold').fontSize(8.6);
    const th = doc.heightOfString(label, { width: w - 12 });
    const h = Math.max(20, th + 10);
    doc.save().roundedRect(x, yy, w, h, c.radius).lineWidth(1).fillAndStroke(c.fill, c.stroke).restore();
    doc.fillColor(c.text).text(label, x + 6, yy + (h - th) / 2, { width: w - 12, align: 'center' });
    return h;
  };

  // The screenshot with its numbered markers is drawn into the picture by the capture robot.
  const pictureSize = (file: string) => {
    const full = path.join(SHOT_DIR, file + '.jpg');
    let w = width, h = w * 0.627;
    if (fs.existsSync(full)) { const d = jpegSize(full); if (d) h = (w * d.h) / d.w; }
    if (h > 560) { w = (w * 560) / h; h = 560; } // very tall pictures are shrunk to fit a page
    return { full, w, h };
  };
  const picture = (file: string) => {
    const { full, w, h } = pictureSize(file);
    ensure(h + 10);
    const px = M + (width - w) / 2;
    if (fs.existsSync(full)) {
      doc.image(full, px, y, { width: w });
      doc.lineWidth(0.8).strokeColor('#8a8f94').rect(px, y, w, h).stroke();
    } else {
      doc.save().rect(M, y, w, h).dash(3, { space: 3 }).stroke(COLORS.line).restore();
      doc.fillColor(COLORS.grey).font('Helvetica-Oblique').fontSize(9).text('(picture of this page)', M, y + h / 2 - 5, { width: w, align: 'center', lineBreak: false });
    }
    y += h + 10;
  };

  const calloutTable = (list: Callout[]) => {
    if (!list.length) return;
    ensure(40);
    doc.save().rect(M, y, width, 17).fill(COLORS.greenDark).restore();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.6)
      .text('No.', M + 6, y + 5, { lineBreak: false }).text('What you see / press', M + 36, y + 5, { lineBreak: false }).text('What it does', M + 205, y + 5, { lineBreak: false });
    y += 17;
    list.forEach((c, i) => {
      doc.font('Helvetica').fontSize(9.2);
      const dh = doc.heightOfString(c.does, { width: width - 215 });
      doc.font('Helvetica-Bold').fontSize(8.6);
      const ch = Math.max(20, doc.heightOfString(c.press, { width: 148 }) + 10);
      const rh = Math.max(dh + 10, ch + 8);
      ensure(rh);
      if (i % 2 === 0) doc.save().rect(M, y, width, rh).fill(COLORS.cream).restore();
      numberDot(i + 1, M + 14, y + rh / 2);
      chip(c.press, c.kind ?? 'default', M + 34, y + (rh - ch) / 2, 150);
      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.2).text(c.does, M + 205, y + 5, { width: width - 215 });
      y += rh;
    });
    doc.lineWidth(0.6).strokeColor(COLORS.line).moveTo(M, y).lineTo(W - M, y).stroke();
    y += 10;
  };

  const taskBox = (t: Task) => {
    doc.font('Helvetica').fontSize(9.4);
    const heights = t.steps.map((s) => Math.max(15, doc.heightOfString(s, { width: width - 46 }) + 4));
    const total = 24 + heights.reduce((a, c) => a + c, 0) + 8;
    ensure(Math.min(total, 220));
    doc.save().roundedRect(M, y, width, 20, 3).fill(COLORS.goldSoft).restore();
    doc.fillColor(COLORS.greenDark).font('Helvetica-Bold').fontSize(9.6).text(`How to: ${t.title}`, M + 10, y + 5.5, { width: width - 20, lineBreak: false });
    y += 24;
    t.steps.forEach((s, i) => {
      if (y + heights[i] > bottom) newPage();
      numberDot(i + 1, M + 14, y + 7, 7.5, COLORS.green);
      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.4).text(s, M + 32, y + 1.5, { width: width - 46 });
      y += heights[i];
    });
    y += 10;
  };

  const page = (p: ManualPage, key: string, imageName: string) => {
    // Keep the heading, the introduction and the picture together: if the picture will not fit on what is left of
    // this page, the whole section starts on a fresh page instead of leaving its heading alone at the bottom.
    if (!p.noImage) {
      doc.font('Helvetica').fontSize(10);
      ensure(26 + doc.heightOfString(p.intro, { width }) + 11 + pictureSize(imageName).h + 10);
    }
    heading(p.title, 2, key);
    para(p.intro);
    if (!p.noImage) picture(imageName);
    calloutTable(p.callouts);
    (p.tasks || []).forEach(taskBox);
    (p.warnings || []).forEach((w) => box('CAREFUL', w, 'warn'));
    (p.tips || []).forEach((t) => box('TIP', t, 'tip'));
    y += 6;
  };

  // ── Cover ──────────────────────────────────────────────────────────────────
  try { doc.image(b.logo, (W - 170) / 2, 90, { width: 170 }); } catch { /* ignore */ }
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(23).text(school.full_name, M, 285, { width, align: 'center' });
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(10).text([school.district, school.province, school.country].filter(Boolean).join('  ·  '), M, doc.y + 2, { width, align: 'center' });
  doc.save().rect(M + 40, 345, width - 80, 3).fill(COLORS.gold).restore();
  doc.fillColor(COLORS.greenDark).font('Helvetica-Bold').fontSize(40).text('USER MANUAL', M, 375, { width, align: 'center' });
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(19).text(`The ${manual.roleLabel} account`, M, 430, { width, align: 'center' });
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(11).text(manual.who, M + 30, 468, { width: width - 60, align: 'center' });
  doc.save().roundedRect(M + 60, 560, width - 120, 74, 6).lineWidth(1).fillAndStroke(COLORS.cream, COLORS.line).restore();
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(8.5).text('PREPARED FOR', M + 60, 572, { width: width - 120, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(14).text(who.name, M + 60, 586, { width: width - 120, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(9).text(`Edition ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, M + 60, 610, { width: width - 120, align: 'center', lineBreak: false });
  if (school.motto) doc.fillColor(COLORS.gold).font('Helvetica-Oblique').fontSize(12).text(`“${school.motto}”`, M, 690, { width, align: 'center', lineBreak: false });
  doc.fillColor(COLORS.grey).font('Helvetica').fontSize(8.5).text('Keep this manual safe and never write your password in it.', M, 735, { width, align: 'center', lineBreak: false });

  // ── Contents (page numbers are filled in on the second pass) ───────────────
  newPage();
  const tocPage = pageNo();
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(20).text('Contents', M, y, { width });
  y += 34;

  // ── How to read this manual ────────────────────────────────────────────────
  const readY = y;
  y = bottom; // push the body onto fresh pages; the contents list is written back into this page below

  newPage();
  heading('How to use this manual', 1, 'ch0');
  para('This manual is for the person who uses the ' + manual.roleLabel + ' account. It has pictures of the real pages, each with numbered markers, and a table that says what each marker is and what it does.');
  para('Look at the picture, find the number, then read the row with the same number. Under each picture you will find short step-by-step instructions for the jobs you do most.');
  heading('What the symbols mean', 2, 'sym');
  calloutTable([
    { target: '', press: 'Green button', does: 'A main action. Pressing it does the job (save, record, print).', kind: 'primary' },
    { target: '', press: 'White button', does: 'A secondary action: open something, filter, close.', kind: 'default' },
    { target: '', press: 'Red outlined button', does: 'Something that cannot easily be undone: delete, cancel, reverse. The portal always asks you to confirm.', kind: 'danger' },
    { target: '', press: 'A box to type in', does: 'Click inside it and type, or choose from the list.', kind: 'field' },
    { target: '', press: 'Underlined words', does: 'A link. Click it to go to another page.', kind: 'link' },
  ]);
  box('TIP', 'Every page has a gold "Download Manual" button at the top right. Press it any time to get a fresh copy of this manual as a PDF.', 'tip');

  // ── Chapter 1: getting started ─────────────────────────────────────────────
  heading('1. Getting started', 1, 'ch1');
  const common = commonPages(manual.role);
  common.forEach((p) => {
    if (p.id === 'details') {
      heading(p.title, 2, 'p-' + p.id);
      para(p.intro);
      const rows: [string, string][] = [
        ['Your name', who.name], ['Your account type', manual.roleLabel], ['Log in with this email', who.email],
        ...(who.student_number ? [['Your registration number', who.student_number] as [string, string]] : []),
        ...(who.class_name ? [['Your class', who.class_name] as [string, string]] : []),
        ['Portal address', portalUrl],
        ['Your password', 'Not printed here, on purpose. You chose it yourself (or you chose your own after the administrator gave you a temporary one). If you cannot remember it, see "Forgot your password?" below.'],
      ];
      rows.forEach(([k, v], i) => {
        doc.font('Helvetica').fontSize(9.6);
        const h = Math.max(20, doc.heightOfString(v, { width: width - 190 }) + 9);
        ensure(h);
        if (i % 2 === 0) doc.save().rect(M, y, width, h).fill(COLORS.cream).restore();
        doc.fillColor(COLORS.grey).font('Helvetica-Bold').fontSize(8.8).text(k.toUpperCase(), M + 8, y + 6, { width: 165, lineBreak: false });
        doc.fillColor(COLORS.ink).font(i === 2 || i === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.6).text(v, M + 180, y + 5, { width: width - 190 });
        y += h;
      });
      y += 10;
      (p.warnings || []).forEach((w) => box('CAREFUL', w, 'warn'));
      (p.tips || []).forEach((t) => box('TIP', t, 'tip'));
    } else {
      page(p, 'p-' + p.id, p.id === 'layout' ? `${manual.role}-layout` : p.image || `common-${p.id}`);
    }
  });

  // ── Chapter 2: the account's own pages ─────────────────────────────────────
  heading(`2. Using the ${manual.roleLabel} pages`, 1, 'ch2');
  para(ROLE_INTRO[manual.role]);
  manual.pages.forEach((p) => page(p, 'p-' + manual.role + '-' + p.id, p.image || `${manual.role}-${p.id}`));

  // ── Chapter 3: quick reference, help ───────────────────────────────────────
  heading('3. Everyday jobs at a glance', 1, 'ch3');
  doc.save().rect(M, y, width, 17).fill(COLORS.greenDark).restore();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.6).text('The job', M + 6, y + 5, { lineBreak: false }).text('Where', M + 185, y + 5, { lineBreak: false }).text('How', M + 300, y + 5, { lineBreak: false });
  y += 17;
  manual.quick.forEach((q, i) => {
    doc.font('Helvetica').fontSize(9);
    const h = Math.max(doc.heightOfString(q.job, { width: 170 }), doc.heightOfString(q.where, { width: 105 }), doc.heightOfString(q.how, { width: width - 305 })) + 9;
    ensure(h);
    if (i % 2 === 0) doc.save().rect(M, y, width, h).fill(COLORS.cream).restore();
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').text(q.job, M + 6, y + 4.5, { width: 170 });
    doc.font('Helvetica').text(q.where, M + 185, y + 4.5, { width: 105 }).text(q.how, M + 300, y + 4.5, { width: width - 305 });
    y += h;
  });
  y += 12;

  heading('4. If something goes wrong', 1, 'ch4');
  manual.faqs.forEach((f) => {
    doc.font('Helvetica-Bold').fontSize(9.8);
    const hq = doc.heightOfString(f.q, { width });
    doc.font('Helvetica').fontSize(9.6);
    const ha = doc.heightOfString(f.a, { width: width - 14 });
    ensure(hq + ha + 14);
    doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(9.8).text(f.q, M, y, { width });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.6).text(f.a, M + 14, y + hq + 2, { width: width - 14 });
    y += hq + ha + 12;
  });

  heading('5. Keeping your account safe', 1, 'ch5');
  [
    'Never tell anyone your password, not even a friend, a teacher or the office. The school will never ask you for it.',
    'Choose a password of at least 8 characters that mixes letters and numbers, and that you do not use anywhere else.',
    'If you think someone knows your password, change it straight away (Password button at the top right). Every other device you were logged in on is logged out at once.',
    'Always press "Log out" when you finish on a shared or school computer.',
    'Do not leave the portal open on a screen others can see, and do not print your login details.',
  ].forEach((t) => para('•  ' + t, { gap: 4 }));
  y += 4;

  if (manual.glossary.length) {
    heading('6. Words used in this portal', 1, 'ch6');
    manual.glossary.forEach((g, i) => {
      doc.font('Helvetica').fontSize(9.4);
      const h = doc.heightOfString(g.meaning, { width: width - 150 }) + 8;
      ensure(h);
      if (i % 2 === 0) doc.save().rect(M, y, width, h).fill(COLORS.cream).restore();
      doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(9.4).text(g.term, M + 8, y + 4, { width: 130 });
      doc.fillColor(COLORS.ink).font('Helvetica').text(g.meaning, M + 145, y + 4, { width: width - 150 });
      y += h;
    });
    y += 12;
  }

  ensure(80);
  doc.save().roundedRect(M, y, width, 58, 5).lineWidth(1).fillAndStroke(COLORS.cream, COLORS.line).restore();
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(10.5).text('Need help?', M + 14, y + 9, { lineBreak: false });
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.4).text(
    [`Speak to the school office${school.phone ? ` or call ${school.phone}` : ''}${school.email ? `, or write to ${school.email}` : ''}.`, 'Tell them what you were trying to do and what you saw on the screen.'].join(' '),
    M + 14, y + 24, { width: width - 28 });
  y += 70;

  // ── Back to the contents page: write the list now that every heading has a page number ──
  const range = doc.bufferedPageRange();
  doc.switchToPage(range.start + tocPage - 1);
  const keep = doc.page.margins.bottom; doc.page.margins.bottom = 0;
  let ty = readY;
  for (const entry of toc) {
    const pg = tocPages.get(entry.title) ?? 0;
    if (ty > H - 70) break;
    doc.fillColor(entry.level === 1 ? COLORS.greenDark : COLORS.ink).font(entry.level === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(entry.level === 1 ? 10.5 : 9.4);
    const x = M + (entry.level === 1 ? 0 : 16);
    const label = entry.title;
    doc.text(label, x, ty, { width: width - x + M - 40, lineBreak: false, ellipsis: true });
    const lw = doc.widthOfString(label);
    doc.fillColor(COLORS.line).font('Helvetica').fontSize(9).text('. '.repeat(Math.max(0, Math.floor((width - 40 - lw - (x - M)) / 5))), x + lw + 4, ty, { width: width - lw - 50, lineBreak: false });
    doc.fillColor(entry.level === 1 ? COLORS.greenDark : COLORS.ink).font('Helvetica-Bold').fontSize(9.6).text(String(pg), W - M - 30, ty, { width: 30, align: 'right', lineBreak: false });
    ty += entry.level === 1 ? 19 : 14.5;
  }
  doc.page.margins.bottom = keep;

  finish(b, who.name);
  return new Promise((resolve) => sink.on('end', () => resolve({ buf: Buffer.concat(chunks), toc, pages })));
}

// Two passes: the first learns which page every heading lands on, the second prints those numbers in the contents.
export async function buildManual(manual: RoleManual, school: SchoolInfo, who: Who, portalUrl: string): Promise<Buffer> {
  const first = await render(manual, school, who, portalUrl, new Map());
  return (await render(manual, school, who, portalUrl, first.pages)).buf;
}
