// Mail Merge: עורך לקאנווערטן און לעיבלס.
// לוגא און הינטערגרונט, צוריק-אדרעס (לינקס אויבן), דער נמען אין דער מיט (פון א רשימה), און דער ווינקל פון דער מארקע (רעכטס אויבן).
// מען שלעפט די טיילן מיטן מויז; אלעס ווערט געדרוקט אין דער ריכטיגער גרייס פונעם קאנווערט / לעיבל-בויגן.
import { customFontNames } from './fonts.js';
import {
  state, loadAll, saveRecord, deleteRecord, orgLogo, NESHEI_ORG,
} from './data.js';
import { t } from './i18n.js';
import {
  escapeHtml as h, mailingName, shrinkImage as shrink, isTrue,
} from './util.js';
import { evaluate, parseSaved, templates as readyLists, savedInScope, savedMailRows } from './lists.js';
import { umbrellaName } from './scope.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// גרייסן אין אינטשעס (ברייט × הייך)
const ENVELOPES = [
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
// לעיבלס אויף א Letter בויגן: [id, נאמען, קאלומס, שורות, ברייט, הייך, אויבן, לינקס, אפשטאנד-ברייט, אפשטאנד-הייך]
const LABELS = [
  ['av5160', 'Avery 5160 / 8160 — 30 (2⅝ × 1)', 3, 10, 2.625, 1, 0.5, 0.1875, 0.125, 0],
  ['av5161', 'Avery 5161 — 20 (4 × 1)', 2, 10, 4, 1, 0.5, 0.156, 0.1875, 0],
  ['av5162', 'Avery 5162 — 14 (4 × 1⅓)', 2, 7, 4, 1.333, 0.833, 0.156, 0.1875, 0],
  ['av5163', 'Avery 5163 — 10 (4 × 2)', 2, 5, 4, 2, 0.5, 0.156, 0.1875, 0],
  ['av5164', 'Avery 5164 — 6 (4 × 3⅓)', 2, 3, 4, 3.333, 0.5, 0.156, 0.1875, 0],
  ['av5167', 'Avery 5167 — 80 (1¾ × ½)', 4, 20, 1.75, 0.5, 0.5, 0.28, 0.3, 0],
];
const FONTS = ['Georgia', 'Times New Roman', 'Garamond', 'Arial', 'Helvetica', 'Verdana', 'Courier New'];
const BUILTIN_LOGOS = [['crown', 'img/logo.png'], ['neshei', 'img/neshei-logo.png']];
const TOKENS = ['mailing', 'wife', 'first', 'last', 'address', 'city', 'state', 'zip', 'country', 'legal', 'hebrew'];

function defaults() {
  return {
    template_id: '', name: '', format: 'env10',
    list: '', skipNoAddress: true, toWife: false,
    ret: { show: true, logo: 'crown', logoH: 0.55, text: `${'Khal Ungvar'}\n123 Main Street\nBrooklyn, NY 11219`, font: 'Georgia', size: 9, x: 0.25, y: 0.22 },
    rcp: { template: '{mailing}\n{address}\n{city}, {state} {zip}\n{country}', font: 'Georgia', size: 12, bold: true, align: 'left', x: 3.8, y: 1.9 },
    post: { mode: 'stamp', text: 'PRSRT STD\nU.S. POSTAGE\nPAID\nPERMIT #000', size: 7, border: true },
    bg: { opacity: 0.12 },
    lbl: { size: 10, align: 'left', pad: 0.12, skip: 0, mode: 'list', text: 'Khal Ungvar\n123 Main Street\nBrooklyn, NY 11219', logo: '' },
    logo_data: '', background_data: '', postage_data: '',
  };
}

let d = defaults();
let rows = [];
let idx = 0;

export function initMailMerge(helpers) {
  ui = helpers;
}

/** פון א רשימה: עפענען מיט דער רשימה אויסגעקליבן */
export function openMailMergeWith(listKey) {
  d.list = listKey;
  openMailMerge();
}

export function openMailMerge() {
  document.body.classList.add('solo-mode');
  ui.showView('mailmerge');
}

// ---------- מקורות ----------
function listOptions() {
  const saved = savedInScope().map((l) => [`saved:${l.list_id}`, l.name]);
  const ready = readyLists().map((x, i) => [`tpl:${i}`, t(x.key)]);
  return [[t('myLists'), saved], [t('readyLists'), ready]];
}

function loadRows() {
  if (!d.list) { const first = savedInScope()[0]; if (first) d.list = `saved:${first.list_id}`; } // ברירת מחדל: די ערשטע רשימה
  const [kind, id] = String(d.list).split(':');
  let cr;
  if (kind === 'saved') {
    const l = state.savedLists.find((x) => String(x.list_id) === id);
    rows = l ? savedMailRows(l) : []; // לויט דער רשימה: איין קאנווערט פאר א שטוב א.א.וו.
  } else {
    cr = readyLists()[Number(id)]?.criteria;
    rows = cr ? evaluate(cr).map((x) => x.c) : [];
  }
  if (d.skipNoAddress) rows = rows.filter((c) => String(c.address || '').trim() && mailingName(c));
  idx = Math.min(idx, Math.max(0, rows.length - 1));
}

function fill(template, c) {
  if (!c) return template.replace(/\{(\w+)\}/g, (m, k) => `[${k}]`);
  const country = c.country && !/^(usa|us|united states)$/i.test(c.country) ? c.country : '';
  const wifeTitle = isTrue(c.wife_is_rebbetzin) ? 'Rebbetzin' : 'Mrs.';
  const wifeLine = [wifeTitle, c.wife_name_en, c.last_name_en].filter(Boolean).join(' ');
  const v = {
    // "צו דער ווייב": Mrs. / Rebbetzin + איר נאמען (פאר נשי אונגוואר)
    mailing: d.toWife && String(c.last_name_en || '').trim() ? wifeLine : (mailingName(c) || ''),
    wife: wifeLine, first: c.first_name_en || '', last: c.last_name_en || '',
    address: c.address || '', city: c.city || '', state: c.state || '', zip: c.zip || '', country,
    legal: [c.legal_first_name || c.first_name_en, c.last_name_en].filter(Boolean).join(' '),
    hebrew: ui.fullNameHe(c),
  };
  return template.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? '')
    .split('\n').map((line) => line.replace(/^[\s,]+|[\s,]+$/g, '')).filter((line) => line.trim()).join('\n');
}

function shrinkImage(file, maxPx) {
  return shrink(file, maxPx).catch((err) => { throw new Error(t(err.message === 'too-big' ? 'mmImageTooBig' : 'mmImageBad')); });
}

/** לאגא: 'crown' / 'neshei' / 'custom' / 'org:<נאמען>' (דער לאגא פון א ארגון פון אדמין). */
function resolveLogo(key, custom) {
  if (key === 'custom') return custom;
  if (String(key).startsWith('org:')) return orgLogo(key.slice(4));
  if (key === 'neshei') return orgLogo(NESHEI_ORG);
  return BUILTIN_LOGOS.find(([k]) => k === key)?.[1] || '';
}

function orgLogoOptions(selected) {
  return Object.keys(state.orgLogos || {}).filter((o) => o !== NESHEI_ORG).map((o) => `<option value="org:${h(o)}"${selected === `org:${o}` ? ' selected' : ''}>${h(o)}</option>`).join('');
}

function logoSrc() {
  return resolveLogo(d.ret.logo, d.logo_data);
}

function isLabel() {
  return d.format.startsWith('av');
}

// ---------- קאנווערט (HTML; גרייסן אין אינטשעס) ----------
function envelopeHtml(c, forPrint = false) {
  const env = ENVELOPES.find(([k]) => k === d.format) || ENVELOPES[0];
  const [, , W, H] = env;
  const r = d.ret;
  const p = d.rcp;
  const lines = (txt) => h(txt).replace(/\n/g, '<br>');
  const rcpText = fill(p.template, c);
  return `<div class="env${forPrint ? ' env-print' : ''}" style="width:${W}in;height:${forPrint ? H - 0.02 : H}in">
    ${d.background_data ? `<img class="env-bg" src="${d.background_data}" style="opacity:${d.bg.opacity}" alt="">` : ''}
    ${r.show ? `<div class="env-part env-ret" data-part="ret" style="left:${r.x}in;top:${r.y}in;font-family:'${r.font}';font-size:${r.size}pt">
      ${logoSrc() ? `<img src="${logoSrc()}" style="height:${r.logoH}in" alt="">` : ''}
      <div>${lines(r.text)}</div></div>` : ''}
    <div class="env-part env-rcp" data-part="rcp" style="left:${p.x}in;top:${p.y}in;font-family:'${p.font}';font-size:${p.size}pt;text-align:${p.align}">
      ${rcpText.split('\n').map((line, i) => `<div${i === 0 && p.bold ? ' style="font-weight:700"' : ''}>${h(line)}</div>`).join('')}</div>
    ${postageHtml()}
  </div>`;
}

function postageHtml() {
  const p = d.post;
  if (p.mode === 'stamp') return `<div class="env-stamp${p.border ? '' : ' no-border'}" title="Stamp"></div>`;
  if (p.mode === 'image' && d.postage_data) return `<div class="env-stamp no-border"><img src="${d.postage_data}" alt=""></div>`;
  if (p.mode === 'text') return `<div class="env-stamp env-indicia${p.border ? '' : ' no-border'}" style="font-size:${p.size}pt">${h(p.text).replace(/\n/g, '<br>')}</div>`;
  return '';
}

// ---------- לעיבלס ----------
/**
 * לעיבלס: mode 'list' = יעדער לעיבל א נמען פון דער רשימה;
 * 'same' = דער גאנצער בויגן מיט איין טעקסט (למשל צוריק-אדרעס לעיבלס).
 * די פאָרויסזיכט ווייזט אלע לעיבלס פונעם בויגן — אויך די ליידיגע.
 */
function labelSheetHtml(list, forPrint = false) {
  const L = LABELS.find(([k]) => k === d.format) || LABELS[0];
  const [, , cols, rws, w, hgt, top, left, hgap, vgap] = L;
  const per = cols * rws;
  const skip = Math.max(0, Math.min(per - 1, Number(d.lbl.skip) || 0));
  let items;
  if (d.lbl.mode === 'same') {
    const sheets = Math.max(1, Number(d.lbl.sheets) || 1);
    items = [...Array(skip).fill('skip'), ...Array(per * sheets - skip).fill('same')];
  } else {
    items = [...Array(skip).fill('skip'), ...list];
  }
  const pages = [];
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
  if (!pages.length) pages.push([]);
  if (!forPrint) pages.splice(1);
  const logo = resolveLogo(d.lbl.logo, d.logo_data);
  const cell = (c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const pos = `left:${left + col * (w + hgap)}in;top:${top + row * (hgt + vgap)}in;width:${w}in;height:${hgt}in`;
    if (c === 'skip') return `<div class="lbl lbl-used" style="${pos}"></div>`;
    if (c === undefined) return forPrint ? '' : `<div class="lbl lbl-empty" style="${pos}"></div>`;
    const txt = c === 'same' ? d.lbl.text : fill(d.rcp.template, c);
    return `<div class="lbl${logo && c === 'same' ? ' lbl-logo' : ''}" style="${pos};padding:${d.lbl.pad}in;font-family:'${d.rcp.font}';font-size:${d.lbl.size}pt;text-align:${d.lbl.align}">
      ${logo && c === 'same' ? `<img src="${logo}" alt="">` : ''}<div>${txt.split('\n').map((line, j) => `<div${j === 0 && d.rcp.bold ? ' style="font-weight:700"' : ''}>${h(line)}</div>`).join('')}</div></div>`;
  };
  return pages.map((page) => `<div class="lbl-sheet${forPrint ? ' env-print' : ''}"${forPrint ? ' style="height:10.98in"' : ''}>
    ${Array.from({ length: per }, (_, i) => cell(page[i], i)).join('')}
  </div>`).join('');
}

// ---------- דער עורך ----------
export function renderMailMerge() {
  const main = $('#mailmerge-main');
  if (!main) return;
  loadRows();
  const fmtOpts = `<optgroup label="${h(t('mmEnvelopes'))}">${ENVELOPES.map(([k, n]) => `<option value="${k}"${k === d.format ? ' selected' : ''}>${h(n)}</option>`).join('')}</optgroup>
    <optgroup label="${h(t('mmLabels'))}">${LABELS.map(([k, n]) => `<option value="${k}"${k === d.format ? ' selected' : ''}>${h(n)}</option>`).join('')}</optgroup>`;
  const lists = listOptions().map(([g, opts]) => (opts.length ? `<optgroup label="${h(g)}">${opts.map(([v, n]) => `<option value="${h(v)}"${v === d.list ? ' selected' : ''}>${h(n)}</option>`).join('')}</optgroup>` : '')).join('');
  const fontSel = (name, val) => `<select data-k="${name}">${[...customFontNames(), ...FONTS].map((f) => `<option${f === val ? ' selected' : ''}>${f}</option>`).join('')}</select>`;
  const lbl = isLabel();
  main.innerHTML = `
    <div class="camp-page-head">
      <div><h2>Mail Merge</h2><p class="muted">${t('mmHint')}</p></div>
      <span class="spacer"></span>
      <select id="mm-template"><option value="">${h(t('mmNewDesign'))}</option>${state.mailTemplates.map((x) => `<option value="${h(x.template_id)}"${String(x.template_id) === String(d.template_id) ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select>
      <input id="mm-name" placeholder="${h(t('mmDesignName'))}" value="${h(d.name)}">
      <button type="button" class="btn" id="mm-save">${t('saveBtn')}</button>
      ${d.template_id ? `<button type="button" class="btn danger" id="mm-del">${t('deleteBtn')}</button>` : ''}
    </div>
    <div class="mm-layout">
      <aside class="mm-panel">
        <details open><summary>${t('mmFormat')}</summary>
          <select data-k="format">${fmtOpts}</select>
        </details>
        <details open><summary>${t('mmRecipients')}</summary>
          <select data-k="list">${lists}</select>
          <label class="check"><input type="checkbox" data-k="skipNoAddress" ${d.skipNoAddress ? 'checked' : ''}> ${t('mmSkipNoAddress')}</label>
          <label class="check"><input type="checkbox" data-k="toWife" ${d.toWife ? 'checked' : ''}> ${t('mmToWife')}</label>
          <p class="muted small">${h(t('mmCount', { n: rows.length }))}</p>
          <label class="mm-l">${t('mmRcpTemplate')}<textarea data-k="rcp.template" rows="5" dir="ltr">${h(d.rcp.template)}</textarea></label>
          <div class="mm-tokens">${TOKENS.map((k) => `<button type="button" class="chip mini" data-token="${k}">{${k}}</button>`).join('')}</div>
          <div class="mm-grid">
            <label>${t('mmFont')}${fontSel('rcp.font', d.rcp.font)}</label>
            <label>${t('mmSize')}<input type="number" data-k="rcp.size" min="6" max="30" value="${d.rcp.size}"></label>
            <label>${t('mmAlign')}<select data-k="rcp.align"><option value="left"${d.rcp.align === 'left' ? ' selected' : ''}>Left</option><option value="center"${d.rcp.align === 'center' ? ' selected' : ''}>Center</option></select></label>
            <label class="check"><input type="checkbox" data-k="rcp.bold" ${d.rcp.bold ? 'checked' : ''}> ${t('mmBoldFirst')}</label>
          </div>
        </details>
        ${lbl ? `<details open><summary>${t('mmLabelText')}</summary>
          <div class="mm-grid">
            <label>${t('mmSize')}<input type="number" data-k="lbl.size" min="5" max="20" value="${d.lbl.size}"></label>
            <label>${t('mmAlign')}<select data-k="lbl.align"><option value="left"${d.lbl.align === 'left' ? ' selected' : ''}>Left</option><option value="center"${d.lbl.align === 'center' ? ' selected' : ''}>Center</option></select></label>
          </div>
          <label class="mm-l">${t('mmLabelMode')}<select data-k="lbl.mode">
            <option value="list"${d.lbl.mode !== 'same' ? ' selected' : ''}>${t('mmModeList')}</option>
            <option value="same"${d.lbl.mode === 'same' ? ' selected' : ''}>${t('mmModeSame')}</option></select></label>
          ${d.lbl.mode === 'same' ? `<label class="mm-l">${t('mmSameText')}<textarea data-k="lbl.text" rows="4" dir="ltr">${h(d.lbl.text)}</textarea></label>
            <label class="mm-l">${t('mmLogo')}<select data-k="lbl.logo">
              <option value=""${!d.lbl.logo ? ' selected' : ''}>${t('mmNone')}</option>
              <option value="crown"${d.lbl.logo === 'crown' ? ' selected' : ''}>${h(umbrellaName())}</option>
              <option value="neshei"${d.lbl.logo === 'neshei' ? ' selected' : ''}>${t('nesheiFull')}</option>
              ${orgLogoOptions(d.lbl.logo)}
              <option value="custom"${d.lbl.logo === 'custom' ? ' selected' : ''}>${t('mmCustomImage')}</option></select></label>
            ${d.lbl.logo === 'custom' ? '<input type="file" accept="image/*" data-upload="logo_data">' : ''}
            <label class="mm-l">${t('mmSheets')}<input type="number" data-k="lbl.sheets" min="1" max="50" value="${d.lbl.sheets || 1}"></label>` : ''}
          <label class="mm-l">${t('mmSkipLabels')}<input type="number" data-k="lbl.skip" min="0" max="79" value="${d.lbl.skip || 0}"></label>
          </details>` : `
        <details open><summary>${t('mmReturn')}</summary>
          <label class="check"><input type="checkbox" data-k="ret.show" ${d.ret.show ? 'checked' : ''}> ${t('mmShowReturn')}</label>
          <label class="mm-l">${t('mmLogo')}<select data-k="ret.logo">
            <option value=""${!d.ret.logo ? ' selected' : ''}>${t('mmNone')}</option>
            <option value="crown"${d.ret.logo === 'crown' ? ' selected' : ''}>${h(umbrellaName())}</option>
            <option value="neshei"${d.ret.logo === 'neshei' ? ' selected' : ''}>${t('nesheiFull')}</option>
            ${orgLogoOptions(d.ret.logo)}
            <option value="custom"${d.ret.logo === 'custom' ? ' selected' : ''}>${t('mmCustomImage')}</option></select></label>
          <input type="file" accept="image/*" data-upload="logo_data" ${d.ret.logo === 'custom' ? '' : 'hidden'}>
          <label class="mm-l">${t('mmLogoSize')}<input type="range" data-k="ret.logoH" min="0.2" max="1.5" step="0.05" value="${d.ret.logoH}"></label>
          <label class="mm-l">${t('mmReturnText')}<textarea data-k="ret.text" rows="4" dir="ltr">${h(d.ret.text)}</textarea></label>
          <div class="mm-grid">
            <label>${t('mmFont')}${fontSel('ret.font', d.ret.font)}</label>
            <label>${t('mmSize')}<input type="number" data-k="ret.size" min="5" max="20" value="${d.ret.size}"></label>
          </div>
        </details>
        <details open><summary>${t('mmPostage')}</summary>
          <select data-k="post.mode">
            <option value="stamp"${d.post.mode === 'stamp' ? ' selected' : ''}>${t('mmStamp')}</option>
            <option value="text"${d.post.mode === 'text' ? ' selected' : ''}>${t('mmIndicia')}</option>
            <option value="image"${d.post.mode === 'image' ? ' selected' : ''}>${t('mmPostageImage')}</option>
            <option value="none"${d.post.mode === 'none' ? ' selected' : ''}>${t('mmNone')}</option></select>
          ${d.post.mode === 'text' ? `<textarea data-k="post.text" rows="4" dir="ltr">${h(d.post.text)}</textarea>
            <label>${t('mmSize')}<input type="number" data-k="post.size" min="5" max="14" value="${d.post.size}"></label>` : ''}
          ${d.post.mode === 'image' ? '<input type="file" accept="image/*" data-upload="postage_data">' : ''}
          <label class="check"><input type="checkbox" data-k="post.border" ${d.post.border ? 'checked' : ''}> ${t('mmBorder')}</label>
        </details>
        <details><summary>${t('mmBackground')}</summary>
          <input type="file" accept="image/*" data-upload="background_data">
          ${d.background_data ? `<button type="button" class="btn small-btn" id="mm-bg-clear">${t('mmRemoveBg')}</button>` : ''}
          <label class="mm-l">${t('mmOpacity')}<input type="range" data-k="bg.opacity" min="0.03" max="1" step="0.01" value="${d.bg.opacity}"></label>
        </details>`}
      </aside>
      <section class="mm-stage">
        <div class="mm-nav">
          <button type="button" class="btn small-btn" id="mm-prev">‹</button>
          <span>${rows.length ? h(t('mmRecordOf', { i: idx + 1, n: rows.length })) : h(t('mmNoRecords'))}</span>
          <button type="button" class="btn small-btn" id="mm-next">›</button>
          <span class="spacer"></span>
          ${lbl ? '' : `<span class="muted small">${t('mmDragHint')}</span>`}
          <button type="button" class="btn primary" id="mm-print">${t('mmPrintAll', { n: lbl && d.lbl.mode === 'same' ? `${d.lbl.sheets || 1} × ${(LABELS.find(([k]) => k === d.format) || LABELS[0])[2] * (LABELS.find(([k]) => k === d.format) || LABELS[0])[3]}` : rows.length })}</button>
        </div>
        <div class="mm-canvas" id="mm-canvas" dir="ltr">${lbl ? labelSheetHtml(rows) : envelopeHtml(rows[idx])}</div>
      </section>
    </div>
    <div id="mm-print-area" dir="ltr"></div>`;
  fitPreview();
  wire(main);
}

/** די פאָרויסזיכט פאסט זיך צו צו דער ברייט פונעם עקראן. */
function fitPreview() {
  const canvas = $('#mm-canvas');
  const inner = canvas.firstElementChild;
  if (!inner) return;
  const avail = canvas.clientWidth - 20;
  const w = inner.offsetWidth;
  const scale = Math.min(1.4, avail / w);
  inner.style.transform = `scale(${scale})`;
  inner.style.transformOrigin = 'top left';
  canvas.style.height = `${inner.offsetHeight * scale + 20}px`;
  canvas.dataset.scale = scale;
}

function setPath(path, value) {
  const keys = path.split('.');
  let o = d;
  keys.slice(0, -1).forEach((k) => { o = o[k]; });
  o[keys.at(-1)] = value;
}

function wire(main) {
  const rerender = () => renderMailMerge();
  const refreshPreview = () => {
    $('#mm-canvas').innerHTML = isLabel() ? labelSheetHtml(rows) : envelopeHtml(rows[idx]);
    fitPreview();
    wireDrag();
  };
  $$('[data-k]', main).forEach((el) => {
    const apply = () => {
      const val = el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range') ? Number(el.value) : el.value;
      setPath(el.dataset.k, val);
      if (el.dataset.k === 'format' && !isLabel()) {
        // נייע גרייס: דער נמען אין דער מיט, די צוריק-אדרעס אין ווינקל
        const env = ENVELOPES.find(([k]) => k === d.format);
        d.rcp.x = Math.round(env[2] * 0.4 * 100) / 100;
        d.rcp.y = Math.round(env[3] * 0.46 * 100) / 100;
        d.ret.x = 0.25;
        d.ret.y = 0.22;
      }
      // וואס טוישט דעם פאנעל — גאנץ פון ניי; אנדערש — נאר די פאָרויסזיכט
      if (['format', 'list', 'skipNoAddress', 'toWife', 'post.mode', 'ret.logo', 'lbl.mode', 'lbl.logo', 'lbl.sheets'].includes(el.dataset.k)) rerender();
      else refreshPreview();
    };
    el.addEventListener(el.tagName === 'TEXTAREA' || el.type === 'range' || el.type === 'number' ? 'input' : 'change', apply);
  });
  $$('[data-token]', main).forEach((b) => {
    b.onclick = () => {
      const ta = $('[data-k="rcp.template"]', main);
      const pos = ta.selectionStart ?? ta.value.length;
      ta.value = `${ta.value.slice(0, pos)}{${b.dataset.token}}${ta.value.slice(pos)}`;
      ta.dispatchEvent(new Event('input'));
      ta.focus();
    };
  });
  $$('[data-upload]', main).forEach((inp) => {
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        d[inp.dataset.upload] = await shrinkImage(file, inp.dataset.upload === 'background_data' ? 900 : 500);
        rerender();
      } catch (err) { ui.toast(err.message, 'error'); }
    };
  });
  $('#mm-bg-clear', main)?.addEventListener('click', () => { d.background_data = ''; rerender(); });
  $('#mm-prev', main).onclick = () => { idx = Math.max(0, idx - 1); rerender(); };
  $('#mm-next', main).onclick = () => { idx = Math.min(rows.length - 1, idx + 1); rerender(); };
  $('#mm-print', main).onclick = printAll;
  $('#mm-template', main).onchange = (e) => loadTemplate(e.target.value);
  $('#mm-save', main).onclick = saveTemplate;
  $('#mm-del', main)?.addEventListener('click', async () => {
    if (!confirm(t('mmConfirmDelete', { name: d.name }))) return;
    try {
      await deleteRecord('MailTemplates', 'template_id', state.mailTemplates.find((x) => String(x.template_id) === String(d.template_id)));
      await loadAll();
      d = defaults();
      rerender();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
  wireDrag();
}

/** שלעפן דעם צוריק-אדרעס און דעם נמען מיטן מויז. */
function wireDrag() {
  const canvas = $('#mm-canvas');
  $$('.env-part', canvas).forEach((el) => {
    el.onpointerdown = (e) => {
      e.preventDefault();
      const part = d[el.dataset.part];
      const scale = Number(canvas.dataset.scale || 1);
      const ppi = 96 * scale; // פיקסלען פער אינטש אויפן עקראן
      const start = { x: e.clientX, y: e.clientY, px: part.x, py: part.y };
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      el.onpointermove = (ev) => {
        part.x = Math.max(0, Math.round((start.px + (ev.clientX - start.x) / ppi) * 100) / 100);
        part.y = Math.max(0, Math.round((start.py + (ev.clientY - start.y) / ppi) * 100) / 100);
        el.style.left = `${part.x}in`;
        el.style.top = `${part.y}in`;
      };
      el.onpointerup = () => { el.onpointermove = null; el.classList.remove('dragging'); };
    };
  });
}

function printAll() {
  if (!rows.length && !(isLabel() && d.lbl.mode === 'same')) { ui.toast(t('mmNoRecords'), 'error'); return; }
  const area = $('#mm-print-area');
  let size;
  if (isLabel()) {
    area.innerHTML = labelSheetHtml(rows, true);
    size = '8.5in 11in';
  } else {
    const env = ENVELOPES.find(([k]) => k === d.format) || ENVELOPES[0];
    area.innerHTML = rows.map((c) => envelopeHtml(c, true)).join('');
    size = `${env[2]}in ${env[3]}in`;
  }
  let st = $('#mm-page-style');
  if (!st) { st = document.createElement('style'); st.id = 'mm-page-style'; document.head.append(st); }
  st.textContent = `@page { size: ${size}; margin: 0; }`;
  document.body.classList.add('printing-mm');
  const done = () => { document.body.classList.remove('printing-mm'); area.innerHTML = ''; st.textContent = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // די בילדער מוזן זיך אויסלאדן פארן דרוקן
  Promise.all($$('img', area).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))))
    .then(() => window.print());
}

function loadTemplate(id) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(id));
  if (!x) { d = defaults(); renderMailMerge(); return; }
  let settings = {};
  try { settings = JSON.parse(x.settings || '{}'); } catch { /* ריק */ }
  const base = defaults();
  d = {
    ...base, ...settings,
    ret: { ...base.ret, ...settings.ret }, rcp: { ...base.rcp, ...settings.rcp }, post: { ...base.post, ...settings.post },
    bg: { ...base.bg, ...settings.bg }, lbl: { ...base.lbl, ...settings.lbl },
    template_id: x.template_id, name: x.name, format: x.format || base.format,
    logo_data: x.logo_data || '', background_data: x.background_data || '', postage_data: x.postage_data || '',
  };
  idx = 0;
  renderMailMerge();
}

async function saveTemplate() {
  const name = $('#mm-name').value.trim();
  if (!name) { ui.toast(t('mmNameRequired'), 'error'); $('#mm-name').focus(); return; }
  const {
    template_id: tid, name: _n, format, logo_data: ld, background_data: bd, postage_data: pd, ...settings
  } = d;
  try {
    const id = await saveRecord('MailTemplates', 'template_id', {
      ...(state.mailTemplates.find((x) => String(x.template_id) === String(tid)) || {}),
      template_id: tid || '', name, format, settings: JSON.stringify(settings), logo_data: ld, background_data: bd, postage_data: pd,
    });
    await loadAll();
    d.template_id = id;
    d.name = name;
    ui.toast(t('mmSaved', { name }));
    renderMailMerge();
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}
