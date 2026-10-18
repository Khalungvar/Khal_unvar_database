// השלמת כתובות דרך Google Places API (New), עם תקרה יומית כדי לא לעבור את החינם.
import { CONFIG } from './config.js';

const BASE = 'https://places.googleapis.com/v1';
let sessionToken = null;

export function placesEnabled() {
  return Boolean(CONFIG.MAPS_API_KEY);
}

function todayKey(kind) {
  const d = new Date();
  return `places-${kind}-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function underCap(kind, cap) {
  try {
    const used = Number(localStorage.getItem(todayKey(kind)) || 0);
    if (used >= cap) return false;
    localStorage.setItem(todayKey(kind), String(used + 1));
    return true;
  } catch {
    return true; // אם הדפדפן חוסם אחסון — לא עוצרים את העבודה
  }
}

function newSession() {
  sessionToken = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
}

/** הצעות לכתובת. מחזיר [{ placeId, text }] או null אם ההשלמה לא זמינה כרגע. */
export async function suggest(input) {
  if (!placesEnabled() || input.trim().length < 4) return [];
  if (!underCap('autocomplete', CONFIG.PLACES_DAILY_AUTOCOMPLETE)) return null;
  if (!sessionToken) newSession();
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CONFIG.MAPS_API_KEY },
    body: JSON.stringify({ input, sessionToken, includedRegionCodes: ['us'] }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({ placeId: p.placeId, text: p.text?.text || '' }));
}

/** פרטי הכתובת המלאה: { address, city, state, zip, country } או null. */
export async function details(placeId) {
  if (!placesEnabled()) return null;
  if (!underCap('details', CONFIG.PLACES_DAILY_DETAILS)) return null;
  const url = `${BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken || '')}`;
  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': CONFIG.MAPS_API_KEY, 'X-Goog-FieldMask': 'addressComponents' },
  });
  sessionToken = null; // שליפת הפרטים סוגרת את ה"סשן" של ההשלמה
  if (!res.ok) return null;
  const data = await res.json();
  const get = (type, short = false) => {
    const c = (data.addressComponents || []).find((x) => x.types?.includes(type));
    return c ? (short ? c.shortText : c.longText) : '';
  };
  const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
  const unit = get('subpremise');
  return {
    address: unit ? `${street} #${unit}` : street,
    city: get('locality') || get('sublocality') || get('postal_town') || get('neighborhood'),
    state: get('administrative_area_level_1', true),
    zip: get('postal_code'),
    country: get('country', true) === 'US' ? 'USA' : get('country'),
  };
}
