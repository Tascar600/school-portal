import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statsApi, paymentsApi, openPdf } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDate, fmtRange } from '../../utils/dates';
import { useAuth } from '../../contexts/AuthContext';
import PeriodBar, { usePeriod } from '../../components/PeriodBar';
import PrintHeader from '../../components/PrintHeader';
import FinanceTabs from '../../components/FinanceTabs';
import { PrintButton } from '../../components/PrintDownload';
import { TrendChart, Donut, ClassBars } from '../../components/Charts';

const METHOD: Record<string, string> = { cash: 'Cash', bank: 'Bank', ecocash: 'EcoCash', swipe: 'Card / swipe', in_kind: 'In kind' };

function change(cur: number, prev: number) {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct, up: pct >= 0 };
}

function Kpi({ label, value, tone, sub, delta }: { label: string; value: string; tone?: string; sub?: string; delta?: { pct: number; up: boolean } | null }) {
  return (
    <div className={`kpi ${tone || ''}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {(delta || sub) && <div className="kpi-delta">{delta && <span className={delta.up ? 'up' : 'down'}>{delta.up ? '▲' : '▼'} {Math.abs(delta.pct)}% </span>}{delta ? 'vs previous period' : sub}</div>}
    </div>
  );
}

export default function FinanceOverview() {
  const { user } = useAuth();
  const state = usePeriod('term');
  const { period } = state;
  const [ov, setOv] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [bd, setBd] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    const p = { from: period.from, to: period.to };
    Promise.all([statsApi.overview(p), statsApi.trend(p), statsApi.breakdown(p), paymentsApi.list({ ...p, status: 'active' })])
      .then(([o, t, b, pay]) => { setOv(o.data); setTrend(t.data); setBd(b.data); setRecent(pay.data.slice(0, 8)); })
      .catch((e) => setError(e.response?.data?.message || 'Could not load the figures'));
  }, [period.from, period.to]);

  const canEdit = user?.role === 'bursary';
  const classTotals = bd ? bd.by_class.reduce((a: any, c: any) => ({ billed: a.billed + c.billed, collected: a.collected + c.collected, owing: a.owing + c.owing_now, debtors: a.debtors + c.debtors }), { billed: 0, collected: 0, owing: 0, debtors: 0 }) : null;

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title="Bursary overview" period={fmtRange(period.from, period.to)} />
      <div className="page-head">
        <div><h1>Bursary overview</h1><p>Fees billed, collected and owing, with money spent, for the period you choose.</p></div>
        <div className="toolbar no-print">
          {canEdit && <Link className="btn btn-primary" to="/finance/payments">Receive fees</Link>}
          <Link className="btn" to="/finance/reports">Reports</Link>
          <PrintButton />
        </div>
      </div>
      <PeriodBar state={state} />
      {error && <div className="alert alert-error">{error}</div>}
      {!ov || !trend || !bd ? <div className="loading">Loading the figures…</div> : (
        <>
          <div className="grid">
            <Kpi label="Fees billed" value={money(ov.billed)} tone="info" delta={change(ov.billed, ov.previous.billed)} sub={`${ov.billed_count} invoice${ov.billed_count === 1 ? '' : 's'}`} />
            <Kpi label="Fees collected" value={money(ov.collected)} tone="good" delta={change(ov.collected, ov.previous.collected)} sub={`${ov.payments_count} payment${ov.payments_count === 1 ? '' : 's'}`} />
            <Kpi label="Collection rate" value={ov.collection_rate === null ? '–' : `${ov.collection_rate}%`} tone={ov.collection_rate !== null && ov.collection_rate < 60 ? 'bad' : 'good'} sub="collected ÷ billed in this period" />
            <Kpi label="Money spent" value={money(ov.expenses)} tone="warn" delta={change(ov.expenses, ov.previous.expenses)} sub={`${ov.expenses_count} voucher${ov.expenses_count === 1 ? '' : 's'}`} />
            <Kpi label="Net (collected − spent)" value={money(ov.net)} tone={ov.net >= 0 ? 'good' : 'bad'} sub="cash position for the period" />
            <Kpi label="Owing right now" value={money(ov.outstanding)} tone="bad" sub={`${ov.debtors_count} of ${ov.pupils_count} pupils owe fees`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.1rem' }}>
            <div className="card">
              <h2>Money in and out {'–'} {trend.group === 'day' ? 'day by day' : 'month by month'}</h2>
              <TrendChart points={trend.points} group={trend.group} />
            </div>
            <div className="card">
              <h2>How fees were paid</h2>
              <Donut data={bd.by_method.map((m: any) => ({ name: METHOD[m.method] || m.method, value: m.total }))} />
              {bd.by_currency.some((c: any) => c.currency !== 'USD') && (
                <p className="small muted">Paid in other currencies: {bd.by_currency.filter((c: any) => c.currency !== 'USD').map((c: any) => `${c.currency} ${c.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} (= ${money(c.usd)})`).join(', ')}</p>
              )}
            </div>
          </div>

          <div className="card table-wrap">
            <h2>Each class</h2>
            <ClassBars rows={bd.by_class} />
            <table style={{ marginTop: '0.75rem' }}>
              <thead><tr><th>Class</th><th className="num">Pupils</th><th className="num">Billed</th><th className="num">Collected</th><th style={{ minWidth: 150 }}>Collection rate</th><th className="num">Owing now</th><th className="num">Pupils owing</th></tr></thead>
              <tbody>
                {bd.by_class.map((c: any) => (
                  <tr key={c.class_id}>
                    <td style={{ fontWeight: 600 }}>{c.class_name}</td><td className="num">{c.pupils}</td><td className="num">{money(c.billed)}</td><td className="num">{money(c.collected)}</td>
                    <td>{c.rate === null ? <span className="muted">no bills</span> : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="bar" style={{ flex: 1 }}><span style={{ width: `${Math.min(100, c.rate)}%` }} /></div><span className="small">{c.rate}%</span></div>}</td>
                    <td className="num" style={{ color: c.owing_now > 0 ? 'var(--danger)' : undefined, fontWeight: 600 }}>{money(c.owing_now)}</td><td className="num">{c.debtors}</td>
                  </tr>
                ))}
              </tbody>
              {classTotals && <tfoot><tr><td>Whole school</td><td className="num">{ov.pupils_count}</td><td className="num">{money(classTotals.billed)}</td><td className="num">{money(classTotals.collected)}</td><td>{classTotals.billed > 0 ? `${Math.round((classTotals.collected / classTotals.billed) * 1000) / 10}%` : '–'}</td><td className="num">{money(classTotals.owing)}</td><td className="num">{classTotals.debtors}</td></tr></tfoot>}
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.1rem' }}>
            <div className="card table-wrap">
              <h2>Pupils who owe the most</h2>
              <table>
                <thead><tr><th>Pupil</th><th>Class</th><th>Last payment</th><th className="num">Owing</th></tr></thead>
                <tbody>
                  {bd.top_debtors.map((d: any) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}><Link to={`/finance/students?open=${d.id}`}>{d.name}</Link></td><td>{d.class_name}</td>
                      <td className="small">{d.last_payment ? fmtDate(d.last_payment) : <span style={{ color: 'var(--danger)' }}>never paid</span>}</td>
                      <td className="num" style={{ color: 'var(--danger)', fontWeight: 700 }}>{money(d.balance)}</td>
                    </tr>
                  ))}
                  {bd.top_debtors.length === 0 && <tr><td colSpan={4} className="muted">Nobody owes anything.</td></tr>}
                </tbody>
              </table>
              <p className="small muted" style={{ marginTop: '0.5rem' }}>Debt sizes: {bd.debt_bands.map((b: any) => `${b.label}: ${b.count}`).join(' · ')}</p>
            </div>
            <div className="card table-wrap">
              <h2>Where the money was spent</h2>
              <table>
                <thead><tr><th>Category</th><th className="num">Vouchers</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {bd.by_category.map((c: any) => <tr key={c.name}><td>{c.name}</td><td className="num">{c.count}</td><td className="num">{money(c.total)}</td></tr>)}
                  {bd.by_category.length === 0 && <tr><td colSpan={3} className="muted">No expenses in this period.</td></tr>}
                </tbody>
                {bd.by_category.length > 0 && <tfoot><tr><td>Total</td><td /><td className="num">{money(ov.expenses)}</td></tr></tfoot>}
              </table>
              <h2 style={{ marginTop: '1rem' }}>Billed by fee item</h2>
              <table>
                <tbody>{bd.by_fee_item.map((f: any) => <tr key={f.name}><td>{f.name}</td><td className="num">{money(f.billed)}</td></tr>)}{bd.by_fee_item.length === 0 && <tr><td className="muted">Nothing billed in this period.</td></tr>}</tbody>
              </table>
            </div>
          </div>

          <div className="card table-wrap">
            <h2>Latest payments in this period</h2>
            <table>
              <thead><tr><th>Date</th><th>Receipt</th><th>Pupil</th><th>Method</th><th className="num">Paid</th><th className="num no-print" /></tr></thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.pay_date)}</td><td>{p.receipt_no}</td><td style={{ fontWeight: 600 }}>{p.student_name}<div className="muted small">{p.class_name}</div></td><td>{METHOD[p.method] || p.method}</td>
                    <td className="num">{money(p.amount_paid, p.currency)}{p.currency !== 'USD' && <div className="muted small">= {money(p.amount)}</div>}</td>
                    <td className="no-print"><button className="btn btn-sm" onClick={() => openPdf(`/payments/${p.id}/receipt.pdf`)}>Receipt</button></td>
                  </tr>
                ))}
                {recent.length === 0 && <tr><td colSpan={6} className="muted">No payments were received in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
