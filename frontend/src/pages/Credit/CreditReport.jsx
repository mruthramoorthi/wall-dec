import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCreditBills, getCreditSummary } from '../../api/credit.js';
import { getBill } from '../../api/bill.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import { openReceiptPdf } from '../../utils/printPdf.js';

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CREDIT_REPORT_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'bill_number', label: 'Bill No', defaultVisible: true },
  { key: 'bill_date', label: 'Bill Date', defaultVisible: true },
  { key: 'customer_name', label: 'Customer', defaultVisible: true },
  { key: 'mobile_number', label: 'Mobile', defaultVisible: true },
  { key: 'grand_total', label: 'Total Bill', defaultVisible: true },
  { key: 'total_paid', label: 'Total Paid', defaultVisible: true },
  { key: 'due_amount', label: 'Balance Due', defaultVisible: true },
  { key: 'due_date', label: 'Promised Due Date', defaultVisible: true },
  { key: 'status', label: 'Status / Overdue', defaultVisible: true },
  { key: 'narration', label: 'Narration / Note', defaultVisible: true },
  { key: 'action', label: 'Action', defaultVisible: true }
];

export default function CreditReport() {
  const navigate = useNavigate();

  const [summary, setSummary]   = useState(null);
  const [bills, setBills]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('all');
  const [loading, setLoading]   = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'credit_report_columns',
    CREDIT_REPORT_COLS
  );

  const [thermalBillData, setThermalBillData] = useState(null);
  const [showThermalModal, setShowThermalModal] = useState(false);

  const loadSummary = async () => {
    try {
      const res = await getCreditSummary();
      setSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBills = async (p = page, s = search, st = status) => {
    setLoading(true);
    try {
      const res = await listCreditBills(p, pageSize, { search: s, status: st });
      setBills(res.rows || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    loadBills(1, search, status);
  }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => {
      loadBills(1, search, status);
    }, 300);
    return () => clearTimeout(t);
  }, [search, status]); // eslint-disable-line

  const totalPages  = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord   = Math.min(page * pageSize, total);

  const visibleColCount = CREDIT_REPORT_COLS.filter((c) => isVisible(c.key)).length;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>📊 Customer Credit &amp; Due Report</h1>
        <button
          type="button"
          onClick={() => navigate('/credit-received')}
          style={{ background: '#16a34a', color: '#fff', fontWeight: 700, padding: '0.5rem 1rem', borderRadius: 7 }}
        >
          + Receive Credit Payment
        </button>
      </div>

      {/* ── KPI Summary Cards ── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Credit Given</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
              ₹{inr(summary.total_credit_extended)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Across all credit invoices</div>
          </div>

          <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #16a34a' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Collected</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', margin: '0.25rem 0' }}>
              ₹{inr(summary.total_recovered)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{summary.cleared_bills_count} bill(s) fully cleared</div>
          </div>

          <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding Balance Due</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', margin: '0.25rem 0' }}>
              ₹{inr(summary.total_outstanding_due)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{summary.pending_bills_count} pending credit bill(s)</div>
          </div>

          <div className="card" style={{ marginBottom: 0, borderLeft: '4px solid #dc2626' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Overdue Dues (Late)</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626', margin: '0.25rem 0' }}>
              ₹{inr(summary.total_overdue_amount)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>{summary.overdue_bills_count} overdue invoice(s)</div>
          </div>
        </div>
      )}

      {/* ── Status Tab Filter Pills ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => { setStatus('all'); loadBills(1, search, 'all'); }}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 20,
            border: 'none',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            background: status === 'all' ? '#0f172a' : '#f1f5f9',
            color: status === 'all' ? '#fff' : '#475569'
          }}
        >
          All Invoices
        </button>
        <button
          type="button"
          onClick={() => { setStatus('overdue'); loadBills(1, search, 'overdue'); }}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 20,
            border: 'none',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            background: status === 'overdue' ? '#dc2626' : '#fee2e2',
            color: status === 'overdue' ? '#fff' : '#b91c1c'
          }}
        >
          ⚠ Overdue Dues
        </button>
        <button
          type="button"
          onClick={() => { setStatus('pending'); loadBills(1, search, 'pending'); }}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 20,
            border: 'none',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            background: status === 'pending' ? '#d97706' : '#fef3c7',
            color: status === 'pending' ? '#fff' : '#92400e'
          }}
        >
          ⏳ Pending Dues
        </button>
        <button
          type="button"
          onClick={() => { setStatus('paid'); loadBills(1, search, 'paid'); }}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 20,
            border: 'none',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer',
            background: status === 'paid' ? '#16a34a' : '#dcfce7',
            color: status === 'paid' ? '#fff' : '#15803d'
          }}
        >
          ✓ Fully Cleared
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <input
          type="text"
          placeholder="Search by Bill No, customer name, mobile, note…"
          value={search}
          disabled={loading}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260, fontSize: '0.88rem' }}
        />
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          {total} record{total !== 1 ? 's' : ''}
        </span>
        <label className="records-per-page">
          Show&nbsp;
          <select value={pageSize} disabled={loading} onChange={(e) => { const ps = Number(e.target.value); setPageSize(ps); loadBills(1, search, status); }}>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={CREDIT_REPORT_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      {/* ── Table ── */}
      <TableContainer loading={loading} text="Loading credit ledger…" subtext="Calculating overdue bills and credit balances">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 45, textAlign: 'right' }}>S.No</th>}
              {isVisible('bill_number') && <th style={{ width: 105 }}>Bill No</th>}
              {isVisible('bill_date') && <th>Bill Date</th>}
              {isVisible('customer_name') && <th>Customer</th>}
              {isVisible('mobile_number') && <th>Mobile</th>}
              {isVisible('grand_total') && <th className="num-cell">Total Bill</th>}
              {isVisible('total_paid') && <th className="num-cell">Total Paid</th>}
              {isVisible('due_amount') && <th className="num-cell">Balance Due</th>}
              {isVisible('due_date') && <th>Promised Due Date</th>}
              {isVisible('status') && <th>Status / Overdue</th>}
              {isVisible('narration') && <th>Narration / Note</th>}
              {isVisible('action') && <th className="actions-th">Action</th>}
            </tr>
          </thead>
          <tbody>
            {bills.map((b, idx) => {
              const isOverdue = Number(b.overdue_days || 0) > 0 && Number(b.due_amount || 0) > 0;
              const isCleared = Number(b.due_amount || 0) <= 0;

              return (
                <tr key={b.bill_uid} style={{ background: isOverdue ? '#fff5f5' : isCleared ? '#f0fdf4' : '#fff' }}>
                  {isVisible('sno') && <td className="num-cell" style={{ textAlign: 'right', color: '#94a3b8' }}>{(page - 1) * pageSize + idx + 1}</td>}
                  {isVisible('bill_number') && (
                    <td>
                      <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        {b.bill_number || (b.bill_id ? `BILL-${String(b.bill_id).padStart(4, '0')}` : '—')}
                      </span>
                    </td>
                  )}
                  {isVisible('bill_date') && <td>{new Date(b.bill_datetime).toLocaleDateString('en-IN')}</td>}
                  {isVisible('customer_name') && <td style={{ fontWeight: 700, color: '#0f172a' }}>{b.customer_name}</td>}
                  {isVisible('mobile_number') && <td>{b.mobile_number}</td>}
                  {isVisible('grand_total') && <td className="num-cell">₹{inr(b.grand_total)}</td>}
                  {isVisible('total_paid') && <td className="num-cell" style={{ color: '#15803d', fontWeight: 600 }}>₹{inr(b.total_paid_so_far)}</td>}
                  {isVisible('due_amount') && (
                    <td className="num-cell" style={{ color: isCleared ? '#15803d' : '#dc2626', fontWeight: 800, fontSize: '0.94rem' }}>
                      ₹{inr(b.due_amount)}
                    </td>
                  )}
                  {isVisible('due_date') && (
                    <td style={{ fontWeight: 600, color: isOverdue ? '#b91c1c' : '#334155' }}>
                      {b.due_date ? new Date(b.due_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                  )}
                  {isVisible('status') && (
                    <td>
                      {isCleared ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: 5, fontWeight: 700, fontSize: '0.78rem' }}>
                          ✓ Cleared
                        </span>
                      ) : isOverdue ? (
                        <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.2rem 0.5rem', borderRadius: 5, fontWeight: 700, fontSize: '0.78rem' }}>
                          ⚠ {b.overdue_days} days late
                        </span>
                      ) : (
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: 5, fontWeight: 700, fontSize: '0.78rem' }}>
                          ⏳ Pending
                        </span>
                      )}
                    </td>
                  )}
                  {isVisible('narration') && (
                    <td style={{ color: '#475569', fontSize: '0.82rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.due_narration}>
                      {b.due_narration || '—'}
                    </td>
                  )}
                  {isVisible('action') && (
                    <td className="action-cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Print 58mm Thermal Bill PDF (Opens in new tab)"
                          disabled={loading}
                          onClick={() => openReceiptPdf(b.bill_uid, 'bill')}
                          style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '0.25rem 0.4rem', borderRadius: 4, fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          🖨️
                        </button>
                        {!isCleared ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => !loading && navigate(`/credit-received?bill_uid=${b.bill_uid}`)}
                            style={{
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.78rem',
                              background: '#0284c7',
                              color: '#fff',
                              fontWeight: 700,
                              border: 'none',
                              borderRadius: 5,
                              cursor: loading ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <span>💰</span> Receive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {bills.length === 0 && (
              <tr>
                <td colSpan={visibleColCount || 1} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                  {loading ? 'Loading credit report…' : 'No credit records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* ── Pagination Bar ── */}
      <div className={`pagination-bar ${loading ? 'is-loading' : ''}`} style={{ marginTop: '1rem' }}>
        <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
        <div className="pagination-controls">
          <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadBills(1, search, status)}>«</button>
          <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadBills(page - 1, search, status)}>‹</button>
          <span style={{ padding: '0 8px', fontWeight: 600, fontSize: '0.88rem' }}>{page}</span>
          <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadBills(page + 1, search, status)}>›</button>
          <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadBills(totalPages, search, status)}>»</button>
        </div>
      </div>
    </div>
  );
}
