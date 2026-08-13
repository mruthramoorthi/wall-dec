const express = require('express');
const ctrl = require('../controllers/customerController.cjs');
const router = express.Router();
router.get('/search', ctrl.search);
router.post('/', ctrl.create);
module.exports = router;
