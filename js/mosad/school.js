// אתר פון א מוסד — די ישיבה: תלמידים, בוגרים, הורים, שכר לימוד און קבלות (אלעס אינעם גיליון פונעם מוסד, דורכן שומר).
import { toHebrew, fromHebrew, yearLabel, monthsOf, monthHe, todayIso, isoToHebrewText } from '../hebdate.js?v=352';
import { downloadXlsx } from '../excel.js?v=352';

let X = null; // די כלים פון app.js: { st, call, KEY, $, $$, h, S, dialog, toast, msg, pById, nameOf, phoneOf, fatherOf, can, loadPeople, render }
export function initSchool(ctx) { X = ctx; }

export const ST = { active: 'לומד', left: 'יצא' };
const sc = { data: null, tab: 'active', q: '', shiur: '', asOf: '', pq: '', tq: '' };
const MONEY = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = (n) => `$${MONEY.format(Number(n || 0))}`;
const METHODS = ['מזומן', "צ'ק", 'אשראי', 'העברה בנקאית', 'Zelle', 'אחר'];

export async function loadSchool() {
  sc.data = await X.call(X.KEY, 'school');
  return sc.data;
}
export const schoolLoaded = () => Boolean(sc.data);
/** די תלמידים וואס לערנען אויף א טאג (פאר יומנים, חברותות, ביטוח) — לויטן משפחה-נאמען */
export function activeStudents(day = todayIso()) {
  return enrolls().filter((e) => statusOn(e, day) === 'active').sort(byName);
}
/** בוגרים וואס זענען נאך שולדיג שכר לימוד: [{ enroll_id, contact_id, name, balance, end }] */
export function alumniDebts() {
  if (!sc.data?.tuitionAccess) return [];
  return enrolls().filter((e) => statusOn(e) === 'left' && balance(e) > 0.009)
    .map((e) => ({ enroll_id: e.enroll_id, contact_id: e.contact_id, name: nm(e.contact_id), balance: Math.round(balance(e) * 100) / 100, end: d10(e.end_date) }));
}
/** דער זמן פון היינט ("זמן חורף פ"ז") */
export function currentZman() {
  const t = todayIso();
  return (zmanim().filter((z) => z.start && z.start <= t).sort((a, b) => b.start.localeCompare(a.start))[0] || {}).label || '';
}

// ---------- רעכענען ----------
const today = () => todayIso();
const d10 = (v) => {
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v || ''))) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000).toISOString().slice(0, 10);
  return String(v || '').slice(0, 10);
};
const enrolls = () => {
  const list = (sc.data?.enrollments || []).filter((e) => X.S(e.contact_id));
  // אן עלטערן? — דער טאטע פון די קשרים
  list.forEach((e) => { if (!X.S(e.parent_id)) { const f = X.pById(e.contact_id) && X.fatherOf(X.pById(e.contact_id)); if (f) e.parent_id = String(f.contact_id); } });
  return list;
};
const paymentsOf = (e) => (sc.data?.tuition || []).filter((p) => String(p.enroll_id) === String(e.enroll_id));
export function statusOn(e, day = today()) {
  if (e.status === ST.left || (d10(e.end_date) && d10(e.end_date) < day)) return 'left';
  return 'active';
}
const mk = (x) => `${x.y}-${x.m}`;
function nextMonth(x) {
  const ms = monthsOf(x.y).map((z) => z.key); const i = ms.indexOf(x.m);
  return i < ms.length - 1 ? { y: x.y, m: ms[i + 1] } : { y: x.y + 1, m: monthsOf(x.y + 1)[0].key };
}
function prevMonth(x) {
  const ms = monthsOf(x.y).map((z) => z.key); const i = ms.indexOf(x.m);
  if (i > 0) return { y: x.y, m: ms[i - 1] };
  const pm = monthsOf(x.y - 1); return { y: x.y - 1, m: pm[pm.length - 1].key };
}
const hm = (iso) => { const x = toHebrew(iso); return x ? { y: x.y, m: x.m } : null; };
const ord = (x) => x.y * 100 + monthsOf(x.y).findIndex((z) => z.key === x.m);
const currentMonth = () => hm(today());
function monthOverrides(e) {
  const m = new Map();
  String(e.month_amounts || '').split(';').map((x) => x.trim()).filter(Boolean).forEach((x) => {
    const i = x.lastIndexOf(':'); if (i > 0) m.set(x.slice(0, i).trim(), Number(x.slice(i + 1)) || 0);
  });
  return m;
}
function inMonth(e, x) {
  const s0 = d10(e.start_date) ? hm(d10(e.start_date)) : null;
  if (!s0 || ord(x) < ord(s0)) return false;
  const e0 = d10(e.end_date) ? hm(d10(e.end_date)) : null;
  return !e0 || ord(x) <= ord(e0);
}
function monthAmount(e, x) {
  if (!inMonth(e, x)) return null;
  const o = monthOverrides(e);
  return o.has(mk(x)) ? o.get(mk(x)) : 0;
}
const keyTo = (k) => { const i = k.indexOf('-'); return { y: Number(k.slice(0, i)), m: k.slice(i + 1) }; };
const joinOverrides = (o) => [...o].sort((p, q) => ord(keyTo(p[0])) - ord(keyTo(q[0]))).map(([k, n]) => `${k}:${n}`).join('; ');
function priceRanges(e) {
  const items = [...monthOverrides(e)].map(([k, n]) => ({ x: keyTo(k), n })).sort((p, q) => ord(p.x) - ord(q.x));
  const out = [];
  items.forEach((it) => {
    const last = out[out.length - 1];
    if (last && last.n === it.n && mk(nextMonth(last.to)) === mk(it.x)) last.to = it.x; else out.push({ from: it.x, to: it.x, n: it.n });
  });
  const lab = (x) => `${monthHe(x.m)} ${yearLabel(x.y)}`;
  return out.map((r) => `${mk(r.from) === mk(r.to) ? lab(r.from) : `${lab(r.from)} – ${lab(r.to)}`}: ${money(r.n)}`);
}
function charged(e) {
  const s0 = d10(e.start_date) ? hm(d10(e.start_date)) : null;
  if (!s0) return 0;
  const now = currentMonth();
  let total = 0;
  for (let x = s0, g = 0; ord(x) <= ord(now) && g < 400; x = nextMonth(x), g += 1) total += monthAmount(e, x) || 0;
  return total;
}
const paid = (e) => paymentsOf(e).reduce((s, p) => s + Number(p.amount || 0), 0);
const balance = (e) => charged(e) - paid(e);
const dateText = (iso) => { const x = d10(iso) ? toHebrew(d10(iso)) : null; return x ? `${monthHe(x.m)} ${yearLabel(x.y)}` : ''; };
const monthLabel = (x) => `${monthHe(x.m)} ${yearLabel(x.y).replace(/^תש/, '')}`;
function sixMonths() {
  const now = currentMonth();
  let x = now; for (let i = 0; i < 4; i += 1) x = prevMonth(x);
  const out = []; for (let i = 0; i < 6; i += 1) { out.push(x); x = nextMonth(x); }
  return { now, list: out };
}
export function zmanim() {
  const y = toHebrew(today()).y;
  const out = [];
  for (let yy = y + 1; yy >= y - 5; yy -= 1) {
    const yl = yearLabel(yy).replace(/^תש/, '');
    out.push({ label: `זמן קיץ ${yl}`, start: fromHebrew(1, 'Iyar', yy) });
    out.push({ label: `זמן חורף ${yl}`, start: fromHebrew(1, 'Heshvan', yy) });
  }
  return out;
}

const nm = (id) => { const p = id ? X.pById(id) : null; return p ? X.nameOf(p) : id ? `#${id}` : ''; };
const ph = (id) => { const p = id ? X.pById(id) : null; return p ? X.phoneOf(p) : ''; };
const mail = (id) => X.S(X.pById(id)?.email_1);
const lastOf = (id) => X.S(X.pById(id)?.last_name_he || X.pById(id)?.last_name_en);
const byName = (a, b) => lastOf(a.contact_id).localeCompare(lastOf(b.contact_id), 'he') || nm(a.contact_id).localeCompare(nm(b.contact_id), 'he');
const tu = () => Boolean(sc.data?.tuitionAccess);
const norm = (v) => X.S(v).toLowerCase().replace(/["'״׳]/g, '');
const match = (q, parts) => { const w = norm(q).split(/\s+/).filter(Boolean); const t = norm(parts.join(' ')); return w.every((x) => t.includes(x)); };

async function reload() { await Promise.all([loadSchool(), X.loadPeople()]); X.render(); }
function searchInput(box, key, rerender) {
  const q = X.$(`#sc-q-${key}`, box);
  if (q) q.oninput = () => { sc[key] = q.value; const pos = q.selectionStart; rerender(); const n = X.$(`#sc-q-${key}`); n.focus(); n.setSelectionRange(pos, pos); };
}
async function guard(box, fn) {
  if (!sc.data) {
    box.innerHTML = '<p class="muted">טוען…</p>';
    try { await loadSchool(); } catch (err) { box.innerHTML = `<p class="ms-note err">${X.h(X.msg(err))}</p>`; return; }
  }
  fn();
}

// ---------- 🎓 תלמידים / 🚪 בוגרים ----------
export function renderStudents(box, which = 'active') {
  guard(box, () => {
    const { h } = X;
    const day = which === 'active' ? sc.asOf || today() : today();
    const all = enrolls();
    const list0 = all.filter((e) => statusOn(e, day) === which);
    const shiurim = [...new Set(all.map((e) => e.shiur).filter(Boolean))].sort();
    const key = which === 'active' ? 'q' : 'aq';
    const rows = list0.filter((e) => (!sc.shiur || e.shiur === sc.shiur)
      && match(sc[key] || '', [nm(e.contact_id), nm(e.parent_id), ph(e.contact_id), ph(e.parent_id), e.shiur, e.room, X.pById(e.contact_id)?.il_phone])).sort(byName);
    const act = which === 'active';
    box.innerHTML = `<h2 class="ms-h">${act ? '🎓 תלמידי הישיבה' : '🚪 בוגרי הישיבה והוריהם'} <span class="count-pill">${list0.length}</span></h2>
      <div class="ms-bar">
        <input type="search" id="sc-q-${key}" placeholder="חיפוש: שם, הורה, טלפון, שיעור…" value="${h(sc[key] || '')}">
        ${shiurim.length ? `<select id="sc-shiur"><option value="">כל השיעורים</option>${shiurim.map((s) => `<option${s === sc.shiur ? ' selected' : ''}>${h(s)}</option>`).join('')}</select>` : ''}
        ${act ? `<label class="small">נכון לתאריך <input type="date" id="sc-asof" value="${h(sc.asOf)}"></label>` : ''}
        <span class="spacer"></span>
        ${X.can('people_edit') ? '<button type="button" class="btn primary" id="sc-new">＋ רישום תלמיד</button>' : ''}
        <button type="button" class="btn" id="sc-xl">⬇ Excel</button>
        ${act ? '<button type="button" class="btn" id="sc-phones">🖨 יומן טלפונים</button>' : ''}
        <button type="button" class="btn" id="sc-reload" title="רענון">⟳</button>
      </div>
      ${sc.asOf && act ? `<p class="muted small">מי שלמד ב-${h(isoToHebrewText(day))}</p>` : ''}
      ${rows.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>תלמיד</th>${act ? '<th>טלפון בארץ</th>' : ''}<th>הורה</th><th>טלפון ההורה</th><th>שיעור</th><th>מ-</th><th>עד</th>${tu() ? '<th>יתרה</th>' : ''}<th></th></tr></thead><tbody>
        ${rows.map((e) => { const b = tu() ? balance(e) : 0; const p = X.pById(e.contact_id); return `<tr data-row="${h(e.enroll_id)}">
          <td><a href="#" data-open="${h(e.contact_id)}"><b>${h(nm(e.contact_id))}</b></a>${e.room ? `<div class="muted small">חדר ${h(e.room)}</div>` : ''}</td>
          ${act ? `<td dir="ltr" class="small">${h(p?.il_phone || '')}${p && (X.can('students') || X.can('people_edit')) ? ` <button type="button" class="linkish" data-il="${h(e.contact_id)}" title="טלפון בארץ">✎</button>` : ''}</td>` : ''}
          <td>${e.parent_id ? `<a href="#" data-open="${h(e.parent_id)}">${h(nm(e.parent_id))}</a>` : '<span class="muted">—</span>'}</td>
          <td dir="ltr" class="small">${h(ph(e.parent_id))}</td>
          <td class="small">${h(e.shiur || '')}</td><td class="small">${h(dateText(e.start_date))}</td><td class="small">${h(dateText(e.end_date))}</td>
          ${tu() ? `<td class="num ${b > 0 ? 'ms-owe' : ''}" dir="ltr">${charged(e) || paid(e) ? money(b) : ''}</td>` : ''}
          <td class="ms-acts">${X.can('people_edit') || tu() ? `<button type="button" class="btn small-btn" data-edit="${h(e.enroll_id)}" title="עריכה">✎</button>` : ''}
            ${tu() ? `<button type="button" class="btn small-btn" data-pay="${h(e.enroll_id)}" title="תשלום">💲</button>` : ''}
            ${X.can('people_edit') ? `<button type="button" class="btn small-btn" data-out="${h(e.enroll_id)}" title="${act ? 'עזב / מחיקה' : 'מחיקה'}">🗑</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<p class="muted ms-empty">${list0.length ? 'אין תוצאות.' : 'אין.'}</p>`}`;
    searchInput(box, key, () => renderStudents(box, which));
    const s = X.$('#sc-shiur', box); if (s) s.onchange = () => { sc.shiur = s.value; renderStudents(box, which); };
    const a = X.$('#sc-asof', box); if (a) a.onchange = () => { sc.asOf = a.value; renderStudents(box, which); };
    X.$('#sc-new', box)?.addEventListener('click', () => enrollDialog({}));
    X.$$('[data-out]', box).forEach((b) => { b.onclick = () => outDialog(all.find((x) => String(x.enroll_id) === b.dataset.out), act); });
    X.$('#sc-phones', box)?.addEventListener('click', () => X.printPhones?.());
    X.$('#sc-reload', box).onclick = () => reload().then(() => X.toast('עודכן')).catch((err) => X.toast(X.msg(err), 'err'));
    X.$('#sc-xl', box).onclick = () => {
      const head = ['תלמיד', 'טלפון בארץ', 'טלפון', 'הורה', 'טלפון ההורה', 'מייל ההורה', 'שיעור', 'חדר', 'סטטוס', 'מ-', 'עד', 'זמן', ...(tu() ? ['שכר לימוד', 'חיוב', 'שולם', 'יתרה'] : []), 'הערה'];
      downloadXlsx(`${X.st.mosad?.name || 'ישיבה'} - ${act ? 'תלמידים' : 'בוגרים'}`, head, rows.map((e) => [nm(e.contact_id), act ? X.pById(e.contact_id)?.il_phone || '' : '', ph(e.contact_id), nm(e.parent_id), ph(e.parent_id), mail(e.parent_id),
        e.shiur || '', e.room || '', ST[statusOn(e, day)], dateText(e.start_date), dateText(e.end_date), e.zman || '', ...(tu() ? [priceRanges(e).join('; '), charged(e), paid(e), balance(e)] : []), e.note || '']), { rtl: true });
    };
    X.$$('[data-il]', box).forEach((b) => {
      b.onclick = async () => {
        const p = X.pById(b.dataset.il);
        const v = window.prompt(`טלפון בארץ ישראל של ${X.nameOf(p)}:`, p.il_phone || '');
        if (v === null) return;
        try { await X.call(X.KEY, 'ilPhone', { contact_id: p.contact_id, il_phone: v.trim() }); p.il_phone = v.trim(); renderStudents(box, which); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
      };
    });
    wireRows(box);
  });
}

// ---------- 👪 הורים ----------
function parentsOf(all) {
  const m = new Map();
  all.forEach((e) => { const k = X.S(e.parent_id); if (k) m.set(k, [...(m.get(k) || []), e]); });
  return [...m].map(([id, kids]) => ({ id, kids })).sort((a, b) => lastOf(a.id).localeCompare(lastOf(b.id), 'he'));
}
export function renderParents(box) {
  guard(box, () => {
    const { h } = X;
    const all0 = parentsOf(enrolls());
    // לומדים = יש לו ילד שלומד עכשיו; בוגרים = כל הילדים שלו יצאו
    const isAct = (p) => p.kids.some((e) => statusOn(e) === 'active');
    const pf = sc.pf || 'all';
    const list = all0.filter((p) => pf === 'all' || (pf === 'active' ? isAct(p) : !isAct(p)));
    const rows = list.filter((p) => match(sc.pq, [nm(p.id), ph(p.id), mail(p.id), ...p.kids.map((e) => nm(e.contact_id))]));
    const nAct = all0.filter(isAct).length;
    box.innerHTML = `<h2 class="ms-h">👪 הורי התלמידים <span class="count-pill">${list.length}</span></h2>
      <div class="ms-bar"><div class="seg">${[['all', `הכל (${all0.length})`], ['active', `תלמידי הישיבה (${nAct})`], ['left', `בוגרים (${all0.length - nAct})`]]
        .map(([k, l]) => `<button type="button" data-pf="${k}" class="${pf === k ? 'on' : ''}">${h(l)}</button>`).join('')}</div>
        <input type="search" id="sc-q-pq" placeholder="חיפוש: הורה, תלמיד, טלפון…" value="${h(sc.pq)}"><span class="spacer"></span>
        <button type="button" class="btn" id="sc-xl">⬇ Excel</button></div>
      ${rows.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>הורה</th><th>ילדים</th><th>נייד</th><th>מייל</th>${tu() ? '<th>יתרה</th>' : ''}</tr></thead><tbody>
        ${rows.map((p) => { const b = tu() ? p.kids.reduce((s, e) => s + balance(e), 0) : 0; return `<tr><td><a href="#" data-open="${h(p.id)}"><b>${h(nm(p.id))}</b></a></td>
          <td>${p.kids.map((e) => `<a href="#" data-open="${h(e.contact_id)}">${h(X.pById(e.contact_id)?.first_name_he || nm(e.contact_id))}</a> <span class="ms-kind${statusOn(e) === 'left' ? '' : ' k-student'}">${h(ST[statusOn(e)])}</span>`).join(' ')}</td>
          <td dir="ltr" class="small">${h(ph(p.id))}</td><td dir="ltr" class="small">${h(mail(p.id))}</td>
          ${tu() ? `<td class="num ${b > 0 ? 'ms-owe' : ''}" dir="ltr">${b ? money(b) : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`
      : '<p class="muted ms-empty">אין.</p>'}`;
    searchInput(box, 'pq', () => renderParents(box));
    X.$$('[data-pf]', box).forEach((b) => { b.onclick = () => { sc.pf = b.dataset.pf; renderParents(box); }; });
    X.$('#sc-xl', box).onclick = () => downloadXlsx(`${X.st.mosad?.name || 'ישיבה'} - הורים`, ['הורה', 'ילדים', 'נייד', 'טלפון בית', 'מייל', 'כתובת', 'עיר', ...(tu() ? ['יתרה'] : [])],
      rows.map((p) => { const c = X.pById(p.id) || {}; return [nm(p.id), p.kids.map((e) => `${nm(e.contact_id)} (${ST[statusOn(e)]})`).join(', '), c.mobile || '', c.home_phone || '', c.email_1 || '', c.address || '', [c.city, c.state, c.zip].filter(Boolean).join(' '), ...(tu() ? [p.kids.reduce((s, e) => s + balance(e), 0)] : [])]; }), { rtl: true });
    wireRows(box);
  });
}

// ---------- 💲 שכר לימוד ----------
export function renderTuition(box) {
  guard(box, () => {
    const { h } = X;
    if (!tu()) { box.innerHTML = '<p class="ms-note err">אין לך הרשאה לשכר לימוד.</p>'; return; }
    const all = enrolls();
    const active = all.filter((e) => statusOn(e) === 'active').sort(byName);
    const leftOwing = all.filter((e) => statusOn(e) === 'left' && balance(e) > 0).sort((a, b) => balance(b) - balance(a));
    const owe = (list) => { const o = list.filter((e) => balance(e) > 0); return { n: o.length, sum: o.reduce((s, e) => s + balance(e), 0) }; };
    const oa = owe(active); const ol = owe(leftOwing);
    const { now, list: months } = sixMonths();
    const expected = all.reduce((s, e) => s + (monthAmount(e, now) || 0), 0);
    const cameIn = (sc.data.tuition || []).filter((p) => { const x = d10(p.date) ? hm(d10(p.date)) : null; return x && mk(x) === mk(now); }).reduce((s, p) => s + Number(p.amount || 0), 0);
    const pays = (sc.data.tuition || []).filter((p) => match(sc.tq, [nm(p.contact_id), nm(p.payer_id), p.receipt_no, p.check_number, p.amount]))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.payment_id) - Number(a.payment_id));
    const cell = (e, x) => {
      const v = monthAmount(e, x); const isNow = mk(x) === mk(now);
      if (v === null) return `<td class="num${isNow ? ' ms-now' : ''}"><span class="muted">—</span></td>`;
      const has = monthOverrides(e).has(mk(x));
      return `<td class="num${isNow ? ' ms-now' : ''}"><input type="number" min="0" step="1" dir="ltr" class="ms-mcell${has ? '' : ' empty'}" data-me="${h(e.enroll_id)}" data-mk="${h(mk(x))}" value="${has ? h(v) : ''}" placeholder="—" title="הסכום לחודש הזה (ריק = לא חויב)"></td>`;
    };
    const table = (list) => `<div class="ms-wrap"><table class="ms-table ms-months"><thead><tr><th>תלמיד</th><th>הורה</th>
        ${months.map((x) => `<th class="num${mk(x) === mk(now) ? ' ms-now' : ''}">${h(monthLabel(x))}</th>`).join('')}<th>שולם</th><th>יתרה</th><th></th></tr></thead>
        <tbody>${list.map((e) => { const b = balance(e); return `<tr><td><a href="#" data-open="${h(e.contact_id)}">${h(nm(e.contact_id))}</a></td><td class="small">${h(nm(e.parent_id))}</td>
          ${months.map((x) => cell(e, x)).join('')}<td class="num" dir="ltr">${money(paid(e))}</td><td class="num ${b > 0 ? 'ms-owe' : ''}" dir="ltr">${money(b)}</td>
          <td class="ms-acts"><button type="button" class="btn small-btn" data-edit="${h(e.enroll_id)}" title="עריכה">✎</button><button type="button" class="btn small-btn" data-pay="${h(e.enroll_id)}">💲 תשלום</button></td></tr>`; }).join('')}</tbody></table></div>`;
    box.innerHTML = `<h2 class="ms-h">💲 שכר לימוד</h2>
      <div class="ms-stats">
        <div class="ms-stat owe"><span class="muted small">חוב תלמידים לומדים</span><b dir="ltr">${money(oa.sum)}</b><span class="small">${oa.n} תלמידים</span></div>
        <div class="ms-stat owe"><span class="muted small">חוב תלמידים שיצאו</span><b dir="ltr">${money(ol.sum)}</b><span class="small">${ol.n} תלמידים</span></div>
        <div class="ms-stat"><span class="muted small">צפוי ל${h(monthHe(now.m))} ${h(yearLabel(now.y))}</span><b dir="ltr">${money(expected)}</b><span class="small">נכנס החודש: <b dir="ltr">${money(cameIn)}</b></span></div>
      </div>
      <p class="muted small">בטבלה: הסכום לכל חודש. אפשר לשנות ישר בתא. לסכום לכמה חודשים ביחד — ✎ ליד התלמיד.</p>
      <h3>תלמידים לומדים <span class="count-pill">${active.length}</span></h3>
      ${active.length ? table(active) : '<p class="muted">אין.</p>'}
      <h3>שיצאו ועדיין חייבים <span class="count-pill">${leftOwing.length}</span></h3>
      ${leftOwing.length ? table(leftOwing) : '<p class="muted">אין.</p>'}
      <h3>תשלומים <span class="count-pill">${(sc.data.tuition || []).length}</span></h3>
      <div class="ms-bar"><input type="search" id="sc-q-tq" placeholder="חיפוש: שם, מס' קבלה, צ'ק…" value="${h(sc.tq)}"><span class="spacer"></span><button type="button" class="btn" id="sc-xl">⬇ Excel</button></div>
      ${pays.length ? paymentsTable(pays.slice(0, 300)) : '<p class="muted">אין עדיין תשלומים.</p>'}`;
    searchInput(box, 'tq', () => renderTuition(box));
    X.$$('.ms-mcell', box).forEach((inp) => {
      inp.onchange = () => saveMonthCell(inp, box);
      inp.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } };
    });
    X.$('#sc-xl', box).onclick = () => downloadXlsx(`${X.st.mosad?.name || 'ישיבה'} - תשלומים`, ['תאריך', 'תלמיד', 'משלם', 'סכום', 'אמצעי', "מס' צ'ק", 'כרטיס', 'עבור', 'קבלה', 'הערה'],
      pays.map((p) => [d10(p.date), nm(p.contact_id), nm(p.payer_id), Number(p.amount || 0), p.method, p.check_number, p.card_last4 ? `****${p.card_last4}` : '', p.for_text, p.receipt_no, p.note]), { rtl: true });
    wireRows(box);
  });
}
function paymentsTable(pays) {
  const { h } = X;
  return `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>תאריך</th><th>תלמיד</th><th>משלם</th><th>סכום</th><th>אמצעי</th><th>קבלה</th><th></th></tr></thead>
    <tbody>${pays.map((p) => `<tr><td class="small">${h(d10(p.date))}</td><td>${h(nm(p.contact_id))}</td><td class="small">${h(nm(p.payer_id))}</td>
      <td class="num" dir="ltr">${money(p.amount)}</td><td class="small">${h([p.method, p.check_number ? `#${p.check_number}` : '', p.card_last4 ? `****${p.card_last4}` : ''].filter(Boolean).join(' '))}</td>
      <td dir="ltr" class="small">${h(p.receipt_no || '')}</td>
      <td class="ms-acts"><button type="button" class="btn small-btn" data-receipt="${h(p.payment_id)}" title="${p.receipt_no ? 'הדפסת הקבלה שוב' : 'הפקת קבלה'}">🧾</button>
        <button type="button" class="btn small-btn" data-editpay="${h(p.payment_id)}" title="עריכה">✎</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function saveMonthCell(inp, box) {
  const e = enrolls().find((x) => String(x.enroll_id) === inp.dataset.me);
  if (!e) return;
  const v = Math.max(0, Math.round(Number(inp.value) || 0));
  const o = monthOverrides(e);
  if (String(inp.value).trim() === '' || !v) o.delete(inp.dataset.mk); else o.set(inp.dataset.mk, v);
  const month_amounts = joinOverrides(o);
  if (month_amounts === String(e.month_amounts || '')) return;
  inp.disabled = true;
  try {
    await X.call(X.KEY, 'enrollSave', { enroll: { enroll_id: e.enroll_id, month_amounts } });
    e.month_amounts = month_amounts;
    X.toast('נשמר.');
    renderTuition(box);
  } catch (err) { X.toast(X.msg(err), 'err'); inp.disabled = false; }
}

function wireRows(root) {
  X.$$('[data-open]', root).forEach((a) => { a.onclick = (ev) => { ev.preventDefault(); const p = X.pById(a.dataset.open); if (p) X.personDialog(p); }; });
  const en = (id) => enrolls().find((e) => String(e.enroll_id) === String(id));
  X.$$('[data-edit]', root).forEach((b) => { b.onclick = () => enrollDialog(en(b.dataset.edit)); });
  X.$$('[data-pay]', root).forEach((b) => { b.onclick = () => payDialog({}, en(b.dataset.pay)); });
  X.$$('[data-editpay]', root).forEach((b) => {
    b.onclick = () => { const p = (sc.data.tuition || []).find((x) => String(x.payment_id) === b.dataset.editpay); payDialog(p, en(p.enroll_id)); };
  });
  X.$$('[data-receipt]', root).forEach((b) => { b.onclick = () => printReceipt(b.dataset.receipt); });
}

// ---------- בכרטיס של אדם ----------
export function personSchool(p) {
  if (!sc.data) return '';
  const { h } = X;
  const id = String(p.contact_id);
  const mine = enrolls().filter((e) => String(e.contact_id) === id || String(e.parent_id) === id);
  return mine.map((e) => `<div class="kv"><span>${String(e.contact_id) === id ? 'רישום' : `הורה של ${h(nm(e.contact_id))}`}</span><span>
      ${h([ST[statusOn(e)], e.shiur, dateText(e.start_date) ? `מ-${dateText(e.start_date)}` : '', dateText(e.end_date) ? `עד ${dateText(e.end_date)}` : ''].filter(Boolean).join(' · '))}
      ${tu() && (charged(e) || paid(e)) ? ` · יתרה <b dir="ltr" class="${balance(e) > 0 ? 'ms-owe' : ''}">${money(balance(e))}</b>` : ''}</span></div>`).join('');
}

// ---------- טופס: רישום ----------
function monthYearPicker(form, p, iso, isEnd) {
  const el = form.elements;
  const thisY = toHebrew(today()).y;
  const years = []; for (let y = thisY + 2; y >= thisY - 10; y -= 1) years.push(y);
  const fill = (y, want) => {
    const ms = monthsOf(y);
    const key = ms.some((m) => m.key === want) ? want : (want === 'Adar' ? 'Adar II' : want === 'Adar I' || want === 'Adar II' ? 'Adar' : want);
    el[`${p}_m`].innerHTML = `<option value=""></option>${ms.map((m) => `<option value="${m.key}"${m.key === key ? ' selected' : ''}>${X.h(m.he)}</option>`).join('')}`;
  };
  const set = (v) => {
    const x = v ? toHebrew(v) : null;
    if (x && !years.includes(x.y)) years.push(x.y);
    el[`${p}_y`].innerHTML = `<option value=""></option>${years.sort((a, b) => b - a).map((y) => `<option value="${y}"${x && x.y === y ? ' selected' : ''}>${X.h(yearLabel(y))}</option>`).join('')}`;
    fill(x ? x.y : thisY, x ? x.m : '');
    el[`${p}_date`].value = v || '';
  };
  const read = () => {
    const m = el[`${p}_m`].value; let y = Number(el[`${p}_y`].value);
    if (m && !y) { y = thisY; el[`${p}_y`].value = String(y); }
    el[`${p}_date`].value = m && y ? fromHebrew(isEnd ? 29 : 1, m, y) : '';
  };
  el[`${p}_m`].onchange = () => { read(); form.dispatchEvent(new CustomEvent('my', { detail: p })); };
  el[`${p}_y`].onchange = () => { fill(Number(el[`${p}_y`].value) || thisY, el[`${p}_m`].value); read(); form.dispatchEvent(new CustomEvent('my', { detail: p })); };
  set(iso);
  return set;
}
const my = (p, label) => `<label>${X.h(label)}<span class="ms-my"><select name="${p}_m"></select><select name="${p}_y"></select></span><input type="hidden" name="${p}_date"></label>`;

/** 🗑 ביי א תלמיד: 🚪 עזב (→ בוגרים) אדער 🗑 מחיקה (געשריבן בטעות) */
function outDialog(e, act) {
  if (!e) return;
  const { h, S } = X;
  const p = X.pById(e.contact_id);
  const pays = paymentsOf(e).length;
  const d = X.dialog(`<h2>🗑 ${h(nm(e.contact_id))}</h2>
    ${act ? `<fieldset><legend>🚪 עזב את הישיבה</legend><p class="muted small">עובר ל"בוגרי הישיבה". שכר הלימוד וההיסטוריה נשמרים.</p>
      <div class="ms-bar"><label>תאריך עזיבה <input type="date" id="out-date" value="${h(today())}"></label><span class="spacer"></span><button type="button" class="btn primary" id="out-left">🚪 עזב</button></div></fieldset>` : ''}
    <fieldset><legend>🗑 מחיקה (נרשם בטעות)</legend>
      ${pays ? '<p class="ms-note err">יש תשלומים על הרישום הזה — אי אפשר למחוק. אפשר לסמן "עזב".</p>' : `<p class="muted small">הרישום נמחק, והוא יוצא מרשימת התלמידים.</p>
      <label class="check"><input type="checkbox" id="out-req"> לבקש מהמנהל למחוק אותו גם מהמאגר הכללי</label>
      <div class="actions"><span class="spacer"></span><button type="button" class="btn danger" id="out-del">🗑 מחיקה</button></div>`}</fieldset>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  X.$('#out-left', d)?.addEventListener('click', async () => {
    const end = X.$('#out-date', d).value || today();
    try { await X.call(X.KEY, 'enrollSave', { enroll: { enroll_id: e.enroll_id, status: ST.left, end_date: end } }); d.close(); await reload(); X.toast('עבר לבוגרים.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  });
  X.$('#out-del', d)?.addEventListener('click', async () => {
    try {
      X.$('#out-del', d).disabled = true;
      await X.call(X.KEY, 'enrollDelete', { enroll_id: e.enroll_id });
      // נאך א רישום? — בלייבט ער א תלמיד
      const more = enrolls().some((x) => String(x.contact_id) === String(e.contact_id) && String(x.enroll_id) !== String(e.enroll_id));
      if (!more && p && (p.kinds || [p.kind]).includes('student')) await X.call(X.KEY, 'unlink', { contact_id: e.contact_id, kind: 'student', request: Boolean(X.$('#out-req', d)?.checked) });
      d.close(); await reload(); X.toast('נמחק.');
    } catch (err) { X.$('#out-del', d).disabled = false; X.toast(X.msg(err), 'err'); }
  });
}

function enrollDialog(e0 = {}) {
  const { h, S } = X;
  const e = { status: ST.active, ...(e0 || {}) };
  const isNew = !e.enroll_id;
  const pe = X.can('people_edit');
  const opts = (kinds) => X.st.people.filter((p) => !kinds || (p.kinds || [p.kind]).some((k) => kinds.includes(k))).sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he'))
    .map((p) => `<option value="${h(`${X.nameOf(p)} (#${p.contact_id})`)}">`).join('');
  const label = (id) => (id && X.pById(id) ? `${X.nameOf(X.pById(id))} (#${id})` : '');
  const zs = zmanim();
  if (e.zman && !zs.some((z) => z.label === e.zman)) zs.push({ label: e.zman, start: '' });
  const shiurim = [...new Set(enrolls().map((x) => x.shiur).filter(Boolean))];
  const d = X.dialog(`<h2>${isNew ? '＋ רישום תלמיד' : `✏️ ${h(nm(e.contact_id))}`}</h2>
    <form autocomplete="off" class="ms-form">
      ${pe ? `<div class="grid">
        <label>תלמיד *<input name="student" list="sc-dl-s" value="${h(label(e.contact_id))}" placeholder="בחר מהרשימה"></label>
        <label>הורה<input name="parent" list="sc-dl-p" value="${h(label(e.parent_id))}" placeholder="בחר מהרשימה"></label>
      </div>
      <datalist id="sc-dl-s">${opts(['student', 'other'])}</datalist><datalist id="sc-dl-p">${opts(['parent', 'staff', 'other'])}</datalist>
      <p class="muted small">לא ברשימה? קודם הוסף אותו ב"👥 כל האנשים" (➕ הוסף), ואחר כך רשום כאן.</p>
      <fieldset><legend>לימוד</legend><div class="grid">
        <label>זמן<select name="zman"><option value=""></option>${zs.map((z) => `<option value="${h(z.label)}" data-start="${h(z.start)}"${z.label === e.zman ? ' selected' : ''}>${h(z.label)}</option>`).join('')}</select></label>
        <label>סטטוס<select name="status">${Object.values(ST).map((x) => `<option${x === e.status ? ' selected' : ''}>${h(x)}</option>`).join('')}</select></label>
        ${my('start', 'מ-')}${my('end', 'עד')}
        <label>שיעור<input name="shiur" list="sc-dl-sh" value="${h(e.shiur || '')}"></label><datalist id="sc-dl-sh">${shiurim.map((x) => `<option value="${h(x)}">`).join('')}</datalist>
        <label>חדר<input name="room" value="${h(e.room || '')}"></label>
      </div></fieldset>` : `<p><b>${h(nm(e.contact_id))}</b></p>`}
      ${tu() ? `<fieldset><legend>שכר לימוד</legend><div class="grid">
        <label>סכום לחודש<input name="tuition_amount" type="number" min="0" step="1" dir="ltr"></label>
        ${my('tf', 'מחודש')}${my('tt', 'עד חודש')}
      </div>
      ${priceRanges(e).length ? `<p class="small">הסכומים עכשיו: <b>${h(priceRanges(e).join(' · '))}</b></p>` : ''}
      <p class="muted small">סכום + מחודש עד חודש = כל החודשים האלה מקבלים את הסכום (0 = מוחק). חודש אחד — אפשר גם ישר בטבלה של שכר לימוד.</p></fieldset>` : ''}
      ${pe ? `<label class="wide">הערה<textarea name="note" rows="2">${h(e.note || '')}</textarea></label>` : ''}
      <div class="actions">
        ${!isNew && pe ? '<button type="button" class="btn danger" id="sc-del">🗑 מחיקת הרישום</button>' : ''}
        <span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button>
      </div>
    </form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d); const el = form.elements;
  let setStart = null;
  if (pe) {
    setStart = monthYearPicker(form, 'start', d10(e.start_date), false);
    monthYearPicker(form, 'end', d10(e.end_date), true);
    let touched = false;
    form.addEventListener('my', (ev) => {
      if (ev.detail === 'start') touched = true;
      if (ev.detail === 'end' && el.end_date.value && el.end_date.value < today()) el.status.value = ST.left;
    });
    el.zman.onchange = () => { const s = el.zman.selectedOptions[0]?.dataset.start; if (s && (!el.start_date.value || !touched)) setStart(s); };
    if (isNew) { const z = zs.find((x) => x.start && x.start <= today()); if (z) { el.zman.value = z.label; setStart(z.start); } }
  }
  if (tu()) {
    const setF = monthYearPicker(form, 'tf', '', false); const setT = monthYearPicker(form, 'tt', '', true);
    el.tuition_amount.oninput = () => {
      if (!el.tuition_amount.value || el.tf_date.value || el.tt_date.value) return;
      const s = el.start_date?.value && el.start_date.value > today() ? el.start_date.value : today();
      const a = hm(s); const ms = monthsOf(a.y).map((z) => z.key);
      const summer = ms.indexOf(a.m) >= ms.indexOf('Iyar');
      const from = a.m === 'Tishri' ? { y: a.y, m: 'Heshvan' } : a;
      setF(fromHebrew(1, from.m, from.y)); setT(fromHebrew(29, summer ? 'Elul' : 'Nisan', a.y));
    };
  }
  X.$('#sc-del', d)?.addEventListener('click', async () => {
    if (paymentsOf(e).length) { X.toast('יש תשלומים על הרישום הזה — אי אפשר למחוק. אפשר לסמן "יצא".', 'err'); return; }
    if (!window.confirm('למחוק את הרישום? (איש הקשר עצמו לא נמחק)')) return;
    try { await X.call(X.KEY, 'enrollDelete', { enroll_id: e.enroll_id }); d.close(); await reload(); X.toast('נמחק.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const out = { enroll_id: e.enroll_id || '' };
    if (pe) {
      const sid = (S(el.student.value).match(/\(#(\d+)\)$/) || [])[1];
      const pid = (S(el.parent.value).match(/\(#(\d+)\)$/) || [])[1] || '';
      if (!sid) { X.toast('בחר תלמיד מהרשימה.', 'err'); return; }
      if (S(el.parent.value) && !pid) { X.toast('בחר הורה מהרשימה.', 'err'); return; }
      Object.assign(out, { contact_id: sid, parent_id: pid, zman: S(el.zman.value), status: el.status.value, start_date: el.start_date.value, end_date: el.end_date.value, shiur: S(el.shiur.value), room: S(el.room.value), note: S(el.note.value) });
      if (!out.start_date) { X.toast('בחר מאיזה חודש הוא לומד.', 'err'); return; }
      if (out.end_date && out.end_date < out.start_date) { X.toast('"עד" לפני "מ-".', 'err'); return; }
    }
    if (tu()) {
      const raw = S(el.tuition_amount.value);
      if (raw !== '' || el.tf_date.value || el.tt_date.value) {
        if (raw === '' || !el.tf_date.value || !el.tt_date.value) { X.toast('לסכום צריך גם "מחודש" וגם "עד חודש".', 'err'); return; }
        const amt = Math.max(0, Math.round(Number(raw) || 0));
        const a = hm(el.tf_date.value); const b = hm(el.tt_date.value);
        if (ord(b) < ord(a)) { X.toast('"עד חודש" לפני "מחודש".', 'err'); return; }
        const o = monthOverrides(e);
        for (let x = a, g = 0; ord(x) <= ord(b) && g < 60; x = nextMonth(x), g += 1) { if (amt) o.set(mk(x), amt); else o.delete(mk(x)); }
        out.month_amounts = joinOverrides(o);
        out.tuition_amount = amt || '';
      }
    }
    const btn = X.$('button[type=submit]', form); btn.disabled = true;
    try { await X.call(X.KEY, 'enrollSave', { enroll: out }); d.close(); await reload(); X.toast('נשמר.'); } catch (err) { btn.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}

// ---------- טופס: תשלום ----------
function payDialog(p0 = {}, e) {
  if (!e) return;
  const { h, S } = X;
  const p = p0 || {};
  const isNew = !p.payment_id;
  const locked = Boolean(p.receipt_no);
  const payers = [e.parent_id, e.contact_id].filter(Boolean);
  const d = X.dialog(`<h2>💲 ${isNew ? 'תשלום חדש' : 'עריכת תשלום'} — ${h(nm(e.contact_id))}</h2>
    <form autocomplete="off" class="ms-form">
      <div class="grid">
        <label>תאריך<input name="date" type="date" value="${h(d10(p.date) || today())}"></label>
        <label>סכום *<input name="amount" type="number" min="0" step="0.01" dir="ltr" value="${h(p.amount || '')}"${locked ? ' disabled' : ''}></label>
        <label>משלם<select name="payer_id">${payers.map((id) => `<option value="${h(id)}"${String(p.payer_id || payers[0]) === String(id) ? ' selected' : ''}>${h(nm(id))}</option>`).join('')}</select></label>
        <label>אמצעי תשלום<select name="method">${METHODS.map((m) => `<option${m === (p.method || METHODS[1]) ? ' selected' : ''}>${h(m)}</option>`).join('')}</select></label>
        <label>מס' צ'ק<input name="check_number" dir="ltr" value="${h(p.check_number || '')}"></label>
        <label>4 ספרות אחרונות של הכרטיס<input name="card_last4" dir="ltr" maxlength="4" inputmode="numeric" pattern="\\d{4}" value="${h(p.card_last4 || '')}"></label>
        <label class="wide">עבור (יופיע בקבלה)<input name="for_text" value="${h(p.for_text || '')}" placeholder="למשל: שכר לימוד חשון–כסלו"></label>
        <label class="wide">הערה פנימית<input name="note" value="${h(p.note || '')}"></label>
      </div>
      ${locked ? `<p class="muted small">יצאה קבלה ${h(p.receipt_no)} — אי אפשר לשנות את הסכום או למחוק. כדי לשנות: לבטל את הקבלה.</p>` : ''}
      <p class="muted small">לעולם לא רושמים מספר כרטיס מלא — רק 4 ספרות אחרונות.</p>
      <div class="actions">
        ${!isNew && !locked ? '<button type="button" class="btn danger" id="sc-pdel">🗑 מחיקה</button>' : ''}
        ${locked ? '<button type="button" class="btn danger" id="sc-void">✖ ביטול הקבלה</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-x>ביטול</button>
        <button type="submit" class="btn" data-mode="save">💾 שמירה</button>
        ${locked ? '' : '<button type="submit" class="btn primary" data-mode="receipt">💾 שמירה + 🧾 קבלה</button>'}
      </div>
    </form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d); const el = form.elements;
  let mode = 'save';
  X.$$('[data-mode]', form).forEach((b) => { b.onclick = () => { mode = b.dataset.mode; }; });
  X.$('#sc-pdel', d)?.addEventListener('click', async () => {
    if (!window.confirm('למחוק את התשלום?')) return;
    try { await X.call(X.KEY, 'payDelete', { payment_id: p.payment_id }); d.close(); await reload(); X.toast('נמחק.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  });
  X.$('#sc-void', d)?.addEventListener('click', async () => {
    const why = window.prompt(`לבטל את קבלה ${p.receipt_no}?\nהמספר לא יחזור לשימוש; אפשר אחר כך להפיק קבלה חדשה.\n\nסיבה:`, '');
    if (why === null) return;
    try { await X.call(X.KEY, 'receiptVoid', { receipt_no: p.receipt_no, why }); d.close(); await reload(); X.toast('הקבלה בוטלה.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const amount = locked ? Number(p.amount) : Number(el.amount.value);
    if (!(amount > 0)) { X.toast('חסר סכום.', 'err'); return; }
    const last4 = S(el.card_last4.value).replace(/\D/g, '');
    if (last4 && last4.length !== 4) { X.toast('רק 4 ספרות אחרונות.', 'err'); return; }
    // חלון פאר דער קבלה — גלייך ביים קליק (אנדערש בלאקירט עס דער בלעטערער)
    const w = mode === 'receipt' ? window.open('', '_blank') : null;
    X.$$('button', form).forEach((b) => { b.disabled = true; });
    try {
      const r = await X.call(X.KEY, 'paySave', { pay: { payment_id: p.payment_id || '', enroll_id: e.enroll_id, payer_id: el.payer_id.value, date: el.date.value, amount,
        method: el.method.value, check_number: S(el.check_number.value), card_last4: last4, for_text: S(el.for_text.value), note: S(el.note.value) } });
      d.close();
      if (w) await printReceipt(r.payment_id, w);
      await reload();
      X.toast('נשמר.');
    } catch (err) { if (w) w.close(); X.$$('button', form).forEach((b) => { b.disabled = false; }); X.toast(X.msg(err), 'err'); }
  };
}

// ---------- קבלה ----------
const longDate = (iso) => { const s = d10(iso); if (!s) return ''; const [y, m, dd] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
async function printReceipt(paymentId, win = null) {
  const w = win || window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש — אפשר חלונות קופצים לאתר הזה.', 'err'); return; }
  w.document.write('<p style="font-family:sans-serif;padding:20px">טוען את הקבלה…</p>');
  let r;
  try { r = await X.call(X.KEY, 'receipt', { payment_id: paymentId }); } catch (err) { w.close(); X.toast(X.msg(err), 'err'); return; }
  const { h } = X;
  const o = r.org || {};
  const pay = r.payment;
  const who = (r.people || []).find((c) => String(c.contact_id) === String(pay.payer_id)) || (r.people || [])[0] || {};
  const st = (r.people || []).find((c) => String(c.contact_id) === String(pay.contact_id)) || {};
  const heName = (c) => [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ');
  const enName = (c) => [c.title_en, c.first_name_en, c.last_name_en].filter(Boolean).join(' ');
  const legal = o.legal_name || X.st.mosad?.name || '';
  const he = o.org_name_he || X.st.mosad?.name || '';
  const forTxt = pay.for_text || `שכר לימוד — ${heName(st) || enName(st)}`;
  const method = [pay.method, pay.check_number ? `#${pay.check_number}` : '', pay.card_last4 ? `****${pay.card_last4}` : ''].filter(Boolean).join(' ');
  w.document.open();
  w.document.write(`<!doctype html><html lang="he"><head><meta charset="utf-8"><title>${h(r.receipt.receipt_no)}</title>
    <style>
      @page { size: letter; margin: 0.6in; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #222; margin: 0; }
      .bar { font-family: sans-serif; padding: 10px; background: #f3efe6; display: flex; gap: 10px; justify-content: center; }
      .bar button { font-size: 16px; padding: 6px 16px; }
      .doc { max-width: 7.2in; margin: 20px auto; border: 2px solid #7a5a2f; border-radius: 10px; padding: 26px 30px; }
      .top { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #c9b48d; padding-bottom: 14px; }
      .top img { width: 74px; height: 74px; object-fit: contain; }
      .he { font-size: 22px; font-weight: bold; direction: rtl; }
      .en { font-size: 16px; letter-spacing: .5px; }
      .addr { font-size: 12.5px; color: #555; }
      .tag { margin: 18px 0 8px; text-align: center; font: bold 18px sans-serif; letter-spacing: 3px; color: #7a5a2f; }
      table { width: 100%; border-collapse: collapse; font-size: 15px; }
      td { padding: 7px 4px; border-bottom: 1px dotted #ccc; vertical-align: top; }
      td.l { width: 34%; color: #666; font-family: sans-serif; font-size: 13px; }
      .amt { font-size: 22px; font-weight: bold; }
      .note { margin-top: 16px; font-size: 12px; color: #555; }
      .sig { margin-top: 34px; display: flex; justify-content: space-between; font-size: 13px; }
      .sig div { border-top: 1px solid #555; padding-top: 4px; min-width: 2.4in; text-align: center; }
      .copy { color: #a33; font: bold 13px sans-serif; }
      @media print { .bar { display: none; } .doc { margin: 0 auto; } }
    </style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 הדפסה</button><button onclick="window.close()">סגירה</button></div>
    <div class="doc">
      <div class="top">${o.logo ? `<img src="${o.logo}" alt="">` : ''}<div>
        <div class="he">${h(he)}</div><div class="en">${h(legal)}</div>
        <div class="addr">${[o.address, o.city_state_zip, o.phone ? `Tel: ${o.phone}` : '', o.email, o.ein ? `EIN: ${o.ein}` : ''].filter(Boolean).map(h).join(' · ')}</div></div></div>
      <div class="tag">TUITION RECEIPT · קבלה${r.receipt.copy ? ' <span class="copy">(COPY · העתק)</span>' : ''}</div>
      <table>
        <tr><td class="l">Receipt # · מס' קבלה</td><td dir="ltr"><b>${h(r.receipt.receipt_no)}</b></td></tr>
        <tr><td class="l">Date · תאריך</td><td>${h(longDate(pay.date))}${d10(pay.date) ? ` · <span dir="rtl">${h(isoToHebrewText(d10(pay.date)))}</span>` : ''}</td></tr>
        <tr><td class="l">Received from · התקבל מאת</td><td><b>${h(enName(who))}</b>${heName(who) ? ` · <span dir="rtl">${h(heName(who))}</span>` : ''}
          ${who.address ? `<br><small>${h(who.address)}${who.city ? `, ${h(who.city)}` : ''}${who.state ? ` ${h(who.state)}` : ''} ${h(who.zip || '')}</small>` : ''}</td></tr>
        <tr><td class="l">Amount · סכום</td><td class="amt" dir="ltr">${money(pay.amount)}</td></tr>
        <tr><td class="l">Payment · אמצעי תשלום</td><td>${h(method)}</td></tr>
        <tr><td class="l">For · עבור</td><td dir="rtl">${h(forTxt)}</td></tr>
      </table>
      <div class="note">Tuition payment. This is not a tax-deductible charitable contribution.${o.receipt_note ? ` ${h(o.receipt_note)}` : ''}</div>
      <div class="sig"><span></span><div>${h(o.signer_name || '')}${o.signer_title ? `, ${h(o.signer_title)}` : ''}<br><small>${h(legal)}</small></div></div>
    </div></body></html>`);
  w.document.close();
}
