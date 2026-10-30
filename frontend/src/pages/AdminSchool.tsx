import { useEffect, useState } from 'react';
import { brandingApi, passwordApi } from '../services/api';
import { useSchool, GradeBand } from '../contexts/SchoolContext';
import { fmtDateTime } from '../utils/dates';

// ── School details and logo ──────────────────────────────────────────────────
export function SchoolSettings() {
  const { school, reload, logoUrl } = useSchool();
  const [form, setForm] = useState<any>(school);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  useEffect(() => setForm(school), [school]);
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await brandingApi.update({ school: form }); reload(); setMsg({ text: 'Saved. Every page and printed document now uses these details.', type: 'success' }); }
    catch (err: any) { setMsg({ text: err.response?.data?.message || 'Could not save', type: 'error' }); }
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const r = await brandingApi.uploadLogo(file); reload(); setMsg({ text: r.data.message, type: 'success' }); }
    catch (err: any) { setMsg({ text: err.response?.data?.message || 'Could not upload the logo', type: 'error' }); }
    e.target.value = '';
  };

  return (
    <>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div className="card">
        <h2>School logo</h2>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={logoUrl} alt="Current logo" style={{ height: 110, background: '#fffdf5', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }} />
          <div>
            <p className="small muted" style={{ maxWidth: 440, marginBottom: '0.6rem' }}>This crest appears at the top of every page, on the login page and in the watermark and letterhead of every printed document. Use a PNG with a transparent background for the best result (about 600 pixels wide).</p>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>Choose a new logo<input type="file" accept="image/png,image/jpeg" onChange={upload} style={{ display: 'none' }} /></label>
            <button className="btn" onClick={async () => { await brandingApi.resetLogo(); reload(); setMsg({ text: 'The original school crest is back.', type: 'success' }); }}>Use the original crest</button>
          </div>
        </div>
      </div>
      <form className="card" onSubmit={save}>
        <h2>School details</h2>
        <p className="small muted" style={{ marginBottom: '0.8rem' }}>These appear on receipts, invoices, statements, report cards and every printed page.</p>
        <div className="form-row"><div><label>Portal name (top of every page)</label><input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div><div><label>Full name (printed letterhead)</label><input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required /></div></div>
        <div className="form-row"><div><label>Motto</label><input value={form.motto} onChange={(e) => set('motto', e.target.value)} /></div><div><label>District</label><input value={form.district} onChange={(e) => set('district', e.target.value)} /></div><div><label>Province</label><input value={form.province} onChange={(e) => set('province', e.target.value)} /></div></div>
        <div className="form-row"><div><label>Physical address</label><input value={form.address} onChange={(e) => set('address', e.target.value)} /></div><div><label>P.O. Box</label><input value={form.po_box} onChange={(e) => set('po_box', e.target.value)} /></div></div>
        <div className="form-row"><div><label>Telephone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div><div><label>Email</label><input value={form.email} onChange={(e) => set('email', e.target.value)} /></div></div>
        <div className="form-row"><div><label>Head's name (printed under the signature line)</label><input value={form.headmaster} onChange={(e) => set('headmaster', e.target.value)} /></div><div><label>Bursar's name</label><input value={form.bursar_name} onChange={(e) => set('bursar_name', e.target.value)} /></div></div>
        <label>How to pay (bank account, EcoCash number) {'–'} printed on invoices and statements</label>
        <textarea value={form.bank_details} onChange={(e) => set('bank_details', e.target.value)} rows={3} placeholder="e.g. CBZ Bank, Kadoma branch. Account name: Chakari Primary School. Account no. 0123456789" />
        <label>Message at the bottom of every receipt</label><input value={form.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} />
        <button type="submit" className="btn btn-primary">Save school details</button>
      </form>
    </>
  );
}

// ── Grading scale and marks ──────────────────────────────────────────────────
const DEFAULT_SCALE: GradeBand[] = [
  { min: 90, grade: 'A', unit: 1, descriptor: 'Outstanding' }, { min: 80, grade: 'A', unit: 2, descriptor: 'Excellent' },
  { min: 70, grade: 'B', unit: 3, descriptor: 'Very good' }, { min: 60, grade: 'C', unit: 4, descriptor: 'Good' },
  { min: 50, grade: 'D', unit: 5, descriptor: 'Satisfactory' }, { min: 40, grade: 'E', unit: 6, descriptor: 'Needs improvement' },
  { min: 30, grade: 'U', unit: 7, descriptor: 'Weak' }, { min: 20, grade: 'U', unit: 8, descriptor: 'Very weak' }, { min: 0, grade: 'U', unit: 9, descriptor: 'Ungraded' },
];

export function GradingSettings() {
  const { scale, weights, reload, areas } = useSchool();
  const [rows, setRows] = useState<GradeBand[]>(scale);
  const [w, setW] = useState({ project: weights.project, test: weights.test, exam: weights.exam });
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  useEffect(() => setRows([...scale].sort((a, b) => b.min - a.min)), [scale]);
  useEffect(() => setW(weights), [weights]);
  const edit = (i: number, k: keyof GradeBand, v: string) => setRows(rows.map((r, n) => (n === i ? { ...r, [k]: k === 'grade' || k === 'descriptor' ? v : Number(v) } : r)));
  const sum = Number(w.project) + Number(w.test) + Number(w.exam);

  const save = async () => {
    try { await brandingApi.update({ scale: rows, weights: w }); reload(); setMsg({ text: 'Saved. Grades on every results page and report card now follow this scale.', type: 'success' }); }
    catch (err: any) { setMsg({ text: err.response?.data?.message || 'Could not save', type: 'error' }); }
  };

  return (
    <>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div className="card">
        <h2>Learning areas (Heritage-Based Curriculum 2024{'–'}2030)</h2>
        <p className="small muted" style={{ marginBottom: '0.6rem' }}>A class gets these as soon as a teacher is assigned to it. They cannot be removed.</p>
        <ul style={{ marginLeft: '1.2rem' }}>{areas.map((a) => <li key={a.name}><strong>{a.name}</strong> {a.core ? <span className="muted small">{'–'} compulsory (counts towards the average and class position)</span> : <span className="muted small">{'–'} additional subject (shown separately)</span>}</li>)}</ul>
      </div>
      <div className="card">
        <h2>Marks for each part</h2>
        <div className="form-row">
          <div><label>School-Based Project (out of)</label><input type="number" min={0} value={w.project} onChange={(e) => setW({ ...w, project: Number(e.target.value) })} /></div>
          <div><label>Test (out of)</label><input type="number" min={0} value={w.test} onChange={(e) => setW({ ...w, test: Number(e.target.value) })} /></div>
          <div><label>Exam (out of)</label><input type="number" min={0} value={w.exam} onChange={(e) => setW({ ...w, exam: Number(e.target.value) })} /></div>
          <div><label>Together</label><input value={`${sum} ${sum === 100 ? '✓' : '(must be 100)'}`} readOnly style={{ color: sum === 100 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }} /></div>
        </div>
        <p className="small muted">Each learner does one School-Based Project in every learning area. Teachers cannot enter a mark above these maximums.</p>
      </div>
      <div className="card table-wrap">
        <h2>Marks, grades and units</h2>
        <div className="alert alert-warning">These are the school's default bands (Unit 1 is the best, Unit 9 the lowest). If a Ministry circular gives different mark ranges, change them here and every report card follows.</div>
        <table>
          <thead><tr><th>Mark from</th><th>Grade</th><th>Unit</th><th>Meaning</th><th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input type="number" min={0} max={100} value={r.min} onChange={(e) => edit(i, 'min', e.target.value)} style={{ width: 90 }} /></td>
                <td><input value={r.grade} maxLength={2} onChange={(e) => edit(i, 'grade', e.target.value.toUpperCase())} style={{ width: 70 }} /></td>
                <td><input type="number" min={1} max={9} value={r.unit} onChange={(e) => edit(i, 'unit', e.target.value)} style={{ width: 70 }} /></td>
                <td><input value={r.descriptor} onChange={(e) => edit(i, 'descriptor', e.target.value)} /></td>
                <td><button className="btn btn-sm btn-danger" onClick={() => setRows(rows.filter((_, n) => n !== i))} disabled={rows.length <= 2}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '0.8rem' }}>
          <button className="btn" onClick={() => setRows([...rows, { min: 0, grade: 'U', unit: 9, descriptor: '' }])}>Add a band</button>
          <button className="btn" onClick={() => setRows(DEFAULT_SCALE)}>Use the school defaults</button>
          <button className="btn btn-primary" onClick={save} disabled={sum !== 100}>Save grading</button>
        </div>
      </div>
    </>
  );
}

// ── Passwords ────────────────────────────────────────────────────────────────
export function TempPasswordModal({ info, onClose }: { info: { name: string; temporary_password: string }; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Temporary password for {info.name}</h2>
        <p style={{ margin: '0.5rem 0' }}>Give this to {info.name} in person or by phone. They must change it the first time they log in.</p>
        <div style={{ fontFamily: 'monospace', fontSize: '1.7rem', fontWeight: 700, letterSpacing: 2, textAlign: 'center', padding: '1rem', background: 'var(--surface-2)', border: '1px dashed var(--primary)', borderRadius: 8, margin: '0.8rem 0' }}>{info.temporary_password}</div>
        <p className="small muted">This is shown only once. Any device they were logged in on has been signed out.</p>
        <button className="btn btn-primary" onClick={() => navigator.clipboard?.writeText(info.temporary_password)}>Copy</button><button className="btn" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export function PasswordRequests() {
  const [rows, setRows] = useState<any[]>([]);
  const [temp, setTemp] = useState<any>(null);
  const load = () => passwordApi.requests().then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="card table-wrap">
        <h2>People who asked for a new password ({rows.length})</h2>
        <p className="small muted" style={{ marginBottom: '0.6rem' }}>When someone uses {'“'}Forgot your password?{'”'} on the login page, they appear here. Confirm who they are, then give them a temporary password. You can also do this for anyone from <strong>Users</strong>.</p>
        <table>
          <thead><tr><th>Asked on</th><th>Name</th><th>Role</th><th>Class</th><th>Email / reg. no.</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{fmtDateTime(r.created_at)}</td><td style={{ fontWeight: 600 }}>{r.name}</td><td style={{ textTransform: 'capitalize' }}>{r.role}</td><td>{r.class_name || '-'}</td><td className="small">{r.email}<div className="muted">{r.student_number}</div></td>
                <td className="nowrap"><button className="btn btn-sm btn-primary" onClick={async () => { setTemp((await passwordApi.reset(r.user_id)).data); load(); }}>Give temporary password</button><button className="btn btn-sm" onClick={async () => { await passwordApi.dismiss(r.id); load(); }}>Dismiss</button></td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Nobody is waiting for a password.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>If the administrator forgets their own password</h2>
        <p className="small">Another administrator can reset it from <strong>Users</strong>. If there is no other administrator, ask whoever looks after the portal to run <code>npm run reset-password -- your@email.com NewPassword1</code> in the <code>backend</code> folder while the portal is switched off.</p>
      </div>
      {temp && <TempPasswordModal info={temp} onClose={() => setTemp(null)} />}
    </>
  );
}
