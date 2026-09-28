import { useEffect, useState } from 'react';
import { termsApi, expenseCategoriesApi, expensesApi, accountsApi } from '../../services/api';
import { money } from '../../utils/money';
import StatusBadge from '../../components/StatusBadge';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

export default function Expenses() {
  const [terms, setTerms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [categoryName, setCategoryName] = useState('');

  const [form, setForm] = useState({
    exp_date: new Date().toISOString().slice(0, 10), category_id: '', account_id: '',
    payee: '', description: '', amount: '', reference: '',
  });

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 7000); };

  const loadExpenses = () => {
    const params: any = {};
    if (termId) params.term_id = termId;
    if (categoryId) params.category_id = categoryId;
    if (accountId) params.account_id = accountId;
    if (status) params.status = status;
    if (q) params.q = q;
    expensesApi.list(params).then((r) => setExpenses(r.data));
  };

  useEffect(() => {
    termsApi.list().then((r) => {
      setTerms(r.data);
      const current = r.data.find((t: any) => t.is_current)?.id || r.data[0]?.id || null;
      setTermId(current);
    });
    expenseCategoriesApi.list().then((r) => setCategories(r.data));
    accountsApi.list().then((r) => {
      setAccounts(r.data);
      if (r.data.length) setForm((f) => ({ ...f, account_id: String(r.data[0].id) }));
    });
  }, []);

  useEffect(() => { loadExpenses(); }, [termId, categoryId, accountId, status]);

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_id || !form.amount) return;
    setSubmitting(true);
    try {
      const res = await expensesApi.create({
        exp_date: form.exp_date, term_id: termId, category_id: form.category_id ? Number(form.category_id) : null,
        account_id: Number(form.account_id), payee: form.payee, description: form.description,
        amount: parseFloat(form.amount), reference: form.reference,
      });
      showMsg(res.data.message);
      setShowNew(false);
      setForm({ ...form, payee: '', description: '', amount: '', reference: '' });
      loadExpenses();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to save expense', 'error'); }
    finally { setSubmitting(false); }
  };

  const cancelExpense = async (x: any) => {
    const reason = window.prompt(`Reason for cancelling ${x.voucher_no}?`);
    if (!reason) return;
    try { await expensesApi.cancel(x.id, reason); showMsg('Expense cancelled'); loadExpenses(); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Cancel failed', 'error'); }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    try {
      await expenseCategoriesApi.create({ name: categoryName.trim() });
      setCategoryName('');
      expenseCategoriesApi.list().then((r) => setCategories(r.data));
      showMsg('Category added');
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to add category', 'error'); }
  };

  const toggleCategoryActive = async (c: any) => {
    try {
      await expenseCategoriesApi.update(c.id, { name: c.name, active: !c.active });
      expenseCategoriesApi.list().then((r) => setCategories(r.data));
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed', 'error'); }
  };

  const csvData = expenses.map((x) => ({
    Voucher: x.voucher_no, Date: x.exp_date, Payee: x.payee, Category: x.category_name || '',
    Account: x.account_name || '', Amount: x.amount.toFixed(2), Status: x.status,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Expenses</h1>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          <PrintButton />
          <DownloadCSV data={csvData} headers={['Voucher', 'Date', 'Payee', 'Category', 'Account', 'Amount', 'Status']} filename="expenses" label=" CSV" />
          <button className="btn" onClick={() => setShowCategories(true)}>Categories</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>New Expense</button>
        </div>
      </div>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Term</label>
            <select value={termId || ''} onChange={(e) => setTermId(Number(e.target.value))}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.year} Term {t.term_no}{t.is_locked ? ' (locked)' : ''}</option>)}
            </select>
          </div>
          <div><label>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label>Account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div><label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ minWidth: 200 }}><label>Search</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadExpenses()} placeholder="Voucher, payee, description…" />
          </div>
          <button className="btn" onClick={loadExpenses}>Search</button>
        </div>
      </div>

      <div className="card">
        <h2>Vouchers ({expenses.length})</h2>
        {expenses.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No expenses recorded yet.</p> : (
          <table>
            <thead><tr><th>Voucher</th><th>Date</th><th>Paid to</th><th>Category</th><th>Account</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {expenses.map((x) => (
                <tr key={x.id}>
                  <td>{x.voucher_no}</td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{x.exp_date}</td>
                  <td style={{ fontWeight: 600 }}>{x.payee}<br /><small style={{ color: 'var(--text-dim)', fontWeight: 400 }}>{x.description}</small></td>
                  <td>{x.category_name || '-'}</td>
                  <td>{x.account_name || '-'}</td>
                  <td>{money(x.amount)}</td>
                  <td><StatusBadge status={x.status} /></td>
                  <td>{x.status === 'active' && <button className="btn btn-sm btn-danger" onClick={() => cancelExpense(x)}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Expense</h2>
            <form onSubmit={submitExpense}>
              <label>Date</label>
              <input type="date" value={form.exp_date} onChange={(e) => setForm({ ...form, exp_date: e.target.value })} required />
              <label>Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Choose…</option>
                {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label>Paid from</label>
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <label>Paid to (payee)</label>
              <input value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} placeholder="e.g. ZESA, Kadoma Stationers" required />
              <label>What was it for?</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Electricity for September" required />
              <label>Amount ($)</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              <label>Reference / invoice no.</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save Expense'}</button>
                <button type="button" className="btn" onClick={() => setShowNew(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategories && (
        <div className="modal-overlay" onClick={() => setShowCategories(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Expense Categories</h2>
            <table>
              <thead><tr><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.active ? 'Active' : 'Inactive'}</td>
                    <td><button className="btn btn-sm" onClick={() => toggleCategoryActive(c)}>{c.active ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form onSubmit={addCategory} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label>New category</label><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Utilities" /></div>
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
            <button className="btn" style={{ marginTop: '1rem' }} onClick={() => setShowCategories(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
