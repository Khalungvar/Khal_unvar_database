// זמני תפילות — דאטן + חשבון. געניצט סיי פון "זמני תפילות" אינעם אתר (ניהול) סיי פון דער תצוגה אין בית הכנסת.
// ארבע טיילן: ימות החול (שחרית/מנחה/מעריב), שבת, יום טוב (אלע חגים חוץ תשרי), תשרי (מיט סליחות).
// א זמן (T): { b: 'fixed', t: 'HH:MM' (24 שעה) }  אדער  { b: 'shkia'|'neitz'|'alos'|'chatzos'|'candles'|'rt', a: ±מינוט, r: עיגול, m: 'n'|'u'|'d' }
import { zmanim } from './zmanim.js';
import { buildYear, hdOf, isoOf, nOf, dowOf } from './engine.js';

export const BASES = [
  ['fixed', 'שעה קבועה'], ['alos', 'עלות השחר'], ['neitz', 'נץ החמה'], ['chatzos', 'חצות'],
  ['shkia', 'שקיעה'], ['candles', 'הדלקת נרות'], ['rt', 'ר"ת'],
];
export const ROUNDS = [['1n', 'בלי עיגול'], ['5n', 'עיגול ל-5 (קרוב)'], ['5u', 'עיגול ל-5 (למעלה)'], ['5d', 'עיגול ל-5 (למטה)'], ['10n', 'עיגול ל-10']];
export const SEASONS = [['all', 'כל השנה'], ['winter', 'חורף'], ['summer', 'קיץ']];

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
const inSeason = (s, iso) => !s || s === 'all' || (s === 'summer') === isSummer(iso);

// ---------- ברירת מחדל: פונעם לוח השנה (צו איבערקוקן) + די אלטע תוכנה ----------
let uid = 0; const id = () => `m${Date.now().toString(36)}${(uid += 1)}`;
const W = (time, o = {}) => ({ id: id(), time, room: '', note: '', season: 'all', auto: false, kahal: false, fri: false, last: false, ...o });
export function defaults() {
  return {
    weekday: {
      shacharisNote: 'הודו +10 מינוט', maarivAfter: 50, defaultRoom: '',
      shacharis: [
        W(F('05:30'), { fri: true }), W(F('06:00'), { room: "חדר ב'", auto: true, fri: true }), W(F('06:30'), { room: "חדר א'", fri: true }),
        W(F('07:00'), { room: "חדר ב'", fri: true }), W(F('07:30'), { room: "חדר א'", kahal: true, fri: true }), W(F('08:00'), { room: "חדר ב'", fri: true }),
        W(F('08:30'), { room: "חדר א'", fri: true }), W(F('09:00'), { room: "חדר ב'", fri: true }), W(F('09:30'), { room: 'למטה', fri: true }),
        W(F('10:00'), { room: "חדר ב'", fri: true }),
      ],
      mincha: [
        W(F('12:45'), { room: "חדר ב'", season: 'winter' }), W(F('13:25'), { room: "חדר ב'" }), W(F('13:45'), { room: "חדר ב'", season: 'summer' }),
        ...['15:00', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'].map((t) => W(F(t), { room: "חדר ב'", auto: !['16:00', '16:30', '17:00', '18:30'].includes(t) })),
        W(R('shkia', 25, 5), { room: "חדר ב'", kahal: true, last: true }),
      ],
      maariv: [
        W(R('shkia', 60, 5), { room: 'למטה', kahal: true, note: 'בערך' }),
        ...['20:00', '20:30', '21:00'].map((t) => W(F(t), { auto: true })),
        ...['21:30', '22:00', '22:30'].map((t) => W(F(t))),
      ],
    },
    shabbos: {
      rows: [
        { id: id(), label: 'מנחה וקבלת שבת', day: 'fri', kind: 'tefila', season: 'winter', time: R('candles', 20), note: '' },
        { id: id(), label: 'מנחה וקבלת שבת', day: 'fri', kind: 'tefila', season: 'summer', time: R('candles', 10), note: '' },
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
    yt: { blocks: YT_BLOCKS() },
    tishrei: { blocks: TISHREI_BLOCKS() },
  };
}
const row = (label, times, o = {}) => ({ id: id(), label, note: '', kind: /שחרית|מנחה|מעריב|נדרי|סליחות/.test(label) ? 'tefila' : 'other', on: 'all', times: times.map((t) => (typeof t === 'string' ? F(t) : t)), ...o });
const block = (title, when, rows) => ({ id: id(), title, when, rows });
function TISHREI_BLOCKS() {
  return [
    block('סליחות - יום א\'', 'selichos1', [row('סליחות', ['05:00'])]),
    block('סליחות - שאר הימים', 'selichos', [row('מניני סליחות', ['05:10', '05:35', '06:40', '07:00', '07:35', '08:00', '08:30', '09:00', '09:30'])]),
    block('ערב ראש השנה - יומא דהילולא', 'erevRH', [row('סעודת הילולא', ['20:30'], { on: -1, note: 'ליל ערב ר"ה' }), row('סליחות זכור ברית', ['05:00']), row('מנחה', ['19:20'], { note: 'ומעריב של ר"ה' })]),
    block('ראש השנה', 'rh', [row('שחרית', ['07:45']), row('תקיעת שופר', ['12:30'], { note: 'יום ב\' דר"ה: בערך', on: 1 }), row('מנחה', ['19:20'])]),
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
function YT_BLOCKS() {
  return [
    block('חנוכה', 'chanuka', empty(['שחרית', 'מנחה', 'הדלקת נר חנוכה'])),
    block('עשרה בטבת', 'asaraTeves', empty(['שחרית', 'מנחה'])),
    block('תענית אסתר', 'taanisEsther', empty(['שחרית', 'מנחה', 'קריאת המגילה'])),
    block('פורים', 'purim', empty(['קריאת המגילה (בלילה)', 'שחרית', 'קריאת המגילה', 'מנחה'])),
    block('ערב פסח', 'erevPesach', empty(['שחרית', 'סוף זמן אכילת חמץ', 'סוף זמן שריפת חמץ', 'מנחה'])),
    block('פסח', 'pesach', empty(['שחרית', 'מנחה'])),
    block('חול המועד פסח', 'cholPesach', empty(['שחרית', 'מנחה'])),
    block('שביעי ואחרון של פסח', 'shviiPesach', empty(['שחרית', 'מנחה'])),
    block('ל"ג בעומר', 'lagBaomer', empty(['שחרית', 'הדלקה'])),
    block('ערב שבועות', 'erevShavuos', empty(['שחרית', 'מנחה'])),
    block('שבועות', 'shavuos', empty(['שחרית', 'מנחה'])),
    block('י"ז בתמוז', 'tamuz17', empty(['שחרית', 'מנחה'])),
    block('תשעה באב', 'tishaBav', empty(['מעריב ואיכה', 'שחרית', 'מנחה'])),
  ];
}

// ---------- וואנען איז יעדער בלאק (פון א אידיש יאר) ----------
export const WHEN = {
  tishrei: [['selichos1', 'סליחות - יום א\''], ['selichos', 'סליחות - שאר הימים'], ['erevRH', 'ערב ראש השנה'], ['rh', 'ראש השנה'], ['aseres', 'עשרת ימי תשובה'],
    ['yud3', 'י"ג מדות'], ['shuva', 'שבת תשובה'], ['erevYK', 'ערב יום הכיפורים'], ['yk', 'יום הכיפורים'], ['sukkos', 'חג הסוכות'], ['cholSukkos', 'חול המועד סוכות'],
    ['hoshana', 'הושענא רבה'], ['shmini', 'שמיני עצרת ושמחת תורה'], ['bereishis', 'שבת בראשית']],
  yt: [['chanuka', 'חנוכה'], ['asaraTeves', 'עשרה בטבת'], ['taanisEsther', 'תענית אסתר'], ['purim', 'פורים'], ['erevPesach', 'ערב פסח'], ['pesach', 'פסח (ב\' ימים)'],
    ['cholPesach', 'חול המועד פסח'], ['shviiPesach', 'שביעי ואחרון של פסח'], ['lagBaomer', 'ל"ג בעומר'], ['erevShavuos', 'ערב שבועות'], ['shavuos', 'שבועות'],
    ['tamuz17', 'י"ז בתמוז'], ['tishaBav', 'תשעה באב']],
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
  const ok = (r) => inSeason(r.season, iso) && (!fri || r.fri);
  const mk = (r) => ({ min: timeOf(r.time, zd), room: r.room || w.defaultRoom || '', note: r.note || '', kahal: !!r.kahal, last: !!r.last });
  const valid = (g, x) => x.min != null && (!x.auto || (g === 'shacharis' ? x.min >= zd.alos : g === 'mincha' ? x.min <= zd.shkia : x.min >= zd.shkia + (Number(w.maarivAfter) || 50)));
  const out = {};
  for (const g of ['shacharis', 'mincha', 'maariv']) {
    out[g] = (w[g] || []).filter(ok).map((r) => ({ ...mk(r), auto: r.auto })).filter((x) => valid(g, x)).sort((a, b) => a.min - b.min);
  }
  const lastRow = (w.mincha || []).find((r) => r.last && inSeason(r.season, iso));
  out.last = lastRow ? timeOf(lastRow.time, zd) : null;
  if (out.last != null) out.mincha = out.mincha.filter((x) => x.min <= out.last);
  out.shacharisNote = w.shacharisNote || '';
  return out;
}
const avosSeason = (n) => { const x = hdOf(n); return ['Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'].includes(x.m) || (x.m === 'Nisan' && x.d > 22); };
/** שבת: fri = n פון ערב שבת. גיט [{ label, min, kind, note, day }] אין סדר, מיט הדלקת נרות פאראויס */
export function computeShabbos(data, fri, loc) {
  const zf = dayZ(isoOf(fri), loc); const zs = dayZ(isoOf(fri + 1), loc); const iso = isoOf(fri);
  const rows = [{ label: 'הדלקת נרות', min: zf.candles, kind: 'zman', note: '', day: 'fri' }];
  for (const r of data.shabbos.rows || []) {
    if (r.season === 'avos' ? !avosSeason(fri + 1) : !inSeason(r.season, iso)) continue;
    rows.push({ label: r.label, min: timeOf(r.time, r.day === 'sat' ? zs : zf), kind: r.kind, note: r.note || '', day: r.day });
  }
  return rows; // אין דעם סדר וואס מ'האט באשטימט
}
/** בלאקן (תשרי + יו"ט) וואס האבן עפעס אויף טאג n (אויך ערב: on = -1). גיט [{ title, rows:[{label,note,kind,mins:[..]}] }] */
export function computeSpecial(data, n, loc) {
  const zd = dayZ(isoOf(n), loc); const out = [];
  const x = hdOf(n);
  for (const part of ['tishrei', 'yt']) {
    for (const b of data[part]?.blocks || []) {
      for (const Y of [x.y, x.y + 1, x.y - 1]) {
        const ds = daysOf(b.when, Y);
        if (!ds.length) continue;
        const rows = (b.rows || []).filter((r) => {
          if (r.on === 'all' || r.on == null) return ds.includes(n);
          if (r.on === 'wed') return ds.includes(n) && dowOf(n) === 3;
          const i = Number(r.on);
          return i < 0 ? ds[0] + i === n : ds[i] === n;
        }).map((r) => ({ label: r.label, note: r.note, kind: r.kind, mins: (r.times || []).map((t) => timeOf(t, zd)).filter((m) => m != null) }));
        if (rows.length) { out.push({ title: b.title, rows }); break; }
      }
    }
  }
  return out;
}
export { nOf, isoOf };
