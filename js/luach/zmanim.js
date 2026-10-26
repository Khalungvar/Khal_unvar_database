// זמני היום — חשבון אסטרונומי (NOAA), בלי אינטערנעט, פאר יעדן יאר.
// שיטות (לויט דעם לוח פון מכון משנה הלכות): הדלקת נרות 18 מינוט פאר שקיעה; מוצ"ש / ר"ת 72 מינוט נאך שקיעה;
// מג"א: עלות 72 מינוט פאר נץ ביז צאת 72 מינוט נאך שקיעה.
// ווען ס'איז דא א טאבעלע פון chaitables (נץ/שקיעה הנראים) פאר א טאג — ווערט זי גענוצט אנשטאט דעם חשבון.

export const LOCATIONS = {
  // בארא פארק: הדלקה 18 מינוט; די טאבעלע פון chaitables (LuachZmanim) איז נאר פאר דא
  bp: { key: 'bp', name: 'בארא פארק', en: 'Boro Park', lat: 40.6340, lon: -73.9960, tz: 'America/New_York', candles: 18, il: false },
  // ירושלים: מנהג ירושלים — הדלקה 40 מינוט פאר שקיעה
  // ירושלים — ווי MyZmanim: נץ/שקיעה "בגובה 650 מטר מישור"; עלות/צאת למג"א 72 דק' לפי 16.1 מעלות; לילה 72 דק' נאך שקיעה בגובה 650/0
  jlm: { key: 'jlm', name: 'ירושלים', en: 'Jerusalem', lat: 31.7780, lon: 35.2354, tz: 'Asia/Jerusalem', candles: 40, il: true, myz: true },
};
export const LOCATION = LOCATIONS.bp;

const RAD = Math.PI / 180;

/** UTC מינוט פון נץ / שקיעה / חצות פאר א טאג (y, m 1-12, d), zenith 90.833 = ים-שפיגל */
function solar(y, m, d, lat, lon, zenith = 90.833) {
  const jd0 = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5;
  const calc = (kind, jd) => {
    const t = (jd - 2451545) / 36525;
    const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
    const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const C = Math.sin(M * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * M * RAD) * 0.000289;
    const om = 125.04 - 1934.136 * t;
    const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);
    const eps = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * RAD);
    const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD)) / RAD;
    const yv = Math.tan((eps / 2) * RAD) ** 2;
    const eqt = (4 * (yv * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * yv * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
      - 0.5 * yv * yv * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD))) / RAD;
    const noon = 720 - 4 * lon - eqt;
    if (kind === 'noon') return noon;
    const ha = Math.acos(Math.cos(zenith * RAD) / (Math.cos(lat * RAD) * Math.cos(decl * RAD)) - Math.tan(lat * RAD) * Math.tan(decl * RAD)) / RAD;
    return kind === 'rise' ? noon - 4 * ha : noon + 4 * ha;
  };
  const out = {};
  ['rise', 'set', 'noon'].forEach((k) => {
    let v = calc(k, jd0 + 0.5);
    v = calc(k, jd0 + v / 1440);
    out[k] = calc(k, jd0 + v / 1440);
  });
  return out;
}

const offCache = new Map();
/** וויפיל מינוט ניו יארק איז פון UTC אין יענעם טאג (מיט זומער-צייט) */
function tzOffset(y, m, d, tz) {
  const key = `${tz}|${y}-${m}-${d}`;
  if (offCache.has(key)) return offCache.get(key);
  const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  const mm = /GMT([+-]\d+)(?::(\d+))?/.exec(s);
  const v = mm ? Number(mm[1]) * 60 + (mm[2] ? Math.sign(Number(mm[1])) * Number(mm[2]) : 0) : 0;
  offCache.set(key, v);
  return v;
}

/** 2026-11-01 → 'end' / 2027-03-14 → 'start' — דער טאג וואו מ'טוישט די צייט */
export function dstChange(iso, tz = LOCATION.tz) {
  const [y, m, d] = iso.split('-').map(Number);
  const a = tzOffset(y, m, d, tz);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const b = tzOffset(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), tz);
  // דער טויש איז 2 אזייגער פרי — פונעם טאג גופא: פארגלייכן מיט דעם טאג פריער
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const p = tzOffset(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), tz);
  void b;
  if (a > p) return 'start';
  if (a < p) return 'end';
  return '';
}

/** טאבעלע פון chaitables: { 'YYYY-MM-DD': { neitz: min, shkia: min, ... } } — מינוט פון האלבנאכט */
let table = {};
export function setZmanimTable(t) { table = t || {}; }

/**
 * די זמנים פאר א טאג, אין מינוט פון האלבנאכט (לאקאלע צייט, מיט שברים).
 * { neitz, shkia, chatzos, alos, tzeis, maKS, graKS, maTefila, candles, motzei, source }
 */
export function zmanim(iso, loc = LOCATION) {
  const [y, m, d] = iso.split('-').map(Number);
  const o = tzOffset(y, m, d, loc.tz);
  const s = solar(y, m, d, loc.lat, loc.lon);
  let neitz = s.rise + o;
  let shkia = s.set + o;
  const t = loc.key === 'bp' ? table[iso] : null;
  let source = 'calc';
  if (t && t.neitz != null && t.shkia != null) { neitz = t.neitz; shkia = t.shkia; source = 'table'; }
  const chatzos = t?.chatzos ?? (neitz + shkia) / 2;
  let alos = neitz - 72;
  let tzeis = shkia + 72;
  let night = shkia + 72;
  if (loc.myz && !t) {
    const deg = solar(y, m, d, loc.lat, loc.lon, 90 + 16.1); // 16.1 מעלות
    alos = deg.rise + o; tzeis = deg.set + o;
    night = solar(y, m, d, loc.lat, loc.lon, 90.833 + 0.92).set + o + 72; // שקיעה בגובה 650/0 + 72
  }
  const maHour = (tzeis - alos) / 12;
  const graHour = (shkia - neitz) / 12;
  return {
    neitz, shkia, chatzos, alos, tzeis, source,
    maKS: t?.maKS ?? alos + 3 * maHour,
    graKS: t?.graKS ?? neitz + 3 * graHour,
    maAchila: alos + 4 * maHour, // סוף זמן אכילת חמץ (מ"א)
    maSreifa: alos + 5 * maHour, // סוף זמן שריפת חמץ (מ"א)
    candles: t?.candles ?? shkia - (loc.candles ?? 18),
    motzei: t?.motzei ?? night,
  };
}

/** מינוט → '6:52' (12-שעה, אן AM/PM, ווי אינעם לוח) */
export function hhmm(min, round = 'round') {
  const v = Math[round](min);
  let h = Math.floor(v / 60) % 24; const mm = ((v % 60) + 60) % 60;
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, '0')}`;
}
