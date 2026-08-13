const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');
const stockModel = require('./stockModel.cjs');

const TABLE = 'stock_inward';
const COLS = `si.uid, si.is_opening, si.dealer_uid, si.stock_uid, si.size_uid, si.pieces,
              si.avg_total_rate, si.avg_rate_per_piece, si.entry_datetime,
              sm.design_number, sz.width_ft, sz.height_ft, sz.thickness_mm`;

const JOIN = `
  FROM ${TABLE} si
  JOIN stock_master sm ON sm.uid = si.stock_uid
  JOIN size_master sz ON sz.uid = si.size_uid
  WHERE si.${ACTIVE_FILTER}`;

async function list({ pageSize, offset }) {
  const [rows] = await pool.query(`SELECT ${COLS} ${JOIN} ORDER BY si.entry_datetime DESC LIMIT ? OFFSET ?`, [pageSize, offset]);
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count ${JOIN}`);
  return { rows, total: count };
}

async function findByUid(uid) {
  const [rows] = await pool.query(`SELECT ${COLS} ${JOIN} AND si.uid = ?`, [uid]);
  return rows[0] || null;
}

// data: { is_opening, dealer_uid, items: [{ image_filename?, size_uid, pieces, avg_total_rate }] }
// Saves every line item in one transaction, creating/finding the stock_master
// row for each line (per SRS 5.3: matched image -> design number; no image -> new design).
async function createBatch(data) {
  return withTransaction(pool, async (conn) => {
    const createdUids = [];
    for (const item of data.items) {
      const stock = await stockModel.findOrCreateForInward({
        image_filename: item.image_filename || null,
        size_uid: item.size_uid,
      });
      const uid = newUid();
      const avgRatePerPiece = Number(item.avg_total_rate) / Number(item.pieces);
      await conn.query(
        `INSERT INTO ${TABLE}
         (uid, is_opening, dealer_uid, stock_uid, size_uid, pieces, avg_total_rate, avg_rate_per_piece, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uid, data.is_opening ? 1 : 0, data.is_opening ? null : data.dealer_uid, stock.uid, item.size_uid, item.pieces, item.avg_total_rate, avgRatePerPiece]
      );
      createdUids.push(uid);
    }
    return createdUids;
  });
}

async function edit(uid, item) {
  await withTransaction(pool, async (conn) => {
    const [[current]] = await conn.query(`SELECT is_opening, dealer_uid, stock_uid FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`, [uid]);
    if (!current) throw Object.assign(new Error('Not found'), { status: 404 });
    await markSuperseded(conn, TABLE, uid);
    const avgRatePerPiece = Number(item.avg_total_rate) / Number(item.pieces);
    await conn.query(
      `INSERT INTO ${TABLE}
       (uid, is_opening, dealer_uid, stock_uid, size_uid, pieces, avg_total_rate, avg_rate_per_piece, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uid, current.is_opening, current.dealer_uid, current.stock_uid, item.size_uid, item.pieces, item.avg_total_rate, avgRatePerPiece]
    );
  });
  return findByUid(uid);
}

async function softDelete(uid) {
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, findByUid, createBatch, edit, softDelete };
