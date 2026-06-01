import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resultApi, adminApi } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

export default function StudentStats() {
  const { user } = useAuth();
  const [searchReg, setSearchReg] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user?.role === 'teacher' && user?.class_id) {
      adminApi.users().then((r: any) => {
        const arr = Array.isArray(r.data) ? r.data : (r.data?.users || []);
        const filtered = arr.filter((u: any) => u.role === 'student' && u.class_id === user.class_id);
        setStudents(filtered);
      }).catch(() => {});
    } else if (user?.role === 'admin' || user?.role === 'bursary') {
      const api = user?.role === 'bursary' ? resultApi.students() : adminApi.users();
      api.then((r: any) => {
        const arr = Array.isArray(r.data) ? r.data : (r.data?.users || r.data || []);
        setStudents(arr.filter((u: any) => u.role === 'student'));
      }).catch(() => {});
    }
  }, [user]);

  const loadStats = async (studentId: number) => {
    setLoading(true); setMsg('');
    try {
      const res = await resultApi.studentStats(studentId);
      setStats(res.data);
    } catch (err: any) {
      setStats(null);
      setMsg(err?.response?.data?.message || err?.message || 'Failed to load student stats');
    } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    const match = (s: any) => {
      if (searchReg && (s.student_number?.toLowerCase().includes(searchReg.toLowerCase()))) return true;
      if (searchName && s.name?.toLowerCase().includes(searchName.toLowerCase())) return true;
      return false;
    };
    const matches = students.filter(match);
    if (matches.length > 0) {
      setSelectedStudent(matches[0]);
      await loadStats(matches[0].id);
    } else {
      setMsg('No student found matching your search');
    }
  };

  const performanceBySubject = stats?.results?.length ? (() => {
    const map: Record<string, { total: number; count: number }> = {};
    stats.results.forEach((r: any) => {
      const sn = r.subject_name || 'Unknown';
      if (!map[sn]) map[sn] = { total: 0, count: 0 };
      const tot = (parseFloat(r.coursework||0) + parseFloat(r.test_score||0) + parseFloat(r.exam||0));
      map[sn].total += tot;
      map[sn].count++;
    });
    return Object.entries(map).map(([name, d]) => ({ subject: name, avg: Math.round(d.total / d.count) }));
  })() : [];

  const attData = stats?.attendance?.length ? [
    { name: 'Present', value: stats.attendance.filter((a: any) => a.status === 'present').length, color: '#4ade80' },
    { name: 'Late', value: stats.attendance.filter((a: any) => a.status === 'late').length, color: '#fbbf24' },
    { name: 'Absent', value: stats.attendance.filter((a: any) => a.status === 'absent').length, color: '#f87171' },
    { name: 'Excused', value: stats.attendance.filter((a: any) => a.status === 'excused').length, color: '#a78bfa' },
  ].filter(d => d.value > 0) : [];

  const filteredStudents = students.filter((s: any) => {
    if (!searchReg && !searchName) return false;
    const matchReg = searchReg ? s.student_number?.toLowerCase().includes(searchReg.toLowerCase()) : false;
    const matchName = searchName ? s.name?.toLowerCase().includes(searchName.toLowerCase()) : false;
    return matchReg || matchName;
  });

  return (
    <div>
      <h1>👤 Student Statistics</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>Chakari (GVT) Primary School — View full student profile</p>

      {msg && <div className="alert alert-error">{msg}</div>}

      <div className="card">
        <h2>Find Student</h2>
        <div className="form-row">
          <div><label>Registration Number</label><input value={searchReg} onChange={e => setSearchReg(e.target.value)} placeholder="e.g. c2600001c" /></div>
          <div><label>Or Name</label><input value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Search by name..." /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}><button className="btn btn-primary" onClick={handleSearch} disabled={loading}>{loading ? 'Loading...' : 'Search'}</button></div>
        </div>
        {filteredStudents.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.5rem', marginTop: '0.5rem' }}>
            {filteredStudents.slice(0, 20).map((s: any) => (
              <div key={s.id} 
                onClick={() => { setSelectedStudent(s); loadStats(s.id); }}
                style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', borderRadius: 4, background: selectedStudent?.id === s.id ? 'rgba(0,240,255,0.1)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span> <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{s.student_number}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedStudent && stats && (
        <>
          <div className="card">
            <h2>{selectedStudent.name} <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 'normal' }}>({selectedStudent.student_number})</span></h2>
            <p>Class ID: {selectedStudent.class_id} · Email: {selectedStudent.email || 'N/A'}</p>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div className="stat-card"><h3>{stats.results?.length || 0}</h3><p>Subjects</p></div>
            <div className="stat-card"><h3>{performanceBySubject.length ? Math.round(performanceBySubject.reduce((s: number, r: any) => s + r.avg, 0) / performanceBySubject.length) : 0}%</h3><p>Avg Score</p></div>
            <div className="stat-card"><h3>{stats.attendance?.length || 0}</h3><p>Days Recorded</p></div>
            <div className="stat-card"><h3>{attData.length ? Math.round((attData.find((d: any) => d.name === 'Present')?.value || 0) / (stats.attendance?.length || 1) * 100) : 0}%</h3><p>Attendance Rate</p></div>
            <div className="stat-card"><h3>{stats.homework?.length || 0}</h3><p>Homework Submissions</p></div>
            <div className="stat-card"><h3>{stats.quizzes?.length || 0}</h3><p>Quiz Attempts</p></div>
          </div>

          {performanceBySubject.length > 0 && (
            <div className="card">
              <h2>Performance by Subject</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={performanceBySubject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="avg" name="Average Score" fill="var(--neon)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {attData.length > 0 && (
              <div className="card">
                <h2>Attendance</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={attData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name, value}) => `${name}: ${value}`}>
                      {attData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {stats.sports?.length > 0 && (
              <div className="card">
                <h2>Sports</h2>
                {stats.sports.map((s: any, i: number) => (
                  <div key={i} style={{ padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong>{s.name}</strong> <span className="badge" style={{ background: s.role === 'captain' ? 'rgba(251,191,36,0.2)' : 'rgba(0,240,255,0.1)', color: s.role === 'captain' ? '#fbbf24' : 'var(--neon)' }}>{s.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {stats.results?.length > 0 && (
            <div className="card">
              <h2>Detailed Results</h2>
              <table>
                <thead><tr><th>Subject</th><th>Term</th><th>Year</th><th>CW</th><th>Test</th><th>Exam</th><th>Total</th><th>Grade</th><th>Remarks</th></tr></thead>
                <tbody>
                  {stats.results.map((r: any, i: number) => {
                    const tot = (parseFloat(r.coursework||0) + parseFloat(r.test_score||0) + parseFloat(r.exam||0));
                    return (
                      <tr key={i}>
                        <td>{r.subject_name}</td>
                        <td>{r.term}</td>
                        <td>{r.academic_year}</td>
                        <td>{r.coursework||0}</td>
                        <td>{r.test_score||0}</td>
                        <td>{r.exam||0}</td>
                        <td style={{ fontWeight: 'bold' }}>{tot}</td>
                        <td><span className="badge" style={{ background: tot >= 75 ? 'rgba(74,222,128,0.2)' : tot >= 65 ? 'rgba(34,211,238,0.2)' : tot >= 50 ? 'rgba(251,191,36,0.2)' : tot >= 40 ? 'rgba(248,113,113,0.2)' : 'rgba(167,139,250,0.2)', color: tot >= 75 ? '#4ade80' : tot >= 65 ? '#22d3ee' : tot >= 50 ? '#fbbf24' : tot >= 40 ? '#f87171' : '#a78bfa' }}>{r.grade || '-'}</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{r.remarks || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {stats.homework?.length > 0 && (
            <div className="card">
              <h2>Homework History</h2>
              <table>
                <thead><tr><th>Title</th><th>Submitted</th><th>Grade</th></tr></thead>
                <tbody>
                  {stats.homework.map((h: any, i: number) => (
                    <tr key={i}><td>{h.title}</td><td>{h.submitted_at?.slice(0,10)}</td><td>{h.grade || '-'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stats.quizzes?.length > 0 && (
            <div className="card">
              <h2>Quiz Attempts</h2>
              <table>
                <thead><tr><th>Quiz</th><th>Score</th><th>Date</th></tr></thead>
                <tbody>
                  {stats.quizzes.map((q: any, i: number) => (
                    <tr key={i}><td>{q.title}</td><td>{q.score}/{q.total}</td><td>{q.attempted_at?.slice(0,10)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
