/**
 * AWS Live Routes Index
 * Handles Lambagad, Mana, Vasudhara AWS stations
 */

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// ---------- Helper ----------
function importIfExists(filePath) {
  const file = path.join(__dirname, filePath);
  if (fs.existsSync(file)) {
    console.log(`✅ Loaded route: ${filePath}`);
    return require(file);
  } else {
    console.warn(`⚠️ Missing route: ${filePath}`);
    return express.Router();
  }
}

// ---------- Import Station Routes ----------
const lambagadRoutes = importIfExists("lambagad_routes/lambagad_data.js");
const manaRoutes = importIfExists("mana_routes/mana_data.js");
const vasudharaRoutes = importIfExists("vasudhara_routes/vasudhara_data.js");

// ---------- Mount Routes ----------
router.use("/lambagad", lambagadRoutes);
router.use("/mana", manaRoutes);
router.use("/vasudhara", vasudharaRoutes);

// ---------- Hydrology DB ----------
let db;
(function loadDB() {
  const paths = [
    "/home/sr03/AWS-EWS/backend/db.js",
    path.join(__dirname, "../../../db.js"),
  ];

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        db = require(p).hydrologyDB;
        console.log(`📦 Hydrology DB Loaded: ${p}`);
        return;
      }
    } catch {}
  }

  console.error("❌ Hydrology DB not found");
})();

// ---------- Combined Route (FULL HISTORY) ----------
router.get("/all", async (req, res) => {
  try {
    const [lambagad] = await db.query(`
      SELECT * FROM AWS_retrieved_db_data
      WHERE StationID = 'ST015'
      ORDER BY timestamp DESC;
    `);

    const [mana] = await db.query(`
      SELECT * FROM AWS_retrieved_db_data
      WHERE StationID = 'ST019'
      ORDER BY timestamp DESC;
    `);

    const [vasudhara] = await db.query(`
      SELECT * FROM AWS_retrieved_db_data
      WHERE StationID = 'ST020'
      ORDER BY timestamp DESC;
    `);

    res.json({
      message: "Data Fetched",
      totalStations: 3,
      data: {
        Lambagad: lambagad,
        Mana: mana,
        Vasudhara: vasudhara
      }
    });

  } catch (err) {
    console.error("❌ AWS ALL ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Health Check ----------
router.get("/", (req, res) => {
  res.json({
    message: "AWS Live Routes Active",
    endpoints: {
      lambagad: "/api/aws-live/lambagad/latest",
      mana: "/api/aws-live/mana/latest",
      vasudhara: "/api/aws-live/vasudhara/latest",
      all: "/api/aws-live/all",
    },
  });
});

module.exports = router;

