const pool = require('../config/db.cjs');
const { v4: uuidv4 } = require('uuid');
const { activeFilter, newUid, withTransaction } = require('../utils/audit.cjs');
const accountingService = require('../services/accountingService.cjs');

/**
 * 1. Account Types, Groups & Chart of Accounts
 */
async function listAccountTypes() {
  const [rows] = await pool.query(`
    SELECT id, type_id, type_code, type_name, normal_balance, display_order, description
    FROM account_type_master
    WHERE delete_datetime IS NULL
    ORDER BY display_order ASC
  `);
  return rows;
}

async function listAccountGroups() {
  const [rows] = await pool.query(`
    SELECT 
      ag.uid, 
      ag.group_code, 
      ag.group_name, 
      ag.account_type_id,
      atm.type_code AS primary_type,
      atm.type_name,
      ag.parent_uid, 
      ag.description, 
      ag.is_system
    FROM account_groups ag
    JOIN account_type_master atm ON atm.type_id = ag.account_type_id AND atm.delete_datetime IS NULL
    WHERE ag.delete_datetime IS NULL
    ORDER BY atm.display_order ASC, ag.group_name ASC
  `);
  return rows;
}

async function listChartOfAccounts({ type = '', typeId = '', groupUid = '', search = '', is_active = '' } = {}) {
  const whereClauses = [`coa.delete_datetime IS NULL`];
  const params = [];

  if (typeId && typeId !== 'ALL') {
    whereClauses.push(`coa.account_type_id = ?`);
    params.push(Number(typeId));
  } else if (type && type !== 'ALL') {
    whereClauses.push(`coa.account_type = ?`);
    params.push(type.toUpperCase());
  }

  if (groupUid && groupUid !== 'ALL') {
    whereClauses.push(`coa.group_uid = ?`);
    params.push(groupUid);
  }

  if (is_active !== '' && is_active !== null && is_active !== undefined) {
    whereClauses.push(`coa.is_active = ?`);
    params.push(Number(is_active) === 1 ? 1 : 0);
  }

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(coa.account_code LIKE ? OR coa.account_name LIKE ? OR ag.group_name LIKE ?)`);
    params.push(like, like, like);
  }

  const whereSql = whereClauses.join(' AND ');

  const [rows] = await pool.query(`
    SELECT 
      coa.id,
      coa.uid,
      coa.account_code,
      coa.account_name,
      coa.account_type_id,
      atm.type_name AS account_type_name,
      coa.group_uid,
      ag.group_code,
      ag.group_name,
      coa.account_type,
      coa.normal_balance,
      coa.is_reconcilable,
      coa.party_type,
      coa.party_uid,
      coa.currency,
      coa.description,
      coa.is_active,
      coa.is_system,
      COALESCE((
        SELECT 
          CASE 
            WHEN coa.normal_balance = 'DEBIT' THEN SUM(ji.debit_amount - ji.credit_amount)
            ELSE SUM(ji.credit_amount - ji.debit_amount)
          END
        FROM journal_items ji
        JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED'
        WHERE ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
      ), 0) AS current_balance
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.delete_datetime IS NULL
    JOIN account_type_master atm ON atm.type_id = coa.account_type_id AND atm.delete_datetime IS NULL
    WHERE ${whereSql}
    ORDER BY atm.display_order ASC, coa.account_code ASC
  `, params);

  return rows;
}

async function getAccountByUid(uid) {
  const [[account]] = await pool.query(`
    SELECT 
      coa.*,
      atm.type_name AS account_type_name,
      ag.group_code,
      ag.group_name
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.delete_datetime IS NULL
    JOIN account_type_master atm ON atm.type_id = coa.account_type_id AND atm.delete_datetime IS NULL
    WHERE coa.uid = ? AND coa.delete_datetime IS NULL
  `, [uid]);

  return account || null;
}

async function createAccount(data) {
  const uid = uuidv4();
  const account_code = data.account_code ? data.account_code.trim().toUpperCase() : `ACC_${Date.now().toString().slice(-6)}`;
  const account_name = data.account_name.trim();
  const group_uid = data.group_uid;
  
  // Resolve account_type_id and account_type from master
  let account_type_id = data.account_type_id ? Number(data.account_type_id) : null;
  let account_type = data.account_type ? data.account_type.toUpperCase() : null;

  if (account_type_id) {
    const [[atm]] = await pool.query('SELECT type_id, type_code, normal_balance FROM account_type_master WHERE type_id = ?', [account_type_id]);
    if (!atm) throw Object.assign(new Error(`Invalid account_type_id (${account_type_id}). Allowed types are 1 to 5.`), { status: 400 });
    account_type = atm.type_code;
  } else if (account_type) {
    const [[atm]] = await pool.query('SELECT type_id, type_code, normal_balance FROM account_type_master WHERE type_code = ?', [account_type]);
    if (!atm) throw Object.assign(new Error(`Invalid account_type (${account_type}).`), { status: 400 });
    account_type_id = atm.type_id;
  } else {
    // Default to EXPENSE (5)
    account_type_id = 5;
    account_type = 'EXPENSE';
  }

  const normal_balance = data.normal_balance || (['ASSET', 'EXPENSE'].includes(account_type) ? 'DEBIT' : 'CREDIT');
  const party_type = data.party_type || 'NONE';
  const party_uid = data.party_uid || null;
  const description = data.description ? data.description.trim() : null;

  await pool.query(`
    INSERT INTO chart_of_accounts
      (uid, account_code, account_name, group_uid, account_type_id, account_type, normal_balance, party_type, party_uid, description, is_active, is_system, entry_datetime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())
  `, [uid, account_code, account_name, group_uid, account_type_id, account_type, normal_balance, party_type, party_uid, description]);

  accountingService.clearAccountCache();
  return getAccountByUid(uid);
}

async function updateAccount(uid, data) {
  const account_name = data.account_name ? data.account_name.trim() : undefined;
  const group_uid = data.group_uid;
  let account_type_id = data.account_type_id ? Number(data.account_type_id) : undefined;
  let account_type = data.account_type ? data.account_type.toUpperCase() : undefined;

  if (account_type_id) {
    const [[atm]] = await pool.query('SELECT type_id, type_code FROM account_type_master WHERE type_id = ?', [account_type_id]);
    if (!atm) throw Object.assign(new Error(`Invalid account_type_id (${account_type_id}). Allowed types are 1 to 5.`), { status: 400 });
    account_type = atm.type_code;
  }

  const normal_balance = data.normal_balance;
  const description = data.description !== undefined ? (data.description ? data.description.trim() : null) : undefined;
  const is_active = data.is_active !== undefined ? (Number(data.is_active) === 1 ? 1 : 0) : undefined;

  const updates = [];
  const params = [];

  if (account_name) { updates.push('account_name = ?'); params.push(account_name); }
  if (group_uid) { updates.push('group_uid = ?'); params.push(group_uid); }
  if (account_type_id) { updates.push('account_type_id = ?'); params.push(account_type_id); }
  if (account_type) { updates.push('account_type = ?'); params.push(account_type); }
  if (normal_balance) { updates.push('normal_balance = ?'); params.push(normal_balance); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

  if (updates.length > 0) {
    updates.push('update_datetime = NOW()');
    params.push(uid);
    await pool.query(`UPDATE chart_of_accounts SET ${updates.join(', ')} WHERE uid = ? AND delete_datetime IS NULL`, params);
  }

  accountingService.clearAccountCache();
  return getAccountByUid(uid);
}

/**
 * 2. Journal Entries & Manual Vouchers
 */
async function listJournalEntries({
  page = 1,
  pageSize = 20,
  search = '',
  voucherType = '',
  fromDate = '',
  toDate = '',
  status = ''
} = {}) {
  const whereClauses = [`je.delete_datetime IS NULL`];
  const params = [];

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(je.entry_number LIKE ? OR je.reference_number LIKE ? OR je.narration LIKE ?)`);
    params.push(like, like, like);
  }

  if (voucherType && voucherType !== 'ALL') {
    whereClauses.push(`je.voucher_type = ?`);
    params.push(voucherType.toUpperCase());
  }

  if (status && status !== 'ALL') {
    whereClauses.push(`je.status = ?`);
    params.push(status.toUpperCase());
  }

  if (fromDate && fromDate.trim()) {
    whereClauses.push(`je.entry_date >= ?`);
    params.push(fromDate.trim().slice(0, 10));
  }

  if (toDate && toDate.trim()) {
    whereClauses.push(`je.entry_date <= ?`);
    params.push(toDate.trim().slice(0, 10));
  }

  const whereSql = whereClauses.join(' AND ');
  const offset = (Number(page) - 1) * Number(pageSize);

  const [rows] = await pool.query(`
    SELECT 
      je.id,
      je.uid,
      je.entry_number,
      je.voucher_type,
      COALESCE(DATE_FORMAT(NULLIF(je.entry_date, '0000-00-00'), '%Y-%m-%d'), DATE_FORMAT(je.entry_datetime, '%Y-%m-%d')) AS entry_date,
      je.source_table,
      je.source_uid,
      je.reference_number,
      je.total_debit,
      je.total_credit,
      je.narration,
      je.status,
      je.entry_datetime
    FROM journal_entries je
    WHERE ${whereSql}
    ORDER BY je.entry_date DESC, je.id DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(pageSize), offset]);

  const [[{ count }]] = await pool.query(`
    SELECT COUNT(*) AS count FROM journal_entries je WHERE ${whereSql}
  `, params);

  const [[totals]] = await pool.query(`
    SELECT 
      COALESCE(SUM(je.total_debit), 0) AS total_debit_sum,
      COALESCE(SUM(je.total_credit), 0) AS total_credit_sum
    FROM journal_entries je
    WHERE ${whereSql}
  `, params);

  return {
    rows,
    total: Number(count || 0),
    page: Number(page),
    pageSize: Number(pageSize),
    totals: {
      total_debit: Number(totals?.total_debit_sum || 0),
      total_credit: Number(totals?.total_credit_sum || 0)
    }
  };
}

async function getJournalEntryByUid(uid) {
  const [[entry]] = await pool.query(`
    SELECT 
      je.id,
      je.uid,
      je.entry_number,
      je.voucher_type,
      COALESCE(DATE_FORMAT(NULLIF(je.entry_date, '0000-00-00'), '%Y-%m-%d'), DATE_FORMAT(je.entry_datetime, '%Y-%m-%d')) AS entry_date,
      je.source_table,
      je.source_uid,
      je.reference_number,
      je.total_debit,
      je.total_credit,
      je.narration,
      je.status,
      je.entry_datetime
    FROM journal_entries je
    WHERE je.uid = ? AND je.delete_datetime IS NULL
  `, [uid]);

  if (!entry) return null;

  const [items] = await pool.query(`
    SELECT 
      ji.id,
      ji.uid,
      ji.account_uid,
      coa.account_code,
      coa.account_name,
      coa.account_type,
      ji.party_type,
      ji.party_uid,
      COALESCE(c.customer_name, d.dealer_name, bm.bank_name, '') AS party_name,
      ji.debit_amount,
      ji.credit_amount,
      ji.line_narration
    FROM journal_items ji
    JOIN chart_of_accounts coa ON coa.uid = ji.account_uid
    LEFT JOIN customer_master c ON c.uid = ji.party_uid AND ji.party_type = 'CUSTOMER'
    LEFT JOIN dealer_master d ON d.uid = ji.party_uid AND ji.party_type = 'DEALER'
    LEFT JOIN bank_master bm ON bm.uid = ji.party_uid AND ji.party_type = 'BANK'
    WHERE ji.journal_entry_uid = ? AND ji.delete_datetime IS NULL
    ORDER BY ji.debit_amount DESC, ji.credit_amount DESC
  `, [uid]);

  return { ...entry, items };
}

async function createManualJournalVoucher(data) {
  return await accountingService.postJournalEntry(pool, {
    voucherType: data.voucher_type || 'JOURNAL',
    entryDate: data.entry_date || new Date(),
    referenceNumber: data.reference_number || null,
    narration: data.narration || 'Manual Journal Voucher',
    createdBy: data.created_by || null,
    items: data.items.map(it => ({
      accountUid: it.account_uid,
      partyType: it.party_type || 'NONE',
      partyUid: it.party_uid || null,
      debitAmount: Number(it.debit_amount || 0),
      creditAmount: Number(it.credit_amount || 0),
      lineNarration: it.line_narration || data.narration
    }))
  });
}

/**
 * 3. General Ledger (GL) for an Account
 */
async function getAccountLedger({
  accountUid,
  fromDate = '',
  toDate = '',
  page = 1,
  pageSize = 50
}) {
  const account = await getAccountByUid(accountUid);
  if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });

  const cleanFrom = fromDate ? fromDate.slice(0, 10) : '';
  const cleanTo = toDate ? toDate.slice(0, 10) : '';

  // 1. Calculate Opening Balance before fromDate
  let openingBalance = 0;
  if (cleanFrom) {
    const [[opRow]] = await pool.query(`
      SELECT 
        COALESCE(SUM(ji.debit_amount), 0) AS total_dr,
        COALESCE(SUM(ji.credit_amount), 0) AS total_cr
      FROM journal_items ji
      JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED'
      WHERE ji.account_uid = ? AND ji.delete_datetime IS NULL AND je.entry_date < ?
    `, [accountUid, cleanFrom]);

    const opDr = Number(opRow?.total_dr || 0);
    const opCr = Number(opRow?.total_cr || 0);
    openingBalance = account.normal_balance === 'DEBIT' ? (opDr - opCr) : (opCr - opDr);
  }

  // 2. Fetch Period Transactions
  const whereClauses = [
    `ji.account_uid = ?`,
    `ji.delete_datetime IS NULL`,
    `je.delete_datetime IS NULL`,
    `je.status = 'POSTED'`
  ];
  const params = [accountUid];

  if (cleanFrom) {
    whereClauses.push(`je.entry_date >= ?`);
    params.push(cleanFrom);
  }
  if (cleanTo) {
    whereClauses.push(`je.entry_date <= ?`);
    params.push(cleanTo);
  }

  const whereSql = whereClauses.join(' AND ');

  const [allPeriodRows] = await pool.query(`
    SELECT 
      je.uid AS journal_entry_uid,
      je.entry_number,
      je.voucher_type,
      COALESCE(DATE_FORMAT(NULLIF(je.entry_date, '0000-00-00'), '%Y-%m-%d'), DATE_FORMAT(je.entry_datetime, '%Y-%m-%d')) AS entry_date,
      je.reference_number,
      ji.debit_amount,
      ji.credit_amount,
      COALESCE(ji.line_narration, je.narration) AS narration,
      ji.party_type,
      ji.party_uid,
      COALESCE(c.customer_name, d.dealer_name, bm.bank_name, '') AS party_name
    FROM journal_items ji
    JOIN journal_entries je ON je.uid = ji.journal_entry_uid
    LEFT JOIN customer_master c ON c.uid = ji.party_uid AND ji.party_type = 'CUSTOMER'
    LEFT JOIN dealer_master d ON d.uid = ji.party_uid AND ji.party_type = 'DEALER'
    LEFT JOIN bank_master bm ON bm.uid = ji.party_uid AND ji.party_type = 'BANK'
    WHERE ${whereSql}
    ORDER BY je.entry_date ASC, je.id ASC
  `, params);

  // Compute running balances
  let running = openingBalance;
  let periodDebitTotal = 0;
  let periodCreditTotal = 0;

  const rowsWithBalance = allPeriodRows.map(r => {
    const dr = Number(r.debit_amount || 0);
    const cr = Number(r.credit_amount || 0);
    periodDebitTotal += dr;
    periodCreditTotal += cr;

    if (account.normal_balance === 'DEBIT') {
      running += (dr - cr);
    } else {
      running += (cr - dr);
    }

    return {
      ...r,
      running_balance: running
    };
  });

  const closingBalance = running;

  // Paginate if requested
  const offset = (Number(page) - 1) * Number(pageSize);
  const paginatedRows = rowsWithBalance.slice(offset, offset + Number(pageSize));

  return {
    account,
    fromDate: cleanFrom,
    toDate: cleanTo,
    openingBalance,
    closingBalance,
    periodTotals: {
      total_debit: periodDebitTotal,
      total_credit: periodCreditTotal,
      net_change: account.normal_balance === 'DEBIT' ? (periodDebitTotal - periodCreditTotal) : (periodCreditTotal - periodDebitTotal)
    },
    totalTransactions: rowsWithBalance.length,
    rows: paginatedRows
  };
}

/**
 * 4. Accounts Receivable (AR) Aging & Customer Statements
 */
async function getARAgingReport({ asOfDate = '' } = {}) {
  const dateLimit = asOfDate ? asOfDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const [rows] = await pool.query(`
    SELECT 
      c.uid AS customer_uid,
      c.customer_name,
      c.mobile_number,
      COUNT(ar.id) AS open_invoices_count,
      COALESCE(SUM(ar.outstanding_amount), 0) AS total_outstanding,
      COALESCE(SUM(CASE WHEN DATEDIFF(?, ar.due_date) <= 0 THEN ar.outstanding_amount ELSE 0 END), 0) AS bucket_current,
      COALESCE(SUM(CASE WHEN DATEDIFF(?, ar.due_date) BETWEEN 1 AND 30 THEN ar.outstanding_amount ELSE 0 END), 0) AS bucket_1_30,
      COALESCE(SUM(CASE WHEN DATEDIFF(?, ar.due_date) BETWEEN 31 AND 60 THEN ar.outstanding_amount ELSE 0 END), 0) AS bucket_31_60,
      COALESCE(SUM(CASE WHEN DATEDIFF(?, ar.due_date) BETWEEN 61 AND 90 THEN ar.outstanding_amount ELSE 0 END), 0) AS bucket_61_90,
      COALESCE(SUM(CASE WHEN DATEDIFF(?, ar.due_date) > 90 THEN ar.outstanding_amount ELSE 0 END), 0) AS bucket_over_90
    FROM ar_subledger ar
    JOIN customer_master c ON c.uid = ar.customer_uid AND c.delete_datetime IS NULL
    WHERE ar.delete_datetime IS NULL AND ar.outstanding_amount > 0 AND ar.invoice_date <= ?
    GROUP BY c.uid, c.customer_name, c.mobile_number
    ORDER BY total_outstanding DESC
  `, [dateLimit, dateLimit, dateLimit, dateLimit, dateLimit, dateLimit]);

  let totalReceivable = 0;
  let totalCurrent = 0;
  let total1_30 = 0;
  let total31_60 = 0;
  let total61_90 = 0;
  let totalOver90 = 0;

  for (const r of rows) {
    totalReceivable += Number(r.total_outstanding || 0);
    totalCurrent += Number(r.bucket_current || 0);
    total1_30 += Number(r.bucket_1_30 || 0);
    total31_60 += Number(r.bucket_31_60 || 0);
    total61_90 += Number(r.bucket_61_90 || 0);
    totalOver90 += Number(r.bucket_over_90 || 0);
  }

  return {
    asOfDate: dateLimit,
    summary: {
      total_receivable: totalReceivable,
      total_current: totalCurrent,
      total_1_30: total1_30,
      total_31_60: total31_60,
      total_61_90: total61_90,
      total_over_90: totalOver90,
      customer_count: rows.length
    },
    customers: rows
  };
}

async function getCustomerStatement({
  customerUid,
  fromDate = '',
  toDate = ''
}) {
  const [[customer]] = await pool.query(
    'SELECT * FROM customer_master WHERE uid = ? AND delete_datetime IS NULL',
    [customerUid]
  );
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });

  const cleanFrom = fromDate ? fromDate.slice(0, 10) : '';
  const cleanTo = toDate ? toDate.slice(0, 10) : '';

  // 1. Opening balance before fromDate from AR ledger
  let openingBalance = 0;
  if (cleanFrom) {
    const [[opRow]] = await pool.query(`
      SELECT 
        COALESCE(SUM(ji.debit_amount), 0) - COALESCE(SUM(ji.credit_amount), 0) AS bal
      FROM journal_items ji
      JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED'
      JOIN chart_of_accounts coa ON coa.uid = ji.account_uid AND coa.account_code = '1030'
      WHERE ji.party_uid = ? AND ji.party_type = 'CUSTOMER' AND ji.delete_datetime IS NULL AND je.entry_date < ?
    `, [customerUid, cleanFrom]);
    openingBalance = Number(opRow?.bal || 0);
  }

  // 2. Fetch all vouchers for this customer
  const whereClauses = [
    `ji.party_uid = ?`,
    `ji.party_type = 'CUSTOMER'`,
    `ji.delete_datetime IS NULL`,
    `je.delete_datetime IS NULL`,
    `je.status = 'POSTED'`
  ];
  const params = [customerUid];

  if (cleanFrom) {
    whereClauses.push(`je.entry_date >= ?`);
    params.push(cleanFrom);
  }
  if (cleanTo) {
    whereClauses.push(`je.entry_date <= ?`);
    params.push(cleanTo);
  }

  const [txRows] = await pool.query(`
    SELECT 
      je.uid AS journal_entry_uid,
      je.entry_number,
      je.voucher_type,
      COALESCE(DATE_FORMAT(NULLIF(je.entry_date, '0000-00-00'), '%Y-%m-%d'), DATE_FORMAT(je.entry_datetime, '%Y-%m-%d')) AS entry_date,
      je.reference_number,
      ji.debit_amount,
      ji.credit_amount,
      COALESCE(ji.line_narration, je.narration) AS narration
    FROM journal_items ji
    JOIN journal_entries je ON je.uid = ji.journal_entry_uid
    JOIN chart_of_accounts coa ON coa.uid = ji.account_uid AND coa.account_code = '1030'
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY je.entry_date ASC, je.id ASC
  `, params);

  let running = openingBalance;
  let totalBilled = 0;
  let totalCollected = 0;

  const entries = txRows.map(t => {
    const billed = Number(t.debit_amount || 0);
    const collected = Number(t.credit_amount || 0);
    totalBilled += billed;
    totalCollected += collected;
    running += (billed - collected);

    return {
      ...t,
      billed_amount: billed,
      collected_amount: collected,
      running_balance: running
    };
  });

  return {
    customer,
    fromDate: cleanFrom,
    toDate: cleanTo,
    openingBalance,
    closingBalance: running,
    totalBilled,
    totalCollected,
    entries
  };
}

/**
 * 5. Financial Statements: Trial Balance, P&L, Balance Sheet, Daybook
 */
async function getTrialBalance({ asOfDate = '' } = {}) {
  const dateLimit = asOfDate ? asOfDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const [rows] = await pool.query(`
    SELECT 
      coa.uid,
      coa.account_code,
      coa.account_name,
      ag.group_name,
      atm.type_code AS primary_type,
      atm.type_name AS account_type_name,
      coa.normal_balance,
      COALESCE(SUM(ji.debit_amount), 0) AS total_debit,
      COALESCE(SUM(ji.credit_amount), 0) AS total_credit,
      CASE 
        WHEN coa.normal_balance = 'DEBIT' THEN (COALESCE(SUM(ji.debit_amount), 0) - COALESCE(SUM(ji.credit_amount), 0))
        ELSE 0
      END AS debit_balance,
      CASE 
        WHEN coa.normal_balance = 'CREDIT' THEN (COALESCE(SUM(ji.credit_amount), 0) - COALESCE(SUM(ji.debit_amount), 0))
        ELSE 0
      END AS credit_balance
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.delete_datetime IS NULL
    JOIN account_type_master atm ON atm.type_id = coa.account_type_id AND atm.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED' AND je.entry_date <= ?
    WHERE coa.delete_datetime IS NULL AND coa.is_active = 1
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_name, atm.type_code, atm.type_name, coa.normal_balance
    HAVING total_debit > 0 OR total_credit > 0
    ORDER BY coa.account_code ASC
  `, [dateLimit]);

  let sumDebit = 0;
  let sumCredit = 0;

  for (const r of rows) {
    sumDebit += Number(r.total_debit || 0);
    sumCredit += Number(r.total_credit || 0);
  }

  const isBalanced = Math.abs(sumDebit - sumCredit) < 0.01;

  return {
    asOfDate: dateLimit,
    isBalanced,
    totalDebit: sumDebit,
    totalCredit: sumCredit,
    discrepancy: Math.abs(sumDebit - sumCredit),
    accounts: rows
  };
}

async function getProfitAndLoss({ fromDate = '', toDate = '' } = {}) {
  const cleanFrom = fromDate ? fromDate.slice(0, 10) : '';
  const cleanTo = toDate ? toDate.slice(0, 10) : '';

  const dateParams = [];
  let dateFilter = '';
  if (cleanFrom) {
    dateFilter += ' AND je.entry_date >= ?';
    dateParams.push(cleanFrom);
  }
  if (cleanTo) {
    dateFilter += ' AND je.entry_date <= ?';
    dateParams.push(cleanTo);
  }

  // 1. Revenue accounts (Sales & Other Income - type_id: 4)
  const [revenueRows] = await pool.query(`
    SELECT 
      coa.account_code,
      coa.account_name,
      ag.group_name,
      COALESCE(SUM(ji.credit_amount - ji.debit_amount), 0) AS net_amount
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED' ${dateFilter}
    WHERE coa.account_type_id = 4 AND coa.delete_datetime IS NULL
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_name
    HAVING net_amount != 0
    ORDER BY coa.account_code ASC
  `, dateParams);

  // 2. Direct Costs / COGS (Purchases - type_id: 5)
  const [cogsRows] = await pool.query(`
    SELECT 
      coa.account_code,
      coa.account_name,
      ag.group_name,
      COALESCE(SUM(ji.debit_amount - ji.credit_amount), 0) AS net_amount
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.group_code IN ('AG_PURCHASE', 'AG_DIRECT_EXP') AND ag.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED' ${dateFilter}
    WHERE coa.account_type_id = 5 AND coa.delete_datetime IS NULL
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_name
    HAVING net_amount != 0
    ORDER BY coa.account_code ASC
  `, dateParams);

  // 3. Operating & Indirect Expenses (type_id: 5)
  const [expenseRows] = await pool.query(`
    SELECT 
      coa.account_code,
      coa.account_name,
      ag.group_name,
      COALESCE(SUM(ji.debit_amount - ji.credit_amount), 0) AS net_amount
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.group_code NOT IN ('AG_PURCHASE', 'AG_DIRECT_EXP') AND ag.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED' ${dateFilter}
    WHERE coa.account_type_id = 5 AND coa.delete_datetime IS NULL
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_name
    HAVING net_amount != 0
    ORDER BY coa.account_code ASC
  `, dateParams);

  const totalRevenue = revenueRows.reduce((s, r) => s + Number(r.net_amount || 0), 0);
  const totalCOGS = cogsRows.reduce((s, r) => s + Number(r.net_amount || 0), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const totalOperatingExpenses = expenseRows.reduce((s, r) => s + Number(r.net_amount || 0), 0);
  const netProfit = grossProfit - totalOperatingExpenses;

  return {
    fromDate: cleanFrom,
    toDate: cleanTo,
    revenue: {
      rows: revenueRows,
      total: totalRevenue
    },
    cogs: {
      rows: cogsRows,
      total: totalCOGS
    },
    grossProfit,
    operatingExpenses: {
      rows: expenseRows,
      total: totalOperatingExpenses
    },
    netProfit
  };
}

async function getBalanceSheet({ asOfDate = '' } = {}) {
  const dateLimit = asOfDate ? asOfDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  // 1. Assets (Debit normal - type_id: 1)
  const [assetRows] = await pool.query(`
    SELECT 
      coa.account_code,
      coa.account_name,
      ag.group_name,
      COALESCE(SUM(CASE WHEN je.status = 'POSTED' AND je.delete_datetime IS NULL AND je.entry_date <= ? THEN (ji.debit_amount - ji.credit_amount) ELSE 0 END), 0) AS balance
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid
    WHERE coa.account_type_id = 1 AND coa.delete_datetime IS NULL
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_name
    HAVING balance != 0
    ORDER BY coa.account_code ASC
  `, [dateLimit]);

  // 2. Liabilities (Credit normal - type_id: 2)
  const [liabilityRows] = await pool.query(`
    SELECT 
      coa.account_code,
      coa.account_name,
      ag.group_name,
      COALESCE(SUM(CASE WHEN je.status = 'POSTED' AND je.delete_datetime IS NULL AND je.entry_date <= ? THEN (ji.credit_amount - ji.debit_amount) ELSE 0 END), 0) AS balance
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid
    WHERE coa.account_type_id = 2 AND coa.delete_datetime IS NULL
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_name
    HAVING balance != 0
    ORDER BY coa.account_code ASC
  `, [dateLimit]);

  // 3. Equity (Credit normal - type_id: 3)
  const [equityRows] = await pool.query(`
    SELECT 
      coa.account_code,
      coa.account_name,
      ag.group_name,
      COALESCE(SUM(CASE WHEN je.status = 'POSTED' AND je.delete_datetime IS NULL AND je.entry_date <= ? THEN (ji.credit_amount - ji.debit_amount) ELSE 0 END), 0) AS balance
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid
    WHERE coa.account_type_id = 3 AND coa.delete_datetime IS NULL
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_name
    HAVING balance != 0
    ORDER BY coa.account_code ASC
  `, [dateLimit]);

  // Compute Retained Earnings / Net Earnings to Date (Revenue[4] - Expenses[5])
  const [[profitRow]] = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN coa.account_type_id = 4 THEN (ji.credit_amount - ji.debit_amount) ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN coa.account_type_id = 5 THEN (ji.debit_amount - ji.credit_amount) ELSE 0 END), 0) AS net_earnings
    FROM journal_items ji
    JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED' AND je.entry_date <= ?
    JOIN chart_of_accounts coa ON coa.uid = ji.account_uid AND coa.delete_datetime IS NULL
    WHERE ji.delete_datetime IS NULL
  `, [dateLimit]);

  const netEarnings = Number(profitRow?.net_earnings || 0);

  const totalAssets = assetRows.reduce((s, r) => s + Number(r.balance || 0), 0);
  const totalLiabilities = liabilityRows.reduce((s, r) => s + Number(r.balance || 0), 0);
  const totalBaseEquity = equityRows.reduce((s, r) => s + Number(r.balance || 0), 0);
  const totalEquityAndEarnings = totalBaseEquity + netEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquityAndEarnings;

  return {
    asOfDate: dateLimit,
    assets: {
      rows: assetRows,
      total: totalAssets
    },
    liabilities: {
      rows: liabilityRows,
      total: totalLiabilities
    },
    equity: {
      rows: equityRows,
      netEarnings,
      total: totalEquityAndEarnings
    },
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
  };
}

async function getAccountingDashboardMetrics() {
  const [tb] = await Promise.all([
    getTrialBalance()
  ]);

  const pnl = await getProfitAndLoss();
  const arAging = await getARAgingReport();

  // Cash & Bank balances
  const [cashBankRows] = await pool.query(`
    SELECT 
      coa.account_code,
      coa.account_name,
      ag.group_code,
      COALESCE(SUM(ji.debit_amount - ji.credit_amount), 0) AS balance
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.group_code IN ('AG_CASH', 'AG_BANK') AND ag.delete_datetime IS NULL
    LEFT JOIN journal_items ji ON ji.account_uid = coa.uid AND ji.delete_datetime IS NULL
    LEFT JOIN journal_entries je ON je.uid = ji.journal_entry_uid AND je.delete_datetime IS NULL AND je.status = 'POSTED'
    WHERE coa.delete_datetime IS NULL
    GROUP BY coa.uid, coa.account_code, coa.account_name, ag.group_code
    ORDER BY coa.account_code ASC
  `);

  let totalCash = 0;
  let totalBank = 0;
  for (const cb of cashBankRows) {
    if (cb.group_code === 'AG_CASH') totalCash += Number(cb.balance || 0);
    if (cb.group_code === 'AG_BANK') totalBank += Number(cb.balance || 0);
  }

  // Recent 10 journal entries
  const recentEntries = await listJournalEntries({ page: 1, pageSize: 8 });

  return {
    cash_in_hand: totalCash,
    bank_balance: totalBank,
    liquid_funds_total: totalCash + totalBank,
    total_receivable: arAging.summary.total_receivable,
    overdue_receivable: arAging.summary.total_1_30 + arAging.summary.total_31_60 + arAging.summary.total_61_90 + arAging.summary.total_over_90,
    month_to_date_revenue: pnl.revenue.total,
    month_to_date_net_profit: pnl.netProfit,
    trial_balance_status: tb.isBalanced ? 'BALANCED' : 'IMBALANCED',
    recent_entries: recentEntries.rows,
    cash_bank_breakdown: cashBankRows
  };
}

/**
 * 6. Specialized Accounting Books & Registers (10 Core Accounting Reports)
 */

// 1. Day Book (All transactions ordered by date/time with item breakdowns)
async function getDayBook({ fromDate = '', toDate = '', search = '', voucherType = '', page = 1, pageSize = 50 } = {}) {
  const cleanFrom = fromDate ? fromDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const cleanTo = toDate ? toDate.slice(0, 10) : cleanFrom;

  const entriesResult = await listJournalEntries({
    page,
    pageSize,
    search,
    voucherType,
    fromDate: cleanFrom,
    toDate: cleanTo,
    status: 'POSTED'
  });

  // Fetch line items for each journal entry in this page
  const entryUids = entriesResult.rows.map(r => r.uid);
  let itemsByEntry = {};

  if (entryUids.length > 0) {
    const placeholders = entryUids.map(() => '?').join(',');
    const [items] = await pool.query(`
      SELECT 
        ji.journal_entry_uid,
        ji.account_uid,
        coa.account_code,
        coa.account_name,
        atm.type_name AS account_type_name,
        ji.party_type,
        ji.party_uid,
        COALESCE(c.customer_name, d.dealer_name, bm.bank_name, '') AS party_name,
        ji.debit_amount,
        ji.credit_amount,
        ji.line_narration
      FROM journal_items ji
      JOIN chart_of_accounts coa ON coa.uid = ji.account_uid
      JOIN account_type_master atm ON atm.type_id = coa.account_type_id
      LEFT JOIN customer_master c ON c.uid = ji.party_uid AND ji.party_type = 'CUSTOMER'
      LEFT JOIN dealer_master d ON d.uid = ji.party_uid AND ji.party_type = 'DEALER'
      LEFT JOIN bank_master bm ON bm.uid = ji.party_uid AND ji.party_type = 'BANK'
      WHERE ji.journal_entry_uid IN (${placeholders}) AND ji.delete_datetime IS NULL
      ORDER BY ji.debit_amount DESC, ji.credit_amount DESC
    `, entryUids);

    for (const item of items) {
      if (!itemsByEntry[item.journal_entry_uid]) itemsByEntry[item.journal_entry_uid] = [];
      itemsByEntry[item.journal_entry_uid].push(item);
    }
  }

  const detailedRows = entriesResult.rows.map(entry => ({
    ...entry,
    items: itemsByEntry[entry.uid] || []
  }));

  return {
    fromDate: cleanFrom,
    toDate: cleanTo,
    total: entriesResult.total,
    page: entriesResult.page,
    pageSize: entriesResult.pageSize,
    totals: entriesResult.totals,
    rows: detailedRows
  };
}

// 2. Cash Book (Cash account 1010 receipts & payments with running balance)
async function getCashBook({ fromDate = '', toDate = '', page = 1, pageSize = 50 } = {}) {
  const [[cashAccount]] = await pool.query(`
    SELECT uid FROM chart_of_accounts WHERE account_code = '1010' AND delete_datetime IS NULL LIMIT 1
  `);
  if (!cashAccount) throw Object.assign(new Error('Cash in Hand account (1010) not found in Chart of Accounts.'), { status: 404 });

  return await getAccountLedger({
    accountUid: cashAccount.uid,
    fromDate,
    toDate,
    page,
    pageSize
  });
}

// 3. Bank Book (All bank accounts or specific bank account)
async function getBankBook({ bankAccountUid = '', fromDate = '', toDate = '', page = 1, pageSize = 50 } = {}) {
  // Get all active bank accounts for selector
  const [bankAccounts] = await pool.query(`
    SELECT 
      coa.uid,
      coa.account_code,
      coa.account_name,
      bm.bank_name,
      bm.account_number,
      bm.ifsc_code
    FROM chart_of_accounts coa
    JOIN account_groups ag ON ag.uid = coa.group_uid AND ag.group_code = 'AG_BANK'
    LEFT JOIN bank_master bm ON bm.uid = coa.party_uid
    WHERE coa.delete_datetime IS NULL AND coa.is_active = 1
    ORDER BY coa.account_name ASC
  `);

  const targetUid = bankAccountUid || (bankAccounts.length > 0 ? bankAccounts[0].uid : null);
  if (!targetUid) {
    return { bankAccounts: [], ledger: null };
  }

  const ledger = await getAccountLedger({
    accountUid: targetUid,
    fromDate,
    toDate,
    page,
    pageSize
  });

  return {
    bankAccounts,
    selectedAccountUid: targetUid,
    ledger
  };
}

// 4. Receipt Register (All money received vouchers: Sales, Customer Advances, Credit Collections)
async function getReceiptRegister({ fromDate = '', toDate = '', search = '', page = 1, pageSize = 50 } = {}) {
  const cleanFrom = fromDate ? fromDate.slice(0, 10) : '';
  const cleanTo = toDate ? toDate.slice(0, 10) : '';

  const whereClauses = [
    `je.delete_datetime IS NULL`,
    `je.status = 'POSTED'`,
    `je.voucher_type IN ('RECEIPT', 'SALES')`
  ];
  const params = [];

  if (cleanFrom) {
    whereClauses.push(`je.entry_date >= ?`);
    params.push(cleanFrom);
  }
  if (cleanTo) {
    whereClauses.push(`je.entry_date <= ?`);
    params.push(cleanTo);
  }
  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(je.entry_number LIKE ? OR je.reference_number LIKE ? OR je.narration LIKE ? OR c.customer_name LIKE ?)`);
    params.push(like, like, like, like);
  }

  const whereSql = whereClauses.join(' AND ');
  const offset = (Number(page) - 1) * Number(pageSize);

  const [rows] = await pool.query(`
    SELECT 
      je.id,
      je.uid,
      je.entry_number,
      je.voucher_type,
      COALESCE(DATE_FORMAT(NULLIF(je.entry_date, '0000-00-00'), '%Y-%m-%d'), DATE_FORMAT(je.entry_datetime, '%Y-%m-%d')) AS entry_date,
      je.reference_number,
      je.total_debit AS amount,
      je.narration,
      COALESCE(c.customer_name, 'Direct Counter') AS party_name,
      c.mobile_number,
      je.entry_datetime
    FROM journal_entries je
    LEFT JOIN journal_items ji ON ji.journal_entry_uid = je.uid AND ji.party_type = 'CUSTOMER'
    LEFT JOIN customer_master c ON c.uid = ji.party_uid
    WHERE ${whereSql}
    GROUP BY je.id
    ORDER BY je.entry_date DESC, je.id DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(pageSize), offset]);

  const [[{ count }]] = await pool.query(`
    SELECT COUNT(DISTINCT je.id) AS count
    FROM journal_entries je
    LEFT JOIN journal_items ji ON ji.journal_entry_uid = je.uid AND ji.party_type = 'CUSTOMER'
    LEFT JOIN customer_master c ON c.uid = ji.party_uid
    WHERE ${whereSql}
  `, params);

  const [[totals]] = await pool.query(`
    SELECT COALESCE(SUM(je.total_debit), 0) AS total_amount
    FROM journal_entries je
    LEFT JOIN journal_items ji ON ji.journal_entry_uid = je.uid AND ji.party_type = 'CUSTOMER'
    LEFT JOIN customer_master c ON c.uid = ji.party_uid
    WHERE ${whereSql}
  `, params);

  return {
    rows,
    total: Number(count || 0),
    page: Number(page),
    pageSize: Number(pageSize),
    totalAmount: Number(totals?.total_amount || 0)
  };
}

// 5. Payment Register (All payments: Operating Expenses, Dealer Purchases, Withdrawals)
async function getPaymentRegister({ fromDate = '', toDate = '', search = '', page = 1, pageSize = 50 } = {}) {
  const cleanFrom = fromDate ? fromDate.slice(0, 10) : '';
  const cleanTo = toDate ? toDate.slice(0, 10) : '';

  const whereClauses = [
    `je.delete_datetime IS NULL`,
    `je.status = 'POSTED'`,
    `je.voucher_type IN ('EXPENSE', 'PAYMENT', 'PURCHASE')`
  ];
  const params = [];

  if (cleanFrom) {
    whereClauses.push(`je.entry_date >= ?`);
    params.push(cleanFrom);
  }
  if (cleanTo) {
    whereClauses.push(`je.entry_date <= ?`);
    params.push(cleanTo);
  }
  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(je.entry_number LIKE ? OR je.reference_number LIKE ? OR je.narration LIKE ? OR d.dealer_name LIKE ?)`);
    params.push(like, like, like, like);
  }

  const whereSql = whereClauses.join(' AND ');
  const offset = (Number(page) - 1) * Number(pageSize);

  const [rows] = await pool.query(`
    SELECT 
      je.id,
      je.uid,
      je.entry_number,
      je.voucher_type,
      COALESCE(DATE_FORMAT(NULLIF(je.entry_date, '0000-00-00'), '%Y-%m-%d'), DATE_FORMAT(je.entry_datetime, '%Y-%m-%d')) AS entry_date,
      je.reference_number,
      je.total_debit AS amount,
      je.narration,
      COALESCE(d.dealer_name, 'Expense Vendor') AS party_name,
      je.entry_datetime
    FROM journal_entries je
    LEFT JOIN journal_items ji ON ji.journal_entry_uid = je.uid AND ji.party_type = 'DEALER'
    LEFT JOIN dealer_master d ON d.uid = ji.party_uid
    WHERE ${whereSql}
    GROUP BY je.id
    ORDER BY je.entry_date DESC, je.id DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(pageSize), offset]);

  const [[{ count }]] = await pool.query(`
    SELECT COUNT(DISTINCT je.id) AS count
    FROM journal_entries je
    LEFT JOIN journal_items ji ON ji.journal_entry_uid = je.uid AND ji.party_type = 'DEALER'
    LEFT JOIN dealer_master d ON d.uid = ji.party_uid
    WHERE ${whereSql}
  `, params);

  const [[totals]] = await pool.query(`
    SELECT COALESCE(SUM(je.total_debit), 0) AS total_amount
    FROM journal_entries je
    LEFT JOIN journal_items ji ON ji.journal_entry_uid = je.uid AND ji.party_type = 'DEALER'
    LEFT JOIN dealer_master d ON d.uid = ji.party_uid
    WHERE ${whereSql}
  `, params);

  return {
    rows,
    total: Number(count || 0),
    page: Number(page),
    pageSize: Number(pageSize),
    totalAmount: Number(totals?.total_amount || 0)
  };
}

// 6. Journal Register (All vouchers with multi-line double-entry details)
async function getJournalRegister({ fromDate = '', toDate = '', search = '', voucherType = '', page = 1, pageSize = 50 } = {}) {
  return await getDayBook({ fromDate, toDate, search, voucherType, page, pageSize });
}

module.exports = {
  listAccountTypes,
  listAccountGroups,
  listChartOfAccounts,
  getAccountByUid,
  createAccount,
  updateAccount,
  listJournalEntries,
  getJournalEntryByUid,
  createManualJournalVoucher,
  getAccountLedger,
  getARAgingReport,
  getCustomerStatement,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getAccountingDashboardMetrics,
  getDayBook,
  getCashBook,
  getBankBook,
  getReceiptRegister,
  getPaymentRegister,
  getJournalRegister
};
