import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell, BarChart } from 'recharts';

// Colours that read well on cream, white and dark backgrounds alike
export const PALETTE = ['#2f7d44', '#b8902a', '#3b82a6', '#b3261e', '#7a5fa8', '#7d8a85', '#c4672b'];

const axis = { fill: 'var(--text-dim)', fontSize: 11 };
const tip = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, fontSize: 12 };
const dollars = (v: number) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const axisMoney = (v: number) => '$' + v;

function label(key: string, group: string) {
  if (group === 'month') { const [y, m] = key.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }); }
  return new Date(key + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// What was billed, what came in (collected) and what went out (expenses), over the chosen period
export function TrendChart({ points, group }: { points: { key: string; collected: number; expenses: number; billed: number }[]; group: string }) {
  const data = points.map((p) => ({ ...p, name: label(p.key, group) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={axis} interval="preserveStartEnd" />
        <YAxis tick={axis} tickFormatter={axisMoney} width={56} domain={[0, 'auto']} />
        <Tooltip contentStyle={tip} formatter={(v: any) => dollars(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="billed" name="Billed" fill={PALETTE[2]} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="collected" name="Collected" fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="expenses" name="Expenses" fill={PALETTE[1]} radius={[3, 3, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="muted small" style={{ padding: '2rem 0', textAlign: 'center' }}>No payments in this period.</p>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tip} formatter={(v: any, n: any) => [`${dollars(Number(v))} (${Math.round((Number(v) / total) * 100)}%)`, n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Billed against collected for each class
export function ClassBars({ rows }: { rows: { class_name: string; billed: number; collected: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="class_name" tick={axis} />
        <YAxis tick={axis} tickFormatter={axisMoney} width={56} />
        <Tooltip contentStyle={tip} formatter={(v: any) => dollars(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="billed" name="Billed" fill={PALETTE[2]} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="collected" name="Collected" fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Average mark of each class, this term against the term before
export function CompareBars({ rows, currentLabel, previousLabel }: { rows: { name: string; average: number | null; previous: number | null }[]; currentLabel: string; previousLabel: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={axis} />
        <YAxis tick={axis} domain={[0, 100]} width={40} />
        <Tooltip contentStyle={tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="previous" name={previousLabel} fill={PALETTE[5]} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="average" name={currentLabel} fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
