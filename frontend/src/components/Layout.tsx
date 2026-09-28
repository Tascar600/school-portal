import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, User } from 'lucide-react';
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
    { label: 'Finance', path: '/finance', roles: ['admin', 'bursary'] },
    { label: 'Setup', path: '/finance/setup', roles: ['admin', 'bursary'] },
    { label: 'Invoices', path: '/finance/invoices', roles: ['admin', 'bursary'] },
    { label: 'Payments', path: '/finance/payments', roles: ['admin', 'bursary'] },
    { label: 'Expenses', path: '/finance/expenses', roles: ['admin', 'bursary'] },
    { label: 'Accounts', path: '/finance/accounts', roles: ['admin', 'bursary'] },
    { label: 'Reconciliation', path: '/finance/reconciliation', roles: ['admin', 'bursary'] },
    { label: 'Budgets', path: '/finance/budgets', roles: ['admin', 'bursary'] },
    { label: 'Sponsors', path: '/finance/sponsors', roles: ['admin', 'bursary'] },
    { label: 'Student Profiles', path: '/finance/students', roles: ['admin', 'bursary'] },
    { label: 'Reports', path: '/finance/reports', roles: ['admin', 'bursary'] },
    { label: 'Reminders', path: '/finance/reminders', roles: ['admin', 'bursary'] },
    { label: 'Report Cards', path: '/report-cards', roles: ['admin', 'teacher', 'student'] },
    { label: 'Fees', path: '/fees', roles: ['student'] },
    { label: 'Timetable', path: '/timetable', roles: ['admin', 'teacher', 'student'] },
    { label: 'Results', path: '/results', roles: ['admin', 'teacher', 'student'] },
    { label: 'Notices', path: '/notices', roles: ['admin', 'teacher', 'student'] },
    { label: 'Homework', path: '/homework', roles: ['teacher', 'student'] },
    { label: 'Quizzes', path: '/quizzes', roles: ['admin', 'teacher', 'student'] },
    { label: 'Courses', path: '/courses', roles: ['teacher', 'student'] },
    { label: 'Register', path: '/register', roles: ['teacher', 'student'] },
    { label: 'Sports', path: '/sports', roles: ['admin', 'teacher', 'student'] },
    { label: 'Themes', path: '/themes', roles: ['admin', 'teacher', 'student', 'bursary'] },
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
          <Link to="/dashboard">Tascar School Portal</Link>
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
                  <span className="nav-icon"><BarChart3 size={15} /></span> Analytics
                </Link>
              )}
              <Link to="/admin/student-stats" className={location.pathname === '/admin/student-stats' ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon"><User size={15} /></span> Student Stats
              </Link>
            </>
          )}
          {user?.role === 'teacher' && (
            <Link to="/admin/student-stats" className={location.pathname === '/admin/student-stats' ? 'nav-link active' : 'nav-link'}>
              <span className="nav-icon"><User size={15} /></span> Student Stats
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
