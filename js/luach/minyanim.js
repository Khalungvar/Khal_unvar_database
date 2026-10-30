// זמני תפילות — דאטן + חשבון. געניצט סיי פון "זמני תפילות" אינעם אתר (ניהול) סיי פון דער תצוגה אין בית הכנסת.
// ארבע טיילן: ימות החול (שחרית/מנחה/מעריב), שבת, יום טוב (אלע חגים חוץ תשרי), תשרי (מיט סליחות).
// א זמן (T): { b: 'fixed', t: 'HH:MM' (24 שעה) }  אדער  { b: 'shkia'|'neitz'|'alos'|'chatzos'|'candles'|'rt', a: ±מינוט, r: עיגול, m: 'n'|'u'|'d' }
import { zmanim } from './zmanim.js';
import { fromHebrew, isLeapYear } from '../hebdate.js';
import { buildYear, hdOf, isoOf, nOf, dowOf } from './engine.js';

export const BASES = [
  ['fixed', 'שעה קבועה'], ['alos', 'עלות השחר'], ['neitz', 'נץ החמה'], ['chatzos', 'חצות'],
  ['shkia', 'שקיעה'], ['candles', 'הדלקת נרות'], ['rt', 'ר"ת'],
];
// "המאוחר / המוקדם מבין": { b: 'max'|'min', x: T, y: T } — למשל 5:30 אדער עלות +5, דאס שפעטערע
export const COMBOS = [['max', 'המאוחר מבין'], ['min', 'המוקדם מבין']];
export const ROUNDS = [['1n', 'בלי עיגול'], ['5n', 'עיגול ל-5 (קרוב)'], ['5u', 'עיגול ל-5 (למאוחר)'], ['5d', 'עיגול ל-5 (למוקדם)'], ['10n', 'עיגול ל-10'], ['15n', 'רבע שעה 00/15/30/45 (קרוב)'], ['15u', 'רבע שעה 00/15/30/45 (למאוחר)'], ['15d', 'רבע שעה 00/15/30/45 (למוקדם)']];
export const SEASONS = [['all', 'כל השנה'], ['winter', 'שעון חורף'], ['summer', 'שעון קיץ'], ['custom', 'מ... עד...']];
// נקודות אין יאר פאר "מ... עד..." (פון דעם טאג אן, אריינגערעכנט)
export const ANCHORS = [['dstStart', 'תחילת שעון קיץ'], ['dstEnd', 'תחילת שעון חורף'], ['afterPesach', 'אחרי פסח'], ['afterShavuos', 'אחרי שבועות'],
  ['rh', 'ראש השנה'], ['afterSukkos', 'אחרי סוכות'], ['chanuka', 'חנוכה'], ['purim', 'פורים']];

const toMin = (t) => { if (!String(t || '').trim()) return null; const [a, b] = String(t).split(':').map(Number); return Number.isFinite(a) ? a * 60 + (b || 0) : null; };
export const F = (t) => ({ b: 'fixed', t });
export const R = (b, a = 0, r = 1, m = 'n') => ({ b, a, r, m });

/** די זמנים פון א טאג (מינוט פון האלבנאכט) */
export function dayZ(iso, loc) {
  const z = zmanim(iso, loc);
  return { ...z, candles: z.candles, rt: z.shkia + 72 };
}
/** מינוט, אדער null */
export function timeOf(T, zd) {
  if (!T) return null;
  if (T.b === 'max' || T.b === 'min') {
    const v = [timeOf(T.x, zd), timeOf(T.y, zd)].filter((m) => m != null);
    return v.length ? (T.b === 'max' ? Math.max(...v) : Math.min(...v)) : null;
  }
  if (T.b === 'fixed' || T.t) return toMin(T.t);
  let base = zd[T.b];
  if (!Number.isFinite(base)) return null;
  // "שעות שמדלגים עליהן": ווען דער זמן פאלט צווישן from און to — רעכנט מען פון to (למשל ר"ת 6:00–7:00 → 7:00)
  if (T.sk) { const f = toMin(T.sk.from); const t = toMin(T.sk.to); if (f != null && t != null && base >= f && base < t) base = t; }
  const v = base + (Number(T.a) || 0); const r = Number(T.r) || 1;
  return T.m === 'u' ? Math.ceil(v / r) * r : T.m === 'd' ? Math.floor(v / r) * r : Math.round(v / r) * r;
}
/** א קורצע באשרייבונג: "שקיעה +25 (5)" */
export function describe(T) {
  if (!T) return '—';
  if (T.b === 'max' || T.b === 'min') return `${describe(T.x)} / ${describe(T.y)} (${T.b === 'max' ? 'המאוחר' : 'המוקדם'})`;
  if (T.b === 'fixed') return T.t || '—';
  const name = (BASES.find(([k]) => k === T.b) || [, T.b])[1];
  const a = Number(T.a) || 0;
  return `${name}${a ? ` ${a > 0 ? '+' : '−'}${Math.abs(a)} דק'` : ''}${T.sk ? ` (בין ${T.sk.from}–${T.sk.to} → מ-${T.sk.to})` : ''}`;
}
/** קיץ = זומער-צייט (DST) אין ניו יארק */
export function isSummer(iso) {
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
export function condOf(r, g) {
  if (r.cond !== undefined) return r.cond == null ? null : [].concat(r.cond);
  if (!r.auto) return null;
  return [g === 'shacharis' ? C('after', 0, 'alos') : g === 'mincha' ? C('before', 0, 'shkia') : C('after', 50, 'shkia')];
}
// תקופת קעמפ (ימות החול): חודש/טאג לועזי, אן א יאר — יעדעס יאר די זעלבע. r.campOff = [טעג 0..5] ווען דער מנין איז נישט בזמן הקעמפ
export const HDOW = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'"];
export function inCamp(iso, camp) {
  const c = camp || {}; const md = (m, d) => (Number(m) && Number(d) ? Number(m) * 100 + Number(d) : null);
  const f = md(c.fromM, c.fromD); const t = md(c.toM, c.toD); if (f == null || t == null) return false;
  const x = Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
  return f <= t ? x >= f && x <= t : x >= f || x <= t;
}
/** בזמן הקעמפ: null = נישט נוגע; 'drop' = נישט פארהאן; אדער א הערה "חוץ מיום א'" (די גאנצע וואך די זעלבע) */
export function campDays(r, iso, camp) {
  const off = (r.campOff || []).map(Number).filter((d) => d <= (r.fri ? 5 : 4));
  return off.length && inCamp(iso, camp) ? off : [];
}
export function campEffect(r, iso, camp) {
  const off = (r.campOff || []).map(Number).filter((d) => d <= (r.fri ? 5 : 4));
  if (!off.length || !inCamp(iso, camp)) return null;
  if (off.length >= (r.fri ? 6 : 5)) return 'drop';
  return `חוץ מ${off.length === 1 ? 'יום' : 'ימים'} ${off.sort().map((d) => HDOW[d]).join(' ')}`;
}
export function defaults() {
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
    ...normParts({ yt: { blocks: YT_BLOCKS() }, tishrei: { blocks: TISHREI_BLOCKS() } }),
    events: { rows: [] },
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
export const partOfDay = (m) => (m < 360 ? 'לפנות בוקר' : m < 720 ? 'בבוקר' : m < 1020 ? 'בצהריים' : m < 1260 ? 'בערב' : 'בלילה');
/** די שיעורים פון טאג n: [{ type, title, who, room, note, min }] לויט דער שעה */
/** allDays: אלע שיעורים וואס זענען אנגעצייכנט "אויפן מסך", אן א חילוק וועלכער טאג (דער מסך — א רשימה וואס לויפט אלעמאל) */
export function computeShiurim(data, n, loc, allDays = false) {
  const iso = isoOf(n); const zd = dayZ(iso, loc); const dw = dowOf(n);
  return (data.shiurim?.rows || []).filter((r) => r.screen !== false && (allDays || (r.days || []).includes(dw)) && inSeason(r.season, iso, r))
    .map((r) => ({ id: r.id, type: r.type, title: r.title, who: r.who, room: r.room, note: r.note, min: timeOf(r.time, zd) }))
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
  return [['חנוכה', 'chanuka'], ['עשרה בטבת', 'asaraTeves'], ['תענית אסתר', 'taanisEsther'], ['פורים', 'purim'], ['י"ז בתמוז', 'tamuz17'], ['תשעה באב', 'tishaBav']]
    .map(([t, w]) => block(t, w, []));
}
// די בלאקן פון data.minor זענען צוויי לשוניות: "חנוכה ותעניות" (נאר מעריב) און "פורים ותשעה באב" (זמנים מיוחדים — אנשטאט זמני שבת)
export const MINOR1 = ['chanuka', 'asaraTeves', 'taanisEsther', 'tamuz17'];
export const PT = ['purim', 'tishaBav'];
const FASTS = ['asaraTeves', 'taanisEsther', 'tamuz17'];
const blocksOf = (data, when) => (data.minor?.blocks || []).filter((b) => b.when === when);
const realT = (arr) => (arr || []).filter((T) => T && (T.b !== 'fixed' || String(T.t || '').trim()));
const dayIn = (when, n) => { const Y = hdOf(n).y; return [Y, Y + 1, Y - 1].some((y) => daysOf(when, y).includes(n)); };
/** מעריב פון דער נאכט נאך טאג n (מוצאי תענית / חנוכה): { block, label, times:[T] } — דאן איז דער מעריב הרגיל בטל, נאר די מניינים פון דער הגדרה */
export function maarivNight(data, n) {
  const dw = dowOf(n); if (dw === 5 || dw === 6) return null; // ליל שבת / מוצאי שבת — שבת
  for (const w of FASTS) {
    if (!dayIn(w, n)) continue;
    if (w === 'taanisEsther' && dayIn('purim', n + 1)) return null; // ממש ערב פורים: מעריב וקריאת המגילה — פון "פורים"
    const b = blocksOf(data, w).find((x) => realT(x.own?.maariv).length);
    if (b) return { block: b, label: `מעריב מוצאי ${b.title}`, times: realT(b.own.maariv) };
  }
  if (dayIn('chanuka', n + 1)) {
    const b = blocksOf(data, 'chanuka').find((x) => realT(x.own?.maarivMid).length);
    if (b) return { block: b, label: 'מעריב בחנוכה', times: realT(b.own.maarivMid), chanuka: true };
  }
  return null;
}
/** לשונית "פורים ותשעה באב": דער בלאק וואס איז פון ערב (on -1) ביז זיין לעצטן טאג ארום טאג n → { block, ds } */
export function ptAround(data, n, span = 9) {
  const x = hdOf(n);
  for (const w of PT) for (const b of blocksOf(data, w)) {
    if (!(b.rows || []).some((r) => (r.times || []).length)) continue;
    for (const Y of [x.y, x.y + 1, x.y - 1]) { const ds = daysOf(w, Y); if (ds.length && ds[ds.length - 1] >= n - 1 && ds[0] - 1 <= n + span) return { block: b, ds }; }
  }
  return null;
}
// א חג: מנחה ומעריב (ערב) · שחרית · מנחה ומעריב — פאר יעדן טאג פון חג
export function chagRows() {
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

// ---------- פסח / תשרי: א לוח פון טעג (יעדער טאג: כותרת, שורות, V "כמו ביום חול", V "כמו שבת רגילה", V חלוקה) ----------
export const CHAG_DAYS = new Set(['pesach1', 'pesach2', 'shvii', 'acharon', 'rh1', 'rh2', 'yk', 'sukkos1', 'sukkos2', 'shmini', 'simchas']);
export const SHAB_DAYS = new Set(['erevPesachShabbos', 'shabbosChm', 'shabSel', 'shuva', 'shabBein', 'shabChmS']);
const NO_WK = new Set(['hilula', 'yud3', 'hoshana']);
export const dayBlock = (when, title, rows = [], o = {}) => ({ id: id(), title, when, rows,
  wk: { shacharis: !CHAG_DAYS.has(when) && !SHAB_DAYS.has(when) && !NO_WK.has(when), mincha: !CHAG_DAYS.has(when) && !SHAB_DAYS.has(when) && !NO_WK.has(when), maariv: !CHAG_DAYS.has(when) && !SHAB_DAYS.has(when) && !NO_WK.has(when) },
  likeShab: SHAB_DAYS.has(when), splitD: false, splitM: false, ...o });
const cloneRow = (r, o = {}) => ({ ...JSON.parse(JSON.stringify(r)), id: id(), ...o });
/** א צוויי־טאגיגער בלאק (on: -1 / 0 / 1 / all / last) → צוויי טעג */
function split2(b, w1, t1, w2, t2) {
  const A = []; const B = [];
  for (const r of b.rows || []) {
    const on = r.on == null ? 'all' : String(r.on);
    if (on === '-1') A.push(cloneRow(r, { on: -1 }));
    else if (on === '0') A.push(cloneRow(r, { on: 'all' }));
    else if (on === '1' || on === 'last') B.push(cloneRow(r, { on: 'all' }));
    else { A.push(cloneRow(r)); B.push(cloneRow(r)); }
  }
  return [dayBlock(w1, t1, A, { pasuk: b.pasuk, psrc: b.psrc }), dayBlock(w2, t2, B)];
}
/** ווען א טאג האט שוין אן אייגענע שורה פון א תפילה (למשל "מנחה" ערב יו"כ) — נישט נאך אמאל "כמו ביום חול" */
function smartWk(list) {
  const GN = { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' };
  for (const b of list) for (const g of Object.keys(GN)) if (b.wk?.[g] && (b.rows || []).some((r) => String(r.label || '').includes(GN[g]) && hasTimes(r))) b.wk[g] = false;
}
/** "כמו ביום חול" פון די אלטע "like/own" → שורות + wk */
function fromLike(b, nb) {
  const GN = { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' };
  for (const g of ['shacharis', 'mincha', 'maariv']) {
    const own = b.own?.[g] || [];
    if (b.like && b.like[g] === false) { nb.wk[g] = false; if (own.length) nb.rows.push({ id: id(), label: GN[g], note: '', kind: 'tefila', on: 'all', times: own, screen: true }); }
  }
  return nb;
}
const hasTimes = (r) => (r.times || []).some((T) => T && (T.b !== 'fixed' || String(T.t || '').trim()));
/** אלטע דאטן (yt מיט פסח, תשרי מיט צוויי־טאגיגע בלאקן) → דער נייער לוח פון טעג. אויך פאר דער ברירת מחדל. */
export function normParts(d) {
  const out = {};
  const yt = d.yt?.blocks || [];
  // ---- פסח ----
  const OLDP = ['erevPesach', 'erevPesachShabbos', 'pesach', 'cholPesach', 'shabbosChmPesach', 'erevShvii', 'shviiPesach'];
  if (!yt.some((b) => OLDP.includes(b.when)) && d.pesach?.blocks?.length) out.pesach = d.pesach;
  else {
    const W = (w) => yt.find((b) => b.when === w);
    const P = [];
    const t = (k) => WHEN.pesach.find(([x]) => x === k)[1];
    P.push(dayBlock('bedika', t('bedika')));
    P.push(W('erevPesach') ? fromLike(W('erevPesach'), dayBlock('erevPesach', t('erevPesach'), (W('erevPesach').rows || []).map((r) => cloneRow(r)))) : dayBlock('erevPesach', t('erevPesach')));
    { const b = W('erevPesachShabbos'); P.push(dayBlock('erevPesachShabbos', t('erevPesachShabbos'), b ? (b.rows || []).map((r) => cloneRow(r, { on: String(r.on) === '0' ? -1 : 'all' })) : [], { likeShab: !(b && (b.rows || []).some(hasTimes)) })); }
    P.push(...(W('pesach') ? split2(W('pesach'), 'pesach1', t('pesach1'), 'pesach2', t('pesach2')) : [dayBlock('pesach1', t('pesach1')), dayBlock('pesach2', t('pesach2'))]));
    { const c = W('cholPesach'); const e = W('erevShvii'); const nb = c ? fromLike(c, dayBlock('cholPesach', t('cholPesach'), (c.rows || []).map((r) => cloneRow(r)))) : dayBlock('cholPesach', t('cholPesach'));
      if (e) nb.rows.push(...(e.rows || []).map((r) => cloneRow(r, { on: 'last' }))); P.push(nb); }
    { const b = W('shabbosChmPesach'); P.push(dayBlock('shabbosChm', t('shabbosChm'), b ? (b.rows || []).map((r) => cloneRow(r)) : [], { likeShab: !(b && (b.rows || []).some(hasTimes)) })); }
    P.push(...(W('shviiPesach') ? split2(W('shviiPesach'), 'shvii', t('shvii'), 'acharon', t('acharon')) : [dayBlock('shvii', t('shvii')), dayBlock('acharon', t('acharon'))]));
    smartWk(P);
    out.pesach = { blocks: P };
  }
  // ---- שבועות: נאר דער חג (ערב שבועות איז א טייל פון חג — "ערב") ----
  {
    const sh = yt.find((b) => b.when === 'shavuos'); const es = yt.find((b) => b.when === 'erevShavuos');
    const rows = [...(sh?.rows || [])];
    if (es) for (const r of es.rows || []) if (hasTimes(r)) rows.push(cloneRow(r, { on: -1 }));
    out.yt = { blocks: yt.length && !yt.some((b) => b.when !== 'shavuos') ? yt : [{ ...(sh || { id: id(), title: 'שבועות', when: 'shavuos', type: 'chag' }), rows }] };
  }
  // ---- תשרי ----
  const tb = d.tishrei?.blocks || [];
  if (tb.some((b) => b.when === 'rh1') || !tb.length) out.tishrei = tb.length ? d.tishrei : { blocks: [] };
  else {
    const W = (w) => tb.find((b) => b.when === w);
    const t = (k) => WHEN.tishreiDays.find(([x]) => x === k)[1];
    const keep = (w) => { const b = W(w); return b ? fromLike(b, dayBlock(w, t(w), (b.rows || []).map((r) => cloneRow(r)), { pasuk: b.pasuk, psrc: b.psrc })) : dayBlock(w, t(w)); };
    const L = [keep('selichos1'), keep('selichos'), dayBlock('shabSel', t('shabSel'))];
    { const b = W('erevRH'); const ev = (b?.rows || []).filter((r) => String(r.on) === '-1'); const dy = (b?.rows || []).filter((r) => String(r.on) !== '-1');
      L.push(dayBlock('hilula', t('hilula'), ev.map((r) => cloneRow(r, { on: 'all' }))));
      L.push(fromLike(b || {}, dayBlock('erevRH', t('erevRH'), dy.map((r) => cloneRow(r))))); }
    L.push(...(W('rh') ? split2(W('rh'), 'rh1', t('rh1'), 'rh2', t('rh2')) : [dayBlock('rh1', t('rh1')), dayBlock('rh2', t('rh2'))]));
    L.push(keep('gedalia'));
    { const b = W('shuva'); L.push(dayBlock('shuva', t('shuva'), (b?.rows || []).map((r) => cloneRow(r)), { likeShab: !(b && (b.rows || []).some(hasTimes)) })); }
    L.push(keep('aseres'), keep('yud3'), keep('erevYK'), keep('yk'), dayBlock('bein', t('bein')), dayBlock('shabBein', t('shabBein')));
    L.push(...(W('sukkos') ? split2(W('sukkos'), 'sukkos1', t('sukkos1'), 'sukkos2', t('sukkos2')) : [dayBlock('sukkos1', t('sukkos1')), dayBlock('sukkos2', t('sukkos2'))]));
    L.push(keep('cholSukkos'), dayBlock('shabChmS', t('shabChmS')), keep('hoshana'));
    L.push(...(W('shmini') ? split2(W('shmini'), 'shmini', t('shmini'), 'simchas', t('simchas')) : [dayBlock('shmini', t('shmini')), dayBlock('simchas', t('simchas'))]));
    for (const x of L) { if (CHAG_DAYS.has(x.when)) x.wk = { shacharis: false, mincha: false, maariv: false }; }
    smartWk(L);
    out.tishrei = { blocks: L, ...(W('bereishis') ? { bereishis: W('bereishis') } : {}) };
  }
  return out;
}
/** פאר יעדן ארט וואו מ'לייענט די דאטן: אלטע דאטן → נייע (נישט טוישן ווען שוין נייע) */
export function normData(data) {
  if (!data || data.__norm) return data;
  Object.assign(data, normParts(data));
  if (!data.events) data.events = { rows: [] };
  Object.defineProperty(data, '__norm', { value: true, enumerable: false, configurable: true });
  return data;
}

// ---------- וואנען איז יעדער בלאק (פון א אידיש יאר) ----------
export const WHEN = {
  tishrei: [['selichos1', 'סליחות - יום א\''], ['selichos', 'סליחות - שאר הימים'], ['erevRH', 'ערב ראש השנה'], ['rh', 'ראש השנה'], ['gedalia', 'צום גדליה'], ['aseres', 'עשרת ימי תשובה'],
    ['yud3', 'י"ג מדות'], ['shuva', 'שבת תשובה'], ['erevYK', 'ערב יום הכיפורים'], ['yk', 'יום הכיפורים'], ['sukkos', 'חג הסוכות'], ['cholSukkos', 'חול המועד סוכות'],
    ['hoshana', 'הושענא רבה'], ['shmini', 'שמיני עצרת ושמחת תורה'], ['bereishis', 'שבת בראשית']],
  minor: [['chanuka', 'חנוכה'], ['asaraTeves', 'עשרה בטבת'], ['taanisEsther', 'תענית אסתר'], ['purim', 'פורים'], ['tamuz17', 'י"ז בתמוז'], ['tishaBav', 'תשעה באב']],
  pesach: [['bedika', 'יום וליל בדיקת חמץ'], ['erevPesach', 'ערב פסח'], ['erevPesachShabbos', 'שבת שחל בערב פסח'], ['pesach1', "יום א' דפסח"], ['pesach2', "יום ב' דפסח"],
    ['cholPesach', 'ימי חול המועד'], ['shabbosChm', 'שבת חול המועד'], ['shvii', 'שביעי של פסח'], ['acharon', 'אחרון של פסח']],
  tishreiDays: [['selichos1', "יום א' דסליחות"], ['selichos', 'שאר ימי הסליחות'], ['shabSel', 'שבת פרשת ...'], ['hilula', 'יומא דהילולא — ליל ערב ראש השנה'], ['erevRH', 'ערב ראש השנה'],
    ['rh1', "יום א' דראש השנה"], ['rh2', "יום ב' דראש השנה"], ['gedalia', 'צום גדליה'], ['shuva', 'שבת שובה'], ['aseres', 'עשרת ימי תשובה'], ['yud3', 'י"ג מדות'],
    ['erevYK', 'ערב יום כיפור'], ['yk', 'יום כיפור'], ['bein', 'בין יום כיפור לסוכות'], ['shabBein', 'שבת שבין יום כיפור לסוכות'], ['sukkos1', "יום א' דסוכות"], ['sukkos2', "יום ב' דסוכות"],
    ['cholSukkos', 'חול המועד סוכות'], ['shabChmS', 'שבת חול המועד'], ['hoshana', 'הושענא רבה'], ['shmini', 'שמיני עצרת'], ['simchas', 'שמחת תורה']],
  shavuos: [['shavuos', 'שבועות']],
  yt: [['erevPesach', 'ערב פסח'], ['erevPesachShabbos', 'ערב פסח שחל בשבת (ו\' + ש\')'], ['pesach', 'פסח (ב\' ימים)'], ['cholPesach', 'חול המועד פסח'], ['shabbosChmPesach', 'שבת חול המועד פסח'], ['erevShvii', 'ערב שביעי של פסח'], ['shviiPesach', 'שביעי ואחרון של פסח'], ['erevShavuos', 'ערב שבועות'], ['shavuos', 'שבועות']],
};
const yc = new Map();
const yearDays = (Y) => { if (!yc.has(Y)) yc.set(Y, buildYear(Y, {}, {})); return yc.get(Y).days; };
const findHol = (Y, re) => yearDays(Y).filter((d) => d.items.some((i) => i.kind === 'hol' && re.test(i.text))).map((d) => d.n);
/** די טעג (n) פון א בלאק אין יאר Y. פאר תשרי: Y = דאס יאר וואס הייבט זיך אן מיט דעם תשרי (סליחות זענען אין אלול פון Y-1) */
export function daysOf(when, Y) {
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
    case 'aseres': { const g = findHol(Y, /צום גדליה/); return range(T(3), T(8)).filter((n) => dowOf(n) !== 6 && !g.includes(n)); }
    case 'yud3': return findHol(Y, /^י"ג מדות/).filter((n) => n < T(10));
    case 'shuva': return range(T(3), T(9)).filter((n) => dowOf(n) === 6);
    case 'erevYK': return [T(9)];
    case 'yk': return [T(10)];
    case 'sukkos': return [T(15), T(16)];
    case 'cholSukkos': return range(T(17), T(20)).filter((n) => dowOf(n) !== 6);
    case 'hoshana': return [T(21)];
    case 'shmini': return [T(22)]; // (פריער: שמע"צ און שמח"ת צוזאמען — יעצט צוויי טעג באזונדער)
    case 'bereishis': { let n = T(24); while (dowOf(n) !== 6) n += 1; return [n]; }
    case 'chanuka': return findHol(Y, /חנוכה/);
    case 'asaraTeves': return findHol(Y, /עשרה בטבת/);
    case 'taanisEsther': return findHol(Y, /תענית אסתר/);
    case 'purim': return findHol(Y, /^פורים$|^פורים \(/);
    case 'erevPesach': { const e = at('Nisan', 14); return e != null && dowOf(e) !== 6 ? [e] : []; }
    case 'erevPesachShabbos': { const e = at('Nisan', 14); return e != null && dowOf(e) === 6 ? [e] : []; }
    case 'pesach': { const p = at('Nisan', 15); return [p, p + 1]; }
    case 'cholPesach': return range(at('Nisan', 17), at('Nisan', 20)).filter((n) => dowOf(n) !== 6);
    case 'shabbosChmPesach': return range(at('Nisan', 17), at('Nisan', 20)).filter((n) => dowOf(n) === 6);
    case 'erevShvii': return [at('Nisan', 20)];
    case 'shviiPesach': return [at('Nisan', 21), at('Nisan', 22)];
    case 'lagBaomer': return [at('Iyar', 18)];
    case 'erevShavuos': return [at('Sivan', 5)];
    case 'shavuos': return [at('Sivan', 6), at('Sivan', 7)];
    case 'tamuz17': return findHol(Y, /י"ז בתמוז/);
    // ---- פסח: לוח של ימים ----
    case 'bedika': { const e = at('Nisan', 14); return e == null ? [] : [dowOf(e) === 6 ? e - 2 : e - 1]; }
    case 'pesach1': return [at('Nisan', 15)];
    case 'pesach2': return [at('Nisan', 16)];
    case 'shabbosChm': return range(at('Nisan', 17), at('Nisan', 20)).filter((n) => dowOf(n) === 6);
    case 'shvii': return [at('Nisan', 21)];
    case 'acharon': return [at('Nisan', 22)];
    // ---- תשרי: לוח של ימים ----
    case 'shabSel': { const rh = T(1); let sat = rh - 1; while (dowOf(sat) !== 6) sat -= 1; if (rh - sat < 4) sat -= 7; const first = sat + 1; return range(first, rh - 1).filter((n) => dowOf(n) === 6); }
    case 'hilula': return [T(1) - 2];
    case 'rh1': return [T(1)];
    case 'rh2': return [T(2)];
    case 'bein': return range(T(11), T(14)).filter((n) => dowOf(n) !== 6);
    case 'shabBein': return range(T(11), T(14)).filter((n) => dowOf(n) === 6);
    case 'sukkos1': return [T(15)];
    case 'sukkos2': return [T(16)];
    case 'shabChmS': return range(T(17), T(20)).filter((n) => dowOf(n) === 6);
    case 'simchas': return [T(23)];
    case 'tishaBav': return findHol(Y, /תשעה באב/);
    default: return [];
  }
}

// ---------- חשבון ----------
/** ימות החול פאר טאג n: { shacharis:[..], mincha:[..], maariv:[..], last } — יעדער: { min, room, note, kahal } */
/** זמני ימות החול זענען פאר דער גאנצער וואך: מען רעכנט לויט איין טאג (weekday.refDay) */
export const REF_DAYS = [['0', 'יום א\''], ['1', 'יום ב\''], ['2', 'יום ג\''], ['3', 'יום ד\''], ['4', 'יום ה\''], ['5', 'יום ו\''], ['early', 'השקיעה המוקדמת בשבוע'], ['late', 'השקיעה המאוחרת בשבוע'], ['avg', 'השקיעה הממוצעת בשבוע'], ['daily', 'כל יום לפי עצמו']];
export function weekRefDay(data, n, loc) {
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
export function weekZ(data, n, loc) {
  if ((data.weekday?.refDay ?? '0') !== 'avg') return dayZ(isoOf(weekRefDay(data, n, loc)), loc);
  const sun = weekRefDay(data, n, loc);
  const zs = [0, 1, 2, 3, 4, 5].map((i) => dayZ(isoOf(sun + i), loc));
  const out = { ...zs[0] };
  for (const k of Object.keys(out)) if (typeof out[k] === 'number') out[k] = zs.reduce((a, z) => a + z[k], 0) / zs.length;
  return out;
}
/** א שעה וואס רוקט זיך (לויט שקיעה א.א.וו.) — דער כלל; א פעסטע שעה — '' */
const specOf = (T) => (T && (T.b === 'max' || T.b === 'min') ? `${T.b}(${specOf(T.x) || T.x?.t},${specOf(T.y) || T.y?.t})` : T && T.b && T.b !== 'fixed' && !T.t ? `${T.b}${Number(T.a) || 0}/${T.r || 1}${T.m || ''}${T.sk ? `~${T.sk.from}-${T.sk.to}` : ''}` : '');
/** opt.plain: די וואך אליין — אן פרייטאג און אן ימי דפגרא/ערב חג (פאר דער תצוגה). opt.ytOnly: נאר ערב חג (נישט חנוכה/תעניות/פורים) */
export function computeWeekday(data, n, loc, opt = {}) {
  const w = data.weekday; const zd = weekZ(data, n, loc); const fri = dowOf(n) === 5 && !opt.plain;
  // עונה / קעמפ: לויט דעם זונטאג פון דער וואך (די גאנצע וואך די זעלבע); שבת → די קומענדיגע וואך
  const iso = (w.refDay ?? '0') === 'daily' ? isoOf(n) : isoOf(n - dowOf(n) + (dowOf(n) === 6 ? 7 : 0));
  const ok = (r) => inSeason(r.season, iso, r) && (!fri || r.fri) && campEffect(r, iso, w.camp) !== 'drop';
  const mk = (r) => ({ min: timeOf(r.time, zd), room: r.room || w.defaultRoom || '', note: r.note || '', kahal: !!r.kahal, last: !!r.last, spec: specOf(r.time), xn: campEffect(r, iso, w.camp) || '', xdays: campDays(r, iso, w.camp) });
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
  out.ov = {}; out.shacharisNote = w.shacharisNote || ''; out.minchaNote = w.minchaNote || ''; out.maarivNote = w.maarivNote || '';
  if (opt.plain) return out;
  // שולחן הטהור ודרשות: "אין מנין לפני / אחרי" — מנחה ומעריב פון דעם טאג
  for (const e of eventsBetween(data, n, n, loc)) {
    const qb = Number(e.ev.qb) || 0; const qa = Number(e.ev.qa) || 0; if (!qb && !qa) continue;
    for (const g of ['mincha', 'maariv']) out[g] = out[g].filter((x) => x.rebbe || !e.rows.some((r) => x.min >= r.min - qb && x.min <= r.min + qa));
  }
  // חנוכה ותעניות: נאר דער מעריב (מוצאי תענית / חנוכה) — אנשטאט דעם מעריב הרגיל
  const mn = opt.ytOnly ? null : maarivNight(data, n);
  if (mn) { const zn = dayZ(isoOf(n), loc); out.maariv = mn.times.map((T) => ({ min: timeOf(T, zn), room: '', note: '' })).filter((x) => x.min != null).sort((a, b) => a.min - b.min); out.ov.maariv = true; out.maarivLabel = mn.label; }
  // ימי דפגרא ותעניות: א תפילה וואס איז נישט "כמו ימות החול" — אירע אייגענע שעות
  const own = (blk, g) => (blk.own?.[g] || []).map((T) => ({ min: timeOf(T, zd), room: '', note: '' })).filter((x) => x.min != null).sort((a, b) => a.min - b.min);
  const mb = minorBlockOn(data, n, opt.ytOnly); const nb = minorBlockOn(data, n + 1, opt.ytOnly);
  if (mb) {
    out.minor = mb.title;
    const like = mb.like || {};
    for (const g of ['shacharis', 'mincha']) {
      if (like[g] !== false) continue;
      out[g] = own(mb, g); out.ov[g] = true;
      if (g === 'mincha') out.last = null;
    }
    if (fri && mb.fri?.mode === 'custom') out.friMincha = timeOf(mb.fri.time, zd);
  }
  // "מנחה ערב": די מנחה פונעם טאג פאר א יום דפגרא/תענית
  if (!mb && nb && (nb.like || {}).minchaEve === false) { out.mincha = own(nb, 'minchaEve'); out.last = null; out.ov.mincha = true; }
  // מעריב פון היינט ביינאכט: ערב (פאר'ן ערשטן טאג) · אמצע (צווישן טעג פון א לענגערן בלאק) · מוצאי (נאכן לעצטן טאג)
  const eveG = !mb && nb ? 'maarivEve' : mb && nb === mb ? 'maarivMid' : mb ? 'maariv' : null;
  const eb = eveG === 'maarivEve' ? nb : mb;
  if (eveG && !mn && (eb.like || {})[eveG] === false) { out.maariv = own(eb, eveG); out.ov.maariv = true; }
  return out;
}
/** דער בלאק פון ימי דפגרא ותעניות וואס איז אויף טאג n */
export function minorBlockOn(data, n, ytOnly = false, all = false) {
  const x = hdOf(n);
  // חנוכה ותעניות האבן נאר א מעריב (maarivNight) — שחרית און מנחה ווי ימות החול
  for (const b of [...(ytOnly ? [] : (data.minor?.blocks || []).filter((q) => all || !MINOR1.includes(q.when))), ...(data.yt?.blocks || []).filter((q) => q.type === 'erev')]) {
    for (const Y of [x.y, x.y + 1, x.y - 1]) if (daysOf(b.when, Y).includes(n)) return b;
  }
  return null;
}
// ---------- שולחן הטהור ודרשות (אירועים שאינם בימים המוגדרים) ----------
// ev = { id, title, date: { type: 'heb'|'shabbos'|'once', d, m, sh, iso }, onShab: ''|'fri'|'motzei'|'sun', rows: [{ id, label, eve, time }],
//        away: true (מתבטל כשאד"ש לא נמצא), qb / qa (אין מנחה/מעריב של ימות החול X דק' לפני / אחרי), screen }
export const EV_SHAB = ['שבת הגדול', 'פרשת שקלים', 'פרשת זכור', 'פרשת פרה', 'פרשת החודש', 'שבת שובה', 'שבת שירה', 'שבת חזון', 'שבת נחמו'];
export const awayOnDay = (data, k) => { const iso = isoOf(k); return (data.rebbeAway || []).some((x) => x.from && x.to && x.from <= iso && x.to >= iso); };
/** דער טאג פונעם אירוע אין אידישן יאר Y: { n, eveAll } אדער null */
function evDayIn(ev, Y) {
  const D = ev.date || {};
  if (D.type === 'once') { if (!D.iso) return null; const n = nOf(D.iso); return hdOf(n).y === Y ? { n, eveAll: false } : null; }
  const days = yearDays(Y);
  if (D.type === 'shabbos') {
    const key = String(D.sh || '').trim(); if (!key) return null;
    const x = days.find((d) => dowOf(d.n) === 6 && ((d.items || []).some((i) => i.text === key) || (d.parsha && (d.parsha === key || d.parsha === key.replace(/^פרשת\s+/, '')))));
    return x ? { n: x.n, eveAll: false } : null;
  }
  let m = D.m; const leap = isLeapYear(Y);
  if (m === 'Adar' && leap) m = 'Adar II'; else if ((m === 'Adar I' || m === 'Adar II') && !leap) m = 'Adar';
  const x = days.find((q) => q.hm === m && q.hd === Number(D.d)); if (!x) return null;
  let n = x.n; let eveAll = false;
  if (dowOf(n) === 6 && ev.onShab) { if (ev.onShab === 'fri') eveAll = true; else if (ev.onShab === 'motzei') { n += 1; eveAll = true; } else if (ev.onShab === 'sun') n += 1; }
  return { n, eveAll };
}
/** די אירועים מיט שורות אויף טעג n0..n1: [{ ev, n, rows: [{ label, day, min }], first, last }] */
export function eventsBetween(data, n0, n1, loc) {
  const out = [];
  const ys = new Set([hdOf(n0).y - 1, hdOf(n0).y, hdOf(n1).y, hdOf(n1).y + 1]);
  for (const ev of data.events?.rows || []) {
    if (ev.screen === false) continue;
    for (const Y of ys) {
      const at = evDayIn(ev, Y); if (!at) continue;
      const rows = (ev.rows || []).map((r) => { const day = r.eve || at.eveAll ? at.n - 1 : at.n; return { label: r.label || ev.title, day, min: timeOf(r.time, dayZ(isoOf(day), loc)) }; })
        .filter((r) => r.min != null && r.day >= n0 && r.day <= n1);
      if (!rows.length) continue;
      if (ev.away !== false && rows.some((r) => awayOnDay(data, r.day))) continue;
      const abs = rows.map((r) => r.day * 1440 + r.min);
      out.push({ ev, n: at.n, rows: rows.sort((a, b) => a.day * 1440 + a.min - (b.day * 1440 + b.min)), first: Math.min(...abs), last: Math.max(...abs) });
    }
  }
  return out.sort((a, b) => a.first - b.first);
}
const avosSeason = (n) => { const x = hdOf(n); return ['Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'].includes(x.m) || (x.m === 'Nisan' && x.d > 22); };
/** שבת: fri = n פון ערב שבת. גיט [{ label, min, kind, note, day }] אין סדר, מיט הדלקת נרות פאראויס */
/** כ"ק אד"ש איז נישט דא די שבת (data.rebbeAway = [{ from, to }] — פון "✈ נסע") */
export function rebbeAwayOn(data, fri) {
  const a = isoOf(fri); const b = isoOf(fri + 1);
  return (data.rebbeAway || []).some((x) => x.from && x.to && x.from <= b && x.to >= a);
}
export function computeShabbos(data, fri, loc) {
  const zf = dayZ(isoOf(fri), loc); const zs = dayZ(isoOf(fri + 1), loc); const iso = isoOf(fri);
  const away = rebbeAwayOn(data, fri);
  const rows = [{ label: 'הדלקת נרות', min: zf.candles, kind: 'zman', note: '', day: 'fri' }];
  for (const r of data.shabbos.rows || []) {
    if (r.season === 'avos' ? !avosSeason(fri + 1) : !inSeason(r.season, isoOf(r.day === 'sat' ? fri + 1 : fri), r)) continue;
    if (away && r.away === 'hide') continue;
    let min = timeOf(r.time, r.day === 'sat' ? zs : zf);
    if (away && r.away === 'shift' && min != null) min += Number(r.awayMin) || 0;
    // ער"ש וואס איז א יום דפגרא/תענית מיט אן אייגענער מנחה וקבלת שבת
    if (r.day === 'fri' && r.kind === 'tefila' && /מנחה/.test(r.label)) {
      const mb = minorBlockOn(data, fri, false, true);
      if (mb?.fri?.mode === 'custom') min = timeOf(mb.fri.time, zf);
      else if (mb?.fri && min != null) min += (mb.fri.sign === '-' ? -1 : 1) * (Number(mb.fri.shift) || 0);
    }
    rows.push({ label: r.label, min, kind: r.kind, note: r.note || '', day: r.day, screen: r.screen !== false });
  }
  // שולחן הטהור ודרשות וואס זענען אין דער שבת (ליל שבת נאך הדלקת נרות, אדער שבת)
  for (const e of eventsBetween(data, fri, fri + 1, loc)) {
    for (const r of e.rows) if ((r.day === fri + 1 && r.min < zs.motzei) || (r.day === fri && r.min >= zf.candles)) rows.push({ label: r.label, min: r.min, kind: 'event', note: '', day: r.day === fri ? 'fri' : 'sat', screen: true });
  }
  return rows; // אין דעם סדר וואס מ'האט באשטימט
}
/** בלאקן (תשרי + יו"ט) וואס האבן עפעס אויף טאג n (אויך ערב: on = -1). גיט [{ title, rows:[{label,note,kind,mins:[..]}] }] */
export function computeSpecial(data, n, loc) {
  const zd = dayZ(isoOf(n), loc); const out = [];
  const x = hdOf(n);
  for (const part of ['tishrei', 'pesach', 'yt', 'minor']) {
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
          ...((r.sat?.on && dowOf(n) === 6 && r.sat.label) ? { label: r.sat.label } : (r.fri?.on && dowOf(n) === 5 && r.fri.label) ? { label: r.fri.label } : friMincha(data, n, r.label) ? { label: 'מנחה וקבלת שבת' } : {}),
          mins: ((r.sat?.on && dowOf(n) === 6 ? r.sat.times : r.fri?.on && dowOf(n) === 5 ? r.fri.times : r.times) || []).map((t) => timeOf(t, zd)).filter((m) => m != null) }));
        if (rows.length) { out.push({ title: b.title, part, when: b.when, type: isChag(part, b) ? 'chag' : (b.type || ''), rows }); break; }
      }
    }
  }
  return out;
}
/** א חג וואס פאלט אויס ערב שבת: די "מנחה" פון יענעם טאג איז "מנחה וקבלת שבת" */
export const friMincha = (data, n, label) => dowOf(n) === 5 && /מנחה/.test(label || '') && chagOn(data, n);
// ---------- שבת און יו"ט צוזאמען ----------
export const TISHREI_CHAG = new Set(['rh1', 'rh2', 'yk', 'sukkos1', 'sukkos2', 'shmini', 'simchas']);
const isChag = (part, b) => (part === 'yt' && b.type === 'chag') || ((part === 'tishrei' || part === 'pesach') && CHAG_DAYS.has(b.when));
/** איז טאג n א יו"ט (לויטן לוח, אדער א בלאק פון א חג) */
export function chagOn(data, n) {
  const x = hdOf(n);
  for (const y of [x.y, x.y + 1]) { const d = yearDays(y).find((q) => q.n === n); if (d) { if (d.items.some((i) => i.yt)) return true; break; } }
  for (const [part, list] of [['yt', data.yt?.blocks || []], ['tishrei', data.tishrei?.blocks || []], ['pesach', data.pesach?.blocks || []]]) {
    for (const b of list) { if (!isChag(part, b)) continue; for (const Y of [x.y, x.y + 1, x.y - 1]) if (daysOf(b.when, Y).includes(n)) return true; }
  }
  return false;
}
/** שבת/יו"ט: די שורות פאר "ערב" eve און דעם טאג eve+1. יעדע שורה: { label, kind, note, min, more, day (0 = ערב, 1 = דער טאג), screen, place }
 *  כללים: שבת שחלה בערב יו"ט — שבת ביז נאך שחרית, דערנאך דער חג (מנחה ומעריב פון ערב החג) + "לא לפני" ר"ת;
 *  יו"ט שחל בערב שבת — ער"ש לויט "כשחל בערב שבת", הדלקת נרות, שבת פון נאך מעריב; יו"ט שחל בשבת — נאר דער חג. */
export function computeHoly(data, eve, loc) {
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
    return [...keep, ...chagEve, { label: 'מוצאי שבת', kind: 'zman', note: '', min: zD.rt, more: [], day: 1, screen: true, place: 'shab' }];
  }
  const out = [];
  // הדלקת נרות: ערב פון א וואכנטאג, אדער ערב שבת (אויך ווען ער"ש איז יו"ט — פון א נר הדולק)
  if (dowOf(eve) === 5) out.push({ label: 'הדלקת נרות', kind: 'zman', note: '', min: zE.candles, more: [], day: 0, screen: true, place: 'shab' });
  else if (dowOf(eve) === 6 && !cE && cD) out.push({ label: 'מוצאי שבת', kind: 'zman', note: '', min: zE.rt, more: [], day: 0, screen: true, place: 'shab' });
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
export { nOf, isoOf };
