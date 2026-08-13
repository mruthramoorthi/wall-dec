const fetch = require('node-fetch');
const FormData = require('form-data');
const stockModel = require('../models/stockModel.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

const IMAGE_SEARCH_URL = process.env.IMAGE_SEARCH_SERVICE_URL || 'http://localhost:8000';

// Proxies the captured image to the Python vector-search service. Degrades to
// an empty match list on any failure/timeout (per SRS section 7) instead of
// erroring out — Stock Inward / Billing must never be blocked by the image
// service being down.
exports.imageSearch = async (req, res) => {
  try {
    if (!req.file) return res.json({ matches: [] });
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname || 'capture.jpg' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${IMAGE_SEARCH_URL}/search`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return res.json({ matches: [] });
    const matches = await response.json();
    res.json({ matches });
  } catch (err) {
    console.error('image-search proxy failed, degrading to no matches:', err.message);
    res.json({ matches: [] });
  }
};

exports.byDesignNumber = async (req, res, next) => {
  try {
    const stock = await stockModel.findByDesignNumber(req.params.design_number);
    if (!stock) throw new ApiError(404, 'No stock found for that design number');
    res.json({ data: stock });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { rows, total } = await stockModel.list({ pageSize, offset });
    res.json({ data: rows, page, pageSize, total });
  } catch (err) { next(err); }
};
