import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ParticleBackground from './ParticleBackground';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems: { label: string; path: string; roles: string[] }[] = [
    { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'teacher', 'student', 'bursary'] },
    { label: 'Bursary', path: '/bursary', roles: ['bursary'] },
    { label: 'Report Cards', path: '/report-cards', roles: ['admin', 'teacher', 'student'] },
    { label: 'Fees', path: '/fees', roles: ['student', 'admin', 'bursary'] },
    { label: 'Timetable', path: '/timetable', roles: ['admin', 'teacher', 'student'] },
    { label: 'Results', path: '/results', roles: ['admin', 'teacher', 'student'] },
    { label: 'Notices', path: '/notices', roles: ['admin', 'teacher', 'student'] },
    { label: 'Homework', path: '/homework', roles: ['teacher', 'student'] },
    { label: 'Quizzes', path: '/quizzes', roles: ['admin', 'teacher', 'student'] },
    { label: 'Courses', path: '/courses', roles: ['teacher', 'student'] },
    { label: 'Register', path: '/register', roles: ['teacher', 'student'] },
    { label: 'Sports', path: '/sports', roles: ['admin', 'teacher', 'student'] },
    { label: 'Voting', path: '/voting', roles: ['admin', 'student'] },
    { label: 'Themes', path: '/themes', roles: ['admin', 'teacher', 'student'] },
    { label: 'Admin Panel', path: '/admin', roles: ['admin'] },
  ];

  const visible = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="layout">
      <div className="scanline" />
      <ParticleBackground />
      <nav className="navbar">
        <div className="nav-brand">
          <span className="pulse-dot" />
          <Link to="/dashboard">Tascar</Link>
        </div>
        <div className="nav-links">
          {visible.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={location.pathname === item.path ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
          {(user?.role === 'admin' || user?.role === 'bursary') && (
            <>
              {user?.role === 'admin' && (
                <Link to="/admin/analytics" className={location.pathname === '/admin/analytics' ? 'nav-link active' : 'nav-link'}>
                  <span className="nav-icon">📊</span> Analytics
                </Link>
              )}
              <Link to="/admin/student-stats" className={location.pathname === '/admin/student-stats' ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">👤</span> Student Stats
              </Link>
            </>
          )}
          {user?.role === 'teacher' && (
            <Link to="/admin/student-stats" className={location.pathname === '/admin/student-stats' ? 'nav-link active' : 'nav-link'}>
              <span className="nav-icon">👤</span> Student Stats
            </Link>
          )}
        </div>
        <div className="nav-user">
          <span>{user?.name} <span className="badge" style={{
            background: user?.role === 'admin' ? 'rgba(239,68,68,0.2)' : user?.role === 'teacher' ? 'rgba(0,240,255,0.2)' : user?.role === 'bursary' ? 'rgba(167,139,250,0.2)' : 'rgba(34,197,94,0.2)',
            color: user?.role === 'admin' ? '#f87171' : user?.role === 'teacher' ? '#22d3ee' : user?.role === 'bursary' ? '#a78bfa' : '#4ade80',
            marginLeft: 4
          }}>{user?.role}</span></span>
          <button onClick={handleLogout}>EXIT</button>
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}
