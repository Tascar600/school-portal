import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resultApi, subjectApi } from '../services/api';

export default function Results() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [form, setForm] = useState({ student_id: '', subject_id: '', term: 'Term 1', academic_year: new Date().getFullYear().toString(), score: '', grade: '', remarks: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    if (user?.role === 'student') resultApi.my().then(r => setResults(r.data));
    else if (user?.role === 'teacher') resultApi.entered().then(r => setResults(r.data));
    else if (user?.role === 'admin') resultApi.all().then(r => setResults(r.data));
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (user?.role === 'teacher' && user?.class_id) {
      subjectApi.byClass(user.class_id).then(r => setSubjects(r.data)).catch(() => {});
      subjectApi.studentsByClass(user.class_id).then(r => setStudents(r.data)).catch(() => {});
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await resultApi.update(editId, { score: form.score, grade: form.grade, remarks: form.remarks });
      } else {
        await resultApi.create(form);
      }
      setMsg(editId ? 'Result updated' : 'Result created');
      setForm({ student_id: '', subject_id: '', term: 'Term 1', academic_year: new Date().getFullYear().toString(), score: '', grade: '', remarks: '' });
      setEditId(null);
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      student_id: r.student_id,
      subject_id: r.subject_id,
      term: r.term,
      academic_year: r.academic_year,
      score: r.score?.toString() || '',
      grade: r.grade || '',
      remarks: r.remarks || '',
    });
  };

  const handleDelete = async (id: number) => {
    try { await resultApi.delete(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <h1>Results</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {(user?.role === 'teacher' || user?.role === 'admin') && (
        <div className="card">
          <h2>{editId ? 'Edit Result' : 'Enter Result'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div>
                <label>Student</label>
                {user?.role === 'teacher' && students.length > 0 ? (
                  <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required disabled={!!editId}>
                    <option value="">— Select Student —</option>
                    {students.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <input value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required disabled={!!editId} placeholder="Student ID" />
                )}
              </div>
              <div>
                <label>Subject</label>
                {user?.role === 'teacher' && subjects.length > 0 ? (
                  <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required disabled={!!editId}>
                    <option value="">— Select Subject —</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <input value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required disabled={!!editId} placeholder="Subject ID" />
                )}
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>Term</label>
                <select value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} disabled={!!editId}>
                  <option>Term 1</option><option>Term 2</option><option>Term 3</option>
                </select>
              </div>
              <div>
                <label>Year</label>
                <input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} disabled={!!editId} />
              </div>
              <div>
                <label>Score</label>
                <input type="number" step="0.01" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} required />
              </div>
              <div>
                <label>Grade</label>
                <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} />
              </div>
            </div>
            <label>Remarks</label>
            <textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
            <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Save Result'}</button>
            {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setForm({ student_id: '', subject_id: '', term: 'Term 1', academic_year: new Date().getFullYear().toString(), score: '', grade: '', remarks: '' }); }}>Cancel</button>}
          </form>
        </div>
      )}

      <div className="card">
        <h2>{user?.role === 'student' ? 'My Results' : 'All Results'}</h2>
        {results.length === 0 ? <p>No results found.</p> : (
          <table>
            <thead>
              <tr>
                {user?.role !== 'student' && <th>Student</th>}
                <th>Subject</th><th>Term</th><th>Year</th><th>Score</th><th>Grade</th>
                {user?.role !== 'student' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {results.map((r: any) => (
                <tr key={r.id}>
                  {user?.role !== 'student' && <td>{r.student_name}</td>}
                  <td>{r.subject_name}</td>
                  <td>{r.term}</td>
                  <td>{r.academic_year}</td>
                  <td>{r.score}</td>
                  <td>{r.grade || '-'}</td>
                  {user?.role !== 'student' && (
                    <td>
                      <button className="btn btn-warning btn-sm" onClick={() => handleEdit(r)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
