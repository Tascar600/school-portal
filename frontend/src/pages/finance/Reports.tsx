import { useEffect, useState } from 'react';
import { reportApi, financeStudentsApi } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDate, fmtRange } from '../../utils/dates';
import { downloadBlob } from '../../utils/downloadBlob';
import PeriodBar, { usePeriod } from '../../components/PeriodBar';
import PrintHeader from '../../components/PrintHeader';
import FinanceTabs from '../../components/FinanceTabs';
import { PrintButton } from '../../components/PrintDownload';
import { ClassBars, Donut } from '../../components/Charts';

type Key = 'summary' | 'collections' | 'fee-items' | 'debtors' | 'aged' | 'daily' | 'methods' | 'class-list';
const REPORTS: { key: Key; label: string; help: string; period: boolean }[] = [
  { key: 'summary', label: 'Summary', help: 'Money in, money out and what is left, plus collections by class.', period: true },
  { key: 'collections', label: 'Collections by class', help: 'What each class was billed and has paid, and what it still owes.', period: true },
  { key: 'fee-items', label: 'By fee item', help: 'How much was billed for tuition, levy and every other fee item.', period: true },
  { key: 'debtors', label: 'Debtors', help: 'Every pupil who owes fees right now, largest debt first.', period: false },
  { key: 'aged', label: 'Aged arrears', help: 'How old each debt is, as at the end date you chose.', period: false },
  { key: 'daily', label: 'Daily cash-up', help: 'Every receipt in the period, with totals by payment method.', period: true },
  { key: 'methods', label: 'Payment methods', help: 'How parents pay: cash, bank, EcoCash, card.', period: true },
  { key: 'class-list', label: 'Class list', help: 'One class with each pupil’s balance.', period: false },
];
const METHOD: Record<string, string> = { cash: 'Cash', bank: 'Bank', ecocash: 'EcoCash', swipe: 'Card / swipe', in_kind: 'In kind' };

export default function Reports() {
  const state = usePeriod('term');
  const { period } = state;
  const [active, setActive] = useState<Key>('summary');
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [minOwing, setMinOwing] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const meta = REPORTS.find((r) => r.key === active)!;

  useEffect(() => { financeStudentsApi.classes().then((r) => { setClasses(r.data); if (r.data.length) setClassId(String(r.data[0].id)); }); }, []);

  const params = () => {
    const p: any = { from: period.from, to: period.to };
    if (active === 'debtors') { if (classId) p.class_id = classId; if (minOwing) p.min = minOwing; }
    if (active === 'class-list') p.class_id = classId;
    if (active === 'aged') p.asOf = period.to;
    return p;
  };
  const load = async () => {
    if (active === 'class-list' && !classId) return;
    setLoading(true); setData(null);
    try {
      if (active === 'summary') {
        const [ie, col, me] = await Promise.all([reportApi.get('income-expenditure', params()), reportApi.get('collections', params()), reportApi.get('methods', params())]);
        setData({ ie: ie.data, col: col.data, me: me.data });
      } else setData((await reportApi.get(active, params())).data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [active, period.from, period.to, classId, minOwing]);

  const excel = async () => {
    const name = active === 'summary' ? 'income-expenditure' : active;
    downloadBlob((await reportApi.xlsx(name, params())).data, `${name}-${period.from}-to-${period.to}.xlsx`);
  };
  const periodText = active === 'aged' ? `as at ${fmtDate(period.to)}` : meta.period ? fmtRange(period.from, period.to) : `as at ${fmtDate(new Date().toISOString().slice(0, 10))}`;
  const clsName = classes.find((c) => String(c.id) === classId)?.name;

  const colTotals = (rows: any[]) => rows.reduce((a, r) => ({ billed: a.billed + r.billed, collected: a.collected + r.collected, owing: a.owing + r.owing_now }), { billed: 0, collected: 0, owing: 0 });

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title={meta.label} period={periodText} extra={active === 'class-list' || (active === 'debtors' && classId) ? clsName : undefined} />
      <div className="page-head no-print">
        <div><h1>Reports and statistics</h1><p>{meta.help}</p></div>
        <div className="toolbar"><PrintButton /><button className="btn btn-success" onClick={excel}>Excel</button></div>
      </div>
      <div className="tabs no-print">
        {REPORTS.map((r) => <button key={r.key} className={`tab${active === r.key ? ' active' : ''}`} onClick={() => setActive(r.key)}>{r.label}</button>)}
      </div>

      {meta.period || active === 'aged' ? <PeriodBar state={state} label={active === 'aged' ? 'As at' : 'Showing'} /> : null}
      {(active === 'debtors' || active === 'class-list') && (
        <div className="period-bar no-print">
          <div><label>Class</label><select value={classId} onChange={(e) => setClassId(e.target.value)}>{active === 'debtors' && <option value="">All classes</option>}{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          {active === 'debtors' && <div><label>Owing at least ($)</label><input type="number" min="0" value={minOwing} onChange={(e) => setMinOwing(e.target.value)} placeholder="any amount" /></div>}
        </div>
      )}

      {loading && <div className="loading">Loading…</div>}

      {data && active === 'summary' && (
        <>
          <div className="grid">
            <div className="kpi good"><div className="kpi-value">{money(data.ie.income)}</div><div className="kpi-label">Fees received</div></div>
            <div className="kpi warn"><div className="kpi-value">{money(data.ie.expenditure)}</div><div className="kpi-label">Money spent</div></div>
            <div className={`kpi ${data.ie.surplus >= 0 ? 'good' : 'bad'}`}><div className="kpi-value">{money(data.ie.surplus)}</div><div className="kpi-label">{data.ie.surplus >= 0 ? 'Surplus' : 'Deficit'}</div></div>
          </div>
          <div className="card table-wrap"><h2>Spending by category</h2>
            <table><thead><tr><th>Category</th><th className="num">Vouchers</th><th className="num">Amount</th><th className="num">% of spending</th></tr></thead>
              <tbody>{data.ie.byCategory.map((c: any) => <tr key={c.name}><td>{c.name}</td><td className="num">{c.count}</td><td className="num">{money(c.total)}</td><td className="num">{data.ie.expenditure ? Math.round((c.total / data.ie.expenditure) * 100) : 0}%</td></tr>)}{data.ie.byCategory.length === 0 && <tr><td colSpan={4} className="muted">No spending in this period.</td></tr>}</tbody>
              <tfoot><tr><td>Total</td><td /><td className="num">{money(data.ie.expenditure)}</td><td /></tr></tfoot></table></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.1rem' }}>
            <div className="card"><h2>Billed and collected by class</h2><ClassBars rows={data.col} /></div>
            <div className="card"><h2>How fees were paid</h2><Donut data={data.me.map((m: any) => ({ name: METHOD[m.method] || m.method, value: m.total }))} /></div>
          </div>
        </>
      )}

      {data && active === 'collections' && (
        <div className="card table-wrap"><ClassBars rows={data} />
          <table style={{ marginTop: '0.8rem' }}><thead><tr><th>Class</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">Rate</th><th className="num">Owing now</th><th className="num">Pupils owing</th></tr></thead>
            <tbody>{data.map((r: any) => <tr key={r.class_id}><td style={{ fontWeight: 600 }}>{r.class_name}</td><td className="num">{money(r.billed)}</td><td className="num">{money(r.collected)}</td><td className="num">{r.collection_rate === null ? '–' : `${r.collection_rate}%`}</td><td className="num" style={{ color: r.owing_now > 0 ? 'var(--danger)' : undefined }}>{money(r.owing_now)}</td><td className="num">{r.pupils_owing}</td></tr>)}</tbody>
            <tfoot><tr><td>Whole school</td><td className="num">{money(colTotals(data).billed)}</td><td className="num">{money(colTotals(data).collected)}</td><td className="num">{colTotals(data).billed ? `${Math.round((colTotals(data).collected / colTotals(data).billed) * 1000) / 10}%` : '–'}</td><td className="num">{money(colTotals(data).owing)}</td><td className="num">{data.reduce((s: number, r: any) => s + r.pupils_owing, 0)}</td></tr></tfoot></table></div>
      )}

      {data && active === 'fee-items' && (
        <div className="card table-wrap"><table><thead><tr><th>Fee item</th><th className="num">Billed</th><th className="num">Collected (estimated)</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.name}><td>{r.name}</td><td className="num">{money(r.billed)}</td><td className="num">{money(r.collected)}</td></tr>)}{data.length === 0 && <tr><td colSpan={3} className="muted">Nothing was billed in this period.</td></tr>}</tbody>
          <tfoot><tr><td>Total</td><td className="num">{money(data.reduce((s: number, r: any) => s + r.billed, 0))}</td><td className="num">{money(data.reduce((s: number, r: any) => s + r.collected, 0))}</td></tr></tfoot></table>
          <p className="small muted" style={{ marginTop: '0.5rem' }}>Payments are not tied to a fee item, so collected amounts are shared out in proportion to what was billed.</p></div>
      )}

      {data && active === 'debtors' && (
        <div className="card table-wrap"><table><thead><tr><th>#</th><th>Pupil</th><th>Reg. no.</th><th>Class</th><th className="num">Owing</th></tr></thead>
          <tbody>{data.map((r: any, i: number) => <tr key={r.student_id}><td>{i + 1}</td><td style={{ fontWeight: 600 }}>{r.student_name}</td><td className="muted small">{r.student_number}</td><td>{r.class_name || '-'}</td><td className="num" style={{ color: 'var(--danger)', fontWeight: 700 }}>{money(r.balance)}</td></tr>)}{data.length === 0 && <tr><td colSpan={5} className="muted">No pupils owe fees.</td></tr>}</tbody>
          {data.length > 0 && <tfoot><tr><td colSpan={4}>{data.length} pupils owe</td><td className="num">{money(data.reduce((s: number, r: any) => s + r.balance, 0))}</td></tr></tfoot>}</table></div>
      )}

      {data && active === 'aged' && (
        <div className="card table-wrap"><table><thead><tr><th>Pupil</th><th>Class</th><th className="num">0{'–'}30 days</th><th className="num">31{'–'}60</th><th className="num">61{'–'}90</th><th className="num">Over 90</th><th className="num">Total</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.student_id}><td style={{ fontWeight: 600 }}>{r.student_name}</td><td>{r.class_name || '-'}</td><td className="num">{money(r.bucket_0_30)}</td><td className="num">{money(r.bucket_31_60)}</td><td className="num">{money(r.bucket_61_90)}</td><td className="num" style={{ color: r.bucket_90_plus > 0 ? 'var(--danger)' : undefined }}>{money(r.bucket_90_plus)}</td><td className="num"><strong>{money(r.total)}</strong></td></tr>)}{data.length === 0 && <tr><td colSpan={7} className="muted">No outstanding arrears.</td></tr>}</tbody>
          {data.length > 0 && <tfoot><tr><td colSpan={2}>Total</td>{['bucket_0_30', 'bucket_31_60', 'bucket_61_90', 'bucket_90_plus', 'total'].map((k) => <td className="num" key={k}>{money(data.reduce((s: number, r: any) => s + r[k], 0))}</td>)}</tr></tfoot>}</table></div>
      )}

      {data && active === 'daily' && (
        <>
          <div className="grid">{data.byMethod.map((m: any) => <div className="kpi" key={m.method}><div className="kpi-value">{money(m.total)}</div><div className="kpi-label">{METHOD[m.method] || m.method} ({m.count})</div></div>)}<div className="kpi good"><div className="kpi-value">{money(data.grandTotal)}</div><div className="kpi-label">Total received</div></div></div>
          <div className="card table-wrap"><table><thead><tr><th>Date</th><th>Receipt</th><th>Pupil</th><th>Method</th><th>Reference</th><th className="num">Paid</th><th className="num">USD value</th></tr></thead>
            <tbody>{data.payments.map((p: any) => <tr key={p.id}><td className="nowrap">{fmtDate(p.pay_date)}</td><td>{p.receipt_no}</td><td style={{ fontWeight: 600 }}>{p.student_name}<div className="muted small">{p.class_name}</div></td><td>{METHOD[p.method] || p.method}</td><td className="muted small">{p.reference}{p.notes ? ` – ${p.notes}` : ''}</td><td className="num">{money(p.amount_paid, p.currency)}</td><td className="num">{money(p.amount)}</td></tr>)}{data.payments.length === 0 && <tr><td colSpan={7} className="muted">No receipts in this period.</td></tr>}</tbody>
            {data.payments.length > 0 && <tfoot><tr><td colSpan={6}>{data.payments.length} receipts</td><td className="num">{money(data.grandTotal)}</td></tr></tfoot>}</table></div>
        </>
      )}

      {data && active === 'methods' && (
        <div className="card table-wrap"><Donut data={data.map((m: any) => ({ name: METHOD[m.method] || m.method, value: m.total }))} />
          <table><thead><tr><th>Method</th><th className="num">Receipts</th><th className="num">Amount (USD value)</th></tr></thead>
            <tbody>{data.map((m: any) => <tr key={m.method}><td>{METHOD[m.method] || m.method}</td><td className="num">{m.count}</td><td className="num">{money(m.total)}</td></tr>)}</tbody>
            <tfoot><tr><td>Total</td><td className="num">{data.reduce((s: number, m: any) => s + m.count, 0)}</td><td className="num">{money(data.reduce((s: number, m: any) => s + m.total, 0))}</td></tr></tfoot></table></div>
      )}

      {data && active === 'class-list' && (
        <div className="card table-wrap"><h2>{clsName}</h2><table><thead><tr><th>#</th><th>Pupil</th><th>Reg. no.</th><th className="num">Balance</th></tr></thead>
          <tbody>{data.map((r: any, i: number) => <tr key={r.id}><td>{i + 1}</td><td style={{ fontWeight: 600 }}>{r.name}</td><td className="muted small">{r.student_number}</td><td className="num" style={{ color: r.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{r.balance > 0 ? money(r.balance) : r.balance < 0 ? `${money(-r.balance)} credit` : 'Paid up'}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3}>Total owing by this class</td><td className="num">{money(data.filter((r: any) => r.balance > 0).reduce((s: number, r: any) => s + r.balance, 0))}</td></tr></tfoot></table></div>
      )}
    </div>
  );
}
