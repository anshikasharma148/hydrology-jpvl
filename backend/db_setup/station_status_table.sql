-- Create station_status table for manual status management
-- This table stores admin-set statuses for stations (Live, Offline, Under Maintenance)

CREATE TABLE IF NOT EXISTS station_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station_id VARCHAR(20) NOT NULL,
  service_type ENUM('AWS', 'EWS') NOT NULL,
  status ENUM('live', 'offline', 'maintenance') NOT NULL,
  status_timestamp DATETIME NULL COMMENT 'Timestamp when status was set to offline',
  notes TEXT NULL COMMENT 'Optional notes about the status',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_station_service (station_id, service_type),
  INDEX idx_station_id (station_id),
  INDEX idx_service_type (service_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

