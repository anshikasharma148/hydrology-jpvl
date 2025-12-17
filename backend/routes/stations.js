const express = require("express");
const { hydrologyDB } = require("../db");
const router = express.Router();

// ====================
// 🔐 JWT Middleware
// ====================
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT Error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ====================
// 👑 Admin Check
// ====================
const isAdmin = (req, res, next) => {
  if (req.user.role.toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
};

// ====================
// Helper: Add custom columns to data table
// ====================
const addCustomColumnsToTable = async (serviceType, customFields) => {
  if (!customFields || customFields.length === 0) return;

  const tableName = serviceType === "AWS" ? "AWS_retrieved_db_data" : "EWS_retrieved_db_data";

  for (const field of customFields) {
    try {
      // Check if column already exists
      const [columns] = await hydrologyDB.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'Hydrology' 
         AND TABLE_NAME = ? 
         AND COLUMN_NAME = ?`,
        [tableName, field.name]
      );

      if (columns.length === 0) {
        // Add the column
        await hydrologyDB.query(
          `ALTER TABLE ${tableName} ADD COLUMN \`${field.name}\` ${field.type} NULL`
        );
        console.log(`✅ Added custom column ${field.name} to ${tableName}`);
      }
    } catch (error) {
      console.error(`Error adding column ${field.name}:`, error.message);
      // Continue with other columns even if one fails
    }
  }
};

// ====================
// Helper: Remove custom columns from data table
// ====================
const removeCustomColumnsFromTable = async (serviceType, fieldNames) => {
  if (!fieldNames || fieldNames.length === 0) return;

  const tableName = serviceType === "AWS" ? "AWS_retrieved_db_data" : "EWS_retrieved_db_data";

  for (const fieldName of fieldNames) {
    try {
      // Check if column exists
      const [columns] = await hydrologyDB.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'Hydrology' 
         AND TABLE_NAME = ? 
         AND COLUMN_NAME = ?`,
        [tableName, fieldName]
      );

      if (columns.length > 0) {
        // Note: Dropping columns can cause data loss, so we'll just log it
        // In production, you might want to archive data first
        console.warn(`⚠️ Column ${fieldName} exists in ${tableName}. Dropping columns is not implemented for data safety.`);
        // Uncomment below if you want to actually drop (use with caution):
        // await hydrologyDB.query(`ALTER TABLE ${tableName} DROP COLUMN \`${fieldName}\``);
      }
    } catch (error) {
      console.error(`Error checking column ${fieldName}:`, error.message);
    }
  }
};

// ====================
// 📋 Get All Stations
// ====================
router.get("/", async (req, res) => {
  try {
    const [stations] = await hydrologyDB.query(
      `SELECT sc.*, 
              ms.StationName, ms.Longitude, ms.Latitude, ms.Country, ms.State, ms.District, ms.PinCode
       FROM station_config sc
       LEFT JOIN master_station_db ms ON sc.StationID = ms.StationID AND sc.ServicesID = ms.ServicesID
       WHERE sc.is_active = TRUE
       ORDER BY sc.ServicesID, sc.station_name`
    );

    // Parse JSON fields
    const parsedStations = stations.map(station => ({
      ...station,
      column_mappings: typeof station.column_mappings === 'string' 
        ? JSON.parse(station.column_mappings) 
        : station.column_mappings,
      selected_fields: typeof station.selected_fields === 'string'
        ? JSON.parse(station.selected_fields)
        : station.selected_fields,
      custom_fields: station.custom_fields 
        ? (typeof station.custom_fields === 'string' 
            ? JSON.parse(station.custom_fields) 
            : station.custom_fields)
        : null
    }));

    res.json({ success: true, data: parsedStations });
  } catch (error) {
    console.error("Error fetching stations:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================
// 📋 Get Single Station
// ====================
router.get("/:stationId/:serviceId", async (req, res) => {
  try {
    const { stationId, serviceId } = req.params;
    const [stations] = await hydrologyDB.query(
      `SELECT sc.*, 
              ms.StationName, ms.Longitude, ms.Latitude, ms.Country, ms.State, ms.District, ms.PinCode
       FROM station_config sc
       LEFT JOIN master_station_db ms ON sc.StationID = ms.StationID AND sc.ServicesID = ms.ServicesID
       WHERE sc.StationID = ? AND sc.ServicesID = ? AND sc.is_active = TRUE`,
      [stationId, serviceId]
    );

    if (stations.length === 0) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    const station = stations[0];
    const parsedStation = {
      ...station,
      column_mappings: typeof station.column_mappings === 'string' 
        ? JSON.parse(station.column_mappings) 
        : station.column_mappings,
      selected_fields: typeof station.selected_fields === 'string'
        ? JSON.parse(station.selected_fields)
        : station.selected_fields,
      custom_fields: station.custom_fields 
        ? (typeof station.custom_fields === 'string' 
            ? JSON.parse(station.custom_fields) 
            : station.custom_fields)
        : null
    };

    res.json({ success: true, data: parsedStation });
  } catch (error) {
    console.error("Error fetching station:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================
// ➕ Create New Station
// ====================
router.post("/", authenticate, isAdmin, async (req, res) => {
  try {
    const {
      StationID,
      ServicesID,
      DeviceID,
      station_name,
      csv_folder_path,
      column_mappings,
      selected_fields,
      custom_fields,
      Longitude,
      Latitude,
      Country,
      State,
      District,
      PinCode,
      UID = "U001"
    } = req.body;

    // Validation
    if (!StationID || !ServicesID || !DeviceID || !station_name || !csv_folder_path || !column_mappings || !selected_fields) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: StationID, ServicesID, DeviceID, station_name, csv_folder_path, column_mappings, selected_fields" 
      });
    }

    // Check if station already exists
    const [existing] = await hydrologyDB.query(
      "SELECT id FROM station_config WHERE StationID = ? AND ServicesID = ?",
      [StationID, ServicesID]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Station with this StationID and ServicesID already exists" 
      });
    }

    // Insert into master_station_db first
    await hydrologyDB.query(
      `INSERT INTO master_station_db 
       (StationID, ServicesID, StationName, Longitude, Latitude, Country, State, District, PinCode, UID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       StationName = VALUES(StationName),
       Longitude = VALUES(Longitude),
       Latitude = VALUES(Latitude),
       Country = VALUES(Country),
       State = VALUES(State),
       District = VALUES(District),
       PinCode = VALUES(PinCode)`,
      [StationID, ServicesID, station_name, Longitude || null, Latitude || null, Country || null, State || null, District || null, PinCode || null, UID]
    );

    // Insert into master_device_db
    await hydrologyDB.query(
      `INSERT INTO master_device_db 
       (DeviceID, DeviceName, StationID, ServicesID, UID, Quantity)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
       DeviceName = VALUES(DeviceName),
       StationID = VALUES(StationID),
       ServicesID = VALUES(ServicesID)`,
      [DeviceID, `${station_name} Device`, StationID, ServicesID, UID]
    );

    // Insert into station_config
    await hydrologyDB.query(
      `INSERT INTO station_config 
       (StationID, ServicesID, DeviceID, station_name, csv_folder_path, column_mappings, selected_fields, custom_fields)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        StationID,
        ServicesID,
        DeviceID,
        station_name,
        csv_folder_path,
        JSON.stringify(column_mappings),
        JSON.stringify(selected_fields),
        custom_fields ? JSON.stringify(custom_fields) : null
      ]
    );

    // Add custom columns to data table if any
    if (custom_fields && custom_fields.length > 0) {
      await addCustomColumnsToTable(ServicesID, custom_fields);
    }

    res.json({ 
      success: true, 
      message: "Station created successfully",
      data: { StationID, ServicesID }
    });
  } catch (error) {
    console.error("Error creating station:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================
// ✏️ Update Station
// ====================
router.put("/:stationId/:serviceId", authenticate, isAdmin, async (req, res) => {
  try {
    const { stationId, serviceId } = req.params;
    const {
      DeviceID,
      station_name,
      csv_folder_path,
      column_mappings,
      selected_fields,
      custom_fields,
      Longitude,
      Latitude,
      Country,
      State,
      District,
      PinCode,
      is_active
    } = req.body;

    // Check if station exists
    const [existing] = await hydrologyDB.query(
      "SELECT * FROM station_config WHERE StationID = ? AND ServicesID = ?",
      [stationId, serviceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    const oldConfig = existing[0];
    const oldCustomFields = oldConfig.custom_fields 
      ? (typeof oldConfig.custom_fields === 'string' ? JSON.parse(oldConfig.custom_fields) : oldConfig.custom_fields)
      : [];

    // Update master_station_db
    if (station_name || Longitude !== undefined || Latitude !== undefined || Country || State || District || PinCode) {
      await hydrologyDB.query(
        `UPDATE master_station_db 
         SET StationName = COALESCE(?, StationName),
             Longitude = COALESCE(?, Longitude),
             Latitude = COALESCE(?, Latitude),
             Country = COALESCE(?, Country),
             State = COALESCE(?, State),
             District = COALESCE(?, District),
             PinCode = COALESCE(?, PinCode)
         WHERE StationID = ? AND ServicesID = ?`,
        [station_name, Longitude, Latitude, Country, State, District, PinCode, stationId, serviceId]
      );
    }

    // Update master_device_db
    if (DeviceID) {
      await hydrologyDB.query(
        `UPDATE master_device_db 
         SET DeviceID = ?, DeviceName = ?
         WHERE StationID = ? AND ServicesID = ?`,
        [DeviceID, `${station_name || oldConfig.station_name} Device`, stationId, serviceId]
      );
    }

    // Update station_config
    const updateFields = [];
    const updateValues = [];

    if (csv_folder_path) {
      updateFields.push("csv_folder_path = ?");
      updateValues.push(csv_folder_path);
    }
    if (column_mappings) {
      updateFields.push("column_mappings = ?");
      updateValues.push(JSON.stringify(column_mappings));
    }
    if (selected_fields) {
      updateFields.push("selected_fields = ?");
      updateValues.push(JSON.stringify(selected_fields));
    }
    if (custom_fields !== undefined) {
      updateFields.push("custom_fields = ?");
      updateValues.push(custom_fields ? JSON.stringify(custom_fields) : null);
    }
    if (station_name) {
      updateFields.push("station_name = ?");
      updateValues.push(station_name);
    }
    if (DeviceID) {
      updateFields.push("DeviceID = ?");
      updateValues.push(DeviceID);
    }
    if (is_active !== undefined) {
      updateFields.push("is_active = ?");
      updateValues.push(is_active);
    }

    if (updateFields.length > 0) {
      updateValues.push(stationId, serviceId);
      await hydrologyDB.query(
        `UPDATE station_config 
         SET ${updateFields.join(", ")}
         WHERE StationID = ? AND ServicesID = ?`,
        updateValues
      );
    }

    // Handle custom fields changes
    if (custom_fields !== undefined) {
      const newCustomFields = custom_fields || [];
      const oldFieldNames = oldCustomFields.map(f => f.name);
      const newFieldNames = newCustomFields.map(f => f.name);
      
      // Add new custom columns
      const fieldsToAdd = newCustomFields.filter(f => !oldFieldNames.includes(f.name));
      if (fieldsToAdd.length > 0) {
        await addCustomColumnsToTable(serviceId, fieldsToAdd);
      }

      // Note: Column removal is not implemented for data safety
      // You can implement it if needed with proper data archiving
    }

    res.json({ 
      success: true, 
      message: "Station updated successfully" 
    });
  } catch (error) {
    console.error("Error updating station:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================
// ❌ Delete Station
// ====================
router.delete("/:stationId/:serviceId", authenticate, isAdmin, async (req, res) => {
  try {
    const { stationId, serviceId } = req.params;
    const { hardDelete } = req.query; // Optional query parameter for hard delete

    // Check if station exists
    const [existing] = await hydrologyDB.query(
      "SELECT id FROM station_config WHERE StationID = ? AND ServicesID = ?",
      [stationId, serviceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    if (hardDelete === 'true') {
      // Hard delete - completely remove from all related tables
      // Delete in order: station_config -> master_device_db -> master_station_db
      // (Delete dependent tables first, then the base table)
      
      // 1. Delete from station_config
      await hydrologyDB.query(
        "DELETE FROM station_config WHERE StationID = ? AND ServicesID = ?",
        [stationId, serviceId]
      );
      
      // 2. Delete from master_device_db
      await hydrologyDB.query(
        "DELETE FROM master_device_db WHERE StationID = ? AND ServicesID = ?",
        [stationId, serviceId]
      );
      
      // 3. Delete from master_station_db (base table)
      await hydrologyDB.query(
        "DELETE FROM master_station_db WHERE StationID = ? AND ServicesID = ?",
        [stationId, serviceId]
      );
      
      res.json({ 
        success: true, 
        message: "Station permanently deleted from all database tables" 
      });
    } else {
      // Soft delete (set is_active = false) - default behavior
      // This preserves data and allows recovery
      await hydrologyDB.query(
        "UPDATE station_config SET is_active = FALSE WHERE StationID = ? AND ServicesID = ?",
        [stationId, serviceId]
      );

      res.json({ 
        success: true, 
        message: "Station deactivated successfully (soft delete). Use hardDelete=true to permanently delete." 
      });
    }
  } catch (error) {
    console.error("Error deleting station:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================
// ➕ Add Custom Field
// ====================
router.post("/:stationId/:serviceId/fields", authenticate, isAdmin, async (req, res) => {
  try {
    const { stationId, serviceId } = req.params;
    const { name, type, column } = req.body;

    if (!name || !type || !column) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: name, type, column" 
      });
    }

    // Get current station config
    const [stations] = await hydrologyDB.query(
      "SELECT * FROM station_config WHERE StationID = ? AND ServicesID = ?",
      [stationId, serviceId]
    );

    if (stations.length === 0) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    const station = stations[0];
    const customFields = station.custom_fields 
      ? (typeof station.custom_fields === 'string' ? JSON.parse(station.custom_fields) : station.custom_fields)
      : [];

    // Check if field already exists
    if (customFields.some(f => f.name === name)) {
      return res.status(400).json({ 
        success: false, 
        error: "Custom field with this name already exists" 
      });
    }

    // Add new field
    customFields.push({ name, type, column });

    // Update station_config
    await hydrologyDB.query(
      "UPDATE station_config SET custom_fields = ? WHERE StationID = ? AND ServicesID = ?",
      [JSON.stringify(customFields), stationId, serviceId]
    );

    // Add column to data table
    await addCustomColumnsToTable(serviceId, [{ name, type }]);

    res.json({ 
      success: true, 
      message: "Custom field added successfully",
      data: { name, type, column }
    });
  } catch (error) {
    console.error("Error adding custom field:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================
// ❌ Remove Custom Field
// ====================
router.delete("/:stationId/:serviceId/fields/:fieldName", authenticate, isAdmin, async (req, res) => {
  try {
    const { stationId, serviceId, fieldName } = req.params;

    // Get current station config
    const [stations] = await hydrologyDB.query(
      "SELECT * FROM station_config WHERE StationID = ? AND ServicesID = ?",
      [stationId, serviceId]
    );

    if (stations.length === 0) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    const station = stations[0];
    const customFields = station.custom_fields 
      ? (typeof station.custom_fields === 'string' ? JSON.parse(station.custom_fields) : station.custom_fields)
      : [];

    // Remove field
    const updatedFields = customFields.filter(f => f.name !== fieldName);

    if (updatedFields.length === customFields.length) {
      return res.status(404).json({ 
        success: false, 
        error: "Custom field not found" 
      });
    }

    // Update station_config
    await hydrologyDB.query(
      "UPDATE station_config SET custom_fields = ? WHERE StationID = ? AND ServicesID = ?",
      [updatedFields.length > 0 ? JSON.stringify(updatedFields) : null, stationId, serviceId]
    );

    // Note: Column removal is not implemented for data safety
    // The column will remain in the table but won't be used

    res.json({ 
      success: true, 
      message: "Custom field removed from configuration (column remains in table for data safety)" 
    });
  } catch (error) {
    console.error("Error removing custom field:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

