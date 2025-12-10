/**
 * Vasudhara EWS Live Data Route
 */

const express = require("express");
const router = express.Router();

// -------------------------------------------------------------
// HYDROLOGY DB (ABSOLUTE PATH → PM2 SAFE)
// -------------------------------------------------------------
const { hydrologyDB: db } = require("/home/sr03/AWS-EWS/backend/db.js");

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
router.get("/", (req, res) => {
  res.json({
    message: "Vasudhara EWS Live Route Active",
    endpoints: {
      latest: "/api/ews-live/vasudhara/latest",
      all: "/api/ews-live/vasudhara/all",
    },
  });
});

// -------------------------------------------------------------
// LATEST 50 DATA POINTS
// -------------------------------------------------------------
router.get("/latest", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM EWS_retrieved_db_data
      WHERE StationID = 'ST020'
      ORDER BY timestamp DESC
      LIMIT 50
    `);

    res.status(200).json({
      station: "Vasudhara",
      service: "EWS",
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("❌ Vasudhara latest error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// -------------------------------------------------------------
// ALL DATA FOR VASUDHARA
// -------------------------------------------------------------
router.get("/all", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM EWS_retrieved_db_data
      WHERE StationID = 'ST020'
      ORDER BY timestamp DESC
    `);

    res.status(200).json({
      station: "Vasudhara",
      service: "EWS",
      totalRecords: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("❌ Vasudhara All Error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;

