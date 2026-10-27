// 📺 תצוגת והגדרות המסך: דער מסך (לעבעדיג, מיט א דאטום/שעה), און די הגדרות — טעקסטן, בילדער, באהאלטן משבצות, גיכקייטן, שוליים.
// די הגדרות ליגן אינעם גיליון פון דער תצוגה (לשונית Screen); נאר נאך "💾 שמירה" גייען זיי צום מסך. יעדע שמירה = א נייע גירסא (ScreenHistory).
import { otherSheet, ensureDriveScope, hasDriveScope, driveFolder, driveUploadLarge, driveDownload, drivePublic } from '../google.js';
import { CONFIG } from '../config.js';
import { state, displayName } from '../data.js';
import { escapeHtml as h, nowStamp, shrinkImage } from '../util.js';
import { normScreen, screenDefaults, PLACES, SYSTEM, adUrl, THEME, BOX_SEL } from '../display/screenset.js';
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
  await loadKiosk();
}
// ---------- תוכנת המסך: נשמרת בדרייב (פרטי — רק מי שהעלה), הרשימה בגיליון הראשי, לשונית Kiosk ----------
let kiosk = []; // [{ id, name, size, ver, note, at, by }] — האחרונה בסוף
async function loadKiosk() {
  try {
    const rows = await otherSheet(CONFIG.SPREADSHEET_ID).read('Kiosk!A2:G200');
    kiosk = rows.filter((r) => r[0]).map((r) => ({ id: String(r[0]), name: String(r[1] || 'UngvarDisplay.zip'), size: Number(r[2]) || 0, ver: String(r[3] || ''), note: String(r[4] || ''), at: String(r[5] || ''), by: String(r[6] || '') }));
  } catch { kiosk = []; }
}
const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
async function kioskDownload(k, btn) {
  if (!confirm(`⚠ שים לב: אתה מוריד את קובץ ההתקנה של תוכנת המסך (ZIP, ${mb(k.size)}) — בשביל המחשב שבבית המדרש.\nזה לא האתר ולא הגדרות המסך; ההגדרות מגיעות למסך לבד מהאתר.\n\nהקובץ פרטי (יש בו גופנים בתשלום) — לא לשתף.\n\nלהוריד?`)) return;
  const old = btn.textContent; btn.disabled = true;
  try {
    await ensureDriveScope();
    const bytes = await driveDownload(k.id, (f) => { btn.textContent = `⬇ ${Math.round(f * 100)}%`; });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' })); a.download = k.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  } catch (err) { ui.toast?.(err.status === 404 || err.status === 403 ? 'אין גישה לקובץ — רק מי שהעלה אותו יכול להוריד (או לשתף אותו ב-Drive).' : String(err.message || err), 'error'); }
  btn.textContent = old; btn.disabled = false;
}
async function kioskUpload(file, main) {
  const st = $('#sc-k-st', main);
  try {
    await ensureDriveScope();
    const folder = await driveFolder('מסך בית המדרש - תוכנה');
    const id = await driveUploadLarge(file, file.name, folder, (f) => { st.textContent = `מעלה… ${Math.round(f * 100)}%`; });
    const ver = (/(\d+\.\d+\.\d+)/.exec(file.name) || [])[1] || '';
    const row = kiosk.length + 2;
    await otherSheet(CONFIG.SPREADSHEET_ID).write(`Kiosk!A${row}:G${row}`, [[id, file.name, file.size, ver, ($('#sc-k-note', main)?.value || '').trim(), nowStamp(), state.email]]);
    await loadKiosk(); ui.toast?.('הקובץ נשמר ✓'); render(main);
  } catch (err) { st.textContent = ''; ui.toast?.(String(err.message || err), 'error'); }
}
function kioskHtml(ed) {
  const last = kiosk[kiosk.length - 1];
  return `<section class="sc-card sc-kiosk"><h3>💻 תוכנת המסך (למחשב שבבית המדרש)</h3>
    ${last ? `<div class="sc-k-last"><b>${h(last.name)}</b> <span class="muted small">${mb(last.size)} · הועלה ${h(last.at)} ע"י ${h(displayName(last.by))}${last.note ? ` · ${h(last.note)}` : ''}</span>
      <button type="button" class="btn primary small-btn" data-kdl="${kiosk.length - 1}">⬇ הורדה</button></div>` : '<p class="muted">עדיין לא הועלה קובץ.</p>'}
    ${kiosk.length > 1 ? `<details><summary class="muted small">גרסאות קודמות (${kiosk.length - 1})</summary>${kiosk.slice(0, -1).reverse().map((k) => `<div class="sc-k-old">${h(k.name)} <span class="muted small">${h(k.at)}${k.note ? ` · ${h(k.note)}` : ''}</span> <button type="button" class="btn small-btn ghost" data-kdl="${kiosk.indexOf(k)}">⬇</button></div>`).join('')}</details>` : ''}
    ${ed ? `<div class="sc-k-up"><input id="sc-k-note" placeholder="הערה (לא חובה)"><label class="btn small-btn">📤 העלאת קובץ התוכנה (ZIP)<input type="file" accept=".zip,application/zip" id="sc-k-file" hidden></label><span id="sc-k-st" class="muted small"></span></div>` : ''}
    <p class="muted small">הקובץ נשמר ב-Google Drive שלך בתיקייה "מסך בית המדרש - תוכנה", <b>פרטי</b> (לא משותף) — יש בו גופנים בתשלום. ${hasDriveScope() ? '' : 'בפעם הראשונה Google יבקש אישור גישה ל-Drive.'}</p>
  </section>`;
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

// ---------- 🖼 תמונות, מודעות, טקסטים והודעות ----------
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const todayIso = () => localIso(new Date()).slice(0, 10);
let dragI = null; // דער פריט וואס מ'שטעלט יעצט (מיקום חופשי)
const uid = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const libThumb = (L) => (!L ? '❔' : L.kind === 'video' ? '<span class="sc-ico">🎬</span>' : `<img src="${h(adUrl(L))}" alt="" loading="lazy">`);
const TYPE_NAME = { media: 'תמונה / וידאו', text: 'טקסט', system: 'דף מהמערכת', notice: 'הודעה בפס אדום' };
function itemsHtml(ed) {
  const dis = ed ? '' : ' disabled';
  const f = (i, k, v, extra = '') => `<input data-k="items.${i}.${k}" value="${h(v ?? '')}"${dis}${extra}>`;
  const sel = (i, k, v, opts, full = false) => `<select data-k="items.${i}.${k}"${full ? ' data-full="1"' : ''}${dis}>${opts.map(([a, b]) => `<option value="${h(a)}"${String(v) === String(a) ? ' selected' : ''}>${h(b)}</option>`).join('')}</select>`;
  const rows = S.items.map((it, i) => {
    const L = it.type === 'media' ? S.library.find((x) => x.id === it.lib) : null;
    const thumb = it.type === 'media' ? libThumb(L) : it.type === 'system' ? '<span class="sc-ico">📄</span>' : it.type === 'notice' ? '<span class="sc-ico">📢</span>' : '<span class="sc-ico">T</span>';
    return `<div class="sc-it${it.on === false ? ' off' : ''}${dragI === i ? ' drag' : ''}">
      <div class="sc-th">${thumb}</div>
      <div class="sc-itb">
        <div class="sc-r1"><label class="sc-chk"><input type="checkbox" data-k="items.${i}.on"${it.on !== false ? ' checked' : ''}${dis}> פעיל</label>
          <b>${h(TYPE_NAME[it.type] || '')}</b>${it.type === 'media' && L ? `<span class="muted small">${h(L.name || '')}</span>` : ''}
          ${it.type === 'system' ? sel(i, 'sys', it.sys, SYSTEM) : ''}
          <span class="spacer"></span>
          ${ed ? `<button type="button" class="tf-mini" data-imv="${i}" data-d="-1" title="למעלה">↑</button><button type="button" class="tf-mini" data-imv="${i}" data-d="1" title="למטה">↓</button><button type="button" class="tf-mini" data-idel="${i}" title="מחק">🗑</button>` : ''}
        </div>
        ${it.type === 'text' || it.type === 'notice' ? `<textarea data-k="items.${i}.text" rows="2" placeholder="${it.type === 'notice' ? 'טקסט ההודעה' : 'הטקסט שיופיע על המסך'}"${dis}>${h(it.text || '')}</textarea>` : ''}
        ${it.type === 'text' ? `<div class="sc-r1">גודל ${f(i, 'size', it.size, ' type="number" min="12" max="400" data-num="1" class="sc-num"')} צבע <input type="color" data-k="items.${i}.color" value="${h(it.color || '#0d2350')}"${dis}> ${it.clear ? '' : `רקע <input type="color" data-k="items.${i}.bg" value="${h(it.bg || '#ffffff')}"${dis}>`}
          <label class="sc-chk"><input type="checkbox" data-k="items.${i}.clear"${it.clear ? ' checked' : ''}${dis}> רקע שקוף</label>
          <label class="sc-chk"><input type="checkbox" data-k="items.${i}.bold"${it.bold !== false ? ' checked' : ''}${dis}> מודגש</label></div>` : ''}
        ${it.type !== 'notice' ? `<div class="sc-r1">איפה: ${sel(i, 'place', it.place || 'right', PLACES, true)}
          ${it.place === 'free' && ed ? `<button type="button" class="btn small-btn${dragI === i ? ' primary' : ''}" data-drag="${i}">${dragI === i ? '✔ סיום מיקום' : '✋ למקם על המסך'}</button>` : ''}
          ${it.type === 'media' || it.type === 'system' ? `${sel(i, 'fit', it.fit || 'contain', [['contain', 'מוצג שלם'], ['cover', 'ממלא את המקום']])}` : ''}
          ${it.type === 'media' ? `<label class="sc-chk" title="תמונת PNG עם שקיפות — רואים את המסך מאחוריה"><input type="checkbox" data-k="items.${i}.clear"${it.clear ? ' checked' : ''}${dis}> רקע שקוף</label>` : ''}
          <label class="sc-chk"><input type="checkbox" data-k="items.${i}.frame"${it.frame !== false ? ' checked' : ''}${dis}> מסגרת</label></div>` : ''}
        <div class="sc-r1">מתאריך <input type="date" data-k="items.${i}.from" value="${h(it.from || '')}"${dis}>
          ${it.forever ? '' : `עד <input type="date" data-k="items.${i}.to" value="${h(it.to || '')}"${dis}>`}
          <label class="sc-chk" title="מופיע עד שמורידים אותו (מוחקים או מכבים)"><input type="checkbox" data-k="items.${i}.forever"${it.forever ? ' checked' : ''}${dis}> ♾ לתמיד</label>
          <span class="sc-days">${DAYS.map((d, k) => `<label><input type="checkbox" data-iday="${i}" data-dw="${k}"${(it.days || []).includes(k) ? ' checked' : ''}${dis}>${d}</label>`).join('')}</span>
          <span class="muted small">${(it.days || []).length ? '' : '(כל הימים)'}</span>
          שניות ${f(i, 'sec', it.sec || '', ' type="number" min="0" max="600" data-num="1" class="sc-num" placeholder="ברירת מחדל"')}</div>
      </div></div>`;
  }).join('');
  return `<section class="sc-card sc-items"><h3>🖼 תמונות, מודעות, טקסטים והודעות</h3>
    ${ed ? `<div class="sc-add">
      <label class="btn small-btn primary">📤 העלאת תמונה / וידאו<input type="file" accept="image/*,video/*" id="sc-up" hidden></label>
      <button type="button" class="btn small-btn" data-add="lib">📚 מהמאגר (${S.library.length})</button>
      <button type="button" class="btn small-btn" data-add="link">🔗 קישור לתמונה / וידאו</button>
      <button type="button" class="btn small-btn" data-add="system">📄 דף מהמערכת</button>
      <button type="button" class="btn small-btn" data-add="text">✏️ טקסט</button>
      <button type="button" class="btn small-btn" data-add="notice">📢 הודעה בפס אדום</button>
      <span id="sc-up-st" class="muted small"></span></div>` : ''}
    ${rows || '<p class="muted">עדיין אין. מה שמוסיפים כאן מופיע על המסך בתאריכים שבוחרים — ואם יש כמה באותו מקום, הם מתחלפים.</p>'}
    <div class="sc-r1 muted small">כשיש כמה באותו מקום — כל אחד מוצג ${num0('adSec', S.adSec)} שניות (אם לא נקבע אחרת). ריק בתאריכים = תמיד.</div>
  </section>`;
}
const num0 = (path, val) => `<input type="number" data-k="${h(path)}" data-num="1" value="${h(val)}" min="3" max="600" class="sc-num"${canEdit() ? '' : ' disabled'}>`;
function libDialog(main, onPick) {
  const bg = document.createElement('div'); bg.className = 'tf-dlg-bg';
  const draw = () => {
    bg.innerHTML = `<div class="tf-dlg sc-lib"><h3>📚 מאגר התמונות והסרטונים</h3>
      ${S.library.length ? `<div class="sc-libg">${S.library.map((L) => { const used = S.items.some((x) => x.lib === L.id); return `<div class="sc-libi">${libThumb(L)}<small>${h(L.name || '')}</small>
        <button type="button" class="btn small-btn primary" data-pick="${h(L.id)}">➕ להוסיף למסך</button>
        ${used ? '<span class="muted small">בשימוש</span>' : `<button type="button" class="btn small-btn ghost" data-ldel="${h(L.id)}">🗑 להסיר מהמאגר</button>`}</div>`; }).join('')}</div>` : '<p class="muted">המאגר ריק — מעלים תמונה או וידאו, והם נשמרים כאן לשימוש חוזר.</p>'}
      <div class="vs-acts"><button type="button" class="btn ghost" data-x>סגירה</button></div></div>`;
    bg.querySelector('[data-x]').onclick = () => bg.remove();
    bg.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { bg.remove(); onPick(b.dataset.pick); }; });
    bg.querySelectorAll('[data-ldel]').forEach((b) => { b.onclick = () => { if (!confirm('להסיר מהמאגר? (הקובץ נשאר ב-Drive)')) return; S.library = S.library.filter((x) => x.id !== b.dataset.ldel); draw(); render(main); }; });
  };
  draw(); document.body.appendChild(bg);
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
}
async function uploadMedia(file, main) {
  const st = $('#sc-up-st', main);
  try {
    await ensureDriveScope();
    const folder = await driveFolder('מודעות מסך');
    const id = await driveUploadLarge(file, file.name, folder, (f) => { st.textContent = `מעלה… ${Math.round(f * 100)}%`; });
    st.textContent = 'משתף לצפייה…';
    await drivePublic(id);
    const L = { id: uid(), name: file.name, kind: /^video\//.test(file.type) ? 'video' : 'image', png: file.type === 'image/png', driveId: id, at: nowStamp() };
    S.library.push(L);
    S.items.push({ id: uid(), type: 'media', lib: L.id, on: true, place: 'right', from: todayIso(), to: '', days: [], sec: 0, fit: L.kind === 'video' ? 'cover' : 'contain', frame: true });
    st.textContent = ''; render(main); refreshPreview(main, true);
  } catch (err) { st.textContent = ''; ui.toast?.(String(err.message || err), 'error'); }
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
      <div class="sc-frame-box"><iframe id="sc-frame" title="המסך" src="${previewSrc()}"></iframe>${dragI != null ? '<div class="sc-dragl"><div class="sc-dragb"><span>✋ לגרור · להגדיל מהפינה</span><i class="sc-hdl"></i></div></div>' : ''}</div>
    </div>
    ${itemsHtml(ed)}
    <div class="sc-grid">
      <section class="sc-card"><h3>✏️ טקסטים</h3>
        ${TEXTS.map(([k, l]) => `<label class="sc-row"><span>${h(l)}</span>${inp(`texts.${k}`, S.texts[k])}</label>`).join('')}
        ${ed ? '<button type="button" class="btn small-btn ghost" id="sc-texts-reset">↺ כל הטקסטים לברירת מחדל</button>' : ''}
      </section>
      <section class="sc-card"><h3>🖼 תמונות</h3>
        ${img('logo', 'לוגו (באמצע למעלה)', 'img/logo.png')}
        ${img('simchaHead', 'כותרת "שהשמחה במעונם"', 'img/display/simcha-title.jpg')}
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
      <section class="sc-card sc-colors"><h3>🎨 צבעים</h3>
        <p class="muted small">לכל המסך:</p>
        ${THEME.map(([k, l, d]) => `<label class="sc-row"><span>${h(l)}</span><input type="color" data-thm="${k}" value="${h(S.theme[k] || d)}"${dis}>${S.theme[k] && ed ? `<button type="button" class="tf-mini" data-thmx="${k}" title="ברירת מחדל">↺</button>` : '<span class="sc-sp"></span>'}</label>`).join('')}
        <p class="muted small">למשבצת מסוימת (רקע · טקסט · כותרת):</p>
        <table class="sc-bx"><tr class="muted small"><td></td><td>רקע</td><td>טקסט</td><td>כותרת</td><td></td></tr>${Object.entries(BOX_SEL).map(([k, [l]]) => { const c = S.boxes[k] || {}; return `<tr><td>${h(l)}</td>
          ${['bg', 'text', 'title'].map((f) => `<td><input type="color" data-box="${k}" data-bf="${f}" value="${h(c[f] || (f === 'bg' ? '#fbf5e6' : f === 'text' ? '#1d1a14' : '#0f2140'))}" class="${c[f] ? 'set' : 'unset'}" title="${f === 'bg' ? 'רקע' : f === 'text' ? 'טקסט' : 'כותרת'}"${dis}></td>`).join('')}
          <td>${(c.bg || c.text || c.title) && ed ? `<button type="button" class="tf-mini" data-boxx="${k}" title="ברירת מחדל">↺</button>` : ''}</td></tr>`; }).join('')}</table>
        ${ed ? '<button type="button" class="btn small-btn ghost" id="sc-col-reset">↺ כל הצבעים לברירת מחדל</button>' : ''}
      </section>
      ${kioskHtml(ed)}
    </div>`;

  const setK = (k, v) => { const ks = k.split('.'); const last = ks.pop(); ks.reduce((o, x) => o[x], S)[last] = v; };
  const changed = (full) => { if (full) render(main); else { const dd = dirty(); const sv = $('#sc-save', main); const nt = $('#sc-note', main); if (sv) sv.disabled = !dd; if (nt) nt.disabled = !dd; $('#sc-warn', main).hidden = !dd; } refreshPreview(main); };
  main.oninput = (e) => {
    const el = e.target; if (!el.dataset.k || el.type === 'checkbox') return;
    setK(el.dataset.k, el.dataset.num ? Number(el.value) : el.value); changed(false);
  };
  main.onchange = (e) => {
    const el = e.target;
    if (el.dataset.k && el.type === 'checkbox') { setK(el.dataset.k, el.dataset.inv ? !el.checked : el.checked); changed(/^items\.\d+\.(on|clear|forever)$/.test(el.dataset.k)); }
    else if (el.dataset.full) changed(true);
    else if (el.dataset.iday != null) {
      const it = S.items[Number(el.dataset.iday)]; const d = Number(el.dataset.dw); const set = new Set(it.days || []);
      if (el.checked) set.add(d); else set.delete(d); it.days = [...set].sort(); changed(true);
    }
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
  $$('[data-kdl]', main).forEach((b) => { b.onclick = () => kioskDownload(kiosk[Number(b.dataset.kdl)], b); });
  const kf = $('#sc-k-file', main); if (kf) kf.onchange = () => { if (kf.files[0]) kioskUpload(kf.files[0], main); };
  $$('[data-thm]', main).forEach((el) => { el.oninput = () => { S.theme[el.dataset.thm] = el.value; changed(false); }; el.onchange = () => changed(true); });
  $$('[data-thmx]', main).forEach((b) => { b.onclick = () => { delete S.theme[b.dataset.thmx]; changed(true); }; });
  $$('[data-box]', main).forEach((el) => { el.oninput = () => { const k = el.dataset.box; S.boxes[k] = { ...(S.boxes[k] || {}), [el.dataset.bf]: el.value }; changed(false); }; el.onchange = () => changed(true); });
  $$('[data-boxx]', main).forEach((b) => { b.onclick = () => { delete S.boxes[b.dataset.boxx]; changed(true); }; });
  const cr = $('#sc-col-reset', main); if (cr) cr.onclick = () => { if (!confirm('להחזיר את כל הצבעים לברירת המחדל?')) return; S.theme = {}; S.boxes = {}; changed(true); };
  const up = $('#sc-up', main); if (up) up.onchange = () => { if (up.files[0]) uploadMedia(up.files[0], main); };
  $$('[data-add]', main).forEach((b) => { b.onclick = () => {
    const a = b.dataset.add; const base = { id: uid(), on: true, from: todayIso(), to: '', days: [], sec: 0 };
    if (a === 'lib') { libDialog(main, (lib) => { const L = S.library.find((x) => x.id === lib); S.items.push({ ...base, type: 'media', lib, place: 'right', fit: L?.kind === 'video' ? 'cover' : 'contain', frame: true }); changed(true); }); return; }
    if (a === 'link') {
      const u = (prompt('קישור לתמונה או לווידאו (https://…):') || '').trim(); if (!/^https:\/\//.test(u)) return;
      const L = { id: uid(), name: u.split('/').pop().slice(0, 60), kind: /\.(mp4|webm|mov)(\?|$)/i.test(u) ? 'video' : 'image', url: u, at: nowStamp() };
      S.library.push(L); S.items.push({ ...base, type: 'media', lib: L.id, place: 'right', fit: L.kind === 'video' ? 'cover' : 'contain', frame: true });
    } else if (a === 'system') S.items.push({ ...base, type: 'system', sys: 'weekday', place: 'right', fit: 'contain', frame: true });
    else if (a === 'text') S.items.push({ ...base, type: 'text', text: '', size: 64, color: '#0d2350', bg: '#ffffff', bold: true, place: 'free', box: { x: 660, y: 340, w: 600, h: 300 }, frame: true });
    else if (a === 'notice') S.items.push({ ...base, type: 'notice', text: '' });
    changed(true);
  }; });
  $$('[data-idel]', main).forEach((b) => { b.onclick = () => { if (!confirm('למחוק את הפריט מהמסך? (התמונה נשארת במאגר)')) return; S.items.splice(Number(b.dataset.idel), 1); dragI = null; changed(true); }; });
  $$('[data-imv]', main).forEach((b) => { b.onclick = () => { const i = Number(b.dataset.imv); const j = i + Number(b.dataset.d); if (j < 0 || j >= S.items.length) return; [S.items[i], S.items[j]] = [S.items[j], S.items[i]]; changed(true); }; });
  $$('[data-drag]', main).forEach((b) => { b.onclick = () => { const i = Number(b.dataset.drag); dragI = dragI === i ? null : i; render(main); if (dragI != null) $('.sc-pv', main).scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
  // דער מסך: 1920×1080, אויסגעשטעלט צו דער ברייט
  const box = $('.sc-frame-box', main); const fr = $('#sc-frame', main);
  const fit = () => { const k = box.clientWidth / 1920; fr.style.transform = `scale(${k})`; box.style.height = `${1080 * k}px`; };
  fit(); window.removeEventListener('resize', onRs); onRs = () => { fit(); placeDrag(); }; window.addEventListener('resize', onRs);
  // ווען דער בלאט איז געווען באהאלטן ביים צייכענען (ברייט 0) — נאכאמאל ווען ער ווערט געזען
  try { roObs?.disconnect(); roObs = new ResizeObserver(() => { fit(); placeDrag(); }); roObs.observe(box); } catch { /* */ }
  // מיקום חופשי: א ראם איבער דער תצוגה — גרירה און גרעסער מאכן (קאארדינאטן פונעם מסך 1920×1080, אינעווייניג פון די שוליים)
  const dl = $('.sc-dragl', main);
  function placeDrag() {
    if (!dl || dragI == null) return;
    const it = S.items[dragI]; if (!it) return;
    const k = box.clientWidth / 1920; const sf = Math.max(0, Number(S.safe) || 0); const ss = 1 - (2 * sf) / 1080;
    const b = it.box || (it.box = { x: 660, y: 340, w: 600, h: 300 });
    const toScr = (x, y) => [(960 + (x - 960) * ss) * k, (sf + y * ss) * k];
    const [l, t] = toScr(b.x, b.y); const [r, btm] = toScr(b.x + b.w, b.y + b.h);
    const el = dl.firstChild; Object.assign(el.style, { left: `${l}px`, top: `${t}px`, width: `${r - l}px`, height: `${btm - t}px` });
    dl._k = k; dl._ss = ss;
  }
  placeDrag();
  if (dl) {
    const el = dl.firstChild;
    el.onpointerdown = (e) => {
      e.preventDefault(); const it = S.items[dragI]; const b0 = { ...it.box }; const x0 = e.clientX; const y0 = e.clientY;
      const resize = e.target.classList.contains('sc-hdl'); el.setPointerCapture(e.pointerId);
      el.onpointermove = (ev) => {
        const f = 1 / (dl._k * dl._ss); const dx = (ev.clientX - x0) * f; const dy = (ev.clientY - y0) * f;
        // דער מסך איז פון רעכטס צו לינקס, אבער די קאארדינאטן — פון לינקס
        if (resize) { it.box.w = Math.max(80, Math.round(b0.w - dx)); it.box.x = Math.round(b0.x + dx); it.box.h = Math.max(60, Math.round(b0.h + dy)); }
        else { it.box.x = Math.round(Math.min(1900, Math.max(-100, b0.x + dx))); it.box.y = Math.round(Math.min(1060, Math.max(-100, b0.y + dy))); }
        placeDrag();
      };
      el.onpointerup = () => { el.onpointermove = null; changed(false); };
    };
  }
}
let onRs = () => {}; let roObs = null;
