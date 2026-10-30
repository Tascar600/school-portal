import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import './App.css';

// Every page except the log in page is fetched only when someone opens it, so a pupil never downloads the
// Bursary pages, and the charts library is only fetched by the pages that draw charts.
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Fees = lazy(() => import('./pages/Fees'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Results = lazy(() => import('./pages/Results'));
const Notices = lazy(() => import('./pages/Notices'));
const Homework = lazy(() => import('./pages/Homework'));
const Quiz = lazy(() => import('./pages/Quiz'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Courses = lazy(() => import('./pages/Courses'));
const Register = lazy(() => import('./pages/Register'));
const Sports = lazy(() => import('./pages/Sports'));
const Themes = lazy(() => import('./pages/Themes'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const StudentStats = lazy(() => import('./pages/StudentStats'));
const ReportCards = lazy(() => import('./pages/ReportCards'));
const FinanceOverview = lazy(() => import('./pages/finance/FinanceOverview'));
const FinanceSetup = lazy(() => import('./pages/finance/FinanceSetup'));
const Invoices = lazy(() => import('./pages/finance/Invoices'));
const Payments = lazy(() => import('./pages/finance/Payments'));
const Expenses = lazy(() => import('./pages/finance/Expenses'));
const Accounts = lazy(() => import('./pages/finance/Accounts'));
const Students = lazy(() => import('./pages/finance/Students'));
const Reports = lazy(() => import('./pages/finance/Reports'));
const AuditTrail = lazy(() => import('./pages/finance/AuditTrail'));
const ClassComparison = lazy(() => import('./pages/ClassComparison'));
const Grade7Exams = lazy(() => import('./pages/Grade7Exams'));

const Waiting = () => <div className="loading">Loading…</div>;

// A page for logged-in people: checks who they are, draws the menu, and loads the page inside it
const page = (el: JSX.Element, roles?: string[]) => (
  <ProtectedRoute roles={roles}><Layout><Suspense fallback={<Waiting />}>{el}</Suspense></Layout></ProtectedRoute>
);

const ALL_STAFF_AND_PUPILS = ['admin', 'teacher', 'student'];
const FAMILIES = ['student', 'parent'];            // the pupil's own pages, also open to their parents
const EVERYONE_BUT_BURSAR = [...ALL_STAFF_AND_PUPILS, 'parent'];
const MONEY = ['admin', 'bursary'];

export default function App() {
  const { loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading School Portal...</div>;

  return (
    <Suspense fallback={<div className="loading-screen">Loading School Portal...</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/activate" element={<ActivateAccount />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={page(<ChangePassword />)} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={page(<Dashboard />)} />
        <Route path="/fees" element={page(<Fees />, FAMILIES)} />

        <Route path="/finance" element={page(<FinanceOverview />, MONEY)} />
        <Route path="/finance/setup" element={page(<FinanceSetup />, MONEY)} />
        <Route path="/finance/invoices" element={page(<Invoices />, MONEY)} />
        <Route path="/finance/payments" element={page(<Payments />, MONEY)} />
        <Route path="/finance/expenses" element={page(<Expenses />, MONEY)} />
        <Route path="/finance/accounts" element={page(<Accounts />, MONEY)} />
        <Route path="/finance/students" element={page(<Students />, MONEY)} />
        <Route path="/finance/reports" element={page(<Reports />, MONEY)} />
        <Route path="/finance/audit" element={page(<AuditTrail />, ['admin'])} />

        <Route path="/report-cards" element={page(<ReportCards />, EVERYONE_BUT_BURSAR)} />
        <Route path="/report-cards/:studentId" element={page(<ReportCards />, EVERYONE_BUT_BURSAR)} />
        <Route path="/timetable" element={page(<Timetable />, EVERYONE_BUT_BURSAR)} />
        <Route path="/results" element={page(<Results />, EVERYONE_BUT_BURSAR)} />
        <Route path="/notices" element={page(<Notices />, EVERYONE_BUT_BURSAR)} />
        <Route path="/homework" element={page(<Homework />, ['teacher', 'student'])} />
        <Route path="/quizzes" element={page(<Quiz />, ALL_STAFF_AND_PUPILS)} />
        <Route path="/admin" element={page(<AdminPanel />, ['admin'])} />
        <Route path="/courses" element={page(<Courses />, ['teacher', 'student'])} />
        <Route path="/register" element={page(<Register />, ['teacher', 'student', 'parent'])} />
        <Route path="/sports" element={page(<Sports />, ALL_STAFF_AND_PUPILS)} />
        <Route path="/themes" element={page(<Themes />, EVERYONE_BUT_BURSAR)} />
        <Route path="/admin/analytics" element={page(<AdminAnalytics />, ['admin'])} />
        <Route path="/admin/compare" element={page(<ClassComparison />, ['admin'])} />
        <Route path="/exams" element={page(<Grade7Exams />, ['admin', 'teacher'])} />
        <Route path="/admin/student-stats" element={page(<StudentStats />, ['admin', 'teacher'])} />
      </Routes>
    </Suspense>
  );
}
