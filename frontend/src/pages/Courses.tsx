import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { courseApi } from '../services/api';

export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', class_id: '', description: '', day_of_week: '', start_time: '', end_time: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    if (user?.role === 'teacher') {
      courseApi.my().then(r => setCourses(r.data));
    } else if (user?.role === 'student' && user.class_id) {
      courseApi.getByClass(user.class_id).then(r => setCourses(r.data));
    }
  };
  useEffect(() => { load(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...form, class_id: form.class_id ? parseInt(form.class_id) : null };
      if (editId) {
        await courseApi.update(editId, data);
        setMsg('Course updated');
      } else {
        await courseApi.create(data);
        setMsg('Course created');
      }
      setForm({ name: '', class_id: '', description: '', day_of_week: '', start_time: '', end_time: '' });
      setEditId(null);
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleEdit = (c: any) => {
    setEditId(c.id);
    setForm({ name: c.name, class_id: c.class_id || '', description: c.description || '', day_of_week: c.day_of_week || '', start_time: c.start_time || '', end_time: c.end_time || '' });
  };

  const handleDelete = async (id: number) => {
    try { await courseApi.delete(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  if (user?.role === 'teacher') {
    return (
      <div>
        <h1>My Courses</h1>
        {msg && <div className="alert alert-info">{msg}</div>}
        <div className="card">
          <h2>{editId ? 'Edit Course' : 'Add Course'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div><label>Course Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label>Class ID</label><input value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} placeholder="e.g. 1" /></div>
            </div>
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div className="form-row">
              <div><label>Day</label><select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div><label>Start</label><input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><label>End</label><input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Add Course'}</button>
            {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setForm({ name: '', class_id: '', description: '', day_of_week: '', start_time: '', end_time: '' }); }}>Cancel</button>}
          </form>
        </div>
        <div className="card">
          <h2>My Courses ({courses.length})</h2>
          {courses.length === 0 ? <p>No courses added yet.</p> : (
            <table>
              <thead><tr><th>Course</th><th>Class</th><th>Day</th><th>Time</th><th>Actions</th></tr></thead>
              <tbody>
                {courses.map((c: any) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong><br /><small>{c.description}</small></td>
                    <td>{c.class_name || '-'}</td>
                    <td>{c.day_of_week || '-'}</td>
                    <td>{c.start_time ? `${c.start_time.slice(0,5)}-${c.end_time?.slice(0,5)}` : '-'}</td>
                    <td><button className="btn btn-warning btn-sm" onClick={() => handleEdit(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Student view
  return (
    <div>
      <h1>My Courses</h1>
      <div className="card">
        {courses.length === 0 ? <p>No courses assigned to your class.</p> : (
          <div className="grid">
            {courses.map((c: any) => (
              <div key={c.id} className="card" style={{ cursor: 'pointer' }}>
                <h3>{c.name}</h3>
                <p><strong>Teacher:</strong> {c.teacher_name}</p>
                <p><strong>Day:</strong> {c.day_of_week || 'TBD'}</p>
                <p><strong>Time:</strong> {c.start_time ? `${c.start_time.slice(0,5)} - ${c.end_time?.slice(0,5)}` : 'TBD'}</p>
                {c.description && <p><small>{c.description}</small></p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
