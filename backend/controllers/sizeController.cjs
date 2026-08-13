const sizeModel = require('../models/sizeModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { isNumeric, required } = require('../utils/validators.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

const FIELDS = ['width_ft', 'height_ft', 'thickness_mm'];

function validateBody(body) {
  const missing = required(FIELDS, body);
  if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`, missing[0]);
  for (const f of FIELDS) {
    if (!isNumeric(body[f])) throw new ApiError(400, `${f} must be a valid number`, f);
  }
}

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { rows, total } = await sizeModel.list({ pageSize, offset });
    res.json({ data: rows, page, pageSize, total });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await sizeModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Not found');
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    validateBody(req.body);
    const row = await sizeModel.create(req.body);
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    validateBody(req.body);
    const existing = await sizeModel.findByUid(req.params.uid);
    if (!existing) throw new ApiError(404, 'Not found');
    const row = await sizeModel.edit(req.params.uid, req.body);
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await sizeModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Not found');
    res.status(204).send();
  } catch (err) { next(err); }
};
