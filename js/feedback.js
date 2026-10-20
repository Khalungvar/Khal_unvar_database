// "הערות פאר דער בויער" — א קנעפל וואס ווייזט זיך אומעטום (צייטווייליג, ביז דער בעל הבית נעמט עס אראפ).
// די גבאים שרייבן א פראבלעם / א תיקון; עס גייט אריין ווי א מעסעדזש (kind=feedback) צום בעל הבית, מיטן בלאט וואו מ'איז געווען.
import { state, saveRecord, reloadMessages } from './data.js';
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
  if ($('#fb-btn')) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'fb-btn'; btn.className = 'fb-btn';
  btn.innerHTML = `🛠 <span>${h(t('fbBtn'))}</span>`;
  btn.onclick = openFeedback;
  ($('#app-view') || document.body).append(btn);
  const dlg = document.createElement('dialog');
  dlg.id = 'fb-dialog'; dlg.className = 'small';
  document.body.append(dlg);
}

function openFeedback() {
  const dlg = $('#fb-dialog');
  const p = pageNow();
  dlg.innerHTML = `<form method="dialog" id="fb-form" class="fb-form">
    <button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>🛠 ${h(t('fbTitle'))}</h2>
    <p class="muted small">${h(t('fbIntro'))}</p>
    <p class="fb-q">${h(t('fbOnPage'))} <b>${h(p.label)}</b>.<br>${h(t('fbAboutThis'))}</p>
    <div class="fb-where">
      <label class="chip-radio"><input type="radio" name="where" value="this" checked> ${h(t('fbYes'))}</label>
      <label class="chip-radio"><input type="radio" name="where" value="other"> ${h(t('fbOther'))}</label>
      <select name="page" hidden>${VIEWS.map((v) => `<option value="${v}"${v === p.v ? ' selected' : ''}>${h(viewLabel(v))}</option>`).join('')}
        <option value="general">${h(t('fbGeneral'))}</option></select>
    </div>
    <label class="wide">${h(t('fbWhat'))}<textarea name="text" rows="6" dir="auto" placeholder="${h(t('fbPh'))}"></textarea></label>
    <div class="actions"><button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="submit" class="btn primary">${h(t('fbSend'))}</button></div>
  </form>`;
  const f = $('#fb-form', dlg);
  $$('[data-close]', f).forEach((b) => { b.onclick = () => dlg.close(); });
  $$('input[name=where]', f).forEach((r) => { r.onchange = () => { f.elements.page.hidden = f.elements.where.value !== 'other'; }; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const text = f.elements.text.value.trim();
    if (!text) { ui.toast(t('pmTextRequired'), 'error'); f.elements.text.focus(); return; }
    const page = f.elements.where.value === 'this' ? p.label
      : (f.elements.page.value === 'general' ? t('fbGeneral') : viewLabel(f.elements.page.value));
    const b = $('[type=submit]', f); b.disabled = true;
    try {
      await saveRecord('Messages', 'msg_id', {
        msg_id: '', from_email: state.email, to_email: owner(), kind: 'feedback',
        subject: `🛠 ${page}`, text, status: '', read_by: '',
      });
      await reloadMessages();
      dlg.close();
      ui.toast(t('fbThanks'));
      ui.refreshBadges?.();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); b.disabled = false; }
  };
  dlg.showModal();
  f.elements.text.focus();
}
