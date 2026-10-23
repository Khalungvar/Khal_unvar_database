// עץ התגיות — איין סיסטעם פאר אלעס: מוסדות, תפקידים, חבורות, משפחה, רבנים, אלטע רשימות.
// לשונית TagTree: node_id, parent_id, name, sort, kind, applies, mirror.
//   kind "orgs:beis_medrash" (א שלב 1) → די קינדער (שלב 2) זענען די מוסדות פון דער רשימה (Lists) — "o:<נאמען>".
//   applies = "מוסד|מוסד" — דער ענף ווייזט זיך נאר אונטער די מוסדות (ליידיג = אלע).
//   mirror = node_id — די קינדער זענען די פון יענעם ענף (למשל רבני הביהמ"ד → די בתי מדרש).
// ביי א קאנטאקט: c.tags = JSON [{ p: [ids פון שלב 1 ביזן לעצטן], s: status, d: date, o?: 'f' (במקור לשעבר) }].
import { state, saveRecord, deleteRecord, loadAll, NESHEI_ORG } from './data.js';
import { batchUpdate } from './google.js';
import { effectiveOrg } from './scope.js';
import { t } from './i18n.js';
import { escapeHtml as h, nowStamp } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const STATUSES = [['a', 'פעיל'], ['f', 'יוצא']];
export const UNCHECKED = 'u';
export const MEMBER = ['a'];
export const LIST_DEFAULT = ['a', 'f', 'u'];
export const BOCHURIM_ORG = 'חבורת הבחורים';
const ST_OLD = { va: 'a', sa: 'a', fc: 'f', fn: 'f' }; // די פריערדיגע 4 מצבים → פעיל / יוצא
export const normSt = (s) => ST_OLD[s] || s;
export const statusLabel = (s) => (s === UNCHECKED ? 'לא נבדק' : (STATUSES.find(([k]) => k === normSt(s)) || [, ''])[1]);
const today = () => nowStamp().slice(0, 10);
const DONOR_YEARS = 5; // תורם: יוצא נאך 5 יאר אן א נדבה
/** די 3 גרופעס (שלב 0). "old" = אלטע רשימה — נישט קיין גרופע, נאר א ארכיון */
export const GROUPS = ['1', '2', '3'];
const groupName = (g) => t(`tgG${g}`);
// תפקידים וואס ווייזן זיך ביים נאמען (נאר ווען נישט יוצא)
const ROLE_MARKS = [[(p) => p.includes('13'), 'גבאי'], [(p) => p.includes('42'), 'צוות'], [(p) => p.includes('43'), 'ראש כולל'], [(p) => p.includes('60'), 'אנ"ש'], [(p) => p[0] === '7', 'רבנים']];

// ---------- דער בוים ----------
const DEF_GROUP = { 1: '1', 2: '1', 3: '1', 4: '3', 5: '2', 6: '2', 7: '3', 8: 'old', 9: '3', 14: '3' };
// דער בוים ווערט גערעכנט איינמאל פער "טיק" (א רענדער רופט עס טויזנטער מאל) — נאך דעם ווערט עס ווידער פריש
let nodesTick = null; let byIdTick = null;
const tickClear = () => { if (nodesTick || byIdTick) return; setTimeout(() => { nodesTick = null; byIdTick = null; }, 0); };
const nodes = () => { if (!nodesTick) { tickClear(); nodesTick = nodesCalc(); } return nodesTick; };
const nodesCalc = () => (state.tagTree || []).map((r) => ({
  id: String(r.node_id), parent: String(r.parent_id ?? '').trim(), name: String(r.name || '').trim(), sort: Number(r.sort) || 0,
  kind: String(r.kind || ''), applies: String(r.applies || '').split('|').map((x) => x.trim()).filter(Boolean), mirror: String(r.mirror ?? '').trim(),
  group: String(r.group ?? '').trim() || DEF_GROUP[r.node_id] || '3', raw: r,
})).filter((n) => n.id && n.name);
const byId = () => { if (!byIdTick) { tickClear(); byIdTick = new Map(nodes().map((n) => [n.id, n])); } return byIdTick; };
const sorted = (xs) => xs.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'he'));
const gRank = (g) => (g === 'old' ? 9 : Number(g) || 5);
export const roots = () => sorted(nodes().filter((n) => !n.parent)).sort((a, b) => gRank(a.group) - gRank(b.group));
export const groupRoots = (g) => roots().filter((r) => r.group === g);
const isArchive = (rootId) => byId().get(String(rootId))?.group === 'old';
const orgCol = (n) => (n && n.kind.startsWith('orgs:') ? n.kind.slice(5) : '');
const isOrg = (id) => String(id).startsWith('o:');
const orgName = (id) => String(id).slice(2);
/** אלע מוסדות (פאר תורמים / ידידים): ארגון הגג + בתי מדרש + כוללים + ארגונים */
const allOrgs = () => [...new Set(['umbrella_org', 'beis_medrash', 'kollel', 'organization'].flatMap((k) => state.lists[k] || []).filter(Boolean))];
const orgsOfCol = (col) => (col === 'all' ? allOrgs() : (state.lists[col] || []).filter(Boolean));

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
    const group = path.length >= 2 ? map.get(String(path[path.length - 2])) : null;
    if (!group || !orgCol(group)) return [];
    return sorted(nodes().filter((n) => n.parent === group.id && fits(n))).map((n) => ({ id: n.id, name: n.name }));
  }
  const n = map.get(last);
  if (!n) return [];
  if (n.mirror) return childrenOf([n.mirror]);
  const col = orgCol(n);
  if (col && path.length === 1) return orgsOfCol(col).map((v) => ({ id: `o:${v}`, name: v }));
  return sorted(nodes().filter((x) => x.parent === n.id && fits(x))).map((x) => ({ id: x.id, name: x.name }));
}

// ---------- די תגיות פון א קאנטאקט ----------
// א תגית: { p: [ids], s: 'a'|'f'|'u', d?: date, n?: 1 (נישט שיקן), o?: 'f' }
// s: 'auto' = נאר א "נישט שיקן" צייכן פאר אן אויטאמאטישן תורם
const parsed = new Map();
/** די תגיות וואס שטייען אין גיליון (פאר שפייכלערן) */
export function storedTags(c) {
  const raw = String(c?.tags || '');
  if (!raw) return [];
  if (!parsed.has(raw)) {
    let v = [];
    try { const j = JSON.parse(raw); v = Array.isArray(j) ? j.filter((x) => Array.isArray(x.p) && x.p.length) : []; } catch { v = []; }
    v = v.map((x) => ({ ...x, p: x.p.map(String), s: normSt(x.s) }));
    if (parsed.size > 20000) parsed.clear();
    parsed.set(raw, v);
  }
  return parsed.get(raw).map((x) => ({ ...x, p: [...x.p] }));
}
// אויטאמאטישע תורמים לויט די נדבות
let donorCache = { src: null, map: new Map() };
function donorMap() {
  if (donorCache.src === state.donations) return donorCache.map;
  const m = new Map(); // contact_id → Map(org → last date)
  const umb = (state.lists.umbrella_org || [])[0] || '';
  (state.donations || []).forEach((d) => {
    if (!d.contact_id) return;
    const org = effectiveOrg(d) || umb;
    if (!org) return;
    const date = String(d.date || d.paid_date || d.created_at || '').slice(0, 10);
    const cid = String(d.contact_id);
    if (!m.has(cid)) m.set(cid, new Map());
    if (!m.get(cid).has(org) || date > m.get(cid).get(org)) m.get(cid).set(org, date);
  });
  donorCache = { src: state.donations, map: m };
  return m;
}
const donorRoot = () => roots().find((r) => r.id === '9' || (r.kind === 'orgs:all' && r.name === 'תורמים'));
function autoDonors(c, stored) {
  const dr = donorRoot();
  const per = dr && donorMap().get(String(c?.contact_id));
  if (!per) return [];
  const limit = `${Number(today().slice(0, 4)) - DONOR_YEARS}${today().slice(4)}`;
  const out = [];
  per.forEach((last, org) => {
    const p = [dr.id, `o:${org}`];
    const key = pathKey(p);
    if (stored.some((x) => x.s !== 'auto' && pathKey(x.p).startsWith(key))) return; // מ'האט אים שוין מיט דער האנט
    const stub = stored.find((x) => x.s === 'auto' && pathKey(x.p) === key);
    out.push({ p, s: last && last >= limit ? 'a' : 'f', auto: last || '?', ...(stub?.n ? { n: 1 } : {}) });
  });
  return out;
}
/** אלע תגיות — די געשפייכלערטע פלוס די אויטאמאטישע תורמים */
export function tagsOf(c) {
  const st = storedTags(c);
  return [...st.filter((x) => x.s !== 'auto'), ...autoDonors(c, st)];
}
export const serialize = (list) => (list.length ? JSON.stringify(list.map((x) => { const o = { p: x.p, s: x.s }; if (x.d) o.d = x.d; if (x.n) o.n = 1; if (x.o) o.o = x.o; return o; })) : '');
// "⚠ לא נבדק": יעדער קאנטאקט ביז מ'זאגט "נבדק" (א סימן { p: ['_ok'] }). מ'קען עס נישט צוריקלייגן.
const OK = '_ok';
export const hasUnchecked = (c) => !storedTags(c).some((x) => x.p[0] === OK);
/** האט ער אמת'ע תגיות (נישט נאר דעם "נבדק" סימן)? */
export const hasRealTags = (c) => storedTags(c).some((x) => !String(x.p[0]).startsWith('_'));
/** "דער כרטיס איז נבדק": לא נבדק → פעיל (וואס איז געווען לשעבר → יוצא), און דער סימן */
export function markChecked(contact) {
  const list = storedTags(contact).filter((x) => x.p[0] !== OK);
  list.forEach((x) => { if (x.s === UNCHECKED) { x.s = x.o === 'f' ? 'f' : 'a'; x.d = today(); delete x.o; } });
  list.push({ p: [OK], s: 'ok', d: today() });
  contact.tags = serialize(list);
}
const startsWith = (p, prefix) => prefix.every((x, i) => String(p[i]) === String(x));

/** sel = { keys: ['1>o:...'], st: ['a',...], send: true } — send: בלויז די וואס מ'שיקט זיי */
export function matchesTagSel(c, sel) {
  if (!sel || !sel.keys || !sel.keys.length) return true;
  const st = sel.st && sel.st.length ? [...new Set(sel.st.map(normSt))] : LIST_DEFAULT;
  const prefixes = sel.keys.map((k) => k.split('>'));
  return tagsOf(c).some((x) => st.includes(x.s) && !(sel.send && x.n) && prefixes.some((pr) => startsWith(x.p, pr)));
}
/** וויפיל פעילים אונטער א וועג */
export const memberCount = (prefix) => state.contacts.filter((c) => tagsOf(c).some((x) => MEMBER.includes(x.s) && startsWith(x.p, prefix.map(String)))).length;

export function orgEntries(c, type) {
  if (!hasRealTags(c)) return null;
  const g = roots().find((r) => r.kind === `orgs:${type}`);
  if (!g) return null;
  return storedTags(c).filter((x) => x.p[0] === g.id && isOrg(x.p[1] || '')).map((x) => ({ org: orgName(x.p[1]), s: x.s }));
}
export function strictMember(c, type, value) {
  const tg = orgEntries(c, type);
  if (!tg) return null;
  return tg.some((x) => (!value || x.org === value) && MEMBER.includes(x.s));
}

// ---------- "שורות": איין שורה פאר א מוסד / א ענף (דאס שיקן איז אויף א שורה) ----------
export function lineOf(p) {
  const root = byId().get(String(p[0]));
  if (orgCol(root) && p.length >= 2) return p.slice(0, 2);
  if (root?.mirror || (p.length >= 2 && !orgCol(root))) return p.slice(0, 2);
  return p.slice(0, 1);
}
function lineTitle(lp) {
  const root = byId().get(String(lp[0]));
  if (!root) return nameOf(lp[lp.length - 1]);
  if (root.kind === 'orgs:all' && lp[1]) return `${root.id === donorRoot()?.id ? 'תורם' : 'ידיד'} · ${nameOf(lp[1])}`;
  if (orgCol(root)) return lp[1] ? nameOf(lp[1]) : root.name;
  if (root.id === '4') return lp[1] ? `אנ"ש · ${nameOf(lp[1])}` : root.name;
  return lp[1] ? nameOf(lp[1]) : root.name;
}
const lineSt = (items) => (items.some((x) => x.s === 'a') ? 'a' : items.some((x) => x.s === UNCHECKED) ? 'u' : 'f');
/** די שורות פון א קאנטאקט, לויט גרופע: { g, key, lp, title, st, send, items, auto } */
export function linesOf(c) {
  const map = new Map();
  tagsOf(c).forEach((x) => {
    const root = byId().get(String(x.p[0]));
    if (!root) return;
    const lp = lineOf(x.p); const key = pathKey(lp);
    if (!map.has(key)) map.set(key, { g: root.group, key, lp, title: lineTitle(lp), items: [], root });
    map.get(key).items.push(x);
  });
  return [...map.values()].map((l) => ({ ...l, st: lineSt(l.items), send: !l.items.every((x) => x.n), auto: l.items.find((x) => x.auto)?.auto || '' }));
}
/** די תפקידים ביים נאמען (גבאי · צוות · …) */
export function roleMarks(c) {
  const live = tagsOf(c).filter((x) => x.s !== 'f' && !isArchive(x.p[0]));
  return ROLE_MARKS.filter(([fn]) => live.some((x) => fn(x.p))).map(([, l]) => l);
}

// ---------- רשימה: די טשיפס ----------
const dot = (st) => `<i class="tg-dot tg-dot-${st}" title="${h(statusLabel(st))}"></i>`;
export function rowChipsHtml(c) {
  const lines = linesOf(c);
  const main = lines.filter((l) => GROUPS.includes(l.g)).sort((a, b) => a.g.localeCompare(b.g) || (a.st === 'f') - (b.st === 'f'));
  const old = lines.filter((l) => l.g === 'old').flatMap((l) => l.items.map((x) => nameOf(x.p[x.p.length - 1])));
  return main.map((l) => `<span class="tg-chip tg-g${l.g}${l.st === 'f' ? ' off' : ''}">${dot(l.st)}${h(l.title)}</span>`).join('')
    + (old.length ? `<span class="tg-oldchips">${old.map((n) => `◦${h(n)}`).join(' ')}</span>` : '');
}

// ---------- כרטיס: 3 שפאלטן ----------
function lineDetail(l) {
  const from = l.lp.length;
  const parts = l.items.filter((x) => x.p.length > from).map((x) => ({ txt: pathLabel(x.p, from), off: x.s === 'f' }));
  return parts.map((x) => `<span class="${x.off ? 'tg-off' : ''}">${h(x.txt)}${x.off ? ` (${h(statusLabel('f'))})` : ''}</span>`).join(' · ');
}
export function cardTagsHtml(c) {
  const lines = linesOf(c);
  if (!lines.length) return hasUnchecked(c) ? `<section class="tg-card"><h3>🏷 ${h(t('tgTitle'))} <span class="tg-warn">⚠ ${h(t('tgUnchecked'))}</span></h3></section>` : '';
  const col = (g) => {
    const ls = lines.filter((l) => l.g === g);
    return `<div class="tg-col tg-g${g}"><h4>${h(groupName(g))}</h4>${ls.length ? ls.map((l) => `<div class="tg-cline${l.st === 'f' ? ' off' : ''}">
        <div class="tg-ctop">${dot(l.st)}<b>${h(l.title)}</b>
          <button type="button" class="tg-send${l.send ? ' on' : ''}" data-send="${h(l.key)}" title="${h(t('tgSendTip'))}">${l.send ? '☑' : '☐'} 📬 ${h(t('tgSend'))}</button></div>
        ${lineDetail(l) ? `<div class="tg-cdet">${lineDetail(l)}</div>` : ''}
        ${l.auto ? `<div class="tg-cdet muted">${h(t('tgDonorLast', { d: l.auto }))}</div>` : ''}</div>`).join('') : '<p class="muted">—</p>'}</div>`;
  };
  const old = lines.filter((l) => l.g === 'old').flatMap((l) => l.items.map((x) => nameOf(x.p[x.p.length - 1])));
  return `<section class="tg-card"><h3>🏷 ${h(t('tgTitle'))}${hasUnchecked(c) ? ` <span class="tg-warn">⚠ ${h(t('tgUnchecked'))}</span>` : ''}</h3>
    <div class="tg-cols">${GROUPS.map(col).join('')}</div>
    ${old.length ? `<p class="tg-oldline">◦ ${h(nameOf(roots().find((r) => r.group === 'old')?.id || '8'))}: ${h(old.join(' · '))}</p>` : ''}
  </section>`;
}
/** דאס 📬 אין כרטיס — טוישן און שפייכלערן גלייך (נאר די tags צעל) */
export function wireCardTags(box, c, onSaved) {
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-send]');
    if (!b) return;
    const key = b.dataset.send;
    const line = linesOf(c).find((l) => l.key === key);
    if (!line) return;
    const turnOff = line.send;
    const list = storedTags(c);
    const lp = key.split('>');
    list.forEach((x) => { if (pathKey(lineOf(x.p)) === key) { if (turnOff) x.n = 1; else delete x.n; } });
    if (turnOff && line.items.some((x) => x.auto) && !list.some((x) => x.s === 'auto' && pathKey(x.p) === key)) list.push({ p: lp, s: 'auto', n: 1 });
    const out = list.filter((x) => !(x.s === 'auto' && !x.n));
    b.disabled = true;
    try {
      const col = colLetter(state.headers.Contacts.indexOf('tags'));
      const val = serialize(out);
      await batchUpdate([{ range: `Contacts!${col}${c._row}`, values: [[val]] }]);
      c.tags = val;
      onSaved?.();
    } catch (err) { ui?.toast(ui.friendlyError(err), 'error'); b.disabled = false; }
  });
}

// ---------- טופס: 3 שפאלטן, ☑ און פעיל/יוצא ----------
const stToggle = (key, cur) => `<span class="tg-st">${STATUSES.map(([k, l]) => `<label class="tg-r tg-r-${k}"><input type="radio" name="st|${h(key)}" value="${k}"${cur === k ? ' checked' : ''}> ${h(l)}</label>`).join('')}${cur === UNCHECKED ? `<span class="tg-ulabel">⚠ ${h(statusLabel(UNCHECKED))}</span>` : ''}</span>`;

function nodeHtml(path, entries) {
  const key = pathKey(path);
  const kids = childrenOf(path);
  const name = nameOf(path[path.length - 1]);
  const under = entries.some((x) => startsWith(x.p, path));
  const exact = entries.find((x) => pathKey(x.p) === key);
  const deeper = entries.some((x) => x.p.length > path.length && startsWith(x.p, path));
  return `<div class="tg-node" data-key="${h(key)}"${exact?.s === UNCHECKED ? ' data-u="1"' : ''}>
    <div class="tg-rowline"><label class="tg-cb"><input type="checkbox"${under ? ' checked' : ''}> ${h(name)}</label>
      <span class="tg-stbox"${under && !deeper ? '' : ' hidden'}>${stToggle(key, exact?.s || (under ? 'a' : ''))}</span></div>
    ${kids.length ? `<div class="tg-kids"${under ? '' : ' hidden'}>${kids.map((k) => nodeHtml([...path, k.id], entries)).join('')}</div>` : ''}</div>`;
}

export function tagsEditorHtml(c) {
  if (!roots().length) return '';
  const entries = storedTags(c).filter((x) => x.s !== 'auto');
  const col = (g) => {
    const rs = groupRoots(g);
    const n = entries.filter((x) => rs.some((r) => r.id === x.p[0])).length;
    return `<details class="tg-ecol tg-g${g}"${n ? ' open' : ''}><summary>${h(groupName(g))}${n ? ` <span class="count-pill">${n}</span>` : ''}</summary>
      <div class="tg-ebody">${rs.map((r) => nodeHtml([r.id], entries)).join('')}</div></details>`;
  };
  return `<fieldset class="tg-edit"><legend>🏷 ${h(t('tgTitle'))}</legend>
    <div class="tg-ecols">${GROUPS.map(col).join('')}</div>
    <p class="hint-line">${h(t('tgHint'))}</p>
  </fieldset>`;
}

export function wireTagsEditor(form) {
  const box = $('.tg-edit', form);
  if (!box) return;
  const refresh = (node) => {
    // דער מצב ווייזט זיך נאר ביים טיפסטן אנגעצייכנטן
    const cb = $(':scope > .tg-rowline .tg-cb input', node);
    const kids = $(':scope > .tg-kids', node);
    const deeper = kids && $$(':scope .tg-cb input', kids).some((x) => x.checked);
    const stb = $(':scope > .tg-rowline .tg-stbox', node);
    stb.hidden = !cb.checked || deeper;
    if (cb.checked && !deeper && !$('input[type=radio]:checked', stb) && !node.dataset.u) $('input[value="a"]', stb).checked = true;
  };
  box.addEventListener('change', (e) => {
    const cb = e.target.closest('.tg-cb input');
    if (cb) {
      const node = cb.closest('.tg-node');
      const kids = $(':scope > .tg-kids', node);
      if (kids) kids.hidden = !cb.checked;
      if (!cb.checked) {
        $$('.tg-cb input', node).forEach((x) => { x.checked = false; });
        $$('.tg-stbox', node).forEach((x) => { x.hidden = true; });
      } else {
        // די עלטערן אויך
        let p = node.parentElement.closest('.tg-node');
        while (p) { $(':scope > .tg-rowline .tg-cb input', p).checked = true; const k = $(':scope > .tg-kids', p); if (k) k.hidden = false; p = p.parentElement.closest('.tg-node'); }
      }
      refresh(node);
      let p = node.parentElement.closest('.tg-node');
      while (p) { refresh(p); p = p.parentElement.closest('.tg-node'); }
      syncNeshei(form, 'tag');
    }
    if (e.target.matches('input[type=radio]')) { const n = e.target.closest('.tg-node'); delete n.dataset.u; $('.tg-ulabel', n)?.remove(); syncNeshei(form, 'tag'); }
  });
  const wb = form.elements.wife_in_neshei;
  if (wb) wb.addEventListener('change', () => syncNeshei(form, 'wife'));
}

/** נשי אונגוואר: דער ✓ ביי דער ווייב און די תגית — איינס צייכנט דאס צווייטע */
function nesheiNode(form) {
  return $$('.tg-edit .tg-node', form).find((r) => r.dataset.key.split('>').pop() === `o:${NESHEI_ORG}`);
}
function syncNeshei(form, from) {
  const node = nesheiNode(form); const wb = form.elements.wife_in_neshei;
  if (!node || !wb) return;
  const cb = $(':scope > .tg-rowline .tg-cb input', node);
  if (from === 'wife') {
    if (cb.checked === wb.checked) return;
    cb.checked = wb.checked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    if (wb.checked) node.closest('details.tg-ecol')?.setAttribute('open', '');
  } else {
    const st = $(':scope > .tg-rowline input[type=radio]:checked', node)?.value;
    wb.checked = cb.checked && st !== 'f';
  }
}

/** לייענט די תגיות פונעם טופס */
export function readTagsEditor(form, original) {
  const box = $('.tg-edit', form);
  if (!box) return { tags: original?.tags || '' };
  const before = storedTags(original);
  const prev = (key) => before.find((x) => pathKey(x.p) === key);
  const lineNoSend = (p) => { const lk = pathKey(lineOf(p)); const xs = before.filter((x) => pathKey(lineOf(x.p)) === lk); return xs.length && xs.every((x) => x.n); };
  const shown = new Set($$('.tg-node', box).map((n) => n.dataset.key));
  const out = [];
  $$('.tg-node', box).forEach((node) => {
    const cb = $(':scope > .tg-rowline .tg-cb input', node);
    if (!cb.checked) return;
    let p = node.parentElement.closest('.tg-node'); let ok = true;
    while (p) { if (!$(':scope > .tg-rowline .tg-cb input', p).checked) ok = false; p = p.parentElement.closest('.tg-node'); }
    if (!ok) return;
    const kids = $(':scope > .tg-kids', node);
    if (kids && $$('.tg-cb input', kids).some((x) => x.checked)) return; // א טיפערער איז אנגעצייכנט
    const key = node.dataset.key; const old = prev(key);
    const st = $(':scope > .tg-rowline input[type=radio]:checked', node)?.value || (node.dataset.u ? UNCHECKED : 'a');
    const path = key.split('>');
    const e = { p: path, s: st };
    if (st !== UNCHECKED) e.d = old && old.s === st ? old.d : today();
    if (old ? old.n : lineNoSend(path)) e.n = 1;
    if (old?.o && st === UNCHECKED) e.o = old.o;
    out.push(e);
  });
  // וואס דער טופס ווייזט נישט (אלטע רשימה, אויטא-צייכנס, וועגן וואס זענען מער נישטא) — בלייבט
  before.forEach((x) => { if (!shown.has(pathKey(x.p))) out.push(x); });
  return { tags: serialize(out) };
}

/** חבורת הבחורים: ווען א בחור ווערט נשוי/גרוש/אלמן → יוצא */
export function applyMaritalRule(contact, original) {
  const was = String(original?.marital_status || '');
  const now = String(contact.marital_status || '');
  if (!now || now === was || !['נשוי', 'גרוש', 'אלמן'].includes(now)) return;
  const list = storedTags(contact);
  let changed = false;
  list.forEach((x) => {
    if (x.p.includes(`o:${BOCHURIM_ORG}`) && x.s !== 'f' && x.s !== 'auto') { x.s = 'f'; x.d = today(); delete x.o; changed = true; }
  });
  if (changed) contact.tags = serialize(list);
}

/** wife_in_neshei לויט דער תגית */
export function nesheiFromTags(contact) {
  const x = storedTags(contact).find((e) => e.p.includes(`o:${NESHEI_ORG}`));
  if (x) contact.wife_in_neshei = x.s !== 'f';
}

// ---------- אדמין: דער בוים ----------
let ui = null;
export function initTags(helpers) { ui = helpers; }

const usageOf = (id) => state.contacts.filter((c) => storedTags(c).some((x) => x.p.map(String).includes(String(id)))).length;
function descendants(id) {
  const all = nodes(); const out = [];
  const walk = (pid) => all.filter((n) => n.parent === pid).forEach((n) => { out.push(n.id); walk(n.id); });
  walk(String(id));
  return out;
}

export function treeAdminHtml() {
  if (!state.isAdmin) return '';
  const orgsOf = (r) => orgsOfCol(orgCol(r));
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
        <button type="button" class="linkish muted small" data-tt="group" title="${h(t('tgGroupPick'))}">[${h(r.group === 'old' ? t('tgGroupOld') : groupName(r.group))}]</button>
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
        await saveRecord('TagTree', 'node_id', { node_id: '', parent_id: parent, name: name.trim(), sort: sibs.length + 1, kind: '', applies: '', mirror: '', ...(parent ? {} : { group: '3' }) });
      } else if (act === 'group') {
        const v = prompt(t('tgGroupPrompt', { a: groupName('1'), b: groupName('2'), c: groupName('3') }), n.group === 'old' ? '' : n.group);
        if (v === null || !['1', '2', '3'].includes(v.trim())) return;
        await saveRecord('TagTree', 'node_id', { ...n.raw, group: v.trim() });
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
        const affected = state.contacts.filter((c) => storedTags(c).some((x) => x.p.map(String).some((q) => ids.includes(q))));
        if (!confirm(t('tgDelConfirm', { name: n.name, n: affected.length }))) return;
        // אראפנעמען פון די קאנטאקטן
        const col = colLetter(state.headers.Contacts.indexOf('tags'));
        const data = affected.map((c) => ({ range: `Contacts!${col}${c._row}`, values: [[serialize(storedTags(c).filter((x) => !x.p.map(String).some((q) => ids.includes(q))))]] }));
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
  const st = sel.st && sel.st.length ? [...new Set(sel.st.map(normSt))] : LIST_DEFAULT;
  const send = sel.send !== false;
  const item = (path) => {
    const key = pathKey(path); const kids = childrenOf(path);
    const open = keys.some((k) => k.startsWith(`${key}>`));
    return `<li><label class="check"><input type="checkbox" data-tgk="${h(key)}"${keys.includes(key) ? ' checked' : ''}> ${h(nameOf(path[path.length - 1]))}</label>
      ${kids.length ? `<details${open ? ' open' : ''}><summary class="muted small">▸</summary><ul>${kids.map((k) => item([...path, k.id])).join('')}</ul></details>` : ''}</li>`;
  };
  const grp = (g, title) => { const rs = roots().filter((r) => r.group === g); return rs.length ? `<div class="tg-sel-g tg-g${g === "old" ? "old" : g}"><b>${h(title)}</b><ul class="tg-sel-tree">${rs.map((r) => item([r.id])).join('')}</ul></div>` : ''; };
  return `<div class="tg-sel"><div class="tg-sel-cols">${GROUPS.map((g) => grp(g, groupName(g))).join('')}${grp('old', t('tgGroupOld'))}</div>
    <div class="tg-sel-st"><span class="quick-label">${h(t('tgStatuses'))}</span>
      ${[...STATUSES, [UNCHECKED, statusLabel(UNCHECKED)]].map(([k, l]) => `<label class="check"><input type="checkbox" data-tgs="${k}"${st.includes(k) ? ' checked' : ''}> ${h(l)}</label>`).join('')}
      <label class="check" title="${h(t('tgSendTip'))}"><input type="checkbox" data-tgsend${send ? ' checked' : ''}> 📬 ${h(t('tgSendOnly'))}</label></div></div>`;
}
export function readTagSel(root) {
  return { keys: $$('[data-tgk]:checked', root).map((x) => x.dataset.tgk), st: $$('[data-tgs]:checked', root).map((x) => x.dataset.tgs), send: Boolean($('[data-tgsend]', root)?.checked) };
}
