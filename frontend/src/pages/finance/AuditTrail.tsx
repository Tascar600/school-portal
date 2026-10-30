import { useEffect, useMemo, useState } from 'react';
import { auditApi } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDateTime, fmtRange } from '../../utils/dates';
import PeriodBar, { usePeriod } from '../../components/PeriodBar';
import PrintHeader from '../../components/PrintHeader';
import FinanceTabs from '../../components/FinanceTabs';
import { PrintButton, DownloadCSV } from '../../components/PrintDownload';

// Things that take money back or cancel something are shown in red so they stand out when reading down the list
const isUndo = (action: string) => /reversed|cancelled|deleted|removed|deactivated|unlocked/i.test(action);
const ROLE: Record<string, string> = { bursary: 'Bursar', admin: 'Administrator' };

// Administrator only: a read-only record of every change made in the Bursary (nothing here can be edited or deleted).
export default function AuditTrail() {
  const state = usePeriod('month');
  const { period } = state;
  const [data, setData] = useState<any>(null);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    auditApi.list({ from: period.from, to: period.to, action: action || undefined, user_id: userId || undefined })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.message || 'The audit trail could not be loaded'));
  }, [period.from, period.to, action, userId]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.rows || []).filter((r: any) => !t || [r.summary, r.user_name, r.action].some((x) => (x || '').toLowerCase().includes(t)));
  }, [data, q]);

  const filterText = [action, data?.users?.find((u: any) => String(u.id) === userId)?.name, q && `“${q}”`].filter(Boolean).join(', ');

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title="Bursary audit trail" period={fmtRange(period.from, period.to)} extra={filterText || undefined} />
      <div className="page-head no-print">
        <div>
          <h1>Audit trail</h1>
          <p>Who changed what in the Bursary, and when. The portal writes this record by itself and has no way to edit or delete it.</p>
        </div>
      </div>
      {error && <div className="alert alert-error no-print">{error}</div>}

      <PeriodBar state={state}>
        <div><label>What was done</label>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Everything</option>
            {(data?.counts || []).map((c: any) => <option key={c.action} value={c.action}>{c.action} ({c.n})</option>)}
          </select>
        </div>
        <div><label>Who did it</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Everyone</option>
            {(data?.users || []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({ROLE[u.role] || u.role})</option>)}
          </select>
        </div>
        <div><label>Search</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="receipt, pupil, reason…" /></div>
      </PeriodBar>

      {data && data.counts.length > 0 && !action && (
        <div className="card no-print">
          <h2>What was done in this period</h2>
          <div className="toolbar" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
            {data.counts.map((c: any) => (
              <button key={c.action} type="button" className="chip" onClick={() => setAction(c.action)} style={isUndo(c.action) ? { color: 'var(--danger)' } : undefined}>{c.action}: <strong>{c.n}</strong></button>
            ))}
          </div>
        </div>
      )}

      <div className="card table-wrap">
        <div className="page-head" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, border: 0 }}>Record of changes ({rows.length}{data && data.total > data.shown && !q ? ` of ${data.total}` : ''})</h2>
          <div className="toolbar no-print">
            <PrintButton />
            <DownloadCSV filename={`audit-trail-${period.from}-to-${period.to}`} headers={['Date and time', 'Who', 'Role', 'What was done', 'Details', 'USD amount']}
              data={rows.map((r: any) => ({ 'Date and time': fmtDateTime(r.created_at), Who: r.user_name, Role: ROLE[r.user_role] || r.user_role, 'What was done': r.action, Details: r.summary, 'USD amount': r.amount == null ? '' : Number(r.amount).toFixed(2) }))} />
          </div>
        </div>
        <table>
          <thead><tr><th>Date and time</th><th>Who</th><th>What was done</th><th>Details</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="nowrap">{fmtDateTime(r.created_at)}</td>
                <td style={{ fontWeight: 600 }}>{r.user_name || 'Unknown'}<div className="muted small">{ROLE[r.user_role] || r.user_role}</div></td>
                <td style={isUndo(r.action) ? { color: 'var(--danger)', fontWeight: 600 } : { fontWeight: 600 }}>{r.action}</td>
                <td>{r.summary}</td>
                <td className="num">{r.amount == null ? '' : money(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">{data ? 'Nothing was changed in this period. Choose a longer period to look further back.' : 'Loading…'}</td></tr>}
          </tbody>
        </table>
        {data && data.total > data.shown && !q && <p className="muted small no-print" style={{ marginTop: '0.6rem' }}>Showing the latest {data.shown} of {data.total} changes. Choose a shorter period to see the rest.</p>}
      </div>
      <p className="muted small">The record starts from the day this feature was installed; payments and bills made before then are not in it.</p>
    </div>
  );
}
