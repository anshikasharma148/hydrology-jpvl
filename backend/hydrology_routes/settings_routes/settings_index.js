/**
 * Settings Routes
 * Handles user settings (GET/PUT) with authentication
 */

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { hydrologyDB } = require("../../db");

// Use hydrologyDB for users (since users table is now in Hydrology database)
const usersDB = hydrologyDB;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Default settings structure
const getDefaultSettings = () => ({
  refreshInterval: 10000, // milliseconds
  timezone: "UTC",
  dateFormat: "DD MMM YYYY",
  timeFormat: "12h", // '12h' or '24h'
  decimalPrecision: 2,
  temperatureUnit: "celsius", // 'celsius' or 'fahrenheit'
  distanceUnit: "meters", // 'meters' or 'feet'
  speedUnit: "mps", // 'mps', 'kmph', 'mph'
  visibleStations: [], // array of station IDs to show
  mapSettings: {
    defaultZoom: 8,
    defaultCenter: [30.7, 79.5], // Badrinath area
    mapStyle: "standard", // 'standard', 'satellite', 'terrain'
  },
  graphDefaults: {
    timeRange: "24h", // '1h', '6h', '24h', '7d', '30d'
    updateFrequency: 10000,
  },
});

/**
 * GET /api/settings
 * Fetch user settings from database
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    // Check if user_settings table exists in usersDB
    const [rows] = await usersDB.query(
      `SELECT settings_json FROM user_settings WHERE user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      // No settings found, return defaults
      return res.json({
        success: true,
        data: getDefaultSettings(),
        isDefault: true,
      });
    }

    // Parse JSON settings
    const settings = typeof rows[0].settings_json === "string"
      ? JSON.parse(rows[0].settings_json)
      : rows[0].settings_json;

    // Merge with defaults to ensure all fields exist
    const mergedSettings = {
      ...getDefaultSettings(),
      ...settings,
      mapSettings: {
        ...getDefaultSettings().mapSettings,
        ...(settings.mapSettings || {}),
      },
      graphDefaults: {
        ...getDefaultSettings().graphDefaults,
        ...(settings.graphDefaults || {}),
      },
    };

    res.json({
      success: true,
      data: mergedSettings,
      isDefault: false,
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch settings",
      message: error.message,
    });
  }
});

/**
 * PUT /api/settings
 * Update user settings in database
 */
router.put("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const newSettings = req.body.settings || req.body;

    // Validate settings structure (merge with defaults to ensure completeness)
    const defaultSettings = getDefaultSettings();
    const mergedSettings = {
      ...defaultSettings,
      ...newSettings,
      mapSettings: {
        ...defaultSettings.mapSettings,
        ...(newSettings.mapSettings || {}),
      },
      graphDefaults: {
        ...defaultSettings.graphDefaults,
        ...(newSettings.graphDefaults || {}),
      },
    };

    // Ensure user_settings table exists (create if not exists) in usersDB
    try {
      await usersDB.query(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          settings_json JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_settings (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
    } catch (tableError) {
      // If foreign key constraint fails, try without it
      if (tableError.code === "ER_CANNOT_ADD_FOREIGN") {
        await usersDB.query(`
          CREATE TABLE IF NOT EXISTS user_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            settings_json JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_settings (user_id)
          )
        `);
      } else {
        console.warn("Table creation warning:", tableError.message);
      }
    }

    // Insert or update settings
    const settingsJson = JSON.stringify(mergedSettings);
    await usersDB.query(
      `INSERT INTO user_settings (user_id, settings_json) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE 
       settings_json = VALUES(settings_json),
       updated_at = CURRENT_TIMESTAMP`,
      [userId, settingsJson]
    );

    res.json({
      success: true,
      message: "Settings updated successfully",
      data: mergedSettings,
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update settings",
      message: error.message,
    });
  }
});

module.exports = router;

