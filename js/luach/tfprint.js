// הדפסת זמני התפילה — דפים להדפסה (8.5×11 / 11×17).
// ימות החול: ווי דער אלטער ZMANIM1 (מסגרת, פסים שווארצע). שבת: ווי דער בלאט "זמני שבת פרשת נח".
// יו"ט / ימי דפגרא / תשרי: ווי דער בלאט פון פורים — חלקים מיט א קעפל: שורות מיט פינטלעך, א פאס פון תיבות, א טבלה פון מנינים.
import { hhmm } from './zmanim.js';
import { computeWeekday, computeShabbos, daysOf, dayZ, timeOf, eventsBetween, friMincha } from './minyanim.js';
import { dowOf, isoOf } from './engine.js';

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tm = (m) => (m == null ? '' : hhmm(((m % 1440) + 1440) % 1440));
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export const SIZES = { letter: { w: 8.5, h: 11, label: '8.5×11' }, tabloid: { w: 11, h: 17, label: '11×17' } };
export const FOOTER = ['צו באקומען זמנים און הודעות', 'שיקט די ווארט UNGVAR', 'צו 1-833-646-3971'];

/** CSS פאר די בלעטער. די בלעטער זענען געבויט אין "פונקטן" פון 8.5 אינטש = 816; ביי 11×17 ווערט אלעס גרעסער (--k) */
export function printCss(fontHe = 'Frank Ruhl Libre') {
  const HE = `'${fontHe}', 'Frank Ruhl Libre', 'David Libre', serif`;
  return `
.tp-page { position: relative; background: #fff; color: #000; direction: rtl; overflow: hidden; box-sizing: border-box; font-family: ${HE}; }
.tp-page * { box-sizing: border-box; }
.tp-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: stretch; font-size: calc(var(--fs, 20px) * var(--k, 1)); }
.tp-num { font-family: 'Times New Roman', 'Liberation Serif', serif; font-weight: 700; direction: ltr; unicode-bidi: isolate; }
/* ---- ימות החול (ZMANIM1) ---- */
.tp-wk .tp-frame { position: absolute; inset: calc(22px * var(--k)); border: calc(7px * var(--k)) solid #000; pointer-events: none;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath d='M10 1 L19 10 L10 19 L1 10Z' fill='%23000'/%3E%3Cpath d='M10 6 L14 10 L10 14 L6 10Z' fill='%23fff'/%3E%3Ccircle cx='0' cy='0' r='2' fill='%23000'/%3E%3Ccircle cx='20' cy='0' r='2' fill='%23000'/%3E%3Ccircle cx='0' cy='20' r='2' fill='%23000'/%3E%3Ccircle cx='20' cy='20' r='2' fill='%23000'/%3E%3C/svg%3E") center / calc(20px * var(--k)) calc(20px * var(--k)) repeat; }
.tp-wk .tp-frame::before { content: ''; position: absolute; inset: calc(3px * var(--k)); border: calc(1.5px * var(--k)) solid #000; }
.tp-wk .tp-frame::after { content: ''; position: absolute; inset: calc(24px * var(--k)); background: #fff; border: calc(3px * var(--k)) solid #000; outline: calc(1.5px * var(--k)) solid #000; outline-offset: calc(3px * var(--k)); }
.tp-wk .tp-frame i { position: absolute; z-index: 1; width: calc(44px * var(--k)); height: calc(44px * var(--k)); background: #000; border: calc(3px * var(--k)) double #fff; outline: calc(2px * var(--k)) solid #000; }
.tp-wk .tp-frame i::after { content: ''; position: absolute; inset: calc(9px * var(--k)); background: #fff; transform: rotate(45deg); box-shadow: inset 0 0 0 calc(4px * var(--k)) #fff, inset 0 0 0 calc(7px * var(--k)) #000; }
.tp-wk .tp-frame i:nth-child(1) { top: calc(-9px * var(--k)); right: calc(-9px * var(--k)); }
.tp-wk .tp-frame i:nth-child(2) { top: calc(-9px * var(--k)); left: calc(-9px * var(--k)); }
.tp-wk .tp-frame i:nth-child(3) { bottom: calc(-9px * var(--k)); right: calc(-9px * var(--k)); }
.tp-wk .tp-frame i:nth-child(4) { bottom: calc(-9px * var(--k)); left: calc(-9px * var(--k)); }
.tp-wk .tp-rbl { text-align: center; font-weight: 900; font-size: 2em; line-height: 1.15; border: .09em solid #000; border-radius: .3em; margin: 0 .6em .25em; padding: .05em .4em .1em; white-space: nowrap; }
.tp-wk .tp-rbl .t { font-size: .7em; line-height: 1.1; }
.tp-wk .tp-rbl small { font-size: .6em; }
.tp-wk .tp-rbl .tp-num { font-size: 1.15em; }
.tp-wk .tp-in { inset: calc(62px * var(--k)); }
.tp-wk .tp-title { text-align: center; font-weight: 900; font-size: 4.1em; line-height: 1.12; padding: .1em 0 .12em; }
.tp-wk .tp-band { background: #000; color: #fff; border-radius: .25em; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: .02em .5em .1em; }
.tp-wk .tp-band b { font-size: 3.2em; font-weight: 900; line-height: 1.15; }
.tp-wk .tp-band small { font-size: .95em; font-weight: 700; text-align: center; line-height: 1.2; justify-self: end; }
.tp-wk .tp-band small.r { justify-self: start; }
.tp-wk .tp-times { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: space-evenly; padding: .15em 0; }
.tp-wk .tp-line { text-align: center; font-size: 3.15em; line-height: 1.12; white-space: nowrap; }
.tp-wk .tp-line .dot { margin: 0 .16em; }
.tp-wk .tp-rb { border: .07em solid #000; border-radius: .14em; padding: 0 .1em; }
.tp-wk .tp-ap { font-family: ${HE}; font-size: .38em; font-weight: 700; margin-inline-start: .15em; vertical-align: .35em; }
.tp-wk .tp-shab { text-align: center; font-size: 2.15em; font-weight: 900; padding: .18em 0 .1em; white-space: nowrap; }
.tp-wk .tp-key { font-size: .8em; text-align: center; margin-top: .1em; }
/* ---- שבת / יו"ט: קעפל פון בריוו ---- */
.tp-lh { display: block; width: 92%; margin: calc(34px * var(--k)) auto 0; }
.tp-sh .tp-in, .tp-sp .tp-in { padding: 0 calc(56px * var(--k)) calc(56px * var(--k)); }
.tp-sh .tp-title { text-align: center; font-weight: 900; font-size: 3.1em; line-height: 1.1; margin-top: 1.1em; }
.tp-sh .tp-sub { text-align: center; font-size: 1.2em; margin-top: .25em; }
.tp-sh .tp-rows { margin: 1.4em auto 0; width: 70%; display: flex; flex-direction: column; gap: .62em; }
.tp-dots { display: flex; align-items: baseline; font-size: 1.85em; font-weight: 700; line-height: 1.15; }
.tp-dots .l { white-space: nowrap; }
.tp-dots .f { flex: 1; border-bottom: .12em dotted #000; margin: 0 .12em .2em; min-width: 1em; }
.tp-dots .tp-num { font-size: 1.05em; white-space: nowrap; }
.tp-sh .tp-rows .tp-note, .tp-sp .tp-note { font-size: .55em; font-weight: 400; margin-inline-start: .3em; }
.tp-foot { margin-top: auto; text-align: center; }
.tp-foot .box { display: inline-block; border: 1.5px solid #000; padding: .3em 1.4em .35em; font-size: .78em; line-height: 1.3; background: #fff; position: relative; z-index: 1; }
.tp-foot .rule { border-top: 3px solid #000; margin-top: -.9em; }
/* ---- יו"ט / ימי דפגרא / תשרי ---- */
.tp-sp .tp-pasuk { text-align: center; font-weight: 900; font-size: 1.95em; margin-top: .55em; line-height: 1.2; }
.tp-sp .tp-pasuk small { font-size: .42em; font-weight: 700; }
.tp-sp .tp-title { text-align: center; font-weight: 900; font-size: 2.55em; line-height: 1.15; margin-top: .05em; }
.tp-sp .tp-body { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: space-around; padding-top: .3em; }
.tp-sp .tp-sec { margin: .3em 0; }
.tp-sp .tp-head { font-weight: 900; font-size: 2.05em; line-height: 1.2; margin-bottom: .15em; }
.tp-sp .tp-head .big { font-size: 1.22em; }
.tp-sp .tp-head .sub { font-weight: 700; }
.tp-sp .tp-head .tp-note { font-size: .45em; }
.tp-sp .tp-dots { width: 82%; font-size: 1.75em; margin: .08em 0; }
.tp-strip { display: flex; border: 1.5px solid #000; }
.tp-strip > div { flex: 1; text-align: center; font-size: 2em; padding: .12em 0; border-inline-start: 1.5px solid #000; }
.tp-strip > div:first-child { border-inline-start: 0; }
.tp-orn { text-align: center; font-size: 1.1em; letter-spacing: .35em; margin: .1em 0; }
.tp-tbl { width: 100%; border-collapse: collapse; font-size: 1.6em; }
.tp-tbl th, .tp-tbl td { border: 1.5px solid #000; padding: .08em .35em; text-align: center; line-height: 1.25; white-space: nowrap; }
.tp-tbl th.lt { white-space: normal; }
.tp-tbl th { background: #000; color: #fff; font-weight: 700; font-size: .95em; }
.tp-tbl th.lt { background: #fff; color: #000; font-weight: 400; font-size: .72em; text-align: right; }
.tp-tbl td.n { text-align: right; white-space: nowrap; font-size: .85em; }
.tp-tbl td.r { text-align: right; font-weight: 700; }
.tp-tbl tr:nth-child(even) td { background: #e6e6e6; }
.tp-tbl td.rb { background: #000 !important; color: #fff; font-weight: 700; text-align: right; }
.tp-tbl td .tp-num { font-size: 1.1em; }
.tp-sp .tp-grid { column-count: 2; column-gap: 2.2em; margin: .05em 0 .2em; }
.tp-sp .tp-grid .tp-dots { width: 100%; break-inside: avoid; }
.tp-sp .tp-grid .rm { font-size: .9em; white-space: nowrap; }
.tp-sp .tp-rbrow { width: 100%; }
.tp-sp .tp-cols .tp-grid { column-gap: 1em; }
.tp-sp .tp-sub { font-weight: 900; font-size: 1.7em; margin: .15em 0 .1em; }
.tp-sp .tp-txt { font-size: 1.3em; margin: .15em 0; }
.tp-sp .tp-cols { display: block; column-count: 2; column-gap: 1.6em; column-rule: 1.5px solid #000; justify-content: initial; }
.tp-sp .tp-cols .tp-sec { break-inside: avoid; margin: 0 0 .5em; }
.tp-sp .tp-cols .tp-head { font-size: 1.45em; text-align: center; text-decoration: underline; }
.tp-sp .tp-cols .tp-dots { width: 100%; font-size: 1.15em; }
.tp-sp .tp-cols .tp-sub { font-size: 1.15em; } .tp-sp .tp-cols .tp-strip > div { font-size: 1.1em; } .tp-sp .tp-cols .tp-txt { font-size: .95em; }
.tp-sp .tp-end { text-align: center; font-weight: 900; font-size: 1.6em; }
.tp-ctr { text-align: center; font-weight: 700; font-size: 1.9em; line-height: 1.35; }
.tp-ctr .tp-num { font-size: 1.05em; }
.tp-tilde { text-align: center; font-weight: 900; font-size: 1.95em; margin-top: .25em; }
`;
}

const page = (cls, size, inner, extra = '') => {
  const S = SIZES[size] || SIZES.letter;
  const k = S.w / 8.5;
  return `<div class="tp-page ${cls}" style="width:${S.w * 96}px;height:${S.h * 96}px;--k:${k}">${extra}<div class="tp-in">${inner}</div></div>`;
};

// ---------- ימות החול ----------
/** n = א טאג אין דער וואך (מ'רעכנט לויט weekday.refDay); fri = ערב שבת; parsha = נאמען */
export function weekdayPage(data, n, fri, parsha, loc, size = 'letter') {
  const w = computeWeekday(data, n, loc);
  const sh = computeShabbos(data, fri, loc);
  // צעטיילט גלייך: 7 → 3,2,2
  const even = (a, per) => { const L = Math.max(1, Math.ceil(a.length / per)); const o = []; let i = 0; for (let k = 0; k < L; k += 1) { const c = Math.ceil((a.length - i) / (L - k)); o.push(a.slice(i, i + c)); i += c; } return o; };
  const line = (items, per) => even(items, per).map((row) => `<div class="tp-line">${row.map((x) => `<span class="tp-num${x.rebbe ? ' tp-rb' : ''}">${tm(x.min)}</span>${x.ap ? '<span class="tp-ap">בערך</span>' : ''}${x.xn ? `<span class="tp-ap">${h(x.xn)}</span>` : ''}`).join('<span class="tp-num dot">•</span>')}</div>`).join('');
  const per = (g, a) => (g === 'mincha' ? (a.length > 9 ? 4 : 3) : g === 'maariv' ? (a.length > 4 ? 3 : 2) : (a.length > 9 ? 4 : 3));
  const rbM = w.mincha.find((x) => x.rebbe); const rbA = w.maariv.find((x) => x.rebbe);
  const mincha = w.mincha.filter((x) => !x.rebbe); const maariv = w.maariv.filter((x) => !x.rebbe);
  const shach = w.shacharis.map((x) => ({ ...x, rebbe: false }));
  const rbLine = rbM || rbA ? `<div class="tp-rbl"><div class="t">מנין כ"ק אדמו"ר שליט"א</div>${[rbM ? `מנחה <span class="tp-num">${tm(rbM.min)}</span>` : '', rbA ? `מעריב <small>(בערך)</small> <span class="tp-num">${tm(rbA.min)}</span>` : ''].filter(Boolean).join(' <span class="tp-num">·</span> ')}</div>` : '';
  const fMin = sh.find((r) => r.day === 'fri' && r.kind === 'tefila' && /מנחה/.test(r.label));
  const sShach = sh.find((r) => r.day === 'sat' && /שחרית/.test(r.label));
  const sMin = sh.find((r) => r.day === 'sat' && r.kind === 'tefila' && /מנחה/.test(r.label));
  const band = (name, note) => `<div class="tp-band"><span></span><b>${h(name)}</b>${note ? `<small>${note}</small>` : '<span></span>'}</div>`;
  const shNote = w.shacharisNote ? `זמני ברכות<br>(${h(w.shacharisNote.replace(/\s*מינוט|\s*דקות/, ''))} מינוט)` : '';
  const inner = `
    <div class="tp-title">פרשת ${h(parsha)}</div>
    ${band('שחרית', shNote)}<div class="tp-times">${line(shach, per('shacharis', shach))}</div>
    ${band('מנחה', w.minchaNote ? h(w.minchaNote) : '')}<div class="tp-times">${line(mincha, per('mincha', mincha))}</div>
    ${rbLine}
    ${band('מעריב', w.maarivNote ? h(w.maarivNote) : '')}<div class="tp-times">${line(maariv, per('maariv', maariv))}</div>
    <div class="tp-band"><span></span><b style="font-size:2.3em">זמני שבת קודש</b>${sShach?.min != null ? `<small>שחרית<br><span class="tp-num">${tm(sShach.min)}</span></small>` : '<span></span>'}</div>
    <div class="tp-shab">${[fMin?.min != null ? `מנחה ער"ש <span class="tp-num">${tm(fMin.min)}</span>` : '', sMin?.min != null ? `מנחה ש"ק <span class="tp-num">${tm(sMin.min)}</span>` : ''].filter(Boolean).join(' <span class="tp-num">•</span> ')}</div>`;
  return page('tp-wk', size, inner, '<div class="tp-frame"><i></i><i></i><i></i><i></i></div>');
}

// ---------- שבת ----------
export function shabbosPage(data, fri, title, loc, size = 'letter') {
  const rows = computeShabbos(data, fri, loc).filter((r) => r.min != null);
  const inner = `<img class="tp-lh" src="img/print/letterhead.png" alt="">
    <div class="tp-title">${h(title)}</div>
    <div class="tp-sub">בצל כ"ק מרן אדמו"ר שליט"א</div>
    <div class="tp-rows">${rows.map((r) => `<div class="tp-dots"><span class="l">${h(r.label)}${r.note ? `<span class="tp-note">(${h(r.note)})</span>` : ''}</span><span class="f"></span><span class="tp-num">${tm(r.min)}</span></div>`).join('')}</div>
    <div class="tp-foot"><div class="box">${FOOTER.map(h).join('<br>')}</div><div class="rule"></div></div>`;
  return page('tp-sh', size, inner);
}

// ---------- יו"ט / ימי דפגרא / תשרי ----------
/** sections: [{ head, note, parts: [{ k: 'dots'|'strip'|'table'|'text', label, note, mins, rows }] }] · opt: { pasuk, psrc, title, cols } */
export function specialPage({ pasuk, psrc, title, sections, cols = 1 }, size = 'letter') {
  const note = (n) => (n ? `<span class="tp-note"> (${h(n)})</span>` : '');
  const part = (x) => {
    if (x.k === 'text') return `<div class="tp-txt">${h(x.label)}${note(x.note)}</div>`;
    if (x.k === 'dots') return `<div class="tp-dots"><span class="l">${h(x.label)}${note(x.note)}</span><span class="f"></span><span class="tp-num">${x.mins.map(tm).join(' • ')}</span></div>`;
    if (x.k === 'strip') return `<div class="tp-sub">${h(x.label)}${note(x.note)}:</div>${chunk(x.mins, Math.ceil(x.mins.length / Math.ceil(x.mins.length / 8))).map((c) => `<div class="tp-strip">${c.map((m) => `<div class="tp-num">${tm(m)}</div>`).join('')}</div>`).join('')}`;
    if (x.k === 'table') {
      const hasMeg = x.rows.some((r) => r.meg != null); const hasEz = x.rows.some((r) => r.ezras);
      // נאר שעה + חדר (חול המועד, סליחות): צוויי שפאלטן "5:30 ....... בביהמ"ד"
      if (!hasMeg && !hasEz) {
        const rb = x.rows.filter((r) => r.rebbe); const rest = x.rows.filter((r) => !r.rebbe);
        return `<div class="tp-sub">${h(x.label)}${note(x.note)}:</div>
          ${rb.map((r) => `<div class="tp-dots tp-rbrow"><span class="l"><span class="tp-num">${tm(r.min)}</span> מנין כ"ק אדמו"ר שליט"א</span><span class="f"></span><span>${h(r.room || '')}</span></div>`).join('')}
          <div class="tp-grid">${rest.map((r) => `<div class="tp-dots"><span class="l tp-num">${tm(r.min)}</span><span class="f"></span><span class="rm">${h(r.room || '')}</span></div>`).join('')}</div>`;
      }
      const span = 3 + (hasMeg ? 1 : 0);
      return `<div class="tp-sub">${h(x.label)}:</div><table class="tp-tbl"><tr><th class="lt" colspan="2">${h(x.note || '')}</th><th>${h(x.label)}</th>${hasMeg ? '<th>מגילה-בערך</th>' : ''}${hasEz ? '<th>עזרת נשים</th>' : ''}</tr>
        ${x.rows.map((r) => (r.rebbe
    ? `<tr><td class="rb" colspan="${span}">מנין כ"ק אדמו"ר שליט"א בשעה <span class="tp-num">${tm(r.min)}</span> ${h(r.room || '')}</td>${hasEz ? `<td>${r.ezras ? '✔' : ''}</td>` : ''}</tr>`
    : `<tr><td class="n">מנין ${h(r.name || '')}</td><td class="r">${h(r.room || '')}</td><td><span class="tp-num">${tm(r.min)}</span></td>${hasMeg ? `<td>${r.meg == null ? '' : `<span class="tp-num">${tm(r.meg)}</span>`}</td>` : ''}${hasEz ? `<td>${r.ezras ? '✔' : ''}</td>` : ''}</tr>`)).join('')}</table>`;
    }
    return '';
  };
  const sec = (s) => `<div class="tp-sec">${s.head ? `<div class="tp-head">${h(s.head)}${note(s.note)}</div>` : ''}${s.parts.map(part).join('')}</div>`;
  const inner = `<img class="tp-lh" src="img/print/letterhead.png" alt="">
    ${pasuk ? `<div class="tp-pasuk">"${h(pasuk)}"${psrc ? ` <small>(${h(psrc)})</small>` : ''}</div>` : ''}
    <div class="tp-title">${h(title)}</div>
    <div class="tp-body${cols > 1 ? ' tp-cols' : ''}">${sections.map(sec).join(cols > 1 ? '' : '<div class="tp-orn">❀ ❀ ❀</div>')}</div>
    <div class="tp-end">${cols > 1 ? 'כתיבה וחתימה טובה' : ''}</div>`;
  return page('tp-sp', size, inner);
}

// ---------- וואס מ'דרוקט: גרופעס פון בלאקן ----------
export const GROUPS = {
  yt: [['pesach', 'פסח', ['bedika', 'erevPesach', 'erevPesachShabbos', 'pesach1', 'pesach2', 'cholPesach', 'shabbosChm', 'shvii', 'acharon'], 'זמני המועד ותפילה', 'pesach'],
    ['shavuos', 'שבועות', ['shavuos'], 'זמני המועד ותפילה', 'yt']],
  minor: [['chanuka', 'חנוכה', ['chanuka'], 'זמני התפילה לימי החנוכה'], ['asaraTeves', 'עשרה בטבת', ['asaraTeves'], 'זמני התפילה לעשרה בטבת'],
    ['purim', 'פורים', ['taanisEsther', 'purim'], 'זמני התפילה לימי הפורים'],
    ['tamuz17', 'י"ז בתמוז', ['tamuz17'], 'זמני התפילה לי"ז בתמוז'], ['tishaBav', 'תשעה באב', ['tishaBav'], 'זמני התפילה לתשעה באב']],
  tishrei: [['tishrei', 'ימי הרחמים — תשרי', ['selichos1', 'selichos', 'shabSel', 'hilula', 'erevRH', 'rh1', 'rh2', 'gedalia', 'shuva', 'aseres', 'yud3', 'erevYK', 'yk', 'bein', 'shabBein', 'sukkos1', 'sukkos2', 'cholSukkos', 'shabChmS', 'hoshana', 'shmini', 'simchas'], 'לוח הזמנים לימי הרחמים והרצון הבעל"ט']],
};
const OWN = [['minchaEve', 'מנחה ערב'], ['maarivEve', 'מעריב ערב'], ['shacharis', 'שחרית'], ['mincha', 'מנחה'], ['maarivMid', 'מעריב'], ['maariv', 'מעריב מוצאי']];
const DOWN = ['יום א\'', 'יום ב\'', 'יום ג\'', 'יום ד\'', 'יום ה\'', 'יום ו\'', 'שבת'];
const hm = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
/** די טעג פון א שורה (ווי אין computeSpecial) */
function rowDays(r, ds) {
  if (r.on === 'all' || r.on == null) return ds;
  if (r.on === 'wed') return ds.filter((n) => dowOf(n) === 3);
  if (r.on === 'fri') return ds.filter((n) => dowOf(n) === 5);
  if (r.on === 'last') return [ds[ds.length - 1]];
  const i = Number(r.on);
  if (i < 0) return [ds[0] + i];
  return ds[i] != null ? [ds[i]] : [];
}
/** די חלקים פון א גרופע אין יאר Y: יעדער בלאק = א חלק */
export function buildSpecial(data, part, whens, Y, loc) {
  const blocks = (data[part]?.blocks || []).filter((b) => whens.includes(b.when)).sort((a, b) => whens.indexOf(a.when) - whens.indexOf(b.when));
  const out = []; let pasuk = ''; let psrc = '';
  for (const b of blocks) {
    const ds = daysOf(b.when, Y);
    if (!ds.length) continue;
    if (!pasuk && b.pasuk) { pasuk = b.pasuk; psrc = b.psrc || ''; }
    const parts = [];
    const kind = (label, note, mins) => ({ k: mins.length >= 5 ? 'strip' : 'dots', label, note, mins });
    // תפילות מיט אייגענע שעות (נישט "כמו ימות החול")
    if (b.like) {
      for (const [g, label] of OWN) {
        if (b.like[g] !== false || !(b.own?.[g] || []).length) continue;
        if (g === 'maarivMid' && ds.length < 2) continue;
        const day = /Eve$/.test(g) ? ds[0] - 1 : g === 'maariv' ? ds[ds.length - 1] : ds[0];
        const zd = dayZ(isoOf(day), loc);
        const mins = b.own[g].map((T) => timeOf(T, zd)).filter((m) => m != null).sort((x, y) => x - y);
        if (mins.length) parts.push(kind(label, '', mins));
      }
    }
    for (const r of b.rows || []) {
      const days = rowDays(r, ds);
      const per = days.map((n) => {
        const Ts = ((r.sat?.on && dowOf(n) === 6 ? r.sat.times : r.fri?.on && dowOf(n) === 5 ? r.fri.times : r.times) || []).filter(Boolean);
        const zd = dayZ(isoOf(n), loc);
        return { n, Ts, mins: Ts.map((T) => timeOf(T, zd)) };
      });
      if (!per.some((p) => p.mins.some((m) => m != null))) { if (r.kind !== 'tefila' || r.note) parts.push({ k: 'text', label: r.label, note: r.note }); continue; }
      // טעג מיט די זעלבע שעות — צוזאמען
      const grp = [];
      for (const p of per) { const key = p.mins.join(','); const g = grp.find((x) => x.key === key); if (g) g.days.push(p.n); else grp.push({ key, days: [p.n], p }); }
      for (const g of grp) {
        const base = g.days.every((n) => friMincha(data, n, r.label)) ? ((r.fri?.on && r.fri.label) || 'מנחה וקבלת שבת') : r.label;
        const label = grp.length > 1 ? `${base} - ${g.days.map((n) => DOWN[dowOf(n)]).join(', ')}` : base;
        if (r.table) {
          let k = 0; const L = 'אבגדהוזחטיכלמנ';
          const rows = g.p.Ts.map((T, i) => ({ min: g.p.mins[i], room: T.room || '', meg: hm(T.meg), ezras: !!T.ez, rebbe: !!T.rb })).filter((x) => x.min != null)
            .sort((x, y) => x.min - y.min).map((x) => (x.rebbe ? x : { ...x, name: `${L[k++] || ''}'` }));
          parts.push({ k: 'table', label, note: r.note, rows });
        } else parts.push(kind(label, r.note, g.p.mins.filter((m) => m != null)));
      }
    }
    // שולחן הטהור ודרשות אין די טעג
    for (const e of eventsBetween(data, ds[0] - 1, ds[ds.length - 1], loc)) {
      const rs = e.rows.filter((r) => ds.includes(r.day) || (r.day === ds[0] - 1 && e.n === ds[0]));
      if (rs.length) parts.push(kind(e.ev.title || rs[0].label, rs.map((r) => r.label).filter((x) => x && x !== e.ev.title).join(', '), rs.map((r) => r.min)));
    }
    if (parts.length) out.push({ head: b.title, parts, n: ds[0], days: ds, when: b.when });
  }
  return { sections: out, pasuk, psrc };
}
export const tmPrint = tm;

/** מאכט די שריפט אזוי גרויס ווי עס גייט אריין אינעם בלאט (נאכן אריינשטעלן אין DOM) */
export function fitPages(root, max = 26, min = 9) {
  root.querySelectorAll('.tp-page').forEach((pg) => {
    const box = pg.querySelector('.tp-in');
    const over = () => {
      if (box.scrollHeight > box.clientHeight + 1) return true;
      const R = box.getBoundingClientRect(); const k = R.height / (box.offsetHeight || 1);
      const limit = R.bottom - (parseFloat(getComputedStyle(box).paddingBottom) || 0) * k + 1;
      if ([...box.querySelectorAll('.tp-in > *, .tp-sec, .tp-dots, .tp-line, .tp-tbl, .tp-shab, .tp-strip, .tp-txt')].some((e) => e.getBoundingClientRect().bottom > limit)) return true;
      return [...box.querySelectorAll('.tp-line, .tp-shab, .tp-dots, .tp-strip, .tp-tbl, .tp-title, .tp-rbl')].some((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > box.getBoundingClientRect().right + 1);
    };
    let fs = max; box.style.setProperty('--fs', `${fs}px`);
    while (fs > min && over()) { fs -= 0.5; box.style.setProperty('--fs', `${fs}px`); }
  });
}
