-- Migration script to add existing hardcoded stations to station_config table
-- Run this after creating the station_config table

USE Hydrology;

-- AWS Stations
-- Note: Column mappings are estimated based on typical CSV structure
-- You may need to adjust these based on actual CSV files

-- 1. Lambagad/Barrage (ST015, AWS)
INSERT INTO station_config (
    StationID, ServicesID, DeviceID, station_name, csv_folder_path,
    column_mappings, selected_fields, custom_fields, is_active
) VALUES (
    'ST015', 'AWS', '31928', 'Barrage',
    '/Hydrology_Backup/Lambagad_AWS',
    JSON_OBJECT(
        'A', 'timestamp',
        'D', 'temperature',
        'E', 'windspeed',
        'F', 'winddirection',
        'G', 'rain',
        'H', 'relative_humidity',
        'I', 'pressure',
        'J', 'PIR',
        'K', 'avg_PIR',
        'L', 'bucket_weight',
        'M', 'precipitation'
    ),
    JSON_ARRAY('windspeed', 'winddirection', 'temperature', 'relative_humidity', 'pressure', 'PIR', 'avg_PIR', 'bucket_weight', 'precipitation', 'rain'),
    NULL,
    TRUE
)
ON DUPLICATE KEY UPDATE
    station_name = VALUES(station_name),
    csv_folder_path = VALUES(csv_folder_path),
    column_mappings = VALUES(column_mappings),
    selected_fields = VALUES(selected_fields);

-- 2. Mana (ST019, AWS)
INSERT INTO station_config (
    StationID, ServicesID, DeviceID, station_name, csv_folder_path,
    column_mappings, selected_fields, custom_fields, is_active
) VALUES (
    'ST019', 'AWS', '31929', 'Mana',
    '/Hydrology_Backup/Mana_AWS',
    JSON_OBJECT(
        'A', 'timestamp',
        'D', 'temperature',
        'E', 'windspeed',
        'F', 'winddirection',
        'G', 'rain',
        'H', 'relative_humidity',
        'I', 'pressure',
        'J', 'PIR',
        'K', 'avg_PIR',
        'L', 'bucket_weight',
        'M', 'precipitation'
    ),
    JSON_ARRAY('windspeed', 'winddirection', 'temperature', 'relative_humidity', 'pressure', 'PIR', 'avg_PIR', 'bucket_weight', 'precipitation', 'rain'),
    NULL,
    TRUE
)
ON DUPLICATE KEY UPDATE
    station_name = VALUES(station_name),
    csv_folder_path = VALUES(csv_folder_path),
    column_mappings = VALUES(column_mappings),
    selected_fields = VALUES(selected_fields);

-- 3. Vasudhara (ST020, AWS)
INSERT INTO station_config (
    StationID, ServicesID, DeviceID, station_name, csv_folder_path,
    column_mappings, selected_fields, custom_fields, is_active
) VALUES (
    'ST020', 'AWS', '31930', 'Vasudhara',
    '/Hydrology_Backup/Vasudhara_AWS',
    JSON_OBJECT(
        'A', 'timestamp',
        'D', 'temperature',
        'E', 'windspeed',
        'F', 'winddirection',
        'G', 'rain',
        'H', 'relative_humidity',
        'I', 'pressure',
        'J', 'PIR',
        'K', 'avg_PIR',
        'L', 'bucket_weight',
        'M', 'precipitation'
    ),
    JSON_ARRAY('windspeed', 'winddirection', 'temperature', 'relative_humidity', 'pressure', 'PIR', 'avg_PIR', 'bucket_weight', 'precipitation', 'rain'),
    NULL,
    TRUE
)
ON DUPLICATE KEY UPDATE
    station_name = VALUES(station_name),
    csv_folder_path = VALUES(csv_folder_path),
    column_mappings = VALUES(column_mappings),
    selected_fields = VALUES(selected_fields);

-- EWS Stations

-- 4. Vasudhara (ST020, EWS)
INSERT INTO station_config (
    StationID, ServicesID, DeviceID, station_name, csv_folder_path,
    column_mappings, selected_fields, custom_fields, is_active
) VALUES (
    'ST020', 'EWS', '32930', 'Vasudhara',
    '/Hydrology/Vasudhara_EWS',
    JSON_OBJECT(
        'A', 'timestamp',
        'K', 'surface_velocity',
        'B', 'avg_surface_velocity',
        'C', 'water_dist_sensor',
        'D', 'water_level',
        'E', 'water_discharge',
        'F', 'tilt_angle',
        'G', 'flow_direction',
        'H', 'SNR',
        'I', 'internal_temperature',
        'J', 'charge_current',
        'L', 'observed_current',
        'M', 'battery_voltage',
        'N', 'solar_panel_tracking'
    ),
    JSON_ARRAY('surface_velocity', 'SNR', 'avg_surface_velocity', 'water_dist_sensor', 'water_level', 'water_discharge', 'tilt_angle', 'flow_direction', 'internal_temperature', 'charge_current', 'observed_current', 'battery_voltage', 'solar_panel_tracking'),
    NULL,
    TRUE
)
ON DUPLICATE KEY UPDATE
    station_name = VALUES(station_name),
    csv_folder_path = VALUES(csv_folder_path),
    column_mappings = VALUES(column_mappings),
    selected_fields = VALUES(selected_fields);

-- 5. Mana (ST019, EWS)
INSERT INTO station_config (
    StationID, ServicesID, DeviceID, station_name, csv_folder_path,
    column_mappings, selected_fields, custom_fields, is_active
) VALUES (
    'ST019', 'EWS', '32929', 'Mana',
    '/Hydrology_Backup/Mana_EWS',
    JSON_OBJECT(
        'A', 'timestamp',
        'K', 'surface_velocity',
        'B', 'avg_surface_velocity',
        'C', 'water_dist_sensor',
        'D', 'water_level',
        'E', 'water_discharge',
        'F', 'tilt_angle',
        'G', 'flow_direction',
        'H', 'SNR',
        'I', 'internal_temperature',
        'J', 'charge_current',
        'L', 'observed_current',
        'M', 'battery_voltage',
        'N', 'solar_panel_tracking'
    ),
    JSON_ARRAY('surface_velocity', 'SNR', 'avg_surface_velocity', 'water_dist_sensor', 'water_level', 'water_discharge', 'tilt_angle', 'flow_direction', 'internal_temperature', 'charge_current', 'observed_current', 'battery_voltage', 'solar_panel_tracking'),
    NULL,
    TRUE
)
ON DUPLICATE KEY UPDATE
    station_name = VALUES(station_name),
    csv_folder_path = VALUES(csv_folder_path),
    column_mappings = VALUES(column_mappings),
    selected_fields = VALUES(selected_fields);

-- Verify the migration
SELECT 
    StationID,
    ServicesID,
    station_name,
    DeviceID,
    csv_folder_path,
    is_active,
    created_at
FROM station_config
ORDER BY ServicesID, station_name;

