/**
 * AWS Station Parser for Lambagad, Mana & Vasudhara
 * Fetches only the LAST ROW from each CSV file and inserts into MySQL.
 */

const fs = require("fs");
const path = require("path");
const { hydrologyDB: db } = require(path.join(__dirname, "..", "db"));

// ---------- Station Configurations ----------
const stations = [
  {
    name: "Lambagad",
    folder: "/Hydrology_Backup/Lambagad_AWS",
    DeviceID: "31928",
    StationID: "ST015",
    ServicesID: "AWS",
    UID: "U001",
    expectedHeaders: [
      "Date Time", "PIR", "Avg PIR", "wind speed", "Wind Direction",
      "Rain", "TEMPERATURE", "Pressure", "Relative Humidity",
      "Bucket Weight", "Total Amount of Precipitation",
    ],
  },
  {
    name: "Mana",
    folder: "/Hydrology_Backup/Mana_AWS",
    DeviceID: "31929",
    StationID: "ST019",
    ServicesID: "AWS",
    UID: "U001",
    expectedHeaders: [
      "Date Time", "PIR", "Avg PIR", "wind speed", "Wind Direction",
      "Rain", "Temp", "Relative Humidity", "Pressure",
      "Bucket Weight", "Current Precipitation",
    ],
  },
  {
  name: "Vasudhara",
  folder: "/Hydrology_Backup/Vasudhara_AWS",   // ✅ correct path
  DeviceID: "31930",
  StationID: "ST020",
  ServicesID: "AWS",
  UID: "U001",
  expectedHeaders: [
    "Date Time", "PIR", "Avg PIR", "wind speed", "Wind Direction",
    "Rain", "TEMPERATURE", "Pressure", "Relative Humidity",
    "Bucket Weight", "Total Amount of Precipitation",
  ],
},
];

// ---------- Track last processed file ----------
const lastProcessed = {};

// ---------- Get latest CSV ----------
function getLatestCSV(folderPath) {
  const files = fs
    .readdirSync(folderPath)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(folderPath, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  return files.length ? files[0].name : null;
}

// ---------- Parse custom timestamp ----------
function parseCustomTimestamp(raw) {
  if (!raw) return null;

  const match = raw.match(
    /(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{4})\/\s*(\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) return null;

  const day = match[2];
  const month = match[3];
  const year = match[5];
  const hour = match[6];
  const minute = match[7];
  const second = match[8];

  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// ---------- Parse and Process CSV ----------
function processStation(station) {
  try {
    const latestFile = getLatestCSV(station.folder);
    if (!latestFile) return;

    if (lastProcessed[station.name] === latestFile) return;
    lastProcessed[station.name] = latestFile;

    const filePath = path.join(station.folder, latestFile);
    const content = fs.readFileSync(filePath, "utf8").trim();

    const lines = content.split(/\r?\n/).filter(Boolean);

    // Locate the header line
    const headerIndex = lines.findIndex((line) =>
      line.toLowerCase().includes("date time")
    );

    if (headerIndex === -1) return;

    const dataLines = lines.slice(headerIndex + 1);
    if (!dataLines.length) return;

    const lastLine = dataLines[dataLines.length - 1];

    const headers = lines[headerIndex].split(/,|\t/).map((h) => h.trim());
    const values = lastLine.split(/,|\t/).map((v) => v.trim());

    const getVal = (colName) => {
      const idx = headers.findIndex((h) =>
        h.toLowerCase().includes(colName.toLowerCase())
      );
      if (idx === -1) return null;

      const val = parseFloat(values[idx]);
      return isNaN(val) ? null : val;
    };

    const timestamp = parseCustomTimestamp(values[0]);

    const data = {
      DeviceID: station.DeviceID,
      StationID: station.StationID,
      ServicesID: station.ServicesID,
      UID: station.UID,
      eventStateID: "Instant",
      timestamp: timestamp || new Date(),
      PIR: getVal("PIR"),
      avg_PIR: getVal("Avg PIR"),
      windspeed: getVal("wind speed"),
      winddirection: getVal("Wind Direction"),
      rain: getVal("Rain"),
      temperature: getVal("Temp") || getVal("TEMPERATURE"),
      relative_humidity: getVal("Relative Humidity"),
      pressure: getVal("Pressure"),
      bucket_weight: getVal("Bucket Weight"),
      precipitation:
        getVal("Current Precipitation") ||
        getVal("Total Amount of Precipitation"),
    };

    insertToDB([data]);

  } catch (err) {
    console.error(`❌ Error processing ${station.name}: ${err.message}`);
  }
}

// ---------- Insert into DB ----------
function insertToDB(rows) {
  if (!rows.length) return;

  const query = `
    INSERT INTO AWS_retrieved_db_data 
    (DeviceID, StationID, ServicesID, eventStateID, windspeed, winddirection,
    temperature, relative_humidity, pressure, PIR, avg_PIR, bucket_weight,
    precipitation, rain, timestamp, UID)
    VALUES ?
  `;

  const values = rows.map((r) => [
    r.DeviceID, r.StationID, r.ServicesID, r.eventStateID,
    r.windspeed, r.winddirection, r.temperature, r.relative_humidity,
    r.pressure, r.PIR, r.avg_PIR, r.bucket_weight, r.precipitation,
    r.rain, r.timestamp, r.UID,
  ]);

  db.query(query, [values], (err) => {
    if (err) console.error("❌ DB Insert Error:", err.sqlMessage || err);
  });
}

// ---------- Scheduler ----------
function startWatcher() {
  console.log("🚀 AWS Parser Started (every 1 min)...");
  setInterval(() => stations.forEach(processStation), 60000);
}

startWatcher();

