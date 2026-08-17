import { useState, useEffect } from 'react';
import { getCompany, saveCompany } from '../../api/company.js';
import { testSmtpConnection } from '../../api/screen.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { STATES, CITIES_BY_STATE, AREAS_BY_CITY, lookupPincode } from '../../data/locationData.js';

export default function CompanyRegistration() {
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);
  const [hasCompany, setHasCompany] = useState(false);

  // Mandatory fields
  const [companyName, setCompanyName] = useState('');
  const [mobile, setMobile]           = useState('');
  const [address, setAddress]         = useState('');
  const [pincode, setPincode]         = useState('');
  const [state, setState]             = useState('Tamil Nadu');
  const [city, setCity]               = useState('');
  const [area, setArea]               = useState('');

  // Optional fields
  const [email, setEmail]     = useState('');
  const [website, setWebsite] = useState('');

  // GST fields
  const [isGst, setIsGst]         = useState(false);
  const [gstin, setGstin]         = useState('');
  const [cgst, setCgst]           = useState('');
  const [sgst, setSgst]           = useState('');
  const [igst, setIgst]           = useState('');

  // SMTP Mail fields
  const [smtpHost, setSmtpHost]         = useState('');
  const [smtpPort, setSmtpPort]         = useState('587');
  const [smtpUser, setSmtpUser]         = useState('');
  const [smtpPass, setSmtpPass]         = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testingSmtp, setTestingSmtp]   = useState(false);
  const [smtpTestMsg, setSmtpTestMsg]   = useState(null);

  const availableCities = CITIES_BY_STATE[state] || ['Chennai', 'Coimbatore', 'Madurai', 'Bengaluru', 'Mumbai', 'Hyderabad'];
  const availableAreas  = AREAS_BY_CITY[city]    || ['Main Market', 'Industrial Area', 'Town Centre', 'Ring Road'];

  useEffect(() => {
    (async () => {
      try {
        const res = await getCompany();
        const c = res.data;
        if (c) {
          setHasCompany(true);
          setCompanyName(c.company_name || '');
          setMobile(c.mobile_number || '');
          setAddress(c.address || '');
          setPincode(c.pincode || '');
          setState(c.state || 'Tamil Nadu');
          setCity(c.city || '');
          setArea(c.area || '');
          setEmail(c.email || '');
          setWebsite(c.website || '');
          setIsGst(Boolean(c.is_gst_registered));
          setGstin(c.gstin || '');
          setCgst(c.cgst_percent != null ? String(c.cgst_percent) : '');
          setSgst(c.sgst_percent != null ? String(c.sgst_percent) : '');
          setIgst(c.igst_percent != null ? String(c.igst_percent) : '');
          setSmtpHost(c.smtp_host || '');
          setSmtpPort(c.smtp_port ? String(c.smtp_port) : '587');
          setSmtpUser(c.smtp_user || '');
          setSmtpPass(c.smtp_pass || '');
          setSmtpFromName(c.smtp_from_name || '');
        }
      } catch { /* no company yet */ }
      finally { setLoading(false); }
    })();
  }, []);

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

  const clampTax = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return String(Math.min(100, Math.max(0, n)));
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestMsg(null);
    try {
      const res = await testSmtpConnection({
        smtp_host: smtpHost.trim() || undefined,
        smtp_port: smtpPort ? Number(smtpPort) : 587,
        smtp_user: smtpUser.trim() || undefined,
        smtp_pass: smtpPass.trim() || undefined,
        smtp_from_name: smtpFromName.trim() || companyName.trim() || undefined
      });
      setSmtpTestMsg({ type: 'success', text: res.message || 'SMTP Connection Verified Successfully!' });
    } catch (err) {
      setSmtpTestMsg({ type: 'error', text: err.message || 'SMTP Connection Failed. Please check credentials.' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate mandatory
    if (!companyName.trim()) return setError('Company name is required.');
    if (!/^\d{10}$/.test(mobile)) return setError('Mobile must be 10 digits.');
    if (!address.trim()) return setError('Address is required.');
    if (!pincode.trim()) return setError('Pincode is required.');
    if (!state) return setError('State is required.');
    if (!city) return setError('City is required.');
    if (!area) return setError('Area is required.');

    if (isGst) {
      if (!gstin.trim()) return setError('GSTIN is required for GST-registered company.');
      if (cgst === '' || sgst === '' || igst === '') return setError('CGST, SGST, and IGST percentages are required when GST registered.');
      if (Number(cgst) > 100 || Number(sgst) > 100 || Number(igst) > 100) return setError('Tax percentage cannot exceed 100%.');
    }

    setSaving(true);
    try {
      await saveCompany({
        company_name: companyName.trim(),
        mobile_number: mobile.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        state, city, area,
        email: email.trim() || null,
        website: website.trim() || null,
        is_gst_registered: isGst ? 1 : 0,
        gstin: isGst ? gstin.trim().toUpperCase() : null,
        cgst_percent: isGst ? Number(cgst) : 0,
        sgst_percent: isGst ? Number(sgst) : 0,
        igst_percent: isGst ? Number(igst) : 0,
        smtp_host: smtpHost.trim() || null,
        smtp_port: smtpPort ? Number(smtpPort) : 587,
        smtp_user: smtpUser.trim() || null,
        smtp_pass: smtpPass.trim() || null,
        smtp_from_name: smtpFromName.trim() || null,
      });
      setHasCompany(true);
      setSuccess('Company details & SMTP configuration saved successfully!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><p style={{ color: '#64748b' }}>Loading…</p></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>Company Registration</h1>
        {hasCompany && (
          <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.2rem 0.6rem', borderRadius: 5, fontWeight: 700 }}>
            ✓ Company registered
          </span>
        )}
        {!hasCompany && (
          <span style={{ fontSize: '0.78rem', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', padding: '0.2rem 0.6rem', borderRadius: 5, fontWeight: 700 }}>
            ⚠ Not yet registered
          </span>
        )}
      </div>

      <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.88rem', fontWeight: 500 }}>
        ℹ Only <strong>one company</strong> is allowed. Saving will update the existing company details.
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Basic Info (mandatory) ── */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>🏢 Company Details <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>(Mandatory)</span></h3>

          <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
            <label>
              Company Name <span style={{ color: '#ef4444' }}>*</span>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company name" />
            </label>
            <label>
              Mobile Number <span style={{ color: '#ef4444' }}>*</span>
              <input type="text" value={mobile} maxLength={10} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile number" />
            </label>
            <label>
              Pincode <span style={{ color: '#ef4444' }}>*</span>
              <input type="text" value={pincode} maxLength={6} onChange={(e) => handlePincodeChange(e.target.value)} placeholder="6-digit pincode (auto-fills location)" style={{ fontWeight: 600 }} />
            </label>
          </div>

          <label style={{ display: 'block', marginBottom: '0.85rem' }}>
            Street Address <span style={{ color: '#ef4444' }}>*</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Door No, Street name, Landmark"
              style={{ width: '100%', marginTop: '0.3rem', boxSizing: 'border-box' }}
            />
          </label>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
            <label>
              State <span style={{ color: '#ef4444' }}>*</span>
              <div style={{ marginTop: '0.3rem' }}>
                <SearchableSelect options={STATES} value={state} onChange={(v) => { setState(v); setCity(''); setArea(''); }} placeholder="Search state…" />
              </div>
            </label>
            <label>
              City <span style={{ color: '#ef4444' }}>*</span>
              <div style={{ marginTop: '0.3rem' }}>
                <SearchableSelect options={availableCities} value={city} onChange={(v) => { setCity(v); setArea(''); }} placeholder="Search city…" />
              </div>
            </label>
            <label>
              Area <span style={{ color: '#ef4444' }}>*</span>
              <div style={{ marginTop: '0.3rem' }}>
                <SearchableSelect options={availableAreas} value={area} onChange={setArea} placeholder="Search area…" />
              </div>
            </label>
          </div>
        </div>

        {/* ── Optional Info ── */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>📋 Additional Details <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>(Optional)</span></h3>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>
              Email Address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="company@example.com" />
            </label>
            <label>
              Website
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.company.com" />
            </label>
          </div>
        </div>

        {/* ── GST / Tax ── */}
        <div className="card" style={{ marginBottom: '1rem', border: isGst ? '1.5px solid #86efac' : '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: isGst ? '1rem' : 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={isGst}
                onChange={(e) => {
                  setIsGst(e.target.checked);
                  if (!e.target.checked) { setGstin(''); setCgst(''); setSgst(''); setIgst(''); }
                }}
                style={{ width: 16, height: 16, accentColor: '#16a34a' }}
              />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: isGst ? '#15803d' : '#475569' }}>
                GST Registered Company
              </span>
            </label>
            {!isGst && (
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                (Uncheck = No tax in billing)
              </span>
            )}
            {isGst && (
              <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.15rem 0.5rem', borderRadius: 5, fontWeight: 700 }}>
                ✓ Tax will apply in billing
              </span>
            )}
          </div>

          {isGst && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.85rem' }}>
                GSTIN (15-character) <span style={{ color: '#ef4444' }}>*</span>
                <input
                  type="text"
                  value={gstin}
                  maxLength={15}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 33AAAPL1234C1Z5"
                  style={{ marginTop: '0.3rem', width: 300, textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.05em', boxSizing: 'border-box' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'CGST %', val: cgst, set: setCgst, info: 'Intra-state: Central GST' },
                  { label: 'SGST %', val: sgst, set: setSgst, info: 'Intra-state: State GST' },
                  { label: 'IGST %', val: igst, set: setIgst, info: 'Inter-state (Other State Customer)' },
                ].map(({ label, val, set, info }) => (
                  <label key={label}>
                    {label} <span style={{ color: '#ef4444' }}>*</span>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginBottom: '0.2rem' }}>{info}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={val}
                        onChange={(e) => set(clampTax(e.target.value))}
                        placeholder="0.00"
                        style={{ width: '100%', fontWeight: 700, textAlign: 'right' }}
                      />
                      <span style={{ fontWeight: 700, color: '#475569', flexShrink: 0 }}>%</span>
                    </div>
                  </label>
                ))}
              </div>

              {cgst && sgst && igst && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '0.5rem 0.85rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  Same-state customers → CGST ({cgst}%) + SGST ({sgst}%) = {(Number(cgst || 0) + Number(sgst || 0)).toFixed(2)}% &nbsp;&nbsp;|&nbsp;&nbsp;
                  Other-state customers → IGST ({igst}%)
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SMTP Mail Configuration ── */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>📧 SMTP Mail Server Settings <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>(Optional)</span></h3>
            <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.2rem 0.55rem', borderRadius: 5, fontWeight: 600 }}>
              Fallback to .env enabled
            </span>
          </div>
          <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.84rem' }}>
            Configure your custom outgoing email credentials (e.g. for registration OTPs and notifications). If left blank, the system automatically uses the server <code>.env</code> settings.
          </p>

          <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: '0.85rem' }}>
            <label>
              SMTP Host / Server
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="e.g. smtp.gmail.com or mail.yourcompany.com"
              />
            </label>
            <label>
              SMTP Port
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587 or 465"
              />
            </label>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '0.85rem' }}>
            <label>
              SMTP Email / Username
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="e.g. company@gmail.com"
              />
            </label>
            <label>
              SMTP Password / App Password
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
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
                  {showSmtpPass ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '0.85rem' }}>
            <label>
              Sender Display Name
              <input
                type="text"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
                placeholder="e.g. A3 Wall Decor Notifications"
              />
            </label>
          </div>

          {smtpTestMsg && (
            <div
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: 6,
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '0.85rem',
                background: smtpTestMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: smtpTestMsg.type === 'success' ? '#15803d' : '#b91c1c',
                border: smtpTestMsg.type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5'
              }}
            >
              {smtpTestMsg.type === 'success' ? '✓ ' : '✕ '} {smtpTestMsg.text}
            </div>
          )}

          <button
            type="button"
            onClick={handleTestSmtp}
            disabled={testingSmtp}
            style={{
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '0.45rem 1rem',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: testingSmtp ? 'not-allowed' : 'pointer'
            }}
          >
            {testingSmtp ? '⚡ Testing Connection…' : '⚡ Test SMTP Connection'}
          </button>
        </div>

        {error && <div className="field-error">{error}</div>}
        {success && <div className="success">✓ {success}</div>}

        <button
          type="submit"
          disabled={saving}
          style={{ background: '#16a34a', color: '#fff', padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.95rem', borderRadius: 6, marginTop: '0.5rem', cursor: 'pointer' }}
        >
          {saving ? 'Saving…' : hasCompany ? '💾 Update Company Details' : '✅ Register Company'}
        </button>
      </form>
    </div>
  );
}
