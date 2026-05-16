import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sportApi } from '../services/api';

export default function Sports() {
  const { user } = useAuth();
  const [sports, setSports] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '', coach_id: '', max_participants: '' });
  const [participants, setParticipants] = useState<any[]>([]);
  const [viewSport, setViewSport] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => { sportApi.getAll().then(r => setSports(r.data)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sportApi.create({ ...form, coach_id: form.coach_id ? parseInt(form.coach_id) : null, max_participants: parseInt(form.max_participants) || 0 });
      setMsg('Sport created');
      setForm({ name: '', description: '', coach_id: '', max_participants: '' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleJoin = async (sportId: number) => {
    try { await sportApi.join(sportId); setMsg('Joined!'); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleLeave = async (sportId: number) => {
    try { await sportApi.leave(sportId); setMsg('Left sport'); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const viewParticipants = async (sportId: number) => {
    try {
      const res = await sportApi.participants(sportId);
      setParticipants(res.data);
      setViewSport(sportId);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    try { await sportApi.delete(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const isCoach = (sport: any) => user?.role === 'admin' || (user?.role === 'teacher' && sport.coach_id === user.id);

  return (
    <div>
      <h1>Sports</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {/* Admin/Teacher: Create Sport */}
      {(user?.role === 'admin' || user?.role === 'teacher') && (
        <div className="card">
          <h2>Create Sport</h2>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div><label>Sport Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label>Coach ID (optional)</label><input value={form.coach_id} onChange={e => setForm({ ...form, coach_id: e.target.value })} /></div>
              <div><label>Max Participants (0=unlimited)</label><input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} /></div>
            </div>
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <button type="submit" className="btn btn-primary">Create Sport</button>
          </form>
        </div>
      )}

      {/* Sports List */}
      <div className="card">
        <h2>Available Sports</h2>
        {sports.length === 0 ? <p>No sports yet.</p> : (
          <div className="grid">
            {sports.map((s: any) => (
              <div key={s.id} style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3>{s.name}</h3>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>{s.description}</p>
                <p><strong>Coach:</strong> {s.coach_name || 'TBD'}</p>
                <p><strong>Participants:</strong> {s.participant_count}{s.max_participants > 0 ? ` / ${s.max_participants}` : ''}</p>
                <div style={{ marginTop: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => viewParticipants(s.id)}>View</button>
                  {user?.role === 'student' && (
                    <button className="btn btn-success btn-sm" onClick={() => handleJoin(s.id)}>Join</button>
                  )}
                  {isCoach(s) && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participants Modal */}
      {viewSport && (
        <div className="modal-overlay" onClick={() => setViewSport(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Participants</h2>
            {participants.length === 0 ? <p>No participants yet.</p> : (
              <table>
                <thead><tr><th>Student</th><th>Role</th><th>Joined</th></tr></thead>
                <tbody>
                  {participants.map((p: any) => (
                    <tr key={p.id}><td>{p.student_name}</td><td>{p.role}</td><td>{new Date(p.joined_at).toLocaleDateString()}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn" onClick={() => setViewSport(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
