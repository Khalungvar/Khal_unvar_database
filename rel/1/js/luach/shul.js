// 🏛 בית כנסת: הגדרות כלליות — שם, שפה, מקום ושיטות הזמנים, גרסה נעולה.
// נשמר בגיליון של בית הכנסת, לשונית ShulConfig (JSON בחלקים, כמו Screen). התצוגה קוראת אותו משם.
// בלי תלויות באתר — גם התצוגה (וקובץ התצוגה העצמאי) משתמשת בזה.
import { LOCATIONS, setLocation } from './zmanim.js';

// בתי הכנסת. בשלב הזה: בארא פארק בלבד (שאר בתי הכנסת — בשלב "בית כנסת חדש")
export const SHULS = {
  bp: { key: 'bp', sheetId: '1hhrsXNhDCK7OGXOClTPE8pxOJ3EjmTmndH0r_qrms70' },
};
export const DEFAULT_SHUL = 'bp';

// ערים מוכנות (קואורדינטות, אזור זמן, גובה במטרים, דקות הדלקה לפי המנהג המקובל שם)
export const CITIES = [
  { id: 'bp', name: 'בארא פארק', lat: 40.6340, lon: -73.9960, tz: 'America/New_York', elev: 20, candles: 18 },
  { id: 'wburg', name: 'וויליאמסבורג', lat: 40.7081, lon: -73.9571, tz: 'America/New_York', elev: 10, candles: 18 },
  { id: 'monsey', name: 'מאנסי', lat: 41.1112, lon: -74.0688, tz: 'America/New_York', elev: 150, candles: 18 },
  { id: 'kj', name: 'קרית יואל', lat: 41.3409, lon: -74.1669, tz: 'America/New_York', elev: 140, candles: 18 },
  { id: 'lkwd', name: 'לייקוואוד', lat: 40.0821, lon: -74.2097, tz: 'America/New_York', elev: 20, candles: 18 },
  { id: 'crown', name: 'קראון הייטס', lat: 40.6694, lon: -73.9422, tz: 'America/New_York', elev: 30, candles: 18 },
  { id: 'mtl', name: 'מאנטרעאל', lat: 45.5017, lon: -73.5673, tz: 'America/Toronto', elev: 50, candles: 18 },
  { id: 'tor', name: 'טאראנטא', lat: 43.6532, lon: -79.3832, tz: 'America/Toronto', elev: 100, candles: 18 },
  { id: 'ldn', name: 'לאנדאן (סטאמפארד היל)', lat: 51.5700, lon: -0.0720, tz: 'Europe/London', elev: 30, candles: 18 },
  { id: 'antw', name: 'אנטווערפן', lat: 51.2194, lon: 4.4025, tz: 'Europe/Brussels', elev: 10, candles: 18 },
  { id: 'jlm', name: 'ירושלים', lat: 31.7780, lon: 35.2354, tz: 'Asia/Jerusalem', elev: 780, candles: 40 },
  { id: 'bb', name: 'בני ברק', lat: 32.0807, lon: 34.8338, tz: 'Asia/Jerusalem', elev: 30, candles: 22 },
  { id: 'bs', name: 'בית שמש', lat: 31.7300, lon: 34.9900, tz: 'Asia/Jerusalem', elev: 300, candles: 30 },
];

export function shulDefaults(key = DEFAULT_SHUL) {
  const bp = key === 'bp';
  return {
    kind: 'shul', // סימן — gviz מחזיר את הלשונית הראשונה כשאין ShulConfig
    key,
    name: bp ? 'קהל אונגוואר' : '',
    lang: 'yi', // שפת התצוגה: yi / he / en
    // המקום: city = אחד מ-CITIES, או 'custom'
    loc: { city: 'bp', name: 'בארא פארק', lat: 40.6340, lon: -73.9960, tz: 'America/New_York', elev: 20, il: false },
    // שיטות הזמנים — ריק = ברירת המחדל (72 דקות, הדלקה 18)
    z: { alos: 'm72', motzei: 'm72', candles: 18, shkia: 'sea', table: bp },
    // גרסה: '' = תמיד האחרונה; מספר = נעול על הגרסה הזאת
    ver: '',
  };
}

export function normShul(j, key = DEFAULT_SHUL) {
  const d = shulDefaults(key);
  const o = { ...d, ...(j || {}) };
  o.loc = { ...d.loc, ...(j?.loc || {}) };
  o.z = { ...d.z, ...(j?.z || {}) };
  return o;
}

/** הגדרות בית הכנסת → מקום לחישוב הזמנים (כמו LOCATIONS) */
export function locOf(cfg) {
  const c = cfg || shulDefaults();
  // בארא פארק בלי שינויים = בדיוק כמו היום
  const plainBp = c.loc.city === 'bp' && c.z.alos === 'm72' && c.z.motzei === 'm72' && Number(c.z.candles) === 18 && c.z.shkia === 'sea' && c.z.table !== false;
  if (plainBp) return LOCATIONS.bp;
  const il = /Jerusalem|Tel_Aviv/.test(c.loc.tz) || !!c.loc.il;
  return {
    key: c.key === 'bp' && c.loc.city === 'bp' ? 'bp' : `shul:${c.key}`,
    name: c.loc.name, lat: Number(c.loc.lat), lon: Number(c.loc.lon), tz: c.loc.tz, elev: Number(c.loc.elev) || 0, il,
    candles: Number(c.z.candles) || 18,
    table: !!c.z.table && c.loc.city === 'bp',
    z: { alos: c.z.alos, motzei: c.z.motzei, candles: Number(c.z.candles) === 18 && c.z.table && c.loc.city === 'bp' ? '' : c.z.candles, shkia: c.z.shkia },
  };
}
export function applyShul(cfg) { const l = locOf(cfg); setLocation(l); return l; }

// ---------- קריאה מהגיליון: JSON בחלקים (data#0, data#1…) ----------
export const joinParts = (rows) => {
  const parts = rows.filter((r) => /^data#\d+$/.test(String(r[0] || ''))).sort((x, y) => Number(String(x[0]).split('#')[1]) - Number(String(y[0]).split('#')[1]));
  return parts.length ? JSON.parse(parts.map((r) => r[1] || '').join('')) : null;
};
