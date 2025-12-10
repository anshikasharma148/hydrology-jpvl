/**
 * Mana AWS Live Data Routes
 * Fetches live sensor data for Mana AWS station from Hydrology DB
 */

const express = require("express");
const path = require("path");
const router = express.Router();

// ✅ Correct absolute path to backend/db.js
const { hydrologyDB: db } = require(path.join(__dirname, "../../../../backend/db.js"));

// ✅ Base route to verify API is live
router.get("/", (req, res) => {
  res.json({
    message: "Mana AWS Live Route Active",
    endpoints: {
      latest: "/api/aws-live/mana/latest",
      rainfall: "/api/aws-live/mana/rainfall",
    },
  });
});

// ✅ Fetch latest 50 Mana records
router.get("/latest", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM AWS_retrieved_db_data
      WHERE StationID = 'ST019'
      ORDER BY timestamp DESC
      LIMIT 50;
    `);

    if (!rows.length)
      return res.status(404).json({ message: "No Mana data found." });

    res.status(200).json({
      station: "Mana",
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("❌ Error fetching Mana latest data:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Fetch rainfall-only data for graphs
router.get("/rainfall", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT timestamp, rain
      FROM AWS_retrieved_db_data
      WHERE StationID = 'ST019'
      ORDER BY timestamp DESC
      LIMIT 100;
    `);
    res.status(200).json({
      station: "Mana",
      rainfall: rows,
    });
  } catch (err) {
    console.error("❌ Error fetching Mana rainfall:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;

