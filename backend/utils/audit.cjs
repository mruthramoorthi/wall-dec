// Shared helpers implementing the audit-column / edit-as-new-row pattern
// (see docs/01-SRS.md section 4). Every model uses these so the rule lives
// in exactly one place.
const { v4: uuidv4 } = require('uuid');

// SQL fragment for a query with NO table alias (single-table query).
const ACTIVE_FILTER = 'update_datetime IS NULL AND delete_datetime IS NULL';

// SQL fragment for a query that DOES use a table alias (any JOIN).
// IMPORTANT: `${alias}.${ACTIVE_FILTER}` is a bug — string concatenation only
// prefixes the alias onto update_datetime, leaving delete_datetime
// unqualified, which MySQL rejects as ambiguous the moment a second table in
// the join also has a delete_datetime column (every audited table does).
// Always call activeFilter('alias') instead when a query has more than one
// table in scope.
function activeFilter(alias) {
  return `${alias}.update_datetime IS NULL AND ${alias}.delete_datetime IS NULL`;
}

function newUid() {
  return uuidv4();
}

// Runs `editFn(conn)` inside a transaction: caller is responsible for
// (a) marking the old row's update_datetime, (b) inserting the new row,
// using the same connection. This wrapper just handles begin/commit/rollback
// so every model doesn't repeat that boilerplate.
async function withTransaction(pool, work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function markSuperseded(conn, table, uid) {
  await conn.query(
    `UPDATE ${table} SET update_datetime = NOW() WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
}

async function markDeleted(pool, table, uid) {
  const [result] = await pool.query(
    `UPDATE ${table} SET delete_datetime = NOW() WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return result.affectedRows > 0;
}

module.exports = { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted };
