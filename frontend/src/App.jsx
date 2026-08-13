import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import SizeMaster from './pages/SizeMaster/SizeMaster.jsx';
import DealerMaster from './pages/DealerMaster/DealerMaster.jsx';
import StockInward from './pages/StockInward/StockInward.jsx';
import Billing from './pages/Billing/Billing.jsx';
import AmountTransaction from './pages/AmountTransaction/AmountTransaction.jsx';

const NAV = [
  { to: '/size', label: 'Size Master' },
  { to: '/dealer', label: 'Dealer Master' },
  { to: '/stock-inward', label: 'Stock Inward' },
  { to: '/billing', label: 'Billing' },
  { to: '/amount-transaction', label: 'Amount Transaction' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="app-nav">
          <div className="app-title">Inventory ERP</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/size" replace />} />
            <Route path="/size" element={<SizeMaster />} />
            <Route path="/dealer" element={<DealerMaster />} />
            <Route path="/stock-inward" element={<StockInward />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/amount-transaction" element={<AmountTransaction />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
