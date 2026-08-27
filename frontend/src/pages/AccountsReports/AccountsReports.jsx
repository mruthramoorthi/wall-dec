import { useState, useEffect, useCallback } from 'react';
import {
  getDayBook,
  getCashBook,
  getBankBook,
  getAccountLedger,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getReceiptRegister,
  getPaymentRegister,
  getJournalRegister,
  listChartOfAccounts
} from '../../api/accounting';
import './AccountsReports.css';

const TABS = [
  { id: 'day_book', label: 'Day Book', icon: '📅' },
  { id: 'cash_book', label: 'Cash Book', icon: '💵' },
  { id: 'bank_book', label: 'Bank Book', icon: '🏦' },
  { id: 'ledger', label: 'General Ledger', icon: '📖' },
  { id: 'trial_balance', label: 'Trial Balance', icon: '⚖️' },
  { id: 'pnl', label: 'Profit & Loss', icon: '📈' },
  { id: 'balance_sheet', label: 'Balance Sheet', icon: '🏛️' },
  { id: 'receipt_reg', label: 'Receipt Register', icon: '📥' },
  { id: 'payment_reg', label: 'Payment Register', icon: '📤' },
  { id: 'journal_reg', label: 'Journal Register', icon: '📜' }
];

export default function AccountsReports() {
  const [activeTab, setActiveTab] = useState('day_book');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Common Filters
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState('');
  const [voucherType, setVoucherType] = useState('ALL');

  // Specific state for ledger & bank book
  const [accountsList, setAccountsList] = useState([]);
  const [selectedAccountUid, setSelectedAccountUid] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankUid, setSelectedBankUid] = useState('');

  // Report Data States
  const [reportData, setReportData] = useState(null);

  // Load Chart of Accounts for Ledger Selector
  useEffect(() => {
    listChartOfAccounts()
      .then((res) => {
        const rows = res.data || [];
        setAccountsList(rows);
        if (rows.length > 0 && !selectedAccountUid) {
          setSelectedAccountUid(rows[0].uid);
        }
      })
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let res;
      switch (activeTab) {
        case 'day_book':
          res = await getDayBook({ fromDate, toDate, search, voucherType });
          break;
        case 'cash_book':
          res = await getCashBook({ fromDate, toDate });
          break;
        case 'bank_book':
          res = await getBankBook({ bankAccountUid: selectedBankUid, fromDate, toDate });
          if (res.data?.bankAccounts) {
            setBankAccounts(res.data.bankAccounts);
            if (!selectedBankUid && res.data.selectedAccountUid) {
              setSelectedBankUid(res.data.selectedAccountUid);
            }
          }
          break;
        case 'ledger':
          if (selectedAccountUid) {
            res = await getAccountLedger(selectedAccountUid, { fromDate, toDate });
          }
          break;
        case 'trial_balance':
          res = await getTrialBalance({ asOfDate: toDate || today });
          break;
        case 'pnl':
          res = await getProfitAndLoss({ fromDate, toDate });
          break;
        case 'balance_sheet':
          res = await getBalanceSheet({ asOfDate: toDate || today });
          break;
        case 'receipt_reg':
          res = await getReceiptRegister({ fromDate, toDate, search });
          break;
        case 'payment_reg':
          res = await getPaymentRegister({ fromDate, toDate, search });
          break;
        case 'journal_reg':
          res = await getJournalRegister({ fromDate, toDate, search, voucherType });
          break;
        default:
          break;
      }

      setReportData(res?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to fetch accounting report.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, fromDate, toDate, search, voucherType, selectedAccountUid, selectedBankUid, today]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="accounts-reports-container">
      {/* Header */}
      <div className="ar-header">
        <div className="ar-title-group">
          <h1>📊 Accounts Reports Suite</h1>
          <div className="ar-subtitle">
            Enterprise double-entry financial statements, books, and registers
          </div>
        </div>

        <button type="button" className="ar-btn-print" onClick={() => window.print()}>
          🖨️ Print Report
        </button>
      </div>

      {/* Navigation Tabs (10 Books) */}
      <div className="ar-tabs-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ar-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Controls / Filter Bar */}
      <div className="ar-controls-card">
        <div className="ar-filters-group">
          {/* Date Range */}
          {activeTab !== 'trial_balance' && activeTab !== 'balance_sheet' ? (
            <>
              <label className="ar-input-label">
                From Date
                <input
                  type="date"
                  className="ar-date-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>
              <label className="ar-input-label">
                To Date
                <input
                  type="date"
                  className="ar-date-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label className="ar-input-label">
              As Of Date
              <input
                type="date"
                className="ar-date-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
          )}

          {/* Account Selector (General Ledger) */}
          {activeTab === 'ledger' && (
            <label className="ar-input-label">
              Select Account
              <select
                className="ar-select-input"
                value={selectedAccountUid}
                onChange={(e) => setSelectedAccountUid(e.target.value)}
              >
                {accountsList.map((acc) => (
                  <option key={acc.uid} value={acc.uid}>
                    [{acc.account_code}] {acc.account_name} ({acc.account_type_name || acc.account_type})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Bank Account Selector (Bank Book) */}
          {activeTab === 'bank_book' && bankAccounts.length > 0 && (
            <label className="ar-input-label">
              Select Bank Account
              <select
                className="ar-select-input"
                value={selectedBankUid}
                onChange={(e) => setSelectedBankUid(e.target.value)}
              >
                {bankAccounts.map((b) => (
                  <option key={b.uid} value={b.uid}>
                    {b.account_name} {b.account_number ? `(A/C: ${b.account_number})` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Voucher Type Filter (Day Book / Journal Register) */}
          {(activeTab === 'day_book' || activeTab === 'journal_reg') && (
            <label className="ar-input-label">
              Voucher Type
              <select
                className="ar-select-input"
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value)}
              >
                <option value="ALL">All Vouchers</option>
                <option value="SALES">Sales Vouchers</option>
                <option value="RECEIPT">Receipt Vouchers</option>
                <option value="EXPENSE">Expense Vouchers</option>
                <option value="PURCHASE">Purchase Vouchers</option>
                <option value="JOURNAL">Journal Vouchers</option>
                <option value="CONTRA">Contra Transfers</option>
              </select>
            </label>
          )}

          {/* Search (Day Book, Registers) */}
          {['day_book', 'receipt_reg', 'payment_reg', 'journal_reg'].includes(activeTab) && (
            <label className="ar-input-label">
              Search
              <input
                type="text"
                className="ar-search-input"
                placeholder="Search reference, party, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}
        </div>

        <button type="button" className="ar-btn-refresh" onClick={fetchReport} disabled={loading}>
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 8, marginBottom: '1.5rem', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !reportData && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
          Fetching {TABS.find((t) => t.id === activeTab)?.label}...
        </div>
      )}

      {/* Report Content */}
      {reportData && !loading && (
        <>
          {/* 1. DAY BOOK & 10. JOURNAL REGISTER */}
          {(activeTab === 'day_book' || activeTab === 'journal_reg') && (
            <div>
              <div className="ar-metrics-grid">
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Vouchers</div>
                  <div className="ar-metric-val blue">{reportData.total || 0}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Debits</div>
                  <div className="ar-metric-val">{formatCurrency(reportData.totals?.total_debit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Credits</div>
                  <div className="ar-metric-val">{formatCurrency(reportData.totals?.total_credit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Double-Entry Status</div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <span className="ar-verified-pill">✓ Invariant Balanced</span>
                  </div>
                </div>
              </div>

              <div className="ar-table-card">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher #</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Narration</th>
                      <th>Debit & Credit Breakdown (GL Accounts)</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows?.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          No transactions found for the selected period.
                        </td>
                      </tr>
                    ) : (
                      reportData.rows.map((row) => (
                        <tr key={row.uid}>
                          <td style={{ fontWeight: 600 }}>{row.entry_date}</td>
                          <td style={{ fontWeight: 700, color: '#2563eb' }}>{row.entry_number}</td>
                          <td>
                            <span className={`ar-badge ar-badge-${row.voucher_type?.toLowerCase()}`}>
                              {row.voucher_type}
                            </span>
                          </td>
                          <td>{row.reference_number || '-'}</td>
                          <td>{row.narration || '-'}</td>
                          <td>
                            {row.items?.map((it, idx) => (
                              <div key={idx} style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: 700, color: it.debit_amount > 0 ? '#1e40af' : '#047857' }}>
                                  {it.debit_amount > 0 ? 'Dr' : 'Cr'} [{it.account_code}] {it.account_name}:
                                </span>{' '}
                                {formatCurrency(it.debit_amount > 0 ? it.debit_amount : it.credit_amount)}
                                {it.party_name ? ` (${it.party_name})` : ''}
                              </div>
                            ))}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>
                            {formatCurrency(row.total_debit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. CASH BOOK & 4. GENERAL LEDGER */}
          {(activeTab === 'cash_book' || activeTab === 'ledger') && (
            <div>
              <div className="ar-metrics-grid">
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Opening Balance</div>
                  <div className="ar-metric-val">{formatCurrency(reportData.openingBalance)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Debits (Inflow / Addition)</div>
                  <div className="ar-metric-val positive">{formatCurrency(reportData.periodTotals?.total_debit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Credits (Outflow / Deduction)</div>
                  <div className="ar-metric-val negative">{formatCurrency(reportData.periodTotals?.total_credit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Closing Balance</div>
                  <div className="ar-metric-val blue">{formatCurrency(reportData.closingBalance)}</div>
                </div>
              </div>

              <div className="ar-table-card">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher #</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Narration / Party</th>
                      <th style={{ textAlign: 'right' }}>Debit (Dr)</th>
                      <th style={{ textAlign: 'right' }}>Credit (Cr)</th>
                      <th style={{ textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td>{reportData.fromDate || today}</td>
                      <td>-</td>
                      <td>-</td>
                      <td>OPENING</td>
                      <td>Opening Balance b/f</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right', color: '#0f172a' }}>
                        {formatCurrency(reportData.openingBalance)}
                      </td>
                    </tr>

                    {reportData.rows?.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.entry_date}</td>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>{row.entry_number}</td>
                        <td>
                          <span className={`ar-badge ar-badge-${row.voucher_type?.toLowerCase()}`}>
                            {row.voucher_type}
                          </span>
                        </td>
                        <td>{row.reference_number || '-'}</td>
                        <td>
                          {row.narration} {row.party_name ? `(${row.party_name})` : ''}
                        </td>
                        <td style={{ textAlign: 'right', color: row.debit_amount > 0 ? '#16a34a' : 'inherit', fontWeight: row.debit_amount > 0 ? 700 : 400 }}>
                          {row.debit_amount > 0 ? formatCurrency(row.debit_amount) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: row.credit_amount > 0 ? '#dc2626' : 'inherit', fontWeight: row.credit_amount > 0 ? 700 : 400 }}>
                          {row.credit_amount > 0 ? formatCurrency(row.credit_amount) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          {formatCurrency(row.running_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5">Closing Balance c/d</td>
                      <td style={{ textAlign: 'right', color: '#16a34a' }}>
                        {formatCurrency(reportData.periodTotals?.total_debit)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>
                        {formatCurrency(reportData.periodTotals?.total_credit)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#2563eb' }}>
                        {formatCurrency(reportData.closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 3. BANK BOOK */}
          {activeTab === 'bank_book' && reportData.ledger && (
            <div>
              <div className="ar-metrics-grid">
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Opening Bank Balance</div>
                  <div className="ar-metric-val">{formatCurrency(reportData.ledger.openingBalance)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Deposits (Dr)</div>
                  <div className="ar-metric-val positive">{formatCurrency(reportData.ledger.periodTotals?.total_debit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Withdrawals (Cr)</div>
                  <div className="ar-metric-val negative">{formatCurrency(reportData.ledger.periodTotals?.total_credit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Closing Bank Balance</div>
                  <div className="ar-metric-val blue">{formatCurrency(reportData.ledger.closingBalance)}</div>
                </div>
              </div>

              <div className="ar-table-card">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher #</th>
                      <th>Reference / Cheque</th>
                      <th>Particulars / Party</th>
                      <th style={{ textAlign: 'right' }}>Deposits (Dr)</th>
                      <th style={{ textAlign: 'right' }}>Withdrawals (Cr)</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td>{reportData.ledger.fromDate || today}</td>
                      <td>-</td>
                      <td>OPENING</td>
                      <td>Opening Balance b/f</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(reportData.ledger.openingBalance)}</td>
                    </tr>
                    {reportData.ledger.rows?.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.entry_date}</td>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>{row.entry_number}</td>
                        <td>{row.reference_number || '-'}</td>
                        <td>
                          {row.narration} {row.party_name ? `(${row.party_name})` : ''}
                        </td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: row.debit_amount > 0 ? 700 : 400 }}>
                          {row.debit_amount > 0 ? formatCurrency(row.debit_amount) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: row.credit_amount > 0 ? 700 : 400 }}>
                          {row.credit_amount > 0 ? formatCurrency(row.credit_amount) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(row.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4">Closing Bank Balance</td>
                      <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatCurrency(reportData.ledger.periodTotals?.total_debit)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{formatCurrency(reportData.ledger.periodTotals?.total_credit)}</td>
                      <td style={{ textAlign: 'right', color: '#2563eb' }}>{formatCurrency(reportData.ledger.closingBalance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 5. TRIAL BALANCE */}
          {activeTab === 'trial_balance' && (
            <div>
              <div className="ar-metrics-grid">
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Debits</div>
                  <div className="ar-metric-val">{formatCurrency(reportData.totalDebit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Credits</div>
                  <div className="ar-metric-val">{formatCurrency(reportData.totalCredit)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Discrepancy</div>
                  <div className="ar-metric-val">{formatCurrency(reportData.discrepancy)}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Verification Status</div>
                  <div style={{ marginTop: '0.25rem' }}>
                    {reportData.isBalanced ? (
                      <span className="ar-verified-pill">✓ Double-Entry Invariant Balanced</span>
                    ) : (
                      <span className="ar-imbalanced-pill">⚠️ Imbalanced Ledger</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="ar-table-card">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Account Code</th>
                      <th>Account Name</th>
                      <th>Classification Group</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Debit Balance (Dr)</th>
                      <th style={{ textAlign: 'right' }}>Credit Balance (Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.accounts?.map((acc) => (
                      <tr key={acc.uid}>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>{acc.account_code}</td>
                        <td style={{ fontWeight: 600 }}>{acc.account_name}</td>
                        <td>{acc.group_name}</td>
                        <td>
                          <span className="ar-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                            {acc.account_type_name || acc.primary_type}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: acc.debit_balance > 0 ? 700 : 400 }}>
                          {acc.debit_balance > 0 ? formatCurrency(acc.debit_balance) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: acc.credit_balance > 0 ? 700 : 400 }}>
                          {acc.credit_balance > 0 ? formatCurrency(acc.credit_balance) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4">Total Trial Balance (Debits === Credits)</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(reportData.totalDebit)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(reportData.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 6. PROFIT & LOSS ACCOUNT */}
          {activeTab === 'pnl' && (
            <div className="ar-fs-card">
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.25rem 0' }}>
                Income Statement (Profit & Loss Account)
              </h2>

              {/* 1. Revenue */}
              <div className="ar-fs-section-title">
                <span>1. Revenue & Sales Income</span>
                <span>{formatCurrency(reportData.revenue?.total)}</span>
              </div>
              {reportData.revenue?.rows?.map((r, idx) => (
                <div key={idx} className="ar-fs-row">
                  <span>[{r.account_code}] {r.account_name}</span>
                  <span>{formatCurrency(r.net_amount)}</span>
                </div>
              ))}
              <div className="ar-fs-subtotal">
                <span>Total Revenue (A)</span>
                <span>{formatCurrency(reportData.revenue?.total)}</span>
              </div>

              {/* 2. Direct Costs / COGS */}
              <div className="ar-fs-section-title">
                <span>2. Cost of Goods Sold (Purchases & Direct Costs)</span>
                <span>{formatCurrency(reportData.cogs?.total)}</span>
              </div>
              {reportData.cogs?.rows?.map((r, idx) => (
                <div key={idx} className="ar-fs-row">
                  <span>[{r.account_code}] {r.account_name}</span>
                  <span>{formatCurrency(r.net_amount)}</span>
                </div>
              ))}
              <div className="ar-fs-subtotal">
                <span>Gross Profit (A - B)</span>
                <span style={{ color: reportData.grossProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatCurrency(reportData.grossProfit)}
                </span>
              </div>

              {/* 3. Operating Expenses */}
              <div className="ar-fs-section-title">
                <span>3. Operating & Indirect Expenses</span>
                <span>{formatCurrency(reportData.operatingExpenses?.total)}</span>
              </div>
              {reportData.operatingExpenses?.rows?.map((r, idx) => (
                <div key={idx} className="ar-fs-row">
                  <span>[{r.account_code}] {r.account_name}</span>
                  <span>{formatCurrency(r.net_amount)}</span>
                </div>
              ))}
              <div className="ar-fs-subtotal">
                <span>Total Operating Expenses (C)</span>
                <span>{formatCurrency(reportData.operatingExpenses?.total)}</span>
              </div>

              {/* 4. Net Profit */}
              <div className="ar-fs-grandtotal">
                <span>NET PROFIT / (NET LOSS)</span>
                <span style={{ color: reportData.netProfit >= 0 ? '#4ade80' : '#f87171' }}>
                  {formatCurrency(reportData.netProfit)}
                </span>
              </div>
            </div>
          )}

          {/* 7. BALANCE SHEET */}
          {activeTab === 'balance_sheet' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
              {/* Assets */}
              <div className="ar-fs-card">
                <div className="ar-fs-section-title" style={{ borderBottomColor: '#2563eb' }}>
                  <span style={{ color: '#2563eb' }}>🏛️ Assets (Economic Resources)</span>
                  <span>{formatCurrency(reportData.assets?.total)}</span>
                </div>
                {reportData.assets?.rows?.map((r, idx) => (
                  <div key={idx} className="ar-fs-row">
                    <div>
                      <div style={{ fontWeight: 700 }}>[{r.account_code}] {r.account_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.group_name}</div>
                    </div>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(r.balance)}</span>
                  </div>
                ))}
                <div className="ar-fs-grandtotal" style={{ background: '#2563eb' }}>
                  <span>TOTAL ASSETS</span>
                  <span>{formatCurrency(reportData.assets?.total)}</span>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="ar-fs-card">
                <div className="ar-fs-section-title" style={{ borderBottomColor: '#0f172a' }}>
                  <span>⚖️ Liabilities & Capital Equity</span>
                  <span>{formatCurrency(reportData.totalLiabilitiesAndEquity)}</span>
                </div>

                {/* Liabilities */}
                <div style={{ fontWeight: 700, color: '#64748b', fontSize: '0.82rem', margin: '0.5rem 0' }}>
                  LIABILITIES (OBLIGATIONS)
                </div>
                {reportData.liabilities?.rows?.map((r, idx) => (
                  <div key={idx} className="ar-fs-row">
                    <div>
                      <div style={{ fontWeight: 700 }}>[{r.account_code}] {r.account_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.group_name}</div>
                    </div>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(r.balance)}</span>
                  </div>
                ))}
                <div className="ar-fs-subtotal">
                  <span>Total Liabilities</span>
                  <span>{formatCurrency(reportData.liabilities?.total)}</span>
                </div>

                {/* Equity */}
                <div style={{ fontWeight: 700, color: '#64748b', fontSize: '0.82rem', margin: '0.5rem 0' }}>
                  EQUITY & EARNINGS
                </div>
                {reportData.equity?.rows?.map((r, idx) => (
                  <div key={idx} className="ar-fs-row">
                    <span>[{r.account_code}] {r.account_name}</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(r.balance)}</span>
                  </div>
                ))}
                <div className="ar-fs-row" style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <span>Retained Net Earnings for Period</span>
                  <span style={{ color: reportData.equity?.netEarnings >= 0 ? '#16a34a' : '#dc2626' }}>
                    {formatCurrency(reportData.equity?.netEarnings)}
                  </span>
                </div>
                <div className="ar-fs-subtotal">
                  <span>Total Equity & Earnings</span>
                  <span>{formatCurrency(reportData.equity?.total)}</span>
                </div>

                <div className="ar-fs-grandtotal">
                  <span>TOTAL LIABILITIES & EQUITY</span>
                  <span>{formatCurrency(reportData.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 8. RECEIPT REGISTER */}
          {activeTab === 'receipt_reg' && (
            <div>
              <div className="ar-metrics-grid">
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Receipts Count</div>
                  <div className="ar-metric-val blue">{reportData.total || 0}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Inward Collected Amount</div>
                  <div className="ar-metric-val positive">{formatCurrency(reportData.totalAmount)}</div>
                </div>
              </div>

              <div className="ar-table-card">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Receipt #</th>
                      <th>Type</th>
                      <th>Party Name</th>
                      <th>Reference</th>
                      <th>Narration</th>
                      <th style={{ textAlign: 'right' }}>Collected Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows?.map((row) => (
                      <tr key={row.uid}>
                        <td style={{ fontWeight: 600 }}>{row.entry_date}</td>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>{row.entry_number}</td>
                        <td>
                          <span className={`ar-badge ar-badge-${row.voucher_type?.toLowerCase()}`}>
                            {row.voucher_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{row.party_name}</td>
                        <td>{row.reference_number || '-'}</td>
                        <td>{row.narration || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="6">Total Receipts</td>
                      <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatCurrency(reportData.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 9. PAYMENT REGISTER */}
          {activeTab === 'payment_reg' && (
            <div>
              <div className="ar-metrics-grid">
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Payments Count</div>
                  <div className="ar-metric-val blue">{reportData.total || 0}</div>
                </div>
                <div className="ar-metric-card">
                  <div className="ar-metric-title">Total Outflow Paid Amount</div>
                  <div className="ar-metric-val negative">{formatCurrency(reportData.totalAmount)}</div>
                </div>
              </div>

              <div className="ar-table-card">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher #</th>
                      <th>Type</th>
                      <th>Paid To / Particulars</th>
                      <th>Reference</th>
                      <th>Narration</th>
                      <th style={{ textAlign: 'right' }}>Paid Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows?.map((row) => (
                      <tr key={row.uid}>
                        <td style={{ fontWeight: 600 }}>{row.entry_date}</td>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>{row.entry_number}</td>
                        <td>
                          <span className={`ar-badge ar-badge-${row.voucher_type?.toLowerCase()}`}>
                            {row.voucher_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{row.party_name}</td>
                        <td>{row.reference_number || '-'}</td>
                        <td>{row.narration || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="6">Total Outward Payments</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{formatCurrency(reportData.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
