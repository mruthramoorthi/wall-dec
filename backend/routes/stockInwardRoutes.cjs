const express = require('express');
const ctrl = require('../controllers/stockInwardController.cjs');
const router = express.Router();
router.get('/', ctrl.list);
router.get('/:uid', ctrl.get);
router.post('/', ctrl.create);
router.put('/:uid', ctrl.update);
router.delete('/:uid', ctrl.remove);
module.exports = router;
