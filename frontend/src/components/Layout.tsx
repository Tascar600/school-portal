import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, KeyRound, LogOut } from 'lucide-react';
import { useAuth, ROLE_LABEL } from '../contexts/AuthContext';
import { ChildSwitcher, useChild } from '../contexts/ChildContext';
import { useSchool } from '../contexts/SchoolContext';
import { useTheme, THEMES, ThemeId } from '../contexts/ThemeContext';
import { downloadPdf } from '../services/api';
import DeveloperFooter, { DEVELOPER_CREDIT } from './DeveloperFooter';

type Item = { label: string; path: string };

// What each kind of user sees in the menu. The bursar's menu is the whole bursary; the administrator
// gets one "Bursary" entry (the bursary pages then show their own tabs).
const NAV: Record<string, Item[]> = {
  admin: [
    { label: 'Dashboard', path: '/dashboard' }, { label: 'Bursary', path: '/finance' }, { label: 'Results', path: '/results' },
    { label: 'Report Cards', path: '/report-cards' }, { label: 'Timetable', path: '/timetable' }, { label: 'Notices', path: '/notices' },
    { label: 'Quizzes', path: '/quizzes' }, { label: 'Sports', path: '/sports' }, { label: 'Analytics', path: '/admin/analytics' },
    { label: 'Compare Classes', path: '/admin/compare' }, { label: 'Grade 7 Exams', path: '/exams' }, { label: 'Student Stats', path: '/admin/student-stats' }, { label: 'Admin Panel', path: '/admin' }, { label: 'Appearance', path: '/themes' },
  ],
  parent: [
    { label: 'Dashboard', path: '/dashboard' }, { label: 'Fees', path: '/fees' }, { label: 'Results', path: '/results' },
    { label: 'Report Cards', path: '/report-cards' }, { label: 'Attendance', path: '/register' }, { label: 'Timetable', path: '/timetable' },
    { label: 'Notices', path: '/notices' }, { label: 'Appearance', path: '/themes' },
  ],
  bursary: [
    { label: 'Overview', path: '/finance' }, { label: 'Receive Fees', path: '/finance/payments' }, { label: 'Students', path: '/finance/students' },
    { label: 'Invoices', path: '/finance/invoices' }, { label: 'Expenses', path: '/finance/expenses' }, { label: 'Cash & Bank', path: '/finance/accounts' },
    { label: 'Reports', path: '/finance/reports' }, { label: 'Setup', path: '/finance/setup' },
  ],
  teacher: [
    { label: 'Dashboard', path: '/dashboard' }, { label: 'Register', path: '/register' }, { label: 'Results', path: '/results' },
    { label: 'Report Cards', path: '/report-cards' }, { label: 'Homework', path: '/homework' }, { label: 'Quizzes', path: '/quizzes' },
    { label: 'Timetable', path: '/timetable' }, { label: 'Courses', path: '/courses' }, { label: 'Notices', path: '/notices' },
    { label: 'Sports', path: '/sports' }, { label: 'Student Stats', path: '/admin/student-stats' }, { label: 'Appearance', path: '/themes' },
  ],
  student: [
    { label: 'Dashboard', path: '/dashboard' }, { label: 'Results', path: '/results' }, { label: 'Report Cards', path: '/report-cards' },
    { label: 'Fees', path: '/fees' }, { label: 'Timetable', path: '/timetable' }, { label: 'Homework', path: '/homework' },
    { label: 'Quizzes', path: '/quizzes' }, { label: 'Courses', path: '/courses' }, { label: 'My Attendance', path: '/register' },
    { label: 'Notices', path: '/notices' }, { label: 'Sports', path: '/sports' }, { label: 'Appearance', path: '/themes' },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { school, logoUrl } = useSchool();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState('');

  const { kids, active, ready } = useChild();
  const base = NAV[user?.role || ''] || [];
  // The Grade 7 teacher also gets the Grade 7 exam results
  const items = user?.role === 'teacher' && (user as any).class_name === 'Grade 7'
    ? [...base.slice(0, -1), { label: 'Grade 7 Exams', path: '/exams' }, ...base.slice(-1)] : base;
  const isActive = (p: string, role?: string) => {
    if (role === 'admin' && p === '/finance') return location.pathname.startsWith('/finance');
    if (p === '/admin') return location.pathname === '/admin';
    if (p === '/finance' || p === '/dashboard') return location.pathname === p;
    return location.pathname === p || location.pathname.startsWith(p + '/');
  };

  const downloadManual = async () => {
    setManualBusy(true); setManualError('');
    try { await downloadPdf('/manual', `${school.name} - ${ROLE_LABEL[user?.role || ''] || 'User'} Manual.pdf`); }
    catch { setManualError('The manual could not be downloaded. Please try again.'); setTimeout(() => setManualError(''), 6000); }
    finally { setManualBusy(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const printedAt = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-top">
          <Link to="/dashboard" className="nav-brand">
            <img src={logoUrl} alt="School crest" />
            <span>
              <span className="brand-name">{school.name}</span><br />
              <span className="brand-sub">{school.motto}</span>
            </span>
          </Link>
          <div className="nav-spacer" />
          <div className="nav-actions">
            <button className="hdr-btn gold" onClick={downloadManual} disabled={manualBusy} title="Download the user manual for your account as a PDF">
              <BookOpen size={15} /> {manualBusy ? 'Preparing…' : 'Download Manual'}
            </button>
            <ChildSwitcher />
            <select className="hdr-select" value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)} title="Appearance" aria-label="Appearance">
              {THEMES.map((t) => <option key={t.id} value={t.id}>{t.id === 'system' ? 'Appearance: Default' : `Appearance: ${t.name}`}</option>)}
            </select>
            <div className="nav-user">
              <div className="who">{user?.name}<small>{ROLE_LABEL[user?.role || ''] || user?.role}</small></div>
              <Link to="/change-password" className="hdr-btn" title="Change your password" aria-label="Change your password"><KeyRound size={15} /> <span className="hdr-label">Password</span></Link>
              <button className="hdr-btn" onClick={handleLogout} title="Log out" aria-label="Log out"><LogOut size={15} /> <span className="hdr-label">Log out</span></button>
            </div>
          </div>
        </div>
        <div className="nav-links">
          {items.map((item) => (
            <Link key={item.path} to={item.path} className={isActive(item.path, user?.role) ? 'active' : ''}>{item.label}</Link>
          ))}
        </div>
      </nav>
      {manualError && <div className="alert alert-error" style={{ margin: '0.75rem auto 0', maxWidth: 1500, width: '100%' }}>{manualError}</div>}
      <main className="main-content"><div className="print-sheet" key={active?.id ?? 'none'}>
        {user?.role === 'parent' && !ready ? <div className="loading">Loading…</div>
          : user?.role === 'parent' && kids.length === 0 && location.pathname !== '/change-password' ? <div className="card"><h2>No pupil linked yet</h2><p>No pupil is linked to your account yet. Please ask the school office to link your child to it.</p></div>
          : children}
      </div></main>
      <DeveloperFooter />

      {/* Printed pages only: the border is drawn by .print-sheet; the crest watermark and footer repeat on every sheet */}
      <div className="print-watermark"><img src={logoUrl} alt="" /></div>
      <div className="print-footer">
        {school.full_name} {'·'} {school.motto} {'·'} Printed {printedAt}{user ? ` by ${user.name}` : ''}
        <div className="print-credit">{DEVELOPER_CREDIT}</div>
      </div>
    </div>
  );
}
