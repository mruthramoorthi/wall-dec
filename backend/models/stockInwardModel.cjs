const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');
const stockModel = require('./stockModel.cjs');

const TABLE = 'stock_inward';

const COLS = `si.uid, si.is_opening, si.dealer_uid, d.dealer_name, si.stock_uid, si.size_uid, si.pieces,
              si.avg_total_rate, si.avg_rate_per_piece, si.entry_datetime,
              sm.design_number, sm.image_filename, sz.width_ft, sz.height_ft, sz.thickness_mm`;

// FIX: the previous version built this as `si.${ACTIVE_FILTER}`, which is a
// plain string concat — it only prefixes "si." onto update_datetime, leaving
// delete_datetime unqualified. Since stock_master/size_master/dealer_master
// all have their own delete_datetime column too, MySQL rejects that as an
// ambiguous column reference ("Column 'delete_datetime' in where clause is
// ambiguous") the moment more than one table is in scope — which is exactly
// why Stock Inward couldn't save/list. Fixed by using activeFilter(alias),
// and the joins to stock_master/size_master/dealer_master now also filter to
// their active row so a superseded (edited-away) master version can never be
// silently joined in as a duplicate row.
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

// data: { is_opening, dealer_uid, items: [{ image_filename?, size_uid, pieces, avg_total_rate, selling_price_per_piece }] }
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
      const sellingPricePerPiece = item.selling_price_per_piece ? Number(item.selling_price_per_piece) : null;
      await conn.query(
        `INSERT INTO ${TABLE}
         (uid, is_opening, dealer_uid, stock_uid, size_uid, pieces, avg_total_rate, avg_rate_per_piece, selling_price_per_piece, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uid, data.is_opening ? 1 : 0, data.is_opening ? null : data.dealer_uid, stock.uid, item.size_uid, item.pieces, item.avg_total_rate, avgRatePerPiece, sellingPricePerPiece]
      );
      createdUids.push(uid);
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
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, findByUid, createBatch, edit, softDelete, SORT_COLUMNS };
