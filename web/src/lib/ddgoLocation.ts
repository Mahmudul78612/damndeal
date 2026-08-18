'use client';

/**
 * The customer's delivery point for DDGo (quick commerce).
 *
 * Quick commerce is the one part of the store where nothing can be shown
 * honestly until we know where the customer is standing: a rider leaves from
 * one shop, so the catalogue, the ETA and the prices all depend on the pin.
 * That makes the location a first-class piece of session state rather than
 * something asked for at checkout.
 *
 * Kept in localStorage so it survives a reload — being asked for your address
 * on every page is what makes a grocery site feel broken.
 */

const KEY = 'dd_ddgo_loc';

export interface DdgoLocation {
  lat: number;
  lng: number;
  label: string;      // what we show in the header ("Model Town, Patiala")
  savedAt: number;
}

/* The store the current cart was built against.
   A cart is a promise that one shop can pack all of it. Move the pin far
   enough and a different store answers, which quietly turns that promise
   false - so the store is remembered and the mismatch is shown rather than
   discovered at checkout. */
const STORE_KEY = 'dd_ddgo_store';

export function readServingStore(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}

export function saveServingStore(storeId: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORE_KEY, storeId); } catch { /* ignore */ }
}

export function clearServingStore() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}

export function readLocation(): DdgoLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat !== 'number' || typeof v?.lng !== 'number') return null;
    return v as DdgoLocation;
  } catch {
    return null;
  }
}

export function saveLocation(loc: Omit<DdgoLocation, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loc, savedAt: Date.now() }));
    window.dispatchEvent(new Event('dd:ddgo-location'));
  } catch {
    /* private mode — the page still works, it just asks again next time */
  }
}

export function clearLocation() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('dd:ddgo-location'));
  } catch { /* ignore */ }
}

/**
 * Ask the browser where we are.
 *
 * Inside the DamnDeal app this reaches the native location sheet through the
 * GeoBridge shim, so the same call works on the website and in the app. The
 * prompt only ever appears because the customer tapped the button.
 */
export function requestBrowserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('This browser cannot share your location. Enter your area instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        reject(new Error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was blocked. Allow it, or search for your area instead.'
            : 'Could not read your location. Try searching for your area.'
        ));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}
