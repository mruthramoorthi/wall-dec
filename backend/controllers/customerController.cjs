const customerModel = require('../models/customerModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { isMobile, required } = require('../utils/validators.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { search } = req.query;
    const { rows, total } = await customerModel.list({ pageSize, offset, search });
    res.json({ data: rows, page, pageSize, total });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const row = await customerModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Customer not found');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

exports.search = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ data: [] });
    const rows = await customerModel.search(q);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const missing = required(['customer_name', 'mobile_number'], req.body);
    if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`, missing[0]);
    if (!isMobile(req.body.mobile_number)) throw new ApiError(400, 'Mobile number must be exactly 10 digits', 'mobile_number');
    
    // Check for duplicate mobile
    const existing = await customerModel.findByMobile(req.body.mobile_number.trim());
    if (existing) {
      // If same mobile exists, return the existing or error
      return res.status(200).json({ data: existing, message: 'Customer already exists' });
    }

    const row = await customerModel.create(req.body);
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const missing = required(['customer_name', 'mobile_number'], req.body);
    if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`, missing[0]);
    if (!isMobile(req.body.mobile_number)) throw new ApiError(400, 'Mobile number must be exactly 10 digits', 'mobile_number');
    
    const existing = await customerModel.findByUid(req.params.uid);
    if (!existing) throw new ApiError(404, 'Customer not found');

    const row = await customerModel.edit(req.params.uid, req.body);
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await customerModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Customer not found');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
