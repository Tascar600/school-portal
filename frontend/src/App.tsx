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
        element={<ProtectedRoute roles={['student', 'admin', 'teacher']}><Layout><Fees /></Layout></ProtectedRoute>}
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
      <Route path="/admin/student-stats" element={<ProtectedRoute roles={['admin', 'teacher']}><Layout><StudentStats /></Layout></ProtectedRoute>} />
    </Routes>
  );
}
