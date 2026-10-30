import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { passwordApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePassword() {
  const { user, applyToken } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.must_change_password;
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = [
    { ok: form.next.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(form.next) && /[0-9]/.test(form.next), text: 'Contains letters and numbers' },
    { ok: form.next !== '' && form.next === form.confirm, text: 'Both new passwords match' },
    { ok: form.next !== '' && form.next !== form.current, text: 'Different from the current password' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checks.every((c) => c.ok)) { setMsg({ text: 'Please meet every point in the list first.', type: 'error' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await passwordApi.change(form.current, form.next);
      applyToken(res.data.token);
      setMsg({ text: res.data.message, type: 'success' });
      setForm({ current: '', next: '', confirm: '' });
      if (forced) setTimeout(() => navigate('/dashboard'), 900);
    } catch (err: any) { setMsg({ text: err.response?.data?.message || 'Could not change the password', type: 'error' }); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1>{forced ? 'Choose your own password' : 'Change password'}</h1>
      {forced && <div className="alert alert-warning">You are using a temporary password. Choose your own now to continue.</div>}
      {!forced && <p className="muted small" style={{ marginBottom: '1rem' }}>If you think someone else knows your password, change it now. Every other device you are logged in on will be logged out.</p>}
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <form className="card" onSubmit={submit}>
        <label htmlFor="cur">{forced ? 'Temporary password (from the administrator)' : 'Current password'}</label>
        <input id="cur" type="password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required autoComplete="current-password" />
        <label htmlFor="new">New password</label>
        <input id="new" type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required autoComplete="new-password" />
        <label htmlFor="conf">Type the new password again</label>
        <input id="conf" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
        <ul className="small" style={{ listStyle: 'none', margin: '0.2rem 0 1rem' }}>
          {checks.map((c) => <li key={c.text} style={{ color: c.ok ? 'var(--success)' : 'var(--text-dim)' }}>{c.ok ? '✓' : '○'} {c.text}</li>)}
        </ul>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </div>
  );
}
