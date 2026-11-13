// 📻 קול אונגוואר — ungvar.org/kol : מערכת המיילים (שבועי "מהנעשה והנשמע" + חד פעמי).
// כניסה עם Google (כל מי שמורשה באתר הכללי). השרת: apps-script/kol.gs (רץ בשם kol@ungvar.org).
// הנמענים: רשימת התפוצה "מהנעשה והנשמע" — מסומנת ליד המייל של איש הקשר באתר הכללי (email_1_tags / email_2_tags).
import { initAuth, requestToken, getUserEmail, hasSavedSession, currentToken, readTabs } from '../google.js?v=694';
import { CONFIG } from '../config.js?v=694';
import { shabbatTitle } from '../parasha.js?v=694';
import { isoToHebrewText, toHebrew, yearLabel } from '../hebdate.js?v=694';
import { FONTS, DEF_FONT, KINDS, LIST_NAME, DEF_HEADER, DEF_FOOTER, emailHtml, emailText, fillTags, imgUrl, dlUrl, imgsOf, driveId, cleanHtml, dateOf, dayText, weekOf, hfOf } from './render.js?v=694';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const main = $('#kol-main');
function toast(t, kind = '') { const e = document.createElement('div'); e.className = `sa-toast ${kind}`; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), kind === 'error' ? 6000 : 3500); }
const MSG = { 'not-allowed': 'אין הרשאה — רק מי שמורשה באתר הכללי.', conflict: 'מישהו אחר שמר בינתיים — טוען מחדש.', 'already-sent': 'המייל הזה כבר נשלח.', 'too-big': 'המייל גדול מדי — פחות רכיבים.', 'file-big': 'הקובץ גדול מדי.', 'bad-file': 'קובץ לא תקין.' };
const msg = (err) => { const m = String(err?.message || err); return MSG[m.split(':')[0]] || m; };

const K = { me: '', from: '', quota: 0, emails: [], unsubs: new Set(), logo: '', logoData: '', defaults: {}, header: {}, footer: {}, phones: null, contacts: null };
const SITE_LOGO = new URL('../../img/logo.png', import.meta.url).href;
/** מה שהבנאי של המייל צריך מבחוץ: ראש / תחתית ברירת מחדל + הלוגו לתצוגה */
const ctx = (extra = {}) => ({ header: K.header, footer: K.footer, logoUrl: K.logo ? imgUrl(K.logo, 400) : SITE_LOGO, ...extra });

// ---------------------------------------------------------------- שרת
async function api(action, body = {}, ms = 120000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(CONFIG.KOL_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, action, token: currentToken() }), signal: ctl.signal });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  } catch (err) { if (err.name === 'AbortError') throw new Error('השרת לא ענה בזמן — נסו שוב.'); throw err; } finally { clearTimeout(tm); }
}
async function loadList() {
  const r = await api('list');
  K.emails = r.emails || []; K.unsubs = new Set((r.unsubs || []).map((x) => String(x).toLowerCase()));
}

// ---------------------------------------------------------------- נמענים (מהאתר הכללי)
const emailOk = (e) => /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(String(e || '').trim());
async function loadPeople() {
  if (K.phones) return;
  const t = await readTabs(['Contacts', 'Phones']);
  const obj = (rows) => { const head = (rows[0] || []).map(String); return rows.slice(1).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] ?? '']))); };
  K.contacts = new Map(obj(t.Contacts || []).filter((c) => !String(c.deleted_at || '').trim()).map((c) => [String(c.contact_id), c]));
  K.phones = obj(t.Phones || []).filter((p) => K.contacts.has(String(p.contact_id)));
}
const tagsOf = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
/** שמות כל רשימות התפוצה של מייל */
function listNames() {
  const s = new Set([LIST_NAME]);
  (K.phones || []).forEach((p) => ['email_1', 'email_2'].forEach((k) => tagsOf(p[`${k}_tags`]).forEach((n) => s.add(n))));
  return [...s];
}
/** המיילים של רשימה (בלי מי שהסיר את עצמו) */
function recipients(name = LIST_NAME) {
  const out = new Map();
  (K.phones || []).forEach((p) => ['email_1', 'email_2'].forEach((k) => {
    const em = String(p[k] || '').trim().toLowerCase();
    if (emailOk(em) && tagsOf(p[`${k}_tags`]).includes(name)) out.set(em, String(p.contact_id));
  }));
  const all = [...out.keys()];
  return { all, send: all.filter((e) => !K.unsubs.has(e)), off: all.filter((e) => K.unsubs.has(e)) };
}

// ---------------------------------------------------------------- קבצים
const readUrl = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('קריאת הקובץ נכשלה')); r.readAsDataURL(f); });
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('לא הצלחתי לקרוא את התמונה')); i.src = src; });
/** תמונה → JPEG (עד max פיקסלים ברוחב), ואם צריך — עם הלוגו */
async function toJpeg(src, { max = 1200, logo = null, pos = 'bl', size = 0.18 } = {}) {
  const im = await loadImg(src);
  const s = Math.min(1, max / im.width);
  const cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
  if (logo) {
    const L = await loadImg(logo); const w = Math.round(cv.width * size); const hh = Math.round((L.height / L.width) * w); const m = Math.round(cv.width * 0.025);
    const x = pos.includes('r') ? cv.width - w - m : m; const y = pos.includes('t') ? m : cv.height - hh - m;
    g.globalAlpha = 0.95; g.drawImage(L, x, y, w, hh); g.globalAlpha = 1;
  }
  return cv.toDataURL('image/jpeg', 0.86);
}
async function pdfFirstPage(file) {
  const pdfjs = await import('../vendor/pdfjs.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pg = await doc.getPage(1); const v0 = pg.getViewport({ scale: 1 });
  const vp = pg.getViewport({ scale: Math.min(3, 1400 / v0.width) });
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  return cv.toDataURL('image/jpeg', 0.86);
}
const upload = async (data, name) => api('upload', { data, name }, 300000);
async function logoData() {
  if (K.logoData) return K.logoData;
  if (K.logo) { try { K.logoData = (await api('fileData', { id: K.logo })).data; return K.logoData; } catch { /* ברירת מחדל */ } }
  K.logoData = SITE_LOGO;
  return K.logoData;
}
/** סיבוב תמונה ב-90° × n (מחזיר JPEG) */
async function rotateJpeg(src, deg, logo = null, pos = 'bl') {
  const im = await loadImg(src); const r = ((deg % 360) + 360) % 360; const side = r === 90 || r === 270;
  const cv = document.createElement('canvas'); cv.width = side ? im.height : im.width; cv.height = side ? im.width : im.height;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.translate(cv.width / 2, cv.height / 2); g.rotate((r * Math.PI) / 180); g.drawImage(im, -im.width / 2, -im.height / 2);
  return toJpeg(cv.toDataURL('image/jpeg', 0.95), { logo, pos });
}
/** חיתוך לפי שברים {x,y,w,h} (0–1) */
async function cropJpeg(src, c) {
  const im = await loadImg(src);
  const x = Math.round(c.x * im.width); const y = Math.round(c.y * im.height); const w = Math.max(1, Math.round(c.w * im.width)); const hh = Math.max(1, Math.round(c.h * im.height));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.drawImage(im, x, y, w, hh, 0, 0, w, hh);
  return cv.toDataURL('image/jpeg', 0.95);
}
/** סיבוב של מלבן חיתוך ב-90° עם כיוון השעון */
const rotCrop = (c) => (c ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : null);
/** כלי חיתוך: גוררים מלבן על התמונה → שברים, או null */
function cropDialog(src, init) {
  return new Promise((ok) => {
    const d = document.createElement('dialog'); d.className = 'kol-dlg kol-crop';
    d.innerHTML = `<h2>✂ חיתוך</h2><p class="muted small">גוררים עם העכבר מלבן על החלק שרוצים להשאיר.</p>
      <div class="kol-cw"><img alt=""><div class="kol-cr" hidden></div></div>
      <div class="actions"><button type="button" class="btn primary" data-ok>✓ חיתוך</button><button type="button" class="btn" data-all>בלי חיתוך (כל התמונה)</button><button type="button" class="btn" data-x>ביטול</button></div>`;
    document.body.append(d); d.showModal();
    const im = $('img', d); const box = $('.kol-cr', d); const wrap = $('.kol-cw', d); im.src = src;
    let c = init ? { ...init } : null; let a = null;
    const draw = () => { if (!c) { box.hidden = true; return; } box.hidden = false; Object.assign(box.style, { left: `${c.x * im.clientWidth}px`, top: `${c.y * im.clientHeight}px`, width: `${c.w * im.clientWidth}px`, height: `${c.h * im.clientHeight}px` }); };
    im.onload = draw;
    const pt = (ev) => { const r = im.getBoundingClientRect(); return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))]; };
    wrap.onpointerdown = (ev) => { ev.preventDefault(); wrap.setPointerCapture(ev.pointerId); a = pt(ev); c = null; draw(); };
    wrap.onpointermove = (ev) => { if (!a) return; const [x, y] = pt(ev); c = { x: Math.min(a[0], x), y: Math.min(a[1], y), w: Math.abs(x - a[0]), h: Math.abs(y - a[1]) }; draw(); };
    wrap.onpointerup = () => { a = null; if (c && (c.w < 0.03 || c.h < 0.03)) { c = null; draw(); } };
    const end = (v) => { d.close(); d.remove(); ok(v); };
    $('[data-ok]', d).onclick = () => end(c ? { x: +c.x.toFixed(4), y: +c.y.toFixed(4), w: +c.w.toFixed(4), h: +c.h.toFixed(4) } : 'none');
    $('[data-all]', d).onclick = () => end('none');
    $('[data-x]', d).onclick = () => end(null);
  });
}
const srcCache = {};
/** התמונה הנקייה (בלי לוגו) מהמקור: סיבוב → חיתוך */
async function cleanRender(it) {
  if (!it.rot && !it.crop) { it.id = it.orig; return; }
  let data = await rotateJpeg(await driveData(it.orig), it.rot || 0);
  if (it.crop) data = await cropJpeg(data, it.crop);
  const r = await upload(data, 'תמונה.jpg'); srcCache[r.id] = data; it.id = r.id;
}
async function driveData(id) { if (!srcCache[id]) srcCache[id] = (await api('fileData', { id })).data; return srcCache[id]; }
function pickFiles(accept) {
  return new Promise((ok) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = true; i.onchange = () => ok([...i.files]); i.click(); });
}
function pickFile(accept) {
  return new Promise((ok) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => ok(i.files[0] || null); i.click(); });
}

// ---------------------------------------------------------------- כניסה + דף ראשי
function head(title, back) {
  $('#kol-title').innerHTML = `${back ? '<button type="button" class="btn ghost" id="kol-back">→ חזרה</button> ' : ''}📻 ${h(title)} <button type="button" class="btn ghost kol-gear" id="kol-gear" title="לוגו, ראש ותחתית של המייל">⚙ הגדרות</button>`;
  $('#kol-back')?.addEventListener('click', back);
  $('#kol-gear').onclick = () => settingsDialog();
}
function hub() {
  head('קול אונגוואר');
  main.innerHTML = `<div class="kol-hub">
      <button type="button" class="lobby-tile kol-tile" data-k="weekly"><span class="lobby-icon">📅</span><b>מהנעשה והנשמע</b><span class="muted small">אימייל שבועי</span></button>
      <button type="button" class="lobby-tile kol-tile" data-k="once"><span class="lobby-icon">✉️</span><b>אימייל חד פעמי</b><span class="muted small">שמירה, ממתינים לשליחה</span></button>
      <button type="button" class="lobby-tile kol-tile" data-k="arch"><span class="lobby-icon">🗂</span><b>ארכיון מנהלים</b><span class="muted small">כל מה שנשלח · תמונות בלי לוגו</span></button>
    </div>
    <div class="kol-foot"><a href="../kolungvar/" target="_blank">🌐 הדף הציבורי (ungvar.org/kolungvar)</a> · <button type="button" class="linkish" id="kol-set">⚙ הגדרות (לוגו, ראש ותחתית)</button>
      <span class="muted small">· שולח: ${h(K.from)} · נשארו היום: ${h(K.quota)} מיילים</span></div>
    <div class="kol-logo" id="kol-logo"></div>`;
  logoBox($('#kol-logo'));
  $$('[data-k]', main).forEach((b) => { b.onclick = () => ({ weekly: openWeekly, once: openOnce, arch: adminArchive })[b.dataset.k](); });
  $('#kol-set').onclick = settingsDialog;
}

// ---------------------------------------------------------------- שבועי
/** "מהנעשה והנשמע": טיוטה אחת שנשארת עד פרסום / מחיקה; התאריך והפרשה — של יום הפרסום */
const newWeekly = () => ({ kind: 'weekly', week: '', title: '', subject: 'מהנעשה והנשמע — {פרשת השבוע}', blocks: [], opts: { ...(K.defaults || {}) }, status: 'draft' });
async function openWeekly() {
  head('מהנעשה והנשמע', hub);
  main.innerHTML = '<p class="muted">טוען…</p>';
  try { await loadList(); } catch (err) { toast(msg(err), 'error'); }
  const drafts = K.emails.filter((x) => x.kind === 'weekly' && x.status !== 'sent')
    .sort((a, b) => ((b.blocks || []).length ? 1 : 0) - ((a.blocks || []).length ? 1 : 0) || String(b.updated_at).localeCompare(String(a.updated_at)));
  editor(drafts[0] || newWeekly(), hub);
}

// ---------------------------------------------------------------- חד פעמי
async function openOnce() {
  head('אימייל חד פעמי', hub);
  main.innerHTML = '<p class="muted">טוען…</p>';
  try { await loadList(); } catch (err) { toast(msg(err), 'error'); }
  const pend = K.emails.filter((x) => x.kind === 'once' && x.status !== 'sent').sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const sent = K.emails.filter((x) => x.kind === 'once' && x.status === 'sent');
  const row = (x, isSent) => `<tr data-id="${h(x.id)}"><td><b>${h(x.title || fillTags(x.subject, x) || '(בלי שם)')}</b><div class="muted small">${h(fillTags(x.subject, x))}</div></td>
    <td class="small">${h(isSent ? `נשלח ${x.sent_at} · ${x.sent_n} נמענים` : `עודכן ${x.updated_at} · ${String(x.updated_by).split('@')[0]}`)}</td>
    <td>${isSent ? '<button type="button" class="btn small-btn" data-dup>⧉ שכפול</button>' : '<button type="button" class="btn small-btn primary" data-open>✏️ פתיחה</button> <button type="button" class="btn small-btn danger" data-del>🗑</button>'}</td></tr>`;
  main.innerHTML = `<p><button type="button" class="btn primary" id="ko-new">＋ אימייל חד פעמי חדש</button></p>
    <h3>⏳ ממתינים לשליחה (${pend.length})</h3>
    ${pend.length ? `<table class="ms-table kol-tbl"><tbody>${pend.map((x) => row(x, false)).join('')}</tbody></table>` : '<p class="muted">אין.</p>'}
    <h3>✔ נשלחו לאחרונה</h3>
    ${sent.length ? `<table class="ms-table kol-tbl"><tbody>${sent.map((x) => row(x, true)).join('')}</tbody></table>` : '<p class="muted">אין עדיין. (העותקים המלאים — ב"דואר יוצא" של kol@ungvar.org)</p>'}`;
  const byId = (el) => K.emails.find((x) => x.id === el.closest('tr').dataset.id);
  $('#ko-new').onclick = () => editor({ kind: 'once', title: '', subject: '', blocks: [], opts: { ...(K.defaults || {}) }, status: 'draft' }, openOnce);
  $$('[data-open]', main).forEach((b) => { b.onclick = () => editor(byId(b), openOnce); });
  $$('[data-dup]', main).forEach((b) => { b.onclick = () => { const x = byId(b); editor({ kind: 'once', title: `${x.title || ''} (עותק)`, subject: x.subject, blocks: JSON.parse(JSON.stringify(x.blocks)), opts: { ...x.opts }, status: 'draft' }, openOnce); }; });
  $$('[data-del]', main).forEach((b) => { b.onclick = async () => { const x = byId(b); if (!confirm(`למחוק את "${x.title || x.subject}"?`)) return; try { await api('remove', { id: x.id }); openOnce(); } catch (err) { toast(msg(err), 'error'); } }; });
}

// ---------------------------------------------------------------- עורך טקסט עשיר
const SIZES = [['12px', 'קטן'], ['14px', 'רגיל-'], ['16px', 'רגיל'], ['19px', 'בינוני'], ['23px', 'גדול'], ['28px', 'גדול מאוד'], ['36px', 'כותרת']];
function rich(html, onChange) {
  const wrap = document.createElement('div'); wrap.className = 'kol-rich';
  wrap.innerHTML = `<div class="kol-tb">
      <select data-c="font" title="גופן"><option value="">גופן</option>${FONTS.map(([v, n]) => `<option value='${v}' style='font-family:${v}'>${n}</option>`).join('')}</select>
      <select data-c="size" title="גודל"><option value="">גודל</option>${SIZES.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>
      <button type="button" data-c="bold" title="מודגש"><b>B</b></button><button type="button" data-c="italic" title="נטוי"><i>I</i></button><button type="button" data-c="underline" title="קו תחתון"><u>U</u></button>
      <label title="צבע אותיות">A<input type="color" data-c="foreColor" value="#7a1f1f"></label><label title="צבע רקע לטקסט">▇<input type="color" data-c="hiliteColor" value="#fff3b0"></label>
      <button type="button" data-c="justifyRight" title="ימין">⇥</button><button type="button" data-c="justifyCenter" title="מרכז">≡</button><button type="button" data-c="justifyLeft" title="שמאל">⇤</button>
      <button type="button" data-c="link" title="קישור">🔗</button><button type="button" data-c="tag" title="תגית {פרשת השבוע}">{פרשה}</button><button type="button" data-c="tagd" title="תגית {תאריך} — התאריך העברי של יום הפרסום">{תאריך}</button><button type="button" data-c="removeFormat" title="ניקוי עיצוב">⌫</button>
    </div><div class="kol-ed" contenteditable="true" dir="rtl"></div>`;
  const ed = $('.kol-ed', wrap); ed.innerHTML = cleanHtml(html || '');
  const fire = () => onChange(cleanHtml(ed.innerHTML));
  ed.addEventListener('input', fire);
  // הבחירה נשמרת — רשימה / צבע לוקחים את הפוקוס, ואז מחזירים אותה
  let last = null;
  const keep = () => { const sel = getSelection(); if (sel.rangeCount && ed.contains(sel.anchorNode)) last = sel.getRangeAt(0).cloneRange(); };
  ['keyup', 'mouseup', 'input'].forEach((ev) => ed.addEventListener(ev, keep));
  const restore = () => { if (!last) return; const sel = getSelection(); sel.removeAllRanges(); sel.addRange(last); };
  const wrapSel = (css) => {
    restore();
    const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed || !ed.contains(sel.anchorNode)) { toast('קודם לסמן טקסט.'); return; }
    const r = sel.getRangeAt(0); const sp = document.createElement('span'); sp.setAttribute('style', css);
    try { sp.appendChild(r.extractContents()); r.insertNode(sp); } catch { /* */ }
    fire();
  };
  $$('.kol-tb [data-c]', wrap).forEach((el) => {
    const c = el.dataset.c;
    const run = () => {
      ed.focus(); restore(); document.execCommand('styleWithCSS', false, true);
      if (c === 'font') { if (el.value) wrapSel(`font-family:${el.value}`); el.value = ''; return; }
      if (c === 'size') { if (el.value) wrapSel(`font-size:${el.value}`); el.value = ''; return; }
      if (c === 'link') { const u = prompt('כתובת הקישור (https://…):'); if (u) document.execCommand('createLink', false, u.trim()); fire(); return; }
      if (c === 'tag') { document.execCommand('insertText', false, '{פרשת השבוע}'); fire(); return; }
      if (c === 'tagd') { document.execCommand('insertText', false, '{תאריך}'); fire(); return; }
      if (c === 'hiliteColor') { if (!document.execCommand('hiliteColor', false, el.value)) document.execCommand('backColor', false, el.value); fire(); return; }
      document.execCommand(c, false, el.value || null); fire();
    };
    if (el.tagName === 'BUTTON') el.onmousedown = (ev) => { ev.preventDefault(); run(); };
    else el.onchange = run;
  });
  return wrap;
}

// ---------------------------------------------------------------- העורך
function editor(e0, back) {
  const E = JSON.parse(JSON.stringify(e0)); E.blocks ||= []; E.opts ||= {};
  if (E.kind === 'weekly' && E.status !== 'sent') E.week = ''; // נקבע ביום הפרסום
  let base = E.updated_at || ''; let dirty = false; let saving = false; let timer = null; let open = -1;
  const sent = E.status === 'sent';
  const title = E.kind === 'weekly' ? `מהנעשה והנשמע${sent ? ` — ${dayText(dateOf(E))}` : ''}` : (E.title || 'אימייל חד פעמי');
  head(title, () => { if (dirty) save().then(back); else back(); });
  main.innerHTML = `<div class="kol-ed-wrap">
    <div class="kol-left">
      <div class="kol-bar">
        ${sent ? '' : `<span class="small">📅 אם יפורסם היום: <b>${h(dayText(dateOf(E)))}</b> · ${h(shabbatTitle(weekOf(E)))}</span>`}
        <span class="spacer"></span><span class="muted small" id="ke-st"></span>
      </div>
      ${sent ? `<p class="kol-sent">✔ נשלח ${h(E.sent_at)} ל-${h(E.sent_n)} נמענים${E.sent_by ? ` (${h(String(E.sent_by).split('@')[0])})` : ''}. אי אפשר לערוך מייל שנשלח.</p>` : ''}
      ${E.kind === 'once' ? `<label class="kol-f">שם פנימי (רק לכם)<input id="ke-title" value="${h(E.title)}" placeholder="למשל: הזמנה לדינער"${sent ? ' disabled' : ''}></label>` : ''}
      <label class="kol-f">נושא המייל<input id="ke-subj" value="${h(E.subject)}" placeholder="נושא — אפשר {פרשת השבוע}"${sent ? ' disabled' : ''}></label>
      <div id="ke-blocks"></div>
      ${sent ? '' : `<div class="kol-add"><span class="muted small">הוספה:</span>${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="btn" data-add="${k}">${v.icon} ${v.name}</button>`).join('')}</div>
      <details class="kol-look"><summary>🎨 עיצוב כללי</summary>
        <label>רקע מסביב <input type="color" data-o="bg" value="${h(E.opts.bg || '#efe9dc')}"></label>
        <label>רקע המייל <input type="color" data-o="card" value="${h(E.opts.card || '#ffffff')}"></label>
        <label>צבע טקסט <input type="color" data-o="color" value="${h(E.opts.color || '#1d1d1d')}"></label>
        <label>גופן <select data-o="font">${FONTS.map(([v, n]) => `<option value='${v}'${(E.opts.font || DEF_FONT) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <button type="button" class="linkish" id="ke-def">💾 לשמור כברירת מחדל למיילים הבאים</button>
        <div class="kol-hfown"><label class="check"><input type="checkbox" id="ke-hfown"${E.opts.hf?.own ? ' checked' : ''}> ראש ותחתית מיוחדים למייל הזה (אחרת — מה שב־⚙ הגדרות)</label><div id="ke-hf"></div></div></details>
      <div class="kol-actions">
        <button type="button" class="btn" id="ke-save">💾 שמירה</button>
        <button type="button" class="btn" id="ke-test">📨 שלח ניסיון אליי</button>
        <button type="button" class="btn small-btn danger" id="ke-del" title="מחיקת הטיוטה">🗑 מחיקה</button>
        <span class="spacer"></span>
        <select id="ke-list" title="רשימת התפוצה"></select>
        <button type="button" class="btn primary" id="ke-pub">🚀 פרסום</button>
      </div><p class="small" id="ke-rcp"></p>`}
    </div>
    <div class="kol-right"><div class="muted small">תצוגה מקדימה <button type="button" class="linkish" id="ke-mob">📱 טלפון</button></div><iframe id="ke-prev-f" title="תצוגה מקדימה"></iframe></div>
  </div>`;
  const st = (t) => { $('#ke-st').textContent = t; };
  st(E.updated_at ? `נשמר ${E.updated_at} · ${String(E.updated_by || '').split('@')[0]}` : 'עוד לא נשמר');
  // תצוגה מקדימה
  let pv = null;
  const preview = () => { clearTimeout(pv); pv = setTimeout(() => { $('#ke-prev-f').srcdoc = emailHtml(E, 'preview', ctx()); }, 250); };
  $('#ke-mob').onclick = () => $('#ke-prev-f').classList.toggle('mob');
  // שמירה
  const save = async () => {
    if (sent) return;
    if (saving) { await new Promise((r) => { setTimeout(r, 400); }); return save(); }
    saving = true; clearTimeout(timer); st('שומר…');
    try {
      const r = await api('save', { email: { id: E.id, kind: E.kind, week: E.week, title: E.title, subject: E.subject, blocks: E.blocks, opts: E.opts }, base });
      E.id = r.email.id; E.updated_at = base = r.email.updated_at; E.updated_by = r.email.updated_by; dirty = false;
      st(`נשמר ${E.updated_at}`);
    } catch (err) {
      st('⚠ לא נשמר'); toast(msg(err), 'error');
      if (String(err.message).startsWith('conflict')) { await loadList(); const fresh = K.emails.find((x) => x.id === E.id); if (fresh) editor(fresh, back); }
    } finally { saving = false; }
  };
  const changed = () => { dirty = true; st('לא נשמר עדיין…'); preview(); clearTimeout(timer); timer = setTimeout(save, 2500); };
  window.onbeforeunload = () => (dirty ? 'יש שינויים שלא נשמרו' : undefined);
  document.onvisibilitychange = () => { if (document.hidden && dirty) save(); }; // יוצאים מהלשונית — שומרים

  if (!sent) {
    $('#ke-subj').oninput = (ev) => { E.subject = ev.target.value; changed(); };
    $('#ke-title')?.addEventListener('input', (ev) => { E.title = ev.target.value; changed(); });
    $$('[data-o]', main).forEach((el) => { el.oninput = () => { E.opts[el.dataset.o] = el.value; changed(); }; });
    $('#ke-def').onclick = async () => { try { await api('settings', { defaults: E.opts }); K.defaults = { ...E.opts }; toast('נשמר כברירת מחדל.'); } catch (err) { toast(msg(err), 'error'); } };
    $$('[data-add]', main).forEach((b) => { b.onclick = () => addBlock(b.dataset.add); });
    $('#ke-save').onclick = save;
    $('#ke-test').onclick = async (ev) => {
      const btn = ev.currentTarget; btn.disabled = true;
      try {
        await burn((t) => { btn.textContent = t; }); await save();
        btn.textContent = '⏳ שולח…';
        const html = emailHtml(E, 'mail', ctx());
        if (sizeOk(html)) { const r = await api('test', { subject: `[ניסיון] ${fillTags(E.subject, E)}`, html, text: emailText(E), files: fileIds() }); toast(`נשלח ניסיון ל-${r.to}.`); }
      } catch (err) { toast(msg(err), 'error'); }
      btn.disabled = false; btn.textContent = '📨 שלח ניסיון אליי';
    };
    $('#ke-del').onclick = async () => {
      if (!confirm('למחוק את כל הטיוטה הזו?\nאי אפשר לשחזר.')) return;
      try { clearTimeout(timer); if (E.id) await api('remove', { id: E.id }); dirty = false; window.onbeforeunload = null; toast('✓ נמחק.'); if (E.kind === 'weekly') editor(newWeekly(), back); else back(); } catch (err) { toast(msg(err), 'error'); }
    };
    // ראש ותחתית מיוחדים למייל
    const hfBox = $('#ke-hf');
    const drawHf = () => { hfBox.innerHTML = ''; if (E.opts.hf?.own) hfForm(hfBox, E.opts.hf, changed); };
    $('#ke-hfown').onchange = (ev) => {
      if (ev.target.checked) E.opts.hf = { own: true, header: JSON.parse(JSON.stringify({ ...DEF_HEADER, ...K.header })), footer: JSON.parse(JSON.stringify({ ...DEF_FOOTER, ...K.footer })) };
      else delete E.opts.hf;
      drawHf(); changed();
    };
    drawHf();
    // רשימות התפוצה
    const lsel = $('#ke-list');
    const fillLists = () => { lsel.innerHTML = listNames().map((n) => `<option${n === (E.opts.list || LIST_NAME) ? ' selected' : ''}>${h(n)}</option>`).join(''); rcpInfo(); };
    const rcpInfo = () => { const r = recipients(lsel.value); $('#ke-rcp').innerHTML = `👥 רשימת התפוצה "<b>${h(lsel.value)}</b>": <b>${r.send.length}</b> נמענים${r.off.length ? ` · ${r.off.length} הסירו את עצמם (לא יקבלו)` : ''}.`; };
    lsel.onchange = () => { E.opts.list = lsel.value; changed(); rcpInfo(); };
    $('#ke-rcp').textContent = 'טוען את רשימת הנמענים…';
    loadPeople().then(fillLists).catch((err) => { $('#ke-rcp').innerHTML = `<span class="rf-err">לא הצלחתי לטעון את אנשי הקשר: ${h(msg(err))}</span>`; });
    $('#ke-pub').onclick = publish;
  }
  const fileIds = () => E.blocks.filter((b) => b.type === 'file' && b.attach && b.file?.id).map((b) => b.file.id);

  /** Gmail חותך מייל שה-HTML שלו מעל ~102KB ("[ההודעה נחתכה]") */
  function sizeOk(html) {
    const kb = Math.round(new Blob([html]).size / 1024);
    if (kb <= 95) return true;
    return confirm(`המייל גדול (${kb}KB). ב-Gmail מייל מעל ~100KB נחתך באמצע עם "[ההודעה נחתכה]", וזה גם פוגע במוניטין.\nכדאי לקצר טקסט / לפצל לשני מיילים.\n\nלשלוח בכל זאת?`);
  }
  /** צריבת הלוגו בתמונות (רק לשליחה / לניסיון — בעריכה הלוגו רק מוצג מעל) */
  async function burn(say = () => {}) {
    const jobs = [];
    E.blocks.forEach((b) => {
      if (b.type !== 'photo') return;
      (b.imgs || []).forEach((it) => {
        if (b.logo === false || it.gif || it.baked) { delete it.pub; delete it.pubKey; return; }
        const key = `${it.id}|${K.logo || 'site'}|${b.lpos || 'bl'}`;
        if (it.pub && it.pubKey === key) return;
        jobs.push([it, b, key]);
      });
    });
    let n = 0;
    for (const [it, b, key] of jobs) {
      say(`⏳ לוגו ${++n} / ${jobs.length}…`);
      const data = await toJpeg(await driveData(it.id), { logo: await logoData(), pos: b.lpos || 'bl' });
      const r = await upload(data, 'עם-לוגו.jpg'); it.pub = r.id; it.pubKey = key;
    }
    if (jobs.length) dirty = true;
  }
  // תמונות ישנות שהלוגו נצרב בהן כבר בהעלאה → גרסה נקייה מהמקור
  (async () => {
    if (sent) return;
    await new Promise((r) => { setTimeout(r, 0); }); // אחרי שהעורך מוכן
    let did = false;
    for (const b of E.blocks) {
      if (b.type !== 'photo' && b.type !== 'ad') continue;
      if (!b.imgs) { b.imgs = imgsOf(b); delete b.img; delete b.pdf; }
      for (const it of b.imgs) {
        if (it.clean || it.gif || it.baked) continue;
        if (!it.orig) { if (b.type === 'photo') it.baked = true; else it.clean = true; did = true; continue; }
        if (it.orig !== it.id || it.rot || it.crop) { try { await cleanRender(it); } catch { continue; } }
        it.clean = true; did = true;
      }
    }
    if (did) { drawBlocks(); changed(); }
  })();
  // ---------------- רכיבים
  const NEW = {
    ad: () => ({ type: 'ad', img: null, pdf: null, link: '', text: '', arch: true }),
    photo: () => ({ type: 'photo', img: null, text: '', moreLink: '', moreLabel: 'לעוד תמונות מהמעמד', logo: true, arch: true }),
    file: () => ({ type: 'file', file: null, img: null, text: '', btnLabel: '', attach: false, arch: true }),
    text: () => ({ type: 'text', html: '', align: 'center', arch: true }),
    video: () => ({ type: 'video', url: '', title: '', thumb: null, text: '', arch: true }),
    button: () => ({ type: 'button', label: '', link: '', color: '#ffffff', btnBg: '#7a1f1f', arch: true }),
  };
  const addBlock = (k) => { E.blocks.push(NEW[k]()); open = E.blocks.length - 1; drawBlocks(); changed(); setTimeout(() => $(`[data-i="${open}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };
  const summary = (b) => {
    const strip = (x) => String(x || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
    if (b.type === 'text') return strip(b.html) || '(ריק)';
    if (b.type === 'button') return b.label || '(בלי כיתוב)';
    if (b.type === 'video') return b.title || b.url || '(בלי קישור)';
    if (b.type === 'file') return b.file?.name || '(בלי קובץ)';
    const n = imgsOf(b).length;
    return (n > 1 ? `${n} תמונות · ` : '') + (strip(b.text) || (n || b.img ? '' : '(בלי תמונה)'));
  };
  const thumbOf = (b) => { const id = imgsOf(b)[0]?.id || b.img?.id || b.thumb?.id; return id ? `<img src="${imgUrl(id, 160)}" alt="">` : `<span class="kol-ic">${KINDS[b.type].icon}</span>`; };
  function drawBlocks() {
    const box = $('#ke-blocks');
    box.innerHTML = E.blocks.map((b, i) => `<div class="kol-blk${open === i ? ' open' : ''}" data-i="${i}">
      <div class="kol-bh">${thumbOf(b)}<div class="kol-bt"><b>${KINDS[b.type].icon} ${KINDS[b.type].name}</b><span class="muted small">${h(summary(b))}</span></div>
        ${E.kind === 'weekly' ? `<label class="kol-arch" title="לעלות גם לדף הציבורי"><input type="checkbox" data-arch${b.arch !== false ? ' checked' : ''}${sent ? ' disabled' : ''}> לארכיון</label>` : ''}
        ${sent ? '' : `<button type="button" class="btn small-btn" data-up title="למעלה"${i ? '' : ' disabled'}>▲</button><button type="button" class="btn small-btn" data-down title="למטה"${i < E.blocks.length - 1 ? '' : ' disabled'}>▼</button>
        <button type="button" class="btn small-btn" data-edit>${open === i ? 'סגירה' : '✏️ עריכה'}</button><button type="button" class="btn small-btn danger" data-rm title="מחיקה">🗑</button>`}</div>
      ${open === i && !sent ? '<div class="kol-bf"></div>' : ''}</div>`).join('') || '<p class="muted kol-empty">עוד אין כלום. מוסיפים רכיבים מהכפתורים למטה.</p>';
    $$('.kol-blk', box).forEach((el) => {
      const i = Number(el.dataset.i); const b = E.blocks[i];
      $('[data-arch]', el)?.addEventListener('change', (ev) => { b.arch = ev.target.checked; changed(); });
      $('[data-up]', el)?.addEventListener('click', () => { [E.blocks[i - 1], E.blocks[i]] = [E.blocks[i], E.blocks[i - 1]]; open = open === i ? i - 1 : open; drawBlocks(); changed(); });
      $('[data-down]', el)?.addEventListener('click', () => { [E.blocks[i + 1], E.blocks[i]] = [E.blocks[i], E.blocks[i + 1]]; open = open === i ? i + 1 : open; drawBlocks(); changed(); });
      $('[data-edit]', el)?.addEventListener('click', () => { open = open === i ? -1 : i; drawBlocks(); });
      $('[data-rm]', el)?.addEventListener('click', () => { if (!confirm(`למחוק את ה${KINDS[b.type].name}?`)) return; E.blocks.splice(i, 1); open = -1; drawBlocks(); changed(); });
      const f = $('.kol-bf', el); if (f) form(f, b);
    });
  }
  // ---------------- טופס של רכיב
  function form(f, b) {
    const refresh = () => { const s = f.closest('.kol-blk'); if (s) { $('.kol-bt span', s).textContent = summary(b); const t = $('.kol-bh > img, .kol-bh > .kol-ic', s); if (t) t.outerHTML = thumbOf(b); } };
    const up = () => { changed(); refresh(); };
    const inp = (k, label, ph = '', type = 'text', ltr = false) => `<label class="kol-f">${h(label)}<input data-k="${k}" type="${type}" value="${h(b[k] || '')}" placeholder="${h(ph)}"${ltr ? ' dir="ltr"' : ''}></label>`;
    const colors = (pairs) => `<div class="kol-row">${pairs.map(([k, l, d]) => `<label>${h(l)} <input type="color" data-k="${k}" value="${h(b[k] || d)}"></label>`).join('')}</div>`;
    const bgRow = `<div class="kol-row"><label>רקע לרכיב <input type="color" data-k="bg" value="${h(b.bg || '#ffffff')}"></label> <button type="button" class="linkish" data-nobg>בלי רקע</button>
      <label>יישור <select data-k="align">${[['center', 'מרכז'], ['right', 'ימין'], ['left', 'שמאל'], ['justify', 'מיושר']].map(([v, n]) => `<option value="${v}"${(b.align || 'center') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
    const imgPick = (label, accept) => `<div class="kol-row"><button type="button" class="btn" data-pick>⬆ ${h(label)}</button><span class="small muted" data-pst></span></div>`;
    if ((b.type === 'ad' || b.type === 'photo') && !b.imgs) { b.imgs = imgsOf(b); delete b.img; delete b.pdf; }
    const ov = (it) => (b.type === 'photo' && b.logo !== false && !it.gif && !it.baked ? `<img class="kol-ov ${b.lpos || 'bl'}" src="${K.logo ? imgUrl(K.logo, 200) : SITE_LOGO}" alt="">` : '');
    const gallery = (label) => `<div class="kol-gal">${b.imgs.map((it, j) => `<div class="kol-gi" data-j="${j}"><span class="kol-gw"><img src="${imgUrl(it.id, 240)}" alt="">${ov(it)}</span>
        <div class="kol-gb"><button type="button" class="btn small-btn" data-rot title="סיבוב 90°">⟳</button><button type="button" class="btn small-btn" data-crop title="חיתוך">✂</button>${b.imgs.length > 1 ? `<button type="button" class="btn small-btn" data-mv="-1" title="לפני"${j ? '' : ' disabled'}>▶</button><button type="button" class="btn small-btn" data-mv="1" title="אחרי"${j < b.imgs.length - 1 ? '' : ' disabled'}>◀</button>` : ''}<button type="button" class="btn small-btn danger" data-del title="הסרה">🗑</button></div>
        ${it.pdf ? '<span class="small muted">📄 PDF</span>' : ''}</div>`).join('')}</div>
      <div class="kol-row"><button type="button" class="btn" data-add>➕ ${h(label)}</button><span class="small muted" data-pst></span></div>`;
    let html = '';
    if (b.type === 'ad') html = `${gallery(b.imgs.length ? 'הוספת מודעה לאותה קבוצה' : 'בחירת מודעה (JPG / PNG / GIF / PDF)')}${inp('link', 'קישור בלחיצה על המודעה (רשות)', 'https://…', 'url', true)}${b.imgs.some((x) => x.pdf) ? '<p class="muted small">📄 PDF: בלחיצה נפתח ה-PDF המלא (אם לא כתבתם קישור אחר).</p>' : ''}<div class="kol-f">טקסט מתחת למודעה</div><div data-rich="text"></div>${bgRow}`;
    if (b.type === 'photo') html = `<div class="kol-row"><label class="check"><input type="checkbox" data-logo${b.logo !== false ? ' checked' : ''}> להוסיף את הלוגו</label>
        <label>מקום <select data-lpos>${[['bl', 'למטה שמאל'], ['br', 'למטה ימין'], ['tl', 'למעלה שמאל'], ['tr', 'למעלה ימין']].map(([v, n]) => `<option value="${v}"${(b.lpos || 'bl') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
      ${gallery(b.imgs.length ? 'הוספת תמונות לאותו מעמד' : 'בחירת תמונות')}${b.imgs.length > 1 ? `<div class="kol-row"><label>סידור <select data-cols><option value="1">אחת מתחת לשנייה</option><option value="2"${b.cols === 2 ? ' selected' : ''}>שתיים בשורה</option></select></label></div>` : ''}
      <p class="muted small">אפשר לבחור כמה תמונות ביחד. ⟳ סיבוב · ✂ חיתוך. הלוגו מוצג בתצוגה המקדימה, ונצרב בתמונה רק בפרסום (ובשליחת ניסיון). <button type="button" class="linkish" data-logoset>🖼 החלפת לוגו</button></p>
      <div class="kol-f">טקסט מתחת לתמונה</div><div data-rich="text"></div>${inp('moreLink', 'קישור לעוד תמונות מהמעמד (רשות)', 'https://…', 'url', true)}${inp('moreLabel', 'כיתוב הכפתור', 'לעוד תמונות מהמעמד')}${colors([['btnBg', 'צבע הכפתור', '#7a1f1f'], ['btnColor', 'צבע הכיתוב', '#ffffff']])}${bgRow}`;
    if (b.type === 'file') html = `<div class="kol-row"><button type="button" class="btn" data-file>📎 בחירת קובץ</button><span class="small">${b.file ? `${h(b.file.name)} (${Math.round((b.file.size || 0) / 1024)}KB)` : ''}</span></div>
      <label class="check"><input type="checkbox" data-attach${b.attach ? ' checked' : ''}> לצרף את הקובץ גם כקובץ מצורף למייל (עד 20MB) — אחרת רק קישור להורדה</label>
      ${imgPick('מודעה / תמונה שקשורה לקובץ (רשות)')}<div class="kol-f">טקסט</div><div data-rich="text"></div>${inp('btnLabel', 'כיתוב כפתור ההורדה', `להורדת ${b.file?.name || 'הקובץ'}`)}${colors([['btnBg', 'צבע הכפתור', '#2c4a6e'], ['btnColor', 'צבע הכיתוב', '#ffffff']])}${bgRow}`;
    if (b.type === 'text') html = `<div data-rich="html"></div>${bgRow}`;
    if (b.type === 'video') html = `${inp('url', 'קישור לסרטון בדרייב (פתוח לכל מי שיש לו קישור)', 'https://drive.google.com/file/d/…', 'url', true)}${inp('title', 'כותרת', 'לצפייה בסרטון')}
      ${imgPick('תמונה מקדימה (רשות — אחרת כפתור ▶)')}<p class="muted small">בלחיצה נפתח דף שלנו (ungvar.org/kolungvar) שמנגן את הסרטון — מתאים גם למי שיש לו פילטר שבו ungvar.org פתוח.</p>
      <div class="kol-f">טקסט</div><div data-rich="text"></div>${bgRow}`;
    if (b.type === 'button') html = `${inp('label', 'כיתוב הכפתור', 'למשל: לתרומה')}${inp('link', 'קישור', 'https://…', 'url', true)}${colors([['btnBg', 'צבע הכפתור', '#7a1f1f'], ['color', 'צבע הכיתוב', '#ffffff']])}${bgRow}`;
    f.innerHTML = html;
    $$('[data-k]', f).forEach((el) => { el.oninput = () => { b[el.dataset.k] = el.value; if (b.type === 'video' && el.dataset.k === 'url' && el.value && !driveId(el.value)) toast('זה לא נראה כמו קישור לדרייב.'); up(); }; });
    $('[data-nobg]', f)?.addEventListener('click', () => { delete b.bg; up(); });
    $$('[data-rich]', f).forEach((el) => { const k = el.dataset.rich; el.replaceWith(rich(b[k], (v) => { b[k] = v; up(); })); });
    $('[data-attach]', f)?.addEventListener('change', (ev) => { b.attach = ev.target.checked; changed(); });
    $('[data-cols]', f)?.addEventListener('change', (ev) => { b.cols = Number(ev.target.value); changed(); });
    // גלריה: הוספה (כמה ביחד), סיבוב, חיתוך, סדר, הסרה. הלוגו לא נצרב כאן — רק מוצג מעל; נצרב בפרסום.
    const busy = (t) => { const ps = $('[data-pst]', f); if (ps) ps.textContent = t; };
    $('[data-add]', f)?.addEventListener('click', async () => {
      const files = await pickFiles(b.type === 'ad' ? 'image/*,application/pdf' : 'image/*'); if (!files.length) return;
      let n = 0;
      for (const file of files) {
        busy(`⏳ מעלה ${++n} / ${files.length}…`);
        try {
          const it = { clean: true };
          if (file.type === 'image/gif') {
            if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: ה-GIF גדול מדי (עד 8MB).`);
            const r = await upload(await readUrl(file), file.name); it.id = r.id; it.gif = true;
            if (!r.public) toast('הקובץ הועלה, אבל לא נפתח לכולם — ייתכן שלא יופיע במייל.', 'error');
          } else {
            let plain;
            if (file.type === 'application/pdf') {
              if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: ה-PDF גדול מדי (עד 20MB).`);
              plain = await pdfFirstPage(file);
              const pdf = await upload(await readUrl(file), file.name); it.pdf = { id: pdf.id, name: file.name };
            } else plain = await toJpeg(await readUrl(file));
            const o = await upload(plain, file.name.replace(/\.\w+$/, '.jpg')); it.orig = o.id; it.id = o.id; srcCache[o.id] = plain;
            if (!o.public) toast('הקובץ הועלה, אבל לא נפתח לכולם — ייתכן שלא יופיע במייל.', 'error');
          }
          b.imgs.push(it); changed();
        } catch (err) { toast(msg(err), 'error'); }
      }
      busy(''); up(); drawBlocks(); save(); // תמונה הועלתה — שומרים מיד
    });
    $('[data-logo]', f)?.addEventListener('change', (ev) => { b.logo = ev.target.checked; changed(); });
    $('[data-lpos]', f)?.addEventListener('change', (ev) => { b.lpos = ev.target.value; changed(); });
    $('[data-logoset]', f)?.addEventListener('click', () => settingsDialog());
    $$('.kol-gi', f).forEach((el) => {
      const j = Number(el.dataset.j); const it = b.imgs[j];
      $('[data-del]', el).onclick = () => { if (!confirm('להסיר את התמונה?')) return; b.imgs.splice(j, 1); up(); drawBlocks(); };
      $$('[data-mv]', el).forEach((x) => { x.onclick = () => { const k = j + Number(x.dataset.mv); [b.imgs[j], b.imgs[k]] = [b.imgs[k], b.imgs[j]]; up(); drawBlocks(); }; });
      const work = async (btn, fn) => {
        if (it.gif) { toast('אי אפשר לערוך GIF (הוא יפסיק לזוז). מסובבים / חותכים אותו לפני ההעלאה.', 'error'); return; }
        const t = btn.textContent; btn.disabled = true; btn.textContent = '⏳';
        try {
          if (!it.orig) { it.orig = it.id; it.rot = 0; delete it.crop; } // תמונה ישנה — היא עצמה המקור
          if (await fn() === false) { btn.disabled = false; btn.textContent = t; return; }
          await cleanRender(it); up(); drawBlocks(); save();
        } catch (err) { btn.disabled = false; btn.textContent = t; toast(msg(err), 'error'); }
      };
      $('[data-rot]', el).onclick = (ev) => work(ev.currentTarget, () => { it.rot = ((it.rot || 0) + 90) % 360; it.crop = rotCrop(it.crop); });
      $('[data-crop]', el).onclick = (ev) => work(ev.currentTarget, async () => {
        const c = await cropDialog(await rotateJpeg(await driveData(it.orig), it.rot || 0), it.crop);
        if (!c) return false;
        if (c === 'none') delete it.crop; else it.crop = c;
        return true;
      });
    });
    // העלאת תמונה / מודעה (קובץ / וידאו)
    $('[data-pick]', f)?.addEventListener('click', async () => {
      const accept = b.type === 'ad' ? 'image/*,application/pdf' : 'image/*';
      const file = await pickFile(accept); if (!file) return;
      const ps = $('[data-pst]', f); ps.textContent = '⏳ מעלה…';
      try {
        let data; let pdf = null;
        if (file.type === 'application/pdf') {
          if (file.size > 20 * 1024 * 1024) throw new Error('ה-PDF גדול מדי (עד 20MB).');
          ps.textContent = '⏳ הופך את העמוד הראשון לתמונה…';
          data = await pdfFirstPage(file);
          pdf = await upload(await readUrl(file), file.name);
        } else if (file.type === 'image/gif') {
          if (file.size > 8 * 1024 * 1024) throw new Error('ה-GIF גדול מדי (עד 8MB).');
          data = await readUrl(file); // GIF — כמו שהוא (שיזוז)
        } else {
          const src = await readUrl(file);
          data = await toJpeg(src, b.type === 'photo' && b.logo !== false ? { logo: await logoData(), pos: b.lpos || 'bl' } : {});
        }
        const r = await upload(data, file.type === 'image/gif' ? file.name : file.name.replace(/\.\w+$/, '.jpg'));
        if (!r.public) toast('הקובץ הועלה, אבל לא נפתח לכולם — ייתכן שלא יופיע במייל. לבדוק את הגדרות השיתוף של Workspace.', 'error');
        if (b.type === 'video') b.thumb = { id: r.id }; else b.img = { id: r.id };
        if (pdf) b.pdf = { id: pdf.id, name: file.name };
        ps.textContent = '✓ הועלה'; up(); drawBlocks();
      } catch (err) { ps.textContent = ''; toast(msg(err), 'error'); }
    });
    $('[data-file]', f)?.addEventListener('click', async () => {
      const file = await pickFile('*/*'); if (!file) return;
      if (file.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי (עד 20MB).', 'error'); return; }
      toast('⏳ מעלה…');
      try { const r = await upload(await readUrl(file), file.name); b.file = { id: r.id, name: file.name, size: file.size, mime: file.type }; up(); drawBlocks(); toast('✓ הועלה'); } catch (err) { toast(msg(err), 'error'); }
    });
  }
  // ---------------- פרסום
  async function publish() {
    const name = $('#ke-list').value || LIST_NAME;
    if (!E.blocks.length) { toast('המייל ריק.', 'error'); return; }
    if (!String(E.subject || '').trim()) { toast('חסר נושא.', 'error'); return; }
    if (!K.phones) { toast('רשימת הנמענים עוד לא נטענה.', 'error'); return; }
    const r = recipients(name);
    if (!r.send.length) { toast(`אין נמענים ברשימה "${name}".`, 'error'); return; }
    if (r.send.length > K.quota) { toast(`נשארו היום רק ${K.quota} מיילים, וברשימה ${r.send.length}. אפשר לשלוח עכשיו חלק, ולהמשיך מחר (מי שכבר קיבל — לא יקבל שוב).`, 'error'); }
    if (!confirm(`לשלוח את "${fillTags(E.subject, E)}" ל-${r.send.length} נמענים ברשימה "${name}"?\nאחרי השליחה אי אפשר לבטל.`)) return;
    const btn = $('#ke-pub'); btn.disabled = true;
    try {
      await burn((t) => { btn.textContent = t; });
      if (E.kind === 'weekly') E.week = weekOf(E); // השבת של יום הפרסום
      if (!E.opts.hf?.own) E.opts.hfSent = { header: K.header, footer: K.footer }; // הראש / התחתית כמו שיצאו
      dirty = true; await save();
    } catch (err) { toast(msg(err), 'error'); btn.disabled = false; btn.textContent = '🚀 פרסום'; return; }
    if (dirty) { btn.disabled = false; btn.textContent = '🚀 פרסום'; return; }
    const html = emailHtml(E, 'mail', ctx()); const text = emailText(E); const subject = fillTags(E.subject, E); const files = fileIds();
    if (!sizeOk(html)) { btn.disabled = false; btn.textContent = '🚀 פרסום'; return; }
    // במנות של 40, עם הפסקה של חצי דקה ביניהן — לא "הפצצה" בבת אחת (טוב למוניטין)
    let sentN = 0; let errs = 0; const SIZE = 40; const PAUSE = 30;
    try {
      for (let i = 0; i < r.send.length; i += SIZE) {
        const last = i + SIZE >= r.send.length;
        if (i) for (let t = PAUSE; t > 0; t--) { btn.textContent = `⏸ ${sentN} נשלחו · ממשיך בעוד ${t} שנ'…`; await new Promise((ok) => { setTimeout(ok, 1000); }); }
        btn.textContent = `⏳ שולח… ${Math.min(i + SIZE, r.send.length)} / ${r.send.length}`;
        const res = await api('publish', { id: E.id, subject, html, text, files, recipients: r.send.slice(i, i + SIZE), final: last, first: i === 0 }, 330000);
        if (res.scanned && (res.scanned.bounce || res.scanned.mail)) toast(`הוסרו מהרשימה: ${res.scanned.bounce || 0} כתובות שחזרו, ${res.scanned.mail || 0} שביקשו הסרה במייל.`);
        sentN += res.sent; errs += (res.errors || []).length; K.quota = res.quota;
        if ((res.errors || []).some((x) => x.error === 'daily-limit')) { toast('הגענו למגבלה היומית. מחר אפשר ללחוץ שוב "פרסום" — מי שכבר קיבל לא יקבל שוב.', 'error'); break; }
      }
      toast(`✔ נשלח ל-${sentN} נמענים${errs ? ` · ${errs} שגיאות` : ''}.`);
      dirty = false; window.onbeforeunload = null;
      if (E.kind === 'weekly') { toast('נפתחה טיוטה חדשה לשבוע הבא.'); editor(newWeekly(), back); } else { await loadList(); const fresh = K.emails.find((x) => x.id === E.id); if (fresh) editor(fresh, back); }
    } catch (err) {
      toast(`השליחה נעצרה: ${msg(err)}. אפשר ללחוץ שוב "פרסום" — מי שכבר קיבל לא יקבל שוב.`, 'error');
      btn.disabled = false; btn.textContent = '🚀 פרסום';
    }
  }
  drawBlocks(); preview();
}

// ---------------------------------------------------------------- הגדרות
/** הגדרת הלוגו שמודבק על התמונות */
function logoBox(el, after) {
  const draw = () => {
    el.innerHTML = `<h3>🖼 הלוגו שמודבק על התמונות</h3>
      <div class="kol-row"><span class="kol-lp"><img src="${K.logo ? imgUrl(K.logo, 300) : SITE_LOGO}" alt=""></span>${K.logo ? '' : '<span class="muted small">(ברירת מחדל — הלוגו של האתר)</span>'}
        <button type="button" class="btn" data-lup>⬆ החלפת לוגו</button>${K.logo ? '<button type="button" class="btn" data-ldef>חזרה ללוגו של האתר</button>' : ''}</div>
      <p class="muted small">מומלץ PNG עם רקע שקוף. בעריכה הלוגו רק מוצג מעל התמונות; הוא נצרב בתמונה בפרסום — עם הלוגו שמוגדר כאן באותו רגע.</p>`;
    $('[data-lup]', el).onclick = async () => {
      const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return;
      try {
        toast('⏳ מעלה…');
        const r = await upload(await readUrl(f), `logo-${f.name}`);
        await api('settings', { logo: r.id }); K.logo = r.id; K.logoData = ''; draw(); toast('✓ הלוגו נשמר.'); after?.();
      } catch (err) { toast(msg(err), 'error'); }
    };
    $('[data-ldef]', el)?.addEventListener('click', async () => {
      try { await api('settings', { logo: '' }); K.logo = ''; K.logoData = ''; draw(); toast('✓ חזר ללוגו של האתר.'); after?.(); } catch (err) { toast(msg(err), 'error'); }
    });
  };
  draw();
}
/** טופס ראש + תחתית. hf = { header, footer } — משנה במקום וקורא ל-onChange */
function hfForm(box, hf, onChange) {
  hf.header = { ...DEF_HEADER, ...(hf.header || {}) }; hf.footer = { ...DEF_FOOTER, ...(hf.footer || {}) };
  const H = hf.header; const F = hf.footer; F.btns ||= [];
  const draw = () => {
    box.innerHTML = `<div class="kol-hf">
      <h3>⬆ ראש המייל</h3>
      <label class="check"><input type="checkbox" data-h="on"${H.on !== false ? ' checked' : ''}> להציג ראש</label>
      <div class="kol-row"><span class="kol-hfimg">${H.img?.id ? `<img src="${imgUrl(H.img.id, 400)}" alt="">` : '<span class="muted small">(בלי תמונה)</span>'}</span>
        <button type="button" class="btn small-btn" data-himg>⬆ תמונת באנר / לוגו</button>${H.img?.id ? '<button type="button" class="btn small-btn danger" data-hnoimg>הסרת התמונה</button>' : ''}
        <label>רוחב <select data-h="imgW">${[100, 75, 50, 35, 25].map((v) => `<option value="${v}"${Number(H.imgW || 100) === v ? ' selected' : ''}>${v}%</option>`).join('')}</select></label></div>
      <div class="kol-f">כותרת / טקסט בראש</div><div data-r="h"></div>
      <div class="kol-row"><label class="check"><input type="checkbox" data-h="date"${H.date !== false ? ' checked' : ''}> שורת תאריך אוטומטית (התאריך של יום הפרסום · הפרשה)</label></div>
      <div class="kol-row"><label>רקע <input type="color" data-h="bg" value="${h(H.bg || '#ffffff')}"></label><button type="button" class="linkish" data-hnobg>בלי רקע</button>
        <label>צבע טקסט <input type="color" data-h="color" value="${h(H.color || '#1d1d1d')}"></label></div>
      <h3>⬇ תחתית המייל</h3>
      <div class="kol-f">טקסט בתחתית (כתובת, טלפון…)</div><div data-r="f"></div>
      <div class="kol-f">כפתורים קבועים בתחתית</div>
      ${F.btns.map((x, i) => `<div class="kol-row" data-bi="${i}"><input data-b="label" value="${h(x.label)}" placeholder="כיתוב, למשל: לתרומה"><input data-b="link" dir="ltr" value="${h(x.link)}" placeholder="https://…">
        <input type="color" data-b="bg" value="${h(x.bg || '#7a1f1f')}" title="צבע הכפתור"><button type="button" class="btn small-btn danger" data-brm>🗑</button></div>`).join('')}
      <button type="button" class="btn small-btn" data-badd>＋ כפתור</button>
      <div class="kol-row"><label>רקע <input type="color" data-f="bg" value="${h(F.bg || '#ffffff')}"></label><button type="button" class="linkish" data-fnobg>בלי רקע</button>
        <label>צבע טקסט <input type="color" data-f="color" value="${h(F.color || '#6b6457')}"></label></div>
      <p class="muted small">בסוף התחתית תמיד: "כל המיילים הקודמים" ו"להסרה מרשימת התפוצה" (חובה — לא ניתן להוריד).</p></div>`;
    $$('[data-h]', box).forEach((el) => { el.onchange = el.oninput = () => { const k = el.dataset.h; H[k] = el.type === 'checkbox' ? el.checked : (k === 'imgW' ? Number(el.value) : el.value); onChange(); }; });
    $$('[data-f]', box).forEach((el) => { el.oninput = () => { F[el.dataset.f] = el.value; onChange(); }; });
    $('[data-hnobg]', box).onclick = () => { H.bg = ''; onChange(); draw(); };
    $('[data-fnobg]', box).onclick = () => { F.bg = ''; onChange(); draw(); };
    $('[data-r="h"]', box).replaceWith(rich(H.html, (v) => { H.html = v; onChange(); }));
    $('[data-r="f"]', box).replaceWith(rich(F.html, (v) => { F.html = v; onChange(); }));
    $('[data-himg]', box).onclick = async (ev) => {
      const file = await pickFile('image/*'); if (!file) return;
      const btn = ev.target; btn.disabled = true; btn.textContent = '⏳ מעלה…';
      try {
        const data = file.type === 'image/gif' || file.type === 'image/png' ? await readUrl(file) : await toJpeg(await readUrl(file));
        const r = await upload(data, `header-${file.name}`); H.img = { id: r.id }; onChange(); draw();
      } catch (err) { toast(msg(err), 'error'); btn.disabled = false; btn.textContent = '⬆ תמונת באנר / לוגו'; }
    };
    $('[data-hnoimg]', box)?.addEventListener('click', () => { H.img = null; onChange(); draw(); });
    $$('[data-bi]', box).forEach((row) => {
      const x = F.btns[Number(row.dataset.bi)];
      $$('[data-b]', row).forEach((el) => { el.oninput = () => { x[el.dataset.b] = el.value; onChange(); }; });
      $('[data-brm]', row).onclick = () => { F.btns.splice(Number(row.dataset.bi), 1); onChange(); draw(); };
    });
    $('[data-badd]', box).onclick = () => { F.btns.push({ label: '', link: '', bg: '#7a1f1f' }); draw(); };
  };
  draw();
}
function settingsDialog() {
  const d = document.createElement('dialog'); d.className = 'kol-dlg kol-set';
  const hf = { header: JSON.parse(JSON.stringify(K.header || {})), footer: JSON.parse(JSON.stringify(K.footer || {})) };
  let pv = null; let dirtyHf = false;
  d.innerHTML = `<h2>⚙ הגדרות קול אונגוואר</h2>
    <div class="kol-setg"><div><div id="ks-logo" class="kol-logo"></div><div id="ks-hf"></div></div>
      <div class="kol-right"><div class="muted small">תצוגה מקדימה (ראש ותחתית לכל המיילים)</div><iframe id="ks-pv" title="תצוגה"></iframe></div></div>
    <p class="muted small">המיילים יוצאים מ-<b>${h(K.from)}</b>. הסרות מהרשימה: ${K.unsubs.size}. מייל שסומן בו "ראש ותחתית מיוחדים" — לא מושפע מכאן.</p>
    <div class="actions"><button type="button" class="btn primary" id="ks-save">💾 שמירת הראש והתחתית</button><button type="button" class="btn" id="ks-x">סגירה</button></div>`;
  document.body.append(d); d.showModal();
  const sample = { kind: 'once', subject: 'דוגמה', status: 'draft', opts: { ...(K.defaults || {}) }, blocks: [{ type: 'text', html: '<p>[כאן התוכן של המייל]</p>', arch: true }] };
  const show = () => { clearTimeout(pv); pv = setTimeout(() => { $('#ks-pv', d).srcdoc = emailHtml(sample, 'preview', ctx({ header: hf.header, footer: hf.footer })); }, 250); };
  const close = () => { if (dirtyHf && !confirm('יש שינויים בראש / בתחתית שלא נשמרו. לסגור בלי לשמור?')) return; d.close(); d.remove(); };
  $('#ks-x', d).onclick = close;
  d.oncancel = (ev) => { ev.preventDefault(); close(); };
  logoBox($('#ks-logo', d), show);
  hfForm($('#ks-hf', d), hf, () => { dirtyHf = true; show(); });
  $('#ks-save', d).onclick = async (ev) => {
    ev.target.disabled = true;
    try { await api('settings', { header: hf.header, footer: hf.footer }); K.header = hf.header; K.footer = hf.footer; dirtyHf = false; toast('✓ הראש והתחתית נשמרו.'); } catch (err) { toast(msg(err), 'error'); }
    ev.target.disabled = false;
  };
  show();
}

// ---------------------------------------------------------------- ארכיון מנהלים
async function adminArchive() {
  head('ארכיון מנהלים', hub);
  main.innerHTML = '<p class="muted">טוען…</p>';
  let all = [];
  try { all = (await api('sentAll')).emails || []; } catch (err) { main.innerHTML = `<p class="rf-err">${h(msg(err))}</p>`; return; }
  const weekly = all.filter((e) => e.kind === 'weekly'); const once = all.filter((e) => e.kind === 'once');
  const yearOf = (e) => (toHebrew(weekOf(e)) || {}).y || 0;
  main.innerHTML = `<div class="kol-tabs"><button type="button" class="btn" data-t="w">📅 מהנעשה והנשמע (${weekly.length})</button><button type="button" class="btn" data-t="o">✉️ חד פעמי (${once.length})</button></div><div id="ka-body"></div>`;
  const body = $('#ka-body');
  const view = (e, full) => `<div class="kol-av"><h2 class="kp-h2">${h(fillTags(e.subject, e))}</h2>
    <p class="muted small">${h(dayText(dateOf(e)))} · ${h(e.sent_at)} · ${h(e.sent_n)} נמענים${e.sent_by ? ` · ${h(String(e.sent_by).split('@')[0])}` : ''}</p>
    ${full ? `<iframe class="kol-aif" title="המייל"></iframe>` : emailHtml(e, 'archive', ctx({ clean: true, dl: true }))}</div>`;
  const weeklyTab = () => {
    if (!weekly.length) { body.innerHTML = '<p class="muted">עוד לא פורסם.</p>'; return; }
    const years = [...new Set(weekly.map(yearOf))].sort((a, b) => b - a);
    body.innerHTML = `<p class="muted small">כמו הדף הציבורי — אבל התמונות בלי הלוגו, עם ⬇ הורדה.</p><div class="kp-arch"><nav class="kp-nav">${years.map((y, i) => `<details${i ? '' : ' open'}><summary>שנת ${h(yearLabel(y))}</summary>
      ${weekly.filter((e) => yearOf(e) === y).map((e) => `<a href="#" data-id="${h(e.id)}">${h(shabbatTitle(weekOf(e)).replace(/^פרשת /, ''))} <span class="muted small">${h(isoToHebrewText(dateOf(e)))}</span></a>`).join('')}</details>`).join('')}</nav><section id="ka-view"></section></div>`;
    const show = (e) => { $('#ka-view').innerHTML = view(e, false); $$('[data-id]', body).forEach((a) => a.classList.toggle('on', a.dataset.id === e.id)); };
    $$('[data-id]', body).forEach((a) => { a.onclick = (ev) => { ev.preventDefault(); show(weekly.find((x) => x.id === a.dataset.id)); }; });
    show(weekly[0]);
  };
  const onceTab = () => {
    body.innerHTML = once.length ? `<table class="ms-table kol-tbl"><tbody>${once.map((e) => `<tr data-id="${h(e.id)}"><td><b>${h(e.title || fillTags(e.subject, e))}</b><div class="muted small">${h(fillTags(e.subject, e))}</div></td>
      <td class="small">${h(e.sent_at)} · ${h(e.sent_n)} נמענים${e.sent_by ? ` · ${h(String(e.sent_by).split('@')[0])}` : ''}</td>
      <td><button type="button" class="btn small-btn" data-v>👁 צפייה</button> <button type="button" class="btn small-btn" data-dup>⧉ שכפול</button></td></tr>`).join('')}</tbody></table><div id="ka-view"></div>` : '<p class="muted">עוד לא נשלח מייל חד פעמי.</p>';
    const byId = (el) => once.find((x) => x.id === el.closest('tr').dataset.id);
    $$('[data-v]', body).forEach((b) => { b.onclick = () => {
      const e = byId(b); const v = $('#ka-view'); v.innerHTML = `${view(e, true)}<details><summary>⬇ התמונות בלי לוגו</summary>${emailHtml({ ...e, blocks: e.blocks.filter((x) => x.type === 'photo' || x.type === 'ad') }, 'archive', ctx({ clean: true, dl: true }))}</details>`;
      $('.kol-aif', v).srcdoc = emailHtml(e, 'mail', ctx({ clean: true })); v.scrollIntoView({ behavior: 'smooth' });
    }; });
    $$('[data-dup]', body).forEach((b) => { b.onclick = () => { const x = byId(b); const o = JSON.parse(JSON.stringify(x.opts || {})); delete o.hfSent; editor({ kind: 'once', title: `${x.title || ''} (עותק)`, subject: x.subject, blocks: JSON.parse(JSON.stringify(x.blocks)), opts: o, status: 'draft' }, adminArchive); }; });
  };
  $$('[data-t]', main).forEach((b) => { b.onclick = () => { $$('[data-t]', main).forEach((x) => x.classList.toggle('primary', x === b)); (b.dataset.t === 'w' ? weeklyTab : onceTab)(); }; });
  $('[data-t="w"]', main).click();
}

// ---------------------------------------------------------------- התחלה
async function start() {
  if (!CONFIG.KOL_URL) { main.innerHTML = '<p>המערכת עוד לא מחוברת.</p>'; return; }
  await initAuth();
  const go = async () => {
    main.innerHTML = '<p class="muted">נכנס…</p>';
    try {
      if (!hasSavedSession()) await requestToken('select_account');
      const email = String(await getUserEmail()).toLowerCase();
      $('#kol-user').textContent = email;
      const r = await api('me');
      Object.assign(K, { me: r.email, from: r.from, quota: r.quota, logo: r.logo || '' });
      try { K.header = JSON.parse(r.header || '{}') || {}; } catch { K.header = {}; }
      try { K.footer = JSON.parse(r.footer || '{}') || {}; } catch { K.footer = {}; }
      try { K.defaults = JSON.parse(r.defaults || '{}') || {}; } catch { K.defaults = {}; }
      hub();
    } catch (err) {
      main.innerHTML = `<div class="sa-login"><p>${h(msg(err))}</p><button type="button" class="btn" id="kol-again">כניסה עם חשבון אחר</button></div>`;
      $('#kol-again').onclick = async () => { await requestToken('select_account'); go(); };
    }
  };
  main.innerHTML = '<div class="sa-login"><h2>📻 קול אונגוואר</h2><p>מערכת המיילים</p><button type="button" class="btn primary" id="kol-in">כניסה עם Google</button></div>';
  $('#kol-in').onclick = go;
  if (hasSavedSession()) go();
}
start();
