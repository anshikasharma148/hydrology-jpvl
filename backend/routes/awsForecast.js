const express = require("express");
const router = express.Router();
const { hydrologyDB } = require("../db");
const { generateForecast } = require("../services/forecastService");

// ======================================
// 12-Hour Forecast API for AWS Stations
// ======================================
router.get("/forecast/:stationId", async (req, res) => {
  const stationId = req.params.stationId;

  try {
    const [rows] = await hydrologyDB.query(
      `
      SELECT timestamp, temperature, relative_humidity, pressure, windspeed, rain
      FROM AWS_retrieved_db_data
      WHERE StationID = ?
      ORDER BY timestamp DESC
      LIMIT 120;  -- last 30 hours
      `,
      [stationId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "No data found for this station." });
    }

    // Sort oldest → newest
    const data = rows.reverse();

    // Extract parameter series
    const temperature = data.map((r) => Number(r.temperature));
    const humidity = data.map((r) => Number(r.relative_humidity));
    const pressure = data.map((r) => Number(r.pressure));
    const windspeed = data.map((r) => Number(r.windspeed));
    const rain = data.map((r) => Number(r.rain));

    // Generate forecast
    const forecast = {
      station: stationId,
      forecastHours: 12,
      interval: "15 minutes",
      temperature: generateForecast(temperature),
      humidity: generateForecast(humidity),
      pressure: generateForecast(pressure),
      windspeed: generateForecast(windspeed),
      rain: generateForecast(rain),
    };

    return res.json(forecast);
  } catch (err) {
    console.error("❌ Forecast error:", err);
    return res.status(500).json({ error: "Server error while generating forecast." });
  }
});

module.exports = router;

