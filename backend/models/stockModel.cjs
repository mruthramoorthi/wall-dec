const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid } = require('../utils/audit.cjs');

const TABLE = 'stock_master';
const IMAGE_STORE_DIR = path.join(__dirname, '..', '..', 'image-search-service', 'image-store');
const INDEX_PATH = path.join(__dirname, '..', '..', 'image-search-service', 'index.json');

function getHammingDistance(hex1, hex2) {
  if (!hex1 || !hex2 || hex1.length !== hex2.length) return 64;
  try {
    let x = BigInt('0x' + hex1) ^ BigInt('0x' + hex2);
    let count = 0;
    while (x > 0n) {
      if (x & 1n) count++;
      x >>= 1n;
    }
    return count;
  } catch {
    return 64;
  }
}

function getEquivalentImageFilenames(image_filename) {
  if (!image_filename) return [];
  const equivalent = new Set([image_filename]);

  const targetPath = path.join(IMAGE_STORE_DIR, image_filename);
  let targetSha = null;
  if (fs.existsSync(targetPath)) {
    try {
      targetSha = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
    } catch {
      // ignore
    }
  }

  let indexData = {};
  if (fs.existsSync(INDEX_PATH)) {
    try {
      indexData = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    } catch {
      // ignore
    }
  }

  const targetPHash = indexData[image_filename];

  if (targetPHash || targetSha) {
    for (const [fname, phash] of Object.entries(indexData)) {
      if (targetPHash && getHammingDistance(targetPHash, phash) <= 2) {
        equivalent.add(fname);
      }
    }

    if (targetSha && fs.existsSync(IMAGE_STORE_DIR)) {
      try {
        const files = fs.readdirSync(IMAGE_STORE_DIR);
        for (const fname of files) {
          if (!equivalent.has(fname)) {
            const fpath = path.join(IMAGE_STORE_DIR, fname);
            try {
              const sha = crypto.createHash('sha256').update(fs.readFileSync(fpath)).digest('hex');
              if (sha === targetSha) {
                equivalent.add(fname);
              }
            } catch {}
          }
        }
      } catch {}
    }
  }

  return Array.from(equivalent);
}

async function findByUid(uid, conn = pool) {
  const [rows] = await conn.query(
    `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function findByDesignNumber(design_number, conn = pool) {
  const [rows] = await conn.query(
    `SELECT 
       sm.uid, 
       sm.design_number, 
       sm.image_filename, 
       sm.size_uid,
       sz.width_ft,
       sz.height_ft,
       sz.thickness_mm,
       COALESCE(si_summary.total_inward_pcs, 0) AS total_inward_pcs,
       COALESCE(bi_summary.total_billed_pcs, 0) AS total_billed_pcs,
       COALESCE(pb_summary.total_prebooked_pcs, 0) AS total_prebooked_pcs,
       COALESCE(ord_summary.total_ordered_pcs, 0) AS total_ordered_pcs,
       (COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0)) AS physical_stock_pcs,
       (COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0) - COALESCE(pb_summary.total_prebooked_pcs, 0) - COALESCE(ord_summary.total_ordered_pcs, 0)) AS available_pcs,
       COALESCE(si_summary.selling_price_per_piece, sm.selling_price_per_piece, 0) AS selling_price_per_piece
     FROM ${TABLE} sm
     LEFT JOIN size_master sz ON sm.size_uid = sz.uid AND sz.delete_datetime IS NULL
     LEFT JOIN (
       SELECT 
         stock_uid,
         SUM(pieces) AS total_inward_pcs,
         MAX(selling_price_per_piece) AS selling_price_per_piece
       FROM stock_inward
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) si_summary ON sm.uid = si_summary.stock_uid
     LEFT JOIN (
       SELECT 
         stock_uid,
         SUM(pieces) AS total_billed_pcs
       FROM bill_items
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) bi_summary ON sm.uid = bi_summary.stock_uid
     LEFT JOIN (
       SELECT 
         api.stock_uid,
         SUM(api.pieces) AS total_prebooked_pcs
       FROM advance_prebook_items api
       JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
       WHERE api.delete_datetime IS NULL AND api.update_datetime IS NULL
       GROUP BY api.stock_uid
     ) pb_summary ON sm.uid = pb_summary.stock_uid
     LEFT JOIN (
       SELECT 
         oi.stock_uid,
         SUM(oi.quantity) AS total_ordered_pcs
       FROM order_items oi
       JOIN orders_master om ON om.uid = oi.order_uid 
         AND om.status IN ('Pending', 'Placed', 'Processing', 'Confirmed', 'Shipped') 
         AND om.delete_datetime IS NULL
       GROUP BY oi.stock_uid
     ) ord_summary ON sm.uid = ord_summary.stock_uid
     WHERE sm.design_number = ? AND sm.delete_datetime IS NULL
     LIMIT 1`,
    [design_number]
  );
  return rows[0] || null;
}

async function nextDesignNumber(conn = pool) {
  const [[{ maxNum }]] = await conn.query(`SELECT MAX(design_number) AS maxNum FROM ${TABLE}`);
  return (maxNum || 1000) + 1;
}

async function findByImageFilenameAndSize(image_filename, size_uid, conn = pool) {
  if (!image_filename || !size_uid) return null;
  const candidateFilenames = getEquivalentImageFilenames(image_filename);
  if (candidateFilenames.length === 0) return null;
  const [rows] = await conn.query(
    `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE image_filename IN (?) AND size_uid = ? AND ${ACTIVE_FILTER} LIMIT 1`,
    [candidateFilenames, size_uid]
  );
  return rows[0] || null;
}

async function findByDesignNumberAndSize(design_number, size_uid, conn = pool) {
  if (!design_number || !size_uid) return null;
  const [rows] = await conn.query(
    `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE design_number = ? AND size_uid = ? AND ${ACTIVE_FILTER} LIMIT 1`,
    [design_number, size_uid]
  );
  return rows[0] || null;
}

// Finds or creates the stock_master row for a given matched image filename and size.
// Per SRS / business rules: A design number is tied to (PHOTO + SIZE).
// If PHOTO matches AND SIZE matches -> reuse existing design_number.
// If PHOTO matches BUT SIZE VARIES -> create a NEW design_number.
async function findOrCreateForInward({ image_filename, gallery_images = null, size_uid }, conn = pool) {
  const galleryJson = Array.isArray(gallery_images) && gallery_images.length > 0
    ? JSON.stringify(gallery_images)
    : (typeof gallery_images === 'string' ? gallery_images : null);

  if (image_filename) {
    /* 1. Check if an existing stock item matches ANY equivalent image (same photo / phash) AND exact size_uid */
    const existingByImageAndSize = await findByImageFilenameAndSize(image_filename, size_uid, conn);
    if (existingByImageAndSize) {
      if (galleryJson) {
        await conn.query(`UPDATE ${TABLE} SET gallery_images = ? WHERE uid = ?`, [galleryJson, existingByImageAndSize.uid]);
      }
      return existingByImageAndSize;
    }

    /* 2. Check if image_filename contains a design_number suffix (e.g. -1004.jpg) AND size_uid matches */
    const match = image_filename.match(/-(\d+)(?:\.[a-zA-Z0-9]+)?$/);
    if (match) {
      const design_number = parseInt(match[1], 10);
      const existingByDesignAndSize = await findByDesignNumberAndSize(design_number, size_uid, conn);
      if (existingByDesignAndSize) {
        if (galleryJson) {
          await conn.query(`UPDATE ${TABLE} SET gallery_images = ? WHERE uid = ?`, [galleryJson, existingByDesignAndSize.uid]);
        }
        return existingByDesignAndSize;
      }
    }

    /* 3. If photo matches BUT size varies, or it is a new photo -> create a NEW design number */
    const design_number = await nextDesignNumber(conn);
    const uid = newUid();
    await conn.query(
      `INSERT INTO ${TABLE} (uid, design_number, image_filename, gallery_images, size_uid, entry_datetime) VALUES (?, ?, ?, ?, ?, NOW())`,
      [uid, design_number, image_filename, galleryJson, size_uid]
    );
    return findByUid(uid, conn);
  }

  /* 4. Fallback for stock inward entry with no image */
  const design_number = await nextDesignNumber(conn);
  const uid = newUid();
  await conn.query(
    `INSERT INTO ${TABLE} (uid, design_number, image_filename, gallery_images, size_uid, entry_datetime) VALUES (?, ?, NULL, ?, ?, NOW())`,
    [uid, design_number, galleryJson, size_uid]
  );
  return findByUid(uid, conn);
}

async function findOrCreateForHomeBill({ image_filename, design_number, size_uid }, conn = pool) {
  // 1. If design_number is provided, check if it already exists
  if (design_number) {
    const existing = await findByDesignNumber(design_number, conn);
    if (existing) return existing;
  }

  // 2. If image_filename is provided, check if it already exists in stock_master (exact or equivalent image)
  if (image_filename) {
    const candidateFilenames = getEquivalentImageFilenames(image_filename);
    if (candidateFilenames.length > 0) {
      const [existingRows] = await conn.query(
        `SELECT uid, design_number, image_filename, size_uid FROM ${TABLE} WHERE image_filename IN (?) AND ${ACTIVE_FILTER} LIMIT 1`,
        [candidateFilenames]
      );
      if (existingRows.length > 0) {
        return findByDesignNumber(existingRows[0].design_number, conn);
      }
    }
  }

  // 3. Resolve a size_uid (default to first active size in size_master or create a default 8x4x1mm size if none)
  let resolvedSizeUid = size_uid;
  if (!resolvedSizeUid) {
    const [sizes] = await conn.query(`SELECT uid FROM size_master WHERE ${ACTIVE_FILTER} ORDER BY id ASC LIMIT 1`);
    if (sizes.length > 0) {
      resolvedSizeUid = sizes[0].uid;
    } else {
      const defaultSizeUid = newUid();
      await conn.query(
        `INSERT INTO size_master (uid, width_ft, height_ft, thickness_mm, entry_datetime) VALUES (?, 8.0, 4.0, 1.0, NOW())`,
        [defaultSizeUid]
      );
      resolvedSizeUid = defaultSizeUid;
    }
  }

  // 4. Determine design number
  const finalDesignNumber = design_number ? parseInt(design_number, 10) : await nextDesignNumber(conn);
  const uid = newUid();

  await conn.query(
    `INSERT INTO ${TABLE} (uid, design_number, image_filename, size_uid, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
    [uid, finalDesignNumber, image_filename || null, resolvedSizeUid]
  );

  return findByDesignNumber(finalDesignNumber, conn);
}

async function list({ pageSize, offset }, conn = pool) {
  const [rows] = await conn.query(
    `SELECT 
       sm.uid, 
       sm.design_number, 
       sm.image_filename, 
       sm.size_uid, 
       sz.width_ft, 
       sz.height_ft, 
       sz.thickness_mm,
       COALESCE(sm.selling_price_per_piece, si_max.selling_price_per_piece, 0) AS selling_price_per_piece,
       sm.entry_datetime
     FROM ${TABLE} sm
     LEFT JOIN size_master sz ON sz.uid = sm.size_uid AND sz.delete_datetime IS NULL
     LEFT JOIN (
       SELECT stock_uid, MAX(selling_price_per_piece) AS selling_price_per_piece
       FROM stock_inward
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) si_max ON si_max.stock_uid = sm.uid
     WHERE ${ACTIVE_FILTER}
     ORDER BY sm.entry_datetime DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM ${TABLE} WHERE ${ACTIVE_FILTER}`);
  return { rows, total: count };
}

async function getCatalogList(conn = pool) {
  const [rows] = await conn.query(
    `SELECT 
       sm.uid, 
       sm.design_number, 
       sm.image_filename, 
       sm.gallery_images,
       sm.size_uid, 
       sz.width_ft, 
       sz.height_ft, 
       sz.thickness_mm,
       COALESCE(si_summary.total_inward_pcs, 0) AS total_inward_pcs,
       COALESCE(bi_summary.total_billed_pcs, 0) AS total_billed_pcs,
       COALESCE(pb_summary.total_prebooked_pcs, 0) AS total_prebooked_pcs,
       COALESCE(ord_summary.total_ordered_pcs, 0) AS total_ordered_pcs,
       (COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0)) AS physical_stock_pcs,
       (COALESCE(si_summary.total_inward_pcs, 0) - COALESCE(bi_summary.total_billed_pcs, 0) - COALESCE(pb_summary.total_prebooked_pcs, 0) - COALESCE(ord_summary.total_ordered_pcs, 0)) AS available_pcs,
       COALESCE(fb.avg_rating, 0) AS avg_rating,
       COALESCE(fb.review_count, 0) AS review_count,
       COALESCE(sm.selling_price_per_piece, si_max.selling_price_per_piece, 0) AS selling_price_per_piece,
       sm.entry_datetime
     FROM ${TABLE} sm
     LEFT JOIN size_master sz ON sz.uid = sm.size_uid AND sz.delete_datetime IS NULL
     LEFT JOIN (
       SELECT stock_uid, MAX(selling_price_per_piece) AS selling_price_per_piece
       FROM stock_inward
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) si_max ON si_max.stock_uid = sm.uid
     LEFT JOIN (
       SELECT 
         stock_uid,
         SUM(pieces) AS total_inward_pcs
       FROM stock_inward
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) si_summary ON sm.uid = si_summary.stock_uid
     LEFT JOIN (
       SELECT 
         stock_uid,
         SUM(pieces) AS total_billed_pcs
       FROM bill_items
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) bi_summary ON sm.uid = bi_summary.stock_uid
     LEFT JOIN (
       SELECT 
         api.stock_uid,
         SUM(api.pieces) AS total_prebooked_pcs
       FROM advance_prebook_items api
       JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
       WHERE api.delete_datetime IS NULL AND api.update_datetime IS NULL
       GROUP BY api.stock_uid
     ) pb_summary ON sm.uid = pb_summary.stock_uid
     LEFT JOIN (
       SELECT 
         oi.stock_uid,
         SUM(oi.quantity) AS total_ordered_pcs
       FROM order_items oi
       JOIN orders_master om ON om.uid = oi.order_uid 
         AND om.status IN ('Pending', 'Placed', 'Processing', 'Confirmed', 'Shipped') 
         AND om.delete_datetime IS NULL
       GROUP BY oi.stock_uid
     ) ord_summary ON sm.uid = ord_summary.stock_uid
     LEFT JOIN (
       SELECT 
         stock_uid,
         AVG(rating) AS avg_rating,
         COUNT(*) AS review_count
       FROM product_feedback
       WHERE delete_datetime IS NULL
       GROUP BY stock_uid
     ) fb ON fb.stock_uid = sm.uid
     WHERE sm.delete_datetime IS NULL
       AND COALESCE(sm.selling_price_per_piece, si_max.selling_price_per_piece, 0) > 0
     ORDER BY sm.entry_datetime DESC`
  );

  // Collect all images for the same design numbers across the catalog
  let allDesignImages = [];
  try {
    const [dImgs] = await conn.query(
      `SELECT design_number, image_filename, gallery_images FROM ${TABLE} WHERE delete_datetime IS NULL`
    );
    allDesignImages = dImgs;
  } catch (e) {
    allDesignImages = [];
  }

  const designImageMap = {};
  for (const item of allDesignImages) {
    if (!designImageMap[item.design_number]) {
      designImageMap[item.design_number] = new Set();
    }
    if (item.image_filename) {
      designImageMap[item.design_number].add(item.image_filename);
    }
    if (item.gallery_images) {
      try {
        const parsed = typeof item.gallery_images === 'string' ? JSON.parse(item.gallery_images) : item.gallery_images;
        if (Array.isArray(parsed)) {
          parsed.forEach(img => { if (img) designImageMap[item.design_number].add(img); });
        }
      } catch {}
    }
  }

  return rows.map(r => {
    const imagesSet = new Set();
    if (r.image_filename) imagesSet.add(r.image_filename);
    if (r.gallery_images) {
      try {
        const parsed = typeof r.gallery_images === 'string' ? JSON.parse(r.gallery_images) : r.gallery_images;
        if (Array.isArray(parsed)) {
          parsed.forEach(img => { if (img) imagesSet.add(img); });
        }
      } catch {}
    }
    if (designImageMap[r.design_number]) {
      designImageMap[r.design_number].forEach(img => imagesSet.add(img));
    }

    const imagesList = Array.from(imagesSet);

    return {
      ...r,
      available_pcs: Number(r.available_pcs || 0),
      physical_stock_pcs: Number(r.physical_stock_pcs || 0),
      total_inward_pcs: Number(r.total_inward_pcs || 0),
      total_billed_pcs: Number(r.total_billed_pcs || 0),
      avg_rating: Number(r.avg_rating || 0).toFixed(1),
      review_count: Number(r.review_count || 0),
      images: imagesList.length > 0 ? imagesList : (r.image_filename ? [r.image_filename] : [])
    };
  });
}

module.exports = { findByUid, findByDesignNumber, findByImageFilenameAndSize, findByDesignNumberAndSize, findOrCreateForInward, findOrCreateForHomeBill, list, getCatalogList, getEquivalentImageFilenames };
