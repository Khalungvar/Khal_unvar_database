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
export const ROUNDS = [['1n', 'בלי עיגול'], ['5n', 'עיגול ל-5 (קרוב)'], ['5u', 'עיגול ל-5 (למאוחר)'], ['5d', 'עיגול ל-5 (למוקדם)'], ['10n', 'עיגול ל-10'], ['15n', 'רבע שעה 00/15/30/45 (קרוב)'], ['15u', 'רבע שעה 00/15/30/45 (למאוחר)'], ['15d', 'רבע שעה 00/15/30/45 (למוקדם)']];
export const SEASONS = [['all', 'כל השנה'], ['winter', 'שעון חורף'], ['summer', 'שעון קיץ'], ['custom', 'מ... עד...']];
// נקודות אין יאר פאר "מ... עד..." (פון דעם טאג אן, אריינגערעכנט)
export const ANCHORS = [['dstStart', 'תחילת שעון קיץ'], ['dstEnd', 'תחילת שעון חורף'], ['afterPesach', 'אחרי פסח'], ['afterShavuos', 'אחרי שבועות'],
  ['rh', 'ראש השנה'], ['afterSukkos', 'אחרי סוכות'], ['chanuka', 'חנוכה'], ['purim', 'פורים']];

const toMin = (t) => { const [a, b] = String(t || '').split(':').map(Number); return Number.isFinite(a) ? a * 60 + (b || 0) : null; };
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
  if (T.b === 'fixed' || T.t) return toMin(T.t);
  const base = zd[T.b];
  if (!Number.isFinite(base)) return null;
  const v = base + (Number(T.a) || 0); const r = Number(T.r) || 1;
  return T.m === 'u' ? Math.ceil(v / r) * r : T.m === 'd' ? Math.floor(v / r) * r : Math.round(v / r) * r;
}
/** א קורצע באשרייבונג: "שקיעה +25 (5)" */
export function describe(T) {
  if (!T) return '—';
  if (T.b === 'fixed') return T.t || '—';
  const name = (BASES.find(([k]) => k === T.b) || [, T.b])[1];
  const a = Number(T.a) || 0;
  return `${name}${a ? ` ${a > 0 ? '+' : '−'}${Math.abs(a)} דק'` : ''}`;
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
export function defaults() {
  return {
    weekday: {
      shacharisNote: 'הודו +10 מינוט', minchaNote: '', maarivNote: '', maarivAfter: 50, defaultRoom: '',
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
  };
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
function YT_BLOCKS() {
  return [
    block('ערב פסח', 'erevPesach', empty(['שחרית', 'סוף זמן אכילת חמץ', 'סוף זמן שריפת חמץ', 'מנחה'])),
    block('פסח', 'pesach', empty(['שחרית', 'מנחה'])),
    block('חול המועד פסח', 'cholPesach', empty(['שחרית', 'מנחה'])),
    block('שביעי ואחרון של פסח', 'shviiPesach', empty(['שחרית', 'מנחה'])),
    block('ערב שבועות', 'erevShavuos', empty(['שחרית', 'מנחה'])),
    block('שבועות', 'shavuos', empty(['שחרית', 'מנחה'])),
  ];
}

// ---------- וואנען איז יעדער בלאק (פון א אידיש יאר) ----------
export const WHEN = {
  tishrei: [['selichos1', 'סליחות - יום א\''], ['selichos', 'סליחות - שאר הימים'], ['erevRH', 'ערב ראש השנה'], ['rh', 'ראש השנה'], ['gedalia', 'צום גדליה'], ['aseres', 'עשרת ימי תשובה'],
    ['yud3', 'י"ג מדות'], ['shuva', 'שבת תשובה'], ['erevYK', 'ערב יום הכיפורים'], ['yk', 'יום הכיפורים'], ['sukkos', 'חג הסוכות'], ['cholSukkos', 'חול המועד סוכות'],
    ['hoshana', 'הושענא רבה'], ['shmini', 'שמיני עצרת ושמחת תורה'], ['bereishis', 'שבת בראשית']],
  minor: [['chanuka', 'חנוכה'], ['asaraTeves', 'עשרה בטבת'], ['taanisEsther', 'תענית אסתר'], ['purim', 'פורים'], ['lagBaomer', 'ל"ג בעומר'],
    ['tamuz17', 'י"ז בתמוז'], ['tishaBav', 'תשעה באב']],
  yt: [['erevPesach', 'ערב פסח'], ['pesach', 'פסח (ב\' ימים)'], ['cholPesach', 'חול המועד פסח'], ['shviiPesach', 'שביעי ואחרון של פסח'], ['erevShavuos', 'ערב שבועות'], ['shavuos', 'שבועות']],
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
    case 'erevPesach': return findHol(Y, /^ערב פסח/);
    case 'pesach': { const p = at('Nisan', 15); return [p, p + 1]; }
    case 'cholPesach': return range(at('Nisan', 17), at('Nisan', 20)).filter((n) => dowOf(n) !== 6);
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
export function computeWeekday(data, n, loc) {
  const w = data.weekday; const iso = isoOf(n); const zd = dayZ(iso, loc); const fri = dowOf(n) === 5;
  const ok = (r) => inSeason(r.season, iso, r) && (!fri || r.fri);
  const mk = (r) => ({ min: timeOf(r.time, zd), room: r.room || w.defaultRoom || '', note: r.note || '', kahal: !!r.kahal, last: !!r.last });
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
    out[g].push({ min: m, room: r.room || w.defaultRoom || '', note: r.note || '', kahal: true, rebbe: true });
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
export function minorBlockOn(data, n) {
  const x = hdOf(n);
  for (const b of data.minor?.blocks || []) {
    for (const Y of [x.y, x.y + 1, x.y - 1]) if (daysOf(b.when, Y).includes(n)) return b;
  }
  return null;
}
const avosSeason = (n) => { const x = hdOf(n); return ['Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'].includes(x.m) || (x.m === 'Nisan' && x.d > 22); };
/** שבת: fri = n פון ערב שבת. גיט [{ label, min, kind, note, day }] אין סדר, מיט הדלקת נרות פאראויס */
export function computeShabbos(data, fri, loc) {
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
export function computeSpecial(data, n, loc) {
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
        }).map((r) => ({ label: r.label, note: r.note, kind: r.kind, screen: r.screen !== false, disp: r.disp || null, mins: (r.times || []).map((t) => timeOf(t, zd)).filter((m) => m != null) }));
        if (rows.length) { out.push({ title: b.title, rows }); break; }
      }
    }
  }
  return out;
}
export { nOf, isoOf };
