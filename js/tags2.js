// 🏷 מסך התגיות החדש בכרטיס: 3 טורים (בית מדרש · ישיבה/כולל/חבורות · משפחה ורבנים),
// שורת תורם + נגיד, בר קירבה (1 = הכי קרוב) ורשימות. עורכים ישר מהכרטיס; שום דבר לא נשמר
// עד "שמור" (או "אישור" בחלונית כשסוגרים את הכרטיס). הכל נשמר באותה עמודת tags (נתיבים בעץ).
import { state, bulkSetContactFields, NESHEI_ORG } from './data.js';
import { storedTags, tagsOf, serialize, pathKey, nameOf } from './tags.js';
import { getLang } from './i18n.js';
import { escapeHtml as h, nowStamp, isTrue } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const today = () => nowStamp().slice(0, 10);

// ---------- הצמתים בעץ ----------
const BM = '1'; const BM_LV = ['301', '302', '303', '304', '305'];
const YK = '2'; const YK_LV = ['42', '40']; // צוות · תלמיד
const CH = '3'; const CH_LV = ['331', '332']; // פעיל · לפעמים
const TR = '6'; const TR_BTN = ['80', '81'];
const FAM = '5'; const FAM_BTN = ['70', '71', '72', '73', '306'];
const RB = '7'; const RB_LV = ['90', '91', '92', '93'];
const FRIEND = '14';
const LISTS = '340'; const LUACH = '341';
const GEN = '_gen'; // דור שני ושלישי באונגוואר: { p:['_gen'], s:'a' } = דלוק ביד, s:'f' = כבוי ביד; בלי = אוטומטי
const BAR = '_bar'; const NAGID = '350'; // נגידים: [350] = כלל מוסדות, [350, o:מוסד] = מוסד מסוים
const CLOSED_YESHIVOS = ['ישיבה גדולה דבארא פארק', 'ישיבה רמות ירושלים'];
const BIG_DONOR = 1800;

// ---------- טקסטים (אידיש · עברית · English) ----------
const TX = {
  title: ['תגיות', 'תגיות', 'Tags'],
  c1: ['בית המדרש', 'בית המדרש', 'Beis Medrash'],
  c2: ['ישיבה, כולל, חבורות', 'ישיבה, כולל, חבורות', 'Yeshiva, Kollel, Groups'],
  c3: ['משפחה און רבנים', 'משפחה ורבנים', 'Family & Rabbonim'],
  off: ['— אויס —', '— כבוי —', '— off —'],
  pick: ['— וועלט —', '— בחר —', '— pick —'],
  former: ['לשעבר', 'לשעבר', 'Former'],
  unchecked: ['לא נבדק', 'לא נבדק', 'Unchecked'],
  uTip: ['דריקט צו באשטעטיגן', 'לחצו לאשר', 'Click to confirm'],
  addBm: ['+ נאך א בית מדרש', '+ עוד בית מדרש', '+ another'],
  addY: ['+ נאך א ישיבה / כולל / חבורה', '+ עוד ישיבה / כולל / חבורה', '+ another'],
  yeshivos: ['ישיבות', 'ישיבות', 'Yeshivos'], kollelim: ['כוללים', 'כוללים', 'Kollelim'], chaburos: ['חבורות', 'חבורות', 'Groups'],
  tr: ['תלמידי רבותינו', 'תלמידי רבותינו', 'Talmidim'],
  parent: ['הורה לתלמיד', 'הורה לתלמיד', 'Parent of a talmid'],
  addParent: ['+ הורה לתלמיד', '+ הורה לתלמיד', '+ parent of a talmid'],
  child: ['וועלכעס קינד?', 'איזה ילד?', 'Which child?'],
  noKids: ['קיין קינדער אין משפחה-לשונית. לייגט צו דאס קינד דארט.', 'אין ילדים בלשונית המשפחה. הוסיפו את הילד שם.', 'No children in the family tab — add the child there first.'],
  family: ['משפחה', 'משפחה', 'Family'], friend: ['ידיד', 'ידיד', 'Friend'],
  rav: ['רב', 'רב', 'Rav'], rabbonim: ['רבנים', 'רבנים', 'Rabbonim'],
  donor: ['נדבות די לעצטע 3 יאר · אלע מוסדות', 'תרומות ב-3 שנים אחרונות · כל המוסדות', 'Donations, last 3 years · all'],
  bigDonor: ['תורם גדול', 'תורם גדול', 'Major donor'],
  toMoney: ['צו די נדבות ←', 'מעבר לתרומות ←', 'Donations ←'],
  nagid: ['נגיד', 'נגיד', 'Nagid'], allOrgs: ['כלל מוסדות', 'כלל מוסדות', 'All mosdos'], addOrg: ['+ נאך א מוסד', '+ עוד מוסד', '+ mosad'],
  bar: ['קירבה', 'קירבה', 'Closeness'], auto: ['אויטאמאטיש', 'אוטומטי', 'auto'], manual: ['מיט דער האנט', 'ידני', 'manual'],
  backAuto: ['צוריק אויטאמאטיש', 'חזרה לאוטומטי', 'Back to auto'],
  by: ['לויט', 'נקבע לפי', 'by'], wasAuto: ['לויט די תגיות וואלט געווען', 'לפי התגיות היה', 'by tags it would be'],
  b1: ['אנ"ש', 'אנ"ש', 'Anash'], b2: ['נאנט', 'קרוב', 'Close'], b3: ['קשר', 'קשר', 'Connected'], b4: ['ווייט', 'רחוק', 'Distant'], b5: ['נישט אקטיוו', 'לא פעיל', 'Inactive'],
  gen: ['צווייטער און דריטער דור אין אונגוואר', 'דור שני ושלישי באונגוואר', '2nd/3rd generation in Ungvar'],
  genAuto: ['אויטאמאטיש: דער טאטע איז א מתפלל', 'אוטומטי: האבא מתפלל', 'auto: the father davens here'],
  genAuto1: ['אויטאמאטיש: דער טאטע איז אנ"ש', 'אוטומטי: האבא אנ"ש', 'auto: the father is Anash'],
  anashOnly: ['אנ"ש — נאר מיט דער האנט', 'אנ"ש — רק ידני', 'Anash — manual only'],
  lists: ['ליסטעס', 'רשימות', 'Lists'], wl: ['שמחת בית אונגוואר', 'שמחת בית אונגוואר', 'Simchas Beis Ungvar'],
  neshei: ['נשי אונגוואר', 'נשי אונגוואר', 'Neshei Ungvar'], luach: ['לוח שנה', 'לוח שנה', 'Luach'],
  addList: ['+ צולייגן צו א ליסטע', '+ הוסף לרשימה', '+ add to a list'],
  dirty: ['ענדערונגען וואס זענען נאך נישט אפגעהיטן', 'יש שינויים שלא נשמרו', 'Unsaved changes'],
  save: ['היטן', 'שמור', 'Save'], cancel: ['בטל', 'בטל', 'Cancel'],
  saved: ['אפגעהיטן', 'נשמר', 'Saved'],
  legacy: ['פון דער אלטער סיסטעם', 'מהשיטה הישנה', 'old system'],
  auto2: ['אויטאמאטיש פון א משפחה-ליסטע', 'אוטומטי מרשימת משפחה', 'auto from a family list'],
  active: ['אקטיוו', 'פעיל', 'active'],
  confirmT: ['היטן די ענדערונגען?', 'לשמור את השינויים?', 'Save the changes?'],
  yes: ['אישור – היטן', 'אישור – שמור', 'OK – save'], no: ['ביטול – נישט היטן', 'ביטול – לא לשמור', 'Cancel – discard'],
  otherCard: ['אין כרטיס פון', 'בכרטיס של', 'in the card of'],
};
const L = () => ({ yi: 0, he: 1, en: 2 }[getLang()] ?? 0);
const tx = (k) => (TX[k] || [k])[L()];

// ---------- עזר ----------
const isOrg = (x) => String(x || '').startsWith('o:');
const org = (x) => String(x || '').slice(2);
const lvName = (id) => nameOf(id);
const short = (s) => String(s || '').replace(/^ביהמ"ד\s*/, '');
const yeshivaish = (s) => /ישיב/.test(s);
const listOf = (k) => (state.lists?.[k] || []).filter(Boolean);
const bmOrgs = () => listOf('beis_medrash');
const yOrgs = () => [...new Set([...listOf('kollel').filter(yeshivaish), ...CLOSED_YESHIVOS])];
const kOrgs = () => listOf('kollel').filter((x) => !yeshivaish(x));
const chOrgs = () => listOf('organization').filter((x) => x !== NESHEI_ORG);
const allOrgs = () => [...new Set(['umbrella_org', 'beis_medrash', 'kollel', 'organization'].flatMap((k) => listOf(k)))];
const typeOfOrg = (o) => (yeshivaish(o) ? 'yeshivos' : kOrgs().includes(o) ? 'kollelim' : '');
const byIdC = (id) => (state.contacts || []).find((c) => String(c.contact_id) === String(id));
const nameC = (c) => [c?.title_he, c?.first_name_he, c?.last_name_he].filter(Boolean).join(' ');
const alive = (x) => x && x.s !== 'f';

// ---------- משפחה מהקשרים ----------
function kidsOf(id) {
  const out = new Set(); const s = String(id);
  (state.relations || []).forEach((r) => {
    const a = String(r.contact_id_a); const b = String(r.contact_id_b); const t = String(r.relation_type);
    if (a === s && ['טאטע פון', 'מאמע פון'].includes(t)) out.add(b);
    if (b === s && ['זון פון', 'טאכטער פון'].includes(t)) out.add(a);
  });
  return [...out].map(byIdC).filter((c) => c && !String(c.deleted_at || '').trim());
}
function eldersOf(id) { // הורים וחותנים
  const out = new Set(); const s = String(id);
  (state.relations || []).forEach((r) => {
    const a = String(r.contact_id_a); const b = String(r.contact_id_b); const t = String(r.relation_type);
    if (b === s && ['טאטע פון', 'מאמע פון', 'שווער פון', 'שוויגער פון'].includes(t)) out.add(a);
    if (a === s && ['זון פון', 'טאכטער פון', 'איידעם פון', 'שנור פון'].includes(t)) out.add(b);
  });
  return [...out].map(byIdC).filter(Boolean);
}

function parentsOf(id) { // רק הורים (בלי חותנים)
  const out = new Set(); const s = String(id);
  (state.relations || []).forEach((r) => {
    const a = String(r.contact_id_a); const b = String(r.contact_id_b); const t = String(r.relation_type);
    if (b === s && ['טאטע פון', 'מאמע פון'].includes(t)) out.add(a);
    if (a === s && ['זון פון', 'טאכטער פון'].includes(t)) out.add(b);
  });
  return [...out].map(byIdC).filter((c) => c && !String(c.deleted_at || '').trim());
}
/** דור שני ושלישי – אוטומטי: האבא מתפלל שבת קבוע/לפעמים או ימות החול קבוע (לא לשעבר), או ילד/חתן של אנ"ש (בר 1) */
function genAuto(c) {
  let why = '';
  parentsOf(c.contact_id).forEach((p) => {
    const t = storedTags(p);
    if (t.some((x) => String(x.p[0]) === BM && isOrg(x.p[1]) && ['301', '302', '303'].includes(String(x.p[2])) && x.s !== 'f')) why = why || 'genAuto';
  });
  if (eldersOf(c.contact_id).some((p) => storedTags(p).some((x) => x.p[0] === BAR && Number(x.v) === 1))) why = 'genAuto1'; // אנ"ש דור 2 (גם חתן)
  return why;
}
/** { on, auto, manual } */
function genOf(c, list) {
  const m = list.find((x) => x.p[0] === GEN);
  const auto = genAuto(c);
  return { on: m ? m.s !== 'f' : Boolean(auto), auto, manual: Boolean(m) };
}

// ---------- תרומות ----------
function donorInfo(c) {
  const id = String(c.contact_id);
  const now = new Date(); const lim3 = new Date(now); lim3.setFullYear(now.getFullYear() - 3);
  const lim5 = new Date(now); lim5.setFullYear(now.getFullYear() - 5);
  const iso = (d) => d.toISOString().slice(0, 10);
  let sum = 0; let last = '';
  (state.donations || []).forEach((d) => {
    if (String(d.contact_id) !== id) return;
    const date = String(d.date || d.paid_date || d.created_at || '').slice(0, 10);
    if (date > last) last = date;
    if (date >= iso(lim3)) sum += Number(String(d.amount_usd || 0).replace(/[$,]/g, '')) || 0;
  });
  return { sum, last, in3: Boolean(last && last >= iso(lim3)), in5: Boolean(last && last >= iso(lim5)), ever: Boolean(last) };
}

// ---------- בר קירבה ----------
/** מחזיר { lv: 1..5, why } לפי התגיות (list = התגיות + האוטומטיות) */
function autoBar(c, list) {
  let best = 5; let why = '';
  const put = (lv, w) => { if (lv < best) { best = lv; why = w; } };
  const lbl = (x) => x.p.filter((q) => !String(q).startsWith('_')).map((q) => (isOrg(q) ? short(org(q)) : lvName(q))).join(' · ');
  const act = (x) => x.s !== 'f';
  let hasActive = false;
  list.forEach((x) => {
    const [r, a, b] = x.p.map(String);
    if (r === BM && isOrg(a) && BM_LV.includes(b)) {
      const i = BM_LV.indexOf(b);
      if (act(x)) { hasActive = true; put(i === 0 || i === 2 || i === 3 ? 2 : i === 1 ? 3 : 4, lbl(x)); } else put(i <= 1 ? 3 : 4, `${lbl(x)} (${tx('former')})`);
    } else if (r === YK && isOrg(a) && YK_LV.includes(b)) {
      if (act(x)) { hasActive = true; put(2, lbl(x)); } else put(3, `${lbl(x)} (${tx('former')})`);
    } else if (r === CH && isOrg(a) && CH_LV.includes(b)) {
      if (act(x)) { hasActive = true; put(b === '331' ? 2 : 3, lbl(x)); } else put(4, `${lbl(x)} (${tx('former')})`);
    } else if (r === RB && RB_LV.includes(a)) {
      const i = RB_LV.indexOf(a);
      if (act(x)) { hasActive = true; put(i <= 1 ? 2 : i === 2 ? 3 : 4, lbl(x)); } else put(4, `${lbl(x)} (${tx('former')})`);
    } else if (r === FAM && act(x)) { hasActive = true; const f = String(x.p[1]); put(f === '70' ? 2 : f === '71' || f === '72' ? 3 : 4, lbl(x)); } // קליין 2 · בלום-פרענקל/דנציגר 3 · אלכסנדר/רשימת הרבנית 4
    else if (r === TR && act(x)) put(3, lbl(x));
    else if (r === FRIEND && act(x)) put(3, tx('friend'));
  });
  // הורה לתלמיד
  kidsOf(c.contact_id).forEach((k) => {
    storedTags(k).forEach((x) => {
      if (String(x.p[0]) === YK && String(x.p[2]) === '40') put(alive(x) ? 3 : 4, `${tx('parent')} · ${short(org(x.p[1]))} · ${k.first_name_he || ''}`);
    });
  });
  // אנ"ש דור 2
  if (genOf(c, list).on) put(3, tx('gen'));
  // תורם
  const d = donorInfo(c);
  if (d.in3) put(hasActive ? 2 : 3, tx('donor').split('·')[0].trim());
  else if (d.in5) put(3, `${tx('donor').split('·')[0].trim()} (3–5)`);
  else if (d.ever) put(4, `${tx('donor').split('·')[0].trim()} (5+)`);
  return { lv: best, why };
}

// ---------- מצב טיוטה (פר כרטיס) ----------
let D = null; // { id, base, list, wl, neshei, others: Map(id→list), sig }
function freshDraft(c) {
  return { id: String(c.contact_id), list: storedTags(c), wl: isTrue(c.wedding_list), neshei: isTrue(c.wife_in_neshei), others: new Map(), slots: { bm: 0, y: 0, nagid: 0 } };
}
const sigOf = (d) => JSON.stringify([serialize(d.list), d.wl, d.neshei, [...d.others.entries()].map(([k, v]) => [k, serialize(v)])]);
export function tags2Dirty() { return Boolean(D && D.sig !== sigOf(D)); }

// ---------- HTML ----------
const sel = (cls, opts, cur, empty) => `<select class="${cls}">${empty !== null ? `<option value="">${h(empty)}</option>` : ''}${opts.map(([v, l]) => `<option value="${h(v)}"${String(v) === String(cur) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`;
const slider = (levels, idx, dis) => `<div class="t2-sl"><input type="range" min="0" max="${levels.length - 1}" step="1" value="${levels.length - 1 - Math.max(0, idx)}"${dis ? ' disabled' : ''} aria-label="level">
  <div class="t2-lv">${levels.map((l, i) => `<span class="${!dis && i === idx ? 'cur' : ''}">${h(l)}</span>`).join('')}</div></div>`;
const stBtns = (x, i, kind) => `<div class="t2-stb">${x.s === 'u' ? `<button type="button" class="t2-u" data-act="verify" data-k="${kind}" data-i="${i}" title="${h(tx('uTip'))}">⚠ ${h(tx('unchecked'))}</button>` : ''}
  <button type="button" class="t2-fm${x.s === 'f' ? ' on' : ''}" data-act="former" data-k="${kind}" data-i="${i}">${h(tx('former'))}</button></div>`;

function entries(kind) {
  return D.list.map((x, i) => ({ x, i })).filter(({ x }) => {
    const [r, a, b] = x.p.map(String);
    if (kind === 'bm') return r === BM && (x._new || (isOrg(a) && BM_LV.includes(b)));
    if (kind === 'y') return x._newY || ((r === YK && isOrg(a) && YK_LV.includes(b)) || (r === CH && isOrg(a) && CH_LV.includes(b) && org(a) !== NESHEI_ORG));
    return false;
  });
}
function legacyLines(c) {
  const known = (x) => {
    const [r, a, b] = x.p.map(String);
    if (String(r).startsWith('_')) return true;
    if (r === BM && isOrg(a) && BM_LV.includes(b)) return true;
    if (r === YK && isOrg(a) && YK_LV.includes(b)) return true;
    if (r === CH && isOrg(a) && (CH_LV.includes(b) || org(a) === NESHEI_ORG)) return true;
    if (r === TR && TR_BTN.includes(a)) return true;
    if (r === FAM && FAM_BTN.includes(a)) return true;
    if (r === RB && RB_LV.includes(a)) return true;
    if (r === FRIEND && x.p.length === 1) return true;
    if (r === LISTS || r === NAGID) return true;
    if (r === '9') return true; // תורמים — בשורת התורם
    return false;
  };
  return D.list.filter((x) => !x._new && !x._newY && !known(x));
}

function colBm() {
  const ents = entries('bm');
  const orgs = bmOrgs().map((o) => [o, short(o)]);
  const levels = BM_LV.map(lvName);
  const slot = ({ x, i }) => {
    const o = isOrg(x.p[1]) ? org(x.p[1]) : '';
    const li = BM_LV.indexOf(String(x.p[2]));
    return `<div class="t2-slot${x.s === 'f' ? ' was' : ''}${!o ? ' off' : ''}">${sel('t2-bmorg', orgs, o, tx('off')).replace('<select', `<select data-act="bmorg" data-i="${i}"`)}
      ${slider(levels, li < 0 ? 0 : li, !o).replace('<input', `<input data-act="bmlv" data-i="${i}"`)}${o ? stBtns(x, i, 'bm') : ''}</div>`;
  };
  return `<div class="t2-col"><h4>${h(tx('c1'))}</h4>${ents.map(slot).join('')}
    <button type="button" class="t2-add" data-act="addbm">${h(tx('addBm'))}</button></div>`;
}

function colY(c) {
  const ents = entries('y');
  const slot = ({ x, i }) => {
    const [r, a, b] = x.p.map(String);
    const o = isOrg(a) ? org(a) : '';
    const type = x._type || (r === CH ? 'chaburos' : typeOfOrg(o) || 'yeshivos');
    const items = type === 'chaburos' ? chOrgs() : type === 'kollelim' ? kOrgs() : yOrgs();
    const levels = (type === 'chaburos' ? CH_LV : YK_LV).map(lvName);
    const li = (type === 'chaburos' ? CH_LV : YK_LV).indexOf(b);
    const types = [['yeshivos', tx('yeshivos')], ['kollelim', tx('kollelim')], ['chaburos', tx('chaburos')]];
    return `<div class="t2-slot${x.s === 'f' ? ' was' : ''}${!o ? ' off' : ''}">
      ${sel('', types, type, null).replace('<select', `<select data-act="ytype" data-i="${i}"`)}
      ${sel('', items.map((v) => [v, v]), o, tx('pick')).replace('<select', `<select data-act="yorg" data-i="${i}"`)}
      ${slider(levels, li < 0 ? (type === 'chaburos' ? 0 : 1) : li, !o).replace('<input', `<input data-act="ylv" data-i="${i}"`)}${o ? stBtns(x, i, 'y') : ''}</div>`;
  };
  const trOn = (id) => D.list.some((x) => String(x.p[0]) === TR && String(x.p[1]) === id && x.s !== 'f');
  const kids = kidsOf(c.contact_id);
  const kidLines = [];
  kids.forEach((k) => {
    const lst = D.others.get(String(k.contact_id)) || storedTags(k);
    lst.forEach((x) => { if (String(x.p[0]) === YK && String(x.p[2]) === '40') kidLines.push({ k, o: org(x.p[1]), s: x.s }); });
  });
  return `<div class="t2-col"><h4>${h(tx('c2'))}</h4>${ents.map(slot).join('')}
    <button type="button" class="t2-add" data-act="addy">${h(tx('addY'))}</button>
    <div class="t2-sub"><b>${h(tx('tr'))}</b><div class="t2-btns">${TR_BTN.map((id) => `<button type="button" class="t2-tg${trOn(id) ? ' on' : ''}" data-act="tr" data-id="${id}">${trOn(id) ? '☑' : '☐'} ${h(lvName(id))}</button>`).join('')}</div></div>
    <div class="t2-sub"><b>${h(tx('parent'))}</b>
      ${kidLines.map((l) => `<div class="t2-kid${l.s === 'f' ? ' was' : ''}">${h(l.o)} · <a href="#" data-open="${h(l.k.contact_id)}">${h(nameC(l.k))}</a> (${h(l.s === 'f' ? tx('former') : l.s === 'u' ? tx('unchecked') : tx('active'))})</div>`).join('')}
      <div class="t2-kidadd" hidden>${kids.length ? `${sel('', kids.map((k) => [k.contact_id, nameC(k)]), '', tx('child')).replace('<select', '<select data-act="kid"')}
        ${sel('', yOrgs().map((v) => [v, v]), '', tx('pick')).replace('<select', '<select data-act="kidorg"')}` : `<p class="muted small">${h(tx('noKids'))}</p>`}</div>
      <button type="button" class="t2-add" data-act="addkid">${h(tx('addParent'))}</button></div></div>`;
}

function col3(c) {
  const auto = tagsOf(c).filter((x) => x.fam || (x.s !== 'auto' && !D.list.some((y) => pathKey(y.p) === pathKey(x.p)) && String(x.p[0]) === FAM));
  const famOn = (id) => D.list.some((x) => String(x.p[0]) === FAM && String(x.p[1]) === id && x.s !== 'f');
  const famAuto = (id) => auto.some((x) => String(x.p[1]) === id);
  const fr = D.list.some((x) => String(x.p[0]) === FRIEND && x.p.length === 1 && x.s !== 'f');
  const rb = D.list.find((x) => String(x.p[0]) === RB && RB_LV.includes(String(x.p[1])));
  const ri = rb ? RB_LV.indexOf(String(rb.p[1])) : 2;
  return `<div class="t2-col"><h4>${h(tx('c3'))}</h4>
    <div class="t2-sub"><b>${h(tx('family'))}</b><div class="t2-btns">${FAM_BTN.filter((id) => lvName(id) && !lvName(id).startsWith('#')).map((id) => {
      const on = famOn(id) || famAuto(id);
      return `<button type="button" class="t2-tg${on ? ' on' : ''}" data-act="fam" data-id="${id}"${famAuto(id) && !famOn(id) ? ` disabled title="${h(tx('auto2'))}"` : ''}>${on ? '☑' : '☐'} ${h(lvName(id))}${famAuto(id) && !famOn(id) ? ' 🤖' : ''}</button>`;
    }).join('')}
      <button type="button" class="t2-tg${fr ? ' on' : ''}" data-act="friend">${fr ? '☑' : '☐'} ${h(tx('friend'))}</button></div></div>
    <div class="t2-slot${rb?.s === 'f' ? ' was' : ''}${!rb ? ' off' : ''}"><label class="t2-chk"><input type="checkbox" data-act="rbon"${rb ? ' checked' : ''}> ${h(tx('rabbonim'))}</label>
      ${slider(RB_LV.map(lvName), ri, !rb).replace('<input', '<input data-act="rblv"')}
      ${rb ? stBtns(rb, D.list.indexOf(rb), 'rb') : ''}</div></div>`;
}

function donorRow(c) {
  const d = donorInfo(c);
  const ngs = D.list.map((x, i) => ({ x, i })).filter(({ x }) => String(x.p[0]) === NAGID);
  const ng = ngs.length > 0;
  const opts = allOrgs().map((o) => [o, o]);
  return `<div class="t2-donor"><div><div class="muted small">${h(tx('donor'))}</div><div class="t2-sum">$${Math.round(d.sum).toLocaleString('en-US')}</div></div>
    ${d.sum >= BIG_DONOR ? `<span class="t2-big">${h(tx('bigDonor'))}</span>` : ''}
    <button type="button" class="linkish" data-act="money">${h(tx('toMoney'))}</button>
    <span class="spacer"></span>
    <button type="button" class="t2-sw${ng ? ' on' : ''}" data-act="nagid" aria-pressed="${ng ? 'true' : 'false'}"><i></i> ${h(tx('nagid'))}</button>
    ${ng ? `<div class="t2-ng">${ngs.map(({ x, i }) => `<span class="t2-ngr">${sel('', opts, isOrg(x.p[1]) ? org(x.p[1]) : '', tx('allOrgs')).replace('<select', `<select data-act="ngorg" data-i="${i}"`)}${ngs.length > 1 ? `<button type="button" class="linkish" data-act="ngdel" data-i="${i}">✕</button>` : ''}</span>`).join('')}
      <button type="button" class="linkish" data-act="ngadd">${h(tx('addOrg'))}</button></div>` : ''}</div>`;
}

function genSw(c) {
  const g = genOf(c, D.list);
  const tip = g.auto && !g.manual ? tx(g.auto) : g.manual ? tx('manual') : '';
  return `<button type="button" class="t2-sw t2-sw-s${g.on ? ' on' : ''}" data-act="gen" aria-pressed="${g.on ? 'true' : 'false'}"${tip ? ` title="${h(tip)}"` : ''}><i></i> ${h(tx('gen'))}${g.on && g.auto && !g.manual ? ' 🤖' : ''}</button>`;
}

function barRow(c) {
  const a = autoBar(c, [...D.list, ...tagsOf(c).filter((x) => x.fam)]);
  const m = D.list.find((x) => x.p[0] === BAR);
  const v = m ? Number(m.v) : a.lv;
  const names = ['b1', 'b2', 'b3', 'b4', 'b5'];
  return `<div class="t2-barh"><span>${h(tx('bar'))}: <b>${h(m ? tx('manual') : tx('auto'))}</b></span>${m ? `<button type="button" class="linkish" data-act="barauto">${h(tx('backAuto'))}</button>` : ''}</div>
    <div class="t2-bar">${names.map((n, i) => `<button type="button" class="${i + 1 >= v ? 'on' : ''}${i === 0 ? ' top' : ''}${i + 1 === v ? ' cur' : ''}" data-act="bar" data-v="${i + 1}">${i + 1} · ${h(tx(n))}</button>`).join('')}</div>
    <div class="t2-byrow"><p class="muted small">${m ? `${h(tx('wasAuto'))}: ${a.lv} · ${h(tx(names[a.lv - 1]))}${a.why ? ` (${h(a.why)})` : ''}` : a.why ? `${h(tx('by'))}: ${h(a.why)}` : ''} · ${h(tx('anashOnly'))}</p>${genSw(c)}</div>`;
}

function listsRow() {
  const nOn = D.neshei;
  const lu = D.list.some((x) => String(x.p[0]) === LISTS && String(x.p[1]) === LUACH && x.s !== 'f');
  const b = (act, on, label) => `<button type="button" class="t2-tg${on ? ' on' : ''}" data-act="${act}">${on ? '☑' : '☐'} ${h(label)}</button>`;
  return `<div class="t2-lists"><b>${h(tx('lists'))}</b>${b('wl', D.wl, tx('wl'))}${b('neshei', nOn, tx('neshei'))}${b('luach', lu, tx('luach'))}
    <button type="button" class="linkish" data-act="listadd">${h(tx('addList'))}</button></div>`;
}

export function tags2Html(c) {
  if (!D || D.id !== String(c.contact_id)) { D = freshDraft(c); D.sig = sigOf(D); }
  const leg = legacyLines(c);
  return `<section class="t2-card" data-cid="${h(c.contact_id)}">
    <div class="t2-dirty"${tags2Dirty() ? '' : ' hidden'}><span>⚠ ${h(tx('dirty'))}</span><button type="button" class="btn primary small-btn" data-act="save">${h(tx('save'))}</button><button type="button" class="btn small-btn" data-act="discard">${h(tx('cancel'))}</button></div>
    <h3>🏷 ${h(tx('title'))}<span class="t2-clips"><a href="https://drive.google.com/file/d/1BDlGeRzUQXU83twafPZ7-LamFyIUHzMS/view" target="_blank" rel="noopener">▶ הסבר אויף די תגיות (קליפ)</a><a href="https://drive.google.com/file/d/1GSrobrNHR1A3Cfi5L-25HOwODzSJbGPO/view" target="_blank" rel="noopener" dir="ltr">▶ Tags explained (clip)</a></span></h3>
    <div class="t2-cols">${colBm()}${colY(c)}${col3(c)}</div>
    ${leg.length ? `<p class="t2-legacy muted small">◦ ${h(tx('legacy'))}: ${h(leg.map((x) => x.p.map((q) => (isOrg(q) ? org(q) : nameOf(q))).join(' › ') + (x.s === 'f' ? ` (${tx('former')})` : '')).join(' · '))}</p>` : ''}
    ${donorRow(c)}
    ${barRow(c)}
    ${listsRow()}
  </section>`;
}

// ---------- שינויים ----------
function change(x, fn) { fn(x); if (x.s !== 'u') x.d = today(); }
function setLevel(i, root, levels, idx) {
  const x = D.list[i]; if (!x) return;
  x.p = [root, x.p[1], levels[idx]];
}

/** החלונית "מה השתנה" (שורות טקסט) */
export function tags2Changes(c) {
  if (!D) return [];
  const lbl = (x) => x.p.map((q) => (String(q) === BAR ? tx('bar') : String(q) === GEN ? tx('gen') : String(q) === NAGID ? tx('nagid') : isOrg(q) ? org(q) : nameOf(q))).join(' › ') + (String(x.p[0]) === NAGID && x.p.length === 1 ? ` › ${tx('allOrgs')}` : '')
    + (x.p[0] === BAR ? ` = ${x.v}` : '') + (x.s === 'f' ? ` (${tx('former')})` : '');
  const before = storedTags(byIdC(D.id) || c);
  const now = D.list.filter((x) => !x._new && !x._newY);
  const key = (x) => `${pathKey(x.p)}|${x.s}|${JSON.stringify(x.v ?? '')}`;
  const out = [];
  now.forEach((x) => { if (!before.some((y) => key(y) === key(x))) out.push(`+ ${lbl(x)}`); });
  before.forEach((y) => { if (!now.some((x) => key(x) === key(y))) out.push(`− ${lbl(y)}`); });
  const cc = byIdC(D.id) || c;
  if (D.wl !== isTrue(cc.wedding_list)) out.push(`${D.wl ? '+' : '−'} ${tx('wl')}`);
  if (D.neshei !== isTrue(cc.wife_in_neshei)) out.push(`${D.neshei ? '+' : '−'} ${tx('neshei')}`);
  D.others.forEach((lst, id) => { out.push(`+ ${tx('otherCard')} ${nameC(byIdC(id))}: ${tx('parent')} → ${lst.filter((x) => String(x.p[0]) === YK).map((x) => org(x.p[1])).pop() || ''}`); });
  return out;
}

export async function tags2Save(c) {
  if (!D || !tags2Dirty()) return;
  const clean = (lst) => lst.filter((x) => !x._new && !x._newY && x.p.length).map((x) => { const y = { ...x }; delete y._type; return y; });
  const set = { tags: serialize(clean(D.list)) };
  const cc = byIdC(D.id) || c;
  if (D.wl !== isTrue(cc.wedding_list)) { set.wedding_list = D.wl ? 'TRUE' : ''; set.wedding_set = D.wl ? 'on' : 'off'; }
  if (D.neshei !== isTrue(cc.wife_in_neshei)) set.wife_in_neshei = D.neshei ? 'TRUE' : 'FALSE';
  const changes = [{ c: cc, set }];
  D.others.forEach((lst, id) => { const k = byIdC(id); if (k) changes.push({ c: k, set: { tags: serialize(clean(lst)) } }); });
  const note = `🏷 ${tags2Changes(c).join(' · ')}`.slice(0, 900);
  await bulkSetContactFields(changes, note);
  changes.forEach(({ c: x, set: s }) => Object.assign(x, s));
  D = freshDraft(cc); D.sig = sigOf(D);
}
export function tags2Discard() { D = null; }

/** wire: opts = { rerender, showTab, openCard, openListAdd, toast, friendlyError } */
export function wireTags2(box, c, opts) {
  if (!box) return;
  const redraw = () => opts.rerender();
  const sync = (x) => { if (x && !x._new && !x._newY) delete x._type; };
  const neshKey = `o:${NESHEI_ORG}`;
  const setNeshei = (on) => {
    D.neshei = on;
    const ix = D.list.findIndex((x) => String(x.p[0]) === CH && String(x.p[1]) === neshKey);
    if (on && ix < 0) D.list.push({ p: [CH, neshKey], s: 'a', d: today() });
    if (on && ix >= 0) D.list[ix].s = 'a';
    if (!on && ix >= 0) D.list.splice(ix, 1);
  };
  box.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act; const i = Number(el.dataset.i);
    if (act === 'bmorg') {
      if (!el.value) D.list.splice(i, 1);
      else { const x = D.list[i]; const lv = BM_LV.includes(String(x.p[2])) ? String(x.p[2]) : BM_LV[0]; x.p = [BM, `o:${el.value}`, lv]; delete x._new; if (!x.s) x.s = 'a'; x.d = today(); }
    } else if (act === 'ytype') { const x = D.list[i]; x._type = el.value; x._newY = true; x.p = [el.value === 'chaburos' ? CH : YK]; }
    else if (act === 'yorg') {
      const x = D.list[i];
      if (!el.value) { D.list.splice(i, 1); } else {
        const type = x._type || (String(x.p[0]) === CH ? 'chaburos' : 'yeshivos');
        const ch = type === 'chaburos';
        const lv = (ch ? CH_LV : YK_LV).includes(String(x.p[2])) ? String(x.p[2]) : (ch ? CH_LV[0] : YK_LV[1]);
        x.p = [ch ? CH : YK, `o:${el.value}`, lv]; delete x._newY; x._type = type; if (!x.s) x.s = 'a'; x.d = today(); sync(x);
      }
    } else if (act === 'kid' || act === 'kidorg') {
      const wrap = el.closest('.t2-kidadd'); const kid = $('[data-act="kid"]', wrap)?.value; const o = $('[data-act="kidorg"]', wrap)?.value;
      if (kid && o) {
        const k = byIdC(kid); if (!k) return;
        const lst = D.others.get(String(kid)) || storedTags(k);
        if (!lst.some((x) => String(x.p[0]) === YK && String(x.p[1]) === `o:${o}` && String(x.p[2]) === '40')) lst.push({ p: [YK, `o:${o}`, '40'], s: 'a', d: today() });
        D.others.set(String(kid), lst);
      } else return;
    } else if (act === 'rbon') {
      const ix = D.list.findIndex((x) => String(x.p[0]) === RB && RB_LV.includes(String(x.p[1])));
      if (el.checked && ix < 0) D.list.push({ p: [RB, RB_LV[2]], s: 'a', d: today() });
      if (!el.checked && ix >= 0) D.list.splice(ix, 1);
    } else if (act === 'ngorg') {
      const x = D.list[i]; if (!x) return;
      x.p = el.value ? [NAGID, `o:${el.value}`] : [NAGID]; x.d = today();
    } else return;
    redraw();
  });
  box.addEventListener('input', (e) => {
    const el = e.target.closest('input[type=range][data-act]'); if (!el) return;
    const act = el.dataset.act; const i = Number(el.dataset.i);
    if (act === 'bmlv') setLevel(i, BM, BM_LV, BM_LV.length - 1 - Number(el.value));
    else if (act === 'ylv') { const x = D.list[i]; const ch = String(x.p[0]) === CH; const lv = ch ? CH_LV : YK_LV; setLevel(i, ch ? CH : YK, lv, lv.length - 1 - Number(el.value)); }
    else if (act === 'rblv') { const x = D.list.find((y) => String(y.p[0]) === RB && RB_LV.includes(String(y.p[1]))); if (x) x.p = [RB, RB_LV[RB_LV.length - 1 - Number(el.value)]]; }
    redraw();
  });
  box.addEventListener('click', async (e) => {
    const a = e.target.closest('a[data-open]');
    if (a) { e.preventDefault(); opts.openCard(a.dataset.open); return; }
    const el = e.target.closest('button[data-act]'); if (!el) return;
    const act = el.dataset.act; const i = Number(el.dataset.i);
    if (act === 'save') { el.disabled = true; try { await tags2Save(c); opts.toast(tx('saved')); } catch (err) { opts.toast(opts.friendlyError(err), 'error'); } redraw(); return; }
    if (act === 'discard') { D = null; redraw(); return; }
    if (act === 'money') { opts.showTab('money'); return; }
    if (act === 'listadd') { opts.openListAdd(c); return; }
    if (act === 'addkid') { const w = $('.t2-kidadd', box); if (w) w.hidden = !w.hidden; return; }
    if (act === 'former' || act === 'verify') {
      const x = D.list[i]; if (!x) return;
      if (act === 'verify') change(x, (y) => { y.s = y.o === 'f' ? 'f' : 'a'; delete y.o; });
      else change(x, (y) => { y.s = y.s === 'f' ? 'a' : 'f'; delete y.o; });
    } else if (act === 'addbm') D.list.push({ p: [BM], s: 'a', _new: true });
    else if (act === 'addy') D.list.push({ p: [YK], s: 'a', _newY: true, _type: 'yeshivos' });
    else if (act === 'tr' || act === 'fam') {
      const root = act === 'tr' ? TR : FAM; const id = el.dataset.id;
      const ix = D.list.findIndex((x) => String(x.p[0]) === root && String(x.p[1]) === id);
      if (ix >= 0) D.list.splice(ix, 1); else D.list.push({ p: [root, id], s: 'a', d: today() });
    } else if (act === 'friend') {
      const ix = D.list.findIndex((x) => String(x.p[0]) === FRIEND && x.p.length === 1);
      if (ix >= 0) D.list.splice(ix, 1); else D.list.push({ p: [FRIEND], s: 'a', d: today() });
    } else if (act === 'nagid') {
      if (D.list.some((x) => String(x.p[0]) === NAGID)) D.list = D.list.filter((x) => String(x.p[0]) !== NAGID);
      else D.list.push({ p: [NAGID], s: 'a', d: today() });
    } else if (act === 'ngadd') {
      const used = D.list.filter((x) => String(x.p[0]) === NAGID).map((x) => org(x.p[1]));
      const free = allOrgs().find((o) => !used.includes(o)); if (free) D.list.push({ p: [NAGID, `o:${free}`], s: 'a', d: today() });
    } else if (act === 'ngdel') { D.list.splice(i, 1); }
    else if (act === 'bar') {
      const v = Number(el.dataset.v); const ix = D.list.findIndex((x) => x.p[0] === BAR);
      if (ix >= 0) D.list[ix].v = v; else D.list.push({ p: [BAR], s: 'ok', v, d: today() });
    } else if (act === 'gen') {
      const g = genOf(c, D.list); const want = !g.on;
      D.list = D.list.filter((x) => x.p[0] !== GEN);
      if (want !== Boolean(g.auto)) D.list.push({ p: [GEN], s: want ? 'a' : 'f', d: today() });
    } else if (act === 'barauto') { const ix = D.list.findIndex((x) => x.p[0] === BAR); if (ix >= 0) D.list.splice(ix, 1); }
    else if (act === 'wl') D.wl = !D.wl;
    else if (act === 'neshei') setNeshei(!D.neshei);
    else if (act === 'luach') {
      const ix = D.list.findIndex((x) => String(x.p[0]) === LISTS && String(x.p[1]) === LUACH);
      if (ix >= 0) D.list.splice(ix, 1); else D.list.push({ p: [LISTS, LUACH], s: 'a', d: today() });
    } else return;
    redraw();
  });
}

/** לפני סגירה / מעבר לכרטיס אחר: true = אפשר להמשיך */
export async function tags2Guard(c, choose) {
  if (!tags2Dirty()) { D = null; return true; }
  const lines = tags2Changes(c);
  const ans = await choose(`🏷 ${tx('confirmT')}`, lines.join('\n'), [['save', tx('yes'), true], ['', tx('no')]]);
  if (ans === null) return false; // סגרו את החלונית — נשארים בכרטיס
  if (ans === 'save') { await tags2Save(c); D = null; return 'saved'; }
  D = null; return true;
}

// בשביל הבר ברשימות ובקו הגבאים
export function barOf(c) {
  const m = storedTags(c).find((x) => x.p[0] === BAR);
  if (m) return Number(m.v) || 5;
  return autoBar(c, tagsOf(c)).lv;
}
