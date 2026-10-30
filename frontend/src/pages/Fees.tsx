import { useState, useEffect } from 'react';
import { useChild } from '../contexts/ChildContext';
import { paymentsApi, statementsApi, openPdf } from '../services/api';
import { PrintButton } from '../components/PrintDownload';
import PrintHeader from '../components/PrintHeader';
import StatusBadge from '../components/StatusBadge';
import { money } from '../utils/money';
import { fmtDate, todayIso } from '../utils/dates';
import { useAuth } from '../contexts/AuthContext';

// A pupil's own fees: the balance, a dated statement and every receipt
export default function Fees() {
  const { user } = useAuth();
  const { active } = useChild();
  const [stmt, setStmt] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayIso());

  useEffect(() => { statementsApi.my({ from, to }).then((r) => setStmt(r.data)); }, [from, to]);
  useEffect(() => { paymentsApi.my().then((r) => setPayments(r.data)); }, []);

  const balance = stmt?.closing ?? 0;

  return (
    <div>
      <PrintHeader title={`Fee statement – ${active?.name ?? user?.name}`} period={`${fmtDate(from)} – ${fmtDate(to)}`} />
      <div className="page-head">
        <div><h1>My school fees</h1><p>What has been billed, what has been paid, and what is left.</p></div>
        <div className="toolbar no-print"><PrintButton /><button className="btn" onClick={() => openPdf('/statements/my/pdf', { from, to })}>Statement (PDF)</button></div>
      </div>

      <div className="grid">
        <div className={`kpi ${balance > 0.004 ? 'bad' : 'good'}`}>
          <div className="kpi-value">{balance > 0.004 ? money(balance) : balance < -0.004 ? money(-balance) : 'Fully paid'}</div>
          <div className="kpi-label">{balance > 0.004 ? 'Fees owing' : balance < -0.004 ? 'In credit' : 'Balance'}</div>
        </div>
        {stmt && <div className="kpi info"><div className="kpi-value">{money(stmt.total_charges)}</div><div className="kpi-label">Billed in this period</div></div>}
        {stmt && <div className="kpi good"><div className="kpi-value">{money(stmt.total_payments)}</div><div className="kpi-label">Paid in this period</div></div>}
      </div>

      <div className="period-bar no-print">
        <div><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="toolbar"><button className="chip" onClick={() => { setFrom(`${new Date().getFullYear()}-01-01`); setTo(todayIso()); }}>This year</button><button className="chip" onClick={() => { setFrom('2000-01-01'); setTo(todayIso()); }}>Everything</button></div>
      </div>

      <div className="card table-wrap">
        <h2>Statement</h2>
        <table>
          <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="num">Charges</th><th className="num">Payments</th><th className="num">Balance</th></tr></thead>
          <tbody>
            {stmt && <tr><td colSpan={5} className="muted">Balance brought forward ({fmtDate(from)})</td><td className="num">{money(stmt.opening)}</td></tr>}
            {stmt?.lines.map((l: any, i: number) => <tr key={i}><td className="nowrap">{fmtDate(l.date)}</td><td>{l.ref}</td><td>{l.description}</td><td className="num">{l.charge ? money(l.charge) : ''}</td><td className="num">{l.payment ? money(l.payment) : ''}</td><td className="num">{money(l.balance)}</td></tr>)}
            {stmt && stmt.lines.length === 0 && <tr><td colSpan={6} className="muted">Nothing was billed or paid in this period.</td></tr>}
          </tbody>
          {stmt && <tfoot><tr><td colSpan={3}>Balance at {fmtDate(to)}</td><td className="num">{money(stmt.total_charges)}</td><td className="num">{money(stmt.total_payments)}</td><td className="num">{money(stmt.closing)}</td></tr></tfoot>}
        </table>
      </div>

      <div className="card table-wrap no-print">
        <h2>My receipts</h2>
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Method</th><th className="num">Amount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="nowrap">{fmtDate(p.pay_date)}</td><td>{p.receipt_no}</td><td style={{ textTransform: 'capitalize' }}>{p.method}</td><td className="num">{money(p.amount_paid, p.currency)}</td><td><StatusBadge status={p.status} /></td>
                <td><button className="btn btn-sm" onClick={() => openPdf(`/payments/${p.id}/receipt.pdf`)}>Print receipt</button></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="muted">No payments recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="small muted no-print">Fees are recorded by the bursary office. If a payment is missing or a balance looks wrong, please speak to the bursar.</p>
    </div>
  );
}
