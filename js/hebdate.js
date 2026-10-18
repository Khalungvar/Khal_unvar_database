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
export function toHebrew(date) {
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

export function isLeapYear(y) {
  return ((7 * y + 1) % 19) < 7;
}

/** רשימת החודשים בשנה עברית: [{ key, he }]. */
export function monthsOf(y) {
  return (isLeapYear(y) ? ORDER_LEAP : ORDER_REGULAR).map((key) => ({ key, he: MONTH_HE[key] }));
}

/** { d, m, y } → 'YYYY-MM-DD', או '' אם התאריך לא קיים (למשל ל' בחודש של 29 יום). */
export function fromHebrew(d, m, y) {
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
export function hebrewNumber(n) {
  let s = HUNDREDS[Math.floor(n / 100) % 10] + TENS[Math.floor(n / 10) % 10] + ONES[n % 10];
  s = s.replace('יה', 'טו').replace('יו', 'טז');
  return s.length > 1 ? `${s.slice(0, -1)}"${s.slice(-1)}` : `${s}'`;
}

/** שנה עברית כטקסט: 5787 → תשפ"ז */
export function yearLabel(y) {
  return hebrewNumber(y % 1000);
}

/** { d, m, y } → 'ז' חשון תשפ"ז' */
export function formatHebrew(h) {
  if (!h) return '';
  return `${hebrewNumber(h.d)} ${MONTH_HE[h.m] || h.m} ${yearLabel(h.y)}`;
}

/** תאריך לועזי → טקסט עברי. */
export function isoToHebrewText(iso) {
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
export function parseHebrewText(text) {
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
export function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
