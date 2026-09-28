import { useEffect, useState } from 'react';
import { termsApi, feeItemsApi, adminApi, discountsApi, currenciesApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

// A starting point for a Zimbabwean primary school's fee catalogue — bursars can edit/delete
// any of these afterwards. Not auto-added; only inserted when explicitly requested below.
const ZIMBABWE_FEE_ITEMS = [
  { name: 'Tuition', description: 'Core government-gazetted tuition fee', is_optional: false },
  { name: 'Levy', description: 'School Development Association / Committee (SDA/SDC) top-up levy', is_optional: false },
  { name: 'Building Fund', description: 'Infrastructure development fund', is_optional: false },
  { name: 'Examination Fees', description: 'ZIMSEC Grade 7 examination fee', is_optional: false },
  { name: 'Sports Levy', description: 'Sports equipment and activities', is_optional: true },
  { name: 'Transport', description: 'School transport, for students who use it', is_optional: true },
];

export default function FinanceSetup() {
  const [terms, setTerms] = useState<any[]>([]);
  const [feeItems, setFeeItems] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [structure, setStructure] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'error'>('info');
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const [termForm, setTermForm] = useState({ year: new Date().getFullYear().toString(), term_no: '1', start_date: '', end_date: '' });
  const [itemForm, setItemForm] = useState({ name: '', description: '', is_optional: false });
  const [discountForm, setDiscountForm] = useState({ name: '', type: 'percent', value: '', fee_item_id: '' });
  const [currencyForm, setCurrencyForm] = useState({ code: '', name: '', rate: '' });

  const showMsg = (m: string, t: 'info' | 'error' = 'info') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 6000); };

  const load = () => {
    termsApi.list().then((r) => {
      setTerms(r.data);
      if (!selectedTerm && r.data.length) setSelectedTerm(r.data.find((t: any) => t.is_current)?.id || r.data[0].id);
    });
    feeItemsApi.list().then((r) => setFeeItems(r.data));
    adminApi.classes().then((r) => setClasses(r.data));
    discountsApi.list().then((r) => setDiscounts(r.data));
    currenciesApi.list().then((r) => setCurrencies(r.data));
  };

  const loadZimbabweFeeItems = async () => {
    setLoadingDefaults(true);
    try {
      const existingNames = new Set(feeItems.map((i) => i.name.toLowerCase()));
      const toAdd = ZIMBABWE_FEE_ITEMS.filter((i) => !existingNames.has(i.name.toLowerCase()));
      for (const item of toAdd) await feeItemsApi.create(item);
      showMsg(toAdd.length ? `Added ${toAdd.length} common fee item(s)` : 'All of these are already in your fee item list');
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to add fee items', 'error'); }
    finally { setLoadingDefaults(false); }
  };

  const addCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currencyForm.code || !currencyForm.name || !currencyForm.rate) return;
    try {
      await currenciesApi.create({ code: currencyForm.code, name: currencyForm.name, rate: parseFloat(currencyForm.rate) });
      showMsg(`${currencyForm.code.toUpperCase()} added`);
      setCurrencyForm({ code: '', name: '', rate: '' });
      currenciesApi.list().then((r) => setCurrencies(r.data));
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to add currency', 'error'); }
  };

  const updateCurrencyRate = async (code: string, rate: string) => {
    const r = parseFloat(rate);
    if (isNaN(r) || r <= 0) return;
    try {
      await currenciesApi.update(code, { rate: r });
      currenciesApi.list().then((r2) => setCurrencies(r2.data));
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to update rate', 'error'); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedTerm) feeItemsApi.structure(selectedTerm).then((r) => setStructure(r.data)); }, [selectedTerm]);

  const createTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await termsApi.create({ year: termForm.year, term_no: parseInt(termForm.term_no), start_date: termForm.start_date, end_date: termForm.end_date });
      showMsg('Term created'); load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to create term', 'error'); }
  };

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name) return;
    try {
      await feeItemsApi.create(itemForm);
      showMsg('Fee item added'); setItemForm({ name: '', description: '', is_optional: false }); load();
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to add fee item', 'error'); }
  };

  const getAmount = (classId: number, feeItemId: number) => {
    const row = structure.find((s) => s.class_id === classId && s.fee_item_id === feeItemId);
    return row ? row.amount : '';
  };

  const setAmount = async (classId: number, feeItemId: number, amount: string) => {
    if (!selectedTerm) return;
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) return;
    try {
      await feeItemsApi.setStructureAmount(selectedTerm, classId, feeItemId, val);
      feeItemsApi.structure(selectedTerm).then((r) => setStructure(r.data));
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to save amount', 'error'); }
  };

  const toggleLock = async (t: any) => {
    try { await termsApi.setLock(t.id, !t.is_locked); showMsg(t.is_locked ? 'Term unlocked' : 'Term locked'); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Failed', 'error'); }
  };

  const setCurrent = async (t: any) => {
    try { await termsApi.setCurrent(t.id); showMsg(`${t.year} Term ${t.term_no} is now current`); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || 'Failed', 'error'); }
  };

  const createDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountForm.name) return;
    try {
      await discountsApi.create({
        name: discountForm.name, type: discountForm.type, value: parseFloat(discountForm.value) || 0,
        fee_item_id: discountForm.fee_item_id ? Number(discountForm.fee_item_id) : null,
      });
      showMsg('Discount added');
      setDiscountForm({ name: '', type: 'percent', value: '', fee_item_id: '' });
      discountsApi.list().then((r) => setDiscounts(r.data));
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed to add discount', 'error'); }
  };

  const toggleDiscountActive = async (d: any) => {
    try {
      await discountsApi.update(d.id, { name: d.name, type: d.type, value: d.value, fee_item_id: d.fee_item_id, active: !d.active });
      discountsApi.list().then((r) => setDiscounts(r.data));
    } catch (err: any) { showMsg(err.response?.data?.message || 'Failed', 'error'); }
  };

  return (
    <div>
      <h1>Finance Setup</h1>
      {msg && <div className={`alert alert-${msgType === 'error' ? 'error' : 'info'}`}>{msg}</div>}

      <div className="card">
        <h2>Terms</h2>
        <table>
          <thead><tr><th>Year</th><th>Term</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td>{t.year}</td>
                <td>Term {t.term_no}</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{t.start_date || '-'}</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{t.end_date || '-'}</td>
                <td>
                  {t.is_current ? <StatusBadge status="current" /> : null}{' '}
                  {t.is_locked ? <StatusBadge status="locked" /> : <StatusBadge status="open" />}
                </td>
                <td>
                  {!t.is_current && <button className="btn btn-sm" onClick={() => setCurrent(t)}>Set Current</button>}
                  <button className="btn btn-sm" onClick={() => toggleLock(t)}>{t.is_locked ? 'Unlock' : 'Lock'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={createTerm} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Year</label><input value={termForm.year} onChange={(e) => setTermForm({ ...termForm, year: e.target.value })} style={{ width: 100 }} /></div>
          <div><label>Term</label>
            <select value={termForm.term_no} onChange={(e) => setTermForm({ ...termForm, term_no: e.target.value })}>
              <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
            </select>
          </div>
          <div><label>Start date</label><input type="date" value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} /></div>
          <div><label>End date</label><input type="date" value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary">Add Term</button>
        </form>
      </div>

      <div className="card">
        <h2>Fee Items</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          New here? <button className="btn btn-sm" onClick={loadZimbabweFeeItems} disabled={loadingDefaults} style={{ marginLeft: '0.3rem' }}>
            {loadingDefaults ? 'Adding…' : 'Load common Zimbabwean fee items'}
          </button> — adds Tuition, Levy, Building Fund, Examination Fees, Sports Levy and Transport as a starting point. Nothing is added automatically; edit or remove any of them afterwards.
        </p>
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Optional</th></tr></thead>
          <tbody>
            {feeItems.map((i) => (
              <tr key={i.id}>
                <td style={{ fontWeight: 600 }}>{i.name}</td>
                <td style={{ color: 'var(--text-dim)' }}>{i.description}</td>
                <td>{i.is_optional ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={createItem} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Name</label><input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Tuition" required /></div>
          <div><label>Description</label><input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <input type="checkbox" checked={itemForm.is_optional} onChange={(e) => setItemForm({ ...itemForm, is_optional: e.target.checked })} /> Optional (opt-in)
          </label>
          <button type="submit" className="btn btn-primary">Add Fee Item</button>
        </form>
      </div>

      <div className="card">
        <h2>Fee Structure</h2>
        <label>Term</label>
        <select value={selectedTerm || ''} onChange={(e) => setSelectedTerm(Number(e.target.value))}>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.year} Term {t.term_no}{t.is_locked ? ' (locked)' : ''}</option>)}
        </select>
        {feeItems.length === 0 || classes.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', marginTop: '0.75rem' }}>Add at least one class and fee item first.</p>
        ) : (
          <table style={{ marginTop: '0.75rem' }}>
            <thead>
              <tr><th>Class</th>{feeItems.map((i) => <th key={i.id}>{i.name}{i.is_optional ? ' (opt.)' : ''}</th>)}</tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  {feeItems.map((i) => (
                    <td key={i.id}>
                      <input
                        type="number" step="0.01" style={{ width: 90 }}
                        defaultValue={getAmount(c.id, i.id)}
                        onBlur={(e) => e.target.value && setAmount(c.id, i.id, e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Discounts</h2>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Applies To</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td>{d.type}</td>
                <td>{d.type === 'percent' ? `${d.value}%` : d.value}</td>
                <td style={{ color: 'var(--text-dim)' }}>{d.fee_item_name || 'Whole bill'}</td>
                <td>{d.active ? 'Active' : 'Inactive'}</td>
                <td><button className="btn btn-sm" onClick={() => toggleDiscountActive(d)}>{d.active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
            {discounts.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>No discounts yet.</td></tr>}
          </tbody>
        </table>
        <form onSubmit={createDiscount} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Name</label><input value={discountForm.name} onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })} placeholder="e.g. Staff discount" required /></div>
          <div><label>Type</label>
            <select value={discountForm.type} onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value })}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </div>
          <div><label>Value</label><input type="number" step="0.01" value={discountForm.value} onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })} style={{ width: 100 }} required /></div>
          <div><label>Applies to</label>
            <select value={discountForm.fee_item_id} onChange={(e) => setDiscountForm({ ...discountForm, fee_item_id: e.target.value })}>
              <option value="">Whole bill</option>
              {feeItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Add Discount</button>
        </form>
      </div>

      <div className="card">
        <h2>Currencies</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Zimbabwe's dual-currency economy means fees can be paid in USD (the base currency here) or ZiG (ZWG), among others.
          Exchange rates move — the official interbank rate is a good reference point, but update this whenever it shifts.
        </p>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Rate (per 1 USD)</th><th>Status</th></tr></thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.code}>
                <td style={{ fontWeight: 600 }}>{c.code}</td>
                <td>{c.name}</td>
                <td>
                  {c.is_base ? '1 (base)' : (
                    <input type="number" step="0.0001" defaultValue={c.rate} style={{ width: 100 }}
                      onBlur={(e) => e.target.value && updateCurrencyRate(c.code, e.target.value)} />
                  )}
                </td>
                <td>{c.active ? <StatusBadge status="active" /> : <StatusBadge status="cancelled" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addCurrency} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label>Code</label><input value={currencyForm.code} onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value })} placeholder="e.g. ZAR" style={{ width: 80 }} required /></div>
          <div><label>Name</label><input value={currencyForm.name} onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })} placeholder="e.g. South African Rand" required /></div>
          <div><label>Rate (per 1 USD)</label><input type="number" step="0.0001" value={currencyForm.rate} onChange={(e) => setCurrencyForm({ ...currencyForm, rate: e.target.value })} style={{ width: 100 }} required /></div>
          <button type="submit" className="btn btn-primary">Add Currency</button>
        </form>
      </div>
    </div>
  );
}
