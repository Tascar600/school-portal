import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ParticleBackground from '../components/ParticleBackground';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  if (user) { navigate('/dashboard'); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Cannot reach server. Make sure the backend is running on port 5000.');
      } else {
        setError(err.response?.data?.message || err.message || 'An error occurred');
      }
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
          <h2 style={{ marginBottom: 0, color: '#fff', fontSize: '1.3rem' }}>
            TASCAR
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
            Chakari (GVT) Primary School · Mashonaland West
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Authenticate to continue
          </p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="you@school.com" />
          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="••••••••" />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem', padding: '0.8rem', fontSize: '1rem' }}>
            ✦ LOGIN
          </button>
        </form>
        <p style={{ marginTop: '1.25rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Got a registration number?{' '}
          <a href="/activate" style={{ color: 'var(--neon)', textDecoration: 'none' }}>Activate Account</a>
        </p>
      </div>
    </div>
  );
}
