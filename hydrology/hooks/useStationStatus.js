import { useState, useEffect } from "react";

// Get backend URL - use localhost if running locally, otherwise use Render
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";
};

/**
 * Custom hook to fetch and manage station statuses
 * Returns a function to get the effective status for a station
 */
export function useStationStatus() {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/station-status`);
        const result = await response.json();
        if (result.success) {
          const statusMap = {};
          result.data.forEach((status) => {
            const key = `${status.station_id}_${status.service_type}`;
            statusMap[key] = status;
          });
          setStatuses(statusMap);
        }
      } catch (error) {
        console.error("Error fetching station statuses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Get effective status for a station
   * @param {string} stationId - Station ID (e.g., "ST015", "ST019", "ST020")
   * @param {string} serviceType - "AWS" or "EWS"
   * @param {string|null} timestamp - Data timestamp (for auto-offline detection)
   * @param {number} thresholdMin - Minutes threshold for auto-offline (default: 20 for EWS, 30 for AWS)
   * @returns {object} { status: 'live'|'offline'|'maintenance', isManual: boolean, offlineTimestamp: string|null }
   */
  const getStationStatus = (stationId, serviceType, timestamp, thresholdMin = null) => {
    const key = `${stationId}_${serviceType}`;
    const manualStatus = statuses[key];

    // Priority 1: Manual "maintenance" status
    if (manualStatus?.status === "maintenance") {
      return {
        status: "maintenance",
        isManual: true,
        offlineTimestamp: null,
      };
    }

    // Priority 2: Manual "offline" status
    if (manualStatus?.status === "offline") {
      return {
        status: "offline",
        isManual: true,
        offlineTimestamp: manualStatus.status_timestamp,
      };
    }

    // Priority 3: Manual "live" status (overrides auto-detection)
    if (manualStatus?.status === "live") {
      return {
        status: "live",
        isManual: true,
        offlineTimestamp: null,
      };
    }

    // Priority 4: Auto-detection based on timestamp
    const defaultThreshold = serviceType === "EWS" ? 20 : 30;
    const threshold = thresholdMin !== null ? thresholdMin : defaultThreshold;

    if (!timestamp) {
      return {
        status: "offline",
        isManual: false,
        offlineTimestamp: null,
      };
    }

    // Remove "Z" if present to avoid timezone conversion
    const cleanTimestamp = typeof timestamp === "string" ? timestamp.replace("Z", "") : timestamp;
    const dataTime = new Date(cleanTimestamp);
    if (isNaN(dataTime.getTime())) {
      return {
        status: "offline",
        isManual: false,
        offlineTimestamp: null,
      };
    }

    const diffMin = (Date.now() - dataTime.getTime()) / (1000 * 60);
    const isLive = diffMin <= threshold;

    return {
      status: isLive ? "live" : "offline",
      isManual: false,
      offlineTimestamp: null,
    };
  };

  return { getStationStatus, loading, statuses };
}

