import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../services/api';
import { money } from '../utils/money';

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
      <span>Loading Tascar School Portal…</span>
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
            Role: <span className="badge" style={{
              background: user?.role === 'admin' ? 'rgba(239,68,68,0.2)' : user?.role === 'teacher' ? 'rgba(0,240,255,0.2)' : 'rgba(34,197,94,0.2)',
              color: user?.role === 'admin' ? '#f87171' : user?.role === 'teacher' ? '#22d3ee' : user?.role === 'bursary' ? '#a78bfa' : '#4ade80',
            }}>{user?.role}</span>
          </p>
        </div>
        <div style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <div>Chakari (GVT) Primary School</div>
          <div style={{ fontSize: '0.75rem' }}>Mashonaland West · Sanyati District</div>
          <div>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="grid">
          <AnimatedStat value={data.students} label="Students" color="#22d3ee" />
          <AnimatedStat value={data.teachers} label="Teachers" color="#a855f7" />
          <AnimatedStat value={data.classes} label="Classes" color="#fbbf24" />
          <AnimatedStat value={money(data.outstandingFees)} label="Outstanding Fees" color="#f87171" />
        </div>
      )}

      {user?.role === 'teacher' && (
        <div className="grid">
          <AnimatedStat value={data.subjects} label="My Subjects" color="#22d3ee" />
          <AnimatedStat value={data.className || 'N/A'} label="My Class" color="#a855f7" />
        </div>
      )}

      {user?.role === 'bursary' && (
        <div className="grid">
          <AnimatedStat value={data.invoiceCount || 0} label="Active Invoices" color="#fbbf24" />
          <AnimatedStat value={money(data.outstandingFees)} label="Outstanding Fees" color="#a78bfa" />
        </div>
      )}

      {user?.role === 'student' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <AnimatedStat value={data.className || 'N/A'} label="Class" color="#22d3ee" />
          <AnimatedStat value={data.notices} label="New Notices" color="#a855f7" />
          <AnimatedStat value={money(data.feeBalance)} label="Fee Balance" color={data.feeBalance > 0 ? '#f87171' : '#4ade80'} />
        </div>
      )}
    </div>
  );
}
