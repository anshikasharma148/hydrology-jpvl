/**
 * Formatting utilities that use user settings
 * All functions accept a settings object and format values accordingly
 */

/**
 * Get timezone offset in hours for common timezones
 */
const getTimezoneOffset = (timezone) => {
  const offsets = {
    'UTC': 0,
    'Asia/Kolkata': 5.5, // IST = UTC+5:30
    'America/New_York': -5, // EST = UTC-5 (or -4 for EDT)
    'Europe/London': 0, // GMT = UTC+0 (or +1 for BST)
  };
  return offsets[timezone] || 0;
};

/**
 * Convert timezone and return an object with timezone-adjusted components
 * 
 * CRITICAL: All timestamps from MySQL/backend are stored in UTC
 * This function normalizes input to UTC, then converts to target timezone
 * 
 * Rules:
 * 1. ALL input must be normalized to true UTC Date object first
 * 2. MySQL DATETIME strings MUST be parsed as UTC (append 'Z')
 * 3. Date objects are converted to UTC by extracting UTC components
 * 4. Conversion uses ONLY millisecond arithmetic
 * 5. NEVER use getHours()/getMinutes() - only getUTC*() methods
 */
const convertTimezone = (date, timezone) => {
  if (!date) return null;
  
  try {
    const targetTimezone = timezone || 'UTC';
    const targetOffset = getTimezoneOffset(targetTimezone);
    
    // ============================================
    // STEP 1: Normalize ALL input to true UTC Date
    // ============================================
    let utcDate;
    
    if (typeof date === 'string') {
      // Handle MySQL DATETIME format: "YYYY-MM-DD HH:MM:SS"
      // CRITICAL: Must append 'Z' to force UTC parsing
      if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // Convert "YYYY-MM-DD HH:MM:SS" to "YYYY-MM-DDTHH:MM:SSZ"
        // The 'Z' forces JavaScript to parse as UTC, not local time
        utcDate = new Date(date.replace(' ', 'T') + 'Z');
      } else if (date.includes('Z') || date.match(/[+-]\d{2}:?\d{2}$/)) {
        // Already has timezone info (Z or +/-offset) - parse directly
        utcDate = new Date(date);
      } else {
        // No timezone info - treat as UTC by appending 'Z'
        // CRITICAL: Never use new Date(dateString) without timezone indicator
        utcDate = new Date(date + (date.includes('T') ? 'Z' : 'T00:00:00Z'));
      }
    } else if (date instanceof Date) {
      // Date object - CRITICAL: Extract UTC components and rebuild as UTC
      // This ensures we get the true UTC time, not local time interpretation
      if (isNaN(date.getTime())) {
        return null;
      }
      // Reconstruct as UTC Date using UTC components
      // This prevents any local timezone contamination
      utcDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds()
      ));
    } else {
      return null;
    }
    
    // Validate the normalized UTC date
    if (isNaN(utcDate.getTime())) {
      console.warn('Invalid date after normalization:', date);
      return null;
    }
    
    // ============================================
    // STEP 2: If UTC, return as-is (NO conversion)
    // ============================================
    if (targetTimezone === 'UTC') {
      return {
        year: utcDate.getUTCFullYear(),
        month: utcDate.getUTCMonth(),
        date: utcDate.getUTCDate(),
        hours: utcDate.getUTCHours(),
        minutes: utcDate.getUTCMinutes(),
        seconds: utcDate.getUTCSeconds(),
        dateObj: new Date(utcDate.getTime()) // UTC date as-is
      };
    }
    
    // ============================================
    // STEP 3: Convert UTC to target timezone using milliseconds ONLY
    // ============================================
    // targetOffset is hours from UTC (e.g., IST = +5.5)
    // Convert to milliseconds: offsetHours * 60 * 60 * 1000
    const offsetMilliseconds = targetOffset * 60 * 60 * 1000;
    
    // Add offset to UTC time to get target timezone time
    const targetTime = utcDate.getTime() + offsetMilliseconds;
    const targetDate = new Date(targetTime);
    
    // ============================================
    // STEP 4: Extract components using UTC methods
    // ============================================
    // CRITICAL: Use getUTC*() methods, NOT get*() methods
    // The targetDate represents the shifted time, but we extract
    // components using UTC methods to get the correct values
    return {
      year: targetDate.getUTCFullYear(),
      month: targetDate.getUTCMonth(),
      date: targetDate.getUTCDate(),
      hours: targetDate.getUTCHours(),
      minutes: targetDate.getUTCMinutes(),
      seconds: targetDate.getUTCSeconds(),
      dateObj: new Date(targetTime) // Final timezone-adjusted date
    };
  } catch (error) {
    console.error('Error converting timezone:', error, 'Input:', date);
    return null;
  }
};

/**
 * Format date and time based on user settings
 * @param {string|Date} timestamp - The timestamp to format
 * @param {object} settings - User settings object
 * @returns {string|null} - Formatted date/time string
 */
export const formatDateTime = (timestamp, settings) => {
  if (!timestamp) return null;

  const timezone = settings?.timezone || 'UTC';
  const converted = convertTimezone(timestamp, timezone);
  if (!converted) return null;

  try {
    const year = converted.year;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[converted.month];
    const day = String(converted.date).padStart(2, '0');
    const hour = converted.hours;
    const minute = String(converted.minutes).padStart(2, '0');
    
    // Format time based on user preference
    if (settings?.timeFormat === '24h') {
      return `${day} ${month} ${year}, ${String(hour).padStart(2, '0')}:${minute}`;
    } else {
      // 12h format (default)
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${day} ${month} ${year}, ${hour12}:${minute} ${ampm}`;
    }
  } catch (error) {
    console.error('Error formatting date/time:', error);
    return null;
  }
};

/**
 * Format date only (without time)
 * @param {string|Date} timestamp - The timestamp to format
 * @param {object} settings - User settings object
 * @returns {string|null} - Formatted date string
 */
export const formatDate = (timestamp, settings) => {
  if (!timestamp) return null;

  const timezone = settings?.timezone || 'UTC';
  const converted = convertTimezone(timestamp, timezone);
  if (!converted) return null;

  try {
    const year = converted.year;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[converted.month];
    const day = String(converted.date).padStart(2, '0');
    const monthNum = converted.month + 1;
    
    // Format based on dateFormat setting
    const dateFormat = settings?.dateFormat || 'DD MMM YYYY';
    
    if (dateFormat === 'MM/DD/YYYY') {
      return `${String(monthNum).padStart(2, '0')}/${day}/${year}`;
    } else if (dateFormat === 'DD/MM/YYYY') {
      return `${day}/${String(monthNum).padStart(2, '0')}/${year}`;
    } else {
      // Default: DD MMM YYYY
      return `${day} ${month} ${year}`;
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

/**
 * Format time only (without date)
 * @param {string|Date} timestamp - The timestamp to format
 * @param {object} settings - User settings object
 * @returns {string|null} - Formatted time string
 */
export const formatTime = (timestamp, settings) => {
  if (!timestamp) return null;

  const timezone = settings?.timezone || 'UTC';
  const converted = convertTimezone(timestamp, timezone);
  if (!converted) return null;

  try {
    const hour = converted.hours;
    const minute = String(converted.minutes).padStart(2, '0');
    
    if (settings?.timeFormat === '24h') {
      return `${String(hour).padStart(2, '0')}:${minute}`;
    } else {
      // 12h format (default)
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minute} ${ampm}`;
    }
  } catch (error) {
    console.error('Error formatting time:', error);
    return null;
  }
};

/**
 * Convert and format temperature based on user preference
 * @param {number} value - Temperature in Celsius
 * @param {object} settings - User settings object
 * @returns {string} - Formatted temperature string
 */
export const formatTemperature = (value, settings) => {
  if (value === null || value === undefined || value === '') return '-';
  
  const unit = settings?.temperatureUnit || 'celsius';
  const precision = settings?.decimalPrecision || 2;
  
  let convertedValue = value;
  if (unit === 'fahrenheit') {
    // Convert Celsius to Fahrenheit: F = (C * 9/5) + 32
    convertedValue = (value * 9) / 5 + 32;
  }
  
  const formatted = Number.isInteger(convertedValue)
    ? convertedValue
    : Number(convertedValue.toFixed(precision));
  
  return `${formatted} ${unit === 'celsius' ? '°C' : '°F'}`;
};

/**
 * Convert and format distance based on user preference
 * @param {number} value - Distance in meters
 * @param {object} settings - User settings object
 * @returns {string} - Formatted distance string
 */
export const formatDistance = (value, settings) => {
  if (value === null || value === undefined || value === '') return '-';
  
  const unit = settings?.distanceUnit || 'meters';
  const precision = settings?.decimalPrecision || 2;
  
  let convertedValue = value;
  let unitLabel = 'm';
  
  if (unit === 'feet') {
    // Convert meters to feet: 1 meter = 3.28084 feet
    convertedValue = value * 3.28084;
    unitLabel = 'ft';
  }
  
  const formatted = Number.isInteger(convertedValue)
    ? convertedValue
    : Number(convertedValue.toFixed(precision));
  
  return `${formatted} ${unitLabel}`;
};

/**
 * Convert and format speed based on user preference
 * @param {number} value - Speed in m/s (meters per second)
 * @param {object} settings - User settings object
 * @returns {string} - Formatted speed string
 */
export const formatSpeed = (value, settings) => {
  if (value === null || value === undefined || value === '') return '-';
  
  const unit = settings?.speedUnit || 'mps';
  const precision = settings?.decimalPrecision || 2;
  
  let convertedValue = value;
  let unitLabel = 'm/s';
  
  if (unit === 'kmph') {
    // Convert m/s to km/h: 1 m/s = 3.6 km/h
    convertedValue = value * 3.6;
    unitLabel = 'km/h';
  } else if (unit === 'mph') {
    // Convert m/s to mph: 1 m/s = 2.23694 mph
    convertedValue = value * 2.23694;
    unitLabel = 'mph';
  }
  
  const formatted = Number.isInteger(convertedValue)
    ? convertedValue
    : Number(convertedValue.toFixed(precision));
  
  return `${formatted} ${unitLabel}`;
};

/**
 * Format number with specified decimal precision
 * @param {number} value - Number to format
 * @param {object} settings - User settings object
 * @param {number} overridePrecision - Optional override for precision
 * @returns {string|number} - Formatted number
 */
export const formatNumber = (value, settings, overridePrecision = null) => {
  if (value === null || value === undefined || value === '') return '-';
  
  const precision = overridePrecision !== null ? overridePrecision : (settings?.decimalPrecision || 2);
  
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value;
    }
    return Number(value.toFixed(precision));
  }
  
  // Try to parse as number
  const num = Number(value);
  if (isNaN(num)) {
    return String(value);
  }
  
  if (Number.isInteger(num)) {
    return num;
  }
  
  return Number(num.toFixed(precision));
};

/**
 * Format a value with a suffix (e.g., "10 m", "5.2 °C")
 * @param {number} value - Value to format
 * @param {string} suffix - Suffix to append
 * @param {object} settings - User settings object
 * @param {number} overridePrecision - Optional override for precision
 * @returns {string} - Formatted value with suffix
 */
export const formatValueWithSuffix = (value, suffix, settings, overridePrecision = null) => {
  if (value === null || value === undefined || value === '') return '-';
  
  const formatted = formatNumber(value, settings, overridePrecision);
  return `${formatted} ${suffix}`;
};

/**
 * Convert timezone helper (exported for direct use if needed)
 */
export { convertTimezone };

