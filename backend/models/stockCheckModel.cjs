const pool = require('../config/db.cjs');

async function getStockCheckReport({ fromDate, toDate, searchDesign, sizeUid, statusFilter, pageSize = 10, offset = 0, sortBy = 'design_number', sortDir = 'ASC' }) {
  let whereClauses = ['sm.delete_datetime IS NULL'];
  let params = [];

  // Helper for MySQL datetime format or IS NULL check
  const fromDt = fromDate ? fromDate.replace('T', ' ') + ':00' : null;
  const toDt = toDate ? toDate.replace('T', ' ') + ':59' : null;

  if (searchDesign) {
    whereClauses.push('sm.design_number LIKE ?');
    params.push(`%${searchDesign}%`);
  }

  if (sizeUid) {
    whereClauses.push('sm.size_uid = ?');
    params.push(sizeUid);
  }

  const whereSql = whereClauses.join(' AND ');

  const validSortCols = {
    design_number: 'design_number',
    entry_datetime: 'design_created_at',
    inward_pcs: 'total_inward_pcs',
    billed_pcs: 'total_billed_pcs',
    available_pcs: 'available_pcs',
    purchase_rate: 'avg_purchase_rate_per_piece',
    sales_rate: 'sales_price_per_piece',
    stock_value: 'stock_value'
  };

  const sortColumn = validSortCols[sortBy] || 'sm.design_number';
  const sortDirection = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const baseQuery = `
    SELECT 
      sm.uid AS stock_uid,
      sm.design_number,
      sm.image_filename,
      sm.size_uid,
      sm.selling_price_per_piece AS master_sales_price,
      sm.entry_datetime AS design_created_at,
      sz.width_ft,
      sz.height_ft,
      sz.thickness_mm,
      COALESCE(si_summary.total_inward_pcs, 0) AS total_inward_pcs,
      COALESCE(si_summary.avg_purchase_rate_per_piece, 0) AS avg_purchase_rate_per_piece,
      COALESCE(si_summary.sales_price_per_piece, sm.selling_price_per_piece, 0) AS sales_price_per_piece,
      COALESCE(bi_summary.total_billed_pcs, 0) AS total_billed_pcs,
      (COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0)) AS available_pcs,
      ((COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0)) * COALESCE(si_summary.avg_purchase_rate_per_piece, 0)) AS stock_value
    FROM stock_master sm
    JOIN size_master sz ON sm.size_uid = sz.uid AND sz.delete_datetime IS NULL
    LEFT JOIN (
      SELECT 
        si.stock_uid,
        SUM(si.pieces) AS total_inward_pcs,
        AVG(si.avg_rate_per_piece) AS avg_purchase_rate_per_piece,
        MAX(si.selling_price_per_piece) AS sales_price_per_piece
      FROM stock_inward si
      WHERE si.delete_datetime IS NULL
        ${fromDt ? 'AND si.entry_datetime >= ?' : ''}
        ${toDt ? 'AND si.entry_datetime <= ?' : ''}
      GROUP BY si.stock_uid
    ) si_summary ON sm.uid = si_summary.stock_uid
    LEFT JOIN (
      SELECT 
        bi.stock_uid,
        SUM(bi.pieces) AS total_billed_pcs
      FROM bill_items bi
      JOIN bill_master bm ON bi.bill_uid = bm.uid AND bm.delete_datetime IS NULL
      WHERE bi.delete_datetime IS NULL
        ${fromDt ? 'AND bi.entry_datetime >= ?' : ''}
        ${toDt ? 'AND bi.entry_datetime <= ?' : ''}
      GROUP BY bi.stock_uid
    ) bi_summary ON sm.uid = bi_summary.stock_uid
    WHERE ${whereSql}
  `;

  // Build params list for subqueries & outer query
  const queryParams = [];
  if (fromDt) queryParams.push(fromDt);
  if (toDt) queryParams.push(toDt);
  if (fromDt) queryParams.push(fromDt);
  if (toDt) queryParams.push(toDt);
  queryParams.push(...params);

  // Status Filter wrapping
  let havingClause = '';
  if (statusFilter === 'in_stock') {
    havingClause = 'HAVING available_pcs > 0';
  } else if (statusFilter === 'out_of_stock') {
    havingClause = 'HAVING available_pcs <= 0';
  } else if (statusFilter === 'low_stock') {
    havingClause = 'HAVING available_pcs > 0 AND available_pcs <= 5';
  }

  const dataSql = `
    SELECT * FROM (${baseQuery}) AS report_data
    ${havingClause}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total_count,
           SUM(total_inward_pcs) AS total_inward_all,
           SUM(total_billed_pcs) AS total_billed_all,
           SUM(available_pcs) AS available_pcs_all,
           SUM(stock_value) AS stock_value_all
    FROM (${baseQuery}) AS report_data
    ${havingClause}
  `;

  const [rows] = await pool.query(dataSql, [...queryParams, Number(pageSize), Number(offset)]);
  const [[summary]] = await pool.query(countSql, queryParams);

  return {
    rows,
    total: summary?.total_count || 0,
    summary: {
      total_designs: summary?.total_count || 0,
      total_inward_pcs: Number(summary?.total_inward_all || 0),
      total_billed_pcs: Number(summary?.total_billed_all || 0),
      available_pcs: Number(summary?.available_pcs_all || 0),
      total_stock_value: Number(summary?.stock_value_all || 0)
    }
  };
}

async function getDesignMovementHistory({ stock_uid, fromDate, toDate }) {
  const fromDt = fromDate ? fromDate.replace('T', ' ') + ':00' : null;
  const toDt = toDate ? toDate.replace('T', ' ') + ':59' : null;

  // 1. Fetch Inwards
  let inwardSql = `
    SELECT 
      'inward' AS type,
      si.uid,
      si.entry_datetime,
      si.pieces,
      si.avg_rate_per_piece AS purchase_rate,
      si.selling_price_per_piece AS sales_rate,
      si.is_opening,
      dm.dealer_name
    FROM stock_inward si
    LEFT JOIN dealer_master dm ON si.dealer_uid = dm.uid
    WHERE si.stock_uid = ? AND si.delete_datetime IS NULL
  `;
  const inwardParams = [stock_uid];
  if (fromDt) {
    inwardSql += ' AND si.entry_datetime >= ?';
    inwardParams.push(fromDt);
  }
  if (toDt) {
    inwardSql += ' AND si.entry_datetime <= ?';
    inwardParams.push(toDt);
  }

  // 2. Fetch Bills
  let billSql = `
    SELECT 
      'bill' AS type,
      bi.uid,
      bi.entry_datetime,
      bi.pieces,
      bi.rate_per_piece AS sales_rate,
      bi.line_amount,
      bm.uid AS bill_uid,
      bm.is_home_bill,
      cm.customer_name,
      cm.mobile_number
    FROM bill_items bi
    JOIN bill_master bm ON bi.bill_uid = bm.uid AND bm.delete_datetime IS NULL
    LEFT JOIN customer_master cm ON bm.customer_uid = cm.uid
    WHERE bi.stock_uid = ? AND bi.delete_datetime IS NULL
  `;
  const billParams = [stock_uid];
  if (fromDt) {
    billSql += ' AND bi.entry_datetime >= ?';
    billParams.push(fromDt);
  }
  if (toDt) {
    billSql += ' AND bi.entry_datetime <= ?';
    billParams.push(toDt);
  }

  const [inwards] = await pool.query(inwardSql, inwardParams);
  const [bills] = await pool.query(billSql, billParams);

  // Combine & sort chronologically descending (newest first)
  const combined = [
    ...inwards.map(i => ({ ...i, pieces: Number(i.pieces) })),
    ...bills.map(b => ({ ...b, pieces: Number(b.pieces) }))
  ].sort((a, b) => new Date(b.entry_datetime) - new Date(a.entry_datetime));

  return combined;
}

module.exports = {
  getStockCheckReport,
  getDesignMovementHistory
};
