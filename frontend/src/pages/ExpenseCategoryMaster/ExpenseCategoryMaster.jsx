import { useState, useEffect } from 'react';
import {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory
} from '../../api/expenseCategory.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const CATEGORY_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'category_name', label: 'Expense Category Name', defaultVisible: true },
  { key: 'created_at', label: 'Date Added', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

function IconEdit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

export default function ExpenseCategoryMaster() {
  // Form State (Only one mandatory input)
  const [categoryName, setCategoryName] = useState('');
  const [editingUid, setEditingUid]     = useState(null);

  // Table & Filter State
  const [categories, setCategories] = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(15);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'expense_category_columns',
    CATEGORY_COLS
  );

  const loadCategories = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const ps = opts.pageSize ?? pageSize;
      const s  = opts.search !== undefined ? opts.search : search;
      const res = await listExpenseCategories(p, ps, { search: s });
      setCategories(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
    } catch (err) {
      setError(`Failed to load expense categories: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories(1);
  }, []);

  const resetForm = () => {
    setCategoryName('');
    setEditingUid(null);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = categoryName.trim();
    if (!trimmed) {
      setError('Expense category name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingUid) {
        await updateExpenseCategory(editingUid, { category_name: trimmed });
        setSuccess(`Category "${trimmed}" updated successfully!`);
      } else {
        await createExpenseCategory({ category_name: trimmed });
        setSuccess(`Category "${trimmed}" created successfully!`);
      }

      resetForm();
      await loadCategories(editingUid ? page : 1);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save expense category');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat) => {
    setEditingUid(cat.uid);
    setCategoryName(cat.category_name);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpenseCategory(deleteTarget.uid);
      setDeleteTarget(null);
      await loadCategories(page);
      setSuccess(`Category "${deleteTarget.category_name}" deleted successfully.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(`Failed to delete category: ${err.message}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <span>📂</span> Expense Category Master
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Manage master expense categories for categorizing shop expenses, bills, maintenance, and supplies
          </p>
        </div>
      </div>

      {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem', fontWeight: 600, fontSize: '0.9rem' }}>
          ✓ {success}
        </div>
      )}

      {/* ── Entry Form Card (Single Mandatory Input) ── */}
      <form onSubmit={handleSave} className="form-card" style={{ marginBottom: '2rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
          {editingUid ? '✏️ Edit Expense Category' : '➕ Add New Expense Category'}
        </h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 260, margin: 0 }}>
            <label style={{ fontWeight: 700, color: '#1e293b' }}>
              Expense Category Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Shop Rent, Tea & Snacks, Electricity, Office Supplies…"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
              style={{ fontSize: '1rem', padding: '0.6rem 0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            {editingUid && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={saving}
                style={{ padding: '0.6rem 1.2rem' }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ padding: '0.6rem 1.5rem', fontWeight: 700 }}
            >
              {saving ? 'Saving…' : editingUid ? '✓ Update Category' : '+ Add Category'}
            </button>
          </div>
        </div>
      </form>

      {/* ── Filter Toolbar ── */}
      <h2>Registered Expense Categories ({total})</h2>
      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <input
          type="text"
          placeholder="Search category name…"
          value={search}
          disabled={loading}
          onChange={(e) => {
            setSearch(e.target.value);
            loadCategories(1, { search: e.target.value });
          }}
          style={{ minWidth: 260, fontSize: '0.88rem' }}
        />

        <label className="records-per-page">
          Show&nbsp;
          <select
            value={pageSize}
            disabled={loading}
            onChange={(e) => {
              const ps = Number(e.target.value);
              setPageSize(ps);
              loadCategories(1, { pageSize: ps });
            }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
          &nbsp;records
        </label>

        <ColumnVisibility
          columns={CATEGORY_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      {/* ── Table Container ── */}
      <TableContainer loading={loading} text="Loading categories…" subtext="Fetching master expense categories">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 60, textAlign: 'right' }}>S.No</th>}
              {isVisible('category_name') && <th>Expense Category Name</th>}
              {isVisible('created_at') && <th style={{ width: 160 }}>Date Added</th>}
              {isVisible('actions') && <th className="actions-th" style={{ width: 100 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, idx) => (
              <tr key={cat.uid} style={editingUid === cat.uid ? { background: '#eff6ff' } : {}}>
                {isVisible('sno') && (
                  <td className="num-cell" style={{ textAlign: 'right', color: '#94a3b8' }}>
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                )}
                {isVisible('category_name') && (
                  <td>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                      {cat.category_name}
                    </span>
                  </td>
                )}
                {isVisible('created_at') && (
                  <td style={{ fontSize: '0.84rem', color: '#64748b' }}>
                    {cat.entry_datetime ? new Date(cat.entry_datetime).toLocaleDateString('en-IN') : '—'}
                  </td>
                )}
                {isVisible('actions') && (
                  <td className="action-cell">
                    <button
                      type="button"
                      className="icon-btn edit-btn"
                      title="Edit Category"
                      disabled={loading}
                      onClick={() => startEdit(cat)}
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-btn delete-btn"
                      title="Delete Category"
                      disabled={loading}
                      onClick={() => setDeleteTarget(cat)}
                    >
                      <IconTrash />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {categories.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                  {loading ? 'Loading categories…' : 'No expense categories found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* ── Pagination Bar ── */}
      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`} style={{ marginTop: '1rem' }}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} categories</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadCategories(1)} title="First">«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadCategories(page - 1)} title="Prev">‹</button>
            <span style={{ padding: '0 8px', fontWeight: 600, fontSize: '0.88rem' }}>{page}</span>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadCategories(page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadCategories(totalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <h3>Confirm Delete Category</h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0.75rem 0' }}>
              Are you sure you want to delete the expense category <strong>"{deleteTarget.category_name}"</strong>?
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: '#dc2626' }} onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
