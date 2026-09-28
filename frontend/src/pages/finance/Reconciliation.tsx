import { useEffect, useState } from 'react';
import { accountsApi, reconciliationApi } from '../../services/api';
import { money } from '../../utils/money';

type ItemType = 'payment' | 'expense' | 'transfer_out' | 'transfer_in';
interface Item { key: string; type: ItemType; id: number; date: string; ref: string; description: string; amount: number }

export default function Reconciliation() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [baseline, setBaseline] = useState(0);
  const [statementBalance, setStatementBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 7000); };

  useEffect(() => {
    accountsApi.list().then((r) => { setAccounts(r.data); if (r.data.length) setAccountId(r.data[0].id); });
  }, []);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [bookRes, unrecRes, histRes] = await Promise.all([
        accountsApi.balance(accountId, statementDate),
        reconciliationApi.unreconciled(accountId, statementDate),
        reconciliationApi.history(accountId),
      ]);
      const { payments, expenses, transfersOut, transfersIn } = unrecRes.data;
      const list: Item[] = [
        ...payments.map((p: any) => ({ key: `p:${p.id}`, type: 'payment' as const, id: p.id, date: p.pay_date, ref: p.receipt_no, description: `Fees: ${p.student_name}`, amount: p.amount })),
        ...expenses.map((x: any) => ({ key: `x:${x.id}`, type: 'expense' as const, id: x.id, date: x.exp_date, ref: x.voucher_no, description: `${x.payee} — ${x.description}`, amount: -x.amount })),
        ...transfersIn.map((t: any) => ({ key: `ti:${t.id}`, type: 'transfer_in' as const, id: t.id, date: t.tr_date, ref: t.reference || `TR-${t.id}`, description: `Transfer from ${t.from_name}`, amount: t.amount })),
        ...transfersOut.map((t: any) => ({ key: `to:${t.id}`, type: 'transfer_out' as const, id: t.id, date: t.tr_date, ref: t.reference || `TR-${t.id}`, description: `Transfer to ${t.to_name}`, amount: -t.amount })),
      ];
      list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const sumAll = list.reduce((s, i) => s + i.amount, 0);
      setBaseline(Math.round(((bookRes.data.balance || 0) - sumAll) * 100) / 100);
      setItems(list);
      setChecked({});
      setHistory(histRes.data);
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [accountId]);

  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    if (on) items.forEach((i) => { next[i.key] = true; });
    setChecked(next);
  };

  const tickedTotal = items.reduce((s, i) => s + (checked[i.key] ? i.amount : 0), 0);
  const clearedBalance = Math.round((baseline + tickedTotal) * 100) / 100;
  const stmtBalNum = statementBalance === '' ? null : parseFloat(statementBalance);
  const difference = stmtBalNum === null ? null : Math.round((stmtBalNum - clearedBalance) * 100) / 100;

  const save = async () => {
    if (!accountId || stmtBalNum === null || isNaN(stmtBalNum)) { showMsg('Enter the statement closing balance', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        statement_date: statementDate,
        statement_balance: stmtBalNum,
        notes,
        cleared_payment_ids: items.filter((i) => i.type === 'payment' && checked[i.key]).map((i) => i.id),
        cleared_expense_ids: items.filter((i) => i.type === 'expense' && checked[i.key]).map((i) => i.id),
        cleared_transfer_out_ids: items.filter((i) => i.type === 'transfer_out' && checked[i.key]).map((i) => i.id),
        cleared_transfer_in_ids: items.filter((i) => i.type === 'transfer_in' && checked[i.key]).map((i) => i.id),
      };
      const res = await reconciliationApi.save(accountId, payload);
      showMsg(Math.abs(res.data.difference) < 0.005
        ? 'Reconciled — the statement agrees with the system.'
        : `Saved, but there is a difference of ${money(res.data.difference)}.`);
      setStatementBalance(''); setNotes('');
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to save reconciliation', 'error'); }
    finally { setSaving(false); }
  };

  const account = accounts.find((a) => a.id === accountId);

  return (
    <div>
      <h1>Bank Reconciliation</h1>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Account</label>
            <select value={accountId || ''} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div><label>Show items up to</label>
            <input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
          </div>
          <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 2, minWidth: 400 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Items not yet on a statement</h2>
            <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} /> Tick all
            </label>
          </div>
          {items.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>Everything is reconciled up to {statementDate}.</p>
          ) : (
            <table>
              <thead><tr><th></th><th>Date</th><th>Reference</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.key}>
                    <td><input type="checkbox" checked={!!checked[i.key]} onChange={(e) => setChecked({ ...checked, [i.key]: e.target.checked })} /></td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{i.date}</td>
                    <td>{i.ref}</td>
                    <td>{i.description}</td>
                    <td style={{ color: i.amount < 0 ? '#f87171' : '#4ade80' }}>{money(i.amount, account?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <label>Statement date</label>
            <input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
            <label>Statement closing balance</label>
            <input type="number" step="0.01" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
            <table style={{ marginTop: '0.75rem' }}>
              <tbody>
                <tr><td>Already cleared</td><td style={{ textAlign: 'right' }}>{money(baseline, account?.currency)}</td></tr>
                <tr><td>Ticked now</td><td style={{ textAlign: 'right' }}>{money(tickedTotal, account?.currency)}</td></tr>
                <tr><td style={{ fontWeight: 700 }}>Cleared balance</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(clearedBalance, account?.currency)}</td></tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Difference</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: difference === null ? undefined : (Math.abs(difference) < 0.005 ? '#4ade80' : '#f87171') }}>
                    {difference === null ? '—' : (Math.abs(difference) < 0.005 ? 'Balanced' : money(difference, account?.currency))}
                  </td>
                </tr>
              </tbody>
            </table>
            <label>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bank charges to be recorded" />
            <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Reconciliation'}
            </button>
          </div>

          {history.length > 0 && (
            <div className="card">
              <h3>Past Reconciliations</h3>
              <table>
                <thead><tr><th>Date</th><th>Statement</th><th>Result</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontSize: '0.85rem' }}>{h.statement_date}</td>
                      <td>{money(h.statement_balance, account?.currency)}</td>
                      <td style={{ color: Math.abs(h.difference) < 0.005 ? '#4ade80' : '#f87171' }}>
                        {Math.abs(h.difference) < 0.005 ? 'Agreed' : `Diff ${money(h.difference, account?.currency)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
