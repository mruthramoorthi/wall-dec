const pool = require('../config/db.cjs');
const { newUid, ACTIVE_FILTER } = require('../utils/audit.cjs');

// Generate unique human-readable order number (e.g., ORD-20260825-9831)
function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${rand}`;
}

// 1. Create New Order (Customer) with Atomic Concurrency & Stock Locking
async function createOrder({ userUid, shipping, items, paymentMethod = 'COD' }) {
  if (!items || !items.length) {
    throw Object.assign(new Error('Cart is empty. Cannot create order.'), { status: 400 });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. ATOMIC INVENTORY CONCURRENCY CHECK
    // Lock row and verify available stock for every item before creating the order
    for (const it of items) {
      const stockUid = it.stock_uid;
      const requestedQty = Math.max(1, Number(it.quantity || 1));

      // Lock row and compute current available stock inside this transaction
      const [[stockInfo]] = await conn.query(
        `SELECT 
           sm.uid, 
           sm.design_number,
           (
             COALESCE((SELECT SUM(si.pieces) FROM stock_inward si WHERE si.stock_uid = sm.uid AND si.delete_datetime IS NULL), 0) -
             COALESCE((SELECT SUM(bi.pieces) FROM bill_items bi WHERE bi.stock_uid = sm.uid AND bi.delete_datetime IS NULL), 0) -
             COALESCE((
               SELECT SUM(api.pieces) 
               FROM advance_prebook_items api 
               JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
               WHERE api.stock_uid = sm.uid AND api.delete_datetime IS NULL AND api.update_datetime IS NULL
             ), 0) -
             COALESCE((
               SELECT SUM(oi.quantity) 
               FROM order_items oi 
               JOIN orders_master om ON om.uid = oi.order_uid AND om.status IN ('Pending', 'Placed', 'Processing', 'Confirmed', 'Shipped') AND om.delete_datetime IS NULL
               WHERE oi.stock_uid = sm.uid
             ), 0)
           ) AS available_pcs
         FROM stock_master sm
         WHERE sm.uid = ? AND sm.delete_datetime IS NULL
         FOR UPDATE`,
        [stockUid]
      );

      if (!stockInfo) {
        throw Object.assign(new Error(`Panel item not found or has been discontinued.`), { status: 404 });
      }

      const freeAvailable = Number(stockInfo.available_pcs || 0);
      if (freeAvailable < requestedQty) {
        if (freeAvailable <= 0) {
          throw Object.assign(
            new Error(`Design #${stockInfo.design_number} was just sold out or reserved by another buyer. Please adjust your cart.`),
            { status: 409 }
          );
        } else {
          throw Object.assign(
            new Error(`Design #${stockInfo.design_number} only has ${freeAvailable} sheet(s) remaining in warehouse stock. Cannot order ${requestedQty} sheets.`),
            { status: 409 }
          );
        }
      }
    }

    const orderUid = newUid();
    const orderNumber = generateOrderNumber();

    let totalAmount = 0;
    for (const it of items) {
      totalAmount += Number(it.unit_price) * Number(it.quantity || 1);
    }
    const netAmount = totalAmount;

    // Insert Order Master
    await conn.query(
      `INSERT INTO orders_master (
        uid, order_number, customer_user_uid,
        shipping_name, shipping_phone, shipping_email,
        shipping_address, shipping_city, shipping_state, shipping_pincode,
        total_amount, net_amount, payment_method, payment_status, status, entry_datetime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Pending', NOW())`,
      [
        orderUid, orderNumber, userUid,
        shipping.name, shipping.phone, shipping.email || null,
        shipping.address, shipping.city, shipping.state, shipping.pincode,
        totalAmount, netAmount, paymentMethod
      ]
    );

    // Insert Order Items
    for (const item of items) {
      const itemUid = newUid();
      const lineTotal = Number(item.unit_price) * Number(item.quantity || 1);
      await conn.query(
        `INSERT INTO order_items (
          uid, order_uid, stock_uid, design_number, image_filename, quantity, unit_price, total_price, entry_datetime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          itemUid, orderUid, item.stock_uid,
          item.design_number, item.image_filename || null,
          item.quantity || 1, item.unit_price, lineTotal
        ]
      );
    }

    await conn.commit();
    return { orderUid, orderNumber, totalAmount, netAmount, status: 'Pending' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// 2. Get Customer Order History & Tracking
async function getCustomerOrders(userUid) {
  const [orders] = await pool.query(
    `SELECT om.*, 
       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_uid = om.uid) AS total_items
     FROM orders_master om
     WHERE om.customer_user_uid = ? AND om.delete_datetime IS NULL
     ORDER BY om.entry_datetime DESC`,
    [userUid]
  );

  for (const o of orders) {
    const [items] = await pool.query(
      `SELECT oi.*, 
         (SELECT pf.rating FROM product_feedback pf WHERE pf.order_uid = oi.order_uid AND pf.stock_uid = oi.stock_uid LIMIT 1) AS user_rating,
         (SELECT pf.comment FROM product_feedback pf WHERE pf.order_uid = oi.order_uid AND pf.stock_uid = oi.stock_uid LIMIT 1) AS user_feedback
       FROM order_items oi
       WHERE oi.order_uid = ?`,
      [o.uid]
    );
    o.items = items;
  }

  return orders;
}

// 3. Get Single Order Details by UID
async function getOrderDetails(orderUid) {
  const [[order]] = await pool.query(
    `SELECT * FROM orders_master WHERE uid = ? AND delete_datetime IS NULL`,
    [orderUid]
  );
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });

  const [items] = await pool.query(
    `SELECT * FROM order_items WHERE order_uid = ?`,
    [orderUid]
  );
  order.items = items;
  return order;
}

// 4. Admin: List All Orders with Status Filter & Search
async function listAdminOrders({ status = 'ALL', search = '', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  let where = [`om.delete_datetime IS NULL`];
  let params = [];

  if (status && status !== 'ALL') {
    if (status === 'Closed' || status === 'Delivered') {
      where.push(`om.status IN ('Closed', 'Delivered')`);
    } else if (status === 'Pending' || status === 'Placed') {
      where.push(`om.status IN ('Pending', 'Placed')`);
    } else {
      where.push(`om.status = ?`);
      params.push(status);
    }
  }

  if (search && search.trim()) {
    where.push(`(om.order_number LIKE ? OR om.shipping_name LIKE ? OR om.shipping_phone LIKE ? OR om.shipment_number LIKE ?)`);
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q);
  }

  const whereSql = where.join(' AND ');

  const [rows] = await pool.query(
    `SELECT om.*, u.username, u.email as user_email
     FROM orders_master om
     LEFT JOIN user_master u ON om.customer_user_uid = u.uid
     WHERE ${whereSql}
     ORDER BY om.entry_datetime DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) as count FROM orders_master om WHERE ${whereSql}`,
    params
  );

  for (const r of rows) {
    const [items] = await pool.query(`SELECT * FROM order_items WHERE order_uid = ?`, [r.uid]);
    r.items = items;
  }

  return { orders: rows, total: count, page: Number(page), limit: Number(limit) };
}

// 5. Admin: Process Shipment & Mandatory Tracking Validation
async function updateOrderShipment(orderUid, { shipmentNumber, courierDetails = 'Standard Courier', notes }) {
  if (!shipmentNumber || !shipmentNumber.trim()) {
    throw Object.assign(new Error('Shipment Tracking Number is strictly mandatory to ship an order.'), { status: 422 });
  }

  const [[existing]] = await pool.query(
    `SELECT uid, status FROM orders_master WHERE uid = ? AND delete_datetime IS NULL`,
    [orderUid]
  );
  if (!existing) throw Object.assign(new Error('Order not found.'), { status: 404 });

  await pool.query(
    `UPDATE orders_master 
     SET status = 'Shipped',
         shipment_number = ?,
         courier_details = ?,
         shipped_at = NOW(),
         notes = COALESCE(?, notes),
         update_datetime = NOW()
     WHERE uid = ?`,
    [shipmentNumber.trim(), (courierDetails || '').trim() || 'Courier', notes || null, orderUid]
  );

  return getOrderDetails(orderUid);
}

// 6. Admin / Customer: Update Order Status
async function updateOrderStatus(orderUid, status) {
  const allowed = ['Pending', 'Placed', 'Confirmed', 'Shipped', 'Delivered', 'Closed', 'Cancelled'];
  if (!allowed.includes(status)) {
    throw Object.assign(new Error(`Invalid status. Must be one of: ${allowed.join(', ')}`), { status: 400 });
  }

  const extraSql = (status === 'Delivered' || status === 'Closed') ? ', delivered_at = COALESCE(delivered_at, NOW())' : '';

  await pool.query(
    `UPDATE orders_master 
     SET status = ?, update_datetime = NOW() ${extraSql}
     WHERE uid = ? AND delete_datetime IS NULL`,
    [status, orderUid]
  );

  return getOrderDetails(orderUid);
}

// 7. Admin: Confirm Order Quantity, Stock Availability & Payment Details
async function confirmOrderAndPayment(orderUid, { paymentMethod, paymentStatus = 'Paid', paymentReference, paymentRemarks, notes }) {
  const [[existing]] = await pool.query(
    `SELECT uid, status FROM orders_master WHERE uid = ? AND delete_datetime IS NULL`,
    [orderUid]
  );
  if (!existing) throw Object.assign(new Error('Order not found.'), { status: 404 });

  await pool.query(
    `UPDATE orders_master 
     SET status = 'Confirmed',
         payment_method = COALESCE(?, payment_method),
         payment_status = COALESCE(?, payment_status),
         payment_reference = COALESCE(?, payment_reference),
         payment_remarks = COALESCE(?, payment_remarks),
         notes = COALESCE(?, notes),
         update_datetime = NOW()
     WHERE uid = ?`,
    [
      paymentMethod || null,
      paymentStatus || 'Paid',
      paymentReference || null,
      paymentRemarks || null,
      notes || null,
      orderUid
    ]
  );

  return getOrderDetails(orderUid);
}

// 8. Admin: Revert Order Status (e.g. Closed/Delivered -> Confirmed/Shipped/Pending)
async function revertOrderStatus(orderUid, targetStatus = 'Confirmed', reason = '') {
  const allowed = ['Pending', 'Placed', 'Confirmed', 'Shipped'];
  if (!allowed.includes(targetStatus)) {
    throw Object.assign(new Error(`Invalid revert target status. Must be one of: ${allowed.join(', ')}`), { status: 400 });
  }

  const revertNote = reason ? `\n[Reverted to ${targetStatus} on ${new Date().toISOString().slice(0, 10)}: ${reason}]` : '';

  await pool.query(
    `UPDATE orders_master 
     SET status = ?,
         delivered_at = NULL,
         notes = CONCAT(COALESCE(notes, ''), ?),
         update_datetime = NOW()
     WHERE uid = ? AND delete_datetime IS NULL`,
    [targetStatus, revertNote, orderUid]
  );

  return getOrderDetails(orderUid);
}

// 9. Customer: Report Order Defect / Issue
async function reportOrderIssue({ orderUid, userUid, issueType, issueDescription }) {
  if (!issueType || !issueType.trim()) {
    throw Object.assign(new Error('Please select an issue type (e.g. Defect, Damaged, Not Received).'), { status: 400 });
  }

  const [[order]] = await pool.query(
    `SELECT uid, customer_user_uid FROM orders_master WHERE uid = ? AND delete_datetime IS NULL`,
    [orderUid]
  );
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });

  await pool.query(
    `UPDATE orders_master 
     SET issue_type = ?,
         issue_description = ?,
         issue_status = 'Reported',
         issue_reported_at = NOW(),
         update_datetime = NOW()
     WHERE uid = ?`,
    [issueType.trim(), issueDescription ? issueDescription.trim() : null, orderUid]
  );

  return getOrderDetails(orderUid);
}

// 10. Admin: Update Issue Resolution Status
async function updateOrderIssueStatus(orderUid, { issueStatus, adminResolutionNotes }) {
  const noteAppend = adminResolutionNotes ? `\n[Issue Update (${issueStatus}) on ${new Date().toISOString().slice(0, 10)}: ${adminResolutionNotes}]` : '';

  await pool.query(
    `UPDATE orders_master 
     SET issue_status = ?,
         notes = CONCAT(COALESCE(notes, ''), ?),
         update_datetime = NOW()
     WHERE uid = ? AND delete_datetime IS NULL`,
    [issueStatus, noteAppend, orderUid]
  );

  return getOrderDetails(orderUid);
}

// 11. Pre-Flight Cart Stock Verification
async function verifyCartStock(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { can_proceed: true, items: [] };
  }

  const results = [];
  let allAvailable = true;

  for (const it of items) {
    const stockUid = it.stock_uid || it.uid;
    const requestedQty = Math.max(1, Number(it.quantity || 1));

    const [[stockInfo]] = await pool.query(
      `SELECT 
         sm.uid, 
         sm.design_number,
         (
           COALESCE((SELECT SUM(si.pieces) FROM stock_inward si WHERE si.stock_uid = sm.uid AND si.delete_datetime IS NULL), 0) -
           COALESCE((SELECT SUM(bi.pieces) FROM bill_items bi WHERE bi.stock_uid = sm.uid AND bi.delete_datetime IS NULL), 0) -
           COALESCE((
             SELECT SUM(api.pieces) 
             FROM advance_prebook_items api 
             JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
             WHERE api.stock_uid = sm.uid AND api.delete_datetime IS NULL AND api.update_datetime IS NULL
           ), 0) -
           COALESCE((
             SELECT SUM(oi.quantity) 
             FROM order_items oi 
             JOIN orders_master om ON om.uid = oi.order_uid AND om.status IN ('Pending', 'Placed', 'Processing', 'Confirmed', 'Shipped') AND om.delete_datetime IS NULL
             WHERE oi.stock_uid = sm.uid
           ), 0)
         ) AS available_pcs
       FROM stock_master sm
       WHERE sm.uid = ? AND sm.delete_datetime IS NULL`,
      [stockUid]
    );

    const availablePcs = stockInfo ? Math.max(0, Number(stockInfo.available_pcs || 0)) : 0;
    const isAvailable = availablePcs >= requestedQty;
    const isSoldOut = availablePcs <= 0;
    const isLowStock = availablePcs > 0 && availablePcs <= 5;

    let message = null;
    if (isSoldOut) {
      message = 'Sold Out';
      allAvailable = false;
    } else if (!isAvailable) {
      message = `Only ${availablePcs} sheet(s) left in stock`;
      allAvailable = false;
    } else if (isLowStock) {
      message = `Low stock: Only ${availablePcs} left`;
    }

    results.push({
      stock_uid: stockUid,
      design_number: stockInfo?.design_number || it.design_number,
      requested_qty: requestedQty,
      available_pcs: availablePcs,
      is_available: isAvailable,
      is_sold_out: isSoldOut,
      is_low_stock: isLowStock,
      message
    });
  }

  return {
    can_proceed: allAvailable,
    items: results
  };
}

// 12. Log Customer Search Demand (Business Intelligence)
async function logSearchDemand({ queryText, searchType = 'text', resultsCount = 0, userIp = null, userUid = null }) {
  if (!queryText || !queryText.trim()) return null;
  const uid = newUid();
  await pool.query(
    `INSERT INTO search_demand_logs (uid, query_text, search_type, results_count, user_ip, user_uid, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [uid, queryText.trim().toLowerCase(), searchType, Number(resultsCount) || 0, userIp, userUid]
  );
  return { logged: true, uid };
}

// 13. Admin: Get Search Demand Trends
async function getDemandTrends({ limit = 20, zeroResultsOnly = false } = {}) {
  let where = [];
  if (zeroResultsOnly) {
    where.push('results_count = 0');
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [topTerms] = await pool.query(
    `SELECT 
       query_text,
       search_type,
       COUNT(*) AS search_count,
       SUM(CASE WHEN results_count = 0 THEN 1 ELSE 0 END) AS zero_results_count,
       MAX(entry_datetime) AS last_searched_at
     FROM search_demand_logs
     ${whereSql}
     GROUP BY query_text, search_type
     ORDER BY search_count DESC, last_searched_at DESC
     LIMIT ?`,
    [Number(limit)]
  );

  const [[{ totalSearches }]] = await pool.query(`SELECT COUNT(*) AS totalSearches FROM search_demand_logs`);
  const [[{ zeroResultSearches }]] = await pool.query(`SELECT COUNT(*) AS zeroResultSearches FROM search_demand_logs WHERE results_count = 0`);

  return {
    total_searches: totalSearches,
    zero_result_searches: zeroResultSearches,
    demand_trends: topTerms
  };
}

module.exports = {
  createOrder,
  getCustomerOrders,
  getOrderDetails,
  listAdminOrders,
  updateOrderShipment,
  updateOrderStatus,
  confirmOrderAndPayment,
  revertOrderStatus,
  reportOrderIssue,
  updateOrderIssueStatus,
  verifyCartStock,
  logSearchDemand,
  getDemandTrends
};
