const bankModel = require('../models/bankModel.cjs');

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const search = req.query.search || req.query.q || '';
    const sortBy = req.query.sortBy || 'bank_name';
    const sortDir = req.query.sortDir || 'ASC';

    if (req.query.all === 'true') {
      const data = await bankModel.listAllActive();
      return res.json({ data });
    }

    const { rows, total } = await bankModel.list({ pageSize, offset, search, sortBy, sortDir });
    res.json({ data: rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function getByUid(req, res, next) {
  try {
    const data = await bankModel.findByUid(req.params.uid);
    if (!data) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await bankModel.create(req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = await bankModel.edit(req.params.uid, req.body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await bankModel.remove(req.params.uid);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getByUid, create, update, remove };
