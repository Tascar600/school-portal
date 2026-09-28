import { useEffect, useState } from 'react';
import api, { termsApi, billingApi, invoicesApi, adminApi } from '../../services/api';
import { money } from '../../utils/money';
import { downloadBlob } from '../../utils/downloadBlob';
import StatusBadge from '../../components/StatusBadge';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

export default function Invoices() {
  const [terms, setTerms] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [billing, setBilling] = useState(false);
  const [showAdjust, setShowAdjust] = useState<'charge' | 'credit' | null>(null);
  const [adjustForm, setAdjustForm] = useState({ student_id: '', description: '', amount: '', notes: '' });
  const [selected, setSelected] = useState<any>(null);

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 7000); };

  const loadInvoices = (tId: number | null) => {
    invoicesApi.list(tId ? { term_id: tId } : {}).then((r) => setInvoices(r.data));
  };

  useEffect(() => {
    termsApi.list().then((r) => {
      setTerms(r.data);
      const current = r.data.find((t: any) => t.is_current)?.id || r.data[0]?.id || null;
      setTermId(current);
      loadInvoices(current);
    });
    adminApi.classes().then((r) => { setClasses(r.data); if (r.data.length) setClassId(r.data[0].id); });
    adminApi.users().then((r) => setStudents(r.data.filter((u: any) => u.role === 'student')));
  }, []);

  useEffect(() => { if (termId) loadInvoices(termId); }, [termId]);

  const runBilling = async () => {
    if (!termId || !classId) return;
    setBilling(true);
    try {
      const res = await billingApi.run({ term_id: termId, class_id: classId });
      showMsg(res.data.message); loadInvoices(termId);
    } catch (err: any) { showMsg(err.response?.data?.message || 'Billing failed', 'error'); }
    finally { setBilling(false); }
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termId || !adjustForm.student_id || !adjustForm.amount) return;
    const lines = [{ fee_item_id: null, description: adjustForm.description || (showAdjust === 'credit' ? 'Credit' : 'Charge'), amount: parseFloat(adjustForm.amount) }];
    try {
      const call = showAdjust === 'credit' ? billingApi.creditNote : billingApi.charge;
      const res = await call({ student_id: Number(adjustForm.student_id), term_id: termId, lines, notes: adjustForm.notes });
      showMsg(res.data.message); setShowAdjust(null); setAdjustForm({ student_id: '', description: '', amount: '', notes: '' }); loadInvoices(termId);
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed', 'error'); }
  };

  const cancelInvoice = async (inv: any) => {
    const reason = window.prompt(`Reason for cancelling ${inv.invoice_no}?`);
    if (!reason) return;
    try { await invoicesApi.cancel(inv.id, reason); showMsg('Invoice cancelled'); loadInvoices(termId); if (selected?.id === inv.id) setSelected(null); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Cancel failed', 'error'); }
  };

  const openInvoice = async (inv: any) => {
    const res = await invoicesApi.get(inv.id);
    setSelected(res.data);
  };

  const downloadInvoicePdf = async (inv: any) => {
    const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
    downloadBlob(res.data, `invoice-${inv.invoice_no}.pdf`);
  };

  const csvData = invoices.map((i) => ({ Invoice: i.invoice_no, Student: i.student_name, Type: i.type, Total: i.total.toFixed(2), Status: i.status, Date: i.inv_date }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Billing &amp; Invoices</h1>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <PrintButton />
          <DownloadCSV data={csvData} headers={['Invoice', 'Student', 'Type', 'Total', 'Status', 'Date']} filename="invoices" label=" CSV" />
        </div>
      </div>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <h2>Bill a class</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Term</label>
            <select value={termId || ''} onChange={(e) => setTermId(Number(e.target.value))}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.year} Term {t.term_no}{t.is_locked ? ' (locked)' : ''}</option>)}
            </select>
          </div>
          <div><label>Class</label>
            <select value={classId || ''} onChange={(e) => setClassId(Number(e.target.value))}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={runBilling} disabled={billing}>{billing ? 'Billing…' : 'Run Billing'}</button>
          <button className="btn" onClick={() => setShowAdjust('charge')}>New Charge</button>
          <button className="btn" onClick={() => setShowAdjust('credit')}>New Credit Note</button>
        </div>
      </div>

      <div className="card">
        <h2>Invoices ({invoices.length})</h2>
        {invoices.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No invoices for this term yet.</p> : (
          <table>
            <thead><tr><th>Invoice #</th><th>Student</th><th>Type</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.invoice_no}</td>
                  <td style={{ fontWeight: 600 }}>{i.student_name}</td>
                  <td>{i.type}</td>
                  <td>{money(i.total)}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{i.inv_date}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openInvoice(i)}>View</button>
                    {i.status === 'active' && <button className="btn btn-sm btn-danger" onClick={() => cancelInvoice(i)}>Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdjust && (
        <div className="modal-overlay" onClick={() => setShowAdjust(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{showAdjust === 'credit' ? 'New Credit Note' : 'New Charge'}</h2>
            <form onSubmit={submitAdjust}>
              <label>Student</label>
              <select value={adjustForm.student_id} onChange={(e) => setAdjustForm({ ...adjustForm, student_id: e.target.value })} required>
                <option value="">Select a student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class_name || 'no class'})</option>)}
              </select>
              <label>Description</label>
              <input value={adjustForm.description} onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })} placeholder={showAdjust === 'credit' ? 'e.g. Fee waiver' : 'e.g. Lost textbook'} />
              <label>Amount ($)</label>
              <input type="number" step="0.01" value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })} required />
              <label>Notes</label>
              <input value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
              <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Create</button>
                <button type="button" className="btn" onClick={() => setShowAdjust(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{selected.invoice_no}</h2>
            <p style={{ color: 'var(--text-dim)' }}>{selected.student_name} · {selected.inv_date} · <StatusBadge status={selected.status} /></p>
            <table>
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {selected.lines.map((l: any) => (
                  <tr key={l.id}><td>{l.description}</td><td>{money(l.amount)}</td></tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: 'right', fontWeight: 700, marginTop: '0.5rem' }}>Total: {money(selected.total)}</p>
            {selected.status === 'cancelled' && <p style={{ color: '#f87171' }}>Cancelled: {selected.cancel_reason}</p>}
            <button className="btn" onClick={() => downloadInvoicePdf(selected)}>Download PDF</button>
            <button className="btn" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
