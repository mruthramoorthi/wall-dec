import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardOverview } from '../../api/report.js';
import './Dashboard.css';

export default function Dashboard({ currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setError(null);
      const res = await getDashboardOverview();
      if (res && res.success) {
        setData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Error loading dashboard overview:', err);
      setError(err.message || 'Unable to connect to server');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoStr;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (loading) {
    return (
      <div className="dash-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⚙️</div>
        <h2 style={{ color: '#334155', fontWeight: 800 }}>Loading Dashboard Overview…</h2>
        <p style={{ color: '#64748b' }}>Aggregating real-time sales, inventory, and storefront statistics</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dash-container">
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', border: '1.5px solid #fecdd3' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h2 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Unable to Load Dashboard</h2>
          <p style={{ color: '#475569', marginBottom: '1.5rem' }}>{error}</p>
          <button
            type="button"
            className="dash-btn-primary"
            style={{ margin: '0 auto' }}
            onClick={() => fetchOverview(true)}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const {
    sales = {},
    orders = {},
    inventory = {},
    credit = {},
    advances = {},
    dealer = {},
    recent_bills = [],
    recent_orders = []
  } = data || {};

  return (
    <div className="dash-container">
      {/* ── Top Hero Welcome Banner ── */}
      <section className="dash-hero-banner">
        <div>
          <h1 className="dash-hero-title">
            <span>{getGreeting()}, {currentUser?.first_name || 'Admin'}! 👋</span>
          </h1>
          <p className="dash-hero-subtitle">
            <span>📅 {todayDisplay}</span>
            <span>•</span>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>Role: {currentUser?.role_position || 'Administrator'}</span>
            <span>•</span>
            <span style={{ color: '#4ade80' }}>● Live Operations Active</span>
          </p>
        </div>

        <div className="dash-hero-actions">
          <Link to="/billing" className="dash-btn-primary" id="btn-dash-newbill">
            <span>+</span>
            <span>New Bill</span>
          </Link>
          <Link to="/orders" className="dash-btn-secondary" id="btn-dash-orders">
            <span>📦</span>
            <span>Store Orders</span>
            {Number(orders.pending_orders) > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '12px',
                padding: '1px 6px',
                fontSize: '0.72rem',
                fontWeight: 900
              }}>
                {orders.pending_orders}
              </span>
            )}
          </Link>
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            title="Refresh dashboard metrics"
          >
            <span>{refreshing ? '⏳' : '🔄'}</span>
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </section>

      {/* ── Low Stock Alert Banner (If Applicable) ── */}
      {inventory.low_stock_count > 0 && (
        <div className="dash-alert-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.96rem' }}>
                Stock Warning: {inventory.low_stock_count} item(s) have fallen below the low stock threshold!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: '0.2rem' }}>
                Critically low sizes:{' '}
                {inventory.low_stock_items?.map((it) => `${it.product_name} (${it.available_qty} left)`).join(', ')}
              </div>
            </div>
          </div>
          <Link
            to="/stock-inward"
            className="dash-btn-primary"
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem', background: '#d97706' }}
          >
            + Create Inward
          </Link>
        </div>
      )}

      {/* ── Primary KPI Metrics Grid ── */}
      <section className="dash-metrics-grid">
        {/* Card 1: Today's Sales */}
        <div className="dash-metric-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              💰
            </div>
            <span className="dash-card-tag" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              Today
            </span>
          </div>
          <div className="dash-card-label">Today's Sales Revenue</div>
          <div className="dash-card-value">{formatCurrency(sales.today_sales)}</div>
          <div className="dash-card-footer">
            <span style={{ fontWeight: 700, color: '#10b981' }}>{sales.today_bill_count || 0} bills</span>
            <span>generated today</span>
          </div>
        </div>

        {/* Card 2: MTD Sales */}
        <div className="dash-metric-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              📈
            </div>
            <span className="dash-card-tag" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
              This Month
            </span>
          </div>
          <div className="dash-card-label">Month-to-Date Sales</div>
          <div className="dash-card-value">{formatCurrency(sales.month_sales)}</div>
          <div className="dash-card-footer">
            <span style={{ fontWeight: 700, color: '#8b5cf6' }}>{sales.month_bill_count || 0} bills</span>
            <span>billed in current month</span>
          </div>
        </div>

        {/* Card 3: Storefront Orders */}
        <div className="dash-metric-card" style={{ borderLeft: '4px solid #06b6d4' }}>
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: '#ecfeff', color: '#0891b2' }}>
              🛍️
            </div>
            <span
              className="dash-card-tag"
              style={{
                background: Number(orders.pending_orders) > 0 ? '#fef2f2' : '#ecfeff',
                color: Number(orders.pending_orders) > 0 ? '#b91c1c' : '#0e7490'
              }}
            >
              {Number(orders.pending_orders) > 0 ? `${orders.pending_orders} PENDING` : 'ALL CLEAR'}
            </span>
          </div>
          <div className="dash-card-label">Storefront Orders</div>
          <div className="dash-card-value">{orders.total_orders || 0} Orders</div>
          <div className="dash-card-footer">
            <span style={{ fontWeight: 700, color: '#0284c7' }}>{formatCurrency(orders.total_order_value)}</span>
            <span>total order value</span>
          </div>
        </div>

        {/* Card 4: Warehouse Stock */}
        <div className="dash-metric-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: '#f0fdf4', color: '#059669' }}>
              🏬
            </div>
            <span className="dash-card-tag" style={{ background: '#f0fdf4', color: '#047857' }}>
              Inventory
            </span>
          </div>
          <div className="dash-card-label">Warehouse Stock Available</div>
          <div className="dash-card-value">{Number(inventory.total_available_qty || 0).toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>pcs</span></div>
          <div className="dash-card-footer">
            <span style={{ fontWeight: 700, color: '#059669' }}>{inventory.total_products || 0} active sizes</span>
            <span>in warehouse</span>
          </div>
        </div>

        {/* Card 5: Customer Credit Receivables */}
        <div className="dash-metric-card" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: '#fff1f2', color: '#e11d48' }}>
              💳
            </div>
            <span className="dash-card-tag" style={{ background: '#fff1f2', color: '#be123c' }}>
              Receivables
            </span>
          </div>
          <div className="dash-card-label">Customer Credit Due</div>
          <div className="dash-card-value" style={{ color: '#be123c' }}>{formatCurrency(credit.total_credit_due)}</div>
          <div className="dash-card-footer">
            <span style={{ fontWeight: 700, color: '#e11d48' }}>{credit.pending_credit_bills || 0} bills</span>
            <span>awaiting customer collection</span>
          </div>
        </div>

        {/* Card 6: Customer Advances & Dealer Payable */}
        <div className="dash-metric-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              🪙
            </div>
            <span className="dash-card-tag" style={{ background: '#fffbeb', color: '#b45309' }}>
              Deposit / Dues
            </span>
          </div>
          <div className="dash-card-label">Customer Unbilled Advances</div>
          <div className="dash-card-value" style={{ color: '#b45309' }}>{formatCurrency(advances.active_advance_total)}</div>
          <div className="dash-card-footer">
            <span>Dealer Payables:</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(dealer.total_dealer_due)}</span>
          </div>
        </div>
      </section>

      {/* ── Quick Action Launchpad ── */}
      <section>
        <h2 className="dash-section-title">
          <span>⚡ Quick Action Launchpad</span>
        </h2>
        <div className="dash-launchpad-grid">
          <Link to="/billing" className="dash-launch-item" id="launch-billing">
            <span className="dash-launch-icon">🧾</span>
            <span className="dash-launch-title">Billing POS</span>
            <span className="dash-launch-desc">Create quick retail sales invoices and printable bills</span>
          </Link>

          <Link to="/orders" className="dash-launch-item" id="launch-orders">
            <span className="dash-launch-icon">🛍️</span>
            <span className="dash-launch-title">Online Orders</span>
            <span className="dash-launch-desc">Review and dispatch storefront customer orders</span>
          </Link>

          <Link to="/stock-inward" className="dash-launch-item" id="launch-stock-inward">
            <span className="dash-launch-icon">📥</span>
            <span className="dash-launch-title">Stock Inward</span>
            <span className="dash-launch-desc">Record dealer shipments and purchase lot inwards</span>
          </Link>

          <Link to="/stock-check" className="dash-launch-item" id="launch-stock-check">
            <span className="dash-launch-icon">🔍</span>
            <span className="dash-launch-title">Stock Check</span>
            <span className="dash-launch-desc">Live inventory quantities, sizes, and pricing lookup</span>
          </Link>

          <Link to="/credit-report" className="dash-launch-item" id="launch-credit">
            <span className="dash-launch-icon">💳</span>
            <span className="dash-launch-title">Credit Ledger</span>
            <span className="dash-launch-desc">Track customer credit dues, settlements, and history</span>
          </Link>

          <Link to="/advance" className="dash-launch-item" id="launch-advance">
            <span className="dash-launch-icon">🪙</span>
            <span className="dash-launch-title">Customer Advance</span>
            <span className="dash-launch-desc">Record advance booking receipts and convert to bills</span>
          </Link>

          <Link to="/accounts-reports" className="dash-launch-item" id="launch-accounts">
            <span className="dash-launch-icon">📊</span>
            <span className="dash-launch-title">Reports & P&L</span>
            <span className="dash-launch-desc">Comprehensive profit/loss, daily collection, and metrics</span>
          </Link>

          <Link to="/catalog" className="dash-launch-item" id="launch-catalog">
            <span className="dash-launch-icon">🖼️</span>
            <span className="dash-launch-title">Live Storefront</span>
            <span className="dash-launch-desc">Open customer facing digital wall decoration catalog</span>
          </Link>
        </div>
      </section>

      {/* ── Two-Column Main Activity Grid (Recent Invoices & Recent Orders) ── */}
      <section className="dash-activity-grid">
        {/* Left Column: Recent Billing Invoices */}
        <div className="dash-table-card">
          <div className="dash-table-header">
            <h3>
              <span>🧾</span>
              <span>Recent Invoices</span>
            </h3>
            <Link to="/credit-report" className="dash-table-viewall">
              View All Bills →
            </Link>
          </div>

          {recent_bills.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No bills recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dash-mini-table">
                <thead>
                  <tr>
                    <th>Bill No</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_bills.map((bill) => (
                    <tr key={bill.bill_id}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        #{bill.bill_number}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{bill.customer_name || 'Counter Customer'}</span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        {formatDate(bill.bill_date)}
                      </td>
                      <td>
                        {bill.is_credit ? (
                          <span className="dash-status-pill dash-status-due">Credit</span>
                        ) : (
                          <span className="dash-status-pill dash-status-paid">
                            {bill.payment_mode || 'Cash'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {formatCurrency(bill.net_total || bill.grand_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Recent Storefront Orders */}
        <div className="dash-table-card">
          <div className="dash-table-header">
            <h3>
              <span>🛍️</span>
              <span>Recent Storefront Orders</span>
            </h3>
            <Link to="/orders" className="dash-table-viewall">
              Manage Orders →
            </Link>
          </div>

          {recent_orders.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No storefront customer orders yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dash-mini-table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_orders.map((ord) => {
                    const statusLower = (ord.order_status || 'pending').toLowerCase();
                    let statusClass = 'dash-status-pending';
                    if (statusLower.includes('deliver') || statusLower.includes('completed')) {
                      statusClass = 'dash-status-delivered';
                    } else if (statusLower.includes('process') || statusLower.includes('dispatch')) {
                      statusClass = 'dash-status-processing';
                    }

                    return (
                      <tr key={ord.order_id}>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>
                          #{ord.order_number}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {ord.customer_name || 'Online Customer'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {formatDate(ord.created_at)}
                          </div>
                        </td>
                        <td>
                          <span className={`dash-status-pill ${statusClass}`}>
                            {ord.order_status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(ord.total_amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
