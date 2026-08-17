import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { loginUser, sendForgotPasswordOtp, verifyForgotPasswordOtp, resetPasswordWithOtp } from '../../api/auth.js';
import PasswordInput from '../../components/PasswordInput.jsx';

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isJustRegistered = searchParams.get('registered') === '1';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);

  // Forgot Password State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('identifier'); // 'identifier' | 'reset'
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [forgotSuccess, setForgotSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) { setError('Please enter your Username or Email.'); return; }
    if (!password) { setError('Please enter your Password.'); return; }

    setLoading(true);
    try {
      const res = await loginUser(identifier.trim(), password);
      const { user, token } = res.data;

      // Persist auth
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', token);

      if (onLoginSuccess) {
        onLoginSuccess(user);
      }

      navigate('/billing');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    setForgotError(null);
    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your Username or Email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await sendForgotPasswordOtp(forgotIdentifier.trim());
      setForgotEmail(res.email);
      setMaskedEmail(res.masked_email || res.email);
      setForgotStep('reset');
      setForgotSuccess(`✓ 6-digit OTP sent to ${res.masked_email || res.email}. Check your email.`);
    } catch (err) {
      setForgotError(err.message || 'Could not find account or send OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError(null);

    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the 6-digit OTP code sent to your email.');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setForgotError('New password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('New passwords do not match. Please re-enter.');
      return;
    }

    setForgotLoading(true);
    try {
      await resetPasswordWithOtp(forgotEmail, forgotOtp.trim(), newPassword);
      setForgotSuccess('✓ Password reset successfully! You can now log in.');
      setIdentifier(forgotIdentifier.trim());
      setPassword('');
      setTimeout(() => {
        setForgotModalOpen(false);
        setForgotStep('identifier');
        setForgotIdentifier('');
        setForgotOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 1500);
    } catch (err) {
      setForgotError(err.message || 'Failed to reset password. Please check the OTP code.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '1.5rem 1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#fff',
        borderRadius: '16px',
        padding: '2.25rem 2rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)'
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '0.25rem' }}>📦</div>
          <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.65rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Inventory ERP
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            Sign in with your username or email
          </p>
        </div>

        {isJustRegistered && (
          <div className="success" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            ✓ Registration completed successfully! Please log in with your credentials.
          </div>
        )}

        {forgotSuccess && !forgotModalOpen && (
          <div className="success" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            {forgotSuccess}
          </div>
        )}

        {error && (
          <div className="field-error" style={{ marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
              Username or Email
            </label>
            <input
              type="text"
              placeholder="e.g. johndoe or user@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', fontSize: '0.95rem' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotModalOpen(true);
                  setForgotStep('identifier');
                  setForgotError(null);
                  setForgotSuccess(null);
                  setForgotIdentifier(identifier || '');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'none'
                }}
              >
                Forgot Password?
              </button>
            </div>
            <PasswordInput
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              borderRadius: 8,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
            }}
          >
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: '#64748b' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
            Register here
          </Link>
        </div>

      </div>

      {/* ── Forgot Password Modal ── */}
      {forgotModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '440px',
            padding: '1.75rem 1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🔐</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  {forgotStep === 'identifier' ? 'Forgot Password' : 'Reset Your Password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            {forgotError && (
              <div className="field-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="success" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                {forgotSuccess}
              </div>
            )}

            {forgotStep === 'identifier' ? (
              <form onSubmit={handleSendForgotOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ margin: '0 0 0.25rem 0', color: '#475569', fontSize: '0.86rem', lineHeight: 1.5 }}>
                  Enter your registered username or email address. We will send a 6-digit OTP to your verified email to reset your password.
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    Username or Email
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. priya_billing or user@example.com"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    required
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', fontSize: '0.95rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    style={{
                      padding: '0.6rem 1rem',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.9rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      padding: '0.6rem 1.2rem',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}
                  >
                    {forgotLoading ? 'Sending OTP…' : 'Send Reset OTP →'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <p style={{ margin: '0 0 0.25rem 0', color: '#475569', fontSize: '0.86rem', lineHeight: 1.5 }}>
                  Enter the 6-digit code sent to <strong>{maskedEmail}</strong> and your new password.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.6rem 0.8rem',
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      letterSpacing: '4px',
                      textAlign: 'center'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    New Password
                  </label>
                  <PasswordInput
                    placeholder="Min 4 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                    Confirm New Password
                  </label>
                  <PasswordInput
                    placeholder="Re-enter new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => { setForgotStep('identifier'); setForgotError(null); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    ← Change Email / Username
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      padding: '0.6rem 1.2rem',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}
                  >
                    {forgotLoading ? 'Resetting…' : 'Confirm & Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
