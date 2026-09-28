import { useEffect, useState } from 'react';
import { sponsorsApi } from '../../services/api';

const TYPES = ['BEAM', 'NGO', 'Church', 'Company', 'Individual', 'Other'];

export default function Sponsors() {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', type: 'Other', contact_person: '', phone: '', email: '', coverage_percent: '100' });

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 7000); };

  const load = () => sponsorsApi.list().then((r) => setSponsors(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: 'Other', contact_person: '', phone: '', email: '', coverage_percent: '100' });
    setShowForm(true);
  };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, type: s.type, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', coverage_percent: String(s.coverage_percent) });
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      const payload = { ...form, coverage_percent: parseFloat(form.coverage_percent) || 0 };
      if (editing) { await sponsorsApi.update(editing.id, { ...payload, active: editing.active }); showMsg('Sponsor updated'); }
      else { await sponsorsApi.create(payload); showMsg('Sponsor added'); }
      setShowForm(false); load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to save sponsor', 'error'); }
  };

  const toggleActive = async (s: any) => {
    try {
      await sponsorsApi.update(s.id, {
        name: s.name, type: s.type, contact_person: s.contact_person, phone: s.phone, email: s.email,
        coverage_percent: s.coverage_percent, active: !s.active,
      });
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed', 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Sponsors</h1>
        <button className="btn btn-primary" onClick={openNew}>New Sponsor</button>
      </div>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <h2>Sponsors ({sponsors.length})</h2>
        {sponsors.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No sponsors yet.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Phone</th><th>Email</th><th>Coverage</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.type}</td>
                  <td>{s.contact_person || '-'}</td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.email || '-'}</td>
                  <td>{s.coverage_percent}%</td>
                  <td>{s.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => toggleActive(s)}>{s.active ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edit Sponsor' : 'New Sponsor'}</h2>
            <form onSubmit={submit}>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label>Contact Person</label>
              <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <label>Coverage %</label>
              <input type="number" step="0.01" min="0" max="100" value={form.coverage_percent} onChange={(e) => setForm({ ...form, coverage_percent: e.target.value })} />
              <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
