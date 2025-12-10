/**
 * Vasudhara AWS Live Data Routes
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const { hydrologyDB: db } = require(path.join(__dirname, "../../../../backend/db.js"));

// ---------- Base Route ----------
router.get("/", (req, res) => {
  res.json({
    message: "Vasudhara AWS Live Route Active",
    endpoints: {
      latest: "/api/aws-live/vasudhara/latest",
      rainfall: "/api/aws-live/vasudhara/rainfall",
      parameters: "/api/aws-live/vasudhara/parameters",
    },
  });
});

// ---------- Latest 50 Records ----------
router.get("/latest", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM AWS_retrieved_db_data 
      WHERE StationID = 'ST020'
      ORDER BY timestamp DESC LIMIT 50;
    `);

    res.json({ station: "Vasudhara", count: rows.length, data: rows });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Rainfall ----------
router.get("/rainfall", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT timestamp, rain FROM AWS_retrieved_db_data
      WHERE StationID = 'ST020'
      ORDER BY timestamp DESC LIMIT 100;
    `);

    res.json({ station: "Vasudhara", rainfall: rows });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Parameters ----------
router.get("/parameters", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT timestamp, temperature, relative_humidity, pressure,
             rain, precipitation, windspeed
      FROM AWS_retrieved_db_data
      WHERE StationID = 'ST020'
      ORDER BY timestamp DESC LIMIT 100;
    `);

    res.json({ station: "Vasudhara", parameters: rows });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

