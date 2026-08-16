import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import NumericInput from '../../components/NumericInput.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import CashDenominationModal from '../../components/CashDenominationModal.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import { openReceiptPdf } from '../../utils/printPdf.js';
import { listPaymentModes } from '../../api/paymentMode.js';
import { listBanks } from '../../api/bank.js';
import {
  listCreditBills,
  getCustomerAdvances,
  receiveCreditPayment,
  updateCreditReceipt,
  deleteCreditReceipt,
  listCreditReceipts
} from '../../api/credit.js';

const CREDIT_RECEIPT_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'bill_number', label: 'Bill No', defaultVisible: true },
  { key: 'receipt_date', label: 'Receipt Date', defaultVisible: true },
  { key: 'customer_name', label: 'Customer', defaultVisible: true },
  { key: 'mobile_number', label: 'Mobile', defaultVisible: true },
  { key: 'amount', label: 'Amount Received', defaultVisible: true },
  { key: 'payment_mode', label: 'Payment Details', defaultVisible: true },
  { key: 'narration', label: 'Narration', defaultVisible: true },
  { key: 'current_due', label: 'Current Due', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

const DEFAULT_PAYMENT_MODES = [
  { mode_code: 'cash', mode_name: 'Cash', is_cash: 1, is_bank_linked: 0 },
  { mode_code: 'bank', mode_name: 'Bank Transfer', is_cash: 0, is_bank_linked: 1 },
  { mode_code: 'upi', mode_name: 'UPI / QR', is_cash: 0, is_bank_linked: 1 },
  { mode_code: 'neft', mode_name: 'NEFT / RTGS', is_cash: 0, is_bank_linked: 1 },
  { mode_code: 'cheque', mode_name: 'Cheque', is_cash: 0, is_bank_linked: 1 },
  { mode_code: 'card', mode_name: 'Debit / Credit Card', is_cash: 0, is_bank_linked: 1 }
];

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function CreditReceived() {
  const [searchParams] = useSearchParams();
  const preselectBillUid = searchParams.get('bill_uid');

  // Pending credit bills
  const [pendingBills, setPendingBills]   = useState([]);
  const [selectedBill, setSelectedBill]   = useState(null);
  const [billSearch, setBillSearch]       = useState('');
  const [loadingBills, setLoadingBills]   = useState(false);

  // Customer advances
  const [customerAdvances, setCustomerAdvances] = useState([]);
  const [selectedAdvUid, setSelectedAdvUid]     = useState('');
  const [prebookAction, setPrebookAction]       = useState('keep_reserved'); // 'keep_reserved' | 'release_stock'

  // Master lists
  const [paymentModesList, setPaymentModesList] = useState(DEFAULT_PAYMENT_MODES);
  const [banksList, setBanksList]               = useState([]);

  // Form states (Create & Edit)
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [amount, setAmount]                 = useState('');
  const [paymentMode, setPaymentMode]       = useState('cash');
  const [receiptDate, setReceiptDate]       = useState(new Date().toISOString().slice(0, 10));
  const [refNumber, setRefNumber]           = useState('');
  const [bankUid, setBankUid]               = useState('');
  const [denominations, setDenominations]   = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState(null);
  const [changeReturned, setChangeReturned] = useState(null);
  const [showDenomModal, setShowDenomModal] = useState(false);

  const [narration, setNarration]           = useState('');
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState(null);
  const [success, setSuccess]               = useState(null);

  // Delete modal state
  const [deletingReceipt, setDeletingReceipt] = useState(null);
  const [deleteLoading, setDeleteLoading]     = useState(false);

  // 58mm Thermal Print Modal
  const [thermalReceiptData, setThermalReceiptData] = useState(null);
  const [showThermalModal, setShowThermalModal]     = useState(false);

  // Receipts history
  const [receipts, setReceipts]           = useState([]);
  const [receiptPage, setReceiptPage]     = useState(1);
  const [receiptTotal, setReceiptTotal]       = useState(0);
  const [receiptPageSize, setReceiptPageSize] = useState(15);
  const [receiptSearch, setReceiptSearch]     = useState('');
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  const {
    visibleColumns: receiptVisibleCols,
    toggleColumn: toggleReceiptCol,
    resetColumns: resetReceiptCols,
    isVisible: isReceiptColVisible
  } = useColumnVisibility('credit_receipt_columns', CREDIT_RECEIPT_COLS);

  const loadPendingBills = async (search = billSearch) => {
    setLoadingBills(true);
    try {
      const res = await listCreditBills(1, 100, { search, status: 'pending' });
      setPendingBills(res.rows || []);

      if (preselectBillUid && !selectedBill && !editingReceipt) {
        const found = (res.rows || []).find((b) => b.bill_uid === preselectBillUid);
        if (found) {
          pickBill(found);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBills(false);
    }
  };

  const loadReceipts = async (p = receiptPage, s = receiptSearch, ps = receiptPageSize) => {
    setLoadingReceipts(true);
    try {
      const res = await listCreditReceipts(p, ps, { search: s });
      setReceipts(res.rows || []);
      setReceiptTotal(res.total || 0);
      setReceiptPage(res.page || p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReceipts(false);
    }
  };

  useEffect(() => {
    loadPendingBills();
    loadReceipts(1);
    listPaymentModes(1, 100, { activeOnly: true })
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setPaymentModesList(res.data);
          setPaymentMode(res.data[0].mode_code || res.data[0].mode_name);
        }
      })
      .catch((e) => console.warn('Credit payment modes load error:', e));

    listBanks(1, 100, { all: true })
      .then((res) => {
        if (res?.data) setBanksList(res.data);
      })
      .catch((e) => console.warn('Credit banks load error:', e));
  }, []); // eslint-disable-line

  const currentModeObj = paymentModesList.find(
    (m) => m.mode_code === paymentMode || m.mode_name === paymentMode
  ) || { mode_code: paymentMode, mode_name: paymentMode, is_bank_linked: 0, is_cash: paymentMode === 'cash' ? 1 : 0 };

  const pickBill = async (b) => {
    setEditingReceipt(null);
    setSelectedBill(b);
    setAmount(String(b.due_amount || ''));
    setPaymentMode(paymentModesList[0]?.mode_code || 'cash');
    setRefNumber('');
    setBankUid('');
    setDenominations(null);
    setTenderedAmount(null);
    setChangeReturned(null);
    setSelectedAdvUid('');
    setPrebookAction('keep_reserved');
    setError(null);
    setSuccess(null);

    // Fetch customer advances
    try {
      const advRes = await getCustomerAdvances(b.customer_uid);
      const advList = advRes.data || [];
      setCustomerAdvances(advList);
      if (advList.length > 0) {
        setSelectedAdvUid(advList[0].uid);
      }
    } catch {
      setCustomerAdvances([]);
    }
  };

  const clearSelection = () => {
    setSelectedBill(null);
    setEditingReceipt(null);
    setCustomerAdvances([]);
    setSelectedAdvUid('');
    setAmount('');
    setRefNumber('');
    setBankUid('');
    setDenominations(null);
    setTenderedAmount(null);
    setChangeReturned(null);
    setNarration('');
    setError(null);
  };

  const startEditReceipt = (r) => {
    setSelectedBill(null);
    setCustomerAdvances([]);
    setEditingReceipt(r);
    setAmount(String(r.amount || ''));
    setPaymentMode(r.payment_mode || 'cash');
    setReceiptDate(r.receipt_date ? String(r.receipt_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setRefNumber(r.ref_number || '');
    setBankUid(r.bank_uid || '');
    setDenominations(r.denominations ? (typeof r.denominations === 'string' ? JSON.parse(r.denominations) : r.denominations) : null);
    setTenderedAmount(r.tendered_amount !== null && r.tendered_amount !== undefined ? Number(r.tendered_amount) : null);
    setChangeReturned(r.change_returned !== null && r.change_returned !== undefined ? Number(r.change_returned) : null);
    setNarration(r.narration || '');
    setError(null);
    setSuccess(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    clearSelection();
  };

  const selectedAdvance = customerAdvances.find((a) => a.uid === selectedAdvUid) || customerAdvances[0] || null;

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payAmt = Number(amount || 0);
    if (payAmt <= 0) { setError('Received amount must be greater than ₹0.'); return; }

    setSaving(true);
    try {
      if (editingReceipt) {
        // Edit flow
        const payload = {
          amount: payAmt,
          payment_mode: paymentMode === 'advance' ? 'advance' : (currentModeObj.mode_code || paymentMode),
          ref_number: refNumber ? refNumber.trim() : null,
          bank_uid: bankUid || null,
          denominations: denominations || null,
          tendered_amount: tenderedAmount !== null && tenderedAmount !== undefined ? Number(tenderedAmount) : null,
          change_returned: changeReturned !== null && changeReturned !== undefined ? Number(changeReturned) : null,
          narration: narration.trim(),
          receipt_date: receiptDate,
        };
        const res = await updateCreditReceipt(editingReceipt.receipt_uid, payload);
        setSuccess(`✓ Receipt updated successfully! Bill: ${editingReceipt.bill_number || ''}, Customer: ${editingReceipt.customer_name}, Remaining Due: ₹${inr(res.data?.remaining_due || 0)}.`);
        clearSelection();
      } else {
        // New Receipt flow
        if (!selectedBill) { setError('Please select a customer credit bill.'); setSaving(false); return; }
        if (payAmt > Number(selectedBill.due_amount)) {
          setError(`Amount cannot exceed the current outstanding due balance of ₹${inr(selectedBill.due_amount)}.`);
          setSaving(false);
          return;
        }

        if (paymentMode === 'advance') {
          if (!selectedAdvance) {
            setError('Please select an active customer advance or pre-booking.');
            setSaving(false);
            return;
          }
          if (payAmt > Number(selectedAdvance.amount)) {
            setError(`Amount cannot exceed available advance balance of ₹${inr(selectedAdvance.amount)}.`);
            setSaving(false);
            return;
          }
        }

        const payload = {
          bill_uid: selectedBill.bill_uid,
          amount: payAmt,
          payment_mode: paymentMode === 'advance' ? 'advance' : (currentModeObj.mode_code || paymentMode),
          advance_uid: paymentMode === 'advance' ? selectedAdvance.uid : null,
          prebook_action: prebookAction,
          ref_number: refNumber ? refNumber.trim() : null,
          bank_uid: bankUid || null,
          denominations: denominations || null,
          tendered_amount: tenderedAmount !== null && tenderedAmount !== undefined ? Number(tenderedAmount) : null,
          change_returned: changeReturned !== null && changeReturned !== undefined ? Number(changeReturned) : null,
          narration: narration.trim(),
          receipt_date: receiptDate,
        };

        const res = await receiveCreditPayment(payload);
        setSuccess(`✓ Received ₹${inr(payAmt)} against ${selectedBill.bill_number || 'Bill'} from ${selectedBill.customer_name}! Remaining due: ₹${inr(res.data?.remaining_due || 0)}.`);
        
        if (res.data?.receipt_uid) {
          openReceiptPdf(res.data.receipt_uid, 'credit');
        }

        clearSelection();
      }

      await loadPendingBills();
      await loadReceipts(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteReceipt = async () => {
    if (!deletingReceipt) return;
    setDeleteLoading(true);
    try {
      const res = await deleteCreditReceipt(deletingReceipt.receipt_uid);
      setSuccess(`✓ Credit receipt for ₹${inr(deletingReceipt.amount)} (Bill: ${deletingReceipt.bill_number || ''}) deleted. Amount has been REVERTED to customer "${deletingReceipt.customer_name}" (New Due: ₹${inr(res.new_due_amount)}).`);
      setDeletingReceipt(null);
      await loadPendingBills();
      await loadReceipts(1);
    } catch (err) {
      setError(err.message || 'Failed to delete receipt.');
      setDeletingReceipt(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalReceiptPages = Math.max(Math.ceil(receiptTotal / receiptPageSize), 1);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>💰 Credit Received Entry</h1>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Record, edit, and settle customer credit / due bills with bill numbers and payment tracking.
        </span>
      </div>

      {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* ── 2-Column POS Payment Collection Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(380px, 1fr)', gap: '1.25rem', alignItems: 'start', marginBottom: '2rem' }}>

        {/* ── Left Column: Select Pending Credit Bill ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.45rem', marginBottom: '0.75rem' }}>
            1. Select Pending Customer Credit Bill
          </h3>

          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Search by Bill No (e.g. BILL-0004), customer, mobile…"
              value={billSearch}
              onChange={(e) => {
                setBillSearch(e.target.value);
                loadPendingBills(e.target.value);
              }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingBills.map((b) => {
              const isSelected = selectedBill?.bill_uid === b.bill_uid;
              const isOverdue  = Number(b.overdue_days || 0) > 0;
              const hasAdvance = Number(b.customer_available_advance || 0) > 0;

              return (
                <div
                  key={b.bill_uid}
                  onClick={() => pickBill(b)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #0284c7' : isOverdue ? '1.5px solid #fecaca' : '1px solid #e2e8f0',
                    background: isSelected ? '#f0f9ff' : isOverdue ? '#fef2f2' : '#fafafa',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.1rem 0.45rem', borderRadius: 4, fontWeight: 700, fontFamily: 'monospace' }}>
                        {b.bill_number || `BILL-${String(b.bill_id || '').padStart(4, '0')}`}
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{b.customer_name}</strong>
                      <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.82rem' }}>({b.mobile_number})</span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Bill Date: {new Date(b.bill_datetime).toLocaleDateString('en-IN')} • Promised: <strong style={{ color: isOverdue ? '#b91c1c' : '#334155' }}>{b.due_date ? new Date(b.due_date).toLocaleDateString('en-IN') : '—'}</strong>
                    </div>
                    {b.due_narration && (
                      <div style={{ fontSize: '0.75rem', color: '#78350f', fontStyle: 'italic', marginTop: '0.1rem' }}>
                        Note: {b.due_narration}
                      </div>
                    )}
                    {hasAdvance && (
                      <div style={{ marginTop: '0.3rem' }}>
                        <span style={{ fontSize: '0.74rem', background: '#dbeafe', color: '#1d4ed8', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                          ✨ Advance Available: ₹{inr(b.customer_available_advance)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Due Balance</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#dc2626' }}>
                      ₹{inr(b.due_amount)}
                    </div>
                    {isOverdue && (
                      <span style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 700, background: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
                        ⚠ {b.overdue_days}d overdue
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {pendingBills.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 1rem', fontSize: '0.9rem' }}>
                {loadingBills ? 'Loading pending bills…' : '🎉 No pending credit bills found.'}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Payment Receipt Form (New or Edit) ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.45rem', marginBottom: '0.75rem' }}>
            {editingReceipt ? '✏️ 2. Edit Credit Receipt' : '2. Record Received Payment'}
          </h3>

          {editingReceipt ? (
            /* Edit Receipt Form */
            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', padding: '0.1rem 0.45rem', borderRadius: 4, fontWeight: 700, fontFamily: 'monospace' }}>
                      {editingReceipt.bill_number || `BILL-${String(editingReceipt.bill_id || '').padStart(4, '0')}`}
                    </span>
                    <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.95rem' }}>
                      {editingReceipt.customer_name}
                    </span>
                  </div>
                  <button type="button" onClick={cancelEdit} style={{ background: '#94a3b8', color: '#fff', fontSize: '0.75rem', padding: '0.2rem 0.5rem', border: 'none' }}>
                    Cancel
                  </button>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#1e3a8a' }}>
                  Total Bill: <strong>₹{inr(editingReceipt.grand_total)}</strong> • Mobile: <strong>{editingReceipt.mobile_number}</strong>
                </div>
              </div>

              {/* Amount to Edit */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  Receipt Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <NumericInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="0.00"
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '1.1rem', fontWeight: 700, padding: '0.5rem 0.75rem' }}
                />
              </div>

              {/* Payment Mode, Denomination, and Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                      Payment Mode
                    </label>
                    {currentModeObj.is_cash ? (
                      <button
                        type="button"
                        onClick={() => setShowDenomModal(true)}
                        style={{
                          padding: '0.15rem 0.4rem',
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        💵 Denomination
                      </button>
                    ) : null}
                  </div>
                  <SearchableSelect
                    options={paymentModesList.map((m) => ({
                      value: m.mode_code,
                      label: m.mode_name,
                      sublabel: m.is_bank_linked ? 'Bank Linked 🏦' : m.is_cash ? 'Cash Mode 💵' : ''
                    }))}
                    value={paymentMode}
                    onChange={(val) => setPaymentMode(val)}
                    placeholder="Select Payment Mode"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: (currentModeObj.is_bank_linked || banksList.length > 0) ? '1fr 1fr' : '1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Ref / Txn No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR / Cheque #"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {(currentModeObj.is_bank_linked || banksList.length > 0) && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Bank Account {currentModeObj.is_bank_linked ? <span style={{ color: '#ef4444' }}>*</span> : '(Optional)'}
                    </label>
                    <SearchableSelect
                      options={banksList.map((b) => ({
                        value: b.uid,
                        label: `${b.bank_name} (${b.bank_code})`,
                        sublabel: `Acc: ${b.account_number}`
                      }))}
                      value={bankUid}
                      onChange={(val) => setBankUid(val)}
                      placeholder="-- Select Bank Account --"
                    />
                  </div>
                )}
              </div>

              {changeReturned !== null && changeReturned > 0 && (
                <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.3rem 0.55rem', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                  💵 Cash Tendered: ₹{inr(tenderedAmount)} | Change Returned: ₹{inr(changeReturned)}
                </div>
              )}

              {/* Narration */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Narration / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via GPay / Cheque #12345"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    border: 'none',
                    borderRadius: 7,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Saving Changes…' : 'Update Receipt'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    padding: '0.65rem 1rem',
                    background: '#94a3b8',
                    color: '#fff',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 7
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : selectedBill ? (
            /* Create Receipt Form */
            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Selected Bill Info Summary */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '0.1rem 0.45rem', borderRadius: 4, fontWeight: 800, fontFamily: 'monospace' }}>
                      {selectedBill.bill_number || `BILL-${String(selectedBill.bill_id || '').padStart(4, '0')}`}
                    </span>
                    <span style={{ fontWeight: 700, color: '#166534', fontSize: '0.92rem' }}>
                      {selectedBill.customer_name}
                    </span>
                  </div>
                  <button type="button" onClick={clearSelection} style={{ background: '#cbd5e1', color: '#334155', fontSize: '0.75rem', padding: '0.2rem 0.5rem', border: 'none' }}>
                    Change
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.8rem', color: '#15803d' }}>
                  <div>Total Bill: <strong>₹{inr(selectedBill.grand_total)}</strong></div>
                  <div>Already Paid: <strong>₹{inr(selectedBill.total_paid_so_far)}</strong></div>
                  <div style={{ gridColumn: 'span 2', fontSize: '0.92rem', color: '#b91c1c', fontWeight: 700, borderTop: '1px dashed #86efac', paddingTop: '0.3rem', marginTop: '0.2rem' }}>
                    Current Due Balance: ₹{inr(selectedBill.due_amount)}
                  </div>
                </div>
              </div>

              {/* Customer Available Advance Prompt */}
              {customerAdvances.length > 0 && paymentMode !== 'advance' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.84rem' }}>
                      💡 Customer has available Advance balance!
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>
                      {customerAdvances.length} advance/pre-booking deposit found (Total: ₹{inr(customerAdvances.reduce((s, a) => s + Number(a.amount || 0), 0))}).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('advance')}
                    style={{ background: '#2563eb', color: '#fff', fontSize: '0.78rem', padding: '0.35rem 0.65rem', fontWeight: 700, borderRadius: 6, border: 'none', whiteSpace: 'nowrap' }}
                  >
                    Adjust Advance
                  </button>
                </div>
              )}

              {/* Payment Mode Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                      Payment Mode <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {currentModeObj.is_cash && paymentMode !== 'advance' ? (
                      <button
                        type="button"
                        onClick={() => setShowDenomModal(true)}
                        style={{
                          padding: '0.15rem 0.4rem',
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        💵 Denomination
                      </button>
                    ) : null}
                  </div>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontWeight: 700,
                      borderColor: paymentMode === 'advance' ? '#2563eb' : '#cbd5e1',
                      background: paymentMode === 'advance' ? '#eff6ff' : '#fff'
                    }}
                  >
                    {paymentModesList.map((m) => (
                      <option key={m.uid || m.mode_code} value={m.mode_code}>
                        {m.mode_name} {m.is_bank_linked ? '🏦' : m.is_cash ? '💵' : ''}
                      </option>
                    ))}
                    <option value="advance" style={{ fontWeight: 800, color: '#1e40af' }}>
                      ⚡ ADVANCE / PRE-BOOKING {customerAdvances.length > 0 ? `(₹${inr(customerAdvances.reduce((s, a) => s + Number(a.amount || 0), 0))})` : ''}
                    </option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {paymentMode !== 'advance' && (
                <div style={{ display: 'grid', gridTemplateColumns: (currentModeObj.is_bank_linked || banksList.length > 0) ? '1fr 1fr' : '1fr', gap: '0.65rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Ref / Txn No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR / Cheque #"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>

                  {(currentModeObj.is_bank_linked || banksList.length > 0) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        Bank Account {currentModeObj.is_bank_linked ? <span style={{ color: '#ef4444' }}>*</span> : '(Optional)'}
                      </label>
                      <select
                        value={bankUid}
                        onChange={(e) => setBankUid(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      >
                        <option value="">-- Select Bank Account --</option>
                        {banksList.map((b) => (
                          <option key={b.uid} value={b.uid}>
                            {b.bank_name} ({b.bank_code}) - {b.account_number}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {changeReturned !== null && changeReturned > 0 && paymentMode !== 'advance' && (
                <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.3rem 0.55rem', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                  💵 Cash Tendered: ₹{inr(tenderedAmount)} | Change Returned: ₹{inr(changeReturned)}
                </div>
              )}

              {/* ── ADVANCE / PRE-BOOKING ADJUSTMENT SECTION ── */}
              {paymentMode === 'advance' && (
                <div style={{ background: '#f8fafc', border: '1.5px solid #3b82f6', borderRadius: 10, padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.9rem' }}>
                      📋 Select Advance / Pre-booking Record
                    </span>
                    <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      {customerAdvances.length} record{customerAdvances.length !== 1 ? 's' : ''} available
                    </span>
                  </div>

                  {customerAdvances.length === 0 ? (
                    <div style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>
                      ⚠ No active advance or pre-booking balance found for this customer.
                    </div>
                  ) : (
                    <div>
                      <select
                        value={selectedAdvUid}
                        onChange={(e) => {
                          setSelectedAdvUid(e.target.value);
                          const adv = customerAdvances.find(a => a.uid === e.target.value);
                          if (adv) {
                            const maxPay = Math.min(Number(selectedBill.due_amount), Number(adv.amount));
                            setAmount(String(maxPay));
                          }
                        }}
                        style={{ width: '100%', boxSizing: 'border-box', fontWeight: 600, fontSize: '0.88rem' }}
                      >
                        {customerAdvances.map((adv) => (
                          <option key={adv.uid} value={adv.uid}>
                            {adv.is_prebook ? `[${adv.prebook_code || 'Pre-book'}]` : '[Advance]'} Available: ₹{inr(adv.amount)}
                            {adv.is_prebook ? ` • ${adv.total_pieces} pcs reserved` : ''} • Date: {new Date(adv.entry_datetime).toLocaleDateString('en-IN')}
                          </option>
                        ))}
                      </select>

                      {/* Selected Advance Info & Pre-booked Items Preview */}
                      {selectedAdvance && (
                        <div style={{ marginTop: '0.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#475569' }}>Available Advance Balance:</span>
                            <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>₹{inr(selectedAdvance.amount)}</strong>
                          </div>

                          {selectedAdvance.is_prebook && selectedAdvance.items?.length > 0 && (
                            <div style={{ marginTop: '0.4rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.4rem' }}>
                              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.2rem' }}>
                                Reserved Pre-booking Items ({selectedAdvance.total_pieces} pcs):
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {selectedAdvance.items.map((it, i) => (
                                  <span key={i} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                                    Design #{it.design_number}: {it.pieces} pcs
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pre-booking Stock Handling Option */}
                      {selectedAdvance?.is_prebook && (
                        <div style={{ marginTop: '0.5rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.65rem' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '0.35rem' }}>
                            📦 Pre-booked Items Handling:
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="prebook_action"
                                value="keep_reserved"
                                checked={prebookAction === 'keep_reserved'}
                                onChange={(e) => setPrebookAction(e.target.value)}
                                style={{ accentColor: '#2563eb' }}
                              />
                              <span>
                                <strong>Keep Items Reserved</strong> (Pre-book items remain reserved, even if advance is partial or becomes ₹0)
                              </span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="prebook_action"
                                value="release_stock"
                                checked={prebookAction === 'release_stock'}
                                onChange={(e) => setPrebookAction(e.target.value)}
                                style={{ accentColor: '#dc2626' }}
                              />
                              <span style={{ color: '#b91c1c' }}>
                                <strong>Release Items back to Stock</strong> (Cancel pre-booking reservation and return items to available inventory)
                              </span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Amount to Receive / Adjust */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    {paymentMode === 'advance' ? 'Amount to Adjust from Advance (₹)' : 'Received Amount (₹)'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {paymentMode === 'advance' && selectedAdvance && (
                    <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                      Max: ₹{inr(Math.min(Number(selectedBill.due_amount), Number(selectedAdvance.amount)))}
                    </span>
                  )}
                </div>
                <NumericInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="0.00"
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '1.1rem', fontWeight: 700, padding: '0.5rem 0.75rem' }}
                />
              </div>

              {/* Dynamic summary of remaining balances */}
              {amount && Number(amount) > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: paymentMode === 'advance' && selectedAdvance ? '1fr 1fr' : '1fr', gap: '0.5rem', background: '#f8fafc', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Remaining Bill Due: </span>
                    <strong style={{ color: Number(selectedBill.due_amount) - Number(amount) <= 0 ? '#16a34a' : '#dc2626' }}>
                      ₹{inr(Math.max(0, Number(selectedBill.due_amount) - Number(amount)))}
                    </strong>
                  </div>
                  {paymentMode === 'advance' && selectedAdvance && (
                    <div>
                      <span style={{ color: '#64748b' }}>Remaining Advance: </span>
                      <strong style={{ color: '#1e40af' }}>
                        ₹{inr(Math.max(0, Number(selectedAdvance.amount) - Number(amount)))}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Narration */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Receipt Narration / Note
                </label>
                <input
                  type="text"
                  placeholder={paymentMode === 'advance' ? `Adjusted from ${selectedAdvance?.prebook_code || 'Advance deposit'}` : 'e.g. Paid via GPay / Cheque #12345'}
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || (paymentMode === 'advance' && customerAdvances.length === 0)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: paymentMode === 'advance' ? '#2563eb' : '#16a34a',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  borderRadius: 7,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  marginTop: '0.35rem'
                }}
              >
                {saving ? 'Processing…' : paymentMode === 'advance' ? `✓ Adjust ₹${inr(amount)} from Advance & Settle` : `✓ Receive ₹${inr(amount)} & Settle`}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👈</div>
              <div style={{ fontWeight: 600, color: '#475569' }}>Please select a credit bill on the left to record payment.</div>
            </div>
          )}
        </div>

      </div>

      {/* ── Credit Receipts History Table ── */}
      <h2>Recent Credit Receipts Log</h2>
      <div className={`table-toolbar ${loadingReceipts ? 'is-loading' : ''}`}>
        <input
          type="text"
          placeholder="Search receipt log by Bill No, customer, mobile, narration…"
          value={receiptSearch}
          disabled={loadingReceipts}
          onChange={(e) => {
            setReceiptSearch(e.target.value);
            loadReceipts(1, e.target.value);
          }}
          style={{ minWidth: 280, fontSize: '0.88rem' }}
        />
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          {receiptTotal} receipt{receiptTotal !== 1 ? 's' : ''} recorded
        </span>
        <label className="records-per-page">
          Show&nbsp;
          <select value={receiptPageSize} disabled={loadingReceipts} onChange={(e) => { setReceiptPageSize(Number(e.target.value)); loadReceipts(1, receiptSearch, Number(e.target.value)); }}>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={CREDIT_RECEIPT_COLS}
          visibleColumns={receiptVisibleCols}
          onToggle={toggleReceiptCol}
          onReset={resetReceiptCols}
        />
      </div>

      <TableContainer loading={loadingReceipts} text="Loading credit receipts…" subtext="Fetching payment receipt history">
        <table className="data-table">
          <thead>
            <tr>
              {isReceiptColVisible('sno') && <th style={{ width: 45 }}>S.No</th>}
              {isReceiptColVisible('bill_number') && <th style={{ width: 105 }}>Bill No</th>}
              {isReceiptColVisible('receipt_date') && <th>Receipt Date</th>}
              {isReceiptColVisible('customer_name') && <th>Customer</th>}
              {isReceiptColVisible('mobile_number') && <th>Mobile</th>}
              {isReceiptColVisible('amount') && <th className="num-cell">Amount Received</th>}
              {isReceiptColVisible('payment_mode') && <th>Mode</th>}
              {isReceiptColVisible('narration') && <th>Narration</th>}
              {isReceiptColVisible('current_due') && <th className="num-cell">Current Due</th>}
              {isReceiptColVisible('status') && <th>Status</th>}
              {isReceiptColVisible('actions') && <th className="actions-th" style={{ width: 90 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {receipts.map((r, idx) => (
              <tr key={r.receipt_uid}>
                {isReceiptColVisible('sno') && <td style={{ textAlign: 'center', color: '#94a3b8' }}>{(receiptPage - 1) * receiptPageSize + idx + 1}</td>}
                {isReceiptColVisible('bill_number') && (
                  <td>
                    <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {r.bill_number || (r.bill_id ? `BILL-${String(r.bill_id).padStart(4, '0')}` : '—')}
                    </span>
                  </td>
                )}
                {isReceiptColVisible('receipt_date') && <td>{new Date(r.receipt_date || r.entry_datetime).toLocaleDateString('en-IN')}</td>}
                {isReceiptColVisible('customer_name') && <td style={{ fontWeight: 600 }}>{r.customer_name}</td>}
                {isReceiptColVisible('mobile_number') && <td>{r.mobile_number}</td>}
                {isReceiptColVisible('amount') && (
                  <td className="num-cell" style={{ fontWeight: 700, color: '#15803d' }}>
                    ₹{inr(r.amount)}
                  </td>
                )}
                {isReceiptColVisible('payment_mode') && (
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                      {r.payment_mode === 'advance' ? (
                        <span style={{ fontSize: '0.78rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700 }}>
                          ⚡ ADVANCE {r.prebook_code ? `(${r.prebook_code})` : ''}
                        </span>
                      ) : (
                        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, color: '#334155' }}>
                          {r.payment_mode}
                        </span>
                      )}
                      {r.bank_name && (
                        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                          🏦 {r.bank_name} {r.bank_code ? `(${r.bank_code})` : ''}
                        </span>
                      )}
                      {r.ref_number && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Ref: {r.ref_number}
                        </span>
                      )}
                      {r.change_returned > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                          Returned: ₹{inr(r.change_returned)}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {isReceiptColVisible('narration') && <td style={{ color: '#475569', fontSize: '0.84rem' }}>{r.narration || '—'}</td>}
                {isReceiptColVisible('current_due') && (
                  <td className="num-cell" style={{ fontWeight: 600, color: Number(r.current_due_amount || 0) > 0 ? '#b91c1c' : '#15803d' }}>
                    ₹{inr(r.current_due_amount || 0)}
                  </td>
                )}
                {isReceiptColVisible('status') && (
                  <td>
                    {Number(r.current_due_amount || 0) <= 0 ? (
                      <span style={{ color: '#15803d', background: '#dcfce7', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, fontSize: '0.75rem' }}>
                        ✓ Fully Cleared
                      </span>
                    ) : (
                      <span style={{ color: '#92400e', background: '#fef3c7', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700, fontSize: '0.75rem' }}>
                        ⏳ Partial Due
                      </span>
                    )}
                  </td>
                )}
                {isReceiptColVisible('actions') && (
                  <td className="action-cell">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Print 58mm Thermal PDF (Opens in new tab)"
                      disabled={loadingReceipts}
                      onClick={() => openReceiptPdf(r.receipt_uid, 'credit')}
                      style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '0.25rem 0.4rem', borderRadius: 4, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      🖨️
                    </button>
                    <button
                      type="button"
                      className="icon-btn edit-btn"
                      title="Edit Receipt"
                      disabled={loadingReceipts}
                      onClick={() => startEditReceipt(r)}
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-btn delete-btn"
                      title="Delete Receipt (Revert Amount to Due & Advance)"
                      disabled={loadingReceipts}
                      onClick={() => setDeletingReceipt(r)}
                    >
                      <IconTrash />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {receipts.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  {loadingReceipts ? 'Loading credit receipts…' : 'No credit receipts recorded yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {receiptTotal > 0 && (
        <div className={`pagination-bar ${loadingReceipts ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing page {receiptPage} of {totalReceiptPages}</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loadingReceipts || receiptPage <= 1} onClick={() => !loadingReceipts && loadReceipts(receiptPage - 1)}>‹</button>
            <span style={{ padding: '0 8px', fontWeight: 600, fontSize: '0.88rem' }}>{receiptPage}</span>
            <button className="page-btn" disabled={loadingReceipts || receiptPage >= totalReceiptPages} onClick={() => !loadingReceipts && loadReceipts(receiptPage + 1)}>›</button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingReceipt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', maxWidth: '440px', width: '92vw', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.35rem' }}>🗑️</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Delete Credit Receipt?</h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0 0 0.85rem 0', lineHeight: 1.5 }}>
              Are you sure you want to delete this credit receipt of <strong style={{ color: '#15803d' }}>₹{inr(deletingReceipt.amount)}</strong> for <strong>{deletingReceipt.customer_name}</strong> (Bill: <strong>{deletingReceipt.bill_number || '—'}</strong>)?
            </p>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.65rem 0.85rem', color: '#b45309', fontSize: '0.82rem', fontWeight: 600, textAlign: 'left', marginBottom: '1.25rem' }}>
              ⚠️ Reverting Balances: Deleting this receipt will automatically revert ₹{inr(deletingReceipt.amount)} back as outstanding due on {deletingReceipt.bill_number || 'the bill'}{deletingReceipt.advance_uid ? ' AND restore the deducted amount back to their advance deposit balance.' : '.'}
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setDeletingReceipt(null)}
                style={{ flex: 1, padding: '0.65rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 7, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteReceipt}
                disabled={deleteLoading}
                style={{ flex: 1, padding: '0.65rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700 }}
              >
                {deleteLoading ? 'Reverting…' : '🗑️ Revert & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash Denomination & Change Modal ── */}
      <CashDenominationModal
        isOpen={showDenomModal}
        requiredAmount={Number(amount) || 0}
        initialDenominations={denominations}
        initialTendered={tenderedAmount}
        onApply={({ denominations: d, tendered_amount: ta, change_returned: cr, amount: amt }) => {
          setDenominations(d);
          setTenderedAmount(ta);
          setChangeReturned(cr);
          if (amt > 0) setAmount(String(amt));
        }}
        onClose={() => setShowDenomModal(false)}
      />
    </div>
  );
}
