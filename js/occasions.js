// מאורעות (יארצייט, געבורטסטאג, ...): לפי הלוח העברי, חוזרים כל שנה.
// מסך "מאורעות" (מה חל בקרוב), חלק בכרטיס האישי, וטופס הוספה/עריכה.
import { simchaEvents, openSimchosWeek, issueTitle } from './simchos.js';
import { state, loadAll, saveOccasion, deleteOccasion } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, splitTags, isTrue } from './util.js';
import { contactInScope, memberOrgs, isFormerOf } from './scope.js';
import {
  toHebrew, yearLabel, hebrewNumber, todayIso, monthKeyFromHe, monthHe, yearFromLabel,
  nextOccurrence, daysBetween, isoToHebrewText,
} from './hebdate.js';
import { downloadXlsx } from './excel.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const YAHRZEIT = 'יארצייט';
const ALL_MONTHS = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II',
  'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];
const FEMALE = ['מאמע', 'שוויגער', 'באבע', 'שוועסטער', 'טאכטער', 'ווייב'];

export function initOccasions(helpers) {
  ui = helpers;
  $('#occ-search').addEventListener('input', renderOccasions);
  $('#occ-type').addEventListener('change', renderOccasions);
  $('#occ-range').addEventListener('change', renderOccasions);
  $('#btn-new-occasion').onclick = () => openOccasionForm();
  $('#btn-print-occ').onclick = () => window.print();
  $('#btn-xl-occ').onclick = exportOccasions;
  $('#occ-list').addEventListener('click', (e) => {
    const link = e.target.closest('[data-contact]');
    if (link) { e.stopPropagation(); ui.openCard(link.dataset.contact, 'family'); return; }
    const row = e.target.closest('.row');
    if (row) openOccasionForm(byId(row.dataset.id));
  });
}

function byId(id) {
  return state.occasions.find((o) => String(o.occasion_id) === String(id));
}

/** פרטי המאורע בצורה נוחה: { d, m (מפתח), y (מספר או 0), next (ISO), days } */
function info(o) {
  const d = Number(o.hebrew_day);
  const m = monthKeyFromHe(o.hebrew_month);
  const leap = monthKeyFromHe(o.adar_in_leap);
  const next = d && m ? nextOccurrence(d, m, leap) : '';
  return { d, m, y: yearFromLabel(o.hebrew_year), next, days: next ? daysBetween(todayIso(), next) : null };
}

function personLine(o) {
  const father = String(o.father_name || '').trim();
  return `${h(o.person_name)}${father ? ` ${h(o.ben_bat || 'בן')} ${h(father)}` : ''}`;
}

function dateText(o) {
  return [o.hebrew_day ? hebrewNumber(Number(o.hebrew_day)) : '', o.hebrew_month, o.hebrew_year].filter(Boolean).join(' ');
}

function whenText(days) {
  if (days === 0) return t('today');
  if (days === 1) return t('tomorrow');
  return t('inDays', { n: days });
}

/** די טעג'ס פונעם קאנטאקט אין קליין: ארגונים (גאלד) און קהילה טעג'ס. */
function contactTags(c) {
  const orgs = ['beis_medrash', 'kollel', 'organization'].flatMap((n) => memberOrgs(c, n).map((v) => ({ v, former: isFormerOf(c, n, v) })));
  const tags = splitTags(c.community_tags);
  if (!orgs.length && !tags.length) return '';
  return ` <span class="occ-tags">${orgs.map((o) => `<span class="badge org mini${o.former ? ' former' : ''}">${h(o.v)}</span>`).join('')}${tags.map((x) => `<span class="chip mini">${h(x)}</span>`).join('')}</span>`;
}

function occasionRow(o, { withContact = true } = {}) {
  const x = info(o);
  const c = ui.contactById(o.contact_id);
  return `<button type="button" class="row occ-row${x.days === 0 ? ' is-today' : ''}" data-id="${h(o.occasion_id)}">
    <span class="occ-when">
      ${x.next ? `<b>${h(whenText(x.days))}</b><span class="muted small">${h(isoToHebrewText(x.next).replace(/ [^ ]+$/, ''))} · <span dir="ltr">${h(x.next)}</span></span>` : ''}
    </span>
    <span class="row-main">
      <span class="row-name"><span class="chip ${o.occasion_type === YAHRZEIT ? 'chip-yz' : ''}">${h(o.occasion_type)}</span> ${personLine(o)}</span>
      <span class="muted small">${h(dateText(o))}${o.relation ? ` · ${h(o.relation)}` : ''}${withContact && c
        ? ` ${h(t('relOf'))} <a href="#" data-contact="${h(c.contact_id)}">${h(ui.fullNameHe(c))}</a>${contactTags(c)}` : ''}${o.note ? ` · ${h(o.note)}` : ''}</span>
    </span>
  </button>`;
}

// ---------- שמחות (פון "שהשמחה במעונם") — איינמאליג, נישט יעדעס יאר ----------
function visibleSimchos() {
  const range = Number($('#occ-range')?.value || 7);
  const q = ($('#occ-search')?.value || '').trim();
  const type = $('#occ-type')?.value || '';
  if (type && type !== t('occSimcha')) return [];
  return simchaEvents().map((e) => ({ ...e, days: daysBetween(todayIso(), e.iso) }))
    .filter((e) => e.days >= 0 && e.days <= range)
    .filter((e) => !q || [e.label, ...e.names].some((x) => String(x).includes(q)));
}
function simchaRow(e) {
  return `<button type="button" class="row occ-row occ-simcha${e.days === 0 ? ' is-today' : ''}" data-simcha-week="${h(e.iso)}">
    <span class="occ-when"><b>${h(whenText(e.days))}</b><span class="muted small">${h(isoToHebrewText(e.iso).replace(/ [^ ]+$/, ''))} · <span dir="ltr">${h(e.iso)}</span></span></span>
    <span class="row-main"><span class="row-name"><span class="chip chip-simcha">🍷 ${h(t('occSimcha'))}: ${h(e.label)}</span> ${h(e.names.join(' · '))}</span>
      <span class="muted small">${h(issueTitle(e.iso))}</span></span>
  </button>`;
}

// ---------- מסך המאורעות ----------
export function fillOccasionFilters() {
  const sel = $('#occ-type');
  if (!sel) return;
  const v = sel.value;
  sel.innerHTML = `<option value="">${h(t('allTypes'))}</option>`
    + (state.lists.occasion_type || []).map((x) => `<option>${h(x)}</option>`).join('');
  sel.value = v;
}

function visibleOccasions() {
  const q = $('#occ-search').value.trim();
  const type = $('#occ-type').value;
  const range = Number($('#occ-range').value || 7);
  const list = state.occasions
    .map((o) => ({ o, x: info(o) }))
    .filter(({ o }) => !type || o.occasion_type === type)
    .filter(({ o }) => { const c = ui.contactById(o.contact_id); return !c || contactInScope(c); })
    .filter(({ x }) => x.next && x.days <= range)
    .filter(({ o }) => {
      if (!q) return true;
      const c = ui.contactById(o.contact_id);
      return [o.person_name, o.father_name, o.note, c ? ui.fullNameHe(c) : ''].some((s) => String(s || '').includes(q));
    })
    .sort((a, b) => a.x.days - b.x.days);
  return list;
}

/** דער לוח → Excel (.xlsx). */
export function exportOccasions() {
  const rows = visibleOccasions().map(({ o, x }) => {
    const c = ui.contactById(o.contact_id);
    const father = String(o.father_name || '').trim();
    return [x.next || '', isoToHebrewText(x.next) || '', x.days, o.occasion_type || '',
      `${o.person_name || ''}${father ? ` ${o.ben_bat || 'בן'} ${father}` : ''}`, dateText(o), o.relation || '',
      c ? ui.fullNameHe(c) : '', o.note || ''];
  });
  downloadXlsx(t('tabOccasions'), [t('xlNext'), t('xlHebrew'), '#', t('xlType'), t('xlPerson'), t('xlHebDate'),
    t('xlRelation'), t('xlContact'), t('xlNote')], rows, { sheet: t('tabOccasions') });
}

export function renderOccasions() {
  if (!$('#occ-list')) return;
  const list = visibleOccasions();
  const sims = visibleSimchos();
  $('#occ-summary').textContent = t('occCount', { n: list.length + sims.length });
  $('#occ-print-title').textContent = `${$('#occ-range').selectedOptions[0]?.text || ''} · ${isoToHebrewText(todayIso())}`;
  const rows = [...list.map(({ o, x }) => ({ days: x.days, html: occasionRow(o) })), ...sims.map((e) => ({ days: e.days, html: simchaRow(e) }))]
    .sort((a, b) => a.days - b.days);
  $('#occ-list').innerHTML = rows.length ? rows.map((r) => r.html).join('')
    : `<p class="empty">${h(state.occasions.length ? t('noOccasionsSoon') : t('noOccasions'))}</p>`;
  $$('#occ-list [data-simcha-week]').forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); document.body.classList.add('solo-mode'); openSimchosWeek(b.dataset.simchaWeek); }; });
}

// ---------- חלק בכרטיס האישי ----------
export function occasionsSection(c) {
  const mine = state.occasions.filter((o) => String(o.contact_id) === String(c.contact_id))
    .sort((a, b) => (info(a).days ?? 999) - (info(b).days ?? 999));
  return `<section class="card-occasions">
    <h3>${t('occasions')}</h3>
    <div class="list compact">${mine.map((o) => occasionRow(o, { withContact: false })).join('')}</div>
    <button type="button" class="btn small-btn" id="card-new-occasion">${t('newOccasion')}</button>
  </section>`;
}

export function occasionCount(c) {
  return state.occasions.filter((o) => String(o.contact_id) === String(c.contact_id)).length;
}

export function wireOccasionsSection(c) {
  const box = $('#card-body .card-occasions');
  if (!box) return;
  $$('.occ-row', box).forEach((r) => { r.onclick = () => openOccasionForm(byId(r.dataset.id)); });
  $('#card-new-occasion', box).onclick = () => openOccasionForm({}, c.contact_id);
}

// ---------- טופס ----------
function yearChoices(current) {
  const now = toHebrew(todayIso()).y;
  const out = [];
  for (let y = now + 1; y >= 5660; y -= 1) out.push(y);
  return `<option value="">—</option>${out.map((y) => `<option value="${yearLabel(y)}"${yearLabel(y) === current ? ' selected' : ''}>${yearLabel(y)}</option>`).join('')}`;
}

/**
 * פותח את טופס המאורע. occasion = רשומה קיימת או ערכים התחלתיים (למשל מסימון "נפטר").
 */
export function openOccasionForm(occasion = {}, presetContactId = null) {
  const o = { ...occasion };
  const isNew = !o.occasion_id;
  if (isNew) {
    o.contact_id = o.contact_id || presetContactId || '';
    o.occasion_type = o.occasion_type || (state.lists.occasion_type || [YAHRZEIT])[0];
  }
  const contact = o.contact_id ? ui.contactById(o.contact_id) : null;
  const types = state.lists.occasion_type || [YAHRZEIT];
  const relations = state.lists.occasion_relation || [];
  const form = $('#occasion-form');

  form.innerHTML = `
    <button type="button" class="x-close" id="occ-x" aria-label="${h(t('close'))}">✕</button>
    <h2>${isNew ? t('newOccasionTitle') : t('editOccasionTitle')}</h2>
    <div class="don-quick">
      <div class="type-chips" role="radiogroup">${types.map((ty) => `<label class="chip-radio">
        <input type="radio" name="occasion_type" value="${h(ty)}"${ty === o.occasion_type ? ' checked' : ''}><span>${h(ty)}</span></label>`).join('')}
      </div>

      <div class="donor-line"${contact ? '' : ' hidden'}>
        <span class="quick-label">${t('contactLabel')}:</span>
        <strong>${contact ? h(ui.fullNameHe(contact)) : ''}</strong>
        <button type="button" class="linkish" id="occ-change-contact">${t('change')}</button>
      </div>
      <label class="wide contact-pick"${contact ? ' hidden' : ''}>${t('contactLabel')}
        <input name="contact" list="dl-occ-contacts" autocomplete="off" placeholder="${h(t('pickContact'))}" value="${contact ? h(ui.pickerLabel(contact)) : ''}">
      </label>
      <datalist id="dl-occ-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>

      <div class="grid">
        <label>${t('occRelation')}<input name="relation" list="dl-occ-rel" autocomplete="off" value="${h(o.relation || '')}" placeholder="${h(t('chooseOrType'))}"></label>
        <datalist id="dl-occ-rel">${relations.map((r) => `<option value="${h(r)}">`).join('')}</datalist>
      </div>

      <div class="name-line">
        <label>${t('occName')}<input name="person_name" value="${h(o.person_name || '')}"></label>
        <label class="ben-bat">&nbsp;<select name="ben_bat">
          <option${o.ben_bat !== 'בת' ? ' selected' : ''}>בן</option><option${o.ben_bat === 'בת' ? ' selected' : ''}>בת</option></select></label>
        <label>${t('occFather')}<input name="father_name" value="${h(o.father_name || '')}"></label>
      </div>

      <div class="quick-block">
        <span class="quick-label">${t('hebDate')}</span>
        <span class="heb-picker occ-date">
          <select name="hebrew_day"><option value=""></option>${Array.from({ length: 30 }, (_, i) => i + 1)
            .map((d) => `<option value="${d}"${d === Number(o.hebrew_day) ? ' selected' : ''}>${hebrewNumber(d)}</option>`).join('')}</select>
          <select name="hebrew_month"><option value=""></option>${ALL_MONTHS
            .map((m) => `<option value="${h(monthHe(m))}"${monthHe(m) === o.hebrew_month ? ' selected' : ''}>${h(monthHe(m))}</option>`).join('')}</select>
          <select name="hebrew_year" title="${h(t('yearOptional'))}">${yearChoices(o.hebrew_year)}</select>
        </span>
        <span class="hint-line">${t('yearOptional')}</span>
      </div>

      <div class="adar-line" hidden>
        <span class="quick-label">${t('adarInLeap')}</span>
        <label class="check"><input type="radio" name="adar_in_leap" value="אדר א'"> אדר א'</label>
        <label class="check"><input type="radio" name="adar_in_leap" value="אדר ב'"> אדר ב'</label>
      </div>

      <div class="date-line">
        <span class="quick-label">${t('orGregorian')}</span>
        <input type="date" name="greg_helper">
      </div>
    </div>

    <details class="more"${o.note ? ' open' : ''}>
      <summary>${t('comments')}</summary>
      <label class="wide"><input name="note" value="${h(o.note || '')}"></label>
    </details>

    <div class="actions">
      ${!isNew ? `<button type="button" class="btn danger" id="occ-delete">${t('deleteBtn')}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" id="occ-cancel">${t('cancelBtn')}</button>
      <button type="submit" class="btn primary" id="occ-save">${t('saveBtn')}</button>
    </div>`;

  wireOccasionForm(form, o);
  if (!$('#occasion-dialog').open) $('#occasion-dialog').showModal();
  $('#occasion-dialog').scrollTop = 0;
  (contact ? form.elements.relation : form.elements.contact).focus();
}

function wireOccasionForm(form, original) {
  const f = (n) => form.elements[n];
  form.dataset.dirty = '';
  form.addEventListener('input', () => { form.dataset.dirty = '1'; });
  form.addEventListener('change', () => { form.dataset.dirty = '1'; });

  $('#occ-change-contact', form).onclick = () => {
    $('.contact-pick', form).hidden = false;
    $('.donor-line', form).hidden = true;
    f('contact').select();
  };

  const contactNow = () => {
    const m = f('contact').value.match(/\(#(\d+)\)/);
    return m ? ui.contactById(m[1]) : null;
  };

  // קרבה → בן/בת, והצעת שם (אפור עד שלוחצים)
  const suggest = (input, value) => {
    if (!value || (input.value && !input.classList.contains('suggested'))) return;
    input.value = value;
    input.classList.add('suggested');
    input.title = t('suggestedTip');
  };
  ['person_name', 'father_name'].forEach((n) => {
    const confirmIt = () => { f(n).classList.remove('suggested'); f(n).title = ''; };
    f(n).addEventListener('focus', confirmIt);
    f(n).addEventListener('input', confirmIt);
  });
  f('relation').addEventListener('change', () => {
    const rel = f('relation').value.trim();
    f('ben_bat').value = FEMALE.includes(rel) ? 'בת' : 'בן';
    const c = contactNow();
    if (!c) return;
    if (rel === 'ער אליין') suggest(f('person_name'), String(c.first_name_he || '').trim());
    if (rel === 'ווייב') suggest(f('person_name'), String(c.wife_name_he || '').trim());
  });

  // אדר רגיל → בוחרים מתי מציינים בשנה מעוברת
  const typeNow = () => form.querySelector('input[name=occasion_type]:checked')?.value || '';
  const adar = () => {
    const isAdar = f('hebrew_month').value === 'אדר';
    $('.adar-line', form).hidden = !isAdar;
    if (isAdar && !form.querySelector('input[name=adar_in_leap]:checked')) {
      const def = original.adar_in_leap || (typeNow() === YAHRZEIT ? 'אדר א\'' : 'אדר ב\'');
      const r = [...form.querySelectorAll('input[name=adar_in_leap]')].find((x) => x.value === def);
      if (r) r.checked = true;
    }
  };
  f('hebrew_month').addEventListener('change', adar);
  adar();

  // תאריך לועזי → ממלא את התאריך העברי
  f('greg_helper').addEventListener('change', () => {
    const hv = toHebrew(f('greg_helper').value);
    if (!hv) return;
    f('hebrew_day').value = String(hv.d);
    f('hebrew_month').value = monthHe(hv.m);
    const yl = yearLabel(hv.y);
    if (![...f('hebrew_year').options].some((x) => x.value === yl)) f('hebrew_year').insertAdjacentHTML('beforeend', `<option>${yl}</option>`);
    f('hebrew_year').value = yl;
    adar();
  });

  const close = () => {
    if (form.dataset.dirty && !confirm(t('discardChanges'))) return;
    form.dataset.dirty = '';
    $('#occasion-dialog').close();
  };
  $('#occ-cancel', form).onclick = close;
  $('#occ-x', form).onclick = close;
  form._close = close;

  $('#occ-delete', form)?.addEventListener('click', async () => {
    if (!confirm(t('confirmDeleteOccasion'))) return;
    try {
      await deleteOccasion(original);
      await loadAll();
      form.dataset.dirty = '';
      $('#occasion-dialog').close();
      ui.refreshAll();
      ui.toast(t('occasionDeleted'));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const c = contactNow();
    if (!c) { ui.toast(t('pickValid'), 'error'); return; }
    if (!f('person_name').value.trim()) { ui.toast(t('occNameRequired'), 'error'); return; }
    if (!f('hebrew_day').value || !f('hebrew_month').value) { ui.toast(t('occDateRequired'), 'error'); return; }
    const month = f('hebrew_month').value;
    const occasion = {
      ...original,
      contact_id: Number(c.contact_id),
      occasion_type: typeNow(),
      relation: f('relation').value.trim(),
      person_name: f('person_name').value.trim(),
      ben_bat: f('father_name').value.trim() ? f('ben_bat').value : '',
      father_name: f('father_name').value.trim(),
      hebrew_day: Number(f('hebrew_day').value),
      hebrew_month: month,
      hebrew_year: f('hebrew_year').value,
      adar_in_leap: month === 'אדר' ? (form.querySelector('input[name=adar_in_leap]:checked')?.value || '') : '',
      note: f('note').value.trim(),
    };
    const btn = $('#occ-save', form);
    btn.disabled = true;
    btn.textContent = t('saving');
    try {
      await saveOccasion(occasion);
      await loadAll();
      form.dataset.dirty = '';
      $('#occasion-dialog').close();
      ui.refreshAll();
      ui.toast(t('occasionSaved'));
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('saveBtn');
    }
  };
}
