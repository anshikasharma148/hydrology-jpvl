-- Add location and router/ISP columns to login_logs table
USE Hydrology;

ALTER TABLE login_logs 
ADD COLUMN location VARCHAR(255) NULL COMMENT 'City, Region, Country',
ADD COLUMN isp_name VARCHAR(255) NULL COMMENT 'ISP/Organization name',
ADD INDEX idx_location (location);

