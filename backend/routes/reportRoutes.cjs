const express = require('express');
const ctrl = require('../controllers/reportController.cjs');
const router = express.Router();
router.get('/amount-transaction', ctrl.amountTransaction);
module.exports = router;
