import { useState, useEffect } from 'react';
import { getProfile, updateProfile, changePassword, checkUsername } from '../../api/auth.js';
import ImageCropperModal from '../../components/ImageCropperModal.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const formatDateForInput = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (typeof val === 'string' && val.includes('T')) return val.split('T')[0];
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
};

export default function Profile({ onUserUpdated }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('auth_user') || 'null');
    } catch {
      return null;
    }
  });

  // Profile Fields
  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [mobile, setMobile]             = useState('');
  const [email, setEmail]               = useState('');
  const [dob, setDob]                   = useState('');
  const [gender, setGender]             = useState('Male');
  const [username, setUsername]         = useState('');
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [picPreview, setPicPreview]     = useState(null);

  // Username validation
  const [usernameStatus, setUsernameStatus] = useState(null);

  // Image Cropper modal
  const [cropperFile, setCropperFile]   = useState(null);

  // Password fields
  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [confPassword, setConfPassword] = useState('');
  const [passSaving, setPassSaving]     = useState(false);
  const [passError, setPassError]       = useState(null);
  const [passSuccess, setPassSuccess]   = useState(null);

  // Profile update state
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);
  const [success, setSuccess]           = useState(null);

  useEffect(() => {
    if (user?.uid) {
      loadProfile(user.uid);
    }
  }, []); // eslint-disable-line

  const loadProfile = async (uid) => {
    try {
      const res = await getProfile(uid);
      const data = res.data;
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setMobile(data.mobile_number || '');
      setEmail(data.email || '');
      setDob(formatDateForInput(data.dob));
      setGender(data.gender || 'Male');
      setUsername(data.username || '');
      if (data.profile_picture) {
        setPicPreview(`${API_BASE}/images/${data.profile_picture}`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Debounced username checking excluding current user
  useEffect(() => {
    if (!username.trim() || username.length < 2 || username === user?.username) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsername(username.trim(), user?.uid);
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username, user]);

  const handlePicSelected = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropperFile(file);
    }
  };

  const handleCropComplete = (croppedFile, previewUrl) => {
    setProfilePicFile(croppedFile);
    setPicPreview(previewUrl);
    setCropperFile(null);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (!lastName.trim()) { setError('Last name is required.'); return; }
    if (!mobile || !/^\d{10}$/.test(mobile)) { setError('Mobile number must be exactly 10 digits.'); return; }
    if (!username.trim()) { setError('Username is required.'); return; }
    if (usernameStatus === 'taken') { setError('Username is already taken by another user.'); return; }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('first_name', firstName.trim());
      formData.append('last_name', lastName.trim());
      formData.append('mobile_number', mobile.trim());
      formData.append('dob', dob);
      formData.append('gender', gender);
      formData.append('username', username.trim().toLowerCase());
      if (profilePicFile) {
        formData.append('profile_picture', profilePicFile);
      }

      const res = await updateProfile(user.uid, formData);
      const updatedUser = res.data;

      // Update local storage
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      if (onUserUpdated) onUserUpdated(updatedUser);

      setSuccess('✓ Profile details updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!currPassword) { setPassError('Current password is required.'); return; }
    if (!newPassword || newPassword.length < 4) { setPassError('New password must be at least 4 characters long.'); return; }
    if (newPassword !== confPassword) { setPassError('New passwords do not match.'); return; }

    setPassSaving(true);
    try {
      await changePassword(user.uid, {
        current_password: currPassword,
        new_password: newPassword
      });
      setPassSuccess('✓ Password changed successfully!');
      setCurrPassword('');
      setNewPassword('');
      setConfPassword('');
    } catch (err) {
      setPassError(err.message || 'Failed to change password.');
    } finally {
      setPassSaving(false);
    }
  };

  const avatarLetter = firstName ? firstName.charAt(0).toUpperCase() : (user?.first_name?.charAt(0).toUpperCase() || 'U');

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>👤 User Profile &amp; Settings</h1>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Manage your account credentials, avatar, and security settings
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left Column: Personal Information & Avatar ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            Account Information
          </h3>

          {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          {success && <div className="success" style={{ marginBottom: '1rem' }}>{success}</div>}

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Profile Avatar + Crop / Rotate Editor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 800,
                flexShrink: 0,
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                border: '2px solid #fff'
              }}>
                {picPreview ? (
                  <img src={picPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  avatarLetter
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                  Profile Picture
                </label>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.45rem' }}>
                  Upload a photo to crop and rotate using built-in edit tools.
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePicSelected}
                  style={{ fontSize: '0.82rem', padding: '0.25rem 0' }}
                />
              </div>
            </div>

            {/* First Name & Last Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  First Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Last Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Mobile & DOB */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Date of Birth <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Gender <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
                {['Male', 'Female', 'Other'].map((g) => (
                  <label key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="radio"
                      name="profile_gender"
                      value={g}
                      checked={gender === g}
                      onChange={(e) => setGender(e.target.value)}
                      style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                    />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Email (Read-only verified) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Verified Email Address
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="email"
                  value={email}
                  disabled
                  style={{ flex: 1, boxSizing: 'border-box', background: '#f1f5f9', color: '#64748b' }}
                />
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  padding: '0 0.85rem',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.82rem'
                }}>
                  ✓ Verified
                </span>
              </div>
            </div>

            {/* Username with uniqueness validator */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                  Username <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {usernameStatus === 'checking' && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Checking…</span>}
                {usernameStatus === 'available' && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓ Username available</span>}
                {usernameStatus === 'taken' && <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>✗ Username not available</span>}
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderColor: usernameStatus === 'taken' ? '#ef4444' : usernameStatus === 'available' ? '#16a34a' : '#cbd5e1'
                }}
              />
              {usernameStatus === 'taken' && (
                <div style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: '0.2rem', fontWeight: 600 }}>
                  This username is already taken by another user.
                </div>
              )}
            </div>

            {/* Save Profile Button */}
            <button
              type="submit"
              disabled={saving || usernameStatus === 'taken'}
              style={{
                padding: '0.65rem',
                background: usernameStatus !== 'taken' ? '#2563eb' : '#94a3b8',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                borderRadius: 8,
                border: 'none',
                cursor: usernameStatus !== 'taken' ? 'pointer' : 'not-allowed',
                marginTop: '0.5rem'
              }}
            >
              {saving ? 'Saving Details…' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* ── Right Column: Security & Change Password ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            🔒 Change Password
          </h3>

          {passError && <div className="field-error" style={{ marginBottom: '1rem' }}>{passError}</div>}
          {passSuccess && <div className="success" style={{ marginBottom: '1rem' }}>{passSuccess}</div>}

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Current Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <PasswordInput
                placeholder="Enter current password"
                value={currPassword}
                onChange={(e) => setCurrPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <PasswordInput
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Confirm New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <PasswordInput
                placeholder="Confirm new password"
                value={confPassword}
                onChange={(e) => setConfPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={passSaving}
              style={{
                padding: '0.65rem',
                background: '#16a34a',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.92rem',
                borderRadius: 8,
                border: 'none',
                cursor: passSaving ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem'
              }}
            >
              {passSaving ? 'Updating Password…' : 'Update Password'}
            </button>
          </form>
        </div>

      </div>

      {/* ── Image Cropper / Rotator Modal ── */}
      {cropperFile && (
        <ImageCropperModal
          imageFile={cropperFile}
          onCropComplete={handleCropComplete}
          onClose={() => setCropperFile(null)}
        />
      )}
    </div>
  );
}
