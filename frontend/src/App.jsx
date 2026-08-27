import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { getMyScreens } from './api/screen.js';
import { getImageUrl } from './utils/apiConfig.js';
import './customer.css';

// Public & Customer E-Commerce Pages (Lazy Loaded)
const ProductCatalog = lazy(() => import('./pages/Catalog/ProductCatalog.jsx'));
const Checkout = lazy(() => import('./pages/Orders/Checkout.jsx'));
const OrderTracker = lazy(() => import('./pages/Orders/OrderTracker.jsx'));
const AdvanceTracker = lazy(() => import('./pages/Orders/AdvanceTracker.jsx'));

// Public Auth Pages (Lazy Loaded)
const Login = lazy(() => import('./pages/Auth/Login.jsx'));
const Register = lazy(() => import('./pages/Auth/Register.jsx'));

// Admin & ERP Master Pages (Lazy Loaded)
const SizeMaster = lazy(() => import('./pages/SizeMaster/SizeMaster.jsx'));
const DealerMaster = lazy(() => import('./pages/DealerMaster/DealerMaster.jsx'));
const CustomerMaster = lazy(() => import('./pages/CustomerMaster/CustomerMaster.jsx'));
const EmployeeMaster = lazy(() => import('./pages/EmployeeMaster/EmployeeMaster.jsx'));
const CompanyRegistration = lazy(() => import('./pages/CompanyRegistration/CompanyRegistration.jsx'));
const StockInward = lazy(() => import('./pages/StockInward/StockInward.jsx'));
const StockCheck = lazy(() => import('./pages/StockCheck/StockCheck.jsx'));
const RateMaster = lazy(() => import('./pages/RateMaster/RateMaster.jsx'));
const Billing = lazy(() => import('./pages/Billing/Billing.jsx'));
const Advance = lazy(() => import('./pages/Advance/Advance.jsx'));
const AmountTransaction = lazy(() => import('./pages/AmountTransaction/AmountTransaction.jsx'));
const CreditReceived = lazy(() => import('./pages/Credit/CreditReceived.jsx'));
const CreditReport = lazy(() => import('./pages/Credit/CreditReport.jsx'));
const BankMaster = lazy(() => import('./pages/BankMaster/BankMaster.jsx'));
const TransactionMaster = lazy(() => import('./pages/TransactionMaster/TransactionMaster.jsx'));
const Expense = lazy(() => import('./pages/Expense/Expense.jsx'));
const ExpenseCategoryMaster = lazy(() => import('./pages/ExpenseCategoryMaster/ExpenseCategoryMaster.jsx'));
const ScreenRightsMaster = lazy(() => import('./pages/ScreenRights/ScreenRightsMaster.jsx'));
const GlobalActiveScreens = lazy(() => import('./pages/GlobalScreens/GlobalActiveScreens.jsx'));
const RoleMaster = lazy(() => import('./pages/RoleMaster/RoleMaster.jsx'));
const Profile = lazy(() => import('./pages/Profile/Profile.jsx'));
const AdminOrders = lazy(() => import('./pages/Orders/AdminOrders.jsx'));
const AccountsReports = lazy(() => import('./pages/AccountsReports/AccountsReports.jsx'));
const DealerPayment = lazy(() => import('./pages/DealerPayment/DealerPayment.jsx'));

function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '0.85rem',
        color: '#64748b'
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          border: '3.5px solid #e2e8f0',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'appSpin 0.7s linear infinite'
        }}
      />
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>
        Loading...
      </span>
      <style>{`
        @keyframes appSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem('user_cart');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleAddToCart = (item, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);
    setCart((prev) => {
      const existing = prev.find((p) => p.uid === item.uid);
      let updated;
      if (existing) {
        updated = prev.map((p) => (p.uid === item.uid ? { ...p, quantity: (p.quantity || 1) + qty } : p));
      } else {
        updated = [...prev, { ...item, quantity: qty }];
      }
      localStorage.setItem('user_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateQuantity = (stockUid, quantity) => {
    const qty = Math.max(1, Number(quantity) || 1);
    setCart((prev) => {
      const updated = prev.map((p) => (p.uid === stockUid ? { ...p, quantity: qty } : p));
      localStorage.setItem('user_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRemoveFromCart = (stockUid) => {
    setCart((prev) => {
      const updated = prev.filter((p) => p.uid !== stockUid);
      localStorage.setItem('user_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    localStorage.removeItem('user_cart');
  };

  const handleOrderComplete = () => {
    setCart([]);
    localStorage.removeItem('user_cart');
  };

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [allowedScreens, setAllowedScreens] = useState(() => {
    try {
      const stored = localStorage.getItem('cached_screens');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [loadingScreens, setLoadingScreens] = useState(false);

  const fetchAllowedScreens = useCallback(async () => {
    if (!currentUser) return;
    setLoadingScreens(true);
    try {
      const res = await getMyScreens(currentUser.uid);
      const screens = res.data || [];
      setAllowedScreens(screens);
      localStorage.setItem('cached_screens', JSON.stringify(screens));
    } catch (err) {
      console.warn('Could not load allowed screens from DB:', err.message);
    } finally {
      setLoadingScreens(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchAllowedScreens();
    } else {
      setAllowedScreens([]);
      localStorage.removeItem('cached_screens');
    }
  }, [currentUser, fetchAllowedScreens]);

  const handleLogout = () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('cached_screens');
    setCurrentUser(null);
    setAllowedScreens([]);
  };

  const avatarLetter = currentUser?.first_name
    ? currentUser.first_name.charAt(0).toUpperCase()
    : currentUser?.username
    ? currentUser.username.charAt(0).toUpperCase()
    : 'U';

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
        {/* Public Catalog & E-Commerce Routes */}
        <Route
          path="/catalog"
          element={
            <ProductCatalog
              currentUser={currentUser}
              onAddToCart={handleAddToCart}
              cart={cart}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveFromCart={handleRemoveFromCart}
              onClearCart={handleClearCart}
              cartCount={cart.reduce((s, i) => s + (i.quantity || 1), 0)}
            />
          }
        />
        <Route
          path="/checkout"
          element={
            <Checkout
              cart={cart}
              currentUser={currentUser}
              onOrderComplete={handleOrderComplete}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveFromCart={handleRemoveFromCart}
              onClearCart={handleClearCart}
            />
          }
        />
        <Route
          path="/track-orders"
          element={<OrderTracker currentUser={currentUser} />}
        />
        <Route
          path="/track-advances"
          element={<AdvanceTracker currentUser={currentUser} />}
        />
        <Route
          path="/my-advances"
          element={<AdvanceTracker currentUser={currentUser} />}
        />

        {/* Public Auth Routes */}
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/billing" replace />
            ) : (
              <Login
                onLoginSuccess={(u) => {
                  setCurrentUser(u);
                }}
              />
            )
          }
        />
        <Route
          path="/register"
          element={
            currentUser ? (
              <Navigate to="/billing" replace />
            ) : (
              <Register />
            )
          }
        />

        {/* Protected App Routes */}
        <Route
          path="/*"
          element={
            !currentUser ? (
              <Navigate to="/login" replace />
            ) : (
              <div className="app-shell">
                {/* Mobile Header (Hidden on PC via mobile.css) */}
                <header className="mobile-header">
                  <div className="mobile-brand">
                    <span style={{ fontSize: '1.25rem' }}>📦</span>
                    <span className="mobile-brand-title">Inventory ERP</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Link to="/profile" style={{ textDecoration: 'none' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#2563eb', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden'
                      }}>
                        {currentUser.profile_picture ? (
                          <img
                            src={getImageUrl(currentUser.profile_picture)}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          avatarLetter
                        )}
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="mobile-menu-btn"
                      onClick={() => setIsNavOpen((prev) => !prev)}
                      aria-label="Toggle Navigation"
                    >
                      {isNavOpen ? '✕' : '☰'}
                    </button>
                  </div>
                </header>

                {/* Mobile Backdrop (Hidden on PC) */}
                {isNavOpen && (
                  <div className="mobile-nav-backdrop" onClick={() => setIsNavOpen(false)} />
                )}

                {/* Dynamic Navigation Sidebar (Loaded from DB) */}
                <nav className={`app-nav ${isNavOpen ? 'mobile-nav-open' : ''}`}>
                  <div className="app-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📦</span>
                    <span>Inventory ERP</span>
                  </div>

                  {/* User Profile Card in Sidebar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    background: '#0f172a',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 8,
                    marginBottom: '0.5rem',
                    border: '1px solid #334155'
                  }}>
                    <Link
                      to="/profile"
                      onClick={() => setIsNavOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        flex: 1,
                        minWidth: 0,
                        textDecoration: 'none'
                      }}
                      title="View & Edit Profile"
                    >
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#2563eb',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}>
                        {currentUser.profile_picture ? (
                          <img
                            src={getImageUrl(currentUser.profile_picture)}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          avatarLetter
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {currentUser.first_name} {currentUser.last_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {currentUser.role_position || 'Admin'}
                        </div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      title="Log Out"
                      style={{
                        background: '#334155',
                        color: '#f87171',
                        border: 'none',
                        borderRadius: 6,
                        padding: '0.4rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                      </svg>
                    </button>
                  </div>

                  {/* Dynamically loaded DB screens */}
                  {allowedScreens.map((s) => (
                    <NavLink
                      key={s.route_path}
                      to={s.route_path}
                      onClick={() => setIsNavOpen(false)}
                      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    >
                      <span style={{ marginRight: '0.45rem' }}>{s.icon}</span>
                      <span>{s.screen_name}</span>
                    </NavLink>
                  ))}

                  {allowedScreens.length === 0 && !loadingScreens && (
                    <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>
                      No active screens assigned.
                    </div>
                  )}
                </nav>

                <main className="app-main">
                  <Routes>
                    <Route path="/" element={<Navigate to="/billing" replace />} />
                    
                    <Route
                      path="/company"
                      element={
                        <ProtectedRoute screenKey="company" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <CompanyRegistration />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/employee"
                      element={
                        <ProtectedRoute screenKey="employee" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <EmployeeMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/screen-rights"
                      element={
                        <ProtectedRoute screenKey="screen_rights" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <ScreenRightsMaster onPermissionsUpdated={fetchAllowedScreens} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/global-screens"
                      element={
                        <ProtectedRoute screenKey="global_screens" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <GlobalActiveScreens />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/role-master"
                      element={
                        <ProtectedRoute screenKey="role_master" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <RoleMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/bank-master"
                      element={
                        <ProtectedRoute screenKey="bank_master" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <BankMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/transaction-master"
                      element={
                        <ProtectedRoute screenKey="transaction_master" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <TransactionMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/expense-category"
                      element={
                        <ProtectedRoute screenKey="expense_category" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <ExpenseCategoryMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/size"
                      element={
                        <ProtectedRoute screenKey="size_master" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <SizeMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dealer"
                      element={
                        <ProtectedRoute screenKey="dealer_master" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <DealerMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/customer"
                      element={
                        <ProtectedRoute screenKey="customer_master" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <CustomerMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/stock-inward"
                      element={
                        <ProtectedRoute screenKey="stock_inward" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <StockInward />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/rate-master"
                      element={
                        <ProtectedRoute screenKey="rate_master" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <RateMaster />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/stock-check"
                      element={
                        <ProtectedRoute screenKey="stock_check" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <StockCheck />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/billing"
                      element={
                        <ProtectedRoute screenKey="billing" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <Billing />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/credit-received"
                      element={
                        <ProtectedRoute screenKey="credit_received" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <CreditReceived />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/credit-report"
                      element={
                        <ProtectedRoute screenKey="credit_report" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <CreditReport />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/advance"
                      element={
                        <ProtectedRoute screenKey="advance" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <Advance />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/expense"
                      element={
                        <ProtectedRoute screenKey="expense" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <Expense />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/amount-transaction"
                      element={
                        <ProtectedRoute screenKey="amount_transaction" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <AmountTransaction />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute screenKey="profile" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <Profile onUserUpdated={(u) => setCurrentUser(u)} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin-orders"
                      element={
                        <ProtectedRoute screenKey="orders_admin" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <AdminOrders />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/accounts-reports"
                      element={
                        <ProtectedRoute screenKey="accounts_reports" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <AccountsReports />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dealer-payment"
                      element={
                        <ProtectedRoute screenKey="dealer_payment" allowedScreens={allowedScreens} loading={loadingScreens} currentUser={currentUser}>
                          <DealerPayment />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </main>
              </div>
            )
          }
        />
      </Routes>
    </Suspense>
  </BrowserRouter>
  );
}
