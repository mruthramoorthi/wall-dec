import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import SizeMaster from './pages/SizeMaster/SizeMaster.jsx';
import DealerMaster from './pages/DealerMaster/DealerMaster.jsx';
import CustomerMaster from './pages/CustomerMaster/CustomerMaster.jsx';
import EmployeeMaster from './pages/EmployeeMaster/EmployeeMaster.jsx';
import CompanyRegistration from './pages/CompanyRegistration/CompanyRegistration.jsx';
import StockInward from './pages/StockInward/StockInward.jsx';
import StockCheck from './pages/StockCheck/StockCheck.jsx';
import RateMaster from './pages/RateMaster/RateMaster.jsx';
import Billing from './pages/Billing/Billing.jsx';
import Advance from './pages/Advance/Advance.jsx';
import AmountTransaction from './pages/AmountTransaction/AmountTransaction.jsx';
import CreditReceived from './pages/Credit/CreditReceived.jsx';
import CreditReport from './pages/Credit/CreditReport.jsx';
import BankMaster from './pages/BankMaster/BankMaster.jsx';
import TransactionMaster from './pages/TransactionMaster/TransactionMaster.jsx';
import Expense from './pages/Expense/Expense.jsx';
import ExpenseCategoryMaster from './pages/ExpenseCategoryMaster/ExpenseCategoryMaster.jsx';
import ScreenRightsMaster from './pages/ScreenRights/ScreenRightsMaster.jsx';
import GlobalActiveScreens from './pages/GlobalScreens/GlobalActiveScreens.jsx';
import RoleMaster from './pages/RoleMaster/RoleMaster.jsx';
import Profile from './pages/Profile/Profile.jsx';
import Login from './pages/Auth/Login.jsx';
import Register from './pages/Auth/Register.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { getMyScreens } from './api/screen.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [isNavOpen, setIsNavOpen] = useState(false);
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
      <Routes>
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
                            src={`${API_BASE}/images/${currentUser.profile_picture}`}
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
                            src={`${API_BASE}/images/${currentUser.profile_picture}`}
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
                  </Routes>
                </main>
              </div>
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
