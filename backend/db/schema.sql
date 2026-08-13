-- Inventory ERP schema (MySQL 8)
CREATE DATABASE IF NOT EXISTS inventory_erp CHARACTER SET utf8mb4;
USE inventory_erp;

CREATE TABLE IF NOT EXISTS size_master (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  width_ft DECIMAL(8,2) NOT NULL,
  height_ft DECIMAL(8,2) NOT NULL,
  thickness_mm DECIMAL(8,2) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_active (update_datetime, delete_datetime)
);

CREATE TABLE IF NOT EXISTS dealer_master (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  dealer_name VARCHAR(100) NOT NULL,
  dealer_code CHAR(5) NOT NULL,
  mobile_number CHAR(10) NOT NULL,
  gstin VARCHAR(15) NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_active (update_datetime, delete_datetime)
);

CREATE TABLE IF NOT EXISTS stock_master (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  design_number INT NOT NULL,
  image_filename VARCHAR(255) NULL,
  size_uid CHAR(36) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_design_number (design_number),
  INDEX idx_active (update_datetime, delete_datetime)
);

CREATE TABLE IF NOT EXISTS stock_inward (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  is_opening TINYINT(1) NOT NULL DEFAULT 0,
  dealer_uid CHAR(36) NULL,
  stock_uid CHAR(36) NOT NULL,
  size_uid CHAR(36) NOT NULL,
  pieces INT NOT NULL,
  avg_total_rate DECIMAL(12,2) NOT NULL,
  avg_rate_per_piece DECIMAL(12,2) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_dealer (dealer_uid),
  INDEX idx_stock (stock_uid),
  INDEX idx_active (update_datetime, delete_datetime)
);

CREATE TABLE IF NOT EXISTS customer_master (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  mobile_number CHAR(10) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_mobile (mobile_number),
  INDEX idx_active (update_datetime, delete_datetime)
);

CREATE TABLE IF NOT EXISTS bill_master (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  customer_uid CHAR(36) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_customer (customer_uid),
  INDEX idx_active (update_datetime, delete_datetime)
);

CREATE TABLE IF NOT EXISTS bill_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  bill_uid CHAR(36) NOT NULL,
  stock_uid CHAR(36) NOT NULL,
  pieces INT NOT NULL,
  rate_per_piece DECIMAL(12,2) NOT NULL,
  line_amount DECIMAL(12,2) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_bill (bill_uid),
  INDEX idx_active (update_datetime, delete_datetime)
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid CHAR(36) NOT NULL,
  bill_uid CHAR(36) NOT NULL,
  payment_mode VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_datetime DATETIME NULL,
  delete_datetime DATETIME NULL,
  INDEX idx_uid (uid),
  INDEX idx_bill (bill_uid),
  INDEX idx_active (update_datetime, delete_datetime)
);
