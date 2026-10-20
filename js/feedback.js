// "הערות פאר דער בויער" — א קנעפל וואס ווייזט זיך אומעטום (צייטווייליג, ביז דער בעל הבית נעמט עס אראפ).
// די גבאים שרייבן א פראבלעם / א תיקון; עס גייט אריין ווי א מעסעדזש (kind=feedback) צום בעל הבית, מיטן בלאט וואו מ'איז געווען.
import { state, saveRecord, reloadMessages, displayName } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const VIEWS = ['lobby', 'contacts', 'donhub', 'donations', 'campaign', 'occasions', 'simchos', 'school', 'lists', 'mailmerge', 'receipts', 'personal', 'admin'];
let ui = null;

const owner = () => String((state.rawSettings?.admin_email || [])[0] || '').trim().toLowerCase();
const viewNow = () => ($$('.view').find((v) => !v.hidden) || {}).dataset?.view || 'lobby';
const viewLabel = (v) => t(`fbView_${v}`) || v;
/** דער בלאט מיט דעם ארגון (ווען מ'איז אין א ביהמ"ד/כולל) */
function pageNow() {
  const v = viewNow();
  const sc = $('#scope-bar') && !$('#scope-bar').hidden ? ($('#scope-name')?.textContent || '').trim() : '';
  return { v, label: viewLabel(v) + (sc && v !== 'lobby' ? ` · ${sc}` : '') };
}

export function initFeedback(helpers) {
  ui = helpers;
  if ($('#fb-chat')) return;
  // נישט קיין "דיאלאג" — א פענצטערל אין ווינקל (ווי דער AI), וואס פארשפארט גארנישט
  const root = document.createElement('div');
  root.id = 'fb-chat'; root.className = 'fb-chat';
  root.innerHTML = `<section class="fb-panel" hidden>
      <header class="fb-head"><b>🛠 ${h(t('fbTitle'))}</b><span class="spacer"></span>
        <button type="button" class="fb-x" aria-label="${h(t('close'))}">✕</button></header>
      <form class="fb-form">
        <p class="muted small">${h(t('fbIntro'))}</p>
        <p class="fb-q"></p>
        <div class="fb-where">
          <label class="chip-radio"><input type="radio" name="where" value="this" checked> ${h(t('fbYes'))}</label>
          <label class="chip-radio"><input type="radio" name="where" value="other"> ${h(t('fbOther'))}</label>
          <select name="page" hidden>${VIEWS.map((v) => `<option value="${v}">${h(viewLabel(v))}</option>`).join('')}
            <option value="general">${h(t('fbGeneral'))}</option></select>
        </div>
        <textarea name="text" rows="4" dir="auto" placeholder="${h(t('fbPh'))}"></textarea>
        <div class="fb-done muted small" hidden>✓ ${h(t('fbThanks'))}</div>
        <div class="fb-actions"><button type="submit" class="btn primary">${h(t('fbSend'))}</button></div>
      </form>
    </section>
    <button type="button" class="fb-btn">🛠 <span>${h(t('fbBtn'))}</span></button>`;
  ($('#app-view') || document.body).append(root);
  const panel = $('.fb-panel', root); const f = $('.fb-form', root);
  let page = null;
  const openIt = () => {
    page = pageNow();
    $('.fb-q', root).innerHTML = `${h(t('fbOnPage'))} <b>${h(page.label)}</b>. ${h(t('fbAboutThis'))}`;
    f.elements.page.value = page.v;
    panel.hidden = false; root.classList.add('open');
    f.elements.text.focus();
  };
  $('.fb-btn', root).onclick = () => { if (panel.hidden) openIt(); else { panel.hidden = true; root.classList.remove('open'); } };
  $('.fb-x', root).onclick = () => { panel.hidden = true; root.classList.remove('open'); };
  $$('input[name=where]', f).forEach((r) => { r.onchange = () => { f.elements.page.hidden = f.elements.where.value !== 'other'; }; });
  f.elements.text.oninput = () => { $('.fb-done', root).hidden = true; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const text = f.elements.text.value.trim();
    if (!text) { ui.toast(t('pmTextRequired'), 'error'); f.elements.text.focus(); return; }
    const where = f.elements.where.value === 'this' ? page.label
      : (f.elements.page.value === 'general' ? t('fbGeneral') : viewLabel(f.elements.page.value));
    const b = $('[type=submit]', f); b.disabled = true;
    try {
      await saveRecord('Messages', 'msg_id', {
        msg_id: '', from_email: state.email, to_email: owner(), kind: 'feedback',
        subject: `🛠 ${where}`, text, status: '', read_by: '',
      });
      await reloadMessages();
      f.elements.text.value = '';
      ui.refreshBadges?.();
      $('.fb-done', root).hidden = false;
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    b.disabled = false;
  };
}

// ---------- אדמין: לשונית "הערות / תיקונים" (נאכן "בקשות פון די גבאים") ----------
const fbAll = () => (state.messages || []).filter((m) => m.kind === 'feedback');
const isDone = (m) => m.status === 'done';
export const openFeedbackCount = () => (state.isOwner ? fbAll().filter((m) => !isDone(m)).length : 0);

export function feedbackAdminHtml() {
  if (!state.isOwner) return '';
  const sortNew = (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || Number(b.msg_id) - Number(a.msg_id);
  const open = fbAll().filter((m) => !isDone(m)).sort(sortNew);
  const done = fbAll().filter(isDone).sort(sortNew);
  const row = (m) => `<div class="fb-item${isDone(m) ? ' done' : ''}" data-fb="${h(m.msg_id)}">
      <div class="fb-item-head"><b>${h(String(m.subject || '').replace(/^🛠\s*/, ''))}</b>
        <span class="muted small">· ${h(displayName(m.from_email))} · <bdi dir="ltr">${h(m.created_at || '')}</bdi></span>
        <span class="spacer"></span>
        <button type="button" class="btn small-btn${isDone(m) ? '' : ' primary'}" data-fb-do="${isDone(m) ? 'reopen' : 'done'}">${h(t(isDone(m) ? 'fbReopen' : 'fbMarkDone'))}</button></div>
      <div class="fb-item-text" dir="auto">${h(m.text || '').replace(/\n/g, '<br>')}</div>
    </div>`;
  return `<div class="adm-group" data-tab="feedback">
    <h3 class="adm-group-title">🛠 ${h(t('fbOpenTitle'))} <span class="muted small">(${open.length})</span></h3>
    ${open.length ? open.map(row).join('') : `<p class="empty">${h(t('fbNone'))}</p>`}
    ${done.length ? `<details class="rq-done"><summary>${h(t('fbDoneTitle', { n: done.length }))}</summary>${done.map(row).join('')}</details>` : ''}
  </div>`;
}

export function wireFeedbackAdmin(main, rerender) {
  $$('[data-fb-do]', main).forEach((b) => {
    b.onclick = async () => {
      const m = fbAll().find((x) => String(x.msg_id) === b.closest('[data-fb]').dataset.fb);
      if (!m) return;
      b.disabled = true;
      try {
        await saveRecord('Messages', 'msg_id', { ...m, status: b.dataset.fbDo === 'done' ? 'done' : '', read_by: state.email });
        await reloadMessages();
        ui?.refreshBadges?.();
        rerender();
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); b.disabled = false; }
    };
  });
}
