'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Station configuration
const STATIONS = [
  { id: "ST015", name: "Lambagad/Barrage", serviceType: "AWS" },
  { id: "ST019", name: "Mana", serviceType: "AWS" },
  { id: "ST020", name: "Vasudhara", serviceType: "AWS" },
  { id: "ST019", name: "Mana", serviceType: "EWS" },
  { id: "ST020", name: "Vasudhara", serviceType: "EWS" },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";

export default function StationStatusManagement() {
  const router = useRouter();
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [adminName, setAdminName] = useState("");

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
      const response = await fetch(`${BACKEND_URL}/api/station-status`);
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

  const handleStatusChange = async (stationId, serviceType, newStatus) => {
    const key = `${stationId}_${serviceType}`;
    setSaving({ ...saving, [key]: true });

    try {
      const response = await fetch(`${BACKEND_URL}/api/station-status`, {
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
        await fetchStatuses(); // Refresh statuses
      } else {
        alert(`Error: ${result.error || "Failed to update status"}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setSaving({ ...saving, [key]: false });
    }
  };

  const handleRemoveStatus = async (stationId, serviceType) => {
    if (!confirm("Remove manual status? Station will revert to automatic offline detection.")) {
      return;
    }

    const key = `${stationId}_${serviceType}`;
    setSaving({ ...saving, [key]: true });

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/station-status/${stationId}?serviceType=${serviceType}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (result.success) {
        await fetchStatuses(); // Refresh statuses
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
    const d = new Date(ts);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "adminToken=; path=/; max-age=0";
    window.location.href = "/admin/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading station statuses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-gray-200 p-4 sm:p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Station Status Management</h1>
            <p className="text-gray-600 mt-1">Manage manual status for AWS and EWS stations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white/80 backdrop-blur-sm rounded-full py-2 px-4 shadow-sm border border-gray-200">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Hi, {adminName}</span>
            </div>
            <button
              onClick={() => router.push("/admin")}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="max-w-6xl mx-auto mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Status Priority:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Under Maintenance:</strong> All values shown as NIL</li>
              <li><strong>Offline:</strong> Shows timestamp when set to Offline</li>
              <li><strong>Live:</strong> Shows data normally (if data received within 20-30 minutes)</li>
              <li><strong>Auto-detection:</strong> If no manual status, automatically shows Offline if no data for 20+ minutes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stations Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {STATIONS.map((station) => {
          const key = `${station.id}_${station.serviceType}`;
          const currentStatus = getCurrentStatus(station.id, station.serviceType);
          const statusTimestamp = getStatusTimestamp(station.id, station.serviceType);
          const isSaving = saving[key];

          return (
            <div
              key={key}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{station.name}</h3>
                  <p className="text-sm text-gray-500">
                    {station.serviceType} • {station.id}
                  </p>
                </div>
                {currentStatus && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      currentStatus === "live"
                        ? "bg-green-100 text-green-700"
                        : currentStatus === "offline"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {currentStatus === "maintenance" ? "Maintenance" : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                  </span>
                )}
              </div>

              {currentStatus === "offline" && statusTimestamp && (
                <div className="mb-4 p-2 bg-red-50 rounded text-xs text-red-700">
                  <strong>Set Offline:</strong> {formatTimestamp(statusTimestamp)}
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => handleStatusChange(station.id, station.serviceType, "live")}
                  disabled={isSaving || currentStatus === "live"}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    currentStatus === "live"
                      ? "bg-green-500 text-white cursor-not-allowed"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? "Saving..." : "Set Live"}
                </button>

                <button
                  onClick={() => handleStatusChange(station.id, station.serviceType, "offline")}
                  disabled={isSaving || currentStatus === "offline"}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    currentStatus === "offline"
                      ? "bg-red-500 text-white cursor-not-allowed"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? "Saving..." : "Set Offline"}
                </button>

                <button
                  onClick={() => handleStatusChange(station.id, station.serviceType, "maintenance")}
                  disabled={isSaving || currentStatus === "maintenance"}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    currentStatus === "maintenance"
                      ? "bg-yellow-500 text-white cursor-not-allowed"
                      : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? "Saving..." : "Set Under Maintenance"}
                </button>

                {currentStatus && (
                  <button
                    onClick={() => handleRemoveStatus(station.id, station.serviceType)}
                    disabled={isSaving}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 ${
                      isSaving ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSaving ? "Removing..." : "Remove Manual Status"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

