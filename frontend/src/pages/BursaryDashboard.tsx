import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { feesApi } from '../services/api';

export default function BursaryDashboard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [receiptPayment, setReceiptPayment] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const load = () => {
    feesApi.accounts().then(r => setAccounts(r.data));
    feesApi.pending().then(r => setPendingPayments(r.data));
    feesApi.stats().then(r => setStats(r.data));
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (id: number, action: string) => {
    try { await feesApi.verify(id, action); load(); } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleUndo = async (id: number) => {
    try { await feesApi.undo(id); setMsg('Payment reverted to pending'); load(); } catch (err: any) { setMsg(err.response?.data?.message || 'Undo failed'); }
  };

  const genReceipt = (p: any) => {
    setReceiptPayment(p);
    setShowReceipt(true);
    setTimeout(() => window.print(), 300);
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { verified: '#4ade80', rejected: '#f87171', pending: '#fbbf24' };
    return <span style={{ background: `${colors[s]}22`, color: colors[s], padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem' }}>{s}</span>;
  };

  return (
    <div>
      {msg && <div className="alert alert-info">{msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Bursary Dashboard</h1>
      </div>

      {stats && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { label: 'Total Accounts', value: `${stats.sdc.accounts + stats.ssf.accounts}`, color: '#60a5fa' },
          { label: 'SDC Outstanding', value: `$${stats.sdc.outstanding.toFixed(2)}`, color: '#f87171' },
          { label: 'SSF Outstanding', value: `$${stats.ssf.outstanding.toFixed(2)}`, color: '#f87171' },
          { label: 'Collected', value: `$${stats.totalCollected.toFixed(2)}`, color: '#4ade80' },
          { label: 'Pending Verify', value: `${stats.pendingVerifications}`, color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>}

      <div className="card">
        <h2>Pending Payments ({pendingPayments.length})</h2>
        {pendingPayments.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No pending payments.</p> : (
          <table>
            <thead><tr><th>Student</th><th>Account</th><th>Amount</th><th>Receipt #</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>{pendingPayments.map((p: any) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                <td>{p.account_type}</td>
                <td style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</td>
                <td>{p.receipt_number || '-'}</td>
                <td style={{ fontSize: '0.85rem' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-success btn-sm" onClick={() => handleVerify(p.id, 'verified')}>✓ Verify</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleVerify(p.id, 'rejected')}>✗ Reject</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>All Fee Accounts ({accounts.length})</h2>
        {accounts.length === 0 ? <p>No accounts yet.</p> : (
          <table>
            <thead><tr><th>Student</th><th>Account</th><th>Total</th><th>Credit B/F</th><th>Balance</th><th>Payment History</th></tr></thead>
            <tbody>{accounts.map((a: any) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                <td>{a.account_type}</td>
                <td>${a.total_fee?.toFixed(2)}</td>
                <td>{a.credit_bf > 0 ? <span style={{ color: '#f87171', fontWeight: 700 }}>${parseFloat(a.credit_bf).toFixed(2)}</span> : <span style={{ color: 'var(--text-dim)' }}>-</span>}</td>
                <td>{a.balance <= 0 ? <span style={{ color: '#4ade80', fontWeight: 700 }}>FULLY PAID</span> : <span style={{ color: '#f87171', fontWeight: 700 }}>${a.balance?.toFixed(2)} OWING</span>}</td>
                <td style={{ minWidth: 220 }}>
                  {a.payments?.length ? a.payments.map((p: any) => (
                    <div key={p.id} style={{ fontSize: '0.8rem', marginBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</span> {statusBadge(p.status)}
                        {p.receipt_number && <span style={{ color: 'var(--neon)', fontSize: '0.7rem', marginLeft: '0.3rem' }}>#{p.receipt_number}</span>}
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{new Date(p.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                        {p.status === 'verified' && <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '1px 4px', background: 'rgba(74,222,128,0.2)', color: '#4ade80', border: 'none' }} onClick={() => genReceipt(p)}>🧾 Receipt</button>}
                        {p.status !== 'pending' && <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '1px 4px' }} onClick={() => handleUndo(p.id)} title="Revert to pending">↩</button>}
                      </div>
                    </div>
                  )) : <span style={{ color: 'var(--text-dim)' }}>None</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* Receipt print */}
      {receiptPayment && (
        <div style={{ display: 'none' }} className="receipt-print">
          <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Chakari (GVT) Primary School</h1>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Mashonaland West · Sanyati District</p>
            <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.1rem' }}>OFFICIAL RECEIPT</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>Student:</td><td style={{ padding: '4px 8px' }}>{receiptPayment.student_name}</td></tr>
              <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>Account:</td><td style={{ padding: '4px 8px' }}>{receiptPayment.account_type}</td></tr>
              <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>Amount Paid:</td><td style={{ padding: '4px 8px' }}>${parseFloat(receiptPayment.amount).toFixed(2)}</td></tr>
              <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>Receipt #:</td><td style={{ padding: '4px 8px' }}>{receiptPayment.receipt_number || 'N/A'}</td></tr>
              <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>Date:</td><td style={{ padding: '4px 8px' }}>{new Date(receiptPayment.created_at).toLocaleDateString()}</td></tr>
              <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>Status:</td><td style={{ padding: '4px 8px', color: '#4ade80', fontWeight: 700 }}>VERIFIED</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', textAlign: 'center', borderTop: '2px solid #000', paddingTop: '0.5rem', fontSize: '0.8rem' }}>
            This is a computer-generated receipt from Tascar School Portal
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .receipt-print h1, .receipt-print h2 { color: #000; }
          .receipt-print table { color: #000; }
        }
      `}</style>
    </div>
  );
}
