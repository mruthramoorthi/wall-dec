const roleModel = require('../models/roleModel.cjs');

exports.list = async (req, res, next) => {
  try {
    const { search, active_only, page = 1, pageSize = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const result = await roleModel.list({
      search,
      activeOnly: active_only === '1' || active_only === 'true',
      pageSize: Number(pageSize),
      offset
    });
    res.json({ data: result.rows, total: result.total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const role = await roleModel.findByUid(req.params.uid);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json({ data: role });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const role = await roleModel.create(req.body);
    res.status(201).json({ message: 'Role created successfully!', data: role });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const role = await roleModel.update(req.params.uid, req.body);
    res.json({ message: 'Role updated successfully!', data: role });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await roleModel.remove(req.params.uid);
    res.json(result);
  } catch (err) { next(err); }
};
