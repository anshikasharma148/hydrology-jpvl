// ==============================
// FORECAST SERVICE (Node.js Only)
// ==============================

// Simple moving average
function movingAverage(arr, size) {
  if (!arr || arr.length < size) return null;
  const slice = arr.slice(arr.length - size);
  return slice.reduce((a, b) => a + Number(b), 0) / slice.length;
}

// Generate 12-hour forecast (48 intervals × 15 min)
function generateForecast(series, futureSteps = 48) {
  if (!series || series.length < 10) {
    return Array(futureSteps).fill(series[series.length - 1] || 0);
  }

  const forecasts = [];

  // Short-term (last 2 hours → 8 readings)
  const maShort = movingAverage(series, 8) || series[series.length - 1];

  // Long-term (last 8 hours → 32 readings)
  const maLong = movingAverage(series, 32) || series[series.length - 1];

  // Trend calculation (smoothed)
  const trend = (maShort - maLong) * 0.25;

  let lastValue = Number(series[series.length - 1]);

  // Generate forecast
  for (let i = 0; i < futureSteps; i++) {
    lastValue += trend;
    forecasts.push(Number(lastValue.toFixed(2)));
  }

  return forecasts;
}

module.exports = { generateForecast };

