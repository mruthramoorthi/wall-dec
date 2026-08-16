const express = require('express');
const router = express.Router();
const paymentModeController = require('../controllers/paymentModeController.cjs');

router.get('/', paymentModeController.list);
router.get('/:uid', paymentModeController.getByUid);
router.post('/', paymentModeController.create);
router.put('/:uid', paymentModeController.update);
router.delete('/:uid', paymentModeController.remove);

module.exports = router;
