import { ReactNode, useEffect, useState } from 'react';
import { termsApi } from '../services/api';
import { addDays, fmtRange, iso, todayIso } from '../utils/dates';

// One consistent way to pick "the period I want to look at" on every bursary page.
export interface Period { preset: string; from: string; to: string }

export const PRESETS = [
  { id: 'today', label: 'Today' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' },
  { id: 'term', label: 'This term' }, { id: 'lastterm', label: 'Last term' }, { id: 'year', label: 'This year' },
  { id: 'last30', label: 'Last 30 days' }, { id: 'all', label: 'All time' },
];

function compute(preset: string, terms: any[]): { from: string; to: string } {
  const now = new Date();
  const today = todayIso();
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'week': { const mondayOffset = (now.getDay() + 6) % 7; const from = addDays(today, -mondayOffset); return { from, to: addDays(from, 6) }; }
    case 'month': return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    case 'last30': return { from: addDays(today, -29), to: today };
    case 'all': return { from: '2000-01-01', to: today };
    case 'term':
    case 'lastterm': {
      const sorted = [...terms].filter((t) => t.start_date && t.end_date).sort((a, b) => (a.year + a.term_no).localeCompare(b.year + b.term_no));
      const currentIdx = sorted.findIndex((t) => t.is_current);
      const t = preset === 'term' ? sorted[currentIdx] : sorted[currentIdx - 1];
      if (t) return { from: t.start_date, to: t.end_date };
      return compute('year', terms); // no term dates set yet: fall back to the calendar year
    }
    default: return { from: today, to: today };
  }
}

export function usePeriod(initial = 'term') {
  const [terms, setTerms] = useState<any[]>([]);
  const [period, setPeriodState] = useState<Period>(() => ({ preset: initial, ...compute(initial, []) }));

  useEffect(() => {
    termsApi.list().then((r) => {
      setTerms(r.data);
      setPeriodState((p) => (p.preset === 'custom' ? p : { preset: p.preset, ...compute(p.preset, r.data) }));
    }).catch(() => {});
  }, []);

  const setPreset = (id: string) => setPeriodState({ preset: id, ...compute(id, terms) });
  const setCustom = (from: string, to: string) => setPeriodState({ preset: 'custom', from, to: to < from ? from : to });
  return { period, setPreset, setCustom, terms };
}

export default function PeriodBar({ state, children, label = 'Showing' }: { state: ReturnType<typeof usePeriod>; children?: ReactNode; label?: string }) {
  const { period, setPreset, setCustom } = state;
  return (
    <div className="period-bar no-print">
      <div>
        <label>Period</label>
        <div className="toolbar" style={{ gap: '0.3rem' }}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={`chip${period.preset === p.id ? ' active' : ''}`} onClick={() => setPreset(p.id)}>{p.label}</button>
          ))}
        </div>
      </div>
      <div><label>From</label><input type="date" value={period.from} onChange={(e) => e.target.value && setCustom(e.target.value, period.to)} /></div>
      <div><label>To</label><input type="date" value={period.to} onChange={(e) => e.target.value && setCustom(period.from, e.target.value)} /></div>
      {children}
      <div className="period-label">{label}<br /><strong style={{ color: 'var(--text)' }}>{fmtRange(period.from, period.to)}</strong></div>
    </div>
  );
}
