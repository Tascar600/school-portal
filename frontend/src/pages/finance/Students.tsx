import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { studentProfilesApi, discountsApi, financeStudentsApi, statementsApi, messagesApi, openPdf } from '../../services/api';
import { money } from '../../utils/money';
import { fmtDate, fmtRange, todayIso, addDays } from '../../utils/dates';
import { downloadBlob } from '../../utils/downloadBlob';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import FinanceTabs from '../../components/FinanceTabs';
import PrintHeader from '../../components/PrintHeader';
import { PrintButton } from '../../components/PrintDownload';
import Reminders from './Reminders';

const CATEGORIES = ['day', 'staff_child'];

// A pupil's fee history for a period: bills, payments and a running balance
export function StatementModal({ pupilId, onClose, canPay }: { pupilId: number; onClose: () => void; canPay: boolean }) {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<any>(null);
  useEffect(() => { statementsApi.student(pupilId, { from, to }).then((r) => setData(r.data)); }, [pupilId, from, to]);
  const preset = (p: 'year' | 'all' | '90') => {
    if (p === 'year') setFrom(`${new Date().getFullYear()}-01-01`); else if (p === 'all') setFrom('2000-01-01'); else setFrom(addDays(todayIso(), -89));
    setTo(todayIso());
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Fee statement{data ? ` – ${data.student_name}` : ''}</h2>
        {data && <p className="small muted" style={{ marginBottom: '0.6rem' }}>{data.class_name} {'·'} {data.student_number} {data.guardian && `· Guardian: ${data.guardian}`} {data.guardian_phone && `(${data.guardian_phone})`}</p>}
        <div className="toolbar" style={{ marginBottom: '0.8rem' }}>
          <button className="chip" onClick={() => preset('90')}>Last 90 days</button><button className="chip" onClick={() => preset('year')}>This year</button><button className="chip" onClick={() => preset('all')}>Everything</button>
          <span className="small muted">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto', margin: 0 }} />
          <span className="small muted">to</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto', margin: 0 }} />
        </div>
        {!data ? <div className="loading">Loading…</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="num">Charges</th><th className="num">Payments</th><th className="num">Balance</th></tr></thead>
              <tbody>
                <tr><td colSpan={5} className="muted">Balance brought forward ({fmtDate(from)})</td><td className="num">{money(data.opening)}</td></tr>
                {data.lines.map((l: any, i: number) => (
                  <tr key={i}><td className="nowrap">{fmtDate(l.date)}</td><td>{l.ref}</td><td>{l.description}</td><td className="num">{l.charge ? money(l.charge) : ''}</td><td className="num">{l.payment ? money(l.payment) : ''}</td><td className="num">{money(l.balance)}</td></tr>
                ))}
                {data.lines.length === 0 && <tr><td colSpan={6} className="muted">Nothing was billed or paid in this period.</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={3}>Totals for {fmtRange(from, to)}</td><td className="num">{money(data.total_charges)}</td><td className="num">{money(data.total_payments)}</td><td className="num" style={{ color: data.closing > 0 ? 'var(--danger)' : 'var(--success)' }}>{money(data.closing)}</td></tr></tfoot>
            </table>
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={() => openPdf(`/statements/student/${pupilId}/pdf`, { from, to })}>Print statement</button>
          {canPay && <Link className="btn btn-success" to={`/finance/payments?pupil=${pupilId}`}>Receive a payment</Link>}
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Students() {
  const { user } = useAuth();
  const { school } = useSchool();
  const canEdit = user?.role === 'bursary';
  const isAdmin = user?.role === 'admin';
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'pupils' | 'reminders'>('pupils');
  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const [statementFor, setStatementFor] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = (text: string, type: 'info' | 'error' = 'info') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 8000); };
  const load = () => financeStudentsApi.list().then((r) => setRows(r.data));
  useEffect(() => {
    load();
    financeStudentsApi.classes().then((r) => setClasses(r.data));
    discountsApi.list().then((r) => setDiscounts(r.data.filter((d: any) => d.active)));
  }, []);
  useEffect(() => { const id = Number(params.get('open')); if (id) setStatementFor(id); }, [params]);

  const shown = useMemo(() => rows.filter((s) =>
    (!classId || String(s.class_id) === classId) &&
    (!q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.student_number || '').toLowerCase().includes(q.toLowerCase()) || (s.guardian_name || '').toLowerCase().includes(q.toLowerCase())) &&
    (!status || (status === 'owing' ? s.balance > 0.004 : status === 'paid' ? Math.abs(s.balance) <= 0.004 : s.balance < -0.004))
  ), [rows, q, classId, status]);
  const totalOwing = shown.filter((s) => s.balance > 0.004).reduce((a, s) => a + s.balance, 0);

  const remind = async (s: any) => {
    if (!s.guardian_phone) { notify(`There is no phone number for ${s.name}'s guardian. Edit the profile to add one.`, 'error'); return; }
    const body = `Dear parent/guardian, ${s.name} (${s.class_name}) has a school fees balance of ${money(s.balance)} as at ${fmtDate(todayIso())}. Kindly settle at your earliest convenience. Thank you. – ${school.name}`;
    try { const r = await messagesApi.send({ student_id: s.id, phone: s.guardian_phone, body, kind: 'reminder' }); window.open(r.data.waUrl, '_blank'); await messagesApi.markSent(r.data.id); notify(`WhatsApp message prepared for ${s.name}'s guardian.`); }
    catch (err: any) { notify(err.response?.data?.message || 'Could not prepare the message', 'error'); }
  };

  const openEdit = async (s: any) => {
    setEditing(s); setForm(null);
    const p = (await studentProfilesApi.get(s.id)).data;
    setForm({
      category: CATEGORIES.includes(p.category) ? p.category : 'day', discount_id: p.discount_id || '', guardian_name: p.guardian_name || '', guardian_phone: p.guardian_phone || '',
      guardian_email: p.guardian_email || '', address: p.address || '', family_code: p.family_code || '', gender: p.gender || '', dob: p.dob || '', notes: p.notes || '',
    });
  };
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await studentProfilesApi.update(editing.id, { ...form, discount_id: form.discount_id ? Number(form.discount_id) : null, gender: form.gender || null, dob: form.dob || null }); notify('Profile saved'); setEditing(null); setForm(null); load(); }
    catch (err: any) { notify(err.response?.data?.message || 'Could not save the profile', 'error'); }
  };

  // Admin only: bring in a class list from Excel, and move everyone up a class at year end
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file); setImporting(true);
    try { setPreview((await financeStudentsApi.importPreview(fd)).data); } catch (err: any) { notify(err.response?.data?.message || 'Could not read that file', 'error'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const confirmImport = async () => {
    setImporting(true);
    try { const r = await financeStudentsApi.importConfirm({ toCreate: preview.toCreate, toUpdate: preview.toUpdate }); notify(r.data.message); setPreview(null); load(); }
    catch (err: any) { notify(err.response?.data?.message || 'Import failed', 'error'); } finally { setImporting(false); }
  };
  const promote = async () => {
    if (!window.confirm('Move every active pupil up to the next class? Pupils in the top class are marked as left. This cannot be undone automatically.')) return;
    try { notify((await financeStudentsApi.promote()).data.message); load(); } catch (err: any) { notify(err.response?.data?.message || 'Promotion failed', 'error'); }
  };

  return (
    <div>
      <FinanceTabs />
      <PrintHeader title="Pupil fee balances" period={`as at ${fmtDate(todayIso())}`} extra={[classId && classes.find((c) => String(c.id) === classId)?.name, status && { owing: 'pupils owing', paid: 'paid up', credit: 'in credit' }[status]].filter(Boolean).join(', ') || undefined} />
      <div className="page-head no-print">
        <div><h1>Pupils and fee accounts</h1><p>Every pupil's balance. Open a pupil to see their dated fee statement.</p></div>
        <div className="toolbar">
          {isAdmin && <><button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Reading…' : 'Import from Excel'}</button><input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={onFile} /><button className="btn btn-danger" onClick={promote}>Promote to next year</button></>}
          <button className="btn" onClick={async () => downloadBlob((await financeStudentsApi.exportXlsx()).data, 'pupil-roster.xlsx')}>Excel</button>
          <PrintButton />
        </div>
      </div>
      {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

      {canEdit && (
        <div className="tabs no-print">
          <button className={`tab${tab === 'pupils' ? ' active' : ''}`} onClick={() => setTab('pupils')}>Pupils</button>
          <button className={`tab${tab === 'reminders' ? ' active' : ''}`} onClick={() => setTab('reminders')}>Fee reminders</button>
        </div>
      )}

      {tab === 'reminders' && canEdit ? <Reminders /> : (
        <>
          <div className="period-bar no-print">
            <div><label>Find</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="pupil, reg. no. or guardian" style={{ minWidth: 220 }} /></div>
            <div><label>Class</label><select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label>Show</label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Everyone</option><option value="owing">Owing fees</option><option value="paid">Paid up</option><option value="credit">In credit</option></select></div>
            <div className="period-label">{shown.length} pupils<br /><strong style={{ color: 'var(--danger)' }}>{money(totalOwing)} owing</strong></div>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Pupil</th><th>Class</th><th>Parent / guardian</th><th className="num">Balance</th><th className="no-print" /></tr></thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}<div className="muted small">{s.student_number}{s.category === 'staff_child' ? ' · staff child' : ''}{s.status === 'left' ? ' · left' : ''}</div></td>
                    <td>{s.class_name || '-'}</td>
                    <td>{s.guardian_name || <span className="muted">-</span>}<div className="muted small">{s.guardian_phone}</div></td>
                    <td className="num" style={{ fontWeight: 700, color: s.balance > 0.004 ? 'var(--danger)' : s.balance < -0.004 ? 'var(--info)' : 'var(--success)' }}>{s.balance > 0.004 ? money(s.balance) : s.balance < -0.004 ? `${money(-s.balance)} credit` : 'Paid up'}</td>
                    <td className="no-print nowrap">
                      <button className="btn btn-sm btn-primary" onClick={() => setStatementFor(s.id)}>Statement</button>
                      {canEdit && <Link className="btn btn-sm" to={`/finance/payments?pupil=${s.id}`}>Receive fee</Link>}
                      {canEdit && s.balance > 0.004 && <button className="btn btn-sm" onClick={() => remind(s)}>Remind</button>}
                      {canEdit && <button className="btn btn-sm" onClick={() => openEdit(s)}>Edit</button>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={5} className="muted">No pupils match.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {statementFor && <StatementModal pupilId={statementFor} canPay={canEdit} onClose={() => setStatementFor(null)} />}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>Import preview</h2>
            <p>{preview.toCreate.length} new, {preview.toUpdate.length} to update, {preview.errors.length} problem(s). Nothing has been saved yet.</p>
            {preview.errors.length > 0 && <table><thead><tr><th>Row</th><th>Problem</th></tr></thead><tbody>{preview.errors.map((e: any, i: number) => <tr key={i}><td>{e.row}</td><td>{e.reason}</td></tr>)}</tbody></table>}
            {preview.toCreate.length > 0 && <><h3 style={{ marginTop: '0.8rem' }}>New pupils</h3><table><thead><tr><th>Name</th><th>Class</th><th>Guardian</th></tr></thead><tbody>{preview.toCreate.map((s: any, i: number) => <tr key={i}><td>{s.name}</td><td>{s.class_name}</td><td>{s.guardian_name || '-'}</td></tr>)}</tbody></table></>}
            {preview.toUpdate.length > 0 && <><h3 style={{ marginTop: '0.8rem' }}>Existing pupils to update</h3><table><thead><tr><th>Name</th><th>Class</th></tr></thead><tbody>{preview.toUpdate.map((s: any, i: number) => <tr key={i}><td>{s.name}</td><td>{s.class_name}</td></tr>)}</tbody></table></>}
            <div style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={confirmImport} disabled={importing || (preview.toCreate.length === 0 && preview.toUpdate.length === 0)}>{importing ? 'Importing…' : 'Confirm import'}</button>
              <button className="btn" onClick={() => setPreview(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => { setEditing(null); setForm(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.name} {'–'} fee profile</h2>
            {!form ? <p>Loading…</p> : (
              <form onSubmit={saveProfile}>
                <div className="form-row">
                  <div><label>Fee category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c === 'day' ? 'Normal' : 'Staff child'}</option>)}</select></div>
                  <div><label>Discount</label><select value={form.discount_id} onChange={(e) => setForm({ ...form, discount_id: e.target.value })}><option value="">None</option>{discounts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                </div>
                <div className="form-row">
                  <div><label>Parent / guardian name</label><input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></div>
                  <div><label>Guardian phone (WhatsApp)</label><input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} placeholder="+263 77 123 4567" /></div>
                </div>
                <div className="form-row">
                  <div><label>Guardian email</label><input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} /></div>
                  <div><label>Family code (brothers / sisters)</label><input value={form.family_code} onChange={(e) => setForm({ ...form, family_code: e.target.value })} /></div>
                </div>
                <label>Home address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <div className="form-row">
                  <div><label>Gender</label><select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Not stated</option><option value="M">Male</option><option value="F">Female</option></select></div>
                  <div><label>Date of birth</label><input type="date" value={form.dob || ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
                </div>
                <label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <button type="submit" className="btn btn-primary">Save</button><button type="button" className="btn" onClick={() => { setEditing(null); setForm(null); }}>Cancel</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
