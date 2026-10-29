// "זמני תפילות" — ניהול: ימות החול · שבת · יום טוב · תשרי. די דאטן: לשונית Minyanim (key = data, value = JSON).
// דער חשבון (וואס קומט ארויס פאר א טאג) איז אין minyanim.js — דאס זעלבע וואס די תצוגה אין בית הכנסת ניצט.
import { defaults, chagRows, TISHREI_CHAG, computeShiurim, REF_DAYS, condOf, ANCHORS, BASES, ROUNDS, COMBOS, HDOW, MINOR1, PT, maarivNight, SEASONS, WHEN, describe, daysOf, computeWeekday, computeShabbos, computeSpecial, nOf, isoOf } from './minyanim.js';
import { hhmm } from './zmanim.js';
import { hdOf, dowOf } from './engine.js';
import { MONTH } from './mitzva.js';
import { hebrewNumber, todayIso } from '../hebdate.js';
import { readTabs, otherSheet } from '../google.js';
import { CONFIG } from '../config.js';
import { versionStore, askNote, openVersions } from '../versions.js';
import { state, displayName } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { loadAway } from './away.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let ui = {};
export function initTefila(helpers) { ui = helpers; }

const TABS = [['weekday', 'ימות החול'], ['shabbos', 'שבת'], ['minor', 'חנוכה ותעניות'], ['pt', 'פורים ותשעה באב'], ['yt', 'ערב יו"ט ויו"ט'], ['tishrei', 'תשרי'], ['shiurim', 'שיעורים']];
const GROUPS = [['shacharis', 'שחרית'], ['mincha', 'מנחה'], ['maariv', 'מעריב']];
const MGROUPS = [['minchaEve', 'מנחה ערב'], ['maarivEve', 'מעריב ערב'], ['shacharis', 'שחרית'], ['mincha', 'מנחה'], ['maarivMid', 'מעריב לילות האמצע'], ['maariv', 'מעריב מוצאי']];
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
let data = null; let row = 0; let dirty = false; let tab = 'weekday'; let prevIso = todayIso(); let saving = false;
const canEdit = () => !!(state.isAllowed || state.isAdmin);

// די דאטן ליגן אין דעם גיליון פון דער תצוגה (CONFIG.DISPLAY_SHEET_ID), לשונית Minyanim:
// שורה 1 = כותרות, שורות 2.. = JSON אין שטיקער (א צעל האט א גרענעץ פון 50,000 אותיות)
const CHUNK = 40000;
const disp = () => otherSheet(CONFIG.DISPLAY_SHEET_ID);
async function load(force = false) {
  if (data && !force) return;
  let saved = null;
  try {
    const rows = await disp().read('Minyanim!A2:B200');
    const parts = rows.filter((r) => /^data#\d+$/.test(String(r[0] || ''))).sort((x, y) => Number(String(x[0]).split('#')[1]) - Number(String(y[0]).split('#')[1]));
    if (parts.length) { saved = JSON.parse(parts.map((r) => r[1] || '').join('')); row = 1; }
  } catch { /* */ }
  if (!saved) {
    // נאך נישט אריבערגעטראגן — פונעם הויפט-גיליון (אלטע לשונית Minyanim)
    try {
      const t = await readTabs(['Minyanim']);
      const [hd = [], ...rs] = t.Minyanim || [];
      const i = rs.findIndex((r) => r[hd.indexOf('key')] === 'data');
      if (i >= 0) saved = JSON.parse(rs[i][hd.indexOf('value')] || '{}');
    } catch { /* */ }
    row = 0;
  }
  const d = defaults();
  data = { ...d, ...(saved || {}) };
  dirty = false;
}
async function save() {
  if (saving) return;
  saving = true;
  try {
    const v = JSON.stringify({ ...data, rebbeAway: undefined });
    const parts = []; for (let i = 0; i < v.length; i += CHUNK) parts.push(v.slice(i, i + CHUNK));
    const stamp = nowStamp();
    await disp().clear('Minyanim!A2:D200');
    await disp().write(`Minyanim!A1:D${parts.length + 1}`, [['key', 'value', 'updated_at', 'updated_by'], ...parts.map((pt, i) => [`data#${i}`, pt, stamp, state.email])]);
    row = 1; dirty = false; ui.toast?.('נשמר ✓');
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
  const combo = T && (T.b === 'max' || T.b === 'min');
  const opts = [...(allowNone ? [['none', '—']] : []), ...BASES, ...(path.endsWith('.x') || path.endsWith('.y') ? [] : COMBOS)].map(([k, l]) => `<option value="${k}"${k === b ? ' selected' : ''}>${h(l)}</option>`).join('');
  const rk = T && T.b !== 'fixed' ? `${T.r || 1}${T.m || 'n'}` : '1n';
  if (combo) return `<span class="tf-ts tf-combo" data-ts="${h(path)}"><select data-k="b"${dis}>${opts}</select>${tsHtml(T.x, `${path}.x`)}<span class="muted">או</span>${tsHtml(T.y, `${path}.y`)}</span>`;
  return `<span class="tf-ts" data-ts="${h(path)}"><select data-k="b"${dis}>${opts}</select>${
    !T ? '' : T.b === 'fixed' ? `<input type="time" data-k="t" value="${h(T.t || '')}"${dis}>`
      : `<select data-k="sg" class="tf-sg" title="+ אחרי / − לפני"${dis}><option value="+"${(Number(T.a) || 0) >= 0 && !T._neg ? ' selected' : ''}>+</option><option value="-"${(Number(T.a) || 0) < 0 || T._neg ? ' selected' : ''}>−</option></select><input type="number" min="0" data-k="a" value="${Math.abs(Number(T.a) || 0)}" step="1" title="דקות"${dis}><select data-k="r"${dis}>${ROUNDS.map(([k, l]) => `<option value="${k}"${k === rk ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>${skHtml(T, dis)}`}</span>`;
}
// "שעות שמדלגים עליהן": אם הזמן (למשל ר"ת) יוצא בין X ל-Y — מחשבים מ-Y
const skHtml = (T, dis) => `<label class="tf-skl" title="שעות שמדלגים עליהן: אם הזמן יוצא בין שתי שעות — מחשבים מהשעה המאוחרת"><input type="checkbox" data-k="skon"${T.sk ? ' checked' : ''}${dis}> ⏭</label>${T.sk ? `<span class="tf-sk">אם ${h((BASES.find(([k]) => k === T.b) || [, ''])[1])} יוצא בין <input type="time" data-k="skf" value="${h(T.sk.from || '')}"${dis}> ל-<input type="time" data-k="skt" value="${h(T.sk.to || '')}"${dis}> — מחשבים מ-${h(T.sk.to || '…')}</span>` : ''}`;
function tsChange(path, k, v) {
  let T = get(path);
  if (k === 'b') {
    const meta = T ? Object.fromEntries(['room', 'meg', 'ez', 'rb'].filter((x) => T[x] != null).map((x) => [x, T[x]])) : {};
    if (v === 'none') T = null;
    else if (v === 'max' || v === 'min') T = T && (T.b === 'max' || T.b === 'min') ? { ...T, b: v } : { b: v, x: T && T.b ? { b: T.b, t: T.t, a: T.a, r: T.r, m: T.m } : { b: 'fixed', t: '05:30' }, y: { b: 'alos', a: 5, r: 1, m: 'n' }, ...meta };
    else if (v === 'fixed') T = { b: 'fixed', t: T?.t || '', ...meta };
    else T = { b: v, a: T && T.b !== 'fixed' ? T.a || 0 : 0, r: T?.r || 1, m: T?.m || 'n', ...(T?.sk ? { sk: T.sk } : {}), ...meta };
    set(path, T); return true; // צייכן איבער (אנדערע פעלדער)
  }
  if (!T) return false;
  if (k === 'skon') { if (v) T.sk = { from: '18:00', to: '19:00' }; else delete T.sk; return true; }
  if (k === 'skf' || k === 'skt') { T.sk = T.sk || {}; T.sk[k === 'skf' ? 'from' : 'to'] = v; return false; }
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
  const off = p.startsWith('weekday.') ? (r.campOff || []) : [];
  const parts = [...(cs || []).map((c) => `${Number(c.min) ? `${c.min} דק' ` : ''}${c.dir === 'before' ? 'לפני' : 'אחרי'} ${BASE_NAME(c.base)}`), ...(off.length ? [off.length >= (r.fri ? 6 : 5) ? 'לא בקעמפ' : `קעמפ: חוץ מ${off.length === 1 ? 'יום' : 'ימים'} ${off.map((d) => HDOW[d]).join(' ')}`] : [])];
  const txt = parts.length ? parts.join(' + ') : 'תלוי';
  return `<button type="button" class="tf-cond${parts.length ? ' set' : ''}" data-act="condOpen" data-p="${h(p)}" data-g="${g}"${canEdit() ? '' : ' disabled'}>${h(txt)}</button>`;
}
// ---------- תצוגה: איפה (מקום שבת / חול) און ממתי עד מתי ----------
let dispOpen = null;
export const dispDefault = (r) => ({ place: 'weekday', from: { mode: r.kind === 'other' ? 'daysBefore' : 'dayStart', days: 1 }, to: { mode: 'pass', min: 0 } });
const dispOf = (r) => ({ ...dispDefault(r), ...(r.disp || {}) });
function dispSummary(d) {
  const pl = d.place === 'shab' ? 'שבת' : 'חול';
  const fr = d.from.mode === 'daysBefore' ? (Number(d.from.days) === 1 ? 'מיום לפני' : `מ-${d.from.days} ימים לפני`) : d.from.mode === 'afterShacharis' ? 'מאחרי שחרית אחרונה' : 'מתחילת היום';
  const to = d.to.mode === 'dayEnd' ? 'עד סוף היום' : d.to.mode === 'after' ? `עד ${d.to.min} דק' אחרי` : 'עד הזמן';
  return `📺 ${pl} · ${fr} ${to}`;
}
const dispBtn = (r, p) => `<button type="button" class="tf-cond set tf-disp" data-act="dispOpen" data-p="${h(p)}"${canEdit() ? '' : ' disabled'}>${h(dispSummary(dispOf(r)))}</button>`;
function dispDialog() {
  if (!dispOpen) return '';
  const p = dispOpen; const r = get(p); if (!r) return '';
  if (!r.disp) r.disp = dispDefault(r);
  const d = r.disp; const dp = `${p}.disp`;
  return `<div class="tf-dlg-bg" data-act="dispClose"><div class="tf-dlg">
    <h3>תצוגה במסך — ${h(r.label || '')}</h3>
    <div class="tf-dl"><b>איפה:</b> ${sel(`${dp}.place`, [['weekday', 'מקום זמני חול (לוח התפילות)'], ['shab', 'מקום זמני שבת (תיבת העץ)']])}</div>
    <div class="tf-dl"><b>ממתי:</b> ${sel(`${dp}.from.mode`, [['dayStart', 'מתחילת היום'], ['daysBefore', 'ימים לפני'], ['afterShacharis', 'מאחרי השחרית האחרונה (יום לפני)']])}
      ${d.from.mode === 'daysBefore' ? `${fld(`${dp}.from.days`, 'number', ' class="tf-w4" min="1"')} ימים לפני` : ''}</div>
    <div class="tf-dl"><b>עד מתי:</b> ${sel(`${dp}.to.mode`, [['pass', 'עד שעבר הזמן'], ['after', 'עד דקות אחרי הזמן'], ['dayEnd', 'עד סוף היום']])}
      ${d.to.mode === 'after' ? `${fld(`${dp}.to.min`, 'number', ' class="tf-w4" min="0"')} דק' אחרי` : ''}</div>
    <div class="tf-add"><span class="spacer"></span><button type="button" class="btn primary" data-act="dispClose">סגור</button></div>
  </div></div>`;
}
function condDialog() {
  if (!condOpen) return '';
  const { p, g } = condOpen; const r = get(p); if (!r) return '';
  const tl = r.time?.b === 'fixed' ? r.time.t : '';
  return `<div class="tf-dlg-bg" data-act="condClose"><div class="tf-dlg">
    <h3>תלוי — ${h(GROUPS.find(([k]) => k === g)?.[1] || '')} ${h(tl)}</h3>
    <p class="muted small">המניין יוצג רק בימים שכל התנאים מתקיימים.</p>
    ${condHtml(r, g, p)}${p.startsWith('weekday.') ? campHtml(r, p) : ''}
    <div class="tf-add"><span class="spacer"></span><button type="button" class="btn primary" data-act="condClose">סגור</button></div>
  </div></div>`;
}
function campHtml(r, p) {
  const off = (r.campOff || []).map(Number); const dis = canEdit() ? '' : ' disabled'; const days = r.fri ? 6 : 5;
  return `<div class="tf-camp"><label><input type="checkbox" data-act="campTog" data-p="${h(p)}"${off.length ? '' : ' checked'}${dis}> <b>מתקיים בתקופת הקעמפ</b></label>
    ${off.length ? `<div>בתקופת הקעמפ לא מתקיים בימים: ${HDOW.slice(0, days).map((t, d) => `<label class="tf-cd"><input type="checkbox" data-act="campDay" data-p="${h(p)}" data-d="${d}"${off.includes(d) ? ' checked' : ''}${dis}> ${t}</label>`).join(' ')}
      <div class="muted small">${off.length >= days ? 'לא יוצג בכלל בתקופת הקעמפ.' : 'יוצג כל השבוע עם הערה קטנה "חוץ מ…".'}</div></div>` : ''}</div>`;
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
  const MON = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'].map((t, i) => [i ? String(i) : '', t || '—']);
  const DD = [['', '—'], ...Array.from({ length: 31 }, (x, i) => [String(i + 1), String(i + 1)])];
  const camp = `<section class="tf-grp tf-rebbe"><h3>תקופת קעמפ</h3>
    <p class="tf-rf">מ־${sel('weekday.camp.fromD', DD)} ${sel('weekday.camp.fromM', MON)} עד־${sel('weekday.camp.toD', DD)} ${sel('weekday.camp.toM', MON)} <span class="muted small">(כל שנה; מנין שלא מתקיים בקעמפ — בחלון "תלוי")</span></p></section>`;
  const ref = `<section class="tf-grp tf-rebbe"><h3>זמני ימות החול — לכל השבוע</h3>
    <p class="tf-rf">שעות שתלויות בשקיעה וכו' (מנין כ"ק, "תלוי") מחושבות לכל השבוע לפי: ${sel('weekday.refDay', REF_DAYS)}</p></section>`;
  return `${ref}${rebbe}${camp}<p class="muted small">חדר שיוצג במסך כשלמניין לא נכתב חדר (אפשר להשאיר ריק): ${fld('weekday.defaultRoom', 'text', ' class="tf-w10" placeholder="למשל: ביהמ&quot;ד"')}</p>
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
    <div class="tf-rf tf-sub">${seasonHtml(p, SH_SEASONS)}${sel(`${p}.kind`, [['tefila', 'תפילה'], ['other', 'אחר']])}${fld(`${p}.note`, 'text', ' class="tf-w12" placeholder="הערה"')}
      <span class="tf-away" title="בשבתות שכ&quot;ק אדמו&quot;ר שליט&quot;א נסע (✈ בדף הראשי של זמני התפילות)">✈ כשאד"ש לא נמצא: ${sel(`${p}.away`, [['', 'כרגיל'], ['hide', 'לא מוצג'], ['shift', 'מאוחר ב־']])}${r.away === 'shift' ? `${fld(`${p}.awayMin`, 'number', ' class="tf-w4" min="0"')} דק'` : ''}</span></div>
  </div>`; }).join('')}
  </div>
  ${canEdit() ? '<div class="tf-add"><button type="button" class="btn" data-act="addS">➕ שורה</button></div>' : ''}`;
}

// ---------- יום טוב / תשרי: בלאקן ----------
const ON = [['all', 'כל ימי הבלוק'], ['-1', 'ערב'], ...['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'].map((l, i) => [String(i), `יום ${l}'`]), ['fri', 'ערב שבת'], ['last', 'מוצאי (בערב היום האחרון)']];
const onOpts = (v) => (v === 'wed' ? [...ON, ['wed', 'רביעי']] : ON);
function upcomingYear(part) {
  const x = hdOf(nOf(todayIso()));
  if (part === 'tishrei') return daysOf('bereishis', x.y)[0] >= nOf(todayIso()) ? x.y : x.y + 1;
  return daysOf(part === 'minor' || part === 'pt' ? 'tishaBav' : 'shavuos', x.y).slice(-1)[0] >= nOf(todayIso()) ? x.y : x.y + 1;
}
const dateLabel = (n) => { const x = hdOf(n); return `${DAYS[dowOf(n)]}' ${hebrewNumber(x.d)} ${MONTH[x.m] || ''}`.trim(); };
// ימי דפגרא: "כמו ימות החול" פאר יעדע תפילה; ווען נישט — אייגענע שעות. און וואס טוט זיך ער"ש
function minorHead(b, bp) {
  const multi = daysOf(b.when, upcomingYear('minor')).length > 1;
  const GS = MGROUPS.filter(([g]) => (g !== 'maarivMid' || multi) && (b.type !== 'erev' || ['minchaEve', 'maarivEve', 'shacharis'].includes(g)));
  const like = (g) => (b.like || {})[g] !== false;
  const gs = GS.map(([g, t]) => `<label class="tf-like"><input type="checkbox" data-f="${h(bp)}.like.${g}"${like(g) ? ' checked' : ''}${canEdit() ? '' : ' disabled'}> ${t}</label>`).join('');
  const own = GS.filter(([g]) => !like(g)).map(([g, t]) => { const op = `${bp}.own.${g}`; const arr = get(op) || []; return `<div class="tf-own"><b>${t}:</b>
    <div class="tf-times">${arr.map((T, ti) => `<span class="tf-tm">${tsHtml(T, `${op}.${ti}`)}${btn('delT', `${op}.${ti}`, '✕', 'הסר שעה')}</span>`).join('')}${btn('addT', op, '＋ שעה')}</div></div>`; }).join('');
  const fm = b.fri?.mode === 'custom';
  return `<div class="tf-minor">
    <div class="tf-rf"><span class="muted small">מתנהג כמו ימות החול:</span>${gs}</div>
    ${own}
  </div>`;
}
// חנוכה ותעניות: נאר דער מעריב (מוצאי תענית / בחנוכה) — אנשטאט דעם מעריב הרגיל
function maarivHead(b, bp) {
  const ch = b.when === 'chanuka'; const g = ch ? 'maarivMid' : 'maariv';
  const op = `${bp}.own.${g}`; const arr = get(op) || [];
  const t = ch ? 'מעריב בחנוכה' : `מעריב מוצאי ${b.title || 'התענית'}`;
  const note = (ch ? 'בלילות חנוכה (גם בערב הראשון) המעריב הרגיל מבוטל, ומוצגים רק המנינים שכאן.' : 'במוצאי התענית המעריב הרגיל מבוטל, ומוצגים רק המנינים שכאן.')
    + ' בלי שעות — נשאר המעריב הרגיל. בתצוגה: פס משלו בלוח ימות החול, מתחילת השבוע ועד חצי שעה אחרי המנין האחרון.'
    + (b.when === 'taanisEsther' ? ' כשתענית אסתר בערב פורים — אין מעריב מוצאי תענית (מעריב וקריאת המגילה — בלשונית "פורים ותשעה באב").' : '');
  return `<div class="tf-minor"><div class="tf-own"><b>${h(t)}:</b>
    <div class="tf-times">${arr.map((T, ti) => `<span class="tf-tm">${tsHtml(T, `${op}.${ti}`)}${btn('delT', `${op}.${ti}`, '✕', 'הסר שעה')}</span>`).join('')}${btn('addT', op, '＋ שעה')}</div></div>
    <p class="muted small">${h(note)}</p></div>`;
}
// א שורה פון חג: אנדערע שעה ווען דער טאג פאלט אויס ערב שבת
function friRowHtml(r, p, key = 'fri', txt = '🕯 כשחל בערב שבת — שעה אחרת') {
  const on = !!r[key]?.on; const fp = `${p}.${key}`;
  return `<div class="tf-rf tf-frirow"><label class="tf-like"><input type="checkbox" data-f="${h(fp)}.on"${on ? ' checked' : ''}${canEdit() ? '' : ' disabled'}> ${txt}</label>
    ${on ? `<div class="tf-times">${(r[key].times || []).map((T, ti) => `<span class="tf-tm">${tsHtml(T, `${fp}.times.${ti}`)}${btn('delT', `${fp}.times.${ti}`, '✕', 'הסר שעה')}</span>`).join('')}${btn('addT', `${fp}.times`, '＋ שעה')}</div>` : ''}</div>`;
}
const isChagBlock = (part, b) => (part === 'yt' && b.type === 'chag') || (part === 'tishrei' && TISHREI_CHAG.has(b.when));
function minorFri(b, bp) {
  const fm = b.fri?.mode === 'custom';
  return `<div class="tf-minor tf-frib"><div class="tf-rf"><b>🕯 כשחל בערב שבת</b> — מנחה וקבלת שבת:
    ${sel(`${bp}.fri.mode`, [['regular', 'כרגיל (לפי לשונית שבת)'], ['custom', 'שעה מיוחדת']])}${fm ? tsHtml(b.fri.time, `${bp}.fri.time`, true)
      : `${sel(`${bp}.fri.sign`, [['+', '+'], ['-', '−']])}${fld(`${bp}.fri.shift`, 'number', ' class="tf-w4" min="0" placeholder="0"')} דק'`}</div></div>`;
}
// טבלת מנינים (להדפסה): חדר · מגילה · עזרת נשים · מנין כ"ק
const metaHtml = (tp) => `<span class="tf-meta">${fld(`${tp}.room`, 'text', ' class="tf-w6" placeholder="חדר"')}<label title="קריאת המגילה (בערך)">מגילה ${fld(`${tp}.meg`, 'time', ' class="tf-w6"')}</label><label title="עזרת נשים">${fld(`${tp}.ez`, 'check')} נשים</label><label title="מנין כ&quot;ק אדמו&quot;ר שליט&quot;א">${fld(`${tp}.rb`, 'check')} כ"ק</label></span>`;
// להדפסה: כותרת · פסוק · מקור (נשמר בבלאק)
const printHead = (bp) => `<div class="tf-rf tf-ph"><span class="muted small">🖨 להדפסה:</span>${fld(`${bp}.pasuk`, 'text', ' class="tf-w16" placeholder="פסוק בראש הדף (רשות)"')}${fld(`${bp}.psrc`, 'text', ' class="tf-w6" placeholder="מקור"')}</div>`;
// "חנוכה ותעניות" און "פורים ותשעה באב" — ביידע אין data.minor
const storeOf = (part) => (part === 'pt' ? 'minor' : part);
const whenList = (part) => (part === 'minor' ? WHEN.minor.filter(([k]) => MINOR1.includes(k)) : part === 'pt' ? WHEN.minor.filter(([k]) => PT.includes(k)) : WHEN[part]);
const inTab = (part, b) => (part === 'minor' ? MINOR1.includes(b.when) : part === 'pt' ? PT.includes(b.when) : true);
function blocksHtml(part) {
  const Y = upcomingYear(part);
  const store = storeOf(part);
  const bs = data[store].blocks || [];
  return `<p class="muted small">התאריכים מחושבים לבד כל שנה (מוצג: ${hebrewNumber(Y % 1000)}). השעות — לעדכן כל שנה, או לקבוע ביחס לשקיעה וכו'.</p>
  ${part === 'minor' ? '<p class="muted small">שחרית ומנחה — כמו בימות החול. מגדירים כאן רק את המעריב (מוצאי תענית / חנוכה).</p>' : ''}
  ${part === 'pt' ? '<p class="muted small">📺 בתצוגה: הזמנים כאן מוצגים במקום זמני השבת — מאחרי השבת שלפני ועד חצי שעה אחרי הזמן האחרון. כשחל ביום ראשון — מיום שישי אחרי שחרית האחרונה, במקום לוח ימות החול (זמני השבת נשארים).</p>' : ''}
  ${bs.map((b, bi) => { if (!inTab(part, b)) return ''; const bp = `${store}.blocks.${bi}`; let ds = daysOf(b.when, Y); let nextY = 0; if (!ds.length) { for (let y = Y + 1; y < Y + 40; y += 1) { const d2 = daysOf(b.when, y); if (d2.length) { ds = d2; nextY = y; break; } } } return `<section class="tf-blk">
    <div class="tf-bh">${fld(`${bp}.title`, 'text', ' class="tf-w16 tf-bt"')} ${sel(`${bp}.when`, whenList(part))}
      <span class="muted small">${ds.length ? h(ds.length > 3 ? `${dateLabel(ds[0])} … ${dateLabel(ds[ds.length - 1])} (${ds.length} ימים)` : ds.map(dateLabel).join(' · ')) + (nextY ? ` (הפעם הבאה: ${hebrewNumber(nextY % 1000)})` : '') : '—'}</span>
      <span class="spacer"></span>${ds.length ? `<button type="button" class="tf-mini tf-pvb" data-act="pvSide" data-d="${isoOf(ds[0])}" title="להציג את היום הזה בתצוגה המקדימה בצד">👁 תצוגה</button>` : ''}${btn('up', bp, '↑', 'למעלה')}${btn('down', bp, '↓', 'למטה')}${btn('del', bp, '🗑', 'מחק בלוק')}</div>
    ${part === 'yt' ? `<div class="tf-type ${b.type || 'erev'}">${b.type === 'chag' ? '🕯 חג — מוצג כמו שבת' : b.type === 'chm' ? '🌿 חול המועד' : '📅 ערב חג — מתנהג כמו ימות החול'}</div>` : ''}
    ${part === 'minor' ? maarivHead(b, bp) : part === 'yt' && b.type !== 'chag' ? minorHead(b, bp) : ''}
    ${printHead(bp)}
    <div class="tf-rows">
    ${(b.rows || []).map((r, i) => { const p = `${bp}.rows.${i}`; return `<div class="tf-r">
      <div class="tf-rf${r.screen === false ? ' tf-off' : ''}"><label class="tf-scr" title="תצוגה במסך">${fld(`${p}.screen`, 'check')} 📺</label>${fld(`${p}.label`, 'text', ' class="tf-w12" placeholder="שם"')}${fld(`${p}.note`, 'text', ' class="tf-w10" placeholder="הערה"')}
      ${sel(`${p}.on`, onOpts(r.on))}${sel(`${p}.kind`, [['tefila', 'תפילה'], ['other', 'אחר']])}<span class="spacer"></span><span class="tf-acts">${btn('up', p, '↑', 'למעלה')}${btn('down', p, '↓', 'למטה')}${btn('del', p, '🗑', 'מחק')}</span></div>
      <div class="tf-times">${(r.times || []).map((T, ti) => `<span class="tf-tm${r.table ? ' tf-tmt' : ''}">${tsHtml(T, `${p}.times.${ti}`)}${r.table && T ? metaHtml(`${p}.times.${ti}`) : ''}${btn('delT', `${p}.times.${ti}`, '✕', 'הסר שעה')}</span>`).join('')}${btn('addT', `${p}.times`, '＋ שעה')}<span class="spacer"></span>
        <label class="tf-like" title="להדפסה: כל שעה בשורה של טבלה, עם חדר / מגילה / עזרת נשים">${fld(`${p}.table`, 'check')} 📋 טבלה</label>${r.screen === false ? '' : dispBtn(r, p)}</div>
      ${isChagBlock(part, b) ? friRowHtml(r, p) + friRowHtml(r, p, 'sat', '🕍 כשחל בשבת — שעה אחרת') : ''}
    </div>`; }).join('')}
    </div>
    ${part === 'minor' || (part === 'yt' && b.type === 'chm') ? minorFri(b, bp) : ''}
    ${canEdit() ? `<div class="tf-add"><button type="button" class="btn ghost" data-act="addR" data-p="${bp}.rows">➕ שורה</button></div>` : ''}
  </section>`; }).join('')}
  ${canEdit() ? (part === 'yt' ? `<div class="tf-add"><button type="button" class="btn" data-act="addB" data-p="yt" data-t="erev">➕ ערב חג</button><button type="button" class="btn" data-act="addB" data-p="yt" data-t="chm">➕ חול המועד</button><button type="button" class="btn" data-act="addB" data-p="yt" data-t="chag">➕ חג</button></div>`
    : part === 'minor' || part === 'pt' ? '' : `<div class="tf-add"><button type="button" class="btn" data-act="addB" data-p="${part}">➕ בלוק</button></div>`) : ''}`;
}

// ---------- תצוגה מקדימה: וואס קומט ארויס פאר א טאג ----------
const tm = (m) => (m == null ? '—' : hhmm(m));
// ---------- שיעורים ----------
const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
function shiurimHtml() {
  const rs = data.shiurim.rows || [];
  const dis = canEdit() ? '' : ' disabled';
  return `<p class="muted small">שיעור דף יומי מוצג במסך מתחת לדף היומי. שיעור אחר — עם השם שלו. שעה שונה בימים מסוימים = שורה נוספת.</p>
  <div class="tf-rows tf-shrows">
  ${rs.map((r, i) => { const p = `shiurim.rows.${i}`; return `<div class="tf-r">
    <div class="tf-rf${r.screen === false ? ' tf-off' : ''}"><label class="tf-scr" title="תצוגה במסך">${fld(`${p}.screen`, 'check')} 📺</label>
      ${sel(`${p}.type`, [['daf', 'שיעור דף היומי'], ['other', 'שיעור אחר']])}${r.type === 'other' ? fld(`${p}.title`, 'text', ' class="tf-w12 tf-bt" placeholder="שם השיעור"') : ''}
      ${fld(`${p}.who`, 'text', ' class="tf-w16" placeholder="מי מוסר"')}${fld(`${p}.room`, 'text', ' class="tf-w8" placeholder="איפה"')}
      <span class="spacer"></span><span class="tf-acts">${btn('up', p, '↑', 'למעלה')}${btn('down', p, '↓', 'למטה')}${btn('del', p, '🗑', 'מחק')}</span></div>
    <div class="tf-rf tf-sub">${tsHtml(r.time, `${p}.time`, true)}
      <span class="tf-days">${WD.map((l, d) => `<label><input type="checkbox" data-day="${d}" data-p="${h(p)}"${(r.days || []).includes(d) ? ' checked' : ''}${dis}>${l}'</label>`).join('')}</span>
      ${seasonHtml(p, SEASONS)}${fld(`${p}.note`, 'text', ' class="tf-w12" placeholder="הערה"')}</div>
  </div>`; }).join('')}
  </div>
  ${canEdit() ? '<div class="tf-add"><button type="button" class="btn" data-act="addSh" data-t="daf">➕ שיעור דף היומי</button><button type="button" class="btn" data-act="addSh" data-t="other">➕ שיעור אחר</button></div>' : ''}`;
}
function previewHtml() {
  const n = nOf(prevIso);
  let body = '';
  if (tab === 'shiurim') {
    const list = computeShiurim(data, n);
    return `<div class="tf-pvh">תצוגה מקדימה <input type="date" id="tf-date" value="${h(prevIso)}"></div>
      <table class="tf-pt">${list.map((x) => `<tr><td>${h(x.type === 'daf' ? 'דף היומי' : x.title)}<br><small>${h(x.who)}${x.room ? ` · ${h(x.room)}` : ''}</small></td><td>${x.min == null ? h(x.note || '—') : tm(x.min)}</td></tr>`).join('') || '<tr><td class="muted">אין שיעורים ביום הזה</td></tr>'}</table>`;
  }
  if (tab === 'weekday') {
    const w = computeWeekday(data, n);
    body = dowOf(n) === 6 ? '<p class="muted">שבת — ראה "שבת"</p>' : GROUPS.map(([g, t]) => `<h4>${t}</h4><p class="tf-pv">${w[g].map((x) => `<span${x.kahal ? ' class="k"' : ''} title="${h(x.room)}">${tm(x.min)}${x.xn ? ` <small>(${h(x.xn)})</small>` : ''}</span>`).join(' · ') || '—'}</p>`).join('')
      + (w.last != null ? `<p><b>מנחה מנין אחרון: ${tm(w.last)}</b></p>` : '');
  } else if (tab === 'shabbos') {
    let fri = n; while (dowOf(fri) !== 5) fri += 1;
    body = `<p class="muted small">שבת ${h(isoOf(fri + 1))}</p><table class="tf-pt">${computeShabbos(data, fri).map((r) => `<tr class="${r.kind === 'tefila' ? 'k' : ''}${r.screen === false ? ' tf-off' : ''}"><td>${h(r.label)}</td><td>${tm(r.min)}</td></tr>`).join('')}</table>`;
  } else {
    const sp = computeSpecial(data, n);
    const mn = maarivNight(data, n);
    const mnHtml = mn ? `<h4>${h(mn.label)}</h4><p class="tf-pv">${computeWeekday(data, n).maariv.map((x) => tm(x.min)).join(' · ')}</p>` : '';
    body = mnHtml + (sp.length ? sp.map((b) => `<h4>${h(b.title)}</h4><table class="tf-pt">${b.rows.map((r) => `<tr class="${r.kind === 'tefila' ? 'k' : ''}${r.screen === false ? ' tf-off' : ''}"><td>${h(r.label)}${r.note ? ` <small>(${h(r.note)})</small>` : ''}</td><td>${r.mins.map(tm).join(' | ') || '—'}</td></tr>`).join('')}</table>`).join('')
      : mn ? '' : '<p class="muted">אין זמנים מיוחדים ביום הזה</p>');
  }
  return `<div class="tf-pvh">תצוגה מקדימה <input type="date" id="tf-date" value="${h(prevIso)}"></div>${body}`;
}

// ---------- דער בלאט ----------
/** לאדן + צוגרייטן די דאטן (אויך פאר דרוקן) */
async function prepare() {
  await load();
  normalize();
  // ✈ נסיעות (פאר דער תצוגה מקדימה) — ליגט אין אן אייגענער לשונית, נישט אין די זמנים
  try { data.rebbeAway = await loadAway(); } catch { data.rebbeAway = []; }
}
function normalize() {
  const dr = defaults().weekday.rebbe;
  data.weekday.rebbe = { ...dr, ...(data.weekday.rebbe || {}) };
  data.weekday.camp = { ...defaults().weekday.camp, ...(data.weekday.camp || {}) };
  for (const g of ['shacharis', 'mincha', 'maariv']) for (const r of data.weekday[g] || []) { r.cond = condOf(r, g); delete r.auto; }
  // תצוגה במסך — ברירת מחדל: פעיל
  for (const r of data.shabbos.rows || []) if (r.screen === undefined) r.screen = true;
  // ימי דפגרא ותעניות — אפגעטיילט פון יו"ט (אלטע דאטן)
  {
    const mw = new Set(WHEN.minor.map(([k]) => k)); const yw = new Set(WHEN.yt.map(([k]) => k));
    const moved = (data.yt.blocks || []).filter((b) => mw.has(b.when));
    if (!data.minor) data.minor = defaults().minor;
    if (moved.length) {
      // אלטע בלאקן פון יו"ט → ימי דפגרא (אן די ליידיקע שורות פון שחרית/מנחה)
      const strip = (b) => ({ ...b, rows: (b.rows || []).filter((r) => (r.times || []).length || !/^(שחרית|מנחה)$/.test(r.label)) });
      data.minor.blocks = data.minor.blocks.filter((b) => !moved.some((m) => m.when === b.when)).concat(moved.map(strip));
      const order = WHEN.minor.map(([k]) => k); data.minor.blocks.sort((x, y) => order.indexOf(x.when) - order.indexOf(y.when));
    }
    data.yt.blocks = (data.yt.blocks || []).filter((b) => yw.has(b.when));
    for (const d of defaults().yt.blocks) if (!data.yt.blocks.some((b) => b.when === d.when)) data.yt.blocks.push(d);
    const yo = WHEN.yt.map(([k]) => k); data.yt.blocks.sort((x, y) => yo.indexOf(x.when) - yo.indexOf(y.when));
  }
  // ערב חג / חג (אלטע דאטן אן type)
  const chagW = new Set(['pesach', 'shviiPesach', 'shavuos', 'shabbosChmPesach', 'erevPesachShabbos']);
  for (const b of data.yt.blocks || []) { if (!b.type) b.type = chagW.has(b.when) ? 'chag' : 'erev'; if (b.when === 'cholPesach' && b.type === 'erev') b.type = 'chm'; }
  // חג מיט די אלטע ליידיקע שורות (שחרית/מנחה) → מנחה ומעריב · שחרית · מנחה ומעריב
  for (const b of data.yt.blocks || []) if (b.type === 'chag' && b.when !== 'erevPesachShabbos' && (b.rows || []).length && (b.rows || []).every((r) => !(r.times || []).length && /^(שחרית|מנחה ומעריב)$/.test(r.label)) && b.rows.some((r) => r.on === 1 || r.on === '1')) b.rows = chagRows();
  for (const b of data.yt.blocks || []) if (b.type === 'chag' && (b.rows || []).every((r) => !(r.times || []).length && /^(שחרית|מנחה)$/.test(r.label))) b.rows = chagRows();
  for (const b of [...(data.yt.blocks || []).filter((x) => x.type === 'chag'), ...(data.tishrei.blocks || []).filter((x) => TISHREI_CHAG.has(x.when))]) {
    for (const r of b.rows || []) for (const k of ['fri', 'sat']) if (!r[k] || !Array.isArray(r[k].times)) r[k] = { on: false, times: [] };
  }
  for (const b of data.yt.blocks || []) if (b.type === 'chag') for (const r of b.rows || []) if (!r.disp) r.disp = { ...dispDefault(r), place: 'shab' };
  if (!data.yt.blocks.some((b) => b.when === 'erevShvii')) { const i = data.yt.blocks.findIndex((b) => b.when === 'shviiPesach'); const nb = defaults().yt.blocks.find((b) => b.when === 'erevShvii'); data.yt.blocks.splice(i < 0 ? data.yt.blocks.length : i, 0, nb); }
  if (!data.shiurim) data.shiurim = defaults().shiurim;
  // ל"ג בעומר — נישט מער; יעדער בלאק פון חנוכה/תעניות/פורים/ט"ב איז דא
  data.minor.blocks = (data.minor.blocks || []).filter((b) => b.when !== 'lagBaomer' || (b.rows || []).some((r) => (r.times || []).length));
  for (const d0 of defaults().minor.blocks) if (!data.minor.blocks.some((b) => b.when === d0.when)) data.minor.blocks.push(d0);
  for (const b of [...(data.minor.blocks || []), ...(data.yt.blocks || []).filter((x) => x.type !== 'chag')]) {
    b.like = { minchaEve: true, maarivEve: true, shacharis: true, mincha: true, maarivMid: true, maariv: true, ...(b.like || {}) };
    b.own = { minchaEve: [], maarivEve: [], shacharis: [], mincha: [], maarivMid: [], maariv: [], ...(b.own || {}) };
    b.fri = b.fri || { mode: 'regular', time: null };
  }
  for (const part of ['yt', 'minor', 'tishrei']) for (const b of data[part].blocks || []) for (const r of b.rows || []) if (r.screen === undefined) r.screen = true;
}
export async function tefilaData() { await prepare(); return data; }
let BACK = 'זמנים ולוחות';
export async function openTefila(main, onBack, backLabel) {
  if (backLabel) BACK = backLabel;
  main.innerHTML = '<p class="muted">…</p>';
  await prepare();
  render(main, onBack);
}
// ---------- ❓ הסבר: איך הזמנים בנויים ומה אפשר לעשות ----------
let helpOpen = false;
const HELP = `<div class="tf-help">
  <h3>❓ איך זמני התפילות עובדים</h3>
  <details open><summary><b>הזמנים של היום (בארא פארק)</b></summary><ul>
    <li><b>נץ החמה ושקיעה</b> — לפי לוח בארא פארק (כשיש טבלה), אחרת לפי חישוב אסטרונומי.</li>
    <li><b>עלות השחר</b> = 72 דקות לפני הנץ · <b>ר"ת</b> = 72 דקות אחרי השקיעה · <b>חצות</b> = באמצע בין הנץ לשקיעה.</li>
    <li><b>הדלקת נרות</b> = 18 דקות לפני השקיעה (מחושבת לבד, ומופיעה תמיד ראשונה בזמני שבת).</li>
  </ul></details>
  <details><summary><b>איך קובעים שעה של מנין</b></summary><ul>
    <li><b>שעה קבועה</b> — למשל 9:00.</li>
    <li><b>ביחס לזמן</b> — למשל "שקיעה +25", "הדלקת נרות −60", "ר"ת +120"; עם <b>עיגול</b> (ל-5, ל-10, לרבע שעה — קרוב / למאוחר / למוקדם).</li>
    <li><b>המאוחר מבין / המוקדם מבין</b> — שתי שעות, ונלקחת המאוחרת (או המוקדמת). למשל: "5:30 או עלות השחר +5 — המאוחר".</li>
    <li><b>⏭ שעות שמדלגים עליהן</b> — אם הזמן (למשל ר"ת) יוצא בין שתי שעות, מחשבים מהשעה המאוחרת. למשל שולחן הטהור: "ר"ת +120, ואם ר"ת בין 6:00 ל-7:00 — מ-7:00".</li>
  </ul></details>
  <details><summary><b>ימות החול</b></summary><ul>
    <li>כל השבוע אותן שעות: הזמנים מחושבים לפי היום שנבחר ("מחושבות לכל השבוע לפי"), והעונה / הקעמפ — לפי יום ראשון של השבוע.</li>
    <li><b>עונה</b> — כל השנה / שעון חורף / שעון קיץ / "מ... עד..." (למשל מאחרי פסח עד ראש השנה).</li>
    <li><b>תלוי</b> — המנין מוצג רק כשהוא לפני / אחרי זמן (למשל "רק אם אחרי עלות השחר"). שם גם: <b>מתקיים בתקופת הקעמפ</b> — בלי V, בוחרים באילו ימים הוא לא מתקיים (רק יום א' → מוצג כל השבוע עם "חוץ מיום א'").</li>
    <li><b>תקופת קעמפ</b> — מתאריך עד תאריך (יום וחודש, בלי שנה — חוזר כל שנה).</li>
    <li><b>מנין כ"ק אדמו"ר שליט"א</b> — שעה משלו; "אין מנין אחר לפניו / אחריו" מוריד מנינים אחרים של <u>אותה תפילה</u> בזמן הזה. מנחה כ"ק הוא תמיד המנין האחרון של מנחה.</li>
    <li><b>גם בער"ש</b> — מנין שחרית שמתקיים גם ביום שישי.</li>
  </ul></details>
  <details><summary><b>שבת</b></summary><ul>
    <li>כל שורה: שם, ער"ש או שבת, שעה, עונה (גם "שבתות פרקי אבות"), תפילה / אחר, הערה, ו-📺 אם להציג במסך.</li>
    <li><b>✈ כשאד"ש לא נמצא</b> — כרגיל / לא מוצג / מאוחר ב-X דקות. התאריכים — בכפתור "✈ כ"ק אדמו"ר שליט"א נסע" בדף הקודם (או 6 בהודעה האוטומטית לגבאי).</li>
  </ul></details>
  <details><summary><b>חנוכה ותעניות · פורים ותשעה באב · ערב יו"ט · תשרי</b></summary><ul>
    <li><b>חנוכה ותעניות</b> — שחרית ומנחה כמו בימות החול; מגדירים רק את המעריב (מוצאי התענית / בחנוכה). בתצוגה — פס משלו בלוח ימות החול, מתחילת השבוע ועד חצי שעה אחרי המנין האחרון.</li>
    <li><b>פורים ותשעה באב</b> — זמנים מיוחדים; בתצוגה במקום זמני השבת, מאחרי השבת שלפני ועד חצי שעה אחרי הזמן האחרון (כשחל ביום ראשון — במקום לוח ימות החול, מיום שישי).</li>
    <li>התאריכים של כל בלוק מחושבים לבד כל שנה. "ערב" = הערב שלפני היום הראשון.</li>
  </ul></details>
  <details><summary><b>שמירה, גרסאות ותצוגה</b></summary><ul>
    <li><b>💾 שמירה</b> — השינויים מגיעים לתצוגה בבית הכנסת תוך דקה, ולהודעות האוטומטיות.</li>
    <li><b>📌 שמור כגרסה</b> — נקודה שאפשר לחזור אליה (🕘 גרסאות).</li>
    <li><b>👁 במסך</b> — לראות את התצוגה בתאריך של התצוגה המקדימה (בלי לשמור).</li>
    <li>התצוגה בבית הכנסת מרעננת את עצמה לבד כשיש גרסה חדשה של האתר (בדיקה כל 20 דקות).</li>
  </ul></details>
</div>`;
function render(main, onBack) {
  const body = tab === 'weekday' ? weekdayHtml() : tab === 'shabbos' ? shabbosHtml() : tab === 'shiurim' ? shiurimHtml() : blocksHtml(tab);
  main.innerHTML = `<div class="lx-bar">
      <button type="button" class="btn ghost" id="tf-back">← ${h(BACK)}</button>
      <b class="lx-title">🕰 זמני התפילות והשיעורים</b>
      <div class="lang-switch">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${canEdit() ? `<button type="button" class="btn primary" id="tf-save"${dirty ? '' : ' disabled'}>💾 שמירה</button>` : ''}
${canEdit() ? '<button type="button" class="btn" id="tf-ver" title="לשמור את המצב הנוכחי כנקודה שאפשר לחזור אליה">📌 שמור כגרסה</button>' : ''}
      <button type="button" class="btn ghost" id="tf-vers" title="רשימת הגרסאות השמורות">🕘 גרסאות</button>
      <button type="button" class="btn" data-act="pv" data-d="" title="לראות במסך את התאריך שבתצוגה המקדימה">👁 במסך</button>
      <button type="button" class="btn ghost${helpOpen ? ' on' : ''}" id="tf-help" title="איך הזמנים עובדים">❓ הסבר</button>
      ${canEdit() ? '<button type="button" class="btn ghost" id="tf-reset" title="למלא מחדש מברירת המחדל (הלוח השנתי + התוכנה הישנה)">↺</button>' : ''}
    </div>
    ${row ? '' : '<p class="lx-warn">⚠ עדיין לא נשמר — מוצגים הזמנים מהלוח השנתי ומהתוכנה הישנה. לעבור, לתקן ולשמור.</p>'}
    ${helpOpen ? HELP : ''}
    <div class="tf-wrap"><div class="tf-main">${body}</div><aside class="tf-side">${previewHtml()}</aside></div>${condDialog()}${dispDialog()}`;
  const rerender = () => render(main, onBack);
  const touched = (full) => { dirty = true; const s = $('#tf-save', main); if (s) s.disabled = false; if (full) rerender(); else $('.tf-side', main).innerHTML = previewHtml(); bindDate(); };
  const bindDate = () => { const d = $('#tf-date', main); if (d) d.onchange = () => { prevIso = d.value || todayIso(); $('.tf-side', main).innerHTML = previewHtml(); bindDate(); }; };
  bindDate();
  $('#tf-help', main).onclick = () => { helpOpen = !helpOpen; rerender(); };
  $('#tf-back', main).onclick = () => { if (dirty && !confirm('יש שינויים שלא נשמרו. לצאת?')) return; onBack(); };
  $$('[data-tab]', main).forEach((b) => { b.onclick = () => { tab = b.dataset.tab; rerender(); }; });
  const sv = $('#tf-save', main); if (sv) sv.onclick = async () => { await save(); rerender(); };
  const VS = versionStore('MinyanimHistory');
  const vb = $('#tf-ver', main); if (vb) vb.onclick = async () => {
    const note = await askNote('שמור כגרסה — זמני התפילות'); if (note === null) return;
    if (dirty) { await save(); if (dirty) return; }
    try { const v = await VS.add(data, note, state.email); ui.toast?.(`נשמר כגרסה ${v} ✓`); rerender(); } catch (err) { ui.toast?.(String(err.message || err), 'error'); }
  };
  $('#tf-vers', main).onclick = () => openVersions({ store: VS, title: 'גרסאות — זמני התפילות', canRestore: !!(state.canRestore || state.isAdmin), nameOf: (e) => displayName(e),
    onRestore: (obj, v) => { data = obj; normalize(); dirty = true; rerender(); ui.toast?.(`גרסה ${v} נטענה — לחץ 💾 שמירה כדי להחזיר אותה`); } });
  const rs = $('#tf-reset', main); if (rs) rs.onclick = () => {
    if (!confirm(`למלא מחדש את "${TABS.find(([k]) => k === tab)[1]}" מברירת המחדל? (השינויים בחלק הזה יימחקו)`)) return;
    if (tab === 'minor' || tab === 'pt') { const d0 = defaults().minor.blocks; data.minor.blocks = data.minor.blocks.map((b) => (inTab(tab, b) ? d0.find((x) => x.when === b.when) || b : b)); } else data[tab] = defaults()[tab];
    touched(true);
  };
  main.oninput = main.onchange = (e) => {
    const el = e.target;
    if (el.id === 'tf-date') return;
    if (el.dataset.day != null && e.type === 'change') {
      const r = get(el.dataset.p); const d = Number(el.dataset.day); const set2 = new Set(r.days || []);
      if (el.checked) set2.add(d); else set2.delete(d); r.days = [...set2].sort(); touched(false); return;
    }
    if (el.dataset.day != null) return;
    const f = el.closest('[data-f]'); const ts = el.closest('[data-ts]');
    if (f && f.dataset.f) {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      set(f.dataset.f, v); touched(e.type === 'change' && ((el.tagName === 'SELECT' && /\.(when|season|mode|place|kind|type|away)$/.test(f.dataset.f)) || /\.(screen|like\.\w+|fri\.on|sat\.on|table)$/.test(f.dataset.f)));
    } else if (ts && el.dataset.k) {
      if (e.type === 'input' && el.tagName === 'SELECT') return;
      const full = tsChange(ts.dataset.ts, el.dataset.k, el.type === 'checkbox' ? el.checked : el.value); touched(full);
    }
  };
  main.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act; const p = b.dataset.p || '';
    if (act === 'addW') { data.weekday[p].push({ id: newId(), time: { b: 'fixed', t: '' }, room: '', note: '', season: 'all', cond: null, kahal: false, fri: p === 'shacharis', last: false }); }
    else if (act === 'sortW') { const z = { neitz: 380, shkia: 1100, candles: 1082, rt: 1172, alos: 308, chatzos: 740 }; const k = (r0) => { const r = { time: r0.time?.x && (r0.time.b === 'max' || r0.time.b === 'min') ? r0.time.x : r0.time }; return (r.time?.b === 'fixed' ? (Number(String(r.time.t).replace(':', '.')) * 60 || 0) : (z[r.time?.b] || 0) + (r.time?.a || 0)); }; data.weekday[p].sort((a, c) => k(a) - k(c)); }
    else if (act === 'addSh') data.shiurim.rows.push({ id: newId(), type: b.dataset.t, title: '', who: '', room: '', time: { b: 'fixed', t: '' }, days: [0, 1, 2, 3, 4, 5], note: '', season: 'all', screen: true });
    else if (act === 'pvSide') { prevIso = b.dataset.d; $('.tf-side', main).innerHTML = previewHtml(); bindDate(); $('.tf-side', main).classList.add('flash'); setTimeout(() => $('.tf-side', main)?.classList.remove('flash'), 600); return; }
    else if (act === 'pv') {
      try { localStorage.setItem('tf-preview', JSON.stringify(data)); } catch { /* */ }
      const d = b.dataset.d || prevIso; const t = b.dataset.t || new Date().toTimeString().slice(0, 5);
      window.open(`display.html?preview=1&at=${d}T${t}`, 'tf-display');
      return;
    }
    else if (act === 'dispOpen') { dispOpen = p; rerender(); return; }
    else if (act === 'dispClose') { if (e.target !== b && b.classList.contains('tf-dlg-bg')) return; dispOpen = null; rerender(); return; }
    else if (act === 'condOpen') { condOpen = { p, g: b.dataset.g }; rerender(); return; }
    else if (act === 'condClose') { if (e.target !== b && b.classList.contains('tf-dlg-bg')) return; condOpen = null; rerender(); return; }
    else if (act === 'campTog') { const r = get(p); r.campOff = b.checked ? [] : Array.from({ length: r.fri ? 6 : 5 }, (x, i) => i); if (!r.campOff.length) delete r.campOff; }
    else if (act === 'campDay') { const r = get(p); const d = Number(b.dataset.d); const s0 = new Set((r.campOff || []).map(Number)); if (b.checked) s0.add(d); else s0.delete(d); r.campOff = [...s0].sort(); if (!r.campOff.length) delete r.campOff; }
    else if (act === 'condOn') { const r = get(p); r.cond = [b.dataset.g === 'shacharis' ? { dir: 'after', min: 0, base: 'alos' } : b.dataset.g === 'mincha' ? { dir: 'before', min: 0, base: 'shkia' } : { dir: 'after', min: 50, base: 'shkia' }]; }
    else if (act === 'condAdd') { const r = get(p); const g = p.split('.')[1]; r.cond = condOf(r, g) || []; r.cond.push({ dir: 'before', min: 0, base: 'shkia' }); }
    else if (act === 'condDel') { const ks = p.split('.'); const ci = Number(ks.pop()); ks.pop(); const r = get(ks.join('.')); r.cond = condOf(r, ks[1]) || []; r.cond.splice(ci, 1); if (!r.cond.length) r.cond = null; }
    else if (act === 'addS') data.shabbos.rows.push({ id: newId(), screen: true, label: '', day: 'sat', kind: 'tefila', season: 'all', time: { b: 'fixed', t: '' }, note: '' });
    else if (act === 'addB') {
      const t = b.dataset.t;
      data[p].blocks.push({ id: newId(), title: t === 'chag' ? 'חג' : t === 'chm' ? 'חול המועד' : t === 'erev' ? 'ערב חג' : 'בלוק חדש', when: WHEN[p][0][0], rows: [], ...(t ? { type: t } : {}),
        like: { minchaEve: true, maarivEve: true, shacharis: true, mincha: true, maarivMid: true, maariv: true }, own: { minchaEve: [], maarivEve: [], shacharis: [], mincha: [], maarivMid: [], maariv: [] }, fri: { mode: 'regular', time: null } });
    }
    else if (act === 'addR' && get(p.replace(/\.rows$/, ''))?.type === 'chag') get(p).push({ id: newId(), screen: true, disp: { place: 'shab', from: { mode: 'dayStart', days: 1 }, to: { mode: 'pass', min: 0 } }, label: '', note: '', kind: 'tefila', on: 'all', times: [{ b: 'fixed', t: '' }] });
    else if (act === 'addR') get(p).push({ id: newId(), screen: true, label: '', note: '', kind: 'tefila', on: 'all', times: [{ b: 'fixed', t: '' }] });
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
