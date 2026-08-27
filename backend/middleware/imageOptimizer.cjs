const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGE_STORE = path.join(__dirname, '..', '..', 'image-search-service', 'image-store');
const CACHE_DIR = path.join(IMAGE_STORE, '.cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn('[ImageOptimizer] Could not create cache directory:', err.message);
  }
}

async function serveOptimizedImage(req, res, next) {
  try {
    const rawFilename = req.params[0] || req.params.filename;
    if (!rawFilename) return next();

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(rawFilename);
    const originalPath = path.join(IMAGE_STORE, safeFilename);

    if (!fs.existsSync(originalPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const stat = fs.statSync(originalPath);
    if (!stat.isFile()) {
      return res.status(404).json({ error: 'Not a valid file' });
    }

    // Parse query parameters
    const widthParam = parseInt(req.query.w, 10);
    const heightParam = parseInt(req.query.h, 10);
    const qualityParam = parseInt(req.query.q, 10);
    const targetWidth = (!isNaN(widthParam) && widthParam > 0 && widthParam <= 3840) ? widthParam : null;
    const targetHeight = (!isNaN(heightParam) && heightParam > 0 && heightParam <= 3840) ? heightParam : null;
    const quality = (!isNaN(qualityParam) && qualityParam >= 30 && qualityParam <= 100) ? qualityParam : 80;

    // Check if client accepts WebP
    const acceptsWebP = req.headers.accept && req.headers.accept.includes('image/webp');
    const forceWebP = req.query.format === 'webp' || acceptsWebP;

    // If no transformation or format conversion is needed, serve original
    if (!targetWidth && !targetHeight && !forceWebP) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(originalPath);
    }

    // Build unique cache filename based on original file modification time and query params
    const cacheKey = `opt_${safeFilename}_w${targetWidth || 'orig'}_h${targetHeight || 'orig'}_q${quality}_mtime${stat.mtimeMs}.webp`;
    const cachedFilePath = path.join(CACHE_DIR, cacheKey);

    // If cached version already exists, stream directly
    if (fs.existsSync(cachedFilePath)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(cachedFilePath).pipe(res);
    }

    // Process on-the-fly with Sharp
    let pipeline = sharp(originalPath, { failOn: 'none' }).rotate(); // Auto-rotate by EXIF

    if (targetWidth || targetHeight) {
      pipeline = pipeline.resize(targetWidth || null, targetHeight || null, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    pipeline = pipeline.webp({ quality, effort: 4 });

    // Save to cache file asynchronously, while streaming output to response
    const buffer = await pipeline.toBuffer();

    fs.writeFile(cachedFilePath, buffer, (err) => {
      if (err) console.warn('[ImageOptimizer] Failed writing cache:', err.message);
    });

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (err) {
    console.error('[ImageOptimizer] Error processing image:', err.message);
    // Fallback: serve original if exists
    const fallbackPath = path.join(IMAGE_STORE, path.basename(req.params[0] || req.params.filename || ''));
    if (fs.existsSync(fallbackPath)) {
      return res.sendFile(fallbackPath);
    }
    next(err);
  }
}

module.exports = {
  serveOptimizedImage
};
