const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');
const stockModel = require('../models/stockModel.cjs');
const pool = require('../config/db.cjs');
const { parsePagination } = require('../utils/pagination.cjs');
const { ApiError } = require('../middleware/errorHandler.cjs');

const IMAGE_SEARCH_URL = process.env.IMAGE_SEARCH_SERVICE_URL || 'http://localhost:8000';
const IMAGE_STORE_DIR = path.join(__dirname, '..', '..', 'image-search-service', 'image-store');

async function refreshImageIndex() {
  try {
    const response = await fetch(`${IMAGE_SEARCH_URL}/reindex`, { method: 'POST' });
    if (!response.ok) console.warn('image index refresh failed', response.status);
  } catch (err) {
    console.warn('image index refresh skipped:', err.message);
  }
}

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
    const rawMatches = await response.json();

    if (rawMatches && rawMatches.length > 0) {
      const filenames = rawMatches.map((m) => m.filename);
      const [stockRows] = await pool.query(
        `SELECT image_filename, design_number FROM stock_master WHERE image_filename IN (?) AND delete_datetime IS NULL ORDER BY id ASC`,
        [filenames]
      );

      const designMap = {};
      for (const r of stockRows) {
        if (!designMap[r.image_filename]) {
          designMap[r.image_filename] = [];
        }
        if (!designMap[r.image_filename].includes(r.design_number)) {
          designMap[r.image_filename].push(r.design_number);
        }
      }

      const matches = [];
      for (const m of rawMatches) {
        const designNums = designMap[m.filename];
        if (designNums && designNums.length > 0) {
          for (const dNum of designNums) {
            matches.push({
              ...m,
              design_number: dNum,
              design_label: `${dNum}`,
            });
          }
        }
      }

      return res.json({ matches });
    }

    res.json({ matches: [] });
  } catch (err) {
    console.error('image-search proxy failed, degrading to no matches:', err.message);
    res.json({ matches: [] });
  }
};

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, 'File is required', 'file');
    fs.mkdirSync(IMAGE_STORE_DIR, { recursive: true });

    // Deduplicate exact same file bytes if already present in store
    const uploadSha = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    try {
      const existingFiles = fs.readdirSync(IMAGE_STORE_DIR);
      for (const f of existingFiles) {
        try {
          const fpath = path.join(IMAGE_STORE_DIR, f);
          const fSha = crypto.createHash('sha256').update(fs.readFileSync(fpath)).digest('hex');
          if (fSha === uploadSha) {
            return res.json({ data: { filename: f } });
          }
        } catch {}
      }
    } catch {}

    const ext = path.extname(req.file.originalname || 'new-design.jpg') || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
    const filename = `new-design-${Date.now()}-${Math.round(Math.random() * 100000)}${safeExt}`;
    const filePath = path.join(IMAGE_STORE_DIR, filename);

    fs.writeFileSync(filePath, req.file.buffer);
    await refreshImageIndex();
    res.json({ data: { filename } });
  } catch (err) {
    next(err);
  }
};

exports.byDesignNumber = async (req, res, next) => {
  try {
    const stock = await stockModel.findByDesignNumber(req.params.design_number);
    if (!stock) throw new ApiError(404, 'No stock found for that design number');
    res.json({ data: stock });
  } catch (err) { next(err); }
};

exports.ensureHomeBillStock = async (req, res, next) => {
  try {
    const { image_filename, design_number, size_uid } = req.body || {};
    const stock = await stockModel.findOrCreateForHomeBill({ image_filename, design_number, size_uid });
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

exports.getCatalogList = async (req, res, next) => {
  try {
    const rows = await stockModel.getCatalogList();
    res.json({ data: rows });
  } catch (err) { next(err); }
};

