import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { votingApi } from '../services/api';

export default function Voting() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, number>>({});
  const [viewSessionId, setViewSessionId] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', position: 'Prefect' });
  const [nomForm, setNomForm] = useState({ session_id: '', student_id: '', manifesto: '' });
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'sessions' | 'nominate'>('sessions');

  const load = () => { votingApi.getSessions().then(r => setSessions(r.data)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await votingApi.createSession(form);
      setMsg('Voting session created');
      setForm({ title: '', description: '', position: 'Prefect' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const toggleStatus = async (id: number, status: string) => {
    try { await votingApi.toggleStatus(id, status); setMsg(`Voting ${status}`); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const viewCandidates = async (sessionId: number) => {
    try {
      const res = await votingApi.getCandidates(sessionId);
      setCandidates(res.data.candidates);
      setSessionDetails(res.data.session);
      setViewSessionId(sessionId);
      setSelectedCandidates({});
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const castVote = async (candidateId: number, sessionId: number) => {
    try {
      await votingApi.vote({ session_id: sessionId, candidate_id: candidateId });
      setMsg('Vote cast successfully!');
      viewCandidates(sessionId);
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleNominate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await votingApi.nominate({ ...nomForm, session_id: parseInt(nomForm.session_id), student_id: parseInt(nomForm.student_id) });
      setMsg('Candidate nominated');
      setNomForm({ session_id: '', student_id: '', manifesto: '' });
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    try { await votingApi.deleteSession(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <h1>Prefect Voting</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {/* Admin: Create Session */}
      {user?.role === 'admin' && (
        <>
          <div className="card">
            <h2>Create Voting Session</h2>
            <form onSubmit={handleCreate}>
              <label>Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. 2026 Prefect Elections" />
              <label>Position</label>
              <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} required placeholder="e.g. Head Prefect" />
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <button type="submit" className="btn btn-primary">Create Session</button>
            </form>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <button className={`btn ${tab === 'sessions' ? 'btn-primary' : ''}`} onClick={() => setTab('sessions')}>Sessions</button>
            <button className={`btn ${tab === 'nominate' ? 'btn-primary' : ''}`} onClick={() => setTab('nominate')}>Nominate Candidates</button>
          </div>

          {tab === 'nominate' && (
            <div className="card">
              <h2>Nominate Student</h2>
              <form onSubmit={handleNominate}>
                <div className="form-row">
                  <div><label>Session ID</label><input value={nomForm.session_id} onChange={e => setNomForm({ ...nomForm, session_id: e.target.value })} required /></div>
                  <div><label>Student ID</label><input value={nomForm.student_id} onChange={e => setNomForm({ ...nomForm, student_id: e.target.value })} required /></div>
                </div>
                <label>Manifesto</label>
                <textarea value={nomForm.manifesto} onChange={e => setNomForm({ ...nomForm, manifesto: e.target.value })} />
                <button type="submit" className="btn btn-primary">Nominate</button>
              </form>
            </div>
          )}
        </>
      )}

      {/* Voting Sessions List */}
      <div className="card">
        <h2>Voting Sessions</h2>
        {sessions.length === 0 ? <p>No voting sessions yet.</p> : sessions.map((s: any) => (
          <div key={s.id} style={{ borderBottom: '1px solid #e0e0e0', padding: '1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3>{s.title}</h3>
              <p style={{ color: '#666' }}>{s.position} | {s.candidate_count} candidates | {s.vote_count} votes cast</p>
              <span style={{
                padding: '2px 8px', borderRadius: 4,
                background: s.status === 'open' ? '#e8f5e9' : '#ffebee',
                color: s.status === 'open' ? '#2e7d32' : '#c62828',
                fontWeight: 'bold'
              }}>{s.status === 'open' ? 'VOTING OPEN' : 'CLOSED'}</span>
            </div>
            <div>
              <button className="btn btn-primary btn-sm" onClick={() => viewCandidates(s.id)}>View Candidates</button>
              {user?.role === 'admin' && (
                <>
                  {s.status === 'closed'
                    ? <button className="btn btn-success btn-sm" onClick={() => toggleStatus(s.id, 'open')}>Open Voting</button>
                    : <button className="btn btn-warning btn-sm" onClick={() => toggleStatus(s.id, 'closed')}>Close Voting</button>
                  }
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Candidates Modal */}
      {viewSessionId && (
        <div className="modal-overlay" onClick={() => setViewSessionId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h2>{sessionDetails?.title} - Candidates</h2>
            <p style={{ color: '#666' }}>Position: {sessionDetails?.position} | Status: <strong>{sessionDetails?.status}</strong></p>

            {candidates.length === 0 ? <p>No candidates nominated yet.</p> : (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                {candidates.map((c: any) => (
                  <div key={c.id} style={{ background: '#fafafa', borderRadius: 8, padding: '1rem', textAlign: 'center', border: '1px solid #e0e0e0' }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#1a237e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {c.student_name?.charAt(0)}
                    </div>
                    <h4>{c.student_name}</h4>
                    {c.manifesto && <p style={{ fontSize: '0.85rem', color: '#666' }}>"{c.manifesto}"</p>}
                    {c.vote_count !== undefined && <p><strong>Votes: {c.vote_count}</strong></p>}
                    {user?.role === 'student' && sessionDetails?.status === 'open' && (
                      <button className="btn btn-primary btn-sm" onClick={() => castVote(c.id, viewSessionId)} style={{ marginTop: '0.5rem' }}>Vote</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button className="btn" onClick={() => setViewSessionId(null)} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
