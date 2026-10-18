// עמוד אדמין: כל הרשימות של האתר במקום אחד — ארגונים, טעג'ס, אופני תשלום, טיטלען, געגנטן, קרבות, מנהלים.
// הכל נשמר בגליון (לשונית Lists / Settings). רק מנהל רואה את העמוד ויכול לשמור.
import {
  state, loadAll, saveListColumns, saveSettingsColumns, rawListColumn, rawSettingsColumn, orgLogo, hasUploadedLogo, NESHEI_ORG, saveOrgLogo, saveOriginalToDrive, isDatabaseAccount, hasDriveScope, connectDrive,
} from './data.js';
import { t } from './i18n.js';
import { splitTags, escapeHtml as h, shrinkImage } from './util.js';
import { saveYearly, saveCampaign, deleteYearly, deleteCampaign } from './data.js';
import { yearlySeries, allCampaigns, curYear } from './campaigns.js';
import { orgSelect } from './donations.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * כל רשימה: cols = העמודות בגליון (הראשונה היא הערך; השאר מתאימות לה שורה-שורה),
 * locked = ערכים שהתוכנה משתמשת בהם בשמם — אי אפשר למחוק או לשנות.
 */
const GROUPS = [
  { title: 'admOrgs', lists: [
    { cols: ['umbrella_org'], label: 'admUmbrella' },
    { cols: ['beis_medrash'], label: 'orgBeisMedrash' },
    { cols: ['kollel'], label: 'orgKollel' },
    { cols: ['organization'], label: 'orgOrganization' },
  ] },
  { title: 'admTags', lists: [
    { cols: ['community_tag'], label: 'admCommunityTags' },
    { cols: ['phone_tag'], label: 'admPhoneTags' },
    { cols: ['email_tag'], label: 'admEmailTags' },
  ] },
  { title: 'admDonations', lists: [
    { cols: ['event_tag'], label: 'eventLegend', locked: ['קאווע'] },
    { cols: ['payment_method'], label: 'paymentMethod', locked: ['צ\'ק', 'כרטיס אשראי', 'אחר'] },
    { cols: ['dedication_type'], label: 'dedicationType' },
  ] },
  { title: 'admContacts', lists: [
    { cols: ['title_he', 'title_he_default_en'], label: 'admTitleHe', sub: ['admTitleEnFor'] },
    { cols: ['title_en', 'title_en_default_he'], label: 'admTitleEn', sub: ['admTitleHeFor'] },
    { cols: ['marital_status'], label: 'marital', locked: ['נשוי', 'בחור', 'גרוש', 'אלמן'] },
    { cols: ['area', 'area_zips', 'area_keywords'], label: 'area', sub: ['admZips', 'admKeywords'] },
  ] },
  { title: 'admPeople', lists: [
    { cols: ['admin_email', 'admin_name', 'note'], label: 'admAdmins', sub: ['admName', 'admNote'], source: 'settings', emails: true, hint: 'admAdminsHint' },
    { cols: ['gabbai_name', 'gabbai_email', 'gabbai_phone'], label: 'admGabbaim', sub: ['colEmail', 'colMobile'], source: 'settings', hint: 'admGabbaimHint' },
  ] },
  { title: 'admFamily', lists: [
    { cols: ['relation_type', 'relation_reverse'], label: 'admRelations', sub: ['admReverse'] },
    { cols: ['occasion_type'], label: 'admOccasionTypes', locked: ['יארצייט'] },
    { cols: ['occasion_relation'], label: 'occRelation', locked: ['ער אליין', 'ווייב'] },
  ] },
];

export function initAdmin(helpers) {
  ui = helpers;
}

/** כמה פעמים ערך בשימוש (כדי להזהיר לפני מחיקה). */
function usage(col, value) {
  const count = (arr, fn) => arr.filter(fn).length;
  const inTags = (v) => splitTags(v).includes(value);
  switch (col) {
    case 'umbrella_org': return count(state.donations, (d) => d.org === value) + count(state.campaigns, (c) => c.org === value);
    case 'beis_medrash': case 'kollel': case 'organization':
      return count(state.contacts, (c) => inTags(c[col])) + count(state.donations, (d) => d.org === value)
        + count(state.campaigns, (c) => c.org === value);
    case 'community_tag': return count(state.contacts, (c) => inTags(c.community_tags));
    case 'phone_tag': case 'email_tag':
      return [...state.phones.values()].filter((p) => Object.entries(p).some(([k, v]) => k.endsWith('_tags') && inTags(v))).length;
    case 'event_tag': return count(state.donations, (d) => inTags(d.event_tags));
    case 'payment_method': return count(state.donations, (d) => d.payment_method === value);
    case 'dedication_type': return count(state.donations, (d) => d.dedication_type === value);
    case 'title_he': return count(state.contacts, (c) => c.title_he === value);
    case 'title_en': return count(state.contacts, (c) => c.title_en === value);
    case 'marital_status': return count(state.contacts, (c) => c.marital_status === value);
    case 'area': return count(state.contacts, (c) => c.area === value);
    case 'relation_type': return count(state.relations, (r) => r.relation_type === value);
    case 'occasion_type': return count(state.occasions, (o) => o.occasion_type === value);
    case 'occasion_relation': return count(state.occasions, (o) => o.relation === value);
    default: return 0;
  }
}

function rowsOf(def) {
  const cols = def.cols.map((c) => (def.source === 'settings' ? rawSettingsColumn(c) : rawListColumn(c)));
  const n = Math.max(0, ...cols.map((c) => c.length));
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const r = def.cols.map((_, j) => String(cols[j][i] ?? ''));
    if (r[0].trim()) rows.push(r);
  }
  return rows;
}

function rowHtml(def, r) {
  const locked = (def.locked || []).includes(r[0]) || (def.emails && r[0].toLowerCase() === state.email);
  const used = r[0] ? usage(def.cols[0], r[0]) : 0;
  return `<tr data-orig="${h(r[0])}">
    ${def.cols.map((c, j) => `<td><input data-col="${h(c)}" value="${h(r[j] || '')}" ${j === 0 && locked ? 'readonly title="' + h(t('admLocked')) + '"' : ''}
      ${j > 0 ? `placeholder="${h(t(def.sub[j - 1]))}"` : ''} dir="${/email|phone|zips|_en$/.test(c) ? 'ltr' : 'auto'}"></td>`).join('')}
    <td class="adm-used">${def.emails && locked ? h(t('admYou')) : used ? h(t('admUsed', { n: used })) : ''}${locked ? ' 🔒' : ''}</td>
    <td class="adm-btns">
      <button type="button" class="linkish adm-up" title="↑">↑</button>
      <button type="button" class="linkish adm-down" title="↓">↓</button>
      ${locked ? '' : `<button type="button" class="linkish adm-del" title="${h(t('deleteBtn'))}">✕</button>`}
    </td>
  </tr>`;
}

function cardHtml(def, key) {
  return `<section class="adm-card${def.cols.length > 1 ? ' adm-wide' : ''}" data-key="${key}">
    <h3>${h(t(def.label))} <span class="muted small">(${rowsOf(def).length})</span></h3>
    ${def.hint ? `<p class="hint-line">${h(t(def.hint))}</p>` : def.sub ? `<p class="hint-line">${def.sub.map((s) => h(t(s))).join(' · ')}</p>` : ''}
    <table class="adm-table"><tbody>${rowsOf(def).map((r) => rowHtml(def, r)).join('')}</tbody></table>
    <div class="adm-actions">
      <button type="button" class="btn small-btn adm-add">${t('admAdd')}</button>
      <span class="spacer"></span>
      <button type="button" class="btn small-btn primary adm-save" hidden>${t('saveBtn')}</button>
    </div>
  </section>`;
}

export function renderAdmin() {
  const main = $('#admin-main');
  if (!main) return;
  if (!state.isAdmin) { main.innerHTML = `<p class="empty">${h(t('adminOnly'))}</p>`; return; }
  const defs = [];
  main.innerHTML = `<h2>${t('adminTitle')}</h2><p class="muted">${t('adminHint')}</p>`
    + GROUPS.map((g) => `<div class="adm-group"><h3 class="adm-group-title">${h(t(g.title))}</h3><div class="adm-grid">${
      g.lists.map((def) => { defs.push(def); return cardHtml(def, defs.length - 1); }).join('')}</div></div>`).join('')
    + campaignsAdminHtml()
    + logosHtml();
  wireLogos(main);
  wireCampaignsAdmin(main);

  $$('.adm-card[data-key]', main).forEach((card) => wireCard(card, defs[Number(card.dataset.key)]));
}

function wireCard(card, def) {
  const body = $('tbody', card);
  const dirty = () => { $('.adm-save', card).hidden = false; card.classList.add('dirty'); };
  card.addEventListener('input', dirty);
  card.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (e.target.closest('.adm-up') && tr.previousElementSibling) { tr.parentNode.insertBefore(tr, tr.previousElementSibling); dirty(); }
    if (e.target.closest('.adm-down') && tr.nextElementSibling) { tr.parentNode.insertBefore(tr.nextElementSibling, tr); dirty(); }
    if (e.target.closest('.adm-del')) {
      const used = usage(def.cols[0], tr.dataset.orig);
      if (used && !confirm(t('admDeleteUsed', { name: tr.dataset.orig, n: used }))) return;
      tr.remove();
      dirty();
    }
  });
  $('.adm-add', card).onclick = () => {
    body.insertAdjacentHTML('beforeend', rowHtml(def, def.cols.map(() => '')));
    $$('tr', body).at(-1).querySelector('input').focus();
    dirty();
  };
  $('.adm-save', card).onclick = async () => {
    const rows = $$('tr', body).map((tr) => $$('input', tr).map((i) => i.value.trim())).filter((r) => r[0]);
    const firsts = rows.map((r) => r[0]);
    const dup = firsts.find((v, i) => firsts.indexOf(v) !== i);
    if (dup) { ui.toast(t('admDuplicate', { name: dup }), 'error'); return; }
    const renamed = !def.source && $$('tr', body).some((tr) => tr.dataset.orig && $('input', tr).value.trim() !== tr.dataset.orig);
    if (renamed && !confirm(t('admRenameWarn'))) return;
    const btn = $('.adm-save', card);
    btn.disabled = true;
    btn.textContent = t('saving');
    try {
      if (def.emails) {
        rows.forEach((r) => { r[0] = r[0].toLowerCase(); });
        if (!rows.some((r) => r[0] === state.email)) rows.unshift([state.email, '', '']); // אי אפשר להוריד את עצמך
      }
      const columns = {};
      def.cols.forEach((c, j) => { columns[c] = rows.map((r) => r[j] || ''); });
      if (def.source === 'settings') await saveSettingsColumns(columns);
      else await saveListColumns(columns);
      await loadAll();
      ui.refreshAll();
      renderAdmin();
      ui.toast(t('saved'));
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
      btn.disabled = false;
      btn.textContent = t('saveBtn');
    }
  };
}

// ---------- קאמפיינען: יערליכע און איינמאליגע — פאר וועמען, ציל, צולייגן ----------
function campRowHtml(kind, c = {}) {
  const isNew = !c.name;
  const used = c.name ? (kind === 'yearly'
    ? state.donations.filter((d) => String(d.campaign || '').startsWith(`${c.name} `)).length
    : state.donations.filter((d) => d.campaign === c.name).length) : 0;
  return `<tr data-orig="${h(c.name || '')}" data-used="${used}">
    <td><input data-col="name" value="${h(c.name || '')}" ${isNew ? `placeholder="${h(t(kind === 'yearly' ? 'yearlyNamePh' : 'seriesPh'))}"` : `readonly title="${h(t('admCampRenameSoon'))}"`}></td>
    <td>${orgSelect('org', c.org || '', 'data-col="org"')}</td>
    <td><input data-col="goal" type="number" min="0" step="1" dir="ltr" value="${h(c.goal || '')}" placeholder="$"></td>
    ${kind === 'yearly'
      ? `<td class="adm-check"><label class="check"><input type="checkbox" data-col="active"${c.active === false ? '' : ' checked'}> ${h(t('admCampActive'))}</label></td>`
      : ''}
    <td class="adm-used">${used ? h(t('admUsed', { n: used })) : ''}</td>
    <td class="adm-btns">
      ${kind === 'yearly' ? `<button type="button" class="linkish adm-up" title="↑">↑</button><button type="button" class="linkish adm-down" title="↓">↓</button>` : ''}
      ${used ? '' : `<button type="button" class="linkish adm-del" title="${h(t('deleteBtn'))}">✕</button>`}
    </td>
  </tr>`;
}

function campaignsAdminHtml() {
  const now = curYear();
  const camps = allCampaigns();
  const yearly = yearlySeries().map((s) => ({
    name: s.series, org: s.org, active: s.active,
    goal: camps.find((c) => c.name === `${s.series} ${now}`)?.goal || '',
  }));
  const once = camps.filter((c) => c.kind === 'once');
  const head = (kind) => `<thead><tr><th>${h(t('seriesName'))}</th><th>${h(t('forOrg'))}</th>
    <th>${h(kind === 'yearly' ? t('admCampGoalYear', { year: now }) : t('goal'))}</th>${kind === 'yearly' ? '<th></th>' : ''}<th></th><th></th></tr></thead>`;
  const card = (kind, rows) => `<section class="adm-card adm-wide adm-camps" data-kind="${kind}">
      <h3>${h(t(kind === 'yearly' ? 'yearlyCamps' : 'onceCamps'))} <span class="muted small">(${rows.length})</span></h3>
      <p class="hint-line">${h(t(kind === 'yearly' ? 'admCampYearlyHint' : 'admCampOnceHint'))}</p>
      <table class="adm-table">${head(kind)}<tbody>${rows.map((c) => campRowHtml(kind, c)).join('')}</tbody></table>
      <div class="adm-actions">
        <button type="button" class="btn small-btn adm-add">${t('admAdd')}</button>
        <span class="spacer"></span>
        <button type="button" class="btn small-btn primary adm-save" hidden>${t('saveBtn')}</button>
      </div>
    </section>`;
  return `<div class="adm-group"><h3 class="adm-group-title">${h(t('admCampaigns'))}</h3>
    <div class="adm-grid">${card('yearly', yearly)}${card('once', once)}</div></div>`;
}

function wireCampaignsAdmin(main) {
  $$('.adm-camps', main).forEach((card) => {
    const kind = card.dataset.kind;
    const body = $('tbody', card);
    const dirty = (tr) => { $('.adm-save', card).hidden = false; card.classList.add('dirty'); if (tr) tr.dataset.dirty = '1'; };
    const deleted = [];
    card.addEventListener('input', (e) => dirty(e.target.closest('tr')));
    card.addEventListener('change', (e) => dirty(e.target.closest('tr')));
    card.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (e.target.closest('.adm-up') && tr.previousElementSibling) { tr.parentNode.insertBefore(tr, tr.previousElementSibling); dirty(); card.dataset.reordered = '1'; }
      if (e.target.closest('.adm-down') && tr.nextElementSibling) { tr.parentNode.insertBefore(tr.nextElementSibling, tr); dirty(); card.dataset.reordered = '1'; }
      if (e.target.closest('.adm-del')) {
        if (tr.dataset.orig) deleted.push(tr.dataset.orig);
        tr.remove();
        dirty();
      }
    });
    $('.adm-add', card).onclick = () => {
      body.insertAdjacentHTML('beforeend', campRowHtml(kind));
      const tr = $$('tr', body).at(-1);
      tr.dataset.dirty = '1';
      $('input', tr).focus();
      dirty();
    };
    $('.adm-save', card).onclick = async () => {
      const now = curYear();
      const rows = $$('tr', body).map((tr, i) => ({
        tr, i, orig: tr.dataset.orig, name: $('[data-col=name]', tr).value.trim(), org: $('[data-col=org]', tr).value,
        goal: $('[data-col=goal]', tr).value ? Number($('[data-col=goal]', tr).value) : '',
        active: kind === 'yearly' ? $('[data-col=active]', tr).checked : null,
      })).filter((r) => r.name);
      const names = rows.map((r) => r.name);
      const dup = names.find((v, i) => names.indexOf(v) !== i);
      if (dup) { ui.toast(t('admDuplicate', { name: dup }), 'error'); return; }
      const clash = rows.find((r) => !r.orig && (yearlySeries().some((s) => s.series === r.name) || allCampaigns().some((c) => c.name === r.name)));
      if (clash) { ui.toast(t('campaignExists', { name: clash.name }), 'error'); return; }
      const noOrg = rows.find((r) => !r.orig && !r.org);
      if (noOrg) { ui.toast(t('orgRequired'), 'error'); $('[data-col=org]', noOrg.tr).focus(); return; }
      const btn = $('.adm-save', card);
      btn.disabled = true;
      btn.textContent = t('saving');
      try {
        for (const name of deleted) {
          if (kind === 'yearly') await deleteYearly(name);
          else await deleteCampaign(name);
        }
        const existing = new Map(allCampaigns().map((c) => [c.name, c]));
        for (const r of rows) {
          if (!r.tr.dataset.dirty && !card.dataset.reordered) continue;
          if (kind === 'yearly') {
            await saveYearly({ series: r.name, org: r.org, active: r.active, order: r.i + 1 });
            const yname = `${r.name} ${now}`;
            const had = existing.get(yname);
            if (r.tr.dataset.dirty && String(r.goal || '') !== String(had?.goal || '')) {
              await saveCampaign({ campaign: yname, series: r.name, year: now, kind: 'yearly', goal: r.goal });
            }
          } else if (r.tr.dataset.dirty) {
            const had = existing.get(r.name);
            await saveCampaign({ campaign: r.name, series: had?.series || r.name, year: had?.year || '', kind: 'once', org: r.org, goal: r.goal });
          }
        }
        await loadAll();
        ui.refreshAll();
        renderAdmin();
        ui.toast(t('saved'));
      } catch (err) {
        ui.toast(ui.friendlyError(err), 'error');
        btn.disabled = false;
        btn.textContent = t('saveBtn');
      }
    };
  });
}

// ---------- לאגאס פון די ארגונים ----------
function logoOrgs() {
  const umbrella = rawListColumn('umbrella_org').filter(Boolean);
  return [
    ...umbrella.map((v) => [v, t('umbrellaGroup')]),
    [NESHEI_ORG, t('nesheiKind')],
    ...['beis_medrash', 'kollel', 'organization'].flatMap((col) => rawListColumn(col).filter(Boolean)
      .map((v) => [v, t({ beis_medrash: 'orgBeisMedrash', kollel: 'orgKollel', organization: 'orgOrganization' }[col])])),
  ];
}

function logosHtml() {
  const driveLine = isDatabaseAccount()
    ? (hasDriveScope() ? `<p class="drive-ok">✓ ${t('driveConnected')}</p>`
      : `<p class="drive-warn">${t('driveNeedConnect')} <button type="button" class="btn small-btn primary" id="btn-connect-drive">🔗 ${t('driveConnectBtn')}</button></p>`)
    : `<p class="drive-warn">${h(t('driveNotDatabase', { email: state.email }))}</p>`;
  return `<div class="adm-group"><h3 class="adm-group-title">${t('admLogos')}</h3>
    <p class="hint-line">${t('admLogosHint')}</p>
    ${driveLine}
    <div class="logo-grid">${logoOrgs().map(([name, kind]) => {
      const src = orgLogo(name);
      return `<div class="logo-card" data-org="${h(name)}">
        <div class="logo-box">${src ? `<img src="${src}" alt="">` : '<span class="muted small">—</span>'}</div>
        <b>${h(name)}</b><span class="muted small">${h(kind)}</span>
        <label class="btn small-btn">${src ? t('admLogoChange') : t('admLogoUpload')}<input type="file" accept="image/*" hidden></label>
        ${hasUploadedLogo(name) ? `<button type="button" class="linkish" data-logo-del>${t('admLogoRemove')}</button>` : ''}
      </div>`;
    }).join('')}</div></div>`;
}

function wireLogos(main) {
  $('#btn-connect-drive', main)?.addEventListener('click', () => {
    // גלייך פון דעם קליק — כדי דער בראוזער זאל נישט בלאקירן דעם פענצטער פון גוגל
    connectDrive().then(() => { ui.toast(t('driveConnected')); renderAdmin(); })
      .catch((err) => ui.toast(ui.friendlyError(err), 'error'));
  });
  $$('.logo-card', main).forEach((card) => {
    const org = card.dataset.org;
    $('input[type=file]', card).onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await shrinkImage(file, 320);
        let driveId = '';
        try {
          driveId = await saveOriginalToDrive(file, 'Logos', org);
        } catch (err) { ui.toast(t('driveFailed', { err: ui.friendlyError(err) }), 'error'); }
        await saveOrgLogo(org, data, driveId);
        await loadAll();
        ui.refreshAll();
        renderAdmin();
        ui.toast(t('admLogoSaved', { name: org }));
      } catch (err) {
        ui.toast(err.message === 'too-big' ? t('mmImageTooBig') : err.message === 'bad-image' ? t('mmImageBad') : ui.friendlyError(err), 'error');
      }
    };
    $('[data-logo-del]', card)?.addEventListener('click', async () => {
      if (!confirm(t('admLogoConfirm', { name: org }))) return;
      try {
        await saveOrgLogo(org, '');
        await loadAll();
        ui.refreshAll();
        renderAdmin();
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    });
  });
}

/** האם יש בעמוד שינויים שלא נשמרו. */
export function adminDirty() {
  return $$('#admin-main .adm-card.dirty').length > 0;
}
