import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useChild } from '../contexts/ChildContext';
import { useAuth, ROLE_LABEL } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
import { dashboardApi, passwordApi } from '../services/api';
import { money } from '../utils/money';
import { fmtDate, todayIso } from '../utils/dates';
import { BackupNotice } from '../components/Backups';

function Kpi({ value, label, tone }: { value: string | number; label: string; tone?: 'good' | 'bad' | 'warn' | 'info' }) {
  return (
    <div className={`kpi${tone ? ` ${tone}` : ''}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [data, setData] = useState<any>(null);
  const [pendingResets, setPendingResets] = useState(0);
  const { choose } = useChild();
  const navigate = useNavigate();
  const go = (id: number, path: string) => { choose(id); navigate(path); };

  useEffect(() => {
    if (user?.role === 'bursary') return;
    dashboardApi.get().then((res) => setData(res.data)).catch(() => {});
    if (user?.role === 'admin') passwordApi.requests().then((r) => setPendingResets(r.data.length)).catch(() => {});
  }, [user]);

  // The bursar's home page is the bursary overview
  if (user?.role === 'bursary') return <Navigate to="/finance" replace />;

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  if (!data) return <div className="loading">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{greeting}, {user?.name}</h1>
          <p>{ROLE_LABEL[user?.role || '']} {'·'} {school.full_name} {'·'} {fmtDate(todayIso())}</p>
        </div>
      </div>

      {user?.role === 'admin' && (
        <>
          {data.insecureSecret && (
            <div className="alert alert-error"><strong>Security: this portal is signing log ins with a public secret.</strong> Anyone could pretend to be the Administrator. Set <code>JWT_SECRET</code> to a long random value in the host's settings (on Render: Environment), then restart.</div>
          )}
          <BackupNotice backup={data.backup} onDone={() => dashboardApi.get().then((res) => setData(res.data)).catch(() => {})} />
          {pendingResets > 0 && (
            <div className="alert alert-warning">
              {pendingResets} {pendingResets === 1 ? 'person has' : 'people have'} asked for a new password. <Link to="/admin">Open the Admin Panel</Link> to give them a temporary one.
            </div>
          )}
          <div className="grid">
            <Kpi value={data.students} label="Pupils" tone="info" />
            <Kpi value={data.teachers} label="Teachers" tone="info" />
            <Kpi value={data.classes} label="Classes" tone="info" />
            <Kpi value={money(data.outstandingFees)} label="Fees outstanding" tone="bad" />
            <Kpi value={data.debtorCount ?? 0} label="Pupils owing fees" tone="warn" />
          </div>
          <div className="card">
            <h2>Quick links</h2>
            <div className="toolbar">
              <Link className="btn" to="/finance">Bursary (view only)</Link>
              <Link className="btn" to="/results">Results</Link>
              <Link className="btn" to="/report-cards">Report cards</Link>
              <Link className="btn" to="/admin/analytics">Class analytics</Link>
              <Link className="btn" to="/admin">Admin panel</Link>
            </div>
          </div>
        </>
      )}

      {user?.role === 'teacher' && (
        <>
          <div className="grid">
            <Kpi value={data.className || 'N/A'} label="My class" tone="info" />
            <Kpi value={data.subjects} label="Learning areas" tone="info" />
          </div>
          <div className="card">
            <h2>Today</h2>
            <div className="toolbar">
              <Link className="btn btn-primary" to="/register">Mark the register</Link>
              <Link className="btn" to="/results">Enter marks</Link>
              <Link className="btn" to="/homework">Set homework</Link>
              <Link className="btn" to="/quizzes">Create a quiz</Link>
              <Link className="btn" to="/report-cards">Report cards</Link>
            </div>
          </div>
        </>
      )}

      {user?.role === 'parent' && (
        <>
          {(data.children || []).length === 0 && <div className="alert alert-warning">No pupil is linked to your account yet. Please ask the school office.</div>}
          <div className="grid">
            {(data.children || []).map((c: any) => (
              <div key={c.id} className="card" style={{ margin: 0 }}>
                <h2 style={{ marginTop: 0 }}>{c.name}</h2>
                <p className="muted small">{c.class_name || 'No class'} {'·'} {c.student_number}{c.left ? ' · has left the school' : ''}</p>
                <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.6rem 0', color: c.balance > 0.004 ? 'var(--danger)' : 'var(--success)' }}>
                  {c.balance > 0.004 ? `${money(c.balance)} owing` : c.balance < -0.004 ? `${money(-c.balance)} in credit` : 'Fees fully paid'}
                </p>
                <div className="toolbar">
                  <button className="btn btn-sm btn-primary" onClick={() => go(c.id, '/fees')}>Fees and receipts</button>
                  <button className="btn btn-sm" onClick={() => go(c.id, '/report-cards')}>Report card</button>
                  <button className="btn btn-sm" onClick={() => go(c.id, '/results')}>Results</button>
                </div>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: '0.8rem' }}>{data.notices} notice{data.notices === 1 ? '' : 's'} from the school. Use the menu above for attendance, the timetable and notices. Choose a different child with the box at the top right.</p>
        </>
      )}

      {user?.role === 'student' && (
        <>
          <div className="grid">
            <Kpi value={data.className || 'N/A'} label="My class" tone="info" />
            <Kpi value={data.notices} label="Notices" tone="info" />
            <Kpi value={money(data.feeBalance)} label={data.feeBalance > 0 ? 'Fees owing' : 'Fee balance'} tone={data.feeBalance > 0 ? 'bad' : 'good'} />
          </div>
          <div className="card">
            <h2>Go to</h2>
            <div className="toolbar">
              <Link className="btn btn-primary" to="/results">My results</Link>
              <Link className="btn" to="/report-cards">My report card</Link>
              <Link className="btn" to="/homework">Homework</Link>
              <Link className="btn" to="/quizzes">Quizzes</Link>
              <Link className="btn" to="/fees">My fees</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
