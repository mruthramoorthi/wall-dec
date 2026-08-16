const employeeModel = require('../models/employeeModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { search = '' } = req.query;
    const { rows, total } = await employeeModel.list({ pageSize, offset, search });
    res.json({ data: rows, page, pageSize, total });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await employeeModel.findByUid(req.params.uid);
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { employee_name, mobile_number } = req.body;
    if (!employee_name?.trim()) return res.status(400).json({ error: 'employee_name is required' });
    if (!/^\d{10}$/.test(mobile_number?.trim())) return res.status(400).json({ error: 'mobile_number must be 10 digits' });
    const row = await employeeModel.create(req.body);
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { employee_name, mobile_number } = req.body;
    if (!employee_name?.trim()) return res.status(400).json({ error: 'employee_name is required' });
    if (!/^\d{10}$/.test(mobile_number?.trim())) return res.status(400).json({ error: 'mobile_number must be 10 digits' });
    const row = await employeeModel.edit(req.params.uid, req.body);
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await employeeModel.softDelete(req.params.uid);
    res.status(204).send();
  } catch (err) { next(err); }
};
