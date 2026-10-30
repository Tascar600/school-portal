import { useEffect, useMemo, useState } from 'react';
import { termsApi, billingApi, invoicesApi, financeStudentsApi, openPdf } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDate, fmtRange, todayIso } from '../../utils/dates';
import { useAuth } from '../../contexts/AuthContext';
import PeriodBar, { usePeriod } from '../../components/PeriodBar';
import PrintHeader from '../../components/PrintHeader';
import FinanceTabs from '../../components/FinanceTabs';
import StatusBadge from '../../components/StatusBadge';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

const TYPE: Record<string, string> = { term: 'Term fees', charge: 'Extra charge', credit: 'Credit note' };

export default function Invoices() {
  const { user } = useAuth();
  const canEdit = user?.role === 'bursary';
  const state = usePeriod('term');
  const { period } = state;
  const [terms, setTerms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [fClass, setFClass] = useState('');
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('active');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  // bill a class
  const [billTerm, setBillTerm] = useState('');
  const [billClass, setBillClass] = useState('');
  const [billDate, setBillDate] = useState(todayIso());
  const [billing, setBilling] = useState(false);
  // charge / credit note
  const [adjust, setAdjust] = useState<'charge' | 'credit' | null>(null);
  const [adj, setAdj] = useState({ student_id: '', description: '', amount: '', notes: '', date: todayIso() });
  const [detail, setDetail] = useState<any>(null);

  const notify = (text: string, type: 'info' | 'error' = 'info') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 8000); };
  const load = () => invoicesApi.list({ from: period.from, to: period.to, type: fType || undefined, status: fStatus || undefined }).then((r) => setInvoices(r.data));
  useEffect(() => { load(); }, [period.from, period.to, fType, fStatus]);
  useEffect(() => {
    termsApi.list().then((r) => { setTerms(r.data); const cur = r.data.find((t: any) => t.is_current) || r.data[0]; if (cur) setBillTerm(String(cur.id)); });
    financeStudentsApi.classes().then((r) => { setClasses(r.data); if (r.data.length) setBillClass(String(r.data[0].id)); });
    financeStudentsApi.list().then((r) => setStudents(r.data));
  }, []);

  const runBilling = async () => {
    setBilling(true);
    try { const r = await billingApi.run({ term_id: Number(billTerm), class_id: Number(billClass), date: billDate }); notify(r.data.message); load(); }
    catch (err: any) { notify(err.response?.data?.message || 'Billing failed', 'error'); } finally { setBilling(false); }
  };
  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = terms.find((t) => t.is_current) || terms[0];
    const lines = [{ fee_item_id: null, description: adj.description || (adjust === 'credit' ? 'Credit' : 'Charge'), amount: parseFloat(adj.amount) }];
    try {
      const call = adjust === 'credit' ? billingApi.creditNote : billingApi.charge;
      const r = await call({ student_id: Number(adj.student_id), term_id: term.id, date: adj.date, lines, notes: adj.notes });
      notify(r.data.message); setAdjust(null); setAdj({ student_id: '', description: '', amount: '', notes: '', date: todayIso() }); load();
    } catch (err: any) { notify(err.response?.data?.message || 'Failed', 'error'); }
  };
  const cancel = async (inv: any) => {
    const reason = window.prompt(`Why is ${inv.invoice_no} being cancelled? (This is kept on record.)`); if (!reason) return;
    try { await invoicesApi.cancel(inv.id, reason); notify(`${inv.invoice_no} cancelled`); load(); setDetail(null); }
    catch (err: any) { notify(err.response?.data?.message || 'Cancel failed', 'error'); }
  };

  const shown = useMemo(() => invoices.filter((i) => {
    if (fClass && String(classes.find((c) => c.name === i.class_name)?.id) !== fClass) return false;
    if (q && ![i.student_name, i.invoice_no, i.student_number].some((x) => (x || '').toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [invoices, fClass, q, classes]);
  const activeTotal = shown.filter((i) => i.status === 'active').reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title="Invoices, charges and credit notes" period={fmtRange(period.from, period.to)} />
      <div className="page-head no-print">
        <div><h1>Invoices and billing</h1><p>Term fees are billed one class at a time from the fee structure. Extra charges and credit notes are for single pupils.</p></div>
      </div>
      {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

      {canEdit && (
        <div className="card no-print">
          <h2>Bill a class for a term</h2>
          <div className="inline-form">
            <div><label>Term</label><select value={billTerm} onChange={(e) => setBillTerm(e.target.value)}>{terms.map((t) => <option key={t.id} value={t.id}>Term {t.term_no}, {t.year}{t.is_locked ? ' (locked)' : ''}</option>)}</select></div>
            <div><label>Class</label><select value={billClass} onChange={(e) => setBillClass(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label>Invoice date</label><input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={runBilling} disabled={billing}>{billing ? 'Billing…' : 'Run billing'}</button>
            <button className="btn" onClick={() => setAdjust('charge')}>New extra charge</button>
            <button className="btn" onClick={() => setAdjust('credit')}>New credit note</button>
          </div>
          <p className="small muted" style={{ marginTop: '0.5rem' }}>Running billing again never bills a pupil twice.</p>
        </div>
      )}

      <PeriodBar state={state}>
        <div><label>Class</label><select value={fClass} onChange={(e) => setFClass(e.target.value)}><option value="">All</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label>Type</label><select value={fType} onChange={(e) => setFType(e.target.value)}><option value="">All</option>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label>Status</label><select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="active">Valid</option><option value="cancelled">Cancelled</option><option value="">All</option></select></div>
        <div><label>Search</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="pupil or invoice no." /></div>
      </PeriodBar>

      <div className="card table-wrap">
        <div className="page-head" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, border: 0 }}>Invoices ({shown.length})</h2>
          <div className="toolbar no-print"><PrintButton /><DownloadCSV filename={`invoices-${period.from}-to-${period.to}`} headers={['Date', 'Invoice', 'Pupil', 'Class', 'Type', 'Total', 'Status']} data={shown.map((i) => ({ Date: i.inv_date, Invoice: i.invoice_no, Pupil: i.student_name, Class: i.class_name, Type: TYPE[i.type], Total: i.total.toFixed(2), Status: i.status }))} /></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Invoice</th><th>Pupil</th><th>Type</th><th className="num">Gross</th><th className="num">Discount</th><th className="num">Total</th><th>Status</th><th className="no-print" /></tr></thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id} style={i.status === 'cancelled' ? { opacity: 0.6 } : undefined}>
                <td className="nowrap">{fmtDate(i.inv_date)}</td><td>{i.invoice_no}</td><td style={{ fontWeight: 600 }}>{i.student_name}<div className="muted small">{i.class_name}</div></td><td>{TYPE[i.type]}{i.notes && <div className="muted small">{i.notes}</div>}</td>
                <td className="num">{money(i.gross)}</td><td className="num">{i.discount ? money(i.discount) : ''}</td><td className="num"><strong>{money(i.total)}</strong></td>
                <td><StatusBadge status={i.status} />{i.cancel_reason && <div className="muted small">{i.cancel_reason}</div>}</td>
                <td className="no-print nowrap">
                  <button className="btn btn-sm" onClick={async () => setDetail((await invoicesApi.get(i.id)).data)}>View</button>
                  <button className="btn btn-sm" onClick={() => openPdf(`/invoices/${i.id}/pdf`)}>Print</button>
                  {canEdit && i.status === 'active' && <button className="btn btn-sm btn-danger" onClick={() => cancel(i)}>Cancel</button>}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={9} className="muted">No invoices in this period.</td></tr>}
          </tbody>
          {shown.length > 0 && <tfoot><tr><td colSpan={6}>Total of valid invoices</td><td className="num">{money(activeTotal)}</td><td colSpan={2} /></tr></tfoot>}
        </table>
      </div>

      {adjust && (
        <div className="modal-overlay" onClick={() => setAdjust(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitAdjust}>
            <h2>{adjust === 'credit' ? 'New credit note (reduces what is owed)' : 'New extra charge (adds to what is owed)'}</h2>
            <label>Pupil</label>
            <select value={adj.student_id} onChange={(e) => setAdj({ ...adj, student_id: e.target.value })} required><option value="">Choose a pupil</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class_name || 'no class'})</option>)}</select>
            <label>Date</label><input type="date" value={adj.date} onChange={(e) => setAdj({ ...adj, date: e.target.value })} required />
            <label>What is it for?</label><input value={adj.description} onChange={(e) => setAdj({ ...adj, description: e.target.value })} placeholder={adjust === 'credit' ? 'e.g. Fee waiver' : 'e.g. Lost library book'} required />
            <label>Amount (USD)</label><input type="number" step="0.01" min="0.01" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} required />
            <label>Notes</label><input value={adj.notes} onChange={(e) => setAdj({ ...adj, notes: e.target.value })} />
            <button type="submit" className="btn btn-primary">Create</button><button type="button" className="btn" onClick={() => setAdjust(null)}>Cancel</button>
          </form>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{detail.invoice_no}</h2>
            <p className="small muted">{detail.student_name} {'·'} {fmtDate(detail.inv_date)} {'·'} <StatusBadge status={detail.status} /></p>
            <table style={{ margin: '0.6rem 0' }}><thead><tr><th>Description</th><th className="num">Amount</th></tr></thead><tbody>{detail.lines.map((l: any) => <tr key={l.id}><td>{l.description}</td><td className="num">{money(l.amount)}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td className="num">{money(detail.total)}</td></tr></tfoot></table>
            {detail.status === 'cancelled' && <p style={{ color: 'var(--danger)' }}>Cancelled: {detail.cancel_reason}</p>}
            <button className="btn btn-primary" onClick={() => openPdf(`/invoices/${detail.id}/pdf`)}>Print invoice</button><button className="btn" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
