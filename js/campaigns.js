// קאמפיינען — צוויי סארטן:
//  🔁 יערליך (לשונית YearlyCampaigns): "קאווע", "דינער השנתי"... יעדעס יאר איז "<נאמען> <יאר>" (למשל "קאווע תשפ"ז").
//     דאס נייע יאר עפנט זיך אליין ביים ראש השנה — מ'דארף גארנישט טון. א שורה אין Campaigns ווערט נאר געמאכט
//     ווען מ'שטעלט עפעס ספעציעל פאר יענעם יאר (ציל, הערה). אזוי קען עס נישט "צעפאלן" אדער זיך פארדאפלען.
//  איינמאליג (לשונית Campaigns, kind=once): א קאמפיין פאר איין מאל.
import { state, loadAll, saveCampaign, saveYearly } from './data.js';
import { t } from './i18n.js';
import { isTrue, splitTags, escapeHtml as h } from './util.js';
import { toHebrew, yearLabel, todayIso, yearFromLabel } from './hebdate.js';
import { scopeOrgs, defaultOrg, yearlyOf } from './scope.js';
import {
  money, orgSelect, donorName, donationRow, openDonationForm, openBulk, exportDonations,
} from './donations.js';
import { donationInScope } from './scope.js';

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
    if (e.target.closest('[data-hub]')) { ui.showView('donhub'); return; }
    const row = e.target.closest('.don-row');
    if (row) openDonationForm(state.donations.find((d) => String(d.donation_id) === row.dataset.id));
  });
}


const curYear = () => yearLabel(toHebrew(todayIso()).y);

/** די יערליכע קאמפיינען, לויט דער ארדענונג. */
export function yearlySeries() {
  return (state.yearly || []).map((y) => ({
    series: String(y.series).trim(), org: y.org || '', event_tags: y.event_tags || '', note: y.note || '',
    active: y.active === '' || y.active == null || isTrue(y.active), order: Number(y.order) || 999,
  })).sort((a, b) => a.order - b.order || a.series.localeCompare(b.series, 'he'));
}

// ---------- רשימת הקאמפיין'ס ----------
function stats(name) {
  const list = state.donations.filter((d) => d.campaign === name);
  const total = list.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const open = list.filter((d) => !isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
  const donors = new Set(list.map((d) => d.contact_id || `n:${d.donor_name}`)).size;
  return { list, total, open, donors, count: list.length };
}

/** אלע קאמפיינען (יעדעס יאר פון א יערליכן איז א באזונדערער קאמפיין). */
export function allCampaigns() {
  const ys = yearlySeries();
  const map = new Map();
  const add = (o) => { if (o.name && !map.has(o.name)) map.set(o.name, o); };
  const yearOf = (s, name) => name.slice(s.series.length + 1).trim();
  const yearly = (s, year, row = null) => ({
    name: `${s.series} ${year}`, kind: 'yearly', series: s.series, year,
    org: row?.org || s.org, event_tags: row?.event_tags || s.event_tags, note: row?.note || '',
    goal: Number(row?.goal) || 0, def: s,
  });
  const seriesFor = (name, seriesField) => ys.find((x) => x.series === seriesField && name === `${x.series} ${yearOf(x, name)}`)
    || ys.find((x) => x.series === yearlyOf(name)?.series);
  state.campaigns.forEach((c) => {
    if (!c.campaign) return;
    const s = c.kind === 'once' ? null : seriesFor(c.campaign, c.series);
    if (s) add(yearly(s, c.year || yearOf(s, c.campaign), c));
    else {
      add({
        name: c.campaign, kind: 'once', series: c.series || c.campaign, year: c.year || '', org: c.org || '',
        event_tags: c.event_tags || '', note: c.note || '', goal: Number(c.goal) || 0,
      });
    }
  });
  // דאס יאר פון יעדן אקטיוון יערליכן קאמפיין — שטענדיג דא, אויך אן א שורה
  ys.filter((s) => s.active).forEach((s) => add(yearly(s, curYear())));
  // אלטע נעמען וואס זענען נאר אין די נדבות
  state.donations.forEach((d) => {
    if (!d.campaign || map.has(d.campaign)) return;
    const s = seriesFor(d.campaign, '');
    if (s) add(yearly(s, yearOf(s, d.campaign)));
    else add({ name: d.campaign, kind: 'once', series: d.campaign, year: d.event_year || '', org: d.org || '', event_tags: d.event_tags || '', note: '', goal: 0 });
  });
  return [...map.values()].map((c) => ({ ...c, ...stats(c.name) }))
    .sort((a, b) => yearFromLabel(b.year) - yearFromLabel(a.year) || a.name.localeCompare(b.name, 'he'));
}

function inScope(org) {
  const orgs = scopeOrgs();
  return !orgs || orgs.includes(org);
}

export function campaignsInScope() {
  return allCampaigns().filter((c) => inScope(c.org));
}

export function campaignByName(name) {
  return name ? allCampaigns().find((c) => c.name === name) || null : null;
}

/** <option>'ס פאר א <select>: "— נישט פון א קאמפיין —" + יערליכע (דאס יאר) + איינמאליגע. */
export function campaignOptions(selected = '') {
  const list = campaignsInScope();
  if (selected && !list.some((c) => c.name === selected)) {
    const c = campaignByName(selected);
    if (c) list.unshift(c);
  }
  const opt = (c) => `<option value="${h(c.name)}"${c.name === selected ? ' selected' : ''}>${h(c.name)}</option>`;
  // יערליכע: קודם דאס יאר (לויט דער ארדענונג), דערנאך די אנדערע יארן
  const order = new Map(yearlySeries().map((s, i) => [s.series, i]));
  const now = curYear();
  const y = list.filter((c) => c.kind === 'yearly').sort((a, b) => (b.year === now) - (a.year === now)
    || yearFromLabel(b.year) - yearFromLabel(a.year) || (order.get(a.series) ?? 99) - (order.get(b.series) ?? 99));
  const o = list.filter((c) => c.kind !== 'yearly');
  return `<option value="">${h(t('noCampaignChoice'))}</option>`
    + (y.length ? `<optgroup label="${h(t('yearlyCamps'))}">${y.map(opt).join('')}</optgroup>` : '')
    + (o.length ? `<optgroup label="${h(t('onceCamps'))}">${o.map(opt).join('')}</optgroup>` : '');
}

/** גרופעס: יעדער יערליכער קאמפיין מיט זיינע יארן, דערנאך די איינמאליגע. */
function seriesList() {
  const all = allCampaigns();
  const yearly = yearlySeries().filter((s) => inScope(s.org)).map((s) => ({
    series: s.series, kind: 'yearly', def: s, years: all.filter((c) => c.kind === 'yearly' && c.series === s.series),
  })).filter((g) => g.years.length || g.def.active);
  const map = new Map();
  all.filter((c) => c.kind !== 'yearly' && inScope(c.org)).forEach((c) => {
    if (!map.has(c.series)) map.set(c.series, []);
    map.get(c.series).push(c);
  });
  const once = [...map.entries()].map(([series, years]) => ({ series, kind: 'once', years }))
    .sort((a, b) => yearFromLabel(b.years[0].year) - yearFromLabel(a.years[0].year) || a.series.localeCompare(b.series, 'he'));
  return [...yearly, ...once];
}

// ---------- דער לאבי פון "נדבות און קאמפיינען" ----------
function campCard(g) {
  const isY = g.kind === 'yearly';
  const c = (isY && g.years.find((x) => x.year === curYear())) || g.years[0] || { name: '', total: 0, open: 0, donors: 0, year: '' };
  const prev = isY ? g.years.find((x) => yearFromLabel(x.year) === yearFromLabel(c.year) - 1) : null;
  const pct = c.goal ? Math.min(100, Math.round((c.total / c.goal) * 100))
    : (c.total ? Math.round(((c.total - c.open) / c.total) * 100) : 0);
  const org = isY ? g.def.org : c.org;
  return `<div class="hub-camp${isY ? ' yearly' : ''}${isY && !g.def.active ? ' off' : ''}" role="button" tabindex="0" data-goto-campaign="${h(c.name)}">
    <span class="hc-top"><b class="hc-name">${isY ? '🔁 ' : ''}${h(g.series)}</b><span class="hc-year">${h(c.year || '')}</span></span>
    <b class="hc-total">${money(c.total)}</b>
    <span class="hc-bar" title="${h(c.goal ? t('goalOf', { goal: money(c.goal) }) : t('paid'))} ${pct}%"><span style="width:${pct}%"></span></span>
    <span class="hc-sub muted small">${h(t('campaignDonors'))}: ${c.donors}${c.goal ? ` · ${h(t('goalOf', { goal: money(c.goal) }))}` : ''}${c.open ? ` · <span class="unpaid-text">${h(t('unpaid'))} ${money(c.open)}</span>` : ''}</span>
    ${prev ? `<span class="hc-sub muted small">${h(t('lastYear'))} (${h(prev.year)}): ${money(prev.total)}</span>` : ''}
    ${org ? `<span class="badge org mini">${h(org)}</span>` : (isY ? `<span class="muted small warn-text">⚠ ${h(t('noOrgYet'))}</span>` : '')}
    ${g.years.length > 1 || isY ? `<button type="button" class="linkish small" data-goto-series="${h(g.series)}">${h(isY ? t('allYearsLink') : t('hubYears', { n: g.years.length }))} ←</button>` : ''}
  </div>`;
}

export function renderDonHub() {
  const main = $('#donhub-main');
  if (!main) return;
  const groups = seriesList();
  const yearly = groups.filter((g) => g.kind === 'yearly');
  const once = groups.filter((g) => g.kind !== 'yearly');
  const recent = state.donations.filter(donationInScope)
    .sort((a, b) => Number(b.donation_id || 0) - Number(a.donation_id || 0)).slice(0, 25);
  main.innerHTML = `<div class="camp-page-head hub-head">
      <h2>${h(t('hubTitle'))}</h2>
      <span class="spacer"></span>
      <button type="button" class="btn" id="hub-lobby">${h(t('lobbyBack'))}</button>
    </div>
    <div class="hub-actions">
      <button type="button" class="lobby-quick" id="hub-new-don">${h(t('newDonation'))}</button>
      <button type="button" class="lobby-quick" id="hub-bulk">${h(t('campaignBtn'))}</button>
      <button type="button" class="lobby-quick" id="hub-new-camp">${h(t('newCampaign'))}</button>
    </div>
    <h3 class="hub-sub">${h(t('yearlyCamps'))} <span class="muted small">· ${h(curYear())}</span></h3>
    <div class="hub-camps">${yearly.map(campCard).join('') || `<p class="muted">${h(t('hubNoCamps'))}</p>`}</div>
    ${once.length ? `<h3 class="hub-sub">${h(t('onceCamps'))}</h3><div class="hub-camps">${once.map(campCard).join('')}</div>` : ''}
    <div class="hub-recent-head"><h3 class="hub-sub">${h(t('hubRecent'))}</h3><span class="spacer"></span>
      <button type="button" class="btn small-btn" id="hub-xl">Excel</button>
      <button type="button" class="btn small-btn" id="hub-all">${h(t('hubAll'))}</button></div>
    <div class="list">${recent.map((d) => donationRow(d)).join('') || `<p class="empty">${h(t('noDonationsYet'))}</p>`}</div>`;
  $('#hub-lobby', main).onclick = () => ui.showView('lobby');
  $('#hub-new-don', main).onclick = () => openDonationForm();
  $('#hub-bulk', main).onclick = () => openBulk();
  $('#hub-new-camp', main).onclick = () => openNewCampaign();
  $('#hub-all', main).onclick = () => ui.showView('donations');
  $('#hub-xl', main).onclick = () => exportDonations(t('hubRecent'), recent);
  main.onclick = (e) => {
    const gs = e.target.closest('[data-goto-series]');
    if (gs) { showSeries(gs.dataset.gotoSeries); return; }
    const row = e.target.closest('.don-row');
    if (row) { openDonationForm(state.donations.find((d) => String(d.donation_id) === row.dataset.id)); return; }
    const go = e.target.closest('[data-goto-campaign]');
    if (go) showCampaign(go.dataset.gotoCampaign);
  };
  main.onkeydown = (e) => {
    const go = e.target.closest?.('.hub-camp');
    if (go && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showCampaign(go.dataset.gotoCampaign); }
  };
}

// ---------- תפריט הצד: נאר דאס לעצטע יאר (אלע יארן — אין דעם קאמפיין'ס בלאט) ----------
export function renderCampaignSide() {
  const side = $('#campaign-side');
  if (!side) return;
  const active = !$('.view[data-view="campaign"]').hidden && current;
  const on = (kind, key) => (active && current.kind === kind && current.key === key ? ' on' : '');
  const list = seriesList();
  side.innerHTML = list.length ? list.map((s) => {
    const shown = s.kind === 'yearly' ? [s.years.find((x) => x.year === curYear()) || s.years[0]].filter(Boolean) : s.years;
    return `<div class="org-group">
      <button type="button" class="org-link org-top${on('series', s.series)}" data-series="${h(s.series)}">
        <span>${s.kind === 'yearly' ? '🔁 ' : ''}${h(s.series)}</span><span class="side-sum">${s.years.length > 1 ? h(t('yearsCount', { n: s.years.length })) : ''}</span></button>
      ${shown.map((c) => `<button type="button" class="org-link org-sub${on('campaign', c.name)}" data-campaign="${h(c.name)}">
        <span>${h(c.year || c.name)}</span><span class="side-sum">${money(c.total)}</span></button>`).join('')}
    </div>`;
  }).join('')
    : `<p class="muted small side-empty">${h(t('noCampaigns'))}</p>`;
}

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

// ---------- בלאט פון א קאמפיין מיט אלע יארן ----------
function renderSeries(main) {
  const s = seriesList().find((x) => x.series === current.key);
  if (!s) { main.innerHTML = `<p class="empty">${h(t('noCampaigns'))}</p>`; return; }
  const isY = s.kind === 'yearly';
  const max = Math.max(1, ...s.years.map((c) => Math.max(c.total, c.goal || 0)));
  const next = yearLabel(yearFromLabel(curYear()) + 1);
  const hasNext = s.years.some((c) => c.year === next);
  main.innerHTML = `<button type="button" class="linkish solo-only hub-back" data-hub>${h(t('hubBack'))}</button>
    <div class="camp-page-head">
      <div><h2>${isY ? '🔁 ' : ''}${h(s.series)}</h2>
        <p class="muted">${h(isY ? t('seriesYearlyHint') : t('seriesHint'))}
          ${isY && s.def.org ? ` <span class="badge org">${h(s.def.org)}</span>` : ''}
          ${isY && !s.def.org ? ` <span class="warn-text">⚠ ${h(t('noOrgYet'))}</span>` : ''}
          ${isY && !s.def.active ? ` <span class="badge muted">${h(t('yearlyOff'))}</span>` : ''}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn" id="series-xl" title=".xlsx">Excel</button>
      ${isY ? `<button type="button" class="btn" id="series-settings">${h(t('campaignSettings'))}</button>` : ''}
      ${isY && !hasNext ? `<button type="button" class="btn" id="series-prepare">${h(t('prepareYear', { year: next }))}</button>` : ''}
    </div>
    <table class="series-table">
      <thead><tr><th>${t('eventYear')}</th><th>${t('donTotal')}</th><th></th><th>${t('campaignDonors')}</th><th>${t('paid')}</th><th>${t('unpaid')}</th><th>${t('goal')}</th><th>${t('forOrg')}</th></tr></thead>
      <tbody>${s.years.map((c) => `<tr data-goto-campaign="${h(c.name)}"${c.year === curYear() ? ' class="this-year"' : ''}>
        <td><b>${h(c.year || '—')}</b></td>
        <td class="num">${money(c.total)}</td>
        <td class="bar-cell"><span class="bar" style="width:${Math.round((c.total / max) * 100)}%"></span></td>
        <td class="num">${c.donors}</td>
        <td class="num">${money(c.total - c.open)}</td>
        <td class="num ${c.open ? 'unpaid-text' : ''}">${money(c.open)}</td>
        <td class="num">${c.goal ? money(c.goal) : ''}</td>
        <td>${h(c.org)}</td></tr>`).join('')}</tbody>
    </table>`;
  $('#series-xl', main).onclick = () => exportDonations(s.series, s.years.flatMap((c) => c.list));
  if (isY) $('#series-settings', main).onclick = () => openNewCampaign({ mode: 'yearly', def: s.def });
  const prep = $('#series-prepare', main);
  if (prep) {
    prep.onclick = async () => {
      prep.disabled = true;
      try {
        await saveCampaign({ campaign: `${s.series} ${next}`, series: s.series, year: next, kind: 'yearly' });
        await loadAll();
        ui.refreshAll();
        showCampaign(`${s.series} ${next}`);
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); prep.disabled = false; }
    };
  }
}

// ---------- בלאט פון איין קאמפיין (איין יאר) ----------
function renderCampaign(main) {
  const c = campaignByName(current.key);
  if (!c) { main.innerHTML = `<p class="empty">${h(t('noCampaigns'))}</p>`; return; }
  const list = c.list.slice()
    .sort((a, b) => Number(b.amount_usd || 0) - Number(a.amount_usd || 0) || donorName(a).localeCompare(donorName(b), 'he'));
  const isY = c.kind === 'yearly';
  const others = allCampaigns().filter((x) => x.series === c.series);
  const pct = c.goal ? Math.round((c.total / c.goal) * 100) : 0;
  main.innerHTML = `<button type="button" class="linkish solo-only hub-back" data-hub>${h(t('hubBack'))}</button>
    <div class="camp-page-head">
      <div>
        ${isY || others.length > 1 ? `<button type="button" class="linkish" data-goto-series="${h(c.series)}">← ${h(t('allYearsOf', { name: c.series }))}</button>` : ''}
        <h2>${isY ? '🔁 ' : ''}${h(c.name)}</h2>
        <p class="muted">${splitTags(c.event_tags).map((x) => `<span class="chip">${h(x)}</span>`).join(' ')}
          ${c.org ? `<span class="badge org">${h(c.org)}</span>` : (isY ? `<span class="warn-text">⚠ ${h(t('noOrgYet'))}</span>` : '')} ${c.note ? `· ${h(c.note)}` : ''}</p>
      </div>
      <span class="spacer"></span>
      <button type="button" class="btn" id="camp-xl" title=".xlsx">Excel</button>
      <button type="button" class="btn" id="camp-settings">${t('campaignSettings')}</button>
      <button type="button" class="btn" id="camp-add-one">${t('newDonation')}</button>
      <button type="button" class="btn primary" id="camp-add-more">${t('campaignAddMore')}</button>
    </div>
    <div class="camp-stats${c.goal ? ' with-goal' : ''}">
      <div><span>${t('donTotal')}</span><b>${money(c.total)}</b></div>
      ${c.goal ? `<div><span>${t('goal')}</span><b>${money(c.goal)}</b><span class="hc-bar"><span style="width:${Math.min(100, pct)}%"></span></span><span>${pct}%</span></div>` : ''}
      <div><span>${t('campaignDonors')}</span><b>${c.donors}</b></div>
      <div><span>${t('paid')}</span><b>${money(c.total - c.open)}</b></div>
      <div><span>${t('unpaid')}</span><b class="${c.open ? 'unpaid-text' : ''}">${money(c.open)}</b></div>
    </div>
    <div class="list">${list.map((d) => donationRow(d)).join('') || `<p class="empty">${h(t('noDonationsYet'))}</p>`}</div>`;
  $('#camp-add-more', main).onclick = () => openBulk({ campaign: c.name });
  $('#camp-add-one', main).onclick = () => openDonationForm({ campaign: c.name });
  $('#camp-xl', main).onclick = () => exportDonations(c.name, list);
  $('#camp-settings', main).onclick = () => openNewCampaign({ mode: isY ? 'year' : 'once', camp: c });
}

// ---------- "+ נייער קאמפיין" און סעטינגס ----------
// mode: 'new' (קלייבט: יערליך / איינמאליג) · 'yearly' (סעטינגס פון א יערליכן) · 'year' (איין יאר: ציל, הערה) · 'once'
export function openNewCampaign(opts = {}) {
  const mode = opts.mode || 'new';
  const form = $('#newcamp-form');
  const def = opts.def || {};
  const camp = opts.camp || {};
  const now = toHebrew(todayIso()).y;
  const years = [];
  for (let y = now + 2; y >= now - 5; y -= 1) years.push(yearLabel(y));
  const title = {
    new: t('newCampaignTitle'), yearly: t('campaignSettingsTitle', { name: def.series }),
    year: t('yearSettingsTitle', { name: camp.name }), once: t('campaignSettingsTitle', { name: camp.name }),
  }[mode];
  let kind = mode === 'new' ? (opts.kind || 'yearly') : (mode === 'once' ? 'once' : 'yearly');
  const orgField = (v) => `<label class="wide org-pick nc-org">${t('campaignOrg')} *${orgSelect('org', v)}</label>`;
  form.innerHTML = `
    <button type="button" class="x-close" id="nc-x" aria-label="${h(t('close'))}">✕</button>
    <h2>${h(title)}</h2>
    ${mode === 'new' ? `<div class="nc-kinds">
      <button type="button" class="nc-kind" data-kind="yearly"><b>${h(t('kindYearly'))}</b><span>${h(t('kindYearlyHelp'))}</span></button>
      <button type="button" class="nc-kind" data-kind="once"><b>${h(t('kindOnce'))}</b><span>${h(t('kindOnceHelp'))}</span></button>
    </div>` : ''}
    <div class="don-quick">
      ${mode === 'new' ? `<div class="grid">
        <label class="org-pick">${t('seriesName')} *
          <input name="series" autocomplete="off" placeholder="${h(t('yearlyNamePh'))}"></label>
        <label class="org-pick nc-once">${t('eventYear')}
          <select name="year"><option value="">${h(t('noYear'))}</option>${years.map((y) => `<option>${h(y)}</option>`).join('')}</select></label>
      </div>
      <p class="nc-preview">${t('willBeCalled')} <b class="nc-name"></b></p>` : ''}
      ${mode === 'year' ? `<p class="muted">${camp.org ? `<span class="badge org">${h(camp.org)}</span> · ` : ''}${h(t('yearOrgHint'))}</p>`
        : orgField(mode === 'yearly' ? def.org || '' : mode === 'once' ? camp.org || '' : defaultOrg())}
      ${mode !== 'year' ? `<div class="quick-block">
        <span class="quick-label">${t('eventLegend')}</span>
        ${ui.tagPicker('event_tags', 'event_tag', (mode === 'yearly' ? def.event_tags : camp.event_tags) || '')}
      </div>` : ''}
      <div class="grid">
        <label class="org-pick nc-goal">${t('goal')}<input name="goal" type="number" min="0" step="1" dir="ltr" value="${h(camp.goal || '')}"></label>
        <label class="org-pick">${t('comments')}<input name="note" value="${h((mode === 'yearly' ? def.note : camp.note) || '')}"></label>
      </div>
      ${mode === 'yearly' ? `<label class="check"><input type="checkbox" name="active"${def.active ? ' checked' : ''}> ${h(t('yearlyActive'))}</label>` : ''}
    </div>
    <div class="actions">
      <span class="spacer"></span>
      <button type="button" class="btn" id="nc-cancel">${t('cancelBtn')}</button>
      <button type="submit" class="btn primary" id="nc-save">${mode === 'new' ? t('createCampaign') : t('saveBtn')}</button>
    </div>`;
  const f = (n) => form.elements[n];
  const fullName = () => (kind === 'yearly' ? f('series').value.trim() : [f('series').value.trim(), f('year').value].filter(Boolean).join(' '));
  const sync = () => {
    if (mode !== 'new') return;
    form.querySelectorAll('.nc-kind').forEach((b) => b.classList.toggle('on', b.dataset.kind === kind));
    form.querySelectorAll('.nc-once').forEach((x) => { x.hidden = kind === 'yearly'; });
    $('.nc-goal', form).hidden = kind === 'yearly';
    $('.nc-preview', form).innerHTML = kind === 'yearly'
      ? `${h(t('yearlyWillBe'))} <b>${h(f('series').value.trim() || '…')} ${h(curYear())}</b>, <b>${h(f('series').value.trim() || '…')} ${h(yearLabel(now + 1))}</b> …`
      : `${h(t('willBeCalled'))} <b>${h(fullName() || '—')}</b>`;
  };
  form.oninput = sync;
  form.onchange = sync;
  form.querySelectorAll('.nc-kind').forEach((b) => { b.onclick = () => { kind = b.dataset.kind; sync(); }; });
  if (mode === 'yearly') $('.nc-goal', form).hidden = true;
  sync();
  const tp = $('.tags[data-name="event_tags"]', form);
  if (tp) ui.wireTagPicker(tp);
  const close = () => $('#newcamp-dialog').close();
  $('#nc-x', form).onclick = close;
  $('#nc-cancel', form).onclick = close;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = mode === 'new' ? fullName() : '';
    if (mode === 'new' && !f('series').value.trim()) { ui.toast(t('seriesRequired'), 'error'); f('series').focus(); return; }
    if (mode !== 'year' && !f('org').value) { ui.toast(t('orgRequired'), 'error'); f('org').focus(); return; }
    if (mode === 'new') {
      const clash = kind === 'yearly'
        ? yearlySeries().some((s) => s.series === name) || allCampaigns().some((c) => c.name === name)
        : allCampaigns().some((c) => c.name === name) || yearlySeries().some((s) => s.series === name);
      if (clash) { ui.toast(t('campaignExists', { name }), 'error'); return; }
    }
    const goal = f('goal').value ? Number(f('goal').value) : '';
    const btn = $('#nc-save', form);
    btn.disabled = true;
    try {
      let go = null;
      if ((mode === 'new' && kind === 'yearly') || mode === 'yearly') {
        const series = mode === 'yearly' ? def.series : name;
        await saveYearly({
          series, org: f('org').value, event_tags: ui.readTags(form, 'event_tags'), note: f('note').value.trim(),
          active: mode === 'yearly' ? f('active').checked : true,
          ...(mode === 'new' ? { order: Math.max(0, ...yearlySeries().map((s) => (s.order < 999 ? s.order : 0))) + 1 } : {}),
        });
        go = () => showSeries(series);
      } else if (mode === 'year') {
        await saveCampaign({ campaign: camp.name, series: camp.series, year: camp.year, kind: 'yearly', goal, note: f('note').value.trim() });
        go = () => showCampaign(camp.name);
      } else {
        const n = mode === 'once' ? camp.name : name;
        await saveCampaign({
          campaign: n, series: mode === 'once' ? camp.series : f('series').value.trim(), year: mode === 'once' ? camp.year : f('year').value,
          kind: 'once', org: f('org').value, event_tags: ui.readTags(form, 'event_tags'), note: f('note').value.trim(), goal,
        });
        go = () => showCampaign(n);
      }
      await loadAll();
      close();
      ui.refreshAll();
      ui.toast(mode === 'new' ? t('campaignCreated', { name }) : t('campaignOrgSaved'));
      go();
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
    } finally { btn.disabled = false; }
  };
  $('#newcamp-dialog').showModal();
  (mode === 'new' ? f('series') : (f('org') || f('goal'))).focus();
}
