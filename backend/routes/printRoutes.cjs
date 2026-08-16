const express = require('express');
const router = express.Router();
const printController = require('../controllers/printController.cjs');

// GET /api/print/receipt-pdf?type=bill&uid=...
router.get('/receipt-pdf', printController.generateReceiptPdf);

module.exports = router;
