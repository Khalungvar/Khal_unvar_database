// 📝 טופס הרשמה לישיבת בית שערים (פארן עולם — אן לאגאין) + אזור אישי פאר די עלטערן (?t=…).
// עברית / אידיש / English. די טעקסטן און סכומים קומען פון "⚙️ הגדרות רישום" (אדער די ברירות מחדל).
import { CONFIG } from '../config.js?v=529';
import { toHebrew, fromHebrew, monthsOf, hebrewNumber, yearLabel, isoToHebrewText, todayIso } from '../hebdate.js?v=529';
import { mergeConf, mergeTexts, fill } from './reg-defaults.js?v=529';
import { suggest, details, placesEnabled } from '../places.js?v=529';

const MOSAD = 'yeshiva';
const DRAFT = 'reg-draft-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const UI = {
  he: { dir: 'rtl', langName: 'עברית', steps: ['מידע ותנאים', 'הבחור', 'ההורים', 'לימודים וצוות', 'מסמכים', 'תשלום ואישורים', 'סיכום ושליחה'],
    next: 'המשך ←', back: '→ חזרה', send: 'שליחת טופס ההרשמה', sending: 'שולח…', req: 'שדה חובה', badEmail: 'כתובת מייל לא תקינה', badPhone: 'מספר לא תקין — יש לכלול קידומת מדינה (למשל +1 או +44)',
    phoneHint: 'כולל קידומת מדינה, למשל +1 718 555 1234', savedAs: 'יישמר כ:', yes: 'כן', no: 'לא', heb: 'תאריך עברי', civ: 'תאריך לועזי', day: 'יום', month: 'חודש', year: 'שנה',
    f: { first_name: 'שם פרטי', last_name: 'שם משפחה', birth_date: 'תאריך לידה', home_phone: 'טלפון בבית', engaged: 'האם הבחור מאורס?', wedding_date: 'תאריך החתונה',
      father_name: 'שם האב', mother_family: 'שם משפחת האם', father_phone: 'טלפון האב', mother_phone: 'טלפון האם', email: 'כתובת דוא״ל', community: 'הקהילה שהמשפחה משתייכת אליה',
      address: 'כתובת מגורים מלאה', city: 'עיר', state: 'מדינה / מחוז', zip: 'מיקוד', country: 'ארץ',
      yeshiva_ketana: 'הישיבה הקטנה שבה למד', yeshiva_gedola: 'הישיבה הגדולה שבה למד / לומד כיום', yeshiva_other: 'ישיבה נוספת שבה למד לאחרונה (לא חובה)',
      staff1: 'מנהל / משגיח', staff2: 'מגיד שיעור א׳', staff3: 'מגיד שיעור ב׳', sname: 'שם', sphone: 'טלפון נייד', notes: 'הערות נוספות להנהלת הישיבה (לא חובה)' },
    staffNote: 'יש למלא לפחות שניים מתוך שלושת אנשי הצוות.', needStaff: 'יש למלא שם וטלפון של לפחות שני אנשי צוות.',
    addrHint: 'מתחילים להקליד — ובוחרים מהרשימה. אם הכתובת לא מופיעה, ממלאים ידנית.',
    docs: { photo: 'תמונה ברורה של הבחור', passport: 'צילום דרכון', birth: 'צילום תעודת לידה' }, docReq: 'חובה לפני השליחה', docLater: 'אפשר להשלים אחרי השליחה', pick: 'בחירת קובץ', replace: 'החלפה', uploaded: 'הועלה ✓', needPhoto: 'יש להעלות תמונה של הבחור.',
    payTitle: 'דמי הרשמה', payNote: 'התשלום המקוון יתווסף בקרוב. בינתיים משרד הישיבה ייצור אתכם קשר לתשלום דמי ההרשמה.', consTitle: 'אישורים', needCons: 'יש לסמן את כל האישורים.',
    infoTitles: { intro: 'הבהרות', tuition: 'שכר לימוד', visa: 'ויזה', insurance: 'ביטוח רפואי', takanon: 'תקנות הישיבה' }, readAll: 'קראתי, להמשך',
    summary: 'בדקו את הפרטים לפני השליחה:', edit: 'עריכה', closed: 'ההרשמה סגורה', ref: 'מספר פנייה', keepLink: 'שמרו את הקישור לאזור האישי — דרכו אפשר לעקוב אחרי ההרשמה ולהשלים מסמכים:',
    errSend: 'השליחה נכשלה:', tooMany: 'יותר מדי בקשות. נסו שוב בעוד שעה.', portal: 'אזור אישי', status: 'מצב ההרשמה', submitted: 'הוגש', period: 'תקופה', docsT: 'מסמכים',
    dState: { '': 'חסר', pending: 'התקבל — ממתין לבדיקה', ok: 'תקין ✓', bad: 'לא תקין — נא להעלות שוב' }, msgs: 'הודעות ועדכונים', noMsgs: 'אין עדיין הודעות.', upload: 'העלאה',
    editTitle: 'עדכון פרטים', save: 'שמירה', saved: 'נשמר ✓', badLink: 'הקישור לא תקין או שפג תוקפו. לבירור: ', loading: 'טוען…', age: 'גיל' },
  yi: { dir: 'rtl', langName: 'אידיש', steps: ['אינפארמאציע און תנאים', 'דער בחור', 'די עלטערן', 'לערנען און צוות', 'דאקומענטן', 'צאלונג און באשטעטיגונג', 'איבערבליק און שיקן'],
    next: 'ווייטער ←', back: '→ צוריק', send: 'שיקן די אפליקאציע', sending: 'שיקט…', req: 'מען מוז אויספילן', badEmail: 'אימעיל איז נישט ריכטיג', badPhone: 'נומער איז נישט ריכטיג — שרייבט מיט דעם לאנד-קאוד (למשל +1 אדער +44)',
    phoneHint: 'מיטן לאנד-קאוד, למשל +1 718 555 1234', savedAs: 'וועט ווערן געהאלטן אזוי:', yes: 'יא', no: 'ניין', heb: 'אידישע דאטום', civ: 'ענגלישע דאטום', day: 'טאג', month: 'חודש', year: 'יאר',
    f: { first_name: 'נאמען', last_name: 'פאמיליע', birth_date: 'געבורטס-דאטום', home_phone: 'טעלעפאן אינדערהיים', engaged: 'איז דער בחור א חתן?', wedding_date: 'חתונה דאטום',
      father_name: 'נאמען פונעם טאטן', mother_family: 'די פאמיליע פון די מאמע', father_phone: 'טעלעפאן פונעם טאטן', mother_phone: 'טעלעפאן פון די מאמע', email: 'אימעיל', community: 'צו וועלכע קהילה געהערט די משפחה',
      address: 'פולע אדרעס', city: 'שטאט', state: 'סטעיט', zip: 'זיפ קאוד', country: 'לאנד',
      yeshiva_ketana: 'ישיבה קטנה וואו ער האט געלערנט', yeshiva_gedola: 'ישיבה גדולה וואו ער האט געלערנט / לערנט יעצט', yeshiva_other: 'נאך א ישיבה וואו ער האט לעצטנס געלערנט (נישט מוז)',
      staff1: 'מנהל / משגיח', staff2: 'מגיד שיעור א׳', staff3: 'מגיד שיעור ב׳', sname: 'נאמען', sphone: 'סעל', notes: 'נאך עפעס וואס די הנהלה דארף וויסן (נישט מוז)' },
    staffNote: 'מען דארף אויספילן כאטש צוויי פון די דריי.', needStaff: 'שרייבט נאמען און טעלעפאן פון כאטש צוויי.',
    addrHint: 'הייבט אן שרייבן — און קלויבט אויס פון די ליסטע. אויב עס איז נישטא, פילט עס אויס אליין.',
    docs: { photo: 'א קלארע בילד פונעם בחור', passport: 'קאפי פון פאספארט', birth: 'קאפי פון birth certificate' }, docReq: 'מוז פאר׳ן שיקן', docLater: 'מען קען צולייגן שפעטער', pick: 'אויסקלייבן', replace: 'טוישן', uploaded: 'ארויפגעלייגט ✓', needPhoto: 'מען דארף ארויפלייגן א בילד פונעם בחור.',
    payTitle: 'דמי הרשמה', payNote: 'די אנליין צאלונג וועט באלד צוגעלייגט ווערן. דערווייל וועט דער אפיס פון ישיבה זיך פארבינדן מיט אייך צו באצאלן.', consTitle: 'באשטעטיגונג', needCons: 'מען דארף צייכענען אלע.',
    infoTitles: { intro: 'פרטי הרשמה', tuition: 'שכר לימוד', visa: 'וויזה', insurance: 'מעדיקל אינשורנס', takanon: 'תקנות הישיבה' }, readAll: 'איך האב געליינט, ווייטער',
    summary: 'קוקט איבער די פרטים פאר׳ן שיקן:', edit: 'טוישן', closed: 'די אפליקאציע איז פארמאכט', ref: 'נומער', keepLink: 'האלט אן דעם לינק — דורך אים קען מען זען וואו די אפליקאציע האלט און צולייגן דאקומענטן:',
    errSend: 'עס איז נישט אדורך:', tooMany: 'צו פיל פרובירן. פרובירט נאכאמאל אין א שעה.', portal: 'אייער אפליקאציע', status: 'וואו עס האלט', submitted: 'געשיקט', period: 'זמן', docsT: 'דאקומענטן',
    dState: { '': 'פעלט', pending: 'אנגעקומען — ווארט צו ווערן געקוקט', ok: 'אין ארדענונג ✓', bad: 'נישט גוט — ביטע לייגט ארויף נאכאמאל' }, msgs: 'מעלדונגען', noMsgs: 'נאך קיין מעלדונגען.', upload: 'ארויפלייגן',
    editTitle: 'טוישן פרטים', save: 'היטן', saved: 'געהיטן ✓', badLink: 'דער לינק איז נישט גוט. פאר אינפארמאציע: ', loading: 'לאדט…', age: 'עלטער' },
  en: { dir: 'ltr', langName: 'English', steps: ['Information & terms', 'The bochur', 'Parents', 'Learning & staff', 'Documents', 'Payment & consent', 'Review & submit'],
    next: 'Next →', back: '← Back', send: 'Submit application', sending: 'Sending…', req: 'Required', badEmail: 'Invalid email address', badPhone: 'Invalid number — include the country code (e.g. +1 or +44)',
    phoneHint: 'Include country code, e.g. +1 718 555 1234', savedAs: 'Will be saved as:', yes: 'Yes', no: 'No', heb: 'Hebrew date', civ: 'Civil date', day: 'Day', month: 'Month', year: 'Year',
    f: { first_name: 'First name', last_name: 'Last name', birth_date: 'Date of birth', home_phone: 'Home phone', engaged: 'Is the bochur engaged?', wedding_date: 'Wedding date',
      father_name: 'Father\'s name', mother_family: 'Mother\'s maiden name', father_phone: 'Father\'s phone', mother_phone: 'Mother\'s phone', email: 'Email', community: 'Community (kehilla) the family belongs to',
      address: 'Full home address', city: 'City', state: 'State / county', zip: 'ZIP / postal code', country: 'Country',
      yeshiva_ketana: 'Yeshiva ketana he learned in', yeshiva_gedola: 'Yeshiva gedola he learned in / learns now', yeshiva_other: 'Another yeshiva he learned in recently (optional)',
      staff1: 'Menahel / Mashgiach', staff2: 'Maggid shiur 1', staff3: 'Maggid shiur 2', sname: 'Name', sphone: 'Cell phone', notes: 'Anything else the Yeshiva should know (optional)' },
    staffNote: 'Please fill in at least two of the three.', needStaff: 'Enter name and phone of at least two staff members.',
    addrHint: 'Start typing and choose from the list. If the address does not appear, fill it in manually.',
    docs: { photo: 'A clear photo of the bochur', passport: 'Copy of passport', birth: 'Copy of birth certificate' }, docReq: 'Required before submitting', docLater: 'Can be added after submitting', pick: 'Choose file', replace: 'Replace', uploaded: 'Uploaded ✓', needPhoto: 'Please upload a photo of the bochur.',
    payTitle: 'Registration fee', payNote: 'Online payment will be added soon. Meanwhile, the Yeshiva office will contact you for the registration fee.', consTitle: 'Consent', needCons: 'Please check all boxes.',
    infoTitles: { intro: 'Registration information', tuition: 'Tuition', visa: 'Visa', insurance: 'Medical insurance', takanon: 'Yeshiva rules' }, readAll: 'I have read this — continue',
    summary: 'Please review before submitting:', edit: 'Edit', closed: 'Registration is closed', ref: 'Reference #', keepLink: 'Keep this link to your personal page — you can follow the application and upload documents there:',
    errSend: 'Sending failed:', tooMany: 'Too many attempts. Please try again in an hour.', portal: 'Your application', status: 'Status', submitted: 'Submitted', period: 'Zman', docsT: 'Documents',
    dState: { '': 'Missing', pending: 'Received — waiting for review', ok: 'OK ✓', bad: 'Not valid — please upload again' }, msgs: 'Messages & updates', noMsgs: 'No messages yet.', upload: 'Upload',
    editTitle: 'Update details', save: 'Save', saved: 'Saved ✓', badLink: 'This link is not valid. For information: ', loading: 'Loading…', age: 'Age' },
};
const REGIONS = ['us', 'gb', 'be', 'ca', 'il', 'fr', 'ch', 'at', 'nl', 'de', 'ar', 'mx', 'au', 'za', 'hu'];
const S = { lang: 'he', step: 0, data: {}, files: {}, cons: [], ack: false, info: null, conf: null, texts: null, errs: {}, sending: false };

async function pub(action, body = {}) {
  const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, action, mosad: MOSAD }) });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
  return j;
}
const U = () => UI[S.lang];
const T = () => S.texts[S.lang];
const F = (t, extra) => fill(t, S.conf, extra);
function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify({ lang: S.lang, step: S.step, data: S.data, cons: S.cons, ack: S.ack })); } catch { /* */ } }
function loadDraft() { try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d) Object.assign(S, { lang: d.lang || S.lang, step: d.step || 0, data: d.data || {}, cons: d.cons || [], ack: !!d.ack }); } catch { /* */ } }
function setLang(l) { S.lang = l; document.documentElement.lang = l === 'en' ? 'en' : (l === 'yi' ? 'yi' : 'he'); document.documentElement.dir = UI[l].dir; saveDraft(); }

// ---------- טעלעפאן ----------
function normPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  if (!d.startsWith('+')) {
    if (/^1?[2-9]\d{9}$/.test(d)) d = `+1${d.slice(-10)}`; // ארה"ב / קנדה
    else if (/^05\d{8}$/.test(d) || /^0[2-9]\d{7}$/.test(d)) d = `+972${d.slice(1)}`; // ארץ ישראל
    else if (/^0[1-9]\d{9}$/.test(d)) d = `+44${d.slice(1)}`; // ענגלאנד
    else return null;
  }
  return /^\+\d{9,15}$/.test(d) ? d : null;
}
const CC = ['972', '44', '32', '33', '41', '43', '31', '49', '61', '54', '52', '27', '36', '39', '34', '1', '7'];
const pretty = (e164) => {
  if (e164.startsWith('+1') && e164.length === 12) return `+1 ${e164.slice(2, 5)}-${e164.slice(5, 8)}-${e164.slice(8)}`;
  const cc = CC.find((c) => e164.startsWith(`+${c}`));
  return cc ? `+${cc} ${e164.slice(cc.length + 1)}` : e164;
};

// ---------- דאטום: עברי אדער לועזי ----------
function dateHtml(name, kind) {
  const v = S.data[name] || '';
  const mode = S.data[`${name}_mode`] || (S.lang === 'en' ? 'civ' : 'he');
  const hy = toHebrew(todayIso()).y;
  const cur = v ? toHebrew(v) : null;
  const years = kind === 'birth' ? Array.from({ length: 30 }, (_, i) => hy - 8 - i) : [hy - 1, hy, hy + 1, hy + 2];
  const y = cur?.y || ''; const months = monthsOf(y || hy);
  return `<div class="rf-date" data-date="${name}">
    <div class="rf-dmode"><label><input type="radio" name="${name}_mode" value="he"${mode === 'he' ? ' checked' : ''}> ${h(U().heb)}</label><label><input type="radio" name="${name}_mode" value="civ"${mode === 'civ' ? ' checked' : ''}> ${h(U().civ)}</label></div>
    <div class="rf-he"${mode === 'he' ? '' : ' hidden'}>
      <select data-hd="d" aria-label="${h(U().day)}"><option value="">${h(U().day)}</option>${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}"${cur?.d === i + 1 ? ' selected' : ''}>${hebrewNumber(i + 1)}</option>`).join('')}</select>
      <select data-hd="m" aria-label="${h(U().month)}"><option value="">${h(U().month)}</option>${months.map((m) => `<option value="${m.key}"${cur?.m === m.key ? ' selected' : ''}>${h(m.he)}</option>`).join('')}</select>
      <select data-hd="y" aria-label="${h(U().year)}"><option value="">${h(U().year)}</option>${years.map((yy) => `<option value="${yy}"${y === yy ? ' selected' : ''}>${yearLabel(yy)}</option>`).join('')}</select>
    </div>
    <div class="rf-civ"${mode === 'civ' ? '' : ' hidden'}><input type="date" data-hc value="${h(v)}" ${kind === 'birth' ? `max="${todayIso()}"` : ''}></div>
    <small class="rf-par">${v ? `${h(isoToHebrewText(v))} · ${h(v.split('-').reverse().join('/'))}` : ''}</small></div>`;
}
function wireDates(root) {
  $$('.rf-date', root).forEach((box) => {
    const name = box.dataset.date;
    const par = $('.rf-par', box);
    const set = (iso) => { S.data[name] = iso; S.data[`${name.replace('_date', '')}_heb`] = iso ? isoToHebrewText(iso) : ''; par.textContent = iso ? `${isoToHebrewText(iso)} · ${iso.split('-').reverse().join('/')}` : ''; saveDraft(); ageCheck(root); };
    $$(`input[name=${name}_mode]`, box).forEach((r) => { r.onchange = () => { S.data[`${name}_mode`] = r.value; $('.rf-he', box).hidden = r.value !== 'he'; $('.rf-civ', box).hidden = r.value !== 'civ'; saveDraft(); }; });
    const he = () => {
      const d = Number($('[data-hd=d]', box).value); const y = Number($('[data-hd=y]', box).value); const mSel = $('[data-hd=m]', box);
      if (y) { const keep = mSel.value; mSel.innerHTML = `<option value="">${h(U().month)}</option>${monthsOf(y).map((m) => `<option value="${m.key}"${m.key === keep ? ' selected' : ''}>${h(m.he)}</option>`).join('')}`; }
      const m = mSel.value;
      if (d && m && y) { const iso = fromHebrew(d, m, y); set(iso); if (!iso) par.textContent = '?'; } else set('');
    };
    $$('[data-hd]', box).forEach((s) => { s.onchange = he; });
    $('[data-hc]', box).onchange = (e) => set(e.target.value);
  });
}
function ageOf(iso) { if (!iso) return null; const b = new Date(`${iso}T12:00:00`); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1; return a; }
function ageCheck(root) {
  const box = $('#rf-age', root); if (!box) return;
  const a = ageOf(S.data.birth_date);
  const young = a !== null && a < Number(S.conf.min_age || 18);
  box.hidden = !young;
  if (young) box.innerHTML = `<p>⚠ ${h(F(T().age_warn))} (${h(U().age)}: ${a})</p><label class="check"><input type="checkbox" id="rf-ack"${S.ack ? ' checked' : ''}> ${h(T().age_ack)}</label>`;
  const ack = $('#rf-ack', root); if (ack) ack.onchange = () => { S.ack = ack.checked; saveDraft(); };
}

// ---------- שדות ----------
const inp = (k, type = 'text', opt = {}) => {
  const L = U().f[k] || k;
  const v = S.data[k] || '';
  const err = S.errs[k];
  if (type === 'tel') { const n = v ? normPhone(v) : ''; return `<label class="rf-f${err ? ' bad' : ''}">${h(L)}${opt.req === false ? '' : ' *'}<input name="${k}" type="tel" dir="ltr" value="${h(v)}" placeholder="${h(U().phoneHint)}" autocomplete="tel"><small class="rf-hint">${n ? `${h(U().savedAs)} ${h(pretty(n))}` : ''}</small>${err ? `<small class="rf-err">${h(err)}</small>` : ''}</label>`; }
  if (type === 'area') return `<label class="rf-f rf-wide">${h(L)}<textarea name="${k}" rows="4">${h(v)}</textarea></label>`;
  return `<label class="rf-f${err ? ' bad' : ''}${opt.wide ? ' rf-wide' : ''}">${h(L)}${opt.req === false ? '' : ' *'}<input name="${k}" type="${type}" value="${h(v)}"${type === 'email' ? ' dir="ltr" autocomplete="email"' : ''}${opt.ac ? ` autocomplete="${opt.ac}"` : ''}>${err ? `<small class="rf-err">${h(err)}</small>` : ''}</label>`;
};
const REQ = { 1: ['first_name', 'last_name', 'birth_date', 'home_phone', 'engaged'], 2: ['father_name', 'mother_family', 'father_phone', 'mother_phone', 'email', 'community', 'address', 'city', 'country'], 3: ['yeshiva_ketana', 'yeshiva_gedola'] };
const PHONES = ['home_phone', 'father_phone', 'mother_phone', 'staff1_phone', 'staff2_phone', 'staff3_phone'];
function validate(step) {
  const e = {};
  (REQ[step] || []).forEach((k) => { if (!String(S.data[k] || '').trim()) e[k] = U().req; });
  PHONES.forEach((k) => { if (S.data[k] && normPhone(S.data[k]) === null && (step === 1 || step === 2 || step === 3)) { if ((step === 1 && k === 'home_phone') || (step === 2 && /^(father|mother)/.test(k)) || (step === 3 && /^staff/.test(k))) e[k] = U().badPhone; } });
  if (step === 2 && S.data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(S.data.email)) e.email = U().badEmail;
  if (step === 1 && S.data.engaged === 'yes' && !S.data.wedding_date) e.wedding_date = U().req;
  if (step === 1) { const a = ageOf(S.data.birth_date); if (a !== null && a < Number(S.conf.min_age || 18) && !S.ack) e._ack = T().age_ack; }
  if (step === 3 && [1, 2, 3].filter((i) => S.data[`staff${i}_name`] && S.data[`staff${i}_phone`]).length < 2) e._staff = U().needStaff;
  if (step === 4 && !S.files.photo) e._photo = U().needPhoto;
  if (step === 5 && T().consents.some((_, i) => !S.cons[i])) e._cons = U().needCons;
  S.errs = e;
  return !Object.keys(e).length;
}

// ---------- דער טופס ----------
function render() {
  const app = $('#rf-app');
  const u = U();
  const t = T();
  const c = S.conf;
  const langs = `<div class="rf-langs">${Object.entries(UI).map(([k, v]) => `<button type="button" data-lang="${k}" class="${k === S.lang ? 'on' : ''}">${h(v.langName)}</button>`).join('')}</div>`;
  const head = `<header class="rf-head"><img src="../../img/mosad/yeshiva/letterhead-top.png" alt="" class="rf-lh">${langs}<h1>${h(F(t.title))}</h1></header>`;
  if (!S.info.on) { app.innerHTML = `${head}<div class="rf-card"><h2>${h(u.closed)}</h2><p>${h(F(t.closed))}</p></div>`; wireLang(); return; }
  const st = S.step;
  const prog = `<ol class="rf-prog">${u.steps.map((s, i) => `<li class="${i === st ? 'on' : i < st ? 'done' : ''}">${h(s)}</li>`).join('')}</ol>`;
  const err = (k) => (S.errs[k] ? `<p class="rf-err">${h(S.errs[k])}</p>` : '');
  let body = '';
  if (st === 0) body = ['intro', 'tuition', 'visa', 'insurance', 'takanon'].map((k) => `<section class="rf-info"><h3>${h(u.infoTitles[k])}</h3><ul>${(t[k] || []).map((x) => `<li>${h(F(x))}</li>`).join('')}</ul></section>`).join('');
  else if (st === 1) body = `<div class="rf-grid">${inp('first_name', 'text', { ac: 'off' })}${inp('last_name')}</div>
      <div class="rf-f${S.errs.birth_date ? ' bad' : ''}"><span>${h(u.f.birth_date)} *</span>${dateHtml('birth_date', 'birth')}${S.errs.birth_date ? `<small class="rf-err">${h(S.errs.birth_date)}</small>` : ''}</div>
      <div id="rf-age" class="rf-warn" hidden></div>${err('_ack')}
      <div class="rf-grid">${inp('home_phone', 'tel')}
      <div class="rf-f${S.errs.engaged ? ' bad' : ''}"><span>${h(u.f.engaged)} *</span><div class="rf-yn"><label><input type="radio" name="engaged" value="no"${S.data.engaged === 'no' ? ' checked' : ''}> ${h(u.no)}</label><label><input type="radio" name="engaged" value="yes"${S.data.engaged === 'yes' ? ' checked' : ''}> ${h(u.yes)}</label></div>${S.errs.engaged ? `<small class="rf-err">${h(S.errs.engaged)}</small>` : ''}</div></div>
      ${S.data.engaged === 'yes' ? `<div class="rf-f${S.errs.wedding_date ? ' bad' : ''}"><span>${h(u.f.wedding_date)} *</span>${dateHtml('wedding_date', 'wed')}${S.errs.wedding_date ? `<small class="rf-err">${h(S.errs.wedding_date)}</small>` : ''}</div>` : ''}`;
  else if (st === 2) body = `<div class="rf-grid">${inp('father_name')}${inp('mother_family')}${inp('father_phone', 'tel')}${inp('mother_phone', 'tel')}${inp('email', 'email')}${inp('community')}</div>
      <div class="rf-addr">${inp('address', 'text', { wide: true, ac: 'off' })}<div class="rf-sugg" id="rf-sugg" hidden></div><small class="rf-hint">${h(u.addrHint)}</small></div>
      <div class="rf-grid">${inp('city')}${inp('state', 'text', { req: false })}${inp('zip', 'text', { req: false })}${inp('country')}</div>`;
  else if (st === 3) body = `<div class="rf-grid">${inp('yeshiva_ketana')}${inp('yeshiva_gedola')}${inp('yeshiva_other', 'text', { req: false })}</div>
      <h3>${h(u.staffNote)}</h3>${err('_staff')}
      ${[1, 2, 3].map((i) => `<div class="rf-grid rf-staff"><b>${h(u.f[`staff${i}`])}</b>
        <label class="rf-f">${h(u.f.sname)}<input name="staff${i}_name" value="${h(S.data[`staff${i}_name`] || '')}"></label>
        ${inp(`staff${i}_phone`, 'tel', { req: false }).replace(h(u.f[`staff${i}_phone`] || `staff${i}_phone`), h(u.f.sphone))}</div>`).join('')}
      ${inp('notes', 'area')}`;
  else if (st === 4) body = `${err('_photo')}${['photo', 'passport', 'birth'].map((k) => `<div class="rf-doc"><div><b>${h(u.docs[k])}</b> <small class="muted">(${h(k === 'photo' ? u.docReq : u.docLater)})</small></div>
      ${S.files[k] ? `<div class="rf-up">${S.files[k].startsWith('data:image') ? `<img src="${S.files[k]}" alt="">` : '📄 PDF'} <span>${h(u.uploaded)} ${h(S.files[`${k}_name`] || '')}</span></div>` : ''}
      <label class="btn">${h(S.files[k] ? u.replace : u.pick)}<input type="file" data-file="${k}" accept="${k === 'photo' ? 'image/*' : 'image/*,application/pdf'}" hidden></label></div>`).join('')}`;
  else if (st === 5) body = `<section class="rf-info"><h3>${h(u.payTitle)}: ${h(c.amounts.reg_usd)}$</h3><p>${h(u.payNote)}</p></section>
      <section class="rf-info"><h3>${h(u.consTitle)}</h3>${err('_cons')}${t.consents.map((x, i) => `<label class="check rf-cons"><input type="checkbox" data-cons="${i}"${S.cons[i] ? ' checked' : ''}> ${h(F(x))}</label>`).join('')}</section>`;
  else if (st === 6) body = `<p>${h(u.summary)}</p>${summaryHtml()}<input type="text" name="website" class="rf-hp" tabindex="-1" autocomplete="off" aria-hidden="true">`;
  const nav = `<div class="rf-nav">${st > 0 ? `<button type="button" class="btn" id="rf-back">${h(u.back)}</button>` : '<span></span>'}
    ${st < 6 ? `<button type="button" class="btn primary" id="rf-next">${h(st === 0 ? u.readAll : u.next)}</button>` : `<button type="button" class="btn primary" id="rf-send"${S.sending ? ' disabled' : ''}>${h(S.sending ? u.sending : u.send)}</button>`}</div>`;
  app.innerHTML = `${head}${prog}<form class="rf-card" id="rf-form" novalidate><h2>${h(u.steps[st])}</h2>${body}${nav}</form>`;
  wireLang();
  const form = $('#rf-form');
  form.oninput = (e) => {
    const n = e.target.name; if (!n || n === 'website' || n.endsWith('_mode')) return;
    S.data[n] = e.target.value; saveDraft();
    if (e.target.type === 'tel') { const hint = e.target.parentElement.querySelector('.rf-hint'); const nn = normPhone(e.target.value); if (hint) hint.textContent = nn ? `${U().savedAs} ${pretty(nn)}` : ''; }
  };
  $$('input[name=engaged]', form).forEach((r) => { r.onchange = () => { S.data.engaged = r.value; saveDraft(); render(); }; });
  wireDates(form); ageCheck(form);
  $$('[data-cons]', form).forEach((cb) => { cb.onchange = () => { S.cons[Number(cb.dataset.cons)] = cb.checked; saveDraft(); }; });
  $$('[data-file]', form).forEach((fi) => { fi.onchange = async () => { const f = fi.files?.[0]; if (!f) return; try { S.files[fi.dataset.file] = await fileData(f, fi.dataset.file === 'photo'); S.files[`${fi.dataset.file}_name`] = f.name; render(); } catch (err) { alert(err.message); } }; });
  $$('[data-goto]', form).forEach((b) => { b.onclick = () => { S.step = Number(b.dataset.goto); S.errs = {}; render(); window.scrollTo(0, 0); }; });
  if (st === 2) wireAddress(form);
  $('#rf-back')?.addEventListener('click', () => { S.step -= 1; S.errs = {}; saveDraft(); render(); window.scrollTo(0, 0); });
  $('#rf-next')?.addEventListener('click', () => { if (!validate(st)) { render(); $('.bad, .rf-err')?.scrollIntoView({ block: 'center' }); return; } S.step += 1; saveDraft(); render(); window.scrollTo(0, 0); });
  $('#rf-send')?.addEventListener('click', submit);
}
function summaryHtml() {
  const u = U(); const d = S.data;
  const row = (l, v) => (v ? `<div><span>${h(l)}</span><b>${h(v)}</b></div>` : '');
  const ph2 = (v) => { const n = normPhone(v); return n ? pretty(n) : v; };
  const sec = (i, title, inner) => `<section class="rf-sum"><h3>${h(title)} <button type="button" class="linkish" data-goto="${i}">${h(u.edit)}</button></h3>${inner}</section>`;
  return sec(1, u.steps[1], row(u.f.first_name, `${d.first_name || ''} ${d.last_name || ''}`) + row(u.f.birth_date, d.birth_date ? `${isoToHebrewText(d.birth_date)} · ${d.birth_date.split('-').reverse().join('/')}` : '') + row(u.f.home_phone, ph2(d.home_phone))
      + row(u.f.engaged, d.engaged === 'yes' ? `${u.yes} — ${d.wedding_date ? isoToHebrewText(d.wedding_date) : ''}` : u.no))
    + sec(2, u.steps[2], row(u.f.father_name, d.father_name) + row(u.f.mother_family, d.mother_family) + row(u.f.father_phone, ph2(d.father_phone)) + row(u.f.mother_phone, ph2(d.mother_phone)) + row(u.f.email, d.email) + row(u.f.community, d.community)
      + row(u.f.address, [d.address, d.city, d.state, d.zip, d.country].filter(Boolean).join(', ')))
    + sec(3, u.steps[3], row(u.f.yeshiva_ketana, d.yeshiva_ketana) + row(u.f.yeshiva_gedola, d.yeshiva_gedola) + row(u.f.yeshiva_other, d.yeshiva_other)
      + [1, 2, 3].map((i) => row(u.f[`staff${i}`], [d[`staff${i}_name`], d[`staff${i}_phone`] && ph2(d[`staff${i}_phone`])].filter(Boolean).join(' · '))).join('') + row(u.f.notes, d.notes))
    + sec(4, u.steps[4], ['photo', 'passport', 'birth'].map((k) => row(u.docs[k], S.files[k] ? u.uploaded : '—')).join(''));
}
function wireLang() { $$('[data-lang]').forEach((b) => { b.onclick = () => { setLang(b.dataset.lang); S.errs = {}; render(); }; }); }
function wireAddress(form) {
  const input = form.elements.address; const box = $('#rf-sugg', form);
  if (!input || !placesEnabled()) return;
  let timer = null; let seq = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq; const r = await suggest(input.value, REGIONS);
      if (my !== seq || !Array.isArray(r) || !r.length) { box.hidden = true; return; }
      box.innerHTML = r.slice(0, 6).map((x, i) => `<button type="button" data-i="${i}">${h(x.text)}</button>`).join('');
      box.hidden = false;
      $$('button', box).forEach((b) => { b.onclick = async () => {
        box.hidden = true; const d = await details(r[Number(b.dataset.i)].prediction);
        if (!d) { input.value = r[Number(b.dataset.i)].text; S.data.address = input.value; saveDraft(); return; }
        Object.assign(S.data, { address: d.address || r[Number(b.dataset.i)].text, city: d.city || S.data.city || '', state: d.state || '', zip: d.zip || '', country: d.country || '' });
        saveDraft(); render();
      }; });
    }, 350);
  });
  input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 250));
}
async function submit() {
  for (let i = 1; i <= 5; i += 1) if (!validate(i)) { S.step = i; render(); $('.bad, .rf-err')?.scrollIntoView({ block: 'center' }); return; }
  S.sending = true; render();
  const data = { ...S.data };
  PHONES.forEach((k) => { if (data[k]) data[k] = normPhone(data[k]) || data[k]; });
  data.under_age_ack = S.ack ? '1' : '';
  Object.keys(data).forEach((k) => { if (k.endsWith('_mode')) delete data[k]; });
  try {
    const r = await pub('pubRegSubmit', { lang: S.lang, data, files: { photo: S.files.photo, passport: S.files.passport || '', birth: S.files.birth || '' },
      consents: `${S.lang}:${T().consents.length}:${new Date().toISOString().slice(0, 10)}`, website: $('.rf-hp')?.value || '', test: new URLSearchParams(location.search).get('test') === '1' });
    try { localStorage.removeItem(DRAFT); } catch { /* */ }
    const link = `${location.origin}${location.pathname}?t=${r.token}`;
    $('#rf-app').innerHTML = `<header class="rf-head"><img src="../../img/mosad/yeshiva/letterhead-top.png" alt="" class="rf-lh"></header>
      <div class="rf-card rf-ok"><h2>✓</h2><p>${h(F(T().success)).replace(/\n/g, '<br>')}</p><p><b>${h(U().ref)} ${h(r.app_id)}</b></p>
      <p>${h(U().keepLink)}</p><p class="rf-link"><a href="${h(link)}" dir="ltr">${h(link)}</a></p></div>`;
    window.scrollTo(0, 0);
  } catch (err) {
    S.sending = false; render();
    const m = err.code === 'too-many' ? U().tooMany : err.code === 'reg-closed' ? U().closed : `${U().errSend} ${err.message}`;
    alert(m);
  }
}
/** א טעקע → data URL; א בילד ווערט קלענער */
async function fileData(f, isPhoto) {
  if (f.type === 'application/pdf') {
    if (f.size > 4 * 1024 * 1024) throw new Error('PDF > 4MB');
    return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('read failed')); r.readAsDataURL(f); });
  }
  if (!/^image\//.test(f.type)) throw new Error('Image / PDF only');
  const url = URL.createObjectURL(f);
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad image')); i.src = url; });
  URL.revokeObjectURL(url);
  const max = isPhoto ? 1000 : 1600; const s = Math.min(1, max / Math.max(im.width, im.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.85);
}

// ---------- אזור אישי ----------
async function portal(token) {
  const app = $('#rf-app');
  app.innerHTML = `<p class="rf-card">${h(U().loading)}</p>`;
  let P;
  try { P = await pub('pubPortal', { t: token }); } catch (err) {
    S.conf = mergeConf(null); S.texts = mergeTexts(null);
    app.innerHTML = `<div class="rf-card"><p>${h(U().badLink)}${h(S.conf.phone_status)}</p></div>`; return;
  }
  S.conf = mergeConf(P.conf); S.texts = mergeTexts(P.texts);
  if (!S.langPicked && UI[P.app.lang]) setLang(P.app.lang);
  const draw = () => {
    const u = U(); const a = P.app;
    const stt = S.conf.statuses.find((s) => s.key === a.status);
    const msg = stt ? F(stt.msg[S.lang] || stt.msg.he) : '';
    const langs = `<div class="rf-langs">${Object.entries(UI).map(([k, v]) => `<button type="button" data-lang="${k}" class="${k === S.lang ? 'on' : ''}">${h(v.langName)}</button>`).join('')}</div>`;
    app.innerHTML = `<header class="rf-head"><img src="../../img/mosad/yeshiva/letterhead-top.png" alt="" class="rf-lh">${langs}<h1>${h(u.portal)} — ${h(a.first_name)} ${h(a.last_name)}</h1></header>
      <div class="rf-card"><p class="muted">${h(u.ref)} ${h(a.app_id)} · ${h(u.submitted)}: ${h(isoToHebrewText(String(a.created_at).slice(0, 10)))} · ${h(u.period)}: ${h(a.period)}</p>
        <h2>${h(u.status)}</h2><p class="rf-status">${h(msg)}</p></div>
      <div class="rf-card"><h2>${h(u.docsT)}</h2>${['photo', 'passport', 'birth'].map((k) => `<div class="rf-doc"><b>${h(u.docs[k])}</b> — <span>${h(u.dState[a[`${k}_state`] || ''] || '')}</span>
        ${a[`${k}_state`] !== 'ok' ? `<label class="btn">${h(u.upload)}<input type="file" data-pup="${k}" accept="${k === 'photo' ? 'image/*' : 'image/*,application/pdf'}" hidden></label>` : ''}</div>`).join('')}</div>
      <div class="rf-card"><h2>${h(u.msgs)}</h2>${P.log.length ? P.log.slice().reverse().map((l) => `<div class="rf-msg"><small class="muted">${h(isoToHebrewText(String(l.at).slice(0, 10)))}</small><p>${h(l.text).replace(/\n/g, '<br>')}</p></div>`).join('') : `<p class="muted">${h(u.noMsgs)}</p>`}</div>
      ${a.portal_edit === 'TRUE' ? `<form class="rf-card" id="rf-pedit"><h2>${h(u.editTitle)}</h2><div class="rf-grid">${['first_name', 'last_name', 'home_phone', 'father_name', 'mother_family', 'father_phone', 'mother_phone', 'email', 'community', 'address', 'city', 'state', 'zip', 'country', 'yeshiva_ketana', 'yeshiva_gedola', 'yeshiva_other'].map((k) => `<label class="rf-f">${h(u.f[k])}<input name="${k}" value="${h(a[k] || '')}"></label>`).join('')}</div><p><button class="btn primary">${h(u.save)}</button></p></form>` : ''}`;
    $$('[data-lang]').forEach((b) => { b.onclick = () => { S.langPicked = true; setLang(b.dataset.lang); draw(); }; });
    $$('[data-pup]').forEach((fi) => { fi.onchange = async () => {
      const f = fi.files?.[0]; if (!f) return;
      fi.closest('label').textContent = '…';
      try { await pub('pubPortalUpload', { t: token, kind: fi.dataset.pup, data: await fileData(f, fi.dataset.pup === 'photo') }); P = await pub('pubPortal', { t: token }); draw(); } catch (err) { alert(err.message); draw(); }
    }; });
    $('#rf-pedit')?.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const data = Object.fromEntries(new FormData(ev.target).entries());
      try { await pub('pubPortalEdit', { t: token, data }); P = await pub('pubPortal', { t: token }); draw(); alert(U().saved); } catch (err) { alert(err.message); }
    });
  };
  draw();
}

// ---------- אנהייב ----------
(async () => {
  const qs = new URLSearchParams(location.search);
  const l0 = qs.get('lang') || (navigator.language || '').slice(0, 2);
  S.lang = l0 === 'en' ? 'en' : l0 === 'yi' ? 'yi' : 'he';
  if (qs.get('t')) { setLang(S.lang); portal(qs.get('t')); return; }
  loadDraft(); setLang(S.lang);
  $('#rf-app').innerHTML = `<p class="rf-card">${h(U().loading)}</p>`;
  try { S.info = await pub('pubRegInfo'); } catch (err) { $('#rf-app').innerHTML = `<p class="rf-card">${h(err.message)}</p>`; return; }
  S.conf = mergeConf(S.info.conf); S.texts = mergeTexts(S.info.texts);
  render();
})();
