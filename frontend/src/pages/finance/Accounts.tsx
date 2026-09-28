import { useEffect, useState } from 'react';
import { accountsApi } from '../../services/api';
import { money } from '../../utils/money';

const TYPES = ['cash', 'bank', 'mobile', 'petty'];

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [ledger, setLedger] = useState<any>(null);
  const [ledgerAccount, setLedgerAccount] = useState<any>(null);

  const [form, setForm] = useState({ name: '', type: 'cash', account_no: '', currency: 'USD', opening_balance: '0' });
  const [transferForm, setTransferForm] = useState({
    tr_date: new Date().toISOString().slice(0, 10), from_account: '', to_account: '', amount: '', reference: '', notes: '',
  });

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 7000); };

  const load = () => {
    accountsApi.list().then((r) => {
      setAccounts(r.data);
      setTransferForm((f) => ({
        ...f,
        from_account: f.from_account || String(r.data[0]?.id || ''),
        to_account: f.to_account || String(r.data[1]?.id || r.data[0]?.id || ''),
      }));
      r.data.forEach((a: any) => {
        accountsApi.balance(a.id).then((res) => setBalances((prev) => ({ ...prev, [a.id]: res.data.balance })));
      });
    });
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', type: 'cash', account_no: '', currency: 'USD', opening_balance: '0' }); setShowForm(true); };
  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ name: a.name, type: a.type, account_no: a.account_no || '', currency: a.currency || 'USD', opening_balance: String(a.opening_balance) });
    setShowForm(true);
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      const payload = { name: form.name, type: form.type, account_no: form.account_no, currency: form.currency, opening_balance: parseFloat(form.opening_balance) || 0 };
      if (editing) { await accountsApi.update(editing.id, payload); showMsg('Account updated'); }
      else { await accountsApi.create(payload); showMsg('Account created'); }
      setShowForm(false); load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to save account', 'error'); }
  };

  const deactivate = async (a: any) => {
    if (!window.confirm(`Deactivate ${a.name}?`)) return;
    try { await accountsApi.deactivate(a.id); showMsg('Account deactivated'); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Failed', 'error'); }
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.from_account || !transferForm.to_account || !transferForm.amount) return;
    try {
      await accountsApi.transfer({
        tr_date: transferForm.tr_date, from_account: Number(transferForm.from_account), to_account: Number(transferForm.to_account),
        amount: parseFloat(transferForm.amount), reference: transferForm.reference, notes: transferForm.notes,
      });
      showMsg('Transfer recorded'); setShowTransfer(false);
      setTransferForm({ ...transferForm, amount: '', reference: '', notes: '' });
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Transfer failed', 'error'); }
  };

  const openLedger = async (a: any) => {
    setLedgerAccount(a);
    setLedger(null);
    const res = await accountsApi.ledger(a.id);
    setLedger(res.data);
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Cash &amp; Bank</h1>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button className="btn" onClick={() => setShowTransfer(true)}>Transfer Between Accounts</button>
          <button className="btn btn-primary" onClick={openNew}>New Account</button>
        </div>
      </div>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <h2>Accounts ({accounts.length}) — Total {money(totalBalance)}</h2>
        {accounts.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No accounts yet.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Account No.</th><th>Currency</th><th>Balance</th><th>Actions</th></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>{a.type}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{a.account_no || '-'}</td>
                  <td>{a.currency}</td>
                  <td style={{ fontWeight: 600, color: (balances[a.id] ?? 0) < 0 ? '#f87171' : undefined }}>
                    {balances[a.id] !== undefined ? money(balances[a.id], a.currency) : '…'}
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openLedger(a)}>Ledger</button>
                    <button className="btn btn-sm" onClick={() => openEdit(a)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => deactivate(a)}>Deactivate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edit Account' : 'New Account'}</h2>
            <form onSubmit={submitAccount}>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. CBZ School Account" />
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label>Account Number</label>
              <input value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
              <label>Currency</label>
              <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={{ width: 100 }} />
              <label>Opening Balance</label>
              <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
              <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransfer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Transfer Between Accounts</h2>
            <form onSubmit={submitTransfer}>
              <label>From</label>
              <select value={transferForm.from_account} onChange={(e) => setTransferForm({ ...transferForm, from_account: e.target.value })} required>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({money(balances[a.id] ?? 0, a.currency)})</option>)}
              </select>
              <label>To</label>
              <select value={transferForm.to_account} onChange={(e) => setTransferForm({ ...transferForm, to_account: e.target.value })} required>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <label>Amount</label>
              <input type="number" step="0.01" min="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} required />
              <label>Date</label>
              <input type="date" value={transferForm.tr_date} onChange={(e) => setTransferForm({ ...transferForm, tr_date: e.target.value })} required />
              <label>Reference</label>
              <input value={transferForm.reference} onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })} placeholder="Deposit slip number" />
              <label>Notes</label>
              <input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="e.g. Banked this week's cash" />
              <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Record Transfer</button>
                <button type="button" className="btn" onClick={() => setShowTransfer(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ledgerAccount && (
        <div className="modal-overlay" onClick={() => { setLedgerAccount(null); setLedger(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h2>Ledger: {ledgerAccount.name}</h2>
            {!ledger ? <p>Loading…</p> : (
              <table>
                <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Amount</th><th>Balance</th></tr></thead>
                <tbody>
                  <tr>
                    <td>-</td><td>-</td><td>-</td>
                    <td><em>Opening balance</em></td><td></td>
                    <td style={{ fontWeight: 600 }}>{money(ledger.opening_balance, ledgerAccount.currency)}</td>
                  </tr>
                  {ledger.rows.map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{r.date}</td>
                      <td>{r.type.replace('_', ' ')}</td>
                      <td>{r.reference}</td>
                      <td>{r.description}</td>
                      <td style={{ color: r.amount < 0 ? '#f87171' : '#4ade80' }}>{money(r.amount, ledgerAccount.currency)}</td>
                      <td style={{ fontWeight: 600 }}>{money(r.balance, ledgerAccount.currency)}</td>
                    </tr>
                  ))}
                  {ledger.rows.length === 0 && (
                    <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>No transactions recorded for this account yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
            <button className="btn" style={{ marginTop: '1rem' }} onClick={() => { setLedgerAccount(null); setLedger(null); }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
