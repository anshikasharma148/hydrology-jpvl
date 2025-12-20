-- Create user_settings table in Hydrology database
-- NOTE: This version does NOT have a foreign key constraint because the users table is in cdc_user_db
-- If you want foreign key constraints, use the cdc_user_db version instead

USE Hydrology;

CREATE TABLE IF NOT EXISTS user_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  settings_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_settings (user_id)
);

-- Add index for faster lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

