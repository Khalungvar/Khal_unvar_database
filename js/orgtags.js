// תגיות נוספות: טעג'ס פאר יעדן ארגון באזונדער (למשל ישיבת בית שערים: "מחזור תשס"ה"),
// און די טעג'ס פון די אלטע רשימות (גרופע "אלטע רשימה"). נישט אויסגעמישט מיט די אלגעמיינע טעג'ס.
// אינעם קאנטאקט: org_tags = "ארגון: טעג; ארגון: טעג". די מעגליכע טעג'ס: לשונית Lists, קאלום org_tag ("ארגון: טעג").
import { state, addListValue } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, splitTags } from './util.js';

export const OLD_GROUP = 'אלטע רשימה';
const SEP = ': ';
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** "ארגון: טעג" → ['ארגון', 'טעג'] */
export function splitEntry(e) {
  const s = String(e || '').trim();
  const i = s.indexOf(':');
  return i < 0 ? ['', s] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}
export const entry = (org, tag) => `${org}${SEP}${tag}`;

/** c.org_tags → Map(ארגון → [טעג'ס]) */
export function parseOrgTags(v) {
  const m = new Map();
  String(v || '').split(';').map((x) => x.trim()).filter(Boolean).forEach((e) => {
    const [org, tag] = splitEntry(e);
    if (!org || !tag) return;
    if (!m.has(org)) m.set(org, []);
    if (!m.get(org).includes(tag)) m.get(org).push(tag);
  });
  return m;
}
export function serializeOrgTags(m) {
  return [...m].flatMap(([org, tags]) => tags.map((x) => entry(org, x))).join('; ');
}
/** צוויי וועלטן צוזאמען (פאר מערדזשן) */
export function mergeOrgTags(a, b) {
  const m = parseOrgTags(a);
  parseOrgTags(b).forEach((tags, org) => {
    if (!m.has(org)) m.set(org, []);
    tags.forEach((x) => { if (!m.get(org).includes(x)) m.get(org).push(x); });
  });
  return serializeOrgTags(m);
}

/** די טעג'ס וואס זענען שוין דא פאר א ארגון (פון דער רשימה) */
export function availableFor(org) {
  return (state.lists.org_tag || []).map(splitEntry).filter(([o]) => o === org).map(([, x]) => x);
}

/** אלע ארגונים וואס מ'קען קלייבן */
export function allOrgNames() {
  return [...new Set([...['beis_medrash', 'kollel', 'organization'].flatMap((n) => state.lists[n] || []), OLD_GROUP])];
}

/** וועלכע ארגונים צו ווייזן ביי א מענטש: וואו ער איז א מיטגליד + וואו ער האט שוין טעג'ס */
function groupsFor(c) {
  const member = ['beis_medrash', 'kollel', 'organization'].flatMap((n) => splitTags(c[n]));
  return [...new Set([...member, ...parseOrgTags(c.org_tags).keys()])];
}

export function orgTagsCount(c) {
  return [...parseOrgTags(c.org_tags).values()].reduce((s, a) => s + a.length, 0);
}

/** די לשונית אינעם כרטיס */
export function orgTagsPaneHtml(c) {
  const m = parseOrgTags(c.org_tags);
  if (!m.size) return `<p class="muted">${h(t('otNone'))}</p>`;
  return [...m].map(([org, tags]) => `<section class="ot-group${org === OLD_GROUP ? ' ot-old' : ''}">
    <h4>${h(org)}</h4><div class="tags">${tags.map((x) => `<span class="chip">${h(x)}</span>`).join('')}</div></section>`).join('');
}

/** דער טייל אינעם טופס: פאר יעדן ארגון — די טעג'ס צו קלייבן, + נייע טעג, + נאך א ארגון */
export function orgTagsFormHtml(c) {
  const m = parseOrgTags(c.org_tags);
  const groups = groupsFor(c);
  return `<fieldset class="ot-form"><legend>${h(t('otTitle'))}</legend>
    <p class="hint-line">${h(t('otHint'))}</p>
    <div class="ot-groups">${groups.map((org) => groupHtml(org, m.get(org) || [])).join('')}</div>
    <label class="ot-add">${h(t('otAddOrg'))} <select class="ot-add-org"><option value=""></option>${allOrgNames().filter((o) => !groups.includes(o)).map((o) => `<option>${h(o)}</option>`).join('')}</select></label>
  </fieldset>`;
}

function groupHtml(org, chosen) {
  const all = [...new Set([...availableFor(org), ...chosen])];
  return `<div class="ot-group" data-org="${h(org)}"><b>${h(org)}</b>
    <div class="tags">${all.map((x) => `<button type="button" class="chip toggle${chosen.includes(x) ? ' on' : ''}">${h(x)}</button>`).join('')}
      <button type="button" class="chip add">${h(t(state.isAdmin ? 'newTag' : 'newTagRequest'))}</button></div></div>`;
}

/** helpers = { toast, friendlyError, submitRequest } */
export function wireOrgTagsForm(form, helpers) {
  const box = form.querySelector('.ot-form');
  if (!box) return;
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if (b.classList.contains('toggle')) { b.classList.toggle('on'); form.dispatchEvent(new Event('input', { bubbles: true })); return; }
    if (!b.classList.contains('add')) return;
    const org = b.closest('.ot-group').dataset.org;
    const value = (window.prompt(t('otNewPrompt', { org })) || '').trim();
    if (!value) return;
    if (!state.isAdmin) {
      try { await helpers.submitRequest('tag', { list: 'org_tag', value: entry(org, value) }, t('rqSumTag', { value: entry(org, value) })); } catch (err) { helpers.toast(helpers.friendlyError(err), 'error'); }
      return;
    }
    try {
      if (!availableFor(org).includes(value)) await addListValue('org_tag', entry(org, value));
      const nb = document.createElement('button');
      nb.type = 'button'; nb.className = 'chip toggle on'; nb.textContent = value;
      b.before(nb);
      form.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) { helpers.toast(helpers.friendlyError(err), 'error'); }
  });
  box.querySelector('.ot-add-org').onchange = (e) => {
    const org = e.target.value;
    if (!org) return;
    box.querySelector('.ot-groups').insertAdjacentHTML('beforeend', groupHtml(org, []));
    e.target.querySelector(`option[value="${CSS.escape(org)}"]`)?.remove();
    [...e.target.options].find((o) => o.value === org)?.remove();
    e.target.value = '';
  };
}

export function readOrgTagsForm(form) {
  const m = new Map();
  $$('.ot-group[data-org]', form).forEach((g) => {
    const tags = $$('.chip.toggle.on', g).map((b) => b.textContent.trim());
    if (tags.length) m.set(g.dataset.org, tags);
  });
  return serializeOrgTags(m);
}
