// לוח מצוה יומית לפי מחזור — א קליין ביכל (153×198pt, ~24 עמודים, יעדער עמוד א חודש) מיט אלע 613 טעג פונעם מחזור:
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
const monName = (m) => (m === 'Av' ? 'מנחם-אב' : MONTH[m] || m); // (לייזי — MONTH קומט פון א צירקולערן אימפארט)
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
    return { i, n, dw, wd, d: hebrewNumber(x.d).replace(/["']/g, ''), m: monName(x.m), y: yShort(x.y), first: x.d === 1, num: plain(i + 1), text };
  });
}

// ---------- אויסשטעלונג ----------
// עמ' 2: 10 שורות (אויבן א טעקסט), עמ' 3–22: 30/29 שורות, עמ' 23: 11 שורות + לאגא, עמ' 24: הינטן
// יעדער עמוד = א חודש (ווי אינעם אריגינאל): דער ערשטער (טיילווייזער) חודש אויף עמ' 2 אונטער דעם טעקסט,
// דער לעצטער חודש מיט דעם לאגא אונטן (אויב ס'איז דא ארט; אנדערש א באזונדער עמוד)
function split(all) {
  const months = [];
  all.forEach((r, i) => { if (i === 0 || r.first) months.push([]); months[months.length - 1].push(r); });
  return months;
}

const IMG = (f) => `img/cycle/${f}?v=1`;
const CSS = `
.cy-pg{position:relative;width:204px;height:264px;overflow:hidden;direction:rtl;background:#fff;color:#111;font-family:'PFT_Vilna','Frank Ruhl Libre',serif;box-sizing:border-box}
.cy-pg>img.cy-bg{position:absolute;left:-9.45px;top:-9.45px;width:222.9px;height:288.45px}
.cy-pg>img.cy-full{position:absolute;inset:0;width:100%;height:100%}
.cy-frame{position:absolute;right:15.5px;width:170.3px;top:19.5px;border:.67px solid #cc9966;background:#fff;box-sizing:border-box}
.cy-t{display:block}
.cy-r{display:flex;align-items:center;height:7.11px;overflow:hidden;white-space:nowrap}
.cy-r:nth-child(odd){background:#e6f2fb}
.cy-r>span{display:block;overflow:hidden;padding:0 1px;box-sizing:border-box;line-height:7.11px}
.cy-r .cy-w{width:24.7px;font-size:3.9px;color:#333}
.cy-r .cy-d{width:9.3px;font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:6.9px;text-align:center}
.cy-r .cy-m{width:25.7px;font-size:5.1px}
.cy-r .cy-m small{font-size:3.3px;color:#555}
.cy-r .cy-n{width:13.5px;font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:6.6px}
.cy-r .cy-x{flex:1;min-width:0;font-size:6.1px}
.cy-r span.cy-s{display:inline-block;transform-origin:right center;padding:0}
.cy-r.cy-h{background:#8db3e2!important;color:#123;font-family:'PFT_Vilna Bold','PFT_Vilna',serif;font-weight:700}
.cy-r.cy-h>span{font-size:5.6px;color:#123}
.cy-r.cy-sh{background:#cfe3f4!important}
.cy-r.cy-sh .cy-w{color:#0d2f57;font-weight:700;font-size:3.7px}
.cy-r.cy-sh .cy-x{font-family:'PFT_Vilna Bold','PFT_Vilna',serif;font-weight:700}
.cy-r.cy-new{box-shadow:inset 0 .6px 0 #cc9966}
.bk-l{font-size:1em;line-height:1.3}.bk-l1{font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:1.75em;line-height:1.15}
.bk-l2{font-family:'Livorna Bold','Livorna',serif;font-weight:700;font-size:1.3em;line-height:1.25}.bk-l3{font-size:.85em}
.bk-lat{font-family:Georgia,'Times New Roman',serif}.bk-hr{width:60%;border-top:.6px solid #cc9966;margin:3px auto}.bk-sp{height:3px}
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

const RH = 7.11; // הייך פון א שורה (px) = 5.33pt ווי אין אריגינאל
const rowHtml = (r) => `<div class="cy-r${r.dw === 6 ? ' cy-sh' : ''}${r.first ? ' cy-new' : ''}"><span class="cy-w"><span class="cy-s">${h(r.wd)}</span></span><span class="cy-d">${h(r.d)}</span>
    <span class="cy-m">${h(r.m)} <small>(${h(r.y)})</small></span><span class="cy-n">${h(r.num)}</span><span class="cy-x"><span class="cy-s">${h(r.text)}</span></span></div>`;
const tableHtml = (rs) => `<div class="cy-t"><div class="cy-r cy-h"><span class="cy-w">יום</span><span class="cy-d"></span><span class="cy-m"></span><span class="cy-n"></span><span class="cy-x">מצוה</span></div>${rs.map(rowHtml).join('')}</div>`;

const ROW = 7.11; const TOP = 19.5; const BOTTOM = 241;
function pagesHtml(k) {
  const all = rows(k); const months = split(all);
  const s = startOf(k);
  const pg = (inner, cls = '') => `<div class="cy-pg ${cls}">${inner}</div>`;
  const bg = `<img class="cy-bg" src="${IMG('bg.jpg')}" alt="">`;
  const out = [];
  out.push(`<img class="cy-full" src="${IMG('cover.jpg')}" alt=""><div class="cy-cov"><b>מחזור ${h(hebrewNumber(k))}</b>
    <span>${h(dateLong(s))}</span><span>${h(dateLong(s + 612))}</span></div>`);
  const tableH = (n) => (n + 1) * ROW;
  // עמ' 2: דער ערשטער חודש אונטן, דער טעקסט אויבן (אין דעם ארט וואס בלייבט)
  const m0 = months[0]; const top0 = BOTTOM - tableH(m0.length);
  const textH = top0 - 6 - 22;
  out.push(`${bg}${textH > 34 ? `<div class="cy-top" style="height:${textH}px"><div class="bk-fit">${richLines(setting('cycle_p2_text') || DEF_P2)}</div></div>` : ''}
    <div class="cy-frame" style="top:${top0}px">${tableHtml(m0)}</div>`);
  const mid = months.slice(1, -1);
  mid.forEach((rs) => out.push(`${bg}<div class="cy-frame">${tableHtml(rs)}</div>`));
  const last = months.length > 1 ? months[months.length - 1] : null;
  const endBlock = (top) => `<div class="cy-end" style="top:${top}px;height:${BOTTOM - top}px;justify-content:center"><img src="${IMG('logo.png')}" alt=""><div class="bk-fit">${richLines(setting('cycle_end_text') || DEF_END)}</div></div>`;
  let logoDone = false;
  if (last) {
    const endTop = TOP + tableH(last.length) + 10;
    const room = BOTTOM - endTop;
    if (room >= 95) { out.push(`${bg}<div class="cy-frame">${tableHtml(last)}</div>${endBlock(endTop)}`); logoDone = true; } else out.push(`${bg}<div class="cy-frame">${tableHtml(last)}</div>`);
  }
  // סך הכל א כפולה פון 4 (מיט דער הינטערשטער זייט): דער לאגא אויף א באזונדער עמוד, און ליידיגע עמודים
  const need = (n) => (4 - ((n + 1) % 4)) % 4;
  if (!logoDone) out.push(`${bg}${endBlock(70)}`);
  for (let i = need(out.length); i > 0; i -= 1) out.push(`${bg}`);
  out.push(`<img class="cy-full" src="${IMG('back.jpg')}" alt="">`);
  return out.map((inner, i) => pg(`${inner}${i > 0 && i < out.length - 1 && inner.includes('cy-frame') ? `<div class="cy-pn">${h(plain(i + 1))}</div>` : ''}`));
}
const DEF_P2 = '~ בס"ד\n## סדר לימוד מצוה יומית\n~ מצוה אחת בכל יום, כסדר הסמ"ק\n~ בספר "מצות המלך" עם פירוש\n~ כ"ק מרן אדמו"ר בעל משנה הלכות זצוקללה"ה';
const DEF_END = '## מפעל מצוה יומית\n## 605-477-4427\nMitzvahYomis@gmail.com';

/** שמאלער מאכן (scaleX) א טעקסט וואס איז צו לאנג פאר זיין קעסטל */
function squeeze(root) {
  $$('.cy-s', root).forEach((s) => {
    s.style.transform = '';
    const td = s.parentElement; const w = td.clientWidth - 2; const sw = s.scrollWidth;
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
      ${onView ? '<div class="lang-switch"><button type="button" data-v="week">שבועי</button><button type="button" data-v="month">חודשי</button><button type="button" class="on">לוח מחזור</button></div><button type="button" class="btn mz-kbtn" data-v="booklet">📘 קונטרס החודש</button>' : ''}
      <button type="button" class="btn" id="cy-prev">‹ הקודם</button>
      <select id="cy-sel">${opts.map((k) => `<option value="${k}"${k === cycle ? ' selected' : ''}>מחזור ${h(hebrewNumber(k))}${k === currentCycle() ? ' (הנוכחי)' : ''}</option>`).join('')}</select>
      <button type="button" class="btn" id="cy-next">הבא ›</button>
      <span class="spacer"></span>
      ${state.isAdmin ? '<button type="button" class="btn ghost" id="cy-txt">✏ טקסטים</button>' : ''}
      <button type="button" class="btn primary" id="cy-print">🖨 הדפסה / PDF</button>
    </div>
    <p class="cy-bar2 muted small">מחזור ${h(hebrewNumber(cycle))}: ${h(dateLong(s))} (${h(isoOf(s))}) — ${h(dateLong(s + 612))} (${h(isoOf(s + 612))}) · ${pages.length} עמודים, 2.125×2.75 אינץ' (כל עמוד = חודש).
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
