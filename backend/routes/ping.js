// routes/ping.js
const express = require("express");
const { hydrologyDB, usersDB } = require("../db");

const router = express.Router();

// Health check endpoint - lightweight ping
router.get("/", async (req, res) => {
  try {
    // Quick database connectivity check
    await hydrologyDB.query("SELECT 1");
    res.status(200).json({ 
      message: "Ping successful", 
      timestamp: new Date().toISOString(),
      status: "healthy"
    });
  } catch (error) {
    console.error("Ping error:", error.message);
    res.status(500).json({ error: "Ping failed", message: error.message });
  }
});

// Health check with database test
router.get("/health", async (req, res) => {
  try {
    // Test both databases
    await hydrologyDB.query("SELECT 1");
    await usersDB.query("SELECT 1");
    res.status(200).json({ 
      message: "Health check passed", 
      timestamp: new Date().toISOString(),
      status: "healthy",
      databases: {
        hydrology: "connected",
        users: "connected"
      }
    });
  } catch (error) {
    console.error("Health check error:", error.message);
    res.status(500).json({ 
      error: "Health check failed", 
      message: error.message,
      status: "unhealthy"
    });
  }
});

module.exports = router;
