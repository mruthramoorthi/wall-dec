const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockCheckController.cjs');

router.get('/report', ctrl.report);
router.get('/history/:stock_uid', ctrl.history);

module.exports = router;
