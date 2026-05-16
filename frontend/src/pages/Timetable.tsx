import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { timetableApi } from '../services/api';

export default function Timetable() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [organized, setOrganized] = useState<any>({});
  const [form, setForm] = useState({ class_id: '', subject_id: '', day: 'Monday', start_time: '', end_time: '', room: '' });
  const [generateClassId, setGenerateClassId] = useState('');
  const [generated, setGenerated] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    if (user?.role === 'teacher') {
      timetableApi.my().then(r => setEntries(r.data));
    } else if (user?.role === 'admin') {
      timetableApi.all().then(r => setEntries(r.data));
    } else if (user?.role === 'student' && user.class_id) {
      timetableApi.getByClass(user.class_id).then(r => {
        setOrganized(r.data.organized || {});
        setEntries(r.data.entries || []);
      });
    }
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await timetableApi.create(form);
      setMsg('Entry proposed');
      setForm({ class_id: '', subject_id: '', day: 'Monday', start_time: '', end_time: '', room: '' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handlePublish = async (id: number, status: string) => {
    try { await timetableApi.update(id, { status }); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    try { await timetableApi.delete(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleGenerate = async () => {
    if (!generateClassId) { setMsg('Enter a class ID'); return; }
    try {
      const res = await timetableApi.generate(parseInt(generateClassId));
      setGenerated(res.data);
      setMsg(`Generated timetable with ${res.data.total_entries} entries`);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div>
      <h1>Timetable</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {user?.role === 'teacher' && (
        <div className="card">
          <h2>Propose Timetable Entry</h2>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div>
                <label>Class ID</label>
                <input value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} required />
              </div>
              <div>
                <label>Subject ID</label>
                <input value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>Day</label>
                <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label>Start Time</label>
                <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div>
                <label>End Time</label>
                <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
              </div>
              <div>
                <label>Room</label>
                <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Propose Entry</button>
          </form>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="card">
          <h2>Generate Timetable</h2>
          <div className="form-row">
            <div>
              <label>Class ID</label>
              <input value={generateClassId} onChange={e => setGenerateClassId(e.target.value)} placeholder="e.g. 1" />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleGenerate}>Generate</button>
            </div>
          </div>
          {generated && (
            <div style={{ marginTop: '1rem' }}>
              <p>Generated at: {new Date(generated.generated_at).toLocaleString()} | {generated.total_entries} entries</p>
            </div>
          )}
        </div>
      )}

      {/* Student: organized view by day */}
      {user?.role === 'student' && Object.keys(organized).length > 0 && (
        <div className="card">
          <h2>My Timetable</h2>
          {days.map(day => {
            const dayEntries = organized[day];
            if (!dayEntries?.length) return null;
            return (
              <div key={day} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#00e5ff', borderBottom: '1px solid #00e5ff44', paddingBottom: '0.3rem' }}>{day}</h3>
                <table>
                  <thead><tr><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead>
                  <tbody>
                    {dayEntries.map((e: any) => (
                      <tr key={e.id}>
                        <td>{e.start_time?.slice(0,5)} - {e.end_time?.slice(0,5)}</td>
                        <td>{e.subject_name}</td>
                        <td>{e.teacher_name || '-'}</td>
                        <td>{e.room || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Teacher/Admin: flat table view */}
      {(user?.role === 'teacher' || user?.role === 'admin') && (
        <div className="card">
          <h2>{user?.role === 'teacher' ? 'My Proposals' : 'All Entries'}</h2>
          {entries.length === 0 ? <p>No timetable entries yet.</p> : (
            <table>
              <thead>
                <tr>
                  <th>Day</th><th>Subject</th><th>Time</th><th>Room</th><th>Class</th><th>Teacher</th><th>Status</th>
                  {user?.role === 'admin' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.day}</td>
                    <td>{e.subject_name}</td>
                    <td>{e.start_time?.slice(0,5)} - {e.end_time?.slice(0,5)}</td>
                    <td>{e.room || '-'}</td>
                    <td>{e.class_name}</td>
                    <td>{e.teacher_name || '-'}</td>
                    <td><span className={`alert-${e.status === 'published' ? 'success' : 'info'}`} style={{ padding: '2px 8px', borderRadius: 4 }}>{e.status}</span></td>
                    {user?.role === 'admin' && (
                      <td>
                        {e.status === 'draft' && <button className="btn btn-success btn-sm" onClick={() => handlePublish(e.id, 'published')}>Publish</button>}
                        {e.status === 'published' && <button className="btn btn-warning btn-sm" onClick={() => handlePublish(e.id, 'draft')}>Draft</button>}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Student fallback if no organized data */}
      {user?.role === 'student' && Object.keys(organized).length === 0 && entries.length > 0 && (
        <div className="card">
          <h2>My Timetable</h2>
          <table>
            <thead><tr><th>Day</th><th>Subject</th><th>Time</th><th>Room</th><th>Teacher</th></tr></thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.day}</td>
                  <td>{e.subject_name}</td>
                  <td>{e.start_time?.slice(0,5)} - {e.end_time?.slice(0,5)}</td>
                  <td>{e.room || '-'}</td>
                  <td>{e.teacher_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {user?.role === 'student' && entries.length === 0 && Object.keys(organized).length === 0 && (
        <p>No published timetable for your class.</p>
      )}
    </div>
  );
}
