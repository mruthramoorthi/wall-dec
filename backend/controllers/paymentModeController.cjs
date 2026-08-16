const paymentModeModel = require('../models/paymentModeModel.cjs');

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const search = req.query.search || req.query.q || '';
    const sortBy = req.query.sortBy || 'mode_name';
    const sortDir = req.query.sortDir || 'ASC';
    const activeOnly = req.query.activeOnly === 'true';

    if (req.query.all === 'true') {
      const data = await paymentModeModel.listAllActive();
      return res.json({ data });
    }

    const { rows, total } = await paymentModeModel.list({ pageSize, offset, search, sortBy, sortDir, activeOnly });
    res.json({ data: rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function getByUid(req, res, next) {
  try {
    const data = await paymentModeModel.findByUid(req.params.uid);
    if (!data) return res.status(404).json({ error: 'Payment mode not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await paymentModeModel.create(req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = await paymentModeModel.edit(req.params.uid, req.body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await paymentModeModel.remove(req.params.uid);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getByUid, create, update, remove };
