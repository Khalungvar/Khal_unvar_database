// ✈ כ"ק אדמו"ר שליט"א נסע: תקופות (מ... עד..., לפי תאריך עברי) — לשונית RebbeAway בגיליון של התצוגה.
// דערפון: אין די שורות פון שבת — "כשאד"ש לא נמצא": כרגיל / לא מוצג / מאוחר ב־X דק' (תצוגה, הדפסה, הודעות).
// דער גבאי קען אויך שיקן 6 אין דער אויטאמאטישער הודעה — דאן ווערט עס אריינגעשריבן דא ביז מוצאי שבת.
import { otherSheet } from '../google.js';
import { CONFIG } from '../config.js';
import { state } from '../data.js';
import { escapeHtml as h, nowStamp } from '../util.js';
import { toHebrew, fromHebrew, monthsOf, hebrewNumber, yearLabel, isoToHebrewText, todayIso } from '../hebdate.js';

const TAB = 'RebbeAway';
const sh = () => otherSheet(CONFIG.DISPLAY_SHEET_ID);
export const canAway = () => !!(state.isAllowed || state.isAdmin);

export async function loadAway() {
  try {
    const rows = await sh().read(`${TAB}!A2:D200`);
    return rows.filter((r) => r[0] && r[1]).map((r) => ({ from: String(r[0]).slice(0, 10), to: String(r[1]).slice(0, 10), by: String(r[2] || ''), at: String(r[3] || '') }));
  } catch { return []; }
}
async function saveAway(list) {
  const rows = [['from', 'to', 'by', 'at'], ...list.map((a) => [a.from, a.to, a.by, a.at])];
  try { await sh().read(`${TAB}!A1:A1`); } catch { await sh().addTab(TAB); }
  await sh().clear(`${TAB}!A1:D200`);
  await sh().write(`${TAB}!A1:D${rows.length}`, rows);
}
/** "לא נמצא עד מוצ"ש ..." / "נוסע ב..." / '' */
export function awayStatus(list) {
  const t = todayIso();
  const cur = list.filter((a) => a.from <= t && a.to >= t).sort((a, b) => b.to.localeCompare(a.to))[0];
  if (cur) return `✈ לא נמצא עד ${isoToHebrewText(cur.to)}`;
  const nx = list.filter((a) => a.from > t).sort((a, b) => a.from.localeCompare(b.from))[0];
  return nx ? `נוסע ב־${isoToHebrewText(nx.from)}` : '';
}
const isoAdd = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const satOf = (iso) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return isoAdd(iso, (6 - d + 7) % 7); };

// ---------- תאריך עברי: 3 תיבות ----------
function hdSel(id, iso) {
  const cur = toHebrew(new Date(`${iso}T12:00:00Z`)); const y0 = cur.y;
  return `<span class="aw-hd" id="${id}"><select data-p="d">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}"${cur.d === i + 1 ? ' selected' : ''}>${hebrewNumber(i + 1)}</option>`).join('')}</select>
    <select data-p="m">${monthsOf(y0).map((m) => `<option value="${m.key}"${cur.m === m.key ? ' selected' : ''}>${h(m.he)}</option>`).join('')}</select>
    <select data-p="y">${[y0 - 1, y0, y0 + 1].map((y) => `<option value="${y}"${y === y0 ? ' selected' : ''}>${yearLabel(y)}</option>`).join('')}</select></span>`;
}
function hdVal(box) {
  const g = (p) => box.querySelector(`[data-p=${p}]`).value;
  return fromHebrew(Number(g('d')), g('m'), Number(g('y')));
}

/** דער חלון: רשימה + צולייגן / אויסמעקן */
export async function openAway(onChange) {
  let list = await loadAway();
  const bg = document.createElement('div'); bg.className = 'tf-dlg-bg aw-bg';
  document.body.appendChild(bg);
  const close = () => { bg.remove(); onChange?.(list); };
  const draw = (msg = '') => {
    const t = todayIso();
    const items = [...list].sort((a, b) => a.from.localeCompare(b.from));
    bg.innerHTML = `<div class="tf-dlg aw-dlg" dir="rtl">
      <h3>✈ כ"ק אדמו"ר שליט"א נסע</h3>
      <p class="muted small">בשבתות שבתוך התקופה: מה שמוגדר בזמני השבת ב"כשאד"ש לא נמצא" (לא מוצג / מאוחר ב־X דק') — בתצוגה, בהדפסה ובהודעות.</p>
      ${items.length ? `<table class="aw-t">${items.map((a) => `<tr class="${a.to < t ? 'aw-past' : ''}"><td>מ־<b>${h(isoToHebrewText(a.from))}</b></td><td>עד־<b>${h(isoToHebrewText(a.to))}</b></td><td class="muted small">${h(a.by)}</td>
        <td>${canAway() ? `<button type="button" class="tf-mini" data-del="${items.indexOf(a)}" title="מחק">🗑</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="muted">אין נסיעות רשומות.</p>'}
      ${canAway() ? `<div class="aw-add"><b>נסיעה חדשה:</b> מ־${hdSel('aw-f', t)} עד־${hdSel('aw-t', satOf(t))}
        <button type="button" class="btn primary" id="aw-save">➕ הוסף</button></div>` : ''}
      ${msg ? `<p class="ms-note err">${h(msg)}</p>` : ''}
      <div class="tf-add"><span class="spacer"></span><button type="button" class="btn" id="aw-close">סגור</button></div>
    </div>`;
    bg.querySelector('#aw-close').onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => {
      const a = items[Number(b.dataset.del)]; if (!confirm(`למחוק את הנסיעה מ־${isoToHebrewText(a.from)} עד־${isoToHebrewText(a.to)}?`)) return;
      const keep = list.filter((x) => x !== a);
      try { await saveAway(keep); list = keep; draw(); } catch (err) { draw(String(err.message || err)); }
    }; });
    const sv = bg.querySelector('#aw-save');
    if (sv) sv.onclick = async () => {
      const from = hdVal(bg.querySelector('#aw-f')); const to = hdVal(bg.querySelector('#aw-t'));
      if (!from || !to) { draw('תאריך לא תקין'); return; }
      if (to < from) { draw('"עד" לפני "מ"'); return; }
      sv.disabled = true;
      const next = [...list, { from, to, by: state.email || '', at: nowStamp() }];
      try { await saveAway(next); list = next; draw(); } catch (err) { draw(String(err.message || err)); }
    };
  };
  draw();
}
