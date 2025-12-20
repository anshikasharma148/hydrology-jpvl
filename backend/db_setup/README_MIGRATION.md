# Migration Guide: Moving Users Table to Hydrology Database

This guide will help you consolidate your database structure by moving the `users` table from `cdc_user_db` to `Hydrology` database.

## Step 1: Create Users Table in Hydrology Database

Run this SQL script in your MySQL client:

```sql
USE Hydrology;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) DEFAULT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role ENUM('Shift Engineer', 'Viewer', 'Admin', 'Manager', 'Corporate') NOT NULL DEFAULT 'Shift Engineer',
  status ENUM('Active', 'Non-Active', 'Pending', 'Suspended') NOT NULL DEFAULT 'Pending',
  default_password VARCHAR(255) NOT NULL DEFAULT 'cdc@123',
  new_password VARCHAR(255) DEFAULT NULL,
  confirm_password VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Step 2: Migrate Existing User Data (if you have existing users)

If you have existing users in `cdc_user_db.users`, migrate them:

```sql
INSERT INTO Hydrology.users (
  id, first_name, middle_name, last_name, email, role, status, 
  default_password, new_password, confirm_password, created_at, updated_at
)
SELECT 
  id, first_name, middle_name, last_name, email, role, status, 
  default_password, new_password, confirm_password, created_at, updated_at
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
```

## Step 3: Create user_settings Table

```sql
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

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

## Step 4: Update Backend Code

The backend code has already been updated to use `Hydrology` database for users. The `db.js` file now points `usersDB` to the `Hydrology` database.

## Step 5: Restart Backend Server

After making these changes, restart your backend server:

```bash
cd backend
npm start
# or
node index.js
```

## Step 6: Verify

1. Test user login - should work with users in Hydrology database
2. Test settings - should save/load from Hydrology database
3. Check that all existing functionality still works

## Rollback (if needed)

If you need to rollback, you can:
1. Revert the `db.js` change to point back to `cdc_user_db`
2. Keep both databases and update code to use the appropriate one

## Notes

- The `cdc_user_db` database can be kept for backup/reference
- All new users will be created in `Hydrology.users`
- Settings will be stored in `Hydrology.user_settings`
- Foreign key constraints now work properly since everything is in one database

