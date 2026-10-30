import { useEffect, useMemo, useState } from 'react';
import { adminApi, parentsApi } from '../services/api';
import { TempPasswordModal } from '../pages/AdminSchool';

// Admin Panel > Parents: who the parents are and which pupils each of them may look at
export default function ParentsAdmin() {
  const [parents, setParents] = useState<any[]>([]);
  const [pupils, setPupils] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [temp, setTemp] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', relationship: '' });
  const [chosen, setChosen] = useState<any[]>([]);
  const [find, setFind] = useState('');
  const [adding, setAdding] = useState<Record<number, string>>({});

  const load = () => parentsApi.list().then((r) => setParents(r.data)).catch(() => setMsg({ text: 'The parents could not be loaded', type: 'error' }));
  useEffect(() => {
    load();
    adminApi.users().then((r) => setPupils((Array.isArray(r.data) ? r.data : []).filter((u: any) => u.role === 'student' && !u.archived)));
  }, []);

  const matches = useMemo(() => {
    const t = find.trim().toLowerCase();
    if (!t) return [];
    return pupils.filter((p) => !chosen.some((c) => c.id === p.id) && ((p.name || '').toLowerCase().includes(t) || (p.student_number || '').toLowerCase().includes(t) || (p.class_name || '').toLowerCase().includes(t))).slice(0, 6);
  }, [find, pupils, chosen]);

  const fail = (e: any) => setMsg({ text: e.response?.data?.message || 'Something went wrong', type: 'error' });

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    try {
      const r = await parentsApi.create({ name: form.name, email: form.email, password: form.password || undefined, relationship: form.relationship, student_ids: chosen.map((c) => c.id) });
      setMsg({ text: r.data.message, type: 'success' });
      if (r.data.temporary_password) setTemp({ name: form.name, temporary_password: r.data.temporary_password });
      setForm({ name: '', email: '', password: '', relationship: '' }); setChosen([]); setFind(''); load();
    } catch (err) { fail(err); }
  };

  return (
    <>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {temp && <TempPasswordModal info={temp} onClose={() => setTemp(null)} />}
      <div className="card">
        <h2>Add a parent</h2>
        <p className="muted small" style={{ marginBottom: '0.7rem' }}>A parent logs in with their email address and sees only the pupils you link to them: results, report cards, fees and receipts, attendance, timetable and notices. They cannot change anything.</p>
        <form onSubmit={create}>
          <div className="form-row">
            <div><label>Parent's name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label>Email address (their log in)</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label>First password <span className="muted small">(leave empty to make a temporary one)</span></label><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" /></div>
            <div><label>Relationship <span className="muted small">(optional)</span></label><input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="Mother, Guardian…" /></div>
          </div>
          <label>Pupils this parent may see</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            {chosen.map((c) => <button key={c.id} type="button" className="chip active" onClick={() => setChosen(chosen.filter((x) => x.id !== c.id))} title="Click to remove">{c.name} ({c.class_name || 'no class'}) ×</button>)}
            {chosen.length === 0 && <span className="muted small">Nobody chosen yet</span>}
          </div>
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a pupil by name, registration number or class…" autoComplete="off" style={{ maxWidth: 420 }} />
          {matches.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, maxWidth: 420, background: 'var(--surface)' }}>
              {matches.map((p) => <button key={p.id} type="button" onClick={() => { setChosen([...chosen, p]); setFind(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.7rem', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit' }}>{p.name} <span className="muted small">{p.class_name || 'no class'} · {p.student_number}</span></button>)}
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.8rem' }} disabled={!chosen.length}>Add parent</button>
        </form>
      </div>

      <div className="card table-wrap">
        <h2>Parents ({parents.length})</h2>
        <table>
          <thead><tr><th>Parent</th><th>Log in (email)</th><th>Pupils they can see</th><th /></tr></thead>
          <tbody>
            {parents.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}{p.archived ? <span className="badge" style={{ marginLeft: 6 }}>Closed</span> : null}</td>
                <td>{p.email}</td>
                <td>
                  {p.children.map((k: any) => (
                    <span key={k.id} className="chip" style={{ marginRight: 4 }}>
                      {k.name} <span className="muted small">({k.class_name || 'no class'})</span>
                      <button type="button" aria-label={`Unlink ${k.name}`} title="Stop this parent seeing this pupil" onClick={async () => { if (!window.confirm(`Stop ${p.name} seeing ${k.name}?`)) return; try { await parentsApi.unlink(p.id, k.id); setMsg({ text: `${p.name} no longer sees ${k.name}`, type: 'success' }); load(); } catch (err) { fail(err); } }} style={{ marginLeft: 4, background: 'none', border: 0, cursor: 'pointer', color: 'var(--danger)' }}>×</button>
                    </span>
                  ))}
                </td>
                <td className="nowrap">
                  <select value={adding[p.id] || ''} onChange={(e) => setAdding({ ...adding, [p.id]: e.target.value })} style={{ width: 'auto', maxWidth: 190 }} aria-label={`Link another pupil to ${p.name}`}>
                    <option value="">Link another pupil…</option>
                    {pupils.filter((x) => !p.children.some((k: any) => k.id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.class_name || 'no class'})</option>)}
                  </select>
                  <button className="btn btn-sm" disabled={!adding[p.id]} onClick={async () => { try { const r = await parentsApi.link(p.id, Number(adding[p.id])); setMsg({ text: r.data.message, type: 'success' }); setAdding({ ...adding, [p.id]: '' }); load(); } catch (err) { fail(err); } }}>Link</button>
                </td>
              </tr>
            ))}
            {parents.length === 0 && <tr><td colSpan={4} className="muted">No parent accounts yet.</td></tr>}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: '0.6rem' }}>A parent who forgets their password asks on the log in page; you give them a temporary one in the Passwords tab, as for everyone else. To stop a parent logging in, use <strong>Close</strong> in the Users tab.</p>
      </div>
    </>
  );
}
