/**
 * UNIVERSAL EWS CSV PARSER (Mana + Vasudhara)
 * UPDATED: surface_velocity from K column
 * UPDATED: charge_current & observed_current NOT divided by 1000
 * FIXED: Vasudhara water_discharge = exactly what CSV gives (0 / null / value)
 */

const fs = require("fs");
const path = require("path");
const { hydrologyDB: db } = require("../db");

/******************************************
 * STATION CONFIG
 ******************************************/
const STATIONS = [
  {
    name: "Vasudhara",
    folder: "/Hydrology/Vasudhara_EWS",
    StationID: "ST020",
    DeviceID: "32930",
    UID: "U001",
    type: "vasudhara",
  },
  {
    name: "Mana",
    folder: "/Hydrology_Backup/Mana_EWS",
    StationID: "ST019",
    DeviceID: "32929",
    UID: "U001",
    type: "mana",
  },
];

/******************************************
 * DB-BACKED CACHE (PERSISTENT)
 ******************************************/
let CACHE = {
  vasudhara: {
    avg_surface_velocity: null,
    water_discharge: null,
  },
  mana: {
    surface_velocity: null,
    avg_surface_velocity: null,
    SNR: null,
    water_discharge: null,
  },
};

/******************************************
 * LOAD LAST NON-ZERO VALUES FROM DB
 ******************************************/
async function loadLastValuesFromDB() {
  console.log("⏳ Loading last non-zero values from DB...");

  async function getLastNonZero(stId, field) {
    const [rows] = await db.query(
      `
      SELECT ${field} AS v
      FROM EWS_retrieved_db_data
      WHERE StationID = ?
        AND ${field} IS NOT NULL
        AND ${field} != 0
      ORDER BY timestamp DESC
      LIMIT 1
      `,
      [stId]
    );
    return rows.length ? parseFloat(rows[0].v) : null;
  }

  CACHE.vasudhara.avg_surface_velocity = await getLastNonZero("ST020", "avg_surface_velocity");
  CACHE.vasudhara.water_discharge = await getLastNonZero("ST020", "water_discharge");

  CACHE.mana.surface_velocity = await getLastNonZero("ST019", "surface_velocity");
  CACHE.mana.avg_surface_velocity = await getLastNonZero("ST019", "avg_surface_velocity");
  CACHE.mana.SNR = await getLastNonZero("ST019", "SNR");
  CACHE.mana.water_discharge = await getLastNonZero("ST019", "water_discharge");

  console.log("✅ Loaded last values:", CACHE);
}

/******************************************
 * GET LATEST CSV
 ******************************************/
function getLatestCSV(folder) {
  try {
    const files = fs.readdirSync(folder).filter(f => f.endsWith(".csv"));
    if (!files.length) return null;

    return files
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(folder, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0].name;
  } catch (err) {
    console.error("❌ Folder read error:", folder, err.message);
    return null;
  }
}

/******************************************
 * ✔ PARSE VASUDHARA CSV LINE (UPDATED FINAL LOGIC)
 ******************************************/
function parseVasudharaLine(parts) {
  // surface_velocity from K column
  const surface_velocity = !isNaN(parseFloat(parts[10]))
    ? parseFloat(parts[10])
    : null;

  const values = {};

  // extract index, flag, value
  for (let i = 0; i < parts.length; i++) {
    const idx = parseInt(parts[i], 10);
    if (!isNaN(idx)) {
      const flag = parts[i + 1];
      const val = parseFloat(parts[i + 2]);
      if (flag === "B" && !isNaN(val)) values[idx] = val;
    }
  }

  // ✔ FINAL FIX: water_discharge EXACTLY from CSV
  const water_discharge = values[7] ?? null;

  // No DB fallback, no last-non-zero logic
  // EXACT VALUE from CSV, even if 0 or null

  // Other parameters
  const internal_temperature = !isNaN(parseFloat(parts[31])) ? parseFloat(parts[31]) : null;
  const charge_current = !isNaN(parseFloat(parts[34])) ? parseFloat(parts[34]) : null;
  const observed_current = !isNaN(parseFloat(parts[37])) ? parseFloat(parts[37]) : null;
  const battery_voltage = !isNaN(parseFloat(parts[40])) ? parseFloat(parts[40]) : null;
  const solar_panel_tracking = !isNaN(parseFloat(parts[43])) ? parseFloat(parts[43]) : null;

  return {
    surface_velocity,
    avg_surface_velocity:
      values[2] !== undefined && values[2] !== 0
        ? values[2]
        : CACHE.vasudhara.avg_surface_velocity,

    water_dist_sensor: values[3] ?? null,
    water_level: values[4] ?? null,
    tilt_angle: values[5] ?? null,
    flow_direction: values[6] ?? null,

    // ✔ NEW REQUIRED BEHAVIOR
    water_discharge, // raw value from CSV

    SNR: null,
    internal_temperature,
    charge_current,
    observed_current,
    battery_voltage,
    solar_panel_tracking,
  };
}

/******************************************
 * PARSE MANA CSV (unchanged)
 ******************************************/
function parseManaLine(parts) {
  const B = parseFloat(parts[1]);
  const C = parseFloat(parts[2]);
  const D = parseFloat(parts[3]);
  const F = parseFloat(parts[5]);
  const G = parseFloat(parts[6]);
  const H = parseFloat(parts[7]);
  const I = parseFloat(parts[8]);

  if (!isNaN(B) && B !== 0) CACHE.mana.surface_velocity = B;
  if (!isNaN(C) && C !== 0) CACHE.mana.avg_surface_velocity = C;
  if (!isNaN(D) && D !== 0) CACHE.mana.tilt_angle = D;
  if (!isNaN(F) && F !== 0) CACHE.mana.SNR = F;
  if (!isNaN(G) && G !== 0) CACHE.mana.water_discharge = G;

  return {
    surface_velocity: CACHE.mana.surface_velocity,
    avg_surface_velocity: CACHE.mana.avg_surface_velocity,
    tilt_angle: CACHE.mana.tilt_angle,
    flow_direction: 0,
    SNR: CACHE.mana.SNR,
    water_discharge: CACHE.mana.water_discharge,
    water_dist_sensor: !isNaN(H) ? H : null,
    water_level: !isNaN(I) ? I : null,
  };
}

/******************************************
 * PARSE STATION AND INSERT DATA
 ******************************************/
const lastFileSeen = {};

function parseStation(station) {
  const latest = getLatestCSV(station.folder);
  if (!latest) return;
  if (lastFileSeen[station.name] === latest) return;

  lastFileSeen[station.name] = latest;
  const filePath = path.join(station.folder, latest);
  console.log(`📄 Processing ${station.name}: ${filePath}`);

  const content = fs.readFileSync(filePath, "utf8");
  const rows = [];

  for (const line of content.trim().split(/\r?\n/)) {
    const parts = line.split(/,|\t/).map(p => p.trim());

    const parsed =
      station.type === "mana"
        ? parseManaLine(parts)
        : parseVasudharaLine(parts);

    if (!parsed) continue;

    rows.push({
      StationID: station.StationID,
      DeviceID: station.DeviceID,
      ...parsed,
      timestamp: new Date(),
      UID: station.UID,
    });
  }

  insertRows(rows);
}

/******************************************
 * INSERT INTO DB
 ******************************************/
function insertRows(rows) {
  if (!rows.length) return;

  const sql = `
    INSERT INTO EWS_retrieved_db_data
    (StationID, DeviceID, surface_velocity, avg_surface_velocity,
     water_dist_sensor, water_level, water_discharge,
     tilt_angle, flow_direction, SNR,
     internal_temperature, charge_current, observed_current,
     battery_voltage, solar_panel_tracking,
     timestamp, UID)
    VALUES ?
  `;

  db.query(
    sql,
    [
      rows.map(r => [
        r.StationID,
        r.DeviceID,
        r.surface_velocity,
        r.avg_surface_velocity,
        r.water_dist_sensor,
        r.water_level,
        r.water_discharge,
        r.tilt_angle,
        r.flow_direction,
        r.SNR,
        r.internal_temperature,
        r.charge_current,
        r.observed_current,
        r.battery_voltage,
        r.solar_panel_tracking,
        r.timestamp,
        r.UID,
      ]),
    ],
    err =>
      err
        ? console.error("❌ DB Insert Error:", err.message)
        : console.log("✔ EWS data inserted")
  );
}

/******************************************
 * START WATCHER
 ******************************************/
async function start() {
  await loadLastValuesFromDB();

  console.log("🚀 UNIVERSAL EWS Parser STARTED...");

  STATIONS.forEach(parseStation);

  setInterval(() => {
    STATIONS.forEach(parseStation);
  }, 60000);
}

start();

