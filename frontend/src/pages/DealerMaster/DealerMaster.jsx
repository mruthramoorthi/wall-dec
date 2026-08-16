import { useEffect, useState } from 'react';
import SortableHeader from '../../components/SortableHeader.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { listDealers, createDealer, updateDealer, deleteDealer } from '../../api/dealer.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const DEALER_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'code', label: 'Code', defaultVisible: true },
  { key: 'mobile', label: 'Mobile', defaultVisible: true },
  { key: 'gstin', label: 'GSTIN', defaultVisible: true },
  { key: 'city', label: 'City', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

const STATES = [
  'Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Maharashtra',
  'Gujarat', 'Rajasthan', 'Delhi', 'Uttar Pradesh', 'West Bengal', 'Punjab',
];

const EMPTY = { dealer_name: '', dealer_code: '', mobile_number: '', gstin: '', city: '', state: '' };

export default function DealerMaster() {
  const [form, setForm]             = useState(EMPTY);
  const [editingUid, setEditingUid] = useState(null);
  const [rows, setRows]             = useState([]);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [total, setTotal]           = useState(0);
  const [fieldError, setFieldError] = useState({});
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState('entry_datetime');
  const [sortDir, setSortDir]       = useState('desc');
  const [deleteUid, setDeleteUid]   = useState(null);
  const [loading, setLoading]       = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'dealer_master_columns',
    DEALER_COLS
  );

  const load = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const q  = opts.q        ?? search;
      const sb = opts.sortBy   ?? sortBy;
      const sd = opts.sortDir  ?? sortDir;
      const ps = opts.pageSize ?? pageSize;
      const res = await listDealers(p, ps, { q, sortBy: sb, sortDir: sd });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
    } catch (err) {
      console.error('Failed to load dealers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(1, { q: search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (key, dir) => {
    if (loading) return;
    setSortBy(key); setSortDir(dir);
    load(1, { sortBy: key, sortDir: dir });
  };

  const handlePageSizeChange = (e) => {
    const ps = Number(e.target.value);
    setPageSize(ps);
    load(1, { pageSize: ps });
  };

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
      if (editingUid) { await updateDealer(editingUid, form); }
      else            { await createDealer(form); }
      resetForm();
      await load(1);
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

  const confirmDelete = async () => {
    if (!deleteUid) return;
    await deleteDealer(deleteUid);
    setDeleteUid(null);
    await load(page);
  };

  /* Pagination helpers */
  const totalPages  = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord   = Math.min(page * pageSize, total);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="page">
      <h1>Dealer Master</h1>

      <form onSubmit={submit} className="form-grid">
        <label>
          Dealer Name <span style={{ color: '#ef4444' }}>*</span>
          <input value={form.dealer_name} onChange={set('dealer_name', (v) => v.replace(/[^A-Za-z]/g, ''))} required />
          {fieldError.dealer_name && <span className="field-error">{fieldError.dealer_name}</span>}
        </label>
        <label>
          Dealer Code (5 chars) <span style={{ color: '#ef4444' }}>*</span>
          <input value={form.dealer_code} maxLength={5} onChange={set('dealer_code')} required />
          {fieldError.dealer_code && <span className="field-error">{fieldError.dealer_code}</span>}
        </label>
        <label>
          Mobile Number <span style={{ color: '#ef4444' }}>*</span>
          <input value={form.mobile_number} maxLength={10} onChange={set('mobile_number', (v) => v.replace(/\D/g, ''))} required />
          {fieldError.mobile_number && <span className="field-error">{fieldError.mobile_number}</span>}
        </label>
        <label>
          GSTIN (optional)
          <input value={form.gstin} onChange={set('gstin', (v) => v.toUpperCase())} />
          {fieldError.gstin && <span className="field-error">{fieldError.gstin}</span>}
        </label>
        <label>
          City <span style={{ color: '#ef4444' }}>*</span>
          <input value={form.city} onChange={set('city')} required />
          {fieldError.city && <span className="field-error">{fieldError.city}</span>}
        </label>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            State <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <SearchableSelect
            options={STATES}
            value={form.state}
            onChange={(val) => {
              setForm((prev) => ({ ...prev, state: val }));
              if (fieldError.state) setFieldError((prev) => ({ ...prev, state: null }));
            }}
            placeholder="Select state…"
            required={true}
          />
          {fieldError.state && <span className="field-error">{fieldError.state}</span>}
        </div>
        <div>
          <button type="submit" disabled={saving}>{editingUid ? 'Update' : 'Save'}</button>
          {editingUid && <button type="button" onClick={resetForm}>Cancel</button>}
        </div>
      </form>
      {fieldError._form && <div className="field-error">{fieldError._form}</div>}

      {/* ── Toolbar ── */}
      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <div className="search-box-wrap">
          <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search name / code / mobile / city / state…"
            value={search}
            disabled={loading}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="records-per-page">
          Show&nbsp;
          <select value={pageSize} disabled={loading} onChange={handlePageSizeChange}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={DEALER_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      {/* ── Table ── */}
      <TableContainer loading={loading} text="Loading dealers…" subtext="Fetching dealer directory">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 60 }}>S.No</th>}
              {isVisible('name') && <SortableHeader label="Name" sortKey="dealer_name" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('code') && <SortableHeader label="Code" sortKey="dealer_code" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('mobile') && <SortableHeader label="Mobile" sortKey="mobile_number" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('gstin') && <th>GSTIN</th>}
              {isVisible('city') && <SortableHeader label="City" sortKey="city" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('state') && <SortableHeader label="State" sortKey="state" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('actions') && <th className="actions-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.uid}>
                {isVisible('sno') && <td>{(page - 1) * pageSize + idx + 1}</td>}
                {isVisible('name') && <td>{r.dealer_name}</td>}
                {isVisible('code') && <td>{r.dealer_code}</td>}
                {isVisible('mobile') && <td>{r.mobile_number}</td>}
                {isVisible('gstin') && <td>{r.gstin || '-'}</td>}
                {isVisible('city') && <td>{r.city}</td>}
                {isVisible('state') && <td>{r.state}</td>}
                {isVisible('actions') && (
                  <td className="action-cell">
                    <button className="icon-btn edit-btn" title="Edit" disabled={loading} onClick={() => editRow(r)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className="icon-btn delete-btn" title="Delete" disabled={loading} onClick={() => setDeleteUid(r.uid)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>{loading ? 'Loading dealers…' : 'No dealers found.'}</td></tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* ── Pagination Bar ── */}
      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && load(1)} title="First">«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && load(page - 1)} title="Prev">‹</button>
            {pageNumbers.map((item, idx) =>
              item === '...'
                ? <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                : <button key={item} className={`page-btn${item === page ? ' active' : ''}`} disabled={loading} onClick={() => !loading && load(item)}>{item}</button>
            )}
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && load(page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && load(totalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteUid && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <h3 className="modal-title">Delete Dealer?</h3>
            <p className="modal-msg">This action cannot be undone. Are you sure you want to delete this record?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteUid(null)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
