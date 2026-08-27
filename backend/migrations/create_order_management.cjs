const pool = require('../config/db.cjs');

async function runMigration() {
  try {
    console.log('Running Order Management & Role Schema Migration...');

    // 1. Check and add role to user_master
    const [userCols] = await pool.query('DESCRIBE user_master');
    const userColNames = userCols.map(c => c.Field);
    if (!userColNames.includes('role')) {
      await pool.query("ALTER TABLE user_master ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'customer' AFTER role_position");
      console.log('✓ Added role column to user_master');
    }

    // 2. Create orders_master
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders_master (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        uid CHAR(36) NOT NULL UNIQUE,
        order_number VARCHAR(30) NOT NULL UNIQUE,
        customer_user_uid CHAR(36) NOT NULL,
        shipping_name VARCHAR(120) NOT NULL,
        shipping_phone VARCHAR(20) NOT NULL,
        shipping_email VARCHAR(150) NULL,
        shipping_address TEXT NOT NULL,
        shipping_city VARCHAR(100) NOT NULL,
        shipping_state VARCHAR(100) NOT NULL,
        shipping_pincode VARCHAR(20) NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        net_amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'COD',
        payment_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        shipment_number VARCHAR(100) NULL,
        courier_details VARCHAR(150) NULL,
        shipped_at DATETIME NULL,
        delivered_at DATETIME NULL,
        notes TEXT NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        INDEX idx_customer (customer_user_uid),
        INDEX idx_status (status),
        INDEX idx_entry (entry_datetime)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Created orders_master table');

    // 3. Create order_items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        uid CHAR(36) NOT NULL UNIQUE,
        order_uid CHAR(36) NOT NULL,
        stock_uid CHAR(36) NOT NULL,
        design_number INT NOT NULL,
        image_filename VARCHAR(255) NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order (order_uid),
        INDEX idx_stock (stock_uid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Created order_items table');

    // 4. Create product_feedback
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_feedback (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        uid CHAR(36) NOT NULL UNIQUE,
        order_uid CHAR(36) NOT NULL,
        stock_uid CHAR(36) NOT NULL,
        user_uid CHAR(36) NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_title VARCHAR(150) NULL,
        comment TEXT NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        UNIQUE KEY uq_order_product_user (order_uid, stock_uid, user_uid),
        INDEX idx_stock_rating (stock_uid),
        INDEX idx_user_rating (user_uid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Created product_feedback table');

    // 5. Add screen_master entries for Order Management if screen_master exists
    try {
      const [[orderScreen]] = await pool.query("SELECT id FROM screen_master WHERE screen_key = 'orders_admin'");
      if (!orderScreen) {
        const { newUid } = require('../utils/audit.cjs');
        await pool.query(`
          INSERT INTO screen_master (uid, screen_key, screen_name, icon, route_path, category, display_order, is_active, is_admin_only, entry_datetime)
          VALUES (?, 'orders_admin', 'Order Management', '📦', '/admin-orders', 'Management', 10, 1, 0, NOW())
        `, [newUid()]);
        console.log('✓ Added orders_admin to screen_master');
      }
    } catch (e) {
      console.log('Screen master check/skipped:', e.message);
    }

    console.log('All migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
