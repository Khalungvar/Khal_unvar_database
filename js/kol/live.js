// 📻 קול אונגוואר — תוכן "חי" למייל: "שהשמחה במעונם" + "זמני שבת קודש / יום טוב".
// אותו מקור ואותו חישוב כמו דף הבית של האתר (js/public/home.js): גיליון התצוגה (פומבי, gviz) —
// ShulConfig / Minyanim / RebbeAway / Simchos. רק זמני שבת וחג (לא ימות החול).
// בעריכה — מה שעדכני ליום הפרסום (היום); בפרסום — התוכן ננעל בתוך המייל (b.snap).
import { buildYear, isoOf, nOf, dowOf, hdOf } from '../luach/engine.js?v=700';
import { zmanim, hhmm } from '../luach/zmanim.js?v=700';
import { defaults, normData, computeSpecial, computeHoly, chagOn } from '../luach/minyanim.js?v=700';
import { SHULS, DEFAULT_SHUL, normShul, applyShul } from '../luach/shul.js?v=700';
import { isoToHebrewText } from '../hebdate.js?v=700';

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
  return SIMCHOS.filter((x) => !x.until || x.until > at).map((x) => ({ id: String(x.id), html: clean(x.html) }));
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
    g.rows.push({ key: `${r.abs}|${r.label}`, label: r.label, note: r.note || '', times: [r.min, ...(r.more || [])].map(tm).join(' · ') });
  });
  return { title, sub, groups, chag: chag.length > 0 };
}

// ---------- מה שיוצא בפועל: החישוב + שינויים במייל (b) + שורות קבועות (P) ----------
export const DEF_SH_TITLE = 'זמני שבת קודש {פרשת השבוע}';
export const DEF_SH_SUB = 'בצל כ"ק מרן אדמו"ר שליט"א';
const plain = (x) => h(String(x || '')).replace(/\n/g, '<br>');
/** זמני שבת אחרי עריכה: { title, sub, groups:[{day, rows:[{label, note, times}]}] } */
export function composeShabbos(S, b = {}, P = {}) {
  const over = b.over || {};
  const extras = [...(P.extra || []).map((x) => ({ ...x, perm: true })), ...(b.extra || [])].filter((x) => x.label || x.time);
  const groups = (S?.groups || []).map((g) => ({ day: g.day, rows: g.rows.filter((r) => !over[r.key]?.hide).map((r) => ({ ...r, label: over[r.key]?.label ?? r.label, times: over[r.key]?.time ?? r.times })) }));
  if (!groups.length) groups.push({ day: '', rows: [] });
  // שורה נוספת: אחרי השורה שנבחרה (לפי השם בחישוב), אחרת — בסוף
  extras.forEach((x) => {
    const row = { label: x.label || '', note: '', times: x.time || '', extra: true };
    let put = false;
    // after = השם המקורי של השורה בחישוב (גם לשורה קבועה — השם לא משתנה משבוע לשבוע)
    if (x.after) for (const g of groups) { const i = g.rows.findIndex((r) => r.key && r.key.slice(r.key.indexOf('|') + 1) === x.after); if (i >= 0) { g.rows.splice(i + 1, 0, row); put = true; break; } }
    if (!put) groups[groups.length - 1].rows.push(row);
  });
  const title = b.title ?? P.title ?? (S?.chag ? S.title : DEF_SH_TITLE);
  return { title, sub: b.sub ?? P.sub ?? DEF_SH_SUB, groups: groups.filter((g) => g.rows.length) };
}
/** השמחות אחרי עריכה: [{html}] */
export function composeSimchos(list, b = {}, P = {}) {
  const over = b.over || {};
  return [
    ...list.filter((x) => !over[x.id]?.hide).map((x) => ({ html: over[x.id]?.text != null ? plain(over[x.id].text) : x.html })),
    ...[...(P.extra || []), ...(b.extra || [])].filter((x) => String(x.text || '').trim()).map((x) => ({ html: plain(x.text) })),
  ];
}

// ---------- העיצוב (HTML, סגנון בשורה) — אותו דבר בתצוגה ובצריבה לתמונה ----------
export const BOX_W = 568;
const SERIF = "'Livorno','Frank Ruhl Libre','Times New Roman',serif";
const BLUE = '#1b2f5e';
const frame = (inner) => `<div dir="rtl" style="width:${BOX_W}px;box-sizing:border-box;margin:0 auto;border:6px solid ${BLUE};outline:2px solid #b9bec9;outline-offset:-12px;border-radius:4px;background:#fdfcf8;padding:16px 22px 18px;font-family:${SERIF};color:#1d1d1d;text-align:center">${inner}</div>`;

export function shabbosBox(C, e, fillTags) {
  if (!C || !C.groups.length) return '';
  const row = (r) => `<tr><td style="padding:5px 4px;font-family:${SERIF};font-size:22px;text-align:right;border-bottom:1px dotted #b9a982">${h(r.label)}${r.note ? ` <span style="font-size:16px;color:#6b6457">(${h(r.note)})</span>` : ''}</td>
    <td style="padding:5px 4px;font-family:${SERIF};font-size:24px;font-weight:700;text-align:left;white-space:nowrap;direction:ltr;border-bottom:1px dotted #b9a982">${h(r.times)}</td></tr>`;
  const body = C.groups.map((g) => `${g.day ? `<tr><td colspan="2" style="padding:12px 4px 4px;font-family:${SERIF};font-size:20px;font-weight:700;color:${BLUE};text-align:right">${h(g.day)}</td></tr>` : ''}${g.rows.map(row).join('')}`).join('');
  return frame(`<div style="font-family:${SERIF};font-size:34px;font-weight:900;color:${BLUE};line-height:1.2">${h(fillTags(C.title, e))}</div>
    ${C.sub ? `<div style="font-family:${SERIF};font-size:20px;color:#7a1f1f;padding:2px 0 8px">${h(fillTags(C.sub, e))}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:4px">${body}</table>`);
}
export function simchosBox(items, site) {
  if (!items.length) return '';
  return frame(`<img src="${site}/img/display/simcha-head.jpg" alt="שהשמחה במעונם" width="${BOX_W - 56}" style="display:block;width:100%;height:auto;margin:0 auto 6px">
    ${items.map((x, i) => `<div style="font-family:${SERIF};font-size:21px;line-height:1.45;padding:7px 4px;${i ? 'border-top:1px dashed #c9bfa5;' : ''}">${x.html}</div>`).join('')}`);
}
/** טקסט פשוט (לגרסת הטקסט של המייל ול-alt של התמונה) */
export const boxText = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|tr|p)>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

// ---------- צריבה לתמונה (בפרסום / בניסיון) ----------
const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
let fontCss = null;
async function fonts() {
  if (fontCss != null) return fontCss;
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700;900&display=block')).text();
    const blocks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/).filter((b) => /^\/\*\s*(hebrew|latin)\s*\*\//.test(b));
    fontCss = (await Promise.all(blocks.map(async (b) => { const m = /url\((https:[^)]+)\)/.exec(b); if (!m) return ''; try { return b.replace(m[1], await toDataUrl(await (await fetch(m[1])).blob())); } catch { return ''; } }))).join('\n');
  } catch { fontCss = ''; }
  return fontCss;
}
/** HTML של קופסה → JPEG (dataUrl), ברוחב BOX_W ×2 */
export async function boxToJpeg(html) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;left:-10000px;top:0;width:${BOX_W}px;background:#fff`;
  wrap.innerHTML = html;
  document.body.append(wrap);
  try {
    await Promise.all([...wrap.querySelectorAll('img')].map(async (img) => { try { img.src = await toDataUrl(await (await fetch(img.src)).blob()); } catch { img.remove(); } }));
    await Promise.all([...wrap.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
    await document.fonts?.ready;
    const H = Math.ceil(wrap.getBoundingClientRect().height) + 2;
    const css = await fonts();
    const body = new XMLSerializer().serializeToString(wrap.firstElementChild);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BOX_W}" height="${H}"><foreignObject x="0" y="0" width="${BOX_W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${BOX_W}px;background:#fff"><style>${css.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>${body}</div></foreignObject></svg>`;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('לא הצלחתי לצרוב את הקופסה לתמונה')); });
    await new Promise((r) => setTimeout(r, 200));
    const k = 2; const cv = document.createElement('canvas'); cv.width = BOX_W * k; cv.height = H * k;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
    // חותכים את הלבן שנשאר למטה (המדידה לא תמיד מדויקת)
    const px = g.getImageData(0, 0, cv.width, cv.height).data;
    let last = cv.height - 1;
    const white = (y) => { for (let x = 0; x < cv.width; x += 3) { const i = (y * cv.width + x) * 4; if (px[i] < 245 || px[i + 1] < 245 || px[i + 2] < 245) return false; } return true; };
    while (last > 10 && white(last)) last -= 1;
    if (last < cv.height - 1) {
      const out = document.createElement('canvas'); out.width = cv.width; out.height = last + 1;
      out.getContext('2d').drawImage(cv, 0, 0);
      return out.toDataURL('image/jpeg', 0.9);
    }
    return cv.toDataURL('image/jpeg', 0.9);
  } finally { wrap.remove(); }
}
