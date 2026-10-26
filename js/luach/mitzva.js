// לוח מצוה יומית — צוויי ארטן: וועכנטליך (פון פרייטאג, ווי אינעם גליון) און א גאנצער חודש.
// הדפסה / PDF, און א JPG פארן גליון.
import { buildYear, mitzvaYomis, isoOf, nOf, dowOf, hdOf } from './engine.js';
import { hebrewNumber, todayIso } from '../hebdate.js';
import { escapeHtml as h } from '../util.js';
import { htmlToJpeg } from '../pdf.js';

const $ = (s, r = document) => r.querySelector(s);
const MONTH = { Tishri: 'תשרי', Heshvan: 'מרחשון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט', Adar: 'אדר', 'Adar I': 'אדר א\'', 'Adar II': 'אדר ב\'', Nisan: 'ניסן', Iyar: 'אייר', Sivan: 'סיון', Tamuz: 'תמוז', Av: 'מנחם אב', Elul: 'אלול' };
const DAY = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'ערב שבת', 'שבת קודש'];
const hnum = (n) => { const s = hebrewNumber(n); return s; };
const dateHe = (n) => { const x = hdOf(n); return `${hnum(x.d)} ${MONTH[x.m] || x.m}`; };

// וואס איז א טאג (פרשה / יו"ט) — פונעם לוח (בארא פארק)
const yearCache = new Map();
function dayOf(n) {
  const Y = hdOf(n).y;
  for (const y of [Y, Y + 1]) {
    if (!yearCache.has(y)) yearCache.set(y, buildYear(y));
    const d = yearCache.get(y).days.find((x) => x.n === n);
    if (d) return d;
  }
  return null;
}
function shabbosName(n) {
  const d = dayOf(n);
  if (!d) return '';
  if (d.parsha) return `פרשת ${d.parsha}`;
  const hol = d.items.find((x) => x.kind === 'hol');
  return hol ? hol.text : '';
}

let view = 'week'; let anchor = null; // week: n פון פרייטאג; month: { Y, ix }
let back = () => {};

function weekStart(n) { let s = n; while (dowOf(s) !== 5) s -= 1; return s; }

const CSS = `
.mz-card{direction:rtl;background:transparent;padding:0;box-sizing:border-box;font-family:'Guttman David','David','Frank Ruehl',serif;color:#111}
.mz-title{text-align:center;font-family:'Livorna','FontbitLivorna',serif;font-weight:700;font-size:24px;margin:2px 0 6px}
.mz-sub{text-align:center;font-family:'Livorna','FontbitLivorna',serif;font-weight:700;font-size:16px;margin:-4px 0 8px}
.mz-par{text-align:center;font-family:'Livorna','FontbitLivorna',serif;font-weight:700;font-size:19px;margin:8px 0 5px;border-top:2px solid #111;padding-top:5px}
.mz-day{display:flex;justify-content:space-between;align-items:center;background:#111;color:#fff;font-family:'Livorna','FontbitLivorna',serif;font-weight:700;font-size:13.5px;padding:2px 6px;margin-top:3px}
.mz-row{display:flex;gap:6px;align-items:baseline;border-bottom:1px solid #8a8780;padding:2px 6px;font-family:'Guttman David','David',serif;font-size:13.5px;white-space:nowrap;overflow:hidden}
.mz-n{font-weight:700;min-width:50px}
.mz-t{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis}
.mz-week .mz-title{font-size:22px;margin:0 0 3px;line-height:1.1}
.mz-week .mz-day{font-size:17px;padding:1px 6px;margin-top:2px;line-height:1.2}
.mz-week .mz-day span:last-child{font-size:18px}
.mz-week .mz-row{font-size:14px;padding:1px 6px;line-height:1.25}
.mz-week .mz-par{font-size:20px;margin:5px 0 2px;padding-top:3px;line-height:1.15}
.mz-month{width:528px;height:816px;padding:24px 22px;box-sizing:border-box;display:flex;flex-direction:column}
.mz-month .mz-title{font-size:24px;margin-bottom:14px;white-space:nowrap;color:#111}
.mz-month .mz-sub{font-size:18px;margin:0 0 14px}
.mz-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-content:start}
.mz-month .mz-par{background:linear-gradient(90deg,#1e1e1e,#5c5c5c,#1e1e1e);color:#fff;border:none;font-size:16px;margin:12px 0 3px;padding:4px 0}
.mz-month .mz-par:first-child{margin-top:0}
.mz-ln{display:flex;align-items:center;gap:8px;padding:3px 2px;border-bottom:1px solid #111;white-space:nowrap}
.mz-ln:last-child{border-bottom:none}
.mz-dd{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:34px;padding-left:8px;border-left:1.5px solid #111;line-height:1.05}
.mz-dd b{font-family:'Livorna','FontbitLivorna',serif;font-weight:700;font-size:17px;color:#111}
.mz-dd small{font-family:'Livorna','FontbitLivorna',serif;font-size:10px;color:#111}
.mz-ln.mz-shb .mz-dd b,.mz-ln.mz-shb .mz-dd small{color:#111;font-weight:700}
.mz-mm{display:flex;align-items:center;gap:7px;flex:1;min-width:0;font-family:'Guttman David','David',serif;font-size:14px}
.mz-mm i{font-style:normal;font-family:'Livorna','FontbitLivorna',serif;font-weight:700;font-size:19px;min-width:42px;padding:0 4px;box-sizing:border-box;border:1.3px solid #111;display:flex;align-items:center;justify-content:center;color:#111;line-height:1.15}
.mz-mm span{overflow:hidden;text-overflow:ellipsis;color:#111}
.mz-ln.mz-shb .mz-mm span{font-weight:700}
`;

function weekHtml(fri) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => fri + i);
  const row = (n) => {
    const m = mitzvaYomis(isoOf(n)); const dw = dowOf(n);
    return `<div class="mz-day"><span>${DAY[dw]}:</span><span>${h(dateHe(n))}</span></div>
      <div class="mz-row"><span class="mz-n">מצוה ${h(m.num)}.</span><span class="mz-t">${h(m.text)}</span></div>`;
  };
  return `<div class="mz-card mz-week" style="width:240px">
    <div class="mz-title">לימוד מצוה יומית</div>
    ${row(days[0])}${row(days[1])}
    <div class="mz-par">${h(shabbosName(fri + 8))}</div>
    ${days.slice(2).map(row).join('')}
  </div>`;
}

const SHORT = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש"ק'];
function block(n) {
  const m = mitzvaYomis(isoOf(n)); const dw = dowOf(n);
  const x = hdOf(n);
  return `<div class="mz-ln${dw === 6 ? ' mz-shb' : ''}"><span class="mz-dd"><b>${h(hnum(x.d))}</b><small>${dw === 6 ? 'שבת' : `יום ${SHORT[dw]}`}</small></span>
    <span class="mz-mm"><i>${h(m.num)}</i><span>${h(m.text)}</span></span></div>`;
}
function monthHtml(page) {
  // וואכן (פון זונטאג), יעדע וואך מיט דער פרשה; צוויי טורים — צעטיילט לויט וואכן, אזוי גלייך ווי מעגליך
  const weeks = [];
  page.monthDays.forEach((d) => { if (!weeks.length || d.dow === 0) weeks.push([]); weeks[weeks.length - 1].push(d.n); });
  const total = page.monthDays.length; let acc = 0; let cut = weeks.length;
  for (let i = 0; i < weeks.length; i += 1) { if (acc + weeks[i].length / 2 >= total / 2) { cut = i + (acc + weeks[i].length - total / 2 < total / 2 - acc ? 1 : 0); break; } acc += weeks[i].length; }
  if (cut < 1) cut = 1;
  const col = (ws) => ws.map((w) => {
    let s = w[0]; while (dowOf(s) !== 6) s += 1;
    return `<div class="mz-par">${h(shabbosName(s))}</div>${w.map(block).join('')}`;
  }).join('');
  return `<div class="mz-card mz-month">
    <div class="mz-title">לימוד מצוה יומית - חודש ${h(MONTH[page.key] || page.he)} ${h(hebrewNumber(page.Y % 1000))}</div>
    <div class="mz-cols"><div>${col(weeks.slice(0, cut))}</div><div>${col(weeks.slice(cut))}</div></div>
  </div>`;
}

function current() {
  if (view === 'week') return weekHtml(anchor);
  const pg = buildYear(anchor.Y).pages[anchor.ix];
  return monthHtml(pg);
}

export function openMitzva(main, onBack) {
  back = onBack || back;
  if (anchor == null) anchor = weekStart(nOf(todayIso()));
  render(main);
}

function monthAnchorFor(n) {
  const Y = hdOf(n).y; const b = buildYear(Y);
  const ix = Math.max(0, b.pages.findIndex((p) => p.monthDays.some((d) => d.n === n)));
  return { Y, ix };
}

function render(main) {
  const label = view === 'week'
    ? `${dateHe(anchor)} – ${dateHe(anchor + 6)}`
    : (() => { const p = buildYear(anchor.Y).pages[anchor.ix]; return `${MONTH[p.key] || p.he} ${hebrewNumber(anchor.Y % 1000)}`; })();
  main.innerHTML = `<style>${CSS}</style>
    <div class="lx-bar">
      <button type="button" class="btn ghost" id="mz-back">← זמנים ולוחות</button>
      <div class="lang-switch"><button type="button" data-v="week" class="${view === 'week' ? 'on' : ''}">שבועי</button><button type="button" data-v="month" class="${view === 'month' ? 'on' : ''}">חודשי</button></div>
      <button type="button" class="btn" id="mz-prev">‹ הקודם</button>
      <b class="lx-title">${h(label)}</b>
      <button type="button" class="btn" id="mz-next">הבא ›</button>
      <span class="spacer"></span>
      <button type="button" class="btn" id="mz-jpg" title="רקע שקוף — להכניס לכל עיצוב">⬇ תמונה שקופה (PNG)</button>
      <button type="button" class="btn primary" id="mz-print">🖨 הדפסה / PDF</button>
    </div>
    <div class="mz-stage" style="display:flex;justify-content:center;padding:14px 0">${current()}</div>`;
  $('#mz-back', main).onclick = () => back();
  main.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => {
    const v = b.dataset.v; if (v === view) return;
    const n = view === 'week' ? anchor : buildYear(anchor.Y).pages[anchor.ix].monthDays[0].n;
    view = v; anchor = v === 'week' ? weekStart(n) : monthAnchorFor(n + (view === 'month' ? 1 : 0));
    render(main);
  }; });
  const step = (dir) => {
    if (view === 'week') anchor += dir * 7;
    else {
      const b = buildYear(anchor.Y); let ix = anchor.ix + dir; let Y = anchor.Y;
      if (ix < 0) { Y -= 1; ix = buildYear(Y).pages.length - 1; } else if (ix >= b.pages.length) { Y += 1; ix = 0; }
      anchor = { Y, ix };
    }
    render(main);
  };
  $('#mz-prev', main).onclick = () => step(-1);
  $('#mz-next', main).onclick = () => step(1);
  $('#mz-print', main).onclick = () => printIt();
  $('#mz-jpg', main).onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const card = $('.mz-card', main); const r = card.getBoundingClientRect();
      const { dataUrl } = await htmlToJpeg(`<style>${CSS}</style>${card.outerHTML}`, { widthIn: r.width / 96, heightIn: r.height / 96, scale: 4, png: true });
      const a = document.createElement('a'); a.href = dataUrl; a.download = `מצוה יומית - ${label}.png`; a.click();
    } finally { btn.disabled = false; }
  };
}

function printIt() {
  const card = document.querySelector('.mz-card'); if (!card) return;
  const r = card.getBoundingClientRect();
  let area = $('#mz-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'mz-print-area'; document.body.append(area); }
  area.innerHTML = `<style>${CSS}</style>${card.outerHTML}`;
  const st = document.createElement('style');
  st.textContent = `@page{size:${Math.ceil(r.width)}px ${Math.ceil(r.height)}px;margin:0}
    @media print{body.printing-mz>*:not(#mz-print-area){display:none!important}body.printing-mz #mz-print-area{display:block}
    #mz-print-area .mz-card{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    #mz-print-area{display:none}`;
  document.head.append(st);
  document.body.classList.add('printing-mz');
  const done = () => { document.body.classList.remove('printing-mz'); st.remove(); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 150);
}
