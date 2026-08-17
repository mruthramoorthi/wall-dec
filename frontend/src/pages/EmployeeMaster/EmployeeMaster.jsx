import { useState, useEffect } from 'react';
import { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } from '../../api/employee.js';
import { listRoles } from '../../api/role.js';
import { sendOtp, verifyOtp } from '../../api/auth.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { STATES, CITIES_BY_STATE, AREAS_BY_CITY, lookupPincode } from '../../data/locationData.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const EMPLOYEE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'employee_code', label: 'Employee Code', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'username', label: 'Login Username', defaultVisible: true },
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
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole]             = useState('');
  const [rolesList, setRolesList]   = useState([]);
  const [address, setAddress]       = useState('');
  const [pincode, setPincode]       = useState('');
  const [state, setState]           = useState('Tamil Nadu');
  const [city, setCity]             = useState('');
  const [area, setArea]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);

  // Email verification state
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail]     = useState('');
  const [otpModalOpen, setOtpModalOpen]       = useState(false);
  const [otpCode, setOtpCode]                 = useState('');
  const [otpSending, setOtpSending]           = useState(false);
  const [otpVerifying, setOtpVerifying]       = useState(false);
  const [otpModalError, setOtpModalError]     = useState(null);

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

  const loadRoles = async () => {
    try {
      const res = await listRoles({ active_only: true });
      setRolesList(res.data || []);
    } catch (e) {
      console.warn('Failed to load roles list:', e.message);
    }
  };

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

  useEffect(() => {
    loadEmployees(1);
    loadRoles();
  }, []); // eslint-disable-line

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

  const handleSendEmployeeOtp = async () => {
    setError(null);
    setOtpModalError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address before sending OTP.');
      return;
    }

    setOtpSending(true);
    try {
      await sendOtp(cleanEmail);
      setOtpCode('');
      setOtpModalOpen(true);
    } catch (err) {
      setError(err.message || 'Could not send verification OTP to this email.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyEmployeeOtp = async (e) => {
    e.preventDefault();
    setOtpModalError(null);
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpModalError('Please enter the 6-digit OTP code.');
      return;
    }

    setOtpVerifying(true);
    try {
      await verifyOtp(email.trim().toLowerCase(), otpCode.trim());
      setIsEmailVerified(true);
      setVerifiedEmail(email.trim().toLowerCase());
      setOtpModalOpen(false);
      setSuccess(`✓ Email ${email.trim().toLowerCase()} verified successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setOtpModalError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Employee name is required.');
    if (!mobile.trim() || !/^\d{10}$/.test(mobile.trim())) return setError('Mobile must be exactly 10 digits.');
    if (!role || !role.trim()) return setError('Role / Designation is mandatory. Please select a role from the dropdown.');
    if (!username.trim()) return setError('Login Username is required.');
    if (!editingUid && !password.trim()) return setError('Login Password is required for registering an employee.');
    if (password.trim() && password.trim().length < 4) return setError('Password must be at least 4 characters.');

    if (!email.trim()) {
      return setError('Email address is required for employee software login account and password recovery.');
    }

    const cleanEmail = email.trim().toLowerCase();
    // If new registration or email changed, require verification
    if (!editingUid && (!isEmailVerified || verifiedEmail !== cleanEmail)) {
      return setError('Please verify the employee email address with OTP before registering.');
    }
    if (editingUid && verifiedEmail && verifiedEmail !== cleanEmail && !isEmailVerified) {
      return setError('Email address was changed. Please verify the new email address with OTP.');
    }

    setSaving(true);
    try {
      const payload = {
        employee_name: name.trim(),
        mobile_number: mobile.trim(),
        email: cleanEmail,
        username: username.trim().toLowerCase(),
        password: password.trim() || undefined,
        role_designation: role.trim(),
        address: address.trim() || null,
        pincode: pincode.trim() || null,
        state: state.trim() || null,
        city: city.trim() || null,
        area: area.trim() || null
      };

      if (editingUid) {
        await updateEmployee(editingUid, payload);
        setSuccess(`Employee "${name.trim()}" updated successfully!`);
      } else {
        const res = await createEmployee(payload);
        setSuccess(`Employee "${res.data.employee_name}" registered as ${res.data.employee_code}! They can now log in with username "@${username.trim().toLowerCase()}".`);
      }
      resetForm();
      await loadEmployees(editingUid ? page : 1);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setEditingUid(null);
    setName('');
    setMobile('');
    setEmail('');
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setRole('');
    setAddress('');
    setPincode('');
    setState('Tamil Nadu');
    setCity('');
    setArea('');
    setIsEmailVerified(false);
    setVerifiedEmail('');
    setError(null);
  };

  const startEdit = async (uid) => {
    setError(null);
    try {
      const res = await getEmployee(uid);
      const e = res.data;
      setEditingUid(e.uid);
      setName(e.employee_name || '');
      setMobile(e.mobile_number || '');
      setEmail(e.email || '');
      setUsername(e.username || '');
      setPassword('');
      setShowPassword(false);
      setRole(e.role_designation || '');
      setAddress(e.address || '');
      setPincode(e.pincode || '');
      setState(e.state || 'Tamil Nadu');
      setCity(e.city || '');
      setArea(e.area || '');
      if (e.email) {
        setIsEmailVerified(true);
        setVerifiedEmail(e.email.trim().toLowerCase());
      } else {
        setIsEmailVerified(false);
        setVerifiedEmail('');
      }
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
        <h3>{editingUid ? 'Edit Employee Credentials & Profile' : 'Register New Employee & Login Account'}</h3>
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Prevent browser login autofill on new employee form */}
          <input type="text" name="prevent_autofill_emp_user" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
          <input type="password" name="prevent_autofill_emp_pass" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

          {/* Row 1: Basic Info */}
          <div className="form-grid" style={{ gridTemplateColumns: '1.2fr 1fr 1.2fr', marginBottom: '0.85rem' }}>
            <label>
              Employee Name <span style={{ color: '#ef4444' }}>*</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </label>
            <label>
              Mobile Number <span style={{ color: '#ef4444' }}>*</span>
              <input type="text" value={mobile} maxLength={10} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile" />
            </label>
            <label>
              Role / Designation <span style={{ color: '#ef4444' }}>*</span>
              <div style={{ marginTop: '0.3rem' }}>
                <SearchableSelect
                  options={rolesList.map((r) => r.role_name)}
                  value={role}
                  onChange={setRole}
                  placeholder="Select employee role…"
                />
              </div>
            </label>
          </div>

          {/* Row 2: Software Login Credentials */}
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: 8,
            padding: '0.85rem 1rem',
            marginBottom: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🔐</span>
              <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Software Login Account</strong>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                (Employee will use these credentials to log in and access permitted screens)
              </span>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
              <label>
                Login Username <span style={{ color: '#ef4444' }}>*</span>
                <input
                  type="text"
                  name="emp_new_username"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                  placeholder="e.g. john_billing"
                  style={{ width: '100%', marginTop: '0.3rem', boxSizing: 'border-box' }}
                />
              </label>
              <label>
                {editingUid ? 'Change Password (Optional)' : 'Login Password *'}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="emp_new_password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUid ? 'Leave blank to keep existing password' : 'Enter login password'}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      padding: '0 0.6rem',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                    title="Toggle Password Visibility"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>
            </div>
          </div>

          {/* Row 3: Email (with OTP verification) & Pincode */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
            <label>
              Email Address <span style={{ color: '#ef4444' }}>*</span> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Used for password reset OTP)</span>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (isEmailVerified && e.target.value.trim().toLowerCase() !== verifiedEmail) {
                      setIsEmailVerified(false);
                    }
                  }}
                  placeholder="employee@example.com"
                  style={{ flex: 1, boxSizing: 'border-box' }}
                />
                {isEmailVerified && email.trim().toLowerCase() === verifiedEmail ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #bbf7d0',
                    padding: '0 0.65rem',
                    borderRadius: 6,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    ✓ Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={otpSending || !email.trim()}
                    onClick={handleSendEmployeeOtp}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '0 0.75rem',
                      borderRadius: 6,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: (otpSending || !email.trim()) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {otpSending ? 'Sending…' : 'Verify Email (OTP)'}
                  </button>
                )}
              </div>
            </label>
            <label>
              Pincode
              <input type="text" value={pincode} maxLength={6} onChange={(e) => handlePincodeChange(e.target.value)} placeholder="Auto-fills location" style={{ marginTop: '0.3rem', width: '100%', boxSizing: 'border-box', fontWeight: 600 }} />
            </label>
          </div>

          {/* Row 4: Address */}
          <label style={{ display: 'block', marginBottom: '0.85rem' }}>
            Address
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Door No, Street name, Landmark" style={{ width: '100%', marginTop: '0.3rem', boxSizing: 'border-box' }} />
          </label>

          {/* Row 5: State, City, Area */}
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '0.85rem' }}>
            <label>State<div style={{ marginTop: '0.3rem' }}><SearchableSelect options={STATES} value={state} onChange={(v) => { setState(v); setCity(''); setArea(''); }} placeholder="Search state…" /></div></label>
            <label>City<div style={{ marginTop: '0.3rem' }}><SearchableSelect options={availableCities} value={city} onChange={(v) => { setCity(v); setArea(''); }} placeholder="Search city…" /></div></label>
            <label>Area<div style={{ marginTop: '0.3rem' }}><SearchableSelect options={availableAreas} value={area} onChange={setArea} placeholder="Search area…" /></div></label>
          </div>

          {error && <div className="field-error">{error}</div>}
          {success && <div className="success">✓ {success}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="submit" disabled={saving} style={{ background: editingUid ? '#0284c7' : '#16a34a', color: '#fff', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.92rem', borderRadius: 6, cursor: 'pointer' }}>
              {saving ? 'Saving…' : editingUid ? '💾 Update Employee & Credentials' : '➕ Register Employee & Create Login'}
            </button>
            {editingUid && <button type="button" onClick={resetForm} style={{ background: '#94a3b8', color: '#fff', padding: '0.6rem 1rem', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>}
          </div>
        </form>
      </div>

      {/* ── Employee Email OTP Verification Modal ── */}
      {otpModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '400px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>✉️ Verify Employee Email</h3>
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 1rem 0', color: '#475569', fontSize: '0.88rem', lineHeight: 1.5 }}>
              A 6-digit verification code has been sent to <strong>{email.trim()}</strong>.
            </p>

            {otpModalError && (
              <div className="field-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                {otpModalError}
              </div>
            )}

            <form onSubmit={handleVerifyEmployeeOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.6rem',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    letterSpacing: '4px',
                    textAlign: 'center'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  style={{
                    padding: '0.55rem 0.9rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.88rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpVerifying}
                  style={{
                    padding: '0.55rem 1.1rem',
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: otpVerifying ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '0.88rem'
                  }}
                >
                  {otpVerifying ? 'Verifying…' : 'Confirm Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: '1.75rem', marginBottom: '0.75rem' }}>Employee Records</h2>

      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <input type="text" placeholder="Search name, mobile, username, role, code…" value={search} disabled={loading} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260, padding: '0.45rem 0.75rem', fontSize: '0.88rem' }} />
        <ColumnVisibility columns={EMPLOYEE_COLS} visibleColumns={visibleColumns} onToggle={toggleColumn} onReset={resetColumns} />
      </div>

      <TableContainer loading={loading} text="Loading employees…" subtext="Fetching employee master records">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th>S.No</th>}
              {isVisible('employee_code') && <th>Code</th>}
              {isVisible('name') && <th>Employee Name</th>}
              {isVisible('username') && <th>Login Username</th>}
              {isVisible('mobile') && <th>Mobile</th>}
              {isVisible('role') && <th>Role / Designation</th>}
              {isVisible('area_city') && <th>Area / City</th>}
              {isVisible('state') && <th>State</th>}
              {isVisible('registered') && <th>Registered</th>}
              {isVisible('actions') && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.uid}>
                {isVisible('sno') && <td>{(page - 1) * pageSize + idx + 1}</td>}
                {isVisible('employee_code') && <td style={{ fontWeight: 700, color: '#2563eb' }}>{r.employee_code}</td>}
                {isVisible('name') && <td style={{ fontWeight: 600 }}>{r.employee_name}</td>}
                {isVisible('username') && (
                  <td>
                    {r.username ? (
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7', background: '#f0f9ff', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.82rem' }}>
                        @{r.username}
                      </span>
                    ) : '—'}
                  </td>
                )}
                {isVisible('mobile') && <td>{r.mobile_number}</td>}
                {isVisible('role') && (
                  <td>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.82rem', fontWeight: 600 }}>
                      {r.role_designation || '—'}
                    </span>
                  </td>
                )}
                {isVisible('area_city') && <td>{[r.area, r.city].filter(Boolean).join(', ') || '—'}</td>}
                {isVisible('state') && <td>{r.state || '—'}</td>}
                {isVisible('registered') && <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{formatDateTime(r.entry_datetime)}</td>}
                {isVisible('actions') && (
                  <td>
                    <button type="button" className="icon-btn edit-btn" title="Edit" disabled={loading} onClick={() => startEdit(r.uid)}><IconEdit /></button>
                    <button type="button" className="icon-btn delete-btn" title="Delete" disabled={loading} onClick={() => setDeleteTarget(r)}><IconTrash /></button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={visibleColumns.length} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>{loading ? 'Loading…' : 'No employees registered yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadEmployees(1)} title="First">«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadEmployees(page - 1)} title="Prev">‹</button>
            {pageNumbers.map((p, i) =>
              p === '...' ? (
                <span key={`e-${i}`} className="page-ellipsis">…</span>
              ) : (
                <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} disabled={loading} onClick={() => !loading && loadEmployees(p)}>{p}</button>
              )
            )}
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadEmployees(page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadEmployees(totalPages)} title="Last">»</button>
          </div>
          <div className="pagination-size">
            <span>Per page:</span>
            <select value={pageSize} disabled={loading} onChange={(e) => { const s = Number(e.target.value); setPageSize(s); loadEmployees(1, { pageSize: s }); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <h3>Confirm Delete</h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0.75rem 0' }}>
              Are you sure you want to delete <strong>{deleteTarget.employee_name}</strong> ({deleteTarget.employee_code})?
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
