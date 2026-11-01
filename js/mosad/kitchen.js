// 🍳 מלאי המטבח — על הגיליון של המוסד (Kitchen, KitchenOrders), לא Firebase.
// התראות: מתחת למינימום / לפני שייגמר (ימי אספקה × צריכה יומית) / תוקף (5 ימים לפני) · רשימת קניות לפי ספק · הזמנות קבועות לפי יום בשבוע.
import { downloadXlsx } from '../excel.js?v=596';
import { colFilters } from '../sorttables.js?v=596';

let X = null;
const K = { d: null, tab: 'stock', cat: '', q: '', sort: 'name', card: '' };
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const UNITS = ['יחידות', 'ק"ג', 'ליטר', 'מארזים', 'קרטונים', 'גרם'];
const CATS0 = ['יבש', 'חלב', 'בשר', 'עוף', 'דגים', 'ירקות ופירות', 'קפואים', 'שתייה', 'לחם ומאפים', 'תבלינים', 'ניקיון', 'חד פעמי'];
const WARN_DAYS = 5;
const FIELDS = [
  ['product_name', 'שם המוצר'], ['category', 'קטגוריה'], ['current_stock', 'כמות במלאי', 'n'], ['unit', 'יחידה'],
  ['min_threshold', 'מינימום להתראה', 'n'], ['daily_use', 'צריכה ליום (בערך)', 'n'], ['lead_time_days', 'ימי אספקה מהספק', 'n'],
  ['expiry_date', 'תאריך תפוגה', 'date'], ['supplier_name', 'ספק'], ['unit_price', 'מחיר ליחידה ₪', 'n'],
  ['recurring_day', 'יום הזמנה קבוע'], ['standard_qty', 'כמות תקן להזמנה קבועה', 'n'], ['note', 'הערה'],
];
const n = (v) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const daysTo = (iso) => (iso ? Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / 86400000) : null);
const money = (v) => `${(Math.round(n(v) * 100) / 100).toLocaleString('he-IL')} ₪`;

/** מצב של פריט: low = מתחת למינימום; soon = ייגמר לפני שהספק יספיק להביא; exp / expSoon = תוקף */
function status(it) {
  const st = n(it.current_stock); const min = n(it.min_threshold);
  const lead = n(it.lead_time_days) * n(it.daily_use);
  const d = daysTo(it.expiry_date);
  return {
    low: it.min_threshold !== '' && st <= min,
    soon: lead > 0 && st <= min + lead && !(it.min_threshold !== '' && st <= min),
    exp: d !== null && d < 0,
    expSoon: d !== null && d >= 0 && d <= WARN_DAYS,
    d,
  };
}
const needsOrder = (it) => { const s = status(it); return s.low || s.soon; };
/** כמה להזמין: עד המינימום + צריכה בימי האספקה + שבוע; בהזמנה קבועה — תקן פחות מה שנשאר */
function orderQty(it, recurring = false) {
  if (recurring && n(it.standard_qty)) return Math.max(0, n(it.standard_qty) - n(it.current_stock));
  const target = n(it.min_threshold) + n(it.daily_use) * (n(it.lead_time_days) + 7);
  return Math.max(0, Math.ceil((target || n(it.min_threshold) * 2) - n(it.current_stock)));
}

export function initKitchen(ctx) { X = ctx; }
const kw = () => K.d?.kw || null; // עובד מטבח (סיסמה) — אנדערש מנהל (גוגל)
const showPrices = () => !kw() || kw().prices;
async function load() { K.d = await X.call(X.KEY, 'kitchen'); }
export async function renderKitchen(box) {
  const { h } = X;
  if (!K.d) {
    box.innerHTML = '<p class="muted">טוען…</p>';
    try { await load(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
  }
  const items = K.d.items || [];
  const st = items.map((it) => ({ it, s: status(it) }));
  const m = {
    all: items.length,
    order: st.filter((x) => x.s.low || x.s.soon).length,
    exp: st.filter((x) => x.s.exp || x.s.expSoon).length,
    value: items.reduce((t, it) => t + n(it.current_stock) * n(it.unit_price), 0),
  };
  const dow = new Date().getDay();
  const todays = items.filter((it) => it.recurring_day !== '' && Number(it.recurring_day) === dow && n(it.standard_qty));
  const reqs = (!kw() && K.d.requests) || [];
  const card = (k, ic, l, v, cls = '') => `<button type="button" class="kc-card${K.card === k ? ' on' : ''} ${cls}" data-card="${k}"><span>${ic} ${h(l)}</span><b>${h(String(v))}</b></button>`;
  box.innerHTML = `<h2 class="ms-h">🍳 מלאי המטבח</h2>
    <div class="kc-cards">${card('', '📦', 'סה"כ פריטים', m.all)}${card('order', '🛒', 'לחידוש', m.order, m.order ? 'warn' : '')}${card('exp', '⏳', 'עומדים לפוג / פגו', m.exp, m.exp ? 'bad' : '')}${showPrices() ? card('value', '💰', 'שווי מלאי מוערך', money(m.value)) : ''}</div>
    ${reqs.length ? `<div class="ms-note"><b>📨 בקשות מאנשי המטבח (${reqs.length})</b>${reqs.map((r) => { let d = {}; try { d = JSON.parse(r.data || '{}'); } catch { d = {}; } const it = (K.d.items || []).find((x) => x.product_id === r.product_id);
      return `<div class="kc-req">${r.type === 'add' ? `➕ פריט חדש: <b>${h(d.product_name || '')}</b> ${h([d.category, d.current_stock && `${d.current_stock} ${d.unit || ''}`, d.supplier_name].filter(Boolean).join(' · '))}` : `🗑 מחיקה: <b>${h(it?.product_name || r.product_id)}</b>`}
        ${r.note ? `<span class="muted small">— ${h(r.note)}</span>` : ''} <span class="muted small">(${h(String(r.by).replace(/^מטבח: /, ''))})</span>
        <button type="button" class="btn small-btn primary" data-ok="${h(r.req_id)}">✓ לאשר</button><button type="button" class="btn small-btn" data-no="${h(r.req_id)}">✗ לדחות</button></div>`; }).join('')}</div>` : ''}
    ${todays.length ? `<p class="ms-note">📅 היום יום הזמנה קבועה: ${todays.map((it) => `<b>${h(it.product_name)}</b> (${orderQty(it, true)} ${h(it.unit || '')})`).join(' · ')} <button type="button" class="btn small-btn" id="kc-rec">🛒 לרשימת הקניות</button></p>` : ''}
    <nav class="ms-subtabs">${[['stock', '📦 מלאי'], ['shop', '🛒 רשימת קניות'], ['events', '🎉 הזמנות מיוחדות'], ['hist', '📜 היסטוריית הזמנות']].map(([k, l]) => `<button type="button" data-kt="${k}" class="${K.tab === k ? 'on' : ''}">${h(l)}</button>`).join('')}
      <span class="spacer"></span>${kw() ? '' : '<button type="button" class="linkish" id="kc-workers">🔑 אנשי המטבח וסיסמאות</button>'}<button type="button" class="linkish" id="kc-reload">⟳ רענון</button></nav>
    <div id="kc-body"></div>`;
  X.$$('[data-kt]', box).forEach((b) => { b.onclick = () => { K.tab = b.dataset.kt; renderKitchen(box); }; });
  X.$$('[data-card]', box).forEach((b) => { b.onclick = () => { K.card = b.dataset.card === 'value' ? '' : (K.card === b.dataset.card ? '' : b.dataset.card); K.tab = K.card === 'order' ? 'shop' : 'stock'; renderKitchen(box); }; });
  X.$('#kc-reload', box).onclick = () => { K.d = null; renderKitchen(box); };
  X.$('#kc-workers', box)?.addEventListener('click', () => workersDialog(() => { K.d = null; renderKitchen(box); }));
  const decide = async (id, approve) => { try { await X.call(X.KEY, 'kitchenReqDecide', { id, approve }); await load(); renderKitchen(box); X.toast(approve ? 'אושר.' : 'נדחה.'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$$('[data-ok]', box).forEach((b) => { b.onclick = () => decide(b.dataset.ok, true); });
  X.$$('[data-no]', box).forEach((b) => { b.onclick = () => decide(b.dataset.no, false); });
  X.$('#kc-rec', box)?.addEventListener('click', () => { K.rec = true; K.tab = 'shop'; renderKitchen(box); });
  const body = X.$('#kc-body', box);
  const rer = () => renderKitchen(box);
  if (!items.length && K.tab === 'stock') return emptyView(body, rer);
  if (K.tab === 'shop') return shopTab(body, rer);
  if (K.tab === 'hist') return histTab(body, rer);
  if (K.tab === 'events') return eventsTab(body, rer);
  return stockTab(body, rer);
}

function emptyView(body, rer) {
  body.innerHTML = `<div class="ms-note" style="text-align:center;padding:24px">
    <h3>ברוכים הבאים למלאי המטבח 👋</h3><p>המלאי עוד ריק. אפשר להתחיל כך:</p>
    <button type="button" class="btn primary" id="kc-new0">＋ פריט חדש</button> <button type="button" class="btn" id="kc-imp0">⬆ ייבוא מאקסל</button>
    <p class="muted small">באקסל: שורה ראשונה = כותרות (שם המוצר, קטגוריה, כמות, יחידה, מינימום, ספק, מחיר, תוקף…).</p></div>`;
  X.$('#kc-new0', body).onclick = () => itemDialog({}, rer);
  X.$('#kc-imp0', body).onclick = () => importXl(rer);
}

function stockTab(body, rer) {
  const { h } = X;
  const items = K.d.items || [];
  const cats = [...new Set([...CATS0, ...items.map((x) => x.category).filter(Boolean)])];
  const q = K.q.trim();
  let list = items.filter((it) => (!K.cat || it.category === K.cat) && (!q || [it.product_name, it.supplier_name, it.category, it.note].join(' ').includes(q)));
  if (K.card === 'order') list = list.filter(needsOrder);
  if (K.card === 'exp') list = list.filter((it) => { const s = status(it); return s.exp || s.expSoon; });
  const sorters = { name: (a, b) => a.product_name.localeCompare(b.product_name, 'he'), exp: (a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999'), qty: (a, b) => n(a.current_stock) - n(b.current_stock) };
  list.sort(sorters[K.sort] || sorters.name);
  const badge = (it) => { const s = status(it); return [s.low ? '<span class="kc-b bad">מתחת למינימום</span>' : '', s.soon ? '<span class="kc-b warn">להזמין עכשיו (ימי אספקה)</span>' : '', s.exp ? '<span class="kc-b bad">פג תוקף</span>' : '', s.expSoon ? `<span class="kc-b warn">פג בעוד ${s.d} ימים</span>` : ''].join(' '); };
  body.innerHTML = `<div class="ms-bar">
      <input type="search" id="kc-q" placeholder="חיפוש…" value="${h(K.q)}">
      <select id="kc-cat"><option value="">כל הקטגוריות</option>${cats.map((c) => `<option${c === K.cat ? ' selected' : ''}>${h(c)}</option>`).join('')}</select>
      <select id="kc-sort">${[['name', 'מיון: א-ב'], ['exp', 'מיון: תוקף'], ['qty', 'מיון: כמות']].map(([k, l]) => `<option value="${k}"${k === K.sort ? ' selected' : ''}>${l}</option>`).join('')}</select>
      ${K.card ? `<button type="button" class="linkish" id="kc-clr">✕ ${K.card === 'order' ? 'לחידוש' : 'תוקף'}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="kc-new">${kw() ? '＋ בקשה לפריט חדש' : '＋ פריט חדש'}</button>
      ${kw() ? '' : '<button type="button" class="btn" id="kc-imp">⬆ ייבוא מאקסל</button>'}<button type="button" class="btn" id="kc-xl">⬇ Excel</button>
    </div>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table col-filter" data-fkey="kitchen"><thead><tr><th>מוצר</th><th>קטגוריה</th><th>במלאי</th><th>מינימום</th><th>תוקף</th><th>ספק</th>${showPrices() ? '<th>מחיר</th>' : ''}<th>מצב</th><th></th></tr></thead><tbody>
      ${list.map((it) => `<tr><td><b>${h(it.product_name)}</b>${it.note ? `<div class="muted small">${h(it.note)}</div>` : ''}</td><td>${h(it.category)}</td>
        <td class="c" data-v="${n(it.current_stock)}"><button type="button" class="btn small-btn" data-dec="${h(it.product_id)}">−</button> <b>${h(String(n(it.current_stock)))}</b> ${h(it.unit || '')} <button type="button" class="btn small-btn" data-inc="${h(it.product_id)}">+</button></td>
        <td class="c">${h(it.min_threshold)}</td><td class="small" data-v="${h(it.expiry_date || '')}">${h(it.expiry_date || '')}</td><td>${h(it.supplier_name)}</td>${showPrices() ? `<td class="num">${it.unit_price !== '' ? h(money(it.unit_price)) : ''}</td>` : ''}
        <td>${badge(it)}</td><td class="ms-acts"><button type="button" class="btn small-btn" data-ed="${h(it.product_id)}">✎</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted ms-empty">אין.</p>'}`;
  const qi = X.$('#kc-q', body); qi.oninput = () => { K.q = qi.value; clearTimeout(K.t); K.t = setTimeout(() => { stockTab(body, rer); const x = X.$('#kc-q', body); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); };
  X.$('#kc-cat', body).onchange = (e) => { K.cat = e.target.value; stockTab(body, rer); };
  X.$('#kc-sort', body).onchange = (e) => { K.sort = e.target.value; stockTab(body, rer); };
  X.$('#kc-clr', body)?.addEventListener('click', () => { K.card = ''; rer(); });
  X.$('#kc-new', body).onclick = () => itemDialog({}, rer);
  X.$('#kc-imp', body)?.addEventListener('click', () => importXl(rer));
  const FX = FIELDS.filter(([k]) => showPrices() || k !== 'unit_price');
  X.$('#kc-xl', body).onclick = () => downloadXlsx('מלאי המטבח', FX.map(([, l]) => l), items.map((it) => FX.map(([k, , t]) => (k === 'recurring_day' ? (it[k] !== '' ? DAYS[Number(it[k])] || '' : '') : t === 'n' ? (it[k] === '' ? '' : n(it[k])) : it[k] || ''))), { rtl: true });
  const byId = (id) => items.find((x) => x.product_id === id);
  const bump = async (id, d) => {
    const it = byId(id); if (!it) return;
    const v = Math.max(0, n(it.current_stock) + d);
    it.current_stock = String(v); stockTab(body, rer);
    try { await X.call(X.KEY, 'kitchenSave', { row: { product_id: id, current_stock: v } }); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$$('[data-inc]', body).forEach((b) => { b.onclick = () => bump(b.dataset.inc, 1); });
  X.$$('[data-dec]', body).forEach((b) => { b.onclick = () => bump(b.dataset.dec, -1); });
  X.$$('[data-ed]', body).forEach((b) => { b.onclick = () => itemDialog(byId(b.dataset.ed), rer); });
  colFilters(body);
}

function itemDialog(it, rer) {
  const { h } = X;
  const cats = [...new Set([...CATS0, ...(K.d.items || []).map((x) => x.category).filter(Boolean)])];
  const sups = [...new Set((K.d.items || []).map((x) => x.supplier_name).filter(Boolean))];
  const inp = ([k, l, t]) => {
    if (k === 'unit') return `<label>${l}<input name="${k}" list="kc-dl-u" value="${h(it[k] || 'יחידות')}"></label>`;
    if (k === 'category') return `<label>${l}<input name="${k}" list="kc-dl-c" value="${h(it[k] || '')}"></label>`;
    if (k === 'supplier_name') return `<label>${l}<input name="${k}" list="kc-dl-s" value="${h(it[k] || '')}"></label>`;
    if (k === 'recurring_day') return `<label>${l}<select name="${k}"><option value="">ללא</option>${DAYS.slice(0, 6).map((d, i) => `<option value="${i}"${String(it[k]) === String(i) && it[k] !== '' ? ' selected' : ''}>יום ${d}'</option>`).join('')}</select></label>`;
    return `<label>${l}<input name="${k}"${t === 'n' ? ' type="number" step="any" min="0" dir="ltr"' : t === 'date' ? ' type="date"' : ''} value="${h(it[k] ?? '')}"${k === 'product_name' ? ' required' : ''}></label>`;
  };
  const W = kw(); const ro = W && it.product_id; // עובד: פריט קיים — רק בקשת מחיקה
  const d = X.dialog(`<h2>${it.product_id ? '✎ ' + h(it.product_name) : W ? '＋ בקשה לפריט חדש' : '＋ פריט חדש'}</h2>
    ${W ? `<p class="ms-note small">${ro ? 'שינוי פרטי הפריט — אצל המנהל. אפשר לבקש למחוק אותו.' : 'הבקשה תעבור לאישור המנהל, והפריט ייכנס למלאי אחרי האישור.'}</p>` : ''}
    <form class="ms-form"><fieldset${ro ? ' disabled' : ''} style="border:0;padding:0;margin:0"><div class="grid">${FIELDS.filter(([k]) => showPrices() || k !== 'unit_price').map(inp).join('')}</div></fieldset>
      ${W ? '<label>הערה למנהל<input name="rq_note"></label>' : ''}
      <datalist id="kc-dl-u">${UNITS.map((u) => `<option value="${h(u)}">`).join('')}</datalist><datalist id="kc-dl-c">${cats.map((u) => `<option value="${h(u)}">`).join('')}</datalist><datalist id="kc-dl-s">${sups.map((u) => `<option value="${h(u)}">`).join('')}</datalist>
      <p class="muted small">התראה מוקדמת: כשהמלאי ≤ מינימום + (צריכה ליום × ימי אספקה) — מופיע ב"לחידוש" לפני שנגמר. הזמנה קבועה: ביום שנבחר — כמות להזמנה = תקן − מה שנשאר במדף.</p>
      <div class="actions">${it.product_id ? `<button type="button" class="btn danger" id="kc-del">🗑 ${W ? 'בקשה למחוק' : 'מחיקה'}</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button>${ro ? '' : `<button type="submit" class="btn primary">${W ? '📨 לשלוח למנהל' : '💾 שמירה'}</button>`}</div></form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const row = { product_id: it.product_id || '' }; FIELDS.forEach(([k]) => { if (form.elements[k]) row[k] = X.S(form.elements[k].value); });
    const btn = X.$('button[type=submit]', form); btn.disabled = true;
    try {
      if (W) { await X.call(X.KEY, 'kitchenRequest', { type: 'add', row, note: X.S(form.elements.rq_note.value) }); d.close(); X.toast('הבקשה נשלחה למנהל.'); return; }
      await X.call(X.KEY, 'kitchenSave', { row }); await load(); d.close(); rer(); X.toast('נשמר.');
    } catch (err) { btn.disabled = false; X.toast(X.msg(err), 'err'); }
  };
  X.$('#kc-del', d)?.addEventListener('click', async () => {
    if (!window.confirm(W ? `לבקש מהמנהל למחוק את "${it.product_name}"?` : `למחוק את "${it.product_name}" מהמלאי?`)) return;
    try {
      if (W) { await X.call(X.KEY, 'kitchenRequest', { type: 'delete', id: it.product_id, note: X.S(form.elements.rq_note?.value) }); d.close(); X.toast('הבקשה נשלחה למנהל.'); return; }
      await X.call(X.KEY, 'kitchenDelete', { id: it.product_id }); await load(); d.close(); rer();
    } catch (err) { X.toast(X.msg(err), 'err'); }
  });
}

// ---------- 🛒 רשימת קניות לפי ספק ----------
function shopTab(body, rer) {
  const { h } = X;
  const items = K.d.items || [];
  const dow = new Date().getDay();
  const rec = (it) => K.rec && it.recurring_day !== '' && Number(it.recurring_day) === dow && n(it.standard_qty);
  const list = items.filter((it) => needsOrder(it) || rec(it)).map((it) => ({ it, qty: orderQty(it, rec(it)) })).filter((x) => x.qty > 0);
  const groups = {};
  list.forEach((x) => { (groups[x.it.supplier_name || 'בלי ספק'] ||= []).push(x); });
  const sups = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'he'));
  body.innerHTML = `<div class="ms-bar"><span class="muted small">פריטים שמתחת לסף (וגם לפי ימי האספקה) עוברים לכאן לבד. אפשר לשנות כמות לפני ששולחים.${K.rec ? ' כולל ההזמנות הקבועות של היום.' : ''}</span><span class="spacer"></span>
      <button type="button" class="btn" id="ks-print">🖨 PDF / הדפסה</button><button type="button" class="btn" id="ks-xl">⬇ Excel</button></div>
    ${sups.length ? sups.map((sp) => `<section class="kc-sup"><h3>🚚 ${h(sp)}</h3>
      <table class="ms-table"><thead><tr><th>מוצר</th><th>במלאי</th><th>להזמין</th>${showPrices() ? '<th>מחיר</th>' : ''}</tr></thead><tbody>
      ${groups[sp].map((x) => `<tr><td>${h(x.it.product_name)}</td><td>${h(String(n(x.it.current_stock)))} ${h(x.it.unit || '')}</td><td><input type="number" min="0" step="any" class="ks-q" data-id="${h(x.it.product_id)}" value="${x.qty}" style="width:6em" dir="ltr"> ${h(x.it.unit || '')}</td>${showPrices() ? `<td class="num">${x.it.unit_price !== '' ? h(money(n(x.it.unit_price) * x.qty)) : ''}</td>` : ''}</tr>`).join('')}
      </tbody></table>
      <div class="actions"><button type="button" class="btn" data-wa="${h(sp)}">💬 וואטסאפ</button><button type="button" class="btn" data-cp="${h(sp)}">📋 העתקה</button><span class="spacer"></span>
        <button type="button" class="btn" data-ord="${h(sp)}">📝 נרשם כהוזמן</button><button type="button" class="btn primary" data-rcv="${h(sp)}">✓ הגיע — להוסיף למלאי</button></div></section>`).join('')
      : '<p class="ms-note">✓ אין מה להזמין כרגע.</p>'}`;
  const qtyOf = (id) => n(X.$(`.ks-q[data-id="${CSS.escape(id)}"]`, body)?.value);
  const linesOf = (sp) => groups[sp].map((x) => ({ id: x.it.product_id, name: x.it.product_name, qty: qtyOf(x.it.product_id), unit: x.it.unit || '', price: n(x.it.unit_price) })).filter((x) => x.qty > 0);
  const text = (sp) => `הזמנה — ${X.st.mosad?.name || ''}\n${linesOf(sp).map((x) => `• ${x.name}: ${x.qty} ${x.unit}`).join('\n')}`;
  X.$$('[data-wa]', body).forEach((b) => { b.onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(text(b.dataset.wa))}`, '_blank'); });
  X.$$('[data-cp]', body).forEach((b) => { b.onclick = async () => { try { await navigator.clipboard.writeText(text(b.dataset.cp)); X.toast('הועתק.'); } catch { X.toast('לא הצליח להעתיק.', 'err'); } }; });
  const order = async (sp, received) => {
    const items2 = linesOf(sp); if (!items2.length) return;
    if (received && !window.confirm(`להוסיף ${items2.length} פריטים למלאי (${sp})?`)) return;
    try { await X.call(X.KEY, 'kitchenOrder', { supplier: sp, items: items2, received }); K.rec = false; await load(); rer(); X.toast(received ? 'המלאי עודכן.' : 'נרשם.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$$('[data-ord]', body).forEach((b) => { b.onclick = () => order(b.dataset.ord, false); });
  X.$$('[data-rcv]', body).forEach((b) => { b.onclick = () => order(b.dataset.rcv, true); });
  const all = () => sups.flatMap((sp) => linesOf(sp).map((x) => [sp, x.name, x.qty, x.unit, x.price ? x.price * x.qty : '']));
  X.$('#ks-xl', body).onclick = () => downloadXlsx('רשימת קניות', ['ספק', 'מוצר', 'כמות', 'יחידה', 'מחיר'], all(), { rtl: true });
  X.$('#ks-print', body).onclick = () => X.printWin?.('רשימת קניות', new Date().toLocaleDateString('he-IL'), sups.map((sp) => `<h3>${h(sp)}</h3><table><thead><tr><th>מוצר</th><th>כמות</th><th>✓</th></tr></thead><tbody>${linesOf(sp).map((x) => `<tr><td>${h(x.name)}</td><td style="text-align:center">${x.qty} ${h(x.unit)}</td><td style="width:20mm"></td></tr>`).join('')}</tbody></table>`).join(''));
}

function histTab(body, rer) {
  const { h } = X;
  const os = [...(K.d.orders || [])].reverse();
  const parse = (s) => { try { return JSON.parse(s) || []; } catch { return []; } };
  body.innerHTML = os.length ? `<div class="ms-wrap"><table class="ms-table col-filter" data-fkey="korders"><thead><tr><th>#</th><th>תאריך</th><th>ספק</th><th>פריטים</th><th>סה"כ</th><th>מצב</th><th>על ידי</th></tr></thead><tbody>
    ${os.map((o) => `<tr><td class="num">${h(o.order_id)}</td><td>${h(String(o.date).slice(0, 10))}</td><td>${h(o.supplier)}</td><td class="small">${parse(o.items).map((x) => `${h(x.name)} ×${h(String(x.qty))}`).join(', ')}</td><td class="num">${n(o.total) ? h(money(o.total)) : ''}</td>
      <td>${o.status === 'received' ? '✓ הגיע' : `הוזמן <button type="button" class="btn small-btn" data-rcv="${h(o.order_id)}">✓ הגיע</button>`}</td><td class="small">${h(o.created_by)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted ms-empty">אין עדיין הזמנות.</p>';
  X.$$('[data-rcv]', body).forEach((b) => { b.onclick = async () => { try { await X.call(X.KEY, 'kitchenReceive', { id: b.dataset.rcv }); await load(); rer(); X.toast('המלאי עודכן.'); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  colFilters(body);
}

// ---------- ⬆ ייבוא: xlsx / csv. מזהים כותרות לפי שם ----------
const HEAD = { product_name: /שם|מוצר|פריט|product/i, category: /קטגור|category/i, current_stock: /כמות|מלאי|stock|qty/i, unit: /יחיד|unit/i, min_threshold: /מינ|min/i,
  lead_time_days: /אספקה|lead/i, daily_use: /צריכה|daily/i, expiry_date: /תוקף|תפוגה|expir/i, supplier_name: /ספק|supplier/i, unit_price: /מחיר|price/i, standard_qty: /תקן|standard/i, note: /הערה|note/i };
export async function readTable(file) {
  if (/\.csv$/i.test(file.name)) return (await file.text()).split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/,|\t/).map((c) => c.replace(/^"|"$/g, '').trim()));
  const { _test } = await import('./shabbos.js?v=596');
  const files = Object.fromEntries(await _test.unzip(await file.arrayBuffer()));
  const dec = new TextDecoder(); const P = (k) => (files[k] ? new DOMParser().parseFromString(dec.decode(files[k]), 'application/xml') : null);
  const shared = [...(P('xl/sharedStrings.xml')?.getElementsByTagName('si') || [])].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  const wsName = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const ws = P(wsName); if (!ws) return [];
  const col = (ref) => { let c = 0; for (const ch of ref.replace(/\d+/g, '')) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; };
  return [...ws.getElementsByTagName('row')].map((r) => { const out = []; [...r.getElementsByTagName('c')].forEach((c) => { const v = c.getElementsByTagName('v')[0]?.textContent ?? [...c.getElementsByTagName('t')].map((t) => t.textContent).join(''); out[col(c.getAttribute('r'))] = c.getAttribute('t') === 's' ? shared[Number(v)] : v; }); return out.map((x) => x ?? ''); });
}
function importXl(rer) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.csv';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const t = await readTable(f); if (t.length < 2) { X.toast('הקובץ ריק.', 'err'); return; }
      const head = t[0].map(String);
      const map = Object.fromEntries(Object.entries(HEAD).map(([k, re]) => [k, head.findIndex((x) => re.test(x))]).filter(([, i]) => i >= 0));
      if (!('product_name' in map)) { X.toast('לא נמצאה עמודת "שם המוצר".', 'err'); return; }
      const xlDate = (v) => (/^\d{5}$/.test(String(v)) ? new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000).toISOString().slice(0, 10) : String(v).slice(0, 10));
      const have = Object.fromEntries((K.d.items || []).map((it) => [it.product_name.trim(), it.product_id]));
      const rows = t.slice(1).map((r) => { const o = {}; Object.entries(map).forEach(([k, i]) => { o[k] = k === 'expiry_date' ? xlDate(r[i] || '') : String(r[i] ?? '').trim(); }); o.product_id = have[o.product_name] || ''; return o; }).filter((o) => o.product_name);
      if (!window.confirm(`לייבא ${rows.length} פריטים? (${rows.filter((r) => r.product_id).length} קיימים יעודכנו לפי השם)`)) return;
      await X.call(X.KEY, 'kitchenSave', { rows }); await load(); rer(); X.toast('יובא.');
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  inp.click();
}

// ---------- 🔑 אנשי המטבח: שם + סיסמה לכל אחד; "מחירים" = רואה מחירים ושווי (באישור המנהל) ----------
function workersDialog(after) {
  const { h } = X;
  const ws = K.d.workers || [];
  const link = new URL('kitchen/', location.href.replace(/[^/]*$/, '')).href;
  const d = X.dialog(`<h2>🔑 אנשי המטבח</h2>
    <p class="muted small">אנשי המטבח נכנסים בלי גוגל, בדף: <a href="${h(link)}" target="_blank" dir="ltr">${h(link)}</a> — בוחרים שם ומקלידים סיסמה. הם רואים רק את המטבח: מעדכנים כמויות, רשימת קניות, "הגיע". פריט חדש / מחיקה — עוברים אליך לאישור.</p>
    <table class="ms-table"><thead><tr><th>שם</th><th>רואה מחירים</th><th>פעיל</th><th>סיסמה חדשה</th><th></th></tr></thead><tbody>
      ${ws.map((w) => `<tr data-w="${h(w.id)}"><td><input data-f="name" value="${h(w.name)}"></td><td class="c"><input type="checkbox" data-f="prices"${w.prices ? ' checked' : ''}></td><td class="c"><input type="checkbox" data-f="active"${w.active ? ' checked' : ''}></td>
        <td><input data-f="password" type="text" autocomplete="off" placeholder="(בלי שינוי)" dir="ltr" style="width:9em"></td><td><button type="button" class="btn small-btn" data-sv>💾</button> <button type="button" class="btn small-btn" data-rm>🗑</button></td></tr>`).join('')}
      <tr data-w=""><td><input data-f="name" placeholder="שם חדש"></td><td class="c"><input type="checkbox" data-f="prices"></td><td class="c"><input type="checkbox" data-f="active" checked></td>
        <td><input data-f="password" type="text" autocomplete="off" placeholder="סיסמה (4+)" dir="ltr" style="width:9em"></td><td><button type="button" class="btn small-btn primary" data-sv>＋ הוספה</button></td></tr>
    </tbody></table>
    <p class="muted small">סיסמה חדשה מוציאה מיד את מי שנכנס עם הישנה. אחרי 5 ניסיונות שגויים — נעילה ל-10 דקות. כל פעולה נרשמת ביומן בשם העובד.</p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => { d.close(); after(); }; });
  const save = async (tr, remove = false) => {
    const v = (f) => X.$(`[data-f="${f}"]`, tr);
    const worker = { id: tr.dataset.w, name: X.S(v('name').value), password: X.S(v('password').value), prices: v('prices').checked, active: v('active').checked, remove };
    if (!worker.id && (!worker.name || worker.password.length < 4)) { X.toast('צריך שם וסיסמה (לפחות 4 תווים).', 'err'); return; }
    if (worker.password && worker.password.length < 4) { X.toast('סיסמה — לפחות 4 תווים.', 'err'); return; }
    if (remove && !window.confirm(`להסיר את ${worker.name}?`)) return;
    try { await X.call(X.KEY, 'kitchenWorkerSave', { worker }); await load(); d.close(); workersDialog(after); X.toast('נשמר.'); } catch (err) { X.toast(err?.message === 'short-pass' ? 'סיסמה — לפחות 4 תווים.' : X.msg(err), 'err'); }
  };
  X.$$('[data-sv]', d).forEach((b) => { b.onclick = () => save(b.closest('tr')); });
  X.$$('[data-rm]', d).forEach((b) => { b.onclick = () => save(b.closest('tr'), true); });
}

// ---------- 🎉 הזמנות מיוחדות: פורים, שבועות, שבת שהרבי נמצא… — תבנית שנשמרת לשנה הבאה ----------
const evItems = (e) => { try { return JSON.parse(e.items || '[]') || []; } catch { return []; } };
function eventsTab(body, rer) {
  const { h } = X;
  const evs = [...(K.d.events || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.name).localeCompare(String(b.name), 'he'));
  body.innerHTML = `<div class="ms-bar"><span class="muted small">אירוע = רשימת מוצרים וכמויות. נשמר כתבנית — בפעם הבאה רק מעדכנים תאריך ולוחצים "🛒 הכן הזמנה".</span><span class="spacer"></span>
      <button type="button" class="btn primary" id="ke-new">＋ הזמנה מיוחדת חדשה</button></div>
    ${evs.length ? `<div class="kc-evs">${evs.map((e) => { const it = evItems(e); const dd = e.date ? daysTo(e.date) : null;
      return `<div class="kc-ev"><div><b>🎉 ${h(e.name)}</b>${e.date ? ` <span class="muted small">${h(e.date)}${dd !== null && dd >= 0 && dd <= 14 ? ` · בעוד ${dd} ימים` : ''}</span>` : ''}</div>
        <div class="muted small">${it.length} מוצרים${e.note ? ` · ${h(e.note)}` : ''}</div>
        <div class="actions"><button type="button" class="btn small-btn primary" data-prep="${h(e.event_id)}">🛒 הכן הזמנה</button><button type="button" class="btn small-btn" data-eed="${h(e.event_id)}">✎</button>
          <button type="button" class="btn small-btn" data-ecp="${h(e.event_id)}" title="שכפול">📋</button><button type="button" class="btn small-btn" data-edel="${h(e.event_id)}">🗑</button></div></div>`; }).join('')}</div>`
      : '<p class="muted ms-empty">אין עדיין הזמנות מיוחדות.</p>'}`;
  const byId = (id) => evs.find((e) => String(e.event_id) === String(id));
  X.$('#ke-new', body).onclick = () => eventDialog({ name: '', date: '', items: '[]' }, rer);
  X.$$('[data-eed]', body).forEach((b) => { b.onclick = () => eventDialog(byId(b.dataset.eed), rer); });
  X.$$('[data-ecp]', body).forEach((b) => { b.onclick = () => { const e = byId(b.dataset.ecp); eventDialog({ ...e, event_id: '', name: `${e.name} (עותק)` }, rer); }; });
  X.$$('[data-edel]', body).forEach((b) => { b.onclick = async () => { const e = byId(b.dataset.edel); if (!window.confirm(`למחוק את "${e.name}"?`)) return; try { await X.call(X.KEY, 'kitchenEventSave', { event: { event_id: e.event_id }, remove: true }); await load(); rer(); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$$('[data-prep]', body).forEach((b) => { b.onclick = () => prepEvent(byId(b.dataset.prep), body, rer); });
}
function eventDialog(e, rer) {
  const { h } = X;
  const inv = K.d.items || [];
  let items = evItems(e);
  const d = X.dialog(`<h2>🎉 ${e.event_id ? h(e.name) : 'הזמנה מיוחדת'}</h2>
    <form class="ms-form"><div class="grid"><label>שם<input name="name" value="${h(e.name || '')}" placeholder="למשל: פורים / שבת שהרבי נמצא" required></label><label>תאריך<input name="date" type="date" value="${h(e.date || '')}"></label><label class="wide">הערה<input name="note" value="${h(e.note || '')}"></label></div>
      <datalist id="ke-dl">${inv.map((x) => `<option value="${h(x.product_name)}">`).join('')}</datalist>
      <table class="ms-table"><thead><tr><th>מוצר (מהמלאי או חדש)</th><th>כמות</th><th>יחידה</th><th>ספק</th><th></th></tr></thead><tbody id="ke-rows"></tbody></table>
      <div class="actions"><button type="button" class="btn" id="ke-add">＋ שורה</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div></form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const tb = X.$('#ke-rows', d);
  const read = () => { items = X.$$('tr', tb).map((tr) => { const v = (k) => X.S(X.$(`[data-k="${k}"]`, tr).value); const nm = v('name'); const it = inv.find((x) => x.product_name === nm); return { id: it?.product_id || '', name: nm, qty: Number(v('qty')) || 0, unit: v('unit') || it?.unit || '', supplier: v('supplier') || it?.supplier_name || '' }; }); };
  const draw = () => {
    tb.innerHTML = items.map((x, i) => `<tr><td><input data-k="name" list="ke-dl" value="${h(x.name)}"></td><td><input data-k="qty" type="number" min="0" step="any" dir="ltr" style="width:6em" value="${h(x.qty || '')}"></td>
      <td><input data-k="unit" style="width:6em" value="${h(x.unit || '')}"></td><td><input data-k="supplier" style="width:9em" value="${h(x.supplier || '')}"></td><td><button type="button" class="btn small-btn" data-rm="${i}">✕</button></td></tr>`).join('');
    X.$$('[data-rm]', tb).forEach((b) => { b.onclick = () => { read(); items.splice(Number(b.dataset.rm), 1); draw(); }; });
    // בחירה מהמלאי → יחידה וספק לבד
    X.$$('[data-k="name"]', tb).forEach((inp) => { inp.onchange = () => { const it = inv.find((x) => x.product_name === X.S(inp.value)); if (!it) return; const tr = inp.closest('tr'); const u = X.$('[data-k="unit"]', tr); const sp = X.$('[data-k="supplier"]', tr); if (!u.value) u.value = it.unit || ''; if (!sp.value) sp.value = it.supplier_name || ''; }; });
  };
  if (!items.length) items = [{ name: '', qty: '' }];
  draw();
  X.$('#ke-add', d).onclick = () => { read(); items.push({ name: '', qty: '' }); draw(); X.$$('[data-k="name"]', tb).pop().focus(); };
  const form = X.$('form', d);
  form.onsubmit = async (ev) => {
    ev.preventDefault(); read();
    const event = { event_id: e.event_id || '', name: X.S(form.elements.name.value), date: form.elements.date.value, note: X.S(form.elements.note.value), items: items.filter((x) => x.name) };
    try { await X.call(X.KEY, 'kitchenEventSave', { event }); await load(); d.close(); rer(); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}
/** 🛒 הכן הזמנה: לפי ספק, אפשר לקזז מה שיש במלאי; וואטסאפ / העתקה / נרשם כהוזמן / הגיע */
function prepEvent(e, body, rer) {
  const { h } = X;
  const inv = K.d.items || [];
  let deduct = false;
  const draw = () => {
    const lines = evItems(e).map((x) => { const it = (x.id && inv.find((k) => k.product_id === x.id)) || inv.find((k) => k.product_name === x.name); const have = it ? n(it.current_stock) : 0; return { ...x, id: it?.product_id || x.id || '', have, need: Math.max(0, n(x.qty) - (deduct ? have : 0)), price: it ? n(it.unit_price) : 0 }; });
    const groups = {}; lines.forEach((x) => { (groups[x.supplier || 'בלי ספק'] ||= []).push(x); });
    const sups = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'he'));
    body.innerHTML = `<div class="ms-bar"><button type="button" class="btn" id="kp-back">→ חזרה</button><b>🎉 ${h(e.name)}</b>${e.date ? ` <span class="muted small">${h(e.date)}</span>` : ''}<span class="spacer"></span>
        <label class="check"><input type="checkbox" id="kp-ded"${deduct ? ' checked' : ''}> לקזז מה שיש כבר במלאי</label><button type="button" class="btn" id="kp-xl">⬇ Excel</button></div>
      ${sups.map((sp) => `<section class="kc-sup"><h3>🚚 ${h(sp)}</h3><table class="ms-table"><thead><tr><th>מוצר</th><th>לאירוע</th>${deduct ? '<th>במלאי</th>' : ''}<th>להזמין</th></tr></thead><tbody>
        ${groups[sp].map((x, i) => `<tr><td>${h(x.name)}</td><td>${h(String(n(x.qty)))} ${h(x.unit)}</td>${deduct ? `<td>${h(String(x.have))}</td>` : ''}<td><input type="number" min="0" step="any" class="kp-q" data-s="${h(sp)}" data-i="${i}" value="${x.need}" style="width:6em" dir="ltr"> ${h(x.unit)}</td></tr>`).join('')}
        </tbody></table><div class="actions"><button type="button" class="btn" data-wa="${h(sp)}">💬 וואטסאפ</button><button type="button" class="btn" data-cp="${h(sp)}">📋 העתקה</button><span class="spacer"></span>
        <button type="button" class="btn" data-ord="${h(sp)}">📝 נרשם כהוזמן</button><button type="button" class="btn primary" data-rcv="${h(sp)}">✓ הגיע — להוסיף למלאי</button></div></section>`).join('') || '<p class="muted">אין מוצרים באירוע.</p>'}`;
    const linesOf = (sp) => groups[sp].map((x, i) => ({ id: x.id, name: x.name, qty: n(X.$(`.kp-q[data-s="${CSS.escape(sp)}"][data-i="${i}"]`, body)?.value), unit: x.unit, price: x.price })).filter((x) => x.qty > 0);
    const text = (sp) => `הזמנה — ${e.name}${e.date ? ` (${e.date})` : ''} — ${X.st.mosad?.name || ''}\n${linesOf(sp).map((x) => `• ${x.name}: ${x.qty} ${x.unit}`).join('\n')}`;
    X.$('#kp-back', body).onclick = () => eventsTab(body, rer);
    X.$('#kp-ded', body).onchange = (ev) => { deduct = ev.target.checked; draw(); };
    X.$$('[data-wa]', body).forEach((b) => { b.onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(text(b.dataset.wa))}`, '_blank'); });
    X.$$('[data-cp]', body).forEach((b) => { b.onclick = async () => { try { await navigator.clipboard.writeText(text(b.dataset.cp)); X.toast('הועתק.'); } catch { X.toast('לא הצליח להעתיק.', 'err'); } }; });
    const order = async (sp, received) => {
      const items = linesOf(sp); if (!items.length) return;
      if (received && !window.confirm(`להוסיף למלאי את מה שהגיע מ${sp}?`)) return;
      try { await X.call(X.KEY, 'kitchenOrder', { supplier: sp, items, received, note: `🎉 ${e.name}` }); await load(); X.toast(received ? 'המלאי עודכן.' : 'נרשם בהיסטוריה.'); } catch (err) { X.toast(X.msg(err), 'err'); }
    };
    X.$$('[data-ord]', body).forEach((b) => { b.onclick = () => order(b.dataset.ord, false); });
    X.$$('[data-rcv]', body).forEach((b) => { b.onclick = () => order(b.dataset.rcv, true); });
    X.$('#kp-xl', body).onclick = () => downloadXlsx(`הזמנה ${e.name}`, ['ספק', 'מוצר', 'כמות', 'יחידה'], sups.flatMap((sp) => linesOf(sp).map((x) => [sp, x.name, x.qty, x.unit])), { rtl: true });
  };
  draw();
}
