const expenseModel = require('../models/expenseModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, search = '', fromDate = '', toDate = '', category = '', paymentMode = '', bankUid = '' } = req.query;
    const { offset } = parsePagination({ page, pageSize });
    const result = await expenseModel.list({
      pageSize,
      offset,
      search,
      fromDate,
      toDate,
      category,
      paymentMode,
      bankUid
    });
    res.json({
      data: result.rows,
      page: Number(page),
      pageSize: Number(pageSize),
      total: result.total,
      grandTotal: result.grandTotal,
      categories: result.categories
    });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await expenseModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Expense not found');
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { category, amount, payment_mode } = req.body;
    if (!category || !category.trim()) throw new ApiError(400, 'Expense category/title is required', 'category');
    if (amount === '' || amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new ApiError(400, 'A valid positive amount is required', 'amount');
    }
    if (!payment_mode || !payment_mode.trim()) throw new ApiError(400, 'Payment mode is required', 'payment_mode');

    const row = await expenseModel.create(req.body);
    res.status(201).json({ message: 'Expense recorded successfully!', data: row });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { category, amount, payment_mode } = req.body;
    if (category !== undefined && !category.trim()) throw new ApiError(400, 'Expense category/title cannot be empty', 'category');
    if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
      throw new ApiError(400, 'A valid positive amount is required', 'amount');
    }

    const row = await expenseModel.edit(req.params.uid, req.body);
    if (!row) throw new ApiError(404, 'Expense not found');
    res.json({ message: 'Expense updated successfully!', data: row });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await expenseModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Expense not found');
    res.status(204).send();
  } catch (err) { next(err); }
};
