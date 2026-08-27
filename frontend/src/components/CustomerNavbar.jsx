import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import CustomerTour from './CustomerTour.jsx';

export default function CustomerNavbar({ cartCount = 0, onOpenCart, currentUser }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <>
      {/* ── Guided Customer Tour (Auto-launches on first visit) ── */}
      <CustomerTour
        autoLaunch={true}
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
      />

      {/* ── Top Sticky Customer Navigation ─────────────────────────────── */}
      <header className="cust-navbar-sticky">
        <div className="cust-navbar-inner">
          {/* Brand Logo & Studio Tag */}
          <Link to="/catalog" className="cust-brand-link">
            <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>✨</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.02em', fontSize: '1.18rem' }}>
                  WALLDEC
                </span>
                <span className="cust-brand-badge">STUDIO</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>
                LUXURY ACRYLIC PANELS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="cust-nav-links" id="tour-nav-tracker" style={{ display: 'flex' }}>
            <Link
              to="/catalog"
              className={`cust-nav-link ${currentPath === '/catalog' ? 'active' : ''}`}
            >
              <span>🎨</span>
              <span>Designs Catalog</span>
            </Link>

            <Link
              to="/track-orders"
              id="tour-track-orders"
              className={`cust-nav-link ${currentPath === '/track-orders' ? 'active' : ''}`}
            >
              <span>📦</span>
              <span>Track Orders</span>
            </Link>

            <Link
              to="/track-advances"
              id="tour-track-advances"
              className={`cust-nav-link ${currentPath === '/track-advances' || currentPath === '/my-advances' ? 'active' : ''}`}
            >
              <span>💰</span>
              <span>My Advances</span>
            </Link>

            {/* Quick Interactive Tour Button */}
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="cust-nav-link"
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
              title="View Interactive Customer Guide & Feature Tour"
            >
              <span>✨</span>
              <span>Quick Tour</span>
            </button>

            {currentUser && (
              <Link
                to="/billing"
                className="cust-nav-link"
                style={{ color: '#94a3b8', fontSize: '0.82rem' }}
                title="Switch to ERP Back-Office Workspace"
              >
                <span>⚡</span>
                <span>ERP Portal</span>
              </Link>
            )}
          </nav>

          {/* Right Action Icons: User Account & Cart Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                  }}
                  title={`Logged in as ${currentUser.first_name || currentUser.username}`}
                >
                  {(currentUser.first_name || currentUser.username || 'U').charAt(0).toUpperCase()}
                </div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#e2e8f0',
                    maxWidth: 120,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  className="cust-desktop-only"
                >
                  {currentUser.first_name || currentUser.username}
                </span>
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  color: '#cbd5e1',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '0.45rem 0.85rem',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)'
                }}
              >
                Sign In
              </Link>
            )}

            {/* Cart Trigger Button */}
            <button
              type="button"
              id="tour-cart-btn"
              className="cust-cart-trigger"
              onClick={onOpenCart}
              aria-label={`Shopping cart with ${cartCount} items`}
            >
              <span>🛒</span>
              <span className="cust-desktop-only">Cart</span>
              {cartCount > 0 && <span className="cust-cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Bottom Fixed Tab Bar (< 768px) ───────────────────────── */}
      <div className="cust-mobile-bottom-bar" role="navigation" aria-label="Mobile Navigation">
        <Link
          to="/catalog"
          className={`cust-mobile-tab ${currentPath === '/catalog' ? 'active' : ''}`}
        >
          <span className="tab-icon">🎨</span>
          <span>Catalog</span>
        </Link>

        <Link
          to="/track-orders"
          id="tour-track-orders-mobile"
          className={`cust-mobile-tab ${currentPath === '/track-orders' ? 'active' : ''}`}
        >
          <span className="tab-icon">📦</span>
          <span>Orders</span>
        </Link>

        <Link
          to="/track-advances"
          id="tour-track-advances-mobile"
          className={`cust-mobile-tab ${currentPath === '/track-advances' || currentPath === '/my-advances' ? 'active' : ''}`}
        >
          <span className="tab-icon">💰</span>
          <span>Advances</span>
        </Link>

        <button
          type="button"
          className="cust-mobile-tab"
          onClick={() => setTourOpen(true)}
          style={{ color: '#38bdf8' }}
        >
          <span className="tab-icon">✨</span>
          <span>Tour</span>
        </button>

        <button
          type="button"
          id="tour-cart-btn-mobile"
          className="cust-mobile-tab"
          onClick={onOpenCart}
        >
          <span className="tab-icon">🛒</span>
          <span>Cart</span>
          {cartCount > 0 && <span className="cust-mobile-badge">{cartCount}</span>}
        </button>

        {currentUser ? (
          <Link
            to="/profile"
            className="cust-mobile-tab"
          >
            <span className="tab-icon">👤</span>
            <span>Profile</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className="cust-mobile-tab"
          >
            <span className="tab-icon">🔑</span>
            <span>Login</span>
          </Link>
        )}
      </div>
    </>
  );
}
