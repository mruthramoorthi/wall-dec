const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid } = require('../utils/audit.cjs');

const TABLE = 'stock_master';

async function findByUid(uid) {
  const [rows] = await pool.query(
    `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function findByDesignNumber(design_number) {
  const [rows] = await pool.query(
    `SELECT 
       sm.uid, 
       sm.design_number, 
       sm.image_filename, 
       sm.size_uid,
       sz.width_ft,
       sz.height_ft,
       sz.thickness_mm,
       COALESCE(si_summary.total_inward_pcs, 0) AS total_inward_pcs,
       COALESCE(bi_summary.total_billed_pcs, 0) AS total_billed_pcs,
       COALESCE(pb_summary.total_prebooked_pcs, 0) AS total_prebooked_pcs,
       (COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0)) AS physical_stock_pcs,
       (COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0) - COALESCE(pb_summary.total_prebooked_pcs, 0)) AS available_pcs,
       COALESCE(si_summary.selling_price_per_piece, sm.selling_price_per_piece, 0) AS selling_price_per_piece
     FROM ${TABLE} sm
     LEFT JOIN size_master sz ON sm.size_uid = sz.uid AND sz.delete_datetime IS NULL
     LEFT JOIN (
       SELECT 
         stock_uid,
         SUM(pieces) AS total_inward_pcs,
         MAX(selling_price_per_piece) AS selling_price_per_piece
       FROM stock_inward
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) si_summary ON sm.uid = si_summary.stock_uid
     LEFT JOIN (
       SELECT 
         stock_uid,
         SUM(pieces) AS total_billed_pcs
       FROM bill_items
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) bi_summary ON sm.uid = bi_summary.stock_uid
     LEFT JOIN (
       SELECT 
         api.stock_uid,
         SUM(api.pieces) AS total_prebooked_pcs
       FROM advance_prebook_items api
       JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
       WHERE api.delete_datetime IS NULL AND api.update_datetime IS NULL
       GROUP BY api.stock_uid
     ) pb_summary ON sm.uid = pb_summary.stock_uid
     WHERE sm.design_number = ? AND sm.delete_datetime IS NULL
     LIMIT 1`,
    [design_number]
  );
  return rows[0] || null;
}

async function nextDesignNumber() {
  const [[{ maxNum }]] = await pool.query(`SELECT MAX(design_number) AS maxNum FROM ${TABLE}`);
  return (maxNum || 1000) + 1;
}

async function findByImageFilenameAndSize(image_filename, size_uid) {
  if (!image_filename || !size_uid) return null;
  const [rows] = await pool.query(
    `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE image_filename = ? AND size_uid = ? AND ${ACTIVE_FILTER} LIMIT 1`,
    [image_filename, size_uid]
  );
  return rows[0] || null;
}

async function findByDesignNumberAndSize(design_number, size_uid) {
  if (!design_number || !size_uid) return null;
  const [rows] = await pool.query(
    `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE design_number = ? AND size_uid = ? AND ${ACTIVE_FILTER} LIMIT 1`,
    [design_number, size_uid]
  );
  return rows[0] || null;
}

// Finds or creates the stock_master row for a given matched image filename and size.
// Per SRS / business rules: A design number is tied to (PHOTO + SIZE).
// If PHOTO matches AND SIZE matches -> reuse existing design_number.
// If PHOTO matches BUT SIZE VARIES -> create a NEW design_number.
async function findOrCreateForInward({ image_filename, size_uid }) {
  if (image_filename) {
    /* 1. Check if an existing stock item matches BOTH exact image_filename AND size_uid */
    const existingByImageAndSize = await findByImageFilenameAndSize(image_filename, size_uid);
    if (existingByImageAndSize) return existingByImageAndSize;

    /* 2. Check if image_filename contains a design_number suffix (e.g. -1004.jpg) AND size_uid matches */
    const match = image_filename.match(/-(\d+)(?:\.[a-zA-Z0-9]+)?$/);
    if (match) {
      const design_number = parseInt(match[1], 10);
      const existingByDesignAndSize = await findByDesignNumberAndSize(design_number, size_uid);
      if (existingByDesignAndSize) return existingByDesignAndSize;
    }

    /* 3. If photo matches BUT size varies, or it is a new photo -> create a NEW design number */
    const design_number = await nextDesignNumber();
    const uid = newUid();
    await pool.query(
      `INSERT INTO ${TABLE} (uid, design_number, image_filename, size_uid, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
      [uid, design_number, image_filename, size_uid]
    );
    return findByUid(uid);
  }

  /* 4. Fallback for stock inward entry with no image */
  const design_number = await nextDesignNumber();
  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, design_number, image_filename, size_uid, entry_datetime) VALUES (?, ?, NULL, ?, NOW())`,
    [uid, design_number, size_uid]
  );
  return findByUid(uid);
}

async function findOrCreateForHomeBill({ image_filename, design_number, size_uid }) {
  // 1. If design_number is provided, check if it already exists
  if (design_number) {
    const existing = await findByDesignNumber(design_number);
    if (existing) return existing;
  }

  // 2. If image_filename is provided, check if it already exists in stock_master
  if (image_filename) {
    const [existingRows] = await pool.query(
      `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE image_filename = ? AND ${ACTIVE_FILTER} LIMIT 1`,
      [image_filename]
    );
    if (existingRows.length > 0) {
      return findByDesignNumber(existingRows[0].design_number);
    }
  }

  // 3. Resolve a size_uid (default to first active size in size_master or create a default 8x4x1mm size if none)
  let resolvedSizeUid = size_uid;
  if (!resolvedSizeUid) {
    const [sizes] = await pool.query(`SELECT uid FROM size_master WHERE ${ACTIVE_FILTER} ORDER BY id ASC LIMIT 1`);
    if (sizes.length > 0) {
      resolvedSizeUid = sizes[0].uid;
    } else {
      const defaultSizeUid = newUid();
      await pool.query(
        `INSERT INTO size_master (uid, width_ft, height_ft, thickness_mm, entry_datetime) VALUES (?, 8.0, 4.0, 1.0, NOW())`,
        [defaultSizeUid]
      );
      resolvedSizeUid = defaultSizeUid;
    }
  }

  // 4. Determine design number
  const finalDesignNumber = design_number ? parseInt(design_number, 10) : await nextDesignNumber();
  const uid = newUid();

  await pool.query(
    `INSERT INTO ${TABLE} (uid, design_number, image_filename, size_uid, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
    [uid, finalDesignNumber, image_filename || null, resolvedSizeUid]
  );

  return findByDesignNumber(finalDesignNumber);
}

async function list({ pageSize, offset }) {
  const [rows] = await pool.query(
    `SELECT uid, design_number, image_filename, size_uid, entry_datetime FROM ${TABLE}
     WHERE ${ACTIVE_FILTER} ORDER BY entry_datetime DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${TABLE} WHERE ${ACTIVE_FILTER}`);
  return { rows, total: count };
}

module.exports = { findByUid, findByDesignNumber, findOrCreateForInward, findOrCreateForHomeBill, list };
