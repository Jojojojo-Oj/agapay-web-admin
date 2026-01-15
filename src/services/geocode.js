// Reverse geocoding utilities for converting coordinates to human-readable addresses
// Uses OpenStreetMap Nominatim public API. Includes basic in-memory and localStorage caching.

const memoryCache = new Map();

function cacheKeyFromCoords(lat, lng) {
  // Normalize to 5 decimal places to improve cache hits and limit precision
  const nlat = Number(lat).toFixed(5);
  const nlng = Number(lng).toFixed(5);
  return `revgeo:${nlat},${nlng}`;
}

function getLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function setLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    // ignore
  }
}

export function parseCoordinates(location) {
  if (!location) return null;

  // Firestore GeoPoint or object with latitude/longitude
  if (typeof location === "object") {
    // Common shapes
    if (
      typeof location.latitude === "number" &&
      typeof location.longitude === "number"
    ) {
      return { lat: location.latitude, lng: location.longitude };
    }
    if (
      typeof location.lat === "number" &&
      typeof location.lng === "number"
    ) {
      return { lat: location.lat, lng: location.lng };
    }
    if (location.coords) {
      const { latitude, longitude } = location.coords || {};
      if (typeof latitude === "number" && typeof longitude === "number") {
        return { lat: latitude, lng: longitude };
      }
    }
  }

  // String formats: "lat,lng" or "lat, lng"
  if (typeof location === "string") {
    const parts = location.split(",");
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

export async function reverseGeocode(lat, lng) {
  const key = cacheKeyFromCoords(lat, lng);

  if (memoryCache.has(key)) return memoryCache.get(key);
  const fromLS = getLocalStorage(key);
  if (fromLS) {
    memoryCache.set(key, fromLS);
    return fromLS;
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Accept-Language helps get localized names; Referer is set by browser
        "Accept-Language": navigator.language || "en",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const address = data.display_name ||
      (data.address &&
        [
          data.address.road,
          data.address.suburb,
          data.address.city || data.address.town || data.address.village,
          data.address.state,
          data.address.postcode,
          data.address.country,
        ]
          .filter(Boolean)
          .join(", ")) || "Unknown address";

    memoryCache.set(key, address);
    setLocalStorage(key, address);
    return address;
  } catch (e) {
    // Fallback on failure
    const fallback = `${lat}, ${lng}`;
    memoryCache.set(key, fallback);
    return fallback;
  }
}

// Convenience: get address for a generic location value
export async function getAddressForLocation(location) {
  const coords = parseCoordinates(location);
  if (!coords) return typeof location === "string" ? location : "Unknown";
  return reverseGeocode(coords.lat, coords.lng);
}
