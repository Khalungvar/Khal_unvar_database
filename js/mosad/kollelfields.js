// 🕍 מרכז הכוללים — השדות של טופס ההרשמה (משותף לטופס הציבורי, למסך הגבאי ולהדפסה). English / אידיש.
export const MARITAL = [['married', 'Married', 'חתונה געהאט'], ['unmarried', 'Unmarried', 'נישט חתונה געהאט'], ['separated', 'Separated', 'אפגעשיידט (separated)'], ['divorced', 'Divorced', 'גרוש'], ['widowed', 'Widowed', 'אלמן']];
export const YESNO = [['yes', 'Yes', 'יא'], ['no', 'No', 'ניין']];

// [key, English, אידיש, type, opts]  type: text | date | tel | ssn | select | yesno | area | num
export const SECTIONS = [
  { id: 'personal', en: 'Personal Information', yi: 'פערזענליכע פרטים', fields: [
    ['yi_name', 'Name in Yiddish', 'נאמען אויף אידיש', 'text', { rtl: true, req: 1 }],
    ['legal_first', 'Legal First Name', 'לעגאלער ערשטער נאמען', 'text', { req: 1, ai: 1 }],
    ['legal_last', 'Legal Last Name', 'לעגאלער פאמיליע נאמען', 'text', { req: 1, ai: 1 }],
    ['phone', 'Phone', 'טעלעפאן', 'tel', { req: 1 }],
    ['address', 'Address', 'אדרעס', 'text', { req: 1, ai: 1, wide: 1 }],
    ['city', 'City', 'שטאט', 'text', { req: 1, ai: 1 }],
    ['state', 'State', 'סטעיט', 'text', { ai: 1 }],
    ['zip', 'Zip Code', 'זיפ קאוד', 'text', { ai: 1 }],
    ['dob', 'Date of Birth', 'געבורטס טאג', 'date', { req: 1, ai: 1 }],
    ['ssn', 'Social Security Number', 'סאשעל סעקיוריטי נומער', 'ssn', { req: 1, ai: 1 }],
  ] },
  { id: 'marital', en: 'Marital Information', yi: 'משפחה', fields: [
    ['marital', 'Marital Status', 'סטאטוס', 'select', { req: 1, opts: MARITAL }],
    ['marital_date', 'Marital Status Date', 'דאטום פונעם סטאטוס', 'date', {}],
    ['wife_first', "Spouse's First Name (as on SS card)", 'ווייב — ערשטער נאמען (ווי אויפן SS קארטל)', 'text', { m: 1, ai: 1 }],
    ['wife_last', "Spouse's Last Name (as on SS card)", 'ווייב — פאמיליע נאמען (ווי אויפן SS קארטל)', 'text', { m: 1, ai: 1 }],
    ['wife_dob', "Spouse's Date of Birth", 'ווייב — געבורטס טאג', 'date', { m: 1, ai: 1 }],
    ['wife_ssn', "Spouse's SSN", 'ווייב — סאשעל סעקיוריטי', 'ssn', { m: 1, ai: 1 }],
    ['wife_phone', "Spouse's Cell Phone", 'ווייב — סעלפאון', 'tel', { m: 1 }],
    ['wedding_date', 'Wedding Date', 'חתונה דאטום', 'date', { m: 1, ai: 1 }],
  ] },
  { id: 'family', en: 'Family Information', yi: 'קינדער', fields: [
    ['children', 'Number of children', 'וויפיל קינדער', 'num', {}],
    ['growing', 'Expected family size to grow over the next 6 months', 'ערווארטעט די פאמיליע צו וואקסן אין די קומענדיגע 6 חדשים', 'yesno', {}],
    ['oldest_dob', 'Oldest Child Date of Birth', 'געבורטס טאג פונעם עלטסטן קינד', 'date', {}],
  ] },
  { id: 'parents', en: 'Parents Information', yi: 'עלטערן', fields: [
    ['parents_ny', 'Do your parents live in NY?', 'וואוינען דיינע עלטערן אין ניו יארק?', 'yesno', {}],
    ['father_name', "Father's Name", 'טאטע — נאמען', 'text', { ai: 1 }],
    ['mother_name', "Mother's Name", 'מאמע — נאמען', 'text', { ai: 1 }],
    ['father_address', "Father's Address", 'טאטע — אדרעס', 'text', { wide: 1 }],
    ['father_phone', "Father's Phone", 'טאטע — טעלעפאן', 'tel', {}],
    ['fil_name', 'Father-in-Law Name', 'שווער — נאמען', 'text', { m: 1, ai: 1 }],
    ['wife_mother_name', 'Mother-in-Law Name', 'שוויגער — נאמען', 'text', { m: 1, ai: 1 }],
    ['fil_address', 'Father-in-Law Address', 'שווער — אדרעס', 'text', { m: 1, wide: 1 }],
  ] },
  { id: 'education', en: 'Education History', yi: 'ישיבות', fields: [
    ['hs_name', 'High School – Yeshiva Ketana (most recent)', 'ישיבה קטנה (די לעצטע)', 'text', { wide: 1 }],
    ['hs_city', 'City/State', 'שטאט / סטעיט', 'text', {}],
    ['hs_grad', 'Graduation (month / year)', 'געענדיגט (חודש / יאר)', 'text', {}],
    ['yg_name', 'Most Recent Yeshiva Gedola', 'ישיבה גדולה (די לעצטע)', 'text', { wide: 1 }],
    ['yg_city', 'City/State', 'שטאט / סטעיט', 'text', {}],
    ['yg_start', 'Date Started (month / year)', 'אנגעהויבן (חודש / יאר)', 'text', {}],
    ['yg_end', 'Date Ended (month / year)', 'געענדיגט (חודש / יאר)', 'text', {}],
    ['other_yeshivas', 'Other yeshivas attended', 'אנדערע ישיבות', 'area', { wide: 1 }],
  ] },
];
export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
export const fieldOf = (k) => ALL_FIELDS.find((f) => f[0] === k);

/** המסמכים. m = רק לנשוי. tax = שנה */
export function docsList(taxYears = []) {
  return [
    ['id_self', 'Photo ID (driver\'s license / state ID / passport)', 'אידענטיפיקאציע (דרייווער לייסענס / סטעיט ID / פאספארט)', 0, 1],
    ['ss_self', 'Social Security card', 'סאשעל סעקיוריטי קארטל', 0, 1],
    ['birth_self', 'Birth certificate', 'בירט סערטיפיקאט', 0, 1],
    ['id_wife', 'Spouse\'s photo ID', 'ווייב — אידענטיפיקאציע', 1, 1],
    ['ss_wife', 'Spouse\'s Social Security card', 'ווייב — סאשעל סעקיוריטי קארטל', 1, 1],
    ['birth_wife', 'Spouse\'s birth certificate', 'ווייב — בירט סערטיפיקאט', 1, 1],
    ['marriage', 'Marriage certificate', 'מערידזש סערטיפיקאט (כתובה רעגיסטראציע)', 1, 1],
    ['tax1', `Tax documents ${taxYears[0] || ''}`, `טעקס דאקומענטן ${taxYears[0] || ''}`, 0, 0],
    ['tax2', `Tax documents ${taxYears[1] || ''}`, `טעקס דאקומענטן ${taxYears[1] || ''}`, 0, 0],
  ].map(([k, en, yi, m, ai]) => ({ k, en, yi, m: !!m, ai: !!ai }));
}
export const STATUS = { draft: ['טיוטה', '#8a8a8a'], submitted: ['נשלח', '#1f6fb2'], updated: ['עודכן אחרי שליחה', '#b26b1f'], approved: ['אושר', '#1e7d3a'], rejected: ['נדחה', '#a33'] };

/** תצוגת ערך (תאריך → MM/DD/YYYY, בחירה → טקסט) */
export function showVal(k, v, lang = 'en') {
  const f = fieldOf(k); const s = String(v ?? '');
  if (!f || !s) return s;
  if (f[3] === 'date') { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[2]}/${m[3]}/${m[1]}` : s; }
  if (f[3] === 'select' || f[3] === 'yesno') { const o = (f[4].opts || YESNO).find((x) => x[0] === s); return o ? (lang === 'yi' ? o[2] : o[1]) : s; }
  return s;
}

/** 🖨 הטופס להדפסה — 8.5×11, בסגנון טופס הנייר */
export function printHtml(app, { lang = 'en', images = {}, blank = false } = {}) {
  const h = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const d = app.data || {};
  const married = blank || d.marital === 'married';
  // טופס ריק: בחירה → תיבות לסימון; תאריך → __/__/____
  const empty = (f) => (f[3] === 'select' ? f[4].opts.map((o) => `☐ ${h(o[1])}`).join('&nbsp;&nbsp; ') : f[3] === 'yesno' ? '☐ Yes&nbsp;&nbsp; ☐ No' : f[3] === 'date' ? '<span class="pf-dt">____ / ____ / ________</span>' : '');
  const row = (f) => `<div class="pf-r${f[4].wide || (blank && ['select', 'yesno'].includes(f[3])) ? ' w' : ''}"><span>${h(f[1])}:</span><b${f[4].rtl ? ' dir="rtl"' : ''}>${blank ? empty(f) : h(showVal(f[0], d[f[0]]))}</b></div>`;
  const sec = (s) => { const fs = s.fields.filter((f) => married || !f[4].m); return `<h3>${h(s.en.toUpperCase())}</h3><div class="pf-g">${fs.map(row).join('')}</div>`; };
  const sig = (k, nm) => (images[k] ? `<img src="${images[k]}" alt="">` : (d[nm] ? `<i class="pf-typed">${h(d[nm])}</i>` : ''));
  const docs = docsList(app.taxYears).filter((x) => married || !x.m);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kollel Enrollment${blank ? ' Form' : ` – ${h(d.legal_first)} ${h(d.legal_last)}`}</title>
<style>@page{size:8.5in 11in;margin:.5in}*{box-sizing:border-box}body{font:12.5px/1.45 Arial,sans-serif;color:#111;margin:0}
.pf-h{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:6px}
.pf-h .l{font-size:11px}.pf-h .r{text-align:right;direction:rtl;font:700 15px 'Frank Ruhl Libre',David,serif}
.pf-t{text-align:center;font-weight:700;letter-spacing:2px;margin:6px 0}.pf-yi{text-align:right;direction:rtl;font-size:15px;margin:4px 0 8px}
h3{font-size:12.5px;text-align:center;letter-spacing:1px;margin:12px 0 4px;background:#eee;padding:3px}
.pf-g{display:grid;grid-template-columns:1fr 1fr;gap:3px 18px}.pf-r{display:flex;gap:6px;border-bottom:1px solid #bbb;padding:2px 0;min-height:21px}.pf-r.w{grid-column:1/-1}
.pf-r span{color:#444;white-space:nowrap}.pf-r b{font-weight:600;flex:1}
.pf-docs{columns:2;font-size:11.5px;margin:4px 0}.pf-sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:22px}.pf-sig div{border-top:1px solid #111;padding-top:3px;text-align:center;font-size:11px;position:relative;min-height:60px}
.pf-sig img{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);max-height:55px;max-width:90%}.pf-typed{position:absolute;bottom:22px;left:0;right:0;font:italic 20px 'Brush Script MT',cursive}
.pf-dt{color:#999;letter-spacing:1px}.pf-note{font-size:11px;text-align:center;margin:6px 0}.pf-doc{page-break-before:always;text-align:center}.pf-doc img{max-width:100%;max-height:9.3in}.pf-doc p{font-weight:700;margin:0 0 6px}
@media screen{body{max-width:8.5in;margin:20px auto;padding:.5in;box-shadow:0 0 10px #aaa}}</style></head><body>
<div class="pf-h"><div class="l">5306 16th Ave<br>Brooklyn NY 11204<br>KhalUngvar@gmail.com | (718) 851-0806</div><div></div><div class="r">מרכז הכוללים<br>שע"י קהל אונגוואר</div></div>
<div class="pf-t">---- KOLLEL ENROLLMENT FORM ----</div>
<div class="pf-yi">נאמען אויף אידיש: <b>${h(d.yi_name)}</b></div>
${SECTIONS.map(sec).join('')}
<div class="pf-r w"><span>Email Address:</span><b>${h(app.email)}</b></div>
<h3>${blank ? 'REQUIRED DOCUMENTS TO APPLY' : 'DOCUMENTS ON FILE'}</h3>
<div class="pf-docs">${docs.map((x) => `<div>${(app.files?.[x.k] || []).length ? '☑' : '☐'} ${h(x.en)}${blank && x.m ? ' <i>(if married)</i>' : ''}</div>`).join('')}</div>
${blank ? '<p class="pf-note">Please attach clear copies of all documents. You can also fill out this form online: <b>ungvar.org/kollel/register</b></p>' : ''}
<div class="pf-sig"><div>${sig('sig_self', 'sig_self_name')}Applicant's Legal Signature · Date ${h(showVal('dob', d.sig_date) || '')}</div>${married ? `<div>${sig('sig_wife', 'sig_wife_name')}Spouse's Legal Signature · Date ${h(showVal('dob', d.sig_date) || '')}</div>` : '<div style="border:0"></div>'}</div>
${Object.entries(images).filter(([k]) => !k.startsWith('sig_')).map(([k, src]) => `<div class="pf-doc"><p>${h((docs.find((x) => k.startsWith(x.k)) || {}).en || k)}</p>${/^data:image/.test(src) ? `<img src="${src}">` : '<p>(PDF — opened separately)</p>'}</div>`).join('')}
<script>window.onload=()=>setTimeout(()=>print(),300)</script></body></html>`;
}
