// אתר פון א מוסד — 💰 משכורות והוצאות (הרשאה "finance"):
// 💵 משכורות (₪: גלובלי / שעות קבועות / רישום יומי / גלובלי + שעות, תוספות און ניכויים, תשלומים, וויפיל מ'איז נאך שולדיג),
// 🧾 הוצאות (₪/$, קאטעגאריעס, צילום קבלה), 📥 הכנסות ותמיכה, ⚖️ חובות פתוחים, 📊 מאזן חודשי — יעדער מטבע באזונדער.
import { downloadXlsx } from '../excel.js?v=443';
import { todayIso, toHebrew, monthHe, yearLabel } from '../hebdate.js?v=443';
import { loadSchool, schoolLoaded, alumniDebts } from './school.js?v=443';
import { historyDialog } from './me.js?v=443';
import { PAY_TYPES, schedText } from './team.js?v=443';
import { usdRate } from '../fx.js?v=443';

let X = null;
export function initFinance(ctx) { X = ctx; }
const F = { d: null, tab: 'sal', month: '', expF: { cat: '', open: false }, debtsClosed: false };
const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const cur = (n, c = 'ILS') => `${c === 'USD' ? '$' : '₪'}${NF.format(Math.round(Number(n || 0) * 100) / 100)}`;
const CURS = [['ILS', '₪ שקל'], ['USD', '$ דולר']];
const METHODS = ['העברה בנקאית', 'מזומן', "צ'ק", 'אשראי', 'אחר'];
const pad = (n) => String(n).padStart(2, '0');
const monthName = (mo) => { const x = toHebrew(`${mo}-15`); return x ? `${monthHe(x.m)} ${yearLabel(x.y)} (${mo})` : mo; };
const nameOf = (id, txt = '') => (id && X.pById(id) ? X.nameOf(X.pById(id)) : txt || (id ? `#${id}` : ''));

async function load() {
  const [d] = await Promise.all([X.call(X.KEY, 'fin'), schoolLoaded() ? null : loadSchool().catch(() => null)]);
  // נדבות אין דולר/אירו/ליש"ט → שקל, לויטן שער פונעם טאג פון דער נדבה
  const days = [...new Set(d.gifts.filter((x) => x.currency !== 'ILS' && x.usd).map((x) => x.date))];
  const rates = {};
  await Promise.all(days.map(async (dt) => { const r = await usdRate('ILS', dt); if (r && r.rate) rates[dt] = 1 / r.rate; }));
  d.gifts.forEach((x) => { x.ils = x.currency === 'ILS' ? x.orig : (rates[x.date] ? Math.round(x.usd * rates[x.date] * 100) / 100 : null); });
  F.d = d;
}

// ---------- רעכענען משכורות ----------
const minsOf = (a, b) => { const p = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }; const x = p(a); const y = p(b); return x !== null && y !== null && y > x ? y - x : 0; };
const team = () => F.d.team || [];
const infoOf = (id) => F.d.payInfo.find((x) => String(x.contact_id) === String(id)) || {};
const teamOf = (id) => team().find((x) => String(x.contact_id) === String(id)) || {};
function monthsRange(t, id) {
  // פון דעם ערשטן חודש (אנהייב / ערשטער תשלום / שעות) ביז היינט (אדער ביזן סוף)
  const firsts = [t.start_date, ...F.d.payments.filter((p) => String(p.contact_id) === String(id)).map((p) => p.date), ...F.d.items.filter((p) => String(p.contact_id) === String(id)).map((p) => `${p.month}-01`),
    ...F.d.hours.filter((p) => String(p.contact_id) === String(id)).map((p) => p.date)].filter((x) => /^\d{4}-\d{2}/.test(x || '')).sort();
  if (!firsts.length) return [];
  let [y, m] = firsts[0].slice(0, 7).split('-').map(Number);
  const endM = (t.end_date && t.end_date < todayIso() ? t.end_date : todayIso()).slice(0, 7);
  const out = [];
  for (let g = 0; g < 240; g += 1) { const k = `${y}-${pad(m)}`; if (k > endM) break; out.push(k); m += 1; if (m > 12) { m = 1; y += 1; } }
  return out;
}
/** וויפיל א מענטש האט פארדינט אין א חודש: { global, hours (מינוטן), hoursPay, plus, minus, total } */
export function monthPay(id, mo) {
  const t = teamOf(id); const inf = infoOf(id);
  const rate = Number(inf.hourly_rate) || 0; const glob = Number(inf.global_amount) || 0;
  const [y, m] = mo.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const inRange = (iso) => (!t.start_date || iso >= t.start_date) && (!t.end_date || iso <= t.end_date);
  let mins = 0;
  if (t.pay_type === 'schedule') {
    let sched; try { sched = JSON.parse(t.schedule || '[]'); } catch { sched = []; }
    for (let dd = 1; dd <= last; dd += 1) {
      const iso = `${mo}-${pad(dd)}`; if (!inRange(iso)) continue;
      const wd = new Date(`${iso}T12:00:00Z`).getUTCDay();
      sched.filter((s) => s.d === wd).forEach((s) => { mins += minsOf(s.from, s.to); });
    }
  } else if (t.pay_type === 'log' || t.pay_type === 'mixed') {
    F.d.hours.filter((r) => String(r.contact_id) === String(id) && r.date.slice(0, 7) === mo).forEach((r) => { mins += minsOf(r.time_in, r.time_out); });
  }
  const global = t.pay_type === 'global' || t.pay_type === 'mixed' ? glob : 0;
  const hoursPay = Math.round((mins / 60) * rate * 100) / 100;
  const its = F.d.items.filter((x) => String(x.contact_id) === String(id) && x.month === mo);
  const plus = its.filter((x) => x.kind !== 'minus').reduce((s, x) => s + Number(x.amount || 0), 0);
  const minus = its.filter((x) => x.kind === 'minus').reduce((s, x) => s + Number(x.amount || 0), 0);
  return { global, mins, rate, hoursPay, plus, minus, total: Math.round((global + hoursPay + plus - minus) * 100) / 100 };
}
function paidIn(id, mo) { return F.d.payments.filter((p) => String(p.contact_id) === String(id) && (!mo || p.date.slice(0, 7) === mo)).reduce((s, p) => s + Number(p.amount || 0), 0); }
/** וויפיל מ'איז נאך שולדיג (אלע חדשים ביז היינט, מינוס אלע תשלומים) */
export function owed(id) {
  const t = teamOf(id);
  const earned = monthsRange(t, id).reduce((s, mo) => s + monthPay(id, mo).total, 0);
  return Math.round((earned - paidIn(id)) * 100) / 100;
}
const hhmm = (n) => `${Math.floor(n / 60)}:${pad(n % 60)}`;

// =====================================================================
export async function renderFinance(box) {
  const { h } = X;
  if (!F.d) {
    box.innerHTML = '<p class="muted">טוען…</p>';
    try { await load(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
  }
  if (!F.month) F.month = todayIso().slice(0, 7);
  const tabs = [['sal', '💵 משכורות'], ['exp', '🧾 הוצאות'], ['inc', '📥 הכנסות ותמיכה'], ['debt', '⚖️ חובות פתוחים'], ['bal', '📊 מאזן חודשי']];
  box.innerHTML = `<h2 class="ms-h">💰 משכורות והוצאות</h2>
    <nav class="ms-subtabs">${tabs.map(([k, l]) => `<button type="button" data-ft="${k}" class="${F.tab === k ? 'on' : ''}">${h(l)}</button>`).join('')}
      <span class="spacer"></span><button type="button" class="linkish" id="fn-reload">⟳ רענון</button></nav><div id="fn-body"></div>`;
  X.$$('[data-ft]', box).forEach((b) => { b.onclick = () => { F.tab = b.dataset.ft; renderFinance(box); }; });
  X.$('#fn-reload', box).onclick = async () => { F.d = null; renderFinance(box); };
  const body = X.$('#fn-body', box);
  const rer = () => renderFinance(box);
  ({ sal: salTab, exp: expTab, inc: incTab, debt: debtTab, bal: balTab })[F.tab](body, rer);
}
const monthBar = (extra = '') => `<div class="ms-bar"><label>חודש <input type="month" id="fn-mo" value="${X.h(F.month)}"></label><b>${X.h(monthName(F.month))}</b><span class="spacer"></span>${extra}</div>`;
const wireMonth = (body, rer) => { X.$('#fn-mo', body).onchange = (e) => { if (e.target.value) { F.month = e.target.value; rer(); } }; };

// ---------- 💵 משכורות ----------
function salTab(body, rer) {
  const { h } = X;
  const staff = team().filter((t) => X.pById(t.contact_id) && (t.active !== 'FALSE' || Math.abs(owed(t.contact_id)) > 0.009));
  const rows = staff.map((t) => ({ t, p: monthPay(t.contact_id, F.month), paid: paidIn(t.contact_id, F.month), owe: owed(t.contact_id) }));
  const sum = (k) => rows.reduce((s, r) => s + (k === 'paid' ? r.paid : k === 'owe' ? r.owe : r.p.total), 0);
  body.innerHTML = `${monthBar('<button type="button" class="btn" id="sl-print">🖨 הדפסה</button><button type="button" class="btn" id="sl-xl">⬇ Excel</button>')}
    <div class="ms-stats"><div class="ms-stat"><span class="muted small">לחודש הזה</span><b>${cur(sum('total'))}</b></div><div class="ms-stat"><span class="muted small">שולם החודש</span><b>${cur(sum('paid'))}</b></div>
      <div class="ms-stat owe"><span class="muted small">הישיבה חייבת (סה"כ)</span><b>${cur(sum('owe'))}</b></div></div>
    ${rows.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>איש צוות</th><th>סוג</th><th>שעות</th><th>גלובלי</th><th>שעות ₪</th><th>תוספות / ניכויים</th><th>לחודש</th><th>שולם</th><th>נשאר (סה"כ)</th><th></th></tr></thead><tbody>
      ${rows.map(({ t, p, paid, owe }) => `<tr><td><b>${h(nameOf(t.contact_id))}</b><div class="muted small">${h(t.role || '')}</div></td><td class="small">${h(PAY_TYPES[t.pay_type || ''])}</td>
        <td class="num">${p.mins ? hhmm(p.mins) : ''}</td><td class="num">${p.global ? cur(p.global) : ''}</td><td class="num">${p.hoursPay ? cur(p.hoursPay) : ''}</td>
        <td class="num small">${p.plus ? `+${cur(p.plus)}` : ''} ${p.minus ? `−${cur(p.minus)}` : ''}</td><td class="num"><b>${cur(p.total)}</b></td><td class="num">${paid ? cur(paid) : ''}</td>
        <td class="num ${owe > 0 ? 'ms-owe' : ''}">${cur(owe)}</td><td><button type="button" class="btn small-btn" data-pay="${h(t.contact_id)}">💰 פתח</button></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="ms-note">אין עדיין אנשי צוות. מוסיפים ב"👔 אנשי צוות ואברכים", ובוחרים שם סוג שכר.</p>'}
    <p class="muted small">"נשאר" = כל מה שהרוויח מאז שהתחיל, פחות כל התשלומים. מקדמה = תשלום (מסומן "מקדמה").</p>`;
  wireMonth(body, rer);
  X.$$('[data-pay]', body).forEach((b) => { b.onclick = () => payDialog(b.dataset.pay, rer); });
  const head = ['איש צוות', 'תפקיד', 'סוג', 'שעות', 'גלובלי', 'שעות ₪', 'תוספות', 'ניכויים', 'לחודש', 'שולם החודש', 'נשאר סה"כ'];
  const data = rows.map(({ t, p, paid, owe }) => [nameOf(t.contact_id), t.role || '', PAY_TYPES[t.pay_type || ''], p.mins ? Math.round((p.mins / 60) * 100) / 100 : '', p.global, p.hoursPay, p.plus, p.minus, p.total, paid, owe]);
  X.$('#sl-xl', body).onclick = () => downloadXlsx(`משכורות ${F.month}`, head, data, { rtl: true });
  X.$('#sl-print', body).onclick = () => X.printWin(`משכורות — ${monthName(F.month)}`, '', `<table><thead><tr>${head.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>
    ${data.map((r) => `<tr>${r.map((c, j) => `<td${j > 2 ? ' class="c"' : ''}>${h(typeof c === 'number' && j > 3 ? cur(c) : c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`, { landscape: true });
}

/** 💰 די משכורת פון איין מענטש (אויך פונעם 👔 כפתור) */
export async function payDialog(id, rer = null) {
  const { h, S } = X;
  if (!F.d) { try { await load(); } catch (err) { X.toast(X.msg(err), 'err'); return; } }
  if (!F.month) F.month = todayIso().slice(0, 7);
  const t = teamOf(id); const inf = infoOf(id);
  const mo = F.month;
  const p = monthPay(id, mo);
  const its = F.d.items.filter((x) => String(x.contact_id) === String(id)).sort((a, b) => b.month.localeCompare(a.month));
  const pays = F.d.payments.filter((x) => String(x.contact_id) === String(id)).sort((a, b) => b.date.localeCompare(a.date));
  const months = monthsRange(t, id).reverse();
  const d = X.dialog(`<h2>💰 ${h(nameOf(id))} <span class="muted small">${h(t.role || '')} · ${h(PAY_TYPES[t.pay_type || ''])}</span></h2>
    ${t.pay_type ? '' : '<p class="ms-note">לא נבחר סוג שכר — בוחרים ב"👔 אנשי צוות" (✎).</p>'}
    <form class="ms-form" id="pd-info" autocomplete="off"><div class="grid">
      <label>סכום גלובלי לחודש (₪)<input name="global_amount" type="number" min="0" step="1" dir="ltr" value="${h(inf.global_amount || '')}"></label>
      <label>לשעה (₪)<input name="hourly_rate" type="number" min="0" step="0.5" dir="ltr" value="${h(inf.hourly_rate || '')}"></label>
      <label>תעודת זהות<input name="id_number" dir="ltr" inputmode="numeric" value="${h(inf.id_number || '')}"></label>
      <label>4 ספרות אחרונות של החשבון<input name="bank_last4" dir="ltr" maxlength="4" inputmode="numeric" value="${h(inf.bank_last4 || '')}"></label>
      <label class="wide">הערה<input name="note" value="${h(inf.note || '')}"></label>
    </div><div class="actions"><span class="spacer"></span><button type="submit" class="btn">💾 שמירת פרטים</button></div></form>
    <h3>${h(monthName(mo))}</h3>
    <div class="kv"><span>שעות</span><span>${p.mins ? hhmm(p.mins) : '—'}${t.pay_type === 'schedule' ? ` <span class="muted small">(${h(schedText(t.schedule))})</span>` : ''}</span></div>
    <div class="kv"><span>גלובלי</span><span>${cur(p.global)}</span></div><div class="kv"><span>שעות × ${cur(p.rate)}</span><span>${cur(p.hoursPay)}</span></div>
    <div class="kv"><span>תוספות / ניכויים</span><span>+${cur(p.plus)} / −${cur(p.minus)}</span></div>
    <div class="kv"><span><b>לחודש</b></span><span><b>${cur(p.total)}</b></span></div><div class="kv"><span>שולם החודש</span><span>${cur(paidIn(id, mo))}</span></div>
    <div class="kv"><span><b>נשאר (סה"כ)</b></span><span class="${owed(id) > 0 ? 'ms-owe' : ''}"><b>${cur(owed(id))}</b></span></div>
    <h3>➕ תוספת / ניכוי</h3>
    <form class="ms-bar" id="pd-item" autocomplete="off"><select name="kind"><option value="plus">תוספת / בונוס</option><option value="minus">ניכוי</option></select>
      <input name="amount" type="number" min="0" step="1" dir="ltr" placeholder="₪" style="width:90px"><input name="month" type="month" value="${h(mo)}"><input name="note" placeholder="על מה"><button type="submit" class="btn">הוסף</button></form>
    ${its.length ? `<table class="ms-table"><tbody>${its.map((x) => `<tr><td>${h(x.month)}</td><td>${x.kind === 'minus' ? 'ניכוי' : 'תוספת'}</td><td class="num">${cur(x.amount)}</td><td class="small">${h(x.note)}</td><td><button type="button" class="linkish" data-di="${h(x.item_id)}">🗑</button></td></tr>`).join('')}</tbody></table>` : ''}
    <h3>💸 תשלום</h3>
    <form class="ms-bar" id="pd-pay" autocomplete="off"><input name="date" type="date" value="${h(todayIso())}"><input name="amount" type="number" min="0" step="1" dir="ltr" placeholder="₪" style="width:90px">
      <select name="method">${METHODS.map((m) => `<option>${h(m)}</option>`).join('')}</select><label class="check"><input type="checkbox" name="advance"> מקדמה</label><input name="note" placeholder="הערה"><button type="submit" class="btn primary">הוסף תשלום</button></form>
    ${pays.length ? `<table class="ms-table"><tbody>${pays.map((x) => `<tr><td>${h(x.date)}</td><td class="num">${cur(x.amount)}</td><td class="small">${h(x.method)}${x.advance === 'true' || x.advance === 'TRUE' ? ' · מקדמה' : ''}</td><td class="small">${h(x.note)}</td><td><button type="button" class="linkish" data-dp="${h(x.pay_id)}">🗑</button></td></tr>`).join('')}</tbody></table>` : ''}
    <div class="actions"><button type="button" class="btn" id="pd-hx">📜 היסטוריה</button><button type="button" class="btn" id="pd-print">🖨 דף לחודש</button><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`, 'ms-wide');
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const after = async () => { await load(); d.close(); payDialog(id, rer); rer?.(); };
  const save = async (tab, row) => { try { await X.call(X.KEY, 'finSave', { tab, row }); X.toast('נשמר.'); await after(); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('#pd-info', d).onsubmit = (e) => { e.preventDefault(); const f = e.target.elements; save('PayInfo', { contact_id: id, global_amount: f.global_amount.value, hourly_rate: f.hourly_rate.value, id_number: S(f.id_number.value), bank_last4: S(f.bank_last4.value), note: S(f.note.value) }); };
  X.$('#pd-item', d).onsubmit = (e) => { e.preventDefault(); const f = e.target.elements; if (!(Number(f.amount.value) > 0)) { X.toast('חסר סכום.', 'err'); return; } save('PayItems', { contact_id: id, kind: f.kind.value, amount: f.amount.value, month: f.month.value || mo, note: S(f.note.value) }); };
  X.$('#pd-pay', d).onsubmit = (e) => { e.preventDefault(); const f = e.target.elements; if (!(Number(f.amount.value) > 0)) { X.toast('חסר סכום.', 'err'); return; } save('PayPayments', { contact_id: id, date: f.date.value, amount: f.amount.value, method: f.method.value, advance: f.advance.checked ? 'TRUE' : '', note: S(f.note.value) }); };
  const del = async (tab, rid) => { if (!window.confirm('למחוק?')) return; try { await X.call(X.KEY, 'finDelete', { tab, id: rid }); await after(); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$$('[data-di]', d).forEach((b) => { b.onclick = () => del('PayItems', b.dataset.di); });
  X.$$('[data-dp]', d).forEach((b) => { b.onclick = () => del('PayPayments', b.dataset.dp); });
  X.$('#pd-hx', d).onclick = () => historyDialog({ contact_id: id }, nameOf(id));
  X.$('#pd-print', d).onclick = () => {
    const mp = monthPay(id, mo);
    const mPays = pays.filter((x) => x.date.slice(0, 7) === mo);
    X.printWin(`דף משכורת — ${nameOf(id)}`, h(monthName(mo)), `<table><tbody>
      <tr><th>תפקיד</th><td>${h(t.role || '')}</td></tr><tr><th>סוג שכר</th><td>${h(PAY_TYPES[t.pay_type || ''])}</td></tr>
      <tr><th>שעות</th><td>${mp.mins ? hhmm(mp.mins) : '—'}</td></tr><tr><th>גלובלי</th><td>${cur(mp.global)}</td></tr><tr><th>שעות × ${cur(mp.rate)}</th><td>${cur(mp.hoursPay)}</td></tr>
      ${its.filter((x) => x.month === mo).map((x) => `<tr><th>${x.kind === 'minus' ? 'ניכוי' : 'תוספת'}: ${h(x.note)}</th><td>${x.kind === 'minus' ? '−' : '+'}${cur(x.amount)}</td></tr>`).join('')}
      <tr><th>סה"כ לחודש</th><td><b>${cur(mp.total)}</b></td></tr>
      ${mPays.map((x) => `<tr><th>שולם ${h(x.date)} (${h(x.method)}${x.advance === 'TRUE' ? ', מקדמה' : ''})</th><td>${cur(x.amount)}</td></tr>`).join('')}
      <tr><th>נשאר לתשלום (סה"כ עד היום)</th><td><b>${cur(owed(id))}</b></td></tr></tbody></table>
      <h3 style="margin-top:14px">כל החודשים</h3><table><thead><tr><th>חודש</th><th>לחודש</th><th>שולם</th></tr></thead><tbody>
      ${months.map((m2) => `<tr><td>${h(monthName(m2))}</td><td class="c">${cur(monthPay(id, m2).total)}</td><td class="c">${cur(paidIn(id, m2))}</td></tr>`).join('')}</tbody></table>`);
  };
}

// ---------- 🧾 הוצאות ----------
const isPaidV = (v) => v === 'TRUE' || v === 'true';
function expTab(body, rer) {
  const { h } = X;
  const cats = F.d.settings?.exp_cats || [];
  const list = F.d.expenses.filter((x) => x.date.slice(0, 7) === F.month && (!F.expF.cat || x.category === F.expF.cat) && (!F.expF.open || !isPaidV(x.is_paid)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const tot = (c) => list.filter((x) => (x.currency || 'ILS') === c).reduce((s, x) => s + Number(x.amount || 0), 0);
  body.innerHTML = `${monthBar('<button type="button" class="btn primary" id="ex-new">➕ הוצאה</button><button type="button" class="btn" id="ex-cats">🏷 קטגוריות</button><button type="button" class="btn" id="ex-xl">⬇ Excel</button>')}
    <div class="ms-bar"><select id="ex-cat"><option value="">כל הקטגוריות</option>${cats.map((c) => `<option${c === F.expF.cat ? ' selected' : ''}>${h(c)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="ex-open"${F.expF.open ? ' checked' : ''}> רק שלא שולמו</label>
      <span class="spacer"></span><b>${cur(tot('ILS'))}</b> · <b>${cur(tot('USD'), 'USD')}</b></div>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>תאריך</th><th>קטגוריה</th><th>למי</th><th>סכום</th><th>על חשבון</th><th>שולם</th><th>מי שילם</th><th>📎</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr><td class="small">${h(x.date)}</td><td>${h(x.category)}</td><td>${h(x.paid_to)}</td><td class="num">${cur(x.amount, x.currency)}</td>
        <td class="small">${h(chargedTxt(x))}</td><td>${isPaidV(x.is_paid) ? '✓' : '<span class="ms-owe">לא</span>'}</td><td class="small">${h(x.paid_by_id || x.paid_by ? nameOf(x.paid_by_id, x.paid_by) : 'הישיבה')}</td>
        <td>${x.receipt_file ? `<button type="button" class="linkish" data-file="${h(x.receipt_file)}">📎</button>` : ''}</td>
        <td><button type="button" class="btn small-btn" data-ed="${h(x.exp_id)}">✎</button></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted ms-empty">אין הוצאות בחודש הזה.</p>'}`;
  wireMonth(body, rer);
  X.$('#ex-cat', body).onchange = (e) => { F.expF.cat = e.target.value; rer(); };
  X.$('#ex-open', body).onchange = (e) => { F.expF.open = e.target.checked; rer(); };
  X.$('#ex-new', body).onclick = () => expDialog(null, rer);
  X.$('#ex-cats', body).onclick = () => catsDialog('exp_cats', 'קטגוריות של הוצאות', rer);
  X.$$('[data-ed]', body).forEach((b) => { b.onclick = () => expDialog(F.d.expenses.find((x) => x.exp_id === b.dataset.ed), rer); });
  X.$$('[data-file]', body).forEach((b) => { b.onclick = () => openFile(b.dataset.file); });
  X.$('#ex-xl', body).onclick = () => downloadXlsx(`הוצאות ${F.month}`, ['תאריך', 'קטגוריה', 'למי', 'סכום', 'מטבע', 'על חשבון', 'שולם', 'מי שילם', 'אמצעי', 'הערה'],
    list.map((x) => [x.date, x.category, x.paid_to, Number(x.amount || 0), x.currency || 'ILS', chargedTxt(x), isPaidV(x.is_paid) ? 'כן' : 'לא', nameOf(x.paid_by_id, x.paid_by) || 'הישיבה', x.method, x.note]), { rtl: true });
}
const chargedTxt = (x) => (x.charged_type === 'person' ? `${nameOf(x.charged_id, x.charged_to)} (צריך להחזיר)` : x.charged_type === 'org' ? x.charged_to : 'הישיבה');
async function openFile(id) {
  const w = window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש.', 'err'); return; }
  w.document.write('<p style="font-family:sans-serif">טוען…</p>');
  try {
    const r = await X.call(X.KEY, 'fileGet', { id });
    w.document.open();
    w.document.write(r.data.startsWith('data:application/pdf') ? `<iframe src="${r.data}" style="border:0;width:100%;height:100vh"></iframe>` : `<img src="${r.data}" style="max-width:100%">`);
    w.document.close();
  } catch (err) { w.close(); X.toast(X.msg(err), 'err'); }
}
/** א בילד → JPEG קליין (ביז 1600 פיקסל, ~200KB). PDF — ווי עס איז (ביז 2MB) */
async function shrink(file) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  if (file.type === 'application/pdf') { if (url.length > 2700000) throw new Error('file-big'); return url; }
  const img = new Image(); img.src = url; await img.decode();
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let q = 0.72; let out = c.toDataURL('image/jpeg', q);
  while (out.length > 300000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
  return out;
}
const personList = () => X.st.people.slice().sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he')).map((p) => `<option value="${X.h(`${X.nameOf(p)} (#${p.contact_id})`)}">`).join('');
const pickId = (v) => (String(v || '').match(/\(#(\d+)\)$/) || [])[1] || '';
const pickTxt = (id, txt) => (id && X.pById(id) ? `${X.nameOf(X.pById(id))} (#${id})` : txt || '');

function expDialog(x0, rer) {
  const { h, S } = X;
  const x = x0 || { date: todayIso(), currency: 'ILS', is_paid: 'TRUE', charged_type: '' };
  const cats = F.d.settings?.exp_cats || [];
  const d = X.dialog(`<h2>🧾 ${x0 ? 'עריכת הוצאה' : 'הוצאה חדשה'}</h2>
    <form class="ms-form" autocomplete="off"><div class="grid">
      <label>תאריך<input name="date" type="date" value="${h(x.date)}"></label>
      <label>סכום *<span class="amount-wrap"><select name="currency">${CURS.map(([k, l]) => `<option value="${k}"${(x.currency || 'ILS') === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select><input name="amount" type="number" min="0" step="0.01" dir="ltr" value="${h(x.amount || '')}"></span></label>
      <label>קטגוריה<select name="category"><option value=""></option>${cats.map((c) => `<option${c === x.category ? ' selected' : ''}>${h(c)}</option>`).join('')}</select></label>
      <label>למי שולם<input name="paid_to" value="${h(x.paid_to || '')}" placeholder="ספק / חנות / בעל הבית"></label>
      <label>על חשבון<select name="charged_type"><option value=""${!x.charged_type ? ' selected' : ''}>הישיבה</option><option value="org"${x.charged_type === 'org' ? ' selected' : ''}>גוף אחר</option><option value="person"${x.charged_type === 'person' ? ' selected' : ''}>אדם (צריך להחזיר)</option></select></label>
      <label class="ex-ch"${x.charged_type ? '' : ' hidden'}>מי<input name="charged" list="fn-dl" value="${h(pickTxt(x.charged_id, x.charged_to))}" placeholder="שם הגוף / האדם"></label>
      <label class="check"><input type="checkbox" name="is_paid"${isPaidV(x.is_paid) ? ' checked' : ''}> שולם</label>
      <label>מי שילם<input name="paid_by" list="fn-dl" value="${h(pickTxt(x.paid_by_id, x.paid_by))}" placeholder="ריק = הישיבה; אדם → הישיבה חייבת לו"></label>
      <label>אמצעי תשלום<select name="method"><option value=""></option>${METHODS.map((m) => `<option${m === x.method ? ' selected' : ''}>${h(m)}</option>`).join('')}</select></label>
      <label class="wide">הערה<input name="note" value="${h(x.note || '')}"></label>
      <label class="wide">📎 צילום קבלה<input type="file" name="file" accept="image/*,application/pdf">${x.receipt_file ? '<span class="muted small">יש כבר קובץ — קובץ חדש יחליף אותו.</span>' : ''}</label>
    </div><datalist id="fn-dl">${personList()}</datalist>
    <div class="actions">${x0 ? '<button type="button" class="btn danger" id="ex-del">🗑 מחיקה</button><button type="button" class="btn" id="ex-hx">📜 היסטוריה</button>' : ''}<span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div></form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d); const el = form.elements;
  el.charged_type.onchange = () => { X.$('.ex-ch', d).hidden = !el.charged_type.value; };
  X.$('#ex-hx', d)?.addEventListener('click', () => historyDialog({ entity: 'Expenses', id: x.exp_id }, 'הוצאה'));
  X.$('#ex-del', d)?.addEventListener('click', async () => {
    if (!window.confirm('למחוק את ההוצאה?')) return;
    try { await X.call(X.KEY, 'finDelete', { tab: 'Expenses', id: x.exp_id }); await load(); d.close(); rer(); } catch (err) { X.toast(X.msg(err), 'err'); }
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!(Number(el.amount.value) > 0)) { X.toast('חסר סכום.', 'err'); return; }
    const btn = X.$('button[type=submit]', form); btn.disabled = true;
    try {
      let file = x.receipt_file || '';
      if (el.file.files[0]) { const data = await shrink(el.file.files[0]); file = (await X.call(X.KEY, 'upload', { data, name: el.file.files[0].name })).id; }
      const cid = pickId(el.charged.value); const pid = pickId(el.paid_by.value);
      await X.call(X.KEY, 'finSave', { tab: 'Expenses', row: { exp_id: x.exp_id || '', date: el.date.value, amount: el.amount.value, currency: el.currency.value, category: el.category.value, paid_to: S(el.paid_to.value),
        charged_type: el.charged_type.value, charged_to: el.charged_type.value ? (cid ? '' : S(el.charged.value)) : '', charged_id: el.charged_type.value ? cid : '', is_paid: el.is_paid.checked ? 'TRUE' : 'FALSE',
        paid_by: pid ? '' : S(el.paid_by.value), paid_by_id: pid, method: el.method.value, note: S(el.note.value), receipt_file: file } });
      await load(); d.close(); rer(); X.toast('נשמר.');
    } catch (err) { btn.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
function catsDialog(key, title, rer) {
  const { h } = X;
  const d = X.dialog(`<h2>🏷 ${h(title)}</h2><p class="muted small">שורה לכל קטגוריה.</p><textarea rows="10" style="width:100%">${h((F.d.settings?.[key] || []).join('\n'))}</textarea>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" id="ct-save">💾 שמירה</button></div>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  X.$('#ct-save', d).onclick = async () => {
    const list = X.$('textarea', d).value.split('\n').map((s) => s.trim()).filter(Boolean);
    try { const r = await X.call(X.KEY, 'finSettings', { settings: { [key]: list } }); F.d.settings = r.settings; d.close(); rer(); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

// ---------- 📥 הכנסות ותמיכה ----------
function autoIncomes(mo) {
  const tu = F.d.tuition.filter((x) => x.date.slice(0, 7) === mo).reduce((s, x) => s + x.amount, 0);
  const g = F.d.gifts.filter((x) => x.date.slice(0, 7) === mo);
  // אלץ אין ₪ (לויטן שער פונעם טאג); נאר אויב דער שער איז נישט געקומען — בלייבט עס אין $
  const gIls = g.filter((x) => x.ils != null).reduce((s, x) => s + x.ils, 0);
  const gUsd = g.filter((x) => x.ils == null).reduce((s, x) => s + (x.usd || 0), 0);
  const gConv = g.filter((x) => x.currency !== 'ILS' && x.ils != null).reduce((s, x) => s + (x.usd || 0), 0);
  return { tu, gIls, gUsd, gConv };
}
function incTab(body, rer) {
  const { h } = X;
  const list = F.d.incomes.filter((x) => x.date.slice(0, 7) === F.month).sort((a, b) => b.date.localeCompare(a.date));
  const a = autoIncomes(F.month);
  body.innerHTML = `${monthBar('<button type="button" class="btn primary" id="in-new">➕ הכנסה / תמיכה</button><button type="button" class="btn" id="in-cats">🏷 קטגוריות</button><button type="button" class="btn" id="in-xl">⬇ Excel</button>')}
    <h3>אוטומטי</h3><table class="ms-table"><tbody>
      <tr><td>💲 שכר לימוד</td><td class="num">${cur(a.tu, 'USD')}</td></tr>
      <tr><td>💝 נדבות${a.gConv ? ` <span class="muted small">(כולל ${cur(a.gConv, 'USD')} שהומרו לפי שער יום הנדבה)</span>` : ''}</td><td class="num">${cur(a.gIls)}${a.gUsd ? ` · ${cur(a.gUsd, 'USD')} <span class="muted small">(אין שער)</span>` : ''}</td></tr></tbody></table>
    <h3>הכנסות ותמיכות</h3>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>תאריך</th><th>קטגוריה</th><th>ממי</th><th>סכום</th><th>הלוואה</th><th>הערה</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr><td class="small">${h(x.date)}</td><td>${h(x.category)}</td><td>${h(nameOf(x.source_id, x.source))}</td><td class="num">${cur(x.amount, x.currency)}</td>
        <td>${x.is_loan === 'TRUE' ? '✓ (צריך להחזיר)' : ''}</td><td class="small">${h(x.note)}</td><td><button type="button" class="btn small-btn" data-ed="${h(x.inc_id)}">✎</button></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted ms-empty">אין בחודש הזה.</p>'}`;
  wireMonth(body, rer);
  X.$('#in-new', body).onclick = () => incDialog(null, rer);
  X.$('#in-cats', body).onclick = () => catsDialog('inc_cats', 'קטגוריות של הכנסות ותמיכות', rer);
  X.$$('[data-ed]', body).forEach((b) => { b.onclick = () => incDialog(F.d.incomes.find((x) => x.inc_id === b.dataset.ed), rer); });
  X.$('#in-xl', body).onclick = () => downloadXlsx(`הכנסות ${F.month}`, ['תאריך', 'קטגוריה', 'ממי', 'סכום', 'מטבע', 'הלוואה', 'הערה'],
    list.map((x) => [x.date, x.category, nameOf(x.source_id, x.source), Number(x.amount || 0), x.currency || 'ILS', x.is_loan === 'TRUE' ? 'כן' : '', x.note]), { rtl: true });
}
function incDialog(x0, rer) {
  const { h, S } = X;
  const x = x0 || { date: todayIso(), currency: 'ILS' };
  const cats = F.d.settings?.inc_cats || [];
  const d = X.dialog(`<h2>📥 ${x0 ? 'עריכה' : 'הכנסה / תמיכה חדשה'}</h2>
    <form class="ms-form" autocomplete="off"><div class="grid">
      <label>תאריך<input name="date" type="date" value="${h(x.date)}"></label>
      <label>סכום *<span class="amount-wrap"><select name="currency">${CURS.map(([k, l]) => `<option value="${k}"${(x.currency || 'ILS') === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select><input name="amount" type="number" min="0" step="0.01" dir="ltr" value="${h(x.amount || '')}"></span></label>
      <label>קטגוריה<select name="category"><option value=""></option>${cats.map((c) => `<option${c === x.category ? ' selected' : ''}>${h(c)}</option>`).join('')}</select></label>
      <label>ממי<input name="source" list="fn-dl" value="${h(pickTxt(x.source_id, x.source))}"></label>
      <label class="check"><input type="checkbox" name="is_loan"${x.is_loan === 'TRUE' ? ' checked' : ''}> הלוואה (צריך להחזיר)</label>
      <label>אמצעי<select name="method"><option value=""></option>${METHODS.map((m) => `<option${m === x.method ? ' selected' : ''}>${h(m)}</option>`).join('')}</select></label>
      <label class="wide">הערה<input name="note" value="${h(x.note || '')}"></label>
    </div><datalist id="fn-dl">${personList()}</datalist>
    <div class="actions">${x0 ? '<button type="button" class="btn danger" id="in-del">🗑 מחיקה</button>' : ''}<span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div></form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d); const el = form.elements;
  el.category.onchange = () => { if (/הלוואה/.test(el.category.value)) el.is_loan.checked = true; };
  X.$('#in-del', d)?.addEventListener('click', async () => {
    if (!window.confirm('למחוק?')) return;
    try { await X.call(X.KEY, 'finDelete', { tab: 'Incomes', id: x.inc_id }); await load(); d.close(); rer(); } catch (err) { X.toast(X.msg(err), 'err'); }
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!(Number(el.amount.value) > 0)) { X.toast('חסר סכום.', 'err'); return; }
    const sid = pickId(el.source.value);
    try {
      await X.call(X.KEY, 'finSave', { tab: 'Incomes', row: { inc_id: x.inc_id || '', date: el.date.value, amount: el.amount.value, currency: el.currency.value, category: el.category.value,
        source: sid ? '' : S(el.source.value), source_id: sid, is_loan: el.is_loan.checked ? 'TRUE' : '', method: el.method.value, note: S(el.note.value) } });
      await load(); d.close(); rer(); X.toast('נשמר.');
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

// ---------- ⚖️ חובות פתוחים ----------
/** אלע חובות: { key, dir: 'in' (חייבים לישיבה) | 'out' (הישיבה חייבת), who, amount, currency, reason, date, repaid, left, readOnly, link } */
function allDebts() {
  const rep = (k) => F.d.repayments.filter((r) => r.debt_key === k).reduce((s, r) => s + Number(r.amount || 0), 0);
  const out = [];
  const add = (o) => { const repaid = o.readOnly ? 0 : rep(o.key); out.push({ ...o, repaid, left: Math.round((o.amount - repaid) * 100) / 100 }); };
  F.d.expenses.forEach((x) => {
    if (x.charged_type === 'person') add({ key: `e${x.exp_id}`, dir: 'in', who: nameOf(x.charged_id, x.charged_to), amount: Number(x.amount || 0), currency: x.currency || 'ILS', reason: `הוצאה: ${x.category || ''} ${x.paid_to || ''}`, date: x.date });
    if (x.paid_by_id || x.paid_by) add({ key: `r${x.exp_id}`, dir: 'out', who: nameOf(x.paid_by_id, x.paid_by), amount: Number(x.amount || 0), currency: x.currency || 'ILS', reason: `שילם מכיסו: ${x.category || ''} ${x.paid_to || ''}`, date: x.date });
  });
  F.d.incomes.filter((x) => x.is_loan === 'TRUE').forEach((x) => add({ key: `i${x.inc_id}`, dir: 'out', who: nameOf(x.source_id, x.source), amount: Number(x.amount || 0), currency: x.currency || 'ILS', reason: `הלוואה שהתקבלה ${x.category || ''}`, date: x.date }));
  F.d.debts.forEach((x) => add({ key: `d${x.debt_id}`, dir: x.direction === 'out' ? 'out' : 'in', who: nameOf(x.person_id, x.person), amount: Number(x.amount || 0), currency: x.currency || 'ILS', reason: x.reason || (x.direction === 'out' ? 'חוב' : 'הלוואה'), date: x.date, debt: x }));
  team().forEach((t) => { const o = owed(t.contact_id); if (o > 0.009) add({ key: `sal${t.contact_id}`, dir: 'out', who: nameOf(t.contact_id), amount: o, currency: 'ILS', reason: 'משכורת שלא שולמה', date: '', readOnly: 'sal', cid: t.contact_id }); });
  (alumniDebts?.() || []).forEach((a) => add({ key: `tu${a.enroll_id}`, dir: 'in', who: a.name, amount: a.balance, currency: 'USD', reason: 'שכר לימוד (בוגר)', date: a.end || '', readOnly: 'tu' }));
  return out;
}
function debtTab(body, rer) {
  const { h } = X;
  const all = allDebts();
  const list = all.filter((x) => (F.debtsClosed ? x.left <= 0.009 : x.left > 0.009));
  const sum = (dir, c) => all.filter((x) => x.dir === dir && x.currency === c && x.left > 0).reduce((s, x) => s + x.left, 0);
  const table = (dir) => { const l = list.filter((x) => x.dir === dir); return l.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>מי</th><th>על מה</th><th>תאריך</th><th>סכום</th><th>הוחזר</th><th>נשאר</th><th></th></tr></thead><tbody>
    ${l.map((x) => `<tr><td><b>${h(x.who)}</b></td><td class="small">${h(x.reason)}</td><td class="small">${h(x.date)}</td><td class="num">${cur(x.amount, x.currency)}</td><td class="num">${x.repaid ? cur(x.repaid, x.currency) : ''}</td>
      <td class="num ${x.left > 0 ? 'ms-owe' : ''}">${cur(x.left, x.currency)}</td>
      <td class="ms-acts">${x.readOnly === 'sal' ? `<button type="button" class="btn small-btn" data-sal="${h(x.cid)}">💵 משכורות</button>` : x.readOnly === 'tu' ? '<span class="muted small">בכפתור שכר לימוד</span>' : `<button type="button" class="btn small-btn" data-rep="${h(x.key)}">↩ החזר</button>${x.debt ? `<button type="button" class="btn small-btn" data-ded="${h(x.debt.debt_id)}">✎</button>` : ''}`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">אין.</p>'; };
  body.innerHTML = `<div class="ms-bar"><div class="seg"><button type="button" data-c="0" class="${F.debtsClosed ? '' : 'on'}">פתוחים</button><button type="button" data-c="1" class="${F.debtsClosed ? 'on' : ''}">סגורים</button></div>
      <span class="spacer"></span><button type="button" class="btn primary" id="db-new">➕ הלוואה / חוב</button></div>
    <div class="ms-stats"><div class="ms-stat"><span class="muted small">חייבים לישיבה</span><b>${cur(sum('in', 'ILS'))}</b><b>${cur(sum('in', 'USD'), 'USD')}</b></div>
      <div class="ms-stat owe"><span class="muted small">הישיבה חייבת</span><b>${cur(sum('out', 'ILS'))}</b><b>${cur(sum('out', 'USD'), 'USD')}</b></div></div>
    <h3>⬅ חייבים לישיבה</h3>${table('in')}<h3>➡ הישיבה חייבת</h3>${table('out')}
    <p class="muted small">חובות מגיעים אוטומטית מ: הוצאה "על חשבון אדם", הוצאה ש"מי שילם" הוא אדם, הכנסה שמסומנת "הלוואה", משכורות שלא שולמו, ושכר לימוד של בוגרים.</p>`;
  X.$$('[data-c]', body).forEach((b) => { b.onclick = () => { F.debtsClosed = b.dataset.c === '1'; rer(); }; });
  X.$('#db-new', body).onclick = () => debtDialog(null, rer);
  X.$$('[data-ded]', body).forEach((b) => { b.onclick = () => debtDialog(F.d.debts.find((x) => x.debt_id === b.dataset.ded), rer); });
  X.$$('[data-sal]', body).forEach((b) => { b.onclick = () => payDialog(b.dataset.sal, rer); });
  X.$$('[data-rep]', body).forEach((b) => { b.onclick = () => repDialog(all.find((x) => x.key === b.dataset.rep), rer); });
}
function debtDialog(x0, rer) {
  const { h, S } = X;
  const x = x0 || { date: todayIso(), currency: 'ILS', direction: 'in' };
  const d = X.dialog(`<h2>⚖️ ${x0 ? 'עריכה' : 'הלוואה / חוב'}</h2>
    <form class="ms-form" autocomplete="off"><div class="grid">
      <label>כיוון<select name="direction"><option value="in"${x.direction !== 'out' ? ' selected' : ''}>הישיבה הלוותה / מגיע לישיבה</option><option value="out"${x.direction === 'out' ? ' selected' : ''}>הישיבה חייבת</option></select></label>
      <label>מי<input name="person" list="fn-dl" value="${h(pickTxt(x.person_id, x.person))}"></label>
      <label>תאריך<input name="date" type="date" value="${h(x.date)}"></label>
      <label>סכום *<span class="amount-wrap"><select name="currency">${CURS.map(([k, l]) => `<option value="${k}"${(x.currency || 'ILS') === k ? ' selected' : ''}>${h(l)}</option>`).join('')}</select><input name="amount" type="number" min="0" step="0.01" dir="ltr" value="${h(x.amount || '')}"></span></label>
      <label class="wide">על מה<input name="reason" value="${h(x.reason || '')}"></label><label class="wide">הערה<input name="note" value="${h(x.note || '')}"></label>
    </div><datalist id="fn-dl">${personList()}</datalist>
    <div class="actions">${x0 ? '<button type="button" class="btn danger" id="db-del">🗑 מחיקה</button>' : ''}<span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div></form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d); const el = form.elements;
  X.$('#db-del', d)?.addEventListener('click', async () => { if (!window.confirm('למחוק?')) return; try { await X.call(X.KEY, 'finDelete', { tab: 'Debts', id: x.debt_id }); await load(); d.close(); rer(); } catch (err) { X.toast(X.msg(err), 'err'); } });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!(Number(el.amount.value) > 0) || !S(el.person.value)) { X.toast('חסר מי / סכום.', 'err'); return; }
    const pid = pickId(el.person.value);
    try { await X.call(X.KEY, 'finSave', { tab: 'Debts', row: { debt_id: x.debt_id || '', direction: el.direction.value, person: pid ? '' : S(el.person.value), person_id: pid, date: el.date.value, amount: el.amount.value, currency: el.currency.value, reason: S(el.reason.value), note: S(el.note.value) } });
      await load(); d.close(); rer(); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}
function repDialog(debt, rer) {
  const { h, S } = X;
  if (!debt) return;
  const reps = F.d.repayments.filter((r) => r.debt_key === debt.key);
  const d = X.dialog(`<h2>↩ החזר — ${h(debt.who)}</h2><p>${h(debt.reason)} · ${cur(debt.amount, debt.currency)} · נשאר <b>${cur(debt.left, debt.currency)}</b></p>
    ${reps.length ? `<table class="ms-table"><tbody>${reps.map((r) => `<tr><td>${h(r.date)}</td><td class="num">${cur(r.amount, r.currency)}</td><td class="small">${h(r.note)}</td><td><button type="button" class="linkish" data-dr="${h(r.rep_id)}">🗑</button></td></tr>`).join('')}</tbody></table>` : ''}
    <form class="ms-bar" autocomplete="off"><input name="date" type="date" value="${h(todayIso())}"><input name="amount" type="number" min="0" step="0.01" dir="ltr" value="${h(debt.left > 0 ? debt.left : '')}" style="width:110px"> ${debt.currency === 'USD' ? '$' : '₪'}<input name="note" placeholder="הערה"><button type="submit" class="btn primary">הוסף החזר</button></form>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  X.$$('[data-dr]', d).forEach((b) => { b.onclick = async () => { if (!window.confirm('למחוק את ההחזר?')) return; try { await X.call(X.KEY, 'finDelete', { tab: 'Repayments', id: b.dataset.dr }); await load(); d.close(); rer(); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$('form', d).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target.elements;
    if (!(Number(f.amount.value) > 0)) { X.toast('חסר סכום.', 'err'); return; }
    try { await X.call(X.KEY, 'finSave', { tab: 'Repayments', row: { debt_key: debt.key, date: f.date.value, amount: f.amount.value, currency: debt.currency, note: S(f.note.value) } }); await load(); d.close(); rer(); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

// ---------- 📊 מאזן חודשי (יעדער מטבע באזונדער) ----------
function monthTotals(mo) {
  const a = autoIncomes(mo);
  const inc = { ILS: a.gIls, USD: a.tu + a.gUsd };
  const exp = { ILS: 0, USD: 0 };
  const byCatIn = {}; const byCatEx = {};
  const addCat = (o, cat, c, n) => { o[cat] = o[cat] || { ILS: 0, USD: 0 }; o[cat][c] += n; };
  if (a.tu) addCat(byCatIn, 'שכר לימוד', 'USD', a.tu);
  if (a.gIls) addCat(byCatIn, 'נדבות', 'ILS', a.gIls);
  if (a.gUsd) addCat(byCatIn, 'נדבות', 'USD', a.gUsd);
  F.d.incomes.filter((x) => x.date.slice(0, 7) === mo).forEach((x) => { const c = x.currency || 'ILS'; const n = Number(x.amount || 0); inc[c] += n; addCat(byCatIn, x.category || 'אחר', c, n); });
  F.d.expenses.filter((x) => x.date.slice(0, 7) === mo).forEach((x) => { const c = x.currency || 'ILS'; const n = Number(x.amount || 0); exp[c] += n; addCat(byCatEx, x.category || 'אחר', c, n); });
  const sal = F.d.payments.filter((p) => p.date.slice(0, 7) === mo).reduce((s, p) => s + Number(p.amount || 0), 0);
  if (sal) { exp.ILS += sal; addCat(byCatEx, 'משכורות', 'ILS', sal); }
  return { inc, exp, byCatIn, byCatEx };
}
function balTab(body, rer) {
  const { h } = X;
  const m = monthTotals(F.month);
  const cats = (o) => Object.entries(o).sort((a, b) => (b[1].ILS + b[1].USD) - (a[1].ILS + a[1].USD)).map(([k, v]) => `<tr><td>${h(k)}</td><td class="num">${v.ILS ? cur(v.ILS) : ''}</td><td class="num">${v.USD ? cur(v.USD, 'USD') : ''}</td></tr>`).join('');
  // 12 חדשים אחורה
  const months = []; { let [y, mm] = F.month.split('-').map(Number); for (let i = 0; i < 12; i += 1) { months.push(`${y}-${pad(mm)}`); mm -= 1; if (mm < 1) { mm = 12; y -= 1; } } }
  const net = (c) => m.inc[c] - m.exp[c];
  body.innerHTML = `${monthBar('<button type="button" class="btn" id="bl-print">🖨 הדפסה</button><button type="button" class="btn" id="bl-xl">⬇ Excel</button>')}
    <div class="ms-stats">${['ILS', 'USD'].map((c) => `<div class="ms-stat"><span class="muted small">${c === 'ILS' ? 'שקלים' : 'דולרים'}</span><span class="small">הכנסות ${cur(m.inc[c], c)} · הוצאות ${cur(m.exp[c], c)}</span><b class="${net(c) < 0 ? 'ms-owe' : ''}">${cur(net(c), c)}</b></div>`).join('')}</div>
    <div class="me-grid"><section><h3>📥 הכנסות לפי קטגוריה</h3><table class="ms-table"><thead><tr><th></th><th>₪</th><th>$</th></tr></thead><tbody>${cats(m.byCatIn) || '<tr><td colspan="3" class="muted">אין</td></tr>'}</tbody></table></section>
      <section><h3>🧾 הוצאות לפי קטגוריה</h3><table class="ms-table"><thead><tr><th></th><th>₪</th><th>$</th></tr></thead><tbody>${cats(m.byCatEx) || '<tr><td colspan="3" class="muted">אין</td></tr>'}</tbody></table></section></div>
    <h3>12 חודשים</h3><div class="ms-wrap"><table class="ms-table"><thead><tr><th>חודש</th><th>הכנסות ₪</th><th>הוצאות ₪</th><th>נשאר ₪</th><th>הכנסות $</th><th>הוצאות $</th><th>נשאר $</th></tr></thead><tbody>
      ${months.map((mo) => { const t = monthTotals(mo); return `<tr><td>${h(monthName(mo))}</td><td class="num">${cur(t.inc.ILS)}</td><td class="num">${cur(t.exp.ILS)}</td><td class="num ${t.inc.ILS - t.exp.ILS < 0 ? 'ms-owe' : ''}">${cur(t.inc.ILS - t.exp.ILS)}</td>
        <td class="num">${cur(t.inc.USD, 'USD')}</td><td class="num">${cur(t.exp.USD, 'USD')}</td><td class="num ${t.inc.USD - t.exp.USD < 0 ? 'ms-owe' : ''}">${cur(t.inc.USD - t.exp.USD, 'USD')}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="muted small">שכר לימוד נספר בדולרים. משכורות = מה ששולם בחודש. הלוואה שהתקבלה נכנסת להכנסות (וגם לחובות).</p>`;
  wireMonth(body, rer);
  const rows = [...Object.entries(m.byCatIn).map(([k, v]) => ['הכנסה', k, v.ILS, v.USD]), ...Object.entries(m.byCatEx).map(([k, v]) => ['הוצאה', k, v.ILS, v.USD]), ['', 'נשאר', net('ILS'), net('USD')]];
  X.$('#bl-xl', body).onclick = () => downloadXlsx(`מאזן ${F.month}`, ['', 'קטגוריה', '₪', '$'], rows, { rtl: true });
  X.$('#bl-print', body).onclick = () => X.printWin(`מאזן — ${monthName(F.month)}`, '', `<table><thead><tr><th></th><th>קטגוריה</th><th>₪</th><th>$</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${h(r[0])}</td><td>${h(r[1])}</td><td class="c">${r[2] ? cur(r[2]) : ''}</td><td class="c">${r[3] ? cur(r[3], 'USD') : ''}</td></tr>`).join('')}</tbody></table>`);
}
