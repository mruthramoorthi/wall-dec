export function AccessRestrictedView() {
  return (
    <div
      className="page"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '65vh',
        textAlign: 'center',
        padding: '2rem'
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: '3rem 3.5rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          maxWidth: '480px',
          width: '100%'
        }}
      >
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⛔</div>
        <h1
          style={{
            color: '#0f172a',
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 800,
            letterSpacing: '-0.02em'
          }}
        >
          Access Restricted
        </h1>
      </div>
    </div>
  );
}

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
  const isAllowed =
    screenKey === 'dashboard' ||
    allowedScreens.some(
      (s) => s.screen_key === screenKey || s.route_path === window.location.pathname
    );

  if (!isAllowed) {
    return <AccessRestrictedView />;
  }

  return children;
}
