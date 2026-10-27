// דער אתר פון א מוסד: לאגאין, אן ערשטער בלאט מיט כפתורים (יעדער כפתור = א הרשאה), די מענטשן פונעם מוסד,
// תלמידים / בוגרים / הורים / שכר לימוד (school.js), און צוות + הרשאות.
import { initAuth, signIn, signOut, call, configured, hasSession, rememberHint, brand, prefetch, clearPrefetch } from './api.js?v=470';
import { initSchool, loadSchool, renderStudents, renderParents, renderTuition, personSchool, currentZman } from './school.js?v=470';
import { initGifts, renderGifts } from './gifts.js?v=470';
import { initJournal, renderChav, renderAtt, renderIns, printPhones, settingsHtml, wireSettings, printWin, setAttTab } from './journal.js?v=470';
import { initMe, renderMe, renderLog, historyDialog, backupsHtml, wireBackups } from './me.js?v=470';
import { initTeam, renderTeam } from './team.js?v=470';
import { initFinance, renderFinance, payDialog } from './finance.js?v=470';

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
  'has-receipt': 'יצאה קבלה על התשלום הזה — קודם לבטל את הקבלה.',
  'has-payments': 'יש תשלומים על הרישום הזה.',
  'bad-amount': 'סכום לא תקין.',
  'bad-last4': 'רק 4 ספרות אחרונות של הכרטיס.',
  'bad-logo': 'הלוגו גדול מדי.',
  'bad-week': 'חסר שבוע / סדר.',
  'bad-date': 'תאריך לא תקין.',
  'not-team': 'אינך רשום כאיש צוות (או שהמייל שלך לא מוגדר ב"אנשי צוות").',
  'clock-done': 'היום כבר נרשמו כניסה ויציאה.',
  'need-text': 'חסר תוכן.',
  'bad-file': 'אפשר להעלות רק תמונה או PDF.',
  'file-big': 'הקובץ גדול מדי.',
  'bad-currency': 'מטבע לא תקין.',
  'bad-action': 'החלק הזה עוד לא הופעל בשרת (ממתין לאישור הגישה לדרייב). נסה שוב אחר כך.',
  'need-contact': 'נדבה שכבר באתר הכללי צריכה איש קשר. (קבלה אמריקאית — רק עם איש קשר.)',
};
const msg = (err) => ERR[err?.code] || ERR[err?.message] || String(err?.message || err || 'שגיאה');

const KINDS = [['student', 'תלמיד'], ['parent', 'הורה'], ['staff', 'צוות'], ['avreich', 'אברך'], ['donor', 'תורם'], ['other', 'אחר']];
const kindName = (k) => (KINDS.find(([x]) => x === k) || ['', k || ''])[1];
const hasKind = (p, k) => (p?.kinds || [p?.kind]).includes(k);
const kindBadges = (p) => (p.kinds || [p.kind]).map((k) => `<span class="ms-kind k-${h(k)}">${h(kindName(k))}</span>`).join(' ');
// הכפתורים בדף הפתיחה — כל כפתור הוא גם הרשאה
const TILES = [
  { k: 'students', ic: '🎓', t: 'תלמידי הישיבה', sub: 'כולל טלפון בארץ' },
  { k: 'staff_list', ic: '👔', t: 'אנשי צוות ואברכים', sub: 'כולל אברכים שלומדים עם בחורים' },
  { k: 'tuition', ic: '💲', t: 'שכר לימוד', sub: 'תשלומים וקבלות' },
  { k: 'insurance', ic: '🏥', t: 'ביטוח בריאות', sub: 'קופה, מספר חבר, חובות' },
  { k: 'attendance', ic: '✅', t: 'השתתפות', sub: 'יומנים, כניסה ויציאה של אברכים' },
  { k: 'chavrusas', ic: '🤝', t: 'חברותות', sub: 'לכל סדר, כולל אברכים' },
  { k: 'donations', ic: '💝', t: 'נדבות וקבלות', sub: 'כולל קבלות אמריקאיות' },
  { k: 'finance', ic: '💰', t: 'משכורות והוצאות', sub: 'הכנסות, חובות, מאזן' },
  { k: 'alumni', ic: '🚪', t: 'בוגרי הישיבה', sub: 'וההורים שלהם' },
  { k: 'parents', ic: '👪', t: 'הורי התלמידים', sub: 'תלמידי הישיבה ובוגרים' },
];
const PERM_NAMES = { ...Object.fromEntries(TILES.map((x) => [x.k, x.t])), people_edit: 'הוספה ועדכון אנשי קשר' };

const ROLE_NAMES = { owner: 'בעלים', admin: 'מנהל', staff: 'צוות' };
const MARITAL = [['', '—'], ['בחור', 'בחור'], ['נשוי', 'נשוי'], ['גרוש', 'גרוש'], ['אלמן', 'אלמן']];

const st = { me: null, mosad: null, people: [], relations: [], enrollments: [], tab: 'home', kind: 'all', q: '', logo: '' };
const logoSrc = () => st.logo || st.mosad?.logo || '../img/favicon.png';
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
      <img src="${h(logoSrc())}" alt="" class="ms-logo">
      <h1>${h(TITLE)}</h1>
      <p class="muted">מערכת הניהול של המוסד</p>
      ${note ? `<p class="ms-note ${kind}">${h(note)}</p>` : ''}
      <button type="button" class="btn primary" id="ms-in">כניסה עם Google</button>
      <button type="button" class="linkish" id="ms-other">חשבון אחר</button>
    </div>`;
  $('#ms-in').onclick = () => enter('');
  $('#ms-other').onclick = () => enter('select_account');
}
// ---------- 🚪 פתיחה: שערים + שעון חול, בשעת די ידיעות ווערן געלאדן; צום סוף עפענען זיך די שערים ----------
const SPLASH_MSGS = ['פותחים את השערים…', 'טוען תלמידים…', 'טוען אנשי צוות ואברכים…', 'טוען שכר לימוד…', 'טוען נדבות…', 'טוען משכורות והוצאות…', 'כמעט מוכן…'];
let splashT = null;
let splashHold = false; // בשעת גוגל — נישט טוישן די מעלדונג
function splashShow() {
  if ($('#ms-splash')) return;
  const el = document.createElement('div');
  el.id = 'ms-splash';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="sp-gate sp-r"></div><div class="sp-gate sp-l"></div>
    <div class="sp-center"><div class="sp-medal"><img src="${h(logoSrc())}" alt=""></div>
      <h1>${h(st.mosad?.name || TITLE)}</h1>
      <div class="sp-glass" aria-hidden="true"><span class="sp-top"></span><span class="sp-bot"></span><span class="sp-stream"></span></div>
      <p class="sp-msg">${h(SPLASH_MSGS[0])}</p><div class="sp-bar"><span></span></div></div>`;
  document.body.appendChild(el);
  let i = 0;
  splashT = setInterval(() => { if (splashHold) return; i = Math.min(i + 1, SPLASH_MSGS.length - 1); const m = $('.sp-msg', el); if (m) m.textContent = SPLASH_MSGS[i]; }, 1300);
}
function splashMsg(t) { const m = $('#ms-splash .sp-msg'); if (m) m.textContent = t; }
function splashDone(ok = true) {
  clearInterval(splashT);
  const el = $('#ms-splash');
  if (!el) return;
  if (!ok) { el.remove(); return; }
  const m = $('.sp-msg', el); if (m) m.textContent = 'ברוכים הבאים';
  el.classList.add('sp-full');
  setTimeout(() => el.classList.add('sp-open'), 250);
  setTimeout(() => el.remove(), 1500);
}

async function enter(prompt) {
  try {
    if (!configured()) throw Object.assign(new Error('not-configured'), { code: 'not-configured' });
    // די פתיחה — גלייך ביים קליק (אויך בשעת גוגל באשטעטיגט), נישט ערשט נאכדעם
    splashShow();
    if (prompt !== null) { splashHold = true; splashMsg('מתחבר עם Google…'); try { await signIn(prompt); } finally { splashHold = false; } splashMsg(SPLASH_MSGS[0]); }
    const iso = (d) => d.toISOString().slice(0, 10);
    const now0 = new Date(); const sun = new Date(Date.UTC(now0.getFullYear(), now0.getMonth(), now0.getDate() - now0.getDay(), 12));
    const sat = new Date(sun); sat.setUTCDate(sat.getUTCDate() + 6);
    await prefetch(KEY, [{ action: 'me' }, { action: 'people' }, { action: 'school' }, { action: 'gifts' }, { action: 'fin' }, { action: 'team' }, { action: 'tasks' },
      { action: 'ins' }, { action: 'users' }, { action: 'staff' }, { action: 'chav', params: { zman: currentZman() } },
      { action: 'att', params: { from: iso(sun), to: iso(sun) } }, { action: 'hours', params: { from: iso(sun), to: iso(sat) } }]).catch((err) => {
      if (['not-signed-in', 'not-allowed', 'no-mosad', 'not-configured'].includes(err?.code)) throw err;
    });
    const r = await call(KEY, 'me');
    st.me = r.me; st.mosad = r.mosad; st.settings = r.settings || {}; st.team = r.team || null; st.openTasks = r.openTasks || 0; st.clock = r.clock || null;
    rememberHint(st.me.email);
    if (st.mosad?.name) document.title = `${st.mosad.name} – ניהול`;
    if (st.mosad?.logo) st.logo = st.mosad.logo;
    await Promise.all([loadPeople(), ['students', 'alumni', 'parents', 'tuition'].some(can) ? loadSchool().catch(() => {}) : null]);
    // נאך א רענון — צוריק צום זעלבן כפתור
    const hv = decodeURIComponent(location.hash.slice(1));
    if (hv) st.tab = hv;
    history.replaceState({ tab: st.tab }, '', `#${st.tab}`);
    render();
    splashDone();
  } catch (err) {
    splashDone(false);
    if (err?.code === 'not-allowed' && err.email) loginView(`${err.email}: ${msg(err)}`, 'err');
    else loginView(msg(err), 'err');
  }
}

// ---------- די מענטשן ----------
async function loadPeople() {
  const r = await call(KEY, 'people');
  st.people = r.people || []; st.relations = r.relations || []; st.enrollments = r.enrollments || [];
  // כמה סוגים פאר א מענטש ("parent,avreich")
  st.people.forEach((p) => { p.kinds = S(p.kind).split(',').map(S).filter(Boolean); if (!p.kinds.length) p.kinds = ['other']; p.kind = p.kinds[0]; });
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

// דער „צוריק" פונעם בלעטערער: יעדער כפתור איז א שריט אין דער היסטאריע
window.addEventListener('popstate', (e) => {
  if (!st.me) return;
  const dlg = document.querySelector('dialog[open]');
  if (dlg) { dlg.close(); history.pushState({ tab: st.tab }, '', `#${st.tab}`); return; }
  st.tab = e.state?.tab || decodeURIComponent(location.hash.slice(1)) || 'home';
  render(true);
});
function render(fromPop) {
  const view = TILES.find((x) => x.k === st.tab);
  const ok = st.tab === 'home' || st.tab === 'me' || (st.tab === 'people' && can('people_edit')) || ((st.tab === 'staff' || st.tab === 'log') && isAdmin()) || (view && can(view.k));
  if (!ok) st.tab = 'home';
  if (!fromPop && history.state?.tab !== st.tab) history.pushState({ tab: st.tab }, '', `#${st.tab}`);
  $('#ms-app').innerHTML = `<header class="ms-head">
      <button type="button" class="ms-brand linkish" id="ms-home" title="דף הבית"><img src="${h(logoSrc())}" alt=""><b>${h(st.mosad?.name || TITLE)}</b></button>
      <span class="spacer"></span>
      <button type="button" class="btn small-btn ms-mebtn" id="ms-me" title="אזור אישי">👤 ${h(st.me.name || st.me.email)} · ${h(ROLE_NAMES[st.me.role] || '')}${st.openTasks ? ` <span class="count-pill">${st.openTasks}</span>` : ''}</button>
      <button type="button" class="btn small-btn" id="ms-out">יציאה</button>
    </header>
    ${st.tab === 'home' ? '' : `<nav class="ms-crumb"><button type="button" class="linkish" id="ms-back">→ דף הבית</button></nav>`}
    <main id="ms-main"></main>`;
  $('#ms-out').onclick = () => { signOut(); clearPrefetch(); st.me = null; loginView('יצאת מהמערכת.'); };
  $('#ms-home').onclick = () => { st.tab = 'home'; render(); };
  $('#ms-me').onclick = () => { st.tab = 'me'; render(); };
  $('#ms-back')?.addEventListener('click', () => { st.tab = 'home'; render(); });
  const box = $('#ms-main');
  if (st.tab === 'home') renderHome(box);
  else if (st.tab === 'staff') renderStaff();
  else if (st.tab === 'people') renderPeople();
  else if (st.tab === 'students') renderStudents(box, 'active');
  else if (st.tab === 'alumni') renderStudents(box, 'left');
  else if (st.tab === 'parents') renderParents(box);
  else if (st.tab === 'tuition') renderTuition(box);
  else if (st.tab === 'donations') renderGifts(box);
  else if (st.tab === 'chavrusas') renderChav(box);
  else if (st.tab === 'attendance') renderAtt(box);
  else if (st.tab === 'insurance') renderIns(box);
  else if (st.tab === 'staff_list') renderTeam(box);
  else if (st.tab === 'finance') renderFinance(box);
  else if (st.tab === 'me') renderMe(box);
  else if (st.tab === 'log') renderLog(box);
  else renderSoon(box, view);
}

function renderHome(box) {
  const tiles = TILES.filter((x) => can(x.k));
  // די קליינע כפתורים — אין צוויי שורות, נאך די גרויסע
  const small = [
    can('people_edit') ? '<button type="button" class="btn" data-go="people">👥 כל האנשים</button>' : '',
    isAdmin() ? '<button type="button" class="btn" data-go="staff">⚙️ צוות והרשאות</button>' : '',
    isAdmin() ? '<button type="button" class="btn" data-go="log">📜 יומן פעולות</button>' : '',
    isAdmin() ? '<button type="button" class="btn" id="ms-logo">🖼 לוגו</button>' : '',
  ].filter(Boolean);
  const myName = (st.team && pById(st.team.contact_id) ? nameOf(pById(st.team.contact_id)) : '') || st.me.name || st.me.email.split('@')[0];
  const initials = myName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
  box.innerHTML = `<div class="ms-home"><div class="ms-welcome">
      <div class="ms-wl-head"><img src="${h(logoSrc())}" alt="" class="ms-wl-logo"><h1>${h(st.mosad?.name || TITLE)}</h1><p class="muted">ברוך הבא · ${h(myName)}</p></div>
      <button type="button" class="ms-tile ms-wl-me" id="ms-tasks"><span class="ms-avatar">${h(initials)}</span><b>${h(myName)}</b>
        <span class="muted small">${st.openTasks ? `📋 ${st.openTasks} משימות פתוחות` : '👤 אזור אישי'}</span></button>
    </div><div class="ms-tiles">${tiles.map((x) => `<button type="button" class="ms-tile${x.soon ? ' soon' : ''}" data-go="${x.k}">
      <span class="ms-ti">${x.ic}</span><b>${h(x.t)}</b>${x.sub ? `<span class="muted small">${h(x.sub)}</span>` : ''}${x.soon ? '<span class="ms-soon">בקרוב</span>' : ''}</button>`).join('')}
      ${small.length ? `<div class="ms-more">${small.join('')}</div>` : ''}</div>
    ${tiles.length ? '' : '<p class="ms-note">עדיין לא קיבלת הרשאה לאף כפתור. בקש מהמנהל.</p>'}</div>`;
  $$('[data-go]', box).forEach((b) => { b.onclick = () => { st.tab = b.dataset.go; st.kind = 'all'; render(); }; });
  $('#ms-logo', box)?.addEventListener('click', () => logoDialog());
  $('#ms-tasks', box)?.addEventListener('click', () => { st.tab = 'me'; render(); });
}
function renderSoon(box, view) {
  box.innerHTML = `<h2 class="ms-h">${view?.ic || ''} ${h(view?.t || '')}</h2><p class="ms-note">החלק הזה בבנייה — יהיה כאן בקרוב.</p>`;
}

/** לוגו: תמונה קטנה (מוקטנת ל-256 פיקסלים) — נשמרת אצל המוסד */
function logoDialog() {
  const d = dialog(`<h2>🖼 לוגו המוסד</h2>
    <p><img src="${h(logoSrc())}" alt="" style="max-width:160px;max-height:120px"></p>
    <input type="file" accept="image/*" id="ms-lf">
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`);
  $('#ms-lf', d).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const img = new Image(); img.src = url; await img.decode();
      const k = Math.min(1, 256 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let data = c.toDataURL('image/png');
      if (data.length > 45000) data = c.toDataURL('image/webp', 0.85);
      await call(KEY, 'setLogo', { logo: data });
      st.logo = data; d.close(); render(); toast('הלוגו נשמר.');
    } catch (err) { toast(msg(err), 'err'); }
  };
}

function renderPeople() {
  const box = $('#ms-main');
  const counts = Object.fromEntries(KINDS.map(([k]) => [k, st.people.filter((p) => hasKind(p, k)).length]));
  const words = norm(st.q).split(/\s+/).filter(Boolean);
  const staffView = st.tab === 'staff_list';
  const list = st.people.filter((p) => (staffView ? (hasKind(p, 'staff') || hasKind(p, 'avreich')) && (st.kind === 'staffav' || hasKind(p, st.kind)) : st.kind === 'all' || hasKind(p, st.kind))
    && (!words.length || words.every((w) => norm([p.first_name_he, p.last_name_he, p.first_name_en, p.last_name_en, p.city, phoneOf(p), fatherOf(p) ? nameOf(fatherOf(p)) : ''].join(' ')).includes(w))))
    .sort((a, b) => S(a.last_name_he || a.last_name_en).localeCompare(S(b.last_name_he || b.last_name_en), 'he') || S(a.first_name_he).localeCompare(S(b.first_name_he), 'he'));
  const segs = staffView ? [['staffav', `הכל (${counts.staff + counts.avreich})`], ['staff', `צוות (${counts.staff})`], ['avreich', `אברכים (${counts.avreich})`]]
    : [['all', `הכל (${st.people.length})`], ...KINDS.filter(([k]) => counts[k]).map(([k, l]) => [k, `${l} (${counts[k]})`])];
  box.innerHTML = `<h2 class="ms-h">${staffView ? '👔 אנשי צוות ואברכים' : '👥 כל האנשים'}</h2>
    ${staffView ? '<p class="muted small">אברכים שלומדים עם בחורים — סוג "אברך". אפשר להוסיף או לשנות סוג דרך ➕ הוסף / עריכה.</p>' : ''}
    <div class="ms-bar">
      <input type="search" id="ms-q" placeholder="חיפוש: שם, עיר, טלפון…" value="${h(st.q)}">
      <div class="seg">${segs
        .map(([k, l]) => `<button type="button" data-kind="${k}" class="${st.kind === k ? 'on' : ''}">${h(l)}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${can('people_edit') ? '<button type="button" class="btn primary" id="ms-add">➕ הוסף</button>' : ''}
      <button type="button" class="btn" id="ms-reload" title="רענון">⟳</button>
    </div>
    <div class="ms-list">${list.length ? `<table class="ms-table"><thead><tr><th>שם</th><th>סוג</th><th>אב</th><th>טלפון</th><th>עיר</th><th>סטטוס</th></tr></thead><tbody>
      ${list.map((p) => { const f = fatherOf(p); const e = enrollOf(p); return `<tr data-id="${h(p.contact_id)}">
        <td><b>${h(nameOf(p))}</b>${S(p.first_name_en) || S(p.last_name_en) ? `<div class="muted small" dir="ltr">${h([p.first_name_en, p.last_name_en].map(S).filter(Boolean).join(' '))}</div>` : ''}</td>
        <td>${kindBadges(p)}</td>
        <td>${f ? h(nameOf(f)) : ''}</td><td dir="ltr">${h(phoneOf(p))}</td><td>${h(p.city)}</td>
        <td>${e ? `${h(e.status)}${e.shiur ? ` · ${h(e.shiur)}` : ''}` : ''}</td></tr>`; }).join('')}</tbody></table>`
    : `<p class="muted ms-empty">${st.people.length ? 'אין תוצאות.' : 'אין עדיין אנשים במוסד.'}</p>`}</div>`;
  const q = $('#ms-q');
  q.oninput = () => { st.q = q.value; const pos = q.selectionStart; renderPeople(); const nq = $('#ms-q'); nq.focus(); nq.setSelectionRange(pos, pos); };
  $$('[data-kind]', box).forEach((b) => { b.onclick = () => { st.kind = b.dataset.kind; renderPeople(); }; });
  $('#ms-add', box)?.addEventListener('click', () => addDialog(staffView ? (st.kind === 'avreich' ? 'avreich' : 'staff') : ''));
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

/** ארויס פון א רשימה (kind) אדער — kind = null — פונעם גאנצן מוסד. after() נאכן שמירה */
function unlinkDialog(p, kind, title = '', after = null) {
  const others = kind ? (p.kinds || [p.kind]).filter((k) => k !== kind) : [];
  const d = dialog(`<h2>🗑 ${h(title || (kind ? `הוצאה מרשימת ${kindName(kind)}` : 'הוצאה מהמוסד'))}</h2>
    <p><b>${h(nameOf(p))}</b></p>
    ${others.length ? `<p class="muted small">הוא יישאר במוסד בתור ${h(others.map(kindName).join(', '))}. ההיסטוריה שלו נשמרת.</p>`
      : `<p class="muted small">הוא ייצא מכל הרשימות של המוסד. ההיסטוריה, התשלומים והמשכורות שלו נשמרים.</p>
        <label class="check"><input type="checkbox" id="ul-req"> לבקש מהמנהל למחוק אותו גם מהמאגר הכללי</label>`}
    <label class="wide">סיבה (לא חובה)<input id="ul-why"></label>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn danger" id="ul-go">🗑 הוצאה</button></div>`);
  $$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  $('#ul-go', d).onclick = async () => {
    const req = { contact_id: p.contact_id, why: S($('#ul-why', d).value), request: Boolean($('#ul-req', d)?.checked) };
    try {
      $('#ul-go', d).disabled = true;
      if (kind) await call(KEY, 'unlink', { ...req, kind }); else await call(KEY, 'remove', req);
      d.close(); await loadPeople(); if (after) await after(); render();
      toast(req.request ? 'הוצא, ונשלחה בקשה למנהל.' : 'הוצא.');
    } catch (err) { $('#ul-go', d).disabled = false; toast(msg(err), 'err'); }
  };
}

function personDialog(p) {
  if (!p) return;
  const f = fatherOf(p); const kids = childrenOf(p); const e = enrollOf(p);
  // raw = צו וויסן צי עס איז דא עפעס (html קען זיין נישט ליידיג אפילו ווען דער ווערט איז ליידיג)
  const row = (k, html, raw = html) => (S(String(raw).replace(/<[^>]*>/g, '')) ? `<div class="kv"><span>${h(k)}</span><span>${html}</span></div>` : '');
  const addr = [p.address, [p.city, p.state, p.zip].map(S).filter(Boolean).join(', '), S(p.country) && S(p.country) !== 'USA' ? p.country : ''].map(S).filter(Boolean).map(h).join('<br>');
  const d = dialog(`<h2>${h(nameOf(p))} ${kindBadges(p)}</h2>
    <section>
      ${row('באנגלית', `<span dir="ltr">${h([p.title_en, p.first_name_en, p.last_name_en].map(S).filter(Boolean).join(' '))}</span>`)}
      ${row('מצב משפחתי', h(p.marital_status))}
      ${row('אב', f ? `<a href="#" data-open="${h(f.contact_id)}">${h(nameOf(f))}</a>` : '')}
      ${kids.length ? row('ילדים', kids.map((k) => `<a href="#" data-open="${h(k.contact_id)}">${h(nameOf(k))}</a>`).join(', ')) : ''}
      ${row('כתובת', `<span dir="ltr">${addr}</span>`)}
      ${row('נייד', `<a dir="ltr" href="tel:${h(S(p.mobile).replace(/\D/g, ''))}">${h(p.mobile)}</a>`)}
      ${row('טלפון בית', `<span dir="ltr">${h(p.home_phone)}</span>`)}
      ${row('מייל', `<a dir="ltr" href="mailto:${h(p.email_1)}">${h(p.email_1)}</a>`)}
      ${personSchool(p) || (e ? row('רישום', h([e.status, e.shiur, e.room ? `חדר ${e.room}` : '', e.start ? `מ-${e.start}` : '', e.end ? `עד ${e.end}` : ''].filter(Boolean).join(' · '))) : '')}
      ${p.il_phone ? row('טלפון בארץ', `<span dir="ltr">${h(p.il_phone)}</span>`) : ''}
      <p class="muted small">מס' איש קשר: ${h(p.contact_id)}</p>
    </section>
    <div class="actions">
      ${can('people_edit') ? '<button type="button" class="btn danger" id="ms-rm">🗑 הוצא מהמוסד</button>' : ''}
      <button type="button" class="btn" id="ms-hx">📜 היסטוריה</button>
      ${can('people_edit') ? '<button type="button" class="btn" id="ms-kinds">🏷 סוגים</button>' : ''}
      <span class="spacer"></span>
      ${can('people_edit') ? '<button type="button" class="btn primary" id="ms-edit">✏️ עריכה</button>' : ''}
      <button type="button" class="btn" data-x>סגירה</button>
    </div>`);
  $$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  $$('[data-open]', d).forEach((a) => { a.onclick = (ev) => { ev.preventDefault(); d.close(); personDialog(pById(a.dataset.open)); }; });
  $('#ms-edit', d)?.addEventListener('click', () => { d.close(); editDialog(p); });
  $('#ms-hx', d).onclick = () => historyDialog({ contact_id: p.contact_id }, nameOf(p));
  $('#ms-kinds', d)?.addEventListener('click', () => {
    const k2 = dialog(`<h2>🏷 ${h(nameOf(p))}</h2><p class="muted small">אפשר כמה ביחד — למשל הורה וגם אברך.</p>
      <div class="ms-perms">${KINDS.map(([k, l]) => `<label class="check"><input type="checkbox" value="${k}"${hasKind(p, k) ? ' checked' : ''}> ${h(l)}</label>`).join('')}</div>
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" id="ms-k-save">💾 שמירה</button></div>`);
    $('#ms-k-save', k2).onclick = async () => {
      const kinds = $$('input:checked', k2).map((x) => x.value);
      if (!kinds.length) { toast('צריך לפחות סוג אחד.', 'err'); return; }
      try { await call(KEY, 'link', { contact_id: p.contact_id, kinds }); k2.close(); d.close(); await loadPeople(); render(); toast('נשמר.'); personDialog(pById(p.contact_id)); } catch (err) { toast(msg(err), 'err'); }
    };
  });
  $('#ms-rm', d)?.addEventListener('click', () => { d.close(); unlinkDialog(p, null); });
}

/** צולייגן: ערשט זוכן אינעם מאגר (נישט מאכן טאפלט), דערנאך — א נייער */
function addDialog(kind0 = '') {
  const d = dialog(`<h2>➕ הוספה</h2>
    <p class="muted small">מתחילים לכתוב — מופיעים מי שכבר במאגר הכללי (גם בכתיב אחר, למשל גינזבורג / גינסבערג). כך לא נוצרות כפילויות.</p>
    <div class="ms-find"><input id="ms-fq" placeholder="שם (למשל: משה כהן)"><input id="ms-fph" dir="ltr" placeholder="טלפון (לא חובה)">
      <select id="ms-fkind">${KINDS.map(([k, l]) => `<option value="${k}"${k === kind0 ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>
      <button type="button" class="btn primary" id="ms-fgo">🔍 חיפוש</button></div>
    <div id="ms-fout"></div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" id="ms-fnew">➕ איש חדש (לא נמצא)</button><button type="button" class="btn" data-x>ביטול</button></div>`);
  const kind = () => $('#ms-fkind', d).value;
  let seq = 0; let tm = null;
  const go = async () => {
    const q = $('#ms-fq', d).value.trim();
    const out = $('#ms-fout', d);
    if (q.length < 2 && $('#ms-fph', d).value.replace(/\D/g, '').length < 7) { out.innerHTML = '<p class="muted small">כתוב לפחות 2 אותיות — התוצאות יופיעו תוך כדי כתיבה.</p>'; return; }
    const my = ++seq;
    out.innerHTML = '<p class="muted small">מחפש…</p>';
    try {
      const r = await call(KEY, 'find', { q, phone: $('#ms-fph', d).value });
      if (my !== seq) return;
      const inMosad = (id) => pById(id);
      out.innerHTML = r.found.length ? `<div class="ms-found">${r.found.map((x) => { const p = inMosad(x.contact_id); return `<div class="ms-fr"><span><b>${h(x.name)}</b> <span class="muted small" dir="ltr">${h(x.en)}</span> ${x.city ? `· ${h(x.city)}` : ''} <span class="muted small">#${h(x.contact_id)}</span>${p ? ` ${kindBadges(p)} <span class="muted small">במוסד</span>` : ''}</span>
          ${!p ? `<button type="button" class="btn small-btn primary" data-link="${h(x.contact_id)}">זה הוא — הוסף כ${h(kindName(kind()))}</button>`
            : !hasKind(p, kind()) ? `<button type="button" class="btn small-btn primary" data-link="${h(x.contact_id)}">הוסף גם כ${h(kindName(kind()))}</button>`
            : `<button type="button" class="btn small-btn" data-open="${h(x.contact_id)}">✓ כבר ${h(kindName(kind()))} — פתח</button>`}</div>`; }).join('')}</div>`
        : '<p class="muted">לא נמצא במאגר. אפשר להוסיף איש חדש.</p>';
      $$('[data-link]', out).forEach((b) => {
        b.onclick = async () => {
          b.disabled = true;
          try { await call(KEY, 'link', { contact_id: b.dataset.link, kind: kind() }); d.close(); await loadPeople(); render(); toast('נשמר.'); personDialog(pById(b.dataset.link)); } catch (err) { b.disabled = false; toast(msg(err), 'err'); }
        };
      });
      $$('[data-open]', out).forEach((b) => { b.onclick = () => { d.close(); personDialog(pById(b.dataset.open)); }; });
    } catch (err) { out.innerHTML = `<p class="ms-note err">${h(msg(err))}</p>`; }
  };
  const soon = () => { clearTimeout(tm); tm = setTimeout(go, 450); };
  $('#ms-fgo', d).onclick = go;
  $('#ms-fq', d).oninput = soon;
  $('#ms-fph', d).oninput = soon;
  $('#ms-fkind', d).onchange = () => { if ($('#ms-fout', d).innerHTML) go(); };
  $('#ms-fq', d).onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(tm); go(); } };
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
  const parents = st.people.filter((x) => hasKind(x, 'parent') || childrenOf(x).length);
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
      d.close(); await loadPeople(); render(); toast(p ? 'נשמר.' : 'נוסף.');
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
    <p class="muted small">איש הצוות נכנס לאתר הזה עם חשבון הגוגל שלו. אין לו גישה לגיליונות עצמם.</p>
    ${settingsHtml()}
    ${backupsHtml()}`;
  wireSettings(box);
  wireBackups(box);
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
const ctx = { st, call, KEY, $, $$, h, S, dialog, toast, msg, pById, nameOf, phoneOf, fatherOf, can, loadPeople, render: () => render(), personDialog: (p) => personDialog(p), unlinkDialog, addDialog: (k) => addDialog(k) };
initSchool(ctx);
initGifts(ctx);
Object.assign(ctx, {
  printPhones: () => printPhones(), printWin: (...a) => printWin(...a), payDialog: (id) => payDialog(id),
  permName: (k) => PERM_NAMES[k] || k, roleName: (r) => ROLE_NAMES[r] || r,
  go: (tab, sub) => { st.tab = tab; if (tab === 'attendance' && sub) setAttTab(sub); render(); },
});
initJournal(ctx);
initMe(ctx);
initTeam(ctx);
initFinance(ctx);
(async () => {
  loginView();
  brand(KEY).then((b) => { if (b?.logo) { st.logo = b.logo; if (!st.me) { const im = $('.ms-logo'); if (im) im.src = b.logo; } } });
  if (configured() && hasSession()) splashShow(); // גלייך — נישט ווייזן דעם לאגאין פאר א רגע
  try { await initAuth(); } catch { /* */ }
  if (!configured()) { splashDone(false); loginView(ERR['not-configured'], 'err'); return; }
  if (hasSession()) enter(null); else splashDone(false);
})();
