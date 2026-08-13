const express = require('express');
const router = express.Router();

router.use('/size', require('./sizeRoutes.cjs'));
router.use('/dealer', require('./dealerRoutes.cjs'));
router.use('/stock-inward', require('./stockInwardRoutes.cjs'));
router.use('/stock', require('./stockRoutes.cjs'));
router.use('/customer', require('./customerRoutes.cjs'));
router.use('/bill', require('./billRoutes.cjs'));
router.use('/reports', require('./reportRoutes.cjs'));

module.exports = router;
