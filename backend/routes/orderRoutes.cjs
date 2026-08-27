const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController.cjs');

// Customer Endpoints
router.post('/checkout', ctrl.placeOrder);
router.post('/verify-cart-stock', ctrl.verifyCartStock);
router.post('/log-search', ctrl.logSearch);
router.get('/my-orders/:userUid', ctrl.getMyOrders);
router.get('/details/:uid', ctrl.getOrder);
router.post('/feedback', ctrl.submitRating);
router.get('/feedback/:stockUid', ctrl.getProductReviews);
router.post('/report-issue', ctrl.reportIssue);

// Admin Endpoints
router.get('/admin/list', ctrl.listOrdersAdmin);
router.get('/admin/demand-trends', ctrl.getDemandTrends);
router.post('/admin/:uid/ship', ctrl.processShipment);
router.patch('/admin/:uid/status', ctrl.updateStatus);
router.patch('/admin/:uid/confirm-and-pay', ctrl.confirmAndPay);
router.patch('/admin/:uid/revert', ctrl.revertOrder);
router.patch('/admin/:uid/issue-status', ctrl.updateIssueStatus);

module.exports = router;
