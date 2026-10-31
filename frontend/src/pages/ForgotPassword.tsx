import { useState } from 'react';
import { Link } from 'react-router-dom';
import { passwordApi } from '../services/api';
import { useSchool } from '../contexts/SchoolContext';
import DeveloperFooter from '../components/DeveloperFooter';

export default function ForgotPassword() {
  const { school, logoUrl } = useSchool();
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { setSent((await passwordApi.forgot(identifier)).data.message); }
    catch (err: any) { setError(err.response?.data?.message || 'Could not send your request. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="crest" src={logoUrl} alt="School crest" />
        <h1>Forgot your password?</h1>
        <p className="sub">{school.name}</p>
        {sent ? (
          <>
            <div className="alert alert-success">{sent}</div>
            <p className="small muted">
              For a faster reply, tell the school office or your teacher that you asked for a reset
              {school.phone ? ` (tel. ${school.phone})` : ''}.
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="small muted" style={{ marginBottom: '0.9rem' }}>
              Enter the email address you log in with, or your registration number. The school administrator
              will be told, and will give you a temporary password. You will choose your own when you log in.
            </p>
            {error && <div className="alert alert-error">{error}</div>}
            <label htmlFor="identifier">Email address or registration number</label>
            <input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', marginRight: 0 }} disabled={busy}>
              {busy ? 'Sending…' : 'Ask for a new password'}
            </button>
          </form>
        )}
        <p className="small" style={{ marginTop: '1rem', textAlign: 'center' }}><Link to="/login">Back to log in</Link></p>
      </div>
      <DeveloperFooter />
    </div>
  );
}
