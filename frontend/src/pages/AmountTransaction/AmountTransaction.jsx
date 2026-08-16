import { useEffect, useState } from 'react';
import { amountTransactionReport } from '../../api/report.js';
import { listCustomers } from '../../api/customer.js';
import { listPaymentModes } from '../../api/paymentMode.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const inr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AMOUNT_TRANSACTION_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'bill_number', label: 'Bill No', defaultVisible: true },
  { key: 'date_time', label: 'Date & Time', defaultVisible: true },
  { key: 'customer_name', label: 'Customer', defaultVisible: true },
  { key: 'mobile_number', label: 'Mobile', defaultVisible: true },
  { key: 'stock_codes', label: 'Stock Codes', defaultVisible: true },
  { key: 'payment_modes', label: 'Payment Mode', defaultVisible: true },
  { key: 'pieces', label: 'Pieces', defaultVisible: true },
  { key: 'amount', label: 'Amount', defaultVisible: true }
];

export default function AmountTransaction() {
  // Table Data
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ total_pieces: 0, total_amount: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('entry_datetime');
  const [sortDir, setSortDir] = useState('desc');

  // Filter States
  const [search, setSearch]           = useState('');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [customerUid, setCustomerUid] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [minAmount, setMinAmount]     = useState('');
  const [maxAmount, setMaxAmount]     = useState('');
  const [customersList, setCustomersList] = useState([]);
  const [paymentModesList, setPaymentModesList] = useState([]);

  // Column Visibility with cross-device sync
  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'amount_transaction_columns',
    AMOUNT_TRANSACTION_COLS
  );

  useEffect(() => {
    listCustomers(1, 200)
      .then((res) => setCustomersList(res.rows || []))
      .catch(() => {});

    listPaymentModes(1, 100, { activeOnly: true })
      .then((res) => setPaymentModesList(res?.data || []))
      .catch(() => {});
  }, []);

  const load = async (p = page, ps = pageSize, opts = {}) => {
    setLoading(true);
    try {
      const q = opts.q !== undefined ? opts.q : search;
      const fd = opts.fromDate !== undefined ? opts.fromDate : fromDate;
      const td = opts.toDate !== undefined ? opts.toDate : toDate;
      const cUid = opts.customerUid !== undefined ? opts.customerUid : customerUid;
      const pm = opts.paymentMode !== undefined ? opts.paymentMode : paymentMode;
      const minA = opts.minAmount !== undefined ? opts.minAmount : minAmount;
      const maxA = opts.maxAmount !== undefined ? opts.maxAmount : maxAmount;
      const sb = opts.sortBy || sortBy;
      const sd = opts.sortDir || sortDir;

      const res = await amountTransactionReport(p, ps, {
        q,
        fromDate: fd,
        toDate: td,
        customerUid: cUid,
        paymentMode: pm,
        minAmount: minA,
        maxAmount: maxA,
        sortBy: sb,
        sortDir: sd
      });

      setRows(res.data || []);
      setTotals(res.totals || { total_pieces: 0, total_amount: 0 });
      setTotal(res.total || 0);
      setPage(res.page || p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, pageSize);
  }, [pageSize, fromDate, toDate, customerUid, paymentMode, minAmount, maxAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(1, pageSize, { q: search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (sortKey) => {
    if (loading) return;
    let nextDir = 'asc';
    if (sortBy === sortKey) {
      nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(sortKey);
    setSortDir(nextDir);
    load(1, pageSize, { sortBy: sortKey, sortDir: nextDir });
  };

  // Quick Date Preset Handlers
  const applyDatePreset = (preset) => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const dStr = toYMD(today);
      setFromDate(dStr);
      setToDate(dStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const dStr = toYMD(y);
      setFromDate(dStr);
      setToDate(dStr);
    } else if (preset === 'last7') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setFromDate(toYMD(d7));
      setToDate(toYMD(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(toYMD(firstDay));
      setToDate(toYMD(today));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setCustomerUid('');
    setPaymentMode('');
    setMinAmount('');
    setMaxAmount('');
    load(1, pageSize, {
      q: '',
      fromDate: '',
      toDate: '',
      customerUid: '',
      paymentMode: '',
      minAmount: '',
      maxAmount: ''
    });
  };

  const hasActiveFilters = search || fromDate || toDate || customerUid || paymentMode || minAmount || maxAmount;

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  // Pagination page numbers generator
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const visibleColCount = AMOUNT_TRANSACTION_COLS.filter((c) => isVisible(c.key)).length;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>📊 Amount Transaction</h1>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Comprehensive billing ledger, quantities, and transaction metrics
        </span>
      </div>

      {/* ── Basic Filters Card ── */}
      <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        {/* Row 1: Search + Customer Dropdown + Payment Mode + Amount Range */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.4fr) minmax(160px, 1.1fr) minmax(150px, 1fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr)', gap: '0.75rem', alignItems: 'end', marginBottom: '0.75rem' }}>
          {/* Search Box */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              🔍 Search Keywords
            </label>
            <input
              type="text"
              placeholder="Search Bill No, customer, mobile, stock code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.86rem', borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          {/* Customer Dropdown Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              👤 Customer Filter
            </label>
            <SearchableSelect
              options={[{ value: '', label: 'All Customers' }, ...customersList.map((c) => ({
                value: c.uid,
                label: c.customer_name,
                sublabel: `Mob: ${c.mobile_number}`
              }))]}
              value={customerUid}
              onChange={(val) => setCustomerUid(val)}
              placeholder="All Customers"
            />
          </div>

          {/* Payment Mode Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              💳 Payment Mode
            </label>
            <SearchableSelect
              options={[{ value: '', label: 'All Payment Modes' }, ...paymentModesList.map((m) => ({
                value: m.mode_code,
                label: m.mode_name
              }))]}
              value={paymentMode}
              onChange={(val) => setPaymentMode(val)}
              placeholder="All Payment Modes"
            />
          </div>

          {/* Min Amount */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              Min Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              placeholder="Min ₹"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.86rem', borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          {/* Max Amount */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              Max Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              placeholder="Max ₹"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.86rem', borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Row 2: Date Filters & Preset Buttons & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.65rem' }}>
          {/* Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 700, color: '#475569' }}>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ padding: '0.35rem 0.55rem', fontSize: '0.84rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 700, color: '#475569' }}>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ padding: '0.35rem 0.55rem', fontSize: '0.84rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Quick:</span>
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.25rem 0.55rem', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('yesterday')}
              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.25rem 0.55rem', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('last7')}
              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.25rem 0.55rem', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('thisMonth')}
              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.25rem 0.55rem', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('all')}
              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.25rem 0.55rem', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
            >
              All Time
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '0.25rem 0.65rem', borderRadius: 5, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700, marginLeft: '0.4rem' }}
              >
                ✕ Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Toolbar (Standard matching other pages) ── */}
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            {total} record{total !== 1 ? 's' : ''} found
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Standard Show N records dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', color: '#475569' }}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 600, fontSize: '0.86rem' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>records</span>
          </div>

          {/* Standard Column Visibility Button */}
          <ColumnVisibility
            columns={AMOUNT_TRANSACTION_COLS}
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onReset={resetColumns}
          />
        </div>
      </div>

      {/* ── Table with Sorting on Every Column wrapped in TableContainer ── */}
      <TableContainer loading={loading} text="Loading transactions…" subtext="Fetching transaction records">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && (
                <th
                  onClick={() => handleSort('bill_id')}
                  style={{ width: 50, cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by S.No"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>S.No</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'bill_id' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'bill_id' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}

              {isVisible('bill_number') && (
                <th
                  onClick={() => handleSort('bill_number')}
                  style={{ width: 110, cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by Bill No"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>Bill No</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'bill_number' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'bill_number' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}

              {isVisible('date_time') && (
                <th
                  onClick={() => handleSort('entry_datetime')}
                  style={{ cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by Date & Time"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>Date &amp; Time</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'entry_datetime' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'entry_datetime' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}

              {isVisible('customer_name') && (
                <th
                  onClick={() => handleSort('customer_name')}
                  style={{ cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by Customer Name"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>Customer</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'customer_name' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'customer_name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}

              {isVisible('mobile_number') && (
                <th
                  onClick={() => handleSort('mobile_number')}
                  style={{ cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by Mobile Number"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>Mobile</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'mobile_number' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'mobile_number' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}

              {isVisible('stock_codes') && (
                <th
                  onClick={() => handleSort('stock_codes')}
                  style={{ cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by Stock Codes"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>Stock Codes</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'stock_codes' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'stock_codes' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}

              {isVisible('payment_modes') && (
                <th>Payment Mode</th>
              )}

              {isVisible('pieces') && (
                <th
                  onClick={() => handleSort('total_pieces')}
                  className="num-cell"
                  style={{ cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by Total Pieces"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem', width: '100%' }}>
                    <span>Pieces</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'total_pieces' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'total_pieces' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}

              {isVisible('amount') && (
                <th
                  onClick={() => handleSort('net_amount')}
                  className="num-cell"
                  style={{ cursor: loading ? 'wait' : 'pointer', userSelect: 'none' }}
                  title="Sort by Amount"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem', width: '100%' }}>
                    <span>Amount</span>
                    <span style={{ fontSize: '0.75rem', color: sortBy === 'net_amount' ? '#2563eb' : '#94a3b8' }}>
                      {sortBy === 'net_amount' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.bill_uid}>
                {isVisible('sno') && (
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                )}

                {isVisible('bill_number') && (
                  <td>
                    <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {r.bill_number || `BILL-${String(r.bill_id || '').padStart(4, '0')}`}
                    </span>
                  </td>
                )}

                {isVisible('date_time') && (
                  <td style={{ fontSize: '0.84rem', color: '#475569' }}>
                    {new Date(r.entry_datetime).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                )}

                {isVisible('customer_name') && (
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>
                    {r.customer_name}
                  </td>
                )}

                {isVisible('mobile_number') && (
                  <td style={{ color: '#475569' }}>
                    {r.mobile_number}
                  </td>
                )}

                {isVisible('stock_codes') && (
                  <td style={{ fontWeight: 500 }}>
                    {r.stock_codes ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {r.stock_codes.split(',').map((code, cIdx) => (
                          <span key={cIdx} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.78rem' }}>
                            #{code.trim()}
                          </span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                )}

                {isVisible('payment_modes') && (
                  <td>
                    {r.payment_modes ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {r.payment_modes.split(',').map((pm, pmIdx) => (
                          <span key={pmIdx} style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            padding: '0.1rem 0.4rem',
                            borderRadius: 4,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                          }}>
                            {pm.trim()}
                          </span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                )}

                {isVisible('pieces') && (
                  <td className="num-cell" style={{ fontWeight: 700, color: '#0f172a' }}>
                    {Number(r.total_pieces).toLocaleString('en-IN')}
                  </td>
                )}

                {isVisible('amount') && (
                  <td className="num-cell" style={{ fontWeight: 800, color: '#15803d', fontSize: '0.95rem' }}>
                    ₹{inr(r.net_amount)}
                  </td>
                )}
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColCount || 1} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                  {loading ? 'Loading transactions…' : 'No transactions found.'}
                </td>
              </tr>
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                <td colSpan={Math.max(1, visibleColCount - (isVisible('pieces') ? 1 : 0) - (isVisible('amount') ? 1 : 0))} style={{ textAlign: 'right', color: '#334155' }}>
                  Grand Totals:
                </td>
                {isVisible('pieces') && (
                  <td className="num-cell" style={{ color: '#0f172a', fontWeight: 800 }}>
                    {Number(totals.total_pieces).toLocaleString('en-IN')}
                  </td>
                )}
                {isVisible('amount') && (
                  <td className="num-cell" style={{ color: '#15803d', fontWeight: 800, fontSize: '1rem' }}>
                    ₹{inr(totals.total_amount)}
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </TableContainer>

      {/* ── Standard Bottom Pagination Bar (Exact matching other pages) ── */}
      <div className={`pagination-bar ${loading ? 'is-loading' : ''}`} style={{ marginTop: '1rem' }}>
        <span className="pagination-info">
          Showing {startRecord}–{endRecord} of {total} records
        </span>

        <div className="pagination-controls">
          <button
            className="page-btn"
            disabled={loading || page <= 1}
            onClick={() => !loading && load(1, pageSize)}
            title="First Page"
          >
            «
          </button>
          <button
            className="page-btn"
            disabled={loading || page <= 1}
            onClick={() => !loading && load(page - 1, pageSize)}
            title="Previous Page"
          >
            ‹
          </button>

          {getPageNumbers().map((item, idx) =>
            item === '...' ? (
              <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
            ) : (
              <button
                key={item}
                className={`page-btn${item === page ? ' active' : ''}`}
                disabled={loading}
                onClick={() => !loading && load(item, pageSize)}
              >
                {item}
              </button>
            )
          )}

          <button
            className="page-btn"
            disabled={loading || page >= totalPages}
            onClick={() => !loading && load(page + 1, pageSize)}
            title="Next Page"
          >
            ›
          </button>
          <button
            className="page-btn"
            disabled={loading || page >= totalPages}
            onClick={() => !loading && load(totalPages, pageSize)}
            title="Last Page"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
