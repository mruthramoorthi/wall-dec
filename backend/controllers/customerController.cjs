const customerModel = require('../models/customerModel.cjs');
const { isMobile, required } = require('../utils/validators.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

exports.search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ data: [] });
    const rows = await customerModel.search(q);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const missing = required(['customer_name', 'mobile_number'], req.body);
    if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`, missing[0]);
    if (!isMobile(req.body.mobile_number)) throw new ApiError(400, 'Mobile number must be exactly 10 digits', 'mobile_number');
    const row = await customerModel.create(req.body);
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
};
