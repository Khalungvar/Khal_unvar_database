// איזור אישי: מעסעדזשעס צווישן די באנוצער, בקשות גישה (צו די מנהלים), מיינע פריוואטע רשימות,
// און אונטן צוויי קאלומס: די קאנטאקטן וואס איך האב צוגעלייגט / געטוישט, און די נדבות וואס איך האב אריינגעלייגט.
import {
  state, loadAll, saveRecord, deleteRecord, reloadMessages, allUsers, displayName,
  isDatabaseAccount, hasDriveScope, connectDrive,
} from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, splitTags, joinTags, nowStamp } from './util.js';
import { todayIso } from './hebdate.js';
import { openBuilder, openOverview } from './lists.js';
import { money, donorName, openDonationForm } from './donations.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let box = 'inbox'; // 'inbox' | 'sent'
let openMsg = '';
let lastUnread = -1;

export function initPersonal(helpers) {
  ui = helpers;
  // יעדע 90 סעקונדעס: צי איז דא א נייע מעסעדזש?
  setInterval(async () => {
    if ($('#app-view').hidden || document.hidden) return;
    try {
      await reloadMessages();
      const n = unreadCount();
      if (lastUnread >= 0 && n > lastUnread) ui.toast(t('pmNewMessage'));
      lastUnread = n;
      ui.updateBadges?.();
      if (!$('.view[data-view="personal"]').hidden) renderPersonal();
    } catch { /* שטיל — מען פרובירט נאכאמאל */ }
  }, 90000);
}

export function openPersonal() {
  ui.showView('personal');
}

// ---------- מעסעדזשעס ----------
function isForMe(m) {
  const to = String(m.to_email || '').toLowerCase();
  if (String(m.from_email).toLowerCase() === state.email) return false;
  return to === state.email || to === 'all' || (to === 'admins' && state.isAdmin);
}

function isRead(m) {
  return splitTags(m.read_by).map((x) => x.toLowerCase()).includes(state.email);
}

export function unreadCount() {
  return state.messages.filter((m) => isForMe(m) && !isRead(m)).length;
}

function toLabel(to) {
  if (to === 'all') return t('pmToAll');
  if (to === 'admins') return t('pmToAdmins');
  return displayName(to);
}

function statusBadge(m) {
  if (m.kind !== 'access') return '';
  const s = m.status || 'open';
  const cls = s === 'approved' ? 'paid' : s === 'declined' ? 'unpaid' : 'muted';
  return `<span class="badge ${cls}">${h(t(`pmStatus_${s}`))}</span>`;
}

function messageList() {
  const list = state.messages
    .filter((m) => (box === 'inbox' ? isForMe(m) : String(m.from_email).toLowerCase() === state.email))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || Number(b.msg_id) - Number(a.msg_id));
  if (!list.length) return `<p class="empty">${h(t(box === 'inbox' ? 'pmEmptyInbox' : 'pmEmptySent'))}</p>`;
  return list.map((m) => {
    const unread = box === 'inbox' && !isRead(m);
    const open = String(openMsg) === String(m.msg_id);
    return `<div class="pm-msg${unread ? ' unread' : ''}${open ? ' open' : ''}" data-msg="${h(m.msg_id)}">
      <div class="pm-head">
        ${m.kind === 'access' ? '<span class="badge org mini">🔑</span>' : ''}
        <b>${h(box === 'inbox' ? displayName(m.from_email) : `→ ${toLabel(m.to_email)}`)}</b>
        <span class="pm-subj">${h(m.subject || '')}</span>
        ${statusBadge(m)}
        <span class="spacer"></span>
        <span class="muted small">${h(m.created_at || '')}</span>
      </div>
      ${open ? `<div class="pm-body">${h(m.text || '').replace(/\n/g, '<br>')}</div>
        <div class="pm-actions">
          ${box === 'inbox' ? `<button type="button" class="btn small-btn" data-reply="${h(m.msg_id)}">${t('pmReply')}</button>` : ''}
          ${m.kind === 'access' && state.isAdmin && (m.status || 'open') === 'open' && box === 'inbox' ? `
            <button type="button" class="btn small-btn primary" data-decide="approved">${t('pmApprove')}</button>
            <button type="button" class="btn small-btn danger" data-decide="declined">${t('pmDecline')}</button>` : ''}
        </div>` : ''}
    </div>`;
  }).join('');
}

function composeHtml(preset = {}) {
  const users = allUsers().filter((u) => u.email !== state.email);
  return `<form class="pm-compose" id="pm-compose" onsubmit="return false">
    <div class="pm-row">
      <label>${t('pmKind')}<select name="kind">
        <option value="msg"${preset.kind !== 'access' ? ' selected' : ''}>${t('pmKindMsg')}</option>
        <option value="access"${preset.kind === 'access' ? ' selected' : ''}>${t('pmKindAccess')}</option></select></label>
      <label>${t('pmTo')}<select name="to">
        <option value="all"${preset.to === 'all' ? ' selected' : ''}>${t('pmToAll')}</option>
        <option value="admins"${preset.to === 'admins' ? ' selected' : ''}>${t('pmToAdmins')}</option>
        ${users.map((u) => `<option value="${h(u.email)}"${preset.to === u.email ? ' selected' : ''}>${h(u.name)}${u.role === 'admin' ? ` (${h(t('admin'))})` : ''}</option>`).join('')}
      </select></label>
      <label class="grow">${t('pmSubject')}<input name="subject" value="${h(preset.subject || '')}"></label>
    </div>
    <textarea name="text" rows="4" placeholder="${h(t('pmTextPh'))}"></textarea>
    <p class="hint-line pm-access-hint"${preset.kind === 'access' ? '' : ' hidden'}>${t('pmAccessHint')}</p>
    <div class="pm-row"><span class="spacer"></span>
      <button type="button" class="btn" id="pm-cancel">${t('cancelBtn')}</button>
      <button type="button" class="btn primary" id="pm-send">${t('pmSend')}</button></div>
  </form>`;
}

// ---------- To Do ----------
function plusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const mineTo = (x) => String(x.assigned_to || '').toLowerCase() === state.email;
const open = (x) => (x.status || 'open') !== 'done';
const due = (x) => !x.remind_at || String(x.remind_at) <= todayIso();

/** וויפיל משימות דארף איך יעצט טאן (נישט געטאן, נישט אפגעלייגט). */
export function tasksDueCount() {
  return state.tasks.filter((x) => mineTo(x) && open(x) && due(x)).length;
}

function taskRow(x, kind) {
  const from = String(x.from_email || '').toLowerCase();
  const c = x.contact_id ? ui.contactById?.(x.contact_id) : null;
  return `<div class="td-row${open(x) ? '' : ' done'}" data-task="${h(x.task_id)}">
    ${kind === 'mine' ? `<button type="button" class="td-check" data-done title="${h(t('tdDone'))}">✓</button>` : ''}
    <div class="td-main">
      <div class="td-text">${h(x.text)}</div>
      <div class="muted small">
        ${kind === 'mine' && from && from !== state.email ? `${h(t('tdFrom', { name: displayName(from) }))} · ` : ''}
        ${kind === 'sent' ? `→ ${h(displayName(x.assigned_to))} · ${h(open(x) ? t('tdOpen') : t('tdDoneBy', { name: displayName(x.done_by), date: x.done_at }))} · ` : ''}
        ${kind === 'later' ? `⏰ ${h(x.remind_at)} · ` : ''}
        ${kind === 'done' ? `✓ ${h(x.done_at || '')} · ` : ''}
        ${c ? `<a href="#" data-card="${h(c.contact_id)}">${h(ui.fullNameHe(c))}</a> · ` : ''}
        ${h(String(x.created_at || '').slice(0, 10))}
      </div>
    </div>
    <div class="td-btns">
      ${kind === 'mine' ? `<button type="button" class="btn small-btn" data-week>${t('tdWeek')}</button>
        <button type="button" class="btn small-btn primary" data-done>${t('tdDone')}</button>` : ''}
      ${kind === 'later' ? `<button type="button" class="btn small-btn" data-now>${t('tdNow')}</button>` : ''}
      ${kind === 'done' ? `<button type="button" class="btn small-btn" data-reopen>${t('tdReopen')}</button>` : ''}
      ${String(x.created_by || '').toLowerCase() === state.email ? `<button type="button" class="linkish" data-del title="${h(t('deleteBtn'))}">✕</button>` : ''}
    </div>
  </div>`;
}

function todoHtml() {
  const users = allUsers();
  const mineNow = state.tasks.filter((x) => mineTo(x) && open(x) && due(x))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const later = state.tasks.filter((x) => mineTo(x) && open(x) && !due(x))
    .sort((a, b) => String(a.remind_at).localeCompare(String(b.remind_at)));
  const sent = state.tasks.filter((x) => String(x.from_email || '').toLowerCase() === state.email && !mineTo(x))
    .sort((a, b) => Number(open(b)) - Number(open(a)) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 30);
  const done = state.tasks.filter((x) => mineTo(x) && !open(x))
    .sort((a, b) => String(b.done_at).localeCompare(String(a.done_at))).slice(0, 20);
  return `<section class="pm-section">
    <div class="pm-title"><h3>☑ To Do ${mineNow.length ? `<span class="count-pill">${mineNow.length}</span>` : ''}</h3></div>
    <form class="td-add" id="td-add" onsubmit="return false">
      <input name="text" placeholder="${h(t('tdAddPh'))}" autocomplete="off">
      <select name="to">
        <option value="${h(state.email)}">${h(t('tdForMe'))}</option>
        ${users.filter((u) => u.email !== state.email).map((u) => `<option value="${h(u.email)}">→ ${h(u.name)}</option>`).join('')}
      </select>
      <select name="when">
        <option value="">${t('tdWhenNow')}</option>
        <option value="1">${t('tdWhenTomorrow')}</option>
        <option value="7">${t('tdWhenWeek')}</option>
        <option value="30">${t('tdWhenMonth')}</option>
      </select>
      <button type="button" class="btn primary" id="td-add-btn">${t('admAdd')}</button>
    </form>
    <div class="td-list">${mineNow.map((x) => taskRow(x, 'mine')).join('') || `<p class="empty">${t('tdEmpty')}</p>`}</div>
    ${later.length ? `<details class="td-more"><summary>⏰ ${t('tdLater')} (${later.length})</summary>${later.map((x) => taskRow(x, 'later')).join('')}</details>` : ''}
    ${sent.length ? `<details class="td-more"><summary>→ ${t('tdSentTo')} (${sent.filter(open).length}/${sent.length})</summary>${sent.map((x) => taskRow(x, 'sent')).join('')}</details>` : ''}
    ${done.length ? `<details class="td-more"><summary>✓ ${t('tdDoneList')} (${done.length})</summary>${done.map((x) => taskRow(x, 'done')).join('')}</details>` : ''}
  </section>`;
}

async function saveTask(task, msg) {
  await saveRecord('Tasks', 'task_id', task);
  await reloadMessages();
  ui.updateBadges?.();
  if (msg) ui.toast(msg);
  renderPersonal();
}

async function todoClick(e) {
  if (e.target.closest('#td-add-btn')) { await addTask(); return true; }
  const row = e.target.closest('[data-task]');
  if (!row) return false;
  const x = state.tasks.find((y) => String(y.task_id) === row.dataset.task);
  if (!x) return false;
  try {
    if (e.target.closest('[data-done]')) { await saveTask({ ...x, status: 'done', done_at: nowStamp(), done_by: state.email }, t('tdDoneToast')); return true; }
    if (e.target.closest('[data-week]')) { await saveTask({ ...x, remind_at: plusDays(7) }, t('tdWeekToast', { date: plusDays(7) })); return true; }
    if (e.target.closest('[data-now]')) { await saveTask({ ...x, remind_at: '' }); return true; }
    if (e.target.closest('[data-reopen]')) { await saveTask({ ...x, status: 'open', done_at: '', done_by: '' }); return true; }
    if (e.target.closest('[data-del]')) {
      if (!confirm(t('tdConfirmDelete'))) return true;
      await deleteRecord('Tasks', 'task_id', x);
      await reloadMessages();
      renderPersonal();
      return true;
    }
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); return true; }
  return false;
}

async function addTask() {
  const f = $('#td-add').elements;
  const text = f.text.value.trim();
  if (!text) { f.text.focus(); return; }
  const days = Number(f.when.value || 0);
  try {
    await saveTask({
      task_id: '', text, assigned_to: f.to.value, from_email: state.email, status: 'open',
      remind_at: days ? plusDays(days) : '', done_at: '', done_by: '', contact_id: '',
    }, f.to.value === state.email ? t('tdAdded') : t('tdSentToast', { name: displayName(f.to.value) }));
    $('#td-add [name=text]')?.focus();
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}

// ---------- דער בלאט ----------
export function renderPersonal(composePreset = null) {
  const main = $('#personal-main');
  if (!main) return;
  const me = allUsers().find((u) => u.email === state.email);
  const myLists = state.savedLists.filter((l) => String(l.created_by || '').toLowerCase() === state.email)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const mine = (x) => String(x || '').toLowerCase() === state.email;
  const contacts = state.contacts.filter((c) => mine(c.created_by) || mine(c.updated_by))
    .map((c) => ({ c, when: (mine(c.updated_by) ? c.updated_at : c.created_at) || '', added: mine(c.created_by) && (!c.updated_at || c.updated_at === c.created_at) }))
    .sort((a, b) => String(b.when).localeCompare(String(a.when))).slice(0, 100);
  const donations = state.donations.filter((d) => mine(d.created_by))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100);
  const unread = unreadCount();

  main.innerHTML = `
    <div class="camp-page-head">
      <div><h2>👤 ${h(displayName(state.email))}</h2>
        <p class="muted">${h(state.email)} · ${h(state.isAdmin ? t('admin') : (me?.role === 'gabbai' ? t('pmGabbai') : t('pmUser')))}</p>
        ${isDatabaseAccount() ? (hasDriveScope() ? `<p class="drive-ok">✓ ${t('driveConnected')}</p>`
          : `<p class="drive-warn">${t('driveNeedConnect')} <button type="button" class="btn small-btn primary" id="pm-connect-drive">🔗 ${t('driveConnectBtn')}</button></p>`) : ''}</div>
    </div>

    ${todoHtml()}

    <section class="pm-section">
      <div class="pm-title">
        <h3>${t('pmMessages')} ${unread ? `<span class="count-pill">${unread}</span>` : ''}</h3>
        <div class="pm-tabs">
          <button type="button" class="${box === 'inbox' ? 'on' : ''}" data-box="inbox">${t('pmInbox')}</button>
          <button type="button" class="${box === 'sent' ? 'on' : ''}" data-box="sent">${t('pmSent')}</button>
        </div>
        <span class="spacer"></span>
        <button type="button" class="btn" id="pm-new-access">🔑 ${t('pmKindAccess')}</button>
        <button type="button" class="btn primary" id="pm-new">${t('pmNew')}</button>
      </div>
      <div id="pm-compose-box">${composePreset ? composeHtml(composePreset) : ''}</div>
      <div class="pm-list">${messageList()}</div>
    </section>

    <section class="pm-section">
      <div class="pm-title"><h3>${t('pmMyLists')}</h3><span class="spacer"></span>
        <button type="button" class="btn" id="pm-all-lists">${t('allLists')}</button>
        <button type="button" class="btn primary" id="pm-new-list">${t('newList')}</button></div>
      <p class="hint-line">${t('pmListsHint')}</p>
      ${myLists.length ? `<div class="pm-lists">${myLists.map((l) => `<button type="button" class="lo-tpl" data-list="${h(l.list_id)}">
        <b>${l.visibility === 'private' ? '🔒 ' : '🌐 '}${h(l.name)}</b>
        <span class="muted small">${h(l.visibility === 'private' ? t('lbPrivate') : t('lbPublic'))} · ${h(l.updated_at || '')}</span></button>`).join('')}</div>`
        : `<p class="empty">${t('noSavedLists')}</p>`}
    </section>

    <div class="pm-cols">
      <section class="pm-section">
        <h3>${t('pmMyContacts')} <span class="muted small">(${contacts.length})</span></h3>
        <div class="list compact">${contacts.map(({ c, when, added }) => `<button type="button" class="row" data-card="${h(c.contact_id)}">
          <span class="row-main"><span class="row-name">${h(ui.fullNameHe(c))}</span>
          <span class="muted small">${h(added ? t('pmAdded') : t('pmChanged'))} · ${h(when)}</span></span></button>`).join('') || `<p class="empty">${t('pmNothing')}</p>`}</div>
      </section>
      <section class="pm-section">
        <h3>${t('pmMyDonations')} <span class="muted small">(${donations.length} · ${money(donations.reduce((s, d) => s + Number(d.amount_usd || 0), 0))})</span></h3>
        <div class="list compact">${donations.map((d) => `<button type="button" class="row" data-don="${h(d.donation_id)}">
          <span class="row-main"><span class="row-name">${h(donorName(d))}</span>
          <span class="muted small">${h(d.campaign || splitTags(d.event_tags).join(', '))} · ${h(d.created_at || '')}</span></span>
          <span class="don-amount">${money(d.amount_usd)}</span></button>`).join('') || `<p class="empty">${t('pmNothing')}</p>`}</div>
      </section>
    </div>`;
  wire(main);
}

function wire(main) {
  main.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.closest('#td-add') && e.target.name === 'text') { e.preventDefault(); addTask(); }
  };
  main.onclick = async (e) => {
    const cardLink = e.target.closest('a[data-card]');
    if (cardLink) { e.preventDefault(); ui.openCard(cardLink.dataset.card); return; }
    if (await todoClick(e)) return;
    const tab = e.target.closest('[data-box]');
    if (tab) { box = tab.dataset.box; openMsg = ''; renderPersonal(); return; }
    if (e.target.closest('#pm-new')) { renderPersonal({ kind: 'msg', to: 'all' }); $('#pm-compose textarea').focus(); return; }
    if (e.target.closest('#pm-new-access')) { renderPersonal({ kind: 'access', to: 'admins', subject: t('pmAccessSubject') }); $('#pm-compose textarea').focus(); return; }
    if (e.target.closest('#pm-cancel')) { renderPersonal(); return; }
    if (e.target.closest('#pm-send')) { await send(); return; }
    if (e.target.closest('#pm-connect-drive')) {
      connectDrive().then(() => { ui.toast(t('driveConnected')); renderPersonal(); }).catch((err) => ui.toast(ui.friendlyError(err), 'error'));
      return;
    }
    if (e.target.closest('#pm-new-list')) { openBuilder(); return; }
    if (e.target.closest('#pm-all-lists')) { openOverview(); return; }
    const lst = e.target.closest('[data-list]');
    if (lst) { openBuilder(state.savedLists.find((l) => String(l.list_id) === lst.dataset.list)); return; }
    const card = e.target.closest('[data-card]');
    if (card) { ui.openCard(card.dataset.card); return; }
    const don = e.target.closest('[data-don]');
    if (don) { openDonationForm(state.donations.find((d) => String(d.donation_id) === don.dataset.don)); return; }
    const reply = e.target.closest('[data-reply]');
    if (reply) {
      const m = state.messages.find((x) => String(x.msg_id) === reply.dataset.reply);
      renderPersonal({ kind: 'msg', to: String(m.from_email).toLowerCase(), subject: m.subject ? `Re: ${m.subject.replace(/^Re: /, '')}` : '' });
      $('#pm-compose textarea').focus();
      return;
    }
    const decide = e.target.closest('[data-decide]');
    if (decide) { await decideRequest(decide.dataset.decide); return; }
    const msg = e.target.closest('.pm-msg');
    if (msg && !e.target.closest('button')) {
      openMsg = String(openMsg) === msg.dataset.msg ? '' : msg.dataset.msg;
      const m = state.messages.find((x) => String(x.msg_id) === msg.dataset.msg);
      if (openMsg && box === 'inbox' && !isRead(m)) await markRead(m);
      renderPersonal();
    }
  };
  main.onchange = (e) => {
    if (e.target.name === 'kind') {
      const access = e.target.value === 'access';
      $('.pm-access-hint', main).hidden = !access;
      if (access) {
        $('#pm-compose [name=to]').value = 'admins';
        if (!$('#pm-compose [name=subject]').value) $('#pm-compose [name=subject]').value = t('pmAccessSubject');
      }
    }
  };
}

async function send() {
  const f = $('#pm-compose').elements;
  const text = f.text.value.trim();
  if (!text) { ui.toast(t('pmTextRequired'), 'error'); f.text.focus(); return; }
  const btn = $('#pm-send');
  btn.disabled = true;
  try {
    await saveRecord('Messages', 'msg_id', {
      msg_id: '', from_email: state.email, to_email: f.to.value, kind: f.kind.value,
      subject: f.subject.value.trim(), text, status: f.kind.value === 'access' ? 'open' : '', read_by: '',
    });
    await reloadMessages();
    box = 'sent';
    ui.toast(t('pmSent2'));
    renderPersonal();
  } catch (err) {
    ui.toast(ui.friendlyError(err), 'error');
    btn.disabled = false;
  }
}

async function markRead(m) {
  try {
    await saveRecord('Messages', 'msg_id', { ...m, read_by: joinTags([...splitTags(m.read_by), state.email]) });
    await reloadMessages();
    lastUnread = unreadCount();
    ui.updateBadges?.();
  } catch { /* נישט וויכטיג */ }
}

/** א מנהל באשטעטיגט / לייגט אפ א בקשת גישה — און דער וואס האט געבעטן באקומט א תשובה. */
async function decideRequest(status) {
  const m = state.messages.find((x) => String(x.msg_id) === String(openMsg));
  if (!m) return;
  try {
    await saveRecord('Messages', 'msg_id', { ...m, status, read_by: joinTags([...splitTags(m.read_by), state.email]) });
    await saveRecord('Messages', 'msg_id', {
      msg_id: '', from_email: state.email, to_email: String(m.from_email).toLowerCase(), kind: 'msg',
      subject: `Re: ${m.subject || t('pmKindAccess')}`,
      text: t(status === 'approved' ? 'pmApprovedText' : 'pmDeclinedText'), status: '', read_by: '',
    });
    await reloadMessages();
    ui.toast(t(`pmStatus_${status}`));
    renderPersonal();
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}

export { loadAll };

// ---------- "+ משימה" פון א כרטיס פון א מענטש ----------
export function openTaskForContact(c) {
  const form = $('#task-form');
  const users = allUsers().filter((u) => u.email !== state.email);
  const name = ui.fullNameHe(c);
  form.innerHTML = `
    <button type="button" class="x-close" id="tk-x" aria-label="${h(t('close'))}">✕</button>
    <h2>☑ ${h(t('taskAboutTitle'))}</h2>
    <p class="task-about">👤 <b>${h(name)}</b> <span class="muted small">#${h(c.contact_id)}</span></p>
    <label class="mm-l">${t('taskWhat')}
      <textarea name="text" rows="3" placeholder="${h(t('taskWhatPh'))}"></textarea></label>
    <div class="pm-row">
      <label>${t('taskWho')}<select name="to">
        <option value="${h(state.email)}">${h(t('tdForMe'))}</option>
        ${users.map((u) => `<option value="${h(u.email)}">→ ${h(u.name)}</option>`).join('')}
      </select></label>
      <label>${t('taskWhen')}<select name="when">
        <option value="">${t('tdWhenNow')}</option>
        <option value="1">${t('tdWhenTomorrow')}</option>
        <option value="7">${t('tdWhenWeek')}</option>
        <option value="30">${t('tdWhenMonth')}</option>
      </select></label>
    </div>
    <p class="hint-line">${t('taskHint')}</p>
    <div class="actions"><span class="spacer"></span>
      <button type="button" class="btn" id="tk-cancel">${t('cancelBtn')}</button>
      <button type="submit" class="btn primary" id="tk-save">${t('taskSave')}</button></div>`;
  const dlg = $('#task-dialog');
  const close = () => dlg.close();
  $('#tk-x', form).onclick = close;
  $('#tk-cancel', form).onclick = close;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = form.elements;
    const text = f.text.value.trim();
    if (!text) { f.text.focus(); return; }
    const days = Number(f.when.value || 0);
    $('#tk-save', form).disabled = true;
    try {
      await saveRecord('Tasks', 'task_id', {
        task_id: '', text, assigned_to: f.to.value, from_email: state.email, status: 'open',
        remind_at: days ? plusDays(days) : '', done_at: '', done_by: '', contact_id: String(c.contact_id),
      });
      await reloadMessages();
      ui.updateBadges?.();
      close();
      ui.toast(f.to.value === state.email ? t('taskAddedToast') : t('tdSentToast', { name: displayName(f.to.value) }));
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
      $('#tk-save', form).disabled = false;
    }
  };
  dlg.showModal();
  form.elements.text.focus();
}
