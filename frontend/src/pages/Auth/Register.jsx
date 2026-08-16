import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendOtp, verifyOtp, checkUsername, registerUser } from '../../api/auth.js';
import ImageCropperModal from '../../components/ImageCropperModal.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';

function checkPasswordStrength(p) {
  if (!p) return { score: 0, label: 'None', color: '#cbd5e1' };
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p)) score++;

  if (score <= 2) return { score, label: 'Fair', color: '#ef4444' };
  if (score === 3 || score === 4) return { score, label: 'Good', color: '#f59e0b' };
  return { score, label: 'Strong', color: '#16a34a' };
}

export default function Register() {
  const navigate = useNavigate();

  // Form Fields
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [mobile, setMobile]               = useState('');
  const [email, setEmail]                 = useState('');
  const [dob, setDob]                     = useState('');
  const [gender, setGender]               = useState('Male');
  const [username, setUsername]           = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [profilePic, setProfilePic]       = useState(null);
  const [picPreview, setPicPreview]       = useState(null);

  // Image Cropper Modal
  const [cropperFile, setCropperFile]     = useState(null);

  // Email verification state
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpModalOpen, setOtpModalOpen]       = useState(false);
  const [otpCode, setOtpCode]                 = useState('');
  const [otpSending, setOtpSending]           = useState(false);
  const [otpVerifying, setOtpVerifying]       = useState(false);
  const [emailError, setEmailError]           = useState(null);
  const [otpModalError, setOtpModalError]     = useState(null);
  const [otpMessage, setOtpMessage]           = useState(null);

  // Username validation
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken'

  // Submission state
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);

  // Initial avatar letter
  const avatarLetter = firstName ? firstName.trim().charAt(0).toUpperCase() : (username ? username.trim().charAt(0).toUpperCase() : '?');

  // Debounced username availability check
  useEffect(() => {
    if (!username.trim() || username.length < 2) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsername(username.trim());
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username]);

  const handlePicSelected = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropperFile(file);
    }
  };

  const handleCropComplete = (croppedFile, previewUrl) => {
    setProfilePic(croppedFile);
    setPicPreview(previewUrl);
    setCropperFile(null);
  };

  const handleSendOtp = async () => {
    setEmailError(null);
    setOtpMessage(null);
    setOtpModalError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      setOtpModalOpen(false);
      return;
    }

    setOtpSending(true);
    try {
      await sendOtp(cleanEmail);
      setOtpMessage(`✓ 6-digit OTP sent to ${cleanEmail}. Please check your inbox.`);
      setOtpModalOpen(true); // Open modal ONLY when OTP was successfully dispatched
    } catch (err) {
      setOtpModalOpen(false); // DO NOT show modal if wrong mail or delivery failed
      setEmailError(err.message || 'Email was wrong or could not deliver OTP. Please check your email.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
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
      setOtpModalOpen(false);
      setOtpMessage('✓ Email verified successfully!');
      setEmailError(null);
      setOtpModalError(null);
    } catch (err) {
      setOtpModalError(err.message || 'Invalid or expired OTP code. Please check and try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (!lastName.trim()) { setError('Last name is required.'); return; }
    if (!mobile || !/^\d{10}$/.test(mobile)) { setError('Mobile number must be exactly 10 digits.'); return; }
    if (!email.trim()) { setError('Email address is required.'); return; }
    if (!isEmailVerified) {
      setError('Please verify your email address with the OTP first.');
      return;
    }
    if (!dob) { setError('Date of Birth is required.'); return; }
    if (!gender) { setError('Gender is required.'); return; }
    if (!username.trim()) { setError('Username is required.'); return; }
    if (usernameStatus === 'taken') { setError('Username is not available / already taken. Please choose another.'); return; }

    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('first_name', firstName.trim());
      formData.append('last_name', lastName.trim());
      formData.append('mobile_number', mobile.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('dob', dob);
      formData.append('gender', gender);
      formData.append('username', username.trim().toLowerCase());
      formData.append('password', password);
      if (profilePic) {
        formData.append('profile_picture', profilePic);
      }

      await registerUser(formData);
      navigate('/login?registered=1');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = checkPasswordStrength(password);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '1.5rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '640px', background: '#fff', borderRadius: '16px', padding: '2rem 2.25rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.2rem' }}>📦</div>
          <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.6rem', color: '#0f172a' }}>Create User Account</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            Register to access Inventory ERP. Email OTP verification is required.
          </p>
        </div>

        {error && <div className="field-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Profile Picture Avatar Preview + Cropper/Rotator Upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '0.85rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
            }}>
              {picPreview ? (
                <img src={picPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                avatarLetter
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
                Profile Picture <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Optional - crop &amp; rotate tools included)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePicSelected}
                style={{ fontSize: '0.8rem', padding: '0.2rem 0' }}
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
                placeholder="e.g. John"
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
                placeholder="e.g. Doe"
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
                Mobile Number (10 digits) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                maxLength={10}
                placeholder="9876543210"
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
                <label key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="gender"
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

          {/* Email Address with Send OTP / Verified Button */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
              Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <input
                type="email"
                placeholder="user@example.com"
                value={email}
                disabled={isEmailVerified}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setIsEmailVerified(false);
                  setEmailError(null);
                  setOtpMessage(null);
                }}
                required
                style={{ flex: 1, boxSizing: 'border-box' }}
              />
              {isEmailVerified ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  padding: '0 0.85rem',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.84rem'
                }}>
                  ✓ Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending || !email}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    padding: '0.5rem 0.95rem',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {otpSending ? 'Sending…' : 'Send Email OTP'}
                </button>
              )}
            </div>
            {emailError && (
              <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>
                ✗ {emailError}
              </div>
            )}
            {otpMessage && (
              <div style={{ fontSize: '0.8rem', color: '#0369a1', marginTop: '0.3rem', fontWeight: 600 }}>
                {otpMessage}
              </div>
            )}
          </div>

          {/* Username with real-time uniqueness validation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                Username <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {usernameStatus === 'checking' && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Checking…</span>}
              {usernameStatus === 'available' && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓ Username available</span>}
              {usernameStatus === 'taken' && <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>✗ Username not available / already taken</span>}
            </div>
            <input
              type="text"
              placeholder="e.g. johndoe2026"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderColor: usernameStatus === 'taken' ? '#ef4444' : usernameStatus === 'available' ? '#16a34a' : '#cbd5e1',
                background: usernameStatus === 'taken' ? '#fff5f5' : '#fff'
              }}
            />
            {usernameStatus === 'taken' && (
              <div style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: '0.2rem', fontWeight: 600 }}>
                This username is already taken by another user. Please choose a different username.
              </div>
            )}
          </div>

          {/* Password & Confirm Password */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <PasswordInput
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Confirm Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <PasswordInput
                placeholder="••••••••"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password Strength Indicator (Informational) */}
          {password && (
            <div style={{ background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontWeight: 700 }}>
                <span style={{ color: '#475569' }}>Strength:</span>
                <span style={{ color: pwdStrength.color }}>{pwdStrength.label}</span>
              </div>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(pwdStrength.score / 5) * 100}%`, background: pwdStrength.color, transition: 'all 0.3s' }} />
              </div>
              <div style={{ marginTop: '0.4rem', color: '#64748b', fontSize: '0.74rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem' }}>
                <span style={{ color: password.length >= 8 ? '#16a34a' : '#94a3b8' }}>{password.length >= 8 ? '✓' : '○'} Min 8 characters</span>
                <span style={{ color: /[A-Z]/.test(password) ? '#16a34a' : '#94a3b8' }}>{/[A-Z]/.test(password) ? '✓' : '○'} Uppercase letter</span>
                <span style={{ color: /[0-9]/.test(password) ? '#16a34a' : '#94a3b8' }}>{/[0-9]/.test(password) ? '✓' : '○'} Number</span>
                <span style={{ color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) ? '#16a34a' : '#94a3b8' }}>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) ? '✓' : '○'} Special character</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isEmailVerified || usernameStatus === 'taken'}
            style={{
              padding: '0.75rem',
              background: (isEmailVerified && usernameStatus !== 'taken') ? '#2563eb' : '#94a3b8',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              borderRadius: 8,
              border: 'none',
              cursor: (isEmailVerified && usernameStatus !== 'taken') ? 'pointer' : 'not-allowed',
              marginTop: '0.5rem',
              boxShadow: (isEmailVerified && usernameStatus !== 'taken') ? '0 4px 12px rgba(37,99,235,0.3)' : 'none'
            }}
          >
            {loading ? 'Creating Account…' : isEmailVerified ? 'Register Account' : 'Verify Email OTP to Continue'}
          </button>
        </form>

        {/* Footer link to Login */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: '#64748b' }}>
          Already have an account? <Link to="/login" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Log In</Link>
        </div>

      </div>

      {/* ── Email OTP Verification Modal ── */}
      {otpModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', maxWidth: '400px', width: '92vw', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📩</div>
            <h3 style={{ margin: '0 0 0.35rem 0', color: '#0f172a' }}>Enter Email OTP</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            {otpModalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.5rem', borderRadius: 6, fontSize: '0.8rem', marginBottom: '0.75rem', fontWeight: 500 }}>
                {otpModalError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  letterSpacing: '8px',
                  padding: '0.5rem',
                  borderRadius: 8,
                  border: '2px solid #2563eb',
                  marginBottom: '1rem',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  style={{ flex: 1, padding: '0.6rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 7, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpVerifying || otpCode.length !== 6}
                  style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700 }}
                >
                  {otpVerifying ? 'Verifying…' : 'Verify & Confirm'}
                </button>
              </div>
            </form>

            <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: '#64748b' }}>
              Didn't receive code?{' '}
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpSending}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Resend OTP
              </button>
            </div>
          </div>
        </div>
      )}

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
