// דער לוח: וואס איז יעדן טאג פון א יאר (חוץ לארץ, מנהג אונגוואר). קיין DOM — נאר רעכענען.
// { days: [...], pages: [...] } פאר א אידיש יאר. יעדער טאג: { iso, n, dow, hd, hm, he, items: [...], zm }.
import { isLeapYear, hebrewNumber, monthHe } from '../hebdate.js';
import { zmanim, hhmm, dstChange, LOCATIONS } from './zmanim.js';
import { MITZVOS, MITZVA_ANCHOR } from './mitzvos.js';

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
export { hdOf };
export function yearInfo(Y) {
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
export const PARSHIYOS = ['בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי',
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
export function sedra(Y, il = false) {
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
export function dafYomi(iso) {
  const len = DAF_LIST.length;
  const i = (((nOf(iso) - DAF_START) % len) + len) % len;
  const [name, p] = DAF_LIST[i];
  return { masechta: name, daf: hebrewNumber(p).replace(/["']/g, ''), text: `${name} ${hebrewNumber(p).replace(/["']/g, '')}` };
}

// ---------- מצוה יומית ----------
export function mitzvaYomis(iso) {
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
export function omerText(k) {
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
export const HILLULOS = [
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
export const FIXED_NOTES = [];

// ---------- וואס איז יעדן טאג ----------
const RC_NAME = (I, n) => {
  const h = hdOf(n);
  return h.d;
};
void RC_NAME;

/** items: { kind, text, label?, time?, icon? }
 *  kind: hol (נאמען פון יו"ט/טאג) · parsha · special (שבת שובה...) · note (קליין אונטן) · small (נוסח / יזכור...)
 *        hillula · omer · avos · time · eruv · rebbe */
export function buildYear(Y, extra = {}, opts = {}) {
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
  if (!(il ? [1, 2, 3, 4, 5] : [2, 3, 4, 5]).some((i) => dow(pesach + i) === 6)) add(il ? pesach : pesach + 6, 'small', 'שיר השירים');
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

export { isoOf, nOf, dowOf };
