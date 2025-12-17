-- Add parser_type, index_mappings, and valid_flags columns to station_config table
-- This enables support for both FLAT column-based and INDEX_FLAG value-based CSV formats

USE Hydrology;

-- Add parser_type column with default
ALTER TABLE station_config
ADD COLUMN parser_type ENUM('AUTO', 'FLAT', 'INDEX_FLAG') DEFAULT 'AUTO' AFTER custom_fields;

-- Add index_mappings column (JSON columns can't have DEFAULT in MySQL)
ALTER TABLE station_config
ADD COLUMN index_mappings JSON DEFAULT NULL COMMENT 'Index number to field name mapping, e.g., {"2": "avg_surface_velocity", "7": "water_discharge"}' AFTER parser_type;

-- Add valid_flags column (JSON columns can't have DEFAULT in MySQL, so we'll set it via UPDATE)
ALTER TABLE station_config
ADD COLUMN valid_flags JSON DEFAULT NULL COMMENT 'Valid flags for INDEX_FLAG format, e.g., ["B"] for valid data' AFTER index_mappings;

-- Set default valid_flags to ["B"] for all existing rows
UPDATE station_config 
SET valid_flags = '["B"]' 
WHERE valid_flags IS NULL;

-- Update existing stations to have explicit parser_type if needed
-- Stations with column_mappings default to FLAT, others can use AUTO
UPDATE station_config 
SET parser_type = 'FLAT' 
WHERE parser_type = 'AUTO' AND column_mappings IS NOT NULL AND JSON_LENGTH(column_mappings) > 0;

