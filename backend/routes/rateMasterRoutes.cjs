const express = require('express');
const ctrl = require('../controllers/rateMasterController.cjs');
const router = express.Router();
router.get('/', ctrl.list);
router.put('/:uid/rates', ctrl.updateRates);
module.exports = router;
