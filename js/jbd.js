// 🔎 JBD Check — סקירת התוצאות של בדיקת הכתובות מול thejbd.com (לשונית JBD_Check).
// הבדיקה עצמה רצה ברקע ב-Apps Script (jbdTick). כאן: כל איש ככרטיס — "אצלנו" מול "ב-JBD",
// עם כפתורים: ✓ לעדכן כתובת / ✓ להוסיף טלפון / ✗ להשאיר / ⏭ אחר כך.
// שום דבר לא משתנה בלי לחיצה. כל עדכון נרשם ב-History (saveCellEdits), וההחלטה נכתבת בעמודה decision.
import { otherSheet, currentToken } from './google.js';
import { CONFIG } from './config.js';
import { state, saveCellEdits, saveRecord, reloadMessages, displayName } from './data.js';
import { escapeHtml as h, nowStamp, formatPhone, detectArea } from './util.js';

const HEAD = ['contact_id', 'priority', 'name', 'sys_address', 'sys_phones', 'status', 'jbd_name', 'jbd_address', 'jbd_phone', 'note', 'checked_at', 'decision', 'source'];
const DEC_COL = 'L';
const PHONE_KEYS = ['mobile', 'home_phone', 'wife_mobile', 'other_phone'];
const PAGE = 25;
const sheet = () => otherSheet(CONFIG.SPREADSHEET_ID);

let ui = null;
let rows = null; // [{ row, ...HEAD }]
let loading = null;
let filter = 'todo';
let shown = PAGE;
const later = new Set(); // ⏭ — רק לסשן הזה
const busy = new Set();
let addrAt = new Map(); // contact_id → מתי הכתובת עודכנה אצלנו לאחרונה (מתוך History)
const ADDR_HIST = new Set(['address', 'city', 'state', 'zip']);

export function initJbd(helpers) { ui = helpers; }

/** האם השורה צריכה טיפול של אדם */
function needsWork(r) {
  if (String(r.decision || '').trim()) return false;
  const s = String(r.status || '');
  if (s.startsWith('✓')) return Boolean(r.jbd_phone) && !phoneKnown(r.contact_id, r.jbd_phone);
  return s.startsWith('⚠') || s.startsWith('?') || s.startsWith('+');
}
const GROUPS = [
  ['todo', 'לטיפול', needsWork],
  ['diff', '⚠ כתובת שונה', (r) => /^[⚠+]/.test(r.status)],
  ['maybe', '? אולי', (r) => /^\? אולי/.test(r.status)],
  ['multi', '? כמה אפשרויות', (r) => /^\? כמה/.test(r.status)],
  ['ok', '✓ תואם', (r) => /^✓/.test(r.status)],
  ['none', '✗ לא נמצא', (r) => /^[✗—]/.test(r.status)],
  ['vibe', 'לייקווד (The Vibe)', (r) => r.source === 'Vibe'],
  ['task', '☑ יש משימה', (r) => openTasks(r.contact_id).length > 0],
  ['done', '✔ טופל', (r) => Boolean(String(r.decision || '').trim())],
  ['all', 'הכל', () => true],
];

async function load(force = false) {
  if (rows && !force) return rows;
  if (loading && !force) return loading;
  loadAddrDates();
  loading = sheet().read('JBD_Check!A2:M').then((vals) => {
    rows = vals.map((v, i) => { const o = { row: i + 2 }; HEAD.forEach((k, j) => { o[k] = v[j] ?? ''; }); o.contact_id = String(o.contact_id); return o; })
      .filter((r) => r.contact_id);
    return rows;
  }).finally(() => { loading = null; });
  return loading;
}

/** מתוך History: התאריך האחרון שבו השתנתה הכתובת של כל איש קשר. נטען פעם אחת, ברקע. */
async function loadAddrDates(force = false) {
  if (addrAt.size && !force) return;
  try {
    const [hd = [], ...body] = await sheet().read('History!A1:H');
    const ix = (k) => hd.indexOf(k);
    const [iAt, iEnt, iCid, iF] = [ix('at'), ix('entity'), ix('contact_id'), ix('field')];
    const m = new Map();
    body.forEach((r) => {
      if (String(r[iEnt] || '') !== 'contact' || !ADDR_HIST.has(String(r[iF] || ''))) return;
      const id = String(r[iCid] || ''); const at = String(r[iAt] || '');
      if (id && at > (m.get(id) || '')) m.set(id, at);
    });
    addrAt = m;
    const main = document.getElementById('jbd-main');
    if (main && rows && main.querySelector('.jbd-list')) draw(main);
  } catch (e) { console.warn('JBD: history read failed', e); }
}

/** משימות כלליות (To Do כללי) פתוחות על האיש הזה */
function openTasks(id) {
  return (state.tasks || []).filter((x) => String(x.assigned_to || '') === 'all' && (x.status || 'open') !== 'done' && String(x.contact_id || '') === String(id));
}
function addrDateHtml(c) {
  const at = addrAt.get(String(c?.contact_id || ''));
  if (at) {
    const days = (Date.now() - new Date(at.slice(0, 10)).getTime()) / 864e5;
    return `<div class="jbd-row jbd-when"><span class="jbd-k">📅</span><span>הכתובת עודכנה אצלנו: <bdi dir="ltr">${h(at.slice(0, 10))}</bdi>${days <= 365 ? ' <span class="jbd-new">🆕 עדכון מהשנה האחרונה — אולי חדש יותר מ-JBD</span>' : ''}</span></div>`;
  }
  if (!addrAt.size) return '';
  return '<div class="jbd-row jbd-when muted small"><span class="jbd-k">📅</span><span>הכתובת לא שונתה אצלנו מאז שהמערכת התחילה לרשום שינויים</span></div>';
}
function tasksHtml(id) {
  const ts = openTasks(id);
  if (!ts.length) return '';
  return `<div class="jbd-tasks">${ts.map((x) => `<div class="jbd-task" data-jtask="${h(x.task_id)}">
      <span>☑ <b>${h(x.text)}</b> <span class="muted small">· ${h(displayName(x.from_email || x.created_by))} · <bdi dir="ltr">${h(String(x.created_at || '').slice(0, 10))}</bdi></span></span>
      <button type="button" class="btn small" data-jtdone="${h(x.task_id)}">✓ המשימה בוצעה</button></div>`).join('')}</div>`;
}

export function openJbd() { filter = 'todo'; shown = PAGE; ui.showView('jbd'); }

export async function renderJbd() {
  const main = document.getElementById('jbd-main');
  if (!main) return;
  if (!rows) {
    main.innerHTML = '<h1>🔎 JBD Check</h1><p class="muted">טוען…</p>';
    try { await load(); } catch (e) { main.innerHTML = `<h1>🔎 JBD Check</h1><p class="err">${h(ui.friendlyError ? ui.friendlyError(e) : e.message)}</p>`; return; }
  }
  draw(main);
}

function draw(main) {
  const total = rows.length;
  const g = GROUPS.find((x) => x[0] === filter) || GROUPS[0];
  const list = rows.filter((r) => g[2](r) && (filter !== 'todo' || !later.has(r.row)));
  main.innerHTML = `
    <div class="jbd-head">
      <h1>🔎 JBD Check</h1>
      <p class="muted small">השוואה בין מה שרשום אצלנו לבין ספרי הטלפונים (JBD, ולאזור לייקווד The Vibe). שום דבר לא משתנה בלי לחיצה, וכל עדכון נרשם בהיסטוריה של איש הקשר.
        נבדקו עד עכשיו <b>${total}</b>.</p>
      <div class="jbd-filters">${GROUPS.map(([k, label, fn]) => `<button type="button" class="chip${k === filter ? ' on' : ''}" data-jf="${k}">${h(label)} <span class="count-pill">${rows.filter(fn).length}</span></button>`).join('')}
        <button type="button" class="btn ghost small" data-jreload>↻ רענון</button></div>
    </div>
    <div class="jbd-list">${list.length ? list.slice(0, shown).map(card).join('') : `<p class="muted">${filter === 'todo' ? 'אין כרגע מה לטפל. ✔' : 'אין שורות.'}</p>`}</div>
    ${list.length > shown ? `<p class="jbd-more"><button type="button" class="btn" data-jmore>להציג עוד (${list.length - shown})</button></p>` : ''}`;
  main.onclick = (e) => { repaint = null; onClick(e); };
}

// ---------- כרטיס ----------
const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
function phonesOf(id) { return state.phones.get(String(id)) || {}; }
function phoneKnown(id, tel) { const d = digits(tel); return !d || PHONE_KEYS.some((k) => digits(phonesOf(id)[k]) === d); }
function contactOf(id) { return state.contacts.find((c) => String(c.contact_id) === String(id)) || null; }
function sysAddr(c, r) { return c ? [c.address, c.city, c.state, c.zip].filter((x) => String(x || '').trim()).join(', ') : r.sys_address; }
const addrKey = (s) => String(s || '').toLowerCase().split(',')[0].replace(/#.*$/, '').replace(/\b(apt|unit|fl|ste)\b.*$/, '')
  .replace(/\bavenue\b|\bav\b/g, 'ave').replace(/\bstreet\b/g, 'st').replace(/(\d+)(st|nd|rd|th)\b/g, '$1').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** "1607 53 St, Brooklyn, NY 11204" → { address: '1607 53rd St', city, state, zip } בסגנון שלנו */
export function parseJbdAddress(s) {
  const parts = String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  let st = ''; let zip = '';
  const last = parts[parts.length - 1];
  const m = last.match(/^([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/);
  if (m) { st = m[1]; zip = m[2]; parts.pop(); } else if (/^\d{5}$/.test(last)) { zip = last; parts.pop(); }
  const city = parts.length > 1 ? parts.pop() : '';
  return { address: prettyStreet(parts.join(', ')), city, state: st, zip };
}
function ord(n) { const v = Number(n) % 100; if (v >= 11 && v <= 13) return `${n}th`; return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[Number(n) % 10] || 'th'}`; }
function prettyStreet(s) {
  return String(s || '').replace(/\bAv\b\.?/g, 'Ave')
    .replace(/^(\S+\s+(?:[NSEW]\s+)?)(\d+)\s+(St|Ave|Rd|Pl|Dr|Ct|Ln|Ter|Terr)\b/i, (all, pre, n, suf) => `${pre}${ord(n)} ${suf}`);
}

const srcName = (r) => (r.source === 'Vibe' ? 'The Vibe' : 'JBD');

function options(r) {
  const out = [];
  if (r.jbd_address || r.jbd_phone) out.push({ name: r.jbd_name, addr: r.jbd_address, tel: r.jbd_phone });
  if (/^\? כמה/.test(r.status)) {
    String(r.note || '').split(' | ').forEach((x) => { const [name, addr, tel] = x.split(' · '); if (addr || tel) out.push({ name, addr, tel }); });
  }
  return out;
}

function card(r) {
  const c = contactOf(r.contact_id);
  const ph = phonesOf(r.contact_id);
  const myAddr = sysAddr(c, r);
  const myPh = PHONE_KEYS.map((k) => ph[k]).filter((x) => String(x || '').trim());
  const opts = options(r);
  const dec = decText(r);
  const name = c ? ui.fullNameHe(c) : r.name;
  const en = c ? [c.first_name_en, c.last_name_en].filter(Boolean).join(' ') : '';
  const optHtml = opts.map((o, i) => {
    const sameAddr = o.addr && addrKey(o.addr) === addrKey(myAddr);
    const telNew = o.tel && !phoneKnown(r.contact_id, o.tel);
    return `<div class="jbd-opt">
      <div class="jbd-opt-who">${opts.length > 1 ? `<b>${i + 1}.</b> ` : ''}<span dir="ltr">${h(o.name || '')}</span></div>
      <div class="jbd-row"><span class="jbd-k">📍</span><span dir="ltr" class="${o.addr ? (sameAddr ? 'jbd-same' : 'jbd-diff') : 'muted'}">${h(o.addr || '—')}</span></div>
      <div class="jbd-row"><span class="jbd-k">📞</span><span dir="ltr" class="${o.tel ? (telNew ? 'jbd-diff' : 'jbd-same') : 'muted'}">${h(o.tel || '—')}</span></div>
      ${dec ? '' : `<div class="jbd-acts">
        ${o.addr && !sameAddr ? `<button type="button" class="btn primary small" data-jaddr="${r.row}" data-jo="${i}">✓ לעדכן כתובת</button>` : ''}
        ${telNew ? `<button type="button" class="btn primary small" data-jtel="${r.row}" data-jo="${i}">✓ להוסיף טלפון</button>` : ''}
      </div>`}
    </div>`;
  }).join('');
  return `<article class="jbd-card${dec ? ' jbd-done' : ''}" data-jrow="${r.row}">
    <header><button type="button" class="link" data-jopen="${h(r.contact_id)}"><b>${h(name)}</b></button>
      ${en ? `<span class="muted small" dir="ltr">${h(en)}</span>` : ''}
      <span class="jbd-st">${h(r.status)}</span>${r.note && !/^\? כמה/.test(r.status) ? `<span class="muted small">· ${h(r.note)}</span>` : ''}</header>
    <div class="jbd-cols">
      <div class="jbd-ours"><h4>אצלנו</h4>
        <div class="jbd-row"><span class="jbd-k">📍</span><span dir="ltr">${h(myAddr || '—')}</span></div>
        <div class="jbd-row"><span class="jbd-k">📞</span><span dir="ltr">${h(myPh.join(' · ') || '—')}</span></div>
        ${c ? addrDateHtml(c) : '<p class="muted small">איש הקשר לא נמצא (אולי נמחק).</p>'}</div>
      <div class="jbd-theirs"><h4>ב-${srcName(r)}</h4>${optHtml || `<p class="muted small">לא נמצא ב-${srcName(r)}.</p>`}</div>
    </div>
    ${tasksHtml(r.contact_id)}
    <footer>${dec ? `<span class="muted small">✔ ${h(dec)}</span> <button type="button" class="btn ghost small" data-jundo="${r.row}">↺ לבטל</button>`
    : `<button type="button" class="btn small" data-jkeep="${r.row}">✗ להשאיר כמו שזה</button>
       ${filter === 'todo' && !repaint ? `<button type="button" class="btn ghost small" data-jlater="${r.row}">⏭ אחר כך</button>` : ''}`}</footer>
  </article>`;
}

// ---------- פעולות ----------
// 🔎 בכרטיס איש קשר (repaint) או במסך JBD Check
let repaint = null;
function redraw() { if (repaint) { repaint(); return; } const main = document.getElementById('jbd-main'); if (main) draw(main); }
// בלי חלונות אישור: כל לחיצה מבוצעת מיד, והכרטיס עובר ל"✔ טופל". הערך הקודם נשמר בעמודת ההחלטה
// (אחרי " ¦ "), כך ש"↺ לבטל" מחזיר אותו — גם אחרי רענון הדף.
const UNDO_SEP = ' ¦ ';
const decText = (r) => String(r.decision || '').split(UNDO_SEP)[0].trim();
function decUndo(r) { try { return JSON.parse(String(r.decision || '').split(UNDO_SEP)[1] || 'null'); } catch { return null; } }

async function setDecision(r, text, undo = null) {
  const v = text ? `${text} · ${state.email} · ${nowStamp()}${undo ? UNDO_SEP + JSON.stringify(undo) : ''}` : '';
  await sheet().write(`JBD_Check!${DEC_COL}${r.row}`, [[v]]);
  r.decision = v;
}

/** מחזיר את מה שהשתנה (כתובת / טלפון) לערך הקודם */
async function applyUndo(id, u) {
  if (!u) return;
  const e = { id };
  if (u.c && Object.keys(u.c).length) e.contact = u.c;
  if (u.p && Object.keys(u.p).length) e.phones = u.p;
  if (e.contact || e.phones) await saveCellEdits([e]);
}
const mergeUndo = (a, b) => ({ c: { ...(b?.c || {}), ...(a?.c || {}) }, p: { ...(b?.p || {}), ...(a?.p || {}) } });

async function updateAddress(r, o) {
  const c = contactOf(r.contact_id);
  if (!c) throw new Error('איש הקשר לא נמצא');
  const p = parseJbdAddress(o.addr);
  if (!p || !p.address) throw new Error('לא הצלחתי לקרוא את הכתובת');
  const set = { address: p.address, city: p.city || c.city || '', state: p.state || c.state || '', zip: p.zip || c.zip || '' };
  const area = detectArea(state.areas || [], { zip: set.zip, city: set.city, country: c.country || '' });
  if (area) set.area = area;
  const old = {}; Object.keys(set).forEach((k) => { old[k] = c[k] ?? ''; });
  await saveCellEdits([{ id: c.contact_id, contact: set }]);
  return { did: 'כתובת', undo: { c: old } };
}

async function addPhone(r, o) {
  const c = contactOf(r.contact_id);
  if (!c) throw new Error('איש הקשר לא נמצא');
  const ph = phonesOf(c.contact_id);
  const slot = ['home_phone', 'other_phone', 'mobile'].find((k) => !String(ph[k] || '').trim());
  if (!slot) { ui.toast('אין משבצת ריקה לטלפון. אפשר להוסיף אותו ידנית בכרטיס.'); return null; }
  const tel = formatPhone(o.tel) || o.tel;
  await saveCellEdits([{ id: c.contact_id, phones: { [slot]: tel } }]);
  return { did: 'טלפון', undo: { p: { [slot]: '' } } };
}

// פס "↺ לבטל" למטה, לכמה שניות אחרי כל פעולה
let undoTimer = null;
function undoBar(text, fn) {
  let bar = document.getElementById('jbd-undo');
  if (!bar) { bar = document.createElement('div'); bar.id = 'jbd-undo'; bar.className = 'jbd-undo'; document.body.append(bar); }
  bar.innerHTML = `<span>${h(text)}</span> <button type="button" class="btn small">↺ לבטל</button>`;
  bar.hidden = false;
  bar.querySelector('button').onclick = async () => {
    bar.hidden = true; clearTimeout(undoTimer);
    try { await fn(); ui.toast('בוטל.'); } catch (err) { ui.toast(ui.friendlyError ? ui.friendlyError(err) : err.message); }
    redraw();
  };
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { bar.hidden = true; }, 8000);
}

async function undoRow(r) {
  await applyUndo(r.contact_id, mergeUndo(decUndo(r), r.pend));
  r.pend = null; r.did = [];
  await setDecision(r, '');
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const main = document.getElementById('jbd-main');
  if (b.dataset.jf) { filter = b.dataset.jf; shown = PAGE; redraw(); return; }
  if (b.hasAttribute('data-jmore')) { shown += PAGE; redraw(); return; }
  if (b.hasAttribute('data-jreload')) { rows = null; addrAt = new Map(); renderJbd(); return; }
  if (b.dataset.jopen) { ui.openCard(b.dataset.jopen); return; }
  if (b.dataset.jtdone) {
    const x = (state.tasks || []).find((y) => String(y.task_id) === b.dataset.jtdone);
    if (!x) return;
    b.disabled = true;
    try {
      await saveRecord('Tasks', 'task_id', { ...x, status: 'done', done_at: nowStamp(), done_by: state.email });
      await reloadMessages();
      undoBar('המשימה סומנה כבוצעה.', async () => { await saveRecord('Tasks', 'task_id', { ...x, status: 'open', done_at: '', done_by: '' }); await reloadMessages(); });
    } catch (err) { ui.toast(ui.friendlyError ? ui.friendlyError(err) : err.message); }
    redraw();
    return;
  }
  const rowN = Number(b.dataset.jaddr || b.dataset.jtel || b.dataset.jkeep || b.dataset.jlater || b.dataset.jundo);
  const r = rows?.find((x) => x.row === rowN);
  if (!r) return;
  if (b.dataset.jlater) { later.add(r.row); redraw(); return; }
  if (busy.has(r.row)) return;
  busy.add(r.row); b.disabled = true;
  try {
    if (b.dataset.jkeep) {
      await setDecision(r, 'להשאיר', r.pend);
      undoBar('סומן: להשאיר כמו שזה.', () => undoRow(r));
    } else if (b.dataset.jundo) {
      await undoRow(r);
      ui.toast('בוטל — הוחזר כמו שהיה.');
    } else {
      const o = options(r)[Number(b.dataset.jo) || 0];
      const res = b.dataset.jaddr ? await updateAddress(r, o) : await addPhone(r, o);
      if (res) {
        r.pend = mergeUndo(res.undo, r.pend);
        r.did = [...(r.did || []), res.did];
        // אם נשאר עוד מה לעשות באותו כרטיס (למשל גם טלפון) — הוא נשאר פתוח
        const still = options(r).some((x) => (x.addr && addrKey(x.addr) !== addrKey(sysAddr(contactOf(r.contact_id), r))) || (x.tel && !phoneKnown(r.contact_id, x.tel)));
        if (!still || /^\? כמה/.test(r.status)) { await setDecision(r, `עודכן: ${r.did.join(', ')}`, r.pend); r.pend = null; }
        const one = res.undo; const name = r.name;
        undoBar(`עודכן: ${res.did} — ${name}`, async () => {
          await applyUndo(r.contact_id, one);
          r.did = (r.did || []).filter((x) => x !== res.did);
          if (decText(r)) { const u = decUndo(r); if (u) { u.c = u.c || {}; u.p = u.p || {}; Object.keys(one.c || {}).forEach((k) => delete u.c[k]); Object.keys(one.p || {}).forEach((k) => delete u.p[k]); } await setDecision(r, r.did.length ? `עודכן: ${r.did.join(', ')}` : '', r.did.length ? u : null); }
          else if (r.pend) { Object.keys(one.c || {}).forEach((k) => delete r.pend.c[k]); Object.keys(one.p || {}).forEach((k) => delete r.pend.p[k]); }
        });
      }
    }
  } catch (err) {
    ui.toast(ui.friendlyError ? ui.friendlyError(err) : err.message);
  } finally { busy.delete(r.row); }
  redraw();
}

// ---------- 🔎 בדיקה של איש קשר אחד — מתוך הכרטיס ----------
let oneBusy = false;
export async function jbdCheckInCard(id, box) {
  if (oneBusy) return;
  oneBusy = true;
  box.innerHTML = '<p class="muted">🔎 בודק ב-JBD (ובלייקווד גם ב-The Vibe)… זה לוקח עד חצי דקה.</p>';
  try {
    const res = await fetch(CONFIG.SMS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'jbd_one', id: String(id), token: currentToken() }) });
    const r = await res.json();
    if (r.error) throw new Error(r.error);
    await load(true);
    const paint = () => {
      if (!box.isConnected) { repaint = null; return; }
      const mine = (rows || []).filter((x) => x.contact_id === String(id));
      box.innerHTML = (r.jbdErr || r.vibeErr ? `<p class="err small">${r.jbdErr ? 'JBD' : 'The Vibe'} לא ענה כרגע — כדאי לנסות שוב בעוד כמה דקות.</p>` : '')
        + (mine.length ? mine.map(card).join('') : '<p class="muted">לא נמצא ב-JBD / Vibe.</p>');
    };
    repaint = paint; paint();
    box.onclick = (e) => { if (e.target.closest('[data-jopen]')) return; repaint = paint; onClick(e); };
  } catch (err) {
    box.innerHTML = `<p class="err">${h(ui.friendlyError ? ui.friendlyError(err) : err.message)}</p>`;
  } finally { oneBusy = false; }
}
