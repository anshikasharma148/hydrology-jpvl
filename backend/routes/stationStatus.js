const express = require("express");
const { hydrologyDB } = require("../db");
const router = express.Router();

/**
 * GET /api/station-status
 * Get all station statuses
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await hydrologyDB.query(
      "SELECT * FROM station_status ORDER BY station_id, service_type"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching station statuses:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/station-status/:stationId
 * Get status for a specific station
 */
router.get("/:stationId", async (req, res) => {
  try {
    const { stationId } = req.params;
    const { serviceType } = req.query; // Optional: AWS or EWS

    let query = "SELECT * FROM station_status WHERE station_id = ?";
    const params = [stationId];

    if (serviceType) {
      query += " AND service_type = ?";
      params.push(serviceType);
    }

    const [rows] = await hydrologyDB.query(query, params);

    if (rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error fetching station status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/station-status
 * Create or update station status
 * Body: { stationId, serviceType, status, notes? }
 */
router.post("/", async (req, res) => {
  try {
    const { stationId, serviceType, status, notes } = req.body;

    // Validate required fields
    if (!stationId || !serviceType || !status) {
      return res.status(400).json({
        success: false,
        error: "stationId, serviceType, and status are required",
      });
    }

    // Validate status value
    const validStatuses = ["live", "offline", "maintenance"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: "status must be one of: live, offline, maintenance",
      });
    }

    // Check if record exists
    const [existing] = await hydrologyDB.query(
      "SELECT * FROM station_status WHERE station_id = ? AND service_type = ?",
      [stationId, serviceType]
    );

    const statusTimestamp = status.toLowerCase() === "offline" ? new Date() : null;

    if (existing.length > 0) {
      // Update existing record
      await hydrologyDB.query(
        `UPDATE station_status 
         SET status = ?, status_timestamp = ?, notes = ?, updated_at = NOW() 
         WHERE station_id = ? AND service_type = ?`,
        [status.toLowerCase(), statusTimestamp, notes || null, stationId, serviceType]
      );
    } else {
      // Insert new record
      await hydrologyDB.query(
        `INSERT INTO station_status (station_id, service_type, status, status_timestamp, notes, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [stationId, serviceType, status.toLowerCase(), statusTimestamp, notes || null]
      );
    }

    res.json({
      success: true,
      message: "Station status updated successfully",
    });
  } catch (error) {
    console.error("Error updating station status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/station-status/:stationId
 * Remove manual status (revert to auto-detection)
 */
router.delete("/:stationId", async (req, res) => {
  try {
    const { stationId } = req.params;
    const { serviceType } = req.query;

    let query = "DELETE FROM station_status WHERE station_id = ?";
    const params = [stationId];

    if (serviceType) {
      query += " AND service_type = ?";
      params.push(serviceType);
    }

    await hydrologyDB.query(query, params);

    res.json({
      success: true,
      message: "Station status removed (reverted to auto-detection)",
    });
  } catch (error) {
    console.error("Error deleting station status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

