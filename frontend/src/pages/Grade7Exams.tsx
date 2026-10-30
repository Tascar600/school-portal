import { useEffect, useMemo, useState } from 'react';
import { examsApi } from '../services/api';
import PrintHeader from '../components/PrintHeader';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';

type Cell = { mark: string; unit: string };

// Grade 7 examination results: the Administrator and the Grade 7 teacher type in the mark and unit each pupil was
// given in each learning area. The portal totals and compares them; it does not decide who passes.
export default function Grade7Exams() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<any>(null);
  const [area, setArea] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Cell>>({});
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!/^\d{4}$/.test(year)) return;
    examsApi.grade7(year).then((r) => { setData(r.data); setArea((a) => a || r.data.areas[0]); })
      .catch((e) => { setData(null); setMsg({ text: e.response?.data?.message || 'The results could not be loaded', type: 'error' }); });
  };
  useEffect(() => { setDrafts({}); setMsg(null); load(); }, [year]);

  const key = (id: number, a: string) => `${id}|${a}`;
  const saved = (p: any, a: string): Cell => ({ mark: p.results[a]?.mark ?? '', unit: p.results[a]?.unit ?? '' } as any);
  const shown = (p: any, a: string): Cell => drafts[key(p.id, a)] ?? { mark: String(saved(p, a).mark), unit: String(saved(p, a).unit) };
  const edit = (p: any, a: string, field: keyof Cell, value: string) => setDrafts((d) => ({ ...d, [key(p.id, a)]: { ...shown(p, a), [field]: value } }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const entries = Object.entries(drafts).map(([k, c]) => { const [id, a] = k.split('|'); return { student_id: Number(id), area: a, mark: c.mark, unit: c.unit }; });
      const r = await examsApi.saveGrade7({ academic_year: year, entries });
      setMsg({ text: r.data.message, type: 'success' }); setDrafts({}); load();
    } catch (e: any) { setMsg({ text: e.response?.data?.message || 'Could not save', type: 'error' }); }
    finally { setSaving(false); }
  };

  const dirty = Object.keys(drafts).length;
  const csv = useMemo(() => (data ? data.pupils.map((p: any) => ({
    Pupil: p.name, 'Reg. no.': p.student_number,
    ...Object.fromEntries(data.areas.flatMap((a: string) => [[`${a} mark`, p.results[a]?.mark ?? ''], [`${a} unit`, p.results[a]?.unit ?? '']])),
    'Average mark': p.averageMark ?? '', 'Total of units': p.totalUnits ?? '',
  })) : []), [data]);

  return (
    <div>
      <PrintHeader title={`Grade 7 examination results – ${year}`} />
      <div className="page-head">
        <div>
          <h1>Grade 7 exam results</h1>
          <p>The mark and unit each Grade 7 pupil was given in each learning area, with the totals and how the class did.</p>
        </div>
        <div className="toolbar no-print">
          <PrintButton />
          {data && <DownloadCSV filename={`grade-7-results-${year}`} headers={Object.keys(csv[0] || { Pupil: '' })} data={csv} />}
        </div>
      </div>

      <div className="card no-print">
        <div className="form-row">
          <div><label>Year of the examination</label><input value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} /></div>
          {data && <div><label>Learning area to enter</label><select value={area} onChange={(e) => setArea(e.target.value)}>{data.areas.map((a: string) => <option key={a}>{a}</option>)}</select></div>}
        </div>
        <p className="muted small">Type the mark (0 to 100) and the unit (1 to 9, where 1 is best) exactly as they appear on the examination results. Either can be left blank. Clear both to remove a result. The portal does not decide who has passed.</p>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {!data && !msg && <div className="loading">Loading…</div>}

      {data && (
        <>
          <div className="card no-print">
            <div className="page-head" style={{ marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, border: 0 }}>{area}</h2>
              <button className="btn btn-success" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : dirty ? `Save ${dirty} change${dirty === 1 ? '' : 's'}` : 'Saved'}</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Pupil</th><th>Reg. no.</th><th>Mark /100</th><th>Unit</th></tr></thead>
                <tbody>
                  {data.pupils.map((p: any, i: number) => {
                    const c = shown(p, area);
                    return (
                      <tr key={p.id}>
                        <td>{i + 1}</td><td style={{ fontWeight: 600 }}>{p.name}</td><td className="muted small">{p.student_number}</td>
                        <td><input type="number" min={0} max={100} step="0.5" value={c.mark} onChange={(e) => edit(p, area, 'mark', e.target.value)} style={{ width: 90 }} aria-label={`Mark for ${p.name}`} /></td>
                        <td><select value={c.unit} onChange={(e) => edit(p, area, 'unit', e.target.value)} style={{ width: 90 }} aria-label={`Unit for ${p.name}`}><option value="">–</option>{data.units.map((u: number) => <option key={u} value={u}>{u}</option>)}</select></td>
                      </tr>
                    );
                  })}
                  {data.pupils.length === 0 && <tr><td colSpan={5} className="muted">There are no pupils in Grade 7 yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card table-wrap">
            <h2>Results by pupil</h2>
            <p className="muted small">Each cell shows mark / unit. “Total of units” adds the units of the learning areas that have one; a lower total means better results.</p>
            <table>
              <thead><tr><th>Pupil</th>{data.areas.map((a: string) => <th key={a} className="num" style={{ whiteSpace: 'normal' }}>{a}</th>)}<th className="num">Average mark</th><th className="num">Total of units</th></tr></thead>
              <tbody>
                {data.pupils.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    {data.areas.map((a: string) => { const r = p.results[a]; return <td key={a} className="num">{r ? `${r.mark ?? '–'} / ${r.unit ?? '–'}` : '–'}</td>; })}
                    <td className="num"><strong>{p.averageMark ?? '–'}</strong></td>
                    <td className="num"><strong>{p.totalUnits ?? '–'}</strong>{p.totalUnits !== null && p.unitsCounted < data.areas.length ? <span className="muted small"> ({p.unitsCounted} areas)</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card table-wrap">
            <h2>How the class did in each learning area</h2>
            <table>
              <thead><tr><th>Learning area</th><th className="num">Sat</th><th className="num">Average</th><th className="num">Highest</th><th className="num">Lowest</th>{data.units.map((u: number) => <th key={u} className="num">Unit {u}</th>)}</tr></thead>
              <tbody>
                {data.summary.map((s: any) => (
                  <tr key={s.area}>
                    <td style={{ fontWeight: 600 }}>{s.area}</td><td className="num">{s.sat}</td><td className="num">{s.averageMark ?? '–'}</td><td className="num">{s.highest ?? '–'}</td><td className="num">{s.lowest ?? '–'}</td>
                    {data.units.map((u: number) => <td key={u} className="num">{s.distribution[u] || '·'}</td>)}
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
