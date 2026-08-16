import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { loginUser } from '../../api/auth.js';
import PasswordInput from '../../components/PasswordInput.jsx';

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isJustRegistered = searchParams.get('registered') === '1';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);

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
          <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.65rem', color: '#0f172a' }}>Inventory ERP</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            Sign in with your username or email
          </p>
        </div>

        {isJustRegistered && (
          <div className="success" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            ✓ Registration completed successfully! Please log in with your credentials.
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
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
              Password
            </label>
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
    </div>
  );
}
