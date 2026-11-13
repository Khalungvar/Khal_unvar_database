// 🎓 מרכז הכוללים — College Programs: 📝 אפליקציות · 🟢 Active · 🤖 מזכיר AI.
//    אפליקציות: כרטיס לכל אברך (עריכה לכל שורה, מסמכים בתמונות קטנות), קישור לאיש קשר במאגר הכללי, הוספה לכולל,
//    ✉ שליחה במייל למשרד (עם המסמכים), 🖨 הדפסה, ✅ מעבר ל-Active.
import { SECTIONS, STATUS, showVal, printHtml, YESNO, reqOf, kindState, kindLabel, fieldFor, ALL_KINDS, appText } from './kollelfields.js?v=685';
import { downloadXlsx } from '../excel.js?v=653';

let X;
export const K = { apps: null, filter: 'all', q: '', view: 'apps', mail: null, thumbs: {} };
export function initKollel(ctx) { X = ctx; }

export async function loadApps() { const r = await X.call(X.KEY, 'kaList'); K.apps = r.apps || []; return K.apps; }
export const nm = (a) => `${a.data?.legal_first || ''} ${a.data?.legal_last || ''}`.trim();
export const yiNm = (a) => a.data?.yi_name || '';
export const anyNm = (a) => yiNm(a) || nm(a) || a.email || `#${a.app_id}`;
const stBadge = (s) => { const [t, c] = STATUS[s] || [s, '#777']; return `<span class="rg-st" style="--c:${c}">${X.h(t)}</span>`; };
const fmtDate = (s) => String(s || '').slice(0, 10);

// ---------- 🎓 הדף הראשי: שלושה כפתורים ----------
export async function renderKollelReg(box) {
  const { h } = X;
  const V = [['apps', '📝 Applications'], ['active', '🟢 Active'], ['ai', '🤖 מזכיר AI']];
  box.innerHTML = `<h2 class="ms-h">🎓 College Programs</h2>
    <div class="seg kp-views">${V.map(([k, t]) => `<button type="button" data-v="${k}" class="${K.view === k ? 'on' : ''}">${h(t)}</button>`).join('')}</div>
    <div id="kp-body"></div>`;
  X.$$('[data-v]', box).forEach((b) => { b.onclick = () => { K.view = b.dataset.v; renderKollelReg(box); }; });
  const body = X.$('#kp-body', box);
  if (K.view === 'apps') return renderApps(body);
  const m = await import('./kollelact.js?v=685');
  m.initAct(X);
  if (K.view === 'active') return m.renderActive(body);
  return m.renderAssist(body);
}

// ---------- 📝 רשימת האפליקציות ----------
const prog = (a) => (a.progress ? (a.progress.missing.length ? `חלק ב׳: ${a.progress.done}/${a.progress.total}` : '✔ חלק ב׳ מלא') : '');
function PH(a) {
  if (a.status === 'active') return ['🟢 Active', 'done'];
  if (a.status === 'finished') return ['⏹ הסתיים', 'none'];
  if (a.status === 'returned') return [`↩ הוחזר מ-Active · ${prog(a)}`, 'a'];
  if (a.status === 'approved') return ['✅ הושלם', 'done'];
  if (['submitted', 'updated'].includes(a.status)) return [`✔ חלק א׳ · ${prog(a)} · נשלח`, 'b'];
  if (a.status === 'open') return [`✔ חלק א׳ · ${prog(a)}`, 'a'];
  if (a.status === 'rejected') return ['נדחה', 'rej'];
  return ['— לא סיים חלק א׳', 'none'];
}
const lastSent = (a) => (a.sent || []).slice(-1)[0];
const linkBtn = (a) => (a.contact_id
  ? `<button type="button" class="ka-lk on" data-link="${X.h(a.app_id)}" title="מקושר לאיש קשר במאגר הכללי">👤 ${X.h(a.contact_name || `#${a.contact_id}`)}</button>`
  : `<button type="button" class="ka-lk" data-link="${X.h(a.app_id)}" title="קישור לאיש קשר במאגר הכללי">🔗 קשר</button>`);

export async function renderApps(box) {
  const { h } = X;
  if (!K.apps) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await loadApps(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  const link = new URL('register/', location.href.replace(/[^/]*$/, '')).href;
  const inAct = (a) => ['active', 'finished'].includes(a.status);
  const FL = [['all', 'הכל', (a) => a.status !== 'draft' && !inAct(a)], ['a', 'חלק א׳', (a) => a.status === 'open'], ['b', 'חלק ב׳ (נשלח)', (a) => ['submitted', 'updated'].includes(a.status)],
    ['ret', '↩ הוחזרו', (a) => a.status === 'returned'], ['act', 'ב-Active', inAct], ['draft', 'לא סיימו חלק א׳', (a) => a.status === 'draft']];
  const cnt = (f) => K.apps.filter(f).length;
  const fl = FL.find((x) => x[0] === K.filter) || FL[0];
  const q = K.q.trim().toLowerCase();
  const list = K.apps.filter(fl[2]).filter((a) => !q || `${nm(a)} ${yiNm(a)} ${a.email} ${a.data?.phone || ''} ${a.note || ''} ${a.contact_name || ''}`.toLowerCase().includes(q))
    .sort((a, b) => String(anyNm(a)).localeCompare(String(anyNm(b)), 'he'));
  box.innerHTML = `<p class="muted small">הטופס לאברכים: <a href="${h(link)}" target="_blank" rel="noopener" dir="ltr">${h(link)}</a></p>
    <div class="ms-bar"><div class="seg">${FL.map(([k, t, f]) => `<button type="button" data-f="${k}" class="${k === fl[0] ? 'on' : ''}">${h(t)} ${cnt(f)}</button>`).join('')}</div>
      <input type="search" id="ka-q" placeholder="חיפוש…" value="${h(K.q)}"><span class="spacer"></span>
      <button type="button" class="btn" id="ka-xl">⬇ Excel</button><button type="button" class="btn" id="ka-mcfg">⚙ הגדרות מייל</button><button type="button" class="btn" id="ka-rl">⟳ רענון</button></div>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table ka-list"><thead><tr><th>#</th><th>נאמען (אידיש)</th><th>Legal name</th><th>סטטוס</th><th>הערה</th></tr></thead><tbody>
      ${list.map((a, i) => { const ls = lastSent(a); return `<tr><td class="num">${i + 1}</td>
        <td><button type="button" class="linkish ka-nm" data-open="${h(a.app_id)}" dir="rtl">${h(yiNm(a) || '—')}</button>${a.origin === 'office' ? ' <span class="ka-tag">🏢 נפתח במשרד</span>' : ''}</td>
        <td dir="ltr" style="text-align:right"><button type="button" class="linkish" data-open="${h(a.app_id)}">${h(nm(a) || a.email || '—')}</button></td>
        <td><span class="ka-ph ka-${PH(a)[1]}">${h(PH(a)[0])}</span> ${linkBtn(a)}${ls ? `<div class="small ka-sent">✉ נשלח למשרד ${h(fmtDate(ls.at))}</div>` : ''}</td>
        <td class="small">${h(a.note || '')}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="ms-note">אין אפליקציות כאן.</p>'}`;
  X.$$('[data-f]', box).forEach((b) => { b.onclick = () => { K.filter = b.dataset.f; renderApps(box); }; });
  const qi = X.$('#ka-q', box); qi.oninput = () => { K.q = qi.value; clearTimeout(K.t); K.t = setTimeout(() => { renderApps(box); const x = X.$('#ka-q', box); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 300); };
  X.$('#ka-rl', box).onclick = () => { K.apps = null; renderApps(box); };
  X.$('#ka-mcfg', box).onclick = () => mailCfgDialog();
  X.$('#ka-xl', box).onclick = () => {
    const fs = SECTIONS.flatMap((s) => s.fields);
    downloadXlsx('College Programs — אפליקציות', ['#', 'סטטוס', 'אימייל', 'איש קשר', ...fs.map((f) => f[1])], list.map((a) => [a.app_id, (STATUS[a.status] || [a.status])[0], a.email, a.contact_name || '', ...fs.map((f) => showVal(f[0], a.data?.[f[0]]))]), { rtl: true });
  };
  const after = () => renderApps(box);
  X.$$('[data-open]', box).forEach((b) => { b.onclick = () => openApp(K.apps.find((a) => String(a.app_id) === b.dataset.open), after); });
  X.$$('[data-link]', box).forEach((b) => { b.onclick = () => linkDialog(K.apps.find((a) => String(a.app_id) === b.dataset.link), after); });
}

// ---------- קבצים ----------
const fileCache = {};
export async function getFile(a, k, i) {
  const key = `${a.app_id}|${k}:${i}`;
  if (!fileCache[key]) fileCache[key] = (await X.call(X.KEY, 'kaFile', { app_id: a.app_id, kind: k || '', i: Number(i) })).data;
  return fileCache[key];
}
/** פתיחת קובץ: תמונה — בגודל מלא; PDF — בכרטיסייה חדשה */
export async function showFile(getter, isPdf) {
  const w = isPdf ? window.open('', '_blank') : null;
  if (w) w.document.write('<p style="font:16px Arial;padding:20px">Loading…</p>');
  try {
    const src = await getter();
    if (/^data:image/.test(src)) {
      if (w) w.close();
      const z = document.createElement('div'); z.className = 'ka-zoom'; z.innerHTML = `<img src="${src}" alt=""><span>✕</span>`; z.onclick = () => z.remove();
      (document.querySelector('dialog[open]:last-of-type') || document.body).append(z);
    } else {
      const blob = await (await fetch(src)).blob();
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url; else window.open(url, '_blank');
    }
  } catch (err) { if (w) w.close(); X.toast(X.msg(err), 'err'); }
}
async function thumbsOf(a) {
  const key = `${a.app_id}|${(a.files?.pool || []).length}|${(a.files?.pool || []).map((x) => x.at).join()}`;
  if (!K.thumbs[key]) K.thumbs[key] = X.call(X.KEY, 'kaThumbs', { app_id: a.app_id }).catch(() => ({ pool: [] }));
  return K.thumbs[key];
}

// ---------- 📇 כרטיס האפליקציה ----------
export function openApp(a, after = () => {}) {
  if (!a) return;
  const { h } = X;
  const married = () => a.data?.marital === 'married';
  const aiF = a.ai?.fields || {};
  const fRow = (f) => {
    const [k, en, yi, , o] = f; const v = a.data?.[k] ?? '';
    return `<div class="ka-f${aiF[k] && aiF[k] === v ? ' ai' : ''}${o.wide || f[3] === 'area' ? ' w' : ''}" data-k="${k}"><span>${h(en)} <small>${h(yi)}</small></span>
      <div class="ka-v"><b${o.rtl ? ' dir="rtl"' : ' dir="ltr"'}>${h(showVal(k, v)) || '<i class="muted">—</i>'}</b><button type="button" class="linkish" data-ed="${k}" title="עריכה">✎</button></div></div>`;
  };
  const rq = reqOf(a.data?.marital); const need = [...rq.gate, ...rq.rest];
  const ICON = { ok: '✅', bad: '⚠️', pending: '⏳', 'pending?': '⏳', '': '⬜' };
  const kl = (k) => kindLabel(k, a.taxYears, 'yi');
  const pool = a.files?.pool || [];
  const ls = lastSent(a);
  const sigs = [['sig_self', 'חתימה'], ...(married() ? [['sig_wife', 'חתימת האשה']] : [])].filter(([k]) => (a.files?.[k] || []).length);
  const docsHtml = `<div class="ka-need">${need.map((k) => { const st = kindState(a.files, k); return `<span class="ka-chip st-${st.replace('?', '') || 'none'}">${ICON[st]} ${h(kl(k))}</span>`; }).join('')}</div>
    ${pool.length || sigs.length ? `<div class="ka-thumbs">${pool.map((x, i) => { const st = x.check?.status || 'pending'; const pdf = /pdf/.test(x.type || x.name);
      return `<div class="ka-th st-${st}"><button type="button" class="ka-th-img" data-view=":${i}" data-pdf="${pdf ? 1 : ''}" title="פתיחה"><span data-th="${i}">${pdf ? '📄 PDF' : '🖼'}</span></button>
        <div class="small"><b>${ICON[st]} ${(x.kinds || []).length ? x.kinds.map((k) => h(kl(k))).join(' + ') : 'לא זוהה'}</b>${x.check?.by ? ' <span class="muted">(ידני)</span>' : ''}</div>
        ${st === 'bad' && x.check?.en ? `<div class="small rf-err">${h(x.check.en)}</div>` : ''}
        <div class="small muted" title="${h(x.name)}">${h(x.name)} · ${h(fmtDate(x.at))}</div>
        <div class="ka-th-a"><select data-fk="${i}" title="סוג המסמך"><option value="">סוג…</option>${ALL_KINDS.map((k) => `<option value="${k}"${(x.kinds || [])[0] === k ? ' selected' : ''}>${h(kl(k))}</option>`).join('')}</select>
          ${st !== 'ok' ? `<button type="button" class="btn small-btn" data-fs="${i}:ok">✓ תקין</button>` : `<button type="button" class="btn small-btn" data-fs="${i}:bad">✗ לא תקין</button>`}</div></div>`; }).join('')}
      ${sigs.map(([k, t]) => `<div class="ka-th"><button type="button" class="ka-th-img" data-view="${k}:0" title="פתיחה"><span data-ths="${k}">✍</span></button><div class="small"><b>${h(t)}</b></div></div>`).join('')}</div>` : '<p class="muted small">עדיין לא הועלו מסמכים.</p>'}`;
  const missTxt = (m) => (m === 'sig' ? 'חתימה' : m.startsWith('d:') ? kindLabel(m.slice(2), a.taxYears, 'yi') : (SECTIONS.flatMap((x) => x.fields).find((f) => f[0] === m.slice(2)) || [0, m])[1]);
  const d = X.dialog(`<h2>#${h(a.app_id)} — <span dir="rtl">${h(yiNm(a))}</span>${yiNm(a) && nm(a) ? ' · ' : ''}<span dir="ltr">${h(nm(a))}</span> ${stBadge(a.status)}</h2>
    <p class="muted small" dir="ltr" style="text-align:right">${h(a.email || 'אין אימייל')} · נפתח ${h(a.created_at)}${a.submitted_at ? ` · נשלח ${h(a.submitted_at)}` : ''} · עודכן ${h(a.updated_at)} (${h(a.updated_by)})${a.origin === 'office' ? ' · 🏢 נפתח במשרד' : ''}</p>
    <div class="ka-top">${linkBtn(a)}
      <button type="button" class="btn" id="ka-kol">🔗 הוספה לכולל</button>
      <button type="button" class="btn" id="ka-mail">✉ שליחה במייל</button>
      <button type="button" class="btn" id="ka-print">🖨 הדפסה</button>
      <button type="button" class="btn" id="ka-reset">🔑 ${a.email ? 'קוד חדש' : 'אימייל + קוד לאברך'}</button></div>
    ${ls ? `<p class="small ka-sent">✉ נשלח למשרד ${h(ls.at)} (${h((ls.to || []).join(', '))}${ls.parts > 1 ? ` · ${ls.parts} מיילים` : ''}) — ${h(ls.by)}</p>` : ''}
    ${a.progress?.missing?.length ? `<p class="rf-warn small"><b>חסר עדיין (${a.progress.done}/${a.progress.total}):</b> ${a.progress.missing.map((m) => h(missTxt(m))).join(' · ')}</p>` : (a.progress ? '<p class="rf-par small"><b>✔ הכל מולא</b></p>' : '')}
    ${a.ai?.notes ? `<p class="rf-warn small">🤖 ${h(a.ai.notes)}</p>` : ''}
    <div class="ka-secs">
      ${SECTIONS.map((s) => `<h4>${h(s.yi)} · ${h(s.en)}</h4><div class="ka-fields">${s.fields.filter((f) => fieldFor(f, a.data?.marital) && !f[4].print).map(fRow).join('')}</div>`).join('')}
      <h4>חתימה · Signature</h4><div class="ka-fields">
        <div class="ka-f"><span>Applicant</span><div class="ka-v"><b>${(a.files?.sig_self || []).length ? '✓ חתם (ציור)' : h(a.data?.sig_self_name || '—')}</b></div></div>
        ${married() ? `<div class="ka-f"><span>Spouse</span><div class="ka-v"><b>${(a.files?.sig_wife || []).length ? '✓ חתמה (ציור)' : h(a.data?.sig_wife_name || '—')}</b></div></div>` : ''}</div>
      <h4>הערה פנימית</h4><textarea id="ka-note" rows="2" style="width:100%">${h(a.note || '')}</textarea>
      <h4>📎 מסמכים <span class="muted small">(לחיצה על מסמך — פתיחה)</span></h4>${docsHtml}
    </div>
    <div class="actions">
      ${a.status === 'active' ? '<span class="ka-ph ka-done">🟢 ב-Active</span>' : `<button type="button" class="btn primary" id="ka-act">✅ Active</button>`}
      <label class="small">סטטוס <select id="ka-st">${Object.entries(STATUS).map(([k, [t]]) => `<option value="${k}"${k === a.status ? ' selected' : ''}>${h(t)}</option>`).join('')}</select></label>
      <span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`, 'ka-dlg');
  const reopen = () => { d.close(); openApp(a, after); };
  // 🖼 תמונות קטנות
  thumbsOf(a).then((t) => {
    (t.pool || []).forEach((src, i) => { const el = X.$(`[data-th="${i}"]`, d); if (el && src) el.outerHTML = `<img src="${src}" alt="">`; });
    ['sig_self', 'sig_wife'].forEach((k) => { const src = (t[k] || []).slice(-1)[0]; const el = X.$(`[data-ths="${k}"]`, d); if (el && src) el.outerHTML = `<img src="${src}" alt="">`; });
  });
  X.$$('[data-view]', d).forEach((b) => { b.onclick = () => { const [k, i] = b.dataset.view.split(':'); showFile(() => getFile(a, k, i), !!b.dataset.pdf); }; });
  const fileSet = async (i, body) => { try { const r = await X.call(X.KEY, 'kaFileSet', { app_id: a.app_id, i, ...body }); Object.assign(a, r.app); reopen(); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$$('[data-fk]', d).forEach((sel) => { sel.onchange = () => { if (sel.value) fileSet(Number(sel.dataset.fk), { kinds: [sel.value] }); }; });
  X.$$('[data-fs]', d).forEach((b) => { b.onclick = () => { const [i, st] = b.dataset.fs.split(':'); fileSet(Number(i), { status: st }); }; });
  // ✎ עריכה לכל שורה
  X.$$('[data-ed]', d).forEach((b) => { b.onclick = () => {
    const k = b.dataset.ed; const row = b.closest('.ka-f'); const f = SECTIONS.flatMap((s) => s.fields).find((x) => x[0] === k);
    const v = a.data?.[k] ?? ''; const type = f[3];
    const el = type === 'select' ? `<select>${['', ...f[4].opts.map((o) => o[0])].map((o) => `<option value="${o}"${o === v ? ' selected' : ''}>${h(o ? showVal(k, o) : '—')}</option>`).join('')}</select>`
      : type === 'yesno' ? `<select><option value=""></option>${YESNO.map((o) => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`
        : type === 'area' ? `<textarea rows="3">${h(v)}</textarea>` : `<input type="${type === 'date' ? 'date' : 'text'}" value="${h(v)}"${f[4].rtl ? ' dir="rtl"' : ' dir="ltr"'}>`;
    row.querySelector('b').innerHTML = el; b.textContent = '💾';
    const inp = row.querySelector('input, select, textarea'); inp.focus();
    b.onclick = async () => {
      b.disabled = true;
      try { const r = await X.call(X.KEY, 'kaEdit', { app_id: a.app_id, data: { [k]: inp.value.trim() } }); Object.assign(a, r.app); reopen(); X.toast('נשמר.'); after(); } catch (err) { X.toast(X.msg(err), 'err'); b.disabled = false; }
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter' && type !== 'area') { e.preventDefault(); b.click(); } };
  }; });
  X.$('#ka-note', d).onchange = async (e) => { try { await X.call(X.KEY, 'kaEdit', { app_id: a.app_id, data: {}, note: e.target.value }); a.note = e.target.value; X.toast('ההערה נשמרה.'); after(); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('#ka-st', d).onchange = async (e) => { try { await X.call(X.KEY, 'kaStatus', { app_id: a.app_id, status: e.target.value }); a.status = e.target.value; X.toast('הסטטוס עודכן.'); after(); } catch (err) { X.toast(X.msg(err), 'err'); } };
  X.$('[data-link]', d).onclick = () => linkDialog(a, () => { reopen(); after(); });
  X.$('#ka-kol', d).onclick = () => kollelDialog(a, () => { reopen(); after(); });
  X.$('#ka-mail', d).onclick = () => mailDialog(a, () => { reopen(); after(); });
  X.$('#ka-print', d).onclick = () => printDialog(a);
  X.$('#ka-reset', d).onclick = () => codeDialog(a, () => { reopen(); after(); });
  X.$('#ka-act', d)?.addEventListener('click', () => activateDialog(a, () => { d.close(); after(); }));
}

// ---------- 🔗 קישור לאיש קשר במאגר הכללי ----------
export async function linkDialog(a, after = () => {}) {
  const { h } = X;
  const d = X.dialog(`<h2>🔗 איש קשר במאגר הכללי — ${h(anyNm(a))}</h2><div id="kl-body"><p class="muted">מחפש אנשי קשר דומים…</p></div>`, 'ms-wide');
  const body = X.$('#kl-body', d);
  const show = async (q = '') => {
    let r;
    try { r = await X.call(X.KEY, 'kaLinkFind', { app_id: a.app_id, q }); } catch (err) { body.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
    const cur = a.contact_id ? `<p class="rf-par">👤 מקושר ל: <b>${h(a.contact_name || '')}</b> <span class="muted">#${h(a.contact_id)}</span>
        <button type="button" class="btn small-btn" id="kl-open">פתיחת איש הקשר</button> <button type="button" class="btn small-btn" id="kl-un">✗ ביטול קישור</button></p><p class="muted small">אפשר גם לקשר מחדש לאיש קשר אחר:</p>` : '';
    const d0 = a.data || {};
    body.innerHTML = `${cur}
      <p class="small muted">חיפוש לפי: שם אידיש <b>${h(d0.yi_name || '—')}</b> · שם אנגלי <b dir="ltr">${h(nm(a) || '—')}</b> · טלפון <b dir="ltr">${h(d0.phone || '—')}</b></p>
      ${(r.matches || []).length ? `<div class="kl-ms">${r.matches.map((x) => `<label class="check kl-m"><input type="radio" name="kc" value="${h(x.contact_id)}"${String(x.contact_id) === String(a.contact_id) ? ' checked' : ''}>
        <span><b>${h(x.name || x.en || x.contact_id)}</b> <span dir="ltr">${h(x.en || '')}</span> <span class="muted small">${h(x.city || '')} · #${h(x.contact_id)} · נמצא לפי ${h(x.why || '')}</span></span></label>`).join('')}</div>`
    : '<p class="ms-note">לא נמצאו אנשי קשר דומים.</p>'}
      <div class="ms-bar"><input type="search" id="kl-q" placeholder="חיפוש נוסף בשם / טלפון…" value="${h(q)}"><button type="button" class="btn" id="kl-s">🔎 חיפוש</button></div>
      <div class="actions"><button type="button" class="btn primary" id="kl-go"${(r.matches || []).length ? '' : ' disabled'}>🔗 קישור לאיש הקשר שנבחר</button>
        ${a.contact_id ? '' : '<button type="button" class="btn" id="kl-new">➕ איש קשר חדש במאגר הכללי</button>'}<span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`;
    X.$$('[data-x]', body).forEach((b) => { b.onclick = () => d.close(); });
    X.$('#kl-s', body).onclick = () => show(X.$('#kl-q', body).value.trim());
    X.$('#kl-q', body).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); show(e.target.value.trim()); } };
    X.$('#kl-go', body).onclick = async (e) => {
      const cid = (X.$('[name=kc]:checked', body) || {}).value; if (!cid) { X.toast('בחר איש קשר.', 'err'); return; }
      e.target.disabled = true;
      try { const r2 = await X.call(X.KEY, 'kaLink', { app_id: a.app_id, contact_id: cid }); Object.assign(a, r2.app); d.close(); X.toast('קושר לאיש הקשר.'); X.loadPeople?.().catch?.(() => {}); after(); } catch (err) { X.toast(X.msg(err), 'err'); e.target.disabled = false; }
    };
    X.$('#kl-new', body)?.addEventListener('click', async (e) => {
      if (!window.confirm(`ליצור איש קשר חדש במאגר הכללי עם כל הפרטים?\n${d0.yi_name || ''} · ${nm(a)} · ${d0.phone || ''} · ${d0.address || ''} ${d0.city || ''}`)) return;
      e.target.disabled = true;
      try { const r2 = await X.call(X.KEY, 'kaLinkNew', { app_id: a.app_id }); Object.assign(a, r2.app); d.close(); X.toast('נוצר איש קשר חדש וקושר.'); X.loadPeople?.().catch?.(() => {}); after(); } catch (err) { X.toast(X.msg(err), 'err'); e.target.disabled = false; }
    });
    X.$('#kl-un', body)?.addEventListener('click', async () => {
      if (!window.confirm('לבטל את הקישור? (איש הקשר נשאר במאגר הכללי)')) return;
      try { const r2 = await X.call(X.KEY, 'kaUnlink', { app_id: a.app_id }); Object.assign(a, r2.app); d.close(); X.toast('הקישור בוטל.'); after(); } catch (err) { X.toast(X.msg(err), 'err'); }
    });
    X.$('#kl-open', body)?.addEventListener('click', () => { const p = X.pById?.(a.contact_id); if (p) X.personDialog(p); else X.toast('איש הקשר עוד לא נטען — רענן את הדף.', 'err'); });
  };
  show();
}

// ---------- 🔗 הוספה לכולל (בלי לסיים) ----------
async function kollelDialog(a, after) {
  const { h } = X;
  if (!a.contact_id) { X.toast(X.msg({ code: 'ka-need-link' }), 'err'); linkDialog(a, after); return; }
  let r;
  try { r = await X.call(X.KEY, 'klGet', {}); } catch (err) { X.toast(X.msg(err), 'err'); return; }
  const ks = (r.kollelim || []).filter((k) => k.active !== 'FALSE');
  const mine = (r.members || []).filter((m) => String(m.contact_id) === String(a.contact_id) && !m.end_date).map((m) => m.kollel_id);
  const kName = (id) => (ks.find((k) => String(k.kollel_id) === String(id)) || {}).name || `#${id}`;
  const d = X.dialog(`<h2>🔗 הוספה לכולל — ${h(anyNm(a))}</h2>
    <p class="muted small">האברך נכנס לרשימת האברכים של הכולל (השתתפות ומלגות). האפליקציה לא נסגרת.</p>
    ${mine.length ? `<p class="rf-par small">כבר בכולל: <b>${mine.map((x) => h(kName(x))).join(', ')}</b></p>` : ''}
    ${ks.length ? `<div class="rf-grid"><label class="rf-f">כולל<select id="kk-k">${ks.map((k) => `<option value="${h(k.kollel_id)}"${mine.includes(k.kollel_id) ? ' disabled' : ''}>${h(k.name)}${k.location ? ` · ${h(k.location)}` : ''}</option>`).join('')}</select></label>
      <label class="rf-f">מתאריך<input type="date" id="kk-d" value="${new Date().toISOString().slice(0, 10)}"></label></div>` : '<p class="ms-note">עדיין אין כוללים — מוסיפים ב"🕍 כוללים".</p>'}
    <div class="actions"><button type="button" class="btn primary" id="kk-go"${ks.length ? '' : ' disabled'}>🔗 הוספה</button><button type="button" class="btn" data-x>ביטול</button></div>`);
  X.$('#kk-go', d).onclick = async (e) => {
    e.target.disabled = true;
    try { await X.call(X.KEY, 'kaToKollel', { app_id: a.app_id, kollel_id: X.$('#kk-k', d).value, start_date: X.$('#kk-d', d).value }); d.close(); X.toast(`נוסף ל${kName(X.$('#kk-k', d)?.value || '')}.`); after(); } catch (err) { X.toast(X.msg(err), 'err'); e.target.disabled = false; }
  };
}

// ---------- 🔑 אימייל + קוד ----------
function codeDialog(a, after) {
  const { h } = X;
  const d = X.dialog(`<h2>🔑 קוד כניסה לאברך</h2>
    <p class="muted small">האברך נכנס לטופס עם האימייל והקוד, וממשיך למלא / לתקן. הקוד הישן יפסיק לעבוד.</p>
    <label class="rf-f">אימייל של האברך<input type="email" id="kc-em" dir="ltr" value="${h(a.email || '')}" placeholder="name@gmail.com"></label>
    <div class="actions"><button type="button" class="btn primary" id="kc-go">יצירת קוד חדש</button><button type="button" class="btn" data-x>ביטול</button></div>`);
  X.$('#kc-go', d).onclick = async (e) => {
    const em = X.$('#kc-em', d).value.trim();
    e.target.disabled = true;
    try {
      const r = await X.call(X.KEY, 'kaReset', { app_id: a.app_id, email: em });
      a.email = em || a.email;
      d.innerHTML = `<h2>🔑 קוד חדש</h2><p>תגיד לאברך (בטלפון): נכנסים ב-<b dir="ltr">ungvar.org/kollel/register</b> עם האימייל <b dir="ltr">${h(a.email)}</b> והקוד:</p>
        <p style="font-size:2em;font-weight:700;letter-spacing:4px;text-align:center" dir="ltr">${h(r.code)}</p><p class="muted small">הקוד לא נשמר בשום מקום שאפשר לראות אותו — רק כאן, עכשיו.</p>
        <div class="actions"><button type="button" class="btn" id="kc-x">סגירה</button></div>`;
      X.$('#kc-x', d).onclick = () => { d.close(); after(); };
    } catch (err) { X.toast(X.msg(err), 'err'); e.target.disabled = false; }
  };
}

// ---------- 🖨 הדפסה: שאלה לפני ----------
function printDialog(a) {
  const d = X.dialog(`<h2>🖨 הדפסה 8.5×11</h2><p>מה להדפיס?</p>
    <div class="ka-pchoice"><button type="button" class="btn" data-p="0">📄 רק הטופס</button><button type="button" class="btn primary" data-p="1">📄 + 📎 הטופס + כל המסמכים</button></div>
    <div class="actions"><button type="button" class="btn" data-x>ביטול</button></div>`);
  X.$$('[data-p]', d).forEach((b) => { b.onclick = () => { d.close(); doPrint(a, b.dataset.p === '1'); }; });
}
async function doPrint(a, withDocs) {
  const w = window.open('', '_blank'); if (!w) { X.toast('הדפדפן חסם חלון חדש.', 'err'); return; }
  w.document.write('<p style="font:16px Arial;padding:20px">Loading…</p>');
  const images = {}; const pool = a.files?.pool || [];
  try {
    for (const k of ['sig_self', 'sig_wife']) if ((a.files?.[k] || []).length) images[k] = await getFile(a, k, a.files[k].length - 1);
    if (withDocs) for (let i = 0; i < pool.length; i += 1) images[`${(pool[i].kinds || []).map((k) => kindLabel(k, a.taxYears)).join(' + ') || pool[i].name} #${i + 1}`] = await getFile(a, '', i);
  } catch (err) { X.toast(X.msg(err), 'err'); }
  w.document.open(); w.document.write(printHtml(a, { images })); w.document.close();
}

// ---------- ✉ שליחה במייל למשרד ----------
export async function mailCfg() {
  if (!K.mail) K.mail = (await X.call(X.KEY, 'kaMailCfg', {})).cfg || { to: [], from: 'me', office: 'office@ungvar.org' };
  return K.mail;
}
function mailCfgDialog() {
  const { h } = X;
  mailCfg().then((c) => {
    const rows = (c.to || []).length ? c.to : [{ email: '', name: '', def: true }];
    const rowH = (x, i) => `<div class="km-row"><input type="email" dir="ltr" data-me="${i}" value="${h(x.email)}" placeholder="office@example.com"><input data-mn="${i}" value="${h(x.name || '')}" placeholder="שם (לא חובה)">
      <label class="check small"><input type="checkbox" data-md="${i}"${x.def ? ' checked' : ''}> ברירת מחדל</label><button type="button" class="linkish" data-mx="${i}" title="מחיקה">🗑</button></div>`;
    const d = X.dialog(`<h2>⚙ הגדרות מייל</h2>
      <h4>📬 המשרד — למי שולחים</h4><p class="muted small">"ברירת מחדל" = מסומן מראש בכל שליחה. בכל שליחה אפשר לשנות ולהוסיף.</p>
      <div id="km-rows">${rows.map(rowH).join('')}</div><button type="button" class="btn small-btn" id="km-add">➕ עוד מייל</button>
      <h4>✉ ממי שולחים (ברירת מחדל)</h4>
      <label class="check"><input type="radio" name="km-from" value="me"${c.from !== 'office' ? ' checked' : ''}> מהחשבון שלי (מי שנכנס לאתר)</label>
      <label class="check"><input type="radio" name="km-from" value="office"${c.from === 'office' ? ' checked' : ''}> מהמשרד: <input id="km-off" dir="ltr" value="${h(c.office || 'office@ungvar.org')}" style="width:16em"></label>
      <p class="muted small">שליחה "מהמשרד" יוצאת בשם הכתובת הזו רק אם היא מוגדרת אצל השולח ב-Gmail כ"שליחת דואר בתור" (Send mail as). אחרת — המייל יוצא מהחשבון של השולח.</p>
      <div class="actions"><button type="button" class="btn primary" id="km-save">💾 שמירה</button><button type="button" class="btn" data-x>ביטול</button></div>`);
    const read = () => X.$$('[data-me]', d).map((el) => { const i = el.dataset.me; return { email: el.value.trim(), name: X.$(`[data-mn="${i}"]`, d).value.trim(), def: X.$(`[data-md="${i}"]`, d).checked }; }).filter((x) => x.email);
    const redraw = (list) => { X.$('#km-rows', d).innerHTML = list.map(rowH).join(''); wireX(); };
    const wireX = () => X.$$('[data-mx]', d).forEach((b) => { b.onclick = () => { const l = read(); l.splice(Number(b.dataset.mx), 1); redraw(l.length ? l : [{ email: '', def: true }]); }; });
    wireX();
    X.$('#km-add', d).onclick = () => redraw([...read(), { email: '', name: '', def: false }]);
    X.$('#km-save', d).onclick = async () => {
      try { const r = await X.call(X.KEY, 'kaMailCfg', { cfg: { to: read(), from: (X.$('[name=km-from]:checked', d) || {}).value, office: X.$('#km-off', d).value.trim() } }); K.mail = r.cfg; d.close(); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
    };
  }).catch((err) => X.toast(X.msg(err), 'err'));
}

const utf8 = (t) => new TextEncoder().encode(t);
function b64(u8) { let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(bin); }
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const encH = (t) => (/^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64(utf8(t))}?=`);
function buildMime({ from, to, subject, body, atts }) {
  const bd = `ka_${Math.random().toString(36).slice(2)}`;
  let m = `${from ? `From: ${from}\r\n` : ''}To: ${to.join(', ')}\r\nSubject: ${encH(subject)}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${bd}"\r\n\r\n`;
  m += `--${bd}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(utf8(body)))}`;
  atts.forEach((x) => { m += `--${bd}\r\nContent-Type: ${x.type}; name="${encH(x.name)}"\r\nContent-Disposition: attachment; filename="${encH(x.name)}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(x.b64)}`; });
  return `${m}--${bd}--\r\n`;
}
const safeName = (t) => String(t).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const extOf = (type) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'text/html': 'html' }[type] || 'bin');
const MB = (n) => `${(n / 1048576).toFixed(1)}MB`;

async function mailDialog(a, after) {
  const { h } = X;
  let c; try { c = await mailCfg(); } catch (err) { X.toast(X.msg(err), 'err'); return; }
  const me = X.myEmail?.() || '';
  const pool = a.files?.pool || [];
  const name = nm(a) || anyNm(a);
  const attL = [{ id: 'form', label: '📄 הטופס (HTML להדפסה, עם החתימה)', on: true },
    ...pool.map((x, i) => ({ id: `p${i}`, label: `${(x.kinds || []).length ? x.kinds.map((k) => kindLabel(k, a.taxYears)).join(' + ') : x.name} ${x.check?.status === 'ok' ? '' : x.check?.status === 'bad' ? '⚠️' : '⏳'}`, on: x.check?.status !== 'bad' }))];
  const d = X.dialog(`<h2>✉ שליחה במייל — ${h(anyNm(a))}</h2>
    <div class="km-g">
      <span>ממי</span><div><label class="check"><input type="radio" name="kmf" value="me"${c.from !== 'office' ? ' checked' : ''}> החשבון שלי <span dir="ltr" class="muted">${h(me)}</span></label>
        <label class="check"><input type="radio" name="kmf" value="office"${c.from === 'office' ? ' checked' : ''}> <span dir="ltr">${h(c.office || 'office@ungvar.org')}</span></label></div>
      <span>למי</span><div>${(c.to || []).map((x, i) => `<label class="check"><input type="checkbox" data-to="${i}"${x.def ? ' checked' : ''}> <span dir="ltr">${h(x.email)}</span> ${x.name ? `<span class="muted small">${h(x.name)}</span>` : ''}</label>`).join('') || '<span class="muted small">אין מיילים שמורים — ⚙ הגדרות מייל.</span>'}
        <input id="km-more" dir="ltr" placeholder="עוד כתובות (מופרדות בפסיק)" style="width:100%"></div>
      <span>נושא</span><input id="km-sub" dir="ltr" value="${h(`Kollel Application – ${name}`)}">
      <span>תוכן</span><textarea id="km-body" rows="9" dir="ltr">${h(appText(a))}</textarea>
      <span>קבצים</span><div class="km-atts">${attL.map((x) => `<label class="check small"><input type="checkbox" data-att="${x.id}"${x.on ? ' checked' : ''}> ${h(x.label)}</label>`).join('')}
        <p class="muted small">מעל 25MB — נשלח בכמה מיילים (חלק 1/2, 2/2…), כדי שהמסמכים לא יצאו כקישור פתוח.</p></div>
    </div>
    <p class="small" id="km-msg"></p>
    <div class="actions"><button type="button" class="btn primary" id="km-send">✉ שליחה</button><button type="button" class="btn" data-x>ביטול</button></div>`, 'ms-wide');
  X.$('#km-send', d).onclick = async (e) => {
    const btn = e.target; const msgEl = X.$('#km-msg', d);
    const to = [...X.$$('[data-to]', d).filter((x) => x.checked).map((x) => c.to[Number(x.dataset.to)].email), ...X.$('#km-more', d).value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)];
    if (!to.length || to.some((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) { X.toast('חסרה כתובת / כתובת לא תקינה.', 'err'); return; }
    const fromOffice = (X.$('[name=kmf]:checked', d) || {}).value === 'office';
    const from = fromOffice ? `Khal Ungvar Office <${c.office || 'office@ungvar.org'}>` : '';
    const subject = X.$('#km-sub', d).value.trim() || `Kollel Application – ${name}`;
    const body = X.$('#km-body', d).value;
    btn.disabled = true;
    try {
      // 📎 מביאים את הקבצים
      const want = X.$$('[data-att]', d).filter((x) => x.checked).map((x) => x.dataset.att);
      const atts = [];
      for (const [n, id] of want.entries()) {
        msgEl.textContent = `⏳ מכין קבצים (${n + 1}/${want.length})…`;
        if (id === 'form') {
          const images = {};
          for (const k of ['sig_self', 'sig_wife']) if ((a.files?.[k] || []).length) images[k] = await getFile(a, k, a.files[k].length - 1);
          const html = printHtml(a, { images }).replace(/<script>[\s\S]*?<\/script>/, '');
          atts.push({ name: safeName(`Application - ${name}.html`), type: 'text/html', b64: b64(utf8(html)) });
        } else {
          const i = Number(id.slice(1)); const x = pool[i];
          const src = await getFile(a, '', i); const [head, data] = src.split(',');
          const type = (head.match(/^data:([^;]+)/) || [])[1] || 'application/octet-stream';
          atts.push({ name: safeName(`${String(i + 1).padStart(2, '0')} ${(x.kinds || []).map((k) => kindLabel(k, a.taxYears)).join(' + ') || x.name.replace(/\.[a-z0-9]+$/i, '')} - ${name}.${extOf(type)}`), type, b64: data });
        }
      }
      // ✂ חלוקה למיילים
      const split = (limit) => { const parts = [[]]; let sz = 0; atts.forEach((x) => { const s = x.b64.length * 0.75; if (sz + s > limit && parts[parts.length - 1].length) { parts.push([]); sz = 0; } parts[parts.length - 1].push(x); sz += s; }); return parts; };
      const send = async (limit) => {
        const parts = split(limit);
        for (const [n, p] of parts.entries()) {
          msgEl.textContent = `⏳ שולח${parts.length > 1 ? ` (${n + 1}/${parts.length})` : ''}…`;
          await X.gmailSend(buildMime({ from, to, subject: parts.length > 1 ? `${subject} (part ${n + 1}/${parts.length})` : subject, body: n ? `${subject} — part ${n + 1} of ${parts.length} (documents).` : body, atts: p }));
        }
        return parts.length;
      };
      let parts;
      try { parts = await send(18 * 1048576); } catch (err) { if (err instanceof TypeError) parts = await send(3.2 * 1048576); else throw err; }
      msgEl.textContent = '';
      const r = await X.call(X.KEY, 'kaSent', { app_id: a.app_id, to, from: fromOffice ? c.office : me, files: atts.length, parts });
      Object.assign(a, r.app);
      d.close(); X.toast(`נשלח ✓ (${atts.length} קבצים${parts > 1 ? `, ${parts} מיילים` : ''}, ${MB(atts.reduce((s, x) => s + x.b64.length * 0.75, 0))})`); after();
    } catch (err) { msgEl.innerHTML = `<span class="rf-err">${h(X.msg(err))}${err.detail ? ` — ${h(err.detail)}` : ''}</span>`; btn.disabled = false; }
  };
}

// ---------- ✅ Active (גם הפעלה מחדש) ----------
export function activateDialog(a, after = () => {}, prev = null) {
  const { h } = X;
  if (!a.contact_id) { X.toast(X.msg({ code: 'ka-need-link' }), 'err'); linkDialog(a, () => activateDialog(a, after, prev)); return; }
  const p = prev || {};
  const d = X.dialog(`<h2>✅ ${prev ? 'הפעלה מחדש — תקופה חדשה' : 'Active'} — ${h(anyNm(a))}</h2>
    <p class="muted small">${prev ? 'נפתחת תקופה חדשה; ההיסטוריה של התקופה הקודמת נשמרת.' : 'האפליקציה מסתיימת ועוברת ל-🟢 Active. אפשר למלא עכשיו או אחר כך.'}</p>
    <div class="rf-grid">
      <label class="rf-f">College<input id="ac-college" dir="ltr" value="${h(p.college || '')}"></label>
      <label class="rf-f">Program<input id="ac-program" dir="ltr" value="${h(p.program || '')}"></label>
      <label class="rf-f">Student ID<input id="ac-student_id" dir="ltr" value="${h(p.student_id || '')}"></label>
      <label class="rf-f">תאריך התחלה<input type="date" id="ac-start_date" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="rf-f">סיום צפוי<input type="date" id="ac-expected_end" value=""></label>
    </div>
    <div class="actions"><button type="button" class="btn primary" id="ac-go">✅ ${prev ? 'הפעלה מחדש' : 'העברה ל-Active'}</button><button type="button" class="btn" data-x>ביטול</button></div>`);
  X.$('#ac-go', d).onclick = async (e) => {
    const rec = {}; ['college', 'program', 'student_id', 'start_date', 'expected_end'].forEach((k) => { rec[k] = X.$(`#ac-${k}`, d).value.trim(); });
    e.target.disabled = true;
    try { const r = await X.call(X.KEY, 'kaActivate', { app_id: a.app_id, rec }); Object.assign(a, r.app); d.close(); X.toast('עבר ל-🟢 Active.'); after(r); } catch (err) { X.toast(X.msg(err), 'err'); e.target.disabled = false; }
  };
}
