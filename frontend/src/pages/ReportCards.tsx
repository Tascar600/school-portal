import { useState, useEffect } from 'react';
import { useChild } from '../contexts/ChildContext';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
import { resultApi, adminApi, markSheetApi } from '../services/api';
import { PrintButton } from '../components/PrintDownload';
import { fmtDate } from '../utils/dates';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const currentTerm = () => { const m = new Date().getMonth(); return m < 4 ? 'Term 1' : m < 8 ? 'Term 2' : 'Term 3'; };
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

export default function ReportCards() {
  const { user } = useAuth();
  const { school, logoUrl, scale } = useSchool();
  const isAdmin = user?.role === 'admin';
  const { active } = useChild();
  const isParent = user?.role === 'parent';
  const isStudent = user?.role === 'student' || isParent;
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(user?.role === 'student' ? user!.id : null);
  useEffect(() => { if (isParent) setSelectedId(active?.id ?? null); }, [isParent, active?.id]);
  const [term, setTerm] = useState(currentTerm());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [headComment, setHeadComment] = useState('');

  useEffect(() => {
    if (isAdmin) {
      adminApi.classes().then((r) => setClasses(r.data));
      adminApi.users().then((r) => setStudents((Array.isArray(r.data) ? r.data : []).filter((u: any) => u.role === 'student')));
    } else if (user?.role === 'teacher') {
      resultApi.students().then((r) => setStudents(Array.isArray(r.data) ? r.data : []));
    }
  }, [user]);

  // A pupil's report opens on the latest term that has marks, not on an empty current term
  useEffect(() => {
    if (!isStudent) return;
    resultApi.my().then((r) => {
      const rows: any[] = Array.isArray(r.data) ? r.data : [];
      const rank = (x: any) => Number(x.academic_year) * 10 + (TERMS.indexOf(x.term) + 1);
      const latest = rows.reduce((best, x) => (!best || rank(x) > rank(best) ? x : best), null as any);
      if (latest && TERMS.includes(latest.term)) { setTerm(latest.term); setYear(String(latest.academic_year)); }
    }).catch(() => undefined);
  }, [isStudent, active?.id]);

  const load = async (id: number) => {
    setLoading(true); setMsg('');
    try {
      const res = await resultApi.reportCard(id, { term, academic_year: year });
      setReport(res.data);
      setTeacherComment(res.data.comments?.teacher_comment || '');
      setHeadComment(res.data.comments?.head_comment || '');
    } catch (err: any) { setMsg(err?.response?.data?.message || 'Failed to load report card'); setReport(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (selectedId) load(selectedId); }, [selectedId, term, year]);

  const saveComments = async () => {
    try {
      await markSheetApi.comment(selectedId!, { term, academic_year: year, teacher_comment: teacherComment, ...(isAdmin ? { head_comment: headComment } : {}) });
      setMsg('Comments saved');
    } catch (err: any) { setMsg(err?.response?.data?.message || 'Could not save the comments'); }
  };

  const list = students.filter((s) => !isAdmin || !classId || String(s.class_id) === classId);
  const core = (report?.results || []).filter((r: any) => r.core);
  const extra = (report?.results || []).filter((r: any) => !r.core);
  const att = report?.attendance;
  const attPct = att && att.total ? Math.round(((att.present + att.late) / att.total) * 100) : null;
  const projects = (report?.results || []).filter((r: any) => r.project_title);

  return (
    <div>
      <div className="page-head no-print">
        <div><h1>Report cards</h1><p>Pupil progress report under the Heritage-Based Curriculum.</p></div>
        <div className="toolbar">{report && <PrintButton />}</div>
      </div>
      {msg && <div className="alert alert-info no-print">{msg}</div>}

      <div className="card no-print">
        <div className="form-row">
          {isAdmin && <div><label>Class</label><select value={classId} onChange={(e) => { setClassId(e.target.value); setSelectedId(null); setReport(null); }}><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
          {!isStudent && (
            <div style={{ flex: 2 }}><label>Pupil</label>
              <select value={selectedId || ''} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{'—'} Choose a pupil {'—'}</option>
                {list.map((s) => <option key={s.id} value={s.id}>{s.name}{s.student_number ? ` (${s.student_number})` : ''}</option>)}
              </select>
            </div>
          )}
          <div><label>Term</label><select value={term} onChange={(e) => setTerm(e.target.value)}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label>Year</label><input value={year} onChange={(e) => setYear(e.target.value)} /></div>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {!report && !loading && <div className="card muted no-print">{isStudent ? 'No report is available for this term yet.' : 'Choose a pupil to see their report card.'}</div>}

      {report && (
        <div className="rc">
          <div className="rc-head">
            <img src={logoUrl} alt="" />
            <div>
              <div className="rc-school">{school.full_name}</div>
              <div className="rc-sub">{[school.district, school.province, school.country].filter(Boolean).join('  ·  ')}</div>
              {(school.address || school.phone || school.email) && <div className="rc-sub">{[school.po_box && `P.O. Box ${school.po_box}`, school.address, school.phone && `Tel: ${school.phone}`, school.email].filter(Boolean).join('  |  ')}</div>}
              {school.motto && <div className="rc-motto">{'“'}{school.motto}{'”'}</div>}
            </div>
            <div style={{ width: 70 }} />
          </div>
          <div className="rc-title"><span>PUPIL PROGRESS REPORT</span><span>{report.term} {'·'} {report.academic_year}</span></div>

          <div className="rc-info">
            <div><span>Pupil</span><strong>{report.student.name}</strong></div>
            <div><span>Registration no.</span><strong>{report.student.student_number || '-'}</strong></div>
            <div><span>Class</span><strong>{report.student.class_name || '-'}</strong></div>
            <div><span>Class teacher</span><strong>{report.class_teacher || '-'}</strong></div>
            <div><span>Position in class</span><strong>{report.position ? `${ordinal(report.position)} out of ${report.class_size}` : '-'}</strong></div>
            <div><span>Attendance</span><strong>{att && att.total ? `${att.present + att.late} of ${att.total} days (${attPct}%)` : 'No register yet'}</strong></div>
          </div>

          <table className="rc-table">
            <thead><tr><th style={{ textAlign: 'left' }}>Learning area</th><th>Project</th><th>Test</th><th>Exam</th><th>Total /100</th><th>Grade</th><th>Unit</th><th style={{ textAlign: 'left' }}>Teacher's remark</th></tr></thead>
            <tbody>
              {core.map((r: any) => (
                <tr key={r.id}><td style={{ textAlign: 'left', fontWeight: 600 }}>{r.subject_name}</td><td>{r.coursework}</td><td>{r.test_score}</td><td>{r.exam}</td><td><strong>{r.total}</strong></td><td><strong className={`grade-${r.grade}`}>{r.grade}</strong></td><td>{r.unit}</td><td style={{ textAlign: 'left' }}>{r.remarks}</td></tr>
              ))}
              {core.length === 0 && <tr><td colSpan={8} style={{ padding: '1rem' }}>No marks have been entered for this term yet.</td></tr>}
              {core.length > 0 && (
                <tr className="rc-total"><td style={{ textAlign: 'left' }}>TOTAL / AVERAGE of {core.length} core learning areas</td><td colSpan={3}>{report.total_marks} out of {core.length * 100}</td><td>{report.average}%</td><td><strong className={`grade-${report.overall_grade}`}>{report.overall_grade}</strong></td><td>{report.overall_unit}</td><td /></tr>
              )}
              {extra.length > 0 && <tr className="rc-sep"><td colSpan={8} style={{ textAlign: 'left' }}>Additional subject (not counted in the average or position)</td></tr>}
              {extra.map((r: any) => (
                <tr key={r.id}><td style={{ textAlign: 'left', fontWeight: 600 }}>{r.subject_name}</td><td>{r.coursework}</td><td>{r.test_score}</td><td>{r.exam}</td><td><strong>{r.total}</strong></td><td><strong className={`grade-${r.grade}`}>{r.grade}</strong></td><td>{r.unit}</td><td style={{ textAlign: 'left' }}>{r.remarks}</td></tr>
              ))}
            </tbody>
          </table>

          {projects.length > 0 && (
            <div className="rc-projects"><strong>School-Based Projects:</strong> {projects.map((r: any) => `${r.subject_name} – ${r.project_title}`).join(';  ')}</div>
          )}

          <div className="rc-cols">
            <div>
              <div className="rc-h">Grade key</div>
              <table className="rc-key">
                <thead><tr><th>Marks</th><th>Grade</th><th>Unit</th><th style={{ textAlign: 'left' }}>Meaning</th></tr></thead>
                <tbody>
                  {[...scale].sort((a, b) => b.min - a.min).map((b, i, arr) => (
                    <tr key={b.unit}><td>{b.min}{i === 0 ? ' – 100' : ` – ${arr[i - 1].min - 1}`}</td><td>{b.grade}</td><td>{b.unit}</td><td style={{ textAlign: 'left' }}>{b.descriptor}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="rc-h">Class teacher's comment</div>
              {!isStudent ? <textarea className="no-print" value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} rows={3} placeholder="Write a short comment about this term" /> : null}
              <div className={isStudent ? 'rc-comment' : 'rc-comment print-only'}>{teacherComment || ' '}</div>
              <div className="rc-h" style={{ marginTop: '0.6rem' }}>Head's comment</div>
              {isAdmin ? <textarea className="no-print" value={headComment} onChange={(e) => setHeadComment(e.target.value)} rows={2} placeholder="Head's comment" /> : null}
              <div className={isAdmin ? 'rc-comment print-only' : 'rc-comment'}>{headComment || ' '}</div>
              {!isStudent && <button className="btn btn-sm btn-primary no-print" style={{ marginTop: '0.4rem' }} onClick={saveComments}>Save comments</button>}
            </div>
          </div>

          <div className="rc-sign">
            <div><span>{report.class_teacher}</span>Class teacher</div>
            <div><span>{school.headmaster}</span>Head</div>
            <div><span>&nbsp;</span>Parent / guardian</div>
            <div><span>{fmtDate(new Date().toISOString().slice(0, 10))}</span>Date issued</div>
          </div>
        </div>
      )}
    </div>
  );
}
