import { useState, useEffect } from 'react';
import SortableHeader from '../../components/SortableHeader.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import { listPaymentModes, createPaymentMode, updatePaymentMode, deletePaymentMode } from '../../api/paymentMode.js';

const PAYMENT_MODE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'mode_name', label: 'Mode Name', defaultVisible: true },
  { key: 'mode_code', label: 'Mode Code', defaultVisible: true },
  { key: 'is_bank_linked', label: 'Bank Linked?', defaultVisible: true },
  { key: 'is_cash', label: 'Cash Type?', defaultVisible: true },
  { key: 'is_active', label: 'Status', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true },
];

const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

export default function TransactionMaster() {
  const [modeName, setModeName] = useState('');
  const [modeCode, setModeCode] = useState('');
  const [isBankLinked, setIsBankLinked] = useState(false);
  const [isCash, setIsCash] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('mode_name');
  const [sortDir, setSortDir] = useState('ASC');
  const [loading, setLoading] = useState(false);

  const [editingUid, setEditingUid] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'payment_mode_master_columns',
    PAYMENT_MODE_COLS
  );

  const load = async (p = page, opts = {}) => {
    setLoading(true);
    const q = opts.q ?? search;
    const sb = opts.sortBy ?? sortBy;
    const sd = opts.sortDir ?? sortDir;
    const ps = opts.pageSize ?? pageSize;
    try {
      const res = await listPaymentModes(p, ps, { q, sortBy: sb, sortDir: sd });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(1, { q: search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (key, dir) => {
    if (loading) return;
    setSortBy(key);
    setSortDir(dir);
    load(page, { sortBy: key, sortDir: dir });
  };

  const handlePageSizeChange = (e) => {
    const ps = Number(e.target.value);
    setPageSize(ps);
    setPage(1);
    load(1, { pageSize: ps });
  };

  const resetForm = () => {
    setModeName('');
    setModeCode('');
    setIsBankLinked(false);
    setIsCash(false);
    setIsActive(true);
    setEditingUid(null);
    setError(null);
  };

  const startEdit = (r) => {
    setEditingUid(r.uid);
    setModeName(r.mode_name);
    setModeCode(r.mode_code);
    setIsBankLinked(Boolean(r.is_bank_linked));
    setIsCash(Boolean(r.is_cash));
    setIsActive(Boolean(r.is_active));
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!modeName.trim()) {
      setError('Payment mode name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        mode_name: modeName.trim(),
        mode_code: modeCode.trim() ? modeCode.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : modeName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        is_bank_linked: isBankLinked ? 1 : 0,
        is_cash: isCash ? 1 : 0,
        is_active: isActive ? 1 : 0
      };

      if (editingUid) {
        await updatePaymentMode(editingUid, payload);
        setSuccess('Payment mode updated successfully.');
      } else {
        await createPaymentMode(payload);
        setSuccess('Payment mode added successfully.');
      }

      resetForm();
      await load(editingUid ? page : 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActiveStatus = async (r) => {
    try {
      await updatePaymentMode(r.uid, {
        is_active: r.is_active ? 0 : 1
      });
      await load(page);
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePaymentMode(deleteTarget.uid);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      setError(err.message);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>💳</span> Transaction Master (Payment Modes)
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Configure payment methods (Cash, Bank Transfer, NEFT, Cheque, UPI, Card) loaded across Billing, Advance, and Credit receipts
      </p>

      {/* Form Card */}
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '1rem' }}>
          {editingUid ? 'Edit Payment Mode' : 'Add New Payment Mode'}
        </h3>

        {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="success" style={{ marginBottom: '1rem' }}>✓ {success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Mode Display Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Bank Transfer, NEFT / RTGS, UPI / QR"
              value={modeName}
              onChange={(e) => setModeName(e.target.value)}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Mode Code / Slug (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. bank, neft, upi, cheque"
              value={modeCode}
              onChange={(e) => setModeCode(e.target.value.toLowerCase())}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Checkbox options */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isBankLinked}
              onChange={(e) => setIsBankLinked(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Link to Bank Account (Requires Bank Selection)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isCash}
              onChange={(e) => setIsCash(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Cash Payment (Enables Optional Denomination & Change Calculator)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Active Mode
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving…' : editingUid ? 'Update Payment Mode' : 'Save Payment Mode'}
          </button>
          {editingUid && (
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '0.5rem 1rem',
                background: '#94a3b8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Table Section */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
        Configured Payment Modes
      </h3>
      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <div className="search-box-wrap">
          <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search payment mode name or code…"
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
          columns={PAYMENT_MODE_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <TableContainer loading={loading} text="Loading payment modes…" subtext="Fetching transaction modes">
          <table className="data-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                {isVisible('sno') && <th style={{ width: 50, textAlign: 'right' }}>S.No</th>}
                {isVisible('mode_name') && <SortableHeader label="Mode Name" sortKey="mode_name" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('mode_code') && <SortableHeader label="Mode Code" sortKey="mode_code" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('is_bank_linked') && <th>Bank Linked?</th>}
                {isVisible('is_cash') && <th>Cash Type?</th>}
                {isVisible('is_active') && <th>Status</th>}
                {isVisible('actions') && <th className="actions-th">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.uid} style={editingUid === r.uid ? { background: '#f0f9ff' } : {}}>
                  {isVisible('sno') && <td className="num-cell">{(page - 1) * pageSize + idx + 1}</td>}
                  {isVisible('mode_name') && <td><strong>{r.mode_name}</strong></td>}
                  {isVisible('mode_code') && <td><code>{r.mode_code}</code></td>}
                  {isVisible('is_bank_linked') && (
                    <td>
                      {r.is_bank_linked ? (
                        <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, fontSize: '0.75rem' }}>
                          🏦 Bank Linked
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No</span>
                      )}
                    </td>
                  )}
                  {isVisible('is_cash') && (
                    <td>
                      {r.is_cash ? (
                        <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, fontSize: '0.75rem' }}>
                          💵 Cash
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No</span>
                      )}
                    </td>
                  )}
                  {isVisible('is_active') && (
                    <td>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => toggleActiveStatus(r)}
                        style={{
                          background: r.is_active ? '#dcfce7' : '#fee2e2',
                          color: r.is_active ? '#15803d' : '#b91c1c',
                          border: `1px solid ${r.is_active ? '#bbf7d0' : '#fecdd3'}`,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: loading ? 'wait' : 'pointer'
                        }}
                        title="Click to toggle active/inactive"
                      >
                        {r.is_active ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                  )}
                  {isVisible('actions') && (
                    <td className="action-cell">
                      <button className="icon-btn edit-btn" title="Edit Payment Mode" disabled={loading} onClick={() => startEdit(r)}>
                        <IconEdit />
                      </button>
                      <button className="icon-btn delete-btn" title="Delete Payment Mode" disabled={loading} onClick={() => setDeleteTarget(r)}>
                        <IconTrash />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    {loading ? 'Loading payment modes…' : 'No payment modes found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableContainer>
      </div>

      {/* Pagination Footer */}
      <div className={`pagination-bar ${loading ? 'is-loading' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          {total > 0
            ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} records`
            : '0 records'}
        </span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || page <= 1}
            onClick={() => !loading && { setPage: setPage(1), load: load(1) }}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
          >
            «
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || page <= 1}
            onClick={() => !loading && { setPage: setPage(page - 1), load: load(page - 1) }}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
          >
            ‹
          </button>
          <span style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || page >= totalPages}
            onClick={() => !loading && { setPage: setPage(page + 1), load: load(page + 1) }}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
          >
            ›
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || page >= totalPages}
            onClick={() => !loading && { setPage: setPage(totalPages), load: load(totalPages) }}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
          >
            »
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">Delete Payment Mode?</h3>
            <p className="modal-msg">
              Are you sure you want to delete payment mode <strong>{deleteTarget.mode_name} ({deleteTarget.mode_code})</strong>?
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
