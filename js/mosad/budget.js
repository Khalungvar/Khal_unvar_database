// 📆 הוצאות והכנסות קבועות + מאזן צפוי — הרשאה נפרדת "budget". הנתונים לא נשלחים עם ההגדרות הכלליות (budgetGet / budgetSave).
// פריט: { id, kind: 'exp'|'inc', name, amount, freq, dow, hday, gday, date, from, to, note }
//   freq: 'week' = כל שבוע ביום dow · 'heb' = כל חודש עברי ביום hday · 'greg' = כל חודש לועזי ביום gday · 'once' = פעם אחת בתאריך date
//   from / to = מתי זה בתוקף (ריק = תמיד)
// 💳 הוצאה: since = מאיזה תאריך עוקבים אחרי תשלומים; paid = [תאריכי מועדים ששולמו]. מועד שעבר ולא סומן ✓ — נשאר "בפיגור" (לא מתגלגל) עד שמסמנים.
// מאזן: יתרת פתיחה (סכום + תאריך) + הכנסות − הוצאות, יום אחר יום.
import { todayIso, toHebrew, isoToHebrewText, hebrewNumber } from '../hebdate.js?v=653';
import { downloadXlsx } from '../excel.js?v=653';

let X = null;
export function initBudget(ctx) { X = ctx; }

const B = { data: null, days: 30, dirty: false };
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const FREQ = [['week', 'כל שבוע'], ['heb', 'כל חודש עברי'], ['greg', 'כל חודש לועזי'], ['once', 'פעם אחת']];
const isoAdd = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const shekel = (n) => `${Number(n || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`;
const uid = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** האם הפריט חל בתאריך הזה */
function hits(x, iso) {
  if (x.from && iso < x.from) return false;
  if (x.to && iso > x.to) return false;
  if (x.freq === 'once') return x.date === iso;
  if (x.freq === 'week') return dowOf(iso) === Number(x.dow);
  if (x.freq === 'greg') {
    const d = Number(iso.slice(8, 10)); const want = Number(x.gday);
    if (d === want) return true;
    return d < want && isoAdd(iso, 1).slice(8, 10) === '01'; // 31 בחודש של 30 יום → היום האחרון בחודש
  }
  if (x.freq === 'heb') {
    const h = toHebrew(iso); if (!h) return false; const want = Number(x.hday);
    if (h.d === want) return true;
    return want === 30 && h.d === 29 && toHebrew(isoAdd(iso, 1))?.d === 1; // ל' בחודש חסר → כ"ט
  }
  return false;
}
/** כל המועדים של הפריט בטווח */
function occ(x, from, to) { const out = []; for (let d = from; d <= to; d = isoAdd(d, 1)) if (hits(x, d)) out.push(d); return out; }
/** 💳 הוצאה: מועדים שעברו ולא שולמו (מהישן לחדש) */
function overdue(x, today) {
  if (x.kind !== 'exp' || !x.since) return [];
  const from = x.from && x.from > x.since ? x.from : x.since;
  if (from >= today) return [];
  const paid = new Set(x.paid || []);
  return occ(x, from, isoAdd(today, -1)).filter((d) => !paid.has(d));
}
/** המועד הבא (מהיום והלאה) שעוד לא סומן כשולם */
function nextDue(x, today) {
  const paid = new Set(x.paid || []);
  for (let d = today, i = 0; i < 400; d = isoAdd(d, 1), i += 1) { if (x.to && d > x.to) return ''; if (hits(x, d) && !paid.has(d)) return d; }
  return '';
}
const when = (x) => (x.freq === 'week' ? `כל יום ${DAYS[x.dow]}` : x.freq === 'heb' ? `כל ${hebrewNumber(Number(x.hday))} בחודש העברי` : x.freq === 'greg' ? `כל ${x.gday} בחודש הלועזי` : x.date ? `ב-${isoToHebrewText(x.date)} (${x.date})` : '—')
  + (x.from || x.to ? ` · ${x.from ? `מ-${x.from}` : ''}${x.to ? ` עד ${x.to}` : ''}` : '');

/** התנועות בטווח: [{ iso, x, amt }] — הכנסה חיובי, הוצאה שלילי */
function moves(from, to) {
  const out = [];
  for (let d = from; d <= to; d = isoAdd(d, 1)) {
    B.data.items.forEach((x) => { if (Number(x.amount) && hits(x, d)) out.push({ iso: d, x, amt: (x.kind === 'inc' ? 1 : -1) * Number(x.amount) }); });
  }
  return out;
}
/** כמה שנחשב בהכנסות − הוצאות מיום הפתיחה עד יום לפני from */
function balanceBefore(from) {
  const o = B.data.opening || {};
  if (o.amount === '' || o.amount == null || !o.date || o.date >= from) return o.amount === '' || o.amount == null ? null : Number(o.amount);
  return Number(o.amount) + moves(o.date, isoAdd(from, -1)).reduce((s, m) => s + m.amt, 0);
}

export async function renderBudget(box) {
  const { h } = X;
  if (!X.can('budget')) { box.innerHTML = '<p class="ms-note err">אין הרשאה.</p>'; return; }
  if (!B.data) {
    box.innerHTML = '<p class="muted">טוען…</p>';
    try { B.data = (await X.call(X.KEY, 'budgetGet')).budget; } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
    B.data.items ||= []; B.data.opening ||= { date: '', amount: '' };
  }
  const today = todayIso();
  // הוצאה בלי since (מלפני שהיה מעקב תשלומים) — מתחילים לעקוב מהיום, בלי "פיגורים" ישנים
  let fresh = false;
  B.data.items.forEach((x) => { if (x.kind === 'exp' && !x.since) { x.since = today; fresh = true; } x.paid ||= []; });
  if (fresh && !B.dirty) X.call(X.KEY, 'budgetSave', { budget: B.data }).catch(() => {}); // נשמר בשקט — שהמעקב יתחיל מהיום ולא יזוז
  const late = B.data.items.filter((x) => x.kind === 'exp').flatMap((x) => overdue(x, today).map((d) => ({ x, d }))).sort((a, b) => a.d.localeCompare(b.d));
  const to = isoAdd(today, B.days - 1);
  const mv = moves(today, to);
  const start = balanceBefore(today);
  const inc = mv.filter((m) => m.amt > 0).reduce((s, m) => s + m.amt, 0);
  const exp = mv.filter((m) => m.amt < 0).reduce((s, m) => s - m.amt, 0);
  let run = start ?? 0;
  const byDay = [];
  mv.forEach((m) => { const last = byDay[byDay.length - 1]; if (last && last.iso === m.iso) last.list.push(m); else byDay.push({ iso: m.iso, list: [m] }); });
  const items = [...B.data.items].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'inc' ? -1 : 1) || a.name.localeCompare(b.name, 'he'));
  const o = B.data.opening;
  box.innerHTML = `<h2 class="ms-h">📆 הוצאות קבועות ומאזן</h2>
    <p class="muted small">🔒 הדף הזה גלוי רק למי שקיבל את ההרשאה "הוצאות קבועות ומאזן".</p>
    ${late.length ? `<section class="me-card bd-late"><h3 class="err-txt">⚠ הוצאות שעבר המועד שלהן ועוד לא סומנו כשולמו (${late.length})</h3>
      <p class="muted small">הוצאה שלא סומנה ✓ נשארת כאן ולא עוברת לבד למועד הבא. מסמנים ✓ כשהיא שולמה.</p>
      <div class="ms-wrap"><table class="ms-table"><thead><tr><th class="c">שולם</th><th>מועד</th><th>שם</th><th class="c">סכום</th></tr></thead><tbody>
        ${late.map(({ x, d }) => `<tr><td class="c"><input type="checkbox" data-pay="${h(x.id)}" data-d="${h(d)}" title="סמן ששולם"></td><td><b>${h(isoToHebrewText(d))}</b> <span class="muted small">${h(d.slice(8, 10))}/${h(d.slice(5, 7))}/${h(d.slice(0, 4))}</span></td><td>${h(x.name)}</td><td class="c err-txt">${h(shekel(x.amount))}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}
    <section class="me-card"><h3>🔮 צפי לימים הקרובים</h3>
      <div class="ms-bar"><label>לכמה ימים <select id="bd-days">${[7, 14, 30, 60, 90].map((n) => `<option${n === B.days ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <span class="spacer"></span><button type="button" class="btn" id="bd-xl">⬇ Excel</button></div>
      <div class="bd-sum">
        ${start != null ? `<div><span>יתרה היום (לפי החישוב)</span><b>${h(shekel(start))}</b></div>` : ''}
        <div><span>הכנסות צפויות</span><b class="ok-txt">${h(shekel(inc))}</b></div>
        <div><span>הוצאות צפויות</span><b class="err-txt">${h(shekel(exp))}</b></div>
        <div><span>${start != null ? `יתרה צפויה ב-${h(to)}` : 'הפרש'}</span><b>${h(shekel((start ?? 0) + inc - exp))}</b></div>
      </div>
      ${start == null ? '<p class="muted small">כדי לראות יתרה — מלא "יתרת פתיחה" למטה (כמה יש בחשבון ובאיזה תאריך).</p>' : ''}
      <div class="ms-wrap"><table class="ms-table"><thead><tr><th>תאריך</th><th>מה</th><th class="c">הכנסה</th><th class="c">הוצאה</th>${start != null ? '<th class="c">יתרה</th>' : ''}</tr></thead><tbody>
        ${byDay.map((g) => g.list.map((m, i) => { run += m.amt; return `<tr${i === 0 ? ' class="bd-day"' : ''}><td>${i === 0 ? `<b>${h(DAYS[dowOf(g.iso)])}</b> ${h(isoToHebrewText(g.iso))} <span class="muted small">${h(g.iso.slice(8, 10))}/${h(g.iso.slice(5, 7))}</span>` : ''}</td>
          <td>${h(m.x.name)}${m.amt < 0 && (m.x.paid || []).includes(m.iso) ? ' <span class="ok-txt small">✓ שולם</span>' : ''}</td><td class="c ok-txt">${m.amt > 0 ? h(shekel(m.amt)) : ''}</td><td class="c err-txt">${m.amt < 0 ? h(shekel(-m.amt)) : ''}</td>${start != null ? `<td class="c${run < 0 ? ' err-txt' : ''}">${i === g.list.length - 1 ? `<b>${h(shekel(run))}</b>` : ''}</td>` : ''}</tr>`; }).join('')).join('') || `<tr><td colspan="5" class="muted">אין תנועות ב-${B.days} הימים הקרובים.</td></tr>`}
      </tbody></table></div>
    </section>
    <section class="me-card"><h3>💼 יתרת פתיחה</h3>
      <div class="ms-bar"><label>סכום בחשבון ₪ <input type="number" step="0.01" id="bd-oamt" value="${h(o.amount ?? '')}" style="width:9em"></label>
        <label>נכון לתאריך <input type="date" id="bd-odate" value="${h(o.date || today)}"></label></div>
    </section>
    <section class="me-card"><h3>🔁 הכנסות והוצאות קבועות</h3>
      <div class="ms-bar"><button type="button" class="btn" id="bd-add-exp">➖ הוצאה קבועה</button><button type="button" class="btn" id="bd-add-inc">➕ הכנסה קבועה</button>
        <span class="spacer"></span><button type="button" class="btn primary" id="bd-save"${B.dirty ? '' : ' disabled'}>💾 שמירה</button></div>
      <div class="ms-wrap"><table class="ms-table"><thead><tr><th></th><th>שם</th><th class="c">סכום</th><th>מתי</th><th>💳 תשלום</th><th>הערה</th><th></th></tr></thead><tbody>
        ${items.map((x) => `<tr><td>${x.kind === 'inc' ? '<span class="ok-txt">➕ הכנסה</span>' : '<span class="err-txt">➖ הוצאה</span>'}</td><td><b>${h(x.name)}</b></td><td class="c">${h(shekel(x.amount))}</td>
          <td class="small">${h(when(x))}</td><td class="small">${payCell(x, today)}</td><td class="small muted">${h(x.note || '')}</td>
          <td><button type="button" class="linkish" data-ed="${h(x.id)}" title="עריכה">✎</button> <button type="button" class="linkish" data-del="${h(x.id)}" title="מחיקה">🗑</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">עוד אין. לחץ "➖ הוצאה קבועה" או "➕ הכנסה קבועה".</td></tr>'}
      </tbody></table></div>
    </section>`;
  const dirty = () => { B.dirty = true; X.$('#bd-save', box).disabled = false; };
  X.$('#bd-days', box).onchange = (e) => { B.days = Number(e.target.value); renderBudget(box); };
  X.$('#bd-oamt', box).onchange = (e) => { B.data.opening.amount = e.target.value === '' ? '' : Number(e.target.value); B.data.opening.date ||= X.$('#bd-odate', box).value; dirty(); renderBudget(box); };
  X.$('#bd-odate', box).onchange = (e) => { B.data.opening.date = e.target.value; dirty(); renderBudget(box); };
  X.$('#bd-add-exp', box).onclick = () => itemDialog({ kind: 'exp' }, box);
  X.$('#bd-add-inc', box).onclick = () => itemDialog({ kind: 'inc' }, box);
  X.$$('[data-ed]', box).forEach((b) => { b.onclick = () => itemDialog(B.data.items.find((x) => x.id === b.dataset.ed), box); });
  // 💳 ✓ שולם / ↺ ביטול — נשמר מיד
  const savePay = async (msg) => {
    try { B.data = (await X.call(X.KEY, 'budgetSave', { budget: B.data })).budget; B.dirty = false; X.toast(msg); } catch (err) { X.toast(X.msg(err), 'err'); }
    renderBudget(box);
  };
  X.$$('[data-pay]', box).forEach((c) => { c.onchange = () => {
    const x = B.data.items.find((z) => z.id === c.dataset.pay); if (!x) return;
    x.paid = [...new Set([...(x.paid || []), c.dataset.d])].sort();
    savePay(`✓ "${x.name}" — ${isoToHebrewText(c.dataset.d)} סומן כשולם.`);
  }; });
  X.$$('[data-unpay]', box).forEach((b) => { b.onclick = () => {
    const x = B.data.items.find((z) => z.id === b.dataset.unpay); if (!x) return;
    if (!window.confirm(`לבטל את הסימון "שולם" של ${isoToHebrewText(b.dataset.d)}?`)) return;
    x.paid = (x.paid || []).filter((d) => d !== b.dataset.d);
    savePay('הסימון בוטל.');
  }; });
  X.$$('[data-del]', box).forEach((b) => { b.onclick = () => { if (!window.confirm('למחוק?')) return; B.data.items = B.data.items.filter((x) => x.id !== b.dataset.del); B.dirty = true; renderBudget(box); }; });
  X.$('#bd-save', box).onclick = async (e) => {
    e.target.disabled = true;
    try { B.data = (await X.call(X.KEY, 'budgetSave', { budget: B.data })).budget; B.dirty = false; X.toast('נשמר.'); renderBudget(box); } catch (err) { e.target.disabled = false; X.toast(X.msg(err), 'err'); }
  };
  X.$('#bd-xl', box).onclick = () => { let r = start ?? 0; downloadXlsx(`צפי הוצאות והכנסות ${today} - ${to}`, ['תאריך', 'תאריך עברי', 'מה', 'הכנסה', 'הוצאה', ...(start != null ? ['יתרה'] : [])],
    mv.map((m) => { r += m.amt; return [m.iso, isoToHebrewText(m.iso), m.x.name, m.amt > 0 ? m.amt : '', m.amt < 0 ? -m.amt : '', ...(start != null ? [r] : [])]; }), { rtl: true }); };
}

/** 💳 עמודת התשלום ברשימה: בפיגור (אדום) / המועד הבא עם ✓ / שולם לאחרונה עם ↺ */
function payCell(x, today) {
  const { h } = X;
  if (x.kind !== 'exp') return '';
  const od = overdue(x, today);
  const last = [...(x.paid || [])].sort().pop();
  const undo = last ? `<div class="muted">✓ שולם לאחרונה: ${h(isoToHebrewText(last))} <button type="button" class="linkish" data-unpay="${h(x.id)}" data-d="${h(last)}" title="ביטול הסימון">↺</button></div>` : '';
  if (od.length) return `<label class="check err-txt"><input type="checkbox" data-pay="${h(x.id)}" data-d="${h(od[0])}"> ⚠ לא שולם: ${h(isoToHebrewText(od[0]))}${od.length > 1 ? ` (ועוד ${od.length - 1})` : ''}</label>${undo}`;
  const nx = nextDue(x, today);
  return `${nx ? `<label class="check"><input type="checkbox" data-pay="${h(x.id)}" data-d="${h(nx)}"> הבא: ${h(isoToHebrewText(nx))}${nx === today ? ' (היום)' : ''}</label>` : '<span class="muted">אין מועד קרוב</span>'}${undo}`;
}

function itemDialog(x0, box) {
  const { h } = X;
  const x = { freq: 'greg', dow: 0, hday: 1, gday: 1, amount: '', name: '', note: '', from: '', to: '', date: todayIso(), ...x0 };
  const inc = x.kind === 'inc';
  const d = X.dialog(`<h2>${inc ? '➕ הכנסה קבועה' : '➖ הוצאה קבועה'}</h2>
    <form class="ms-form" autocomplete="off"><div class="grid">
      <label class="wide">שם *<input name="name" value="${h(x.name)}" placeholder="${inc ? 'למשל: משרד החינוך' : 'למשל: שכירות, ירקות, הסעה'}" required></label>
      <label>סכום ₪ *<input name="amount" type="number" step="0.01" min="0" value="${h(x.amount)}" required></label>
      <label>תדירות<select name="freq">${FREQ.map(([k, l]) => `<option value="${k}"${x.freq === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label data-f="week">ביום<select name="dow">${DAYS.map((n, i) => `<option value="${i}"${Number(x.dow) === i ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label data-f="heb">ביום בחודש העברי<select name="hday">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}"${Number(x.hday) === i + 1 ? ' selected' : ''}>${hebrewNumber(i + 1)}</option>`).join('')}</select></label>
      <label data-f="greg">ביום בחודש הלועזי<input name="gday" type="number" min="1" max="31" value="${h(x.gday)}"></label>
      <label data-f="once">בתאריך<input name="date" type="date" value="${h(x.date)}"></label>
      <label data-f="rep">בתוקף מ- (לא חובה)<input name="from" type="date" value="${h(x.from)}"></label>
      <label data-f="rep">עד (לא חובה)<input name="to" type="date" value="${h(x.to)}"></label>
      <label class="wide">הערה<input name="note" value="${h(x.note)}"></label>
    </div>
    <p class="muted small">ל' בחודש עברי חסר — נחשב בכ"ט. 31 בחודש לועזי של 30 יום — ביום האחרון.</p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">אישור</button></div></form>`);
  const form = X.$('form', d);
  const show = () => { const f = form.elements.freq.value; X.$$('[data-f]', form).forEach((el) => { el.hidden = !(el.dataset.f === f || (el.dataset.f === 'rep' && f !== 'once')); }); };
  form.elements.freq.onchange = show; show();
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  form.onsubmit = (e) => {
    e.preventDefault();
    const E = form.elements;
    const y = { ...x, id: x.id || uid(), kind: x.kind, name: X.S(E.name.value), amount: Number(E.amount.value) || 0, freq: E.freq.value, dow: Number(E.dow.value), hday: Number(E.hday.value),
      gday: Math.max(1, Math.min(31, Number(E.gday.value) || 1)), date: E.date.value, from: E.from.value, to: E.to.value, note: X.S(E.note.value) };
    if (y.kind === 'exp' && !y.since) y.since = y.freq === 'once' ? (y.date < todayIso() ? y.date : todayIso()) : (y.from && y.from > todayIso() ? y.from : todayIso());
    y.paid ||= [];
    if (!y.name || !y.amount) { X.toast('חסר שם או סכום.', 'err'); return; }
    const i = B.data.items.findIndex((z) => z.id === y.id);
    if (i >= 0) B.data.items[i] = y; else B.data.items.push(y);
    B.dirty = true; d.close(); renderBudget(box); X.toast('עודכן — לא לשכוח 💾 שמירה.');
  };
  form.elements.name.focus();
}
