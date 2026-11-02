// ⚙️ הגדרות בית הכנסת (באתר): שם, שפת התצוגה, מקום ושיטות הזמנים, גרסה, קובץ תצוגה עצמאי.
import { otherSheet } from '../google.js';
import { state, displayName } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { versionStore, openVersions } from '../versions.js';
import { zmanim, hhmm, METHODS } from './zmanim.js';
import { isoOf, nOf, dowOf } from './engine.js';
import { SHULS, DEFAULT_SHUL, CITIES, shulDefaults, normShul, locOf, applyShul, joinParts } from './shul.js';
import { buildStandalone } from './standalone.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const CHUNK = 40000;
const LANGS = [['yi', 'אידיש'], ['he', 'עברית'], ['en', 'English']];

let key = DEFAULT_SHUL; let C = null; let saved = ''; let meta = { at: '', by: '' }; let ui = null; let releases = [];
const sheetId = () => SHULS[key].sheetId;
const sh = () => otherSheet(sheetId());
const VS = () => versionStore('ShulHistory', sheetId());
const canEdit = () => !!(state.isAllowed || state.isAdmin);

// ---------- טעינה ושמירה ----------
let cache = null;
export async function loadShulCfg(force = false) {
  if (cache && !force) return cache;
  let j = null;
  try { const rows = await sh().read('ShulConfig!A2:D50'); j = joinParts(rows); if (rows[0]) meta = { at: String(rows[0][2] || ''), by: String(rows[0][3] || '') }; } catch { /* אין עדיין לשונית */ }
  cache = normShul(j, key); applyShul(cache);
  return cache;
}
async function save(note) {
  const v = JSON.stringify(C); const parts = [];
  for (let i = 0; i < v.length; i += CHUNK) parts.push(v.slice(i, i + CHUNK));
  const stamp = nowStamp();
  try { await sh().clear('ShulConfig!A2:D50'); } catch { await sh().addTab('ShulConfig'); }
  await sh().write(`ShulConfig!A1:D${parts.length + 1}`, [['key', 'value', 'updated_at', 'updated_by'], ...parts.map((p, i) => [`data#${i}`, p, stamp, state.email])]);
  try { await VS().add(C, note, state.email); } catch { try { await sh().addTab('ShulHistory'); await sh().write('ShulHistory!A1:D1', [['version', 'saved_at', 'saved_by', 'note']]); await VS().add(C, note, state.email); } catch { /* */ } }
  cache = normShul(JSON.parse(v), key); applyShul(cache); saved = JSON.stringify(C); meta = { at: stamp, by: state.email };
}
async function loadReleases() {
  try { const r = await fetch(`rel/index.json?t=${Date.now()}`, { cache: 'no-store' }); releases = r.ok ? await r.json() : []; } catch { releases = []; }
}

// ---------- תצוגה מקדימה של הזמנים ----------
function zPreview() {
  const now = new Date(); const n = nOf(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  const fri = n + ((5 - dowOf(n) + 7) % 7);
  const before = locOf(normShul(JSON.parse(saved), key)); const after = locOf(C);
  const rows = [['עלות השחר', 'alos', n], ['נץ החמה', 'neitz', n], ['סוף זמן ק"ש מג"א', 'maKS', n], ['סוף זמן ק"ש גר"א', 'graKS', n], ['חצות', 'chatzos', n], ['שקיעה', 'shkia', n],
    ['הדלקת נרות (ערב שבת)', 'candles', fri], ['מוצאי שבת / ר"ת', 'motzei', fri + 1]];
  const v = (loc, f, d) => { try { return hhmm(zmanim(isoOf(d), loc)[f]); } catch { return '—'; } };
  return `<table class="sh-zt"><thead><tr><th></th><th>עכשיו</th><th>עם השינויים</th></tr></thead><tbody>${rows.map(([l, f, d]) => {
    const a = v(before, f, d); const b = v(after, f, d);
    return `<tr><td>${h(l)}</td><td>${a}</td><td${a !== b ? ' class="sh-chg"' : ''}>${b}</td></tr>`; }).join('')}</tbody></table>`;
}

const sel = (path, opts, cur) => `<select data-p="${path}">${opts.map(([v, l]) => `<option value="${h(v)}"${String(v) === String(cur) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`;
function render(main, onBack) {
  const ed = canEdit(); const dirty = JSON.stringify(C) !== saved; const custom = C.loc.city === 'custom';
  const relOpts = [['', 'תמיד הגרסה האחרונה (מומלץ)'], ...releases.slice().reverse().map((r) => [String(r.n), `גרסה ${r.n} · ${r.date}${r.note ? ` · ${r.note}` : ''}`])];
  main.innerHTML = `<div class="lx-bar"><button type="button" class="btn ghost" id="sh-back">← חזרה</button></div>
  <h2 class="lx-hubh">⚙️ הגדרות בית הכנסת</h2>
  <div class="sh-wrap">
  <section class="sh-sec"><h3>כללי</h3>
    <label>שם בית הכנסת <input data-p="name" value="${h(C.name)}"></label>
    <label>שפת התצוגה במסך ${sel('lang', LANGS, C.lang)}</label>
  </section>
  <section class="sh-sec"><h3>📍 מקום (לחישוב הזמנים)</h3>
    <label>עיר ${sel('loc.city', [...CITIES.map((c) => [c.id, c.name]), ['custom', 'אחר — להזין ידנית']], C.loc.city)}</label>
    ${custom ? `<div class="sh-grid">
      <label>שם המקום <input data-p="loc.name" value="${h(C.loc.name)}"></label>
      <label>קו רוחב (lat) <input data-p="loc.lat" type="number" step="0.0001" value="${h(C.loc.lat)}" dir="ltr"></label>
      <label>קו אורך (lon) <input data-p="loc.lon" type="number" step="0.0001" value="${h(C.loc.lon)}" dir="ltr"></label>
      <label>אזור זמן <input data-p="loc.tz" value="${h(C.loc.tz)}" dir="ltr" placeholder="America/New_York"></label>
      <label>גובה (מטר) <input data-p="loc.elev" type="number" value="${h(C.loc.elev)}" dir="ltr"></label>
    </div>`
    : `<p class="muted small">${h(C.loc.lat)}, ${h(C.loc.lon)} · ${h(C.loc.tz)} · גובה ${h(C.loc.elev)} מ'</p>`}
  </section>
  <section class="sh-sec"><h3>🕰 שיטות הזמנים</h3>
    <label>עלות השחר (וגם סוף היום למג"א) ${sel('z.alos', METHODS.alos, C.z.alos)}</label>
    <label>מוצאי שבת / רבינו תם ${sel('z.motzei', METHODS.motzei, C.z.motzei)}</label>
    <label>הדלקת נרות — דקות לפני השקיעה <input data-p="z.candles" type="number" min="0" max="60" value="${h(C.z.candles)}" style="width:5em"></label>
    <label>נץ ושקיעה ${sel('z.shkia', METHODS.shkia, C.z.shkia)}</label>
    ${C.loc.city === 'bp' ? `<label class="check"><input type="checkbox" data-p="z.table"${C.z.table ? ' checked' : ''}> נץ ושקיעה הנראים לפי טבלת chaitables (בארא פארק)</label>` : ''}
  </section>
  <section class="sh-sec"><h3>👁 הזמנים לפי ההגדרות</h3>${zPreview()}
  </section>
  <section class="sh-sec"><h3 title="תמיד האחרונה — כל עדכון מגיע למסך לבד. נעול — המסך נשאר על הגרסה עד שמשנים כאן. אם משהו השתבש: בוחרים את הקודמת ושומרים.">🔒 גרסה</h3>
    <label>הגרסה שהמסך מריץ ${sel('ver', relOpts, C.ver)}</label>
    <h3 class="sh-h2">📺 מסך התצוגה</h3>
    <div class="sh-row"><a href="display.html?shul=${h(key)}" target="_blank">פתח את המסך ↗</a>
      <button type="button" class="btn small-btn" id="sh-dl" title="קובץ אחד שפותחים במחשב התצוגה (כרום, מסך מלא). עובד גם בלי האתר ובלי אינטרנט; כשהחיבור חוזר הוא מושך עדכון מיד. נעול על הגרסה שהורדה.">⬇ קובץ תצוגה עצמאי</button> <span class="muted small" id="sh-dl-st"></span></div>
  </section>
  </div>
  <div class="sh-bar">${ed ? `<input id="sh-note" placeholder="הערה לגרסה (לא חובה)"><button type="button" class="btn primary" id="sh-save"${dirty ? '' : ' disabled'}>💾 שמירה</button>` : '<span class="muted">צפייה בלבד</span>'}
    <button type="button" class="btn ghost" id="sh-vers">🕘 גרסאות</button>
    <span class="muted small">${meta.at ? `נשמר ${h(meta.at)}${meta.by ? ` ע"י ${h(displayName(meta.by))}` : ''}` : 'עדיין לא נשמר — אלה ברירות המחדל'}</span></div>`;
  $('#sh-back', main).onclick = () => { if (JSON.stringify(C) !== saved && !confirm('יש שינויים שלא נשמרו. לצאת בלי לשמור?')) return; onBack(); };
  $$('[data-p]', main).forEach((el) => {
    el.disabled = !ed;
    el.onchange = () => {
      const p = el.dataset.p.split('.'); let o = C; for (let i = 0; i < p.length - 1; i += 1) o = o[p[i]];
      const last = p[p.length - 1];
      o[last] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      if (el.dataset.p === 'loc.city' && el.value !== 'custom') {
        const c = CITIES.find((x) => x.id === el.value);
        if (c) { C.loc = { city: c.id, name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, elev: c.elev, il: /Jerusalem/.test(c.tz) }; C.z.candles = c.candles; if (c.id !== 'bp') C.z.table = false; }
      }
      render(main, onBack);
    };
  });
  const sv = $('#sh-save', main);
  if (sv) sv.onclick = async () => {
    sv.disabled = true; sv.textContent = 'שומר…';
    try { await save(($('#sh-note', main)?.value || '').trim()); ui?.toast?.('נשמר ✓ — המסך יתעדכן תוך דקה'); } catch (err) { ui?.toast?.(String(err.message || err), 'error'); }
    render(main, onBack);
  };
  $('#sh-vers', main).onclick = () => openVersions({ store: VS(), title: 'גרסאות — הגדרות בית הכנסת', canRestore: canEdit(), nameOf: (x) => displayName(x),
    onRestore: (obj, v) => { C = normShul(obj, key); render(main, onBack); ui?.toast?.(`גרסה ${v} נטענה — לחץ 💾 שמירה`); } });
  $('#sh-dl', main).onclick = async () => {
    const st = $('#sh-dl-st', main); const b = $('#sh-dl', main); b.disabled = true;
    try {
      st.textContent = 'מכין את הקובץ…';
      const html = await buildStandalone({ key, sheetId: sheetId(), cfg: JSON.parse(saved), ver: C.ver || (releases[releases.length - 1]?.n ?? '') });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      a.download = `תצוגה - ${C.name || key}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      st.textContent = '✓ הורד';
    } catch (err) { st.textContent = `שגיאה: ${err.message || err}`; }
    b.disabled = false;
  };
}

export async function openShul(main, onBack, helpers) {
  ui = helpers;
  main.innerHTML = '<p class="muted">…</p>';
  await Promise.all([loadShulCfg(true), loadReleases()]);
  C = normShul(JSON.parse(JSON.stringify(cache)), key); saved = JSON.stringify(C);
  render(main, onBack);
}
export { shulDefaults };
