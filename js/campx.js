// 🎯 ניהול קמפיין מורחב:
//  שלב 1 — הגדרות קמפיין (לשונית CampaignSettings: key = שם הסדרה השנתית או שם הקמפיין; JSON).
//           קמפיין שנתי יורש את הגדרות הסדרה, ושנה ספציפית יכולה לדרוס. "העתקה משנה קודמת" מעתיק מוזמנים + דרגות.
//  שלב 2 — מוזמנים ומעקב (לשונית CampaignInvites): גם אנשים שלא באנשי קשר, דרגות עם סכום מוצע ידני,
//           סכומים של X שנים אחורה, סטטוס אוטומטי מהתרומות (הוזמן → הבטיח → שילם) עם דריסה ידנית.
//  שלב 3 — חלוקת שיחות בין הגבאים, "שמירה כרשימה" (ל-SMS / מיזוג דואר), השוואה לשנה שעברה.
import { otherSheet } from './google.js';
import { CONFIG } from './config.js';
import { state, loadAll, saveCampaign, saveSavedList, allUsers } from './data.js';
import { isTrue, escapeHtml as h } from './util.js';
import { yearLabel, yearFromLabel } from './hebdate.js';
import { money, donorName, openDonationForm } from './donations.js';
import { downloadXlsx } from './excel.js';

const sheet = () => otherSheet(CONFIG.SPREADSHEET_ID);
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const TYPES = [['magbis', 'מגבית'], ['dinner', 'דינער / סעודה'], ['dedications', 'הקדשות'], ['seats', 'מקומות'], ['aliyos', 'עליות והתחייבויות'], ['sale', 'מכירה'], ['other', 'אחר']];
export const ENTITIES = [
  { name: 'Khal Ungvar', ein: '11-2330829', processor: 'sola' },
  { name: 'CLNH', ein: '', processor: 'sola' },
  { name: 'MHGI', ein: '', processor: 'sola' },
];
const DEFAULTS = {
  name_he: '', name_yi: '', name_en: '', type: 'magbis', entity: 'Khal Ungvar', ein: '11-2330829', processor: 'sola',
  start_date: '', end_date: '', event_date: '', goods_desc: '', goods_value: '', methods: [], recurring: true, fee: true, fee_pct: 3,
  gabbaim: [], notify: [], receipt_auto: true, letter: '', tiers: [], years_back: 3,
  match: { on: false, mult: 2, sponsor: '', cap: '' }, extras: { journal: false, seating: false, tickets: false },
};

// ---------- אחסון ----------
const SET_TAB = 'CampaignSettings';
const SET_HEAD = ['key', 'scope', 'settings', 'updated_at', 'updated_by'];
const INV_TAB = 'CampaignInvites';
const INV_HEAD = ['inv_id', 'campaign', 'contact_id', 'name', 'phone', 'email', 'address', 'tier', 'suggested', 'status_manual', 'assigned_to', 'table_no', 'note', 'updated_at', 'updated_by'];
const colL = (n) => String.fromCharCode(64 + n);

async function readTab(tab, head) {
  let rows;
  try { rows = await sheet().read(`${tab}!A1:${colL(head.length)}20000`); } catch {
    await sheet().addTab(tab); await sheet().write(`${tab}!A1:${colL(head.length)}1`, [head]); rows = [head];
  }
  if (!rows.length) { await sheet().write(`${tab}!A1:${colL(head.length)}1`, [head]); rows = [head]; }
  const hd = rows[0].map(String);
  return rows.slice(1).filter((r) => r.some((x) => x !== '' && x != null)).map((r) => Object.fromEntries(hd.map((k, i) => [k, r[i] ?? ''])));
}
async function writeTab(tab, head, list, oldCount) {
  const cell = (v) => (v === undefined || v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const n = Math.max(list.length, oldCount) + 1;
  const rows = [head, ...list.map((o) => head.map((k) => cell(o[k])))];
  while (rows.length < n) rows.push(head.map(() => ''));
  await sheet().write(`${tab}!A1:${colL(head.length)}${rows.length}`, rows);
}

let SET = null; // Map key → settings
export async function loadSettings(force = false) {
  if (SET && !force) return SET;
  const list = await readTab(SET_TAB, SET_HEAD);
  SET = new Map(list.map((o) => { let s = {}; try { s = JSON.parse(o.settings || '{}'); } catch { s = {}; } return [String(o.key), s]; }));
  return SET;
}
export const settingsCached = () => SET;

/** ההגדרות האפקטיביות של קמפיין (c מ-campaigns.js): ברירת מחדל ← סדרה ← שנה/קמפיין. */
export function settingsOf(c) {
  const ser = c.kind === 'yearly' ? (SET?.get(c.series) || {}) : {};
  const own = SET?.get(c.name) || {};
  const s = { ...DEFAULTS, ...ser, ...own };
  s.match = { ...DEFAULTS.match, ...(ser.match || {}), ...(own.match || {}) };
  s.extras = { ...DEFAULTS.extras, ...(ser.extras || {}), ...(own.extras || {}) };
  if (!s.name_he) s.name_he = c.name;
  return s;
}

async function saveSettingsFor(key, scope, obj) {
  const list = await readTab(SET_TAB, SET_HEAD);
  const old = list.length;
  const rest = list.filter((o) => String(o.key) !== key);
  rest.push({ key, scope, settings: JSON.stringify(obj), updated_at: stamp(), updated_by: state.email });
  await writeTab(SET_TAB, SET_HEAD, rest, old);
  await loadSettings(true);
}

/** מי רשאי לשנות הגדרות: מנהל, או גבאי שאחראי על הקמפיין (אם לא הוגדרו אחראים — כל גבאי). */
export function canManage(c) {
  if (state.isAdmin) return true;
  const g = settingsOf(c).gabbaim || [];
  return !g.length || g.includes(state.email);
}

// ---------- שלב 1: חלון הגדרות ----------
const methodsAll = () => state.lists?.payment_method || ['מזומן', 'צ\'ק', 'כרטיס אשראי', 'Zelle', 'OJC', 'Donors Fund', 'Matbia', 'אחר'];

export async function openCampSettings(c, { toast = () => {}, after = () => {} } = {}) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg wc-dlg cx-dlg'; dlg.dir = 'rtl';
  dlg.innerHTML = '<p class="muted">טוען…</p>';
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  try { await loadSettings(true); } catch (err) { dlg.innerHTML = `<button type="button" class="x-close">✕</button><p>❌ ${h(err.message || err)}</p>`; $('.x-close', dlg).onclick = close; return; }
  const isY = c.kind === 'yearly';
  let level = isY ? 'series' : 'own'; // שנתי: ברירת המחדל היא הגדרה לכל השנים
  const users = allUsers();
  const row = state.campaigns.find((x) => x.campaign === c.name) || {};
  const draw = () => {
    const base = level === 'series' ? { ...DEFAULTS, ...(SET.get(c.series) || {}) } : settingsOf(c);
    const s = { ...base, match: { ...DEFAULTS.match, ...(base.match || {}) }, extras: { ...DEFAULTS.extras, ...(base.extras || {}) } };
    if (!s.name_he) s.name_he = level === 'series' ? c.series : c.name;
    if (!s.goods_desc && row.goods_desc) s.goods_desc = row.goods_desc;
    if (s.goods_value === '' && row.goods_value !== undefined && row.goods_value !== '') s.goods_value = row.goods_value;
    const chk = (n, v, lab) => `<label class="wc-chk"><input type="checkbox" name="${n}"${v ? ' checked' : ''}> ${h(lab)}</label>`;
    const inp = (n, lab, v, type = 'text', ltr = false) => `<label>${h(lab)}<input name="${n}" type="${type}" value="${h(v ?? '')}"${ltr ? ' dir="ltr"' : ''}></label>`;
    const tierRow = (t = {}) => `<tr><td><input data-k="name" value="${h(t.name)}" placeholder="למשל: שטר / רגיל / VIP"></td><td><input data-k="suggested" type="number" min="0" value="${h(t.suggested)}" style="width:110px"></td><td><button type="button" class="btn ghost" data-del>✕</button></td></tr>`;
    dlg.innerHTML = `<button type="button" class="x-close">✕</button>
      <h3>⚙ הגדרות קמפיין — ${h(c.name)}</h3>
      ${isY ? `<div class="cx-level"><button type="button" data-lv="series" class="${level === 'series' ? 'on' : ''}">🔁 לכל השנים של "${h(c.series)}"</button><button type="button" data-lv="own" class="${level === 'own' ? 'on' : ''}">רק לשנת ${h(c.year)}</button></div>
        <p class="muted small">${level === 'series' ? 'מה שנקבע כאן עובר אוטומטית לכל שנה חדשה.' : 'מה שנקבע כאן דורס את ההגדרות הכלליות רק לשנה הזאת.'}</p>` : ''}
      <form class="cx-form">
        <details open><summary>כללי</summary><div class="wc-grid">
          ${inp('name_he', 'שם — עברית', s.name_he)}${inp('name_yi', 'שם — אידיש', s.name_yi)}${inp('name_en', 'Name — English', s.name_en, 'text', true)}
          <label>סוג<select name="type">${TYPES.map(([k, l]) => `<option value="${k}"${s.type === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>
          ${inp('start_date', 'תאריך התחלה', s.start_date, 'date')}${inp('end_date', 'תאריך סיום', s.end_date, 'date')}
          ${inp('event_date', 'תאריך האירוע (אם יש)', s.event_date, 'date')}
          ${level !== 'series' ? inp('goal', 'יעד ($)', c.goal || '', 'number') : ''}
          <label>שנים אחורה ברשימת המוזמנים<input name="years_back" type="number" min="0" max="10" value="${h(s.years_back)}"></label>
        </div></details>
        <details><summary>כסף: לאן נכנס, סליקה, שווי</summary><div class="wc-grid">
          <label>הישות המשפטית<input name="entity" list="cx-ent" value="${h(s.entity)}"><datalist id="cx-ent">${ENTITIES.map((e) => `<option value="${h(e.name)}">`).join('')}</datalist></label>
          ${inp('ein', 'EIN', s.ein, 'text', true)}
          <label>סליקה<select name="processor"><option value="sola"${s.processor === 'sola' ? ' selected' : ''}>Sola</option><option value="stripe"${s.processor === 'stripe' ? ' selected' : ''}>Stripe</option><option value="none"${s.processor === 'none' ? ' selected' : ''}>בלי סליקה</option></select></label>
          ${inp('goods_desc', 'מה התורם מקבל (לקבלה)', s.goods_desc)}${inp('goods_value', 'שווי מה שמקבל ($ לתרומה)', s.goods_value, 'number')}
          ${inp('fee_pct', 'עמלה מוצעת לתורם (%)', s.fee_pct, 'number')}
          ${chk('recurring', s.recurring, 'לאפשר הוראת קבע')}${chk('fee', s.fee, 'להציע לתורם לכסות עמלה')}
        </div>
        <p class="lbl-s">אמצעי תשלום בקמפיין (ריק = הכל)</p>
        <div class="cx-chips">${methodsAll().map((m) => `<label><input type="checkbox" name="methods" value="${h(m)}"${(s.methods || []).includes(m) ? ' checked' : ''}> ${h(m)}</label>`).join('')}</div></details>
        <details><summary>דרגות וסכום מוצע</summary>
          <p class="muted small">כל מוזמן משויך לדרגה; הסכום המוצע נכנס למכתבים ({suggested}). אפשר לשנות סכום לאדם ספציפי ברשימת המוזמנים.</p>
          <table class="ms-table cx-tiers"><thead><tr><th>דרגה</th><th>סכום מוצע ($)</th><th></th></tr></thead><tbody>${(s.tiers || []).map(tierRow).join('')}</tbody></table>
          <p><button type="button" class="btn" data-addtier>+ דרגה</button></p></details>
        <details><summary>אחראים, הרשאות והתראות</summary>
          <p class="muted small">גבאים אחראים — רק הם (ומנהלים) יכולים לשנות הגדרות, והם מקבלים שיחות בחלוקה. ריק = כל הגבאים.</p>
          <div class="cx-chips">${users.map((u) => `<label><input type="checkbox" name="gabbaim" value="${h(u.email)}"${(s.gabbaim || []).includes(u.email) ? ' checked' : ''}> ${h(u.name)}</label>`).join('')}</div>
          <p class="lbl-s">התראה על תרומה חדשה מהאתר (מופיעה כשנכנסים למערכת)</p>
          <div class="cx-chips">${users.map((u) => `<label><input type="checkbox" name="notify" value="${h(u.email)}"${(s.notify || []).includes(u.email) ? ' checked' : ''}> ${h(u.name)}</label>`).join('')}</div></details>
        <details><summary>קבלה ומכתב תודה</summary><div class="wc-grid">
          ${chk('receipt_auto', s.receipt_auto, 'לשלוח קבלה אוטומטית לתורמים מהאתר')}
          <label style="grid-column:1/-1">נוסח מכתב (אפשר: {name} {amount} {campaign} {last_year} {suggested})<textarea name="letter" rows="4">${h(s.letter)}</textarea></label>
        </div></details>
        <details><summary>אירוע: התאמה (Matching), ז'ורנל, הושבה, כרטיסים</summary><div class="wc-grid">
          ${chk('match_on', s.match.on, 'יש תורם מכפיל (Matching)')}
          ${inp('match_mult', 'מכפיל (למשל 2 = כל דולר כפול)', s.match.mult, 'number')}
          ${inp('match_sponsor', 'שם המכפיל (לתצוגה)', s.match.sponsor)}
          ${inp('match_cap', 'תקרת ההכפלה ($)', s.match.cap, 'number')}
          ${chk('ex_journal', s.extras.journal, 'ז\'ורנל (מודעות)')}${chk('ex_seating', s.extras.seating, 'הושבה (מספר שולחן)')}${chk('ex_tickets', s.extras.tickets, 'כרטיסים')}
        </div></details>
        <p id="cx-msg" class="muted"></p>
        <p class="wc-acts"><button type="submit" class="btn primary">שמירה</button><button type="button" class="btn ghost" data-close>סגירה</button></p>
      </form>`;
    $('.x-close', dlg).onclick = close; $('[data-close]', dlg).onclick = close;
    $$('[data-lv]', dlg).forEach((b) => { b.onclick = () => { level = b.dataset.lv; draw(); }; });
    const tb = $('.cx-tiers tbody', dlg);
    $('[data-addtier]', dlg).onclick = () => tb.insertAdjacentHTML('beforeend', tierRow());
    tb.addEventListener('click', (e) => { if (e.target.closest('[data-del]')) e.target.closest('tr').remove(); });
    const form = $('form', dlg);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = form.elements; const msg = $('#cx-msg', dlg);
      const vals = (n) => $$(`input[name="${n}"]:checked`, form).map((x) => x.value);
      const tiers = $$('tr', tb).map((tr, i) => ({ id: `t${i + 1}`, name: $('[data-k=name]', tr).value.trim(), suggested: Number($('[data-k=suggested]', tr).value) || 0 })).filter((x) => x.name);
      const obj = {
        name_he: f.name_he.value.trim(), name_yi: f.name_yi.value.trim(), name_en: f.name_en.value.trim(), type: f.type.value,
        start_date: f.start_date.value, end_date: f.end_date.value, event_date: f.event_date.value, years_back: Number(f.years_back.value) || 0,
        entity: f.entity.value.trim(), ein: f.ein.value.trim(), processor: f.processor.value, goods_desc: f.goods_desc.value.trim(),
        goods_value: f.goods_value.value === '' ? '' : Number(f.goods_value.value), fee_pct: Number(f.fee_pct.value) || 0,
        recurring: f.recurring.checked, fee: f.fee.checked, methods: vals('methods'), tiers, gabbaim: vals('gabbaim'), notify: vals('notify'),
        receipt_auto: f.receipt_auto.checked, letter: f.letter.value,
        match: { on: f.match_on.checked, mult: Number(f.match_mult.value) || 2, sponsor: f.match_sponsor.value.trim(), cap: f.match_cap.value === '' ? '' : Number(f.match_cap.value) },
        extras: { journal: f.ex_journal.checked, seating: f.ex_seating.checked, tickets: f.ex_tickets.checked },
      };
      const ent = ENTITIES.find((x) => x.name === obj.entity);
      if (ent && !obj.ein) obj.ein = ent.ein;
      msg.textContent = 'שומר…';
      try {
        await saveSettingsFor(level === 'series' ? c.series : c.name, level === 'series' ? 'series' : 'campaign', obj);
        // יעד ושווי — גם בשורת הקמפיין (הקבלות והלוח קוראים משם)
        if (level !== 'series') {
          const goal = f.goal?.value === '' ? '' : Number(f.goal?.value || 0);
          const base = c.kind === 'yearly' ? { campaign: c.name, series: c.series, year: c.year, kind: 'yearly' } : { campaign: c.name, series: c.series, year: c.year, kind: 'once', org: c.org };
          await saveCampaign({ ...base, goal, goods_desc: obj.goods_desc, goods_value: obj.goods_value });
          await loadAll();
        }
        msg.textContent = '✅ נשמר'; toast('✅ הגדרות הקמפיין נשמרו'); after();
      } catch (err) { msg.textContent = `❌ ${err.message || err}`; }
    };
  };
  draw();
}

// ---------- שלב 2: מוזמנים ומעקב ----------
const nameOf = (c) => [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ').trim() || [c.title_en, c.first_name_en, c.last_name_en].filter(Boolean).join(' ').trim();
const contactById = (id) => state.contacts.find((x) => String(x.contact_id) === String(id));
const phoneOf = (id) => { const p = state.phones.get(String(id)) || {}; return p.mobile || p.home_phone || p.wife_mobile || ''; };
const emailOf = (id) => (state.phones.get(String(id)) || {}).email_1 || '';
const addrOf = (c) => [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ');
const keyOf = (x) => (x.contact_id ? `c:${x.contact_id}` : `n:${String(x.name || x.donor_name || '').trim()}`);
const dKey = (d) => (d.contact_id ? `c:${d.contact_id}` : `n:${String(d.donor_name || '').trim()}`);
export const STATUS = { invited: 'הוזמן', pledged: 'הבטיח', paid: 'שילם', partial: 'שילם חלק', declined: 'סירב', skip: 'לא לפנות' };

/** שמות הקמפיינים של השנים הקודמות (לסדרה שנתית) */
function prevNames(c, n) {
  if (c.kind !== 'yearly' || !n) return [];
  const y = yearFromLabel(c.year);
  return Array.from({ length: n }, (_, i) => ({ year: yearLabel(y - i - 1), name: `${c.series} ${yearLabel(y - i - 1)}` }));
}
function sums(names) {
  const set = new Set(names); const m = new Map();
  state.donations.forEach((d) => {
    if (!set.has(d.campaign)) return;
    const k = `${d.campaign}|${dKey(d)}`;
    const o = m.get(k) || { total: 0, paid: 0 };
    o.total += Number(d.amount_usd || 0); if (isTrue(d.is_paid)) o.paid += Number(d.amount_usd || 0);
    m.set(k, o);
  });
  return m;
}
/** סטטוס אוטומטי לפי התרומות השנה (אם יש דריסה ידנית — היא קובעת) */
export function autoStatus(cur) {
  if (!cur || !cur.total) return 'invited';
  if (cur.paid >= cur.total) return 'paid';
  return cur.paid > 0 ? 'partial' : 'pledged';
}

let INV = null; // { campaign, rows, oldCount, all }
async function loadInvites(campaign) {
  const all = await readTab(INV_TAB, INV_HEAD);
  INV = { campaign, all, oldCount: all.length, rows: all.filter((o) => o.campaign === campaign) };
  return INV.rows;
}
async function saveInvites(campaign, rows) {
  const fresh = await readTab(INV_TAB, INV_HEAD);
  const rest = fresh.filter((o) => o.campaign !== campaign);
  let next = Math.max(0, ...fresh.map((o) => Number(o.inv_id) || 0)) + 1;
  const at = stamp();
  rows.forEach((r) => { if (!r.inv_id) r.inv_id = next++; r.campaign = campaign; if (!r.updated_at) { r.updated_at = at; r.updated_by = state.email; } });
  await writeTab(INV_TAB, INV_HEAD, [...rest, ...rows], fresh.length);
  INV = { campaign, all: [...rest, ...rows], oldCount: rest.length + rows.length, rows };
}
export async function invitesOf(campaign) { return (INV && INV.campaign === campaign) ? INV.rows : loadInvites(campaign); }

/** לוח המוזמנים של קמפיין */
export async function openInvites(c, { toast = () => {}, openCard = null, startTab = 'all' } = {}) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg cx-inv'; dlg.dir = 'rtl';
  dlg.innerHTML = '<p class="muted">טוען את רשימת המוזמנים…</p>';
  document.body.append(dlg); dlg.showModal();
  let dirty = false;
  const close = () => { if (dirty && !confirm('יש שינויים שלא נשמרו. לסגור בכל זאת?')) return; dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  let rows;
  try { await loadSettings(); rows = (await loadInvites(c.name)).map((r) => ({ ...r })); } catch (err) { dlg.innerHTML = `<button type="button" class="x-close">✕</button><p>❌ ${h(err.message || err)}</p>`; $('.x-close', dlg).onclick = () => { dlg.close(); dlg.remove(); }; return; }
  const S = settingsOf(c);
  const tiers = S.tiers || [];
  const tierSug = (id) => Number(tiers.find((t) => t.id === id)?.suggested || 0);
  const prev = prevNames(c, Math.max(1, Number(S.years_back) || 0));
  const allNames = [c.name, ...prev.map((p) => p.name)];
  const gab = allUsers().filter((u) => !(S.gabbaim || []).length || (S.gabbaim || []).includes(u.email));
  const gName = (e) => allUsers().find((u) => u.email === e)?.name || e;
  let filter = startTab; let tierF = ''; let gabF = ''; let q = '';
  const sel = new Set();

  const enrich = () => {
    const m = sums(allNames);
    return rows.map((r) => {
      const k = keyOf(r);
      const cur = m.get(`${c.name}|${k}`);
      const hist = prev.map((p) => m.get(`${p.name}|${k}`)?.total || 0);
      const auto = autoStatus(cur);
      const status = r.status_manual || auto;
      const sug = r.suggested !== '' && r.suggested != null ? Number(r.suggested) : tierSug(r.tier);
      return { r, k, cur: cur?.total || 0, paid: cur?.paid || 0, hist, last: hist[0] || 0, auto, status, sug };
    });
  };
  const match = (x) => {
    if (tierF && x.r.tier !== tierF) return false;
    if (gabF && x.r.assigned_to !== gabF) return false;
    if (q && !`${x.r.name} ${x.r.phone}`.toLowerCase().includes(q)) return false;
    switch (filter) {
      case 'not': return x.cur === 0 && !['declined', 'skip'].includes(x.status);
      case 'open': return ['pledged', 'partial'].includes(x.status);
      case 'paid': return x.status === 'paid';
      case 'less': return x.last > 0 && x.cur < x.last;
      case 'mine': return x.r.assigned_to === state.email;
      default: return true;
    }
  };
  const draw = () => {
    const list = enrich();
    const shown = list.filter(match);
    const tot = (f) => list.filter(f).length;
    const sumCur = list.reduce((s, x) => s + x.cur, 0); const sumLast = list.reduce((s, x) => s + x.last, 0);
    const extraCols = S.extras.seating;
    const scroll = $('.cx-tbl-wrap', dlg)?.scrollTop || 0;
    dlg.innerHTML = `<button type="button" class="x-close">✕</button>
      <div class="cx-head"><h3>📋 מוזמנים ומעקב — ${h(c.name)}</h3>
        <span class="muted small">${list.length} מוזמנים · השנה ${money(sumCur)}${prev.length ? ` · ${h(prev[0].year)}: ${money(sumLast)}` : ''}</span></div>
      <div class="cx-tools">
        <button type="button" class="btn" data-a="add">+ איש קשר</button>
        <button type="button" class="btn" data-a="ext">+ מישהו שלא באנשי קשר</button>
        <button type="button" class="btn" data-a="fromlist">ייבוא מרשימה שמורה</button>
        ${prev.length ? `<button type="button" class="btn" data-a="fromprev">ייבוא תורמי ${h(prev[0].year)}</button><button type="button" class="btn" data-a="copyprev">העתקת מוזמני ${h(prev[0].year)}</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-a="xl">Excel (למיזוג)</button>
        <button type="button" class="btn" data-a="savelist">שמירה כרשימה (ל-SMS / מכתבים)</button>
        <button type="button" class="btn primary" data-a="save"${dirty ? '' : ' disabled'}>💾 שמירה${dirty ? ' *' : ''}</button>
      </div>
      <div class="cx-filters">
        ${[['all', 'הכל', list.length], ['not', 'לא תרמו עדיין', tot((x) => x.cur === 0 && !['declined', 'skip'].includes(x.status))], ['open', 'הבטיחו ולא שילמו', tot((x) => ['pledged', 'partial'].includes(x.status))], ['paid', 'שילמו', tot((x) => x.status === 'paid')], ['less', 'נתנו פחות משנה שעברה', tot((x) => x.last > 0 && x.cur < x.last)], ['mine', 'השיחות שלי', tot((x) => x.r.assigned_to === state.email)]]
    .map(([k, l, n]) => `<button type="button" class="cx-f${filter === k ? ' on' : ''}" data-f="${k}">${h(l)} <b>${n}</b></button>`).join('')}
        <select data-tierf><option value="">כל הדרגות</option>${tiers.map((t) => `<option value="${h(t.id)}"${tierF === t.id ? ' selected' : ''}>${h(t.name)}</option>`).join('')}</select>
        <select data-gabf><option value="">כל הגבאים</option>${gab.map((u) => `<option value="${h(u.email)}"${gabF === u.email ? ' selected' : ''}>${h(u.name)}</option>`).join('')}</select>
        <input data-q placeholder="חיפוש…" value="${h(q)}">
      </div>
      <div class="cx-bulk"${sel.size ? '' : ' hidden'}><b>${sel.size} נבחרו:</b>
        <select data-bulk-gab><option value="">שיוך לגבאי…</option>${gab.map((u) => `<option value="${h(u.email)}">${h(u.name)}</option>`).join('')}<option value="-">— ללא —</option></select>
        <select data-bulk-tier><option value="">דרגה…</option>${tiers.map((t) => `<option value="${h(t.id)}">${h(t.name)}</option>`).join('')}</select>
        <button type="button" class="btn small-btn" data-a="bulkdel">הסרה מהרשימה</button></div>
      <p class="cx-auto"><button type="button" class="btn small-btn" data-a="split">📞 חלוקת הלא-משויכים שלא תרמו בין ${gab.length} גבאים</button></p>
      <div class="cx-tbl-wrap"><table class="ms-table cx-tbl"><thead><tr>
        <th><input type="checkbox" data-all></th><th>שם</th><th>טלפון</th><th>דרגה</th><th>מוצע</th>
        ${prev.map((p) => `<th>${h(p.year)}</th>`).join('')}<th>השנה</th><th>סטטוס</th><th>גבאי</th>${extraCols ? '<th>שולחן</th>' : ''}<th>הערה</th><th></th></tr></thead>
        <tbody>${shown.map((x) => {
    const i = rows.indexOf(x.r);
    const up = x.last && x.cur ? (x.cur >= x.last ? 'up' : 'down') : '';
    return `<tr data-i="${i}" class="st-${x.status}">
          <td><input type="checkbox" data-sel${sel.has(i) ? ' checked' : ''}></td>
          <td>${x.r.contact_id ? `<a href="#" data-card="${h(x.r.contact_id)}">${h(x.r.name)}</a>` : `${h(x.r.name)} <span class="badge muted">חיצוני</span>`}</td>
          <td dir="ltr">${x.r.phone ? `<a href="tel:${h(String(x.r.phone).replace(/[^\d+]/g, ''))}">${h(x.r.phone)}</a>` : ''}</td>
          <td><select data-k="tier"><option value=""></option>${tiers.map((t) => `<option value="${h(t.id)}"${x.r.tier === t.id ? ' selected' : ''}>${h(t.name)}</option>`).join('')}</select></td>
          <td><input data-k="suggested" type="number" min="0" value="${h(x.r.suggested)}" placeholder="${x.sug || ''}" class="cx-num"></td>
          ${x.hist.map((v) => `<td class="num" dir="ltr">${v ? money(v) : ''}</td>`).join('')}
          <td class="num ${up}" dir="ltr">${x.cur ? money(x.cur) : ''}</td>
          <td><select data-k="status_manual" title="אוטומטי: ${h(STATUS[x.auto])}"><option value="">${h(STATUS[x.auto])} (אוטו׳)</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${x.r.status_manual === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></td>
          <td><select data-k="assigned_to"><option value=""></option>${gab.map((u) => `<option value="${h(u.email)}"${x.r.assigned_to === u.email ? ' selected' : ''}>${h(u.name)}</option>`).join('')}${x.r.assigned_to && !gab.some((u) => u.email === x.r.assigned_to) ? `<option selected value="${h(x.r.assigned_to)}">${h(gName(x.r.assigned_to))}</option>` : ''}</select></td>
          ${extraCols ? `<td><input data-k="table_no" value="${h(x.r.table_no)}" class="cx-num"></td>` : ''}
          <td><input data-k="note" value="${h(x.r.note)}"></td>
          <td><button type="button" class="btn small-btn" data-don>+ תרומה</button></td></tr>`;
  }).join('') || `<tr><td colspan="20" class="empty">${rows.length ? 'אין תוצאות בסינון הזה' : 'עדיין אין מוזמנים — הוסיפו מאנשי קשר, מרשימה שמורה, או מתורמי השנה שעברה.'}</td></tr>`}</tbody></table></div>`;
    const w = $('.cx-tbl-wrap', dlg); if (w) w.scrollTop = scroll;
    wire(shown);
  };
  const mark = () => { dirty = true; const b = $('[data-a=save]', dlg); if (b) { b.disabled = false; b.textContent = '💾 שמירה *'; } };
  const addContact = (cid) => {
    const ct = contactById(cid); if (!ct) return false;
    if (rows.some((r) => String(r.contact_id) === String(cid))) return false;
    rows.push({ inv_id: '', campaign: c.name, contact_id: String(cid), name: nameOf(ct), phone: phoneOf(cid), email: emailOf(cid), address: addrOf(ct), tier: '', suggested: '', status_manual: '', assigned_to: '', table_no: '', note: '' });
    return true;
  };
  const wire = (shown) => {
    $('.x-close', dlg).onclick = close;
    $$('[data-f]', dlg).forEach((b) => { b.onclick = () => { filter = b.dataset.f; draw(); }; });
    $('[data-tierf]', dlg).onchange = (e) => { tierF = e.target.value; draw(); };
    $('[data-gabf]', dlg).onchange = (e) => { gabF = e.target.value; draw(); };
    const qi = $('[data-q]', dlg); qi.oninput = () => { q = qi.value.trim().toLowerCase(); clearTimeout(qi._t); qi._t = setTimeout(() => { draw(); const n = $('[data-q]', dlg); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    $('[data-all]', dlg).onchange = (e) => { shown.forEach((x) => { const i = rows.indexOf(x.r); if (e.target.checked) sel.add(i); else sel.delete(i); }); draw(); };
    const tb = $('.cx-tbl tbody', dlg);
    tb.addEventListener('change', (e) => {
      const tr = e.target.closest('tr[data-i]'); if (!tr) return;
      const r = rows[Number(tr.dataset.i)];
      if (e.target.matches('[data-sel]')) { if (e.target.checked) sel.add(Number(tr.dataset.i)); else sel.delete(Number(tr.dataset.i)); draw(); return; }
      const k = e.target.dataset.k; if (!k) return;
      r[k] = e.target.value; mark();
      if (k === 'tier' || k === 'status_manual') draw();
    });
    tb.addEventListener('click', (e) => {
      const a = e.target.closest('[data-card]');
      if (a) { e.preventDefault(); openCard?.(a.dataset.card); return; }
      const d = e.target.closest('[data-don]');
      if (d) {
        const r = rows[Number(d.closest('tr').dataset.i)];
        if (r.contact_id) openDonationForm({ campaign: c.name }, r.contact_id);
        else openDonationForm({ campaign: c.name, donor_name: r.name });
      }
    });
    $('[data-bulk-gab]', dlg).onchange = (e) => { const v = e.target.value === '-' ? '' : e.target.value; sel.forEach((i) => { rows[i].assigned_to = v; }); sel.clear(); mark(); draw(); };
    $('[data-bulk-tier]', dlg).onchange = (e) => { sel.forEach((i) => { rows[i].tier = e.target.value; }); sel.clear(); mark(); draw(); };
    $$('[data-a]', dlg).forEach((b) => { b.onclick = () => act(b.dataset.a); });
  };
  const act = async (a) => {
    if (a === 'save') {
      const b = $('[data-a=save]', dlg); b.disabled = true; b.textContent = 'שומר…';
      try { await saveInvites(c.name, rows); dirty = false; toast(`✅ נשמרו ${rows.length} מוזמנים`); draw(); } catch (err) { toast(`❌ ${err.message || err}`); b.disabled = false; b.textContent = '💾 שמירה *'; }
    } else if (a === 'add') {
      pickContacts((ids) => { let n = 0; ids.forEach((id) => { if (addContact(id)) n += 1; }); if (n) { mark(); draw(); toast(`נוספו ${n}`); } });
    } else if (a === 'ext') {
      const name = prompt('שם (כפי שיופיע במכתב):'); if (!name?.trim()) return;
      const phone = prompt('טלפון (לא חובה):') || ''; const email = prompt('אימייל (לא חובה):') || '';
      rows.push({ inv_id: '', campaign: c.name, contact_id: '', name: name.trim(), phone: phone.trim(), email: email.trim(), address: '', tier: '', suggested: '', status_manual: '', assigned_to: '', table_no: '', note: '' });
      mark(); draw();
    } else if (a === 'fromlist') {
      const lists = state.savedLists.filter((l) => String(l.name || '').trim());
      const pick = await choose('ייבוא מרשימה שמורה', lists.map((l) => [l.list_id, l.name]));
      if (!pick) return;
      const { listById, evaluate, parseSaved } = await import('./lists.js');
      const l = listById(pick); const { cr } = parseSaved(l);
      let n = 0;
      evaluate(cr).forEach((r) => {
        if (!r.ext) { if (addContact(r.c.contact_id)) n += 1; return; }
        const nm = nameOf(r.c); if (!nm || rows.some((x) => !x.contact_id && x.name === nm)) return;
        rows.push({ inv_id: '', campaign: c.name, contact_id: '', name: nm, phone: r.c._phones?.mobile || '', email: r.c._phones?.email_1 || '', address: addrOf(r.c), tier: '', suggested: '', status_manual: '', assigned_to: '', table_no: '', note: '' }); n += 1;
      });
      mark(); draw(); toast(`נוספו ${n} מהרשימה "${l.name}"`);
    } else if (a === 'fromprev') {
      let n = 0; const seen = new Set();
      state.donations.filter((d) => d.campaign === prev[0].name).forEach((d) => {
        const k = dKey(d); if (seen.has(k)) return; seen.add(k);
        if (d.contact_id) { if (addContact(d.contact_id)) n += 1; } else if (d.donor_name && !rows.some((r) => !r.contact_id && r.name === d.donor_name)) { rows.push({ inv_id: '', campaign: c.name, contact_id: '', name: donorName(d), phone: '', email: '', address: '', tier: '', suggested: '', status_manual: '', assigned_to: '', table_no: '', note: '' }); n += 1; }
      });
      mark(); draw(); toast(`נוספו ${n} תורמים מ-${prev[0].year}`);
    } else if (a === 'copyprev') {
      const old = (await readTab(INV_TAB, INV_HEAD)).filter((o) => o.campaign === prev[0].name);
      if (!old.length) { toast(`אין רשימת מוזמנים שמורה ל-${prev[0].year}`); return; }
      let n = 0;
      old.forEach((o) => {
        if (o.contact_id ? rows.some((r) => String(r.contact_id) === String(o.contact_id)) : rows.some((r) => !r.contact_id && r.name === o.name)) return;
        rows.push({ ...o, inv_id: '', campaign: c.name, status_manual: o.status_manual === 'skip' ? 'skip' : '', table_no: '', note: '' }); n += 1;
      });
      mark(); draw(); toast(`הועתקו ${n} מוזמנים (כולל דרגות וגבאים) מ-${prev[0].year}`);
    } else if (a === 'bulkdel') {
      if (!confirm(`להסיר ${sel.size} מהרשימה? (התרומות שלהם לא נמחקות)`)) return;
      rows = rows.filter((_, i) => !sel.has(i)); sel.clear(); mark(); draw();
    } else if (a === 'split') {
      const list = enrich().filter((x) => !x.r.assigned_to && x.cur === 0 && !['declined', 'skip'].includes(x.status));
      if (!list.length || !gab.length) { toast('אין מה לחלק'); return; }
      if (!confirm(`לחלק ${list.length} שיחות בין ${gab.length} גבאים באופן שווה?`)) return;
      list.forEach((x, i) => { x.r.assigned_to = gab[i % gab.length].email; }); mark(); draw();
    } else if (a === 'xl') {
      const list = enrich().filter(match);
      const head = ['name', 'phone', 'email', 'address', 'tier', 'suggested', ...prev.map((p, i) => (i === 0 ? 'last_year' : `year_${p.year}`)), 'this_year', 'status', 'gabbai', 'table', 'note'];
      downloadXlsx(`מוזמנים ${c.name}`, head, list.map((x) => [x.r.name, x.r.phone, x.r.email, x.r.address, tiers.find((t) => t.id === x.r.tier)?.name || '', x.sug || '', ...x.hist, x.cur, STATUS[x.status], gName(x.r.assigned_to), x.r.table_no, x.r.note]), { sheet: 'invites' });
    } else if (a === 'savelist') {
      const list = enrich().filter(match).filter((x) => x.r.contact_id);
      if (!list.length) { toast('אין אנשי קשר בסינון הזה'); return; }
      const label = { all: 'כולם', not: 'לא תרמו', open: 'הבטיחו ולא שילמו', paid: 'שילמו - תודה', less: 'פחות משנה שעברה', mine: 'השיחות שלי' }[filter];
      const name = prompt('שם הרשימה:', `${c.name} — ${label}`); if (!name?.trim()) return;
      const cr = { v: 2, base: '', add: list.map((x) => ({ id: String(x.r.contact_id) })), includeDeceased: false, meta: { note: `נוצר מלוח המוזמנים של ${c.name}`, firstTab: 'names', camp: { campaign: c.name, filter } } };
      try { await saveSavedList({ name: name.trim(), criteria: JSON.stringify(cr), columns: '', scope: '', visibility: 'public' }); await loadAll(); toast(`✅ הרשימה "${name.trim()}" נשמרה (${list.length}) — אפשר לשלוח לה SMS או מכתב`); } catch (err) { toast(`❌ ${err.message || err}`); }
    }
  };
  draw();
}

/** חלון קטן לבחירה מתוך רשימה */
function choose(title, items) {
  return new Promise((res) => {
    const d = document.createElement('dialog'); d.className = 'sheet lx-dlg'; d.dir = 'rtl';
    d.innerHTML = `<h3>${h(title)}</h3><input data-q placeholder="חיפוש…" style="width:100%"><div class="cx-pick">${items.map(([v, l]) => `<button type="button" class="btn" data-v="${h(v)}">${h(l)}</button>`).join('')}</div><p><button type="button" class="btn ghost" data-x>ביטול</button></p>`;
    document.body.append(d); d.showModal();
    const done = (v) => { d.close(); d.remove(); res(v); };
    $('[data-x]', d).onclick = () => done(null);
    $('[data-q]', d).oninput = (e) => { const s = e.target.value.trim(); $$('[data-v]', d).forEach((b) => { b.hidden = s && !b.textContent.includes(s); }); };
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v); });
  });
}

/** בחירת אנשי קשר לפי חיפוש (שם / טלפון) */
function pickContacts(cb) {
  const d = document.createElement('dialog'); d.className = 'sheet lx-dlg'; d.dir = 'rtl';
  d.innerHTML = '<h3>הוספת אנשי קשר</h3><input data-q placeholder="שם או טלפון…" style="width:100%" autofocus><div class="cx-pick" data-res></div><p><button type="button" class="btn primary" data-ok>הוספה</button> <button type="button" class="btn ghost" data-x>סגירה</button> <span class="muted" data-n></span></p>';
  document.body.append(d); d.showModal();
  const picked = new Set();
  const res = $('[data-res]', d);
  const find = (s) => {
    const dg = s.replace(/\D/g, '');
    return state.contacts.filter((c) => {
      if (dg.length >= 4) { const p = state.phones.get(String(c.contact_id)) || {}; return ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].some((k) => String(p[k] || '').replace(/\D/g, '').includes(dg)); }
      const n = `${nameOf(c)} ${c.first_name_en || ''} ${c.last_name_en || ''}`;
      return s.split(/\s+/).every((w) => n.includes(w));
    }).slice(0, 40);
  };
  $('[data-q]', d).oninput = (e) => {
    const s = e.target.value.trim();
    res.innerHTML = s.length < 2 ? '' : find(s).map((c) => `<button type="button" class="btn${picked.has(String(c.contact_id)) ? ' on' : ''}" data-id="${h(c.contact_id)}">${h(nameOf(c))} <small class="muted">${h(c.city || '')}</small></button>`).join('');
  };
  res.onclick = (e) => { const b = e.target.closest('[data-id]'); if (!b) return; const id = b.dataset.id; if (picked.has(id)) picked.delete(id); else picked.add(id); b.classList.toggle('on'); $('[data-n]', d).textContent = picked.size ? `${picked.size} נבחרו` : ''; };
  $('[data-ok]', d).onclick = () => { cb([...picked]); d.close(); d.remove(); };
  $('[data-x]', d).onclick = () => { d.close(); d.remove(); };
}

// ---------- השוואה לשנה שעברה + התראות ----------
/** סיכום מהיר לראש דף הקמפיין */
export function invitesSummaryHtml(c) {
  const n = INV && INV.campaign === c.name ? INV.rows.length : null;
  return n == null ? '' : `<span class="muted small">· ${n} מוזמנים</span>`;
}

/** תרומות חדשות מהאתר בקמפיינים שבהם המשתמש ברשימת ההתראות — מוצג פעם אחת */
export async function checkCampNotices(toast) {
  try {
    await loadSettings();
    const key = `campNotice:${state.email}`;
    let last = ''; try { last = localStorage.getItem(key) || ''; } catch { /* */ }
    const mine = [...SET.entries()].filter(([, s]) => (s.notify || []).includes(state.email)).map(([k]) => k);
    if (!mine.length) return;
    const isMine = (name) => mine.some((k) => name === k || name.startsWith(`${k} `));
    const at = (v) => { if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v || ''))) return new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000).toISOString().slice(0, 16).replace('T', ' '); return String(v || ''); };
    const fresh = state.donations.filter((d) => d.created_by === 'ungvar.org' && d.campaign && isMine(d.campaign) && at(d.created_at) > last);
    const top = state.donations.reduce((m, d) => (at(d.created_at) > m ? at(d.created_at) : m), last);
    try { localStorage.setItem(key, top); } catch { /* */ }
    if (!last || !fresh.length) return;
    const sum = fresh.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
    toast(`🔔 ${fresh.length} תרומות חדשות מהאתר (${money(sum)}) — ${[...new Set(fresh.map((d) => d.campaign))].join(', ')}`);
  } catch { /* לא קריטי */ }
}
