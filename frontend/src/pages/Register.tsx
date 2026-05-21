import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceApi } from '../services/api';

export default function Register() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<number, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState(user?.role === 'teacher' && user?.class_id ? String(user.class_id) : '');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

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
      // Initialize all as present
      const init: Record<number, string> = {};
      students.forEach(s => { init[s.id] = 'present'; });
      setRecords(init);
    }
  };

  const markAll = (status: string) => {
    const updated: Record<number, string> = {};
    students.forEach(s => { updated[s.id] = status; });
    setRecords(updated);
  };

  const saveAttendance = async () => {
    if (!classId) { setMsg('Select a class first'); return; }
    const data = Object.entries(records).map(([student_id, status]) => ({ student_id: parseInt(student_id), status }));
    try {
      await attendanceApi.mark({ class_id: parseInt(classId), date, records: data });
      setMsg('Attendance saved');
      loadHistory();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const statusColors: Record<string, string> = { present: '#2e7d32', absent: '#c62828', late: '#f57f17', excused: '#1565c0' };

  if (user?.role === 'teacher') {
    return (
      <div>
        <h1>Register / Attendance</h1>
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
                        <select value={records[s.id] || 'present'} onChange={e => setRecords({ ...records, [s.id]: e.target.value })} style={{ width: 'auto', margin: 0 }}>
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
          <h2>Attendance History</h2>
          {attendanceHistory.length === 0 ? <p>No records yet.</p> : attendanceHistory.slice(0, 10).map((a: any) => (
            <div key={a.id} style={{ borderBottom: '1px solid #e0e0e0', padding: '0.5rem 0' }}>
              <strong>{a.date}</strong> - {a.records?.length || 0} students marked
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Student view
  return (
    <div>
      <h1>My Attendance</h1>
      <div className="card">
        {myAttendance.length === 0 ? <p>No attendance records yet.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {myAttendance.map((a: any, i: number) => (
                <tr key={i}>
                  <td>{a.date}</td>
                  <td><span style={{ color: statusColors[a.status] || '#333', fontWeight: 'bold' }}>{a.status?.toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
