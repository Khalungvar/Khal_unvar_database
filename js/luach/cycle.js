// לוח מצוה יומית לפי מחזור — א קליין ביכל (153×198pt, 24 עמודים) מיט אלע 613 טעג פונעם מחזור:
// שער, טבלה (יום · דאטום · מצוה), סוף מיט דעם לאגא, און די הינטערשטע זייט. דרוקן = "Save as PDF" (וועקטאר).
import { buildYear, isoOf, nOf, dowOf, hdOf } from './engine.js';
import { MITZVOS, MITZVA_ANCHOR } from './mitzvos.js';
import { MONTH } from './mitzva.js';
import { loadData, setting, saveSetting, richLines } from './booklet.js';
import { hebrewNumber, todayIso } from '../hebdate.js';
import { state } from '../data.js';
import { escapeHtml as h } from '../util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// מחזור מ' הייבט אן כ"א מנחם אב תשפ"ו (מצוה א)
const C40 = nOf(MITZVA_ANCHOR.iso) - (MITZVA_ANCHOR.n - 1);
const startOf = (k) => C40 + (k - 40) * 613;
export const currentCycle = () => 40 + Math.floor((nOf(todayIso()) - C40) / 613);

const DOW = ['זונטאג', 'מאנטאג', 'דינסטאג', 'מיטוואך', 'דאנערשטאג', 'פרייטאג', 'שב"ק'];
const MON = { ...MONTH, Av: 'מנחם-אב' };
const plain = (n) => hebrewNumber(n).replace(/["']/g, '');
const yShort = (y) => hebrewNumber(y % 100 || 100);
const dateLong = (n) => { const x = hdOf(n); return `${hebrewNumber(x.d)} ${MONTH[x.m] || x.m} ${hebrewNumber(x.y % 1000)}`; };

const yc = new Map();
function dayInfo(n) {
  const Y = hdOf(n).y;
  for (const y of [Y, Y + 1]) {
    if (!yc.has(y)) yc.set(y, buildYear(y));
    const d = yc.get(y).days.find((x) => x.n === n);
    if (d) return d;
  }
  return null;
}

function rows(k) {
  const s = startOf(k);
  return MITZVOS.map((text, i) => {
    const n = s + i; const x = hdOf(n); const dw = dowOf(n);
    let wd = DOW[dw];
    if (dw === 6) {
      const d = dayInfo(n);
      const par = d?.parsha || d?.items.find((it) => it.kind === 'hol')?.text || '';
      if (par) wd = `ש"ק ${par}`;
    }
    return { i, n, dw, wd, d: hebrewNumber(x.d).replace(/["']/g, ''), m: MON[x.m] || x.m, y: yShort(x.y), first: x.d === 1, num: plain(i + 1), text };
  });
}

// ---------- אויסשטעלונג ----------
// עמ' 2: 10 שורות (אויבן א טעקסט), עמ' 3–22: 30/29 שורות, עמ' 23: 11 שורות + לאגא, עמ' 24: הינטן
function split(all) {
  const pages = [all.slice(0, 10)]; let p = 10;
  for (let i = 0; i < 20; i += 1) { const c = i < 12 ? 30 : 29; pages.push(all.slice(p, p + c)); p += c; }
  pages.push(all.slice(p));
  return pages;
}

const IMG = (f) => `img/cycle/${f}?v=1`;
const CSS = `
.cy-pg{position:relative;width:204px;height:264px;overflow:hidden;direction:rtl;background:#fff;color:#111;font-family:'PFT_Vilna','Frank Ruhl Libre',serif;box-sizing:border-box}
.cy-pg>img.cy-bg{position:absolute;left:-9.45px;top:-9.45px;width:222.9px;height:288.45px}
.cy-pg>img.cy-full{position:absolute;inset:0;width:100%;height:100%}
.cy-frame{position:absolute;right:15.5px;width:170.3px;top:19.5px;border:.67px solid #cc9966;background:#fff;box-sizing:border-box}
.cy-t{width:100%;border-collapse:collapse;table-layout:fixed}
.cy-t td,.cy-t th{height:7.11px;padding:0 1.2px;line-height:7.11px;white-space:nowrap;overflow:hidden;vertical-align:middle}
.cy-t th{background:#8db3e2;color:#123;font-family:'PFT_Vilna Bold','PFT_Vilna',serif;font-weight:700;font-size:5.6px;text-align:right}
.cy-t th.cy-hm{text-align:center}
.cy-t tr:nth-child(even) td{background:#e6f2fb}
.cy-t td.cy-w{font-size:3.9px;color:#333;width:25px}
.cy-t td.cy-d{font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:6.9px;width:8px;text-align:center}
.cy-t td.cy-m{font-size:5.1px;width:24px}
.cy-t td.cy-m small{font-size:3.3px;color:#555}
.cy-t td.cy-n{font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:6.6px;width:13px}
.cy-t td.cy-x{font-family:'PFT_Vilna','Frank Ruhl Libre',serif;font-size:6.1px}
.cy-t td span.cy-s{display:inline-block;transform-origin:right center}
.cy-t tr.cy-sh td{background:#cfe3f4!important;font-weight:700}
.cy-t tr.cy-sh td.cy-w{color:#0d2f57;font-size:3.7px}
.cy-t tr.cy-sh td.cy-x{font-family:'PFT_Vilna Bold','PFT_Vilna',serif}
.cy-t tr.cy-new td{border-top:.6px solid #cc9966}
.cy-top{position:absolute;right:20px;width:164px;top:22px;height:98px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cy-top .bk-fit,.cy-end .bk-fit{font-size:7px}
.cy-end{position:absolute;right:20px;width:164px;display:flex;flex-direction:column;align-items:center;text-align:center}
.cy-end img{width:92px}
.cy-pn{position:absolute;bottom:6.5px;left:0;right:0;text-align:center;font-family:'Livorna','Frank Ruhl Libre',serif;font-size:5.5px;color:#8a6a45}
.cy-cov{position:absolute;left:0;right:0;top:170px;text-align:center;color:#efe4cf;text-shadow:0 1px 1.5px #000,0 0 3px #000}
.cy-cov b{display:block;font-family:'EFT_Devash Heavy','Livorna Bold','Livorna',serif;font-weight:700;font-size:24px;line-height:1.1}
.cy-cov span{display:block;font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:10.5px;line-height:1.35}
.cy-l{font-family:inherit}
.cy-wrap{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;padding:12px 0}
.cy-th{display:flex;flex-direction:column;align-items:center;gap:4px}
.cy-sc{width:306px;height:396px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.25)}
.cy-sc>.cy-pg{transform:scale(1.5);transform-origin:top right}
.cy-th b{font-size:12px}
.cy-bar2{display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:1100px;margin:0 auto 4px}
`;

const tableHtml = (rs) => `<table class="cy-t"><colgroup><col style="width:24.7px"><col style="width:9.3px"><col style="width:25.7px"><col style="width:13.5px"><col></colgroup>
  <tr><th colspan="2">יום</th><th class="cy-hm"></th><th colspan="2">מצוה</th></tr>
  ${rs.map((r) => `<tr class="${r.dw === 6 ? 'cy-sh' : ''}${r.first ? ' cy-new' : ''}"><td class="cy-w"><span class="cy-s">${h(r.wd)}</span></td><td class="cy-d">${h(r.d)}</td>
    <td class="cy-m">${h(r.m)} <small>(${h(r.y)})</small></td><td class="cy-n">${h(r.num)}</td><td class="cy-x"><span class="cy-s">${h(r.text)}</span></td></tr>`).join('')}</table>`;

function pagesHtml(k) {
  const all = rows(k); const parts = split(all);
  const s = startOf(k);
  const pg = (inner, cls = '') => `<div class="cy-pg ${cls}">${inner}</div>`;
  const bg = `<img class="cy-bg" src="${IMG('bg.jpg')}" alt="">`;
  const pn = (i) => `<div class="cy-pn">${h(plain(i))}</div>`;
  const out = [];
  out.push(pg(`<img class="cy-full" src="${IMG('cover.jpg')}" alt=""><div class="cy-cov"><b>מחזור ${h(hebrewNumber(k))}</b>
    <span>${h(dateLong(s))}</span><span>${h(dateLong(s + 612))}</span></div>`));
  out.push(pg(`${bg}<div class="cy-top"><div class="bk-fit">${richLines(setting('cycle_p2_text') || DEF_P2)}</div></div>
    <div class="cy-frame" style="top:124px">${tableHtml(parts[0])}</div>${pn(2)}`));
  parts.slice(1, 21).forEach((rs, i) => out.push(pg(`${bg}<div class="cy-frame">${tableHtml(rs)}</div>${pn(i + 3)}`)));
  const last = parts[21];
  const endTop = 19.5 + (last.length + 1) * 7.11 + 12;
  out.push(pg(`${bg}<div class="cy-frame">${tableHtml(last)}</div>
    <div class="cy-end" style="top:${endTop}px;height:${240 - endTop}px;justify-content:center"><img src="${IMG('logo.png')}" alt=""><div class="bk-fit">${richLines(setting('cycle_end_text') || DEF_END)}</div></div>${pn(23)}`));
  out.push(pg(`<img class="cy-full" src="${IMG('back.jpg')}" alt="">`));
  return out;
}
const DEF_P2 = '~ בס"ד\n## סדר לימוד מצוה יומית\n~ מצוה אחת בכל יום, כסדר הסמ"ק\n~ בספר "מצות המלך" עם פירוש\n~ כ"ק מרן אדמו"ר בעל משנה הלכות זצוקללה"ה';
const DEF_END = '## מפעל מצוה יומית\n## 605-477-4427\nMitzvahYomis@gmail.com';

/** שמאלער מאכן (scaleX) א טעקסט וואס איז צו לאנג פאר זיין קעסטל */
function squeeze(root) {
  $$('.cy-s', root).forEach((s) => {
    s.style.transform = '';
    const td = s.parentElement; const w = td.clientWidth - 2.4; const sw = s.scrollWidth;
    if (sw > w && w > 0) s.style.transform = `scaleX(${(w / sw).toFixed(3)})`;
  });
  $$('.bk-fit', root).forEach((el) => {
    const box = el.parentElement; let px = 7;
    el.style.fontSize = `${px}px`;
    while ((el.scrollHeight > box.clientHeight - 2 || el.scrollWidth > box.clientWidth) && px > 3) { px -= 0.25; el.style.fontSize = `${px}px`; }
  });
}

let cycle = null;
let onView = null;
let back = () => {};

export async function openCycle(main, onBack, opts = {}) {
  back = onBack || back; onView = opts.onView || null;
  if (cycle == null) cycle = currentCycle();
  main.innerHTML = '<p class="muted">…</p>';
  try { await loadData(); } catch { /* טעקסטן — ברירת מחדל */ }
  render(main);
}

function render(main) {
  const s = startOf(cycle);
  const pages = pagesHtml(cycle);
  const opts = []; for (let k = currentCycle() - 2; k <= currentCycle() + 5; k += 1) opts.push(k);
  main.innerHTML = `<style>${CSS}</style>
    <div class="lx-bar">
      <button type="button" class="btn ghost" id="cy-back">← זמנים ולוחות</button>
      ${onView ? '<div class="lang-switch"><button type="button" data-v="week">שבועי</button><button type="button" data-v="month">חודשי</button><button type="button" data-v="booklet">חוברת</button><button type="button" class="on">לוח מחזור</button></div>' : ''}
      <button type="button" class="btn" id="cy-prev">‹ הקודם</button>
      <select id="cy-sel">${opts.map((k) => `<option value="${k}"${k === cycle ? ' selected' : ''}>מחזור ${h(hebrewNumber(k))}${k === currentCycle() ? ' (הנוכחי)' : ''}</option>`).join('')}</select>
      <button type="button" class="btn" id="cy-next">הבא ›</button>
      <span class="spacer"></span>
      ${state.isAdmin ? '<button type="button" class="btn ghost" id="cy-txt">✏ טקסטים</button>' : ''}
      <button type="button" class="btn primary" id="cy-print">🖨 הדפסה / PDF</button>
    </div>
    <p class="cy-bar2 muted small">מחזור ${h(hebrewNumber(cycle))}: ${h(dateLong(s))} (${h(isoOf(s))}) — ${h(dateLong(s + 612))} (${h(isoOf(s + 612))}) · 24 עמודים, 2.125×2.75 אינץ'.
      בחלון ההדפסה: "Save as PDF", שוליים "ללא", וסמן "גרפיקת רקע".</p>
    <div class="cy-wrap">${pages.map((p, i) => `<div class="cy-th"><div class="cy-sc">${p}</div><b>${i + 1}</b></div>`).join('')}</div>`;
  const doSqueeze = () => squeeze(main);
  requestAnimationFrame(doSqueeze); setTimeout(doSqueeze, 700);
  document.fonts?.ready.then(doSqueeze);
  $('#cy-back', main).onclick = () => back();
  $$('[data-v]', main).forEach((x) => { x.onclick = () => onView?.(x.dataset.v); });
  $('#cy-prev', main).onclick = () => { cycle -= 1; render(main); };
  $('#cy-next', main).onclick = () => { cycle += 1; render(main); };
  $('#cy-sel', main).onchange = (e) => { cycle = Number(e.target.value); render(main); };
  $('#cy-print', main).onclick = () => printIt(main);
  const tx = $('#cy-txt', main); if (tx) tx.onclick = () => textDialog(main);
}

function printIt(main) {
  squeeze(main);
  let area = $('#cy-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'cy-print-area'; document.body.append(area); }
  area.innerHTML = `<style>${CSS}</style>${$$('.cy-sc > .cy-pg', main).map((p) => p.outerHTML).join('')}`;
  const st = document.createElement('style');
  st.textContent = `@page{size:153pt 198pt;margin:0}
    @media print{body.printing-cy>*:not(#cy-print-area){display:none!important}body.printing-cy #cy-print-area{display:block}
      #cy-print-area .cy-pg{break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    #cy-print-area{display:none}`;
  document.head.append(st);
  document.body.classList.add('printing-cy');
  const done = () => { document.body.classList.remove('printing-cy'); st.remove(); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 200);
}

function textDialog(main) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg bk-form'; dlg.dir = 'rtl';
  dlg.innerHTML = `<button type="button" class="x-close">✕</button><h3>✏ טקסטים בלוח המחזור</h3>
    <p class="muted small">סימנים בתחילת שורה: <b>#</b> רווח = גדול מאוד · <b>##</b> רווח = גדול ומודגש · <b>~</b> רווח = קטן · <b>---</b> = קו.</p>
    <label>עמוד 2 — למעלה</label><textarea name="p2" rows="6" style="width:100%">${h(setting('cycle_p2_text') || DEF_P2)}</textarea>
    <label>עמוד 23 — מתחת ללוגו</label><textarea name="end" rows="4" style="width:100%">${h(setting('cycle_end_text') || DEF_END)}</textarea>
    <p style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn primary" data-a="save">שמירה</button><button type="button" class="btn ghost" data-a="cancel">ביטול</button></p>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.x-close', dlg).onclick = close; $('[data-a=cancel]', dlg).onclick = close;
  $('[data-a=save]', dlg).onclick = async (e) => {
    e.target.disabled = true;
    try { await saveSetting('cycle_p2_text', $('[name=p2]', dlg).value); await saveSetting('cycle_end_text', $('[name=end]', dlg).value); close(); render(main); } catch (err) { e.target.disabled = false; alert(err.message || err); }
  };
}
