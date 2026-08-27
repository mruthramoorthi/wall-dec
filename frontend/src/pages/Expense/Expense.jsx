import { useState, useEffect } from 'react';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '../../api/expense.js';
import { listExpenseCategories } from '../../api/expenseCategory.js';
import { listPaymentModes } from '../../api/paymentMode.js';
import { listBanks } from '../../api/bank.js';
import NumericInput from '../../components/NumericInput.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import CashDenominationModal from '../../components/CashDenominationModal.jsx';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';
import { openReceiptPdf } from '../../utils/printPdf.js';

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXPENSE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'expense_date', label: 'Expense Date', defaultVisible: true },
  { key: 'category', label: 'Category / Purpose', defaultVisible: true },
  { key: 'amount', label: 'Amount (₹)', defaultVisible: true },
  { key: 'payment_mode', label: 'Payment Details', defaultVisible: true },
  { key: 'narration', label: 'Narration / Notes', defaultVisible: true },
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

function IconEdit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

export default function Expense() {
  // Form states (Create / Edit)
  const [expenseDate, setExpenseDate]   = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory]         = useState('');
  const [amount, setAmount]             = useState('');
  const [paymentMode, setPaymentMode]   = useState('cash');
  const [bankUid, setBankUid]           = useState('');
  const [refNumber, setRefNumber]       = useState('');
  const [narration, setNarration]       = useState('');
  const [editingUid, setEditingUid]     = useState(null);

  // Cash Denominations
  const [denominations, setDenominations] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState(null);
  const [changeReturned, setChangeReturned] = useState(null);
  const [showDenomModal, setShowDenomModal] = useState(false);

  // Master lists
  const [paymentModesList, setPaymentModesList] = useState(DEFAULT_PAYMENT_MODES);
  const [banksList, setBanksList]               = useState([]);
  const [masterCategories, setMasterCategories] = useState([]);

  // Table / List states
  const [expenses, setExpenses]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [grandTotal, setGrandTotal]   = useState(0);
  const [categoriesList, setCategoriesList] = useState([]);
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(20);
  const [search, setSearch]           = useState('');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [filterCat, setFilterCat]     = useState('all');
  const [filterMode, setFilterMode]   = useState('all');
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [success, setSuccess]         = useState(null);

  // Delete modal & Thermal print modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [printTarget, setPrintTarget]   = useState(null);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'expense_columns',
    EXPENSE_COLS
  );

  const loadExpenses = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const ps = opts.pageSize ?? pageSize;
      const s  = opts.search !== undefined ? opts.search : search;
      const fd = opts.fromDate !== undefined ? opts.fromDate : fromDate;
      const td = opts.toDate !== undefined ? opts.toDate : toDate;
      const fc = opts.filterCat !== undefined ? opts.filterCat : filterCat;
      const fm = opts.filterMode !== undefined ? opts.filterMode : filterMode;

      const res = await listExpenses(p, ps, {
        search: s,
        fromDate: fd,
        toDate: td,
        category: fc,
        paymentMode: fm
      });

      setExpenses(res.data || []);
      setTotal(res.total || 0);
      setGrandTotal(res.grandTotal || 0);
      setCategoriesList(res.categories || []);
      setPage(res.page || p);
    } catch (err) {
      setError(`Failed to load expenses: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses(1);

    listExpenseCategories(1, 100, { all: true })
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setMasterCategories(res.data);
        }
      })
      .catch((e) => console.warn('Expense categories load error:', e));

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
  }, []);

  const currentModeMeta = paymentModesList.find(
    (m) => (m.mode_code || m.mode_name).toLowerCase() === (paymentMode || '').toLowerCase()
  ) || { is_cash: paymentMode === 'cash' ? 1 : 0, is_bank_linked: paymentMode !== 'cash' ? 1 : 0 };

  const isCashMode = currentModeMeta.is_cash === 1 || paymentMode === 'cash';
  const isBankMode = currentModeMeta.is_bank_linked === 1 || !isCashMode;

  const resetForm = () => {
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setCategory('');
    setAmount('');
    setPaymentMode(paymentModesList[0]?.mode_code || 'cash');
    setBankUid('');
    setRefNumber('');
    setNarration('');
    setDenominations(null);
    setTenderedAmount(null);
    setChangeReturned(null);
    setEditingUid(null);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!category || !category.trim()) {
      setError('Please enter or select an expense category / purpose.');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid positive expense amount.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        expense_date: expenseDate,
        category: category.trim(),
        amount: Number(amount),
        payment_mode: paymentMode,
        bank_uid: isBankMode && bankUid ? bankUid : null,
        ref_number: isBankMode && refNumber ? refNumber.trim() : null,
        narration: narration ? narration.trim() : null,
        denominations: isCashMode ? denominations : null,
        tendered_amount: isCashMode ? tenderedAmount : null,
        change_returned: isCashMode ? changeReturned : null
      };

      let savedRecord;
      if (editingUid) {
        const res = await updateExpense(editingUid, payload);
        savedRecord = res?.data;
        setSuccess('Expense updated successfully!');
      } else {
        const res = await createExpense(payload);
        savedRecord = res?.data;
        setSuccess('Expense recorded successfully!');
      }

      resetForm();
      await loadExpenses(editingUid ? page : 1);

      if (savedRecord?.uid) {
        openReceiptPdf(savedRecord.uid, 'expense');
      }
    } catch (err) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (exp) => {
    setEditingUid(exp.uid);
    setExpenseDate(exp.expense_date || new Date().toISOString().slice(0, 10));
    setCategory(exp.category || '');
    setAmount(String(exp.amount || ''));
    setPaymentMode(exp.payment_mode || 'cash');
    setBankUid(exp.bank_uid || '');
    setRefNumber(exp.ref_number || '');
    setNarration(exp.narration || '');
    setDenominations(exp.denominations || null);
    setTenderedAmount(exp.tendered_amount || null);
    setChangeReturned(exp.change_returned || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense(deleteTarget.uid);
      setDeleteTarget(null);
      await loadExpenses(page);
      setSuccess('Expense deleted successfully.');
    } catch (err) {
      setError(`Failed to delete expense: ${err.message}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <span>💸</span> Business Expenses
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Record all company expense outflows with multi-mode payments, bank linkage, cash denominations & 58mm thermal receipts
          </p>
        </div>

        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 1rem', borderRadius: 8, textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Filtered Expenses ({total} entries)
          </div>
          <div style={{ fontSize: '1.25rem', color: '#b91c1c', fontWeight: 900 }}>
            ₹{inr(grandTotal)}
          </div>
        </div>
      </div>

      {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem', fontWeight: 600, fontSize: '0.9rem' }}>
          ✓ {success}
        </div>
      )}

      {/* ── Expense Entry Form Card ── */}
      <form onSubmit={handleSave} className="form-card" style={{ marginBottom: '2rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span>{editingUid ? '✏️ Edit Expense Record' : '➕ Record New Expense Outflow'}</span>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-start' }}>
          {/* Expense Date */}
          <div className="form-group">
            <label>Expense Date *</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          {/* Category / Purpose */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <label style={{ margin: 0 }}>Expense Category *</label>
              <a
                href="/expense-category"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.74rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
              >
                + Manage Categories ↗
              </a>
            </div>
            <SearchableSelect
              options={masterCategories.map((c) => ({ value: c.category_name, label: c.category_name }))}
              value={category}
              onChange={(val) => setCategory(val)}
              placeholder="-- Select Expense Category --"
              allowCustom={true}
              required={true}
            />
          </div>

          {/* Amount */}
          <div className="form-group">
            <label>Amount (₹) *</label>
            <NumericInput
              placeholder="0.00"
              value={amount}
              onChange={(val) => setAmount(val)}
              style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b91c1c' }}
            />
          </div>

          {/* Payment Mode */}
          <div className="form-group">
            <label>Payment Method *</label>
            <SearchableSelect
              options={paymentModesList.map((m) => ({ value: m.mode_code || m.mode_name, label: m.mode_name || m.mode_code }))}
              value={paymentMode}
              onChange={(val) => {
                setPaymentMode(val);
                if (val !== 'cash') {
                  setDenominations(null);
                  setTenderedAmount(null);
                  setChangeReturned(null);
                }
              }}
              placeholder="-- Select Payment Method --"
            />
          </div>
        </div>

        {/* Dynamic Payment Details (Bank / Cash Denominations) */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.85rem 1rem', margin: '1rem 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', alignItems: 'center' }}>
            {isBankMode && (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.82rem' }}>Paid via Bank Account</label>
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

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.82rem' }}>Reference / UTR / Cheque No.</label>
                  <input
                    type="text"
                    placeholder="Ref / Txn No."
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            {isCashMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowDenomModal(true)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    background: denominations ? '#dcfce7' : '#f1f5f9',
                    color: denominations ? '#15803d' : '#334155',
                    border: denominations ? '1px solid #86efac' : '1px solid #cbd5e1',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span>💵</span> {denominations ? '✓ Cash Denominations Added' : 'Add Cash Denominations & Change'}
                </button>
                {tenderedAmount > 0 && (
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                    Tendered: <strong>₹{inr(tenderedAmount)}</strong> {changeReturned > 0 ? `| Change: ₹${inr(changeReturned)}` : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Narration / Note */}
          <div className="form-group" style={{ margin: '0.85rem 0 0 0' }}>
            <label style={{ fontSize: '0.82rem' }}>Narration / Note / Remarks</label>
            <textarea
              rows={2}
              placeholder="Enter any additional expense details, supplier/vendor name, receipt notes…"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              style={{ width: '100%', fontSize: '0.88rem', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          {editingUid && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel Edit
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ background: '#b91c1c', borderColor: '#991b1b', padding: '0.55rem 1.4rem', fontWeight: 700 }}
          >
            {saving ? 'Recording Expense…' : editingUid ? '✓ Update Expense' : '+ Record Expense'}
          </button>
        </div>
      </form>

      {/* ── Filter Toolbar ── */}
      <h2>Expense History Log</h2>
      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <input
          type="text"
          placeholder="Search by category, narration, ref, mode…"
          value={search}
          disabled={loading}
          onChange={(e) => {
            setSearch(e.target.value);
            loadExpenses(1, { search: e.target.value });
          }}
          style={{ minWidth: 240, fontSize: '0.88rem' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>From:</span>
          <input
            type="date"
            value={fromDate}
            disabled={loading}
            onChange={(e) => {
              setFromDate(e.target.value);
              loadExpenses(1, { fromDate: e.target.value });
            }}
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
          />
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>To:</span>
          <input
            type="date"
            value={toDate}
            disabled={loading}
            onChange={(e) => {
              setToDate(e.target.value);
              loadExpenses(1, { toDate: e.target.value });
            }}
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
          />
        </div>

        <div style={{ minWidth: 170 }}>
          <SearchableSelect
            options={[{ value: 'all', label: 'All Categories' }, ...categoriesList.map((c) => ({ value: c, label: c }))]}
            value={filterCat}
            disabled={loading}
            onChange={(val) => {
              setFilterCat(val);
              loadExpenses(1, { filterCat: val });
            }}
            placeholder="All Categories"
          />
        </div>

        <div style={{ minWidth: 180 }}>
          <SearchableSelect
            options={[{ value: 'all', label: 'All Payment Modes' }, ...paymentModesList.map((m) => ({ value: m.mode_code || m.mode_name, label: m.mode_name || m.mode_code }))]}
            value={filterMode}
            disabled={loading}
            onChange={(val) => {
              setFilterMode(val);
              loadExpenses(1, { filterMode: val });
            }}
            placeholder="All Payment Modes"
          />
        </div>

        <label className="records-per-page">
          Show&nbsp;
          <select
            value={pageSize}
            disabled={loading}
            onChange={(e) => {
              const ps = Number(e.target.value);
              setPageSize(ps);
              loadExpenses(1, { pageSize: ps });
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          &nbsp;records
        </label>

        <ColumnVisibility
          columns={EXPENSE_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      {/* ── Expense Data Table ── */}
      <TableContainer loading={loading} text="Loading expenses…" subtext="Fetching business expense outflow records">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 45, textAlign: 'right' }}>S.No</th>}
              {isVisible('expense_date') && <th style={{ width: 110 }}>Expense Date</th>}
              {isVisible('category') && <th>Category / Purpose</th>}
              {isVisible('amount') && <th className="num-cell">Amount (₹)</th>}
              {isVisible('payment_mode') && <th>Payment Details</th>}
              {isVisible('narration') && <th>Narration / Notes</th>}
              {isVisible('actions') && <th className="actions-th" style={{ width: 115 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, idx) => (
              <tr key={exp.uid} style={editingUid === exp.uid ? { background: '#fef2f2' } : {}}>
                {isVisible('sno') && (
                  <td className="num-cell" style={{ textAlign: 'right', color: '#94a3b8' }}>
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                )}
                {isVisible('expense_date') && (
                  <td>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {new Date(exp.expense_date).toLocaleDateString('en-IN')}
                    </span>
                  </td>
                )}
                {isVisible('category') && (
                  <td>
                    <span style={{ fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.84rem' }}>
                      {exp.category}
                    </span>
                  </td>
                )}
                {isVisible('amount') && (
                  <td className="num-cell" style={{ fontWeight: 800, color: '#b91c1c', fontSize: '0.94rem' }}>
                    ₹{inr(exp.amount)}
                  </td>
                )}
                {isVisible('payment_mode') && (
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                      <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700 }}>
                        {exp.payment_mode || 'Cash'}
                      </span>
                      {exp.bank_name && (
                        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                          🏦 {exp.bank_name} {exp.bank_code ? `(${exp.bank_code})` : ''}
                        </span>
                      )}
                      {exp.ref_number && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Ref: {exp.ref_number}
                        </span>
                      )}
                      {exp.change_returned > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                          Change: ₹{inr(exp.change_returned)}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {isVisible('narration') && (
                  <td style={{ color: exp.narration ? '#334155' : '#94a3b8', fontSize: '0.85rem' }}>
                    {exp.narration || '—'}
                  </td>
                )}
                {isVisible('actions') && (
                  <td className="action-cell">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Print 58mm Thermal Receipt PDF (Opens in new tab)"
                      disabled={loading}
                      onClick={() => openReceiptPdf(exp.uid, 'expense')}
                      style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '0.25rem 0.4rem', borderRadius: 4, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      🖨️
                    </button>
                    <button
                      type="button"
                      className="icon-btn edit-btn"
                      title="Edit Expense"
                      disabled={loading}
                      onClick={() => startEdit(exp)}
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-btn delete-btn"
                      title="Delete Expense"
                      disabled={loading}
                      onClick={() => setDeleteTarget(exp)}
                    >
                      <IconTrash />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                  {loading ? 'Loading expenses…' : 'No expense records found.'}
                </td>
              </tr>
            )}
          </tbody>

          {total > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                <td colSpan={3} style={{ textAlign: 'right', color: '#475569', fontSize: '0.9rem' }}>
                  Total Filtered Expenses ({total} records):
                </td>
                <td className="num-cell" style={{ color: '#b91c1c', fontSize: '1rem', fontWeight: 900 }}>
                  ₹{inr(grandTotal)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </TableContainer>

      {/* ── Pagination Bar ── */}
      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`} style={{ marginTop: '1rem' }}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadExpenses(1)} title="First">«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadExpenses(page - 1)} title="Prev">‹</button>
            <span style={{ padding: '0 8px', fontWeight: 600, fontSize: '0.88rem' }}>{page}</span>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadExpenses(page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadExpenses(totalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* ── Cash Denomination & Change Modal ── */}
      <CashDenominationModal
        isOpen={showDenomModal}
        requiredAmount={Number(amount) || 0}
        initialDenominations={denominations}
        initialTendered={tenderedAmount}
        onApply={({ denominations: denoms, tendered_amount, change_returned }) => {
          setDenominations(denoms);
          setTenderedAmount(tendered_amount);
          setChangeReturned(change_returned);
          setShowDenomModal(false);
        }}
        onClose={() => setShowDenomModal(false)}
      />

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <h3>Confirm Delete Expense</h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0.75rem 0' }}>
              Are you sure you want to delete this expense record for <strong>{deleteTarget.category}</strong> of <strong>₹{inr(deleteTarget.amount)}</strong>?
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: '#dc2626' }} onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
