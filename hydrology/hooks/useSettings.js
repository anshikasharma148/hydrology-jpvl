'use client';
import { useSettings as useSettingsContext } from '../contexts/SettingsContext';

/**
 * Custom hook to access settings context
 * This is a convenience wrapper that re-exports the useSettings hook from context
 */
export const useSettings = () => {
  return useSettingsContext();
};

