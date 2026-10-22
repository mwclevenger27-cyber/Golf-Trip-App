import { useEffect, useState } from 'react';

const GPS_KEY = 'golf-trip-gps-on';

export function gpsWanted() {
  try { return localStorage.getItem(GPS_KEY) === '1'; } catch { return false; }
}

// Follows the phone's location while `on` is true. The browser asks for
// permission the first time; after a yes we remember to turn it on again.
export function useGps(on) {
  const [state, setState] = useState({ pos: null, accuracy: null, error: null });
  useEffect(() => {
    if (!on) return undefined;
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'This phone or browser has no GPS.' }));
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        try { localStorage.setItem(GPS_KEY, '1'); } catch { /* ignore */ }
        setState({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: Math.round(p.coords.accuracy * 1.09361), error: null });
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          try { localStorage.removeItem(GPS_KEY); } catch { /* ignore */ }
        }
        setState((s) => ({
          ...s,
          error: e.code === e.PERMISSION_DENIED
            ? 'Location is blocked. Turn it on for this site in your phone settings to see yardages.'
            : 'Looking for GPS…',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on]);
  return state;
}

// Keeps the screen from going to sleep while scoring, where the phone allows it.
export function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const grab = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock?.release();
      } catch { /* low battery mode etc. */ }
    };
    grab();
    document.addEventListener('visibilitychange', grab);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', grab);
      lock?.release().catch(() => {});
    };
  }, [on]);
}
