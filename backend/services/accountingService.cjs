const pool = require('../config/db.cjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Cached map of standard account codes to their database UIDs and details.
 */
let accountCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

async function getAccountMap(connOrPool) {
  const now = Date.now();
  if (accountCache && (now - lastCacheTime < CACHE_TTL_MS)) {
    return accountCache;
  }

  const db = connOrPool || pool;
  const [rows] = await db.query(`
    SELECT 
      coa.uid, 
      coa.account_code, 
      coa.account_name, 
      coa.account_type_id,
      atm.type_code AS account_type, 
      coa.normal_balance, 
      coa.party_type, 
      coa.party_uid
    FROM chart_of_accounts coa
    JOIN account_type_master atm ON atm.type_id = coa.account_type_id
    WHERE coa.delete_datetime IS NULL AND coa.is_active = 1
  `);

  const codeMap = {};
  const partyMap = {};
  for (const r of rows) {
    codeMap[r.account_code] = r;
    if (r.party_uid) {
      partyMap[`${r.party_type}_${r.party_uid}`] = r;
    }
  }

  accountCache = { codeMap, partyMap, list: rows };
  lastCacheTime = now;
  return accountCache;
}

function clearAccountCache() {
  accountCache = null;
}

/**
 * Generate sequential formatted voucher number (e.g. SAL-202608-0001, RCP-202608-0042)
 */
async function generateVoucherNumber(connOrPool, voucherType) {
  const db = connOrPool || pool;
  const prefixMap = {
    'SALES': 'SAL',
    'RECEIPT': 'RCP',
    'PAYMENT': 'PAY',
    'PURCHASE': 'PUR',
    'EXPENSE': 'EXP',
    'JOURNAL': 'JV',
    'CONTRA': 'CNT',
    'CREDIT_NOTE': 'CN',
    'DEBIT_NOTE': 'DN'
  };

  const prefix = prefixMap[voucherType] || 'VOU';
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const searchPattern = `${prefix}-${yearMonth}-%`;

  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total FROM journal_entries WHERE entry_number LIKE ?`,
    [searchPattern]
  );

  const nextSeq = (row?.total || 0) + 1;
  return `${prefix}-${yearMonth}-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Core Journal Entry Poster: Inserts balanced Debits & Credits atomically
 */
async function postJournalEntry(connOrPool, {
  uid = null,
  entryNumber = null,
  voucherType = 'JOURNAL',
  entryDate = null,
  sourceTable = null,
  sourceUid = null,
  referenceNumber = null,
  narration = null,
  createdBy = null,
  items = [] // Array of { accountUid, partyType, partyUid, debitAmount, creditAmount, lineNarration }
}) {
  const db = connOrPool || pool;
  const entryUid = uid || uuidv4();
  const dateStr = entryDate ? String(entryDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const vNumber = entryNumber || await generateVoucherNumber(db, voucherType);

  if (!items || items.length === 0) {
    throw new Error(`Cannot post empty journal entry ${vNumber}`);
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const it of items) {
    const dr = Number(it.debitAmount || 0);
    const cr = Number(it.creditAmount || 0);
    totalDebit += dr;
    totalCredit += cr;
  }

  // Strict Double-Entry Balancing Guard (Floating point epsilon tolerance 0.01)
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.01) {
    throw new Error(
      `Double-Entry Invariant Violation on voucher ${vNumber}: Total Debits (₹${totalDebit.toFixed(2)}) must equal Total Credits (₹${totalCredit.toFixed(2)}). Discrepancy: ₹${diff.toFixed(2)}`
    );
  }

  // 1. Insert or update Header
  await db.query(
    `INSERT INTO journal_entries
       (uid, entry_number, voucher_type, entry_date, source_table, source_uid, reference_number,
        total_debit, total_credit, narration, status, created_by, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, NOW())
     ON DUPLICATE KEY UPDATE
       entry_number = VALUES(entry_number),
       voucher_type = VALUES(voucher_type),
       entry_date = VALUES(entry_date),
       reference_number = VALUES(reference_number),
       total_debit = VALUES(total_debit),
       total_credit = VALUES(total_credit),
       narration = VALUES(narration),
       status = 'POSTED',
       update_datetime = NOW(),
       delete_datetime = NULL`,
    [
      entryUid, vNumber, voucherType, dateStr, sourceTable, sourceUid,
      referenceNumber, totalDebit, totalCredit, narration, createdBy
    ]
  );

  // 2. Clear prior active items if updating
  await db.query(
    `DELETE FROM journal_items WHERE journal_entry_uid = ?`,
    [entryUid]
  );

  // 3. Insert line items
  for (const it of items) {
    const itemUid = uuidv4();
    const dr = Number(it.debitAmount || 0);
    const cr = Number(it.creditAmount || 0);
    if (dr <= 0 && cr <= 0) continue; // Skip zero balance lines

    await db.query(
      `INSERT INTO journal_items
         (uid, journal_entry_uid, account_uid, party_type, party_uid, debit_amount, credit_amount, line_narration, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        itemUid, entryUid, it.accountUid, it.partyType || 'NONE',
        it.partyUid || null, dr, cr, it.lineNarration || narration
      ]
    );
  }

  return { uid: entryUid, entryNumber: vNumber, totalDebit, totalCredit };
}

/**
 * Void/Cancel a journal entry linked to a source transaction
 */
async function voidJournalEntry(connOrPool, sourceTable, sourceUid) {
  const db = connOrPool || pool;
  await db.query(
    `UPDATE journal_entries
     SET status = 'VOIDED', delete_datetime = NOW()
     WHERE source_table = ? AND source_uid = ? AND delete_datetime IS NULL`,
    [sourceTable, sourceUid]
  );
}

/**
 * Resolve Bank Account UID from bank_uid or fallback to General Bank/Cheques
 */
async function resolveBankAccountUid(connOrPool, bankUid) {
  const { partyMap, codeMap } = await getAccountMap(connOrPool);
  if (bankUid && partyMap[`BANK_${bankUid}`]) {
    return partyMap[`BANK_${bankUid}`].uid;
  }
  return codeMap['1020']?.uid || codeMap['1010']?.uid;
}

/**
 * -------------------------------------------------------------
 * BUSINESS EVENT BRIDGES
 * -------------------------------------------------------------
 */

/**
 * Post a complete Sale Bill (Cash, Bank, Advance, Credit, Discount, Round Off)
 */
async function postSaleBillEntry(connOrPool, {
  billUid,
  billId,
  customerUid = null,
  customerName = 'Retail Customer',
  billDate,
  subtotal = 0,
  discountAmount = 0,
  taxAmount = 0,
  roundOff = 0,
  netTotal = 0,
  paidCash = 0,
  paidBank = 0,
  bankUid = null,
  paidAdvance = 0,
  creditBalance = 0,
  isWholesale = false,
  createdBy = null
}) {
  const db = connOrPool || pool;
  const { codeMap } = await getAccountMap(db);

  const cashAccUid = codeMap['1010'].uid;
  const arAccUid = codeMap['1030'].uid;
  const custAdvAccUid = codeMap['2020'].uid;
  const salesRevAccUid = isWholesale ? (codeMap['4020']?.uid || codeMap['4010'].uid) : codeMap['4010'].uid;
  const discountAccUid = codeMap['5020'].uid;
  const roundOffAccUid = codeMap['5030'].uid;
  const bankAccUid = await resolveBankAccountUid(db, bankUid);

  const billNo = `BILL-${String(billId).padStart(4, '0')}`;
  const items = [];

  let effectiveCash = Number(paidCash || 0);
  let effectiveBank = Number(paidBank || 0);
  const effectiveAdv = Number(paidAdvance || 0);
  const effectiveCredit = Number(creditBalance || 0);
  const effectiveDiscount = Number(discountAmount || 0);
  const effectiveNet = Number(netTotal || 0);

  // If payments in bill_payments + advance exceed net total, advance was included in bill_payments
  const totalSettled = effectiveCash + effectiveBank + effectiveAdv + effectiveCredit;
  if (totalSettled > effectiveNet && effectiveAdv > 0) {
    const excess = totalSettled - effectiveNet;
    if (effectiveCash >= excess) {
      effectiveCash -= excess;
    } else {
      const rem = excess - effectiveCash;
      effectiveCash = 0;
      effectiveBank = Math.max(0, effectiveBank - rem);
    }
  }

  // 1. Debits for Inflows & Receivables
  if (effectiveCash > 0) {
    items.push({
      accountUid: cashAccUid,
      partyType: 'NONE',
      debitAmount: effectiveCash,
      creditAmount: 0,
      lineNarration: `Cash received on ${billNo}`
    });
  }

  if (effectiveBank > 0) {
    items.push({
      accountUid: bankAccUid,
      partyType: 'BANK',
      partyUid: bankUid,
      debitAmount: effectiveBank,
      creditAmount: 0,
      lineNarration: `Bank/UPI payment on ${billNo}`
    });
  }

  if (effectiveAdv > 0) {
    items.push({
      accountUid: custAdvAccUid,
      partyType: 'CUSTOMER',
      partyUid: customerUid,
      debitAmount: effectiveAdv,
      creditAmount: 0,
      lineNarration: `Customer advance adjusted on ${billNo}`
    });
  }

  if (effectiveCredit > 0) {
    items.push({
      accountUid: arAccUid,
      partyType: 'CUSTOMER',
      partyUid: customerUid,
      debitAmount: effectiveCredit,
      creditAmount: 0,
      lineNarration: `Accounts Receivable credit on ${billNo} (${customerName})`
    });
  }

  if (effectiveDiscount > 0) {
    items.push({
      accountUid: discountAccUid,
      partyType: 'NONE',
      debitAmount: effectiveDiscount,
      creditAmount: 0,
      lineNarration: `Discount allowed on ${billNo}`
    });
  }

  // Round Off adjustment (Debit if discount/reduction, Credit if addition)
  if (Number(roundOff) !== 0) {
    const ro = Number(roundOff);
    if (ro < 0) {
      items.push({
        accountUid: roundOffAccUid,
        partyType: 'NONE',
        debitAmount: Math.abs(ro),
        creditAmount: 0,
        lineNarration: `Round-off reduction on ${billNo}`
      });
    } else {
      items.push({
        accountUid: roundOffAccUid,
        partyType: 'NONE',
        debitAmount: 0,
        creditAmount: ro,
        lineNarration: `Round-off addition on ${billNo}`
      });
    }
  }

  const gstAccUid = codeMap['2030']?.uid;
  const effectiveTax = Number(taxAmount || 0);

  // 2. Credits for Sales Revenue and Tax Output Payable
  const grossSales = Number(subtotal) > 0 ? Number(subtotal) : (effectiveNet + effectiveDiscount - effectiveTax - Number(roundOff));
  items.push({
    accountUid: salesRevAccUid,
    partyType: 'NONE',
    debitAmount: 0,
    creditAmount: grossSales,
    lineNarration: `Sales Revenue from ${billNo} (${customerName})`
  });

  if (effectiveTax > 0 && gstAccUid) {
    items.push({
      accountUid: gstAccUid,
      partyType: 'NONE',
      debitAmount: 0,
      creditAmount: effectiveTax,
      lineNarration: `GST Output Payable on ${billNo}`
    });
  }

  const jv = await postJournalEntry(db, {
    voucherType: 'SALES',
    entryDate: billDate,
    sourceTable: 'bill_master',
    sourceUid: billUid,
    referenceNumber: billNo,
    narration: `Sale Invoice ${billNo} - Party: ${customerName}`,
    createdBy,
    items
  });

  // 3. Update AR Subledger if credit exists or track full invoice lifecycle
  if (customerUid) {
    const subledgerUid = uuidv4();
    const dueDate = billDate ? String(billDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const invoiceAmt = Number(netTotal);
    const settledAmt = Number(paidCash) + Number(paidBank) + Number(paidAdvance);
    const outstandingAmt = Math.max(0, Number(creditBalance));
    const status = outstandingAmt <= 0 ? 'PAID' : (settledAmt > 0 ? 'PARTIAL' : 'OPEN');

    await db.query(
      `INSERT INTO ar_subledger
         (uid, customer_uid, bill_uid, journal_entry_uid, invoice_number, invoice_date, due_date,
          invoice_amount, settled_amount, outstanding_amount, status, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         invoice_amount = VALUES(invoice_amount),
         settled_amount = VALUES(settled_amount),
         outstanding_amount = VALUES(outstanding_amount),
         status = VALUES(status),
         update_datetime = NOW()`,
      [
        subledgerUid, customerUid, billUid, jv.uid, billNo, dueDate, dueDate,
        invoiceAmt, settledAmt, outstandingAmt, status
      ]
    );
  }

  return jv;
}

/**
 * Post Customer Advance Received
 */
async function postCustomerAdvanceEntry(connOrPool, {
  advanceUid,
  advanceId,
  customerUid = null,
  customerName = 'Customer',
  amount = 0,
  paymentMode = 'cash',
  bankUid = null,
  transactionDate = null,
  notes = null,
  createdBy = null
}) {
  const db = connOrPool || pool;
  const { codeMap } = await getAccountMap(db);
  const isBank = (paymentMode || '').trim().toLowerCase() !== 'cash';
  const debitAccUid = isBank ? await resolveBankAccountUid(db, bankUid) : codeMap['1010'].uid;
  const custAdvAccUid = codeMap['2020'].uid;
  const refNo = `ADV-${String(advanceId).padStart(4, '0')}`;
  const amt = Number(amount);

  const items = [
    {
      accountUid: debitAccUid,
      partyType: isBank ? 'BANK' : 'NONE',
      partyUid: isBank ? bankUid : null,
      debitAmount: amt,
      creditAmount: 0,
      lineNarration: `Advance received via ${paymentMode.toUpperCase()} (${refNo})`
    },
    {
      accountUid: custAdvAccUid,
      partyType: 'CUSTOMER',
      partyUid: customerUid,
      debitAmount: 0,
      creditAmount: amt,
      lineNarration: `Advance deposit liability for ${customerName} (${refNo})`
    }
  ];

  return await postJournalEntry(db, {
    voucherType: 'RECEIPT',
    entryDate: transactionDate,
    sourceTable: 'customer_advance',
    sourceUid: advanceUid,
    referenceNumber: refNo,
    narration: notes || `Customer Advance Received - ${customerName}`,
    createdBy,
    items
  });
}

/**
 * Post Credit Receipt / AR Debtors Collection
 */
async function postCreditReceiptEntry(connOrPool, {
  receiptUid,
  receiptId,
  customerUid = null,
  customerName = 'Customer',
  billUid = null,
  amount = 0,
  paymentMode = 'cash',
  bankUid = null,
  receiptDate = null,
  narration = null,
  createdBy = null
}) {
  const db = connOrPool || pool;
  const { codeMap } = await getAccountMap(db);
  const isBank = (paymentMode || '').trim().toLowerCase() !== 'cash';
  const debitAccUid = isBank ? await resolveBankAccountUid(db, bankUid) : codeMap['1010'].uid;
  const arAccUid = codeMap['1030'].uid;
  const refNo = `RCP-${String(receiptId).padStart(4, '0')}`;
  const amt = Number(amount);

  const items = [
    {
      accountUid: debitAccUid,
      partyType: isBank ? 'BANK' : 'NONE',
      partyUid: isBank ? bankUid : null,
      debitAmount: amt,
      creditAmount: 0,
      lineNarration: `Credit collection via ${paymentMode.toUpperCase()} (${refNo})`
    },
    {
      accountUid: arAccUid,
      partyType: 'CUSTOMER',
      partyUid: customerUid,
      debitAmount: 0,
      creditAmount: amt,
      lineNarration: `AR settlement for ${customerName} (${refNo})`
    }
  ];

  const jv = await postJournalEntry(db, {
    voucherType: 'RECEIPT',
    entryDate: receiptDate,
    sourceTable: 'credit_receipts',
    sourceUid: receiptUid,
    referenceNumber: refNo,
    narration: narration || `Credit Receipt Collection from ${customerName}`,
    createdBy,
    items
  });

  // Settle AR subledger if billUid is provided
  if (billUid && customerUid) {
    const [[subledger]] = await db.query(
      `SELECT * FROM ar_subledger WHERE bill_uid = ? AND delete_datetime IS NULL`,
      [billUid]
    );

    if (subledger) {
      const newSettled = Number(subledger.settled_amount || 0) + amt;
      const newOutstanding = Math.max(0, Number(subledger.invoice_amount || 0) - newSettled);
      const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIAL';

      await db.query(
        `UPDATE ar_subledger
         SET settled_amount = ?, outstanding_amount = ?, status = ?, update_datetime = NOW()
         WHERE uid = ?`,
        [newSettled, newOutstanding, newStatus, subledger.uid]
      );

      // Record allocation
      await db.query(
        `INSERT INTO ar_allocations
           (uid, ar_subledger_uid, source_table, source_uid, journal_entry_uid, allocated_amount, allocation_date, narration, entry_datetime)
         VALUES (UUID(), ?, 'credit_receipts', ?, ?, ?, ?, ?, NOW())`,
        [subledger.uid, receiptUid, jv.uid, amt, receiptDate ? String(receiptDate).slice(0, 10) : new Date().toISOString().slice(0, 10), narration || 'Credit Receipt Settlement']
      );
    }
  }

  return jv;
}

/**
 * Post Expense Voucher
 */
async function postExpenseEntry(connOrPool, {
  expenseUid,
  expenseId,
  category = 'General Expense',
  amount = 0,
  paymentMode = 'cash',
  bankUid = null,
  expenseDate = null,
  narration = null,
  createdBy = null
}) {
  const db = connOrPool || pool;
  const { codeMap, list } = await getAccountMap(db);
  const isBank = (paymentMode || '').trim().toLowerCase() !== 'cash';
  const creditAccUid = isBank ? await resolveBankAccountUid(db, bankUid) : codeMap['1010'].uid;
  
  // Find matching expense account for this category or fallback to 5040
  const cleanCat = category.trim().toLowerCase();
  const matchedAcc = list.find(a => a.account_type === 'EXPENSE' && a.account_name.toLowerCase().includes(cleanCat)) || codeMap['5040'];
  const debitAccUid = matchedAcc.uid;

  const refNo = `EXP-${String(expenseId).padStart(4, '0')}`;
  const amt = Number(amount);

  const items = [
    {
      accountUid: debitAccUid,
      partyType: 'NONE',
      debitAmount: amt,
      creditAmount: 0,
      lineNarration: `Expense: ${category} (${refNo})`
    },
    {
      accountUid: creditAccUid,
      partyType: isBank ? 'BANK' : 'NONE',
      partyUid: isBank ? bankUid : null,
      debitAmount: 0,
      creditAmount: amt,
      lineNarration: `Paid via ${paymentMode.toUpperCase()} (${refNo})`
    }
  ];

  return await postJournalEntry(db, {
    voucherType: 'EXPENSE',
    entryDate: expenseDate,
    sourceTable: 'expense_master',
    sourceUid: expenseUid,
    referenceNumber: refNo,
    narration: narration || `Expense: ${category}`,
    createdBy,
    items
  });
}

/**
 * Post Stock Inward / Purchase from Dealer
 */
async function postStockInwardEntry(connOrPool, {
  inwardUid,
  inwardId,
  dealerUid = null,
  dealerName = 'Supplier Dealer',
  invoiceNumber = null,
  inwardDate = null,
  totalAmount = 0,
  paidAmount = 0,
  paymentMode = 'credit',
  bankUid = null,
  payments = [],
  narration = null,
  createdBy = null
}) {
  const db = connOrPool || pool;
  const { codeMap } = await getAccountMap(db);
  const purchaseAccUid = codeMap['5010'].uid;
  const apAccUid = codeMap['2010'].uid;
  const refNo = invoiceNumber || `INW-${String(inwardId).padStart(4, '0')}`;
  const totAmt = Number(totalAmount);

  // Normalize payments list
  let activePayments = Array.isArray(payments) && payments.length > 0 ? payments : [];
  if (activePayments.length === 0 && Number(paidAmount) > 0) {
    activePayments = [{
      amount: Number(paidAmount),
      payment_mode: paymentMode || 'cash',
      bank_uid: bankUid || null
    }];
  }

  const totalPaidSum = activePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balAmt = Math.max(0, totAmt - totalPaidSum);

  const items = [
    {
      accountUid: purchaseAccUid,
      partyType: 'NONE',
      debitAmount: totAmt,
      creditAmount: 0,
      lineNarration: `Stock Inward purchase from ${dealerName} (${refNo})`
    }
  ];

  if (balAmt > 0) {
    items.push({
      accountUid: apAccUid,
      partyType: 'DEALER',
      partyUid: dealerUid,
      debitAmount: 0,
      creditAmount: balAmt,
      lineNarration: `Accounts Payable to ${dealerName} (${refNo})`
    });
  }

  for (const pay of activePayments) {
    const pAmt = Number(pay.amount || 0);
    if (pAmt <= 0) continue;
    const mode = (pay.payment_mode || 'cash').trim().toLowerCase();
    const isBank = mode !== 'cash';
    const payAccUid = isBank ? await resolveBankAccountUid(db, pay.bank_uid) : codeMap['1010'].uid;

    items.push({
      accountUid: payAccUid,
      partyType: isBank ? 'BANK' : 'NONE',
      partyUid: isBank ? pay.bank_uid : null,
      debitAmount: 0,
      creditAmount: pAmt,
      lineNarration: `Immediate payment on inward via ${mode.toUpperCase()}${pay.ref_number ? ` (Ref: ${pay.ref_number})` : ''}`
    });
  }

  return await postJournalEntry(db, {
    voucherType: 'PURCHASE',
    entryDate: inwardDate,
    sourceTable: 'stock_inward',
    sourceUid: inwardUid,
    referenceNumber: refNo,
    narration: narration || `Stock Inward from ${dealerName} - Inv #${refNo}`,
    createdBy,
    items
  });
}

/**
 * Post Dealer Credit Payment (Settlement of Accounts Payable)
 */
async function postDealerPaymentEntry(connOrPool, {
  paymentUid,
  paymentId,
  dealerUid = null,
  dealerName = 'Supplier Dealer',
  inwardUid = null,
  amount = 0,
  paymentMode = 'cash',
  bankUid = null,
  paymentDate = null,
  narration = null,
  createdBy = null
}) {
  const db = connOrPool || pool;
  const { codeMap } = await getAccountMap(db);
  const apAccUid = codeMap['2010'].uid; // Accounts Payable (Trade Creditors)
  const isBank = (paymentMode || '').trim().toLowerCase() !== 'cash';
  const creditAccUid = isBank ? await resolveBankAccountUid(db, bankUid) : codeMap['1010'].uid;
  const refNo = `DPAY-${String(paymentId).padStart(4, '0')}`;
  const amt = Number(amount);

  const items = [
    {
      accountUid: apAccUid,
      partyType: 'DEALER',
      partyUid: dealerUid,
      debitAmount: amt,
      creditAmount: 0,
      lineNarration: `Payment to ${dealerName} (${refNo})`
    },
    {
      accountUid: creditAccUid,
      partyType: isBank ? 'BANK' : 'NONE',
      partyUid: isBank ? bankUid : null,
      debitAmount: 0,
      creditAmount: amt,
      lineNarration: `Disbursed via ${paymentMode.toUpperCase()} (${refNo})`
    }
  ];

  return await postJournalEntry(db, {
    voucherType: 'PAYMENT',
    entryDate: paymentDate,
    sourceTable: 'dealer_payments',
    sourceUid: paymentUid,
    referenceNumber: refNo,
    narration: narration || `Dealer Payment to ${dealerName} - Ref #${refNo}`,
    createdBy,
    items
  });
}

module.exports = {
  getAccountMap,
  clearAccountCache,
  generateVoucherNumber,
  postJournalEntry,
  voidJournalEntry,
  postSaleBillEntry,
  postCustomerAdvanceEntry,
  postCreditReceiptEntry,
  postExpenseEntry,
  postStockInwardEntry,
  postDealerPaymentEntry
};
