import { useEffect, useState } from 'react';
import { resultApi } from '../services/api';
import { fmtDate } from '../utils/dates';
import { useSchool } from '../contexts/SchoolContext';
import PrintHeader from '../components/PrintHeader';
import { CompareBars } from '../components/Charts';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const thisTerm = () => { const m = new Date().getMonth(); return m < 4 ? 'Term 1' : m < 8 ? 'Term 2' : 'Term 3'; };

// Administrator: every class side by side for one term, with the change since the term before
export default function ClassComparison() {
  const { school } = useSchool();
  const [term, setTerm] = useState(thisTerm());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!/^\d{4}$/.test(year)) return;
    setError('');
    resultApi.classComparison({ term, academic_year: year }).then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.message || 'The comparison could not be loaded'));
  }, [term, year]);

  const withMarks = (data?.classes || []).filter((c: any) => c.average !== null);
  const best = [...withMarks].sort((a: any, b: any) => b.average - a.average)[0];
  const climber = [...withMarks].filter((c: any) => c.change !== null).sort((a: any, b: any) => b.change - a.change)[0];
  const shade = (v: number | null) => (v === null ? undefined : { background: `rgba(31, 90, 46, ${Math.min(0.35, (v / 100) * 0.35)})` });
  const signed = (n: number | null) => (n === null ? '–' : `${n > 0 ? '+' : ''}${n}`);

  return (
    <div>
      <PrintHeader title={`Class comparison – ${term} ${year}`} period={data ? `${fmtDate(data.period.from)} – ${fmtDate(data.period.to)}` : undefined} />
      <div className="page-head">
        <div>
          <h1>Compare classes</h1>
          <p>Every class side by side for one term: average mark, change since the term before, attendance and each learning area.</p>
        </div>
        <div className="toolbar no-print">
          <PrintButton />
          {data && (
            <DownloadCSV filename={`class-comparison-${term}-${year}`}
              headers={['Class', 'Pupils', 'Pupils marked', 'Average', 'Grade', 'Unit', `Average ${data.previous.term} ${data.previous.year}`, 'Change', 'Attendance %', 'Top pupil', ...data.areas]}
              data={data.classes.map((c: any) => ({ Class: c.name, Pupils: c.pupils, 'Pupils marked': c.marked, Average: c.average ?? '', Grade: c.grade ?? '', Unit: c.unit ?? '', [`Average ${data.previous.term} ${data.previous.year}`]: c.previousAverage ?? '', Change: c.change ?? '', 'Attendance %': c.attendance.rate ?? '', 'Top pupil': c.top ? `${c.top.name} (${c.top.average})` : '', ...Object.fromEntries(data.areas.map((a: string) => [a, c.areas[a] ?? ''])) }))} />
          )}
        </div>
      </div>

      <div className="card no-print">
        <div className="form-row">
          <div><label>Term</label><select value={term} onChange={(e) => setTerm(e.target.value)}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label>Year</label><input value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} /></div>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div className="loading">Loading…</div>}

      {data && withMarks.length === 0 && <div className="card muted">No marks have been entered for {term} {year} yet, so there is nothing to compare.</div>}

      {data && withMarks.length > 0 && (
        <>
          <div className="grid">
            <div className="kpi info"><div className="kpi-value">{data.school.average}</div><div className="kpi-label">School average ({data.school.grade}), {data.school.marked} pupils marked</div></div>
            <div className="kpi good"><div className="kpi-value">{best.name}</div><div className="kpi-label">Highest class average ({best.average})</div></div>
            {climber && climber.change > 0 && <div className="kpi good"><div className="kpi-value">{climber.name}</div><div className="kpi-label">Biggest rise since {data.previous.term} ({signed(climber.change)})</div></div>}
          </div>

          <div className="card">
            <h2>Average mark by class</h2>
            <CompareBars rows={withMarks.map((c: any) => ({ name: c.name, average: c.average, previous: c.previousAverage }))} previousLabel={`${data.previous.term} ${data.previous.year}`} currentLabel={`${term} ${year}`} />
          </div>

          <div className="card table-wrap">
            <h2>Class results</h2>
            <p className="muted small">The average is the average of the six compulsory learning areas for every pupil who has marks. ICT and Robotics is shown separately, below. Attendance counts present and late days as a share of all marked days; excused days are left out.</p>
            <table>
              <thead><tr><th>Class</th><th className="num">Pupils</th><th className="num">Marked</th><th className="num">Average</th><th>Grade</th><th className="num">Change</th><th className="num">Attendance</th><th>Top pupil</th></tr></thead>
              <tbody>
                {data.classes.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="num">{c.pupils}</td>
                    <td className="num">{c.marked}</td>
                    <td className="num"><strong>{c.average ?? '–'}</strong></td>
                    <td>{c.grade ? `${c.grade} (Unit ${c.unit})` : '–'}</td>
                    <td className="num" style={c.change !== null ? { color: c.change < 0 ? 'var(--danger)' : c.change > 0 ? 'var(--success)' : undefined, fontWeight: 600 } : undefined}>{signed(c.change)}</td>
                    <td className="num">{c.attendance.rate === null ? '–' : `${c.attendance.rate}%`}</td>
                    <td>{c.top ? `${c.top.name} (${c.top.average})` : '–'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>School</td><td className="num">{data.classes.reduce((s: number, c: any) => s + c.pupils, 0)}</td><td className="num">{data.school.marked}</td><td className="num">{data.school.average ?? '–'}</td><td colSpan={4}>{school.name}</td></tr></tfoot>
            </table>
          </div>

          <div className="card table-wrap">
            <h2>Average by learning area</h2>
            <p className="muted small">Darker green means a higher average. A dash means no marks yet.</p>
            <table>
              <thead><tr><th>Class</th>{data.areas.map((a: string) => <th key={a} className="num" style={{ whiteSpace: 'normal' }}>{a}{data.core.includes(a) ? '' : ' (extra)'}</th>)}</tr></thead>
              <tbody>
                {data.classes.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    {data.areas.map((a: string) => <td key={a} className="num" style={shade(c.areas[a])}>{c.areas[a] ?? '–'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
