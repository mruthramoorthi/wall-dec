const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const BILL = 'bill_master';
const ITEMS = 'bill_items';
const PAYMENTS = 'bill_payments';

async function list({ pageSize, offset }) {
  const [rows] = await pool.query(
    `SELECT b.uid, b.customer_uid, c.customer_name, c.mobile_number, b.total_amount, b.discount, b.net_amount, b.entry_datetime
     FROM ${BILL} b JOIN customer_master c ON c.uid = b.customer_uid
     WHERE b.${ACTIVE_FILTER} ORDER BY b.entry_datetime DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${BILL} WHERE ${ACTIVE_FILTER}`);
  return { rows, total: count };
}

async function findByUid(uid) {
  const [[bill]] = await pool.query(
    `SELECT b.uid, b.customer_uid, c.customer_name, c.mobile_number, b.total_amount, b.discount, b.net_amount, b.entry_datetime
     FROM ${BILL} b JOIN customer_master c ON c.uid = b.customer_uid
     WHERE b.uid = ? AND b.${ACTIVE_FILTER}`,
    [uid]
  );
  if (!bill) return null;
  const [items] = await pool.query(
    `SELECT bi.uid, bi.stock_uid, sm.design_number, bi.pieces, bi.rate_per_piece, bi.line_amount
     FROM ${ITEMS} bi JOIN stock_master sm ON sm.uid = bi.stock_uid
     WHERE bi.bill_uid = ? AND bi.${ACTIVE_FILTER}`,
    [uid]
  );
  const [payments] = await pool.query(
    `SELECT uid, payment_mode, amount FROM ${PAYMENTS} WHERE bill_uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return { ...bill, items, payments };
}

// data: { customer_uid, items: [{stock_uid, pieces, rate_per_piece}], discount, payments: [{payment_mode, amount}] }
async function create(data) {
  const total_amount = data.items.reduce((sum, i) => sum + Number(i.pieces) * Number(i.rate_per_piece), 0);
  const discount = Number(data.discount || 0);
  const net_amount = Math.round((total_amount - discount) * 100) / 100;
  const paymentsSum = Math.round(data.payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;

  if (paymentsSum !== net_amount) {
    throw Object.assign(new Error(`Payments (${paymentsSum}) must equal net amount (${net_amount})`), { status: 422 });
  }

  const billUid = newUid();
  await withTransaction(pool, async (conn) => {
    await conn.query(
      `INSERT INTO ${BILL} (uid, customer_uid, total_amount, discount, net_amount, entry_datetime)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [billUid, data.customer_uid, total_amount, discount, net_amount]
    );
    for (const item of data.items) {
      const line_amount = Number(item.pieces) * Number(item.rate_per_piece);
      await conn.query(
        `INSERT INTO ${ITEMS} (uid, bill_uid, stock_uid, pieces, rate_per_piece, line_amount, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [newUid(), billUid, item.stock_uid, item.pieces, item.rate_per_piece, line_amount]
      );
    }
    for (const payment of data.payments) {
      await conn.query(
        `INSERT INTO ${PAYMENTS} (uid, bill_uid, payment_mode, amount, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
        [newUid(), billUid, payment.payment_mode, payment.amount]
      );
    }
  });
  return findByUid(billUid);
}

async function edit(uid, data) {
  const existingItems = await pool.query(`SELECT uid FROM ${ITEMS} WHERE bill_uid = ? AND ${ACTIVE_FILTER}`, [uid]);
  const existingPayments = await pool.query(`SELECT uid FROM ${PAYMENTS} WHERE bill_uid = ? AND ${ACTIVE_FILTER}`, [uid]);

  const total_amount = data.items.reduce((sum, i) => sum + Number(i.pieces) * Number(i.rate_per_piece), 0);
  const discount = Number(data.discount || 0);
  const net_amount = Math.round((total_amount - discount) * 100) / 100;
  const paymentsSum = Math.round(data.payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  if (paymentsSum !== net_amount) {
    throw Object.assign(new Error(`Payments (${paymentsSum}) must equal net amount (${net_amount})`), { status: 422 });
  }

  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, BILL, uid);
    for (const row of existingItems[0]) await markSuperseded(conn, ITEMS, row.uid);
    for (const row of existingPayments[0]) await markSuperseded(conn, PAYMENTS, row.uid);

    await conn.query(
      `INSERT INTO ${BILL} (uid, customer_uid, total_amount, discount, net_amount, entry_datetime)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [uid, data.customer_uid, total_amount, discount, net_amount]
    );
    for (const item of data.items) {
      const line_amount = Number(item.pieces) * Number(item.rate_per_piece);
      await conn.query(
        `INSERT INTO ${ITEMS} (uid, bill_uid, stock_uid, pieces, rate_per_piece, line_amount, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [newUid(), uid, item.stock_uid, item.pieces, item.rate_per_piece, line_amount]
      );
    }
    for (const payment of data.payments) {
      await conn.query(
        `INSERT INTO ${PAYMENTS} (uid, bill_uid, payment_mode, amount, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
        [newUid(), uid, payment.payment_mode, payment.amount]
      );
    }
  });
  return findByUid(uid);
}

async function softDelete(uid) {
  return markDeleted(pool, BILL, uid);
}

module.exports = { list, findByUid, create, edit, softDelete };
