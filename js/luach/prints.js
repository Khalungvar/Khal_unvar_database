// 🖨 הדפסות: רשימה של דפים שמורים — כל אחד עריך (כמו וורד, עם קודים) ועם תדירות: חד פעמי / יומי / שבועי / חודשי / שנתי.
// למעלה: "מודעות השבוע" — כל מה שחל בשבוע שנבחר (שבועי + חד פעמי / חודשי / שנתי שנופל בו).
// בלאקן (data-blk): חלקים שהמערכת ממלאת בדיוק כמו בעיצוב הקבוע — שורות שחרית / מנחה / מעריב, מנין כ"ק, זמני שבת.
// שורה חוזרת (data-rep): שורה בטבלה שמשוכפלת לכל מניין, עם {שעה} {חדר} {הערה} / {שם} {שעה}.
// נשמר בגיליון של בית הכנסת, לשונית PrintTemplates (JSON בחלקים).
import { otherSheet } from '../google.js';
import { state } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { curSheetId, curShul, DEFAULT_SHUL } from './shul.js';
import { tefilaData } from './tefila.js';
import { autoVars } from './autovars.js';
import { computeWeekday, computeShabbos, computeShiurim, CODE_GROUPS } from './minyanim.js';
import { isoOf, nOf, dowOf, hdOf, buildYear } from './engine.js';
import { hhmm, LOCATION } from './zmanim.js';
import { printCss, wkBlocks, pageHtml, fitPages, FOOTER, SIZES as TSIZES } from './tfprint.js';
import { weekdayDocx } from './tfdocx.js';
import { customFontNames } from '../fonts.js';
import { hebrewNumber } from '../hebdate.js';
import { MONTH } from './months.js';
import { ribbonHtml, wireRibbon } from './ribbon.js';
import { screenSettings } from './screen.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sh = () => otherSheet(curSheetId());
const tm = (m) => (m == null ? '' : hhmm(((m % 1440) + 1440) % 1440));
const SIZES = { letter: [816, 1056, '8.5in 11in', '8.5×11'], tabloid: [1056, 1632, '11in 17in', '11×17'], half: [528, 816, '5.5in 8.5in', '5.5×8.5'] };
const REP = [['shacharis', 'שחרית'], ['mincha', 'מנחה'], ['maariv', 'מעריב'], ['shabbos', 'שבת (כל הזמנים)']];
const BLK = [['shacharis', 'שורות שחרית'], ['mincha', 'שורות מנחה'], ['maariv', 'שורות מעריב'], ['rebbe', 'מנין כ"ק'], ['sshach', 'שחרית שבת'], ['shabline', 'מנחה ער"ש • ש"ק'], ['shabrows', 'זמני שבת (שורות עם נקודות)']];
const BLKNAME = Object.fromEntries(BLK);
const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HMONTHS = Object.entries(MONTH);
const canEdit = () => !!(state.isAllowed || state.isAdmin);
let T = []; let ui = null; let saved = ''; let DATA = null; let SCRS = null;
let weekAt = ''; let editId = null; let q = ''; let ribTab = 'home'; let unwire = null;

// ---------- הדפים ההתחלתיים: העיצוב של היום (ימות החול / שבת), עכשיו עריך ----------
const blk = (k, tag = 'div', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} data-blk="${k}" contenteditable="false"></${tag}>`;
const STARTERS = {
  weekday: { name: 'ימות החול', size: 'letter', cls: 'tp-wk', frame: true, rec: { type: 'weekly', dow: 0 }, html: `
<div class="tp-title">פרשת {פרשה}</div>
<div class="tp-band"><span></span><b>שחרית</b><small class="tp-ssh tp-bn">{הערת שחרית}</small></div>${blk('shacharis', 'div', 'tp-times')}
<div class="tp-band"><span></span><b>מנחה</b><small>{הערת מנחה}</small></div>${blk('mincha', 'div', 'tp-times')}
${blk('rebbe')}
<div class="tp-band"><span></span><b>מעריב</b><small>{הערת מעריב}</small></div>${blk('maariv', 'div', 'tp-times')}
<div class="tp-band"><span></span><b style="font-size:2.3em">זמני שבת קודש</b>${blk('sshach', 'small', 'tp-ssh')}</div>
${blk('shabline', 'div', 'tp-shab')}` },
  shabbos: { name: 'שבת', size: 'letter', cls: 'tp-sh', frame: false, rec: { type: 'weekly', dow: 5 }, html: `
<img class="tp-lh" src="img/print/letterhead.png" alt="">
<div class="tp-title">זמני שבת פרשת {פרשה}</div>
<div class="tp-sub">בצל כ"ק מרן אדמו"ר שליט"א</div>
${blk('shabrows', 'div', 'tp-rows')}
<div class="tp-foot"><div class="box">${FOOTER.map(h).join('<br>')}</div><div class="rule"></div></div>` },
  // דף חדש: הבלאנק של ביהמ"ד (כמו בדף של שבת) — הכל ב-em, אז מתאים את עצמו לכל גודל דף
  blank: { name: 'דף חדש', size: 'letter', cls: 'tp-bl', frame: false, rec: { type: 'once', date: '' }, html: `
<img class="tp-lh2" src="img/print/letterhead.png" alt="">
<div style="font-size:3em;font-weight:900;text-align:center;margin-top:.6em">כותרת</div>
<div style="font-size:1.6em;text-align:center;margin-top:1em">כתוב כאן…</div>
<img class="tp-lf" src="img/print/letterfoot.png" alt="">` },
};
const FRAME = '<div class="tp-frame"><i></i><i></i><i></i><i></i></div>';

// ---------- טעינה ושמירה ----------
async function load() {
  try {
    const rows = await sh().read('PrintTemplates!A2:D100');
    const parts = rows.filter((r) => /^data#\d+$/.test(String(r[0] || ''))).sort((a, b) => Number(String(a[0]).split('#')[1]) - Number(String(b[0]).split('#')[1]));
    T = parts.length ? JSON.parse(parts.map((r) => r[1] || '').join('')) : [];
  } catch { T = []; }
  // התבניות הישנות (מהעורך הקודם) — בלי תדירות: חד פעמי
  T = T.filter((x) => x && x.html).map((x) => ({ cls: 'tp-free', rec: { type: 'once', date: '' }, ...x }));
  if (!T.some((x) => x.id === 'weekday')) T.unshift({ id: 'weekday', ...JSON.parse(JSON.stringify(STARTERS.weekday)) });
  if (!T.some((x) => x.id === 'shabbos')) T.splice(1, 0, { id: 'shabbos', ...JSON.parse(JSON.stringify(STARTERS.shabbos)) });
  saved = JSON.stringify(T);
}
async function save() {
  const v = JSON.stringify(T); const parts = []; for (let i = 0; i < v.length; i += 40000) parts.push(v.slice(i, i + 40000));
  try { await sh().clear('PrintTemplates!A2:D100'); } catch { await sh().addTab('PrintTemplates'); }
  const st = nowStamp();
  await sh().write(`PrintTemplates!A1:D${parts.length + 1}`, [['key', 'value', 'updated_at', 'updated_by'], ...parts.map((x, i) => [`data#${i}`, x, st, state.email])]);
  saved = v;
}

// ---------- תדירות ----------
const yc = new Map();
function dayOf(n) { const Y = hdOf(n).y; for (const y of [Y, Y + 1]) { if (!yc.has(y)) yc.set(y, buildYear(y, {}, { loc: LOCATION })); const d = yc.get(y).days.find((x) => x.n === n); if (d) return d; } return null; }
function recText(r) {
  const t = r?.type || 'once';
  if (t === 'once') return r.date ? `חד פעמי · ${r.date.split('-').reverse().join('/')}` : 'חד פעמי';
  if (t === 'daily') return 'יומי';
  if (t === 'weekly') return `שבועי · יום ${DOW[Number(r.dow) || 0]}`;
  if (t === 'monthly') return r.rc ? 'חודשי · ראש חודש' : `חודשי · ${hebrewNumber(Number(r.hd) || 1)} בחודש`;
  if (t === 'yearly') return `שנתי · ${hebrewNumber(Number(r.hd) || 1)} ${MONTH[r.hm] || r.hm || ''}`;
  return t;
}
/** הימים בשבוע [sun..sun+6] שבהם ההדפסה חלה */
function hitsInWeek(r, sun) {
  const out = []; const t = r?.type || 'once';
  for (let k = sun; k < sun + 7; k += 1) {
    const hd = hdOf(k);
    if (t === 'daily' && k === sun) out.push(k);
    else if (t === 'weekly' && dowOf(k) === (Number(r.dow) || 0)) out.push(k);
    else if (t === 'once' && r.date && isoOf(k) === r.date) out.push(k);
    else if (t === 'monthly' && (r.rc ? (hd.d === 1 || hd.d === 30) : hd.d === (Number(r.hd) || 1))) { if (!(r.rc && hd.d === 1 && out.includes(k - 1))) out.push(k); }
    else if (t === 'yearly' && hd.m === r.hm && hd.d === (Number(r.hd) || 1)) out.push(k);
  }
  return out;
}

// ---------- מילוי: קודים, בלאקן, שורות חוזרות ----------
function fill(it, n) {
  const sun = n - dowOf(n); const fri = sun + 5;
  const vars = { ...autoVars(DATA, isoOf(fri)), ...autoVars(DATA, isoOf(n)) };
  const parsha = dayOf(fri + 1)?.parsha || vars['פרשה'] || '';
  vars['פרשה'] = parsha;
  const B = wkBlocks(DATA, sun, fri, LOCATION, SCRS);
  vars['הערת שחרית'] = B.shNote.replace(/&[a-z]+;/g, ''); vars['הערת מנחה'] = B.minchaNote; vars['הערת מעריב'] = B.maarivNote;
  const w = computeWeekday(DATA, sun + 1, LOCATION, { plain: true });
  const groups = { shacharis: w.shacharis || [], mincha: w.mincha || [], maariv: w.maariv || [] };
  const shab = computeShabbos(DATA, fri, LOCATION).filter((r) => r.min != null).map((r) => ({ name: r.label, min: r.min, note: r.note }));
  // 🔖 הקוד של כל מניין / שיעור (מזמני התפילות) → השעה בשבוע הזה; לא מתקיים → ריק
  const codeRows = [...CODE_GROUPS.flatMap(([g]) => DATA.weekday?.[g] || []), ...(DATA.shiurim?.rows || [])];
  codeRows.forEach((r) => { if (r.code) { vars[r.code] = ''; vars[`${r.code}.חדר`] = ''; vars[`${r.code}.הערה`] = ''; } });
  const setC = (m) => { if (!m.code) return; vars[m.code] = tm(m.min); vars[`${m.code}.חדר`] = m.room || ''; vars[`${m.code}.הערה`] = m.note || ''; };
  Object.values(groups).flat().forEach(setC);
  computeShiurim(DATA, sun + 1, LOCATION, true).forEach(setC);
  shab.forEach((r, i) => { vars[`שבת ${i + 1}`] = `${r.name} ${tm(r.min)}`; });
  const box = document.createElement('div'); box.innerHTML = it.html;
  for (const el of [...box.querySelectorAll('[data-blk]')]) {
    const k = el.dataset.blk; const v = B[k] || '';
    if (k === 'rebbe') { if (v) el.outerHTML = v; else el.remove(); continue; }
    el.innerHTML = v; el.removeAttribute('contenteditable'); el.removeAttribute('data-blk');
  }
  for (const row of [...box.querySelectorAll('[data-rep]')]) {
    const g = row.dataset.rep; const items = g === 'shabbos' ? shab : groups[g] || [];
    for (const x of items) {
      const c = row.cloneNode(true); c.removeAttribute('data-rep');
      c.innerHTML = c.innerHTML.replace(/\{(שעה|חדר|הערה|שם)\}/g, (m, k) => h(k === 'שעה' ? tm(x.min) : k === 'חדר' ? (x.room || '') : k === 'הערה' ? (x.note || '') : (x.name || '')));
      row.before(c);
    }
    row.remove();
  }
  // קוד ריק בתוך <small> (הערה) — ה-small נשאר ריק, כמו בעיצוב הקבוע
  return box.innerHTML.replace(/\{([^{}]{1,40})\}/g, (m, k) => (vars[k] != null ? (k.startsWith('הערת') ? String(vars[k]) : h(String(vars[k]))) : m));
}
const pageOf = (it, inner) => pageHtml(it.cls || 'tp-free', SIZES[it.size] ? it.size : 'letter', inner, it.frame ? FRAME : '');
function docHtml(it, pages, autoPrint) {
  const [, , pg] = SIZES[it.size] || SIZES.letter;
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${h(it.name)}</title><base href="${location.href.replace(/shul\/.*$/, '').replace(/[^/]*$/, '')}">
    <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=David+Libre:wght@400;700&display=swap" rel="stylesheet">
    <style>@page{size:${pg};margin:0} body{margin:0} .tp-page{page-break-after:always;margin:0 auto} ${printCss()}</style></head><body>${pages}
    <script>(async()=>{try{await document.fonts.ready}catch(e){}; ${FITSRC}; fit(document); ${autoPrint ? 'setTimeout(()=>print(),400);' : ''}})()<\/script></body></html>`;
}
// fitPages כטקסט (בשביל החלון של ההדפסה)
const FITSRC = `const fit = ${fitPages.toString().replace(/^function fitPages/, 'function')}`;
// ⬇ וורד: איך שזה יוצא בשבוע הזה — לתיקון חד-פעמי בוורד (בלי לשנות את התבנית)
async function exportWord(it, day) {
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-20000px;top:0';
  box.innerHTML = `<style>${printCss()}</style>${pageOf(it, fill(it, day))}`; document.body.append(box);
  try {
    try { await document.fonts.ready; } catch { /* */ }
    fitPages(box);
    const pg = box.querySelector('.tp-page'); const name = `${it.name} - ${isoOf(day)}`;
    let blob;
    if (it.cls === 'tp-wk') blob = await weekdayDocx([pg], { size: TSIZES[SIZES[it.size] ? it.size : 'letter'], font: '', css: printCss() });
    else {
      // שאר הדפים: HTML שוורד פותח (עם אותו עיצוב)
      const base = location.href.replace(/shul\/.*$/, '').replace(/[^/]*$/, '');
      const inn = pg.querySelector('.tp-in'); const fs = getComputedStyle(inn).fontSize;
      const [, , sz] = SIZES[it.size] || SIZES.letter;
      let body = inn.innerHTML.replace(/src="(?!data:|https?:)([^"]+)"/g, (m, u) => `src="${base}${u}"`).replace(/var\(--k,\s*1\)|var\(--k\)/g, String(parseFloat(pg.style.getPropertyValue('--k')) || 1));
      body = `<div style="font-size:${fs};font-family:'Frank Ruhl Libre',serif;direction:rtl">${body}</div>`;
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${h(name)}</title>
        <style>@page WordSection1{size:${sz};margin:.4in} div.WordSection1{page:WordSection1} body{direction:rtl} .tp-lh2,.tp-lh{width:6.5in} .tp-lf{width:6.5in} ${printCss()}</style></head><body dir="rtl"><div class="WordSection1">${body}</div></body></html>`;
      blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.${it.cls === 'tp-wk' ? 'docx' : 'doc'}`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { ui?.toast?.(String(err.message || err), 'error'); }
  box.remove();
}
function openPrint(it, days, auto) {
  const w = window.open('', '_blank'); if (!w) { ui?.toast?.('הדפדפן חסם חלון חדש', 'error'); return; }
  w.document.write(docHtml(it, days.map((k) => pageOf(it, fill(it, k))).join(''), auto)); w.document.close();
}

// ---------- הרשימה ----------
const p2 = (x) => String(x).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
function listView(main, onBack) {
  const n0 = nOf(weekAt || todayIso()); const sun = n0 - dowOf(n0);
  const week = T.map((it) => ({ it, days: hitsInWeek(it.rec, sun) })).filter((x) => x.days.length);
  const dlabel = (k) => { const x = hdOf(k); return `יום ${DOW[dowOf(k)]} ${hebrewNumber(x.d)} ${MONTH[x.m] || x.m}`; };
  const ed = canEdit();
  const ORDER = ['weekly', 'daily', 'monthly', 'yearly', 'once'];
  const GN = { weekly: 'שבועי', daily: 'יומי', monthly: 'חודשי', yearly: 'שנתי', once: 'חד פעמי' };
  const list = T.filter((it) => !q || it.name.includes(q));
  main.innerHTML = `<div class="lx-bar"><button type="button" class="btn ghost" id="pr-back">← חזרה</button><b class="lx-title">🖨 הדפסות</b><span class="spacer"></span>
    ${ed ? '<button type="button" class="btn" id="pr-new">➕ הדפסה חדשה</button>' : ''}</div>
  <section class="pr-week"><div class="pr-wbar"><b>📅 מודעות השבוע</b>
    <button type="button" class="btn small-btn ghost" data-w="-7">◀ שבוע קודם</button>
    <input type="date" id="pr-at" value="${isoOf(sun)}">
    <button type="button" class="btn small-btn ghost" data-w="7">שבוע הבא ▶</button>
    <span class="muted small">${h(dlabel(sun))} – ${h(dlabel(sun + 6))}</span></div>
    ${week.length ? `<div class="pr-cards">${week.map(({ it, days }) => `<div class="pr-card"><b>${h(it.name)}</b><span class="muted small">${h(it.rec?.type === 'daily' ? 'יומי' : days.map(dlabel).join(', '))}</span>
      <div><button type="button" class="btn small-btn" data-pv="${h(it.id)}" data-day="${days[0]}">👁</button><button type="button" class="btn small-btn primary" data-pr="${h(it.id)}" data-day="${days[0]}">🖨 הדפסה</button><button type="button" class="btn small-btn ghost" data-wd="${h(it.id)}" data-day="${days[0]}" title="לוורד — איך שזה יוצא בשבוע הזה, לתיקון חד-פעמי">⬇ וורד</button>${ed ? `<button type="button" class="btn small-btn ghost" data-ed="${h(it.id)}">✏️</button>` : ''}</div></div>`).join('')}</div>`
    : '<p class="muted">אין הדפסות בשבוע הזה.</p>'}
  </section>
  <section class="pr-all"><div class="pr-wbar"><b>כל ההדפסות</b><input id="pr-q" placeholder="🔍 חיפוש" value="${h(q)}"></div>
    ${ORDER.map((g) => { const L = list.filter((it) => (it.rec?.type || 'once') === g); return L.length ? `<h4>${GN[g]}</h4>${L.map((it) => `<div class="pr-row"><b>${h(it.name)}</b><span class="muted small">${h(recText(it.rec))}</span><span class="spacer"></span>
      <button type="button" class="btn small-btn ghost" data-pv="${h(it.id)}">👁</button><button type="button" class="btn small-btn ghost" data-pr="${h(it.id)}">🖨</button><button type="button" class="btn small-btn ghost" data-wd="${h(it.id)}" title="לוורד">⬇W</button>
      ${ed ? `<button type="button" class="btn small-btn ghost" data-ed="${h(it.id)}">✏️</button><button type="button" class="btn small-btn ghost" data-dup="${h(it.id)}" title="שכפול">⧉</button>${['weekday', 'shabbos'].includes(it.id) ? '' : `<button type="button" class="btn small-btn ghost" data-del="${h(it.id)}">🗑</button>`}` : ''}</div>`).join('')}` : ''; }).join('')}
  </section>`;
  const get = (id) => T.find((x) => x.id === id);
  const dayFor = (b, it) => (b.dataset.day ? Number(b.dataset.day) : (hitsInWeek(it.rec, sun)[0] ?? n0));
  $('#pr-back', main).onclick = onBack;
  $$('[data-w]', main).forEach((b) => { b.onclick = () => { weekAt = isoOf(sun + Number(b.dataset.w)); listView(main, onBack); }; });
  $('#pr-at', main).onchange = (e) => { weekAt = e.target.value; listView(main, onBack); };
  $('#pr-q', main).oninput = (e) => { q = e.target.value.trim(); const pos = e.target.selectionStart; listView(main, onBack); const qi = $('#pr-q', main); qi.focus(); qi.setSelectionRange(pos, pos); };
  $$('[data-pv]', main).forEach((b) => { b.onclick = () => { const it = get(b.dataset.pv); openPrint(it, [dayFor(b, it)], false); }; });
  $$('[data-pr]', main).forEach((b) => { b.onclick = () => { const it = get(b.dataset.pr); openPrint(it, [dayFor(b, it)], true); }; });
  $$('[data-ed]', main).forEach((b) => { b.onclick = () => { editId = b.dataset.ed; editView(main, onBack); }; });
  $$('[data-wd]', main).forEach((b) => { b.onclick = async () => { const it = get(b.dataset.wd); b.disabled = true; await exportWord(it, dayFor(b, it)); b.disabled = false; }; });
  $$('[data-dup]', main).forEach((b) => { b.onclick = async () => { const it = get(b.dataset.dup); T.push({ ...JSON.parse(JSON.stringify(it)), id: `t${Date.now().toString(36)}`, name: `${it.name} (עותק)` }); await persist(); listView(main, onBack); }; });
  $$('[data-del]', main).forEach((b) => { b.onclick = async () => { const it = get(b.dataset.del); if (!confirm(`למחוק את "${it.name}"?`)) return; T = T.filter((x) => x !== it); await persist(); listView(main, onBack); }; });
  const nb = $('#pr-new', main);
  if (nb) nb.onclick = () => {
    const kind = prompt('הדפסה חדשה:\n1 = דף ריק\n2 = על בסיס ימות החול\n3 = על בסיס שבת', '1'); if (!kind) return;
    let base = kind === '2' ? STARTERS.weekday : kind === '3' ? STARTERS.shabbos : STARTERS.blank;
    if (curShul() !== DEFAULT_SHUL && base !== STARTERS.weekday) base = { ...base, html: base.html.replace(/<img class="tp-lh2?"[^>]*>/, '').replace(/<img class="tp-lf"[^>]*>/, '').replace(/<div class="tp-sub">[\s\S]*?<\/div>/, '').replace(/<div class="tp-foot">[\s\S]*$/, '') };
    const it = { ...JSON.parse(JSON.stringify(base)), id: `t${Date.now().toString(36)}`, name: kind === '1' ? 'דף חדש' : `${base.name} (חדש)` };
    if (kind === '1') it.rec = { type: 'once', date: isoOf(n0) };
    T.push(it); editId = it.id; editView(main, onBack);
  };
}
async function persist() { try { await save(); ui?.toast?.('נשמר ✓'); } catch (err) { ui?.toast?.(String(err.message || err), 'error'); } }

// ---------- העורך ----------
const FONTS = () => [...new Set(['Frank Ruhl Libre', 'David Libre', 'PFT_Vilna', 'Livorna', 'Arial', 'Times New Roman', ...customFontNames()])];
/** [[קבוצה, [[קוד, תווית]]]] — כל הקודים, עם השעה של השבוע ליד כל מניין */
function codeList(n) {
  const sun = n - dowOf(n); const w = computeWeekday(DATA, sun + 1, LOCATION, { plain: true });
  const tOf = new Map([...['shacharis', 'mincha', 'maariv'].flatMap((g) => w[g] || []), ...computeShiurim(DATA, sun + 1, LOCATION, true)].filter((m) => m.code).map((m) => [m.code, tm(m.min)]));
  const one = (r, extra = '') => [r.code, `${r.code}${extra}${tOf.has(r.code) ? ` — ${tOf.get(r.code)}` : ' — (לא השבוע)'}`];
  const out = CODE_GROUPS.map(([g, nm]) => [nm, (DATA.weekday?.[g] || []).filter((r) => r.code).map((r) => one(r))]);
  out.push(['שיעורים', (DATA.shiurim?.rows || []).filter((r) => r.code).map((r) => one(r, r.title ? ` (${r.title})` : ''))]);
  const v = Object.keys(autoVars(DATA, isoOf(n)));
  out.push(['כללי', ['פרשה', 'פרשה הבאה', 'הערת שחרית', 'הערת מנחה', 'הערת מעריב', 'שבת 1', 'שבת 2', ...v.filter((x) => !['פרשה', 'פרשה הבאה'].includes(x) && !x.startsWith('__'))].map((x) => [x, x])]);
  return out.filter(([, l]) => l.length);
}
function editView(main, onBack) {
  const it = T.find((x) => x.id === editId); if (!it) { listView(main, onBack); return; }
  const before = JSON.stringify(it); const r = it.rec || (it.rec = { type: 'once', date: '' });
  const ed = canEdit(); const S = SIZES[it.size] ? it.size : 'letter';
  const n0 = nOf(weekAt || todayIso()); const pvDay = hitsInWeek(r, n0 - dowOf(n0))[0] ?? n0;
  main.innerHTML = `<style>${printCss()}</style><div class="lx-bar"><button type="button" class="btn ghost" id="te-back">← לרשימה</button>
    <input id="te-name" value="${h(it.name)}" style="width:12em;font-weight:700">
    <select id="te-size">${Object.entries(SIZES).map(([k, x]) => `<option value="${k}"${S === k ? ' selected' : ''}>${x[3]}</option>`).join('')}</select>
    <span class="pr-rec">🔁 <select id="te-rt">${[['once', 'חד פעמי'], ['daily', 'יומי'], ['weekly', 'שבועי'], ['monthly', 'חודשי'], ['yearly', 'שנתי']].map(([k, l]) => `<option value="${k}"${r.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      ${r.type === 'once' ? `<input type="date" id="te-date" value="${h(r.date || '')}">` : ''}
      ${r.type === 'weekly' ? `<select id="te-dow">${DOW.map((d, i) => `<option value="${i}"${Number(r.dow) === i ? ' selected' : ''}>יום ${d}</option>`).join('')}</select>` : ''}
      ${r.type === 'monthly' ? `<select id="te-mo"><option value="rc"${r.rc ? ' selected' : ''}>ראש חודש</option>${Array.from({ length: 30 }, (x, i) => `<option value="${i + 1}"${!r.rc && Number(r.hd) === i + 1 ? ' selected' : ''}>${hebrewNumber(i + 1)} בחודש</option>`).join('')}</select>` : ''}
      ${r.type === 'yearly' ? `<select id="te-yd">${Array.from({ length: 30 }, (x, i) => `<option value="${i + 1}"${Number(r.hd) === i + 1 ? ' selected' : ''}>${hebrewNumber(i + 1)}</option>`).join('')}</select><select id="te-ym">${HMONTHS.map(([k, l]) => `<option value="${h(k)}"${r.hm === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>` : ''}</span>
    <span class="spacer"></span>
    <button type="button" class="btn" id="te-pv">👁 עם הזמנים</button><button type="button" class="btn ghost" id="te-wd">⬇ וורד</button>${ed ? '<button type="button" class="btn primary" id="te-save">💾 שמירה</button>' : ''}</div>
  <div class="pr-rib" id="te-rib">${ribbonHtml(ribTab, { fonts: FONTS(), codes: codeList(pvDay), blocks: BLK, reps: REP })}</div>
  <div class="pr-pageopts"><label class="small"><input type="checkbox" id="te-frame"${it.frame ? ' checked' : ''}> מסגרת</label> <button type="button" class="btn small-btn ghost" id="te-src" title="עריכת HTML">&lt;/&gt; HTML</button></div>
  <p class="muted small">בלוק (אפור) = חלק שהמערכת ממלאת כמו בעיצוב הקבוע. אפשר לגרור / למחוק אותו ולכתוב סביבו. שורה חוזרת (מסגרת כחולה) = שורה שמשוכפלת לכל מניין: {שעה} {חדר} {הערה} / {שם} {שעה}.</p>
  <div class="tp-stage">${pageOf(it, '').replace('<div class="tp-in"></div>', `<div class="tp-in te-ed" id="te-page" contenteditable="${ed}">${it.html}</div>`)}</div>`;
  const pg = $('#te-page', main);
  pg.style.setProperty('--fs', '16px'); // בעורך: גודל ממוצע (בהדפסה — מותאם לדף)
  $$('[data-blk]', pg).forEach((b) => { b.setAttribute('data-label', BLKNAME[b.dataset.blk] || b.dataset.blk); });
  const sync = () => { const c = pg.cloneNode(true); c.querySelectorAll('[data-label]').forEach((x) => x.removeAttribute('data-label')); it.html = c.innerHTML; };
  pg.addEventListener('input', sync);
  const rerender = () => { sync(); editView(main, onBack); };
  $('#te-back', main).onclick = () => { sync(); if (JSON.stringify(T) !== saved && !confirm('יש שינויים שלא נשמרו. לחזור לרשימה בלי לשמור?')) return; if (JSON.stringify(T) !== saved) T = JSON.parse(saved); listView(main, onBack); };
  $('#te-name', main).onchange = (e) => { it.name = e.target.value.trim() || it.name; sync(); };
  $('#te-size', main).onchange = (e) => { it.size = e.target.value; rerender(); };
  $('#te-frame', main).onchange = (e) => { it.frame = e.target.checked; rerender(); };
  $('#te-rt', main).onchange = (e) => { const t = e.target.value; it.rec = t === 'weekly' ? { type: t, dow: 0 } : t === 'monthly' ? { type: t, rc: true } : t === 'yearly' ? { type: t, hd: 1, hm: 'Nisan' } : t === 'once' ? { type: t, date: todayIso() } : { type: t }; rerender(); };
  const on = (id, f) => { const el = $(id, main); if (el) el.onchange = (e) => { f(e.target.value); sync(); }; };
  on('#te-date', (v) => { r.date = v; }); on('#te-dow', (v) => { r.dow = Number(v); });
  on('#te-mo', (v) => { if (v === 'rc') { r.rc = true; delete r.hd; } else { r.rc = false; r.hd = Number(v); } });
  on('#te-yd', (v) => { r.hd = Number(v); }); on('#te-ym', (v) => { r.hm = v; });
  const ins = (html) => { document.execCommand('insertHTML', false, html); $$('[data-blk]', pg).forEach((b) => { b.setAttribute('data-label', BLKNAME[b.dataset.blk] || b.dataset.blk); b.contentEditable = 'false'; }); sync(); };
  if (unwire) unwire();
  unwire = wireRibbon($('#te-rib', main), pg, {
    change: sync,
    tab: (k) => { ribTab = k; rerender(); },
    insBlock: (k) => { const cls = { shacharis: 'tp-times', mincha: 'tp-times', maariv: 'tp-times', shabline: 'tp-shab', shabrows: 'tp-rows' }[k] || ''; ins(blk(k, k === 'sshach' ? 'span' : 'div', cls)); },
    insRep: (g) => {
      const inner = g === 'shabbos' ? '<td style="padding:4px">{שם}</td><td style="padding:4px;font-weight:700">{שעה}</td>' : '<td style="padding:2px;text-align:center;font-weight:700">{שעה} <span style="font-size:.6em">{חדר}</span></td>';
      ins(`<table style="width:100%;border-collapse:collapse;font-size:1.6em"><tbody><tr data-rep="${g}">${inner}</tr></tbody></table><div><br></div>`);
    },
  });
  $('#te-src', main).onclick = () => {
    sync(); const d = document.createElement('dialog'); d.className = 'sheet wide';
    d.innerHTML = `<h3>HTML</h3><textarea dir="ltr" style="width:100%;height:60vh;font-family:monospace;font-size:12px">${h(it.html)}</textarea><div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>עדכון</button></div>`;
    document.body.append(d); d.addEventListener('close', () => d.remove()); d.showModal();
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('[data-ok]').onclick = () => { it.html = d.querySelector('textarea').value; d.close(); editView(main, onBack); };
  };
  $('#te-pv', main).onclick = () => { sync(); openPrint(it, [pvDay], false); };
  $('#te-wd', main).onclick = async (e) => { sync(); e.target.disabled = true; await exportWord(it, pvDay); e.target.disabled = false; };
  const sv = $('#te-save', main);
  if (sv) sv.onclick = async () => { sync(); sv.disabled = true; await persist(); sv.disabled = false; };
  void before;
}

export async function openPrints(main, onBack, helpers) {
  ui = helpers; main.innerHTML = '<p class="muted">…</p>';
  const [data, scr] = await Promise.all([tefilaData(), screenSettings().catch(() => null), load()]);
  DATA = data; SCRS = scr; editId = null;
  listView(main, onBack);
}
export { fill as fillPrint, STARTERS as PRINT_STARTERS };
