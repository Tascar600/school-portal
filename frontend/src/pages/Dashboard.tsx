import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../services/api';

function AnimatedStat({ value, label, color }: { value: number | string; label: string; color?: string }) {
  const [display, setDisplay] = useState(0);
  const numValue = typeof value === 'number' ? value : parseInt(value as string) || 0;

  useEffect(() => {
    if (numValue === 0) { setDisplay(0); return; }
    const duration = 1500;
    const steps = 30;
    const increment = numValue / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numValue) { setDisplay(numValue); clearInterval(timer); }
      else setDisplay(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [numValue]);

  return (
    <div className="stat-card">
      <h3 style={color ? { background: `linear-gradient(135deg, ${color}, #fff)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}}>
        {typeof value === 'string' ? value : display}
      </h3>
      <p>{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    dashboardApi.get().then((res) => setData(res.data)).catch(() => {});
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good Morning');
    else if (h < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  if (!data) return (
    <div className="loading-screen">
      <span>Initializing Nexus Portal</span>
      <div style={{ width: 200, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: '40%', height: '100%', background: 'var(--neon)', borderRadius: 2, animation: 'slideIn 1.5s ease infinite' }} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>{greeting}, {user?.name}.</h1>
          <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            <span className="pulse-dot" />
            System Online · Role: <span className="badge" style={{
              background: user?.role === 'admin' ? 'rgba(239,68,68,0.2)' : user?.role === 'teacher' ? 'rgba(0,240,255,0.2)' : 'rgba(34,197,94,0.2)',
              color: user?.role === 'admin' ? '#f87171' : user?.role === 'teacher' ? '#22d3ee' : '#4ade80',
            }}>{user?.role}</span>
          </p>
        </div>
        <div style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <div>NEXUS 3030 v1.0</div>
          <div>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="grid">
          <AnimatedStat value={data.students} label="Students" color="#22d3ee" />
          <AnimatedStat value={data.teachers} label="Teachers" color="#a855f7" />
          <AnimatedStat value={data.classes} label="Classes" color="#fbbf24" />
          <AnimatedStat value={data.pendingPayments} label="Pending Payments" color="#f87171" />
        </div>
      )}

      {user?.role === 'teacher' && (
        <div className="grid">
          <AnimatedStat value={data.subjects} label="My Subjects" color="#22d3ee" />
          <AnimatedStat value={data.classes} label="My Classes" color="#a855f7" />
        </div>
      )}

      {user?.role === 'student' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <AnimatedStat value={data.className || 'N/A'} label="Class" color="#22d3ee" />
          <AnimatedStat value={data.notices} label="New Notices" color="#a855f7" />
        </div>
      )}

      {/* System Status */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>System Status</h2>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Database', status: 'Connected', color: '#4ade80' },
            { label: 'API Server', status: 'Online', color: '#4ade80' },
            { label: 'File Storage', status: 'Active', color: '#4ade80' },
            { label: 'Auth Service', status: 'Secured', color: '#4ade80' },
          ].map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pulse-dot" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{s.label}</div>
                <div style={{ fontSize: '0.9rem', color: s.color }}>{s.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {user?.role === 'student' && data.feeAccounts && data.feeAccounts.length > 0 && (
        <div className="card">
          <h2>Fee Accounts</h2>
          <table>
            <thead><tr><th>Account</th><th>Total Fee</th><th>Outstanding</th></tr></thead>
            <tbody>
              {data.feeAccounts.map((acc: any) => (
                <tr key={acc.id}>
                  <td>
                    <span className="badge" style={{
                      background: 'rgba(0,240,255,0.1)',
                      color: 'var(--neon)',
                      padding: '0.25rem 0.75rem',
                    }}>
                      {acc.account_type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>${acc.total_fee.toFixed(2)}</td>
                  <td>
                    <span style={{
                      color: acc.balance > 0 ? '#f87171' : '#4ade80',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                    }}>
                      ${acc.balance.toFixed(2)}
                    </span>
                    {acc.balance > 0 && <span className="badge" style={{ marginLeft: 8, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.7rem' }}>PENDING</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
