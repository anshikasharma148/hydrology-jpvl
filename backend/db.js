const mysql = require("mysql2/promise");
require("dotenv").config();

// Database connection configuration with improved error handling
const dbConfig = {
  host: process.env.HYDROLOGY_DB_HOST,
  user: process.env.HYDROLOGY_DB_USER,
  password: process.env.HYDROLOGY_DB_PASSWORD,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000, // 60 seconds
  acquireTimeout: 60000, // 60 seconds
  timeout: 60000, // 60 seconds
  reconnect: true,
};

// Main Hydrology DB (AWS + EWS station data)
const hydrologyDB = mysql.createPool({
  ...dbConfig,
  database: "Hydrology",
});

// USERS DB (authentication DB)
const usersDB = mysql.createPool({
  ...dbConfig,
  database: "cdc_user_db",
});

// Add connection event listeners for debugging
hydrologyDB.on('connection', (connection) => {
  console.log(`[DB] ✅ Hydrology DB connection established (ID: ${connection.threadId})`);
});

hydrologyDB.on('error', (err) => {
  console.error(`[DB] ❌ Hydrology DB error:`, err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') {
    console.error(`[DB] ⚠️ Database connection lost. Check if MySQL server is running and accessible.`);
    console.error(`[DB] ⚠️ Host: ${dbConfig.host}, Port: ${dbConfig.port}`);
  }
});

usersDB.on('connection', (connection) => {
  console.log(`[DB] ✅ Users DB connection established (ID: ${connection.threadId})`);
});

usersDB.on('error', (err) => {
  console.error(`[DB] ❌ Users DB error:`, err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') {
    console.error(`[DB] ⚠️ Database connection lost. Check if MySQL server is running and accessible.`);
    console.error(`[DB] ⚠️ Host: ${dbConfig.host}, Port: ${dbConfig.port}`);
  }
});

// Test connections on startup
async function testConnections() {
  try {
    await hydrologyDB.query("SELECT 1");
    console.log(`[DB] ✅ Hydrology DB connection test successful`);
  } catch (error) {
    console.error(`[DB] ❌ Hydrology DB connection test failed:`, error.message);
    console.error(`[DB] ⚠️ Error code: ${error.code}, Host: ${dbConfig.host}:${dbConfig.port}`);
    if (error.code === 'EHOSTUNREACH') {
      console.error(`[DB] ⚠️ Cannot reach database server. Possible causes:`);
      console.error(`[DB]    1. Database server is down or unreachable`);
      console.error(`[DB]    2. Firewall is blocking connections from this IP`);
      console.error(`[DB]    3. MySQL user is not allowed to connect from this host`);
      console.error(`[DB]    4. Database requires VPN or specific network access`);
    }
  }

  try {
    await usersDB.query("SELECT 1");
    console.log(`[DB] ✅ Users DB connection test successful`);
  } catch (error) {
    console.error(`[DB] ❌ Users DB connection test failed:`, error.message);
    console.error(`[DB] ⚠️ Error code: ${error.code}, Host: ${dbConfig.host}:${dbConfig.port}`);
  }
}

// Test connections (non-blocking)
testConnections().catch(console.error);

module.exports = {
  hydrologyDB,
  usersDB,
};
