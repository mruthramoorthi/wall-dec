const express = require('express');
const router = express.Router();
const screenController = require('../controllers/screenController.cjs');

router.get('/', screenController.listScreens);
router.get('/permissions', screenController.getPermissionsMatrix);
router.put('/permissions', screenController.savePermissionsMatrix);
router.put('/toggle-active/:screenKey', screenController.toggleScreenActive);
router.get('/my-screens', screenController.getMyScreens);

module.exports = router;
