// חוברת מצוה יומית — כל חודש: שער, קריאת גדולי הדור + תפילה, הטבלה החודשית, פרטים + הנצחות,
// עמודי הספר "מצות המלך" (מהמצוה הראשונה של החודש עד האחרונה, עמודים שלמים), עמודים לבנים עד כפולה של 4,
// וכריכה אחורית עם ההנצחות. גודל: חצי Letter (5.5×8.5), כריכה מימין.
// שני חלקי הספר שמורים בדרייב של חשבון הדאטאבייס (לא באתר הציבורי) — ה-ID שלהם בלשונית Booklet.
import { buildYear, isoOf, nOf, mitzvaYomis } from './engine.js';
import { START, LAST_PAGE, CONTENT, NUM_BAND } from './booklet-index.js';
import { MONTH, CSS as MZ_CSS, monthHtml } from './mitzva.js';
import { hebrewNumber, todayIso } from '../hebdate.js';
import { readTabs, appendRow, updateRange, ensureDriveScope, hasDriveScope, driveFolder, driveUploadLarge, driveDownload } from '../google.js';
import { state } from '../data.js';
import { CONFIG } from '../config.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { htmlToJpeg } from '../pdf.js';

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
    contact_id: String(r[ix('contact_id')] || ''), amount: String(r[ix('amount')] ?? ''),
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
    const s = ln.trimEnd();
    if (/^-{3,}$/.test(s.trim())) return '<div class="bk-hr"></div>';
    let cls = 'bk-l'; let body = s;
    if (s.startsWith('## ')) { cls = 'bk-l bk-l2'; body = s.slice(3); } else if (s.startsWith('# ')) { cls = 'bk-l bk-l1'; body = s.slice(2); } else if (s.startsWith('~ ')) { cls = 'bk-l bk-l3'; body = s.slice(2); }
    if (!body.trim()) return '<div class="bk-sp"></div>';
    const latin = !/[֐-׿]/.test(body);
    return `<div class="${cls}${latin ? ' bk-lat' : ''}"${latin ? ' dir="ltr"' : ''}>${h(body)}</div>`;
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
const IMG = (f) => `img/booklet/${f}?v=1`;
const BK_CSS = `
.bk-pg{position:relative;width:528px;height:816px;overflow:hidden;direction:rtl;background:#fff;color:#111;font-family:'Guttman David','David','Frank Ruhl Libre',serif}
.bk-pg>img.bk-bg{position:absolute;inset:0;width:100%;height:100%}
.bk-abs{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.bk-box1{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:19px;line-height:1.15}
.bk-box2{font-family:'Livorna Bold','Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:34px;line-height:1.1;margin:2px 0}
.bk-box3{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:20px;line-height:1.15}
.bk-l{font-family:'Livorna','Frank Ruhl Libre',serif;font-size:1em;line-height:1.25}
.bk-l1{font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:1.75em;line-height:1.15}
.bk-l2{font-weight:700;font-size:1.25em;line-height:1.2}
.bk-l3{font-size:.75em}
.bk-lat{font-family:Arial,'Helvetica',sans-serif}
.bk-lat.bk-l2{font-size:1.2em;font-weight:400}
.bk-lat.bk-l3{font-size:.68em}
.bk-hr{width:62%;height:0;border-top:1.5px solid #444;margin:14px auto}
.bk-sp{height:8px}
.bk-of{position:relative;width:100%;box-sizing:border-box;padding:calc(77px * var(--fk) + 12px) calc(77px * var(--fk) + 16px)}
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
.bk-fit-area{position:absolute;display:flex;align-items:center;justify-content:center}
.bk-fit{text-align:center;transform-origin:center center;font-size:calc(16px * var(--k,1))}
.bk-ded{margin:2px 0}
.bk-dk{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:1.25em;line-height:1.2}
.bk-dn{font-family:'Livorna Bold','Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:2.1em;line-height:1.15}
.bk-dt{font-size:1.1em;line-height:1.3;margin-top:2px}
.bk-dz{font-family:'Livorna','Frank Ruhl Libre',serif;font-weight:700;font-size:1.05em;margin-top:3px;letter-spacing:1px}
.bk-dsep{font-size:.9em;color:#555;margin:6px 0}
.bk-empty{color:#999;font-size:1.1em}
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
      <div class="bk-box1">סדר לימוד לחודש</div>
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
function p4Html(key) {
  const list = monthDeds(key);
  return `<div class="bk-pg"><img class="bk-bg" src="${IMG('bgR.jpg')}" alt="">
    <div class="bk-abs" style="top:40px;right:40px;width:448px;height:${list.length ? 400 : 736}px"><div class="bk-fit" data-k="1.35">${richLines(setting('info_text'))}</div></div>
    ${list.length ? `<div class="bk-fit-area" style="top:452px;right:46px;width:436px;height:340px">${frame(dedHtml(list), { fk: 0.17, maxh: 262 })}</div>` : ''}
  </div>`;
}
function backHtml(key) {
  const list = monthDeds(key);
  return `<div class="bk-pg"><img class="bk-bg" src="${IMG('bgR.jpg')}" alt="">
    <div class="bk-fit-area" style="top:50px;right:50px;width:428px;height:716px">${frame(list.length ? dedHtml(list) : '<div class="bk-empty">(הנצחה)</div>', { fk: 0.24, maxh: 590, k: 1.6 })}</div>
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
    el.style.setProperty('--k', k);
    const maxH = Number(el.dataset.maxh) || box.clientHeight - 4;
    const fits = () => el.scrollHeight <= maxH && el.scrollWidth <= box.clientWidth + 1;
    for (let i = 0; i < 40 && !fits() && k > 0.35; i += 1) { k *= 0.95; el.style.setProperty('--k', k.toFixed(3)); }
    el.style.fontSize = `${(16 * k).toFixed(2)}px`; // אינליין — פארן בילד
  });
}

// ---------- דער ספר: ארויפלייגן / אראפלאדן ----------
const bookCache = {}; // vol → PDFDocument
async function bookBytes(vol, onProgress) {
  const id = setting(`book${vol}_id`);
  if (!id) throw new Error(`חלק ${vol === 1 ? 'א' : 'ב'} של הספר עדיין לא הועלה (⚙ קבצי הספר).`);
  const key = `https://booklet.local/${id}`;
  try {
    const c = await caches.open('bk-books'); const hit = await c.match(key);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch { /* קיין cache */ }
  await ensureDriveScope();
  let bytes;
  try { bytes = await driveDownload(id, onProgress); } catch (err) {
    if (err.status === 404 || err.status === 403) throw new Error('אין גישה לקובץ הספר מהחשבון הזה. צריך להיות מחובר עם חשבון הדאטאבייס (שהעלה את הקבצים).');
    throw err;
  }
  try { const c = await caches.open('bk-books'); await c.put(key, new Response(bytes)); } catch { /* */ }
  return bytes;
}
let PL = null;
const pdfLib = async () => { PL = PL || await import('../vendor/pdf-lib.esm.min.js'); return PL; };
async function bookDoc(vol, onProgress) {
  if (bookCache[vol]) return bookCache[vol];
  const { PDFDocument } = await pdfLib();
  bookCache[vol] = await PDFDocument.load(await bookBytes(vol, onProgress), { ignoreEncryption: true, updateMetadata: false });
  return bookCache[vol];
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
  const { PDFDocument, rgb } = await pdfLib();
  const p = pageOf(m); p.Y = p.Y || m.Y; const key = monthKey(m);
  const { a, b } = monthMitzvos(p);
  const ranges = bookRanges(a, b);
  const out = await PDFDocument.create();
  out.setTitle(`מצוה יומית – ${monthName(p)} ${yearHe(m.Y)}`);

  // 1) די בלעטער פון HTML → בילד (300 dpi)
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0';
  document.body.append(host);
  const render = async (html) => {
    host.innerHTML = `<style>${BK_CSS}${MZ_CSS}</style>${html}`;
    await Promise.all($$('img', host).map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; }))));
    fitAll(host);
    const { bytes } = await htmlToJpeg(host.innerHTML, { widthIn: 5.5, heightIn: 8.5, scale: 3.125, quality: 0.92 });
    return bytes;
  };
  const addJpg = async (bytes) => { const im = await out.embedJpg(bytes); const pg = out.addPage([PW, PH]); pg.drawImage(im, { x: 0, y: 0, width: PW, height: PH }); };
  progress('שער…', 0.02);
  const front = [coverHtml(p), p2Html(), p3Html(p), p4Html(key)];
  for (let i = 0; i < front.length; i += 1) { progress(`עמוד ${i + 1}…`, 0.02 + i * 0.03); await addJpg(await render(front[i])); }
  const backBytes = await render(backHtml(key));
  host.remove();

  // 2) עמודי הספר
  const s = Math.min((PW - 76) / (CONTENT.x1 - CONTENT.x0), (PH - 76) / (CONTENT.y1 - CONTENT.y0)); // ~0.53 אינטש שוליים
  const cw = (CONTENT.x1 - CONTENT.x0) * s; const ch = (CONTENT.y1 - CONTENT.y0) * s;
  const box = { left: CONTENT.x0, right: CONTENT.x1, bottom: A4H - CONTENT.y1, top: A4H - CONTENT.y0 };
  let bookNo = 0; const total = countPages(ranges);
  for (const r of ranges) {
    const src = await bookDoc(r.vol, (f) => progress(`הורדת חלק ${r.vol === 1 ? 'א' : 'ב'} של הספר… ${Math.round(f * 100)}%`, 0.15 + f * 0.25));
    const idx = []; for (let pg = r.from; pg <= r.to; pg += 1) idx.push(pg - 1);
    const pages = idx.map((i) => src.getPage(i));
    const emb = await out.embedPages(pages, pages.map(() => box));
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
      const n = await numPng(out, plainNum(bookNo), 12.5 * s);
      const cy = Y(135) - n.h / 2;
      const nx = rightPage ? X(477.4) - n.w : X(117.3);
      pg.drawImage(n.img, { x: nx, y: cy, width: n.w, height: n.h });
    }
  }
  // 3) ווייסע בלעטער ביז א כפולה פון 4 (מיט דער כריכה אחורית)
  let blanks = 0;
  while ((out.getPageCount() + 1) % 4 !== 0) { out.addPage([PW, PH]).drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(1, 1, 1) }); blanks += 1; }
  await addJpg(backBytes);
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

function render(main) {
  const p = pageOf(cur); p.Y = cur.Y; const key = monthKey(cur);
  const { a, b } = monthMitzvos(p);
  const ranges = bookRanges(a, b);
  const bookN = countPages(ranges);
  const totalRaw = 4 + bookN + 1; const total = Math.ceil(totalRaw / 4) * 4;
  const list = monthDeds(key);
  const books = [1, 2].map((v) => !!setting(`book${v}_id`));
  main.innerHTML = `<style>${BK_CSS}${MZ_CSS}</style>
    <div class="lx-bar">
      <button type="button" class="btn ghost" id="bk-back">← זמנים ולוחות</button>
      ${onView ? '<div class="lang-switch"><button type="button" data-v="week">שבועי</button><button type="button" data-v="month">חודשי</button><button type="button" data-v="cycle">לוח מחזור</button></div><button type="button" class="btn mz-kbtn on">📘 קונטרס</button>' : ''}
      <button type="button" class="btn" id="bk-prev">‹ הקודם</button>
      <b class="lx-title">קונטרס ${h(monthName(p))} ${h(yearHe(cur.Y))}</b>
      <button type="button" class="btn" id="bk-next">הבא ›</button>
      <select id="bk-mon" title="חודש">${buildYear(cur.Y).pages.map((x, i) => `<option value="${i}"${i === cur.ix ? ' selected' : ''}>${h(monthName(x))}</option>`).join('')}</select>
      <select id="bk-year" title="שנה">${[cur.Y - 1, cur.Y, cur.Y + 1, cur.Y + 2].map((y) => `<option value="${y}"${y === cur.Y ? ' selected' : ''}>${h(yearHe(y))}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="bk-make">⬇ הפקת הקונטרס (PDF)</button>
      <button type="button" class="btn ghost" id="bk-files">⚙ קבצי הספר</button>
    </div>
    ${books.every(Boolean) ? '' : `<p class="lx-warn">⚠ צריך להעלות פעם אחת את שני חלקי הספר (⚙ קבצי הספר), מחובר עם חשבון הדאטאבייס. חסר: ${[1, 2].filter((v) => !books[v - 1]).map((v) => (v === 1 ? 'חלק א\'' : 'חלק ב\'')).join(', ')}</p>`}
    <div class="bk-panel">
      <section class="bk-sum">
        <h4>📖 תוכן הקונטרס</h4>
        <p>מצוה <b>${h(numHe(a))}</b> (${h(mitzvaYomis(isoOf(p.monthDays[0].n)).text)}) — עד מצוה <b>${h(numHe(b))}</b></p>
        ${ranges.map((r) => `<p>חלק ${r.vol === 1 ? 'א\'' : 'ב\''}: מצוה ${h(numHe(r.a))}–${h(numHe(r.b))} · עמודים ${r.from}–${r.to} בקובץ (${r.to - r.from + 1} עמ')</p>`).join('')}
        <p>4 עמודי פתיחה + ${bookN} עמודי ספר + כריכה אחורית${total > totalRaw ? ` + ${total - totalRaw} עמודים לבנים` : ''} = <b>${total} עמודים</b> (${total / 4} גליונות)</p>
        <p class="muted small">"להדפסה בבית": 2 עמודים על כל דף Letter לרוחב, בסדר של חוברת. מדפיסים דו-צדדי — "הפיכה בצד הקצר" (Flip on short edge), מקפלים באמצע ומהדקים.</p>
      </section>
      <section>
        <h4>🕯 הנצחות לחודש ${h(monthName(p))}</h4>
        <ul class="bk-dl">${list.map((d) => {
          const c = d.contact_id && ui.contactById ? ui.contactById(d.contact_id) : null;
          return `<li><span><b>${h(kindOf(d.kind)[1])}</b> ${h(d.name)}${d.amount && d.kind === 'nedavas' ? ` · $${h(d.amount)}` : ''}${c ? ` · <a href="#" data-card="${h(d.contact_id)}">👤 ${h(ui.fullNameHe(c))}</a>` : ''}</span>
            <button type="button" class="btn small-btn" data-ed="${h(d.id)}">✏</button></li>`;
        }).join('') || '<li class="muted">אין עדיין הנצחות לחודש הזה</li>'}</ul>
        <p><button type="button" class="btn" id="bk-add">＋ הנצחה</button>
          <button type="button" class="btn ghost" id="bk-copy">⧉ העתק מהחודש הקודם</button></p>
        ${state.isAdmin ? '<p><button type="button" class="linkish" id="bk-txt">✏ עריכת הטקסטים הקבועים (שער / עמוד 4)</button></p>' : ''}
      </section>
    </div>
    <div class="bk-thumbs">
      ${[['שער', coverHtml(p)], ['עמ\' 2', p2Html()], ['עמ\' 3 – הטבלה', p3Html(p)], ['עמ\' 4 – פרטים', p4Html(key)], ['כריכה אחורית', backHtml(key)]]
        .map(([t, html]) => `<div class="bk-th"><div class="bk-sc">${html}</div><b>${h(t)}</b></div>`).join('')}
    </div>`;
  requestAnimationFrame(() => fitAll(main));
  setTimeout(() => fitAll(main), 600); // נאכן לאדן די גופנים
  $('#bk-back', main).onclick = () => back();
  const step = (dir) => {
    let { Y, ix } = cur; ix += dir;
    if (ix < 0) { Y -= 1; ix = buildYear(Y).pages.length - 1; } else if (ix >= buildYear(Y).pages.length) { Y += 1; ix = 0; }
    cur = { Y, ix }; render(main);
  };
  $('#bk-prev', main).onclick = () => step(-1);
  $('#bk-mon', main).onchange = (e) => { cur = { Y: cur.Y, ix: Number(e.target.value) }; render(main); };
  $('#bk-year', main).onchange = (e) => {
    const Y = Number(e.target.value); const key = pageOf(cur).key; const pages = buildYear(Y).pages;
    const ix = pages.findIndex((x) => x.key === key);
    cur = { Y, ix: ix >= 0 ? ix : Math.min(cur.ix, pages.length - 1) }; render(main);
  };
  $$('[data-v]', main).forEach((x) => { x.onclick = () => onView?.(x.dataset.v, { ...cur }); });
  $('#bk-next', main).onclick = () => step(1);
  $('#bk-files', main).onclick = () => filesDialog(main);
  $('#bk-make', main).onclick = () => makeDialog(main);
  $('#bk-add', main).onclick = () => dedDialog(main, null, key);
  $$('[data-ed]', main).forEach((x) => { x.onclick = () => dedDialog(main, deds.find((d) => d.id === x.dataset.ed), key); });
  $$('[data-card]', main).forEach((x) => { x.onclick = (e) => { e.preventDefault(); ui.openCard?.(x.dataset.card); }; });
  $('#bk-copy', main).onclick = async () => {
    let { Y, ix } = cur; ix -= 1; if (ix < 0) { Y -= 1; ix = buildYear(Y).pages.length - 1; }
    const prev = monthDeds(monthKey({ Y, ix }));
    if (!prev.length) { ui.toast?.('אין הנצחות בחודש הקודם'); return; }
    try {
      for (const d of prev) await appendRow('BookletDedications', [newId(), key, d.sort, d.kind, d.name, d.text, d.contact_id, d.amount, nowStamp(), state.email]);
      await loadData(true); render(main); ui.toast?.(`הועתקו ${prev.length}`);
    } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  };
  const tx = $('#bk-txt', main); if (tx) tx.onclick = () => textDialog(main);
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

function dedDialog(main, d, key) {
  const isNew = !d; d = d || { id: newId(), month: key, sort: monthDeds(key).length + 1, kind: 'iluy', name: '', text: '', contact_id: '', amount: '' };
  const c = d.contact_id && ui.contactById ? ui.contactById(d.contact_id) : null;
  const { dlg, close } = dialog(`<h3>${isNew ? '＋ הנצחה חדשה' : '✏ הנצחה'} · ${h(monthLabel(key))}</h3>
    <label>סוג</label><select name="kind">${KINDS.map(([k, l, full]) => `<option value="${k}"${k === d.kind ? ' selected' : ''}>${h(l)}${full && full !== l ? ` (${h(full)})` : ''}</option>`).join('')}</select>
    <label>שם (שורה גדולה)</label><input name="name" value="${h(d.name)}" placeholder="למשל: הרה&quot;ח ר' משה בן ר' יעקב ז&quot;ל">
    <label>טקסט נוסף (אפשר כמה שורות)</label><textarea name="text" rows="3" placeholder="למשל: נלב&quot;ע כ&quot;ה חשון תש&quot;ס">${h(d.text)}</textarea>
    <label>מקושר לאיש קשר (מי שנתן)</label><input name="contact" list="bk-dl-c" autocomplete="off" value="${c && ui.pickerLabel ? h(ui.pickerLabel(c)) : ''}" placeholder="חיפוש לפי שם…">
    <datalist id="bk-dl-c">${(state.contacts || []).map((x) => `<option value="${h(ui.pickerLabel ? ui.pickerLabel(x) : x.contact_id)}">`).join('')}</datalist>
    <div class="bk-amt"><label>סכום הנדבה ($) — נרשם בכרטיס בלבד</label><input name="amount" type="number" min="0" step="1" value="${h(d.amount)}"></div>
    <label>סדר (1 = ראשון)</label><input name="sort" type="number" min="1" value="${h(d.sort || 1)}">
    <p class="dlg-actions" style="display:flex;gap:8px;margin-top:14px">
      <button type="button" class="btn primary" data-a="save">שמירה</button>
      ${isNew ? '' : '<button type="button" class="btn danger" data-a="del">מחיקה</button>'}
      <button type="button" class="btn ghost" data-a="cancel">ביטול</button></p>`);
  const amt = $('.bk-amt', dlg); const kindSel = $('[name=kind]', dlg);
  const syncAmt = () => { amt.hidden = kindSel.value !== 'nedavas'; };
  kindSel.onchange = syncAmt; syncAmt();
  $('[data-a=cancel]', dlg).onclick = close;
  const write = async (vals) => {
    if (isNew) await appendRow('BookletDedications', vals);
    else await updateRange(`BookletDedications!A${d.row}:J${d.row}`, [vals]);
    await loadData(true); close(); render(main);
  };
  $('[data-a=save]', dlg).onclick = async (e) => {
    const f = (n) => $(`[name=${n}]`, dlg).value.trim();
    const kind = f('kind'); const m = /#(\d+)/.exec(f('contact'));
    if (!f('name') && !f('text')) { ui.toast?.('חסר שם'); return; }
    e.target.disabled = true;
    try { await write([d.id, key, Number(f('sort')) || 1, kind, f('name'), f('text'), m ? m[1] : '', kind === 'nedavas' ? f('amount') : '', nowStamp(), state.email]); } catch (err) { e.target.disabled = false; ui.toast?.(String(err.message || err), 'error'); }
  };
  const del = $('[data-a=del]', dlg);
  if (del) del.onclick = async () => {
    if (!confirm('למחוק את ההנצחה?')) return;
    try { await write(['', '', '', '', '', '', '', '', nowStamp(), state.email]); } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  };
}

function textDialog(main) {
  const { dlg, close } = dialog(`<h3>✏ טקסטים קבועים בקונטרס</h3>
    <p class="muted small">סימנים בתחילת שורה: <b>#</b> רווח = גדול מאוד · <b>##</b> רווח = גדול ומודגש · <b>~</b> רווח = קטן · <b>---</b> = קו מפריד. שורה ריקה = רווח.</p>
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

function filesDialog(main) {
  const row = (v) => `<label>חלק ${v === 1 ? 'א\' (מצוה א–שכג, 541 עמודים)' : 'ב\' (מצוה שכד–תריג, 566 עמודים)'} ${setting(`book${v}_id`) ? '✅ הועלה' : '❌ חסר'}</label>
    <input type="file" accept="application/pdf,.pdf" data-v="${v}">`;
  const { dlg, close } = dialog(`<h3>⚙ קבצי הספר "מצות המלך"</h3>
    <p class="muted small">מעלים פעם אחת את שני הקבצים (PDF). הם נשמרים ב-Google Drive של החשבון שמחובר עכשיו (${h(state.email || '')}), בתיקייה "${h(CONFIG.DRIVE_FOLDER)} / ספר מצות המלך" — לא באתר הציבורי. כדאי להיות מחובר עם חשבון הדאטאבייס.</p>
    ${hasDriveScope() ? '' : '<p class="bk-scope"><button type="button" class="btn primary" data-a="scope">🔑 שלב 1: אישור גישה ל-Google Drive</button></p>'}
    ${row(1)}${row(2)}
    <div class="bk-prog" hidden><i></i></div><p id="bk-fmsg" class="muted"></p>
    <p><button type="button" class="btn ghost" data-a="close">סגירה</button></p>`);
  $('[data-a=close]', dlg).onclick = close;
  const files = $$('input[type=file]', dlg);
  const sc = $('[data-a=scope]', dlg);
  if (sc) {
    files.forEach((f) => { f.disabled = true; });
    // דער גוגל-פענצטער מוז זיך עפענען גלייך ביים קליק (אנדערש בלאקירט עס דער בלעטערער)
    sc.onclick = async () => {
      try { await ensureDriveScope(); sc.parentElement.innerHTML = '✅ יש גישה ל-Drive — עכשיו בחר את הקבצים'; files.forEach((f) => { f.disabled = false; }); } catch (err) { $('#bk-fmsg', dlg).textContent = `❌ ${err.message || err}`; }
    };
  }
  files.forEach((inp) => {
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      const v = Number(inp.dataset.v); const msg = $('#bk-fmsg', dlg); const bar = $('.bk-prog', dlg); const fill = $('i', bar);
      try {
        bar.hidden = false; msg.textContent = 'בודק את הקובץ…';
        const { PDFDocument } = await pdfLib();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
        const n = doc.getPageCount(); const want = v === 1 ? 541 : 566;
        if (n !== want && !confirm(`לקובץ יש ${n} עמודים (חלק ${v === 1 ? 'א' : 'ב'} צריך ${want}). להעלות בכל זאת?`)) { msg.textContent = ''; bar.hidden = true; return; }
        msg.textContent = 'מעלה ל-Drive…';
        await ensureDriveScope();
        const root = await driveFolder(CONFIG.DRIVE_FOLDER);
        const folder = await driveFolder('ספר מצות המלך', root);
        const id = await driveUploadLarge(file, `מצות המלך - חלק ${v === 1 ? 'א' : 'ב'}.pdf`, folder, (f) => { fill.style.width = `${Math.round(f * 100)}%`; msg.textContent = `מעלה… ${Math.round(f * 100)}%`; });
        await saveSetting(`book${v}_id`, id);
        bookCache[v] = doc;
        try { const c = await caches.open('bk-books'); await c.put(`https://booklet.local/${id}`, new Response(bytes)); } catch { /* */ }
        msg.textContent = '✅ הועלה'; fill.style.width = '100%';
        dlg.querySelectorAll('label')[v - 1].innerHTML = dlg.querySelectorAll('label')[v - 1].innerHTML.replace('❌ חסר', '✅ הועלה');
        render(main);
      } catch (err) { msg.textContent = `❌ ${err.message || err}`; }
    };
  });
}

function makeDialog(main) {
  const p = pageOf(cur); p.Y = cur.Y;
  const { dlg, close } = dialog(`<h3>⬇ קונטרס ${h(monthName(p))} ${h(yearHe(cur.Y))}</h3>
    <label><input type="radio" name="kind" value="single" checked style="width:auto"> עמודים בודדים (לבית דפוס / למייל)</label>
    <label><input type="radio" name="kind" value="imposed" style="width:auto"> להדפסה בבית — 2 עמודים על דף Letter, בסדר של חוברת</label>
    <label><input type="radio" name="kind" value="both" style="width:auto"> שניהם</label>
    <div class="bk-prog"><i></i></div><p id="bk-mmsg" class="muted"></p>
    <p style="display:flex;gap:8px"><button type="button" class="btn primary" data-a="go">הפק</button><button type="button" class="btn ghost" data-a="close">סגירה</button></p>`);
  $('[data-a=close]', dlg).onclick = close;
  $('[data-a=go]', dlg).onclick = async (e) => {
    if (!hasDriveScope()) { try { await ensureDriveScope(); } catch (err) { $('#bk-mmsg', dlg).textContent = `❌ ${err.message || err}`; return; } }
    const kind = $('[name=kind]:checked', dlg).value; const msg = $('#bk-mmsg', dlg); const fill = $('.bk-prog i', dlg);
    e.target.disabled = true;
    try {
      const r = await buildBooklet(cur, (m, f) => { msg.textContent = m; if (f != null) fill.style.width = `${Math.round(f * 100)}%`; });
      const name = `מצוה יומית - ${monthName(p)} ${yearHe(cur.Y).replace(/"/g, '')}`;
      if (kind !== 'imposed') download(r.bytes, `${name}.pdf`);
      if (kind !== 'single') { msg.textContent = 'מסדר להדפסה…'; download(await impose(r.bytes), `${name} - להדפסה.pdf`); }
      fill.style.width = '100%';
      msg.textContent = `✅ ${r.pages} עמודים${r.blanks ? ` (כולל ${r.blanks} לבנים)` : ''}`;
    } catch (err) { msg.textContent = `❌ ${err.message || err}`; console.error(err); }
    e.target.disabled = false;
  };
}

// ---------- אינעם כרטיס פון א קאנטאקט ----------
export async function fillBookletCard(el, contactId) {
  if (!el) return;
  try { await loadData(); } catch { return; }
  const mine = deds.filter((d) => d.contact_id === String(contactId));
  if (!mine.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<section><h3>📜 הנצחות בקונטרס מצוה יומית</h3>${mine.map((d) => `<div class="kv"><span>${h(monthLabel(d.month))}</span>
    <span>${h(kindOf(d.kind)[1])} ${h(d.name)}${d.amount && d.kind === 'nedavas' ? ` · <b dir="ltr">$${h(d.amount)}</b>` : ''}</span></div>`).join('')}</section>`;
}
