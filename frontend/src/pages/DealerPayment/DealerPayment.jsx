import React, { useState, useEffect, useCallback } from 'react';
import {
  listDealerCreditPurchases,
  recordDealerPayment,
  listDealerPayments,
  deleteDealerPayment,
  getDealerCreditSummary
} from '../../api/dealerPayment.js';
import { listDealers } from '../../api/dealer.js';
import { listBanks } from '../../api/bank.js';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import './DealerPayment.css';

const inr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DealerPayment() {
  const [activeTab, setActiveTab] = useState('credit_inwards'); // 'credit_inwards' | 'payment_history'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending'); // 'all' | 'pending' | 'partially_paid' | 'paid' | 'overdue'
  const [dealerUid, setDealerUid] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // Data lists
  const [inwards, setInwards] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [summary, setSummary] = useState({
    total_purchases_amount: 0,
    total_paid_amount: 0,
    total_outstanding_due: 0,
    total_overdue_amount: 0,
    pending_purchases_count: 0,
    overdue_purchases_count: 0
  });

  // Payment Modal State
  const [selectedInward, setSelectedInward] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash'); // 'cash' | 'bank' | 'gpay' | 'cheque'
  const [payBankUid, setPayBankUid] = useState('');
  const [payRefNumber, setPayRefNumber] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNarration, setPayNarration] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Load static masters (Dealers & Banks)
  useEffect(() => {
    (async () => {
      try {
        const [dRes, bRes] = await Promise.all([
          listDealers(1, 200),
          listBanks(1, 100)
        ]);
        setDealers(dRes.data || []);
        setBanks(bRes.data || []);
      } catch (err) {
        console.warn('Could not load dealers/banks:', err);
      }
    })();
  }, []);

  // Fetch summary metrics
  const fetchSummary = useCallback(async () => {
    try {
      const res = await getDealerCreditSummary();
      if (res.data) setSummary(res.data);
    } catch (err) {
      console.warn('Could not fetch credit summary:', err);
    }
  }, []);

  // Fetch Inward Credit Purchases
  const fetchCreditInwards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDealerCreditPurchases({
        page,
        pageSize,
        search,
        status,
        dealer_uid: dealerUid || undefined
      });
      setInwards(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to fetch credit purchase records');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, dealerUid]);

  // Fetch Payment History
  const fetchPaymentHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDealerPayments({
        page,
        pageSize,
        search,
        dealer_uid: dealerUid || undefined
      });
      setPayments(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to fetch dealer payments history');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, dealerUid]);

  useEffect(() => {
    fetchSummary();
    if (activeTab === 'credit_inwards') {
      fetchCreditInwards();
    } else {
      fetchPaymentHistory();
    }
  }, [activeTab, fetchSummary, fetchCreditInwards, fetchPaymentHistory]);

  const openPaymentModal = (inward) => {
    setSelectedInward(inward);
    setPayAmount(String(inward.due_amount || ''));
    setPayMode('cash');
    setPayBankUid(banks[0]?.uid || '');
    setPayRefNumber('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNarration(`Payment against Inward #${inward.inward_number} - ${inward.dealer_name}`);
  };

  const closePaymentModal = () => {
    setSelectedInward(null);
    setPayAmount('');
    setPayRefNumber('');
    setPayNarration('');
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInward) return;

    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid payment amount greater than 0');
      return;
    }
    if (amt > Number(selectedInward.due_amount)) {
      alert(`Payment amount (₹${inr(amt)}) cannot exceed remaining due (₹${inr(selectedInward.due_amount)})`);
      return;
    }

    setSubmittingPayment(true);
    try {
      await recordDealerPayment({
        inward_uid: selectedInward.inward_uid,
        dealer_uid: selectedInward.dealer_uid,
        amount: amt,
        payment_mode: payMode,
        bank_uid: (payMode !== 'cash') ? payBankUid : null,
        ref_number: payRefNumber || null,
        payment_date: payDate,
        narration: payNarration
      });

      setSuccessMsg(`✓ Successfully recorded payment of ₹${inr(amt)} to ${selectedInward.dealer_name}`);
      setTimeout(() => setSuccessMsg(null), 4500);

      closePaymentModal();
      fetchSummary();
      fetchCreditInwards();
    } catch (err) {
      alert('Failed to record payment: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (uid, voucherNo, amt) => {
    if (!window.confirm(`Are you sure you want to delete payment voucher ${voucherNo} (₹${inr(amt)})? This will restore the dealer outstanding due balance and void the journal voucher.`)) {
      return;
    }

    try {
      await deleteDealerPayment(uid);
      setSuccessMsg(`✓ Deleted payment voucher ${voucherNo} and restored balance.`);
      setTimeout(() => setSuccessMsg(null), 4500);
      fetchSummary();
      fetchPaymentHistory();
    } catch (err) {
      alert('Failed to delete payment: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="dealer-payment-container">
      {/* Header */}
      <div className="dp-header">
        <div className="dp-title-group">
          <h1>Dealer Payments (Accounts Payable)</h1>
          <p className="dp-subtitle">Track supplier purchases, credit balances, and disburse payment settlements</p>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '0.85rem 1.25rem', borderRadius: 8, marginBottom: '1.25rem', fontWeight: 700, fontSize: '0.9rem' }}>
          {successMsg}
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '0.85rem 1.25rem', borderRadius: 8, marginBottom: '1.25rem', fontWeight: 700, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* KPI Metrics */}
      <div className="dp-metrics-grid">
        <div className="dp-metric-card">
          <span className="dp-metric-title">Total Purchases (Credit)</span>
          <span className="dp-metric-val purple">₹{inr(summary.total_purchases_amount)}</span>
        </div>
        <div className="dp-metric-card">
          <span className="dp-metric-title">Total Paid to Dealers</span>
          <span className="dp-metric-val green">₹{inr(summary.total_paid_amount)}</span>
        </div>
        <div className="dp-metric-card">
          <span className="dp-metric-title">Outstanding Dues (Payable)</span>
          <span className="dp-metric-val red">₹{inr(summary.total_outstanding_due)}</span>
        </div>
        <div className="dp-metric-card">
          <span className="dp-metric-title">Overdue Inwards</span>
          <span className="dp-metric-val blue">
            {summary.overdue_purchases_count || 0} Inwards (₹{inr(summary.total_overdue_amount)})
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="dp-tabs-nav">
        <button
          type="button"
          className={`dp-tab-btn ${activeTab === 'credit_inwards' ? 'active' : ''}`}
          onClick={() => { setActiveTab('credit_inwards'); setPage(1); }}
        >
          📋 Dealer Credit Inwards & Dues
        </button>
        <button
          type="button"
          className={`dp-tab-btn ${activeTab === 'payment_history' ? 'active' : ''}`}
          onClick={() => { setActiveTab('payment_history'); setPage(1); }}
        >
          💳 Payment History & Vouchers
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="dp-controls-card">
        <div className="dp-filters-left">
          <input
            type="text"
            className="dp-search-input"
            placeholder={activeTab === 'credit_inwards' ? 'Search by Inward #, Dealer, Design #…' : 'Search by Voucher #, Dealer, Ref #…'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <select
            className="dp-select-input"
            value={dealerUid}
            onChange={(e) => { setDealerUid(e.target.value); setPage(1); }}
          >
            <option value="">All Dealers</option>
            {dealers.map((d) => (
              <option key={d.uid} value={d.uid}>{d.dealer_name}</option>
            ))}
          </select>

          {activeTab === 'credit_inwards' && (
            <div className="dp-status-pills">
              <button
                type="button"
                className={`dp-pill-btn ${status === 'all' ? 'active' : ''}`}
                onClick={() => { setStatus('all'); setPage(1); }}
              >
                All
              </button>
              <button
                type="button"
                className={`dp-pill-btn ${status === 'pending' ? 'active' : ''}`}
                onClick={() => { setStatus('pending'); setPage(1); }}
              >
                Pending Dues
              </button>
              <button
                type="button"
                className={`dp-pill-btn ${status === 'overdue' ? 'active' : ''}`}
                onClick={() => { setStatus('overdue'); setPage(1); }}
              >
                Overdue
              </button>
              <button
                type="button"
                className={`dp-pill-btn ${status === 'paid' ? 'active' : ''}`}
                onClick={() => { setStatus('paid'); setPage(1); }}
              >
                Fully Cleared
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View: Credit Inwards List */}
      {activeTab === 'credit_inwards' && (
        <TableContainer loading={loading} text="Loading credit purchase records…" subtext="Calculating dealer accounts payable balances">
          <div className="dp-table-card">
            <table className="dp-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>S.No</th>
                  <th>Inward #</th>
                  <th>Date</th>
                  <th>Dealer / Supplier</th>
                  <th>Design / Items</th>
                  <th style={{ textAlign: 'right' }}>Total Purchase</th>
                  <th style={{ textAlign: 'right' }}>Paid So Far</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                  <th>Promised Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {inwards.map((row, idx) => {
                  const isOverdue = Number(row.overdue_days || 0) > 0 && Number(row.due_amount || 0) > 0;
                  const isCleared = Number(row.due_amount || 0) <= 0;

                  return (
                    <tr key={row.inward_uid}>
                      <td>{(page - 1) * pageSize + idx + 1}</td>
                      <td>
                        <strong style={{ color: '#2563eb' }}>{row.inward_number}</strong>
                      </td>
                      <td>{row.inward_datetime ? new Date(row.inward_datetime).toLocaleDateString('en-IN') : '—'}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.dealer_name}</div>
                        {row.dealer_mobile && <small style={{ color: '#64748b' }}>📞 {row.dealer_mobile}</small>}
                      </td>
                      <td>
                        <span>{row.design_number ? `Design #${row.design_number}` : 'Stock Inward'}</span>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.pieces} pcs</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{inr(row.total_purchase_amount)}</td>
                      <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>₹{inr(row.paid_amount)}</td>
                      <td style={{ textAlign: 'right', color: isCleared ? '#64748b' : '#dc2626', fontWeight: 800 }}>
                        ₹{inr(row.due_amount)}
                      </td>
                      <td>
                        {row.due_date ? (
                          <span style={{ color: isOverdue ? '#dc2626' : '#1e293b', fontWeight: isOverdue ? 800 : 500 }}>
                            {new Date(row.due_date).toLocaleDateString('en-IN')}
                            {isOverdue && <span style={{ marginLeft: 4, color: '#dc2626', fontSize: '0.75rem' }}>({row.overdue_days}d overdue)</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`dp-status-badge ${row.credit_status || (isCleared ? 'paid' : 'unpaid')}`}>
                          {row.credit_status === 'partially_paid' ? 'Partially Paid' : (isCleared ? 'Paid' : 'Unpaid')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {!isCleared ? (
                          <button
                            type="button"
                            className="dp-btn-pay"
                            onClick={() => openPaymentModal(row)}
                          >
                            💳 Pay Dues
                          </button>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>✓ Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {inwards.length === 0 && (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      No dealer credit purchase records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TableContainer>
      )}

      {/* View: Payment History */}
      {activeTab === 'payment_history' && (
        <TableContainer loading={loading} text="Loading payment vouchers…" subtext="Fetching accounts payable disbursement history">
          <div className="dp-table-card">
            <table className="dp-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>S.No</th>
                  <th>Voucher #</th>
                  <th>Payment Date</th>
                  <th>Dealer / Supplier</th>
                  <th>Inward Ref</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                  <th>Payment Mode</th>
                  <th>Bank / Ref #</th>
                  <th>Narration</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={p.payment_uid}>
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td>
                      <strong style={{ color: '#7c3aed' }}>{p.payment_voucher_no}</strong>
                    </td>
                    <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.dealer_name}</div>
                      {p.dealer_mobile && <small style={{ color: '#64748b' }}>📞 {p.dealer_mobile}</small>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#2563eb' }}>{p.inward_number}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                      ₹{inr(p.amount)}
                    </td>
                    <td>
                      <span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '0.78rem' }}>
                        {p.payment_mode}
                      </span>
                    </td>
                    <td>
                      {p.bank_name ? (
                        <span>{p.bank_name} {p.ref_number ? `(Ref: ${p.ref_number})` : ''}</span>
                      ) : (
                        p.ref_number ? `Ref: ${p.ref_number}` : 'Cash Counter'
                      )}
                    </td>
                    <td>{p.narration || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(p.payment_uid, p.payment_voucher_no, p.amount)}
                        style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.35rem 0.65rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}
                        title="Delete voucher and restore outstanding balance"
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      No payment disbursement vouchers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TableContainer>
      )}

      {/* Make Payment Modal */}
      {selectedInward && (
        <div className="dp-modal-overlay" onClick={closePaymentModal}>
          <div className="dp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="dp-modal-header">
              <h3 className="dp-modal-title">Disburse Dealer Payment</h3>
              <button type="button" className="dp-modal-close" onClick={closePaymentModal}>✕</button>
            </div>

            {/* Inward Details Summary */}
            <div className="dp-inward-summary-card">
              <div className="dp-summary-row">
                <span style={{ color: '#64748b' }}>Dealer:</span>
                <strong>{selectedInward.dealer_name}</strong>
              </div>
              <div className="dp-summary-row">
                <span style={{ color: '#64748b' }}>Inward Purchase:</span>
                <span>{selectedInward.inward_number}</span>
              </div>
              <div className="dp-summary-row">
                <span style={{ color: '#64748b' }}>Total Purchase:</span>
                <span>₹{inr(selectedInward.total_purchase_amount)}</span>
              </div>
              <div className="dp-summary-row">
                <span style={{ color: '#64748b' }}>Already Paid:</span>
                <span style={{ color: '#16a34a' }}>₹{inr(selectedInward.paid_amount)}</span>
              </div>
              <div className="dp-summary-row bold">
                <span>Outstanding Balance Due:</span>
                <span style={{ color: '#dc2626' }}>₹{inr(selectedInward.due_amount)}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="dp-form-group">
                <label>Payment Amount (₹)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedInward.due_amount}
                    className="dp-form-input"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    placeholder="Enter amount to pay"
                  />
                  <button
                    type="button"
                    style={{ background: '#e0e7ff', color: '#3730a3', border: 'none', padding: '0 0.85rem', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => setPayAmount(String(selectedInward.due_amount))}
                  >
                    Pay Full Due
                  </button>
                </div>
              </div>

              <div className="dp-form-group">
                <label>Payment Mode</label>
                <select
                  className="dp-form-select"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                >
                  <option value="cash">Cash (1010)</option>
                  <option value="bank">Bank Transfer / NEFT / RTGS</option>
                  <option value="gpay">UPI / GPay / PhonePe</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              {payMode !== 'cash' && (
                <div className="dp-form-group">
                  <label>Disbursement Bank Account</label>
                  <select
                    className="dp-form-select"
                    value={payBankUid}
                    onChange={(e) => setPayBankUid(e.target.value)}
                    required
                  >
                    <option value="">Select Bank Account</option>
                    {banks.map((b) => (
                      <option key={b.uid} value={b.uid}>
                        {b.bank_name} ({b.account_number ? `A/C: ${b.account_number.slice(-4)}` : b.bank_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {payMode !== 'cash' && (
                <div className="dp-form-group">
                  <label>Cheque / UTR / Reference #</label>
                  <input
                    type="text"
                    className="dp-form-input"
                    placeholder="e.g. UTR12345678 or Cheque #445511"
                    value={payRefNumber}
                    onChange={(e) => setPayRefNumber(e.target.value)}
                  />
                </div>
              )}

              <div className="dp-form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  className="dp-form-input"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>

              <div className="dp-form-group">
                <label>Narration / Notes</label>
                <input
                  type="text"
                  className="dp-form-input"
                  placeholder="e.g. Cleared 2nd installment of inward"
                  value={payNarration}
                  onChange={(e) => setPayNarration(e.target.value)}
                />
              </div>

              <div className="dp-modal-actions">
                <button type="button" className="dp-btn-cancel" onClick={closePaymentModal} disabled={submittingPayment}>
                  Cancel
                </button>
                <button type="submit" className="dp-btn-submit" disabled={submittingPayment}>
                  {submittingPayment ? 'Recording...' : `Disburse ₹${inr(payAmount || 0)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
