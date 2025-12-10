/**
 * Mana EWS Live Data Routes (FULL DATA – NO LIMIT)
 */

const express = require("express");
const router = express.Router();
const path = require("path");

// Load DB
const { hydrologyDB: db } = require(path.join(
  __dirname,
  "../../../../backend/db.js"
));

/**
 * Base Route
 */
router.get("/", (req, res) => {
  res.json({
    message: "Mana EWS Live Route Active",
    endpoints: {
      all: "/api/ews-live/mana/all",
    },
  });
});

/**
 * ALL DATA (NO LIMIT)
 * /api/ews-live/mana/all
 */
router.get("/all", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM EWS_retrieved_db_data
      WHERE StationID = 'ST019'
      ORDER BY timestamp DESC
    `);

    res.status(200).json({
      station: "Mana",
      service: "EWS",
      totalRecords: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("❌ Mana EWS /all error:", err.message);
    res.status(500).json({ error: "Database error fetching Mana EWS data" });
  }
});

module.exports = router;
