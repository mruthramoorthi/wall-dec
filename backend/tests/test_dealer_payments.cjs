const pool = require('../config/db.cjs');
const stockInwardModel = require('../models/stockInwardModel.cjs');
const dealerPaymentModel = require('../models/dealerPaymentModel.cjs');
const accountingModel = require('../models/accountingModel.cjs');

async function testDealerPaymentFlow() {
  console.log('=== TEST: Dealer Credit Purchase & Accounts Payable Payments ===');

  const [[dealer]] = await pool.query('SELECT uid, dealer_name FROM dealer_master WHERE delete_datetime IS NULL LIMIT 1');
  const [[size]] = await pool.query('SELECT uid FROM size_master WHERE delete_datetime IS NULL LIMIT 1');
  if (!dealer || !size) throw new Error('Fixtures missing');

  console.log(`Using Dealer: ${dealer.dealer_name} (${dealer.uid})`);

  // 1. Create Stock Inward with Partial payment: Total ₹4,000, Paid ₹1,500 in Cash, Due ₹2,500
  console.log('\n--- 1. Creating Inward with Partial Upfront Payment ---');
  const [inwardUid] = await stockInwardModel.createBatch({
    is_opening: 0,
    dealer_uid: dealer.uid,
    payment_mode: 'cash',
    paid_amount: 1500,
    due_date: '2026-09-15',
    due_narration: 'Test 30-day supplier credit terms',
    items: [
      {
        size_uid: size.uid,
        pieces: 4,
        avg_total_rate: 4000,
        selling_price_per_piece: 1200
      }
    ]
  });

  const [[inwRow]] = await pool.query('SELECT * FROM stock_inward WHERE uid = ?', [inwardUid]);
  console.log('Inward Created:', {
    id: inwRow.id,
    total_purchase_amount: inwRow.total_purchase_amount,
    paid_amount: inwRow.paid_amount,
    due_amount: inwRow.due_amount,
    credit_status: inwRow.credit_status
  });

  if (Number(inwRow.paid_amount) !== 1500 || Number(inwRow.due_amount) !== 2500 || inwRow.credit_status !== 'partially_paid') {
    throw new Error('Stock Inward payment calculations mismatch');
  }

  // 2. Check Purchase Journal Entry
  const [[purJv]] = await pool.query(`
    SELECT * FROM journal_entries WHERE source_table = 'stock_inward' AND source_uid = ? AND delete_datetime IS NULL
  `, [inwardUid]);

  const [purItems] = await pool.query(`
    SELECT * FROM journal_items WHERE journal_entry_uid = ? AND delete_datetime IS NULL
  `, [purJv.uid]);

  console.log(`✓ Purchase JV #${purJv.entry_number} (Dr: ₹${purJv.total_debit}, Cr: ₹${purJv.total_credit})`);
  console.log('  Items:', purItems.map(i => `${i.debit_amount > 0 ? 'Dr' : 'Cr'} ₹${i.debit_amount || i.credit_amount}: ${i.line_narration}`));

  // 3. Query Dealer Credit Purchases List
  console.log('\n--- 2. Querying Dealer Credit Purchases API ---');
  const creditList = await dealerPaymentModel.listDealerCreditPurchases({ dealer_uid: dealer.uid, status: 'pending' });
  const pendingInw = creditList.rows.find(r => r.inward_uid === inwardUid);
  if (!pendingInw || Number(pendingInw.due_amount) !== 2500) {
    throw new Error('Dealer credit purchases list did not return correct due amount');
  }
  console.log(`✓ Found pending inward ${pendingInw.inward_number} with due ₹${pendingInw.due_amount}`);

  // 4. Make Remaining Due Payment of ₹2,500
  console.log('\n--- 3. Recording Dealer Credit Due Payment (₹2,500) ---');
  const payRes = await dealerPaymentModel.recordPayment({
    inward_uid: inwardUid,
    amount: 2500,
    payment_mode: 'cash',
    payment_date: new Date().toISOString().slice(0, 10),
    narration: 'Test Full Settlement of Dealer Balance'
  });

  console.log('Payment Recorded:', payRes);
  if (payRes.remaining_due !== 0 || payRes.credit_status !== 'paid') {
    throw new Error('Dealer payment did not fully clear due balance');
  }

  // 5. Check Payment Journal Entry
  const [[payJv]] = await pool.query(`
    SELECT * FROM journal_entries WHERE source_table = 'dealer_payments' AND source_uid = ? AND delete_datetime IS NULL
  `, [payRes.payment_uid]);

  console.log(`✓ Dealer Payment JV #${payJv.entry_number} (Dr: ₹${payJv.total_debit}, Cr: ₹${payJv.total_credit})`);

  // 6. Verify Financial Statements are Balanced
  console.log('\n--- 4. Checking Trial Balance & Balance Sheet Reconciliations ---');
  const [tb, bs] = await Promise.all([
    accountingModel.getTrialBalance(),
    accountingModel.getBalanceSheet()
  ]);

  console.log(`✓ Trial Balance isBalanced: ${tb.isBalanced} (Dr: ₹${tb.totalDebit} === Cr: ₹${tb.totalCredit})`);
  console.log(`✓ Balance Sheet isBalanced: ${bs.isBalanced} (Assets: ₹${bs.assets.total} === Liab+Equity: ₹${bs.totalLiabilitiesAndEquity})`);

  if (!tb.isBalanced || !bs.isBalanced) {
    throw new Error('Financial Statements imbalanced after dealer credit payment');
  }

  // 7. Cleanup test records
  console.log('\n--- 5. Audit Cleanup & Reversals ---');
  await dealerPaymentModel.deletePayment(payRes.payment_uid);
  await stockInwardModel.softDelete(inwardUid);

  const [postTb, postBs] = await Promise.all([
    accountingModel.getTrialBalance(),
    accountingModel.getBalanceSheet()
  ]);
  console.log(`✓ Post-cleanup Trial Balance balanced: ${postTb.isBalanced}, Balance Sheet balanced: ${postBs.isBalanced}`);

  console.log('\n=== ALL DEALER PURCHASE & PAYMENT TESTS PASSED PERFECTLY ===');
}

testDealerPaymentFlow()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
  });
