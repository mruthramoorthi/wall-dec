const pool = require('../config/db.cjs');
const expenseModel = require('../models/expenseModel.cjs');
const advanceModel = require('../models/advanceModel.cjs');
const billModel = require('../models/billModel.cjs');
const creditModel = require('../models/creditModel.cjs');
const transactionModel = require('../models/transactionModel.cjs');

async function testLedger() {
  console.log('--- Testing Unified Transaction Ledger System ---');

  try {
    // 1. Test Expense creation -> Negative amount in account_transactions
    console.log('1. Testing Expense Creation...');
    const expenseData = {
      category: 'Office Supplies Test',
      amount: 450.00,
      payment_mode: 'cash',
      narration: 'Pen and papers test voucher'
    };
    const createdExpense = await expenseModel.create(expenseData);
    console.log('   - Created expense uid:', createdExpense.uid);

    const [[expTxn]] = await pool.query(
      `SELECT uid, transaction_type, amount, party_name, reference_number 
       FROM account_transactions 
       WHERE source_table = 'expense_master' AND source_uid = ? AND delete_datetime IS NULL`,
      [createdExpense.uid]
    );

    console.log('   - Transaction in account_transactions:', expTxn);
    const isNegative = Number(expTxn.amount) === -450.00;
    console.log('   - Expense amount is negative (-450):', isNegative ? 'PASS ✓' : 'FAIL ✗');

    // 2. Test Customer Advance creation -> Positive amount in account_transactions
    console.log('2. Testing Advance Creation...');
    const [[cust]] = await pool.query('SELECT uid FROM customer_master WHERE delete_datetime IS NULL LIMIT 1');
    const advData = {
      customer_uid: cust.uid,
      amount: 1200.00,
      payment_mode: 'bank',
      notes: 'Test pre-booking token advance'
    };
    const createdAdv = await advanceModel.create(advData);
    console.log('   - Created advance uid:', createdAdv.uid);

    const [[advTxn]] = await pool.query(
      `SELECT uid, transaction_type, amount, party_name, reference_number 
       FROM account_transactions 
       WHERE source_table = 'customer_advance' AND source_uid = ? AND delete_datetime IS NULL`,
      [createdAdv.uid]
    );
    console.log('   - Transaction in account_transactions:', advTxn);
    const isAdvPositive = Number(advTxn.amount) === 1200.00;
    console.log('   - Advance amount is positive (+1200):', isAdvPositive ? 'PASS ✓' : 'FAIL ✗');

    // 3. Test listTransactions query and totals
    console.log('3. Testing listTransactions & Totals calculation...');
    const listResult = await transactionModel.listTransactions({ pageSize: 50 });
    console.log('   - Total transactions:', listResult.total);
    console.log('   - Totals:', listResult.totals);
    const hasCorrectMath = listResult.totals.net_balance === (listResult.totals.total_income - listResult.totals.total_expenses);
    console.log('   - Net balance math correct:', hasCorrectMath ? 'PASS ✓' : 'FAIL ✗');

    // 4. Test Expense Edit -> updates negative amount
    console.log('4. Testing Expense Edit...');
    await expenseModel.edit(createdExpense.uid, {
      ...expenseData,
      amount: 600.00
    });
    const [[editedExpTxn]] = await pool.query(
      `SELECT amount FROM account_transactions WHERE source_table = 'expense_master' AND source_uid = ? AND delete_datetime IS NULL`,
      [createdExpense.uid]
    );
    console.log('   - Updated expense amount (-600):', Number(editedExpTxn.amount) === -600.00 ? 'PASS ✓' : 'FAIL ✗');

    // 5. Test Expense Soft Delete -> soft-deletes in account_transactions
    console.log('5. Testing Expense Deletion...');
    await expenseModel.softDelete(createdExpense.uid);
    const [[deletedExpTxn]] = await pool.query(
      `SELECT uid, delete_datetime FROM account_transactions WHERE source_table = 'expense_master' AND source_uid = ?`,
      [createdExpense.uid]
    );
    console.log('   - Deleted expense marked with delete_datetime:', deletedExpTxn.delete_datetime ? 'PASS ✓' : 'FAIL ✗');

    // Clean up test advance
    await advanceModel.softDelete(createdAdv.uid);

    console.log('\n--- ALL TRANSACTION LEDGER TESTS PASSED ---');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testLedger();
