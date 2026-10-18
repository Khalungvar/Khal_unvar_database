// השלמת כתובות דרך הספרייה הרשמית של Google Maps לדפדפן (Places API New),
// עם תקרה יומית כדי לא לעבור את החינם.
import { CONFIG } from './config.js';

let placesLib = null;
let sessionToken = null;
let lastError = '';

export function placesEnabled() {
  return Boolean(CONFIG.MAPS_API_KEY);
}

export function placesError() {
  return lastError;
}

/** טוען את ספריית גוגל מפות פעם אחת, רק כשצריך. */
function loadMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (loadMaps.promise) return loadMaps.promise;
  loadMaps.promise = new Promise((resolve, reject) => {
    window.__mapsReady = resolve;
    window.gm_authFailure = () => { lastError = 'גוגל דחתה את מפתח המפות (בדקו את ההגבלות של המפתח).'; };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CONFIG.MAPS_API_KEY)}`
      + '&v=weekly&loading=async&language=en&region=US&callback=__mapsReady';
    s.async = true;
    s.onerror = () => reject(new Error('לא הצלחתי לטעון את גוגל מפות'));
    document.head.append(s);
  });
  return loadMaps.promise;
}

async function lib() {
  if (!placesLib) {
    await loadMaps();
    placesLib = await window.google.maps.importLibrary('places');
  }
  return placesLib;
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

/**
 * הצעות לכתובת: [{ prediction, text }].
 * מחזיר 'cap' כשהגענו לתקרה היומית, ו-'error' כשמשהו נכשל (הפרטים ב-placesError()).
 */
export async function suggest(input) {
  if (!placesEnabled() || input.trim().length < 3) return [];
  if (!underCap('autocomplete', CONFIG.PLACES_DAILY_AUTOCOMPLETE)) return 'cap';
  try {
    const { AutocompleteSuggestion, AutocompleteSessionToken } = await lib();
    if (!sessionToken) sessionToken = new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input, sessionToken, includedRegionCodes: ['us'],
    });
    return (suggestions || [])
      .map((s) => s.placePrediction)
      .filter(Boolean)
      .map((p) => ({ prediction: p, text: p.text?.toString() || '' }));
  } catch (err) {
    lastError = lastError || err.message || String(err);
    console.error('Places autocomplete failed:', err);
    return 'error';
  }
}

/** פרטי הכתובת המלאה: { address, city, state, zip, country } או null. */
export async function details(prediction) {
  if (!underCap('details', CONFIG.PLACES_DAILY_DETAILS)) return null;
  try {
    const place = prediction.toPlace();
    await place.fetchFields({ fields: ['addressComponents'] });
    sessionToken = null; // שליפת הפרטים סוגרת את ה"סשן" של ההשלמה
    const comps = place.addressComponents || [];
    const get = (type, short = false) => {
      const c = comps.find((x) => x.types?.includes(type));
      return c ? (short ? c.shortText : c.longText) || '' : '';
    };
    const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
    const unit = get('subpremise');
    const country = get('country', true);
    return {
      address: unit ? `${street} #${unit}` : street,
      city: get('locality') || get('sublocality') || get('postal_town') || get('neighborhood'),
      state: get('administrative_area_level_1', true),
      zip: get('postal_code'),
      country: country === 'US' ? 'USA' : get('country'),
    };
  } catch (err) {
    console.error('Places details failed:', err);
    return null;
  }
}
