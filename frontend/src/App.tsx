import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import ActivateAccount from './pages/ActivateAccount';
import Dashboard from './pages/Dashboard';
import Fees from './pages/Fees';
import Timetable from './pages/Timetable';
import Results from './pages/Results';
import Notices from './pages/Notices';
import Homework from './pages/Homework';
import Quiz from './pages/Quiz';
import AdminPanel from './pages/AdminPanel';
import Courses from './pages/Courses';
import Register from './pages/Register';
import Sports from './pages/Sports';
import Voting from './pages/Voting';
import Themes from './pages/Themes';
import AdminAnalytics from './pages/AdminAnalytics';
import StudentStats from './pages/StudentStats';
import ReportCards from './pages/ReportCards';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import FinanceSetup from './pages/finance/FinanceSetup';
import Invoices from './pages/finance/Invoices';
import Payments from './pages/finance/Payments';
import Expenses from './pages/finance/Expenses';
import Accounts from './pages/finance/Accounts';
import Reconciliation from './pages/finance/Reconciliation';
import Budgets from './pages/finance/Budgets';
import Sponsors from './pages/finance/Sponsors';
import StudentProfiles from './pages/finance/StudentProfiles';
import Reports from './pages/finance/Reports';
import Reminders from './pages/finance/Reminders';
import './App.css';

export default function App() {
  const { loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading School Portal...</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<ActivateAccount />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>}
      />
      <Route
        path="/fees"
        element={<ProtectedRoute roles={['student']}><Layout><Fees /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><FinanceDashboard /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/setup"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><FinanceSetup /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/invoices"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Invoices /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/payments"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Payments /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/expenses"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Expenses /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/accounts"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Accounts /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/reconciliation"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Reconciliation /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/budgets"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Budgets /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/sponsors"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Sponsors /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/students"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><StudentProfiles /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/reports"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Reports /></Layout></ProtectedRoute>}
      />
      <Route
        path="/finance/reminders"
        element={<ProtectedRoute roles={['admin', 'bursary']}><Layout><Reminders /></Layout></ProtectedRoute>}
      />
      <Route
        path="/report-cards"
        element={<ProtectedRoute roles={['admin', 'teacher', 'student']}><Layout><ReportCards /></Layout></ProtectedRoute>}
      />
      <Route
        path="/report-cards/:studentId"
        element={<ProtectedRoute roles={['admin', 'teacher', 'student']}><Layout><ReportCards /></Layout></ProtectedRoute>}
      />
      <Route
        path="/timetable"
        element={<ProtectedRoute><Layout><Timetable /></Layout></ProtectedRoute>}
      />
      <Route
        path="/results"
        element={<ProtectedRoute><Layout><Results /></Layout></ProtectedRoute>}
      />
      <Route
        path="/notices"
        element={<ProtectedRoute><Layout><Notices /></Layout></ProtectedRoute>}
      />
      <Route
        path="/homework"
        element={<ProtectedRoute roles={['teacher', 'student']}><Layout><Homework /></Layout></ProtectedRoute>}
      />
      <Route
        path="/quizzes"
        element={<ProtectedRoute><Layout><Quiz /></Layout></ProtectedRoute>}
      />
      <Route
        path="/admin"
        element={<ProtectedRoute roles={['admin']}><Layout><AdminPanel /></Layout></ProtectedRoute>}
      />
      <Route
        path="/courses"
        element={<ProtectedRoute roles={['teacher', 'student']}><Layout><Courses /></Layout></ProtectedRoute>}
      />
      <Route
        path="/register"
        element={<ProtectedRoute roles={['teacher', 'student']}><Layout><Register /></Layout></ProtectedRoute>}
      />
      <Route
        path="/sports"
        element={<ProtectedRoute><Layout><Sports /></Layout></ProtectedRoute>}
      />
      <Route
        path="/voting"
        element={<ProtectedRoute roles={['admin', 'student']}><Layout><Voting /></Layout></ProtectedRoute>}
      />
      <Route
        path="/themes"
        element={<ProtectedRoute><Layout><Themes /></Layout></ProtectedRoute>}
      />
      <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']}><Layout><AdminAnalytics /></Layout></ProtectedRoute>} />
      <Route path="/admin/student-stats" element={<ProtectedRoute roles={['admin', 'teacher', 'bursary']}><Layout><StudentStats /></Layout></ProtectedRoute>} />
    </Routes>
  );
}
