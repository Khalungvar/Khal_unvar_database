// אתר פון א מוסד — 👔 אנשי צוות ואברכים: צוויי באזונדערע רשימות אין איין כפתור.
// אנשי צוות: תפקיד, טלפון, מייל (לאגאין), פון ווען, פעיל/לשעבר, סארט שכר (אן סכומים); 💰 → משכורות (נאר מיט הרשאה).
// אברכים: וועמען זיי לערנען מיט (פון די חברותות), און שעות (כניסה/יציאה).
import { downloadXlsx } from '../excel.js?v=532';
import { currentZman } from './school.js?v=532';
import { historyDialog } from './me.js?v=532';
import { heDate } from './brand.js?v=532';
import { rulesOf, rulesText } from './hdays.js?v=532';

let X = null;
export function initTeam(ctx) { X = ctx; }
const PAY_VIA = { '': '—', us: 'דרכנו', parents: 'ישירות מההורים' };
const T = { tab: 'staff', team: null, chav: null, past: false };
export const PAY_TYPES = { '': '—', global: 'גלובלי (סכום קבוע לחודש)', schedule: 'שעות קבועות (מערכת)', log: 'רישום יומי (כניסה/יציאה)', mixed: 'גלובלי + שעות (רישום יומי)', days: 'לפי ימי עבודה (לוח עברי)' };
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
export const schedText = (s) => { let a; try { a = typeof s === 'string' ? JSON.parse(s || '[]') : s || []; } catch { a = []; } if (!Array.isArray(a)) return rulesText(a); return a.map((x) => `${DAYS[x.d]} ${x.from}–${x.to}`).join(', '); };

export async function loadTeam() { T.team = (await X.call(X.KEY, 'team')).team; return T.team; }
export function resetTeam() { T.team = null; }

export async function renderTeam(box) {
  const { h } = X;
  if (!T.team) {
    box.innerHTML = '<p class="muted">טוען…</p>';
    try { await loadTeam(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
  }
  box.innerHTML = `<h2 class="ms-h">👔 אנשי צוות ואברכים</h2>
    <nav class="ms-subtabs"><button type="button" data-t="staff" class="${T.tab === 'staff' ? 'on' : ''}">👔 אנשי צוות</button><button type="button" data-t="av" class="${T.tab === 'av' ? 'on' : ''}">📚 אברכים</button></nav>
    <div id="tm-body"></div>`;
  X.$$('[data-t]', box).forEach((b) => { b.onclick = () => { T.tab = b.dataset.t; renderTeam(box); }; });
  const body = X.$('#tm-body', box);
  if (T.tab === 'staff') staffList(body, box); else avList(body);
}

function staffList(body, box) {
  const { h } = X;
  const tOf = (id) => T.team.find((t) => String(t.contact_id) === String(id)) || {};
  const people = X.st.people.filter((p) => (p.kinds || [p.kind]).includes('staff'));
  const isActive = (p) => tOf(p.contact_id).active !== 'FALSE';
  const list = people.filter((p) => (T.past ? !isActive(p) : isActive(p))).sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he'));
  const fin = X.can('finance');
  body.innerHTML = `<div class="ms-bar"><div class="seg"><button type="button" data-p="0" class="${T.past ? '' : 'on'}">פעילים (${people.filter(isActive).length})</button><button type="button" data-p="1" class="${T.past ? 'on' : ''}">לשעבר (${people.filter((p) => !isActive(p)).length})</button></div>
      <span class="spacer"></span>${X.can('people_edit') ? '<button type="button" class="btn primary" id="tm-add">➕ איש צוות</button>' : ''}<button type="button" class="btn" id="tm-xl">⬇ Excel</button></div>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>שם</th><th>תפקיד</th><th>טלפון</th><th>מייל</th><th>מ-</th><th>שכר</th><th></th></tr></thead><tbody>
      ${list.map((p) => { const t = tOf(p.contact_id); return `<tr><td><a href="#" data-open="${h(p.contact_id)}"><b>${h(X.nameOf(p))}</b></a></td><td>${h(t.role || '')}</td>
        <td dir="ltr" class="small">${h(p.il_phone || X.phoneOf(p))}</td><td dir="ltr" class="small">${h(t.email || p.email_1 || '')}</td><td class="small">${h(heDate(t.start_date))}${t.end_date ? ` – ${h(heDate(t.end_date))}` : ''}</td>
        <td class="small">${h(PAY_TYPES[t.pay_type || ''])}${t.pay_type === 'schedule' || t.pay_type === 'days' ? `<div class="muted">${h(schedText(t.schedule))}</div>` : ''}</td>
        <td class="ms-acts">${X.can('staff_list') ? `<button type="button" class="btn small-btn" data-ed="${h(p.contact_id)}" title="עריכה">✎</button>` : ''}
          ${fin ? `<button type="button" class="btn small-btn" data-pay="${h(p.contact_id)}" title="משכורת">💰</button>` : ''}
          <button type="button" class="btn small-btn" data-hx="${h(p.contact_id)}" title="היסטוריה">📜</button>
          ${X.can('people_edit') ? `<button type="button" class="btn small-btn" data-rm="${h(p.contact_id)}" title="הוצאה מהרשימה">🗑</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
    : '<p class="muted ms-empty">אין.</p>'}
    <p class="muted small">איש צוות = אדם מסוג "צוות" ברשימת האנשים. המייל כאן הוא חשבון הגוגל שאיתו הוא נכנס לאתר — כך עובד אצלו שעון הנוכחות באזור האישי.</p>`;
  X.$$('[data-p]', body).forEach((b) => { b.onclick = () => { T.past = b.dataset.p === '1'; renderTeam(box); }; });
  X.$('#tm-add', body)?.addEventListener('click', () => X.addDialog('staff'));
  X.$$('[data-open]', body).forEach((a) => { a.onclick = (e) => { e.preventDefault(); X.personDialog(X.pById(a.dataset.open)); }; });
  X.$$('[data-ed]', body).forEach((b) => { b.onclick = () => teamDialog(b.dataset.ed, tOf(b.dataset.ed), box); });
  X.$$('[data-pay]', body).forEach((b) => { b.onclick = () => X.payDialog?.(b.dataset.pay); });
  X.$$('[data-hx]', body).forEach((b) => { b.onclick = () => historyDialog({ contact_id: b.dataset.hx }, X.nameOf(X.pById(b.dataset.hx))); });
  X.$$('[data-rm]', body).forEach((b) => { b.onclick = () => X.unlinkDialog(X.pById(b.dataset.rm), 'staff', 'הוצאה מרשימת אנשי הצוות', loadTeam); });
  X.$('#tm-xl', body).onclick = () => downloadXlsx('אנשי צוות', ['שם', 'תפקיד', 'טלפון', 'מייל', 'מ-', 'עד', 'פעיל', 'שכר', 'שעות קבועות'],
    list.map((p) => { const t = tOf(p.contact_id); return [X.nameOf(p), t.role || '', p.il_phone || X.phoneOf(p), t.email || p.email_1 || '', t.start_date || '', t.end_date || '', t.active === 'FALSE' ? 'לשעבר' : 'פעיל', PAY_TYPES[t.pay_type || ''], schedText(t.schedule)]; }), { rtl: true });
}

function teamDialog(id, t, box) {
  const { h, S } = X;
  let sched; try { sched = JSON.parse(t.schedule || '[]'); } catch { sched = []; }
  if (!Array.isArray(sched)) sched = [];
  const rules = rulesOf(t.pay_type === 'days' ? t.schedule : null);
  const HD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const p = X.pById(id);
  const d = X.dialog(`<h2>👔 ${h(X.nameOf(p))}</h2>
    <form class="ms-form" autocomplete="off"><div class="grid">
      <label>תפקיד<input name="role" value="${h(t.role || '')}" placeholder="משגיח, ר&quot;מ, מבשל…"></label>
      <label>מייל (חשבון גוגל לכניסה)<input name="email" type="email" dir="ltr" value="${h(t.email || '')}"></label>
      <label>תאריך התחלה<input name="start_date" type="date" value="${h(t.start_date || '')}"></label>
      <label>תאריך סיום<input name="end_date" type="date" value="${h(t.end_date || '')}"></label>
      <label class="check"><input type="checkbox" name="active"${t.active === 'FALSE' ? '' : ' checked'}> פעיל</label>
      <label class="wide">סוג שכר<select name="pay_type">${Object.entries(PAY_TYPES).map(([k, v]) => `<option value="${h(k)}"${k === (t.pay_type || '') ? ' selected' : ''}>${h(v)}</option>`).join('')}</select></label>
    </div>
    <fieldset class="tm-sched"${t.pay_type === 'schedule' ? '' : ' hidden'}><legend>שעות קבועות</legend>
      ${DAYS.map((dn, j) => { const x = sched.find((s) => s.d === j) || {}; return `<div class="tm-day"><label class="check"><input type="checkbox" name="sd${j}"${x.from ? ' checked' : ''}> ${dn}</label>
        <input type="time" name="sf${j}" value="${h(x.from || '')}"> – <input type="time" name="st${j}" value="${h(x.to || '')}"></div>`; }).join('')}
    </fieldset>
    <fieldset class="tm-days"${t.pay_type === 'days' ? '' : ' hidden'}><legend>ימי עבודה</legend>
      <div class="tm-dows">${HD.map((dn, j) => `<label class="check"><input type="checkbox" name="wd${j}"${rules.dows.includes(j) ? ' checked' : ''}> ${dn}</label>`).join('')}</div>
      <p class="muted small">הימים שבהם הוא עובד בדרך כלל — הם פתוחים לסימון ב"✅ השתתפות → 🧹 ימי עבודה". מסמנים כל יום שעבד בפועל. התשלום לחודש עברי = ימים מסומנים × הסכום ליום (בכפתור 💰).</p>
    </fieldset>
    <label class="wide">הערה<input name="note" value="${h(t.note || '')}"></label>
    <p class="muted small">סכומים (גלובלי, לשעה), תעודת זהות וחשבון — רק בכפתור 💰 משכורות.</p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div></form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d); const el = form.elements;
  el.pay_type.onchange = () => { X.$('.tm-sched', d).hidden = el.pay_type.value !== 'schedule'; X.$('.tm-days', d).hidden = el.pay_type.value !== 'days'; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const schedule = DAYS.map((_, j) => (el[`sd${j}`].checked && el[`sf${j}`].value && el[`st${j}`].value ? { d: j, from: el[`sf${j}`].value, to: el[`st${j}`].value } : null)).filter(Boolean);
    const dayRules = { dows: HD.map((_, j) => j).filter((j) => el[`wd${j}`].checked) };
    const row = { contact_id: id, role: S(el.role.value), email: S(el.email.value).toLowerCase(), start_date: el.start_date.value, end_date: el.end_date.value, active: el.active.checked, pay_type: el.pay_type.value,
      schedule: JSON.stringify(el.pay_type.value === 'days' ? dayRules : schedule), note: S(el.note.value), pay_via: t.pay_via || '' };
    try { await X.call(X.KEY, 'teamSave', { team: row }); await loadTeam(); d.close(); renderTeam(box); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

async function avList(body) {
  const { h } = X;
  const av = X.st.people.filter((p) => (p.kinds || [p.kind]).includes('avreich')).sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he'));
  const zman = currentZman();
  if (!T.chav || T.chav.zman !== zman) {
    body.innerHTML = '<p class="muted">טוען…</p>';
    try { T.chav = { zman, rows: X.can('chavrusas') ? (await X.call(X.KEY, 'chav', { zman })).rows : [] }; } catch { T.chav = { zman, rows: [] }; }
  }
  const sed = (k) => (X.st.settings?.sedarim || []).find((s) => s.key === k)?.name || k;
  if (!T.team) { try { await loadTeam(); } catch { T.team = []; } }
  const viaOf = (id) => ((T.team || []).find((t) => String(t.contact_id) === String(id)) || {}).pay_via || '';
  const withOf = (aid) => T.chav.rows.filter((r) => String(r.partner_id) === String(aid)).map((r) => `${X.pById(r.contact_id) ? X.nameOf(X.pById(r.contact_id)) : `#${r.contact_id}`} (${sed(r.seder)})`);
  body.innerHTML = `<div class="ms-bar"><span class="muted small">חברותות — ${h(zman)}</span><span class="spacer"></span>
      ${X.can('people_edit') ? '<button type="button" class="btn primary" id="av-add">➕ אברך</button>' : ''}
      ${X.can('attendance') ? '<button type="button" class="btn" id="av-hours">⏱ כניסה ויציאה</button>' : ''}
      ${X.can('chavrusas') ? '<button type="button" class="btn" id="av-chav">🤝 חברותות</button>' : ''}<button type="button" class="btn" id="av-xl">⬇ Excel</button></div>
    ${av.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>#</th><th>האברך</th><th>טלפון</th><th>חברותא</th><th>התשלום</th>${X.can('people_edit') ? '<th></th>' : ''}</tr></thead><tbody>
      ${av.map((p, i) => `<tr><td class="num">${i + 1}</td><td><a href="#" data-open="${h(p.contact_id)}"><b>${h(X.nameOf(p))}</b></a></td><td dir="ltr" class="small">${h(p.il_phone || X.phoneOf(p))}</td>
        <td class="small">${h(withOf(p.contact_id).join(', '))}</td>
        <td>${X.can('staff_list') ? `<select class="av-pay" data-id="${h(p.contact_id)}">${Object.entries(PAY_VIA).map(([k, v]) => `<option value="${k}"${k === viaOf(p.contact_id) ? ' selected' : ''}>${h(v)}</option>`).join('')}</select>` : h(PAY_VIA[viaOf(p.contact_id)])}</td>${X.can('people_edit') ? `<td class="ms-acts"><button type="button" class="btn small-btn" data-rm="${h(p.contact_id)}" title="הוצאה מהרשימה">🗑</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`
    : '<p class="muted ms-empty">אין עדיין אברכים. ➕ אברך — מוסיף מהמאגר הכללי (או חדש), מסוג "אברך".</p>'}`;
  X.$('#av-add', body)?.addEventListener('click', () => X.addDialog('avreich'));
  X.$('#av-hours', body)?.addEventListener('click', () => X.go('attendance', '_hours'));
  X.$('#av-chav', body)?.addEventListener('click', () => X.go('chavrusas'));
  X.$$('[data-open]', body).forEach((a) => { a.onclick = (e) => { e.preventDefault(); X.personDialog(X.pById(a.dataset.open)); }; });
  X.$$('[data-rm]', body).forEach((b) => { b.onclick = () => X.unlinkDialog(X.pById(b.dataset.rm), 'avreich', 'הוצאה מרשימת האברכים', loadTeam); });
  X.$('#av-xl', body).onclick = () => downloadXlsx('אברכים', ['#', 'האברך', 'טלפון', 'חברותא', 'התשלום'], av.map((p, i) => [i + 1, X.nameOf(p), p.il_phone || X.phoneOf(p), withOf(p.contact_id).join(', '), PAY_VIA[viaOf(p.contact_id)]]), { rtl: true });
  // התשלום: דורך אונז / גלייך פון די עלטערן — אין Team (מיט די אנדערע פעלדער וואס זענען שוין דא)
  X.$$('.av-pay', body).forEach((sel) => {
    sel.onchange = async () => {
      const id = sel.dataset.id; const ex = (T.team || []).find((t) => String(t.contact_id) === String(id)) || {};
      sel.disabled = true;
      try { await X.call(X.KEY, 'teamSave', { team: { ...ex, contact_id: id, active: ex.active !== 'FALSE', pay_via: sel.value } }); await loadTeam(); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
      sel.disabled = false;
    };
  });
}
