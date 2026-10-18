// נדבות (תרומות): מסך רשימה, טופס הוספה/עריכה, וחלק בכרטיס האישי.
import { state, loadAll, saveDonation, saveDonations, deleteDonation, saveCampaignMeta } from './data.js';
import { t } from './i18n.js';
import { isTrue, splitTags, joinTags, escapeHtml as h } from './util.js';
import {
  toHebrew, fromHebrew, monthsOf, yearLabel, formatHebrew, isoToHebrewText,
  parseHebrewText, todayIso, hebrewNumber,
} from './hebdate.js';

let ui = null; // עזרים מהמסך הראשי (נמסרים ב-initDonations)
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const KAVE = 'קאווע';
const CHECK = 'צ\'ק';
const CARD = 'כרטיס אשראי';
const OTHER = 'אחר';

export function initDonations(helpers) {
  ui = helpers;
  $('#don-search').addEventListener('input', renderDonations);
  $('#don-tag').addEventListener('change', renderDonations);
  $('#don-year').addEventListener('change', renderDonations);
  $('#don-org').addEventListener('change', renderDonations);
  $('#don-unpaid').addEventListener('change', renderDonations);
  $('#btn-new-donation').onclick = () => openDonationForm();
  $('#btn-campaign').onclick = () => openCampaign();
  $('#campaign-side').addEventListener('click', (e) => {
    const b = e.target.closest('.org-link');
    if (b) ui.openCampaignPage(b.dataset.name);
  });
  $('#campaign-main').addEventListener('click', (e) => {
    const row = e.target.closest('.don-row');
    if (row) openDonationForm(state.donations.find((d) => String(d.donation_id) === row.dataset.id));
  });
  $('#don-list').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openDonationForm(state.donations.find((d) => String(d.donation_id) === row.dataset.id));
  });
}

const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function contactName(id) {
  const c = ui.contactById(id);
  return c ? ui.fullNameHe(c) : `#${id}`;
}

// ---------- לאיזה ארגון שייכת הנדבה ----------
const ORG_LISTS = [['beis_medrash', 'orgBeisMedrash'], ['kollel', 'orgKollel'], ['organization', 'orgOrganization']];

function allOrgs() {
  return ORG_LISTS.flatMap(([name]) => state.lists[name] || []);
}

/** <select> עם כל הארגונים, מחולק לפי ביהמ"ד / כולל / ארגון. */
function orgSelect(name, value, extra = '') {
  const known = allOrgs();
  return `<select name="${name}" ${extra}><option value=""></option>${ORG_LISTS.map(([list, label]) => {
    const vals = state.lists[list] || [];
    return vals.length ? `<optgroup label="${h(t(label))}">${vals.map((v) => `<option${v === value ? ' selected' : ''}>${h(v)}</option>`).join('')}</optgroup>` : '';
  }).join('')}${value && !known.includes(value) ? `<option selected>${h(value)}</option>` : ''}</select>`;
}

export function campaignOrg(name) {
  return name ? String(state.campaigns.find((c) => c.campaign === name)?.org || '') : '';
}

/** הארגון של הנדבה: של הקאמפיין (אם מוגדר), אחרת מה שנבחר בנדבה. */
function effectiveOrg(d) {
  return campaignOrg(d.campaign) || String(d.org || '');
}

/** שם הנדבן: איש קשר, או שם שנכתב (מישהו שלא ברשימה). */
function donorName(d) {
  return d.contact_id ? contactName(d.contact_id) : String(d.donor_name || '');
}

function currentHebYear() {
  return toHebrew(todayIso()).y;
}

/** אילו שנים להציג: מה שיש בנתונים + השנה הנוכחית ±2. */
function yearOptions(extra = []) {
  const y = currentHebYear();
  const fromData = state.donations.map((d) => d.event_year).filter(Boolean);
  const range = [y - 2, y - 1, y, y + 1, y + 2].map(yearLabel);
  return [...new Set([...range, ...fromData, ...extra.filter(Boolean)])];
}

// ---------- מסך הנדבות ----------
export function fillDonationFilters() {
  const orgSel = $('#don-org');
  const ov = orgSel.value;
  orgSel.outerHTML = orgSelect('don-org-tmp', '', 'id="don-org-new"');
  const ns = $('#don-org-new');
  ns.id = 'don-org';
  ns.removeAttribute('name');
  ns.options[0].textContent = t('allOrgsDon');
  ns.value = ov;
  ns.addEventListener('change', renderDonations);
  const tag = $('#don-tag');
  const tv = tag.value;
  tag.innerHTML = `<option value="">${h(t('allEvents'))}</option>`
    + (state.lists.event_tag || []).map((v) => `<option>${h(v)}</option>`).join('');
  tag.value = tv;
  const year = $('#don-year');
  const yv = year.value;
  year.innerHTML = `<option value="">${h(t('allYears'))}</option>`
    + yearOptions().map((v) => `<option>${h(v)}</option>`).join('');
  year.value = yv;
}

function visibleDonations() {
  const q = $('#don-search').value.trim();
  const tag = $('#don-tag').value;
  const year = $('#don-year').value;
  const unpaid = $('#don-unpaid').checked;
  const org = $('#don-org')?.value || '';
  return state.donations
    .filter((d) => !org || effectiveOrg(d) === org)
    .filter((d) => !tag || splitTags(d.event_tags).includes(tag))
    .filter((d) => !year || d.event_year === year)
    .filter((d) => !unpaid || !isTrue(d.is_paid))
    .filter((d) => !q || donorName(d).includes(q) || String(d.event_note).includes(q)
      || String(d.dedication_text).includes(q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.donation_id) - Number(a.donation_id));
}

function donationRow(d, withName = true) {
  const paid = isTrue(d.is_paid);
  const tags = splitTags(d.event_tags).map((x) => `<span class="chip">${h(x)}</span>`).join('');
  return `<button type="button" class="row don-row" data-id="${h(d.donation_id)}">
    <span class="row-main">
      ${withName ? `<span class="row-name">${h(donorName(d))}${d.contact_id ? '' : ` <span class="badge muted">${h(t('notInList'))}</span>`}</span>` : ''}
      <span class="muted small">${h(d.hebrew_date || isoToHebrewText(d.date))}${d.date ? ` · <span dir="ltr">${h(d.date)}</span>` : ''}</span>
    </span>
    <span class="row-tags">${effectiveOrg(d) ? `<span class="badge org">${h(effectiveOrg(d))}</span> ` : ''}${tags}${d.event_year ? ` <span class="muted small">${h(d.event_year)}</span>` : ''}</span>
    <span class="don-amount">${money(d.amount_usd)}
      <span class="badge ${paid ? 'paid' : 'unpaid'}">${paid ? t('paid') : t('unpaid')}</span></span>
  </button>`;
}

export function renderDonations() {
  if (!$('#don-list')) return;
  const list = visibleDonations();
  const total = list.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const open = list.filter((d) => !isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  $('#don-summary').innerHTML = `${h(t('donCount', { n: list.length }))} · ${h(t('donTotal'))} <b>${money(total)}</b>`
    + (open ? ` · ${h(t('donOpen'))} <b class="unpaid-text">${money(open)}</b>` : '');
  $('#don-list').innerHTML = list.length ? list.map((d) => donationRow(d)).join('')
    : `<p class="empty">${h(state.donations.length ? t('noResults') : t('noDonations'))}</p>`;
}

// ---------- חלק בכרטיס האישי ----------
export function donationsSection(c) {
  const mine = state.donations.filter((d) => String(d.contact_id) === String(c.contact_id))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const total = mine.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  return `<section class="card-donations">
    <h3>${t('donations')}${mine.length ? ` · ${money(total)}` : ''}</h3>
    <div class="list compact">${mine.map((d) => donationRow(d, false)).join('')}</div>
    <button type="button" class="btn small-btn" id="card-new-donation">${t('newDonation')}</button>
  </section>`;
}

export function wireDonationsSection(c) {
  const box = $('#card-body .card-donations');
  if (!box) return;
  $$('.don-row', box).forEach((r) => {
    r.onclick = () => openDonationForm(state.donations.find((d) => String(d.donation_id) === r.dataset.id), c.contact_id);
  });
  $('#card-new-donation', box).onclick = () => openDonationForm({}, c.contact_id);
}

// ---------- בורר תאריך עברי ----------
function hebPicker(name, value) {
  const hv = value || {};
  const y = hv.y || currentHebYear();
  const years = [];
  for (let i = y - 3; i <= y + 3; i += 1) years.push(i);
  return `<span class="heb-picker" data-name="${name}">
    <select class="hp-d"><option value=""></option>${Array.from({ length: 30 }, (_, i) => i + 1)
      .map((d) => `<option value="${d}"${d === hv.d ? ' selected' : ''}>${hebrewNumber(d)}</option>`).join('')}</select>
    <select class="hp-m"><option value=""></option>${monthsOf(y)
      .map((m) => `<option value="${m.key}"${m.key === hv.m ? ' selected' : ''}>${m.he}</option>`).join('')}</select>
    <select class="hp-y">${years.map((v) => `<option value="${v}"${v === y ? ' selected' : ''}>${yearLabel(v)}</option>`).join('')}</select>
  </span>`;
}

function readPicker(box) {
  const d = Number($('.hp-d', box).value);
  const m = $('.hp-m', box).value;
  const y = Number($('.hp-y', box).value);
  return d && m && y ? { d, m, y } : null;
}

function setPicker(box, hv) {
  if (!hv) return;
  const ySel = $('.hp-y', box);
  if (![...ySel.options].some((o) => Number(o.value) === hv.y)) {
    ySel.insertAdjacentHTML('beforeend', `<option value="${hv.y}">${yearLabel(hv.y)}</option>`);
  }
  ySel.value = String(hv.y);
  refreshMonths(box);
  $('.hp-m', box).value = hv.m;
  $('.hp-d', box).value = String(hv.d);
}

/** בשנה מעוברת יש אדר א' ואדר ב' — מעדכנים את רשימת החודשים לפי השנה שנבחרה. */
function refreshMonths(box) {
  const y = Number($('.hp-y', box).value);
  const mSel = $('.hp-m', box);
  const cur = mSel.value;
  mSel.innerHTML = '<option value=""></option>' + monthsOf(y).map((m) => `<option value="${m.key}">${m.he}</option>`).join('');
  const fallback = { Adar: 'Adar II', 'Adar II': 'Adar', 'Adar I': 'Adar' }[cur];
  mSel.value = [...mSel.options].some((o) => o.value === cur) ? cur : (fallback || '');
}

// ---------- טופס תרומה ----------
export function openDonationForm(donation = {}, presetContactId = null) {
  const d = { ...donation };
  const isNew = !d.donation_id;
  if (isNew) {
    d.contact_id = presetContactId || '';
    d.date = todayIso();
    d.is_paid = true; // ברירת מחדל: שולם
    d.paid_date = todayIso();
  }
  const contact = d.contact_id ? ui.contactById(d.contact_id) : null;
  const hDate = toHebrew(d.date || todayIso());
  const methods = state.lists.payment_method || [];
  const form = $('#donation-form');

  form.innerHTML = `
    <button type="button" class="x-close" id="don-x" aria-label="${h(t('close'))}">✕</button>
    <h2>${isNew ? t('newDonationTitle') : t('editDonationTitle')}</h2>

    <div class="don-quick">
      <div class="donor-line"${contact ? '' : ' hidden'}>
        <strong>${contact ? h(ui.fullNameHe(contact)) : ''}</strong>
        <button type="button" class="linkish" id="don-change-donor">${t('change')}</button>
      </div>
      <label class="wide donor-pick"${contact ? ' hidden' : ''}>${t('donor')}
        <input name="contact" list="dl-don-contacts" autocomplete="off" placeholder="${h(t('pickContact'))}" value="${contact ? h(ui.pickerLabel(contact)) : h(d.donor_name || '')}">
      </label>
      <datalist id="dl-don-contacts">${state.contacts.filter((x) => isTrue(x.is_active) || x.is_active === '')
        .map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>

      <div class="amount-line">
        <label class="amount-box">${t('amount')}
          <span class="amount-wrap"><span>$</span><input name="amount_usd" type="number" min="0" step="0.01" dir="ltr" inputmode="decimal" value="${h(d.amount_usd ?? '')}"></span>
        </label>
        <label class="check paid-toggle"><input type="checkbox" name="is_paid" ${isTrue(d.is_paid) ? 'checked' : ''}> ${t('paid')}</label>
      </div>

      <label class="wide org-pick">${t('forOrg')} *
        ${orgSelect('org', campaignOrg(d.campaign) || d.org || '')}
        <span class="hint-line camp-org-note" hidden>${t('orgFromCampaign')}</span>
      </label>

      <div class="quick-block">
        <span class="quick-label">${t('eventLegend')}</span>
        ${ui.tagPicker('event_tags', 'event_tag', d.event_tags)}
      </div>

      <div class="kave-period"${splitTags(d.event_tags).includes(KAVE) ? '' : ' hidden'}>
        <p class="hint-line">${t('kavePeriod')}</p>
        <div class="grid">
          <label>${t('fromDate')}${hebPicker('sponsor_from', parseHebrewText(d.sponsor_from))}</label>
          <label>${t('toDate')}${hebPicker('sponsor_to', parseHebrewText(d.sponsor_to))}</label>
        </div>
      </div>

      <div class="grid paid-only">
        <label>${t('paymentMethod')}<select name="payment_method">${ui.options(methods, d.payment_method)}</select></label>
        <label class="pm pm-check">${t('checkNumber')}<input name="check_number" dir="ltr" inputmode="numeric" value="${h(d.check_number || '')}"></label>
        <label class="pm pm-card">${t('cardLast4')}<input name="card_last4" dir="ltr" inputmode="numeric" maxlength="4" value="${h(d.card_last4 || '')}"></label>
        <label class="pm pm-other wide">${t('paymentNote')}<input name="payment_note" value="${h(d.payment_note || '')}"></label>
      </div>

      <div class="date-line">
        <span class="quick-label">${t('dateLegend')}:</span>
        <span class="date-text"></span>
        <button type="button" class="linkish" id="don-change-date">${t('change')}</button>
      </div>
      <div class="grid date-edit" hidden>
        <label>${t('gregDate')}<input type="date" name="date" value="${h(d.date || '')}"></label>
        <label>${t('hebDate')}${hebPicker('date', hDate)}</label>
      </div>
    </div>

    <details class="more"${d.event_note || d.campaign || d.paid_note || d.dedication_type || d.dedication_text ? ' open' : ''}>
      <summary>${t('moreDetails')}</summary>
      <div class="grid">
        <label>${t('eventYear')}<select name="event_year">${yearOptions([d.event_year])
          .map((y) => `<option${y === (d.event_year || yearLabel(hDate.y)) ? ' selected' : ''}>${h(y)}</option>`).join('')}</select></label>
        <label class="wide">${t('comments')}<input name="event_note" value="${h(d.event_note || '')}"></label>
        <label class="wide">${t('campaignName')}<input name="campaign" list="dl-campaigns-one" autocomplete="off" value="${h(d.campaign || '')}"></label>
        <datalist id="dl-campaigns-one">${campaignNames().map((c) => `<option value="${h(c.name)}">`).join('')}</datalist>
        <label class="paid-only">${t('paidDate')}<input type="date" name="paid_date" value="${h(d.paid_date || '')}"></label>
        <label class="wide">${t('paidNote')}<input name="paid_note" value="${h(d.paid_note || '')}"></label>
        <label>${t('dedicationType')}<select name="dedication_type">${ui.options(state.lists.dedication_type, d.dedication_type)}</select></label>
        <label class="wide">${t('dedicationText')}<input name="dedication_text" value="${h(d.dedication_text || '')}"></label>
      </div>
      <p class="hint-line">${t('dedicationHint')}</p>
    </details>

    <div class="actions">
      ${!isNew && state.isAdmin ? `<button type="button" class="btn danger" id="don-delete">${t('deleteBtn')}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" id="don-cancel">${t('cancelBtn')}</button>
      <button type="submit" class="btn primary" id="don-save">${t('saveBtn')}</button>
    </div>`;

  wireDonationForm(form, d);
  if (!$('#donation-dialog').open) $('#donation-dialog').showModal();
  $('#donation-dialog').scrollTop = 0;
  (contact ? form.elements.amount_usd : form.elements.contact).focus();
}

function wireDonationForm(form, original) {
  const f = (n) => form.elements[n];
  const datePicker = $('.heb-picker[data-name="date"]', form);
  form.dataset.dirty = '';
  form.addEventListener('input', () => { form.dataset.dirty = '1'; });
  form.addEventListener('change', () => { form.dataset.dirty = '1'; });

  // שנה עברית בבורר → רשימת חודשים מתעדכנת (אדר א'/ב')
  $$('.heb-picker', form).forEach((p) => $('.hp-y', p).addEventListener('change', () => refreshMonths(p)));

  // תאריך לועזי ↔ עברי
  const syncYear = (hv) => {
    if (!hv) return;
    const label = yearLabel(hv.y);
    const sel = f('event_year');
    if (![...sel.options].some((o) => o.value === label)) sel.insertAdjacentHTML('beforeend', `<option>${label}</option>`);
    if (!original.event_year) sel.value = label;
  };
  // שורת התאריך: "היינט · ז' חשון" — לחיצה על "טוישן" פותחת את הבוררים
  const dateText = () => {
    const iso = f('date').value;
    const he = iso ? isoToHebrewText(iso) : '';
    $('.date-text', form).textContent = iso === todayIso() ? `${t('today')} · ${he}` : `${he} · ${iso}`;
  };
  dateText();
  $('#don-change-date', form).onclick = () => {
    $('.date-edit', form).hidden = false;
    $('.date-line', form).hidden = true;
  };
  $('#don-change-donor', form).onclick = () => {
    $('.donor-pick', form).hidden = false;
    $('.donor-line', form).hidden = true;
    f('contact').select();
  };
  f('date').addEventListener('change', () => {
    const hv = toHebrew(f('date').value);
    if (hv) { setPicker(datePicker, hv); syncYear(hv); }
    dateText();
  });
  datePicker.addEventListener('change', () => {
    const hv = readPicker(datePicker);
    if (!hv) return;
    const iso = fromHebrew(hv.d, hv.m, hv.y);
    if (iso) { f('date').value = iso; syncYear(hv); dateText(); } else ui.toast(t('noSuchDate'), 'error');
  });

  // תגיות: קאווע → מציגים תקופת חסות
  const kave = $('.kave-period', form);
  $('.tags[data-name="event_tags"]', form).addEventListener('click', () => {
    setTimeout(() => { kave.hidden = !splitTags(ui.readTags(form, 'event_tags')).includes(KAVE); }, 0);
  });
  ui.wireTagPicker($('.tags[data-name="event_tags"]', form));

  // שולם → תאריך תשלום מתמלא בהיום
  const paidOnly = () => { $$('.paid-only', form).forEach((el) => { el.hidden = !f('is_paid').checked; }); };
  f('is_paid').addEventListener('change', () => {
    if (f('is_paid').checked && !f('paid_date').value) f('paid_date').value = todayIso();
    paidOnly();
  });
  paidOnly();

  // קאמפיין עם ארגון → הארגון נקבע לבד (אפור)
  const syncOrg = () => {
    const co = campaignOrg(f('campaign').value.trim());
    $('.camp-org-note', form).hidden = !co;
    f('org').disabled = Boolean(co);
    f('org').classList.toggle('suggested', Boolean(co));
    if (co) {
      if (![...f('org').options].some((o) => o.value === co)) f('org').insertAdjacentHTML('beforeend', `<option>${h(co)}</option>`);
      f('org').value = co;
    }
  };
  f('campaign').addEventListener('change', syncOrg);
  f('campaign').addEventListener('input', syncOrg);
  syncOrg();

  // אמצעי תשלום → השדה המתאים
  const pm = () => {
    const v = f('payment_method').value;
    $('.pm-check', form).hidden = v !== CHECK;
    $('.pm-card', form).hidden = v !== CARD;
    $('.pm-other', form).hidden = v !== OTHER;
  };
  f('payment_method').addEventListener('change', pm);
  pm();
  f('card_last4').addEventListener('input', () => { f('card_last4').value = f('card_last4').value.replace(/\D/g, '').slice(0, 4); });

  const close = () => {
    if (form.dataset.dirty && !confirm(t('discardChanges'))) return;
    form.dataset.dirty = '';
    $('#donation-dialog').close();
  };
  $('#don-cancel', form).onclick = close;
  $('#don-x', form).onclick = close;
  form._close = close;

  $('#don-delete', form)?.addEventListener('click', async () => {
    if (!confirm(t('confirmDeleteDonation'))) return;
    try {
      await deleteDonation(original);
      await loadAll();
      form.dataset.dirty = '';
      $('#donation-dialog').close();
      ui.refreshAll();
      ui.toast(t('donationDeleted'));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const m = f('contact').value.match(/\(#(\d+)\)/);
    const oneTime = !m && original.donor_name && f('contact').value.trim() === original.donor_name;
    if (!oneTime && (!m || !ui.contactById(m[1]))) { ui.toast(t('pickValid'), 'error'); return; }
    const amount = f('amount_usd').value;
    if (amount === '' || Number(amount) < 0) { ui.toast(t('amountRequired'), 'error'); return; }
    const orgValue = campaignOrg(f('campaign').value.trim()) || f('org').value;
    if (!orgValue) { ui.toast(t('orgRequired'), 'error'); f('org').focus(); return; }
    const tags = ui.readTags(form, 'event_tags');
    const method = f('payment_method').value;
    const from = readPicker($('.heb-picker[data-name="sponsor_from"]', form));
    const to = readPicker($('.heb-picker[data-name="sponsor_to"]', form));
    const hv = readPicker(datePicker);
    const donation = {
      ...original,
      contact_id: oneTime ? '' : Number(m[1]),
      donor_name: oneTime ? original.donor_name : '',
      date: f('date').value,
      hebrew_date: hv ? formatHebrew(hv) : '',
      event_tags: tags,
      event_year: f('event_year').value,
      event_note: f('event_note').value.trim(),
      campaign: f('campaign').value.trim(),
      org: orgValue,
      sponsor_from: splitTags(tags).includes(KAVE) && from ? formatHebrew(from) : '',
      sponsor_to: splitTags(tags).includes(KAVE) && to ? formatHebrew(to) : '',
      amount_usd: Number(amount),
      is_paid: f('is_paid').checked,
      paid_date: f('is_paid').checked ? f('paid_date').value : '',
      paid_note: f('paid_note').value.trim(),
      payment_method: method,
      check_number: method === CHECK ? f('check_number').value.trim() : '',
      card_last4: method === CARD ? f('card_last4').value.trim() : '',
      payment_note: method === OTHER ? f('payment_note').value.trim() : '',
      dedication_type: f('dedication_type').value,
      dedication_text: f('dedication_text').value.trim(),
    };
    const btn = $('#don-save', form);
    btn.disabled = true;
    btn.textContent = t('saving');
    try {
      await saveDonation(donation);
      await loadAll();
      form.dataset.dirty = '';
      $('#donation-dialog').close();
      ui.refreshAll();
      ui.toast(t('donationSaved'));
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('saveBtn');
    }
  };
}



// ---------- קאמפיינס: תפריט צד ודף לכל קאמפיין ----------
let currentCampaign = '';

export function renderCampaignSide() {
  const side = $('#campaign-side');
  if (!side) return;
  const active = !$('.view[data-view="campaign"]').hidden;
  const list = campaignNames();
  side.innerHTML = list.length ? list.map((c) => `<button type="button" class="org-link${active && c.name === currentCampaign ? ' on' : ''}" data-name="${h(c.name)}">
      <span>${h(c.name)}</span><span class="side-sum">${money(c.total)}</span></button>`).join('')
    : `<p class="muted small side-empty">${h(t('noCampaigns'))}</p>`;
}

export function renderCampaignPage() {
  const main = $('#campaign-main');
  if (!main) return;
  const list = state.donations.filter((d) => d.campaign === currentCampaign)
    .sort((a, b) => Number(b.amount_usd || 0) - Number(a.amount_usd || 0) || donorName(a).localeCompare(donorName(b), 'he'));
  if (!list.length) { main.innerHTML = `<p class="empty">${h(t('noCampaigns'))}</p>`; return; }
  const total = list.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const open = list.filter((d) => !isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const donors = new Set(list.map((d) => d.contact_id || `n:${d.donor_name}`)).size;
  const tags = [...new Set(list.flatMap((d) => splitTags(d.event_tags)))];
  const years = [...new Set(list.map((d) => d.event_year).filter(Boolean))];
  main.innerHTML = `<div class="camp-page-head">
      <div><h2>${h(currentCampaign)}</h2>
        <p class="muted">${tags.map((x) => `<span class="chip">${h(x)}</span>`).join(' ')} ${h(years.join(', '))}</p>
        <label class="camp-org-line">${t('campaignOrg')}: ${orgSelect('camp_page_org', campaignOrg(currentCampaign))}</label></div>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="camp-add-more">${t('campaignAddMore')}</button>
    </div>
    <div class="camp-stats">
      <div><span>${t('donTotal')}</span><b>${money(total)}</b></div>
      <div><span>${t('campaignDonors')}</span><b>${donors}</b></div>
      <div><span>${t('paid')}</span><b>${money(total - open)}</b></div>
      <div><span>${t('unpaid')}</span><b class="${open ? 'unpaid-text' : ''}">${money(open)}</b></div>
    </div>
    <div class="list">${list.map((d) => donationRow(d)).join('')}</div>`;
  const orgSel = $('select[name=camp_page_org]', main);
  orgSel.onchange = async () => {
    if (!orgSel.value) return;
    try {
      await saveCampaignMeta(currentCampaign, orgSel.value);
      await loadAll();
      ui.refreshAll();
      ui.toast(t('campaignOrgSaved'));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  $('#camp-add-more', main).onclick = () => openCampaign({
    campaign: currentCampaign, event_tags: tags.join(', '), event_year: years[0] || '',
  });
}

export function setCampaign(name) {
  currentCampaign = name;
}

// ---------- קאמפיין: הרבה נדבות בבת אחת ----------
// פרטים משותפים למעלה (געלעגנהייט, יאר, דאטום), ואחר כך שורה לכל נדבה.
// נדבן שלא ברשימה: כותבים את השם, והנדבה נשמרת עם השם (בלי איש קשר).

function campaignRow(i) {
  const methods = state.lists.payment_method || [];
  return `<tr class="camp-row">
    <td class="num">${i}</td>
    <td class="donor-cell"><input name="c_contact" list="dl-camp-contacts" autocomplete="off" placeholder="${h(t('donorPh'))}">
      <span class="badge muted one-time" hidden>${h(t('notInList'))}</span></td>
    <td><input name="c_amount" type="number" min="0" step="0.01" dir="ltr" inputmode="decimal"></td>
    <td class="center"><input type="checkbox" name="c_paid"></td>
    <td><select name="c_method">${ui.options(methods, '')}</select></td>
    <td><input name="c_ref" dir="ltr" placeholder=""></td>
    <td><input name="c_note"></td>
    <td><button type="button" class="linkish c-del" title="${h(t('deleteBtn'))}">✕</button></td>
  </tr>`;
}

function campaignNames() {
  const seen = new Map();
  state.donations.forEach((d) => {
    const n = String(d.campaign || '').trim();
    if (!n) return;
    const cur = seen.get(n) || { name: n, total: 0, count: 0, last: '' };
    cur.total += Number(d.amount_usd || 0);
    cur.count += 1;
    if (String(d.date) > cur.last) cur.last = String(d.date);
    seen.set(n, cur);
  });
  return [...seen.values()].sort((a, b) => b.last.localeCompare(a.last) || a.name.localeCompare(b.name, 'he'));
}

/** preset = { campaign, event_tags, event_year } כשמוסיפים לקאמפיין שכבר קיים. */
export function openCampaign(preset = {}) {
  const form = $('#campaign-form');
  const today = todayIso();
  const hy = toHebrew(today).y;
  form.innerHTML = `
    <button type="button" class="x-close" id="camp-x" aria-label="${h(t('close'))}">✕</button>
    <h2>${t('campaignTitle')}</h2>
    <fieldset class="camp-common"><legend>${t('campaignCommon')}</legend>
      <label class="wide camp-name">${t('campaignName')} *
        <input name="campaign" list="dl-campaigns" autocomplete="off" value="${h(preset.campaign || '')}" placeholder="${h(t('campaignNamePh'))}">
      </label>
      <datalist id="dl-campaigns">${campaignNames().map((c) => `<option value="${h(c.name)}">`).join('')}</datalist>
      <label class="wide org-pick">${t('campaignOrg')} *
        ${orgSelect('org', campaignOrg(preset.campaign) || '')}
      </label>
      <div class="quick-block">
        <span class="quick-label">${t('eventLegend')}</span>
        ${ui.tagPicker('event_tags', 'event_tag', preset.event_tags || '')}
      </div>
      <div class="grid">
        <label>${t('eventYear')}<select name="event_year">${yearOptions([preset.event_year]).map((y) => `<option${y === (preset.event_year || yearLabel(hy)) ? ' selected' : ''}>${h(y)}</option>`).join('')}</select></label>
        <label>${t('gregDate')}<input type="date" name="date" value="${today}"><span class="hint-line camp-heb">${h(isoToHebrewText(today))}</span></label>
        <label class="wide">${t('campaignNote')}<input name="common_note"></label>
        <label class="check"><input type="checkbox" name="default_paid" checked> ${t('defaultPaid')}</label>
      </div>
    </fieldset>
    <datalist id="dl-camp-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
    <div class="camp-table-wrap">
      <table class="camp-table">
        <thead><tr><th>#</th><th>${t('donor')}</th><th>${t('amount')}</th><th>${t('paid')}</th><th>${t('paymentMethod')}</th>
          <th>${t('refNumber')}</th><th>${t('comments')}</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <button type="button" class="btn small-btn" id="camp-add">${t('addRow')}</button>
    <div class="actions camp-footer">
      <span class="camp-total"></span>
      <span class="spacer"></span>
      <button type="button" class="btn" id="camp-cancel">${t('cancelBtn')}</button>
      <button type="submit" class="btn primary" id="camp-save">${t('saveAll')}</button>
    </div>`;
  wireCampaign(form);
  if (!$('#campaign-dialog').open) $('#campaign-dialog').showModal();
  $('#campaign-dialog').scrollTop = 0;
  (preset.campaign ? $('.camp-row [name=c_contact]', form) : form.elements.campaign).focus();
}

function wireCampaign(form) {
  const f = (n) => form.elements[n];
  const body = $('.camp-table tbody', form);
  form.dataset.dirty = '';
  form.addEventListener('input', () => { form.dataset.dirty = '1'; });
  ui.wireTagPicker($('.tags[data-name="event_tags"]', form));

  f('campaign').addEventListener('change', () => {
    const co = campaignOrg(f('campaign').value.trim());
    if (co) f('org').value = co;
    const prev = state.donations.find((d) => d.campaign === f('campaign').value.trim());
    if (!prev) return;
    if (prev.event_year) f('event_year').value = prev.event_year;
    const want = splitTags(prev.event_tags);
    $$('.tags[data-name="event_tags"] .chip.toggle', form).forEach((c) => c.classList.toggle('on', want.includes(c.dataset.value || c.textContent.trim())));
  });

  f('date').addEventListener('change', () => {
    $('.camp-heb', form).textContent = isoToHebrewText(f('date').value);
    const hv = toHebrew(f('date').value);
    if (hv) {
      const yl = yearLabel(hv.y);
      if (![...f('event_year').options].some((o) => o.value === yl)) f('event_year').insertAdjacentHTML('beforeend', `<option>${yl}</option>`);
      f('event_year').value = yl;
    }
  });

  const rows = () => $$('.camp-row', body);
  const renumber = () => rows().forEach((r, i) => { $('.num', r).textContent = i + 1; });
  const isEmpty = (r) => !$('[name=c_contact]', r).value.trim() && !$('[name=c_amount]', r).value.trim();

  const refPlaceholder = (r) => {
    const m = $('[name=c_method]', r).value;
    const ref = $('[name=c_ref]', r);
    ref.placeholder = m === CHECK ? t('checkNumber') : m === CARD ? t('cardLast4') : m === OTHER ? t('paymentNote') : '';
    ref.disabled = !m;
    ref.maxLength = m === CARD ? 4 : 100;
    if (!m) ref.value = '';
  };

  const total = () => {
    const filled = rows().filter((r) => !isEmpty(r));
    const sum = filled.reduce((s, r) => s + Number($('[name=c_amount]', r).value || 0), 0);
    $('.camp-total', form).innerHTML = `${h(t('donCount', { n: filled.length }))} · ${h(t('donTotal'))} <b>${money(sum)}</b>`;
  };

  const addRow = (focus = false) => {
    body.insertAdjacentHTML('beforeend', campaignRow(rows().length + 1));
    const r = rows().at(-1);
    $('[name=c_paid]', r).checked = f('default_paid').checked;
    refPlaceholder(r);
    if (focus) $('[name=c_contact]', r).focus();
    return r;
  };
  for (let i = 0; i < 5; i += 1) addRow();

  // שינוי ברירת המחדל "באצאלט" → משנה את כל השורות שעוד ריקות
  f('default_paid').addEventListener('change', () => {
    rows().filter(isEmpty).forEach((r) => { $('[name=c_paid]', r).checked = f('default_paid').checked; });
  });

  body.addEventListener('input', (e) => {
    const r = e.target.closest('.camp-row');
    if (e.target.name === 'c_contact') {
      const v = e.target.value.trim();
      $('.one-time', r).hidden = !v || /\(#\d+\)/.test(v);
    }
    if (e.target.name === 'c_ref' && $('[name=c_method]', r).value === CARD) e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (r === rows().at(-1) && !isEmpty(r)) addRow(); // תמיד יש שורה ריקה בסוף
    total();
  });
  body.addEventListener('change', (e) => {
    if (e.target.name === 'c_method') refPlaceholder(e.target.closest('.camp-row'));
  });
  body.addEventListener('click', (e) => {
    const del = e.target.closest('.c-del');
    if (!del) return;
    del.closest('.camp-row').remove();
    if (!rows().length) addRow();
    renumber();
    total();
  });
  // Enter = שדה הבא (ובסוף השורה — השורה הבאה)
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    const r = e.target.closest('.camp-row');
    const fields = $$('input:not([disabled]), select', r).filter((x) => x.type !== 'checkbox');
    const i = fields.indexOf(e.target);
    if (i >= 0 && i < fields.length - 1) { fields[i + 1].focus(); return; }
    const next = r.nextElementSibling || addRow();
    $('[name=c_contact]', next).focus();
  });
  $('#camp-add', form).onclick = () => addRow(true);
  total();

  const close = () => {
    if (form.dataset.dirty && !confirm(t('discardChanges'))) return;
    form.dataset.dirty = '';
    $('#campaign-dialog').close();
  };
  $('#camp-cancel', form).onclick = close;
  $('#camp-x', form).onclick = close;
  form._close = close;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const tags = ui.readTags(form, 'event_tags');
    const date = f('date').value;
    const hv = toHebrew(date);
    const common = f('common_note').value.trim();
    const campaign = f('campaign').value.trim();
    if (!campaign) { ui.toast(t('campaignNameRequired'), 'error'); f('campaign').focus(); return; }
    const org = f('org').value;
    if (!org) { ui.toast(t('orgRequired'), 'error'); f('org').focus(); return; }
    const list = [];
    let bad = null;
    rows().forEach((r) => r.classList.remove('bad'));
    for (const r of rows()) {
      if (isEmpty(r)) continue;
      const who = $('[name=c_contact]', r).value.trim();
      const amount = $('[name=c_amount]', r).value;
      const m = who.match(/\(#(\d+)\)/);
      const contact = m ? ui.contactById(m[1]) : null;
      if (!who || amount === '' || Number(amount) < 0 || (m && !contact)) { r.classList.add('bad'); bad = bad || r; continue; }
      const paid = $('[name=c_paid]', r).checked;
      const method = $('[name=c_method]', r).value;
      const ref = $('[name=c_ref]', r).value.trim();
      const note = [common, $('[name=c_note]', r).value.trim()].filter(Boolean).join(' · ');
      list.push({
        contact_id: contact ? Number(contact.contact_id) : '',
        donor_name: contact ? '' : who,
        date,
        hebrew_date: hv ? formatHebrew(hv) : '',
        event_tags: tags,
        event_year: f('event_year').value,
        event_note: note,
        campaign,
        org,
        amount_usd: Number(amount),
        is_paid: paid,
        paid_date: paid ? todayIso() : '',
        payment_method: method,
        check_number: method === CHECK ? ref : '',
        card_last4: method === CARD ? ref : '',
        payment_note: method === OTHER ? ref : '',
      });
    }
    if (bad) { ui.toast(t('campaignBadRows'), 'error'); $('input', bad).focus(); return; }
    if (!list.length) { ui.toast(t('campaignEmpty'), 'error'); return; }
    const oneTime = list.filter((d) => !d.contact_id).length;
    if (oneTime && !confirm(t('campaignOneTimeConfirm', { n: oneTime }))) return;
    const btn = $('#camp-save', form);
    btn.disabled = true;
    btn.textContent = t('saving');
    try {
      if (campaignOrg(campaign) !== org) await saveCampaignMeta(campaign, org);
      const n = await saveDonations(list);
      await loadAll();
      form.dataset.dirty = '';
      $('#campaign-dialog').close();
      ui.refreshAll();
      ui.toast(t('campaignSaved', { n }));
      ui.openCampaignPage?.(campaign);
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('saveAll');
    }
  };
}

export { joinTags };
