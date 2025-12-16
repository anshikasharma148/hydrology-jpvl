-- Create login_logs table in Hydrology database
USE Hydrology;

CREATE TABLE IF NOT EXISTS login_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL COMMENT 'IPv4 or IPv6 address',
  login_type ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  login_status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  login_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_email (email),
  INDEX idx_login_timestamp (login_timestamp),
  INDEX idx_ip_address (ip_address),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

