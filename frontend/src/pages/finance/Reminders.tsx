import { useEffect, useState } from 'react';
import { adminApi, messagesApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const DEFAULT_TEMPLATE = 'Dear parent/guardian, {student} of {class} currently has an outstanding balance of {balance}. Kindly settle at your earliest convenience. Thank you — {school}';

export default function Reminders() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [minBalance, setMinBalance] = useState('0');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadHistory = () => messagesApi.list().then((r) => setHistory(r.data));

  useEffect(() => {
    adminApi.classes().then((r) => setClasses(r.data));
    loadHistory();
  }, []);

  const preview = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await messagesApi.bulkReminder({
        class_id: classId ? Number(classId) : undefined,
        min_balance: minBalance ? parseFloat(minBalance) : 0,
        template,
      });
      setRecipients(res.data);
      if (res.data.length === 0) setMsg('No students match this filter.');
      loadHistory();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Failed to build recipient list'); }
    finally { setLoading(false); }
  };

  const send = async (r: any) => {
    if (!r.waUrl) return;
    window.open(r.waUrl, '_blank');
    await messagesApi.markSent(r.message_id);
    setRecipients((prev) => prev.map((x) => (x.message_id === r.message_id ? { ...x, sent: true } : x)));
    loadHistory();
  };

  return (
    <div>
      <h1>Fee Reminders</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Class (optional)</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label>Minimum balance ($)</label>
            <input type="number" step="0.01" value={minBalance} onChange={(e) => setMinBalance(e.target.value)} style={{ width: 120 }} />
          </div>
          <button className="btn btn-primary" onClick={preview} disabled={loading}>{loading ? 'Loading…' : 'Preview Recipients'}</button>
        </div>
        <label style={{ marginTop: '0.75rem', display: 'block' }}>Message template</label>
        <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} style={{ width: '100%' }} />
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Placeholders: {'{student} {class} {balance} {school}'}</p>
      </div>

      {recipients.length > 0 && (
        <div className="card">
          <h2>Recipients ({recipients.length})</h2>
          <table>
            <thead><tr><th>Student</th><th>Phone</th><th>Message</th><th>Action</th></tr></thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.message_id}>
                  <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                  <td>{r.phone || <span style={{ color: '#f87171' }}>No phone on file</span>}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxWidth: 320 }}>{r.message}</td>
                  <td>
                    {r.waUrl ? (
                      <button className="btn btn-sm btn-primary" disabled={r.sent} onClick={() => send(r)}>{r.sent ? 'Sent' : 'Send via WhatsApp'}</button>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Message History</h2>
        {history.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No messages logged yet.</p> : (
          <table>
            <thead><tr><th>Student</th><th>Phone</th><th>Kind</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id}>
                  <td>{m.student_name || '-'}</td>
                  <td>{m.phone}</td>
                  <td>{m.kind}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
