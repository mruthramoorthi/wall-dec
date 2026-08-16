const stockInwardModel = require('../models/stockInwardModel.cjs');
const { parsePagination, parseSort } = require('../utils/pagination.cjs');
const { isNumeric, required } = require('../utils/validators.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

function validateItem(item) {
  const missing = required(['size_uid', 'pieces', 'avg_total_rate'], item);
  if (missing.length) throw new ApiError(400, `Item missing field(s): ${missing.join(', ')}`);
  if (!isNumeric(item.pieces)) throw new ApiError(400, 'pieces must be numeric');
  if (!isNumeric(item.avg_total_rate)) throw new ApiError(400, 'avg_total_rate must be numeric');
}

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset, search } = parsePagination(req.query);
    const { sortColumn, sortDir, sortKey } = parseSort(req.query, stockInwardModel.SORT_COLUMNS, 'entry_datetime');
    const { rows, total } = await stockInwardModel.list({ pageSize, offset, search, sortColumn, sortDir });
    res.json({ data: rows, page, pageSize, total, sortBy: sortKey, sortDir });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await stockInwardModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Not found');
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { is_opening, dealer_uid, items } = req.body;
    if (!is_opening && !dealer_uid) throw new ApiError(400, 'dealer_uid is required unless is_opening is true', 'dealer_uid');
    if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'At least one item is required', 'items');
    items.forEach(validateItem);
    const uids = await stockInwardModel.createBatch({ is_opening, dealer_uid, items });
    res.status(201).json({ data: { uids } });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await stockInwardModel.findByUid(req.params.uid);
    if (!existing) throw new ApiError(404, 'Not found');

    const payload = {
      ...existing,
      ...req.body,
      size_uid: req.body.size_uid || existing.size_uid,
      pieces: req.body.pieces ?? existing.pieces,
      avg_total_rate: req.body.avg_total_rate ?? existing.avg_total_rate,
    };

    validateItem(payload);
    const row = await stockInwardModel.edit(req.params.uid, payload);
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await stockInwardModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Not found');
    res.status(204).send();
  } catch (err) { next(err); }
};
