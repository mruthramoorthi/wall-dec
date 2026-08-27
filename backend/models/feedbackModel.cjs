const pool = require('../config/db.cjs');
const { newUid } = require('../utils/audit.cjs');

// Add Rating & Feedback
async function addFeedback({ userUid, orderUid, stockUid, rating, reviewTitle, comment }) {
  if (!rating || rating < 1 || rating > 5) {
    throw Object.assign(new Error('Rating must be an integer between 1 and 5.'), { status: 422 });
  }
  if (!stockUid) {
    throw Object.assign(new Error('Stock item ID is required.'), { status: 400 });
  }

  let finalOrderUid = orderUid;
  let finalUserUid = userUid;

  // 1. If explicit order UID provided (and not a direct review), verify delivered status
  if (finalOrderUid && finalOrderUid !== 'DIRECT_CATALOG_REVIEW') {
    const [[order]] = await pool.query(
      `SELECT uid, status FROM orders_master 
       WHERE uid = ? AND customer_user_uid = ? AND delete_datetime IS NULL`,
      [finalOrderUid, finalUserUid]
    );

    if (!order) {
      throw Object.assign(new Error('Order verification failed. You can only review purchases linked to your account.'), { status: 403 });
    }

    if (order.status !== 'Delivered') {
      throw Object.assign(new Error('Feedback and ratings can only be submitted after the order has been marked as Delivered.'), { status: 400 });
    }

    const [[item]] = await pool.query(
      `SELECT id FROM order_items WHERE order_uid = ? AND stock_uid = ?`,
      [finalOrderUid, stockUid]
    );
    if (!item) {
      throw Object.assign(new Error('Product not found in this order.'), { status: 404 });
    }
  } else {
    // Direct review from catalog
    finalOrderUid = newUid();
    if (!finalUserUid) {
      // Check if default user exists, or generate guest user uid
      const [[adminUser]] = await pool.query(`SELECT uid FROM user_master WHERE delete_datetime IS NULL LIMIT 1`);
      finalUserUid = adminUser ? adminUser.uid : newUid();
    }
  }

  const feedbackUid = newUid();

  // Upsert feedback
  await pool.query(
    `INSERT INTO product_feedback (uid, order_uid, stock_uid, user_uid, rating, review_title, comment, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
       rating = VALUES(rating),
       review_title = VALUES(review_title),
       comment = VALUES(comment),
       update_datetime = NOW()`,
    [feedbackUid, finalOrderUid, stockUid, finalUserUid, rating, reviewTitle || null, comment || null]
  );

  return { success: true, message: 'Thank you! Your review has been saved.' };
}

// Get Product Ratings and Feedback summary
async function getProductReviews(stockUid) {
  let stockUids = [stockUid];
  try {
    const [sRows] = await pool.query(
      `SELECT uid FROM stock_master WHERE design_number = (SELECT design_number FROM stock_master WHERE uid = ? LIMIT 1) AND delete_datetime IS NULL`,
      [stockUid]
    );
    if (sRows && sRows.length > 0) {
      stockUids = sRows.map(r => r.uid);
    }
  } catch {}

  const [reviews] = await pool.query(
    `SELECT pf.*, 
       COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.username, 'Customer') AS author_name,
       u.username
     FROM product_feedback pf
     LEFT JOIN user_master u ON pf.user_uid = u.uid
     WHERE pf.stock_uid IN (?) AND pf.delete_datetime IS NULL
     ORDER BY pf.entry_datetime DESC`,
    [stockUids]
  );

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS total_reviews, COALESCE(AVG(rating), 0) AS average_rating
     FROM product_feedback 
     WHERE stock_uid IN (?) AND delete_datetime IS NULL`,
    [stockUids]
  );

  return {
    averageRating: Number(summary?.average_rating || 0).toFixed(1),
    totalReviews: Number(summary?.total_reviews || 0),
    reviews
  };
}

module.exports = {
  addFeedback,
  getProductReviews
};
