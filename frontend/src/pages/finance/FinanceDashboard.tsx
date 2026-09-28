import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { termsApi, invoicesApi, paymentsApi } from '../../services/api';
import { money } from '../../utils/money';

export default function FinanceDashboard() {
  const [term, setTerm] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    termsApi.current().then((r) => {
      setTerm(r.data);
      if (!r.data) { setLoading(false); return; }
      Promise.all([
        invoicesApi.list({ term_id: r.data.id }),
        paymentsApi.list({ term_id: r.data.id }),
      ]).then(([inv, pay]) => {
        setInvoices(inv.data);
        setPayments(pay.data);
      }).finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const billed = invoices.filter((i) => i.status === 'active').reduce((s, i) => s + i.total, 0);
  const collected = payments.filter((p) => p.status === 'active').reduce((s, p) => s + p.amount, 0);
  const outstanding = billed - collected;
  const pendingReversal = payments.filter((p) => p.status === 'reversed').length;

  if (loading) return <div className="card">Loading finance overview…</div>;

  if (!term) {
    return (
      <div>
        <h1>Finance</h1>
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--text-dim)' }}>No term has been set as current yet.</p>
          <Link to="/finance/setup" className="btn btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>Go to Setup</Link>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Billed this term', value: money(billed), color: '#60a5fa' },
    { label: 'Collected', value: money(collected), color: '#4ade80' },
    { label: 'Outstanding', value: money(outstanding), color: outstanding > 0 ? '#f87171' : '#4ade80' },
    { label: 'Invoices', value: String(invoices.length), color: '#a78bfa' },
    { label: 'Payments recorded', value: String(payments.length), color: '#a78bfa' },
    { label: 'Reversed payments', value: String(pendingReversal), color: '#fbbf24' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Finance — {term.year} Term {term.term_no}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/finance/setup" className="btn">Setup</Link>
          <Link to="/finance/invoices" className="btn">Invoices &amp; Billing</Link>
          <Link to="/finance/payments" className="btn btn-primary">Receive Payment</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Recent payments</h2>
        {payments.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No payments recorded this term yet.</p> : (
          <table>
            <thead><tr><th>Student</th><th>Receipt</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead>
            <tbody>
              {payments.slice(0, 10).map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                  <td>{p.receipt_no}</td>
                  <td>{money(p.amount_paid, p.currency)}</td>
                  <td>{p.method}</td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
