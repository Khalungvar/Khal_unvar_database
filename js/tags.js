// עץ התגיות — איין סיסטעם פאר אלעס: מוסדות, תפקידים, חבורות, משפחה, רבנים, אלטע רשימות.
// לשונית TagTree: node_id, parent_id, name, sort, kind, applies, mirror.
//   kind "orgs:beis_medrash" (א שלב 1) → די קינדער (שלב 2) זענען די מוסדות פון דער רשימה (Lists) — "o:<נאמען>".
//   applies = "מוסד|מוסד" — דער ענף ווייזט זיך נאר אונטער די מוסדות (ליידיג = אלע).
//   mirror = node_id — די קינדער זענען די פון יענעם ענף (למשל רבני הביהמ"ד → די בתי מדרש).
// ביי א קאנטאקט: c.tags = JSON [{ p: [ids פון שלב 1 ביזן לעצטן], s: status, d: date, o?: 'f' (במקור לשעבר) }].
import { state, saveRecord, deleteRecord, loadAll, NESHEI_ORG } from './data.js';
import { batchUpdate } from './google.js';
import { t } from './i18n.js';
import { escapeHtml as h, nowStamp } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const STATUSES = [['va', 'פעיל מאוד'], ['sa', 'פעיל לפעמים'], ['fc', 'לשעבר · בקשר'], ['fn', 'לשעבר · שאינו בקשר']];
export const UNCHECKED = 'u';
export const MEMBER = ['va', 'sa'];
export const LIST_DEFAULT = ['va', 'sa', 'fc', 'u'];
export const BOCHURIM_ORG = 'חבורת הבחורים';
export const statusLabel = (s) => (s === UNCHECKED ? 'לא נבדק' : (STATUSES.find(([k]) => k === s) || [, ''])[1]);
const today = () => nowStamp().slice(0, 10);

// ---------- דער בוים ----------
const nodes = () => (state.tagTree || []).map((r) => ({
  id: String(r.node_id), parent: String(r.parent_id ?? '').trim(), name: String(r.name || '').trim(), sort: Number(r.sort) || 0,
  kind: String(r.kind || ''), applies: String(r.applies || '').split('|').map((x) => x.trim()).filter(Boolean), mirror: String(r.mirror ?? '').trim(), raw: r,
})).filter((n) => n.id && n.name);
const byId = () => new Map(nodes().map((n) => [n.id, n]));
const sorted = (xs) => xs.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'he'));
export const roots = () => sorted(nodes().filter((n) => !n.parent));
const orgCol = (n) => (n && n.kind.startsWith('orgs:') ? n.kind.slice(5) : '');
const isOrg = (id) => String(id).startsWith('o:');
const orgName = (id) => String(id).slice(2);

/** דער נאמען פון א שטיקל אינעם וועג */
export function nameOf(id) {
  if (isOrg(id)) return orgName(id);
  return byId().get(String(id))?.name || `#${id}`;
}
export const pathLabel = (p, from = 0) => p.slice(from).map(nameOf).join(' › ');
export const pathKey = (p) => p.join('>');

/** די קינדער פון א וועג (אין קאנטעקסט: מוסד, applies, mirror) */
export function childrenOf(path) {
  const map = byId();
  const last = String(path[path.length - 1]);
  const org = [...path].reverse().find(isOrg);
  const fits = (n) => !n.applies.length || (org && n.applies.includes(orgName(org)));
  if (isOrg(last)) {
    // א מוסד: די תפקידים פון דער גרופע (שלב 1) וואס פאסן פאר אים
    const group = path.length >= 2 ? map.get(String(path[path.length - 2])) : null;
    if (!group || !orgCol(group)) return [];
    return sorted(nodes().filter((n) => n.parent === group.id && fits(n))).map((n) => ({ id: n.id, name: n.name }));
  }
  const n = map.get(last);
  if (!n) return [];
  if (n.mirror) return childrenOf([n.mirror]);
  const col = orgCol(n);
  if (col && path.length === 1) return (state.lists[col] || []).filter(Boolean).map((v) => ({ id: `o:${v}`, name: v }));
  return sorted(nodes().filter((x) => x.parent === n.id && fits(x))).map((x) => ({ id: x.id, name: x.name }));
}

// ---------- די תגיות פון א קאנטאקט ----------
export function tagsOf(c) {
  try { const v = JSON.parse(c?.tags || '[]'); return Array.isArray(v) ? v.filter((x) => Array.isArray(x.p) && x.p.length) : []; } catch { return []; }
}
export const serialize = (list) => (list.length ? JSON.stringify(list) : '');
export const hasUnchecked = (c) => tagsOf(c).some((x) => x.s === UNCHECKED);
const startsWith = (p, prefix) => prefix.every((x, i) => String(p[i]) === String(x));

/** sel = { keys: ['1>o:...'], st: ['va',...] } */
export function matchesTagSel(c, sel) {
  if (!sel || !sel.keys || !sel.keys.length) return true;
  const st = sel.st && sel.st.length ? sel.st : LIST_DEFAULT;
  const prefixes = sel.keys.map((k) => k.split('>'));
  return tagsOf(c).some((x) => st.includes(x.s) && prefixes.some((pr) => startsWith(x.p.map(String), pr)));
}
/** וויפיל חברים (פעיל מאוד / לפעמים) אונטער א וועג */
export const memberCount = (prefix) => state.contacts.filter((c) => tagsOf(c).some((x) => MEMBER.includes(x.s) && startsWith(x.p.map(String), prefix.map(String)))).length;

/** די תגיות אונטער די מוסדות פון א סארט (beis_medrash/kollel/organization): [{ org, s }],
 *  אדער null ווען דער קאנטאקט האט נאך גארנישט קיין תגיות (דאן — די אלטע פעלדער) */
export function orgEntries(c, type) {
  if (!String(c?.tags || '').trim()) return null;
  const g = roots().find((r) => r.kind === `orgs:${type}`);
  if (!g) return null;
  return tagsOf(c).filter((x) => String(x.p[0]) === g.id && isOrg(x.p[1] || '')).map((x) => ({ org: orgName(x.p[1]), s: x.s }));
}
/** אמת'ע חברים (פעיל מאוד / לפעמים) פון א מוסד; value ליידיג = די גאנצע גרופע */
export function strictMember(c, type, value) {
  const tg = orgEntries(c, type);
  if (!tg) return null;
  return tg.some((x) => (!value || x.org === value) && MEMBER.includes(x.s));
}

// ---------- כרטיס: ווייזן ----------
const pill = (s) => `<span class="tg-pill tg-${h(s)}">${s === UNCHECKED ? '⚠ ' : ''}${h(statusLabel(s))}</span>`;
function blockOf(p) {
  const root = byId().get(String(p[0]));
  return orgCol(root) && p.length >= 2 ? { key: pathKey(p.slice(0, 2)), title: nameOf(p[1]), sub: root.name, from: 2 } : { key: String(p[0]), title: root?.name || nameOf(p[0]), sub: '', from: 1 };
}
export function cardTagsHtml(c) {
  const list = tagsOf(c);
  if (!list.length) return '';
  const blocks = new Map();
  list.forEach((x) => {
    const b = blockOf(x.p);
    if (!blocks.has(b.key)) blocks.set(b.key, { ...b, items: [] });
    blocks.get(b.key).items.push(x);
  });
  return `<section class="tg-card"><h3>🏷 ${h(t('tgTitle'))}${hasUnchecked(c) ? ` <span class="tg-warn">⚠ ${h(t('tgUnchecked'))}</span>` : ''}</h3>
    ${[...blocks.values()].map((b) => `<div class="tg-block"><b>${h(b.title)}</b>${b.sub ? ` <span class="muted small">${h(b.sub)}</span>` : ''}
      ${b.items.map((x) => `<div class="tg-line${x.s === UNCHECKED ? ' u' : ''}">${x.p.length > b.from ? h(pathLabel(x.p, b.from)) : ''} ${pill(x.s)}
        ${x.d && x.s !== UNCHECKED ? `<span class="muted small">${h(t('tgSince', { d: x.d }))}</span>` : ''}${x.o === 'f' ? ` <span class="muted small">(${h(t('tgOrigFormer'))})</span>` : ''}</div>`).join('')}</div>`).join('')}
  </section>`;
}

// ---------- טופס: רעדאגירן ----------
const stRadios = (key, cur, disabled = false) => `<span class="tg-st">${STATUSES.map(([k, l]) => `<label class="tg-r"><input type="radio" name="st|${h(key)}" value="${k}"${cur === k ? ' checked' : ''}${disabled ? ' disabled' : ''}> ${h(l)}</label>`).join('')}</span>`;

function nodeHtml(path, entries, depth) {
  const key = pathKey(path);
  const kids = childrenOf(path);
  const name = nameOf(path[path.length - 1]);
  const under = entries.filter((x) => startsWith(x.p.map(String), path.map(String)));
  const exact = entries.find((x) => pathKey(x.p) === key);
  if (!kids.length) {
    return `<div class="tg-leaf" data-key="${h(key)}"><label class="tg-cb"><input type="checkbox"${exact ? ' checked' : ''}> ${h(name)}</label>
      <span class="tg-stbox"${exact ? '' : ' hidden'}>${stRadios(key, exact?.s)}</span></div>`;
  }
  return `<div class="tg-branch" data-key="${h(key)}"><label class="tg-cb"><input type="checkbox"${under.length ? ' checked' : ''}> ${h(name)}</label>
    <div class="tg-kids"${under.length ? '' : ' hidden'}>${kids.map((k) => nodeHtml([...path, k.id], entries, depth + 1)).join('')}</div></div>`;
}

export function tagsEditorHtml(c) {
  const all = tagsOf(c);
  const regular = all.filter((x) => x.s !== UNCHECKED);
  const old = all.filter((x) => x.s === UNCHECKED);
  if (!roots().length) return '';
  return `<fieldset class="tg-edit"><legend>🏷 ${h(t('tgTitle'))}</legend>
    ${old.length ? `<div class="tg-old"><p class="tg-warn">⚠ ${h(t('tgOldHint'))}</p>
      ${old.map((x, i) => `<div class="tg-oldrow" data-old="${i}" data-key="${h(pathKey(x.p))}" data-p='${h(JSON.stringify(x.p))}' data-o="${h(x.o || '')}">
        <span class="tg-oldname">${h(pathLabel(x.p))}${x.o === 'f' ? ` <span class="muted small">(${h(t('tgOrigFormer'))})</span>` : ''}</span>
        ${stRadios(`old${i}`, '')}<button type="button" class="linkish tg-oldx" title="${h(t('deleteBtn'))}">✕</button></div>`).join('')}</div>` : ''}
    ${roots().map((r) => {
      const n = regular.filter((x) => String(x.p[0]) === r.id).length;
      return `<details class="tg-root"${n ? ' open' : ''}><summary>${h(r.name)}${n ? ` <span class="count-pill">${n}</span>` : ''}</summary>
        <div class="tg-kids">${childrenOf([r.id]).map((k) => nodeHtml([r.id, k.id], regular, 2)).join('') || `<p class="muted small">${h(t('tgEmptyBranch'))}</p>`}</div></details>`;
    }).join('')}
    <p class="hint-line">${h(t('tgHint'))}</p>
  </fieldset>`;
}

export function wireTagsEditor(form) {
  const box = $('.tg-edit', form);
  if (!box) return;
  box.addEventListener('change', (e) => {
    const cb = e.target.closest('.tg-cb input');
    if (cb) {
      const row = cb.closest('.tg-leaf, .tg-branch');
      if (row.classList.contains('tg-leaf')) {
        $('.tg-stbox', row).hidden = !cb.checked;
        if (!cb.checked) $$('input[type=radio]', row).forEach((r) => { r.checked = false; });
      } else {
        $('.tg-kids', row).hidden = !cb.checked;
        if (!cb.checked) $$('.tg-kids input', row).forEach((x) => { x.checked = false; });
        if (!cb.checked) $$('.tg-stbox', row).forEach((x) => { x.hidden = true; });
      }
      syncNeshei(form, 'tag');
    }
    if (e.target.matches('input[type=radio]')) { e.target.closest('.tg-leaf, .tg-oldrow')?.classList.remove('tg-missing'); syncNeshei(form, 'tag'); }
  });
  box.addEventListener('click', (e) => {
    const x = e.target.closest('.tg-oldx');
    if (x && confirm(t('tgOldDelConfirm'))) { x.closest('.tg-oldrow').remove(); form.dataset.dirty = '1'; }
  });
  const wb = form.elements.wife_in_neshei;
  if (wb) wb.addEventListener('change', () => syncNeshei(form, 'wife'));
}

/** נשי אונגוואר: דער ✓ ביי דער ווייב און די תגית — איינס צייכנט דאס צווייטע */
function nesheiRow(form) {
  return $$('.tg-edit .tg-leaf', form).find((r) => r.dataset.key.split('>').pop() === `o:${NESHEI_ORG}`);
}
function syncNeshei(form, from) {
  const row = nesheiRow(form); const wb = form.elements.wife_in_neshei;
  if (!row || !wb) return;
  const cb = $('.tg-cb input', row);
  if (from === 'wife') {
    cb.checked = wb.checked;
    $('.tg-stbox', row).hidden = !wb.checked;
    const va = $('input[value="va"]', row);
    if (wb.checked && !$('input[type=radio]:checked', row)) va.checked = true;
    if (!wb.checked) $$('input[type=radio]', row).forEach((r) => { r.checked = false; });
    // די עלטערן (חבורות) אויפמאכן
    let p = row.parentElement.closest('.tg-branch');
    while (p) { $('.tg-cb input', p).checked = true; $('.tg-kids', p).hidden = false; p = p.parentElement.closest('.tg-branch'); }
    if (wb.checked) row.closest('details.tg-root')?.setAttribute('open', '');
  } else {
    const st = $('input[type=radio]:checked', row)?.value;
    wb.checked = cb.checked && (!st || MEMBER.includes(st));
  }
}

/** לייענט די תגיות פונעם טופס. אויב עס פעלט א מצב → { error } */
export function readTagsEditor(form, original) {
  const box = $('.tg-edit', form);
  if (!box) return { tags: original?.tags || '' };
  const before = tagsOf(original);
  const prev = (key) => before.find((x) => pathKey(x.p) === key);
  const out = [];
  let missing = 0;
  $$('.tg-leaf', box).forEach((row) => {
    const cb = $('.tg-cb input', row);
    if (!cb.checked) return;
    // נאר ווען אלע עלטערן זענען אנגעצייכנט
    let p = row.parentElement.closest('.tg-branch'); let ok = true;
    while (p) { if (!$('.tg-cb input', p).checked) ok = false; p = p.parentElement.closest('.tg-branch'); }
    if (!ok) return;
    const st = $('input[type=radio]:checked', row)?.value;
    if (!st) { missing += 1; row.classList.add('tg-missing'); return; }
    const key = row.dataset.key; const old = prev(key);
    out.push({ p: key.split('>'), s: st, d: old && old.s === st ? old.d : today() });
  });
  $$('.tg-oldrow', box).forEach((row) => {
    const p = JSON.parse(row.dataset.p || '[]');
    const st = $('input[type=radio]:checked', row)?.value;
    if (out.some((x) => pathKey(x.p) === pathKey(p))) return; // שוין אויסגעקליבן אינעם בוים
    out.push(st ? { p, s: st, d: today() } : { p, s: UNCHECKED, ...(row.dataset.o ? { o: row.dataset.o } : {}) });
  });
  if (missing) return { error: t('tgPickStatus', { n: missing }) };
  return { tags: serialize(out) };
}

/** חבורת הבחורים: ווען א בחור ווערט נשוי/גרוש/אלמן → "לשעבר · בקשר" */
export function applyMaritalRule(contact, original) {
  const was = String(original?.marital_status || '');
  const now = String(contact.marital_status || '');
  if (!now || now === was || !['נשוי', 'גרוש', 'אלמן'].includes(now)) return;
  const list = tagsOf(contact);
  let changed = false;
  list.forEach((x) => {
    if (x.p.map(String).includes(`o:${BOCHURIM_ORG}`) && ['va', 'sa', UNCHECKED].includes(x.s)) { x.s = 'fc'; x.d = today(); delete x.o; changed = true; }
  });
  if (changed) contact.tags = serialize(list);
}

/** wife_in_neshei לויט דער תגית */
export function nesheiFromTags(contact) {
  const x = tagsOf(contact).find((e) => e.p.map(String).includes(`o:${NESHEI_ORG}`));
  if (x) contact.wife_in_neshei = ['va', 'sa', UNCHECKED].includes(x.s);
}

// ---------- אדמין: דער בוים ----------
let ui = null;
export function initTags(helpers) { ui = helpers; }

const usageOf = (id) => state.contacts.filter((c) => tagsOf(c).some((x) => x.p.map(String).includes(String(id)))).length;
function descendants(id) {
  const all = nodes(); const out = [];
  const walk = (pid) => all.filter((n) => n.parent === pid).forEach((n) => { out.push(n.id); walk(n.id); });
  walk(String(id));
  return out;
}

export function treeAdminHtml() {
  if (!state.isAdmin) return '';
  const orgsOf = (r) => state.lists[orgCol(r)] || [];
  const nodeRow = (n, level) => {
    const kids = sorted(nodes().filter((x) => x.parent === n.id));
    return `<li class="tt-node" data-id="${h(n.id)}"><div class="tt-row">
      <span class="tt-name">${h(n.name)}</span>
      ${n.applies.length ? `<span class="muted small">(${h(n.applies.join(', '))})</span>` : ''}
      ${n.mirror ? `<span class="muted small">→ ${h(nameOf(n.mirror))}</span>` : ''}
      <span class="muted small tt-use">${usageOf(n.id) || ''}</span>
      <span class="spacer"></span>
      <button type="button" class="linkish" data-tt="up" title="▲">▲</button><button type="button" class="linkish" data-tt="down" title="▼">▼</button>
      <button type="button" class="linkish" data-tt="rename">✎</button>
      ${level < 4 && !n.mirror ? `<button type="button" class="linkish" data-tt="add">＋</button>` : ''}
      ${level >= 3 || (level === 2 && n.parent && orgCol(byId().get(n.parent))) ? `<button type="button" class="linkish" data-tt="applies">${h(t('tgApplies'))}</button>` : ''}
      <button type="button" class="linkish danger" data-tt="del">🗑</button></div>
      ${kids.length ? `<ul>${kids.map((k) => nodeRow(k, level + 1)).join('')}</ul>` : ''}</li>`;
  };
  return `<div class="adm-group" data-tab="tags" id="tt-admin">
    <h3 class="adm-group-title">🏷 ${h(t('tgTreeTitle'))}</h3>
    <p class="hint-line">${h(t('tgTreeHint'))}</p>
    <ul class="tt-tree">${roots().map((r) => `<li class="tt-node tt-root" data-id="${h(r.id)}"><div class="tt-row"><b class="tt-name">${h(r.name)}</b>
        <span class="spacer"></span><button type="button" class="linkish" data-tt="up">▲</button><button type="button" class="linkish" data-tt="down">▼</button>
        <button type="button" class="linkish" data-tt="rename">✎</button><button type="button" class="linkish" data-tt="add">＋</button>
        <button type="button" class="linkish danger" data-tt="del">🗑</button></div>
      ${orgCol(r) ? `<p class="muted small tt-orgs">${h(t('tgOrgsFromLists'))}: ${h(orgsOf(r).join(' · '))}</p>` : ''}
      <ul>${sorted(nodes().filter((x) => x.parent === r.id)).map((k) => nodeRow(k, orgCol(r) ? 3 : 2)).join('')}</ul></li>`).join('')}</ul>
    <button type="button" class="btn small-btn" data-tt="addroot">＋ ${h(t('tgAddRoot'))}</button>
    ${state.isOwner ? `<div class="tt-mig"><h4>${h(t('tgMigTitle'))}</h4><p class="hint-line">${h(t('tgMigHint'))}</p>
      <button type="button" class="btn" data-tt="mig">${h(t('tgMigBtn'))}</button></div>` : ''}
  </div>`;
}

export function wireTreeAdmin(main, rerender) {
  const box = $('#tt-admin', main);
  if (!box) return;
  box.onclick = async (e) => {
    const b = e.target.closest('[data-tt]');
    if (!b) return;
    const act = b.dataset.tt;
    const id = b.closest('.tt-node')?.dataset.id;
    const n = id ? byId().get(id) : null;
    try {
      if (act === 'addroot' || act === 'add') {
        const name = prompt(t('tgNewName'));
        if (!name || !name.trim()) return;
        const parent = act === 'add' ? id : '';
        const sibs = nodes().filter((x) => x.parent === parent);
        await saveRecord('TagTree', 'node_id', { node_id: '', parent_id: parent, name: name.trim(), sort: sibs.length + 1, kind: '', applies: '', mirror: '' });
      } else if (act === 'rename') {
        const name = prompt(t('tgRename'), n.name);
        if (!name || !name.trim() || name.trim() === n.name) return;
        await saveRecord('TagTree', 'node_id', { ...n.raw, name: name.trim() });
      } else if (act === 'up' || act === 'down') {
        const sibs = sorted(nodes().filter((x) => x.parent === n.parent));
        const i = sibs.findIndex((x) => x.id === n.id); const j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= sibs.length) return;
        [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
        for (let k = 0; k < sibs.length; k += 1) if (Number(sibs[k].raw.sort) !== k + 1) await saveRecord('TagTree', 'node_id', { ...sibs[k].raw, sort: k + 1 });
      } else if (act === 'applies') {
        // פאר וועלכע מוסדות (ליידיג = אלע)
        let p = n; while (p && p.parent) p = byId().get(p.parent);
        const all = state.lists[orgCol(p)] || [];
        const cur = n.applies.join(', ');
        const v = prompt(t('tgAppliesPrompt', { list: all.join(', ') }), cur);
        if (v === null) return;
        const chosen = v.split(',').map((x) => x.trim()).filter(Boolean);
        const bad = chosen.filter((x) => !all.includes(x));
        if (bad.length) { ui.toast(t('tgAppliesBad', { list: bad.join(', ') }), 'error'); return; }
        await saveRecord('TagTree', 'node_id', { ...n.raw, applies: chosen.join('|') });
      } else if (act === 'mig') {
        const { planMigration, runMigration } = await import('./tagmigrate.js');
        const { plan, unknown, skipped } = planMigration();
        const n = plan.reduce((a, x) => a + x.tags.length, 0);
        const msg = t('tgMigConfirm', { people: plan.length, n, skip: skipped.hasTags }) + (unknown.length ? `\n\n${t('tgMigUnknown')}\n${unknown.slice(0, 15).map(([k, v]) => `${k} (${v})`).join('\n')}` : '');
        if (!plan.length) { ui.toast(t('tgMigNothing')); return; }
        if (!confirm(msg)) return;
        b.disabled = true;
        const done = await runMigration((i, all) => { b.textContent = `${i} / ${all}`; });
        ui.toast(t('tgMigDone', { n: done }));
      } else if (act === 'del') {
        const ids = [id, ...descendants(id)];
        const affected = state.contacts.filter((c) => tagsOf(c).some((x) => x.p.map(String).some((q) => ids.includes(q))));
        if (!confirm(t('tgDelConfirm', { name: n.name, n: affected.length }))) return;
        // אראפנעמען פון די קאנטאקטן
        const col = colLetter(state.headers.Contacts.indexOf('tags'));
        const data = affected.map((c) => ({ range: `Contacts!${col}${c._row}`, values: [[serialize(tagsOf(c).filter((x) => !x.p.map(String).some((q) => ids.includes(q))))]] }));
        for (let i = 0; i < data.length; i += 300) await batchUpdate(data.slice(i, i + 300));
        for (const d of ids) { const nn = byId().get(d); if (nn) await deleteRecord('TagTree', 'node_id', nn.raw); }
      } else return;
      await loadAll();
      rerender();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
}

function colLetter(i) {
  let s = ''; let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// ---------- רשימות: א בוים מיט ☑ ----------
export function tagSelHtml(sel = {}) {
  const keys = sel.keys || [];
  const st = sel.st && sel.st.length ? sel.st : LIST_DEFAULT;
  const item = (path) => {
    const key = pathKey(path); const kids = childrenOf(path);
    const open = keys.some((k) => k.startsWith(`${key}>`));
    return `<li><label class="check"><input type="checkbox" data-tgk="${h(key)}"${keys.includes(key) ? ' checked' : ''}> ${h(nameOf(path[path.length - 1]))}</label>
      ${kids.length ? `<details${open ? ' open' : ''}><summary class="muted small">▸</summary><ul>${kids.map((k) => item([...path, k.id])).join('')}</ul></details>` : ''}</li>`;
  };
  return `<div class="tg-sel"><ul class="tg-sel-tree">${roots().map((r) => item([r.id])).join('')}</ul>
    <div class="tg-sel-st"><span class="quick-label">${h(t('tgStatuses'))}</span>
      ${[...STATUSES, [UNCHECKED, statusLabel(UNCHECKED)]].map(([k, l]) => `<label class="check"><input type="checkbox" data-tgs="${k}"${st.includes(k) ? ' checked' : ''}> ${h(l)}</label>`).join('')}</div></div>`;
}
export function readTagSel(root) {
  return { keys: $$('[data-tgk]:checked', root).map((x) => x.dataset.tgk), st: $$('[data-tgs]:checked', root).map((x) => x.dataset.tgs) };
}
