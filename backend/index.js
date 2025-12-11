require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { hydrologyDB } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// ✅ BODY PARSER (THE MISSING PART CAUSING LOGIN ERROR)
// ======================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// ROUTES
// ======================================================
const userRoutes = require("./routes/users");
const awsLiveRoutes = require("./hydrology_routes/aws_routes/aws_index");
const ewsLiveRoutes = require("./hydrology_routes/ews_routes/ews_index");
const awsForecastRoute = require("./routes/awsForecast");

// ======================================================
// UPDATED CORS FOR RENDER + VERCEL
// ======================================================
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://115.242.156.230:3000",
        "http://115.242.156.230:3001",
        "http://hydrology.cird.co.in",
        "https://hydrology.cird.co.in",
        "http://hydrology.cird.co.in:8080",
        "http://115.242.156.230:4000",
        "http://localhost:4000",
        "http://localhost:4001",

        // ⭐ Render Frontend
        "https://hydrology-jpvl.onrender.com",
        // ⭐ Vercel Frontend
        "https://hydrology-jpvl.vercel.app",
      ];

      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`❌ Blocked by CORS: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ======================================================
// REFERER CHECK
// ======================================================
app.use((req, res, next) => {
  const allowedReferers = [
    "http://hydrology.cird.co.in",
    "https://hydrology.cird.co.in",
    "http://115.242.156.230:5000",
    "http://localhost:3000",
    "https://hydrology-jpvl.onrender.com",
    "https://hydrology-jpvl.vercel.app",
  ];

  const referer = req.headers.referer || "";
  if (referer && !allowedReferers.some((d) => referer.startsWith(d))) {
    console.warn(`❌ Referer check failed for: ${referer}`);
  }
  next();
});

// ======================================================
// API ROUTES
// ======================================================
const pingRoutes = require("./routes/ping");
app.use("/api/ping", pingRoutes);
app.use("/api/aws-live", awsLiveRoutes);
app.use("/api/ews-live", ewsLiveRoutes);
app.use("/api/users", userRoutes);
app.use("/api/aws-live", awsForecastRoute);

// ======================================================
// STATIC FRONTEND (OPTIONAL)
// ======================================================
const frontendPath = path.join(__dirname, "../hydrology/out");

if (fs.existsSync(frontendPath)) {
  console.log("✅ Frontend build found:", frontendPath);
  app.use(express.static(frontendPath));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.warn("⚠ No frontend build found:", frontendPath);
  console.warn("⚠ Skipping static serving (correct for SSR/Vercel).");
}

// ======================================================
// ROOT
// ======================================================
app.get("/", (req, res) => {
  res.send("🌐 AWS-EWS Backend is Running!");
});

// ======================================================
// KEEP-ALIVE MECHANISM (Prevent Render from sleeping)
// ======================================================
const cron = require("node-cron");
const https = require("https");
const http = require("http");

// Get the backend URL from environment or use default
const BACKEND_URL = process.env.BACKEND_URL || "https://hydrology-jpvl.onrender.com";

// Helper function to ping the backend
const pingBackend = async () => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BACKEND_URL}/api/ping`);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000, // 10 second timeout
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`[KEEP-ALIVE] ✅ Server pinged successfully at ${new Date().toISOString()}`);
          resolve(true);
        } else {
          console.warn(`[KEEP-ALIVE] ⚠️ Server responded with status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[KEEP-ALIVE] ❌ Failed to ping server:`, err.message);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

// Ping every 10 minutes to keep the server awake
// Render free tier sleeps after 15 minutes of inactivity
cron.schedule("*/10 * * * *", async () => {
  try {
    await pingBackend();
  } catch (err) {
    // Silently handle errors - this is just a keep-alive
    console.debug(`[KEEP-ALIVE] Ping failed (normal if server is sleeping):`, err.message);
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

// Also ping immediately on server start (after a delay)
setTimeout(async () => {
  try {
    await pingBackend();
  } catch (err) {
    console.debug(`[KEEP-ALIVE] Initial ping failed:`, err.message);
  }
}, 5000); // Wait 5 seconds after server starts

// ======================================================
// START SERVER
// ======================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🚀 API: http://localhost:${PORT}/api/aws-live`);
});
