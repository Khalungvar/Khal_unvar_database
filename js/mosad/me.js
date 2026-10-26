// אתר פון א מוסד — 👤 אזור אישי (פרטים, ⏱ שעון נוכחות, 📋 משימות, 📜 הפעולות שלי, ✉️ מייל — שפעטער),
// 📜 יומן פעולות (בעלים / מנהל), 📜 היסטוריה פון א רשומה, און 🗂 גיבויים.
import { downloadXlsx } from '../excel.js?v=361';
import { todayIso } from '../hebdate.js?v=361';

let X = null;
export function initMe(ctx) { X = ctx; }
const U = { users: null, tasks: null, showDone: false };

// ---------- נעמען פון ענטיטיעס און פעלדער (פאר דעם יומן) ----------
const ENT = {
  Enrollments: 'רישום', Tuition: 'תשלום שכר לימוד', Receipts: 'קבלת שכר לימוד', Gifts: 'נדבה (בלי איש קשר)', People: 'אנשי המוסד', Chavrusas: 'חברותא',
  Attendance: 'השתתפות', Hours: 'שעות', Insurance: 'ביטוח בריאות', Team: 'צוות', PayInfo: 'פרטי שכר', PayItems: 'תוספת/ניכוי', PayPayments: 'תשלום משכורת',
  Expenses: 'הוצאה', Incomes: 'הכנסה', Debts: 'חוב', Repayments: 'החזר', Tasks: 'משימה', Settings: 'הגדרות', Staff: 'הרשאות',
  'main.Contacts': 'איש קשר', 'main.Phones': 'טלפונים / מייל', 'main.Relations': 'קשר משפחתי', 'main.Requests': 'בקשה למנהל', 'main.Donations': 'נדבה',
  'main.Receipts': 'קבלה (ארה"ב)', 'main.Mosdos': 'הגדרות המוסד',
};
const ACT = { create: 'נוצר', update: 'עודכן', delete: 'נמחק' };
const FIELD = {
  first_name_he: 'שם פרטי', last_name_he: 'משפחה', title_he: 'תואר', first_name_en: 'First', last_name_en: 'Last', address: 'כתובת', city: 'עיר', mobile: 'נייד', home_phone: 'טלפון',
  email_1: 'מייל', status: 'סטטוס', start_date: 'מ-', end_date: 'עד', shiur: 'שיעור', room: 'חדר', month_amounts: 'סכומים לחודש', tuition_amount: 'שכר לימוד', amount: 'סכום',
  date: 'תאריך', method: 'אמצעי', check_number: "מס' צ'ק", card_last4: 'כרטיס', note: 'הערה', kupah: 'קופה', member_no: 'מספר חבר', debt: 'חוב', il_phone: 'טלפון בארץ',
  marks: 'סימונים', partner_id: 'חברותא', partner_text: 'חברותא', time_in: 'כניסה', time_out: 'יציאה', role: 'תפקיד', pay_type: 'סוג שכר', active: 'פעיל', currency: 'מטבע',
  category: 'קטגוריה', paid_to: 'למי', is_paid: 'שולם', text: 'משימה', assigned_to: 'למי', due: 'עד', kind: 'סוג', amount_usd: 'בדולר', amount_orig: 'סכום מקורי', receipt_no: 'קבלה',
  global_amount: 'גלובלי', hourly_rate: 'לשעה', id_number: 'ת"ז', bank_last4: 'חשבון', contact_id: 'איש קשר', perms: 'הרשאות', email: 'מייל',
  task_id: 'מס׳', from_email: 'מאת', urgent: 'דחוף', done_at: 'בוצע', month: 'חודש', source: 'ממי', source_id: 'ממי', is_loan: 'הלוואה', charged_type: 'על חשבון', charged_to: 'על חשבון',
  charged_id: 'על חשבון', paid_by: 'מי שילם', paid_by_id: 'מי שילם', receipt_file: 'צילום קבלה', exp_id: 'מס׳', inc_id: 'מס׳', pay_id: 'מס׳', item_id: 'מס׳', rep_id: 'מס׳', debt_id: 'מס׳',
  debt_key: 'חוב', direction: 'כיוון', person: 'מי', person_id: 'מי', reason: 'על מה', advance: 'מקדמה', zman: 'זמן', seder: 'סדר', week: 'שבוע', schedule: 'שעות קבועות',
  enroll_id: 'רישום', payment_id: 'תשלום', parent_id: 'הורה', payer_id: 'משלם', donation_id: 'נדבה', gift_id: 'נדבה', kind_label: 'סוג', expires: 'בתוקף עד', company: 'חברה',
  policy_no: 'פוליסה', passport: 'דרכון', left_date: 'עזיבה', dedication_type: 'הקדשה', dedication_text: 'נוסח', il_receipt_no: 'קבלה ישראלית', payment_method: 'אמצעי', for_text: 'עבור',
};
const entName = (e) => ENT[e] || e || '';
async function users() {
  if (!U.users) { try { U.users = (await X.call(X.KEY, 'users')).users; } catch { U.users = []; } }
  return U.users;
}
const userName = (em) => (U.users || []).find((u) => u.email === String(em || '').toLowerCase())?.name || String(em || '').split('@')[0];
function changesHtml(x) {
  const { h } = X;
  let c; try { c = JSON.parse(x.changes || 'null'); } catch { c = null; }
  if (!c) return h(x.detail || '');
  const nameIfId = (k, v) => ((k === 'contact_id' || k === 'partner_id') && v && X.pById(v) ? X.nameOf(X.pById(v)) : v);
  if (Array.isArray(c)) return c.map(([k, a, b]) => `<div><b>${h(FIELD[k] || k)}:</b> <s class="muted">${h(nameIfId(k, a) || '—')}</s> ← ${h(nameIfId(k, b) || '—')}</div>`).join('');
  return Object.entries(c).slice(0, 12).map(([k, v]) => `<span class="lg-kv"><b>${h(FIELD[k] || k)}:</b> ${h(nameIfId(k, v))}</span>`).join(' ');
}
function logTable(list) {
  const { h } = X;
  if (!list.length) return '<p class="muted ms-empty">אין פעולות.</p>';
  return `<div class="ms-wrap"><table class="ms-table lg-table"><thead><tr><th>מתי</th><th>מי</th><th>מה</th><th>פרטים</th></tr></thead><tbody>
    ${list.map((x) => `<tr><td class="small" dir="ltr">${h(x.at)}</td><td class="small">${h(userName(x.by))}</td>
      <td class="small"><b>${h(ACT[x.action] || x.action)}</b> ${h(entName(x.entity))}${x.contact_id && X.pById(x.contact_id) ? ` · ${h(X.nameOf(X.pById(x.contact_id)))}` : ''}</td>
      <td class="small">${changesHtml(x)}</td></tr>`).join('')}</tbody></table></div>`;
}

/** 📜 די היסטאריע פון א רשומה (entity + id) אדער פון א מענטש (contact_id) */
export async function historyDialog(q, title = '') {
  const d = X.dialog(`<h2>📜 היסטוריה${title ? ` — ${X.h(title)}` : ''}</h2><div class="hx-body"><p class="muted">טוען…</p></div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`, 'ms-wide');
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  try { await users(); const r = await X.call(X.KEY, 'history', q); X.$('.hx-body', d).innerHTML = logTable(r.log); } catch (err) { X.$('.hx-body', d).innerHTML = `<p class="ms-note err">${X.h(X.msg(err))}</p>`; }
}

// =====================================================================
// 👤 אזור אישי
// =====================================================================
export async function renderMe(box) {
  const { h, st } = X;
  box.innerHTML = '<p class="muted">טוען…</p>';
  try {
    await users();
    const [r, me] = await Promise.all([X.call(X.KEY, 'tasks'), X.call(X.KEY, 'me')]);
    U.tasks = r.tasks; st.team = me.team || null; st.clock = me.clock || null; st.openTasks = me.openTasks || 0;
  } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
  const t = st.team;
  const p = t ? X.pById(t.contact_id) : null;
  const permNames = (st.me.role === 'owner' || st.me.role === 'admin') ? 'הכל' : st.me.perms.map((k) => X.permName(k)).join(', ');
  box.innerHTML = `<h2 class="ms-h">👤 אזור אישי</h2>
    <div class="me-grid">
      <section class="me-card"><h3>הפרטים שלי</h3>
        <div class="kv"><span>שם</span><span>${h(p ? X.nameOf(p) : st.me.name || '—')}</span></div>
        <div class="kv"><span>נכנס עם</span><span dir="ltr">${h(st.me.email)}</span></div>
        <div class="kv"><span>תפקיד באתר</span><span>${h(X.roleName(st.me.role))}</span></div>
        ${t?.role ? `<div class="kv"><span>תפקיד</span><span>${h(t.role)}</span></div>` : ''}
        <div class="kv"><span>הרשאות</span><span class="small">${h(permNames)}</span></div>
        <div class="kv"><span>✉️ מייל המוסד</span><span class="muted small">יחובר אחרי Google for Nonprofits (כתובת @ungvar.org, תיבת דואר ושליחה מהאתר).</span></div>
      </section>
      ${t ? `<section class="me-card"><h3>⏱ שעון נוכחות</h3><div id="me-clock"></div></section>` : ''}
    </div>
    <section class="me-card"><h3>📋 משימות</h3><div id="me-tasks"></div></section>
    <section class="me-card"><h3>📜 הפעולות שלי</h3><div id="me-log"><button type="button" class="btn" id="me-log-go">הצג</button></div></section>`;
  if (t) clockBox(X.$('#me-clock', box));
  tasksBox(X.$('#me-tasks', box));
  X.$('#me-log-go', box).onclick = async () => {
    const el = X.$('#me-log', box); el.innerHTML = '<p class="muted">טוען…</p>';
    try { const r = await X.call(X.KEY, 'log', { mine: true }); el.innerHTML = logTable(r.log.slice(0, 300)); } catch (err) { el.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; }
  };
}
function clockBox(el) {
  const { h, st } = X;
  const c = st.clock || {};
  const state = !c.time_in ? 'in' : !c.time_out ? 'out' : 'done';
  el.innerHTML = `<p>היום: ${c.time_in ? `נכנסת ב-<b dir="ltr">${h(c.time_in)}</b>` : 'עוד לא נכנסת'}${c.time_out ? ` · יצאת ב-<b dir="ltr">${h(c.time_out)}</b>` : ''}</p>
    ${state === 'done' ? '<p class="muted small">היום כבר נרשם. לתיקון — פנה ללוי.</p>' : `<button type="button" class="btn primary me-clock-btn" id="me-clock-go">${state === 'in' ? '▶ נכנסתי' : '⏹ יצאתי'}</button>`}
    <p class="muted small">השעה לפי שעון ירושלים, ונכנסת ישר לשעות שבמשכורות.</p>`;
  X.$('#me-clock-go', el)?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const r = await X.call(X.KEY, 'clock'); st.clock = r.clock; clockBox(el); X.toast('נרשם.'); } catch (err) { e.target.disabled = false; X.toast(X.msg(err), 'err'); }
  });
}
function tasksBox(el) {
  const { h, st } = X;
  const me = st.me.email;
  const today = todayIso();
  const list = (U.tasks || []).filter((t) => U.showDone || t.status !== 'done')
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.urgent === 'TRUE') - (a.urgent === 'TRUE') || String(a.due || '9999').localeCompare(String(b.due || '9999')));
  const mine = list.filter((t) => t.assigned_to === me);
  const given = list.filter((t) => t.assigned_to !== me && t.from_email === me);
  const others = list.filter((t) => t.assigned_to !== me && t.from_email !== me);
  const row = (t) => `<div class="tk-row${t.status === 'done' ? ' done' : ''}${t.status !== 'done' && t.due && t.due < today ? ' late' : ''}">
      <input type="checkbox" data-done="${h(t.task_id)}"${t.status === 'done' ? ' checked' : ''} title="בוצע">
      <span class="tk-text">${t.urgent === 'TRUE' ? '<b class="tk-urgent">דחוף</b> ' : ''}${h(t.text)}
        ${t.contact_id && X.pById(t.contact_id) ? ` · <a href="#" data-open="${h(t.contact_id)}">${h(X.nameOf(X.pById(t.contact_id)))}</a>` : ''}</span>
      <span class="muted small">${t.due ? `עד ${h(t.due)}` : ''}${t.assigned_to !== me ? ` · ל${h(userName(t.assigned_to))}` : ''}${t.from_email !== me ? ` · מ${h(userName(t.from_email))}` : ''}</span>
      ${t.from_email === me || st.me.role === 'owner' || st.me.role === 'admin' ? `<button type="button" class="linkish" data-ed="${h(t.task_id)}" title="עריכה">✎</button><button type="button" class="linkish" data-del="${h(t.task_id)}" title="מחיקה">🗑</button>` : ''}
    </div>`;
  el.innerHTML = `<div class="ms-bar"><button type="button" class="btn primary" id="tk-new">➕ משימה חדשה</button>
      <label class="check"><input type="checkbox" id="tk-showdone"${U.showDone ? ' checked' : ''}> הצג גם שבוצעו</label></div>
    <h4>שלי (${mine.filter((t) => t.status !== 'done').length})</h4>${mine.map(row).join('') || '<p class="muted small">אין.</p>'}
    <h4>נתתי לאחרים</h4>${given.map(row).join('') || '<p class="muted small">אין.</p>'}
    ${others.length ? `<h4>משימות של אחרים</h4>${others.map(row).join('')}` : ''}`;
  X.$('#tk-new', el).onclick = () => taskDialog(null, el);
  X.$('#tk-showdone', el).onchange = (e) => { U.showDone = e.target.checked; tasksBox(el); };
  X.$$('[data-done]', el).forEach((c) => {
    c.onchange = async () => {
      try { await X.call(X.KEY, 'taskDone', { task_id: c.dataset.done, undo: !c.checked }); const t = U.tasks.find((x) => x.task_id === c.dataset.done); t.status = c.checked ? 'done' : 'open'; st.openTasks = U.tasks.filter((x) => x.status !== 'done' && x.assigned_to === me).length; tasksBox(el); } catch (err) { c.checked = !c.checked; X.toast(X.msg(err), 'err'); }
    };
  });
  X.$$('[data-ed]', el).forEach((b) => { b.onclick = () => taskDialog(U.tasks.find((x) => x.task_id === b.dataset.ed), el); });
  X.$$('[data-del]', el).forEach((b) => {
    b.onclick = async () => {
      if (!window.confirm('למחוק את המשימה?')) return;
      try { await X.call(X.KEY, 'taskDone', { task_id: b.dataset.del, del: true }); U.tasks = U.tasks.filter((x) => x.task_id !== b.dataset.del); tasksBox(el); } catch (err) { X.toast(X.msg(err), 'err'); }
    };
  });
  X.$$('[data-open]', el).forEach((a) => { a.onclick = (e) => { e.preventDefault(); X.personDialog(X.pById(a.dataset.open)); }; });
}
function taskDialog(t0, el) {
  const { h, S, st } = X;
  const t = t0 || { assigned_to: st.me.email };
  const label = (id) => (id && X.pById(id) ? `${X.nameOf(X.pById(id))} (#${id})` : '');
  const d = X.dialog(`<h2>📋 ${t0 ? 'עריכת משימה' : 'משימה חדשה'}</h2>
    <form class="ms-form" autocomplete="off">
      <label class="wide">מה לעשות *<textarea name="text" rows="3">${h(t.text || '')}</textarea></label>
      <div class="grid">
        <label>למי<select name="assigned_to">${(U.users || []).map((u) => `<option value="${h(u.email)}"${u.email === t.assigned_to ? ' selected' : ''}>${h(u.name || u.email)}${u.email === st.me.email ? ' (אני)' : ''}</option>`).join('')}</select></label>
        <label>עד תאריך<input name="due" type="date" value="${h(t.due || '')}"></label>
        <label class="check"><input type="checkbox" name="urgent"${t.urgent === 'TRUE' ? ' checked' : ''}> דחוף</label>
        <label class="wide">קשור ל… (לא חובה)<input name="person" list="tk-dl" value="${h(label(t.contact_id))}" placeholder="בחור / הורה / איש צוות"></label>
      </div>
      <datalist id="tk-dl">${X.st.people.map((p) => `<option value="${h(`${X.nameOf(p)} (#${p.contact_id})`)}">`).join('')}</datalist>
      <p class="muted small">תזכורת במייל ביום היעד — אחרי שיחובר המייל.</p>
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div>
    </form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = S(form.elements.text.value);
    if (!text) { X.toast('חסר תוכן.', 'err'); return; }
    const m = S(form.elements.person.value).match(/\(#(\d+)\)$/);
    const row = { task_id: t.task_id || '', text, assigned_to: form.elements.assigned_to.value, due: form.elements.due.value, urgent: form.elements.urgent.checked, contact_id: m ? m[1] : '' };
    try {
      const r = await X.call(X.KEY, 'taskSave', { task: row });
      if (t0) Object.assign(t0, { ...row, urgent: row.urgent ? 'TRUE' : '' });
      else U.tasks.push({ ...row, task_id: r.task_id, from_email: st.me.email, status: 'open', urgent: row.urgent ? 'TRUE' : '' });
      st.openTasks = U.tasks.filter((x) => x.status !== 'done' && x.assigned_to === st.me.email).length;
      d.close(); tasksBox(el); X.toast('נשמר.');
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  form.elements.text.focus();
}

// =====================================================================
// 📜 יומן פעולות (בעלים / מנהל)
// =====================================================================
const LG = { from: '', to: '', by: '', entity: '', q: '' };
export async function renderLog(box) {
  const { h } = X;
  await users();
  if (!LG.from) LG.from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  box.innerHTML = `<h2 class="ms-h">📜 יומן פעולות</h2>
    <form class="ms-bar lg-filter" autocomplete="off">
      <label>מ-<input type="date" name="from" value="${h(LG.from)}"></label><label>עד<input type="date" name="to" value="${h(LG.to)}"></label>
      <label>מי<select name="by"><option value="">כולם</option>${(U.users || []).map((u) => `<option value="${h(u.email)}"${u.email === LG.by ? ' selected' : ''}>${h(u.name || u.email)}</option>`).join('')}</select></label>
      <label>מה<select name="entity"><option value="">הכל</option>${Object.entries(ENT).map(([k, v]) => `<option value="${h(k)}"${k === LG.entity ? ' selected' : ''}>${h(v)}</option>`).join('')}</select></label>
      <input type="search" name="q" placeholder="חיפוש בתוכן" value="${h(LG.q)}">
      <button type="submit" class="btn primary">הצג</button><span class="spacer"></span><button type="button" class="btn" id="lg-xl">⬇ Excel</button>
    </form><div id="lg-out"><p class="muted">טוען…</p></div>`;
  const form = X.$('form', box);
  let last = [];
  const load = async () => {
    Object.keys(LG).forEach((k) => { LG[k] = form.elements[k].value; });
    const out = X.$('#lg-out', box); out.innerHTML = '<p class="muted">טוען…</p>';
    try { const r = await X.call(X.KEY, 'log', LG); last = r.log; out.innerHTML = `<p class="muted small">${r.total > r.log.length ? `מוצגות ${r.log.length} אחרונות מתוך ${r.total}` : `${r.total} פעולות`}</p>${logTable(r.log)}`; } catch (err) { out.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; }
  };
  form.onsubmit = (e) => { e.preventDefault(); load(); };
  X.$('#lg-xl', box).onclick = () => downloadXlsx('יומן פעולות', ['מתי', 'מי', 'פעולה', 'מה', 'מזהה', 'איש קשר', 'פרטים'],
    last.map((x) => [x.at, userName(x.by), ACT[x.action] || x.action, entName(x.entity), x.entity_id, x.contact_id && X.pById(x.contact_id) ? X.nameOf(X.pById(x.contact_id)) : x.contact_id, x.changes || x.detail]), { rtl: true });
  load();
}

// =====================================================================
// 🗂 גיבויים (אין "צוות והרשאות")
// =====================================================================
export function backupsHtml() {
  return `<h3>🗂 גיבויים</h3><p class="muted small">כל לילה ב-3:00 (שעון ירושלים) נשמר עותק של הגיליון של המוסד${X.st.me.role === 'owner' ? ' ושל הגיליון הכללי' : ''}. נשמרים 14 הימים האחרונים ועוד גיבוי אחד מכל חודש לחצי שנה. לפני שחזור — נשמר אוטומטית גיבוי של המצב הנוכחי.</p>
    <div class="ms-bar"><button type="button" class="btn primary" id="bk-now">💾 גבה עכשיו</button><button type="button" class="btn" id="bk-load">📂 הצג גיבויים</button></div><div id="bk-out"></div>`;
}
export function wireBackups(root) {
  const { h } = X;
  const out = X.$('#bk-out', root);
  if (!out) return;
  const show = (r) => {
    const list = (title, arr, restore) => `<h4>${h(title)}</h4>${arr && arr.length ? `<table class="ms-table"><tbody>${arr.map((b) => `<tr><td dir="ltr">${h(b.at)}</td><td class="small muted">${h(b.why)}</td>
      <td class="ms-acts"><button type="button" class="btn small-btn" data-bko="${h(b.id)}">👁 פתח לצפייה</button>${restore ? `<button type="button" class="btn small-btn danger" data-bkr="${h(b.id)}" data-at="${h(b.at)}">↩ שחזר</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">אין עדיין גיבויים.</p>'}`;
    out.innerHTML = list('הגיליון של המוסד', r.mosad, true) + (r.main ? list('הגיליון הכללי (שחזור — רק דרכי, בבקשה)', r.main, false) : '');
    X.$$('[data-bko]', out).forEach((b) => {
      b.onclick = async () => {
        const w = window.open('', '_blank');
        try { const x = await X.call(X.KEY, 'backupOpen', { id: b.dataset.bko }); w.location = x.url; } catch (err) { w?.close(); X.toast(X.msg(err), 'err'); }
      };
    });
    X.$$('[data-bkr]', out).forEach((b) => {
      b.onclick = async () => {
        if (!window.confirm(`לשחזר את הגיליון של המוסד למצב של ${b.dataset.at}?\n\nכל השינויים מאז יוחלפו. לפני השחזור נשמר גיבוי של המצב הנוכחי (אפשר לחזור אליו).`)) return;
        b.disabled = true;
        try { await X.call(X.KEY, 'backupRestore', { id: b.dataset.bkr }); X.toast('שוחזר. טוען מחדש…'); setTimeout(() => window.location.reload(), 1200); } catch (err) { b.disabled = false; X.toast(X.msg(err), 'err'); }
      };
    });
  };
  X.$('#bk-load', root).onclick = async () => { out.innerHTML = '<p class="muted">טוען…</p>'; try { show(await X.call(X.KEY, 'backups')); } catch (err) { out.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; } };
  X.$('#bk-now', root).onclick = async (e) => {
    e.target.disabled = true; out.innerHTML = '<p class="muted">מגבה…</p>';
    try { await X.call(X.KEY, 'backupNow'); X.toast('גובה.'); show(await X.call(X.KEY, 'backups')); } catch (err) { out.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; } finally { e.target.disabled = false; }
  };
}
