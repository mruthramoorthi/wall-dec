const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advanceController.cjs');

router.get('/', advanceController.list);
router.get('/by-code/:code', advanceController.getByCode);
router.get('/:uid', advanceController.get);
router.post('/', advanceController.create);
router.put('/:uid', advanceController.update);
router.delete('/:uid', advanceController.remove);

module.exports = router;
