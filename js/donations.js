// נדבות (תרומות): מסך רשימה, טופס הוספה/עריכה, וחלק בכרטיס האישי.
import { state, loadAll, saveDonation, deleteDonation } from './data.js';
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
  $('#don-unpaid').addEventListener('change', renderDonations);
  $('#btn-new-donation').onclick = () => openDonationForm();
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
  return state.donations
    .filter((d) => !tag || splitTags(d.event_tags).includes(tag))
    .filter((d) => !year || d.event_year === year)
    .filter((d) => !unpaid || !isTrue(d.is_paid))
    .filter((d) => !q || contactName(d.contact_id).includes(q) || String(d.event_note).includes(q)
      || String(d.dedication_text).includes(q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.donation_id) - Number(a.donation_id));
}

function donationRow(d, withName = true) {
  const paid = isTrue(d.is_paid);
  const tags = splitTags(d.event_tags).map((x) => `<span class="chip">${h(x)}</span>`).join('');
  return `<button type="button" class="row don-row" data-id="${h(d.donation_id)}">
    <span class="row-main">
      ${withName ? `<span class="row-name">${h(contactName(d.contact_id))}</span>` : ''}
      <span class="muted small">${h(d.hebrew_date || isoToHebrewText(d.date))}${d.date ? ` · <span dir="ltr">${h(d.date)}</span>` : ''}</span>
    </span>
    <span class="row-tags">${tags}${d.event_year ? ` <span class="muted small">${h(d.event_year)}</span>` : ''}</span>
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
        <input name="contact" list="dl-don-contacts" autocomplete="off" placeholder="${h(t('pickContact'))}" value="${contact ? h(ui.pickerLabel(contact)) : ''}">
      </label>
      <datalist id="dl-don-contacts">${state.contacts.filter((x) => isTrue(x.is_active) || x.is_active === '')
        .map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>

      <div class="amount-line">
        <label class="amount-box">${t('amount')}
          <span class="amount-wrap"><span>$</span><input name="amount_usd" type="number" min="0" step="0.01" dir="ltr" inputmode="decimal" value="${h(d.amount_usd ?? '')}"></span>
        </label>
        <label class="check paid-toggle"><input type="checkbox" name="is_paid" ${isTrue(d.is_paid) ? 'checked' : ''}> ${t('paid')}</label>
      </div>

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

    <details class="more"${d.event_note || d.paid_note || d.dedication_type || d.dedication_text ? ' open' : ''}>
      <summary>${t('moreDetails')}</summary>
      <div class="grid">
        <label>${t('eventYear')}<select name="event_year">${yearOptions([d.event_year])
          .map((y) => `<option${y === (d.event_year || yearLabel(hDate.y)) ? ' selected' : ''}>${h(y)}</option>`).join('')}</select></label>
        <label class="wide">${t('comments')}<input name="event_note" value="${h(d.event_note || '')}"></label>
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
    if (!m || !ui.contactById(m[1])) { ui.toast(t('pickValid'), 'error'); return; }
    const amount = f('amount_usd').value;
    if (amount === '' || Number(amount) < 0) { ui.toast(t('amountRequired'), 'error'); return; }
    const tags = ui.readTags(form, 'event_tags');
    const method = f('payment_method').value;
    const from = readPicker($('.heb-picker[data-name="sponsor_from"]', form));
    const to = readPicker($('.heb-picker[data-name="sponsor_to"]', form));
    const hv = readPicker(datePicker);
    const donation = {
      ...original,
      contact_id: Number(m[1]),
      date: f('date').value,
      hebrew_date: hv ? formatHebrew(hv) : '',
      event_tags: tags,
      event_year: f('event_year').value,
      event_note: f('event_note').value.trim(),
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

export { joinTags };
