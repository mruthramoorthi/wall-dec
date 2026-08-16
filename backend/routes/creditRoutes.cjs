const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController.cjs');

router.get('/bills', creditController.listCreditBills);
router.get('/customer-advances/:customer_uid', creditController.getCustomerAdvances);
router.post('/receive', creditController.receivePayment);
router.put('/receipts/:uid', creditController.updateReceipt);
router.delete('/receipts/:uid', creditController.deleteReceipt);
router.get('/receipts', creditController.listReceipts);
router.get('/summary', creditController.getCreditSummary);

module.exports = router;
