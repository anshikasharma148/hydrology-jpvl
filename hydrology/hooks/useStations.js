'use client';
import { useState, useEffect, useCallback } from 'react';

// Get backend URL - use localhost if running locally, otherwise use Render
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";
};

/**
 * Custom hook to fetch and manage station data
 */
export function useStations() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/stations`);
      const result = await response.json();

      if (result.success) {
        setStations(result.data);
      } else {
        setError(result.error || 'Failed to fetch stations');
        setStations([]);
      }
    } catch (err) {
      console.error('Error fetching stations:', err);
      setError(err.message);
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  // Get stations by service type
  const getStationsByService = useCallback((serviceType) => {
    return stations.filter(s => s.ServicesID === serviceType);
  }, [stations]);

  // Get station by ID and service
  const getStation = useCallback((stationId, serviceId) => {
    return stations.find(s => s.StationID === stationId && s.ServicesID === serviceId);
  }, [stations]);

  // Get AWS stations
  const awsStations = getStationsByService('AWS');

  // Get EWS stations
  const ewsStations = getStationsByService('EWS');

  return {
    stations,
    awsStations,
    ewsStations,
    loading,
    error,
    refetch: fetchStations,
    getStationsByService,
    getStation
  };
}

/**
 * Hook to fetch a single station
 */
export function useStation(stationId, serviceId) {
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!stationId || !serviceId) {
      setLoading(false);
      return;
    }

    const fetchStation = async () => {
      try {
        setLoading(true);
        setError(null);
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/stations/${stationId}/${serviceId}`);
        const result = await response.json();

        if (result.success) {
          setStation(result.data);
        } else {
          setError(result.error || 'Station not found');
          setStation(null);
        }
      } catch (err) {
        console.error('Error fetching station:', err);
        setError(err.message);
        setStation(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, [stationId, serviceId]);

  return { station, loading, error };
}

