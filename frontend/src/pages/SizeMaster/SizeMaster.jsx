import { useEffect, useState } from 'react';
import NumericInput from '../../components/NumericInput.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { listSizes, createSize, updateSize, deleteSize } from '../../api/size.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const SIZE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'width_ft', label: 'Width (ft)', defaultVisible: true },
  { key: 'height_ft', label: 'Height (ft)', defaultVisible: true },
  { key: 'thickness_mm', label: 'Thickness (mm)', defaultVisible: true },
  { key: 'entry_date', label: 'Entry Date', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

const EMPTY = { width_ft: '', height_ft: '', thickness_mm: '' };

/* ─── Delete Confirmation Modal ──────────────────────────────── */
function DeleteModal({ onConfirm, onCancel }) {
  return (
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
        <h3 className="modal-title">Delete Size?</h3>
        <p className="modal-msg">This action cannot be undone. Are you sure you want to delete this record?</p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-confirm-delete" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function SizeMaster() {
  const [form, setForm]             = useState(EMPTY);
  const [editingUid, setEditingUid] = useState(null);
  const [rows, setRows]             = useState([]);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [total, setTotal]           = useState(0);
  const [error, setError]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState('entry_datetime');
  const [sortDir, setSortDir]       = useState('desc');
  const [deleteUid, setDeleteUid]   = useState(null);
  const [loading, setLoading]       = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'size_master_columns',
    SIZE_COLS
  );

  const load = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const q  = opts.q        ?? search;
      const sb = opts.sortBy   ?? sortBy;
      const sd = opts.sortDir  ?? sortDir;
      const ps = opts.pageSize ?? pageSize;
      const res = await listSizes(p, ps, { q, sortBy: sb, sortDir: sd });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
    } catch (err) {
      console.error('Failed to load sizes:', err);
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
      if (editingUid) { await updateSize(editingUid, form); }
      else            { await createSize(form); }
      resetForm();
      await load(1);
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

  const confirmDelete = async () => {
    if (!deleteUid) return;
    await deleteSize(deleteUid);
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
      <h1>Size Master</h1>

      {/* ── Form ── */}
      <form onSubmit={submit} className="form-row">
        <label>Width (ft) <span style={{ color: '#ef4444' }}>*</span><NumericInput value={form.width_ft} onChange={set('width_ft')} required /></label>
        <label>Height (ft) <span style={{ color: '#ef4444' }}>*</span><NumericInput value={form.height_ft} onChange={set('height_ft')} required /></label>
        <label>Thickness (mm) <span style={{ color: '#ef4444' }}>*</span><NumericInput value={form.thickness_mm} onChange={set('thickness_mm')} required /></label>
        <button type="submit" disabled={saving}>{editingUid ? 'Update' : 'Save'}</button>
        {editingUid && <button type="button" onClick={resetForm}>Cancel</button>}
      </form>
      {error && <div className="field-error">{error}</div>}

      {/* ── Toolbar ── */}
      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <div className="search-box-wrap">
          <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search width / height / thickness…"
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
          columns={SIZE_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      {/* ── Table ── */}
      <TableContainer loading={loading} text="Loading sizes…" subtext="Fetching size master records">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 60, textAlign: 'right' }}>S.No</th>}
              {isVisible('width_ft') && <SortableHeader label="Width (ft)" sortKey="width_ft" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
              {isVisible('height_ft') && <SortableHeader label="Height (ft)" sortKey="height_ft" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
              {isVisible('thickness_mm') && <SortableHeader label="Thickness (mm)" sortKey="thickness_mm" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
              {isVisible('entry_date') && <SortableHeader label="Entry Date" sortKey="entry_datetime" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('actions') && <th className="actions-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.uid}>
                {isVisible('sno') && <td className="num-cell">{(page - 1) * pageSize + idx + 1}</td>}
                {isVisible('width_ft') && <td className="num-cell">{r.width_ft}</td>}
                {isVisible('height_ft') && <td className="num-cell">{r.height_ft}</td>}
                {isVisible('thickness_mm') && <td className="num-cell">{r.thickness_mm}</td>}
                {isVisible('entry_date') && <td>{new Date(r.entry_datetime).toLocaleString()}</td>}
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
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>{loading ? 'Loading sizes…' : 'No sizes found.'}</td></tr>
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
      {deleteUid && <DeleteModal onConfirm={confirmDelete} onCancel={() => setDeleteUid(null)} />}
    </div>
  );
}
