// 🌙 נוכחות בפנימייה — לליגער (האברך האחראי על הבחורים): דף אחד לשבוע שלם, הבחורים מקובצים לפי החדרים שבפנימייה.
// הסימונים נשמרים בגיליון ההשתתפות עם seder "_dorm": marks = { '0'..'6': 'v' (ישן בפנימייה) | 'x' (לא ישן) }
// הרשאה: dorm_att. החדר — לפי השיבוץ בפנימייה (🛏) של הזמן הנוכחי.
import { loadSchool, schoolLoaded, activeStudents } from './school.js?v=675';
import { roomOfFn } from './dorm.js?v=675';
import { printWin } from './journal.js?v=675';
import { todayIso } from '../hebdate.js?v=653';
import { shabbatTitle, shabbatOfWeek } from '../parasha.js?v=653';

let X = null;
export function initDormAtt(ctx) { X = ctx; }

const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const TXT = { v: '✓', x: '✗' };
const NEXT = { '': 'v', v: 'x', x: '' };
const isoAdd = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const sundayOf = (iso) => isoAdd(iso, -new Date(`${iso}T12:00:00Z`).getUTCDay());
const fmt = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
const NOROOM = 'ללא חדר';
const A = { week: '', dirty: false };

const first = (id) => X.S(X.pById(id)?.first_name_he || X.pById(id)?.first_name_en);
const last = (id) => X.S(X.pById(id)?.last_name_he || X.pById(id)?.last_name_en);
const parse = (s) => { try { return JSON.parse(s || '{}') || {}; } catch { return {}; } };

/** חדרים בסדר טבעי (חדר 2 לפני חדר 10), "ללא חדר" בסוף */
function groups(ids, roomOf) {
  const by = {};
  ids.forEach((id) => { const r = roomOf(id) || NOROOM; (by[r] ||= []).push(id); });
  const coll = new Intl.Collator('he', { numeric: true });
  return Object.keys(by).sort((a, b) => (a === NOROOM) - (b === NOROOM) || coll.compare(a, b))
    .map((r) => ({ room: r, ids: by[r].sort((a, b) => last(a).localeCompare(last(b), 'he') || first(a).localeCompare(first(b), 'he')) }));
}

export async function renderDormAtt(box) {
  const { h } = X;
  if (!schoolLoaded()) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await loadSchool(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  if (!A.week) A.week = sundayOf(todayIso());
  const sun = A.week;
  box.innerHTML = '<p class="muted">טוען…</p>';
  let rows;
  try { rows = (await X.call(X.KEY, 'att', { from: sun, to: sun })).rows.filter((r) => r.seder === '_dorm'); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
  const ids = activeStudents().map((e) => String(e.contact_id)).filter((id) => X.pById(id));
  const roomOf = roomOfFn();
  const gs = groups(ids, roomOf);
  const marks = {};
  ids.forEach((id) => { marks[id] = parse(rows.find((r) => String(r.contact_id) === id)?.marks); });
  const edit = X.can('dorm_att');
  const changed = new Set();
  const title = `נוכחות בפנימייה — ${shabbatTitle(shabbatOfWeek(sun), true)}`;
  const cnt = (d) => ids.filter((id) => marks[id][d] === 'v').length;
  box.innerHTML = `<h2 class="ms-h">🌙 נוכחות בפנימייה</h2>
    <div class="ms-bar">
      <button type="button" class="btn small-btn" id="da-prev" title="שבוע קודם">›</button>
      <b>${h(shabbatTitle(shabbatOfWeek(sun), true))}</b> <span class="muted small">${fmt(sun)} – ${fmt(isoAdd(sun, 6))}</span>
      <button type="button" class="btn small-btn" id="da-next" title="שבוע הבא">‹</button>
      ${sun !== sundayOf(todayIso()) ? '<button type="button" class="linkish" id="da-now">השבוע</button>' : ''}
      <span class="spacer"></span>
      ${edit ? '<button type="button" class="btn primary" id="da-save" disabled>💾 שמירה</button>' : ''}
      <button type="button" class="btn" id="da-blank">🖨 דף ריק לשבוע</button>
      <button type="button" class="btn" id="da-full">🖨 עם הסימונים</button>
    </div>
    <p class="muted small">לחיצה (או ⏎ אנטר) על משבצת: ✓ ישן בפנימייה → ✗ לא ישן → ריק. החדרים — לפי השיבוץ ב🛏 פנימייה (הזמן הנוכחי). "✓ כל החדר" — לכל בחורי החדר באותו לילה.</p>
    <div class="ms-wrap"><table class="ms-table ja-table da-table"><thead><tr><th>#</th><th>שם</th><th>משפחה</th>
      ${DAYS.map((d, i) => `<th class="c">ליל ${d}'<div class="muted small">${fmt(isoAdd(sun, i))}</div></th>`).join('')}</tr></thead>
      <tbody>${gs.map((g) => `<tr class="da-room"><th colspan="3">🛏 ${h(g.room)} <span class="muted small">(${g.ids.length})</span></th>
          ${DAYS.map((d, i) => `<th class="c">${edit ? `<button type="button" class="linkish small" data-room="${h(g.room)}" data-d="${i}">✓ כל החדר</button>` : ''}</th>`).join('')}</tr>
        ${g.ids.map((id, n) => `<tr><td class="num">${n + 1}</td><td>${h(first(id))}</td><td><b>${h(last(id))}</b></td>
          ${DAYS.map((d, i) => { const v = marks[id][i] || ''; return `<td class="c"><button type="button" class="ja-cell m-${v || 'e'}" data-id="${h(id)}" data-k="${i}" data-r="${h(g.room)}"${edit ? '' : ' disabled'}>${TXT[v] || ''}</button></td>`; }).join('')}</tr>`).join('')}`).join('')}
      </tbody>
      <tfoot><tr><th colspan="3">סה"כ ישנו בפנימייה</th>${DAYS.map((d, i) => `<th class="c" data-cnt="${i}">${cnt(i) || ''}</th>`).join('')}</tr></tfoot></table></div>`;
  const go = (w) => { if (A.dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return; A.dirty = false; A.week = w; renderDormAtt(box); };
  X.$('#da-prev', box).onclick = () => go(isoAdd(sun, -7));
  X.$('#da-next', box).onclick = () => go(isoAdd(sun, 7));
  X.$('#da-now', box)?.addEventListener('click', () => go(sundayOf(todayIso())));
  const saveBtn = X.$('#da-save', box);
  const set = (b, v) => {
    const { id, k } = b.dataset;
    if (v) marks[id][k] = v; else delete marks[id][k];
    b.textContent = TXT[v] || ''; b.className = `ja-cell m-${v || 'e'}`;
    changed.add(id); A.dirty = true; if (saveBtn) saveBtn.disabled = false;
    const c = X.$(`[data-cnt="${k}"]`, box); if (c) c.textContent = cnt(Number(k)) || '';
  };
  X.$$('.ja-cell', box).forEach((b) => { b.onclick = () => set(b, NEXT[marks[b.dataset.id][b.dataset.k] || '']); });
  X.$$('[data-room]', box).forEach((a) => {
    a.onclick = () => X.$$(`.ja-cell[data-k="${a.dataset.d}"]`, box).filter((b) => b.dataset.r === a.dataset.room).forEach((b) => { if (!marks[b.dataset.id][b.dataset.k]) set(b, 'v'); });
  });
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const out = [...changed].map((id) => ({ contact_id: id, marks: JSON.stringify(marks[id]) }));
    try { await X.call(X.KEY, 'attSave', { week: sun, seder: '_dorm', rows: out }); changed.clear(); A.dirty = false; X.toast('נשמר.'); } catch (err) { saveBtn.disabled = false; X.toast(X.msg(err), 'err'); }
  });
  // 🖨 דף אחד לשבוע: לפי חדרים, משבצת לכל לילה
  const sheet = (filled) => printWin(title, `${fmt(sun)} – ${fmt(isoAdd(sun, 6))}`, `<table class="da-print"><thead><tr><th class="n">#</th><th>שם</th>${DAYS.map((d, i) => `<th style="text-align:center">ליל ${d}'<br><small>${fmt(isoAdd(sun, i))}</small></th>`).join('')}</tr></thead><tbody>
      ${gs.map((g) => `<tr><th colspan="9" style="text-align:right;background:#f1ece0">🛏 ${h(g.room)}</th></tr>
        ${g.ids.map((id, n) => `<tr><td class="n">${n + 1}</td><td class="nm">${h(`${first(id)} ${last(id)}`)}</td>${DAYS.map((d, i) => `<td style="text-align:center;width:9%">${filled ? TXT[marks[id][i]] || '' : ''}</td>`).join('')}</tr>`).join('')}`).join('')}
    </tbody></table>`);
  X.$('#da-blank', box).onclick = () => sheet(false);
  X.$('#da-full', box).onclick = () => sheet(true);
}
