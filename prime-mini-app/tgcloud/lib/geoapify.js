const BASE = 'https://api.geoapify.com/v1';

function coordinate(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function countryCode(value) {
  if (typeof value !== 'string' || !/^[a-z]{2}$/i.test(value)) throw new TypeError('Invalid country code.');
  return value.toLowerCase();
}

function makeUrl(path, params, apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length < 16) throw new TypeError('Geoapify server configuration is missing.');
  const query = new URLSearchParams({ ...params, apiKey });
  return `${BASE}/${path}?${query.toString()}`;
}

export function autocompleteUrl({ text, apiKey, country = 'ph', limit = 6 }) {
  if (typeof text !== 'string' || text.trim().length < 3 || text.trim().length > 120) {
    throw new TypeError('Address search must contain 3 to 120 characters.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new TypeError('Invalid result limit.');
  return makeUrl('geocode/autocomplete', {
    text: text.trim(), filter: `countrycode:${countryCode(country)}`, limit: String(limit), format: 'json',
  }, apiKey);
}

export function forwardGeocodeUrl({ text, apiKey, country = 'ph' }) {
  if (typeof text !== 'string' || text.trim().length < 5 || text.trim().length > 200) {
    throw new TypeError('Address must contain 5 to 200 characters.');
  }
  return makeUrl('geocode/search', {
    text: text.trim(), filter: `countrycode:${countryCode(country)}`, limit: '1', format: 'json',
  }, apiKey);
}

export function reverseGeocodeUrl({ lat, lon, apiKey }) {
  if (!coordinate(lat, -90, 90) || !coordinate(lon, -180, 180)) throw new TypeError('Invalid coordinates.');
  return makeUrl('geocode/reverse', { lat: String(lat), lon: String(lon), format: 'json' }, apiKey);
}

export function roadRouteUrl({ from, to, apiKey }) {
  if (!from || !to || !coordinate(from.lat, -90, 90) || !coordinate(from.lon, -180, 180)
    || !coordinate(to.lat, -90, 90) || !coordinate(to.lon, -180, 180)) {
    throw new TypeError('Valid origin and destination coordinates are required.');
  }
  return makeUrl('routing', {
    waypoints: `${from.lat},${from.lon}|${to.lat},${to.lon}`,
    mode: 'drive', units: 'metric', format: 'json',
  }, apiKey);
}

export function parseAddressResults(payload, maxResults = 6) {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 10 || !Array.isArray(payload?.results)) return [];
  return payload.results.slice(0, maxResults).flatMap((place) => {
    if (!coordinate(place?.lat, -90, 90) || !coordinate(place?.lon, -180, 180)
      || typeof place.formatted !== 'string' || !place.formatted.trim()) return [];
    return [{
      placeId: typeof place.place_id === 'string' ? place.place_id.slice(0, 160) : null,
      formatted: place.formatted.slice(0, 300),
      lat: place.lat,
      lon: place.lon,
      city: typeof place.city === 'string' ? place.city.slice(0, 120) : null,
      state: typeof place.state === 'string' ? place.state.slice(0, 120) : null,
      postcode: typeof place.postcode === 'string' ? place.postcode.slice(0, 24) : null,
      countryCode: typeof place.country_code === 'string' ? place.country_code.slice(0, 2) : null,
    }];
  });
}

export function parseRoadRoute(payload) {
  const route = payload?.results?.[0];
  if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.time)
    || route.distance <= 0 || route.time <= 0) return null;
  return { distanceMeters: Math.ceil(route.distance), durationSeconds: Math.ceil(route.time) };
}
