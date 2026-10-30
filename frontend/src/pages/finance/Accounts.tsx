import { useEffect, useState } from 'react';
import { accountsApi } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDate, fmtRange, todayIso, addDays } from '../../utils/dates';
import { useAuth } from '../../contexts/AuthContext';
import PrintHeader from '../../components/PrintHeader';
import FinanceTabs from '../../components/FinanceTabs';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

const TYPES = ['cash', 'bank', 'mobile', 'petty'];
const TYPE_LABEL: Record<string, string> = { cash: 'Cash on hand', bank: 'Bank account', mobile: 'Mobile money', petty: 'Petty cash' };

export default function Accounts() {
  const { user } = useAuth();
  const canEdit = user?.role === 'bursary';
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [book, setBook] = useState<any>(null);        // the cash book being viewed
  const [bookRange, setBookRange] = useState({ from: addDays(todayIso(), -29), to: todayIso() });
  const [form, setForm] = useState({ name: '', type: 'cash', account_no: '', currency: 'USD', opening_balance: '0' });
  const [tr, setTr] = useState({ tr_date: todayIso(), from_account: '', to_account: '', amount: '', reference: '', notes: '' });

  const notify = (text: string, type: 'info' | 'error' = 'info') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 8000); };
  const load = () => accountsApi.list().then((r) => {
    setAccounts(r.data);
    setTr((f) => ({ ...f, from_account: f.from_account || String(r.data[0]?.id || ''), to_account: f.to_account || String(r.data[1]?.id || r.data[0]?.id || '') }));
    r.data.forEach((a: any) => accountsApi.balance(a.id).then((res) => setBalances((p) => ({ ...p, [a.id]: res.data.balance }))));
  });
  useEffect(() => { load(); }, []);

  const openBook = async (a: any, range = bookRange) => { setBook({ account: a, loading: true }); const r = await accountsApi.ledger(a.id, range); setBook({ account: a, ...r.data }); };
  useEffect(() => { if (book?.account) openBook(book.account, bookRange); }, [bookRange.from, bookRange.to]);

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name: form.name, type: form.type, account_no: form.account_no, currency: form.currency, opening_balance: parseFloat(form.opening_balance) || 0 };
      if (editing) { await accountsApi.update(editing.id, payload); notify('Account updated'); } else { await accountsApi.create(payload); notify('Account created'); }
      setShowForm(false); load();
    } catch (err: any) { notify(err.response?.data?.message || 'Could not save the account', 'error'); }
  };
  const deactivate = async (a: any) => { if (!window.confirm(`Stop using ${a.name}? Its past records stay.`)) return; await accountsApi.deactivate(a.id); load(); };
  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await accountsApi.transfer({ ...tr, from_account: Number(tr.from_account), to_account: Number(tr.to_account), amount: parseFloat(tr.amount) }); notify('Transfer recorded'); setShowTransfer(false); setTr({ ...tr, amount: '', reference: '', notes: '' }); load(); }
    catch (err: any) { notify(err.response?.data?.message || 'Transfer failed', 'error'); }
  };

  const total = accounts.reduce((s, a) => s + (balances[a.id] || 0), 0);

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title={book ? `Cash book – ${book.account.name}` : 'Cash and bank balances'} period={book ? fmtRange(bookRange.from, bookRange.to) : `as at ${fmtDate(todayIso())}`} />
      <div className="page-head no-print">
        <div><h1>Cash and bank</h1><p>Where the school's money is kept, with a dated cash book for each account.</p></div>
        <div className="toolbar">{canEdit && <><button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', type: 'cash', account_no: '', currency: 'USD', opening_balance: '0' }); setShowForm(true); }}>New account</button><button className="btn" onClick={() => setShowTransfer(true)}>Move money between accounts</button></>}<PrintButton /></div>
      </div>
      {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

      <div className="card table-wrap">
        <h2>Accounts {'–'} total {money(total)}</h2>
        <table>
          <thead><tr><th>Account</th><th>Kind</th><th>Number</th><th>Currency</th><th className="num">Balance today</th><th className="no-print" /></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.name}</td><td>{TYPE_LABEL[a.type] || a.type}</td><td className="muted">{a.account_no || '-'}</td><td>{a.currency}</td>
                <td className="num" style={{ fontWeight: 700, color: (balances[a.id] ?? 0) < 0 ? 'var(--danger)' : undefined }}>{balances[a.id] !== undefined ? money(balances[a.id], a.currency) : '…'}</td>
                <td className="no-print nowrap"><button className="btn btn-sm btn-primary" onClick={() => openBook(a)}>Cash book</button>{canEdit && <><button className="btn btn-sm" onClick={() => { setEditing(a); setForm({ name: a.name, type: a.type, account_no: a.account_no || '', currency: a.currency || 'USD', opening_balance: String(a.opening_balance) }); setShowForm(true); }}>Edit</button><button className="btn btn-sm btn-danger" onClick={() => deactivate(a)}>Stop using</button></>}</td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={6} className="muted">No accounts yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {book && !book.loading && (
        <div className="card table-wrap">
          <div className="page-head" style={{ marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, border: 0 }}>Cash book {'–'} {book.account.name}</h2>
            <div className="toolbar no-print">
              <input type="date" value={bookRange.from} onChange={(e) => setBookRange({ ...bookRange, from: e.target.value })} style={{ width: 'auto', margin: 0 }} aria-label="From" />
              <span className="muted">to</span>
              <input type="date" value={bookRange.to} onChange={(e) => setBookRange({ ...bookRange, to: e.target.value })} style={{ width: 'auto', margin: 0 }} aria-label="To" />
              <PrintButton />
              <DownloadCSV filename={`cashbook-${book.account.name}`} headers={['Date', 'Type', 'Reference', 'Description', 'In', 'Out', 'Balance']} data={book.rows.map((r: any) => ({ Date: r.date, Type: r.type.replace('_', ' '), Reference: r.reference, Description: r.description, In: r.amount > 0 ? r.amount.toFixed(2) : '', Out: r.amount < 0 ? (-r.amount).toFixed(2) : '', Balance: r.balance.toFixed(2) }))} />
              <button className="btn" onClick={() => setBook(null)}>Close</button>
            </div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th className="num">Money in</th><th className="num">Money out</th><th className="num">Balance</th></tr></thead>
            <tbody>
              <tr><td colSpan={6} className="muted">Balance brought forward ({fmtDate(bookRange.from)})</td><td className="num"><strong>{money(book.opening_balance, book.account.currency)}</strong></td></tr>
              {book.rows.map((r: any, i: number) => (
                <tr key={i}><td className="nowrap">{fmtDate(r.date)}</td><td style={{ textTransform: 'capitalize' }}>{r.type.replace('_', ' ')}</td><td>{r.reference}</td><td>{r.description}</td>
                  <td className="num" style={{ color: 'var(--success)' }}>{r.amount > 0 ? money(r.amount, book.account.currency) : ''}</td><td className="num" style={{ color: 'var(--danger)' }}>{r.amount < 0 ? money(-r.amount, book.account.currency) : ''}</td><td className="num">{money(r.balance, book.account.currency)}</td></tr>
              ))}
              {book.rows.length === 0 && <tr><td colSpan={7} className="muted">Nothing went in or out of this account in this period.</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={4}>Totals for {fmtRange(bookRange.from, bookRange.to)}</td><td className="num">{money(book.inflow, book.account.currency)}</td><td className="num">{money(book.outflow, book.account.currency)}</td><td className="num">{money(book.closing_balance, book.account.currency)}</td></tr></tfoot>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveAccount}>
            <h2>{editing ? 'Edit account' : 'New account'}</h2>
            <label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. CBZ School Account" />
            <div className="form-row"><div><label>Kind</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></div><div><label>Currency</label><input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div></div>
            <label>Account number</label><input value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
            <label>Opening balance</label><input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
            <button type="submit" className="btn btn-primary">Save</button><button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {showTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransfer(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitTransfer}>
            <h2>Move money between accounts</h2>
            <div className="form-row"><div><label>From</label><select value={tr.from_account} onChange={(e) => setTr({ ...tr, from_account: e.target.value })} required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({money(balances[a.id] ?? 0, a.currency)})</option>)}</select></div>
              <div><label>To</label><select value={tr.to_account} onChange={(e) => setTr({ ...tr, to_account: e.target.value })} required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></div>
            <div className="form-row"><div><label>Amount</label><input type="number" step="0.01" min="0.01" value={tr.amount} onChange={(e) => setTr({ ...tr, amount: e.target.value })} required /></div><div><label>Date</label><input type="date" value={tr.tr_date} max={todayIso()} onChange={(e) => setTr({ ...tr, tr_date: e.target.value })} required /></div></div>
            <label>Reference (e.g. deposit slip no.)</label><input value={tr.reference} onChange={(e) => setTr({ ...tr, reference: e.target.value })} />
            <label>Notes</label><input value={tr.notes} onChange={(e) => setTr({ ...tr, notes: e.target.value })} placeholder="e.g. Banked this week's cash" />
            <button type="submit" className="btn btn-primary">Record</button><button type="button" className="btn" onClick={() => setShowTransfer(false)}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
}
