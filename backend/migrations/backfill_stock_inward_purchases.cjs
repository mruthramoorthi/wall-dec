const pool = require('../config/db.cjs');
const { v4: uuidv4 } = require('uuid');
const accountingService = require('../services/accountingService.cjs');

async function backfillStockInwards() {
  console.log('=== Starting Double-Entry Backfill for Stock Inwards / Dealer Purchases ===');

  const [inwards] = await pool.query(`
    SELECT 
      si.id,
      si.uid,
      si.dealer_uid,
      COALESCE(d.dealer_name, 'Supplier Dealer') AS dealer_name,
      si.avg_total_rate,
      COALESCE(DATE(si.entry_datetime), CURDATE()) AS entry_date,
      si.entry_datetime
    FROM stock_inward si
    LEFT JOIN dealer_master d ON d.uid = si.dealer_uid
    WHERE si.is_opening = 0 AND si.dealer_uid IS NOT NULL AND si.delete_datetime IS NULL
    ORDER BY si.id ASC
  `);

  console.log(`Found ${inwards.length} dealer purchase inward records to backfill.`);

  let createdCount = 0;

  for (const inw of inwards) {
    // Check if journal entry already exists
    const [[existing]] = await pool.query(`
      SELECT uid FROM journal_entries WHERE source_table = 'stock_inward' AND source_uid = ? AND delete_datetime IS NULL
    `, [inw.uid]);

    if (existing) {
      console.log(`Skipping Inward #${inw.id} (already linked to JV: ${existing.uid})`);
      continue;
    }

    const amt = Number(inw.avg_total_rate || 0);
    if (amt <= 0) continue;

    await accountingService.postStockInwardEntry(pool, {
      inwardUid: inw.uid,
      inwardId: inw.id,
      dealerUid: inw.dealer_uid,
      dealerName: inw.dealer_name,
      invoiceNumber: `INW-${String(inw.id).padStart(4, '0')}`,
      inwardDate: inw.entry_date,
      totalAmount: amt,
      paidAmount: 0, // Recorded as Accounts Payable (Credit purchase)
      paymentMode: 'credit',
      narration: `Stock Inward Purchase from ${inw.dealer_name} (INW-${String(inw.id).padStart(4, '0')})`
    });

    createdCount++;
    console.log(`✓ Posted Purchase JV for Inward #${inw.id} (${inw.dealer_name}, ₹${amt})`);
  }

  console.log(`=== Backfill complete: ${createdCount} Purchase vouchers created ===`);
}

backfillStockInwards()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backfill error:', err);
    process.exit(1);
  });
