// 🕍 מרכז הכוללים אונגוואר — טופס הרשמה (ungvar.org/kollel/register). English / אידיש.
//    כניסה עם אימייל + קוד (בלי גוגל) · טיוטה נשמרת · מסמכים → 🤖 Gemini ממלא את השדות · חתימה (ציור או הקלדה).
import { CONFIG } from '../config.js?v=653';
import { SECTIONS, docsList, MARITAL, YESNO, printHtml } from './kollelfields.js?v=655';

const MOSAD = 'kollel';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SK = 'kollel-reg-session';

const UI = {
  en: { dir: 'ltr', title: 'Kollel Enrollment Form', sub: 'Merkaz HaKollelim · Khal Ungvar',
    login: 'Sign in', email: 'Email address', code: 'Your code (at least 6 characters)', newForm: 'Start a new form', cont: 'Continue my form',
    blankBtn: '⬇ Blank form to print (PDF)', blankHint: 'Prefer paper? Print the form, fill it in by hand and bring it to the office with copies of the documents. In the print window you can also choose "Save as PDF".',
    loginHint: 'New? Choose a code and press "Start a new form". Next time, use the same email and code to continue or edit your form. Forgot your code? Call the office.',
    steps: ['Documents', 'Details', 'Parents & Education', 'Signature'], save: 'Save', saved: 'Saved ✓', next: 'Next →', back: '← Back', logout: 'Sign out',
    maritalQ: 'Marital status', docsT: 'Required documents', docsHint: 'Upload a clear photo (from your phone) or a PDF. Front and back are fine as 2 files.',
    up: '+ Upload', del: 'Remove', ai: '✨ Fill my details from the documents', aiBusy: 'Reading your documents… (up to a minute)', aiDone: (n) => `${n} fields were filled from your documents — please check every one carefully.`,
    aiNone: 'Nothing could be read. Please fill in the details yourself.', aiFlag: 'filled from documents — please check',
    sigT: 'Signature', sigSelf: 'Applicant\'s legal signature', sigWife: 'Spouse\'s legal signature', draw: 'Draw', type: 'Type my full name', clear: 'Clear', sigDate: 'Date',
    confirm: 'I confirm that the information in this form is true and correct.', submit: 'Submit the form', resubmit: 'Save changes',
    sent: 'Your form was received. Thank you! You can come back any time with your email and code to update it.',
    st: { draft: 'Draft — not sent yet', submitted: 'Received ✓', updated: 'Updated ✓', approved: 'Approved ✓', rejected: 'Please contact the office' },
    err: { 'ka-bad': 'Wrong code.', 'ka-none': 'No form with this email. Press "Start a new form".', 'ka-exists': 'A form with this email already exists — press "Continue my form".',
      'ka-locked': 'Too many attempts. Try again in 15 minutes.', 'ka-short-code': 'The code must be at least 6 characters.', 'ka-bad-email': 'Invalid email address.',
      'ka-login': 'Please sign in again.', 'file-big': 'The file is too large.', 'bad-file': 'Only a photo or a PDF.', 'too-many': 'Too many attempts — try later.',
      'ai-off': 'Automatic reading is not available right now.', 'ai-no-docs': 'Upload the ID / SS card / certificates first.', 'missing-sig': 'Please sign the form.' },
    missing: 'Please fill in:', missingDocs: 'Missing documents:', yes: 'Yes', no: 'No', choose: '—' },
  yi: { dir: 'rtl', title: 'טופס הרשמה פאר׳ן כולל', sub: 'מרכז הכוללים · קהל אונגוואר',
    login: 'אריינגיין', email: 'אימעיל אדרעס', code: 'דיין קאוד (כאטש 6 אותיות/ציפערן)', newForm: 'אנהייבן א נייע פארעם', cont: 'ווייטער מיין פארעם',
    blankBtn: '⬇ א ליידיגע פארעם צום דרוקן (PDF)', blankHint: 'וועלסט אויספילן אויף פאפיר? דרוק אויס די פארעם, פיל אויס מיט די האנט און ברענג עס צום אפיס מיט קאפיעס פון די דאקומענטן. אינעם דרוק-פענצטער קען מען אויך אויסקלייבן "Save as PDF".',
    loginHint: 'נייע? קלייב אויס א קאוד און דריק "אנהייבן א נייע פארעם". דאס קומענדיגע מאל, מיט די זעלבע אימעיל און קאוד קענסטו ווייטער פירן אדער טוישן. פארגעסן דעם קאוד? רוף דעם אפיס.',
    steps: ['דאקומענטן', 'פרטים', 'עלטערן און ישיבות', 'אונטערשריפט'], save: 'אפהיטן', saved: 'אפגעהיטן ✓', next: 'ווייטער ←', back: '→ צוריק', logout: 'ארויסגיין',
    maritalQ: 'סטאטוס', docsT: 'נויטיגע דאקומענטן', docsHint: 'לייג ארויף א קלארע בילד (פונעם טעלעפאן) אדער א PDF. פאראויס און הינטן — מעג זיין 2 טעקעס.',
    up: '+ ארויפלייגן', del: 'אראפנעמען', ai: '✨ אויספילן מיינע פרטים פון די דאקומענטן', aiBusy: 'מען לייענט די דאקומענטן… (ביז א מינוט)', aiDone: (n) => `${n} פעלדער זענען אויסגעפילט פון די דאקומענטן — ביטע קוק איבער יעדעס איינס.`,
    aiNone: 'מען האט גארנישט געקענט לייענען. ביטע פיל אויס אליין.', aiFlag: 'אויסגעפילט פון די דאקומענטן — ביטע קוק איבער',
    sigT: 'אונטערשריפט', sigSelf: 'דיין אונטערשריפט', sigWife: 'די ווייב׳ס אונטערשריפט', draw: 'צייכענען', type: 'שרייבן דעם פולן נאמען', clear: 'אויסמעקן', sigDate: 'דאטום',
    confirm: 'איך באשטעטיג אז די אינפארמאציע אין די פארעם איז ריכטיג.', submit: 'אריינשיקן', resubmit: 'אפהיטן די ענדערונגען',
    sent: 'מיר האבן באקומען די פארעם. א דאנק! דו קענסט צוריקקומען ווען דו ווילסט מיט די אימעיל און קאוד צו טוישן.',
    st: { draft: 'נאך נישט אריינגעשיקט', submitted: 'באקומען ✓', updated: 'דערהיינטיגט ✓', approved: 'באשטעטיגט ✓', rejected: 'ביטע פארבינד זיך מיט׳ן אפיס' },
    err: { 'ka-bad': 'אומריכטיגער קאוד.', 'ka-none': 'ס׳איז נישטא קיין פארעם מיט די אימעיל. דריק "אנהייבן א נייע פארעם".', 'ka-exists': 'ס׳איז שוין דא א פארעם מיט די אימעיל — דריק "ווייטער מיין פארעם".',
      'ka-locked': 'צופיל פרואוון. פרוביר נאכאמאל אין 15 מינוט.', 'ka-short-code': 'דער קאוד דארף זיין כאטש 6 אותיות.', 'ka-bad-email': 'אומריכטיגע אימעיל.',
      'ka-login': 'ביטע גיי נאכאמאל אריין.', 'file-big': 'די טעקע איז צו גרויס.', 'bad-file': 'נאר א בילד אדער PDF.', 'too-many': 'צופיל פרואוון — פרוביר שפעטער.',
      'ai-off': 'אויטאמאטיש לייענען ארבעט יעצט נישט.', 'ai-no-docs': 'לייג קודם ארויף די ID / SS קארטל / סערטיפיקאטן.', 'missing-sig': 'ביטע אונטערשרייב די פארעם.' },
    missing: 'ביטע פיל אויס:', missingDocs: 'עס פעלן דאקומענטן:', yes: 'יא', no: 'ניין', choose: '—' },
};
const S = { lang: 'en', ks: '', app: null, step: 0, data: {}, aiKeys: new Set(), dirty: false, busy: false, sig: { self: 'draw', wife: 'draw' }, ok: false };
const U = () => UI[S.lang];
const L = (en, yi) => (S.lang === 'yi' ? yi : en);
const errText = (e) => { const c = String(e?.code || e?.message || e); if (c.startsWith('missing:')) return `${U().missing} ${c.slice(8).split(',').map((k) => fieldLabel(k)).join(', ')}`; if (c.startsWith('missing-docs:')) return `${U().missingDocs} ${c.slice(13).split(',').map((k) => docLabel(k)).join(', ')}`; return U().err[c] || c; };
const fieldLabel = (k) => { for (const s of SECTIONS) { const f = s.fields.find((x) => x[0] === k); if (f) return L(f[1], f[2]); } return k; };
const docLabel = (k) => { const d = docsList(S.app?.taxYears).find((x) => x.k === k); return d ? L(d.en, d.yi) : k; };

async function pub(action, body = {}) {
  const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, action, mosad: MOSAD }) });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
  return j;
}
function toast(t, bad) { let el = $('#kr-toast'); if (!el) { el = document.createElement('div'); el.id = 'kr-toast'; el.className = 'kr-toast'; document.body.append(el); } el.textContent = t; el.classList.toggle('bad', !!bad); el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 4500); }
const married = () => S.data.marital === 'married';

/** תמונה → JPEG עד 2000px; PDF כמו שהוא (עד 6MB) */
async function fileData(f) {
  if (f.type === 'application/pdf') {
    if (f.size > 6 * 1024 * 1024) throw new Error('file-big');
    return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('bad-file')); r.readAsDataURL(f); });
  }
  if (!/^image\//.test(f.type)) throw new Error('bad-file');
  const url = URL.createObjectURL(f);
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad-file')); i.src = url; });
  URL.revokeObjectURL(url);
  const k = Math.min(1, 2000 / Math.max(im.width, im.height));
  const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
}

function frame(inner) {
  const u = U();
  document.documentElement.lang = S.lang === 'yi' ? 'yi' : 'en';
  document.documentElement.dir = u.dir;
  $('#rf-app').innerHTML = `<header class="rf-head"><div class="kr-lh"><b>מרכז הכוללים</b><span>שע"י קהל אונגוואר</span></div>
      <h1>${h(u.title)}</h1><p class="rf-hint">${h(u.sub)}</p>
      <div class="rf-langs"><button type="button" data-lang="en" class="${S.lang === 'en' ? 'on' : ''}">English</button><button type="button" data-lang="yi" class="${S.lang === 'yi' ? 'on' : ''}">אידיש</button></div></header>${inner}`;
  $$('[data-lang]').forEach((b) => { b.onclick = () => { readStep(); S.lang = b.dataset.lang; try { localStorage.setItem('kollel-reg-lang', S.lang); } catch { /* */ } render(); }; });
}

// ---------- כניסה ----------
function renderLogin(msg = '') {
  const u = U();
  frame(`<section class="rf-card kr-login"><h2>${h(u.login)}</h2>
    <form class="rf-grid" id="kr-lf" onsubmit="return false">
      <label class="rf-f rf-wide">${h(u.email)}<input name="email" type="email" dir="ltr" autocomplete="email" required></label>
      <label class="rf-f rf-wide">${h(u.code)}<input name="code" type="password" dir="ltr" autocomplete="current-password" minlength="6" required></label>
    </form>
    ${msg ? `<p class="rf-err">${h(msg)}</p>` : ''}
    <div class="rf-nav"><button type="button" class="btn primary" data-go="login">${h(u.cont)}</button><button type="button" class="btn" data-go="create">${h(u.newForm)}</button></div>
    <p class="rf-hint">${h(u.loginHint)}</p></section>
    <section class="rf-card kr-login kr-blank"><button type="button" class="btn" id="kr-blank">${h(u.blankBtn)}</button><p class="rf-hint">${h(u.blankHint)}</p></section>`);
  $('#kr-blank').onclick = () => {
    const y = new Date().getFullYear();
    const w = window.open('', '_blank'); if (!w) return;
    w.document.open(); w.document.write(printHtml({ email: '', data: {}, files: {}, taxYears: [y - 2, y - 1] }, { blank: true })); w.document.close();
  };
  $$('[data-go]').forEach((b) => { b.onclick = async () => {
    const f = $('#kr-lf').elements;
    if (S.busy) return; S.busy = true; b.disabled = true;
    try {
      const r = await pub('kaAuth', { email: f.email.value.trim(), code: f.code.value, create: b.dataset.go === 'create', lang: S.lang });
      S.ks = r.ks; try { sessionStorage.setItem(SK, r.ks); } catch { /* */ }
      setApp(r.app); S.step = r.app.status === 'draft' ? 0 : 1; render();
    } catch (e) { renderLogin(errText(e)); } finally { S.busy = false; }
  }; });
}
function setApp(app) { S.app = app; S.data = { ...(app.data || {}) }; if (!S.data.sig_date) S.data.sig_date = new Date().toISOString().slice(0, 10); }

// ---------- שדות ----------
function input(f) {
  const [k, en, yi, type, o] = f;
  const v = S.data[k] ?? '';
  const lab = `${h(L(en, yi))}${o.req || (o.m && married() && ['wife_first', 'wife_last', 'wife_ssn', 'wedding_date'].includes(k)) ? ' *' : ''}`;
  const flag = S.aiKeys.has(k) ? `<span class="kr-ai">✨ ${h(U().aiFlag)}</span>` : '';
  let el;
  if (type === 'select') el = `<select name="${k}"><option value="">${U().choose}</option>${o.opts.map(([val, e, y]) => `<option value="${val}"${v === val ? ' selected' : ''}>${h(L(e, y))}</option>`).join('')}</select>`;
  else if (type === 'yesno') el = `<span class="rf-yn">${YESNO.map(([val, e, y]) => `<label><input type="radio" name="${k}" value="${val}"${v === val ? ' checked' : ''}> ${h(L(e, y))}</label>`).join('')}</span>`;
  else if (type === 'area') el = `<textarea name="${k}" rows="3">${h(v)}</textarea>`;
  else el = `<input name="${k}" type="${type === 'date' ? 'date' : type === 'num' ? 'number' : type === 'tel' ? 'tel' : 'text'}" value="${h(v)}"${type === 'ssn' ? ' inputmode="numeric" placeholder="###-##-####" dir="ltr"' : ''}${type === 'tel' ? ' dir="ltr"' : ''}${o.rtl ? ' dir="rtl"' : ''}>`;
  return `<label class="rf-f${o.wide || type === 'area' || type === 'yesno' ? ' rf-wide' : ''}${S.aiKeys.has(k) ? ' kr-filled' : ''}">${lab}${el}${flag}</label>`;
}
const sec = (id) => { const s = SECTIONS.find((x) => x.id === id); const fs = s.fields.filter((f) => (married() || !f[4].m) && !f[4].print); return `<h3 class="kr-h3">${h(L(s.en, s.yi))}</h3><div class="rf-grid">${fs.map(input).join('')}</div>`; };
function readStep() {
  const box = $('#kr-step'); if (!box) return;
  $$('input[name], select[name], textarea[name]', box).forEach((el) => {
    if (el.type === 'radio') { if (el.checked) S.data[el.name] = el.value; return; }
    if (el.type === 'checkbox' || el.type === 'password' || el.type === 'file') return;
    let v = el.value;
    if (el.closest('.rf-f') && SECTIONS.some((s) => s.fields.some((f) => f[0] === el.name && f[3] === 'ssn'))) { const d = v.replace(/\D/g, ''); if (d.length === 9) v = `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`; }
    if (S.data[el.name] !== v) { S.data[el.name] = v; S.dirty = true; }
  });
}

// ---------- השלבים ----------
function stepDocs() {
  const u = U();
  const docs = docsList(S.app.taxYears).filter((d) => married() || !d.m);
  const files = S.app.files || {};
  return `<section class="rf-card"><h2>${h(u.maritalQ)}</h2>
      <div class="kr-mar">${MARITAL.map(([v, e, y]) => `<label class="kr-pill"><input type="radio" name="marital" value="${v}"${S.data.marital === v ? ' checked' : ''}> ${h(L(e, y))}</label>`).join('')}</div></section>
    <section class="rf-card"><h2>${h(u.docsT)}</h2><p class="rf-hint">${h(u.docsHint)}</p>
      ${docs.map((d) => `<div class="rf-doc"><div><b>${h(L(d.en, d.yi))}</b> *</div>
        <div class="kr-files">${(files[d.k] || []).map((x, i) => `<span class="kr-file">📄 ${h(x.name)} <button type="button" class="linkish" data-del="${d.k}:${i}">${h(u.del)}</button></span>`).join('')}
        <label class="btn small-btn kr-upbtn">${h(u.up)}<input type="file" accept="image/*,application/pdf" data-up="${d.k}" hidden></label></div></div>`).join('')}
      <div class="kr-aibox"><button type="button" class="btn primary" id="kr-ai">${h(u.ai)}</button><span class="rf-hint" id="kr-aimsg"></span></div></section>`;
}
function stepDetails() { return `<section class="rf-card">${sec('personal')}${sec('marital')}</section>`; }
function stepFamily() { return `<section class="rf-card">${sec('parents')}${sec('education')}</section>`; }
function stepSign() {
  const u = U();
  const box = (who, nameKey) => `<div class="kr-sig" data-sig="${who}"><b>${h(who === 'self' ? u.sigSelf : u.sigWife)}</b>
      <div class="kr-sigmode"><label><input type="radio" name="sm_${who}" value="draw"${S.sig[who] === 'draw' ? ' checked' : ''}> ${h(u.draw)}</label><label><input type="radio" name="sm_${who}" value="type"${S.sig[who] === 'type' ? ' checked' : ''}> ${h(u.type)}</label></div>
      ${S.sig[who] === 'draw' ? `<canvas width="520" height="150" class="kr-pad"></canvas><div>${(S.app.files?.[`sig_${who}`] || []).length ? '<span class="rf-par">✓ </span>' : ''}<button type="button" class="linkish" data-clear="${who}">${h(u.clear)}</button></div>`
    : `<input name="${nameKey}" class="kr-typed" value="${h(S.data[nameKey] || '')}" dir="ltr" placeholder="${h(who === 'self' ? `${S.data.legal_first || ''} ${S.data.legal_last || ''}`.trim() : `${S.data.wife_first || ''} ${S.data.wife_last || ''}`.trim())}">`}</div>`;
  return `<section class="rf-card"><h2>${h(u.sigT)}</h2>
      ${box('self', 'sig_self_name')}${married() ? box('wife', 'sig_wife_name') : ''}
      <label class="rf-f" style="max-width:220px">${h(u.sigDate)}<input name="sig_date" type="date" value="${h(S.data.sig_date || '')}"></label>
      <label class="rf-cons"><input type="checkbox" id="kr-ok"${S.ok ? ' checked' : ''}> ${h(u.confirm)}</label></section>`;
}

function render() {
  if (!S.ks || !S.app) { renderLogin(); return; }
  const u = U();
  const st = S.app.status || 'draft';
  const body = [stepDocs, stepDetails, stepFamily, stepSign][S.step]();
  frame(`<div class="kr-bar"><span class="kr-st kr-${st}">${h(u.st[st] || st)}</span><span class="rf-hint" dir="ltr">${h(S.app.email)}</span><span class="kr-sp"></span>
      <button type="button" class="btn small-btn" id="kr-save">${h(u.save)}</button><button type="button" class="linkish" id="kr-out">${h(u.logout)}</button></div>
    <ol class="rf-prog">${u.steps.map((t, i) => `<li class="${i === S.step ? 'on' : i < S.step ? 'done' : ''}" data-step="${i}">${h(t)}</li>`).join('')}</ol>
    <div id="kr-step">${body}</div><p class="rf-err" id="kr-err"></p>
    <div class="rf-nav">${S.step ? `<button type="button" class="btn" id="kr-back">${h(u.back)}</button>` : '<span></span>'}
      ${S.step < 3 ? `<button type="button" class="btn primary" id="kr-next">${h(u.next)}</button>` : `<button type="button" class="btn primary" id="kr-submit">${h(st === 'draft' ? u.submit : u.resubmit)}</button>`}</div>`);
  wire();
}
async function save(quiet) {
  readStep();
  try { const r = await pub('kaSave', { ks: S.ks, data: S.data, lang: S.lang }); S.app = r.app; S.dirty = false; if (!quiet) toast(U().saved); return true; } catch (e) { onErr(e); return false; }
}
function onErr(e) {
  if (String(e?.code || e?.message) === 'ka-login') { S.ks = ''; S.app = null; try { sessionStorage.removeItem(SK); } catch { /* */ } renderLogin(errText(e)); return; }
  const m = errText(e); const el = $('#kr-err'); if (el) el.textContent = m; toast(m, true);
}
function go(step) { readStep(); const was = S.step; S.step = step; if (S.dirty || was === 0) save(true); render(); window.scrollTo(0, 0); }

function wire() {
  const u = U();
  $('#kr-out').onclick = () => { S.ks = ''; S.app = null; try { sessionStorage.removeItem(SK); } catch { /* */ } renderLogin(); };
  $('#kr-save').onclick = () => save(false);
  $$('[data-step]').forEach((li) => { li.onclick = () => go(Number(li.dataset.step)); });
  $('#kr-back')?.addEventListener('click', () => go(S.step - 1));
  $('#kr-next')?.addEventListener('click', () => go(S.step + 1));
  // מצב משפחתי משנה את רשימת המסמכים
  $$('input[name=marital]').forEach((r) => { r.onchange = () => { S.data.marital = r.value; S.dirty = true; render(); }; });
  // העלאה / מחיקה
  $$('[data-up]').forEach((inp) => { inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const lab = inp.closest('label'); lab.classList.add('busy');
    try { const data = await fileData(f); const r = await pub('kaUpload', { ks: S.ks, kind: inp.dataset.up, data, name: f.name }); S.app = r.app; readStep(); render(); } catch (e) { onErr(e); lab.classList.remove('busy'); }
  }; });
  $$('[data-del]').forEach((b) => { b.onclick = async () => { const [k, i] = b.dataset.del.split(':'); try { const r = await pub('kaDelFile', { ks: S.ks, kind: k, i: Number(i) }); S.app = r.app; render(); } catch (e) { onErr(e); } }; });
  // 🤖 Gemini
  $('#kr-ai')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; const m = $('#kr-aimsg');
    b.disabled = true; m.textContent = u.aiBusy;
    try {
      await save(true);
      const r = await pub('kaAi', { ks: S.ks });
      const keys = Object.keys(r.fields || {}).filter((k) => r.fields[k] && r.fields[k] !== S.data[k]);
      keys.forEach((k) => { S.data[k] = r.fields[k]; S.aiKeys.add(k); });
      if (keys.length) { await save(true); S.step = 1; render(); toast(u.aiDone(keys.length)); } else { m.textContent = u.aiNone; b.disabled = false; }
    } catch (err) { m.textContent = errText(err); b.disabled = false; }
  });
  // חתימה
  $$('[name^=sm_]').forEach((r) => { r.onchange = () => { readStep(); S.sig[r.name.slice(3)] = r.value; render(); }; });
  $$('.kr-pad').forEach((cv) => pad(cv));
  $$('[data-clear]').forEach((b) => { b.onclick = () => { const cv = b.closest('.kr-sig').querySelector('canvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv._drawn = false; }; });
  $('#kr-ok')?.addEventListener('change', (e) => { S.ok = e.target.checked; });
  $('#kr-submit')?.addEventListener('click', submit);
}
function pad(cv) {
  const ctx = cv.getContext('2d'); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#102060';
  let on = false;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
  cv.onpointerdown = (e) => { on = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  cv.onpointermove = (e) => { if (!on) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); cv._drawn = true; };
  cv.onpointerup = () => { on = false; };
  cv.style.touchAction = 'none';
}
async function submit() {
  const u = U(); const b = $('#kr-submit');
  readStep();
  if (!S.ok) { onErr(new Error(u.confirm)); return; }
  b.disabled = true;
  try {
    for (const who of ['self', 'wife']) {
      if (who === 'wife' && !married()) continue;
      const cv = $(`.kr-sig[data-sig="${who}"] canvas`);
      if (S.sig[who] === 'draw' && cv && cv._drawn) { const r = await pub('kaUpload', { ks: S.ks, kind: `sig_${who}`, data: cv.toDataURL('image/png'), name: 'signature' }); S.app = r.app; }
    }
    const r = await pub('kaSave', { ks: S.ks, data: S.data, lang: S.lang, submit: true });
    S.app = r.app; S.dirty = false;
    frame(`<section class="rf-card kr-done"><h2>✓</h2><p>${h(u.sent)}</p><p><button type="button" class="btn" id="kr-again">${h(u.back)}</button></p></section>`);
    $('#kr-again').onclick = () => { S.step = 1; render(); };
  } catch (e) { onErr(e); b.disabled = false; }
}

export async function startKollelReg() {
  try { S.lang = localStorage.getItem('kollel-reg-lang') || (/^yi|^he/i.test(navigator.language) ? 'yi' : 'en'); } catch { /* */ }
  if (!UI[S.lang]) S.lang = 'en';
  let ks = ''; try { ks = sessionStorage.getItem(SK) || ''; } catch { /* */ }
  if (ks) { try { const r = await pub('kaGet', { ks }); S.ks = ks; setApp(r.app); S.step = r.app.status === 'draft' ? 0 : 1; } catch { /* */ } }
  render();
  window.addEventListener('beforeunload', (e) => { if (S.ks && S.dirty) { e.preventDefault(); e.returnValue = ''; } });
}
startKollelReg();
