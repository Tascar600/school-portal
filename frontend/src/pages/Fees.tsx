import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { feesApi } from '../services/api';

export default function Fees() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [accountType, setAccountType] = useState('SDC');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [showCreate, setShowCreate] = useState(false);
  const [accForm, setAccForm] = useState({ student_id: '', account_type: 'SDC', total_fee: '' });
  const [showTermEnd, setShowTermEnd] = useState(false);
  const [termForm, setTermForm] = useState({ sdc_fee: '', ssf_fee: '' });
  const [showYearEnd, setShowYearEnd] = useState(false);
  const [loading, setLoading] = useState(false);

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => {
    setMsg(m);
    setMsgType(t);
    setTimeout(() => setMsg(''), 8000);
  };

  const load = () => {
    if (user?.role === 'student') feesApi.myAccounts().then(r => setAccounts(r.data));
    if (user?.role === 'admin') {
      feesApi.accounts().then(r => setAccounts(r.data));
      feesApi.pending().then(r => setPendingPayments(r.data));
    }
    if (user?.role === 'teacher') feesApi.teacherAccounts().then(r => setAccounts(r.data));
  };

  useEffect(() => { load(); }, [user]);

  const getBalance = (type: string) => {
    const acc = accounts.find((a: any) => a.account_type === type);
    return acc ? acc.balance : 0;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showMsg('Please enter a valid amount', 'error');
      return;
    }
    const balance = getBalance(accountType);
    if (parsedAmount > balance) {
      showMsg(`You cannot pay more than the balance. Maximum allowed: $${balance.toFixed(2)}`, 'error');
      return;
    }
    const fd = new FormData();
    fd.append('account_type', accountType);
    fd.append('amount', amount);
    if (file) fd.append('proof', file);
    try {
      await feesApi.pay(fd);
      showMsg('Payment submitted for verification');
      setAmount(''); setFile(null);
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Payment failed', 'error'); }
  };

  const handleVerify = async (id: number, action: string) => {
    try { await feesApi.verify(id, action); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Error', 'error'); }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await feesApi.createAccount({ ...accForm, total_fee: parseFloat(accForm.total_fee) });
      setShowCreate(false);
      setAccForm({ student_id: '', account_type: 'SDC', total_fee: '' });
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Error', 'error'); }
  };

  const handleTermEnd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await feesApi.termEnd({ sdc_fee: parseFloat(termForm.sdc_fee), ssf_fee: parseFloat(termForm.ssf_fee) });
      showMsg(res.data.message);
      setShowTermEnd(false);
      setTermForm({ sdc_fee: '', ssf_fee: '' });
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Term end failed', 'error'); }
    finally { setLoading(false); }
  };

  const handleYearEnd = async () => {
    setLoading(true);
    try {
      const res = await feesApi.yearEnd();
      showMsg(res.data.message);
      setShowYearEnd(false);
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Year end failed', 'error'); }
    finally { setLoading(false); }
  };

  const proofUrl = (path: string) => path ? path : undefined;

  const renderBalance = (a: any) => {
    if (a.balance <= 0) return <span style={{ color: '#4ade80', fontWeight: 700 }}>FULLY PAID</span>;
    return <span style={{ color: '#f87171', fontWeight: 600 }}>${a.balance?.toFixed(2)}</span>;
  };

  const renderPayments = (payments: any[]) => {
    if (!payments || payments.length === 0) return <span style={{ color: 'var(--text-dim)' }}>None</span>;
    return payments.map((p: any) => (
      <div key={p.id} style={{ fontSize: '0.8rem', marginBottom: '0.25rem', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</span>{' '}
        <span className={`badge`} style={{
          background: p.status === 'verified' ? 'rgba(34,197,94,0.2)' : p.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
          color: p.status === 'verified' ? '#4ade80' : p.status === 'rejected' ? '#f87171' : '#fbbf24',
          fontSize: '0.7rem'
        }}>{p.status}</span>{' '}
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{new Date(p.created_at).toLocaleDateString()}</span>
        {p.proof_file && <> · <a href={proofUrl(p.proof_file) || '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--neon)', fontSize: '0.7rem' }}>Proof</a></>}
      </div>
    ));
  };

  // === STUDENT VIEW ===
  if (user?.role === 'student') {
    return (
      <div>
        <h1>School Fees</h1>
        {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

        {accounts.map((a: any) => (
          <div key={a.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Account: {a.account_type}</h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Total Fee: <strong style={{ color: '#fff' }}>${a.total_fee?.toFixed(2)}</strong>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{renderBalance(a)}</div>
              </div>
            </div>

            <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--neon)' }}>Payment History</h3>
            {(!a.payments || a.payments.length === 0) ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No payments recorded yet.</p>
            ) : (
              <div>{renderPayments(a.payments)}</div>
            )}
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-dim)' }}>No fee accounts set up for you yet. Contact the admin.</p>
          </div>
        )}

        {accounts.length > 0 && (
          <div className="card">
            <h2>Make Payment</h2>
            <form onSubmit={handlePay}>
              <label>Account Type</label>
              <select value={accountType} onChange={e => { setAccountType(e.target.value); setAmount(''); }}>
                {accounts.map((a: any) => (
                  <option key={a.account_type} value={a.account_type}>
                    {a.account_type} (Balance: ${a.balance?.toFixed(2)})
                  </option>
                ))}
              </select>
              <label>Amount ($)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                  placeholder={`Max: $${getBalance(accountType).toFixed(2)}`} />
                <button type="button" className="btn btn-sm" style={{ fontSize: '0.8rem' }}
                  onClick={() => setAmount(getBalance(accountType).toString())}>Max</button>
              </div>
              <label>Upload Proof (optional)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
              <button type="submit" className="btn btn-primary">Submit Payment</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // === TEACHER VIEW ===
  if (user?.role === 'teacher') {
    return (
      <div>
        <h1>Student Fees</h1>
        {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}
        <div className="card">
          <h2>My Students' Fee Accounts</h2>
          {accounts.length === 0 ? <p>No students with fee accounts in your classes.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Total Fee</th><th>Balance</th><th>Payments</th></tr></thead>
              <tbody>
                {accounts.map((a: any) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                    <td>{a.account_type}</td>
                    <td>${a.total_fee?.toFixed(2)}</td>
                    <td>{renderBalance(a)}</td>
                    <td style={{ minWidth: 180 }}>{renderPayments(a.payments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // === ADMIN VIEW ===
  if (user?.role === 'admin') {
    return (
      <div>
        <h1>Fee Management</h1>
        {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={() => setShowCreate(true)}>+ Create Fee Account</button>
          <button className="btn btn-warning" onClick={() => setShowTermEnd(true)}> Term End</button>
          <button className="btn btn-danger" onClick={() => setShowYearEnd(true)}> Year End</button>
        </div>

        <div className="card">
          <h2>Pending Payments ({pendingPayments.length})</h2>
          {pendingPayments.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>No pending payments to verify.</p>
          ) : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Amount</th><th>Proof</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {pendingPayments.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                    <td>{p.account_type}</td>
                    <td style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</td>
                    <td>{p.proof_file ? <a href={proofUrl(p.proof_file)} target="_blank" rel="noreferrer" style={{ color: 'var(--neon)' }}>View Proof</a> : <span style={{ color: 'var(--text-dim)' }}>No file</span>}</td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-success btn-sm" onClick={() => handleVerify(p.id, 'verified')}>✓ Verify</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleVerify(p.id, 'rejected')}>✗ Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>All Fee Accounts ({accounts.length})</h2>
          {accounts.length === 0 ? <p>No accounts created yet.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Total</th><th>Balance</th><th>Payment History</th></tr></thead>
              <tbody>
                {accounts.map((a: any) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                    <td>{a.account_type}</td>
                    <td>${a.total_fee?.toFixed(2)}</td>
                    <td>{renderBalance(a)}</td>
                    <td style={{ minWidth: 200 }}>{renderPayments(a.payments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Account Modal */}
        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Create Fee Account</h2>
              <form onSubmit={handleCreateAccount}>
                <label>Student ID</label>
                <input value={accForm.student_id} onChange={e => setAccForm({ ...accForm, student_id: e.target.value })} required placeholder="e.g. 5" />
                <label>Account Type</label>
                <select value={accForm.account_type} onChange={e => setAccForm({ ...accForm, account_type: e.target.value })}>
                  <option value="SDC">S.D.C (School Development Committee)</option>
                  <option value="SSF">S.S.F (School Support Fund)</option>
                </select>
                <label>Total Fee ($)</label>
                <input type="number" step="0.01" value={accForm.total_fee} onChange={e => setAccForm({ ...accForm, total_fee: e.target.value })} required placeholder="e.g. 100.00" />
                <div style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">Create Account</button>
                  <button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Term End Modal */}
        {showTermEnd && (
          <div className="modal-overlay" onClick={() => setShowTermEnd(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Term End — Set New Fees</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                This resets all fee accounts to the new term amounts. Credits (overpayments) carry forward automatically.
              </p>
              <form onSubmit={handleTermEnd}>
                <label>SDC Fee for New Term ($)</label>
                <input type="number" step="0.01" value={termForm.sdc_fee} onChange={e => setTermForm({ ...termForm, sdc_fee: e.target.value })} required placeholder="e.g. 50.00" />
                <label>SSF Fee for New Term ($)</label>
                <input type="number" step="0.01" value={termForm.ssf_fee} onChange={e => setTermForm({ ...termForm, ssf_fee: e.target.value })} required placeholder="e.g. 30.00" />
                <div style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-warning" disabled={loading}>{loading ? 'Processing...' : ' End Term'}</button>
                  <button type="button" className="btn" onClick={() => setShowTermEnd(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Year End Modal */}
        {showYearEnd && (
          <div className="modal-overlay" onClick={() => setShowYearEnd(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Year End — Promote Students</h2>
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <strong style={{ color: '#f87171' }}>⚠ Warning</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  <li>All students will move to the next class</li>
                  <li>Students in the final class will graduate (class removed)</li>
                  <li>All teacher class assignments will be reset to unassigned</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-danger" onClick={handleYearEnd} disabled={loading}>
                  {loading ? 'Processing...' : ' Confirm Year End'}
                </button>
                <button className="btn" onClick={() => setShowYearEnd(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
