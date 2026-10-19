// דער בלאט פון א ישיבה (למשל ישיבת בית שערים): תלמידים מיט פון-ביז דאטומס, שכר לימוד, תשלומים און קבלות.
// אלעס אין צוויי לשוניות אין גליון — Enrollments (א תלמיד אין א ישיבה, פון ווען ביז ווען) און Tuition (תשלומים) —
// באזונדער פון די טעג'ס פונעם הויפט-מאגר. די תלמידים און עלטערן זענען די זעלבע קאנטאקטן ווי אומעטום.
// וועלכע ארגונים האבן אזא בלאט: Lists → school_org.
import { state, loadAll, saveRecord, deleteRecord, saveContact, addRelation, orgLogo, saveOccasion, addListValue } from './data.js';
import { mergeOrgTags, entry as otEntry } from './orgtags.js';
import { suggestFirstName, suggestLastName } from './names.js';
import { parseBirthday } from './import.js';
import { t } from './i18n.js';
import { escapeHtml as h, isTrue, splitTags, joinTags, formatPhone, detectArea } from './util.js';
import { nextOccurrence, monthKeyFromHe, daysBetween, todayIso, hebrewNumber, isoToHebrewText, toHebrew, fromHebrew, yearLabel, monthsOf, monthHe } from './hebdate.js';
import { money } from './donations.js';
import { downloadXlsx } from './excel.js';
import { tuitionReceipt } from './receipts.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const BIRTHDAY = 'געבורטסטאג';
export const ST = { active: 'לומד', left: 'יצא' }; // 'נתקבל' (פון די רשימות) = לומד

const cur = { org: '', tab: 'active', q: '', shiur: '', asOf: '' };

export function initSchool(helpers) { ui = helpers; }

export const isSchool = (org) => (state.lists.school_org || []).includes(org);
export function schoolOrgs() { return state.lists.school_org || []; }

export function openSchool(org) {
  if (cur.org !== org) Object.assign(cur, { org, tab: 'active', q: '', shiur: '', asOf: '' });
  ui.showView('school');
}

// ---------- רעכענען ----------
const today = () => todayIso();
/**
 * א תלמיד אן עלטערן אינעם בלאט: דער טאטע פון דער משפחה אינעם כרטיס ("זון פון" / "טאטע פון").
 * אזוי קען מען צולייגן דעם טאטע דורך "משפחה" אינעם כרטיס — און ער ווייזט זיך גלייך אומעטום אינעם בלאט.
 */
function fillParents() {
  (state.enrollments || []).forEach((e) => {
    if (String(e.parent_id || '').trim()) return;
    const id = String(e.contact_id);
    const r = (state.relations || []).find((x) => (String(x.contact_id_a) === id && x.relation_type === 'זון פון')
      || (String(x.contact_id_b) === id && x.relation_type === 'טאטע פון'));
    if (r) e.parent_id = String(r.contact_id_a) === id ? r.contact_id_b : r.contact_id_a;
  });
}
const enrollmentsOf = (org) => { fillParents(); return (state.enrollments || []).filter((e) => e.org === org && String(e.contact_id || '').trim()); };
const paymentsOf = (e) => (state.tuition || []).filter((p) => String(p.enroll_id) === String(e.enroll_id));
/** א דאטום: 'YYYY-MM-DD', אדער א נומער פון גוגל שיטס (טעג זינט 30.12.1899) */
const d10 = (v) => {
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v || ''))) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000).toISOString().slice(0, 10);
  }
  return String(v || '').slice(0, 10);
};

/** 'active' | 'left' — אויף א געוויסן טאג */
export function statusOn(e, day = today()) {
  if (e.status === ST.left || (d10(e.end_date) && d10(e.end_date) < day)) return 'left';
  return 'active';
}

// ---------- שכר לימוד לויט העברעאישע חדשים ----------
// יעדער חודש: דער פעסטער סכום (tuition_amount), אחוץ ווען א חודש איז געטוישט — month_amounts = "5787-Heshvan:450; 5787-Kislev:0"
/** { y, m } → 'Y-M' */
const mk = (x) => `${x.y}-${x.m}`;
function nextMonth(x) {
  const ms = monthsOf(x.y).map((z) => z.key); const i = ms.indexOf(x.m);
  return i < ms.length - 1 ? { y: x.y, m: ms[i + 1] } : { y: x.y + 1, m: monthsOf(x.y + 1)[0].key };
}
function prevMonth(x) {
  const ms = monthsOf(x.y).map((z) => z.key); const i = ms.indexOf(x.m);
  if (i > 0) return { y: x.y, m: ms[i - 1] };
  const pm = monthsOf(x.y - 1); return { y: x.y - 1, m: pm[pm.length - 1].key };
}
const hm = (iso) => { const x = toHebrew(iso); return x ? { y: x.y, m: x.m } : null; };
/** א חודש אין דער ריי פון א יאר (צו פארגלייכן) */
const ord = (x) => x.y * 100 + monthsOf(x.y).findIndex((z) => z.key === x.m);
export const currentMonth = () => hm(today());

export function monthOverrides(e) {
  const m = new Map();
  String(e.month_amounts || '').split(';').map((x) => x.trim()).filter(Boolean).forEach((x) => {
    const i = x.lastIndexOf(':'); if (i > 0) m.set(x.slice(0, i).trim(), Number(x.slice(i + 1)) || 0);
  });
  return m;
}
/** דער פעסטער סכום א חודש */
export function baseMonthly(e) {
  const amt = Number(e.tuition_amount || 0);
  if (!amt || e.tuition_period === 'total') return 0;
  return e.tuition_period === 'year' ? Math.round(amt / 12) : amt;
}
/** איז דער תלמיד געווען אין דעם חודש (פון — ביז)? */
export function inMonth(e, x) {
  const s0 = d10(e.start_date) ? hm(d10(e.start_date)) : null;
  if (!s0 || ord(x) < ord(s0)) return false;
  const e0 = d10(e.end_date) ? hm(d10(e.end_date)) : null;
  return !e0 || ord(x) <= ord(e0);
}
/** דער סכום פאר א חודש (מיט א טויש), אדער null ווען ער האט נישט געלערנט */
export function monthAmount(e, x) {
  if (!inMonth(e, x)) return null;
  const o = monthOverrides(e);
  return o.has(mk(x)) ? o.get(mk(x)) : baseMonthly(e);
}

/** וויפיל מ'דארף צאלן ביז היינט (אריינגערעכנט דעם יעצטיגן חודש) */
export function charged(e) {
  if (e.tuition_period === 'total') return d10(e.start_date) && d10(e.start_date) <= today() ? Number(e.tuition_amount || 0) : 0;
  const s0 = d10(e.start_date) ? hm(d10(e.start_date)) : null;
  if (!s0) return 0;
  const now = currentMonth();
  let total = 0;
  for (let x = s0, guard = 0; ord(x) <= ord(now) && guard < 400; x = nextMonth(x), guard += 1) total += monthAmount(e, x) || 0;
  return total;
}
export const paid = (e) => paymentsOf(e).reduce((s, p) => s + Number(p.amount || 0), 0);
export const balance = (e) => charged(e) - paid(e);

const contact = (id) => (id ? ui.contactById(id) : null);
const nameOf = (id) => { const c = contact(id); return c ? ui.fullNameHe(c) : ''; };
const phoneOf = (id) => { const p = state.phones.get(String(id)) || {}; return p.mobile || p.home_phone || p.wife_mobile || ''; };

function birthdayOf(id) {
  return (state.occasions || []).find((o) => String(o.contact_id) === String(id) && o.occasion_type === BIRTHDAY && o.relation === 'ער אליין');
}
const bdayText = (o) => (o ? [o.hebrew_day ? hebrewNumber(Number(o.hebrew_day)) : '', o.hebrew_month, o.hebrew_year].filter(Boolean).join(' ') : '');

// ---------- דער בלאט ----------
export function renderSchool() {
  const main = $('#school-main');
  if (!main || !cur.org) return;
  const all = enrollmentsOf(cur.org);
  const day = cur.asOf || today();
  const by = { active: [], left: [] };
  all.forEach((e) => by[statusOn(e, day)].push(e));
  const owing = all.filter((e) => balance(e) > 0);
  const parents = parentsOf(all);
  const tabs = [['active', '🎓', t('scTabActive'), by.active.length], ['left', '🚪', t('scTabLeft'), by.left.length],
    ['parents', '👪', t('scTabParents'), parents.length], ['tuition', '💲', t('scTabTuition'), owing.length], ['bdays', '🎂', t('scTabBdays'), '']];
  const logo = orgLogo(cur.org);
  main.innerHTML = `<div class="sc-head">
      ${logo ? `<img src="${logo}" alt="" class="sc-logo">` : '<span class="sc-logo-ph">🎓</span>'}
      <div><h1>${h(cur.org)}</h1><p class="muted small">${h(t('scSub2', { s: all.length, a: by.active.length, p: parents.length, n: all.length + parents.length }))}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="sc-new">＋ ${h(t('scNewStudent'))}</button>
      <button type="button" class="btn" id="sc-contacts">👥 ${h(t('scContacts'))}</button>
      <button type="button" class="btn" id="sc-back">← ${h(t('lobbyBack'))}</button>
    </div>
    <nav class="sc-tabs">${tabs.map(([k, ic, l, n]) => `<button type="button" data-sc-tab="${k}" class="${cur.tab === k ? 'on' : ''}">${ic} ${h(l)}${n !== '' ? ` <span class="count-pill">${n}</span>` : ''}</button>`).join('')}</nav>
    <div id="sc-body">${cur.tab === 'tuition' ? tuitionHtml(all) : cur.tab === 'bdays' ? bdaysHtml(by.active) : cur.tab === 'parents' ? parentsHtml(parents) : listHtml(by[cur.tab] || [], day)}</div>`;
  wire(main, all, by);
}

/** די עלטערן: [{ id, kids: [enrollments] }] */
function parentsOf(all) {
  const m = new Map();
  all.forEach((e) => { const k = String(e.parent_id || '').trim(); if (k) m.set(k, [...(m.get(k) || []), e]); });
  return [...m].map(([id, kids]) => ({ id, kids }))
    .sort((a, b) => String(contact(a.id)?.last_name_he || '').localeCompare(String(contact(b.id)?.last_name_he || ''), 'he'));
}

function parentsHtml(list) {
  const q = cur.q.trim().toLowerCase();
  const rows = list.filter((p) => !q || [nameOf(p.id), phoneOf(p.id), ...p.kids.map((e) => nameOf(e.contact_id))].join(' ').toLowerCase().includes(q));
  const mail = (id) => (state.phones.get(String(id)) || {}).email_1 || '';
  return `<div class="sc-tools">
      <input type="search" id="sc-q" placeholder="${h(t('scSearch'))}" value="${h(cur.q)}">
      <span class="spacer"></span>
      <button type="button" class="btn small-btn" id="sc-xl">⬇ Excel</button>
    </div>
    ${rows.length ? `<div class="sc-table-wrap"><table class="lapsed-table sc-table"><thead><tr>
      <th>${h(t('scParent'))}</th><th>${h(t('scKids'))}</th><th>${h(t('colMobile'))}</th><th>${h(t('colEmail'))}</th><th>${h(t('scBalance'))}</th></tr></thead>
      <tbody>${rows.map((p) => {
        const b = p.kids.reduce((s, e) => s + balance(e), 0);
        return `<tr><td><button type="button" class="linkish" data-open="${h(p.id)}">${h(nameOf(p.id) || `#${p.id}`)}</button></td>
          <td>${p.kids.map((e) => `<button type="button" class="linkish" data-open="${h(e.contact_id)}">${h(contact(e.contact_id)?.first_name_he || nameOf(e.contact_id))}</button>
            <span class="badge ${statusOn(e) === 'left' ? 'muted' : 'paid'}">${h(ST[statusOn(e)])}</span>`).join(' ')}</td>
          <td dir="ltr" class="small">${h(phoneOf(p.id))}</td><td dir="ltr" class="small">${h(mail(p.id))}</td>
          <td class="num ${b > 0 ? 'sc-owe' : ''}" dir="ltr">${b ? money(b) : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<p class="muted">${h(t('scNone'))}</p>`}`;
}

function filtered(list) {
  const q = cur.q.trim().toLowerCase();
  return list.filter((e) => (!cur.shiur || e.shiur === cur.shiur)
    && (!q || [nameOf(e.contact_id), nameOf(e.parent_id), phoneOf(e.contact_id), phoneOf(e.parent_id), e.shiur, e.room]
      .join(' ').toLowerCase().includes(q)))
    .sort((a, b) => String(contact(a.contact_id)?.last_name_he || '').localeCompare(String(contact(b.contact_id)?.last_name_he || ''), 'he'));
}

function listHtml(list, day) {
  const shiurim = [...new Set(enrollmentsOf(cur.org).map((e) => e.shiur).filter(Boolean))].sort();
  const rows = filtered(list);
  return `<div class="sc-tools">
      <input type="search" id="sc-q" placeholder="${h(t('scSearch'))}" value="${h(cur.q)}">
      ${shiurim.length ? `<select id="sc-shiur"><option value="">${h(t('scAllShiurim'))}</option>${shiurim.map((s) => `<option${s === cur.shiur ? ' selected' : ''}>${h(s)}</option>`).join('')}</select>` : ''}
      ${cur.tab === 'active' ? `<label class="sc-asof">${h(t('scAsOf'))} <input type="date" id="sc-asof" value="${h(cur.asOf)}"></label>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn small-btn" id="sc-xl">⬇ Excel</button>
    </div>
    ${cur.asOf ? `<p class="hint-line">${h(t('scAsOfNote', { d: isoToHebrewText(day) }))}</p>` : ''}
    ${rows.length ? `<div class="sc-table-wrap"><table class="lapsed-table sc-table"><thead><tr>
      <th>${h(t('scStudent'))}</th><th>${h(t('scParent'))}</th><th>${h(t('colMobile'))}</th>
      <th>${h(t('scFrom'))}</th><th>${h(t('scTo'))}</th><th>${h(t('scBalance'))}</th><th></th></tr></thead>
      <tbody>${rows.map(rowHtml).join('')}</tbody></table></div>` : `<p class="muted">${h(t('scNone'))}</p>`}`;
}

function rowHtml(e) {
  const b = balance(e);
  return `<tr>
    <td><button type="button" class="linkish" data-open="${h(e.contact_id)}">${h(nameOf(e.contact_id) || `#${e.contact_id}`)}</button>${e.room ? `<div class="muted small">${h(t('scRoom'))}: ${h(e.room)}</div>` : ''}</td>
    <td>${e.parent_id ? `<button type="button" class="linkish" data-open="${h(e.parent_id)}">${h(nameOf(e.parent_id))}</button>` : '<span class="muted">—</span>'}</td>
    <td dir="ltr" class="small">${h(phoneOf(e.contact_id) || phoneOf(e.parent_id))}</td>
    <td class="small">${h(dateText(e.start_date))}</td><td class="small">${h(dateText(e.end_date))}</td>
    <td class="num ${b > 0 ? 'sc-owe' : ''}" dir="ltr">${Number(e.tuition_amount) ? money(b) : ''}</td>
    <td class="sc-acts"><button type="button" class="btn small-btn" data-edit="${h(e.enroll_id)}" title="${h(t('scEdit'))}">✎</button>
      <button type="button" class="btn small-btn" data-pay="${h(e.enroll_id)}" title="${h(t('scAddPayment'))}">💲</button></td></tr>`;
}

/** נאר חודש און יאר: "חשון תשפ"ז" (א זמן הייבט זיך אן אנפאנג חודש) */
const dateText = (iso) => { const x = d10(iso) ? toHebrew(d10(iso)) : null; return x ? `${monthHe(x.m)} ${yearLabel(x.y)}` : ''; };

/** די 6 חדשים אויפן בלאט: 4 צוריק, דער יעצטיגער, און איינס פאראויס */
function sixMonths() {
  const now = currentMonth();
  let x = now; for (let i = 0; i < 4; i += 1) x = prevMonth(x);
  const out = [];
  for (let i = 0; i < 6; i += 1) { out.push(x); x = nextMonth(x); }
  return { now, list: out };
}
const monthLabel = (x) => `${monthHe(x.m)} ${yearLabel(x.y).replace(/^תש/, '')}`;

function tuitionHtml(all) {
  const active = all.filter((e) => statusOn(e) === 'active')
    .sort((a, b) => String(contact(a.contact_id)?.last_name_he || '').localeCompare(String(contact(b.contact_id)?.last_name_he || ''), 'he'));
  const leftOwing = all.filter((e) => statusOn(e) === 'left' && balance(e) > 0).sort((a, b) => balance(b) - balance(a));
  const owe = (list) => { const o = list.filter((e) => balance(e) > 0); return { n: o.length, sum: o.reduce((s, e) => s + balance(e), 0) }; };
  const oa = owe(active); const ol = owe(leftOwing);
  const { now, list: months } = sixMonths();
  const expected = all.reduce((s, e) => s + (monthAmount(e, now) || 0), 0);
  const cameIn = (state.tuition || []).filter((p) => { if (p.org !== cur.org || !d10(p.date)) return false; const x = hm(d10(p.date)); return x && mk(x) === mk(now); })
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const pays = (state.tuition || []).filter((p) => p.org === cur.org).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 60);
  const cell = (e, x) => {
    const v = monthAmount(e, x);
    const isNow = mk(x) === mk(now);
    if (v === null) return `<td class="num sc-mon${isNow ? ' sc-now' : ''}"><span class="muted">—</span></td>`;
    const changed = monthOverrides(e).has(mk(x)) && v !== baseMonthly(e);
    return `<td class="num sc-mon${isNow ? ' sc-now' : ''}"><input type="number" min="0" step="1" dir="ltr" class="sc-mcell${changed ? ' sc-changed' : ''}"
      data-me="${h(e.enroll_id)}" data-mk="${h(mk(x))}" value="${h(v)}" title="${h(changed ? t('scMonthChanged', { n: money(baseMonthly(e)) }) : t('scMonthHint'))}"></td>`;
  };
  const table = (list) => `<div class="sc-table-wrap"><table class="lapsed-table sc-table sc-months"><thead><tr><th>${h(t('scStudent'))}</th><th>${h(t('scParent'))}</th>
      ${months.map((x) => `<th class="num${mk(x) === mk(now) ? ' sc-now' : ''}">${h(monthLabel(x))}</th>`).join('')}
      <th>${h(t('scPaid'))}</th><th>${h(t('scBalance'))}</th><th></th></tr></thead>
      <tbody>${list.map((e) => { const b = balance(e); return `<tr><td><button type="button" class="linkish" data-open="${h(e.contact_id)}">${h(nameOf(e.contact_id))}</button></td>
        <td>${h(nameOf(e.parent_id))}</td>
        ${months.map((x) => cell(e, x)).join('')}
        <td class="num" dir="ltr">${money(paid(e))}</td>
        <td class="num ${b > 0 ? 'sc-owe' : ''}" dir="ltr">${money(b)}</td>
        <td class="sc-acts"><button type="button" class="btn small-btn" data-edit="${h(e.enroll_id)}" title="${h(t('scEdit'))}">✎</button>
          <button type="button" class="btn small-btn" data-pay="${h(e.enroll_id)}">💲 ${h(t('scAddPayment'))}</button></td></tr>`; }).join('')}</tbody></table></div>`;
  return `<div class="sc-stats">
      <div class="sc-stat sc-owe"><span class="muted small">${h(t('scOweActive'))}</span><b dir="ltr">${money(oa.sum)}</b><span class="small">${h(t('scOweN', { n: oa.n }))}</span></div>
      <div class="sc-stat sc-owe"><span class="muted small">${h(t('scOweLeft'))}</span><b dir="ltr">${money(ol.sum)}</b><span class="small">${h(t('scOweN', { n: ol.n }))}</span></div>
      <div class="sc-stat"><span class="muted small">${h(t('scThisMonth', { m: `${monthHe(now.m)} ${yearLabel(now.y)}` }))}</span><b dir="ltr">${money(expected)}</b>
        <span class="small">${h(t('scCameIn'))}: <b dir="ltr">${money(cameIn)}</b></span></div>
    </div>
    <p class="hint-line">${h(t('scMonthsHint'))}</p>
    <h3>${h(t('scTabActive'))} <span class="count-pill">${active.length}</span></h3>
    ${active.length ? table(active) : `<p class="muted">${h(t('scNone'))}</p>`}
    <h3>${h(t('scOweLeft'))} <span class="count-pill">${leftOwing.length}</span></h3>
    ${leftOwing.length ? table(leftOwing) : `<p class="muted">${h(t('scNoneOwing'))}</p>`}
    <h3>${h(t('scPayments'))}</h3>
    ${pays.length ? paymentsTable(pays, true) : `<p class="muted">${h(t('scNoPayments'))}</p>`}`;
}

/** א חודש מיט אן אנדער סכום — היטן (ווען ס'איז ווי דער פעסטער סכום, מעקט מען אויס דעם טויש) */
async function saveMonthCell(inp) {
  const e = state.enrollments.find((x) => String(x.enroll_id) === inp.dataset.me);
  if (!e) return;
  const v = Math.max(0, Math.round(Number(inp.value) || 0));
  const o = monthOverrides(e);
  if (v === baseMonthly(e)) o.delete(inp.dataset.mk); else o.set(inp.dataset.mk, v);
  const month_amounts = [...o].map(([k, n]) => `${k}:${n}`).join('; ');
  if (month_amounts === String(e.month_amounts || '')) return;
  inp.disabled = true;
  try {
    await saveRecord('Enrollments', 'enroll_id', { ...e, month_amounts });
    e.month_amounts = month_amounts;
    ui.toast(t('saved'));
    renderSchool();
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); inp.disabled = false; }
}

function paymentsTable(pays, withStudent) {
  return `<table class="lapsed-table sc-table"><thead><tr><th>${h(t('scDate'))}</th>${withStudent ? `<th>${h(t('scStudent'))}</th>` : ''}<th>${h(t('scPayer'))}</th>
    <th>${h(t('xlAmount'))}</th><th>${h(t('paymentMethod'))}</th><th>${h(t('rcNumber'))}</th><th></th></tr></thead>
    <tbody>${pays.map((p) => `<tr><td class="small">${h(d10(p.date))}</td>${withStudent ? `<td>${h(nameOf(p.contact_id))}</td>` : ''}<td>${h(nameOf(p.payer_id))}</td>
      <td class="num" dir="ltr">${money(p.amount)}</td><td class="small">${h([p.method, p.check_number ? `#${p.check_number}` : '', p.card_last4 ? `****${p.card_last4}` : ''].filter(Boolean).join(' '))}</td>
      <td dir="ltr" class="small">${h(p.receipt_no || '')}</td>
      <td class="sc-acts"><button type="button" class="btn small-btn" data-receipt="${h(p.payment_id)}" title="${h(t('scReceipt'))}">🧾</button>
        <button type="button" class="btn small-btn" data-receipt-mail="${h(p.payment_id)}" title="${h(t('rcMailBtn'))}">✉</button>
        <button type="button" class="btn small-btn" data-editpay="${h(p.payment_id)}" title="${h(t('scEdit'))}">✎</button></td></tr>`).join('')}</tbody></table>`;
}

function bdaysHtml(list) {
  const rows = list.map((e) => {
    const o = birthdayOf(e.contact_id);
    if (!o) return null;
    const next = nextOccurrence(Number(o.hebrew_day), monthKeyFromHe(o.hebrew_month), monthKeyFromHe(o.adar_in_leap) || 'Adar II');
    return next ? { e, o, next, days: daysBetween(today(), next) } : null;
  }).filter(Boolean).sort((a, b) => a.days - b.days);
  const missing = list.filter((e) => !birthdayOf(e.contact_id)).length;
  return `${rows.length ? `<table class="lapsed-table sc-table"><thead><tr><th>${h(t('scStudent'))}</th><th>${h(t('scBirthday'))}</th><th>${h(t('scWhen'))}</th><th>${h(t('scParent'))}</th></tr></thead>
    <tbody>${rows.map(({ e, o, next, days }) => `<tr class="${days <= 7 ? 'sc-soon' : ''}"><td><button type="button" class="linkish" data-open="${h(e.contact_id)}">${h(nameOf(e.contact_id))}</button></td>
      <td>${h(bdayText(o))}</td><td class="small">${h(days === 0 ? t('scToday') : t('scInDays', { n: days }))} · ${h(isoToHebrewText(next))}</td><td>${h(nameOf(e.parent_id))}</td></tr>`).join('')}</tbody></table>`
    : `<p class="muted">${h(t('scNone'))}</p>`}
    ${missing ? `<p class="hint-line">${h(t('scBdayMissing', { n: missing }))}</p>` : ''}`;
}

function wire(main, all) {
  $('#sc-back', main).onclick = () => ui.showView('lobby');
  $('#sc-contacts', main).onclick = () => ui.openOrgContacts(cur.org);
  $('#sc-new', main).onclick = () => openEnrollForm({});
  $$('[data-sc-tab]', main).forEach((b) => { b.onclick = () => { cur.tab = b.dataset.scTab; renderSchool(); }; });
  const q = $('#sc-q', main);
  if (q) q.oninput = () => { cur.q = q.value; const pos = q.selectionStart; renderSchool(); const n = $('#sc-q'); n.focus(); n.setSelectionRange(pos, pos); };
  const s = $('#sc-shiur', main);
  if (s) s.onchange = () => { cur.shiur = s.value; renderSchool(); };
  const a = $('#sc-asof', main);
  if (a) a.onchange = () => { cur.asOf = a.value; renderSchool(); };
  const xl = $('#sc-xl', main);
  if (xl) xl.onclick = () => exportXl(all);
  $$('.sc-mcell', main).forEach((inp) => {
    inp.onchange = () => saveMonthCell(inp);
    inp.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } };
  });
  wireRowButtons(main);
}

function wireRowButtons(root) {
  $$('[data-open]', root).forEach((b) => { b.onclick = () => ui.openCard(b.dataset.open); });
  $$('[data-edit]', root).forEach((b) => { b.onclick = () => openEnrollForm(state.enrollments.find((e) => String(e.enroll_id) === b.dataset.edit)); });
  $$('[data-pay]', root).forEach((b) => { b.onclick = () => openPaymentForm({}, state.enrollments.find((e) => String(e.enroll_id) === b.dataset.pay)); });
  $$('[data-editpay]', root).forEach((b) => {
    b.onclick = () => { const p = state.tuition.find((x) => String(x.payment_id) === b.dataset.editpay); openPaymentForm(p, state.enrollments.find((e) => String(e.enroll_id) === String(p.enroll_id))); };
  });
  $$('[data-receipt], [data-receipt-mail]', root).forEach((b) => {
    b.onclick = () => receipt(b.dataset.receipt || b.dataset.receiptMail, b.dataset.receiptMail ? 'mail' : 'print');
  });
}

async function receipt(id, mode) {
  const p = state.tuition.find((x) => String(x.payment_id) === String(id));
  if (!p) return;
  const no = await tuitionReceipt(p, mode);
  if (no && no !== p.receipt_no) {
    try { await saveRecord('Tuition', 'payment_id', { ...p, receipt_no: no }); await loadAll(); ui.refreshAll(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  }
}

function exportXl(all) {
  if (cur.tab === 'parents') {
    const mail = (id) => (state.phones.get(String(id)) || {}).email_1 || '';
    downloadXlsx(`${cur.org} - ${t('scTabParents')}`, [t('scParent'), t('scKids'), t('colMobile'), t('colEmail'), t('scBalance')],
      parentsOf(all).map((p) => [nameOf(p.id), p.kids.map((e) => `${nameOf(e.contact_id)} (${ST[statusOn(e)]})`).join(', '), phoneOf(p.id), mail(p.id), p.kids.reduce((s, e) => s + balance(e), 0)]));
    return;
  }
  const list = cur.tab === 'tuition' || cur.tab === 'bdays' ? all : filtered(all.filter((e) => statusOn(e, cur.asOf || today()) === cur.tab));
  const head = [t('scStudent'), t('scParent'), t('colMobile'), t('scParentPhone'), t('scShiur'), t('scRoom'), t('scStatus'), t('scFrom'), t('scTo'), t('scTuition'), t('scCharged'), t('scPaid'), t('scBalance'), t('scBirthday'), t('comments')];
  const stLabel = ST;
  downloadXlsx(`${cur.org} - ${t('scFile')}`, head, list.map((e) => [nameOf(e.contact_id), nameOf(e.parent_id), phoneOf(e.contact_id), phoneOf(e.parent_id), e.shiur || '', e.room || '',
    stLabel[statusOn(e)], dateText(e.start_date), dateText(e.end_date), Number(e.tuition_amount || 0), charged(e), paid(e), balance(e), bdayText(birthdayOf(e.contact_id)), e.note || '']));
}

// ---------- אין כרטיס פונעם תלמיד / עלטערן ----------
export function schoolCount(c) {
  fillParents();
  const id = String(c.contact_id);
  return (state.enrollments || []).filter((e) => String(e.contact_id) === id || String(e.parent_id) === id).length;
}

export function schoolSection(c) {
  fillParents();
  const id = String(c.contact_id);
  const mine = (state.enrollments || []).filter((e) => String(e.contact_id) === id);
  const kids = (state.enrollments || []).filter((e) => String(e.parent_id) === id);
  const block = (e, asParent) => {
    const st = statusOn(e);
    const pays = paymentsOf(e).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<section class="sc-card">
      <div class="sc-card-head"><b>${h(e.org)}</b>${asParent ? ` · ${h(t('scParentOf', { name: nameOf(e.contact_id) }))}` : ''}
        <span class="badge ${st === 'left' ? 'muted' : 'paid'}">${h(ST[st])}</span><span class="spacer"></span>
        <button type="button" class="btn small-btn" data-edit="${h(e.enroll_id)}">✎ ${h(t('scEdit'))}</button>
        <button type="button" class="btn small-btn" data-pay="${h(e.enroll_id)}">💲 ${h(t('scAddPayment'))}</button></div>
      <div class="sc-card-grid">
        <span>${h(t('scFrom'))}: <b>${h(dateText(e.start_date) || '—')}</b></span><span>${h(t('scTo'))}: <b>${h(dateText(e.end_date) || '—')}</b></span>
        ${e.shiur ? `<span>${h(t('scShiur'))}: <b>${h(e.shiur)}</b></span>` : ''}${e.room ? `<span>${h(t('scRoom'))}: <b>${h(e.room)}</b></span>` : ''}
        ${!asParent && e.parent_id ? `<span>${h(t('scParent'))}: <button type="button" class="linkish" data-open="${h(e.parent_id)}">${h(nameOf(e.parent_id))}</button></span>` : ''}
        ${Number(e.tuition_amount) ? `<span>${h(t('scTuition'))}: <b dir="ltr">${money(e.tuition_amount)}</b> ${h(t(`scPer_${e.tuition_period || 'month'}`))}</span>
          <span>${h(t('scCharged'))}: <b dir="ltr">${money(charged(e))}</b> · ${h(t('scPaid'))}: <b dir="ltr">${money(paid(e))}</b> · ${h(t('scBalance'))}: <b dir="ltr" class="${balance(e) > 0 ? 'sc-owe' : ''}">${money(balance(e))}</b></span>` : ''}
      </div>
      ${e.note ? `<p class="small">${h(e.note)}</p>` : ''}
      ${pays.length ? paymentsTable(pays, false) : ''}
    </section>`;
  };
  return [...mine.map((e) => block(e, false)), ...kids.map((e) => block(e, true))].join('')
    || `<p class="muted">${h(t('scNone'))}</p>`;
}

export function wireSchoolSection(root) { wireRowButtons(root); }

// ---------- טופס: תלמיד (נייער אדער טוישן) ----------
function contactByLabel(v) {
  const s = String(v || '').trim();
  return s ? state.contacts.find((c) => ui.pickerLabel(c) === s) || null : null;
}

/** די זמנים: "זמן חורף פ"ז" (פון ר"ח חשון), "זמן קיץ פ"ז" (פון ר"ח אייר) — א פאר יאר צוריק און איין יאר פאראויס */
function zmanim() {
  const y = toHebrew(today()).y;
  const out = [];
  for (let yy = y + 1; yy >= y - 5; yy -= 1) {
    const yl = yearLabel(yy).replace(/^תש/, ''); // "פ\"ז" — ווי אין די רשימות
    out.push({ label: `זמן קיץ ${yl}`, start: fromHebrew(1, 'Iyar', yy) });
    out.push({ label: `זמן חורף ${yl}`, start: fromHebrew(1, 'Heshvan', yy) });
  }
  return out;
}
/** דער זמן פון א תלמיד: e.zman, אדער פון דער הערה ("זמן קיץ פ"ד (יוצאים)" / "זמנים: חורף פ"ג") */
export function zmanOf(e) {
  if (String(e.zman || '').trim()) return String(e.zman).trim();
  const m = /זמן\s+(חורף|קיץ)\s+(\S+?["״]\S)/.exec(e.note || '') || /זמנים:\s*(חורף|קיץ)\s+(\S+?["״]\S)/.exec(e.note || '');
  return m ? `זמן ${m[1]} ${m[2]}` : '';
}

const F = (name, label, attrs = '') => `<label>${h(label)}<input name="${name}" ${attrs}></label>`;

function personBlock(prefix, label, c, fields) {
  return `<fieldset class="sc-person" data-p="${prefix}"><legend>${h(label)}</legend>
    <label class="wide">${h(t('scPickExisting'))}<input name="${prefix}_pick" list="dl-sc-contacts" autocomplete="off" value="${c ? h(ui.pickerLabel(c)) : ''}" placeholder="${h(t('pickContact'))}"></label>
    <div class="sc-new"${c ? ' hidden' : ''}>
      <p class="hint-line">${h(t('scOrNew'))}</p>
      <div class="grid">${fields}</div>
    </div></fieldset>`;
}

export function openEnrollForm(enroll = {}, preset = {}) {
  const e = { org: cur.org || preset.org || schoolOrgs()[0] || '', status: ST.active, tuition_period: 'month', ...preset, ...(enroll || {}) };
  const isNew = !e.enroll_id;
  const dlg = $('#school-dialog'); const form = $('#school-form');
  const shiurim = [...new Set(enrollmentsOf(e.org).map((x) => x.shiur).filter(Boolean))];
  const zs = zmanim();
  const curZ = zmanOf(e);
  if (curZ && !zs.some((z) => z.label === curZ)) zs.push({ label: curZ, start: '' });
  const ltr = 'dir="ltr"';
  const studentFields = [
    F('s_first', t('scFirst')), F('s_last', t('scLast')), F('s_mobile', t('colMobile'), `${ltr} inputmode="tel"`), F('s_email', t('colEmail'), `${ltr} type="email"`),
    F('s_bday', t('scBirthday'), `placeholder="${h(t('scBdayPh'))}"`), F('s_address', t('scOwnAddress'), ltr),
    F('s_community', t('scCommunity')), F('s_learned', t('scLearnedAt')),
  ].join('');
  const parentFields = [
    F('p_first', t('scFirst')), F('p_last', t('scLast')), F('p_mobile', t('scFatherCell'), `${ltr} inputmode="tel"`), F('p_home', t('colHome'), `${ltr} inputmode="tel"`),
    F('p_wife', t('scMotherCell'), `${ltr} inputmode="tel"`), F('p_email', t('colEmail'), `${ltr} type="email"`),
    F('p_address', t('address'), ltr), F('p_city', t('scCity'), ltr), F('p_state', t('scState'), `${ltr} maxlength="20"`), F('p_zip', t('scZip'), ltr),
    F('p_country', t('scCountry'), ltr), F('p_motherfam', t('scMotherFamily')),
  ].join('');
  form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>${h(isNew ? t('scNewStudent') : t('scEditStudent'))}</h2>
    ${schoolOrgs().length > 1 ? `<label>${h(t('orgKollel'))}<select name="org">${schoolOrgs().map((o) => `<option${o === e.org ? ' selected' : ''}>${h(o)}</option>`).join('')}</select></label>` : `<input type="hidden" name="org" value="${h(e.org)}">`}
    <datalist id="dl-sc-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
    ${personBlock('s', t('scStudent'), contact(e.contact_id), studentFields)}
    ${personBlock('p', t('scParent'), contact(e.parent_id), parentFields)}
    <fieldset><legend>${h(t('scLearning'))}</legend>
      <div class="grid">
        <label>${h(t('scZman'))}<select name="zman"><option value=""></option>${zs.map((z) => `<option value="${h(z.label)}" data-start="${h(z.start)}"${z.label === curZ ? ' selected' : ''}>${h(z.label)}</option>`).join('')}</select></label>
        <label>${h(t('scStatus'))}<select name="status">${Object.values(ST).map((x) => `<option${x === e.status ? ' selected' : ''}>${h(x)}</option>`).join('')}</select></label>
        <label>${h(t('scFrom'))}<span class="sc-my"><select name="start_m"></select><select name="start_y"></select></span><input type="hidden" name="start_date" value="${h(d10(e.start_date))}"></label>
        <label>${h(t('scTo'))}<span class="sc-my"><select name="end_m"></select><select name="end_y"></select></span><input type="hidden" name="end_date" value="${h(d10(e.end_date))}"></label>
        <label>${h(t('scShiur'))}<input name="shiur" list="dl-sc-shiur" value="${h(e.shiur || '')}"></label>
        <datalist id="dl-sc-shiur">${shiurim.map((x) => `<option value="${h(x)}">`).join('')}</datalist>
        <label>${h(t('scRoom'))}<input name="room" value="${h(e.room || '')}"></label>
      </div>
    </fieldset>
    <fieldset><legend>${h(t('scTuition'))}</legend>
      <div class="grid">
        <label>${h(t('xlAmount'))}<input name="tuition_amount" type="number" min="0" step="1" dir="ltr" value="${h(e.tuition_amount || '')}"></label>
        <label>${h(t('scPeriod'))}<select name="tuition_period">${['month', 'year', 'total'].map((x) => `<option value="${x}"${x === (e.tuition_period || 'month') ? ' selected' : ''}>${h(t(`scPer_${x}`))}</option>`).join('')}</select></label>
      </div>
    </fieldset>
    <label class="wide">${h(t('comments'))}<textarea name="note" rows="2">${h(e.note || '')}</textarea></label>
    <p class="hint-line">${h(t('scAutoHint'))}</p>
    <div class="actions">
      ${!isNew ? `<button type="button" class="btn danger" data-del>${h(t('deleteBtn'))}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="submit" class="btn primary">${h(t('saveBtn'))}</button>
    </div>`;
  const el = form.elements;
  // פון / ביז: נאר חודש און יאר (העברעיש). "פון" = דער ערשטער פונעם חודש, "ביז" = דער כ"ט.
  const thisY = toHebrew(today()).y;
  const years = []; for (let y = thisY + 2; y >= thisY - 10; y -= 1) years.push(y);
  const fillMonths = (p, y, want) => {
    const ms = monthsOf(y);
    const key = ms.some((m) => m.key === want) ? want : (want === 'Adar' ? 'Adar II' : want === 'Adar I' || want === 'Adar II' ? 'Adar' : want);
    el[`${p}_m`].innerHTML = `<option value=""></option>${ms.map((m) => `<option value="${m.key}"${m.key === key ? ' selected' : ''}>${h(m.he)}</option>`).join('')}`;
  };
  const setMY = (p, iso) => {
    const x = iso ? toHebrew(iso) : null;
    if (x && !years.includes(x.y)) years.push(x.y);
    el[`${p}_y`].innerHTML = `<option value=""></option>${years.sort((a, b) => b - a).map((y) => `<option value="${y}"${x && x.y === y ? ' selected' : ''}>${h(yearLabel(y))}</option>`).join('')}`;
    fillMonths(p, x ? x.y : thisY, x ? x.m : '');
    el[`${p}_date`].value = iso || '';
  };
  const readMY = (p) => {
    const m = el[`${p}_m`].value; const y = Number(el[`${p}_y`].value);
    if (m && !y) { el[`${p}_y`].value = String(thisY); return readMY(p); }
    el[`${p}_date`].value = m && y ? fromHebrew(p === 'start' ? 1 : 29, m, y) : '';
  };
  ['start', 'end'].forEach((p) => {
    el[`${p}_m`].onchange = () => { el.start_date.dataset.touched = p === 'start' ? '1' : el.start_date.dataset.touched || ''; readMY(p); if (p === 'end') endChanged(); };
    el[`${p}_y`].onchange = () => { fillMonths(p, Number(el[`${p}_y`].value) || thisY, el[`${p}_m`].value); if (p === 'start') el.start_date.dataset.touched = '1'; readMY(p); if (p === 'end') endChanged(); };
  });
  const endChanged = () => { if (el.end_date.value && el.end_date.value < today()) el.status.value = ST.left; };
  setMY('start', d10(e.start_date)); setMY('end', d10(e.end_date));
  // דער זמן → "פון" (ווען מ'האט נאך נישט געקליבן אליין)
  el.zman.onchange = () => {
    const st = el.zman.selectedOptions[0]?.dataset.start;
    if (st && (!el.start_date.value || !el.start_date.dataset.touched)) setMY('start', st);
  };
  if (isNew && !el.start_date.value) { const z = zs.find((x) => x.start && x.start <= today()); if (z) { el.zman.value = z.label; setMY('start', z.start); } }
  ['s', 'p'].forEach((p) => {
    const inp = el[`${p}_pick`];
    inp.oninput = () => { $(`[data-p="${p}"] .sc-new`, form).hidden = Boolean(contactByLabel(inp.value)); };
  });
  // דער משפחה-נאמען פונעם תלמיד → אויך פארן טאטע
  el.s_last.oninput = () => { if (!el.p_last.dataset.touched) el.p_last.value = el.s_last.value; };
  el.p_last.oninput = () => { el.p_last.dataset.touched = '1'; };
  $$('[data-close]', form).forEach((b) => { b.onclick = () => dlg.close(); });
  const del = $('[data-del]', form);
  if (del) {
    del.onclick = async () => {
      if (paymentsOf(e).length) { ui.toast(t('scHasPayments'), 'error'); return; }
      if (!confirm(t('scDeleteConfirm'))) return;
      try { await deleteRecord('Enrollments', 'enroll_id', e); await loadAll(); dlg.close(); ui.refreshAll(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  }
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await saveEnrollForm(form, e);
      dlg.close();
      await loadAll();
      ui.refreshAll();
      ui.toast(t('saved'));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; }
  };
  if (!dlg.open) dlg.showModal();
}

const val = (form, n) => String(form.elements[n]?.value || '').trim();

/** א נייער קאנטאקט פונעם טופס — מיט ענגליש (צו באשטעטיגן), געגנט, טעלעפאנען, הערות. גיט צוריק דעם ID (אדער ''). */
async function newPerson(form, p, org, base, phones, notes) {
  const first = val(form, `${p}_first`); const last = val(form, `${p}_last`);
  if (!first && !last) return '';
  if (!first || !last) throw new Error(t('scNeedName'));
  const c = { first_name_he: first, last_name_he: last, kollel: org, ...base };
  const auto = [];
  const en1 = suggestFirstName(first, state.contacts); const en2 = suggestLastName(last, state.contacts);
  if (en1) { c.first_name_en = en1; auto.push('first_name_en'); }
  if (en2) { c.last_name_en = en2; auto.push('last_name_en'); }
  if (auto.length) c.unverified_fields = joinTags(auto);
  if (!c.area && (c.zip || c.city || c.country)) c.area = detectArea(state.areas || [], c);
  const ph = Object.fromEntries(Object.entries({ ...phones, comments: notes.filter(Boolean).join(' | ') }).filter(([, v]) => v));
  const id = await saveContact(c, ph);
  state.contacts.push({ ...c, contact_id: id });
  state.phones.set(String(id), { ...ph, contact_id: id });
  return id;
}

async function saveEnrollForm(form, e) {
  const org = val(form, 'org');
  const zman = val(form, 'zman');
  // דער טאטע: פונעם מאגר אדער נייער (מיט זיין אדרעס, טעלעפאנען, משפחת האם)
  const pickedP = contactByLabel(form.elements.p_pick.value);
  const community = val(form, 's_community');
  const pAddr = { address: val(form, 'p_address'), city: val(form, 'p_city'), state: val(form, 'p_state'), zip: val(form, 'p_zip'), country: val(form, 'p_country') };
  const parentId = pickedP ? pickedP.contact_id : await newPerson(form, 'p', org, pAddr,
    { mobile: formatPhone(val(form, 'p_mobile')), home_phone: formatPhone(val(form, 'p_home')), wife_mobile: formatPhone(val(form, 'p_wife')), email_1: val(form, 'p_email').toLowerCase() },
    [val(form, 'p_motherfam') && `משפחת האם: ${val(form, 'p_motherfam')}`, community && `משתייך לקהילת: ${community}`]);
  // דער תלמיד: זיין אייגענע אדרעס, אדער די פון די עלטערן
  const pickedS = contactByLabel(form.elements.s_pick.value);
  const parentC = parentId ? state.contacts.find((x) => String(x.contact_id) === String(parentId)) : null;
  const sAddr = val(form, 's_address') ? { address: val(form, 's_address') }
    : parentC ? { address: parentC.address || '', city: parentC.city || '', state: parentC.state || '', zip: parentC.zip || '', country: parentC.country || '', area: parentC.area || '' } : {};
  const studentId = pickedS ? pickedS.contact_id : await newPerson(form, 's', org, { marital_status: 'בחור', ...sAddr },
    { mobile: formatPhone(val(form, 's_mobile')), email_1: val(form, 's_email').toLowerCase() },
    [community && `משתייך לקהילת: ${community}`, val(form, 's_learned') && `למד בישיבה: ${val(form, 's_learned')}`]);
  if (!studentId) throw new Error(t('scNeedStudent'));
  const rec = {
    ...e, org, contact_id: studentId, parent_id: parentId, zman,
    status: val(form, 'status'), start_date: val(form, 'start_date'), end_date: val(form, 'end_date'),
    shiur: val(form, 'shiur'), room: val(form, 'room'),
    tuition_amount: val(form, 'tuition_amount'), tuition_period: val(form, 'tuition_period'), note: val(form, 'note'),
  };
  if (rec.end_date && rec.start_date && rec.end_date < rec.start_date) throw new Error(t('scBadDates'));
  rec.enroll_id = await saveRecord('Enrollments', 'enroll_id', rec);
  const i = state.enrollments.findIndex((x) => String(x.enroll_id) === String(rec.enroll_id));
  if (i >= 0) state.enrollments[i] = rec; else state.enrollments.push(rec);
  // דער קשר: זון פון ← טאטע (אויב נאך נישטא)
  if (parentId && !state.relations.some((r) => String(r.contact_id_a) === String(studentId) && String(r.contact_id_b) === String(parentId))) {
    await addRelation(studentId, 'זון פון', parentId);
  }
  // כולל/ישיבה + "פריער" + תגיות נוספות — פונעם תלמיד און פון די עלטערן
  await syncPerson(studentId, org);
  if (parentId) await syncPerson(parentId, org);
  // געבורטסטאג → א מאורע (נאר ווען נאך נישטא)
  const bd = !pickedS && val(form, 's_bday') ? parseBirthday(val(form, 's_bday')) : null;
  if (!pickedS && val(form, 's_bday') && !bd) ui.toast(t('scBdayBad'), 'error');
  if (bd && !birthdayOf(studentId)) {
    await saveOccasion({ contact_id: studentId, occasion_type: BIRTHDAY, person_name: val(form, 's_first'), relation: 'ער אליין', ben_bat: 'בן',
      father_name: parentC?.first_name_he || '', hebrew_day: bd.day, hebrew_month: bd.month, hebrew_year: bd.year });
  }
}

/**
 * נאך א נייעם קשר אינעם כרטיס ("זון פון" / "טאטע פון"): א תלמיד אן עלטערן באקומט דעם טאטע
 * אינעם בלאט פון דער ישיבה, און דער טאטע באקומט 'כולל/ישיבה' און די תגיות — ווי ביים אריינלייגן.
 */
export async function afterRelation(a, type, b) {
  let student; let father;
  if (type === 'זון פון') { student = a; father = b; } else if (type === 'טאטע פון') { student = b; father = a; } else return;
  const list = (state.enrollments || []).filter((e) => String(e.contact_id) === String(student) && !String(e.parent_id || '').trim());
  for (const e of list) {
    e.parent_id = father;
    await saveRecord('Enrollments', 'enroll_id', e);
    await syncPerson(father, e.org);
  }
}

/**
 * א מענטש אין דער ישיבה: 'כולל/ישיבה' (מיט "פריער" ווען אלע זיינע — אדער פון זיינע קינדער — זענען ארויס),
 * און די תגיות נוספות: "זמן חורף פ"ז" + "תלמיד" ביים תלמיד, "הורה לתלמיד זמן חורף פ"ז" ביי די עלטערן.
 */
async function syncPerson(id, org) {
  const c = state.contacts.find((x) => String(x.contact_id) === String(id));
  if (!c || !c.first_name_he) return;
  const mine = (state.enrollments || []).filter((x) => x.org === org && String(x.contact_id) === String(id));
  const kids = (state.enrollments || []).filter((x) => x.org === org && String(x.parent_id) === String(id));
  const all = [...mine, ...kids];
  if (!all.length) return;
  const left = all.every((x) => statusOn(x) === 'left');
  const tags = [
    ...mine.flatMap((x) => [zmanOf(x), 'תלמיד']),
    ...kids.map((x) => zmanOf(x) && `הורה לתלמיד ${zmanOf(x)}`),
  ].filter(Boolean).map((x) => otEntry(org, x));
  const next = { ...c };
  delete next._row;
  let changed = false;
  const has = splitTags(c.kollel);
  if (!has.includes(org)) { next.kollel = joinTags([...has, org]); changed = true; }
  if ((has.length <= 1) && isTrue(c.kollel_former) !== left) { next.kollel_former = left; changed = true; }
  const merged = mergeOrgTags(c.org_tags, tags.join('; '));
  if (merged !== mergeOrgTags(c.org_tags, '')) { next.org_tags = merged; changed = true; }
  if (changed) {
    await saveContact(next, state.phones.get(String(id)) || {});
    Object.assign(c, next);
  }
  if (state.isAdmin) {
    for (const x of tags) if (!(state.lists.org_tag || []).includes(x)) { try { await addListValue('org_tag', x); } catch { /* נישט וויכטיג */ } }
  }
}

// ---------- טופס: א תשלום ----------
export function openPaymentForm(pay = {}, e) {
  if (!e) return;
  const p = { date: today(), payer_id: e.parent_id || e.contact_id, method: '', ...(pay || {}) };
  const isNew = !p.payment_id;
  if (isNew && !p.amount) p.amount = balance(e) > 0 ? balance(e) : (Number(e.tuition_amount) || '');
  if (isNew && !p.for_text) p.for_text = t('scForDefault', { name: contact(e.contact_id)?.first_name_he || '' });
  const dlg = $('#school-dialog'); const form = $('#school-form');
  const methods = state.lists.payment_method || [];
  form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>💲 ${h(isNew ? t('scAddPayment') : t('scEditPayment'))}</h2>
    <p class="muted">${h(nameOf(e.contact_id))} · ${h(e.org)}${Number(e.tuition_amount) ? ` · ${h(t('scBalance'))}: <b dir="ltr">${money(balance(e))}</b>` : ''}</p>
    <datalist id="dl-sc-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
    <div class="grid">
      <label class="wide">${h(t('scPayer'))}<input name="payer" list="dl-sc-contacts" autocomplete="off" value="${contact(p.payer_id) ? h(ui.pickerLabel(contact(p.payer_id))) : ''}"></label>
      <label>${h(t('scDate'))}<input type="date" name="date" value="${h(d10(p.date))}" required></label>
      <label>${h(t('xlAmount'))}<input type="number" name="amount" min="0" step="0.01" dir="ltr" value="${h(p.amount)}" required></label>
      <label>${h(t('paymentMethod'))}<select name="method"><option value=""></option>${methods.map((m) => `<option${m === p.method ? ' selected' : ''}>${h(m)}</option>`).join('')}</select></label>
      <label>${h(t('checkNumber'))}<input name="check_number" dir="ltr" value="${h(p.check_number || '')}"></label>
      <label>${h(t('cardLast4'))}<input name="card_last4" dir="ltr" inputmode="numeric" maxlength="4" pattern="\\d{4}" value="${h(p.card_last4 || '')}"></label>
      <label class="wide">${h(t('scForText'))}<input name="for_text" value="${h(p.for_text || '')}"></label>
      <label class="wide">${h(t('comments'))}<input name="note" value="${h(p.note || '')}"></label>
    </div>
    <div class="actions">
      ${!isNew ? `<button type="button" class="btn danger" data-del>${h(t('deleteBtn'))}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="submit" class="btn" data-and="receipt">🧾 ${h(t('scSaveReceipt'))}</button>
      <button type="submit" class="btn primary">${h(t('saveBtn'))}</button>
    </div>`;
  $$('[data-close]', form).forEach((b) => { b.onclick = () => dlg.close(); });
  const del = $('[data-del]', form);
  if (del) {
    del.onclick = async () => {
      if (p.receipt_no && !confirm(t('scDelPaidReceipt', { no: p.receipt_no }))) return;
      if (!p.receipt_no && !confirm(t('scDelPayment'))) return;
      try { await deleteRecord('Tuition', 'payment_id', p); await loadAll(); dlg.close(); ui.refreshAll(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  }
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const withReceipt = ev.submitter?.dataset.and === 'receipt';
    const last4 = form.elements.card_last4.value.trim();
    if (last4 && !/^\d{4}$/.test(last4)) { ui.toast(t('scLast4'), 'error'); return; }
    const payer = contactByLabel(form.elements.payer.value);
    const rec = {
      ...p, org: e.org, enroll_id: e.enroll_id, contact_id: e.contact_id, payer_id: payer ? payer.contact_id : (p.payer_id || ''),
      date: form.elements.date.value, amount: Number(form.elements.amount.value || 0), method: form.elements.method.value,
      check_number: form.elements.check_number.value.trim(), card_last4: last4, for_text: form.elements.for_text.value.trim(), note: form.elements.note.value.trim(),
    };
    if (!(rec.amount > 0)) { ui.toast(t('scNeedAmount'), 'error'); return; }
    try {
      rec.payment_id = await saveRecord('Tuition', 'payment_id', rec);
      dlg.close();
      await loadAll();
      ui.refreshAll();
      ui.toast(t('saved'));
      if (withReceipt) await receipt(rec.payment_id, 'print');
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  if (!dlg.open) dlg.showModal();
}

