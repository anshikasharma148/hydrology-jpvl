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
// KEEP-ALIVE
// ======================================================
setInterval(async () => {
  try {
    const fetch = (await import("node-fetch")).default;
    await fetch("https://hydrology-jpvl.onrender.com/");
  } catch (err) {
    console.error("[PING] Failed:", err.message);
  }
}, 5 * 60 * 1000);

// ======================================================
// START SERVER
// ======================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🚀 API: http://localhost:${PORT}/api/aws-live`);
});
