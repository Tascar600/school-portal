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
  const [showCreate, setShowCreate] = useState(false);
  const [accForm, setAccForm] = useState({ student_id: '', account_type: 'SDC', total_fee: '' });

  const load = () => {
    if (user?.role === 'student') {
      feesApi.myAccounts().then(r => setAccounts(r.data));
    }
    if (user?.role === 'admin') {
      feesApi.accounts().then(r => setAccounts(r.data));
      feesApi.pending().then(r => setPendingPayments(r.data));
    }
    if (user?.role === 'teacher') {
      feesApi.teacherAccounts().then(r => setAccounts(r.data));
    }
  };

  useEffect(() => { load(); }, [user]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('account_type', accountType);
    fd.append('amount', amount);
    if (file) fd.append('proof', file);
    try {
      await feesApi.pay(fd);
      setMsg('Payment submitted for verification');
      setAmount(''); setFile(null);
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleVerify = async (id: number, action: string) => {
    try { await feesApi.verify(id, action); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await feesApi.createAccount({ ...accForm, total_fee: parseFloat(accForm.total_fee) });
      setShowCreate(false);
      setAccForm({ student_id: '', account_type: 'SDC', total_fee: '' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  if (user?.role === 'student') {
    return (
      <div>
        <h1>School Fees</h1>
        {msg && <div className="alert alert-info">{msg}</div>}

        {accounts.map((a: any) => (
          <div key={a.id} className="card">
            <h2>Account: {a.account_type}</h2>
            <p><strong>Total Fee:</strong> ${a.total_fee?.toFixed(2)}</p>
            <p><strong>Balance:</strong> <span style={{ color: a.balance > 0 ? '#c62828' : '#2e7d32' }}>${a.balance?.toFixed(2)}</span></p>

            <h3>Payment History</h3>
            {(!a.payments || a.payments.length === 0) ? <p>No payments yet.</p> : (
              <table>
                <thead><tr><th>Amount</th><th>Status</th><th>Date</th><th>Proof</th></tr></thead>
                <tbody>
                  {a.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td>${p.amount?.toFixed(2)}</td>
                      <td><span className={`alert-${p.status === 'verified' ? 'success' : p.status === 'rejected' ? 'error' : 'info'}`} style={{ padding: '2px 8px', borderRadius: 4 }}>{p.status}</span></td>
                      <td>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td>{p.proof_file ? <a href={`http://localhost:5000${p.proof_file}`} target="_blank" rel="noreferrer">View</a> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        <div className="card">
          <h2>Make Payment</h2>
          <form onSubmit={handlePay}>
            <label>Account Type</label>
            <select value={accountType} onChange={e => setAccountType(e.target.value)}>
              <option value="SDC">S.D.C</option>
              <option value="SSF">S.S.F</option>
            </select>
            <label>Amount ($)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
            <label>Upload Proof (optional)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
            <button type="submit" className="btn btn-primary">Submit Payment</button>
          </form>
        </div>
      </div>
    );
  }

  if (user?.role === 'teacher') {
    return (
      <div>
        <h1>Student Fees</h1>
        {msg && <div className="alert alert-info">{msg}</div>}
        <div className="card">
          <h2>My Students' Fee Accounts</h2>
          {accounts.length === 0 ? <p>No students with fee accounts in your classes.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Total Fee</th><th>Balance</th><th>Payments</th></tr></thead>
              <tbody>
                {accounts.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.student_name}</td>
                    <td>{a.account_type}</td>
                    <td>${a.total_fee?.toFixed(2)}</td>
                    <td style={{ color: a.balance > 0 ? '#c62828' : '#2e7d32' }}>${a.balance?.toFixed(2)}</td>
                    <td>
                      {a.payments?.map((p: any) => (
                        <div key={p.id} style={{ fontSize: '0.85rem' }}>
                          ${p.amount} - <span className={`alert-${p.status === 'verified' ? 'success' : p.status === 'rejected' ? 'error' : 'info'}`} style={{ padding: '1px 4px', borderRadius: 2 }}>{p.status}</span>
                          {p.proof_file && <a href={`http://localhost:5000${p.proof_file}`} target="_blank" rel="noreferrer"> Proof</a>}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  if (user?.role === 'admin') {
    return (
      <div>
        <h1>Fee Management</h1>
        {msg && <div className="alert alert-info">{msg}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-success" onClick={() => setShowCreate(true)}>Create Account</button>
        </div>

        <div className="card">
          <h2>Pending Payments ({pendingPayments.length})</h2>
          {pendingPayments.length === 0 ? <p>No pending payments.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Amount</th><th>Proof</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {pendingPayments.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.student_name}</td>
                    <td>{p.account_type}</td>
                    <td>${p.amount?.toFixed(2)}</td>
                    <td>{p.proof_file ? <a href={`http://localhost:5000${p.proof_file}`} target="_blank" rel="noreferrer">View</a> : 'No file'}</td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-success btn-sm" onClick={() => handleVerify(p.id, 'verified')}>Verify</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleVerify(p.id, 'rejected')}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>All Fee Accounts</h2>
          {accounts.length === 0 ? <p>No accounts.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Total</th><th>Balance</th></tr></thead>
              <tbody>
                {accounts.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.student_name}</td>
                    <td>{a.account_type}</td>
                    <td>${a.total_fee?.toFixed(2)}</td>
                    <td style={{ color: a.balance > 0 ? '#c62828' : '#2e7d32' }}>${a.balance?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Create Fee Account</h2>
              <form onSubmit={handleCreateAccount}>
                <label>Student ID</label>
                <input value={accForm.student_id} onChange={e => setAccForm({ ...accForm, student_id: e.target.value })} required />
                <label>Account Type</label>
                <select value={accForm.account_type} onChange={e => setAccForm({ ...accForm, account_type: e.target.value })}>
                  <option value="SDC">S.D.C</option>
                  <option value="SSF">S.S.F</option>
                </select>
                <label>Total Fee ($)</label>
                <input type="number" step="0.01" value={accForm.total_fee} onChange={e => setAccForm({ ...accForm, total_fee: e.target.value })} required />
                <div style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">Save</button>
                  <button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
