// חוברת מצוה יומית — כל חודש: שער, קריאת גדולי הדור + תפילה, הטבלה החודשית, פרטים + הנצחות,
// עמודי הספר "מצות המלך" (מהמצוה הראשונה של החודש עד האחרונה, עמודים שלמים), עמודים לבנים עד כפולה של 4,
// וכריכה אחורית עם ההנצחות. גודל: חצי Letter (5.5×8.5), כריכה מימין.
// עמודי הספר: books/mitzvos-hamelech (שטיקלעך פון 20 עמודים) — פאר יעדן, אן דרייב.
import { buildYear, isoOf, nOf, mitzvaYomis } from './engine.js';
import { START, LAST_PAGE, CONTENT, NUM_BAND } from './booklet-index.js';
import { MONTH, CSS as MZ_CSS, monthHtml } from './mitzva.js';
import { hebrewNumber, todayIso, formatHebrew, toHebrew } from '../hebdate.js';
import { readTabs, appendRow, updateRange } from '../google.js';
import { state, saveDonation } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { drawDomPage, drawPlainText, fontSet } from '../pdfvec.js';
import { showPdfIn } from '../pdfview.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let ui = {};
let back = () => {};

// ---------- דאטן ----------
let loaded = false;
let settings = {}; // key → { value, row }
let deds = []; // [{ row, id, month, sort, kind, name, text, contact_id, amount }]

export async function loadData(force = false) {
  if (loaded && !force) return;
  const t = await readTabs(['Booklet', 'BookletDedications']);
  const [sh = [], ...sr] = t.Booklet || [];
  settings = {};
  sr.forEach((r, i) => { const k = String(r[sh.indexOf('key')] || ''); if (k) settings[k] = { value: String(r[sh.indexOf('value')] ?? ''), row: i + 2 }; });
  const [dh = [], ...dr] = t.BookletDedications || [];
  const ix = (k) => dh.indexOf(k);
  deds = dr.map((r, i) => ({
    row: i + 2, id: String(r[ix('id')] || ''), month: String(r[ix('month')] || ''), sort: Number(r[ix('sort')]) || 0,
    kind: String(r[ix('kind')] || ''), name: String(r[ix('name')] || ''), text: String(r[ix('text')] || ''),
    contact_id: String(r[ix('contact_id')] || ''), amount: String(r[ix('amount')] ?? ''), donation_id: ix('donation_id') >= 0 ? String(r[ix('donation_id')] || '') : '',
  })).filter((d) => d.id && d.month && (d.name || d.text));
  loaded = true;
}
export const setting = (k) => settings[k]?.value || '';
export async function saveSetting(k, v) {
  const row = [k, v, nowStamp(), state.email];
  if (settings[k]) await updateRange(`Booklet!A${settings[k].row}:D${settings[k].row}`, [row]);
  else await appendRow('Booklet', row);
  await loadData(true);
}

// ---------- חודש ----------
let cur = null; // { Y, ix }
function currentMonth() {
  const n = nOf(todayIso());
  for (let Y = 5780; Y < 5900; Y += 1) {
    const b = buildYear(Y); const ix = b.pages.findIndex((p) => p.monthDays.some((d) => d.n === n));
    if (ix >= 0) return { Y, ix };
  }
  return { Y: 5787, ix: 0 };
}
const pageOf = (m) => buildYear(m.Y).pages[m.ix];
const monthKey = (m) => `${m.Y}|${pageOf(m).key}`;
const monthName = (p) => MONTH[p.key] || p.he;
export const monthLabel = (key) => { const [Y, k] = String(key).split('|'); return `${MONTH[k] || k} ${hebrewNumber(Number(Y) % 1000)}`; };
const yearHe = (Y) => hebrewNumber(Y % 1000);
const numHe = (n) => hebrewNumber(n);
const plainNum = (n) => hebrewNumber(n).replace(/["']/g, '');

function monthMitzvos(p) {
  const a = mitzvaYomis(isoOf(p.monthDays[0].n)).n;
  const b = mitzvaYomis(isoOf(p.monthDays[p.monthDays.length - 1].n)).n;
  return { a, b };
}

// ---------- וועלכע עמודים פונעם ספר ----------
function endPageOf(n) {
  const s = START[n - 1];
  if (n === 323 || n === 613) return LAST_PAGE[s.vol];
  const nx = START[n];
  return nx.y <= 166 ? nx.page - 1 : nx.page; // די קומענדיגע מצוה הייבט אן אויבן אויפן בלאט → דער בלאט געהערט נישט צו אונז
}
/** [{ vol, from, to }] — עמודים שלמים (אפשרות א'), מיט איבערגאנג פון חלק א' צו ב' און פון תריג צו א' */
export function bookRanges(a, b) {
  const seq = []; let n = a;
  for (;;) { seq.push(n); if (n === b) break; n = n === 613 ? 1 : n + 1; if (seq.length > 700) break; }
  const runs = [];
  seq.forEach((x) => {
    const last = runs[runs.length - 1];
    if (last && START[x - 1].vol === last.vol && x === last.b + 1) last.b = x; else runs.push({ vol: START[x - 1].vol, a: x, b: x });
  });
  return runs.map((r) => ({ vol: r.vol, from: START[r.a - 1].page, to: endPageOf(r.b), a: r.a, b: r.b }));
}
const countPages = (ranges) => ranges.reduce((s, r) => s + r.to - r.from + 1, 0);

// ---------- טעקסט מיט סימנים: "# " גרויס, "## " מיטל, "~ " קליין, "---" א שטריך ----------
export function richLines(text) {
  return String(text || '').split('\n').map((ln) => {
    let s = ln.trimEnd();
    if (/^-{3,}$/.test(s.trim())) return '<div class="bk-hr"></div>';
    // [+1.5] / [-1.5] בתחילת השורה = גדול / קטן יותר בנקודות
    let adj = 0; const ma = /^\[([+-]\d+(?:\.\d+)?)\]\s*/.exec(s);
    if (ma) { adj = Number(ma[1]); s = s.slice(ma[0].length); }
    let cls = 'bk-l'; let body = s;
    if (s.startsWith('## ')) { cls = 'bk-l bk-l2'; body = s.slice(3); } else if (s.startsWith('# ')) { cls = 'bk-l bk-l1'; body = s.slice(2); } else if (s.startsWith('~~ ')) { cls = 'bk-l bk-l4'; body = s.slice(3); } else if (s.startsWith('~ ')) { cls = 'bk-l bk-l3'; body = s.slice(2); } else if (s.startsWith('* ')) { cls = 'bk-l bk-lb'; body = s.slice(2); }
    if (!body.trim()) return '<div class="bk-sp"></div>';
    const latin = !/[֐-׿]/.test(body);
    // די גרייס אויפן שורה גופא (נישט אויף אן אינעווייניגן span) — אזוי ווערט אויך דער אינטערוואל צווישן שורות קלענער
    const st = adj ? ` style="font-size:${(1 + adj * 0.1).toFixed(2)}em;line-height:1.12"` : '';
    return `<div class="${cls}${latin ? ' bk-lat' : ''}"${latin ? ' dir="ltr"' : ''}${st}>${h(body)}</div>`;
  }).join('');
}

// ---------- הנצחות ----------
const KINDS = [
  ['nedavas', 'נדבת', 'נדבת'],
  ['iluy', 'לע"נ', 'לעילוי נשמת'],
  ['refua', 'לרפו"ש', 'לרפואה שלמה'],
  ['hatzlocha', 'להצלחת', 'להצלחת'],
  ['zchus', 'לזכות', 'לזכות'],
  ['free', 'חופשי', ''],
];
const kindOf = (k) => KINDS.find((x) => x[0] === k) || KINDS[KINDS.length - 1];
const monthDeds = (key) => deds.filter((d) => d.month === key).sort((x, y) => x.sort - y.sort || x.row - y.row);

function dedHtml(list) {
  if (!list.length) return '';
  return list.map((d) => {
    if (d.kind === 'html') return `<div class="bk-ded bk-rich">${cleanRich(d.text)}</div>`;
    const [, , head] = kindOf(d.kind);
    return `<div class="bk-ded">
      ${head ? `<div class="bk-dk">${h(head)}</div>` : ''}
      ${d.name ? `<div class="bk-dn">${h(d.name)}</div>` : ''}
      ${d.text ? `<div class="bk-dt">${h(d.text).replace(/\n/g, '<br>')}</div>` : ''}
      ${d.kind === 'iluy' ? '<div class="bk-dz">ת.נ.צ.ב.ה.</div>' : ''}
    </div>`;
  }).join('<div class="bk-dsep">❖</div>');
}
// א מסגרת מיט ציר-ווינקלען: די ווינקלען און די מיטלסטע ציר בלייבן די זעלבע גרייס, נאר די שטריכן ווערן לענגער/קירצער
const FR = (f) => `img/frame/${f}.png?v=1`;
const frame = (inner, { fk = 0.16, maxh = 300, k = 1 } = {}) => `<div class="bk-of" style="--fk:${fk}">
  ${['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'et', 'eb', 'el', 'er'].map((p) => `<img class="f-${p}" src="${FR(p)}" alt="">`).join('')}
  <div class="bk-fin"><div class="bk-fit" data-k="${k}" data-maxh="${maxh}">${inner}</div></div></div>`;

// ---------- די בלעטער (HTML, 528×816 = 5.5×8.5in) ----------
const IMG = (f) => `img/booklet/${f}?v=2`;
const BK_CSS = `
.bk-pg{position:relative;width:528px;height:816px;overflow:hidden;direction:rtl;background:#fff;color:#111;font-family:'Guttman David','David','Frank Ruhl Libre',serif}
.bk-pg>img.bk-bg{position:absolute;inset:0;width:100%;height:100%}
.bk-abs{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.bk-box1{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:20.5px;line-height:.95}
.bk-box2{font-family:'Livorna Bold','Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:37px;line-height:.95;margin:0}
.bk-box3{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:21.5px;line-height:.95}
.bk-l{font-family:'Livorna','Frank Ruhl Libre',serif;font-size:1em;line-height:1.25}
.bk-l1{font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:1.75em;line-height:1.15}
.bk-l2{font-weight:700;font-size:1.25em;line-height:1.2}
.bk-l3{font-size:.75em}
.bk-l4{font-size:.9em;line-height:1.05;margin-top:-.15em}
.bk-lb{font-family:'Livorna Bold','Livorna',serif;font-weight:700}
.bk-lat{font-family:'Livorna','Frank Ruhl Libre',serif}
.bk-lat.bk-l2{font-size:1.2em;font-weight:400}
.bk-lat.bk-l3{font-size:.68em}
.bk-hr{width:62%;height:0;border-top:1.5px solid #444;margin:14px auto}
.bk-sp{height:.55em}
.bk-of{font-family:'Livorna','Frank Ruhl Libre',serif;position:relative;width:100%;box-sizing:border-box;padding:calc(77px * var(--fk) + 12px) calc(77px * var(--fk) + 16px)}
.bk-of>img{position:absolute;display:block}
.bk-of>.f-tl,.bk-of>.f-tr,.bk-of>.f-bl,.bk-of>.f-br{width:calc(170px * var(--fk));height:calc(270px * var(--fk));z-index:1}
.bk-of>.f-tl{top:0;left:0}.bk-of>.f-tr{top:0;right:0}.bk-of>.f-bl{bottom:0;left:0}.bk-of>.f-br{bottom:0;right:0}
.bk-of>.f-et,.bk-of>.f-eb{left:calc(169px * var(--fk));right:calc(169px * var(--fk));height:calc(77px * var(--fk));width:calc(100% - 338px * var(--fk))}
.bk-of>.f-et{top:0}.bk-of>.f-eb{bottom:0}
.bk-of>.f-el,.bk-of>.f-er{top:calc(269px * var(--fk));height:calc(100% - 538px * var(--fk));width:calc(77px * var(--fk))}
.bk-of>.f-el{left:0}.bk-of>.f-er{right:0}
.bk-of>.f-tc,.bk-of>.f-bc{left:50%;transform:translateX(-50%);width:calc(256px * var(--fk));height:calc(77px * var(--fk));z-index:1}
.bk-of>.f-tc{top:0}.bk-of>.f-bc{bottom:0}
.bk-of>.bk-fin{display:flex;align-items:center;justify-content:center;min-height:calc(540px * var(--fk) - 154px * var(--fk))}
.bk-shiur{margin-top:auto;background:linear-gradient(90deg,#1e1e1e,#5c5c5c,#1e1e1e);color:#fff;text-align:center;padding:6px 8px 7px;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bk-shiur .bk-l{line-height:1.25;font-size:1em}.bk-shiur .bk-l2{font-family:'Livorna Bold','Livorna',serif;font-size:1.45em;line-height:1.2}.bk-shiur .bk-l3{font-size:.85em}
.bk-info{border:1px solid #6a6a6a;background:rgba(255,255,255,.6);padding:6px 10px;box-sizing:border-box}
.bk-mhl{display:block;width:6.2em;height:auto;margin:0 auto .35em}
.bk-info .bk-lat{font-size:1em;line-height:1.3}
.bk-rich{font-family:'Livorna','Frank Ruhl Libre',serif;font-size:1.35em;line-height:1.3}
.bk-rich b{font-family:'Livorna Bold','Livorna',serif;font-weight:700}
.bk-rt{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}
.bk-ed{min-height:120px;max-height:300px;overflow:auto;border:1px solid #bbb;border-radius:6px;padding:10px;background:#fff;text-align:center;font-family:'Livorna','Frank Ruhl Libre',serif;font-size:20px;line-height:1.35}
.bk-ed b{font-family:'Livorna Bold','Livorna',serif}
.bk-view{display:grid;grid-template-columns:330px minmax(0,1fr);gap:16px;max-width:1400px;margin:0 auto;align-items:start}
.bk-side{display:flex;flex-direction:column;gap:12px;position:sticky;top:8px}
.bk-side section{border:1px solid #ddd;border-radius:10px;padding:10px 12px;background:#fff}
.bk-side h4{margin:0 0 6px}
.bk-side .small{font-size:12.5px;margin:3px 0}
.bk-acts{display:flex;gap:8px;flex-wrap:wrap}
.bk-pdf{min-height:84vh;border:1px solid #ccc;border-radius:10px;background:#525659;overflow:hidden;display:flex}
.bk-frame-pdf{width:100%;height:84vh;border:0;background:#525659}
.bk-wait{margin:auto;color:#fff;text-align:center;width:60%}
.bk-wait .bk-prog{background:#777}
@media (max-width:900px){.bk-view{grid-template-columns:1fr}.bk-side{position:static}}
.bk-fit-area{position:absolute;display:flex;align-items:center;justify-content:center}
.bk-fit{text-align:center;transform-origin:center center;font-size:calc(16px * var(--k,1))}
.bk-ded{margin:2px 0}
.bk-dk{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:1.25em;line-height:1.2}
.bk-dn{font-family:'Livorna Bold','Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:2.1em;line-height:1.15}
.bk-dt{font-size:1.1em;line-height:1.3;margin-top:2px}
.bk-dz{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:1.05em;margin-top:3px;letter-spacing:1px}
.bk-dsep{font-size:.9em;color:#555;margin:6px 0}
.bk-empty{color:#999;font-size:1.1em}
.bk-nod{display:flex;gap:6px;align-items:center;font-size:13px;margin-top:6px}
.bk-thumbs{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;padding:10px 0}
.bk-th{display:flex;flex-direction:column;align-items:center;gap:6px}
.bk-th>.bk-sc{width:264px;height:408px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.25);background:#fff}
.bk-th>.bk-sc>.bk-pg{transform:scale(.5);transform-origin:top right}
.bk-th>b{font-size:13px}
.bk-panel{max-width:1100px;margin:0 auto 14px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.bk-panel section{border:1px solid #ddd;border-radius:10px;padding:12px 14px;background:#fff}
.bk-panel h4{margin:0 0 8px}
.bk-dl{list-style:none;margin:0;padding:0}
.bk-dl li{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee}
.bk-dl li span{flex:1}
.bk-sum p{margin:4px 0}
.bk-prog{height:8px;background:#eee;border-radius:4px;overflow:hidden;margin:8px 0}
.bk-prog>i{display:block;height:100%;width:0;background:#2f6b3a;transition:width .2s}
.bk-form label{display:block;margin:8px 0 3px;font-weight:600}
.bk-form input,.bk-form select,.bk-form textarea{width:100%;box-sizing:border-box}
@media (max-width:800px){.bk-panel{grid-template-columns:1fr}}
`;

function coverHtml(p) {
  const { a, b } = monthMitzvos(p);
  return `<div class="bk-pg"><img class="bk-bg" src="${IMG('cover.jpg')}" alt="">
    <div class="bk-abs" style="top:446px;height:100px;right:106px;width:320px">
      <div class="bk-box1">סדר הלימוד לחודש</div>
      <div class="bk-box2">${h(monthName(p))} ${h(yearHe(p.Y || 0))}</div>
      <div class="bk-box3">מצוה ${h(numHe(a))} – מצוה ${h(numHe(b))}</div>
    </div>
    <div class="bk-abs" style="top:552px;height:116px;right:100px;width:328px"><div class="bk-fit">${richLines(setting('cover_text'))}</div></div>
  </div>`;
}
const p2Html = () => `<div class="bk-pg"><img class="bk-bg" src="${IMG('p2.jpg')}" alt=""></div>`;
// א פס אונטן פון דער טבלה (נאר אין קונטרס) — דער שיעור, ווי די שווארצע פרשה-פסן
const DEF_SHIUR = '## לשמוע שיעור יומי בסדר המצות (אידיש)\nקול אונגוואר: 605-477-4427 אחריו 3 ואחריו 1';
const shiurBar = () => `<div class="bk-shiur">${richLines(setting('shiur_text') || DEF_SHIUR)}</div>`;
const p3Html = (p) => `<div class="bk-pg"><img class="bk-bg" src="${IMG('bgL.jpg')}" alt=""><div style="position:absolute;inset:0">${monthHtml(p, shiurBar())}</div></div>`;
// "אין הנצחה" פאר א חודש (ברירת מחדל: יא — א מסגרת, אויך ליידיג)
const noDed = (key) => setting(`noded|${key}`) === '1';
const EMPTY_DED = '<div style="height:6em"></div>';
function p4Html(key) {
  // למעלה: ההנצחות במסגרת; למטה: א קליינע משבצת מיט די פרטים פונעם מכון
  const list = monthDeds(key); const none = noDed(key);
  return `<div class="bk-pg"><img class="bk-bg" src="${IMG('bgR.jpg')}" alt="">
    ${none ? '' : `<div class="bk-fit-area" style="top:36px;right:44px;width:440px;height:560px">${frame(list.length ? dedHtml(list) : EMPTY_DED, { fk: 0.2, maxh: 470, k: 1.35 })}</div>`}
    <div class="bk-abs bk-info" style="top:${none ? 316 : 598}px;right:124px;width:280px;height:184px"><div class="bk-fit" data-k="0.82"><img class="bk-mhl" src="img/mishne-halachos-logo.png?v=1" alt="">${richLines(setting('info_text'))}</div></div>
  </div>`;
}
function backHtml(key) {
  const list = monthDeds(key);
  return `<div class="bk-pg"><img class="bk-bg" src="${IMG('bgR.jpg')}" alt="">
    ${noDed(key) ? '' : `<div class="bk-fit-area" style="top:50px;right:50px;width:428px;height:716px">${frame(list.length ? dedHtml(list) : EMPTY_DED, { fk: 0.24, maxh: 590, k: 1.6 })}</div>`}
  </div>`;
}

/** מאכט קלענער (--k) ביז דער טעקסט פאסט אריין אין זיין קעסטל */
export function fitAll(root) {
  // שמות ארוכים בטבלה החודשית — קטנים קצת במקום להיחתך
  $$('.mz-mm > span', root).forEach((sp) => {
    sp.style.fontSize = '';
    let px = parseFloat(getComputedStyle(sp).fontSize) || 14;
    for (let i = 0; i < 16 && sp.scrollWidth > sp.clientWidth + 0.5 && px > 8.5; i += 1) { px -= 0.5; sp.style.fontSize = `${px}px`; }
  });
  $$('.bk-fit', root).forEach((el) => {
    const box = el.parentElement; let k = Number(el.dataset.k) || (el.closest('.bk-big') ? 1.6 : 1);
    el.style.fontSize = ''; // פון א פריערדיגער מעסטונג
    el.style.setProperty('--k', k);
    const maxH = Number(el.dataset.maxh) || box.clientHeight - 4;
    const fits = () => el.scrollHeight <= maxH && el.scrollWidth <= box.clientWidth + 1;
    for (let i = 0; i < 40 && !fits() && k > 0.35; i += 1) { k *= 0.95; el.style.setProperty('--k', k.toFixed(3)); }
    el.style.fontSize = `${(16 * k).toFixed(2)}px`; // אינליין — פארן בילד
  });
}

// ---------- דער ספר: שטיקלעך פון 20 עמודים אויפן אתר (books/mitzvos-hamelech), פאר יעדן — אן דרייב ----------
const CHUNK = 20;
const chunkCache = new Map(); // "v-c" → Promise<PDFDocument>
let PL = null;
const pdfLib = async () => { PL = PL || await import('../vendor/pdf-lib.esm.min.js'); return PL; };
function chunkDoc(vol, c) {
  const k = `${vol}-${c}`;
  if (!chunkCache.has(k)) {
    chunkCache.set(k, (async () => {
      const { PDFDocument } = await pdfLib();
      const res = await fetch(`books/mitzvos-hamelech/v${vol}_${String(c).padStart(2, '0')}.pdf?v=1`);
      if (!res.ok) throw new Error(`ספר: חלק ${vol} (${res.status})`);
      return PDFDocument.load(new Uint8Array(await res.arrayBuffer()), { ignoreEncryption: true, updateMetadata: false });
    })().catch((err) => { chunkCache.delete(k); throw err; }));
  }
  return chunkCache.get(k);
}

// א מספר עמוד ווי אינעם ספר (PNG פון א canvas, 4× שארף)
async function numPng(out, text, pt) {
  const fam = '"Guttman David Bold", "Frank Ruhl Libre", serif';
  try { await document.fonts.load(`700 ${pt * 4}px ${fam}`, text); } catch { /* */ }
  const px = pt * 4;
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  ctx.font = `700 ${px}px ${fam}`;
  const w = Math.ceil(ctx.measureText(text).width) + 8;
  c.width = w; c.height = Math.ceil(px * 1.5);
  ctx.font = `700 ${px}px ${fam}`; ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl'; ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, c.height / 2);
  const img = await out.embedPng(c.toDataURL('image/png'));
  return { img, w: w / 4, h: c.height / 4 };
}

const PW = 396; const PH = 612; // pt
const A4H = 841.89;

/** בויט די חוברת. גיט צוריק { bytes, pages, blanks } */
async function buildBooklet(m, progress = () => {}) {
  const PL = await pdfLib(); const { PDFDocument, rgb } = PL;
  const p = pageOf(m); p.Y = p.Y || m.Y; const key = monthKey(m);
  const { a, b } = monthMitzvos(p);
  const ranges = bookRanges(a, b);
  const out = await PDFDocument.create();
  out.setTitle(`מצוה יומית – ${monthName(p)} ${yearHe(m.Y)}`);
  const fs = fontSet(PL, out);

  // 1) די בלעטער פון HTML → בילד (300 dpi)
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0';
  document.body.append(host);
  const render = async (html) => {
    host.innerHTML = `<style>${BK_CSS}${MZ_CSS}</style>${html}`;
    await Promise.all($$('img', host).map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));
    try { await document.fonts.ready; } catch { /* */ }
    fitAll(host);
    // לעבעדיגער טעקסט (וועקטאר): יעדער אות אויף זיין ארט, מיט די שריפטן פונעם גיליון
    await drawDomPage(PL, out, fs, host.querySelector('.bk-pg'), { widthPt: PW, heightPt: PH });
  };
  progress('שער…', 0.02);
  const front = [coverHtml(p), p2Html(), p3Html(p), p4Html(key)];
  for (let i = 0; i < front.length; i += 1) { progress(`עמוד ${i + 1}…`, 0.02 + i * 0.03); await render(front[i]); }

  // 2) עמודי הספר
  const s = Math.min((PW - 76) / (CONTENT.x1 - CONTENT.x0), (PH - 76) / (CONTENT.y1 - CONTENT.y0)); // ~0.53 אינטש שוליים
  const cw = (CONTENT.x1 - CONTENT.x0) * s; const ch = (CONTENT.y1 - CONTENT.y0) * s;
  const box = { left: CONTENT.x0, right: CONTENT.x1, bottom: A4H - CONTENT.y1, top: A4H - CONTENT.y0 };
  let bookNo = 0; const total = countPages(ranges);
  for (const r of ranges) {
    progress('טוען את עמודי הספר…', 0.2);
    const emb = [];
    for (let pg = r.from; pg <= r.to;) {
      const c = Math.floor((pg - 1) / CHUNK); const last = Math.min(r.to, (c + 1) * CHUNK);
      const src = await chunkDoc(r.vol, c);
      const pages = []; for (let q = pg; q <= last; q += 1) pages.push(src.getPage((q - 1) % CHUNK));
      emb.push(...await out.embedPages(pages, pages.map(() => box)));
      pg = last + 1;
    }
    for (const e of emb) {
      bookNo += 1;
      progress(`עמודי הספר ${bookNo}/${total}`, 0.45 + 0.45 * (bookNo / total));
      const pg = out.addPage([PW, PH]);
      const no = out.getPageCount(); // מספר עמוד אין דער חוברת
      const rightPage = no % 2 === 0; // כריכה מימין: זוגי = עמוד ימני
      const shift = rightPage ? 4 : -4; // אוועק פונעם אמצע (שדרה)
      const x0 = (PW - cw) / 2 + shift; const y0 = (PH - ch) / 2;
      pg.drawPage(e, { x: x0, y: y0, width: cw, height: ch });
      const X = (xo) => x0 + (xo - CONTENT.x0) * s;
      const Y = (yTop) => y0 + (CONTENT.y1 - yTop) * s;
      // דער אלטער מספר — ווייס צודעקן (ביידע עקן)
      [NUM_BAND.left, NUM_BAND.right].forEach(([xa, xb]) => {
        pg.drawRectangle({ x: X(xa), y: Y(NUM_BAND.y1), width: (xb - xa) * s, height: (NUM_BAND.y1 - NUM_BAND.y0) * s, color: rgb(1, 1, 1) });
      });
      // דער נייער מספר — לעבעדיגער טעקסט, ווי אינעם ספר
      drawPlainText(PL, pg, fs, plainNum(bookNo), { font: 'Guttman David Bold', sizePt: 12.5 * s, x: rightPage ? X(477.4) : X(117.3), y: Y(139.5), align: rightPage ? 'right' : 'left' });
    }
  }
  // 3) ווייסע בלעטער ביז א כפולה פון 4 (מיט דער כריכה אחורית)
  let blanks = 0;
  while ((out.getPageCount() + 1) % 4 !== 0) { out.addPage([PW, PH]).drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(1, 1, 1) }); blanks += 1; }
  await render(backHtml(key));
  host.remove();
  fs.finalize();
  progress('שמירה…', 0.95);
  const bytes = await out.save();
  return { bytes, pages: out.getPageCount(), blanks, ranges };
}

/** הדפסה בבית: צוויי עמודים אויף א Letter בלאט (לרוחב), אין דער סדר פון א מהודקת חוברת מיט כריכה מימין */
async function impose(bytes) {
  const { PDFDocument } = await pdfLib();
  const src = await PDFDocument.load(bytes);
  const N = src.getPageCount();
  const out = await PDFDocument.create();
  const emb = await out.embedPages(src.getPages());
  for (let s = 0; s < N / 4; s += 1) {
    const sides = [[2 * s + 1, N - 2 * s], [N - 2 * s - 1, 2 * s + 2]]; // [שמאל, ימין]
    sides.forEach(([L, R]) => {
      const pg = out.addPage([792, 612]);
      pg.drawPage(emb[L - 1], { x: 0, y: 0, width: 396, height: 612 });
      pg.drawPage(emb[R - 1], { x: 396, y: 0, width: 396, height: 612 });
    });
  }
  return out.save();
}

function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- דער מסך ----------
export function initBooklet(helpers) { ui = helpers; }

let onView = null;
/** opts: { month: { Y, ix }, onView(v, month) } — אינעם "לוח מצוה יומית" (שבועי / חודשי / חוברת) */
export async function openBooklet(main, onBack, opts = {}) {
  back = onBack || back;
  onView = opts.onView || null;
  if (opts.month) cur = { ...opts.month };
  if (!cur) cur = currentMonth();
  main.innerHTML = '<p class="muted">…</p>';
  try { await loadData(); } catch (err) { main.innerHTML = `<p class="lx-warn">${h(String(err.message || err))}</p>`; return; }
  render(main);
}

// ---------- דער קונטרס אויפן אתר: גאנץ אויסגעשטעלט, לינקס; די ענדערונגען רעכטס ----------
let viewer = null;
const built = new Map(); // monthKey → { sig, bytes, url } | { sig, promise }
let buildToken = 0;
const sigOf = (key) => JSON.stringify([monthDeds(key).map((d) => [d.id, d.sort, d.kind, d.name, d.text]), setting('cover_text'), setting('info_text'), setting('shiur_text'), noDed(key)]);
const nextMonth = (m) => { let { Y, ix } = m; ix += 1; if (ix >= buildYear(Y).pages.length) { Y += 1; ix = 0; } return { Y, ix }; };

function render(main) {
  const p = pageOf(cur); p.Y = cur.Y; const key = monthKey(cur);
  const { a, b } = monthMitzvos(p);
  const ranges = bookRanges(a, b);
  const bookN = countPages(ranges);
  const totalRaw = 4 + bookN + 1; const total = Math.ceil(totalRaw / 4) * 4;
  const list = monthDeds(key);
  const now = currentMonth(); const nx = nextMonth(now);
  const isNow = cur.Y === now.Y && cur.ix === now.ix; const isNext = cur.Y === nx.Y && cur.ix === nx.ix;
  main.innerHTML = `<style>${BK_CSS}${MZ_CSS}</style>
    <div class="lx-bar">
      <button type="button" class="btn ghost" id="bk-back">← זמנים ולוחות</button>
      ${onView ? '<div class="lang-switch"><button type="button" data-v="week">שבועי</button><button type="button" data-v="month">חודשי</button><button type="button" data-v="cycle">לוח מחזור</button></div><button type="button" class="btn mz-kbtn on">📘 קונטרס</button>' : ''}
      <div class="lang-switch"><button type="button" data-go="now" class="${isNow ? 'on' : ''}">החודש: ${h(monthName(pageOf(now)))}</button><button type="button" data-go="next" class="${isNext ? 'on' : ''}">החודש הבא: ${h(monthName(pageOf(nx)))}</button></div>
      <button type="button" class="btn" id="bk-prev" title="חודש קודם">‹</button>
      <b class="lx-title">קונטרס ${h(monthName(p))} ${h(yearHe(cur.Y))}</b>
      <button type="button" class="btn" id="bk-next" title="חודש הבא">›</button>
      <select id="bk-mon" title="חודש">${buildYear(cur.Y).pages.map((x, i) => `<option value="${i}"${i === cur.ix ? ' selected' : ''}>${h(monthName(x))}</option>`).join('')}</select>
      <select id="bk-year" title="שנה">${[cur.Y - 1, cur.Y, cur.Y + 1, cur.Y + 2].map((y) => `<option value="${y}"${y === cur.Y ? ' selected' : ''}>${h(yearHe(y))}</option>`).join('')}</select>
    </div>
    <div class="bk-view">
      <aside class="bk-side">
        <section class="bk-acts">
          <button type="button" class="btn primary" id="bk-print" disabled>🖨 הדפסה / PDF</button>
          <button type="button" class="btn" id="bk-mail" disabled>✉ שליחה במייל</button>
        </section>
        <section>
          <h4>🕯 הנצחות לחודש ${h(monthName(p))}</h4>
          <ul class="bk-dl">${list.map((d) => {
            const c = d.contact_id && ui.contactById ? ui.contactById(d.contact_id) : null;
            return `<li><span>${d.kind === 'html' ? h(richToText(d.text).replace(/\n/g, ' · ').slice(0, 90)) : `${d.kind !== 'free' ? `<b>${h(kindOf(d.kind)[1])}</b> ` : ''}${h(d.name || d.text.replace(/\n/g, ' · ').slice(0, 90))}`}${d.amount && (d.kind === 'nedavas' || d.kind === 'html') ? ` · $${h(d.amount)}` : ''}${c ? ` · <a href="#" data-card="${h(d.contact_id)}">👤 ${h(ui.fullNameHe(c))}</a>` : ''}</span>
              <button type="button" class="btn small-btn" data-ed="${h(d.id)}">✏</button></li>`;
          }).join('') || '<li class="muted">אין עדיין הנצחות לחודש הזה</li>'}</ul>
          <p><button type="button" class="btn" id="bk-add">＋ הנצחה</button>
            <button type="button" class="btn ghost" id="bk-copy">⧉ העתק מהחודש הקודם</button></p>
          <label class="bk-nod"><input type="checkbox" id="bk-noded"${noDed(key) ? ' checked' : ''}> אין הנצחה החודש (בלי מסגרת בעמוד 4 ובכריכה)</label>
        </section>
        <section class="bk-sum">
          <h4>📖 תוכן</h4>
          <p>מצוה <b>${h(numHe(a))}</b> (${h(mitzvaYomis(isoOf(p.monthDays[0].n)).text)}) — עד מצוה <b>${h(numHe(b))}</b></p>
          ${ranges.map((r) => `<p class="small">חלק ${r.vol === 1 ? 'א\'' : 'ב\''}: מצוה ${h(numHe(r.a))}–${h(numHe(r.b))} · עמודים ${r.from}–${r.to} בקובץ</p>`).join('')}
          <p class="small">4 עמודי פתיחה + ${bookN} עמודי ספר + כריכה${total > totalRaw ? ` + ${total - totalRaw} לבנים` : ''} = <b>${total} עמודים</b></p>
        </section>
        <section>
          <h4>⚙ הגדרות</h4>
          ${state.isAdmin ? '<p><button type="button" class="linkish" id="bk-txt">✏ טקסטים קבועים (שער / עמוד 3 / עמוד 4)</button></p>' : ''}
        </section>
      </aside>
      <div class="bk-pdf"><div class="bk-wait"><p id="bk-pmsg">מכין את הקונטרס…</p><div class="bk-prog"><i></i></div></div></div>
    </div>`;
  $('#bk-back', main).onclick = () => back();
  const go = (m) => { cur = m; render(main); };
  const step = (dir) => {
    let { Y, ix } = cur; ix += dir;
    if (ix < 0) { Y -= 1; ix = buildYear(Y).pages.length - 1; } else if (ix >= buildYear(Y).pages.length) { Y += 1; ix = 0; }
    go({ Y, ix });
  };
  $$('[data-go]', main).forEach((x) => { x.onclick = () => go(x.dataset.go === 'now' ? currentMonth() : nextMonth(currentMonth())); });
  $('#bk-prev', main).onclick = () => step(-1);
  $('#bk-next', main).onclick = () => step(1);
  $('#bk-mon', main).onchange = (e) => go({ Y: cur.Y, ix: Number(e.target.value) });
  $('#bk-year', main).onchange = (e) => {
    const Y = Number(e.target.value); const k0 = pageOf(cur).key; const pages = buildYear(Y).pages;
    const ix = pages.findIndex((x) => x.key === k0);
    go({ Y, ix: ix >= 0 ? ix : Math.min(cur.ix, pages.length - 1) });
  };
  $$('[data-v]', main).forEach((x) => { x.onclick = () => onView?.(x.dataset.v, { ...cur }); });
  $('#bk-add', main).onclick = () => dedDialog(main, null, key);
  $$('[data-ed]', main).forEach((x) => { x.onclick = () => dedDialog(main, deds.find((d) => d.id === x.dataset.ed), key); });
  $$('[data-card]', main).forEach((x) => { x.onclick = (e) => { e.preventDefault(); ui.openCard?.(x.dataset.card); }; });
  $('#bk-copy', main).onclick = async () => {
    let { Y, ix } = cur; ix -= 1; if (ix < 0) { Y -= 1; ix = buildYear(Y).pages.length - 1; }
    const prev = monthDeds(monthKey({ Y, ix }));
    if (!prev.length) { ui.toast?.('אין הנצחות בחודש הקודם'); return; }
    try {
      for (const d of prev) await appendRow('BookletDedications', [newId(), key, d.sort, d.kind, d.name, d.text, d.contact_id, '', nowStamp(), state.email, '']);
      await loadData(true); render(main); ui.toast?.(`הועתקו ${prev.length}`);
    } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  };
  $('#bk-noded', main).onchange = async (e) => {
    e.target.disabled = true;
    try { await saveSetting(`noded|${key}`, e.target.checked ? '1' : ''); render(main); } catch (err) { e.target.disabled = false; ui.toast?.(String(err.message || err), 'error'); }
  };
  const tx = $('#bk-txt', main); if (tx) tx.onclick = () => textDialog(main);
  showPdf(main, { ...cur }, key, p);
}

/** בויט (אדער נעמט פונעם זכרון) דעם קונטרס פונעם חודש, און ווייזט אים */
async function showPdf(main, m, key, p) {
  const token = ++buildToken;
  const box = $('.bk-pdf', main); const msg = $('#bk-pmsg', main); const fill = $('.bk-prog i', main);
  const sig = sigOf(key);
  let entry = built.get(key);
  if (!entry || entry.sig !== sig) {
    if (entry?.url) URL.revokeObjectURL(entry.url);
    entry = { sig, promise: buildBooklet(m, (t, f) => { if (token === buildToken) { msg.textContent = t; if (f != null) fill.style.width = `${Math.round(f * 100)}%`; } }) };
    built.set(key, entry);
  }
  try {
    if (!entry.bytes) {
      const r = await entry.promise;
      entry.bytes = r.bytes; entry.pages = r.pages; entry.url = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
    }
  } catch (err) {
    built.delete(key);
    if (token === buildToken) { msg.textContent = `❌ ${err.message || err}`; fill.style.width = '0'; }
    return;
  }
  if (token !== buildToken || !main.isConnected) return;
  // א PDF-לייענער אינעם אתר (נישט תלוי אינעם בלעטערער)
  try { viewer?.destroy(); } catch { /* */ }
  box.innerHTML = '';
  try { viewer = await showPdfIn(box, entry.bytes); } catch (err) { box.innerHTML = `<p class="bk-wait">❌ ${h(String(err.message || err))}</p>`; }
  const name = `מצוה יומית - ${monthName(p)} ${yearHe(m.Y).replace(/"/g, '')}`;
  const pr = $('#bk-print', main); const ml = $('#bk-mail', main);
  pr.disabled = false; ml.disabled = false;
  pr.onclick = () => printDialog(entry, name);
  ml.onclick = () => {
    if (!ui.openCompose) { ui.toast?.('שליחה במייל לא זמינה כאן'); return; }
    ui.openCompose({
      org: 'מכון משנה הלכות', subject: `קונטרס מצוה יומית – חודש ${monthName(p)} ${yearHe(m.Y)}`,
      body: `מצורף קונטרס לימוד מצוה יומית לחודש ${monthName(p)} ${yearHe(m.Y)}.\n\nמפעל מצוה יומית`,
      files: [{ name: `${name}.pdf`, mime: 'application/pdf', bytes: entry.bytes }],
    });
  };
}

function printDialog(entry, name) {
  const { dlg, close } = dialog(`<h3>🖨 ${h(name)}</h3>
    <p class="muted small">${entry.pages} עמודים · ${Math.round(entry.bytes.length / 1024 / 102.4) / 10}MB</p>
    <p style="display:flex;flex-direction:column;gap:8px">
      <button type="button" class="btn primary" data-a="single">⬇ PDF — עמודים בודדים (לבית דפוס / למייל)</button>
      <button type="button" class="btn" data-a="imposed">⬇ PDF להדפסה בבית — 2 עמודים על דף Letter, בסדר של חוברת</button></p>
    <p class="muted small">בהדפסה בבית: דו-צדדי, "הפיכה בצד הקצר" (Flip on short edge), מקפלים באמצע ומהדקים.</p>
    <p id="bk-mmsg" class="muted"></p>
    <p><button type="button" class="btn ghost" data-a="close">סגירה</button></p>`);
  $('[data-a=close]', dlg).onclick = close;
  $('[data-a=single]', dlg).onclick = () => download(entry.bytes, `${name}.pdf`);
  $('[data-a=imposed]', dlg).onclick = async (e) => {
    e.target.disabled = true; $('#bk-mmsg', dlg).textContent = 'מסדר להדפסה…';
    try { download(await impose(entry.bytes), `${name} - להדפסה.pdf`); $('#bk-mmsg', dlg).textContent = '✅'; } catch (err) { $('#bk-mmsg', dlg).textContent = `❌ ${err.message || err}`; }
    e.target.disabled = false;
  };
}

const newId = () => `bd${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function dialog(html) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg bk-form'; dlg.dir = 'rtl';
  dlg.innerHTML = `<button type="button" class="x-close">✕</button>${html}`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.x-close', dlg).onclick = close;
  return { dlg, close };
}

// ---------- טעקסט מיט בולד / גרעסער / קלענער (א קליינער רעדאקטאר) ----------
/** לאזט נאר: b/strong, span מיט font-size (em), br, div/p — אלעס אנדערש ווערט טעקסט */
export function cleanRich(html) {
  const tpl = document.createElement('template'); tpl.innerHTML = String(html || '');
  const walk = (node) => {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out += h(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase(); const inner = walk(n);
      if (tag === 'br') out += '<br>';
      else if (tag === 'b' || tag === 'strong') out += inner ? `<b>${inner}</b>` : '';
      else if (tag === 'div' || tag === 'p') {
        const lh = /line-height:\s*([\d.]+)/.exec(n.getAttribute('style') || '');
        out += `<div${lh ? ` style="line-height:${Math.min(3, Math.max(0.7, Number(lh[1]))).toFixed(2)}"` : ''}>${inner || '<br>'}</div>`;
      }
      else if (tag === 'span' || tag === 'font') {
        const m = /font-size:\s*([\d.]+)em/.exec(n.getAttribute('style') || '');
        const bold = /font-weight:\s*(bold|[6-9]00)/.test(n.getAttribute('style') || '');
        let x = inner;
        if (bold) x = `<b>${x}</b>`;
        out += m && x ? `<span style="font-size:${Math.min(4, Math.max(0.3, Number(m[1]))).toFixed(2)}em">${x}</span>` : x;
      } else out += inner;
    });
    return out;
  };
  return walk(tpl.content);
}
const richToText = (html) => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<br\s*\/?>|<\/div>/gi, '\n'); return d.textContent.replace(/\n{2,}/g, '\n').trim(); };

function richEditor(dlg, html) {
  const ed = $('.bk-ed', dlg);
  ed.innerHTML = cleanRich(html);
  const sizeSel = (factor) => {
    const sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed || !ed.contains(sel.anchorNode)) return;
    const r = sel.getRangeAt(0);
    const sp = document.createElement('span'); sp.style.fontSize = `${factor}em`;
    sp.append(r.extractContents()); r.insertNode(sp);
    sel.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(sp); sel.addRange(nr);
  };
  // שורות (div) וואס זענען אין דער סעלעקציע; לויזער טעקסט אויבן ווערט אריינגעלייגט אין א div
  const linesInSel = () => {
    [...ed.childNodes].forEach((n) => {
      if (n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName)) return;
      if (n.nodeType === 3 && !n.nodeValue.trim()) return;
      const d = document.createElement('div'); ed.insertBefore(d, n);
      while (d.nextSibling && !(d.nextSibling.nodeType === 1 && /^(DIV|P)$/.test(d.nextSibling.tagName))) d.append(d.nextSibling);
    });
    const sel = window.getSelection(); if (!sel.rangeCount || !ed.contains(sel.anchorNode)) return [];
    const r = sel.getRangeAt(0);
    return [...ed.children].filter((d) => r.intersectsNode(d));
  };
  const lineSp = (delta) => linesInSel().forEach((d) => {
    const cur = parseFloat(d.style.lineHeight) || 1.3;
    d.style.lineHeight = Math.min(3, Math.max(0.7, cur + delta)).toFixed(2);
  });
  $$('[data-rt]', dlg).forEach((b) => {
    b.onmousedown = (e) => e.preventDefault(); // נישט פארלירן די סעלעקציע
    b.onclick = () => {
      ed.focus();
      const a = b.dataset.rt;
      if (a === 'b') document.execCommand('bold');
      else if (a === 'up') sizeSel(1.25);
      else if (a === 'down') sizeSel(0.8);
      else if (a === 'lhup') lineSp(0.15);
      else if (a === 'lhdown') lineSp(-0.15);
      else if (a === 'clear') { document.execCommand('removeFormat'); const sel = window.getSelection(); if (sel.rangeCount && !sel.isCollapsed) { const t = sel.toString(); document.execCommand('insertText', false, t); } }
    };
  });
  return () => cleanRich(ed.innerHTML);
}

// ---------- א נדבה ביים קאנטאקט ("קונטרס מצוה יומית") ----------
const DON_NOTE = 'קונטרס מצוה יומית';
async function linkDonation(d, contactId, amount, key, plain) {
  if (!contactId || !(Number(amount) > 0)) return d.donation_id || '';
  const before = d.donation_id ? (state.donations || []).find((x) => String(x.donation_id) === String(d.donation_id)) : null;
  const iso = todayIso();
  const don = {
    ...(before || { date: iso, hebrew_date: formatHebrew(toHebrew(new Date(`${iso}T12:00:00`))), is_paid: false, org: 'מכון משנה הלכות' }),
    ...(d.donation_id ? { donation_id: d.donation_id } : {}),
    contact_id: Number(contactId),
    amount_usd: Number(amount),
    event_note: `${DON_NOTE} – ${monthLabel(key)}`,
    dedication_type: DON_NOTE,
    dedication_text: plain.slice(0, 300),
  };
  delete don._row;
  const id = await saveDonation(don);
  const ix = (state.donations || []).findIndex((x) => String(x.donation_id) === String(id));
  const rec = { ...don, donation_id: id };
  if (ix >= 0) state.donations[ix] = rec; else (state.donations || (state.donations = [])).push(rec);
  return id;
}

function dedDialog(main, d, key) {
  const isNew = !d; d = d || { id: newId(), month: key, sort: monthDeds(key).length + 1, kind: 'html', name: '', text: '', contact_id: '', amount: '', donation_id: '' };
  const c = d.contact_id && ui.contactById ? ui.contactById(d.contact_id) : null;
  // אלטע הנצחות (סוג + שם + טעקסט) → אין רעדאקטאר אלס טעקסט
  const startHtml = d.kind === 'html' ? d.text : [kindOf(d.kind)[2], d.name ? `<b><span style="font-size:1.6em">${h(d.name)}</span></b>` : '', h(d.text).replace(/\n/g, '<br>')].filter(Boolean).map((x) => `<div>${x}</div>`).join('');
  const { dlg, close } = dialog(`<h3>${isNew ? '＋ הנצחה חדשה' : '✏ הנצחה'} · ${h(monthLabel(key))}</h3>
    <label>הטקסט — חופשי. מסמנים מילים ולוחצים:</label>
    <div class="bk-rt"><button type="button" class="btn small-btn" data-rt="b" title="מודגש"><b>B</b> מודגש</button>
      <button type="button" class="btn small-btn" data-rt="up" title="להגדיל את המילים המסומנות">A＋ גדול</button>
      <button type="button" class="btn small-btn" data-rt="down" title="להקטין את המילים המסומנות">A－ קטן</button>
      <button type="button" class="btn small-btn" data-rt="lhup" title="יותר רווח בין השורות המסומנות">↕ רווח＋</button>
      <button type="button" class="btn small-btn" data-rt="lhdown" title="פחות רווח בין השורות המסומנות">↕ רווח－</button>
      <button type="button" class="btn small-btn ghost" data-rt="clear" title="להחזיר לרגיל">↺ רגיל</button></div>
    <div class="bk-ed" contenteditable="true" dir="rtl"></div>
    <p class="muted small">Enter = שורה חדשה. כל שורה ממורכזת, כמו בקונטרס. רווח בין שורות: מסמנים את השורות (או עומדים בשורה) ולוחצים ↕.</p>
    <label>מקושר לאיש קשר (מי שנתן)</label><input name="contact" list="bk-dl-c" autocomplete="off" value="${c && ui.pickerLabel ? h(ui.pickerLabel(c)) : ''}" placeholder="חיפוש לפי שם…">
    <datalist id="bk-dl-c">${(state.contacts || []).map((x) => `<option value="${h(ui.pickerLabel ? ui.pickerLabel(x) : x.contact_id)}">`).join('')}</datalist>
    <label>סכום ($) — נרשם כנדבה בכרטיס של איש הקשר ("${DON_NOTE}")</label><input name="amount" type="number" min="0" step="1" value="${h(d.amount)}">
    <label>סדר (1 = ראשון)</label><input name="sort" type="number" min="1" value="${h(d.sort || 1)}">
    <p class="dlg-actions" style="display:flex;gap:8px;margin-top:14px">
      <button type="button" class="btn primary" data-a="save">שמירה</button>
      ${isNew ? '' : '<button type="button" class="btn danger" data-a="del">מחיקה</button>'}
      <button type="button" class="btn ghost" data-a="cancel">ביטול</button></p>`);
  const getHtml = richEditor(dlg, startHtml);
  $('[data-a=cancel]', dlg).onclick = close;
  const write = async (vals) => {
    if (isNew) await appendRow('BookletDedications', vals);
    else await updateRange(`BookletDedications!A${d.row}:K${d.row}`, [vals]);
    await loadData(true); close(); render(main);
  };
  $('[data-a=save]', dlg).onclick = async (e) => {
    const f = (n) => $(`[name=${n}]`, dlg).value.trim();
    const html = getHtml(); const plain = richToText(html);
    const m = /#(\d+)/.exec(f('contact'));
    if (!plain) { ui.toast?.('חסר טקסט'); return; }
    if (f('amount') && !m) { ui.toast?.('לסכום צריך לבחור איש קשר'); return; }
    e.target.disabled = true;
    try {
      const donId = await linkDonation(d, m ? m[1] : '', f('amount'), key, plain);
      await write([d.id, key, Number(f('sort')) || 1, 'html', '', html, m ? m[1] : '', f('amount'), nowStamp(), state.email, donId]);
      if (donId && !d.donation_id) ui.toast?.('נרשם גם כנדבה בכרטיס');
    } catch (err) { e.target.disabled = false; ui.toast?.(String(err.message || err), 'error'); }
  };
  const del = $('[data-a=del]', dlg);
  if (del) del.onclick = async () => {
    if (!confirm(`למחוק את ההנצחה?${d.donation_id ? '\n(הנדבה בכרטיס של איש הקשר נשארת — אפשר למחוק אותה שם)' : ''}`)) return;
    try { await write(['', '', '', '', '', '', '', '', nowStamp(), state.email, '']); } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  };
}

function textDialog(main) {
  const { dlg, close } = dialog(`<h3>✏ טקסטים קבועים בקונטרס</h3>
    <p class="muted small">סימנים בתחילת שורה: <b>#</b> רווח = גדול מאוד · <b>##</b> רווח = גדול ומודגש · <b>~</b> רווח = קטן · <b>~~</b> רווח = בינוני וצמוד לשורה שלפניו · <b>*</b> רווח = מודגש · <b>[+1.5]</b> / <b>[-1.5]</b> = גדול / קטן יותר בנקודות · <b>---</b> = קו מפריד. שורה ריקה = רווח.</p>
    <label>שער — החלק התחתון (מופץ ע"י, טלפון, מייל)</label><textarea name="cover" rows="7" dir="rtl">${h(setting('cover_text'))}</textarea>
    <label>עמוד 4 — פרטי המכון</label><textarea name="info" rows="11" dir="rtl">${h(setting('info_text'))}</textarea>
    <label>עמוד 3 — הפס השחור מתחת לטבלה (השיעור)</label><textarea name="shiur" rows="4" dir="rtl">${h(setting('shiur_text') || DEF_SHIUR)}</textarea>
    <p style="display:flex;gap:8px;margin-top:14px"><button type="button" class="btn primary" data-a="save">שמירה</button><button type="button" class="btn ghost" data-a="cancel">ביטול</button></p>`);
  $('[data-a=cancel]', dlg).onclick = close;
  $('[data-a=save]', dlg).onclick = async (e) => {
    e.target.disabled = true;
    try {
      await saveSetting('cover_text', $('[name=cover]', dlg).value);
      await saveSetting('info_text', $('[name=info]', dlg).value);
      await saveSetting('shiur_text', $('[name=shiur]', dlg).value);
      close(); render(main);
    } catch (err) { e.target.disabled = false; ui.toast?.(String(err.message || err), 'error'); }
  };
}


// ---------- אינעם כרטיס פון א קאנטאקט ----------
export async function fillBookletCard(el, contactId) {
  if (!el) return;
  try { await loadData(); } catch { return; }
  const mine = deds.filter((d) => d.contact_id === String(contactId));
  if (!mine.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<section><h3>📜 הנצחות בקונטרס מצוה יומית</h3>${mine.map((d) => `<div class="kv"><span>${h(monthLabel(d.month))}</span>
    <span>${d.kind === 'html' ? h(richToText(d.text).replace(/\n/g, ' · ').slice(0, 90)) : `${h(kindOf(d.kind)[1])} ${h(d.name)}`}${d.amount && (d.kind === 'nedavas' || d.kind === 'html') ? ` · <b dir="ltr">$${h(d.amount)}</b>` : ''}</span></div>`).join('')}</section>`;
}
