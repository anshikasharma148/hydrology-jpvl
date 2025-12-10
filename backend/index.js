require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { awsDB, ewsDB, cdcDB, hydrologyDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// ✅ IMPORT ROUTES
// ======================================================
const userRoutes = require('./routes/users');
const awsLiveRoutes = require('./hydrology_routes/aws_routes/aws_index');
const ewsLiveRoutes = require('./hydrology_routes/ews_routes/ews_index'); // ✅ NEW live routes
const awsForecastRoute = require('./routes/awsForecast');


// ======================================================
// 🧩 MIDDLEWARES
// ======================================================

// ✅ Allow trusted domains (CORS)
// ✅ Global, explicit CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://115.242.156.230:3000",
        "http://115.242.156.230:3001",
        "http://hydrology.cird.co.in",
        "http://hydrology.cird.co.in:8080", // ✅ include this
        "https://hydrology.cird.co.in",
        "http://115.242.156.230:4000",
        "http://localhost:4000",
        "http://localhost:4001"
      ];

      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`❌ Blocked by CORS: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
    preflightContinue: false, // ✅ ensures OPTIONS handled internally
  })
);

app.use(express.json());
app.set('trust proxy', 1); // ✅ Required when running behind Nginx

// ✅ (Optional) Safe Referer validation
app.use((req, res, next) => {
  const allowedReferers = [
    'http://hydrology.cird.co.in',
    'https://hydrology.cird.co.in',
    'http://115.242.156.230:5000',
    'http://localhost:3000',
  ];

  const referer = req.headers.referer || '';
  if (referer && !allowedReferers.some(domain => referer.startsWith(domain))) {
    console.warn(`❌ Referer check failed for: ${referer}`);
    // Just log, don’t block the request
  }
  next();
});

// ======================================================
// 📦 DATABASE TABLES
// ======================================================
const awsTables = ['binakuli', 'mana', 'vasudhara', 'vishnu_prayag'];
const ewsTables = ['ghastoli', 'lambagad', 'sensor_data', 'vasudhara', 'binakuli', 'mana', 'khiro'];

// ======================================================
// 🌦️ API ROUTES
// ======================================================

// ✅ REAL LIVE AWS ROUTES
app.use('/api/aws-live', awsLiveRoutes);
app.use('/api/ews-live', ewsLiveRoutes);

// ✅ OTHER API ROUTES


app.use('/api/users', userRoutes);
app.use('/api/aws-live', awsForecastRoute);





// ======================================================
// 🎨 FRONTEND STATIC FILES (Next.js export build)
// ======================================================
const frontendPath = path.join(__dirname, "../hydrology/out");

app.use(express.static(frontendPath));

// ✅ Serve all non-API routes to the frontend (Next.js routing)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ======================================================
// 🏠 ROOT ENDPOINT
// ======================================================
app.get('/', (req, res) => {
  res.send('🌐 AWS-EWS Backend is Running!');
});

// ======================================================
// 🔄 KEEP-ALIVE (optional ping for Render deployment)
// ======================================================
setInterval(async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch('https://aws-ews.onrender.com/');
    console.log(`[PING] Server pinged at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error('[PING] Failed to ping:', err.message);
  }
}, 5 * 60 * 1000);

// ======================================================
// 🚀 START SERVER
// ======================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Hydrology Live API: http://localhost:${PORT}/api/aws-live`);
});

