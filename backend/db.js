// backend/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// ---------- AWS Dummy DB ----------
const awsDB = mysql.createPool({
  host: process.env.AWS_DB_HOST,
  user: process.env.AWS_DB_USER,
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME,
});

// ---------- EWS Dummy DB ----------
const ewsDB = mysql.createPool({
  host: process.env.EWS_DB_HOST,
  user: process.env.EWS_DB_USER,
  password: process.env.EWS_DB_PASSWORD,
  database: process.env.EWS_DB_NAME,
});

// ---------- CDC User DB ----------
const cdcDB = mysql.createPool({
  host: process.env.CDC_DB_HOST,
  user: process.env.CDC_DB_USER,
  password: process.env.CDC_DB_PASSWORD,
  database: process.env.CDC_DB_NAME,
});

// ---------- NEW Hydrology (Live AWS Data) DB ----------
const hydrologyDB = mysql.createPool({
  host: 'localhost',
  user: 'hydrology_admin',
  password: 'Hydrology@2025',
  database: 'Hydrology',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Optional: test connection (non-blocking)
(async () => {
  try {
    const connection = await hydrologyDB.getConnection();
    console.log('✅ Connected to Hydrology Database!');
    connection.release();
  } catch (err) {
    console.error('❌ Hydrology DB connection failed:', err.message);
  }
})();

module.exports = {
  awsDB,
  ewsDB,
  cdcDB,
  hydrologyDB, // ✅ export the new live DB
};

