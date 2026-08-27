import { useState, useEffect } from 'react';
import SortableHeader from '../../components/SortableHeader.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import { listBanks, createBank, updateBank, deleteBank } from '../../api/bank.js';

const BANK_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'bank_name', label: 'Bank Name', defaultVisible: true },
  { key: 'bank_code', label: 'Bank Code', defaultVisible: true },
  { key: 'account_number', label: 'Account Number', defaultVisible: true },
  { key: 'ifsc_code', label: 'IFSC Code', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: true },
  { key: 'city', label: 'City', defaultVisible: true },
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
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

export default function BankMaster() {
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branch, setBranch] = useState('');
  const [city, setCity] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('bank_name');
  const [sortDir, setSortDir] = useState('ASC');
  const [loading, setLoading] = useState(false);

  const [editingUid, setEditingUid] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'bank_master_columns',
    BANK_COLS
  );

  const load = async (p = page, opts = {}) => {
    setLoading(true);
    const q = opts.q ?? search;
    const sb = opts.sortBy ?? sortBy;
    const sd = opts.sortDir ?? sortDir;
    const ps = opts.pageSize ?? pageSize;
    try {
      const res = await listBanks(p, ps, { q, sortBy: sb, sortDir: sd });
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
    setBankName('');
    setBankCode('');
    setAccountNumber('');
    setIfscCode('');
    setBranch('');
    setCity('');
    setEditingUid(null);
    setError(null);
  };

  const startEdit = (r) => {
    setEditingUid(r.uid);
    setBankName(r.bank_name);
    setBankCode(r.bank_code);
    setAccountNumber(r.account_number);
    setIfscCode(r.ifsc_code);
    setBranch(r.branch);
    setCity(r.city);
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!bankName.trim() || !bankCode.trim() || !accountNumber.trim() || !ifscCode.trim() || !branch.trim() || !city.trim()) {
      setError('All fields are mandatory. Please fill in Bank Name, Bank Code, Account Number, IFSC, Branch, and City.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        bank_name: bankName.trim(),
        bank_code: bankCode.trim().toUpperCase(),
        account_number: accountNumber.trim(),
        ifsc_code: ifscCode.trim().toUpperCase(),
        branch: branch.trim(),
        city: city.trim()
      };

      if (editingUid) {
        await updateBank(editingUid, payload);
        setSuccess('Bank account updated successfully.');
      } else {
        await createBank(payload);
        setSuccess('Bank account added successfully.');
      }

      resetForm();
      await load(editingUid ? page : 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBank(deleteTarget.uid);
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
        <span>🏦</span> Bank Master
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Configure bank accounts, codes, IFSC, and branches for transaction processing and ledger tracking
      </p>

      {/* Form Card */}
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '1rem' }}>
          {editingUid ? 'Edit Bank Account' : 'Add New Bank Account'}
        </h3>

        {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="success" style={{ marginBottom: '1rem' }}>✓ {success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Bank Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. State Bank of India"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Bank Code <span style={{ color: '#ef4444' }}>*</span> (User Reference)
            </label>
            <input
              type="text"
              placeholder="e.g. SBI-01, HDFC-CORP"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value.toUpperCase())}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Account Number <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 123456789012"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              IFSC Code <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. SBIN0001234"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Branch <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Anna Nagar Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              City <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Chennai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
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
            {saving ? 'Saving…' : editingUid ? 'Update Bank Account' : 'Save Bank Account'}
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
        Bank Accounts List
      </h3>

      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <div className="search-box-wrap">
          <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search bank name, code, A/C #, IFSC, branch…"
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
          columns={BANK_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <TableContainer loading={loading} text="Loading bank accounts…" subtext="Fetching bank master records">
          <table className="data-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                {isVisible('sno') && <th style={{ width: 50, textAlign: 'right' }}>S.No</th>}
                {isVisible('bank_name') && <SortableHeader label="Bank Name" sortKey="bank_name" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('bank_code') && <SortableHeader label="Bank Code" sortKey="bank_code" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('account_number') && <SortableHeader label="Account Number" sortKey="account_number" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('ifsc_code') && <SortableHeader label="IFSC Code" sortKey="ifsc_code" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('branch') && <SortableHeader label="Branch" sortKey="branch" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('city') && <SortableHeader label="City" sortKey="city" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('actions') && <th className="actions-th">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.uid} style={editingUid === r.uid ? { background: '#f0f9ff' } : {}}>
                  {isVisible('sno') && <td className="num-cell">{(page - 1) * pageSize + idx + 1}</td>}
                  {isVisible('bank_name') && <td><strong>{r.bank_name}</strong></td>}
                  {isVisible('bank_code') && (
                    <td>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, fontSize: '0.8rem' }}>
                        {r.bank_code}
                      </span>
                    </td>
                  )}
                  {isVisible('account_number') && <td><code>{r.account_number}</code></td>}
                  {isVisible('ifsc_code') && <td><code>{r.ifsc_code}</code></td>}
                  {isVisible('branch') && <td>{r.branch}</td>}
                  {isVisible('city') && <td>{r.city}</td>}
                  {isVisible('actions') && (
                    <td className="action-cell">
                      <button className="icon-btn edit-btn" title="Edit Bank" disabled={loading} onClick={() => startEdit(r)}>
                        <IconEdit />
                      </button>
                      <button className="icon-btn delete-btn" title="Delete Bank" disabled={loading} onClick={() => setDeleteTarget(r)}>
                        <IconTrash />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    {loading ? 'Loading bank accounts…' : 'No bank accounts configured yet.'}
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
            <h3 className="modal-title">Delete Bank Account?</h3>
            <p className="modal-msg">
              Are you sure you want to delete bank account <strong>{deleteTarget.bank_name} ({deleteTarget.bank_code})</strong>?
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
