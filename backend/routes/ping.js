// routes/ping.js
import express from "express";
import { getConnection } from "../db.js"; // or however you get the DB connection

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const conn = await getConnection(); // use your method to connect
    const [rows] = await conn.query("SELECT 1"); // lightweight query
    res.status(200).json({ message: "Ping successful", data: rows });
  } catch (error) {
    console.error("Ping error:", error.message);
    res.status(500).json({ error: "Ping failed" });
  }
});

export default router;
