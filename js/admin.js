// עמוד אדמין: כל הרשימות של האתר במקום אחד — ארגונים, טעג'ס, אופני תשלום, טיטלען, געגנטן, קרבות, מנהלים.
// הכל נשמר בגליון (לשונית Lists / Settings). רק מנהל רואה את העמוד ויכול לשמור.
import { customFonts, uploadFont, removeFont, loadFonts } from './fonts.js';
import { helperOn, helperWorks, sheetImageCount } from './images.js';
import {
  state, loadAll, migrateImagesToDrive, saveListColumns, saveSettingsColumns, rawListColumn, rawSettingsColumn, orgLogo, hasUploadedLogo, NESHEI_ORG, saveOrgLogo, saveOriginalToDrive, isDatabaseAccount, hasDriveScope, connectDrive,
} from './data.js';
import { t } from './i18n.js';
import { splitTags, escapeHtml as h, shrinkImage } from './util.js';
import {
  saveYearly, saveCampaign, deleteYearly, deleteCampaign, restoreContact, purgeContact, displayName, canManageSharing, pickSheet, sharingPlan, applySharing, allUsers,
} from './data.js';
import { yearlySeries, allCampaigns, curYear } from './campaigns.js';
import { orgSelect } from './donations.js';
import { orgDetailsAdminHtml } from './receipts.js';
import { openListSync, openLivesWithTool, livesWithCandidates } from './listsync.js';
import { requestsAdminHtml, wireRequestsAdmin, pendingRequests } from './requests.js';
import { feedbackAdminHtml, wireFeedbackAdmin, openFeedbackCount } from './feedback.js';
import { treeAdminHtml, wireTreeAdmin } from './tags.js';
import { importBoxHtml, wireImport } from './import.js';

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
    { cols: ['school_org'], label: 'admSchoolOrgs' },
    { cols: ['entity_org'], label: 'admEntities' },
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
    case 'umbrella_org': case 'entity_org': return count(state.donations, (d) => d.org === value) + count(state.campaigns, (c) => c.org === value) + count(state.receipts || [], (r) => r.org === value);
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

// דריי לשוניות: 1 = רשימות און סעטינגס · 2 = מנהלים, גבאים און צוטריט · 3 = בקשות פון די גבאים
let admTab = 'lists';
/** עפנט דעם אדמין אויף א געוויסע לשונית (למשל 'requests'). */
export function setAdminTab(k) { admTab = k; }
const PEOPLE_TAB = new Set(['admPeople']);

export function renderAdmin() {
  const main = $('#admin-main');
  if (!main) return;
  if (!state.isAdmin) { main.innerHTML = `<p class="empty">${h(t('adminOnly'))}</p>`; return; }
  const defs = [];
  const nPend = pendingRequests().length;
  const tabBtn = (key, label) => `<button type="button" data-adm-tab="${key}" class="${admTab === key ? 'on' : ''}">${h(t(label))}${key === 'requests' && nPend ? ` <span class="count-pill">${nPend}</span>` : ''}${key === 'feedback' && openFeedbackCount() ? ` <span class="count-pill">${openFeedbackCount()}</span>` : ''}</button>`;
  if (admTab === 'feedback' && !state.isOwner) admTab = 'lists';
  if (admTab === 'people' && !state.isOwner) admTab = 'lists';
  main.innerHTML = `<h2>${t('adminTitle')}</h2>
    <nav class="adm-tabs">${tabBtn('lists', 'admTabLists')}${state.isOwner ? tabBtn('people', 'admTabPeople') : ''}${tabBtn('tags', 'tgAdmTab')}${tabBtn('requests', 'admTabRequests')}${state.isOwner ? tabBtn('feedback', 'fbAdmTab') : ''}</nav>
    <p class="muted adm-intro" data-tab="lists">${t('adminHint')}</p>`
    + GROUPS.filter((g) => state.isOwner || !PEOPLE_TAB.has(g.title)).map((g) => `<div class="adm-group" data-tab="${PEOPLE_TAB.has(g.title) ? 'people' : 'lists'}" data-g="${g.title}"><h3 class="adm-group-title">${h(t(g.title))}</h3><div class="adm-grid">${
      g.lists.map((def) => { defs.push(def); return cardHtml(def, defs.length - 1); }).join('')}</div></div>`).join('')
    + `<div class="adm-group" id="adm-sharing" data-tab="people"></div>`
    + `<div class="adm-group" id="adm-lock" data-tab="people-lock"></div>`
    + `<div class="adm-group" id="adm-code" data-tab="people"></div>`
    + (state.isOwner ? `<div class="adm-group" id="adm-import" data-tab="people">${importBoxHtml()}</div>` : '')
    + `<div class="adm-group" data-tab="people"><h3 class="adm-group-title">🔄 ${h(t('lsTitle'))}</h3><p class="muted small">${h(t('lsHint'))}</p><button type="button" class="btn" id="adm-lsync">📄 ${h(t('lsOpen'))}</button></div>`
    + `<div class="adm-group" data-tab="people"><h3 class="adm-group-title">🏠 ${h(t('lwtTitle'))}</h3><p class="muted small">${h(t('lwtHint'))}</p><button type="button" class="btn" id="adm-lwt">🏠 ${h(t('lwtOpen', { n: livesWithCandidates().length }))}</button></div>`
    + campaignsAdminHtml()
    + orgDetailsAdminHtml()
    + trashHtml()
    + logosHtml()
    + (state.isOwner ? fontsHtml() : '')
    + requestsAdminHtml()
    + feedbackAdminHtml()
    + treeAdminHtml();
  // לאגאס און קאמפיינען געהערן צו לשונית 1
  $$('.adm-group:not([data-tab])', main).forEach((g) => { g.dataset.tab = 'lists'; });
  const showTab = () => {
    const locked = admTab === 'people' && isPeopleLocked();
    const want = locked ? 'people-lock' : admTab;
    $$('[data-tab]', main).forEach((el) => { el.hidden = el.dataset.tab !== want; });
    if (locked) renderLock(showTab);
    else if (admTab === 'people') renderCodeBox(showTab);
    $$('[data-adm-tab]', main).forEach((b) => b.classList.toggle('on', b.dataset.admTab === admTab));
  };
  showTab();
  $('.adm-tabs', main).onclick = (e) => {
    const b = e.target.closest('[data-adm-tab]');
    if (!b) return;
    admTab = b.dataset.admTab;
    showTab();
  };
  wireLogos(main);
  wireFonts(main);
  wireCampaignsAdmin(main);
  $$('[data-org-details]', main).forEach((b) => { b.onclick = () => ui.openOrgDetails(b.dataset.orgDetails); });
  wireTrash(main);
  wireRequestsAdmin(main, () => renderAdmin());
  wireFeedbackAdmin(main, () => renderAdmin());
  wireTreeAdmin(main, () => renderAdmin());
  $('[data-g="admPeople"]', main)?.after($('#adm-sharing', main));
  if (state.isOwner) renderSharing();
  wireImport($('#adm-import', main), ui);
  $('#adm-lsync', main)?.addEventListener('click', () => openListSync());
  $('#adm-lwt', main)?.addEventListener('click', () => openLivesWithTool());

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
    // מנהלים/גבאים: באלד נאכן אפהיטן — שערן דעם שיט. די הרשאה מוז מען בעטן גלייך פונעם קליק.
    const shareP = def.source === 'settings' && hasDriveScope() ? canManageSharing().catch(() => false) : null;
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
      if (shareP && await shareP) await syncSharing({ auto: true });
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
      btn.disabled = false;
      btn.textContent = t('saveBtn');
    }
  };
}

// ---------- מיסט: אויסגעמעקטע קאנטאקטן ----------
const heName = (c) => [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ') || `#${c.contact_id}`;

function trashHtml() {
  const list = (state.trash || []).slice().sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)));
  return `<div class="adm-group" data-tab="lists"><h3 class="adm-group-title">🗑 ${h(t('trashTitle'))} <span class="muted small">(${list.length})</span></h3>
    <p class="hint-line">${h(t('trashHint'))}</p>
    ${list.length ? `<table class="lapsed-table"><tbody>${list.map((c) => {
      const id = String(c.contact_id);
      const don = state.donations.filter((d) => String(d.contact_id) === id).length;
      return `<tr><td><b>${h(heName(c))}</b> <span class="muted small">#${h(id)}</span></td>
        <td class="muted small">${h(t('trashBy', { by: displayName(c.deleted_by) || '—', at: c.deleted_at }))}</td>
        <td class="muted small">${don ? h(t('trashDon', { n: don })) : ''}</td>
        <td class="adm-btns"><button type="button" class="btn small-btn" data-restore-c="${h(id)}">↺ ${h(t('trashRestore'))}</button>
          <button type="button" class="linkish danger-text" data-purge-c="${h(id)}">${h(t('trashPurge'))}</button></td></tr>`;
    }).join('')}</tbody></table>` : `<p class="muted">${h(t('trashEmpty'))}</p>`}</div>`;
}

function wireTrash(main) {
  const find = (id) => (state.trash || []).find((c) => String(c.contact_id) === id);
  $$('[data-restore-c]', main).forEach((b) => {
    b.onclick = async () => {
      const c = find(b.dataset.restoreC);
      b.disabled = true;
      try { await restoreContact(c); await loadAll(); ui.refreshAll(); renderAdmin(); ui.toast(t('trashRestored', { name: heName(c) })); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); b.disabled = false; }
    };
  });
  $$('[data-purge-c]', main).forEach((b) => {
    b.onclick = async () => {
      const c = find(b.dataset.purgeC);
      const typed = prompt(t('trashPurgeConfirm', { name: heName(c), id: c.contact_id }));
      if (typed === null) return;
      if (String(typed).trim() !== String(c.contact_id)) { ui.toast(t('trashPurgeWrong'), 'error'); return; }
      b.disabled = true;
      try { await purgeContact(c, heName(c)); await loadAll(); ui.refreshAll(); renderAdmin(); ui.toast(t('trashPurged', { name: heName(c) })); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); b.disabled = false; }
    };
  });
}

// ---------- א קאד פאר דער לשונית "מנהלים, גבאים און צוטריט" ----------
// מ'היט נאר אפ א "hash" (נישט דעם קאד אליין). דאס איז א שלאס אין אתר — ווער עס האט צוטריט צום שיט קען
// אלץ טוישן גלייך אין שיט; דער בעל הבית קען אויסמעקן דעם קאד אין Settings ← people_code אויב מ'פארגעסט.
const CODE_COL = 'people_code';
const UNLOCK_KEY = 'khal-people-unlocked';
const savedCode = () => String((state.rawSettings?.[CODE_COL] || [])[0] || '');

async function hashCode(salt, code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${code}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isPeopleLocked() {
  const c = savedCode();
  if (!c) return false;
  try { return sessionStorage.getItem(UNLOCK_KEY) !== c; } catch { return true; }
}

function renderLock(refresh) {
  const box = $('#adm-lock');
  box.innerHTML = `<div class="lock-box"><div class="lock-icon">🔒</div><h3>${h(t('codeLockedTitle'))}</h3>
    <p class="muted">${h(t('codeLockedHint'))}</p>
    <form class="lock-form"><input type="password" autocomplete="off" inputmode="numeric" placeholder="${h(t('codePh'))}" required>
      <button type="submit" class="btn primary">${h(t('codeOpen'))}</button></form>
    <p class="lock-err" hidden>${h(t('codeWrong'))}</p></div>`;
  const input = $('input', box);
  input.focus();
  $('form', box).onsubmit = async (e) => {
    e.preventDefault();
    const [salt, hash] = savedCode().split(':');
    if (await hashCode(salt, input.value) === hash) {
      try { sessionStorage.setItem(UNLOCK_KEY, savedCode()); } catch { /* ignore */ }
      refresh();
    } else {
      $('.lock-err', box).hidden = false;
      input.select();
    }
  };
}

function renderCodeBox(refresh) {
  const box = $('#adm-code');
  const has = Boolean(savedCode());
  box.innerHTML = `${has ? `<div class="code-line"><span>🔒 ${h(t('codeIsSet'))}</span>
      <button type="button" class="btn small-btn" id="code-lock-now">🔒 ${h(t('codeLockNow'))}</button></div>` : ''}
    <details class="code-box"${has ? '' : ' open'}><summary>${h(t(has ? 'codeChangeOrRemove' : 'codeNotSet'))}</summary>
    <p class="hint-line">${h(t('codeHint'))}</p>
    <form class="lock-form">
      <input type="password" name="c1" autocomplete="new-password" placeholder="${h(t(has ? 'codeNewPh' : 'codePh'))}" minlength="4" required>
      <input type="password" name="c2" autocomplete="new-password" placeholder="${h(t('codeAgainPh'))}" minlength="4" required>
      <button type="submit" class="btn small-btn primary">${h(t(has ? 'codeChange' : 'codeSet'))}</button>
    </form>
    ${has ? `<div class="adm-actions"><button type="button" class="linkish" id="code-remove">${h(t('codeRemove'))}</button></div>` : ''}
  </details>`;
  const save = async (value) => {
    await saveSettingsColumns({ [CODE_COL]: [value] });
    await loadAll();
    try { if (value) sessionStorage.setItem(UNLOCK_KEY, value); else sessionStorage.removeItem(UNLOCK_KEY); } catch { /* ignore */ }
    refresh();
  };
  $('form', box).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    if (f.c1.value !== f.c2.value) { ui.toast(t('codeMismatch'), 'error'); return; }
    try {
      const salt = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
      await save(`${salt}:${await hashCode(salt, f.c1.value)}`);
      ui.toast(t('codeSaved'));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  $('#code-lock-now', box)?.addEventListener('click', () => {
    try { sessionStorage.removeItem(UNLOCK_KEY); } catch { /* ignore */ }
    refresh();
  });
  $('#code-remove', box)?.addEventListener('click', async () => {
    if (!confirm(t('codeRemoveConfirm'))) return;
    try { await save(''); ui.toast(t('codeRemoved')); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
}

// ---------- צוטריט צום שיט (לויט די מנהלים + גבאים) ----------
async function renderSharing() {
  const box = $('#adm-sharing');
  if (!box) return;
  const head = `<h3 class="adm-group-title">🔐 ${h(t('shareTitle'))}</h3><p class="hint-line">${h(t('shareHint'))}</p>`;
  // שריט 1: די קליינע דרייב הרשאה · שריט 2: קלייבן דעם שיט אין גוגל'ס פענצטער (איין מאל)
  const connectBtn = (step) => `${head}<p class="drive-warn">${h(t(step === 1 ? 'shareNeedConnect' : 'shareNeedPick'))}
      <button type="button" class="btn small-btn primary" id="share-connect">🔗 ${h(t(step === 1 ? 'shareConnectBtn' : 'sharePickBtn'))}</button></p>`;
  if (!hasDriveScope()) {
    box.innerHTML = connectBtn(1);
    $('#share-connect', box).onclick = () => {
      connectDrive().then(() => renderSharing(), (err) => ui.toast(ui.friendlyError(err), 'error'));
    };
    return;
  }
  box.innerHTML = `${head}<p class="muted">${h(t('loading'))}</p>`;
  let can = false;
  try { can = await canManageSharing(); } catch (err) { box.innerHTML = `${head}<p class="drive-warn">${h(ui.friendlyError(err))}</p>`; return; }
  if (!can) {
    box.innerHTML = connectBtn(2);
    $('#share-connect', box).onclick = () => {
      pickSheet().then((ok) => { if (ok) renderSharing(); }, () => ui.toast(t('sharePickFail'), 'error'));
    };
    return;
  }
  box.innerHTML = `${head}<p class="muted">${h(t('loading'))}</p>`;
  let plan;
  try { plan = await sharingPlan(); } catch (err) {
    box.innerHTML = `${head}<p class="drive-warn">${h(err.status === 403 || err.status === 404 ? t('shareNoRight') : ui.friendlyError(err))}</p>`;
    return;
  }
  const users = allUsers();
  const ok = new Set(plan.ok.map((u) => u.email));
  box.innerHTML = `${head}
    <table class="adm-table share-table"><tbody>
      ${users.map((u) => `<tr><td><b>${h(u.name)}</b></td><td dir="ltr">${h(u.email)}</td>
        <td class="muted small">${h(t(u.role === 'admin' ? 'shareRoleAdmin' : 'shareRoleGabbai'))}${u.email === plan.owner ? ` · ${h(t('shareOwner'))}` : ''}</td>
        <td>${ok.has(u.email) ? `<span class="share-ok">✓ ${h(t('shareHas'))}</span>` : `<span class="share-no">⏳ ${h(t('shareNot'))}</span>`}</td></tr>`).join('')}
      ${plan.remove.map((p) => `<tr class="share-extra"><td>—</td><td dir="ltr">${h(p.email)}</td><td class="muted small">${h(t('shareNotListed'))}</td>
        <td><span class="share-no">⚠ ${h(t('shareWillRemove'))}</span></td></tr>`).join('')}
    </tbody></table>
    <div class="adm-actions"><span class="spacer"></span>
      ${plan.add.length || plan.remove.length ? `<button type="button" class="btn small-btn primary" id="share-sync">🔄 ${h(t('shareSyncBtn', { add: plan.add.length, remove: plan.remove.length }))}</button>`
        : `<span class="share-ok">✓ ${h(t('shareAllGood'))}</span>`}
    </div>`;
  $('#share-sync', box)?.addEventListener('click', () => syncSharing({ plan }));
}

async function syncSharing({ plan = null, auto = false } = {}) {
  try {
    const p = plan || await sharingPlan();
    if (!p.add.length && !p.remove.length) { if (!auto) ui.toast(t('shareAllGood')); renderSharing(); return; }
    let remove = true;
    if (p.remove.length) {
      remove = confirm(t('shareConfirmRemove', { list: p.remove.map((x) => x.email).join('\n') }));
    }
    if (!p.add.length && !remove) { renderSharing(); return; }
    await applySharing(p, { remove });
    ui.toast(t('shareDone', { n: p.add.length + (remove ? p.remove.length : 0) }));
  } catch (err) {
    ui.toast(err.status === 403 || err.status === 404 ? t('shareNoRight') : ui.friendlyError(err), 'error');
  }
  renderSharing();
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
    <td class="adm-goods"><input data-col="gdesc" value="${h(c.goods_desc || '')}" placeholder="${h(t('goodsDescPh'))}" title="${h(t('goodsHint'))}">
      <input data-col="gval" type="number" min="0" step="0.01" dir="ltr" value="${h(c.goods_value || '')}" placeholder="$" title="${h(t('goodsValue'))}"></td>
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

/** די "תמורה" פון א קאמפיין (למשל א סעודה ביים דינער) — פאר די קבלות */
function goodsOfCamp(name) {
  const r = state.campaigns.find((c) => c.campaign === name);
  return { goods_desc: r?.goods_desc || '', goods_value: r?.goods_value || '' };
}
function campaignsAdminHtml() {
  const now = curYear();
  const camps = allCampaigns();
  const yearly = yearlySeries().map((s) => ({
    name: s.series, org: s.org, active: s.active,
    goal: camps.find((c) => c.name === `${s.series} ${now}`)?.goal || '',
    ...goodsOfCamp(`${s.series} ${now}`),
  }));
  const once = camps.filter((c) => c.kind === 'once').map((c) => ({ ...c, ...goodsOfCamp(c.name) }));
  const head = (kind) => `<thead><tr><th>${h(t('seriesName'))}</th><th>${h(t('forOrg'))}</th>
    <th>${h(kind === 'yearly' ? t('admCampGoalYear', { year: now }) : t('goal'))}</th><th title="${h(t('goodsHint'))}">${h(t('goodsCol'))}</th>${kind === 'yearly' ? '<th></th>' : ''}<th></th><th></th></tr></thead>`;
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
        goods_desc: $('[data-col=gdesc]', tr).value.trim(), goods_value: $('[data-col=gval]', tr).value ? Number($('[data-col=gval]', tr).value) : '',
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
            const g0 = goodsOfCamp(yname);
            if (r.tr.dataset.dirty && (String(r.goal || '') !== String(had?.goal || '') || r.goods_desc !== g0.goods_desc || String(r.goods_value) !== String(g0.goods_value))) {
              await saveCampaign({ campaign: yname, series: r.name, year: now, kind: 'yearly', goal: r.goal, goods_desc: r.goods_desc, goods_value: r.goods_value });
            }
          } else if (r.tr.dataset.dirty) {
            const had = existing.get(r.name);
            await saveCampaign({ campaign: r.name, series: had?.series || r.name, year: had?.year || '', kind: 'once', org: r.org, goal: r.goal, goods_desc: r.goods_desc, goods_value: r.goods_value });
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
  const nImg = state.isOwner && helperOn() ? sheetImageCount(state) : -1;
  const migBox = nImg < 0 ? '' : `<div class="img-mig"><b>${h(t('imgMigTitle'))}</b> <span class="muted small">${h(t('imgMigHint'))}</span><br>
      ${nImg ? `<span>${h(t('imgMigCount', { n: nImg }))}</span> <button type="button" class="btn small-btn primary" id="btn-img-mig">${h(t('imgMigBtn'))}</button> <span class="muted small" id="img-mig-status"></span>`
    : `<span class="drive-ok">${h(t('imgMigNone'))}</span>`}</div>`;
  return `<div class="adm-group"><h3 class="adm-group-title">${t('admLogos')}</h3>
    <p class="hint-line">${t('admLogosHint')}</p>
    ${driveLine}${migBox}
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
  $('#btn-img-mig', main)?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    const st = $('#img-mig-status', main);
    b.disabled = true;
    try {
      const n = await migrateImagesToDrive((k) => { st.textContent = t('imgMigRunning', { n: k }); });
      if (!n && helperWorks() === false) { ui.toast(t('imgMigFail'), 'error'); b.disabled = false; return; }
      await loadAll();
      ui.refreshAll();
      renderAdmin();
      ui.toast(t('imgMigDone', { n }));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); b.disabled = false; }
  });
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

// ---------- שריפטן (נאר דער בעל הבית) ----------
function fontsHtml() {
  const list = customFonts();
  return `<div class="adm-group" id="adm-fonts"><h3 class="adm-group-title">${h(t('admFonts'))}</h3>
    <p class="hint-line">${h(t('admFontsHint'))}</p>
    <div class="font-up">
      <label>${h(t('admFontName'))}<input id="font-name" placeholder="${h(t('admFontNamePh'))}"></label>
      <label class="btn primary">⬆ ${h(t('admFontUpload'))}<input type="file" id="font-file" accept=".ttf,.otf,.woff,.woff2" hidden></label>
      <span class="muted small" id="font-status"></span>
    </div>
    ${list.length ? `<div class="font-list">${list.map((f) => `<div class="font-card">
      <div class="font-sample" style="font-family:'${h(f.name.replace(/'/g, ''))}'">${h(t('admFontSample'))}</div>
      <div class="font-meta"><b>${h(f.name)}</b> <span class="muted small">${h(f.format)} · ${h(f.updatedAt)}</span>
        <button type="button" class="linkish" data-font-del="${h(f.name)}">${h(t('admLogoRemove'))}</button></div></div>`).join('')}</div>`
      : `<p class="muted">${h(t('admFontsNone'))}</p>`}
  </div>`;
}

function wireFonts(main) {
  const inp = $('#font-file', main);
  if (!inp) return;
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    const st = $('#font-status', main);
    st.textContent = t('admFontUploading');
    try {
      const name = await uploadFont(file, $('#font-name', main).value);
      await loadFonts();
      renderAdmin();
      ui.toast(t('admFontSaved', { name }));
    } catch (err) {
      st.textContent = '';
      ui.toast(err.message === 'bad-font' ? t('admFontBad') : err.message === 'font-too-big' ? t('admFontBig') : ui.friendlyError(err), 'error');
    }
    inp.value = '';
  };
  $$('[data-font-del]', main).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(t('admFontConfirm', { name: b.dataset.fontDel }))) return;
      try { await removeFont(b.dataset.fontDel); await loadFonts(); renderAdmin(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
}

/** האם יש בעמוד שינויים שלא נשמרו. */
export function adminDirty() {
  return $$('#admin-main .adm-card.dirty').length > 0;
}
