const rateMasterModel = require('../models/rateMasterModel.cjs');

exports.list = async (req, res, next) => {
  try {
    const pageSize = Number(req.query.pageSize || 50);
    const offset = (Number(req.query.page || 1) - 1) * pageSize;
    const search = req.query.search || '';
    const { rows, total } = await rateMasterModel.list({ pageSize, offset, search });
    res.json({ data: rows, total, page: Number(req.query.page || 1), pageSize });
  } catch (err) { next(err); }
};

exports.updateRates = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { selling_price_per_piece } = req.body;
    const result = await rateMasterModel.updateRates(uid, {
      selling_price_per_piece: selling_price_per_piece ?? null,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
};
