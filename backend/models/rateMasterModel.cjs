const pool = require('../config/db.cjs');
const { activeFilter } = require('../utils/audit.cjs');

// Rate Master:
//  - purchase_rate_per_piece = avg_total_rate / pieces (calculated, non-editable)
//  - selling_price_per_piece  = editable
//  - Priority: missing sell price first, then latest entry first

async function list({ pageSize = 50, offset = 0, search = '' } = {}) {
  const params = [];
  let extraWhere = '';
  if (search.trim()) {
    extraWhere = ` AND (CAST(sm.design_number AS CHAR) LIKE ? OR d.dealer_name LIKE ?)`;
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  const sql = `
    SELECT
      si.uid,
      si.stock_uid,
      sm.design_number,
      sm.image_filename,
      si.pieces,
      si.avg_total_rate,
      si.avg_rate_per_piece,
      CASE
        WHEN si.pieces > 0 AND si.avg_total_rate > 0
          THEN ROUND(si.avg_total_rate / si.pieces, 2)
        ELSE COALESCE(si.avg_rate_per_piece, 0)
      END AS purchase_rate_per_piece,
      si.selling_price_per_piece,
      si.entry_datetime,
      d.dealer_name,
      sz.width_ft, sz.height_ft, sz.thickness_mm,
      CASE
        WHEN si.selling_price_per_piece IS NULL THEN 1
        WHEN si.selling_price_per_piece = 0 THEN 1
        ELSE 0
      END AS is_unpriced
    FROM stock_inward si
    JOIN stock_master sm ON sm.uid = si.stock_uid AND ${activeFilter('sm')}
    JOIN size_master sz ON sz.uid = si.size_uid AND ${activeFilter('sz')}
    LEFT JOIN dealer_master d ON d.uid = si.dealer_uid AND ${activeFilter('d')}
    WHERE ${activeFilter('si')}${extraWhere}
    ORDER BY is_unpriced DESC, si.entry_datetime DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...params, Number(pageSize), Number(offset)]);

  const countSql = `
    SELECT COUNT(*) AS count
    FROM stock_inward si
    JOIN stock_master sm ON sm.uid = si.stock_uid AND ${activeFilter('sm')}
    JOIN size_master sz ON sz.uid = si.size_uid AND ${activeFilter('sz')}
    LEFT JOIN dealer_master d ON d.uid = si.dealer_uid AND ${activeFilter('d')}
    WHERE ${activeFilter('si')}${extraWhere}
  `;
  const [[{ count }]] = await pool.query(countSql, params);

  return { rows, total: count };
}

// Only sell price is editable now
async function updateRates(uid, { selling_price_per_piece }) {
  const sp = selling_price_per_piece !== '' && selling_price_per_piece !== null
    ? Number(selling_price_per_piece)
    : null;

  await pool.query(
    `UPDATE stock_inward SET selling_price_per_piece = ? WHERE uid = ? AND delete_datetime IS NULL`,
    [sp, uid]
  );

  // Also sync to stock_master
  if (sp !== null) {
    await pool.query(
      `UPDATE stock_master sm
       JOIN stock_inward si ON si.uid = ? AND si.stock_uid = sm.uid
       SET sm.selling_price_per_piece = ?
       WHERE sm.delete_datetime IS NULL`,
      [uid, sp]
    );
  }

  return { uid, selling_price_per_piece: sp };
}

module.exports = { list, updateRates };
