const screenModel = require('../models/screenModel.cjs');

exports.listScreens = async (req, res, next) => {
  try {
    const screens = await screenModel.getAllScreens();
    res.json({ data: screens });
  } catch (err) { next(err); }
};

exports.getPermissionsMatrix = async (req, res, next) => {
  try {
    const data = await screenModel.getPermissionsMatrix();
    res.json({ data });
  } catch (err) { next(err); }
};

exports.savePermissionsMatrix = async (req, res, next) => {
  try {
    const { matrix } = req.body;
    if (!matrix || typeof matrix !== 'object') {
      return res.status(400).json({ error: 'Valid matrix object is required.' });
    }
    const data = await screenModel.savePermissionsMatrix(matrix);
    res.json({ message: 'Permissions matrix saved successfully!', data });
  } catch (err) { next(err); }
};

exports.toggleScreenActive = async (req, res, next) => {
  try {
    const { screenKey } = req.params;
    const { is_active } = req.body;
    const result = await screenModel.toggleScreenActive(screenKey, is_active);
    res.json({ message: `Screen "${screenKey}" active status updated.`, data: result });
  } catch (err) { next(err); }
};

exports.getMyScreens = async (req, res, next) => {
  try {
    const userUid = req.query.user_uid || req.user?.uid || null;
    const screens = await screenModel.getUserAllowedScreens(userUid);
    res.json({ data: screens });
  } catch (err) { next(err); }
};
