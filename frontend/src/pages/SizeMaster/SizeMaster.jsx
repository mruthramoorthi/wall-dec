import { useEffect, useState } from 'react';
import NumericInput from '../../components/NumericInput.jsx';
import Pagination from '../../components/Pagination.jsx';
import { listSizes, createSize, updateSize, deleteSize } from '../../api/size.js';

const EMPTY = { width_ft: '', height_ft: '', thickness_mm: '' };

export default function SizeMaster() {
  const [form, setForm] = useState(EMPTY);
  const [editingUid, setEditingUid] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    const res = await listSizes(p, pageSize);
    setRows(res.data);
    setTotal(res.total);
    setPage(res.page);
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const resetForm = () => { setForm(EMPTY); setEditingUid(null); };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.width_ft || !form.height_ft || !form.thickness_mm) {
      setError('All fields are mandatory.');
      return;
    }
    setSaving(true);
    try {
      if (editingUid) {
        await updateSize(editingUid, form);
      } else {
        await createSize(form);
      }
      resetForm();
      await load(editingUid ? page : 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const editRow = (row) => {
    setEditingUid(row.uid);
    setForm({ width_ft: String(row.width_ft), height_ft: String(row.height_ft), thickness_mm: String(row.thickness_mm) });
  };

  const removeRow = async (uid) => {
    if (!confirm('Delete this size?')) return;
    await deleteSize(uid);
    await load(page);
  };

  return (
    <div className="page">
      <h1>Size Master</h1>

      <form onSubmit={submit} className="form-row">
        <label>
          Width (ft)
          <NumericInput value={form.width_ft} onChange={set('width_ft')} required />
        </label>
        <label>
          Height (ft)
          <NumericInput value={form.height_ft} onChange={set('height_ft')} required />
        </label>
        <label>
          Thickness (mm)
          <NumericInput value={form.thickness_mm} onChange={set('thickness_mm')} required />
        </label>
        <button type="submit" disabled={saving}>{editingUid ? 'Update' : 'Save'}</button>
        {editingUid && <button type="button" onClick={resetForm}>Cancel</button>}
      </form>
      {error && <div className="field-error">{error}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Width (ft)</th><th>Height (ft)</th><th>Thickness (mm)</th><th>Entry Date</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid}>
              <td>{r.width_ft}</td>
              <td>{r.height_ft}</td>
              <td>{r.thickness_mm}</td>
              <td>{new Date(r.entry_datetime).toLocaleString()}</td>
              <td>
                <button onClick={() => editRow(r)}>Edit</button>
                <button onClick={() => removeRow(r.uid)}>Delete</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5}>No sizes yet.</td></tr>}
        </tbody>
      </table>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={load} />
    </div>
  );
}
