const express = require('express');
const ctrl = require('../controllers/reportController.cjs');
const router = express.Router();
router.get('/amount-transaction', ctrl.amountTransaction);
router.get('/dashboard-overview', ctrl.dashboardOverview);
module.exports = router;
