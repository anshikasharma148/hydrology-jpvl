'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const SettingsContext = createContext(null);

// Default settings structure
const getDefaultSettings = () => ({
  refreshInterval: 10000, // milliseconds
  timezone: 'UTC',
  dateFormat: 'DD MMM YYYY',
  timeFormat: '12h', // '12h' or '24h'
  decimalPrecision: 2,
  temperatureUnit: 'celsius', // 'celsius' or 'fahrenheit'
  distanceUnit: 'meters', // 'meters' or 'feet'
  speedUnit: 'mps', // 'mps', 'kmph', 'mph'
  visibleStations: [], // array of station IDs to show
  mapSettings: {
    defaultZoom: 8,
    defaultCenter: [30.7, 79.5], // Badrinath area
    mapStyle: 'standard', // 'standard', 'satellite', 'terrain'
  },
  graphDefaults: {
    timeRange: '24h', // '1h', '6h', '24h', '7d', '30d'
    updateFrequency: 10000,
  },
});

// Get backend URL
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(getDefaultSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadFromLocalStorage = () => {
      try {
        const stored = localStorage.getItem('userSettings');
        if (stored) {
          const parsed = JSON.parse(stored);
          const defaults = getDefaultSettings();
          // Merge with defaults to ensure all fields exist
          const merged = {
            ...defaults,
            ...parsed,
            mapSettings: {
              ...defaults.mapSettings,
              ...(parsed.mapSettings || {}),
            },
            graphDefaults: {
              ...defaults.graphDefaults,
              ...(parsed.graphDefaults || {}),
            },
          };
          setSettings(merged);
        }
      } catch (error) {
        console.error('Error loading settings from localStorage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromLocalStorage();
  }, []);

  // Sync with database on mount (if user is logged in)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      syncWithDatabase();
    }
  }, []);

  // Sync settings with database
  const syncWithDatabase = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      // Not logged in, use localStorage only
      return;
    }

    try {
      setIsSyncing(true);
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const defaults = getDefaultSettings();
          const merged = {
            ...defaults,
            ...result.data,
            mapSettings: {
              ...defaults.mapSettings,
              ...(result.data.mapSettings || {}),
            },
            graphDefaults: {
              ...defaults.graphDefaults,
              ...(result.data.graphDefaults || {}),
            },
          };
          setSettings(merged);
          // Update localStorage with synced data
          localStorage.setItem('userSettings', JSON.stringify(merged));
        }
      }
    } catch (error) {
      console.error('Error syncing settings from database:', error);
      // Fallback to localStorage if database sync fails
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Save settings to database (with debouncing)
  const saveToDatabase = useCallback(async (settingsToSave) => {
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      // Not logged in, skip database save
      return;
    }

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce database saves (wait 1 second after last change)
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/settings`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ settings: settingsToSave }),
        });

        if (!response.ok) {
          console.error('Failed to save settings to database');
        }
      } catch (error) {
        console.error('Error saving settings to database:', error);
      }
    }, 1000);
  }, []);

  // Update a single setting
  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      let newSettings;
      
      // Handle nested keys (e.g., 'mapSettings.defaultZoom')
      if (key.includes('.')) {
        const keys = key.split('.');
        newSettings = { ...prev };
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
        newSettings = { ...prev, [key]: value };
      }

      // Save to localStorage immediately
      localStorage.setItem('userSettings', JSON.stringify(newSettings));
      
      // Save to database (debounced)
      saveToDatabase(newSettings);

      return newSettings;
    });
  }, [saveToDatabase]);

  // Update multiple settings at once
  const updateSettings = useCallback((updates) => {
    setSettings((prev) => {
      const newSettings = { ...prev, ...updates };
      
      // Handle nested updates
      if (updates.mapSettings) {
        newSettings.mapSettings = {
          ...prev.mapSettings,
          ...updates.mapSettings,
        };
      }
      if (updates.graphDefaults) {
        newSettings.graphDefaults = {
          ...prev.graphDefaults,
          ...updates.graphDefaults,
        };
      }

      // Save to localStorage immediately
      localStorage.setItem('userSettings', JSON.stringify(newSettings));
      
      // Save to database (debounced)
      saveToDatabase(newSettings);

      return newSettings;
    });
  }, [saveToDatabase]);

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    const defaults = getDefaultSettings();
    setSettings(defaults);
    localStorage.setItem('userSettings', JSON.stringify(defaults));
    saveToDatabase(defaults);
  }, [saveToDatabase]);

  const value = {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    syncWithDatabase,
    isLoading,
    isSyncing,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

