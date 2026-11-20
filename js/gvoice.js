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
let tab = 'add'; // add = איש קשר חדש · note = הערות · pick = אישורים (היסטוריה)
const busy = new Set();

export function initGvoice(helpers) { ui = helpers; }
export function openGvoice() { filter = 'open'; kindF = 'all'; tab = 'add'; rows = null; ui.showView('gvoice'); }

async function load() {
  let vals = [];
  try { vals = await sheet().read('GabbaiCalls!A2:L'); } catch (e) {
    if (/Unable to parse range|not found/i.test(String(e && e.message))) return []; // הלשונית עוד לא נוצרה — אין עדיין הקלטות
    throw e;
  }
  return vals.map((v, i) => { const o = { row: i + 2 }; HEAD.forEach((k, j) => { o[k] = v[j] ?? ''; }); return o; })
    .filter((r) => r.call_id && (r.kind === 'add' || r.kind === 'note' || r.kind === 'pick'))
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

/** רשימת החתונה: מי שגבאי אישר בטלפון (מקש המספר אחרי החיפוש). אחד לכל איש. */
function picks() {
  const seen = new Set(); const out = [];
  rows.filter((r) => r.kind === 'pick' && r.status !== 'removed').forEach((r) => {
    const cid = String(fieldsOf(r).contact_id || ''); if (!cid || seen.has(cid)) return;
    seen.add(cid); out.push({ ...r, cid });
  });
  return out;
}
function tabsHtml() {
  const n = picks().length;
  const open = (k) => rows.filter((r) => r.kind === k && !isDone(r)).length;
  const t = (k, label) => `<button type="button" class="chip${tab === k ? ' on' : ''}" data-gvtab="${k}">${label}</button>`;
  return `<div class="gv-tabs">
    ${t('add', `➕ איש קשר חדש (${open('add')} פתוחים)`)}
    ${t('note', `📝 הערות (${open('note')} פתוחות)`)}
    ${t('pick', `🎉 אישורים (${n})`)}
    <button type="button" class="btn" data-gvreload>↻ רענון</button>
  </div>`;
}
function drawPicks(main) {
  // 🎉 היסטוריה בלבד: כל אישור של גבאי כבר מסמן "שמחת בית אונגוואר" בכרטיס (בשרת) — אין כאן מה ללחוץ
  const list = picks();
  const nm = (r) => { const c = state.contacts.find((x) => String(x.contact_id) === r.cid); const n = c ? [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ') : ''; return n || r.transcript || ('#' + r.cid); };
  const gb = (g) => String(g || '').replace(/^גבאי\s*/, '');
  main.innerHTML = `
    <h1>📞 קו גבאים זמני</h1>
    ${tabsHtml()}
    <p class="muted" dir="rtl">מי שגבאי אישר בטלפון — מסומן אוטומטית "שמחת בית אונגוואר" בכרטיס. ${list.length} אישורים.</p>
    ${list.length ? `<table class="gv-hist"><thead><tr><th>שם</th><th>אושר ע"י</th><th>מתי</th></tr></thead><tbody>${list.map((r) => `<tr>
      <td><a href="#" data-gvcardlink="${h(r.cid)}">${h(nm(r))}</a></td><td>${h(gb(r.gabbai))}</td><td class="muted" dir="ltr">${h(r.at)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">עוד אין אישורים.</p>'}`;
  main.onclick = onClick;
}

function draw(main) {
  if (tab === 'pick') { drawPicks(main); return; }
  const mine = rows.filter((r) => r.kind === tab);
  const list = mine.filter((r) => filter === 'all' || (filter === 'open' ? !isDone(r) : isDone(r)));
  const cnt = (f) => mine.filter((r) => (f === 'all' || (f === 'open' ? !isDone(r) : isDone(r)))).length;
  const chip = (k, label, cur, attr) => `<button type="button" class="chip${cur === k ? ' on' : ''}" ${attr}="${k}">${label}</button>`;
  main.innerHTML = `
    <h1>📞 קו גבאים זמני</h1>
    ${tabsHtml()}
    <p class="muted" dir="rtl">${tab === 'add' ? 'אנשים חדשים שגבאים הקליטו בטלפון 929-219-1653 (מקש 2). "צור איש קשר" פותח טופס עם הפרטים שהובנו.' : 'הערות שגבאים השאירו בטלפון 929-219-1653 (מקש 4).'}</p>
    <div class="gv-filters">
      ${chip('open', `פתוח (${cnt('open')})`, filter, 'data-gvf')}
      ${chip('done', `טופל (${cnt('done')})`, filter, 'data-gvf')}
      ${chip('all', `הכל (${cnt('all')})`, filter, 'data-gvf')}
    </div>
    <div class="gv-list">${list.length ? list.map(item).join('') : '<p class="muted">אין כאן כלום כרגע.</p>'}</div>`;
  main.onclick = onClick;
}

function fieldsOf(r) { try { return JSON.parse(r.fields || '{}') || {}; } catch (e) { return {}; } }

function item(r) {
  const f = fieldsOf(r);
  const fl = [['first_name_he', 'שם פרטי'], ['last_name_he', 'שם משפחה'], ['first_name_en', 'First'], ['last_name_en', 'Last'], ['address', 'כתובת'], ['city', 'עיר'], ['zip', 'מיקוד'], ['mobile', 'נייד'], ['home_phone', 'בית']]
    .filter(([k]) => String(f[k] || '').trim()).map(([k, l]) => `<span class="gv-f"><b>${h(l)}:</b> ${h(f[k])}</span>`).join('');
  const audio = r.drive_id ? `<iframe class="gv-player" src="https://drive.google.com/file/d/${encodeURIComponent(r.drive_id)}/preview" allow="autoplay" loading="lazy" title="הקלטה"></iframe>
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
  const a = e.target.closest('[data-gvcardlink]'); if (a) { e.preventDefault(); if (ui.openCard) ui.openCard(a.dataset.gvcardlink); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.gvf) { filter = b.dataset.gvf; draw(this); return; }
  if (b.dataset.gvk) { kindF = b.dataset.gvk; draw(this); return; }
  if ('gvreload' in b.dataset) { rows = null; renderGvoice(); return; }
  if (b.dataset.gvtab) { tab = b.dataset.gvtab; filter = 'open'; draw(this); return; }
  if (b.dataset.gvcard) { if (ui.openCard) ui.openCard(b.dataset.gvcard); return; }
  if ('gvcopy' in b.dataset) {
    const txt = picks().map((r) => r.transcript || r.cid).join('\n');
    navigator.clipboard?.writeText(txt).then(() => ui.toast('הרשימה הועתקה.'), () => ui.toast('לא הצלחתי להעתיק.'));
    return;
  }
  if (b.dataset.gvrm) {
    const r = rows.find((x) => String(x.row) === b.dataset.gvrm); if (!r || busy.has(r.row)) return;
    const old = r.status; r.status = 'removed'; draw(this); busy.add(r.row);
    sheet().write(`GabbaiCalls!I${r.row}:K${r.row}`, [['removed', state.email || '', nowStamp()]])
      .then(() => ui.toast('הורד מהרשימה.'), (err) => { r.status = old; draw(this); ui.toast(ui.friendlyError ? ui.friendlyError(err) : err.message); })
      .finally(() => busy.delete(r.row));
    return;
  }
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
