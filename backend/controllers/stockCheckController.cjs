const stockCheckModel = require('../models/stockCheckModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');

exports.report = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { from_date, to_date, search, size_uid, status, sort_by, sort_dir } = req.query;

    const result = await stockCheckModel.getStockCheckReport({
      fromDate: from_date || null,
      toDate: to_date || null,
      searchDesign: search || null,
      sizeUid: size_uid || null,
      statusFilter: status || null,
      pageSize,
      offset,
      sortBy: sort_by || 'design_number',
      sortDir: sort_dir || 'ASC'
    });

    res.json({
      data: result.rows,
      page,
      pageSize,
      total: result.total,
      summary: result.summary
    });
  } catch (err) {
    next(err);
  }
};

exports.history = async (req, res, next) => {
  try {
    const { stock_uid } = req.params;
    const { from_date, to_date } = req.query;

    const movement = await stockCheckModel.getDesignMovementHistory({
      stock_uid,
      fromDate: from_date || null,
      toDate: to_date || null
    });

    res.json({ data: movement });
  } catch (err) {
    next(err);
  }
};
