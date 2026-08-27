import { useEffect, useState } from 'react';
import NumericInput from '../../components/NumericInput.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import ImageMatchPicker from '../../components/ImageMatchPicker.jsx';
import CashDenominationModal from '../../components/CashDenominationModal.jsx';
import { searchCustomers, createCustomer } from '../../api/customer.js';
import { byDesignNumber, ensureHomeBillStock } from '../../api/stock.js';
import { createBill, getBill, updateBill, deleteBill, listBills } from '../../api/bill.js';
import { getAdvanceByCode } from '../../api/advance.js';
import { getCompany } from '../../api/company.js';
import { listPaymentModes } from '../../api/paymentMode.js';
import { listBanks } from '../../api/bank.js';
import { openReceiptPdf } from '../../utils/printPdf.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import { generateClientUid } from '../../utils/uid.js';

const BILLING_HISTORY_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'customer', label: 'Customer', defaultVisible: true },
  { key: 'mobile', label: 'Mobile', defaultVisible: true },
  { key: 'total', label: 'Total', defaultVisible: true },
  { key: 'discount', label: 'Discount', defaultVisible: true },
  { key: 'net_amount', label: 'Net Amount', defaultVisible: true },
  { key: 'time', label: 'Time', defaultVisible: true },
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

/* ── Indian number formatter ────────────────────────────── */
const inr = (n) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Icons ───────────────────────────────────────────────── */
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

/* ── Delete Confirmation Modal ───────────────────────────── */
function DeleteModal({ customerName, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <h3 className="modal-title">Delete Bill?</h3>
        <p className="modal-msg">Delete the bill for <strong>{customerName}</strong>? This cannot be undone.</p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-confirm-delete" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function Billing() {
  /* ── In-place Editing state ── */
  const [editingBillUid, setEditingBillUid] = useState(null);

  /* ── Customer state ── */
  const [query, setQuery]                       = useState('');
  const [customerResults, setCustomerResults]   = useState([]);
  const [customer, setCustomer]                 = useState(null);
  const [newCustomerName, setNewCustomerName]   = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [showNewCustomer, setShowNewCustomer]   = useState(false);

  /* ── Home Bill toggle (allows billing 0 stock items) ── */
  const [isHomeBill, setIsHomeBill] = useState(false);

  /* ── Stock line entry ── */
  const [designCode, setDesignCode]         = useState('');
  const [pendingStock, setPendingStock]     = useState(null);
  const [currentImageTag, setCurrentImageTag] = useState(null);
  const [linePieces, setLinePieces]         = useState('');
  const [lineRate, setLineRate]             = useState('');
  const [items, setItems]                   = useState([]);
  const [pickerKey, setPickerKey]           = useState(0);

  /* ── Pre-booking code loading state ── */
  const [prebookCodeInput, setPrebookCodeInput] = useState('');
  const [loadedPrebook, setLoadedPrebook]       = useState(null);
  const [prebookLoading, setPrebookLoading]     = useState(false);

  /* ── Master lists for payments ── */
  const [paymentModesList, setPaymentModesList] = useState(DEFAULT_PAYMENT_MODES);
  const [banksList, setBanksList]               = useState([]);

  /* ── Totals / payments ── */
  const [discount, setDiscount]           = useState('0');
  const [payments, setPayments]           = useState([]);
  const [paymentMode, setPaymentMode]     = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef]       = useState('');
  const [paymentBankUid, setPaymentBankUid] = useState('');
  const [activeDenominations, setActiveDenominations] = useState(null);
  const [activeTendered, setActiveTendered]           = useState(null);
  const [activeChange, setActiveChange]               = useState(null);
  const [showDenomModal, setShowDenomModal]           = useState(false);

  const [error, setError]                 = useState(null);
  const [saving, setSaving]               = useState(false);
  const [savedBillUid, setSavedBillUid]   = useState(null);

  /* ── Credit / Due state ── */
  const [isCredit, setIsCredit]           = useState(false);
  const [dueDate, setDueDate]             = useState('');
  const [dueNarration, setDueNarration]   = useState('');

  /* ── Company / GST state ── */
  const [company, setCompany] = useState(null);

  /* ── 58mm Thermal Print Modal ── */
  const [thermalBillData, setThermalBillData] = useState(null);
  const [showThermalModal, setShowThermalModal] = useState(false);

  /* ── Bill history (today only) ── */
  const [billRows, setBillRows]     = useState([]);
  const [billPage, setBillPage]     = useState(1);
  const [billPageSize, setBillPageSize] = useState(10);
  const [billTotal, setBillTotal]   = useState(0);
  const [todayGrandTotal, setTodayGrandTotal] = useState(0);
  const [loadingBills, setLoadingBills] = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'billing_history_columns',
    BILLING_HISTORY_COLS
  );

  /* ── Delete modals ── */
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── Load today's bills ── */
  const loadBills = async (p = billPage, opts = {}) => {
    setLoadingBills(true);
    try {
      const ps  = opts.pageSize ?? billPageSize;
      const res = await listBills(p, ps, { todayOnly: true });
      setBillRows(res.data || []);
      setBillTotal(res.total || 0);
      setBillPage(res.page || p);
      setTodayGrandTotal(res.grandTotal ?? 0);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    loadBills(1);
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

  /* ── Load company settings for GST ── */
  useEffect(() => {
    getCompany().then((res) => { if (res?.data) setCompany(res.data); }).catch(() => {});
  }, []);

  /* ── Customer search ── */
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length >= 2) {
        const res = await searchCustomers(query.trim());
        setCustomerResults(res.data);
        setCustomerHighlightIndex(0);
      } else {
        setCustomerResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const pickCustomer = (c) => { setCustomer(c); setCustomerResults([]); setQuery(''); setCustomerHighlightIndex(0); };

  const saveNewCustomer = async () => {
    if (!newCustomerName || !/^\d{10}$/.test(newCustomerMobile)) {
      setError('New customer needs a name and a 10-digit mobile number.');
      return;
    }
    const res = await createCustomer({ customer_name: newCustomerName, mobile_number: newCustomerMobile });
    setCustomer(res.data);
    setShowNewCustomer(false);
    setNewCustomerName(''); setNewCustomerMobile('');
  };

  /* ── Computed totals ── */
  const totalPieces  = items.reduce((s, i) => s + Number(i.pieces || 0), 0);
  const totalAmount  = items.reduce((s, i) => s + i.pieces * i.rate_per_piece, 0);
  const netAmount    = Math.max(0, Math.round((totalAmount - Number(discount || 0)) * 100) / 100);
  const paymentsSum  = Math.round(payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;

  /* ── GST / Tax Computation ── */
  const isGstRegistered  = Boolean(company?.is_gst_registered);
  const companyState     = company?.state?.trim() || '';
  const customerState    = customer?.state?.trim() || '';
  const isInterState     = isGstRegistered && customerState && companyState && customerState !== companyState;
  const cgstPct  = isGstRegistered && !isInterState ? Number(company?.cgst_percent || 0) : 0;
  const sgstPct  = isGstRegistered && !isInterState ? Number(company?.sgst_percent || 0) : 0;
  const igstPct  = isGstRegistered && isInterState  ? Number(company?.igst_percent || 0) : 0;
  const cgstAmt  = Math.round(netAmount * cgstPct / 100 * 100) / 100;
  const sgstAmt  = Math.round(netAmount * sgstPct / 100 * 100) / 100;
  const igstAmt  = Math.round(netAmount * igstPct / 100 * 100) / 100;
  const taxTotal = Math.round((cgstAmt + sgstAmt + igstAmt) * 100) / 100;
  const grandTotal = Math.round((netAmount + taxTotal) * 100) / 100;

  /* ── Stock loading (strictly from physical store stock) ── */
  const loadStockByNumber = async (code) => {
    setError(null);
    if (!code) return;
    try {
      const res = await byDesignNumber(code);
      setPendingStock({ ...res.data, is_home_bill_item: false });
      if (res.data?.selling_price_per_piece && Number(res.data.selling_price_per_piece) > 0) {
        setLineRate(String(res.data.selling_price_per_piece));
      }
    } catch (e) {
      setPendingStock(null);
      setError(e.message || `Design #${code} not found in store stock.`);
    }
  };

  const loadByCode = async () => {
    if (!designCode) return;
    await loadStockByNumber(designCode);
  };

  const handleImageResolved = async (tag) => {
    setCurrentImageTag(tag);
    if (!tag) {
      setPendingStock(null);
      return;
    }
    if (tag.isNewDesign) {
      if (isHomeBill) {
        try {
          setError(null);
          const res = await ensureHomeBillStock({ image_filename: tag.image_filename });
          setPendingStock({ ...res.data, is_home_bill_item: true });
          if (res.data?.selling_price_per_piece && Number(res.data.selling_price_per_piece) > 0) {
            setLineRate(String(res.data.selling_price_per_piece));
          }
        } catch (e) {
          setError(`Failed to prepare new design stock for Home Bill: ${e.message}`);
          setPendingStock(null);
        }
      } else {
        setError('Selected image is tagged as a new design with no existing stock. Check "Home Bill (0-Stock Allowed)" above to bill without stock.');
        setPendingStock(null);
      }
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
      if (isHomeBill && tag.image_filename) {
        try {
          setError(null);
          const res = await ensureHomeBillStock({ image_filename: tag.image_filename });
          setPendingStock({ ...res.data, is_home_bill_item: true });
        } catch (e) {
          setError('Could not determine design number for the selected image. Please enter code manually.');
        }
      } else {
        setError('Could not determine design number for the selected image. Please enter code manually.');
      }
    }
  };

  /* ── Effect: Auto-resolve pending new design tag when Home Bill toggle is switched on/off ── */
  useEffect(() => {
    if (currentImageTag && currentImageTag.isNewDesign) {
      if (isHomeBill) {
        ensureHomeBillStock({ image_filename: currentImageTag.image_filename })
          .then((res) => {
            setError(null);
            setPendingStock({ ...res.data, is_home_bill_item: true });
            if (res.data?.selling_price_per_piece && Number(res.data.selling_price_per_piece) > 0) {
              setLineRate(String(res.data.selling_price_per_piece));
            }
          })
          .catch((e) => setError(e.message));
      } else {
        setError('Selected image is tagged as a new design with no existing stock. Check "Home Bill (0-Stock Allowed)" above to bill without stock.');
        setPendingStock(null);
      }
    }
  }, [isHomeBill]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => {
    setError(null);
    if (!pendingStock) { setError('Load a stock item first (photo or code).'); return; }
    if (!linePieces || !lineRate) { setError('Enter pieces and rate.'); return; }
    const piecesNum = Number(linePieces);
    if (piecesNum <= 0) { setError('Pieces must be greater than 0.'); return; }

    const isItemHomeBill = Boolean(pendingStock.is_home_bill_item);
    const availablePcs = Number(pendingStock.available_pcs || 0);

    // Stock validation:
    // If it is a regular stock item (!isItemHomeBill), it MUST strictly come from available physical stock!
    if (!isItemHomeBill) {
      if (availablePcs <= 0) {
        if (Number(pendingStock.total_prebooked_pcs || 0) > 0) {
          setError(`Cannot add Design #${pendingStock.design_number}: All ${pendingStock.total_prebooked_pcs} pcs are pre-booked (Reserved) for other customer orders. This stock item must come from available stock pcs.`);
        } else {
          setError(`Cannot add Design #${pendingStock.design_number}: Available stock is 0 pcs. Regular stock items must be available in store stock.`);
        }
        return;
      }
      if (piecesNum > availablePcs) {
        if (Number(pendingStock.total_prebooked_pcs || 0) > 0) {
          setError(`Cannot add Design #${pendingStock.design_number}: Entered ${piecesNum} pcs exceeds available stock (${availablePcs} pcs available, ${pendingStock.total_prebooked_pcs} pcs pre-booked). Reduce pieces.`);
        } else {
          setError(`Cannot add Design #${pendingStock.design_number}: Entered ${piecesNum} pcs exceeds available stock (${availablePcs} pcs). Reduce pieces.`);
        }
        return;
      }
    }

    setItems((it) => [...it, {
      key: generateClientUid(),
      stock_uid: pendingStock.uid,
      design_number: pendingStock.design_number,
      image_filename: pendingStock.image_filename,
      is_home_bill: isItemHomeBill,
      pieces: piecesNum,
      rate_per_piece: Number(lineRate),
    }]);
    setDesignCode(''); setPendingStock(null); setCurrentImageTag(null); setLinePieces(''); setLineRate('');
    setPickerKey((k) => k + 1);
  };

  const removeItem = (key) => setItems((it) => it.filter((i) => i.key !== key));

  const currentModeObj = paymentModesList.find(
    (m) => m.mode_code === paymentMode || m.mode_name === paymentMode
  ) || { mode_code: paymentMode, mode_name: paymentMode, is_bank_linked: 0, is_cash: paymentMode === 'cash' ? 1 : 0 };

  const addPayment = () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return;
    const selectedBank = banksList.find((b) => b.uid === paymentBankUid);
    setPayments((p) => [
      ...p,
      {
        key: generateClientUid(),
        payment_mode: currentModeObj.mode_code || paymentMode,
        mode_name: currentModeObj.mode_name || paymentMode,
        amount: Number(paymentAmount),
        transaction_date: paymentDate || new Date().toISOString().slice(0, 10),
        ref_number: paymentRef ? paymentRef.trim() : null,
        bank_uid: paymentBankUid || null,
        bank_name: selectedBank ? `${selectedBank.bank_name} (${selectedBank.bank_code})` : null,
        denominations: activeDenominations || null,
        tendered_amount: activeTendered !== null && activeTendered !== undefined ? Number(activeTendered) : null,
        change_returned: activeChange !== null && activeChange !== undefined ? Number(activeChange) : null
      }
    ]);
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentBankUid('');
    setActiveDenominations(null);
    setActiveTendered(null);
    setActiveChange(null);
  };
  const removePayment = (key) => setPayments((p) => p.filter((x) => x.key !== key));

  /* ── Load from Pre-booking Code ── */
  const handleLoadPrebooking = async () => {
    setError(null);
    if (!prebookCodeInput.trim()) {
      setError('Please enter a pre-booking code (e.g. PB-1001).');
      return;
    }
    setPrebookLoading(true);
    try {
      const res = await getAdvanceByCode(prebookCodeInput.trim());
      const pb = res.data;
      if (!pb) {
        setError(`Pre-booking code "${prebookCodeInput.trim()}" not found.`);
        return;
      }
      if (pb.is_converted_to_bill) {
        setError(`⛔ Pre-booking ${pb.prebook_code} has already been billed & fulfilled! You cannot load or bill this pre-booking again unless its previous bill is deleted.`);
        setLoadedPrebook(null);
        return;
      }

      // 1. Set customer
      setCustomer({
        uid: pb.customer_uid,
        customer_name: pb.customer_name,
        mobile_number: pb.mobile_number,
      });

      // 2. Populate items
      if (Array.isArray(pb.items) && pb.items.length > 0) {
        setItems(pb.items.map(it => ({
          key: generateClientUid(),
          stock_uid: it.stock_uid,
          design_number: it.design_number,
          pieces: Number(it.pieces),
          rate_per_piece: Number(it.rate_per_piece),
        })));
      }

      // 3. Set loaded prebook metadata
      setLoadedPrebook({
        uid: pb.uid,
        code: pb.prebook_code,
        amount: Number(pb.amount || 0),
        payment_mode: pb.payment_mode || 'cash'
      });

      // 4. Auto-populate advance payment in payments array
      if (Number(pb.amount || 0) > 0) {
        setPayments([
          {
            key: generateClientUid(),
            payment_mode: pb.payment_mode || 'advance',
            mode_name: `Advance (${pb.prebook_code || 'Credit'})`,
            amount: Number(pb.amount || 0),
            transaction_date: pb.transaction_date ? String(pb.transaction_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
            ref_number: pb.ref_number || null,
            bank_uid: pb.bank_uid || null,
            bank_name: pb.bank_name ? `${pb.bank_name} (${pb.bank_code || ''})` : null,
            is_advance_credit: true
          }
        ]);
      }

      setSavedBillUid(`🔖 Loaded Pre-booking #${pb.prebook_code}: ${pb.customer_name} (${pb.items?.length || 0} items, Advance ₹${inr(pb.amount)} credited).`);
    } catch (err) {
      setError(err.message);
    } finally {
      setPrebookLoading(false);
    }
  };

  /* ── Save or Update Bill ── */
  const saveBill = async () => {
    setError(null);
    if (!customer) { setError('Select or create a customer first.'); return; }
    if (items.length === 0) { setError('Add at least one item.'); return; }

    if (isCredit) {
      if (!dueDate) { setError('Exact Payment Due Date is mandatory for credit bills.'); return; }
      if (!dueNarration.trim()) { setError('Narration / Reason is mandatory for credit bills.'); return; }
      if (paymentsSum > grandTotal) { setError(`Payments (₹${inr(paymentsSum)}) cannot exceed grand total (₹${inr(grandTotal)}).`); return; }
    } else {
      if (paymentsSum !== grandTotal) { setError(`Payments (₹${inr(paymentsSum)}) must equal grand total (₹${inr(grandTotal)}).`); return; }
    }

    setSaving(true);
    try {
      const payload = {
        customer_uid: customer.uid,
        items: items.map(({ stock_uid, pieces, rate_per_piece, is_home_bill }) => ({ stock_uid, pieces, rate_per_piece, is_home_bill: Boolean(is_home_bill) })),
        discount: Number(discount || 0),
        payments: payments.map((p) => ({
          payment_mode: p.payment_mode,
          amount: p.amount,
          transaction_date: p.transaction_date || null,
          ref_number: p.ref_number || null,
          bank_uid: p.bank_uid || null,
          denominations: p.denominations || null,
          tendered_amount: p.tendered_amount ?? null,
          change_returned: p.change_returned ?? null
        })),
        is_home_bill: isHomeBill || items.some((i) => i.is_home_bill),
        prebook_code: loadedPrebook?.code || null,
        advance_uid: loadedPrebook?.uid || null,
        advance_amount: loadedPrebook?.amount || 0,
        cgst_percent: cgstPct,
        sgst_percent: sgstPct,
        igst_percent: igstPct,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        igst_amount: igstAmt,
        tax_amount: taxTotal,
        grand_total: grandTotal,
        is_credit: isCredit,
        due_date: isCredit ? dueDate : null,
        due_narration: isCredit ? dueNarration.trim() : null,
      };

      if (editingBillUid) {
        const res = await updateBill(editingBillUid, payload);
        setSavedBillUid(`Bill updated successfully!`);
        if (res?.data?.uid) {
          openReceiptPdf(res.data.uid, 'bill');
        }
      } else {
        const res = await createBill(payload);
        setSavedBillUid(`Bill saved: ${res.data.uid}${isCredit ? ' (💳 Credit Bill)' : ''}`);
        if (res?.data?.uid) {
          openReceiptPdf(res.data.uid, 'bill');
        }
      }

      setItems([]); setPayments([]); setDiscount('0'); setCustomer(null); setEditingBillUid(null); setIsHomeBill(false);
      setLoadedPrebook(null); setPrebookCodeInput(''); setIsCredit(false); setDueDate(''); setDueNarration('');
      setActiveDenominations(null); setActiveTendered(null); setActiveChange(null);
      await loadBills(editingBillUid ? billPage : 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Start in-place editing ── */
  const startEdit = async (uid) => {
    setError(null);
    setSavedBillUid(null);
    try {
      const res = await getBill(uid);
      const b = res.data;
      setCustomer({ uid: b.customer_uid, customer_name: b.customer_name, mobile_number: b.mobile_number });
      setItems(b.items.map(i => ({
        key: generateClientUid(),
        stock_uid: i.stock_uid,
        design_number: i.design_number,
        image_filename: i.image_filename,
        is_home_bill: Boolean(i.is_home_bill),
        pieces: Number(i.pieces),
        rate_per_piece: Number(i.rate_per_piece),
      })));
      setDiscount(String(b.discount));
      setIsHomeBill(Boolean(b.is_home_bill));
      setIsCredit(Boolean(b.is_credit));
      setDueDate(b.due_date ? String(b.due_date).slice(0, 10) : '');
      setDueNarration(b.due_narration || '');
      setPayments(b.payments.map(p => ({
        key: generateClientUid(),
        payment_mode: p.payment_mode,
        mode_name: p.payment_mode,
        amount: Number(p.amount),
        transaction_date: p.transaction_date ? String(p.transaction_date).slice(0, 10) : null,
        ref_number: p.ref_number || null,
        bank_uid: p.bank_uid || null,
        bank_name: p.bank_name ? `${p.bank_name} (${p.bank_code || ''})` : null,
        denominations: p.denominations ? (typeof p.denominations === 'string' ? JSON.parse(p.denominations) : p.denominations) : null,
        tendered_amount: p.tendered_amount !== null && p.tendered_amount !== undefined ? Number(p.tendered_amount) : null,
        change_returned: p.change_returned !== null && p.change_returned !== undefined ? Number(p.change_returned) : null
      })));
      setEditingBillUid(b.uid);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(`Failed to load bill for editing: ${err.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingBillUid(null);
    setIsHomeBill(false);
    setIsCredit(false);
    setDueDate('');
    setDueNarration('');
    setItems([]); setPayments([]); setDiscount('0'); setCustomer(null); setError(null); setSavedBillUid(null);
  };

  /* ── Delete handler ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteBill(deleteTarget.uid);
    setDeleteTarget(null);
    if (editingBillUid === deleteTarget.uid) cancelEdit();
    await loadBills(billPage);
  };

  /* ── Pagination helpers ── */
  const billTotalPages  = Math.max(Math.ceil(billTotal / billPageSize), 1);
  const billStartRecord = billTotal === 0 ? 0 : (billPage - 1) * billPageSize + 1;
  const billEndRecord   = Math.min(billPage * billPageSize, billTotal);

  const billPageNumbers = Array.from({ length: billTotalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === billTotalPages || Math.abs(p - billPage) <= 2)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Billing</h1>
        
        {/* ── Home Bill Option Toggle ── */}
        <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          padding: '0.45rem 0.95rem',
          borderRadius: 8,
          border: isHomeBill ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
          background: isHomeBill ? '#f5f3ff' : '#fff',
          boxShadow: isHomeBill ? '0 0 0 3px rgba(124, 58, 237, 0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={isHomeBill}
            onChange={(e) => setIsHomeBill(e.target.checked)}
            style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#7c3aed', margin: 0 }}
          />
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isHomeBill ? '#6d28d9' : '#334155' }}>
            🏠 Home Bill {isHomeBill ? '(0-Stock Allowed)' : ''}
          </span>
        </label>
      </div>

      {/* ── Editing Header Alert ── */}
      {editingBillUid && (
        <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
          <span>✏️ Editing Bill — <strong>{customer?.customer_name}</strong> {isHomeBill ? '(🏠 Home Bill)' : ''}</span>
          <button type="button" onClick={cancelEdit} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            Cancel editing
          </button>
        </div>
      )}

      {/* ── 2-Column POS Billing Workspace ── */}
      <div className="billing-workspace-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '1.25rem', alignItems: 'start', marginBottom: '1.5rem' }}>

        {/* ── Left Column: Pre-booking load, Customer, Add Item & Items Table ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* 🔖 Load from Pre-booking Card */}
          <div className="card" style={{ marginBottom: 0, border: '1.5px solid #c4b5fd', background: '#faf5ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <h3 style={{ margin: 0, color: '#6d28d9', fontSize: '0.95rem' }}>🔖 Load from Pre-booking</h3>
              {loadedPrebook && (
                <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700, background: '#dcfce7', border: '1px solid #bbf7d0', padding: '0.15rem 0.5rem', borderRadius: 6 }}>
                  ✓ {loadedPrebook.code} Active (Advance ₹{inr(loadedPrebook.amount)})
                </span>
              )}
            </div>
            <div className="form-row" style={{ alignItems: 'center', margin: 0 }}>
              <input
                placeholder="Enter Pre-booking code (e.g. PB-1001)"
                value={prebookCodeInput}
                onChange={(e) => setPrebookCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLoadPrebooking(); }}
                style={{ textTransform: 'uppercase', fontWeight: 600, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleLoadPrebooking}
                disabled={prebookLoading}
                style={{ background: '#7c3aed', color: '#fff', fontWeight: 600, padding: '0.55rem 1.1rem', cursor: 'pointer' }}
              >
                {prebookLoading ? 'Loading…' : 'Load Pre-booking'}
              </button>
              {loadedPrebook && (
                <button
                  type="button"
                  onClick={() => { setLoadedPrebook(null); setPrebookCodeInput(''); }}
                  style={{ background: '#94a3b8', color: '#fff', fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Customer card */}
          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Customer <span style={{ color: '#ef4444' }}>*</span></h3>
            {customer ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{customer.customer_name}</strong>
                  <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.85rem' }}>({customer.mobile_number})</span>
                </div>
                {!editingBillUid && (
                  <button type="button" style={{ background: '#0284c7', color: '#fff', fontSize: '0.8rem', padding: '0.3rem 0.65rem' }} onClick={() => setCustomer(null)}>
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
                    <input placeholder="Customer name *" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                    <input placeholder="Mobile number *" value={newCustomerMobile} maxLength={10} onChange={(e) => setNewCustomerMobile(e.target.value.replace(/\D/g, ''))} />
                    <button type="button" onClick={saveNewCustomer}>Save customer</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Add stock item card */}
          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Add stock item</h3>
            <div className="form-row">
              <input placeholder="Enter stock/design code" value={designCode} onChange={(e) => setDesignCode(e.target.value.replace(/\D/g, ''))} />
              <button type="button" onClick={loadByCode}>Load by code</button>
            </div>
            <ImageMatchPicker key={pickerKey} autoStartCamera={false} onResolved={handleImageResolved} />
            {pendingStock && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }}>
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
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Design #{pendingStock.design_number}</span>
                        {pendingStock.is_home_bill_item ? (
                          <span style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 }}>
                            🏠 Non-Stock (Home Bill)
                          </span>
                        ) : (
                          <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 }}>
                            📦 Store Stock Item
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Size: {pendingStock.width_ft ? `${pendingStock.width_ft} x ${pendingStock.height_ft} x ${pendingStock.thickness_mm}mm` : 'Standard'}
                      </div>
                    </div>
                  </div>

                  {/* Available Stock Badge */}
                  {!pendingStock.is_home_bill_item && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                        Physical: {Number(pendingStock.physical_stock_pcs ?? pendingStock.available_pcs ?? 0)} pcs {Number(pendingStock.total_prebooked_pcs || 0) > 0 ? `(${pendingStock.total_prebooked_pcs} pre-booked)` : ''}
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
                        Free to Bill: {Number(pendingStock.available_pcs || 0).toLocaleString('en-IN')} pcs
                      </div>
                    </div>
                  )}
                </div>

                {/* Stock alert message */}
                {pendingStock.is_home_bill_item ? (
                  <div style={{
                    marginBottom: '0.85rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 6,
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    color: '#6d28d9'
                  }}>
                    ✓ <strong>Home Bill Non-Stock Item:</strong> This item is not from store inventory (0-stock). Enter pieces and selling rate freely.
                  </div>
                ) : (Number(pendingStock.available_pcs || 0) <= 0 ? (
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
                    {Number(pendingStock.total_prebooked_pcs || 0) > 0 ? (
                      <span>⛔ <strong>Pre-booked / Reserved:</strong> All {pendingStock.total_prebooked_pcs} pcs are reserved for customer orders. Store stock items must have available stock to bill.</span>
                    ) : (
                      <span>⛔ <strong>Out of Stock (0 pcs):</strong> This is a store stock item and must be billed from available physical stock.</span>
                    )}
                  </div>
                ) : (
                  <div style={{
                    marginBottom: '0.85rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 6,
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15803d'
                  }}>
                    📦 <strong>Store Stock Item:</strong> Available in stock ({Number(pendingStock.available_pcs).toLocaleString('en-IN')} pcs). Billed pieces will deduct from physical store stock.
                  </div>
                ))}

                {/* Input Form Fields for Pieces and Rate */}
                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                  <label>
                    Pieces <span style={{ color: '#ef4444' }}>*</span>
                    <NumericInput value={linePieces} onChange={setLinePieces} placeholder="Enter pieces to bill" />
                  </label>
                  <label>
                    Rate / piece (₹) <span style={{ color: '#ef4444' }}>*</span>
                    <NumericInput value={lineRate} onChange={setLineRate} placeholder="Rate per piece" />
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    style={{
                      background: (!pendingStock.is_home_bill_item && Number(pendingStock.available_pcs || 0) <= 0) ? '#94a3b8' : '#16a34a',
                      color: '#fff',
                      fontWeight: 600,
                      padding: '0.55rem 1.25rem',
                      cursor: (!pendingStock.is_home_bill_item && Number(pendingStock.available_pcs || 0) <= 0) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {pendingStock.is_home_bill_item ? '+ Add non-stock item' : '+ Add stock item'}
                  </button>
                </div>

                {/* Live Remaining Stock Indicator for stock items */}
                {!pendingStock.is_home_bill_item && linePieces && (
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
                        ⚠️ Warning: Entered <strong>{Number(linePieces).toLocaleString('en-IN')} pcs</strong> exceeds available stock ({Number(pendingStock.available_pcs || 0).toLocaleString('en-IN')} pcs)!
                      </span>
                    ) : (
                      <span>
                        ✓ Remaining Store Stock after this item: <strong>{(Number(pendingStock.available_pcs || 0) - Number(linePieces || 0)).toLocaleString('en-IN')} pcs</strong> (out of {Number(pendingStock.available_pcs || 0).toLocaleString('en-IN')} pcs)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Added Items table */}
          {items.length > 0 && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <h4 style={{ margin: 0, color: '#1e293b' }}>Added Bill Items ({items.length})</h4>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Total: <strong>{totalPieces.toLocaleString('en-IN')} pcs</strong> • <strong>₹{inr(totalAmount)}</strong>
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 45, textAlign: 'right' }}>S.No</th>
                    <th>Design #</th>
                    <th>Item Type</th>
                    <th className="num-cell">Pieces</th>
                    <th className="num-cell">Rate / piece</th>
                    <th className="num-cell">Line Amount</th>
                    <th className="actions-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={i.key}>
                      <td className="num-cell">{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>Design #{i.design_number}</td>
                      <td>
                        {i.is_home_bill ? (
                          <span style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                            🏠 Home Bill (Non-Stock)
                          </span>
                        ) : (
                          <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                            📦 From Stock
                          </span>
                        )}
                      </td>
                      <td className="num-cell">{Number(i.pieces).toLocaleString('en-IN')}</td>
                      <td className="num-cell">₹{inr(i.rate_per_piece)}</td>
                      <td className="num-cell" style={{ fontWeight: 600, color: '#1e293b' }}>₹{inr(i.pieces * i.rate_per_piece)}</td>
                      <td className="action-cell">
                        <button className="icon-btn delete-btn" title="Remove item" onClick={() => removeItem(i.key)}>
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                    <td colSpan={3} style={{ textAlign: 'right' }}>Total:</td>
                    <td className="num-cell" style={{ color: '#0f172a' }}>{totalPieces.toLocaleString('en-IN')} pcs</td>
                    <td></td>
                    <td className="num-cell" style={{ color: '#0f172a', fontSize: '0.92rem' }}>₹{inr(totalAmount)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>

        {/* ── Right Column: Totals & Payments Summary Card (Sticky & Compact) ── */}
        <div className="billing-summary-sticky" style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ marginBottom: 0, padding: '0.85rem 1rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.65rem', fontSize: '1rem' }}>
              Bill Summary
            </h3>

            {/* Totals Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.84rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Items / Pieces:</span>
                <strong style={{ color: '#1e293b' }}>{items.length} items ({totalPieces} pcs)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Total Amount:</span>
                <strong style={{ color: '#1e293b' }}>₹{inr(totalAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Discount (₹):</span>
                <div style={{ width: 95 }}>
                  <NumericInput value={discount} onChange={setDiscount} placeholder="0.00" style={{ width: '100%', boxSizing: 'border-box', padding: '0.3rem 0.5rem', fontSize: '0.84rem' }} />
                </div>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.45rem 0.65rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 6,
                marginTop: '0.15rem',
                fontSize: '0.88rem',
                color: '#166534'
              }}>
                <span style={{ fontWeight: 600 }}>Net Amount:</span>
                <strong style={{ fontSize: '1rem', color: '#15803d' }}>₹{inr(netAmount)}</strong>
              </div>

              {/* ── Tax Section ── */}
              {isGstRegistered && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.65rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: '0.83rem' }}>
                  <div style={{ fontWeight: 700, color: '#78350f', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                    {isInterState ? '🌐 IGST (Inter-state)' : '📋 GST (Intra-state)'}
                    {customerState && companyState && (
                      <span style={{ fontWeight: 400, color: '#92400e', marginLeft: '0.3rem' }}>— {customerState}</span>
                    )}
                  </div>
                  {!isInterState ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#92400e' }}>
                        <span>CGST ({cgstPct}%):</span>
                        <strong>₹{inr(cgstAmt)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#92400e', marginTop: '0.2rem' }}>
                        <span>SGST ({sgstPct}%):</span>
                        <strong>₹{inr(sgstAmt)}</strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#92400e' }}>
                      <span>IGST ({igstPct}%):</span>
                      <strong>₹{inr(igstAmt)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#78350f', borderTop: '1px solid #fde68a', marginTop: '0.35rem', paddingTop: '0.3rem' }}>
                    <span>Tax Total:</span>
                    <span>₹{inr(taxTotal)}</span>
                  </div>
                </div>
              )}

              {/* Grand Total */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.65rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 6,
                marginTop: '0.35rem',
                fontSize: '0.92rem',
                color: '#e2e8f0'
              }}>
                <span style={{ fontWeight: 700 }}>Grand Total:</span>
                <strong style={{ fontSize: '1.1rem', color: '#fff' }}>₹{inr(grandTotal)}</strong>
              </div>

              {/* ── Credit / Due Option Card ── */}
              <div style={{
                marginTop: '0.65rem',
                padding: '0.65rem 0.75rem',
                background: isCredit ? '#fffbeb' : '#f8fafc',
                border: isCredit ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                borderRadius: 6,
                transition: 'all 0.15s ease',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: isCredit ? '#92400e' : '#334155',
                  userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    checked={isCredit}
                    onChange={(e) => setIsCredit(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#d97706', cursor: 'pointer', margin: 0 }}
                  />
                  <span>💳 Keep Balance as Credit / Due</span>
                </label>

                {isCredit && (
                  <div style={{ marginTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', display: 'block', marginBottom: '0.2rem' }}>
                        Payment Due Date <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', display: 'block', marginBottom: '0.2rem' }}>
                        Due Narration / Reason <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Customer will pay balance on Friday"
                        value={dueNarration}
                        onChange={(e) => setDueNarration(e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.35rem 0.55rem',
                      background: '#fff',
                      border: '1px solid #fde68a',
                      borderRadius: 4,
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#b45309',
                      marginTop: '0.15rem'
                    }}>
                      <span>Remaining Due:</span>
                      <span style={{ fontSize: '0.92rem', color: '#dc2626' }}>₹{inr(Math.max(0, grandTotal - paymentsSum))}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payments Section */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.65rem', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>💳</span> Payments
                </h4>
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

              {/* Payment Input Grid */}
              <div style={{ background: '#f8fafc', padding: '0.55rem', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: '0.55rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginBottom: '0.35rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                      Payment Mode
                    </label>
                    <SearchableSelect
                      options={paymentModesList.map((m) => ({
                        value: m.mode_code,
                        label: m.mode_name,
                        sublabel: m.is_bank_linked ? 'Bank Linked 🏦' : m.is_cash ? 'Cash Mode 💵' : ''
                      }))}
                      value={paymentMode}
                      onChange={(val) => setPaymentMode(val)}
                      placeholder="Select Mode"
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                      Txn Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Bank Account Selection if Bank Linked */}
                {(currentModeObj.is_bank_linked || banksList.length > 0) && (
                  <div style={{ marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                      Bank Account {currentModeObj.is_bank_linked ? <span style={{ color: '#ef4444' }}>*</span> : '(Optional)'}
                    </label>
                    <SearchableSelect
                      options={banksList.map((b) => ({
                        value: b.uid,
                        label: `${b.bank_name} (${b.bank_code})`,
                        sublabel: `Acc: ${b.account_number}`
                      }))}
                      value={paymentBankUid}
                      onChange={(val) => setPaymentBankUid(val)}
                      placeholder="-- Select Bank Account --"
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: '0.35rem', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                      Ref / Txn No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR / Chq #"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      style={{ width: '100%', padding: '0.3rem 0.45rem', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                      Amount (₹)
                    </label>
                    <NumericInput
                      value={paymentAmount}
                      onChange={setPaymentAmount}
                      placeholder={grandTotal > paymentsSum ? String(grandTotal - paymentsSum) : '0'}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.3rem 0.45rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addPayment}
                    style={{
                      padding: '0.35rem 0.65rem',
                      background: '#0284c7',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      height: '30px'
                    }}
                  >
                    + Add
                  </button>
                </div>

                {activeChange !== null && activeChange > 0 && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.2rem 0.45rem', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                    💵 Cash Tendered: ₹{inr(activeTendered)} | Change to Return: ₹{inr(activeChange)}
                  </div>
                )}
              </div>

              {payments.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.35rem 0 0.55rem 0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {payments.map((p) => (
                    <li
                      key={p.key}
                      style={{
                        padding: '0.35rem 0.5rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 5,
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                            {p.mode_name || p.payment_mode}
                          </span>
                          {p.bank_name && (
                            <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.35rem', borderRadius: 3, fontWeight: 600 }}>
                              🏦 {p.bank_name}
                            </span>
                          )}
                          {p.ref_number && (
                            <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
                              (Ref: {p.ref_number})
                            </span>
                          )}
                          {p.transaction_date && (
                            <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                              • {p.transaction_date}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontWeight: 700, color: '#0284c7' }}>
                            ₹{inr(p.amount)}
                          </span>
                          <button className="icon-btn delete-btn" style={{ width: 18, height: 18 }} title="Remove Payment" onClick={() => removePayment(p.key)}>
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                      {p.change_returned > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '0.15rem' }}>
                          Tendered: ₹{inr(p.tendered_amount)} | Returned Change: ₹{inr(p.change_returned)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '0.55rem' }}>
                  No payments added yet.
                </div>
              )}
            </div>

            {/* Payment Status / Balance Due */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.4rem 0.55rem',
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
              background: paymentsSum === grandTotal ? '#f0fdf4' : paymentsSum > grandTotal ? '#fff1f2' : '#fefce8',
              border: paymentsSum === grandTotal ? '1px solid #bbf7d0' : paymentsSum > grandTotal ? '1px solid #fecdd3' : '1px solid #fef08a',
              color: paymentsSum === grandTotal ? '#15803d' : paymentsSum > grandTotal ? '#e11d48' : '#854d0e',
              marginBottom: '0.65rem'
            }}>
              <span>Paid: ₹{inr(paymentsSum)}</span>
              <span>
                {paymentsSum === grandTotal
                  ? '✓ Balanced'
                  : paymentsSum > grandTotal
                  ? `Overpaid: ₹${inr(paymentsSum - grandTotal)}`
                  : `Due: ₹${inr(grandTotal - paymentsSum)}`}
              </span>
            </div>

            {error && <div className="field-error" style={{ marginBottom: '0.65rem', fontSize: '0.8rem' }}>{error}</div>}
            {savedBillUid && <div className="success" style={{ marginBottom: '0.65rem', fontSize: '0.8rem' }}>✓ {savedBillUid}</div>}

            {/* Save / Update Button */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={saveBill}
                disabled={saving || items.length === 0}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  background: (isCredit || paymentsSum === grandTotal) && items.length > 0 ? '#16a34a' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: (saving || items.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Processing…' : editingBillUid ? 'Update Bill' : 'Save & Print Bill'}
              </button>
              {editingBillUid && (
                <button type="button" onClick={cancelEdit} style={{ background: '#94a3b8', color: '#fff', border: 'none', padding: '0.55rem', fontSize: '0.85rem' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Today's Bills History ── */}
      <h2 style={{ marginTop: '1.5rem' }}>Today's Bills</h2>

      <div className={`table-toolbar ${loadingBills ? 'is-loading' : ''}`}>
        <span className="pagination-info" style={{ flex: 1 }}>
          {billTotal === 0 ? 'No bills today yet.' : `${billTotal} bill${billTotal !== 1 ? 's' : ''} today`}
        </span>
        <label className="records-per-page">
          Show&nbsp;
          <select value={billPageSize} disabled={loadingBills} onChange={(e) => { const ps = Number(e.target.value); setBillPageSize(ps); loadBills(1, { pageSize: ps }); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={BILLING_HISTORY_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <TableContainer loading={loadingBills} text="Loading today's bills…" subtext="Fetching sales bills for today">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 50, textAlign: 'right' }}>S.No</th>}
              {isVisible('customer') && <th>Customer</th>}
              {isVisible('mobile') && <th>Mobile</th>}
              {isVisible('total') && <th className="num-cell">Total</th>}
              {isVisible('discount') && <th className="num-cell">Discount</th>}
              {isVisible('net_amount') && <th className="num-cell">Net Amount</th>}
              {isVisible('time') && <th>Time</th>}
              {isVisible('actions') && <th className="actions-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {billRows.map((b, idx) => (
              <tr key={b.uid} style={editingBillUid === b.uid ? { background: '#f0f9ff' } : {}}>
                {isVisible('sno') && <td className="num-cell">{(billPage - 1) * billPageSize + idx + 1}</td>}
                {isVisible('customer') && (
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{b.customer_name}</span>
                      {b.prebook_code ? (
                        <span style={{ fontSize: '0.72rem', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                          🔖 {b.prebook_code}
                        </span>
                      ) : null}
                      {b.is_home_bill ? (
                        <span style={{ fontSize: '0.72rem', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                          🏠 Home Bill
                        </span>
                      ) : null}
                      {b.is_credit ? (
                        <span style={{ fontSize: '0.72rem', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                          💳 Due: ₹{inr(b.due_amount)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                )}
                {isVisible('mobile') && <td>{b.mobile_number}</td>}
                {isVisible('total') && <td className="num-cell">₹{inr(b.total_amount)}</td>}
                {isVisible('discount') && <td className="num-cell">₹{inr(b.discount)}</td>}
                {isVisible('net_amount') && <td className="num-cell">₹{inr(b.net_amount)}</td>}
                {isVisible('time') && <td>{new Date(b.entry_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>}
                {isVisible('actions') && (
                  <td className="action-cell">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Print 58mm Thermal PDF (Opens in new tab)"
                      disabled={loadingBills}
                      onClick={() => openReceiptPdf(b.uid, 'bill')}
                      style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '0.25rem 0.4rem', borderRadius: 4, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      🖨️
                    </button>
                    <button className="icon-btn edit-btn" title="Edit" disabled={loadingBills} onClick={() => startEdit(b.uid)}><IconEdit /></button>
                    <button className="icon-btn delete-btn" title="Delete" disabled={loadingBills} onClick={() => setDeleteTarget({ uid: b.uid, customer_name: b.customer_name })}><IconTrash /></button>
                  </td>
                )}
              </tr>
            ))}
            {billRows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>{loadingBills ? "Loading today's bills…" : "No bills recorded today."}</td></tr>
            )}
          </tbody>
          {/* ── Grand total footer ── */}
          {billTotal > 0 && (
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td colSpan={Math.max(1, [isVisible('sno'), isVisible('customer'), isVisible('mobile'), isVisible('total'), isVisible('discount')].filter(Boolean).length)} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontSize: '0.9rem', color: '#475569' }}>
                  Today's Grand Total (all {billTotal} bills):
                </td>
                {isVisible('net_amount') && (
                  <td className="num-cell" style={{ padding: '0.5rem 0.6rem', fontSize: '0.95rem', color: '#1e293b' }}>
                    ₹{inr(todayGrandTotal)}
                  </td>
                )}
                {isVisible('time') && <td></td>}
                {isVisible('actions') && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </TableContainer>

      {/* ── Pagination ── */}
      {billTotal > 0 && (
        <div className={`pagination-bar ${loadingBills ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {billStartRecord}–{billEndRecord} of {billTotal} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loadingBills || billPage <= 1} onClick={() => !loadingBills && loadBills(1)} title="First">«</button>
            <button className="page-btn" disabled={loadingBills || billPage <= 1} onClick={() => !loadingBills && loadBills(billPage - 1)} title="Prev">‹</button>
            {billPageNumbers.map((item, idx) =>
              item === '...'
                ? <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                : <button key={item} className={`page-btn${item === billPage ? ' active' : ''}`} disabled={loadingBills} onClick={() => !loadingBills && loadBills(item)}>{item}</button>
            )}
            <button className="page-btn" disabled={loadingBills || billPage >= billTotalPages} onClick={() => !loadingBills && loadBills(billPage + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loadingBills || billPage >= billTotalPages} onClick={() => !loadingBills && loadBills(billTotalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <DeleteModal customerName={deleteTarget.customer_name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* ── Cash Denomination & Change Modal ── */}
      <CashDenominationModal
        isOpen={showDenomModal}
        requiredAmount={paymentAmount !== '' ? Number(paymentAmount) : Math.max(0, grandTotal - paymentsSum)}
        initialDenominations={activeDenominations}
        initialTendered={activeTendered}
        onApply={({ denominations, tendered_amount, change_returned, amount }) => {
          setActiveDenominations(denominations);
          setActiveTendered(tendered_amount);
          setActiveChange(change_returned);
          if (amount > 0) setPaymentAmount(String(amount));
        }}
        onClose={() => setShowDenomModal(false)}
      />
    </div>
  );
}


