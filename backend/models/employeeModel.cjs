const bcrypt = require('bcryptjs');
const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'employee_master';
const USER_TABLE = 'user_master';

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
    whereClauses.push(`(employee_name LIKE ? OR mobile_number LIKE ? OR employee_code LIKE ? OR role_designation LIKE ? OR username LIKE ?)`);
    params.push(term, term, term, term, term);
  }
  const where = whereClauses.join(' AND ');
  const [rows] = await pool.query(
    `SELECT uid, employee_code, employee_name, mobile_number, email, username, role_designation,
            address, pincode, state, city, area, entry_datetime
     FROM ${TABLE} WHERE ${where} ORDER BY entry_datetime DESC LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${TABLE} WHERE ${where}`, params);
  return { rows, total: count };
}

async function findByUid(uid) {
  const [rows] = await pool.query(
    `SELECT uid, employee_code, employee_name, mobile_number, email, username, role_designation,
            address, pincode, state, city, area, entry_datetime
     FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function checkUsernameAvailable(username, excludeUid = null) {
  if (!username || !username.trim()) return true;
  const clean = username.trim().toLowerCase();

  // Check in user_master
  let userQuery = `SELECT uid FROM ${USER_TABLE} WHERE LOWER(username) = ? AND delete_datetime IS NULL`;
  const userParams = [clean];
  if (excludeUid) {
    userQuery += ` AND uid != ?`;
    userParams.push(excludeUid);
  }
  const [[existingUser]] = await pool.query(userQuery, userParams);
  if (existingUser) return false;

  // Check in employee_master
  let empQuery = `SELECT uid FROM ${TABLE} WHERE LOWER(username) = ? AND delete_datetime IS NULL`;
  const empParams = [clean];
  if (excludeUid) {
    empQuery += ` AND uid != ?`;
    empParams.push(excludeUid);
  }
  const [[existingEmp]] = await pool.query(empQuery, empParams);
  if (existingEmp) return false;

  return true;
}

async function create(data) {
  const uid = newUid();
  const employee_code = await nextEmployeeCode();
  const cleanName = data.employee_name.trim();
  const cleanMobile = data.mobile_number.trim();
  const cleanEmail = data.email ? data.email.trim() : null;
  const cleanRole = data.role_designation ? data.role_designation.trim() : 'Staff';
  const cleanUsername = data.username ? data.username.trim().toLowerCase() : null;

  let password_hash = null;
  if (data.password && data.password.trim()) {
    password_hash = await bcrypt.hash(data.password.trim(), 10);
  }

  // Validate username uniqueness if provided
  if (cleanUsername) {
    const isAvailable = await checkUsernameAvailable(cleanUsername);
    if (!isAvailable) {
      throw Object.assign(new Error(`Username "${cleanUsername}" is already taken. Please choose another.`), { status: 400 });
    }
  }

  await withTransaction(pool, async (conn) => {
    // 1. Insert into employee_master
    await conn.query(
      `INSERT INTO ${TABLE}
       (uid, employee_code, employee_name, mobile_number, email, username, password_hash, role_designation,
        address, pincode, state, city, area, entry_datetime)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        uid, employee_code,
        cleanName,
        cleanMobile,
        cleanEmail,
        cleanUsername,
        password_hash,
        cleanRole,
        data.address ? data.address.trim() : null,
        data.pincode ? data.pincode.trim() : null,
        data.state ? data.state.trim() : null,
        data.city ? data.city.trim() : null,
        data.area ? data.area.trim() : null,
      ]
    );

    // 2. If username & password provided, synchronize into user_master for login
    if (cleanUsername && password_hash) {
      await conn.query(
        `INSERT INTO ${USER_TABLE}
         (uid, first_name, last_name, mobile_number, email, username, password_hash, role_position, is_email_verified, entry_datetime)
         VALUES (?, ?, '', ?, ?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           first_name = VALUES(first_name),
           mobile_number = VALUES(mobile_number),
           email = VALUES(email),
           password_hash = VALUES(password_hash),
           role_position = VALUES(role_position),
           is_email_verified = 1`,
        [
          uid,
          cleanName,
          cleanMobile,
          cleanEmail || `${cleanUsername}@local.erp`,
          cleanUsername,
          password_hash,
          cleanRole
        ]
      );
    }
  });

  return findByUid(uid);
}

async function edit(uid, data) {
  const cleanName = data.employee_name.trim();
  const cleanMobile = data.mobile_number.trim();
  const cleanEmail = data.email ? data.email.trim() : null;
  const cleanRole = data.role_designation ? data.role_designation.trim() : 'Staff';
  const cleanUsername = data.username ? data.username.trim().toLowerCase() : null;

  let password_hash = undefined;
  if (data.password && data.password.trim()) {
    password_hash = await bcrypt.hash(data.password.trim(), 10);
  }

  // Validate username uniqueness if changed
  if (cleanUsername) {
    const isAvailable = await checkUsernameAvailable(cleanUsername, uid);
    if (!isAvailable) {
      throw Object.assign(new Error(`Username "${cleanUsername}" is already taken. Please choose another.`), { status: 400 });
    }
  }

  await withTransaction(pool, async (conn) => {
    const [[existing]] = await conn.query(
      `SELECT employee_code, username, password_hash FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
      [uid]
    );
    const employee_code = existing?.employee_code || await nextEmployeeCode();
    const finalPasswordHash = password_hash !== undefined ? password_hash : (existing?.password_hash || null);
    const finalUsername = cleanUsername !== null ? cleanUsername : (existing?.username || null);

    // soft-update: set update_datetime on old row
    await conn.query(`UPDATE ${TABLE} SET update_datetime = NOW() WHERE uid = ? AND update_datetime IS NULL AND delete_datetime IS NULL`, [uid]);
    await conn.query(
      `INSERT INTO ${TABLE}
       (uid, employee_code, employee_name, mobile_number, email, username, password_hash, role_designation,
        address, pincode, state, city, area, entry_datetime)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        uid, employee_code,
        cleanName,
        cleanMobile,
        cleanEmail,
        finalUsername,
        finalPasswordHash,
        cleanRole,
        data.address ? data.address.trim() : null,
        data.pincode ? data.pincode.trim() : null,
        data.state ? data.state.trim() : null,
        data.city ? data.city.trim() : null,
        data.area ? data.area.trim() : null,
      ]
    );

    // Sync into user_master
    if (finalUsername) {
      const [[existingUser]] = await conn.query(`SELECT uid FROM ${USER_TABLE} WHERE uid = ?`, [uid]);
      if (existingUser) {
        let updateSql = `UPDATE ${USER_TABLE} SET first_name = ?, mobile_number = ?, email = ?, username = ?, role_position = ?`;
        const updateParams = [cleanName, cleanMobile, cleanEmail || `${finalUsername}@local.erp`, finalUsername, cleanRole];
        if (password_hash) {
          updateSql += `, password_hash = ?`;
          updateParams.push(password_hash);
        }
        updateSql += ` WHERE uid = ?`;
        updateParams.push(uid);
        await conn.query(updateSql, updateParams);
      } else if (finalPasswordHash) {
        await conn.query(
          `INSERT INTO ${USER_TABLE}
           (uid, first_name, last_name, mobile_number, email, username, password_hash, role_position, is_email_verified, entry_datetime)
           VALUES (?, ?, '', ?, ?, ?, ?, ?, 1, NOW())`,
          [
            uid,
            cleanName,
            cleanMobile,
            cleanEmail || `${finalUsername}@local.erp`,
            finalUsername,
            finalPasswordHash,
            cleanRole
          ]
        );
      }
    }
  });

  return findByUid(uid);
}

async function softDelete(uid) {
  await withTransaction(pool, async (conn) => {
    await markDeleted(conn, TABLE, uid);
    await markDeleted(conn, USER_TABLE, uid);
  });
  return { success: true };
}

module.exports = { list, findByUid, create, edit, softDelete, nextEmployeeCode, checkUsernameAvailable };
