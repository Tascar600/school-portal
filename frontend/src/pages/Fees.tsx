import { useState, useEffect } from 'react';
import { invoicesApi, paymentsApi } from '../services/api';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';
import StatusBadge from '../components/StatusBadge';
import { money } from '../utils/money';

export default function Fees() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    invoicesApi.my().then((r) => { setInvoices(r.data.invoices); setBalance(r.data.balance); });
    paymentsApi.my().then((r) => setPayments(r.data));
  }, []);

  const csvData: Record<string, any>[] = [
    ...invoices.map((i) => ({ Type: 'Invoice', Reference: i.invoice_no, Amount: i.total.toFixed(2), Status: i.status, Date: i.inv_date })),
    ...payments.map((p) => ({ Type: 'Payment', Reference: p.receipt_no, Amount: p.amount_paid.toFixed(2), Status: p.status, Date: p.pay_date })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>School Fees</h1>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <PrintButton />
          <DownloadCSV data={csvData} headers={['Type', 'Reference', 'Amount', 'Status', 'Date']} filename="my-fees" label=" CSV" />
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Current balance</div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: balance > 0 ? '#f87171' : '#4ade80' }}>
          {balance > 0 ? `${money(balance)} owing` : balance < 0 ? `${money(-balance)} in credit` : 'Fully paid'}
        </div>
      </div>

      <div className="card">
        <h2>Invoices</h2>
        {invoices.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No invoices yet.</p> : (
          <table>
            <thead><tr><th>Invoice #</th><th>Type</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.invoice_no}</td>
                  <td>{i.type}</td>
                  <td>{money(i.total)}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{i.inv_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Payment History</h2>
        {payments.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No payments recorded yet.</p> : (
          <table>
            <thead><tr><th>Receipt #</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.receipt_no}</td>
                  <td style={{ fontWeight: 600 }}>{money(p.amount_paid, p.currency)}</td>
                  <td>{p.method}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{p.pay_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ background: 'rgba(96,165,250,0.06)' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>
          Fees are recorded by the school's bursary office. If you believe a payment is missing or a balance looks wrong, please contact the bursar directly.
        </p>
      </div>
    </div>
  );
}
