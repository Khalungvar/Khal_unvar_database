// מסך אנשי הקשר: התחברות, חיפוש, כרטיס אישי, הוספה ועריכה.
import {
  initAuth, requestToken, signOut, getUserEmail, hasSavedSession, setSilent, setOnExpire, rememberEmail, hasSheetsScope,
} from './google.js';
import {
  state, loadAll, displayName, trashContact, orgLogo, NESHEI_ORG, getHistory, getPhoto, savePhoto, saveOriginalToDrive, saveContact, saveKvitel, saveOrgNote, deleteOrgNote, MAX_ORG_NOTES, addListValue, addRelation, removeRelation,
} from './data.js';
import { suggest, details, placesEnabled, placesError } from './places.js';
import {
  t, setLang, getLang, applyStatic, maritalLabel, relationLabel,
} from './i18n.js';
import { suggestFirstName, suggestLastName } from './names.js';
import {
  initDonations, fillDonationFilters, renderDonations, donationsSection, wireDonationsSection, openDonationForm,
} from './donations.js';
import {
  initOccasions, fillOccasionFilters, renderOccasions, occasionsSection, wireOccasionsSection, occasionCount,
  openOccasionForm, YAHRZEIT,
} from './occasions.js';
import {
  initCampaigns, renderCampaignSide, renderCampaignMain, showCampaign, renderDonHub,
} from './campaigns.js';
import { initReceipts, renderReceipts, openReceipts, printForDonation, openOrgDetails } from './receipts.js';
import { initLists, renderListsSide, renderBuilder, openOverview, exportContacts } from './lists.js';
import { initAdmin, renderAdmin, adminDirty, setAdminTab } from './admin.js';
import { initMailMerge, renderMailMerge, openMailMerge } from './mailmerge.js';
import { initMail, openCompose, emailOf } from './mail.js';
import { initRequests, submitRequest, pendingRequests } from './requests.js';
import { openHelp, initHelpChat } from './help.js';
import { initMerge, openMerge } from './merge.js';
import { loadFonts } from './fonts.js';
import { initFeedback, openFeedbackCount } from './feedback.js';
import { strictMember, tagsOf as tagEntries } from './tags.js';
import { initTags, cardTagsHtml, wireCardTags, rowChipsHtml, roleMarks, GROUPS as TAG_GROUPS, tagsEditorHtml, wireTagsEditor, readTagsEditor, applyMaritalRule, nesheiFromTags, hasUnchecked, markChecked, hasRealTags, roots as tagRoots, childrenOf as tagChildren, nameOf as tagName, pathKey as tagKey, matchesTagSel, STATUSES as TAG_ST, UNCHECKED as TAG_U } from './tags.js';
import { initSimchos, openSimchos, renderSimchos } from './simchos.js';
import { initSchool, renderSchool, openSchool, isSchool, schoolCount, schoolSection, wireSchoolSection, afterRelation } from './school.js';
import { orgTagsPaneHtml, orgTagsFormHtml, wireOrgTagsForm, readOrgTagsForm, orgTagsCount, parseOrgTags, splitEntry, entry } from './orgtags.js';
import {
  initPersonal, renderPersonal, openPersonal, unreadCount, tasksDueCount, openTaskForContact, generalOpenCount, openGeneralTodo, addGeneralTask,
} from './personal.js';
import {
  nextOccurrence, daysBetween, todayIso, monthKeyFromHe,
} from './hebdate.js';
import {
  getScope, setScope, restoreScope, withFormer, setWithFormer, contactInScope, donationInScope, umbrellaName,
  memberOrgs, isFormerOf, NO_AREA,
} from './scope.js';
import {
  normalize, digits, formatPhone, isTrue, isAlive, splitTags, joinTags,
  gematriaCodes, primaryCode, parseCodeQuery, mailingName, detectArea, escapeHtml as h, shrinkImage,
} from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PHONE_KEYS = ['mobile', 'home_phone', 'wife_mobile', 'other_phone'];
const EMAIL_KEYS = ['email_1', 'email_2'];
const KOLLEL = 'כולל';
// [שדה, תווית בשפת הממשק] — מחושב בכל פעם, כדי שהתווית תתאים לשפה הנוכחית
const phoneFields = () => PHONE_KEYS.map((k) => [k, t(k)]);
const emailFields = () => EMAIL_KEYS.map((k) => [k, t(k)]);

// ---------- הודעות ----------
let toastTimer;
function toast(message, kind = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 8000 : 3500);
}

function friendlyError(err) {
  if (err.status === 403 || err.status === 404) {
    return t('noAccess');
  }
  return t('error', { msg: err.message });
}

/** חלון בחירה עם כמה כפתורים. מחזיר את הערך שנבחר, או null. */
function choose(title, text, options, boldFirst = '') {
  const dlg = $('#choice-dialog');
  $('#choice-title', dlg).textContent = title;
  $('#choice-text', dlg).innerHTML = (boldFirst ? `<b>${h(boldFirst)}</b>\n\n` : '') + h(text);
  const box = $('#choice-buttons', dlg);
  box.innerHTML = '';
  return new Promise((resolve) => {
    options.forEach(([value, label, primary]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = primary ? 'btn primary' : 'btn';
      b.textContent = label;
      b.onclick = () => { dlg.close(); resolve(value); };
      box.append(b);
    });
    dlg.onclose = () => resolve(null);
    dlg.showModal();
  });
}

// ---------- התחברות ----------
async function enterApp() {
  state.email = await getUserEmail();
  rememberEmail(state.email);
  await loadAll();
  if (!state.isAllowed) {
    const err = new Error('not-registered');
    err.code = 'not-registered';
    throw err;
  }
  restoreScope();
  loadFonts().catch(() => {}); // די ארויפגעלייגטע שריפטן — אין הינטערגרונט
  $('#login-msg').hidden = true;

  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  initHelpChat();
  initFeedback({ toast, friendlyError, refreshBadges: updateBadges });
  initTags({ toast, friendlyError });
  refreshAll();
  showView('lobby');
}

/** וויפיל נישט-געלייענטע מעסעדזשעס — אויפן קנעפל אויבן און אין לאבי. */
function updateBadges() {
  const n = unreadCount() + tasksDueCount();
  const b = $('#pm-badge');
  b.hidden = !n;
  b.textContent = n;
  const tileB = $('[data-tile="personal"] .count-pill');
  if (tileB) { tileB.hidden = !n; tileB.textContent = n; }
  // בקשות פון די גבאים וואס ווארטן אויף א מנהל
  const ab = $('#adm-badge');
  const r = state.isAdmin ? pendingRequests().length + openFeedbackCount() : 0;
  if (ab) { ab.hidden = !r; ab.textContent = r; }
  const gc = $('#gtd-count'); const g = generalOpenCount();
  if (gc) { gc.hidden = !g; gc.textContent = g; }
}

// ---------- לובי: דער ערשטער בלאט נאכן אריינגיין ----------
let lobbyOpen = ''; // וועלכער ארגון-סארט איז אויפגעמאכט (צו קלייבן א ביהמ"ד וכו')

function renderLobby() {
  const main = $('#lobby-main');
  if (!main) return;
  const tile = (key, icon, title, sub = '', extra = '') => `<button type="button" class="lobby-tile${lobbyOpen === key ? ' open' : ''}" data-tile="${key}" ${extra}>
      <span class="lobby-icon">${icon}</span><b>${h(title)}</b>${sub ? `<span class="muted small">${h(sub)}</span>` : ''}</button>`;
  const alive = state.contacts.filter((c) => isAlive(c.is_alive) && (isTrue(c.is_active) || c.is_active === '')).length;
  const typeTile = ([type, label], icon) => tile(type, icon, t(label === 'orgBeisMedrash' ? 'lobbyBatei' : label),
    t('lobbyOrgSub', { n: (state.lists[type] || []).length, p: currentCount(type, '') }));
  const open = ORG_FIELDS.find(([n]) => n === lobbyOpen);
  const areas = state.lists.area || [];
  const areaCount = (a) => state.contacts.filter((c) => (a === NO_AREA ? !String(c.area || '').trim() : c.area === a)
    && isAlive(c.is_alive) && (isTrue(c.is_active) || c.is_active === '')).length;
  main.innerHTML = `
    <div class="lobby-top">
      <div class="lobby-main-col">
        <div class="lobby-head"><img src="img/logo.png" alt="" class="lobby-logo"><h1>${h(t('appName'))}</h1>
          <p class="muted">${h(t('lobbyHello', { email: displayName(state.email) }))}</p></div>
        <div class="lobby-search">
          <input type="search" id="lobby-q" placeholder="${h(t('lobbySearchPh'))}" autocomplete="off">
          <div class="lobby-results" id="lobby-results"></div>
        </div>
      </div>
      <div class="lobby-side-col">
        <button type="button" class="lobby-tile lobby-me" data-tile="personal">
          <span class="lobby-avatar">${h(initials(displayName(state.email)))}</span>
          <b>${h(displayName(state.email))}</b>
          <span class="muted small">${h(unreadCount() || tasksDueCount() ? t('pmUnreadSub2', { n: unreadCount(), m: tasksDueCount() }) : t('lobbyPersonal'))}</span>
        </button>
        <button type="button" class="lobby-quick" data-quick="contact">＋ ${h(t('quickContact'))}</button>
        <button type="button" class="lobby-quick" data-quick="donation">＋ ${h(t('quickDonation'))}</button>
        <button type="button" class="lobby-quick" data-quick="occasion">＋ ${h(t('quickOccasion'))}</button>
        <button type="button" class="lobby-quick lobby-gtd" data-quick="gtodo">☑ ${h(t('gtdName'))} <span class="count-pill" id="gtd-count"${generalOpenCount() ? '' : ' hidden'}>${generalOpenCount()}</span></button>
      </div>
    </div>
    <div class="lobby-row">
      ${tile('umbrella', orgLogo(umbrellaName()) ? `<img class="tile-logo" src="${orgLogo(umbrellaName())}" alt="">` : '🏛', umbrellaName(), t('lobbyAllSub', { n: alive }), 'data-primary')}
      ${typeTile(ORG_FIELDS[0], '🕍')}
      ${typeTile(ORG_FIELDS[1], '📖')}
      ${typeTile(ORG_FIELDS[2], '🤝')}
    </div>
    ${open ? `<div class="lobby-choose">
      <span class="muted">${h(t('lobbyChoose'))}</span>
      <button type="button" class="btn" data-scope-type="${open[0]}" data-scope-value="">${h(t('lobbyAllOf', { name: t(open[1] === 'orgBeisMedrash' ? 'lobbyBatei' : open[1]) }))}</button>
      ${(state.lists[open[0]] || []).map((v) => `<button type="button" class="btn primary lobby-pick" data-scope-type="${open[0]}" data-scope-value="${h(v)}">${orgLogo(v) ? `<img src="${orgLogo(v)}" alt="">` : ''}${h(v)}
        <span class="count-pill">${currentCount(open[0], v)}</span></button>`).join('')}
    </div>` : ''}
    <div class="lobby-row lobby-row4">
      ${tile('area', '📍', t('area'), t('lobbyAreaSub', { n: areas.length }))}
      ${tile('donations', '💰', t('lobbyDonations'), t('lobbyDonationsSub', { n: state.donations.length }))}
      ${tile('occasions', '🕯', t('lobbyOccasions'), t('lobbyOccasionsSub', { n: upcomingWeek() }))}
      ${tile('simchos', '🍷', t('lobbySimchos'), t('lobbySimchosSub'))}
    </div>
    ${lobbyOpen === 'area' ? `<div class="lobby-choose">
      <span class="muted">${h(t('lobbyChoose'))}</span>
      ${areas.map((a) => `<button type="button" class="btn primary" data-area="${h(a)}">${h(a)} <span class="count-pill">${areaCount(a)}</span></button>`).join('')}
      <button type="button" class="btn" data-area="${NO_AREA}">${h(t('noArea'))} <span class="count-pill">${areaCount(NO_AREA)}</span></button>
    </div>` : ''}
    <div class="lobby-row">
      ${tile('lists', '📋', t('readyLists'), t('lobbyListsSub', { n: state.savedLists.length }))}
      ${tile('mailmerge', '✉', 'Mail Merge', t('lobbyMailSub'))}
      ${tile('calls', '📞', 'Calls & SMS', t('lobbyCallsSub'))}
      ${tile('receipts', '🧾', 'Invoice & Receipt', t('lobbyReceiptsSub'))}
    </div>`;
}

/** וויפיל מאורעות זענען די קומענדיגע וואך (פאר דעם לאבי). */
function upcomingWeek() {
  return state.occasions.filter((o) => {
    const next = nextOccurrence(Number(o.hebrew_day), monthKeyFromHe(o.hebrew_month), monthKeyFromHe(o.adar_in_leap));
    return next && daysBetween(todayIso(), next) <= 7;
  }).length;
}

/** זוכן אין לאבי: פון אלע מענטשן (נאמען, טעלעפאן, אימעיל, קאד) — און עפענען דעם כרטיס גלייך. */
function lobbySearch() {
  const q = $('#lobby-q').value;
  const box = $('#lobby-results');
  if (!q.trim()) { box.innerHTML = ''; box.hidden = true; return; }
  const found = state.contacts.filter((c) => matches(c, q))
    .sort((a, b) => String(a.last_name_he).localeCompare(String(b.last_name_he), 'he')).slice(0, 12);
  box.hidden = false;
  box.innerHTML = found.length ? found.map((c) => `<button type="button" class="lobby-hit" data-open-card="${h(c.contact_id)}">
      <b>${h(fullNameHe(c))}</b>
      <span class="muted small">${h([c.area || c.city, [c.first_name_en, c.last_name_en].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</span>
      ${!isAlive(c.is_alive) ? `<span class="badge muted">${t('deceased')}</span>` : ''}</button>`).join('')
    : `<p class="muted small lobby-none">${h(t('noResults'))}</p>`;
}

/** ראשי תיבות פאר דעם קרייז (למשל "יק"). */
function initials(name) {
  const parts = String(name || '').replace(/["'״׳]/g, '').split(/[\s@.]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

function lobbyClick(e) {
  const quick = e.target.closest('[data-quick]');
  if (quick) {
    // שנעלע אקציעס פון לאבי — מען בלייבט אינעם לאבי
    if (quick.dataset.quick === 'contact') openForm();
    if (quick.dataset.quick === 'donation') openDonationForm();
    if (quick.dataset.quick === 'occasion') openOccasionForm();
    if (quick.dataset.quick === 'gtodo') openGeneralTodo();
    return;
  }
  const hit = e.target.closest('[data-open-card]');
  if (hit) { openCard(hit.dataset.openCard); return; }
  const pick = e.target.closest('[data-scope-type]');
  $('#area-filter').value = ''; // יעדע בחירה אין לאבי הייבט אן פון ניי
  if (pick) {
    lobbyOpen = '';
    enterScope({ type: pick.dataset.scopeType, value: pick.dataset.scopeValue });
    // א ישיבה מיט אן אייגענעם בלאט (תלמידים, שכר לימוד)
    if (isSchool(pick.dataset.scopeValue)) { document.body.classList.add('solo-mode'); openSchool(pick.dataset.scopeValue); return; }
    showView('contacts');
    return;
  }
  const area = e.target.closest('[data-area]');
  if (area) {
    // געגנט: פון כלל מוסדות (אלע רעקארדס), מיט דעם פילטער אויף דעם געגנט
    lobbyOpen = '';
    enterScope({ type: 'area', value: area.dataset.area });
    showView('contacts');
    return;
  }
  const b = e.target.closest('[data-tile]');
  if (!b) return;
  const key = b.dataset.tile;
  if (key === 'area') { lobbyOpen = lobbyOpen === 'area' ? '' : 'area'; renderLobby(); return; }
  if (key === 'umbrella') { lobbyOpen = ''; enterScope(null); showView('contacts'); return; }
  if (ORG_FIELDS.some(([n]) => n === key)) { lobbyOpen = lobbyOpen === key ? '' : key; renderLobby(); return; }
  if (key === 'lists') { openOverview(); return; }
  if (key === 'simchos') { enterScope(null); document.body.classList.add('solo-mode'); openSimchos(); return; }
  if (key === 'mailmerge') { openMailMerge(); return; }
  if (key === 'personal') { document.body.classList.add('solo-mode'); openPersonal(); return; }
  if (key === 'receipts') { enterScope(null); document.body.classList.add('solo-mode'); openReceipts(); return; }
  // נדבות / לוח המאורעות: א באזונדערער בלאט פון אלע רעקארדס — אן די לשוניות
  if (key === 'donations' || key === 'occasions') {
    enterScope(null);
    document.body.classList.add('solo-mode');
    showView(key === 'donations' ? 'donhub' : key);
    return;
  }
  showSoon(key);
}

function showSoon(key) {
  const titles = { simchos: t('lobbySimchos'), mailmerge: 'Mail Merge', calls: 'Calls & SMS', personal: t('lobbyPersonal'), receipts: 'Invoice & Receipt' };
  $('#soon-main').innerHTML = `<div class="soon-box"><h2>${h(titles[key] || '')}</h2>
    <p class="muted">${h(t('soonText'))}</p>
    <button type="button" class="btn" id="soon-back">← ${h(t('lobbyBack'))}</button></div>`;
  $('#soon-back').onclick = () => showView('lobby');
  showView('soon');
}

/** מרענן את כל המסכים אחרי טעינה או שמירה. */
function refreshAll() {
  fillFilters();
  renderList();
  fillDonationFilters();
  renderDonations();
  fillOccasionFilters();
  renderOccasions();
  renderOrgs();
  renderCampaignSide();
  $('#btn-admin').hidden = !state.isAdmin;
  updateBadges();
  if (!$('.view[data-view="personal"]').hidden) renderPersonal();
  $('#user-email').textContent = displayName(state.email) + (state.isAdmin ? ` · ${t('admin')}` : '');
  $('#user-email').title = state.email;
  renderListsSide();
  if (!$('.view[data-view="lists"]').hidden) renderBuilder();
  if (!$('.view[data-view="campaign"]').hidden) renderCampaignMain();
  if (!$('.view[data-view="donhub"]').hidden) renderDonHub();
  if (!$('.view[data-view="receipts"]').hidden) renderReceipts();
  if (!$('.view[data-view="school"]').hidden) renderSchool();
  if (!$('.view[data-view="simchos"]').hidden) renderSimchos();
  if ($('#card-dialog').open && currentCardId) openCard(currentCardId);
}

function showView(name) {
  document.body.classList.toggle('lobby-mode', name === 'lobby');
  if (name === 'lobby') document.body.classList.remove('solo-mode');
  const leavingAdmin = !$('.view[data-view="admin"]').hidden && name !== 'admin';
  if (leavingAdmin && adminDirty() && !confirm(t('discardChanges'))) return;
  document.body.classList.remove('menu-open');
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  if (name === 'donations') { fillDonationFilters(); renderDonations(); }
  if (name === 'occasions') { fillOccasionFilters(); renderOccasions(); }
  if (name === 'campaign') renderCampaignMain();
  if (name === 'donhub') renderDonHub();
  if (name === 'receipts') renderReceipts();
  if (name === 'admin') renderAdmin();
  if (name === 'lobby') renderLobby();
  if (name === 'mailmerge') renderMailMerge();
  if (name === 'personal') renderPersonal();
  if (name === 'lists') renderBuilder();
  if (name === 'school') renderSchool();
  if (name === 'simchos') renderSimchos();
  renderListsSide();
  $('#btn-admin')?.classList.toggle('on', name === 'admin');
  renderCampaignSide();
  recordNav(name);
}

// ---------- "צוריק" אין בראוזער: צום פריערדיגן מסך אינעם אתר (נישט ארויס פונעם אתר) ----------
let navFromPop = false;
let navState = null;
const sameScope = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
function recordNav(name) {
  if (navFromPop) return;
  const st = { v: name, sc: getScope() || null, solo: document.body.classList.contains('solo-mode') };
  if (!navState) history.replaceState(st, '');
  else if (navState.v === st.v && sameScope(navState.sc, st.sc)) history.replaceState(st, '');
  else history.pushState(st, '');
  navState = st;
}
window.addEventListener('popstate', (e) => {
  if ($('#app-view').hidden) return;
  // א פענצטער איז אפן (כרטיס, טופס): "צוריק" מאכט עס צו און מ'בלייבט אויפן זעלבן מסך
  const open = $$('dialog[open]');
  if (open.length) { open[open.length - 1].close(); if (navState) history.pushState(navState, ''); return; }
  const st = e.state;
  if (!st || !st.v) return;
  navFromPop = true;
  try {
    if (!sameScope(getScope(), st.sc)) { setScope(st.sc); refreshAll(); }
    document.body.classList.toggle('solo-mode', !!st.solo);
    showView(st.v);
    if (st.solo) document.body.classList.add('solo-mode');
  } finally { navFromPop = false; }
  navState = st;
});

/** א קלארע מעלדונג אויפן לאגאין בלאט: נישט רעגיסטרירט / נישט קיין צוטריט צום שיט. */
function showLoginProblem(err) {
  const box = $('#login-msg');
  const who = state.email || '';
  let text;
  if (err.code === 'not-registered') text = t('notRegistered', { email: who });
  else if ((err.status === 403 || err.status === 404) && !hasSheetsScope()) text = t('scopeMissing');
  else if (err.status === 403 || err.status === 404) text = t('noAccessLogin', { email: who });
  else text = friendlyError(err);
  box.textContent = text;
  box.hidden = false;
}

async function signIn() {
  const btn = $('#btn-login');
  btn.disabled = true;
  try {
    await requestToken('select_account');
    await enterApp();
  } catch (err) {
    showLoginProblem(err);
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  signOut();
  state.email = '';
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
}

async function refresh() {
  try {
    await loadAll();
    refreshAll();
    toast(t('refreshed'));
  } catch (err) {
    toast(friendlyError(err), 'error');
  }
}

// ---------- רשימה וחיפוש ----------
function fullNameHe(c) {
  return [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ');
}

function phonesOf(c) {
  return state.phones.get(String(c.contact_id)) || {};
}

function haystack(c) {
  const p = phonesOf(c);
  const text = [
    c.first_name_he, c.last_name_he, c.first_name_en, c.last_name_en, c.legal_first_name,
    c.wife_name_he, c.wife_name_en, c.city, c.address, c.contact_id,
    p.email_1, p.email_2,
  ].map(normalize).join(' ');
  const phoneDigits = phoneFields().map(([k]) => digits(p[k])).join(' ');
  return `${text} ${phoneDigits}`;
}

function matches(c, query) {
  if (!query.trim()) return true;
  const code = parseCodeQuery(query);
  if (code) {
    return gematriaCodes(c.first_name_he, c.last_name_he)
      .some(([last, first]) => last === code[0] && first === code[1]);
  }
  const hay = haystack(c);
  return normalize(query).split(' ').every((token) => {
    const d = digits(token);
    return hay.includes(token) || (d.length >= 3 && d === token && hay.includes(d));
  });
}

function fillFilters() {
  const sel = $('#tag-filter');
  const current = sel.value;
  sel.innerHTML = `<option value="">${h(t('allTags'))}</option>`
    + (state.lists.community_tag || []).map((tag) => `<option>${h(tag)}</option>`).join('');
  sel.value = current;
  const areaSel = $('#area-filter');
  const currentArea = areaSel.value;
  areaSel.innerHTML = `<option value="">${h(t('allAreas'))}</option>`
    + (state.lists.area || []).map((a) => `<option>${h(a)}</option>`).join('');
  areaSel.value = currentArea;
  const orgSel = $('#org-filter');
  const currentOrg = orgSel.value;
  orgSel.innerHTML = `<option value="">${h(t('allOrgs'))}</option>`
    + ORG_FIELDS.map(([name, label]) => {
      const values = [...new Set([...(state.lists[name] || []), ...state.contacts.flatMap((c) => splitTags(c[name]))])];
      return values.length ? `<optgroup label="${h(t(label))}">${values.map((v) => `<option value="${h(`${name}|${v}`)}">${h(v)}</option>`).join('')}</optgroup>` : '';
    }).join('');
  orgSel.value = currentOrg;
  $('#org-former-wrap').hidden = true;
}

// ---------- תפריט צד: ארגונים = "הקשר" (כל האתר מציג רק מה ששייך לארגון שנבחר) ----------
function orgPages() {
  return ORG_FIELDS.map(([name, label]) => {
    const values = [...new Set([...(state.lists[name] || []), ...state.contacts.flatMap((c) => splitTags(c[name]))])];
    return { name, label, values };
  });
}

/** כמה שייכים עכשיו (לא יוצאים) לערך — או לכל הסוג אם value ריק. */
function currentCount(name, value) {
  // ספירת חברים: נאר פעיל מאוד / פעיל לפעמים (לא נבדק — נישט)
  return state.contacts.filter((c) => {
    const st = strictMember(c, name, value);
    if (st !== null) return st;
    const mine = memberOrgs(c, name);
    if (value) return mine.includes(value) && !isFormerOf(c, name, value);
    return mine.some((v) => !isFormerOf(c, name, v));
  }).length;
}

function renderOrgs() {
  const side = $('#org-side');
  if (!side) return;
  const sc = getScope();
  const isOn = (type, value) => sc && sc.type === type && sc.value === value;
  side.innerHTML = orgPages().map((p) => `<div class="org-group">
    <button type="button" class="org-link org-top${isOn(p.name, '') ? ' on' : ''}" data-type="${h(p.name)}" data-value="">
      <span>${h(t(p.label))}</span><span class="count-pill">${currentCount(p.name, '')}</span></button>
    ${p.values.map((v) => `<button type="button" class="org-link org-sub${isOn(p.name, v) ? ' on' : ''}" data-type="${h(p.name)}" data-value="${h(v)}">
        <span>${orgLogo(v) ? `<img class="mini-logo" src="${orgLogo(v)}" alt="">` : ''}${h(v)}</span><span class="count-pill">${currentCount(p.name, v)}</span></button>`).join('')}
  </div>`).join('');
  $('#btn-home').classList.toggle('on', !sc);
  $('#home-name').innerHTML = `${orgLogo(umbrellaName()) ? `<img class="mini-logo" src="${orgLogo(umbrellaName())}" alt="">` : ''}${h(umbrellaName())}`;
  $('#home-count').textContent = state.contacts.filter((c) => isAlive(c.is_alive) && (isTrue(c.is_active) || c.is_active === '')).length;
  $('#scope-exit').textContent = t('scopeExitTo', { home: umbrellaName() });
  // פס למעלה: באיזה הקשר נמצאים
  const bar = $('#scope-bar');
  bar.hidden = !sc;
  if (sc) {
    const label = scopeLabel(sc);
    const lg = sc.value && sc.type !== 'area' ? orgLogo(sc.value) : '';
    $('#scope-logo').hidden = !lg;
    if (lg) $('#scope-logo').src = lg;
    $('#scope-former').closest('label').hidden = sc.type === 'area';
    $('#scope-name').textContent = label;
    $('#scope-former').checked = withFormer();
  }
  const scb = $('#scope-school');
  if (scb) {
    scb.hidden = !(sc && sc.value && isSchool(sc.value));
    scb.onclick = () => { document.body.classList.add('solo-mode'); openSchool(sc.value); };
  }
}

/** נכנסים לארגון (או יוצאים ממנו עם null) — וכל המסכים מתעדכנים. */
/** דער נאמען פונעם הקשר: "ביהמ"ד מאנסי", "בתי מדרשים", "געגנט: מאנסי". */
function scopeLabel(sc) {
  if (!sc) return '';
  if (sc.type === 'area') return sc.value === NO_AREA ? t('noArea') : `${t('area')}: ${sc.value}`;
  if (sc.value) return sc.value;
  const f = ORG_FIELDS.find(([n]) => n === sc.type);
  return f ? t(f[1]) : '';
}

function enterScope(scope) {
  document.body.classList.remove('solo-mode');
  setScope(scope);
  if (!$('.view[data-view="campaign"]').hidden) showView('donations');
  document.body.classList.remove('menu-open');
  refreshAll();
}

/** פילטער לויט ביהמ"ד / כולל / ארגון; יוצאים רק אם סימנו "מיט יוצאים". */
function matchesOrg(c) {
  const v = $('#org-filter').value;
  if (!v) return true;
  const [name, value] = v.split('|');
  if (!memberOrgs(c, name).includes(value)) return false;
  if (!isFormerOf(c, name, value)) return true;
  return $('#org-former').checked || !isTrue(c[`${name}_former`]);
}

// ---------- חיפוש לויט עץ התגיות: שלב 1 → 2 → 3 → 4, און א מצב ----------
const tf = { path: [], st: '' };
const TF_ST = () => [['', t('tfAllStatus')], ...TAG_ST, [TAG_U, `⚠ ${t('tgUnchecked')}`]];
const tfStatuses = () => (tf.st === '' ? null : tf.st === 'active' ? ['a'] : [tf.st]);
function tfMatch(c, path = tf.path) {
  const st = tfStatuses();
  if (!path.length && !st) return true;
  return tagEntries(c).some((x) => (!st || st.includes(x.s)) && path.every((id, i) => String(x.p[i]) === String(id)));
}
function renderTagFilter() {
  const row = $('#tf-row');
  if (!row) return;
  if (!tagRoots().length) { row.innerHTML = ''; return; }
  const base = state.contacts.filter((c) => contactInScope(c));
  const count = (p) => base.filter((c) => tfMatch(c, p)).length;
  const levels = [];
  let opts = tagRoots().map((r) => ({ id: r.id, name: r.name, group: r.group }));
  for (let i = 0; i < 4 && opts.length; i += 1) {
    const sel = tf.path[i];
    const prefix = tf.path.slice(0, i);
    const optHtml = (list) => list.map((o) => { const n = count([...prefix, o.id]); return n || String(o.id) === String(sel) ? `<option value="${h(o.id)}"${String(o.id) === String(sel) ? ' selected' : ''}>${h(o.name)} (${n})</option>` : ''; }).join('');
    // שלב 1: לויט די 3 גרופעס (און אלטע רשימה באזונדער)
    const body = i === 0
      ? [...TAG_GROUPS, 'old'].map((g) => { const xs = opts.filter((o) => o.group === g); return xs.length ? `<optgroup label="${h(g === 'old' ? t('tgGroupOld') : t(`tgG${g}`))}">${optHtml(xs)}</optgroup>` : ''; }).join('')
      : optHtml(opts);
    levels.push(`<select data-tf="${i}" aria-label="${h(t('tfLevel', { n: i + 1 }))}"><option value="">${h(i === 0 ? `🏷 ${t('tgAll')}` : t('tfAny'))}</option>${body}</select>`);
    if (!sel) break;
    opts = tagChildren([...prefix, sel]);
  }
  row.innerHTML = levels.join('<span class="tf-sep">›</span>')
    + `<select data-tfst aria-label="${h(t('tgStatuses'))}">${TF_ST().map(([k, l]) => `<option value="${h(k)}"${tf.st === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`
    + (tf.path.length || tf.st ? `<button type="button" class="linkish" data-tfx>✕</button>` : '');
}
function wireTagFilter() {
  const row = $('#tf-row');
  if (!row) return;
  row.addEventListener('change', (e) => {
    const lv = e.target.dataset.tf;
    if (lv !== undefined) { const i = Number(lv); tf.path = tf.path.slice(0, i); if (e.target.value) tf.path.push(e.target.value); }
    if (e.target.matches('[data-tfst]')) tf.st = e.target.value;
    renderList();
  });
  row.addEventListener('click', (e) => { if (e.target.closest('[data-tfx]')) { tf.path = []; tf.st = ''; renderList(); } });
}

/** פילטער לויט עץ התגיות (אדער "⚠ לא נבדק") */
function matchesTreeFilter(c) {
  const v = $('#tt-filter')?.value;
  if (!v) return true;
  if (v === '__u') return hasUnchecked(c);
  return matchesTagSel(c, { keys: [v], st: [...TAG_ST.map(([k]) => k), TAG_U] });
}
function fillTreeFilter() {
  const sel = $('#tt-filter');
  if (!sel) return;
  const cur = sel.value;
  const opts = [];
  const walk = (path, depth) => {
    opts.push(`<option value="${h(tagKey(path))}">${'\u00a0\u00a0'.repeat(depth)}${h(tagName(path[path.length - 1]))}</option>`);
    if (depth < 2) tagChildren(path).forEach((k) => walk([...path, k.id], depth + 1));
  };
  tagRoots().forEach((r) => walk([r.id], 0));
  const nU = state.contacts.filter(hasUnchecked).length;
  sel.innerHTML = `<option value="">🏷 ${h(t('tgAll'))}</option>${nU ? `<option value="__u">⚠ ${h(t('tgUnchecked'))} (${nU})</option>` : ''}${opts.join('')}`;
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : '';
  sel.hidden = !tagRoots().length;
}

/** די צווייטע שורה: תגיות פנימיות ("ארגון: טעג") — נאר די וואס זענען דא ביי די אנשים לויט דעם ערשטן פילטער */
function matchesOrgTag(c) {
  const v = $('#otag-filter')?.value;
  if (!v) return true;
  const [org, tag] = splitEntry(v);
  return (parseOrgTags(c.org_tags).get(org) || []).includes(tag);
}
function fillOrgTagFilter() {
  const sel = $('#otag-filter');
  if (!sel) return;
  const tag = $('#tag-filter').value;
  const base = state.contacts.filter((c) => contactInScope(c) && (!tag || splitTags(c.community_tags).includes(tag)));
  const groups = new Map(); // ארגון → Map(טעג → צאל)
  base.forEach((c) => parseOrgTags(c.org_tags).forEach((tags, org) => {
    if (!groups.has(org)) groups.set(org, new Map());
    tags.forEach((x) => groups.get(org).set(x, (groups.get(org).get(x) || 0) + 1));
  }));
  const cur = sel.value;
  const sorted = [...groups].sort((a, b) => a[0].localeCompare(b[0], 'he'));
  sel.innerHTML = `<option value="">${h(t('allOrgTags'))}</option>` + sorted.map(([org, m]) => `<optgroup label="${h(org)}">${
    [...m].sort((a, b) => a[0].localeCompare(b[0], 'he')).map(([x, n]) => `<option value="${h(entry(org, x))}">${h(x)} (${n})</option>`).join('')}</optgroup>`).join('');
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : '';
  sel.hidden = !groups.size;
}

function visibleContacts() {
  const query = $('#search').value;
  const tag = $('#tag-filter').value;
  const area = $('#area-filter').value;
  const showInactive = $('#show-inactive').checked;
  return state.contacts
    .filter((c) => contactInScope(c))
    .filter((c) => showInactive || isTrue(c.is_active) || c.is_active === '')
    .filter((c) => !tag || splitTags(c.community_tags).includes(tag))
    .filter(matchesOrgTag)
    .filter((c) => tfMatch(c))
    .filter((c) => !area || c.area === area)
    .filter(matchesOrg)
    .filter((c) => matches(c, query))
    .sort((a, b) => String(a.last_name_he).localeCompare(String(b.last_name_he), 'he')
      || String(a.first_name_he).localeCompare(String(b.first_name_he), 'he'));
}

/** contact_id → [טאטע'ס] (פון "זון פון" אדער "טאטע פון") — צו ווייזן אונטערן נאמען אין דער רשימה */
let fatherMap = new Map();
let inLawMap = new Map();
function buildFatherMap() {
  const mk = (fwd, rev) => {
    const m = new Map();
    const add = (young, old) => { const l = m.get(young) || []; if (!l.includes(old)) l.push(old); m.set(young, l); };
    (state.relations || []).forEach((r) => {
      if (r.relation_type === fwd) add(String(r.contact_id_a), String(r.contact_id_b));
      if (r.relation_type === rev) add(String(r.contact_id_b), String(r.contact_id_a));
    });
    return m;
  };
  fatherMap = mk('זון פון', 'טאטע פון');
  inLawMap = mk('איידעם פון', 'שווער פון');
}
/** אונטערן נאמען: דער טאטע; אויב נישטא — דער שווער */
function fatherLine(c) {
  const id = String(c.contact_id);
  const names = (m) => (m.get(id) || []).map((x) => state.contacts.find((k) => String(k.contact_id) === x)).filter(Boolean)
    .map((d) => fullNameHe(d)).join(' / ');
  const dad = names(fatherMap);
  if (dad) return `<span class="row-father">${h(t('sonOfLine', { name: dad }))}</span>`;
  const sw = names(inLawMap);
  return sw ? `<span class="row-father">${h(t('sonInLawLine', { name: sw }))}</span>` : '';
}

function renderList() {
  buildFatherMap();
  fillOrgTagFilter();
  renderTagFilter();
  const list = visibleContacts();
  const sc = getScope();
  $('#count').textContent = t('count', { n: list.length }) + (sc ? ` · ${scopeLabel(sc)}` : '');
  const body = $('#list');
  if (!list.length) {
    body.innerHTML = `<p class="empty">${h(state.contacts.length ? t('noResults') : t('emptyDb'))}</p>`;
    return;
  }
  body.innerHTML = list.map(contactRow).join('');
}

/** שורה של איש קשר ברשימה. */
/** וועלכע נעמען פעלן (עברית / ענגליש) */
function missingNames(c) {
  const no = (k) => !String(c[k] ?? '').trim();
  return [['first_name_he', 'missFirstHe'], ['last_name_he', 'missLastHe'], ['first_name_en', 'missFirstEn'], ['last_name_en', 'missLastEn']].filter(([k]) => no(k)).map(([, l]) => t(l));
}

function contactRow(c) {
  const badges = [
    !isAlive(c.is_alive) ? `<span class="badge muted">${t('deceased')}</span>` : '',
    c.is_active === false || c.is_active === 'FALSE' ? `<span class="badge muted">${t('inactive')}</span>` : '',
    hasUnchecked(c) ? `<span class="badge tg-u-badge" title="${h(t('tgUncheckedTip'))}">⚠ ${t('tgUnchecked')}</span>` : '',
    missingNames(c).length ? `<span class="badge tg-u-badge miss-badge">⚠ ${h(t('missLabel'))}: ${h(missingNames(c).join(' · '))}</span>` : '',
    ...(hasRealTags(c) ? [] : orgLabels(c).map((o) => orgChip(o, 'badge org'))),
  ].join('');
  const roles = hasRealTags(c) ? roleMarks(c) : [];
  const tags = hasRealTags(c) ? rowChipsHtml(c) : splitTags(c.community_tags).map((tag) => `<span class="chip">${h(tag)}</span>`).join('');
  const en = [c.first_name_en, c.last_name_en].filter(Boolean).join(' ');
  return `
    <button type="button" class="row" data-id="${h(c.contact_id)}">
      <span class="row-main">
        <span class="row-name">${h(fullNameHe(c))}${roles.length ? `<span class="row-roles"> · ${h(roles.join(' · '))}</span>` : ''} ${badges}</span>
        ${fatherLine(c)}
        <span class="row-en" dir="ltr">${en ? unverifiedWrap(c, ['first_name_en', 'last_name_en'], h(en)) : `<em>${t('noEnName')}</em>`}</span>
      </span>
      <span class="row-city">${c.area ? unverifiedWrap(c, ['area'], h(c.area)) : h(c.city)}</span>
      <span class="row-tags">${tags}</span>
    </button>`;
}

// ---------- כרטיס אישי ----------
/** אם אחד השדות מולא אוטומטית ועוד לא אושר — מציג באפור. */
function unverifiedWrap(c, fields, html) {
  const pending = splitTags(c.unverified_fields);
  return fields.some((f) => pending.includes(f))
    ? `<span class="unverified" title="${h(t('suggestedTip'))}">${html}</span>` : html;
}

function tagChips(value) {
  return splitTags(value).map((tag) => `<span class="chip">${h(tag)}</span>`).join('');
}

let currentCardId = null;
let cardTab = 'details'; // הלשונית הפתוחה בכרטיס

/** 📬 שיקן אין כרטיס — א קליק טוישט און שפייכלערט */
function wireCardTagBox(c) {
  const box = $('#card-body .tg-card');
  if (!box) return;
  wireCardTags(box, c, () => {
    box.outerHTML = cardTagsHtml(c);
    wireCardTagBox(c);
    renderList();
  });
}

function openCard(id, tab = null) {
  const c = state.contacts.find((x) => String(x.contact_id) === String(id));
  if (!c) return;
  const p = phonesOf(c);
  const mail = mailingName(c);
  const field = (label, value, ltr = false) => (String(value ?? '').trim()
    ? `<div class="kv"><span>${label}</span><span${ltr ? ' dir="ltr"' : ''}>${value}</span></div>` : '');

  const phones = phoneFields().map(([k, label]) => (p[k]
    ? `<div class="kv"><span>${label}</span><span><a dir="ltr" href="tel:${h(digits(p[k]))}">${h(p[k])}</a> ${tagChips(p[`${k}_tags`])}</span></div>` : '')).join('');
  const emails = emailFields().map(([k, label]) => (p[k]
    ? `<div class="kv"><span>${label}</span><span><a dir="ltr" href="mailto:${h(p[k])}">${h(p[k])}</a> ${tagChips(p[`${k}_tags`])}</span></div>` : '')).join('');

  const address = [c.address, [c.city, c.state, c.zip].filter(Boolean).join(', '),
    c.country && c.country !== 'USA' ? c.country : ''].filter(Boolean).map(h).join('<br>');

  const wife = [c.wife_name_he, c.wife_name_en].some((v) => String(v).trim())
    ? `${h(c.wife_name_he)}${c.wife_name_en ? ` · <span dir="ltr">${unverifiedWrap(c, ['wife_name_en'], h(c.wife_name_en))}</span>` : ''}`
      + `${isTrue(c.wife_is_rebbetzin) ? ' · Rebbetzin' : ''}${!isAlive(c.wife_is_alive) ? ` · ${t('deceasedF')}` : ''}`
      + `${isTrue(c.wife_in_neshei) ? ` · ${t('nesheiFull')}` : ''}`
    : '';

  $('#card-body').innerHTML = `
    <div class="card-head">
      <label class="card-photo" title="${h(t('photoTip'))}">
        <span class="photo-ph">📷<small>${h(t('photoAdd'))}</small></span>
        <img alt="" hidden>
        <input type="file" accept="image/*" capture="environment" hidden>
      </label>
      <div class="card-head-text">
        <h2 dir="auto">${h(fullNameHe(c))}</h2>
        <p class="sub">#${h(c.contact_id)} · ${t('code')} ${h(primaryCode(c.first_name_he, c.last_name_he))}${!isAlive(c.is_alive) ? ` · ${t('deceased')}` : ''}</p>
        <button type="button" class="linkish photo-del" hidden>${h(t('photoRemove'))}</button>
      </div>
    </div>
    <nav class="card-tabs" role="tablist">
      <button type="button" data-tab="details">${t('cardTabDetails')}</button>
      <button type="button" data-tab="family">${t('cardTabFamily')}${familyCount(c) + occasionCount(c) ? ` <span class="count-pill">${familyCount(c) + occasionCount(c)}</span>` : ''}</button>
      <button type="button" data-tab="money">${t('cardTabMoney')}${donationCount(c) ? ` <span class="count-pill">${donationCount(c)}</span>` : ''}</button>
      <button type="button" data-tab="org">${t('cardTabOrg')}${orgNotesOf(c).length ? ` <span class="count-pill">${orgNotesOf(c).length}</span>` : ''}</button>
      <button type="button" data-tab="otags"${hasRealTags(c) ? ' hidden' : ''}>🏷 ${t('otTitle')}${orgTagsCount(c) ? ` <span class="count-pill">${orgTagsCount(c)}</span>` : ''}</button>
      ${schoolCount(c) ? `<button type="button" data-tab="school">🎓 ${t('cardTabSchool')} <span class="count-pill">${schoolCount(c)}</span></button>` : ''}
    </nav>
    <div class="card-pane" data-tab="details">
    <section>
      ${field(t('marital'), h(maritalLabel(c.marital_status)))}
      ${field(t('enName'), unverifiedWrap(c, ['first_name_en', 'last_name_en'], h([c.title_en, c.first_name_en, c.last_name_en].filter(Boolean).join(' '))), true)}
      ${field(t('legalName'), h(c.legal_first_name), true)}
      ${field(t('mailingName'), mail ? h(mail) : '', true)}
      ${p.comments ? field(t('comments'), `<span class="card-notes" dir="auto">${h(p.comments)}</span>`) : ''}
      ${field(t('wife'), wife)}
      ${hasRealTags(c) ? '' : field(t('organizations'), orgLabels(c).map((o) => orgChip(o, 'chip')).join(''))}
      ${hasRealTags(c) ? '' : field(t('community'), tagChips(c.community_tags))}
    </section>
    ${cardTagsHtml(c)}
    ${address || c.area ? `<section><h3>${t('address')}${c.area ? ` · ${unverifiedWrap(c, ['area'], h(c.area))}` : ''}</h3><p dir="ltr" class="addr">${address}</p></section>` : ''}
    ${phones || emails ? `<section><h3>${t('phonesEmail')}</h3>${phones}${emails}</section>` : ''}
    </div>
    <div class="card-pane" data-tab="family">
      ${familySection(c)}
      ${occasionsSection(c)}
      ${kvitelSection(c)}
    </div>
    <div class="card-pane" data-tab="money">
      ${donationsSection(c)}
    </div>
    <div class="card-pane" data-tab="org">
      ${orgSection(c)}
    </div>
    <div class="card-pane" data-tab="otags">
      ${orgTagsPaneHtml(c)}
    </div>
    ${schoolCount(c) ? `<div class="card-pane" data-tab="school">${schoolSection(c)}</div>` : ''}
    <p class="meta">
      ${c.created_at ? `<span>${h(t('created', { date: `\u2066${c.created_at}\u2069`, by: displayName(c.created_by) || '—' }))}</span>` : ''}
      ${c.updated_at && c.updated_at !== c.created_at ? `<span>${h(t('updated', { date: `\u2066${c.updated_at}\u2069`, by: displayName(c.updated_by) }))}</span>` : ''}
    </p>
    <details class="hist"><summary>📜 ${h(t('histTitle'))}</summary><div class="hist-list"><p class="muted small">${h(t('loading'))}</p></div></details>`;

  wireCardTagBox(c);
  wireFamily(c);
  wireDonationsSection(c);
  wireOccasionsSection(c);
  wireKvitel(c);
  wireOrg(c);
  wirePhoto(c);
  wireHistory(c);
  const scPane = $('#card-body .card-pane[data-tab="school"]');
  if (scPane) wireSchoolSection(scPane);
  if (String(currentCardId) !== String(c.contact_id)) cardTab = 'details';
  if (tab) cardTab = tab;
  if (cardTab === 'school' && !scPane) cardTab = 'details';
  currentCardId = c.contact_id;
  const showTab = (name) => {
    cardTab = name;
    $$('#card-body .card-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    $$('#card-body .card-pane').forEach((pane) => { pane.hidden = pane.dataset.tab !== name; });
  };
  $$('#card-body .card-tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  showTab(cardTab);
  $('#card-task').onclick = () => openTaskForContact(c);
  $('#card-mail').hidden = !emailOf(c);
  $('#card-mail').onclick = () => openCompose({ contacts: [c], title: fullNameHe(c), kind: 'personal' });
  $('#card-delete').hidden = false;
  $('#card-delete').onclick = async () => {
    if (!state.isAdmin) {
      try { await submitRequest('delete_contact', { contact_id: String(c.contact_id) }, t('rqSumDelContact', { name: fullNameHe(c) })); } catch (err) { toast(friendlyError(err), 'error'); }
      return;
    }
    const id = String(c.contact_id);
    const n = {
      don: state.donations.filter((d) => String(d.contact_id) === id).length,
      occ: state.occasions.filter((o) => String(o.contact_id) === id).length,
      rel: state.relations.filter((r) => String(r.contact_id_a) === id || String(r.contact_id_b) === id).length,
    };
    const ok = await choose(t('delTitle', { name: fullNameHe(c) }), t('delText', n), [['trash', `🗑 ${t('delConfirm')}`, true], ['', t('cancelBtn')]]);
    if (ok !== 'trash') return;
    try {
      await trashContact(c);
      await loadAll();
      $('#card-dialog').close();
      refreshAll();
      toast(t('delDone', { name: fullNameHe(c) }));
    } catch (err) { toast(friendlyError(err), 'error'); }
  };
  $('#card-merge').onclick = () => openMerge(c);
  $('#card-edit').onclick = () => {
    if (cardDirty() && !confirm(t('kvitelUnsaved'))) return;
    $('#card-dialog').close(); openForm(c);
  };
  if (!$('#card-dialog').open) $('#card-dialog').showModal();
  $('#card-dialog').scrollTop = 0;
  $('#card-close').focus({ preventScroll: true }); // Enter = צומאכן, בלי לגלול למטה
}

// ---------- לשונית "ארגון": תיבות טקסט חופשיות ----------
/** האם יש בכרטיס טקסט שלא נשמר (קוויטל / ארגון). */
function cardDirty() {
  return ['.card-kvitel', '.card-org'].some((sel) => $(`#card-body ${sel}`)?._dirty?.());
}

function orgNotesOf(c) {
  return state.orgNotes.filter((n) => String(n.contact_id) === String(c.contact_id))
    .sort((a, b) => Number(a.note_id) - Number(b.note_id));
}

function orgBox(n) {
  return `<div class="org-box" data-id="${h(n.note_id || '')}">
    <textarea rows="4" dir="rtl" placeholder="${h(t('orgPh'))}">${h(n.text || '')}</textarea>
    <div class="org-actions">
      ${n.created_by ? `<span class="muted small"><bdi dir="ltr">${h(n.updated_at || n.created_at)}</bdi> · ${h(displayName(n.updated_by || n.created_by))}</span>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn small-btn danger org-del">${t('deleteBtn')}</button>
      <button type="button" class="btn small-btn primary org-save" hidden>${t('saveBtn')}</button>
    </div>
  </div>`;
}

function orgSection(c) {
  const notes = orgNotesOf(c);
  return `<section class="card-org">
    <h3>${t('cardTabOrg')}</h3>
    <div class="org-list">${notes.map(orgBox).join('')}</div>
    <button type="button" class="btn small-btn" id="org-add"${notes.length >= MAX_ORG_NOTES ? ' disabled' : ''}>${t('orgAdd')}</button>
  </section>`;
}

function wireOrg(c) {
  const box = $('#card-body .card-org');
  if (!box) return;
  const original = (el) => state.orgNotes.find((n) => String(n.note_id) === el.dataset.id);
  const isDirty = (el) => el.querySelector('textarea').value !== String(original(el)?.text ?? '');
  const wireBox = (el) => {
    const ta = el.querySelector('textarea');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.scrollHeight, 90)}px`; };
    grow();
    ta.addEventListener('input', () => { grow(); el.querySelector('.org-save').hidden = !isDirty(el); });
    el.querySelector('.org-save').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = t('saving');
      try {
        await saveOrgNote({ ...(original(el) || {}), contact_id: c.contact_id, text: ta.value.replace(/\s+$/, '') });
        await loadAll();
        refreshAll();
        toast(t('orgSaved'));
      } catch (err) {
        toast(friendlyError(err), 'error');
        btn.disabled = false;
        btn.textContent = t('saveBtn');
      }
    };
    el.querySelector('.org-del').onclick = async () => {
      const o = original(el);
      if (!o) { el.remove(); return; } // תיבה חדשה שלא נשמרה
      if (!confirm(t('orgConfirmDelete'))) return;
      try {
        await deleteOrgNote(o);
        await loadAll();
        refreshAll();
      } catch (err) { toast(friendlyError(err), 'error'); }
    };
  };
  $$('.org-box', box).forEach(wireBox);
  $('#org-add', box).onclick = () => {
    if ($$('.org-box', box).length >= MAX_ORG_NOTES) { toast(t('orgNotesMax', { n: MAX_ORG_NOTES }), 'error'); return; }
    $('.org-list', box).insertAdjacentHTML('beforeend', orgBox({}));
    const el = $$('.org-box', box).at(-1);
    wireBox(el);
    el.querySelector('textarea').focus();
  };
  box._dirty = () => $$('.org-box', box).some((el) => isDirty(el));
}

// ---------- היסטאריע פון ענדערונגען (אינעם כרטיס) ----------
const ENTITY_ICON = { contact: '👤', phones: '📞', donation: '💰', occasion: '🕯', orgnote: '📝', relation: '👪', photo: '📷' };

function fieldLabel(entity, field) {
  const map = {
    title_he: t('title'), first_name_he: t('firstHe'), last_name_he: t('lastHe'), is_alive: t('deceased'),
    marital_status: t('marital'), title_en: 'Title', first_name_en: 'First name', last_name_en: 'Last name',
    legal_first_name: t('legalName'), wife_name_he: t('wife'), wife_name_en: 'Wife', wife_is_rebbetzin: 'Rebbetzin',
    wife_is_alive: t('deceasedF'), wife_in_neshei: t('nesheiFull'), beis_medrash: t('orgBeisMedrash'), kollel: t('orgKollel'),
    organization: t('orgOrganization'), community_tags: t('community'), address: t('address'), city: 'City', state: 'State',
    zip: 'ZIP', country: 'Country', area: t('area'), is_active: t('inactive'), kvitel: t('kvitel'),
    beis_medrash_former: `${t('orgBeisMedrash')} · ${t('former')}`, kollel_former: `${t('orgKollel')} · ${t('former')}`,
    organization_former: `${t('orgOrganization')} · ${t('former')}`, comments: t('comments'),
    amount_usd: t('amount'), is_paid: t('paid'), payment_method: t('paymentMethod'), event_tags: t('eventLegend'),
    campaign: t('campaignName'), org: t('forOrg'), date: t('dateLegend'), text: t('cardTabOrg'),
    person_name: t('occName'), hebrew_day: t('hebDate'), hebrew_month: t('hebDate'),
  };
  return String(map[field] || field.replace(/_/g, ' ')).replace(/\s*\*\s*$/, '');
}

function histValue(v) {
  const x = String(v ?? '');
  if (x === 'TRUE' || x === 'true') return '✓';
  if (x === 'FALSE' || x === 'false') return '✗';
  return x.length > 80 ? `${x.slice(0, 80)}…` : x;
}

function wireHistory(c) {
  const det = $('#card-body details.hist');
  if (!det) return;
  det.addEventListener('toggle', async () => {
    if (!det.open || det.dataset.loaded) return;
    try {
      const rows = await getHistory(c.contact_id);
      det.dataset.loaded = '1';
      $('.hist-list', det).innerHTML = rows.length ? `<table class="hist-table">${rows.map((r) => `<tr>
          <td class="muted small nowrap">${h(r.at)}</td>
          <td class="small nowrap">${h(displayName(r.by))}</td>
          <td>${ENTITY_ICON[r.entity] || ''} ${r.field === '*' ? `<b>${h(r.new_value)}</b>` : `<b>${h(fieldLabel(r.entity, r.field))}</b>:
            <span class="hist-old">${h(histValue(r.old_value)) || '—'}</span> → <span class="hist-new">${h(histValue(r.new_value)) || '—'}</span>`}</td>
        </tr>`).join('')}</table>` : `<p class="muted small">${h(t('histEmpty'))}</p>`;
    } catch (err) { $('.hist-list', det).innerHTML = `<p class="muted small">${h(friendlyError(err))}</p>`; }
  });
}

// ---------- בילד פון דעם מענטש (אינעם כרטיס) ----------
function showPhoto(box, data) {
  const img = $('img', box);
  img.hidden = !data;
  if (data) img.src = data;
  $('.photo-ph', box).hidden = Boolean(data);
  box.title = t(data ? 'photoTipView' : 'photoTip');
  $('#card-body .photo-del').hidden = !data;
}

/** א גרויס בילד (לייטבאקס), מיט "טוישן" און "אוועקנעמען". */
function openPhotoView(src, { name = '', onChange, onRemove } = {}) {
  let dlg = $('#photo-view');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'photo-view';
    document.body.append(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  dlg.innerHTML = `<button type="button" class="x-close" aria-label="${h(t('close'))}">✕</button>
    <img src="${src}" alt="${h(name)}">
    <div class="pv-bar"><b dir="auto">${h(name)}</b><span class="spacer"></span>
      ${onChange ? `<button type="button" class="btn" data-pv="change">📷 ${h(t('photoChange'))}</button>` : ''}
      ${onRemove ? `<button type="button" class="btn danger" data-pv="remove">🗑 ${h(t('photoRemove'))}</button>` : ''}</div>`;
  $('.x-close', dlg).onclick = () => dlg.close();
  const ch = $('[data-pv=change]', dlg);
  if (ch) ch.onclick = () => { dlg.close(); onChange(); };
  const rm = $('[data-pv=remove]', dlg);
  if (rm) rm.onclick = () => { dlg.close(); onRemove(); };
  dlg.showModal();
}

function wirePhoto(c) {
  const box = $('#card-body .card-photo');
  if (!box) return;
  const id = String(c.contact_id);
  // ווען עס איז שוין דא א בילד: א קליק ווייזט עס גרויס (נישט קלייבן א נייעם)
  box.onclick = (e) => {
    const img = $('img', box);
    if (img.hidden || !img.src || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    openPhotoView(img.src, {
      name: fullNameHe(c),
      onChange: () => $('input', box).click(),
      onRemove: () => $('#card-body .photo-del').click(),
    });
  };
  getPhoto(id).then((data) => { if (String(currentCardId) === id) showPhoto(box, data); }).catch(() => {});
  $('input', box).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    box.classList.add('loading');
    try {
      const data = await shrinkImage(file, 600, 45000, true);
      let driveId = '';
      try {
        driveId = await saveOriginalToDrive(file, 'Photos', `${id} ${fullNameHe(c)}`);
      } catch (err) { toast(t('driveFailed', { err: friendlyError(err) }), 'error'); }
      await savePhoto(id, data, driveId);
      showPhoto(box, data);
      toast(driveId ? t('photoSavedDrive') : t('photoSaved'));
    } catch (err) {
      toast(err.message === 'too-big' ? t('mmImageTooBig') : err.message === 'bad-image' ? t('mmImageBad') : friendlyError(err), 'error');
    } finally { box.classList.remove('loading'); e.target.value = ''; }
  };
  $('#card-body .photo-del').onclick = async () => {
    if (!confirm(t('photoConfirmRemove'))) return;
    try { await savePhoto(id, ''); showPhoto(box, ''); } catch (err) { toast(friendlyError(err), 'error'); }
  };
}

// ---------- קוויטל (בכרטיס האישי) ----------
function kvitelSection(c) {
  const text = String(c.kvitel || '');
  return `<section class="card-kvitel">
    <h3>${t('kvitel')}</h3>
    <div class="kvitel-view"${text.trim() ? '' : ' hidden'}>
      <div class="kvitel-text" dir="rtl">${h(text)}</div>
      <button type="button" class="btn small-btn" id="kvitel-edit">${t('edit')}</button>
    </div>
    <div class="kvitel-edit"${text.trim() ? ' hidden' : ''}>
      <textarea id="kvitel-input" rows="8" dir="rtl" placeholder="${h(t('kvitelPh'))}">${h(text)}</textarea>
      <div class="kvitel-actions" hidden>
        <button type="button" class="btn" id="kvitel-cancel">${t('cancelBtn')}</button>
        <button type="button" class="btn primary" id="kvitel-save">${t('saveBtn')}</button>
      </div>
    </div>
  </section>`;
}

function wireKvitel(c) {
  const box = $('#card-body .card-kvitel');
  if (!box) return;
  const input = $('#kvitel-input', box);
  const actions = $('.kvitel-actions', box);
  const original = String(c.kvitel || '');
  const dirty = () => input.value !== original;
  input.addEventListener('input', () => { actions.hidden = !dirty(); });
  $('#kvitel-edit', box).onclick = () => {
    $('.kvitel-view', box).hidden = true;
    $('.kvitel-edit', box).hidden = false;
    actions.hidden = false;
    input.focus();
  };
  $('#kvitel-cancel', box).onclick = () => {
    input.value = original;
    actions.hidden = true;
    if (original.trim()) { $('.kvitel-view', box).hidden = false; $('.kvitel-edit', box).hidden = true; }
  };
  $('#kvitel-save', box).onclick = async () => {
    const btn = $('#kvitel-save', box);
    btn.disabled = true;
    btn.textContent = t('saving');
    try {
      await saveKvitel(c, input.value.replace(/\s+$/, ''));
      await loadAll();
      refreshAll();
      toast(t('kvitelSaved'));
    } catch (err) {
      toast(friendlyError(err), 'error');
      btn.disabled = false;
      btn.textContent = t('saveBtn');
    }
  };
  box._dirty = dirty;
}

// ---------- קשרים משפחתיים (בכרטיס האישי) ----------
function contactById(id) {
  return state.contacts.find((x) => String(x.contact_id) === String(id));
}

function pickerLabel(c) {
  return `${fullNameHe(c)} (#${c.contact_id})${c.city ? ` – ${c.city}` : ''}`;
}

function familyCount(c) {
  return state.relations.filter((r) => String(r.contact_id_a) === String(c.contact_id)).length + derivedRelations(c).length;
}

/**
 * קשרים אויטאמאטיש — אויסגערעכנט פון די קשרים וואס זענען אריינגעלייגט (טאטע/זון, שווער/איידעם), נישט אפגעהיט,
 * דערפאר דערהיינטיגט עס זיך אליין ווען מ'לייגט צו א מענטש:
 * ברודער (דער זעלבער טאטע), זיידע (דעם טאטנס טאטע אדער שווער), אייניקל (פון א זון אדער פון אן איידעם),
 * שוואגער (דעם טאטנס איידעם, דעם שווערס זון אדער איידעם). אן די וואס זענען שוין אויסדריקלעך אריינגעלייגט.
 */
function derivedRelations(c) {
  const id = String(c.contact_id);
  const R = state.relations;
  const pairs = (fwd, rev) => {
    // fwd: "a fwd b" (b איז דער עלטערער), rev: "a rev b" (a איז דער עלטערער) → Map(יינגערער → [עלטערע])
    const up = new Map(); const down = new Map();
    const add = (y, o) => { up.set(y, [...(up.get(y) || []), o]); down.set(o, [...(down.get(o) || []), y]); };
    R.forEach((r) => {
      const a = String(r.contact_id_a); const b = String(r.contact_id_b);
      if (r.relation_type === fwd) add(a, b);
      if (r.relation_type === rev) add(b, a);
    });
    return { up: (x) => [...new Set(up.get(x) || [])], down: (x) => [...new Set(down.get(x) || [])] };
  };
  const fa = pairs('זון פון', 'טאטע פון');        // fa.up(x) = טאטע, fa.down(x) = זין
  const inl = pairs('איידעם פון', 'שווער פון');   // inl.up(x) = שווער, inl.down(x) = איידעמס
  const many = (xs, f) => [...new Set(xs.flatMap(f))];
  const fathers = fa.up(id);
  const fathersInLaw = inl.up(id);
  const sets = [
    ['ברודער פון', many(fathers, fa.down)],
    // "c איז אייניקל פון k" — k איז דער זיידע; "c איז זיידע פון k" — k איז דער אייניקל
    ['אייניקל פון', [...many(fathers, fa.up), ...many(fathers, inl.up)]],
    ['זיידע פון', [...many(fa.down(id), fa.down), ...many(inl.down(id), fa.down)]],
    ['שוואגער פון', [...many(fathers, inl.down), ...many(fathersInLaw, fa.down), ...many(fathersInLaw, inl.down)]],
  ];
  const explicit = new Set(R.filter((r) => String(r.contact_id_a) === id).map((r) => String(r.contact_id_b)));
  const seen = new Set([id, ...explicit]);
  const out = [];
  sets.forEach(([type, ids]) => ids.forEach((k) => {
    if (seen.has(k) || !contactById(k)) return;
    seen.add(k);
    out.push([type, k]);
  }));
  return out;
}

function donationCount(c) {
  return state.donations.filter((d) => String(d.contact_id) === String(c.contact_id) && donationInScope(d)).length;
}

function familySection(c) {
  const mine = state.relations.filter((r) => String(r.contact_id_a) === String(c.contact_id));
  const rows = mine.map((r, i) => {
    const other = contactById(r.contact_id_b);
    return `<div class="kv family-row">
      <span>${h(relationLabel(r.relation_type))}</span>
      <span>${other ? `<a href="#" class="go-contact" data-id="${h(other.contact_id)}">${h(fullNameHe(other))}</a>` : `#${h(r.contact_id_b)}`}
        <button type="button" class="icon-btn rel-remove" data-i="${i}" title="✕">✕</button></span>
    </div>`;
  }).join('');
  const sibs = derivedRelations(c).map(([type, k]) => {
    const other = contactById(k);
    return `<div class="kv family-row derived" title="${h(t('sibAutoTip'))}">
      <span>${h(relationLabel(type))}</span>
      <span><a href="#" class="go-contact" data-id="${h(other.contact_id)}">${h(fullNameHe(other))}</a> <small class="muted">${h(t('sibAuto'))}</small></span>
    </div>`;
  }).join('');
  const others = state.contacts.filter((x) => String(x.contact_id) !== String(c.contact_id)
    && (isTrue(x.is_active) || x.is_active === ''));
  return `<section class="family">
    <h3>${t('family')}</h3>
    ${rows}${sibs}
    <details class="add-family">
      <summary>${t('addFamily')}</summary>
      <div class="add-family-row">
        <label>${t('relationType')}<select class="rel-type">${(state.lists.relation_type || [])
          .map((v) => `<option value="${h(v)}">${h(relationLabel(v))}</option>`).join('')}</select></label>
        <label class="grow">${t('pickContact')}<input class="rel-contact" list="dl-contacts" autocomplete="off"></label>
        <button type="button" class="btn primary rel-add">${t('addBtn')}</button>
      </div>
      <datalist id="dl-contacts">${others.map((x) => `<option value="${h(pickerLabel(x))}">`).join('')}</datalist>
    </details>
  </section>`;
}

function wireFamily(c) {
  const box = $('#card-body .family');
  const mine = state.relations.filter((r) => String(r.contact_id_a) === String(c.contact_id));
  $$('.go-contact', box).forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); openCard(a.dataset.id); };
  });
  $$('.rel-remove', box).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(t('removeRelConfirm'))) return;
      try {
        await removeRelation(mine[Number(b.dataset.i)]);
        await loadAll();
        toast(t('relRemoved'));
        openCard(c.contact_id);
      } catch (err) { toast(friendlyError(err), 'error'); }
    };
  });
  $('.rel-add', box).onclick = async () => {
    const type = $('.rel-type', box).value;
    const m = $('.rel-contact', box).value.match(/\(#(\d+)\)/);
    if (!type || !m || !contactById(m[1])) { toast(t('pickValid'), 'error'); return; }
    if (m[1] === String(c.contact_id)) { toast(t('relSelf'), 'error'); return; }
    if (mine.some((r) => r.relation_type === type && String(r.contact_id_b) === m[1])) {
      toast(t('relExists'), 'error'); return;
    }
    const btn = $('.rel-add', box);
    btn.disabled = true;
    try {
      await addRelation(c.contact_id, type, Number(m[1]));
      await afterRelation(c.contact_id, type, Number(m[1]));
      await loadAll();
      toast(t('relAdded'));
      openCard(c.contact_id);
    } catch (err) {
      toast(friendlyError(err), 'error');
      btn.disabled = false;
    }
  };
}

// ---------- טופס הוספה / עריכה ----------
function options(list, current, label = (v) => v) {
  const values = [...new Set([...(list || []), ...(current ? [current] : [])])];
  return '<option value=""></option>' + values.map((v) => `<option value="${h(v)}"${v === current ? ' selected' : ''}>${h(label(v))}</option>`).join('');
}

/** בורר תגיות: לחיצה מסמנת / מבטלת. מנהל יכול להוסיף תגית חדשה לרשימה. */
function tagPicker(name, listName, value) {
  const selected = splitTags(value);
  const all = [...new Set([...(state.lists[listName] || []), ...selected])];
  return `
    <div class="tags" dir="rtl" data-name="${name}" data-list="${listName}">
      ${all.map((tag) => `<button type="button" class="chip toggle${selected.includes(tag) ? ' on' : ''}">${h(tag)}</button>`).join('')}
      <button type="button" class="chip add">${h(t(state.isAdmin ? 'newTag' : 'newTagRequest'))}</button>
    </div>`;
}

function readTags(root, name) {
  const box = $(`.tags[data-name="${name}"]`, root);
  return joinTags($$('.chip.toggle.on', box).map((b) => b.textContent));
}

function cityStateDatalists() {
  const uniq = (key) => [...new Set(state.contacts.map((c) => String(c[key] || '').trim()).filter(Boolean))].sort();
  return `
    <datalist id="dl-city">${uniq('city').map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-state">${uniq('state').map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-address">${uniq('address').map((v) => `<option value="${h(v)}">`).join('')}</datalist>`;
}

/** שורת השייכות בקהילה: ביהמ"ד, כולל, ארגון — כל אחד גלילה (רשימה נפתחת) מלשונית Lists. */
const ORG_FIELDS = [['beis_medrash', 'orgBeisMedrash'], ['kollel', 'orgKollel'], ['organization', 'orgOrganization']];

function orgRow(c) {
  return `<div class="org-row">
    ${ORG_FIELDS.map(([name, label]) => {
      const chosen = splitTags(c[name]).filter((v) => v !== NESHEI_ORG);
      const all = [...new Set([...(state.lists[name] || []), ...chosen])].filter((v) => v !== NESHEI_ORG); // נשי — דורכן באזונדערן קנעפל
      return `<div class="org-select"><span class="org-head">${t(label)}
          <label class="former-toggle" title="${h(t('formerTip'))}"><input type="checkbox" name="${name}_former" ${isTrue(c[`${name}_former`]) ? 'checked' : ''}> ${t('former')}</label></span>
        <details class="multi" data-name="${name}">
          <summary>${chosen.length ? h(chosen.join(', ')) : '—'}</summary>
          <div class="multi-list">${all.map((v) => `<label class="check"><input type="checkbox" value="${h(v)}" ${chosen.includes(v) ? 'checked' : ''}> ${h(v)}</label>`).join('')}</div>
        </details></div>`;
    }).join('')}
  </div>`;
}

/** הבחירות בגלילה מרובת-בחירה. */
function readMulti(form, name) {
  return joinTags($$(`details.multi[data-name="${name}"] input:checked`, form).map((i) => i.value));
}

/** לתצוגה ברשימה ובכרטיס: [{ label, former }] — "ביהמ\"ד מאנסי", "כולל ערב"... former = יוצא (לשעבר). */
function orgLabels(c) {
  return ORG_FIELDS.flatMap(([name]) => memberOrgs(c, name).map((label) => ({ label, former: isFormerOf(c, name, label) })));
}

function orgChip(o, cls) {
  return `<span class="${cls}${o.former ? ' former' : ''}">${h(o.label)}${o.former ? ` · ${h(t('former'))}` : ''}</span>`;
}

/** לחיצה על תגית מסמנת / מבטלת; "+ נייע טעג" (מנהל) מוסיף ערך לרשימה. */
function wireTagPicker(box) {
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if (b.classList.contains('toggle')) { b.classList.toggle('on'); return; }
    if (b.classList.contains('add')) {
      const value = prompt(t('newTagPrompt'));
      if (!value || !value.trim()) return;
      if (!state.isAdmin) {
        // א גבאי: א בקשה צו די מנהלים
        try { await submitRequest('tag', { list: box.dataset.list, value: value.trim() }, t('rqSumTag', { value: value.trim() })); } catch (err) { toast(friendlyError(err), 'error'); }
        return;
      }
      try {
        await addListValue(box.dataset.list, value.trim());
        const nb = document.createElement('button');
        nb.type = 'button';
        nb.className = 'chip toggle on';
        nb.textContent = value.trim();
        box.insertBefore(nb, b);
        toast(t('tagAdded'));
      } catch (err) { toast(friendlyError(err), 'error'); }
    }
  });
}

/** קשרים משפחתיים בתוך הטופס: נשמרים יחד עם איש הקשר כשלוחצים אפהיטן. */
function wireFormFamily(form, c) {
  const box = $('.form-family', form);
  const existing = state.relations.filter((r) => c.contact_id && String(r.contact_id_a) === String(c.contact_id));
  form._relAdds = [];
  form._relRemoves = [];
  const render = () => {
    const rows = [
      ...existing.filter((r) => !form._relRemoves.includes(r)).map((r) => ({ type: r.relation_type, b: r.contact_id_b, rel: r })),
      ...form._relAdds.map((a, i) => ({ type: a.type, b: a.b, add: i })),
    ];
    $('.fam-list', box).innerHTML = rows.map((r, i) => {
      const other = contactById(r.b);
      return `<div class="kv family-row"><span>${h(relationLabel(r.type))}</span>
        <span>${h(other ? fullNameHe(other) : `#${r.b}`)}${r.add !== undefined ? ` <em class="muted">(${t('pendingSave')})</em>` : ''}
        <button type="button" class="icon-btn" data-i="${i}">✕</button></span></div>`;
    }).join('');
    $$('.fam-list .icon-btn', box).forEach((b) => {
      b.onclick = () => {
        const r = rows[Number(b.dataset.i)];
        if (r.rel) form._relRemoves.push(r.rel); else form._relAdds.splice(r.add, 1);
        form.dataset.dirty = '1';
        render();
      };
    });
  };
  // ווען מ'קלייבט א קאנטאקט פון דער רשימה — גלייך צוגעלייגט (מ'דארף נישט דריקן "צולייגן")
  $('.rel-contact', box).addEventListener('input', () => {
    const v = $('.rel-contact', box).value.trim();
    const c = state.contacts.find((x) => pickerLabel(x) === v);
    if (c) $('.rel-add', box).click();
  });
  form._relPending = () => {
    const m = $('.rel-contact', box).value.match(/\(#(\d+)\)/);
    if (m && contactById(m[1])) $('.rel-add', box).click();
  };
  $('.rel-add', box).onclick = () => {
    const type = $('.rel-type', box).value;
    const m = $('.rel-contact', box).value.match(/\(#(\d+)\)/);
    if (!type || !m || !contactById(m[1])) { toast(t('pickValid'), 'error'); return; }
    if (String(m[1]) === String(c.contact_id ?? '')) { toast(t('relSelf'), 'error'); return; }
    const dup = existing.some((r) => !form._relRemoves.includes(r) && r.relation_type === type && String(r.contact_id_b) === m[1])
      || form._relAdds.some((a) => a.type === type && String(a.b) === m[1]);
    if (dup) { toast(t('relExists'), 'error'); return; }
    form._relAdds.push({ type, b: Number(m[1]) });
    $('.rel-contact', box).value = '';
    form.dataset.dirty = '1';
    render();
  };
  render();
}

function openForm(c = {}) {
  const sc = getScope();
  if (!c.contact_id && sc?.value && !c[sc.type]) c = { ...c, [sc.type]: sc.value }; // אויך געגנט (area)
  const p = c.contact_id ? phonesOf(c) : {};
  const v = (k) => h(c[k] ?? '');
  const isNew = !c.contact_id;
  const form = $('#contact-form');

  form.innerHTML = `
    <button type="button" class="x-close" id="form-x" aria-label="${t('close')}">✕</button>
    <h2>${isNew ? t('newTitle') : h(t('editTitle', { name: fullNameHe(c) }))}</h2>
    ${cityStateDatalists()}

    <fieldset><legend>${t('secDetails')}</legend>
      <p class="hint-line">${t('requiredNote')}</p>
      <div class="grid">
        <label>${t('title')}<select name="title_he" dir="rtl">${options(state.lists.title_he, c.title_he)}</select></label>
        <label>${t('firstHe')}<input name="first_name_he" dir="rtl" ${c.contact_id ? "" : "required"} value="${v('first_name_he')}" placeholder="יוסף חיים"></label>
        <label>${t('lastHe')}<input name="last_name_he" dir="rtl" required value="${v('last_name_he')}"></label>
      </div>
      <div class="grid status-row">
        <label>${t('marital')}<select name="marital_status">${options(state.lists.marital_status, c.marital_status || (isNew ? 'נשוי' : ''), maritalLabel)}</select></label>
        <label class="check"><input type="checkbox" name="deceased" ${!isAlive(c.is_alive) ? 'checked' : ''}> ${t('deceased')}</label>
        <label class="check"><input type="checkbox" name="inactive" ${!isNew && c.is_active !== '' && !isTrue(c.is_active) ? 'checked' : ''}> ${t('inactive')}</label>
      </div>
      <div class="legacy-fields" hidden>${orgRow(c)}</div>
    </fieldset>
    ${tagsEditorHtml(c)}

    <fieldset><legend>${t('secEnglish')}</legend>
      <div class="grid" dir="ltr">
        <label>Title<select name="title_en">${options(state.lists.title_en, c.title_en)}</select></label>
        <label>First name<input name="first_name_en" value="${v('first_name_en')}"></label>
        <label>Last name<input name="last_name_en" value="${v('last_name_en')}"></label>
        <label>Legal first name (receipts)<input name="legal_first_name" value="${v('legal_first_name')}"></label>
      </div>
    </fieldset>

    <fieldset><legend>${t('comments')}</legend>
      <textarea name="comments" rows="3" dir="auto" aria-label="${h(t('comments'))}">${h(p.comments ?? '')}</textarea>
    </fieldset>

    <fieldset><legend>${t('secWife')}</legend>
      <div class="grid">
        <div class="wife-title">
          <label class="check"><input type="radio" name="wife_title" value="mrs" ${isTrue(c.wife_is_rebbetzin) ? '' : 'checked'}> Mrs.</label>
          <label class="check"><input type="radio" name="wife_title" value="rebbetzin" ${isTrue(c.wife_is_rebbetzin) ? 'checked' : ''}> Rebbetzin</label>
        </div>
        <label>${t('wifeNameHe')}<input name="wife_name_he" dir="rtl" value="${v('wife_name_he')}"></label>
        <label>Wife's name<input name="wife_name_en" dir="ltr" value="${v('wife_name_en')}"></label>
        <label class="check"><input type="checkbox" name="wife_deceased" ${!isAlive(c.wife_is_alive) ? 'checked' : ''}> ${t('deceasedF')}</label>
      </div>
      <label class="neshei-row">
        <input type="checkbox" name="wife_in_neshei" ${isTrue(c.wife_in_neshei) ? 'checked' : ''}>
        <img src="${orgLogo(NESHEI_ORG)}" alt="" style="height:60px;width:auto;max-width:120px;object-fit:contain">
        <span>${t('nesheiJoin')}</span>
      </label>
    </fieldset>

    <div class="legacy-fields" hidden>
    <fieldset><legend>${t('community')}</legend>
      <p class="hint-line">${t('communityNote')}</p>
      ${tagPicker('community_tags', 'community_tag', c.community_tags)}
    </fieldset>
    ${orgTagsFormHtml(c)}
    </div>

    <fieldset><legend>${t('secAddress')}</legend>
      <div class="grid" dir="ltr">
        <label class="wide">Address
          <span class="ac-wrap"><input name="address" autocomplete="off" list="${placesEnabled() ? '' : 'dl-address'}" value="${v('address')}" placeholder="${placesEnabled() ? 'Start typing an address…' : ''}">
          <span class="ac-list" hidden></span></span>
        </label>
        <label>City<input name="city" list="dl-city" value="${v('city')}"></label>
        <label>State<input name="state" list="dl-state" value="${v('state')}"></label>
        <label>ZIP<input name="zip" value="${v('zip')}" inputmode="numeric"></label>
        <label>Country<input name="country" value="${v('country') || 'USA'}"></label>
        <label class="area-field" dir="rtl">${t('area')}<select name="area">${options(state.lists.area, c.area)}</select></label>
      </div>
    </fieldset>

    <fieldset><legend>${t('phonesEmail')}</legend>
      ${phoneFields().map(([k, label]) => `
        <div class="contact-line">
          <label>${label}<input name="${k}" dir="ltr" inputmode="tel" value="${h(p[k] ?? '')}"></label>
          ${tagPicker(`${k}_tags`, 'phone_tag', p[`${k}_tags`])}
        </div>`).join('')}
      ${emailFields().map(([k, label]) => `
        <div class="contact-line">
          <label>${label}<input name="${k}" type="email" dir="ltr" value="${h(p[k] ?? '')}"></label>
          ${tagPicker(`${k}_tags`, 'email_tag', p[`${k}_tags`])}
        </div>`).join('')}
    </fieldset>

    <fieldset class="form-family"><legend>${t('family')}</legend>
      <div class="fam-list"></div>
      <div class="add-family-row">
        <label>${t('relationType')}<select class="rel-type">${(state.lists.relation_type || [])
          .map((rv) => `<option value="${h(rv)}">${h(relationLabel(rv))}</option>`).join('')}</select></label>
        <label class="grow">${t('pickContact')}<input class="rel-contact" list="dl-form-contacts" autocomplete="off"></label>
        <button type="button" class="btn rel-add">${t('addBtn')}</button>
      </div>
      <datalist id="dl-form-contacts">${state.contacts
        .filter((x) => String(x.contact_id) !== String(c.contact_id ?? '') && (isTrue(x.is_active) || x.is_active === ''))
        .map((x) => `<option value="${h(pickerLabel(x))}">`).join('')}</datalist>
    </fieldset>

    <div class="cf-missing">
      <label class="check"><input type="checkbox" name="gtd_missing"> ☑ ${h(t('cfMissing'))}</label>
      <input name="gtd_missing_text" placeholder="${h(t('cfMissingPh'))}" hidden>
    </div>
    <div class="actions">
      <span class="spacer"></span>
      <button type="button" class="btn" id="btn-cancel">${t('cancelBtn')}</button>
      <button type="submit" class="btn primary" id="btn-save">${t('saveBtn')}</button>
    </div>`;

  wireForm(form, c);
  wireTagsEditor(form);
  // א נייער קאנטאקט מיט א נאמען פון פריער (למשל פונעם טופס פון א שמחה) — גלייך די הצעה אויף ענגליש
  if (!c.contact_id) {
    ['first_name_he', 'last_name_he', 'wife_name_he'].forEach((n) => { if (form.elements[n]?.value.trim()) form.elements[n].dispatchEvent(new Event('blur')); });
    if (form.elements.title_he?.value) form.elements.title_he.dispatchEvent(new Event('change'));
  }
  form.elements.gtd_missing.onchange = (e) => { form.elements.gtd_missing_text.hidden = !e.target.checked; if (e.target.checked) form.elements.gtd_missing_text.focus(); };
  $('#form-dialog').showModal();
}

function wireForm(form, original) {
  const f = (name) => form.elements[name];

  // תגיות
  $$('.tags[data-name]', form).forEach(wireTagPicker);
  wireOrgTagsForm(form, { toast, friendlyError, submitRequest });

  // הצעת שם באנגלית לפי העברית — רק כשהשדה באנגלית ריק. מוצג באפור עד שמשנים או מאשרים.
  const suggestInto = (heName, enName, fn) => {
    f(heName).addEventListener('blur', () => {
      const en = f(enName);
      if (en.value.trim()) return;
      const guess = fn(f(heName).value, state.contacts);
      if (guess) { en.value = guess; en.classList.add('suggested'); en.title = t('suggestedTip'); }
    });
    const confirmIt = () => { f(enName).classList.remove('suggested'); f(enName).title = ''; };
    f(enName).addEventListener('input', confirmIt);
    f(enName).addEventListener('click', confirmIt); // לחיצה על השדה = אישור
  };
  suggestInto('first_name_he', 'first_name_en', suggestFirstName);
  suggestInto('last_name_he', 'last_name_en', suggestLastName);
  suggestInto('wife_name_he', 'wife_name_en', suggestFirstName);
  // שדות שמולאו אוטומטית ועוד לא אושרו — נשארים אפורים גם אחרי שמירה
  splitTags(original.unverified_fields).forEach((n) => {
    if (f(n)?.value) { f(n).classList.add('suggested'); f(n).title = t('suggestedTip'); }
  });

  // השלמת תואר דו-כיוונית — רק כשהשני ריק
  f('title_he').addEventListener('change', () => {
    const en = state.titleHeToEn[f('title_he').value];
    if (en && !f('title_en').value) f('title_en').value = en;
  });
  f('title_en').addEventListener('change', () => {
    const he = state.titleEnToHe[f('title_en').value];
    if (he && !f('title_he').value) f('title_he').value = he;
  });

  // האישה נפטרה → הצעה לשנות מצב משפחתי
  f('wife_deceased').addEventListener('change', async () => {
    if (!f('wife_deceased').checked || f('marital_status').value !== 'נשוי') return;
    const pick = await choose(t('marital'), t('changeMarital'), [
      ['אלמן', maritalLabel('אלמן'), true], ['גרוש', maritalLabel('גרוש')], ['', t('keepMarried')],
    ]);
    if (pick) f('marital_status').value = pick;
  });

  // טלפונים: עיצוב אוטומטי
  phoneFields().forEach(([k]) => f(k).addEventListener('blur', () => { f(k).value = formatPhone(f(k).value); }));

  // ZIP → עיר וסטייט, לפי כתובות שכבר קיימות במאגר
  f('zip').addEventListener('blur', () => {
    const zip = f('zip').value.trim();
    if (!zip || (f('city').value && f('state').value)) return;
    const known = state.contacts.find((c) => String(c.zip).trim() === zip && c.city);
    if (known) {
      if (!f('city').value) f('city').value = known.city;
      if (!f('state').value) f('state').value = known.state;
    }
  });

  // געגנט: זיהוי אוטומטי לפי הכתובת (אפור עד אישור). לא דורס בחירה שכבר אושרה.
  const suggestArea = () => {
    const sel = f('area');
    if (sel.value && !sel.classList.contains('suggested')) return;
    const guess = detectArea(state.areas, {
      zip: f('zip').value, city: f('city').value, country: f('country').value,
      neighborhood: form.dataset.neighborhood || '',
    });
    if (guess && guess !== sel.value) { sel.value = guess; sel.classList.add('suggested'); sel.title = t('suggestedTip'); }
  };
  ['zip', 'city', 'country'].forEach((n) => f(n).addEventListener('change', suggestArea));
  form.addEventListener('address-picked', suggestArea);
  const confirmArea = () => { f('area').classList.remove('suggested'); f('area').title = ''; };
  f('area').addEventListener('change', confirmArea);
  f('area').addEventListener('mousedown', confirmArea);
  if (!f('area').value) suggestArea(); // לאנשי קשר ישנים בלי געגנט — הצעה כשפותחים לעריכה

  // גלילות מרובות-בחירה: הכותרת מראה מה נבחר; רק אחת פתוחה בכל פעם
  $$('details.multi', form).forEach((d) => {
    d.addEventListener('change', () => {
      const chosen = $$('input:checked', d).map((i) => i.value);
      $('summary', d).textContent = chosen.length ? chosen.join(', ') : '—';
    });
    d.addEventListener('toggle', () => {
      if (d.open) $$('details.multi', form).forEach((o) => { if (o !== d) o.open = false; });
    });
  });
  form.addEventListener('click', (e) => { // לחיצה מחוץ לגלילה סוגרת אותה
    if (!e.target.closest('details.multi')) $$('details.multi[open]', form).forEach((d) => { d.open = false; });
  });

  wireFormFamily(form, original);

  wireAddressAutocomplete(form);

  form.dataset.dirty = '';
  form.addEventListener('input', () => { form.dataset.dirty = '1'; });
  form.addEventListener('change', () => { form.dataset.dirty = '1'; });
  $('#btn-cancel', form).onclick = () => closeForm();
  $('#form-x', form).onclick = () => closeForm();
  form.onsubmit = (e) => { e.preventDefault(); submit(form, original); };
}

function wireAddressAutocomplete(form) {
  if (!placesEnabled()) return;
  const input = form.elements.address;
  const listEl = $('.ac-list', form);
  let timer;
  let items = [];
  let warned = false;

  const close = () => { listEl.hidden = true; listEl.innerHTML = ''; };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const result = await suggest(input.value);
      if (result === 'cap' || result === 'error') {
        if (!warned) {
          toast(result === 'cap'
            ? t('capReached')
            : t('acError', { msg: placesError() || t('unknownErr') }), result === 'cap' ? 'info' : 'error');
        }
        warned = true;
        return close();
      }
      items = result;
      if (!items.length) return close();
      listEl.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}">${h(it.text)}</button>`).join('');
      listEl.hidden = false;
    }, 300);
  });
  listEl.addEventListener('mousedown', (e) => e.preventDefault()); // שהלחיצה לא תסגור את הרשימה לפני הבחירה
  listEl.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const item = items[Number(b.dataset.i)];
    close();
    const d = item ? await details(item.prediction) : null;
    if (!d) { input.value = b.textContent; return; }
    form.elements.address.value = d.address;
    form.elements.city.value = d.city;
    form.elements.state.value = d.state;
    form.elements.zip.value = d.zip;
    form.elements.country.value = d.country || 'USA';
    form.dataset.neighborhood = d.neighborhood || '';
    form.dispatchEvent(new Event('address-picked'));
  });
  input.addEventListener('blur', () => setTimeout(close, 200));
}

function collect(form, original) {
  const val = (n) => String(form.elements[n].value ?? '').trim();
  const contact = {
    ...original,
    title_he: val('title_he'),
    first_name_he: val('first_name_he').replace(/\s+/g, ' '),
    last_name_he: val('last_name_he').replace(/\s+/g, ' '),
    is_alive: !form.elements.deceased.checked,
    marital_status: val('marital_status'),
    title_en: val('title_en'),
    first_name_en: val('first_name_en'),
    last_name_en: val('last_name_en'),
    legal_first_name: val('legal_first_name'),
    wife_name_he: val('wife_name_he'),
    wife_name_en: val('wife_name_en'),
    wife_is_rebbetzin: form.elements.wife_title.value === 'rebbetzin',
    wife_is_alive: !form.elements.wife_deceased.checked,
    wife_in_neshei: form.elements.wife_in_neshei.checked,
    community_tags: readTags(form, 'community_tags'),
    org_tags: readOrgTagsForm(form),
    beis_medrash: readMulti(form, 'beis_medrash'),
    kollel: readMulti(form, 'kollel'),
    organization: readMulti(form, 'organization'),
    beis_medrash_former: form.elements.beis_medrash_former.checked,
    kollel_former: form.elements.kollel_former.checked,
    organization_former: form.elements.organization_former.checked,
    address: val('address'),
    city: val('city'),
    state: val('state').toUpperCase(),
    zip: val('zip'),
    country: val('country') || 'USA',
    area: val('area'),
    unverified_fields: joinTags($$('.suggested[name]', form).filter((i) => i.value.trim()).map((i) => i.name)),
  };
  delete contact._row;

  const phones = { comments: val('comments') };
  phoneFields().forEach(([k]) => {
    phones[k] = formatPhone(val(k));
    phones[`${k}_tags`] = readTags(form, `${k}_tags`);
  });
  emailFields().forEach(([k]) => {
    phones[k] = val(k);
    phones[`${k}_tags`] = readTags(form, `${k}_tags`);
  });
  return { contact, phones };
}

async function submit(form, original) {
  form._relPending?.(); // א קשר וואס מ'האט אויסגעקליבן אבער נישט צוגעלייגט
  const { contact, phones } = collect(form, original);
  // עץ התגיות
  const tg = readTagsEditor(form, original);
  if (tg.error) { toast(tg.error, 'error'); $('.tg-missing', form)?.scrollIntoView({ block: 'center' }); return; }
  contact.tags = tg.tags;
  applyMaritalRule(contact, original);
  nesheiFromTags(contact);
  contact.is_active = !form.elements.inactive.checked;

  if (!contact.last_name_he || (!contact.first_name_he && !original.contact_id)) {
    toast(t('required'), 'error');
    return;
  }
  // "⚠ לא נבדק": פרעגן ביי יעדער שפייכלערן — מ'קען עס נאכדעם נישט צוריקלייגן
  if (!original.contact_id) markChecked(contact); // א נייער קאנטאקט — מ'האט אים יעצט אריינגעשריבן
  else if (hasUnchecked(contact)) {
    const ans = await choose(`⚠ ${t('tgUnchecked')}`, t('tgCheckQ'), [['yes', t('tgCheckYes'), true], ['no', t('tgCheckNo')]], t('tgCheckSaved'));
    if (!ans) return;
    if (ans === 'yes') markChecked(contact);
  }

  // אזהרת כפילות שם — נאר ביי א נייעם, אדער ווען מ'האט געטוישט דעם נאמען
  const nameChanged = !original.contact_id || normalize(original.first_name_he) !== normalize(contact.first_name_he)
    || normalize(original.last_name_he) !== normalize(contact.last_name_he);
  const sameName = nameChanged && contact.first_name_he && state.contacts.find((c) => String(c.contact_id) !== String(original.contact_id ?? '')
    && normalize(c.first_name_he) === normalize(contact.first_name_he)
    && normalize(c.last_name_he) === normalize(contact.last_name_he));
  if (sameName && !confirm(t('dupName', { id: sameName.contact_id }))) return;

  // אזהרת טלפון שכבר שייך למישהו אחר
  for (const [k, label] of phoneFields()) {
    const d = digits(phones[k]);
    if (d.length < 7) continue;
    for (const [id, other] of state.phones) {
      if (id === String(original.contact_id ?? '')) continue;
      if (phoneFields().some(([ok]) => digits(other[ok]) === d)) {
        const owner = state.contacts.find((c) => String(c.contact_id) === id);
        if (!confirm(t('dupPhone', { label, phone: phones[k], owner: owner ? fullNameHe(owner) : `#${id}` }))) return;
      }
    }
  }

  const btn = $('#btn-save', form);
  btn.disabled = true;
  btn.textContent = t('saving');
  try {
    const id = await saveContact(contact, phones);
    for (const rel of form._relRemoves || []) await removeRelation(rel);
    for (const add of form._relAdds || []) { await addRelation(id, add.type, add.b); await afterRelation(id, add.type, add.b); }
    // "פעלן פרטים" → To Do כללי (אלע זעען)
    if (form.elements.gtd_missing?.checked) {
      try { await addGeneralTask(form.elements.gtd_missing_text.value.trim() || t('cfMissingDefault'), id); } catch { /* */ }
    }
    await loadAll();
    renderList();
    $('#contact-form').dataset.dirty = '';
    $('#form-dialog').close();
    toast(original.contact_id ? t('saved') : t('added', { id }));
    offerYahrzeit(id, original, contact);
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('saveBtn');
  }
}

/** סימנו "נפטר" / "נפטרה" עכשיו → מציעים להוסיף יארצייט (לא חובה). */
function offerYahrzeit(id, original, contact) {
  const has = (rel) => state.occasions.some((o) => String(o.contact_id) === String(id)
    && o.occasion_type === YAHRZEIT && o.relation === rel);
  const wasAlive = (v) => original.contact_id === undefined || isAlive(v);
  if (!contact.is_alive && wasAlive(original.is_alive) && !has('ער אליין')
    && confirm(t('offerYahrzeit', { name: fullNameHe(contact) }))) {
    openOccasionForm({ contact_id: id, occasion_type: YAHRZEIT, relation: 'ער אליין', person_name: contact.first_name_he });
    return;
  }
  if (!contact.wife_is_alive && wasAlive(original.wife_is_alive) && !has('ווייב')
    && confirm(t('offerYahrzeitWife', { name: contact.wife_name_he || '' }))) {
    openOccasionForm({ contact_id: id, occasion_type: YAHRZEIT, relation: 'ווייב', person_name: contact.wife_name_he || '', ben_bat: 'בת' });
  }
}

// ---------- סגירת חלונות ----------
/** סוגר את הטופס; אם יש שינויים שלא נשמרו — שואל קודם. */
function closeForm() {
  const form = $('#contact-form');
  if (form.dataset.dirty && !confirm(t('discardChanges'))) return;
  form.dataset.dirty = '';
  $('#form-dialog').close();
}

/** לחיצה על הרקע (מחוץ לחלון) סוגרת אותו. */
function closeOnBackdrop(dialog, close) {
  dialog.addEventListener('mousedown', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) close();
  });
}

// ---------- הפעלה ----------
function switchLang(lang) {
  setLang(lang);
  if (!$('#app-view').hidden) refreshAll();
}

function start() {
  applyStatic();
  $$('.lang-switch button').forEach((b) => { b.onclick = () => switchLang(b.dataset.lang); });
  $('#btn-login').onclick = signIn;
  $('#btn-logout').onclick = logout;
  $('#btn-refresh').onclick = refresh;
  $('#btn-new').onclick = () => openForm();
  $('#btn-xl-contacts').onclick = () => { const sc = getScope(); exportContacts(sc ? scopeLabel(sc) : t('tabContacts'), visibleContacts()); };
  $('#search').addEventListener('input', renderList);
  $('#tag-filter').addEventListener('change', renderList);
  $('#otag-filter').addEventListener('change', renderList);
  wireTagFilter();
  $('#area-filter').addEventListener('change', renderList);
  $('#org-filter').addEventListener('change', () => { $('#org-former-wrap').hidden = !$('#org-filter').value; renderList(); });
  $('#org-former').addEventListener('change', renderList);
  $('#org-side').addEventListener('click', (e) => {
    const b = e.target.closest('.org-link');
    if (b) enterScope({ type: b.dataset.type, value: b.dataset.value });
  });
  // הויפט בלאט / הלוגו / "צוריק צום כללי" → יוצאים מהארגון
  const goHome = async () => {
    const sc = getScope();
    if (sc) {
      const name = scopeLabel(sc);
      const ok = await choose(t('exitScopeTitle', { home: umbrellaName() }), t('exitScopeText', { name, home: umbrellaName() }), [['cancel', t('cancelBtn')], ['go', t('exitScopeYes'), true]]);
      if (ok !== 'go') return;
    }
    enterScope(null);
    showView('contacts');
  };
  $('.topbar .brand').style.cursor = 'pointer';
  $('.topbar .brand').onclick = () => showView('lobby');
  $('#lobby-main').addEventListener('click', lobbyClick);
  $('#lobby-main').addEventListener('input', (e) => { if (e.target.id === 'lobby-q') lobbySearch(); });
  $('#lobby-main').addEventListener('keydown', (e) => {
    if (e.target.id === 'lobby-q' && e.key === 'Enter') {
      e.preventDefault();
      const first = $('#lobby-results .lobby-hit');
      // אויף keyup — כדי דער זעלבער Enter זאל נישט צומאכן דעם כרטיס וואס עפנט זיך
      if (first) e.target.addEventListener('keyup', () => first.click(), { once: true });
    }
  });
  $('#btn-home').onclick = goHome;
  $('#scope-exit').onclick = goHome;
  $('#scope-former').addEventListener('change', () => { setWithFormer($('#scope-former').checked); refreshAll(); });
  $('#btn-lobby').onclick = () => { document.body.classList.remove('solo-mode'); showView('lobby'); };
  $('#btn-menu').onclick = () => document.body.classList.toggle('menu-open');
  $('#show-inactive').addEventListener('change', renderList);
  $('#list').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openCard(row.dataset.id);
  });
  $$('dialog [data-close]').forEach((b) => { b.onclick = () => b.closest('dialog').close(); });
  // ווען מ'עפנט א כרטיס (אדער אן אנדער פענצטער) און מאכט צו — צוריק צום זעלבן ארט אין דער רשימה
  let listScroll = window.scrollY;
  const anyDialogOpen = () => !!document.querySelector('dialog[open]');
  window.addEventListener('scroll', () => { if (!anyDialogOpen()) listScroll = window.scrollY; }, { passive: true });
  document.addEventListener('close', (e) => {
    if (!(e.target instanceof HTMLDialogElement)) return;
    const y = listScroll;
    // נאכן נייעם ציילן פון דער רשימה (נאך א שמירה) — דעריבער צוויי מאל
    requestAnimationFrame(() => { if (!anyDialogOpen()) window.scrollTo(0, y); });
    setTimeout(() => { if (!anyDialogOpen() && Math.abs(window.scrollY - y) > 5) window.scrollTo(0, y); }, 400);
  }, true);
  // הכרטיס: אם יש קוויטל שלא נשמר — שואלים לפני שסוגרים
  const closeCard = () => {
    if (cardDirty() && !confirm(t('kvitelUnsaved'))) return;
    $('#card-dialog').close();
  };
  $$('#card-dialog [data-close]').forEach((b) => { b.onclick = closeCard; });
  closeOnBackdrop($('#card-dialog'), closeCard);
  $('#card-dialog').addEventListener('cancel', (e) => { e.preventDefault(); closeCard(); });
  closeOnBackdrop($('#donation-dialog'), () => $('#donation-form')._close?.());
  $('#donation-dialog').addEventListener('cancel', (e) => { e.preventDefault(); $('#donation-form')._close?.(); });
  $('#campaign-dialog').addEventListener('cancel', (e) => { e.preventDefault(); $('#campaign-form')._close?.(); });
  closeOnBackdrop($('#task-dialog'), () => $('#task-dialog').close());
  closeOnBackdrop($('#occasion-dialog'), () => $('#occasion-form')._close?.());
  $('#occasion-dialog').addEventListener('cancel', (e) => { e.preventDefault(); $('#occasion-form')._close?.(); });
  initOccasions({ contactById, fullNameHe, pickerLabel, openCard, toast, friendlyError, refreshAll });
  $$('.tabs button').forEach((b) => { b.onclick = () => showView(b.dataset.view); });
  initDonations({
    contactById, fullNameHe, pickerLabel, options, tagPicker, readTags, wireTagPicker,
    toast, friendlyError, refreshAll, showView, printForDonation,
    openCampaignPage: (name) => showCampaign(name),
  });
  initCampaigns({ showView, tagPicker, wireTagPicker, readTags, toast, friendlyError, refreshAll, openCard });
  initAdmin({ toast, friendlyError, refreshAll, openOrgDetails });
  initReceipts({ showView, toast, friendlyError, contactById, fullNameHe, pickerLabel, refreshAdmin: () => renderAdmin() });
  initMailMerge({ showView, fullNameHe, toast, friendlyError });
  initMail({ toast, friendlyError });
  initRequests({ toast, friendlyError, refreshAll, updateBadges, showView, openCard });
  initMerge({ contactById, fullNameHe, pickerLabel, fieldLabel, toast, friendlyError, refreshAll, openCard });
  initSimchos({ showView, contactById, fullNameHe, pickerLabel, toast, friendlyError, refreshAll, openCard, openForm });
  initSchool({
    showView, contactById, fullNameHe, pickerLabel, openCard, toast, friendlyError, refreshAll,
    openOrgContacts: (org) => {
      const f = ORG_FIELDS.find(([n]) => (state.lists[n] || []).includes(org));
      enterScope({ type: f ? f[0] : 'kollel', value: org });
      showView('contacts');
    },
  });
  initPersonal({ showView, fullNameHe, openCard, contactById, toast, friendlyError, updateBadges });
  $('#btn-personal').onclick = () => { document.body.classList.add('solo-mode'); openPersonal(); };
  initLists({ showView, fullNameHe, phonesOf, contactById, pickerLabel, openCard, toast, friendlyError, refreshAll });
  $('#btn-help').onclick = () => openHelp();
  $('#btn-admin').onclick = () => { if (pendingRequests().length) setAdminTab('requests'); document.body.classList.add('solo-mode'); showView('admin'); };
  closeOnBackdrop($('#form-dialog'), closeForm);
  $('#form-dialog').addEventListener('cancel', (e) => { e.preventDefault(); closeForm(); }); // מקש Esc

  // אחרי שעה הכניסה פגה: מציגים חלון קטן עם כפתור, ולחיצה אחת מחדשת בלי לבחור חשבון שוב
  setOnExpire(async () => {
    if ($('#app-view').hidden) return;
    const go = await choose(t('sessionTitle'), t('sessionText'), [['go', t('sessionContinue'), true]]);
    if (go) {
      try { await requestToken(''); } catch (err) { toast(friendlyError(err), 'error'); }
    }
  });

  initAuth().then(async () => {
    $('#btn-login').disabled = false;
    if (hasSavedSession()) {
      setSilent(true);
      try { await enterApp(); } catch (err) {
        console.warn('[auth] restore failed', err);
        if (err.code === 'not-registered' || err.status === 403) showLoginProblem(err);
        else if (err.status !== 401) showLoginProblem(err); // ווייזן פארוואס, כדי מ'זאל וויסן
      } finally { setSilent(false); }
    }
  }).catch(() => toast(t('gisFail'), 'error'));
}

start();
