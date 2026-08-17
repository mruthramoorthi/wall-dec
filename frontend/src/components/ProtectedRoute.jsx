import { Link } from 'react-router-dom';

/**
 * Route protection guard for role/position-based page access rights
 */
export default function ProtectedRoute({
  screenKey,
  allowedScreens = [],
  loading = false,
  currentUser = null,
  children
}) {
  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
        <p style={{ fontWeight: 600 }}>Verifying screen permissions…</p>
      </div>
    );
  }

  // Check if screen is permitted for this user
  const isAllowed = allowedScreens.some(
    (s) => s.screen_key === screenKey || s.route_path === window.location.pathname
  );

  if (!isAllowed) {
    const firstAllowed = allowedScreens[0]?.route_path || '/billing';
    const userRole = currentUser?.role_position || 'Staff';

    return (
      <div className="page" style={{ maxWidth: '640px', margin: '3rem auto', textAlign: 'center' }}>
        <div
          className="card"
          style={{
            padding: '2.5rem 2rem',
            border: '1.5px solid #fecdd3',
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 10px 25px -5px rgba(225, 29, 72, 0.1)'
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>⛔</div>
          <h2 style={{ color: '#9f1239', margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
            Access Restricted
          </h2>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
            You do not have permission to view or access the <strong>{screenKey}</strong> page with your current position role (<strong>{userRole}</strong>).
          </p>

          <div
            style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              color: '#be123c',
              fontSize: '0.84rem',
              fontWeight: 600,
              marginBottom: '1.75rem'
            }}
          >
            🔒 Page rights are managed by system administrator in <strong>Screen Rights Master</strong>.
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Link
              to={firstAllowed}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#2563eb',
                color: '#fff',
                padding: '0.65rem 1.4rem',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              <span>←</span> Return to Allowed Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
