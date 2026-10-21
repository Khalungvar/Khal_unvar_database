// "ארבעט" אין כרטיס: א פרייע שורה פאר יעדן ארבעט-פלאץ, מיט טעלעפאן / אימעיל / וועבזייטל / סטאטוס — נאר ווען מ'דארף.
// c.work = JSON [{ t: 'רואה חשבון · ABC', ph?, em?, web?, role?: 'owner'|'manager'|'employee' }]
// נאר פאר ווייזן — עס גייט נישט אריין אין SMS / אימעילס פון דער קהילה.
import { t } from './i18n.js';
import { escapeHtml as h } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const ROLES = ['owner', 'manager', 'employee'];
const roleLabel = (r) => (ROLES.includes(r) ? t(`work_${r}`) : '');
const EXTRAS = [['ph', '📞', 'tel'], ['em', '✉', 'email'], ['web', '🌐', 'url'], ['role', '👤', '']];

export function workOf(c) {
  try { const v = JSON.parse(String(c?.work || '') || '[]'); return Array.isArray(v) ? v.filter((x) => x && (x.t || x.ph || x.em || x.web)) : []; } catch { return []; }
}
export const workSearchText = (c) => workOf(c).map((x) => [x.t, x.em, x.web, roleLabel(x.role)].filter(Boolean).join(' ')).join(' ');

// ---------- כרטיס ----------
const webHref = (w) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);
export function workCardHtml(c) {
  const list = workOf(c);
  if (!list.length) return '';
  return `<section class="work-card"><h3>💼 ${h(t('workTitle'))}</h3>${list.map((x) => `<div class="work-line">
      <b dir="auto">${h(x.t || '')}</b>${x.role ? ` <span class="muted">· ${h(roleLabel(x.role))}</span>` : ''}
      ${x.ph ? `<a href="tel:${h(String(x.ph).replace(/[^\d+]/g, ''))}" dir="ltr">📞 ${h(x.ph)}</a>` : ''}
      ${x.em ? `<a href="mailto:${h(x.em)}" dir="ltr">✉ ${h(x.em)}</a>` : ''}
      ${x.web ? `<a href="${h(webHref(x.web))}" target="_blank" rel="noopener" dir="ltr">🌐 ${h(x.web)}</a>` : ''}</div>`).join('')}</section>`;
}

// ---------- טופס ----------
function extraField(k, x) {
  const v = x[k] || '';
  if (k === 'role') {
    return `<span class="work-x" data-k="role">👤 <select>${['', ...ROLES].map((r) => `<option value="${r}"${r === v ? ' selected' : ''}>${h(r ? roleLabel(r) : '—')}</option>`).join('')}</select><button type="button" class="linkish work-del" title="✕">✕</button></span>`;
  }
  const [, icon, type] = EXTRAS.find(([kk]) => kk === k);
  return `<span class="work-x" data-k="${k}">${icon} <input type="${type}" dir="ltr" value="${h(v)}"><button type="button" class="linkish work-del" title="✕">✕</button></span>`;
}
function itemHtml(x = {}) {
  return `<div class="work-item">
    <div class="work-top"><input class="work-t" dir="auto" value="${h(x.t || '')}" placeholder="${h(t('workPh'))}"><button type="button" class="linkish work-rm" title="${h(t('deleteBtn'))}">🗑</button></div>
    <div class="work-xs">${EXTRAS.filter(([k]) => x[k]).map(([k]) => extraField(k, x)).join('')}</div>
    <div class="work-adds">${EXTRAS.map(([k, icon]) => `<button type="button" class="linkish work-add"${x[k] ? ' hidden' : ''} data-add="${k}">+ ${icon} ${h(t(`work_add_${k}`))}</button>`).join('')}</div></div>`;
}
export function workFormHtml(c) {
  const list = workOf(c);
  return `<fieldset class="work-edit"><legend>💼 ${h(t('workTitle'))}</legend>
    <div class="work-items">${(list.length ? list : [{}]).map(itemHtml).join('')}</div>
    <button type="button" class="linkish work-more">+ ${h(t('workMore'))}</button></fieldset>`;
}
export function wireWorkForm(form) {
  const box = $('.work-edit', form);
  if (!box) return;
  box.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const it = add.closest('.work-item');
      $('.work-xs', it).insertAdjacentHTML('beforeend', extraField(add.dataset.add, {}));
      add.hidden = true;
      $('.work-xs > .work-x:last-child input, .work-xs > .work-x:last-child select', it)?.focus();
      return;
    }
    const del = e.target.closest('.work-del');
    if (del) {
      const x = del.closest('.work-x'); const it = del.closest('.work-item');
      $(`[data-add="${x.dataset.k}"]`, it).hidden = false; x.remove();
      return;
    }
    if (e.target.closest('.work-rm')) {
      const it = e.target.closest('.work-item');
      if ($$('.work-item', box).length > 1) it.remove();
      else { it.outerHTML = itemHtml({}); }
      return;
    }
    if (e.target.closest('.work-more')) {
      $('.work-items', box).insertAdjacentHTML('beforeend', itemHtml({}));
      $('.work-item:last-child .work-t', box).focus();
    }
  });
}
export function readWorkForm(form, original) {
  const box = $('.work-edit', form);
  if (!box) return original?.work || '';
  const out = $$('.work-item', box).map((it) => {
    const x = { t: $('.work-t', it).value.trim() };
    $$('.work-x', it).forEach((f) => { const v = ($('input, select', f).value || '').trim(); if (v) x[f.dataset.k] = v; });
    return x;
  }).filter((x) => x.t || x.ph || x.em || x.web);
  return out.length ? JSON.stringify(out) : '';
}
