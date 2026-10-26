// לוח שנה — דער בלאט אויפן אתר: א חודש אויף איינמאל (ווי דער געדרוקטער לוח), ‹ › צו גיין,
// קליק אויף א טאג → צולייגן / באהאלטן א שורה, און "PDF" פאר א ריי חודשים (מיט bleed, גרייט פאר'ן דרוקער).
// די אויסשטעלונג (מאסן אין pt) איז גענומען פונעם InDesign לוח תשפ"ז, 275×160 מ"מ + 7 מ"מ bleed.
import { buildYear, isoOf } from './engine.js';
import { setZmanimTable, hhmm } from './zmanim.js';
import { hebrewNumber, todayIso } from '../hebdate.js';
import { readTabs, appendRow, updateRange } from '../google.js';
import { state } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { uploadFont, loadFonts, customFontNames } from '../fonts.js';
import { getLang } from '../i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let ui = {};
export function initLuach(helpers) { ui = helpers; }

// ---------- מאסן (pt), לויט דעם InDesign בלאט ----------
const PAGE_W = 819.213; const PAGE_H = 493.228;
const COLS = [586.9, 516.0, 445.0, 374.0, 303.0, 232.1, 161.2]; // זונטאג ... שבת (x פון לינקס)
const COL_W = 71.0;
const ROW_T = [83.7, 156.9, 230.2, 303.4, 376.7]; const ROW_H = 72.9;
const DAY_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'ששי', 'שבת'];
const DAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- דאטן ----------
let year = 0; let pageIx = 0; let built = null;
let edits = []; // [{ row, id, iso, kind, text, action }]  action: '' = צולייגן, 'hide' = באהאלטן א שורה פונעם חשבון
let loaded = false;

async function loadData() {
  if (loaded) return;
  try {
    const t = await readTabs(['LuachEdits', 'LuachZmanim']);
    const [eh = [], ...er] = t.LuachEdits || [];
    const ix = (k) => eh.indexOf(k);
    edits = er.map((r, i) => ({ row: i + 2, id: r[ix('id')], iso: String(r[ix('iso')] || ''), kind: String(r[ix('kind')] || 'note'), text: String(r[ix('text')] || ''), action: String(r[ix('action')] || '') }))
      .filter((e) => e.iso && e.text);
    const [zh = [], ...zr] = t.LuachZmanim || [];
    const zi = (k) => zh.indexOf(k);
    // גוגל קען האלטן א צייט ווי א שבר פון א טאג (0.27) און א דאטום ווי א נומער (46277)
    const tm = (v) => {
      if (typeof v === 'number') return v < 1 ? Math.round(v * 1440) : null;
      const m = /(\d{1,2}):(\d{2})/.exec(String(v || '')); if (!m) return null; let hh = +m[1]; if (/pm/i.test(String(v)) && hh < 12) hh += 12; return hh * 60 + +m[2];
    };
    const dt = (v) => (typeof v === 'number' ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : String(v || '').slice(0, 10));
    const table = {};
    zr.forEach((r) => {
      const iso = dt(r[zi('date')]); if (!iso) return;
      const pm = (v) => { const x = tm(v); return x != null && x < 12 * 60 ? x + 12 * 60 : x; }; // נאכמיטאג
      const u = (v) => (v == null ? undefined : v);
      table[iso] = { neitz: tm(r[zi('neitz')]), shkia: pm(r[zi('shkia')]), maKS: u(tm(r[zi('ma_ks')])), graKS: u(tm(r[zi('gra_ks')])), chatzos: u(tm(r[zi('chatzos')])),
        candles: u(pm(r[zi('candles')])), motzei: u(pm(r[zi('motzei')])) };
    });
    setZmanimTable(table);
  } catch { edits = []; }
  loaded = true;
}

function build(Y) {
  const extra = {};
  edits.filter((e) => !e.action).forEach((e) => { (extra[e.iso] = extra[e.iso] || []).push({ kind: e.kind, text: e.text, edit: true }); });
  const b = buildYear(Y, extra);
  // באהאלטענע שורות
  const hide = new Set(edits.filter((e) => e.action === 'hide').map((e) => `${e.iso}|${e.text}`));
  b.days.forEach((d) => { d.items = d.items.filter((x) => !hide.has(`${d.iso}|${x.text}`)); if (hide.has(`${d.iso}|${d.parsha}`)) d.parsha = ''; });
  return b;
}

// ---------- איין טאג ----------
const ICON_SIZE = { shofar: [44, 28], yk: [34, 31], sukkos: [26, 37], sukkos2: [28, 37], chm: [30, 22], scroll: [40, 20], scroll2: [36, 18], menorah: [32, 30], fruit: [44, 31], purim: [38, 22], seder: [36, 24], matza: [26, 18], matza2: [26, 18], flowers: [30, 24] };
function cellHtml(d, r, c, page) {
  if (!d) return `<div class="lx-cell lx-empty" style="${pos(c, r)}"></div>`;
  const items = d.items;
  const of = (k) => items.filter((x) => x.kind === k);
  const prevMonth = d.hm !== page.key ? `<span class="lx-pm">${h(monthName(d.hm))}</span>` : '';
  const hol = [...of('hol'), ...of('special'), ...of('bahab')];
  const icon = items.find((x) => x.icon);
  const bottom = [];
  of('eruv').forEach((x) => bottom.push(`<div class="lx-eruv">${h(x.text)}</div>`));
  of('small').forEach((x) => bottom.push(`<div class="lx-small${x.size === 'l' ? ' lx-l' : ''}">${h(x.text)}</div>`));
  of('note').forEach((x) => bottom.push(`<div class="lx-note${x.size === 'xs' ? ' lx-xs' : ''}">${fitText(x.text, x.size === 'xs' ? 26 : 22)}</div>`));
  of('avos').forEach((x) => bottom.push(`<div class="lx-avos">${h(x.text)}</div>`));
  of('dst').forEach((x) => bottom.push(`<div class="lx-dst"><b>2</b><i>AM</i> - ${h(x.text)}<br><span>${h(x.en)}</span></div>`));
  of('hillula').forEach((x) => bottom.push(`<div class="lx-hil"><img src="img/luach/candle.png" alt="">${fitText(x.text, 17)}</div>`));
  const omer = of('omer')[0];
  const rebbe = of('rebbe')[0];
  const times = d.times.filter((t) => !t.chametz && !t.fast);
  const fast = d.times.find((t) => t.fast);
  const chametz = d.times.filter((t) => t.chametz);
  return `<div class="lx-cell${d.shade ? ' lx-shade' : ''}" data-iso="${d.iso}" style="${pos(c, r)}">
    <span class="lx-g">${d.greg}</span>
    <span class="lx-d">${prevMonth}${h(d.heDay)}</span>
    ${d.parsha ? `<div class="lx-parsha">${h(d.parsha)}</div>` : ''}
    <div class="lx-hol">${hol.map((x) => `<div${x.edit ? ' class="lx-ed"' : ''}>${h(x.text)}</div>`).join('')}</div>
    ${times.length ? `<div class="lx-t">${times.map((t) => `<span class="lx-tl">${h(t.label)}</span><span class="lx-tv">${h(t.time)}</span>`).join('')}</div>` : ''}
    ${fast ? `<div class="lx-fast"><span>${h(fast.label)}</span> <b>${h(fast.time)}</b></div>` : ''}
    ${chametz.length ? `<div class="lx-chametz">${chametz.map((t) => `<div><span>${h(t.label)}</span> <small>${h(t.sub)}</small> <b>${h(t.time)}</b></div>`).join('')}</div>` : ''}
    ${icon && ICON_SIZE[icon.icon] ? `<img class="lx-ic lx-ic-${icon.icon}" src="img/luach/${icon.icon}.png" alt="" style="width:${ICON_SIZE[icon.icon][0]}pt;height:${ICON_SIZE[icon.icon][1]}pt">` : ''}
    ${rebbe ? `<div class="lx-rebbe"><img src="img/luach/candle.png" alt=""><div>כ"ק אדמו"ר הגה"ק<br>בעל <b>משנה<br>הלכות</b> זצוקללה"ה</div></div>` : ''}
    ${omer ? `<div class="lx-omer">${h(omer.text)}:</div>` : ''}
    <div class="lx-bot">${bottom.join('')}</div>
  </div>`;
}
const pos = (c, r) => `left:${COLS[c]}pt;top:${ROW_T[r]}pt;width:${COL_W}pt;height:${ROW_H}pt`;
const MONTH_HE = { Tishri: 'תשרי', Heshvan: 'חשון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט', Adar: 'אדר', 'Adar I': 'אדר א\'', 'Adar II': 'אדר ב\'', Nisan: 'ניסן', Iyar: 'אייר', Sivan: 'סיון', Tamuz: 'תמוז', Av: 'מנחם-אב', Elul: 'אלול' };
const monthName = (k) => MONTH_HE[k] || k;

// ---------- א גאנצער בלאט ----------
function pageHtml(p, print = false) {
  const gm = (dt) => MON_EN[dt.getUTCMonth()];
  const y1 = p.g1.getUTCFullYear(); const y2 = p.g2.getUTCFullYear();
  const greg = gm(p.g1) === gm(p.g2) ? `${gm(p.g1)} ${y2}` : (y1 === y2 ? `${gm(p.g1)} - ${gm(p.g2)} ${y2}` : `${gm(p.g1)} ${y1} - ${gm(p.g2)} ${y2}`);
  const cells = [];
  p.rows.forEach((row, r) => row.forEach((d, c) => cells.push(cellHtml(d, r, c, p))));
  // "משנכנס אדר": אין די ליידיגע טעג פאר ר"ח אדר
  const firstRow = p.rows[0];
  const lead = firstRow.findIndex(Boolean);
  const adarBanner = (p.key === 'Adar' || p.key === 'Adar II') && lead >= 2
    ? `<img class="lx-banner" src="img/luach/adar.jpg" alt="" style="left:${COLS[lead - 1]}pt;top:${ROW_T[0] + 1}pt;width:${COL_W * 2 - 2}pt;height:${ROW_H - 2}pt">` : '';
  const carried = p.monthDays.length === 30 && !p.days.some((d) => d.hd === 30 && d.hm === p.key);
  // זייטן: זמני היום (לינקס) און מצוה יומית (רעכטס) — יעדער טאג פונעם חודש
  const md = p.monthDays;
  const zRows = md.map((d, i) => `<div class="lx-zr" style="top:${81.1 + i * 10.58}pt">
      <span class="lx-zd">${h(d.heDay)}</span><span class="lx-zn">${hhmm(d.zm.neitz)}</span><span class="lx-zm">${hhmm(d.zm.maKS, 'floor')}</span>
      <span class="lx-zs">${hhmm(d.zm.shkia)}</span><span class="lx-zf"><small>${h(d.daf.masechta)}</small> ${h(d.daf.daf)}</span></div>`).join('');
  const mRows = md.map((d, i) => `<div class="lx-mr" style="top:${81.1 + i * 11.7}pt">
      <span class="lx-md">${h(d.heDay)}</span><span class="lx-mn">${h(d.mitzva.num)}</span><span class="lx-mt">${fitText(d.mitzva.text, 13)}</span></div>`).join('');
  // טאבעלע אונטן: יעדער שבת פונעם חודש — פרשה, חצות, זק"ש גר"א
  const shab = md.filter((d) => d.dow === 6).slice(0, 5);
  const XS = [103.9, 84.8, 65.9, 47.1, 29.3]; const XW = [18.6, 19.1, 18.9, 18.8, 17.8];
  const bt = shab.map((d, i) => `<div class="lx-bc" style="left:${XS[i]}pt;width:${XW[i]}pt">
      <span class="lx-bp">${fitText(shortName(d), 5)}</span><span>${hhmm(d.zm.chatzos)}</span><span>${hhmm(d.zm.graKS, 'floor')}</span></div>`).join('');
  return `<div class="lx-page${print ? ' lx-print' : ''}" dir="rtl">
    <img class="lx-tmpl" src="img/luach/${print ? 'tmpl-print' : 'tmpl'}.jpg" alt="">
    <div class="lx-head"><span class="lx-mname">${h(p.he === 'אב' ? 'מנחם-אב' : p.he)}</span><span class="lx-mazal">${h(p.mazal)}</span><span class="lx-greg" dir="ltr">${h(greg)}</span></div>
    <div class="lx-band"></div><div class="lx-days">${DAY_HE.map((n, c) => `<div style="left:${COLS[c]}pt;width:${COL_W}pt"><b>${n}</b><span>${DAY_EN[c]}</span></div>`).join('')}</div>
    ${cells.join('')}
    ${adarBanner}
    ${carried ? `<div class="lx-carry" style="left:${COLS[6]}pt;top:${ROW_T[4] + ROW_H - 22}pt">ל<span>›</span></div>` : ''}
    <div class="lx-zm">${zRows}</div>
    <div class="lx-mz">${mRows}</div>
    <div class="lx-bt">${bt}</div>
  </div>`;
}
/** א לאנגער טעקסט ווערט שמאלער (ווי אין InDesign), אז ער זאל אריינפאסן */
function fitText(txt, max) {
  const n = [...String(txt)].length;
  if (n <= max) return h(txt);
  return `<i style="display:inline-block;font-style:normal;transform:scaleX(${(max / n).toFixed(3)});transform-origin:right center">${h(txt)}</i>`;
}
function shortName(d) {
  const hol = d.items.find((x) => x.kind === 'hol' && x.yt);
  if (!d.parsha && hol) {
    const t = hol.text;
    if (t.includes('ראש השנה')) return 'ר"ה'; if (t.includes('כיפורים')) return 'יוה"כ'; if (t.includes('סוכות')) return 'סוכות';
    if (t.includes('שמיני')) return 'שמע"צ'; if (t.includes('פסח')) return 'פסח'; if (t.includes('שבועות')) return 'שבועות';
  }
  if (!d.parsha && d.items.some((x) => x.chm)) return 'חוה"מ';
  return d.parsha;
}

// ---------- דער בלאט אויפן אתר ----------
function currentYearAndPage() {
  const iso = todayIso();
  let Y = 5787;
  for (let y = 5780; y < 5900; y += 1) { const b = buildYear(y); if (b.days[b.days.length - 1].iso >= iso) { Y = y; break; } }
  const b = buildYear(Y);
  const pi = Math.max(0, b.pages.findIndex((p) => p.monthDays.some((d) => d.iso === iso)));
  return [Y, pi];
}

export async function openLuach() { ui.showView('luach'); }

export async function renderLuach() {
  const main = $('#luach-main');
  if (!main) return;
  if (!year) [year, pageIx] = currentYearAndPage();
  if (!main.firstChild) main.innerHTML = `<p class="muted">…</p>`;
  await loadData();
  built = build(year);
  pageIx = Math.min(Math.max(pageIx, 0), built.pages.length - 1);
  const p = built.pages[pageIx];
  const yl = (y) => hebrewNumber(y % 1000);
  const missing = LUACH_FONTS.filter((f) => !customFontNames().includes(f.name));
  main.innerHTML = `<div class="lx-bar">
      <button type="button" class="btn" id="lx-prev">‹ ${h(t('prev'))}</button>
      <b class="lx-title">${h(p.he)} ${h(yl(year))}</b>
      <button type="button" class="btn" id="lx-next">${h(t('next'))} ›</button>
      <select id="lx-year">${[year - 1, year, year + 1, year + 2].map((y) => `<option value="${y}"${y === year ? ' selected' : ''}>${yl(y)}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="lx-pdf">⬇ ${h(t('pdf'))}</button>
      ${state.isAdmin ? `<button type="button" class="btn ghost" id="lx-admin">⚙</button>` : ''}
    </div>
    ${missing.length ? `<p class="lx-warn">⚠ ${h(t('fontsMissing'))} ${state.isAdmin ? `<button type="button" class="linkish" id="lx-fonts2">${h(t('fontsUp'))}</button>` : ''}</p>` : ''}
    <p class="muted small">${h(t('hint'))}</p>
    <div class="lx-wrap"><div class="lx-scale">${pageHtml(p)}</div></div>`;
  fit(main);
  $('#lx-prev', main).onclick = () => go(-1);
  $('#lx-next', main).onclick = () => go(1);
  $('#lx-year', main).onchange = (e) => { year = Number(e.target.value); pageIx = 0; renderLuach(); };
  $('#lx-pdf', main).onclick = () => pdfDialog();
  const adm = $('#lx-admin', main); if (adm) adm.onclick = () => adminDialog();
  const f2 = $('#lx-fonts2', main); if (f2) f2.onclick = () => adminDialog();
  $$('.lx-cell[data-iso]', main).forEach((c) => { c.onclick = () => dayDialog(c.dataset.iso); });
  window.onresize = () => fit(main);
}
function go(dir) {
  pageIx += dir;
  if (pageIx < 0) { year -= 1; pageIx = buildYear(year).pages.length - 1; }
  else if (pageIx >= built.pages.length) { year += 1; pageIx = 0; }
  renderLuach();
}
function fit(main) {
  const wrap = $('.lx-wrap', main); const sc = $('.lx-scale', main); if (!wrap || !sc) return;
  const pxW = PAGE_W * (96 / 72); const pxH = PAGE_H * (96 / 72);
  const k = Math.min(1.6, (wrap.clientWidth - 4) / pxW);
  sc.style.transform = `scale(${k})`;
  wrap.style.height = `${pxH * k}px`;
}

// ---------- טאג: צולייגן / באהאלטן ----------
const KINDS = [['hol', 'kHol'], ['note', 'kNote'], ['small', 'kSmall'], ['hillula', 'kHil']];
function dayDialog(iso) {
  const d = built.days.find((x) => x.iso === iso); if (!d) return;
  const auto = [...(d.parsha ? [{ kind: 'parsha', text: d.parsha }] : []), ...d.items.filter((x) => !x.edit && x.kind !== 'omer' && x.kind !== 'dst' && x.kind !== 'rebbe')];
  const mine = edits.filter((e) => e.iso === iso && !e.action);
  const hidden = edits.filter((e) => e.iso === iso && e.action === 'hide');
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg'; dlg.dir = 'rtl';
  dlg.innerHTML = `<button type="button" class="x-close">✕</button>
    <h3>${h(d.heDay)} ${h(monthName(d.hm))} · ${iso}</h3>
    <h4>${h(t('auto'))}</h4>
    <ul class="lx-list">${auto.map((x) => `<li>${h(x.text)} <button type="button" class="linkish" data-hide="${h(x.text)}">${h(t('hide'))}</button></li>`).join('') || `<li class="muted">—</li>`}</ul>
    ${hidden.length ? `<h4>${h(t('hidden'))}</h4><ul class="lx-list">${hidden.map((x) => `<li><s>${h(x.text)}</s> <button type="button" class="linkish" data-del="${x.row}">${h(t('restore'))}</button></li>`).join('')}</ul>` : ''}
    <h4>${h(t('added'))}</h4>
    <ul class="lx-list">${mine.map((x) => `<li>${h(x.text)} <span class="muted small">(${h(t(KINDS.find((k) => k[0] === x.kind)?.[1] || 'kNote'))})</span> <button type="button" class="linkish" data-del="${x.row}">${h(t('del'))}</button></li>`).join('') || `<li class="muted">—</li>`}</ul>
    <form class="lx-add"><select name="kind">${KINDS.map(([k, l]) => `<option value="${k}">${h(t(l))}</option>`).join('')}</select>
      <input name="text" dir="rtl" required placeholder="${h(t('textPh'))}"><button type="submit" class="btn primary">${h(t('add'))}</button></form>
    <p class="muted small">${h(t('editNote'))}</p>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.x-close', dlg).onclick = close;
  const after = async () => { close(); renderLuach(); };
  $$('[data-hide]', dlg).forEach((b) => { b.onclick = async () => { await saveEdit({ iso, kind: 'hide', text: b.dataset.hide, action: 'hide' }); after(); }; });
  $$('[data-del]', dlg).forEach((b) => { b.onclick = async () => { await delEdit(Number(b.dataset.del)); after(); }; });
  $('.lx-add', dlg).onsubmit = async (e) => { e.preventDefault(); const f = e.target; await saveEdit({ iso, kind: f.kind.value, text: f.text.value.trim(), action: '' }); after(); };
}
async function saveEdit(e) {
  try {
    const id = `${Date.now()}`;
    await appendRow('LuachEdits', [id, e.iso, e.kind, e.text, e.action, nowStamp(), state.email]);
    loaded = false; edits = [];
  } catch (err) { ui.toast?.(ui.friendlyError ? ui.friendlyError(err) : String(err), 'error'); }
}
async function delEdit(row) {
  try { await updateRange(`LuachEdits!A${row}:G${row}`, [['', '', '', '', '', nowStamp(), state.email]]); loaded = false; edits = []; } catch (err) { ui.toast?.(String(err), 'error'); }
}

// ---------- PDF (דרוקן) ----------
function pdfDialog() {
  const pages = built.pages;
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg'; dlg.dir = 'rtl';
  const opts = (sel) => pages.map((p, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${h(p.he)}</option>`).join('');
  dlg.innerHTML = `<button type="button" class="x-close">✕</button><h3>⬇ ${h(t('pdf'))}</h3>
    <p><label>${h(t('from'))} <select id="lx-f">${opts(pageIx)}</select></label> <label>${h(t('to'))} <select id="lx-t">${opts(pageIx)}</select></label>
    <button type="button" class="linkish" id="lx-all">${h(t('allYear'))}</button></p>
    <p class="muted small">${h(t('pdfHint'))}</p>
    <button type="button" class="btn primary" id="lx-go">🖨 ${h(t('print'))}</button>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.x-close', dlg).onclick = close;
  $('#lx-all', dlg).onclick = () => { $('#lx-f', dlg).value = '0'; $('#lx-t', dlg).value = String(pages.length - 1); };
  $('#lx-go', dlg).onclick = () => {
    const a = Number($('#lx-f', dlg).value); const b = Number($('#lx-t', dlg).value);
    close(); printPages(pages.slice(Math.min(a, b), Math.max(a, b) + 1));
  };
}
function printPages(list) {
  let area = $('#lx-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'lx-print-area'; document.body.append(area); }
  area.innerHTML = list.map((p) => pageHtml(p, true)).join('');
  const st = document.createElement('style');
  st.textContent = `@page { size: ${PAGE_W}pt ${PAGE_H}pt; margin: 0; }`;
  document.head.append(st);
  document.body.classList.add('printing-lx');
  const done = () => { document.body.classList.remove('printing-lx'); st.remove(); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // ווארטן ביז די בילדער זענען געלאדן
  const imgs = $$('img', area);
  Promise.all(imgs.map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = r; im.onerror = r; })))).then(() => setTimeout(() => window.print(), 200));
}

// ---------- מנהל: גופנים ----------
// נעמען פון די גופנים (ווי זיי ווערן גענוצט אין CSS) לויט דעם נאמען פון דער טעקע
export const LUACH_FONTS = [
  { name: 'Guttman David Bold', files: [/guttman\s*david-?bold/i] },
  { name: 'EFT_Chakika', files: [/eft_?chakika\.ttf/i] },
  { name: 'FontbitLivorna', files: [/fbwlivorna\.otf/i] },
  { name: 'FontbitLivorna Bold', files: [/fbwlivornabold\.otf/i] },
  { name: 'Sfarady', files: [/sfaradyregular/i] },
  { name: 'SfaradyMedium', files: [/sfaradymedium/i] },
  { name: 'EFT_Pnina', files: [/eft_?pnina\.ttf/i] },
  { name: 'EFT_Pnina Bold', files: [/eft_?pnina bold/i] },
  { name: 'PFT_Frank', files: [/pft_?frank\.ttf/i] },
  { name: 'PFT_Vilna', files: [/pft_?vilnaots/i] },
  { name: 'PFT_Vilna Bold', files: [/pft_?vilna bold/i] },
  { name: 'EFT_Patient Bold', files: [/eft_?patient bold/i] },
  { name: 'EFT_Atara', files: [/eft_?atara/i] },
  { name: 'EFT_Devash Heavy', files: [/devash/i] },
  { name: 'Monotype Corsiva', files: [/mtcorsva/i] },
  { name: 'Cambria Bold', files: [/cambriab/i] },
];
function adminDialog() {
  const have = new Set(customFontNames());
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg'; dlg.dir = 'rtl';
  dlg.innerHTML = `<button type="button" class="x-close">✕</button><h3>⚙ ${h(t('adminTitle'))}</h3>
    <h4>${h(t('fontsTitle'))}</h4>
    <ul class="lx-fonts">${LUACH_FONTS.map((f) => `<li>${have.has(f.name) ? '✅' : '❌'} ${h(f.name)}</li>`).join('')}</ul>
    <p class="muted small">${h(t('fontsHelp'))}</p>
    <input type="file" id="lx-ff" multiple accept=".ttf,.otf,.ttc">
    <p id="lx-fmsg" class="muted"></p>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.x-close', dlg).onclick = close;
  $('#lx-ff', dlg).onchange = async (e) => {
    const msg = $('#lx-fmsg', dlg);
    const files = [...e.target.files]; let n = 0; const skipped = [];
    for (const file of files) {
      const f = LUACH_FONTS.find((x) => x.files.some((re) => re.test(file.name)));
      if (!f) { skipped.push(file.name); continue; }
      msg.textContent = `${f.name}…`;
      try { await uploadFont(file, f.name); n += 1; } catch (err) { skipped.push(`${file.name} (${err.message})`); }
    }
    await loadFonts();
    msg.textContent = `✅ ${n}${skipped.length ? ` · ${t('skipped')}: ${skipped.join(', ')}` : ''}`;
    renderLuach();
  };
}

// ---------- ווערטער (עברית / אידיש / ענגליש) ----------
const TX = {
  prev: ['הקודם', 'פריער', 'Prev'], next: ['הבא', 'ווייטער', 'Next'], pdf: ['הורדת PDF', 'PDF אראפנעמען', 'Download PDF'],
  hint: ['לחיצה על יום — להוסיף או להסתיר שורה. הזמנים מחושבים (בארא פארק); אחרי העלאת טבלת chaitables הם יהיו לפיה.', 'קליקט אויף א טאג — צולייגן אדער באהאלטן א שורה. די זמנים זענען גערעכנט (בארא פארק).', 'Click a day to add or hide a line. Times are calculated for Boro Park.'],
  fontsMissing: ['חסרים גופנים של הלוח — המראה עדיין לא כמו בדפוס.', 'עס פעלן גופנים פונעם לוח.', 'Calendar fonts are missing.'],
  fontsUp: ['העלאת גופנים', 'ארויפלייגן גופנים', 'Upload fonts'],
  auto: ['מה שהמחשב שם', 'וואס דער קאמפיוטער שטעלט', 'Automatic'], hide: ['הסתר', 'באהאלטן', 'Hide'], hidden: ['מוסתר', 'באהאלטן', 'Hidden'],
  restore: ['החזר', 'צוריק', 'Restore'], added: ['נוסף ביד', 'צוגעלייגט', 'Added'], del: ['מחק', 'אויסמעקן', 'Delete'], add: ['הוסף', 'צולייגן', 'Add'],
  textPh: ['טקסט…', 'טעקסט…', 'Text…'], kHol: ['שורה ראשית', 'הויפט שורה', 'Main line'], kNote: ['הערה קטנה למטה', 'קליינע הערה', 'Small note'],
  kSmall: ['הערה בולטת', 'בולטע הערה', 'Highlighted note'], kHil: ['הילולא (עם נר)', 'הילולא (מיט א ליכט)', 'Hillula (with candle)'],
  editNote: ['השינוי נשמר לתאריך הזה בלבד (בשנה הזו).', 'די ענדערונג איז נאר פאר דעם טאג.', 'The change applies to this date only.'],
  from: ['מ', 'פון', 'From'], to: ['עד', 'ביז', 'To'], allYear: ['כל השנה', 'דאס גאנצע יאר', 'Whole year'],
  pdfHint: ['ייפתח חלון הדפסה: בחר "Save as PDF" / "שמור כ-PDF". הגודל 11.38×6.85 אינץ\' כולל 7 מ"מ bleed לחיתוך. בהגדרות: שוליים "ללא", ו-"גרפיקת רקע" מסומן.', 'עס עפנט זיך א דרוק-פענצטער: קלייבט "Save as PDF".', 'A print window opens: choose "Save as PDF". Margins: none; background graphics: on.'],
  print: ['הדפסה / PDF', 'דרוקן / PDF', 'Print / PDF'], adminTitle: ['הגדרות הלוח', 'לוח איינשטעלונגען', 'Calendar settings'],
  fontsTitle: ['גופני הלוח', 'די גופנים פונעם לוח', 'Calendar fonts'],
  fontsHelp: ['בחר את כל קבצי הגופנים בבת אחת (מהתיקייה C:\\Users\\85100\\AppData\\Local\\Microsoft\\Windows\\Fonts). הם נשמרים בגיליון הפרטי בלבד — לא באתר הציבורי.', 'קלייבט אלע גופנים אויף איינמאל.', 'Select all the font files at once.'],
  skipped: ['דולגו', 'איבערגעשפרונגען', 'Skipped'],
};
function t(k) { const i = { he: 0, yi: 1, en: 2 }[getLang()] ?? 0; return (TX[k] || [k])[i] || TX[k]?.[0] || k; }
void isoOf;
