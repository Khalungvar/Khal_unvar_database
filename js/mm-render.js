// Mail Merge — דאס צייכענען: קאנווערטן, לעיבלס, בריוו. אלע מאסן אין אינטשעס (96px = 1in).
// יעדע פונקציע באקומט דעם עיצוב (D) — אזוי קען מען צייכענען אויך אן אנדערן עיצוב (למשל די קאנווערטן פאר "א פּאָר").
import { state, orgLogo, NESHEI_ORG, orgDetailsOf } from './data.js';
import { escapeHtml as h, mailingName, isTrue, isAlive, splitTags } from './util.js';
import { imageOf } from './images.js';
import { isoToHebrewText, todayIso } from './hebdate.js';
import { money } from './donations.js';
import { joinImg, sampleReceiptHtml, RX_H } from './receipts.js';

// ---------- גרייסן ----------
export const ENVELOPES = [
  ['env10', '#10 Business (9.5 × 4.125)', 9.5, 4.125],
  ['env9', '#9 (8.875 × 3.875)', 8.875, 3.875],
  ['env634', '#6¾ (6.5 × 3.625)', 6.5, 3.625],
  ['monarch', 'Monarch (7.5 × 3.875)', 7.5, 3.875],
  ['a2', 'A2 Invitation (5.75 × 4.375)', 5.75, 4.375],
  ['a7', 'A7 Invitation (7.25 × 5.25)', 7.25, 5.25],
  ['a9', 'A9 Invitation (8.75 × 5.75)', 8.75, 5.75],
  ['cat69', '6 × 9 Catalog', 9, 6],
  ['cat912', '9 × 12 Catalog', 12, 9],
  ['cat1013', '10 × 13 Catalog', 13, 10],
  ['dl', 'DL (220 × 110 mm)', 8.66, 4.33],
  ['c5', 'C5 (229 × 162 mm)', 9.02, 6.38],
];
// באקאנטע לעיבל-בויגנס (Letter): id, name, shape, cols, rows, w, h, top, left, hgap, vgap
export const KNOWN_SHEETS = [
  { id: 'av5160', name: 'Avery 5160 / 8160 — 30 (2⅝ × 1)', shape: 'rect', cols: 3, rows: 10, w: 2.625, h: 1, top: 0.5, left: 0.1875, hgap: 0.125, vgap: 0 },
  { id: 'av5161', name: 'Avery 5161 — 20 (4 × 1)', shape: 'rect', cols: 2, rows: 10, w: 4, h: 1, top: 0.5, left: 0.156, hgap: 0.1875, vgap: 0 },
  { id: 'av5162', name: 'Avery 5162 — 14 (4 × 1⅓)', shape: 'rect', cols: 2, rows: 7, w: 4, h: 1.333, top: 0.833, left: 0.156, hgap: 0.1875, vgap: 0 },
  { id: 'av5163', name: 'Avery 5163 — 10 (4 × 2)', shape: 'rect', cols: 2, rows: 5, w: 4, h: 2, top: 0.5, left: 0.156, hgap: 0.1875, vgap: 0 },
  { id: 'av5164', name: 'Avery 5164 — 6 (4 × 3⅓)', shape: 'rect', cols: 2, rows: 3, w: 4, h: 3.333, top: 0.5, left: 0.156, hgap: 0.1875, vgap: 0 },
  { id: 'av5167', name: 'Avery 5167 — 80 (1¾ × ½)', shape: 'rect', cols: 4, rows: 20, w: 1.75, h: 0.5, top: 0.5, left: 0.28, hgap: 0.3, vgap: 0 },
];
export const FONTS_EN = ['Georgia', 'Times New Roman', 'Garamond', 'Arial', 'Helvetica', 'Verdana', 'Courier New'];
export const FONTS_HE = ['Frank Ruhl Libre', 'David', 'Noto Rashi Hebrew', 'Arial', 'Playpen Sans Hebrew'];
const BUILTIN_LOGOS = [['crown', 'img/logo.png'], ['neshei', 'img/neshei-logo.png']];

let customSheets = []; // פונעם גיליון (MailTemplates, format 'sheets')
export function setCustomSheets(list) { customSheets = Array.isArray(list) ? list : []; }
export const allSheets = () => [...KNOWN_SHEETS, ...customSheets];
export const sheetOf = (id) => allSheets().find((s) => s.id === id) || KNOWN_SHEETS[0];

export function envSize(D) {
  if (D.format === 'custom') return [Math.max(2, Number(D.size?.w) || 9.5), Math.max(2, Number(D.size?.h) || 4.125)];
  const e = ENVELOPES.find(([k]) => k === D.format) || ENVELOPES[0];
  return [e[2], e[3]];
}
export function pageSize(D) {
  if (D.kind === 'env') return envSize(D);
  if (D.kind === 'ltr') return letterDims(D);
  return [8.5, 11];
}
// גרייסן פון א בריוו-בלאט: id, name, w, h
export const PAGE_SIZES = [
  ['letter', 'Letter 8.5 × 11', 8.5, 11],
  ['half', 'Half Letter 5.5 × 8.5', 5.5, 8.5],
  ['tabloid', 'Tabloid 11 × 17', 11, 17],
  ['a5', 'A5 (148 × 210 mm)', 5.83, 8.27],
  ['a4', 'A4 (210 × 297 mm)', 8.27, 11.69],
  ['a3', 'A3 (297 × 420 mm)', 11.69, 16.54],
];
export function letterDims(D) {
  const L = D.ltr || {};
  let w;
  let hh;
  if (L.page === 'custom') { w = Math.min(30, Math.max(3, Number(L.pw) || 8.5)); hh = Math.min(30, Math.max(3, Number(L.ph) || 11)); }
  else { const p = PAGE_SIZES.find(([k]) => k === L.page) || PAGE_SIZES[0]; [, , w, hh] = p; }
  return L.orient === 'l' ? [hh, w] : [w, hh];
}

// ---------- לאגאס ----------
export function resolveLogo(key, custom) {
  if (!key) return '';
  if (key === 'custom') return custom || '';
  if (String(key).startsWith('org:')) return orgLogo(key.slice(4));
  if (key === 'neshei') return orgLogo(NESHEI_ORG);
  return BUILTIN_LOGOS.find(([k]) => k === key)?.[1] || '';
}

// ---------- רייניקן HTML (רייכער טעקסט פונעם עדיטאר) ----------
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'FONT', 'DIV', 'P', 'BR', 'UL', 'OL', 'LI', 'SUB', 'SUP', 'BLOCKQUOTE',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'A', 'IMG', 'H1', 'H2', 'H3', 'H4']);
const OK_ATTR = new Set(['style', 'face', 'color', 'size', 'align', 'dir', 'colspan', 'rowspan', 'href', 'src', 'data-rep', 'alt', 'data-sig']);
export const REP_TYPES = ['don'];
// א זיכערער ווערט פאר א געוויסן attribute
function attrOk(name, v) {
  if (name === 'href') return /^(https?:\/\/|mailto:|tel:)/i.test(v);
  if (name === 'src') return /^(drv:[\w-]+|data:image\/(png|jpe?g|gif|webp);base64,[\w+/=]+)$/i.test(v);
  if (name === 'data-rep') return REP_TYPES.includes(v);
  if (name === 'data-sig') return v === '1';
  if (name === 'colspan' || name === 'rowspan') return /^\d{1,2}$/.test(v);
  if (name === 'style') return !/url\s*\(|expression|javascript:|\\|image-set|@import|position\s*:\s*(fixed|sticky)|behavior\s*:|-moz-binding/i.test(v);
  return !/url\s*\(|expression|javascript:/i.test(v);
}
export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  const walk = (el) => {
    [...el.children].forEach((ch) => {
      if (!OK_TAGS.has(ch.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'].includes(ch.tagName)) { ch.remove(); return; }
        ch.replaceWith(...ch.childNodes); // נאר דער טעקסט
        return;
      }
      const st = ch.getAttribute('style');
      if (st && /mso-/i.test(st)) ch.setAttribute('style', st.split(';').filter((d) => d.trim() && !/^\s*mso-/i.test(d)).join(';'));
      [...ch.attributes].forEach((a) => {
        if (!OK_ATTR.has(a.name.toLowerCase()) || !attrOk(a.name.toLowerCase(), a.value)) ch.removeAttribute(a.name);
      });
      if (ch.tagName === 'IMG' && !ch.getAttribute('src')) { ch.remove(); return; }
      walk(ch);
    });
  };
  const root = doc.body.firstElementChild;
  // ביז גארנישט טוישט זיך מער ("replaceWith" קען ברענגען נייע קינדער)
  let prev = '';
  for (let i = 0; i < 50 && prev !== root.innerHTML; i += 1) { prev = root.innerHTML; walk(root); }
  return root.innerHTML;
}

/** פאר א CSS / attribute ווערט (שריפט, ריכטונג) — נאר זיכערע אותיות */
const css = (v) => String(v ?? '').replace(/["'<>;{}\\]/g, '');
const dirv = (v) => (v === 'ltr' ? 'ltr' : 'rtl');
const imgSrc = (v) => (/^(data:image\/|img\/|https:\/\/)/.test(String(v || '')) ? h(v) : '');

// ---------- די פעלדער ----------
const nz = (v) => String(v ?? '').trim();
const cityLine = (c) => [[nz(c.city), nz(c.state)].filter(Boolean).join(', '), nz(c.zip)].filter(Boolean).join(' ');
const countryOf = (c) => (c.country && !/^(usa|us|u\.s\.a?\.?|united states)$/i.test(nz(c.country)) ? nz(c.country) : '');
const wifeEn = (c) => [isTrue(c.wife_is_rebbetzin) ? 'Rebbetzin' : 'Mrs.', nz(c.wife_name_en), nz(c.last_name_en)].filter(Boolean).join(' ');
export const longDateEn = (iso) => {
  if (!iso) return '';
  const dt = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(dt.getTime()) ? String(iso) : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/** די נדבות פון א מענטש אין דעם פארבונדענעם קאמפיין */
export function donationCtx(D, c) {
  const link = D.link || {};
  if (!link.name || !c || String(c.contact_id || '').startsWith('x:')) return null;
  const list = state.donations.filter((d) => String(d.contact_id) === String(c.contact_id) && d.campaign === link.name);
  const sum = (arr) => arr.reduce((s, d) => s + (Number(d.amount_usd) || 0), 0);
  const total = sum(list);
  const paid = sum(list.filter((d) => isTrue(d.is_paid)));
  const dates = list.map((d) => String(d.paid_date || d.date || '').slice(0, 10)).filter(Boolean).sort();
  const ded = [...new Set(list.map((d) => [d.dedication_type, d.dedication_text].filter(Boolean).join(' ')).filter(Boolean))].join(' · ');
  return { n: list.length, total, paid, remaining: Math.max(0, total - paid), date: dates.at(-1) || '', dedication: ded, campaign: link.name };
}

/** א לועזישער טאג אויף לשון קודש: "22 באוקטובר 2026" */
export const gregHe = (iso) => {
  const dt = new Date(`${String(iso || '').slice(0, 10)}T12:00:00`);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
};
/** די נדבות פאר א "שורה חוזרת" און די סכומים — לויט דעם סינון פונעם בריוו (אדער די נדבות פון א קבלה) */
export function donationList(D, c, ctx = null) {
  if (Array.isArray(ctx?.list)) return ctx.list;
  if (!c || String(c.contact_id || '').startsWith('x:')) return [];
  const F = D.ltr?.reps?.don || {};
  const camp = !F.camp || F.camp === 'link' ? (D.link?.name || '') : F.camp === 'all' ? '' : F.camp;
  const day = (d) => String(d.date || '').slice(0, 10);
  const list = state.donations.filter((d) => String(d.contact_id) === String(c.contact_id)
    && (!camp || d.campaign === camp)
    && (!F.from || day(d) >= F.from) && (!F.to || day(d) <= F.to)
    && (!F.unpaid || !isTrue(d.is_paid)));
  list.sort((a, b) => day(a).localeCompare(day(b)));
  if (F.order === 'desc') list.reverse();
  return list;
}
const sumOf = (arr) => arr.reduce((s, d) => s + (Number(d.amount_usd) || 0), 0);
const shortDate = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}/${Number(m[2])}/${m[1]}` : nz(iso); };
/** די ווערטער פון איין נדבה (פאר א שורה חוזרת) */
export function donationVals(d, en = false) {
  const paid = isTrue(d.is_paid);
  const amt = Number(d.amount_usd) || 0;
  const v = {
    נדבה_תאריך: shortDate(d.date),
    נדבה_תאריך_עברי: nz(d.hebrew_date) || (d.date ? isoToHebrewText(d.date) : ''),
    נדבה_סכום: amt ? money(amt) : '',
    נדבה_שולם: en ? (paid ? 'Yes' : 'No') : (paid ? 'כן' : 'לא'),
    נדבה_נשאר: money(paid ? 0 : amt),
    נדבה_תאריך_תשלום: shortDate(d.paid_date),
    נדבה_אמצעי: nz(d.payment_method),
    נדבה_צק: nz(d.check_number),
    נדבה_הקדשה: [d.dedication_type, d.dedication_text].map(nz).filter(Boolean).join(' '),
    נדבה_קמפיין: nz(d.campaign),
    נדבה_אירוע: [splitTags(d.event_tags).join(', '), nz(d.event_year)].filter(Boolean).join(' '),
    נדבה_הערה: nz(d.event_note),
  };
  Object.assign(v, {
    DonDate: longDateEn(d.date), DonHebDate: v.נדבה_תאריך_עברי, DonAmount: v.נדבה_סכום, DonPaid: paid ? 'Yes' : 'No', DonDue: v.נדבה_נשאר,
    DonPaidDate: longDateEn(d.paid_date), DonMethod: v.נדבה_אמצעי, DonCheck: v.נדבה_צק, DonDedication: v.נדבה_הקדשה,
    DonCampaign: v.נדבה_קמפיין, DonEvent: v.נדבה_אירוע, DonNote: v.נדבה_הערה,
  });
  return v;
}
export const DON_TOKENS = ['נדבה_תאריך', 'נדבה_תאריך_עברי', 'נדבה_סכום', 'נדבה_שולם', 'נדבה_נשאר', 'נדבה_תאריך_תשלום', 'נדבה_אמצעי', 'נדבה_צק', 'נדבה_הקדשה', 'נדבה_קמפיין', 'נדבה_אירוע', 'נדבה_הערה'];
export const DON_TOKENS_EN = ['DonDate', 'DonHebDate', 'DonAmount', 'DonPaid', 'DonDue', 'DonPaidDate', 'DonMethod', 'DonCheck', 'DonDedication', 'DonCampaign', 'DonEvent', 'DonNote'];
export const TOTAL_TOKENS = ['סה"כ_סכום', 'סה"כ_שולם', 'סה"כ_נשאר', 'מספר_נדבות'];
export const TOTAL_TOKENS_EN = ['TotalAmount', 'TotalPaid', 'TotalDue', 'DonCount'];

/** "שורה חוזרת" אין א טאבעלע: איין שורה פאר יעדע נדבה */
export function expandRepeats(html, D, c, ctx = null) {
  if (!String(html).includes('data-rep') || !c) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const en = D.ltr?.dir === 'ltr';
  doc.querySelectorAll('tr[data-rep]').forEach((tr) => {
    const items = tr.dataset.rep === 'don' ? donationList(D, c, ctx) : [];
    items.forEach((d) => {
      const cl = tr.cloneNode(true);
      cl.removeAttribute('data-rep');
      cl.innerHTML = fillHtml(cl.innerHTML, donationVals(d, en));
      tr.before(cl);
    });
    tr.remove();
  });
  return doc.body.firstElementChild.innerHTML;
}
/** בילדער אינעם טעקסט: "drv:<id>" → דאס בילד */
export const resolveImgs = (html) => String(html || '').replace(/src="drv:([\w-]+)"/g, (m, id) => {
  const d = imageOf(`drv:${id}`);
  return `src="${/^data:image\/(png|jpe?g|gif|webp);base64,[\w+/=]+$/i.test(d || '') ? d : ''}" data-drv="${id}"`;
});
/** א טיוטה: די פעלדער בלייבן «פעלד» */
const draftHtml = (html) => String(html || '').replace(TOKEN_RE, (m, k) => `«${h(k)}»`);

/** אלע ווערטער פאר א מענטש. ctx = { total, paid, remaining, date, dedication, campaign } (פון א קאמפיין אדער א קבלה) */
export function valuesFor(D, c, ctx = null) {
  if (!c) return {};
  const x = ctx || donationCtx(D, c) || {};
  const fullHe = [c.title_he, c.first_name_he, c.last_name_he].map(nz).filter(Boolean).join(' ');
  const nameEn = c._toWife && nz(c.last_name_en) ? wifeEn(c) : (mailingName(c) || [c.first_name_en, c.last_name_en].map(nz).filter(Boolean).join(' '));
  const he = isoToHebrewText(todayIso());
  const v = {
    תואר: nz(c.title_he),
    שם: [c.first_name_he, c.last_name_he].map(nz).filter(Boolean).join(' '),
    שם_מלא: fullHe,
    שם_פרטי: nz(c.first_name_he),
    משפחה: nz(c.last_name_he),
    פנייה: nz(D.ltr?.salutation),
    אשה: nz(c.wife_name_he),
    Name: nameEn || '',
    First: nz(c.first_name_en),
    Last: nz(c.last_name_en),
    Wife: nz(c.wife_name_en) ? wifeEn(c) : '',
    Address: nz(c.address),
    City: cityLine(c),
    Country: countryOf(c),
    תאריך: he ? `${he} לפ"ק` : '',
    תאריך_לועזי: gregHe(todayIso()),
    Date: longDateEn(todayIso()),
    סכום: x.total ? money(x.total) : '',
    שולם: x.paid ? money(x.paid) : '',
    נשאר: x.total ? money(x.remaining || 0) : '',
    תאריך_נדבה: x.date ? isoToHebrewText(x.date) : '',
    DonationDate: longDateEn(x.date),
    הקדשה: nz(x.dedication),
    קאמפיין: nz(x.campaign),
  };
  // די סכומים פון די נדבות (לויט דעם סינון פון דער "שורה חוזרת")
  const dl = donationList(D, c, ctx);
  const tot = sumOf(dl);
  const pd = sumOf(dl.filter((d) => isTrue(d.is_paid)));
  Object.assign(v, {
    'סה"כ_סכום': money(tot), 'סה"כ_שולם': money(pd), 'סה"כ_נשאר': money(Math.max(0, tot - pd)), מספר_נדבות: String(dl.length),
    TotalAmount: money(tot), TotalPaid: money(pd), TotalDue: money(Math.max(0, tot - pd)), DonCount: String(dl.length),
  });
  // נעמען פון דעם אלטן מייל מירדזש
  Object.assign(v, {
    mailing: v.Name, wife: v.Wife, first: v.First, last: v.Last, address: v.Address,
    city: nz(c.city), state: nz(c.state), zip: nz(c.zip), country: v.Country,
    legal: [c.legal_first_name || c.first_name_en, c.last_name_en].map(nz).filter(Boolean).join(' '), hebrew: fullHe,
  });
  return v;
}

export const TOKEN_RE = /\{([^{}\s]{1,24})\}/g;
/** פלעין טעקסט: יעדע שורה; ליידיגע שורות פאלן ארויס. empties = Set פון פעלדער וואס זענען ליידיג געבליבן */
export function fillText(tpl, vals, empties = null) {
  return String(tpl || '').replace(TOKEN_RE, (m, k) => {
    if (!(k in vals)) return m;
    if (!vals[k] && empties) empties.add(k);
    return vals[k] || '';
  }).split('\n').map((l) => l.replace(/^[\s,]+|[\s,]+$/g, '')).filter((l) => l.trim()).join('\n');
}
/** רייכער טעקסט (HTML): די ווערטער ווערן ארויסגעביטן (געשיצט) */
export function fillHtml(html, vals, empties = null) {
  return String(html || '').replace(TOKEN_RE, (m, k) => {
    if (!(k in vals)) return m;
    if (!vals[k] && empties) empties.add(k);
    return h(vals[k] || '');
  });
}

// ---------- דער נמען (ענגליש / לשון קודש / ביידע) ----------
function rcpBlock(D, c, vals, empties, { cls = 'mx-rcp', style = '', attrs = '' } = {}) {
  const r = D.rcp;
  const lines = (txt, dir, font, size, bold) => `<div class="mx-rcp-part" dir="${dir}" style="font-family:'${css(font)}';font-size:${Number(size) || 11}pt">${
    txt.split('\n').map((l, i) => `<div${i === 0 && bold ? ' class="mx-b"' : ''}>${h(l)}</div>`).join('')}</div>`;
  const lang = D.lang || 'en';
  const he = lang !== 'en' && c ? fillText(r.templateHe, vals, empties) : '';
  const en = lang !== 'he' && c ? fillText(r.template, vals, empties) : '';
  const body = !c ? `<div class="mx-ph">[${lang === 'he' ? 'שם' : 'Name'}]</div>`
    : `${he ? lines(he, 'rtl', r.fontHe || 'Frank Ruhl Libre', r.sizeHe || r.size, r.bold) : ''}${en ? lines(en, 'ltr', r.font, r.size, r.bold) : ''}`;
  return `<div ${attrs} class="${cls}" style="text-align:${r.align};${style}">${body}</div>`;
}

// ---------- פרייע טעקסט קעסטלעך (קאנווערט / בריוו) ----------
function boxesHtml(D, vals, empties, edit) {
  return (D.boxes || []).map((b) => `<div class="mx-box${edit ? ' mx-drag' : ''}" data-part="box:${h(b.id)}" dir="${dirv(b.dir)}"
    style="left:${Number(b.x) || 0}in;top:${Number(b.y) || 0}in;width:${Number(b.w) || 3}in;font-family:'${css(b.font || 'Frank Ruhl Libre')}';font-size:${Number(b.size) || 12}pt">${fillHtml(cleanHtml(b.html), vals, empties)}</div>`).join('');
}

// ---------- קאנווערט ----------
export function envHtml(D, c, { edit = false, num = '', ctx = null, empties = null } = {}) {
  const [W, H] = envSize(D);
  const vals = valuesFor(D, c, ctx);
  const r = D.ret;
  const logo = resolveLogo(r.logo, D.logo_data);
  const p = D.post;
  const post = p.mode === 'stamp' ? `<div class="env-stamp${p.border ? '' : ' no-border'}"></div>`
    : p.mode === 'image' && D.postage_data ? `<div class="env-stamp no-border"><img src="${imgSrc(D.postage_data)}" alt=""></div>`
      : p.mode === 'text' ? `<div class="env-stamp env-indicia${p.border ? '' : ' no-border'}" style="font-size:${p.size}pt">${h(p.text).replace(/\n/g, '<br>')}</div>` : '';
  return `<div class="env mx-page" style="width:${W}in;height:${H}in">
    ${D.background_data ? `<img class="env-bg" src="${imgSrc(D.background_data)}" style="opacity:${D.bg.opacity}" alt="">` : ''}
    ${r.show ? `<div class="env-part env-ret${edit ? ' mx-drag' : ''}" data-part="ret" style="left:${Number(r.x) || 0}in;top:${Number(r.y) || 0}in;font-family:'${css(r.font)}';font-size:${Number(r.size) || 9}pt" dir="${r.dir === 'rtl' ? 'rtl' : 'ltr'}">
      ${logo ? `<img src="${imgSrc(logo)}" style="height:${r.logoH}in" alt="">` : ''}<div>${h(r.text).replace(/\n/g, '<br>')}</div></div>` : ''}
    ${rcpBlock(D, c, vals, empties, { attrs: 'data-part="rcp"', cls: `env-part env-rcp mx-rcp${edit ? ' mx-drag' : ''}`, style: `left:${D.rcp.x}in;top:${D.rcp.y}in;max-width:${Math.max(1, W - D.rcp.x - 0.2)}in` })}
    ${post}
    ${boxesHtml(D, vals, empties, edit)}
    ${num ? `<div class="mx-num">${h(num)}</div>` : ''}
  </div>`;
}

// ---------- לעיבלס ----------
/** items: c / 'skip' / 'same' / undefined (ליידיג). גיט צוריק א ליסטע פון בלעטער */
export function labelPages(D, list, { test = false, all = true, nums = null } = {}) {
  const S = sheetOf(D.lbl.sheet || D.format);
  const L = D.lbl;
  const per = S.cols * S.rows;
  const skip = Math.max(0, Math.min(per - 1, Number(L.skip) || 0));
  let items;
  if (test) items = Array.from({ length: per }, (_, i) => ({ test: i + 1 }));
  else if (L.mode === 'same') items = [...Array(skip).fill('skip'), ...Array(per * Math.max(1, Number(L.sheets) || 1) - skip).fill('same')];
  else items = [...Array(skip).fill('skip'), ...list];
  const pages = [];
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
  if (!pages.length) pages.push([]);
  const nx = Number(L.nudgeX) || 0; const ny = Number(L.nudgeY) || 0;
  const logo = resolveLogo(L.logo, D.logo_data);
  const round = S.shape === 'round';
  let k = 0;
  const cell = (it, i) => {
    const col = i % S.cols; const row = Math.floor(i / S.cols);
    const pos = `left:${S.left + nx + col * (S.w + S.hgap)}in;top:${S.top + ny + row * (S.h + S.vgap)}in;width:${S.w}in;height:${S.h}in`;
    const shape = round ? ' mx-round' : '';
    if (it === 'skip') return `<div class="lbl lbl-used${shape}" style="${pos}"></div>`;
    if (it === undefined) return all ? `<div class="lbl lbl-empty${shape}" style="${pos}"></div>` : '';
    if (it.test) return `<div class="lbl mx-lbl-test${shape}" style="${pos}"><span>${it.test}</span></div>`;
    const n = nums && it !== 'same' ? nums[k++] : '';
    const vals = it === 'same' ? {} : valuesFor(D, it);
    const inner = it === 'same'
      ? `<div class="mx-rcp-part" dir="${L.dir === 'rtl' ? 'rtl' : 'ltr'}" style="font-family:'${css(L.font || D.rcp.font)}';font-size:${Number(L.size) || 10}pt">${h(L.text).replace(/\n/g, '<br>')}</div>`
      : rcpBlock({ ...D, rcp: { ...D.rcp, size: L.size, sizeHe: L.size, align: L.align } }, it, vals, null, { cls: 'mx-rcp mx-lbl-rcp' });
    // עגול: דער טעקסט אינעם ריבוע וואס פאסט אריין אין דעם קרייז (~71%)
    const pad = round ? Math.max(Number(L.pad) || 0, Math.min(S.w, S.h) * 0.146) : L.pad;
    return `<div class="lbl mx-lbl${shape} mx-lbl-${L.logoPos || 'left'}" style="${pos};padding:${pad}in;text-align:${L.align}">
      ${D.background_data ? `<img class="mx-lbl-bg" src="${imgSrc(D.background_data)}" style="opacity:${D.bg.opacity}" alt="">` : ''}
      ${logo && (it === 'same' || L.logoAll) ? `<img class="mx-lbl-logo" src="${imgSrc(logo)}" alt="">` : ''}
      <div class="mx-lbl-text">${inner}</div>${n ? `<span class="mx-num">${h(n)}</span>` : ''}</div>`;
  };
  return pages.map((page) => `<div class="lbl-sheet mx-page" style="width:8.5in;height:11in">
    ${Array.from({ length: per }, (_, i) => cell(page[i], i)).join('')}
    ${test ? `<div class="mx-test-note">TEST · ${h(S.name)} · nudge ${nx}" / ${ny}"</div>` : ''}</div>`);
}
export const labelsPerSheet = (D) => { const S = sheetOf(D.lbl.sheet || D.format); return S.cols * S.rows; };

// ---------- בריוו ----------
/** דער פלאץ פונעם טעקסט אויף א בלאט (אינטשעס) */
export function letterGeo(D) {
  const L = D.ltr;
  const det = L.design === 'org' ? (orgDetailsOf(L.org) || {}) : {};
  const yc = L.design === 'org' && D.link?.series ? state.yearly.find((y) => y.series === D.link.series) : null;
  const banner = L.design === 'org' ? (joinImg(yc, 'header_img') || joinImg(det, 'header_img')) : '';
  const logo = L.design === 'org' && !banner ? orgLogo(L.org) : '';
  const m = L.margins || { top: 0.7, side: 0.8, bottom: 0.7 };
  const win = L.window ? (L.win || { x: 0.875, y: 2.25, w: 4, h: 1 }) : null;
  const winBottom = win ? win.y + win.h + 0.2 : 0;
  const bh = Number(L.bannerH) || 1.6;
  const headBottom = banner ? 0.3 + bh + 0.25 : logo ? 1.45 : 0;
  const foot = L.design === 'org';
  const [W, H] = letterDims(D);
  return {
    det, banner, logo, m, win, bh, foot, W, H,
    top1: Math.max(m.top, headBottom, winBottom), // ערשטער בלאט
    topN: m.top + 0.4,                            // המשך בלעטער
    bottom: m.bottom + (foot ? 0.55 : 0),         // פון אונטן
    // "ייבוא קבלה": דאס אונטערשטע דריטל פונעם ערשטן בלאט איז פאר דער קבלה
    bottom1: L.rcSlot ? Math.max(m.bottom, RX_H + 0.2) : m.bottom + (foot ? 0.55 : 0),
  };
}
/** די חתימה */
export function sigHtml(D) {
  const L = D.ltr;
  if (!(L.sig && L.design === 'org')) return '';
  const det = orgDetailsOf(L.org) || {};
  return `<div class="mx-sig">${det.signature_text ? `<div style="font-family:'Playpen Sans Hebrew';font-size:20pt">${h(det.signature_text)}</div>`
    : det.signature_img ? `<img src="${imgSrc(det.signature_img)}" alt="">` : ''}<div>${h(det.signer_he || '')}</div></div>`;
}
/** די סטיילס פונעם טעקסט (שריפט, גרייס, שורות) */
export const bodyStyle = (L) => `font-family:'${css(L.font)}';font-size:${Number(L.size) || 13}pt;line-height:${Number(L.lineH) || 1.5};--pa:${Number(L.paraAfter ?? 0.55)}em`;
/** א סימן מים (טעקסט אדער בילד) הינטער'ן טעקסט */
export function watermarkHtml(D) {
  const w = D.ltr?.wm;
  if (!w || !w.on) return '';
  const op = Math.min(1, Math.max(0.03, Number(w.op) || 0.15));
  if (w.type === 'img') {
    const src = imageOf(w.img);
    return src ? `<img class="mx-wm mx-wm-img" src="${imgSrc(src)}" style="opacity:${op};width:${Math.min(95, Math.max(10, Number(w.scale) || 60))}%" alt="">` : '';
  }
  return `<div class="mx-wm" style="opacity:${op};color:${css(w.color || '#888888')};font-size:${Math.min(200, Math.max(12, Number(w.size) || 90))}pt;font-family:'${css(w.font || 'Frank Ruhl Libre')}';transform:translate(-50%,-50%) rotate(${w.diag === false ? 0 : -40}deg)">${h(w.text || '')}</div>`;
}
/** א "מעבר עמוד" אין טעקסט */
export const PGBRK = '<div style="page-break-before:always"></div>';
export const isPgBrk = (el) => el?.nodeType === 1 && /page-break-before\s*:\s*always|break-before\s*:\s*page/i.test(el.getAttribute('style') || '');

export function letterHtml(D, c, { edit = false, num = '', ctx = null, empties = null, extraClass = '', cont = 0, bodyOverride = null, draft = false } = {}) {
  const L = D.ltr;
  const vals = valuesFor(D, c, ctx);
  const G = letterGeo(D);
  const { det, banner, logo, m, win, bh } = G;
  // עמוד המשך: בלי באנר / חלון / תיבות, ושורת "המשך" קטנה למעלה
  const first = !cont;
  const raw = cleanHtml(L.html);
  const body = bodyOverride !== null ? bodyOverride : resolveImgs(draft ? draftHtml(raw) : fillHtml(expandRepeats(raw, D, c, ctx), vals, empties));
  const foot = G.foot ? [det.footer_line ? `<div class="mx-foot-yi" dir="rtl">${h(det.footer_line)}</div>` : '',
    `<div class="mx-foot-legal">${[det.legal_name || L.org, [det.address, det.city_state_zip].filter(Boolean).join(', '), det.phone, det.email].filter(Boolean).map(h).join(' · ')}</div>`].join('') : '';
  const sig = bodyOverride !== null ? '' : sigHtml(D);
  const winBlock = win && first ? rcpBlock({ ...D, lang: L.winLang || 'en' }, c, vals, empties, {
    attrs: 'data-part="win"', cls: `mx-win${edit ? ' mx-drag' : ''}`, style: `left:${win.x}in;top:${win.y}in;width:${win.w}in;height:${win.h}in`,
  }) : '';
  return `<div class="mx-letter mx-page ${extraClass}" style="width:${G.W}in;height:${G.H}in">
    ${L.design === 'bg' && D.background_data ? `<img class="mx-letter-bg" src="${imgSrc(D.background_data)}" style="opacity:${D.bg.opacity}" alt="">` : ''}
    ${watermarkHtml(D)}
    ${banner && first ? `<img class="mx-banner" src="${imgSrc(banner)}" style="top:0.3in;left:${m.side * 0.6}in;right:${m.side * 0.6}in;height:${bh}in" alt="">` : ''}
    ${logo && first ? `<div class="mx-band" style="top:0.3in;left:${m.side}in;right:${m.side}in"><img src="${imgSrc(logo)}" alt=""><div dir="rtl">${h(det.org_name_he || L.org)}</div></div>` : ''}
    ${winBlock}
    ${cont ? `<div class="mx-cont" dir="${dirv(L.dir)}" style="left:${m.side}in;right:${m.side}in;top:${m.top}in">${h(L.dir === 'ltr' ? 'continued' : 'המשך')} · ${h(vals.שם_מלא || vals.Name || '')} · ${cont + 1}</div>` : ''}
    <div class="mx-body" dir="${dirv(L.dir)}" style="left:${m.side}in;right:${m.side}in;top:${first ? G.top1 : G.topN}in;bottom:${first ? G.bottom1 : G.bottom}in;${bodyStyle(L)}">
      ${body}${sig}</div>
    ${foot && !(L.rcSlot && first) ? `<div class="mx-foot" style="left:${m.side}in;right:${m.side}in;bottom:${Math.max(0.3, m.bottom - 0.3)}in">${foot}</div>` : ''}
    ${L.rcSlot && first ? `<div class="mx-rcslot" style="top:${G.H - RX_H}in"><div class="mx-rccut">✂</div>${ctx?.receipt || (edit || draft ? `<div class="mx-rcsample">${sampleReceiptHtml(L.org)}</div>` : '')}</div>` : ''}
    ${first ? boxesHtml(D, vals, empties, edit) : ''}
    ${num ? `<div class="mx-num">${h(num)}</div>` : ''}
  </div>`;
}

/** מכתב → איינס אדער מער בלעטער: וואס פאסט נישט אריין גייט ווייטער אויפן קומענדיגן בלאט (ביז 5) */
let pageHost = null;
export function letterPages(D, c, opts = {}) {
  if (!pageHost) {
    pageHost = document.createElement('div');
    pageHost.id = 'mx-measure2';
    document.body.append(pageHost);
  }
  const box = pageHost;
  const over = (b) => b.scrollHeight > b.clientHeight + 2;
  // וואס גייט אריבער צום קומענדיגן בלאט: נאך א "מעבר עמוד", אדער וואס פאסט נישט אריין
  const cut = (body) => {
    const kids = [...body.childNodes];
    const i = kids.findIndex(isPgBrk);
    const rest = [];
    if (i >= 0) kids.slice(i).forEach((x, j) => { x.remove(); if (j > 0) rest.push(x); });
    while (over(body)) {
      const last = body.lastChild;
      if (!last) break;
      // א טאבעלע / טורים: נאר א טייל גייט אריבער
      const part = splitOff(last, () => over(body));
      if (part) { rest.unshift(part); break; }
      // נאר דאס איינציגע עלעמענט אויפן בלאט — בלייבט (אנדערש: ליידיגע בלעטער)
      if ([...body.childNodes].filter((x) => x.nodeType === 1 || String(x.textContent || '').trim()).length <= 1) break;
      rest.unshift(last);
      last.remove();
    }
    return rest;
  };
  box.innerHTML = letterHtml(D, c, opts);
  let page = box.firstElementChild;
  let body = page.querySelector('.mx-body');
  const pages = [];
  for (let n = 0; n < 200; n += 1) {
    const rest = cut(body);
    pages.push(page.outerHTML);
    if (!rest.some((x) => x.nodeType === 1 || String(x.textContent || '').trim())) break;
    const tmp = document.createElement('div');
    rest.forEach((x) => tmp.appendChild(x));
    box.innerHTML = letterHtml(D, c, { ...opts, edit: false, cont: n + 1, bodyOverride: tmp.innerHTML });
    page = box.firstElementChild;
    body = page.querySelector('.mx-body');
  }
  box.innerHTML = '';
  return pages;
}

/** דער סוף פון א טאבעלע (אדער פון טורים) וואס פאסט נישט אריין → א נייע טאבעלע (מיט דער כותרת) פאר'ן קומענדיגן בלאט */
function splitOff(el, over) {
  if (el?.nodeType !== 1) return null;
  if (el.tagName === 'TABLE') {
    const bodyRows = [...el.rows].filter((r) => r.parentElement.tagName !== 'THEAD');
    if (bodyRows.length < 2) return null;
    const cl = el.cloneNode(false);
    const th = el.tHead;
    if (th) cl.append(th.cloneNode(true));
    const tb = document.createElement('tbody');
    cl.append(tb);
    const moved = [];
    while (over() && moved.length < bodyRows.length - 1) {
      const r = bodyRows[bodyRows.length - 1 - moved.length];
      moved.push(r);
      tb.prepend(r);
    }
    if (over()) { moved.reverse().forEach((r) => (el.tBodies[0] || el).append(r)); return null; }
    return moved.length ? cl : null;
  }
  if (el.tagName === 'DIV' && /column-count/i.test(el.getAttribute('style') || '') && el.children.length > 1) {
    const cl = el.cloneNode(false);
    const kids = [...el.children];
    let n = 0;
    while (over() && n < kids.length - 1) { cl.prepend(kids[kids.length - 1 - n]); n += 1; }
    if (over()) { [...cl.children].forEach((k) => el.append(k)); return null; }
    return n ? cl : null;
  }
  return null;
}

/** איין בלאט פאר א מענטש (קאנווערט אדער בריוו) */
export function pageFor(D, c, opts = {}) {
  return D.kind === 'ltr' ? letterHtml(D, c, opts) : envHtml(D, c, opts);
}

// ---------- וואס פעלט ----------
export const hasAddr = (c) => Boolean(nz(c?.address) && (nz(c?.zip) || nz(c?.city)));
export const partAddr = (c) => Boolean(nz(c?.address)) && !(nz(c?.city) && nz(c?.zip));
export const addrKey = (c) => `${nz(c.address).toLowerCase().replace(/[^a-z0-9]/g, '')}|${nz(c.zip).slice(0, 5)}`;
export const isDeceased = (c) => !c._ext && !isAlive(c.is_alive) && !(c.marital_status === 'נשוי' && isAlive(c.wife_is_alive));
