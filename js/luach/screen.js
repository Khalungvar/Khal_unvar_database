// 📺 תצוגת והגדרות המסך: דער מסך (לעבעדיג, מיט א דאטום/שעה), און די הגדרות — טעקסטן, בילדער, באהאלטן משבצות, גיכקייטן, שוליים.
// די הגדרות ליגן אינעם גיליון פון דער תצוגה (לשונית Screen); נאר נאך "💾 שמירה" גייען זיי צום מסך. יעדע שמירה = א נייע גירסא (ScreenHistory).
import { otherSheet } from '../google.js';
import { CONFIG } from '../config.js';
import { state, displayName } from '../data.js';
import { escapeHtml as h, nowStamp, shrinkImage } from '../util.js';
import { normScreen, screenDefaults } from '../display/screenset.js';
import { versionStore, openVersions } from '../versions.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sheet = () => otherSheet(CONFIG.DISPLAY_SHEET_ID);
const VS = versionStore('ScreenHistory');
const CHUNK = 40000;

let S = null; let saved = ''; let meta = { at: '', by: '' }; let ui = null; let back = null;
let at = ''; let mzpage = null; let pvTimer = 0;
const canEdit = () => !!(state.canScreen || state.isAdmin);
const dirty = () => JSON.stringify(S) !== saved;

const TEXTS = [
  ['title', 'שם (מתחת ללוגו)'], ['sub', 'שורה שנייה (מתחת לשם)'], ['kolText', 'קול — טקסט'], ['kolPhone', 'קול — טלפון'],
  ['tWeek', 'כותרת: זמני ימות החול'], ['tHoly', 'כותרת קטנה: שבת / יו"ט'], ['tRebbe', 'כותרת: מנין כ"ק'], ['tNext', 'כותרת: המנין הבא'],
  ['tZmanim', 'כותרת: זמני היום'], ['tMitzva', 'כותרת: מצוה יומית'], ['tDaf', 'כותרת: דף היומי'], ['tShiurim', 'כותרת: שיעורי תורה'],
  ['tShDaf', 'שיעורים — כותרת דף היומי'], ['tShOth', 'שיעורים — כותרת שאר השיעורים'],
];
const BOXES = [
  ['day', 'יום ופרשה (למעלה מימין)'], ['logo', 'לוגו ושם (באמצע למעלה)'], ['clock', 'שעון (למעלה משמאל)'],
  ['next', 'המנין הבא'], ['side', 'המשבצת האמצעית (שבת / ימות החול)'], ['simchos', 'שהשמחה במעונם'],
  ['zmanim', 'זמני היום'], ['mitzva', 'מצוה יומית'], ['daf', 'דף היומי'], ['shiurim', 'שיעורי תורה'], ['bottom', 'הפס התחתון (תאריך וקול)'],
];

async function load() {
  let j = null;
  try {
    const rows = await sheet().read('Screen!A2:D100');
    const parts = rows.filter((r) => /^data#\d+$/.test(String(r[0] || ''))).sort((x, y) => Number(String(x[0]).split('#')[1]) - Number(String(y[0]).split('#')[1]));
    if (parts.length) { j = JSON.parse(parts.map((r) => r[1] || '').join('')); meta = { at: String(parts[0][2] || ''), by: String(parts[0][3] || '') }; }
  } catch { /* */ }
  S = normScreen(j); saved = JSON.stringify(S);
}

async function save(main) {
  const btn = $('#sc-save', main); if (btn) btn.disabled = true;
  try {
    const note = ($('#sc-note', main)?.value || '').trim();
    S.version = (await VS.last()) + 1;
    const v = JSON.stringify(S); const parts = [];
    for (let i = 0; i < v.length; i += CHUNK) parts.push(v.slice(i, i + CHUNK));
    const stamp = nowStamp();
    await sheet().clear('Screen!A2:D100');
    await sheet().write(`Screen!A1:D${parts.length + 1}`, [['key', 'value', 'updated_at', 'updated_by'], ...parts.map((p, i) => [`data#${i}`, p, stamp, state.email])]);
    await VS.add(S, note, state.email);
    saved = JSON.stringify(S); meta = { at: stamp, by: state.email };
    ui.toast?.(`נשמר — גרסה ${S.version} ✓ (המסך יתעדכן תוך דקה)`);
  } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  render(main);
}

const unload = (e) => { if (S && dirty()) { e.preventDefault(); e.returnValue = ''; } };
export async function openScreen(main, onBack, helpers) {
  ui = helpers; back = onBack;
  main.innerHTML = '<p class="muted">…</p>';
  await load();
  if (!at) at = localIso(new Date());
  window.removeEventListener('beforeunload', unload); window.addEventListener('beforeunload', unload);
  render(main);
}
const p2 = (n) => String(n).padStart(2, '0');
const localIso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
function nextDow(dw, hh, mm) { const d = new Date(); d.setHours(hh, mm, 0, 0); while (d.getDay() !== dw || d < new Date(Date.now() - 864e5)) d.setDate(d.getDate() + 1); return localIso(d); }

function previewSrc() {
  try { localStorage.setItem('scr-preview', JSON.stringify(S)); } catch { /* */ }
  return `display.html?scrpv=1&at=${encodeURIComponent(at)}${mzpage != null ? `&mzpage=${mzpage}` : ''}&r=${Date.now()}`;
}
function refreshPreview(main, now = false) {
  clearTimeout(pvTimer);
  pvTimer = setTimeout(() => { const f = $('#sc-frame', main); if (f) f.src = previewSrc(); }, now ? 0 : 500);
}

function render(main) {
  const ed = canEdit(); const dis = ed ? '' : ' disabled';
  const inp = (path, val, extra = '') => `<input data-k="${h(path)}" value="${h(val ?? '')}"${dis}${extra}>`;
  const num = (path, val, min, max, step = 1) => `<input type="number" data-k="${h(path)}" data-num="1" value="${h(val)}" min="${min}" max="${max}" step="${step}" class="sc-num"${dis}>`;
  const chk = (path, val, inv = false) => `<input type="checkbox" data-k="${h(path)}"${inv ? ' data-inv="1"' : ''}${(inv ? !val : val) ? ' checked' : ''}${dis}>`;
  const img = (key, label, def) => `<div class="sc-img"><img src="${h(S[key] || def)}" alt=""><div><b>${h(label)}</b>
    ${ed ? `<label class="btn small-btn">📤 להחליף<input type="file" accept="image/*" data-img="${key}" hidden></label>${S[key] ? `<button type="button" class="btn small-btn ghost" data-imgreset="${key}">↺ ברירת מחדל</button>` : ''}` : ''}</div></div>`;
  const d = dirty();
  main.innerHTML = `<div class="lx-bar">
      <button type="button" class="btn ghost" id="sc-back">← זמני תפילות ביהמ"ד בארא פארק</button>
      <b class="lx-title">📺 תצוגת והגדרות המסך</b>
      <span class="vs-badge" title="${h(meta.at ? `נשמר ${meta.at} ע"י ${displayName(meta.by)}` : 'עדיין לא נשמר')}">גרסה ${S.version || 0}${meta.at ? ` · ${h(meta.at)}` : ''}</span>
      <span class="spacer"></span>
      ${ed ? `<input id="sc-note" class="sc-note" placeholder="הערה לשמירה (לא חובה)"${d ? '' : ' disabled'}>
      <button type="button" class="btn primary" id="sc-save"${d ? '' : ' disabled'}>💾 שמירה</button>` : '<span class="muted small">צפייה בלבד — אין הרשאת עריכה (אדמין → הרשאות)</span>'}
      <button type="button" class="btn ghost" id="sc-vers">🕘 גרסאות</button>
    </div>
    <p class="lx-warn" id="sc-warn"${d ? '' : ' hidden'}>⚠ יש שינויים שלא נשמרו — המסך בבית המדרש עדיין מציג את הגרסה השמורה. התצוגה כאן מראה את השינויים.</p>
    <div class="sc-pv">
      <div class="sc-pvbar">
        <label>📅 <input type="datetime-local" id="sc-at" value="${h(at)}"></label>
        <button type="button" class="btn small-btn" data-day="-1" title="יום קודם">⏪ יום</button>
        <button type="button" class="btn small-btn" data-day="1" title="יום הבא">יום ⏩</button>
        <button type="button" class="btn small-btn" data-hr="-1">−שעה</button><button type="button" class="btn small-btn" data-hr="1">+שעה</button>
        <span class="sc-q">
          <button type="button" class="btn small-btn ghost" data-q="now">עכשיו</button>
          <button type="button" class="btn small-btn ghost" data-q="fri">ער"ש 2:00</button>
          <button type="button" class="btn small-btn ghost" data-q="sat">שבת 12:00</button>
          <button type="button" class="btn small-btn ghost" data-q="mot">מוצ"ש 8:30</button>
        </span>
        <span class="spacer"></span>
        <span class="sc-mz">שמחות: <button type="button" class="btn small-btn" data-mz="-1">◀</button><b>${mzpage == null ? 'אוטומטי' : `עמוד ${mzpage + 1}`}</b><button type="button" class="btn small-btn" data-mz="1">▶</button>${mzpage != null ? '<button type="button" class="btn small-btn ghost" data-mz="0">אוטומטי</button>' : ''}</span>
        <a class="btn small-btn ghost" href="display.html" target="_blank" rel="noopener" title="המסך כמו שהוא בבית המדרש (הגרסה השמורה)">↗ מסך מלא</a>
      </div>
      <div class="sc-frame-box"><iframe id="sc-frame" title="המסך" src="${previewSrc()}"></iframe></div>
    </div>
    <div class="sc-grid">
      <section class="sc-card"><h3>✏️ טקסטים</h3>
        ${TEXTS.map(([k, l]) => `<label class="sc-row"><span>${h(l)}</span>${inp(`texts.${k}`, S.texts[k])}</label>`).join('')}
        ${ed ? '<button type="button" class="btn small-btn ghost" id="sc-texts-reset">↺ כל הטקסטים לברירת מחדל</button>' : ''}
      </section>
      <section class="sc-card"><h3>🖼 תמונות</h3>
        ${img('logo', 'לוגו (באמצע למעלה)', 'img/logo.png')}
        ${img('simchaHead', 'כותרת "שהשמחה במעונם"', 'img/display/simcha-head.jpg')}
        <p class="muted small">התמונה מוקטנת לבד ונשמרת בתוך ההגדרות.</p>
      </section>
      <section class="sc-card"><h3>👁 משבצות — להציג</h3>
        ${BOXES.map(([k, l]) => `<label class="sc-chk">${chk(`hide.${k}`, S.hide[k], true)} ${h(l)}</label>`).join('')}
      </section>
      <section class="sc-card"><h3>⏱ מהירויות וזמנים</h3>
        <label class="sc-row"><span>שמחות — שניות לכל עמוד</span>${num('mzSec', S.mzSec, 3, 120)}</label>
        <label class="sc-row"><span>שיעורי תורה — מהירות גלילה (גבוה = מהר)</span>${num('shiurSpeed', S.shiurSpeed, 4, 80)}</label>
        <label class="sc-row"><span>מוצאי שבת/יו"ט — דקות אחרי מעריב עד שלוח ימות החול חוזר</span>${num('revertMin', S.revertMin, 0, 240)}</label>
        <label class="sc-chk">${chk('countdown', S.countdown)} שעון ספירה לאחור ב"המנין הבא"</label>
      </section>
      <section class="sc-card"><h3>🖥 המסך</h3>
        <label class="sc-row"><span>שוליים לטלוויזיה (פיקסלים, 0–120)</span>${num('safe', S.safe, 0, 120)}</label>
        <p class="muted small">אם הטלוויזיה חותכת את הקצוות — להגדיל. אם רואים את כל המסגרות עד הסוף — אפשר להקטין עד 0.</p>
      </section>
    </div>`;

  const setK = (k, v) => { const ks = k.split('.'); const last = ks.pop(); ks.reduce((o, x) => o[x], S)[last] = v; };
  const changed = (full) => { if (full) render(main); else { const dd = dirty(); const sv = $('#sc-save', main); const nt = $('#sc-note', main); if (sv) sv.disabled = !dd; if (nt) nt.disabled = !dd; $('#sc-warn', main).hidden = !dd; } refreshPreview(main); };
  main.oninput = (e) => {
    const el = e.target; if (!el.dataset.k || el.type === 'checkbox') return;
    setK(el.dataset.k, el.dataset.num ? Number(el.value) : el.value); changed(false);
  };
  main.onchange = (e) => {
    const el = e.target;
    if (el.dataset.k && el.type === 'checkbox') { setK(el.dataset.k, el.dataset.inv ? !el.checked : el.checked); changed(false); }
  };
  $('#sc-back', main).onclick = () => { if (dirty() && !confirm('יש שינויים שלא נשמרו. לצאת בלי לשמור?')) return; window.removeEventListener('beforeunload', unload); back(); };
  const sv = $('#sc-save', main); if (sv) sv.onclick = () => save(main);
  $('#sc-vers', main).onclick = () => openVersions({ store: VS, title: 'גרסאות — הגדרות המסך', canRestore: !!(state.canRestore || state.isAdmin) && ed, nameOf: (x) => displayName(x),
    onRestore: (obj, v) => { const keep = S.version; S = normScreen(obj); S.version = keep; render(main); refreshPreview(main, true); ui.toast?.(`גרסה ${v} נטענה — לחץ 💾 שמירה כדי להחזיר אותה למסך`); } });
  const atIn = $('#sc-at', main);
  atIn.onchange = () => { at = atIn.value || localIso(new Date()); refreshPreview(main, true); };
  const shift = (ms) => { const t = new Date(at); at = localIso(new Date(t.getTime() + ms)); atIn.value = at; refreshPreview(main, true); };
  $$('[data-day]', main).forEach((b) => { b.onclick = () => shift(Number(b.dataset.day) * 864e5); });
  $$('[data-hr]', main).forEach((b) => { b.onclick = () => shift(Number(b.dataset.hr) * 36e5); });
  $$('[data-q]', main).forEach((b) => { b.onclick = () => {
    const q = b.dataset.q;
    at = q === 'now' ? localIso(new Date()) : q === 'fri' ? nextDow(5, 14, 0) : q === 'sat' ? nextDow(6, 12, 0) : nextDow(6, 20, 30);
    atIn.value = at; refreshPreview(main, true);
  }; });
  $$('[data-mz]', main).forEach((b) => { b.onclick = () => {
    const v = Number(b.dataset.mz);
    mzpage = v === 0 ? null : Math.max(0, (mzpage ?? 0) + (mzpage == null && v > 0 ? 0 : v));
    render(main); refreshPreview(main, true);
  }; });
  $$('[data-img]', main).forEach((f) => { f.onchange = async () => {
    const file = f.files[0]; if (!file) return;
    try { S[f.dataset.img] = await shrinkImage(file, f.dataset.img === 'logo' ? 500 : 700, 160000); changed(true); } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  }; });
  $$('[data-imgreset]', main).forEach((b) => { b.onclick = () => { S[b.dataset.imgreset] = ''; changed(true); }; });
  const tr = $('#sc-texts-reset', main); if (tr) tr.onclick = () => { if (!confirm('להחזיר את כל הטקסטים לברירת המחדל?')) return; S.texts = screenDefaults().texts; changed(true); };
  // דער מסך: 1920×1080, אויסגעשטעלט צו דער ברייט
  const box = $('.sc-frame-box', main); const fr = $('#sc-frame', main);
  const fit = () => { const k = box.clientWidth / 1920; fr.style.transform = `scale(${k})`; box.style.height = `${1080 * k}px`; };
  fit(); window.removeEventListener('resize', onRs); onRs = fit; window.addEventListener('resize', onRs);
}
let onRs = () => {};
