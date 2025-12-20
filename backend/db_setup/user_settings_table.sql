-- Create user_settings table for storing user preferences
-- This table stores settings that sync across devices for each user
-- NOTE: This table is in Hydrology database (users table is also in Hydrology)

USE Hydrology;

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
