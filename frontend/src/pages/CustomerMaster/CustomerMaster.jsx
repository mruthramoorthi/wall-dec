import { useState, useEffect } from 'react';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomer } from '../../api/customer.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { STATES, CITIES_BY_STATE, AREAS_BY_CITY, lookupPincode } from '../../data/locationData.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const CUSTOMER_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'customer_name', label: 'Customer Name', defaultVisible: true },
  { key: 'mobile_number', label: 'Mobile Number', defaultVisible: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'area_city', label: 'Area / City', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'pincode', label: 'Pincode', defaultVisible: true },
  { key: 'address', label: 'Address', defaultVisible: true },
  { key: 'registered', label: 'Registered', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

function formatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function DeleteModal({ customerInfo, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: '#b91c1c' }}>Confirm Deletion</h3>
        <p style={{ margin: '0 0 1.25rem 0', color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Are you sure you want to delete customer <strong>{customerInfo?.customer_name}</strong> ({customerInfo?.mobile_number})?
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-cancel-modal" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-confirm-delete" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerMaster() {
  /* ── Form State ── */
  const [editingUid, setEditingUid] = useState(null);
  const [name, setName]             = useState('');
  const [mobile, setMobile]         = useState('');
  const [email, setEmail]           = useState('');
  const [address, setAddress]       = useState('');
  const [pincode, setPincode]       = useState('');
  const [state, setState]           = useState('Tamil Nadu');
  const [city, setCity]             = useState('');
  const [area, setArea]             = useState('');

  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);

  /* ── Table & Pagination State ── */
  const [rows, setRows]             = useState([]);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [total, setTotal]           = useState(0);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'customer_master_columns',
    CUSTOMER_COLS
  );

  /* ── Delete Modal State ── */
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── Dynamic dropdown lists based on selection ── */
  const availableCities = CITIES_BY_STATE[state] || [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode',
    'Bengaluru', 'Mysuru', 'Kochi', 'Mumbai', 'Pune', 'Hyderabad', 'Ahmedabad', 'New Delhi'
  ];

  const availableAreas = AREAS_BY_CITY[city] || [
    'Central', 'North Area', 'South Area', 'Main Bazaar', 'Commercial Hub', 'Industrial Area'
  ];

  /* ── Pincode Auto-lookup ── */
  const handlePincodeChange = (pinValue) => {
    const cleanPin = pinValue.replace(/\D/g, '').slice(0, 6);
    setPincode(cleanPin);

    if (cleanPin.length === 6) {
      const match = lookupPincode(cleanPin);
      if (match) {
        if (match.state) setState(match.state);
        if (match.city) setCity(match.city);
        if (match.area) setArea(match.area);
      }
    }
  };

  /* ── Load Customers ── */
  const loadCustomers = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const ps = opts.pageSize ?? pageSize;
      const s  = opts.search !== undefined ? opts.search : search;
      const res = await listCustomers(p, ps, { search: s });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
    } catch (err) {
      setError(`Failed to load customers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search debounce ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(1, { search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Submit / Save Customer ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }
    if (!state) {
      setError('State is required.');
      return;
    }
    if (!city) {
      setError('City is required.');
      return;
    }
    if (!area) {
      setError('Area is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_name: name.trim(),
        mobile_number: mobile.trim(),
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        pincode: pincode ? pincode.trim() : null,
        state: state.trim(),
        city: city.trim(),
        area: area.trim(),
        country: 'India'
      };

      if (editingUid) {
        await updateCustomer(editingUid, payload);
        setSuccess(`Customer "${name.trim()}" updated successfully!`);
      } else {
        await createCustomer(payload);
        setSuccess(`Customer "${name.trim()}" created successfully!`);
      }

      resetForm();
      await loadCustomers(editingUid ? page : 1);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingUid(null);
    setName('');
    setMobile('');
    setEmail('');
    setAddress('');
    setPincode('');
    setState('Tamil Nadu');
    setCity('');
    setArea('');
    setError(null);
  };

  /* ── Start Edit ── */
  const startEdit = async (uid) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await getCustomer(uid);
      const c = res.data;
      setEditingUid(c.uid);
      setName(c.customer_name || '');
      setMobile(c.mobile_number || '');
      setEmail(c.email || '');
      setAddress(c.address || '');
      setPincode(c.pincode || '');
      setState(c.state || 'Tamil Nadu');
      setCity(c.city || '');
      setArea(c.area || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(`Failed to load customer: ${err.message}`);
    }
  };

  /* ── Delete Action ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.uid);
      setDeleteTarget(null);
      if (editingUid === deleteTarget.uid) resetForm();
      setSuccess(`Customer "${deleteTarget.customer_name}" deleted successfully!`);
      await loadCustomers(page);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to delete customer: ${err.message}`);
      setDeleteTarget(null);
    }
  };

  /* ── Pagination helpers ── */
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>Customer Master</h1>
      </div>

      {/* ── Edit Mode Banner ── */}
      {editingUid && (
        <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
          <span>✏️ Editing Customer: <strong>{name}</strong></span>
          <button type="button" onClick={resetForm} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            Cancel editing
          </button>
        </div>
      )}

      {/* ── Customer Form Card ── */}
      <div className="card">
        <h3>{editingUid ? 'Edit Customer Details' : 'Add New Customer'}</h3>

        <form onSubmit={handleSubmit}>
          {/* Row 1: Name, Mobile, Email */}
          <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
            <label>
              Customer Name <span style={{ color: '#ef4444' }}>*</span>
              <input
                type="text"
                placeholder="Enter customer name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label>
              Mobile Number (10 Digits) <span style={{ color: '#ef4444' }}>*</span>
              <input
                type="text"
                placeholder="10-digit mobile number"
                value={mobile}
                maxLength={10}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                required
              />
            </label>

            <label>
              Email Address (Optional)
              <input
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>

          {/* Row 2: Address, Pincode (with Auto-lookup) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '0.85rem' }}>
            <label>
              Street Address (Optional)
              <input
                type="text"
                placeholder="Door No, Street name, Landmark"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: '100%', marginTop: '0.3rem', boxSizing: 'border-box' }}
              />
            </label>

            <label>
              Pincode (6 Digits)
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="e.g. 600001 (Auto-fills location)"
                  value={pincode}
                  maxLength={6}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  style={{ width: '100%', marginTop: '0.3rem', boxSizing: 'border-box', fontWeight: 600 }}
                />
              </div>
            </label>
          </div>

          {/* Row 3: State *, City *, Area * */}
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1rem' }}>
            <label>
              State <span style={{ color: '#ef4444' }}>*</span>
              <div style={{ marginTop: '0.3rem' }}>
                <SearchableSelect
                  options={STATES}
                  value={state}
                  onChange={(val) => { setState(val); setCity(''); setArea(''); }}
                  placeholder="Search state…"
                  required
                />
              </div>
            </label>

            <label>
              City <span style={{ color: '#ef4444' }}>*</span>
              <div style={{ marginTop: '0.3rem' }}>
                <SearchableSelect
                  options={availableCities}
                  value={city}
                  onChange={(val) => { setCity(val); setArea(''); }}
                  placeholder="Search city…"
                  required
                />
              </div>
            </label>

            <label>
              Area / Locality <span style={{ color: '#ef4444' }}>*</span>
              <div style={{ marginTop: '0.3rem' }}>
                <SearchableSelect
                  options={availableAreas}
                  value={area}
                  onChange={setArea}
                  placeholder="Search area…"
                  required
                />
              </div>
            </label>
          </div>

          {error && <div className="field-error">{error}</div>}
          {success && <div className="success">✓ {success}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: editingUid ? '#0284c7' : '#16a34a',
                color: '#fff',
                padding: '0.6rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.92rem',
                borderRadius: 6
              }}
            >
              {saving ? 'Saving…' : editingUid ? 'Update Customer' : '+ Save Customer'}
            </button>
            {editingUid && (
              <button
                type="button"
                onClick={resetForm}
                style={{ background: '#94a3b8', color: '#fff', padding: '0.6rem 1rem', borderRadius: 6 }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Customers List Table ── */}
      <h2 style={{ marginTop: '1.75rem', marginBottom: '0.75rem' }}>Customer Records</h2>

      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <input
          type="text"
          placeholder="Search name, mobile, email, area, city, pincode…"
          value={search}
          disabled={loading}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 280, padding: '0.45rem 0.75rem', fontSize: '0.88rem' }}
        />
        <span className="pagination-info" style={{ marginLeft: '0.5rem' }}>
          {total === 0 ? 'No customers found.' : `${total} customer${total !== 1 ? 's' : ''}`}
        </span>
        <label className="records-per-page">
          Show&nbsp;
          <select
            value={pageSize}
            disabled={loading}
            onChange={(e) => {
              const ps = Number(e.target.value);
              setPageSize(ps);
              loadCustomers(1, { pageSize: ps });
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={CUSTOMER_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <TableContainer loading={loading} text="Loading customers…" subtext="Fetching customer directory">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 50 }}>S.No</th>}
              {isVisible('customer_name') && <th>Customer Name</th>}
              {isVisible('mobile_number') && <th>Mobile Number</th>}
              {isVisible('email') && <th>Email</th>}
              {isVisible('area_city') && <th>Area / City</th>}
              {isVisible('state') && <th>State</th>}
              {isVisible('pincode') && <th>Pincode</th>}
              {isVisible('address') && <th>Address</th>}
              {isVisible('registered') && <th>Registered</th>}
              {isVisible('actions') && <th className="actions-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c, idx) => (
              <tr key={c.uid} style={editingUid === c.uid ? { background: '#f0f9ff' } : {}}>
                {isVisible('sno') && <td>{(page - 1) * pageSize + idx + 1}</td>}
                {isVisible('customer_name') && <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.customer_name}</td>}
                {isVisible('mobile_number') && <td style={{ fontWeight: 600, color: '#0369a1' }}>{c.mobile_number}</td>}
                {isVisible('email') && (
                  <td style={{ color: c.email ? '#334155' : '#94a3b8', fontStyle: c.email ? 'normal' : 'italic' }}>
                    {c.email || '—'}
                  </td>
                )}
                {isVisible('area_city') && (
                  <td>
                    {c.area || c.city ? (
                      <span>
                        <strong>{c.area || ''}</strong>
                        {c.area && c.city ? ', ' : ''}
                        <span style={{ color: '#475569' }}>{c.city || ''}</span>
                      </span>
                    ) : '—'}
                  </td>
                )}
                {isVisible('state') && <td style={{ color: '#475569' }}>{c.state || '—'}</td>}
                {isVisible('pincode') && <td style={{ fontWeight: 600, color: '#475569' }}>{c.pincode || '—'}</td>}
                {isVisible('address') && (
                  <td style={{ color: c.address ? '#334155' : '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.address || '—'}
                  </td>
                )}
                {isVisible('registered') && (
                  <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    {formatDateTime(c.entry_datetime)}
                  </td>
                )}
                {isVisible('actions') && (
                  <td className="action-cell">
                    <button className="icon-btn edit-btn" title="Edit Customer" disabled={loading} onClick={() => startEdit(c.uid)}>
                      <IconEdit />
                    </button>
                    <button className="icon-btn delete-btn" title="Delete Customer" disabled={loading} onClick={() => setDeleteTarget(c)}>
                      <IconTrash />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  {loading ? 'Loading customers…' : 'No customers found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* ── Pagination Bar ── */}
      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadCustomers(1)} title="First">«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadCustomers(page - 1)} title="Prev">‹</button>
            {pageNumbers.map((item, idx) =>
              item === '...'
                ? <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                : <button key={item} className={`page-btn${item === page ? ' active' : ''}`} disabled={loading} onClick={() => !loading && loadCustomers(item)}>{item}</button>
            )}
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadCustomers(page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadCustomers(totalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <DeleteModal
          customerInfo={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
