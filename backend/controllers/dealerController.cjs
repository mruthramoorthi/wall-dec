const dealerModel = require('../models/dealerModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { isAlphaNoSpace, isDealerCode, isMobile, isGstin, required } = require('../utils/validators.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

const MANDATORY = ['dealer_name', 'dealer_code', 'mobile_number', 'city', 'state'];

function validateBody(body) {
  const missing = required(MANDATORY, body);
  if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`, missing[0]);
  if (!isAlphaNoSpace(body.dealer_name)) throw new ApiError(400, 'Dealer name must be alphabets only, no spaces', 'dealer_name');
  if (!isDealerCode(body.dealer_code)) throw new ApiError(400, 'Dealer code must be exactly 5 characters', 'dealer_code');
  if (!isMobile(body.mobile_number)) throw new ApiError(400, 'Mobile number must be exactly 10 digits', 'mobile_number');
  if (body.gstin && !isGstin(body.gstin)) throw new ApiError(400, 'Invalid GSTIN format', 'gstin');
}

async function assertNoConflicts(body, excludeUid = null) {
  const conflicts = await dealerModel.findConflicts(body, excludeUid);
  const field = Object.keys(conflicts)[0];
  if (field) throw new ApiError(409, `${field.replace('_', ' ')} already in use`, field);
}

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { rows, total } = await dealerModel.list({ pageSize, offset });
    res.json({ data: rows, page, pageSize, total });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await dealerModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Not found');
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    validateBody(req.body);
    await assertNoConflicts(req.body);
    const row = await dealerModel.create(req.body);
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    validateBody(req.body);
    const existing = await dealerModel.findByUid(req.params.uid);
    if (!existing) throw new ApiError(404, 'Not found');
    await assertNoConflicts(req.body, req.params.uid);
    const row = await dealerModel.edit(req.params.uid, req.body);
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await dealerModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Not found');
    res.status(204).send();
  } catch (err) { next(err); }
};
