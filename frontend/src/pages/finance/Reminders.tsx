import { useEffect, useState } from 'react';
import { financeStudentsApi, messagesApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const DEFAULT_TEMPLATE = 'Dear parent/guardian, {student} of {class} currently has an outstanding balance of {balance}. Kindly settle at your earliest convenience. Thank you — {school}';

type Channel = 'whatsapp' | 'sms-device' | 'sms-auto';
const CHANNEL_NAME: Record<Channel, string> = { whatsapp: 'WhatsApp', 'sms-device': 'SMS from this device', 'sms-auto': 'SMS sent automatically' };

export default function Reminders() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [minBalance, setMinBalance] = useState('0');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadHistory = () => messagesApi.list().then((r) => setHistory(r.data));

  useEffect(() => {
    financeStudentsApi.classes().then((r) => setClasses(r.data));
    messagesApi.config().then((r) => setSmsEnabled(!!r.data.smsEnabled)).catch(() => setSmsEnabled(false));
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
        channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
      });
      setRecipients(res.data);
      if (res.data.length === 0) setMsg('No students match this filter.');
      loadHistory();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Failed to build recipient list'); }
    finally { setLoading(false); }
  };

  const mark = (id: number, patch: any) => setRecipients((prev) => prev.map((x) => (x.message_id === id ? { ...x, ...patch } : x)));

  // WhatsApp, or the messages app on this device: opens with the text written, then it is noted as sent
  const sendByLink = async (r: any) => {
    const url = channel === 'whatsapp' ? r.waUrl : r.smsUrl;
    if (!url) return;
    if (channel === 'whatsapp') window.open(url, '_blank'); else window.location.href = url;
    await messagesApi.markSent(r.message_id);
    mark(r.message_id, { state: 'sent' });
    loadHistory();
  };

  // The portal sends it by itself, through the SMS service it has been set up with
  const sendAutomatically = async (r: any) => {
    try { await messagesApi.sendSms(r.message_id); mark(r.message_id, { state: 'sent', error: '' }); }
    catch (err: any) { mark(r.message_id, { state: 'failed', error: err.response?.data?.error || err.response?.data?.message || 'Not sent' }); }
    loadHistory();
  };

  const sendAll = async () => {
    const todo = recipients.filter((r) => r.e164 && r.state !== 'sent');
    if (!todo.length) return;
    if (!window.confirm(`Send ${todo.length} text message${todo.length === 1 ? '' : 's'} now?`)) return;
    setSending(true); setMsg('');
    try {
      const res = await messagesApi.sendSmsBatch(todo.map((r) => r.message_id));
      for (const x of res.data.results) mark(x.id, { state: x.status, error: x.error });
      setMsg(`${res.data.sent} sent${res.data.failed ? `, ${res.data.failed} could not be sent (the reason is shown beside each one)` : ''}.`);
    } catch (err: any) { setMsg(err.response?.data?.message || 'The messages could not be sent'); }
    finally { setSending(false); loadHistory(); }
  };

  const rowAction = (r: any) => {
    if (!r.phone) return '-';
    if (channel === 'sms-auto') {
      return r.e164
        ? <button className="btn btn-sm btn-primary" disabled={r.state === 'sent'} onClick={() => sendAutomatically(r)}>{r.state === 'sent' ? 'Sent' : r.state === 'failed' ? 'Try again' : 'Send SMS'}</button>
        : <span className="small" style={{ color: 'var(--danger)' }}>Not a valid number</span>;
    }
    const url = channel === 'whatsapp' ? r.waUrl : r.smsUrl;
    return url ? <button className="btn btn-sm btn-primary" disabled={r.state === 'sent'} onClick={() => sendByLink(r)}>{r.state === 'sent' ? 'Sent' : channel === 'whatsapp' ? 'Send via WhatsApp' : 'Open in messages'}</button> : <span className="small" style={{ color: 'var(--danger)' }}>Not a valid number</span>;
  };

  return (
    <div>
      <h2 style={{ border: 0 }}>Fee reminders</h2>
      <p className="small muted" style={{ marginBottom: '0.8rem' }}>Pick a class, choose how to send, preview who will be messaged, then send. Every message is logged in the history below.</p>
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
          <div><label>Send by</label>
            <select value={channel} onChange={(e) => { setChannel(e.target.value as Channel); setRecipients([]); }}>
              <option value="whatsapp">{CHANNEL_NAME.whatsapp}</option>
              <option value="sms-device">{CHANNEL_NAME['sms-device']}</option>
              {smsEnabled && <option value="sms-auto">{CHANNEL_NAME['sms-auto']}</option>}
            </select>
          </div>
          <button className="btn btn-primary" onClick={preview} disabled={loading}>{loading ? 'Loading…' : 'Preview Recipients'}</button>
        </div>
        <p className="small muted" style={{ marginTop: '0.5rem' }}>
          {channel === 'whatsapp' && 'Opens WhatsApp for each parent with the message already written; you press send there.'}
          {channel === 'sms-device' && 'Opens this device’s messages app with the text already written. Works best on a phone; you press send there.'}
          {channel === 'sms-auto' && 'The portal sends each text itself, through the SMS service it has been set up with. Nothing opens on your screen.'}
          {!smsEnabled && ' Automatic SMS is switched off on this portal (see the README, "Text messages", to turn it on).'}
        </p>
        <label style={{ marginTop: '0.75rem', display: 'block' }}>Message template</label>
        <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} style={{ width: '100%' }} />
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Placeholders: {'{student} {class} {balance} {school}'}. A text is cheapest and clearest when it is short.</p>
      </div>

      {recipients.length > 0 && (
        <div className="card">
          <div className="page-head" style={{ marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, border: 0 }}>Recipients ({recipients.length})</h2>
            {channel === 'sms-auto' && <button className="btn btn-success" disabled={sending} onClick={sendAll}>{sending ? 'Sending…' : `Send all (${recipients.filter((r) => r.e164 && r.state !== 'sent').length})`}</button>}
          </div>
          <table>
            <thead><tr><th>Student</th><th>Phone</th><th>Message</th><th>Action</th></tr></thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.message_id}>
                  <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                  <td>{r.phone ? <>{r.e164 || r.phone}{!r.e164 && <div className="small" style={{ color: 'var(--danger)' }}>Check this number</div>}</> : <span style={{ color: 'var(--danger)' }}>No phone on file</span>}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxWidth: 320 }}>{r.message}{r.state === 'failed' && <div style={{ color: 'var(--danger)' }}>Not sent: {r.error}</div>}</td>
                  <td>{rowAction(r)}</td>
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
            <thead><tr><th>Student</th><th>Phone</th><th>Kind</th><th>Sent by</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id}>
                  <td>{m.student_name || '-'}</td>
                  <td>{m.phone}</td>
                  <td>{m.kind}</td>
                  <td>{m.channel === 'sms' ? 'SMS' : 'WhatsApp'}</td>
                  <td><StatusBadge status={m.status} />{m.status === 'failed' && m.error && <div className="small" style={{ color: 'var(--danger)' }}>{m.error}</div>}</td>
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
