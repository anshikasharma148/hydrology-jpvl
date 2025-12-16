'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Station configuration
const STATIONS = [
  { id: "ST015", name: "Lambagad/Barrage", serviceType: "AWS", icon: "🌡️" },
  { id: "ST019", name: "Mana", serviceType: "AWS", icon: "🌡️" },
  { id: "ST020", name: "Vasudhara", serviceType: "AWS", icon: "🌡️" },
  { id: "ST019", name: "Mana", serviceType: "EWS", icon: "💧" },
  { id: "ST020", name: "Vasudhara", serviceType: "EWS", icon: "💧" },
];

// Get backend URL - use localhost if running locally, otherwise use Render
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";
};

export default function StationStatusManagement() {
  const router = useRouter();
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [adminName, setAdminName] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [dialogData, setDialogData] = useState(null);
  const [statusInput, setStatusInput] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setAdminName(user.name || "Admin");
      } catch (err) {
        console.error("Error parsing stored user:", err);
      }
    }
    fetchStatuses();
  }, []);

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
      alert(`Please type "${expectedStatusText}" exactly to confirm the status change.`);
      return;
    }

    // Show confirmation alert
    const confirmMessage = `Do you want to change the status of ${stationName} (${serviceType}) to ${expectedStatusText}?`;
    if (!window.confirm(confirmMessage)) {
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
        alert(`Error: ${result.error || "Failed to update status"}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setSaving({ ...saving, [key]: false });
      setDialogData(null);
      setStatusInput("");
    }
  };

  const handleRemoveStatus = async (stationId, serviceType) => {
    if (!confirm("Remove manual status? Station will revert to automatic offline detection.")) {
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
        alert(`Error: ${result.error || "Failed to remove status"}`);
      }
    } catch (error) {
      console.error("Error removing status:", error);
      alert("Failed to remove status. Please try again.");
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "adminToken=; path=/; max-age=0";
    window.location.href = "/admin/login";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading station statuses...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 p-4 sm:p-6">
      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3"
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
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 font-medium"
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
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Station Status Management
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">Manage manual status for AWS and EWS stations</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-full py-2 px-4 shadow-md border border-gray-200/50">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center mr-2 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-700">Hi, {adminName}</span>
            </div>
            <button
              onClick={() => router.push("/admin")}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 rounded-lg text-gray-700 font-medium transition-all shadow-md hover:shadow-lg border border-gray-200"
            >
              ← Back
            </button>
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
            >
              Logout
            </button>
          </div>
        </motion.div>
      </div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-xl p-5 shadow-lg"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
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
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              {/* Station Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-2xl shadow-sm">
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
                    className={`px-3 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r ${getStatusColor(currentStatus)} shadow-md`}
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
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                    currentStatus === "live"
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white cursor-not-allowed"
                      : "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 hover:from-green-200 hover:to-emerald-200"
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
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                    currentStatus === "offline"
                      ? "bg-gradient-to-r from-red-500 to-rose-600 text-white cursor-not-allowed"
                      : "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 hover:from-red-200 hover:to-rose-200"
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
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                    currentStatus === "maintenance"
                      ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-white cursor-not-allowed"
                      : "bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 hover:from-yellow-200 hover:to-amber-200"
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
                    className={`w-full py-2.5 px-4 rounded-xl font-medium transition-all duration-200 bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow-md ${
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
    </div>
  );
}
