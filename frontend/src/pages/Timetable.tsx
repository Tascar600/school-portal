import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { timetableApi, subjectApi } from '../services/api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function Timetable() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [organized, setOrganized] = useState<any>({});
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classList] = useState<any[]>([]);

  // Teacher proposal form
  const [form, setForm] = useState({ class_id: user?.role === 'teacher' && user?.class_id ? String(user.class_id) : '', subject_id: '', day: 'Monday', start_time: '', end_time: '', room: '' });

  // Admin section
  const [adminClassId, setAdminClassId] = useState('');
  const [proposals, setProposals] = useState<any[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ subject_id: '', day: '', start_time: '', end_time: '', room: '', status: '' });
  const [generated, setGenerated] = useState<any>(null);

  const [msg, setMsg] = useState('');

  // Load data
  useEffect(() => {
    if (user?.role === 'teacher') {
      timetableApi.my().then(r => setEntries(r.data)).catch(() => {});
      if (user?.class_id) subjectApi.byClass(user.class_id).then(r => setSubjects(r.data)).catch(() => {});
    } else if (user?.role === 'student' && user.class_id) {
      timetableApi.getByClass(user.class_id).then(r => { setOrganized(r.data.organized || {}); setEntries(r.data.entries || []); }).catch(() => {});
    }
  }, [user]);

  // Teacher: propose entry
  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await timetableApi.create(form);
      setMsg('Entry proposed — awaiting admin approval');
      setForm({ ...form, subject_id: '', day: 'Monday', start_time: '', end_time: '', room: '' });
      timetableApi.my().then(r => setEntries(r.data));
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Teacher: delete own proposal
  const handleDelete = async (id: number) => {
    try { await timetableApi.delete(id); timetableApi.my().then(r => setEntries(r.data)); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Admin: load proposals for a class
  const loadProposals = async () => {
    if (!adminClassId) return;
    try {
      const res = await timetableApi.getProposals(parseInt(adminClassId));
      setProposals(res.data);
      setGenerated(null);
      setMsg(`Loaded ${res.data.length} proposals for class ${adminClassId}`);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Admin: publish (generate) timetable
  const handlePublish = async () => {
    if (!adminClassId) return;
    try {
      const res = await timetableApi.publish(parseInt(adminClassId));
      setGenerated(res.data);
      setMsg(`Published ${res.data.total_entries} entries!`);
      loadProposals();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Admin: start editing an entry
  const startEdit = (e: any) => {
    setEditId(e.id);
    setEditForm({ subject_id: e.subject_id, day: e.day, start_time: e.start_time, end_time: e.end_time, room: e.room || '', status: e.status });
  };

  // Admin: save edit
  const saveEdit = async () => {
    if (editId === null) return;
    try {
      await timetableApi.update(editId, editForm);
      setMsg('Entry updated');
      setEditId(null);
      loadProposals();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Admin: delete entry
  const adminDelete = async (id: number) => {
    try { await timetableApi.delete(id); loadProposals(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Render timetable table
  const renderTimetable = (data: any, showTeacher = false) => {
    const hasData = days.some(d => data[d]?.length > 0);
    if (!hasData) return <p style={{ color: 'var(--text-dim)' }}>No entries.</p>;

    const allTimes = new Set<string>();
    days.forEach(d => (data[d] || []).forEach((e: any) => allTimes.add(e.start_time)));
    const times = [...allTimes].sort();

    return (
      <table>
        <thead><tr><th>Time</th>{days.map(d => <th key={d}>{d}</th>)}</tr></thead>
        <tbody>
          {times.map(time => (
            <tr key={time}>
              <td style={{ fontWeight: 600, color: 'var(--neon)', whiteSpace: 'nowrap' }}>{time}</td>
              {days.map(day => {
                const entry = (data[day] || []).find((e: any) => e.start_time === time);
                return (
                  <td key={day}>
                    {entry ? (
                      <div style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{entry.subject_name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{entry.end_time}</div>
                        {entry.room && <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Room {entry.room}</div>}
                        {showTeacher && <div style={{ color: '#22d3ee', fontSize: '0.75rem' }}>{entry.teacher_name}</div>}
                      </div>
                    ) : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <h1>Timetable</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {/* TEACHER: Propose Entry */}
      {user?.role === 'teacher' && (
        <>
          <div className="card">
            <h2>Propose Timetable Entry</h2>
            <form onSubmit={handlePropose}>
              <div className="form-row">
                <div><label>Class</label><input value={form.class_id} disabled /></div>
                <div><label>Subject</label>
                  <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required>
                    <option value="">— Select —</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div><label>Day</label>
                  <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label>Start Time</label><input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required /></div>
                <div><label>End Time</label><input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required /></div>
                <div><label>Room</label><input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="e.g. 101" /></div>
              </div>
              <button type="submit" className="btn btn-primary">Propose Entry</button>
            </form>
          </div>

          <div className="card">
            <h2>My Proposals ({entries.length})</h2>
            {entries.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No proposals yet.</p> : (
              <table>
                <thead><tr><th>Subject</th><th>Day</th><th>Time</th><th>Room</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.id}>
                      <td>{e.subject_name}</td>
                      <td>{e.day}</td>
                      <td>{e.start_time} - {e.end_time}</td>
                      <td>{e.room || '-'}</td>
                      <td><span className={`badge ${e.status === 'published' ? 'neon-text' : ''}`}>{e.status}</span></td>
                      <td>{e.status === 'draft' && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>Delete</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ADMIN: Manage Timetable */}
      {user?.role === 'admin' && (
        <>
          <div className="card">
            <h2>Manage Timetable</h2>
            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label>Enter Class ID</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input value={adminClassId} onChange={e => setAdminClassId(e.target.value)} placeholder="e.g. 1" />
                  <button className="btn btn-primary" onClick={loadProposals}>Load Proposals</button>
                </div>
              </div>
            </div>
          </div>

          {proposals.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Proposals for Class #{adminClassId}</h2>
                <div>
                  <button className="btn btn-success" onClick={handlePublish} style={{ marginRight: '0.5rem' }}>
                    ✦ Generate & Publish Timetable
                  </button>
                </div>
              </div>
              <table>
                <thead><tr><th>Subject</th><th>Teacher</th><th>Day</th><th>Time</th><th>Room</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {proposals.map((e: any) => (
                    <tr key={e.id}>
                      {editId === e.id ? (
                        <>
                          <td><select value={editForm.subject_id} onChange={s => setEditForm({ ...editForm, subject_id: s.target.value })}>
                            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select></td>
                          <td>{e.teacher_name}</td>
                          <td><select value={editForm.day} onChange={s => setEditForm({ ...editForm, day: s.target.value })}>
                            {days.map(d => <option key={d}>{d}</option>)}
                          </select></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <input type="time" value={editForm.start_time} onChange={s => setEditForm({ ...editForm, start_time: s.target.value })} style={{ width: 100 }} />
                            <input type="time" value={editForm.end_time} onChange={s => setEditForm({ ...editForm, end_time: s.target.value })} style={{ width: 100 }} />
                          </td>
                          <td><input value={editForm.room} onChange={s => setEditForm({ ...editForm, room: s.target.value })} style={{ width: 70 }} /></td>
                          <td>
                            <select value={editForm.status} onChange={s => setEditForm({ ...editForm, status: s.target.value })}>
                              <option value="draft">draft</option><option value="published">published</option>
                            </select>
                          </td>
                          <td>
                            <button className="btn btn-success btn-sm" onClick={saveEdit}>Save</button>
                            <button className="btn btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{e.subject_name}</td>
                          <td>{e.teacher_name}</td>
                          <td>{e.day}</td>
                          <td>{e.start_time} - {e.end_time}</td>
                          <td>{e.room || '-'}</td>
                          <td><span className={`badge ${e.status === 'published' ? 'neon-text' : ''}`}>{e.status}</span></td>
                          <td>
                            <button className="btn btn-warning btn-sm" onClick={() => startEdit(e)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => adminDelete(e.id)}>Delete</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {generated && (
            <div className="card glow-border">
              <h2>Published Timetable — Class #{generated.class_id}</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Published at {new Date(generated.published_at).toLocaleString()} · {generated.total_entries} entries
              </p>
              {renderTimetable(generated.timetable, true)}
            </div>
          )}
        </>
      )}

      {/* STUDENT: View Timetable */}
      {user?.role === 'student' && (
        <div className="card glow-border">
          <h2>My Timetable</h2>
          {Object.keys(organized).length === 0
            ? <p style={{ color: 'var(--text-dim)' }}>No timetable published for your class yet.</p>
            : renderTimetable(organized)}
        </div>
      )}
    </div>
  );
}
