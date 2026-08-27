const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/stockController.cjs');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/image-search', upload.single('file'), ctrl.imageSearch);
router.post('/upload-image', upload.single('file'), ctrl.uploadImage);
router.post('/ensure-home-bill-stock', ctrl.ensureHomeBillStock);
router.get('/catalog', ctrl.getCatalogList);
router.get('/by-design/:design_number', ctrl.byDesignNumber);
router.get('/', ctrl.list);
module.exports = router;
