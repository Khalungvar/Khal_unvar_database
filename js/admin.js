// עמוד אדמין: כל הרשימות של האתר במקום אחד — ארגונים, טעג'ס, אופני תשלום, טיטלען, געגנטן, קרבות, מנהלים.
// הכל נשמר בגליון (לשונית Lists / Settings). רק מנהל רואה את העמוד ויכול לשמור.
import { state, loadAll, saveListColumns, saveAdmins, rawListColumn } from './data.js';
import { t } from './i18n.js';
import { splitTags, escapeHtml as h } from './util.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * כל רשימה: cols = העמודות בגליון (הראשונה היא הערך; השאר מתאימות לה שורה-שורה),
 * locked = ערכים שהתוכנה משתמשת בהם בשמם — אי אפשר למחוק או לשנות.
 */
const GROUPS = [
  { title: 'admOrgs', lists: [
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
  const cols = def.cols.map((c) => rawListColumn(c));
  const n = Math.max(0, ...cols.map((c) => c.length));
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const r = def.cols.map((_, j) => String(cols[j][i] ?? ''));
    if (r[0].trim()) rows.push(r);
  }
  return rows;
}

function rowHtml(def, r) {
  const locked = (def.locked || []).includes(r[0]);
  const used = r[0] ? usage(def.cols[0], r[0]) : 0;
  return `<tr data-orig="${h(r[0])}">
    ${def.cols.map((c, j) => `<td><input data-col="${h(c)}" value="${h(r[j] || '')}" ${j === 0 && locked ? 'readonly title="' + h(t('admLocked')) + '"' : ''}
      ${j > 0 ? `placeholder="${h(t(def.sub[j - 1]))}" dir="${c === 'area_zips' || c.endsWith('_en') ? 'ltr' : 'auto'}"` : ''}></td>`).join('')}
    <td class="adm-used">${used ? h(t('admUsed', { n: used })) : ''}${locked ? ' 🔒' : ''}</td>
    <td class="adm-btns">
      <button type="button" class="linkish adm-up" title="↑">↑</button>
      <button type="button" class="linkish adm-down" title="↓">↓</button>
      ${locked ? '' : `<button type="button" class="linkish adm-del" title="${h(t('deleteBtn'))}">✕</button>`}
    </td>
  </tr>`;
}

function cardHtml(def, key) {
  return `<section class="adm-card" data-key="${key}">
    <h3>${h(t(def.label))} <span class="muted small">(${rowsOf(def).length})</span></h3>
    ${def.sub ? `<p class="hint-line">${def.sub.map((s) => h(t(s))).join(' · ')}</p>` : ''}
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
    + `<div class="adm-group"><h3 class="adm-group-title">${t('admAdmins')}</h3><div class="adm-grid">
        <section class="adm-card" data-key="admins">
          <h3>${t('admAdmins')}</h3>
          <p class="hint-line">${t('admAdminsHint')}</p>
          <table class="adm-table"><tbody>${(state.admins || []).map((e) => `<tr data-orig="${h(e)}"><td><input data-col="admin_email" dir="ltr" value="${h(e)}"></td>
            <td class="adm-used">${e === state.email ? h(t('admYou')) : ''}</td>
            <td class="adm-btns">${e === state.email ? '' : `<button type="button" class="linkish adm-del">✕</button>`}</td></tr>`).join('')}</tbody></table>
          <div class="adm-actions">
            <button type="button" class="btn small-btn adm-add">${t('admAdd')}</button>
            <span class="spacer"></span>
            <button type="button" class="btn small-btn primary adm-save" hidden>${t('saveBtn')}</button>
          </div>
        </section></div></div>`;

  $$('.adm-card', main).forEach((card) => wireCard(card, card.dataset.key === 'admins' ? null : defs[Number(card.dataset.key)]));
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
      const used = def ? usage(def.cols[0], tr.dataset.orig) : 0;
      if (used && !confirm(t('admDeleteUsed', { name: tr.dataset.orig, n: used }))) return;
      tr.remove();
      dirty();
    }
  });
  $('.adm-add', card).onclick = () => {
    if (def) body.insertAdjacentHTML('beforeend', rowHtml(def, def.cols.map(() => '')));
    else body.insertAdjacentHTML('beforeend', '<tr data-orig=""><td><input data-col="admin_email" dir="ltr" placeholder="name@gmail.com"></td><td></td><td class="adm-btns"><button type="button" class="linkish adm-del">✕</button></td></tr>');
    $$('tr', body).at(-1).querySelector('input').focus();
    dirty();
  };
  $('.adm-save', card).onclick = async () => {
    const rows = $$('tr', body).map((tr) => $$('input', tr).map((i) => i.value.trim())).filter((r) => r[0]);
    const firsts = rows.map((r) => r[0]);
    const dup = firsts.find((v, i) => firsts.indexOf(v) !== i);
    if (dup) { ui.toast(t('admDuplicate', { name: dup }), 'error'); return; }
    const renamed = $$('tr', body).some((tr) => tr.dataset.orig && $('input', tr).value.trim() !== tr.dataset.orig);
    if (renamed && !confirm(t('admRenameWarn'))) return;
    const btn = $('.adm-save', card);
    btn.disabled = true;
    btn.textContent = t('saving');
    try {
      if (def) {
        const columns = {};
        def.cols.forEach((c, j) => { columns[c] = rows.map((r) => r[j] || ''); });
        await saveListColumns(columns);
      } else {
        if (!firsts.includes(state.email)) firsts.unshift(state.email); // אי אפשר להוריד את עצמך
        await saveAdmins(firsts.map((e) => e.toLowerCase()));
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
}

/** האם יש בעמוד שינויים שלא נשמרו. */
export function adminDirty() {
  return $$('#admin-main .adm-card.dirty').length > 0;
}
