const pool = require('../config/db.cjs');
const accountingService = require('../services/accountingService.cjs');

async function backfill() {
  console.log('=== Starting Historical Double-Entry Accounting Backfill ===');

  try {
    // Clean prior backfilled journal entries
    await pool.query('DELETE FROM journal_items');
    await pool.query('DELETE FROM journal_entries');
    await pool.query('DELETE FROM ar_allocations');
    await pool.query('DELETE FROM ar_subledger');

    // 1. Backfill Sales Bills (Active only: update_datetime IS NULL AND delete_datetime IS NULL)
    const [bills] = await pool.query(`
      SELECT 
        b.id AS bill_id,
        b.uid AS bill_uid,
        b.customer_uid,
        COALESCE(c.customer_name, 'Retail Customer') AS customer_name,
        COALESCE(b.entry_datetime, NOW()) AS bill_date,
        b.total_amount AS subtotal,
        b.discount AS discount_amount,
        b.tax_amount,
        b.grand_total AS net_total,
        b.advance_amount AS paid_advance,
        b.due_amount AS credit_balance,
        b.is_credit
      FROM bill_master b
      LEFT JOIN customer_master c ON c.uid = b.customer_uid
      WHERE b.update_datetime IS NULL AND b.delete_datetime IS NULL
      ORDER BY b.id ASC
    `);

    console.log(`Found ${bills.length} active sales bills to backfill...`);

    for (const b of bills) {
      // Get active payments for this bill
      const [payments] = await pool.query(`
        SELECT bp.payment_mode, bp.amount, bp.bank_uid
        FROM bill_payments bp
        WHERE bp.bill_uid = ? AND bp.update_datetime IS NULL AND bp.delete_datetime IS NULL
      `, [b.bill_uid]);

      let paidCash = 0;
      let paidBank = 0;
      let bankUid = null;

      for (const p of payments) {
        const mode = (p.payment_mode || 'cash').trim().toLowerCase();
        if (mode === 'cash') {
          paidCash += Number(p.amount || 0);
        } else {
          paidBank += Number(p.amount || 0);
          if (p.bank_uid) bankUid = p.bank_uid;
        }
      }

      await accountingService.postSaleBillEntry(pool, {
        billUid: b.bill_uid,
        billId: b.bill_id,
        customerUid: b.customer_uid,
        customerName: b.customer_name,
        billDate: b.bill_date,
        subtotal: b.subtotal,
        discountAmount: b.discount_amount,
        taxAmount: b.tax_amount,
        roundOff: 0,
        netTotal: b.net_total,
        paidCash,
        paidBank,
        bankUid,
        paidAdvance: b.paid_advance,
        creditBalance: b.credit_balance
      });
    }
    console.log(`✓ Backfilled ${bills.length} sales bills into Journal Entries and AR Subledger`);

    // 2. Backfill Customer Advances (Active only)
    const [advances] = await pool.query(`
      SELECT 
        ca.id AS advance_id,
        ca.uid AS advance_uid,
        ca.customer_uid,
        COALESCE(c.customer_name, 'Customer') AS customer_name,
        ca.amount,
        ca.payment_mode,
        ca.bank_uid,
        ca.transaction_date,
        ca.notes
      FROM customer_advance ca
      LEFT JOIN customer_master c ON c.uid = ca.customer_uid
      WHERE ca.update_datetime IS NULL AND ca.delete_datetime IS NULL AND ca.amount > 0
      ORDER BY ca.id ASC
    `);

    console.log(`Found ${advances.length} active customer advances to backfill...`);
    for (const a of advances) {
      await accountingService.postCustomerAdvanceEntry(pool, {
        advanceUid: a.advance_uid,
        advanceId: a.advance_id,
        customerUid: a.customer_uid,
        customerName: a.customer_name,
        amount: a.amount,
        paymentMode: a.payment_mode,
        bankUid: a.bank_uid,
        transactionDate: a.transaction_date,
        notes: a.notes
      });
    }
    console.log(`✓ Backfilled ${advances.length} customer advances into Journal Entries`);

    // 3. Backfill Credit Receipts (Active only)
    const [receipts] = await pool.query(`
      SELECT 
        cr.id AS receipt_id,
        cr.uid AS receipt_uid,
        cr.customer_uid,
        COALESCE(c.customer_name, 'Customer') AS customer_name,
        cr.bill_uid,
        cr.amount,
        cr.payment_mode,
        cr.bank_uid,
        cr.receipt_date,
        cr.narration
      FROM credit_receipts cr
      LEFT JOIN customer_master c ON c.uid = cr.customer_uid
      WHERE cr.update_datetime IS NULL AND cr.delete_datetime IS NULL AND cr.amount > 0
      ORDER BY cr.id ASC
    `);

    console.log(`Found ${receipts.length} active credit receipts to backfill...`);
    for (const r of receipts) {
      await accountingService.postCreditReceiptEntry(pool, {
        receiptUid: r.receipt_uid,
        receiptId: r.receipt_id,
        customerUid: r.customer_uid,
        customerName: r.customer_name,
        billUid: r.bill_uid,
        amount: r.amount,
        paymentMode: r.payment_mode,
        bankUid: r.bank_uid,
        receiptDate: r.receipt_date,
        narration: r.narration
      });
    }
    console.log(`✓ Backfilled ${receipts.length} credit receipts into Journal Entries and AR Subledger`);

    // 4. Backfill Expenses (Active only)
    const [expenses] = await pool.query(`
      SELECT 
        e.id AS expense_id,
        e.uid AS expense_uid,
        e.category,
        e.amount,
        e.payment_mode,
        e.bank_uid,
        e.expense_date,
        e.narration
      FROM expense_master e
      WHERE e.update_datetime IS NULL AND e.delete_datetime IS NULL AND e.amount > 0
      ORDER BY e.id ASC
    `);

    console.log(`Found ${expenses.length} active expenses to backfill...`);
    for (const e of expenses) {
      await accountingService.postExpenseEntry(pool, {
        expenseUid: e.expense_uid,
        expenseId: e.expense_id,
        category: e.category,
        amount: e.amount,
        paymentMode: e.payment_mode,
        bankUid: e.bank_uid,
        expenseDate: e.expense_date,
        narration: e.narration
      });
    }
    console.log(`✓ Backfilled ${expenses.length} expenses into Journal Entries`);

    // 5. Automated Double-Entry Integrity Check
    console.log('\n--- Running Double-Entry Integrity Verification ---');
    const [imbalances] = await pool.query(`
      SELECT uid, entry_number, voucher_type, total_debit, total_credit, ABS(total_debit - total_credit) AS diff
      FROM journal_entries
      WHERE delete_datetime IS NULL AND ABS(total_debit - total_credit) > 0.01
    `);

    if (imbalances.length > 0) {
      console.error(`❌ CRITICAL: Found ${imbalances.length} imbalanced journal entries!`, imbalances);
      process.exit(1);
    } else {
      console.log('✓ 100% of Journal Entries have strict Debit == Credit balance.');
    }

    const [[trialTotals]] = await pool.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0) AS total_debits,
        COALESCE(SUM(credit_amount), 0) AS total_credits
      FROM journal_items
      WHERE delete_datetime IS NULL
    `);

    console.log(`✓ Trial Balance Check: Total Debits = ₹${Number(trialTotals.total_debits).toFixed(2)} | Total Credits = ₹${Number(trialTotals.total_credits).toFixed(2)}`);
    console.log('\n=== Backfill Completed Successfully! ===\n');

    process.exit(0);
  } catch (err) {
    console.error('Backfill failed with error:', err);
    process.exit(1);
  }
}

backfill();
