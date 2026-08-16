const express = require('express');
const router = express.Router();

router.use('/size', require('./sizeRoutes.cjs'));
router.use('/dealer', require('./dealerRoutes.cjs'));
router.use('/stock-inward', require('./stockInwardRoutes.cjs'));
router.use('/stock', require('./stockRoutes.cjs'));
router.use('/customer', require('./customerRoutes.cjs'));
router.use('/bill', require('./billRoutes.cjs'));
router.use('/reports', require('./reportRoutes.cjs'));
router.use('/stock-check', require('./stockCheckRoutes.cjs'));
router.use('/advance', require('./advanceRoutes.cjs'));
router.use('/company', require('./companyRoutes.cjs'));
router.use('/employee', require('./employeeRoutes.cjs'));
router.use('/rate-master', require('./rateMasterRoutes.cjs'));
router.use('/credit', require('./creditRoutes.cjs'));
router.use('/auth', require('./authRoutes.cjs'));
router.use('/bank', require('./bankRoutes.cjs'));
router.use('/payment-mode', require('./paymentModeRoutes.cjs'));
router.use('/expense', require('./expenseRoutes.cjs'));
router.use('/expense-category', require('./expenseCategoryRoutes.cjs'));
router.use('/print', require('./printRoutes.cjs'));

module.exports = router;
