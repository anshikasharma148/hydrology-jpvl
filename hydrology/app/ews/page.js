'use client';
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  MapPin, Waves, Gauge, Droplets,
  AlertTriangle, Compass, ArrowLeft,
  Thermometer, Battery, BatteryCharging, Zap, Sun,
  Activity, Ruler
} from "lucide-react";

import Navbar from "../../components/Navbar";
import EWSDashboardGraph from "../../components/EWSDashboardGraph";
import { useStationStatus } from "../../hooks/useStationStatus";
import { useStations } from "../../hooks/useStations";

const SplashScreen = dynamic(() => import("../../components/SplashScreen"), { ssr: false });

export default function EWSPage() {
  const router = useRouter();
  const { ewsStations: ewsStationsData, loading: stationsLoading } = useStations();

  const [liveStations, setLiveStations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { getStationStatus } = useStationStatus();
  
  // Build Station ID mapping dynamically
  const STATION_ID_MAP = React.useMemo(() => {
    const map = {};
    ewsStationsData.forEach(station => {
      map[station.station_name] = station.StationID;
    });
    return map;
  }, [ewsStationsData]);

  // INIT THEME
  useEffect(() => {
    const savedTheme = localStorage.getItem("ews_theme");
    if (savedTheme === "light") setIsDarkMode(false);
    if (savedTheme === "dark") setIsDarkMode(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem("ews_theme", nextTheme ? "dark" : "light");
  };

  // FETCH STATION DATA
  useEffect(() => {
    // Don't fetch if stations are still loading
    if (stationsLoading || ewsStationsData.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch("https://hydrology-jpvl.onrender.com/api/ews-live/all", {
          headers: { "Authorization": `Bearer ${token}` },
        });

        const json = await res.json();
        
        // Process data to ensure timestamp matches the candidate record used for data
        // Only process stations that exist in our dynamic list
        const processedData = {};
        if (json?.data) {
          // Create a map of station name to config for quick lookup
          const stationConfigMap = {};
          ewsStationsData.forEach(config => {
            stationConfigMap[config.station_name] = config;
          });
          
          // Filter to only include stations from our dynamic list
          const validStationNames = ewsStationsData.map(s => s.station_name);
          Object.entries(json.data).forEach(([station, arr]) => {
            // Only process if station is in our dynamic list
            if (!validStationNames.includes(station)) return;
            
            const stationConfig = stationConfigMap[station];
            const selectedFields = stationConfig?.selected_fields || [];
            
            if (Array.isArray(arr) && arr.length > 0) {
              // Find latest record by timestamp
              const latestRecord = arr.reduce((latest, current) => {
                const latestTime = new Date(latest.timestamp || 0).getTime();
                const currentTime = new Date(current.timestamp || 0).getTime();
                return currentTime > latestTime ? current : latest;
              }, arr[0]);
              
              // Find candidate with valid data - use selectedFields dynamically
              let candidate = latestRecord;
              if (selectedFields.length > 0) {
                // Check if any selected field has valid data
                candidate = arr.find((r) =>
                  selectedFields.some(field => {
                    const value = r[field];
                    return value !== null && value !== undefined && value !== "";
                  })
                ) || latestRecord;
              } else {
                // Fallback to checking common fields if no selectedFields
                candidate = arr.find((r) =>
                  [r.water_level, r.avg_surface_velocity, r.surface_velocity, r.water_dist_sensor, r.water_discharge, r.tilt_angle, r.flow_direction]
                    .some((x) => x !== null && x !== undefined && x !== "")
                ) || latestRecord;
              }
              
              // Fix timestamp format if needed
              const fixTimestamp = (ts) => {
                if (!ts) return null;
                if (ts.includes(" ") && !ts.includes("T")) {
                  return ts.replace(" ", "T") + "Z";
                }
                return ts;
              };
              
              // Use candidate timestamp (same record as data), fallback to latestRecord if missing
              processedData[station] = [{
                ...candidate,
                timestamp: fixTimestamp(candidate.timestamp) ?? fixTimestamp(latestRecord.timestamp),
              }];
            } else {
              // No data - create empty entry
              processedData[station] = [{
                StationID: stationConfig?.StationID ?? null,
                DeviceID: stationConfig?.DeviceID ?? null,
                timestamp: null,
              }];
            }
          });
          
          // Ensure ALL stations from ewsStationsData appear, even if API didn't return them
          ewsStationsData.forEach(config => {
            const stationName = config.station_name;
            if (!processedData[stationName]) {
              processedData[stationName] = [{
                StationID: config.StationID ?? null,
                DeviceID: config.DeviceID ?? null,
                timestamp: null,
              }];
            }
          });
        } else {
          // If json.data is empty or missing, create entries for all stations
          ewsStationsData.forEach(config => {
            processedData[config.station_name] = [{
              StationID: config.StationID ?? null,
              DeviceID: config.DeviceID ?? null,
              timestamp: null,
            }];
          });
        }
        
        setLiveStations(processedData);

      } catch (err) {
        console.error("Fetch error:", err);
      }

      setIsLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [stationsLoading, ewsStationsData]);

  // helpers
  const safeNum = (v, fixed = 2, isMaintenance = false) => {
    if (isMaintenance) return "NIL";
    if (v === null || v === undefined || v === "") return "--";
    const n = parseFloat(v);
    return isNaN(n) ? "--" : n.toFixed(fixed);
  };

  const formatFlowDirection = (v) => {
    if (v === null || v === undefined || v === "") return "--";

    const num = Number(v);

    if (!isNaN(num) && num === 0) return "Incoming";

    return isNaN(num) ? "--" : `${num.toFixed(2)}°`;
  };

  const statusType = (v) => {
    const n = parseFloat(v);
    if (isNaN(n)) return "normal";
    if (n > 100) return "alert";
    if (n > 70) return "warning";
    return "normal";
  };

  const isOffline = (stationName, ts) => {
    const stationId = STATION_ID_MAP[stationName];
    if (!stationId) {
      // Fallback to old logic if station not in map
    if (!ts) return true;
    const diffMin = (Date.now() - new Date(ts).getTime()) / 60000;
    return diffMin > 20;
    }
    const statusInfo = getStationStatus(stationId, "EWS", ts, 20);
    return statusInfo.status !== "live";
  };
  
  const getStationStatusInfo = (stationName, ts) => {
    const stationId = STATION_ID_MAP[stationName];
    if (!stationId) return { status: "offline", isManual: false, offlineTimestamp: null };
    return getStationStatus(stationId, "EWS", ts, 20);
  };

  const formattedTime = (ts) => {
    if (!ts) return "--";
    // Remove the timezone indicator "Z" so browser doesn't convert UTC → local time.
    const clean = ts.replace("Z", "");
    // Create date as if the timestamp is already local sensor time
    const d = new Date(clean);
    if (isNaN(d.getTime())) return "--";
    return d.toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className={`relative w-full min-h-screen transition-colors duration-500 ${
        isDarkMode
          ? "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white"
          : "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 text-slate-900"
      }`}
    >
      <Navbar />

      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />

      {/* Back Button */}
      <button
        onClick={() => router.push("/dashboard")}
        className={`fixed top-16 sm:top-20 left-3 sm:left-4 md:left-6 p-2 sm:p-2.5 rounded-full shadow-lg z-40 transition-all hover:scale-110 ${
          isDarkMode 
            ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-600" 
            : "bg-white hover:bg-blue-50 text-slate-800 border border-blue-200"
        }`}
        title="Go back to Dashboard"
      >
        <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      <button
        onClick={toggleTheme}
        className={`fixed top-16 sm:top-20 right-3 sm:right-4 md:right-6 p-1.5 sm:p-2 rounded-full shadow-lg z-40 ${
          isDarkMode ? "bg-slate-800" : "bg-amber-200"
        }`}
      >
        <div className="relative w-10 h-5 sm:w-12 sm:h-6">
          <div className={`absolute inset-0 rounded-full ${isDarkMode ? "bg-slate-700" : "bg-amber-200"}`} />
          <div className={`absolute w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all shadow ${
            isDarkMode ? "left-5 sm:left-6 bg-slate-900" : "left-0 bg-yellow-500"
          }`} />
        </div>
      </button>

      <div className="flex flex-col items-center text-center pt-16 sm:pt-20 md:pt-24 relative z-20 px-4">
        <h1 className="text-xl sm:text-3xl md:text-5xl font-bold tracking-wide animate-fade-slide">
          <span className={`${isDarkMode ? "text-yellow-400" : "text-blue-600"} text-3xl sm:text-5xl md:text-7xl font-extrabold`}>E</span>
          arly
          <span className={`ml-1 sm:ml-2 ${isDarkMode ? "text-yellow-400" : "text-blue-600"} text-3xl sm:text-5xl md:text-7xl font-extrabold`}>W</span>
          arning
          <span className={`ml-1 sm:ml-2 ${isDarkMode ? "text-yellow-400" : "text-blue-600"} text-3xl sm:text-5xl md:text-7xl font-extrabold`}>S</span>
          ystem
        </h1>
      </div>

      <div className="flex justify-center items-start mt-6 sm:mt-8 md:mt-10 px-3 sm:px-4 md:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4 md:gap-6 w-full max-w-7xl mx-auto">

          {ewsStationsData.map((stationConfig) => {
            const station = stationConfig.station_name;
            const item = liveStations[station]?.[0] || null;
            const selectedFields = stationConfig.selected_fields || [];

            const status = statusType(item?.water_discharge);
            const statusInfo = getStationStatusInfo(station, item?.timestamp);
            const offline = statusInfo.status !== "live";
            const isMaintenance = statusInfo.status === "maintenance";

            return (
              <div
                key={station}
                className={`
                  w-full
                  h-auto min-h-[320px] sm:min-h-[400px] md:min-h-[390px] lg:min-h-[550px]
                  rounded-lg sm:rounded-xl border shadow-lg sm:shadow-2xl p-3 sm:p-4 md:p-5
                  transition-all duration-300

                  ${isDarkMode
                    ? "bg-gradient-to-br from-slate-800 to-slate-900 text-gray-200 border-slate-700"
                    : "bg-gradient-to-br from-white to-blue-50 text-slate-800 border-blue-200"
                  }

                  ${status === "alert" ? "border-red-500 shadow-red-500/40 animate-pulse" : ""}
                  ${status === "warning" ? "border-yellow-500 shadow-yellow-500/30" : ""}
                `}
              >
                {/* HEADER */}
                <div className="flex justify-between items-center mb-2 sm:mb-3 gap-1">
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">

                    {/* CLICKABLE STATION NAME */}
                    <MapPin size={12} className={`flex-shrink-0 ${isDarkMode ? "text-blue-400" : "text-blue-700"}`} />

                    <span
                      onClick={() => router.push(`/ews/${station.toLowerCase()}`)}
                      className="text-xs sm:text-sm md:text-lg font-bold cursor-pointer hover:underline hover:text-blue-400 transition truncate"
                    >
                      {station}
                    </span>

                    {isMaintenance
                      ? <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-yellow-500 rounded-full flex-shrink-0" />
                      : offline
                      ? <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full flex-shrink-0" />
                      : <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-green-400 rounded-full animate-ping flex-shrink-0" />
                    }
                  </div>

                  {status !== "normal" && (
                    <div
                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-semibold flex items-center gap-0.5 sm:gap-1 flex-shrink-0 ${
                        status === "alert"
                          ? "bg-red-500/20 text-red-400 border border-red-400/40"
                          : "bg-yellow-400/20 text-yellow-700 border border-yellow-500/40"
                      }`}
                    >
                      <AlertTriangle size={10} className="sm:w-3 sm:h-3" />
                      <span className="hidden sm:inline">{status === "alert" ? "ALERT" : "WARNING"}</span>
                      <span className="sm:hidden">{status === "alert" ? "!" : "!"}</span>
                    </div>
                  )}
                </div>

                <p className="text-[10px] sm:text-xs opacity-70 mb-2 sm:mb-3">
                  Updated: {statusInfo.status === "offline" && statusInfo.offlineTimestamp 
                    ? formattedTime(statusInfo.offlineTimestamp) 
                    : item?.timestamp ? formattedTime(item.timestamp) : "No timestamp"}
                </p>

                <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                  {/* Water Discharge - only if selected */}
                  {selectedFields.includes('water_discharge') && (
                  <div className={`p-2 sm:p-2.5 md:p-3 rounded-md sm:rounded-lg flex justify-between items-center gap-1 ${
                    status === "alert" || status === "warning"
                      ? isDarkMode ? "bg-red-500/20 border border-red-500/40" : "bg-red-100/70 border border-red-300"
                      : isDarkMode ? "bg-green-500/20 border border-green-500/40" : "bg-green-100/70 border border-green-300"
                  }`}>
                    <span className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm">
                      <Droplets size={10} className={`sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 flex-shrink-0 ${
                        status === "alert" || status === "warning" ? "text-red-400" : "text-green-400"
                      }`} /> 
                      <span className="truncate font-semibold">Discharge</span>
                    </span>
                    <span className={`font-mono text-[10px] sm:text-xs md:text-sm flex-shrink-0 font-semibold ${
                      status === "alert" || status === "warning" ? "text-red-400" : "text-green-400"
                      }`}>{safeNum(item?.water_discharge, 2, isMaintenance)} {isMaintenance ? "" : "m³/s"}</span>
                  </div>
                  )}

                  {/* Water Level - only if selected */}
                  {selectedFields.includes('water_level') && (
                  <div className={`p-2 sm:p-2.5 md:p-3 rounded-md sm:rounded-lg flex justify-between items-center gap-1 ${
                    isDarkMode ? "bg-slate-800/30" : "bg-blue-100/50"
                  }`}>
                    <span className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm">
                      <Waves size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-blue-400 flex-shrink-0" /> 
                      <span className="truncate">Level</span>
                    </span>
                      <span className="font-mono text-[10px] sm:text-xs md:text-sm flex-shrink-0">{safeNum(item?.water_level, 2, isMaintenance)} {isMaintenance ? "" : "m"}</span>
                  </div>
                  )}

                  {/* Surface Velocity - only if selected */}
                  {selectedFields.includes('surface_velocity') && (
                  <div className={`p-2 sm:p-2.5 md:p-3 rounded-md sm:rounded-lg flex justify-between items-center gap-1 ${
                    isDarkMode ? "bg-slate-800/30" : "bg-blue-100/50"
                  }`}>
                    <span className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm">
                      <Activity size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-blue-400 flex-shrink-0" />
                      <span className="truncate">Velocity</span>
                    </span>
                    <span className="font-mono text-[10px] sm:text-xs md:text-sm flex-shrink-0">
                        {safeNum(item?.surface_velocity, 2, isMaintenance)} {isMaintenance ? "" : "m/s"}
</span>
                    </div>
                  )}

                  {/* Average Surface Velocity - only if selected */}
                  {selectedFields.includes('avg_surface_velocity') && (
                    <div className={`p-2 sm:p-2.5 md:p-3 rounded-md sm:rounded-lg flex justify-between items-center gap-1 ${
                      isDarkMode ? "bg-slate-800/30" : "bg-blue-100/50"
                    }`}>
                      <span className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm">
                        <Activity size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-blue-400 flex-shrink-0" />
                        <span className="truncate">Avg Velocity</span>
                      </span>
                      <span className="font-mono text-[10px] sm:text-xs md:text-sm flex-shrink-0">
                        {safeNum(item?.avg_surface_velocity, 2, isMaintenance)} {isMaintenance ? "" : "m/s"}
                      </span>
                  </div>
                  )}

                  {/* Water Distance Sensor - only if selected */}
                  {selectedFields.includes('water_dist_sensor') && (
                  <div className={`p-2 sm:p-2.5 md:p-3 rounded-md sm:rounded-lg flex justify-between items-center gap-1 ${
                    isDarkMode ? "bg-slate-800/30" : "bg-blue-100/50"
                  }`}>
                    <span className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm">
                      <Ruler size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-blue-400 flex-shrink-0" />
                      <span className="truncate">Water Distance from Sensor</span>
                    </span>
                      <span className="font-mono text-[10px] sm:text-xs md:text-sm flex-shrink-0">{safeNum(item?.water_dist_sensor, 2, isMaintenance)} {isMaintenance ? "" : "m"}</span>
                  </div>
                  )}
                </div>

                {/* Device Data Section - only show if at least one device field is selected */}
                {(selectedFields.includes('tilt_angle') || selectedFields.includes('flow_direction') || selectedFields.includes('SNR')) && (
                <div className="border-t mt-2 sm:mt-3 md:mt-4 pt-2 sm:pt-3 md:pt-4 space-y-1.5 sm:space-y-2 md:space-y-3">
                  <p className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-blue-400">Device Data</p>

                    {selectedFields.includes('tilt_angle') && (
                  <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                    <span className="flex items-center gap-1 sm:gap-2 truncate">
                      <Compass size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-yellow-400 flex-shrink-0" /> 
                      <span className="truncate">Tilt Angle</span>
                    </span>
                    <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {safeNum(item?.tilt_angle, 1, isMaintenance)} {isMaintenance ? "" : "°"}
                    </span>
                  </div>
                    )}

                    {selectedFields.includes('flow_direction') && (
                  <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                    <span className="flex items-center gap-1 sm:gap-2 truncate">
                      <Compass size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-green-500 flex-shrink-0" /> 
                      <span className="truncate">Flow Dir</span>
                    </span>
                    <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {isMaintenance ? "NIL" : formatFlowDirection(item?.flow_direction)}
                    </span>
                  </div>
                    )}

                    {selectedFields.includes('SNR') && (
                    <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                      <span className="flex items-center gap-1 sm:gap-2 truncate">
                        <Gauge size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-purple-400 flex-shrink-0" /> 
                        <span className="truncate">SNR</span>
                      </span>
                      <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {safeNum(item?.SNR, 2, isMaintenance)} {isMaintenance ? "" : "dB"}
                      </span>
                    </div>
                  )}
                  </div>
                )}

                {/* Power Section - only show if at least one power field is selected */}
                {(selectedFields.includes('internal_temperature') || selectedFields.includes('charge_current') || 
                  selectedFields.includes('observed_current') || selectedFields.includes('battery_voltage') || 
                  selectedFields.includes('solar_panel_tracking')) && (
                  <div className="border-t mt-2 sm:mt-3 md:mt-4 pt-2 sm:pt-3 md:pt-4 space-y-1.5 sm:space-y-2 md:space-y-3">
                    <p className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-orange-400">Power</p>

                    {selectedFields.includes('internal_temperature') && (
                      <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                        <span className="flex items-center gap-1 sm:gap-2 truncate">
                          <Thermometer size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-red-400 flex-shrink-0" /> 
                          <span className="truncate">Internal Temperature</span>
                        </span>
                        <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {safeNum(item?.internal_temperature, 1, isMaintenance)} {isMaintenance ? "" : "°C"}
                        </span>
                      </div>
                    )}

                    {selectedFields.includes('charge_current') && (
                      <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                        <span className="flex items-center gap-1 sm:gap-2 truncate">
                          <BatteryCharging size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-green-400 flex-shrink-0" /> 
                          <span className="truncate">Charge Current</span>
                        </span>
                        <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {safeNum(item?.charge_current, 4, isMaintenance)} {isMaintenance ? "" : "A"}
                        </span>
                      </div>
                    )}

                    {selectedFields.includes('observed_current') && (
                      <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                        <span className="flex items-center gap-1 sm:gap-2 truncate">
                          <Zap size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-yellow-400 flex-shrink-0" /> 
                          <span className="truncate">Absorbed Current</span>
                        </span>
                        <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {safeNum(item?.observed_current, 4, isMaintenance)} {isMaintenance ? "" : "A"}
                        </span>
                      </div>
                    )}

                    {selectedFields.includes('battery_voltage') && (
                      <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                        <span className="flex items-center gap-1 sm:gap-2 truncate">
                          <Battery size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-blue-400 flex-shrink-0" /> 
                          <span className="truncate">Battery Voltage</span>
                        </span>
                        <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {safeNum(item?.battery_voltage, 1, isMaintenance)} {isMaintenance ? "" : "V"}
                        </span>
                      </div>
                    )}

                    {selectedFields.includes('solar_panel_tracking') && (
                      <div className="flex justify-between text-[10px] sm:text-xs md:text-sm gap-1">
                        <span className="flex items-center gap-1 sm:gap-2 truncate">
                          <Sun size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-orange-400 flex-shrink-0" /> 
                          <span className="truncate">Solar Panel Tracking</span>
                        </span>
                        <span className={`font-mono flex-shrink-0 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                          {safeNum(item?.solar_panel_tracking, 1, isMaintenance)} {isMaintenance ? "" : "V"}
                        </span>
                      </div>
                  )}
                </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6 mt-6 sm:mt-8 md:mt-10 mb-12 sm:mb-16 md:mb-20">
        <div className={`rounded-lg sm:rounded-xl border p-3 sm:p-4 md:p-6 ${
          isDarkMode ? "bg-slate-900/60 border-slate-700" : "bg-white border-blue-200"
        }`}>
          <h2 className={`text-base sm:text-lg md:text-xl font-bold flex items-center ${
            isDarkMode ? "text-white" : "text-slate-800"
          }`}>
            <Waves className="mr-1.5 sm:mr-2 text-blue-400 w-4 h-4 sm:w-5 sm:h-5" />
            Water Level Trends
          </h2>

          <EWSDashboardGraph isDarkMode={isDarkMode} />
        </div>
      </div>

    </div>
  );
}
