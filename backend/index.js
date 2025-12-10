require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Only hydrologyDB is used in current codebase
const { hydrologyDB } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// ✅ IMPORT ROUTES
// ======================================================
const userRoutes = require("./routes/users");
const awsLiveRoutes = require("./hydrology_routes/aws_routes/aws_index");
const ewsLiveRoutes = require("./hydrology_routes/ews_routes/ews_index");
const awsForecastRoute = require("./routes/awsForecast");

// ======================================================
// 🧩 MIDDLEWARES
// ======================================================

// ===============================
// UPDATED CORS WITH RENDER DOMAIN
// ===============================
app.use(
  cors({
    origin: function (origin, callback) {
      // allow mobile / curl / Postman
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

        // ⭐ NEW: RENDER FRONTEND + BACKEND
        "https://hydrology-jpvl.onrender.com",
      ];

      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`❌ Blocked by CORS: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

// ===============================
// UPDATED REFERER CHECK WITH RENDER DOMAIN
// ===============================
app.use((req, res, next) => {
  const allowedReferers = [
    "http://hydrology.cird.co.in",
    "https://hydrology.cird.co.in",
    "http://115.242.156.230:5000",
    "http://localhost:3000",

    // ⭐ NEW: Allow Render domain
    "https://hydrology-jpvl.onrender.com",
  ];

  const referer = req.headers.referer || "";

  if (referer && !allowedReferers.some((domain) => referer.startsWith(domain))) {
    console.warn(`❌ Referer check failed for: ${referer}`);
  }

  next();
});

// ======================================================
// 🌦️ API ROUTES
// ======================================================

app.use("/api/aws-live", awsLiveRoutes);
app.use("/api/ews-live", ewsLiveRoutes);
app.use("/api/users", userRoutes);
app.use("/api/aws-live", awsForecastRoute);

// ======================================================
// 🎨 FRONTEND STATIC FILES (OPTIONAL)
// ======================================================
// For local/static builds only. On Render (SSR frontend separate),
// this folder usually does NOT exist, so we guard it.
const frontendPath = path.join(__dirname, "../hydrology/out");

if (fs.existsSync(frontendPath)) {
  console.log("✅ Frontend build found at:", frontendPath);
  app.use(express.static(frontendPath));

  // Serve all non-API routes from the static frontend
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.warn("⚠ Frontend static build not found at:", frontendPath);
  console.warn("⚠ Skipping static file serving. This is expected on Render if frontend is SSR.");
}

// ======================================================
// 🏠 ROOT ENDPOINT
// ======================================================
app.get("/", (req, res) => {
  res.send("🌐 AWS-EWS Backend is Running!");
});

// ======================================================
// 🔄 KEEP-ALIVE (optional ping for old Render service)
// ======================================================
setInterval(async () => {
  try {
    const fetch = (await import("node-fetch")).default;
    // You can update this URL to your new backend URL if needed
    await fetch("https://hydrology-jpvl.onrender.com/");
    console.log(`[PING] Server pinged at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error("[PING] Failed to ping:", err.message);
  }
}, 5 * 60 * 1000);

// ======================================================
// 🚀 START SERVER
// ======================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Hydrology Live API: http://localhost:${PORT}/api/aws-live`);
});
