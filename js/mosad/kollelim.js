// 🕍 מרכז הכוללים — כוללים: לכל כולל — 👥 האברכים · ✅ השתתפות (V לכל יום) · 🎖 מלגות · 🧾 צ'קים של תמיכה.
import { downloadXlsx } from '../excel.js?v=660';

let X;
const K = { data: null, kid: '', tab: 'members', month: new Date().toISOString().slice(0, 7) };
export function initKollelim(ctx) { X = ctx; }
const DOW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const daysOf = (mon) => { const [y, m] = mon.split('-').map(Number); const n = new Date(Date.UTC(y, m, 0)).getUTCDate(); return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1, i + 1)); return { day: i + 1, dow: d.getUTCDay() }; }).filter((x) => x.dow !== 6); };
const monLabel = (mon) => { const [y, m] = mon.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const shiftMon = (mon, d) => { const [y, m] = mon.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1 + d, 1)); return x.toISOString().slice(0, 7); };

async function load(kid = '') { K.data = await X.call(X.KEY, 'klGet', { kollel_id: kid, month: '' }); K.loadedFor = kid; }
const kollel = () => (K.data?.kollelim || []).find((k) => String(k.kollel_id) === String(K.kid));
const members = (kid, all = false) => (K.data?.members || []).filter((m) => String(m.kollel_id) === String(kid) && (all || !m.end_date)).filter((m) => X.pById(m.contact_id));
const nm = (id) => { const p = X.pById(id); return p ? X.nameOf(p) : `#${id}`; };
const byName = (a, b) => nm(a.contact_id).localeCompare(nm(b.contact_id), 'he');

export async function renderKollelim(box) {
  const { h } = X;
  if (!K.data || (K.kid && K.loadedFor !== K.kid)) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await load(K.kid); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  if (K.kid && kollel()) { renderOne(box); return; }
  K.kid = '';
  const ks = (K.data.kollelim || []).filter((k) => k.active !== 'FALSE');
  box.innerHTML = `<h2 class="ms-h">🕍 כוללים <span class="count-pill">${ks.length}</span></h2>
    <div class="ms-tiles kl-tiles">${ks.map((k) => `<button type="button" class="ms-tile" data-k="${h(k.kollel_id)}"><span class="ms-ti">🕍</span><b>${h(k.name)}</b><span class="muted small">${h(k.location || '')} · ${members(k.kollel_id).length} אברכים</span></button>`).join('')}
      <button type="button" class="ms-tile" id="kl-new"><span class="ms-ti">➕</span><b>כולל חדש</b></button></div>
    ${(K.data.kollelim || []).some((k) => k.active === 'FALSE') ? `<p class="muted small">לא פעילים: ${(K.data.kollelim || []).filter((k) => k.active === 'FALSE').map((k) => `<button type="button" class="linkish" data-k="${h(k.kollel_id)}">${h(k.name)}</button>`).join(' · ')}</p>` : ''}`;
  X.$$('[data-k]', box).forEach((b) => { b.onclick = async () => { K.kid = b.dataset.k; K.tab = 'members'; await renderKollelim(box); }; });
  X.$('#kl-new', box).onclick = () => editKollel({}, () => { K.data = null; renderKollelim(box); });
}

function editKollel(k, after) {
  const { h } = X;
  const d = X.dialog(`<h2>${k.kollel_id ? '⚙ הגדרות הכולל' : '➕ כולל חדש'}</h2>
    <form class="ms-form" id="kl-f">
      <label>שם הכולל <input name="name" value="${h(k.name || '')}" required></label>
      <label>מקום <input name="location" value="${h(k.location || '')}" placeholder="בארא פארק / מאנסי / ירושלים"></label>
      <label>מלגה ליום (V) $ <input name="stip_day" type="number" min="0" step="0.01" value="${h(k.stip_day || '')}" dir="ltr"></label>
      <label>מלגה קבועה לחודש $ <input name="stip_month" type="number" min="0" step="0.01" value="${h(k.stip_month || '')}" dir="ltr"></label>
      <label>הערה <input name="note" value="${h(k.note || '')}"></label>
      ${k.kollel_id ? `<label class="check"><input type="checkbox" name="active"${k.active === 'FALSE' ? '' : ' checked'}> פעיל</label>` : ''}
    </form>
    <div class="actions"><button type="button" class="btn primary" id="kl-sv">💾 שמירה</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`);
  X.$('#kl-sv', d).onclick = async () => {
    const f = X.$('#kl-f', d).elements;
    try {
      await X.call(X.KEY, 'klSave', { kollel: { kollel_id: k.kollel_id || '', name: f.name.value.trim(), location: f.location.value.trim(), stip_day: f.stip_day.value, stip_month: f.stip_month.value, note: f.note.value.trim(), active: f.active ? f.active.checked : true } });
      d.close(); X.toast('נשמר.'); after();
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

function renderOne(box) {
  const { h } = X;
  const k = kollel();
  const TABS = [['members', '👥 אברכים'], ['att', '✅ השתתפות'], ['stip', '🎖 מלגות'], ['checks', "🧾 צ'קים של תמיכה"]];
  box.innerHTML = `<nav class="ms-crumb"><button type="button" class="linkish" id="kl-back">→ כל הכוללים</button></nav>
    <h2 class="ms-h">🕍 ${h(k.name)} <span class="muted small">${h(k.location || '')}</span> <button type="button" class="linkish" id="kl-set">⚙</button></h2>
    <div class="seg kl-seg">${TABS.map(([t, l]) => `<button type="button" data-t="${t}" class="${K.tab === t ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="kl-body"></div>`;
  X.$('#kl-back', box).onclick = () => { K.kid = ''; renderKollelim(box); };
  X.$('#kl-set', box).onclick = () => editKollel(k, async () => { await load(K.kid); renderOne(box); });
  X.$$('[data-t]', box).forEach((b) => { b.onclick = () => { K.tab = b.dataset.t; renderOne(box); }; });
  const body = X.$('#kl-body', box);
  const re = async () => { await load(K.kid); renderOne(box); };
  ({ members: tabMembers, att: tabAtt, stip: tabStip, checks: tabChecks })[K.tab](body, k, re);
}

// ---------- 👥 אברכים ----------
function tabMembers(body, k, re) {
  const { h } = X;
  const list = members(k.kollel_id).sort(byName);
  const inAny = new Set((K.data.members || []).filter((m) => !m.end_date).map((m) => String(m.contact_id)));
  const avs = X.st.people.filter((p) => (p.kinds || [p.kind]).includes('avreich')).sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he'));
  const label = (p) => `${X.nameOf(p)} (#${p.contact_id})`;
  body.innerHTML = `<div class="ms-bar"><label>הוספת אברך <input id="kl-add" list="kl-dl" placeholder="שם…" style="min-width:16em"></label>
      <datalist id="kl-dl">${avs.map((p) => `<option value="${h(label(p))}">${inAny.has(String(p.contact_id)) ? 'כבר בכולל' : ''}</option>`).join('')}</datalist>
      <button type="button" class="btn primary" id="kl-addb">➕ הוספה</button><span class="spacer"></span><button type="button" class="btn" id="kl-xl">⬇ Excel</button></div>
    <p class="muted small">האברכים מגיעים מטפסי ההרשמה שאושרו (📥 הרשמות לכולל ← אישור). ${avs.length} אברכים במערכת.</p>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>#</th><th>שם</th><th>טלפון</th><th>מ-</th><th></th></tr></thead><tbody>
      ${list.map((m, i) => `<tr><td class="num">${i + 1}</td><td><button type="button" class="linkish" data-p="${h(m.contact_id)}">${h(nm(m.contact_id))}</button></td><td dir="ltr">${h(X.phoneOf(X.pById(m.contact_id)) || '')}</td><td class="small">${h(m.start_date)}</td>
        <td><button type="button" class="linkish" data-rm="${h(m.contact_id)}">הוצאה מהכולל</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="ms-note">עדיין אין אברכים בכולל הזה.</p>'}`;
  X.$('#kl-addb', body).onclick = async () => {
    const mm = X.S(X.$('#kl-add', body).value).match(/\(#(\d+)\)$/); if (!mm) { X.toast('בחר אברך מהרשימה.', 'err'); return; }
    try { await X.call(X.KEY, 'klMember', { kollel_id: k.kollel_id, contact_id: mm[1] }); X.toast('נוסף.'); re(); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$$('[data-rm]', body).forEach((b) => { b.onclick = async () => { if (!window.confirm(`להוציא את ${nm(b.dataset.rm)} מהכולל?`)) return; try { await X.call(X.KEY, 'klMember', { kollel_id: k.kollel_id, contact_id: b.dataset.rm, remove: true }); re(); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$$('[data-p]', body).forEach((b) => { b.onclick = () => X.personDialog(X.pById(b.dataset.p)); });
  X.$('#kl-xl', body).onclick = () => downloadXlsx(`אברכי ${k.name}`, ['#', 'שם', 'טלפון', 'מ-'], list.map((m, i) => [i + 1, nm(m.contact_id), X.phoneOf(X.pById(m.contact_id)) || '', m.start_date]), { rtl: true });
}

// ---------- ✅ השתתפות ----------
const marksOf = (cid) => { const r = (K.data.att || []).find((x) => x.month === K.month && String(x.contact_id) === String(cid)); try { return JSON.parse(r?.marks || '{}') || {}; } catch { return {}; } };
const monthBar = (h) => `<div class="ms-bar"><button type="button" class="btn small-btn" data-m="-1">→</button><b class="kl-mon">${h(monLabel(K.month))}</b><button type="button" class="btn small-btn" data-m="1">←</button>`;
function wireMonth(body, again) { X.$$('[data-m]', body).forEach((b) => { b.onclick = () => { K.month = shiftMon(K.month, Number(b.dataset.m)); again(); }; }); }
function tabAtt(body, k, re) {
  const { h } = X;
  const list = members(k.kollel_id, true).filter((m) => !m.end_date || m.end_date >= `${K.month}-01`).sort(byName);
  const days = daysOf(K.month);
  const M = Object.fromEntries(list.map((m) => [m.contact_id, marksOf(m.contact_id)]));
  const changed = new Set();
  body.innerHTML = `${monthBar(h)}<span class="spacer"></span><button type="button" class="btn primary" id="kl-save" disabled>💾 שמירה</button></div>
    <p class="muted small">V = נכח באותו יום. אנטר מסמן ועובר למשבצת הבאה. לחיצה על היום בכותרת = V לכולם.</p>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table kl-att"><thead><tr><th>שם</th>${days.map((d) => `<th class="c" title="סמן לכולם"><button type="button" class="linkish" data-all="${d.day}">${DOW[d.dow]}<br>${d.day}</button></th>`).join('')}<th class="c">ימים</th></tr></thead><tbody>
      ${list.map((m) => `<tr><td class="kl-nm">${h(nm(m.contact_id))}</td>${days.map((d) => `<td class="c"><input type="checkbox" data-c="${h(m.contact_id)}" data-d="${d.day}"${M[m.contact_id][d.day] ? ' checked' : ''}></td>`).join('')}<td class="c" data-n="${h(m.contact_id)}">${Object.values(M[m.contact_id]).filter(Boolean).length}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="ms-note">אין אברכים בכולל. (👥 אברכים ← הוספה)</p>'}`;
  wireMonth(body, () => tabAtt(body, k, re));
  const sv = X.$('#kl-save', body);
  const count = (cid) => { const c = X.$(`[data-n="${cid}"]`, body); if (c) c.textContent = Object.values(M[cid]).filter(Boolean).length; };
  X.$$('[data-c]', body).forEach((cb) => { cb.onchange = () => { const cid = cb.dataset.c; if (cb.checked) M[cid][cb.dataset.d] = 1; else delete M[cid][cb.dataset.d]; changed.add(cid); count(cid); sv.disabled = false; }; });
  X.$$('[data-all]', body).forEach((b) => { b.onclick = () => { list.forEach((m) => { M[m.contact_id][b.dataset.all] = 1; changed.add(m.contact_id); const cb = X.$(`[data-c="${m.contact_id}"][data-d="${b.dataset.all}"]`, body); if (cb) cb.checked = true; count(m.contact_id); }); sv.disabled = false; }; });
  sv.onclick = async () => {
    sv.disabled = true;
    try { await X.call(X.KEY, 'klAtt', { kollel_id: k.kollel_id, month: K.month, rows: [...changed].map((cid) => ({ contact_id: cid, marks: JSON.stringify(M[cid]) })) }); X.toast('נשמר.'); re(); } catch (err) { X.toast(X.msg(err), 'err'); sv.disabled = false; }
  };
}

// ---------- 🎖 מלגות ----------
function tabStip(body, k, re) {
  const { h } = X;
  const list = members(k.kollel_id, true).filter((m) => !m.end_date || m.end_date >= `${K.month}-01`).sort(byName);
  const rate = Number(k.stip_day) || 0; const fixed = Number(k.stip_month) || 0;
  const rowOf = (cid) => (K.data.att || []).find((x) => x.month === K.month && String(x.contact_id) === String(cid)) || {};
  const rows = list.map((m) => { const n = Object.values(marksOf(m.contact_id)).filter(Boolean).length; return { cid: m.contact_id, n, total: n * rate + (n ? fixed : 0), paid: rowOf(m.contact_id).paid || '' }; });
  const sum = rows.reduce((s, r) => s + r.total, 0);
  body.innerHTML = `${monthBar(h)}<span class="spacer"></span><button type="button" class="btn" id="kl-sxl">⬇ Excel</button></div>
    <p class="muted small">חישוב: ${money(rate)} לכל יום (V)${fixed ? ` + ${money(fixed)} קבוע לחודש (למי שהיה לפחות יום אחד)` : ''}. הסכומים משתנים ב⚙ הגדרות הכולל. "שולם" — אפשר לכתוב מספר צ'ק / תאריך.</p>
    <div class="ms-stats"><div class="ms-stat"><span class="muted small">אברכים</span><b>${rows.filter((r) => r.n).length}</b></div><div class="ms-stat"><span class="muted small">סה"כ מלגות</span><b>${h(money(sum))}</b></div></div>
    ${rows.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>שם</th><th class="c">ימים</th><th class="num">סכום</th><th>שולם</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${h(nm(r.cid))}</td><td class="c">${r.n}</td><td class="num">${h(money(r.total))}</td><td><input data-paid="${h(r.cid)}" value="${h(r.paid)}" placeholder="—" style="width:10em"></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="ms-note">אין אברכים בכולל.</p>'}`;
  wireMonth(body, () => tabStip(body, k, re));
  X.$$('[data-paid]', body).forEach((inp) => { inp.onchange = async () => { try { await X.call(X.KEY, 'klAtt', { kollel_id: k.kollel_id, month: K.month, rows: [{ contact_id: inp.dataset.paid, marks: JSON.stringify(marksOf(inp.dataset.paid)), paid: inp.value.trim() }] }); const r = rowOf(inp.dataset.paid); if (r.month) r.paid = inp.value.trim(); else (K.data.att ||= []).push({ month: K.month, contact_id: inp.dataset.paid, marks: '{}', paid: inp.value.trim() }); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$('#kl-sxl', body).onclick = () => downloadXlsx(`מלגות ${k.name} ${K.month}`, ['שם', 'ימים', 'סכום', 'שולם'], rows.map((r) => [nm(r.cid), r.n, r.total, r.paid]), { rtl: true });
}

// ---------- 🧾 צ'קים של תמיכה ----------
function tabChecks(body, k, re) {
  const { h } = X;
  const list = (K.data.checks || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const sum = list.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const form = (c = {}) => `<form class="kl-chk" data-id="${h(c.check_id || '')}"><input name="date" type="date" value="${h(c.date || new Date().toISOString().slice(0, 10))}">
      <input name="payer" placeholder="מאת (מי שילם)" value="${h(c.payer || '')}"><input name="amount" type="number" step="0.01" placeholder="סכום $" value="${h(c.amount || '')}" dir="ltr" style="width:8em">
      <input name="check_no" placeholder="מס' צ'ק" value="${h(c.check_no || '')}" dir="ltr" style="width:7em"><input name="for_month" type="month" value="${h(c.for_month || '')}" title="עבור חודש">
      <input name="note" placeholder="הערה" value="${h(c.note || '')}"><button type="submit" class="btn small-btn primary">${c.check_id ? '💾' : '➕ הוספה'}</button></form>`;
  body.innerHTML = `<div class="ms-bar"><b>סה"כ: ${h(money(sum))}</b> · ${list.length} צ'קים<span class="spacer"></span><button type="button" class="btn" id="kl-cxl">⬇ Excel</button></div>
    ${form()}
    ${list.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>תאריך</th><th>מאת</th><th class="num">סכום</th><th>מס' צ'ק</th><th>עבור חודש</th><th>הערה</th><th></th></tr></thead><tbody>
      ${list.map((c) => `<tr><td class="small">${h(c.date)}</td><td>${h(c.payer)}</td><td class="num">${h(money(c.amount))}</td><td dir="ltr">${h(c.check_no)}</td><td class="small">${h(c.for_month)}</td><td class="small">${h(c.note)}</td>
        <td><button type="button" class="linkish" data-ed="${h(c.check_id)}">✎</button> <button type="button" class="linkish" data-del="${h(c.check_id)}">🗑</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="ms-note">עדיין לא נרשמו צ\'קים.</p>'}`;
  const wireForm = (f) => { f.onsubmit = async (e) => {
    e.preventDefault(); const v = f.elements;
    if (!Number(v.amount.value)) { X.toast('צריך סכום.', 'err'); return; }
    try { await X.call(X.KEY, 'klCheck', { check: { check_id: f.dataset.id, kollel_id: k.kollel_id, date: v.date.value, payer: v.payer.value.trim(), amount: v.amount.value, check_no: v.check_no.value.trim(), for_month: v.for_month.value, note: v.note.value.trim() } }); X.toast('נשמר.'); re(); } catch (err) { X.toast(X.msg(err), 'err'); }
  }; };
  wireForm(X.$('.kl-chk', body));
  X.$$('[data-ed]', body).forEach((b) => { b.onclick = () => { const c = list.find((x) => String(x.check_id) === b.dataset.ed); const d = X.dialog(`<h2>✎ צ'ק</h2>${form(c)}<div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`); wireForm(X.$('.kl-chk', d)); }; });
  X.$$('[data-del]', body).forEach((b) => { b.onclick = async () => { if (!window.confirm('למחוק את הצ\'ק?')) return; try { await X.call(X.KEY, 'klCheck', { check: { check_id: b.dataset.del }, remove: true }); re(); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$('#kl-cxl', body).onclick = () => downloadXlsx(`צ'קים ${k.name}`, ['תאריך', 'מאת', 'סכום', "מס' צ'ק", 'עבור חודש', 'הערה'], list.map((c) => [c.date, c.payer, Number(c.amount) || 0, c.check_no, c.for_month, c.note]), { rtl: true });
}
