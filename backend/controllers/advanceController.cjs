const advanceModel = require('../models/advanceModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { required } = require('../utils/validators.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

function validateBody(body) {
  const missing = required(['customer_uid', 'amount', 'payment_mode'], body);
  if (missing.length) {
    throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`, missing[0]);
  }
  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new ApiError(400, 'Advance amount must be a positive number', 'amount');
  }
}

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { search, fromDate, toDate } = req.query;
    const { rows, total, grandTotal } = await advanceModel.list({ pageSize, offset, search, fromDate, toDate });
    res.json({ data: rows, page, pageSize, total, grandTotal });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const row = await advanceModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Advance record not found');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

exports.getByCode = async (req, res, next) => {
  try {
    const row = await advanceModel.findByPrebookCode(req.params.code);
    if (!row) throw new ApiError(404, `Pre-booking with code "${req.params.code}" not found`);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    validateBody(req.body);
    const row = await advanceModel.create(req.body);
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    validateBody(req.body);
    const existing = await advanceModel.findByUid(req.params.uid);
    if (!existing) throw new ApiError(404, 'Advance record not found');
    const row = await advanceModel.edit(req.params.uid, req.body);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await advanceModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Advance record not found');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
