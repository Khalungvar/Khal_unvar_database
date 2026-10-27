// 🖨 הדפסת זמני התפילה: בוחרים סוג (ימות החול / שבת / יו"ט / ימי דפגרא ותעניות / תשרי), תאריכים, גודל וגופן → מדפיסים / PDF / JPG
import { printCss, weekdayPage, shabbosPage, specialPage, buildSpecial, fitPages, GROUPS, SIZES } from './tfprint.js';
import { tefilaData } from './tefila.js';
import { daysOf } from './minyanim.js';
import { buildYear, hdOf, isoOf, nOf, dowOf } from './engine.js';
import { LOCATIONS } from './zmanim.js';
import { hebrewNumber, todayIso, toHebrew, monthHe } from '../hebdate.js';
import { customFontNames } from '../fonts.js';
import { htmlToJpeg, jpegsToPdf } from '../pdf.js';
import { escapeHtml as h } from '../util.js';

const LOC = LOCATIONS.bp;
const $ = (s, r = document) => r.querySelector(s);
const TYPES = [['weekday', 'ימות החול'], ['shabbos', 'שבת'], ['yt', 'יו"ט'], ['minor', 'ימי דפגרא ותעניות'], ['tishrei', 'תשרי']];
const st = { type: 'weekday', mode: 'parsha', fri: null, from: '', to: '', grp: '', size: 'letter', font: '', title: '', pasuk: '', psrc: '' };
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };

const yc = new Map();
const dayOf = (n) => { const Y = hdOf(n).y; for (const y of [Y, Y + 1]) { if (!yc.has(y)) yc.set(y, buildYear(y, {}, { loc: LOC })); const d = yc.get(y).days.find((x) => x.n === n); if (d) return d; } return null; };
const parshaOf = (sat) => { const d = dayOf(sat); return d?.parsha || d?.items.find((i) => i.kind === 'hol')?.text || ''; };
const dateHe = (n) => { const x = toHebrew(isoOf(n)); return x ? `${hebrewNumber(x.d)} ${monthHe(x.m)}` : isoOf(n); };
const fonts = () => [...customFontNames(), 'Frank Ruhl Libre'];
const defFont = () => { const f = lsGet('tp-font'); return fonts().includes(f) ? f : (customFontNames().find((n) => !/bold/i.test(n)) || 'Frank Ruhl Libre'); };

/** די קומענדיגע ער"ש (40 וואכן) */
function fridays() {
  let f = nOf(todayIso()); while (dowOf(f) !== 5) f += 1;
  if (dowOf(nOf(todayIso())) === 6) f -= 7; // שבת: די היינטיגע וואך
  return Array.from({ length: 40 }, (_, i) => f + i * 7);
}
/** די קומענדיגע מאל פון יעדער גרופע (דאס יאר און דאס קומענדיגע) */
function occurrences(part) {
  const today = nOf(todayIso()); const y0 = hdOf(today).y; const out = [];
  for (const [key, label, whens] of GROUPS[part] || []) {
    for (const Y of [y0, y0 + 1]) {
      const ds = whens.flatMap((w) => daysOf(w, Y)).sort((a, b) => a - b);
      if (!ds.length || ds[ds.length - 1] < today) continue;
      out.push({ v: `${key}|${Y}`, key, Y, label: `${label} ${hebrewNumber(Y % 1000)}`, first: ds[0] });
    }
  }
  return out.sort((a, b) => a.first - b.first);
}

let ui = null; let back = null; let data = null;
export async function openTfPrint(main, onBack, helpers) {
  ui = helpers; back = onBack;
  main.innerHTML = '<p class="muted">…</p>';
  data = await tefilaData();
  if (!st.font) st.font = defFont();
  if (!st.fri) st.fri = fridays()[0];
  render(main);
}

function pagesHtml() {
  if (st.type === 'weekday' || st.type === 'shabbos') {
    let fris = [st.fri];
    if (st.mode === 'range' && st.from && st.to) {
      let f = nOf(st.from); while (dowOf(f) !== 5) f += 1;
      fris = []; for (; f <= nOf(st.to) + 1 && fris.length < 30; f += 7) fris.push(f);
    }
    return fris.map((fri) => {
      const p = parshaOf(fri + 1);
      return st.type === 'weekday' ? weekdayPage(data, fri - 5, fri, p, LOC, st.size) : shabbosPage(data, fri, `זמני שבת פרשת ${p}`, LOC, st.size);
    }).join('');
  }
  const occ = occurrences(st.type);
  const o = occ.find((x) => x.v === st.grp) || occ[0];
  if (!o) return '<p class="muted">אין מה להדפיס.</p>';
  st.grp = o.v;
  const g = GROUPS[st.type].find(([k]) => k === o.key);
  const b = buildSpecial(data, st.type, g[2], o.Y, LOC);
  return specialPage({ title: st.title || g[3], pasuk: st.pasuk || b.pasuk, psrc: st.psrc || b.psrc, sections: b.sections, cols: st.type === 'tishrei' ? 2 : 1 }, st.size);
}

function render(main) {
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${h(k)}"${String(k) === String(v) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`;
  const special = !['weekday', 'shabbos'].includes(st.type);
  const occ = special ? occurrences(st.type) : [];
  main.innerHTML = `<div class="lx-bar">
      <button type="button" class="btn ghost" id="tp-back">← זמני תפילות ביהמ"ד בארא פארק</button>
      <b class="lx-title">🖨 הדפסת זמני התפילה</b>
      <div class="lang-switch">${TYPES.map(([k, l]) => `<button type="button" data-tp="${k}" class="${k === st.type ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div class="tp-ctl">
      ${special ? `<label>מתי: ${sel('tp-grp', occ.map((o) => [o.v, `${o.label} (${dateHe(o.first)})`]), st.grp)}</label>
        <label>כותרת: <input id="tp-title" value="${h(st.title)}" placeholder="${h((GROUPS[st.type].find(([k]) => k === (st.grp || occ[0]?.v || '').split('|')[0]) || [])[3] || '')}"></label>
        <label>פסוק: <input id="tp-pasuk" class="tp-wide" value="${h(st.pasuk)}" placeholder="(מהבלוק, אם יש)"></label>`
    : `<span class="lang-switch"><button type="button" data-mode="parsha" class="${st.mode === 'parsha' ? 'on' : ''}">לפי פרשה</button><button type="button" data-mode="range" class="${st.mode === 'range' ? 'on' : ''}">מיום עד יום</button></span>
        ${st.mode === 'parsha' ? sel('tp-fri', fridays().map((f) => [f, `פרשת ${parshaOf(f + 1)} — ${dateHe(f + 1)}`]), st.fri)
    : `<label>מ- <input type="date" id="tp-from" value="${h(st.from)}"></label><label>עד <input type="date" id="tp-to" value="${h(st.to)}"></label><span class="muted small">דף לכל שבוע</span>`}`}
      <label>גודל: ${sel('tp-size', Object.entries(SIZES).map(([k, v]) => [k, v.label]), st.size)}</label>
      <label>גופן: ${sel('tp-font', fonts().map((f) => [f, f]), st.font)}</label>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="tp-print">🖨 הדפסה</button>
      <button type="button" class="btn" id="tp-pdf">PDF</button>
      <button type="button" class="btn" id="tp-jpg">JPG</button>
    </div>
    <style id="tp-css">${printCss(st.font)}</style>
    <div class="tp-prev" id="tp-prev">${pagesHtml()}</div>`;
  const prev = $('#tp-prev', main);
  // תצוגה מוקטנת: יעדער בלאט אין א ראם אין דער ריכטיגער גרייס
  const sc = st.size === 'tabloid' ? 0.42 : 0.62;
  [...prev.querySelectorAll('.tp-page')].forEach((pg) => {
    const w = document.createElement('div'); w.className = 'tp-pw';
    w.style.width = `${pg.offsetWidth * sc}px`; w.style.height = `${pg.offsetHeight * sc}px`;
    pg.replaceWith(w); const inn = document.createElement('div'); inn.className = 'tp-pi'; inn.style.transform = `scale(${sc})`; inn.append(pg); w.append(inn);
  });
  const fit = () => { fitPages(prev); };
  (document.fonts?.ready || Promise.resolve()).then(fit); fit();
  $('#tp-back', main).onclick = () => back();
  main.querySelectorAll('[data-tp]').forEach((b) => { b.onclick = () => { st.type = b.dataset.tp; st.grp = ''; st.title = ''; st.pasuk = ''; render(main); }; });
  main.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { st.mode = b.dataset.mode; render(main); }; });
  const on = (id, fn) => { const e = $(`#${id}`, main); if (e) e.onchange = () => { fn(e.value); render(main); }; };
  on('tp-fri', (v) => { st.fri = Number(v); });
  on('tp-from', (v) => { st.from = v; }); on('tp-to', (v) => { st.to = v; });
  on('tp-grp', (v) => { st.grp = v; st.title = ''; st.pasuk = ''; });
  on('tp-title', (v) => { st.title = v; }); on('tp-pasuk', (v) => { st.pasuk = v; });
  on('tp-size', (v) => { st.size = v; });
  on('tp-font', (v) => { st.font = v; lsSet('tp-font', v); });
  const pages = () => [...prev.querySelectorAll('.tp-page')];
  const name = () => (st.type === 'weekday' || st.type === 'shabbos' ? `זמני ${st.type === 'weekday' ? 'ימות החול' : 'שבת'} - פרשת ${parshaOf(st.fri + 1)}` : `זמני התפילה - ${(occurrences(st.type).find((o) => o.v === st.grp) || {}).label || ''}`);
  $('#tp-print', main).onclick = () => {
    const S = SIZES[st.size];
    let area = $('#tp-print-area');
    if (!area) { area = document.createElement('div'); area.id = 'tp-print-area'; document.body.appendChild(area); }
    area.innerHTML = `<style>${printCss(st.font)}</style>${pages().map((p) => p.outerHTML).join('')}`;
    const css = document.createElement('style');
    css.textContent = `@page { size: ${S.w}in ${S.h}in; margin: 0; }`;
    document.head.appendChild(css);
    document.body.classList.add('printing-tp');
    const done = () => { document.body.classList.remove('printing-tp'); css.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 300);
  };
  const jpgs = async (scale) => {
    const S = SIZES[st.size]; const out = [];
    for (const p of pages()) out.push(await htmlToJpeg(`<style>${printCss(st.font)}</style>${p.outerHTML}`, { widthIn: S.w, heightIn: S.h, scale, quality: 0.92 }));
    return out;
  };
  $('#tp-pdf', main).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const S = SIZES[st.size];
      const pdf = jpegsToPdf(await jpgs(3), { pageW: S.w * 72, pageH: S.h * 72, margin: 0 });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      a.download = `${name()}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (err) { ui?.toast?.(ui.friendlyError ? ui.friendlyError(err) : String(err), 'error'); }
    b.disabled = false;
  };
  $('#tp-jpg', main).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const list = await jpgs(150 / 96);
      for (const [i, j] of list.entries()) {
        const a = document.createElement('a'); a.href = j.dataUrl; a.download = `${name()}${list.length > 1 ? ` - ${i + 1}` : ''}.jpg`;
        document.body.appendChild(a); a.click(); a.remove(); await new Promise((r) => setTimeout(r, 400));
      }
    } catch (err) { ui?.toast?.(ui.friendlyError ? ui.friendlyError(err) : String(err), 'error'); }
    b.disabled = false;
  };
}
