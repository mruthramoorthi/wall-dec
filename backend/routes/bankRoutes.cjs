const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController.cjs');

router.get('/', bankController.list);
router.get('/:uid', bankController.getByUid);
router.post('/', bankController.create);
router.put('/:uid', bankController.update);
router.delete('/:uid', bankController.remove);

module.exports = router;
