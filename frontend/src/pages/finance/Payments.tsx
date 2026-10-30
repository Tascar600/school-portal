import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { termsApi, paymentsApi, accountsApi, financeStudentsApi, currenciesApi, openPdf, downloadPdf } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDate, fmtRange, todayIso } from '../../utils/dates';
import { useAuth } from '../../contexts/AuthContext';
import PeriodBar, { usePeriod } from '../../components/PeriodBar';
import PrintHeader from '../../components/PrintHeader';
import FinanceTabs from '../../components/FinanceTabs';
import StatusBadge from '../../components/StatusBadge';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

const METHODS: { id: string; label: string }[] = [
  { id: 'cash', label: 'Cash' }, { id: 'bank', label: 'Bank deposit / transfer' }, { id: 'ecocash', label: 'EcoCash' },
  { id: 'swipe', label: 'Card / swipe (POS)' }, { id: 'in_kind', label: 'In kind' },
];
const label = (id: string) => METHODS.find((m) => m.id === id)?.label || id;

export default function Payments() {
  const { user } = useAuth();
  const canEdit = user?.role === 'bursary';
  const [params] = useSearchParams();
  const state = usePeriod('term');
  const { period } = state;

  const [students, setStudents] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [find, setFind] = useState('');
  const [pupil, setPupil] = useState<any>(null);
  const [form, setForm] = useState({ pay_date: todayIso(), term_id: '', amount_paid: '', currency: 'USD', fx_rate: '1', method: 'cash', reference: '', account_id: '', payer: '', notes: '' });
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [fMethod, setFMethod] = useState('');
  const [fStatus, setFStatus] = useState('active');
  const [q, setQ] = useState('');

  const loadRoster = () => financeStudentsApi.list().then((r) => setStudents(r.data));
  useEffect(() => {
    loadRoster();
    termsApi.list().then((r) => { setTerms(r.data); const cur = r.data.find((t: any) => t.is_current) || r.data[0]; if (cur) setForm((f) => ({ ...f, term_id: String(cur.id) })); });
    accountsApi.list().then((r) => { setAccounts(r.data); if (r.data.length) setForm((f) => ({ ...f, account_id: String(r.data[0].id) })); });
    currenciesApi.list().then((r) => setCurrencies(r.data.filter((c: any) => c.active)));
  }, []);

  // arriving from the Students page ("Receive fee" button) with the pupil already chosen
  useEffect(() => {
    const id = Number(params.get('pupil'));
    if (id && students.length && !pupil) choose(students.find((s) => s.id === id));
  }, [students, params]);

  const loadHistory = () => paymentsApi.list({ from: period.from, to: period.to, method: fMethod || undefined, status: fStatus || undefined }).then((r) => setPayments(r.data));
  useEffect(() => { loadHistory(); }, [period.from, period.to, fMethod, fStatus]);

  const choose = (s: any) => {
    if (!s) return;
    setPupil(s); setFind('');
    setForm((f) => ({ ...f, payer: s.guardian_name || '', amount_paid: '' }));
  };
  const matches = useMemo(() => {
    const t = find.trim().toLowerCase();
    if (!t) return [];
    return students.filter((s) => s.name.toLowerCase().includes(t) || (s.student_number || '').toLowerCase().includes(t) || (s.class_name || '').toLowerCase().includes(t)).slice(0, 8);
  }, [find, students]);

  const selectCurrency = (code: string) => {
    const c = currencies.find((x) => x.code === code);
    setForm((f) => ({ ...f, currency: code, fx_rate: c ? String(c.rate) : '1' }));
  };
  const usdValue = (parseFloat(form.amount_paid) || 0) / (parseFloat(form.fx_rate) || 1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pupil) { setMsg({ text: 'Choose the pupil first.', type: 'error' }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await paymentsApi.record({
        student_id: pupil.id, term_id: Number(form.term_id), pay_date: form.pay_date, amount_paid: parseFloat(form.amount_paid),
        currency: form.currency, fx_rate: parseFloat(form.fx_rate) || 1, method: form.method, reference: form.reference,
        account_id: form.account_id ? Number(form.account_id) : null, payer: form.payer, notes: form.notes,
      });
      setDone({ ...res.data, pupil, amount: parseFloat(form.amount_paid), currency: form.currency, method: form.method, date: form.pay_date, notes: form.notes, payer: form.payer });
      setPupil(null);
      setForm((f) => ({ ...f, amount_paid: '', reference: '', notes: '', payer: '', pay_date: todayIso() }));
      loadRoster(); loadHistory();
    } catch (err: any) { setMsg({ text: err.response?.data?.message || 'The payment could not be recorded', type: 'error' }); }
    finally { setSaving(false); }
  };

  const reverse = async (p: any) => {
    const reason = window.prompt(`Why is receipt ${p.receipt_no} being reversed? (This is kept on record.)`);
    if (!reason) return;
    try { await paymentsApi.reverse(p.id, reason); setMsg({ text: `Receipt ${p.receipt_no} reversed. The amount is back on ${p.student_name}'s balance.`, type: 'info' }); loadHistory(); loadRoster(); }
    catch (err: any) { setMsg({ text: err.response?.data?.message || 'Reversal failed', type: 'error' }); }
  };

  const shown = payments.filter((p) => !q || [p.student_name, p.receipt_no, p.reference, p.notes, p.payer].some((x) => (x || '').toLowerCase().includes(q.toLowerCase())));
  const active = shown.filter((p) => p.status === 'active');
  const totalUsd = active.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title="Fees received" period={fmtRange(period.from, period.to)} extra={[fMethod && label(fMethod), fStatus === 'reversed' && 'reversed only'].filter(Boolean).join(', ') || undefined} />
      <div className="page-head no-print">
        <div><h1>{canEdit ? 'Receive fees' : 'Fees received'}</h1><p>{canEdit ? 'Record a payment, print the receipt, and look back over any period.' : 'Every payment received, for any period.'}</p></div>
      </div>
      {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

      {canEdit && (
        <div className="card no-print">
          <h2>1. Who is paying?</h2>
          {!pupil ? (
            <div style={{ position: 'relative', maxWidth: 520 }}>
              <label htmlFor="find">Find the pupil by name, registration number or class</label>
              <input id="find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Start typing…" autoComplete="off" />
              {matches.length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, marginTop: -8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  {matches.map((s) => (
                    <button key={s.id} type="button" onClick={() => choose(s)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left' }}>
                      <span><strong>{s.name}</strong> <span className="muted small">{s.class_name} {'·'} {s.student_number}</span></span>
                      <span style={{ color: s.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{s.balance > 0 ? `owes ${money(s.balance)}` : 'paid up'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 1rem' }}>
              <div><strong style={{ fontSize: '1.1rem' }}>{pupil.name}</strong><div className="muted small">{pupil.class_name} {'·'} {pupil.student_number}</div></div>
              <div><div className="muted small">Parent / guardian</div>{pupil.guardian_name || '-'} {pupil.guardian_phone && <span className="muted small">({pupil.guardian_phone})</span>}</div>
              <div><div className="muted small">{pupil.balance > 0 ? 'Owing now' : pupil.balance < 0 ? 'In credit' : 'Balance'}</div><strong style={{ fontSize: '1.2rem', color: pupil.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{money(Math.abs(pupil.balance))}</strong></div>
              <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setPupil(null)}>Change pupil</button>
            </div>
          )}

          {pupil && (
            <form onSubmit={submit} style={{ marginTop: '1rem' }}>
              <h2>2. The payment</h2>
              <div className="form-row">
                <div><label>Date received</label><input type="date" value={form.pay_date} max={todayIso()} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} required /></div>
                <div><label>For term</label><select value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })} required>{terms.map((t) => <option key={t.id} value={t.id}>Term {t.term_no}, {t.year}{t.is_current ? ' (current)' : ''}{t.is_locked ? ' – locked' : ''}</option>)}</select></div>
                <div><label>Amount paid</label><input type="number" step="0.01" min="0.01" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} required autoFocus /></div>
                <div><label>Currency</label><select value={form.currency} onChange={(e) => selectCurrency(e.target.value)}>{currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>
                {form.currency !== 'USD' && <div><label>Rate ({form.currency} per 1 USD)</label><input type="number" step="0.0001" value={form.fx_rate} onChange={(e) => setForm({ ...form, fx_rate: e.target.value })} required /></div>}
              </div>
              {form.currency !== 'USD' && usdValue > 0 && <p className="small muted" style={{ marginBottom: '0.7rem' }}>This is worth <strong>{money(usdValue)}</strong> in US dollars.</p>}
              {pupil.balance > 0 && <p style={{ marginBottom: '0.7rem' }}><button type="button" className="chip" onClick={() => setForm({ ...form, amount_paid: String(pupil.balance * (parseFloat(form.fx_rate) || 1)), })}>Fill in the full balance ({money(pupil.balance)})</button></p>}
              <div className="form-row">
                <div><label>How was it paid?</label><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
                {form.method !== 'cash' && <div><label>Reference / slip number</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required placeholder="Transaction or deposit slip no." /></div>}
                <div><label>Money goes into</label><select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label>Paid by (printed on the receipt)</label><input value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })} placeholder="Parent / guardian name" /></div>
              </div>
              <label>Notes (printed on the receipt)</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="e.g. Part payment for Term 3 tuition. Balance to be paid by 30 October." />
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Recording…' : 'Record payment and get receipt'}</button>
              <button type="button" className="btn" onClick={() => setPupil(null)}>Cancel</button>
            </form>
          )}
        </div>
      )}

      <PeriodBar state={state}>
        <div><label>Method</label><select value={fMethod} onChange={(e) => setFMethod(e.target.value)}><option value="">All</option>{METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
        <div><label>Status</label><select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="active">Valid receipts</option><option value="reversed">Reversed</option><option value="">All</option></select></div>
        <div><label>Search</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name, receipt, reference, note" /></div>
      </PeriodBar>

      <div className="card table-wrap">
        <div className="page-head" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, border: 0 }}>Payment history ({shown.length})</h2>
          <div className="toolbar no-print">
            <PrintButton />
            <DownloadCSV filename={`payments-${period.from}-to-${period.to}`} headers={['Date', 'Receipt', 'Pupil', 'Class', 'Method', 'Reference', 'Paid', 'Currency', 'USD value', 'Notes', 'Received by', 'Status']}
              data={shown.map((p) => ({ Date: p.pay_date, Receipt: p.receipt_no, Pupil: p.student_name, Class: p.class_name, Method: label(p.method), Reference: p.reference, Paid: p.amount_paid.toFixed(2), Currency: p.currency, 'USD value': p.amount.toFixed(2), Notes: p.notes, 'Received by': p.received_by_name, Status: p.status }))} />
          </div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Pupil</th><th>Method / reference</th><th className="num">Paid</th><th className="num">USD value</th><th>Received by</th><th>Status</th><th className="no-print" /></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} style={p.status === 'reversed' ? { opacity: 0.6 } : undefined}>
                <td className="nowrap">{fmtDate(p.pay_date)}</td><td>{p.receipt_no}</td>
                <td style={{ fontWeight: 600 }}>{p.student_name}<div className="muted small">{p.class_name}{p.payer ? ` · paid by ${p.payer}` : ''}</div>{p.notes && <div className="small" style={{ fontStyle: 'italic' }}>{'“'}{p.notes}{'”'}</div>}</td>
                <td>{label(p.method)}{p.reference && <div className="muted small">Ref: {p.reference}</div>}</td>
                <td className="num">{money(p.amount_paid, p.currency)}</td><td className="num">{money(p.amount)}</td>
                <td className="small">{p.received_by_name}</td><td><StatusBadge status={p.status} />{p.status === 'reversed' && p.reverse_reason && <div className="muted small">{p.reverse_reason}</div>}</td>
                <td className="no-print nowrap">
                  <button className="btn btn-sm" onClick={() => openPdf(`/payments/${p.id}/receipt.pdf`)}>Receipt</button>
                  {canEdit && p.status === 'active' && <button className="btn btn-sm btn-danger" onClick={() => reverse(p)}>Reverse</button>}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={9} className="muted">No payments match this period and filter.</td></tr>}
          </tbody>
          {active.length > 0 && <tfoot><tr><td colSpan={5}>{active.length} valid receipt{active.length === 1 ? '' : 's'}</td><td className="num">{money(totalUsd)}</td><td colSpan={3}>total received (USD value)</td></tr></tfoot>}
        </table>
      </div>

      {done && (
        <div className="modal-overlay" onClick={() => setDone(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Payment recorded {'✓'}</h2>
            <p style={{ margin: '0.5rem 0' }}>Receipt <strong>{done.receiptNo}</strong> for <strong>{done.pupil.name}</strong> ({done.pupil.class_name}).</p>
            <p style={{ margin: '0.4rem 0' }}>Received <strong>{money(done.amount, done.currency)}</strong> on {fmtDate(done.date)} by {label(done.method).toLowerCase()}{done.payer ? `, paid by ${done.payer}` : ''}.</p>
            {done.notes && <p className="small" style={{ fontStyle: 'italic' }}>Note on receipt: {'“'}{done.notes}{'”'}</p>}
            <p style={{ margin: '0.6rem 0 1rem', fontSize: '1.05rem' }}>{done.balance > 0.004 ? <>Still owing: <strong style={{ color: 'var(--danger)' }}>{money(done.balance)}</strong></> : done.balance < -0.004 ? <>Credit balance: <strong style={{ color: 'var(--success)' }}>{money(-done.balance)}</strong></> : <strong style={{ color: 'var(--success)' }}>Fully paid up</strong>}</p>
            <button className="btn btn-primary" onClick={() => openPdf(`/payments/${done.paymentId}/receipt.pdf`)}>Print receipt</button>
            <button className="btn" onClick={() => downloadPdf(`/payments/${done.paymentId}/receipt.pdf`, `Receipt ${done.receiptNo}.pdf`)}>Save as PDF</button>
            <button className="btn" onClick={() => setDone(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
