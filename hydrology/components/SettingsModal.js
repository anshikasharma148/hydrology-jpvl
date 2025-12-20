'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings as SettingsIcon, RefreshCw, Clock, Globe, Palette, Ruler, Gauge, Map, BarChart3, Save, RotateCcw, Check } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { useRouter } from 'next/navigation';
import { useNotification } from './NotificationToast';

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSetting, resetSettings, syncWithDatabase, isSyncing } = useSettings();
  const router = useRouter();
  const { showAlert } = useNotification();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [isOpen, settings]);

  const handleChange = (key, value) => {
    setLocalSettings((prev) => {
      let newSettings = { ...prev };
      
      // Handle nested keys
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
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Update all settings at once
      Object.keys(localSettings).forEach((key) => {
        if (key === 'mapSettings' || key === 'graphDefaults') {
          Object.keys(localSettings[key]).forEach((subKey) => {
            updateSetting(`${key}.${subKey}`, localSettings[key][subKey]);
          });
        } else {
          updateSetting(key, localSettings[key]);
        }
      });
      
      // Sync with database
      await syncWithDatabase();
      
      setHasChanges(false);
      setSaveSuccess(true);
      showAlert('Settings saved successfully!', 'success');
      
      // Hide success indicator after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert('Failed to save settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      resetSettings();
      setHasChanges(false);
    }
  };

  const openFullSettings = () => {
    onClose();
    router.push('/settings');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <RefreshCw className="w-5 h-5" />
                <span>General</span>
              </div>

              {/* Refresh Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auto-refresh Interval
                </label>
                <select
                  value={localSettings.refreshInterval}
                  onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                  <option value={0}>Manual (disabled)</option>
                </select>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <select
                  value={localSettings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>

            {/* Display Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Palette className="w-5 h-5" />
                <span>Display</span>
              </div>

              {/* Time Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time Format
                </label>
                <select
                  value={localSettings.timeFormat}
                  onChange={(e) => handleChange('timeFormat', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="12h">12-hour (AM/PM)</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>

              {/* Decimal Precision */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Decimal Precision
                </label>
                <select
                  value={localSettings.decimalPrecision}
                  onChange={(e) => handleChange('decimalPrecision', parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={0}>0 (integers only)</option>
                  <option value={1}>1 decimal place</option>
                  <option value={2}>2 decimal places</option>
                  <option value={3}>3 decimal places</option>
                </select>
              </div>
            </div>

            {/* Units Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Ruler className="w-5 h-5" />
                <span>Units</span>
              </div>

              {/* Temperature Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature Unit
                </label>
                <select
                  value={localSettings.temperatureUnit}
                  onChange={(e) => handleChange('temperatureUnit', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="celsius">Celsius (°C)</option>
                  <option value="fahrenheit">Fahrenheit (°F)</option>
                </select>
              </div>

              {/* Distance Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Distance Unit
                </label>
                <select
                  value={localSettings.distanceUnit}
                  onChange={(e) => handleChange('distanceUnit', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="meters">Meters (m)</option>
                  <option value="feet">Feet (ft)</option>
                </select>
              </div>

              {/* Speed Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Speed Unit
                </label>
                <select
                  value={localSettings.speedUnit}
                  onChange={(e) => handleChange('speedUnit', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="mps">Meters per second (m/s)</option>
                  <option value="kmph">Kilometers per hour (km/h)</option>
                  <option value="mph">Miles per hour (mph)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button
              onClick={openFullSettings}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open Full Settings Page →
            </button>
            <div className="flex items-center gap-3">
              {saveSuccess && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  <span className="font-medium">Saved!</span>
                </div>
              )}
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving || isSyncing}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving || isSyncing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

