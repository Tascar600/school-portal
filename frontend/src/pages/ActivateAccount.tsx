import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';

export default function ActivateAccount() {
  const navigate = useNavigate();
  const { applyToken } = useAuth();
  const { school, logoUrl } = useSchool();
  const [form, setForm] = useState({ student_number: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await authApi.activate({ ...form, student_number: form.student_number.trim(), email: form.email.trim() });
      setSuccess('Your account is ready. Taking you in…');
      applyToken(res.data.token);
      setTimeout(() => navigate('/dashboard'), 900);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Activation failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="crest" src={logoUrl} alt="School crest" />
        <h1>Activate your account</h1>
        <p className="sub">{school.name}<br />Enter the registration number the school gave you, then choose an email and a password.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="reg">Registration number</label>
          <input id="reg" value={form.student_number} onChange={(e) => setForm({ ...form, student_number: e.target.value })} required placeholder="e.g. c2600001c" />
          <label htmlFor="em">Email address (you will log in with this)</label>
          <input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="you@example.com" autoComplete="username" />
          <label htmlFor="pw">Choose a password</label>
          <input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="At least 8 characters, letters and numbers" autoComplete="new-password" />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', marginRight: 0 }}>Activate</button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem', textAlign: 'center' }}>Already activated? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
