import { useState } from 'react';
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
import Profile from './pages/Profile/Profile.jsx';
import Login from './pages/Auth/Login.jsx';
import Register from './pages/Auth/Register.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const NAV = [
  { to: '/company', label: '🏢 Company' },
  { to: '/employee', label: '👥 Employees' },
  { to: '/bank-master', label: '🏦 Bank Master' },
  { to: '/transaction-master', label: '💳 Transaction Master' },
  { to: '/expense-category', label: '📂 Expense Categories' },
  { to: '/size', label: '📐 Size Master' },
  { to: '/dealer', label: '🏭 Dealer Master' },
  { to: '/customer', label: '🤝 Customer Master' },
  { to: '/stock-inward', label: '📥 Stock Inward' },
  { to: '/rate-master', label: '🏷️ Rate Master' },
  { to: '/stock-check', label: '🔍 Stock Checking' },
  { to: '/billing', label: '🧾 Billing' },
  { to: '/credit-received', label: '💰 Credit Received' },
  { to: '/credit-report', label: '📊 Credit Report' },
  { to: '/advance', label: '🔖 Advance / Pre-booking' },
  { to: '/expense', label: '💸 Expenses' },
  { to: '/amount-transaction', label: '📈 Amount Transaction' },
  { to: '/profile', label: '👤 My Profile' },
];

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

  const handleLogout = () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
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
              <Login onLoginSuccess={(u) => setCurrentUser(u)} />
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

                {/* Navigation Sidebar (Drawer on mobile, Sidebar on PC) */}
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
                          @{currentUser.username}
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
                        padding: '0.3rem 0.45rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        lineHeight: 1
                      }}
                    >
                      🚪
                    </button>
                  </div>

                  {NAV.map((n) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      onClick={() => setIsNavOpen(false)}
                      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    >
                      {n.label}
                    </NavLink>
                  ))}
                </nav>

                <main className="app-main">
                  <Routes>
                    <Route path="/" element={<Navigate to="/billing" replace />} />
                    <Route path="/company" element={<CompanyRegistration />} />
                    <Route path="/employee" element={<EmployeeMaster />} />
                    <Route path="/bank-master" element={<BankMaster />} />
                    <Route path="/transaction-master" element={<TransactionMaster />} />
                    <Route path="/expense-category" element={<ExpenseCategoryMaster />} />
                    <Route path="/size" element={<SizeMaster />} />
                    <Route path="/dealer" element={<DealerMaster />} />
                    <Route path="/customer" element={<CustomerMaster />} />
                    <Route path="/stock-inward" element={<StockInward />} />
                    <Route path="/rate-master" element={<RateMaster />} />
                    <Route path="/stock-check" element={<StockCheck />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/credit-received" element={<CreditReceived />} />
                    <Route path="/credit-report" element={<CreditReport />} />
                    <Route path="/advance" element={<Advance />} />
                    <Route path="/expense" element={<Expense />} />
                    <Route path="/amount-transaction" element={<AmountTransaction />} />
                    <Route path="/profile" element={<Profile onUserUpdated={(u) => setCurrentUser(u)} />} />
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
