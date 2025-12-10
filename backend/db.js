// backend/db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

// Hydrology DB (Live AWS Data)
const hydrologyDB = mysql.createPool({
  host: process.env.HYDROLOGY_DB_HOST || "localhost",
  user: process.env.HYDROLOGY_DB_USER || "hydrology_admin",
  password: process.env.HYDROLOGY_DB_PASSWORD || "Hydrology@2025",
  database: process.env.HYDROLOGY_DB_NAME || "Hydrology",
  port: process.env.HYDROLOGY_DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection (non-blocking)
(async () => {
  try {
    const conn = await hydrologyDB.getConnection();
    console.log("✅ Connected to Hydrology Database!");
    conn.release();
  } catch (err) {
    console.error("❌ Hydrology DB connection failed:", err.message);
  }
})();

module.exports = {
  hydrologyDB,
};
