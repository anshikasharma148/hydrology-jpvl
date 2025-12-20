-- Complete setup script for users and user_settings in Hydrology database
-- Run this script to create both tables in one go

USE Hydrology;

-- Step 1: Create users table
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

-- Step 2: Create user_settings table with foreign key
CREATE TABLE IF NOT EXISTS user_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  settings_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_settings (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Step 3: Add index for faster lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Verification queries (uncomment to run):
-- SHOW TABLES;
-- DESCRIBE users;
-- DESCRIBE user_settings;

