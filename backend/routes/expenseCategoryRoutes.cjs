const express = require('express');
const ctrl = require('../controllers/expenseCategoryController.cjs');
const router = express.Router();

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:uid', ctrl.get);
router.put('/:uid', ctrl.update);
router.delete('/:uid', ctrl.remove);

module.exports = router;
