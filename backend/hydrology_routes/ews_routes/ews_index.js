/**
 * EWS Live Routes Index (Vasudhara + Mana)
 */

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// Safe loader
function importIfExists(absPath) {
  if (fs.existsSync(absPath)) {
    console.log("✔ Loaded EWS route:", absPath);
    return require(absPath);
  }
  console.warn("⚠ Missing EWS route:", absPath);
  return express.Router();
}

// Route paths
const vasudharaPath =
  "/home/sr03/AWS-EWS/backend/hydrology_routes/ews_routes/vasudhara_routes/vasudhara_data.js";

const manaPath =
  "/home/sr03/AWS-EWS/backend/hydrology_routes/ews_routes/mana_routes/mana_data.js";

// Load station routes
const vasudharaRoutes = importIfExists(vasudharaPath);
const manaRoutes = importIfExists(manaPath);

router.use("/vasudhara", vasudharaRoutes);
router.use("/mana", manaRoutes);

// DB
const { hydrologyDB: db } = require("/home/sr03/AWS-EWS/backend/db.js");

/**
 * ALL EWS STATIONS
 * /api/ews-live/all
 */
router.get("/all", async (req, res) => {
  try {
    const [vasudhara] = await db.query(`
      SELECT *
      FROM EWS_retrieved_db_data
      WHERE StationID = 'ST020'
      ORDER BY timestamp DESC
    `);

    const [mana] = await db.query(`
      SELECT *
      FROM EWS_retrieved_db_data
      WHERE StationID = 'ST019'
      ORDER BY timestamp DESC
    `);

    res.status(200).json({
      message: "Data Fetched",
      totalStations: 2,
      data: {
        Vasudhara: vasudhara,
        Mana: mana,
      },
    });
  } catch (err) {
    console.error("❌ EWS /all error:", err.message);
    res.status(500).json({ error: "Database error fetching EWS data" });
  }
});

/**
 * Health Route
 */
router.get("/", (req, res) => {
  res.json({
    message: "EWS Live Routes Active",
    endpoints: {
      vasudhara: "/api/ews-live/vasudhara/all",
      mana: "/api/ews-live/mana/all",
      all: "/api/ews-live/all",
    },
  });
});

module.exports = router;

