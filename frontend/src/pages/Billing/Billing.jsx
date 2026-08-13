import { useEffect, useState } from 'react';
import NumericInput from '../../components/NumericInput.jsx';
import ImageMatchPicker from '../../components/ImageMatchPicker.jsx';
import { searchCustomers, createCustomer } from '../../api/customer.js';
import { byDesignNumber } from '../../api/stock.js';
import { createBill } from '../../api/bill.js';

const PAYMENT_MODES = ['cash', 'card', 'upi', 'bank_transfer', 'cheque'];

export default function Billing() {
  // Customer
  const [query, setQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customer, setCustomer] = useState(null); // {uid, customer_name, mobile_number}
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  // Stock line entry
  const [designCode, setDesignCode] = useState('');
  const [pendingStock, setPendingStock] = useState(null); // {uid, design_number}
  const [linePieces, setLinePieces] = useState('');
  const [lineRate, setLineRate] = useState('');
  const [items, setItems] = useState([]);

  // Totals / payments
  const [discount, setDiscount] = useState('0');
  const [payments, setPayments] = useState([]); // {mode, amount}
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0]);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedBillUid, setSavedBillUid] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length >= 2) {
        const res = await searchCustomers(query.trim());
        setCustomerResults(res.data);
      } else {
        setCustomerResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const pickCustomer = (c) => { setCustomer(c); setCustomerResults([]); setQuery(''); };

  const saveNewCustomer = async () => {
    if (!newCustomerName || !/^\d{10}$/.test(newCustomerMobile)) {
      setError('New customer needs a name and a 10-digit mobile number.');
      return;
    }
    const res = await createCustomer({ customer_name: newCustomerName, mobile_number: newCustomerMobile });
    setCustomer(res.data);
    setShowNewCustomer(false);
    setNewCustomerName(''); setNewCustomerMobile('');
  };

  const totalAmount = items.reduce((s, i) => s + i.pieces * i.rate_per_piece, 0);
  const netAmount = Math.max(0, Math.round((totalAmount - Number(discount || 0)) * 100) / 100);
  const paymentsSum = Math.round(payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;

  const loadByCode = async () => {
    setError(null);
    if (!designCode) return;
    try {
      const res = await byDesignNumber(designCode);
      setPendingStock(res.data);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleImageResolved = ({ image_filename }) => {
    if (!image_filename) { setError('No design matched — enter the stock code manually instead.'); return; }
    const match = image_filename.match(/-(\d+)/);
    if (match) {
      setDesignCode(match[1]);
      byDesignNumber(match[1]).then((res) => setPendingStock(res.data)).catch((e) => setError(e.message));
    }
  };

  const addItem = () => {
    setError(null);
    if (!pendingStock) { setError('Load a stock item first (photo or code).'); return; }
    if (!linePieces || !lineRate) { setError('Enter pieces and rate.'); return; }
    setItems((it) => [...it, {
      key: crypto.randomUUID(),
      stock_uid: pendingStock.uid,
      design_number: pendingStock.design_number,
      pieces: Number(linePieces),
      rate_per_piece: Number(lineRate),
    }]);
    setDesignCode(''); setPendingStock(null); setLinePieces(''); setLineRate('');
  };

  const removeItem = (key) => setItems((it) => it.filter((i) => i.key !== key));

  const addPayment = () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return;
    setPayments((p) => [...p, { key: crypto.randomUUID(), payment_mode: paymentMode, amount: Number(paymentAmount) }]);
    setPaymentAmount('');
  };
  const removePayment = (key) => setPayments((p) => p.filter((x) => x.key !== key));

  const saveBill = async () => {
    setError(null);
    if (!customer) { setError('Select or create a customer first.'); return; }
    if (items.length === 0) { setError('Add at least one item.'); return; }
    if (paymentsSum !== netAmount) { setError(`Payments (${paymentsSum}) must equal net amount (${netAmount}).`); return; }
    setSaving(true);
    try {
      const res = await createBill({
        customer_uid: customer.uid,
        items: items.map(({ stock_uid, pieces, rate_per_piece }) => ({ stock_uid, pieces, rate_per_piece })),
        discount: Number(discount || 0),
        payments: payments.map(({ payment_mode, amount }) => ({ payment_mode, amount })),
      });
      setSavedBillUid(res.data.uid);
      setItems([]); setPayments([]); setDiscount('0'); setCustomer(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <h1>Billing</h1>

      <div className="card">
        <h3>Customer</h3>
        {customer ? (
          <div>
            Selected: <strong>{customer.customer_name}</strong> ({customer.mobile_number})
            <button type="button" onClick={() => setCustomer(null)}>Change</button>
          </div>
        ) : (
          <>
            <input placeholder="Search by name or mobile…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {customerResults.length > 0 && (
              <ul className="search-results">
                {customerResults.map((c) => (
                  <li key={c.uid}><button type="button" onClick={() => pickCustomer(c)}>{c.customer_name} — {c.mobile_number}</button></li>
                ))}
              </ul>
            )}
            {!showNewCustomer && <button type="button" onClick={() => setShowNewCustomer(true)}>New customer</button>}
            {showNewCustomer && (
              <div className="form-row">
                <input placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                <input placeholder="Mobile number" value={newCustomerMobile} maxLength={10} onChange={(e) => setNewCustomerMobile(e.target.value.replace(/\D/g, ''))} />
                <button type="button" onClick={saveNewCustomer}>Save customer</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3>Add stock item</h3>
        <div className="form-row">
          <input placeholder="Enter stock/design code" value={designCode} onChange={(e) => setDesignCode(e.target.value.replace(/\D/g, ''))} />
          <button type="button" onClick={loadByCode}>Load by code</button>
        </div>
        <ImageMatchPicker autoStartCamera={true} onResolved={handleImageResolved} />
        {pendingStock && (
          <div className="form-row">
            <div>Loaded design #{pendingStock.design_number}</div>
            <label>Pieces <NumericInput value={linePieces} onChange={setLinePieces} /></label>
            <label>Rate/piece <NumericInput value={lineRate} onChange={setLineRate} /></label>
            <button type="button" onClick={addItem}>Add item</button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <table className="data-table">
          <thead><tr><th>Design #</th><th>Pieces</th><th>Rate/piece</th><th>Line amount</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.key}>
                <td>{i.design_number}</td><td>{i.pieces}</td><td>{i.rate_per_piece}</td>
                <td>{(i.pieces * i.rate_per_piece).toFixed(2)}</td>
                <td><button onClick={() => removeItem(i.key)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="card">
        <h3>Totals</h3>
        <div className="totals-row">Total amount: <strong>{totalAmount.toFixed(2)}</strong></div>
        <label>Discount <NumericInput value={discount} onChange={setDiscount} /></label>
        <div className="totals-row">Net amount: <strong>{netAmount.toFixed(2)}</strong></div>

        <h4>Payments</h4>
        <div className="form-row">
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <NumericInput value={paymentAmount} onChange={setPaymentAmount} />
          <button type="button" onClick={addPayment}>Add payment</button>
        </div>
        <ul>
          {payments.map((p) => (
            <li key={p.key}>{p.payment_mode}: {p.amount} <button onClick={() => removePayment(p.key)}>x</button></li>
          ))}
        </ul>
        <div className="totals-row">Payments total: <strong>{paymentsSum.toFixed(2)}</strong> (must equal net amount to save)</div>

        {error && <div className="field-error">{error}</div>}
        {savedBillUid && <div className="success">Bill saved: {savedBillUid}</div>}
        <button type="button" onClick={saveBill} disabled={saving}>Save bill</button>
      </div>
    </div>
  );
}
