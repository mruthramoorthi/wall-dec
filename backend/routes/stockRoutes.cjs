const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/stockController.cjs');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/image-search', upload.single('file'), ctrl.imageSearch);
router.get('/by-design/:design_number', ctrl.byDesignNumber);
router.get('/', ctrl.list);
module.exports = router;
