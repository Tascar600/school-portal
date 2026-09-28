import { useEffect, useState } from 'react';
import { termsApi, budgetsApi } from '../../services/api';
import { money } from '../../utils/money';

export default function Budgets() {
  const [terms, setTerms] = useState<any[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [showCopy, setShowCopy] = useState(false);
  const [copyFrom, setCopyFrom] = useState<number | ''>('');

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 7000); };

  const loadRows = (tId: number) => budgetsApi.list(tId).then((r) => setRows(r.data));

  useEffect(() => {
    termsApi.list().then((r) => {
      setTerms(r.data);
      const current = r.data.find((t: any) => t.is_current)?.id || r.data[0]?.id || null;
      setTermId(current);
    });
  }, []);

  useEffect(() => { if (termId) loadRows(termId); }, [termId]);

  const currentTerm = terms.find((t) => t.id === termId);

  const saveAmount = async (categoryId: number, value: string) => {
    if (!termId) return;
    const val = parseFloat(value);
    if (isNaN(val) || val < 0) return;
    try { await budgetsApi.set(termId, categoryId, val); loadRows(termId); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Failed to save budget', 'error'); }
  };

  const doCopy = async () => {
    if (!termId || !copyFrom) return;
    try {
      const res = await budgetsApi.copy(Number(copyFrom), termId);
      showMsg(res.data.message); setShowCopy(false); loadRows(termId);
    } catch (err: any) { showMsg(err.response?.data?.message || 'Copy failed', 'error'); }
  };

  const pctColor = (pct: number) => (pct > 100 ? '#f87171' : pct > 80 ? '#fbbf24' : '#4ade80');

  const totals = rows.reduce((acc, r) => ({ budget: acc.budget + r.budget, spent: acc.spent + r.spent }), { budget: 0, spent: 0 });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Budgets</h1>
        <button className="btn" onClick={() => { setCopyFrom(''); setShowCopy(true); }}>Copy from another term</button>
      </div>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <label>Term</label>
        <select value={termId || ''} onChange={(e) => setTermId(Number(e.target.value))}>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.year} Term {t.term_no}{t.is_locked ? ' (locked)' : ''}</option>)}
        </select>

        {rows.length === 0 ? <p style={{ color: 'var(--text-dim)', marginTop: '0.75rem' }}>Add expense categories first (Expenses → Categories).</p> : (
          <table style={{ marginTop: '0.75rem' }}>
            <thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th><th style={{ width: '26%' }}>% Used</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const remaining = r.budget - r.spent;
                const pct = r.budget > 0 ? (r.spent / r.budget) * 100 : (r.spent > 0 ? 100 : 0);
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>
                      <input
                        type="number" step="0.01" min="0" style={{ width: 100 }}
                        defaultValue={r.budget || ''} placeholder="0.00"
                        onBlur={(e) => e.target.value && saveAmount(r.id, e.target.value)}
                      />
                    </td>
                    <td>{money(r.spent)}</td>
                    <td style={{ color: remaining < 0 ? '#f87171' : undefined }}>{remaining < 0 ? `Over by ${money(-remaining)}` : money(remaining)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.round(pct))}%`, height: '100%', background: pctColor(pct) }} />
                        </div>
                        <small style={{ width: 36, textAlign: 'right' }}>{Math.round(pct)}%</small>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{money(totals.budget)}</td>
                <td style={{ fontWeight: 700 }}>{money(totals.spent)}</td>
                <td style={{ fontWeight: 700 }}>{money(totals.budget - totals.spent)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showCopy && (
        <div className="modal-overlay" onClick={() => setShowCopy(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Copy budget into {currentTerm ? `${currentTerm.year} Term ${currentTerm.term_no}` : 'this term'}</h2>
            <label>Copy from</label>
            <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Choose a term…</option>
              {terms.filter((t) => t.id !== termId).map((t) => <option key={t.id} value={t.id}>{t.year} Term {t.term_no}</option>)}
            </select>
            <div style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={doCopy} disabled={!copyFrom}>Copy</button>
              <button className="btn" onClick={() => setShowCopy(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
