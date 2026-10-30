import { useEffect, useMemo, useState } from 'react';
import { expenseCategoriesApi, expensesApi, accountsApi, openPdf } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDate, fmtRange, todayIso } from '../../utils/dates';
import { useAuth } from '../../contexts/AuthContext';
import PeriodBar, { usePeriod } from '../../components/PeriodBar';
import PrintHeader from '../../components/PrintHeader';
import FinanceTabs from '../../components/FinanceTabs';
import StatusBadge from '../../components/StatusBadge';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

export default function Expenses() {
  const { user } = useAuth();
  const canEdit = user?.role === 'bursary';
  const state = usePeriod('term');
  const { period } = state;
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fCat, setFCat] = useState('');
  const [fAcc, setFAcc] = useState('');
  const [fStatus, setFStatus] = useState('active');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [catName, setCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ exp_date: todayIso(), category_id: '', account_id: '', payee: '', description: '', amount: '', reference: '' });

  const notify = (text: string, type: 'info' | 'error' = 'info') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 8000); };
  const load = () => expensesApi.list({ from: period.from, to: period.to, category_id: fCat || undefined, account_id: fAcc || undefined, status: fStatus || undefined }).then((r) => setExpenses(r.data));
  useEffect(() => { load(); }, [period.from, period.to, fCat, fAcc, fStatus]);
  useEffect(() => {
    expenseCategoriesApi.list().then((r) => setCategories(r.data));
    accountsApi.list().then((r) => { setAccounts(r.data); if (r.data.length) setForm((f) => ({ ...f, account_id: String(r.data[0].id) })); });
  }, []);

  const shown = useMemo(() => expenses.filter((x) => !q || [x.payee, x.description, x.voucher_no, x.reference].some((t) => (t || '').toLowerCase().includes(q.toLowerCase()))), [expenses, q]);
  const active = shown.filter((x) => x.status === 'active');
  const total = active.reduce((s, x) => s + x.amount, 0);
  const byCat = useMemo(() => { const m = new Map<string, number>(); active.forEach((x) => m.set(x.category_name || 'Uncategorised', (m.get(x.category_name || 'Uncategorised') || 0) + x.amount)); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [active]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const r = await expensesApi.create({ exp_date: form.exp_date, category_id: form.category_id ? Number(form.category_id) : null, account_id: Number(form.account_id), payee: form.payee, description: form.description, amount: parseFloat(form.amount), reference: form.reference });
      notify(r.data.message); setShowNew(false); setForm({ ...form, payee: '', description: '', amount: '', reference: '' }); load();
      if (window.confirm('Voucher saved. Print the payment voucher now?')) openPdf(`/expenses/${r.data.id}/voucher.pdf`);
    } catch (err: any) { notify(err.response?.data?.message || 'Could not save the expense', 'error'); } finally { setSaving(false); }
  };
  const cancel = async (x: any) => {
    const reason = window.prompt(`Why is voucher ${x.voucher_no} being cancelled? (This is kept on record.)`); if (!reason) return;
    try { await expensesApi.cancel(x.id, reason); notify('Voucher cancelled'); load(); } catch (err: any) { notify(err.response?.data?.message || 'Cancel failed', 'error'); }
  };
  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault(); if (!catName.trim()) return;
    try { await expenseCategoriesApi.create({ name: catName.trim() }); setCatName(''); expenseCategoriesApi.list().then((r) => setCategories(r.data)); notify('Category added'); }
    catch (err: any) { notify(err.response?.data?.message || 'Could not add the category', 'error'); }
  };
  const toggleCat = async (c: any) => { await expenseCategoriesApi.update(c.id, { name: c.name, active: !c.active }); expenseCategoriesApi.list().then((r) => setCategories(r.data)); };

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title="Expenses (payment vouchers)" period={fmtRange(period.from, period.to)} />
      <div className="page-head no-print">
        <div><h1>Expenses</h1><p>Money the school has spent. Every expense is a numbered payment voucher you can print.</p></div>
        <div className="toolbar">{canEdit && <><button className="btn btn-primary" onClick={() => setShowNew(true)}>New expense</button><button className="btn" onClick={() => setShowCats(true)}>Categories</button></>}</div>
      </div>
      {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

      <PeriodBar state={state}>
        <div><label>Category</label><select value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label>Paid from</label><select value={fAcc} onChange={(e) => setFAcc(e.target.value)}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label>Status</label><select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="active">Valid</option><option value="cancelled">Cancelled</option><option value="">All</option></select></div>
        <div><label>Search</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="payee, voucher, description" /></div>
      </PeriodBar>

      {byCat.length > 0 && (
        <div className="grid">
          <div className="kpi warn"><div className="kpi-value">{money(total)}</div><div className="kpi-label">Spent in this period</div><div className="kpi-delta">{active.length} voucher{active.length === 1 ? '' : 's'}</div></div>
          {byCat.slice(0, 4).map(([name, amt]) => <div className="kpi" key={name}><div className="kpi-value">{money(amt)}</div><div className="kpi-label">{name}</div><div className="kpi-delta">{Math.round((amt / total) * 100)}% of spending</div></div>)}
        </div>
      )}

      <div className="card table-wrap">
        <div className="page-head" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, border: 0 }}>Vouchers ({shown.length})</h2>
          <div className="toolbar no-print"><PrintButton /><DownloadCSV filename={`expenses-${period.from}-to-${period.to}`} headers={['Date', 'Voucher', 'Paid to', 'Description', 'Category', 'Account', 'Amount', 'Status']} data={shown.map((x) => ({ Date: x.exp_date, Voucher: x.voucher_no, 'Paid to': x.payee, Description: x.description, Category: x.category_name || '', Account: x.account_name || '', Amount: x.amount.toFixed(2), Status: x.status }))} /></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Voucher</th><th>Paid to / for</th><th>Category</th><th>Paid from</th><th className="num">Amount</th><th>Status</th><th className="no-print" /></tr></thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} style={x.status === 'cancelled' ? { opacity: 0.6 } : undefined}>
                <td className="nowrap">{fmtDate(x.exp_date)}</td><td>{x.voucher_no}</td>
                <td style={{ fontWeight: 600 }}>{x.payee}<div className="muted small" style={{ fontWeight: 400 }}>{x.description}{x.reference ? ` · ref ${x.reference}` : ''}</div></td>
                <td>{x.category_name || '-'}</td><td>{x.account_name || '-'}</td><td className="num"><strong>{money(x.amount)}</strong></td>
                <td><StatusBadge status={x.status} />{x.cancel_reason && <div className="muted small">{x.cancel_reason}</div>}</td>
                <td className="no-print nowrap"><button className="btn btn-sm" onClick={() => openPdf(`/expenses/${x.id}/voucher.pdf`)}>Voucher</button>{canEdit && x.status === 'active' && <button className="btn btn-sm btn-danger" onClick={() => cancel(x)}>Cancel</button>}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={8} className="muted">No expenses in this period.</td></tr>}
          </tbody>
          {active.length > 0 && <tfoot><tr><td colSpan={5}>Total of valid vouchers</td><td className="num">{money(total)}</td><td colSpan={2} /></tr></tfoot>}
        </table>
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2>New expense</h2>
            <div className="form-row"><div><label>Date</label><input type="date" value={form.exp_date} max={todayIso()} onChange={(e) => setForm({ ...form, exp_date: e.target.value })} required /></div>
              <div><label>Category</label><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Choose…</option>{categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
            <label>Paid from</label><select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <label>Paid to (payee)</label><input value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} placeholder="e.g. ZESA, Kadoma Stationers" required />
            <label>What was it for?</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Electricity for September" required />
            <div className="form-row"><div><label>Amount (USD)</label><input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
              <div><label>Invoice / reference no.</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</button><button type="button" className="btn" onClick={() => setShowNew(false)}>Cancel</button>
          </form>
        </div>
      )}

      {showCats && (
        <div className="modal-overlay" onClick={() => setShowCats(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Expense categories</h2>
            <table><thead><tr><th>Name</th><th>Status</th><th /></tr></thead><tbody>{categories.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.active ? 'In use' : 'Hidden'}</td><td><button className="btn btn-sm" onClick={() => toggleCat(c)}>{c.active ? 'Hide' : 'Show'}</button></td></tr>)}</tbody></table>
            <form className="inline-form" style={{ marginTop: '1rem' }} onSubmit={addCategory}><div style={{ flex: 1 }}><label>New category</label><input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Utilities" /></div><button type="submit" className="btn btn-primary">Add</button></form>
            <button className="btn" style={{ marginTop: '1rem' }} onClick={() => setShowCats(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
