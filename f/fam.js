// 👨‍👩‍👦 דף משפחה ציבורי: ungvar.org/f/<כתובת> (צפייה) או ungvar.org/f/<כתובת>-<קוד> (עריכה). בלי כניסה.
import { suggest, details, placesEnabled } from '/js/places.js?v=727';
import { downloadXlsx } from '/js/excel.js?v=726';
import { suggestFirstName, suggestLastName } from '/js/names.js';

const API = 'https://script.google.com/macros/s/AKfycbzK63Qd9P3Gb-255-gVFGvqkF_NddBjJ9i5yHKrnaK_E8PwLsB_7WDO6Lh2iyqO1vPZ/exec';
const MEN = ['מו"ה', 'הרב', 'הרה"ג', 'הרה"צ', 'הבה"ח'];
const TITLE_EN = { 'מו"ה': 'Mr.', 'הרב': 'Rabbi', 'הרה"ג': 'Rabbi', 'הרה"צ': 'Rabbi', 'כ"ק': 'Grand Rabbi', 'הבה"ח': 'Mr.', 'מרת': 'Mrs.', 'הרבנית': 'Rebbetzin' };
const MONTHS = ['תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר א\'', 'אדר ב\'', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'];
const T = {
  he: { dir: 'rtl', loading: 'טוען…', notFound: 'הדף לא נמצא.', people: '{n} אנשים',
    capMsg: 'הגעתם למכסה היומית של חיפוש כתובות — אפשר לכתוב את הכתובת ביד, והיא תישמר כמו שהיא',
    dlPending: 'יש שינויים שעוד לא נשמרו — שמרו קודם, ואז הורידו', dlCols: ['דור', 'של מי', 'שם בעברית', 'שם באנגלית', 'כתובת'], of: 'של {n}', popup: 'הדפדפן חסם חלון חדש — אפשרו חלונות קופצים לאתר',
    introView: 'זו רשימת המשפחה כפי שהיא רשומה אצלנו.',
    introEdit: 'אנא עברו על הרשימה. אפשר לתקן פרטים, להוסיף ילדים שחסרים, ולהוריד מי שלא שייך. בסיום לחצו "💾 שמירה" למטה.',
    lv: ['ראש המשפחה', 'בן', 'נכד', 'נין', 'בן נין'], lvh: ['', 'חתן', 'חתן (נכד)', 'חתן (נין)', 'חתן'], lvd: ['', 'בת', 'נכדה', 'נינה', 'בת'], other: 'קרוב', branch: 'משפחת {name}', kids: '{n} ילדים',
    edit: 'תיקון פרטים', addM: '➕ ילד נשוי', addH: '➕ ילד בבית', del: 'לא שייך', undo: '↩ ביטול', ok: '✓ אישור', cancel: 'ביטול',
    isA: 'הוא / היא:', s: 'בן', h: 'חתן', d: 'בת', husband: 'הבעל', wife: 'האשה', child: 'הילד / הילדה',
    t: 'תואר', f: 'שם פרטי', l: 'שם משפחה', fe: 'שם פרטי באנגלית', le: 'שם משפחה באנגלית', m: 'טלפון נייד', e: 'אימייל',
    wt: 'תואר', mrs: 'מרת', reb: 'הרבנית', addr: 'כתובת (לבחור מהרשימה שנפתחת)', hp: 'טלפון בבית', note: 'הערה',
    outH: 'נפטר / יצא', outW: 'נפטרה / יצאה', yz: 'יארצייט:', day: 'יום', month: 'חודש', year: 'שנה (לא חובה)',
    divH: 'התגרשו — הוא יצא מהמשפחה', divW: 'התגרשו — היא יצאה מהמשפחה', divOtherW: 'התגרשו — האשה יוצאת מהמשפחה', divOtherH: 'התגרשו — החתן יוצא מהמשפחה', zip: 'מיקוד (ZIP)', outNone: 'ביטול',
    remarry: '💍 התחתן מחדש', remarried: 'האשה החדשה:', married: '💍 התחתן', moved: '🏠 עבר דירה', home: 'גר בבית',
    zl: 'ז"ל', zlF: 'ע"ה', div: 'גרוש', widow: 'אלמן', removed: 'יוסר', added: 'חדש', changed: 'תוקן',
    who: 'מי ממלא?', whoName: 'שם', whoPhone: 'טלפון', save: '💾 שמירה', saving: 'שומר…',
    pending: '{n} שינויים שעוד לא נשמרו', none: 'אין עדיין שינויים', saved: '✓ נשמר — תודה רבה!',
    errWho: 'נא למלא שם וטלפון של מי שממלא', err: 'משהו השתבש, נסו שוב', busy: 'יותר מדי פעמים, נסו מאוחר יותר',
    errAddr: 'את הכתובת צריך לבחור מהרשימה שנפתחת מתחת לשדה (תתחילו להקליד ותבחרו)', errOut: 'צריך למלא יארצייט או לסמן "התגרשו"', errName: 'צריך למלא שם', errRel: 'צריך לסמן למעלה: {a} או {b}',
    leave: 'יש שינויים שעוד לא נשמרו', divNote: 'הבת תקבל כרטיס משלה ברשימה, והחתן יוסר.' },
  en: { dir: 'ltr', loading: 'Loading…', notFound: 'Page not found.', people: '{n} people',
    capMsg: 'The daily address-search limit was reached — type the address by hand and it will be saved as written',
    dlPending: 'You have unsaved changes — save first, then download', dlCols: ['Relation', 'Of', 'Hebrew name', 'English name', 'Address'], of: 'of {n}', popup: 'The browser blocked a new window — please allow pop-ups for this site',
    introView: 'This is the family list as we have it.',
    introEdit: 'Please review the list. You can fix details, add missing children, and remove anyone who doesn\'t belong. When done, press "💾 Save" at the bottom.',
    lv: ['Head of family', 'Son', 'Grandson', 'Great-grandson', 'Son'], lvh: ['', 'Son-in-law', 'Grandson-in-law', 'Great-grandson-in-law', 'Son-in-law'], lvd: ['', 'Daughter', 'Granddaughter', 'Great-granddaughter', 'Daughter'], other: 'Relative', branch: 'The {name} family', kids: '{n} children',
    edit: 'Edit details', addM: '➕ Married child', addH: '➕ Child at home', del: 'Not in family', undo: '↩ Undo', ok: '✓ OK', cancel: 'Cancel',
    isA: 'He / she is:', s: 'Son', h: 'Son-in-law', d: 'Daughter', husband: 'Husband', wife: 'Wife', child: 'Child',
    t: 'Title', f: 'First name (Hebrew)', l: 'Last name (Hebrew)', fe: 'First name', le: 'Last name', m: 'Cell phone', e: 'Email',
    wt: 'Title', mrs: 'Mrs.', reb: 'Rebbetzin', addr: 'Address (pick from the list)', hp: 'Home phone', note: 'Note',
    outH: 'Passed away / left', outW: 'Passed away / left', yz: 'Yahrzeit:', day: 'Day', month: 'Month', year: 'Year (optional)',
    divH: 'Divorced — he left the family', divW: 'Divorced — she left the family', divOtherW: 'Divorced — the wife leaves the family', divOtherH: 'Divorced — the son-in-law leaves the family', zip: 'ZIP / Postal code', outNone: 'Cancel',
    remarry: '💍 Remarried', remarried: 'New wife:', married: '💍 Got married', moved: '🏠 Moved out', home: 'Lives at home',
    zl: 'z"l', zlF: 'a"h', div: 'Divorced', widow: 'Widower', removed: 'Will be removed', added: 'New', changed: 'Edited',
    who: "Who's filling this in?", whoName: 'Name', whoPhone: 'Phone', save: '💾 Save', saving: 'Saving…',
    pending: '{n} unsaved changes', none: 'No changes yet', saved: '✓ Saved — thank you!',
    errWho: 'Please enter your name and phone', err: 'Something went wrong, please try again', busy: 'Too many tries, please try later',
    errAddr: 'Please pick the address from the list that opens under the field', errOut: 'Fill in the yahrzeit or check "Divorced"', errName: 'Please enter a name', errRel: 'Please choose at the top: {a} or {b}',
    leave: 'You have unsaved changes', divNote: 'The daughter will get her own card; the son-in-law will be removed.' },
};
const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
let lang = ['he', 'en'].includes(store.get('famLang')) ? store.get('famLang') : 'he';
const tr = (k, v = {}) => String(T[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);

const slug = (() => {
  const m = location.pathname.match(/^\/f\/([^/?#]+)/);
  return decodeURIComponent((m && m[1]) || new URLSearchParams(location.search).get('s') || '').trim().toLowerCase();
})();
let data = null; // { name, mode, people }
let edits = {}; // key → { fields, out, rel, note, married, moved }
let dels = new Map(); // key → { purge }
let adds = []; // { temp, parent, home, rel, fields, note }
let open = null; // { kind: 'edit'|'add', key, fs }
let msg = '';
let formErr = '';
let tmpN = 0;
const root = () => $('#fam');

async function api(body) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}
const nPending = () => Object.keys(edits).length + dels.size + adds.length;
// לומדים שמות באנגלית מהמשפחה — אבל לא שם משפחה באנגלית ששייך בדרך כלל לשם עברי אחר (למשל Klein אצל רויזנבוים בטעות)
const known = () => {
  const ppl = data?.people || []; const cnt = new Map();
  ppl.forEach((p) => { if (p.l && p.le) { const k = p.le.trim().toLowerCase(); const m = cnt.get(k) || new Map(); m.set(p.l, (m.get(p.l) || 0) + 1); cnt.set(k, m); } });
  const top = (le) => { let b = ''; let n = 0; (cnt.get(le.trim().toLowerCase()) || new Map()).forEach((v, k) => { if (v > n) { n = v; b = k; } }); return b; };
  return ppl.map((p) => ({ first_name_he: p.f, first_name_en: p.fe, last_name_he: p.l, last_name_en: p.le && p.l && top(p.le) !== p.l ? '' : p.le, wife_name_he: p.w, wife_name_en: p.we }));
};
const enFirst = (he) => { try { return suggestFirstName(he, known()); } catch { return ''; } };
const enLast = (he) => { try { return suggestLastName(he, known()); } catch { return ''; } };
const addrText = (o) => [o.a, o.city, [o.st, o.zip].filter(Boolean).join(' '), o.co && o.co !== 'USA' ? o.co : ''].filter(Boolean).join(', ');

/** דער מענטש מיט די טוישן וואס מ'האט נאך נישט געשפייכלט */
function cur(x) {
  const e = edits[x.k]; if (!e) return x;
  const o = { ...x, ...(e.fields || {}) };
  if (e.out?.side === 'h' && e.out.type === 'dead') o.d = 1;
  if (e.out?.side === 'w' && e.out.type === 'dead') o.wd = 1;
  if (e.out?.side === 'w' && e.out.type === 'div' && !e.fields?.w) { o.w = ''; o.we = ''; }
  if (e.married) o.lw = 0;
  if (e.moved) o.lw = 0;
  if (e.rel) o.r = e.rel;
  return o;
}
function tree() {
  const all = [...data.people, ...adds.map((a) => ({ k: a.temp, ...a.fields, wr: a.fields.wr === '1' ? 1 : 0, p: a.parent, r: a.rel, lw: a.home ? 1 : 0, _new: 1 }))];
  const keys = new Set(all.map((x) => String(x.k)));
  const kids = new Map(); const roots = [];
  all.forEach((x) => { const p = x.p && keys.has(String(x.p)) && String(x.p) !== String(x.k) ? String(x.p) : ''; if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(x); } else roots.push(x); });
  roots.sort((a, b) => (b.hd || 0) - (a.hd || 0));
  kids.forEach((list) => list.sort((a, b) => (a.lw || 0) - (b.lw || 0)));
  return { roots, kids };
}
function relLabel(x, depth) {
  if (depth === 0) return x.hd ? T[lang].lv[0] : tr('other');
  const d = Math.min(depth, 4);
  return x.r === 'h' ? T[lang].lvh[d] : x.r === 'd' ? T[lang].lvd[d] : T[lang].lv[d];
}
const heName = (x) => [x.t, x.f, x.l].filter(Boolean).join(' ');
const enName = (x) => [TITLE_EN[x.t] || '', x.fe, x.le].filter(Boolean).join(' ');
const wifeHe = (x) => (x.w ? [x.wr ? 'הרבנית' : 'מרת', x.w].join(' ') : '');
const wifeEn = (x) => (x.we ? [x.wr ? 'Rebbetzin' : 'Mrs.', x.we].join(' ') : '');

// ---------- כרטיס ----------
function personHtml(x0, kids, seen, depth) {
  if (seen.has(String(x0.k))) return '';
  seen.add(String(x0.k));
  const x = cur(x0);
  const edit = data.mode === 'edit';
  const gone = dels.has(String(x.k));
  const ch = Boolean(edits[x.k]);
  const isOpen = open && String(open.key) === String(x.k);
  const myKids = kids.get(String(x.k)) || [];
  const sub = myKids.map((y) => personHtml(y, kids, seen, depth + 1)).join('');
  const lv = depth === 0 ? (x.hd ? 0 : 1) : Math.min(depth, 3);
  const branch = !x.lw && (depth === 1 || (depth === 0 && !x.hd));
  const tags = [x.lw ? `<span class="fp-tag home">${h(tr('home'))}</span>` : '', x.ms === 'גרוש' ? `<span class="fp-tag grey">${h(tr('div'))}</span>` : '',
    gone ? `<span class="fp-tag bad">${h(tr('removed'))}</span>` : x._new ? `<span class="fp-tag new">${h(tr('added'))}</span>` : ch ? `<span class="fp-tag ok">${h(tr('changed'))}</span>` : ''].join('');
  const det = edit ? [addrText(x), x.m, x.e, x.hp].filter(Boolean) : [addrText(x) || x.city].filter(Boolean);
  const btn = (attr, label, cls = '') => `<button type="button" class="${cls}" ${attr}="${h(x.k)}">${h(label)}</button>`;
  const acts = !edit ? '' : gone ? btn('data-undel', tr('undo'))
    : x._new ? btn('data-unadd', tr('undo'))
      : [btn('data-edit', tr('edit'), 'b-edit'), ch ? btn('data-unedit', tr('undo')) : '', x.lw ? '' : btn('data-addm', tr('addM'), 'b-add'), x.lw ? '' : btn('data-addh', tr('addH'), 'b-add'), x.hd ? '' : btn('data-del', tr('del'), 'b-del')].join('');
  const card = `<div class="fp-card${edit ? '' : ' view'}">
      ${edit ? `<div class="fp-acts">${acts}</div>` : ''}
      <div class="fp-he" dir="rtl"><div class="fp-top"><span class="fp-rel">${h(relLabel(x, depth))}</span>${tags}</div>
        <div class="fp-name"><b>${h(heName(x) || '—')}</b>${x.d ? ` <span class="zl">${h('ז"ל')}</span>` : ''}</div>
        ${x.w ? `<div class="fp-wife">${h(wifeHe(x))}${x.wd ? ` <span class="zl">${h('ע"ה')}</span>` : ''}</div>` : ''}</div>
      <div class="fp-en" dir="ltr"><div class="fp-name"><b>${h(enName(x))}</b>${x.d && enName(x) ? ' <span class="zl">z"l</span>' : ''}</div>
        ${x.we ? `<div class="fp-wife">${h(wifeEn(x))}${x.wd ? ' <span class="zl">a"h</span>' : ''}</div>` : ''}</div>
      ${det.length ? `<div class="fp-det">${det.map((d) => `<span dir="auto">${h(d)}</span>`).join('')}</div>` : ''}
    </div>
    ${isOpen ? formHtml(x0) : ''}
    ${sub ? `<ul class="fp-kids">${sub}</ul>` : ''}`;
  const cls = `fp lv${lv}${gone ? ' gone' : ''}${x._new ? ' new' : ''}${ch ? ' changed' : ''}${x.lw ? ' athome' : ''}`;
  if (branch) return `<li class="${cls} branch"><div class="fp-branchhead">${h(tr('branch', { name: [x.f || x.fe, x.l || x.le].filter(Boolean).join(' ') }))}${myKids.length ? ` <span>· ${h(tr('kids', { n: myKids.length }))}</span>` : ''}</div>${card}</li>`;
  return `<li class="${cls}">${card}</li>`;
}

// ---------- טופס ----------
/** מצב הטופס: ערכים, נפטר/יצא, התחתן, עבר דירה */
function newFs(kind, x, home) {
  const v = kind === 'edit' ? { ...cur(x) } : {};
  if (kind === 'edit') { v.wr = x.wr ? '1' : '0'; v.wl = v.w ? (v.l || '') : ''; v.wle = v.we ? (v.le || '') : ''; }
  if (kind !== 'edit') { v.t = home ? '' : 'מו"ה'; v.wr = '0'; v.l = ''; }
  const e = kind === 'edit' ? edits[x.k] : null;
  return {
    v, home: kind === 'edit' ? Boolean(x.lw) : home, rel: kind === 'edit' ? (x.r || '') : '',
    out: e?.out ? { ...e.out } : null, outOpen: e?.out?.side || '', remarry: Boolean(e?.out?.side === 'w' && e.out.type === 'div' && e.fields?.w),
    married: false, moved: false, addrOk: true, isHead: kind === 'edit' && Boolean(x.hd), ext: kind === 'edit' && Boolean(x.x), note: e?.note || '',
  };
}
const inp = (fs, k, lbl, attrs = '') => `<label class="ff-${k}"><span>${h(tr(lbl || k))}</span><input data-f="${k}" value="${h(fs.v[k] ?? '')}" ${attrs} autocomplete="off"></label>`;
const sel = (fs, k, lbl, opts) => `<label class="ff-${k}"><span>${h(tr(lbl || k))}</span><select data-f="${k}">${opts.map(([v, l]) => `<option value="${h(v)}"${String(fs.v[k] ?? '') === v ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>`;
function outPanel(fs, side) {
  const o = fs.out && fs.out.side === side ? fs.out : { yz: {} };
  const canDiv = side === 'w' ? fs.rel !== 'h' : fs.rel === 'h'; // מי שנכנס מבחוץ; בצד השני: "התגרשו" = בן/בת הזוג יוצא
  return `<div class="fp-out" data-side="${side}">
    <div class="fp-yz"><b>${h(tr('yz'))}</b>
      <select data-yz="d"><option value="">${h(tr('day'))}</option>${Array.from({ length: 30 }, (_, i) => `<option${String(o.yz?.d) === String(i + 1) ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>
      <select data-yz="m"><option value="">${h(tr('month'))}</option>${MONTHS.map((m) => `<option${o.yz?.m === m ? ' selected' : ''}>${h(m)}</option>`).join('')}</select>
      <input data-yz="y" placeholder="${h(tr('year'))}" value="${h(o.yz?.y || '')}"></div>
    ${canDiv ? `<label class="check"><input type="checkbox" data-div${o.type === 'div' ? ' checked' : ''}> ${h(tr(side === 'h' ? 'divH' : 'divW'))}</label>${side === 'h' ? `<p class="muted small">${h(tr('divNote'))}</p>` : ''}` : `<label class="check"><input type="checkbox" data-div data-divother> ${h(tr(side === 'h' ? 'divOtherW' : 'divOtherH'))}</label>`}
    <button type="button" data-outclose>${h(tr('outNone'))}</button></div>`;
}
function coupleHtml(fs) {
  const wOut = fs.out?.side === 'w'; const hOut = fs.out?.side === 'h';
  const wifeFields = !wOut || fs.remarry;
  return `<div class="ff-cols">
    <div class="ff-col"><h4>${h(tr('husband'))}</h4>
      ${sel(fs, 't', 't', [['', '—'], ...MEN.map((m) => [m, m])])}
      <div class="ff-pair">${inp(fs, 'f')}${inp(fs, 'l')}</div>
      <div class="ff-pair" dir="ltr">${inp(fs, 'fe', 'fe', 'dir="ltr"')}${inp(fs, 'le', 'le', 'dir="ltr"')}</div>
      <div class="ff-pair">${inp(fs, 'm', 'm', 'type="tel" dir="ltr"')}${inp(fs, 'e', 'e', 'type="email" dir="ltr"')}</div>
      ${fs.isHead || fs.ext ? '' : fs.outOpen === 'h' ? outPanel(fs, 'h') : `<button type="button" class="b-out" data-outopen="h">🕯 ${h(tr('outH'))}</button>`}
      ${wOut && !fs.remarry ? `<button type="button" class="b-add" data-remarry>${h(tr('remarry'))}</button>` : ''}
    </div>
    <div class="ff-col"><h4>${h(fs.remarry ? tr('remarried') : tr('wife'))}</h4>
      ${wifeFields ? `${sel(fs, 'wr', 'wt', [['0', 'מרת'], ['1', 'הרבנית']])}
      <div class="ff-pair">${inp(fs, 'w', 'f')}${inp(fs, 'wl', 'l')}</div>
      <div class="ff-pair" dir="ltr">${inp(fs, 'we', 'fe', 'dir="ltr"')}${inp(fs, 'wle', 'le', 'dir="ltr"')}</div>
      <div class="ff-pair">${inp(fs, 'wm', 'm', 'type="tel" dir="ltr"')}${inp(fs, 'e2', 'e', 'type="email" dir="ltr"')}</div>` : `<p class="muted">${h(fs.out.type === 'dead' ? '🕯' : '—')}</p>`}
      ${fs.ext || fs.remarry || hOut ? '' : fs.outOpen === 'w' ? outPanel(fs, 'w') : `<button type="button" class="b-out" data-outopen="w">🕯 ${h(tr('outW'))}</button>`}
    </div></div>`;
}
function addrHtml(fs) {
  return `<label class="ff-addr"><span>${h(tr('addr'))}</span><input data-addr dir="auto" value="${h(addrText({ ...fs.v, zip: '' }))}" autocomplete="off"><div class="ff-sugg" hidden></div></label>`;
}
function formHtml(x) {
  const fs = open.fs; const add = open.kind === 'add';
  const home = fs.home && !fs.married;
  const relOpts = home ? [['s', tr('s')], ['d', tr('d')]] : [['s', tr('s')], ['h', tr('h')]];
  const showRel = !fs.isHead && !fs.ext && (add || x.p);
  const title = add ? `${home ? tr('addH') : tr('addM')} — ${heName(cur(x)) || enName(cur(x))}` : `${tr('edit')} — ${heName(cur(x)) || enName(cur(x))}`;
  return `<form class="fp-form${add ? ' fp-addform' : ''}" data-form>
    <p class="fp-formtitle">${h(title)}</p>
    ${showRel ? `<div class="ff-relrow"><b>${h(tr('isA'))}</b> ${relOpts.map(([v, l]) => `<label class="check"><input type="radio" name="rel" value="${v}"${fs.rel === v ? ' checked' : ''}> ${h(l)}</label>`).join('')}</div>` : ''}
    ${home ? `<div class="ff-col one">
        ${fs.rel === 'd' ? '' : sel(fs, 't', 't', [['', '—'], ...MEN.map((m) => [m, m])])}
        <div class="ff-pair">${inp(fs, 'f')}${inp(fs, 'l')}</div>
        <div class="ff-pair" dir="ltr">${inp(fs, 'fe', 'fe', 'dir="ltr"')}${inp(fs, 'le', 'le', 'dir="ltr"')}</div>
        <div class="ff-pair">${inp(fs, 'm', 'm', 'type="tel" dir="ltr"')}${inp(fs, 'e', 'e', 'type="email" dir="ltr"')}</div>
        <div class="ff-btns"><button type="button" class="b-add" data-married>${h(tr('married'))}</button>${fs.moved ? '' : `<button type="button" class="b-add" data-moved>${h(tr('moved'))}</button>`}</div>
        ${fs.moved ? `${addrHtml(fs)}<div class="ff-pair">${inp(fs, 'zip', 'zip', 'dir="ltr"')}</div>` : ''}</div>`
    : `${coupleHtml(fs)}<div class="ff-full">${fs.ext ? '' : addrHtml(fs)}<div class="ff-pair">${inp(fs, 'hp', 'hp', 'type="tel" dir="ltr"')}${fs.ext ? '' : inp(fs, 'zip', 'zip', 'dir="ltr"')}</div></div>`}
    ${fs.ext ? '' : `<label class="ff-note"><span>${h(tr('note'))}</span><textarea data-note rows="2">${h(fs.note)}</textarea></label>`}
    ${formErr ? `<p class="ff-err">${h(formErr)}</p>` : ''}
    <div class="fp-formacts"><button type="submit" class="pri">${h(tr('ok'))}</button><button type="button" data-close>${h(tr('cancel'))}</button></div></form>`;
}
/** קורא את הטופס לתוך fs (לפני רענון / שמירה) */
function readForm() {
  const form = $('[data-form]'); if (!form || !open) return;
  const fs = open.fs;
  form.querySelectorAll('[data-f]').forEach((i) => { fs.v[i.dataset.f] = i.value.trim(); });
  const r = form.querySelector('[name=rel]:checked'); if (r) fs.rel = r.value;
  const n = form.querySelector('[data-note]'); if (n) fs.note = n.value.trim();
  const p = form.querySelector('.fp-out');
  if (p) {
    const yz = { d: p.querySelector('[data-yz=d]').value, m: p.querySelector('[data-yz=m]').value, y: p.querySelector('[data-yz=y]').value.trim() };
    const div = p.querySelector('[data-div]')?.checked;
    if (div && p.querySelector('[data-divother]')) { const o = p.dataset.side === 'h' ? 'w' : 'h'; fs.out = { side: o, type: 'div', yz: {} }; fs.outOpen = o; } // בצד של הבן: האשה יוצאת (ולהפך)
    else fs.out = { side: p.dataset.side, type: div ? 'div' : 'dead', yz: div ? {} : yz };
  }
}
function rerenderForm() { readForm(); render(); }

// ---------- ⬇ הורדה: Excel / PDF — רק מה ששמור (בלי טלפונים ואימייל) ----------
function famRows() {
  const keys = new Set(data.people.map((x) => String(x.k)));
  const kids = new Map(); const roots = [];
  data.people.forEach((x) => { const p = x.p && keys.has(String(x.p)) && String(x.p) !== String(x.k) ? String(x.p) : ''; if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(x); } else roots.push(x); });
  roots.sort((a, b) => (b.hd || 0) - (a.hd || 0)); kids.forEach((l) => l.sort((a, b) => (a.lw || 0) - (b.lw || 0)));
  const out = []; const seen = new Set();
  const nameOf = (x) => (lang === 'he' ? heName(x) : enName(x) || heName(x));
  const walk = (x, depth, par) => {
    if (seen.has(String(x.k))) return; seen.add(String(x.k));
    const he = [heName(x) + (x.d ? ' ז"ל' : ''), x.w ? wifeHe(x) + (x.wd ? ' ע"ה' : '') : ''].filter(Boolean).join(' · ');
    const en = [enName(x) + (x.d && enName(x) ? ' z"l' : ''), x.we ? wifeEn(x) + (x.wd ? ' a"h' : '') : ''].filter(Boolean).join(' & ');
    out.push({ depth, row: [relLabel(x, depth), par ? tr('of', { n: nameOf(par) }) : '', he, en, addrText(x)] });
    (kids.get(String(x.k)) || []).forEach((y) => walk(y, depth + 1, x));
  };
  roots.forEach((x) => walk(x, 0, null));
  return out;
}
function download(kind) {
  if (nPending()) { msg = tr('dlPending'); render(); return; }
  const rows = famRows(); const cols = T[lang].dlCols; const name = data.name || 'family';
  if (kind === 'xlsx') { downloadXlsx(name, cols, rows.map((r) => r.row), { sheet: 'Family', rtl: lang === 'he' }); return; }
  const w = window.open('', '_blank'); if (!w) { msg = tr('popup'); render(); return; }
  const dir = T[lang].dir;
  w.document.write(`<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"><title>${h(name)}</title><style>
    @page{size:letter;margin:12mm}body{font-family:Arial,'Segoe UI',sans-serif;font-size:11pt;color:#222}h1{font-size:17pt;margin:0 0 8px}
    table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:5px 6px;text-align:start;vertical-align:top}th{background:#eee;font-size:10pt}
    tr.d0 td{background:#f3e9d2;font-weight:bold}tr.d1 td:first-child{padding-inline-start:14px}tr.d2 td:first-child{padding-inline-start:26px}tr.d3 td:first-child{padding-inline-start:38px}
    tr.d1{border-top:2px solid #999}.en,.ad{direction:ltr;text-align:left}td.ad{font-size:10pt;color:#333}tr{page-break-inside:avoid}
  </style></head><body><h1>${h(name)}</h1><table><thead><tr>${cols.map((c, i) => `<th${i > 2 ? ' class="en"' : ''}>${h(c)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((r) => `<tr class="d${Math.min(r.depth, 3)}">${r.row.map((v, i) => `<td${i === 3 ? ' class="en"' : i === 4 ? ' class="ad" dir="auto"' : ''}>${h(v)}</td>`).join('')}</tr>`).join('')}
  </tbody></table></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
}

function render() {
  const el = root();
  document.documentElement.lang = lang;
  document.documentElement.dir = T[lang].dir;
  const langs = `<div class="fam-langs">${data ? '<button type="button" data-dl="xlsx">⬇ Excel</button><button type="button" data-dl="pdf">⬇ PDF</button>' : ''}${[['he', 'עברית'], ['en', 'English']].map(([k, l]) => `<button type="button" data-lang="${k}" class="${lang === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (!data) { el.innerHTML = `${langs}<p class="fam-msg">${h(msg || tr('loading'))}</p>`; return; }
  const { roots, kids } = tree();
  const seen = new Set();
  const edit = data.mode === 'edit';
  const n = nPending();
  const sy = window.scrollY;
  el.innerHTML = `${langs}
    <header class="fam-head"><h1>${h(data.name)}</h1><p class="muted">${h(tr('people', { n: data.people.length }))}</p>
      <p class="fam-intro">${h(tr(edit ? 'introEdit' : 'introView'))}</p></header>
    <div class="fam-legend">${[0, 1, 2, 3].map((i) => `<span class="lg lv${i}">${h(T[lang].lv[i])}${i && T[lang].lvh[i] ? ` / ${h(T[lang].lvh[i])}` : ''}</span>`).join('')}</div>
    <ul class="fam-tree">${roots.map((x) => personHtml(x, kids, seen, 0)).join('')}</ul>
    ${edit ? `<div class="fam-savebar">
      <div class="fam-who"><b>${h(tr('who'))}</b>
        <input id="who-name" placeholder="${h(tr('whoName'))}" value="${h(store.get('famWho'))}" autocomplete="name">
        <input id="who-phone" type="tel" dir="ltr" placeholder="${h(tr('whoPhone'))}" value="${h(store.get('famPhone'))}" autocomplete="tel">
        <input id="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"></div>
      <div class="fam-savewrap"><span class="fam-pending">${h(msg || (n ? tr('pending', { n }) : tr('none')))}</span>
        <button type="button" id="fam-save" class="fam-save"${n ? '' : ' disabled'}>${h(tr('save'))}</button></div></div>` : ''}`;
  window.scrollTo(0, sy);
}

// ---------- שמירה פון א טופס אין די "טוישן" ----------
const FIELDS = ['t', 'f', 'l', 'fe', 'le', 'm', 'e', 'w', 'we', 'wr', 'wm', 'e2', 'hp'];
function commitForm() {
  readForm();
  const fs = open.fs; const v = fs.v; formErr = '';
  if (open.kind === 'add' && !fs.rel) { const hm = fs.home && !fs.married; formErr = tr('errRel', { a: tr('s'), b: tr(hm ? 'd' : 'h') }); render(); return false; }
  if (!fs.addrOk) { formErr = tr('errAddr'); render(); return false; }
  if (fs.out && fs.out.type === 'dead' && !(fs.out.yz?.d && fs.out.yz?.m) && fs.outOpen) { formErr = tr('errOut'); render(); return false; }
  const notes = [];
  if (v.wl && v.l && v.wl !== v.l && (!fs.out || fs.remarry || fs.out.side !== 'w')) notes.push(`שם המשפחה של האשה: ${v.wl}${v.wle && v.wle !== v.le ? ` (${v.wle})` : ''}`);
  if (fs.note) notes.push(fs.note);
  const note = notes.join(' · ');
  if (fs.addr && v.zip !== undefined) fs.addr.zip = v.zip; // מיקוד שתוקן ביד
  const addrF = (o) => { if (fs.addr) Object.assign(o, fs.addr); else if (v.zip) o.zip = v.zip; return o; };
  const home = fs.home && !fs.married;
  if (open.kind === 'add') {
    if (!v.f && !v.l && !v.w) { formErr = tr('errName'); render(); return false; }
    const f = {}; FIELDS.forEach((k) => { if (v[k] !== undefined && v[k] !== '') f[k] = v[k]; });
    if (home) { delete f.w; delete f.we; delete f.wm; delete f.e2; delete f.wr; delete f.hp; } else if (f.wr !== '1') delete f.wr;
    addrF(f);
    tmpN += 1;
    adds.push({ temp: `n${tmpN}`, parent: open.key, home, rel: fs.rel || 's', fields: f, note });
  } else {
    const x = data.people.find((p) => String(p.k) === String(open.key));
    // א טאכטער אין דער היים האט חתונה געהאט → א נייער כרטיס פאר דעם חתן מיט איר אלס ווייב; איר כרטיס ווערט אויסגעמעקט
    if (fs.married && x.lw && fs.rel === 'd') {
      tmpN += 1;
      const f = {}; FIELDS.forEach((k) => { if (v[k]) f[k] = v[k]; }); addrF(f);
      adds.push({ temp: `n${tmpN}`, parent: x.p, home: false, rel: 'h', fields: f, note });
      dels.set(String(x.k), { purge: true });
      delete edits[x.k];
    } else {
      const f = {};
      FIELDS.forEach((k) => {
        if (v[k] === undefined) return;
        const old = k === 'wr' ? (x.wr ? '1' : '0') : String(x[k] || '');
        if (String(v[k]) !== old || (fs.remarry && ['w', 'we', 'wr', 'wm', 'e2'].includes(k))) f[k] = v[k];
      });
      if (fs.addr) Object.assign(f, fs.addr);
      else if (v.zip !== undefined && v.zip !== String(x.zip || '')) f.zip = v.zip;
      const e = { fields: f };
      if (fs.out && fs.outOpen) e.out = fs.out;
      if (fs.rel && fs.rel !== (x.r || '') && x.p) e.rel = fs.rel;
      if (note) e.note = note;
      if (fs.married) e.married = true;
      if (fs.moved) e.moved = true;
      if (Object.keys(f).length || e.out || e.rel || e.note || e.married || e.moved) edits[x.k] = e; else delete edits[x.k];
    }
  }
  open = null; render();
  return true;
}

async function save() {
  const who = $('#who-name').value.trim(); const ph = $('#who-phone').value.trim();
  if (!who || ph.replace(/\D/g, '').length < 7) { msg = tr('errWho'); render(); $('#who-name').focus(); msg = ''; return; }
  store.set('famWho', who); store.set('famPhone', ph);
  const changes = [
    ...Object.entries(edits).filter(([k]) => !dels.has(k)).map(([key, e]) => ({ kind: 'fix', key, ...e })),
    ...adds.map((a) => ({ kind: 'add', temp: a.temp, parent: a.parent, home: a.home, rel: a.rel, fields: a.fields, note: a.note })),
    ...[...dels].map(([key, d]) => ({ kind: 'del', key, purge: Boolean(d.purge) })),
  ];
  const b = $('#fam-save'); b.disabled = true; b.textContent = tr('saving');
  try {
    const r = await api({ action: 'fam_save', slug, who_name: who, who_phone: ph, hp: $('#hp').value, changes });
    if (r.error) throw new Error(r.error);
    data.people = r.people || data.people;
    edits = {}; dels = new Map(); adds = []; open = null;
    msg = tr('saved'); render(); setTimeout(() => { msg = ''; render(); }, 6000);
  } catch (err) {
    msg = tr(err.message === 'who' ? 'errWho' : err.message === 'busy' ? 'busy' : 'err'); render(); msg = '';
  }
}

// ---------- קליקס ----------
let suggT = null;
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) { if (!e.target.closest('.ff-sugg')) document.querySelectorAll('.ff-sugg').forEach((s) => { s.hidden = true; }); return; }
  const k = (a) => b.dataset[a];
  const x = (key) => data.people.find((p) => String(p.k) === String(key)) || adds.find((a) => a.temp === key);
  if (k('lang')) { readForm(); lang = k('lang'); store.set('famLang', lang); render(); return; }
  if (k('dl')) { download(k('dl')); return; }
  if (k('edit')) { formErr = ''; open = { kind: 'edit', key: k('edit'), fs: newFs('edit', x(k('edit'))) }; render(); focusForm(); return; }
  if (k('addm') || k('addh')) {
    const home = Boolean(k('addh')); const key = k('addm') || k('addh'); const p = x(key);
    formErr = ''; open = { kind: 'add', key, fs: newFs('add', p, home) };
    if (p) { open.fs.pl = cur(p).l || ''; open.fs.ple = cur(p).le || ''; } // שם המשפחה של האבא — נכנס רק כשמסמנים בן/בת
    render(); focusForm(); return;
  }
  if (b.hasAttribute('data-close')) { open = null; formErr = ''; render(); return; }
  if (k('del')) { dels.set(k('del'), {}); delete edits[k('del')]; adds = adds.filter((a) => a.parent !== k('del')); render(); return; }
  if (k('undel')) { dels.delete(k('undel')); render(); return; }
  if (k('unedit')) { delete edits[k('unedit')]; render(); return; }
  if (k('unadd')) { const gone = new Set([k('unadd')]); let more = true; while (more) { more = false; adds.forEach((a) => { if (gone.has(a.parent) && !gone.has(a.temp)) { gone.add(a.temp); more = true; } }); } adds = adds.filter((a) => !gone.has(a.temp)); render(); return; }
  if (b.id === 'fam-save') { save(); return; }
  if (open) {
    const fs = open.fs;
    if (k('outopen')) { readForm(); fs.outOpen = k('outopen'); fs.out = { side: k('outopen'), type: 'dead', yz: {} }; render(); return; }
    if (b.hasAttribute('data-outclose')) { readForm(); fs.outOpen = ''; fs.out = null; fs.remarry = false; render(); return; }
    if (b.hasAttribute('data-remarry')) { readForm(); fs.remarry = true; ['w', 'we', 'wm', 'e2', 'wl', 'wle'].forEach((q) => { fs.v[q] = ''; }); fs.v.wr = '0'; render(); return; }
    if (b.hasAttribute('data-married')) {
      readForm(); fs.married = true;
      if (fs.rel === 'd') { // די טאכטער ווערט די ווייב; דער חתן איז נייער
        fs.v.w = fs.v.f; fs.v.we = fs.v.fe; fs.v.wl = fs.v.l; fs.v.wle = fs.v.le; fs.v.wm = fs.v.m; fs.v.e2 = fs.v.e;
        ['f', 'l', 'fe', 'le', 'm', 'e'].forEach((q) => { fs.v[q] = ''; }); fs.v.t = 'מו"ה'; fs.rel = 'd';
      }
      fs.addrOk = false; fs.v.a = ''; fs.v.city = ''; fs.v.st = ''; fs.v.zip = ''; fs.v.co = '';
      render(); return;
    }
    if (b.hasAttribute('data-moved')) { readForm(); fs.moved = true; fs.addrOk = false; fs.v.a = ''; fs.v.city = ''; fs.v.st = ''; fs.v.zip = ''; render(); return; }
    if (k('pick') !== undefined) {
      const box = b.closest('.ff-sugg'); const p = box._list?.[Number(k('pick'))]; box.hidden = true;
      if (!p) return;
      const d = await details(p.prediction);
      readForm();
      const a = d ? { a: d.address, city: d.city, st: d.state, zip: d.zip, co: d.country } : { a: p.text, city: '', st: '', zip: '', co: '' };
      fs.addr = a; Object.assign(fs.v, a); fs.addrOk = true; formErr = '';
      render(); return;
    }
  }
});
function focusForm() { const f = $('[data-form] input[data-f="f"], [data-form] input'); if (f) { f.focus(); f.closest('form').scrollIntoView({ block: 'nearest' }); } }
document.addEventListener('submit', (e) => { if (!e.target.closest('[data-form]')) return; e.preventDefault(); commitForm(); });
document.addEventListener('change', (e) => {
  const i = e.target; if (!open || !i.closest('[data-form]')) return;
  const fs = open.fs;
  if (i.name === 'rel') {
    readForm();
    if (open.kind === 'add') {
      const v = fs.v;
      if (fs.rel === 's' || fs.rel === 'd') { if (!v.l) v.l = fs.pl || ''; if (!v.le) v.le = fs.ple || ''; }
      else if (fs.rel === 'h') { if (v.l && v.l === fs.pl) v.l = ''; if (v.le && v.le === fs.ple) v.le = ''; }
    }
    render(); return;
  }
  if (i.matches('[data-div]')) { rerenderForm(); return; }
  // אויטאמאטישע תרגום: נאר ווען דער ענגלישער פעלד איז ליידיג
  const form = i.closest('[data-form]');
  // מתעדכן אחרי השם בעברית — חוץ ממה שכתבו ביד בטופס הזה
  const fill = (to, val) => { const t = form.querySelector(`[data-f="${to}"]`); if (t && val && !fs.typed?.[to] && t.value.trim() !== val) { t.value = val; fs.v[to] = val; if (to === 'le') fill('wle', val); if (to === 'wl') fill('wle', enLast(val)); } };
  if (i.dataset.f === 'f') fill('fe', enFirst(i.value));
  if (i.dataset.f === 'w') fill('we', enFirst(i.value));
  if (i.dataset.f === 'l') { fill('le', enLast(i.value)); fill('wl', i.value.trim()); }
  if (i.dataset.f === 'wl') fill('wle', enLast(i.value));
  if (i.dataset.f === 'le') fill('wle', i.value.trim());
});
document.addEventListener('input', (e) => {
  const i = e.target;
  if (i.id === 'who-name') store.set('famWho', i.value);
  if (i.id === 'who-phone') store.set('famPhone', i.value);
  if (open && ['fe', 'le', 'we', 'wle', 'wl'].includes(i.dataset?.f)) { open.fs.typed = open.fs.typed || {}; open.fs.typed[i.dataset.f] = true; }
  if (!i.hasAttribute('data-addr') || !open) return;
  open.fs.addrOk = !i.value.trim() && !open.fs.married && !open.fs.moved; // ליידיג = בלי כתובת (נאר ביי א טויש)
  if (!placesEnabled()) { open.fs.addrOk = true; open.fs.addr = { a: i.value.trim() }; return; }
  const box = i.parentElement.querySelector('.ff-sugg');
  clearTimeout(suggT);
  suggT = setTimeout(async () => {
    const list = await suggest(i.value, [], /[\u0590-\u05FF]/.test(i.value) ? 'he' : '');
    if (list === 'cap') { open.fs.addrOk = true; open.fs.addr = { a: i.value.trim() }; box._list = []; box.innerHTML = `<p class="ff-cap">${h(tr('capMsg'))}</p>`; box.hidden = false; return; }
    if (!Array.isArray(list) || !list.length) { box.hidden = true; return; }
    box._list = list;
    box.innerHTML = list.map((p, n) => `<button type="button" data-pick="${n}">${h(p.text)}</button>`).join('');
    box.hidden = false;
  }, 300);
});
window.addEventListener('beforeunload', (e) => { if (data?.mode === 'edit' && (nPending() || open)) { e.preventDefault(); e.returnValue = tr('leave'); } });

(async function start() {
  render();
  if (!slug) { msg = tr('notFound'); render(); return; }
  try {
    const r = await api({ action: 'fam_get', slug });
    if (r.error || !r.people) { msg = tr('notFound'); render(); return; }
    data = r; document.title = r.name; render();
  } catch { msg = tr('err'); render(); }
}());
