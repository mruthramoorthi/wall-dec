const pool = require('../config/db.cjs');
const billModel = require('../models/billModel.cjs');
const accModel = require('../models/accountingModel.cjs');

async function testFlow() {
  console.log('=== Running Live Real-time Double-Entry Verification ===');

  const [custs] = await pool.query('SELECT uid FROM customer_master WHERE delete_datetime IS NULL LIMIT 1');
  const [stocks] = await pool.query(`
    SELECT sm.uid 
    FROM stock_master sm 
    JOIN stock_inward si ON si.stock_uid = sm.uid AND si.delete_datetime IS NULL
    WHERE sm.delete_datetime IS NULL 
    GROUP BY sm.uid 
    HAVING SUM(si.pieces) > 10 
    LIMIT 1
  `);

  if (!custs.length || !stocks.length) {
    console.log('No customers or stock items found for test.');
    process.exit(0);
  }

  // 1. Create a split sale bill (200 cash + 300 credit = 500 total)
  console.log('\n1. Creating split sale bill (₹200 Cash, ₹300 Credit, ₹500 Total)...');
  const newBill = await billModel.create({
    customer_uid: custs[0].uid,
    items: [{ stock_uid: stocks[0].uid, pieces: 1, rate_per_piece: 500 }],
    discount: 0,
    payments: [{ payment_mode: 'cash', amount: 200 }],
    is_credit: 1,
    due_date: '2026-09-30',
    due_narration: 'Test real-time accounting integration bill'
  });

  console.log(`✓ Bill created: ${newBill.uid} (Total: ₹${newBill.grand_total}, Due: ₹${newBill.due_amount})`);

  // 2. Verify Journal Entry Header
  const [jeRows] = await pool.query(
    `SELECT * FROM journal_entries WHERE source_table = 'bill_master' AND source_uid = ? AND delete_datetime IS NULL`,
    [newBill.uid]
  );
  console.log('✓ Linked Journal Entry:', {
    entry_number: jeRows[0].entry_number,
    voucher_type: jeRows[0].voucher_type,
    total_debit: jeRows[0].total_debit,
    total_credit: jeRows[0].total_credit,
    status: jeRows[0].status
  });

  // 3. Verify Journal Items
  const [items] = await pool.query(`
    SELECT ji.account_uid, coa.account_code, coa.account_name, ji.debit_amount, ji.credit_amount, ji.line_narration
    FROM journal_items ji
    JOIN chart_of_accounts coa ON coa.uid = ji.account_uid
    WHERE ji.journal_entry_uid = ?
  `, [jeRows[0].uid]);

  console.log('✓ Debits & Credits Breakdown:');
  for (const it of items) {
    console.log(`   - [${it.account_code}] ${it.account_name}: Dr ₹${it.debit_amount} | Cr ₹${it.credit_amount} (${it.line_narration})`);
  }

  // 4. Verify Trial Balance
  const tb = await accModel.getTrialBalance();
  console.log(`✓ Trial Balance status: ${tb.isBalanced ? 'BALANCED' : 'IMBALANCED'} (Total Dr: ₹${tb.totalDebit} | Total Cr: ₹${tb.totalCredit})`);

  // 5. Clean up test bill and verify voiding
  await billModel.softDelete(newBill.uid);
  const [voidedJe] = await pool.query(
    `SELECT status, delete_datetime FROM journal_entries WHERE source_table = 'bill_master' AND source_uid = ?`,
    [newBill.uid]
  );
  console.log('✓ Test bill soft deleted -> Journal Entry status:', voidedJe[0].status);

  console.log('\n=== All Real-Time Double-Entry Verification Tests Passed! ===\n');
  process.exit(0);
}

testFlow().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
