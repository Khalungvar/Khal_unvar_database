// 📻 קול אונגוואר — תוכן "חי" למייל: "שהשמחה במעונם" + "זמני שבת קודש / יום טוב".
// אותו מקור ואותו חישוב כמו דף הבית של האתר (js/public/home.js): גיליון התצוגה (פומבי, gviz) —
// ShulConfig / Minyanim / RebbeAway / Simchos. רק זמני שבת וחג (לא ימות החול).
// בעריכה — מה שעדכני ליום הפרסום (היום); בפרסום — התוכן ננעל בתוך המייל (b.snap).
import { buildYear, isoOf, nOf, dowOf, hdOf } from '../luach/engine.js?v=699';
import { zmanim, hhmm } from '../luach/zmanim.js?v=699';
import { defaults, normData, computeSpecial, computeHoly, chagOn } from '../luach/minyanim.js?v=699';
import { SHULS, DEFAULT_SHUL, normShul, applyShul } from '../luach/shul.js?v=699';
import { isoToHebrewText } from '../hebdate.js?v=699';

const SHEET = SHULS[DEFAULT_SHUL].sheetId;
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tm = (m) => (m == null ? '' : hhmm(((m % 1440) + 1440) % 1440));
const DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת קודש'];

function parseCsv(t) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i += 1; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
async function tab(name) {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}&headers=1&t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`gviz ${r.status}`);
  return parseCsv(await r.text());
}
const partsJson = (rows) => {
  const parts = (rows || []).filter((x) => /^data#\d+$/.test(x[0] || '')).sort((a, b) => Number(a[0].split('#')[1]) - Number(b[0].split('#')[1]));
  try { return parts.length ? JSON.parse(parts.map((x) => x[1] || '').join('')) : null; } catch { return null; }
};

let DATA = normData(defaults()); let LOC = applyShul(normShul(null, DEFAULT_SHUL)); let SIMCHOS = [];
let loaded = null;
/** טוען פעם אחת (או מחדש עם force) */
export function loadLive(force = false) {
  if (loaded && !force) return loaded;
  loaded = (async () => {
    const [cfg, min, away, sim] = await Promise.all(['ShulConfig', 'Minyanim', 'RebbeAway', 'Simchos'].map((n) => tab(n).catch(() => null)));
    const c = partsJson(cfg); if (c && c.kind === 'shul') LOC = applyShul(normShul(c, DEFAULT_SHUL));
    const m = partsJson(min); if (m) DATA = normData({ ...defaults(), ...m });
    if (away && away[0]?.[0] === 'from') {
      const dt = (v) => { const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); if (a) return a[0]; const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v || ''); return b ? `${b[3]}-${b[1].padStart(2, '0')}-${b[2].padStart(2, '0')}` : ''; };
      DATA.rebbeAway = away.slice(1).map((x) => ({ from: dt(x[0]), to: dt(x[1]) })).filter((x) => x.from && x.to);
    }
    if (sim && sim[0]?.[0] === 'simcha_id') SIMCHOS = sim.slice(1).filter((x) => x[0] && x[1]).map((x) => ({ id: x[0], html: x[1], until: Number(x[2]) || 0 }));
    return true;
  })().catch((err) => { loaded = null; throw err; });
  return loaded;
}

// שמחות — רק תגיות בטוחות (הטקסט מגיע מהגיליון)
const OK_TAG = new Set(['DIV', 'B', 'STRONG', 'I', 'EM', 'SPAN', 'BR', 'SMALL', 'U']);
function clean(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  const walk = (el) => [...el.childNodes].forEach((c) => {
    if (c.nodeType === 1) {
      if (!OK_TAG.has(c.tagName)) { c.replaceWith(document.createTextNode(c.textContent)); return; }
      [...c.attributes].forEach((a) => c.removeAttribute(a.name));
      walk(c);
    } else if (c.nodeType !== 3) c.remove();
  });
  walk(t.content);
  return t.innerHTML;
}

/** השמחות שמוצגות ברגע הזה (כמו באתר ובמסך) */
export function simchosList(at = Date.now()) {
  return SIMCHOS.filter((x) => !x.until || x.until > at).map((x) => clean(x.html));
}

const yc = new Map();
function dayOf(n) {
  const Y = hdOf(n).y;
  for (const y of [Y, Y + 1]) {
    const k = `${y}|${LOC.key}`;
    if (!yc.has(k)) yc.set(k, buildYear(y, {}, { loc: LOC }));
    const d = yc.get(k).days.find((x) => x.n === n);
    if (d) return d;
  }
  return null;
}
const hebDate = (iso) => isoToHebrewText(iso).replace(/\s*לפ"ק$/, '');

/**
 * זמני השבת (או יום טוב) הקרובה — בדיוק כמו "זמני שבת קודש" בדף הבית.
 * at: הרגע (יום הפרסום). מחזיר { title, sub, groups: [{ day, rows: [{label, note, times}] }] }
 */
export function shabbosTimes(at = new Date()) {
  const d = at instanceof Date ? at : new Date(at);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const n0 = nOf(iso); const nowMin = d.getHours() * 60 + d.getMinutes();
  const holy = (x) => dowOf(x) === 6 || chagOn(DATA, x);
  const spanFrom = (s0) => { let st = s0; while (!holy(st)) st += 1; let en = st; while (holy(en + 1)) en += 1; return [st, en]; };
  let st; let en;
  if (holy(n0)) { st = n0; while (holy(st - 1)) st -= 1; en = n0; while (holy(en + 1)) en += 1; if (n0 === en && nowMin > zmanim(isoOf(en), LOC).motzei + 60) [st, en] = spanFrom(n0 + 1); }
  else [st, en] = spanFrom(n0 + 1);
  const eve = st - 1;
  const seen = new Set(); const rows = [];
  for (let k = eve; k < en; k += 1) {
    computeHoly(DATA, k, LOC).filter((r) => r.place === 'shab' && r.screen !== false && r.min != null).forEach((r) => {
      const day = k + (r.day || 0); const key = `${day}|${r.label}|${r.min}`;
      if (seen.has(key)) return; seen.add(key); rows.push({ ...r, abs: day });
    });
  }
  rows.sort((a, b) => a.abs - b.abs || a.min - b.min);
  const chag = [];
  for (let k = st; k <= en; k += 1) if (chagOn(DATA, k)) chag.push(k);
  let title = 'זמני שבת קודש';
  if (chag.length) {
    const nm = [eve, ...chag].map((k) => computeSpecial(DATA, k, LOC).find((bk) => bk.type === 'chag')?.title).find(Boolean)
      || dayOf(chag[0])?.items.find((i) => i.kind === 'hol' && i.yt)?.text || '';
    title = `זמני יום טוב${nm ? ` - ${nm}` : ''}`;
  }
  let sat = st; while (sat <= en && dowOf(sat) !== 6) sat += 1;
  const parsha = sat <= en ? (dayOf(sat)?.parsha ? `פרשת ${dayOf(sat).parsha}` : dayOf(sat)?.items?.find((i) => i.kind === 'hol')?.text || '') : '';
  const sub = [parsha, hebDate(isoOf(st)) + (en > st ? ` – ${hebDate(isoOf(en))}` : '')].filter(Boolean).join(' · ');
  const multi = en > st;
  const groups = [];
  rows.forEach((r) => {
    const label = multi ? `${DAYS[dowOf(r.abs)]} ${hebDate(isoOf(r.abs))}` : '';
    let g = groups[groups.length - 1];
    if (!g || g.day !== label) { g = { day: label, rows: [] }; groups.push(g); }
    g.rows.push({ label: r.label, note: r.note || '', times: [r.min, ...(r.more || [])].map(tm).join(' · ') });
  });
  return { title, sub, groups };
}

// ---------- HTML למייל (טבלאות, סגנון בשורה) ----------
const box = (font, inner) => `<tr><td dir="rtl" style="padding:8px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e3dccb;border-radius:6px;background:#fbf8f1">${inner}</table></td></tr>`;
const head = (font, t, sub) => `<tr><td dir="rtl" align="center" style="padding:12px 12px 4px;font-family:${h(font)};font-size:20px;font-weight:bold;color:#7a1f1f">${h(t)}</td></tr>${sub ? `<tr><td dir="rtl" align="center" style="padding:0 12px 6px;font-family:${h(font)};font-size:14px;color:#6b6457">${h(sub)}</td></tr>` : ''}`;

export function simchosHtml(list, font) {
  if (!list.length) return '';
  return box(font, head(font, 'שהשמחה במעונם', '')
    + list.map((x) => `<tr><td dir="rtl" align="center" style="padding:6px 14px;font-family:${h(font)};font-size:16px;line-height:1.5;color:#1d1d1d;border-top:1px dashed #e3dccb">${x}</td></tr>`).join('')
    + '<tr><td style="height:8px;font-size:1px">&nbsp;</td></tr>');
}
export function shabbosHtml(S, font) {
  if (!S || !S.groups.length) return '';
  const row = (r) => `<tr><td dir="rtl" style="padding:3px 6px;font-family:${h(font)};font-size:16px;color:#1d1d1d">${h(r.label)}${r.note ? ` <span style="font-size:13px;color:#6b6457">(${h(r.note)})</span>` : ''}</td>
    <td dir="ltr" align="left" style="padding:3px 6px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#1d1d1d;white-space:nowrap">${h(r.times)}</td></tr>`;
  const body = S.groups.map((g) => `${g.day ? `<tr><td colspan="2" dir="rtl" style="padding:8px 6px 2px;font-family:${h(font)};font-size:15px;font-weight:bold;color:#7a1f1f;border-bottom:1px solid #e3dccb">${h(g.day)}</td></tr>` : ''}${g.rows.map(row).join('')}`).join('');
  return box(font, head(font, S.title, S.sub)
    + `<tr><td style="padding:4px 12px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr>`);
}
