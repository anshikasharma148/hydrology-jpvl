-- Create station_config table for dynamic station management
-- This table stores station configuration including CSV paths, column mappings, and custom fields

USE Hydrology;

CREATE TABLE IF NOT EXISTS station_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  StationID VARCHAR(20) NOT NULL,
  ServicesID VARCHAR(20) NOT NULL,
  DeviceID VARCHAR(20) NOT NULL,
  station_name VARCHAR(100) NOT NULL,
  csv_folder_path VARCHAR(255) NOT NULL COMMENT 'Path to CSV folder, e.g., /Hydrology_Backup/Vasudhara_AWS',
  column_mappings JSON NOT NULL COMMENT '{"A": "temperature", "B": "pressure", "C": "humidity", ...}',
  selected_fields JSON NOT NULL COMMENT '["temperature", "pressure", "humidity", "windspeed", ...]',
  custom_fields JSON DEFAULT NULL COMMENT '[{"name": "custom_field", "type": "DECIMAL(10,2)", "column": "D"}]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_station_service (StationID, ServicesID),
  INDEX idx_station_id (StationID),
  INDEX idx_service_id (ServicesID),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (StationID, ServicesID) REFERENCES master_station_db(StationID, ServicesID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

