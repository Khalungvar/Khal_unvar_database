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
.mz-title{text-align:center;font-weight:700;font-size:22px;margin:2px 0 6px;letter-spacing:.3px}
.mz-sub{text-align:center;font-weight:700;font-size:15px;margin:-4px 0 6px}
.mz-par{text-align:center;font-weight:700;font-size:19px;margin:8px 0 5px;border-top:2px solid #2b2b2b;padding-top:5px}
.mz-day{display:flex;justify-content:space-between;align-items:center;background:#111;color:#fff;font-weight:700;font-size:13.5px;padding:2px 6px;margin-top:3px}
.mz-day.mz-sh{background:#4a3b1f}
.mz-row{display:flex;gap:6px;align-items:baseline;border-bottom:1px solid #8a8780;padding:2px 6px;font-size:13.5px;white-space:nowrap;overflow:hidden}
.mz-n{font-weight:700;min-width:52px}
.mz-t{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis}
.mz-month .mz-line{display:flex;align-items:center;gap:6px;border-bottom:1px solid #8a8780;padding:2px 4px;font-size:12.5px;white-space:nowrap}
.mz-month .mz-line.mz-shl{font-weight:700;border-bottom:1.5px solid #111}
.mz-month .mz-d{min-width:62px;font-weight:700}
.mz-month .mz-dt{min-width:72px}
.mz-month .mz-n{min-width:44px}
.mz-month .mz-t{text-align:right}
.mz-month .mz-par{font-size:15px;margin:5px 0 2px;padding-top:3px;border-top:1.5px solid #2b2b2b}
`;

function weekHtml(fri) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => fri + i);
  const row = (n) => {
    const m = mitzvaYomis(isoOf(n)); const dw = dowOf(n);
    return `<div class="mz-day${dw >= 5 ? ' mz-sh' : ''}"><span>${DAY[dw]}:</span><span>${h(dateHe(n))}</span></div>
      <div class="mz-row"><span class="mz-n">מצוה ${h(m.num)}.</span><span class="mz-t">${h(m.text)}</span></div>`;
  };
  return `<div class="mz-card mz-week" style="width:240px">
    <div class="mz-title">לימוד מצוה יומית</div>
    ${row(days[0])}${row(days[1])}
    <div class="mz-par">${h(shabbosName(fri + 8))}</div>
    ${days.slice(2).map(row).join('')}
  </div>`;
}

function monthHtml(page) {
  const lines = [];
  let lastPar = '';
  page.monthDays.forEach((d) => {
    if (d.dow === 0 || !lines.length) {
      let s = d.n; while (dowOf(s) !== 6) s += 1;
      const p = shabbosName(s);
      if (p && p !== lastPar) { lines.push(`<div class="mz-par">${h(p)}</div>`); lastPar = p; }
    }
    const m = mitzvaYomis(d.iso);
    lines.push(`<div class="mz-line${d.dow === 6 ? ' mz-shl' : ''}"><span class="mz-d">${DAY[d.dow]}</span><span class="mz-dt">${h(dateHe(d.n))}</span>
      <span class="mz-n">מצוה ${h(m.num)}.</span><span class="mz-t">${h(m.text)}</span></div>`);
  });
  return `<div class="mz-card mz-month" style="width:500px">
    <div class="mz-title">לימוד מצוה יומית</div>
    <div class="mz-sub">חודש ${h(MONTH[page.key] || page.he)} ${h(hebrewNumber(page.Y % 1000))}</div>
    ${lines.join('')}
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
    <div class="mz-stage" style="display:flex;justify-content:center;padding:14px 0;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px">${current()}</div>`;
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
