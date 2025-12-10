/**
 * Lambagad AWS Live Data Routes
 * Fetches live sensor data for Lambagad AWS station from Hydrology DB
 */

const express = require("express");
const path = require("path");
const router = express.Router();

// ✅ Correct absolute path to backend/db.js
const { hydrologyDB: db } = require(path.join(__dirname, "../../../../backend/db.js"));

// ✅ Base route to verify API is live
router.get("/", (req, res) => {
  res.json({
    message: "Lambagad AWS Live Route Active",
    endpoints: {
      latest: "/api/aws-live/lambagad/latest",
      parameters: "/api/aws-live/lambagad/parameters",
    },
  });
});

// ✅ Fetch latest 50 Lambagad records
router.get("/latest", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM AWS_retrieved_db_data
      WHERE StationID = 'ST015'
      ORDER BY timestamp DESC
      LIMIT 50;
    `);

    if (!rows.length)
      return res.status(404).json({ message: "No Lambagad data found." });

    res.status(200).json({
      station: "Lambagad",
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("❌ Error fetching Lambagad latest data:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Fetch parameters for graphs
router.get("/parameters", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT timestamp, temperature, relative_humidity, pressure, rain, precipitation
      FROM AWS_retrieved_db_data
      WHERE StationID = 'ST015'
      ORDER BY timestamp DESC
      LIMIT 100;
    `);

    res.status(200).json({
      station: "Lambagad",
      parameters: rows,
    });
  } catch (err) {
    console.error("❌ Error fetching Lambagad parameters:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;

