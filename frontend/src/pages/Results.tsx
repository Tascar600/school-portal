import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resultApi, subjectApi } from '../services/api';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const GRADE_COLORS = ['#4ade80', '#22d3ee', '#fbbf24', '#f87171', '#a78bfa'];

export default function Results() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ student_id: '', subject_name: '', term: 'Term 2', academic_year: new Date().getFullYear().toString(), coursework: '', test_score: '', exam: '', grade: '', remarks: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    if (user?.role === 'student') {
      resultApi.my().then(r => setResults(r.data));
    } else if (user?.role === 'teacher') {
      resultApi.entered({ term: filterTerm || undefined, status: filterStatus || undefined }).then(r => setResults(r.data));
    } else if (user?.role === 'admin') {
      resultApi.all({ term: filterTerm || undefined }).then(r => setResults(r.data));
    }
  };

  useEffect(() => { load(); }, [user, filterTerm, filterStatus]);

  useEffect(() => {
    if (user?.role === 'teacher' && user?.class_id) {
      subjectApi.studentsByClass(user.class_id).then(r => setStudents(r.data)).catch(() => {});
    } else if (user?.role === 'admin') {
      // Admin can get students via another mechanism - but for simplicity, fetch when needed
    }
  }, [user]);

  useEffect(() => {
    // Auto-calculate grade when coursework, test, or exam changes
    const cw = parseFloat(form.coursework) || 0;
    const ts = parseFloat(form.test_score) || 0;
    const ex = parseFloat(form.exam) || 0;
    const total = cw + ts + ex;
    let grade = '';
    if (total >= 75) grade = 'A';
    else if (total >= 65) grade = 'B';
    else if (total >= 50) grade = 'C';
    else if (total >= 40) grade = 'D';
    else if (total > 0) grade = 'E';
    setForm(f => ({ ...f, grade }));
  }, [form.coursework, form.test_score, form.exam]);

  const getTotal = (r: any) => (parseFloat(r.coursework||0) + parseFloat(r.test_score||0) + parseFloat(r.exam||0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, student_id: parseInt(form.student_id), coursework: parseFloat(form.coursework) || 0, test_score: parseFloat(form.test_score) || 0, exam: parseFloat(form.exam) || 0 };
      if (editId) {
        await resultApi.update(editId, payload);
        setMsg('Result updated');
      } else {
        await resultApi.create(payload);
        setMsg('Result created');
      }
      setForm({ student_id: '', subject_name: '', term: 'Term 2', academic_year: new Date().getFullYear().toString(), coursework: '', test_score: '', exam: '', grade: '', remarks: '' });
      setEditId(null);
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      student_id: r.student_id,
      subject_name: r.subject_name || '',
      term: r.term,
      academic_year: r.academic_year,
      coursework: r.coursework?.toString() || '',
      test_score: r.test_score?.toString() || '',
      exam: r.exam?.toString() || '',
      grade: r.grade || '',
      remarks: r.remarks || '',
    });
  };

  const handleDelete = async (id: number) => {
    try { await resultApi.delete(id); load(); } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleArchive = async () => {
    const term = prompt('Enter term to archive (e.g. Term 2):');
    if (!term) return;
    const year = prompt('Enter academic year (e.g. 2026):');
    if (!year) return;
    try { await resultApi.archiveTerm({ term, academic_year: year }); setMsg('Term archived'); load(); } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const filtered = results.filter(r => {
    const name = (r.student_name || '').toLowerCase();
    const subj = (r.subject_name || '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || subj.includes(q);
  });

  // Stats for charts
  const gradeDist = results.length ? [
    { name: 'A', value: results.filter(r => (getTotal(r) >= 75)).length, color: '#4ade80' },
    { name: 'B', value: results.filter(r => getTotal(r) >= 65 && getTotal(r) < 75).length, color: '#22d3ee' },
    { name: 'C', value: results.filter(r => getTotal(r) >= 50 && getTotal(r) < 65).length, color: '#fbbf24' },
    { name: 'D', value: results.filter(r => getTotal(r) >= 40 && getTotal(r) < 50).length, color: '#f87171' },
    { name: 'E', value: results.filter(r => getTotal(r) < 40).length, color: '#a78bfa' },
  ] : [];

  // Subject averages for bar chart
  const subjectAverages = (() => {
    const map: Record<string, { total: number; count: number; cw: number; ts: number; ex: number }> = {};
    results.filter(r => r.status !== 'archived').forEach(r => {
      const sn = r.subject_name || 'Unknown';
      if (!map[sn]) map[sn] = { total: 0, count: 0, cw: 0, ts: 0, ex: 0 };
      map[sn].total += getTotal(r);
      map[sn].count++;
      map[sn].cw += parseFloat(r.coursework||0);
      map[sn].ts += parseFloat(r.test_score||0);
      map[sn].ex += parseFloat(r.exam||0);
    });
    return Object.entries(map).map(([name, d]) => ({
      name: name.length > 10 ? name.slice(0, 10) + '...' : name,
      avg: Math.round(d.total / d.count),
      coursework: Math.round(d.cw / d.count),
      test: Math.round(d.ts / d.count),
      exam: Math.round(d.ex / d.count),
    }));
  })();

  const csvData = filtered.map(r => ({
    Student: r.student_name || '',
    Subject: r.subject_name,
    Term: r.term,
    Year: r.academic_year,
    Coursework: r.coursework || 0,
    Test: r.test_score || 0,
    Exam: r.exam || 0,
    Total: getTotal(r),
    Grade: r.grade || '-',
    Remarks: r.remarks || '',
    Status: r.status || 'active',
  }));

  const canEdit = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Chakari (GVT) Primary School</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Mashonaland West · Sanyati District · Results Management</p>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <PrintButton />
          <DownloadCSV data={csvData} headers={['Student', 'Subject', 'Term', 'Year', 'Coursework', 'Test', 'Exam', 'Total', 'Grade', 'Remarks', 'Status']} filename="results.csv" label=" CSV" />
          {user?.role === 'admin' && <button className="btn btn-warning" onClick={handleArchive}>📦 Archive Term</button>}
        </div>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      {/* Teacher/Admin Entry Form */}
      {canEdit && (
        <div className="card">
          <h2>{editId ? 'Edit Result' : 'Enter New Result'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div>
                <label>Student</label>
                {students.length > 0 ? (
                  <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required disabled={!!editId}>
                    <option value="">— Select —</option>
                    {students.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <input value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required disabled={!!editId} placeholder="Student ID" />
                )}
              </div>
              <div>
                <label>Subject <span style={{color:'var(--text-dim)',fontSize:'0.75rem'}}>(type subject name)</span></label>
                <input value={form.subject_name} onChange={e => setForm({ ...form, subject_name: e.target.value })} required placeholder="e.g. ChiShona, English, Maths" list="subjects" />
                <datalist id="subjects">
                  <option value="ChiShona" /><option value="English" /><option value="Mathematics" /><option value="General Science" /><option value="Social Studies" />
                  <option value="Agriculture" /><option value="ICT" /><option value="Art & Design" /><option value="Physical Education" /><option value="Music" />
                  <option value="Heritage Studies" /><option value="Family & Religion" /><option value="Home Economics" /><option value="Indigenous Languages" />
                </datalist>
              </div>
            </div>
            <div className="form-row">
              <div><label>Term</label><select value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} disabled={!!editId}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></div>
              <div><label>Year</label><input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} disabled={!!editId} /></div>
              <div><label>Coursework</label><input type="number" min="0" max="100" value={form.coursework} onChange={e => setForm({ ...form, coursework: e.target.value })} /></div>
              <div><label>Test</label><input type="number" min="0" max="100" value={form.test_score} onChange={e => setForm({ ...form, test_score: e.target.value })} /></div>
              <div><label>Exam</label><input type="number" min="0" max="100" value={form.exam} onChange={e => setForm({ ...form, exam: e.target.value })} /></div>
              <div><label>Grade</label><input value={form.grade} readOnly style={{ fontWeight: 'bold', color: form.grade === 'A' ? '#4ade80' : form.grade === 'B' ? '#22d3ee' : form.grade === 'C' ? '#fbbf24' : form.grade === 'D' ? '#f87171' : form.grade === 'E' ? '#ef4444' : 'inherit' }} /></div>
            </div>
            <div className="form-row">
              <div style={{ flex: 1 }}><label>Teacher Remarks</label><textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--neon)' }}>Total: {parseFloat(form.coursework||'0') + parseFloat(form.test_score||'0') + parseFloat(form.exam||'0')}</div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Save Result'}</button>
            {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setForm({ student_id: '', subject_name: '', term: 'Term 2', academic_year: new Date().getFullYear().toString(), coursework: '', test_score: '', exam: '', grade: '', remarks: '' }); }}>Cancel</button>}
          </form>
        </div>
      )}

      {/* Charts */}
      {results.length > 0 && (
        <div className="card">
          <h2>Statistics Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Grade Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={gradeDist.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name, value}) => `${name}: ${value}`}>
                    {gradeDist.filter(d => d.value > 0).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Average Scores by Subject</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={subjectAverages}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="coursework" name="Coursework" fill="#22d3ee" stackId="a" />
                  <Bar dataKey="test" name="Test" fill="#fbbf24" stackId="a" />
                  <Bar dataKey="exam" name="Exam" fill="#f87171" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="card">
        <h2>{user?.role === 'student' ? 'My Results' : 'All Results'}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input placeholder="Search by name or subject..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          {canEdit && (
            <>
              <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} style={{ width: 'auto' }}>
                <option value="">All Terms</option>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </>
          )}
        </div>
        {filtered.length === 0 ? <p>No results found.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {user?.role !== 'student' && <th>Student</th>}
                  <th>Subject</th>
                  <th>Term</th>
                  <th>Coursework</th>
                  <th>Test</th>
                  <th>Exam</th>
                  <th>Total</th>
                  <th>Grade</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => {
                  const total = getTotal(r);
                  return (
                    <tr key={r.id}>
                      {user?.role !== 'student' && <td>{r.student_name}</td>}
                      <td>{r.subject_name}</td>
                      <td>{r.term}</td>
                      <td>{r.coursework || 0}</td>
                      <td>{r.test_score || 0}</td>
                      <td>{r.exam || 0}</td>
                      <td style={{ fontWeight: 'bold' }}>{total}</td>
                      <td><span className="badge" style={{ background: total >= 75 ? 'rgba(74,222,128,0.2)' : total >= 65 ? 'rgba(34,211,238,0.2)' : total >= 50 ? 'rgba(251,191,36,0.2)' : total >= 40 ? 'rgba(248,113,113,0.2)' : 'rgba(167,139,250,0.2)', color: total >= 75 ? '#4ade80' : total >= 65 ? '#22d3ee' : total >= 50 ? '#fbbf24' : total >= 40 ? '#f87171' : '#a78bfa' }}>{r.grade || '-'}</span></td>
                      <td style={{ fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.remarks || '-'}</td>
                      <td><span className="badge" style={{ background: r.status === 'archived' ? 'rgba(100,100,100,0.2)' : 'rgba(74,222,128,0.2)', color: r.status === 'archived' ? '#aaa' : '#4ade80' }}>{r.status}</span></td>
                      {canEdit && (
                        <td>
                          <button className="btn btn-warning btn-sm" onClick={() => handleEdit(r)}>Edit</button>
                          {user?.role === 'admin' && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Del</button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Showing {filtered.length} of {results.length} results</p>
      </div>

      {/* Per-subject mini charts for each result (student view) */}
      {user?.role === 'student' && results.length > 0 && (
        <div className="card">
          <h2>Performance Breakdown</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {results.map(r => {
              const barData = [
                { name: 'CW', score: parseFloat(r.coursework||0) },
                { name: 'Test', score: parseFloat(r.test_score||0) },
                { name: 'Exam', score: parseFloat(r.exam||0) },
              ];
              return (
                <div key={r.id} className="stat-card">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{r.subject_name}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{r.term} {r.academic_year} · Grade: <strong style={{ color: getTotal(r) >= 75 ? '#4ade80' : getTotal(r) >= 65 ? '#22d3ee' : getTotal(r) >= 50 ? '#fbbf24' : getTotal(r) >= 40 ? '#f87171' : '#a78bfa' }}>{r.grade}</strong></p>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={barData}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="score" fill="var(--neon)" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {r.remarks && <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem', fontStyle: 'italic' }}>"{r.remarks}"</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
