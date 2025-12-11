'use client';
import { useEffect } from 'react';

/**
 * Keep-Alive Component
 * Pings the backend every 10 minutes to prevent Render from sleeping
 * This ensures the first login attempt always succeeds
 */
export default function KeepAlive() {
  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://hydrology-jpvl.onrender.com';
    
    // Ping function
    const pingBackend = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/ping`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          // Don't wait too long - just trigger the wake-up
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        if (response.ok) {
          console.log('[KeepAlive] ✅ Backend pinged successfully');
        } else {
          console.warn('[KeepAlive] ⚠️ Backend responded with status:', response.status);
        }
      } catch (err) {
        // Silently fail - this is just a keep-alive ping
        // Don't spam console with errors
        if (err.name !== 'AbortError') {
          console.debug('[KeepAlive] Backend ping failed (this is normal if server is sleeping):', err.message);
        }
      }
    };

    // Ping immediately when component mounts (if user is on any page)
    pingBackend();

    // Then ping every 10 minutes (Render sleeps after 15 minutes of inactivity)
    const interval = setInterval(pingBackend, 10 * 60 * 1000); // 10 minutes

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  // This component doesn't render anything
  return null;
}

