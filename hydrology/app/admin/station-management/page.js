'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import AdminLayout from '../../../components/AdminLayout';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { useNotification } from '../../../components/NotificationToast';

// Get backend URL
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";
};

export default function StationManagement() {
  const router = useRouter();
  const { showAlert, showConfirm } = useNotification();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'AWS', 'EWS'

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/stations`);
      const result = await response.json();

      if (result.success) {
        setStations(result.data);
      } else {
        showAlert(result.error || 'Failed to fetch stations', 'error');
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
      showAlert('Failed to fetch stations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (stationId, serviceId, stationName, hardDelete = false) => {
    const confirmMessage = hardDelete
      ? `⚠️ PERMANENT DELETE: Are you sure you want to permanently delete station "${stationName}" (${stationId}, ${serviceId})? This action cannot be undone and will remove all configuration data.`
      : `Are you sure you want to deactivate station "${stationName}" (${stationId}, ${serviceId})? This will stop data collection for this station. You can reactivate it later.`;
    
    const confirmed = await showConfirm(confirmMessage);

    if (!confirmed) return;

    try {
      const backendUrl = getBackendUrl();
      const token = localStorage.getItem("token");
      const url = `${backendUrl}/api/stations/${stationId}/${serviceId}${hardDelete ? '?hardDelete=true' : ''}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();

      if (result.success) {
        showAlert(hardDelete ? 'Station permanently deleted' : 'Station deactivated successfully', 'success');
        fetchStations();
      } else {
        showAlert(result.error || 'Failed to delete station', 'error');
      }
    } catch (error) {
      console.error('Error deleting station:', error);
      showAlert(error.message || 'Failed to delete station', 'error');
    }
  };

  const handleEdit = (stationId, serviceId) => {
    router.push(`/admin/stations/edit?stationId=${stationId}&serviceId=${serviceId}`);
  };

  const filteredStations = filter === 'all' 
    ? stations 
    : stations.filter(s => s.ServicesID === filter);

  if (loading) {
    return <LoadingSpinner message="Loading stations..." />;
  }

  return (
    <AdminLayout title="Station Management" subtitle="View, edit, and manage all registered stations">
      {/* Filters */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-gray-700">Filter by Service:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('AWS')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'AWS'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                AWS
              </button>
              <button
                onClick={() => setFilter('EWS')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'EWS'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                EWS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Station</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Service</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Device ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">CSV Path</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Fields</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No stations found
                  </td>
                </tr>
              ) : (
                filteredStations.map((station, index) => (
                  <motion.tr
                    key={`${station.StationID}_${station.ServicesID}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">{station.station_name}</div>
                        <div className="text-sm text-gray-500">{station.StationID}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        station.ServicesID === 'AWS'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {station.ServicesID}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{station.DeviceID}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-mono text-xs">
                      {station.csv_folder_path}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs">{station.selected_fields?.length || 0} standard</span>
                        {station.custom_fields && station.custom_fields.length > 0 && (
                          <span className="text-xs text-blue-600">{station.custom_fields.length} custom</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        station.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {station.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(station.StationID, station.ServicesID)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(station.StationID, station.ServicesID, station.station_name, false)}
                            className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium transition-colors"
                            title="Deactivate (soft delete)"
                          >
                            Deactivate
                          </button>
                          <button
                            onClick={() => handleDelete(station.StationID, station.ServicesID, station.station_name, true)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
                            title="Permanently delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

