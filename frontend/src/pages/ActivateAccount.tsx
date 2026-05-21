import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import ParticleBackground from '../components/ParticleBackground';

export default function ActivateAccount() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ student_number: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await authApi.activate(form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setSuccess('Account activated! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Activation failed');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a1a', position: 'relative' }}>
      <ParticleBackground />
      <div className="scanline" />
      <div className="card" style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
            margin: '0 auto 1rem',
            boxShadow: '0 0 40px rgba(0,240,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem',
          }}>✦</div>
          <h2 style={{ marginBottom: 0, color: '#fff', fontSize: '1.5rem' }}>
            Activate Account
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Enter your student number to activate
          </p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <label>Student Number</label>
          <input value={form.student_number} onChange={e => setForm({ ...form, student_number: e.target.value })} required placeholder="e.g. STU-2026-0001" />
          <label>Full Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Enter your name" />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="you@school.com" />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="Create a password" />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem', padding: '0.8rem', fontSize: '1rem' }}>
            ✦ ACTIVATE
          </button>
        </form>
        <p style={{ marginTop: '1.25rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Already activated?{' '}
          <a href="/login" style={{ color: 'var(--neon)', textDecoration: 'none' }}>Login</a>
        </p>
      </div>
    </div>
  );
}
