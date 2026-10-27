// "שהשמחה במעונם" — די מזל טובים פון דער וואך פארן גליון (האלב בלאט אמעריקאנער, 5.5×8.5).
// יעדע שמחה: בעלי השמחה (קאנטאקטן פון מאגר) + סוג + דער ילד/חתן + צד שני. דער טעקסט ווערט געבויט פון די כרטיסן:
// תואר + נאמען (משפחה פעט) + סיומת (שליט"א א.א.וו.), און "לרגל ..." מיט דער קרבה (בנו-נכדו...) וואס ווערט אויסגערעכנט
// פון די קשרים אין די כרטיסן. נייע קשרים צווישן בעלי השמחה ווערן אריינגעלייגט אין די כרטיסן.
// לשונית Simchos (גיליון). די הערה נאכן נאמען (למשל "אב"ד בערז'אן") — אין כרטיס, קאלום name_note.
import { state, loadAll, saveRecord, deleteRecord, saveContact, addRelation, removeRelation, displayName } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h } from './util.js';
import { toHebrew, monthHe, hebrewNumber, todayIso, fromHebrew } from './hebdate.js';
import { parashaOf, shabbatOfWeek, shabbatTitle } from './parasha.js';
import { customFontNames } from './fonts.js';
import { htmlToJpeg, jpegsToPdf } from './pdf.js';
import { otherSheet } from './google.js';
import { CONFIG } from './config.js';
import { nowStamp, shrinkImage } from './util.js';
import { storeImage, fetchImages, imageOf, isDrv } from './images.js';
import { tagsOf as tagEntries, nameOf as tagNodeName, roots as tagRoots, UNCHECKED as TAG_U } from './tags.js';

/** בלויז פאר די גבאים (נישט אין דער תצוגה): ווער האט צוגעלייגט די שמחה */
function addedByHtml(s) {
  if (!s.created_by) return '';
  const d = String(s.created_at || '').slice(0, 10).split('-');
  const when = d.length === 3 ? ` · ${Number(d[2])}/${Number(d[1])}` : '';
  return `<div class="sg-by">👤 ${h(t('sgAddedBy', { name: displayName(s.created_by) }))}${when}</div>`;
}

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function initSimchos(helpers) { ui = helpers; }

const TYPES = {
  birth: { label: 'הולדת', pre: 'לרגל הולדת', post: '' },
  upsherin: { label: 'אפשערן', pre: 'לרגל שמחת האפשערן של', post: '' },
  barmitzvah: { label: 'בר מצוה', pre: 'לרגל הכנסת', post: 'לעול התורה והמצוות' },
  erusin: { label: 'אירוסין', pre: 'לרגל אירוסי', post: '', other: true },
  nisuin: { label: 'נישואין', pre: 'לרגל נישואי', post: '', other: true },
};
const SUFFIXES = ['ני"ו', 'הי"ו', 'שליט"א'];
// "א TYPE ב": א איז מיט אזויפיל דורות העכער ווי ב
const DELTA = { 'טאטע פון': 1, 'זון פון': -1, 'שווער פון': 1, 'איידעם פון': -1, 'זיידע פון': 2, 'אייניקל פון': -2, 'ברודער פון': 0, 'שוואגער פון': 0 };
const TO_CHILD = [['1', 'טאטע'], ['2', 'זיידע'], ['3', 'עלטער-זיידע'], ['0', 'ער אליין']];
// "ער אליין": דער בעל שמחה איז דער חתן / בר מצוה בחור / די כלה
const SELF = { erusin: { m: 'לרגל אירוסיו', f: 'לרגל אירוסיה' }, nisuin: { m: 'לרגל נישואיו', f: 'לרגל נישואיה' }, barmitzvah: { m: 'לרגל הכנסו', f: 'לרגל הכנסו' } };
const isSelf = (s) => { const f = parseH(s)[0]; return !!(f && String(f.toChild) === '0' && SELF[s.type]); };
const WORDS = {
  m: { 1: ['בנו', 'בנם'], 2: ['נכדו', 'נכדם'], 3: ['נינו', 'נינם'] },
  f: { 1: ['בתו', 'בתם'], 2: ['נכדתו', 'נכדתם'], 3: ['נינתו', 'נינתם'] },
};

const cur = { week: '' };
// ---------- גליונות: יעדע שבת, און א יום טוב אין מיטן וואך ווען מ'האט אנגעצייכנט ☑ (לשונית SimchaIssues) ----------
const DAYMS = 86400000;
const addDays = (iso, n) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * DAYMS).toISOString().slice(0, 10);
const dow = (iso) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay();
// [חודש, ערשטער טאג, לעצטער טאג (חו"ל), נאמען פונעם גליון]
const YT_DEF = [['Tishri', 1, 2, 'ראש השנה'], ['Tishri', 10, 10, 'יום כיפור'], ['Tishri', 15, 16, 'חג הסוכות'],
  ['Tishri', 22, 23, 'שמחת תורה'], ['Nisan', 15, 16, 'חג הפסח'], ['Sivan', 6, 7, 'חג השבועות']];
const ytCache = new Map();
function ytOfYear(y) {
  if (!ytCache.has(y)) ytCache.set(y, YT_DEF.map(([m, d1, d2, title]) => ({ start: fromHebrew(d1, m, y), end: fromHebrew(d2, m, y), title })).filter((x) => x.start));
  return ytCache.get(y);
}
/** די ימים טובים וואס הייבן זיך אן אין דער וואך פון שבת S (זונטאג–שבת); touching = פרייטאג/שבת איז יום טוב */
function ytInWeek(S) {
  const y = toHebrew(S)?.y;
  if (!y) return [];
  const sun = addDays(S, -6);
  return [...ytOfYear(y - 1), ...ytOfYear(y), ...ytOfYear(y + 1)].filter((x) => x.start >= sun && x.start <= S)
    .map((x) => ({ ...x, touching: x.end >= addDays(S, -1) }));
}
const ytByStart = (iso) => { const y = toHebrew(iso)?.y; return y ? ytOfYear(y).find((x) => x.start === iso) : null; };
const issueOn = (start) => (state.simchaIssues || []).some((r) => r.yt_date === start && isOn(r.on));
/** די גליונות פון דער וואך (שבת S): די אנגעצייכנטע ימים טובים אין מיטן וואך, און דערנאך די שבת */
function issuesOfWeek(S) { return [...ytInWeek(S).filter((x) => !x.touching && issueOn(x.start)).map((x) => x.start), S]; }
const issueEnd = (key) => ytByStart(key)?.end || key;
const isYtIssue = (key) => dow(key) !== 6 && !!ytByStart(key);
/** דער גליון פון א טאג: דער ערשטער גליון אין יענער וואך וואס האט זיך נאך נישט געענדיגט */
function issueForDate(d) { const S = shabbatOfWeek(d); return issuesOfWeek(S).find((k) => issueEnd(k) >= d) || S; }
const weekNow = () => issueForDate(todayIso());
function nextIssue(key) {
  const S = shabbatOfWeek(key); const list = issuesOfWeek(S); const i = list.indexOf(key);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : issuesOfWeek(addDays(S, 7))[0];
}
function prevIssue(key) {
  const S = shabbatOfWeek(key); const list = issuesOfWeek(S); const i = list.indexOf(key);
  if (i > 0) return list[i - 1];
  const p = issuesOfWeek(addDays(S, -7)); return p[p.length - 1];
}
/** דער טיטל פון א גליון: "חג הסוכות" / "פרשת לך לך" / "שבת ראש השנה"; א יום טוב וואס רירט אן שבת (פרייטאג) — נאר דער נאמען */
export function issueTitle(key) {
  if (isYtIssue(key)) return ytByStart(key).title;
  const touch = ytInWeek(key).find((x) => x.touching && dow(x.start) !== 6 && !(x.start <= key && x.end >= key));
  if (touch) return touch.title;
  return shabbatTitle(key);
}
const contactOf = (id) => (id ? ui.contactById(id) : null);
const bySort = (a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || Number(a.simcha_id) - Number(b.simcha_id);
const isOn = (v) => v === true || String(v).toUpperCase() === 'TRUE';
/** די שמחות פון א וואך: ערשט די וואס זענען אריינגעקומען ערב שבת די פאריגע וואך (_carried), דערנאך די פון די וואך */
const ownOf = (week) => (state.simchos || []).filter((s) => s.week === week).sort(bySort);
// דער סדר אין דער וואך: "sort" פאר די אייגענע, "sort_next" פאר די וואס קומען פון ערב שבת (ליידיג = אויבן)
const simchosOf = (week) => {
  const carried = (state.simchos || []).filter((s) => isOn(s.also_next) && nextIssue(s.week) === week).sort(bySort).map((s) => ({ ...s, _carried: true }));
  const key = (s) => (s._carried ? Number(s.sort_next) || 0 : Number(s.sort) || 0);
  return [...carried, ...ownOf(week)].map((s, i) => ({ s, i })).sort((a, b) => key(a.s) - key(b.s) || a.i - b.i).map((x) => x.s);
};
/** פרייטאג פון 6 אינדערפרי ביז שבת: וואס מ'לייגט אריין די וואך ווייזט זיך אויך די קומענדיגע וואך */
/** ערב שבת / ערב יום טוב (פון 6 אינדערפרי) ביזן סוף: וואס מ'לייגט אריין ווייזט זיך אויך אינעם קומענדיגן גליון */
const lateFor = (key) => {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const eve = addDays(key, -1); // ערב שבת / ערב יום טוב
  if (stamp < eve || stamp > issueEnd(key)) return false;
  return stamp > eve || now.getHours() >= 6;
};
const parseH = (s) => { try { const v = JSON.parse(s.honorees || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

// ---------- קשרים: דורות צווישן מענטשן (דורך די קשרים אין די כרטיסן) ----------
function graph(extra = []) {
  const g = new Map();
  const add = (a, b, d) => { if (!g.has(a)) g.set(a, []); g.get(a).push([b, d]); };
  [...(state.relations || []), ...extra].forEach((r) => {
    const d = DELTA[r.relation_type];
    if (d === undefined || !r.contact_id_a || !r.contact_id_b) return;
    const a = String(r.contact_id_a); const b = String(r.contact_id_b);
    add(a, b, d); add(b, a, -d);
  });
  return g;
}
/** וויפיל דורות "from" איז העכער ווי "to" (אדער null — נישט פארבונדן, ביז 4 שריט) */
function genDelta(g, from, to) {
  if (from === to) return 0;
  const seen = new Map([[from, 0]]); let q = [from];
  for (let depth = 0; depth < 4 && q.length; depth += 1) {
    const nq = [];
    q.forEach((x) => (g.get(x) || []).forEach(([y, d]) => {
      if (seen.has(y)) return;
      seen.set(y, seen.get(x) + d); nq.push(y);
    }));
    if (seen.has(to)) return seen.get(to);
    q = nq;
  }
  return null;
}
/** א בעל שמחה: א קאנטאקט (id) אדער סתם א נאמען (name) וואס איז נישט אין מאגר */
const hkey = (x) => (x.id ? String(x.id) : (String(x.name || '').trim() ? `n:${String(x.name).trim()}` : ''));
const keyLabel = (k) => (String(k).startsWith('n:') ? String(k).slice(2) : ui.fullNameHe(contactOf(k) || {}));
const directRel = (a, b) => (state.relations || []).find((r) => String(r.contact_id_a) === String(a) && String(r.contact_id_b) === String(b));

/** דער סדר און די קרבה: { rows (פון ווייט צו נאענט), rel: "נינו-בנו" / "צאצאיהם" } */
function compose(s) {
  const hs = parseH(s).filter(hkey).map((x) => ({ ...x, id: hkey(x) }));
  if (!hs.length) return { rows: [], rel: '' };
  const extra = hs.filter((x) => x.link && x.link.type && x.link.to).map((x) => ({ contact_id_a: x.id, relation_type: x.link.type, contact_id_b: x.link.to }));
  const g = graph(extra);
  // גרופעס: ווער איז פארבונדן מיט וועמען
  const groups = [];
  hs.forEach((x) => {
    if (x.unrelated) { groups.push([x]); return; }
    const gr = groups.find((grp) => grp.some((y) => genDelta(g, String(y.id), String(x.id)) !== null));
    if (gr) gr.push(x); else groups.push([x]);
  });
  // דורות קעגן דעם ערשטן אין יעדער גרופע
  groups.forEach((grp) => {
    const base = String(grp[0].id);
    grp.forEach((x) => { x._g = genDelta(g, String(x.id), base) ?? 0; });
    grp.sort((a, b) => b._g - a._g);
  });
  const rows = groups.flat();
  if (groups.length > 1) return { rows, rel: 'צאצאיהם' };
  const grp = groups[0];
  const first = hs[0];
  const baseChild = Number(first.toChild || 1);
  const byGen = new Map(); // דור קעגן דעם ילד → וויפיל מענטשן
  grp.forEach((x) => {
    const gen = baseChild + (genDelta(g, String(x.id), String(first.id)) ?? 0);
    byGen.set(gen, (byGen.get(gen) || 0) + 1);
  });
  const sex = s.child_gender === 'f' ? 'f' : 'm';
  const rel = [...byGen].sort((a, b) => b[0] - a[0])
    .map(([gen, n]) => (WORDS[sex][gen] ? WORDS[sex][gen][n > 1 ? 1 : 0] : '')).filter(Boolean).join('-');
  return { rows, rel };
}

/** פעט: אלעס נאך דעם ערשטן ווארט, ווען דאס ערשטע ווארט איז א ראשי תיבות (הבה"ח, ה"ה) */
function boldName(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = /^(\S*["״'׳]\S*)\s+(.+)$/.exec(s);
  return m ? `${h(m[1])} <b>${h(m[2])}</b>` : `<b>${h(s)}</b>`;
}

/** איין שמחה אלס HTML פארן גליון */
/** טעקסט פון "ספעציעלע": נאר <b> און שורות (אלעס אנדערש ווערט פשוט'ער טעקסט) */
export function cleanRich(html) {
  const box = document.createElement('div');
  box.innerHTML = String(html || '');
  // א שורה (div/p) הייבט זיך אן אויף א נייער שורה — אויך ווען פאר איר שטייט טעקסט אן א div (ווי Chrome מאכט ביי Enter)
  let out = '';
  const brEnd = () => /<br>$/.test(out);
  const go = (n, bold) => {
    if (n.nodeType === 3) { if (n.nodeValue) out += bold ? `<b>${h(n.nodeValue)}</b>` : h(n.nodeValue); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') { out += '<br>'; return; }
    const b = bold || tag === 'b' || tag === 'strong' || (n.style && Number(n.style.fontWeight) >= 600);
    if (tag === 'div' || tag === 'p') {
      if (out && !brEnd()) out += '<br>';
      n.childNodes.forEach((c) => go(c, b));
      if (!brEnd()) out += '<br>';
      return;
    }
    n.childNodes.forEach((c) => go(c, b));
  };
  box.childNodes.forEach((c) => go(c, false));
  return out.replace(/<\/b><b>/g, '').replace(/(<br>\s*)+$/, '').trim();
}

export function simchaHtml(s) {
  if (s.type === 'special') return `<div class="sg-entry sg-special">${cleanRich(s.special)}</div>`;
  const { rows, rel } = compose(s);
  const ty = TYPES[s.type] || TYPES.birth;
  const lines = rows.map((x) => {
    const c = contactOf(x.id) || {};
    const nm = x.id.startsWith('n:') ? x.id.slice(2) : `${c.first_name_he || ''} ${c.last_name_he || ''}`;
    const name = `${h(x.title || '')} <b>${h(nm)}</b> ${h(x.suffix || '')}`.replace(/\s+/g, ' ').trim();
    return `<div class="sg-name">${name}</div>${x.noteOn && x.note ? `<div class="sg-note">${h(x.note)}</div>` : ''}`;
  }).join('');
  const self = isSelf(s);
  const forLine = String(s.text_override || '').trim() ? h(s.text_override)
    : self ? [h(SELF[s.type][s.child_gender === 'f' ? 'f' : 'm']), ty.other ? `עב"ג ${boldName(s.other_side)}`.trim() : '', h(ty.post), 'בשעטו"מ'].filter((x) => String(x).trim()).join(' ')
    : [h(ty.pre), h(rel), boldName(s.child_name), ty.other ? `עב"ג ${boldName(s.other_side)}`.trim() : '', h(ty.post), 'בשעטו"מ']
      .filter((x) => String(x).trim()).join(' ');
  return `<div class="sg-entry">${lines}<div class="sg-for">${forLine}</div>${String(s.after_note || '').trim() ? `<div class="sg-after">${h(s.after_note)}</div>` : ''}</div>`;
}

// ---------- דער בלאט ----------
const SCALE = 0.909; // די שוליים (sg-inner)
const MAX_PT = Math.round((11 / SCALE) * 100) / 100;
const fontKey = 'sg-font';
const defFont = () => customFontNames().find((n) => !/bold/i.test(n)) || 'Frank Ruhl Libre';
const getFont = () => { let f = ''; try { f = localStorage.getItem(fontKey) || ''; } catch { /* */ } return f && (f === 'Frank Ruhl Libre' || customFontNames().includes(f)) ? f : defFont(); };
const setFont = (f) => { try { localStorage.setItem(fontKey, f); } catch { /* */ } };

function weekLabel(iso) {
  const x = toHebrew(iso);
  const d = x ? `${hebrewNumber(x.d)} ${monthHe(x.m)}` : iso;
  return `${issueTitle(iso)} · ${d}`;
}

function pageHtml(list, fontPt, cols = 1, pageNo = 0, opt = {}) {
  const font = getFont().replace(/'/g, '');
  const bgU = bgSrc(cur.week); const full = bgU !== DEF_BG; // א רקע וואס מ'האט ארויפגעלייגט — איבערן גאנצן האלבן בלאט (די שוליים — אינעם רקע אליין)
  return `<div class="sg-page" style="font-family:'${h(font)}','Frank Ruhl Libre',serif">
    ${full ? `<img class="sg-bg sg-bg-full" src="${h(bgU)}" alt="">` : ''}
    <div class="sg-inner">
    ${full ? '' : `<img class="sg-bg" src="${h(bgU)}" alt="">`}
    <div class="sg-parsha" style="${layoutCss(LAY).parsha}">${h(issueTitle(cur.week))}</div>
    ${bodyHtml(list, fontPt, cols, opt)}</div>
    ${pageNo ? `<div class="sg-pageno">${h(t('lobbySimchos'))} ${h(issueTitle(cur.week))} ${h(t('sgPageNo', { n: pageNo }))}</div>` : ''}</div>`;
}

/** דער אינהאלט: איין שפאלט, צוויי שפאלטן (CSS), אדער צוויי שפאלטן מיט א באשטימטן צוטייל (opt.split) — מיט "spread" פולט מען אויס דעם בלאט */
function bodyHtml(list, pt, cols, opt) {
  const st = `style="font-size:${pt}pt;${layoutCss(LAY).body}"`;
  if (cols > 1 && opt.grid) {
    // שורות פון צוויי; ווען ס'בלייבט איינס אין דער לעצטער שורה — אין דער מיט
    return `<div class="sg-body sg-grid${list.length % 2 ? ' sg-odd' : ''}" ${st}>${list.map(simchaHtml).join('')}</div>`;
  }
  if (cols > 1 && opt.split) {
    const col = (xs) => `<div class="sg-col">${xs.map(simchaHtml).join('')}</div>`;
    return `<div class="sg-body sg-mcols${opt.spread ? ' sg-spread' : ''}" ${st}>${col(list.slice(0, opt.split))}${col(list.slice(opt.split))}</div>`;
  }
  return `<div class="sg-body${cols > 1 ? ' sg-cols' : ''}${cols === 1 && opt.spread ? ' sg-spread' : ''}" ${st}>${list.map(simchaHtml).join('')}</div>`;
}

// ---------- אויסלייג: איין/צוויי שפאלטן, קלענערער שריפט (ביז 2.5 נקודות), און דערנאך א צווייטער בלאט ----------
const MIN_PT = Math.round(((11 - 2.5) / SCALE) * 100) / 100;
const colsKey = 'sg-cols';
const getCols = () => { try { return localStorage.getItem(colsKey) || 'auto'; } catch { return 'auto'; } };
const setCols = (v) => { try { localStorage.setItem(colsKey, v); } catch { /* */ } };
let lastPages = [];

let meas = null;
function fits(list, pt, cols) {
  if (!meas) { meas = document.createElement('div'); meas.className = 'sg-measure'; document.body.appendChild(meas); }
  meas.innerHTML = pageHtml(list, pt, cols);
  const body = $('.sg-body', meas);
  const b = body.getBoundingClientRect();
  return $$('.sg-entry', body).every((e) => { const r = e.getBoundingClientRect(); return r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1; });
}
/** א פעסטע אויסלייג (שפאלטן + שריפט) פאר אלע בלעטער: יעדער בלאט ווערט אנגעפילט ווי פיל ס'גייט אריין */
function pagesWith(all, cols, pt) {
  const pages = [];
  let rest = all.slice();
  while (rest.length && pages.length < 8) {
    if (!fits(rest.slice(0, 1), pt, cols)) return null; // אפילו איין שמחה גייט נישט אריין
    // דער גרעסטער טייל וואס גייט אריין (ביינערי זוכן)
    let lo = 1; let hi = rest.length;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(rest.slice(0, mid), pt, cols)) lo = mid; else hi = mid - 1; }
    pages.push({ list: rest.slice(0, lo), cols, pt });
    rest = rest.slice(lo);
  }
  return rest.length ? null : pages;
}
/** צוטיילן אויף בלעטער — אלע בלעטער מיט די זעלבע שפאלטן און דעם זעלבן שריפט (כדי קיין שמחה זאל נישט זיין גרעסער ווי די אנדערע) */
function paginate(all) {
  const mode = getCols();
  const pts = []; for (let pt = MAX_PT; pt >= MIN_PT - 0.001; pt = Math.round((pt - 0.25) * 100) / 100) pts.push(pt);
  const colsList = mode === '1' ? [1] : mode === '2' ? [2] : [1, 2];
  const cands = [];
  colsList.forEach((c) => pts.forEach((pt) => { const pg = pagesWith(all, c, pt); if (pg) cands.push({ c, pt, pages: pg }); }));
  if (meas) meas.innerHTML = '';
  if (!cands.length) return pagesWith(all, colsList[colsList.length - 1], MIN_PT) || [{ list: all, cols: colsList[0], pt: MIN_PT }];
  const minP = Math.min(...cands.map((x) => x.pages.length));
  const best = cands.filter((x) => x.pages.length === minP);
  let pick;
  if (mode !== 'auto') pick = best[0]; // דער גרעסטער שריפט
  else if (minP === 1) {
    // איין בלאט: איין שפאלט מיטן פולן שריפט; אנדערש — צוויי שפאלטן מיטן גרעסטן שריפט
    pick = best.find((x) => x.c === 1 && x.pt === MAX_PT) || best.find((x) => x.c === 2) || best[0];
  } else {
    // עטלעכע בלעטער: בעסער איין שפאלט (מיטן גרעסטן שריפט), אויב ס'גייט אין אזויפיל בלעטער
    pick = best.find((x) => x.c === 1) || best[0];
  }
  const pages = pick.pages;
  // דער לעצטער בלאט זאל נישט בלייבן מיט איין איינציגע שמחה: מינימום 3 (צוויי שפאלטן) / 2 (איין שפאלט) — גענומען פונעם בלאט פריער
  if (pages.length > 1) {
    const need = pages[0].cols === 2 ? 3 : 2;
    const last = pages[pages.length - 1]; const prev = pages[pages.length - 2];
    while (last.list.length < need && prev.list.length > need) last.list.unshift(prev.list.pop());
  }
  return pages;
}
/** א פולער בלאט (צוויי שפאלטן / קלענערער שריפט / נישט דער לעצטער): די קעסטלעך ווערן צוטיילט איבערן גאנצן בלאט */
function finalize(pages) {
  pages.forEach((p, i) => {
    // דער לעצטער בלאט פון עטלעכע — וואו די שמחות ענדיגן זיך — ווערט נישט אויסגעצויגן
    // דער לעצטער בלאט (אויך ווען ס'איז נאר איין בלאט) ווערט נישט אויסגעצויגן
    p.spread = i < pages.length - 1;
    if (p.cols !== 2 || p.list.length < 2) return;
    if (!meas) { meas = document.createElement('div'); meas.className = 'sg-measure'; document.body.appendChild(meas); }
    if (!p.spread) {
      // א בלאט וואס ווערט נישט אויסגעצויגן: שורות פון צוויי, די לעצטע (ווען אומגלייך) אין דער מיט — אויב ס'גייט אריין
      meas.innerHTML = pageHtml(p.list, p.pt, 2, 0, { grid: true });
      const body = $('.sg-body', meas); const b = body.getBoundingClientRect();
      if ($$('.sg-entry', body).every((e) => e.getBoundingClientRect().bottom <= b.bottom + 1)) { p.grid = true; return; }
    }
    let best = null;
    for (let k = 1; k < p.list.length; k += 1) {
      meas.innerHTML = pageHtml(p.list, p.pt, 2, 0, { split: k });
      const body = $('.sg-body', meas); const b = body.getBoundingClientRect();
      const hs = $$('.sg-col', body).map((c) => { const es = $$('.sg-entry', c); return es.length ? es[es.length - 1].getBoundingClientRect().bottom - b.top : 0; });
      const tall = Math.max(...hs);
      if (tall <= b.height + 1 && (!best || tall < best.tall)) best = { k, tall };
    }
    if (best) p.split = best.k;
  });
  if (meas) meas.innerHTML = '';
  return pages;
}
const pagesHtml = (pages) => pages.map((p, i) => pageHtml(p.list, p.pt, p.cols, pages.length > 1 ? i + 1 : 0, p)).join('');

// ---------- רקע הגליון: אחד לכל הגליונות, אדער באזונדער פאר א געוויסן גליון (נאר א מנהל) — לשונית SimchaSettings ----------
const DEF_BG = 'img/simcha-bg2.jpg';
let bgSet = null; // { key: value } — "bg" / "bg:<week>"
const bgSheet = () => otherSheet(CONFIG.SPREADSHEET_ID);
async function loadBg() {
  try {
    const rows = await bgSheet().read('SimchaSettings!A2:D200');
    bgSet = Object.fromEntries(rows.filter((r) => r[0]).map((r) => [String(r[0]), String(r[1] || '')]));
    const ids = Object.values(bgSet).filter(isDrv).map((v) => v.slice(4));
    if (ids.length) await fetchImages(ids);
  } catch { bgSet = bgSet || {}; }
}
function bgSrc(week) {
  const v = (bgSet || {})[`bg:${week}`] || (bgSet || {}).bg;
  return (v && imageOf(v)) || DEF_BG;
}
// ---------- מיקומים (לויטן רקע): אזור השמחות + קעסטל פון דער פרשה — אינטשעס אויפן גאנצן האלבן בלאט ----------
const SC = 0.909; // .sg-inner
const numOr = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v));
const toIn = (x, c) => c + (x - c) / SC; // בלאט → sg-inner
export const LAYOUT_DEF = { body: { x: 0.905, y: 2.587, w: 3.69, h: 4.872 }, parsha: { x: 1.45, y: 1.80, w: 2.6, h: 0.42, size: 14, border: true, color: '#1f2f6b', bg: true, padV: 1, padH: 8 } };
const layKey = (week) => ((bgSet || {})[`bg:${week}`] ? `layout:${week}` : 'layout');
function layoutFor(week) {
  const v = (bgSet || {})[layKey(week)];
  if (!v) return null;
  try { const L = JSON.parse(v); return { body: { ...LAYOUT_DEF.body, ...(L.body || {}) }, parsha: { ...LAYOUT_DEF.parsha, ...(L.parsha || {}) } }; } catch { return null; }
}
/** אינליין-סטיילס פאר די מיקומים (אינעווייניג פון sg-inner) */
function layoutCss(L) {
  if (!L) return { body: '', parsha: '' };
  const b = L.body; const p = L.parsha;
  const bx = toIn(b.x, 2.75); const by = toIn(b.y, 4.25); const bw = b.w / SC; const bh = b.h / SC;
  const px = toIn(p.x, 2.75); const py = toIn(p.y, 4.25); const pw = p.w / SC; const ph = p.h / SC;
  return {
    body: `top:${by.toFixed(3)}in;left:${bx.toFixed(3)}in;width:${bw.toFixed(3)}in;height:${bh.toFixed(3)}in;right:auto;bottom:auto;`,
    // די מסגרת = דאס קעסטל (וואס מ'שטעלט אין עורך); דער טעקסט אין דער מיט — די גרייס פונעם טעקסט טוישט נישט די מסגרת
    parsha: `top:${py.toFixed(3)}in;left:${px.toFixed(3)}in;width:${pw.toFixed(3)}in;height:${ph.toFixed(3)}in;transform:none;min-width:0;padding:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${(Number(p.size) || 14) / SC}pt;color:${p.color || '#1f2f6b'};border:${p.border ? `1px solid ${p.color || '#1f2f6b'}` : '0'};background:${p.bg ? 'rgba(255,255,255,.85)' : 'transparent'};`,
  };
}
let LAY = null; // דער אקטיווער אויסלייג פארן פאגינירן/צייכענען (null = רעגולער)

async function setBg(key, value) {
  const rows = await bgSheet().read('SimchaSettings!A1:A200');
  let row = rows.findIndex((r, i) => i > 0 && String(r[0]) === key) + 1;
  if (row <= 0) row = rows.length + 1;
  await bgSheet().write(`SimchaSettings!A${row}:D${row}`, [[value ? key : '', value || '', nowStamp(), state.email]]);
  await loadBg();
}
function bgDialog() {
  const bg = document.createElement('div'); bg.className = 'tf-dlg-bg';
  const own = (bgSet || {})[`bg:${cur.week}`];
  bg.innerHTML = `<div class="tf-dlg sg-bgdlg"><h3>🖼 רקע הגליון</h3>
    <div class="sg-bgrow"><img src="${h(bgSrc(cur.week))}" alt=""><div>
      <p><b>${own ? 'לגליון הזה יש רקע מיוחד' : (bgSet || {}).bg ? 'רקע קבוע (שהועלה)' : 'הרקע הרגיל של האתר'}</b></p>
      <label class="btn small-btn primary">📤 רקע חדש לכל הגליונות<input type="file" accept="image/*,application/pdf,.pdf" data-bgk="bg" hidden></label>
      <label class="btn small-btn">📤 רקע רק לגליון הזה (${h(weekLabel(cur.week))})<input type="file" accept="image/*,application/pdf,.pdf" data-bgk="bg:${h(cur.week)}" hidden></label>
      ${own ? '<button type="button" class="btn small-btn ghost" data-bgx="own">↺ הגליון הזה — חזרה לרקע הקבוע</button>' : ''}
      ${(bgSet || {}).bg ? '<button type="button" class="btn small-btn ghost" data-bgx="bg">↺ הרקע הקבוע — חזרה לרקע הרגיל של האתר</button>' : ''}
      <button type="button" class="btn small-btn" data-lay>📐 מיקום השמחות והפרשה</button>
      <p class="muted small">אפשר להעלות <b>PDF</b> (העמוד הראשון נהפך לתמונה באיכות הדפסה, 300 DPI) או תמונה בגודל 5.5×8.5 אינטש (למשל 1650×2550 פיקסלים). נשמר ב-Drive. הרקע ממלא את כל חצי העמוד — השוליים לפי הרקע עצמו.</p>
      <p class="muted small" data-st></p>
    </div></div>
    <div class="vs-acts"><button type="button" class="btn ghost" data-x>סגירה</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector('[data-x]').onclick = close;
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  const st = bg.querySelector('[data-st]');
  bg.querySelectorAll('[data-bgk]').forEach((inp) => { inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    st.textContent = 'מעלה…';
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      // PDF: דער ערשטער בלאט → א בילד אין 300 DPI (5.5 אינטש = 1650 פיקסל)
      let data = isPdf ? await (await import('./pdfview.js')).pdfPageToJpeg(new Uint8Array(await file.arrayBuffer()), 1650) : await shrinkImage(file, 2600, 2500000, true);
      let v = await storeImage(data, 'simcha-bg');
      if (!isDrv(v)) { data = await shrinkImage(isPdf ? await (await fetch(data)).blob() : file, 900, 45000, true); v = data; ui.toast('נשמר באיכות נמוכה (עוזר התמונות לא זמין)', 'error'); }
      await setBg(inp.dataset.bgk, v); close(); renderSimchos(); ui.toast(t('saved'));
    } catch (err) { st.textContent = ''; ui.toast(ui.friendlyError(err), 'error'); }
  }; });
  bg.querySelector('[data-lay]').onclick = () => { close(); layoutEditor(); };
  bg.querySelectorAll('[data-bgx]').forEach((b) => { b.onclick = async () => {
    try { await setBg(b.dataset.bgx === 'own' ? `bg:${cur.week}` : 'bg', ''); close(); renderSimchos(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  }; });
}

// ---------- 📐 עורך: גוררים / מגדילים את אזור השמחות ואת הפרשה על הדף ----------
function layoutEditor() {
  const key = layKey(cur.week);
  const L = JSON.parse(JSON.stringify(layoutFor(cur.week) || LAYOUT_DEF));
  const list = simchosOf(cur.week);
  const bg = document.createElement('div'); bg.className = 'tf-dlg-bg';
  const K = 72; // פיקסל פער אינטש אינעם עורך
  bg.innerHTML = `<div class="tf-dlg sg-lay"><h3>📐 מיקום השמחות והפרשה ${key === 'layout' ? '(לכל הגליונות)' : '(לגליון הזה בלבד)'}</h3>
    <div class="sg-lay-wrap"><div class="sg-lay-page"><div class="sg-lay-pv"></div>
      <div class="sg-box" data-b="parsha"><span>פרשה</span><i></i></div><div class="sg-box" data-b="body"><span>אזור השמחות</span><i></i></div></div>
    <div class="sg-lay-side">
      <p class="muted small">גוררים את המלבנים למקום המתאים ברקע; מגדילים מהעיגול בפינה. המלבן הכתום הוא מסגרת הפרשה; הטקסט תמיד באמצע שלה, וגודל האות לא משנה את המסגרת.</p>
      <b>הפרשה</b>
      <label>גודל אות <input type="number" min="6" max="40" step="0.5" data-p="size" value="${L.parsha.size}"></label>
      <label>צבע <input type="color" data-p="color" value="${h(L.parsha.color)}"></label>
      <label><input type="checkbox" data-p="border"${L.parsha.border ? ' checked' : ''}> מסגרת</label>
      <label><input type="checkbox" data-p="bg"${L.parsha.bg ? ' checked' : ''}> רקע לבן</label>
      <div class="vs-acts"><button type="button" class="btn primary" data-save>💾 שמירה</button><button type="button" class="btn ghost" data-def>↺ ברירת מחדל</button><button type="button" class="btn ghost" data-x>ביטול</button></div>
    </div></div></div>`;
  document.body.appendChild(bg);
  const pv = bg.querySelector('.sg-lay-pv'); const pageEl = bg.querySelector('.sg-lay-page');
  const draw = () => {
    LAY = L;
    const pages = list.length ? finalize(paginate(list)) : [{ list: [], cols: 1, pt: MAX_PT }];
    pv.innerHTML = pageHtml(pages[0].list, pages[0].pt, pages[0].cols, 0, pages[0]);
    LAY = layoutFor(cur.week);
    bg.querySelectorAll('.sg-box').forEach((el) => { const r = L[el.dataset.b]; Object.assign(el.style, { left: `${r.x * K}px`, top: `${r.y * K}px`, width: `${r.w * K}px`, height: `${r.h * K}px` }); });
  };
  pageEl.style.width = `${5.5 * K}px`; pageEl.style.height = `${8.5 * K}px`;
  pv.style.transform = `scale(${K / 96})`;
  draw();
  bg.querySelectorAll('.sg-box').forEach((el) => {
    el.onpointerdown = (e) => {
      e.preventDefault(); const r = L[el.dataset.b]; const r0 = { ...r }; const x0 = e.clientX; const y0 = e.clientY;
      const rs = e.target.tagName === 'I'; el.setPointerCapture(e.pointerId);
      el.onpointermove = (ev) => {
        const dx = (ev.clientX - x0) / K; const dy = (ev.clientY - y0) / K; const q = (v) => Math.round(v * 100) / 100;
        if (rs) { r.w = q(Math.max(0.3, r0.w + dx)); r.h = q(Math.max(0.2, r0.h + dy)); } else { r.x = q(Math.min(5.3, Math.max(-0.2, r0.x + dx))); r.y = q(Math.min(8.3, Math.max(-0.2, r0.y + dy))); }
        Object.assign(el.style, { left: `${r.x * K}px`, top: `${r.y * K}px`, width: `${r.w * K}px`, height: `${r.h * K}px` });
      };
      el.onpointerup = () => { el.onpointermove = null; draw(); };
    };
  });
  bg.querySelectorAll('[data-p]').forEach((inp) => { inp.oninput = () => { const k = inp.dataset.p; L.parsha[k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? Number(inp.value) : inp.value; draw(); }; });
  const close = () => { bg.remove(); LAY = layoutFor(cur.week); };
  bg.querySelector('[data-x]').onclick = close;
  bg.querySelector('[data-def]').onclick = async () => { if (!confirm('להחזיר את המיקומים לברירת המחדל?')) return; try { await setBg(key, ''); close(); renderSimchos(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); } };
  bg.querySelector('[data-save]').onclick = async (e) => {
    e.target.disabled = true;
    try { await setBg(key, JSON.stringify(L)); close(); renderSimchos(); ui.toast(t('saved')); } catch (err) { e.target.disabled = false; ui.toast(ui.friendlyError(err), 'error'); }
  };
}

export function openSimchos() {
  if (!cur.week) cur.week = weekNow();
  ui.showView('simchos');
}

export function renderSimchos() {
  const main = $('#simchos-main');
  if (!main) return;
  if (bgSet === null) { bgSet = {}; loadBg().then(() => { if ($('#simchos-main')) renderSimchos(); }); }
  if (!cur.week) cur.week = weekNow();
  const list = simchosOf(cur.week);
  const fonts = ['Frank Ruhl Libre', ...customFontNames().filter((n) => !/bold/i.test(n))];
  main.innerHTML = `<div class="sc-head sg-head">
      <span class="sc-logo-ph">🍷</span>
      <div><h1>${h(t('lobbySimchos'))}</h1><p class="muted small">${h(t('lobbySimchosSub'))}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn" id="sg-back">← ${h(t('lobbyBack'))}</button>
    </div>
    <div class="sg-bar"><button type="button" class="btn primary sg-new-big" id="sg-new">＋ ${h(t('sgNew'))}</button><div class="sg-week">
      <button type="button" class="btn small-btn" id="sg-prev" title="${h(t('sgPrev'))}">›</button>
      <b>${h(weekLabel(cur.week))}</b>
      <button type="button" class="btn small-btn" id="sg-next" title="${h(t('sgNext'))}">‹</button>
      ${cur.week !== weekNow() ? `<button type="button" class="linkish" id="sg-today">${h(t('sgThisWeek'))}</button>` : ''}
      ${(() => { const mids = ytInWeek(shabbatOfWeek(cur.week)).filter((x) => !x.touching); return mids.map((x) => `<label class="check sg-yt"><input type="checkbox" data-yt="${h(x.start)}"${issueOn(x.start) ? ' checked' : ''}> ${h(t('sgYtInstead'))}${mids.length > 1 ? ` (${h(x.title)})` : ''}</label>`).join(''); })()}
      <span class="spacer"></span>
      ${state.isAdmin ? '<button type="button" class="btn small-btn" id="sg-bgbtn" title="להחליף את תמונת הרקע של הגליון">🖼 רקע</button>' : ''}
      <label class="small">${h(t('sgFont'))} <select id="sg-font">${fonts.map((f) => `<option${f === getFont() ? ' selected' : ''}>${h(f)}</option>`).join('')}</select></label>
      <label class="small">${h(t('sgCols'))} <select id="sg-cols">${[['auto', t('sgColsAuto')], ['1', '1'], ['2', '2']].map(([v, l]) => `<option value="${v}"${getCols() === v ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>
      <span class="sg-exports">
        <span class="sg-exports-row">
          <button type="button" class="btn small-btn" id="sg-jpg"${list.length ? '' : ' disabled'} title="${h(t('sgJpgHint'))}">🖼 JPG</button>
          <button type="button" class="btn small-btn" id="sg-pdf"${list.length ? '' : ' disabled'} title="${h(t('sgPdfHint'))}">⬇ Print to PDF</button>
        </span>
        <button type="button" class="btn small-btn" id="sg-jpg-big"${list.length ? '' : ' disabled'} title="${h(t('sgJpgBigHint'))}">🖼 JPG 11×17</button>
      </span>
    </div>
    </div>
    <div class="sg-wrap">
      <div class="sg-list">${list.length ? list.map((s, i) => `<div class="sg-item">
          <div class="sg-item-text">${simchaHtml(s)}${s._carried ? `<div class="sg-late">↩ ${h(t('sgCarried'))}</div>` : isOn(s.also_next) ? `<div class="sg-late">↪ ${h(t('sgAlsoNext'))}</div>` : ''}${addedByHtml(s)}</div>
          <div class="sg-item-acts">
            <button type="button" class="btn small-btn" data-sg-edit="${h(s.simcha_id)}" title="${h(t('scEdit'))}">✎</button>
            <button type="button" class="btn small-btn" data-sg-up="${h(s.simcha_id)}"${i ? '' : ' disabled'}>▲</button>
            <button type="button" class="btn small-btn" data-sg-down="${h(s.simcha_id)}"${i < list.length - 1 ? '' : ' disabled'}>▼</button>
            <button type="button" class="btn small-btn danger" data-sg-del="${h(s.simcha_id)}" title="${h(t('deleteBtn'))}">🗑</button>
          </div></div>`).join('') : `<p class="muted">${h(t('sgNone'))}</p>`}</div>
      <div class="sg-preview-wrap"><div class="sg-preview" id="sg-preview"></div><p class="muted small" id="sg-layout"></p></div>
    </div>`;
  LAY = layoutFor(cur.week);
  lastPages = list.length ? finalize(paginate(list)) : [{ list: [], cols: 1, pt: MAX_PT }];
  $('#sg-preview', main).innerHTML = pagesHtml(lastPages);
  $('#sg-preview', main).style.setProperty('--pages', lastPages.length);
  $('#sg-layout', main).textContent = list.length ? t('sgLayout', { p: lastPages.length, c: lastPages.map((p) => p.cols).join('/'), s: lastPages.map((p) => Math.round(p.pt * SCALE * 10) / 10).join('/') }) : '';
  wire(main, list);
}

function wire(main, list) {
  $('#sg-back', main).onclick = () => ui.showView('lobby');
  $('#sg-new', main).onclick = () => openSimchaForm({ week: cur.week });
  $('#sg-prev', main).onclick = () => { cur.week = prevIssue(cur.week); renderSimchos(); };
  $('#sg-next', main).onclick = () => { cur.week = nextIssue(cur.week); renderSimchos(); };
  const td = $('#sg-today', main); if (td) td.onclick = () => { cur.week = weekNow(); renderSimchos(); };
  $('#sg-font', main).onchange = (e) => { setFont(e.target.value); renderSimchos(); };
  const bgb = $('#sg-bgbtn', main); if (bgb) bgb.onclick = () => bgDialog();
  $$('[data-yt]', main).forEach((cb) => { cb.onchange = () => toggleYt(cb.dataset.yt, cb.checked, cb); });
  $('#sg-cols', main).onchange = (e) => { setCols(e.target.value); renderSimchos(); };
  $('#sg-jpg', main).onclick = () => jpgPages();
  $('#sg-jpg-big', main).onclick = () => jpgPages(true);
  $('#sg-pdf', main).onclick = () => { ui.toast(t('sgPdfHint')); printPage(list); };
  void pdfPage; // דער אלטער PDF (בילד) — אויב מ'וועט עס דארפן
  $$('[data-sg-edit]', main).forEach((b) => { b.onclick = () => openSimchaForm(list.find((s) => String(s.simcha_id) === b.dataset.sgEdit)); });
  $$('[data-sg-del]', main).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(t('sgDelConfirm'))) return;
      try { await deleteSimcha(list.find((s) => String(s.simcha_id) === b.dataset.sgDel)); await loadAll(); await syncScreen(); ui.refreshAll(); renderSimchos(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
  const move = async (id, dir) => {
    const i = list.findIndex((s) => String(s.simcha_id) === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const order = list.map((s) => s); [order[i], order[j]] = [order[j], order[i]];
    try {
      for (let k = 0; k < order.length; k += 1) {
        const x = order[k]; const f = x._carried ? 'sort_next' : 'sort';
        if (Number(x[f]) !== k + 1) { const rec = { ...x, [f]: k + 1 }; delete rec._carried; await saveRecord('Simchos', 'simcha_id', rec); }
      }
      await loadAll(); renderSimchos();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  $$('[data-sg-up]', main).forEach((b) => { b.onclick = () => move(b.dataset.sgUp, -1); });
  $$('[data-sg-down]', main).forEach((b) => { b.onclick = () => move(b.dataset.sgDown, 1); });
}
const shift = (iso, days) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + days * 86400000).toISOString().slice(0, 10);

function printPage(list) {
  void list;
  let area = $('#sg-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'sg-print-area'; document.body.appendChild(area); }
  area.innerHTML = pagesHtml(lastPages);
  const st = document.createElement('style');
  st.textContent = '@page { size: 5.5in 8.5in; margin: 0; }';
  document.head.appendChild(st);
  document.body.classList.add('printing-sg');
  const done = () => { document.body.classList.remove('printing-sg'); st.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 300);
}

/** יעדער בלאט אלס א באזונדערע JPG, 150 DPI (825×1275) */
/** big = 11×17 אינטש (דער זעלבער בלאט, צוויי מאל גרעסער — 150 DPI) */
async function jpgPages(big = false) {
  const btn = $(big ? '#sg-jpg-big' : '#sg-jpg'); btn.disabled = true;
  try {
    const title = issueTitle(cur.week);
    for (const [i, p] of lastPages.entries()) {
      const multi = lastPages.length > 1;
      const jpg = await htmlToJpeg(pageHtml(p.list, p.pt, p.cols, multi ? i + 1 : 0, p), { widthIn: 5.5, heightIn: 8.5, scale: (big ? 300 : 150) / 96, quality: 0.92 });
      const a = document.createElement('a');
      a.href = jpg.dataUrl;
      a.download = `${t('lobbySimchos')} - ${title}${multi ? ` - ${i + 1}` : ''}${big ? ' - 11x17' : ''}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
      await new Promise((r) => setTimeout(r, 400)); // דער בראוזער זאל נישט בלאקירן כמה דאונלאודס
    }
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  btn.disabled = false;
}

/** פאר לוח המאורעות: די שמחות (איינמאליג) — [{ s, iso, label, names }] */
export function simchaEvents() {
  return (state.simchos || []).filter((s) => s.week).map((s) => {
    const ty = s.type === 'special' ? t('sgSpecial') : (TYPES[s.type] || TYPES.birth).label;
    const ids = s.type === 'special' ? (() => { try { return JSON.parse(s.related || '[]'); } catch { return []; } })() : [...parseH(s).map((x) => x.id), s.child_contact_id].filter(Boolean);
    const names = s.type === 'special' ? ids.map((id) => contactOf(id)).filter(Boolean).map((c) => ui.fullNameHe(c))
      : parseH(s).map((x) => (x.id ? ui.fullNameHe(contactOf(x.id) || {}) : String(x.name || '').trim())).filter(Boolean);
    return { s, iso: s.week, label: ty, names, ids };
  });
}
export function openSimchosWeek(week) { cur.week = week; ui.showView('simchos'); }

async function pdfPage(list) {
  const btn = $('#sg-pdf'); btn.disabled = true;
  try {
    void list;
    const jpgs = [];
    for (const [i, p] of lastPages.entries()) jpgs.push(await htmlToJpeg(pageHtml(p.list, p.pt, p.cols, lastPages.length > 1 ? i + 1 : 0, p), { widthIn: 5.5, heightIn: 8.5, scale: 3, quality: 0.9 }));
    const pdf = jpegsToPdf(jpgs, { pageW: 396, pageH: 612, margin: 0 });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    const p = parashaOf(cur.week);
    a.download = `שהשמחה במעונם - ${p ? p.he : cur.week}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  btn.disabled = false;
}

// ---------- ☑ "די קומענדיגע יו"ט אנשטאט די פרשה": שמחות גייען אריבער צום יום-טוב-גליון און צוריק ----------
async function toggleYt(start, on, cb) {
  const yt = ytByStart(start); const S = shabbatOfWeek(start);
  const moving = on
    ? (state.simchos || []).filter((s) => s.week === S && String(s.created_at || '').slice(0, 10) < start)
    : (state.simchos || []).filter((s) => s.week === start);
  const msg = on ? t('sgYtOnConfirm', { n: moving.length, name: yt.title }) : t('sgYtOffConfirm', { n: moving.length, name: yt.title });
  if (!confirm(msg)) { cb.checked = !on; return; }
  cb.disabled = true;
  try {
    const row = (state.simchaIssues || []).find((r) => r.yt_date === start);
    await saveRecord('SimchaIssues', 'issue_id', { ...(row || {}), yt_date: start, on: on ? 'TRUE' : 'FALSE' });
    for (const s of moving) await saveRecord('Simchos', 'simcha_id', { ...s, week: on ? start : S });
    await loadAll();
    cur.week = on ? start : S;
    ui.refreshAll(); renderSimchos();
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); cb.disabled = false; }
}

// ---------- דער מסך אין בית המדרש: די שמחות גייען אויך אין גיליון פון דער תצוגה (לשונית Simchos) ----------
// נאר דער טעקסט פון דער שמחה (ווי אין גליון) — קיין טעלעפאנען/אדרעסן. א שמחה ווייזט זיך פונקט א וואך פון ווען מ'האט זי אריינגעלייגט.
const SCREEN_DAYS = 7;
export async function syncScreen() {
  try {
    const now = Date.now();
    const rows = (state.simchos || [])
      .filter((s) => s.screen !== 'FALSE' && String(s.screen).toUpperCase() !== 'FALSE' && s.created_at)
      .map((s) => ({ s, from: new Date(String(s.created_at).replace(' ', 'T')).getTime() }))
      .filter((x) => Number.isFinite(x.from) && x.from + SCREEN_DAYS * 864e5 > now)
      .sort((a, b) => a.from - b.from)
      .map(({ s, from }) => [String(s.simcha_id), simchaHtml(s), String(from + SCREEN_DAYS * 864e5), nowStamp()]);
    const sh = otherSheet(CONFIG.DISPLAY_SHEET_ID);
    await sh.clear('Simchos!A2:D200');
    if (rows.length) await sh.write(`Simchos!A2:D${rows.length + 1}`, rows);
  } catch (err) { ui?.toast?.(t('sgScreenFail'), 'error'); }
}

// ---------- אויסמעקן: אויך וואס די שמחה האט אריינגעלייגט אין די כרטיסן (קשרים, הערה נאכן נאמען) ----------
function parseMade(s) {
  try { const m = JSON.parse(s.made || '{}'); return { rels: Array.isArray(m.rels) ? m.rels : [], notes: Array.isArray(m.notes) ? m.notes : [] }; } catch { return { rels: [], notes: [] }; }
}
async function deleteSimcha(s) {
  if (!s) return;
  const made = parseMade(s);
  const others = (state.simchos || []).filter((x) => x !== s && String(x.simcha_id) !== String(s.simcha_id)).map(parseMade);
  const usedElsewhere = (a, ty, b) => others.some((m) => m.rels.some(([x, y, z]) => String(x) === String(a) && y === ty && String(z) === String(b)));
  for (const [a, ty, b] of made.rels) {
    if (usedElsewhere(a, ty, b)) continue;
    const rel = state.relations.find((r) => String(r.contact_id_a) === String(a) && r.relation_type === ty && String(r.contact_id_b) === String(b));
    if (rel) await removeRelation(rel);
  }
  for (const n of made.notes) {
    const c = contactOf(n.id);
    if (c && (c.name_note || '') === n.after && !others.some((m) => m.notes.some((o) => o.id === n.id))) {
      await saveContact({ ...c, name_note: n.before }, state.phones.get(String(c.contact_id)) || {});
    }
  }
  await deleteRecord('Simchos', 'simcha_id', s);
}

// ---------- ווער איז עס: א קליינע שורה אונטערן נאמען (כדי צו זען אז מ'האט אויסגעקליבן דעם ריכטיגן) ----------
export function whoHint(c) {
  const rel = state.relations || [];
  const fatherId = rel.find((r) => String(r.contact_id_a) === String(c.contact_id) && r.relation_type === 'זון פון')?.contact_id_b
    || rel.find((r) => String(r.contact_id_b) === String(c.contact_id) && r.relation_type === 'טאטע פון')?.contact_id_a;
  const father = fatherId ? contactOf(fatherId) : null;
  const filId = rel.find((r) => String(r.contact_id_a) === String(c.contact_id) && r.relation_type === 'איידעם פון')?.contact_id_b
    || rel.find((r) => String(r.contact_id_b) === String(c.contact_id) && r.relation_type === 'שווער פון')?.contact_id_a;
  const fil = filId ? contactOf(filId) : null;
  const orgGroups = new Set(tagRoots().filter((r) => r.kind.startsWith('orgs:')).map((r) => r.id));
  const seen = new Set(); const tags = [];
  tagEntries(c).forEach((x) => {
    const label = orgGroups.has(String(x.p[0])) && x.p[1] ? tagNodeName(x.p[1]) : tagNodeName(x.p[x.p.length > 1 ? 1 : 0]);
    if (String(x.p[0]) === String(tagRoots().find((r) => r.name === 'אלטע רשימה')?.id)) return;
    if (!seen.has(label)) { seen.add(label); tags.push(`${label}${x.s === TAG_U ? ' ⚠' : ''}`); }
  });
  const bits = [
    `#${c.contact_id}`,
    c.area || c.city || '',
    father ? `${t('sonOf')} ${ui.fullNameHe(father)}` : '',
    fil ? `${t('silOf')} ${ui.fullNameHe(fil)}` : '',
    ...tags,
  ].filter(Boolean);
  return `🔎 ${bits.map(h).join(' · ')}`;
}

// ---------- קרובים פון א בעל שמחה: טאטע, שווער, זיידע (פון די קשרים; נאר לעבעדיגע) ----------
function relativesOf(c) {
  const id = String(c.contact_id);
  const out = [];
  const add = (oid, label) => {
    const o = contactOf(oid);
    if (!o || String(o.contact_id) === id || out.some((x) => String(x.c.contact_id) === String(o.contact_id))) return;
    if (String(o.is_alive).toUpperCase() === 'FALSE' || o.is_alive === false) return;
    out.push({ c: o, label });
  };
  const rel = state.relations || [];
  const up = (who, fwd, rev) => [
    ...rel.filter((r) => String(r.contact_id_a) === String(who) && r.relation_type === fwd).map((r) => r.contact_id_b),
    ...rel.filter((r) => String(r.contact_id_b) === String(who) && r.relation_type === rev).map((r) => r.contact_id_a),
  ];
  const fathers = up(id, 'זון פון', 'טאטע פון');
  fathers.forEach((x) => add(x, t('sgRelFather')));
  up(id, 'איידעם פון', 'שווער פון').forEach((x) => add(x, t('sgRelFil')));
  [...up(id, 'אייניקל פון', 'זיידע פון'), ...fathers.flatMap((f) => up(f, 'זון פון', 'טאטע פון'))].forEach((x) => add(x, t('sgRelGrand')));
  return out;
}

// ---------- דער טופס ----------
function honoreeRow(x, i) {
  const c = contactOf(x.id);
  const suf = x.suffix || 'הי"ו';
  const isOther = suf && !SUFFIXES.includes(suf);
  return `<fieldset class="sg-h" data-i="${i}">
    <div class="sg-h-line">
      <input class="sg-title" placeholder="${h(t('sgTitle'))}" value="${h(x.title ?? (c?.title_he || ''))}">
      <span class="sg-pickwrap"><input class="sg-pick" list="dl-sg-contacts" autocomplete="off" placeholder="${h(t('pickContact'))}" value="${c ? h(ui.pickerLabel(c)) : h(x.name || '')}" data-id="${h(x.id || '')}"><span class="sg-who small">${c ? whoHint(c) : ''}</span></span>
      <button type="button" class="btn primary small-btn sg-open-card" title="${h(t('sgOpenCard'))}"${c ? '' : ' hidden'}>✎ ${h(t('sgOpenCard'))}</button>
      <button type="button" class="btn small-btn sg-new-contact" title="${h(t('sgNewContactTip'))}"${c ? ' hidden' : ''}>＋ ${h(t('sgNewContact'))}</button>
      <span class="sg-suf">${SUFFIXES.map((sx) => `<label class="chip-radio"><input type="radio" name="suf${i}" value="${h(sx)}"${suf === sx ? ' checked' : ''}> ${h(sx)}</label>`).join('')}
        <label class="chip-radio"><input type="radio" name="suf${i}" value="__other"${isOther ? ' checked' : ''}> ${h(t('sgOther'))}</label>
        <input class="sg-suf-other" value="${isOther ? h(suf) : ''}"${isOther ? '' : ' hidden'}></span>
      ${i === 0 ? `<label class="small">${h(t('sgToChild'))} <select class="sg-tochild">${TO_CHILD.map(([v, l]) => `<option value="${v}"${String(x.toChild || '1') === v ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>` : ''}
      ${i > 0 ? '<button type="button" class="linkish sg-remove">✕</button>' : ''}
    </div>
    ${i > 0 ? `<div class="sg-link" data-link></div>` : ''}
    <div class="sg-h-line"><label class="check small"><input type="checkbox" class="sg-note-on"${x.noteOn ? ' checked' : ''}> ${h(t('sgNote'))}</label>
      <input class="sg-note-in" placeholder="${h(t('sgNotePh'))}" value="${h(x.note ?? (c?.name_note || ''))}"${x.noteOn ? '' : ' hidden'}></div>
  </fieldset>`;
}

export function openSimchaForm(s = {}) {
  const rec = { type: 'birth', child_gender: 'm', week: cur.week || weekNow(), ...s };
  let hs = parseH(rec);
  if (!hs.length) hs = [{}];
  const dlg = $('#simcha-dialog'); const form = $('#simcha-form');
  const relTypes = Object.keys(DELTA);
  const draw = () => {
    form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
      <h2>🍷 ${h(rec.simcha_id ? t('sgEdit') : t('sgNew'))}</h2>
      <datalist id="dl-sg-contacts">${state.contacts.map((x) => { const en = [x.first_name_en, x.last_name_en].filter(Boolean).join(' '); return `<option value="${h(ui.pickerLabel(x))}"${en ? ` label="${h(en)}"` : ''}>`; }).join('')}</datalist>
      <div class="sg-toprow">
        <div class="sg-types">${[...Object.entries(TYPES), ['special', { label: t('sgSpecial') }]].map(([k, v]) => `<label class="chip-radio big"><input type="radio" name="type" value="${k}"${rec.type === k ? ' checked' : ''}> ${h(v.label)}</label>`).join('')}</div>
        <span class="spacer"></span>
        <label class="sg-screen" title="${h(t('sgScreenTip'))}"><input type="checkbox" name="screen"${rec.screen === 'FALSE' ? '' : ' checked'}> 📺 ${h(t('sgScreen'))}</label>
        <span class="sg-when"><button type="button" class="btn small-btn" id="sg-when">📅 ${h(rec.week === weekNow() ? t('sgThisWeek') : weekLabel(rec.week))}</button>
          <input type="date" id="sg-when-date" hidden value="${h(rec.week)}"></span>
      </div>
      ${!rec.simcha_id && lateFor(rec.week) && rec.week === weekNow() ? `<p class="sg-late-warn">⚠ ${h(t('sgLateWarn'))}</p>` : ''}
      <div class="sg-special-box" data-special${rec.type === 'special' ? '' : ' hidden'}>
        <div class="sg-rich-tools"><button type="button" class="btn small-btn" id="sg-bold" title="${h(t('sgBold'))}"><b>B</b></button>
          <span class="muted small">${h(t('sgSpecialHint'))}</span></div>
        <div class="sg-rich" id="sg-rich" contenteditable="true" dir="rtl">${cleanRich(rec.special)}</div>
        <h3>${h(t('sgRelated'))}</h3>
        <div class="sg-related" id="sg-related"></div>
        <div class="sg-h-line"><input id="sg-rel-pick" list="dl-sg-contacts" autocomplete="off" placeholder="${h(t('pickContact'))}">
          <button type="button" class="btn small-btn" id="sg-rel-add">＋</button></div>
      </div>
      <div data-regular${rec.type === 'special' ? ' hidden' : ''}>
      <h3>${h(t('sgHonorees'))}</h3>
      <div id="sg-hs">${hs.map(honoreeRow).join('')}</div>
      <button type="button" class="btn small-btn" id="sg-add-h">＋ ${h(t('sgAddH'))}</button>
      <h3>${h(t('sgChild'))}</h3>
      <div class="grid">
        <label>${h(t('sgGender'))}<select name="child_gender"><option value="m"${rec.child_gender !== 'f' ? ' selected' : ''}>${h(t('sgBoy'))}</option><option value="f"${rec.child_gender === 'f' ? ' selected' : ''}>${h(t('sgGirl'))}</option></select></label>
        <label data-childname>${h(t('sgChildName'))}<input name="child_name" list="dl-sg-contacts" autocomplete="off" value="${h(rec.child_name || '')}" placeholder="${h(t('sgChildPh'))}">
          <span class="small sg-child-link" id="sg-child-link"></span>
          <button type="button" class="btn small-btn" id="sg-child-new">＋ ${h(t('sgNewContact'))}</button></label>
        <label data-other${TYPES[rec.type]?.other ? '' : ' hidden'}>${h(t('sgOtherSide'))}<input name="other_side" value="${h(rec.other_side || '')}" placeholder="${h(t('sgOtherPh'))}"></label>
      </div>
      <label class="wide">${h(t('sgAfterNote'))}<input name="after_note" value="${h(rec.after_note || '')}" placeholder="${h(t('sgAfterNotePh'))}"></label>
      </div>
      <h3>${h(t('sgPreview'))}</h3>
      <div class="sg-live" id="sg-live"></div>
      <label class="wide" data-regular${rec.type === 'special' ? ' hidden' : ''}>${h(t('sgOverride'))}<input name="text_override" value="${h(rec.text_override || '')}" placeholder="${h(t('sgOverridePh'))}"></label>
      <div class="actions"><span class="spacer"></span>
        <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>`;
    wireForm();
  };
  const contactByLabel = (v) => state.contacts.find((x) => ui.pickerLabel(x) === String(v || '').trim());
  // לייענט דעם טופס צוריק אין "hs" / "rec"
  const read = () => {
    rec.type = form.elements.type.value || rec.type;
    rec.child_gender = form.elements.child_gender.value;
    rec.child_name = form.elements.child_name.value.trim();
    rec.other_side = form.elements.other_side.value.trim();
    rec.text_override = form.elements.text_override.value.trim();
    rec.after_note = form.elements.after_note.value.trim();
    if (form.elements.screen) rec.screen = form.elements.screen.checked ? '' : 'FALSE';
    if ($('#sg-rich', form)) rec.special = cleanRich($('#sg-rich', form).innerHTML);
    hs = $$('.sg-h', form).map((fs, i) => {
      const pk = $('.sg-pick', fs);
      const c = contactByLabel(pk.value) || (pk.value.trim() && pk.dataset.id ? contactOf(pk.dataset.id) : null);
      const r = $(`input[name="suf${i}"]:checked`, fs);
      const suffix = r ? (r.value === '__other' ? $('.sg-suf-other', fs).value.trim() : r.value) : '';
      const prev = hs[i] || {};
      const x = {
        id: c ? String(c.contact_id) : '', name: c ? '' : pk.value.trim(), title: $('.sg-title', fs).value.trim(), suffix,
        noteOn: $('.sg-note-on', fs).checked, note: $('.sg-note-in', fs).value.trim(),
      };
      if (i === 0) x.toChild = $('.sg-tochild', fs).value;
      const lt = $('.sg-link-type', fs); const lto = $('.sg-link-to', fs); const un = $('.sg-unrel', fs);
      if (un && un.checked) x.unrelated = true;
      else if (lt && lt.value && lto && lto.value) x.link = { type: lt.value, to: lto.value };
      else if (prev.link && !lt) x.link = prev.link;
      return x;
    });
  };
  const refreshLinks = () => {
    const g = graph();
    $$('.sg-h', form).forEach((fs, i) => {
      if (!i) return;
      const box = $('[data-link]', fs);
      const x = hs[i];
      const prevIds = hs.slice(0, i).map(hkey).filter(Boolean);
      const xk = hkey(x);
      if (!xk || !prevIds.length) { box.innerHTML = ''; return; }
      const known = x.id ? prevIds.find((p) => !p.startsWith('n:') && genDelta(g, x.id, p) !== null) : null;
      if (known) {
        const d = directRel(x.id, known);
        box.innerHTML = `<span class="muted small">✓ ${h(d ? `${d.relation_type} ${ui.fullNameHe(contactOf(known))}` : t('sgLinked', { name: ui.fullNameHe(contactOf(known)) }))}</span>`;
        return;
      }
      const lk = x.link || {};
      box.innerHTML = `<span class="small">${h(t('sgWhatIs'))}</span>
        <select class="sg-link-type"${x.unrelated ? ' disabled' : ''}><option value=""></option>${relTypes.map((r) => `<option${lk.type === r ? ' selected' : ''}>${h(r)}</option>`).join('')}</select>
        <select class="sg-link-to"${x.unrelated ? ' disabled' : ''}>${prevIds.map((p) => `<option value="${h(p)}"${lk.to === p ? ' selected' : ''}>${h(keyLabel(p))}</option>`).join('')}</select>
        <label class="check small"><input type="checkbox" class="sg-unrel"${x.unrelated ? ' checked' : ''}> ${h(t('sgUnrelated'))}</label>`;
      $$('select, input', box).forEach((el) => { el.onchange = () => { read(); refreshLinks(); live(); }; });
    });
  };
  let related = (() => { try { return JSON.parse(rec.related || '[]'); } catch { return []; } })();
  const drawRelated = () => {
    const box = $('#sg-related', form);
    if (!box) return;
    box.innerHTML = related.map((id) => `<span class="chip">${h(ui.fullNameHe(contactOf(id) || {}) || `#${id}`)} <button type="button" class="linkish" data-rel-x="${h(id)}">✕</button></span>`).join('') || `<span class="muted small">${h(t('sgRelatedNone'))}</span>`;
    $$('[data-rel-x]', box).forEach((b) => { b.onclick = () => { related = related.filter((x) => x !== b.dataset.relX); drawRelated(); }; });
  };
  const live = () => {
    const sp = rec.type === 'special';
    $$('[data-regular]', form).forEach((el) => { el.hidden = sp; });
    $('[data-special]', form).hidden = !sp;
    $('[data-other]', form).hidden = !TYPES[rec.type]?.other;
    $('[data-childname]', form).hidden = isSelf({ ...rec, honorees: JSON.stringify(hs) });
    if (sp) { $('#sg-live', form).innerHTML = rec.special ? simchaHtml(rec) : `<span class="muted">${h(t('sgSpecialHint'))}</span>`; return; }
    $('#sg-live', form).innerHTML = hs.some(hkey) ? simchaHtml({ ...rec, honorees: JSON.stringify(hs) }) : `<span class="muted">${h(t('sgPickFirst'))}</span>`;
  };
  const wireForm = () => {
    $$('[data-close]', form).forEach((b) => { b.onclick = () => dlg.close(); });
    // ווען: די וואך / אן אנדער דאטום
    const wd = $('#sg-when-date', form);
    $('#sg-when', form).onclick = () => { wd.hidden = false; try { wd.showPicker(); } catch { wd.focus(); } };
    wd.onchange = () => { if (wd.value) { read(); rec.week = issueForDate(wd.value); draw(); } };
    // ספעציעלע: פעט / פשוט
    $('#sg-bold', form).onmousedown = (e) => { e.preventDefault(); document.execCommand('bold'); read(); live(); };
    $('#sg-rich', form).oninput = () => { read(); live(); };
    $('#sg-rel-add', form).onclick = () => {
      const c = contactByLabel($('#sg-rel-pick', form).value);
      if (c && !related.includes(String(c.contact_id))) related.push(String(c.contact_id));
      $('#sg-rel-pick', form).value = ''; drawRelated();
    };
    $('#sg-rel-pick', form).onchange = () => $('#sg-rel-add', form).click();
    drawRelated();
    // דער ילד/חתן/כלה פון מאגר (למשל א בחור פון דער ישיבה) — געדענקט אין child_contact_id
    const childIn = form.elements.child_name;
    const drawChild = () => {
      const c = contactOf(rec.child_contact_id);
      $('#sg-child-link', form).innerHTML = c ? `✓ ${h(ui.fullNameHe(c))} <button type="button" class="linkish" id="sg-child-x">✕</button><div class="sg-who small">${whoHint(c)}</div>` : '';
      const x = $('#sg-child-x', form);
      if (x) x.onclick = () => { rec.child_contact_id = ''; drawChild(); };
    };
    childIn.addEventListener('change', () => {
      const c = contactByLabel(childIn.value);
      if (c) { rec.child_contact_id = String(c.contact_id); childIn.value = `${c.title_he || ''} ${c.first_name_he || ''}`.trim(); }
      else if (!childIn.value.trim()) rec.child_contact_id = '';
      drawChild(); read(); live();
    });
    drawChild();
    // עפענען דעם כרטיס (צו פאררעכטן א טעות) — נאכן צומאכן ווערט דער טופס דערהיינטיגט
    $$('.sg-open-card', form).forEach((b) => {
      b.onclick = () => {
        const id = $('.sg-pick', b.closest('.sg-h')).dataset.id;
        if (!id) return;
        read();
        ui.openCard(id);
        const back = () => { if (dlg.open) { read(); draw(); } };
        ['#card-dialog', '#form-dialog'].forEach((sel) => { const d = $(sel); if (d) d.addEventListener('close', () => setTimeout(back, 50), { once: true }); });
      };
    });
    // ＋ נייער קאנטאקט — פונעם טופס פון דער שמחה; נאכן אפהיטן ווערט ער אויסגעקליבן
    const newContact = (typed, title, done) => {
      const words = String(typed || '').trim().split(/\s+/).filter(Boolean);
      const last = words.length > 1 ? words.pop() : (words.pop() || '');
      const before = new Set(state.contacts.map((x) => String(x.contact_id)));
      ui.openForm({ title_he: title || '', first_name_he: words.join(' '), last_name_he: last });
      const fd = $('#form-dialog');
      if (fd) fd.addEventListener('close', () => setTimeout(() => {
        const nc = state.contacts.find((x) => !before.has(String(x.contact_id)));
        if (nc && dlg.open) done(nc);
      }, 80), { once: true });
    };
    $$('.sg-new-contact', form).forEach((b) => {
      b.onclick = () => {
        read();
        const fs = b.closest('.sg-h'); const i = Number(fs.dataset.i);
        newContact($('.sg-pick', fs).value, $('.sg-title', fs).value.trim(), (nc) => {
          read();
          hs[i] = { ...hs[i], id: String(nc.contact_id), name: '', title: hs[i].title || nc.title_he || '' };
          draw();
        });
      };
    });
    $('#sg-child-new', form).onclick = () => {
      read();
      newContact(form.elements.child_name.value, '', (nc) => {
        read();
        rec.child_contact_id = String(nc.contact_id);
        rec.child_name = `${nc.title_he || ''} ${nc.first_name_he || ''}`.trim();
        draw();
      });
    };
    $('#sg-add-h', form).onclick = () => { read(); hs.push({}); draw(); };
    // ווען מ'קלייבט א בעל שמחה: זיין טאטע, שווער, זיידע — צולייגן?
    const offerRelatives = (fs, c) => {
      const prev = $('.sg-offer', fs);
      if (prev && prev.dataset.cid === String(c.contact_id)) return; // שוין דא (א צווייטער "change" ביים בלור)
      prev?.remove();
      const rels = relativesOf(c).filter((r) => !hs.some((x) => String(x.id) === String(r.c.contact_id)));
      if (!rels.length) return;
      const box = document.createElement('div');
      box.className = 'sg-offer';
      box.dataset.cid = String(c.contact_id);
      box.innerHTML = `<span class="small">${h(t('sgOfferQ'))}</span>
        ${rels.map((r) => `<label class="chip-check"><input type="checkbox" value="${h(r.c.contact_id)}" checked> ${h(r.label)}: ${h(ui.fullNameHe(r.c))}</label>`).join('')}
        <button type="button" class="btn small-btn primary sg-offer-yes">${h(t('sgOfferAdd'))}</button>
        <button type="button" class="linkish sg-offer-no">${h(t('sgOfferNo'))}</button>`;
      fs.append(box);
      $('.sg-offer-no', box).onclick = () => box.remove();
      $('.sg-offer-yes', box).onclick = () => {
        read();
        $$('input:checked', box).forEach((i) => { if (!hs.some((x) => String(x.id) === i.value)) hs.push({ id: i.value }); });
        draw();
      };
    };
    $$('.sg-remove', form).forEach((b) => { b.onclick = () => { read(); hs.splice(Number(b.closest('.sg-h').dataset.i), 1); draw(); }; });
    $$('.sg-h', form).forEach((fs) => {
      $('.sg-pick', fs).addEventListener('change', () => {
        const c = contactByLabel($('.sg-pick', fs).value);
        $('.sg-pick', fs).dataset.id = c ? String(c.contact_id) : '';
        $('.sg-open-card', fs).hidden = !c;
        $('.sg-new-contact', fs).hidden = !!c;
        $('.sg-who', fs).innerHTML = c ? whoHint(c) : '';
        if (c) {
          if (!$('.sg-title', fs).value.trim()) $('.sg-title', fs).value = c.title_he || '';
          $('.sg-note-in', fs).value = c.name_note || '';
          if (c.name_note) { $('.sg-note-on', fs).checked = true; $('.sg-note-in', fs).hidden = false; }
        }
        read(); refreshLinks(); live();
        if (c) offerRelatives(fs, c);
      });
      $('.sg-note-on', fs).addEventListener('change', (e) => { $('.sg-note-in', fs).hidden = !e.target.checked; });
      $$('input[type=radio]', fs).forEach((r) => r.addEventListener('change', () => { $('.sg-suf-other', fs).hidden = r.value !== '__other' || !r.checked; }));
    });
    form.oninput = () => { read(); live(); };
    form.onchange = () => { read(); live(); };
    read(); refreshLinks(); live();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      read();
      const btn = form.querySelector('[type=submit]');
      if (rec.type === 'special') {
        if (!rec.special) { ui.toast(t('sgSpecialEmpty'), 'error'); return; }
        btn.disabled = true;
        try {
          const out = { ...rec, honorees: '[]', related: JSON.stringify(related) };
          if (!out.simcha_id) { out.sort = ownOf(out.week).length + 1; if (lateFor(out.week) && out.week === weekNow()) out.also_next = 'TRUE'; }
          await saveRecord('Simchos', 'simcha_id', out);
          await loadAll(); await syncScreen(); dlg.close(); cur.week = out.week; ui.refreshAll(); renderSimchos(); ui.toast(t('saved'));
        } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; }
        return;
      }
      if (!hs.some(hkey)) { ui.toast(t('sgPickFirst'), 'error'); return; }
      btn.disabled = true;
      try {
        const clean = hs.filter(hkey).map((x) => (x.id ? { ...x, name: '' } : x));
        const out = { ...rec, honorees: JSON.stringify(clean) };
        if (!out.simcha_id) { out.sort = ownOf(out.week).length + 1; if (lateFor(out.week) && out.week === weekNow()) out.also_next = 'TRUE'; }
        // וואס די שמחה לייגט אריין אין די כרטיסן — געדענקט אין "made", כדי ביים אויסמעקן עס צוריקצונעמען
        const made = parseMade(rec);
        // נייע קשרים צווישן בעלי השמחה → אין די כרטיסן
        for (const x of clean) {
          if (x.id && x.link && x.link.type && x.link.to && !String(x.link.to).startsWith('n:') && genDelta(graph(), x.id, x.link.to) === null) {
            await addRelation(x.id, x.link.type, x.link.to);
            made.rels.push([x.id, x.link.type, x.link.to]);
          }
        }
        // דער ילד פון מאגר → א קשר צום ערשטן בעל שמחה (זון/טאכטער פון, אייניקל פון)
        const f0 = clean[0];
        if (rec.child_contact_id && f0 && f0.id && !isSelf(out) && String(rec.child_contact_id) !== String(f0.id)) {
          const ty = { 1: rec.child_gender === 'f' ? 'טאכטער פון' : 'זון פון', 2: 'אייניקל פון' }[String(f0.toChild || '1')];
          if (ty && (DELTA[ty] !== undefined || state.relationReverse?.[ty]) && genDelta(graph(), String(rec.child_contact_id), String(f0.id)) === null) {
            await addRelation(String(rec.child_contact_id), ty, String(f0.id));
            made.rels.push([String(rec.child_contact_id), ty, String(f0.id)]);
          }
        }
        // די הערה נאכן נאמען → אין כרטיס
        for (const x of clean) {
          const c = contactOf(x.id);
          if (c && x.noteOn && x.note && x.note !== (c.name_note || '')) {
            await saveContact({ ...c, name_note: x.note }, state.phones.get(String(c.contact_id)) || {});
            if (!made.notes.some((n) => n.id === x.id)) made.notes.push({ id: x.id, before: c.name_note || '', after: x.note });
            else made.notes = made.notes.map((n) => (n.id === x.id ? { ...n, after: x.note } : n));
          }
        }
        out.made = JSON.stringify(made);
        await saveRecord('Simchos', 'simcha_id', out);
        await loadAll();
        await syncScreen();
        dlg.close();
        cur.week = out.week;
        ui.refreshAll();
        renderSimchos();
        ui.toast(t('saved'));
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; }
    };
  };
  draw();
  if (!dlg.open) dlg.showModal();
}
