const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'employee_master';

async function nextEmployeeCode() {
  const [[row]] = await pool.query(
    `SELECT employee_code FROM ${TABLE} WHERE employee_code LIKE 'EMP-%' ORDER BY id DESC LIMIT 1`
  );
  if (!row) return 'EMP-001';
  const num = parseInt(row.employee_code.replace('EMP-', ''), 10) || 0;
  return `EMP-${String(num + 1).padStart(3, '0')}`;
}

async function list({ pageSize, offset, search = '' }) {
  const whereClauses = [ACTIVE_FILTER];
  const params = [];
  if (search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push(`(employee_name LIKE ? OR mobile_number LIKE ? OR employee_code LIKE ? OR role_designation LIKE ?)`);
    params.push(term, term, term, term);
  }
  const where = whereClauses.join(' AND ');
  const [rows] = await pool.query(
    `SELECT uid, employee_code, employee_name, mobile_number, email, role_designation,
            address, pincode, state, city, area, entry_datetime
     FROM ${TABLE} WHERE ${where} ORDER BY entry_datetime DESC LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${TABLE} WHERE ${where}`, params);
  return { rows, total: count };
}

async function findByUid(uid) {
  const [rows] = await pool.query(
    `SELECT uid, employee_code, employee_name, mobile_number, email, role_designation,
            address, pincode, state, city, area, entry_datetime
     FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function create(data) {
  const uid = newUid();
  const employee_code = await nextEmployeeCode();
  await pool.query(
    `INSERT INTO ${TABLE}
     (uid, employee_code, employee_name, mobile_number, email, role_designation,
      address, pincode, state, city, area, entry_datetime)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    [
      uid, employee_code,
      data.employee_name.trim(),
      data.mobile_number.trim(),
      data.email ? data.email.trim() : null,
      data.role_designation ? data.role_designation.trim() : null,
      data.address ? data.address.trim() : null,
      data.pincode ? data.pincode.trim() : null,
      data.state ? data.state.trim() : null,
      data.city ? data.city.trim() : null,
      data.area ? data.area.trim() : null,
    ]
  );
  return findByUid(uid);
}

async function edit(uid, data) {
  await withTransaction(pool, async (conn) => {
    const [[existing]] = await conn.query(
      `SELECT employee_code FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
      [uid]
    );
    const employee_code = existing?.employee_code || await nextEmployeeCode();
    // soft-update: set update_datetime on old row
    await conn.query(`UPDATE ${TABLE} SET update_datetime = NOW() WHERE uid = ? AND update_datetime IS NULL AND delete_datetime IS NULL`, [uid]);
    await conn.query(
      `INSERT INTO ${TABLE}
       (uid, employee_code, employee_name, mobile_number, email, role_designation,
        address, pincode, state, city, area, entry_datetime)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        uid, employee_code,
        data.employee_name.trim(),
        data.mobile_number.trim(),
        data.email ? data.email.trim() : null,
        data.role_designation ? data.role_designation.trim() : null,
        data.address ? data.address.trim() : null,
        data.pincode ? data.pincode.trim() : null,
        data.state ? data.state.trim() : null,
        data.city ? data.city.trim() : null,
        data.area ? data.area.trim() : null,
      ]
    );
  });
  return findByUid(uid);
}

async function softDelete(uid) {
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, findByUid, create, edit, softDelete, nextEmployeeCode };
