import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceApi } from '../services/api';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';

export default function Register() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<number, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState(user?.role === 'teacher' && user?.class_id ? String(user.class_id) : '');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [showPrintPicker, setShowPrintPicker] = useState(false);
  const [printData, setPrintData] = useState<{ date: string; records: any[]; present: number; absent: number; late: number; excused: number } | null>(null);

  useEffect(() => {
    if (user?.role === 'teacher') {
      if (classId) {
        attendanceApi.students(parseInt(classId)).then(r => setStudents(r.data));
      }
      loadHistory();
    } else if (user?.role === 'student') {
      attendanceApi.my().then(r => setMyAttendance(r.data));
    }
  }, [user, classId]);

  const loadHistory = () => {
    attendanceApi.get({ class_id: classId || undefined }).then(r => setAttendanceHistory(r.data));
  };

  const loadForDate = async () => {
    if (!classId) return;
    const res = await attendanceApi.get({ class_id: parseInt(classId), date });
    if (res.data.length > 0) {
      const existing = res.data[0];
      const recMap: Record<number, string> = {};
      (existing.records || []).forEach((r: any) => { recMap[r.student_id] = r.status; });
      setRecords(recMap);
    } else {
      setRecords({});
    }
  };

  const markAll = (status: string) => {
    const updated: Record<number, string> = {};
    students.forEach(s => { updated[s.id] = status; });
    setRecords(updated);
  };

  const saveAttendance = async () => {
    if (!classId) { setMsg('Select a class first'); return; }
    const data = Object.entries(records).filter(([_, status]) => status).map(([student_id, status]) => ({ student_id: parseInt(student_id), status }));
    try {
      await attendanceApi.mark({ class_id: parseInt(classId), date, records: data });
      setMsg('Attendance saved');
      loadHistory();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const statusColors: Record<string, string> = { present: '#2e7d32', absent: '#c62828', late: '#f57f17', excused: '#1565c0' };

  if (user?.role === 'teacher') {
    const csvData = students.map(s => ({ 'Student': s.name, 'Status': records[s.id] || 'unmarked' }));
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div><h1 style={{ margin: 0 }}>Register / Attendance</h1><p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.8rem' }}>Chakari (GVT) Primary School — All records kept permanently</p></div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <PrintButton />
            <DownloadCSV data={csvData} headers={['Student', 'Status']} filename="attendance_register.csv" label=" CSV" />
            <button className="btn" style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }} onClick={() => setShowPrintPicker(true)}>🖨 Print Register</button>
          </div>
        </div>
        {msg && <div className="alert alert-info">{msg}</div>}

        <div className="card">
          <h2>Mark Register</h2>
          <div className="form-row">
            <div><label>Class</label><input value={classId} onChange={e => setClassId(e.target.value)} placeholder="e.g. 1" disabled={user?.role === 'teacher'} /></div>
            <div><label>Date</label><input type="date" value={date} onChange={e => { setDate(e.target.value); }} /></div>
          </div>
          {classId && <button className="btn btn-primary" onClick={loadForDate} style={{ marginBottom: '1rem' }}>Load Register</button>}

          {students.length > 0 && (
            <>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ marginRight: '0.5rem' }}>Mark all: </span>
                <button className="btn btn-success btn-sm" onClick={() => markAll('present')}>Present</button>
                <button className="btn btn-danger btn-sm" onClick={() => markAll('absent')}>Absent</button>
                <button className="btn btn-warning btn-sm" onClick={() => markAll('late')}>Late</button>
                <button className="btn btn-sm" style={{ background: '#1565c0', color: '#fff' }} onClick={() => markAll('excused')}>Excused</button>
              </div>
              <table>
                <thead><tr><th>#</th><th>Student</th><th>Status</th></tr></thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td>{s.name}</td>
                      <td>
                        <select value={records[s.id] || ''} onChange={e => setRecords({ ...records, [s.id]: e.target.value })} style={{ width: 'auto', margin: 0 }}>
                          <option value="">— Select —</option>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="late">Late</option>
                          <option value="excused">Excused</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-success" onClick={saveAttendance}>Save Register</button>
            </>
          )}
        </div>

        <div className="card">
          <h2>Attendance History (All Records — Permanent)</h2>
          <input placeholder="Search by date (YYYY-MM-DD)..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} style={{ marginBottom: '0.5rem', width: '100%' }} />
          {attendanceHistory.length === 0 ? <p>No records yet.</p> : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Date</th><th>Students</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Details</th></tr></thead>
                <tbody>
                  {attendanceHistory
                    .filter((a: any) => !historySearch || a.date.includes(historySearch))
                    .map((a: any) => {
                      const parsed = typeof a.records === 'string' ? JSON.parse(a.records) : (a.records || []);
                      const present = parsed.filter((r: any) => r.status === 'present').length;
                      const absent = parsed.filter((r: any) => r.status === 'absent').length;
                      const late = parsed.filter((r: any) => r.status === 'late').length;
                      const excused = parsed.filter((r: any) => r.status === 'excused').length;
                      return (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600 }}>{a.date}</td>
                          <td>{parsed.length}</td>
                          <td style={{ color: '#4ade80' }}>{present}</td>
                          <td style={{ color: '#f87171' }}>{absent}</td>
                          <td style={{ color: '#fbbf24' }}>{late}</td>
                          <td style={{ color: '#a78bfa' }}>{excused}</td>
                          <td>
                            <button className="btn btn-sm" onClick={() => setExpandedDate(expandedDate === a.date ? null : a.date)}
                              style={{ background: 'rgba(0,240,255,0.1)', color: 'var(--neon)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                              {expandedDate === a.date ? '▲ Hide' : '▼ View'}
                            </button>
                            {expandedDate === a.date && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', maxHeight: 200, overflowY: 'auto' }}>
                                {parsed.map((r: any, i: number) => {
                                  const s = students.find((st: any) => st.id === r.student_id);
                                  return (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      <span>{s?.name || `Student #${r.student_id}`}</span>
                                      <span style={{ color: r.status === 'present' ? '#4ade80' : r.status === 'absent' ? '#f87171' : r.status === 'late' ? '#fbbf24' : r.status === 'excused' ? '#a78bfa' : '#aaa', fontWeight: 600 }}>
                                        {r.status?.toUpperCase()}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Print Register Picker */}
        {showPrintPicker && <div className="modal-overlay" onClick={() => setShowPrintPicker(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h2>Select Register to Print</h2>
            {attendanceHistory.length === 0 ? <p>No attendance records yet.</p> : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {attendanceHistory.map((a: any) => {
                  const parsed = typeof a.records === 'string' ? JSON.parse(a.records) : (a.records || []);
                  return (
                    <div key={a.id} onClick={() => {
                      const present = parsed.filter((r: any) => r.status === 'present').length;
                      const absent = parsed.filter((r: any) => r.status === 'absent').length;
                      const late = parsed.filter((r: any) => r.status === 'late').length;
                      const excused = parsed.filter((r: any) => r.status === 'excused').length;
                      setPrintData({ date: a.date, records: parsed, present, absent, late, excused });
                      setShowPrintPicker(false);
                      setTimeout(() => window.print(), 300);
                    }} style={{ padding: '0.6rem 0.8rem', cursor: 'pointer', borderRadius: 6, marginBottom: '0.3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{a.date}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{parsed.length} students</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="btn" onClick={() => setShowPrintPicker(false)} style={{ marginTop: '0.5rem' }}>Cancel</button>
          </div>
        </div>}

        {/* Printable Register (hidden on screen) */}
        {printData && (
          <div style={{ display: 'none' }} className="print-register">
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Chakari (GVT) Primary School</h1>
              <p style={{ margin: 0 }}>Mashonaland West · Sanyati District</p>
              <h2 style={{ marginTop: '0.5rem' }}>Attendance Register — {printData.date}</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #000' }}>#</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #000' }}>Student Name</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #000' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {printData.records.map((r: any, i: number) => {
                  const s = students.find((st: any) => st.id === r.student_id);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                      <td style={{ padding: '4px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ccc' }}>{s?.name || `Student #${r.student_id}`}</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 600 }}>{r.status?.toUpperCase()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-around', fontSize: '0.9rem' }}>
              <span>Present: <strong>{printData.present}</strong></span>
              <span>Absent: <strong>{printData.absent}</strong></span>
              <span>Late: <strong>{printData.late}</strong></span>
              <span>Excused: <strong>{printData.excused}</strong></span>
              <span>Total: <strong>{printData.records.length}</strong></span>
            </div>
          </div>
        )}

        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-register, .print-register * { visibility: visible; }
            .print-register { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
            .print-register h1 { color: #000; }
            .print-register h2 { color: #333; }
            .print-register table { color: #000; }
          }
        `}</style>
      </div>
    );
  }

  // Student view
  const sCsvData = myAttendance.map(a => ({ 'Date': a.date, 'Status': a.status }));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div><h1 style={{ margin: 0 }}>My Attendance</h1><p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.8rem' }}>Chakari (GVT) Primary School</p></div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <PrintButton />
          <DownloadCSV data={sCsvData} headers={['Date', 'Status']} filename="my_attendance.csv" label=" CSV" />
        </div>
      </div>
      <div className="card">
        {myAttendance.length === 0 ? <p>No attendance records yet.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {myAttendance.map((a: any, i: number) => (
                <tr key={i}>
                  <td>{a.date}</td>
                  <td><span style={{ color: statusColors[a.status] || (a.status === 'excused' ? '#a78bfa' : '#333'), fontWeight: 'bold' }}>{a.status?.toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{myAttendance.length} total records — attendance history is permanent</p>
      </div>
    </div>
  );
}
