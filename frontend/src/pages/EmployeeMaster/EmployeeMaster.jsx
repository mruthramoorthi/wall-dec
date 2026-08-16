import { useState, useEffect } from 'react';
import { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } from '../../api/employee.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { STATES, CITIES_BY_STATE, AREAS_BY_CITY, lookupPincode } from '../../data/locationData.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const EMPLOYEE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'employee_code', label: 'Employee Code', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'mobile', label: 'Mobile', defaultVisible: true },
  { key: 'role', label: 'Role', defaultVisible: true },
  { key: 'area_city', label: 'Area / City', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'registered', label: 'Registered', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

function IconEdit() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconTrash() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function EmployeeMaster() {
  const [editingUid, setEditingUid] = useState(null);
  const [name, setName]             = useState('');
  const [mobile, setMobile]         = useState('');
  const [email, setEmail]           = useState('');
  const [role, setRole]             = useState('');
  const [address, setAddress]       = useState('');
  const [pincode, setPincode]       = useState('');
  const [state, setState]           = useState('Tamil Nadu');
  const [city, setCity]             = useState('');
  const [area, setArea]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);

  const [rows, setRows]         = useState([]);
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal]       = useState(0);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'employee_master_columns',
    EMPLOYEE_COLS
  );

  const availableCities = CITIES_BY_STATE[state] || ['Chennai', 'Coimbatore', 'Madurai', 'Bengaluru', 'Mumbai', 'Hyderabad'];
  const availableAreas  = AREAS_BY_CITY[city]    || ['Main Market', 'Industrial Area', 'Town Centre'];

  const loadEmployees = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const ps = opts.pageSize ?? pageSize;
      const s  = opts.search !== undefined ? opts.search : search;
      const res = await listEmployees(p, ps, { search: s });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
    } catch (err) {
      setError(`Failed to load: ${err.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadEmployees(1); }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => loadEmployees(1, { search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const handlePincodeChange = (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    if (clean.length === 6) {
      const match = lookupPincode(clean);
      if (match) {
        if (match.state) setState(match.state);
        if (match.city)  setCity(match.city);
        if (match.area)  setArea(match.area);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Employee name is required.');
    if (!/^\d{10}$/.test(mobile)) return setError('Mobile must be exactly 10 digits.');
    setSaving(true);
    try {
      const payload = { employee_name: name.trim(), mobile_number: mobile.trim(), email: email.trim() || null, role_designation: role.trim() || null, address: address.trim() || null, pincode: pincode.trim() || null, state: state.trim() || null, city: city.trim() || null, area: area.trim() || null };
      if (editingUid) {
        await updateEmployee(editingUid, payload);
        setSuccess(`Employee "${name.trim()}" updated!`);
      } else {
        const res = await createEmployee(payload);
        setSuccess(`Employee "${res.data.employee_name}" registered as ${res.data.employee_code}!`);
      }
      resetForm();
      await loadEmployees(editingUid ? page : 1);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setEditingUid(null); setName(''); setMobile(''); setEmail(''); setRole(''); setAddress(''); setPincode(''); setState('Tamil Nadu'); setCity(''); setArea(''); setError(null);
  };

  const startEdit = async (uid) => {
    setError(null);
    try {
      const res = await getEmployee(uid);
      const e = res.data;
      setEditingUid(e.uid); setName(e.employee_name || ''); setMobile(e.mobile_number || ''); setEmail(e.email || ''); setRole(e.role_designation || ''); setAddress(e.address || ''); setPincode(e.pincode || ''); setState(e.state || 'Tamil Nadu'); setCity(e.city || ''); setArea(e.area || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setError(`Failed to load employee: ${err.message}`); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget.uid);
      if (editingUid === deleteTarget.uid) resetForm();
      setSuccess(`Employee "${deleteTarget.employee_name}" deleted!`);
      setDeleteTarget(null);
      await loadEmployees(page);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) { setError(`Failed to delete: ${err.message}`); setDeleteTarget(null); }
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2).reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('...'); acc.push(p); return acc; }, []);

  return (
    <div className="page">
      <h1>Employee Master</h1>

      {editingUid && (
        <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
          <span>✏️ Editing Employee: <strong>{name}</strong></span>
          <button type="button" onClick={resetForm} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Cancel</button>
        </div>
      )}

      <div className="card">
        <h3>{editingUid ? 'Edit Employee' : 'Register New Employee'}</h3>
        <form onSubmit={handleSubmit}>
          {/* Row 1 */}
          <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
            <label>
              Employee Name <span style={{ color: '#ef4444' }}>*</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </label>
            <label>
              Mobile Number <span style={{ color: '#ef4444' }}>*</span>
              <input type="text" value={mobile} maxLength={10} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile" />
            </label>
            <label>
              Role / Designation
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Sales Staff, Manager" />
            </label>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
            <label>
              Email Address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@example.com" style={{ width: '100%', marginTop: '0.3rem', boxSizing: 'border-box' }} />
            </label>
            <label>
              Pincode
              <input type="text" value={pincode} maxLength={6} onChange={(e) => handlePincodeChange(e.target.value)} placeholder="Auto-fills location" style={{ marginTop: '0.3rem', width: '100%', boxSizing: 'border-box', fontWeight: 600 }} />
            </label>
          </div>

          {/* Row 3 */}
          <label style={{ display: 'block', marginBottom: '0.85rem' }}>
            Address
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Door No, Street name, Landmark" style={{ width: '100%', marginTop: '0.3rem', boxSizing: 'border-box' }} />
          </label>

          {/* Row 4: State, City, Area */}
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '0.85rem' }}>
            <label>State<div style={{ marginTop: '0.3rem' }}><SearchableSelect options={STATES} value={state} onChange={(v) => { setState(v); setCity(''); setArea(''); }} placeholder="Search state…" /></div></label>
            <label>City<div style={{ marginTop: '0.3rem' }}><SearchableSelect options={availableCities} value={city} onChange={(v) => { setCity(v); setArea(''); }} placeholder="Search city…" /></div></label>
            <label>Area<div style={{ marginTop: '0.3rem' }}><SearchableSelect options={availableAreas} value={area} onChange={setArea} placeholder="Search area…" /></div></label>
          </div>

          {error && <div className="field-error">{error}</div>}
          {success && <div className="success">✓ {success}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="submit" disabled={saving} style={{ background: editingUid ? '#0284c7' : '#16a34a', color: '#fff', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.92rem', borderRadius: 6 }}>
              {saving ? 'Saving…' : editingUid ? 'Update Employee' : '+ Register Employee'}
            </button>
            {editingUid && <button type="button" onClick={resetForm} style={{ background: '#94a3b8', color: '#fff', padding: '0.6rem 1rem', borderRadius: 6 }}>Cancel</button>}
          </div>
        </form>
      </div>

      <h2 style={{ marginTop: '1.75rem', marginBottom: '0.75rem' }}>Employee Records</h2>

      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <input type="text" placeholder="Search name, mobile, role, code…" value={search} disabled={loading} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260, padding: '0.45rem 0.75rem', fontSize: '0.88rem' }} />
        <span style={{ marginLeft: '0.5rem', color: '#64748b', fontSize: '0.88rem' }}>{total === 0 ? 'No employees.' : `${total} employee${total !== 1 ? 's' : ''}`}</span>
        <label className="records-per-page">Show&nbsp;<select value={pageSize} disabled={loading} onChange={(e) => { const ps = Number(e.target.value); setPageSize(ps); loadEmployees(1, { pageSize: ps }); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>&nbsp;records</label>
        <ColumnVisibility
          columns={EMPLOYEE_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <TableContainer loading={loading} text="Loading employees…" subtext="Fetching employee directory">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 50 }}>S.No</th>}
              {isVisible('employee_code') && <th>Employee Code</th>}
              {isVisible('name') && <th>Name</th>}
              {isVisible('mobile') && <th>Mobile</th>}
              {isVisible('role') && <th>Role</th>}
              {isVisible('area_city') && <th>Area / City</th>}
              {isVisible('state') && <th>State</th>}
              {isVisible('registered') && <th>Registered</th>}
              {isVisible('actions') && <th className="actions-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((e, idx) => (
              <tr key={e.uid} style={editingUid === e.uid ? { background: '#f0f9ff' } : {}}>
                {isVisible('sno') && <td>{(page - 1) * pageSize + idx + 1}</td>}
                {isVisible('employee_code') && <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '0.15rem 0.45rem', borderRadius: 4 }}>{e.employee_code}</span></td>}
                {isVisible('name') && <td style={{ fontWeight: 600 }}>{e.employee_name}</td>}
                {isVisible('mobile') && <td style={{ fontWeight: 600, color: '#0369a1' }}>{e.mobile_number}</td>}
                {isVisible('role') && <td style={{ color: e.role_designation ? '#334155' : '#94a3b8', fontStyle: e.role_designation ? 'normal' : 'italic' }}>{e.role_designation || '—'}</td>}
                {isVisible('area_city') && <td>{e.area || e.city ? <span><strong>{e.area || ''}</strong>{e.area && e.city ? ', ' : ''}<span style={{ color: '#475569' }}>{e.city || ''}</span></span> : '—'}</td>}
                {isVisible('state') && <td style={{ color: '#475569' }}>{e.state || '—'}</td>}
                {isVisible('registered') && <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{formatDateTime(e.entry_datetime)}</td>}
                {isVisible('actions') && (
                  <td className="action-cell">
                    <button className="icon-btn edit-btn" title="Edit" disabled={loading} onClick={() => startEdit(e.uid)}><IconEdit /></button>
                    <button className="icon-btn delete-btn" title="Delete" disabled={loading} onClick={() => setDeleteTarget(e)}><IconTrash /></button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>{loading ? 'Loading employees…' : 'No employees found.'}</td></tr>}
          </tbody>
        </table>
      </TableContainer>

      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadEmployees(1)}>«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadEmployees(page - 1)}>‹</button>
            {pageNumbers.map((item, idx) => item === '...' ? <span key={`e${idx}`} className="page-ellipsis">…</span> : <button key={item} className={`page-btn${item === page ? ' active' : ''}`} disabled={loading} onClick={() => !loading && loadEmployees(item)}>{item}</button>)}
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadEmployees(page + 1)}>›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadEmployees(totalPages)}>»</button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#b91c1c' }}>Confirm Deletion</h3>
            <p style={{ margin: '0 0 1.25rem 0', color: '#475569' }}>Delete employee <strong>{deleteTarget.employee_name}</strong> ({deleteTarget.employee_code})?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={{ background: '#94a3b8', color: '#fff', padding: '0.5rem 1rem', borderRadius: 6 }}>Cancel</button>
              <button type="button" onClick={confirmDelete} style={{ background: '#ef4444', color: '#fff', padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 700 }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
