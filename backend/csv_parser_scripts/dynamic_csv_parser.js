/**
 * DYNAMIC CSV PARSER
 * Production-ready parser supporting both FLAT column-based and INDEX_FLAG value-based CSV formats
 * Always reads ONLY the last valid data row with comprehensive validation
 */

const fs = require("fs");
const path = require("path");
const { hydrologyDB: db } = require("../db");

// Track last processed file per station
const lastProcessed = {};

/**
 * Get all active station configurations from database
 * Enhanced to support parser_type, index_mappings, and valid_flags
 */
async function getStationConfigs() {
  try {
    const [stations] = await db.query(
      `SELECT * FROM station_config WHERE is_active = TRUE`
    );

    return stations.map(station => {
      // Parse JSON fields
      const column_mappings = typeof station.column_mappings === 'string' 
        ? JSON.parse(station.column_mappings) 
        : station.column_mappings;
      
      const selected_fields = typeof station.selected_fields === 'string'
        ? JSON.parse(station.selected_fields)
        : station.selected_fields;
      
      const custom_fields = station.custom_fields 
        ? (typeof station.custom_fields === 'string' 
            ? JSON.parse(station.custom_fields) 
            : station.custom_fields)
        : null;

      // Parse new parser-related fields
      const parser_type = station.parser_type || 'AUTO';
      
      const index_mappings = station.index_mappings
        ? (typeof station.index_mappings === 'string'
            ? JSON.parse(station.index_mappings)
            : station.index_mappings)
        : null;

      const valid_flags = station.valid_flags
        ? (typeof station.valid_flags === 'string'
            ? JSON.parse(station.valid_flags)
            : station.valid_flags)
        : ['B']; // Default to ['B']

      // Validate config completeness
      if (parser_type === 'FLAT' && (!column_mappings || Object.keys(column_mappings).length === 0)) {
        console.warn(`⚠️ Station ${station.station_name} (${station.StationID}) is set to FLAT but has no column_mappings`);
      }
      
      if (parser_type === 'INDEX_FLAG' && (!index_mappings || Object.keys(index_mappings).length === 0)) {
        console.warn(`⚠️ Station ${station.station_name} (${station.StationID}) is set to INDEX_FLAG but has no index_mappings`);
      }

      return {
        ...station,
        column_mappings,
        selected_fields,
        custom_fields,
        parser_type,
        index_mappings,
        valid_flags
      };
    });
  } catch (error) {
    console.error("❌ Error fetching station configs:", error.message);
    return [];
  }
}

/**
 * Get latest CSV file from folder
 */
function getLatestCSV(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) {
      console.warn(`⚠️ Folder does not exist: ${folderPath}`);
      return null;
    }

    const files = fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith(".csv"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(folderPath, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    return files.length ? files[0].name : null;
  } catch (error) {
    console.error(`❌ Error reading folder ${folderPath}:`, error.message);
    return null;
  }
}

/**
 * Enhanced CSV reading function
 * Reads file, filters empty lines, normalizes line endings
 */
function readCSVFile(csvPath) {
  try {
    const content = fs.readFileSync(csvPath, "utf8");
    // Split by any line ending and filter empty lines
    const lines = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    return lines;
  } catch (error) {
    console.error(`❌ Error reading CSV file ${csvPath}:`, error.message);
    return null;
  }
}

/**
 * Extract the last valid data row from CSV lines
 * Skips headers, metadata, blank lines, and footer text
 */
function extractLastValidRow(lines) {
  if (!lines || lines.length === 0) {
    return null;
  }

  // Common header keywords to skip
  const headerKeywords = ['date', 'time', 'timestamp', 'column', 'header', 'field', 'parameter'];
  
  // Iterate from end backwards
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    // Skip blank lines
    if (!line || line.length === 0) {
      continue;
    }

    // Skip header-like lines (contain header keywords)
    const lowerLine = line.toLowerCase();
    const isHeader = headerKeywords.some(keyword => lowerLine.includes(keyword));
    if (isHeader) {
      continue;
    }

    // Split by comma or tab
    const parts = line.split(/,|\t/).map(p => p.trim()).filter(p => p.length > 0);
    
    // Must have at least 3 non-empty fields
    if (parts.length < 3) {
      continue;
    }

    // Must contain at least one numeric value (not all text)
    const hasNumeric = parts.some(part => {
      const num = parseFloat(part);
      return !isNaN(num) && isFinite(num);
    });

    if (!hasNumeric) {
      continue; // Likely footer text or metadata
    }

    // This looks like a valid data row
    return line;
  }

  // No valid row found
  return null;
}

/**
 * Detect CSV format (FLAT vs INDEX_FLAG)
 * Analyzes last 3-5 non-empty rows for pattern matching
 */
function detectCSVFormat(lines, stationConfig) {
  // If parser_type is explicitly set, use it
  if (stationConfig.parser_type && stationConfig.parser_type !== 'AUTO') {
    return stationConfig.parser_type;
  }

  // For AUTO mode, analyze last rows
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    console.error(`❌ No data lines found for format detection`);
    return null;
  }

  // Analyze last 3-5 rows (or all if fewer)
  const rowsToAnalyze = Math.min(5, nonEmptyLines.length);
  const lastRows = nonEmptyLines.slice(-rowsToAnalyze);

  let indexFlagMatches = 0;
  let flatMatches = 0;

  // Pattern for INDEX_FLAG: repeating triplets of (number, letter, number)
  // Example: "2,B,0.67,7,B,123.45,5,B,1.2"
  const indexFlagPattern = /^\d+,[A-Za-z],[\d.-]+/;
  const tripletPattern = /\d+,[A-Za-z],[\d.-]+/g;

  for (const row of lastRows) {
    const parts = row.split(/,|\t/).map(p => p.trim());
    
    // Check for INDEX_FLAG pattern
    // Must have at least 3 triplets (index, flag, value)
    const triplets = row.match(tripletPattern);
    if (triplets && triplets.length >= 3) {
      // Verify pattern: number, letter, number
      let validTriplets = 0;
      for (let i = 0; i < parts.length - 2; i += 3) {
        const idx = parseInt(parts[i], 10);
        const flag = parts[i + 1];
        const val = parseFloat(parts[i + 2]);
        if (!isNaN(idx) && /^[A-Za-z]$/.test(flag) && !isNaN(val)) {
          validTriplets++;
        }
      }
      if (validTriplets >= 2) {
        indexFlagMatches++;
      }
    }

    // Check for FLAT pattern
    // Consistent column count, not all triplets
    if (parts.length >= 3) {
      const columnCountVariance = Math.abs(parts.length - (lastRows[0]?.split(/,|\t/).length || 0));
      const variancePercent = (columnCountVariance / parts.length) * 100;
      
      // If column count is consistent (variance < 20%) and doesn't look like triplets
      if (variancePercent < 20 && (!triplets || triplets.length < 3)) {
        flatMatches++;
      }
    }
  }

  // Decision logic
  if (indexFlagMatches >= 2) {
    console.log(`📊 Format detected: INDEX_FLAG (${indexFlagMatches}/${rowsToAnalyze} rows matched)`);
    return 'INDEX_FLAG';
  } else if (flatMatches >= 2) {
    console.log(`📊 Format detected: FLAT (${flatMatches}/${rowsToAnalyze} rows matched)`);
    return 'FLAT';
  } else {
    console.error(`❌ Unable to detect CSV format. INDEX_FLAG matches: ${indexFlagMatches}, FLAT matches: ${flatMatches}`);
    return null;
  }
}

/**
 * Convert column letter (A, B, C...) to index (0, 1, 2...)
 */
function columnLetterToIndex(letter) {
  if (!letter || typeof letter !== 'string') return -1;
  const upper = letter.toUpperCase().trim();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1;
}

/**
 * Parse custom timestamp format (DD/MM/YY/HH/YYYY HH:MM:SS)
 */
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

/**
 * Parse FLAT column-based CSV
 * Uses column mappings (A, B, C...) to extract data
 */
function parseFlatColumnCSV(csvPath, columnMappings, selectedFields, customFields, lastRow) {
  try {
    if (!lastRow) {
      console.warn(`⚠️ No last row provided for FLAT parsing: ${csvPath}`);
      return null;
    }

    // Parse line (handle both comma and tab separated)
    const values = lastRow.split(/,|\t/).map((v) => v.trim());

    // Build data object using column mappings
    const data = {};

    // Parse timestamp
    // Try to find timestamp column in mappings
    const timestampColumnLetter = Object.keys(columnMappings).find(
      letter => columnMappings[letter] === 'timestamp'
    ) || 'A'; // Default to column A

    const timestampIndex = columnLetterToIndex(timestampColumnLetter);
    const timestampRaw = timestampIndex >= 0 && timestampIndex < values.length 
      ? values[timestampIndex] 
      : values[0]; // Fallback to first column

    const timestamp = parseCustomTimestamp(timestampRaw) || new Date();
    data.timestamp = timestamp;

    // Map all selected fields using column mappings
    for (const field of selectedFields) {
      // Find which column letter maps to this field
      const columnLetter = Object.keys(columnMappings).find(
        letter => columnMappings[letter] === field
      );

      if (columnLetter) {
        const columnIndex = columnLetterToIndex(columnLetter);
        if (columnIndex >= 0 && columnIndex < values.length) {
          const value = values[columnIndex];
          if (value && value.length > 0) {
            // Try to parse as number
            const numValue = parseFloat(value);
            data[field] = isNaN(numValue) ? (value || null) : numValue;
          } else {
            data[field] = null;
          }
        } else {
          data[field] = null;
        }
      } else {
        // Guard: Log warning if expected mapping is missing
        console.warn(`⚠️ Field "${field}" in selected_fields has no column mapping for ${csvPath}`);
        data[field] = null;
      }
    }

    // Handle custom fields
    if (customFields && customFields.length > 0) {
      for (const customField of customFields) {
        const columnIndex = columnLetterToIndex(customField.column);
        if (columnIndex >= 0 && columnIndex < values.length) {
          const value = values[columnIndex];
          if (value && value.length > 0) {
            // Parse based on field type
            if (customField.type.includes('DECIMAL') || customField.type.includes('DOUBLE') || customField.type.includes('FLOAT')) {
              const numValue = parseFloat(value);
              data[customField.name] = isNaN(numValue) ? null : numValue;
            } else {
              data[customField.name] = value || null;
            }
          } else {
            data[customField.name] = null;
          }
        } else {
          data[customField.name] = null;
        }
      }
    }

    return data;
  } catch (error) {
    console.error(`❌ Error parsing FLAT CSV ${csvPath}:`, error.message);
    return null;
  }
}

/**
 * Parse INDEX_FLAG value-based CSV
 * Extracts triplets (index, flag, value) and maps using index_mappings
 */
function parseIndexFlagCSV(csvPath, indexMappings, selectedFields, validFlags, lastRow) {
  try {
    if (!lastRow) {
      console.warn(`⚠️ No last row provided for INDEX_FLAG parsing: ${csvPath}`);
      return null;
    }

    if (!indexMappings || Object.keys(indexMappings).length === 0) {
      console.error(`❌ No index_mappings provided for INDEX_FLAG parsing: ${csvPath}`);
      return null;
    }

    // Split row by comma or tab
    const parts = lastRow.split(/,|\t/).map(p => p.trim());

    // Extract triplets: (index, flag, value)
    // Triplets may be consecutive (i, i+1, i+2) or scattered throughout the row
    const data = {};
    const foundFields = new Set();

    // Process all possible triplets in the row
    // Look for pattern: number, letter, number (index, flag, value)
    for (let i = 0; i < parts.length - 2; i++) {
      const indexStr = parts[i];
      const flag = parts[i + 1];
      const valueStr = parts[i + 2];

      // Check if this looks like a triplet
      const index = parseInt(indexStr, 10);
      const isIndex = !isNaN(index) && index >= 0;
      const isFlag = /^[A-Za-z]$/.test(flag);
      const value = parseFloat(valueStr);
      const isValue = !isNaN(value) && isFinite(value);

      if (isIndex && isFlag && isValue) {
        // This is a valid triplet pattern
        // Validate flag
        if (!validFlags.includes(flag)) {
          continue; // Skip invalid flags
        }

        // Map index to field name
        const indexKey = index.toString();
        const fieldName = indexMappings[indexKey];

        if (fieldName) {
          data[fieldName] = value;
          foundFields.add(fieldName);
        }
        // Skip next two parts since we've consumed them
        i += 2;
      }
    }

    // Set missing fields to null
    for (const field of selectedFields) {
      if (!foundFields.has(field)) {
        data[field] = null;
      }
    }

    // Handle timestamp (use system time for INDEX_FLAG format)
    // Could be enhanced to look for timestamp in a specific position if needed
    data.timestamp = new Date();

    return data;
  } catch (error) {
    console.error(`❌ Error parsing INDEX_FLAG CSV ${csvPath}:`, error.message);
    return null;
  }
}

/**
 * Validate and sanitize parsed data
 * Ensures no NaN, correct types, and required fields
 */
function validateParsedData(data, selectedFields) {
  if (!data) {
    return null;
  }

  // Validate timestamp
  if (!(data.timestamp instanceof Date) || isNaN(data.timestamp.getTime())) {
    console.warn(`⚠️ Invalid timestamp, using current time`);
    data.timestamp = new Date();
  }

  // Validate and sanitize each field
  for (const field of selectedFields) {
    if (data[field] === undefined) {
      data[field] = null;
      continue;
    }

    const value = data[field];

    // If value is NaN, set to null
    if (typeof value === 'number' && isNaN(value)) {
      console.warn(`⚠️ Field "${field}" has NaN value, setting to null`);
      data[field] = null;
      continue;
    }

    // Ensure numeric fields are numbers or null
    // (We assume all selected_fields are numeric based on database schema)
    if (value !== null && typeof value !== 'number') {
      // Try to convert to number
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && isFinite(numValue)) {
        data[field] = numValue;
      } else {
        console.warn(`⚠️ Field "${field}" has non-numeric value "${value}", setting to null`);
        data[field] = null;
      }
    }
  }

  return data;
}

/**
 * Main CSV parsing function with format detection and routing
 * REPLACES the old parseCSVWithMapping function
 */
function parseCSVWithMapping(csvPath, stationConfig) {
  try {
    // Read CSV file
    const lines = readCSVFile(csvPath);
    if (!lines || lines.length === 0) {
      console.warn(`⚠️ Empty or unreadable CSV: ${csvPath}`);
      return null;
    }

    // Extract last valid row
    const lastRow = extractLastValidRow(lines);
    if (!lastRow) {
      console.warn(`⚠️ No valid data row found in: ${csvPath}`);
      return null;
    }

    // Get parser type
    const parserType = stationConfig.parser_type || 'AUTO';

    // Detect format if AUTO
    let format = parserType;
    if (parserType === 'AUTO') {
      format = detectCSVFormat(lines, stationConfig);
      if (!format) {
        console.error(`❌ Failed to detect CSV format for: ${csvPath}`);
        return null;
      }
    }

    console.log(`📄 Parsing ${csvPath} as ${format} format`);

    // Route to appropriate parser
    let parsedData = null;

    if (format === 'FLAT') {
      if (!stationConfig.column_mappings || Object.keys(stationConfig.column_mappings).length === 0) {
        console.error(`❌ FLAT format requires column_mappings for: ${csvPath}`);
        return null;
      }
      parsedData = parseFlatColumnCSV(
        csvPath,
        stationConfig.column_mappings,
        stationConfig.selected_fields,
        stationConfig.custom_fields,
        lastRow
      );
    } else if (format === 'INDEX_FLAG') {
      if (!stationConfig.index_mappings || Object.keys(stationConfig.index_mappings).length === 0) {
        console.error(`❌ INDEX_FLAG format requires index_mappings for: ${csvPath}`);
        return null;
      }
      parsedData = parseIndexFlagCSV(
        csvPath,
        stationConfig.index_mappings,
        stationConfig.selected_fields,
        stationConfig.valid_flags || ['B'],
        lastRow
      );
    } else {
      console.error(`❌ Unknown format: ${format} for: ${csvPath}`);
      return null;
    }

    if (!parsedData) {
      console.warn(`⚠️ Parser returned null for: ${csvPath}`);
      return null;
    }

    // Validate parsed data
    const validatedData = validateParsedData(parsedData, stationConfig.selected_fields);
    
    if (!validatedData) {
      console.error(`❌ Data validation failed for: ${csvPath}`);
      return null;
    }

    console.log(`✅ Successfully parsed ${format} CSV: ${csvPath}`);
    return validatedData;
  } catch (error) {
    console.error(`❌ Error parsing CSV ${csvPath}:`, error.message);
    return null;
  }
}

/**
 * Insert station data into appropriate table
 */
async function insertStationData(stationConfig, parsedData) {
  try {
    const { StationID, ServicesID, DeviceID, selected_fields, custom_fields } = stationConfig;
    const tableName = ServicesID === "AWS" ? "AWS_retrieved_db_data" : "EWS_retrieved_db_data";

    // Build column list and values
    const columns = ['DeviceID', 'StationID', 'ServicesID', 'timestamp', 'UID'];
    const values = [DeviceID, StationID, ServicesID, parsedData.timestamp, 'U001'];

    // Add eventStateID for AWS
    if (ServicesID === "AWS") {
      columns.push('eventStateID');
      values.push('Instant');
    }

    // Add selected fields
    for (const field of selected_fields) {
      if (parsedData[field] !== undefined) {
        columns.push(field);
        values.push(parsedData[field]);
      }
    }

    // Add custom fields
    if (custom_fields && custom_fields.length > 0) {
      for (const customField of custom_fields) {
        if (parsedData[customField.name] !== undefined) {
          columns.push(customField.name);
          values.push(parsedData[customField.name]);
        }
      }
    }

    // Build INSERT query
    const placeholders = columns.map(() => '?').join(', ');
    const columnNames = columns.map(col => `\`${col}\``).join(', ');

    const query = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})
                   ON DUPLICATE KEY UPDATE
                   ${columns.slice(3).map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`;

    await db.query(query, values);
    console.log(`✅ Inserted data for ${StationID} (${ServicesID})`);
  } catch (error) {
    console.error(`❌ Error inserting data for ${stationConfig.StationID}:`, error.message);
  }
}

/**
 * Process a single station
 * Updated to use new parseCSVWithMapping signature
 */
async function processStation(stationConfig) {
  try {
    const { StationID, ServicesID, station_name, csv_folder_path } = stationConfig;
    const stationKey = `${StationID}_${ServicesID}`;

    // Get latest CSV
    const latestFile = getLatestCSV(csv_folder_path);
    if (!latestFile) {
      console.warn(`⚠️ No CSV found for ${station_name} (${StationID})`);
      return;
    }

    // Check if already processed
    if (lastProcessed[stationKey] === latestFile) {
      return; // Already processed this file
    }

    const filePath = path.join(csv_folder_path, latestFile);
    console.log(`📄 Processing ${station_name}: ${latestFile}`);

    // Parse CSV with new signature (passes entire stationConfig)
    const parsedData = parseCSVWithMapping(filePath, stationConfig);

    if (!parsedData) {
      console.warn(`⚠️ Failed to parse CSV for ${station_name}`);
      return;
    }

    // Insert into database
    await insertStationData(stationConfig, parsedData);

    // Mark as processed
    lastProcessed[stationKey] = latestFile;
  } catch (error) {
    console.error(`❌ Error processing station ${stationConfig.station_name}:`, error.message);
  }
}

/**
 * Process all stations
 */
async function processAllStations() {
  try {
    const stations = await getStationConfigs();
    console.log(`🔄 Processing ${stations.length} stations...`);

    for (const station of stations) {
      await processStation(station);
    }

    console.log(`✅ Completed processing all stations`);
  } catch (error) {
    console.error("❌ Error processing stations:", error.message);
  }
}

/**
 * Start watcher (runs periodically)
 */
function startWatcher(intervalMinutes = 5) {
  console.log(`🚀 Starting dynamic CSV parser (checking every ${intervalMinutes} minutes)...`);

  // Process immediately
  processAllStations();

  // Then process every N minutes
  setInterval(() => {
    processAllStations();
  }, intervalMinutes * 60 * 1000);
}

// Export for use in other scripts
module.exports = {
  getStationConfigs,
  parseCSVWithMapping,
  insertStationData,
  processStation,
  processAllStations,
  startWatcher,
  // Export helper functions for testing
  readCSVFile,
  extractLastValidRow,
  detectCSVFormat,
  parseFlatColumnCSV,
  parseIndexFlagCSV,
  validateParsedData
};

// If run directly, start the watcher
if (require.main === module) {
  startWatcher(5);
}
