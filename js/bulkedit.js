// ✏️ עריכה מרוכזת — כל אנשי הקשר בטבלה כמו אקסל, על כל המסך.
// למעלה: סינונים (חיפוש, פעיל/נפטר, מצב משפחתי, אזור, תגיות, רשימה, משפחה, ⚠ חסר, 💝 תרומות בשורות "תרם / לא תרם").
// קבוצות עמודות: שמות / כתובת / טלפונים / אימייל / אחר / 🏷 תגיות (לחצנים). שומרים רק תאים ששונו (יומן שינויים, בדיקת "מישהו אחר שינה").
import { state, loadAll, saveCellEdits, guestsOf, hostOf, ADDR_FIELDS, saveSavedList } from './data.js';
import { escapeHtml as h, isTrue, isAlive, digits } from './util.js';
import { tagSelHtml, readTagSel, matchesTagSel, storedTags, serialize, pathKey, pathLabel } from './tags.js';
import { allCampaigns } from './campaigns.js';
import { yearLabel, yearFromLabel, toHebrew, todayIso } from './hebdate.js';
import { evaluate, parseSaved, savedInScope, familyOf } from './lists.js';
import { t, maritalLabel } from './i18n.js';

let ui = null;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PER = 100;
const MEMKEY = 'khal-bulk';
const FAM = ['self', 'sons', 'sil', 'gk', 'gkd', 'ggk', 'father', 'fil', 'bro', 'bil', 'mech', 'mechg'];
const DON = () => ({ mode: 'gave', from: '', to: '', min: '', max: '', sum: 'total', type: '' });
const EMPTYF = () => ({ q: '', alive: 'alive', active: 'active', marital: [], areas: [], city: '', zip: '', tags: { keys: [], st: [], send: false }, xtags: { keys: [], st: [], send: false },
  list: '', xlist: '', fam: { id: '', rel: [] }, miss: [], don: [] });

let F = EMPTYF();
let group = 'names';
let tagCols = [];
let ED = new Map(); // 'id|c:field' → { v, o }
let pg = 0; let sortK = ''; let sortDir = 1;
let open = false; let rowsNow = [];

function loadMem() {
  try { const m = JSON.parse(localStorage.getItem(MEMKEY) || '{}'); F = { ...EMPTYF(), ...(m.F || {}) }; group = m.group || 'names'; tagCols = m.tagCols || []; } catch { /* */ }
}
function saveMem() { try { localStorage.setItem(MEMKEY, JSON.stringify({ F, group, tagCols })); } catch { /* */ } }

// ---------- עמודות ----------
const C = (k, l, o = {}) => ({ f: `c:${k}`, k, l, kind: 'c', ...o });
const P = (k, l, o = {}) => ({ f: `p:${k}`, k, l, kind: 'p', ltr: 1, ...o });
const GROUPS = [
  ['names', '👤 שמות', () => [C('title_he', 'תואר', { sel: 'title_he', w: 80 }), C('first_name_he', 'שם פרטי'), C('last_name_he', 'משפחה'), C('title_en', 'Title', { sel: 'title_en', ltr: 1, w: 90 }),
    C('first_name_en', 'First', { ltr: 1 }), C('last_name_en', 'Last', { ltr: 1 }), C('wife_name_he', 'שם האשה'), C('wife_name_en', 'Wife', { ltr: 1 }),
    C('marital_status', 'מצב משפחתי', { sel: 'marital_status', w: 100 }), C('is_alive', 'חי / נפטר', { alive: 1, w: 80 })]],
  ['addr', '🏠 כתובת', () => [C('address', 'כתובת', { ltr: 1, addr: 1, w: 210 }), C('city', 'City', { ltr: 1, addr: 1 }), C('state', 'State', { ltr: 1, addr: 1, w: 60 }),
    C('zip', 'ZIP', { ltr: 1, addr: 1, w: 90, chk: 'zip' }), C('country', 'Country', { ltr: 1, addr: 1, w: 90 }), C('area', 'אזור', { sel: 'area', addr: 1 })]],
  ['phones', '📞 טלפונים', () => [P('mobile', 'סלולרי', { chk: 'phone' }), P('home_phone', 'בית', { chk: 'phone' }), P('wife_mobile', 'סלולרי אשה', { chk: 'phone' }), P('other_phone', 'אחר', { chk: 'phone' })]],
  ['email', '✉ אימייל', () => [P('email_1', 'Email 1', { chk: 'email', w: 220 }), P('email_2', 'Email 2', { chk: 'email', w: 220 })]],
  ['other', '📋 אחר', () => [C('legal_first_name', 'שם רשמי', { ltr: 1 }), C('name_note', 'הערה לשם', { w: 200 }), P('comments', 'הערות', { ltr: 0, w: 260 })]],
  ['tags', '🏷 תגיות', () => tagCols.map((key) => ({ f: `t:${key}`, key, l: pathLabel(key.split('>')), kind: 't', w: 90 }))],
];
const colsNow = () => (GROUPS.find(([k]) => k === group) || GROUPS[0])[2]();

const phonesOf = (c) => state.phones.get(String(c.contact_id)) || {};
function rawVal(c, col) {
  if (col.kind === 'p') return String(phonesOf(c)[col.k] ?? '');
  if (col.kind === 't') return String(c.tags ?? '');
  if (col.alive) return isAlive(c.is_alive) ? 'TRUE' : 'FALSE';
  return String(c[col.k] ?? '');
}
const edKeyOf = (c, col) => `${c.contact_id}|${col.kind === 't' ? 'c:tags' : col.f}`;
function curVal(c, col) {
  const e = ED.get(edKeyOf(c, col));
  return e ? e.v : rawVal(c, col);
}
const tagState = (tagsStr, key) => { const x = storedTags({ tags: tagsStr }).find((y) => pathKey(y.p) === key && y.s !== 'auto'); return x ? x.s : ''; };
function bad(col, v) {
  const s = String(v || '').trim();
  if (!s || !col.chk) return false;
  if (col.chk === 'phone') { const d = digits(s).length; return ![7, 10, 11, 12, 13].includes(d); }
  if (col.chk === 'email') return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  if (col.chk === 'zip') return !/^\d{5}(-\d{4})?$/.test(s) && !/[a-z]/i.test(s);
  return false;
}

// ---------- תרומות ----------
let donIdx = null; let donSrc = null;
function donIndex() {
  if (donIdx && donSrc === state.donations) return donIdx;
  const ser = new Map(allCampaigns().map((c) => [c.name, c.series || c.name]));
  donIdx = new Map();
  (state.donations || []).forEach((d) => {
    if (!d.contact_id) return;
    let y = yearFromLabel(d.event_year);
    if (!y) { const dt = String(d.date || d.paid_date || '').slice(0, 10); if (/^\d{4}-\d\d-\d\d$/.test(dt)) y = toHebrew(dt).y; }
    const k = String(d.contact_id);
    if (!donIdx.has(k)) donIdx.set(k, []);
    donIdx.get(k).push({ y, a: Number(d.amount_usd || 0), ser: d.campaign ? (ser.get(d.campaign) || d.campaign) : '', camp: d.campaign || '', tag: d.event_tags || '' });
  });
  donSrc = state.donations;
  return donIdx;
}
function donTypes() {
  const s = new Set();
  allCampaigns().forEach((c) => s.add(c.series || c.name));
  (state.donations || []).forEach((d) => { if (!d.campaign && d.event_tags) s.add(d.event_tags); });
  return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b, 'he'));
}
function donYears() {
  const cur = toHebrew(todayIso()).y;
  let min = cur;
  donIndex().forEach((l) => l.forEach((x) => { if (x.y && x.y < min) min = x.y; }));
  const out = []; for (let y = cur + 1; y >= Math.max(min, 5700); y--) out.push(y);
  return out;
}
function donOk(cid, q) {
  const from = Number(q.from) || 0; const to = Number(q.to) || 0;
  const list = (donIndex().get(String(cid)) || []).filter((x) => (!from || x.y >= from) && (!to || x.y <= to)
    && (!q.type || x.ser === q.type || x.camp === q.type || x.tag === q.type));
  const min = q.min === '' ? null : Number(q.min); const max = q.max === '' ? null : Number(q.max);
  const inR = (v) => (min === null || v >= min) && (max === null || v <= max);
  let gave = list.length > 0;
  if (gave && (min !== null || max !== null)) gave = q.sum === 'one' ? list.some((x) => inR(x.a)) : inR(list.reduce((s, x) => s + x.a, 0));
  return q.mode === 'not' ? !gave : gave;
}

// ---------- סינון ----------
const MISS = [['first_name_he', 'שם פרטי (עברית)'], ['last_name_he', 'משפחה (עברית)'], ['first_name_en', 'First (English)'], ['last_name_en', 'Last (English)'],
  ['title_he', 'תואר'], ['title_en', 'Title'], ['wife', 'שם האשה (לנשוי)'], ['address', 'כתובת'], ['city', 'City'], ['zip', 'ZIP'], ['area', 'אזור'], ['phone', 'טלפון (אף אחד)'], ['email', 'אימייל']];
function missing(c, k) {
  const p = phonesOf(c);
  if (k === 'wife') return c.marital_status === 'נשוי' && !String(c.wife_name_he || c.wife_name_en || '').trim();
  if (k === 'phone') return !['mobile', 'home_phone', 'wife_mobile', 'other_phone'].some((x) => digits(p[x]).length >= 7);
  if (k === 'email') return !String(p.email_1 || p.email_2 || '').trim();
  return !String(c[k] || '').trim();
}
const norm = (s) => String(s ?? '').toLowerCase().replace(/["'׳״.\-,()]/g, '').replace(/\s+/g, ' ').trim();
function hay(c) {
  const p = phonesOf(c);
  return norm([c.title_he, c.first_name_he, c.last_name_he, c.first_name_en, c.last_name_en, c.wife_name_he, c.wife_name_en, c.address, c.city, c.zip, p.email_1, p.email_2].join(' '))
    + ` ${['mobile', 'home_phone', 'wife_mobile', 'other_phone'].map((x) => digits(p[x])).join(' ')}`;
}
function listIds(id) {
  const l = state.savedLists.find((x) => String(x.list_id) === String(id));
  return l ? new Set(evaluate(parseSaved(l).cr).map((r) => String(r.key))) : new Set();
}
function filtered() {
  const toks = norm(F.q).split(' ').filter(Boolean);
  const inL = F.list ? listIds(F.list) : null; const exL = F.xlist ? listIds(F.xlist) : null;
  const fam = F.fam.id && F.fam.rel.length ? familyOf(F.fam.id, F.fam.rel) : null;
  const city = norm(F.city); const zip = String(F.zip || '').trim();
  return state.contacts.filter((c) => {
    if (String(c.deleted_at || '').trim()) return false;
    const id = String(c.contact_id);
    const alive = isAlive(c.is_alive); if (F.alive === 'alive' && !alive) return false; if (F.alive === 'dead' && alive) return false;
    const act = isTrue(c.is_active) || c.is_active === '' || c.is_active === undefined;
    if (F.active === 'active' && !act) return false; if (F.active === 'inactive' && act) return false;
    if (F.marital.length && !F.marital.includes(c.marital_status || '')) return false;
    if (F.areas.length && !F.areas.includes(c.area || '')) return false;
    if (city && !norm(c.city).includes(city)) return false;
    if (zip && !String(c.zip || '').startsWith(zip)) return false;
    if (F.tags.keys.length && !matchesTagSel(c, F.tags)) return false;
    if (F.xtags.keys.length && matchesTagSel(c, F.xtags)) return false;
    if (inL && !inL.has(id)) return false; if (exL && exL.has(id)) return false;
    if (fam && !fam.has(id)) return false;
    if (F.miss.length && !F.miss.every((k) => missing(c, k))) return false;
    if (F.don.length && !F.don.every((q) => donOk(id, q))) return false;
    if (toks.length) { const s = hay(c); if (!toks.every((tk) => s.includes(tk) || (digits(tk).length >= 4 && s.includes(digits(tk))))) return false; }
    return true;
  });
}
const nameHe = (c) => ui.fullNameHe(c) || [c.first_name_en, c.last_name_en].filter(Boolean).join(' ') || `#${c.contact_id}`;
function sorted(list) {
  const cols = colsNow();
  const col = cols.find((x) => x.f === sortK);
  const key = col ? (c) => (col.kind === 't' ? tagState(curVal(c, col), col.key) : curVal(c, col)) : (c) => `${c.last_name_he || c.last_name_en || ''} ${c.first_name_he || ''}`;
  return list.sort((a, b) => String(key(a)).localeCompare(String(key(b)), 'he') * (col ? sortDir : 1));
}

// ---------- המסך ----------
// נרשם כשהמודול נטען — לפני ה"צוריק" של האתר, כדי שכאן זה ייתפס קודם
window.addEventListener('popstate', (e) => {
  if (!open) return;
  e.stopImmediatePropagation();
  if ($('#be-dlg')?.open) { $('#be-dlg').close(); history.pushState({ be: 1 }, ''); return; }
  if (ED.size) { history.pushState({ be: 1 }, ''); canLeave(() => close()); } else close(true);
});
window.addEventListener('beforeunload', (e) => { if (open && ED.size) { e.preventDefault(); e.returnValue = ''; } });
export function initBulk(helpers) { ui = helpers; }
export const bulkDirty = () => open && ED.size > 0;

export function openBulk() {
  loadMem();
  let s = $('#be-screen');
  if (!s) { s = document.createElement('div'); s.id = 'be-screen'; s.className = 'be-screen'; document.body.append(s); }
  s.hidden = false; open = true; pg = 0;
  document.body.classList.add('be-open');
  history.pushState({ be: 1 }, '');
  render();
}
function close(fromPop = false) {
  open = false; ED.clear();
  const s = $('#be-screen'); if (s) { s.hidden = true; s.innerHTML = ''; }
  document.body.classList.remove('be-open');
  if (!fromPop && history.state?.be) history.back();
}

function render() {
  const s = $('#be-screen'); if (!s) return;
  const keepScroll = $('.be-gridwrap', s)?.scrollTop || 0;
  const fOpen = $('.be-filters', s) ? $('.be-filters', s).open : true;
  rowsNow = sorted(filtered());
  const pages = Math.max(1, Math.ceil(rowsNow.length / PER)); if (pg >= pages) pg = pages - 1;
  s.innerHTML = `
    <header class="be-top"><h2>✏️ עריכה מרוכזת</h2><span class="be-n">נמצאו <b>${rowsNow.length}</b></span>
      <span class="be-dirty" id="be-dirty">${dirtyText()}</span><span class="spacer"></span>
      <button type="button" class="btn" id="be-savelist" title="לשמור את מי שנמצא כרשימה מוכנה">📋 לשמור כרשימה</button>
      <button type="button" class="btn primary" id="be-save"${ED.size ? '' : ' disabled'}>💾 שמירה</button>
      <button type="button" class="btn" id="be-close">✕ סגירה</button></header>
    <details class="be-filters"${fOpen ? ' open' : ''}><summary>🔎 סינון</summary>${filtersHtml()}</details>
    <div class="be-chips">${chipsHtml()}</div>
    <nav class="be-groups">${GROUPS.map(([k, l]) => `<button type="button" data-g="${k}" class="${group === k ? 'on' : ''}">${l}</button>`).join('')}
      ${group === 'tags' ? '<button type="button" class="btn" id="be-tagpick">＋ לבחור תגיות</button>' : ''}
      <span class="spacer"></span><span class="muted small">חיצים / Enter — לזוז · Esc — להחזיר · אפשר להדביק מאקסל · Ctrl+S — שמירה</span></nav>
    <div class="be-gridwrap">${gridHtml()}</div>
    <footer class="be-pager">${pages > 1 ? `<button type="button" class="btn" data-pg="-1"${pg ? '' : ' disabled'}>›</button> עמוד ${pg + 1} מתוך ${pages} <button type="button" class="btn" data-pg="1"${pg < pages - 1 ? '' : ' disabled'}>‹</button>` : ''}</footer>`;
  wire(s);
  const gw = $('.be-gridwrap', s); if (gw) gw.scrollTop = keepScroll;
}
function dirtyText() {
  if (!ED.size) return '';
  return `✎ שינית ${ED.size} תאים (${new Set([...ED.keys()].map((k) => k.split('|')[0])).size} אנשים)`;
}

function filtersHtml() {
  const L = state.lists || {};
  const multi = (name, vals, sel, lab = (v) => v) => `<div class="be-multi">${vals.map((v) => `<label class="check"><input type="checkbox" data-multi="${name}" value="${h(v)}"${sel.includes(v) ? ' checked' : ''}> ${h(lab(v) || '—')}</label>`).join('')}</div>`;
  const lists = savedInScope();
  const lopt = (cur) => `<option value="">—</option>${lists.map((l) => `<option value="${h(l.list_id)}"${String(cur) === String(l.list_id) ? ' selected' : ''}>${h(l.name)}</option>`).join('')}`;
  const famC = F.fam.id ? ui.contactById(F.fam.id) : null;
  const types = donTypes(); const years = donYears();
  const yopt = (cur) => `<option value="">—</option>${years.map((y) => `<option value="${y}"${String(cur) === String(y) ? ' selected' : ''}>${h(yearLabel(y))}</option>`).join('')}`;
  return `<div class="be-fgrid">
    <section><h4>👥 מי</h4>
      <label>חיפוש<input id="bf-q" value="${h(F.q)}" placeholder="שם, טלפון, כתובת, אימייל"></label>
      <div class="be-row"><label>חי / נפטר<select data-f="alive">${[['alive', 'רק חיים'], ['all', 'כולם'], ['dead', 'רק נפטרים']].map(([v, l]) => `<option value="${v}"${F.alive === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>פעיל<select data-f="active">${[['active', 'רק פעילים'], ['all', 'כולם'], ['inactive', 'רק לא פעילים']].map(([v, l]) => `<option value="${v}"${F.active === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <h5>מצב משפחתי</h5>${multi('marital', [...(L.marital_status || []), ''], F.marital)}
    </section>
    <section><h4>🏠 איפה</h4>
      <h5>אזור</h5>${multi('areas', [...(L.area || []), ''], F.areas)}
      <div class="be-row"><label>City<input id="bf-city" dir="ltr" value="${h(F.city)}"></label><label>ZIP<input id="bf-zip" dir="ltr" value="${h(F.zip)}"></label></div>
    </section>
    <section><h4>🏷 תגיות · 📋 רשימות · 👪 משפחה</h4>
      <div class="be-row"><button type="button" class="btn" data-tsel="tags">🏷 יש לו תגית${F.tags.keys.length ? ` (${F.tags.keys.length})` : ''}</button>
        <button type="button" class="btn" data-tsel="xtags">🚫 חוץ ממי שיש לו${F.xtags.keys.length ? ` (${F.xtags.keys.length})` : ''}</button></div>
      <label>ברשימה<select data-f="list">${lopt(F.list)}</select></label>
      <label>חוץ מרשימה<select data-f="xlist">${lopt(F.xlist)}</select></label>
      <label>המשפחה של<input id="bf-fam" list="bf-dl" value="${famC ? h(ui.pickerLabel(famC)) : ''}" placeholder="שם…"></label>
      <datalist id="bf-dl">${state.contacts.slice(0, 5000).map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
      ${F.fam.id ? `<div class="be-multi">${FAM.map((r) => `<label class="check"><input type="checkbox" data-famrel="${r}"${F.fam.rel.includes(r) ? ' checked' : ''}> ${h(t(`L2rel_${r}`))}</label>`).join('')}</div>` : ''}
    </section>
    <section><h4>⚠ חסר</h4>${multi('miss', MISS.map(([k]) => k), F.miss, (k) => MISS.find(([x]) => x === k)[1])}</section>
    <section class="be-don"><h4>💝 תרומות</h4>
      ${F.don.map((q, i) => `<div class="be-donrow" data-di="${i}">
        <select data-d="mode"><option value="gave"${q.mode === 'gave' ? ' selected' : ''}>✅ תרם</option><option value="not"${q.mode === 'not' ? ' selected' : ''}>❌ לא תרם</option></select>
        <label>משנה<select data-d="from">${yopt(q.from)}</select></label><label>עד<select data-d="to">${yopt(q.to)}</select></label>
        <label>$ מ־<input data-d="min" type="number" min="0" value="${h(q.min)}"></label><label>עד $<input data-d="max" type="number" min="0" value="${h(q.max)}"></label>
        <select data-d="sum"><option value="total"${q.sum === 'total' ? ' selected' : ''}>כולל</option><option value="one"${q.sum === 'one' ? ' selected' : ''}>חד־פעמי</option></select>
        <label>קמפיין / סוג<select data-d="type"><option value="">הכל</option>${types.map((v) => `<option value="${h(v)}"${q.type === v ? ' selected' : ''}>${h(v)}</option>`).join('')}</select></label>
        <button type="button" class="linkish" data-drm="${i}" title="להוריד">✕</button></div>`).join('')}
      <button type="button" class="btn" id="bf-donadd">＋ תנאי תרומה</button>
      <p class="muted small">כל השורות חלות ביחד. שנים ריקות = כל השנים. "כולל" = הסכום של כל התרומות בטווח; "חד־פעמי" = תרומה אחת בטווח.</p>
    </section>
  </div>
  <div class="be-row"><button type="button" class="btn" id="bf-clear">🧹 לנקות סינון</button></div>`;
}
function chipsHtml() {
  const c = [];
  const chip = (k, txt) => c.push(`<span class="chip be-chip">${h(txt)} <button type="button" class="linkish" data-clr="${h(k)}">✕</button></span>`);
  if (F.q) chip('q', `🔎 ${F.q}`);
  if (F.alive !== 'alive') chip('alive', F.alive === 'all' ? 'חיים ונפטרים' : 'רק נפטרים');
  if (F.active !== 'active') chip('active', F.active === 'all' ? 'פעילים ולא פעילים' : 'רק לא פעילים');
  if (F.marital.length) chip('marital', `מצב: ${F.marital.map((x) => x || '—').join(', ')}`);
  if (F.areas.length) chip('areas', `אזור: ${F.areas.map((x) => x || '—').join(', ')}`);
  if (F.city) chip('city', `City: ${F.city}`); if (F.zip) chip('zip', `ZIP: ${F.zip}`);
  if (F.tags.keys.length) chip('tags', `🏷 ${F.tags.keys.map((k) => pathLabel(k.split('>'))).join(', ')}`);
  if (F.xtags.keys.length) chip('xtags', `🚫 ${F.xtags.keys.map((k) => pathLabel(k.split('>'))).join(', ')}`);
  const ln = (id) => state.savedLists.find((l) => String(l.list_id) === String(id))?.name || id;
  if (F.list) chip('list', `📋 ${ln(F.list)}`); if (F.xlist) chip('xlist', `🚫📋 ${ln(F.xlist)}`);
  if (F.fam.id) chip('fam', `👪 ${nameHe(ui.contactById(F.fam.id) || { contact_id: F.fam.id })}`);
  if (F.miss.length) chip('miss', `⚠ חסר: ${F.miss.map((k) => MISS.find(([x]) => x === k)?.[1]).join(', ')}`);
  F.don.forEach((q, i) => chip(`don:${i}`, `${q.mode === 'not' ? '❌ לא תרם' : '✅ תרם'}${q.type ? ` ${q.type}` : ''}${q.from || q.to ? ` ${q.from ? yearLabel(Number(q.from)) : '…'}–${q.to ? yearLabel(Number(q.to)) : '…'}` : ''}${q.min !== '' || q.max !== '' ? ` $${q.min || 0}–${q.max || '∞'} ${q.sum === 'one' ? 'חד־פעמי' : 'כולל'}` : ''}`));
  return c.join(' ');
}

function gridHtml() {
  const cols = colsNow();
  if (group === 'tags' && !cols.length) return '<p class="muted be-empty">לחצו "＋ לבחור תגיות" — כל תגית תהיה עמודה עם לחצן.</p>';
  const rows = rowsNow.slice(pg * PER, pg * PER + PER);
  if (!rows.length) return '<p class="muted be-empty">אין אף אחד שמתאים לסינון.</p>';
  const L = state.lists || {};
  const th = (col, j) => `<th style="${col.w ? `min-width:${col.w}px` : ''}" data-sort="${h(col.f)}">${h(col.l)}${sortK === col.f ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}
    ${state.isAdmin && col.kind !== 't' ? `<button type="button" class="be-fill" data-fill="${j}" title="למלא ערך לכל ${rowsNow.length} המסוננים">⤓</button>` : ''}</th>`;
  const cell = (c, col, i, j) => {
    const v = curVal(c, col); const chg = ED.has(edKeyOf(c, col)) && (col.kind !== 't' || tagState(v, col.key) !== tagState(ED.get(edKeyOf(c, col)).o, col.key));
    const at = `data-r="${i}" data-c="${j}" data-id="${h(c.contact_id)}"`;
    if (col.addr && hostOf(c)) return `<td class="be-ro" title="גר אצל ${h(nameHe(hostOf(c)))} — הכתובת נערכת אצלו"${col.ltr ? ' dir="ltr"' : ''}>🏠 ${h(v)}</td>`;
    if (col.kind === 't') {
      const st = tagState(v, col.key);
      return `<td class="be-td"><button type="button" class="be-in be-tag st-${st || 'none'}${chg ? ' chg' : ''}" ${at}>${st === 'a' ? '✓ פעיל' : st === 'f' ? 'יוצא' : st === 'u' ? '⚠' : '·'}</button></td>`;
    }
    if (col.alive) return `<td class="be-td"><select class="be-in${chg ? ' chg' : ''}" ${at}><option value="TRUE"${v === 'TRUE' ? ' selected' : ''}>חי</option><option value="FALSE"${v === 'FALSE' ? ' selected' : ''}>נפטר</option></select></td>`;
    if (col.sel) {
      const opts = [...new Set(['', ...(L[col.sel] || []), v])];
      return `<td class="be-td"><select class="be-in${chg ? ' chg' : ''}" ${at}>${opts.map((o) => `<option value="${h(o)}"${o === v ? ' selected' : ''}>${h(col.sel === 'marital_status' && o ? maritalLabel(o) : o)}</option>`).join('')}</select></td>`;
    }
    return `<td class="be-td"><input class="be-in${chg ? ' chg' : ''}${bad(col, v) ? ' bad' : ''}" ${at} value="${h(v)}"${col.ltr ? ' dir="ltr"' : ''} autocomplete="off" spellcheck="false"></td>`;
  };
  return `<table class="be-table no-sort"><thead><tr><th class="be-num">#</th><th class="be-name" data-sort="">שם</th>${cols.map(th).join('')}</tr></thead>
    <tbody>${rows.map((c, i) => `<tr><td class="be-num muted small">${pg * PER + i + 1}</td>
      <td class="be-name"><button type="button" class="linkish" data-card="${h(c.contact_id)}">${h(nameHe(c))}</button>${isAlive(c.is_alive) ? '' : ' <span class="badge muted">נפטר</span>'}
        <span class="muted small" dir="ltr">${h([c.first_name_en, c.last_name_en].filter(Boolean).join(' '))}</span></td>
      ${cols.map((col, j) => cell(c, col, i, j)).join('')}</tr>`).join('')}</tbody></table>`;
}

// ---------- אירועים ----------
function setF(fn) { fn(); pg = 0; saveMem(); render(); }
function wire(s) {
  $('#be-close', s).onclick = () => canLeave(() => close());
  $('#be-save', s).onclick = () => save();
  $('#be-savelist', s).onclick = () => saveAsList();
  $$('[data-g]', s).forEach((b) => { b.onclick = () => { group = b.dataset.g; sortK = ''; saveMem(); render(); }; });
  $('#be-tagpick', s)?.addEventListener('click', () => tagDialog(tagCols, (keys) => { tagCols = keys; saveMem(); render(); }, 'אילו תגיות להציג כעמודות?'));
  $$('[data-pg]', s).forEach((b) => { b.onclick = () => { pg += Number(b.dataset.pg); render(); $('.be-gridwrap', s).scrollTop = 0; }; });
  $$('[data-clr]', s).forEach((b) => {
    b.onclick = () => setF(() => {
      const k = b.dataset.clr; const E = EMPTYF();
      if (k.startsWith('don:')) F.don.splice(Number(k.slice(4)), 1); else F[k] = E[k];
    });
  });
  // סינונים
  let tq = null;
  $('#bf-q', s).addEventListener('input', (e) => { clearTimeout(tq); const v = e.target.value; tq = setTimeout(() => { F.q = v; pg = 0; saveMem(); render(); const q = $('#bf-q'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } }, 350); });
  ['city', 'zip'].forEach((k) => $(`#bf-${k}`, s).addEventListener('change', (e) => setF(() => { F[k] = e.target.value.trim(); })));
  $$('[data-f]', s).forEach((el) => { el.onchange = () => setF(() => { F[el.dataset.f] = el.value; }); });
  $$('[data-multi]', s).forEach((el) => { el.onchange = () => setF(() => { const k = el.dataset.multi; F[k] = $$(`[data-multi="${k}"]:checked`, s).map((x) => x.value); }); });
  $$('[data-tsel]', s).forEach((b) => { b.onclick = () => { const k = b.dataset.tsel; tagDialog(F[k].keys, (keys, sel) => setF(() => { F[k] = { ...sel, keys }; }), k === 'tags' ? 'מי שיש לו אחת מהתגיות' : 'חוץ ממי שיש לו אחת מהתגיות', F[k]); }; });
  $('#bf-fam', s).addEventListener('change', (e) => { const m = e.target.value.match(/\(#(\d+)\)/); setF(() => { F.fam = { id: m ? m[1] : '', rel: m ? (F.fam.rel.length ? F.fam.rel : ['sons', 'sil']) : [] }; }); });
  $$('[data-famrel]', s).forEach((el) => { el.onchange = () => setF(() => { F.fam.rel = $$('[data-famrel]:checked', s).map((x) => x.dataset.famrel); }); });
  $('#bf-donadd', s).onclick = () => setF(() => { F.don.push(DON()); });
  $$('.be-donrow', s).forEach((row) => {
    const i = Number(row.dataset.di);
    $$('[data-d]', row).forEach((el) => { el.onchange = () => setF(() => { F.don[i][el.dataset.d] = el.value; }); });
    $('[data-drm]', row).onclick = () => setF(() => { F.don.splice(i, 1); });
  });
  $('#bf-clear', s).onclick = () => setF(() => { F = EMPTYF(); });
  // הטבלה
  const grid = $('.be-gridwrap', s);
  const cols = colsNow();
  const byId = (id) => rowsNow.find((c) => String(c.contact_id) === String(id));
  const setVal = (el, v) => {
    const c = byId(el.dataset.id); const col = cols[Number(el.dataset.c)]; if (!c || !col) return;
    const k = edKeyOf(c, col); const o = ED.get(k)?.o ?? rawVal(c, col);
    if (String(v).trim() === String(o).trim()) ED.delete(k); else ED.set(k, { v, o });
    if (el.tagName !== 'BUTTON') { if (el.value !== v) el.value = v; el.classList.toggle('chg', ED.has(k)); el.classList.toggle('bad', bad(col, v)); }
    $('#be-dirty', s).textContent = dirtyText(); $('#be-save', s).disabled = !ED.size;
  };
  grid.addEventListener('input', (e) => { const el = e.target.closest('input.be-in'); if (el) setVal(el, el.value); });
  grid.addEventListener('change', (e) => { const el = e.target.closest('select.be-in'); if (el) setVal(el, el.value); });
  grid.addEventListener('focusin', (e) => { const el = e.target.closest('.be-in'); if (!el) return; el.closest('tr')?.classList.add('be-cur'); if (el.select) el.select(); });
  grid.addEventListener('focusout', (e) => { e.target.closest('tr')?.classList.remove('be-cur'); });
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-card]'); if (card) { ui.openCard(card.dataset.card); return; }
    const fill = e.target.closest('[data-fill]'); if (fill) { e.stopPropagation(); fillAll(cols[Number(fill.dataset.fill)]); return; }
    const th = e.target.closest('th[data-sort]'); if (th) { const k = th.dataset.sort; if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = 1; } render(); return; }
    const tb = e.target.closest('button.be-tag'); if (tb) cycleTag(tb);
  });
  function cycleTag(tb) {
    const c = byId(tb.dataset.id); const col = cols[Number(tb.dataset.c)]; if (!c || !col) return;
    const k = edKeyOf(c, col); const o = ED.get(k)?.o ?? rawVal(c, col);
    const list = storedTags({ tags: curVal(c, col) });
    const i = list.findIndex((x) => pathKey(x.p) === col.key && x.s !== 'auto');
    const st = i >= 0 ? list[i].s : '';
    if (!st) list.push({ p: col.key.split('>'), s: 'a', d: todayIso() });
    else if (st === 'a' || st === 'u') { list[i].s = 'f'; list[i].d = todayIso(); } else list.splice(i, 1);
    const v = serialize(list);
    if (v === o) ED.delete(k); else ED.set(k, { v, o });
    // כל הלחצנים של אותו איש (עמודות של תגיות אחרות) — מתעדכנים
    $$(`button.be-tag[data-id="${c.contact_id}"]`, grid).forEach((b) => {
      const cc = cols[Number(b.dataset.c)]; const ns = tagState(v, cc.key); const os = tagState(o, cc.key);
      b.className = `be-in be-tag st-${ns || 'none'}${ns !== os ? ' chg' : ''}`; b.textContent = ns === 'a' ? '✓ פעיל' : ns === 'f' ? 'יוצא' : ns === 'u' ? '⚠' : '·';
    });
    $('#be-dirty', s).textContent = dirtyText(); $('#be-save', s).disabled = !ED.size;
  }
  const trs = () => $$('.be-table tbody tr', grid);
  const go = (el, dr, dc) => {
    const list = trs(); let r = list.indexOf(el.closest('tr')); let c = Number(el.dataset.c);
    for (let n = 0; n < 400; n++) {
      r += dr; c += dc;
      if (r < 0 || r >= list.length || c < 0 || c >= cols.length) return;
      const nx = list[r].querySelector(`.be-in[data-c="${c}"]`);
      if (nx) { nx.focus(); nx.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
      if (dc) continue;
    }
  };
  grid.addEventListener('keydown', (e) => {
    const el = e.target.closest('.be-in'); if (!el) return;
    const txt = el.tagName === 'INPUT';
    const all = txt && (el.selectionStart === 0 && el.selectionEnd === el.value.length);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey && el.tagName !== 'BUTTON')) { e.preventDefault(); go(el, 1, 0); }
    else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) { e.preventDefault(); go(el, -1, 0); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (!txt || all || !el.value)) { e.preventDefault(); go(el, 0, e.key === 'ArrowLeft' ? 1 : -1); }
    else if (e.key === 'Escape') {
      e.preventDefault();
      const c = byId(el.dataset.id); const col = cols[Number(el.dataset.c)];
      if (c && col && col.kind !== 't') { const o = ED.get(edKeyOf(c, col))?.o; if (o !== undefined) setVal(el, o); }
    }
  });
  grid.addEventListener('paste', (e) => {
    const el = e.target.closest('input.be-in'); if (!el) return;
    const txt = e.clipboardData?.getData('text/plain') || '';
    if (!/[\t\n]/.test(txt.replace(/\r?\n$/, ''))) return;
    e.preventDefault();
    const lines = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    const list = trs(); const r0 = list.indexOf(el.closest('tr')); const c0 = Number(el.dataset.c);
    lines.forEach((line, i) => line.split('\t').forEach((v, j) => {
      const nx = list[r0 + i]?.querySelector(`.be-in[data-c="${c0 + j}"]`);
      if (!nx || nx.tagName === 'BUTTON') return;
      if (nx.tagName === 'SELECT') { if ([...nx.options].some((o) => o.value === v.trim())) { nx.value = v.trim(); setVal(nx, v.trim()); nx.classList.add('chg'); } return; }
      setVal(nx, v.trim());
    }));
  });
}

// ---------- דיאלוגים ----------
function dlg(html) {
  let d = $('#be-dlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'be-dlg'; d.className = 'sheet'; document.body.append(d); }
  d.innerHTML = `<button type="button" class="x-close" data-x aria-label="סגירה">✕</button>${html}`;
  $$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  if (!d.open) d.showModal();
  return d;
}
function tagDialog(keys, onOk, title, sel = null) {
  const d = dlg(`<h3>${h(title)}</h3>${tagSelHtml({ keys, st: sel?.st || [], send: sel ? sel.send : false })}
    <div class="actions"><button type="button" class="btn primary" id="bt-ok">אישור</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`);
  d.classList.add('wide');
  $('#bt-ok', d).onclick = () => { const r = readTagSel(d); d.close(); onOk(r.keys, r); };
}
function fillAll(col) {
  if (!col) return;
  const L = state.lists || {};
  const opts = col.alive ? [['TRUE', 'חי'], ['FALSE', 'נפטר']] : col.sel ? ['', ...(L[col.sel] || [])].map((o) => [o, o || '— ריק —']) : null;
  const d = dlg(`<h3>⤓ למלא "${h(col.l)}" לכל המסוננים</h3>
    <p>הערך ייכתב אצל <b>${rowsNow.length}</b> אנשים (כל הדפים). זה לא נשמר עד שלוחצים 💾 שמירה.</p>
    ${opts ? `<select id="bf-fillv">${opts.map(([v, l]) => `<option value="${h(v)}">${h(l)}</option>`).join('')}</select>` : `<input id="bf-fillv"${col.ltr ? ' dir="ltr"' : ''} placeholder="ערך (ריק = למחוק)">`}
    <div class="actions"><button type="button" class="btn primary" id="bf-fillok">למלא אצל ${rowsNow.length}</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`);
  $('#bf-fillok', d).onclick = () => {
    const v = $('#bf-fillv', d).value;
    rowsNow.forEach((c) => {
      if (col.addr && hostOf(c)) return;
      const k = edKeyOf(c, col); const o = ED.get(k)?.o ?? rawVal(c, col);
      if (String(v).trim() === String(o).trim()) ED.delete(k); else ED.set(k, { v, o });
    });
    d.close(); render();
  };
}
async function saveAsList() {
  const d = dlg(`<h3>📋 לשמור כרשימה מוכנה</h3><p>${rowsNow.length} אנשים ייכנסו לרשימה (קבועה — בדיוק מי שנמצא עכשיו).</p>
    <label>שם הרשימה<input id="bf-lname"></label>
    <div class="actions"><button type="button" class="btn primary" id="bf-lok">שמירה</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`);
  $('#bf-lok', d).onclick = async (e) => {
    const name = $('#bf-lname', d).value.trim(); if (!name) return;
    e.target.disabled = true;
    try {
      const cr = { v: 2, base: '', add: rowsNow.map((c) => ({ id: String(c.contact_id) })), meta: { note: 'נשמר מהעריכה המרוכזת', editors: [], viewers: [], firstTab: 'names', mem: {}, sep: [], notDup: [] } };
      await saveSavedList({ list_id: '', name, criteria: JSON.stringify(cr), columns: '', scope: '', visibility: 'private' });
      await loadAll(); d.close(); ui.toast(`נשמר ✓ — "${name}" ברשימות המוכנות`);
    } catch (err) { e.target.disabled = false; ui.toast(ui.friendlyError(err), 'error'); }
  };
}
/** אפשר לצאת? אם יש שינויים — "לא שמרת" (לשמור / לא לשמור / להישאר) */
function canLeave(next) {
  if (!ED.size) { next(); return; }
  const d = dlg(`<h3>⚠ לא שמרת</h3><p>שינית ${ED.size} תאים ועוד לא שמרת. מה לעשות?</p>
    <div class="actions"><button type="button" class="btn primary" data-a="save">💾 לשמור ולצאת</button><button type="button" class="btn danger" data-a="drop">לא לשמור</button>
    <span class="spacer"></span><button type="button" class="btn" data-x>להישאר</button></div>`);
  $('[data-a="save"]', d).onclick = async (e) => { e.target.disabled = true; d.close(); if (await save()) next(); };
  $('[data-a="drop"]', d).onclick = () => { ED.clear(); d.close(); next(); };
}

// ---------- שמירה ----------
let saving = false;
async function save() {
  if (!ED.size || saving) return false;
  saving = true;
  const btn = $('#be-save'); if (btn) { btn.disabled = true; btn.textContent = 'שומר…'; }
  try {
    await loadAll(); // הנתונים העדכניים — לבדוק אם מישהו אחר שינה בינתיים
    const allCols = GROUPS.flatMap(([, , f]) => f()).filter((c) => c.kind !== 't');
    const colOf = (f) => (f === 'c:tags' ? { kind: 't' } : allCols.find((c) => c.f === f) || { kind: f.startsWith('p:') ? 'p' : 'c', k: f.slice(2) });
    const conf = [];
    ED.forEach((e, key) => {
      const i = key.indexOf('|'); const id = key.slice(0, i); const f = key.slice(i + 1);
      const c = ui.contactById(id); if (!c) return;
      const now = rawVal(c, colOf(f));
      if (now !== e.o && now !== e.v) conf.push({ key, c, f, now, e });
    });
    if (conf.length && !(await askConflicts(conf))) return false;
    const by = new Map();
    const get = (id) => { const k = String(id); if (!by.has(k)) by.set(k, { id: k, contact: {}, phones: {} }); return by.get(k); };
    ED.forEach((e, key) => {
      const i = key.indexOf('|'); const id = key.slice(0, i); const f = key.slice(i + 1);
      const v = String(e.v).trim();
      if (f.startsWith('p:')) get(id).phones[f.slice(2)] = v; else get(id).contact[f.slice(2)] = f === 'c:tags' ? e.v : v;
    });
    [...by.values()].forEach((o) => {
      const ks = Object.keys(o.contact).filter((k) => ADDR_FIELDS.includes(k)); const c = ui.contactById(o.id);
      if (ks.length && c) guestsOf(c).forEach((g) => { const go = get(g.contact_id); ks.forEach((k) => { go.contact[k] = o.contact[k]; }); });
    });
    const n = await saveCellEdits([...by.values()]);
    ED.clear();
    ui.toast(`נשמר ✓ — ${n} אנשי קשר עודכנו`);
    ui.refreshAll?.();
    if (open) render();
    return true;
  } catch (err) {
    ui.toast(ui.friendlyError(err), 'error');
    return false;
  } finally {
    saving = false;
    const b = $('#be-save'); if (b) { b.textContent = '💾 שמירה'; b.disabled = !ED.size; }
  }
}
function askConflicts(conf) {
  return new Promise((resolve) => {
    const d = dlg(`<h3>⚠ מישהו אחר שינה בינתיים</h3><p>אצל ${conf.length} תאים מישהו אחר שמר ערך אחר מאז שפתחת:</p>
      <div class="be-conf"><table class="lb-table"><thead><tr><th>איש קשר</th><th>שדה</th><th>היה</th><th>עכשיו (אחר)</th><th>שלך</th></tr></thead>
      <tbody>${conf.slice(0, 60).map((x) => `<tr><td>${h(nameHe(x.c))}</td><td>${h(x.f.slice(2))}</td><td dir="auto">${h(x.f === 'c:tags' ? '…' : x.e.o)}</td><td dir="auto">${h(x.f === 'c:tags' ? '…' : x.now)}</td><td dir="auto"><b>${h(x.f === 'c:tags' ? '…' : x.e.v)}</b></td></tr>`).join('')}</tbody></table></div>
      <div class="actions"><button type="button" class="btn" data-a="skip">לשמור רק את השאר (להשאיר את שלהם)</button><button type="button" class="btn danger" data-a="over">לדרוס עם שלי</button>
      <span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`);
    let done = false; const fin = (v) => { if (done) return; done = true; d.close(); resolve(v); };
    d.onclose = () => fin(false);
    $('[data-a="skip"]', d).onclick = () => { conf.forEach((x) => ED.delete(x.key)); fin(true); };
    $('[data-a="over"]', d).onclick = () => fin(true);
  });
}
