const express = require('express');
const router = express.Router();
const dealerPaymentController = require('../controllers/dealerPaymentController.cjs');

// GET /api/dealer-payments/credit-purchases - List dealer credit inwards with dues
router.get('/credit-purchases', dealerPaymentController.getDealerCreditPurchases);

// POST /api/dealer-payments/receive - Record payment to dealer
router.post('/receive', dealerPaymentController.recordDealerPayment);

// GET /api/dealer-payments/history - List dealer payment history vouchers
router.get('/history', dealerPaymentController.getDealerPaymentsList);

// DELETE /api/dealer-payments/:uid - Delete payment & restore due
router.delete('/:uid', dealerPaymentController.deleteDealerPayment);

// GET /api/dealer-payments/summary - Summary KPI metrics
router.get('/summary', dealerPaymentController.getDealerSummary);

module.exports = router;
