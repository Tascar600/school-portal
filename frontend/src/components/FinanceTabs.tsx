import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const TABS = [
  { label: 'Overview', path: '/finance' }, { label: 'Receive Fees', path: '/finance/payments' }, { label: 'Students', path: '/finance/students' },
  { label: 'Invoices', path: '/finance/invoices' }, { label: 'Expenses', path: '/finance/expenses' }, { label: 'Cash & Bank', path: '/finance/accounts' },
  { label: 'Reports', path: '/finance/reports' }, { label: 'Setup', path: '/finance/setup' }, { label: 'Audit trail', path: '/finance/audit' },
];

// The administrator has one "Bursary" entry in the main menu, so the bursary pages carry their own tabs.
// (The bursar's own menu already lists these pages, so nothing is drawn for the bursar.)
export default function FinanceTabs() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user?.role !== 'admin') return null;
  return (
    <div className="tabs no-print">
      {TABS.map((t) => <Link key={t.path} to={t.path} className={`tab${pathname === t.path ? ' active' : ''}`} style={{ textDecoration: 'none' }}>{t.label}</Link>)}
      <span className="badge" style={{ marginLeft: 'auto', alignSelf: 'center' }}>View only</span>
    </div>
  );
}
