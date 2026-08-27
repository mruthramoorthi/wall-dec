import { useState, useEffect } from 'react';
import { listAdvances, createAdvance, updateAdvance, deleteAdvance, getAdvance } from '../../api/advance.js';
import { searchCustomers, createCustomer } from '../../api/customer.js';
import { byDesignNumber } from '../../api/stock.js';
import { listPaymentModes } from '../../api/paymentMode.js';
import { listBanks } from '../../api/bank.js';
import NumericInput from '../../components/NumericInput.jsx';
import ImageMatchPicker from '../../components/ImageMatchPicker.jsx';
import CashDenominationModal from '../../components/CashDenominationModal.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { openReceiptPdf } from '../../utils/printPdf.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import { generateClientUid } from '../../utils/uid.js';

const ADVANCE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'customer_name', label: 'Customer', defaultVisible: true },
  { key: 'mobile_number', label: 'Mobile', defaultVisible: true },
  { key: 'type', label: 'Type / Reservation', defaultVisible: true },
  { key: 'amount', label: 'Advance Paid', defaultVisible: true },
  { key: 'payment_mode', label: 'Payment Details', defaultVisible: true },
  { key: 'notes', label: 'Notes / Remarks', defaultVisible: true },
  { key: 'date_time', label: 'Date & Time', defaultVisible: true },
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

function inr(n) {
  const num = Number(n || 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function DeleteModal({ advanceInfo, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: '#b91c1c' }}>Confirm Deletion</h3>
        <p style={{ margin: '0 0 1.25rem 0', color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Are you sure you want to delete the {advanceInfo?.is_prebook ? 'Pre-booking' : 'Advance'} of <strong>₹{inr(advanceInfo?.amount)}</strong> for <strong>{advanceInfo?.customer_name}</strong>?
          {advanceInfo?.is_prebook ? (
            <span style={{ display: 'block', marginTop: '0.5rem', color: '#6d28d9', fontSize: '0.85rem' }}>
              ℹ️ Deleting this pre-booking will immediately release all reserved stock items back to available stock.
            </span>
          ) : null}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-cancel-modal" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-confirm-delete" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function Advance() {
  /* ── Editing state ── */
  const [editingUid, setEditingUid] = useState(null);

  /* ── Customer state ── */
  const [query, setQuery]                         = useState('');
  const [customerResults, setCustomerResults]     = useState([]);
  const [customer, setCustomer]                   = useState(null);
  const [newCustomerName, setNewCustomerName]     = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [showNewCustomer, setShowNewCustomer]     = useState(false);

  /* ── Pre-booking toggle & Item reservation state ── */
  const [isPrebook, setIsPrebook]     = useState(false);
  const [designCode, setDesignCode]   = useState('');
  const [pendingStock, setPendingStock] = useState(null);
  const [linePieces, setLinePieces]   = useState('');
  const [lineRate, setLineRate]       = useState('');
  const [items, setItems]             = useState([]);
  const [pickerKey, setPickerKey]     = useState(0);

  /* ── Master lists for payments ── */
  const [paymentModesList, setPaymentModesList] = useState(DEFAULT_PAYMENT_MODES);
  const [banksList, setBanksList]               = useState([]);

  /* ── Advance Form state ── */
  const [amount, setAmount]           = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refNumber, setRefNumber]     = useState('');
  const [bankUid, setBankUid]         = useState('');
  const [denominations, setDenominations] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState(null);
  const [changeReturned, setChangeReturned] = useState(null);
  const [showDenomModal, setShowDenomModal] = useState(false);

  const [notes, setNotes]             = useState('');
  const [error, setError]             = useState(null);
  const [success, setSuccess]         = useState(null);
  const [saving, setSaving]           = useState(false);

  /* ── List & Pagination state ── */
  const [rows, setRows]               = useState([]);
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);
  const [total, setTotal]             = useState(0);
  const [grandTotal, setGrandTotal]   = useState(0);
  const [search, setSearch]           = useState('');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [loading, setLoading]         = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'advance_columns',
    ADVANCE_COLS
  );

  /* ── Delete Modal state ── */
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── 58mm Thermal Print Modal ── */
  const [thermalAdvanceData, setThermalAdvanceData] = useState(null);
  const [showThermalModal, setShowThermalModal] = useState(false);

  /* ── Load Advances ── */
  const loadAdvances = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const ps = opts.pageSize ?? pageSize;
      const s  = opts.search !== undefined ? opts.search : search;
      const fd = opts.fromDate !== undefined ? opts.fromDate : fromDate;
      const td = opts.toDate !== undefined ? opts.toDate : toDate;

      const res = await listAdvances(p, ps, { search: s, fromDate: fd, toDate: td });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setGrandTotal(res.grandTotal || 0);
      setPage(res.page || p);
    } catch (err) {
      setError(`Failed to load advances: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvances(1);
    listPaymentModes(1, 100, { activeOnly: true })
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setPaymentModesList(res.data);
          setPaymentMode(res.data[0].mode_code || res.data[0].mode_name);
        }
      })
      .catch((e) => console.warn('Payment modes load error:', e));

    listBanks(1, 100, { all: true })
      .then((res) => {
        if (res?.data) setBanksList(res.data);
      })
      .catch((e) => console.warn('Banks load error:', e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search debounce for list ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      loadAdvances(1, { search, fromDate, toDate });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Customer Typeahead Search ── */
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length >= 2) {
        try {
          const res = await searchCustomers(query.trim());
          setCustomerResults(res.data || []);
          setCustomerHighlightIndex(0);
        } catch (e) {
          setCustomerResults([]);
        }
      } else {
        setCustomerResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const pickCustomer = (c) => {
    setCustomer(c);
    setCustomerResults([]);
    setQuery('');
    setCustomerHighlightIndex(0);
    setError(null);
  };

  const saveNewCustomer = async () => {
    setError(null);
    if (!newCustomerName || !/^\d{10}$/.test(newCustomerMobile)) {
      setError('New customer needs a valid name and a 10-digit mobile number.');
      return;
    }
    try {
      const res = await createCustomer({ customer_name: newCustomerName, mobile_number: newCustomerMobile });
      setCustomer(res.data);
      setShowNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerMobile('');
      setSuccess('Customer created & selected!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to create customer: ${err.message}`);
    }
  };

  /* ── Stock Loading for Pre-booking ── */
  const loadStockByNumber = async (code) => {
    setError(null);
    if (!code) return;
    try {
      const res = await byDesignNumber(code);
      setPendingStock(res.data);
      if (res.data?.selling_price_per_piece && Number(res.data.selling_price_per_piece) > 0) {
        setLineRate(String(res.data.selling_price_per_piece));
      }
    } catch (e) {
      setPendingStock(null);
      setError(e.message);
    }
  };

  const loadByCode = async () => {
    if (!designCode) return;
    await loadStockByNumber(designCode);
  };

  const handleImageResolved = (tag) => {
    if (!tag) {
      setPendingStock(null);
      return;
    }
    if (tag.isNewDesign) {
      setError('Selected image is tagged as a new design with no existing stock.');
      setPendingStock(null);
      return;
    }

    let code = null;
    if (tag.design_number) {
      const numMatch = String(tag.design_number).match(/\d+/);
      if (numMatch) code = numMatch[0];
    } else if (tag.image_filename) {
      const fnMatch = tag.image_filename.match(/-(\d+)(?:\.[a-zA-Z0-9]+)?$/);
      if (fnMatch) code = fnMatch[1];
    }

    if (code) {
      setDesignCode(code);
      loadStockByNumber(code);
    } else {
      setError('Could not determine design number for the selected image.');
    }
  };

  /* ── Add Stock Item to Pre-booking ── */
  const addItem = () => {
    setError(null);
    if (!pendingStock) { setError('Load a stock item first (photo or code).'); return; }
    if (!linePieces || !lineRate) { setError('Enter pieces and rate.'); return; }
    const piecesNum = Number(linePieces);
    if (piecesNum <= 0) { setError('Pieces must be greater than 0.'); return; }

    const availablePcs = Number(pendingStock.available_pcs || 0);

    // Enforce strictly: do not allow pre-booking if stock is 0 or requested pieces > available pieces
    if (availablePcs <= 0) {
      setError(`Cannot pre-book Design #${pendingStock.design_number}: Available free stock is 0 pcs.`);
      return;
    }
    if (piecesNum > availablePcs) {
      setError(`Cannot pre-book Design #${pendingStock.design_number}: Requested ${piecesNum} pcs exceeds available free stock (${availablePcs} pcs).`);
      return;
    }

    setItems((it) => [...it, {
      key: generateClientUid(),
      stock_uid: pendingStock.uid,
      design_number: pendingStock.design_number,
      pieces: piecesNum,
      rate_per_piece: Number(lineRate),
      line_amount: piecesNum * Number(lineRate),
      size_str: pendingStock.width_ft ? `${pendingStock.width_ft} x ${pendingStock.height_ft} x ${pendingStock.thickness_mm}mm` : 'Standard'
    }]);

    setDesignCode('');
    setPendingStock(null);
    setLinePieces('');
    setLineRate('');
    setPickerKey((k) => k + 1);
  };

  const removeItem = (key) => setItems((it) => it.filter((i) => i.key !== key));

  const totalPrebookPieces = items.reduce((s, i) => s + Number(i.pieces || 0), 0);
  const totalPrebookEstimated = items.reduce((s, i) => s + (Number(i.pieces) * Number(i.rate_per_piece)), 0);

  const currentModeObj = paymentModesList.find(
    (m) => m.mode_code === paymentMode || m.mode_name === paymentMode
  ) || { mode_code: paymentMode, mode_name: paymentMode, is_bank_linked: 0, is_cash: paymentMode === 'cash' ? 1 : 0 };

  /* ── Save or Update Advance / Pre-booking ── */
  const saveAdvance = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!customer) {
      setError('Please select or create a customer first.');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid advance amount greater than 0.');
      return;
    }

    if (isPrebook && items.length === 0) {
      setError('Please add at least one stock item to reserve for pre-booking.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_uid: customer.uid,
        amount: numAmount,
        is_prebook: isPrebook,
        payment_mode: currentModeObj.mode_code || paymentMode,
        transaction_date: transactionDate || new Date().toISOString().slice(0, 10),
        ref_number: refNumber ? refNumber.trim() : null,
        bank_uid: bankUid || null,
        denominations: denominations || null,
        tendered_amount: tenderedAmount !== null && tenderedAmount !== undefined ? Number(tenderedAmount) : null,
        change_returned: changeReturned !== null && changeReturned !== undefined ? Number(changeReturned) : null,
        notes: notes ? notes.trim() : null,
        items: isPrebook ? items.map(({ stock_uid, pieces, rate_per_piece }) => ({ stock_uid, pieces, rate_per_piece })) : []
      };

      let savedRecord;
      if (editingUid) {
        const res = await updateAdvance(editingUid, payload);
        savedRecord = res?.data;
        setSuccess(isPrebook ? 'Pre-booking updated successfully!' : 'Advance record updated successfully!');
      } else {
        const res = await createAdvance(payload);
        savedRecord = res?.data;
        const code = res?.data?.prebook_code;
        setSuccess(
          isPrebook && code
            ? `Pre-booking created with Code: ${code}! Enter ${code} in Billing to load & bill.`
            : isPrebook
            ? 'Pre-booking and stock reservation saved successfully!'
            : 'Advance payment recorded successfully!'
        );
      }

      if (savedRecord?.uid) {
        openReceiptPdf(savedRecord.uid, 'advance');
      }

      // Reset form
      setAmount('');
      setNotes('');
      setItems([]);
      setPendingStock(null);
      setDesignCode('');
      setPaymentMode(paymentModesList[0]?.mode_code || 'cash');
      setTransactionDate(new Date().toISOString().slice(0, 10));
      setRefNumber('');
      setBankUid('');
      setDenominations(null);
      setTenderedAmount(null);
      setChangeReturned(null);
      setCustomer(null);
      setEditingUid(null);
      setIsPrebook(false);

      await loadAdvances(editingUid ? page : 1);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Start Edit ── */
  const startEdit = async (uid) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await getAdvance(uid);
      const row = res.data;
      if (row.is_converted_to_bill) {
        setError(`⚠️ Notice: Pre-booking ${row.prebook_code || ''} has already been converted to a sales bill. To edit or release this pre-booking, delete its sales bill first.`);
        return;
      }
      setCustomer({
        uid: row.customer_uid,
        customer_name: row.customer_name,
        mobile_number: row.mobile_number
      });
      setAmount(String(row.amount));
      setPaymentMode(row.payment_mode || 'cash');
      setTransactionDate(row.transaction_date ? String(row.transaction_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
      setRefNumber(row.ref_number || '');
      setBankUid(row.bank_uid || '');
      setDenominations(row.denominations ? (typeof row.denominations === 'string' ? JSON.parse(row.denominations) : row.denominations) : null);
      setTenderedAmount(row.tendered_amount !== null && row.tendered_amount !== undefined ? Number(row.tendered_amount) : null);
      setChangeReturned(row.change_returned !== null && row.change_returned !== undefined ? Number(row.change_returned) : null);
      setNotes(row.notes || '');
      setIsPrebook(Boolean(row.is_prebook));
      setItems(Array.isArray(row.items) ? row.items.map(i => ({
        key: generateClientUid(),
        stock_uid: i.stock_uid,
        design_number: i.design_number,
        pieces: Number(i.pieces),
        rate_per_piece: Number(i.rate_per_piece),
        line_amount: Number(i.line_amount),
        size_str: i.width_ft ? `${i.width_ft} x ${i.height_ft} x ${i.thickness_mm}mm` : 'Standard'
      })) : []);
      setEditingUid(row.uid);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(`Failed to load advance for editing: ${err.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingUid(null);
    setCustomer(null);
    setAmount('');
    setNotes('');
    setItems([]);
    setPendingStock(null);
    setDesignCode('');
    setIsPrebook(false);
    setPaymentMode(paymentModesList[0]?.mode_code || 'cash');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setRefNumber('');
    setBankUid('');
    setDenominations(null);
    setTenderedAmount(null);
    setChangeReturned(null);
    setError(null);
    setSuccess(null);
  };

  /* ── Delete Action ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.is_converted_to_bill) {
      setError(`⚠️ Notice: Pre-booking ${deleteTarget.prebook_code || ''} has already been converted to a sales bill. You cannot delete a pre-booking that has already been billed. Delete the sales bill first.`);
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteAdvance(deleteTarget.uid);
      setDeleteTarget(null);
      if (editingUid === deleteTarget.uid) cancelEdit();
      setSuccess('Record deleted & any reserved stock freed successfully!');
      await loadAdvances(page);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
      setDeleteTarget(null);
    }
  };

  /* ── Pagination helpers ── */
  const totalPages  = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord   = Math.min(page * pageSize, total);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Advance / Pre-booking</h1>
        
        {/* ── Pre-booking Toggle Switch ── */}
        <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          padding: '0.45rem 0.95rem',
          borderRadius: 8,
          border: isPrebook ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
          background: isPrebook ? '#f5f3ff' : '#fff',
          boxShadow: isPrebook ? '0 0 0 3px rgba(124, 58, 237, 0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={isPrebook}
            onChange={(e) => setIsPrebook(e.target.checked)}
            style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#7c3aed', margin: 0 }}
          />
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isPrebook ? '#6d28d9' : '#334155' }}>
            🔖 Pre-booking {isPrebook ? '(Stock Reservation Active)' : ''}
          </span>
        </label>
      </div>

      {/* ── Edit Mode Banner ── */}
      {editingUid && (
        <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
          <span>✏️ Editing {isPrebook ? 'Pre-booking' : 'Advance'} for <strong>{customer?.customer_name}</strong></span>
          <button type="button" onClick={cancelEdit} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            Cancel editing
          </button>
        </div>
      )}

      {/* ── Top Entry Section ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.75rem' }}>
        
        {/* Row 1: Customer Selection & Advance Details Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Card 1: Customer Selection */}
          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Customer <span style={{ color: '#ef4444' }}>*</span></h3>
            {customer ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{customer.customer_name}</strong>
                  <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.9rem' }}>({customer.mobile_number})</span>
                </div>
                {!editingUid && (
                  <button type="button" style={{ background: '#0284c7', color: '#fff', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }} onClick={() => setCustomer(null)}>
                    Change Customer
                  </button>
                )}
              </div>
            ) : (
              <>
                <input
                  placeholder="Search by name or mobile…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (customerResults.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setCustomerHighlightIndex((prev) => (prev + 1 < customerResults.length ? prev + 1 : 0));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setCustomerHighlightIndex((prev) => (prev - 1 >= 0 ? prev - 1 : customerResults.length - 1));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customerResults[customerHighlightIndex]) {
                          pickCustomer(customerResults[customerHighlightIndex]);
                        }
                      } else if (e.key === 'Escape') {
                        setCustomerResults([]);
                      }
                    }
                  }}
                />
                {customerResults.length > 0 && (
                  <ul className="search-results" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {customerResults.map((c, idx) => (
                      <li key={c.uid}>
                        <button
                          type="button"
                          onClick={() => pickCustomer(c)}
                          onMouseEnter={() => setCustomerHighlightIndex(idx)}
                          style={{
                            background: idx === customerHighlightIndex ? '#eff6ff' : 'transparent',
                            color: idx === customerHighlightIndex ? '#1d4ed8' : '#1a1a1a',
                            fontWeight: idx === customerHighlightIndex ? 700 : 400,
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>{c.customer_name}</span>
                          <span style={{ fontSize: '0.8rem', color: idx === customerHighlightIndex ? '#2563eb' : '#64748b' }}>
                            {c.mobile_number}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!showNewCustomer && (
                  <button type="button" onClick={() => setShowNewCustomer(true)} style={{ marginTop: '0.5rem' }}>
                    + New customer
                  </button>
                )}
                {showNewCustomer && (
                  <div className="form-row" style={{ marginTop: '0.75rem' }}>
                    <input
                      placeholder="Customer name *"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                    <input
                      placeholder="Mobile number *"
                      value={newCustomerMobile}
                      maxLength={10}
                      onChange={(e) => setNewCustomerMobile(e.target.value.replace(/\D/g, ''))}
                    />
                    <button type="button" onClick={saveNewCustomer}>Save customer</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Card 2: Advance Payment Details */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h3 style={{ margin: 0 }}>{isPrebook ? 'Advance / Token Payment' : 'Advance Details'}</h3>
              {currentModeObj.is_cash ? (
                <button
                  type="button"
                  onClick={() => setShowDenomModal(true)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    borderRadius: 4,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  💵 Cash Denominations & Change
                </button>
              ) : null}
            </div>

            <div className="form-row" style={{ alignItems: 'flex-start', marginBottom: '0.65rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label>
                Advance Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                <NumericInput
                  value={amount}
                  onChange={setAmount}
                  placeholder={isPrebook && totalPrebookEstimated > 0 ? `Est. ₹${inr(totalPrebookEstimated)}` : 'Enter amount'}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </label>
              <div>
                <label style={{ display: 'block', marginBottom: '0.2rem' }}>
                  Payment Mode <span style={{ color: '#ef4444' }}>*</span>
                </label>
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
            </div>

            <div className="form-row" style={{ alignItems: 'flex-start', marginBottom: '0.65rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label>
                Transaction Date <span style={{ color: '#ef4444' }}>*</span>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </label>
              <label>
                Ref / Txn No
                <input
                  type="text"
                  placeholder="e.g. UTR / Cheque #"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </label>
            </div>

            {(currentModeObj.is_bank_linked || banksList.length > 0) && (
              <div style={{ marginBottom: '0.65rem' }}>
                <label style={{ display: 'block', marginBottom: '0.2rem' }}>
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

            {changeReturned !== null && changeReturned > 0 && (
              <div style={{ marginBottom: '0.65rem', fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.3rem 0.55rem', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                💵 Cash Tendered: ₹{inr(tenderedAmount)} | Change Returned: ₹{inr(changeReturned)}
              </div>
            )}

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block' }}>
                Notes / Remarks (Optional)
                <input
                  type="text"
                  placeholder="e.g. token advance for prebooking, cash received by store"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </label>
            </div>

            {error && <div className="field-error" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>{error}</div>}
            {success && <div className="success" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>✓ {success}</div>}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={saveAdvance}
                disabled={saving || !customer || !amount}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  background: (!customer || !amount) ? '#94a3b8' : isPrebook ? '#7c3aed' : editingUid ? '#0284c7' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: (saving || !customer || !amount) ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Processing…' : editingUid ? (isPrebook ? 'Update Pre-booking' : 'Update Advance') : (isPrebook ? '🔖 Save Pre-booking & Reserve Stock' : '+ Record Advance')}
              </button>
              {editingUid && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{ background: '#94a3b8', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: 6 }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Row 2: Pre-booking Stock Items Section (Visible when Pre-booking is Checked) */}
        {isPrebook && (
          <div className="card" style={{ marginBottom: 0, border: '1.5px solid #c4b5fd', background: '#fcfaff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #e9d5ff', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#6d28d9' }}>
                🔖 Pre-booking: Select & Reserve Stock Items
              </h3>
              {items.length > 0 && (
                <span style={{ fontSize: '0.88rem', color: '#7c3aed', fontWeight: 600 }}>
                  Total Reserved: <strong>{totalPrebookPieces} pcs</strong> • Estimated: <strong>₹{inr(totalPrebookEstimated)}</strong>
                </span>
              )}
            </div>

            {/* Code search & photo picker */}
            <div className="form-row">
              <input
                placeholder="Enter stock/design code to pre-book"
                value={designCode}
                onChange={(e) => setDesignCode(e.target.value.replace(/\D/g, ''))}
              />
              <button type="button" onClick={loadByCode}>Load by code</button>
            </div>
            
            <ImageMatchPicker key={pickerKey} autoStartCamera={true} onResolved={handleImageResolved} />

            {/* Loaded Pending Stock Card */}
            {pendingStock && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {pendingStock.image_filename && (
                      <img
                        src={`/images/${pendingStock.image_filename}`}
                        alt={`Design #${pendingStock.design_number}`}
                        style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
                        Design #{pendingStock.design_number}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Size: {pendingStock.width_ft ? `${pendingStock.width_ft} x ${pendingStock.height_ft} x ${pendingStock.thickness_mm}mm` : 'Standard'}
                      </div>
                    </div>
                  </div>

                  {/* Stock Counters */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                      Physical: {Number(pendingStock.physical_stock_pcs ?? pendingStock.available_pcs ?? 0)} pcs {Number(pendingStock.total_prebooked_pcs || 0) > 0 ? `(${pendingStock.total_prebooked_pcs} already pre-booked)` : ''}
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: Number(pendingStock.available_pcs || 0) > 0 ? '#16a34a' : '#ef4444',
                      background: Number(pendingStock.available_pcs || 0) > 0 ? '#dcfce7' : '#fee2e2',
                      padding: '0.2rem 0.65rem',
                      borderRadius: 6,
                      display: 'inline-block',
                      marginTop: '0.2rem'
                    }}>
                      Free Available: {Number(pendingStock.available_pcs || 0).toLocaleString('en-IN')} pcs
                    </div>
                  </div>
                </div>

                {/* 0 Stock Alert for Pre-booking */}
                {Number(pendingStock.available_pcs || 0) <= 0 && (
                  <div style={{
                    marginBottom: '0.85rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 6,
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#b91c1c'
                  }}>
                    ⛔ <strong>Out of Stock (0 pcs available):</strong> This design has 0 free available pieces. You cannot pre-book items without available stock.
                  </div>
                )}

                {/* Input Form Fields for Pieces and Rate */}
                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                  <label>
                    Pre-book Pieces <span style={{ color: '#ef4444' }}>*</span>
                    <NumericInput value={linePieces} onChange={setLinePieces} placeholder="Enter pieces to reserve" />
                  </label>
                  <label>
                    Rate / piece (₹) <span style={{ color: '#ef4444' }}>*</span>
                    <NumericInput value={lineRate} onChange={setLineRate} placeholder="Rate per piece" />
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={Number(pendingStock.available_pcs || 0) <= 0}
                    style={{
                      background: Number(pendingStock.available_pcs || 0) <= 0 ? '#94a3b8' : '#7c3aed',
                      color: '#fff',
                      fontWeight: 600,
                      padding: '0.55rem 1.25rem',
                      cursor: Number(pendingStock.available_pcs || 0) <= 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    + Add item to pre-booking
                  </button>
                </div>

                {/* Live Remaining Stock Indicator */}
                {linePieces && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: (Number(pendingStock.available_pcs || 0) - Number(linePieces || 0)) < 0 ? '#fff1f2' : '#f0fdf4',
                    border: (Number(pendingStock.available_pcs || 0) - Number(linePieces || 0)) < 0 ? '1px solid #fecdd3' : '1px solid #bbf7d0',
                    color: (Number(pendingStock.available_pcs || 0) - Number(linePieces || 0)) < 0 ? '#e11d48' : '#15803d',
                  }}>
                    {(Number(pendingStock.available_pcs || 0) - Number(linePieces || 0)) < 0 ? (
                      <span>
                        ⚠️ Warning: Entered <strong>{Number(linePieces).toLocaleString('en-IN')} pcs</strong> exceeds available free stock ({Number(pendingStock.available_pcs || 0)} pcs)! You cannot pre-book more than available stock.
                      </span>
                    ) : (
                      <span>
                        ✓ Remaining free stock after this pre-booking: <strong>{(Number(pendingStock.available_pcs || 0) - Number(linePieces || 0)).toLocaleString('en-IN')} pcs</strong> (out of {Number(pendingStock.available_pcs || 0).toLocaleString('en-IN')} pcs)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Added Pre-booked Items Table */}
            {items.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Reserved Items in this Pre-booking ({items.length})</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 45 }}>S.No</th>
                      <th>Design #</th>
                      <th>Size</th>
                      <th className="num-cell">Reserved Pieces</th>
                      <th className="num-cell">Rate / Piece</th>
                      <th className="num-cell">Line Total (₹)</th>
                      <th className="actions-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.key}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>Design #{it.design_number}</td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{it.size_str}</td>
                        <td className="num-cell" style={{ fontWeight: 700, color: '#7c3aed' }}>
                          {Number(it.pieces).toLocaleString('en-IN')} pcs
                        </td>
                        <td className="num-cell">₹{inr(it.rate_per_piece)}</td>
                        <td className="num-cell" style={{ fontWeight: 600, color: '#1e293b' }}>
                          ₹{inr(it.line_amount || it.pieces * it.rate_per_piece)}
                        </td>
                        <td className="action-cell">
                          <button className="icon-btn delete-btn" title="Remove item from pre-booking" onClick={() => removeItem(it.key)}>
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                      <td colSpan={3} style={{ textAlign: 'right' }}>Total Pre-booked:</td>
                      <td className="num-cell" style={{ color: '#7c3aed' }}>{totalPrebookPieces.toLocaleString('en-IN')} pcs</td>
                      <td></td>
                      <td className="num-cell" style={{ color: '#0f172a', fontSize: '0.95rem' }}>₹{inr(totalPrebookEstimated)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Advances & Pre-bookings History Section ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Advance & Pre-booking History</h2>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search customer, mobile, mode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
          />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="From Date"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
          />
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            title="To Date"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
          />
          {(search || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setFromDate(''); setToDate(''); }}
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.35rem 0.65rem', fontSize: '0.82rem', borderRadius: 6 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <span className="pagination-info" style={{ flex: 1 }}>
          {total === 0 ? 'No records found.' : `${total} record${total !== 1 ? 's' : ''}`}
        </span>
        <label className="records-per-page">
          Show&nbsp;
          <select
            value={pageSize}
            disabled={loading}
            onChange={(e) => {
              const ps = Number(e.target.value);
              setPageSize(ps);
              loadAdvances(1, { pageSize: ps });
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={ADVANCE_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <TableContainer loading={loading} text="Loading advances…" subtext="Fetching advance payments and pre-bookings">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 50, textAlign: 'right' }}>S.No</th>}
              {isVisible('customer_name') && <th>Customer</th>}
              {isVisible('mobile_number') && <th>Mobile</th>}
              {isVisible('type') && <th>Type / Reservation</th>}
              {isVisible('amount') && <th className="num-cell">Advance Paid (₹)</th>}
              {isVisible('payment_mode') && <th>Mode</th>}
              {isVisible('notes') && <th>Notes / Remarks</th>}
              {isVisible('date_time') && <th>Date & Time</th>}
              {isVisible('actions') && <th className="actions-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              return (
                <tr key={r.uid} style={editingUid === r.uid ? { background: '#f0f9ff' } : {}}>
                  {isVisible('sno') && <td className="num-cell">{(page - 1) * pageSize + idx + 1}</td>}
                  {isVisible('customer_name') && <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.customer_name}</td>}
                  {isVisible('mobile_number') && <td style={{ color: '#475569' }}>{r.mobile_number}</td>}
                  {isVisible('type') && (
                    <td>
                      {r.is_prebook ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: '#f5f3ff',
                            color: '#6d28d9',
                            border: '1px solid #ddd6fe'
                          }}>
                            🔖 {r.prebook_code || 'Pre-booking'} {Number(r.total_pieces || 0) > 0 ? `(${r.total_pieces} pcs)` : ''}
                          </span>
                          {r.is_converted_to_bill ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              color: '#15803d',
                              background: '#dcfce7',
                              border: '1.5px solid #86efac',
                              padding: '0.12rem 0.5rem',
                              borderRadius: 5,
                              boxShadow: '0 1px 2px rgba(22, 101, 52, 0.08)'
                            }}>
                              ✓ BILLED
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                              Active Reservation
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: '#f1f5f9',
                          color: '#475569'
                        }}>
                          Standard Advance
                        </span>
                      )}
                    </td>
                  )}
                  {isVisible('amount') && (
                    <td className="num-cell" style={{ fontWeight: 700, color: '#15803d', fontSize: '0.92rem' }}>
                      ₹{inr(r.amount)}
                    </td>
                  )}
                  {isVisible('payment_mode') && (
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#0369a1',
                          background: '#e0f2fe',
                          border: '1px solid #bae6fd'
                        }}>
                          {r.payment_mode || 'Cash'}
                        </span>
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
                        {r.transaction_date && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            Txn: {String(r.transaction_date).slice(0, 10)}
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
                  {isVisible('notes') && (
                    <td style={{ color: r.notes ? '#334155' : '#94a3b8', fontStyle: r.notes ? 'normal' : 'italic' }}>
                      {r.notes || '—'}
                    </td>
                  )}
                  {isVisible('date_time') && (
                    <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      {formatDateTime(r.entry_datetime)}
                    </td>
                  )}
                  {isVisible('actions') && (
                    <td className="action-cell">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Print 58mm Thermal PDF (Opens in new tab)"
                        disabled={loading}
                        onClick={() => openReceiptPdf(r.uid, 'advance')}
                        style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '0.25rem 0.4rem', borderRadius: 4, fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        🖨️
                      </button>
                      <button
                        className="icon-btn edit-btn"
                        disabled={loading}
                        title={r.is_converted_to_bill ? "Already billed (Delete the sales bill to edit)" : "Edit Record"}
                        style={r.is_converted_to_bill ? { opacity: 0.45 } : {}}
                        onClick={() => startEdit(r.uid)}
                      >
                        <IconEdit />
                      </button>
                      <button
                        className="icon-btn delete-btn"
                        disabled={loading}
                        title={r.is_converted_to_bill ? "Already billed (Cannot delete — delete the sales bill first)" : "Delete Record"}
                        style={r.is_converted_to_bill ? { opacity: 0.45 } : {}}
                        onClick={() => setDeleteTarget(r)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  {loading ? 'Loading advances…' : 'No advance records found.'}
                </td>
              </tr>
            )}
          </tbody>
          {total > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                <td colSpan={4} style={{ textAlign: 'right', color: '#475569', fontSize: '0.9rem' }}>
                  Total Advance Collected (Filtered {total} records):
                </td>
                <td className="num-cell" style={{ color: '#15803d', fontSize: '0.98rem' }}>
                  ₹{inr(grandTotal)}
                </td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </TableContainer>

      {/* ── Pagination Bar ── */}
      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadAdvances(1)} title="First">«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadAdvances(page - 1)} title="Prev">‹</button>
            {pageNumbers.map((item, idx) =>
              item === '...'
                ? <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                : <button key={item} className={`page-btn${item === page ? ' active' : ''}`} disabled={loading} onClick={() => !loading && loadAdvances(item)}>{item}</button>
            )}
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadAdvances(page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadAdvances(totalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <DeleteModal
          advanceInfo={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
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
