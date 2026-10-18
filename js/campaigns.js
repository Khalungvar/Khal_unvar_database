// קאמפיין'ס: נפתחים רק דרך "+ נייער קאמפיין" (עם ההגדרות), כדי שלא ייווצרו סתם הרבה.
// כל קאמפיין שייך ל"סעריע" שחוזרת כל שנה (דינער → דינער תשפ"ה, תשפ"ו, תשפ"ז) — וכך רואים את כל השנים במקום אחד.
import { state, loadAll, saveCampaign } from './data.js';
import { t } from './i18n.js';
import { isTrue, splitTags, escapeHtml as h } from './util.js';
import { toHebrew, yearLabel, todayIso, yearFromLabel } from './hebdate.js';
import { scopeOrgs, defaultOrg } from './scope.js';
import {
  money, orgSelect, donorName, donationRow, openDonationForm, openBulk,
} from './donations.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);

let current = null; // { kind: 'series' | 'campaign', key }

export function initCampaigns(helpers) {
  ui = helpers;
  $('#btn-side-campaign').onclick = () => { document.body.classList.remove('menu-open'); openNewCampaign(); };
  $('#btn-new-campaign').onclick = () => openNewCampaign();
  $('#campaign-side').addEventListener('click', (e) => {
    const b = e.target.closest('[data-series], [data-campaign]');
    if (!b) return;
    if (b.dataset.campaign) showCampaign(b.dataset.campaign);
    else showSeries(b.dataset.series);
  });
  $('#campaign-main').addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto-campaign]');
    if (go) { showCampaign(go.dataset.gotoCampaign); return; }
    const gs = e.target.closest('[data-goto-series]');
    if (gs) { showSeries(gs.dataset.gotoSeries); return; }
    const row = e.target.closest('.don-row');
    if (row) openDonationForm(state.donations.find((d) => String(d.donation_id) === row.dataset.id));
  });
}

// ---------- רשימת הקאמפיין'ס ----------
function stats(name) {
  const list = state.donations.filter((d) => d.campaign === name);
  const total = list.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const open = list.filter((d) => !isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const donors = new Set(list.map((d) => d.contact_id || `n:${d.donor_name}`)).size;
  return { list, total, open, donors, count: list.length };
}

/** כל הקאמפיין'ס: מהלשונית Campaigns, ועוד שמות ישנים שנמצאים רק בנדבות. */
export function allCampaigns() {
  const rows = state.campaigns.map((c) => ({
    name: c.campaign, series: c.series || c.campaign, year: c.year || '', org: c.org || '',
    event_tags: c.event_tags || '', note: c.note || '',
  }));
  const known = new Set(rows.map((c) => c.name));
  state.donations.forEach((d) => {
    if (d.campaign && !known.has(d.campaign)) {
      known.add(d.campaign);
      rows.push({ name: d.campaign, series: d.campaign, year: d.event_year || '', org: d.org || '', event_tags: d.event_tags || '', note: '' });
    }
  });
  return rows.map((c) => ({ ...c, ...stats(c.name) }))
    .sort((a, b) => yearFromLabel(b.year) - yearFromLabel(a.year) || a.name.localeCompare(b.name, 'he'));
}

export function campaignsInScope() {
  const orgs = scopeOrgs();
  return allCampaigns().filter((c) => !orgs || orgs.includes(c.org));
}

export function campaignByName(name) {
  return name ? allCampaigns().find((c) => c.name === name) || null : null;
}

/** <option>'ס פאר א <select>: "— נישט פון א קאמפיין —" + די קאמפיין'ס (די נייסטע פריער). */
export function campaignOptions(selected = '') {
  const list = campaignsInScope();
  if (selected && !list.some((c) => c.name === selected)) {
    const c = campaignByName(selected);
    if (c) list.unshift(c);
  }
  return `<option value="">${h(t('noCampaignChoice'))}</option>`
    + list.map((c) => `<option value="${h(c.name)}"${c.name === selected ? ' selected' : ''}>${h(c.name)}</option>`).join('');
}

function seriesList() {
  const map = new Map();
  campaignsInScope().forEach((c) => {
    if (!map.has(c.series)) map.set(c.series, []);
    map.get(c.series).push(c);
  });
  return [...map.entries()].map(([series, years]) => ({ series, years }))
    .sort((a, b) => yearFromLabel(b.years[0].year) - yearFromLabel(a.years[0].year) || a.series.localeCompare(b.series, 'he'));
}

// ---------- תפריט הצד ----------
export function renderCampaignSide() {
  const side = $('#campaign-side');
  if (!side) return;
  const active = !$('.view[data-view="campaign"]').hidden && current;
  const on = (kind, key) => (active && current.kind === kind && current.key === key ? ' on' : '');
  const list = seriesList();
  side.innerHTML = list.length ? list.map((s) => `<div class="org-group">
      <button type="button" class="org-link org-top${on('series', s.series)}" data-series="${h(s.series)}">
        <span>${h(s.series)}</span><span class="side-sum">${s.years.length > 1 ? h(t('yearsCount', { n: s.years.length })) : ''}</span></button>
      ${s.years.map((c) => `<button type="button" class="org-link org-sub${on('campaign', c.name)}" data-campaign="${h(c.name)}">
        <span>${h(c.year || c.name)}</span><span class="side-sum">${money(c.total)}</span></button>`).join('')}
    </div>`).join('')
    : `<p class="muted small side-empty">${h(t('noCampaigns'))}</p>`;
}

// ---------- דף סעריע: כל השנים ביחד ----------
export function showSeries(series) {
  current = { kind: 'series', key: series };
  ui.showView('campaign');
}

export function showCampaign(name) {
  current = { kind: 'campaign', key: name };
  ui.showView('campaign');
}

export function renderCampaignMain() {
  const main = $('#campaign-main');
  if (!main || !current) return;
  if (current.kind === 'series') renderSeries(main);
  else renderCampaign(main);
  renderCampaignSide();
}

function renderSeries(main) {
  const s = seriesList().find((x) => x.series === current.key);
  if (!s) { main.innerHTML = `<p class="empty">${h(t('noCampaigns'))}</p>`; return; }
  const max = Math.max(1, ...s.years.map((c) => c.total));
  const latest = s.years[0];
  main.innerHTML = `<div class="camp-page-head">
      <div><h2>${h(s.series)}</h2><p class="muted">${h(t('seriesHint'))}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="series-new-year">${t('newYear')}</button>
    </div>
    <table class="series-table">
      <thead><tr><th>${t('eventYear')}</th><th>${t('donTotal')}</th><th></th><th>${t('campaignDonors')}</th><th>${t('paid')}</th><th>${t('unpaid')}</th><th>${t('forOrg')}</th></tr></thead>
      <tbody>${s.years.map((c) => `<tr data-goto-campaign="${h(c.name)}">
        <td><b>${h(c.year || '—')}</b></td>
        <td class="num">${money(c.total)}</td>
        <td class="bar-cell"><span class="bar" style="width:${Math.round((c.total / max) * 100)}%"></span></td>
        <td class="num">${c.donors}</td>
        <td class="num">${money(c.total - c.open)}</td>
        <td class="num ${c.open ? 'unpaid-text' : ''}">${money(c.open)}</td>
        <td>${h(c.org)}</td></tr>`).join('')}</tbody>
    </table>`;
  $('#series-new-year', main).onclick = () => openNewCampaign({
    series: s.series, org: latest.org, event_tags: latest.event_tags, year: nextYear(latest.year),
  });
}

function nextYear(label) {
  const y = yearFromLabel(label);
  return y ? yearLabel(y + 1) : yearLabel(toHebrew(todayIso()).y);
}

// ---------- דף קאמפיין ----------
function renderCampaign(main) {
  const c = campaignByName(current.key);
  if (!c) { main.innerHTML = `<p class="empty">${h(t('noCampaigns'))}</p>`; return; }
  const list = c.list.slice()
    .sort((a, b) => Number(b.amount_usd || 0) - Number(a.amount_usd || 0) || donorName(a).localeCompare(donorName(b), 'he'));
  const others = allCampaigns().filter((x) => x.series === c.series);
  main.innerHTML = `<div class="camp-page-head">
      <div>
        ${others.length > 1 ? `<button type="button" class="linkish" data-goto-series="${h(c.series)}">← ${h(t('allYearsOf', { name: c.series }))}</button>` : ''}
        <h2>${h(c.name)}</h2>
        <p class="muted">${splitTags(c.event_tags).map((x) => `<span class="chip">${h(x)}</span>`).join(' ')}
          ${c.org ? `<span class="badge org">${h(c.org)}</span>` : ''} ${c.note ? `· ${h(c.note)}` : ''}</p>
      </div>
      <span class="spacer"></span>
      <button type="button" class="btn" id="camp-settings">${t('campaignSettings')}</button>
      <button type="button" class="btn" id="camp-add-one">${t('newDonation')}</button>
      <button type="button" class="btn primary" id="camp-add-more">${t('campaignAddMore')}</button>
    </div>
    <div class="camp-stats">
      <div><span>${t('donTotal')}</span><b>${money(c.total)}</b></div>
      <div><span>${t('campaignDonors')}</span><b>${c.donors}</b></div>
      <div><span>${t('paid')}</span><b>${money(c.total - c.open)}</b></div>
      <div><span>${t('unpaid')}</span><b class="${c.open ? 'unpaid-text' : ''}">${money(c.open)}</b></div>
    </div>
    <div class="list">${list.map((d) => donationRow(d)).join('') || `<p class="empty">${h(t('noDonationsYet'))}</p>`}</div>`;
  $('#camp-add-more', main).onclick = () => openBulk({ campaign: c.name });
  $('#camp-add-one', main).onclick = () => openDonationForm({ campaign: c.name });
  $('#camp-settings', main).onclick = () => openNewCampaign(c, true);
}

// ---------- "+ נייער קאמפיין" (און סעטינגס) ----------
export function openNewCampaign(preset = {}, editing = false) {
  const form = $('#newcamp-form');
  const now = toHebrew(todayIso()).y;
  const years = [];
  for (let y = now + 2; y >= now - 5; y -= 1) years.push(yearLabel(y));
  const year = preset.year ?? yearLabel(now);
  if (year && !years.includes(year)) years.push(year);
  const series = [...new Set(allCampaigns().map((c) => c.series))];
  form.innerHTML = `
    <button type="button" class="x-close" id="nc-x" aria-label="${h(t('close'))}">✕</button>
    <h2>${editing ? t('campaignSettingsTitle', { name: preset.name }) : t('newCampaignTitle')}</h2>
    <div class="don-quick">
      <div class="grid">
        <label class="org-pick">${t('seriesName')} *
          <input name="series" list="dl-series" autocomplete="off" value="${h(preset.series || '')}" ${editing ? 'disabled' : ''} placeholder="${h(t('seriesPh'))}">
          <datalist id="dl-series">${series.map((x) => `<option value="${h(x)}">`).join('')}</datalist>
          <span class="hint-line">${t('seriesHelp')}</span></label>
        <label class="org-pick">${t('eventYear')}
          <select name="year" ${editing ? 'disabled' : ''}><option value="">${h(t('noYear'))}</option>${years.map((y) => `<option${y === year ? ' selected' : ''}>${h(y)}</option>`).join('')}</select></label>
      </div>
      <p class="nc-preview">${t('willBeCalled')} <b class="nc-name"></b></p>
      <label class="wide org-pick">${t('campaignOrg')} *
        ${orgSelect('org', preset.org || defaultOrg())}</label>
      <div class="quick-block">
        <span class="quick-label">${t('eventLegend')}</span>
        ${ui.tagPicker('event_tags', 'event_tag', preset.event_tags || '')}
      </div>
      <label class="wide org-pick">${t('comments')}<input name="note" value="${h(preset.note || '')}"></label>
    </div>
    <div class="actions">
      <span class="spacer"></span>
      <button type="button" class="btn" id="nc-cancel">${t('cancelBtn')}</button>
      <button type="submit" class="btn primary" id="nc-save">${editing ? t('saveBtn') : t('createCampaign')}</button>
    </div>`;
  const f = (n) => form.elements[n];
  const fullName = () => (editing ? preset.name : [f('series').value.trim(), f('year').value].filter(Boolean).join(' '));
  const preview = () => { $('.nc-name', form).textContent = fullName() || '—'; };
  form.oninput = preview;
  form.onchange = preview;
  preview();
  ui.wireTagPicker($('.tags[data-name="event_tags"]', form));
  // סעריע וואס איז שוין דא → ארגון און טעג פונעם לעצטן יאר
  if (!editing) {
    f('series').addEventListener('change', () => {
      const last = allCampaigns().find((c) => c.series === f('series').value.trim());
      if (!last) return;
      if (last.org) f('org').value = last.org;
      const want = splitTags(last.event_tags);
      form.querySelectorAll('.tags[data-name="event_tags"] .chip.toggle').forEach((x) => x.classList.toggle('on', want.includes(x.textContent.trim())));
    });
  }
  const close = () => $('#newcamp-dialog').close();
  $('#nc-x', form).onclick = close;
  $('#nc-cancel', form).onclick = close;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = fullName();
    if (!f('series').value.trim()) { ui.toast(t('seriesRequired'), 'error'); f('series').focus(); return; }
    if (!f('org').value) { ui.toast(t('orgRequired'), 'error'); f('org').focus(); return; }
    if (!editing && allCampaigns().some((c) => c.name === name)) { ui.toast(t('campaignExists', { name }), 'error'); return; }
    const btn = $('#nc-save', form);
    btn.disabled = true;
    try {
      await saveCampaign({
        campaign: name,
        series: editing ? preset.series : f('series').value.trim(),
        year: editing ? preset.year : f('year').value,
        org: f('org').value,
        event_tags: ui.readTags(form, 'event_tags'),
        note: f('note').value.trim(),
      });
      await loadAll();
      close();
      ui.refreshAll();
      ui.toast(editing ? t('campaignOrgSaved') : t('campaignCreated', { name }));
      showCampaign(name);
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
    } finally { btn.disabled = false; }
  };
  $('#newcamp-dialog').showModal();
  (editing ? f('org') : f('series')).focus();
}
