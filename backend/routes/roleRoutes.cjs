const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController.cjs');

router.get('/', roleController.list);
router.get('/:uid', roleController.get);
router.post('/', roleController.create);
router.put('/:uid', roleController.update);
router.delete('/:uid', roleController.remove);

module.exports = router;
