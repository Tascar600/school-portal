import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { feesApi } from '../services/api';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';

export default function Fees() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [teacherView, setTeacherView] = useState<any[]>([]);
  const [accountType, setAccountType] = useState('SDC');
  const [amount, setAmount] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [showFeeSetup, setShowFeeSetup] = useState(false);
  const [feeForm, setFeeForm] = useState({ sdc_fee: '', ssf_fee: '' });
  const [currentSettings, setCurrentSettings] = useState<any>(null);
  const [showTermEnd, setShowTermEnd] = useState(false);
  const [termForm, setTermForm] = useState({ sdc_fee: '', ssf_fee: '' });
  const [showYearEnd, setShowYearEnd] = useState(false);
  const [loading, setLoading] = useState(false);

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => {
    setMsg(m); setMsgType(t);
    setTimeout(() => setMsg(''), 8000);
  };

  const load = () => {
    if (user?.role === 'student') feesApi.myAccounts().then(r => setAccounts(r.data));
    if (user?.role === 'admin') {
      feesApi.accounts().then(r => setAccounts(r.data));
      feesApi.pending().then(r => setPendingPayments(r.data));
      feesApi.stats().then(r => setStats(r.data));
      feesApi.getSettings().then(r => setCurrentSettings(r.data));
    }
    if (user?.role === 'teacher') {
      feesApi.teacherView().then(r => setTeacherView(r.data));
      feesApi.accounts().then(r => setAccounts(r.data));
    }
  };

  useEffect(() => { load(); }, [user]);

  const getBalance = (type: string) => {
    const acc = accounts.find((a: any) => a.account_type === type);
    return acc ? acc.balance : 0;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { showMsg('Please enter a valid amount', 'error'); return; }
    const balance = getBalance(accountType);
    if (parsedAmount > balance) { showMsg(`Max allowed: $${balance.toFixed(2)}`, 'error'); return; }
    const fd = new FormData();
    fd.append('account_type', accountType);
    fd.append('amount', amount);
    fd.append('receipt_number', receiptNumber);
    if (file) fd.append('proof', file);
    try {
      await feesApi.pay(fd);
      showMsg('Payment submitted for verification');
      setAmount(''); setFile(null); setReceiptNumber('');
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Payment failed', 'error'); }
  };

  const handleVerify = async (id: number, action: string) => {
    try { await feesApi.verify(id, action); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Error', 'error'); }
  };

  const handleUndo = async (id: number) => {
    try { await feesApi.undo(id); showMsg('Payment reverted to pending'); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Undo failed', 'error'); }
  };

  const handleSetFees = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await feesApi.setSettings({ sdc_fee: parseFloat(feeForm.sdc_fee), ssf_fee: parseFloat(feeForm.ssf_fee) });
      showMsg(res.data.message); setShowFeeSetup(false); load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Error', 'error'); }
    finally { setLoading(false); }
  };

  const handleTermEnd = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await feesApi.termEnd({ sdc_fee: parseFloat(termForm.sdc_fee), ssf_fee: parseFloat(termForm.ssf_fee) });
      showMsg(res.data.message); setShowTermEnd(false); load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Term end failed', 'error'); }
    finally { setLoading(false); }
  };

  const handleYearEnd = async () => {
    setLoading(true);
    try {
      const res = await feesApi.yearEnd(); showMsg(res.data.message); setShowYearEnd(false); load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Year end failed', 'error'); }
    finally { setLoading(false); }
  };

  const proofUrl = (path: string) => path || undefined;

  const renderBalance = (a: any) =>
    a.balance <= 0
      ? <span style={{ color: '#4ade80', fontWeight: 700 }}>FULLY PAID</span>
      : <span style={{ color: '#f87171', fontWeight: 600 }}>${a.balance?.toFixed(2)}</span>;

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { verified: '#4ade80', rejected: '#f87171', pending: '#fbbf24' };
    return <span style={{ background: `${colors[s]}22`, color: colors[s], padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem' }}>{s}</span>;
  };

  // ─── STUDENT ───────────────────────────────────────
  if (user?.role === 'student') {
    const csvData: Record<string, any>[] = [];
    for (const a of accounts) {
      csvData.push({ Account: a.account_type, 'Total Fee': a.total_fee?.toFixed(2), Balance: a.balance?.toFixed(2), Status: a.balance <= 0 ? 'FULLY PAID' : 'Owing' });
      if (a.payments) for (const p of a.payments) csvData.push({ Payment: `$${p.amount?.toFixed(2)}`, Status: p.status, Receipt: p.receipt_number || '-', Date: new Date(p.created_at).toLocaleDateString() });
    }
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>School Fees</h1>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <PrintButton />
            <DownloadCSV data={csvData} headers={['Account', 'Total Fee', 'Balance', 'Status', 'Payment', 'Receipt', 'Date']} filename="my-fees" label=" CSV" />
          </div>
        </div>
        {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}
        {accounts.map((a: any) => (
          <div key={a.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div><h2 style={{ margin: 0 }}>Account: {a.account_type}</h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Total Fee: <strong style={{ color: '#fff' }}>${a.total_fee?.toFixed(2)}</strong></p></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{renderBalance(a)}</div></div>
            </div>
            <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--neon)' }}>Payment History</h3>
            {(!a.payments || a.payments.length === 0) ? <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No payments recorded yet.</p> : (
              <table>
                <thead><tr><th>Amount</th><th>Receipt #</th><th>Status</th><th>Date</th><th>Proof</th></tr></thead>
                <tbody>
                  {a.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</td>
                      <td>{p.receipt_number || '-'}</td>
                      <td>{statusBadge(p.status)}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td>{p.proof_file ? <a href={proofUrl(p.proof_file)} target="_blank" rel="noreferrer" style={{ color: 'var(--neon)' }}>View</a> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {accounts.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '2rem' }}><p style={{ color: 'var(--text-dim)' }}>No fee accounts set up yet.</p></div>}
        {accounts.length > 0 && (
          <div className="card">
            <h2>Make Payment</h2>
            <form onSubmit={handlePay}>
              <label>Account Type</label>
              <select value={accountType} onChange={e => { setAccountType(e.target.value); setAmount(''); }}>
                {accounts.map((a: any) => <option key={a.account_type} value={a.account_type}>{a.account_type} (Balance: ${a.balance?.toFixed(2)})</option>)}
              </select>
              <label>Amount ($)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder={`Max: $${getBalance(accountType).toFixed(2)}`} />
                <button type="button" className="btn btn-sm" style={{ fontSize: '0.8rem' }} onClick={() => setAmount(getBalance(accountType).toString())}>Max</button>
              </div>
              <label>Receipt Number</label>
              <input type="text" value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} placeholder="Enter receipt number" />
              <label>Upload Proof (optional)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
              <button type="submit" className="btn btn-primary">Submit Payment</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ─── TEACHER ───────────────────────────────────────
  if (user?.role === 'teacher') {
    const csvData = teacherView.flatMap((s: any) => [
      { Student: s.name, Account: 'SDC', 'Total Fee': s.sdc?.totalFee?.toFixed(2) || '-', Paid: s.sdc?.paid?.toFixed(2) || '-', Balance: s.sdc?.balance?.toFixed(2) || '-', Status: s.sdc?.balance <= 0 ? 'PAID' : 'OWING' },
      { Student: s.name, Account: 'SSF', 'Total Fee': s.ssf?.totalFee?.toFixed(2) || '-', Paid: s.ssf?.paid?.toFixed(2) || '-', Balance: s.ssf?.balance?.toFixed(2) || '-', Status: s.ssf?.balance <= 0 ? 'PAID' : 'OWING' },
    ]);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Class Fee Report</h1>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <PrintButton />
            <DownloadCSV data={csvData} headers={['Student', 'Account', 'Total Fee', 'Paid', 'Balance', 'Status']} filename="class-fees" label=" CSV" />
          </div>
        </div>
        {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}
        <div className="card">
          <h2>Per-Student Breakdown</h2>
          {teacherView.length === 0 ? <p>No students in your class.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Total Fee</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>
                {teacherView.map((s: any) => (
                  <>
                    <tr key={`${s.id}-sdc`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ fontWeight: 600, verticalAlign: 'middle' }} rowSpan={2}>{s.name}</td>
                      <td>SDC</td>
                      <td>${s.sdc?.totalFee?.toFixed(2) || '0.00'}</td>
                      <td style={{ color: '#4ade80' }}>${s.sdc?.paid?.toFixed(2) || '0.00'}</td>
                      <td>{s.sdc?.balance <= 0 ? <span style={{ color: '#4ade80' }}>FULLY PAID</span> : <span style={{ color: '#f87171' }}>${s.sdc?.balance?.toFixed(2)}</span>}</td>
                      <td>{s.sdc?.balance <= 0 ? <span style={{ color: '#4ade80' }}>✓ PAID</span> : <span style={{ color: '#f87171' }}>✗ OWING</span>}</td>
                    </tr>
                    <tr key={`${s.id}-ssf`}>
                      <td>SSF</td>
                      <td>${s.ssf?.totalFee?.toFixed(2) || '0.00'}</td>
                      <td style={{ color: '#4ade80' }}>${s.ssf?.paid?.toFixed(2) || '0.00'}</td>
                      <td>{s.ssf?.balance <= 0 ? <span style={{ color: '#4ade80' }}>FULLY PAID</span> : <span style={{ color: '#f87171' }}>${s.ssf?.balance?.toFixed(2)}</span>}</td>
                      <td>{s.ssf?.balance <= 0 ? <span style={{ color: '#4ade80' }}>✓ PAID</span> : <span style={{ color: '#f87171' }}>✗ OWING</span>}</td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h2>All Fee Transactions</h2>
          {accounts.length === 0 ? <p>No transactions yet.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Total</th><th>Balance</th><th>Payments</th></tr></thead>
              <tbody>{accounts.map((a: any) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                  <td>{a.account_type}</td>
                  <td>${a.total_fee?.toFixed(2)}</td>
                  <td>{renderBalance(a)}</td>
                  <td style={{ minWidth: 180 }}>
                    {a.payments?.length ? a.payments.map((p: any) => (
                      <div key={p.id} style={{ fontSize: '0.8rem', marginBottom: '0.2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</span> {statusBadge(p.status)}
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginLeft: '0.3rem' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                        {p.receipt_number && <span style={{ color: 'var(--neon)', fontSize: '0.7rem', marginLeft: '0.3rem' }}>#{p.receipt_number}</span>}
                      </div>
                    )) : <span style={{ color: 'var(--text-dim)' }}>None</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ─── ADMIN ─────────────────────────────────────────
  if (user?.role === 'admin') {
    const isConfigured = currentSettings?.sdc_fee && currentSettings?.ssf_fee;
    const allCsv = accounts.flatMap((a: any) => {
      const rows: Record<string, any>[] = [{ Student: a.student_name, Account: a.account_type, 'Total Fee': a.total_fee?.toFixed(2), Balance: a.balance?.toFixed(2), Status: a.balance <= 0 ? 'FULLY PAID' : 'Owing' }];
      if (a.payments) for (const p of a.payments) rows.push({ Payment: `$${p.amount?.toFixed(2)}`, Status: p.status, Receipt: p.receipt_number || '-', Date: new Date(p.created_at).toLocaleDateString() });
      return rows;
    });
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Fee Management</h1>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <PrintButton />
            <DownloadCSV data={allCsv} headers={['Student', 'Account', 'Total Fee', 'Balance', 'Status', 'Payment', 'Receipt', 'Date']} filename="all-fees" label=" CSV" />
          </div>
        </div>
        {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

        {/* Action Buttons */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={() => { setFeeForm({ sdc_fee: currentSettings?.sdc_fee?.toString() || '', ssf_fee: currentSettings?.ssf_fee?.toString() || '' }); setShowFeeSetup(true); }}>
            {isConfigured ? 'Update Fee Amounts' : 'Set Fee Amounts'}
          </button>
          <button className="btn btn-warning" disabled={!isConfigured} onClick={() => { setTermForm({ sdc_fee: currentSettings?.sdc_fee?.toString() || '', ssf_fee: currentSettings?.ssf_fee?.toString() || '' }); setShowTermEnd(true); }}> Term End</button>
          <button className="btn btn-danger" onClick={() => setShowYearEnd(true)}> Year End</button>
        </div>

        {!isConfigured && <div className="card" style={{ textAlign: 'center', padding: '2rem', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p style={{ color: '#fbbf24', fontWeight: 600 }}>No fee amounts set yet.</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Click "Set Fee Amounts" to configure.</p>
        </div>}

        {isConfigured && <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>Current Fees:</span> SDC <strong>${currentSettings.sdc_fee?.toFixed(2)}</strong> | SSF <strong>${currentSettings.ssf_fee?.toFixed(2)}</strong>
        </div>}

        {/* Statistics */}
        {stats && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { label: 'Total SDC Fees', value: `$${stats.sdc.total.toFixed(2)}`, color: '#60a5fa' },
            { label: 'SDC Outstanding', value: `$${stats.sdc.outstanding.toFixed(2)}`, color: '#f87171' },
            { label: 'SDC Fully Paid', value: `${stats.sdc.fullyPaid}/${stats.sdc.accounts}`, color: '#4ade80' },
            { label: 'Total SSF Fees', value: `$${stats.ssf.total.toFixed(2)}`, color: '#60a5fa' },
            { label: 'SSF Outstanding', value: `$${stats.ssf.outstanding.toFixed(2)}`, color: '#f87171' },
            { label: 'SSF Fully Paid', value: `${stats.ssf.fullyPaid}/${stats.ssf.accounts}`, color: '#4ade80' },
            { label: 'Collected (Verified)', value: `$${stats.totalCollected.toFixed(2)}`, color: '#fbbf24' },
            { label: 'Pending Verify', value: `${stats.pendingVerifications}`, color: '#fb923c' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>{s.label}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>}

        {/* Pending Payments */}
        <div className="card">
          <h2>Pending Payments ({pendingPayments.length})</h2>
          {pendingPayments.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No pending payments.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Amount</th><th>Receipt #</th><th>Proof</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>{pendingPayments.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                  <td>{p.account_type}</td>
                  <td style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</td>
                  <td>{p.receipt_number || '-'}</td>
                  <td>{p.proof_file ? <a href={proofUrl(p.proof_file)} target="_blank" rel="noreferrer" style={{ color: 'var(--neon)' }}>View</a> : <span style={{ color: 'var(--text-dim)' }}>No file</span>}</td>
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

        {/* All Accounts */}
        <div className="card">
          <h2>All Fee Accounts ({accounts.length})</h2>
          {accounts.length === 0 ? <p>No accounts yet.</p> : (
            <table>
              <thead><tr><th>Student</th><th>Account</th><th>Total</th><th>Balance</th><th>Payment History</th></tr></thead>
              <tbody>{accounts.map((a: any) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                  <td>{a.account_type}</td>
                  <td>${a.total_fee?.toFixed(2)}</td>
                  <td>{renderBalance(a)}</td>
                  <td style={{ minWidth: 220 }}>
                    {a.payments?.length ? a.payments.map((p: any) => (
                      <div key={p.id} style={{ fontSize: '0.8rem', marginBottom: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>${p.amount?.toFixed(2)}</span> {statusBadge(p.status)}
                          {p.receipt_number && <span style={{ color: 'var(--neon)', fontSize: '0.7rem', marginLeft: '0.3rem' }}>#{p.receipt_number}</span>}
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{new Date(p.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.2rem' }}>
                          {p.status !== 'pending' && <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '1px 4px' }} onClick={() => handleUndo(p.id)} title="Revert to pending">↩</button>}
                          {p.proof_file && <a href={proofUrl(p.proof_file)} target="_blank" rel="noreferrer" style={{ color: 'var(--neon)', fontSize: '0.7rem', textDecoration: 'none', padding: '1px 4px' }}>📎</a>}
                        </div>
                      </div>
                    )) : <span style={{ color: 'var(--text-dim)' }}>None</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {/* Modals */}
        {showFeeSetup && <div className="modal-overlay" onClick={() => setShowFeeSetup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{isConfigured ? 'Update Fee Amounts' : 'Set Fee Amounts'}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Visible to all students. Accounts auto-created.</p>
            <form onSubmit={handleSetFees}>
              <label>SDC Fee ($)</label>
              <input type="number" step="0.01" value={feeForm.sdc_fee} onChange={e => setFeeForm({ ...feeForm, sdc_fee: e.target.value })} required />
              <label>SSF Fee ($)</label>
              <input type="number" step="0.01" value={feeForm.ssf_fee} onChange={e => setFeeForm({ ...feeForm, ssf_fee: e.target.value })} required />
              <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-success" disabled={loading}>{loading ? 'Saving...' : isConfigured ? 'Update' : 'Set Fees'}</button>
                <button type="button" className="btn" onClick={() => setShowFeeSetup(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>}
        {showTermEnd && <div className="modal-overlay" onClick={() => setShowTermEnd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Term End — New Fees</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Resets accounts. Credits carry forward.</p>
            <form onSubmit={handleTermEnd}>
              <label>SDC Fee ($)</label>
              <input type="number" step="0.01" value={termForm.sdc_fee} onChange={e => setTermForm({ ...termForm, sdc_fee: e.target.value })} required />
              <label>SSF Fee ($)</label>
              <input type="number" step="0.01" value={termForm.ssf_fee} onChange={e => setTermForm({ ...termForm, ssf_fee: e.target.value })} required />
              <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-warning" disabled={loading}>{loading ? 'Processing...' : ' End Term'}</button>
                <button type="button" className="btn" onClick={() => setShowTermEnd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>}
        {showYearEnd && <div className="modal-overlay" onClick={() => setShowYearEnd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Year End — Promote</h2>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
              <strong style={{ color: '#f87171' }}>⚠ Warning</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                <li>All students move to next class</li>
                <li>Final class students graduate</li>
                <li>Teacher assignments reset</li>
                <li>Cannot be undone</li>
              </ul>
            </div>
            <button className="btn btn-danger" onClick={handleYearEnd} disabled={loading}>{loading ? 'Processing...' : ' Confirm Year End'}</button>
            <button className="btn" onClick={() => setShowYearEnd(false)}>Cancel</button>
          </div>
        </div>}
      </div>
    );
  }

  return null;
}
