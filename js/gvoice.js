// 📞 קו גבאים זמני — ההקלטות מהקו הקולי של הגבאים (929): "הוספת איש קשר" (2) ו"הערות" (4).
// הנתונים בלשונית GabbaiCalls (נכתבת ב-Apps Script, gvLog_). כאן: שומעים, קוראים את התמלול,
// מסמנים "טופל", ובהוספה — "צור איש קשר" שפותח טופס חדש עם מה שה-AI הבין.
import { otherSheet } from './google.js';
import { CONFIG } from './config.js';
import { state } from './data.js';
import { escapeHtml as h, nowStamp } from './util.js';

const HEAD = ['call_id', 'at', 'gabbai', 'phone', 'kind', 'transcript', 'fields', 'drive_id', 'status', 'done_by', 'done_at', 'seconds'];
const sheet = () => otherSheet(CONFIG.SPREADSHEET_ID);

let ui = null;
let rows = null;
let filter = 'open';
let kindF = 'all';
const busy = new Set();

export function initGvoice(helpers) { ui = helpers; }
export function openGvoice() { filter = 'open'; kindF = 'all'; rows = null; ui.showView('gvoice'); }

async function load() {
  let vals = [];
  try { vals = await sheet().read('GabbaiCalls!A2:L'); } catch (e) {
    if (/Unable to parse range|not found/i.test(String(e && e.message))) return []; // הלשונית עוד לא נוצרה — אין עדיין הקלטות
    throw e;
  }
  return vals.map((v, i) => { const o = { row: i + 2 }; HEAD.forEach((k, j) => { o[k] = v[j] ?? ''; }); return o; })
    .filter((r) => r.call_id && (r.kind === 'add' || r.kind === 'note'))
    .reverse();
}

export async function renderGvoice() {
  const main = document.getElementById('gvoice-main');
  if (!main) return;
  if (!rows) {
    main.innerHTML = '<h1>📞 קו גבאים זמני</h1><p class="muted">טוען…</p>';
    try { rows = await load(); } catch (e) { main.innerHTML = `<h1>📞 קו גבאים זמני</h1><p class="err">${h(ui.friendlyError ? ui.friendlyError(e) : e.message)}</p>`; return; }
  }
  draw(main);
}

const isDone = (r) => String(r.status) === 'done';
const KINDS = { add: '➕ הוספת איש קשר', note: '📝 הערה' };

function draw(main) {
  const list = rows.filter((r) => (filter === 'all' || (filter === 'open' ? !isDone(r) : isDone(r))) && (kindF === 'all' || r.kind === kindF));
  const cnt = (f) => rows.filter((r) => (f === 'all' || (f === 'open' ? !isDone(r) : isDone(r)))).length;
  const chip = (k, label, cur, attr) => `<button type="button" class="chip${cur === k ? ' on' : ''}" ${attr}="${k}">${label}</button>`;
  main.innerHTML = `
    <h1>📞 קו גבאים זמני</h1>
    <p class="muted" dir="rtl">ההקלטות שהגבאים השאירו בטלפון 929-219-1653: הוספת איש קשר (מקש 2) והערות (מקש 4).</p>
    <div class="gv-filters">
      ${chip('open', `פתוח (${cnt('open')})`, filter, 'data-gvf')}
      ${chip('done', `טופל (${cnt('done')})`, filter, 'data-gvf')}
      ${chip('all', `הכל (${cnt('all')})`, filter, 'data-gvf')}
      <span class="gv-sep"></span>
      ${chip('all', 'כל הסוגים', kindF, 'data-gvk')}
      ${chip('add', KINDS.add, kindF, 'data-gvk')}
      ${chip('note', KINDS.note, kindF, 'data-gvk')}
      <button type="button" class="btn" data-gvreload>↻ רענון</button>
    </div>
    <div class="gv-list">${list.length ? list.map(item).join('') : '<p class="muted">אין כאן כלום כרגע.</p>'}</div>`;
  main.onclick = onClick;
}

function fieldsOf(r) { try { return JSON.parse(r.fields || '{}') || {}; } catch (e) { return {}; } }

function item(r) {
  const f = fieldsOf(r);
  const fl = [['first_name_he', 'שם פרטי'], ['last_name_he', 'שם משפחה'], ['first_name_en', 'First'], ['last_name_en', 'Last'], ['address', 'כתובת'], ['city', 'עיר'], ['zip', 'מיקוד'], ['mobile', 'נייד'], ['home_phone', 'בית']]
    .filter(([k]) => String(f[k] || '').trim()).map(([k, l]) => `<span class="gv-f"><b>${h(l)}:</b> ${h(f[k])}</span>`).join('');
  const audio = r.drive_id ? `<audio controls preload="none" src="https://drive.google.com/uc?export=download&id=${encodeURIComponent(r.drive_id)}"></audio>
      <a href="https://drive.google.com/file/d/${encodeURIComponent(r.drive_id)}/view" target="_blank" rel="noopener">פתיחה בדרייב</a>` : '<span class="muted">אין קובץ הקלטה</span>';
  const done = isDone(r);
  return `<article class="gv-item${done ? ' done' : ''}" data-row="${r.row}">
    <div class="gv-head"><b>${KINDS[r.kind] || h(r.kind)}</b> · ${h(r.gabbai)} · ${h(r.at)}${r.seconds ? ` · ${h(r.seconds)} שניות` : ''}</div>
    <p class="gv-text" dir="auto">${h(r.transcript) || '<span class="muted">(אין תמלול)</span>'}</p>
    ${fl ? `<div class="gv-fields">${fl}</div>` : ''}
    <div class="gv-audio">${audio}</div>
    <div class="gv-actions">
      ${r.kind === 'add' && !done ? `<button type="button" class="btn primary" data-gvadd="${r.row}">➕ צור איש קשר</button>` : ''}
      ${done ? `<span class="muted">✔ טופל ע"י ${h(r.done_by)} · ${h(r.done_at)}</span> <button type="button" class="btn" data-gvundo="${r.row}">↺ להחזיר לפתוח</button>`
        : `<button type="button" class="btn" data-gvdone="${r.row}">✓ טופל</button>`}
    </div>
  </article>`;
}

async function setStatus(r, done) {
  if (busy.has(r.row)) return;
  busy.add(r.row);
  const by = done ? (state.email || '') : ''; const at = done ? nowStamp() : '';
  const old = [r.status, r.done_by, r.done_at];
  r.status = done ? 'done' : 'open'; r.done_by = by; r.done_at = at;
  draw(document.getElementById('gvoice-main'));
  try { await sheet().write(`GabbaiCalls!I${r.row}:K${r.row}`, [[r.status, by, at]]); } catch (e) {
    [r.status, r.done_by, r.done_at] = old;
    draw(document.getElementById('gvoice-main'));
    ui.toast(ui.friendlyError ? ui.friendlyError(e) : e.message);
  } finally { busy.delete(r.row); }
}

function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.gvf) { filter = b.dataset.gvf; draw(this); return; }
  if (b.dataset.gvk) { kindF = b.dataset.gvk; draw(this); return; }
  if ('gvreload' in b.dataset) { rows = null; renderGvoice(); return; }
  const r = rows.find((x) => String(x.row) === (b.dataset.gvdone || b.dataset.gvundo || b.dataset.gvadd));
  if (!r) return;
  if (b.dataset.gvdone) { setStatus(r, true); return; }
  if (b.dataset.gvundo) { setStatus(r, false); return; }
  if (b.dataset.gvadd) {
    const f = fieldsOf(r);
    const pre = {};
    ['first_name_he', 'last_name_he', 'first_name_en', 'last_name_en', 'address', 'city', 'state', 'zip'].forEach((k) => { if (String(f[k] || '').trim()) pre[k] = String(f[k]).trim(); });
    pre._phones = {};
    if (f.mobile) pre._phones.mobile = String(f.mobile);
    if (f.home_phone) pre._phones.home_phone = String(f.home_phone);
    ui.openForm(pre, { onSaved: () => setStatus(r, true) });
  }
}
