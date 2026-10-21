// בונה רשימות: בוחרים תנאים (פרטים, נדבות, מאורעות, הוספה/הורדה ידנית), רואים את התוצאה מיד,
// שומרים בשם, ומוציאים לאקסל או להדפסה. רשימה שמורה "חיה" — היא מחושבת מחדש כל פעם לפי התנאים.
import { tagSelHtml, readTagSel, matchesTagSel } from './tags.js';
import { state, loadAll, saveSavedList, deleteSavedList, displayName } from './data.js';
import { t } from './i18n.js';
import {
  isTrue, isAlive, splitTags, escapeHtml as h, mailingName, digits,
} from './util.js';
import {
  todayIso, nextOccurrence, daysBetween, monthKeyFromHe, isoToHebrewText,
} from './hebdate.js';
import {
  contactInScope, effectiveOrg, donationInScope, getScope, memberOrgs, isFormerOf,
} from './scope.js';
import { allCampaigns } from './campaigns.js';
import { downloadXlsx } from './excel.js';
import { openCompose } from './mail.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ORG_TYPES = [['beis_medrash', 'orgBeisMedrash'], ['kollel', 'orgKollel'], ['organization', 'orgOrganization']];
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

let current = null; // { list_id?, name, criteria, columns }

const EMPTY = () => ({
  orgs: [], orgFormer: false, tags: [], areas: [], marital: [], neshei: false,
  includeDeceased: false, includeInactive: false,
  has: { address: false, email: false, phone: false, english: false },
  missing: { address: false, english: false, phone: false },
  donation: { mode: '', campaign: '', series: '', org: '', year: '', min: '' },
  unpaid: false,
  occasion: { type: '', days: '' },
  add: [], remove: [],
});

/** העמודות שאפשר להוציא. */
function columnDefs() {
  return [
    ['name_he', t('colNameHe'), (c) => ui.fullNameHe(c)],
    ['mailing', t('mailingName'), (c) => mailingName(c) || ''],
    ['name_en', t('enName'), (c) => [c.first_name_en, c.last_name_en].filter(Boolean).join(' ')],
    ['address', t('address'), (c) => c.address || ''],
    ['city', 'City', (c) => c.city || ''],
    ['state', 'State', (c) => c.state || ''],
    ['zip', 'ZIP', (c) => c.zip || ''],
    ['area', t('area'), (c) => c.area || ''],
    ['mobile', t('colMobile'), (c) => ui.phonesOf(c).mobile || ''],
    ['home_phone', t('colHome'), (c) => ui.phonesOf(c).home_phone || ''],
    ['email', t('colEmail'), (c) => ui.phonesOf(c).email_1 || ''],
    ['orgs', t('organizations'), (c) => ORG_TYPES.flatMap(([n]) => memberOrgs(c, n)).join(', ')],
    ['tags', t('community'), (c) => splitTags(c.community_tags).join(', ')],
    ['don_total', t('colDonTotal'), (c, x) => money(x.total)],
    ['don_unpaid', t('unpaid'), (c, x) => money(x.open)],
    ['occasion', t('colOccasion'), (c, x) => x.occasion || ''],
  ];
}
const DEFAULT_COLUMNS = ['name_he', 'mailing', 'address', 'city', 'state', 'zip', 'mobile'];

export function initLists(helpers) {
  ui = helpers;
  $('#btn-side-list').onclick = () => openBuilder();
  $('#btn-lists-home').onclick = () => openOverview();
  $('#lists-side').addEventListener('click', (e) => {
    const b = e.target.closest('[data-list]');
    if (b) openBuilder(state.savedLists.find((l) => String(l.list_id) === b.dataset.list));
  });
}

export function renderListsSide() {
  const side = $('#lists-side');
  if (!side) return;
  const active = !$('.view[data-view="lists"]').hidden && page === 'builder' && current?.list_id;
  const sc = getScope();
  const mine = state.savedLists.filter(canSee).filter((l) => !l.scope || !sc || l.scope === scopeKey(sc));
  side.innerHTML = mine.length ? mine.map((l) => `<button type="button" class="org-link${String(active) === String(l.list_id) ? ' on' : ''}" data-list="${h(l.list_id)}">
      <span>${l.visibility === 'private' ? '🔒 ' : ''}${h(l.name)}</span></button>`).join('')
    : `<p class="muted small side-empty">${h(t('noSavedLists'))}</p>`;
}

function scopeKey(sc) {
  return sc ? `${sc.type}|${sc.value}` : '';
}

// ---------- חישוב התוצאה ----------
function donationMatches(d, cr) {
  const q = cr.donation;
  if (q.campaign && d.campaign !== q.campaign) return false;
  if (q.series) {
    const c = allCampaigns().find((x) => x.name === d.campaign);
    if (!c || c.series !== q.series) return false;
  }
  if (q.org && effectiveOrg(d) !== q.org) return false;
  if (q.year && d.event_year !== q.year) return false;
  return true;
}

/** מחשב את הרשימה: [{ c, total, open, occasion }] */
export function evaluate(cr) {
  const donationsBy = new Map();
  state.donations.filter(donationInScope).forEach((d) => {
    if (!d.contact_id) return;
    const k = String(d.contact_id);
    if (!donationsBy.has(k)) donationsBy.set(k, []);
    donationsBy.get(k).push(d);
  });
  const today = todayIso();
  const out = [];
  for (const c of state.contacts) {
    const id = String(c.contact_id);
    const manual = cr.add.map(String).includes(id);
    if (cr.remove.map(String).includes(id)) continue;
    if (!contactInScope(c, true)) continue;
    const mine = donationsBy.get(id) || [];
    const relevant = mine.filter((d) => donationMatches(d, cr));
    const total = relevant.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
    const open = mine.filter((d) => !isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
    let occasion = '';
    const occs = state.occasions.filter((o) => String(o.contact_id) === id && (!cr.occasion.type || o.occasion_type === cr.occasion.type));
    let occOk = !cr.occasion.days;
    for (const o of occs) {
      const next = nextOccurrence(Number(o.hebrew_day), monthKeyFromHe(o.hebrew_month), monthKeyFromHe(o.adar_in_leap));
      if (!next) continue;
      const days = daysBetween(today, next);
      if (!cr.occasion.days || days <= Number(cr.occasion.days)) {
        occOk = true;
        occasion = occasion || `${o.occasion_type} ${o.person_name} · ${isoToHebrewText(next).replace(/ [^ ]+$/, '')}`;
      }
    }
    const row = { c, total, open, occasion };
    if (manual) { out.push(row); continue; }

    if (!cr.includeDeceased && !isAlive(c.is_alive)) continue;
    if (!cr.includeInactive && !(isTrue(c.is_active) || c.is_active === '')) continue;
    if (cr.orgs.length && !cr.orgs.some((key) => {
      const [type, value] = key.split('|');
      return memberOrgs(c, type).includes(value) && (cr.orgFormer || !isFormerOf(c, type, value));
    })) continue;
    if (cr.tags.length && !cr.tags.some((x) => splitTags(c.community_tags).includes(x))) continue;
    if (cr.tagSel && cr.tagSel.keys && cr.tagSel.keys.length && !matchesTagSel(c, cr.tagSel)) continue;
    if (cr.areas.length && !cr.areas.includes(c.area)) continue;
    if (cr.marital.length && !cr.marital.includes(c.marital_status)) continue;
    if (cr.neshei && !isTrue(c.wife_in_neshei)) continue;
    const p = ui.phonesOf(c);
    if (cr.has.address && !(String(c.address || '').trim() && String(c.zip || c.city || '').trim())) continue;
    if (cr.has.email && !String(p.email_1 || p.email_2 || '').trim()) continue;
    if (cr.has.phone && !digits(p.mobile || p.home_phone || p.wife_mobile || p.other_phone)) continue;
    if (cr.has.english && !String(c.last_name_en || '').trim()) continue;
    const ms = cr.missing || {};
    if (ms.address && String(c.address || '').trim()) continue;
    if (ms.english && String(c.last_name_en || '').trim()) continue;
    if (ms.phone && digits(p.mobile || p.home_phone || p.wife_mobile || p.other_phone)) continue;
    const q = cr.donation;
    if (q.mode === 'gave' && (!relevant.length || (q.min && total < Number(q.min)))) continue;
    if (q.mode === 'notgave' && relevant.length) continue;
    if (cr.unpaid && !open) continue;
    if (cr.occasion.days && !occOk) continue;
    out.push(row);
  }
  return out.sort((a, b) => String(a.c.last_name_he).localeCompare(String(b.c.last_name_he), 'he')
    || String(a.c.first_name_he).localeCompare(String(b.c.first_name_he), 'he'));
}

// ---------- הבונה ----------
function chips(name, values, selected, label = (v) => v) {
  return `<div class="tags lb-chips" data-name="${name}">${values.map((v) => `<button type="button" class="chip toggle${selected.includes(v) ? ' on' : ''}" data-v="${h(v)}">${h(label(v))}</button>`).join('')}</div>`;
}

let page = 'overview'; // 'overview' = דער איבערבליק פון אלע רשימות; 'builder' = איין רשימה

export function openOverview() {
  page = 'overview';
  ui.showView('lists');
}

/** saved = רשימה שמורה; preset = { name, criteria, columns } פון א גרייטע רשימה. */
export function openBuilder(saved = null, preset = null) {
  page = 'builder';
  let criteria = preset ? { ...EMPTY(), ...preset.criteria } : EMPTY();
  let columns = preset?.columns || DEFAULT_COLUMNS;
  if (saved) {
    try { criteria = { ...EMPTY(), ...JSON.parse(saved.criteria || '{}') }; } catch { /* תנאים פגומים — מתחילים ריק */ }
    columns = splitTags(saved.columns).length ? splitTags(saved.columns) : DEFAULT_COLUMNS;
  }
  criteria.has = { ...EMPTY().has, ...criteria.has };
  criteria.missing = { ...EMPTY().missing, ...criteria.missing };
  criteria.donation = { ...EMPTY().donation, ...criteria.donation };
  criteria.occasion = { ...EMPTY().occasion, ...criteria.occasion };
  current = { list_id: saved?.list_id || '', name: saved?.name || preset?.name || '', criteria, columns, visibility: saved ? (saved.visibility || 'public') : 'private' };
  ui.showView('lists');
}

export function renderBuilder() {
  const main = $('#lists-main');
  if (!main) return;
  if (page === 'overview' || !current) { renderOverview(main); return; }
  const cr = current.criteria;
  const orgKeys = ORG_TYPES.flatMap(([type]) => (state.lists[type] || []).map((v) => `${type}|${v}`));
  const camps = allCampaigns();
  const series = [...new Set(camps.map((c) => c.series))];
  const years = [...new Set([...state.donations.map((d) => d.event_year), ...camps.map((c) => c.year)].filter(Boolean))].sort().reverse();
  const orgsAll = ORG_TYPES.flatMap(([type]) => state.lists[type] || []);
  const sc = getScope();

  main.innerHTML = `
    <div class="camp-page-head">
      <div><h2>${current.list_id ? h(current.name) : t('newListTitle')}</h2>
        ${sc ? `<p class="hint-line">${h(t('listScopeNote', { name: sc.type === 'area' ? (sc.value === '__none__' ? t('noArea') : `${t('area')}: ${sc.value}`) : sc.value || '' }))}</p>` : ''}</div>
      <span class="spacer"></span>
      ${current.list_id ? (current.visibility === 'private'
        ? `<span class="badge muted">🔒 ${t('lbPrivate')}</span> <button type="button" class="btn" id="lb-publish">${t('lbPublish')}</button>`
        : `<span class="badge paid">${t('lbPublic')}</span>`) : `<span class="hint-line">${t('lbPrivateNote')}</span>`}
      <button type="button" class="btn" id="lb-back">← ${t('allLists')}</button>
      ${current.list_id ? `<button type="button" class="btn danger" id="lb-delete">${t('deleteBtn')}</button>` : ''}
    </div>
    <form id="lb-form" class="lb-form" onsubmit="return false">
      <details${cr.tagSel && cr.tagSel.keys && cr.tagSel.keys.length ? ' open' : ''}><summary>🏷 ${t('tgTitle')}</summary>
        <p class="hint-line">${t('tgListHint')}</p>
        ${tagSelHtml(cr.tagSel || {})}
      </details>
      <details open><summary>${t('lbDetails')}</summary>
        <div class="lb-block"><span class="quick-label">${t('organizations')}</span>
          ${chips('orgs', orgKeys, cr.orgs, (k) => k.split('|')[1])}
          <label class="check"><input type="checkbox" name="orgFormer" ${cr.orgFormer ? 'checked' : ''}> ${t('withFormer')}</label></div>
        <div class="lb-block" hidden><span class="quick-label">${t('community')}</span>${chips('tags', state.lists.community_tag || [], cr.tags)}</div>
        <div class="lb-block"><span class="quick-label">${t('area')}</span>${chips('areas', state.lists.area || [], cr.areas)}</div>
        <div class="lb-block"><span class="quick-label">${t('marital')}</span>${chips('marital', state.lists.marital_status || [], cr.marital)}</div>
        <div class="lb-row">
          <label class="check"><input type="checkbox" name="neshei" ${cr.neshei ? 'checked' : ''}> ${t('nesheiFull')}</label>
          <label class="check"><input type="checkbox" name="has_address" ${cr.has.address ? 'checked' : ''}> ${t('lbHasAddress')}</label>
          <label class="check"><input type="checkbox" name="has_email" ${cr.has.email ? 'checked' : ''}> ${t('lbHasEmail')}</label>
          <label class="check"><input type="checkbox" name="has_phone" ${cr.has.phone ? 'checked' : ''}> ${t('lbHasPhone')}</label>
          <label class="check"><input type="checkbox" name="has_english" ${cr.has.english ? 'checked' : ''}> ${t('lbHasEnglish')}</label>
          <label class="check"><input type="checkbox" name="miss_address" ${cr.missing.address ? 'checked' : ''}> ${t('lbMissAddress')}</label>
          <label class="check"><input type="checkbox" name="miss_english" ${cr.missing.english ? 'checked' : ''}> ${t('lbMissEnglish')}</label>
          <label class="check"><input type="checkbox" name="miss_phone" ${cr.missing.phone ? 'checked' : ''}> ${t('lbMissPhone')}</label>
          <label class="check"><input type="checkbox" name="includeDeceased" ${cr.includeDeceased ? 'checked' : ''}> ${t('lbInclDeceased')}</label>
          <label class="check"><input type="checkbox" name="includeInactive" ${cr.includeInactive ? 'checked' : ''}> ${t('inclInactive')}</label>
        </div>
      </details>
      <details${cr.donation.mode || cr.unpaid ? ' open' : ''}><summary>${t('donations')}</summary>
        <div class="lb-row">
          <select name="don_mode">
            <option value="">${t('lbDonAny')}</option>
            <option value="gave"${cr.donation.mode === 'gave' ? ' selected' : ''}>${t('lbDonGave')}</option>
            <option value="notgave"${cr.donation.mode === 'notgave' ? ' selected' : ''}>${t('lbDonNotGave')}</option>
          </select>
          <select name="don_series"><option value="">${t('lbAnySeries')}</option>${series.map((x) => `<option${x === cr.donation.series ? ' selected' : ''}>${h(x)}</option>`).join('')}</select>
          <select name="don_campaign"><option value="">${t('lbAnyCampaign')}</option>${camps.map((x) => `<option${x.name === cr.donation.campaign ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select>
          <select name="don_org"><option value="">${t('lbAnyOrg')}</option>${orgsAll.map((x) => `<option${x === cr.donation.org ? ' selected' : ''}>${h(x)}</option>`).join('')}</select>
          <select name="don_year"><option value="">${t('allYears')}</option>${years.map((x) => `<option${x === cr.donation.year ? ' selected' : ''}>${h(x)}</option>`).join('')}</select>
          <label class="lb-min">${t('lbMin')} <input name="don_min" type="number" min="0" dir="ltr" value="${h(cr.donation.min)}"></label>
        </div>
        <label class="check"><input type="checkbox" name="unpaid" ${cr.unpaid ? 'checked' : ''}> ${t('lbUnpaid')}</label>
      </details>
      <details${cr.occasion.days ? ' open' : ''}><summary>${t('occasions')}</summary>
        <div class="lb-row">
          <select name="occ_type"><option value="">${t('allTypes')}</option>${(state.lists.occasion_type || []).map((x) => `<option${x === cr.occasion.type ? ' selected' : ''}>${h(x)}</option>`).join('')}</select>
          <select name="occ_days">
            <option value="">${t('lbOccAny')}</option>
            ${[7, 14, 31, 60].map((n) => `<option value="${n}"${String(cr.occasion.days) === String(n) ? ' selected' : ''}>${h(t('lbOccDays', { n }))}</option>`).join('')}
          </select>
        </div>
      </details>
      <details><summary>${t('lbColumns')}</summary>
        ${chips('columns', columnDefs().map(([k]) => k), current.columns, (k) => columnDefs().find(([x]) => x === k)[1])}
      </details>
    </form>
    <div class="lb-result-head">
      <b id="lb-count"></b>
      <span class="spacer"></span>
      <input id="lb-name" placeholder="${h(t('lbNamePh'))}" value="${h(current.name)}">
      <button type="button" class="btn primary" id="lb-save">${current.list_id ? t('saveBtn') : t('lbSaveAs')}</button>
      <button type="button" class="btn" id="lb-excel">Excel</button>
      <button type="button" class="btn" id="lb-print">Print</button>
    </div>
    <div class="lb-addbar no-print">
      <input id="lb-add-input" list="dl-lb-contacts" placeholder="${h(t('lbAddPh'))}" autocomplete="off">
      <button type="button" class="btn" id="lb-add">${t('lbAddBtn')}</button>
      <datalist id="dl-lb-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
      <span class="hint-line">${t('lbAddHint')}</span>
    </div>
    <h2 class="print-only" id="lb-print-title"></h2>
    <div class="lb-table-wrap"><table class="lb-table" id="lb-table"></table></div>
    <div class="lb-removed no-print" id="lb-removed"></div>`;
  wireBuilder(main);
  renderResult();
  renderListsSide();
}

function nameOf(id) {
  const c = ui.contactById(id);
  return c ? ui.fullNameHe(c) : `#${id}`;
}

/** האם יש שינויים שלא נשמרו ברשימה. */
function markDirty() {
  const now = JSON.stringify([current.criteria, current.columns, $('#lb-name')?.value.trim()]);
  const dirty = now !== current.savedState;
  const btn = $('#lb-save');
  if (btn) {
    btn.classList.toggle('pulse', dirty && Boolean(current.list_id));
    btn.textContent = current.list_id ? (dirty ? t('lbSaveChanges') : t('lbSavedState')) : t('lbSaveAs');
  }
}

function readCriteria(form) {
  const f = (n) => form.elements[n];
  const on = (name) => $$(`.lb-chips[data-name="${name}"] .chip.on`, form).map((b) => b.dataset.v);
  const cr = current.criteria;
  Object.assign(cr, {
    orgs: on('orgs'), orgFormer: f('orgFormer').checked, tags: on('tags'), areas: on('areas'), marital: on('marital'),
    neshei: f('neshei').checked, includeDeceased: f('includeDeceased').checked, includeInactive: f('includeInactive').checked,
    has: { address: f('has_address').checked, email: f('has_email').checked, phone: f('has_phone').checked, english: f('has_english').checked },
    missing: { address: f('miss_address').checked, english: f('miss_english').checked, phone: f('miss_phone').checked },
    donation: { mode: f('don_mode').value, series: f('don_series').value, campaign: f('don_campaign').value, org: f('don_org').value, year: f('don_year').value, min: f('don_min').value },
    unpaid: f('unpaid').checked,
    occasion: { type: f('occ_type').value, days: f('occ_days').value },
    tagSel: readTagSel(form),
  });
  current.columns = on('columns');
}

function wireBuilder(main) {
  const form = $('#lb-form', main);
  const update = () => { readCriteria(form); renderResult(); };
  form.addEventListener('click', (e) => {
    const chip = e.target.closest('.lb-chips .chip');
    if (chip) { chip.classList.toggle('on'); update(); }
  });
  $('#lb-name', main).addEventListener('input', markDirty);
  form.addEventListener('change', update);
  form.addEventListener('input', (e) => { if (e.target.name === 'don_min') update(); });
  const addInput = $('#lb-add-input', main);
  const addPerson = () => {
    const m = addInput.value.match(/\(#(\d+)\)/);
    if (!m || !ui.contactById(m[1])) { ui.toast(t('pickValid'), 'error'); return; }
    const id = Number(m[1]);
    const cr = current.criteria;
    const was = current.lastRows.some((x) => String(x.c.contact_id) === String(id));
    cr.remove = cr.remove.filter((x) => String(x) !== String(id));
    if (!was && !cr.add.map(String).includes(String(id))) cr.add.push(id);
    addInput.value = '';
    renderResult();
    ui.toast(was ? t('lbAlreadyIn', { name: nameOf(id) }) : t('lbAdded', { name: nameOf(id) }));
    addInput.focus();
  };
  $('#lb-add', main).onclick = addPerson;
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } });
  addInput.addEventListener('change', () => { if (/\(#\d+\)/.test(addInput.value)) addPerson(); });
  // צוריקלייגן איינעם וואס מען האט אראפגענומען
  $('#lb-removed', main).addEventListener('click', (e) => {
    const b = e.target.closest('[data-restore]');
    if (!b) return;
    const cr = current.criteria;
    cr.remove = cr.remove.filter((x) => String(x) !== b.dataset.restore);
    renderResult();
  });
  // ✕ בשורה של התוצאה → מורידים את האיש מהרשימה
  $('#lb-table', main).addEventListener('click', (e) => {
    const rm = e.target.closest('.lb-rm');
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    if (rm) {
      const id = Number(tr.dataset.id);
      const cr = current.criteria;
      const wasManual = cr.add.map(String).includes(String(id));
      cr.add = cr.add.filter((x) => String(x) !== String(id));
      // ווער עס איז נאר געווען מיט דער האנט — גענוג אראפצונעמען פון "צוגעלייגט"
      if (!wasManual && !cr.remove.map(String).includes(String(id))) cr.remove.push(id);
      renderResult();
      return;
    }
    ui.openCard(tr.dataset.id);
  });
  $('#lb-save', main).onclick = async () => {
    const name = $('#lb-name', main).value.trim();
    if (!name) { ui.toast(t('lbNameRequired'), 'error'); $('#lb-name', main).focus(); return; }
    readCriteria(form);
    const btn = $('#lb-save', main);
    btn.disabled = true;
    try {
      const id = await saveSavedList({
        ...(state.savedLists.find((l) => String(l.list_id) === String(current.list_id)) || {}),
        list_id: current.list_id || '', name, criteria: JSON.stringify(current.criteria),
        columns: current.columns.join(', '), scope: scopeKey(getScope()),
        visibility: current.visibility || 'private',
      });
      await loadAll();
      current.list_id = id;
      current.name = name;
      current.savedState = null;
      ui.toast(t('lbSaved', { name }));
      renderBuilder();
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
      btn.disabled = false;
    }
  };
  $('#lb-delete', main)?.addEventListener('click', async () => {
    if (!confirm(t('lbConfirmDelete', { name: current.name }))) return;
    try {
      await deleteSavedList(state.savedLists.find((l) => String(l.list_id) === String(current.list_id)));
      await loadAll();
      current = null;
      openOverview();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
  $('#lb-excel', main).onclick = () => exportCsv($('#lb-name').value.trim(), selectedColumns(), current.lastRows);
  $('#lb-back', main).onclick = openOverview;
  $('#lb-publish', main)?.addEventListener('click', async () => {
    if (!confirm(t('lbPublishConfirm', { name: current.name }))) return;
    try {
      const l = state.savedLists.find((x) => String(x.list_id) === String(current.list_id));
      await saveSavedList({ ...l, visibility: 'public' });
      await loadAll();
      current.visibility = 'public';
      ui.toast(t('lbPublished', { name: current.name }));
      renderBuilder();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
  $('#lb-print', main).onclick = () => {
    $('#lb-print-title').textContent = $('#lb-name').value.trim() || t('newListTitle');
    window.print();
  };
}

function selectedColumns() {
  const defs = columnDefs();
  return current.columns.map((k) => defs.find(([x]) => x === k)).filter(Boolean);
}

function renderResult() {
  const rows = evaluate(current.criteria);
  current.lastRows = rows;
  $('#lb-count').textContent = t('lbCount', { n: rows.length });
  const cols = selectedColumns();
  $('#lb-table').innerHTML = `<thead><tr>${cols.map(([, label]) => `<th>${h(label)}</th>`).join('')}<th class="no-print"></th></tr></thead>
    <tbody>${rows.map((x) => `<tr data-id="${h(x.c.contact_id)}"${current.criteria.add.map(String).includes(String(x.c.contact_id)) ? ' class="lb-manual-row" title="' + h(t('lbManualTip')) + '"' : ''}>${cols.map(([k, , fn]) => `<td${['mailing', 'name_en', 'address', 'city', 'state', 'zip', 'mobile', 'home_phone', 'email', 'don_total', 'don_unpaid'].includes(k) ? ' dir="ltr"' : ''}>${h(fn(x.c, x))}</td>`).join('')}
      <td class="no-print"><button type="button" class="linkish lb-rm" title="${h(t('lbRemoveRow'))}">✕</button></td></tr>`).join('')}</tbody>`;
  const removed = current.criteria.remove;
  $('#lb-removed').innerHTML = removed.length ? `<span class="muted">${h(t('lbRemovedLabel', { n: removed.length }))}</span> ${removed.map((id) => `<span class="chip lb-minus">${h(nameOf(id))}
    <button type="button" class="linkish" data-restore="${h(id)}" title="${h(t('lbRestore'))}">↺ ${h(t('lbRestore'))}</button></span>`).join(' ')}` : '';
  if (current.savedState == null) current.savedState = JSON.stringify([current.criteria, current.columns, $('#lb-name')?.value.trim()]);
  markDirty();
}

/** אמת'ער Excel (.xlsx), רעכטס-צו-לינקס. געלט קאלומס ווערן נומערן (מ'קען רעכענען). */
function exportCsv(name, cols, rows) {
  const money = ['don_total', 'don_unpaid'];
  const val = (k, v) => {
    if (!money.includes(k)) return v ?? '';
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return String(v ?? '').trim() && Number.isFinite(n) ? n : '';
  };
  downloadXlsx(name || 'list', cols.map(([, label]) => label),
    rows.map((x) => cols.map(([k, , fn]) => val(k, fn(x.c, x)))), { sheet: name || 'list' });
}

// ---------- איבערבליק: אלע רשימות + גרייטע רשימות ----------
/** קאנטאקטן → Excel (פון דער רשימה אויפן בלאט). */
export function exportContacts(name, contacts) {
  const cols = columnDefs().filter(([k]) => !['don_total', 'don_unpaid', 'occasion'].includes(k));
  downloadXlsx(name, cols.map(([, l]) => l), contacts.map((c) => cols.map(([, , fn]) => fn(c, {}))), { sheet: name });
}

export function templates() {
  return [
    { key: 'tplMail', criteria: { has: { address: true } }, columns: ['mailing', 'address', 'city', 'state', 'zip'] },
    { key: 'tplUnpaid', criteria: { unpaid: true }, columns: ['name_he', 'mobile', 'don_unpaid'] },
    { key: 'tplYahrzeit', criteria: { occasion: { type: 'יארצייט', days: '7' } }, columns: ['name_he', 'occasion', 'mobile'] },
    { key: 'tplNeshei', criteria: { neshei: true }, columns: ['name_he', 'mailing', 'address', 'city', 'zip'] },
    { key: 'tplEmail', criteria: { has: { email: true } }, columns: ['name_he', 'name_en', 'email'] },
    { key: 'tplNoEnglish', criteria: { missing: { english: true } }, columns: ['name_he', 'city', 'mobile'] },
    { key: 'tplNoAddress', criteria: { missing: { address: true } }, columns: ['name_he', 'mobile', 'email'] },
  ].map((x) => ({
    ...x,
    criteria: {
      ...EMPTY(), ...x.criteria,
      has: { ...EMPTY().has, ...(x.criteria.has || {}) },
      missing: { ...EMPTY().missing, ...(x.criteria.missing || {}) },
      occasion: { ...EMPTY().occasion, ...(x.criteria.occasion || {}) },
    },
  }));
}

/** א רשימה איז פריוואט (נאר פאר דעם וואס האט זי געמאכט) ביז מען מאכט זי פובליק. */
export function canSee(l) {
  return l.visibility !== 'private' || String(l.created_by || '').toLowerCase() === state.email;
}

export function savedInScope() {
  const sc = getScope();
  return state.savedLists.filter(canSee).filter((l) => !l.scope || !sc || l.scope === scopeKey(sc));
}

export function parseSaved(l) {
  let cr = EMPTY();
  try { cr = { ...EMPTY(), ...JSON.parse(l.criteria || '{}') }; } catch { /* ריק */ }
  cr.has = { ...EMPTY().has, ...cr.has };
  cr.missing = { ...EMPTY().missing, ...cr.missing };
  cr.donation = { ...EMPTY().donation, ...cr.donation };
  cr.occasion = { ...EMPTY().occasion, ...cr.occasion };
  const keys = splitTags(l.columns).length ? splitTags(l.columns) : DEFAULT_COLUMNS;
  const defs = columnDefs();
  return { cr, cols: keys.map((k) => defs.find(([x]) => x === k)).filter(Boolean) };
}

function renderOverview(main) {
  const lists = savedInScope();
  const sc = getScope();
  main.innerHTML = `
    <div class="camp-page-head">
      <div><h2>${t('savedLists')}</h2><p class="muted">${t('listsHint')}</p>
        ${sc ? `<p class="hint-line">${h(t('listScopeNote', { name: sc.type === 'area' ? (sc.value === '__none__' ? t('noArea') : `${t('area')}: ${sc.value}`) : sc.value || '' }))}</p>` : ''}</div>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="lo-new">${t('newList')}</button>
    </div>
    <h3 class="adm-group-title">${t('myLists')}</h3>
    ${lists.length ? `<table class="series-table lo-table">
      <thead><tr><th>${t('lbNamePh')}</th><th>${t('lbCountCol')}</th><th>${t('lbUpdated')}</th><th></th></tr></thead>
      <tbody>${lists.map((l) => {
        const { cr } = parseSaved(l);
        return `<tr data-open="${h(l.list_id)}"><td><b>${l.visibility === 'private' ? '🔒 ' : ''}${h(l.name)}</b></td><td class="num">${evaluate(cr).length}</td>
          <td class="muted small"><bdi dir="ltr">${h(l.updated_at || '')}</bdi> · ${h(displayName(l.updated_by))}</td>
          <td class="lo-btns"><button type="button" class="btn small-btn" data-excel="${h(l.list_id)}">Excel</button>
            <button type="button" class="btn small-btn" data-mail="${h(l.list_id)}">✉</button>
            <button type="button" class="btn small-btn" data-copy="${h(l.list_id)}">${t('lbDuplicate')}</button></td></tr>`;
      }).join('')}</tbody></table>` : `<p class="empty">${t('noSavedLists')}</p>`}
    <h3 class="adm-group-title">${t('readyLists')}</h3>
    <div class="lo-templates">${templates().map((x, i) => `<button type="button" class="lo-tpl" data-tpl="${i}">
      <b>${h(t(x.key))}</b><span class="muted small">${h(t('lbCount', { n: evaluate(x.criteria).length }))}</span></button>`).join('')}</div>`;
  $('#lo-new', main).onclick = () => openBuilder();
  main.onclick = (e) => {
    const ml = e.target.closest('[data-mail]');
    if (ml) { e.stopPropagation(); openCompose({ listKey: `s:${ml.dataset.mail}` }); return; }
    const ex = e.target.closest('[data-excel]');
    if (ex) {
      e.stopPropagation();
      const l = state.savedLists.find((x) => String(x.list_id) === ex.dataset.excel);
      const { cr, cols } = parseSaved(l);
      exportCsv(l.name, cols, evaluate(cr));
      return;
    }
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const l = state.savedLists.find((x) => String(x.list_id) === cp.dataset.copy);
      const { cr } = parseSaved(l);
      openBuilder(null, { name: `${l.name} (${t('copyWord')})`, criteria: cr, columns: splitTags(l.columns) });
      return;
    }
    const tpl = e.target.closest('[data-tpl]');
    if (tpl) {
      const x = templates()[Number(tpl.dataset.tpl)];
      openBuilder(null, { name: t(x.key), criteria: JSON.parse(JSON.stringify(x.criteria)), columns: x.columns });
      return;
    }
    const row = e.target.closest('[data-open]');
    if (row) openBuilder(state.savedLists.find((x) => String(x.list_id) === row.dataset.open));
  };
}
