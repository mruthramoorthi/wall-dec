const pool = require('../config/db.cjs');
const stockInwardModel = require('../models/stockInwardModel.cjs');
const accountingModel = require('../models/accountingModel.cjs');

async function testStockInwardMultiPayments() {
  console.log('=== TEST: Stock Inward Multiple Payment Splits ===');

  const [[dealer]] = await pool.query('SELECT uid, dealer_name FROM dealer_master WHERE delete_datetime IS NULL LIMIT 1');
  const [[size]] = await pool.query('SELECT uid FROM size_master WHERE delete_datetime IS NULL LIMIT 1');
  const [[bank]] = await pool.query('SELECT uid, bank_name FROM bank_master WHERE delete_datetime IS NULL LIMIT 1');
  if (!dealer || !size) throw new Error('Missing test master records');

  console.log(`Dealer: ${dealer.dealer_name}, Bank: ${bank ? bank.bank_name : 'N/A'}`);

  // Create Inward Batch with 2 Payment Splits: ₹3,000 Cash + ₹4,000 Bank on a ₹10,000 Purchase (₹3,000 Due)
  console.log('\n--- 1. Creating Stock Inward with Multi-Payment Lines ---');
  const [inwardUid] = await stockInwardModel.createBatch({
    is_opening: 0,
    dealer_uid: dealer.uid,
    due_date: '2026-09-30',
    due_narration: 'Test multi-split supplier terms',
    items: [
      {
        size_uid: size.uid,
        pieces: 5,
        avg_total_rate: 5000,
        selling_price_per_piece: 1500
      },
      {
        size_uid: size.uid,
        pieces: 5,
        avg_total_rate: 5000,
        selling_price_per_piece: 1500
      }
    ],
    payments: [
      {
        payment_mode: 'cash',
        amount: 3000,
        transaction_date: '2026-08-27'
      },
      {
        payment_mode: 'bank',
        amount: 4000,
        bank_uid: bank ? bank.uid : null,
        ref_number: 'UTR-SPLIT-9988',
        transaction_date: '2026-08-27'
      }
    ]
  });

  const [[inw]] = await pool.query('SELECT * FROM stock_inward WHERE uid = ?', [inwardUid]);
  console.log('Inward Primary Record:', {
    total_purchase: inw.total_purchase_amount,
    paid: inw.paid_amount,
    due: inw.due_amount,
    status: inw.credit_status,
    mode: inw.payment_mode
  });

  // Verify dealer_payments ledger
  const [dpayRows] = await pool.query('SELECT * FROM dealer_payments WHERE inward_uid = ?', [inwardUid]);
  console.log(`✓ Recorded ${dpayRows.length} dealer payment splits:`, dpayRows.map(p => `${p.payment_mode}: ₹${p.amount} (ref: ${p.ref_number || 'none'})`));

  if (dpayRows.length !== 2) {
    throw new Error(`Expected 2 dealer payment records, got ${dpayRows.length}`);
  }

  // Verify Journal Entry
  const [[jv]] = await pool.query(`
    SELECT * FROM journal_entries WHERE source_table = 'stock_inward' AND source_uid = ? AND delete_datetime IS NULL
  `, [inwardUid]);

  const [items] = await pool.query(`
    SELECT * FROM journal_items WHERE journal_entry_uid = ? AND delete_datetime IS NULL
  `, [jv.uid]);

  console.log(`✓ Multi-split JV #${jv.entry_number} (Dr: ₹${jv.total_debit} === Cr: ₹${jv.total_credit})`);
  console.log('  Items:', items.map(i => `${i.debit_amount > 0 ? 'Dr' : 'Cr'} ₹${i.debit_amount || i.credit_amount}: ${i.line_narration}`));

  if (Number(jv.total_debit) !== 10000 || Number(jv.total_credit) !== 10000) {
    throw new Error('Journal entry total debit/credit mismatch on multi-split');
  }

  // Check Trial Balance & Balance Sheet
  const [tb, bs] = await Promise.all([
    accountingModel.getTrialBalance(),
    accountingModel.getBalanceSheet()
  ]);

  console.log(`✓ Trial Balance isBalanced: ${tb.isBalanced} (Dr: ₹${tb.totalDebit} === Cr: ₹${tb.totalCredit})`);
  console.log(`✓ Balance Sheet isBalanced: ${bs.isBalanced} (Assets: ₹${bs.assets.total} === Liab+Equity: ₹${bs.totalLiabilitiesAndEquity})`);

  if (!tb.isBalanced || !bs.isBalanced) {
    throw new Error('Statements imbalanced after multi-split stock inward');
  }

  // Cleanup
  console.log('\n--- 2. Cleaning up test record ---');
  await stockInwardModel.softDelete(inwardUid);
  await pool.query('DELETE FROM dealer_payments WHERE inward_uid = ?', [inwardUid]);

  const [postTb, postBs] = await Promise.all([
    accountingModel.getTrialBalance(),
    accountingModel.getBalanceSheet()
  ]);
  console.log(`✓ Post-cleanup Trial Balance balanced: ${postTb.isBalanced}, Balance Sheet balanced: ${postBs.isBalanced}`);

  console.log('\n=== MULTI-PAYMENT STOCK INWARD TEST PASSED 100% ===');
}

testStockInwardMultiPayments()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
