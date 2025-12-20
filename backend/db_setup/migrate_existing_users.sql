-- Migration script to copy all users from cdc_user_db.users to Hydrology.users
-- Run this AFTER creating the users table in Hydrology database

USE Hydrology;

-- Copy all users from cdc_user_db to Hydrology database
-- This preserves all existing user data including IDs, passwords, and timestamps
INSERT INTO Hydrology.users (
  id, 
  first_name, 
  middle_name, 
  last_name, 
  email, 
  role, 
  status, 
  default_password, 
  new_password, 
  confirm_password, 
  created_at, 
  updated_at
)
SELECT 
  id, 
  first_name, 
  middle_name, 
  last_name, 
  email, 
  role, 
  status, 
  default_password, 
  new_password, 
  confirm_password, 
  created_at, 
  updated_at
FROM cdc_user_db.users
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  middle_name = VALUES(middle_name),
  last_name = VALUES(last_name),
  role = VALUES(role),
  status = VALUES(status),
  default_password = VALUES(default_password),
  new_password = VALUES(new_password),
  confirm_password = VALUES(confirm_password),
  updated_at = VALUES(updated_at);

-- Verify the migration
SELECT COUNT(*) as total_users FROM Hydrology.users;
SELECT * FROM Hydrology.users ORDER BY id;

