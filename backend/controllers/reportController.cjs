const transactionModel = require('../models/transactionModel.cjs');
const { parsePagination, parseSort } = require('../utils/pagination.cjs');

const SORT_COLUMNS = {
  date: 't.transaction_date',
  transaction_date: 't.transaction_date',
  entry_datetime: 't.entry_datetime',
  type: 't.transaction_type',
  transaction_type: 't.transaction_type',
  ref: 't.reference_number',
  reference_number: 't.reference_number',
  party_name: 't.party_name',
  amount: 't.amount',
  payment_mode: 't.payment_mode'
};

exports.amountTransaction = async (req, res, next) => {
  try {
    const { page, pageSize, offset, search } = parsePagination(req.query);
    const { sortColumn, sortDir, sortKey } = parseSort(req.query, SORT_COLUMNS, 't.entry_datetime');
    const { fromDate, toDate, transactionType, paymentMode, bankUid, customerUid, minAmount, maxAmount } = req.query;

    const { rows, totals, total } = await transactionModel.listTransactions({
      pageSize,
      offset,
      search,
      fromDate,
      toDate,
      transactionType,
      paymentMode,
      bankUid,
      customerUid,
      minAmount,
      maxAmount,
      sortColumn,
      sortDir
    });

    res.json({ data: rows, totals, page, pageSize, total, sortBy: sortKey, sortDir });
  } catch (err) { next(err); }
};

exports.dashboardOverview = async (req, res, next) => {
  try {
    const pool = require('../config/db.cjs');

    // 1. Bills Today & Month
    const [[billToday]] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM bill_master WHERE DATE(entry_datetime) = CURDATE() AND delete_datetime IS NULL'
    );
    const [[billMonth]] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM bill_master WHERE MONTH(entry_datetime) = MONTH(CURDATE()) AND YEAR(entry_datetime) = YEAR(CURDATE()) AND delete_datetime IS NULL'
    );

    // 2. Customer Credit / Receivables
    const [[creditDue]] = await pool.query(
      "SELECT COUNT(*) as count, COALESCE(SUM(due_amount), 0) as total FROM bill_master WHERE is_credit = 1 AND (credit_status IS NULL OR credit_status != 'PAID') AND delete_datetime IS NULL"
    );

    // 3. Online Storefront Orders
    const [[ordersSummary]] = await pool.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('Pending', 'Placed', 'Processing') THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered FROM orders_master WHERE delete_datetime IS NULL"
    );

    // 4. Warehouse Stock
    const [[stockSummary]] = await pool.query(`
      SELECT 
        COUNT(DISTINCT sm.uid) as designs,
        COALESCE(SUM(si.pieces), 0) - COALESCE(SUM(bi.pieces), 0) as total_available_pcs
      FROM stock_master sm
      LEFT JOIN (SELECT stock_uid, SUM(pieces) as pieces FROM stock_inward WHERE delete_datetime IS NULL GROUP BY stock_uid) si ON si.stock_uid = sm.uid
      LEFT JOIN (SELECT stock_uid, SUM(pieces) as pieces FROM bill_items WHERE delete_datetime IS NULL GROUP BY stock_uid) bi ON bi.stock_uid = sm.uid
      WHERE sm.delete_datetime IS NULL
    `);

    // 5. Active Customer Advances
    const [[advSummary]] = await pool.query(
      "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM customer_advance WHERE delete_datetime IS NULL AND update_datetime IS NULL AND is_converted_to_bill = 0"
    );

    // 6. Dealer Payables Due
    let dealerDue = { count: 0, total: 0 };
    try {
      const [[dd]] = await pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(due_balance), 0) as total
        FROM (
          SELECT 
            si.uid,
            (COALESCE(si.total_amount, 0) - COALESCE(SUM(dp.amount_paid), 0)) as due_balance
          FROM stock_inward si
          LEFT JOIN dealer_payments dp ON dp.inward_uid = si.uid AND dp.delete_datetime IS NULL
          WHERE si.is_opening = 0 AND si.delete_datetime IS NULL
          GROUP BY si.uid, si.total_amount
          HAVING due_balance > 0
        ) sub
      `);
      if (dd) dealerDue = dd;
    } catch (_) {}

    // 7. Recent Bills (latest 5)
    const [recentBills] = await pool.query(`
      SELECT b.uid, b.customer_uid, c.customer_name, b.grand_total, b.is_credit, b.credit_status, b.entry_datetime
      FROM bill_master b
      LEFT JOIN customer_master c ON c.uid = b.customer_uid
      WHERE b.delete_datetime IS NULL
      ORDER BY b.entry_datetime DESC
      LIMIT 5
    `);

    // 8. Recent Orders (latest 5)
    const [recentOrders] = await pool.query(`
      SELECT uid, order_number, shipping_name as customer_name, total_amount, status, entry_datetime
      FROM orders_master
      WHERE delete_datetime IS NULL
      ORDER BY entry_datetime DESC
      LIMIT 5
    `);

    // 9. Low stock alert items (less than 5 pcs available)
    const [lowStockItems] = await pool.query(`
      SELECT 
        sm.uid,
        sm.design_number,
        COALESCE(si.pieces, 0) - COALESCE(bi.pieces, 0) as available_pcs
      FROM stock_master sm
      LEFT JOIN (SELECT stock_uid, SUM(pieces) as pieces FROM stock_inward WHERE delete_datetime IS NULL GROUP BY stock_uid) si ON si.stock_uid = sm.uid
      LEFT JOIN (SELECT stock_uid, SUM(pieces) as pieces FROM bill_items WHERE delete_datetime IS NULL GROUP BY stock_uid) bi ON bi.stock_uid = sm.uid
      WHERE sm.delete_datetime IS NULL
      HAVING available_pcs <= 5 AND available_pcs > 0
      ORDER BY available_pcs ASC
      LIMIT 8
    `);

    res.json({
      success: true,
      data: {
        sales: {
          today_count: Number(billToday?.count || 0),
          today_total: Number(billToday?.total || 0),
          month_count: Number(billMonth?.count || 0),
          month_total: Number(billMonth?.total || 0)
        },
        orders: {
          total: Number(ordersSummary?.total || 0),
          pending: Number(ordersSummary?.pending || 0),
          delivered: Number(ordersSummary?.delivered || 0)
        },
        inventory: {
          total_designs: Number(stockSummary?.designs || 0),
          available_pieces: Number(stockSummary?.total_available_pcs || 0),
          low_stock_count: lowStockItems.length
        },
        credit: {
          due_count: Number(creditDue?.count || 0),
          due_total: Number(creditDue?.total || 0)
        },
        dealer: {
          due_count: Number(dealerDue?.count || 0),
          due_total: Number(dealerDue?.total || 0)
        },
        advances: {
          active_count: Number(advSummary?.count || 0),
          active_total: Number(advSummary?.total || 0)
        },
        recent_bills: recentBills,
        recent_orders: recentOrders,
        low_stock_items: lowStockItems
      }
    });
  } catch (err) {
    next(err);
  }
};

