// אתר פון א מוסד — וואס פאר א טאג איז עס לויטן לוח העברי (פאר שכר לפי ימי עבודה):
// שבת, יום טוב, חול המועד, ימי דפגרא (ר"ח, חנוכה, פורים …), תעניות, בין הזמנים.
// ארץ ישראל / חוץ לארץ — לויט דער הגדרה פונעם מוסד (איין טאג יו"ט אין א"י).
import { buildYear, hdOf, nOf } from '../luach/engine.js';
import { LOCATIONS } from '../luach/zmanim.js';
import { toHebrew, fromHebrew, monthHe, yearLabel } from '../hebdate.js?v=533';

const cache = new Map();
function dayRow(iso, il) {
  const n = nOf(iso); const Y = hdOf(n).y;
  const key = `${Y}|${il ? 1 : 0}`;
  if (!cache.has(key)) cache.set(key, new Map(buildYear(Y, {}, { loc: il ? LOCATIONS.jlm : LOCATIONS.bp }).days.map((d) => [d.n, d])));
  return cache.get(key).get(n) || null;
}
const DPG = /ראש חודש|חנוכה|לאילנות|פורים|פסח שני|ל"ג בעומר|ט"ו באב|אסרו חג/;
const FAST = /תענית|צום|תשעה באב/;
/** בין הזמנים (ברירת מחדל): ניסן; י' אב – סוף אב; י"א תשרי – סוף תשרי */
export function isBein(iso) {
  const h = toHebrew(iso); if (!h) return false;
  if (h.m === 'Nisan') return true;
  if (h.m === 'Av' && h.d >= 10) return true;
  if (h.m === 'Tishri' && h.d >= 11) return true;
  return false;
}
/** { dow, shab, yt, chm, dpg, fast, bein, text } */
export function dayInfo(iso, il = true) {
  const d = dayRow(iso, il);
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  const hol = (d?.items || []).filter((i) => i.kind === 'hol');
  const yt = hol.some((i) => i.yt);
  const chm = !yt && hol.some((i) => i.chm);
  const txt = hol.map((i) => i.text).join(', ');
  return { dow, shab: dow === 6, yt, chm, dpg: !yt && !chm && hol.some((i) => DPG.test(i.text)), fast: hol.some((i) => FAST.test(i.text)), bein: isBein(iso), text: txt };
}
// די כללים פון א עובד: { dows: [0..6], yt, chm, dpg, fast, bein } — true = דער טאג ווערט גערעכנט
export const DAY_RULES_DEF = { dows: [0, 1, 2, 3, 4], yt: false, chm: false, dpg: true, fast: true, bein: false };
export function rulesOf(sched) {
  let r = sched;
  if (typeof sched === 'string') { try { r = JSON.parse(sched || '{}'); } catch { r = {}; } }
  if (!r || Array.isArray(r)) r = {};
  return { ...DAY_RULES_DEF, ...r, dows: Array.isArray(r.dows) ? r.dows.map(Number) : DAY_RULES_DEF.dows };
}
/** צי א טאג איז א טאג פון ארבעט לויט די כללים */
export function isWorkDay(iso, rules, il = true) {
  const r = rulesOf(rules); const x = dayInfo(iso, il);
  if (!r.dows.includes(x.dow)) return false;
  if (x.yt && !r.yt) return false;
  if (x.chm && !r.chm) return false;
  if (x.dpg && !r.dpg) return false;
  if (x.fast && !r.fast) return false;
  if (x.bein && !r.bein) return false;
  return true;
}
const HDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export function rulesText(sched) { return `ימים: ${rulesOf(sched).dows.map((d) => HDAYS[d]).join(' ')}`; }
/** דער חודש העברי פון א טאג: { label, from, to } */
export function hebMonthOf(iso) {
  const hd = toHebrew(iso); if (!hd) return null;
  const from = fromHebrew(1, hd.m, hd.y);
  const add = (x, n) => { const d = new Date(`${x}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  let to = from; while (toHebrew(add(to, 1))?.m === hd.m) to = add(to, 1);
  return { label: `${monthHe(hd.m)} ${yearLabel(hd.y)}`, from, to };
}
