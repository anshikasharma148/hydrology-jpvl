/**
 * Script to check Mana EWS station status and data
 * Run with: node check_mana_status.js (from backend directory)
 */

const path = require('path');
const { hydrologyDB } = require('./backend/db');

async function checkManaStatus() {
  try {

    console.log('🔍 Checking Mana EWS Station Status and Data...\n');

    // 1. Check station_status table
    console.log('1️⃣ Checking station_status table:');
    const [statusRows] = await hydrologyDB.query(
      `SELECT * FROM station_status 
       WHERE station_id = 'ST019' AND service_type = 'EWS'`
    );
    
    if (statusRows.length > 0) {
      console.log('   ✅ Found status record:');
      console.log(`      Status: ${statusRows[0].status}`);
      console.log(`      Timestamp: ${statusRows[0].status_timestamp || 'N/A'}`);
      console.log(`      Notes: ${statusRows[0].notes || 'N/A'}`);
      console.log(`      Updated: ${statusRows[0].updated_at}`);
    } else {
      console.log('   ℹ️  No manual status set (using auto-detection)');
    }

    // 2. Check latest data in EWS_retrieved_db_data
    console.log('\n2️⃣ Checking latest data in EWS_retrieved_db_data:');
    const [dataRows] = await hydrologyDB.query(
      `SELECT 
         timestamp,
         surface_velocity,
         avg_surface_velocity,
         water_level,
         water_discharge,
         water_dist_sensor,
         tilt_angle,
         flow_direction,
         SNR,
         internal_temperature,
         charge_current,
         observed_current,
         battery_voltage,
         solar_panel_tracking
       FROM EWS_retrieved_db_data
       WHERE StationID = 'ST019'
       ORDER BY timestamp DESC
       LIMIT 5`
    );

    if (dataRows.length > 0) {
      console.log(`   ✅ Found ${dataRows.length} recent record(s):`);
      dataRows.forEach((row, idx) => {
        console.log(`\n   Record ${idx + 1} (${row.timestamp}):`);
        console.log(`      Water Level: ${row.water_level ?? 'NULL'}`);
        console.log(`      Water Discharge: ${row.water_discharge ?? 'NULL'}`);
        console.log(`      Surface Velocity: ${row.surface_velocity ?? 'NULL'}`);
        console.log(`      Avg Surface Velocity: ${row.avg_surface_velocity ?? 'NULL'}`);
        console.log(`      Water Distance: ${row.water_dist_sensor ?? 'NULL'}`);
        console.log(`      Tilt Angle: ${row.tilt_angle ?? 'NULL'}`);
        console.log(`      Flow Direction: ${row.flow_direction ?? 'NULL'}`);
        console.log(`      SNR: ${row.SNR ?? 'NULL'}`);
        console.log(`      Internal Temp: ${row.internal_temperature ?? 'NULL'}`);
        console.log(`      Charge Current: ${row.charge_current ?? 'NULL'}`);
        console.log(`      Observed Current: ${row.observed_current ?? 'NULL'}`);
        console.log(`      Battery Voltage: ${row.battery_voltage ?? 'NULL'}`);
        console.log(`      Solar Panel: ${row.solar_panel_tracking ?? 'NULL'}`);
      });
      
      // Check if data is recent
      const latestTimestamp = new Date(dataRows[0].timestamp);
      const now = new Date();
      const diffMinutes = (now - latestTimestamp) / (1000 * 60);
      console.log(`\n   ⏰ Latest data is ${diffMinutes.toFixed(1)} minutes old`);
      
      if (diffMinutes > 20) {
        console.log('   ⚠️  Data is older than 20 minutes (would be auto-detected as offline)');
      } else {
        console.log('   ✅ Data is recent (would be auto-detected as live)');
      }
    } else {
      console.log('   ❌ No data found in database');
    }

    // 3. Check station_config
    console.log('\n3️⃣ Checking station_config:');
    const [configRows] = await hydrologyDB.query(
      `SELECT station_name, StationID, ServicesID, selected_fields, is_active
       FROM station_config
       WHERE StationID = 'ST019' AND ServicesID = 'EWS'`
    );
    
    if (configRows.length > 0) {
      console.log('   ✅ Station configuration:');
      console.log(`      Name: ${configRows[0].station_name}`);
      console.log(`      StationID: ${configRows[0].StationID}`);
      console.log(`      Active: ${configRows[0].is_active ? 'Yes' : 'No'}`);
      console.log(`      Selected Fields: ${JSON.stringify(JSON.parse(configRows[0].selected_fields || '[]'))}`);
    } else {
      console.log('   ❌ Station not found in station_config');
    }

    console.log('\n📊 Summary:');
    if (statusRows.length > 0 && statusRows[0].status === 'maintenance') {
      console.log('   🔧 Status: MAINTENANCE (This is why "NIL" is shown)');
      if (dataRows.length > 0) {
        console.log('   📈 Data exists in database but is hidden due to maintenance status');
        console.log('   💡 To show data: Change status from "Maintenance" to "Live" in admin panel');
      }
    } else if (dataRows.length === 0) {
      console.log('   ❌ No data in database');
    } else if (dataRows.length > 0) {
      const latestTimestamp = new Date(dataRows[0].timestamp);
      const now = new Date();
      const diffMinutes = (now - latestTimestamp) / (1000 * 60);
      if (diffMinutes > 20) {
        console.log('   ⚠️  Status: OFFLINE (data is too old)');
      } else {
        console.log('   ✅ Status: LIVE (data is recent)');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkManaStatus();

