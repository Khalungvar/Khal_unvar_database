// 🕍 מרכז הכוללים — 📥 הרשמות: כל הטפסים, עריכה לכל שורה, מסמכים ותמונות, אישור, איפוס קוד, הדפסה 8.5×11.
import { SECTIONS, STATUS, showVal, printHtml, YESNO, reqOf, kindState, kindLabel, fieldFor, ALL_KINDS } from './kollelfields.js?v=659';
import { downloadXlsx } from '../excel.js?v=653';

let X;
const K = { apps: null, filter: 'open', q: '' };
export function initKollel(ctx) { X = ctx; }

async function load() { const r = await X.call(X.KEY, 'kaList'); K.apps = r.apps || []; }
const nm = (a) => `${a.data?.legal_first || ''} ${a.data?.legal_last || ''}`.trim() || a.email;
const stBadge = (s) => { const [t, c] = STATUS[s] || [s, '#777']; return `<span class="rg-st" style="--c:${c}">${X.h(t)}</span>`; };

export async function renderKollelReg(box) {
  const { h } = X;
  if (!K.apps) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await load(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  const link = new URL('register/', location.href.replace(/[^/]*$/, '')).href;
  const cnt = (f) => K.apps.filter(f).length;
  const FL = [['open', 'לטיפול', (a) => ['submitted', 'updated'].includes(a.status)], ['inprog', 'בתהליך מילוי', (a) => a.status === 'open'], ['approved', 'אושרו', (a) => a.status === 'approved'], ['rejected', 'נדחו', (a) => a.status === 'rejected'], ['draft', 'לא השלימו פתיחה', (a) => a.status === 'draft'], ['all', 'הכל', () => true]];
  const fl = FL.find((x) => x[0] === K.filter) || FL[0];
  const q = K.q.trim().toLowerCase();
  const list = K.apps.filter(fl[2]).filter((a) => !q || `${nm(a)} ${a.data?.yi_name || ''} ${a.email} ${a.data?.phone || ''}`.toLowerCase().includes(q))
    .sort((a, b) => String(b.submitted_at || b.updated_at).localeCompare(String(a.submitted_at || a.updated_at)));
  box.innerHTML = `<h2 class="ms-h">📥 הרשמות לכולל <span class="count-pill">${K.apps.length}</span></h2>
    <p class="muted small">הטופס לאברכים: <a href="${h(link)}" target="_blank" rel="noopener" dir="ltr">${h(link)}</a> — נכנסים עם אימייל וקוד (בלי גוגל). שכח קוד? פותחים את הטופס שלו ← 🔑 קוד חדש.</p>
    <div class="ms-bar"><div class="seg">${FL.map(([k, t, f]) => `<button type="button" data-f="${k}" class="${k === fl[0] ? 'on' : ''}">${h(t)} ${cnt(f)}</button>`).join('')}</div>
      <input type="search" id="ka-q" placeholder="חיפוש: שם, אימייל, טלפון…" value="${h(K.q)}"><span class="spacer"></span>
      <button type="button" class="btn" id="ka-xl">⬇ Excel</button><button type="button" class="btn" id="ka-rl">⟳ רענון</button></div>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table ka-list"><thead><tr><th>#</th><th>שם</th><th>נאמען אויף אידיש</th><th>טלפון</th><th>אימייל</th><th>מסמכים</th><th>סטטוס</th><th>נשלח</th><th>עודכן</th></tr></thead><tbody>
      ${list.map((a) => { const rq = reqOf(a.data?.marital); const docs = [...rq.gate, ...rq.rest]; const have = docs.filter((k) => kindState(a.files, k) === 'ok').length;
    return `<tr data-open="${h(a.app_id)}" style="cursor:pointer"><td class="num">${h(a.app_id)}</td><td><b>${h(nm(a))}</b></td><td dir="rtl">${h(a.data?.yi_name || '')}</td><td dir="ltr">${h(a.data?.phone || '')}</td>
        <td dir="ltr" class="small">${h(a.email)}</td><td class="c">${have}/${docs.length}</td><td>${stBadge(a.status)}</td><td class="small">${h(a.submitted_at || '')}</td><td class="small">${h(a.updated_at || '')}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="ms-note">אין טפסים כאן.</p>'}`;
  X.$$('[data-f]', box).forEach((b) => { b.onclick = () => { K.filter = b.dataset.f; renderKollelReg(box); }; });
  const qi = X.$('#ka-q', box); qi.oninput = () => { K.q = qi.value; clearTimeout(K.t); K.t = setTimeout(() => { renderKollelReg(box); const x = X.$('#ka-q', box); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 300); };
  X.$('#ka-rl', box).onclick = async () => { K.apps = null; renderKollelReg(box); };
  X.$('#ka-xl', box).onclick = () => {
    const fs = SECTIONS.flatMap((s) => s.fields);
    downloadXlsx('הרשמות לכולל', ['#', 'סטטוס', 'אימייל', ...fs.map((f) => f[1])], list.map((a) => [a.app_id, (STATUS[a.status] || [a.status])[0], a.email, ...fs.map((f) => showVal(f[0], a.data?.[f[0]]))]), { rtl: true });
  };
  X.$$('[data-open]', box).forEach((tr) => { tr.onclick = () => openApp(K.apps.find((a) => String(a.app_id) === tr.dataset.open), () => renderKollelReg(box)); });
}

/** טופס אחד: כל השדות עם ✎, המסמכים בצד */
function openApp(a, after) {
  const { h } = X;
  const married = () => a.data?.marital === 'married';
  const aiF = a.ai?.fields || {};
  const rowHtml = (f) => {
    const [k, en, , type, o] = f; const v = a.data?.[k] ?? '';
    return `<div class="ka-row${aiF[k] && aiF[k] === v ? ' ai' : ''}" data-k="${k}"><span>${h(en)}</span><b${o.rtl ? ' dir="rtl"' : ' dir="ltr"'}>${h(showVal(k, v)) || '<i class="muted">—</i>'}</b><button type="button" class="linkish" data-ed="${k}" title="עריכה">✎</button></div>`;
  };
  const rq = reqOf(a.data?.marital); const need = [...rq.gate, ...rq.rest];
  const ICON = { ok: '✅', bad: '⚠️', pending: '⏳', 'pending?': '⏳', '': '⬜' };
  const kl = (k) => kindLabel(k, a.taxYears, 'yi');
  const pool = a.files?.pool || [];
  const docsHtml = `<ul class="kr-need" style="grid-template-columns:1fr">${need.map((k) => { const st = kindState(a.files, k); return `<li class="st-${st.replace('?', '') || 'none'}">${ICON[st]} ${h(kl(k))}</li>`; }).join('')}</ul>
    ${pool.map((x, i) => { const st = x.check?.status || 'pending'; return `<div class="ka-doc kr-pf st-${st}"><div class="small"><button type="button" class="linkish" data-view=":${i}">👁 ${h(x.name)}</button> <span class="muted">${h(x.at)}</span></div>
      <div class="small">${ICON[st]} <b>${(x.kinds || []).length ? x.kinds.map((k) => h(kl(k))).join(' + ') : 'לא זוהה'}</b>${st === 'bad' && x.check?.en ? ` — <span class="rf-err">${h(x.check.en)}</span>` : ''}${x.check?.by ? ' <span class="muted">(ידני)</span>' : ''}</div>
      <div class="small kr-pf-a"><select data-fk="${i}"><option value="">סוג…</option>${ALL_KINDS.map((k) => `<option value="${k}"${(x.kinds || [])[0] === k ? ' selected' : ''}>${h(kl(k))}</option>`).join('')}</select>
        ${st !== 'ok' ? `<button type="button" class="btn small-btn" data-fs="${i}:ok">✓ תקין</button>` : `<button type="button" class="btn small-btn" data-fs="${i}:bad">✗ לא תקין</button>`}</div>
      <div data-img=":${i}"></div></div>`; }).join('') || '<p class="muted small">עדיין לא הועלו מסמכים.</p>'}`;
  const sigBox = (k, label) => ((a.files?.[k] || []).length ? `<div class="ka-doc"><b>${h(label)}</b> <button type="button" class="linkish" data-view="${k}:0">👁</button><div data-img="${k}:0"></div></div>` : '');
  const d = X.dialog(`<h2>טופס #${h(a.app_id)} — ${h(nm(a))} ${stBadge(a.status)}</h2>
    <p class="muted small" dir="ltr" style="text-align:right">${h(a.email)} · נפתח ${h(a.created_at)}${a.submitted_at ? ` · נשלח ${h(a.submitted_at)}` : ''} · עודכן ${h(a.updated_at)} (${h(a.updated_by)})</p>
    ${a.ai?.notes ? `<p class="rf-warn small">🤖 ${h(a.ai.notes)}</p>` : ''}
    <div class="ka-grid"><div class="ka-sec">
      ${SECTIONS.map((s) => `<h4>${h(s.yi)} · ${h(s.en)}</h4>${s.fields.filter((f) => fieldFor(f, a.data?.marital) && !f[4].print).map(rowHtml).join('')}`).join('')}
      <h4>חתימה</h4>
      <div class="ka-row"><span>Applicant</span><b>${(a.files?.sig_self || []).length ? '✓ חתם (ציור)' : h(a.data?.sig_self_name || '—')}</b><span></span></div>
      ${married() ? `<div class="ka-row"><span>Spouse</span><b>${(a.files?.sig_wife || []).length ? '✓ חתמה (ציור)' : h(a.data?.sig_wife_name || '—')}</b><span></span></div>` : ''}
      <h4>הערה פנימית</h4><textarea id="ka-note" rows="2" style="width:100%">${h(a.note || '')}</textarea>
    </div><div class="ka-docs"><h4 style="margin:0">📎 מסמכים</h4>${docsHtml}${sigBox('sig_self', 'חתימה')}${sigBox('sig_wife', 'חתימת האשה')}</div></div>
    <div class="actions">
      <button type="button" class="btn primary" id="ka-ok"${a.status === 'approved' ? ' disabled' : ''}>✓ אישור והוספה לאברכים</button>
      <select id="ka-st">${Object.entries(STATUS).map(([k, [t]]) => `<option value="${k}"${k === a.status ? ' selected' : ''}>${h(t)}</option>`).join('')}</select>
      <button type="button" class="btn" id="ka-print">🖨 הדפסה 8.5×11</button><label class="check small"><input type="checkbox" id="ka-pdocs"> כולל המסמכים</label>
      <button type="button" class="btn" id="ka-reset">🔑 קוד חדש</button>
      <span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`, 'ka-dlg');
  const imgs = {};
  const getImg = async (k, i) => { const key = `${k}:${i}`; if (!imgs[key]) imgs[key] = (await X.call(X.KEY, 'kaFile', { app_id: a.app_id, kind: k || '', i: Number(i) })).data; return imgs[key]; };
  const fileSet = async (i, body) => { try { const r = await X.call(X.KEY, 'kaFileSet', { app_id: a.app_id, i, ...body }); Object.assign(a, r.app); d.close(); openApp(a, after); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$$('[data-fk]', d).forEach((sel) => { sel.onchange = () => { if (sel.value) fileSet(Number(sel.dataset.fk), { kinds: [sel.value] }); }; });
  X.$$('[data-fs]', d).forEach((b) => { b.onclick = () => { const [i, st] = b.dataset.fs.split(':'); fileSet(Number(i), { status: st }); }; });
  X.$$('[data-view]', d).forEach((b) => { b.onclick = async () => {
    const [k, i] = b.dataset.view.split(':'); const slot = X.$(`[data-img="${k}:${i}"]`, d);
    slot.innerHTML = '<span class="muted small">טוען…</span>';
    try {
      const src = await getImg(k, i);
      if (/^data:image/.test(src)) { slot.innerHTML = `<img src="${src}" alt="">`; X.$('img', slot).onclick = () => { const z = document.createElement('div'); z.className = 'ka-zoom'; z.innerHTML = `<img src="${src}">`; z.onclick = () => z.remove(); d.append(z); }; }
      else { slot.innerHTML = ''; const w = window.open(); if (w) w.document.write(`<iframe src="${src}" style="border:0;width:100%;height:100%"></iframe>`); }
    } catch (err) { slot.innerHTML = `<span class="rf-err">${h(X.msg(err))}</span>`; }
  }; });
  // ✎ עריכה לכל שורה
  X.$$('[data-ed]', d).forEach((b) => { b.onclick = () => {
    const k = b.dataset.ed; const row = b.closest('.ka-row'); const f = SECTIONS.flatMap((s) => s.fields).find((x) => x[0] === k);
    const v = a.data?.[k] ?? ''; const type = f[3];
    const el = type === 'select' ? `<select>${['', ...f[4].opts.map((o) => o[0])].map((o) => `<option value="${o}"${o === v ? ' selected' : ''}>${h(o ? showVal(k, o) : '—')}</option>`).join('')}</select>`
      : type === 'yesno' ? `<select><option value=""></option>${YESNO.map((o) => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`
        : type === 'area' ? `<textarea rows="2">${h(v)}</textarea>` : `<input type="${type === 'date' ? 'date' : 'text'}" value="${h(v)}">`;
    row.querySelector('b').innerHTML = el; b.textContent = '💾';
    const inp = row.querySelector('input, select, textarea'); inp.focus();
    b.onclick = async () => {
      b.disabled = true;
      try { const r = await X.call(X.KEY, 'kaEdit', { app_id: a.app_id, data: { [k]: inp.value.trim() } }); Object.assign(a, r.app); row.outerHTML = rowHtml(f); d.close(); openApp(a, after); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); b.disabled = false; }
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter' && type !== 'area') { e.preventDefault(); b.click(); } };
  }; });
  X.$('#ka-note', d).onchange = async (e) => { try { await X.call(X.KEY, 'kaEdit', { app_id: a.app_id, data: {}, note: e.target.value }); a.note = e.target.value; X.toast('ההערה נשמרה.'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('#ka-st', d).onchange = async (e) => { try { await X.call(X.KEY, 'kaStatus', { app_id: a.app_id, status: e.target.value }); a.status = e.target.value; X.toast('הסטטוס עודכן.'); after(); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('#ka-reset', d).onclick = async () => {
    if (!window.confirm(`ליצור קוד חדש ל-${a.email}? הקוד הישן יפסיק לעבוד.`)) return;
    try { const r = await X.call(X.KEY, 'kaReset', { app_id: a.app_id }); X.dialog(`<h2>🔑 קוד חדש</h2><p>תגיד לאברך את הקוד (בטלפון). הוא נכנס עם האימייל <b dir="ltr">${h(a.email)}</b> והקוד:</p><p style="font-size:2em;font-weight:700;letter-spacing:4px;text-align:center" dir="ltr">${h(r.code)}</p><p class="muted small">הקוד לא נשמר בשום מקום שאפשר לראות אותו — רק כאן, עכשיו.</p>`); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$('#ka-print', d).onclick = async () => {
    const w = window.open('', '_blank'); if (!w) { X.toast('הדפדפן חסם חלון חדש.', 'err'); return; }
    w.document.write('<p style="font:16px Arial;padding:20px">Loading…</p>');
    const images = {};
    try {
      for (const k of ['sig_self', 'sig_wife']) if ((a.files?.[k] || []).length) images[k] = await getImg(k, a.files[k].length - 1);
      if (X.$('#ka-pdocs', d).checked) for (let i = 0; i < pool.length; i += 1) images[`${(pool[i].kinds || []).map((k) => kindLabel(k, a.taxYears)).join(' + ') || pool[i].name} #${i + 1}`] = await getImg('', i);
    } catch (err) { X.toast(X.msg(err), 'err'); }
    w.document.open(); w.document.write(printHtml(a, { images })); w.document.close();
  };
  X.$('#ka-ok', d).onclick = async () => {
    try {
      const r = await X.call(X.KEY, 'kaApprove', { app_id: a.app_id, dry: true });
      const m = r.matches || [];
      const pick = X.dialog(`<h2>✓ אישור — ${h(nm(a))}</h2><p>האברך ייכנס לרשימת האברכים של הכולל.${m.length ? ' נמצאו אנשי קשר דומים — אם זה אחד מהם, בחר אותו (כדי שלא יהיה כפול):' : ''}</p>
        ${m.map((x) => `<label class="check"><input type="radio" name="kc" value="${h(x.contact_id)}"> ${h(x.name || x.en || x.contact_id)} <span class="muted small" dir="ltr">${h(x.en || '')} · ${h(x.city || '')} #${h(x.contact_id)}</span></label>`).join('')}
        <label class="check"><input type="radio" name="kc" value="" checked> ➕ איש קשר חדש</label>
        <div class="actions"><button type="button" class="btn primary" id="kc-go">אישור</button><button type="button" class="btn" data-x>ביטול</button></div>`);
      X.$('#kc-go', pick).onclick = async () => {
        const cid = (X.$('[name=kc]:checked', pick) || {}).value || '';
        try { const r2 = await X.call(X.KEY, 'kaApprove', { app_id: a.app_id, contact_id: cid }); a.status = 'approved'; a.contact_id = r2.contact_id; pick.close(); d.close(); X.toast('אושר ונוסף לאברכים.'); await X.loadPeople(); after(); } catch (err) { X.toast(X.msg(err), 'err'); }
      };
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  void after;
}
