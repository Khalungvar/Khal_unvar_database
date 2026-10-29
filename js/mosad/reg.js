// אתר פון א מוסד — 📝 רישום לישיבה: מועמדים, כרטיס מועמד, סטטוסים, הודעות, מסמכים, העברה לתלמידים, הגדרות וייצוא.
// א מועמד איז נישט קיין "מענטש" אינעם מאגר ביז מ'דרוקט "העבר לתלמידים" (נאר נאך "נתקבל").
import { downloadXlsx } from '../excel.js?v=506';
import { heDate, hebrewDateHints } from './brand.js?v=506';
import { todayIso } from '../hebdate.js?v=506';
import { zmanim, currentZman } from './school.js?v=506';
import { mergeConf, mergeTexts, fill, DEFAULT_CONF } from './reg-defaults.js?v=506';

let X = null;
export function initReg(ctx) { X = ctx; }

const R = { data: null, tab: 'list', q: '', fPeriod: '', fStatus: '', fDocs: '', open: null, photos: {}, setLang: 'he', exp: null };
const FORM_URL = 'https://ungvar.org/yeshiva/register/';
const DOCS = [['photo', 'תמונה'], ['passport', 'דרכון'], ['birth', 'תעודת לידה']];
const DSTATE = { '': ['▫', 'חסר'], pending: ['🕓', 'ממתין לבדיקה'], ok: ['✅', 'תקין'], bad: ['❌', 'לא תקין'] };
const LANGS = [['he', 'עברית'], ['yi', 'אידיש'], ['en', 'English']];
const KIND = { submit: '📨 הטופס נשלח', status: '🔄 סטטוס', msg: '✉️ הודעה להורים', note: '📝 הערה פנימית', doc: '📎 מסמך', upload: '⬆ ההורים העלו מסמך', edit: '✏️ ההורים עדכנו פרטים', period: '🗓 שינוי תקופה', transfer: '➡ הועבר לתלמידים', delete: '🗑 נמחק' };
const EMAIL = { queued: '📧 נשלח במייל', 'no-mailer': '⏳ המייל עוד לא מחובר — מופיע באזור האישי', 'no-email': '⚠ אין כתובת מייל' };

const conf = () => mergeConf(R.data?.conf);
const texts = () => mergeTexts(R.data?.texts);
const stOf = (k) => conf().statuses.find((s) => s.key === k) || { key: k, name: k || '—', color: '#777', msg: {} };
const badge = (k) => { const s = stOf(k); return `<span class="rg-st" style="--c:${X.h(s.color)}">${X.h(s.name)}</span>`; };
const nm = (a) => `${a.first_name} ${a.last_name}`.trim();
const ph = (v) => String(v || '').replace(/^'/, '');
const appById = (id) => (R.data?.apps || []).find((a) => String(a.app_id) === String(id));
const logOf = (id) => (R.data?.log || []).filter((l) => String(l.app_id) === String(id));
const missingDocs = (a) => DOCS.filter(([k]) => a[`${k}_state`] !== 'ok').map(([, l]) => l);
const docsIcons = (a) => DOCS.map(([k, l]) => `<span title="${X.h(l)}: ${DSTATE[a[`${k}_state`] || '']?.[1] || ''}">${DSTATE[a[`${k}_state`] || '']?.[0] || '▫'}</span>`).join(' ');
const zLabels = () => { const z = zmanim().map((x) => x.label); return z; };

async function load(force) {
  if (R.data && !force) return;
  R.data = await X.call(X.KEY, 'regList');
}

export async function renderReg(box) {
  const { h } = X;
  if (!R.data) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await load(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  const c = conf();
  const apps = R.data.apps || [];
  const open = c.form_on === true;
  box.innerHTML = `<h2 class="ms-h">📝 רישום לישיבה</h2>
    <div class="ms-bar">
      <nav class="ms-subtabs" style="margin:0">${[['list', `מועמדים (${apps.length})`], ['set', '⚙️ הגדרות רישום'], ['exp', '⬇ ייצוא לאקסל']].map(([k, l]) => `<button type="button" data-rt="${k}" class="${R.tab === k && !R.open ? 'on' : ''}">${h(l)}</button>`).join('')}</nav>
      <span class="spacer"></span>
      <span class="rg-form ${open ? 'on' : 'off'}">${open ? '🟢 הטופס פתוח לציבור' : '🔴 הטופס סגור'}</span>
      <button type="button" class="btn" id="rg-copy">🔗 קישור לטופס</button>
      <button type="button" class="btn" id="rg-reload" title="רענון">⟳</button>
    </div>
    ${c.draft ? '<p class="ms-note">הנוסחים וההודעות הם טיוטה — לעבור עליהם ב"⚙️ הגדרות רישום" לפני פתיחת הטופס.</p>' : ''}
    ${R.data.mailer ? '' : '<p class="ms-note">✉️ שליחת מיילים מ-beissheurim@gmail.com עוד לא חוברה. עד אז הודעות להורים נשמרות ומופיעות באזור האישי שלהם.</p>'}
    <div id="rg-body"></div>`;
  X.$$('[data-rt]', box).forEach((b) => { b.onclick = () => { R.tab = b.dataset.rt; R.open = null; renderReg(box); }; });
  X.$('#rg-copy', box).onclick = () => { navigator.clipboard?.writeText(FORM_URL); X.toast(`הקישור הועתק: ${FORM_URL}`); };
  X.$('#rg-reload', box).onclick = async () => { try { await load(true); renderReg(box); X.toast('עודכן'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  const body = X.$('#rg-body', box);
  const rer = () => renderReg(box);
  if (R.open && appById(R.open)) renderCard(body, appById(R.open), rer);
  else if (R.tab === 'set') renderSettings(body, rer);
  else if (R.tab === 'exp') renderExport(body);
  else renderList(body, rer);
}

// ---------- רשימה ----------
function renderList(box, rer) {
  const { h } = X;
  const c = conf();
  const apps = R.data.apps || [];
  const periods = [...new Set(apps.map((a) => a.period).filter(Boolean))];
  const q = R.q.trim().toLowerCase();
  const list = apps.filter((a) => (!R.fPeriod || a.period === R.fPeriod) && (!R.fStatus || a.status === R.fStatus)
    && (!R.fDocs || (R.fDocs === 'missing' ? missingDocs(a).length : a.photo_state === 'pending' || a.passport_state === 'pending' || a.birth_state === 'pending'))
    && (!q || [a.first_name, a.last_name, a.father_name, a.email, ph(a.father_phone), ph(a.home_phone), a.app_id, a.community].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const counts = Object.fromEntries(c.statuses.map((s) => [s.key, apps.filter((a) => a.status === s.key).length]));
  box.innerHTML = `<div class="ms-stats">${c.statuses.map((s) => `<button type="button" class="ms-stat rg-sbtn${R.fStatus === s.key ? ' on' : ''}" data-fs="${h(s.key)}" style="--c:${h(s.color)}"><b>${counts[s.key] || 0}</b><span>${h(s.name)}</span></button>`).join('')}</div>
    <div class="ms-bar">
      <input type="search" id="rg-q" placeholder="חיפוש: שם, טלפון, מייל, מס׳ פנייה…" value="${h(R.q)}" style="min-width:240px">
      <select id="rg-fp"><option value="">כל התקופות</option>${periods.map((p) => `<option${p === R.fPeriod ? ' selected' : ''}>${h(p)}</option>`).join('')}</select>
      <select id="rg-fs"><option value="">כל הסטטוסים</option>${c.statuses.map((s) => `<option value="${h(s.key)}"${s.key === R.fStatus ? ' selected' : ''}>${h(s.name)}</option>`).join('')}</select>
      <select id="rg-fd"><option value="">כל המסמכים</option><option value="missing"${R.fDocs === 'missing' ? ' selected' : ''}>חסרים מסמכים</option><option value="pending"${R.fDocs === 'pending' ? ' selected' : ''}>ממתינים לבדיקה</option></select>
      <span class="muted small">${list.length} מועמדים</span>
    </div>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table rg-table"><thead><tr><th>מס׳</th><th>שם הבחור</th><th>הוגש</th><th>תקופה</th><th>טלפון האב</th><th>מייל</th><th>מסמכים</th><th>סטטוס</th></tr></thead><tbody>
      ${list.map((a) => `<tr data-open="${h(a.app_id)}"><td>${h(a.app_id)}${a.test === 'TRUE' ? ' <span class="rg-test">בדיקה</span>' : ''}</td>
        <td><b>${h(nm(a))}</b><div class="muted small">${h([a.father_name && `ב״ר ${a.father_name}`, a.community].filter(Boolean).join(' · '))}</div></td>
        <td data-v="${h(String(a.created_at).slice(0, 10))}">${h(heDate(String(a.created_at).slice(0, 10)))}</td><td>${h(a.period)}</td>
        <td class="ltr">${h(ph(a.father_phone))}</td><td class="ltr small">${h(a.email)}</td><td>${docsIcons(a)}</td>
        <td data-v="${c.statuses.findIndex((s) => s.key === a.status)}">${badge(a.status)}${a.contact_id ? ' <span class="muted small">➡ תלמיד</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="ms-empty muted">${apps.length ? 'אין מועמדים לפי הסינון.' : 'עדיין לא הוגשו בקשות.'}</p>`}`;
  const q1 = X.$('#rg-q', box);
  q1.oninput = () => { R.q = q1.value; const pos = q1.selectionStart; renderList(box, rer); const q2 = X.$('#rg-q', box); q2.focus(); q2.setSelectionRange(pos, pos); };
  X.$('#rg-fp', box).onchange = (e) => { R.fPeriod = e.target.value; renderList(box, rer); };
  X.$('#rg-fs', box).onchange = (e) => { R.fStatus = e.target.value; renderList(box, rer); };
  X.$('#rg-fd', box).onchange = (e) => { R.fDocs = e.target.value; renderList(box, rer); };
  X.$$('[data-fs]', box).forEach((b) => { b.onclick = () => { R.fStatus = R.fStatus === b.dataset.fs ? '' : b.dataset.fs; renderList(box, rer); }; });
  X.$$('[data-open]', box).forEach((tr) => { tr.onclick = () => { R.open = tr.dataset.open; rer(); window.scrollTo(0, 0); }; });
}

// ---------- כרטיס מועמד ----------
const FIELDS = [
  ['הבחור', [['first_name', 'שם פרטי'], ['last_name', 'שם משפחה'], ['birth_date', 'תאריך לידה', 'date'], ['home_phone', 'טלפון בבית', 'tel'],
    ['engaged', 'חתן?', 'yn'], ['wedding_date', 'תאריך החתונה', 'date']]],
  ['ההורים', [['father_name', 'שם האב'], ['mother_family', 'שם משפחת האם'], ['father_phone', 'טלפון האב', 'tel'], ['mother_phone', 'טלפון האם', 'tel'],
    ['email', 'מייל', 'email'], ['community', 'קהילה'], ['address', 'כתובת'], ['city', 'עיר'], ['state', 'מדינה / מחוז'], ['zip', 'מיקוד'], ['country', 'ארץ']]],
  ['לימודים', [['yeshiva_ketana', 'ישיבה קטנה'], ['yeshiva_gedola', 'ישיבה גדולה / לומד כיום'], ['yeshiva_other', 'ישיבה נוספת']]],
  ['אנשי צוות', [['staff1_name', 'מנהל / משגיח'], ['staff1_phone', 'נייד', 'tel'], ['staff2_name', 'מגיד שיעור א׳'], ['staff2_phone', 'נייד', 'tel'], ['staff3_name', 'מגיד שיעור ב׳'], ['staff3_phone', 'נייד', 'tel']]],
];
function renderCard(box, a, rer) {
  const { h } = X;
  const c = conf();
  const docsOk = R.data.docs;
  const log = logOf(a.app_id).slice().reverse();
  const canTransfer = (a.status === 'accepted' || a.status === 'tuition_ok') && !a.contact_id && X.can('people_edit');
  const field = ([k, l, t]) => {
    const v = ph(a[k]);
    if (t === 'yn') return `<label>${h(l)}<select name="${k}"><option value=""></option><option value="no"${v === 'no' ? ' selected' : ''}>לא</option><option value="yes"${v === 'yes' ? ' selected' : ''}>כן</option></select></label>`;
    return `<label>${h(l)}<input name="${k}" type="${t || 'text'}" value="${h(v)}"${t === 'tel' || t === 'email' ? ' dir="ltr"' : ''}></label>`;
  };
  box.innerHTML = `<p><button type="button" class="linkish" id="rg-back">→ חזרה לרשימה</button></p>
    <div class="rg-card">
      <div class="rg-side">
        <div class="rg-photo" id="rg-photo">${a.photo_file ? '<span class="muted small">טוען תמונה…</span>' : '<span class="muted">אין תמונה</span>'}</div>
        <h3>מסמכים</h3>
        ${DOCS.map(([k, l]) => `<div class="rg-doc"><b>${h(l)}</b>
          <select data-dst="${k}">${Object.entries(DSTATE).map(([s, [ic, t]]) => `<option value="${s}"${(a[`${k}_state`] || '') === s ? ' selected' : ''}>${ic} ${h(t)}</option>`).join('')}</select>
          ${a[`${k}_file`] && (k === 'photo' || docsOk) ? `<button type="button" class="btn small-btn" data-dview="${k}">👁</button>` : ''}
          ${k === 'photo' || docsOk ? `<label class="btn small-btn">⬆<input type="file" data-dup="${k}" accept="image/*,application/pdf" hidden></label>` : ''}</div>`).join('')}
        ${docsOk ? '' : '<p class="muted small">צפייה בדרכון ובתעודת לידה — רק עם הרשאת "רישום — מסמכים".</p>'}
        <h3>אזור אישי להורים</h3>
        <button type="button" class="btn" id="rg-link">🔗 העתקת הקישור</button>
        <label class="check"><input type="checkbox" id="rg-pedit"${a.portal_edit === 'TRUE' ? ' checked' : ''}> לאפשר להורים לעדכן פרטים</label>
      </div>
      <div class="rg-main">
        <div class="rg-head"><h2>#${h(a.app_id)} · ${h(nm(a))}${a.test === 'TRUE' ? ' <span class="rg-test">בדיקה</span>' : ''}</h2>${badge(a.status)}</div>
        <p class="muted">הוגש: ${h(heDate(String(a.created_at).slice(0, 10)))} ${h(String(a.created_at).slice(11))} · תקופה:
          <select id="rg-period">${[...new Set([a.period, ...zLabels()])].filter(Boolean).map((z) => `<option${z === a.period ? ' selected' : ''}>${h(z)}</option>`).join('')}</select>
          · שפה: ${h(LANGS.find(([k]) => k === a.lang)?.[1] || a.lang)}${a.under_age_ack === 'TRUE' ? ' · <b class="ms-owe">⚠ מתחת לגיל — ההורים אישרו להמשיך</b>' : ''}</p>
        <div class="ms-bar">
          <button type="button" class="btn primary" id="rg-st">🔄 שינוי סטטוס</button>
          <button type="button" class="btn" id="rg-msg">✉️ הודעה להורים</button>
          <button type="button" class="btn" id="rg-note">📝 הערה פנימית</button>
          ${canTransfer ? '<button type="button" class="btn primary" id="rg-tr">➡ העבר לתלמידים</button>' : ''}
          ${a.contact_id ? `<span class="rg-done">➡ הועבר לתלמידים (#${h(a.contact_id)})</span>` : ''}
          <span class="spacer"></span>
          ${X.st.me?.role === 'owner' || X.st.me?.role === 'admin' ? `<button type="button" class="btn danger" id="rg-del"${a.contact_id ? ' disabled' : ''}>🗑 מחיקה</button>` : ''}
        </div>
        <form id="rg-form" class="rg-form2">
          ${FIELDS.map(([t, fs]) => `<fieldset><legend>${h(t)}</legend><div class="rg-grid${t === 'אנשי צוות' ? ' rg-grid2' : ''}">${fs.map(field).join('')}</div></fieldset>`).join('')}
          <fieldset><legend>תשלומים</legend><div class="rg-grid">
            <label>דמי הרשמה (${h(c.amounts.reg_usd)}$)<select name="pay_reg">${[['', '—'], ['paid', 'שולם'], ['failed', 'נכשל'], ['waived', 'פטור']].map(([v, t]) => `<option value="${v}"${a.pay_reg === v ? ' selected' : ''}>${h(t)}</option>`).join('')}</select></label>
            <label>דמי ויזה (${h(c.amounts.visa_usd)}$)<select name="pay_visa">${[['', '—'], ['paid', 'שולם'], ['failed', 'נכשל'], ['waived', 'פטור']].map(([v, t]) => `<option value="${v}"${a.pay_visa === v ? ' selected' : ''}>${h(t)}</option>`).join('')}</select></label>
          </div><p class="muted small">החיוב עצמו יחובר ל-Cardknox בשלב האחרון. בינתיים מסמנים ידנית.</p></fieldset>
          <label class="rg-notes">הערות ההורים<textarea name="notes" rows="3">${h(a.notes)}</textarea></label>
          <p><button type="submit" class="btn primary" id="rg-save">💾 שמירת פרטים</button></p>
        </form>
        <h3>היסטוריה</h3>
        <div class="rg-log">${log.map((l) => `<div class="rg-li${l.kind === 'note' ? ' note' : ''}"><div class="rg-lh"><b>${h(KIND[l.kind] || l.kind)}</b>
            ${l.kind === 'status' ? `${l.from_status ? `${h(stOf(l.from_status).name)} ← ` : ''}${badge(l.to_status)}` : ''}${l.kind === 'period' ? `${h(l.from_status)} ← ${h(l.to_status)}` : ''}
            <span class="muted small">${h(heDate(String(l.at).slice(0, 10)))} ${h(String(l.at).slice(11))} · ${h(String(l.by).split('@')[0])}</span></div>
          ${l.text ? `<div class="rg-lt">${h(l.kind === 'doc' ? `${l.subject}: ${DSTATE[l.text]?.[1] || l.text}` : l.text)}</div>` : ''}
          ${l.parent_visible === 'TRUE' ? '<span class="muted small">👁 מופיע להורים באזור האישי</span> ' : ''}${l.email_state ? `<span class="muted small">${h(EMAIL[l.email_state] || l.email_state)}</span>` : ''}</div>`).join('') || '<p class="muted">אין עדיין.</p>'}</div>
      </div>
    </div>`;
  hebrewDateHints(box);
  const reload = async (msg) => { await load(true); rer(); if (msg) X.toast(msg); };
  X.$('#rg-back', box).onclick = () => { R.open = null; rer(); };
  // תמונה
  if (a.photo_file) loadPhotos([a.app_id]).then(() => { const el = X.$('#rg-photo', box); if (el && R.photos[a.app_id]) el.innerHTML = `<img src="${R.photos[a.app_id]}" alt="">`; });
  X.$('#rg-form', box).onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target); const data = Object.fromEntries(fd.entries());
    const btn = X.$('#rg-save', box); btn.disabled = true;
    try { await X.call(X.KEY, 'regEdit', { app_id: a.app_id, data }); await reload('נשמר.'); } catch (err) { btn.disabled = false; X.toast(X.msg(err), 'err'); }
  };
  X.$('#rg-period', box).onchange = async (e) => { try { await X.call(X.KEY, 'regEdit', { app_id: a.app_id, data: { period: e.target.value } }); await reload('התקופה עודכנה.'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('#rg-pedit', box).onchange = async (e) => { try { await X.call(X.KEY, 'regEdit', { app_id: a.app_id, data: { portal_edit: e.target.checked ? 'TRUE' : '' } }); await reload('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('#rg-link', box).onclick = () => { const u = `${FORM_URL}?t=${a.token}`; navigator.clipboard?.writeText(u); X.toast('הקישור האישי הועתק. לשלוח רק להורים של הבחור.'); };
  X.$$('[data-dst]', box).forEach((s) => { s.onchange = async () => { try { await X.call(X.KEY, 'regDoc', { app_id: a.app_id, kind: s.dataset.dst, state: s.value }); await reload('עודכן.'); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$$('[data-dview]', box).forEach((b) => { b.onclick = () => viewDoc(a, b.dataset.dview); });
  X.$$('[data-dup]', box).forEach((inp) => { inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    try { const data = await fileData(f, inp.dataset.dup === 'photo'); X.toast('מעלה…'); await X.call(X.KEY, 'regDoc', { app_id: a.app_id, kind: inp.dataset.dup, data, state: 'ok' }); delete R.photos[a.app_id]; await reload('הועלה.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  }; });
  X.$('#rg-st', box).onclick = () => statusDialog(a, reload);
  X.$('#rg-msg', box).onclick = () => msgDialog(a, reload);
  X.$('#rg-note', box).onclick = () => noteDialog(a, reload);
  X.$('#rg-tr', box)?.addEventListener('click', () => transferDialog(a, reload));
  X.$('#rg-del', box)?.addEventListener('click', async (ev) => {
    if (!window.confirm(`למחוק את הבקשה של ${nm(a)} (#${a.app_id})? הקבצים יועברו לסל המיחזור בדרייב.`)) return;
    ev.currentTarget.disabled = true;
    try { await X.call(X.KEY, 'regDelete', { app_id: a.app_id }); R.open = null; await reload('נמחק.'); } catch (err) { ev.currentTarget.disabled = false; X.toast(X.msg(err), 'err'); }
  });
}
async function loadPhotos(ids) {
  const need = ids.filter((id) => R.photos[id] === undefined && appById(id)?.photo_file);
  for (let i = 0; i < need.length; i += 10) {
    const part = need.slice(i, i + 10);
    try { const r = await X.call(X.KEY, 'regFile', { kind: 'photo', app_ids: part }); part.forEach((id) => { R.photos[id] = r.files?.[id] || ''; }); } catch { part.forEach((id) => { R.photos[id] = ''; }); }
  }
}
async function viewDoc(a, kind) {
  const w = window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש.', 'err'); return; }
  w.document.write('<p style="font-family:sans-serif">טוען…</p>');
  try {
    const r = await X.call(X.KEY, 'regFile', { kind, app_id: a.app_id });
    const d = r.files?.[a.app_id];
    if (!d) throw new Error('הקובץ לא נמצא');
    w.document.open();
    w.document.write(`<title>${X.h(nm(a))}</title>${d.startsWith('data:application/pdf') ? `<iframe src="${d}" style="border:0;width:100%;height:100vh"></iframe>` : `<img src="${d}" style="max-width:100%">`}`);
    w.document.close();
  } catch (err) { w.close(); X.toast(X.msg(err), 'err'); }
}
/** א טעקע → data URL; א בילד ווערט קלענער (ביז 1400 פיקסל) */
export async function fileData(f, isPhoto) {
  if (f.type === 'application/pdf') {
    if (f.size > 4 * 1024 * 1024) throw new Error('הקובץ גדול מדי (עד 4MB).');
    return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('קריאת הקובץ נכשלה')); r.readAsDataURL(f); });
  }
  if (!/^image\//.test(f.type)) throw new Error('רק תמונה או PDF.');
  const url = URL.createObjectURL(f);
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('לא הצלחתי לקרוא את התמונה.')); i.src = url; });
  URL.revokeObjectURL(url);
  const max = isPhoto ? 1000 : 1600;
  const s = Math.min(1, max / Math.max(im.width, im.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.85);
}

const extraOf = (a) => ({ missing: missingDocs(a).join(', ') || '—', name: nm(a) });
function sendRow(defaultOn = true) {
  const has = R.data.mailer;
  return `<label class="check"><input type="checkbox" class="rg-send"${has && defaultOn ? ' checked' : ''}${has ? '' : ' disabled'}> לשלוח גם במייל להורים</label>
    ${has ? '' : '<p class="muted small">⏳ המייל עוד לא מחובר — ההודעה תישמר ותופיע להורים באזור האישי.</p>'}`;
}
function tplSelect(a) {
  return `<select class="rg-tpl"><option value="">— תבנית —</option>${conf().templates.map((t) => `<option value="${X.h(t.id)}">${X.h(t.name)}</option>`).join('')}</select>`;
}
function wireTpl(d, a, ta) {
  X.$('.rg-tpl', d).onchange = (e) => { const t = conf().templates.find((x) => x.id === e.target.value); if (!t) return; const v = fill(t.text?.[a.lang] || t.text?.he || '', conf(), extraOf(a)); ta.value = ta.value.trim() ? `${ta.value.trim()}\n\n${v}` : v; };
}
const wrap = (a, text) => { const w = conf().mail_wrap[a.lang] || conf().mail_wrap.he; return { subject: fill(w.subject, conf()), email: fill(w.body, conf(), { text }) }; };

function statusDialog(a, reload) {
  const { h } = X;
  const c = conf();
  const d = X.dialog(`<h3>🔄 שינוי סטטוס — ${h(nm(a))}</h3>
    <label>סטטוס חדש <select class="rg-ns">${c.statuses.map((s) => `<option value="${h(s.key)}"${s.key === a.status ? ' selected' : ''}>${h(s.name)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" class="rg-show" checked> להציג הודעה להורים (באזור האישי)</label>
    <div class="rg-msgbox"><div class="ms-bar">הודעה להורים (${h(LANGS.find(([k]) => k === a.lang)?.[1] || '')}) <span class="spacer"></span>${tplSelect(a)}</div>
      <textarea class="rg-text" rows="7" style="width:100%"></textarea>${sendRow()}</div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>שמירה</button></div>`);
  const sel = X.$('.rg-ns', d); const ta = X.$('.rg-text', d); const show = X.$('.rg-show', d);
  const pre = () => { ta.value = fill(stOf(sel.value).msg?.[a.lang] || stOf(sel.value).msg?.he || '', c, extraOf(a)); };
  sel.onchange = pre; pre();
  show.onchange = () => { X.$('.rg-msgbox', d).hidden = !show.checked; };
  wireTpl(d, a, ta);
  X.$('[data-ok]', d).onclick = async (ev) => {
    ev.currentTarget.disabled = true;
    const text = show.checked ? ta.value.trim() : '';
    const w = wrap(a, text);
    try {
      const r = await X.call(X.KEY, 'regStatus', { app_id: a.app_id, status: sel.value, notify: { text, subject: w.subject, email: w.email, send: !!X.$('.rg-send', d)?.checked } });
      d.close(); await reload(r.email_state === 'queued' ? 'נשמר, והמייל יישלח בדקות הקרובות.' : 'נשמר.');
    } catch (err) { ev.currentTarget.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
function msgDialog(a, reload) {
  const { h } = X;
  const d = X.dialog(`<h3>✉️ הודעה להורים — ${h(nm(a))}</h3>
    <div class="ms-bar">ההודעה (${h(LANGS.find(([k]) => k === a.lang)?.[1] || '')}) <span class="spacer"></span>${tplSelect(a)}</div>
    <textarea class="rg-text" rows="8" style="width:100%"></textarea>${sendRow()}
    <p class="muted small">ההודעה תופיע להורים באזור האישי.</p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>שליחה</button></div>`);
  const ta = X.$('.rg-text', d);
  wireTpl(d, a, ta);
  X.$('[data-ok]', d).onclick = async (ev) => {
    const text = ta.value.trim(); if (!text) { X.toast('אין טקסט.', 'err'); return; }
    ev.currentTarget.disabled = true;
    const w = wrap(a, text);
    try { const r = await X.call(X.KEY, 'regMsg', { app_id: a.app_id, text, subject: w.subject, email: w.email, send: !!X.$('.rg-send', d)?.checked }); d.close(); await reload(r.email_state === 'queued' ? 'נשמר, והמייל יישלח בדקות הקרובות.' : 'נשמר.'); } catch (err) { ev.currentTarget.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
function noteDialog(a, reload) {
  const d = X.dialog(`<h3>📝 הערה פנימית — ${X.h(nm(a))}</h3><p class="muted small">ההורים לא רואים את זה.</p>
    <textarea class="rg-text" rows="5" style="width:100%"></textarea>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>שמירה</button></div>`);
  X.$('.rg-text', d).focus();
  X.$('[data-ok]', d).onclick = async (ev) => {
    const text = X.$('.rg-text', d).value.trim(); if (!text) return;
    ev.currentTarget.disabled = true;
    try { await X.call(X.KEY, 'regMsg', { app_id: a.app_id, text, note: true }); d.close(); await reload('נשמר.'); } catch (err) { ev.currentTarget.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
async function transferDialog(a, reload) {
  const { h } = X;
  X.toast('מחפש במאגר…');
  let found;
  try { found = await X.call(X.KEY, 'regTransfer', { app_id: a.app_id, dry: true }); } catch (err) { X.toast(X.msg(err), 'err'); return; }
  const opts = (name, list, label) => `<div class="rg-pick"><b>${h(label)}</b>
    <label class="check"><input type="radio" name="${name}" value="" checked> איש קשר חדש</label>
    ${list.map((x) => `<label class="check"><input type="radio" name="${name}" value="${h(x.contact_id)}"> קיים במאגר: ${h(x.name || x.en)} ${x.city ? `(${h(x.city)})` : ''} · #${h(x.contact_id)}</label>`).join('')}</div>`;
  const zs = zLabels();
  const d = X.dialog(`<h3>➡ העבר לתלמידים — ${h(nm(a))}</h3>
    <p class="muted small">רק לבחור שנתקבל ומתחיל ללמוד בפועל. הבחור וההורה ייכנסו לאנשי הקשר, ויפתח לו רישום לזמן.</p>
    ${opts('rg-par', found.parent || [], `ההורה: ${a.father_name} ${a.last_name}`)}
    ${opts('rg-stu', found.student || [], `הבחור: ${nm(a)}`)}
    <div class="rg-grid"><label>זמן <select class="rg-z">${[...new Set([a.period, ...zs])].filter(Boolean).map((z) => `<option${z === (a.period || currentZman()) ? ' selected' : ''}>${h(z)}</option>`).join('')}</select></label>
    <label>מתחיל ללמוד בתאריך <input type="date" class="rg-sd" value="${todayIso()}"></label></div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>העברה</button></div>`, 'wide');
  hebrewDateHints(d);
  X.$('[data-ok]', d).onclick = async (ev) => {
    ev.currentTarget.disabled = true;
    const val = (n) => X.$(`input[name=${n}]:checked`, d)?.value || '';
    try {
      const r = await X.call(X.KEY, 'regTransfer', { app_id: a.app_id, parent_id: val('rg-par'), student_id: val('rg-stu'), zman: X.$('.rg-z', d).value, start_date: X.$('.rg-sd', d).value });
      d.close(); await X.loadPeople?.(); await reload(`הועבר: תלמיד #${r.contact_id}, הורה #${r.parent_id}.`);
    } catch (err) { ev.currentTarget.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}

// ---------- ⚙️ הגדרות ----------
function renderSettings(box, rer) {
  const { h } = X;
  const c = conf(); const T = texts();
  const zs = zLabels();
  const zsel = (name, v) => `<select name="${name}">${[...new Set([v, ...zs])].filter(Boolean).map((z) => `<option${z === v ? ' selected' : ''}>${h(z)}</option>`).join('')}</select>`;
  const L = R.setLang;
  const tl = T[L];
  const listTa = (k, l, rows = 6) => `<label class="rg-wide">${h(l)} <span class="muted small">(שורה לכל סעיף)</span><textarea name="t_${k}" rows="${rows}">${h((tl[k] || []).join('\n'))}</textarea></label>`;
  const oneTa = (k, l, rows = 3) => `<label class="rg-wide">${h(l)}<textarea name="t_${k}" rows="${rows}">${h(tl[k] || '')}</textarea></label>`;
  box.innerHTML = `<form id="rg-set" class="rg-set">
    <p class="muted small">אפשר לכתוב בטקסטים: {reg_usd} {visa_usd} {tuition_ils} {ins_ils} {ins_usd} {min_age} {phone_status} {phone_tuition} — והמערכת ממלאת לפי ההגדרות. בהודעות גם {name} (שם הבחור), {link} (קישור לאזור האישי), {missing} (מסמכים חסרים), {examiner_name} {examiner_phone} {exam_place} {exam_notes}.</p>
    <fieldset><legend>הטופס ותקופות ההרשמה</legend><div class="rg-grid">
      <label class="check"><input type="checkbox" name="form_on"${c.form_on ? ' checked' : ''}> הטופס פתוח לציבור</label>
      <label class="check"><input type="checkbox" name="draft"${c.draft ? ' checked' : ''}> הנוסחים עדיין טיוטה</label>
      <label>תקופת ההרשמה הנוכחית ${zsel('period', c.period)}</label>
      <label class="check"><input type="checkbox" name="period_open"${c.period_open !== false ? ' checked' : ''}> ההרשמה לתקופה הנוכחית פתוחה</label>
      <label>כשסגורה — בקשות חדשות הולכות ל־ ${zsel('period_next', c.period_next)}</label>
      <label>גיל מינימום <input name="min_age" type="number" min="10" max="30" value="${h(c.min_age)}" style="width:5em"></label>
    </div></fieldset>
    <fieldset><legend>סכומים</legend><div class="rg-grid">
      <label>דמי הרשמה ($)<input name="a_reg_usd" type="number" value="${h(c.amounts.reg_usd)}"></label>
      <label>דמי ויזה ($)<input name="a_visa_usd" type="number" value="${h(c.amounts.visa_usd)}"></label>
      <label>שכר לימוד לחודש (₪)<input name="a_tuition_ils" type="number" value="${h(c.amounts.tuition_ils)}"></label>
      <label>ביטוח לחודש (₪)<input name="a_ins_ils" type="number" value="${h(c.amounts.ins_ils)}"></label>
      <label>ביטוח לחודש — בערך ($)<input name="a_ins_usd" type="number" value="${h(c.amounts.ins_usd)}"></label>
    </div></fieldset>
    <fieldset><legend>פרטי קשר שמופיעים בטופס</legend><div class="rg-grid">
      <label>טלפון לבירור מצב ההרשמה<input name="phone_status" dir="ltr" value="${h(c.phone_status)}"></label>
      <label>טלפון שכר לימוד<input name="phone_tuition" dir="ltr" value="${h(c.phone_tuition)}"></label>
      <label>מייל<input name="email" dir="ltr" value="${h(c.email)}"></label>
    </div></fieldset>
    <fieldset><legend>הבוחן (לתבנית "פרטי הבחינה")</legend><div class="rg-grid">
      <label>שם<input name="ex_name" value="${h(c.examiner.name)}"></label>
      <label>טלפון<input name="ex_phone" dir="ltr" value="${h(c.examiner.phone)}"></label>
      <label>מקום הבחינה<input name="ex_place" value="${h(c.examiner.place)}"></label>
      <label class="rg-wide">הוראות נוספות<textarea name="ex_notes" rows="2">${h(c.examiner.notes)}</textarea></label>
    </div></fieldset>
    <fieldset><legend>סטטוסים וההודעה שההורים רואים</legend>
      ${c.statuses.map((s, i) => `<div class="rg-srow"><div class="rg-grid"><label>שם<input name="s${i}_name" value="${h(s.name)}"></label><label>צבע<input name="s${i}_color" type="color" value="${h(s.color)}"></label></div>
        <div class="rg-grid3">${LANGS.map(([l, ln]) => `<label>${h(ln)}<textarea name="s${i}_${l}" rows="2"${l === 'en' ? ' dir="ltr"' : ''}>${h(s.msg[l] || '')}</textarea></label>`).join('')}</div></div>`).join('')}
    </fieldset>
    <fieldset><legend>תבניות הודעה</legend><div id="rg-tpls">
      ${c.templates.map((t, i) => tplRow(t, i)).join('')}</div>
      <p><button type="button" class="btn" id="rg-addtpl">➕ תבנית</button></p>
    </fieldset>
    <fieldset><legend>מיילים</legend>
      ${[['mail_received', 'אישור קבלת הטופס (נשלח אוטומטית)'], ['mail_wrap', 'עטיפה להודעה / שינוי סטטוס ({text} = ההודעה)']].map(([k, l]) => `<h4>${h(l)}</h4><div class="rg-grid3">${LANGS.map(([lg, ln]) => `<div><label>${h(ln)} — נושא<input name="${k}_${lg}_s" value="${h(c[k][lg]?.subject || '')}"${lg === 'en' ? ' dir="ltr"' : ''}></label><label>תוכן<textarea name="${k}_${lg}_b" rows="7"${lg === 'en' ? ' dir="ltr"' : ''}>${h(c[k][lg]?.body || '')}</textarea></label></div>`).join('')}</div>`).join('')}
    </fieldset>
    <fieldset><legend>נוסחי הטופס</legend>
      <nav class="ms-subtabs">${LANGS.map(([l, ln]) => `<button type="button" data-sl="${l}" class="${l === L ? 'on' : ''}">${h(ln)}</button>`).join('')}</nav>
      <div class="rg-grid" ${L === 'en' ? 'dir="ltr"' : ''}>
        <label class="rg-wide">כותרת<input name="t_title" value="${h(tl.title || '')}"></label>
        ${listTa('intro', 'הבהרות בתחילת הטופס', 8)}${listTa('tuition', 'שכר לימוד')}${listTa('visa', 'ויזה')}${listTa('insurance', 'ביטוח רפואי')}${listTa('takanon', 'תקנות הישיבה')}${listTa('consents', 'אישורים (כל שורה = תיבת סימון)', 5)}
        ${oneTa('age_warn', 'אזהרת גיל')}${oneTa('age_ack', 'אישור להמשיך (גיל)', 1)}${oneTa('success', 'הודעה אחרי שליחה')}${oneTa('closed', 'כשהטופס סגור', 2)}
      </div>
    </fieldset>
    <div class="rg-savebar"><button type="submit" class="btn primary">💾 שמירת ההגדרות</button></div>
  </form>`;
  const form = X.$('#rg-set', box);
  let tplN = c.templates.length;
  X.$('#rg-addtpl', box).onclick = () => { X.$('#rg-tpls', box).insertAdjacentHTML('beforeend', tplRow({ id: `t${Date.now().toString(36)}`, name: '', status: '', text: {} }, tplN)); tplN += 1; };
  X.$('#rg-tpls', box).onclick = (e) => { const b = e.target.closest('[data-deltpl]'); if (b) b.closest('.rg-tpl-row').remove(); };
  // שפה אחרת בנוסחים — קודם שומרים את מה שנכתב בזיכרון
  const collect = () => {
    const f = Object.fromEntries(new FormData(form).entries());
    const on = (n) => form.elements[n]?.checked;
    const cc = { ...(R.data.conf || {}) };
    Object.assign(cc, { form_on: on('form_on'), draft: on('draft'), period: f.period, period_next: f.period_next, period_open: on('period_open'), min_age: Number(f.min_age) || 18,
      amounts: { reg_usd: Number(f.a_reg_usd) || 0, visa_usd: Number(f.a_visa_usd) || 0, tuition_ils: Number(f.a_tuition_ils) || 0, ins_ils: Number(f.a_ins_ils) || 0, ins_usd: Number(f.a_ins_usd) || 0 },
      phone_status: f.phone_status, phone_tuition: f.phone_tuition, email: f.email,
      examiner: { name: f.ex_name, phone: f.ex_phone, place: f.ex_place, notes: f.ex_notes } });
    cc.statuses = c.statuses.map((s, i) => ({ key: s.key, name: f[`s${i}_name`] || s.name, color: f[`s${i}_color`] || s.color, msg: { he: f[`s${i}_he`], yi: f[`s${i}_yi`], en: f[`s${i}_en`] } }));
    cc.templates = X.$$('.rg-tpl-row', form).map((r) => { const v = (n) => r.querySelector(`[data-f=${n}]`).value; return { id: r.dataset.id, name: v('name') || 'תבנית', status: v('status'), text: { he: v('he'), yi: v('yi'), en: v('en') } }; });
    ['mail_received', 'mail_wrap'].forEach((k) => { cc[k] = {}; LANGS.forEach(([lg]) => { cc[k][lg] = { subject: f[`${k}_${lg}_s`], body: f[`${k}_${lg}_b`] }; }); });
    cc.exports = c.exports;
    const lines = (n) => String(f[`t_${n}`] || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const tx = { ...(R.texts || {}) };
    tx[L] = { title: f.t_title, intro: lines('intro'), tuition: lines('tuition'), visa: lines('visa'), insurance: lines('insurance'), takanon: lines('takanon'), consents: lines('consents'),
      age_warn: f.t_age_warn, age_ack: f.t_age_ack, success: f.t_success, closed: f.t_closed };
    return { cc, tx };
  };
  X.$$('[data-sl]', box).forEach((b) => { b.onclick = () => { const { cc, tx } = collect(); R.data.conf = cc; R.texts = tx; R.data.texts = { ...(R.data.texts || {}), ...tx }; R.setLang = b.dataset.sl; renderSettings(box, rer); }; });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const { cc, tx } = collect();
    if (cc.form_on && cc.draft && !window.confirm('הנוסחים מסומנים "טיוטה". לפתוח את הטופס לציבור בכל זאת?')) return;
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const r = await X.call(X.KEY, 'regSettings', { conf: cc, texts: { ...(R.data.texts || {}), ...tx } });
      R.data.conf = r.conf; R.data.texts = r.texts; R.texts = null; X.toast('ההגדרות נשמרו.'); rer();
    } catch (err) { btn.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
function tplRow(t, i) {
  const { h } = X;
  return `<div class="rg-tpl-row" data-id="${h(t.id)}"><div class="rg-grid"><label>שם התבנית<input data-f="name" value="${h(t.name)}"></label>
    <label>שייכת לסטטוס<select data-f="status"><option value="">—</option>${conf().statuses.map((s) => `<option value="${h(s.key)}"${s.key === t.status ? ' selected' : ''}>${h(s.name)}</option>`).join('')}</select></label>
    <button type="button" class="btn small-btn danger" data-deltpl="${i}">🗑</button></div>
    <div class="rg-grid3">${LANGS.map(([l, ln]) => `<label>${h(ln)}<textarea data-f="${l}" rows="4"${l === 'en' ? ' dir="ltr"' : ''}>${h(t.text?.[l] || '')}</textarea></label>`).join('')}</div></div>`;
}

// ---------- ⬇ ייצוא לאקסל ----------
const COLS = [
  ['פרטים אישיים', [['app_id', 'מס׳ פנייה', (a) => Number(a.app_id)], ['first_name', 'שם פרטי'], ['last_name', 'שם משפחה'], ['birth', 'תאריך לידה', (a) => a.birth_heb || heDate(a.birth_date)],
    ['birth_civil', 'תאריך לידה (לועזי)', (a) => a.birth_date], ['address', 'כתובת'], ['city', 'עיר'], ['state', 'מדינה / מחוז'], ['country', 'ארץ'], ['engaged', 'חתן', (a) => (a.engaged === 'yes' ? 'כן' : '')], ['wedding', 'תאריך החתונה', (a) => a.wedding_heb || heDate(a.wedding_date)]]],
  ['פרטי קשר', [['home_phone', 'טלפון בבית', (a) => ph(a.home_phone)], ['father_phone', 'טלפון האב', (a) => ph(a.father_phone)], ['mother_phone', 'טלפון האם', (a) => ph(a.mother_phone)], ['email', 'מייל'],
    ['father_name', 'שם האב'], ['mother_family', 'שם משפחת האם'], ['community', 'קהילה']]],
  ['לימודים', [['yeshiva_ketana', 'ישיבה קטנה'], ['yeshiva_gedola', 'ישיבה גדולה / לומד כיום'], ['yeshiva_other', 'ישיבה נוספת'],
    ['staff1', 'מנהל / משגיח', (a) => [a.staff1_name, ph(a.staff1_phone)].filter(Boolean).join(' · ')], ['staff2', 'מגיד שיעור א׳', (a) => [a.staff2_name, ph(a.staff2_phone)].filter(Boolean).join(' · ')], ['staff3', 'מגיד שיעור ב׳', (a) => [a.staff3_name, ph(a.staff3_phone)].filter(Boolean).join(' · ')]]],
  ['פרטי הרשמה', [['period', 'זמן הרשמה'], ['created', 'תאריך הגשה', (a) => heDate(String(a.created_at).slice(0, 10))], ['status', 'סטטוס', (a) => stOf(a.status).name],
    ['updated', 'עדכון אחרון', (a) => heDate(String(a.updated_at).slice(0, 10))], ['docs', 'מסמכים חסרים', (a) => missingDocs(a).join(', ')], ['pay_reg', 'דמי הרשמה', (a) => ({ paid: 'שולם', failed: 'נכשל', waived: 'פטור' }[a.pay_reg] || '')], ['notes', 'הערות ההורים']]],
];
const ALLCOLS = COLS.flatMap(([, cs]) => cs);
function renderExport(box) {
  const { h } = X;
  const c = conf();
  const E = R.exp || (R.exp = { cols: ['first_name', 'last_name', 'father_phone', 'email', 'period', 'status'], statuses: [], period: '', photos: false });
  const periods = [...new Set((R.data.apps || []).map((a) => a.period).filter(Boolean))];
  box.innerHTML = `<div class="rg-exp">
    <fieldset><legend>תבניות שמורות</legend><div class="ms-bar">${(c.exports || []).map((t, i) => `<span class="rg-xt"><button type="button" class="btn" data-xl="${i}">${h(t.name)}</button><button type="button" class="linkish" data-xd="${i}" title="מחיקה">✕</button></span>`).join('') || '<span class="muted small">אין עדיין.</span>'}
      <span class="spacer"></span><button type="button" class="btn" id="rg-xsave">💾 לשמור כתבנית…</button></div></fieldset>
    <fieldset><legend>אילו מועמדים</legend><div class="rg-grid">
      <label>תקופה <select id="rg-xp"><option value="">כל התקופות</option>${periods.map((p) => `<option${p === E.period ? ' selected' : ''}>${h(p)}</option>`).join('')}</select></label>
      <div class="rg-checks">${c.statuses.map((s) => `<label class="check"><input type="checkbox" data-xs="${h(s.key)}"${E.statuses.includes(s.key) ? ' checked' : ''}> ${h(s.name)}</label>`).join('')}<span class="muted small">(בלי סימון = כולם)</span></div>
    </div></fieldset>
    <fieldset><legend>אילו עמודות</legend><div class="rg-cols">${COLS.map(([g, cs]) => `<div><b>${h(g)}</b>${cs.map(([k, l]) => `<label class="check"><input type="checkbox" data-xc="${k}"${E.cols.includes(k) ? ' checked' : ''}> ${h(l)}</label>`).join('')}</div>`).join('')}
      <div><b>תמונות</b><label class="check"><input type="checkbox" id="rg-xph"${E.photos ? ' checked' : ''}> תמונת הבחור בתוך הקובץ</label></div></div></fieldset>
    <p><button type="button" class="btn primary" id="rg-xgo">⬇ הורדת Excel</button> <span class="muted small" id="rg-xn"></span></p></div>`;
  const read = () => {
    E.period = X.$('#rg-xp', box).value;
    E.statuses = X.$$('[data-xs]', box).filter((x) => x.checked).map((x) => x.dataset.xs);
    E.cols = ALLCOLS.map(([k]) => k).filter((k) => X.$(`[data-xc="${k}"]`, box)?.checked);
    E.photos = X.$('#rg-xph', box).checked;
  };
  const rows = () => (R.data.apps || []).filter((a) => (!E.period || a.period === E.period) && (!E.statuses.length || E.statuses.includes(a.status)));
  const upd = () => { read(); X.$('#rg-xn', box).textContent = `${rows().length} מועמדים · ${E.cols.length} עמודות`; };
  box.onchange = upd; upd();
  X.$$('[data-xl]', box).forEach((b) => { b.onclick = () => { const t = c.exports[Number(b.dataset.xl)]; Object.assign(E, JSON.parse(JSON.stringify(t.e))); renderExport(box); }; });
  const saveExports = async (list) => { const cc = { ...(R.data.conf || {}), exports: list }; const r = await X.call(X.KEY, 'regSettings', { conf: cc }); R.data.conf = r.conf; renderExport(box); };
  X.$$('[data-xd]', box).forEach((b) => { b.onclick = async () => { if (!window.confirm('למחוק את התבנית?')) return; try { await saveExports(c.exports.filter((_, i) => i !== Number(b.dataset.xd))); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$('#rg-xsave', box).onclick = async () => { read(); const name = window.prompt('שם התבנית (למשל: רשימת בחורים לבחינה)'); if (!name) return; try { await saveExports([...(c.exports || []), { name, e: { ...E } }]); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('#rg-xgo', box).onclick = async (ev) => {
    read();
    const list = rows(); if (!list.length) { X.toast('אין מועמדים לפי הסינון.', 'err'); return; }
    const cols = ALLCOLS.filter(([k]) => E.cols.includes(k));
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      let images = null;
      if (E.photos) {
        X.toast('טוען תמונות…');
        await loadPhotos(list.map((a) => a.app_id));
        images = { col: 0, data: await Promise.all(list.map((a) => thumb(R.photos[a.app_id]))) };
      }
      const head = [...(images ? ['תמונה'] : []), ...cols.map(([, l]) => l)];
      const body = list.map((a) => [...(images ? [''] : []), ...cols.map(([k, , f]) => (f ? f(a) : a[k] || ''))]);
      downloadXlsx(`מועמדים ${todayIso()}`, head, body, { rtl: true, images });
    } catch (err) { X.toast(X.msg(err), 'err'); }
    btn.disabled = false;
  };
}
/** א בילד → JPEG קליין (90×120) פאר עקסעל */
async function thumb(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return null;
  const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = dataUrl; });
  if (!im) return null;
  const H = 160; const W = Math.round(im.width * H / im.height);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  cv.getContext('2d').drawImage(im, 0, 0, W, H);
  const b64 = cv.toDataURL('image/jpeg', 0.8).split(',')[1];
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i);
  return { bytes: u, w: W, h: H };
}
export const regDefaults = DEFAULT_CONF;
