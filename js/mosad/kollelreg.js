// 🕍 מרכז הכוללים אונגוואר — טופס הרשמה (ungvar.org/kollel/register). English / אידיש.
//    כניסה עם אימייל + קוד (בלי גוגל) · טיוטה נשמרת · מסמכים → 🤖 Gemini ממלא את השדות · חתימה (ציור או הקלדה).
import { CONFIG } from '../config.js?v=653';
import { SECTIONS, MARITAL, YESNO, printHtml, kindLabel, reqOf, kindState, fieldFor, ALL_KINDS } from './kollelfields.js?v=679';

const MOSAD = 'kollel';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SK = 'kollel-reg-session';

const UI = {
  en: { dir: 'ltr', title: 'Kollel Enrollment Form', sub: 'Merkaz HaKollelim · Khal Ungvar',
    login: 'Sign in', email: 'Email address', code: 'Your code (at least 6 characters)', newForm: 'Start a new form', cont: 'Continue my form',
    signIn: 'Sign in', signUp: 'Sign up — new form', create: 'Create my form', newCode: 'Choose a code (at least 6 characters)', code2: 'Type the code again',
    codeMismatch: 'The two codes are not the same.', inHint: 'Use the email and code you chose when you started. Forgot your code? Call the office.', upHint: 'Remember your code — you will need it to come back and continue or edit your form.',
    blankBtn: '⬇ Blank form to print (PDF)', blankHint: 'Prefer paper? Print the form, fill it in by hand and bring it to the office with copies of the documents. In the print window you can also choose "Save as PDF".',
    loginHint: 'New? Choose a code and press "Start a new form". Next time, use the same email and code to continue or edit your form. Forgot your code? Call the office.',
    startT: 'Step 1 — open your form', startHint: 'Choose your marital status and upload the ID and Social Security cards below. As soon as they are approved, your form opens.',
    needT: 'Documents we need', dropAll: 'Drag all your documents here — or click to choose', dropHint: 'Photos from your phone or PDFs. You can drop many files at once; we sort them automatically.',
    pending: 'Waiting to be checked', recheck: 'Check again', notRec: 'Not recognized', changeType: 'This is:', openBtn: 'Continue to the form →', openWait: 'Opening your form and filling in your details… (up to a minute)',
    gateMissing: 'Still needed to open the form:', stillMissing: 'Still missing:', allDone: 'All documents received ✓', unmarriedTax: '(yours or a parent\'s)',
    steps: ['Documents', 'Details', 'Parents & Education', 'Signature'], save: 'Save', saved: 'Saved ✓', next: 'Next →', back: '← Back', logout: 'Sign out',
    maritalQ: 'Marital status', docsT: 'Required documents', docsHint: 'Upload a clear photo (from your phone) or a PDF. Front and back are fine as 2 files.',
    up: '+ Upload', del: 'Remove', drop: 'Drag files here, or click to choose', checking: 'Checking the document…', okDoc: 'Looks good',
    auto: 'Fill in my details automatically from the documents', autoHint: 'When you press "Next", your name, date of birth, SSN etc. are filled in from the documents. You can check and correct everything.',
    ai: '✨ Fill my details from the documents', aiBusy: 'Reading your documents… (up to a minute)', aiDone: (n) => `${n} fields were filled from your documents — please check every one carefully.`,
    aiNone: 'Nothing could be read. Please fill in the details yourself.', aiFlag: 'filled from documents — please check',
    sigT: 'Signature', sigSelf: 'Applicant\'s legal signature', sigWife: 'Spouse\'s legal signature', draw: 'Draw', type: 'Type my full name', clear: 'Clear', sigDate: 'Date',
    confirm: 'I confirm that the information in this form is true and correct.', submit: 'Save & send to the office', resubmit: 'Save & send to the office',
    sent: 'Sent to the office — thank you! Everything you filled in is saved.', sentMissing: 'Still missing (you can come back with your email and code and complete it any time):', sentFull: 'Your form is complete ✓', autosaved: 'Saved ✓',
    st: { draft: 'Not opened yet', open: 'In progress — not sent yet', submitted: 'Received ✓', updated: 'Updated ✓', approved: 'Approved ✓', rejected: 'Please contact the office' },
    err: { 'ka-bad': 'Wrong code.', 'ka-none': 'There is no form with this email yet — you can create one here.', 'ka-exists': 'A form with this email already exists — sign in here with your code.',
      'ka-locked': 'Too many attempts. Try again in 15 minutes.', 'ka-short-code': 'The code must be at least 6 characters.', 'ka-bad-email': 'Invalid email address.',
      'ka-login': 'Please sign in again.', 'file-big': 'The file is too large.', 'bad-file': 'Only a photo or a PDF.', 'too-many': 'Too many attempts — try later.',
      'ai-off': 'Automatic reading is not available right now.', 'ai-no-docs': 'Upload the ID / SS card / certificates first.', 'missing-sig': 'Please sign the form.', 'ai-busy': 'The checking service is busy — please press "Check again" in a minute.', 'ka-not-open': 'Please finish step 1 first.' },
    missing: 'Please fill in:', missingDocs: 'Missing documents:', yes: 'Yes', no: 'No', choose: '—' },
  yi: { dir: 'rtl', title: 'טופס הרשמה פאר׳ן כולל', sub: 'מרכז הכוללים · קהל אונגוואר',
    login: 'אריינגיין', email: 'אימעיל אדרעס', code: 'דיין קאוד (כאטש 6 אותיות/ציפערן)', newForm: 'אנהייבן א נייע פארעם', cont: 'ווייטער מיין פארעם',
    signIn: 'אריינגיין', signUp: 'איינשרייבן — נייע פארעם', create: 'עפענען מיין פארעם', newCode: 'קלייב אויס א קאוד (כאטש 6 אותיות)', code2: 'שרייב נאכאמאל דעם קאוד',
    codeMismatch: 'די צוויי קאודס זענען נישט די זעלבע.', inHint: 'נוץ די אימעיל און קאוד וואס דו האסט אויסגעקליבן. פארגעסן דעם קאוד? רוף דעם אפיס.', upHint: 'געדענק דעם קאוד — דו וועסט עס דארפן צו צוריקקומען און ווייטער פירן אדער טוישן.',
    blankBtn: '⬇ א ליידיגע פארעם צום דרוקן (PDF)', blankHint: 'וועלסט אויספילן אויף פאפיר? דרוק אויס די פארעם, פיל אויס מיט די האנט און ברענג עס צום אפיס מיט קאפיעס פון די דאקומענטן. אינעם דרוק-פענצטער קען מען אויך אויסקלייבן "Save as PDF".',
    loginHint: 'נייע? קלייב אויס א קאוד און דריק "אנהייבן א נייע פארעם". דאס קומענדיגע מאל, מיט די זעלבע אימעיל און קאוד קענסטו ווייטער פירן אדער טוישן. פארגעסן דעם קאוד? רוף דעם אפיס.',
    startT: 'טייל 1 — עפענען די פארעם', startHint: 'קלייב אויס דעם סטאטוס און לייג ארויף די ID און סאשעל סעקיוריטי קארטלעך. ווי נאר זיי ווערן באשטעטיגט, עפנט זיך די פארעם.',
    needT: 'וואס מיר דארפן', dropAll: 'שלעפ אהער אלע דאקומענטן — אדער דריק צו אויסקלייבן', dropHint: 'בילדער פונעם טעלעפאן אדער PDF. מען קען אריינלייגן אסאך טעקעס אויף איינמאל; מיר סארטירן זיי אליין.',
    pending: 'ווארט אויף א קאנטראל', recheck: 'נאכאמאל קאנטראלירן', notRec: 'נישט דערקענט', changeType: 'דאס איז:', openBtn: 'ווייטער צו די פארעם ←', openWait: 'מען עפנט די פארעם און מען פילט אויס די פרטים… (ביז א מינוט)',
    gateMissing: 'עס פעלט נאך צו עפענען די פארעם:', stillMissing: 'עס פעלט נאך:', allDone: 'אלע דאקומענטן באקומען ✓', unmarriedTax: '(דיינע אדער פון א טאטע/מאמע)',
    steps: ['דאקומענטן', 'פרטים', 'עלטערן און ישיבות', 'אונטערשריפט'], save: 'אפהיטן', saved: 'אפגעהיטן ✓', next: 'ווייטער ←', back: '→ צוריק', logout: 'ארויסגיין',
    maritalQ: 'סטאטוס', docsT: 'נויטיגע דאקומענטן', docsHint: 'לייג ארויף א קלארע בילד (פונעם טעלעפאן) אדער א PDF. פאראויס און הינטן — מעג זיין 2 טעקעס.',
    up: '+ ארויפלייגן', del: 'אראפנעמען', drop: 'שלעפ אהער די טעקעס, אדער דריק צו אויסקלייבן', checking: 'מען קוקט איבער דעם דאקומענט…', okDoc: 'זעט אויס גוט',
    auto: 'אויספילן מיינע פרטים אויטאמאטיש פון די דאקומענטן', autoHint: 'ווען דו דריקסט "ווייטער", ווערן דער נאמען, געבורטס טאג, SSN א.א.וו. אויסגעפילט פון די דאקומענטן. דו קענסט אלעס איבערקוקן און פאררעכטן.',
    ai: '✨ אויספילן מיינע פרטים פון די דאקומענטן', aiBusy: 'מען לייענט די דאקומענטן… (ביז א מינוט)', aiDone: (n) => `${n} פעלדער זענען אויסגעפילט פון די דאקומענטן — ביטע קוק איבער יעדעס איינס.`,
    aiNone: 'מען האט גארנישט געקענט לייענען. ביטע פיל אויס אליין.', aiFlag: 'אויסגעפילט פון די דאקומענטן — ביטע קוק איבער',
    sigT: 'אונטערשריפט', sigSelf: 'דיין אונטערשריפט', sigWife: 'די ווייב׳ס אונטערשריפט', draw: 'צייכענען', type: 'שרייבן דעם פולן נאמען', clear: 'אויסמעקן', sigDate: 'דאטום',
    confirm: 'איך באשטעטיג אז די אינפארמאציע אין די פארעם איז ריכטיג.', submit: 'אפהיטן און שיקן צום אפיס', resubmit: 'אפהיטן און שיקן צום אפיס',
    sent: 'געשיקט צום אפיס — א דאנק! אלעס וואס דו האסט אויסגעפילט איז אפגעהיטן.', sentMissing: 'עס פעלט נאך (דו קענסט צוריקקומען מיט די אימעיל און קאוד און ענדיגן ווען דו ווילסט):', sentFull: 'די פארעם איז פולשטענדיג ✓', autosaved: 'אפגעהיטן ✓',
    st: { draft: 'נאך נישט געעפנט', open: 'אין מיטן — נאך נישט אריינגעשיקט', submitted: 'באקומען ✓', updated: 'דערהיינטיגט ✓', approved: 'באשטעטיגט ✓', rejected: 'ביטע פארבינד זיך מיט׳ן אפיס' },
    err: { 'ka-bad': 'אומריכטיגער קאוד.', 'ka-none': 'ס׳איז נאך נישטא קיין פארעם מיט די אימעיל — דא קענסטו עפענען א נייע.', 'ka-exists': 'ס׳איז שוין דא א פארעם מיט די אימעיל — גיי דא אריין מיט דיין קאוד.',
      'ka-locked': 'צופיל פרואוון. פרוביר נאכאמאל אין 15 מינוט.', 'ka-short-code': 'דער קאוד דארף זיין כאטש 6 אותיות.', 'ka-bad-email': 'אומריכטיגע אימעיל.',
      'ka-login': 'ביטע גיי נאכאמאל אריין.', 'file-big': 'די טעקע איז צו גרויס.', 'bad-file': 'נאר א בילד אדער PDF.', 'too-many': 'צופיל פרואוון — פרוביר שפעטער.',
      'ai-off': 'אויטאמאטיש לייענען ארבעט יעצט נישט.', 'ai-no-docs': 'לייג קודם ארויף די ID / SS קארטל / סערטיפיקאטן.', 'missing-sig': 'ביטע אונטערשרייב די פארעם.', 'ai-busy': 'דער קאנטראל איז יעצט פארנומען — ביטע דריק "נאכאמאל קאנטראלירן" אין א מינוט.', 'ka-not-open': 'ביטע ענדיג קודם טייל 1.' },
    missing: 'ביטע פיל אויס:', missingDocs: 'עס פעלן דאקומענטן:', yes: 'יא', no: 'ניין', choose: '—' },
};
const S = { auto: true, lang: 'en', ks: '', app: null, step: 0, data: {}, aiKeys: new Set(), dirty: false, busy: false, sig: { self: 'draw', wife: 'draw' }, ok: false };
const U = () => UI[S.lang];
const L = (en, yi) => (S.lang === 'yi' ? yi : en);
const errText = (e) => { const c = String(e?.code || e?.message || e); if (c.startsWith('missing:')) return `${U().missing} ${c.slice(8).split(',').map((k) => fieldLabel(k)).join(', ')}`; if (c.startsWith('missing-docs:')) return `${U().missingDocs} ${c.slice(13).split(',').map((k) => docLabel(k)).join(', ')}`; return U().err[c] || c; };
const fieldLabel = (k) => { for (const s of SECTIONS) { const f = s.fields.find((x) => x[0] === k); if (f) return L(f[1], f[2]); } return k; };
const docLabel = (k) => kindLabel(k, S.app?.taxYears, S.lang);

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
/** mode: '' = שני הכפתורים · 'in' = כניסה · 'up' = הרשמה */
function renderLogin(msg = '', mode = S.lmode || '', email = '') {
  const u = U(); S.lmode = mode;
  const blank = `<section class="rf-card kr-login kr-blank"><button type="button" class="btn" id="kr-blank">${h(u.blankBtn)}</button><p class="rf-hint">${h(u.blankHint)}</p></section>`;
  if (!mode) {
    frame(`<section class="rf-card kr-login kr-choose"><button type="button" class="btn primary" data-mode="in">${h(u.cont)}</button><button type="button" class="btn" data-mode="up">${h(u.newForm)}</button>
      ${msg ? `<p class="rf-err">${h(msg)}</p>` : ''}<p class="rf-hint">${h(u.loginHint)}</p></section>${blank}`);
  } else {
    const up = mode === 'up';
    frame(`<section class="rf-card kr-login"><h2>${h(up ? u.signUp : u.signIn)}</h2>
      <form class="rf-grid" id="kr-lf" onsubmit="return false">
        <label class="rf-f rf-wide">${h(u.email)}<input name="email" type="email" dir="ltr" autocomplete="email" value="${h(email)}" required></label>
        <label class="rf-f rf-wide">${h(up ? u.newCode : u.code)}<input name="code" type="password" dir="ltr" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" required></label>
        ${up ? `<label class="rf-f rf-wide">${h(u.code2)}<input name="code2" type="password" dir="ltr" autocomplete="new-password" minlength="6" required></label>` : ''}
      </form>
      ${msg ? `<p class="rf-err">${h(msg)}</p>` : ''}
      <div class="rf-nav"><button type="button" class="linkish" data-mode="">${h(u.back)}</button><button type="button" class="btn primary" id="kr-go">${h(up ? u.create : u.signIn)}</button></div>
      <p class="rf-hint">${h(up ? u.upHint : u.inHint)}</p></section>${blank}`);
    $('#kr-lf').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#kr-go').click(); } };
    $('[name=email]').focus();
    $('#kr-go').onclick = async () => {
      const f = $('#kr-lf').elements; const b = $('#kr-go');
      const em = f.email.value.trim();
      if (up && f.code.value !== f.code2.value) { renderLogin(u.codeMismatch, 'up', em); return; }
      if (S.busy) return; S.busy = true; b.disabled = true;
      try {
        const r = await pub('kaAuth', { email: em, code: f.code.value, create: up, lang: S.lang });
        S.ks = r.ks; S.lmode = ''; try { sessionStorage.setItem(SK, r.ks); } catch { /* */ }
        setApp(r.app); S.step = 0; render();
      } catch (e) {
        const c = String(e?.code || e?.message);
        if (c === 'ka-none') renderLogin(errText(e), 'up', em);
        else if (c === 'ka-exists') renderLogin(errText(e), 'in', em);
        else renderLogin(errText(e), mode, em);
      } finally { S.busy = false; }
    };
  }
  $$('[data-mode]').forEach((x) => { x.onclick = () => renderLogin('', x.dataset.mode, $('[name=email]')?.value?.trim() || ''); });
  $('#kr-blank').onclick = () => {
    const y = new Date().getFullYear();
    const w = window.open('', '_blank'); if (!w) return;
    w.document.open(); w.document.write(printHtml({ email: '', data: {}, files: {}, taxYears: [y - 2, y - 1] }, { blank: true })); w.document.close();
  };
}
function setApp(app) { S.app = app; S.data = { ...(app.data || {}) }; if (!S.data.marital) S.data.marital = 'married'; if (!S.data.sig_date) S.data.sig_date = new Date().toISOString().slice(0, 10); }

// ---------- שדות ----------
const opened = () => (S.app?.status || 'draft') !== 'draft';
function input(f) {
  const [k, en, yi, type, o] = f;
  const v = S.data[k] ?? '';
  const lab = `${h(L(en, yi))}${o.req || (o.m && married() && ['wife_first', 'wife_last', 'wife_ssn', 'wedding_date'].includes(k)) ? ' *' : ''}`;
  const flag = S.aiKeys.has(k) ? `<span class="kr-ai">✨ ${h(U().aiFlag)}</span>` : '';
  const dis = o.lock && opened() ? ' disabled' : '';
  let el;
  if (type === 'select') el = `<select name="${k}"${dis}><option value="">${U().choose}</option>${o.opts.map(([val, e, y]) => `<option value="${val}"${v === val ? ' selected' : ''}>${h(L(e, y))}</option>`).join('')}</select>`;
  else if (type === 'yesno') el = `<span class="rf-yn">${YESNO.map(([val, e, y]) => `<label><input type="radio" name="${k}" value="${val}"${v === val ? ' checked' : ''}> ${h(L(e, y))}</label>`).join('')}</span>`;
  else if (type === 'area') el = `<textarea name="${k}" rows="3">${h(v)}</textarea>`;
  else el = `<input name="${k}" type="${type === 'date' ? 'date' : type === 'num' ? 'number' : type === 'tel' ? 'tel' : 'text'}" value="${h(v)}"${type === 'ssn' ? ' inputmode="numeric" placeholder="###-##-####" dir="ltr"' : ''}${type === 'tel' ? ' dir="ltr"' : ''}${o.rtl ? ' dir="rtl"' : ''}>`;
  return `<label class="rf-f${o.wide || type === 'area' || type === 'yesno' ? ' rf-wide' : ''}${S.aiKeys.has(k) ? ' kr-filled' : ''}">${lab}${el}${flag}</label>`;
}
const sec = (id) => { const s = SECTIONS.find((x) => x.id === id); const fs = s.fields.filter((f) => fieldFor(f, S.data.marital) && !f[4].print); return `<h3 class="kr-h3">${h(L(s.en, s.yi))}</h3><div class="rf-grid">${fs.map(input).join('')}</div>`; };
function readStep() {
  const box = $('#kr-step'); if (!box) return;
  $$('input[name], select[name], textarea[name]', box).forEach((el) => {
    if (el.disabled) return;
    if (el.type === 'radio') { if (el.checked && el.name !== 'kr-kind') S.data[el.name] = el.value; return; }
    if (el.type === 'checkbox' || el.type === 'password' || el.type === 'file' || el.dataset.kind !== undefined) return;
    let v = el.value;
    if (el.closest('.rf-f') && SECTIONS.some((s) => s.fields.some((f) => f[0] === el.name && f[3] === 'ssn'))) { const d = v.replace(/\D/g, ''); if (d.length === 9) v = `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`; }
    if (S.data[el.name] !== v) { S.data[el.name] = v; S.dirty = true; }
  });
}

// ---------- מסמכים: רשימה למעלה + מקום אחד להעלאה + הקבצים (ה-AI ממיין) ----------
const ICON = { ok: '✅', bad: '⚠️', pending: '⏳', 'pending?': '⏳', '': '⬜' };
function checklist(kinds) {
  const f = S.app.files || {};
  return `<ul class="kr-need">${kinds.map((k) => { const st = kindState(f, k); return `<li class="st-${st.replace('?', '') || 'none'}"><span>${ICON[st]}</span> ${h(docLabel(k))}${S.data.marital === 'unmarried' && k.startsWith('tax') ? ` <small>${h(U().unmarriedTax)}</small>` : ''}</li>`; }).join('')}</ul>`;
}
function fileList() {
  const u = U(); const pool = S.app.files?.pool || [];
  const r = reqOf(S.data.marital); const opts = [...new Set([...r.gate, ...r.rest, ...ALL_KINDS])];
  return pool.length ? `<div class="kr-pool">${pool.map((x, i) => { const st = x.check?.status || 'pending';
    return `<div class="kr-pf st-${st}"><div class="kr-pf-h"><span>${ICON[st]} 📄 ${h(x.name)}</span>
        <span class="kr-pf-k">${(x.kinds || []).length ? x.kinds.map((k) => h(docLabel(k))).join(' + ') : `<i>${h(st === 'pending' ? u.pending : u.notRec)}</i>`}</span>
        <button type="button" class="linkish" data-del="${i}">${h(u.del)}</button></div>
      ${st === 'bad' && (x.check?.en || x.check?.yi) ? `<div class="kr-pf-m">${h(L(x.check.en, x.check.yi || x.check.en))}</div>` : ''}
      ${st !== 'ok' ? `<div class="kr-pf-a">${st === 'pending' ? `<button type="button" class="btn small-btn" data-re="${i}">${h(u.recheck)}</button>` : ''}
        <label>${h(u.changeType)} <select data-kind="${i}"><option value="">—</option>${opts.map((k) => `<option value="${k}"${(x.kinds || [])[0] === k ? ' selected' : ''}>${h(docLabel(k))}</option>`).join('')}</select></label></div>` : ''}</div>`; }).join('')}</div>` : '';
}
const dropZone = () => `<label class="kr-big-drop" data-drop>⬆ <b>${h(U().dropAll)}</b><small>${h(U().dropHint)}</small><input type="file" accept="image/*,application/pdf" multiple data-up hidden></label>`;
function stepStart() {
  const u = U(); const r = reqOf(S.data.marital);
  const miss = r.gate.filter((k) => kindState(S.app.files, k) !== 'ok');
  return `<section class="rf-card"><h2>${h(u.startT)}</h2><p class="rf-hint">${h(u.startHint)}</p>
      <div class="kr-mar">${MARITAL.map(([v, e, y]) => `<label class="kr-pill"><input type="radio" name="marital" value="${v}"${S.data.marital === v ? ' checked' : ''}> ${h(L(e, y))}</label>`).join('')}</div>
      <div class="rf-grid" style="margin-top:12px"><label class="rf-f rf-wide">${h(L('Your name in Yiddish', 'דיין נאמען אויף אידיש'))} *<input name="yi_name" dir="rtl" value="${h(S.data.yi_name || '')}" placeholder="${h(L('e.g. משה יעקב גרינפעלד', 'למשל: משה יעקב גרינפעלד'))}" autocomplete="off"></label></div></section>
    <section class="rf-card"><h3 class="kr-h3">${h(u.needT)}</h3>${checklist(r.gate)}${dropZone()}${fileList()}
      <p class="kr-miss">${miss.length || !String(S.data.yi_name || '').trim() ? `${h(u.gateMissing)} ${[...(String(S.data.yi_name || '').trim() ? [] : [h(L('Name in Yiddish', 'נאמען אויף אידיש'))]), ...miss.map((k) => h(docLabel(k)))].join(', ')}` : ''}</p></section>`;
}
function stepDocs() {
  const u = U(); const r = reqOf(S.data.marital);
  const miss = [...r.gate, ...r.rest].filter((k) => kindState(S.app.files, k) !== 'ok');
  return `<section class="rf-card"><h3 class="kr-h3">${h(u.needT)}</h3>${checklist([...r.gate, ...r.rest])}${dropZone()}${fileList()}
      <p class="kr-miss">${miss.length ? `${h(u.stillMissing)} ${miss.map((k) => h(docLabel(k))).join(', ')}` : `<span class="rf-par">${h(u.allDone)}</span>`}</p>
      <div class="kr-aibox"><label class="kr-switch"><input type="checkbox" id="kr-auto"${S.auto ? ' checked' : ''}><span></span></label><div><b>${h(u.auto)}</b><div class="rf-hint">${h(u.autoHint)}</div></div><span class="rf-hint" id="kr-aimsg"></span></div></section>`;
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
  if (st === 'draft') {
    const ready = reqOf(S.data.marital).gate.every((k) => kindState(S.app.files, k) === 'ok') && String(S.data.yi_name || '').trim();
    frame(`<div class="kr-bar"><span class="kr-st kr-${st}">${h(u.st[st] || st)}</span><span class="rf-hint" dir="ltr">${h(S.app.email)}</span><span class="kr-sp"></span><button type="button" class="linkish" id="kr-out">${h(u.logout)}</button></div>
      <div id="kr-step">${stepStart()}</div><p class="rf-err" id="kr-err"></p>
      <div class="rf-nav"><span></span><button type="button" class="btn primary" id="kr-open"${ready ? '' : ' disabled'}>${h(u.openBtn)}</button></div>`);
    wire(); return;
  }
  const body = [stepDocs, stepDetails, stepFamily, stepSign][S.step]();
  frame(`<div class="kr-bar"><span class="kr-st kr-${st}">${h(u.st[st] || st)}</span><span class="rf-hint" dir="ltr">${h(S.app.email)}</span><span class="kr-sp"></span>
      <button type="button" class="btn small-btn" id="kr-save">${h(u.save)}</button><button type="button" class="linkish" id="kr-out">${h(u.logout)}</button></div>
    <ol class="rf-prog">${u.steps.map((t, i) => `<li class="${i === S.step ? 'on' : i < S.step ? 'done' : ''}" data-step="${i}">${h(t)}</li>`).join('')}</ol>
    <div id="kr-step">${body}</div><p class="rf-err" id="kr-err"></p>
    <div class="rf-nav">${S.step ? `<button type="button" class="btn" id="kr-back">${h(u.back)}</button>` : '<span></span>'}
      ${S.step < 3 ? `<button type="button" class="btn primary" id="kr-next">${h(u.next)}</button>` : `<button type="button" class="btn primary" id="kr-submit">${h(st === 'open' ? u.submit : u.resubmit)}</button>`}</div>`);
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
/** אחרי מילוי של השומר: הנתונים החדשים, וסימון ✨ לשדות שהתמלאו */
function takeAi(r) { const keep = { ...S.data }; setApp(r.app); (r.filled || []).forEach((k) => S.aiKeys.add(k)); Object.keys(keep).forEach((k) => { if (String(keep[k] || '').trim() && !String(S.data[k] || '').trim()) S.data[k] = keep[k]; }); }
const aiSig = () => JSON.stringify((S.app.files?.pool || []).filter((x) => x.check?.status === 'ok').map((x) => x.at));
async function autoFill() {
  const key = `kr-ai:${S.app.app_id}`; let last = ''; try { last = localStorage.getItem(key) || ''; } catch { /* */ }
  const sig = aiSig();
  if (!S.auto || sig === last || sig === '[]') return 0;
  const m = $('#kr-aimsg'); if (m) m.textContent = U().aiBusy;
  const nb = $('#kr-next'); if (nb) { nb.disabled = true; nb.textContent = U().aiBusy; }
  try {
    await save(true);
    const r = await pub('kaAi', { ks: S.ks });
    try { localStorage.setItem(key, sig); } catch { /* */ }
    takeAi(r);
    return (r.filled || []).length;
  } catch (err) { toast(errText(err), true); return 0; }
}
async function go(step) {
  readStep(); const was = S.step;
  let n = 0;
  if (was === 0 && step > 0) n = await autoFill();
  S.step = step; if (S.dirty || was === 0) save(true); render(); window.scrollTo(0, 0);
  if (n) toast(U().aiDone(n));
}

function wire() {
  const u = U();
  $('#kr-out').onclick = () => { S.ks = ''; S.app = null; try { sessionStorage.removeItem(SK); } catch { /* */ } renderLogin(); };
  $('#kr-save')?.addEventListener('click', () => save(false));
  $$('[data-step]').forEach((li) => { li.onclick = () => go(Number(li.dataset.step)); });
  $('#kr-back')?.addEventListener('click', () => go(S.step - 1));
  $('#kr-next')?.addEventListener('click', () => go(S.step + 1));
  // מצב משפחתי (רק בחלק 1) משנה את רשימת המסמכים
  $$('input[name=marital]').forEach((r) => { r.onchange = async () => { S.data.marital = r.value; S.dirty = true; render(); await save(true); render(); }; });
  // העלאה: מקום אחד — גרירה או לחיצה; כל קובץ נבדק ומסווג ע"י ה-AI
  const upload = async (list) => {
    const fl = [...list].filter(Boolean); if (!fl.length) return;
    const z = $('[data-drop]'); z?.classList.add('busy');
    for (const [i, f] of fl.entries()) {
      if (z) z.querySelector('b').textContent = `⏳ ${u.checking} (${i + 1}/${fl.length})`;
      try { const data = await fileData(f); const r = await pub('kaUpload', { ks: S.ks, data, name: f.name }); S.app = r.app; } catch (e) { onErr(e); }
    }
    readStep(); render();
  };
  $('[data-up]')?.addEventListener('change', (e) => upload(e.target.files));
  const z = $('[data-drop]');
  if (z) {
    z.ondragover = (e) => { e.preventDefault(); z.classList.add('over'); };
    z.ondragleave = () => z.classList.remove('over');
    z.ondrop = (e) => { e.preventDefault(); z.classList.remove('over'); upload(e.dataTransfer.files); };
  }
  const recheck = async (i, kinds, el) => {
    if (el) { el.disabled = true; el.closest('.kr-pf')?.classList.add('busy'); }
    try { const r = await pub('kaRecheck', { ks: S.ks, i, ...(kinds ? { kinds } : {}) }); S.app = r.app; } catch (e) { onErr(e); }
    readStep(); render();
  };
  $$('[data-re]').forEach((b) => { b.onclick = () => recheck(Number(b.dataset.re), null, b); });
  $$('[data-kind]').forEach((sel) => { sel.onchange = () => { if (sel.value) recheck(Number(sel.dataset.kind), [sel.value], sel); }; });
  $$('[data-del]').forEach((b) => { b.onclick = async () => { try { const r = await pub('kaDelFile', { ks: S.ks, i: Number(b.dataset.del) }); S.app = r.app; readStep(); render(); } catch (e) { onErr(e); } }; });
  $('#kr-auto')?.addEventListener('change', (e) => { S.auto = e.target.checked; try { localStorage.setItem('kollel-reg-auto', S.auto ? '1' : '0'); } catch { /* */ } });
  // נאמען אויף אידיש — חובה בחלק 1 (בלי זה אי אפשר להמשיך)
  const yiIn = $('#kr-step input[name=yi_name]');
  if (yiIn && !opened()) {
    const gateOk = () => reqOf(S.data.marital).gate.every((k) => kindState(S.app.files, k) === 'ok');
    yiIn.oninput = () => { S.data.yi_name = yiIn.value; const ok = gateOk() && yiIn.value.trim(); const b = $('#kr-open'); if (b) b.disabled = !ok; const m = $('.kr-miss'); if (m && ok) m.textContent = ''; };
    yiIn.onchange = () => { S.data.yi_name = yiIn.value.trim(); save(true).then(() => { const m = $('.kr-miss'); if (m && yiIn.value.trim() && !reqOf(S.data.marital).gate.filter((k) => kindState(S.app.files, k) !== 'ok').length) m.textContent = ''; }); };
  }
  // סוף חלק 1 → נפתחת רשומה + מילוי אוטומטי
  $('#kr-open')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = u.openWait;
    try { const r = await pub('kaOpen', { ks: S.ks, data: S.data }); takeAi(r); try { localStorage.setItem(`kr-ai:${S.app.app_id}`, aiSig()); } catch { /* */ } S.step = 0; render(); window.scrollTo(0, 0); if ((r.filled || []).length) toast(u.aiDone(r.filled.length)); } catch (err) { onErr(err); b.disabled = false; b.textContent = u.openBtn; }
  });
  // חתימה
  $$('[name^=sm_]').forEach((r) => { r.onchange = () => { readStep(); S.sig[r.name.slice(3)] = r.value; render(); }; });
  $$('.kr-pad').forEach((cv) => pad(cv));
  $$('[data-clear]').forEach((b) => { b.onclick = () => { const cv = b.closest('.kr-sig').querySelector('canvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv._drawn = false; }; });
  $('#kr-ok')?.addEventListener('change', (e) => { S.ok = e.target.checked; });
  // 💾 שמירה אוטומטית — כמה שניות אחרי שמקלידים; אצל הגבאי זה מופיע מיד
  const stepBox = $('#kr-step');
  if (stepBox && opened()) {
    const kick = (e) => { if (e.target.matches('[data-up], [data-kind], #kr-auto, #kr-ok, [name^=sm_]')) return; S.dirty = true; clearTimeout(S.asT); S.asT = setTimeout(async () => { if (!S.dirty) return; if (await save(true)) { const el = $('#kr-save'); if (el) { el.textContent = U().autosaved; setTimeout(() => { if (el.isConnected) el.textContent = U().save; }, 1800); } } }, 2500); };
    stepBox.addEventListener('input', kick); stepBox.addEventListener('change', kick);
  }
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
    const miss = r.app.progress?.missing || [];
    const lab = (m) => (m === 'sig' ? U().sigT : m.startsWith('d:') ? docLabel(m.slice(2)) : fieldLabel(m.slice(2)));
    frame(`<section class="rf-card kr-done"><h2>✓</h2><p>${h(u.sent)}</p>
      ${miss.length ? `<div class="kr-left"><b>${h(u.sentMissing)}</b><ul>${miss.map((m) => `<li>${h(lab(m))}</li>`).join('')}</ul></div>` : `<p class="rf-par"><b>${h(u.sentFull)}</b></p>`}
      <p><button type="button" class="btn" id="kr-again">${h(u.back)}</button></p></section>`);
    $('#kr-again').onclick = () => { S.step = 0; render(); };
  } catch (e) { onErr(e); b.disabled = false; }
}

export async function startKollelReg() {
  try { S.lang = localStorage.getItem('kollel-reg-lang') || (/^yi|^he/i.test(navigator.language) ? 'yi' : 'en'); } catch { /* */ }
  if (!UI[S.lang]) S.lang = 'en';
  try { S.auto = localStorage.getItem('kollel-reg-auto') !== '0'; } catch { /* */ }
  let ks = ''; try { ks = sessionStorage.getItem(SK) || ''; } catch { /* */ }
  if (ks) { try { const r = await pub('kaGet', { ks }); S.ks = ks; setApp(r.app); S.step = 0; } catch { /* */ } }
  render();
  window.addEventListener('beforeunload', (e) => { if (S.ks && S.dirty) { e.preventDefault(); e.returnValue = ''; } });
}
startKollelReg();
