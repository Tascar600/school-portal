import { useEffect, useRef, useState } from 'react';
import { studentProfilesApi, discountsApi, sponsorsApi, financeStudentsApi } from '../../services/api';
import { money } from '../../utils/money';
import { downloadBlob } from '../../utils/downloadBlob';

const CATEGORIES = ['day', 'staff_child', 'beam', 'sponsored'];

export default function StudentProfiles() {
  const [students, setStudents] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 8000); };

  const loadStudents = () => financeStudentsApi.list().then((r) => setStudents(r.data));

  useEffect(() => {
    loadStudents();
    discountsApi.list().then((r) => setDiscounts(r.data.filter((d: any) => d.active)));
    sponsorsApi.list().then((r) => setSponsors(r.data.filter((s: any) => s.active)));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setImporting(true);
    try {
      const res = await financeStudentsApi.importPreview(fd);
      setPreview(res.data);
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to read file', 'error'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await financeStudentsApi.importConfirm({ toCreate: preview.toCreate, toUpdate: preview.toUpdate });
      showMsg(res.data.message);
      setPreview(null);
      loadStudents();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Import failed', 'error'); }
    finally { setImporting(false); }
  };

  const exportRoster = async () => {
    const res = await financeStudentsApi.exportXlsx();
    downloadBlob(res.data, 'student-roster.xlsx');
  };

  const promote = async () => {
    if (!window.confirm('Promote every active student to the next class? Students in the top class will be marked as left. This cannot be undone automatically.')) return;
    try {
      const res = await financeStudentsApi.promote();
      showMsg(res.data.message);
      loadStudents();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Promotion failed', 'error'); }
  };

  const openEdit = async (s: any) => {
    setEditing(s);
    setForm(null);
    const res = await studentProfilesApi.get(s.id);
    const p = res.data;
    setForm({
      category: p.category || 'day', discount_id: p.discount_id || '', sponsor_id: p.sponsor_id || '',
      guardian_name: p.guardian_name || '', guardian_phone: p.guardian_phone || '', guardian_email: p.guardian_email || '',
      address: p.address || '', family_code: p.family_code || '', gender: p.gender || '', dob: p.dob || '', notes: p.notes || '',
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !form) return;
    try {
      await studentProfilesApi.update(editing.id, {
        ...form,
        discount_id: form.discount_id ? Number(form.discount_id) : null,
        sponsor_id: form.sponsor_id ? Number(form.sponsor_id) : null,
        gender: form.gender || null,
        dob: form.dob || null,
      });
      showMsg('Student profile updated'); setEditing(null); setForm(null); loadStudents();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to save profile', 'error'); }
  };

  const filtered = students.filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.class_name || '').toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Student Finance Profiles</h1>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button className="btn btn-sm" onClick={exportRoster}>Export Roster</button>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Reading…' : 'Import from Excel'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleFileChange} />
          <button className="btn btn-sm btn-danger" onClick={promote}>Promote to Next Year</button>
        </div>
      </div>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or class…" style={{ marginBottom: '0.75rem' }} />
        <table>
          <thead><tr><th>Name</th><th>Class</th><th>Reg. No.</th><th>Category</th><th>Balance</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.class_name || '-'}</td>
                <td style={{ color: 'var(--text-dim)' }}>{s.student_number || '-'}</td>
                <td>{(s.category || 'day').replace('_', ' ')}</td>
                <td style={{ color: s.balance > 0 ? '#f87171' : '#4ade80', fontWeight: 600 }}>{money(s.balance)}</td>
                <td><button className="btn btn-sm" onClick={() => openEdit(s)}>Edit Profile</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>No students found.</td></tr>}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>Import Preview</h2>
            <p>{preview.toCreate.length} new, {preview.toUpdate.length} to update, {preview.errors.length} error(s). Nothing has been saved yet.</p>
            {preview.errors.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.95rem', color: '#f87171' }}>Errors</h3>
                <table>
                  <thead><tr><th>Row</th><th>Reason</th></tr></thead>
                  <tbody>{preview.errors.map((e: any, i: number) => <tr key={i}><td>{e.row}</td><td>{e.reason}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {preview.toCreate.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.95rem' }}>New students</h3>
                <table>
                  <thead><tr><th>Name</th><th>Class</th><th>Guardian</th></tr></thead>
                  <tbody>{preview.toCreate.map((s: any, i: number) => <tr key={i}><td>{s.name}</td><td>{s.class_name}</td><td>{s.guardian_name || '-'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {preview.toUpdate.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.95rem' }}>Existing students to update</h3>
                <table>
                  <thead><tr><th>Name</th><th>Class</th></tr></thead>
                  <tbody>{preview.toUpdate.map((s: any, i: number) => <tr key={i}><td>{s.name}</td><td>{s.class_name}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={confirmImport} disabled={importing || (preview.toCreate.length === 0 && preview.toUpdate.length === 0)}>
                {importing ? 'Importing…' : 'Confirm Import'}
              </button>
              <button className="btn" onClick={() => setPreview(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => { setEditing(null); setForm(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Finance Profile: {editing.name}</h2>
            {!form ? <p>Loading…</p> : (
              <form onSubmit={save}>
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
                <label>Discount</label>
                <select value={form.discount_id} onChange={(e) => setForm({ ...form, discount_id: e.target.value })}>
                  <option value="">None</option>
                  {discounts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <label>Sponsor</label>
                <select value={form.sponsor_id} onChange={(e) => setForm({ ...form, sponsor_id: e.target.value })}>
                  <option value="">None</option>
                  {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <label>Guardian Name</label>
                <input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
                <label>Guardian Phone</label>
                <input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
                <label>Guardian Email</label>
                <input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} />
                <label>Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <label>Family Code</label>
                <input value={form.family_code} onChange={(e) => setForm({ ...form, family_code: e.target.value })} />
                <label>Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Unspecified</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
                <label>Date of Birth</label>
                <input type="date" value={form.dob || ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                <label>Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <div style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">Save</button>
                  <button type="button" className="btn" onClick={() => { setEditing(null); setForm(null); }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
