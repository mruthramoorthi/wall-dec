const orderModel = require('../models/orderModel.cjs');
const feedbackModel = require('../models/feedbackModel.cjs');

// Customer: Place Order
async function placeOrder(req, res, next) {
  try {
    const userUid = req.user?.uid || req.body.userUid;
    if (!userUid) return res.status(401).json({ error: { message: 'Authentication required to place order.' } });
    
    const { shipping, items, paymentMethod } = req.body;
    if (!shipping || !items || !items.length) {
      return res.status(400).json({ error: { message: 'Shipping details and items are required.' } });
    }

    const result = await orderModel.createOrder({ userUid, shipping, items, paymentMethod });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Customer: My Orders
async function getMyOrders(req, res, next) {
  try {
    const userUid = req.user?.uid || req.params.userUid;
    if (!userUid) return res.status(401).json({ error: { message: 'User ID is required.' } });
    const orders = await orderModel.getCustomerOrders(userUid);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

// Customer / Admin: Get Order By UID
async function getOrder(req, res, next) {
  try {
    const order = await orderModel.getOrderDetails(req.params.uid);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

// Admin: List Orders with Filters
async function listOrdersAdmin(req, res, next) {
  try {
    const { status, search, page, limit } = req.query;
    const result = await orderModel.listAdminOrders({ status, search, page, limit });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Admin: Submit Shipment Tracking
async function processShipment(req, res, next) {
  try {
    const { uid } = req.params;
    const { shipmentNumber, courierDetails, notes } = req.body;
    const updated = await orderModel.updateOrderShipment(uid, { shipmentNumber, courierDetails, notes });
    res.json({ success: true, message: 'Shipment dispatched successfully.', data: updated });
  } catch (err) {
    next(err);
  }
}

// Admin / Customer: Update Status
async function updateStatus(req, res, next) {
  try {
    const { uid } = req.params;
    const { status } = req.body;
    const updated = await orderModel.updateOrderStatus(uid, status);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// Customer: Post Rating
async function submitRating(req, res, next) {
  try {
    const userUid = req.user?.uid || req.body.userUid || null;
    const { orderUid, stockUid, rating, reviewTitle, comment } = req.body;
    const result = await feedbackModel.addFeedback({ userUid, orderUid, stockUid, rating, reviewTitle, comment });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Public: Get Product Feedback
async function getProductReviews(req, res, next) {
  try {
    const { stockUid } = req.params;
    const result = await feedbackModel.getProductReviews(stockUid);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Admin: Confirm Order Qty & Payment
async function confirmAndPay(req, res, next) {
  try {
    const { uid } = req.params;
    const { paymentMethod, paymentStatus, paymentReference, paymentRemarks, notes } = req.body;
    const updated = await orderModel.confirmOrderAndPayment(uid, {
      paymentMethod,
      paymentStatus,
      paymentReference,
      paymentRemarks,
      notes
    });
    res.json({ success: true, message: 'Order stock & payment confirmed successfully.', data: updated });
  } catch (err) {
    next(err);
  }
}

// Admin: Revert Order Status
async function revertOrder(req, res, next) {
  try {
    const { uid } = req.params;
    const { targetStatus, reason } = req.body;
    const updated = await orderModel.revertOrderStatus(uid, targetStatus, reason);
    res.json({ success: true, message: `Order reverted to ${targetStatus}.`, data: updated });
  } catch (err) {
    next(err);
  }
}

// Customer: Report Defect or Order Issue
async function reportIssue(req, res, next) {
  try {
    const userUid = req.user?.uid || req.body.userUid || null;
    const { orderUid, issueType, issueDescription } = req.body;
    const updated = await orderModel.reportOrderIssue({ orderUid, userUid, issueType, issueDescription });
    res.json({ success: true, message: 'Issue reported successfully. Our team will look into it promptly.', data: updated });
  } catch (err) {
    next(err);
  }
}

// Admin: Update Issue Resolution Status
async function updateIssueStatus(req, res, next) {
  try {
    const { uid } = req.params;
    const { issueStatus, adminResolutionNotes } = req.body;
    const updated = await orderModel.updateOrderIssueStatus(uid, { issueStatus, adminResolutionNotes });
    res.json({ success: true, message: 'Issue status updated.', data: updated });
  } catch (err) {
    next(err);
  }
}

// Customer: Pre-Flight Cart Stock Check
async function verifyCartStock(req, res, next) {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items || [];
    const result = await orderModel.verifyCartStock(items);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Public / Customer: Log Search Demand
async function logSearch(req, res, next) {
  try {
    const { queryText, searchType, resultsCount } = req.body;
    const userIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    const userUid = req.user?.uid || req.body.userUid || null;
    const result = await orderModel.logSearchDemand({ queryText, searchType, resultsCount, userIp, userUid });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Admin: Demand Insights & Top Search Trends
async function getDemandTrends(req, res, next) {
  try {
    const { limit, zeroResultsOnly } = req.query;
    const result = await orderModel.getDemandTrends({ limit, zeroResultsOnly: zeroResultsOnly === 'true' });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  placeOrder,
  getMyOrders,
  getOrder,
  listOrdersAdmin,
  processShipment,
  updateStatus,
  submitRating,
  getProductReviews,
  confirmAndPay,
  revertOrder,
  reportIssue,
  updateIssueStatus,
  verifyCartStock,
  logSearch,
  getDemandTrends
};
