// 🎓 College Programs — 🟢 Active (תוכנית, FAFSA / TAP, פרסים לכל סמסטר, תשלומים, מכתבים ש-🤖 קורא, תזכורות)
//    ו-🤖 מזכיר AI (טקסט + סריקות → הצעה → ✓ לבצע).
import { K, loadApps, openApp, activateDialog, anyNm, nm, yiNm, showFile } from './kollel.js?v=668';
import { kindLabel, ALL_KINDS, SECTIONS } from './kollelfields.js?v=668';
import { downloadXlsx } from '../excel.js?v=653';

let X;
const A = { acts: null, filter: 'active', q: '' };
export function initAct(ctx) { X = ctx; }
async function loadActs() { const r = await X.call(X.KEY, 'kaActList', {}); A.acts = r.acts || []; return A.acts; }
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const appOf = (r) => (K.apps || []).find((a) => String(a.app_id) === String(r.app_id)) || { app_id: r.app_id, data: {} };
const ST = { active: ['🟢 פעיל', 'done'], inactive: ['↩ לא פעיל (הוחזר)', 'a'], expired: ['⏹ פג תוקף', 'none'] };

/** 🔔 תזכורות: חידוש FAFSA (מאוקטובר — לשנה הבאה), תוכנית שמסתיימת בקרוב */
export function remindersOf(r) {
  if (r.status !== 'active') return [];
  const out = []; const d = new Date(); const y = d.getFullYear(); const m = d.getMonth() + 1;
  const needY = m >= 10 ? y + 1 : y; // FAFSA לשנת הלימודים שמתחילה בסתיו needY נפתח ב-1 באוקטובר שלפני
  const have = parseInt(String(r.fafsa_year || ''), 10) || 0;
  if (have < needY) out.push(['fafsa', `חידוש FAFSA ${needY}-${String((needY + 1) % 100).padStart(2, '0')}`]);
  if (r.expected_end) {
    const days = Math.round((new Date(`${r.expected_end}T12:00:00`) - d) / 86400000);
    if (days < 0) out.push(['end', `התוכנית הייתה אמורה להסתיים ${r.expected_end}`]);
    else if (days <= 60) out.push(['end', `התוכנית מסתיימת בעוד ${days} ימים`]);
  }
  return out;
}
const sum = (l, k) => (l || []).reduce((s, x) => s + (Number(x[k]) || 0), 0);

// ---------- 🟢 רשימה ----------
export async function renderActive(box) {
  const { h } = X;
  if (!A.acts || !K.apps) {
    box.innerHTML = '<p class="muted">טוען…</p>';
    try { await Promise.all([A.acts ? 0 : loadActs(), K.apps ? 0 : loadApps()]); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; }
  }
  const FL = [['active', '🟢 פעילים', (r) => r.status === 'active'], ['inactive', '↩ לא פעילים', (r) => r.status === 'inactive'], ['expired', '⏹ הסתיימו', (r) => r.status === 'expired'], ['all', 'הכל', () => true]];
  const fl = FL.find((x) => x[0] === A.filter) || FL[0];
  const q = A.q.trim().toLowerCase();
  const list = A.acts.filter(fl[2]).filter((r) => { const a = appOf(r); return !q || `${anyNm(a)} ${nm(a)} ${r.college} ${r.program} ${r.student_id}`.toLowerCase().includes(q); })
    .sort((x, y) => String(anyNm(appOf(x))).localeCompare(String(anyNm(appOf(y))), 'he') || Number(y.act_id) - Number(x.act_id));
  const rem = A.acts.flatMap((r) => remindersOf(r).map((m) => [r, m]));
  box.innerHTML = `${rem.length ? `<div class="ka-rem"><b>🔔 תזכורות (${rem.length})</b>${rem.slice(0, 12).map(([r, [, t]]) => `<button type="button" class="linkish" data-act="${h(r.act_id)}">${h(anyNm(appOf(r)))} — ${h(t)}</button>`).join('')}${rem.length > 12 ? `<span class="muted small">ועוד ${rem.length - 12}…</span>` : ''}</div>` : ''}
    <div class="ms-bar"><div class="seg">${FL.map(([k, t, f]) => `<button type="button" data-f="${k}" class="${k === fl[0] ? 'on' : ''}">${h(t)} ${A.acts.filter(f).length}</button>`).join('')}</div>
      <input type="search" id="ac-q" placeholder="חיפוש…" value="${h(A.q)}"><span class="spacer"></span>
      <button type="button" class="btn" id="ac-xl">⬇ Excel</button><button type="button" class="btn" id="ac-rl">⟳ רענון</button></div>
    ${list.length ? `<div class="ms-wrap"><table class="ms-table ka-list"><thead><tr><th>#</th><th>נאמען</th><th>College / Program</th><th>תקופה</th><th>FAFSA</th><th>TAP</th><th>פרסים</th><th>שולם</th><th>סטטוס</th></tr></thead><tbody>
      ${list.map((r, i) => { const a = appOf(r); const rm = remindersOf(r);
        return `<tr><td class="num">${i + 1}</td><td><button type="button" class="linkish ka-nm" data-act="${h(r.act_id)}">${h(yiNm(a) || nm(a) || `#${r.app_id}`)}</button><div class="small muted" dir="ltr" style="text-align:right">${h(nm(a))}</div></td>
        <td dir="ltr" style="text-align:right">${h(r.college || '—')}<div class="small muted">${h(r.program || '')}</div></td>
        <td class="small">${h(r.start_date || '')} → ${h(r.end_date || r.expected_end || '')}</td>
        <td class="small">${r.fafsa === 'yes' ? `✔ ${h(r.fafsa_year)}` : r.fafsa === 'no' ? '✗' : '—'}</td><td class="small">${r.tap === 'yes' ? '✔' : r.tap === 'no' ? '✗' : '—'}</td>
        <td class="num">${money(sum(r.awards, 'pell') + sum(r.awards, 'tap') + sum(r.awards, 'other'))}</td><td class="num">${money(sum(r.payments, 'amount'))}</td>
        <td><span class="ka-ph ka-${(ST[r.status] || ['', 'none'])[1]}">${h((ST[r.status] || [r.status])[0])}</span>${rm.map(([, t]) => `<div class="small ka-remi">🔔 ${h(t)}</div>`).join('')}</td></tr>`; }).join('')}
    </tbody></table></div>` : `<p class="ms-note">${A.acts.length ? 'אין כאן רשומות.' : 'עדיין אין אף אחד ב-Active. ב-📝 Applications פותחים כרטיס ולוחצים "✅ Active".'}</p>`}`;
  X.$$('[data-f]', box).forEach((b) => { b.onclick = () => { A.filter = b.dataset.f; renderActive(box); }; });
  const qi = X.$('#ac-q', box); qi.oninput = () => { A.q = qi.value; clearTimeout(A.t); A.t = setTimeout(() => { renderActive(box); const x = X.$('#ac-q', box); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 300); };
  X.$('#ac-rl', box).onclick = () => { A.acts = null; K.apps = null; renderActive(box); };
  X.$('#ac-xl', box).onclick = () => downloadXlsx('College Programs — Active', ['#', 'נאמען', 'Legal name', 'College', 'Program', 'Student ID', 'Start', 'Expected end', 'End', 'FAFSA', 'FAFSA year', 'TAP', 'Pell', 'TAP $', 'Other', 'Paid', 'Status'],
    list.map((r) => { const a = appOf(r); return [r.act_id, yiNm(a), nm(a), r.college, r.program, r.student_id, r.start_date, r.expected_end, r.end_date, r.fafsa, r.fafsa_year, r.tap, sum(r.awards, 'pell'), sum(r.awards, 'tap'), sum(r.awards, 'other'), sum(r.payments, 'amount'), (ST[r.status] || [r.status])[0]]; }), { rtl: true });
  X.$$('[data-act]', box).forEach((b) => { b.onclick = () => openAct(A.acts.find((r) => String(r.act_id) === b.dataset.act), () => renderActive(box)); });
}

// ---------- 🟢 כרטיס Active ----------
function openAct(r, after) {
  if (!r) return;
  const { h } = X;
  const a = appOf(r);
  const awards = (r.awards || []).map((x) => ({ ...x })); const pays = (r.payments || []).map((x) => ({ ...x }));
  const inp = (k, lab, type = 'text', opts) => `<label class="rf-f">${h(lab)}${opts ? `<select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}"${String(r[k] || '') === v ? ' selected' : ''}>${h(t)}</option>`).join('')}</select>` : `<input data-k="${k}" type="${type}" value="${h(r[k] || '')}"${type === 'text' ? ' dir="ltr"' : ''}>`}</label>`;
  const YN = [['', '—'], ['yes', '✔ כן'], ['no', '✗ לא']];
  const awRow = (x, i) => `<tr><td><input data-aw="${i}:sem" value="${h(x.sem)}" dir="ltr" placeholder="Fall 2026"></td><td><input data-aw="${i}:pell" type="number" value="${h(x.pell || '')}"></td><td><input data-aw="${i}:tap" type="number" value="${h(x.tap || '')}"></td>
    <td><input data-aw="${i}:other" type="number" value="${h(x.other || '')}"></td><td><input data-aw="${i}:note" value="${h(x.note || '')}"></td><td><button type="button" class="linkish" data-awx="${i}">🗑</button></td></tr>`;
  const pyRow = (x, i) => `<tr><td><input data-py="${i}:date" type="date" value="${h(x.date)}"></td><td><input data-py="${i}:sem" value="${h(x.sem || '')}" dir="ltr"></td><td><input data-py="${i}:source" value="${h(x.source || '')}" dir="ltr" placeholder="Pell / TAP"></td>
    <td><input data-py="${i}:amount" type="number" value="${h(x.amount || '')}"></td><td><input data-py="${i}:note" value="${h(x.note || '')}"></td><td><button type="button" class="linkish" data-pyx="${i}">🗑</button></td></tr>`;
  const docH = (x, i) => { const ai = x.ai || {};
    return `<div class="ka-ad"><div><button type="button" class="linkish" data-dv="${i}" data-pdf="${/pdf/.test(x.type) ? 1 : ''}">📄 ${h(x.name)}</button> <span class="muted small">${h(String(x.at).slice(0, 10))}</span> <button type="button" class="linkish small" data-dx="${i}" title="מחיקה">🗑</button></div>
      ${ai.error ? `<div class="small rf-err">🤖 ${h(X.msg({ code: ai.error }))}</div>` : ai.summary ? `<div class="small">🤖 ${h(ai.summary)}</div>` : ''}
      ${(ai.awards || []).length || (ai.payments || []).length || ai.college || ai.fafsa_year ? `<div class="small muted">${(ai.awards || []).map((w) => `${h(w.sem)}: Pell ${money(w.pell)} · TAP ${money(w.tap)}${w.other ? ` · ${money(w.other)}` : ''}`).join(' | ')}${(ai.payments || []).map((p) => ` | 💵 ${h(p.date)} ${money(p.amount)} ${h(p.source)}`).join('')}${ai.fafsa_year ? ` | FAFSA ${h(ai.fafsa_year)}` : ''}</div>
        <button type="button" class="btn small-btn" data-dap="${i}">➕ להוסיף לרשומה</button>` : ''}
      ${(ai.dates || []).length ? `<div class="small">📅 ${ai.dates.map((t) => `${h(t.date)} ${h(t.what)}`).join(' · ')}</div>` : ''}</div>`; };
  const rm = remindersOf(r);
  const d = X.dialog(`<h2>🟢 ${h(anyNm(a))} <span class="muted small">תקופה #${h(r.act_id)}</span> <span class="ka-ph ka-${(ST[r.status] || ['', 'none'])[1]}">${h((ST[r.status] || [r.status])[0])}</span></h2>
    <p class="muted small"><button type="button" class="linkish" id="ad-app">📇 פתיחת האפליקציה #${h(r.app_id)}</button> · ${h(nm(a))} · נוצר ${h(r.created_at)} · עודכן ${h(r.updated_at)} (${h(r.updated_by)})</p>
    ${rm.length ? `<p class="rf-warn small">${rm.map(([, t]) => `🔔 ${h(t)}`).join(' · ')}</p>` : ''}
    <h4>🎓 התוכנית</h4><div class="rf-grid">${inp('college', 'College')}${inp('program', 'Program')}${inp('student_id', 'Student ID')}${inp('start_date', 'תאריך התחלה', 'date')}${inp('expected_end', 'סיום צפוי', 'date')}${r.end_date ? inp('end_date', 'תאריך סיום', 'date') : ''}</div>
    <h4>💰 מימון</h4><div class="rf-grid">${inp('fafsa', 'FAFSA', '', YN)}${inp('fafsa_year', 'FAFSA year (2026-27)')}${inp('tap', 'TAP', '', YN)}</div>
    <h4>🏅 פרסים לכל סמסטר (Pell / TAP)</h4><div class="ms-wrap"><table class="ms-table ka-ed"><thead><tr><th>Semester</th><th>Pell $</th><th>TAP $</th><th>Other $</th><th>הערה</th><th></th></tr></thead><tbody id="ad-aw">${awards.map(awRow).join('')}</tbody></table></div>
      <button type="button" class="btn small-btn" id="ad-awadd">➕ סמסטר</button>
    <h4>💵 תשלומים</h4><div class="ms-wrap"><table class="ms-table ka-ed"><thead><tr><th>תאריך</th><th>Semester</th><th>מקור</th><th>סכום $</th><th>הערה</th><th></th></tr></thead><tbody id="ad-py">${pays.map(pyRow).join('')}</tbody></table></div>
      <button type="button" class="btn small-btn" id="ad-pyadd">➕ תשלום</button> <span class="muted small" id="ad-tot"></span>
    <h4>הערה</h4><textarea data-k="note" rows="2" style="width:100%">${h(r.note || '')}</textarea>
    <h4>📎 מכתבים (Award letter, FAFSA/SAR, TAP, הקולג', צילומי מסך) — 🤖 קורא סכומים ותאריכים</h4>
    <label class="kr-big-drop ka-drop" data-drop>⬆ <b>גרור לכאן מכתב / צילום מסך — או לחץ לבחירה</b><input type="file" accept="image/*,application/pdf" multiple data-up hidden></label>
    <div class="ka-ads">${(r.docs || []).map(docH).join('') || '<p class="muted small">אין עדיין מכתבים.</p>'}</div>
    <details><summary class="small">📜 היסטוריה (${(r.history || []).length})</summary><ul class="small">${(r.history || []).slice().reverse().map((x) => `<li>${h(x.at)} · ${h(x.what)} <span class="muted">${h(x.by)}</span></li>`).join('')}</ul></details>
    <div class="actions"><button type="button" class="btn primary" id="ad-save">💾 שמירה</button>
      ${r.status === 'active' ? '<button type="button" class="btn" id="ad-exp">⏹ פג תוקף</button><button type="button" class="btn" id="ad-back">↩ החזרה לאפליקציות</button>' : '<button type="button" class="btn" id="ad-re">🔁 הפעלה מחדש (תקופה חדשה)</button>'}
      <span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`, 'ka-dlg');
  const readAll = () => {
    X.$$('[data-aw]', d).forEach((el) => { const [i, k] = el.dataset.aw.split(':'); awards[Number(i)][k] = el.value; });
    X.$$('[data-py]', d).forEach((el) => { const [i, k] = el.dataset.py.split(':'); pays[Number(i)][k] = el.value; });
  };
  const tot = () => { readAll(); X.$('#ad-tot', d).textContent = `סה"כ פרסים ${money(sum(awards, 'pell') + sum(awards, 'tap') + sum(awards, 'other'))} · שולם ${money(sum(pays, 'amount'))}`; };
  const redraw = () => { X.$('#ad-aw', d).innerHTML = awards.map(awRow).join(''); X.$('#ad-py', d).innerHTML = pays.map(pyRow).join(''); wireRows(); tot(); };
  const wireRows = () => {
    X.$$('[data-awx]', d).forEach((b) => { b.onclick = () => { readAll(); awards.splice(Number(b.dataset.awx), 1); redraw(); }; });
    X.$$('[data-pyx]', d).forEach((b) => { b.onclick = () => { readAll(); pays.splice(Number(b.dataset.pyx), 1); redraw(); }; });
    X.$$('[data-aw], [data-py]', d).forEach((el) => { el.oninput = tot; });
  };
  wireRows(); tot();
  X.$('#ad-awadd', d).onclick = () => { readAll(); awards.push({ sem: '', pell: '', tap: '', other: '', note: '' }); redraw(); };
  X.$('#ad-pyadd', d).onclick = () => { readAll(); pays.push({ date: today(), sem: '', source: '', amount: '', note: '' }); redraw(); };
  const save = async (quiet) => {
    readAll();
    const rec = { awards, payments: pays }; X.$$('[data-k]', d).forEach((el) => { rec[el.dataset.k] = el.value.trim(); });
    const res = await X.call(X.KEY, 'kaActSave', { act_id: r.act_id, rec });
    Object.assign(r, res.act); if (!quiet) X.toast('נשמר.');
  };
  const reopen = () => { d.close(); openAct(r, after); after(); };
  X.$('#ad-save', d).onclick = async (e) => { e.target.disabled = true; try { await save(); reopen(); } catch (err) { X.toast(X.msg(err), 'err'); e.target.disabled = false; } };
  X.$('#ad-app', d).onclick = () => openApp(a, () => {});
  X.$('#ad-exp', d)?.addEventListener('click', () => stateDialog(r, 'expired', reopen));
  X.$('#ad-back', d)?.addEventListener('click', () => stateDialog(r, 'inactive', reopen));
  X.$('#ad-re', d)?.addEventListener('click', () => activateDialog(a, async () => { d.close(); A.acts = null; K.apps = null; after(); }, r));
  // 📎 העלאה + 🤖
  const upload = async (files) => {
    const fl = [...files]; if (!fl.length) return;
    try { await save(true); } catch { /* */ }
    const z = X.$('[data-drop]', d); z.classList.add('busy');
    for (const [i, f] of fl.entries()) {
      z.querySelector('b').textContent = `⏳ 🤖 קורא (${i + 1}/${fl.length})…`;
      try { const res = await X.call(X.KEY, 'kaActUpload', { act_id: r.act_id, data: await fileData(f), name: f.name }); Object.assign(r, res.act); } catch (err) { X.toast(X.msg(err), 'err'); }
    }
    reopen();
  };
  X.$('[data-up]', d).onchange = (e) => upload(e.target.files);
  const z = X.$('[data-drop]', d);
  z.ondragover = (e) => { e.preventDefault(); z.classList.add('over'); }; z.ondragleave = () => z.classList.remove('over');
  z.ondrop = (e) => { e.preventDefault(); z.classList.remove('over'); upload(e.dataTransfer.files); };
  X.$$('[data-dv]', d).forEach((b) => { b.onclick = () => showFile(async () => (await X.call(X.KEY, 'kaActFile', { act_id: r.act_id, i: Number(b.dataset.dv) })).data, !!b.dataset.pdf); });
  X.$$('[data-dx]', d).forEach((b) => { b.onclick = async () => { if (!window.confirm('למחוק את המכתב? (עובר לפח של הדרייב)')) return; try { const res = await X.call(X.KEY, 'kaActDocDel', { act_id: r.act_id, i: Number(b.dataset.dx) }); Object.assign(r, res.act); reopen(); } catch (err) { X.toast(X.msg(err), 'err'); } }; });
  X.$$('[data-dap]', d).forEach((b) => { b.onclick = () => {
    readAll(); const ai = r.docs[Number(b.dataset.dap)].ai || {};
    (ai.awards || []).forEach((w) => { const ex = awards.find((x) => String(x.sem).trim().toLowerCase() === String(w.sem).trim().toLowerCase() && w.sem); if (ex) Object.assign(ex, Object.fromEntries(Object.entries(w).filter(([, v]) => v))); else awards.push({ ...w }); });
    (ai.payments || []).forEach((p) => { if (!pays.some((x) => x.date === p.date && Number(x.amount) === Number(p.amount))) pays.push({ ...p }); });
    const setK = (k, v) => { const el = X.$(`[data-k="${k}"]`, d); if (el && v && !el.value) el.value = v; };
    setK('college', ai.college); setK('program', ai.program); setK('student_id', ai.student_id);
    if (ai.fafsa_year) { const el = X.$('[data-k="fafsa_year"]', d); el.value = ai.fafsa_year; X.$('[data-k="fafsa"]', d).value = 'yes'; }
    redraw(); X.toast('נוסף — לבדוק וללחוץ 💾 שמירה.');
  }; });
}
function stateDialog(r, state, after) {
  const { h } = X;
  const exp = state === 'expired';
  const d = X.dialog(`<h2>${exp ? '⏹ פג תוקף — התוכנית הסתיימה' : '↩ החזרה לאפליקציות'}</h2>
    <p class="muted small">${exp ? 'הרשומה נשארת תחת "⏹ הסתיימו" עם כל ההיסטוריה.' : 'האפליקציה חוזרת ל-📝 Applications (סטטוס "הוחזר"), והרשומה נשארת כאן כ"לא פעיל" עם כל ההיסטוריה.'}</p>
    <label class="rf-f">תאריך<input type="date" id="sd-d" value="${today()}"></label><label class="rf-f">סיבה / הערה<input id="sd-w"></label>
    <div class="actions"><button type="button" class="btn primary" id="sd-go">${exp ? '⏹ פג תוקף' : '↩ החזרה'}</button><button type="button" class="btn" data-x>ביטול</button></div>`);
  void h;
  X.$('#sd-go', d).onclick = async (e) => {
    e.target.disabled = true;
    try { const res = await X.call(X.KEY, 'kaActState', { act_id: r.act_id, state, date: X.$('#sd-d', d).value, why: X.$('#sd-w', d).value.trim() }); Object.assign(r, res.act); K.apps = null; d.close(); X.toast('עודכן.'); after(); } catch (err) { X.toast(X.msg(err), 'err'); e.target.disabled = false; }
  };
}

/** תמונה → JPEG עד 2000px; PDF כמו שהוא (עד 6MB) */
async function fileData(f) {
  if (f.type === 'application/pdf') {
    if (f.size > 6.5 * 1024 * 1024) throw Object.assign(new Error('file-big'), { code: 'file-big' });
    return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('bad-file')); r.readAsDataURL(f); });
  }
  if (!/^image\//.test(f.type)) throw Object.assign(new Error('bad-file'), { code: 'bad-file' });
  const url = URL.createObjectURL(f);
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad-file')); i.src = url; });
  URL.revokeObjectURL(url);
  const k = Math.min(1, 2000 / Math.max(im.width, im.height));
  const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
}

// ---------- 🤖 מזכיר AI ----------
const AS = { text: '', files: [], busy: false, plan: null, fids: null };
export async function renderAssist(box) {
  const { h } = X;
  if (!K.apps || !A.acts) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await Promise.all([K.apps ? 0 : loadApps(), A.acts ? 0 : loadActs()]); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  box.innerHTML = `<div class="ka-as">
    <p class="muted small">כותבים מה צריך (או רק מעלים), ו-🤖 מציע: אפליקציה חדשה, עדכון לאפליקציה קיימת (לפי שם / SSN / טלפון), או עדכון ל-Active (Award letter / תשלום). <b>שום דבר לא נשמר עד שלוחצים "✓ לבצע".</b></p>
    <textarea id="as-t" rows="4" style="width:100%" placeholder="למשל: זה הטופס שמשה גרינפעלד מילא ביד + ה-ID שלו. / Award letter של יעקב כהן לסמסטר Fall 2026.">${h(AS.text)}</textarea>
    <label class="kr-big-drop ka-drop" data-drop>⬆ <b>גרור לכאן סריקות / צילומים / PDF — או לחץ לבחירה</b><small>טופס בכתב יד, ID / SS, תעודות, טעקס, מכתבים, צילומי מסך מהפורטל</small><input type="file" accept="image/*,application/pdf" multiple data-up hidden></label>
    <div class="as-files">${AS.files.map((f, i) => `<span class="ka-chip">${/^image/.test(f.type) ? '🖼' : '📄'} ${h(f.name)} <button type="button" class="linkish" data-fx="${i}">✕</button></span>`).join('')}</div>
    <div class="actions"><button type="button" class="btn primary" id="as-go"${AS.busy ? ' disabled' : ''}>🤖 תבין ותציע</button>${AS.plan ? '<button type="button" class="btn" id="as-clr">🧹 התחלה מחדש</button>' : ''}<span class="small" id="as-msg"></span></div>
    <div id="as-plan"></div></div>`;
  const t = X.$('#as-t', box); t.oninput = () => { AS.text = t.value; };
  const add = (fl) => { AS.files.push(...[...fl]); AS.plan = null; AS.fids = null; renderAssist(box); };
  X.$('[data-up]', box).onchange = (e) => add(e.target.files);
  const z = X.$('[data-drop]', box);
  z.ondragover = (e) => { e.preventDefault(); z.classList.add('over'); }; z.ondragleave = () => z.classList.remove('over');
  z.ondrop = (e) => { e.preventDefault(); z.classList.remove('over'); add(e.dataTransfer.files); };
  X.$$('[data-fx]', box).forEach((b) => { b.onclick = () => { AS.files.splice(Number(b.dataset.fx), 1); AS.plan = null; AS.fids = null; renderAssist(box); }; });
  X.$('#as-clr', box)?.addEventListener('click', () => { Object.assign(AS, { text: '', files: [], plan: null, fids: null }); renderAssist(box); });
  X.$('#as-go', box).onclick = async () => {
    if (!AS.text.trim() && !AS.files.length) { X.toast('כתוב משהו או העלה קובץ.', 'err'); return; }
    const m = X.$('#as-msg', box); AS.busy = true; X.$('#as-go', box).disabled = true;
    try {
      if (!AS.fids) {
        const fids = [];
        for (const [i, f] of AS.files.entries()) { m.textContent = `⏳ מעלה (${i + 1}/${AS.files.length})…`; fids.push((await X.call(X.KEY, 'kaAsUpload', { data: await fileData(f), name: f.name })).fid); }
        AS.fids = fids;
      }
      m.textContent = '⏳ 🤖 קורא ומבין… (עד דקה)';
      AS.plan = (await X.call(X.KEY, 'kaAssist', { text: AS.text, fids: AS.fids, names: AS.files.map((f) => f.name) })).plan;
      m.textContent = '';
    } catch (err) { m.innerHTML = `<span class="rf-err">${h(X.msg(err))}</span>`; }
    AS.busy = false; X.$('#as-go', box).disabled = false;
    if (AS.plan) planView(X.$('#as-plan', box), box);
  };
  if (AS.plan) planView(X.$('#as-plan', box), box);
}

const AF = SECTIONS.flatMap((s) => s.fields);
function planView(el, box) {
  const { h } = X;
  const p = AS.plan;
  const apps = [...K.apps].sort((x, y) => String(anyNm(x)).localeCompare(String(anyNm(y)), 'he'));
  const acts = A.acts.filter((r) => r.status === 'active');
  const target = p.action === 'update_app' ? (K.apps.find((a) => String(a.app_id) === String(p.app_id)) || null) : null;
  const fl = Object.entries(p.fields || {});
  const actF = Object.entries(p.active || {});
  const kl = (k) => kindLabel(k, (K.apps[0] || {}).taxYears, 'yi');
  el.innerHTML = `<div class="ka-planbox">
    <h3>🤖 ההצעה</h3>
    ${p.summary ? `<p>${h(p.summary)}</p>` : ''}${p.matchNote ? `<p class="rf-warn small">${h(p.matchNote)}</p>` : ''}${p.questions ? `<p class="rf-warn small">❓ ${h(p.questions)}</p>` : ''}
    <div class="rf-grid"><label class="rf-f">מה לעשות<select id="pl-act">
      ${[['new_app', '➕ אפליקציה חדשה (נפתח במשרד)'], ['update_app', '✎ עדכון אפליקציה קיימת'], ['update_active', '🟢 עדכון רשומת Active']].map(([v, t]) => `<option value="${v}"${p.action === v ? ' selected' : ''}>${h(t)}</option>`).join('')}
      ${p.action === 'unclear' ? '<option value="unclear" selected>❓ לא ברור — בחר</option>' : ''}</select></label>
      <label class="rf-f" id="pl-appw"${p.action === 'update_app' ? '' : ' hidden'}>איזו אפליקציה<select id="pl-app"><option value="">—</option>${apps.map((a) => `<option value="${h(a.app_id)}"${String(a.app_id) === String(p.app_id) ? ' selected' : ''}>#${h(a.app_id)} ${h(yiNm(a))} · ${h(nm(a))}</option>`).join('')}</select></label>
      <label class="rf-f" id="pl-actw"${p.action === 'update_active' ? '' : ' hidden'}>איזו רשומה<select id="pl-ac"><option value="">—</option>${acts.map((r) => `<option value="${h(r.act_id)}"${String(r.act_id) === String(p.act_id) ? ' selected' : ''}>${h(anyNm(appOf(r)))} · ${h(r.college)} ${h(r.program)}</option>`).join('')}</select></label></div>
    <div id="pl-flds"${p.action === 'update_active' ? ' hidden' : ''}>
      ${fl.length ? `<h4>📝 פרטים (מסומן = ייכנס${target ? '; כרגע באפליקציה — בצד' : ''})</h4><table class="ms-table ka-ed"><tbody>${fl.map(([k, v]) => { const f = AF.find((x) => x[0] === k) || [k, k, '']; const cur = target?.data?.[k] || '';
        return `<tr><td><label class="check"><input type="checkbox" data-pf="${h(k)}"${cur && cur === v ? '' : ' checked'}> ${h(f[1])} <span class="muted small">${h(f[2])}</span></label></td><td><input data-pv="${h(k)}" value="${h(v)}"${f[4]?.rtl ? ' dir="rtl"' : ' dir="ltr"'}></td>${target ? `<td class="small muted">${h(cur || '—')}</td>` : ''}</tr>`; }).join('')}</tbody></table>` : '<p class="muted small">לא נמצאו פרטים לשדות.</p>'}
    </div>
    <div id="pl-actf"${p.action === 'update_active' ? '' : ' hidden'}>
      ${actF.length ? `<h4>🎓 פרטי התוכנית</h4><table class="ms-table ka-ed"><tbody>${actF.map(([k, v]) => `<tr><td><label class="check"><input type="checkbox" data-paf="${h(k)}" checked> ${h(k)}</label></td><td><input data-pav="${h(k)}" value="${h(v)}" dir="ltr"></td></tr>`).join('')}</tbody></table>` : ''}
      ${(p.awards || []).length ? `<h4>🏅 פרסים</h4><ul class="small">${p.awards.map((w, i) => `<li><label class="check"><input type="checkbox" data-paw="${i}" checked> ${h(w.sem)} — Pell ${money(w.pell)} · TAP ${money(w.tap)}${w.other ? ` · אחר ${money(w.other)}` : ''} ${h(w.note || '')}</label></li>`).join('')}</ul>` : ''}
      ${(p.payments || []).length ? `<h4>💵 תשלומים</h4><ul class="small">${p.payments.map((x, i) => `<li><label class="check"><input type="checkbox" data-ppy="${i}" checked> ${h(x.date)} · ${money(x.amount)} · ${h(x.source)} ${h(x.sem)}</label></li>`).join('')}</ul>` : ''}
    </div>
    ${AS.files.length ? `<h4>📎 קבצים</h4><table class="ms-table ka-ed"><tbody>${AS.files.map((f, i) => { const x = (p.files || []).find((y) => Number(y.n) === i) || { kinds: [], ok: false };
      return `<tr><td>${h(f.name)}</td><td><select data-pk="${i}"><option value="">${p.action === 'update_active' ? 'מכתב' : 'סוג…'}</option>${ALL_KINDS.map((k) => `<option value="${k}"${(x.kinds || [])[0] === k ? ' selected' : ''}>${h(kl(k))}</option>`).join('')}</select>${(x.kinds || []).length > 1 ? ` <span class="small muted">+ ${x.kinds.slice(1).map((k) => h(kl(k))).join(', ')}</span>` : ''}</td>
        <td><label class="check small"><input type="checkbox" data-pok="${i}"${x.ok ? ' checked' : ''}> תקין</label></td><td class="small muted">${h(x.note || '')}</td></tr>`; }).join('')}</tbody></table>` : ''}
    <div class="actions"><button type="button" class="btn primary" id="pl-go">✓ לבצע</button><span class="small" id="pl-msg"></span></div></div>`;
  const sel = X.$('#pl-act', el);
  sel.onchange = () => { const v = sel.value; X.$('#pl-appw', el).hidden = v !== 'update_app'; X.$('#pl-actw', el).hidden = v !== 'update_active'; X.$('#pl-flds', el).hidden = v === 'update_active'; X.$('#pl-actf', el).hidden = v !== 'update_active'; };
  X.$('#pl-go', el).onclick = async (e) => {
    const act = sel.value;
    if (act === 'unclear') { X.toast('בחר מה לעשות.', 'err'); return; }
    const plan = { action: act, app_id: X.$('#pl-app', el).value, act_id: X.$('#pl-ac', el).value, summary: p.summary, fields: {}, active: {}, awards: [], payments: [], files: [] };
    if (act === 'update_app' && !plan.app_id) { X.toast('בחר אפליקציה.', 'err'); return; }
    if (act === 'update_active' && !plan.act_id) { X.toast('בחר רשומת Active.', 'err'); return; }
    X.$$('[data-pf]', el).forEach((c) => { if (c.checked) plan.fields[c.dataset.pf] = X.$(`[data-pv="${c.dataset.pf}"]`, el).value.trim(); });
    X.$$('[data-paf]', el).forEach((c) => { if (c.checked) plan.active[c.dataset.paf] = X.$(`[data-pav="${c.dataset.paf}"]`, el).value.trim(); });
    X.$$('[data-paw]', el).forEach((c) => { if (c.checked) plan.awards.push(p.awards[Number(c.dataset.paw)]); });
    X.$$('[data-ppy]', el).forEach((c) => { if (c.checked) plan.payments.push(p.payments[Number(c.dataset.ppy)]); });
    AS.files.forEach((f, i) => { const k = X.$(`[data-pk="${i}"]`, el)?.value; const orig = (p.files || []).find((y) => Number(y.n) === i) || { kinds: [] };
      plan.files.push({ n: i, kinds: k ? [k, ...(orig.kinds || []).filter((x) => x !== k).slice(0, 2)] : [], ok: !!X.$(`[data-pok="${i}"]`, el)?.checked, note: orig.note || '' }); });
    if (act === 'new_app' && !plan.fields.yi_name && !plan.fields.legal_last && !window.confirm('אין שם — לפתוח בכל זאת?')) return;
    e.target.disabled = true; X.$('#pl-msg', el).textContent = '⏳ מבצע…';
    try {
      const r = await X.call(X.KEY, 'kaAssistApply', { plan, fids: AS.fids || [], names: AS.files.map((f) => f.name) });
      Object.assign(AS, { text: '', files: [], plan: null, fids: null });
      K.apps = null; A.acts = null;
      X.toast('בוצע ✓');
      await renderAssist(box);
      if (r.app_id) { const a = K.apps.find((x) => String(x.app_id) === String(r.app_id)); if (a) openApp(a, () => {}); }
      else if (r.act_id) { const ra = A.acts.find((x) => String(x.act_id) === String(r.act_id)); if (ra) openAct(ra, () => {}); }
    } catch (err) { X.$('#pl-msg', el).innerHTML = `<span class="rf-err">${h(X.msg(err))}</span>`; e.target.disabled = false; }
  };
}
