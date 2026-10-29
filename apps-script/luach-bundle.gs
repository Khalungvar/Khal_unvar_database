// נישט טוישן מיט דער האנט — געבויט פון js/luach/autovars.js דורך tools/build-luach-gs.mjs
var LUACH = (function () {
  var __m = {};
  __m["js/hebdate.js"] = (function () {
// תאריכים עבריים: המרה בין לועזי לעברי בעזרת לוח השנה העברי שמובנה בדפדפן (Intl), בלי ספריות חיצוניות.

// שמות החודשים כפי שהדפדפן מחזיר אותם → השם בעברית
const MONTH_HE = {
  Tishri: 'תשרי', Heshvan: 'חשון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט',
  'Adar I': 'אדר א\'', 'Adar II': 'אדר ב\'', Adar: 'אדר',
  Nisan: 'ניסן', Iyar: 'אייר', Sivan: 'סיון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול',
};
const ORDER_REGULAR = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];
const ORDER_LEAP = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar I', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];

const fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** תאריך לועזי (Date או 'YYYY-MM-DD') → { d, m, y }. m = שם החודש באנגלית (מפתח). */
function toHebrew(date) {
  const dt = typeof date === 'string' ? isoToUtc(date) : date;
  if (!dt || Number.isNaN(dt.getTime())) return null;
  const parts = Object.fromEntries(fmt.formatToParts(dt).map((p) => [p.type, p.value]));
  return { d: Number(parts.day), m: parts.month, y: Number(parts.year) };
}

function isoToUtc(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

function utcToIso(dt) {
  return dt.toISOString().slice(0, 10);
}

function isLeapYear(y) {
  return ((7 * y + 1) % 19) < 7;
}

/** רשימת החודשים בשנה עברית: [{ key, he }]. */
function monthsOf(y) {
  return (isLeapYear(y) ? ORDER_LEAP : ORDER_REGULAR).map((key) => ({ key, he: MONTH_HE[key] }));
}

/** { d, m, y } → 'YYYY-MM-DD', או '' אם התאריך לא קיים (למשל ל' בחודש של 29 יום). */
function fromHebrew(d, m, y) {
  if (!d || !m || !y) return '';
  // ראש השנה העברית נופל בין 5.9 ל-5.10 של השנה הלועזית y-3761
  const start = Date.UTC(y - 3761, 8, 1);
  for (let i = 0; i < 400; i += 1) {
    const dt = new Date(start + i * 86400000);
    const h = toHebrew(dt);
    if (h.y === y && h.m === m && h.d === d) return utcToIso(dt);
    if (h.y > y) break;
  }
  return '';
}

// ---------- מספרים עבריים ----------
const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/** 15 → ט"ו, 787 → תשפ"ז, 7 → ז'. */
function hebrewNumber(n) {
  let s = HUNDREDS[Math.floor(n / 100) % 10] + TENS[Math.floor(n / 10) % 10] + ONES[n % 10];
  s = s.replace('יה', 'טו').replace('יו', 'טז');
  return s.length > 1 ? `${s.slice(0, -1)}"${s.slice(-1)}` : `${s}'`;
}

/** שנה עברית כטקסט: 5787 → תשפ"ז */
function yearLabel(y) {
  return hebrewNumber(y % 1000);
}

/** { d, m, y } → 'ז' חשון תשפ"ז' */
function formatHebrew(h) {
  if (!h) return '';
  return `${hebrewNumber(h.d)} ${MONTH_HE[h.m] || h.m} ${yearLabel(h.y)}`;
}

/** תאריך לועזי → טקסט עברי. */
function isoToHebrewText(iso) {
  return formatHebrew(toHebrew(iso));
}

const LETTER_VALUE = Object.fromEntries([
  ...ONES.map((c, i) => [c, i]), ...TENS.map((c, i) => [c, i * 10]),
  ['ק', 100], ['ר', 200], ['ש', 300], ['ת', 400],
].filter(([c]) => c));

function numberFromHebrew(text) {
  return [...String(text).replace(/["'״׳]/g, '')].reduce((sum, ch) => sum + (LETTER_VALUE[ch] || 0), 0);
}

/** טקסט 'ז' חשון תשפ"ז' → { d, m, y } (או null). */
function parseHebrewText(text) {
  const t = String(text || '').trim();
  const monthEntry = Object.entries(MONTH_HE)
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, he]) => t.includes(` ${he} `));
  if (!monthEntry) return null;
  const [key, he] = monthEntry;
  const [dayPart, yearPart] = t.split(` ${he} `);
  const d = numberFromHebrew(dayPart);
  const y = 5000 + numberFromHebrew(yearPart);
  return d && yearPart ? { d, m: key, y } : null;
}

/** היום, כ-'YYYY-MM-DD' לפי השעון המקומי. */
function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- מאורעות שחוזרים כל שנה לפי הלוח העברי ----------
/** שם חודש בעברית ('אדר ב\'') → מפתח ('Adar II'). */
function monthKeyFromHe(he) {
  const e = Object.entries(MONTH_HE).find(([, v]) => v === String(he || '').trim());
  return e ? e[0] : '';
}

function monthHe(key) {
  return MONTH_HE[key] || key || '';
}

/** טקסט שנה ('תשפ"ז') → 5787, או 0. */
function yearFromLabel(label) {
  const n = numberFromHebrew(label);
  return n ? 5000 + n : 0;
}

/**
 * באיזה חודש מציינים את המאורע בשנה y.
 * month = מפתח החודש המקורי; adarInLeap = 'Adar I' / 'Adar II' (לאדר רגיל בשנה מעוברת).
 */
function monthInYear(month, y, adarInLeap) {
  const leap = isLeapYear(y);
  if (month === 'Adar') return leap ? (adarInLeap || 'Adar II') : 'Adar';
  if (month === 'Adar I' || month === 'Adar II') return leap ? month : 'Adar';
  return month;
}

/** התאריך הלועזי של המאורע בשנה העברית y. יום שלא קיים בחודש (ל' בחשון וכו') → היום האחרון בחודש. */
function occurrenceIn(y, d, month, adarInLeap) {
  const m = monthInYear(month, y, adarInLeap);
  for (let day = d; day >= 29; day -= 1) {
    const iso = fromHebrew(day, m, y);
    if (iso) return iso;
  }
  return fromHebrew(Math.min(d, 29), m, y);
}

/** הפעם הבאה (מהיום והלאה) שהמאורע חל: 'YYYY-MM-DD'. */
function nextOccurrence(d, month, adarInLeap, fromIso = todayIso()) {
  const y = toHebrew(fromIso).y;
  for (const yy of [y, y + 1]) {
    const iso = occurrenceIn(yy, d, month, adarInLeap);
    if (iso && iso >= fromIso) return iso;
  }
  return '';
}

/** כמה ימים מ-a עד b (תאריכי ISO). */
function daysBetween(a, b) {
  return Math.round((isoToUtc(b) - isoToUtc(a)) / 86400000);
}

return { toHebrew, isLeapYear, monthsOf, fromHebrew, hebrewNumber, yearLabel, formatHebrew, isoToHebrewText, parseHebrewText, todayIso, monthKeyFromHe, monthHe, yearFromLabel, occurrenceIn, nextOccurrence, daysBetween };
  })();
  __m["js/luach/zmanim.js"] = (function () {
// זמני היום — חשבון אסטרונומי (NOAA), בלי אינטערנעט, פאר יעדן יאר.
// שיטות (לויט דעם לוח פון מכון משנה הלכות): הדלקת נרות 18 מינוט פאר שקיעה; מוצ"ש / ר"ת 72 מינוט נאך שקיעה;
// מג"א: עלות 72 מינוט פאר נץ ביז צאת 72 מינוט נאך שקיעה.
// ווען ס'איז דא א טאבעלע פון chaitables (נץ/שקיעה הנראים) פאר א טאג — ווערט זי גענוצט אנשטאט דעם חשבון.

const LOCATIONS = {
  // בארא פארק: הדלקה 18 מינוט; די טאבעלע פון chaitables (LuachZmanim) איז נאר פאר דא
  bp: { key: 'bp', name: 'בארא פארק', en: 'Boro Park', lat: 40.6340, lon: -73.9960, tz: 'America/New_York', candles: 18, il: false },
  // ירושלים: מנהג ירושלים — הדלקה 40 מינוט פאר שקיעה
  // ירושלים — ווי MyZmanim: נץ/שקיעה "בגובה 650 מטר מישור"; עלות/צאת למג"א 72 דק' לפי 16.1 מעלות; לילה 72 דק' נאך שקיעה בגובה 650/0
  jlm: { key: 'jlm', name: 'ירושלים', en: 'Jerusalem', lat: 31.7780, lon: 35.2354, tz: 'Asia/Jerusalem', candles: 40, il: true, myz: true },
};
const LOCATION = LOCATIONS.bp;

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
function dstChange(iso, tz = LOCATION.tz) {
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
function setZmanimTable(t) { table = t || {}; }

/**
 * די זמנים פאר א טאג, אין מינוט פון האלבנאכט (לאקאלע צייט, מיט שברים).
 * { neitz, shkia, chatzos, alos, tzeis, maKS, graKS, maTefila, candles, motzei, source }
 */
function zmanim(iso, loc = LOCATION) {
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
function hhmm(min, round = 'round') {
  const v = Math[round](min);
  let h = Math.floor(v / 60) % 24; const mm = ((v % 60) + 60) % 60;
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, '0')}`;
}

return { dstChange, setZmanimTable, zmanim, hhmm, LOCATIONS, LOCATION };
  })();
  __m["js/luach/mitzvos.js"] = (function () {
// מצוה יומית — הרשימה של מכון משנה הלכות (613 מצוות לפי הסדר). מחזור רציף, מצוה אחת ליום.
// עוגן: א' תשרי תשפ"ז (2026-09-12) = מצוה מ' (40). אחרי 613 מתחיל שוב מא'.
const MITZVA_ANCHOR = { iso: '2026-09-12', n: 40 };
const MITZVOS = [
"מצות פריה ורביה",
"מצות מילה",
"איסור גיד הנשה",
"מצות קידוש החדש",
"שחיטת הפסח",
"אכילת הפסח",
"איסור נא ומבושל",
"לא להותיר מבשרו",
"מצות השבתת חמץ",
"מצות אכילת מצה",
"לא ימצא חמץ",
"איסור תערובת חמץ",
"האכלת פסח למומר",
"האכלתו לגר תושב",
"שלא להוציאו החוצה",
"איסור שבירת עצם",
"לא יאכלנו ערל",
"קידוש בכורות",
"איסור חמץ בפסח",
"לא יראה חמץ",
"סיפור יציאת מצרים",
"פדיון פטר חמור",
"מצות עריפתו",
"תחומין בשבת",
"שנאמין בהשי\"ת",
"לא להאמין באליל",
"שלא לעשות פסל",
"לא להשתחוות לע\"ז",
"שלא לעבדה כדרכה",
"שלא להשבע לשוא",
"מצות קדושת השבת",
"איסור מלאכה בשבת",
"כבוד אב ואם",
"שלא להרוג נקי",
"איסור אשת איש",
"גניבת נפש מישראל",
"שלא להעיד שקר",
"שלא לחמוד",
"לא לעשות צורת אדם",
"לאו דגזית במזבח",
"שלא לפסוע עליו",
"דין עבד עברי",
"יעוד אמה עבריה",
"מצות פדיונה",
"הקונה לא ימכרנה",
"שאר כסות ועונה",
"להרוג המחויב בחנק",
"לא להכות אב ואם",
"מצות דיני קנסות",
"להרוג המחיב בסיף",
"לדון בנזקי בהמה",
"שור הנסקל",
"לדון בנזקי הבור",
"דין גנב בתשלומים",
"לדון בנזקי הבער",
"לדון בנזקי אש",
"דין שומר חנם",
"דין טוען ונטען",
"דין שומר שכר ושוכר",
"דין השואל",
"דין המפתה",
"לא להחיות מכשפה",
"הונאת הגר בדברים",
"הונאת הגר בממון",
"עינוי יתום ואלמנה",
"מצות הלואה לעני",
"לא לתבוע חובו",
"לא לשית יד בריבית",
"שלא לקלל הדיין",
"לאו דברכת השם",
"שלא לקלל הנשיא",
"סדר חוק התבואה",
"שלא לאכול טריפה",
"טענת בע\"ד בפני חברו",
"לא יעיד בעל עבירה",
"דין נטי' בדין נפשות",
"המלמד זכות וחובה",
"אחרי רבים להטות",
"לא לרחם עני בדין",
"מצות פרוק המשא",
"לא להטות משפט הרש",
"דין באומד הדעת",
"שלא ליקח שוחד",
"מצות שמיטת קרקעות",
"מצות שביתה בשבת",
"שלא להשבע בע\"א",
"הדחת בנ\"י לע\"א",
"מצות חגיגה ברגל",
"הפסח על חמץ",
"לא להלין אימוריו",
"מצות ביכורים",
"אכילת בשר וחלב",
"כריתת ברית לז' אומות",
"השכנת ע\"א בארץ",
"בנין בית הבחירה",
"הבדים לא יסורו",
"סידור לחם הפנים",
"לערוך נרות במקדש",
"לבישת בגדי כהונה",
"לא יזח החושן",
"שלא לקרוע המעיל",
"אכילת חטאת ואשם",
"מצות הקטרת קטורת",
"איסור קטורת זרה",
"מחצית השקל",
"קידוש ידים ורגלים",
"מצות שמן המשחה",
"שלא יסוך בו זר",
"שלא לעשות כמוהו",
"שלא לעשות קטורת",
"אכילת תקרובת ע\"ז",
"מצות שביתת הארץ",
"איסור בשר בחלב",
"משפט מות בשבת",
"מצות מעשה העולה",
"מצות קרבן מנחה",
"איסור שאור ודבש",
"לא להקריב בלי מלח",
"מצות מליחת הקרבן",
"קרבן ב\"ד שטעו",
"קרבן חטאת יחיד",
"מצות עדות",
"קרבן עולה ויורד",
"מליקת חטאת העוף",
"לא ישים עלי' שמן",
"לא יתן עלי' לבונה",
"הוספת חומש במעשר",
"קרבן אשם תלוי",
"קרבן אשם ודאי",
"מצות השבת הגזל",
"מצות תרומת הדשן",
"אש תמיד על המזבח",
"שלא לכבות האש",
"אכילת שיירי מנחה",
"שלא לעשותה חמץ",
"קרבן מנחת כהן",
"שלא לאכול מנחתו",
"מצות מעשה החטאת",
"דין חטאת הפנימית",
"מצות מעשה האשם",
"מצות מעשה השלמים",
"לא תותירו ממנו",
"דין שריפת הנותר",
"דיני פיגול",
"דין קדשים שנטמאו",
"שריפת קדשים טמאים",
"שלא לאכול חלב",
"שלא נאכל דם",
"ראשיכם אל תפרעו",
"קרוע בגדים במקדש",
"מן המקדש לא יצא",
"יין ושכר אל תשת",
"סימני בהמה וחי'",
"שלא לאכול הטמאים",
"סימני דגים",
"לא לאכול דג טמא",
"דין עוף טמא",
"לבדוק בסימני חגבים",
"דין שמונה שרצים",
"דין טומאת אוכלים",
"דין טומאת נבילות",
"שלא לאכול שרץ",
"דין השרצים בזרעים",
"דין שרץ המים",
"דין שרצים מעיפוש",
"טומאת יולדת",
"טמא לא יאכל קדשים",
"דין קרבן יולדת",
"להביא מצורע לכהן",
"איסור גלוח הנתק",
"דין הנהגת המצורע",
"דין נגעי בגדים",
"דין טהרת המצורע",
"דין תגלחת המצורע",
"טבילת הטמא במקווה",
"דין קרבן מצורע",
"דיני נגעי בתים",
"דין טומאת הזב",
"דין קרבן הזב",
"טומאת שכבת זרע",
"דין טומאת הנדה",
"דין טומאת הזבה",
"חיוב הזב בקרבן",
"לא לבא בכל עת לקודש",
"דין עבודת יום הכפורים",
"דין שחוטי חוץ",
"מצות כיסוי הדם",
"דין איסור עריות",
"ערות אביך לא תגלה",
"איסור ערות האם",
"ערות אשת האב",
"איסור ערות אחות",
"ערות בת הבן",
"ערות בת הבת",
"איסור ערות הבת",
"ערות בת אשת אב",
"ערות אחות האב",
"ערות אחות האם",
"ערות אח האב",
"ערות אשת אח האב",
"ערות כלתך לא תגלה",
"איסור אשת אח",
"ערות אשה ובתה",
"אשה ובת בנה",
"אשה ובת בתה",
"ערות אשה ואחותה",
"דין אשה נדה",
"מזרעך לא תתן למולך",
"איסור משכב זכר",
"לא תשכב עם בהמה",
"ואשה לא תעמוד לפני בהמה",
"איש אמו ואביו תיראו",
"אל תפנו אל האלילים",
"איסור עבודה זרה",
"שלא לאכול נותר",
"לא תכלה פאת שדך",
"לעני ולגר תעזוב",
"לעזוב הלקט לעני",
"לקט קצירך לא תלקט",
"דיני עוללות",
"שלא לעולל הכרם",
"לעזוב הפרט לעני",
"פרט כרמך לא תלקט",
"שלא לגנוב ממון",
"שלא לכחש ממון",
"לא תשקרו",
"שלא להשבע לשקר",
"לא תעשוק את רעך",
"איסור גזל",
"לא להלין שכר שכיר",
"שלא לקלל",
"שלא להכשיר עיור",
"לא תעשו עול במשפט",
"לא תהדר פני גדול",
"בצדק תשפוט עמיתך",
"שלא ללכת רכיל",
"לא תעמוד על דם רעך",
"לא תשנא את אחיך",
"מצות הוכחה",
"איסור הלבנת פנים",
"שלא לנקום",
"שלא ליטול",
"ואהבת לרעך כמוך",
"איסור כלאי בהמה",
"שדך לא תזרע כלאים",
"דיני ערלה",
"דיני נטע רבעי",
"לא תאכלו על הדם",
"שלא לנחש",
"שלא לעונן",
"לא תקיפו פאת הראש",
"לא להשחית פאת הזקן",
"איסור כתובת קעקע",
"מצות ומקדשי תיראו",
"אל תפנו אל האובות",
"לא לפנות לידעונים",
"כבוד חכמים וזקנים",
"לא להונות במשקלות",
"מצות מאזני צדק",
"שלא לקלל אב ואם",
"מצות הנשרפין",
"ובחוקותיהם לא תלכו",
"שלא יטמאו הכהנים",
"טומאת כהנים לקרוביהם",
"הערב שמש לטבול יום",
"איסור זונה לכהן",
"איסור חללה לכהן",
"איסור גרושה לכהן",
"מצוה לקדש הכהנים",
"כהן גדול לא יטמא לקרוב",
"לאביו ולאמו לא יטמא",
"והוא אשה בבתוליה יקח",
"שלא יקח אלמנה",
"שלא יבעול אלמנה",
"שלא יעבוד בעל מום",
"בעל מום עובר לא יעבוד",
"לא יכנס בעל מום להיכל",
"שלא יעבוד טמא",
"טמא לא יאכל תרומה",
"שלא יאכל זר בתרומה",
"תושב ושכיר לא יאכל בו",
"ערל לא יאכל תרומה",
"חללה לא תאכל תרומה",
"שלא לאכול טבל",
"שלא להקדיש בעל מום",
"שיהיו הקרבנות תמימים",
"לא להטיל מום בקדשים",
"לא לזרוק דם בעל מום",
"לא לשחוט בעל מום",
"שלא להקטיר בעל מום",
"לא לסרס הבהמות",
"לא להקריב בע\"מ של גוי",
"מיום השמיני והלאה ירצה",
"דין אותו ואת בנו",
"שלא לחלל שם שמים",
"קידוש שם שמים",
"לשבות ביום א' דפסח",
"שלא לעשות בו מלאכה",
"להקריב מוספים בפסח",
"לשבות בשביעי דפסח",
"שלא לעשות בו מלאכה",
"מצות הבאת העומר",
"שלא לאכול חדש",
"שלא לאכול קלי",
"שלא לאכול כרמל",
"מצות ספירת העומר",
"מצות שתי הלחם",
"מצות שביתה בשבועות",
"שלא לעשות בו מלאכה",
"לשבות ממלאכה בר\"ה",
"שלא לעשות בו מלאכה",
"להקריב בו קרבן מוסף",
"להתענות ביום כפור",
"קרבן מוסף יום כפור",
"שלא לעשות בו מלאכה",
"איסור אכילה ושתיה",
"לשבות בו ממלאכה",
"לשבות בראשון דסוכות",
"שלא לעשות בו מלאכה",
"להקריב מוספים בסוכות",
"לשבות ממלאכה בשמע\"צ",
"קרבן מוסף שמע\"צ",
"איסור מלאכה בשמע\"צ",
"מצות נטילת לולב",
"בסוכות תשבו שבעת ימים",
"מצות שמיטת קרקעות",
"מלאכת האילן בשמיטה",
"ספיח קצירך לא תקצור",
"ענבי נזירך לא תבצור",
"מנין שמיטות ליובל",
"תקיעת שופר ביובל",
"לקדש את שנת החמשים",
"שלא לזרוע ביובל",
"שלא לקצור ביובל",
"שלא לאסוף פרי האילן",
"דיני מקח וממכר",
"שלא להונות בממון",
"שלא להונות בדברים",
"הארץ לא תמכר לצמיתות",
"להשיב השדות ביובל",
"פדיון בתי ערי חומה",
"דין מגרשי הלויים",
"כספך לא תתן בנשך",
"לא להעביד ע\"ע בבזיון",
"לא למכרו כמו הכנעני",
"שלא לרדותו בפרך",
"לעבוד בעבד כנעני לעולם",
"שלא יעבוד עכו\"ם בע\"ע",
"ואבן משכית לא תתנו",
"דיני ערך אדם",
"לא יחליפנו ולא ימיר",
"הוא ותמורתו קודש",
"מצות ערך בהמה",
"דיני ערך בתים",
"דיני ערכי שדות",
"שלא לשנות קדשים",
"כל חרם לכהן יהיה",
"לא למכור שדה החרם",
"שלא יגאל שדה החרם",
"מצות מעשר בהמה",
"שלא למכור מעשר בהמה",
"שילוח הטמא מהמחנה",
"איסור כניסתו בביהמ\"ק",
"מצות וידוי על חטאת",
"דיני סוטה",
"לא ליתן שמן בקרבנה",
"ולא יתן עליה לבונה",
"שלא ישתה הנזיר יין",
"שלא יאכל ענבים",
"שלא יאכל צימוקים",
"לא יאכל גרעיני ענבים",
"לא יאכל קליפת ענבים",
"לא יגלח שערו",
"שיגדל שער ראשו",
"שלא יכנס לאהל המת",
"שלא ייטמא למת",
"שיגלח ויביא קרבנו",
"מצות ברכת כהנים",
"משא הארון בכתף",
"מצות פסח שני",
"אכילת פסח שני",
"שלא להותיר מבשרו",
"ועצם לא תשברו בו",
"מצות תקיעה בחצוצרות",
"מצות הפרשת חלה",
"מצות ציצית",
"לא תתורו אחרי לבבכם",
"מצות שמירה במקדש",
"שלא להחליף העבודות",
"שלא יעבוד זר במקדש",
"לא לבטל שמירת המקדש",
"פדיון בכור אדם",
"בכור טהורה לא יפדה",
"עבדת הלויים במקדש",
"מצות מעשר ראשון",
"מצות תרומת מעשר",
"מצות פרה אדומה",
"דיני טומאת מת",
"טומאת מי נדה",
"דיני נחלות",
"מצות קרבן תמיד",
"קרבן מוסף שבת",
"קרבן מוסף ראש חדש",
"מוסף חג השבועות",
"מצות שופר בראש השנה",
"דין הפרת נדרים",
"לא יחל דברו",
"לתת ערים ללויים",
"לא להרוג רוצח בלי דין",
"מצות ערי מקלט",
"אין העד דיין בנפשות",
"לא ליקח כופר מרוצח",
"לא ליקח כופר מהגולה",
"לא למנות דיין עם הארץ",
"שלא יירא הדיין בדין",
"לא תתאוה בית רעך",
"להאמין שהשי\"ת אחד",
"מצות אהבת השם",
"ללמוד תורה וללמדה",
"קר\"ש ב' פעמים ביום",
"להניח תפילין של יד",
"הנחת תפילין של ראש",
"לקבוע מזוזה בפתח",
"שלא לנסות נביא אמת",
"להחרים ז' עממים",
"שלא לרחם על ע\"א",
"שלא להתחתן בם",
"איסור הנאה מע\"ז",
"איסור הנאה מתקרובת ע\"ז",
"מצות ברכת המזון",
"לאהוב את הגרים",
"לירא מהקב\"ה",
"להתפלל בכל יום",
"להדבק ביודעי התורה",
"ובשמו תשבע",
"לאבד ע\"ז ומשמשיה",
"לא תעשון כן לה'",
"להביא הנדרים ברגל",
"לא להקריב חוץ לעזרה",
"להקריב הקרבנות במקדש",
"לפדות קדשים בע\"מ",
"אכילת מע\"ש דגן בחוץ",
"אכילת מע\"ש תירוש בחוץ",
"אכילת מע\"ש יצהר בחוץ",
"ובכורות בקרך וצאנך",
"חטאת ואשם חוץ לעזרה",
"לא לאכול בשר העולה",
"אכילת ק\"ק לפני זריקה",
"ביכורים לפני הבאה",
"שלא לעזוב הלוי",
"שחיטת בהמה חיה ועוף",
"איסור אבר מהחי",
"להביא הקרבנות לביהמ\"ק",
"לא תוסיף עליו",
"ולא תגרעו ממנו",
"לא לשמוע לנביא ע\"ז",
"שלא לאהוב המסית",
"לשנוא המסית",
"שלא להצילו",
"שלא ללמד עליו זכות",
"ולא תכסה עליו",
"שלא להסית לע\"ז",
"לדרוש ולחקור העדים",
"שריפת עיר הנדחת",
"לא לבנות עיר הנדחת",
"שלא להנות מממונה",
"לא תתגודדו",
"לא לקרח שער הראש",
"אכילת פסולי המוקדשין",
"לבדוק בסימני העוף",
"לא לאכול שרץ העוף",
"שלא לאכול נבילה",
"להפריש מעשר שני",
"להפריש מעשר עני",
"לא לתבוע חוב בשמיטה",
"את הנכרי תגוש",
"להשמיט כספים בשמיטה",
"לא תאמץ את לבבך",
"לעשות צדקה בשמחה",
"מניעת הלואה בשמיטה",
"לא תשלחנו ריקם",
"הענק תעניק לו",
"לא תעבוד בבכור שורך",
"לא תגוז בכור צאנך",
"לא תאכל עליו חמץ",
"לא להותיר בשר חגיגה",
"הקרבת פסח בבמה",
"ושמחת בחגך",
"להראות כל זכר",
"ולא יראו פני ריקם",
"להעמיד שופטים ושוטרים",
"לא תטע לך אשירה",
"שלא להקים מצבה",
"לא להקריב בעל מום",
"לשמוע לבי\"ד הגדול",
"מצות לא תסור",
"למנות מלך מישראל",
"שלא להמליך נכרי",
"לא ירבה לו סוסים",
"שלא לשוב מצרימה",
"לא ירבה לו נשים",
"לא ירבה לו כסף",
"שיכתוב המלך ס\"ת",
"לא יטול לוי נחלה",
"לא יטול בביזה",
"מצות זרוע ולחיים",
"להפריש תרומה",
"מצות ראשית הגז",
"משמרות כהונה ולויה",
"שלא לקסום",
"לא לעונן ולכשף",
"איסור חובר חבר",
"שלא לשאול באוב",
"איסור ידעוני",
"לא לדרוש למת",
"לשמוע בקול נביא",
"לא להתנבא בשקר",
"לא להתנבא בע\"ז",
"לא תגור ממנו",
"להבדיל ערי מקלט",
"לא לחוס על רוצח",
"שלא להשיג גבול",
"לא יקום ע\"א",
"ועשיתם לו כאשר זמם",
"שלא לפחד במלחמה",
"מצות משוח מלחמה",
"לקרות קודם לשלום",
"לא תחיה כל נשמה",
"לא תשחית את עצה",
"דין עגלה ערופה",
"זריעה בנחל איתן",
"דין יפת תואר",
"מכירת יפת תואר",
"שלא לעבוד בה",
"תליית המחויב",
"שלא להלין נבלתו",
"לקוברו בו ביום",
"השבת אבידה",
"שלא להעלים עין",
"חמור שונאך רובץ",
"הקם תקים עמו",
"שמלת גבר על אשה",
"שמלת אשה על גבר",
"מצות קן צפור",
"מצות שילוח הקן",
"ועשית מעקה לגגך",
"לא תשים דמים בביתך",
"לא תזרע כלאים",
"לא לאכול כלאים",
"לא לחרוש בכלאים",
"לא תלבש שעטנז",
"דיני קדושין",
"ולו תהיה לאשה",
"לא יוכל לשלחה",
"ארוסה ובועל בסקילה",
"שלא לדון האונס",
"חמישים כסף דאונס",
"לא יוכל לשלחה",
"דין פצוע דכא",
"לא יבא ממזר בקהל",
"עמון ומואב בקהל",
"לא תדרוש שלומם",
"לא תתעב אדומי",
"לא תתעב מצרי",
"איסור טמא במחנה",
"יד מחוץ למחנה",
"יתד על אזנך",
"לא תסגיר עבד",
"לא תונו",
"איסור קדישה",
"לא תביא אתנן",
"לא תשיך לאחיך",
"לנכרי תשיך",
"בל תאחר",
"מוצא שפתיך תשמור",
"כי תבוא בכרם רעך",
"ואל כליך לא תתן",
"וחרמש לא תניף",
"וכתב ספר כריתות",
"מחזיר גרושתו",
"חתן לא יצא לצבא",
"נקי יהיה לביתו",
"לא יחבול רחיים",
"השמר בנגע הצרעת",
"דיני הלוקח משכון",
"לא תשכב בעבוטו",
"להשיב המשכון לבעל",
"ביומו תתן שכרו",
"עדות קרובים",
"לא תטה משפט גר",
"חובל בגד אלמנה",
"ושכחת עומר בשדה",
"לא תשוב לקחתו",
"דיני מלקות ארבעים",
"לא יוסיף להכותו",
"לא תחסום שור",
"איסור יבמה לשוק",
"מצות יבום",
"מצות חליצה",
"להציל הנרדף",
"לא לחוס על הרודף",
"אבן גדולה וקטנה",
"זכירת עמלק",
"מחיית זכר עמלק",
"לא תשכח",
"קריאת פרשת ביכורים",
"להתודות וידוי מעשר",
"אונן במעשר שני",
"טמא במעשר שני",
"לא נתתיו למת",
"והלכת בדרכיו",
"מצות הקהל",
"לכתוב ספר תורה"
];

return { MITZVA_ANCHOR, MITZVOS };
  })();
  __m["js/luach/engine.js"] = (function () {
// דער לוח: וואס איז יעדן טאג פון א יאר (חוץ לארץ, מנהג אונגוואר). קיין DOM — נאר רעכענען.
// { days: [...], pages: [...] } פאר א אידיש יאר. יעדער טאג: { iso, n, dow, hd, hm, he, items: [...], zm }.
const { isLeapYear, hebrewNumber, monthHe } = __m["js/hebdate.js"];
const { zmanim, hhmm, dstChange, LOCATIONS } = __m["js/luach/zmanim.js"];
const { MITZVOS, MITZVA_ANCHOR } = __m["js/luach/mitzvos.js"];

const DAY = 86400000;
const nOf = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const dowOf = (n) => (((n + 4) % 7) + 7) % 7; // 0 = זונטאג (1.1.1970 איז געווען דאנערשטאג)

// ---------- דאס יאר ----------
// אייגענער חשבון (מולד + דחיות) — דער לוח פונעם בראוזער (ICU) האט א טעות למשל אין תתו"ז (2046).
const yearCache = new Map();
const elapsed = (y) => { const m = Math.floor((235 * y - 234) / 19); const parts = 12084 + 13753 * m; let d = 29 * m + Math.floor(parts / 25920); if ((3 * (d + 1)) % 7 < 3) d += 1; return d; };
const delay2 = (y) => { const l = elapsed(y - 1); const p = elapsed(y); const nx = elapsed(y + 1); if (nx - p === 356) return 2; if (p - l === 382) return 1; return 0; };
/** דער ערשטער טאג (n, טעג זינט 1.1.1970) פון ראש השנה Y */
const rhOf = (Y) => elapsed(Y) + delay2(Y) - 1373427 - 719163;
const ORDER = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];
const ORDER_L = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar I', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];
function monthLens(Y) {
  const len = rhOf(Y + 1) - rhOf(Y);
  const leap = isLeapYear(Y);
  return (leap ? ORDER_L : ORDER).map((k) => {
    if (k === 'Heshvan') return len % 10 === 5 ? 30 : 29;
    if (k === 'Kislev') return len % 10 === 3 ? 29 : 30;
    return { Tishri: 30, Tevet: 29, Shevat: 30, 'Adar I': 30, 'Adar II': 29, Adar: 29, Nisan: 30, Iyar: 29, Sivan: 30, Tamuz: 29, Av: 30, Elul: 29 }[k];
  }).map((l, i) => [(leap ? ORDER_L : ORDER)[i], l]);
}
function hdOf(n) {
  let Y = Math.floor((n + 719163 + 1373427) / 365.2468) + 1;
  while (rhOf(Y) > n) Y -= 1;
  while (rhOf(Y + 1) <= n) Y += 1;
  let d = n - rhOf(Y);
  for (const [m, l] of monthLens(Y)) { if (d < l) return { d: d + 1, m, y: Y }; d -= l; }
  return null;
}

function yearInfo(Y) {
  if (yearCache.has(Y)) return yearCache.get(Y);
  const rh = rhOf(Y); const next = rhOf(Y + 1);
  const days = [];
  const months = []; // [{ key, start, len }]
  for (let n = rh; n < next; n += 1) {
    const h = hdOf(n);
    if (h.d === 1) months.push({ key: h.m, start: n, len: 0 });
    months[months.length - 1].len += 1;
    days.push({ n, iso: isoOf(n), dow: dowOf(n), hd: h.d, hm: h.m });
  }
  const info = {
    Y, rh, next, len: next - rh, leap: isLeapYear(Y), rhDow: dowOf(rh), nextRhDow: dowOf(next), days, months,
    m: Object.fromEntries(months.map((x) => [x.key, x])),
  };
  info.adar = info.leap ? 'Adar II' : 'Adar';
  /** n פון (טאג, חודש) אין דעם יאר */
  info.at = (d, key) => { const mo = info.m[key]; return mo ? mo.start + d - 1 : null; };
  yearCache.set(Y, info);
  return info;
}

// ---------- פרשיות (חוץ לארץ) ----------
const PARSHIYOS = ['בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי',
  'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה', 'כי תשא', 'ויקהל', 'פקודי',
  'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי', 'קדושים', 'אמור', 'בהר', 'בחוקותי',
  'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חוקת', 'בלק', 'פנחס', 'מטות', 'מסעי',
  'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא', 'נצבים', 'וילך', 'האזינו'];

// ---------- פרשיות לויט קביעות (פון Hebcal, GPL) — חו"ל און ארץ ישראל ----------
const RH_ = 'rh'; const YK_ = 'yk'; const SUK = 'suk'; const CHMS = 'chms'; const SHM = 'shm';
const PES = 'pes'; const PES1 = 'pes1'; const CHMP = 'chmp'; const PES7 = 'pes7'; const PES8 = 'pes8'; const SHAV = 'shav';
const rg = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => k + a);
const D_ = (p) => -p;
const sVay = [51, 52, CHMS]; const sHaa = [52, YK_, CHMS]; const sRH = [RH_, 52, SUK, SHM];
const r020 = rg(0, 20); const r027 = rg(0, 27); const r3340 = rg(33, 40); const r4349 = rg(43, 49); const r4350 = rg(43, 50);
const KEV = {
  '020': [...sVay, ...r020, D_(21), 23, 24, CHMP, 25, D_(26), D_(28), 30, D_(31), ...r3340, D_(41), ...r4349, D_(50)],
  '0220': [...sVay, ...r020, D_(21), 23, 24, CHMP, 25, D_(26), D_(28), 30, D_(31), 33, SHAV, ...rg(34, 37), D_(38), 40, D_(41), ...r4349, D_(50)],
  '0510': [...sHaa, ...r020, D_(21), 23, 24, PES1, PES8, 25, D_(26), D_(28), 30, D_(31), ...r3340, D_(41), ...r4350],
  '0511': [...sHaa, ...r020, D_(21), 23, 24, PES, 25, D_(26), D_(28), ...rg(30, 40), D_(41), ...r4350],
  '052': [...sHaa, ...rg(0, 24), PES7, 25, D_(26), D_(28), 30, D_(31), ...r3340, D_(41), ...r4350],
  '070': [...sRH, ...r020, D_(21), 23, 24, PES7, 25, D_(26), D_(28), 30, D_(31), ...r3340, D_(41), ...r4350],
  '072': [...sRH, ...r020, D_(21), 23, 24, CHMP, 25, D_(26), D_(28), 30, D_(31), ...r3340, D_(41), ...r4349, D_(50)],
  '1200': [...sVay, ...r027, CHMP, ...rg(28, 33), SHAV, ...rg(34, 37), D_(38), 40, D_(41), ...r4349, D_(50)],
  '1201': [...sVay, ...r027, CHMP, ...rg(28, 40), D_(41), ...r4349, D_(50)],
  '1220': [...sVay, ...r027, PES1, PES8, ...rg(28, 40), D_(41), ...r4350],
  '1221': [...sVay, ...r027, PES, ...rg(28, 50)],
  '150': [...sHaa, ...rg(0, 28), PES7, ...rg(29, 50)],
  '152': [...sHaa, ...rg(0, 28), CHMP, ...rg(29, 49), D_(50)],
  '170': [...sRH, ...r027, CHMP, ...rg(28, 40), D_(41), ...r4349, D_(50)],
  '1720': [...sRH, ...r027, CHMP, ...rg(28, 33), SHAV, ...rg(34, 37), D_(38), 40, D_(41), ...r4349, D_(50)],
};
KEV['0221'] = KEV['020']; KEV['0310'] = KEV['0220']; KEV['0311'] = KEV['020'];
KEV['1310'] = KEV['1220']; KEV['1311'] = KEV['1221']; KEV['1721'] = KEV['170'];
function sedraKev(Y, il) {
  const I = yearInfo(Y);
  const type = I.len % 10 === 5 ? 2 : (I.len % 10 === 3 ? 0 : 1);
  let key = `${+I.leap}${I.rhDow + 1}${type}`;
  let arr = KEV[key];
  if (!arr) { key += +il; arr = KEV[key]; }
  const out = new Map();
  let s = I.rh; while (dowOf(s) !== 6) s += 1;
  for (let w = 0; w < arr.length; w += 1) {
    const n = s + w * 7; if (n >= I.next) break;
    const x = arr[w];
    if (typeof x === 'string') continue;
    out.set(isoOf(n), x >= 0 ? PARSHIYOS[x] : `${PARSHIYOS[-x]}-${PARSHIYOS[-x + 1]}`);
  }
  return out;
}

const sedraCache = new Map();
/** Map iso → 'פרשה' פאר אלע שבתים פון יאר Y (il = ארץ ישראל). געפרואווט: חו"ל גלייך מיטן פריערדיגן חשבון, תר"ס–תתק"ס */
function sedra(Y, il = false) {
  const k = `${Y}|${+il}`;
  if (!sedraCache.has(k)) sedraCache.set(k, sedraKev(Y, il));
  return sedraCache.get(k);
}

// ---------- דף יומי ----------
const SHAS = [['ברכות', 64], ['שבת', 157], ['עירובין', 105], ['פסחים', 121], ['שקלים', 22], ['יומא', 88], ['סוכה', 56],
  ['ביצה', 40], ['ראש השנה', 35], ['תענית', 31], ['מגילה', 32], ['מועד קטן', 29], ['חגיגה', 27], ['יבמות', 122],
  ['כתובות', 112], ['נדרים', 91], ['נזיר', 66], ['סוטה', 49], ['גיטין', 90], ['קידושין', 82], ['בבא קמא', 119],
  ['בבא מציעא', 119], ['בבא בתרא', 176], ['סנהדרין', 113], ['מכות', 24], ['שבועות', 49], ['עבודה זרה', 76],
  ['הוריות', 14], ['זבחים', 120], ['מנחות', 110], ['חולין', 142], ['בכורות', 61], ['ערכין', 34], ['תמורה', 34],
  ['כריתות', 28], ['מעילה', 37], ['נדה', 73]]; // מעילה ביז ל"ז (מיט קינים, תמיד, מדות) — ווי אינעם לוח
const DAF_LIST = (() => {
  const L = [];
  SHAS.forEach(([name, last]) => {
    for (let p = 2; p <= last; p += 1) L.push([name, p]);
  });
  return L;
})();
const DAF_START = nOf('2020-01-05'); // מחזור 14: ברכות ב
function dafYomi(iso) {
  const len = DAF_LIST.length;
  const i = (((nOf(iso) - DAF_START) % len) + len) % len;
  const [name, p] = DAF_LIST[i];
  return { masechta: name, daf: hebrewNumber(p).replace(/["']/g, ''), text: `${name} ${hebrewNumber(p).replace(/["']/g, '')}` };
}

// ---------- מצוה יומית ----------
function mitzvaYomis(iso) {
  const diff = nOf(iso) - nOf(MITZVA_ANCHOR.iso);
  const i = ((((MITZVA_ANCHOR.n - 1) + diff) % 613) + 613) % 613;
  return { n: i + 1, num: hebrewNumber(i + 1).replace(/["']/g, ''), text: MITZVOS[i] };
}

// ---------- ספירה ----------
const U = ['', 'אֶחָד', 'שְׁנַיִם', 'שְׁלֹשָׁה', 'אַרְבָּעָה', 'חֲמִשָּׁה', 'שִׁשָּׁה', 'שִׁבְעָה', 'שְׁמוֹנָה', 'תִּשְׁעָה'];
const TEEN = ['', 'אַחַד עָשָׂר', 'שְׁנֵים עָשָׂר', 'שְׁלֹשָׁה עָשָׂר', 'אַרְבָּעָה עָשָׂר', 'חֲמִשָּׁה עָשָׂר', 'שִׁשָּׁה עָשָׂר', 'שִׁבְעָה עָשָׂר', 'שְׁמוֹנָה עָשָׂר', 'תִּשְׁעָה עָשָׂר'];
const TENS = { 2: 'עֶשְׂרִים', 3: 'שְׁלֹשִׁים', 4: 'אַרְבָּעִים' };
const WAW_T = { 2: 'וְעֶשְׂרִים', 3: 'וּשְׁלֹשִׁים', 4: 'וְאַרְבָּעִים' };
const WEEKS = ['', 'שָׁבוּעַ אֶחָד', 'שְׁנֵי שָׁבוּעוֹת', 'שְׁלֹשָׁה שָׁבוּעוֹת', 'אַרְבָּעָה שָׁבוּעוֹת', 'חֲמִשָּׁה שָׁבוּעוֹת', 'שִׁשָּׁה שָׁבוּעוֹת', 'שִׁבְעָה שָׁבוּעוֹת'];
const REST = ['', 'וְיוֹם אֶחָד', 'וּשְׁנֵי יָמִים', 'וּשְׁלֹשָׁה יָמִים', 'וְאַרְבָּעָה יָמִים', 'וַחֲמִשָּׁה יָמִים', 'וְשִׁשָּׁה יָמִים'];
function omerText(k) {
  let days;
  if (k === 1) days = 'יוֹם אֶחָד';
  else if (k === 2) days = 'שְׁנֵי יָמִים';
  else if (k <= 10) days = `${k === 10 ? 'עֲשָׂרָה' : U[k]} יָמִים`;
  else if (k < 20) days = `${TEEN[k - 10]} יוֹם`;
  else if (k % 10 === 0) days = `${TENS[k / 10]} יוֹם`;
  else days = `${U[k % 10]} ${WAW_T[Math.floor(k / 10)]} יוֹם`;
  if (k < 7) return `הַיּוֹם ${days} לָעֹמֶר`;
  const w = Math.floor(k / 7); const r = k % 7;
  return `הַיּוֹם ${days}, שֶׁהֵם ${WEEKS[w]}${r ? ` ${REST[r]}` : ''} לָעֹמֶר`;
}

// ---------- הילולות (קבוע — מ'קען טוישן אין דעם גיליון) ----------
// month: מפתח; 'Adar' = אדר א' אין א מעוברת יאר (ווי אין תשפ"ז)
const HILLULOS = [
  { d: 29, m: 'Elul', text: 'כ"ק אדמו"ר הגה"ק בעל משנה הלכות זצוקללה"ה', style: 'rebbe' },
  { d: 11, m: 'Heshvan', text: 'הילולת רחל אמנו' },
  { d: 16, m: 'Heshvan', text: 'הילולת רבי עמרם חסידא' },
  { d: 20, m: 'Tevet', text: 'הילולת האות ציון' },
  { d: 24, m: 'Tevet', text: 'הילולת מהר"ם א"ש' },
  { d: 11, m: 'Shevat', text: 'הרבנית הצדקנית אהובה ליבא' },
  { d: 7, m: 'Adar', text: 'הילולת משה רבינו', leapAdar: 'Adar I' },
  { d: 17, m: 'Iyar', text: 'הילולת הבאר דוד' },
  { d: 18, m: 'Iyar', text: 'הילולת רשב"י' },
  { d: 28, m: 'Iyar', text: 'הילולת שמואל הנביא' },
  { d: 6, m: 'Sivan', text: 'דוד המלך והבעש"ט הק\'' },
  { d: 7, m: 'Sivan', text: 'רבי אליעזר זאב הי"ד' },
  { d: 11, m: 'Sivan', text: 'מהרי"א כהנא הי"ד' },
  { d: 23, m: 'Tamuz', text: 'רבי צבי דוב מארליעווע' },
  { d: 26, m: 'Elul', text: 'הילולת בעל הבית שערים' },
];
// הערות קבועות לויט דאטום (נישט לויט כללים)
const FIXED_NOTES = [];

// ---------- וואס איז יעדן טאג ----------
const RC_NAME = (I, n) => {
  const h = hdOf(n);
  return h.d;
};
void RC_NAME;

/** items: { kind, text, label?, time?, icon? }
 *  kind: hol (נאמען פון יו"ט/טאג) · parsha · special (שבת שובה...) · note (קליין אונטן) · small (נוסח / יזכור...)
 *        hillula · omer · avos · time · eruv · rebbe */
function buildYear(Y, extra = {}, opts = {}) {
  const loc = opts.loc || LOCATIONS.bp;
  const il = !!loc.il; // ארץ ישראל: איין טאג יו"ט, פרשיות פון א"י, זמנים פון דעם ארט
  const I = yearInfo(Y);
  const P = yearInfo(Y - 1);
  const map = new Map();
  const at = (n) => { const iso = isoOf(n); if (!map.has(iso)) map.set(iso, []); return map.get(iso); };
  const add = (n, kind, text, more = {}) => { if (n == null) return; at(n).push({ kind, text, ...more }); };
  const T = (d) => I.at(d, 'Tishri');
  const day = (d, k) => I.at(d, k);
  const dow = dowOf;

  // ---- תשרי ----
  [T(1) - 1, I.next - 1].forEach((n) => { add(n, 'hol', 'ערב ראש השנה'); add(n, 'note', 'זכור ברית'); });
  { let s = T(3); while (dow(s) !== 6) s += 1; add(s, 'special', 'שבת שובה'); }
  add(T(1), 'hol', 'א\' דראש השנה', { icon: 'shofar', yt: true }); add(T(2), 'hol', 'ב\' דראש השנה', { icon: 'shofar', yt: true });
  const gedalia = dow(T(3)) === 6 ? T(4) : T(3);
  add(gedalia, 'hol', dow(T(3)) === 6 ? 'צום גדליה (נדחה)' : 'צום גדליה', { fast: true });
  add(T(9), 'hol', 'ערב יום הכיפורים'); add(T(9), 'note', 'כפרות');
  add(T(10), 'hol', 'יום הכיפורים', { icon: 'yk', yt: true }); add(T(10), 'note', 'יזכור');
  add(T(14), 'hol', 'ערב סוכות');
  add(T(15), 'hol', il ? 'סוכות' : 'יום א\' דסוכות', { icon: 'sukkos', yt: true });
  if (!il) add(T(16), 'hol', 'יום ב\' דסוכות', { icon: 'sukkos2', yt: true });
  let shabbosChm = null;
  (il ? ['א', 'ב', 'ג', 'ד', 'ה'] : ['א', 'ב', 'ג', 'ד']).forEach((l, i) => {
    const n = T((il ? 16 : 17) + i);
    if (dow(n) === 6) { add(n, 'hol', 'שבת חוה"מ', { icon: 'chm', chm: true }); shabbosChm = n; } else add(n, 'hol', `${l}' דחוה"מ`, { icon: 'chm', chm: true });
  });
  add(T(20), 'small', 'בלילה: משנה תורה');
  add(T(21), 'hol', 'הושענא רבה', { icon: 'chm', chm: true });
  add(T(22), 'hol', il ? 'שמיני עצרת ושמחת תורה' : 'שמיני עצרת', { icon: il ? 'scroll' : 'scroll2', yt: true });
  add(T(22), 'note', `${shabbosChm == null && !il ? 'קהלת, ' : ''}יזכור, גשם`); // קהלת: שבת חוה"מ; ווען נישטא — חו"ל: שמיני עצרת, א"י: יום א' דסוכות
  if (shabbosChm == null && il) add(T(15), 'note', 'קהלת');
  if (shabbosChm != null) add(shabbosChm, 'note', 'קהלת');
  if (!il) add(T(23), 'hol', 'שמחת תורה', { icon: 'scroll', yt: true });
  add(T(il ? 23 : 24), 'hol', 'אסרו חג');
  // הושענות — לויט דעם טאג פון וואך (מנהג אשכנז; זיך צו פארזיכערן מיט די אלטע לוחות)
  hoshanos(I).forEach(([n, txt]) => add(n, 'note', txt));
  FIXED_NOTES.forEach((f) => { const n = I.at(f.d, f.m); add(n, f.kind, f.text); });
  // י"ג מדות: דער טאג פאר ערב יום כיפור; ווען דאס פאלט שבת — פרייטאג. תשליך אלעמאל אין דעם זעלבן טאג
  { let m13 = T(8); if (dow(m13) === 6) m13 -= 1; add(m13, 'hol', 'י"ג מדות'); add(m13, 'note', 'תשליך'); }

  // ---- ראש חודש + מברכים ----
  I.months.forEach((mo, i) => {
    if (mo.key === 'Tishri') return;
    const prev = I.months[i - 1];
    const two = prev && prev.len === 30;
    if (two) { add(mo.start - 1, 'hol', 'א\' דראש חודש', { rc: true }); add(mo.start, 'hol', 'ב\' דראש חודש', { rc: true }); } else add(mo.start, 'hol', 'ראש חודש', { rc: true });
    if (mo.key !== 'Tishri') {
      // שבת מברכים: דער שבת פאר ר"ח (נישט ווען ר"ח איז שבת אליין… דאן די שבת פריער)
      const first = two ? mo.start - 1 : mo.start;
      let s = first - 1; while (dow(s) !== 6) s -= 1;
      add(s, 'special', 'שבת מברכים');
    }
  });
  // מברכים פאר תשרי הבא יאר — מ'בענטשט נישט

  // ---- תעניות בה"ב (חשון און אייר) ----
  ['Heshvan', 'Iyar'].forEach((k) => {
    const mo = I.m[k]; if (!mo) return;
    let s = mo.start; while (dow(s) !== 6) s += 1; // ערשטער שבת פונעם חודש
    const mon = s + 2; [mon, mon + 3, mon + 7].forEach((n) => add(n, 'bahab', 'תענית בה"ב'));
  });

  // ---- חנוכה ----
  const k25 = I.at(25, 'Kislev');
  ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'].forEach((l, i) => add(k25 + i, 'hol', `${l}' דחנוכה`, { icon: 'menorah', chanuka: true }));
  add(k25 + 7, 'hol', 'זאת חנוכה', { icon: 'menorah', chanuka: true });
  // ותן טל ומטר (חו"ל): מעריב פון 4 דעצעמבער (5 ווען דער קומענדיגער לועזי'שער יאר איז א שאלט-יאר)
  {
    const gy = new Date(k25 * DAY).getUTCFullYear();
    const leapNext = ((gy + 1) % 4 === 0 && (gy + 1) % 100 !== 0) || (gy + 1) % 400 === 0;
    const eve = nOf(`${gy}-12-${leapNext ? '05' : '04'}`);
    if (dow(eve) === 5) add(eve + 1, 'note', 'במוצ"ש מתחילים ותן טל ומטר', { size: 'xs' });
    else add(eve, 'note', 'בלילה מתחילים ותן טל ומטר', { size: 'xs' });
  }
  const tevet10 = I.at(10, 'Tevet');
  add(tevet10, 'hol', 'תענית עשרה בטבת', { fast: true });

  // ---- שבט ----
  add(I.at(15, 'Shevat'), 'hol', 'ר"ה לאילנות', { icon: 'fruit' });
  // שבת שירה: דער שבת פון פרשת בשלח
  { const S0 = sedra(Y, il); for (const [iso, p] of S0) if (p === 'בשלח') add(nOf(iso), 'special', 'שבת שירה'); }

  // ---- אדר ----
  if (I.leap) { add(I.at(14, 'Adar I'), 'hol', 'פורים קטן'); add(I.at(15, 'Adar I'), 'hol', 'שושן פורים קטן'); }
  const A = I.adar;
  const purim = I.at(14, A);
  const esther = dow(purim - 1) === 6 ? purim - 3 : purim - 1;
  add(esther, 'hol', dow(purim - 1) === 6 ? 'תענית אסתר (מוקדם)' : 'תענית אסתר', { fast: true, mark: true });
  add(esther, 'small', 'מחצית השקל');
  if (loc.key === 'jlm') {
    // ירושלים: שושן פורים; ווען ט"ו איז שבת — פורים המשולש
    if (dow(purim + 1) === 6) {
      add(purim, 'hol', 'פורים המשולש: קריאת המגילה', { icon: 'purim', mark: true });
      add(purim + 1, 'hol', 'שושן פורים (על הניסים)', { mark: true });
      add(purim + 2, 'hol', 'פורים המשולש: סעודה ומשלוח מנות', { mark: true });
    } else { add(purim, 'hol', 'פורים (בשאר ערים)', { mark: true }); add(purim + 1, 'hol', 'שושן פורים', { icon: 'purim', mark: true }); }
  } else { add(purim, 'hol', 'פורים', { icon: 'purim', mark: true }); add(purim + 1, 'hol', 'שושן פורים', { mark: true }); }
  const rcNisan = I.m.Nisan.start; const rcAdar = I.m[A].start;
  const onOrBefore = (n) => { let s = n; while (dow(s) !== 6) s -= 1; return s; };
  const shekalim = onOrBefore(rcAdar); add(shekalim, 'special', 'פרשת שקלים');
  let zachor = purim - 1; while (dow(zachor) !== 6) zachor -= 1; add(zachor, 'special', 'פרשת זכור');
  const hachodesh = onOrBefore(rcNisan); add(hachodesh, 'special', 'פרשת החודש'); add(hachodesh - 7, 'special', 'פרשת פרה');

  // ---- ניסן ----
  add(rcNisan, 'small', 'נשיאים');
  const pesach = rcNisan + 14;
  let gadol = pesach - 1; while (dow(gadol) !== 6) gadol -= 1; add(gadol, 'special', 'שבת הגדול');
  const erev = pesach - 1;
  const bedika = dow(erev) === 6 ? erev - 2 : erev - 1;
  add(bedika, 'hol', 'ליל בדיקת חמץ');
  add(erev, 'hol', 'ערב פסח');
  add(erev, 'small', 'תענית בכורים');
  add(erev, 'chametz', '', { erevPesach: true });
  add(pesach, 'hol', 'יום א\' דפסח', { icon: 'seder', yt: true }); add(pesach, 'small', 'טל');
  if (!il) add(pesach + 1, 'hol', 'יום ב\' דפסח', { icon: 'seder', yt: true });
  (il ? ['א', 'ב', 'ג', 'ד', 'ה'] : ['א', 'ב', 'ג', 'ד']).forEach((l, i) => {
    const n = pesach + (il ? 1 : 2) + i;
    if (dow(n) === 6) { add(n, 'hol', 'שבת חוה"מ', { chm: true }); add(n, 'small', 'שיר השירים'); } else add(n, 'hol', `${l}' דחוה"מ`, { chm: true });
  });
  // שיר השירים: שבת חוה"מ, און ווען ס'איז נישטא — שביעי של פסח
  // (חו"ל: שביעי של פסח · א"י: יום א' דפסח)
  // ווען פסח הייבט אן שבת (חו"ל) — שרייבט מען גארנישט (לויט דעם בעל הבית)
  if (!(il ? [1, 2, 3, 4, 5] : [2, 3, 4, 5]).some((i) => dow(pesach + i) === 6) && (il || dow(pesach) !== 6)) add(il ? pesach : pesach + 6, 'small', 'שיר השירים');
  add(pesach + 6, 'hol', 'שביעי של פסח', { icon: 'matza', yt: true });
  if (il) { add(pesach + 6, 'small', 'יזכור'); add(pesach + 7, 'hol', 'אסרו חג'); } else {
    add(pesach + 7, 'hol', 'אחרון של פסח', { icon: 'matza2', yt: true }); add(pesach + 7, 'small', 'יזכור');
    add(pesach + 8, 'hol', 'אסרו חג');
  }
  // ספירה
  for (let k = 1; k <= 49; k += 1) add(pesach + k, 'omer', omerText(k));
  add(I.at(14, 'Iyar'), 'hol', 'פסח שני');

  // ---- שבועות ----
  const shavuos = I.at(6, 'Sivan');
  add(shavuos - 1, 'hol', 'ערב שבועות');
  if (il) { add(shavuos, 'hol', 'חג השבועות', { icon: 'flowers', yt: true }); add(shavuos, 'small', 'יזכור'); add(shavuos + 1, 'hol', 'אסרו חג'); } else {
    add(shavuos, 'hol', 'א\' דחג שבועות', { icon: 'flowers', yt: true }); add(shavuos + 1, 'hol', 'ב\' דחג השבועות', { icon: 'flowers', yt: true });
    add(shavuos + 1, 'small', 'יזכור');
    add(shavuos + 2, 'hol', 'אסרו חג');
  }

  // ---- תמוז / אב ----
  const t17 = I.at(17, 'Tamuz');
  add(dow(t17) === 6 ? t17 + 1 : t17, 'hol', dow(t17) === 6 ? 'תענית י"ז בתמוז (נדחה)' : 'תענית י"ז בתמוז', { fast: true });
  const av9 = I.at(9, 'Av');
  const tb = dow(av9) === 6 ? av9 + 1 : av9;
  add(tb, 'hol', dow(av9) === 6 ? 'תשעה באב (נדחה)' : 'תשעה באב', { fast: true });
  let chazon = av9; while (dow(chazon) !== 6) chazon -= 1; if (chazon === av9) chazon = av9; add(chazon, 'special', 'שבת חזון');
  add(chazon + 7, 'special', 'שבת נחמו');
  add(I.at(15, 'Av'), 'hol', 'ט"ו באב');
  // יום כיפור קטן פאר ר"ח אלול
  {
    const rcElul = I.m.Elul.start - 1; // ל' אב
    let ykk = rcElul - 1; if (dow(ykk) === 6 || dow(ykk) === 5) ykk -= (dow(ykk) === 6 ? 2 : 1);
    add(ykk, 'small', 'יום כיפור קטן');
  }
  // אלול: שופר, סליחות
  { const e1 = I.at(1, 'Elul'); add(dow(e1) === 6 ? e1 + 1 : e1, 'small', 'שופר', { size: 'l' }); }
  {
    let s = I.next - 1; while (dow(s) !== 6) s -= 1; // לעצטער שבת פאר ר"ה
    if (I.next - s < 4) s -= 7; // ר"ה מאנטאג/דינסטאג → א וואך פריער
    add(s, 'note', 'מוצ"ש מתחילים סליחות');
  }
  // ערב יו"ט: עירוב תבשילין (ווען יו"ט איז דאנערשטאג-פרייטאג אדער פרייטאג פאר שבת)
  [T(1) - 1, I.next - 1, T(14), T(21), pesach - 1, pesach + 5, shavuos - 1].forEach((n) => {
    const rh = n === T(1) - 1 || n === I.next - 1;
    // א"י: נאר ווען יו"ט (איין טאג) איז פרייטאג; ר"ה (צוויי טעג) ווי אין חו"ל
    const need = il && !rh ? dow(n) === 4 : (dow(n) === 3 || (dow(n) === 4 && n !== pesach + 5 && n !== T(21)));
    if (need) add(n, 'eruv', 'עירוב תבשילין');
  });

  // ---- פרקי אבות ----
  avos(I, il).forEach(([n, txt]) => add(n, 'avos', txt));

  // ---- הילולות ----
  HILLULOS.forEach((h) => {
    let key = h.m;
    if (key === 'Adar') key = I.leap ? (h.leapAdar || 'Adar II') : 'Adar';
    let n = I.at(h.d, key);
    if (h.m === 'Elul' && h.d === 29) n = I.at(29, 'Elul');
    add(n, h.style === 'rebbe' ? 'rebbe' : 'hillula', h.text);
  });
  // כ"ט אלול פונעם פריערדיגן יאר (ווייזט זיך אין תשרי ערב ר"ה)
  add(T(1) - 1, 'rebbe', HILLULOS[0].text);

  // ---- שעון קיץ / חורף ----
  for (let n = T(1) - 1; n < I.next; n += 1) {
    const ch = dstChange(isoOf(n), loc.tz);
    if (ch) add(n, 'dst', ch === 'end' ? 'שעון חורף (-1)' : 'שעון קיץ (+1)', { en: ch === 'end' ? 'DST Ends' : 'DST Begins' });
  }

  // ---- עקסטרע (פונעם גיליון): { iso: [items] } ----
  Object.entries(extra).forEach(([iso, items]) => items.forEach((it) => at(nOf(iso)).push(it)));

  // ---- טעג, זמנים, פרשה ----
  const S = sedra(Y, il);
  const SP = sedra(Y - 1, il);
  const ytDay = (n) => n === I.next || n === I.next + 1 || (map.get(isoOf(n)) || []).some((x) => x.yt); // ר"ה פונעם קומענדיגן יאר אויך
  const out = [];
  for (let n = T(1) - 1; n < I.next; n += 1) {
    const iso = isoOf(n); const h = hdOf(n);
    const items = map.get(iso) || [];
    const zm = zmanim(iso, loc);
    const d = dow(n);
    const parsha = d === 6 ? (S.get(iso) || SP.get(iso) || '') : '';
    const times = [];
    const yt = ytDay(n); const ytNext = ytDay(n + 1);
    if (d === 6) times.push({ label: 'מוצ"ש', time: hhmm(zm.motzei) });
    else if (d === 5 || (ytNext && !yt)) times.push({ label: 'הדה"נ', time: hhmm(zm.candles) });
    else if (yt && ytNext) times.push({ label: d === 5 ? 'הדה"נ' : 'ר"ת', time: hhmm(d === 5 ? zm.candles : zm.motzei) });
    else if (yt) times.push({ label: 'ר"ת', time: hhmm(zm.motzei) });
    if (items.some((x) => x.fast) && !items.some((x) => x.text?.startsWith('תשעה באב') && false)) {
      if (items.some((x) => x.fast)) times.push({ label: 'מוצאי תענית (ר"ת):', time: hhmm(zm.motzei), fast: true });
    }
    if (items.some((x) => x.erevPesach)) {
      times.push({ label: 'סו"ז אכילת חמץ', sub: '(מ"א):', time: hhmm(zm.maAchila, 'floor'), chametz: true });
      times.push({ label: 'שריפת חמץ', sub: '(מ"א):', time: hhmm(zm.maSreifa, 'floor'), chametz: true });
    }
    out.push({
      n, iso, dow: d, hd: h.d, hm: h.m, hy: h.y, heDay: hebrewNumber(h.d).replace(/["']/g, ''), greg: Number(iso.slice(8)),
      parsha, items: items.filter((x) => x.kind !== 'chametz'), times, zm,
      daf: dafYomi(iso), mitzva: mitzvaYomis(iso),
      shade: d === 6 || yt || items.some((x) => x.chm || x.chanuka || x.mark),
    });
  }
  const pages = pagesOf(I, out); pages.forEach((pg) => { pg.loc = loc.key; });
  return { Y, info: I, loc: loc.key, days: out, pages };
}

// ---------- הושענות ----------
// סדר ההושענות (נוסח אשכנז/ספרד) לויט דעם טאג פון וואך פונעם ערשטן טאג סוכות.
const HOSH = {
  // לויט ווי דער בעל הבית האט געשריבן (נוסח ספרד); הושענא רבה ווערט נישט געשריבן
  6: ['אום נצורה', 'למען אמתך', 'אערוך שועי', 'אבן שתיה', 'א-ל למושעות', 'אדון המושיע'],
  1: ['למען אמתך', 'אבן שתיה', 'אערוך שועי', 'אום אני חומה', 'א-ל למושעות', 'אום נצורה'],
  2: ['למען אמתך', 'אבן שתיה', 'אערוך שועי', 'א-ל למושעות', 'אום נצורה', 'אדון המושיע'],
  4: ['למען אמתך', 'אבן שתיה', 'אום נצורה', 'אערוך שועי', 'א-ל למושעות', 'אדון המושיע'],
};
function hoshanos(I) {
  const s = I.at(15, 'Tishri'); const seq = HOSH[dowOf(s)] || HOSH[6];
  return seq.map((txt, i) => [s + i, txt]);
}

// ---------- פרקי אבות ----------
const AV = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
function avos(I, il = false) {
  const lastPesach = I.m.Nisan.start + (il ? 20 : 21);
  const shavuos = I.at(6, 'Sivan');
  const list = [];
  for (let n = lastPesach + 1; n < I.next; n += 1) if (dowOf(n) === 6 && n !== shavuos && (il || n !== shavuos + 1)) list.push(n);
  const out = [];
  let i = 0;
  while (i < list.length) {
    const left = list.length - i;
    if (left >= 6) { AV.forEach((c, j) => out.push([list[i + j], `אבות ${c}`])); i += 6; continue; }
    const pat = { 5: ['א', 'ב', 'ג', 'ד', 'ה-ו'], 4: ['א', 'ב', 'ג-ד', 'ה-ו'], 3: ['א-ב', 'ג-ד', 'ה-ו'], 2: ['א-ג', 'ד-ו'], 1: ['א-ו'] }[left];
    pat.forEach((p, j) => out.push([list[i + j], `אבות ${p}`])); i += left;
  }
  return out;
}

// ---------- בלעטער: איין בלאט פאר יעדן חודש ----------
function pagesOf(I, days) {
  const byN = new Map(days.map((x) => [x.n, x]));
  const pages = [];
  let carry = []; // טעג פון פריערדיגן חודש וואס גייען אריבער (ל')
  I.months.forEach((mo, mi) => {
    const own = [...carry];
    if (mi === 0) own.unshift(I.m.Tishri.start - 1); // כ"ט אלול
    for (let d = 1; d <= Math.min(29, mo.len); d += 1) own.push(mo.start + d - 1);
    carry = [];
    // ל': אין דעם בלאט ווען ער פאסט אין דער לעצטער שורה, סיי נישט → דער קומענדיגער בלאט
    if (mo.len === 30) {
      const n30 = mo.start + 29;
      const lastRowStart = (mo.start + 28) - dowOf(mo.start + 28);
      if (n30 - lastRowStart < 7 && mi < I.months.length - 1) own.push(n30); else if (mi < I.months.length - 1) carry.push(n30); else own.push(n30);
    }
    // מיר נעמען נאר כ"ט אלול אין תשרי ווען ער איז אין דער זעלבער וואך
    const firstRow = (mo.start) - dowOf(mo.start);
    const cells = own.filter((n) => n >= firstRow || n === own[0]).sort((a, b) => a - b);
    const start = cells[0] - dowOf(cells[0]);
    const end = cells[cells.length - 1];
    const rows = [];
    for (let r = start; r <= end; r += 7) rows.push([0, 1, 2, 3, 4, 5, 6].map((k) => (cells.includes(r + k) ? byN.get(r + k) : null)));
    const g1 = new Date(mo.start * DAY); const g2 = new Date((mo.start + mo.len - 1) * DAY);
    pages.push({ key: mo.key, he: monthHe(mo.key), Y: I.Y, rows, days: cells.map((n) => byN.get(n)).filter(Boolean),
      monthDays: days.filter((x) => x.n >= mo.start && x.n < mo.start + mo.len), g1, g2, mazal: MAZAL[mi + (I.leap || mi < 6 ? 0 : 1)] });
  });
  return pages;
}
// מזלות לויט חודש (מעוברת: אדר א' דגים, אדר ב' דגים)
const MAZAL_LIST = ['מאזניים', 'עקרב', 'קשת', 'גדי', 'דלי', 'דגים', 'דגים', 'טלה', 'שור', 'תאומים', 'סרטן', 'אריה', 'בתולה'];
const MAZAL = MAZAL_LIST;



return { yearInfo, sedra, dafYomi, mitzvaYomis, omerText, buildYear, PARSHIYOS, HILLULOS, FIXED_NOTES, hdOf, isoOf, nOf, dowOf };
  })();
  __m["js/luach/minyanim.js"] = (function () {
// זמני תפילות — דאטן + חשבון. געניצט סיי פון "זמני תפילות" אינעם אתר (ניהול) סיי פון דער תצוגה אין בית הכנסת.
// ארבע טיילן: ימות החול (שחרית/מנחה/מעריב), שבת, יום טוב (אלע חגים חוץ תשרי), תשרי (מיט סליחות).
// א זמן (T): { b: 'fixed', t: 'HH:MM' (24 שעה) }  אדער  { b: 'shkia'|'neitz'|'alos'|'chatzos'|'candles'|'rt', a: ±מינוט, r: עיגול, m: 'n'|'u'|'d' }
const { zmanim } = __m["js/luach/zmanim.js"];
const { fromHebrew, isLeapYear } = __m["js/hebdate.js"];
const { buildYear, hdOf, isoOf, nOf, dowOf } = __m["js/luach/engine.js"];

const BASES = [
  ['fixed', 'שעה קבועה'], ['alos', 'עלות השחר'], ['neitz', 'נץ החמה'], ['chatzos', 'חצות'],
  ['shkia', 'שקיעה'], ['candles', 'הדלקת נרות'], ['rt', 'ר"ת'],
];
// "המאוחר / המוקדם מבין": { b: 'max'|'min', x: T, y: T } — למשל 5:30 אדער עלות +5, דאס שפעטערע
const COMBOS = [['max', 'המאוחר מבין'], ['min', 'המוקדם מבין']];
const ROUNDS = [['1n', 'בלי עיגול'], ['5n', 'עיגול ל-5 (קרוב)'], ['5u', 'עיגול ל-5 (למאוחר)'], ['5d', 'עיגול ל-5 (למוקדם)'], ['10n', 'עיגול ל-10'], ['15n', 'רבע שעה 00/15/30/45 (קרוב)'], ['15u', 'רבע שעה 00/15/30/45 (למאוחר)'], ['15d', 'רבע שעה 00/15/30/45 (למוקדם)']];
const SEASONS = [['all', 'כל השנה'], ['winter', 'שעון חורף'], ['summer', 'שעון קיץ'], ['custom', 'מ... עד...']];
// נקודות אין יאר פאר "מ... עד..." (פון דעם טאג אן, אריינגערעכנט)
const ANCHORS = [['dstStart', 'תחילת שעון קיץ'], ['dstEnd', 'תחילת שעון חורף'], ['afterPesach', 'אחרי פסח'], ['afterShavuos', 'אחרי שבועות'],
  ['rh', 'ראש השנה'], ['afterSukkos', 'אחרי סוכות'], ['chanuka', 'חנוכה'], ['purim', 'פורים']];

const toMin = (t) => { const [a, b] = String(t || '').split(':').map(Number); return Number.isFinite(a) ? a * 60 + (b || 0) : null; };
const F = (t) => ({ b: 'fixed', t });
const R = (b, a = 0, r = 1, m = 'n') => ({ b, a, r, m });

/** די זמנים פון א טאג (מינוט פון האלבנאכט) */
function dayZ(iso, loc) {
  const z = zmanim(iso, loc);
  return { ...z, candles: z.candles, rt: z.shkia + 72 };
}
/** מינוט, אדער null */
function timeOf(T, zd) {
  if (!T) return null;
  if (T.b === 'max' || T.b === 'min') {
    const v = [timeOf(T.x, zd), timeOf(T.y, zd)].filter((m) => m != null);
    return v.length ? (T.b === 'max' ? Math.max(...v) : Math.min(...v)) : null;
  }
  if (T.b === 'fixed' || T.t) return toMin(T.t);
  const base = zd[T.b];
  if (!Number.isFinite(base)) return null;
  const v = base + (Number(T.a) || 0); const r = Number(T.r) || 1;
  return T.m === 'u' ? Math.ceil(v / r) * r : T.m === 'd' ? Math.floor(v / r) * r : Math.round(v / r) * r;
}
/** א קורצע באשרייבונג: "שקיעה +25 (5)" */
function describe(T) {
  if (!T) return '—';
  if (T.b === 'max' || T.b === 'min') return `${describe(T.x)} / ${describe(T.y)} (${T.b === 'max' ? 'המאוחר' : 'המוקדם'})`;
  if (T.b === 'fixed') return T.t || '—';
  const name = (BASES.find(([k]) => k === T.b) || [, T.b])[1];
  const a = Number(T.a) || 0;
  return `${name}${a ? ` ${a > 0 ? '+' : '−'}${Math.abs(a)} דק'` : ''}`;
}
/** קיץ = זומער-צייט (DST) אין ניו יארק */
function isSummer(iso) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(new Date(`${iso}T12:00:00Z`));
    return /-4/.test(p.find((x) => x.type === 'timeZoneName')?.value || '');
  } catch { return false; }
}
const sundayN = (y, m, k) => { let n = nOf(`${y}-${String(m).padStart(2, '0')}-01`); while (dowOf(n) !== 0) n += 1; return n + 7 * (k - 1); };
const hebN = (d, m, Y) => { const iso = fromHebrew(d, m, Y); return iso ? nOf(iso) : null; };
function anchorN(a, cy) { // cy = לועזי יאר
  switch (a) {
    case 'dstStart': return sundayN(cy, 3, 2);
    case 'dstEnd': return sundayN(cy, 11, 1);
    case 'afterPesach': return hebN(23, 'Nisan', cy + 3760);
    case 'afterShavuos': return hebN(8, 'Sivan', cy + 3760);
    case 'rh': return hebN(1, 'Tishri', cy + 3761);
    case 'afterSukkos': return hebN(24, 'Tishri', cy + 3761);
    case 'chanuka': return hebN(25, 'Kislev', cy + 3761);
    case 'purim': return hebN(14, isLeapYear(cy + 3760) ? 'Adar II' : 'Adar', cy + 3760);
    default: return null;
  }
}
/** איז n צווישן "from" (אריין) און "to" (נישט אריין), רונד ארום א יאר */
function inRange(from, to, iso) {
  const n = nOf(iso); const y = Number(iso.slice(0, 4));
  const pts = [];
  for (const cy of [y - 1, y]) { const f = anchorN(from, cy); const t = anchorN(to, cy); if (f != null) pts.push([f, 1]); if (t != null) pts.push([t, 0]); }
  const past = pts.filter(([m]) => m <= n).sort((a, b) => b[0] - a[0]);
  return past.length ? past[0][1] === 1 : false;
}
const inSeason = (s, iso, r = {}) => !s || s === 'all' || (s === 'custom' ? inRange(r.from, r.to, iso) : (s === 'summer') === isSummer(iso));

// ---------- ברירת מחדל: פונעם לוח השנה (צו איבערקוקן) + די אלטע תוכנה ----------
let uid = 0; const id = () => `m${Date.now().toString(36)}${(uid += 1)}`;
const W = (time, o = {}) => ({ id: id(), time, room: '', note: '', season: 'all', cond: null, kahal: false, fri: false, last: false, ...o });
// "תלוי": דער מנין ווערט געוויזן נאר אויב ער איז {לפני/אחרי} {X דק'} {זמן}
const C = (dir, min, base) => ({ dir, min, base });
/** אלטע "auto" → cond */
function condOf(r, g) {
  if (r.cond !== undefined) return r.cond == null ? null : [].concat(r.cond);
  if (!r.auto) return null;
  return [g === 'shacharis' ? C('after', 0, 'alos') : g === 'mincha' ? C('before', 0, 'shkia') : C('after', 50, 'shkia')];
}
// תקופת קעמפ (ימות החול): חודש/טאג לועזי, אן א יאר — יעדעס יאר די זעלבע. r.campOff = [טעג 0..5] ווען דער מנין איז נישט בזמן הקעמפ
const HDOW = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'"];
function inCamp(iso, camp) {
  const c = camp || {}; const md = (m, d) => (Number(m) && Number(d) ? Number(m) * 100 + Number(d) : null);
  const f = md(c.fromM, c.fromD); const t = md(c.toM, c.toD); if (f == null || t == null) return false;
  const x = Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
  return f <= t ? x >= f && x <= t : x >= f || x <= t;
}
/** בזמן הקעמפ: null = נישט נוגע; 'drop' = נישט פארהאן; אדער א הערה "חוץ מיום א'" (די גאנצע וואך די זעלבע) */
function campEffect(r, iso, camp) {
  const off = (r.campOff || []).map(Number).filter((d) => d <= (r.fri ? 5 : 4));
  if (!off.length || !inCamp(iso, camp)) return null;
  if (off.length >= (r.fri ? 6 : 5)) return 'drop';
  return `חוץ מ${off.length === 1 ? 'יום' : 'ימים'} ${off.sort().map((d) => HDOW[d]).join(' ')}`;
}
function defaults() {
  return {
    weekday: {
      camp: { fromM: '', fromD: '', toM: '', toD: '' },
      refDay: '0', shacharisNote: 'הודו +10 מינוט', minchaNote: '', maarivNote: '', maarivAfter: 50, defaultRoom: '',
      // מנין כ"ק אדמו"ר שליט"א — באזונדער: א זמן מיט עיגול, און א "שטילע צייט" ארום אים ווען קיין אנדער מנין טאר נישט זיין
      rebbe: {
        shacharis: { on: true, time: F('07:30'), room: "חדר א'", note: '', before: 0, after: 0, fri: true },
        mincha: { on: true, time: R('shkia', 25, 5), room: "חדר ב'", note: '', before: 30, after: 0, last: true },
        maariv: { on: true, time: R('shkia', 60, 5), room: 'למטה', note: '', before: 0, after: 30 },
      },
      shacharis: [
        W(F('05:30'), { fri: true }), W(F('06:00'), { room: "חדר ב'", cond: C('after', 0, 'alos'), fri: true }), W(F('06:30'), { room: "חדר א'", fri: true }),
        W(F('07:00'), { room: "חדר ב'", fri: true }), W(F('08:00'), { room: "חדר ב'", fri: true }),
        W(F('08:30'), { room: "חדר א'", fri: true }), W(F('09:00'), { room: "חדר ב'", fri: true }), W(F('09:30'), { room: 'למטה', fri: true }),
        W(F('10:00'), { room: "חדר ב'", fri: true }),
      ],
      mincha: [
        W(F('12:45'), { room: "חדר ב'", season: 'winter' }), W(F('13:25'), { room: "חדר ב'" }), W(F('13:45'), { room: "חדר ב'", season: 'summer' }),
        ...['15:00', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'].map((t) => W(F(t), { room: "חדר ב'", cond: ['16:00', '16:30', '17:00', '18:30'].includes(t) ? null : C('before', 0, 'shkia') })),
      ],
      maariv: [
        ...['20:00', '20:30', '21:00'].map((t) => W(F(t), { cond: C('after', 50, 'shkia') })),
        ...['21:30', '22:00', '22:30'].map((t) => W(F(t))),
      ],
    },
    shabbos: {
      rows: [
        { id: id(), label: 'מנחה וקבלת שבת', day: 'fri', kind: 'tefila', season: 'custom', from: 'dstEnd', to: 'afterShavuos', time: R('candles', 20), note: '' },
        { id: id(), label: 'מנחה וקבלת שבת', day: 'fri', kind: 'tefila', season: 'custom', from: 'afterShavuos', to: 'dstEnd', time: R('candles', 10), note: '' },
        { id: id(), label: 'נועם שבת', day: 'fri', kind: 'other', season: 'summer', time: R('candles', -60), note: '' },
        { id: id(), label: 'שולחן הטהור', day: 'fri', kind: 'other', season: 'all', time: null, note: '' },
        { id: id(), label: 'נועם שבת', day: 'sat', kind: 'other', season: 'winter', time: F('08:00'), note: '' },
        { id: id(), label: 'שחרית', day: 'sat', kind: 'tefila', season: 'all', time: F('09:00'), note: '' },
        { id: id(), label: 'פרקי אבות', day: 'sat', kind: 'other', season: 'avos', time: R('candles', -60), note: '' },
        { id: id(), label: 'מנחה ושלש סעודות', day: 'sat', kind: 'tefila', season: 'all', time: R('candles', 0), note: '' },
        { id: id(), label: 'מעריב מוצאי שבת', day: 'sat', kind: 'tefila', season: 'all', time: R('rt', 0), note: '' },
        { id: id(), label: 'מלוה מלכה', day: 'sat', kind: 'other', season: 'all', time: null, note: '' },
      ],
    },
    minor: { blocks: MINOR_BLOCKS() },
    yt: { blocks: YT_BLOCKS() },
    tishrei: { blocks: TISHREI_BLOCKS() },
    shiurim: { rows: SHIURIM_DEF() },
  };
}
// שיעורים: type 'daf' (ווערט געוויזן אונטער דף יומי) אדער 'other' (מיט א נאמען)
const SH = (type, title, who, room, t, days, note = '') => ({ id: id(), type, title, who, room, time: F(t), days, note, season: 'all', screen: true });
const ALL6 = [0, 1, 2, 3, 4, 5]; const ALL7 = [0, 1, 2, 3, 4, 5, 6];
function SHIURIM_DEF() {
  return [
    SH('daf', '', 'הרב שלום אליעזר טווערסקי שליט"א', "חדר ב'", '04:30', ALL6),
    SH('daf', '', 'הרב יעקב חיים אפטער שליט"א', 'ביהמ"ד הגדול', '07:00', [1, 2, 3, 4, 5]),
    SH('daf', '', 'הרב יעקב חיים אפטער שליט"א', 'ביהמ"ד הגדול', '07:30', [0]),
    SH('daf', '', 'הרב יעקב חיים אפטער שליט"א', 'ביהמ"ד הגדול', '08:00', [6]),
    SH('daf', '', 'הרב ישעי\' שטערן שליט"א', "חדר ב'", '20:30', [0, 1, 2, 3, 4], 'מוצ"ש כפי שמודיעים בשיעור'),
    SH('other', 'שיעור בהלכה ואגדה', 'כ"ק מרן אדמו"ר שליט"א', '', '13:00', [3]),
    SH('other', 'שיעור חומש רש"י', 'כ"ק מרן אדמו"ר שליט"א', '', '', [4], 'בין מנחה למעריב'),
    SH('other', 'עמוד יומי', 'הרב ישעי\' שטערן שליט"א', "חדר א'", '07:00', ALL6),
    SH('other', 'שיעור בסדר כהלכתו', 'הרב יחיאל קליין שליט"א', "חדר א'", '21:45', [0, 1, 2, 3, 4]),
  ];
}
/** חלק היום: לפנות בוקר / בבוקר / בצהריים / בערב / בלילה */
const partOfDay = (m) => (m < 360 ? 'לפנות בוקר' : m < 720 ? 'בבוקר' : m < 1020 ? 'בצהריים' : m < 1260 ? 'בערב' : 'בלילה');
/** די שיעורים פון טאג n: [{ type, title, who, room, note, min }] לויט דער שעה */
function computeShiurim(data, n, loc) {
  const iso = isoOf(n); const zd = dayZ(iso, loc); const dw = dowOf(n);
  return (data.shiurim?.rows || []).filter((r) => r.screen !== false && (r.days || []).includes(dw) && inSeason(r.season, iso, r))
    .map((r) => ({ type: r.type, title: r.title, who: r.who, room: r.room, note: r.note, min: timeOf(r.time, zd) }))
    .sort((a, b) => (a.min ?? 9999) - (b.min ?? 9999));
}
const row = (label, times, o = {}) => ({ id: id(), label, note: '', kind: /שחרית|מנחה|מעריב|נדרי|סליחות/.test(label) ? 'tefila' : 'other', on: 'all', times: times.map((t) => (typeof t === 'string' ? F(t) : t)), ...o });
const block = (title, when, rows) => ({ id: id(), title, when, rows, like: { minchaEve: true, maarivEve: true, shacharis: true, mincha: true, maarivMid: true, maariv: true }, own: { minchaEve: [], maarivEve: [], shacharis: [], mincha: [], maarivMid: [], maariv: [] }, fri: { mode: 'regular', time: null } });
function TISHREI_BLOCKS() {
  return [
    block('סליחות - יום א\'', 'selichos1', [row('סליחות', ['05:00'])]),
    block('סליחות - שאר הימים', 'selichos', [row('מניני סליחות', ['05:10', '05:35', '06:40', '07:00', '07:35', '08:00', '08:30', '09:00', '09:30'])]),
    block('ערב ראש השנה - יומא דהילולא', 'erevRH', [row('סעודת הילולא', ['20:30'], { on: -1, note: 'ליל ערב ר"ה' }), row('סליחות זכור ברית', ['05:00']), row('מנחה', ['19:20'], { note: 'ומעריב של ר"ה' })]),
    block('ראש השנה', 'rh', [row('שחרית', ['07:45']), row('תקיעת שופר', ['12:30'], { note: 'יום ב\' דר"ה: בערך', on: 1 }), row('מנחה', ['19:20'])]),
    block('צום גדליה', 'gedalia', []),
    block('עשרת ימי תשובה', 'aseres', [row('מניני סליחות', ['05:00', '05:25', '06:30', '06:55', '07:25', '07:55', '08:25', '08:55', '09:25']), row('מנחה', ['19:20'], { note: 'מנין כ"ק אדמו"ר שליט"א' })]),
    block('י"ג מדות', 'yud3', [row('תהלים בציבור', ['11:00']), row('תשליך', ['13:00'], { note: 'יוצאים מביהמ"ד' })]),
    block('שבת תשובה', 'shuva', [row('מנחה וקבלת שבת', ['18:50'], { on: -1 }), row('שולחן הטהור', ['22:30'], { on: -1 }), row('שחרית', ['09:00']), row('דרשת שבת תשובה', ['17:15']), row('מנחה ושלש סעודות', ['18:30'])]),
    block('ערב יום הכיפורים', 'erevYK', [row('מנחה', ['14:00'], { note: 'מנין כ"ק אדמו"ר שליט"א' }), row('שאר מניני מנחה', ['14:30', '15:00', '15:30'], { note: 'ואילך' })]),
    block('יום הכיפורים', 'yk', [row('כל נדרי', ['19:15'], { on: -1 }), row('שחרית', ['07:45']), row('מוצאי יום הכיפורים', ['20:07'])]),
    block('חג הסוכות', 'sukkos', [row('מנחה ערב סוכות', ['19:10'], { on: -1 }), row('שחרית', ['09:15'], { note: 'ב\' ימים' }), row('מנחה', ['19:05'], { note: 'ב\' ימים' }), row('שמחת בית השואבה', ['22:30'], { note: 'ליל ב\' דיו"ט', on: 0 })]),
    block('חול המועד סוכות', 'cholSukkos', [row('שחרית', ['08:30'], { note: 'מנין כ"ק אדמו"ר שליט"א' }), row('שאר מניני שחרית', ['06:00', '07:00', '07:30', '08:00', '09:00', '09:30', '10:00'], { note: 'ואילך' }), row('מנחה', ['19:05'], { note: 'מנין כ"ק אדמו"ר שליט"א' }), row('שמחת בית השואבה', ['21:00'], { note: 'ליל ד\' דחוה"מ (מיטוואך נאכט)', kind: 'other', on: 'wed' })]),
    block('הושענא רבה', 'hoshana', [row('משנה תורה', ['21:30'], { on: -1, note: 'ומנין תהלים' }), row('שחרית', ['08:30'], { note: 'מנין כ"ק אדמו"ר שליט"א' }), row('שאר מניני שחרית', ['06:15', '07:00'])]),
    block('שמיני עצרת ושמחת תורה', 'shmini', [row('מנחה ערב שמע"צ', ['18:45'], { on: -1, note: 'מעריב והקפות' }), row('שחרית שמע"צ', ['09:15'], { on: 0 }), row('פרידה מהסוכה', ['18:00'], { on: 0, kind: 'other' }), row('מנחה שמע"צ', ['18:45'], { on: 0, note: 'מעריב והקפות' }), row('שחרית שמח"ת', ['08:45'], { on: 1 }), row('מנחה שמח"ת', ['18:10'], { on: 1, note: 'ונעילת החג - עפל טיש' })]),
    block('שבת בראשית', 'bereishis', [row('מנחה וקבלת שבת', ['18:25'], { on: -1 }), row('שולחן הטהור', ['22:00'], { on: -1 }), row('שחרית', ['09:00']), row('מנחה ושלש סעודות', ['18:15'])]),
  ];
}
const empty = (labels) => labels.map((l) => row(l, []));
function MINOR_BLOCKS() {
  return [['חנוכה', 'chanuka'], ['עשרה בטבת', 'asaraTeves'], ['תענית אסתר', 'taanisEsther'], ['פורים', 'purim'], ['ל"ג בעומר', 'lagBaomer'], ['י"ז בתמוז', 'tamuz17'], ['תשעה באב', 'tishaBav']]
    .map(([t, w]) => block(t, w, []));
}
// א חג: מנחה ומעריב (ערב) · שחרית · מנחה ומעריב — פאר יעדן טאג פון חג
function chagRows() {
  // ערב (מנחה ומעריב) · שחרית · מנחה ומעריב — "כל ימי הבלוק"; ווען א טאג איז אנדערש, מען צעטיילט
  const rows = [{ ...row('מנחה ומעריב', []), on: -1 }, { ...row('שחרית', []), on: 'all' }, { ...row('מנחה ומעריב', []), on: 'all' }];
  return rows.map((r) => ({ ...r, screen: true, fri: { on: false, times: [] }, disp: { place: 'shab', from: { mode: 'dayStart', days: 1 }, to: { mode: 'pass', min: 0 } } }));
}
function YT_BLOCKS() {
  // type: 'erev' = ערב חג (ווי א וואכנטאג, מיט די V פון ימי דפגרא) · 'chag' = חג (ווי שבת)
  const E = (t, w) => ({ ...block(t, w, []), type: 'erev' });
  const C = (t, w) => ({ ...block(t, w, chagRows(w)), type: 'chag' });
  return [
    E('ערב פסח', 'erevPesach'),
    { ...block('ערב פסח שחל בשבת', 'erevPesachShabbos', [
      ['שחרית', 0], ['מנחה וקבלת שבת', 0], ['שחרית', 1], ['סוף זמן אכילת חמץ', 1, 'other'], ['מנחה', 1],
    ].map(([l, on, kind]) => ({ ...row(l, []), on, ...(kind ? { kind } : {}), screen: true, fri: { on: false, times: [] }, disp: { place: 'shab', from: { mode: 'dayStart', days: 1 }, to: { mode: 'pass', min: 0 } } }))), type: 'chag' },
    C('פסח', 'pesach'),
    { ...E('חול המועד פסח', 'cholPesach'), type: 'chm' }, C('שבת חול המועד פסח', 'shabbosChmPesach'), E('ערב שביעי של פסח', 'erevShvii'), C('שביעי ואחרון של פסח', 'shviiPesach'),
    E('ערב שבועות', 'erevShavuos'), C('שבועות', 'shavuos'),
  ];
}

// ---------- וואנען איז יעדער בלאק (פון א אידיש יאר) ----------
const WHEN = {
  tishrei: [['selichos1', 'סליחות - יום א\''], ['selichos', 'סליחות - שאר הימים'], ['erevRH', 'ערב ראש השנה'], ['rh', 'ראש השנה'], ['gedalia', 'צום גדליה'], ['aseres', 'עשרת ימי תשובה'],
    ['yud3', 'י"ג מדות'], ['shuva', 'שבת תשובה'], ['erevYK', 'ערב יום הכיפורים'], ['yk', 'יום הכיפורים'], ['sukkos', 'חג הסוכות'], ['cholSukkos', 'חול המועד סוכות'],
    ['hoshana', 'הושענא רבה'], ['shmini', 'שמיני עצרת ושמחת תורה'], ['bereishis', 'שבת בראשית']],
  minor: [['chanuka', 'חנוכה'], ['asaraTeves', 'עשרה בטבת'], ['taanisEsther', 'תענית אסתר'], ['purim', 'פורים'], ['lagBaomer', 'ל"ג בעומר'],
    ['tamuz17', 'י"ז בתמוז'], ['tishaBav', 'תשעה באב']],
  yt: [['erevPesach', 'ערב פסח'], ['erevPesachShabbos', 'ערב פסח שחל בשבת (ו\' + ש\')'], ['pesach', 'פסח (ב\' ימים)'], ['cholPesach', 'חול המועד פסח'], ['shabbosChmPesach', 'שבת חול המועד פסח'], ['erevShvii', 'ערב שביעי של פסח'], ['shviiPesach', 'שביעי ואחרון של פסח'], ['erevShavuos', 'ערב שבועות'], ['shavuos', 'שבועות']],
};
const yc = new Map();
const yearDays = (Y) => { if (!yc.has(Y)) yc.set(Y, buildYear(Y, {}, {})); return yc.get(Y).days; };
const findHol = (Y, re) => yearDays(Y).filter((d) => d.items.some((i) => i.kind === 'hol' && re.test(i.text))).map((d) => d.n);
/** די טעג (n) פון א בלאק אין יאר Y. פאר תשרי: Y = דאס יאר וואס הייבט זיך אן מיט דעם תשרי (סליחות זענען אין אלול פון Y-1) */
function daysOf(when, Y) {
  const days = yearDays(Y);
  const at = (m, d) => days.find((x) => x.hm === m && x.hd === d)?.n;
  const T = (d) => at('Tishri', d);
  const range = (a, b) => (a == null || b == null ? [] : Array.from({ length: b - a + 1 }, (_, i) => a + i));
  switch (when) {
    case 'selichos1': case 'selichos': {
      const rh = T(1); let sat = rh - 1; while (dowOf(sat) !== 6) sat -= 1;
      if (rh - sat < 4) sat -= 7; // אמווייניגסטנס 4 טעג סליחות
      const all = range(sat + 1, rh - 2).filter((n) => dowOf(n) !== 6);
      return when === 'selichos1' ? all.slice(0, 1) : all.slice(1);
    }
    case 'erevRH': return [T(1) - 1];
    case 'rh': return [T(1), T(2)];
    case 'gedalia': return findHol(Y, /צום גדליה/);
    case 'aseres': return range(T(3), T(8)).filter((n) => dowOf(n) !== 6);
    case 'yud3': return findHol(Y, /^י"ג מדות/).filter((n) => n < T(10));
    case 'shuva': return range(T(3), T(9)).filter((n) => dowOf(n) === 6);
    case 'erevYK': return [T(9)];
    case 'yk': return [T(10)];
    case 'sukkos': return [T(15), T(16)];
    case 'cholSukkos': return range(T(17), T(20)).filter((n) => dowOf(n) !== 6);
    case 'hoshana': return [T(21)];
    case 'shmini': return [T(22), T(23)];
    case 'bereishis': { let n = T(24); while (dowOf(n) !== 6) n += 1; return [n]; }
    case 'chanuka': return findHol(Y, /חנוכה/);
    case 'asaraTeves': return findHol(Y, /עשרה בטבת/);
    case 'taanisEsther': return findHol(Y, /תענית אסתר/);
    case 'purim': return findHol(Y, /^פורים$|^פורים \(/);
    case 'erevPesach': { const e = at('Nisan', 14); return e != null && dowOf(e) !== 6 ? [e] : []; }
    case 'erevPesachShabbos': { const e = at('Nisan', 14); return e != null && dowOf(e) === 6 ? [e - 1, e] : []; }
    case 'pesach': { const p = at('Nisan', 15); return [p, p + 1]; }
    case 'cholPesach': return range(at('Nisan', 17), at('Nisan', 19)).filter((n) => dowOf(n) !== 6);
    case 'shabbosChmPesach': return range(at('Nisan', 17), at('Nisan', 20)).filter((n) => dowOf(n) === 6);
    case 'erevShvii': return [at('Nisan', 20)];
    case 'shviiPesach': return [at('Nisan', 21), at('Nisan', 22)];
    case 'lagBaomer': return [at('Iyar', 18)];
    case 'erevShavuos': return [at('Sivan', 5)];
    case 'shavuos': return [at('Sivan', 6), at('Sivan', 7)];
    case 'tamuz17': return findHol(Y, /י"ז בתמוז/);
    case 'tishaBav': return findHol(Y, /תשעה באב/);
    default: return [];
  }
}

// ---------- חשבון ----------
/** ימות החול פאר טאג n: { shacharis:[..], mincha:[..], maariv:[..], last } — יעדער: { min, room, note, kahal } */
/** זמני ימות החול זענען פאר דער גאנצער וואך: מען רעכנט לויט איין טאג (weekday.refDay) */
const REF_DAYS = [['0', 'יום א\''], ['1', 'יום ב\''], ['2', 'יום ג\''], ['3', 'יום ד\''], ['4', 'יום ה\''], ['5', 'יום ו\''], ['early', 'השקיעה המוקדמת בשבוע'], ['late', 'השקיעה המאוחרת בשבוע'], ['avg', 'השקיעה הממוצעת בשבוע'], ['daily', 'כל יום לפי עצמו']];
function weekRefDay(data, n, loc) {
  const ref = data.weekday?.refDay ?? '0';
  if (ref === 'daily') return n;
  const sun = n - dowOf(n === undefined ? 0 : n) + (dowOf(n) === 6 ? 7 : 0); // שבת → די קומענדיגע וואך
  if (ref === 'avg') return sun; // ווערט אויסגערעכנט אין weekZ
  if (ref === 'early' || ref === 'late') {
    const days = [0, 1, 2, 3, 4, 5].map((i) => sun + i);
    const sk = days.map((k) => dayZ(isoOf(k), loc).shkia);
    const v = ref === 'early' ? Math.min(...sk) : Math.max(...sk);
    return days[sk.indexOf(v)];
  }
  return sun + Number(ref);
}
/** די זמנים פאר דער וואך (לויט refDay; 'avg' = דורכשניט פון זונטאג–פרייטאג) */
function weekZ(data, n, loc) {
  if ((data.weekday?.refDay ?? '0') !== 'avg') return dayZ(isoOf(weekRefDay(data, n, loc)), loc);
  const sun = weekRefDay(data, n, loc);
  const zs = [0, 1, 2, 3, 4, 5].map((i) => dayZ(isoOf(sun + i), loc));
  const out = { ...zs[0] };
  for (const k of Object.keys(out)) if (typeof out[k] === 'number') out[k] = zs.reduce((a, z) => a + z[k], 0) / zs.length;
  return out;
}
/** א שעה וואס רוקט זיך (לויט שקיעה א.א.וו.) — דער כלל; א פעסטע שעה — '' */
const specOf = (T) => (T && (T.b === 'max' || T.b === 'min') ? `${T.b}(${specOf(T.x) || T.x?.t},${specOf(T.y) || T.y?.t})` : T && T.b && T.b !== 'fixed' && !T.t ? `${T.b}${Number(T.a) || 0}/${T.r || 1}${T.m || ''}` : '');
function computeWeekday(data, n, loc) {
  const w = data.weekday; const iso = isoOf(n); const zd = weekZ(data, n, loc); const fri = dowOf(n) === 5;
  const ok = (r) => inSeason(r.season, iso, r) && (!fri || r.fri) && campEffect(r, iso, w.camp) !== 'drop';
  const mk = (r) => ({ min: timeOf(r.time, zd), room: r.room || w.defaultRoom || '', note: r.note || '', kahal: !!r.kahal, last: !!r.last, spec: specOf(r.time), xn: campEffect(r, iso, w.camp) || '' });
  const valid = (x) => {
    if (x.min == null) return false;
    return (x.cond || []).every((c) => { // אלע תנאים מוזן זיין
      const base = zd[c.base]; if (!Number.isFinite(base)) return true;
      return c.dir === 'before' ? x.min <= base - (Number(c.min) || 0) : x.min >= base + (Number(c.min) || 0);
    });
  };
  const out = {};
  for (const g of ['shacharis', 'mincha', 'maariv']) {
    out[g] = (w[g] || []).filter(ok).map((r) => ({ ...mk(r), cond: condOf(r, g) })).filter(valid).sort((a, b) => a.min - b.min);
  }
  out.last = null; // מנחה מנין אחרון = מנין כ"ק
  // מנין כ"ק: צולייגן, און אראפנעמען אנדערע מניינים אין דער "שטילער צייט" פאר/נאך אים
  const rb = w.rebbe || defaults().weekday.rebbe;
  for (const g of ['shacharis', 'mincha', 'maariv']) {
    const r = rb[g]; if (!r || !r.on) continue;
    if (g === 'shacharis' && fri && r.fri === false) continue;
    const m = timeOf(r.time, zd); if (m == null) continue;
    const b = Number(r.before) || 0; const a = Number(r.after) || 0;
    out[g] = out[g].filter((x) => !(x.min >= m - b && x.min <= m + a));
    out[g].push({ min: m, room: r.room || w.defaultRoom || '', note: r.note || '', kahal: true, rebbe: true, spec: specOf(r.time) });
    out[g].sort((x, y) => x.min - y.min);
    if (g === 'mincha') out.last = m;
  }
  if (out.last != null) out.mincha = out.mincha.filter((x) => x.min <= out.last);
  // ימי דפגרא ותעניות: א תפילה וואס איז נישט "כמו ימות החול" — אירע אייגענע שעות
  const own = (blk, g) => (blk.own?.[g] || []).map((T) => ({ min: timeOf(T, zd), room: '', note: '' })).filter((x) => x.min != null).sort((a, b) => a.min - b.min);
  const mb = minorBlockOn(data, n); const nb = minorBlockOn(data, n + 1);
  if (mb) {
    out.minor = mb.title;
    const like = mb.like || {};
    for (const g of ['shacharis', 'mincha']) {
      if (like[g] !== false) continue;
      out[g] = own(mb, g);
      if (g === 'mincha') out.last = null;
    }
    if (fri && mb.fri?.mode === 'custom') out.friMincha = timeOf(mb.fri.time, zd);
  }
  // "מנחה ערב": די מנחה פונעם טאג פאר א יום דפגרא/תענית
  if (!mb && nb && (nb.like || {}).minchaEve === false) { out.mincha = own(nb, 'minchaEve'); out.last = null; }
  // מעריב פון היינט ביינאכט: ערב (פאר'ן ערשטן טאג) · אמצע (צווישן טעג פון א לענגערן בלאק) · מוצאי (נאכן לעצטן טאג)
  const eveG = !mb && nb ? 'maarivEve' : mb && nb === mb ? 'maarivMid' : mb ? 'maariv' : null;
  const eb = eveG === 'maarivEve' ? nb : mb;
  if (eveG && (eb.like || {})[eveG] === false) out.maariv = own(eb, eveG);
  out.shacharisNote = w.shacharisNote || ''; out.minchaNote = w.minchaNote || ''; out.maarivNote = w.maarivNote || '';
  return out;
}
/** דער בלאק פון ימי דפגרא ותעניות וואס איז אויף טאג n */
function minorBlockOn(data, n) {
  const x = hdOf(n);
  for (const b of [...(data.minor?.blocks || []), ...(data.yt?.blocks || []).filter((x) => x.type === 'erev')]) {
    for (const Y of [x.y, x.y + 1, x.y - 1]) if (daysOf(b.when, Y).includes(n)) return b;
  }
  return null;
}
const avosSeason = (n) => { const x = hdOf(n); return ['Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'].includes(x.m) || (x.m === 'Nisan' && x.d > 22); };
/** שבת: fri = n פון ערב שבת. גיט [{ label, min, kind, note, day }] אין סדר, מיט הדלקת נרות פאראויס */
function computeShabbos(data, fri, loc) {
  const zf = dayZ(isoOf(fri), loc); const zs = dayZ(isoOf(fri + 1), loc); const iso = isoOf(fri);
  const rows = [{ label: 'הדלקת נרות', min: zf.candles, kind: 'zman', note: '', day: 'fri' }];
  for (const r of data.shabbos.rows || []) {
    if (r.season === 'avos' ? !avosSeason(fri + 1) : !inSeason(r.season, isoOf(r.day === 'sat' ? fri + 1 : fri), r)) continue;
    let min = timeOf(r.time, r.day === 'sat' ? zs : zf);
    // ער"ש וואס איז א יום דפגרא/תענית מיט אן אייגענער מנחה וקבלת שבת
    if (r.day === 'fri' && r.kind === 'tefila' && /מנחה/.test(r.label)) {
      const mb = minorBlockOn(data, fri);
      if (mb?.fri?.mode === 'custom') min = timeOf(mb.fri.time, zf);
      else if (mb?.fri && min != null) min += (mb.fri.sign === '-' ? -1 : 1) * (Number(mb.fri.shift) || 0);
    }
    rows.push({ label: r.label, min, kind: r.kind, note: r.note || '', day: r.day, screen: r.screen !== false });
  }
  return rows; // אין דעם סדר וואס מ'האט באשטימט
}
/** בלאקן (תשרי + יו"ט) וואס האבן עפעס אויף טאג n (אויך ערב: on = -1). גיט [{ title, rows:[{label,note,kind,mins:[..]}] }] */
function computeSpecial(data, n, loc) {
  const zd = dayZ(isoOf(n), loc); const out = [];
  const x = hdOf(n);
  for (const part of ['tishrei', 'yt', 'minor']) {
    for (const b of data[part]?.blocks || []) {
      for (const Y of [x.y, x.y + 1, x.y - 1]) {
        const ds = daysOf(b.when, Y);
        if (!ds.length) continue;
        const rows = (b.rows || []).filter((r) => {
          if (r.on === 'all' || r.on == null) return ds.includes(n);
          if (r.on === 'wed') return ds.includes(n) && dowOf(n) === 3;
          if (r.on === 'fri') return ds.includes(n) && dowOf(n) === 5;
          if (r.on === 'last') return ds[ds.length - 1] === n;
          const i = Number(r.on);
          return i < 0 ? ds[0] + i === n : ds[i] === n;
        }).map((r) => ({ label: r.label, note: r.note, kind: r.kind, screen: r.screen !== false, disp: r.disp || null,
          place: r.disp?.place || (isChag(part, b) ? 'shab' : 'weekday'),
          mins: ((r.sat?.on && dowOf(n) === 6 ? r.sat.times : r.fri?.on && dowOf(n) === 5 ? r.fri.times : r.times) || []).map((t) => timeOf(t, zd)).filter((m) => m != null) }));
        if (rows.length) { out.push({ title: b.title, part, when: b.when, type: isChag(part, b) ? 'chag' : (b.type || ''), rows }); break; }
      }
    }
  }
  return out;
}
// ---------- שבת און יו"ט צוזאמען ----------
const TISHREI_CHAG = new Set(['rh', 'yk', 'sukkos', 'shmini']);
const isChag = (part, b) => (part === 'yt' && b.type === 'chag') || (part === 'tishrei' && TISHREI_CHAG.has(b.when));
/** איז טאג n א יו"ט (לויטן לוח, אדער א בלאק פון א חג) */
function chagOn(data, n) {
  const x = hdOf(n);
  for (const y of [x.y, x.y + 1]) { const d = yearDays(y).find((q) => q.n === n); if (d) { if (d.items.some((i) => i.yt)) return true; break; } }
  for (const [part, list] of [['yt', data.yt?.blocks || []], ['tishrei', data.tishrei?.blocks || []]]) {
    for (const b of list) { if (!isChag(part, b)) continue; for (const Y of [x.y, x.y + 1, x.y - 1]) if (daysOf(b.when, Y).includes(n)) return true; }
  }
  return false;
}
/** שבת/יו"ט: די שורות פאר "ערב" eve און דעם טאג eve+1. יעדע שורה: { label, kind, note, min, more, day (0 = ערב, 1 = דער טאג), screen, place }
 *  כללים: שבת שחלה בערב יו"ט — שבת ביז נאך שחרית, דערנאך דער חג (מנחה ומעריב פון ערב החג) + "לא לפני" ר"ת;
 *  יו"ט שחל בערב שבת — ער"ש לויט "כשחל בערב שבת", הדלקת נרות, שבת פון נאך מעריב; יו"ט שחל בשבת — נאר דער חג. */
function computeHoly(data, eve, loc) {
  const d = eve + 1; const zE = dayZ(isoOf(eve), loc); const zD = dayZ(isoOf(d), loc);
  const cE = chagOn(data, eve); const cD = chagOn(data, d); const satD = dowOf(d) === 6;
  const shab = (rows) => rows.map((r) => ({ ...r, more: [], day: r.day === 'sat' ? 1 : 0, place: 'shab', screen: r.screen !== false, shab: true }));
  const spec = (k, day) => computeSpecial(data, k, loc).flatMap((bk) => bk.rows.map((r) => ({ label: r.label, kind: r.kind, note: r.note || '', min: r.mins[0] ?? null, more: r.mins.slice(1), day, screen: r.screen, place: r.place, chag: bk.type === 'chag' })));
  // א געווענליכע שבת
  if (satD && !cE && !cD && !chagOn(data, d + 1)) return shab(computeShabbos(data, eve, loc));
  // שבת שחלה בערב יו"ט
  if (satD && !cE && !cD) {
    const rows = shab(computeShabbos(data, eve, loc));
    const sh = rows.find((r) => r.day === 1 && /שחרית/.test(r.label));
    const keep = rows.filter((r) => r.day === 0 || (sh && r.min != null && r.min <= sh.min) || r === sh);
    const chagEve = spec(d, 1).filter((r) => r.chag);
    return [...keep, ...chagEve, { label: 'הדלקת נרות יו"ט — לא לפני', kind: 'zman', note: '', min: zD.rt, more: [], day: 1, screen: true, place: 'shab' }];
  }
  const out = [];
  // הדלקת נרות: ערב פון א וואכנטאג, אדער ערב שבת (אויך ווען ער"ש איז יו"ט — פון א נר הדולק)
  if (dowOf(eve) === 5) out.push({ label: 'הדלקת נרות', kind: 'zman', note: '', min: zE.candles, more: [], day: 0, screen: true, place: 'shab' });
  else if (dowOf(eve) === 6 && !cE && cD) out.push({ label: 'הדלקת נרות יו"ט — לא לפני', kind: 'zman', note: '', min: zE.rt, more: [], day: 0, screen: true, place: 'shab' });
  else if (!cE && cD) out.push({ label: 'הדלקת נרות', kind: 'zman', note: '', min: zE.candles, more: [], day: 0, screen: true, place: 'shab' });
  // פונעם ערב: אויב דער ערב איז אליין א יו"ט — נאר די אוונט-זאכן
  const eveCut = cE ? zE.shkia - 90 : -Infinity;
  out.push(...spec(eve, 0).filter((r) => (r.min ?? -Infinity) >= eveCut));
  if (satD && !cD) {
    // יו"ט שחל בערב שבת: שבת פון נאך מעריב (ער"ש: נאר וואס איז נאך קבלת שבת; שבת: אלעס)
    const rows = shab(computeShabbos(data, eve, loc));
    out.push(...rows.filter((r) => r.day === 1 || (r.kind !== 'tefila' && r.kind !== 'zman' && (r.min == null || r.min > zE.candles + 30))));
  }
  out.push(...spec(d, 1));
  return out;
}


return { dayZ, timeOf, describe, isSummer, condOf, inCamp, campEffect, defaults, computeShiurim, chagRows, daysOf, weekRefDay, weekZ, computeWeekday, minorBlockOn, computeShabbos, computeSpecial, chagOn, computeHoly, BASES, COMBOS, ROUNDS, SEASONS, ANCHORS, F, R, HDOW, partOfDay, WHEN, REF_DAYS, TISHREI_CHAG, nOf, isoOf };
  })();
  __m["js/luach/autovars.js"] = (function () {
// "הודעות אוטומטיות": די ערטער וואס פילן זיך אליין אויס ({הדלקת נרות}, {שחרית}, {מצוה יומית} ...)
// א ריינער מאדול (אן DOM) — דער אתר ניצט אים פאר דער תצוגה מקדימה, און דער Apps Script (א "bundle") ביים שיקן.
// די זמנים ווערן גערעכנט פונקט ווי אויף דער תצוגה אין בית הכנסת (luach/minyanim.js).
const { buildYear, isoOf, nOf, dowOf, hdOf, mitzvaYomis } = __m["js/luach/engine.js"];
const { zmanim, hhmm, LOCATIONS } = __m["js/luach/zmanim.js"];
const { defaults, computeWeekday, computeHoly, chagOn, computeSpecial, daysOf } = __m["js/luach/minyanim.js"];
const { hebrewNumber, monthHe } = __m["js/hebdate.js"];

const LOC = LOCATIONS.bp;
const yc = new Map();
function dayOf(n) {
  const Y = hdOf(n).y;
  for (const y of [Y, Y + 1]) {
    if (!yc.has(y)) yc.set(y, buildYear(y, {}, { loc: LOC }));
    const d = yc.get(y).days.find((x) => x.n === n);
    if (d) return d;
  }
  return null;
}
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const fmt = (m) => (m == null || !Number.isFinite(m) ? '' : hhmm(((m % 1440) + 1440) % 1440));
const list = (arr) => arr.map((x) => (fmt(x.min) ? `${fmt(x.min)}${x.xn ? ` (${x.xn})` : ''}` : '')).filter(Boolean).join(' · ');

/** שבת אדער יו"ט */
const holyOn = (data, n) => dowOf(n) === 6 || chagOn(data, n);
/** דער ערב פון דער קומענדיגער שבת/יו"ט (דער טאג פאר'ן ערשטן הייליגן טאג), פון טאג n און ווייטער */
function nextEve(data, n) {
  let k = n; while (holyOn(data, k)) k += 1; // אינמיטן שבת/יו"ט → דער קומענדיגער
  while (!holyOn(data, k + 1)) k += 1;
  return k;
}

/** די ערטער (שם → טעקסט) פאר א טאג (iso). data = די "זמני תפילות" (Minyanim) */
function autoVars(rawData, iso) {
  const data = { ...defaults(), ...(rawData || {}) };
  const n = nOf(iso);
  const out = {};
  // ---- שבת / יו"ט (די קומענדיגע — פון דעם טאג) ----
  const eve = nextEve(data, n);
  const first = eve + 1;
  const d1 = dayOf(first);
  const yt = (d1?.items || []).find((i) => i.kind === 'hol' && i.yt)?.text || '';
  out['פרשה'] = d1?.parsha || '';
  // די פרשה פון דער שבת נאך דער קומענדיגער שבת (למשל יעצט וירא → חיי שרה)
  let s1 = eve + 1; while (dowOf(s1) !== 6) s1 += 1;
  out['פרשה הבאה'] = dayOf(s1 + 7)?.parsha || '';
  out['שבת / יום טוב'] = dowOf(first) === 6 && !yt ? `שבת${d1?.parsha ? ` פרשת ${d1.parsha}` : ''}` : (yt || 'שבת');
  for (const r of computeHoly(data, eve, LOC)) {
    if (!r.label) continue;
    if (r.min == null) { if (out[r.label] === undefined) out[r.label] = r.note || ''; continue; } // בלי שעה (למשל שולחן הטהור) — ריק
    let k = r.label; let i = 2;
    while (out[k] !== undefined && out[k] !== '') { k = `${r.label} ${i}`; i += 1; }
    out[k] = [r.min, ...(r.more || [])].map(fmt).filter(Boolean).join(' · ');
  }
  // יעדע שורה אין די שבת־הגדרות באקומט א שדה, אויך ווען זי איז נישט די וואך (סעזאן) — דאן ריק
  for (const r of (data.shabbos?.rows || [])) if (r.label && out[r.label] === undefined) out[r.label] = '';
  // ---- וואכנטאג: די מניינים פון דעם טאג (אויב שבת/יו"ט — פונעם קומענדיגן וואכנטאג) ----
  let w = n; while (holyOn(data, w)) w += 1;
  const wd = computeWeekday(data, w, LOC);
  // "בחול" — אז עס זאל זיך נישט מישן מיט "מנחה" / "שחרית" פון שבת/יו"ט
  out['שחרית בחול'] = list(wd.shacharis || []);
  out['מנחה בחול'] = list((wd.mincha || []).filter((x) => !x.rebbe));
  out['מעריב בחול'] = list((wd.maariv || []).filter((x) => !x.rebbe));
  const rb = (g) => fmt((wd[g] || []).find((x) => x.rebbe)?.min);
  out['מנחה כ"ק אדמו"ר'] = rb('mincha');
  out['מעריב כ"ק אדמו"ר'] = rb('maariv');
  // דער קומענדיגער וואך: דער ערשטער וואכנטאג נאך דער קומענדיגער שבת
  let s2 = eve + 1; while (dowOf(s2) !== 6) s2 += 1;
  let nw = s2 + 1; while (holyOn(data, nw)) nw += 1;
  const wd2 = computeWeekday(data, nw, LOC);
  out['מנחה כ"ק אדמו"ר שבוע הבא'] = fmt((wd2.mincha || []).find((x) => x.rebbe)?.min);
  // ---- סליחות: דער ערשטער טאג פון היינט ביז א וואך מיט סליחות; אנדערש ריק (און די שורה פאלט אוועק) ----
  out['סליחות'] = '';
  for (let k = n; k < n + 8; k += 1) {
    const mins = computeSpecial(data, k, LOC).flatMap((b) => b.rows).filter((r) => /סליחות/.test(r.label || '')).flatMap((r) => r.mins);
    if (mins.length) { out['סליחות'] = [...new Set(mins)].sort((a, b) => a - b).map(fmt).filter(Boolean).join(' · '); break; }
  }
  // ---- זמני היום ----
  const z = zmanim(iso, LOC);
  Object.assign(out, {
    'עלות השחר': fmt(z.alos), 'נץ החמה': fmt(z.neitz), 'סוף זמן ק"ש מג"א': fmt(z.maKS), 'סוף זמן ק"ש גר"א': fmt(z.graKS),
    'חצות': fmt(z.chatzos), 'שקיעה': fmt(z.shkia), 'צאת הכוכבים': fmt(z.tzeis),
  });
  // ---- תאריך ----
  const h = hdOf(n);
  out['יום'] = DAYS[dowOf(n)];
  out['תאריך עברי'] = `${hebrewNumber(h.d)} ${monthHe ? monthHe(h.m, h.y) : ''} ${hebrewNumber(h.y % 1000)}`.replace(/\s+/g, ' ').trim();
  const [Y, M, D] = iso.split('-').map(Number);
  out['תאריך לועזי'] = `${M}/${D}/${Y}`;
  // ---- מצוה יומית ----
  const mz = mitzvaYomis(iso);
  out['מצוה יומית'] = mz ? `מצוה ${mz.num}: ${mz.text}` : '';
  // ---- משבצת שבת ויו"ט: פונקט ווי די הילצערנע משבצת אויף דער תצוגה ----
  out['משבצת שבת ויו"ט'] = holyBox(data, eve);
  // ---- משבצת יומא דפגרא: דער קומענדיגער טאג פון א "יומא דפגרא" (חנוכה, פורים, תעניות ...) ----
  out['משבצת יומא דפגרא'] = minorBox(data, n);
  return out;
}
const timesOf = (r) => [r.min, ...(r.more || [])].filter((m) => m != null).map(fmt).filter(Boolean).join(' · ');
/** די משבצת פון שבת/יו"ט ווי אויף דער תצוגה: א כותרת + "שם: שעה" פאר יעדע שורה (נאר מיט א שעה, לויט דער שעה) */
function holyBox(data, eve) {
  const d = eve + 1;
  const shab = dowOf(d) === 6;
  const ytName = (dayOf(d)?.items || []).find((i) => i.kind === 'hol' && i.yt)?.text || '';
  const ps = shab ? (dayOf(d)?.parsha || '') : '';
  const chagTitle = [d, eve].map((k) => computeSpecial(data, k, LOC)
    .find((bk) => bk.type === 'chag' && bk.rows.some((r) => r.screen && (r.disp?.place || 'shab') === 'shab'))?.title).find(Boolean) || '';
  const rows = computeHoly(data, eve, LOC).filter((r) => r.screen !== false && r.place === 'shab' && r.min != null)
    .map((r) => ({ ...r, abs: r.min + (r.day ? 1440 : 0) })).sort((a, b) => a.abs - b.abs);
  const title = chagTitle ? `ל${chagTitle}` : shab ? `לשבת קודש${ps ? ` פרשת ${ps}` : ''}` : `ל${ytName || 'יום טוב'}`;
  return [title, ...rows.map((r) => `${r.label}: ${timesOf(r)}`)].join('\n');
}
/** דער ערשטער טאג פון א בלאק פון "ימי דפגרא" (data.minor) פון k און ווייטער (ביז 8 טעג) → { n, block } אדער null */
function nextMinor(data, k, span = 8) {
  for (let n = k; n < k + span; n += 1) {
    const Y = hdOf(n).y;
    for (const b of data.minor?.blocks || []) {
      for (const y of [Y, Y + 1, Y - 1]) { const ds = daysOf(b.when, y); if (ds.length && ds[0] === n) return { n, block: b }; }
    }
  }
  return null;
}
function minorBox(data, k) {
  const m = nextMinor(data, k); if (!m) return '';
  const rows = computeSpecial(data, m.n, LOC).filter((bk) => bk.part === 'minor' || bk.title === m.block.title).flatMap((bk) => bk.rows)
    .filter((r) => r.screen && r.mins.length);
  return [m.block.title, ...rows.map((r) => `${r.label}${r.note ? ` (${r.note})` : ''}: ${r.mins.map(fmt).join(' · ')}`)].join('\n');
}

/** די נעמען פון די ערטער (פאר די קנעפלעך) — פון א טאג וואס האט אלעס */
function varNames(data, iso) { return Object.keys(autoVars(data, iso)); }

/** אויספילן א מוסטער: {שם} → ווערט; {הודעת הגבאי} → line. א נישט באקאנטער שם בלייבט ווי ער איז. */
/** שורת הגבאי: 'טעקסט' (= שורה 1) אדער JSON '["שורה 1","שורה 2"]' → [l1, l2] */
function lineParts(v) {
  if (Array.isArray(v)) return [String(v[0] || ''), String(v[1] || '')];
  const s = String(v || '');
  if (s.startsWith('[')) { try { const a = JSON.parse(s); if (Array.isArray(a)) return [String(a[0] || ''), String(a[1] || '')]; } catch { /* */ } }
  return [s, ''];
}
// א שורה וואו אלע ערטער זענען ריק (למשל {סליחות} רוב יאר, {פרקי אבות} ווינטער) — פאלט אוועק אינגאנצן
function fillTemplate(text, vars, line = '') {
  const L = lineParts(line);
  return String(text || '').split('\n').map((ln) => {
    let known = 0; let filled = 0;
    const out = ln.replace(/\{([^{}]+)\}/g, (all, k) => {
      const key = k.trim();
      const v = key === 'הודעת הגבאי' || key === 'הודעת הגבאי 1' ? L[0] : key === 'הודעת הגבאי 2' ? L[1] : vars[key];
      if (v === undefined) return all;
      known += 1; if (String(v).trim()) filled += 1;
      return v;
    });
    return known && !filled ? null : out;
  }).filter((ln) => ln !== null).join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** די קומענדיגע צייט (טעקסט 'yyyy-MM-dd HH:mm', ניו יארק) פון א "מתי" נאך now ('yyyy-MM-dd HH:mm'), אדער '' */
function nextOccurrence(sched, rawData, now) {
  const s = sched || {}; const data = { ...defaults(), ...(rawData || {}) };
  const time = /^\d{1,2}:\d{2}$/.test(s.time || '') ? s.time.padStart(5, '0') : '10:00';
  if (s.type === 'once') { const at = String(s.at || '').replace('T', ' ').slice(0, 16); return at > now ? at : ''; }
  const n0 = nOf(now.slice(0, 10));
  for (let n = n0; n < n0 + 400; n += 1) {
    let ok = false;
    if (s.type === 'weekly') ok = dowOf(n) === Number(s.dow);
    else if (s.type === 'monthly') ok = Number(isoOf(n).slice(8, 10)) === Number(s.day);
    else if (s.type === 'hmonthly') {
      // א טאג אין חודש עברי; ל' אין א חודש פון כ"ט טעג → כ"ט
      const h = hdOf(n); const want = Number(s.day) || 1;
      ok = h.d === want || (want === 30 && h.d === 29 && hdOf(n + 1).d === 1);
    } else if (s.type === 'erev') {
      const e = n + (Number(s.before) || 0); // דער ערב איז "before" טעג נאך דעם טאג פונעם שיקן
      if (!holyOn(data, e) && holyOn(data, e + 1)) {
        // די גאנצע קייט פון הייליגע טעג: שבת אן יו"ט → "ערב שבת"; מיט יו"ט → "ערב יום טוב" (די משבצת האט אלעס)
        let k = e + 1; let hasShab = false; let hasChag = false;
        while (holyOn(data, k)) { if (dowOf(k) === 6) hasShab = true; if (chagOn(data, k)) hasChag = true; k += 1; }
        ok = s.what === 'shabbos' ? hasShab && !hasChag : s.what === 'yt' ? hasChag : true;
      }
    } else if (s.type === 'erevMinor') {
      // דער לעצטער וואכנטאג פאר א טאג פון "ימי דפגרא"
      if (!holyOn(data, n)) { let k = n + 1; while (holyOn(data, k)) k += 1; ok = !!nextMinor(data, n + 1, k - n); } // דער טאג פון דפגרא קען זיין אויך אין שבת
    }
    if (!ok) continue;
    const at = `${isoOf(n)} ${time}`;
    if (at > now) return at;
  }
  return '';
}
/** א קורצע באשרייבונג פון "מתי" (לשון קודש) */
function schedText(sched) {
  const s = sched || {}; const tm = s.time || '';
  if (s.type === 'weekly') return `כל יום ${DAYS[Number(s.dow)] || ''} ב-${tm}`;
  if (s.type === 'monthly') return `כל חודש לועזי ב-${s.day} ב-${tm}`;
  if (s.type === 'hmonthly') return `כל חודש עברי ב-${hebrewNumber(Number(s.day) || 1)} ב-${tm}`;
  if (s.type === 'erevMinor') return `ערב יומא דפגרא ב-${tm}`;
  if (s.type === 'keyword') return `כשמישהו שולח: ${(s.words || []).join(', ')}`;
  if (s.type === 'erev') {
    const w = s.what === 'shabbos' ? 'שבת' : s.what === 'yt' ? 'יום טוב' : 'שבת ויום טוב';
    const b = Number(s.before) || 0;
    return `${b ? `${b === 1 ? 'יום' : `${b} ימים`} לפני ` : ''}ערב ${w} ב-${tm}`;
  }
  if (s.type === 'once') return `פעם אחת: ${String(s.at || '').replace('T', ' ')}`;
  return '';
}

/** שינוי חד־פעמי פאר דעם קומענדיגן מאל: { drop: [שורות], text: 'מוסטער אנשטאט', nobrand: bool } */
function modOf(v) {
  if (v && typeof v === 'object') return { drop: v.drop || [], text: v.text || '', nobrand: !!v.nobrand };
  try { const o = JSON.parse(String(v || '') || '{}'); return { drop: Array.isArray(o.drop) ? o.drop : [], text: String(o.text || ''), nobrand: !!o.nobrand }; } catch { return { drop: [], text: '', nobrand: false }; }
}
/** דער טעקסט וואס גייט ארויס (אן דעם נאמען): מוסטער (אדער דער טעקסט אנשטאט) + שורות הגבאי − די אראפגענומענע שורות */
function renderAuto(tpl, vars, line, mod) {
  const m = modOf(mod);
  let t = fillTemplate(m.text || tpl, vars, line);
  if (m.drop.length) t = t.split('\n').filter((l) => !m.drop.includes(l.trim())).join('\n');
  return t.trim();
}

return { nextEve, autoVars, holyBox, nextMinor, minorBox, varNames, lineParts, fillTemplate, nextOccurrence, schedText, modOf, renderAuto, holyOn, isoOf, nOf, dowOf };
  })();
  return __m["js/luach/autovars.js"];
})();
