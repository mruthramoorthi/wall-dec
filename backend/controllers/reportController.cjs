const transactionModel = require('../models/transactionModel.cjs');
const { parsePagination, parseSort } = require('../utils/pagination.cjs');

const SORT_COLUMNS = {
  date: 't.transaction_date',
  transaction_date: 't.transaction_date',
  entry_datetime: 't.entry_datetime',
  type: 't.transaction_type',
  transaction_type: 't.transaction_type',
  ref: 't.reference_number',
  reference_number: 't.reference_number',
  party_name: 't.party_name',
  amount: 't.amount',
  payment_mode: 't.payment_mode'
};

exports.amountTransaction = async (req, res, next) => {
  try {
    const { page, pageSize, offset, search } = parsePagination(req.query);
    const { sortColumn, sortDir, sortKey } = parseSort(req.query, SORT_COLUMNS, 't.entry_datetime');
    const { fromDate, toDate, transactionType, paymentMode, bankUid, customerUid, minAmount, maxAmount } = req.query;

    const { rows, totals, total } = await transactionModel.listTransactions({
      pageSize,
      offset,
      search,
      fromDate,
      toDate,
      transactionType,
      paymentMode,
      bankUid,
      customerUid,
      minAmount,
      maxAmount,
      sortColumn,
      sortDir
    });

    res.json({ data: rows, totals, page, pageSize, total, sortBy: sortKey, sortDir });
  } catch (err) { next(err); }
};
