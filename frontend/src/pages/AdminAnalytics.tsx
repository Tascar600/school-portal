import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resultApi, adminApi, analyticsApi } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, CartesianGrid } from 'recharts';

const COLORS = ['#22d3ee', '#fbbf24', '#f87171', '#4ade80', '#a78bfa', '#f472b6'];

export default function AdminAnalytics() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classSummary, setClassSummary] = useState<any[]>([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any[]>([]);
  const [sportsStats, setSportsStats] = useState<any[]>([]);
  const [homeworkStats, setHomeworkStats] = useState<any[]>([]);
  const [tab, setTab] = useState('performance');

  useEffect(() => {
    adminApi.classes().then(r => setClasses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    resultApi.classSummary(parseInt(selectedClass)).then(r => setClassSummary(r.data)).catch(() => {});
    resultApi.subjectBreakdown(parseInt(selectedClass)).then(r => setSubjectBreakdown(r.data)).catch(() => {});
    analyticsApi.attendance(parseInt(selectedClass)).then(r => setAttendanceStats(r.data)).catch(() => {});
    analyticsApi.sports(parseInt(selectedClass)).then(r => setSportsStats(r.data)).catch(() => {});
    analyticsApi.homework(parseInt(selectedClass)).then(r => setHomeworkStats(r.data)).catch(() => {});
  }, [selectedClass]);

  const cls = classes.find((c:any) => c.id === parseInt(selectedClass));
  const gradeDist = subjectBreakdown.length ? [
    { name: 'A (75+)', value: classSummary.reduce((s:number, r:any) => s + (r.As||0), 0), color: '#4ade80' },
    { name: 'B (65-74)', value: classSummary.reduce((s:number, r:any) => s + (r.Bs||0), 0), color: '#22d3ee' },
    { name: 'C (50-64)', value: classSummary.reduce((s:number, r:any) => s + (r.Cs||0), 0), color: '#fbbf24' },
    { name: 'D (40-49)', value: classSummary.reduce((s:number, r:any) => s + (r.Ds||0), 0), color: '#f87171' },
    { name: 'E (<40)', value: classSummary.reduce((s:number, r:any) => s + (r.Es||0), 0), color: '#a78bfa' },
  ].filter(d => d.value > 0) : [];

  const avgScoreData = subjectBreakdown.map((s:any) => ({
    name: (s.subject_name||'').length > 8 ? s.subject_name.slice(0,8)+'...' : s.subject_name,
    Avg: Math.round(s.avg_score||0),
    CW: Math.round(s.avg_coursework||0),
    Test: Math.round(s.avg_test||0),
    Exam: Math.round(s.avg_exam||0),
  }));

  const attPctData = attendanceStats.filter((s:any) => s.total > 0).map((s:any) => ({
    name: (s.name||'').split(' ')[0],
    Attendance: s.attendance_pct,
    Absent: 100 - s.attendance_pct,
  }));

  return (
    <div>
      <h1>📊 Class Analytics</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>Chakari (GVT) Primary School — Performance Dashboard</p>

      <div className="card">
        <div className="form-row">
          <div>
            <label>Select Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">— Choose Class —</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
            <button className={`btn ${tab === 'performance' ? 'btn-primary' : ''}`} onClick={() => setTab('performance')}>Performance</button>
            <button className={`btn ${tab === 'attendance' ? 'btn-primary' : ''}`} onClick={() => setTab('attendance')}>Attendance</button>
            <button className={`btn ${tab === 'sports' ? 'btn-primary' : ''}`} onClick={() => setTab('sports')}>Sports</button>
            <button className={`btn ${tab === 'homework' ? 'btn-primary' : ''}`} onClick={() => setTab('homework')}>Homework</button>
          </div>
        </div>
      </div>

      {!selectedClass && <div className="card"><p style={{ color: 'var(--text-dim)', textAlign: 'center' }}>Select a class above to view analytics</p></div>}

      {selectedClass && tab === 'performance' && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="stat-card"><h3>{classSummary.length}</h3><p>Students</p></div>
            <div className="stat-card"><h3>{subjectBreakdown.length}</h3><p>Subjects</p></div>
            <div className="stat-card"><h3>{classSummary.length ? Math.round(classSummary.reduce((s:number,r:any)=>s+r.avg_score,0)/classSummary.length) : 0}%</h3><p>Class Avg</p></div>
            <div className="stat-card"><h3>{gradeDist.reduce((s:number,d:any)=>s+d.value,0)}</h3><p>Total Grades</p></div>
          </div>

          <div className="card">
            <h2>Grade Distribution (Pie)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={gradeDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name, value}) => `${name}: ${value}`}>
                  {gradeDist.map((e:any,i:number) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2>Subject Average Scores (Bar)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={avgScoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="CW" stackId="a" fill="#22d3ee" />
                <Bar dataKey="Test" stackId="a" fill="#fbbf24" />
                <Bar dataKey="Exam" stackId="a" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2>Student Rankings (by average score)</h2>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>#</th><th>Student</th><th>Reg No</th><th>Avg Score</th><th>Subjects</th><th>A's</th><th>B's</th><th>C's</th><th>D's</th><th>E's</th></tr></thead>
                <tbody>
                  {classSummary.map((r:any, i:number) => (
                    <tr key={r.student_id}>
                      <td>{i+1}</td>
                      <td>{r.student_name}</td>
                      <td style={{ fontSize: '0.8rem' }}>{r.student_number}</td>
                      <td style={{ fontWeight: 'bold', color: r.avg_score >= 75 ? '#4ade80' : r.avg_score >= 65 ? '#22d3ee' : r.avg_score >= 50 ? '#fbbf24' : r.avg_score >= 40 ? '#f87171' : '#a78bfa' }}>{Math.round(r.avg_score)}%</td>
                      <td>{r.subjects_count}</td>
                      <td style={{ color: '#4ade80' }}>{r.As||0}</td>
                      <td style={{ color: '#22d3ee' }}>{r.Bs||0}</td>
                      <td style={{ color: '#fbbf24' }}>{r.Cs||0}</td>
                      <td style={{ color: '#f87171' }}>{r.Ds||0}</td>
                      <td style={{ color: '#a78bfa' }}>{r.Es||0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedClass && tab === 'attendance' && (
        <>
          <div className="card">
            <h2>Attendance Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="stat-card"><h3>{attendanceStats.length}</h3><p>Students Tracked</p></div>
              <div className="stat-card"><h3>{attendanceStats.length ? Math.round(attendanceStats.reduce((s:number,r:any)=>s+r.attendance_pct,0)/attendanceStats.length) : 0}%</h3><p>Avg Attendance</p></div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceStats.filter((s:any) => s.total > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="attendance_pct" name="Attendance %" fill="#4ade80" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h2>Detailed Attendance</h2>
            <table>
              <thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>%</th></tr></thead>
              <tbody>
                {attendanceStats.filter((s:any) => s.total > 0).map((s:any, i:number) => (
                  <tr key={i}>
                    <td>{s.name}</td>
                    <td style={{ color: '#4ade80' }}>{s.present}</td>
                    <td style={{ color: '#f87171' }}>{s.absent}</td>
                    <td style={{ color: '#fbbf24' }}>{s.late}</td>
                    <td>{s.total}</td>
                    <td><span className="badge" style={{ background: s.attendance_pct >= 80 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)', color: s.attendance_pct >= 80 ? '#4ade80' : '#f87171' }}>{s.attendance_pct}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedClass && tab === 'sports' && (
        <div className="card">
          <h2>Sports Participation</h2>
          {sportsStats.length === 0 ? <p>No sports data for this class</p> : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sportsStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="sport_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="participants" name="Participants" fill="#22d3ee" />
                  <Bar dataKey="captains" name="Captains" fill="#fbbf24" />
                </BarChart>
              </ResponsiveContainer>
              <table>
                <thead><tr><th>Sport</th><th>Participants</th><th>Captains</th></tr></thead>
                <tbody>
                  {sportsStats.map((s:any, i:number) => (
                    <tr key={i}><td>{s.sport_name}</td><td>{s.participants}</td><td>{s.captains}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {selectedClass && tab === 'homework' && (
        <div className="card">
          <h2>Homework Completion</h2>
          {homeworkStats.length === 0 ? <p>No homework data</p> : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={homeworkStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_hw" name="Assigned" fill="#22d3ee" />
                  <Bar dataKey="submitted" name="Submitted" fill="#4ade80" />
                </BarChart>
              </ResponsiveContainer>
              <table>
                <thead><tr><th>Student</th><th>Reg</th><th>Assigned</th><th>Submitted</th><th>Avg Grade</th></tr></thead>
                <tbody>
                  {homeworkStats.map((s:any, i:number) => (
                    <tr key={i}>
                      <td>{s.name}</td>
                      <td style={{ fontSize: '0.8rem' }}>{s.student_number}</td>
                      <td>{s.total_hw}</td>
                      <td>{s.submitted}</td>
                      <td>{s.avg_grade ? Math.round(s.avg_grade) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
