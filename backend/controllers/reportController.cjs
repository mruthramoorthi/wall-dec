const reportModel = require('../models/reportModel.cjs');
const { parsePagination, parseSort } = require('../utils/pagination.cjs');

exports.amountTransaction = async (req, res, next) => {
  try {
    const { page, pageSize, offset, search } = parsePagination(req.query);
    const { sortColumn, sortDir, sortKey } = parseSort(req.query, reportModel.SORT_COLUMNS, 'entry_datetime');
    const { fromDate, toDate, customerUid, minAmount, maxAmount, paymentMode } = req.query;

    const { rows, totals, total } = await reportModel.amountTransaction({
      pageSize,
      offset,
      search,
      fromDate,
      toDate,
      customerUid,
      minAmount,
      maxAmount,
      paymentMode,
      sortColumn,
      sortDir
    });

    res.json({ data: rows, totals, page, pageSize, total, sortBy: sortKey, sortDir });
  } catch (err) { next(err); }
};
