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
    `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE design_number = ? AND ${ACTIVE_FILTER} LIMIT 1`,
    [design_number]
  );
  return rows[0] || null;
}

async function nextDesignNumber() {
  const [[{ maxNum }]] = await pool.query(`SELECT MAX(design_number) AS maxNum FROM ${TABLE}`);
  return (maxNum || 1000) + 1;
}

// Finds or creates the stock_master row for a given matched image filename
// (design number parsed from "<name>-<number>.<ext>"), or creates a fresh
// "new design" row (image_filename NULL, next available design number) when
// image_filename is not supplied.
async function findOrCreateForInward({ image_filename, size_uid }) {
  if (image_filename) {
    const match = image_filename.match(/-(\d+)(?:\.[a-zA-Z0-9]+)?$/);
    if (!match) throw Object.assign(new Error('Could not parse design number from filename'), { status: 400 });
    const design_number = parseInt(match[1], 10);
    const existing = await findByDesignNumber(design_number);
    if (existing) return existing;
    const uid = newUid();
    await pool.query(
      `INSERT INTO ${TABLE} (uid, design_number, image_filename, size_uid, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
      [uid, design_number, image_filename, size_uid]
    );
    return findByUid(uid);
  }
  const design_number = await nextDesignNumber();
  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, design_number, image_filename, size_uid, entry_datetime) VALUES (?, ?, NULL, ?, NOW())`,
    [uid, design_number, size_uid]
  );
  return findByUid(uid);
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

module.exports = { findByUid, findByDesignNumber, findOrCreateForInward, list };
