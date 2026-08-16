import { useState, useEffect } from 'react';
import SortableHeader from '../../components/SortableHeader.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import Pagination from '../../components/Pagination.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const STOCK_CHECK_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'picture', label: 'Picture', defaultVisible: true },
  { key: 'design_no', label: 'Design #', defaultVisible: true },
  { key: 'size', label: 'Size', defaultVisible: true },
  { key: 'inward_pcs', label: 'Inward Pcs', defaultVisible: true },
  { key: 'billed_pcs', label: 'Billed Pcs', defaultVisible: true },
  { key: 'available_pcs', label: 'Available Pcs', defaultVisible: true },
  { key: 'purchase_rate', label: 'Purchase / pc', defaultVisible: true },
  { key: 'sales_rate', label: 'Sales / pc', defaultVisible: true },
  { key: 'stock_value', label: 'Stock Value', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'history', label: 'Movement History', defaultVisible: true }
];

// Lightbox modal component for large picture preview
function LightboxModal({ imageUrl, designNumber, onClose }) {
  if (!imageUrl) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '1rem',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
            Design #{designNumber} Preview
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>
        <img
          src={imageUrl}
          alt={`Design #${designNumber}`}
          style={{
            maxWidth: '80vw',
            maxHeight: '75vh',
            objectFit: 'contain',
            borderRadius: '8px'
          }}
        />
      </div>
    </div>
  );
}

// Movement History Modal component
function MovementHistoryModal({ stockItem, fromDate, toDate, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stockItem) return;
    setLoading(true);
    let url = `http://localhost:4000/api/stock-check/history/${stockItem.stock_uid}`;
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (params.toString()) url += `?${params.toString()}`;

    fetch(url)
      .then((res) => res.json())
      .then((res) => {
        setHistory(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch movement history:', err);
        setLoading(false);
      });
  }, [stockItem, fromDate, toDate]);

  if (!stockItem) return null;

  const formatDateTime = (dt) => {
    if (!dt) return '-';
    const d = new Date(dt);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amt) => {
    if (amt === null || amt === undefined) return '-';
    return `₹${Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9990,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          width: '750px',
          maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', pb: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>
              Movement History — Design #{stockItem.design_number}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Size: {stockItem.width_ft} x {stockItem.height_ft} x {stockItem.thickness_mm}mm
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold', color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading history...</div>
        ) : history.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No movement records found for this date & time range.</div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Party / Reference</th>
                  <th style={{ textAlign: 'right' }}>Pieces</th>
                  <th style={{ textAlign: 'right' }}>Rate / Piece</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={h.uid + '-' + idx}>
                    <td>{idx + 1}</td>
                    <td>{formatDateTime(h.entry_datetime)}</td>
                    <td>
                      {h.type === 'inward' ? (
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 600, fontSize: '0.75rem' }}>
                          {h.is_opening ? 'Opening Stock' : 'Stock Inward'}
                        </span>
                      ) : (
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: h.is_home_bill ? '#f5f3ff' : '#fee2e2', color: h.is_home_bill ? '#6d28d9' : '#991b1b', fontWeight: 600, fontSize: '0.75rem' }}>
                          {h.is_home_bill ? '🏠 Home Bill' : 'Sales Bill'}
                        </span>
                      )}
                    </td>
                    <td>
                      {h.type === 'inward'
                        ? (h.dealer_name || (h.is_opening ? 'Opening Stock' : 'Direct Inward'))
                        : `${h.customer_name || 'Customer'} (${h.mobile_number || 'N/A'})${h.is_home_bill ? ' — 🏠 Home Bill' : ''}`}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: h.type === 'inward' ? '#15803d' : h.is_home_bill ? '#6d28d9' : '#b91c1c' }}>
                      {h.type === 'inward' ? `+${h.pieces}` : `-${h.pieces}`}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatCurrency(h.type === 'inward' ? h.purchase_rate : h.sales_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockCheck() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({
    total_designs: 0,
    total_inward_pcs: 0,
    total_billed_pcs: 0,
    available_pcs: 0,
    total_stock_value: 0
  });

  // Date & Time Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [sizeUid, setSizeUid] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown list options
  const [sizes, setSizes] = useState([]);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('design_number');
  const [sortDir, setSortDir] = useState('ASC');
  const [loading, setLoading] = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'stock_check_columns',
    STOCK_CHECK_COLS
  );

  // Lightbox & Modal state
  const [activePreviewUrl, setActivePreviewUrl] = useState(null);
  const [activePreviewDesign, setActivePreviewDesign] = useState(null);
  const [historyStockItem, setHistoryStockItem] = useState(null);

  // Fetch size options
  useEffect(() => {
    fetch('http://localhost:4000/api/size?pageSize=100')
      .then((res) => res.json())
      .then((res) => setSizes(res.data || []))
      .catch((err) => console.error('Failed to load sizes:', err));
  }, []);

  // Fetch Stock Check Report
  const loadReport = () => {
    setLoading(true);
    let url = `http://localhost:4000/api/stock-check/report?page=${page}&pageSize=${pageSize}&sort_by=${sortBy}&sort_dir=${sortDir}`;
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (search) params.append('search', search);
    if (sizeUid) params.append('size_uid', sizeUid);
    if (statusFilter) params.append('status', statusFilter);

    if (params.toString()) url += `&${params.toString()}`;

    fetch(url)
      .then((res) => res.json())
      .then((res) => {
        setData(res.data || []);
        setTotal(res.total || 0);
        if (res.summary) setSummary(res.summary);
      })
      .catch((err) => console.error('Failed to fetch stock check report:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [page, pageSize, sortBy, sortDir, fromDate, toDate, sizeUid, statusFilter]);

  // Handle Search Input (debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadReport();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Quick Preset Handlers
  const handlePreset = (type) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formatDt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    if (type === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
      setFromDate(formatDt(start));
      setToDate(formatDt(end));
    } else if (type === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59);
      setFromDate(formatDt(start));
      setToDate(formatDt(end));
    } else if (type === 'this_week') {
      const day = now.getDay() || 7; // Monday = 1
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0);
      setFromDate(formatDt(start));
      setToDate(formatDt(now));
    } else if (type === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0);
      setFromDate(formatDt(start));
      setToDate(formatDt(now));
    } else if (type === 'all_time') {
      setFromDate('');
      setToDate('');
    }
    setPage(1);
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setSearch('');
    setSizeUid('');
    setStatusFilter('');
    setPage(1);
  };

  const handleSort = (col) => {
    if (loading) return;
    if (sortBy === col) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortDir('ASC');
    }
  };

  const formatCurrency = (amt) => {
    if (amt === null || amt === undefined) return '-';
    return `₹${Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '1.25rem' }}>
        Stock Checking
      </h2>

      {/* ── Metric Summary Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Designs</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
            {summary.total_designs}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Total Inward Pcs</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>
            {summary.total_inward_pcs.toLocaleString('en-IN')} pcs
          </div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>Total Billed Pcs</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c', marginTop: '0.25rem' }}>
            {summary.total_billed_pcs.toLocaleString('en-IN')} pcs
          </div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 600, textTransform: 'uppercase' }}>Available Stock</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0284c7', marginTop: '0.25rem' }}>
            {summary.available_pcs.toLocaleString('en-IN')} pcs
          </div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>Stock Value (Purchase)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginTop: '0.25rem' }}>
            {formatCurrency(summary.total_stock_value)}
          </div>
        </div>
      </div>

      {/* ── Date and Time Filter Bar ── */}
      <div
        style={{
          background: '#fff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155', marginBottom: '0.75rem' }}>
          Date & Time Filters
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button type="button" className="btn-secondary" onClick={() => handlePreset('today')} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            Today
          </button>
          <button type="button" className="btn-secondary" onClick={() => handlePreset('yesterday')} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            Yesterday
          </button>
          <button type="button" className="btn-secondary" onClick={() => handlePreset('this_week')} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            This Week
          </button>
          <button type="button" className="btn-secondary" onClick={() => handlePreset('this_month')} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            This Month
          </button>
          <button type="button" className="btn-secondary" onClick={() => handlePreset('all_time')} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            All Time
          </button>
        </div>

        {/* Date Time Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center'
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 500 }}>
              From Date & Time
            </label>
            <input
              type="datetime-local"
              className="input-field"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 500 }}>
              To Date & Time
            </label>
            <input
              type="datetime-local"
              className="input-field"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 500 }}>
              Search Design #
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 11220"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 500 }}>
              Filter by Size
            </label>
            <SearchableSelect
              options={[{ value: '', label: 'All Sizes' }, ...sizes.map((s) => ({
                value: s.uid,
                label: `${s.width_ft} x ${s.height_ft} x ${s.thickness_mm}mm`
              }))]}
              value={sizeUid}
              onChange={(val) => { setSizeUid(val); setPage(1); }}
              placeholder="All Sizes"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 500 }}>
              Stock Availability
            </label>
            <SearchableSelect
              options={[
                { value: '', label: 'All Stock Items' },
                { value: 'in_stock', label: 'In Stock (> 0 pcs)' },
                { value: 'out_of_stock', label: 'Out of Stock (≤ 0 pcs)' },
                { value: 'low_stock', label: 'Low Stock (≤ 5 pcs)' }
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              placeholder="All Stock Items"
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="btn-secondary" onClick={handleClearFilters} style={{ fontSize: '0.85rem' }}>
            Clear All Filters
          </button>
        </div>
      </div>

      {/* ── Main Stock Check Table ── */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className={`table-toolbar ${loading ? 'is-loading' : ''}`} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem', flex: 1 }}>
            {total} design{total !== 1 ? 's' : ''} found
          </span>
          <label className="records-per-page">
            Show&nbsp;
            <select value={pageSize} disabled={loading} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            &nbsp;records
          </label>
          <ColumnVisibility
            columns={STOCK_CHECK_COLS}
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onReset={resetColumns}
          />
        </div>

        <TableContainer loading={loading} text="Loading stock records…" subtext="Calculating live inventory and movement metrics">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
            <thead>
              <tr>
                {/* S.No is the MANDATORY 1st column! */}
                {isVisible('sno') && <th style={{ width: '60px' }}>S.No</th>}
                {isVisible('picture') && <th style={{ width: '80px' }}>Picture</th>}
                {isVisible('design_no') && <SortableHeader label="Design #" sortKey="design_number" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
                {isVisible('size') && <th>Size</th>}
                {isVisible('inward_pcs') && <SortableHeader label="Inward Pcs" sortKey="inward_pcs" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
                {isVisible('billed_pcs') && <SortableHeader label="Billed Pcs" sortKey="billed_pcs" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
                {isVisible('available_pcs') && <SortableHeader label="Available Pcs" sortKey="available_pcs" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
                {isVisible('purchase_rate') && <SortableHeader label="Purchase / pc" sortKey="purchase_rate" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
                {isVisible('sales_rate') && <SortableHeader label="Sales / pc" sortKey="sales_rate" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
                {isVisible('stock_value') && <SortableHeader label="Stock Value" sortKey="stock_value" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} align="right" disabled={loading} />}
                {isVisible('status') && <th style={{ textAlign: 'center' }}>Status</th>}
                {isVisible('history') && <th style={{ textAlign: 'center' }}>Movement History</th>}
              </tr>
            </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No stock records matched your filter criteria.
                </td>
              </tr>
            ) : (
              data.map((r, idx) => {
                const sNo = (page - 1) * pageSize + idx + 1;
                const imgUrl = r.image_filename ? `/images/${r.image_filename}` : null;
                const available = Number(r.available_pcs);

                return (
                  <tr key={r.stock_uid}>
                    {isVisible('sno') && <td>{sNo}</td>}
                    {isVisible('picture') && (
                      <td>
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={`Design #${r.design_number}`}
                            onClick={() => {
                              setActivePreviewUrl(imgUrl);
                              setActivePreviewDesign(r.design_number);
                            }}
                            style={{
                              width: '42px',
                              height: '42px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: '1px solid #cbd5e1'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#94a3b8',
                              fontSize: '0.75rem'
                            }}
                          >
                            No img
                          </div>
                        )}
                      </td>
                    )}
                    {isVisible('design_no') && <td style={{ fontWeight: 700, color: '#0f172a' }}>#{r.design_number}</td>}
                    {isVisible('size') && (
                      <td>
                        {r.width_ft} x {r.height_ft} x {r.thickness_mm}mm
                      </td>
                    )}
                    {isVisible('inward_pcs') && (
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#166534' }}>
                        {Number(r.total_inward_pcs).toLocaleString('en-IN')}
                      </td>
                    )}
                    {isVisible('billed_pcs') && (
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#991b1b' }}>
                        {Number(r.total_billed_pcs).toLocaleString('en-IN')}
                      </td>
                    )}
                    {isVisible('available_pcs') && (
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                        <span
                          style={{
                            color: available > 0 ? '#0284c7' : available === 0 ? '#64748b' : '#dc2626'
                          }}
                        >
                          {available.toLocaleString('en-IN')}
                        </span>
                      </td>
                    )}
                    {isVisible('purchase_rate') && <td style={{ textAlign: 'right' }}>{formatCurrency(r.avg_purchase_rate_per_piece)}</td>}
                    {isVisible('sales_rate') && <td style={{ textAlign: 'right' }}>{formatCurrency(r.sales_price_per_piece)}</td>}
                    {isVisible('stock_value') && <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(r.stock_value)}</td>}
                    {isVisible('status') && (
                      <td style={{ textAlign: 'center' }}>
                        {available > 5 ? (
                          <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#dcfce7', color: '#15803d', fontWeight: 600, fontSize: '0.75rem' }}>
                            In Stock
                          </span>
                        ) : available > 0 ? (
                          <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: '0.75rem' }}>
                            Low Stock
                          </span>
                        ) : (
                          <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', background: '#fee2e2', color: '#b91c1c', fontWeight: 600, fontSize: '0.75rem' }}>
                            Out of Stock
                          </span>
                        )}
                      </td>
                    )}
                    {isVisible('history') && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setHistoryStockItem(r)}
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        >
                          View History
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* Pagination at bottom */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
      />
    </div>

      {/* Lightbox Image Preview Modal */}
      <LightboxModal
        imageUrl={activePreviewUrl}
        designNumber={activePreviewDesign}
        onClose={() => {
          setActivePreviewUrl(null);
          setActivePreviewDesign(null);
        }}
      />

      {/* Movement History Modal */}
      {historyStockItem && (
        <MovementHistoryModal
          stockItem={historyStockItem}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setHistoryStockItem(null)}
        />
      )}
    </div>
  );
}
