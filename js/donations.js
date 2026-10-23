// נדבות (תרומות): מסך רשימה, טופס הוספה/עריכה, וחלק בכרטיס האישי.
import { state, loadAll, saveDonation, saveDonations, deleteDonation, displayName } from './data.js';
import { campaignOptions, campaignByName } from './campaigns.js';
import { t } from './i18n.js';
import { isTrue, splitTags, joinTags, escapeHtml as h } from './util.js';
import {
  toHebrew, fromHebrew, monthsOf, yearLabel, formatHebrew, isoToHebrewText,
  parseHebrewText, todayIso, hebrewNumber,
} from './hebdate.js';
import {
  campaignOrg, effectiveOrg, donationInScope, defaultOrg, umbrellaName, entityOrgs, isEntityOrg,
} from './scope.js';
import { downloadXlsx } from './excel.js';
import { submitRequest } from './requests.js';
import { bookPickerHtml, wireBookPicker, readBookPicker, booksOf, BOOKS_ORG } from './books.js';

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
  $('#btn-campaign').onclick = () => openBulk();
  $('#btn-xl-don').onclick = () => exportDonations(t('lobbyDonations'), visibleDonations());
  $('#don-back').onclick = () => ui.showView('donhub');
  $('#don-list').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openDonationForm(state.donations.find((d) => String(d.donation_id) === row.dataset.id));
  });
}

const MONEY_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const money = (n) => `$${MONEY_FMT.format(Number(n || 0))}`;

function contactName(id) {
  const c = ui.contactById(id);
  if (c) return ui.fullNameHe(c);
  const del = (state.trash || []).find((x) => String(x.contact_id) === String(id));
  return del ? `${ui.fullNameHe(del)} 🗑` : `#${id}`;
}

// ---------- לאיזה ארגון שייכת הנדבה ----------
const ORG_LISTS = [['beis_medrash', 'orgBeisMedrash'], ['kollel', 'orgKollel'], ['organization', 'orgOrganization']];

function allOrgs() {
  return [umbrellaName(), ...ORG_LISTS.flatMap(([name]) => state.lists[name] || []), ...entityOrgs()];
}

/** <select> עם כל הארגונים, מחולק לפי ביהמ"ד / כולל / ארגון. */
export function orgSelect(name, value, extra = '') {
  const known = allOrgs();
  const u = umbrellaName();
  return `<select name="${name}" ${extra}><option value=""></option><optgroup label="${h(t('umbrellaGroup'))}"><option${u === value ? ' selected' : ''}>${h(u)}</option></optgroup>${ORG_LISTS.map(([list, label]) => {
    const vals = state.lists[list] || [];
    return vals.length ? `<optgroup label="${h(t(label))}">${vals.map((v) => `<option${v === value ? ' selected' : ''}>${h(v)}</option>`).join('')}</optgroup>` : '';
  }).join('')}${entityOrgs().length ? `<optgroup label="${h(t('admEntities'))}">${entityOrgs().map((v) => `<option value="${h(v)}"${v === value ? ' selected' : ''}>${h(v)} · ${h(t('entityTag'))}</option>`).join('')}</optgroup>` : ''}${value && !known.includes(value) ? `<option selected>${h(value)}</option>` : ''}</select>`;
}


/** שם הנדבן: איש קשר, או שם שנכתב (מישהו שלא ברשימה). */
export function donorName(d) {
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
    .filter(donationInScope)
    .filter((d) => !org || effectiveOrg(d) === org)
    .filter((d) => !tag || splitTags(d.event_tags).includes(tag))
    .filter((d) => !year || d.event_year === year)
    .filter((d) => !unpaid || !isTrue(d.is_paid))
    .filter((d) => !q || donorName(d).includes(q) || String(d.event_note).includes(q)
      || String(d.dedication_text).includes(q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.donation_id) - Number(a.donation_id));
}

/** נדבות → Excel (.xlsx). */
export function exportDonations(name, list) {
  downloadXlsx(name, [t('xlDate'), t('xlHebDate'), t('xlDonor'), t('xlOrg'), t('xlCampaign'), t('xlTags'), t('xlYear'),
    t('xlAmount'), t('xlPaid'), t('xlNote')],
  list.map((d) => [d.date || '', d.hebrew_date || isoToHebrewText(d.date) || '', donorName(d), effectiveOrg(d) || '',
    d.campaign || '', splitTags(d.event_tags).join(', '), d.event_year || '', Number(d.amount_usd || 0),
    isTrue(d.is_paid) ? t('xlYes') : t('xlNo'), [d.dedication_text, d.event_note].filter(Boolean).join(' · ')]),
  { sheet: name });
}

export function donationRow(d, withName = true) {
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
  const sumList = $('#don-org')?.value ? list : list.filter((d) => !isEntityOrg(effectiveOrg(d)));
  const total = sumList.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const open = sumList.filter((d) => !isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  $('#don-summary').innerHTML = `${h(t('donCount', { n: list.length }))} · ${h(t('donTotal'))} <b>${money(total)}</b>`
    + (open ? ` · ${h(t('donOpen'))} <b class="unpaid-text">${money(open)}</b>` : '');
  $('#don-list').innerHTML = list.length ? list.map((d) => donationRow(d)).join('')
    : `<p class="empty">${h(state.donations.length ? t('noResults') : t('noDonations'))}</p>`;
}

// ---------- חלק בכרטיס האישי ----------
export function donationsSection(c) {
  const mine = state.donations.filter((d) => String(d.contact_id) === String(c.contact_id))
    .filter(donationInScope)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  // עמותות (MHGI, CLNH...) — נישט אינעם סך הכל
  const total = mine.filter((d) => !isEntityOrg(effectiveOrg(d))).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
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
    d.org = d.org || defaultOrg();
    if (d.campaign) {
      const c = campaignByName(d.campaign);
      if (c) { d.event_tags = d.event_tags || c.event_tags; d.event_year = d.event_year || c.year; }
    }
    d.is_paid = true; // ברירת מחדל: שולם
    d.paid_date = todayIso();
  }
  // אויך א נדבה פון איינעם וואס איז אין "מיסט" (אויסגעמעקט) — מ'זאל זי קענען רעדאגירן אן טוישן דעם נדבן
  const contact = d.contact_id ? (ui.contactById(d.contact_id) || (state.trash || []).find((x) => String(x.contact_id) === String(d.contact_id))) : null;
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

      <div class="don-kind-line">
        <div class="seg don-kind">${[['', 'donKindDonation'], ['sale', 'donKindSale']].map(([k, l]) => `<button type="button" data-dk="${k}" class="${(d.kind || '') === k ? 'on' : ''}">${h(t(l))}</button>`).join('')}</div>
        <input type="hidden" name="kind" value="${h(d.kind || '')}">
      </div>
      <div class="don-books"${d.kind === 'sale' ? '' : ' hidden'}>${bookPickerHtml(booksOf(d))}</div>

      <label class="wide org-pick">${t('campaignOptional')}
        <select name="campaign">${campaignOptions(d.campaign)}</select>
      </label>

      <div class="grid goods-line">
        <label class="wide"><span class="goods-lbl-don"${d.kind === 'sale' ? ' hidden' : ''}>${h(t('goodsDesc'))}</span><span class="goods-lbl-sale"${d.kind === 'sale' ? '' : ' hidden'}>${h(t('saleWhat'))}</span>
          <input name="goods_desc" value="${h(d.goods_desc || '')}" placeholder="${h(t('goodsDescPh'))}"></label>
        <label class="goods-val"${d.kind === 'sale' ? ' hidden' : ''}>${h(t('goodsValue'))}<input name="goods_value" type="number" min="0" step="0.01" dir="ltr" value="${h(d.goods_value ?? '')}" placeholder="$"></label>
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

    ${!isNew && d.created_at ? `<p class="meta">${h(t('created', { date: `\u2066${d.created_at}\u2069`, by: displayName(d.created_by) || '—' }))}${d.updated_at && d.updated_at !== d.created_at ? ` · ${h(t('updated', { date: `\u2066${d.updated_at}\u2069`, by: displayName(d.updated_by) }))}` : ''}</p>` : ''}
    <div class="actions">
      ${!isNew ? `<button type="button" class="btn danger" id="don-delete">${t('deleteBtn')}</button>` : ''}
      ${!isNew ? `<button type="button" class="btn" id="don-receipt">🧾 ${h(isTrue(d.is_paid) ? t('rcBtnReceipt') : t('rcBtnInvoice'))}</button>
        <button type="button" class="btn" id="don-receipt-mail" title="${h(t('rcMailBtn'))}">✉ ${h(t('rcMailShort'))}</button>` : ''}
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
  $('#don-receipt', form)?.addEventListener('click', () => {
    if (form.dataset.dirty) { ui.toast(t('rcSaveFirst'), 'error'); return; }
    ui.printForDonation?.(original);
  });
  $('#don-receipt-mail', form)?.addEventListener('click', () => {
    if (form.dataset.dirty) { ui.toast(t('rcSaveFirst'), 'error'); return; }
    ui.printForDonation?.(original, 'mail');
  });
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
  // נדבה / מכירה
  $$('[data-dk]', form).forEach((b) => {
    b.onclick = () => {
      f('kind').value = b.dataset.dk;
      $$('[data-dk]', form).forEach((x) => x.classList.toggle('on', x === b));
      const sale = b.dataset.dk === 'sale';
      $('.goods-lbl-don', form).hidden = sale;
      $('.goods-lbl-sale', form).hidden = !sale;
      $('.goods-val', form).hidden = sale;
      $('.don-books', form).hidden = !sale;
      form.dataset.dirty = '1';
    };
  });
  // מכירה פון ספרים: דער סכום, "וואס" און דער ארגון — פון די ספרים
  let bookLines = readBookPicker(form);
  wireBookPicker(form, (lines, total, desc) => {
    const had = bookLines.length;
    bookLines = lines;
    if (!lines.length && !had) return;
    f('amount_usd').value = total || '';
    f('goods_desc').value = desc;
    if (!f('org').disabled && [...f('org').options].some((o) => o.value === BOOKS_ORG)) f('org').value = BOOKS_ORG;
    form.dataset.dirty = '1';
  });
  f('campaign').addEventListener('change', () => {
    // די "תמורה" פונעם קאמפיין (למשל א סעודה ביים דינער) — ווען נאך נישט אויסגעפילט
    const cr = state.campaigns.find((x) => x.campaign === f('campaign').value);
    if (cr?.goods_desc && !f('goods_desc').value.trim() && f('kind').value !== 'sale') {
      f('goods_desc').value = cr.goods_desc;
      if (cr.goods_value !== '' && cr.goods_value != null) f('goods_value').value = cr.goods_value;
    }
    syncOrg();
    // קאמפיין → הטעג און יאר פונעם קאמפיין
    const c = campaignByName(f('campaign').value);
    if (!c) return;
    if (c.year) {
      const sel = f('event_year');
      if (![...sel.options].some((o) => o.value === c.year)) sel.insertAdjacentHTML('beforeend', `<option>${h(c.year)}</option>`);
      sel.value = c.year;
    }
    const want = splitTags(c.event_tags);
    if (want.length) $$('.tags[data-name="event_tags"] .chip.toggle', form).forEach((x) => x.classList.toggle('on', want.includes(x.textContent.trim())));
  });
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
    if (!state.isAdmin) {
      try {
        await submitRequest('delete_donation', { donation_id: String(original.donation_id) },
          t('rqSumDelDonation', { amount: money(original.amount_usd), name: donorName(original) }));
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
      return;
    }
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
    const keptTrashed = m && String(m[1]) === String(original.contact_id || '') && (state.trash || []).some((x) => String(x.contact_id) === String(m[1]));
    if (!oneTime && (!m || !(ui.contactById(m[1]) || keptTrashed))) { ui.toast(t('pickValid'), 'error'); return; }
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
      kind: f('kind').value,
      goods_desc: f('goods_desc').value.trim(),
      goods_value: f('kind').value === 'sale' || f('goods_value').value === '' ? '' : Number(f('goods_value').value),
      books: f('kind').value === 'sale' && bookLines.length ? JSON.stringify(bookLines) : '',
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

/** הרבה נדבות בבת אחת. preset = { campaign } כשמוסיפים לקאמפיין מסוים. */
export function openBulk(preset = {}) {
  const form = $('#campaign-form');
  const today = todayIso();
  const hy = toHebrew(today).y;
  form.innerHTML = `
    <button type="button" class="x-close" id="camp-x" aria-label="${h(t('close'))}">✕</button>
    <h2>${t('campaignTitle')}</h2>
    <fieldset class="camp-common"><legend>${t('campaignCommon')}</legend>
      <div class="grid">
        <label class="org-pick">${t('campaignOptional')}
          <select name="campaign">${campaignOptions(preset.campaign || '')}</select></label>
        <label class="org-pick">${t('forOrg')} *
          ${orgSelect('org', campaignOrg(preset.campaign) || defaultOrg())}
          <span class="hint-line camp-org-note" hidden>${t('orgFromCampaign')}</span></label>
      </div>
      <div class="quick-block">
        <span class="quick-label">${t('eventLegend')}</span>
        ${ui.tagPicker('event_tags', 'event_tag', preset.campaign ? (campaignByName(preset.campaign)?.event_tags || '') : '')}
      </div>
      <div class="grid">
        <label>${t('eventYear')}<select name="event_year">${yearOptions([campaignByName(preset.campaign)?.year]).map((y) => `<option${y === (campaignByName(preset.campaign)?.year || yearLabel(hy)) ? ' selected' : ''}>${h(y)}</option>`).join('')}</select></label>
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
  $('.camp-row [name=c_contact]', form).focus();
}

function wireCampaign(form) {
  const f = (n) => form.elements[n];
  const body = $('.camp-table tbody', form);
  form.dataset.dirty = '';
  form.addEventListener('input', () => { form.dataset.dirty = '1'; });
  ui.wireTagPicker($('.tags[data-name="event_tags"]', form));

  // קאמפיין → ארגון, טעג און יאר פונעם קאמפיין
  const syncCampaign = () => {
    const c = campaignByName(f('campaign').value);
    $('.camp-org-note', form).hidden = !c?.org;
    f('org').disabled = Boolean(c?.org);
    f('org').classList.toggle('suggested', Boolean(c?.org));
    if (!c) return;
    if (c.org) {
      if (![...f('org').options].some((o) => o.value === c.org)) f('org').insertAdjacentHTML('beforeend', `<option>${h(c.org)}</option>`);
      f('org').value = c.org;
    }
    if (c.year) {
      if (![...f('event_year').options].some((o) => o.value === c.year)) f('event_year').insertAdjacentHTML('beforeend', `<option>${h(c.year)}</option>`);
      f('event_year').value = c.year;
    }
    const want = splitTags(c.event_tags);
    if (want.length) $$('.tags[data-name="event_tags"] .chip.toggle', form).forEach((x) => x.classList.toggle('on', want.includes(x.textContent.trim())));
  };
  f('campaign').addEventListener('change', syncCampaign);
  syncCampaign();

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
  for (let i = 0; i < 50; i += 1) addRow();

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
    const campaign = f('campaign').value;
    const org = campaignOrg(campaign) || f('org').value;
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
      const n = await saveDonations(list);
      await loadAll();
      form.dataset.dirty = '';
      $('#campaign-dialog').close();
      ui.refreshAll();
      ui.toast(t('campaignSaved', { n }));
      if (campaign) ui.openCampaignPage?.(campaign);
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('saveAll');
    }
  };
}

export { joinTags };
