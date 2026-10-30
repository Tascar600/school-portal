// Dates are kept as plain YYYY-MM-DD text everywhere, so there are no time-zone surprises.
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayIso = () => iso(new Date());
export const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };

// "15 Sep 2026"
export function fmtDate(s?: string | null): string {
  if (!s) return '-';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtRange(from: string, to: string): string {
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
}
export function fmtDateTime(s?: string | null): string {
  if (!s) return '-';
  const d = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.length <= 10 ? '' : 'Z'));
  return isNaN(d.getTime()) ? s : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
