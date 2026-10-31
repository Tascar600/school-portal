import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/api';
import { downloadBlob } from '../utils/downloadBlob';
import { fmtDateTime } from '../utils/dates';

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const ago = (days: number | null) => (days === null ? 'never' : days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

// Saves the whole database to this computer, and tells the server it was done
export async function downloadDatabase(): Promise<void> {
  const r = await adminApi.dbExport();
  downloadBlob(r.data, `school_portal_backup_${new Date().toISOString().slice(0, 10)}.db`);
}

// Dashboard warning for the Administrator: a backup kept off the server has not been downloaded for a week (or ever)
export function BackupNotice({ backup, onDone }: { backup?: { daysSince: number | null; stale: boolean; staleAfterDays: number }; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!backup?.stale) return null;
  return (
    <div className="alert alert-warning no-print">
      <strong>{backup.daysSince === null ? 'No backup of the portal has ever been downloaded.' : `The last backup was downloaded ${ago(backup.daysSince)}.`}</strong>{' '}
      A downloaded copy, kept somewhere other than the portal's computer, is the only thing that brings back every pupil, mark and payment if the portal's files are ever lost.{' '}
      <button className="btn btn-sm btn-primary" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await downloadDatabase(); onDone?.(); } catch (e: any) { setError(e.response?.data?.message || 'The download failed'); } finally { setBusy(false); }
      }}>{busy ? 'Preparing…' : 'Download a backup now'}</button>{' '}
      <Link to="/admin">More about backups</Link>
      {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  );
}

// Admin Panel > Database: when the last backup was downloaded and the automatic copies kept by the portal
export function BackupManager() {
  const [status, setStatus] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [emailing, setEmailing] = useState(false);
  const load = () => adminApi.backups().then((r) => setStatus(r.data)).catch(() => setMsg('The backup list could not be loaded'));
  useEffect(() => { load(); }, []);
  if (!status) return <div className="card"><h2>Backups</h2><p className="muted">{msg || 'Loading…'}</p></div>;
  return (
    <div className="card">
      <h2>Backups</h2>
      {msg && <div className="alert alert-info">{msg}</div>}
      <p style={{ marginBottom: '0.6rem' }}>
        Last backup downloaded: <strong style={{ color: status.stale ? 'var(--danger)' : 'var(--success)' }}>{status.lastDownloadAt ? `${fmtDateTime(status.lastDownloadAt)} (${ago(status.daysSince)})${status.lastDownloadBy ? `, by ${status.lastDownloadBy}` : ''}` : 'never'}</strong>
      </p>
      <p className="muted small" style={{ marginBottom: '0.8rem' }}>
        The portal also keeps one automatic copy for each of the last 14 days. These protect against mistakes, such as a wrong delete or a bad restore. They are stored next to the database, so they
        <strong> do not</strong> protect you if the computer or the host loses its files. Download a copy at least once a week and keep it somewhere else.
      </p>
      <div className="toolbar" style={{ marginBottom: '0.8rem' }}>
        <button className="btn btn-primary" onClick={async () => { try { await downloadDatabase(); setMsg('Backup downloaded.'); load(); } catch (e: any) { setMsg(e.response?.data?.message || 'Download failed'); } }}>Download a backup now</button>
        <button className="btn" onClick={async () => { try { const r = await adminApi.backupNow(); setStatus(r.data); setMsg('Today\'s automatic copy was refreshed.'); } catch (e: any) { setMsg(e.response?.data?.message || 'Could not make a copy'); } }}>Make a copy now</button>
        {status.email?.configured && (
          <button className="btn" disabled={emailing} onClick={async () => {
            setEmailing(true); setMsg('');
            try { const r = await adminApi.backupEmail(); setStatus(r.data); setMsg(r.data.message); }
            catch (e: any) {
              // the reason is kept in the status and shown in the red box below, so it is not shown twice
              if (e.response?.data?.email) setStatus(e.response.data); else setMsg(e.response?.data?.message || 'The backup could not be emailed');
            }
            finally { setEmailing(false); }
          }}>{emailing ? 'Sending…' : 'Email me a backup now'}</button>
        )}
      </div>
      {status.email?.configured ? (
        <p className="muted small" style={{ marginBottom: '0.8rem' }}>
          A copy is also emailed to <strong>{status.email.to}</strong> about once a day: the whole database, and any new uploaded files. Last emailed: <strong>{status.email.lastAt ? fmtDateTime(status.email.lastAt) : 'not yet'}</strong>.
          {status.email.backlog && ' More uploaded files are waiting for the next email.'}
        </p>
      ) : (
        <p className="muted small" style={{ marginBottom: '0.8rem' }}>
          Backups are not being emailed. To have the portal email you a copy every day, set <code>BACKUP_EMAIL_TO</code> and the <code>SMTP_…</code> settings on the host (see the README, "Emailed backups").
        </p>
      )}
      {status.email?.lastError && <div className="alert alert-error">The last emailed backup did not work: {status.email.lastError}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Automatic copy</th><th>Saved</th><th className="num">Size</th><th className="no-print" /></tr></thead>
          <tbody>
            {status.copies.map((c: any) => (
              <tr key={c.name}>
                <td>{c.name}</td><td>{fmtDateTime(c.at)}</td><td className="num">{size(c.size)}</td>
                <td className="no-print"><button className="btn btn-sm" onClick={async () => { try { const r = await adminApi.backupFile(c.name); downloadBlob(r.data, c.name); load(); } catch (e: any) { setMsg(e.response?.data?.message || 'Download failed'); } }}>Download</button></td>
              </tr>
            ))}
            {status.copies.length === 0 && <tr><td colSpan={4} className="muted">No automatic copy yet. One is made when the portal starts and every few hours after.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Admin Panel > Database: look for broken links between records (a receipt for a pupil who is gone, and so on)
export function IntegrityCheck() {
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true); setError('');
    try { setReport((await adminApi.integrity()).data); } catch (e: any) { setError(e.response?.data?.message || 'The check could not be run'); } finally { setBusy(false); }
  };
  return (
    <div className="card">
      <h2>Check the database</h2>
      <p className="muted small" style={{ marginBottom: '0.7rem' }}>
        Looks for records that point at something that is gone (for example a bill for a pupil who was deleted, which would wrongly add to "Fees outstanding"), and runs SQLite's own repair check.
        The portal now refuses to delete anyone who has marks, bills or receipts, so new problems should not appear.
      </p>
      <button className="btn btn-primary" disabled={busy} onClick={run}>{busy ? 'Checking…' : 'Check now'}</button>
      {error && <div className="alert alert-error" style={{ marginTop: '0.7rem' }}>{error}</div>}
      {report && (
        <div style={{ marginTop: '0.8rem' }}>
          <div className={`alert alert-${report.ok ? 'success' : 'warning'}`}>
            {report.ok ? 'No problems found. Every record points at something that exists.' : `${report.problems.length} kind(s) of problem found${report.integrity !== 'ok' ? `; SQLite reports: ${report.integrity}` : ''}.`}
            {' '}Link checking is {report.foreignKeysOn ? 'on' : 'OFF'}.
          </div>
          {report.problems.length > 0 && (
            <div className="table-wrap"><table>
              <thead><tr><th>What was found</th><th>What it means</th><th className="num">Rows</th></tr></thead>
              <tbody>{report.problems.map((p: any, i: number) => <tr key={i}><td>{p.what}</td><td>{p.meaning}</td><td className="num">{p.count}</td></tr>)}</tbody>
            </table></div>
          )}
          {report.problems.length > 0 && <p className="muted small" style={{ marginTop: '0.5rem' }}>Nothing is changed or deleted by this check. Ask whoever looks after the portal to remove or repair these rows; take a backup first.</p>}
        </div>
      )}
    </div>
  );
}
