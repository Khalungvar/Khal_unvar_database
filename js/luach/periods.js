// פסח און תשרי: א לוח פון טעג (data.pesach / data.tishrei) → "חלקים" פאר דער תצוגה (V "כאן התצוגה מתחלקת")
// און פאר די אויטאמאטישע הודעות (V "כאן ההודעה מתחלקת"). יעדער טאג: זיינע שורות + "כמו ביום חול" + "כמו שבת רגילה" + שולחן הטהור ודרשות.
import { daysOf, timeOf, dayZ, computeWeekday, computeShabbos, eventsBetween, chagOn, isoOf, nOf } from './minyanim.js';
import { hdOf, dowOf, buildYear } from './engine.js';
import { hebrewNumber, monthHe } from '../hebdate.js';

const GN = { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' };
const DN = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", 'ש"ק'];
const yc = new Map();
function parshaOf(n) {
  const Y = hdOf(n).y;
  for (const y of [Y, Y + 1]) { if (!yc.has(y)) yc.set(y, buildYear(y, {}, {})); const d = yc.get(y).days.find((x) => x.n === n); if (d) return d.parsha || ''; }
  return '';
}
/** די טעג פון א שורה (ווי אין computeSpecial) */
function rowDays(r, ds) {
  if (r.on === 'all' || r.on == null) return ds;
  if (r.on === 'wed') return ds.filter((n) => dowOf(n) === 3);
  if (r.on === 'fri') return ds.filter((n) => dowOf(n) === 5);
  if (r.on === 'last') return [ds[ds.length - 1]];
  const i = Number(r.on);
  if (i < 0) return [ds[0] + i];
  return ds[i] != null ? [ds[i]] : [];
}
export const dayLabel = (n) => { const x = hdOf(n); return `${DN[dowOf(n)]} ${hebrewNumber(x.d)} ${monthHe(x.m)}`; };
/** דער כותרת פון א טאג: "..." → די פרשה */
function titleOf(b, ds) {
  let t = String(b.title || '');
  if (t.includes('...')) { const sat = ds.find((n) => dowOf(n) === 6); const p = sat != null ? parshaOf(sat) : ''; t = p ? t.replace('...', p) : t.replace(/\s*\.\.\.\s*/, ' '); }
  return t.trim();
}
const cache = new WeakMap();
/** נאך א שינוי אין די דאטן ("זמני תפילות") */
export const clearPeriodCache = (data) => cache.delete(data);
/** די טעג (סעקציעס) פון פסח/תשרי אין יאר Y, לויט דער צייט. יעדע: { b, ds, title, dates, lines: [{ label, kind, note, screen, per: [{ n, mins }] }], last } */
export function periodSections(data, part, Y, loc) {
  let c = cache.get(data); if (!c) { c = new Map(); cache.set(data, c); }
  const key = `${part}|${Y}`; if (c.has(key)) return c.get(key);
  const secs = [];
  (data[part]?.blocks || []).forEach((b, bi) => {
    const ds = daysOf(b.when, Y).filter((n) => n != null); if (!ds.length) return;
    const lines = [];
    const shabIn = new Set();
    // כמו שבת רגילה: די זמנים פון לשונית שבת (אויך שולחן הטהור ודרשות אין דער שבת)
    if (b.likeShab) {
      for (const s of ds.filter((n) => dowOf(n) === 6)) {
        shabIn.add(s); shabIn.add(s - 1);
        for (const r of computeShabbos(data, s - 1, loc)) if (r.min != null) lines.push({ label: r.label, kind: r.kind, note: r.note || '', screen: r.screen !== false, per: [{ n: r.day === 'sat' ? s : s - 1, mins: [r.min] }] });
      }
    }
    for (const r of b.rows || []) {
      const per = rowDays(r, ds).map((n) => {
        const v = r.sat?.on && dowOf(n) === 6 ? r.sat : r.fri?.on && dowOf(n) === 5 ? r.fri : null;
        const z = dayZ(isoOf(n), loc);
        return { n, label: (v && v.label) || '', mins: ((v ? v.times : r.times) || []).map((T) => timeOf(T, z)).filter((m) => m != null).sort((a, x) => a - x) };
      }).filter((p) => p.mins.length);
      if (per.length) lines.push({ label: per.find((p) => p.label)?.label || r.label, kind: r.kind || 'tefila', note: r.note || '', screen: r.screen !== false, per });
    }
    // כמו ביום חול
    for (const g of ['shacharis', 'mincha', 'maariv']) {
      if (!b.wk?.[g]) continue;
      // מעריב פון א ערב יו"ט / ערב שבת — דאס איז שוין פונעם חג/שבת
      const per = ds.filter((n) => dowOf(n) !== 6 && !(g !== 'shacharis' && dowOf(n) === 5) && !(g === 'maariv' && chagOn(data, n + 1))).map((n) => ({ n, mins: computeWeekday(data, n, loc, dowOf(n) === 5 ? { ytOnly: true } : { plain: true })[g].map((m) => m.min).filter((m) => m != null).sort((a, x) => a - x) })).filter((p) => p.mins.length);
      if (per.length) lines.push({ label: GN[g], kind: 'tefila', note: '', screen: true, wk: true, per });
    }
    // שולחן הטהור ודרשות אין די טעג (נישט וואס איז שוין אין "כמו שבת רגילה")
    for (const e of eventsBetween(data, ds[0] - 1, ds[ds.length - 1], loc)) {
      for (const r of e.rows) {
        if (!ds.includes(r.day) && !(r.day === ds[0] - 1 && e.n === ds[0])) continue;
        if (shabIn.has(r.day)) continue;
        lines.push({ label: r.label, kind: 'event', note: '', screen: true, per: [{ n: r.day, mins: [r.min] }] });
      }
    }
    const abs = (l) => Math.min(...l.per.map((p) => p.n * 1440 + p.mins[0]));
    lines.sort((a, x) => abs(a) - abs(x));
    const all = lines.flatMap((l) => l.per.flatMap((p) => p.mins.map((m) => p.n * 1440 + m)));
    const dates = ds.length === 1 ? dayLabel(ds[0]) : `${dayLabel(ds[0])} – ${dayLabel(ds[ds.length - 1])}`;
    const first = Math.min(ds[0], ...lines.flatMap((l) => l.per.map((p) => p.n)));
    secs.push({ b, bi, ds, first, title: titleOf(b, ds), dates, lines, last: all.length ? Math.max(...all) : (ds[ds.length - 1] + 1) * 1440 - 1 });
  });
  secs.sort((a, x) => a.ds[0] - x.ds[0] || a.bi - x.bi);
  c.set(key, secs);
  return secs;
}
/** חלקים: נאך יעדן טאג וואס האט V (splitD = תצוגה, splitM = הודעה). { secs, first (טאג), end (אבסאלוט מינוט + 30) } */
export function segments(secs, flag) {
  const out = []; let cur = [];
  for (const s of secs) { cur.push(s); if (s.b[flag]) { out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  return out.map((list) => ({ secs: list, first: Math.min(...list.map((s) => s.first)), end: Math.max(...list.map((s) => s.last)) + 30 }));
}
const yearsFor = (part, n) => { const x = hdOf(n); return part === 'tishrei' ? (x.m === 'Elul' ? [x.y + 1] : [x.y, x.y + 1]) : [x.y, x.y + 1]; };
/** וואס איז יעצט (טאג n, מינוט nowMin) — א חלק פון פסח/תשרי אויף דער תצוגה, אדער null */
export function periodNow(data, n, nowMin, loc) {
  const nowAbs = n * 1440 + nowMin;
  for (const part of ['pesach', 'tishrei']) {
    for (const Y of yearsFor(part, n)) {
      const secs = periodSections(data, part, Y, loc); if (!secs.length) continue;
      const start = Math.min(...secs.map((s) => s.ds[0]));
      if (n < start) continue;
      const segs = segments(secs, 'splitD');
      const i = segs.findIndex((s) => s.end >= nowAbs);
      if (i < 0) continue;
      return { part, Y, seg: segs[i], idx: i, count: segs.length };
    }
  }
  return null;
}
/** איז טאג k אין דער צייט פון פסח/תשרי (פון ערשטן ביז לעצטן טאג) — דאן גייען נישט ארויס די הודעות פון שבת און ימות החול */
export function inPeriod(data, k, loc) {
  for (const part of ['pesach', 'tishrei']) {
    for (const Y of yearsFor(part, k)) {
      const secs = periodSections(data, part, Y, loc); if (!secs.length) continue;
      const start = Math.min(...secs.map((s) => s.ds[0])); const end = Math.max(...secs.map((s) => Math.floor(s.last / 1440)));
      if (k >= start && k <= end) return true;
    }
  }
  return false;
}
const holy = (data, k) => dowOf(k) === 6 || chagOn(data, k);
/** די חלקים פאר הודעות (V "כאן ההודעה מתחלקת"), מיט דעם טאג פון שיקן: דער לעצטער וואכנטאג פאר'ן ערשטן טאג */
export function msgSegments(data, part, Y, loc) {
  return segments(periodSections(data, part, Y, loc), 'splitM').map((g) => { let k = g.first - 1; while (holy(data, k)) k -= 1; return { ...g, send: k, part, Y }; });
}
/** דער טעקסט פון א חלק: כותרת פון יעדן טאג, און "שם: שעות" */
export function segText(seg, fmt) {
  const out = [];
  for (const s of seg.secs) {
    const ls = s.lines.filter((l) => l.screen !== false);
    if (!ls.length) continue;
    out.push(`— ${s.title} —`);
    for (const l of ls) {
      const same = l.per.every((p) => p.mins.join() === l.per[0].mins.join());
      if (same) out.push(`${l.label}${l.note ? ` (${l.note})` : ''}: ${l.per[0].mins.map(fmt).join(' · ')}`);
      else for (const p of l.per) out.push(`${l.label} (${DN[dowOf(p.n)]}): ${p.mins.map(fmt).join(' · ')}`);
    }
  }
  return out.join('\n');
}
/** די הודעה פון פסח/תשרי וואס גייט ארויס אויף טאג n (אדער די נאענטסטע ביז 14 טעג) */
export function segFor(data, n, loc, part = null, exact = false) {
  let best = null;
  for (const p of part ? [part] : ['pesach', 'tishrei']) {
    for (const Y of [hdOf(n).y, hdOf(n).y + 1]) {
      for (const g of msgSegments(data, p, Y, loc)) {
        if (exact ? g.send === n : g.send >= n && g.send <= n + 14) { if (!best || g.send < best.send) best = g; }
      }
    }
  }
  return best;
}
export { nOf };
