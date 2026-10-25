// דער אתר פון א מוסד (שלב 1): לאגאין, די מענטשן פונעם מוסד (תלמידים / עלטערן / צוות), צולייגן און טוישן,
// ארויסנעמען (מיט א בקשה צום הויפט-אתר), און צוות + הרשאות.
import { initAuth, signIn, signOut, call, configured, hasSession, rememberHint } from './api.js?v=316';

const KEY = document.body.dataset.mosad || '';
const TITLE = document.body.dataset.title || '';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (v) => String(v ?? '').trim();

const ERR = {
  'not-configured': 'האתר עדיין לא מחובר (חסר החיבור לשרת). פנה למנהל.',
  'not-signed-in': 'הכניסה פגה — היכנס שוב.',
  'not-allowed': 'החשבון הזה לא מורשה לאתר. בקש מהמנהל להוסיף אותך.',
  'no-mosad': 'המוסד לא מוגדר במערכת. פנה למנהל.',
  'no-permission': 'אין לך הרשאה לפעולה הזו.',
  'owner-only': 'רק הבעלים יכול לשנות מנהל.',
  'is-owner': 'אי אפשר לשנות את הבעלים.',
  'not-yours': 'איש הקשר הזה לא שייך למוסד.',
  'not-found': 'לא נמצא.',
  'need-name': 'חובה למלא שם משפחה.',
  'bad-email': 'כתובת מייל לא תקינה.',
};
const msg = (err) => ERR[err?.code] || ERR[err?.message] || String(err?.message || err || 'שגיאה');

const KINDS = [['student', 'תלמיד'], ['parent', 'הורה'], ['staff', 'צוות'], ['other', 'אחר']];
const kindName = (k) => (KINDS.find(([x]) => x === k) || ['', k || ''])[1];
const PERM_NAMES = { people_edit: 'הוספה ועדכון אנשים', tuition: 'שכר לימוד', chavrusas: 'חברותות', journals: 'יומנים', insurance: 'ביטוח בריאות' };
const ROLE_NAMES = { owner: 'בעלים', admin: 'מנהל', staff: 'צוות' };
const MARITAL = [['', '—'], ['בחור', 'בחור'], ['נשוי', 'נשוי'], ['גרוש', 'גרוש'], ['אלמן', 'אלמן']];

const st = { me: null, mosad: null, people: [], relations: [], enrollments: [], tab: 'people', kind: 'all', q: '' };
const can = (p) => st.me && (st.me.role === 'owner' || st.me.role === 'admin' || st.me.perms.includes(p));
const isAdmin = () => st.me && (st.me.role === 'owner' || st.me.role === 'admin');

function toast(text, kind = '') {
  const t = $('#ms-toast');
  t.textContent = text; t.className = `ms-toast ${kind}`; t.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => { t.hidden = true; }, 3500);
}

// ---------- כניסה ----------
function loginView(note = '', kind = '') {
  $('#ms-app').innerHTML = `<div class="ms-login">
      <img src="../img/favicon.png" alt="" class="ms-logo">
      <h1>${h(TITLE)}</h1>
      <p class="muted">מערכת הניהול של המוסד</p>
      ${note ? `<p class="ms-note ${kind}">${h(note)}</p>` : ''}
      <button type="button" class="btn primary" id="ms-in">כניסה עם Google</button>
      <button type="button" class="linkish" id="ms-other">חשבון אחר</button>
    </div>`;
  $('#ms-in').onclick = () => enter('');
  $('#ms-other').onclick = () => enter('select_account');
}
async function enter(prompt) {
  try {
    if (!configured()) throw Object.assign(new Error('not-configured'), { code: 'not-configured' });
    if (prompt !== null) await signIn(prompt);
    const r = await call(KEY, 'me');
    st.me = r.me; st.mosad = r.mosad;
    rememberHint(st.me.email);
    if (st.mosad?.name) document.title = `${st.mosad.name} – ניהול`;
    await loadPeople();
    render();
  } catch (err) {
    if (err?.code === 'not-allowed' && err.email) loginView(`${err.email}: ${msg(err)}`, 'err');
    else loginView(msg(err), 'err');
  }
}

// ---------- די מענטשן ----------
async function loadPeople() {
  const r = await call(KEY, 'people');
  st.people = r.people || []; st.relations = r.relations || []; st.enrollments = r.enrollments || [];
}
const pById = (id) => st.people.find((p) => String(p.contact_id) === String(id));
const nameOf = (p) => [p.title_he, p.first_name_he, p.last_name_he].map(S).filter(Boolean).join(' ') || [p.first_name_en, p.last_name_en].map(S).filter(Boolean).join(' ') || `#${p.contact_id}`;
const fatherOf = (p) => {
  const id = String(p.contact_id);
  const r = st.relations.find((x) => x.a === id && x.type === 'זון פון') || st.relations.find((x) => x.b === id && x.type === 'טאטע פון');
  return r ? pById(r.a === id ? r.b : r.a) : null;
};
const childrenOf = (p) => {
  const id = String(p.contact_id);
  return st.relations.filter((x) => (x.b === id && x.type === 'זון פון') || (x.a === id && x.type === 'טאטע פון'))
    .map((x) => pById(x.a === id ? x.b : x.a)).filter(Boolean);
};
const enrollOf = (p) => st.enrollments.filter((e) => e.contact_id === String(p.contact_id)).sort((a, b) => S(b.start).localeCompare(S(a.start)))[0];
const phoneOf = (p) => S(p.mobile) || S(p.home_phone);
const norm = (v) => S(v).toLowerCase().replace(/["'״׳]/g, '');

function render() {
  const tabs = [['people', '👥 תלמידים והורים'], ...(isAdmin() ? [['staff', '⚙️ צוות והרשאות']] : [])];
  if (!tabs.some(([k]) => k === st.tab)) st.tab = 'people';
  $('#ms-app').innerHTML = `<header class="ms-head">
      <div class="ms-brand"><img src="../img/favicon.png" alt=""><b>${h(st.mosad?.name || TITLE)}</b></div>
      <span class="spacer"></span>
      <span class="muted small">${h(st.me.name || st.me.email)} · ${h(ROLE_NAMES[st.me.role] || '')}</span>
      <button type="button" class="btn small-btn" id="ms-out">יציאה</button>
    </header>
    <nav class="ms-tabs">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${st.tab === k ? 'on' : ''}">${h(l)}</button>`).join('')}</nav>
    <main id="ms-main"></main>`;
  $('#ms-out').onclick = () => { signOut(); st.me = null; loginView('יצאת מהמערכת.'); };
  $$('[data-tab]').forEach((b) => { b.onclick = () => { st.tab = b.dataset.tab; render(); }; });
  if (st.tab === 'staff') renderStaff(); else renderPeople();
}

function renderPeople() {
  const box = $('#ms-main');
  const counts = Object.fromEntries(KINDS.map(([k]) => [k, st.people.filter((p) => p.kind === k).length]));
  const words = norm(st.q).split(/\s+/).filter(Boolean);
  const list = st.people.filter((p) => (st.kind === 'all' || p.kind === st.kind)
    && (!words.length || words.every((w) => norm([p.first_name_he, p.last_name_he, p.first_name_en, p.last_name_en, p.city, phoneOf(p), fatherOf(p) ? nameOf(fatherOf(p)) : ''].join(' ')).includes(w))))
    .sort((a, b) => S(a.last_name_he || a.last_name_en).localeCompare(S(b.last_name_he || b.last_name_en), 'he') || S(a.first_name_he).localeCompare(S(b.first_name_he), 'he'));
  box.innerHTML = `<div class="ms-bar">
      <input type="search" id="ms-q" placeholder="חיפוש: שם, עיר, טלפון…" value="${h(st.q)}">
      <div class="seg">${[['all', `הכל (${st.people.length})`], ...KINDS.filter(([k]) => counts[k]).map(([k, l]) => [k, `${l} (${counts[k]})`])]
        .map(([k, l]) => `<button type="button" data-kind="${k}" class="${st.kind === k ? 'on' : ''}">${h(l)}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${can('people_edit') ? '<button type="button" class="btn primary" id="ms-add">➕ הוסף</button>' : ''}
      <button type="button" class="btn" id="ms-reload" title="רענון">⟳</button>
    </div>
    <div class="ms-list">${list.length ? `<table class="ms-table"><thead><tr><th>שם</th><th>סוג</th><th>אב</th><th>טלפון</th><th>עיר</th><th>סטטוס</th></tr></thead><tbody>
      ${list.map((p) => { const f = fatherOf(p); const e = enrollOf(p); return `<tr data-id="${h(p.contact_id)}">
        <td><b>${h(nameOf(p))}</b>${S(p.first_name_en) || S(p.last_name_en) ? `<div class="muted small" dir="ltr">${h([p.first_name_en, p.last_name_en].map(S).filter(Boolean).join(' '))}</div>` : ''}</td>
        <td><span class="ms-kind k-${h(p.kind)}">${h(kindName(p.kind))}</span></td>
        <td>${f ? h(nameOf(f)) : ''}</td><td dir="ltr">${h(phoneOf(p))}</td><td>${h(p.city)}</td>
        <td>${e ? `${h(e.status)}${e.shiur ? ` · ${h(e.shiur)}` : ''}` : ''}</td></tr>`; }).join('')}</tbody></table>`
    : `<p class="muted ms-empty">${st.people.length ? 'אין תוצאות.' : 'אין עדיין אנשים במוסד.'}</p>`}</div>`;
  const q = $('#ms-q');
  q.oninput = () => { st.q = q.value; const pos = q.selectionStart; renderPeople(); const nq = $('#ms-q'); nq.focus(); nq.setSelectionRange(pos, pos); };
  $$('[data-kind]', box).forEach((b) => { b.onclick = () => { st.kind = b.dataset.kind; renderPeople(); }; });
  $('#ms-add', box)?.addEventListener('click', () => addDialog());
  $('#ms-reload', box).onclick = async () => { try { await loadPeople(); renderPeople(); toast('עודכן'); } catch (err) { toast(msg(err), 'err'); } };
  $$('tr[data-id]', box).forEach((tr) => { tr.onclick = () => personDialog(pById(tr.dataset.id)); });
}

function dialog(html, cls = '') {
  const d = document.createElement('dialog');
  d.className = `sheet ms-dlg ${cls}`;
  d.innerHTML = `<button type="button" class="x-close" data-x aria-label="סגירה">✕</button>${html}`;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  $$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  d.showModal();
  return d;
}

function personDialog(p) {
  if (!p) return;
  const f = fatherOf(p); const kids = childrenOf(p); const e = enrollOf(p);
  // raw = צו וויסן צי עס איז דא עפעס (html קען זיין נישט ליידיג אפילו ווען דער ווערט איז ליידיג)
  const row = (k, html, raw = html) => (S(String(raw).replace(/<[^>]*>/g, '')) ? `<div class="kv"><span>${h(k)}</span><span>${html}</span></div>` : '');
  const addr = [p.address, [p.city, p.state, p.zip].map(S).filter(Boolean).join(', '), S(p.country) && S(p.country) !== 'USA' ? p.country : ''].map(S).filter(Boolean).map(h).join('<br>');
  const d = dialog(`<h2>${h(nameOf(p))} <span class="ms-kind k-${h(p.kind)}">${h(kindName(p.kind))}</span></h2>
    <section>
      ${row('באנגלית', `<span dir="ltr">${h([p.title_en, p.first_name_en, p.last_name_en].map(S).filter(Boolean).join(' '))}</span>`)}
      ${row('מצב משפחתי', h(p.marital_status))}
      ${row('אב', f ? `<a href="#" data-open="${h(f.contact_id)}">${h(nameOf(f))}</a>` : '')}
      ${kids.length ? row('ילדים', kids.map((k) => `<a href="#" data-open="${h(k.contact_id)}">${h(nameOf(k))}</a>`).join(', ')) : ''}
      ${row('כתובת', `<span dir="ltr">${addr}</span>`)}
      ${row('נייד', `<a dir="ltr" href="tel:${h(S(p.mobile).replace(/\D/g, ''))}">${h(p.mobile)}</a>`)}
      ${row('טלפון בית', `<span dir="ltr">${h(p.home_phone)}</span>`)}
      ${row('מייל', `<a dir="ltr" href="mailto:${h(p.email_1)}">${h(p.email_1)}</a>`)}
      ${e ? row('רישום', h([e.status, e.shiur, e.room ? `חדר ${e.room}` : '', e.start ? `מ-${e.start}` : '', e.end ? `עד ${e.end}` : ''].filter(Boolean).join(' · '))) : ''}
      <p class="muted small">מס' איש קשר: ${h(p.contact_id)}</p>
    </section>
    <div class="actions">
      ${can('people_edit') ? '<button type="button" class="btn danger" id="ms-rm">🗑 הוצא מהמוסד</button>' : ''}
      <span class="spacer"></span>
      ${can('people_edit') ? '<button type="button" class="btn primary" id="ms-edit">✏️ עריכה</button>' : ''}
      <button type="button" class="btn" data-x>סגירה</button>
    </div>`);
  $$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  $$('[data-open]', d).forEach((a) => { a.onclick = (ev) => { ev.preventDefault(); d.close(); personDialog(pById(a.dataset.open)); }; });
  $('#ms-edit', d)?.addEventListener('click', () => { d.close(); editDialog(p); });
  $('#ms-rm', d)?.addEventListener('click', async () => {
    const why = window.prompt(`להוציא את ${nameOf(p)} מהמוסד?\n\nהוא ייצא מיד מהרשימה כאן, ותישלח בקשה למנהל המאגר הכללי למחוק אותו גם משם (המנהל יאשר או ידחה).\n\nסיבה (לא חובה):`, '');
    if (why === null) return;
    try { await call(KEY, 'remove', { contact_id: p.contact_id, why }); d.close(); await loadPeople(); renderPeople(); toast('הוצא מהמוסד, ונשלחה בקשה למנהל.'); } catch (err) { toast(msg(err), 'err'); }
  });
}

/** צולייגן: ערשט זוכן אינעם מאגר (נישט מאכן טאפלט), דערנאך — א נייער */
function addDialog() {
  const d = dialog(`<h2>➕ הוספה</h2>
    <p class="muted small">קודם בודקים אם הוא כבר קיים במאגר הכללי — כדי לא ליצור כפילות.</p>
    <div class="ms-find"><input id="ms-fq" placeholder="שם (למשל: משה כהן)"><input id="ms-fph" dir="ltr" placeholder="טלפון (לא חובה)">
      <select id="ms-fkind">${KINDS.map(([k, l]) => `<option value="${k}">${h(l)}</option>`).join('')}</select>
      <button type="button" class="btn primary" id="ms-fgo">🔍 חיפוש</button></div>
    <div id="ms-fout"></div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" id="ms-fnew">➕ איש חדש (לא נמצא)</button><button type="button" class="btn" data-x>ביטול</button></div>`);
  const kind = () => $('#ms-fkind', d).value;
  const go = async () => {
    const q = $('#ms-fq', d).value.trim();
    const out = $('#ms-fout', d);
    if (q.length < 2 && !$('#ms-fph', d).value.trim()) { out.innerHTML = '<p class="muted">כתוב לפחות 2 אותיות.</p>'; return; }
    out.innerHTML = '<p class="muted">מחפש…</p>';
    try {
      const r = await call(KEY, 'find', { q, phone: $('#ms-fph', d).value });
      const mine = new Set(st.people.map((p) => String(p.contact_id)));
      out.innerHTML = r.found.length ? `<div class="ms-found">${r.found.map((x) => `<div class="ms-fr"><span><b>${h(x.name)}</b> <span class="muted small" dir="ltr">${h(x.en)}</span> ${x.city ? `· ${h(x.city)}` : ''} <span class="muted small">#${h(x.contact_id)}</span></span>
          ${mine.has(String(x.contact_id)) ? '<span class="muted small">✓ כבר במוסד</span>' : `<button type="button" class="btn small-btn primary" data-link="${h(x.contact_id)}">זה הוא — הוסף</button>`}</div>`).join('')}</div>`
        : '<p class="muted">לא נמצא במאגר. אפשר להוסיף איש חדש.</p>';
      $$('[data-link]', out).forEach((b) => {
        b.onclick = async () => {
          b.disabled = true;
          try { await call(KEY, 'link', { contact_id: b.dataset.link, kind: kind() }); d.close(); await loadPeople(); renderPeople(); toast('נוסף למוסד.'); personDialog(pById(b.dataset.link)); } catch (err) { b.disabled = false; toast(msg(err), 'err'); }
        };
      });
    } catch (err) { out.innerHTML = `<p class="ms-note err">${h(msg(err))}</p>`; }
  };
  $('#ms-fgo', d).onclick = go;
  $('#ms-fq', d).onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('#ms-fnew', d).onclick = () => {
    const q = $('#ms-fq', d).value.trim().split(/\s+/);
    const he = /[֐-׿]/.test(q.join(''));
    const pre = { kind: kind(), mobile: $('#ms-fph', d).value.trim(), ...(he ? { first_name_he: q.slice(0, -1).join(' '), last_name_he: q.length > 1 ? q[q.length - 1] : q[0] || '' } : { first_name_en: q.slice(0, -1).join(' '), last_name_en: q.length > 1 ? q[q.length - 1] : q[0] || '' }) };
    d.close(); editDialog(null, pre);
  };
  $('#ms-fq', d).focus();
}

/** טאפס: נייער (p=null) אדער טוישן */
function editDialog(p, pre = {}) {
  const v0 = p || pre;
  const v = (k) => h(v0[k] ?? '');
  const parents = st.people.filter((x) => x.kind === 'parent' || childrenOf(x).length);
  const f = p ? fatherOf(p) : null;
  const d = dialog(`<h2>${p ? `✏️ ${h(nameOf(p))}` : '➕ איש חדש'}</h2>
    <form autocomplete="off" class="ms-form">
      ${p ? '' : `<label>סוג<select name="kind">${KINDS.map(([k, l]) => `<option value="${k}"${(pre.kind || 'student') === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>`}
      <div class="grid">
        <label>תואר<input name="title_he" value="${v('title_he')}"></label>
        <label>שם פרטי<input name="first_name_he" value="${v('first_name_he')}"></label>
        <label>שם משפחה *<input name="last_name_he" value="${v('last_name_he')}"></label>
        <label>Title<input name="title_en" dir="ltr" value="${v('title_en')}"></label>
        <label>First name<input name="first_name_en" dir="ltr" value="${v('first_name_en')}"></label>
        <label>Last name<input name="last_name_en" dir="ltr" value="${v('last_name_en')}"></label>
        <label>מצב משפחתי<select name="marital_status">${MARITAL.map(([k, l]) => `<option value="${h(k)}"${S(v0.marital_status) === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>
      </div>
      <div class="grid" dir="ltr">
        <label class="wide">Address<input name="address" value="${v('address')}"></label>
        <label>City<input name="city" value="${v('city')}"></label>
        <label>State<input name="state" value="${v('state')}"></label>
        <label>ZIP<input name="zip" value="${v('zip')}"></label>
        <label>Country<input name="country" value="${v('country') || (p ? '' : 'USA')}"></label>
      </div>
      <div class="grid">
        <label>נייד<input name="mobile" dir="ltr" value="${v('mobile')}"></label>
        <label>טלפון בית<input name="home_phone" dir="ltr" value="${v('home_phone')}"></label>
        <label>מייל<input name="email_1" type="email" dir="ltr" value="${v('email_1')}"></label>
      </div>
      ${f ? `<p class="muted small">אב: ${h(nameOf(f))}</p>` : `<label class="ms-father">אב (בן של…)<input name="father" list="ms-dl-par" placeholder="בחר מההורים במוסד (לא חובה)"></label>
      <datalist id="ms-dl-par">${parents.map((x) => `<option value="${h(`${nameOf(x)} (#${x.contact_id})`)}">`).join('')}</datalist>`}
      <p class="muted small">השינויים נשמרים ישר גם במאגר הכללי.</p>
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div>
    </form>`);
  $$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = $('form', d);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const val = (n) => S(form.elements[n]?.value);
    const contact = Object.fromEntries(['title_he', 'first_name_he', 'last_name_he', 'title_en', 'first_name_en', 'last_name_en', 'marital_status', 'address', 'city', 'state', 'zip', 'country'].map((k) => [k, k === 'state' ? val(k).toUpperCase() : val(k)]));
    const phones = { mobile: val('mobile'), home_phone: val('home_phone'), email_1: val('email_1') };
    if (!contact.last_name_he && !contact.last_name_en) { toast(ERR['need-name'], 'err'); return; }
    const fm = val('father').match(/\(#(\d+)\)/);
    if (val('father') && !fm) { toast('בחר את האב מהרשימה.', 'err'); return; }
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      const r = await call(KEY, 'save', { contact_id: p?.contact_id || '', contact, phones, kind: val('kind') || p?.kind || 'student', rel: fm ? { type: 'זון פון', to: fm[1] } : null });
      d.close(); await loadPeople(); renderPeople(); toast(p ? 'נשמר.' : 'נוסף.');
      personDialog(pById(r.contact_id));
    } catch (err) { btn.disabled = false; toast(msg(err), 'err'); }
  };
  form.elements[p ? 'first_name_he' : 'kind'].focus();
}

// ---------- צוות און הרשאות ----------
async function renderStaff() {
  const box = $('#ms-main');
  box.innerHTML = '<p class="muted">טוען…</p>';
  let r;
  try { r = await call(KEY, 'staff'); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(msg(err))}</p>`; return; }
  const owner = st.me.role === 'owner';
  const permBox = (s, dis) => r.permsAll.map((p) => `<label class="check"><input type="checkbox" data-perm="${p}"${s.role === 'admin' || s.perms.includes(p) ? ' checked' : ''}${dis || s.role === 'admin' ? ' disabled' : ''}> ${h(PERM_NAMES[p] || p)}</label>`).join('');
  box.innerHTML = `<p class="muted small">כל אחד רואה רק את מה שמותר לו. רשימת הצוות וההרשאות גלויה רק לבעלים ולמנהלים.${owner ? '' : ' רק הבעלים יכול להוסיף או לשנות מנהל.'}</p>
    <div class="ms-staff">
      ${r.owners.map((e) => `<div class="ms-srow owner"><b dir="ltr">${h(e)}</b><span class="ms-kind">🔒 בעלים</span><span class="muted small">גישה מלאה. אי אפשר להסיר.</span></div>`).join('')}
      ${r.staff.map((s, i) => { const dis = !owner && s.role === 'admin'; return `<div class="ms-srow${s.active ? '' : ' off'}" data-i="${i}">
        <div><b>${h(s.name || '—')}</b> <span class="muted small" dir="ltr">${h(s.email)}</span></div>
        <select data-role${dis ? ' disabled' : ''}><option value="staff"${s.role === 'staff' ? ' selected' : ''}>צוות</option><option value="admin"${s.role === 'admin' ? ' selected' : ''}${owner ? '' : ' disabled'}>מנהל</option></select>
        <div class="ms-perms">${permBox(s, dis)}</div>
        <label class="check"><input type="checkbox" data-active${s.active ? ' checked' : ''}${dis ? ' disabled' : ''}> פעיל</label>
        ${dis ? '' : `<button type="button" class="btn small-btn" data-save>💾</button><button type="button" class="linkish" data-del>🗑</button>`}
      </div>`; }).join('')}
    </div>
    <h3>➕ איש צוות חדש</h3>
    <form class="ms-sadd" autocomplete="off">
      <input name="name" placeholder="שם"><input name="email" type="email" dir="ltr" placeholder="כתובת Gmail שלו">
      <select name="role"><option value="staff">צוות</option>${owner ? '<option value="admin">מנהל</option>' : ''}</select>
      <div class="ms-perms">${r.permsAll.map((p) => `<label class="check"><input type="checkbox" name="perm" value="${p}"> ${h(PERM_NAMES[p] || p)}</label>`).join('')}</div>
      <button type="submit" class="btn primary">הוסף</button>
    </form>
    <p class="muted small">איש הצוות נכנס לאתר הזה עם חשבון הגוגל שלו. אין לו גישה לגיליונות עצמם.</p>`;
  const rowData = (row) => {
    const s = r.staff[Number(row.dataset.i)];
    return { email: s.email, name: s.name, role: $('[data-role]', row).value, active: $('[data-active]', row).checked, perms: $$('[data-perm]:checked', row).map((x) => x.dataset.perm) };
  };
  $$('.ms-srow[data-i]', box).forEach((row) => {
    $('[data-role]', row).onchange = () => { const a = $('[data-role]', row).value === 'admin'; $$('[data-perm]', row).forEach((x) => { x.disabled = a; if (a) x.checked = true; }); };
    $('[data-save]', row)?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await call(KEY, 'staffSave', { staff: rowData(row) }); toast('נשמר.'); renderStaff(); } catch (err) { e.target.disabled = false; toast(msg(err), 'err'); }
    });
    $('[data-del]', row)?.addEventListener('click', async () => {
      const s = r.staff[Number(row.dataset.i)];
      if (!window.confirm(`להסיר את ${s.name || s.email} מהצוות?`)) return;
      try { await call(KEY, 'staffRemove', { email: s.email }); toast('הוסר.'); renderStaff(); } catch (err) { toast(msg(err), 'err'); }
    });
  });
  const add = $('.ms-sadd', box);
  add.elements.role.onchange = () => { const a = add.elements.role.value === 'admin'; $$('[name=perm]', add).forEach((x) => { x.disabled = a; if (a) x.checked = true; }); };
  add.onsubmit = async (e) => {
    e.preventDefault();
    const staff = { name: S(add.elements.name.value), email: S(add.elements.email.value), role: add.elements.role.value, perms: $$('[name=perm]:checked', add).map((x) => x.value), active: true };
    try { await call(KEY, 'staffSave', { staff }); toast('נוסף.'); renderStaff(); } catch (err) { toast(msg(err), 'err'); }
  };
}

// ---------- אנהייב ----------
(async () => {
  loginView();
  try { await initAuth(); } catch { /* */ }
  if (!configured()) { loginView(ERR['not-configured'], 'err'); return; }
  if (hasSession()) enter(null);
})();
