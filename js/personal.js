// איזור אישי: מעסעדזשעס צווישן די באנוצער, בקשות גישה (צו די מנהלים), מיינע פריוואטע רשימות,
// און אונטן צוויי קאלומס: די קאנטאקטן וואס איך האב צוגעלייגט / געטוישט, און די נדבות וואס איך האב אריינגעלייגט.
import {
  state, loadAll, saveRecord, reloadMessages, allUsers, displayName,
} from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, splitTags, joinTags } from './util.js';
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
        <p class="muted">${h(state.email)} · ${h(state.isAdmin ? t('admin') : (me?.role === 'gabbai' ? t('pmGabbai') : t('pmUser')))}</p></div>
    </div>

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
  main.onclick = async (e) => {
    const tab = e.target.closest('[data-box]');
    if (tab) { box = tab.dataset.box; openMsg = ''; renderPersonal(); return; }
    if (e.target.closest('#pm-new')) { renderPersonal({ kind: 'msg', to: 'all' }); $('#pm-compose textarea').focus(); return; }
    if (e.target.closest('#pm-new-access')) { renderPersonal({ kind: 'access', to: 'admins', subject: t('pmAccessSubject') }); $('#pm-compose textarea').focus(); return; }
    if (e.target.closest('#pm-cancel')) { renderPersonal(); return; }
    if (e.target.closest('#pm-send')) { await send(); return; }
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
