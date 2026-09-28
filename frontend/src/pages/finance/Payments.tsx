import { useEffect, useState } from 'react';
import api, { termsApi, paymentsApi, accountsApi, adminApi } from '../../services/api';
import { money } from '../../utils/money';
import { downloadBlob } from '../../utils/downloadBlob';
import StatusBadge from '../../components/StatusBadge';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

const METHODS = ['cash', 'bank', 'ecocash', 'swipe', 'in_kind'];

export default function Payments() {
  const [terms, setTerms] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const [form, setForm] = useState({
    student_id: '', amount_paid: '', method: 'cash', reference: '', account_id: '', notes: '', pay_date: new Date().toISOString().slice(0, 10),
  });

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 7000); };

  const loadPayments = (tId: number | null) => paymentsApi.list(tId ? { term_id: tId } : {}).then((r) => setPayments(r.data));

  useEffect(() => {
    termsApi.list().then((r) => {
      setTerms(r.data);
      const current = r.data.find((t: any) => t.is_current)?.id || r.data[0]?.id || null;
      setTermId(current);
      loadPayments(current);
    });
    accountsApi.list().then((r) => { setAccounts(r.data); if (r.data.length) setForm((f) => ({ ...f, account_id: String(r.data[0].id) })); });
    adminApi.users().then((r) => setStudents(r.data.filter((u: any) => u.role === 'student')));
  }, []);

  useEffect(() => { if (termId) loadPayments(termId); }, [termId]);

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termId || !form.student_id || !form.amount_paid) return;
    setSubmitting(true);
    try {
      const res = await paymentsApi.record({
        student_id: Number(form.student_id), term_id: termId, pay_date: form.pay_date,
        amount_paid: parseFloat(form.amount_paid), currency: 'USD', fx_rate: 1,
        method: form.method, reference: form.reference, account_id: form.account_id ? Number(form.account_id) : null,
        notes: form.notes,
      });
      showMsg(res.data.message);
      setReceipt({ ...res.data, student: students.find((s) => s.id === Number(form.student_id)) });
      setForm({ ...form, student_id: '', amount_paid: '', reference: '', notes: '' });
      loadPayments(termId);
    } catch (err: any) { showMsg(err.response?.data?.message || 'Payment failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const downloadReceiptPdf = async (paymentId: number, receiptNo: string) => {
    const res = await api.get(`/payments/${paymentId}/receipt.pdf`, { responseType: 'blob' });
    downloadBlob(res.data, `receipt-${receiptNo}.pdf`);
  };

  const reversePayment = async (p: any) => {
    const reason = window.prompt(`Reason for reversing receipt ${p.receipt_no}?`);
    if (!reason) return;
    try { await paymentsApi.reverse(p.id, reason); showMsg('Payment reversed'); loadPayments(termId); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Reversal failed', 'error'); }
  };

  const csvData = payments.map((p) => ({ Receipt: p.receipt_no, Student: p.student_name, Amount: p.amount_paid.toFixed(2), Method: p.method, Status: p.status, Date: p.pay_date }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Receive Payment</h1>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <PrintButton />
          <DownloadCSV data={csvData} headers={['Receipt', 'Student', 'Amount', 'Method', 'Status', 'Date']} filename="payments" label=" CSV" />
        </div>
      </div>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <form onSubmit={submitPayment} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Term</label>
            <select value={termId || ''} onChange={(e) => setTermId(Number(e.target.value))}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.year} Term {t.term_no}{t.is_locked ? ' (locked)' : ''}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 200 }}><label>Student</label>
            <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
              <option value="">Select a student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class_name || 'no class'})</option>)}
            </select>
          </div>
          <div><label>Amount ($)</label><input type="number" step="0.01" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} required style={{ width: 110 }} /></div>
          <div><label>Method</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {form.method !== 'cash' && (
            <div><label>Reference</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required placeholder="Transaction ID" /></div>
          )}
          <div><label>Account</label>
            <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div><label>Date</label><input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></div>
          <div style={{ minWidth: 150 }}><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Recording…' : 'Record Payment'}</button>
        </form>
      </div>

      <div className="card">
        <h2>Payments ({payments.length})</h2>
        {payments.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No payments recorded for this term yet.</p> : (
          <table>
            <thead><tr><th>Receipt</th><th>Student</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.receipt_no}</td>
                  <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                  <td>{money(p.amount_paid, p.currency)}</td>
                  <td>{p.method}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{p.pay_date}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => downloadReceiptPdf(p.id, p.receipt_no)}>Receipt</button>
                    {p.status === 'active' && <button className="btn btn-sm btn-danger" onClick={() => reversePayment(p)}>Reverse</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {receipt && (
        <div className="modal-overlay" onClick={() => setReceipt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Receipt {receipt.receiptNo}</h2>
            <p>Tascar School Portal</p>
            <p>Received from: <strong>{receipt.student?.name}</strong></p>
            <p>Amount: <strong>{money(receipt.amount)}</strong></p>
            <p>Balance after payment: <strong>{money(receipt.balance)}</strong></p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <PrintButton />
              <button className="btn" onClick={() => downloadReceiptPdf(receipt.paymentId, receipt.receiptNo)}>Download PDF</button>
              <button className="btn" onClick={() => setReceipt(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
