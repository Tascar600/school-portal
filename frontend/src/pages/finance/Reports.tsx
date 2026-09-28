import { useEffect, useState } from 'react';
import { termsApi, reportsApi, adminApi } from '../../services/api';
import { money } from '../../utils/money';
import { downloadBlob } from '../../utils/downloadBlob';
import { Download } from 'lucide-react';

type ReportKey = 'daily' | 'collections' | 'fee-items' | 'debtors' | 'aged' | 'income-expenditure' | 'budget' | 'sponsors' | 'methods' | 'class-list';

const REPORT_LABELS: Record<ReportKey, string> = {
  daily: 'Daily Collections',
  collections: 'Collections by Class',
  'fee-items': 'Collections by Fee Item',
  debtors: 'Debtors',
  aged: 'Aged Arrears',
  'income-expenditure': 'Income & Expenditure',
  budget: 'Budget vs Actual',
  sponsors: 'Sponsor Claims',
  methods: 'Payment Methods',
  'class-list': 'Class List',
};

export default function Reports() {
  const [active, setActive] = useState<ReportKey>('debtors');
  const [terms, setTerms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    termsApi.list().then((r) => {
      setTerms(r.data);
      setTermId(r.data.find((t: any) => t.is_current)?.id || r.data[0]?.id || null);
    });
    adminApi.classes().then((r) => { setClasses(r.data); if (r.data.length) setClassId(r.data[0].id); });
  }, []);

  const load = () => {
    setLoading(true);
    setData(null);
    const p: Promise<any> = (() => {
      switch (active) {
        case 'daily': return reportsApi.daily(date);
        case 'collections': return reportsApi.collections(termId!);
        case 'fee-items': return reportsApi.feeItems(termId!);
        case 'debtors': return reportsApi.debtors();
        case 'aged': return reportsApi.aged(date);
        case 'income-expenditure': return reportsApi.incomeExpenditure(termId!);
        case 'budget': return reportsApi.budget(termId!);
        case 'sponsors': return reportsApi.sponsors(termId!);
        case 'methods': return reportsApi.methods(termId!);
        case 'class-list': return reportsApi.classList(classId!);
      }
    })();
    p.then((r) => setData(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { if (termId !== null || active === 'daily' || active === 'aged') load(); }, [active, termId, classId]);

  const needsTerm = !['daily', 'aged', 'debtors', 'class-list'].includes(active);
  const needsDate = active === 'daily' || active === 'aged';
  const needsClass = active === 'class-list';

  const exportParams = () => {
    if (active === 'daily') return { date };
    if (active === 'aged') return { asOf: date };
    if (active === 'class-list') return { class_id: classId };
    return { term_id: termId };
  };

  const doExport = async () => {
    const res = await reportsApi.exportXlsx(active, exportParams());
    downloadBlob(res.data, `${active}-report.xlsx`);
  };

  return (
    <div>
      <h1>Reports</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(Object.keys(REPORT_LABELS) as ReportKey[]).map((k) => (
            <button key={k} className={active === k ? 'btn btn-primary btn-sm' : 'btn btn-sm'} onClick={() => setActive(k)}>
              {REPORT_LABELS[k]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {needsTerm && (
            <div><label>Term</label>
              <select value={termId || ''} onChange={(e) => setTermId(Number(e.target.value))}>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.year} Term {t.term_no}</option>)}
              </select>
            </div>
          )}
          {needsDate && (
            <div><label>{active === 'aged' ? 'As of' : 'Date'}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {needsClass && (
            <div><label>Class</label>
              <select value={classId || ''} onChange={(e) => setClassId(Number(e.target.value))}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn" onClick={load}>Refresh</button>
          <button className="btn btn-success" onClick={doExport}><Download size={14} /> Export to Excel</button>
        </div>
      </div>

      <div className="card">
        <h2>{REPORT_LABELS[active]}</h2>
        {loading && <p style={{ color: 'var(--text-dim)' }}>Loading…</p>}
        {!loading && data && <ReportTable reportKey={active} data={data} />}
      </div>
    </div>
  );
}

function ReportTable({ reportKey, data }: { reportKey: ReportKey; data: any }) {
  switch (reportKey) {
    case 'daily':
      return (
        <>
          <p>Grand total: <strong>{money(data.grandTotal)}</strong></p>
          <table>
            <thead><tr><th>Method</th><th>Count</th><th>Total</th></tr></thead>
            <tbody>{data.byMethod.map((m: any) => <tr key={m.method}><td>{m.method}</td><td>{m.count}</td><td>{money(m.total)}</td></tr>)}</tbody>
          </table>
        </>
      );
    case 'collections':
      return (
        <table>
          <thead><tr><th>Class</th><th>Billed</th><th>Collected</th><th>Outstanding</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.class_id}><td>{r.class_name}</td><td>{money(r.billed)}</td><td>{money(r.collected)}</td><td>{money(r.outstanding)}</td></tr>)}</tbody>
        </table>
      );
    case 'fee-items':
      return (
        <table>
          <thead><tr><th>Fee Item</th><th>Billed</th><th>Collected (est.)</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.id}><td>{r.name}</td><td>{money(r.billed)}</td><td>{money(r.collected)}</td></tr>)}</tbody>
        </table>
      );
    case 'debtors':
      return data.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No students owe fees.</p> : (
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Balance</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.student_id}><td>{r.student_name}</td><td>{r.class_name || '-'}</td><td style={{ color: '#f87171', fontWeight: 700 }}>{money(r.balance)}</td></tr>)}</tbody>
        </table>
      );
    case 'aged':
      return data.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No outstanding arrears.</p> : (
        <table>
          <thead><tr><th>Student</th><th>0-30</th><th>31-60</th><th>61-90</th><th>90+</th><th>Total</th></tr></thead>
          <tbody>{data.map((r: any) => (
            <tr key={r.student_id}>
              <td>{r.student_name}</td><td>{money(r.bucket_0_30)}</td><td>{money(r.bucket_31_60)}</td>
              <td>{money(r.bucket_61_90)}</td><td>{money(r.bucket_90_plus)}</td><td style={{ fontWeight: 700 }}>{money(r.total)}</td>
            </tr>
          ))}</tbody>
        </table>
      );
    case 'income-expenditure':
      return (
        <>
          <p>Income: <strong style={{ color: '#4ade80' }}>{money(data.income)}</strong> · Expenditure: <strong style={{ color: '#f87171' }}>{money(data.expenditure)}</strong> · Surplus: <strong>{money(data.surplus)}</strong></p>
          <table>
            <thead><tr><th>Category</th><th>Spent</th></tr></thead>
            <tbody>{data.byCategory.map((c: any) => <tr key={c.name}><td>{c.name}</td><td>{money(c.total)}</td></tr>)}</tbody>
          </table>
        </>
      );
    case 'budget':
      return (
        <table>
          <thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.id}><td>{r.name}</td><td>{money(r.budget)}</td><td>{money(r.spent)}</td><td>{money(r.budget - r.spent)}</td></tr>)}</tbody>
        </table>
      );
    case 'sponsors':
      return (
        <table>
          <thead><tr><th>Sponsor</th><th>Expected</th><th>Received</th><th>Outstanding</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.sponsor_id}><td>{r.sponsor_name}</td><td>{money(r.expected)}</td><td>{money(r.received)}</td><td>{money(r.outstanding)}</td></tr>)}</tbody>
        </table>
      );
    case 'methods':
      return (
        <table>
          <thead><tr><th>Method</th><th>Count</th><th>Total</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.method}><td>{r.method}</td><td>{r.count}</td><td>{money(r.total)}</td></tr>)}</tbody>
        </table>
      );
    case 'class-list':
      return (
        <table>
          <thead><tr><th>Student</th><th>Student Number</th><th>Balance</th></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.id}><td>{r.name}</td><td>{r.student_number}</td><td>{money(r.balance)}</td></tr>)}</tbody>
        </table>
      );
    default:
      return null;
  }
}
