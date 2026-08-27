const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');
const { syncTransaction, deleteTransaction } = require('./transactionModel.cjs');
const accountingService = require('../services/accountingService.cjs');

const TABLE = 'customer_advance';
const ITEMS_TABLE = 'advance_prebook_items';

async function nextPrebookCode() {
  const [rows] = await pool.query(
    `SELECT prebook_code FROM ${TABLE} WHERE prebook_code IS NOT NULL ORDER BY id DESC LIMIT 1`
  );
  if (rows.length === 0 || !rows[0].prebook_code) return 'PB-1001';
  const lastCode = rows[0].prebook_code;
  const match = lastCode.match(/PB-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `PB-${nextNum}`;
  }
  return 'PB-1001';
}

async function list({ pageSize, offset, search = '', fromDate = null, toDate = null }) {
  let whereClauses = [`${activeFilter('ca')}`];
  let params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push(`(c.customer_name LIKE ? OR c.mobile_number LIKE ? OR ca.prebook_code LIKE ? OR ca.notes LIKE ? OR ca.payment_mode LIKE ?)`);
    params.push(term, term, term, term, term);
  }

  if (fromDate && fromDate.trim()) {
    whereClauses.push(`ca.entry_datetime >= ?`);
    const cleanFrom = fromDate.trim().includes('T') ? fromDate.trim().replace('T', ' ') : `${fromDate.trim().slice(0, 10)} 00:00:00`;
    params.push(cleanFrom);
  }

  if (toDate && toDate.trim()) {
    whereClauses.push(`ca.entry_datetime <= ?`);
    const cleanTo = toDate.trim().includes('T') ? toDate.trim().replace('T', ' ') : `${toDate.trim().slice(0, 10)} 23:59:59`;
    params.push(cleanTo);
  }

  const whereSql = whereClauses.join(' AND ');

  const [rows] = await pool.query(
    `SELECT 
       ca.uid, 
       ca.customer_uid, 
       c.customer_name, 
       c.mobile_number, 
       ca.amount, 
       ca.is_prebook,
       ca.prebook_code,
       ca.is_converted_to_bill,
       ca.bill_uid,
       ca.payment_mode, 
       ca.transaction_date,
       ca.ref_number,
       ca.bank_uid,
       bm.bank_name,
       bm.bank_code,
       ca.denominations,
       ca.tendered_amount,
       ca.change_returned,
       ca.notes, 
       ca.entry_datetime,
       COALESCE(item_stats.total_items, 0) AS total_items,
       COALESCE(item_stats.total_pieces, 0) AS total_pieces,
       COALESCE(item_stats.total_estimated_amount, 0) AS total_estimated_amount
     FROM ${TABLE} ca
     JOIN customer_master c ON c.uid = ca.customer_uid AND ${activeFilter('c')}
     LEFT JOIN bank_master bm ON bm.uid = ca.bank_uid AND ${activeFilter('bm')}
     LEFT JOIN (
       SELECT 
         advance_uid,
         COUNT(DISTINCT uid) AS total_items,
         SUM(pieces) AS total_pieces,
         SUM(line_amount) AS total_estimated_amount
       FROM ${ITEMS_TABLE}
       WHERE ${ACTIVE_FILTER}
       GROUP BY advance_uid
     ) item_stats ON ca.uid = item_stats.advance_uid
     WHERE ${whereSql}
     ORDER BY ca.entry_datetime DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM ${TABLE} ca
     JOIN customer_master c ON c.uid = ca.customer_uid AND ${activeFilter('c')}
     WHERE ${whereSql}`,
    params
  );

  const [[{ grandTotal }]] = await pool.query(
    `SELECT COALESCE(SUM(ca.amount), 0) AS grandTotal
     FROM ${TABLE} ca
     JOIN customer_master c ON c.uid = ca.customer_uid AND ${activeFilter('c')}
     WHERE ${whereSql}`,
    params
  );

  return { rows, total: count, grandTotal: Number(grandTotal) };
}

async function findByUid(uid) {
  const [[row]] = await pool.query(
    `SELECT 
       ca.uid, 
       ca.customer_uid, 
       c.customer_name, 
       c.mobile_number, 
       ca.amount, 
       ca.is_prebook,
       ca.prebook_code,
       ca.is_converted_to_bill,
       ca.bill_uid,
       ca.payment_mode, 
       ca.transaction_date,
       ca.ref_number,
       ca.bank_uid,
       bm.bank_name,
       bm.bank_code,
       ca.denominations,
       ca.tendered_amount,
       ca.change_returned,
       ca.notes, 
       ca.entry_datetime
     FROM ${TABLE} ca
     JOIN customer_master c ON c.uid = ca.customer_uid AND ${activeFilter('c')}
     LEFT JOIN bank_master bm ON bm.uid = ca.bank_uid AND ${activeFilter('bm')}
     WHERE ca.uid = ? AND ${activeFilter('ca')}`,
    [uid]
  );
  if (!row) return null;

  const [items] = await pool.query(
    `SELECT 
       api.uid,
       api.stock_uid,
       sm.design_number,
       sm.image_filename,
       api.pieces,
       api.rate_per_piece,
       api.line_amount,
       sz.width_ft,
       sz.height_ft,
       sz.thickness_mm
     FROM ${ITEMS_TABLE} api
     JOIN stock_master sm ON sm.uid = api.stock_uid AND sm.delete_datetime IS NULL
     LEFT JOIN size_master sz ON sm.size_uid = sz.uid AND sz.delete_datetime IS NULL
     WHERE api.advance_uid = ? AND ${activeFilter('api')}`,
    [uid]
  );

  return { ...row, items };
}

async function findByPrebookCode(code) {
  if (!code) return null;
  const cleanCode = code.trim().toUpperCase();
  const formattedCode = cleanCode.startsWith('PB-') ? cleanCode : `PB-${cleanCode}`;

  const [[row]] = await pool.query(
    `SELECT 
       ca.uid, 
       ca.customer_uid, 
       c.customer_name, 
       c.mobile_number, 
       ca.amount, 
       ca.is_prebook,
       ca.prebook_code,
       ca.is_converted_to_bill,
       ca.bill_uid,
       ca.payment_mode, 
       ca.transaction_date,
       ca.ref_number,
       ca.tendered_amount,
       ca.change_returned,
       ca.notes, 
       ca.entry_datetime
     FROM ${TABLE} ca
     JOIN customer_master c ON c.uid = ca.customer_uid AND ${activeFilter('c')}
     WHERE (UPPER(ca.prebook_code) = ? OR UPPER(ca.prebook_code) = ?) AND ${activeFilter('ca')}`,
    [cleanCode, formattedCode]
  );
  if (!row) return null;

  const [items] = await pool.query(
    `SELECT 
       api.uid,
       api.stock_uid,
       sm.design_number,
       sm.image_filename,
       api.pieces,
       api.rate_per_piece,
       api.line_amount,
       sz.width_ft,
       sz.height_ft,
       sz.thickness_mm
     FROM ${ITEMS_TABLE} api
     JOIN stock_master sm ON sm.uid = api.stock_uid AND sm.delete_datetime IS NULL
     LEFT JOIN size_master sz ON sm.size_uid = sz.uid AND sz.delete_datetime IS NULL
     WHERE api.advance_uid = ? AND ${activeFilter('api')}`,
    [row.uid]
  );

  return { ...row, items };
}

async function create(data) {
  const uid = newUid();
  const amount = Number(data.amount);
  const is_prebook = data.is_prebook ? 1 : 0;
  const payment_mode = (data.payment_mode || 'cash').toLowerCase();
  const notes = data.notes ? data.notes.trim() : null;
  const items = Array.isArray(data.items) ? data.items : [];
  const prebook_code = is_prebook ? await nextPrebookCode() : null;

  // If prebooking, validate each item's stock availability
  if (is_prebook) {
    if (items.length === 0) {
      throw Object.assign(new Error('Pre-booking requires at least one stock item to reserve.'), { status: 400 });
    }
    for (const item of items) {
      const [[stockInfo]] = await pool.query(
        `SELECT 
           sm.design_number,
           (
             COALESCE((SELECT SUM(si.pieces) FROM stock_inward si WHERE si.stock_uid = sm.uid AND si.delete_datetime IS NULL), 0) -
             COALESCE((SELECT SUM(bi.pieces) FROM bill_items bi WHERE bi.stock_uid = sm.uid AND bi.delete_datetime IS NULL), 0) -
             COALESCE((
               SELECT SUM(api.pieces) 
               FROM advance_prebook_items api 
               JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
               WHERE api.stock_uid = sm.uid AND api.delete_datetime IS NULL AND api.update_datetime IS NULL
             ), 0)
           ) AS available_pcs
         FROM stock_master sm
         WHERE sm.uid = ? AND sm.delete_datetime IS NULL`,
        [item.stock_uid]
      );
      const available = Number(stockInfo?.available_pcs || 0);
      if (available <= 0) {
        throw Object.assign(new Error(`Design #${stockInfo?.design_number || 'Unknown'} is Out of Stock (0 pcs available). Cannot pre-book.`), { status: 422 });
      }
      if (Number(item.pieces) > available) {
        throw Object.assign(new Error(`Cannot pre-book ${item.pieces} pcs of Design #${stockInfo?.design_number}: Only ${available} pcs currently available.`), { status: 422 });
      }
    }
  }

  const transaction_date = data.transaction_date || null;
  const ref_number = data.ref_number ? data.ref_number.trim() : null;
  const bank_uid = data.bank_uid || null;
  const denomJson = data.denominations ? (typeof data.denominations === 'string' ? data.denominations : JSON.stringify(data.denominations)) : null;
  const tendered_amount = data.tendered_amount !== undefined && data.tendered_amount !== '' && data.tendered_amount !== null ? Number(data.tendered_amount) : null;
  const change_returned = data.change_returned !== undefined && data.change_returned !== '' && data.change_returned !== null ? Number(data.change_returned) : null;

  await withTransaction(pool, async (conn) => {
    const [advResult] = await conn.query(
      `INSERT INTO ${TABLE} (uid, customer_uid, amount, is_prebook, prebook_code, is_converted_to_bill, payment_mode, transaction_date, ref_number, bank_uid, denominations, tendered_amount, change_returned, notes, entry_datetime)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uid, data.customer_uid, amount, is_prebook, prebook_code, payment_mode, transaction_date, ref_number, bank_uid, denomJson, tendered_amount, change_returned, notes]
    );

    const advId = advResult.insertId;
    const formattedRef = prebook_code || `ADV-${String(advId).padStart(4, '0')}`;

    const [[cust]] = await conn.query(`SELECT customer_name FROM customer_master WHERE uid = ?`, [data.customer_uid]);
    const customerName = cust?.customer_name || 'Customer';

    if (amount > 0) {
      await syncTransaction(conn, {
        uid,
        transaction_type: 'ADVANCE',
        source_table: TABLE,
        source_uid: uid,
        reference_number: formattedRef,
        party_name: customerName,
        party_uid: data.customer_uid,
        amount: Math.abs(amount),
        payment_mode,
        bank_uid,
        ref_number,
        transaction_date: transaction_date || new Date().toISOString().slice(0, 10),
        denominations: denomJson,
        tendered_amount,
        change_returned,
        narration: notes || (is_prebook ? 'Customer Pre-booking Advance' : 'Customer Advance Payment')
      });

      // Post to Double-Entry Accounting General Ledger
      await accountingService.postCustomerAdvanceEntry(conn, {
        advanceUid: uid,
        advanceId: advId,
        customerUid: data.customer_uid,
        customerName,
        amount,
        paymentMode: payment_mode,
        bankUid: bank_uid,
        transactionDate: transaction_date || new Date().toISOString().slice(0, 10),
        notes: notes || (is_prebook ? 'Customer Pre-booking Advance' : 'Customer Advance Payment'),
        createdBy: data.created_by || null
      });
    }

    if (is_prebook && items.length > 0) {
      for (const item of items) {
        const line_amount = Number(item.pieces) * Number(item.rate_per_piece);
        await conn.query(
          `INSERT INTO ${ITEMS_TABLE} (uid, advance_uid, stock_uid, pieces, rate_per_piece, line_amount, entry_datetime)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [newUid(), uid, item.stock_uid, Number(item.pieces), Number(item.rate_per_piece), line_amount]
        );
      }
    }
  });

  return findByUid(uid);
}

async function edit(uid, data) {
  const amount = Number(data.amount);
  const is_prebook = data.is_prebook ? 1 : 0;
  const payment_mode = (data.payment_mode || 'cash').toLowerCase();
  const notes = data.notes ? data.notes.trim() : null;
  const items = Array.isArray(data.items) ? data.items : [];

  const existing = await findByUid(uid);
  let prebook_code = existing?.prebook_code || null;
  if (is_prebook && !prebook_code) {
    prebook_code = await nextPrebookCode();
  }

  const transaction_date = data.transaction_date ?? existing.transaction_date ?? null;
  const ref_number = data.ref_number !== undefined ? (data.ref_number ? data.ref_number.trim() : null) : (existing.ref_number || null);
  const bank_uid = data.bank_uid !== undefined ? (data.bank_uid || null) : (existing.bank_uid || null);
  const denomJson = data.denominations !== undefined ? (data.denominations ? (typeof data.denominations === 'string' ? data.denominations : JSON.stringify(data.denominations)) : null) : (existing.denominations ? (typeof existing.denominations === 'string' ? existing.denominations : JSON.stringify(existing.denominations)) : null);
  const tendered_amount = data.tendered_amount !== undefined && data.tendered_amount !== '' && data.tendered_amount !== null ? Number(data.tendered_amount) : (existing.tendered_amount ?? null);
  const change_returned = data.change_returned !== undefined && data.change_returned !== '' && data.change_returned !== null ? Number(data.change_returned) : (existing.change_returned ?? null);

  const existingItems = await pool.query(`SELECT uid FROM ${ITEMS_TABLE} WHERE advance_uid = ? AND ${ACTIVE_FILTER}`, [uid]);

  // If prebooking, validate stock availability (excluding current advance reservation)
  if (is_prebook) {
    if (items.length === 0) {
      throw Object.assign(new Error('Pre-booking requires at least one stock item to reserve.'), { status: 400 });
    }
    for (const item of items) {
      const [[stockInfo]] = await pool.query(
        `SELECT 
           sm.design_number,
           (
             COALESCE((SELECT SUM(si.pieces) FROM stock_inward si WHERE si.stock_uid = sm.uid AND si.delete_datetime IS NULL), 0) -
             COALESCE((SELECT SUM(bi.pieces) FROM bill_items bi WHERE bi.stock_uid = sm.uid AND bi.delete_datetime IS NULL), 0) -
             COALESCE((
               SELECT SUM(api.pieces) 
               FROM advance_prebook_items api 
               JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
               WHERE api.stock_uid = sm.uid AND api.advance_uid != ? AND api.delete_datetime IS NULL AND api.update_datetime IS NULL
             ), 0)
           ) AS available_pcs
         FROM stock_master sm
         WHERE sm.uid = ? AND sm.delete_datetime IS NULL`,
        [uid, item.stock_uid]
      );
      const [[prevItem]] = await pool.query(
        `SELECT pieces FROM ${ITEMS_TABLE} WHERE advance_uid = ? AND stock_uid = ? AND ${ACTIVE_FILTER}`,
        [uid, item.stock_uid]
      );
      const previouslyReserved = prevItem ? Number(prevItem.pieces) : 0;
      const effectiveAvailable = Number(stockInfo?.available_pcs || 0) + previouslyReserved;
      if (Number(item.pieces) > effectiveAvailable) {
        throw Object.assign(new Error(`Cannot pre-book ${item.pieces} pcs of Design #${stockInfo?.design_number}: Only ${effectiveAvailable} pcs available.`), { status: 422 });
      }
    }
  }

  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    for (const row of existingItems[0]) {
      await markSuperseded(conn, ITEMS_TABLE, row.uid);
    }

    await conn.query(
      `INSERT INTO ${TABLE} (uid, customer_uid, amount, is_prebook, prebook_code, is_converted_to_bill, bill_uid, payment_mode, transaction_date, ref_number, bank_uid, denominations, tendered_amount, change_returned, notes, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uid, data.customer_uid, amount, is_prebook, prebook_code, existing?.is_converted_to_bill || 0, existing?.bill_uid || null, payment_mode, transaction_date, ref_number, bank_uid, denomJson, tendered_amount, change_returned, notes]
    );

    const [[cust]] = await conn.query(`SELECT customer_name FROM customer_master WHERE uid = ?`, [data.customer_uid]);
    const customerName = cust?.customer_name || 'Customer';
    const formattedRef = prebook_code || `ADV-${String(existing?.id || '').padStart(4, '0')}`;

    if (amount > 0) {
      await syncTransaction(conn, {
        uid,
        transaction_type: 'ADVANCE',
        source_table: TABLE,
        source_uid: uid,
        reference_number: formattedRef,
        party_name: customerName,
        party_uid: data.customer_uid,
        amount: Math.abs(amount),
        payment_mode,
        bank_uid,
        ref_number,
        transaction_date: transaction_date || new Date().toISOString().slice(0, 10),
        denominations: denomJson,
        tendered_amount,
        change_returned,
        narration: notes || (is_prebook ? 'Customer Pre-booking Advance' : 'Customer Advance Payment')
      });

      // Post to Double-Entry Accounting General Ledger
      await accountingService.postCustomerAdvanceEntry(conn, {
        advanceUid: uid,
        advanceId: existing?.id,
        customerUid: data.customer_uid,
        customerName,
        amount,
        paymentMode: payment_mode,
        bankUid: bank_uid,
        transactionDate: transaction_date || new Date().toISOString().slice(0, 10),
        notes: notes || (is_prebook ? 'Customer Pre-booking Advance' : 'Customer Advance Payment'),
        createdBy: data.created_by || null
      });
    } else {
      await deleteTransaction(conn, TABLE, uid);
      await accountingService.voidJournalEntry(conn, TABLE, uid);
    }

    if (is_prebook && items.length > 0) {
      for (const item of items) {
        const line_amount = Number(item.pieces) * Number(item.rate_per_piece);
        await conn.query(
          `INSERT INTO ${ITEMS_TABLE} (uid, advance_uid, stock_uid, pieces, rate_per_piece, line_amount, entry_datetime)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [newUid(), uid, item.stock_uid, Number(item.pieces), Number(item.rate_per_piece), line_amount]
        );
      }
    }
  });

  return findByUid(uid);
}

async function softDelete(uid) {
  const [[row]] = await pool.query(
    `SELECT is_prebook, prebook_code, is_converted_to_bill FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  if (row && row.is_converted_to_bill) {
    throw Object.assign(
      new Error(`Cannot delete pre-booking "${row.prebook_code || uid}": It has already been converted to a sales bill. Delete the sales bill first if you wish to remove this pre-booking.`),
      { status: 422 }
    );
  }

  const existingItems = await pool.query(`SELECT uid FROM ${ITEMS_TABLE} WHERE advance_uid = ? AND ${ACTIVE_FILTER}`, [uid]);
  return withTransaction(pool, async (conn) => {
    for (const row of existingItems[0]) {
      await markDeleted(conn, ITEMS_TABLE, row.uid);
    }
    await deleteTransaction(conn, TABLE, uid);
    await accountingService.voidJournalEntry(conn, TABLE, uid);
    return markDeleted(conn, TABLE, uid);
  });
}

module.exports = { list, findByUid, findByPrebookCode, create, edit, softDelete };
