import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
import { resultApi, markSheetApi, adminApi } from '../services/api';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';
import PrintHeader from '../components/PrintHeader';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const currentTerm = () => { const m = new Date().getMonth(); return m < 4 ? 'Term 1' : m < 8 ? 'Term 2' : 'Term 3'; };

function Grade({ r }: { r: { grade: string; unit: number } }) {
  return <><span className={`grade-${r.grade}`}>{r.grade}</span> <span className="muted small">(Unit {r.unit})</span></>;
}

// ── Teacher: one learning area for the whole class ───────────────────────────
function MarkSheet() {
  const { areas, weights, gradeFor } = useSchool();
  const [subject, setSubject] = useState('Mathematics');
  const [term, setTerm] = useState(currentTerm());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [projectTitle, setProjectTitle] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = () => {
    setMsg(null);
    markSheetApi.sheet({ subject, term, academic_year: year }).then((r) => {
      setRows(r.data.rows.map((x: any) => ({ ...x, coursework: x.coursework ?? '', test_score: x.test_score ?? '', exam: x.exam ?? '', remarks: x.remarks ?? '' })));
      setProjectTitle(r.data.rows.find((x: any) => x.project_title)?.project_title || '');
      setDirty(false);
    }).catch((e) => setMsg({ text: e.response?.data?.message || 'Could not load the mark sheet', type: 'error' }));
  };
  useEffect(load, [subject, term, year]);

  const set = (i: number, field: string, value: string) => { setRows((rs) => rs.map((r, k) => (k === i ? { ...r, [field]: value } : r))); setDirty(true); };
  const totalOf = (r: any) => (Number(r.coursework) || 0) + (Number(r.test_score) || 0) + (Number(r.exam) || 0);
  const marked = (r: any) => r.coursework !== '' || r.test_score !== '' || r.exam !== '';
  const overMax = (r: any) => Number(r.coursework) > weights.project || Number(r.test_score) > weights.test || Number(r.exam) > weights.exam;

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await markSheetApi.save({
        subject_name: subject, term, academic_year: year, project_title: projectTitle,
        entries: rows.map((r) => ({ student_id: r.id, coursework: r.coursework, test_score: r.test_score, exam: r.exam, remarks: r.remarks })),
      });
      setMsg({ text: res.data.message, type: 'success' }); setDirty(false);
    } catch (e: any) { setMsg({ text: e.response?.data?.message || 'Could not save', type: 'error' }); }
    finally { setSaving(false); }
  };

  const markedRows = rows.filter(marked);
  const average = markedRows.length ? Math.round((markedRows.reduce((s, r) => s + totalOf(r), 0) / markedRows.length) * 10) / 10 : 0;

  return (
    <>
      <PrintHeader title={`Mark sheet – ${subject}`} period={`${term} ${year}`} extra={projectTitle ? `Project: ${projectTitle}` : undefined} />
      <div className="card no-print">
        <h2>Mark sheet</h2>
        <div className="form-row">
          <div><label>Learning area</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {areas.map((a) => <option key={a.name} value={a.name}>{a.name}{a.core ? '' : ' (additional)'}</option>)}
            </select>
          </div>
          <div><label>Term</label><select value={term} onChange={(e) => setTerm(e.target.value)}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label>Year</label><input value={year} onChange={(e) => setYear(e.target.value)} /></div>
          <div style={{ flex: 2 }}><label>School-Based Project (title)</label><input value={projectTitle} onChange={(e) => { setProjectTitle(e.target.value); setDirty(true); }} placeholder="e.g. Model of a food chain" /></div>
        </div>
        <p className="small muted">
          Each part has its own maximum: <strong>Project {weights.project}</strong> + <strong>Test {weights.test}</strong> + <strong>Exam {weights.exam}</strong> = 100.
          Leave a pupil blank if they have not been marked yet.
        </p>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div className="card">
        <div className="page-head" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, border: 0 }}>{subject} {'–'} {term} {year}</h2>
          <div className="toolbar no-print">
            <PrintButton />
            <DownloadCSV filename={`marks-${subject}-${term}-${year}`} headers={['Pupil', 'Project', 'Test', 'Exam', 'Total', 'Grade', 'Unit']}
              data={rows.filter(marked).map((r) => ({ Pupil: r.name, Project: r.coursework, Test: r.test_score, Exam: r.exam, Total: totalOf(r), Grade: gradeFor(totalOf(r)).grade, Unit: gradeFor(totalOf(r)).unit }))} />
            <button className="btn btn-success" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : dirty ? 'Save all marks' : 'Saved'}</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Pupil</th><th className="hide-phone">Reg. no.</th><th className="num">Project /{weights.project}</th><th className="num">Test /{weights.test}</th><th className="num">Exam /{weights.exam}</th><th className="num">Total /100</th><th>Grade</th><th>Remark</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const g = gradeFor(totalOf(r));
                return (
                  <tr key={r.id}>
                    <td>{i + 1}</td><td style={{ fontWeight: 600 }}>{r.name}</td><td className="muted small hide-phone">{r.student_number}</td>
                    <td><input type="number" min={0} max={weights.project} step="0.5" value={r.coursework} onChange={(e) => set(i, 'coursework', e.target.value)} style={{ width: 80 }} aria-label={`Project mark for ${r.name}`} /></td>
                    <td><input type="number" min={0} max={weights.test} step="0.5" value={r.test_score} onChange={(e) => set(i, 'test_score', e.target.value)} style={{ width: 80 }} aria-label={`Test mark for ${r.name}`} /></td>
                    <td><input type="number" min={0} max={weights.exam} step="0.5" value={r.exam} onChange={(e) => set(i, 'exam', e.target.value)} style={{ width: 80 }} aria-label={`Exam mark for ${r.name}`} /></td>
                    <td className="num"><strong style={overMax(r) ? { color: 'var(--danger)' } : undefined}>{marked(r) ? totalOf(r) : '–'}</strong>{overMax(r) && <div className="small" style={{ color: 'var(--danger)' }}>too high</div>}</td>
                    <td>{marked(r) ? <Grade r={g} /> : '–'}</td>
                    <td><input value={r.remarks} onChange={(e) => set(i, 'remarks', e.target.value)} placeholder="optional" /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="muted">No pupils in your class yet.</td></tr>}
            </tbody>
            {markedRows.length > 0 && <tfoot><tr><td colSpan={6}>Class average ({markedRows.length} marked)</td><td className="num">{average}</td><td colSpan={2}><Grade r={gradeFor(average)} /></td></tr></tfoot>}
          </table>
        </div>
      </div>
    </>
  );
}

// ── Teacher / Admin: everything entered so far, with filters ─────────────────
function ResultsList() {
  const { user } = useAuth();
  const { areas, weights, gradeFor } = useSchool();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    const p: any = { term: term || undefined };
    if (isAdmin) { p.class_id = classId || undefined; p.academic_year = year || undefined; resultApi.all(p).then((r) => setRows(r.data)); }
    else resultApi.entered(p).then((r) => setRows(r.data));
  };
  useEffect(() => { if (isAdmin) adminApi.classes().then((r) => setClasses(r.data)); }, []);
  useEffect(load, [classId, term, year]);

  const shown = useMemo(() => rows.filter((r) => (!area || r.subject_name === area) && (!q || (r.student_name || '').toLowerCase().includes(q.toLowerCase()))), [rows, area, q]);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resultApi.update(edit.id, { coursework: edit.coursework, test_score: edit.test_score, exam: edit.exam, remarks: edit.remarks, project_title: edit.project_title });
      setEdit(null); setMsg('Result updated'); load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Could not save'); }
  };
  const del = async (r: any) => { if (!window.confirm(`Delete ${r.student_name}'s ${r.subject_name} result?`)) return; await resultApi.delete(r.id); load(); };
  const archive = async () => {
    const t = prompt('Which term do you want to archive? (e.g. Term 2)'); if (!t) return;
    const y = prompt('Which year?', year); if (!y) return;
    try { await resultApi.archiveTerm({ term: t, academic_year: y }); setMsg(`${t} ${y} archived`); load(); } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  return (
    <>
      <PrintHeader title="Results" period={`${term || 'All terms'} ${year}`.trim()} />
      {msg && <div className="alert alert-info">{msg}</div>}
      <div className="card">
        <div className="period-bar no-print" style={{ border: 0, padding: 0, margin: 0 }}>
          {isAdmin && <div><label>Class</label><select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
          <div><label>Term</label><select value={term} onChange={(e) => setTerm(e.target.value)}><option value="">All terms</option>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></div>
          {isAdmin && <div><label>Year</label><input value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 90 }} /></div>}
          <div><label>Learning area</label><select value={area} onChange={(e) => setArea(e.target.value)}><option value="">All</option>{areas.map((a) => <option key={a.name}>{a.name}</option>)}</select></div>
          <div><label>Find a pupil</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name" /></div>
          <div className="toolbar" style={{ marginLeft: 'auto' }}>
            <PrintButton />
            <DownloadCSV filename="results" headers={['Pupil', 'Learning area', 'Term', 'Year', 'Project', 'Test', 'Exam', 'Total', 'Grade', 'Unit']}
              data={shown.map((r) => ({ Pupil: r.student_name, 'Learning area': r.subject_name, Term: r.term, Year: r.academic_year, Project: r.coursework, Test: r.test_score, Exam: r.exam, Total: r.total, Grade: r.grade, Unit: r.unit }))} />
            {isAdmin && <button className="btn btn-warning" onClick={archive}>Archive a term</button>}
          </div>
        </div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Pupil</th><th>Learning area</th><th>Term</th><th className="num">Project</th><th className="num">Test</th><th className="num">Exam</th><th className="num">Total</th><th>Grade</th><th>Project title</th><th className="no-print" /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.student_name}</td><td>{r.subject_name}</td><td>{r.term} {r.academic_year}{r.status === 'archived' && <> <span className="badge">archived</span></>}</td>
                <td className="num">{r.coursework}</td><td className="num">{r.test_score}</td><td className="num">{r.exam}</td><td className="num"><strong>{r.total}</strong></td>
                <td><Grade r={r} /></td><td className="muted small">{r.project_title}</td>
                <td className="no-print nowrap"><button className="btn btn-sm" onClick={() => setEdit({ ...r })}>Edit</button>{isAdmin && <button className="btn btn-sm btn-danger" onClick={() => del(r)}>Delete</button>}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={10} className="muted">No results found for this selection.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <h2>{edit.student_name} {'–'} {edit.subject_name} ({edit.term} {edit.academic_year})</h2>
            <div className="form-row">
              <div><label>Project /{weights.project}</label><input type="number" min={0} max={weights.project} step="0.5" value={edit.coursework} onChange={(e) => setEdit({ ...edit, coursework: e.target.value })} /></div>
              <div><label>Test /{weights.test}</label><input type="number" min={0} max={weights.test} step="0.5" value={edit.test_score} onChange={(e) => setEdit({ ...edit, test_score: e.target.value })} /></div>
              <div><label>Exam /{weights.exam}</label><input type="number" min={0} max={weights.exam} step="0.5" value={edit.exam} onChange={(e) => setEdit({ ...edit, exam: e.target.value })} /></div>
            </div>
            <p style={{ marginBottom: '0.7rem' }}>Total: <strong>{(Number(edit.coursework) || 0) + (Number(edit.test_score) || 0) + (Number(edit.exam) || 0)}</strong> {'–'} <Grade r={gradeFor((Number(edit.coursework) || 0) + (Number(edit.test_score) || 0) + (Number(edit.exam) || 0))} /></p>
            <label>Project title</label><input value={edit.project_title || ''} onChange={(e) => setEdit({ ...edit, project_title: e.target.value })} />
            <label>Remark</label><input value={edit.remarks || ''} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} />
            <button className="btn btn-primary" type="submit">Save</button><button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button>
          </form>
        </div>
      )}
    </>
  );
}

// ── Pupil: my results ────────────────────────────────────────────────────────
function MyResults() {
  const { gradeFor } = useSchool();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { resultApi.my().then((r) => setRows(r.data)); }, []);
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of rows) { const k = `${r.academic_year} ${r.term}`; m.set(k, [...(m.get(k) || []), r]); }
    return [...m.entries()];
  }, [rows]);

  return (
    <>
      <PrintHeader title={`Results – ${user?.name}`} />
      <div className="page-head"><div><h1>My results</h1><p>Marks for every learning area, with your grade and unit.</p></div><div className="toolbar"><PrintButton /></div></div>
      {groups.length === 0 && <div className="card muted">No results have been entered for you yet.</div>}
      {groups.map(([label, list]) => {
        const core = list.filter((r) => r.core);
        const avg = core.length ? Math.round((core.reduce((s, r) => s + r.total, 0) / core.length) * 10) / 10 : 0;
        return (
          <div className="card table-wrap" key={label}>
            <h2>{label}</h2>
            <table>
              <thead><tr><th>Learning area</th><th className="num">Project</th><th className="num">Test</th><th className="num">Exam</th><th className="num">Total /100</th><th>Grade</th><th>Teacher's remark</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.subject_name}{!r.core && <span className="muted small"> (additional)</span>}{r.project_title && <div className="muted small">Project: {r.project_title}</div>}</td>
                    <td className="num">{r.coursework}</td><td className="num">{r.test_score}</td><td className="num">{r.exam}</td><td className="num"><strong>{r.total}</strong></td><td><Grade r={r} /></td><td className="muted small">{r.remarks}</td>
                  </tr>
                ))}
              </tbody>
              {core.length > 0 && <tfoot><tr><td>Average of the {core.length} core learning areas</td><td colSpan={3} /><td className="num">{avg}</td><td colSpan={2}><Grade r={gradeFor(avg)} /></td></tr></tfoot>}
            </table>
          </div>
        );
      })}
    </>
  );
}

export default function Results() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'sheet' | 'list'>('sheet');
  if (user?.role === 'student' || user?.role === 'parent') return <MyResults />;
  const isTeacher = user?.role === 'teacher';
  return (
    <div>
      <div className="page-head no-print"><div><h1>Results</h1><p>Heritage-Based Curriculum: six core learning areas plus ICT and Robotics. Marks out of 100 give a grade and a unit.</p></div></div>
      {isTeacher && (
        <div className="tabs no-print">
          <button className={`tab${tab === 'sheet' ? ' active' : ''}`} onClick={() => setTab('sheet')}>Enter marks (mark sheet)</button>
          <button className={`tab${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>Marks I have entered</button>
        </div>
      )}
      {isTeacher && tab === 'sheet' ? <MarkSheet /> : <ResultsList />}
    </div>
  );
}
