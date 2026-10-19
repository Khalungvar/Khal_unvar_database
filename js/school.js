// דער בלאט פון א ישיבה (למשל ישיבת בית שערים): תלמידים מיט פון-ביז דאטומס, שכר לימוד, תשלומים און קבלות.
// אלעס אין צוויי לשוניות אין גליון — Enrollments (א תלמיד אין א ישיבה, פון ווען ביז ווען) און Tuition (תשלומים) —
// באזונדער פון די טעג'ס פונעם הויפט-מאגר. די תלמידים און עלטערן זענען די זעלבע קאנטאקטן ווי אומעטום.
// וועלכע ארגונים האבן אזא בלאט: Lists → school_org.
import { state, loadAll, saveRecord, deleteRecord, saveContact, addRelation, orgLogo } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, isTrue, splitTags, joinTags, formatPhone } from './util.js';
import { nextOccurrence, monthKeyFromHe, daysBetween, todayIso, hebrewNumber, isoToHebrewText } from './hebdate.js';
import { money } from './donations.js';
import { downloadXlsx } from './excel.js';
import { tuitionReceipt } from './receipts.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const BIRTHDAY = 'געבורטסטאג';
export const ST = { active: 'לומד', accepted: 'נתקבל', left: 'יצא' };

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
const enrollmentsOf = (org) => (state.enrollments || []).filter((e) => e.org === org && String(e.contact_id || '').trim());
const paymentsOf = (e) => (state.tuition || []).filter((p) => String(p.enroll_id) === String(e.enroll_id));
const d10 = (v) => String(v || '').slice(0, 10);

/** 'active' | 'accepted' | 'left' — אויף א געוויסן טאג */
export function statusOn(e, day = today()) {
  if (e.status === ST.left || (d10(e.end_date) && d10(e.end_date) < day)) return 'left';
  if (e.status === ST.accepted || (d10(e.start_date) && d10(e.start_date) > day)) return 'accepted';
  return 'active';
}

function monthsBetween(a, b) {
  if (!a || !b || b < a) return 0;
  const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

/** וויפיל מ'דארף צאלן ביז היינט */
export function charged(e) {
  const amt = Number(e.tuition_amount || 0);
  if (!amt) return 0;
  if (e.tuition_period === 'total') return amt;
  const start = d10(e.start_date);
  if (!start || start > today()) return 0;
  const end = [d10(e.end_date), today()].filter(Boolean).sort()[0];
  const months = monthsBetween(start, end);
  return e.tuition_period === 'year' ? Math.round((amt * months) / 12) : amt * months;
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
  const by = { active: [], accepted: [], left: [] };
  all.forEach((e) => by[statusOn(e, day)].push(e));
  const owing = all.filter((e) => balance(e) > 0);
  const tabs = [['active', '🎓', t('scTabActive'), by.active.length], ['accepted', '📝', t('scTabAccepted'), by.accepted.length],
    ['left', '🚪', t('scTabLeft'), by.left.length], ['tuition', '💲', t('scTabTuition'), owing.length], ['bdays', '🎂', t('scTabBdays'), '']];
  const logo = orgLogo(cur.org);
  main.innerHTML = `<div class="sc-head">
      ${logo ? `<img src="${logo}" alt="" class="sc-logo">` : '<span class="sc-logo-ph">🎓</span>'}
      <div><h1>${h(cur.org)}</h1><p class="muted small">${h(t('scSub', { a: by.active.length, b: all.length }))}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="sc-new">＋ ${h(t('scNewStudent'))}</button>
      <button type="button" class="btn" id="sc-contacts">👥 ${h(t('scContacts'))}</button>
      <button type="button" class="btn" id="sc-back">← ${h(t('lobbyBack'))}</button>
    </div>
    <nav class="sc-tabs">${tabs.map(([k, ic, l, n]) => `<button type="button" data-sc-tab="${k}" class="${cur.tab === k ? 'on' : ''}">${ic} ${h(l)}${n !== '' ? ` <span class="count-pill">${n}</span>` : ''}</button>`).join('')}</nav>
    <div id="sc-body">${cur.tab === 'tuition' ? tuitionHtml(all) : cur.tab === 'bdays' ? bdaysHtml(by.active.concat(by.accepted)) : listHtml(by[cur.tab], day)}</div>`;
  wire(main, all, by);
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
      <th>${h(t('scStudent'))}</th><th>${h(t('scParent'))}</th><th>${h(t('colMobile'))}</th><th>${h(t('scShiur'))}</th>
      <th>${h(t('scFrom'))}</th><th>${h(t('scTo'))}</th><th>${h(t('scBalance'))}</th><th></th></tr></thead>
      <tbody>${rows.map(rowHtml).join('')}</tbody></table></div>` : `<p class="muted">${h(t('scNone'))}</p>`}`;
}

function rowHtml(e) {
  const b = balance(e);
  return `<tr>
    <td><button type="button" class="linkish" data-open="${h(e.contact_id)}">${h(nameOf(e.contact_id) || `#${e.contact_id}`)}</button>${e.room ? `<div class="muted small">${h(t('scRoom'))}: ${h(e.room)}</div>` : ''}</td>
    <td>${e.parent_id ? `<button type="button" class="linkish" data-open="${h(e.parent_id)}">${h(nameOf(e.parent_id))}</button>` : '<span class="muted">—</span>'}</td>
    <td dir="ltr" class="small">${h(phoneOf(e.contact_id) || phoneOf(e.parent_id))}</td>
    <td>${h(e.shiur || '')}</td>
    <td class="small">${h(dateText(e.start_date))}</td><td class="small">${h(dateText(e.end_date))}</td>
    <td class="num ${b > 0 ? 'sc-owe' : ''}" dir="ltr">${Number(e.tuition_amount) ? money(b) : ''}</td>
    <td class="sc-acts"><button type="button" class="btn small-btn" data-edit="${h(e.enroll_id)}" title="${h(t('scEdit'))}">✎</button>
      <button type="button" class="btn small-btn" data-pay="${h(e.enroll_id)}" title="${h(t('scAddPayment'))}">💲</button></td></tr>`;
}

const dateText = (iso) => (d10(iso) ? `${isoToHebrewText(d10(iso))}` : '');

function tuitionHtml(all) {
  const sum = (fn) => all.reduce((s, e) => s + fn(e), 0);
  const owing = all.filter((e) => balance(e) > 0).sort((a, b) => balance(b) - balance(a));
  const pays = (state.tuition || []).filter((p) => p.org === cur.org).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 60);
  return `<div class="sc-stats">
      <div class="sc-stat"><span class="muted small">${h(t('scCharged'))}</span><b dir="ltr">${money(sum(charged))}</b></div>
      <div class="sc-stat"><span class="muted small">${h(t('scPaid'))}</span><b dir="ltr">${money(sum(paid))}</b></div>
      <div class="sc-stat sc-owe"><span class="muted small">${h(t('scBalance'))}</span><b dir="ltr">${money(sum(balance))}</b></div>
    </div>
    <h3>${h(t('scOwing'))}</h3>
    ${owing.length ? `<table class="lapsed-table sc-table"><thead><tr><th>${h(t('scStudent'))}</th><th>${h(t('scParent'))}</th><th>${h(t('scCharged'))}</th><th>${h(t('scPaid'))}</th><th>${h(t('scBalance'))}</th><th></th></tr></thead>
      <tbody>${owing.map((e) => `<tr><td><button type="button" class="linkish" data-open="${h(e.contact_id)}">${h(nameOf(e.contact_id))}</button></td>
        <td>${h(nameOf(e.parent_id))}</td><td class="num" dir="ltr">${money(charged(e))}</td><td class="num" dir="ltr">${money(paid(e))}</td>
        <td class="num sc-owe" dir="ltr">${money(balance(e))}</td><td><button type="button" class="btn small-btn" data-pay="${h(e.enroll_id)}">💲 ${h(t('scAddPayment'))}</button></td></tr>`).join('')}</tbody></table>`
      : `<p class="muted">${h(t('scNoneOwing'))}</p>`}
    <h3>${h(t('scPayments'))}</h3>
    ${pays.length ? paymentsTable(pays, true) : `<p class="muted">${h(t('scNoPayments'))}</p>`}`;
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
  const list = cur.tab === 'tuition' || cur.tab === 'bdays' ? all : filtered(all.filter((e) => statusOn(e, cur.asOf || today()) === cur.tab));
  const head = [t('scStudent'), t('scParent'), t('colMobile'), t('scParentPhone'), t('scShiur'), t('scRoom'), t('scStatus'), t('scFrom'), t('scTo'), t('scTuition'), t('scCharged'), t('scPaid'), t('scBalance'), t('scBirthday'), t('comments')];
  const stLabel = { active: ST.active, accepted: ST.accepted, left: ST.left };
  downloadXlsx(`${cur.org} - ${t('scFile')}`, head, list.map((e) => [nameOf(e.contact_id), nameOf(e.parent_id), phoneOf(e.contact_id), phoneOf(e.parent_id), e.shiur || '', e.room || '',
    stLabel[statusOn(e)], d10(e.start_date), d10(e.end_date), Number(e.tuition_amount || 0), charged(e), paid(e), balance(e), bdayText(birthdayOf(e.contact_id)), e.note || '']));
}

// ---------- אין כרטיס פונעם תלמיד / עלטערן ----------
export function schoolCount(c) {
  const id = String(c.contact_id);
  return (state.enrollments || []).filter((e) => String(e.contact_id) === id || String(e.parent_id) === id).length;
}

export function schoolSection(c) {
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

function personBlock(prefix, label, c, extra = '') {
  return `<fieldset class="sc-person" data-p="${prefix}"><legend>${h(label)}</legend>
    <label class="wide">${h(t('scPickExisting'))}<input name="${prefix}_pick" list="dl-sc-contacts" autocomplete="off" value="${c ? h(ui.pickerLabel(c)) : ''}" placeholder="${h(t('pickContact'))}"></label>
    <div class="sc-new"${c ? ' hidden' : ''}>
      <p class="hint-line">${h(t('scOrNew'))}</p>
      <div class="grid">
        <label>${h(t('scFirst'))}<input name="${prefix}_first"></label>
        <label>${h(t('scLast'))}<input name="${prefix}_last"></label>
        <label>${h(t('colMobile'))}<input name="${prefix}_mobile" dir="ltr" inputmode="tel"></label>
        ${extra}
      </div>
    </div></fieldset>`;
}

export function openEnrollForm(enroll = {}, preset = {}) {
  const e = { org: cur.org || preset.org || schoolOrgs()[0] || '', status: ST.active, tuition_period: 'month', start_date: today(), ...preset, ...(enroll || {}) };
  const isNew = !e.enroll_id;
  const dlg = $('#school-dialog'); const form = $('#school-form');
  const shiurim = [...new Set(enrollmentsOf(e.org).map((x) => x.shiur).filter(Boolean))];
  form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>${h(isNew ? t('scNewStudent') : t('scEditStudent'))}</h2>
    ${schoolOrgs().length > 1 ? `<label>${h(t('orgKollel'))}<select name="org">${schoolOrgs().map((o) => `<option${o === e.org ? ' selected' : ''}>${h(o)}</option>`).join('')}</select></label>` : `<input type="hidden" name="org" value="${h(e.org)}">`}
    <datalist id="dl-sc-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
    ${personBlock('s', t('scStudent'), contact(e.contact_id))}
    ${personBlock('p', t('scParent'), contact(e.parent_id), `<label>${h(t('colHome'))}<input name="p_home" dir="ltr" inputmode="tel"></label>`)}
    <fieldset><legend>${h(t('scLearning'))}</legend>
      <div class="grid">
        <label>${h(t('scStatus'))}<select name="status">${Object.values(ST).map((s) => `<option${s === e.status ? ' selected' : ''}>${h(s)}</option>`).join('')}</select></label>
        <label>${h(t('scFrom'))}<input type="date" name="start_date" value="${h(d10(e.start_date))}"></label>
        <label>${h(t('scTo'))}<input type="date" name="end_date" value="${h(d10(e.end_date))}"></label>
        <label>${h(t('scShiur'))}<input name="shiur" list="dl-sc-shiur" value="${h(e.shiur || '')}"></label>
        <datalist id="dl-sc-shiur">${shiurim.map((x) => `<option value="${h(x)}">`).join('')}</datalist>
        <label>${h(t('scRoom'))}<input name="room" value="${h(e.room || '')}"></label>
      </div>
      <p class="hint-line sc-heb" data-heb></p>
    </fieldset>
    <fieldset><legend>${h(t('scTuition'))}</legend>
      <div class="grid">
        <label>${h(t('xlAmount'))}<input name="tuition_amount" type="number" min="0" step="1" dir="ltr" value="${h(e.tuition_amount || '')}"></label>
        <label>${h(t('scPeriod'))}<select name="tuition_period">${['month', 'year', 'total'].map((p) => `<option value="${p}"${p === (e.tuition_period || 'month') ? ' selected' : ''}>${h(t(`scPer_${p}`))}</option>`).join('')}</select></label>
      </div>
    </fieldset>
    <label class="wide">${h(t('comments'))}<textarea name="note" rows="2">${h(e.note || '')}</textarea></label>
    <div class="actions">
      ${!isNew ? `<button type="button" class="btn danger" data-del>${h(t('deleteBtn'))}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="submit" class="btn primary">${h(t('saveBtn'))}</button>
    </div>`;
  const heb = () => {
    const a = form.elements.start_date.value; const b = form.elements.end_date.value;
    $('[data-heb]', form).textContent = [a ? `${t('scFrom')}: ${isoToHebrewText(a)}` : '', b ? `${t('scTo')}: ${isoToHebrewText(b)}` : ''].filter(Boolean).join(' · ');
  };
  form.elements.start_date.oninput = heb; form.elements.end_date.oninput = heb; heb();
  form.elements.end_date.addEventListener('change', () => {
    if (form.elements.end_date.value && form.elements.end_date.value < today()) form.elements.status.value = ST.left;
  });
  ['s', 'p'].forEach((p) => {
    const inp = form.elements[`${p}_pick`];
    const sync = () => { $(`[data-p="${p}"] .sc-new`, form).hidden = Boolean(contactByLabel(inp.value)); };
    inp.oninput = sync;
  });
  // דער משפחה-נאמען פונעם תלמיד → אויך פארן טאטע
  form.elements.s_last.oninput = () => { if (!form.elements.p_last.dataset.touched) form.elements.p_last.value = form.elements.s_last.value; };
  form.elements.p_last.oninput = () => { form.elements.p_last.dataset.touched = '1'; };
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

/** א פערזאן פונעם טופס: א קאנטאקט וואס איז שוין דא, אדער א נייער (מיט דער ישיבה אין 'כולל/ישיבה') */
async function personFrom(form, p, org, extraPhones = {}) {
  const picked = contactByLabel(form.elements[`${p}_pick`].value);
  if (picked) return picked.contact_id;
  const first = form.elements[`${p}_first`].value.trim();
  const last = form.elements[`${p}_last`].value.trim();
  if (!first && !last) return '';
  if (!first || !last) throw new Error(t('scNeedName'));
  const id = await saveContact({ first_name_he: first, last_name_he: last, kollel: org, marital_status: p === 's' ? 'בחור' : '' },
    { mobile: formatPhone(form.elements[`${p}_mobile`].value), ...extraPhones });
  state.contacts.push({ contact_id: id, first_name_he: first, last_name_he: last, kollel: org });
  return id;
}

/** דער קאנטאקט האט די ישיבה אין 'כולל/ישיבה' (און "פריער" ווען ער איז ארויס) */
async function ensureOrg(id, org, left) {
  const c = state.contacts.find((x) => String(x.contact_id) === String(id));
  if (!c || !c.first_name_he) return;
  const has = splitTags(c.kollel);
  const only = has.length <= 1;
  const next = { ...c };
  delete next._row;
  let changed = false;
  if (!has.includes(org)) { next.kollel = joinTags([...has, org]); changed = true; }
  if (only && (isTrue(c.kollel_former) !== Boolean(left))) { next.kollel_former = Boolean(left); changed = true; }
  if (changed) await saveContact(next, state.phones.get(String(id)) || {});
}

async function saveEnrollForm(form, e) {
  const org = form.elements.org.value;
  const studentId = await personFrom(form, 's', org);
  if (!studentId) throw new Error(t('scNeedStudent'));
  const parentId = await personFrom(form, 'p', org, { home_phone: formatPhone(form.elements.p_home.value) });
  const rec = {
    ...e, org, contact_id: studentId, parent_id: parentId,
    status: form.elements.status.value, start_date: form.elements.start_date.value, end_date: form.elements.end_date.value,
    shiur: form.elements.shiur.value.trim(), room: form.elements.room.value.trim(),
    tuition_amount: form.elements.tuition_amount.value, tuition_period: form.elements.tuition_period.value, note: form.elements.note.value.trim(),
  };
  if (rec.end_date && rec.start_date && rec.end_date < rec.start_date) throw new Error(t('scBadDates'));
  await saveRecord('Enrollments', 'enroll_id', rec);
  const left = statusOn(rec) === 'left';
  await ensureOrg(studentId, org, left);
  // דער קשר: זון פון ← טאטע (אויב נאך נישטא)
  if (parentId && !state.relations.some((r) => String(r.contact_id_a) === String(studentId) && String(r.contact_id_b) === String(parentId))) {
    await addRelation(studentId, 'זון פון', parentId);
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

