// 🔎 JBD Check — סקירת התוצאות של בדיקת הכתובות מול thejbd.com (לשונית JBD_Check).
// הבדיקה עצמה רצה ברקע ב-Apps Script (jbdTick). כאן: כל איש ככרטיס — "אצלנו" מול "ב-JBD",
// עם כפתורים: ✓ לעדכן כתובת / ✓ להוסיף טלפון / ✗ להשאיר / ⏭ אחר כך.
// שום דבר לא משתנה בלי לחיצה. כל עדכון נרשם ב-History (saveCellEdits), וההחלטה נכתבת בעמודה decision.
import { otherSheet } from './google.js';
import { CONFIG } from './config.js';
import { state, saveCellEdits } from './data.js';
import { escapeHtml as h, nowStamp, formatPhone, detectArea } from './util.js';

const HEAD = ['contact_id', 'priority', 'name', 'sys_address', 'sys_phones', 'status', 'jbd_name', 'jbd_address', 'jbd_phone', 'note', 'checked_at', 'decision'];
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
  ['done', '✔ טופל', (r) => Boolean(String(r.decision || '').trim())],
  ['all', 'הכל', () => true],
];

async function load(force = false) {
  if (rows && !force) return rows;
  if (loading && !force) return loading;
  loading = sheet().read(`JBD_Check!A2:${DEC_COL}`).then((vals) => {
    rows = vals.map((v, i) => { const o = { row: i + 2 }; HEAD.forEach((k, j) => { o[k] = v[j] ?? ''; }); o.contact_id = String(o.contact_id); return o; })
      .filter((r) => r.contact_id);
    return rows;
  }).finally(() => { loading = null; });
  return loading;
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
      <p class="muted small">השוואה בין מה שרשום אצלנו לבין ספר הטלפונים JBD. שום דבר לא משתנה בלי לחיצה, וכל עדכון נרשם בהיסטוריה של איש הקשר.
        נבדקו עד עכשיו <b>${total}</b>.</p>
      <div class="jbd-filters">${GROUPS.map(([k, label, fn]) => `<button type="button" class="chip${k === filter ? ' on' : ''}" data-jf="${k}">${h(label)} <span class="count-pill">${rows.filter(fn).length}</span></button>`).join('')}
        <button type="button" class="btn ghost small" data-jreload>↻ רענון</button></div>
    </div>
    <div class="jbd-list">${list.length ? list.slice(0, shown).map(card).join('') : `<p class="muted">${filter === 'todo' ? 'אין כרגע מה לטפל. ✔' : 'אין שורות.'}</p>`}</div>
    ${list.length > shown ? `<p class="jbd-more"><button type="button" class="btn" data-jmore>להציג עוד (${list.length - shown})</button></p>` : ''}`;
  main.onclick = onClick;
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
  const dec = String(r.decision || '').trim();
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
        ${c ? '' : '<p class="muted small">איש הקשר לא נמצא (אולי נמחק).</p>'}</div>
      <div class="jbd-theirs"><h4>ב-JBD</h4>${optHtml || '<p class="muted small">לא נמצא ב-JBD.</p>'}</div>
    </div>
    <footer>${dec ? `<span class="muted small">✔ ${h(dec)}</span> <button type="button" class="btn ghost small" data-jundo="${r.row}">↺ לבטל סימון</button>`
    : `<button type="button" class="btn small" data-jkeep="${r.row}">✗ להשאיר כמו שזה</button>
       ${filter === 'todo' ? `<button type="button" class="btn ghost small" data-jlater="${r.row}">⏭ אחר כך</button>` : ''}`}</footer>
  </article>`;
}

// ---------- פעולות ----------
async function setDecision(r, text) {
  const v = text ? `${text} · ${state.email} · ${nowStamp()}` : '';
  await sheet().write(`JBD_Check!${DEC_COL}${r.row}`, [[v]]);
  r.decision = v;
}

async function updateAddress(r, o) {
  const c = contactOf(r.contact_id);
  if (!c) throw new Error('איש הקשר לא נמצא');
  const p = parseJbdAddress(o.addr);
  if (!p || !p.address) throw new Error('לא הצלחתי לקרוא את הכתובת');
  const set = { address: p.address, city: p.city || c.city || '', state: p.state || c.state || '', zip: p.zip || c.zip || '' };
  const area = detectArea(state.areas || [], { zip: set.zip, city: set.city, country: c.country || '' });
  if (area) set.area = area;
  const before = sysAddr(c, r);
  if (!confirm(`לעדכן את הכתובת של ${ui.fullNameHe(c)}?\n\nהיום:  ${before || '—'}\nחדש:   ${[set.address, set.city, set.state, set.zip].filter(Boolean).join(', ')}`)) return false;
  await saveCellEdits([{ id: c.contact_id, contact: set }]);
  return 'כתובת';
}

async function addPhone(r, o) {
  const c = contactOf(r.contact_id);
  if (!c) throw new Error('איש הקשר לא נמצא');
  const ph = phonesOf(c.contact_id);
  const slot = ['home_phone', 'other_phone', 'mobile'].find((k) => !String(ph[k] || '').trim());
  if (!slot) { alert('אין משבצת ריקה לטלפון. אפשר להוסיף אותו ידנית בכרטיס.'); return false; }
  const tel = formatPhone(o.tel) || o.tel;
  const label = { home_phone: 'טלפון בבית', other_phone: 'טלפון נוסף', mobile: 'נייד' }[slot];
  if (!confirm(`להוסיף ל${ui.fullNameHe(c)} את הטלפון ${tel}?\n(יישמר כ"${label}")`)) return false;
  await saveCellEdits([{ id: c.contact_id, phones: { [slot]: tel } }]);
  return 'טלפון';
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const main = document.getElementById('jbd-main');
  if (b.dataset.jf) { filter = b.dataset.jf; shown = PAGE; draw(main); return; }
  if (b.hasAttribute('data-jmore')) { shown += PAGE; draw(main); return; }
  if (b.hasAttribute('data-jreload')) { rows = null; renderJbd(); return; }
  if (b.dataset.jopen) { ui.openCard(b.dataset.jopen); return; }
  const rowN = Number(b.dataset.jaddr || b.dataset.jtel || b.dataset.jkeep || b.dataset.jlater || b.dataset.jundo);
  const r = rows?.find((x) => x.row === rowN);
  if (!r) return;
  if (b.dataset.jlater) { later.add(r.row); draw(main); return; }
  if (busy.has(r.row)) return;
  busy.add(r.row); b.disabled = true;
  try {
    if (b.dataset.jkeep) { await setDecision(r, 'להשאיר'); ui.toast('סומן: להשאיר.'); }
    else if (b.dataset.jundo) { await setDecision(r, ''); ui.toast('הסימון בוטל.'); }
    else {
      const o = options(r)[Number(b.dataset.jo) || 0];
      const did = b.dataset.jaddr ? await updateAddress(r, o) : await addPhone(r, o);
      if (did) {
        // אם נשאר עוד מה לעשות באותו כרטיס (למשל גם טלפון) — לא סוגרים אותו
        const still = options(r).some((x) => (x.addr && addrKey(x.addr) !== addrKey(sysAddr(contactOf(r.contact_id), r))) || (x.tel && !phoneKnown(r.contact_id, x.tel)));
        r.did = [...(r.did || []), did];
        if (!still || /^\? כמה/.test(r.status)) await setDecision(r, `עודכן: ${r.did.join(', ')}`);
        ui.toast(`עודכן: ${did}.`);
      }
    }
  } catch (err) {
    ui.toast(ui.friendlyError ? ui.friendlyError(err) : err.message);
  } finally { busy.delete(r.row); }
  draw(main);
}
