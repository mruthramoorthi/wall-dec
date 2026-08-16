const billModel = require('../models/billModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { required } = require('../utils/validators.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

function validateBody(body) {
  const missing = required(['customer_uid', 'items', 'payments'], body);
  if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`, missing[0]);
  if (!Array.isArray(body.items) || body.items.length === 0) throw new ApiError(400, 'At least one bill item is required', 'items');
  if (!Array.isArray(body.payments) || body.payments.length === 0) throw new ApiError(400, 'At least one payment is required', 'payments');
}

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const todayOnly = req.query.todayOnly === 'true';
    const { rows, total, grandTotal } = await billModel.list({ pageSize, offset, todayOnly });
    res.json({ data: rows, page, pageSize, total, grandTotal });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await billModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Not found');
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    validateBody(req.body);
    const row = await billModel.create(req.body);
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    validateBody(req.body);
    const existing = await billModel.findByUid(req.params.uid);
    if (!existing) throw new ApiError(404, 'Not found');
    const row = await billModel.edit(req.params.uid, req.body);
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await billModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Not found');
    res.status(204).send();
  } catch (err) { next(err); }
};
