-- SQL Queries to Verify Station Registration
-- Run these queries in MySQL to check if a station is properly stored

USE Hydrology;

-- 1. Check station_config table (main configuration)
SELECT 
    id,
    StationID,
    ServicesID,
    DeviceID,
    station_name,
    csv_folder_path,
    column_mappings,
    selected_fields,
    custom_fields,
    is_active,
    created_at,
    updated_at
FROM station_config
WHERE StationID = 'ST021' OR station_name = 'Ghastoli'
ORDER BY created_at DESC;

-- 2. Check master_station_db (location and basic info)
SELECT 
    StationID,
    ServicesID,
    StationName,
    Longitude,
    Latitude,
    Country,
    State,
    District,
    PinCode,
    UID
FROM master_station_db
WHERE StationID = 'ST021' OR StationName LIKE '%Ghastoli%';

-- 3. Check master_device_db (device information)
SELECT 
    DeviceID,
    DeviceName,
    StationID,
    ServicesID,
    UID,
    Quantity
FROM master_device_db
WHERE StationID = 'ST021' OR DeviceID = '31931';

-- 4. View all active stations (summary)
SELECT 
    sc.StationID,
    sc.ServicesID,
    sc.station_name,
    sc.DeviceID,
    sc.csv_folder_path,
    sc.is_active,
    ms.StationName,
    ms.Country,
    ms.State,
    ms.District,
    JSON_LENGTH(sc.selected_fields) as num_standard_fields,
    JSON_LENGTH(sc.custom_fields) as num_custom_fields
FROM station_config sc
LEFT JOIN master_station_db ms ON sc.StationID = ms.StationID AND sc.ServicesID = ms.ServicesID
WHERE sc.is_active = TRUE
ORDER BY sc.created_at DESC;

-- 5. View column mappings for a specific station (formatted)
SELECT 
    station_name,
    StationID,
    ServicesID,
    JSON_PRETTY(column_mappings) as column_mappings_formatted,
    JSON_PRETTY(selected_fields) as selected_fields_formatted,
    JSON_PRETTY(custom_fields) as custom_fields_formatted
FROM station_config
WHERE StationID = 'ST021';

