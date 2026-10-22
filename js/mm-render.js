// Mail Merge — דאס צייכענען: קאנווערטן, לעיבלס, בריוו. אלע מאסן אין אינטשעס (96px = 1in).
// יעדע פונקציע באקומט דעם עיצוב (D) — אזוי קען מען צייכענען אויך אן אנדערן עיצוב (למשל די קאנווערטן פאר "א פּאָר").
import { state, orgLogo, NESHEI_ORG, orgDetailsOf } from './data.js';
import { escapeHtml as h, mailingName, isTrue, isAlive } from './util.js';
import { isoToHebrewText, todayIso } from './hebdate.js';
import { money } from './donations.js';
import { joinImg } from './receipts.js';

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
  return [8.5, 11];
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
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'FONT', 'DIV', 'P', 'BR', 'UL', 'OL', 'LI', 'SUB', 'SUP', 'BLOCKQUOTE']);
const OK_ATTR = new Set(['style', 'face', 'color', 'size', 'align', 'dir']);
export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  const walk = (el) => {
    [...el.children].forEach((ch) => {
      if (!OK_TAGS.has(ch.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'].includes(ch.tagName)) { ch.remove(); return; }
        ch.replaceWith(...ch.childNodes); // נאר דער טעקסט
        return;
      }
      [...ch.attributes].forEach((a) => {
        if (!OK_ATTR.has(a.name.toLowerCase()) || /url\s*\(|expression|javascript:/i.test(a.value)) ch.removeAttribute(a.name);
      });
      walk(ch);
    });
  };
  const root = doc.body.firstElementChild;
  walk(root);
  // נאכאמאל — "replaceWith" קען ברענגען נייע קינדער
  walk(root);
  return root.innerHTML;
}

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
    Date: longDateEn(todayIso()),
    סכום: x.total ? money(x.total) : '',
    שולם: x.paid ? money(x.paid) : '',
    נשאר: x.total ? money(x.remaining || 0) : '',
    תאריך_נדבה: x.date ? isoToHebrewText(x.date) : '',
    DonationDate: longDateEn(x.date),
    הקדשה: nz(x.dedication),
    קאמפיין: nz(x.campaign),
  };
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
  const lines = (txt, dir, font, size, bold) => `<div class="mx-rcp-part" dir="${dir}" style="font-family:'${font}';font-size:${size}pt">${
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
  return (D.boxes || []).map((b) => `<div class="mx-box${edit ? ' mx-drag' : ''}" data-part="box:${h(b.id)}" dir="${b.dir || 'rtl'}"
    style="left:${b.x}in;top:${b.y}in;width:${b.w}in;font-family:'${b.font || 'Frank Ruhl Libre'}';font-size:${b.size || 12}pt">${fillHtml(cleanHtml(b.html), vals, empties)}</div>`).join('');
}

// ---------- קאנווערט ----------
export function envHtml(D, c, { edit = false, num = '', ctx = null, empties = null } = {}) {
  const [W, H] = envSize(D);
  const vals = valuesFor(D, c, ctx);
  const r = D.ret;
  const logo = resolveLogo(r.logo, D.logo_data);
  const p = D.post;
  const post = p.mode === 'stamp' ? `<div class="env-stamp${p.border ? '' : ' no-border'}"></div>`
    : p.mode === 'image' && D.postage_data ? `<div class="env-stamp no-border"><img src="${D.postage_data}" alt=""></div>`
      : p.mode === 'text' ? `<div class="env-stamp env-indicia${p.border ? '' : ' no-border'}" style="font-size:${p.size}pt">${h(p.text).replace(/\n/g, '<br>')}</div>` : '';
  return `<div class="env mx-page" style="width:${W}in;height:${H}in">
    ${D.background_data ? `<img class="env-bg" src="${D.background_data}" style="opacity:${D.bg.opacity}" alt="">` : ''}
    ${r.show ? `<div class="env-part env-ret${edit ? ' mx-drag' : ''}" data-part="ret" style="left:${r.x}in;top:${r.y}in;font-family:'${r.font}';font-size:${r.size}pt" dir="${r.dir || 'ltr'}">
      ${logo ? `<img src="${logo}" style="height:${r.logoH}in" alt="">` : ''}<div>${h(r.text).replace(/\n/g, '<br>')}</div></div>` : ''}
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
      ? `<div class="mx-rcp-part" dir="${L.dir || 'ltr'}" style="font-family:'${L.font || D.rcp.font}';font-size:${L.size}pt">${h(L.text).replace(/\n/g, '<br>')}</div>`
      : rcpBlock({ ...D, rcp: { ...D.rcp, size: L.size, sizeHe: L.size, align: L.align } }, it, vals, null, { cls: 'mx-rcp mx-lbl-rcp' });
    // עגול: דער טעקסט אינעם ריבוע וואס פאסט אריין אין דעם קרייז (~71%)
    const pad = round ? Math.max(Number(L.pad) || 0, Math.min(S.w, S.h) * 0.146) : L.pad;
    return `<div class="lbl mx-lbl${shape} mx-lbl-${L.logoPos || 'left'}" style="${pos};padding:${pad}in;text-align:${L.align}">
      ${D.background_data ? `<img class="mx-lbl-bg" src="${D.background_data}" style="opacity:${D.bg.opacity}" alt="">` : ''}
      ${logo && (it === 'same' || L.logoAll) ? `<img class="mx-lbl-logo" src="${logo}" alt="">` : ''}
      <div class="mx-lbl-text">${inner}</div>${n ? `<span class="mx-num">${h(n)}</span>` : ''}</div>`;
  };
  return pages.map((page) => `<div class="lbl-sheet mx-page" style="width:8.5in;height:11in">
    ${Array.from({ length: per }, (_, i) => cell(page[i], i)).join('')}
    ${test ? `<div class="mx-test-note">TEST · ${h(S.name)} · nudge ${nx}" / ${ny}"</div>` : ''}</div>`);
}
export const labelsPerSheet = (D) => { const S = sheetOf(D.lbl.sheet || D.format); return S.cols * S.rows; };

// ---------- בריוו ----------
export function letterHtml(D, c, { edit = false, num = '', ctx = null, empties = null, extraClass = '' } = {}) {
  const L = D.ltr;
  const vals = valuesFor(D, c, ctx);
  const det = L.design === 'org' ? (orgDetailsOf(L.org) || {}) : {};
  const yc = L.design === 'org' && D.link?.series ? state.yearly.find((y) => y.series === D.link.series) : null;
  const banner = L.design === 'org' ? (joinImg(yc, 'header_img') || joinImg(det, 'header_img')) : '';
  const logo = L.design === 'org' && !banner ? orgLogo(L.org) : '';
  const m = L.margins || { top: 0.7, side: 0.8, bottom: 0.7 };
  const win = L.window ? (L.win || { x: 0.875, y: 2.25, w: 4, h: 1 }) : null;
  const winBottom = win ? win.y + win.h + 0.2 : 0;
  const bh = Number(L.bannerH) || 1.6;
  const headBottom = banner ? 0.3 + bh + 0.25 : logo ? 1.45 : 0;
  const body = fillHtml(cleanHtml(L.html), vals, empties);
  const foot = L.design === 'org' ? [det.footer_line ? `<div class="mx-foot-yi" dir="rtl">${h(det.footer_line)}</div>` : '',
    `<div class="mx-foot-legal">${[det.legal_name || L.org, [det.address, det.city_state_zip].filter(Boolean).join(', '), det.phone, det.email].filter(Boolean).map(h).join(' · ')}</div>`].join('') : '';
  const sig = L.sig && L.design === 'org' ? `<div class="mx-sig">${det.signature_text ? `<div style="font-family:'Playpen Sans Hebrew';font-size:20pt">${h(det.signature_text)}</div>`
    : det.signature_img ? `<img src="${det.signature_img}" alt="">` : ''}<div>${h(det.signer_he || '')}</div></div>` : '';
  const winBlock = win ? rcpBlock({ ...D, lang: L.winLang || 'en' }, c, vals, empties, {
    attrs: 'data-part="win"', cls: `mx-win${edit ? ' mx-drag' : ''}`, style: `left:${win.x}in;top:${win.y}in;width:${win.w}in;height:${win.h}in`,
  }) : '';
  return `<div class="mx-letter mx-page ${extraClass}" style="width:8.5in;height:11in">
    ${L.design === 'bg' && D.background_data ? `<img class="mx-letter-bg" src="${D.background_data}" style="opacity:${D.bg.opacity}" alt="">` : ''}
    ${banner ? `<img class="mx-banner" src="${banner}" style="top:0.3in;left:${m.side * 0.6}in;right:${m.side * 0.6}in;height:${bh}in" alt="">` : ''}
    ${logo ? `<div class="mx-band" style="top:0.3in;left:${m.side}in;right:${m.side}in"><img src="${logo}" alt=""><div dir="rtl">${h(det.org_name_he || L.org)}</div></div>` : ''}
    ${winBlock}
    <div class="mx-body" dir="${L.dir || 'rtl'}" style="left:${m.side}in;right:${m.side}in;top:${Math.max(m.top, headBottom, winBottom)}in;bottom:${m.bottom + (foot ? 0.55 : 0)}in;font-family:'${L.font}';font-size:${L.size}pt;line-height:${L.lineH}">
      ${body}${sig}</div>
    ${foot ? `<div class="mx-foot" style="left:${m.side}in;right:${m.side}in;bottom:${Math.max(0.3, m.bottom - 0.3)}in">${foot}</div>` : ''}
    ${boxesHtml(D, vals, empties, edit)}
    ${num ? `<div class="mx-num">${h(num)}</div>` : ''}
  </div>`;
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
