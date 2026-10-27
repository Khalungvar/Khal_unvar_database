// "זמני תפילות" — ניהול: ימות החול · שבת · יום טוב · תשרי. די דאטן: לשונית Minyanim (key = data, value = JSON).
// דער חשבון (וואס קומט ארויס פאר א טאג) איז אין minyanim.js — דאס זעלבע וואס די תצוגה אין בית הכנסת ניצט.
import { defaults, condOf, ANCHORS, BASES, ROUNDS, SEASONS, WHEN, describe, daysOf, computeWeekday, computeShabbos, computeSpecial, nOf, isoOf } from './minyanim.js';
import { hhmm } from './zmanim.js';
import { hdOf, dowOf } from './engine.js';
import { MONTH } from './mitzva.js';
import { hebrewNumber, todayIso } from '../hebdate.js';
import { readTabs, appendRow, updateRange } from '../google.js';
import { state } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let ui = {};
export function initTefila(helpers) { ui = helpers; }

const TABS = [['weekday', 'ימות החול'], ['shabbos', 'שבת'], ['minor', 'ימי דפגרא ותעניות'], ['yt', 'ערב יו"ט ויו"ט'], ['tishrei', 'תשרי']];
const GROUPS = [['shacharis', 'שחרית'], ['mincha', 'מנחה'], ['maariv', 'מעריב']];
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
let data = null; let row = 0; let dirty = false; let tab = 'weekday'; let prevIso = todayIso(); let saving = false;
const canEdit = () => !!(state.isAllowed || state.isAdmin);

async function load(force = false) {
  if (data && !force) return;
  try {
    const t = await readTabs(['Minyanim']);
    const [hd = [], ...rs] = t.Minyanim || [];
    const i = rs.findIndex((r) => r[hd.indexOf('key')] === 'data');
    row = i >= 0 ? i + 2 : 0;
    data = i >= 0 ? JSON.parse(rs[i][hd.indexOf('value')] || '{}') : null;
  } catch { data = null; row = 0; }
  const d = defaults();
  data = { ...d, ...(data || {}) };
  dirty = false;
}
async function save() {
  if (saving) return;
  saving = true;
  try {
    const v = JSON.stringify(data);
    if (row) await updateRange(`Minyanim!A${row}:D${row}`, [['data', v, nowStamp(), state.email]]);
    else { await appendRow('Minyanim', ['data', v, nowStamp(), state.email]); await load(true); }
    dirty = false; ui.toast?.('נשמר ✓');
  } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  saving = false;
}

// ---------- דרך (path) צו א פעלד: "weekday.mincha.3.room" ----------
const get = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), data);
function set(p, v) {
  const ks = p.split('.'); const last = ks.pop();
  const o = ks.reduce((x, k) => x[k], data); o[last] = v;
}
let uid = 0; const newId = () => `m${Date.now().toString(36)}${(uid += 1)}`;

// ---------- א זמן: באזע + שעה / ±מינוט + עיגול ----------
function tsHtml(T, path, allowNone = false) {
  const b = T ? T.b : 'none'; const dis = canEdit() ? '' : ' disabled';
  const opts = [...(allowNone ? [['none', '—']] : []), ...BASES].map(([k, l]) => `<option value="${k}"${k === b ? ' selected' : ''}>${h(l)}</option>`).join('');
  const rk = T && T.b !== 'fixed' ? `${T.r || 1}${T.m || 'n'}` : '1n';
  return `<span class="tf-ts" data-ts="${h(path)}"><select data-k="b"${dis}>${opts}</select>${
    !T ? '' : T.b === 'fixed' ? `<input type="time" data-k="t" value="${h(T.t || '')}"${dis}>`
      : `<select data-k="sg" class="tf-sg" title="+ אחרי / − לפני"${dis}><option value="+"${(Number(T.a) || 0) >= 0 && !T._neg ? ' selected' : ''}>+</option><option value="-"${(Number(T.a) || 0) < 0 || T._neg ? ' selected' : ''}>−</option></select><input type="number" min="0" data-k="a" value="${Math.abs(Number(T.a) || 0)}" step="1" title="דקות"${dis}><select data-k="r"${dis}>${ROUNDS.map(([k, l]) => `<option value="${k}"${k === rk ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`}</span>`;
}
function tsChange(path, k, v) {
  let T = get(path);
  if (k === 'b') {
    if (v === 'none') T = null;
    else if (v === 'fixed') T = { b: 'fixed', t: T?.t || '' };
    else T = { b: v, a: T && T.b !== 'fixed' ? T.a || 0 : 0, r: T?.r || 1, m: T?.m || 'n' };
    set(path, T); return true; // צייכן איבער (אנדערע פעלדער)
  }
  if (!T) return false;
  if (k === 't') T.t = v;
  else if (k === 'a') { const neg = (Number(T.a) || 0) < 0 || T._neg; T.a = Math.abs(Number(v) || 0) * (neg ? -1 : 1); if (T.a) delete T._neg; }
  else if (k === 'sg') { const abs = Math.abs(Number(T.a) || 0); T.a = v === '-' ? -abs : abs; if (v === '-' && !abs) T._neg = true; else delete T._neg; }
  else if (k === 'r') { T.r = parseInt(v, 10) || 1; T.m = v.replace(/\d+/, '') || 'n'; }
  return false;
}
// עונה: ווען "מ... עד..." — צוויי באקסן
const seasonHtml = (p, list) => `${sel(`${p}.season`, list)}${get(`${p}.season`) === 'custom' ? `<span class="tf-rng">מ${sel(`${p}.from`, ANCHORS)} עד${sel(`${p}.to`, ANCHORS)}</span>` : ''}`;
const fld = (path, type = 'text', extra = '') => {
  const v = get(path); const dis = canEdit() ? '' : ' disabled';
  if (type === 'check') return `<input type="checkbox" data-f="${h(path)}"${v ? ' checked' : ''}${dis}${extra}>`;
  return `<input type="${type}" data-f="${h(path)}" value="${h(v ?? '')}"${dis}${extra}>`;
};
const sel = (path, opts) => `<select data-f="${h(path)}"${canEdit() ? '' : ' disabled'}>${opts.map(([k, l]) => `<option value="${h(k)}"${String(get(path) ?? '') === String(k) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`;
const btn = (act, path, label, title = '') => (canEdit() ? `<button type="button" class="tf-mini" data-act="${act}" data-p="${h(path)}" title="${h(title)}">${label}</button>` : '');

// ---------- "תלוי": א קנעפל; ווען אן — {לפני/אחרי} {דק'} {זמן} ----------
let condOpen = null; // { p, g } — דער חלון פון "תלוי"
const BASE_NAME = (k) => (BASES.find(([x]) => x === k) || [, k])[1];
function condBtn(r, g, p) {
  const cs = condOf(r, g);
  const txt = cs && cs.length ? cs.map((c) => `${Number(c.min) ? `${c.min} דק' ` : ''}${c.dir === 'before' ? 'לפני' : 'אחרי'} ${BASE_NAME(c.base)}`).join(' + ') : 'תלוי';
  return `<button type="button" class="tf-cond${cs && cs.length ? ' set' : ''}" data-act="condOpen" data-p="${h(p)}" data-g="${g}"${canEdit() ? '' : ' disabled'}>${h(txt)}</button>`;
}
function condDialog() {
  if (!condOpen) return '';
  const { p, g } = condOpen; const r = get(p); if (!r) return '';
  const tl = r.time?.b === 'fixed' ? r.time.t : '';
  return `<div class="tf-dlg-bg" data-act="condClose"><div class="tf-dlg">
    <h3>תלוי — ${h(GROUPS.find(([k]) => k === g)?.[1] || '')} ${h(tl)}</h3>
    <p class="muted small">המניין יוצג רק בימים שכל התנאים מתקיימים.</p>
    ${condHtml(r, g, p)}
    <div class="tf-add"><span class="spacer"></span><button type="button" class="btn primary" data-act="condClose">סגור</button></div>
  </div></div>`;
}
function condHtml(r, g, p) {
  const cs = condOf(r, g); const dis = canEdit() ? '' : ' disabled';
  if (!cs || !cs.length) return canEdit() ? `<button type="button" class="tf-cond" data-act="condOn" data-p="${h(p)}" data-g="${g}">＋ הוסף תנאי</button>` : '';
  return `<div class="tf-conds">${cs.map((c, ci) => { const cp = `${p}.cond.${ci}`; return `<span class="tf-cond on">${ci ? 'וגם' : 'רק אם'}
    <input type="number" min="0" class="tf-w4" data-f="${h(cp)}.min" value="${Number(c.min) || 0}"${dis}> דק'
    <select data-f="${h(cp)}.dir"${dis}><option value="before"${c.dir === 'before' ? ' selected' : ''}>לפני</option><option value="after"${c.dir === 'after' ? ' selected' : ''}>אחרי</option></select>
    <select data-f="${h(cp)}.base"${dis}>${BASES.filter(([k]) => k !== 'fixed').map(([k, l]) => `<option value="${k}"${k === c.base ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>
    ${btn('condDel', cp, '✕', 'הסר תנאי')}</span>`; }).join('')}${btn('condAdd', p, '＋ עוד תנאי', 'עוד תנאי')}</div>`;
}

// ---------- ימות החול ----------
function weekdayHtml() {
  const w = data.weekday;
  const groups = GROUPS.map(([g, title]) => `<section class="tf-grp">
    <h3>${title} <small>הערה: ${fld(`weekday.${g}Note`, 'text', ' class="tf-w12"')}</small></h3>
    <table class="tf-t"><thead><tr><th>שעה</th><th>חדר</th><th>הערה</th><th>עונה</th><th title="המניין מוצג רק אם הוא לפני / אחרי זמן מסוים">תלוי</th>${g === 'shacharis' ? '<th>גם בער"ש</th>' : ''}<th></th></tr></thead><tbody>
    ${(w[g] || []).map((r, i) => { const p = `weekday.${g}.${i}`; return `<tr>
      <td>${tsHtml(r.time, `${p}.time`)}</td><td>${fld(`${p}.room`, 'text', ' class="tf-w8"')}</td><td>${fld(`${p}.note`, 'text', ' class="tf-w10"')}</td>
      <td>${seasonHtml(p, SEASONS)}</td><td>${condBtn(r, g, p)}</td>
      ${g === 'shacharis' ? `<td>${fld(`${p}.fri`, 'check')}</td>` : ''}
      <td class="tf-acts">${btn('del', p, '🗑', 'מחק')}</td></tr>`; }).join('')}
    </tbody></table>
    ${canEdit() ? `<div class="tf-add"><button type="button" class="btn" data-act="addW" data-p="${g}">➕ מניין ${title}</button> <button type="button" class="btn ghost" data-act="sortW" data-p="${g}">⇅ סדר לפי שעה</button></div>` : ''}
  </section>`).join('');
  const rb = (g, title) => { const p = `weekday.rebbe.${g}`; return `<tr><td><b>${title}</b></td><td>${fld(`${p}.on`, 'check')}</td><td>${tsHtml(get(`${p}.time`), `${p}.time`)}</td>
      <td>${fld(`${p}.room`, 'text', ' class="tf-w8"')}</td><td>${fld(`${p}.note`, 'text', ' class="tf-w8"')}</td>
      <td>${fld(`${p}.before`, 'number', ' class="tf-w4" min="0"')} דק'</td><td>${fld(`${p}.after`, 'number', ' class="tf-w4" min="0"')} דק'</td>
      <td>${g === 'shacharis' ? `${fld(`${p}.fri`, 'check')} גם בער"ש` : ''}</td></tr>`; };
  const rebbe = `<section class="tf-grp tf-rebbe"><h3>מנין כ"ק מרן אדמו"ר שליט"א</h3>
    <p class="muted small">שעה עם עיגול (למשל: שקיעה +25, עיגול ל-5). מניין אחר שנופל בתוך "אין מנין אחר" לפני או אחרי — לא יוצג באותו יום.</p>
    <table class="tf-t"><thead><tr><th></th><th>פעיל</th><th>שעה</th><th>חדר</th><th>הערה</th><th>אין מנין אחר — לפניו</th><th>— אחריו</th><th></th></tr></thead><tbody>
    ${rb('shacharis', 'שחרית')}${rb('mincha', 'מנחה')}${rb('maariv', 'מעריב')}</tbody></table></section>`;
  return `${rebbe}<p class="muted small">חדר שיוצג במסך כשלמניין לא נכתב חדר (אפשר להשאיר ריק): ${fld('weekday.defaultRoom', 'text', ' class="tf-w10" placeholder="למשל: ביהמ&quot;ד"')}</p>
    <p class="muted small">שעון קיץ = מאמצע מרץ עד תחילת נובמבר · שעון חורף = שאר השנה.</p>${groups}`;
}

// ---------- שבת ----------
const SH_SEASONS = [...SEASONS, ['avos', 'שבתות פרקי אבות']];
function shabbosHtml() {
  const rs = data.shabbos.rows || [];
  return `<p class="muted small">הדלקת נרות מחושבת לבד (18 דק' לפני השקיעה) ומופיעה תמיד ראשונה. "הדלקת נרות" בשעה = של אותו יום (ער"ש או שבת).</p>
  <div class="tf-rows tf-shrows">
  ${rs.map((r, i) => { const p = `shabbos.rows.${i}`; return `<div class="tf-r">
    <div class="tf-rf${r.screen === false ? ' tf-off' : ''}"><label class="tf-scr" title="תצוגה במסך">${fld(`${p}.screen`, 'check')} 📺</label>
      ${fld(`${p}.label`, 'text', ' class="tf-w12 tf-bt" placeholder="שם"')}${sel(`${p}.day`, [['fri', 'ערב שבת'], ['sat', 'שבת']])}${tsHtml(r.time, `${p}.time`, true)}
      <span class="spacer"></span><span class="tf-acts">${btn('up', p, '↑', 'למעלה')}${btn('down', p, '↓', 'למטה')}${btn('del', p, '🗑', 'מחק')}</span></div>
    <div class="tf-rf tf-sub">${seasonHtml(p, SH_SEASONS)}${sel(`${p}.kind`, [['tefila', 'תפילה'], ['other', 'אחר']])}${fld(`${p}.note`, 'text', ' class="tf-w12" placeholder="הערה"')}</div>
  </div>`; }).join('')}
  </div>
  ${canEdit() ? '<div class="tf-add"><button type="button" class="btn" data-act="addS">➕ שורה</button></div>' : ''}`;
}

// ---------- יום טוב / תשרי: בלאקן ----------
const ON = [['all', 'כל ימי הבלוק'], ['-1', 'ערב (יום לפני)'], ['0', 'יום א\''], ['1', 'יום ב\''], ['wed', 'רביעי (ליל ד\')']];
function upcomingYear(part) {
  const x = hdOf(nOf(todayIso()));
  if (part === 'tishrei') return daysOf('bereishis', x.y)[0] >= nOf(todayIso()) ? x.y : x.y + 1;
  return daysOf(part === 'minor' ? 'tishaBav' : 'shavuos', x.y).slice(-1)[0] >= nOf(todayIso()) ? x.y : x.y + 1;
}
const dateLabel = (n) => { const x = hdOf(n); return `${DAYS[dowOf(n)]}' ${hebrewNumber(x.d)} ${MONTH[x.m] || ''}`.trim(); };
// ימי דפגרא: "כמו ימות החול" פאר יעדע תפילה; ווען נישט — אייגענע שעות. און וואס טוט זיך ער"ש
function minorHead(b, bp) {
  const like = (g) => (b.like || {})[g] !== false;
  const gs = GROUPS.map(([g, t]) => `<label class="tf-like"><input type="checkbox" data-f="${h(bp)}.like.${g}"${like(g) ? ' checked' : ''}${canEdit() ? '' : ' disabled'}> ${t}</label>`).join('');
  const own = GROUPS.filter(([g]) => !like(g)).map(([g, t]) => { const op = `${bp}.own.${g}`; const arr = get(op) || []; return `<div class="tf-own"><b>${t}:</b>
    <div class="tf-times">${arr.map((T, ti) => `<span class="tf-tm">${tsHtml(T, `${op}.${ti}`)}${btn('delT', `${op}.${ti}`, '✕', 'הסר שעה')}</span>`).join('')}${btn('addT', op, '＋ שעה')}</div></div>`; }).join('');
  const fm = b.fri?.mode === 'custom';
  return `<div class="tf-minor">
    <div class="tf-rf"><span class="muted small">מתנהג כמו ימות החול:</span>${gs}</div>
    ${own}
  </div>`;
}
function minorFri(b, bp) {
  const fm = b.fri?.mode === 'custom';
  return `<div class="tf-minor tf-frib"><div class="tf-rf"><b>🕯 כשחל בערב שבת</b> — מנחה וקבלת שבת:
    ${sel(`${bp}.fri.mode`, [['regular', 'כרגיל (לפי לשונית שבת)'], ['custom', 'שעה מיוחדת']])}${fm ? tsHtml(b.fri.time, `${bp}.fri.time`, true)
      : `${sel(`${bp}.fri.sign`, [['+', '+'], ['-', '−']])}${fld(`${bp}.fri.shift`, 'number', ' class="tf-w4" min="0"')} דק'`}</div></div>`;
}
function blocksHtml(part) {
  const Y = upcomingYear(part);
  const bs = data[part].blocks || [];
  return `<p class="muted small">התאריכים מחושבים לבד כל שנה (מוצג: ${hebrewNumber(Y % 1000)}). השעות — לעדכן כל שנה, או לקבוע ביחס לשקיעה וכו'.</p>
  ${bs.map((b, bi) => { const bp = `${part}.blocks.${bi}`; const ds = daysOf(b.when, Y); return `<section class="tf-blk">
    <div class="tf-bh">${fld(`${bp}.title`, 'text', ' class="tf-w16 tf-bt"')} ${sel(`${bp}.when`, WHEN[part])}
      <span class="muted small">${ds.length ? h(ds.length > 3 ? `${dateLabel(ds[0])} … ${dateLabel(ds[ds.length - 1])} (${ds.length} ימים)` : ds.map(dateLabel).join(' · ')) : '—'}</span>
      <span class="spacer"></span>${btn('up', bp, '↑', 'למעלה')}${btn('down', bp, '↓', 'למטה')}${btn('del', bp, '🗑', 'מחק בלוק')}</div>
    ${part === 'minor' ? minorHead(b, bp) : ''}
    <div class="tf-rows">
    ${(b.rows || []).map((r, i) => { const p = `${bp}.rows.${i}`; return `<div class="tf-r">
      <div class="tf-rf${r.screen === false ? ' tf-off' : ''}"><label class="tf-scr" title="תצוגה במסך">${fld(`${p}.screen`, 'check')} 📺</label>${fld(`${p}.label`, 'text', ' class="tf-w12" placeholder="שם"')}${fld(`${p}.note`, 'text', ' class="tf-w10" placeholder="הערה"')}
      ${sel(`${p}.on`, ON)}${sel(`${p}.kind`, [['tefila', 'תפילה'], ['other', 'אחר']])}<span class="spacer"></span><span class="tf-acts">${btn('up', p, '↑', 'למעלה')}${btn('down', p, '↓', 'למטה')}${btn('del', p, '🗑', 'מחק')}</span></div>
      <div class="tf-times">${(r.times || []).map((T, ti) => `<span class="tf-tm">${tsHtml(T, `${p}.times.${ti}`)}${btn('delT', `${p}.times.${ti}`, '✕', 'הסר שעה')}</span>`).join('')}${btn('addT', `${p}.times`, '＋ שעה')}</div>
    </div>`; }).join('')}
    </div>
    ${part === 'minor' ? minorFri(b, bp) : ''}
    ${canEdit() ? `<div class="tf-add"><button type="button" class="btn ghost" data-act="addR" data-p="${bp}.rows">➕ שורה</button></div>` : ''}
  </section>`; }).join('')}
  ${canEdit() ? `<div class="tf-add"><button type="button" class="btn" data-act="addB" data-p="${part}">➕ בלוק</button></div>` : ''}`;
}

// ---------- תצוגה מקדימה: וואס קומט ארויס פאר א טאג ----------
const tm = (m) => (m == null ? '—' : hhmm(m));
function previewHtml() {
  const n = nOf(prevIso);
  let body = '';
  if (tab === 'weekday') {
    const w = computeWeekday(data, n);
    body = dowOf(n) === 6 ? '<p class="muted">שבת — ראה "שבת"</p>' : GROUPS.map(([g, t]) => `<h4>${t}</h4><p class="tf-pv">${w[g].map((x) => `<span${x.kahal ? ' class="k"' : ''} title="${h(x.room)}">${tm(x.min)}</span>`).join(' · ') || '—'}</p>`).join('')
      + (w.last != null ? `<p><b>מנחה מנין אחרון: ${tm(w.last)}</b></p>` : '');
  } else if (tab === 'shabbos') {
    let fri = n; while (dowOf(fri) !== 5) fri += 1;
    body = `<p class="muted small">שבת ${h(isoOf(fri + 1))}</p><table class="tf-pt">${computeShabbos(data, fri).map((r) => `<tr class="${r.kind === 'tefila' ? 'k' : ''}${r.screen === false ? ' tf-off' : ''}"><td>${h(r.label)}</td><td>${tm(r.min)}</td></tr>`).join('')}</table>`;
  } else {
    const sp = computeSpecial(data, n);
    body = sp.length ? sp.map((b) => `<h4>${h(b.title)}</h4><table class="tf-pt">${b.rows.map((r) => `<tr class="${r.kind === 'tefila' ? 'k' : ''}${r.screen === false ? ' tf-off' : ''}"><td>${h(r.label)}${r.note ? ` <small>(${h(r.note)})</small>` : ''}</td><td>${r.mins.map(tm).join(' | ') || '—'}</td></tr>`).join('')}</table>`).join('')
      : '<p class="muted">אין זמנים מיוחדים ביום הזה</p>';
  }
  return `<div class="tf-pvh">תצוגה מקדימה <input type="date" id="tf-date" value="${h(prevIso)}"></div>${body}`;
}

// ---------- דער בלאט ----------
export async function openTefila(main, onBack) {
  main.innerHTML = '<p class="muted">…</p>';
  await load();
  const dr = defaults().weekday.rebbe;
  data.weekday.rebbe = { ...dr, ...(data.weekday.rebbe || {}) };
  for (const g of ['shacharis', 'mincha', 'maariv']) for (const r of data.weekday[g] || []) { r.cond = condOf(r, g); delete r.auto; }
  // תצוגה במסך — ברירת מחדל: פעיל
  for (const r of data.shabbos.rows || []) if (r.screen === undefined) r.screen = true;
  // ימי דפגרא ותעניות — אפגעטיילט פון יו"ט (אלטע דאטן)
  if (!data.minor) {
    const mw = new Set(WHEN.minor.map(([k]) => k));
    data.minor = { blocks: (data.yt.blocks || []).filter((b) => mw.has(b.when)) };
    data.yt.blocks = (data.yt.blocks || []).filter((b) => !mw.has(b.when));
    if (!data.minor.blocks.length) data.minor = defaults().minor;
  }
  for (const b of data.minor.blocks || []) {
    b.like = { shacharis: true, mincha: true, maariv: true, ...(b.like || {}) };
    b.own = { shacharis: [], mincha: [], maariv: [], ...(b.own || {}) };
    b.fri = b.fri || { mode: 'regular', time: null };
  }
  for (const part of ['yt', 'minor', 'tishrei']) for (const b of data[part].blocks || []) for (const r of b.rows || []) if (r.screen === undefined) r.screen = true;
  render(main, onBack);
}
function render(main, onBack) {
  const body = tab === 'weekday' ? weekdayHtml() : tab === 'shabbos' ? shabbosHtml() : blocksHtml(tab);
  main.innerHTML = `<div class="lx-bar">
      <button type="button" class="btn ghost" id="tf-back">← זמנים ולוחות</button>
      <b class="lx-title">🕍 זמני תפילות</b>
      <div class="lang-switch">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${canEdit() ? `<button type="button" class="btn primary" id="tf-save"${dirty ? '' : ' disabled'}>💾 שמירה</button>` : ''}
      ${canEdit() ? '<button type="button" class="btn ghost" id="tf-reset" title="למלא מחדש מברירת המחדל (הלוח השנתי + התוכנה הישנה)">↺</button>' : ''}
    </div>
    ${row ? '' : '<p class="lx-warn">⚠ עדיין לא נשמר — מוצגים הזמנים מהלוח השנתי ומהתוכנה הישנה. לעבור, לתקן ולשמור.</p>'}
    <div class="tf-wrap"><div class="tf-main">${body}</div><aside class="tf-side">${previewHtml()}</aside></div>${condDialog()}`;
  const rerender = () => render(main, onBack);
  const touched = (full) => { dirty = true; const s = $('#tf-save', main); if (s) s.disabled = false; if (full) rerender(); else $('.tf-side', main).innerHTML = previewHtml(); bindDate(); };
  const bindDate = () => { const d = $('#tf-date', main); if (d) d.onchange = () => { prevIso = d.value || todayIso(); $('.tf-side', main).innerHTML = previewHtml(); bindDate(); }; };
  bindDate();
  $('#tf-back', main).onclick = () => { if (dirty && !confirm('יש שינויים שלא נשמרו. לצאת?')) return; onBack(); };
  $$('[data-tab]', main).forEach((b) => { b.onclick = () => { tab = b.dataset.tab; rerender(); }; });
  const sv = $('#tf-save', main); if (sv) sv.onclick = async () => { await save(); rerender(); };
  const rs = $('#tf-reset', main); if (rs) rs.onclick = () => {
    if (!confirm(`למלא מחדש את "${TABS.find(([k]) => k === tab)[1]}" מברירת המחדל? (השינויים בחלק הזה יימחקו)`)) return;
    data[tab] = defaults()[tab]; touched(true);
  };
  main.oninput = main.onchange = (e) => {
    const el = e.target;
    if (el.id === 'tf-date') return;
    const f = el.closest('[data-f]'); const ts = el.closest('[data-ts]');
    if (f && f.dataset.f) {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      set(f.dataset.f, v); touched(e.type === 'change' && ((el.tagName === 'SELECT' && /\.(when|season|mode)$/.test(f.dataset.f)) || /\.(screen|like\.\w+)$/.test(f.dataset.f)));
    } else if (ts && el.dataset.k) {
      if (e.type === 'input' && el.tagName === 'SELECT') return;
      const full = tsChange(ts.dataset.ts, el.dataset.k, el.value); touched(full);
    }
  };
  main.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act; const p = b.dataset.p || '';
    if (act === 'addW') { data.weekday[p].push({ id: newId(), time: { b: 'fixed', t: '' }, room: '', note: '', season: 'all', cond: null, kahal: false, fri: p === 'shacharis', last: false }); }
    else if (act === 'sortW') { const z = { neitz: 380, shkia: 1100, candles: 1082, rt: 1172, alos: 308, chatzos: 740 }; const k = (r) => (r.time?.b === 'fixed' ? (Number(String(r.time.t).replace(':', '.')) * 60 || 0) : (z[r.time?.b] || 0) + (r.time?.a || 0)); data.weekday[p].sort((a, c) => k(a) - k(c)); }
    else if (act === 'condOpen') { condOpen = { p, g: b.dataset.g }; rerender(); return; }
    else if (act === 'condClose') { if (e.target !== b && b.classList.contains('tf-dlg-bg')) return; condOpen = null; rerender(); return; }
    else if (act === 'condOn') { const r = get(p); r.cond = [b.dataset.g === 'shacharis' ? { dir: 'after', min: 0, base: 'alos' } : b.dataset.g === 'mincha' ? { dir: 'before', min: 0, base: 'shkia' } : { dir: 'after', min: 50, base: 'shkia' }]; }
    else if (act === 'condAdd') { const r = get(p); const g = p.split('.')[1]; r.cond = condOf(r, g) || []; r.cond.push({ dir: 'before', min: 0, base: 'shkia' }); }
    else if (act === 'condDel') { const ks = p.split('.'); const ci = Number(ks.pop()); ks.pop(); const r = get(ks.join('.')); r.cond = condOf(r, ks[1]) || []; r.cond.splice(ci, 1); if (!r.cond.length) r.cond = null; }
    else if (act === 'addS') data.shabbos.rows.push({ id: newId(), label: '', day: 'sat', kind: 'tefila', season: 'all', time: { b: 'fixed', t: '' }, note: '' });
    else if (act === 'addB') data[p].blocks.push({ id: newId(), title: 'בלוק חדש', when: WHEN[p][0][0], rows: [] });
    else if (act === 'addR') get(p).push({ id: newId(), label: '', note: '', kind: 'tefila', on: 'all', times: [{ b: 'fixed', t: '' }] });
    else if (act === 'addT') get(p).push({ b: 'fixed', t: '' });
    else if (act === 'del' || act === 'delT') {
      const ks = p.split('.'); const i = Number(ks.pop()); const arr = get(ks.join('.'));
      if (act === 'del' && !confirm('למחוק?')) return;
      arr.splice(i, 1);
    } else if (act === 'up' || act === 'down') {
      const ks = p.split('.'); const i = Number(ks.pop()); const arr = get(ks.join('.')); const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]];
    } else return;
    touched(true);
  };
}
