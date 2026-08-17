import { useEffect, useState, useMemo } from 'react';
import { amountTransactionReport } from '../../api/report.js';
import { listCustomers } from '../../api/customer.js';
import { listPaymentModes } from '../../api/paymentMode.js';
import { listBanks } from '../../api/bank.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const inr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TRANSACTION_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'date_time', label: 'Date & Time', defaultVisible: true },
  { key: 'type', label: 'Transaction Type', defaultVisible: true },
  { key: 'ref_no', label: 'Reference / Bill #', defaultVisible: true },
  { key: 'party', label: 'Party / Payee', defaultVisible: true },
  { key: 'payment_mode', label: 'Payment Mode', defaultVisible: true },
  { key: 'bank', label: 'Bank / UTR Ref', defaultVisible: true },
  { key: 'narration', label: 'Narration / Notes', defaultVisible: true },
  { key: 'income', label: 'Income (+₹)', defaultVisible: true },
  { key: 'expense', label: 'Expense (-₹)', defaultVisible: true }
];

export default function AmountTransaction() {
  // Table Data
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({
    total_income: 0,
    total_expenses: 0,
    net_balance: 0,
    cash_balance: 0,
    bank_balance: 0
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('entry_datetime');
  const [sortDir, setSortDir] = useState('desc');

  // Filter States
  const [search, setSearch]                   = useState('');
  const [fromDate, setFromDate]               = useState('');
  const [toDate, setToDate]                   = useState('');
  const [transactionType, setTransactionType] = useState('ALL');
  const [customerUid, setCustomerUid]         = useState('');
  const [paymentMode, setPaymentMode]         = useState('ALL');
  const [bankUid, setBankUid]                 = useState('ALL');
  const [minAmount, setMinAmount]             = useState('');
  const [maxAmount, setMaxAmount]             = useState('');

  // Dropdown Lists
  const [customersList, setCustomersList]       = useState([]);
  const [paymentModesList, setPaymentModesList] = useState([]);
  const [banksList, setBanksList]               = useState([]);

  // Compute Page-Level Totals for currently rendered page rows
  const pageTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      const amt = Number(r.amount || 0);
      if (amt > 0 && r.transaction_type !== 'EXPENSE') {
        income += amt;
      } else if (amt < 0 || r.transaction_type === 'EXPENSE') {
        expense += Math.abs(amt);
      }
    }
    return {
      income,
      expense,
      net: income - expense,
      count: rows.length
    };
  }, [rows]);

  // Column Visibility with cross-device sync
  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'account_transactions_columns',
    TRANSACTION_COLS
  );

  useEffect(() => {
    listCustomers(1, 300)
      .then((res) => setCustomersList(res.rows || []))
      .catch(() => {});

    listPaymentModes(1, 100, { activeOnly: true })
      .then((res) => setPaymentModesList(res?.data || []))
      .catch(() => {});

    listBanks(1, 100, { all: true })
      .then((res) => setBanksList(res?.data || []))
      .catch(() => {});
  }, []);

  const load = async (p = page, ps = pageSize, opts = {}) => {
    setLoading(true);
    try {
      const q = opts.q !== undefined ? opts.q : search;
      const fd = opts.fromDate !== undefined ? opts.fromDate : fromDate;
      const td = opts.toDate !== undefined ? opts.toDate : toDate;
      const tt = opts.transactionType !== undefined ? opts.transactionType : transactionType;
      const cUid = opts.customerUid !== undefined ? opts.customerUid : customerUid;
      const pm = opts.paymentMode !== undefined ? opts.paymentMode : paymentMode;
      const bUid = opts.bankUid !== undefined ? opts.bankUid : bankUid;
      const minA = opts.minAmount !== undefined ? opts.minAmount : minAmount;
      const maxA = opts.maxAmount !== undefined ? opts.maxAmount : maxAmount;
      const sb = opts.sortBy || sortBy;
      const sd = opts.sortDir || sortDir;

      const res = await amountTransactionReport(p, ps, {
        q,
        fromDate: fd,
        toDate: td,
        transactionType: tt === 'ALL' ? '' : tt,
        customerUid: cUid,
        paymentMode: pm === 'ALL' ? '' : pm,
        bankUid: bUid === 'ALL' ? '' : bUid,
        minAmount: minA,
        maxAmount: maxA,
        sortBy: sb,
        sortDir: sd
      });

      setRows(res.data || []);
      setTotals(res.totals || {
        total_income: 0,
        total_expenses: 0,
        net_balance: 0,
        cash_balance: 0,
        bank_balance: 0
      });
      setTotal(res.total || 0);
      setPage(res.page || p);
    } catch (err) {
      console.error('Failed to load transaction ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load(1, pageSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, fromDate, toDate, transactionType, customerUid, paymentMode, bankUid, minAmount, maxAmount, sortBy, sortDir]); // eslint-disable-line

  const handlePageChange = (newPage) => {
    load(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    load(1, newSize);
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setTransactionType('ALL');
    setCustomerUid('');
    setPaymentMode('ALL');
    setBankUid('ALL');
    setMinAmount('');
    setMaxAmount('');
  };

  // Date Quick Presets
  const applyDatePreset = (preset) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(today.getDate() - 1);
      const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      setFromDate(yestStr);
      setToDate(yestStr);
    } else if (preset === 'week') {
      const firstDay = new Date(today);
      firstDay.setDate(today.getDate() - today.getDay());
      const firstDayStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
      setFromDate(firstDayStr);
      setToDate(todayStr);
    } else if (preset === 'month') {
      const firstDayStr = `${yyyy}-${mm}-01`;
      setFromDate(firstDayStr);
      setToDate(todayStr);
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ['S.No', 'Date', 'Type', 'Ref #', 'Party/Payee', 'Payment Mode', 'Bank', 'Narration', 'Income (+₹)', 'Expense (-₹)'];
    const csvRows = rows.map((r, idx) => {
      const numAmt = Number(r.amount || 0);
      const isExp = numAmt < 0 || r.transaction_type === 'EXPENSE';
      return [
        idx + 1,
        r.transaction_date,
        r.transaction_type,
        `"${(r.reference_number || '').replace(/"/g, '""')}"`,
        `"${(r.party_name || '').replace(/"/g, '""')}"`,
        r.payment_mode,
        `"${(r.bank_name || '').replace(/"/g, '""')}"`,
        `"${(r.narration || '').replace(/"/g, '""')}"`,
        !isExp ? numAmt : '',
        isExp ? Math.abs(numAmt) : ''
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Transaction_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="page">
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <span>💰</span> All Transactions &amp; Ledger
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Unified central transaction ledger tracking all sales revenue, customer advances, credit collections, and store expenses in a single ledger
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => load(page, pageSize)}
            disabled={loading}
            style={{
              padding: '0.5rem 0.9rem',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={exportCSV}
            disabled={loading || rows.length === 0}
            style={{
              padding: '0.5rem 0.9rem',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading || rows.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        {/* Total Income */}
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          borderRadius: 12,
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Income / Receipts (+)
            </span>
            <span style={{ fontSize: '1.2rem' }}>📈</span>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#15803d', marginTop: '0.35rem' }}>
            ₹{inr(totals.total_income)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.2rem' }}>
            Sales Bills + Advances + Credit Receipts
          </div>
        </div>

        {/* Total Expenses */}
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: 12,
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 4px rgba(220, 38, 38, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Expenses (-)
            </span>
            <span style={{ fontSize: '1.2rem' }}>📉</span>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.35rem' }}>
            -₹{inr(totals.total_expenses)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.2rem' }}>
            Store outflows (stored as negative values)
          </div>
        </div>

        {/* Net Balance */}
        <div style={{
          background: '#0f172a',
          border: '1.5px solid #334155',
          borderRadius: 12,
          padding: '1rem 1.25rem',
          color: '#fff',
          boxShadow: '0 4px 10px rgba(15, 23, 42, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
              Net Cashflow Balance (=)
            </span>
            <span style={{ fontSize: '1.2rem' }}>💳</span>
          </div>
          <div style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            color: totals.net_balance >= 0 ? '#4ade80' : '#f87171',
            marginTop: '0.35rem'
          }}>
            ₹{inr(totals.net_balance)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Net = Total Receipts - Total Expenses
          </div>
        </div>

        {/* Cash vs Bank */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '1rem 1.25rem'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Balances by Channel
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              💵 <strong>Cash in Hand:</strong>
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
              ₹{inr(totals.cash_balance)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              🏦 <strong>Bank / UPI / Online:</strong>
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2563eb' }}>
              ₹{inr(totals.bank_balance)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        {/* Row 1: Search & Date Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ flex: '1 1 280px' }}>
            <input
              type="text"
              placeholder="Search reference #, bill no, customer, category, narration, UTR…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All Time' },
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' }
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyDatePreset(p.key)}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: 20,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Deep Filters (Grid) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          alignItems: 'flex-end'
        }}>
          {/* From Date */}
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            From Date
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ width: '100%', marginTop: '0.25rem', boxSizing: 'border-box' }}
            />
          </label>

          {/* To Date */}
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            To Date
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ width: '100%', marginTop: '0.25rem', boxSizing: 'border-box' }}
            />
          </label>

          {/* Transaction Type Filter */}
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            Transaction Type
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              style={{ width: '100%', marginTop: '0.25rem', boxSizing: 'border-box' }}
            >
              <option value="ALL">All Types</option>
              <option value="BILLING">🟢 Sales Billing (+)</option>
              <option value="ADVANCE">🔵 Customer Advance (+)</option>
              <option value="CREDIT_RECEIVED">🟣 Credit Received (+)</option>
              <option value="EXPENSE">🔴 Expenses (-)</option>
            </select>
          </label>

          {/* Payment Mode Filter */}
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            Payment Mode
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              style={{ width: '100%', marginTop: '0.25rem', boxSizing: 'border-box' }}
            >
              <option value="ALL">All Payment Modes</option>
              <option value="cash">💵 Cash</option>
              <option value="bank">🏦 Bank Transfer</option>
              <option value="upi">📱 UPI / GPay</option>
              <option value="card">💳 Card</option>
              <option value="cheque">📄 Cheque</option>
              {paymentModesList.map((pm) => (
                <option key={pm.mode_code} value={pm.mode_code}>
                  {pm.mode_name}
                </option>
              ))}
            </select>
          </label>

          {/* Bank Filter */}
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            Bank Account
            <select
              value={bankUid}
              onChange={(e) => setBankUid(e.target.value)}
              style={{ width: '100%', marginTop: '0.25rem', boxSizing: 'border-box' }}
            >
              <option value="ALL">All Bank Accounts</option>
              {banksList.map((b) => (
                <option key={b.uid} value={b.uid}>
                  {b.bank_name} ({b.account_number?.slice(-4) ? `****${b.account_number.slice(-4)}` : b.bank_code})
                </option>
              ))}
            </select>
          </label>

          {/* Reset Filters */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={resetFilters}
              style={{
                width: '100%',
                padding: '0.5rem 0.8rem',
                background: '#f1f5f9',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ✕ Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Toolbar (Search Count & Column Visibility) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.88rem', color: '#64748b' }}>
          Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{total}</strong> transactions
        </div>
        <ColumnVisibility
          columns={TRANSACTION_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      {/* ── Data Table ── */}
      <TableContainer loading={loading} text="Loading transactions…" subtext="Fetching unified financial ledger">
        <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#fff' }}>
              {isVisible('sno') && <th style={{ width: 45, textAlign: 'center' }}>#</th>}
              {isVisible('date_time') && (
                <th style={{ cursor: 'pointer', minWidth: 105 }} onClick={() => handleSort('transaction_date')}>
                  Date {sortBy === 'transaction_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              )}
              {isVisible('type') && <th style={{ minWidth: 120 }}>Type</th>}
              {isVisible('ref_no') && (
                <th style={{ cursor: 'pointer', minWidth: 110 }} onClick={() => handleSort('reference_number')}>
                  Ref / Bill # {sortBy === 'reference_number' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              )}
              {isVisible('party') && (
                <th style={{ cursor: 'pointer', minWidth: 140 }} onClick={() => handleSort('party_name')}>
                  Party / Payee {sortBy === 'party_name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              )}
              {isVisible('payment_mode') && <th style={{ minWidth: 100 }}>Payment Mode</th>}
              {isVisible('bank') && <th style={{ minWidth: 110 }}>Bank / UTR</th>}
              {isVisible('narration') && <th style={{ minWidth: 160 }}>Narration / Notes</th>}
              {isVisible('income') && (
                <th style={{ cursor: 'pointer', textAlign: 'right', minWidth: 120, color: '#4ade80' }} onClick={() => handleSort('amount')}>
                  Income (+₹) {sortBy === 'amount' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              )}
              {isVisible('expense') && (
                <th style={{ cursor: 'pointer', textAlign: 'right', minWidth: 120, color: '#f87171' }} onClick={() => handleSort('amount')}>
                  Expense (-₹) {sortBy === 'amount' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const numAmt = Number(row.amount || 0);
              const isExpense = numAmt < 0 || row.transaction_type === 'EXPENSE';

              // Badges for Type
              let badgeColor = '#0284c7';
              let badgeBg = '#e0f2fe';
              let typeLabel = row.transaction_type;

              if (row.transaction_type === 'BILLING') {
                badgeColor = '#15803d';
                badgeBg = '#dcfce7';
                typeLabel = 'Sales Bill';
              } else if (row.transaction_type === 'ADVANCE') {
                badgeColor = '#0369a1';
                badgeBg = '#e0f2fe';
                typeLabel = 'Advance';
              } else if (row.transaction_type === 'CREDIT_RECEIVED') {
                badgeColor = '#7e22ce';
                badgeBg = '#f3e8ff';
                typeLabel = 'Credit Received';
              } else if (row.transaction_type === 'EXPENSE') {
                badgeColor = '#b91c1c';
                badgeBg = '#fee2e2';
                typeLabel = 'Expense';
              }

              return (
                <tr key={row.uid || row.id || idx} style={{ background: isExpense ? '#fff8f8' : '#fff' }}>
                  {isVisible('sno') && (
                    <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                  )}
                  {isVisible('date_time') && (
                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.transaction_date}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {row.entry_datetime ? new Date(row.entry_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                  )}
                  {isVisible('type') && (
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: badgeBg,
                        color: badgeColor,
                        padding: '0.2rem 0.55rem',
                        borderRadius: 20,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>
                        {isExpense ? '🔴' : '🟢'} {typeLabel}
                      </span>
                    </td>
                  )}
                  {isVisible('ref_no') && (
                    <td>
                      <code style={{
                        background: '#f1f5f9',
                        color: '#0f172a',
                        padding: '0.15rem 0.4rem',
                        borderRadius: 4,
                        fontSize: '0.82rem',
                        fontWeight: 700
                      }}>
                        {row.reference_number || '—'}
                      </code>
                    </td>
                  )}
                  {isVisible('party') && (
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                        {row.party_name || (isExpense ? 'General Expense' : 'Walk-in Customer')}
                      </div>
                    </td>
                  )}
                  {isVisible('payment_mode') && (
                    <td>
                      <span style={{
                        background: '#f8fafc',
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {row.payment_mode || 'cash'}
                      </span>
                    </td>
                  )}
                  {isVisible('bank') && (
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                      {row.bank_name ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.bank_name}</div>
                          {row.ref_number && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>UTR: {row.ref_number}</div>}
                        </div>
                      ) : row.ref_number ? (
                        <span style={{ fontFamily: 'monospace' }}>{row.ref_number}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                  )}
                  {isVisible('narration') && (
                    <td style={{ fontSize: '0.84rem', color: '#475569', maxWidth: 240, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={row.narration}>
                      {row.narration || '—'}
                    </td>
                  )}
                  {isVisible('income') && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!isExpense ? (
                        <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#16a34a' }}>
                          +₹{inr(numAmt)}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontWeight: 500 }}>—</span>
                      )}
                    </td>
                  )}
                  {isVisible('expense') && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isExpense ? (
                        <span style={{ fontSize: '0.96rem', fontWeight: 800, color: '#dc2626' }}>
                          -₹{inr(Math.abs(numAmt))}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontWeight: 500 }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={TRANSACTION_COLS.length} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                  <strong>No transactions match the selected filters.</strong>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Try clearing filters or changing the date range.</div>
                </td>
              </tr>
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
              {/* Row 1: Current Page Total (First Total) */}
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                {isVisible('sno') && <td style={{ textAlign: 'center', color: '#64748b' }}>📄</td>}
                {isVisible('date_time') && <td style={{ color: '#0f172a', fontWeight: 800 }}>PAGE TOTAL</td>}
                {isVisible('type') && <td></td>}
                {isVisible('ref_no') && <td></td>}
                {isVisible('party') && <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{pageTotals.count} on Page {page} of {totalPages}</td>}
                {isVisible('payment_mode') && <td></td>}
                {isVisible('bank') && <td></td>}
                {isVisible('narration') && <td style={{ textAlign: 'right', fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>Page {page} Total:</td>}
                {isVisible('income') && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', background: '#f0fdf4', borderLeft: '1px solid #bbf7d0', borderRight: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#16a34a' }}>
                      +₹{inr(pageTotals.income)}
                    </span>
                  </td>
                )}
                {isVisible('expense') && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', background: '#fef2f2', borderLeft: '1px solid #fecaca', borderRight: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#dc2626' }}>
                      -₹{inr(pageTotals.expense)}
                    </span>
                  </td>
                )}
              </tr>

              {/* Row 2: Grand Total across all pages */}
              <tr style={{ background: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
                {isVisible('sno') && <td style={{ textAlign: 'center', color: '#0f172a' }}>Σ</td>}
                {isVisible('date_time') && <td style={{ color: '#0f172a', fontWeight: 900 }}>GRAND TOTAL</td>}
                {isVisible('type') && <td></td>}
                {isVisible('ref_no') && <td></td>}
                {isVisible('party') && <td style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 700 }}>{total} Total Records</td>}
                {isVisible('payment_mode') && <td></td>}
                {isVisible('bank') && <td></td>}
                {isVisible('narration') && <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: '0.88rem' }}>Grand Total (All Pages):</td>}
                {isVisible('income') && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', background: '#dcfce7', borderLeft: '1.5px solid #86efac', borderRight: '1.5px solid #86efac' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#15803d' }}>
                      +₹{inr(totals.total_income)}
                    </span>
                  </td>
                )}
                {isVisible('expense') && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', background: '#fee2e2', borderLeft: '1.5px solid #fca5a5', borderRight: '1.5px solid #fca5a5' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#b91c1c' }}>
                      -₹{inr(totals.total_expenses)}
                    </span>
                  </td>
                )}
              </tr>

              {/* Row 3: Net Cashflow Balance Summary */}
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                <td
                  colSpan={
                    (isVisible('sno') ? 1 : 0) +
                    (isVisible('date_time') ? 1 : 0) +
                    (isVisible('type') ? 1 : 0) +
                    (isVisible('ref_no') ? 1 : 0) +
                    (isVisible('party') ? 1 : 0) +
                    (isVisible('payment_mode') ? 1 : 0) +
                    (isVisible('bank') ? 1 : 0) +
                    (isVisible('narration') ? 1 : 0)
                  }
                  style={{ textAlign: 'right', padding: '0.55rem 1rem', fontWeight: 700, fontSize: '0.88rem', color: '#94a3b8' }}
                >
                  OVERALL NET CASHFLOW BALANCE:
                </td>
                <td
                  colSpan={
                    (isVisible('income') ? 1 : 0) +
                    (isVisible('expense') ? 1 : 0)
                  }
                  style={{ textAlign: 'right', padding: '0.55rem 1rem', whiteSpace: 'nowrap' }}
                >
                  <span style={{
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    color: totals.net_balance >= 0 ? '#4ade80' : '#f87171'
                  }}>
                    ₹{inr(totals.net_balance)}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </TableContainer>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
            <span>Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              style={{ padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              style={{
                padding: '0.35rem 0.75rem',
                background: page <= 1 ? '#f1f5f9' : '#fff',
                color: page <= 1 ? '#94a3b8' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                cursor: page <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ‹ Prev
            </button>

            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', padding: '0 0.5rem' }}>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              style={{
                padding: '0.35rem 0.75rem',
                background: page >= totalPages ? '#f1f5f9' : '#fff',
                color: page >= totalPages ? '#94a3b8' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
