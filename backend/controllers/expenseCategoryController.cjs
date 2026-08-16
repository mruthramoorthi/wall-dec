const expenseCategoryModel = require('../models/expenseCategoryModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, search = '', all = 'false' } = req.query;
    const isAll = all === 'true' || all === '1';
    const { offset } = parsePagination({ page, pageSize });

    const result = await expenseCategoryModel.list({
      pageSize,
      offset,
      search,
      all: isAll
    });

    res.json({
      data: result.rows,
      page: Number(page),
      pageSize: isAll ? result.total : Number(pageSize),
      total: result.total
    });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await expenseCategoryModel.findByUid(req.params.uid);
    if (!row) throw new ApiError(404, 'Expense category not found');
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { category_name } = req.body;
    if (!category_name || !category_name.trim()) {
      throw new ApiError(400, 'Expense category name is mandatory', 'category_name');
    }

    const trimmed = category_name.trim();
    const existing = await expenseCategoryModel.findByName(trimmed);
    if (existing) {
      throw new ApiError(409, `Category "${trimmed}" already exists`, 'category_name');
    }

    const row = await expenseCategoryModel.create({ category_name: trimmed });
    res.status(201).json({ message: 'Expense category created successfully!', data: row });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { category_name } = req.body;
    if (!category_name || !category_name.trim()) {
      throw new ApiError(400, 'Expense category name cannot be empty', 'category_name');
    }

    const trimmed = category_name.trim();
    const existing = await expenseCategoryModel.findByName(trimmed, req.params.uid);
    if (existing) {
      throw new ApiError(409, `Another category named "${trimmed}" already exists`, 'category_name');
    }

    const row = await expenseCategoryModel.edit(req.params.uid, { category_name: trimmed });
    if (!row) throw new ApiError(404, 'Expense category not found');
    res.json({ message: 'Expense category updated successfully!', data: row });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await expenseCategoryModel.softDelete(req.params.uid);
    if (!ok) throw new ApiError(404, 'Expense category not found');
    res.status(204).send();
  } catch (err) { next(err); }
};
