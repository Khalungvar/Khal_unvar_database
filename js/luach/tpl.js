// 📝 תבניות הדפסה: עורך כמו וורד (גופן, גודל, צבע, יישור, טבלה) עם קודים — {פרשה}, {הדלקת נרות}, {שחרית 1} …
// "שורה חוזרת" (שחרית / מנחה / מעריב / שבת): שורה בטבלה שחוזרת לכל מניין, עם {שעה} {חדר} {הערה} / {שם} {שעה}.
// נשמר בגיליון של בית הכנסת, לשונית PrintTemplates (JSON בחלקים).
import { otherSheet } from '../google.js';
import { state } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { curSheetId } from './shul.js';
import { tefilaData } from './tefila.js';
import { autoVars } from './autovars.js';
import { computeWeekday, computeShabbos } from './minyanim.js';
import { isoOf, nOf, dowOf } from './engine.js';
import { hhmm } from './zmanim.js';
import { customFontNames } from '../fonts.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sh = () => otherSheet(curSheetId());
const tm = (m) => (m == null ? '' : hhmm(((m % 1440) + 1440) % 1440));
const SIZES = { letter: [816, 1056, '8.5in 11in', '8.5×11'], tabloid: [1056, 1632, '11in 17in', '11×17'], half: [528, 816, '5.5in 8.5in', '5.5×8.5'] };
const REP = [['shacharis', 'שחרית'], ['mincha', 'מנחה'], ['maariv', 'מעריב'], ['shabbos', 'שבת (כל הזמנים)']];
const canEdit = () => !!(state.isAllowed || state.isAdmin);
let T = []; let cur = 0; let ui = null; let saved = '';

// ---------- תבניות התחלה (לפי העיצובים הקיימים) ----------
const repTable = (g, title) => `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="background:#0f2140;color:#fff;font-size:22px;padding:4px">${title}</th></tr></thead>
  <tbody><tr data-rep="${g}"><td style="text-align:center;font-size:26px;font-weight:700;padding:2px">{שעה} <span style="font-size:14px">{חדר}</span></td></tr></tbody></table>`;
const STARTERS = {
  weekday: { name: 'ימות החול', size: 'letter', html: `<div style="border:4px double #000;padding:18px;min-height:980px">
    <h1 style="text-align:center;font-size:40px;margin:0">זמני התפילה לימות החול</h1>
    <p style="text-align:center;font-size:26px;margin:4px 0 16px">פרשת {פרשה}</p>
    <table style="width:100%;border-collapse:separate;border-spacing:12px 0"><tr>
      <td style="vertical-align:top;width:33%">${repTable('shacharis', 'שחרית')}</td>
      <td style="vertical-align:top;width:33%">${repTable('mincha', 'מנחה')}</td>
      <td style="vertical-align:top;width:33%">${repTable('maariv', 'מעריב')}</td></tr></table>
    <p style="text-align:center;font-size:18px;margin-top:24px">שקיעה: {שקיעה} · סוף זמן ק"ש מג"א {סוף זמן ק"ש מג"א} · גר"א {סוף זמן ק"ש גר"א}</p></div>` },
  shabbos: { name: 'שבת', size: 'letter', html: `<div style="border:4px double #000;padding:18px;min-height:980px">
    <h1 style="text-align:center;font-size:40px;margin:0">זמני שבת קודש</h1>
    <p style="text-align:center;font-size:28px;margin:4px 0 18px">פרשת {פרשה}</p>
    <table style="width:80%;margin:0 auto;border-collapse:collapse;font-size:30px"><tbody>
      <tr data-rep="shabbos"><td style="padding:6px;border-bottom:1px dotted #999">{שם}</td><td style="padding:6px;border-bottom:1px dotted #999;text-align:left;font-weight:700">{שעה}</td></tr></tbody></table></div>` },
};

// ---------- טעינה ושמירה ----------
async function load() {
  try {
    const rows = await sh().read('PrintTemplates!A2:D100');
    const parts = rows.filter((r) => /^data#\d+$/.test(String(r[0] || ''))).sort((a, b) => Number(String(a[0]).split('#')[1]) - Number(String(b[0]).split('#')[1]));
    T = parts.length ? JSON.parse(parts.map((r) => r[1] || '').join('')) : [];
  } catch { T = []; }
  if (!T.length) T = [{ id: 'w1', ...STARTERS.weekday }, { id: 's1', ...STARTERS.shabbos }];
  saved = JSON.stringify(T);
}
async function save() {
  const v = JSON.stringify(T); const parts = []; for (let i = 0; i < v.length; i += 40000) parts.push(v.slice(i, i + 40000));
  try { await sh().clear('PrintTemplates!A2:D100'); } catch { await sh().addTab('PrintTemplates'); }
  const st = nowStamp();
  await sh().write(`PrintTemplates!A1:D${parts.length + 1}`, [['key', 'value', 'updated_at', 'updated_by'], ...parts.map((x, i) => [`data#${i}`, x, st, state.email])]);
  saved = v;
}

// ---------- מילוי הקודים לשבוע ----------
function sundayOf(iso) { const n = nOf(iso); return n - dowOf(n); }
function fill(html, data, iso) {
  const sun = sundayOf(iso); const fri = sun + 5;
  const vars = { ...autoVars(data, isoOf(fri)), ...autoVars(data, iso) };
  const w = computeWeekday(data, sun + 1, undefined, { plain: true });
  const groups = { shacharis: w.shacharis || [], mincha: w.mincha || [], maariv: w.maariv || [] };
  const shab = computeShabbos(data, fri).filter((r) => r.min != null).map((r) => ({ name: r.label, min: r.min }));
  Object.entries(groups).forEach(([g, list]) => { const nm = REP.find(([k]) => k === g)[1]; list.forEach((m, i) => { vars[`${nm} ${i + 1}`] = tm(m.min); }); });
  shab.forEach((r, i) => { vars[`שבת ${i + 1}`] = `${r.name} ${tm(r.min)}`; });
  const box = document.createElement('div'); box.innerHTML = html;
  for (const row of [...box.querySelectorAll('[data-rep]')]) {
    const g = row.dataset.rep; const items = g === 'shabbos' ? shab : groups[g] || [];
    for (const it of items) {
      const c = row.cloneNode(true); c.removeAttribute('data-rep');
      c.innerHTML = c.innerHTML.replace(/\{(שעה|חדר|הערה|שם)\}/g, (m, k) => h(k === 'שעה' ? tm(it.min) : k === 'חדר' ? (it.room || '') : k === 'הערה' ? (it.note || '') : (it.name || '')));
      row.before(c);
    }
    row.remove();
  }
  return box.innerHTML.replace(/\{([^{}]{1,40})\}/g, (m, k) => (vars[k] != null ? h(String(vars[k])) : m));
}
function codeList(data, iso) {
  const v = Object.keys(autoVars(data, iso));
  return [...REP.slice(0, 3).flatMap(([, nm]) => [1, 2, 3].map((i) => `${nm} ${i}`)), 'שבת 1', 'שבת 2', ...v];
}

// ---------- העורך ----------
const FONTS = () => [...new Set(['Frank Ruhl Libre', 'David Libre', 'PFT_Vilna', 'Livorna', 'Arial', 'Times New Roman', ...customFontNames()])];
function render(main, onBack, data) {
  const t = T[cur]; const ed = canEdit(); const [W, H, , ] = SIZES[t.size] || SIZES.letter;
  const today = isoOf(nOf(new Date().toISOString().slice(0, 10)));
  main.innerHTML = `<div class="lx-bar"><button type="button" class="btn ghost" id="tp-back">← חזרה</button><b class="lx-title">📝 תבניות הדפסה</b>
    <select id="tp-pick">${T.map((x, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select>
    ${ed ? '<button type="button" class="btn small-btn" id="tp-new">➕ תבנית חדשה</button><button type="button" class="btn small-btn ghost" id="tp-del">🗑</button>' : ''}
    <span class="spacer"></span>
    <label class="small">שבוע: <input type="date" id="tp-date" value="${today}"></label>
    <button type="button" class="btn" id="tp-pv">👁 תצוגה עם הזמנים</button><button type="button" class="btn" id="tp-print">🖨 הדפסה / PDF</button>
    ${ed ? '<button type="button" class="btn primary" id="tp-save">💾 שמירה</button>' : ''}</div>
  <div class="tp-tools">
    <input id="tp-name" value="${h(t.name)}" title="שם התבנית" style="width:10em">
    <select id="tp-size">${Object.entries(SIZES).map(([k, s]) => `<option value="${k}"${k === t.size ? ' selected' : ''}>${s[3]}</option>`).join('')}</select>
    <select data-cmd="fontName"><option value="">גופן</option>${FONTS().map((f) => `<option>${h(f)}</option>`).join('')}</select>
    <select data-cmd="size"><option value="">גודל</option>${[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72].map((s) => `<option>${s}</option>`).join('')}</select>
    <button type="button" data-cmd="bold"><b>B</b></button><button type="button" data-cmd="italic"><i>I</i></button><button type="button" data-cmd="underline"><u>U</u></button>
    <input type="color" data-cmd="foreColor" title="צבע טקסט"><input type="color" data-cmd="hiliteColor" value="#ffffff" title="צבע רקע">
    <button type="button" data-cmd="justifyRight">⯈</button><button type="button" data-cmd="justifyCenter">≡</button><button type="button" data-cmd="justifyLeft">⯇</button>
    <button type="button" id="tp-table">▦ טבלה</button>
    <select id="tp-code"><option value="">{ } הכנס קוד</option>${codeList(data, today).map((c) => `<option>${h(c)}</option>`).join('')}</select>
    <select id="tp-rep"><option value="">↻ שורה חוזרת</option>${REP.map(([k, l]) => `<option value="${k}">${h(l)}</option>`).join('')}</select>
    <button type="button" id="tp-src" title="עריכת HTML">&lt;/&gt;</button>
  </div>
  <p class="muted small">שורה חוזרת = שורה בטבלה שמשוכפלת לכל מניין. בתוכה: {שעה} {חדר} {הערה} (בשבת: {שם} {שעה}). כל קוד אחר — מתמלא לפי השבוע שנבחר.</p>
  <div class="tp-stage"><div id="tp-page" class="tp-page" style="width:${W}px;min-height:${H}px" contenteditable="${ed}" dir="rtl">${t.html}</div></div>`;
  const page = $('#tp-page', main);
  const sync = () => { t.html = page.innerHTML; };
  page.addEventListener('input', sync);
  $('#tp-back', main).onclick = () => { sync(); if (JSON.stringify(T) !== saved && !confirm('יש שינויים שלא נשמרו. לצאת?')) return; onBack(); };
  $('#tp-pick', main).onchange = (e) => { sync(); cur = Number(e.target.value); render(main, onBack, data); };
  $('#tp-name', main).onchange = (e) => { t.name = e.target.value.trim() || t.name; sync(); render(main, onBack, data); };
  $('#tp-size', main).onchange = (e) => { sync(); t.size = e.target.value; render(main, onBack, data); };
  const nb = $('#tp-new', main);
  if (nb) nb.onclick = () => {
    sync(); const kind = prompt('תבנית חדשה: 1 = ימות החול, 2 = שבת, 3 = דף ריק', '1'); if (!kind) return;
    const base = kind === '2' ? STARTERS.shabbos : kind === '3' ? { name: 'דף חדש', size: 'letter', html: '<p>כתוב כאן…</p>' } : STARTERS.weekday;
    T.push({ id: `t${Date.now().toString(36)}`, ...JSON.parse(JSON.stringify(base)), name: `${base.name} (${T.length + 1})` }); cur = T.length - 1; render(main, onBack, data);
  };
  const db = $('#tp-del', main);
  if (db) db.onclick = () => { if (T.length < 2 || !confirm(`למחוק את התבנית "${t.name}"?`)) return; T.splice(cur, 1); cur = 0; render(main, onBack, data); };
  $$('[data-cmd]', main).forEach((el) => {
    const run = () => {
      page.focus(); const c = el.dataset.cmd;
      if (c === 'size') { if (!el.value) return; document.execCommand('fontSize', false, '7'); $$('font[size="7"]', page).forEach((f) => { const s = document.createElement('span'); s.style.fontSize = `${el.value}px`; s.innerHTML = f.innerHTML; f.replaceWith(s); }); el.value = ''; }
      else if (el.tagName === 'SELECT' || el.type === 'color') { if (el.value) document.execCommand(c, false, el.value); if (el.tagName === 'SELECT') el.value = ''; }
      else document.execCommand(c, false, null);
      sync();
    };
    if (el.tagName === 'BUTTON') el.onmousedown = (e) => { e.preventDefault(); run(); }; else el.onchange = run;
  });
  $('#tp-table', main).onmousedown = (e) => {
    e.preventDefault(); const r = Number(prompt('כמה שורות?', '3')) || 0; const c = Number(prompt('כמה עמודות?', '2')) || 0; if (!r || !c) return;
    page.focus(); document.execCommand('insertHTML', false, `<table style="width:100%;border-collapse:collapse">${Array.from({ length: r }, () => `<tr>${Array.from({ length: c }, () => '<td style="border:1px solid #999;padding:4px">&nbsp;</td>').join('')}</tr>`).join('')}</table><p></p>`); sync();
  };
  $('#tp-code', main).onchange = (e) => { const v = e.target.value; e.target.value = ''; if (!v) return; page.focus(); document.execCommand('insertText', false, `{${v}}`); sync(); };
  $('#tp-rep', main).onchange = (e) => {
    const g = e.target.value; e.target.value = ''; if (!g) return; page.focus();
    const inner = g === 'shabbos' ? '<td style="padding:4px">{שם}</td><td style="padding:4px;font-weight:700">{שעה}</td>' : '<td style="padding:2px;text-align:center;font-weight:700">{שעה} <span style="font-size:.6em">{חדר}</span></td>';
    document.execCommand('insertHTML', false, `<table style="width:100%;border-collapse:collapse"><tbody><tr data-rep="${g}">${inner}</tr></tbody></table><p></p>`); sync();
  };
  $('#tp-src', main).onclick = () => {
    sync(); const d = document.createElement('dialog'); d.className = 'sheet wide';
    d.innerHTML = `<h3>HTML של התבנית</h3><textarea dir="ltr" style="width:100%;height:60vh;font-family:monospace;font-size:12px">${h(t.html)}</textarea><div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>עדכון</button></div>`;
    document.body.append(d); d.addEventListener('close', () => d.remove()); d.showModal();
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('[data-ok]').onclick = () => { t.html = d.querySelector('textarea').value; d.close(); render(main, onBack, data); };
  };
  const doc = (body) => { const [, , pg] = SIZES[t.size] || SIZES.letter; return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${h(t.name)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700;900&family=David+Libre:wght@400;700&display=swap" rel="stylesheet">
    <style>@page{size:${pg};margin:0.3in} body{margin:0;font-family:'Frank Ruhl Libre',serif} table{page-break-inside:avoid}</style></head><body>${body}</body></html>`; };
  const filled = () => fill(t.html, data, $('#tp-date', main).value || today);
  $('#tp-pv', main).onclick = () => { sync(); const w = window.open('', '_blank'); if (!w) return; w.document.write(doc(filled())); w.document.close(); };
  $('#tp-print', main).onclick = () => { sync(); const w = window.open('', '_blank'); if (!w) return; w.document.write(doc(`${filled()}<script>setTimeout(()=>print(),600)<\/script>`)); w.document.close(); };
  const sv = $('#tp-save', main);
  if (sv) sv.onclick = async () => { sync(); sv.disabled = true; try { await save(); ui?.toast?.('נשמר ✓'); } catch (err) { ui?.toast?.(String(err.message || err), 'error'); } sv.disabled = false; };
}

export async function openTemplates(main, onBack, helpers) {
  ui = helpers; main.innerHTML = '<p class="muted">…</p>';
  const [data] = await Promise.all([tefilaData(), load()]);
  cur = Math.min(cur, T.length - 1);
  render(main, onBack, data);
}
export { fill as fillTemplateHtml, STARTERS };
