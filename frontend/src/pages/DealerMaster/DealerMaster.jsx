import { useEffect, useState } from 'react';
import Pagination from '../../components/Pagination.jsx';
import { listDealers, createDealer, updateDealer, deleteDealer } from '../../api/dealer.js';

const STATES = [
  'Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Maharashtra',
  'Gujarat', 'Rajasthan', 'Delhi', 'Uttar Pradesh', 'West Bengal', 'Punjab',
];

const EMPTY = { dealer_name: '', dealer_code: '', mobile_number: '', gstin: '', city: '', state: '' };

export default function DealerMaster() {
  const [form, setForm] = useState(EMPTY);
  const [editingUid, setEditingUid] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [fieldError, setFieldError] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    const res = await listDealers(p, pageSize);
    setRows(res.data);
    setTotal(res.total);
    setPage(res.page);
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field, transform) => (e) => {
    let v = e.target.value;
    if (transform) v = transform(v);
    setForm((f) => ({ ...f, [field]: v }));
  };

  const resetForm = () => { setForm(EMPTY); setEditingUid(null); setFieldError({}); };

  const validateClientSide = () => {
    const errs = {};
    if (!/^[A-Za-z]+$/.test(form.dealer_name)) errs.dealer_name = 'Alphabets only, no spaces';
    if (form.dealer_code.length !== 5) errs.dealer_code = 'Must be exactly 5 characters';
    if (!/^\d{10}$/.test(form.mobile_number)) errs.mobile_number = 'Must be exactly 10 digits';
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin)) {
      errs.gstin = 'Invalid GSTIN format';
    }
    if (!form.city) errs.city = 'Required';
    if (!form.state) errs.state = 'Required';
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateClientSide();
    if (Object.keys(errs).length) { setFieldError(errs); return; }
    setFieldError({});
    setSaving(true);
    try {
      if (editingUid) {
        await updateDealer(editingUid, form);
      } else {
        await createDealer(form);
      }
      resetForm();
      await load(editingUid ? page : 1);
    } catch (err) {
      setFieldError({ [err.field || '_form']: err.message });
    } finally {
      setSaving(false);
    }
  };

  const editRow = (row) => {
    setEditingUid(row.uid);
    setForm({
      dealer_name: row.dealer_name, dealer_code: row.dealer_code, mobile_number: row.mobile_number,
      gstin: row.gstin || '', city: row.city, state: row.state,
    });
  };

  const removeRow = async (uid) => {
    if (!confirm('Delete this dealer?')) return;
    await deleteDealer(uid);
    await load(page);
  };

  return (
    <div className="page">
      <h1>Dealer Master</h1>

      <form onSubmit={submit} className="form-grid">
        <label>
          Dealer Name
          <input value={form.dealer_name} onChange={set('dealer_name', (v) => v.replace(/[^A-Za-z]/g, ''))} required />
          {fieldError.dealer_name && <span className="field-error">{fieldError.dealer_name}</span>}
        </label>
        <label>
          Dealer Code (5 chars)
          <input value={form.dealer_code} maxLength={5} onChange={set('dealer_code')} required />
          {fieldError.dealer_code && <span className="field-error">{fieldError.dealer_code}</span>}
        </label>
        <label>
          Mobile Number
          <input value={form.mobile_number} maxLength={10} onChange={set('mobile_number', (v) => v.replace(/\D/g, ''))} required />
          {fieldError.mobile_number && <span className="field-error">{fieldError.mobile_number}</span>}
        </label>
        <label>
          GSTIN (optional)
          <input value={form.gstin} onChange={set('gstin', (v) => v.toUpperCase())} />
          {fieldError.gstin && <span className="field-error">{fieldError.gstin}</span>}
        </label>
        <label>
          City
          <input value={form.city} onChange={set('city')} required />
          {fieldError.city && <span className="field-error">{fieldError.city}</span>}
        </label>
        <label>
          State
          <select value={form.state} onChange={set('state')} required>
            <option value="">Select state…</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {fieldError.state && <span className="field-error">{fieldError.state}</span>}
        </label>
        <div>
          <button type="submit" disabled={saving}>{editingUid ? 'Update' : 'Save'}</button>
          {editingUid && <button type="button" onClick={resetForm}>Cancel</button>}
        </div>
      </form>
      {fieldError._form && <div className="field-error">{fieldError._form}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Code</th><th>Mobile</th><th>GSTIN</th><th>City</th><th>State</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid}>
              <td>{r.dealer_name}</td><td>{r.dealer_code}</td><td>{r.mobile_number}</td>
              <td>{r.gstin || '-'}</td><td>{r.city}</td><td>{r.state}</td>
              <td>
                <button onClick={() => editRow(r)}>Edit</button>
                <button onClick={() => removeRow(r.uid)}>Delete</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}>No dealers yet.</td></tr>}
        </tbody>
      </table>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={load} />
    </div>
  );
}
