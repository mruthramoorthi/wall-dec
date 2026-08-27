const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');
const stockModel = require('./stockModel.cjs');
const accountingService = require('../services/accountingService.cjs');

const TABLE = 'stock_inward';

const COLS = `si.uid, si.is_opening, si.dealer_uid, d.dealer_name, si.stock_uid, si.size_uid, si.pieces,
              si.avg_total_rate, si.avg_rate_per_piece, si.entry_datetime,
              sm.design_number, sm.image_filename, sz.width_ft, sz.height_ft, sz.thickness_mm`;

const JOIN = `
  FROM ${TABLE} si
  JOIN stock_master sm ON sm.uid = si.stock_uid AND ${activeFilter('sm')}
  JOIN size_master sz ON sz.uid = si.size_uid AND ${activeFilter('sz')}
  LEFT JOIN dealer_master d ON d.uid = si.dealer_uid AND ${activeFilter('d')}
  WHERE ${activeFilter('si')}`;

const SORT_COLUMNS = {
  design_number: 'sm.design_number',
  dealer_name: 'd.dealer_name',
  pieces: 'si.pieces',
  avg_total_rate: 'si.avg_total_rate',
  avg_rate_per_piece: 'si.avg_rate_per_piece',
  selling_price_per_piece: 'si.selling_price_per_piece',
  entry_datetime: 'si.entry_datetime',
};

async function list({ pageSize, offset, search = '', sortColumn = 'si.entry_datetime', sortDir = 'DESC' }) {
  const params = [];
  let where = JOIN;
  if (search) {
    where += ` AND (CAST(sm.design_number AS CHAR) LIKE ? OR d.dealer_name LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like);
  }
  const [rows] = await pool.query(
    `SELECT ${COLS} ${where} ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count ${where}`, params);
  return { rows, total: count };
}

async function findByUid(uid) {
  const [rows] = await pool.query(`SELECT ${COLS} ${JOIN} AND si.uid = ?`, [uid]);
  return rows[0] || null;
}

// data: { is_opening, dealer_uid, items: [{ image_filename?, size_uid, pieces, avg_total_rate, selling_price_per_piece }], payment_mode?, paid_amount?, bank_uid?, ref_number?, due_date?, due_narration? }
async function createBatch(data) {
  return withTransaction(pool, async (conn) => {
    const createdUids = [];
    let batchTotalAmount = 0;
    let dealerName = 'Supplier Dealer';

    if (data.dealer_uid) {
      const [[dealer]] = await conn.query('SELECT dealer_name FROM dealer_master WHERE uid = ?', [data.dealer_uid]);
      if (dealer) dealerName = dealer.dealer_name;
    }

    const totalBatchAmt = data.items.reduce((s, i) => s + Number(i.avg_total_rate || 0), 0);

    // Normalize multiple payment lines
    let paymentsList = [];
    if (!data.is_opening) {
      if (Array.isArray(data.payments) && data.payments.length > 0) {
        paymentsList = data.payments.filter(p => Number(p.amount) > 0);
      } else if (Number(data.paid_amount) > 0) {
        paymentsList = [{
          payment_mode: data.payment_mode || 'cash',
          amount: Number(data.paid_amount),
          bank_uid: data.bank_uid || null,
          ref_number: data.ref_number || null,
          transaction_date: data.payment_date || null
        }];
      }
    }

    const totalPaidAmt = data.is_opening ? 0 : Math.min(totalBatchAmt, paymentsList.reduce((s, p) => s + Number(p.amount || 0), 0));
    const totalDueAmt = data.is_opening ? 0 : Math.max(0, totalBatchAmt - totalPaidAmt);
    const payMode = data.is_opening ? 'opening' : (paymentsList.length > 1 ? 'split' : (paymentsList[0]?.payment_mode || (totalPaidAmt > 0 ? 'cash' : 'credit')));
    const cleanBank = paymentsList[0]?.bank_uid || data.bank_uid || null;
    const cleanRef = paymentsList[0]?.ref_number || (data.ref_number ? data.ref_number.trim() : null);
    const cleanDueDate = data.due_date || null;
    const cleanDueNarr = data.due_narration || null;
    const overallCreditStatus = data.is_opening ? 'paid' : (totalDueAmt <= 0 ? 'paid' : (totalPaidAmt > 0 ? 'partially_paid' : 'unpaid'));

    for (const item of data.items) {
      const stock = await stockModel.findOrCreateForInward({
        image_filename: item.image_filename || null,
        gallery_images: item.gallery_images || null,
        size_uid: item.size_uid,
      }, conn);
      const uid = newUid();
      const avgRatePerPiece = Number(item.avg_total_rate) / Number(item.pieces);
      const sellingPricePerPiece = item.selling_price_per_piece ? Number(item.selling_price_per_piece) : null;
      const itemTot = Number(item.avg_total_rate || 0);
      batchTotalAmount += itemTot;

      // Proportional payment allocation for individual line items
      const itemRatio = totalBatchAmt > 0 ? itemTot / totalBatchAmt : 0;
      const itemPaid = Math.round(totalPaidAmt * itemRatio * 100) / 100;
      const itemDue = Math.max(0, Math.round((itemTot - itemPaid) * 100) / 100);
      const itemStatus = data.is_opening ? 'paid' : (itemDue <= 0 ? 'paid' : (itemPaid > 0 ? 'partially_paid' : 'unpaid'));

      await conn.query(
        `INSERT INTO ${TABLE}
         (uid, is_opening, dealer_uid, stock_uid, size_uid, pieces, avg_total_rate, total_purchase_amount, paid_amount, due_amount, payment_mode, bank_uid, ref_number, due_date, due_narration, credit_status, avg_rate_per_piece, selling_price_per_piece, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uid,
          data.is_opening ? 1 : 0,
          data.is_opening ? null : data.dealer_uid,
          stock.uid,
          item.size_uid,
          item.pieces,
          item.avg_total_rate,
          itemTot,
          itemPaid,
          itemDue,
          payMode,
          cleanBank,
          cleanRef,
          cleanDueDate,
          cleanDueNarr,
          itemStatus,
          avgRatePerPiece,
          sellingPricePerPiece
        ]
      );
      createdUids.push(uid);
    }

    // If purchase from dealer, post to Double-Entry Accounting
    if (!data.is_opening && data.dealer_uid && batchTotalAmount > 0) {
      const primaryUid = createdUids[0];
      await accountingService.postStockInwardEntry(conn, {
        inwardUid: primaryUid,
        inwardId: createdUids.length,
        dealerUid: data.dealer_uid,
        dealerName,
        totalAmount: batchTotalAmount,
        paidAmount: totalPaidAmt,
        paymentMode: payMode,
        bankUid: cleanBank,
        payments: paymentsList,
        inwardDate: new Date(),
        narration: `Stock Inward Batch (${data.items.length} items) from ${dealerName}${totalPaidAmt > 0 ? ` (Paid: ₹${totalPaidAmt})` : ' (Full Credit)'}`
      });

      // If immediate payments were made, record each payment split in dealer_payments ledger
      for (const p of paymentsList) {
        await conn.query(
          `INSERT INTO dealer_payments
           (uid, inward_uid, dealer_uid, amount, payment_mode, bank_uid, ref_number, payment_date, narration, entry_datetime)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            primaryUid,
            data.dealer_uid,
            Number(p.amount),
            p.payment_mode || 'cash',
            p.bank_uid || null,
            p.ref_number || null,
            p.transaction_date ? String(p.transaction_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
            p.narration || `Upfront payment (${(p.payment_mode || 'cash').toUpperCase()}) on inward from ${dealerName}`
          ]
        );
      }
    }

    return createdUids;
  });
}

async function edit(uid, item) {
  await withTransaction(pool, async (conn) => {
    const [[current]] = await conn.query(`SELECT is_opening, dealer_uid, stock_uid, size_uid, pieces, avg_total_rate, selling_price_per_piece FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`, [uid]);
    if (!current) throw Object.assign(new Error('Not found'), { status: 404 });
    await markSuperseded(conn, TABLE, uid);

    const sizeUid = item.size_uid || current.size_uid;
    const pieces = Number(item.pieces ?? current.pieces ?? 0);
    const avgTotalRate = Number(item.avg_total_rate ?? current.avg_total_rate ?? 0);
    const avgRatePerPiece = pieces === 0 ? 0 : avgTotalRate / pieces;
    const sellingPricePerPiece = item.selling_price_per_piece !== undefined
      ? (item.selling_price_per_piece ? Number(item.selling_price_per_piece) : null)
      : current.selling_price_per_piece;

    await conn.query(
      `INSERT INTO ${TABLE}
       (uid, is_opening, dealer_uid, stock_uid, size_uid, pieces, avg_total_rate, avg_rate_per_piece, selling_price_per_piece, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uid, current.is_opening, current.dealer_uid, current.stock_uid, sizeUid, pieces, avgTotalRate, avgRatePerPiece, sellingPricePerPiece]
    );
  });
  return findByUid(uid);
}

async function softDelete(uid) {
  return withTransaction(pool, async (conn) => {
    await accountingService.voidJournalEntry(conn, TABLE, uid);
    return markDeleted(conn, TABLE, uid);
  });
}

module.exports = { list, findByUid, createBatch, edit, softDelete, SORT_COLUMNS };
