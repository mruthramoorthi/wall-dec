const express = require('express');
const ctrl = require('../controllers/companyController.cjs');
const router = express.Router();
router.get('/', ctrl.get);
router.post('/', ctrl.upsert);
module.exports = router;
