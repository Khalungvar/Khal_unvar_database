// רשימות: א רשימה = מענטשן לויט תנאים (א בסיס, נאך רשימות, "חוץ מ...", ידני), געשפייכלערט ווי תנאים —
// זי ווערט יעדעס מאל אויסגערעכנט פון ס'ניי. פון די מענטשן קומען לשוניות: נעמען / טעלעפאנען / פאסט / אימעיל / פרטים.
// א פאס פון פראבלעמען אונטן. פרטי/ציבורי, עורכים, שייכות צו א מוסד, און א "זכרון" פאר יעדע רשימה.
import { batchUpdate } from './google.js';
import {
  tagsOf, storedTags, linesOf, serialize, hasUnchecked, nameOf as tagName, roots as tagRoots, childrenOf as tagChildren, pathKey, GROUPS,
} from './tags.js';
import { state, loadAll, saveSavedList, deleteSavedList, displayName, saveRecord, saveContact, importContacts } from './data.js';
import { t } from './i18n.js';
import { isTrue, isAlive, escapeHtml as h, mailingName, digits, nowStamp } from './util.js';
import { todayIso } from './hebdate.js';
import { effectiveOrg, getScope, NO_AREA, ORG_TYPES, isEntityOrg } from './scope.js';
import { allCampaigns } from './campaigns.js';
import { downloadXlsx } from './excel.js';
import { openCompose } from './mail.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const FAM_COLORS = ['#2b6cb0', '#2f855a', '#b7791f', '#9b2c2c'];
const FAM_RELS = ['self', 'sons', 'sil', 'gk', 'gkd', 'ggk', 'father', 'fil', 'bro', 'bil', 'mech', 'mechg'];
const TABS = ['names', 'phones', 'mail', 'email', 'details'];

let page = 'overview';
let current = null; // { list_id, name, scope, visibility, created_by, cr, tab }

// ---------- תנאים ----------
const DON = () => ({ target: '', value: '', time: 'all', n: '', unit: 'y', year: '', sum: 'total', min: '', max: '' });
const TAGSEL = (st = 'a') => ({ keys: [], st, per: {} });
const EMPTY = () => ({
  v: 2, base: '', tags: TAGSEL('a'), areas: [], family: [], donation: DON(), lists: [],
  except: { tags: TAGSEL('both'), areas: [], family: [], donation: null, lists: [] },
  marital: [], includeDeceased: false, includeInactive: false, includeNoSend: false,
  add: [], remove: [], ext: [],
  meta: { note: '', editors: [], viewers: [], firstTab: 'names', mem: {}, sep: [], notDup: [] },
});
const asEntry = (x) => (typeof x === 'object' && x ? x : { id: String(x) });

/** פון א געשפייכלערטן JSON (אויך די אלטע פארמע) → די נייע פארמע */
export function normalize(raw) {
  const e = EMPTY();
  if (!raw || typeof raw !== 'object') return e;
  if (raw.v !== 2) {
    // די אלטע בויער: אריבערנעמען וואס מ'קען
    const keys = raw.tagSel?.keys || [];
    if (keys.length) { e.base = 'tags'; e.tags.keys = keys; }
    else if ((raw.areas || []).length) { e.base = 'area'; e.areas = raw.areas; }
    e.marital = raw.marital || [];
    e.includeDeceased = Boolean(raw.includeDeceased); e.includeInactive = Boolean(raw.includeInactive);
    e.add = (raw.add || []).map(asEntry); e.remove = (raw.remove || []).map(asEntry);
    return e;
  }
  return {
    ...e, ...raw,
    tags: { ...TAGSEL('a'), ...(raw.tags || {}) },
    donation: { ...DON(), ...(raw.donation || {}) },
    except: { ...e.except, ...(raw.except || {}), tags: { ...TAGSEL('both'), ...(raw.except?.tags || {}) } },
    add: (raw.add || []).map(asEntry), remove: (raw.remove || []).map(asEntry), ext: raw.ext || [],
    meta: { ...e.meta, ...(raw.meta || {}) },
  };
}
const live = (x) => !x.until || x.until >= todayIso();

// ---------- משפחה ----------
let relCache = { src: null };
function rels() {
  if (relCache.src === state.relations) return relCache;
  const m = () => new Map();
  const R = { src: state.relations, sons: m(), fathers: m(), sil: m(), fil: m(), bro: m(), bil: m(), gk: m(), any: new Set() };
  const add = (map, a, b) => { if (!map.has(a)) map.set(a, new Set()); map.get(a).add(b); };
  (state.relations || []).forEach((r) => {
    const a = String(r.contact_id_a); const b = String(r.contact_id_b); const ty = r.relation_type;
    if (!a || !b) return;
    R.any.add(`${a}|${b}`); R.any.add(`${b}|${a}`);
    if (ty === 'טאטע פון') { add(R.sons, a, b); add(R.fathers, b, a); }
    if (ty === 'זון פון') { add(R.sons, b, a); add(R.fathers, a, b); }
    if (ty === 'שווער פון') { add(R.sil, a, b); add(R.fil, b, a); }
    if (ty === 'איידעם פון') { add(R.sil, b, a); add(R.fil, a, b); }
    if (ty === 'ברודער פון') { add(R.bro, a, b); add(R.bro, b, a); }
    if (ty === 'שוואגער פון') { add(R.bil, a, b); add(R.bil, b, a); }
    if (ty === 'זיידע פון') add(R.gk, a, b);
    if (ty === 'אייניקל פון') add(R.gk, b, a);
  });
  relCache = R;
  return R;
}
const of = (map, ids) => { const out = new Set(); [...ids].forEach((i) => (map.get(String(i)) || []).forEach((x) => out.add(x))); return out; };
const uni = (...sets) => new Set(sets.flatMap((s) => [...s]));
export const related = (a, b) => rels().any.has(`${a}|${b}`);
/** "נישט קרובים · באזונדער" — פאר שטענדיג (געשפייכלערט ביי ביידע אין tags: { p: ['_sep', id] }) */
export const separated = (a, b) => [[a, b], [b, a]].some(([x, y]) => storedTags(contactOf(x)).some((e) => e.p[0] === '_sep' && String(e.p[1]) === String(y)));
async function markSeparate(a, b) {
  const col = colLetter(state.headers.Contacts.indexOf('tags'));
  const data = [];
  [[a, b], [b, a]].forEach(([x, y]) => {
    const c = contactOf(x);
    if (!c) return;
    const list = storedTags(c);
    if (!list.some((e) => e.p[0] === '_sep' && String(e.p[1]) === String(y))) list.push({ p: ['_sep', String(y)], s: 'ok' });
    c.tags = serialize(list);
    data.push({ range: `Contacts!${col}${c._row}`, values: [[c.tags]] });
  });
  if (data.length) await batchUpdate(data);
}
function colLetter(i) { let s = ''; let n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
/** די קרובים פון איינעם לויט די אויסגעקליבענע סארטן */
function familyOf(id, kinds) {
  const R = rels(); const me = new Set([String(id)]);
  const sons = of(R.sons, me); const sil = of(R.sil, me);
  const gk = uni(of(R.sons, sons), of(R.gk, me)); const gkd = of(R.sons, sil);
  const fathers = of(R.fathers, me); const fil = of(R.fil, me);
  const k = new Set(kinds); const out = new Set();
  const put = (s) => s.forEach((x) => out.add(x));
  if (k.has('self')) put(me);
  if (k.has('sons')) put(sons);
  if (k.has('sil')) put(sil);
  if (k.has('gk')) put(gk);
  if (k.has('gkd')) put(gkd);
  if (k.has('ggk')) put(of(R.sons, uni(gk, gkd)));
  if (k.has('father')) put(fathers);
  if (k.has('fil')) put(fil);
  if (k.has('bro')) put(uni(of(R.bro, me), of(R.sons, fathers)));
  if (k.has('bil')) put(uni(of(R.bil, me), of(R.sil, fathers), of(R.sons, fil)));
  if (k.has('mech')) put(uni(of(R.fil, sons), of(R.fathers, sil)));
  if (k.has('mechg')) put(uni(of(R.fil, uni(gk, gkd)), of(R.fathers, of(R.sil, uni(sons, sil)))));
  if (!k.has('self')) out.delete(String(id));
  return out;
}

// ---------- נדבות ----------
function seriesOf(name) { return allCampaigns().find((x) => x.name === name)?.series || ''; }
function donationDate(d) { return String(d.date || d.paid_date || d.created_at || '').slice(0, 10); }
function sinceDate(q) {
  const n = Number(q.n);
  if (!(n > 0)) return '';
  const d = new Date(`${todayIso()}T12:00:00`);
  if (q.unit === 'm') d.setMonth(d.getMonth() - n); else d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}
/** Map(id → { total, n }) פון די וואס פאסן */
function donors(q) {
  const out = new Map();
  if (!q) return out;
  const since = q.time === 'back' ? sinceDate(q) : '';
  const per = new Map();
  (state.donations || []).forEach((d) => {
    if (!d.contact_id) return;
    if (q.target === 'org' && q.value && effectiveOrg(d) !== q.value) return;
    if (q.target === 'series' && q.value && seriesOf(d.campaign) !== q.value) return;
    if (q.target === 'campaign' && q.value && d.campaign !== q.value) return;
    const dt = donationDate(d);
    if (since && dt < since) return;
    if (q.time === 'year' && q.year && dt.slice(0, 4) !== String(q.year)) return;
    const k = String(d.contact_id);
    if (!per.has(k)) per.set(k, []);
    per.get(k).push(Number(d.amount_usd || 0));
  });
  const min = q.min === '' ? null : Number(q.min); const max = q.max === '' ? null : Number(q.max);
  const inR = (v) => (min === null || v >= min) && (max === null || v <= max);
  per.forEach((amts, k) => {
    const total = amts.reduce((s, x) => s + x, 0);
    const ok = q.sum === 'one' ? amts.some(inR) : inR(total);
    if (ok) out.set(k, { total, n: amts.length });
  });
  // תורמים מיט דער האנט (תגית תורמים ← מוסד)
  const noFilter = q.time === 'all' && min === null && max === null;
  if (noFilter && (!q.target || q.target === 'org')) {
    state.contacts.forEach((c) => {
      if (storedTags(c).some((x) => x.p[0] === '9' && x.s !== 'auto' && x.s !== 'f' && (!q.value || x.p[1] === `o:${q.value}`))) {
        if (!out.has(String(c.contact_id))) out.set(String(c.contact_id), { total: 0, n: 0 });
      }
    });
  }
  return out;
}

// ---------- תגיות ----------
function tagMatch(c, sel) {
  if (!sel || !sel.keys.length) return false;
  const list = tagsOf(c);
  return sel.keys.some((key) => {
    const pre = key.split('>');
    const mode = sel.st === 'per' ? (sel.per[key] || 'a') : sel.st;
    return list.some((x) => pre.every((v, i) => String(x.p[i]) === v) && (mode === 'both' || (mode === 'f' ? x.s === 'f' : x.s !== 'f')));
  });
}
const areaMatch = (c, areas) => areas.some((a) => (a === NO_AREA ? !String(c.area || '').trim() : c.area === a));

// ---------- דער חשבון ----------
const contactOf = (id) => state.contacts.find((c) => String(c.contact_id) === String(id));
function famIds(fam) {
  const m = new Map(); // id → [color indexes]
  (fam || []).slice(0, 4).forEach((f, i) => {
    if (!f?.id) return;
    familyOf(f.id, f.rel || []).forEach((x) => { if (!m.has(x)) m.set(x, []); m.get(x).push(i); });
  });
  return m;
}
function setFrom(part, kind) {
  const ids = new Set();
  if (kind === 'tags') state.contacts.forEach((c) => { if (tagMatch(c, part)) ids.add(String(c.contact_id)); });
  if (kind === 'area') state.contacts.forEach((c) => { if (part.length && areaMatch(c, part)) ids.add(String(c.contact_id)); });
  if (kind === 'family') famIds(part).forEach((_, k) => ids.add(k));
  if (kind === 'donation') donors(part).forEach((_, k) => ids.add(k));
  return ids;
}
function exceptIds(ex, seen) {
  const out = new Set();
  if (!ex) return out;
  const add = (s) => s.forEach((x) => out.add(x));
  if (ex.tags?.keys?.length) add(setFrom(ex.tags, 'tags'));
  if (ex.areas?.length) add(setFrom(ex.areas, 'area'));
  if (ex.family?.length) add(setFrom(ex.family, 'family'));
  if (ex.donation) add(setFrom(ex.donation, 'donation'));
  (ex.lists || []).forEach((lid) => {
    const l = listById(lid);
    if (l && !seen.has(String(lid))) evaluate(parseSaved(l).cr, new Set([...seen, String(lid)])).forEach((r) => out.add(r.key));
  });
  return out;
}
export const listById = (id) => state.savedLists.find((l) => String(l.list_id) === String(id));

/** די מענטשן פון א רשימה: [{ key, c, ext?, manual?, until?, colors, total }] */
export function evaluate(raw, seen = new Set()) {
  const cr = normalize(raw);
  const general = (c) => (cr.includeDeceased || isAlive(c.is_alive))
    && (cr.includeInactive || isTrue(c.is_active) || c.is_active === '' || c.is_active === undefined)
    && (!cr.marital.length || cr.marital.includes(c.marital_status));
  const base = cr.base === 'tags' ? setFrom(cr.tags, 'tags') : cr.base === 'area' ? setFrom(cr.areas, 'area')
    : cr.base === 'family' ? setFrom(cr.family, 'family') : cr.base === 'donation' ? setFrom(cr.donation, 'donation') : new Set();
  const fam = cr.base === 'family' ? famIds(cr.family) : new Map();
  const don = cr.base === 'donation' ? donors(cr.donation) : null;
  const ex = exceptIds(cr.except, seen);
  const out = new Map();
  const put = (key, row) => { if (!out.has(key)) out.set(key, { key, colors: [], ...row }); };
  base.forEach((id) => {
    const c = contactOf(id);
    if (c && !ex.has(id) && general(c)) put(id, { c, colors: fam.get(id) || [], total: don?.get(id)?.total || 0 });
  });
  (cr.lists || []).forEach((x) => {
    const lid = String(x.id || x);
    if (seen.has(lid)) return;
    const l = listById(lid);
    if (!l) return;
    evaluate(parseSaved(l).cr, new Set([...seen, lid])).forEach((r) => {
      if (x.ex !== false && ex.has(r.key)) return;
      put(r.key, { ...r, from: lid });
    });
  });
  cr.remove.filter(live).forEach((x) => out.delete(String(x.id)));
  cr.add.filter(live).forEach((x) => {
    const c = contactOf(x.id);
    if (c) { out.delete(String(x.id)); put(String(x.id), { c, manual: true, until: x.until || '' }); }
  });
  cr.ext.filter(live).forEach((x) => {
    const key = `x:${x.key}`;
    if (cr.remove.some((r) => live(r) && String(r.id) === key)) return;
    put(key, { c: extContact(x), ext: x, until: x.until || '' });
  });
  return [...out.values()].sort((a, b) => String(a.c.last_name_he || a.c.last_name_en).localeCompare(String(b.c.last_name_he || b.c.last_name_en), 'he')
    || String(a.c.first_name_he).localeCompare(String(b.c.first_name_he), 'he'));
}
/** א "קאנטאקט" פון א דרויסנדיגער שורה (נאר אין דער רשימה) */
function extContact(x) {
  return {
    contact_id: `x:${x.key}`, first_name_he: x.first_he || '', last_name_he: x.last_he || '', first_name_en: x.first_en || '', last_name_en: x.last_en || x.name || '',
    address: x.address || '', city: x.city || '', state: x.state || '', zip: x.zip || '', is_alive: true, is_active: true,
    _ext: true, _phones: { mobile: x.phone || '', email_1: x.email || '' },
  };
}

// ---------- רעכטן ----------
const isOwner = (l) => String(l.created_by || '').toLowerCase() === state.email;
export function canSee(l) {
  if (state.isAdmin || isOwner(l) || l.visibility !== 'private') return true;
  const m = parseSaved(l).cr.meta;
  return [...(m.viewers || []), ...(m.editors || [])].includes(state.email);
}
export function canEdit(l) {
  if (!l) return true;
  if (state.isAdmin || isOwner(l)) return true;
  return (parseSaved(l).cr.meta.editors || []).includes(state.email);
}
const scopeKey = (sc) => (sc ? `${sc.type}|${sc.value}` : '');
/** רשימות פאר דעם פלאץ (לויט שייכות). פריוואטע ווייזן זיך אויך — נאר מען קען זיי נישט עפענען. */
export function savedInScope({ all = false } = {}) {
  const sc = getScope();
  return state.savedLists.filter((l) => String(l.list_id || '').trim()).filter((l) => all || canSee(l))
    .filter((l) => !l.scope || !sc || l.scope === scopeKey(sc));
}
export function parseSaved(l) {
  let raw = {};
  try { raw = JSON.parse(l?.criteria || '{}'); } catch { raw = {}; }
  return { cr: normalize(raw), cols: [] };
}
/** פאר אנדערע (מייל, מייל מירדזש, קבלות): נאר מענטשן מיט א כרטיס */
export function templates() { return []; }

// ---------- קאנאלן ----------
const phonesOfRow = (r) => (r.c._phones || ui.phonesOf(r.c) || {});
const PHONE_KEYS = [['mobile', 'colMobile'], ['home_phone', 'colHome'], ['wife_mobile', 'L2wifeMobile'], ['other_phone', 'L2otherPhone']];
const hasAddr = (c) => String(c.address || '').trim() && String(c.zip || c.city || '').trim();
const addrKey = (c) => `${String(c.address || '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${String(c.zip || '').slice(0, 5)}`;
const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());
/** שיקט מען אים? (ווען אלע זיינע שורות האבן "שיקן" אויסגעלאשן — ניין) */
function sendOk(r) {
  if (r.ext || r.manual) return true;
  const ls = linesOf(r.c).filter((l) => GROUPS.includes(l.g));
  return !ls.length || ls.some((l) => l.send);
}
/** דער "עלטערער" אין א גרופע: א טאטע/זיידע פאר א זון/אייניקל */
function headOf(group) {
  const R = rels();
  const isAnc = (a, b) => (R.sons.get(a) || new Set()).has(b) || (R.gk.get(a) || new Set()).has(b);
  return group.find((x) => group.every((y) => y === x || isAnc(x.key, y.key) || !group.some((z) => isAnc(z.key, x.key)))) || group[0];
}
/** רעכטן פאר א קאנאל: { rows (מיט אחד'ן), missing, nosend, groups } */
export function channel(rows, kind, ignore = false) {
  const nosend = ignore ? [] : rows.filter((r) => !sendOk(r));
  const use = ignore ? rows : rows.filter(sendOk);
  if (kind === 'phones') {
    const has = use.filter((r) => PHONE_KEYS.some(([k]) => digits(phonesOfRow(r)[k])));
    return { rows: has, missing: use.filter((r) => !has.includes(r)), nosend };
  }
  if (kind === 'email') {
    const has = use.filter((r) => emailOk(phonesOfRow(r).email_1) || emailOk(phonesOfRow(r).email_2));
    return { rows: has, missing: use.filter((r) => !has.includes(r)), nosend };
  }
  if (kind === 'mail') {
    const has = use.filter((r) => hasAddr(r.c));
    const groups = new Map();
    has.forEach((r) => { const k = addrKey(r.c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    return { rows: has, missing: use.filter((r) => !hasAddr(r.c)), nosend, groups: [...groups.values()] };
  }
  return { rows: use, missing: [], nosend };
}
/** די צונעמער פאר פאסט, לויט דעם מאדע: one / all / each */
export function mailRecipients(ch, mode = 'one') {
  if (mode === 'each') return ch.rows.map((r) => r.c);
  return ch.groups.map((g) => {
    if (g.length === 1) return g[0].c;
    const head = headOf(g);
    if (mode === 'all') return { ...head.c, _mailing: g.map((x) => mailingName(x.c)).filter(Boolean).join(' / ') };
    return head.c;
  });
}
/** פאר מייל מירדזש: די צונעמער פון א געשפייכלערטער רשימה (לויט איר זכרון) */
export function savedMailRows(l) {
  const { cr } = parseSaved(l);
  const ch = channel(evaluate(cr), 'mail', cr.includeNoSend);
  return mailRecipients(ch, cr.meta.mem?.mailMode || 'one');
}

// ---------- פראבלעמען ----------
const nm = (c) => ui.fullNameHe(c) || [c.first_name_en, c.last_name_en].join(' ');
/** "זון פון X" (דער טאטע), אדער "איידעם פון Y" (דער שווער) */
function parentLine(key) {
  if (String(key).startsWith('x:')) return '';
  const R = rels();
  const f = [...(R.fathers.get(String(key)) || [])].map(contactOf).find(Boolean);
  if (f) return `${t('sonOf')} ${nm(f)}`;
  const fil = [...(R.fil.get(String(key)) || [])].map(contactOf).find(Boolean);
  return fil ? `${t('L2silOf')} ${nm(fil)}` : '';
}
export function problems(rows, cr) {
  const P = [];
  const add = (type, sev, items) => { if (items.length) P.push({ type, sev, items }); };
  const real = rows.filter((r) => !r.ext);
  const sep = new Set(cr.meta.sep || []); const nd = new Set(cr.meta.notDup || []);
  const pairKey = (a, b) => [a, b].sort().join('~');
  // 1 — זעלבע אדרעס / טעלעפאן / אימעיל אן א קשר
  const shared = [];
  const byVal = (fn, label) => {
    const m = new Map();
    real.forEach((r) => { const v = fn(r); if (v) { if (!m.has(v)) m.set(v, []); m.get(v).push(r); } });
    m.forEach((g, v) => {
      for (let i = 0; i < g.length; i += 1) for (let j = i + 1; j < g.length; j += 1) {
        const a = g[i].key; const b = g[j].key; const pk = pairKey(a, b);
        if (!related(a, b) && !sep.has(pk) && !separated(a, b) && !shared.some((s) => s.pk === pk)) shared.push({ pk, a: g[i], b: g[j], what: label, v });
      }
    });
  };
  byVal((r) => (hasAddr(r.c) ? addrKey(r.c) : ''), t('address'));
  byVal((r) => digits(phonesOfRow(r).mobile || phonesOfRow(r).home_phone).slice(-10), t('L2phone'));
  byVal((r) => String(phonesOfRow(r).email_1 || '').toLowerCase().trim(), t('colEmail'));
  add('shared', 2, shared);
  add('unchecked', 1, real.filter((r) => hasUnchecked(r.c)));
  // 3 — אפשר דער זעלבער צוויי מאל
  const dup = [];
  const nameKey = (c) => `${String(c.first_name_he || '').trim()}|${String(c.last_name_he || '').trim()}`;
  const byName = new Map();
  real.forEach((r) => { const k = nameKey(r.c); if (k !== '|') { if (!byName.has(k)) byName.set(k, []); byName.get(k).push(r); } });
  const R = rels();
  const differ = (map, a, b) => { const x = map.get(a); const y = map.get(b); return x?.size && y?.size && ![...x].some((v) => y.has(v)); };
  byName.forEach((g) => { for (let i = 0; i < g.length; i += 1) for (let j = i + 1; j < g.length; j += 1) {
    const a = g[i].key; const b = g[j].key; const pk = pairKey(a, b);
    if (nd.has(pk) || differ(R.fathers, a, b) || differ(R.sons, a, b) || related(a, b)) continue; // אנדערע טאטע / זין → נישט דער זעלבער
    dup.push({ pk, a: g[i], b: g[j] });
  } });
  add('dup', 2, dup);
  add('names', 1, real.filter((r) => !['first_name_he', 'last_name_he', 'first_name_en', 'last_name_en'].every((k) => String(r.c[k] || '').trim())));
  add('title', 1, real.filter((r) => !String(r.c.title_he || '').trim()));
  add('addr', 1, rows.filter((r) => String(r.c.address || '').trim() && !(String(r.c.city || '').trim() && String(r.c.zip || '').trim())));
  add('bademail', 1, rows.filter((r) => { const p = phonesOfRow(r); return [p.email_1, p.email_2].some((e) => String(e || '').trim() && !emailOk(e)); }));
  add('dead', 2, real.filter((r) => !isAlive(r.c.is_alive)));
  add('bochur', 2, real.filter((r) => ['נשוי', 'גרוש', 'אלמן'].includes(r.c.marital_status)
    && storedTags(r.c).some((x) => x.p.includes('o:חבורת הבחורים') && x.s !== 'f')));
  const week = new Date(`${todayIso()}T12:00:00`); week.setDate(week.getDate() + 7);
  const wk = week.toISOString().slice(0, 10);
  const soon = [...cr.add, ...cr.remove, ...cr.ext].filter((x) => x.until && live(x) && x.until <= wk);
  add('soon', 1, soon.map((x) => ({ key: String(x.id || `x:${x.key}`), until: x.until, c: x.key ? extContact(x) : contactOf(x.id) })).filter((x) => x.c));
  add('ext', 1, rows.filter((r) => r.ext));
  add('nosend', 0, rows.filter((r) => !sendOk(r)));
  return P;
}

// ---------- UI: אריין ----------
export function initLists(helpers) {
  ui = helpers;
  $('#btn-side-list').onclick = () => openBuilder();
  $('#btn-lists-home').onclick = () => openOverview();
  $('#lists-side').addEventListener('click', (e) => {
    const b = e.target.closest('[data-list]');
    if (b) openBuilder(listById(b.dataset.list));
  });
}

export function renderListsSide() {
  const side = $('#lists-side');
  if (!side) return;
  const active = page === 'builder' && current?.list_id;
  const mine = savedInScope().filter(canSee);
  side.innerHTML = mine.length ? mine.map((l) => `<button type="button" class="org-link${String(active) === String(l.list_id) ? ' on' : ''}" data-list="${h(l.list_id)}">
      <span>${l.visibility === 'private' ? '🔒 ' : ''}${h(l.name)}</span></button>`).join('')
    : `<p class="muted small side-empty">${h(t('noSavedLists'))}</p>`;
}

export function openOverview() {
  page = 'overview';
  ui.showView('lists');
}

/** saved = א רשימה; preset = { name, criteria } */
export function openBuilder(saved = null, preset = null) {
  if (saved && !canSee(saved)) { askAccess(saved, 'view'); return; }
  page = 'builder';
  const cr = saved ? parseSaved(saved).cr : normalize(preset?.criteria || EMPTY());
  current = {
    list_id: saved?.list_id || '', name: saved?.name || preset?.name || '', scope: saved ? (saved.scope || '') : scopeKey(getScope()),
    visibility: saved ? (saved.visibility || 'public') : 'private', created_by: saved?.created_by || state.email, cr,
    tab: cr.meta.firstTab || 'names',
  };
  ui.showView('lists');
  if (!saved) setTimeout(() => openSettings(), 0);
}

export function renderBuilder() {
  const main = $('#lists-main');
  if (!main) return;
  if (page === 'overview' || !current) { renderOverview(main); return; }
  const rows = evaluate(current.cr);
  current.rows = rows;
  const mem = current.cr.meta.mem || {};
  const ig = current.cr.includeNoSend;
  const ch = { phones: channel(rows, 'phones', ig), mail: channel(rows, 'mail', ig), email: channel(rows, 'email', ig) };
  const edit = canEdit(current.list_id ? listById(current.list_id) : null);
  const tabBtn = (k, label, n) => `<button type="button" data-ltab="${k}" class="${current.tab === k ? 'on' : ''}">${label}${n !== undefined ? ` <span class="count-pill">${n}</span>` : ''}</button>`;
  const P = problems(rows, current.cr);
  const nProb = P.filter((p) => p.sev >= 1).reduce((s, p) => s + p.items.length, 0);
  const missingHere = ch[current.tab]?.missing?.length || 0;
  const barCls = nProb ? 'bad' : missingHere ? 'warn' : 'ok';
  main.innerHTML = `
    <div class="camp-page-head">
      <div><h2>${current.visibility === 'private' ? '🔒 ' : ''}${h(current.name || t('newListTitle'))}</h2>
        ${current.cr.meta.note ? `<p class="muted">${h(current.cr.meta.note)}</p>` : ''}
        <p class="hint-line">${h(t('L2by', { name: displayName(current.created_by) }))}${current.scope ? ` · ${h(current.scope.split('|')[1] || '')}` : ''}</p></div>
      <span class="spacer"></span>
      ${edit ? `<button type="button" class="btn" id="l2-settings">⚙ ${h(t('L2settings'))}</button>`
        : `<button type="button" class="btn" id="l2-askedit">✋ ${h(t('L2askEdit'))}</button>`}
      ${edit ? `<div class="l2-addwrap"><button type="button" class="btn" id="l2-add">＋ ${h(t('L2addPeople'))} ▾</button>
        <div class="l2-addmenu" hidden><button type="button" data-add="one">👤 ${h(t('L2addOne'))}</button><button type="button" data-add="paste">📋 ${h(t('L2addPaste'))}</button><button type="button" data-add="excel">📄 ${h(t('L2addExcel'))}</button><button type="button" data-add="list">📋 ${h(t('L2addList'))}</button></div></div>` : ''}
      <button type="button" class="btn" id="lb-back">← ${h(t('allLists'))}</button>
    </div>
    <nav class="adm-tabs l2-tabs">${tabBtn('names', `👥 ${t('L2tabNames')}`, rows.length)}${tabBtn('phones', `📞 ${t('L2tabPhones')}`, ch.phones.rows.length)}${tabBtn('mail', `📬 ${t('L2tabMail')}`, ch.mail.groups.length)}${tabBtn('email', `✉ ${t('L2tabEmail')}`, ch.email.rows.length)}${tabBtn('details', `📊 ${t('L2tabDetails')}`)}</nav>
    <div id="l2-body">${tabHtml(current.tab, rows, ch, edit)}</div>
    <button type="button" class="l2-bar ${barCls}" id="l2-bar">${nProb ? `⚠ ${h(t('L2probs', { n: nProb }))}` : missingHere ? `● ${h(t('L2missingHere', { n: missingHere }))}` : `✓ ${h(t('L2allOk'))}`}
      ${P.find((p) => p.type === 'nosend') ? ` · 📭 ${h(t('L2nosendN', { n: P.find((p) => p.type === 'nosend').items.length }))}` : ''} <span class="muted small">${h(t('L2barOpen'))}</span></button>`;
  wireBuilder(main, rows, ch, P);
  renderListsSide();
}

// ---------- די לשוניות ----------
const rowName = (r) => `${r.colors?.length ? r.colors.map((i) => `<i class="l2-fam" style="background:${FAM_COLORS[i]}"></i>`).join('') : ''}${h(nm(r.c))}${r.ext ? ` <span class="badge muted">${h(t('L2ext'))}</span>` : ''}${r.manual ? ' <span class="badge muted">✋</span>' : ''}${r.until ? ` <span class="muted small">⏳ ${h(r.until)}</span>` : ''}`;
function rmBtn(r, edit) { return edit ? `<button type="button" class="linkish lb-rm" data-rm="${h(r.key)}" title="${h(t('lbRemoveRow'))}">✕</button>` : ''; }
function tabHtml(tab, rows, ch, edit) {
  const mem = current.cr.meta.mem || {};
  const removed = current.cr.remove.filter(live);
  const missLine = (list) => (list.length ? `<details class="l2-miss"><summary>${h(t('L2missingList', { n: list.length }))}</summary>${list.map((r) => `<button type="button" class="linkish" data-open="${h(r.key)}">${h(nm(r.c))}</button>`).join(' · ')}</details>` : '');
  const nosendLine = (list) => (list.length ? `<p class="muted small">📭 ${h(t('L2nosendList', { n: list.length }))}: ${list.map((r) => h(nm(r.c))).join(' · ')}</p>` : '');
  if (tab === 'names') {
    const nExt = rows.filter((r) => r.ext).length;
    return `<div class="l2-actions"><button type="button" class="btn" data-x="names">Excel</button><button type="button" class="btn" data-pdf="names">PDF</button>
      ${nExt && edit && current.list_id ? `<span class="spacer"></span><button type="button" class="btn" id="l2-extall">＋ ${h(t(state.isAdmin ? 'L2extAll' : 'L2extAllReq', { n: nExt }))}</button>` : ''}</div>
      <table class="lb-table"><thead><tr><th>${h(t('colNameHe'))}</th><th>${h(t('L2parent'))}</th><th>${h(t('enName'))}</th><th>${h(t('area'))}</th><th></th></tr></thead>
      <tbody>${rows.map((r) => `<tr data-open="${h(r.key)}"><td>${rowName(r)}</td><td class="muted small">${h(parentLine(r.key))}</td><td dir="ltr">${h([r.c.first_name_en, r.c.last_name_en].filter(Boolean).join(' '))}</td><td>${h(r.c.area || r.c.city || '')}</td>
        <td class="no-print">${r.ext && edit ? `<button type="button" class="linkish" data-mk="${h(r.key)}">＋ ${h(t('L2makeContact'))}</button> ` : ''}${rmBtn(r, edit)}</td></tr>`).join('')}</tbody></table>
      ${removed.length ? `<p class="lb-removed">${h(t('lbRemovedLabel', { n: removed.length }))} ${removed.map((x) => { const c = String(x.id).startsWith('x:') ? null : contactOf(x.id); return `<span class="chip lb-minus">${h(c ? nm(c) : x.id)}${x.until ? ` ⏳ ${h(x.until)}` : ''}${edit ? ` <button type="button" class="linkish" data-restore="${h(x.id)}">↺</button>` : ''}</span>`; }).join(' ')}</p>` : ''}`;
  }
  if (tab === 'phones') {
    const c = ch.phones;
    return `<div class="l2-actions"><button type="button" class="btn" data-x="phones">Excel</button><button type="button" class="btn" data-pdf="phones">PDF</button></div>
      <table class="lb-table"><thead><tr><th>${h(t('colNameHe'))}</th>${PHONE_KEYS.map(([, l]) => `<th>${h(t(l))}</th>`).join('')}<th class="print-only">✓</th></tr></thead>
      <tbody>${c.rows.map((r) => `<tr data-open="${h(r.key)}"><td>${rowName(r)}</td>${PHONE_KEYS.map(([k]) => `<td dir="ltr">${h(phonesOfRow(r)[k] || '')}</td>`).join('')}<td class="print-only"></td></tr>`).join('')}</tbody></table>
      ${missLine(c.missing)}${nosendLine(c.nosend)}`;
  }
  if (tab === 'mail') {
    const c = ch.mail; const mode = mem.mailMode || 'one';
    const recips = mailRecipients(c, mode);
    return `<div class="l2-actions">
        <label>${h(t('L2mailMode'))} <select data-mem="mailMode">${[['one', 'L2mmOne'], ['all', 'L2mmAll'], ['each', 'L2mmEach']].map(([k, l]) => `<option value="${k}"${mode === k ? ' selected' : ''}>${h(t(l))}</option>`).join('')}</select></label>
        <span class="spacer"></span>
        ${current.list_id ? `<button type="button" class="btn primary" id="l2-mm">✉ ${h(t('L2mailMerge'))}</button>` : ''}<button type="button" class="btn" data-x="mail">Excel</button><button type="button" class="btn" data-pdf="mail">PDF</button></div>
      <p class="muted small">${h(t('L2mailCount', { n: recips.length, p: c.rows.length }))}</p>
      <table class="lb-table"><thead><tr><th>${h(t('mailingName'))}</th><th>${h(t('address'))}</th><th>City</th><th>ZIP</th></tr></thead>
      <tbody>${recips.map((x) => `<tr data-open="${h(x.contact_id)}"><td dir="ltr">${h(mailingName(x) || nm(x))}</td><td dir="ltr">${h(x.address || '')}</td><td dir="ltr">${h([x.city, x.state].filter(Boolean).join(', '))}</td><td dir="ltr">${h(x.zip || '')}</td></tr>`).join('')}</tbody></table>
      ${missLine(c.missing)}${nosendLine(c.nosend)}`;
  }
  if (tab === 'email') {
    const c = ch.email; const both = Boolean(mem.email2);
    return `<div class="l2-actions"><label class="check"><input type="checkbox" data-mem="email2"${both ? ' checked' : ''}> ${h(t('L2email2'))}</label>
        <span class="spacer"></span><button type="button" class="btn primary" id="l2-mail">✉ ${h(t('L2sendEmail'))}</button><button type="button" class="btn" data-x="email">Excel</button><button type="button" class="btn" data-pdf="email">PDF</button></div>
      <table class="lb-table"><thead><tr><th>${h(t('colNameHe'))}</th><th>Email 1</th><th>Email 2</th></tr></thead>
      <tbody>${c.rows.map((r) => `<tr data-open="${h(r.key)}"><td>${rowName(r)}</td><td dir="ltr">${h(phonesOfRow(r).email_1 || '')}</td><td dir="ltr">${h(phonesOfRow(r).email_2 || '')}</td></tr>`).join('')}</tbody></table>
      ${missLine(c.missing)}${nosendLine(c.nosend)}`;
  }
  // פרטים
  const cols = detailCols(); const sel = mem.cols || ['name_he', 'mailing', 'address', 'city', 'zip', 'mobile'];
  return `<div class="l2-actions"><div class="tags lb-chips">${cols.map(([k, l]) => `<button type="button" class="chip toggle${sel.includes(k) ? ' on' : ''}" data-col="${k}">${h(l)}</button>`).join('')}</div>
      <span class="spacer"></span><button type="button" class="btn" data-x="details">Excel</button><button type="button" class="btn" data-pdf="details">PDF</button></div>
    <table class="lb-table"><thead><tr>${sel.map((k) => `<th>${h(cols.find(([x]) => x === k)?.[1] || k)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr data-open="${h(r.key)}">${sel.map((k) => `<td>${h(cols.find(([x]) => x === k)?.[2](r) ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function detailCols() {
  const P = (r) => phonesOfRow(r);
  return [
    ['name_he', t('colNameHe'), (r) => nm(r.c)], ['parent', t('L2parent'), (r) => parentLine(r.key)], ['mailing', t('mailingName'), (r) => mailingName(r.c) || ''],
    ['name_en', t('enName'), (r) => [r.c.first_name_en, r.c.last_name_en].filter(Boolean).join(' ')],
    ['address', t('address'), (r) => r.c.address || ''], ['city', 'City', (r) => r.c.city || ''], ['state', 'State', (r) => r.c.state || ''],
    ['zip', 'ZIP', (r) => r.c.zip || ''], ['area', t('area'), (r) => r.c.area || ''],
    ['mobile', t('colMobile'), (r) => P(r).mobile || ''], ['home_phone', t('colHome'), (r) => P(r).home_phone || ''],
    ['wife_mobile', t('L2wifeMobile'), (r) => P(r).wife_mobile || ''], ['other_phone', t('L2otherPhone'), (r) => P(r).other_phone || ''],
    ['email', t('colEmail'), (r) => P(r).email_1 || ''], ['email2', 'Email 2', (r) => P(r).email_2 || ''], ['marital', t('marital'), (r) => r.c.marital_status || ''],
    ['tags', t('tgTitle'), (r) => (r.ext ? '' : linesOf(r.c).filter((l) => GROUPS.includes(l.g)).map((l) => l.title).join(', '))],
    ['don_total', t('colDonTotal'), (r) => (r.ext ? '' : money((state.donations || []).filter((d) => String(d.contact_id) === r.key && !isEntityOrg(effectiveOrg(d))).reduce((s, d) => s + Number(d.amount_usd || 0), 0)))],
    ['id', '#', (r) => (r.ext ? '' : r.key)],
  ];
}
function exportTab(kind, rows, ch) {
  const name = current.name || 'list';
  const mem = current.cr.meta.mem || {};
  if (kind === 'names') downloadXlsx(name, [t('colNameHe'), t('L2parent'), t('enName'), t('area')], rows.map((r) => [nm(r.c), parentLine(r.key), [r.c.first_name_en, r.c.last_name_en].filter(Boolean).join(' '), r.c.area || '']), { sheet: name });
  if (kind === 'phones') downloadXlsx(name, [t('colNameHe'), ...PHONE_KEYS.map(([, l]) => t(l))], ch.phones.rows.map((r) => [nm(r.c), ...PHONE_KEYS.map(([k]) => phonesOfRow(r)[k] || '')]), { sheet: name });
  if (kind === 'email') downloadXlsx(name, [t('colNameHe'), 'Email 1', 'Email 2'], ch.email.rows.map((r) => [nm(r.c), phonesOfRow(r).email_1 || '', phonesOfRow(r).email_2 || '']), { sheet: name });
  if (kind === 'mail') downloadXlsx(name, [t('mailingName'), t('address'), 'City', 'State', 'ZIP'], mailRecipients(ch.mail, mem.mailMode || 'one').map((x) => [mailingName(x) || nm(x), x.address || '', x.city || '', x.state || '', x.zip || '']), { sheet: name });
  if (kind === 'details') {
    const cols = detailCols(); const sel = (mem.cols || ['name_he', 'mailing', 'address', 'city', 'zip', 'mobile']).map((k) => cols.find(([x]) => x === k)).filter(Boolean);
    downloadXlsx(name, sel.map(([, l]) => l), rows.map((r) => sel.map(([, , fn]) => fn(r))), { sheet: name });
  }
}

// ---------- PDF: פריער פרעגן וועלכע פרטים ----------
const PDF_DEFAULT = { names: ['name_he', 'parent', 'name_en', 'area'], phones: ['name_he', 'mobile', 'home_phone', 'wife_mobile'], mail: ['mailing', 'address', 'city', 'state', 'zip'], email: ['name_he', 'email', 'email2'] };
function pdfDialog(tab, rows, ch) {
  const mem = current.cr.meta.mem || {};
  const cols = detailCols();
  const sel = mem[`pdf_${tab}`] || PDF_DEFAULT[tab] || mem.cols || ['name_he', 'mailing', 'address', 'city', 'zip', 'mobile'];
  const dlg = dialog(`<h2>PDF · ${h(t(`L2tab${tab[0].toUpperCase()}${tab.slice(1)}`))}</h2><p class="hint-line">${h(t('L2pdfWhich'))}</p>
    <div class="tags lb-chips">${cols.map(([k, l]) => `<button type="button" class="chip toggle${sel.includes(k) ? ' on' : ''}" data-v="${k}">${h(l)}</button>`).join('')}</div>
    ${tab === 'phones' ? `<label class="check"><input type="checkbox" id="l2-pdf-check" checked> ${h(t('L2pdfCheckCol'))}</label>` : ''}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>${h(t('cancel'))}</button><button type="button" class="btn primary" id="l2-pdf-go">PDF</button></div>`);
  dlg.querySelector('.lb-chips').onclick = (e) => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); };
  $('#l2-pdf-go', dlg).onclick = () => {
    const keys = $$('.lb-chips .chip.on', dlg).map((b) => b.dataset.v);
    if (!keys.length) return;
    const check = $('#l2-pdf-check', dlg)?.checked;
    const list = tab === 'mail' ? mailRecipients(ch.mail, mem.mailMode || 'one').map((c) => ({ c, key: String(c.contact_id) }))
      : tab === 'phones' ? ch.phones.rows : tab === 'email' ? ch.email.rows : rows;
    const use = keys.map((k) => cols.find(([x]) => x === k)).filter(Boolean);
    current.cr.meta.mem = { ...mem, [`pdf_${tab}`]: keys };
    dlg.close();
    printTable(current.name, use, list, check);
    if (canEdit(listById(current.list_id))) persist().catch(() => {});
  };
}
function printTable(title, cols, list, checkCol) {
  const w = window.open('', '_blank');
  if (!w) { ui.toast(t('L2popup'), 'error'); return; }
  const ltr = ['mailing', 'name_en', 'address', 'city', 'state', 'zip', 'mobile', 'home_phone', 'wife_mobile', 'other_phone', 'email', 'email2'];
  // 8.5×11: ביז 6 שפאלטן — געשטעלט, מער — געלייגט. יעדער מענטש = איין שורה; ווען ס'איז צו ברייט, ווערט די שריפט קלענער.
  const land = cols.length + (checkCol ? 2 : 0) > 6;
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${h(title)}</title>
    <style>@page{size:letter ${land ? 'landscape' : 'portrait'};margin:0.4in}
    body{font-family:Heebo,Arial,sans-serif;margin:0;font-size:11px}h1{font-size:16px;margin:0 0 2px}p{color:#666;margin:0 0 8px;font-size:10px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:2px 5px;text-align:start;white-space:nowrap}
    th{background:#f3efe2}tr{page-break-inside:avoid}thead{display:table-header-group}.ltr{direction:ltr;text-align:left}td.note{width:30%}</style></head>
    <body><h1>${h(title)}</h1><p>${h(todayIso())} · ${list.length}</p><table id="t"><thead><tr><th>#</th>${cols.map(([, l]) => `<th>${h(l)}</th>`).join('')}${checkCol ? `<th>✓</th><th>${h(t('L2notes'))}</th>` : ''}</tr></thead>
    <tbody>${list.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(([k, , fn]) => `<td${ltr.includes(k) ? ' class="ltr"' : ''}>${h(fn(r) ?? '')}</td>`).join('')}${checkCol ? '<td style="width:22px"></td><td class="note"></td>' : ''}</tr>`).join('')}</tbody></table>
    <script>
      // די ברייט פונעם בלאט אין פיקסלען (96 פאר א אינטש), מינוס די ראנדן
      const W = ${land ? 10.2 : 7.7} * 96; const tb = document.getElementById('t'); let fs = 11;
      tb.style.width = 'auto';
      while (tb.offsetWidth > W && fs > 6) { fs -= 0.5; document.body.style.fontSize = fs + 'px'; }
      tb.style.width = '';
      window.onload = () => window.print();
    <\/script></body></html>`);
  w.document.close();
}

// ---------- שפייכלערן ----------
async function persist(extra = {}) {
  if (!current.list_id && !extra.forceCreate) return; // נאך נישט געשפייכלערט — נאר אין זכרון
  const l = listById(current.list_id) || {};
  const id = await saveSavedList({
    ...l, list_id: current.list_id || '', name: current.name, criteria: JSON.stringify(current.cr), columns: '',
    scope: current.scope || '', visibility: current.visibility || 'private',
  });
  await loadAll();
  current.list_id = id;
}
async function memSet(k, v) {
  current.cr.meta.mem = { ...(current.cr.meta.mem || {}), [k]: v };
  renderBuilder();
  if (canEdit(listById(current.list_id))) { try { await persist(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); } }
}

function wireBuilder(main, rows, ch, P) {
  const edit = canEdit(current.list_id ? listById(current.list_id) : null);
  $('#lb-back', main).onclick = openOverview;
  $$('[data-ltab]', main).forEach((b) => { b.onclick = () => { current.tab = b.dataset.ltab; renderBuilder(); }; });
  $('#l2-settings', main)?.addEventListener('click', () => openSettings());
  $('#l2-askedit', main)?.addEventListener('click', () => askAccess(listById(current.list_id), 'edit'));
  $('#l2-bar', main).onclick = () => openProblems(P);
  const addBtn = $('#l2-add', main);
  if (addBtn) {
    const menu = $('.l2-addmenu', main);
    addBtn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    menu.onclick = (e) => { const b = e.target.closest('[data-add]'); if (!b) return; menu.hidden = true; openAdd(b.dataset.add); };
    document.addEventListener('click', () => { menu.hidden = true; }, { once: true });
  }
  const body = $('#l2-body', main);
  body.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { e.stopPropagation(); await removeFlow(rm.dataset.rm); return; }
    const rs = e.target.closest('[data-restore]');
    if (rs) { current.cr.remove = current.cr.remove.filter((x) => String(x.id) !== rs.dataset.restore); await saveAndRender(); return; }
    const mk = e.target.closest('[data-mk]');
    if (mk) { e.stopPropagation(); makeContact(mk.dataset.mk); return; }
    const x = e.target.closest('[data-x]');
    if (x) { exportTab(x.dataset.x, rows, ch); return; }
    const pdf = e.target.closest('[data-pdf]');
    if (pdf) { pdfDialog(pdf.dataset.pdf, rows, ch); return; }
    const col = e.target.closest('[data-col]');
    if (col) {
      const sel = new Set(current.cr.meta.mem?.cols || ['name_he', 'mailing', 'address', 'city', 'zip', 'mobile']);
      if (sel.has(col.dataset.col)) sel.delete(col.dataset.col); else sel.add(col.dataset.col);
      memSet('cols', [...sel]);
      return;
    }
    if (e.target.closest('#l2-mm')) { await openMM(); return; }
    if (e.target.closest('#l2-extall')) { await bulkExt(); return; }
    if (e.target.closest('#l2-mail')) {
      const mem = current.cr.meta.mem || {};
      const list = ch.email.rows.map((r) => r.c);
      const extra = mem.email2 ? ch.email.rows.filter((r) => emailOk(phonesOfRow(r).email_2)).map((r) => ({ ...r.c, _phones: { email_1: phonesOfRow(r).email_2 } })) : [];
      openCompose({ contacts: [...list, ...extra], title: current.name });
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open && !String(open.dataset.open).startsWith('x:')) ui.openCard(open.dataset.open);
  });
  body.addEventListener('change', (e) => {
    const m = e.target.closest('[data-mem]');
    if (m) memSet(m.dataset.mem, m.type === 'checkbox' ? m.checked : m.value);
  });
  void edit;
}
async function saveAndRender() {
  renderBuilder();
  try { await persist(); renderBuilder(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}
async function openMM() {
  if (!current.list_id) return;
  const { openMailMergeWith } = await import('./mailmerge.js');
  openMailMergeWith(`saved:${current.list_id}`);
}

// ---------- א פענצטער ----------
function dialog(html, wide = false) {
  let dlg = $('#l2-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'l2-dialog';
    dlg.className = 'sheet';
    document.body.append(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  }
  dlg.classList.toggle('wide', wide);
  dlg.innerHTML = `<button type="button" class="x-close" data-close aria-label="Close">✕</button>${html}`;
  if (!dlg.open) dlg.showModal();
  return dlg;
}
/** "צו אייביג / פאר [מספר] [טאג/חודש/יאר]" → { until } אדער null */
function durationHtml() {
  return `<div class="l2-dur"><label class="check"><input type="radio" name="dur" value="perm" checked> ${h(t('L2perm'))}</label>
    <label class="check"><input type="radio" name="dur" value="for"> ${h(t('L2for'))}</label>
    <input type="number" name="durn" min="1" value="1" class="l2-durn"> <select name="duru"><option value="d">${h(t('L2day'))}</option><option value="m">${h(t('L2month'))}</option><option value="y" selected>${h(t('L2year'))}</option></select></div>`;
}
function readDuration(root) {
  if ($('[name=dur]:checked', root).value === 'perm') return '';
  const n = Math.max(1, Number($('[name=durn]', root).value) || 1);
  const d = new Date(`${todayIso()}T12:00:00`);
  const u = $('[name=duru]', root).value;
  if (u === 'd') d.setDate(d.getDate() + n); else if (u === 'm') d.setMonth(d.getMonth() + n); else d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

async function removeFlow(key) {
  const r = (current.rows || []).find((x) => x.key === key);
  const dlg = dialog(`<h2>✕ ${h(t('L2removeQ', { name: r ? nm(r.c) : key }))}</h2>${durationHtml()}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>${h(t('cancel'))}</button><button type="button" class="btn primary" id="l2-rm-ok">${h(t('L2removeBtn'))}</button></div>`);
  $('#l2-rm-ok', dlg).onclick = async () => {
    const until = readDuration(dlg);
    const cr = current.cr;
    if (key.startsWith('x:') && !until) cr.ext = cr.ext.filter((x) => `x:${x.key}` !== key);
    else {
      cr.add = cr.add.filter((x) => String(x.id) !== key);
      cr.remove = [...cr.remove.filter((x) => String(x.id) !== key), { id: key, ...(until ? { until } : {}) }];
    }
    dlg.close();
    await saveAndRender();
  };
}

// ---------- צולייגן מענטשן ----------
const normPhone = (v) => digits(v).slice(-10);
function findMatch(x) {
  const ph = normPhone(x.phone); const em = String(x.email || '').toLowerCase().trim();
  if (ph.length >= 7) {
    const hit = state.contacts.filter((c) => { const p = ui.phonesOf(c); return ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].some((k) => normPhone(p[k]) === ph); });
    if (hit.length === 1) return { sure: hit[0] };
    if (hit.length > 1) return { maybe: hit };
  }
  if (em) {
    const hit = state.contacts.filter((c) => { const p = ui.phonesOf(c); return [p.email_1, p.email_2].some((e) => String(e || '').toLowerCase().trim() === em); });
    if (hit.length === 1) return { sure: hit[0] };
    if (hit.length > 1) return { maybe: hit };
  }
  const last = String(x.last_en || x.last_he || '').toLowerCase().trim();
  const first = String(x.first_en || x.first_he || '').toLowerCase().trim();
  if (last) {
    const hit = state.contacts.filter((c) => [c.last_name_en, c.last_name_he].some((v) => String(v || '').toLowerCase().trim() === last)
      && (!first || [c.first_name_en, c.first_name_he].some((v) => String(v || '').toLowerCase().trim() === first)));
    const addr = String(x.address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const withAddr = addr ? hit.filter((c) => String(c.address || '').toLowerCase().replace(/[^a-z0-9]/g, '') === addr) : [];
    if (withAddr.length) return { maybe: withAddr };
    if (hit.length && hit.length <= 5) return { maybe: hit };
  }
  return {};
}
function parseLines(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.replace(/^"|"$/g, '').trim());
    const x = {};
    parts.forEach((p) => {
      if (!p) return;
      if (/@/.test(p)) x.email = p;
      else if (digits(p).length >= 7 && /^[\d\s()+.-]+$/.test(p)) x.phone = p;
      else if (/\d/.test(p) && !x.address) x.address = p;
      else if (/[֐-׿]/.test(p)) { const w = p.split(/\s+/); x.last_he = w.pop(); x.first_he = w.join(' '); }
      else if (!x.last_en) { const w = p.split(/\s+/); x.last_en = w.pop(); x.first_en = w.join(' '); }
      else if (!x.city) x.city = p;
    });
    return x;
  });
}
function openAdd(kind) {
  if (kind === 'one') {
    const dlg = dialog(`<h2>👤 ${h(t('L2addOne'))}</h2>
      <input id="l2-one" list="dl-l2" placeholder="${h(t('lbAddPh'))}" autocomplete="off"><datalist id="dl-l2">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
      ${durationHtml()}
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>${h(t('cancel'))}</button><button type="button" class="btn primary" id="l2-one-ok">${h(t('lbAddBtn'))}</button></div>`);
    $('#l2-one', dlg).focus();
    $('#l2-one-ok', dlg).onclick = async () => {
      const m = $('#l2-one', dlg).value.match(/\(#(\d+)\)/);
      if (!m || !contactOf(m[1])) { ui.toast(t('pickValid'), 'error'); return; }
      const until = readDuration(dlg);
      addIds([m[1]], until);
      dlg.close();
      await saveAndRender();
    };
    return;
  }
  if (kind === 'list') {
    const dlg = dialog(`<h2>📋 ${h(t('L2addList'))}</h2><p class="hint-line">${h(t('L2addListHint'))}</p>${listPick(current.cr.lists, true)}
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>${h(t('cancel'))}</button><button type="button" class="btn primary" id="l2-al-ok">${h(t('L2addAll'))}</button></div>`);
    $('#l2-al-ok', dlg).onclick = async () => {
      current.cr.lists = $$('[data-il]:checked', dlg).map((x) => ({ id: x.dataset.il, ex: $(`[data-ilex="${x.dataset.il}"]`, dlg)?.checked !== false }));
      dlg.close();
      await saveAndRender();
    };
    return;
  }
  const isX = kind === 'excel';
  const dlg = dialog(`<h2>${isX ? '📄' : '📋'} ${h(t(isX ? 'L2addExcel' : 'L2addPaste'))}</h2>
    ${isX ? `<ol class="l2-steps"><li>${h(t('L2xStep1'))} <button type="button" class="btn small-btn" id="l2-tpl">⬇ ${h(t('L2xTemplate'))}</button></li>
        <li>${h(t('L2xStep2'))}</li><li>${h(t('L2xStep3'))} <input type="file" id="l2-file" accept=".xlsx,.csv,.txt"></li></ol>`
    : `<ol class="l2-steps"><li>${h(t('L2pStep1'))}</li><li>${h(t('L2pStep2'))}</li></ol>
       <pre class="l2-example" dir="ltr">Moshe Klein, 1520 50th St, Brooklyn, (718) 555-0100, moshe@mail.com
מו"ה יעקב כהן, (718) 555-0101</pre>`}
    <textarea id="l2-paste" rows="${isX ? 4 : 8}" dir="auto"${isX ? ' hidden' : ''} placeholder="${h(t('L2pastePh'))}"></textarea>
    <p class="muted small" id="l2-loaded"></p>
    ${durationHtml()}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>${h(t('cancel'))}</button><button type="button" class="btn primary" id="l2-match">${h(t('L2matchBtn'))}</button></div>`, true);
  let table = null;
  $('#l2-tpl', dlg)?.addEventListener('click', () => downloadXlsx(t('L2xTemplateName'), XL_HEAD.map(([, l]) => l), [['משה', 'קליין', 'Moshe', 'Klein', '1520 50th St', 'Brooklyn', 'NY', '11219', '(718) 555-0100', 'moshe@mail.com']], { sheet: 'list' }));
  $('#l2-file', dlg)?.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const { readXlsx } = await import('./import.js');
      const rows = /\.xlsx$/i.test(f.name) ? await readXlsx(f) : (await f.text()).split(/\r?\n/).map((l) => l.split(/\t|,/));
      table = rows.filter((r) => r.some((v) => String(v ?? '').trim()));
      $('#l2-loaded', dlg).textContent = t('L2xLoaded', { n: Math.max(0, table.length - 1) });
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
  $('#l2-match', dlg).onclick = () => {
    const items = isX ? fromTable(table || []) : parseLines($('#l2-paste', dlg).value);
    if (!items.length) { ui.toast(t('L2nothing'), 'error'); return; }
    matchScreen(items, readDuration(dlg));
  };
}
// דער מוסטער פאר Excel: די קעפלעך → פעלדער
const XL_HEAD = [['first_he', 'ערשטער נאמען (אידיש)'], ['last_he', 'פאמיליע (אידיש)'], ['first_en', 'First name'], ['last_en', 'Last name'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['phone', 'Phone'], ['email', 'Email']];
function fromTable(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((v) => String(v ?? '').trim().toLowerCase());
  const map = XL_HEAD.map(([k, l]) => [k, head.findIndex((x) => x === l.toLowerCase() || x === k)]);
  if (map.filter(([, i]) => i >= 0).length >= 2) {
    return rows.slice(1).map((r) => Object.fromEntries(map.filter(([, i]) => i >= 0).map(([k, i]) => [k, String(r[i] ?? '').trim()])))
      .filter((x) => Object.values(x).some(Boolean));
  }
  return parseLines(rows.map((r) => r.join('\t')).join('\n')); // נישט לויטן מוסטער — מ'פרובירט צו פארשטיין
}
function addIds(ids, until) {
  const cr = current.cr;
  ids.forEach((id) => {
    const k = String(id);
    cr.remove = cr.remove.filter((x) => String(x.id) !== k);
    cr.add = [...cr.add.filter((x) => String(x.id) !== k), { id: k, ...(until ? { until } : {}) }];
  });
}
function matchScreen(items, until) {
  const res = items.map((x) => ({ x, ...findMatch(x) }));
  const sure = res.filter((r) => r.sure); const maybe = res.filter((r) => !r.sure && r.maybe); const none = res.filter((r) => !r.sure && !r.maybe);
  const label = (x) => [[x.first_he, x.last_he].filter(Boolean).join(' '), [x.first_en, x.last_en].filter(Boolean).join(' '), x.address, x.phone, x.email].filter(Boolean).join(' · ');
  const dlg = dialog(`<h2>${h(t('L2matchTitle', { n: items.length }))}</h2>
    <h3>✅ ${h(t('L2found', { n: sure.length }))}</h3><p class="muted small">${sure.map((r) => h(nm(r.sure))).join(' · ')}</p>
    ${maybe.length ? `<h3>🟡 ${h(t('L2maybe', { n: maybe.length }))}</h3>${maybe.map((r, i) => `<div class="l2-mrow"><span dir="auto">${h(label(r.x))}</span> →
      <select data-mb="${i}"><option value="">${h(t('L2notHim'))}</option>${r.maybe.map((c) => `<option value="${h(c.contact_id)}">${h(ui.pickerLabel(c))}</option>`).join('')}</select></div>`).join('')}` : ''}
    ${none.length ? `<h3>⚪ ${h(t('L2notFound', { n: none.length }))}</h3><p class="hint-line">${h(t('L2extHint'))}</p><p class="muted small" dir="auto">${none.map((r) => h(label(r.x))).join('<br>')}</p>` : ''}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>${h(t('cancel'))}</button><button type="button" class="btn primary" id="l2-m-ok">${h(t('L2addAll'))}</button></div>`, true);
  $('#l2-m-ok', dlg).onclick = async () => {
    const ids = sure.map((r) => r.sure.contact_id);
    const ext = [...none];
    maybe.forEach((r, i) => { const v = $(`[data-mb="${i}"]`, dlg).value; if (v) ids.push(v); else ext.push(r); });
    addIds(ids, until);
    ext.forEach((r) => current.cr.ext.push({ key: Math.random().toString(36).slice(2, 9), ...r.x, ...(until ? { until } : {}) }));
    dlg.close();
    await saveAndRender();
    ui.toast(t('L2addedN', { n: ids.length, e: ext.length }));
  };
}
/** א דרויסנדיגע שורה → א נייער קאנטאקט (דער טופס מיט די פרטים); נאכן שפייכלערן ווערט די שורה א קאנטאקט */
function makeContact(key) {
  const x = current.cr.ext.find((e) => `x:${e.key}` === key);
  if (!x) return;
  current.pendingExt = { key: x.key, since: Date.now() };
  ui.openForm?.({ first_name_he: x.first_he || '', last_name_he: x.last_he || '', first_name_en: x.first_en || '', last_name_en: x.last_en || '', address: x.address || '', city: x.city || '', state: x.state || '', zip: x.zip || '' });
}
/** נאך א שפייכלערן פון א נייעם קאנטאקט: ער איז געמאכט געווארן פון א דרויסנדיגער שורה → די שורה ווערט ער */
export async function linkPendingExt(newId) {
  if (!current?.pendingExt || !newId) return false;
  const x = current.cr.ext.find((e) => e.key === current.pendingExt.key);
  current.pendingExt = null;
  if (!x) return false;
  current.cr.ext = current.cr.ext.filter((e) => e.key !== x.key);
  addIds([newId], x.until || '');
  try { await persist(); } catch { /* */ }
  return true;
}

// ---------- רשות ----------
async function askAccess(l, mode) {
  if (!l) return;
  const { submitRequest } = await import('./requests.js');
  await submitRequest('list_access', { list_id: String(l.list_id), who: state.email, mode }, `${mode === 'edit' ? '✎' : '👁'} ${t(mode === 'edit' ? 'L2reqEdit' : 'L2reqView', { name: l.name })}`);
}
/** ווען מ'באשטעטיגט א בקשה (פון requests.js) */
export async function grantListAccess(p) {
  const l = listById(p.list_id);
  if (!l) throw new Error(t('rqGone'));
  const { cr } = parseSaved(l);
  const k = p.mode === 'edit' ? 'editors' : 'viewers';
  cr.meta[k] = [...new Set([...(cr.meta[k] || []), String(p.who).toLowerCase()])];
  await saveSavedList({ ...l, criteria: JSON.stringify(cr) });
}

/** די דרויסנדיגע שורות פון א רשימה → נייע קאנטאקטן (נאר א מנהל, אדער מיט זיין באשטעטיגונג) */
export async function extToContacts(listId) {
  const l = listById(listId);
  if (!l) throw new Error(t('rqGone'));
  const { cr } = parseSaved(l);
  const ext = cr.ext.filter(live);
  if (!ext.length) return 0;
  const items = ext.map((x) => ({
    contact: { first_name_he: x.first_he || '', last_name_he: x.last_he || '', first_name_en: x.first_en || '', last_name_en: x.last_en || x.name || '', address: x.address || '', city: x.city || '', state: x.state || '', zip: x.zip || '', country: 'USA', is_alive: true },
    phones: { mobile: x.phone || '', email_1: x.email || '' },
  }));
  let ids = [];
  if (state.isOwner) { const { first } = await importContacts(items); ids = items.map((_, i) => first + i); }
  else for (const it of items) ids.push(await saveContact(it.contact, it.phones));
  cr.ext = cr.ext.filter((x) => !ext.includes(x));
  ext.forEach((x, i) => { cr.add.push({ id: String(ids[i]), ...(x.until ? { until: x.until } : {}) }); });
  await saveSavedList({ ...l, criteria: JSON.stringify(cr) });
  return ids.length;
}
export async function deleteListById(listId) {
  const l = listById(listId);
  if (l) await deleteSavedList(l);
}
async function bulkExt() {
  const n = current.cr.ext.filter(live).length;
  if (!n || !current.list_id) return;
  if (!state.isAdmin) {
    const { submitRequest } = await import('./requests.js');
    await submitRequest('list_ext', { list_id: String(current.list_id) }, t('L2reqExt', { n, name: current.name }));
    return;
  }
  if (!confirm(t('L2extAllQ', { n }))) return;
  try { await extToContacts(current.list_id); await loadAll(); current.cr = parseSaved(listById(current.list_id)).cr; renderBuilder(); ui.toast(t('L2extDone', { n })); }
  catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}

// ---------- ⚙ הגדרות ----------
function tagPick(sel, prefix) {
  const keys = new Set(sel.keys || []);
  // שלב 1 (ביהמ"ד / כולל...) = נאר א קעפל צו עפענען; פון שלב 2 און ווייטער — ☑
  const node = (path, depth) => {
    const key = pathKey(path); const kids = tagChildren(path); const name = tagName(path[path.length - 1]);
    const open = depth === 0 ? [...keys].some((k) => k.startsWith(`${key}>`)) : [...keys].some((k) => k.startsWith(`${key}>`));
    const tog = kids.length ? `<button type="button" class="l2-tog" data-tog title="${h(t('L2openClose'))}">${open ? '▼' : '◀'}</button>` : '<span class="l2-tog-sp"></span>';
    const label = depth === 0
      ? `<button type="button" class="l2-tnroot" data-tog>${h(name)}</button>`
      : `<label class="check"><input type="checkbox" data-${prefix}k="${h(key)}"${keys.has(key) ? ' checked' : ''}> ${h(name)}</label>`;
    const per = depth > 0 && sel.st === 'per' && keys.has(key) ? `<select data-${prefix}per="${h(key)}">${[['a', 'L2stA'], ['f', 'L2stF'], ['both', 'L2stBoth']].map(([v, l]) => `<option value="${v}"${(sel.per[key] || 'a') === v ? ' selected' : ''}>${h(t(l))}</option>`).join('')}</select>` : '';
    return `<li class="l2-tn"><div class="l2-tnrow">${tog}${label}${per}</div>
      ${kids.length ? `<ul class="l2-tkids"${open ? '' : ' hidden'}>${kids.map((k) => node([...path, k.id], depth + 1)).join('')}</ul>` : ''}</li>`;
  };
  const grp = (g, title) => { const rs = tagRoots().filter((r) => r.group === g); return rs.length ? `<div class="tg-sel-g tg-g${g === 'old' ? 'old' : g}"><b>${h(title)}</b><ul class="l2-tree">${rs.map((r) => node([r.id], 0)).join('')}</ul></div>` : ''; };
  return `<div class="l2-st">${h(t('L2status'))} ${[['a', 'L2stA'], ['f', 'L2stF'], ['both', 'L2stBoth'], ['per', 'L2stPer']].map(([v, l]) => `<label class="check"><input type="radio" name="${prefix}st" value="${v}"${sel.st === v ? ' checked' : ''}> ${h(t(l))}</label>`).join('')}</div>
    <p class="hint-line">${h(t('L2tagHint'))}</p>
    <div class="tg-sel-cols">${GROUPS.map((g) => grp(g, t(`tgG${g}`))).join('')}${grp('old', t('tgGroupOld'))}</div>`;
}
function readTagPick(root, prefix, prev) {
  const keys = $$(`[data-${prefix}k]:checked`, root).map((x) => x.getAttribute(`data-${prefix}k`));
  const st = $(`[name=${prefix}st]:checked`, root)?.value || prev.st;
  const per = {};
  $$(`[data-${prefix}per]`, root).forEach((s) => { per[s.getAttribute(`data-${prefix}per`)] = s.value; });
  keys.forEach((k) => { if (!per[k]) per[k] = prev.per?.[k] || 'a'; });
  return { keys, st, per };
}
const allAreas = () => [...(state.lists.area || []), NO_AREA];
const areaLabel = (a) => (a === NO_AREA ? t('noArea') : a);
function areaPick(sel, prefix) {
  return `<div class="tags lb-chips" data-area="${prefix}">${allAreas().map((a) => `<button type="button" class="chip toggle${sel.includes(a) ? ' on' : ''}" data-v="${h(a)}">${h(areaLabel(a))}</button>`).join('')}</div>
    ${prefix === 'x' ? `<button type="button" class="linkish" data-allbut="${prefix}">${h(t('L2allBut'))}</button>` : ''}`;
}
function famPick(list, prefix) {
  const rows = [0, 1, 2, 3].map((i) => {
    const f = list[i] || { id: '', rel: ['self', 'sons', 'sil'] };
    const c = f.id ? contactOf(f.id) : null;
    return `<div class="l2-fam-row" data-fi="${i}"><i class="l2-fam" style="background:${FAM_COLORS[i]}"></i>
      <input data-${prefix}fam="${i}" list="dl-l2f" value="${c ? h(ui.pickerLabel(c)) : ''}" placeholder="${h(t('L2center', { n: i + 1 }))}" autocomplete="off">
      <div class="l2-rels">${FAM_RELS.map((r) => `<label class="check"><input type="checkbox" data-${prefix}rel="${i}|${r}"${(f.rel || []).includes(r) ? ' checked' : ''}> ${h(t(`L2rel_${r}`))}</label>`).join('')}</div></div>`;
  }).join('');
  return `${rows}<datalist id="dl-l2f">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>`;
}
function readFam(root, prefix) {
  return [0, 1, 2, 3].map((i) => {
    const m = String($(`[data-${prefix}fam="${i}"]`, root)?.value || '').match(/\(#(\d+)\)/);
    if (!m) return null;
    return { id: m[1], rel: $$(`[data-${prefix}rel^="${i}|"]:checked`, root).map((x) => x.getAttribute(`data-${prefix}rel`).split('|')[1]) };
  }).filter(Boolean);
}
function donPick(q, prefix) {
  const camps = allCampaigns(); const series = [...new Set(camps.map((c) => c.series).filter(Boolean))];
  const orgs = [...new Set(['umbrella_org', ...ORG_TYPES].flatMap((k) => state.lists[k] || []).filter(Boolean))];
  const vals = q.target === 'org' ? orgs : q.target === 'series' ? series : q.target === 'campaign' ? camps.map((c) => c.name) : [];
  return `<div class="l2-don" data-don="${prefix}">
    <label>${h(t('L2donFor'))} <select data-dk="target"><option value="">${h(t('L2any'))}</option>${[['org', 'L2dOrg'], ['series', 'L2dSeries'], ['campaign', 'L2dCampaign']].map(([v, l]) => `<option value="${v}"${q.target === v ? ' selected' : ''}>${h(t(l))}</option>`).join('')}</select></label>
    ${q.target ? `<select data-dk="value"><option value="">${h(t('L2any'))}</option>${vals.map((v) => `<option${v === q.value ? ' selected' : ''}>${h(v)}</option>`).join('')}</select>` : ''}
    <label>${h(t('L2when'))} <select data-dk="time">${[['all', 'L2allYears'], ['back', 'L2back'], ['year', 'L2year1']].map(([v, l]) => `<option value="${v}"${q.time === v ? ' selected' : ''}>${h(t(l))}</option>`).join('')}</select></label>
    ${q.time === 'back' ? `<input type="number" min="1" data-dk="n" value="${h(q.n || 1)}" class="l2-durn"> <select data-dk="unit"><option value="m"${q.unit === 'm' ? ' selected' : ''}>${h(t('L2month'))}</option><option value="y"${q.unit !== 'm' ? ' selected' : ''}>${h(t('L2year'))}</option></select>` : ''}
    ${q.time === 'year' ? `<input type="number" data-dk="year" value="${h(q.year || new Date().getFullYear())}" class="l2-year">` : ''}
    <label>${h(t('L2sum'))} <select data-dk="sum"><option value="total"${q.sum !== 'one' ? ' selected' : ''}>${h(t('L2sumTotal'))}</option><option value="one"${q.sum === 'one' ? ' selected' : ''}>${h(t('L2sumOne'))}</option></select></label>
    <label>${h(t('L2min'))} <input type="number" min="0" data-dk="min" value="${h(q.min)}" class="l2-durn"></label>
    <label>${h(t('L2max'))} <input type="number" min="0" data-dk="max" value="${h(q.max)}" class="l2-durn"></label></div>`;
}
function readDon(root, prefix) {
  const box = $(`[data-don="${prefix}"]`, root);
  if (!box) return null;
  const q = DON();
  $$('[data-dk]', box).forEach((x) => { q[x.dataset.dk] = x.value; });
  return q;
}
function listPick(sel, withEx) {
  const opts = state.savedLists.filter((l) => String(l.list_id || '').trim() && String(l.list_id) !== String(current.list_id) && canSee(l));
  if (!opts.length) return `<p class="muted small">${h(t('noSavedLists'))}</p>`;
  const on = new Map((sel || []).map((x) => [String(x.id ?? x), x]));
  return `<div class="l2-lists">${opts.map((l) => `<div><label class="check"><input type="checkbox" data-${withEx ? 'il' : 'xl'}="${h(l.list_id)}"${on.has(String(l.list_id)) ? ' checked' : ''}> 📋 ${h(l.name)}</label>
    ${withEx ? `<label class="check muted small"><input type="checkbox" data-ilex="${h(l.list_id)}"${on.get(String(l.list_id))?.ex === false ? '' : ' checked'}> ${h(t('L2exApplies'))}</label>` : ''}</div>`).join('')}</div>`;
}
const BASES = [['tags', '🏷', 'L2bTags'], ['area', '📍', 'L2bArea'], ['family', '👪', 'L2bFamily'], ['donation', '💰', 'L2bDonation']];

function openSettings() {
  const cr = current.cr; const ex = cr.except;
  const own = isOwner({ created_by: current.created_by }) || state.isAdmin;
  const scopeOpts = [['', t('L2allOrgs')], ...ORG_TYPES.flatMap((k) => (state.lists[k] || []).map((v) => [`${k}|${v}`, v]))];
  const xParts = { tags: ex.tags.keys.length > 0, area: ex.areas.length > 0, family: ex.family.length > 0, donation: Boolean(ex.donation), lists: ex.lists.length > 0 };
  const dlg = dialog(`<h2>⚙ ${h(t('L2settings'))}</h2>
    <form id="l2-set" class="l2-set" novalidate>
    <fieldset><legend>${h(t('L2general'))}</legend>
      <label>${h(t('lbNamePh'))} *<input name="name" value="${h(current.name)}" required></label>
      <label>${h(t('L2note'))}<input name="note" value="${h(cr.meta.note || '')}"></label>
      <div class="l2-row"><label class="check"><input type="radio" name="vis" value="private"${current.visibility === 'private' ? ' checked' : ''}> 🔒 ${h(t('lbPrivate'))}</label>
        <label class="check"><input type="radio" name="vis" value="public"${current.visibility !== 'private' ? ' checked' : ''}> ${h(t('lbPublic'))}</label></div>
      <label>${h(t('L2belongs'))}<select name="scope">${scopeOpts.map(([v, l]) => `<option value="${h(v)}"${current.scope === v ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>
      <label>${h(t('L2purpose'))}<select name="firstTab">${TABS.map((k) => `<option value="${k}"${(cr.meta.firstTab || 'names') === k ? ' selected' : ''}>${h(t(`L2tab${k[0].toUpperCase()}${k.slice(1)}`))}</option>`).join('')}</select></label>
      ${own && current.list_id ? `<div class="l2-access">${['editors', 'viewers'].map((k) => `<p><b>${h(t(`L2${k}`))}:</b> ${(cr.meta[k] || []).map((e) => `<span class="chip">${h(displayName(e))} <button type="button" class="linkish" data-revoke="${k}|${h(e)}">✕</button></span>`).join(' ') || '—'}</p>`).join('')}</div>` : ''}
    </fieldset>
    <fieldset><legend>✚ ${h(t('L2whoIn'))}</legend>
      <div class="l2-row">${BASES.map(([k, ic, l]) => `<label class="check l2-base"><input type="radio" name="base" value="${k}"${cr.base === k ? ' checked' : ''}> ${ic} ${h(t(l))}</label>`).join('')}</div>
      <div class="l2-basebox" data-for="tags"${cr.base === 'tags' ? '' : ' hidden'}>${tagPick(cr.tags, 'i')}</div>
      <div class="l2-basebox" data-for="area"${cr.base === 'area' ? '' : ' hidden'}>${areaPick(cr.areas, 'i')}</div>
      <div class="l2-basebox" data-for="family"${cr.base === 'family' ? '' : ' hidden'}>${famPick(cr.family, 'i')}</div>
      <div class="l2-basebox" data-for="donation"${cr.base === 'donation' ? '' : ' hidden'}>${donPick(cr.donation, 'i')}</div>
      <h4>＋ ${h(t('L2fromLists'))}</h4>${listPick(cr.lists, true)}
    </fieldset>
    <fieldset><legend>⊖ ${h(t('L2except'))}</legend>
      ${[['tags', '🏷', 'L2bTags', () => tagPick(ex.tags, 'x')], ['area', '📍', 'L2bArea', () => areaPick(ex.areas, 'x')], ['family', '👪', 'L2bFamily', () => famPick(ex.family, 'x')],
        ['donation', '💰', 'L2bDonation', () => donPick(ex.donation || DON(), 'x')], ['lists', '📋', 'L2fromLists', () => listPick(ex.lists.map((id) => ({ id })), false)]]
        .map(([k, ic, l, fn]) => `<details class="l2-xpart" data-xp="${k}"${xParts[k] ? ' open' : ''}><summary><label class="check"><input type="checkbox" data-xon="${k}"${xParts[k] ? ' checked' : ''}> ${ic} ${h(t(l))}</label></summary><div class="l2-xbody">${fn()}</div></details>`).join('')}
    </fieldset>
    <fieldset><legend>${h(t('L2filters'))}</legend>
      <div class="tags lb-chips" data-marital>${(state.lists.marital_status || []).map((m) => `<button type="button" class="chip toggle${cr.marital.includes(m) ? ' on' : ''}" data-v="${h(m)}">${h(m)}</button>`).join('')}</div>
      <label class="check"><input type="checkbox" name="dead"${cr.includeDeceased ? ' checked' : ''}> ${h(t('lbInclDeceased'))}</label>
      <label class="check"><input type="checkbox" name="inact"${cr.includeInactive ? ' checked' : ''}> ${h(t('inclInactive'))}</label>
      <label class="check"><input type="checkbox" name="nosend"${cr.includeNoSend ? ' checked' : ''}> 📭 ${h(t('L2inclNoSend'))}</label>
    </fieldset>
    <div class="actions">${current.list_id && own ? `<button type="button" class="btn danger" id="l2-del">🗑 ${h(t('deleteBtn'))}</button>` : ''}
      ${current.list_id && !own ? `<button type="button" class="btn" id="l2-delreq">🗑 ${h(t('L2askDelete'))}</button>` : ''}
      <span class="spacer"></span><span class="muted small" id="l2-preview"></span>
      <button type="button" class="btn" data-close>${h(t('cancel'))}</button><button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>
    </form>`, true);
  const form = $('#l2-set', dlg);
  const read = () => {
    const base = $('[name=base]:checked', form)?.value || '';
    const on = (k) => $(`[data-xon="${k}"]`, form).checked;
    const famX = readFam(form, 'x');
    return normalize({
      ...cr, v: 2, base,
      tags: readTagPick($('[data-for=tags]', form), 'i', cr.tags),
      areas: $$('[data-area=i] .chip.on', form).map((b) => b.dataset.v),
      family: readFam(form, 'i'),
      donation: readDon(form, 'i') || DON(),
      lists: $$('[data-il]:checked', form).map((x) => ({ id: x.dataset.il, ex: $(`[data-ilex="${x.dataset.il}"]`, form)?.checked !== false })),
      except: {
        tags: on('tags') ? readTagPick($('[data-xp=tags]', form), 'x', ex.tags) : TAGSEL('both'),
        areas: on('area') ? $$('[data-area=x] .chip.on', form).map((b) => b.dataset.v) : [],
        family: on('family') ? famX : [],
        donation: on('donation') ? readDon(form, 'x') : null,
        lists: on('lists') ? $$('[data-xl]:checked', form).map((x) => x.dataset.xl) : [],
      },
      marital: $$('[data-marital] .chip.on', form).map((b) => b.dataset.v),
      includeDeceased: form.elements.dead.checked, includeInactive: form.elements.inact.checked, includeNoSend: form.elements.nosend.checked,
      meta: { ...cr.meta, note: form.elements.note.value.trim(), firstTab: form.elements.firstTab.value },
    });
  };
  const preview = () => { try { $('#l2-preview', dlg).textContent = t('lbCount', { n: evaluate(read()).length }); } catch { /* */ } };
  const rerenderPart = (sel, html) => { const box = $(sel, form); if (box) box.outerHTML = html; };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'base') $$('.l2-basebox', form).forEach((b) => { b.hidden = b.dataset.for !== e.target.value; });
    if (e.target.matches('[name=ist], [name=xst], [data-ik], [data-xk]')) {
      const which = e.target.matches('[name=ist], [data-ik]') ? 'i' : 'x';
      const box = which === 'i' ? $('[data-for=tags]', form) : $('[data-xp=tags] .l2-xbody', form);
      const sel = readTagPick(box, which, which === 'i' ? cr.tags : ex.tags);
      if (sel.st === 'per' || e.target.name) { box.innerHTML = tagPick(sel, which); (which === 'i' ? cr : ex).tags = sel; }
    }
    if (e.target.matches('[data-dk]')) {
      const box = e.target.closest('[data-don]'); const pre = box.dataset.don;
      const q = readDon(form, pre);
      if (['target', 'time'].includes(e.target.dataset.dk)) { if (e.target.dataset.dk === 'target') q.value = ''; rerenderPart(`[data-don="${pre}"]`, donPick(q, pre)); }
    }
    if (e.target.matches('[data-xk], [data-xl], [data-xfam], [data-xrel]') || e.target.closest('.l2-xpart')) {
      const part = e.target.closest('.l2-xpart'); const cb = part && $('[data-xon]', part);
      if (cb && !e.target.matches('[data-xon]')) cb.checked = true;
    }
    preview();
  });
  form.addEventListener('click', (e) => {
    const tg = e.target.closest('[data-tog]');
    if (tg) {
      const li = tg.closest('.l2-tn'); const ul = li && li.querySelector(':scope > .l2-tkids');
      if (ul) { ul.hidden = !ul.hidden; const b = li.querySelector(':scope > .l2-tnrow > .l2-tog'); if (b) b.textContent = ul.hidden ? '◀' : '▼'; }
      return;
    }
    const chip = e.target.closest('.lb-chips .chip');
    if (chip) { chip.classList.toggle('on'); const part = chip.closest('.l2-xpart'); if (part) $('[data-xon]', part).checked = true; preview(); return; }
    const ab = e.target.closest('[data-allbut]');
    if (ab) { $$(`[data-area="${ab.dataset.allbut}"] .chip`, form).forEach((c) => c.classList.add('on')); $('[data-xon=area]', form).checked = true; preview(); return; }
    const rv = e.target.closest('[data-revoke]');
    if (rv) { const [k, em] = rv.dataset.revoke.split('|'); cr.meta[k] = (cr.meta[k] || []).filter((x) => x !== em); rv.closest('.chip').remove(); }
  });
  $('#l2-delreq', dlg)?.addEventListener('click', async () => {
    const { submitRequest } = await import('./requests.js');
    if (await submitRequest('list_delete', { list_id: String(current.list_id) }, t('L2reqDelete', { name: current.name }))) dlg.close();
  });
  $('#l2-del', dlg)?.addEventListener('click', async () => {
    if (!confirm(t('lbConfirmDelete', { name: current.name }))) return;
    try { await deleteSavedList(listById(current.list_id)); await loadAll(); dlg.close(); current = null; openOverview(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) { ui.toast(t('lbNameRequired'), 'error'); form.elements.name.focus(); return; }
    current.cr = read();
    current.name = name; current.visibility = $('[name=vis]:checked', form).value; current.scope = form.elements.scope.value;
    const btn = $('[type=submit]', form); btn.disabled = true;
    try {
      await persist({ forceCreate: true });
      dlg.close();
      ui.toast(t('lbSaved', { name }));
      current.tab = current.cr.meta.firstTab || current.tab;
      renderBuilder();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; }
  });
  preview();
}

// ---------- פראבלעמען ----------
function openProblems(P) {
  const edit = canEdit(current.list_id ? listById(current.list_id) : null);
  const card = (r) => (r?.c && !r.ext ? `<button type="button" class="linkish" data-open="${h(r.key)}">${h(nm(r.c))}</button>` : h(r?.c ? nm(r.c) : ''));
  const btn = (act, key, label) => (edit ? `<button type="button" class="btn small-btn" data-act="${act}" data-k="${h(key)}">${h(label)}</button>` : '');
  const body = (p) => {
    if (p.type === 'shared') return p.items.map((x) => `<div class="l2-prow">${card(x.a)} + ${card(x.b)} <span class="muted small">· ${h(x.what)}</span>
      <button type="button" class="btn small-btn" data-open="${h(x.a.key)}" data-tabopen="family">${h(t('L2addRel'))}</button>${btn('sep', x.pk, t('L2notRelated'))}</div>`).join('');
    if (p.type === 'dup') return p.items.map((x) => `<div class="l2-prow">${card(x.a)} ⇄ ${card(x.b)} ${btn('notdup', x.pk, t('L2notSame'))}</div>`).join('');
    if (p.type === 'soon') return p.items.map((x) => `<div class="l2-prow">${h(nm(x.c))} <span class="muted small">⏳ ${h(x.until)}</span> ${btn('extend', x.key, t('L2extend'))}</div>`).join('');
    if (p.type === 'ext') return p.items.map((r) => `<div class="l2-prow">${h(nm(r.c))} ${btn('mk', r.key, `＋ ${t('L2makeContact')}`)}</div>`).join('');
    if (p.type === 'dead') return p.items.map((r) => `<div class="l2-prow">${card(r)} ${btn('rm', r.key, t('L2removeBtn'))}</div>`).join('');
    return `<div class="l2-prow">${p.items.slice(0, 200).map((r) => card(r)).join(' · ')}</div>`;
  };
  const dlg = dialog(`<h2>${h(t('L2probsTitle'))}</h2>
    ${P.length ? P.map((p) => `<details class="l2-pgroup sev${p.sev}"${p.sev >= 2 ? ' open' : ''}><summary>${h(t(`L2p_${p.type}`))} <span class="count-pill">${p.items.length}</span></summary>${body(p)}</details>`).join('') : `<p>✓ ${h(t('L2allOk'))}</p>`}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn primary" data-close>${h(t('close'))}</button></div>`, true);
  dlg.onclick = async (e) => {
    const o = e.target.closest('[data-open]');
    if (o && !String(o.dataset.open).startsWith('x:')) { dlg.close(); ui.openCard(o.dataset.open, o.dataset.tabopen || null); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const k = a.dataset.k; const meta = current.cr.meta;
    if (a.dataset.act === 'sep') { const [x, y] = k.split('~'); try { await markSeparate(x, y); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); return; } }
    if (a.dataset.act === 'notdup') meta.notDup = [...new Set([...(meta.notDup || []), k])];
    if (a.dataset.act === 'extend') {
      const n = prompt(t('L2extendQ'), '1');
      if (!n) return;
      const until = new Date(`${todayIso()}T12:00:00`); until.setFullYear(until.getFullYear() + Math.max(1, Number(n) || 1));
      const u = until.toISOString().slice(0, 10);
      ['add', 'remove'].forEach((f) => { current.cr[f] = current.cr[f].map((x) => (String(x.id) === k ? { ...x, until: u } : x)); });
      current.cr.ext = current.cr.ext.map((x) => (`x:${x.key}` === k ? { ...x, until: u } : x));
    }
    if (a.dataset.act === 'mk') { dlg.close(); makeContact(k); return; }
    if (a.dataset.act === 'rm') { dlg.close(); removeFlow(k); return; }
    a.closest('.l2-prow')?.remove();
    await saveAndRender();
  };
}

// ---------- איבערבליק ----------
function renderOverview(main) {
  const lists = savedInScope({ all: true });
  const myReqs = (state.requests || []).filter((r) => ['list_access', 'list_delete'].includes(r.type) && (r.status || 'pending') === 'pending')
    .filter((r) => { try { const l = listById(JSON.parse(r.payload).list_id); return l && isOwner(l) && !state.isAdmin; } catch { return false; } });
  main.innerHTML = `
    <div class="camp-page-head">
      <div><h2>${t('savedLists')}</h2><p class="muted">${h(t('L2listsHint'))}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="lo-new">${t('newList')}</button>
    </div>
    ${myReqs.length ? `<div class="l2-reqs"><h3>✋ ${h(t('L2reqsMine'))}</h3>${myReqs.map((r) => `<div class="l2-prow" data-rq="${h(r.request_id)}"><b>${h(r.summary)}</b> · ${h(displayName(r.requested_by))}
      <button type="button" class="btn small-btn primary" data-rqok="approved">✓</button><button type="button" class="btn small-btn danger" data-rqok="declined">✕</button></div>`).join('')}</div>` : ''}
    ${lists.length ? `<table class="series-table lo-table">
      <thead><tr><th>${t('lbNamePh')}</th><th>${t('lbCountCol')}</th><th>${t('lbUpdated')}</th><th></th></tr></thead>
      <tbody>${lists.map((l) => {
        const see = canSee(l); const { cr } = parseSaved(l);
        return `<tr data-open="${h(l.list_id)}"${see ? '' : ' class="l2-locked"'}><td><b>${l.visibility === 'private' ? '🔒 ' : ''}${h(l.name)}</b>${cr.meta.note ? `<div class="muted small">${h(cr.meta.note)}</div>` : ''}</td>
          <td class="num">${see ? evaluate(cr).length : '—'}</td>
          <td class="muted small"><bdi dir="ltr">${h(l.updated_at || '')}</bdi> · ${h(displayName(l.created_by))}</td>
          <td class="lo-btns">${see ? `<button type="button" class="btn small-btn" data-copy="${h(l.list_id)}">${t('lbDuplicate')}</button>` : `<button type="button" class="btn small-btn" data-ask="${h(l.list_id)}">✋ ${h(t('L2askView'))}</button>`}</td></tr>`;
      }).join('')}</tbody></table>` : `<p class="empty">${t('noSavedLists')}</p>`}`;
  $('#lo-new', main).onclick = () => openBuilder();
  main.onclick = async (e) => {
    const ok = e.target.closest('[data-rqok]');
    if (ok) {
      const r = state.requests.find((x) => String(x.request_id) === ok.closest('[data-rq]').dataset.rq);
      const { decideRequest } = await import('./requests.js');
      try { await decideRequest(r, ok.dataset.rqok); await loadAll(); renderOverview(main); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
      return;
    }
    const ask = e.target.closest('[data-ask]');
    if (ask) { e.stopPropagation(); askAccess(listById(ask.dataset.ask), 'view'); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      e.stopPropagation();
      const l = listById(cp.dataset.copy);
      const { cr } = parseSaved(l);
      openBuilder(null, { name: `${l.name} (${t('copyWord')})`, criteria: { ...cr, meta: { ...cr.meta, editors: [], viewers: [] } } });
      return;
    }
    const row = e.target.closest('[data-open]');
    if (row) openBuilder(listById(row.dataset.open));
  };
}

/** קאנטאקטן → Excel (פון דער רשימה אויפן בלאט). */
export function exportContacts(name, contacts) {
  const cols = detailCols().filter(([k]) => !['don_total', 'tags', 'id'].includes(k));
  downloadXlsx(name, cols.map(([, l]) => l), contacts.map((c) => cols.map(([, , fn]) => fn({ c, key: String(c.contact_id) }))), { sheet: name });
}
void nowStamp; void saveRecord;
