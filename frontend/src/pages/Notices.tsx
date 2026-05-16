import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { noticeApi } from '../services/api';

export default function Notices() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', content: '', target_role: 'all' });
  const [msg, setMsg] = useState('');

  const load = () => { noticeApi.get().then(r => setNotices(r.data)).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await noticeApi.create(form);
      setMsg('Notice created');
      setForm({ title: '', content: '', target_role: 'all' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    try { await noticeApi.delete(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const canCreate = user?.role === 'admin' || user?.role === 'teacher';
  const canDelete = (notice: any) => user?.role === 'admin' || (user?.role === 'teacher' && notice.author_role === 'teacher');

  return (
    <div>
      <h1>Notices</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {canCreate && (
        <div className="card">
          <h2>Create Notice</h2>
          <form onSubmit={handleCreate}>
            <label>Title</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            <label>Content</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required />
            <div className="form-row">
              <div>
                <label>Audience</label>
                <select value={form.target_role} onChange={e => setForm({ ...form, target_role: e.target.value })}>
                  <option value="all">Everyone</option>
                  <option value="teacher">Teachers Only</option>
                  <option value="student">Students Only</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Post Notice</button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>All Notices</h2>
        {notices.length === 0 ? <p>No notices yet.</p> : notices.map((n: any) => (
          <div key={n.id} style={{ borderBottom: '1px solid #e0e0e0', padding: '1rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3>{n.title}</h3>
                <p style={{ color: '#666', fontSize: '0.85rem' }}>
                  By {n.author_name} | {new Date(n.created_at).toLocaleString()} | Target: {n.target_role}
                </p>
              </div>
              {canDelete(n) && (
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(n.id)}>Delete</button>
              )}
            </div>
            <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{n.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
