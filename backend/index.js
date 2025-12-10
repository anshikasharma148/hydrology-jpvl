require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { hydrologyDB } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// 📌 IMPORT ROUTES
// ======================================================
const userRoutes = require("./routes/users");
const awsLiveRoutes = require("./hydrology_routes/aws_routes/aws_index");
const ewsLiveRoutes = require("./hydrology_routes/ews_routes/ews_index");
const awsForecastRoute = require("./routes/awsForecast");

// ======================================================
// 🧩 CORS CONFIGURATION (UPDATED FOR VERCEL + RENDER)
// ======================================================

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        // LOCALHOST DEVELOPMENT
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:4000",
        "http://localhost:4001",

        // OLD ON-PREMISE SERVERS
        "http://115.242.156.230:3000",
        "http://115.242.156.230:3001",
        "http://115.242.156.230:4000",

        // OLD DOMAIN
        "http://hydrology.cird.co.in",
        "https://hydrology.cird.co.in",
        "http://hydrology.cird.co.in:8080",

        // ⭐ NEW Render backend
        "https://hydrology-jpvl.onrender.com",

        // ⭐ NEW Vercel frontend
        "https://hydrology-jpvl.vercel.app"
      ];

      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.warn(`❌ Blocked by CORS: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200
  })
);

// ======================================================
// 🛡️ REFERER SECURITY CHECK (UPDATED)
// ======================================================

app.use((req, res, next) => {
  const allowedReferers = [
    "http://hydrology.cird.co.in",
    "https://hydrology.cird.co.in",
    "http://115.242.156.230:5000",
    "http://localhost:3000",

    // ⭐ Allow Render frontend/backend
    "https://hydrology-jpvl.onrender.com",

    // ⭐ Allow Vercel frontend
    "https://hydrology-jpvl.vercel.app"
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
// 🎨 FRONTEND (STATIC SERVING IF OUT/ EXISTS)
// ======================================================
const frontendPath = path.join(__dirname, "../hydrology/out");

if (fs.existsSync(frontendPath)) {
  console.log("✅ Frontend build found:", frontendPath);
  app.use(express.static(frontendPath));

  // Serve frontend for non-API routes
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.warn("⚠ No frontend build found at:", frontendPath);
  console.warn("⚠ Skipping static frontend serving (expected on Render with SSR frontend).");
}

// ======================================================
// 🏠 DEFAULT ENDPOINT
// ======================================================
app.get("/", (req, res) => {
  res.send("🌐 Hydrology Backend is Running!");
});

// ======================================================
// 🔄 KEEP-ALIVE PING (optional)
// ======================================================
setInterval(async () => {
  try {
    const fetch = (await import("node-fetch")).default;
    await fetch("https://hydrology-jpvl.onrender.com/");
    console.log(`[PING] Server alive at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error("[PING] Failed:", err.message);
  }
}, 5 * 60 * 1000);

// ======================================================
// 🚀 START SERVER
// ======================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🚀 API available: http://localhost:${PORT}/api/aws-live`);
});
