-- Migration script to create users table in Hydrology database
-- This consolidates everything into one database

USE Hydrology;

-- Create users table in Hydrology database
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) DEFAULT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role ENUM('Shift Engineer', 'Viewer', 'Admin', 'Manager', 'Corporate') NOT NULL DEFAULT 'Shift Engineer',
  status ENUM('Active', 'Non-Active', 'Pending', 'Suspended') NOT NULL DEFAULT 'Pending',
  default_password VARCHAR(255) NOT NULL DEFAULT 'cdc@123',
  new_password VARCHAR(255) DEFAULT NULL,
  confirm_password VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create user_settings table with foreign key to users
CREATE TABLE IF NOT EXISTS user_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  settings_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_settings (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add index for faster lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Migration script to copy data from cdc_user_db.users to Hydrology.users
-- Run this AFTER creating the table above
-- 
-- INSERT INTO Hydrology.users (
--   id, first_name, middle_name, last_name, email, role, status, 
--   default_password, new_password, confirm_password, created_at, updated_at
-- )
-- SELECT 
--   id, first_name, middle_name, last_name, email, role, status, 
--   default_password, new_password, confirm_password, created_at, updated_at
-- FROM cdc_user_db.users
-- ON DUPLICATE KEY UPDATE
--   first_name = VALUES(first_name),
--   middle_name = VALUES(middle_name),
--   last_name = VALUES(last_name),
--   role = VALUES(role),
--   status = VALUES(status),
--   default_password = VALUES(default_password),
--   new_password = VALUES(new_password),
--   confirm_password = VALUES(confirm_password),
--   updated_at = VALUES(updated_at);

