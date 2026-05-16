import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { homeworkApi } from '../services/api';

export default function Homework() {
  const { user } = useAuth();
  const [homework, setHomework] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [viewSubId, setViewSubId] = useState<number | null>(null);
  const [form, setForm] = useState({ class_id: '', subject_id: '', title: '', description: '', due_date: '' });
  const [msg, setMsg] = useState('');

  const load = () => {
    if (user?.role === 'teacher') homeworkApi.myClasses().then(r => setHomework(r.data));
    else if (user?.role === 'student') homeworkApi.my().then(r => setHomework(r.data));
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await homeworkApi.create({ ...form, due_date: new Date(form.due_date).toISOString() });
      setMsg('Homework assigned');
      setForm({ class_id: '', subject_id: '', title: '', description: '', due_date: '' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleSubmit = async (homeworkId: number, e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    const fileInput = (e.target as HTMLFormElement).querySelector('input[type="file"]') as HTMLInputElement;
    const notesInput = (e.target as HTMLFormElement).querySelector('textarea') as HTMLTextAreaElement;
    if (fileInput?.files?.[0]) fd.append('file', fileInput.files[0]);
    fd.append('notes', notesInput?.value || '');
    try {
      await homeworkApi.submit(homeworkId, fd);
      setMsg('Homework submitted');
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const viewSubmissions = async (id: number) => {
    try {
      const res = await homeworkApi.submissions(id);
      setSubmissions(res.data);
      setViewSubId(id);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleGrade = async (submissionId: number) => {
    const grade = prompt('Enter grade:');
    if (grade === null) return;
    try {
      await homeworkApi.grade(submissionId, { grade: parseFloat(grade), feedback: prompt('Feedback:') || '' });
      setMsg('Graded');
      if (viewSubId) viewSubmissions(viewSubId);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    try { await homeworkApi.delete(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <h1>Homework</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {user?.role === 'teacher' && (
        <>
          <div className="card">
            <h2>Assign Homework</h2>
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
              <label>Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <label>Due Date</label>
              <input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required />
              <button type="submit" className="btn btn-primary">Assign Homework</button>
            </form>
          </div>

          <div className="card">
            <h2>My Homework Assignments</h2>
            {homework.length === 0 ? <p>No homework assigned.</p> : (
              <table>
                <thead><tr><th>Title</th><th>Class</th><th>Subject</th><th>Due</th><th>Actions</th></tr></thead>
                <tbody>
                  {homework.map((h: any) => (
                    <tr key={h.id}>
                      <td>{h.title}</td>
                      <td>{h.class_name}</td>
                      <td>{h.subject_name}</td>
                      <td>{new Date(h.due_date).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => viewSubmissions(h.id)}>Submissions</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(h.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {user?.role === 'student' && (
        <div className="card">
          <h2>My Homework</h2>
          {homework.length === 0 ? <p>No homework assigned.</p> : homework.map((h: any) => (
            <div key={h.id} style={{ borderBottom: '1px solid #e0e0e0', padding: '1rem 0' }}>
              <h3>{h.title}</h3>
              <p style={{ color: '#666' }}>{h.subject_name} - Due: {new Date(h.due_date).toLocaleString()}</p>
              <p>{h.description}</p>
              {h.submission ? (
                <div className="alert alert-success">
                  Submitted {new Date(h.submission.submitted_at).toLocaleString()}
                  {h.submission.grade !== null && <span> | Grade: {h.submission.grade}</span>}
                  {h.submission.feedback && <span> | Feedback: {h.submission.feedback}</span>}
                </div>
              ) : new Date(h.due_date) > new Date() ? (
                <form onSubmit={(e) => handleSubmit(h.id, e)}>
                  <textarea placeholder="Notes (optional)" style={{ marginBottom: '0.5rem' }} />
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                  <button type="submit" className="btn btn-primary btn-sm">Submit</button>
                </form>
              ) : (
                <div className="alert alert-error">Past due date</div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewSubId && (
        <div className="modal-overlay" onClick={() => setViewSubId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Submissions</h2>
            {submissions.length === 0 ? <p>No submissions yet.</p> : (
              <table>
                <thead><tr><th>Student</th><th>File</th><th>Submitted</th><th>Grade</th><th>Actions</th></tr></thead>
                <tbody>
                  {submissions.map((s: any) => (
                    <tr key={s.id}>
                      <td>{s.student_name}</td>
                      <td>{s.file ? <a href={`http://localhost:5000${s.file}`} target="_blank" rel="noreferrer">View</a> : '-'}</td>
                      <td>{new Date(s.submitted_at).toLocaleString()}</td>
                      <td>{s.grade !== null ? s.grade : '-'}</td>
                      <td><button className="btn btn-warning btn-sm" onClick={() => handleGrade(s.id)}>Grade</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn" onClick={() => setViewSubId(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
