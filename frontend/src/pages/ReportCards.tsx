import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resultApi, adminApi } from '../services/api';
import { PrintButton } from '../components/PrintDownload';

export default function ReportCards() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [term, setTerm] = useState('Term 2');
  const [year, setYear] = useState('2026');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') {
      adminApi.users().then((r: any) => setStudents((Array.isArray(r.data) ? r.data : []).filter((u: any) => u.role === 'student')));
    } else if (user?.role === 'teacher' && user?.class_id) {
      adminApi.users().then((r: any) => setStudents((Array.isArray(r.data) ? r.data : []).filter((u: any) => u.role === 'student' && u.class_id === user.class_id)));
    } else if (user?.role === 'student') {
      setSelectedId(user.id);
    }
  }, [user]);

  const loadReport = async (studentId: number) => {
    setLoading(true); setMsg('');
    try {
      const res = await resultApi.reportCard(studentId, { term, academic_year: year });
      setReport(res.data);
      setSelectedId(studentId);
    } catch (err: any) {
      setMsg(err?.response?.data?.message || 'Failed to load report card');
      setReport(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedId) loadReport(selectedId);
  }, [selectedId, term, year]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Report Cards</h1>
        <PrintButton />
      </div>

      {msg && <div className="alert alert-error">{msg}</div>}

      <div className="card">
        <div className="form-row">
          {user?.role !== 'student' && (
            <div>
              <label>Student</label>
              <select value={selectedId || ''} onChange={e => setSelectedId(parseInt(e.target.value))}>
                <option value="">— Select —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_number})</option>)}
              </select>
            </div>
          )}
          <div><label>Term</label><input value={term} onChange={e => setTerm(e.target.value)} placeholder="e.g. Term 2" /></div>
          <div><label>Year</label><input value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2026" /></div>
        </div>
      </div>

      {report && (
        <div className="card report-card-print">
          <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Chakari (GVT) Primary School</h2>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.85rem' }}>Mashonaland West · Sanyati District</p>
            <h3 style={{ margin: '0.5rem 0 0' }}>STUDENT REPORT CARD</h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{report.term} · {report.academic_year}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem' }}>
            <div><strong>Name:</strong> {report.student.name}</div>
            <div><strong>Class:</strong> {report.student.class_name || 'N/A'}</div>
            <div><strong>Reg #:</strong> {report.student.student_number}</div>
          </div>

          <table>
            <thead><tr><th>Subject</th><th>CW</th><th>Test</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead>
            <tbody>
              {report.results.map((r: any, i: number) => {
                const tot = parseFloat(r.coursework||0) + parseFloat(r.test_score||0) + parseFloat(r.exam||0);
                const grade = tot >= 75 ? 'A' : tot >= 65 ? 'B' : tot >= 50 ? 'C' : tot >= 40 ? 'D' : 'E';
                return (
                  <tr key={i}>
                    <td>{r.subject_name}</td>
                    <td>{r.coursework||0}</td>
                    <td>{r.test_score||0}</td>
                    <td>{r.exam||0}</td>
                    <td style={{ fontWeight: 700 }}>{tot}</td>
                    <td><span style={{ color: grade === 'A' ? '#4ade80' : grade === 'B' ? '#22d3ee' : grade === 'C' ? '#fbbf24' : grade === 'D' ? '#f87171' : '#a78bfa', fontWeight: 700 }}>{grade}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-around', fontSize: '0.9rem' }}>
            <div><strong>Average Score:</strong> {report.avgScore}%</div>
            <div><strong>Subjects:</strong> {report.results.length}</div>
          </div>

          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.entries(report.gradeCounts).map(([g, c]) => (
              <span key={g} className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: g === 'A' ? '#4ade80' : g === 'B' ? '#22d3ee' : g === 'C' ? '#fbbf24' : g === 'D' ? '#f87171' : '#a78bfa', padding: '0.25rem 0.75rem' }}>
                {g}: {c as number}
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .navbar, .btn { display: none !important; }
          .report-card-print { border: none !important; }
          .report-card-print h2, .report-card-print h3 { color: #000 !important; }
          .report-card-print table { color: #000 !important; }
          .report-card-print table th { background: #f0f0f0 !important; color: #000 !important; }
        }
      `}</style>
    </div>
  );
}
