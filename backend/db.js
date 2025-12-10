const mysql = require("mysql2/promise");
require("dotenv").config();

// Main Hydrology DB (AWS + EWS station data)
const hydrologyDB = mysql.createPool({
  host: process.env.HYDROLOGY_DB_HOST,
  user: process.env.HYDROLOGY_DB_USER,
  password: process.env.HYDROLOGY_DB_PASSWORD,
  database: "Hydrology",
  port: 3306,
});

// USERS DB (authentication DB)
const usersDB = mysql.createPool({
  host: process.env.HYDROLOGY_DB_HOST,
  user: process.env.HYDROLOGY_DB_USER,
  password: process.env.HYDROLOGY_DB_PASSWORD,
  database: "cdc_user_db",
  port: 3306,
});

module.exports = {
  hydrologyDB,
  usersDB,
};
