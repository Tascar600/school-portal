import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
import DeveloperFooter from '../components/DeveloperFooter';

export default function Login() {
  const { login, user } = useAuth();
  const { school, logoUrl } = useSchool();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) { navigate('/dashboard'); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'ERR_NETWORK' || !err.response) setError('Cannot reach the server. Check your internet connection or ask the administrator.');
      else setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="crest" src={logoUrl} alt="School crest" />
        <h1>{school.name}</h1>
        {school.motto && <div className="motto">{'“'}{school.motto}{'”'}</div>}
        <p className="sub">{[school.district, school.province].filter(Boolean).join(' · ')}</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="you@example.com" autoComplete="username" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', marginRight: 0 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/forgot-password">Forgot your password?</Link>
          {'  ·  '}
          <Link to="/activate">I have a registration number</Link>
        </p>
      </div>
      <DeveloperFooter />
    </div>
  );
}
