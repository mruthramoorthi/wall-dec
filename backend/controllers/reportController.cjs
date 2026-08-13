const reportModel = require('../models/reportModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');

exports.amountTransaction = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { rows, totals, total } = await reportModel.amountTransaction({ pageSize, offset });
    res.json({ data: rows, totals, page, pageSize, total });
  } catch (err) { next(err); }
};
