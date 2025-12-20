'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '../../hooks/useSettings';
import Navbar from '../../components/Navbar';
import {
  Settings as SettingsIcon,
  RefreshCw,
  Clock,
  Globe,
  Palette,
  Ruler,
  Gauge,
  Map,
  BarChart3,
  Eye,
  Save,
  RotateCcw,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useStations } from '../../hooks/useStations';
import { motion } from 'framer-motion';
import { useNotification } from '../../components/NotificationToast';

export default function SettingsPage() {
  const router = useRouter();
  const { settings, updateSetting, updateSettings, resetSettings, syncWithDatabase, isSyncing } = useSettings();
  const { stations, awsStations, ewsStations } = useStations();
  const { showAlert } = useNotification();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const handleChange = (key, value) => {
    setLocalSettings((prev) => {
      let newSettings = { ...prev };
      
      if (key.includes('.')) {
        const keys = key.split('.');
        let current = newSettings;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          } else {
            current[keys[i]] = { ...current[keys[i]] };
          }
          current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
      } else {
        newSettings[key] = value;
      }
      
      return newSettings;
    });
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Update all settings
      Object.keys(localSettings).forEach((key) => {
        if (key === 'mapSettings' || key === 'graphDefaults') {
          Object.keys(localSettings[key]).forEach((subKey) => {
            updateSetting(`${key}.${subKey}`, localSettings[key][subKey]);
          });
        } else if (key === 'visibleStations') {
          updateSetting(key, localSettings[key]);
        } else {
          updateSetting(key, localSettings[key]);
        }
      });
      
      // Sync with database
      await syncWithDatabase();
      
      setHasChanges(false);
      setSaveSuccess(true);
      showAlert('Settings saved successfully!', 'success');
      
      // Hide success indicator after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert('Failed to save settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      resetSettings();
      setHasChanges(false);
    }
  };

  const toggleStationVisibility = (stationId) => {
    const currentVisible = localSettings.visibleStations || [];
    const newVisible = currentVisible.includes(stationId)
      ? currentVisible.filter(id => id !== stationId)
      : [...currentVisible, stationId];
    handleChange('visibleStations', newVisible);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-20 pb-8 px-4 md:px-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your dashboard preferences and display options
          </p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* General Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">General</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auto-refresh Interval
                </label>
                <select
                  value={localSettings.refreshInterval}
                  onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                  <option value={0}>Manual (disabled)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  How often the dashboard automatically refreshes data
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <select
                  value={localSettings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Display Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Display</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Format
                </label>
                <select
                  value={localSettings.dateFormat}
                  onChange={(e) => handleChange('dateFormat', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="DD MMM YYYY">DD MMM YYYY (e.g., 20 Dec 2025)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g., 12/20/2025)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g., 20/12/2025)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time Format
                </label>
                <select
                  value={localSettings.timeFormat}
                  onChange={(e) => handleChange('timeFormat', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="12h">12-hour (AM/PM)</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Decimal Precision
                </label>
                <select
                  value={localSettings.decimalPrecision}
                  onChange={(e) => handleChange('decimalPrecision', parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0}>0 (integers only)</option>
                  <option value={1}>1 decimal place</option>
                  <option value={2}>2 decimal places</option>
                  <option value={3}>3 decimal places</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Units Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <Ruler className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Units</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature Unit
                </label>
                <select
                  value={localSettings.temperatureUnit}
                  onChange={(e) => handleChange('temperatureUnit', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="celsius">Celsius (°C)</option>
                  <option value="fahrenheit">Fahrenheit (°F)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Distance Unit
                </label>
                <select
                  value={localSettings.distanceUnit}
                  onChange={(e) => handleChange('distanceUnit', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="meters">Meters (m)</option>
                  <option value="feet">Feet (ft)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Speed Unit
                </label>
                <select
                  value={localSettings.speedUnit}
                  onChange={(e) => handleChange('speedUnit', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="mps">Meters per second (m/s)</option>
                  <option value="kmph">Kilometers per hour (km/h)</option>
                  <option value="mph">Miles per hour (mph)</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Dashboard Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Visible Stations
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Select which stations to display on the dashboard. Leave empty to show all stations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  {stations.map((station) => {
                    const isVisible = (localSettings.visibleStations || []).includes(station.StationID);
                    return (
                      <label
                        key={station.StationID}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleStationVisibility(station.StationID)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {station.station_name} ({station.StationID})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Map Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <Map className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Map</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Zoom Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="18"
                  value={localSettings.mapSettings.defaultZoom}
                  onChange={(e) => handleChange('mapSettings.defaultZoom', parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Map Style
                </label>
                <select
                  value={localSettings.mapSettings.mapStyle}
                  onChange={(e) => handleChange('mapSettings.mapStyle', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="standard">Standard</option>
                  <option value="satellite">Satellite</option>
                  <option value="terrain">Terrain</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Graph Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Graphs</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Time Range
                </label>
                <select
                  value={localSettings.graphDefaults.timeRange}
                  onChange={(e) => handleChange('graphDefaults.timeRange', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1h">1 hour</option>
                  <option value="6h">6 hours</option>
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Graph Update Frequency
                </label>
                <select
                  value={localSettings.graphDefaults.updateFrequency}
                  onChange={(e) => handleChange('graphDefaults.updateFrequency', parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                </select>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>

          <div className="flex items-center gap-4">
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">Saved!</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || isSyncing}
              className="flex items-center gap-2 px-8 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving || isSyncing ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

