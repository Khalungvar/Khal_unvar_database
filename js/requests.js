// בקשות פון די גבאים: וואס א גבאי מעג נישט אליין טאן (נאר א מנהל), גייט אריין אלס בקשה (לשונית Requests).
// יעדער מנהל זעט זיי אין אדמין ← "בקשות פון די גבאים", און באשטעטיגט (דאן ווערט עס געטאן) אדער זאגט אפ.
// דער גבאי באקומט א מעסעדזש מיטן ענטפער, און זעט דעם סטאטוס אין זיין איזור אישי.
//
// א נייע סארט בקשה? צולייגן אין TYPES: { icon, label, apply(payload) }.
import {
  state, loadAll, saveRecord, displayName, addListValue, trashContact, deleteDonation, voidReceipt, mergeContactPair,
} from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, nowStamp } from './util.js';

let ui = null;
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function initRequests(helpers) { ui = helpers; }

const contactOf = (id) => state.contacts.find((c) => String(c.contact_id) === String(id));
const nameOf = (id) => { const c = contactOf(id); return c ? [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ') : `#${id}`; };

/** אלע סארטן בקשות. apply טוט דאס זאך (לויפט ביי דעם מנהל וואס באשטעטיגט). */
const TYPES = {
  tag: {
    icon: '🏷',
    label: 'rqTypeTag',
    apply: async (p) => {
      if ((state.lists[p.list] || []).includes(p.value)) return; // שוין דא
      await addListValue(p.list, p.value);
    },
  },
  delete_contact: {
    icon: '🗑',
    label: 'rqTypeDelContact',
    apply: async (p) => {
      const c = contactOf(p.contact_id);
      if (!c) throw new Error(t('rqGone'));
      await trashContact(c);
    },
  },
  delete_donation: {
    icon: '💲',
    label: 'rqTypeDelDonation',
    apply: async (p) => {
      const d = state.donations.find((x) => String(x.donation_id) === String(p.donation_id));
      if (!d) throw new Error(t('rqGone'));
      await deleteDonation(d);
    },
  },
  merge: {
    icon: '⇄',
    label: 'rqTypeMerge',
    apply: async (p) => {
      if (!contactOf(p.keep) || !contactOf(p.drop)) throw new Error(t('rqGone'));
      await mergeContactPair(p.keep, p.drop, p.contact, p.phones);
    },
  },
  list_access: {
    icon: '📋',
    label: 'rqTypeListAccess',
    apply: async (p) => { const { grantListAccess } = await import('./lists.js'); await grantListAccess(p); },
  },
  list_delete: {
    icon: '🗑',
    label: 'rqTypeListDelete',
    apply: async (p) => { const { deleteListById } = await import('./lists.js'); await deleteListById(p.list_id); },
  },
  list_ext: {
    icon: '👥',
    label: 'rqTypeListExt',
    apply: async (p) => { const { extToContacts } = await import('./lists.js'); await extToContacts(p.list_id); },
  },
  // ביטול: די קבלה (בטל) + די נדבות/מכירות (אויסגעמעקט; ספרים קומען צוריק אין מלאי)
  cancel_doc: {
    icon: '🗑',
    label: 'rqTypeCancelDoc',
    apply: async (p) => {
      if (p.receipt_no) await voidReceipt(p.receipt_no);
      for (const id of p.donation_ids || []) {
        const d = state.donations.find((x) => String(x.donation_id) === String(id));
        if (d) await deleteDonation(d);
      }
    },
  },
  delete_face_event: {
    icon: '📸',
    label: 'rqTypeDelFaceEvent',
    apply: async (p) => { const { deleteFaceEvent } = await import('./faces.js'); await deleteFaceEvent(p.event_id); },
  },
  void_receipt: {
    icon: '🧾',
    label: 'rqTypeVoid',
    apply: async (p) => voidReceipt(p.receipt_no),
  },
};

const parse = (r) => { try { return JSON.parse(r.payload || '{}'); } catch { return {}; } };
const keyOf = (type, payload) => `${type}|${JSON.stringify(payload)}`;

export function pendingRequests() {
  return (state.requests || []).filter((r) => (r.status || 'pending') === 'pending' && TYPES[r.type]);
}

/**
 * א גבאי בעט עפעס. summary = וואס דער מנהל וועט זען (קורץ). פרעגט פאר א סיבה (נישט געמוזט).
 * גיט צוריק true ווען די בקשה איז אוועקגעשיקט.
 */
export async function submitRequest(type, payload, summary) {
  if (!TYPES[type]) throw new Error(`unknown request ${type}`);
  const k = keyOf(type, payload);
  if (pendingRequests().some((r) => keyOf(r.type, parse(r)) === k)) { ui.toast(t('rqAlready')); return false; }
  const why = window.prompt(t('rqWhyPrompt', { what: summary }), '');
  if (why === null) return false;
  await saveRecord('Requests', 'request_id', {
    request_id: '', type, payload: JSON.stringify(payload), summary, status: 'pending',
    requested_by: state.email, requested_at: nowStamp(), decided_by: '', decided_at: '', decision_note: why.trim(),
  });
  await loadAll();
  ui.toast(t('rqSent'));
  ui.updateBadges?.();
  return true;
}

/** מנהל: באשטעטיגן (טוט דאס זאך) אדער אפזאגן. */
export async function decideRequest(r, status) { return decide(r, status); }

async function decide(r, status) {
  let note = '';
  if (status === 'declined') {
    const ans = window.prompt(t('rqDeclineWhy'), '');
    if (ans === null) return;
    note = ans.trim();
  }
  if (status === 'approved') await TYPES[r.type].apply(parse(r));
  await saveRecord('Requests', 'request_id', {
    ...r, status, decided_by: state.email, decided_at: nowStamp(),
    decision_note: [r.decision_note, note && `${displayName(state.email)}: ${note}`].filter(Boolean).join(' · '),
  });
  // א מעסעדזש צום גבאי
  try {
    await saveRecord('Messages', 'msg_id', {
      msg_id: '', from_email: state.email, to_email: String(r.requested_by).toLowerCase(), kind: 'msg',
      subject: `${TYPES[r.type].icon} ${r.summary}`,
      text: t(status === 'approved' ? 'rqMsgApproved' : 'rqMsgDeclined', { what: r.summary }) + (note ? `\n\n${note}` : ''),
      status: '', read_by: '',
    });
  } catch { /* דער מעסעדזש איז נישט קריטיש */ }
}

function statusBadge(s) {
  const cls = s === 'approved' ? 'paid' : s === 'declined' ? 'unpaid' : 'muted';
  return `<span class="badge ${cls}">${h(t(`rqStatus_${s || 'pending'}`))}</span>`;
}

function rowHtml(r, { actions = false, who = true } = {}) {
  const T = TYPES[r.type] || { icon: '•', label: '' };
  const p = parse(r);
  const link = p.contact_id && contactOf(p.contact_id) ? `<button type="button" class="linkish" data-rq-card="${h(p.contact_id)}">${h(nameOf(p.contact_id))}</button>` : '';
  return `<div class="rq-row" data-rq="${h(r.request_id)}">
    <span class="rq-icon">${T.icon}</span>
    <div class="rq-main">
      <div><b>${h(r.summary)}</b> ${link ? `· ${link}` : ''} ${actions ? '' : statusBadge(r.status)}</div>
      <div class="muted small">${h(t(T.label))}${who ? ` · ${h(displayName(r.requested_by))}` : ''} · <bdi dir="ltr">${h(r.requested_at || '')}</bdi>
        ${r.decided_by ? ` · ${h(t('rqDecidedBy', { name: displayName(r.decided_by) }))} <bdi dir="ltr">${h(r.decided_at || '')}</bdi>` : ''}</div>
      ${r.decision_note ? `<div class="rq-note">💬 ${h(r.decision_note)}</div>` : ''}
    </div>
    ${actions ? `<div class="rq-actions">
      <button type="button" class="btn small-btn primary" data-rq-do="approved">✓ ${h(t('rqApprove'))}</button>
      <button type="button" class="btn small-btn danger" data-rq-do="declined">✕ ${h(t('rqDecline'))}</button></div>` : ''}
  </div>`;
}

/** דער אינהאלט פון דער לשונית אין אדמין. */
export function requestsAdminHtml() {
  const pend = pendingRequests().sort((a, b) => String(a.requested_at).localeCompare(String(b.requested_at)));
  const done = (state.requests || []).filter((r) => r.status && r.status !== 'pending').slice(-30).reverse();
  const access = state.messages.filter((m) => m.kind === 'access' && (m.status || 'open') === 'open');
  return `<div class="adm-group" data-tab="requests">
    <h3 class="adm-group-title">${h(t('rqPending'))} <span class="muted small">(${pend.length})</span></h3>
    ${pend.length ? `<div class="rq-list">${pend.map((r) => rowHtml(r, { actions: true })).join('')}</div>` : `<p class="empty">${h(t('rqNone'))}</p>`}
    ${access.length ? `<p class="drive-warn">🔑 ${h(t('rqAccessMsgs', { n: access.length }))} <button type="button" class="btn small-btn" id="rq-open-pm">${h(t('rqOpenPm'))}</button></p>` : ''}
    ${done.length ? `<details class="rq-done"><summary>${h(t('rqHistory', { n: done.length }))}</summary><div class="rq-list">${done.map((r) => rowHtml(r)).join('')}</div></details>` : ''}
    <p class="hint-line">${h(t('rqHowTo'))}</p>
  </div>`;
}

export function wireRequestsAdmin(main, rerender) {
  $$('[data-rq-do]', main).forEach((b) => {
    b.onclick = async () => {
      const id = b.closest('[data-rq]').dataset.rq;
      const r = state.requests.find((x) => String(x.request_id) === id);
      if (!r) return;
      if (b.dataset.rqDo === 'approved' && !confirm(t('rqApproveConfirm', { what: r.summary }))) return;
      $$('[data-rq-do]', b.parentElement).forEach((x) => { x.disabled = true; });
      try {
        await decide(r, b.dataset.rqDo);
        await loadAll();
        ui.toast(t(b.dataset.rqDo === 'approved' ? 'rqDoneApproved' : 'rqDoneDeclined'));
        ui.refreshAll?.();
        ui.updateBadges?.();
        rerender();
      } catch (err) {
        ui.toast(ui.friendlyError(err), 'error');
        $$('[data-rq-do]', b.parentElement).forEach((x) => { x.disabled = false; });
      }
    };
  });
  wireCardLinks(main);
  const pm = main.querySelector('#rq-open-pm');
  if (pm) pm.onclick = () => ui.showView('personal');
}

function wireCardLinks(root) {
  $$('[data-rq-card]', root).forEach((b) => { b.onclick = () => ui.openCard(b.dataset.rqCard); });
}

/** אין איזור אישי: מיינע בקשות און זייער סטאטוס. */
export function myRequestsHtml() {
  const mine = (state.requests || []).filter((r) => String(r.requested_by).toLowerCase() === state.email && TYPES[r.type]).slice(-15).reverse();
  if (!mine.length) return '';
  return `<section class="pm-section rq-mine"><h3>📨 ${h(t('rqMine'))}</h3><div class="rq-list">${mine.map((r) => rowHtml(r, { who: false })).join('')}</div></section>`;
}

export function wireMyRequests(root) { wireCardLinks(root); }
