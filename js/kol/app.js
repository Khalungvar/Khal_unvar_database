// 📻 קול אונגוואר — ungvar.org/kol : מערכת המיילים (שבועי "מהנעשה והנשמע" + חד פעמי).
// כניסה עם Google (כל מי שמורשה באתר הכללי). השרת: apps-script/kol.gs (רץ בשם kol@ungvar.org).
// הנמענים: רשימת התפוצה "מהנעשה והנשמע" — מסומנת ליד המייל של איש הקשר באתר הכללי (email_1_tags / email_2_tags).
import { initAuth, requestToken, getUserEmail, hasSavedSession, currentToken, readTabs } from '../google.js?v=681';
import { CONFIG } from '../config.js?v=681';
import { shabbatOfWeek, shabbatTitle } from '../parasha.js?v=681';
import { todayIso, isoToHebrewText } from '../hebdate.js?v=681';
import { FONTS, DEF_FONT, KINDS, LIST_NAME, emailHtml, emailText, fillTags, imgUrl, driveId, cleanHtml } from './render.js?v=681';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const main = $('#kol-main');
function toast(t, kind = '') { const e = document.createElement('div'); e.className = `sa-toast ${kind}`; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), kind === 'error' ? 6000 : 3500); }
const MSG = { 'not-allowed': 'אין הרשאה — רק מי שמורשה באתר הכללי.', conflict: 'מישהו אחר שמר בינתיים — טוען מחדש.', 'already-sent': 'המייל הזה כבר נשלח.', 'too-big': 'המייל גדול מדי — פחות רכיבים.', 'file-big': 'הקובץ גדול מדי.', 'bad-file': 'קובץ לא תקין.' };
const msg = (err) => { const m = String(err?.message || err); return MSG[m.split(':')[0]] || m; };

const K = { me: '', from: '', quota: 0, emails: [], unsubs: new Set(), logo: '', logoData: '', defaults: {}, phones: null, contacts: null };

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
  K.logoData = new URL('../../img/logo.png', import.meta.url).href;
  return K.logoData;
}
function pickFile(accept) {
  return new Promise((ok) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => ok(i.files[0] || null); i.click(); });
}

// ---------------------------------------------------------------- כניסה + דף ראשי
function head(title, back) {
  $('#kol-title').innerHTML = `${back ? '<button type="button" class="btn ghost" id="kol-back">→ חזרה</button> ' : ''}📻 ${h(title)}`;
  $('#kol-back')?.addEventListener('click', back);
}
function hub() {
  head('קול אונגוואר');
  main.innerHTML = `<div class="kol-hub">
      <button type="button" class="lobby-tile kol-tile" data-k="weekly"><span class="lobby-icon">📅</span><b>מהנעשה והנשמע</b><span class="muted small">אימייל שבועי</span></button>
      <button type="button" class="lobby-tile kol-tile" data-k="once"><span class="lobby-icon">✉️</span><b>אימייל חד פעמי</b><span class="muted small">שמירה, ממתינים לשליחה</span></button>
    </div>
    <div class="kol-foot"><a href="../kolungvar/" target="_blank">🌐 הדף הציבורי (ungvar.org/kolungvar)</a> · <button type="button" class="linkish" id="kol-set">⚙ הגדרות</button>
      <span class="muted small">· שולח: ${h(K.from)} · נשארו היום: ${h(K.quota)} מיילים</span></div>`;
  $$('[data-k]', main).forEach((b) => { b.onclick = () => (b.dataset.k === 'weekly' ? openWeekly() : openOnce()); });
  $('#kol-set').onclick = settingsDialog;
}

// ---------------------------------------------------------------- שבועי
/** השבת שהמייל השבועי שלה עכשיו (במוצאי שבת — כבר השבוע הבא) */
function curWeek() {
  const t = todayIso(); const sh = shabbatOfWeek(t);
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  if (t === sh && ny.getHours() >= 18) { const d = new Date(`${sh}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); }
  return sh;
}
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
async function openWeekly(week = curWeek()) {
  main.innerHTML = '<p class="muted">טוען…</p>';
  try { await loadList(); } catch (err) { toast(msg(err), 'error'); }
  let e = K.emails.find((x) => x.kind === 'weekly' && x.week === week);
  if (!e) e = { kind: 'weekly', week, title: '', subject: `מהנעשה והנשמע — {פרשת השבוע}`, blocks: [], opts: { ...(K.defaults || {}) }, status: 'draft' };
  editor(e, () => hub(), { week });
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
      <button type="button" data-c="link" title="קישור">🔗</button><button type="button" data-c="tag" title="תגית {פרשת השבוע}">{פרשה}</button><button type="button" data-c="removeFormat" title="ניקוי עיצוב">⌫</button>
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
      if (c === 'hiliteColor') { if (!document.execCommand('hiliteColor', false, el.value)) document.execCommand('backColor', false, el.value); fire(); return; }
      document.execCommand(c, false, el.value || null); fire();
    };
    if (el.tagName === 'BUTTON') el.onmousedown = (ev) => { ev.preventDefault(); run(); };
    else el.onchange = run;
  });
  return wrap;
}

// ---------------------------------------------------------------- העורך
function editor(e0, back, { week } = {}) {
  const E = JSON.parse(JSON.stringify(e0)); E.blocks ||= []; E.opts ||= {};
  let base = E.updated_at || ''; let dirty = false; let saving = false; let timer = null; let open = -1;
  const sent = E.status === 'sent';
  const title = E.kind === 'weekly' ? `מהנעשה והנשמע — ${shabbatTitle(E.week)} (${isoToHebrewText(E.week)})` : (E.title || 'אימייל חד פעמי');
  head(title, () => { if (dirty) save().then(back); else back(); });
  main.innerHTML = `<div class="kol-ed-wrap">
    <div class="kol-left">
      <div class="kol-bar">
        ${E.kind === 'weekly' ? `<button type="button" class="btn small-btn" id="ke-prev" title="השבוע הקודם">‹ שבוע קודם</button><button type="button" class="btn small-btn" id="ke-next" title="השבוע הבא">שבוע הבא ›</button>` : ''}
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
        <button type="button" class="linkish" id="ke-def">💾 לשמור כברירת מחדל למיילים הבאים</button></details>
      <div class="kol-actions">
        <button type="button" class="btn" id="ke-save">💾 שמירה</button>
        <button type="button" class="btn" id="ke-test">📨 שלח ניסיון אליי</button>
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
  const preview = () => { clearTimeout(pv); pv = setTimeout(() => { $('#ke-prev-f').srcdoc = emailHtml(E, 'preview'); }, 250); };
  $('#ke-mob').onclick = () => $('#ke-prev-f').classList.toggle('mob');
  // שמירה
  const save = async () => {
    if (sent || saving) return;
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

  if (!sent) {
    $('#ke-subj').oninput = (ev) => { E.subject = ev.target.value; changed(); };
    $('#ke-title')?.addEventListener('input', (ev) => { E.title = ev.target.value; changed(); });
    $$('[data-o]', main).forEach((el) => { el.oninput = () => { E.opts[el.dataset.o] = el.value; changed(); }; });
    $('#ke-def').onclick = async () => { try { await api('settings', { defaults: E.opts }); K.defaults = { ...E.opts }; toast('נשמר כברירת מחדל.'); } catch (err) { toast(msg(err), 'error'); } };
    $$('[data-add]', main).forEach((b) => { b.onclick = () => addBlock(b.dataset.add); });
    $('#ke-save').onclick = save;
    $('#ke-test').onclick = async (ev) => {
      ev.target.disabled = true;
      try { await save(); const r = await api('test', { subject: `[ניסיון] ${fillTags(E.subject, E)}`, html: emailHtml(E, 'mail'), text: emailText(E), files: fileIds() }); toast(`נשלח ניסיון ל-${r.to}.`); } catch (err) { toast(msg(err), 'error'); }
      ev.target.disabled = false;
    };
    // רשימות התפוצה
    const lsel = $('#ke-list');
    const fillLists = () => { lsel.innerHTML = listNames().map((n) => `<option${n === (E.opts.list || LIST_NAME) ? ' selected' : ''}>${h(n)}</option>`).join(''); rcpInfo(); };
    const rcpInfo = () => { const r = recipients(lsel.value); $('#ke-rcp').innerHTML = `👥 רשימת התפוצה "<b>${h(lsel.value)}</b>": <b>${r.send.length}</b> נמענים${r.off.length ? ` · ${r.off.length} הסירו את עצמם (לא יקבלו)` : ''}.`; };
    lsel.onchange = () => { E.opts.list = lsel.value; changed(); rcpInfo(); };
    $('#ke-rcp').textContent = 'טוען את רשימת הנמענים…';
    loadPeople().then(fillLists).catch((err) => { $('#ke-rcp').innerHTML = `<span class="rf-err">לא הצלחתי לטעון את אנשי הקשר: ${h(msg(err))}</span>`; });
    $('#ke-pub').onclick = publish;
  }
  if (E.kind === 'weekly') {
    $('#ke-prev').onclick = async () => { if (dirty) await save(); openWeekly(addDays(E.week, -7)); };
    $('#ke-next').onclick = async () => { if (dirty) await save(); openWeekly(addDays(E.week, 7)); };
  }
  const fileIds = () => E.blocks.filter((b) => b.type === 'file' && b.attach && b.file?.id).map((b) => b.file.id);

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
    return strip(b.text) || (b.img ? '' : '(בלי תמונה)');
  };
  const thumbOf = (b) => { const id = b.img?.id || b.thumb?.id; return id ? `<img src="${imgUrl(id, 160)}" alt="">` : `<span class="kol-ic">${KINDS[b.type].icon}</span>`; };
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
    let html = '';
    if (b.type === 'ad') html = `${imgPick('בחירת מודעה (JPG / PNG / GIF / PDF)')}${inp('link', 'קישור בלחיצה על המודעה (רשות)', 'https://…', 'url', true)}${b.pdf ? '<p class="muted small">📄 PDF: בלחיצה נפתח ה-PDF המלא (אם לא כתבתם קישור אחר).</p>' : ''}<div class="kol-f">טקסט מתחת למודעה</div><div data-rich="text"></div>${bgRow}`;
    if (b.type === 'photo') html = `<div class="kol-row"><label class="check"><input type="checkbox" data-logo${b.logo !== false ? ' checked' : ''}> להוסיף את הלוגו</label>
        <label>מקום <select data-lpos>${[['bl', 'למטה שמאל'], ['br', 'למטה ימין'], ['tl', 'למעלה שמאל'], ['tr', 'למעלה ימין']].map(([v, n]) => `<option value="${v}"${(b.lpos || 'bl') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
      ${imgPick('בחירת תמונה')}<p class="muted small">הלוגו מודבק בזמן ההעלאה — כדי לשנות, מעלים שוב את התמונה.</p>
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
    $('[data-logo]', f)?.addEventListener('change', (ev) => { b.logo = ev.target.checked; changed(); });
    $('[data-lpos]', f)?.addEventListener('change', (ev) => { b.lpos = ev.target.value; changed(); });
    $('[data-attach]', f)?.addEventListener('change', (ev) => { b.attach = ev.target.checked; changed(); });
    // העלאת תמונה / מודעה
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
    await save(); if (dirty) return;
    const html = emailHtml(E, 'mail'); const text = emailText(E); const subject = fillTags(E.subject, E); const files = fileIds();
    const btn = $('#ke-pub'); btn.disabled = true;
    let sentN = 0; let errs = 0; const SIZE = 60;
    try {
      for (let i = 0; i < r.send.length; i += SIZE) {
        const last = i + SIZE >= r.send.length;
        btn.textContent = `⏳ שולח… ${Math.min(i + SIZE, r.send.length)} / ${r.send.length}`;
        const res = await api('publish', { id: E.id, subject, html, text, files, recipients: r.send.slice(i, i + SIZE), final: last }, 330000);
        sentN += res.sent; errs += (res.errors || []).length; K.quota = res.quota;
        if ((res.errors || []).some((x) => x.error === 'daily-limit')) { toast('הגענו למגבלה היומית. מחר אפשר ללחוץ שוב "פרסום" — מי שכבר קיבל לא יקבל שוב.', 'error'); break; }
      }
      toast(`✔ נשלח ל-${sentN} נמענים${errs ? ` · ${errs} שגיאות` : ''}.`);
      dirty = false; window.onbeforeunload = null;
      await loadList(); const fresh = K.emails.find((x) => x.id === E.id);
      if (fresh) editor(fresh, back);
    } catch (err) {
      toast(`השליחה נעצרה: ${msg(err)}. אפשר ללחוץ שוב "פרסום" — מי שכבר קיבל לא יקבל שוב.`, 'error');
      btn.disabled = false; btn.textContent = '🚀 פרסום';
    }
  }
  drawBlocks(); preview();
}

// ---------------------------------------------------------------- הגדרות
function settingsDialog() {
  const d = document.createElement('dialog'); d.className = 'kol-dlg';
  d.innerHTML = `<h2>⚙ הגדרות קול אונגוואר</h2>
    <h3>הלוגו שמודבק על תמונות</h3>
    <div class="kol-row"><span id="ks-logo">${K.logo ? `<img src="${imgUrl(K.logo, 200)}" alt="" style="max-height:70px">` : `<img src="../img/logo.png" alt="" style="max-height:70px"> <span class="muted small">(ברירת מחדל)</span>`}</span>
      <button type="button" class="btn" id="ks-up">⬆ העלאת לוגו (PNG שקוף מומלץ)</button></div>
    <p class="muted small">המיילים יוצאים מ-<b>${h(K.from)}</b>. הסרות מהרשימה: ${K.unsubs.size}.</p>
    <div class="actions"><button type="button" class="btn" id="ks-x">סגירה</button></div>`;
  document.body.append(d); d.showModal();
  $('#ks-x', d).onclick = () => { d.close(); d.remove(); };
  $('#ks-up', d).onclick = async () => {
    const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return;
    try {
      const r = await upload(await readUrl(f), `logo-${f.name}`);
      await api('settings', { logo: r.id }); K.logo = r.id; K.logoData = '';
      $('#ks-logo', d).innerHTML = `<img src="${imgUrl(r.id, 200)}" alt="" style="max-height:70px">`; toast('הלוגו נשמר.');
    } catch (err) { toast(msg(err), 'error'); }
  };
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
