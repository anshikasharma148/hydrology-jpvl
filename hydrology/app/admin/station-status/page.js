'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useNotification } from "../../../components/NotificationToast";
import LoadingSpinner from "../../../components/LoadingSpinner";
import AdminLayout from "../../../components/AdminLayout";
import { useStations } from "../../../hooks/useStations";

// Get backend URL - use localhost if running locally, otherwise use Render
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";
};

export default function StationStatusManagement() {
  const router = useRouter();
  const { showAlert, showConfirm } = useNotification();
  const { stations, loading: stationsLoading } = useStations();
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [dialogData, setDialogData] = useState(null);
  const [statusInput, setStatusInput] = useState("");

  useEffect(() => {
    fetchStatuses();
  }, []);

  // Build stations array from fetched data
  const STATIONS = stations.map(station => ({
    id: station.StationID,
    name: station.station_name,
    serviceType: station.ServicesID,
    icon: station.ServicesID === "AWS" ? "🌡️" : "💧"
  }));

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
      console.error("Error fetching statuses:", error);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleStatusChangeClick = (stationId, serviceType, newStatus, stationName) => {
    // Show confirmation dialog
    setDialogData({
      stationId,
      serviceType,
      newStatus,
      stationName,
    });
    setStatusInput("");
    setShowDialog(true);
  };

  const handleStatusChange = async () => {
    if (!dialogData) return;

    const { stationId, serviceType, newStatus, stationName } = dialogData;
    
    // Get expected status text based on newStatus value
    const expectedStatusText = newStatus === "live" ? "Live" : 
                               newStatus === "offline" ? "Offline" : 
                               "Maintenance";
    
    // Validate input
    if (statusInput.trim() !== expectedStatusText) {
      showAlert(`Please type "${expectedStatusText}" exactly to confirm the status change.`, 'warning');
      return;
    }

    // Show confirmation dialog
    const confirmMessage = `Do you want to change the status of ${stationName} (${serviceType}) to ${expectedStatusText}?`;
    const confirmed = await showConfirm(confirmMessage);
    if (!confirmed) {
      setShowDialog(false);
      setDialogData(null);
      setStatusInput("");
      return;
    }

    // Close dialog
    setShowDialog(false);
    const key = `${stationId}_${serviceType}`;
    setSaving({ ...saving, [key]: true });

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/station-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId,
          serviceType,
          status: newStatus,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchStatuses();
        showSuccess(`Status updated to ${expectedStatusText}`);
      } else {
        showAlert(`Error: ${result.error || "Failed to update status"}`, 'error');
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showAlert("Failed to update status. Please try again.", 'error');
    } finally {
      setSaving({ ...saving, [key]: false });
      setDialogData(null);
      setStatusInput("");
    }
  };

  const handleRemoveStatus = async (stationId, serviceType) => {
    const confirmed = await showConfirm("Remove manual status? Station will revert to automatic offline detection.");
    if (!confirmed) {
      return;
    }

    const key = `${stationId}_${serviceType}`;
    setSaving({ ...saving, [key]: true });

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(
        `${backendUrl}/api/station-status/${stationId}?serviceType=${serviceType}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (result.success) {
        await fetchStatuses();
        showSuccess("Manual status removed successfully");
      } else {
        showAlert(`Error: ${result.error || "Failed to remove status"}`, 'error');
      }
    } catch (error) {
      console.error("Error removing status:", error);
      showAlert("Failed to remove status. Please try again.", 'error');
    } finally {
      setSaving({ ...saving, [key]: false });
    }
  };

  const getCurrentStatus = (stationId, serviceType) => {
    const key = `${stationId}_${serviceType}`;
    return statuses[key]?.status || null;
  };

  const getStatusTimestamp = (stationId, serviceType) => {
    const key = `${stationId}_${serviceType}`;
    return statuses[key]?.status_timestamp || null;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return null;
    // MySQL DATETIME format is "YYYY-MM-DD HH:MM:SS" (no timezone)
    // Treat it as local sensor time (not UTC)
    let clean = ts;
    if (typeof ts === 'string') {
      // Remove "Z" if present (from ISO format)
      clean = ts.replace("Z", "");
      // If it's MySQL DATETIME format (YYYY-MM-DD HH:MM:SS), add "T" to make it parseable
      if (clean.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        clean = clean.replace(" ", "T");
      }
    } else if (ts instanceof Date) {
      // If it's already a Date object, convert to ISO string and remove Z
      clean = ts.toISOString().replace("Z", "");
    }
    // Create date as if the timestamp is already local sensor time
    const d = new Date(clean);
    if (isNaN(d.getTime())) {
      console.warn("Failed to parse timestamp:", ts);
      return null;
    }
    const year = d.getFullYear();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const day = String(d.getDate()).padStart(2, "0");
    let hour = d.getHours();
    const minute = String(d.getMinutes()).padStart(2, "0");
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    
    return `${day} ${month} ${year}, ${hour12}:${minute} ${ampm}`;
  };


  const getStatusColor = (status) => {
    switch (status) {
      case "live":
        return "from-green-500 to-emerald-600";
      case "offline":
        return "from-red-500 to-rose-600";
      case "maintenance":
        return "from-yellow-500 to-amber-600";
      default:
        return "from-gray-400 to-gray-500";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "live":
        return "✓";
      case "offline":
        return "●";
      case "maintenance":
        return "⚠";
      default:
        return "○";
    }
  };

  if (loading || stationsLoading) {
    return <LoadingSpinner message="Loading station statuses..." />;
  }

  return (
    <AdminLayout title="Station Status Management" subtitle="Manage manual status for AWS and EWS stations">
      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showDialog && dialogData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Confirm Status Change</h3>
                <button
                  onClick={() => {
                    setShowDialog(false);
                    setDialogData(null);
                    setStatusInput("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  You are about to change the status of:
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="font-semibold text-gray-800">{dialogData.stationName}</p>
                  <p className="text-sm text-gray-600">{dialogData.serviceType} • {dialogData.stationId}</p>
                </div>
                <p className="text-gray-700 mb-2">
                  New Status: <span className="font-bold text-indigo-600">
                    {dialogData.newStatus === "live" ? "Live" : 
                     dialogData.newStatus === "offline" ? "Offline" : 
                     "Under Maintenance"}
                  </span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  For security purposes, please type <strong>"{dialogData.newStatus === "live" ? "Live" : dialogData.newStatus === "offline" ? "Offline" : "Maintenance"}"</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  placeholder={`Type "${dialogData.newStatus === "live" ? "Live" : dialogData.newStatus === "offline" ? "Offline" : "Maintenance"}" here`}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 font-medium"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleStatusChange();
                    } else if (e.key === "Escape") {
                      setShowDialog(false);
                      setDialogData(null);
                      setStatusInput("");
                    }
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDialog(false);
                    setDialogData(null);
                    setStatusInput("");
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={statusInput.trim() !== (dialogData.newStatus === "live" ? "Live" : dialogData.newStatus === "offline" ? "Offline" : "Maintenance")}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 bg-gray-50 border-l-4 border-slate-500 rounded-xl p-5 shadow-sm"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-slate-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Status Priority Guide</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 font-bold">⚠</span>
                <div>
                  <strong className="text-yellow-700">Under Maintenance:</strong> All values shown as NIL
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold">●</span>
                <div>
                  <strong className="text-red-700">Offline:</strong> Shows timestamp when set to Offline
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <strong className="text-green-700">Live:</strong> Shows data normally (if data received within 20-30 minutes)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-600 font-bold">○</span>
                <div>
                  <strong className="text-gray-700">Auto-detection:</strong> If no manual status, automatically shows Offline if no data for 20+ minutes
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {STATIONS.map((station, index) => {
          const key = `${station.id}_${station.serviceType}`;
          const currentStatus = getCurrentStatus(station.id, station.serviceType);
          const statusTimestamp = getStatusTimestamp(station.id, station.serviceType);
          const isSaving = saving[key];

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all duration-300"
            >
              {/* Station Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shadow-sm">
                    {station.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{station.name}</h3>
                    <p className="text-xs text-gray-500 font-medium">
                      {station.serviceType} • {station.id}
                    </p>
                  </div>
                </div>
                {currentStatus && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold text-white ${
                      currentStatus === "live" ? "bg-green-600" :
                      currentStatus === "offline" ? "bg-red-600" :
                      "bg-yellow-600"
                    } shadow-sm`}
                  >
                    <span className="mr-1">{getStatusIcon(currentStatus)}</span>
                    {currentStatus === "maintenance" ? "Maintenance" : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                  </motion.div>
                )}
              </div>

              {/* Offline Timestamp */}
              {currentStatus === "offline" && statusTimestamp && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <strong className="text-red-700">Set Offline:</strong>
                      <p className="text-red-600 mt-0.5">{formatTimestamp(statusTimestamp)}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={() => handleStatusChangeClick(station.id, station.serviceType, "live", station.name)}
                  disabled={isSaving || currentStatus === "live"}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
                    currentStatus === "live"
                      ? "bg-green-600 text-white cursor-not-allowed"
                      : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Set Live
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleStatusChangeClick(station.id, station.serviceType, "offline", station.name)}
                  disabled={isSaving || currentStatus === "offline"}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
                    currentStatus === "offline"
                      ? "bg-red-600 text-white cursor-not-allowed"
                      : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Set Offline
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleStatusChangeClick(station.id, station.serviceType, "maintenance", station.name)}
                  disabled={isSaving || currentStatus === "maintenance"}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
                    currentStatus === "maintenance"
                      ? "bg-yellow-600 text-white cursor-not-allowed"
                      : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Set Under Maintenance
                    </span>
                  )}
                </button>

                {currentStatus && (
                  <button
                    onClick={() => handleRemoveStatus(station.id, station.serviceType)}
                    disabled={isSaving}
                    className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow-md ${
                      isSaving ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        Removing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Remove Manual Status
                      </span>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
