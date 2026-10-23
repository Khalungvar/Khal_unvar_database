// Mail Merge (נייע): דריי זאכן — ✉ קאנווערטן, 🏷 לעיבלס, 📄 בריוו.
// א הויפט-בלאט מיט דריי קאלומען (יעדע מיט אירע געשפייכלערטע עיצובים), און א עדיטאר פאר יעדן סארט.
// די נמענים: א רשימה / איין מענטש / אריינקלעבן. א פראבלעמען-שטרייף, פאָרויסזיכט, דרוקן / PDF, און אליין-שפייכלערן.
import { customFontNames } from './fonts.js';
import { state, saveRecord, deleteRecord, allUsers, orgDetailsOf } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, shrinkImage, nowStamp, detectArea } from './util.js';
import { isoToHebrewText, todayIso } from './hebdate.js';
import { openReceipts } from './receipts.js';
import { evaluate, parseSaved, savedInScope, channel, mailRecipients } from './lists.js';
import { umbrellaName, getScope } from './scope.js';
import { allCampaigns } from './campaigns.js';
import { htmlToJpeg, jpegsToPdf } from './pdf.js';
import { emailOf, emailLayout, sendJobs } from './mail.js';
import { ensureGmailScope } from './google.js';
import { helperOn, storeImage, fetchImages, imageOf, isDrv, listImages } from './images.js';
import {
  ENVELOPES, FONTS_EN, FONTS_HE, allSheets, sheetOf, setCustomSheets, envSize, pageSize, envHtml, labelPages, letterHtml,
  labelsPerSheet, letterPages, expandRepeats, gregHe, longDateEn, letterGeo, sigHtml, bodyStyle, PGBRK, isPgBrk, TOKEN_RE, PAGE_SIZES, letterDims, resolveImgs,
  DON_TOKENS, DON_TOKENS_EN, TOTAL_TOKENS, TOTAL_TOKENS_EN, valuesFor, fillText, fillHtml, cleanHtml, donationCtx, hasAddr, partAddr, addrKey, isDeceased,
} from './mm-render.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const KINDS = [['env', '✉', 'mxEnvelopes'], ['lbl', '🏷', 'mxLabels'], ['ltr', '📄', 'mxLetters']];
const SHEETS_NAME = '__label_sheets__';
const TOKENS_HE = ['פנייה', 'תואר', 'שם_מלא', 'שם', 'שם_פרטי', 'משפחה', 'אשה', 'תאריך', 'תאריך_לועזי', 'סכום', 'שולם', 'נשאר', 'תאריך_נדבה', 'הקדשה', 'קאמפיין'];
const TOKENS_EN = ['Name', 'First', 'Last', 'Wife', 'Address', 'City', 'Country', 'Date', 'DonationDate'];
const SEV = { red: 3, yellow: 2, info: 1 };

let view = 'home';
let D = null;          // דער עיצוב וואס מ'רעדאגירט
let rows = [];         // די נמענים (פאר דער ליסטע)
let info = { excluded: [], nosend: [] };
let probs = new Map(); // type → { sev, items: [{ c, note }] }
let byRow = new Map(); // key → [types]
let idx = 0;
let onlyType = '';     // ווייזן נאר די מיט א פראבלעם (פון דעם סארט; '*' = אלע)
let skipIds = new Set();
let saveTimer = null;
let saveState = '';
let pending = null;    // { ids: [...], label } — פון די קבלות
let pendingList = '';  // 'saved:<id>' — פון א רשימה
let selBox = '';
let measureRun = 0;

const keyOf = (c) => String(c?.contact_id || c?._key || '');
const nz = (v) => String(v ?? '').trim();

export function initMailMerge(helpers) {
  ui = helpers;
}

export function openMailMerge() {
  view = 'home';
  D = null;
  document.body.classList.add('solo-mode');
  ui.showView('mailmerge');
}

/** פון א רשימה: דער הויפט-בלאט, די רשימה איז אויסגעקליבן פאר יעדן עיצוב וואס מ'עפנט */
export function openMailMergeWith(listKey) {
  pendingList = listKey;
  pending = null;
  openMailMerge();
}

/** פון די קבלות: די זעלבע מענטשן אין דער זעלבער ריי */
export function openMailMergeFor(ids, label = '') {
  pending = { ids: ids.map(String), label };
  pendingList = '';
  openMailMerge();
}

export function renderMailMerge() {
  const main = $('#mailmerge-main');
  if (!main) return;
  loadSheetsLib();
  if (view === 'edit' && D) renderEditor(main);
  else renderHome(main);
}

// ---------- די עיצובים (לשונית MailTemplates) ----------
function settingsOf(x) { try { return JSON.parse(x?.settings || '{}'); } catch { return {}; } }
function kindOf(x) {
  const s = settingsOf(x);
  if (s.kind) return s.kind;
  return String(x.format || '').startsWith('av') ? 'lbl' : 'env';
}
const metaOf = (x) => settingsOf(x).meta || {};
const mine = (x) => String(x?.created_by || '').toLowerCase() === state.email;
function canSeeT(x) {
  if (state.isAdmin || mine(x)) return true;
  const m = metaOf(x);
  return m.visibility !== 'private' || (m.editors || []).includes(state.email);
}
function canEditT(x) {
  if (!x || state.isAdmin || mine(x)) return true;
  return (metaOf(x).editors || []).includes(state.email) || metaOf(x).allEdit === true;
}
const canDeleteT = (x) => state.isAdmin || mine(x);
const scopeOrg = () => { const sc = getScope(); return sc?.value || ''; };
function templatesOf(kind) {
  const org = scopeOrg();
  return state.mailTemplates.filter((x) => String(x.template_id || '').trim() && x.format !== 'sheets' && x.name !== SHEETS_NAME)
    .filter((x) => kindOf(x) === kind && canSeeT(x))
    .filter((x) => !org || !metaOf(x).org || metaOf(x).org === org)
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
}
const current = () => (D?.template_id ? state.mailTemplates.find((x) => String(x.template_id) === String(D.template_id)) : null);

// די ביבליאטעק פון לעיבל-בויגנס (פאר אלע)
function sheetsRow() { return state.mailTemplates.find((x) => x.name === SHEETS_NAME || x.format === 'sheets'); }
function loadSheetsLib() { setCustomSheets(settingsOf(sheetsRow()).sheets || []); }
async function saveSheetsLib(sheets) {
  const row = sheetsRow();
  const rec = { ...(row || {}), template_id: row?.template_id || '', name: SHEETS_NAME, format: 'sheets', settings: JSON.stringify({ sheets }) };
  const id = await saveRecord('MailTemplates', 'template_id', rec);
  if (row) Object.assign(row, rec);
  else state.mailTemplates.push({ ...rec, template_id: id, created_by: state.email, created_at: nowStamp() });
  setCustomSheets(sheets);
}

const DEFAULT_LETTER = '<p>{תאריך}</p><p><b>{פנייה} {שם_מלא} הי"ו</b></p><p>…</p><p>בכבוד ובברכה,</p>';
function defaults(kind) {
  const org = scopeOrg();
  return {
    template_id: '', name: '', kind, format: kind === 'env' ? 'env10' : kind === 'lbl' ? 'av5160' : 'letter',
    meta: { visibility: 'public', editors: [], org },
    src: { type: 'list', list: '', contact: '', paste: '', mailMode: '', toWife: false, email: false },
    sort: 'list', lang: 'en',
    size: { w: 9.5, h: 4.125 },
    ret: { show: true, logo: 'crown', logoH: 0.55, text: 'Khal Ungvar\n1578 53rd St\nBrooklyn, NY 11219', font: 'Georgia', size: 9, x: 0.25, y: 0.22, dir: 'ltr' },
    rcp: { template: '{Name}\n{Address}\n{City}\n{Country}', templateHe: '{שם_מלא} הי"ו', font: 'Georgia', fontHe: 'Frank Ruhl Libre', size: 12, sizeHe: 13, bold: true, align: kind === 'lbl' ? 'center' : 'left', x: 3.8, y: 1.9 },
    post: { mode: 'stamp', text: 'PRSRT STD\nU.S. POSTAGE\nPAID\nPERMIT #000', size: 7, border: true },
    bg: { opacity: kind === 'ltr' ? 1 : 0.12 },
    boxes: [],
    lbl: { sheet: 'av5160', size: 10, align: 'center', pad: 0.08, skip: 0, mode: 'list', text: 'Khal Ungvar\n1578 53rd St\nBrooklyn, NY 11219', logo: '', logoPos: 'left', logoAll: false, sheets: 1, nudgeX: 0, nudgeY: 0, dir: 'ltr', font: 'Georgia' },
    ltr: {
      lang: 'yi', dir: 'rtl', design: 'org', org: org || umbrellaName(), html: DEFAULT_LETTER, font: 'Frank Ruhl Libre', size: 13, lineH: 1.6,
      salutation: 'לכבוד', margins: { top: 0.6, side: 0.8, bottom: 0.6 }, bannerH: 1.6, window: false, win: { x: 0.875, y: 2.25, w: 4, h: 1 },
      winLang: 'en', sig: true, pairEnv: '', subject: '',
    },
    link: { name: '', series: '' },
    logo_data: '', background_data: '', postage_data: '',
  };
}
function fromRow(x) {
  const s = settingsOf(x);
  const kind = kindOf(x);
  const base = defaults(kind);
  const o = {
    ...base, ...s, kind,
    meta: { ...base.meta, ...s.meta },
    src: { ...base.src, ...s.src },
    size: { ...base.size, ...s.size },
    ret: { ...base.ret, ...s.ret }, rcp: { ...base.rcp, ...s.rcp }, post: { ...base.post, ...s.post }, bg: { ...base.bg, ...s.bg },
    lbl: { ...base.lbl, ...s.lbl }, ltr: { ...base.ltr, ...s.ltr, margins: { ...base.ltr.margins, ...s.ltr?.margins }, win: { ...base.ltr.win, ...s.ltr?.win } },
    link: { ...base.link, ...s.link },
    boxes: Array.isArray(s.boxes) ? s.boxes : [],
    template_id: x.template_id, name: x.name, format: x.format || base.format,
    logo_data: x.logo_data || '', background_data: x.background_data || '', postage_data: x.postage_data || '',
  };
  // דער אלטער מייל מירדזש: די רשימה / "צו דער ווייב" / די לעיבלס
  if (!s._v) {
    if (s.list) o.src.list = s.list;
    if (s.toWife) o.src.toWife = true;
    if (kind === 'lbl') o.lbl.sheet = x.format || 'av5160';
  }
  return o;
}

// ---------- שפייכלערן (אליין) ----------
function scheduleSave(ms = 1800) {
  if (!D || !canEditT(current())) return;
  clearTimeout(saveTimer);
  // א נייער עיצוב ווערט אפגעהיט נאר ווען ער האט א נאמען
  if (!nz(D.name)) { saveState = 'unnamed'; showSaveState(); return; }
  saveState = 'dirty';
  showSaveState();
  saveTimer = setTimeout(() => { persist().catch((err) => { saveState = 'error'; showSaveState(); ui.toast(ui.friendlyError(err), 'error'); }); }, ms);
}
let saving = null;   // דער שפייכלער וואס לויפט יעצט
let again = false;   // נאך א טויש בשעת'ן שפייכלערן
async function persist() {
  if (!D || !nz(D.name)) return;
  clearTimeout(saveTimer);
  if (saving) { again = true; return saving; }
  saving = persistNow().finally(() => { saving = null; });
  await saving;
  if (again) { again = false; await persist(); }
}
async function persistNow() {
  const target = D; // נישט דער גלאבאלער D — "שמור בשם" קען אים טוישן אינצווישן
  saveState = 'saving';
  showSaveState();
  const {
    template_id: tid, name, format, logo_data: ld, background_data: bd, postage_data: pd, _ids, ...rest
  } = target;
  const settings = JSON.stringify({ ...rest, _v: 2 });
  const fmt = target.kind === 'lbl' ? target.lbl.sheet : target.kind === 'ltr' ? 'letter' : format;
  const prev = tid ? state.mailTemplates.find((x) => String(x.template_id) === String(tid)) : null;
  const rec = { ...(prev || {}), template_id: tid || '', name: nz(name) || t('mxUntitled'), format: fmt, settings, logo_data: ld, background_data: bd, postage_data: pd };
  const id = await saveRecord('MailTemplates', 'template_id', rec);
  const stamp = nowStamp();
  if (prev) Object.assign(prev, rec, { updated_at: stamp, updated_by: state.email });
  else state.mailTemplates.push({ ...rec, template_id: id, created_at: stamp, created_by: state.email, updated_at: stamp, updated_by: state.email });
  target.template_id = id;
  if (target !== D) return;
  saveState = 'saved';
  showSaveState();
}
function showSaveState() {
  const el = $('#mx-save-state');
  if (!el) return;
  el.textContent = { dirty: '…', saving: t('mxSaving'), saved: `✓ ${t('mxSavedAuto')}`, error: `⚠ ${t('mxSaveFail')}`, ro: t('mxReadOnly'), unnamed: `⚠ ${t('mxNeedName')}` }[saveState] || '';
  el.className = `mx-save ${saveState}`;
}

// ---------- דער הויפט-בלאט ----------
function renderHome(main) {
  const who = (x) => { const e = String(x.created_by || ''); return e.split('@')[0]; };
  const card = (x) => {
    const m = metaOf(x);
    return `<div class="mx-card" data-id="${h(x.template_id)}">
      <div class="mx-card-name">${h(x.name || t('mxUntitled'))}</div>
      <div class="muted small">${h(who(x))} · ${h(String(x.updated_at || x.created_at || '').slice(0, 10))}${m.org ? ` · <span class="chip mini">${h(m.org)}</span>` : ''}</div>
      <div class="mx-card-act">
        <button type="button" class="btn small-btn primary" data-open="${h(x.template_id)}">${h(t('mxOpen'))}</button>
        <button type="button" class="btn small-btn" data-dup="${h(x.template_id)}">${h(t('mxDuplicate'))}</button>
        ${canDeleteT(x) ? `<button type="button" class="btn small-btn danger" data-del="${h(x.template_id)}">${h(t('deleteBtn'))}</button>` : ''}
      </div></div>`;
  };
  main.innerHTML = `
    <div class="camp-page-head"><div><h2>Mail Merge</h2><p class="muted">${h(t('mxHomeHint'))}</p></div></div>
    ${pending ? `<div class="mx-pending">📬 ${h(t('mxPendingIds', { n: pending.ids.length }))}${pending.label ? ` — ${h(pending.label)}` : ''}
      <button type="button" class="linkish" id="mx-pending-x">${h(t('mxPendingCancel'))}</button></div>` : ''}
    ${pendingList ? `<div class="mx-pending">📋 ${h(t('mxPendingList', { name: listName(pendingList.split(':')[1]) }))}
      <button type="button" class="linkish" id="mx-pending-x">${h(t('mxPendingCancel'))}</button></div>` : ''}
    <div class="mx-cols">${KINDS.map(([k, ico, lbl]) => `<section class="mx-col">
      <h3>${ico} ${h(t(lbl))}</h3>
      <div class="mx-new-row"><button type="button" class="btn primary mx-new" data-new="${k}">+ ${h(t('mxNew'))}</button>
      ${k !== 'ltr' ? `<button type="button" class="btn mx-new" data-match="${k}">📄 ${h(t(k === 'env' ? 'mxMatchEnv' : 'mxMatchLbl'))}</button>` : ''}</div>
    </section>`).join('')}</div>
    ${[['public', '🌐', 'mxPublicSaved'], ['private', '🔒', 'mxPrivateSaved']].map(([vis, ico, title]) => `<section class="mx-saved">
      <h3>${ico} ${h(t(title))}</h3>
      <div class="mx-cols">${KINDS.map(([k, kico, lbl]) => {
        const list = templatesOf(k).filter((x) => (metaOf(x).visibility === 'private') === (vis === 'private'));
        return `<div class="mx-col"><h4>${kico} ${h(t(lbl))}</h4>
          <div class="mx-list">${list.map(card).join('') || `<p class="muted small">${h(t('mxNone'))}</p>`}</div></div>`;
      }).join('')}</div></section>`).join('')}`;
  $('#mx-pending-x', main)?.addEventListener('click', () => { pending = null; pendingList = ''; renderHome(main); });
  $$('[data-new]', main).forEach((b) => { b.onclick = () => createNew(b.dataset.new); });
  $$('[data-match]', main).forEach((b) => { b.onclick = () => pickLetter(b.dataset.match); });
  $$('[data-open]', main).forEach((b) => { b.onclick = () => openTemplate(b.dataset.open); });
  $$('[data-dup]', main).forEach((b) => { b.onclick = () => duplicate(b.dataset.dup); });
  $$('[data-del]', main).forEach((b) => {
    b.onclick = async () => {
      const x = state.mailTemplates.find((r) => String(r.template_id) === b.dataset.del);
      if (!x || !confirm(t('mmConfirmDelete', { name: x.name }))) return;
      try {
        await deleteRecord('MailTemplates', 'template_id', x);
        state.mailTemplates = state.mailTemplates.filter((r) => r !== x);
        renderHome(main);
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
}
function listName(id) { return state.savedLists.find((l) => String(l.list_id) === String(id))?.name || ''; }

/** "תואם למכתב": בוחרים מכתב קיים → מעטפה / מדבקות עם אותם נמענים, באותו סדר, ומקושר ל"זוג" */
function pickLetter(kind) {
  const letters = templatesOf('ltr');
  if (!letters.length) { ui.toast(t('mxNoLetters'), 'error'); return; }
  const dlg = dialog(`<h3>📄 ${h(t(kind === 'env' ? 'mxMatchEnv' : 'mxMatchLbl'))}</h3>
    <p class="muted small">${h(t('mxMatchHint'))}</p>
    <ul class="mx-plist mx-pick">${letters.map((x) => `<li><button type="button" class="linkish" data-letter="${h(x.template_id)}">📄 ${h(x.name)}</button>
      <span class="muted small">${h(String(x.updated_at || x.created_at || '').slice(0, 10))}</span></li>`).join('')}</ul>
    <div class="dialog-actions"><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  $$('[data-letter]', dlg).forEach((b) => { b.onclick = () => { dlg.close(); createMatched(kind, b.dataset.letter); }; });
}
async function createMatched(kind, letterId) {
  const row = state.mailTemplates.find((r) => String(r.template_id) === String(letterId));
  if (!row) return;
  const L = fromRow(row);
  D = defaults(kind);
  openSnap = null;
  D.matchOf = String(letterId);
  D.meta = { ...D.meta, visibility: L.meta.visibility || 'public', editors: L.meta.editors || [], org: L.meta.org || '' };
  D.name = `${t(kind === 'env' ? 'mxEnvFor' : 'mxLblFor')} ${L.name}`;
  view = 'edit';
  idx = 0;
  skipIds = new Set();
  saveState = '';
  renderMailMerge();
  try {
    await persist();
    // דאס מכתב: דער "זוג" ווייזט אויף דעם נייעם עיצוב
    if (!L.ltr.pairEnv) {
      const s2 = settingsOf(row);
      s2.ltr = { ...(s2.ltr || {}), pairEnv: String(D.template_id) };
      const rec = { ...row, settings: JSON.stringify(s2) };
      await saveRecord('MailTemplates', 'template_id', rec);
      row.settings = rec.settings;
    }
    ui.toast(t('mxMatchedDone', { name: L.name }));
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}
async function createNew(kind) {
  D = defaults(kind);
  openSnap = null;
  applyPending();
  view = 'edit';
  idx = 0;
  skipIds = new Set();
  saveState = '';
  renderMailMerge();
  $('#mx-name')?.focus();
}
function openTemplate(id) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(id));
  if (!x) return;
  D = fromRow(x);
  openSnap = { ...x };
  applyPending();
  view = 'edit';
  idx = 0;
  skipIds = new Set();
  onlyType = '';
  saveState = canEditT(x) ? '' : 'ro';
  renderMailMerge();
}
async function duplicate(id) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(id));
  if (!x) return;
  D = fromRow(x);
  openSnap = null;
  D.template_id = '';
  D.name = `${x.name} (${t('mxCopy')})`;
  D.meta = { ...D.meta, editors: [] };
  view = 'edit';
  saveState = '';
  renderMailMerge();
  try { await persist(); ui.toast(t('mxDuplicated')); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}
function applyPending() {
  if (pending && D.kind !== 'ltr') D._ids = pending.ids;
  if (pendingList) { D.src.type = 'list'; D.src.list = pendingList; }
}

// ---------- די נמענים ----------
function needsAddr() {
  if (D.kind === 'ltr') return Boolean(D.ltr.window) && !D.src.email;
  if (D.kind === 'lbl' && D.lbl.mode === 'same') return false;
  return D.lang !== 'he'; // נאר לשון קודש — אן אן אדרעס
}
function listKey() {
  if (D.src.list) return D.src.list;
  const first = savedInScope()[0];
  return first ? `saved:${first.list_id}` : '';
}
/** אריינגעקלעבט: יעדער מענטש א בלאק (צווישן ליידיגע שורות): נאמען, אדרעס, שטאט */
function parsePaste(text) {
  return String(text || '').split(/\n\s*\n/).map((b, i) => b.split('\n').map(nz).filter(Boolean)).filter((l) => l.length).map((l, i) => {
    const name = l[0];
    const he = /[֐-׿]/.test(name);
    const last = l.length > 1 ? l[l.length - 1] : '';
    const m = /^(.*?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(last);
    const parts = name.split(/\s+/);
    return {
      contact_id: `p:${i}`, _key: `p:${i}`, _ext: true, is_alive: true,
      first_name_he: he ? parts.slice(0, -1).join(' ') : '', last_name_he: he ? parts.at(-1) : '',
      first_name_en: he ? '' : parts.slice(0, -1).join(' '), last_name_en: he ? '' : parts.at(-1), _mailing: he ? '' : name,
      address: l.length > 2 ? l.slice(1, -1).join(', ') : (m ? '' : l[1] || ''), city: m ? m[1] : '', state: m ? m[2] : '', zip: m ? m[3] : '',
    };
  });
}
function areaOf(c) { return nz(c.area) || detectArea(state.areas || [], { zip: c.zip, city: c.city, neighborhood: c.neighborhood, country: c.country }); }
/** תואם למכתב: דאס מכתב (אדער null) */
function matchedLetter() {
  if (!D?.matchOf) return null;
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(D.matchOf));
  return x ? fromRow(x) : null;
}
function computeRows() {
  info = { excluded: [], nosend: [] };
  let list = [];
  const M = matchedLetter();
  const s = M ? { ...M.src, email: false } : D.src;
  const sortBy = M ? M.sort : D.sort;
  if (D.kind === 'lbl' && D.lbl.mode === 'same') { rows = []; return; }
  if (D._ids) list = D._ids.map((id) => ui.contactById(id)).filter(Boolean);
  else if (s.type === 'contact') { const c = s.contact ? ui.contactById(s.contact) : null; list = c ? [c] : []; }
  else if (s.type === 'paste') list = parsePaste(s.paste);
  else {
    const id = (M ? (M.src.list || listKey()) : listKey()).split(':')[1];
    const l = state.savedLists.find((x) => String(x.list_id) === String(id));
    if (l) {
      const { cr } = parseSaved(l);
      const all = evaluate(cr);
      if (needsAddr() || (D.kind !== 'ltr' && D.lang === 'both')) {
        const ch = channel(all, 'mail', cr.includeNoSend);
        list = mailRecipients(ch, s.mailMode || cr.meta.mem?.mailMode || 'one');
        info.excluded = ch.missing.map((r) => r.c);
        info.nosend = ch.nosend.map((r) => r.c);
      } else {
        const ch = channel(all, 'any', cr.includeNoSend);
        list = ch.rows.map((r) => r.c);
        info.nosend = ch.nosend.map((r) => r.c);
      }
    }
  }
  if (s.toWife) list = list.map((c) => ({ ...c, _toWife: true }));
  const byName = (a, b) => nz(a.last_name_he || a.last_name_en).localeCompare(nz(b.last_name_he || b.last_name_en), 'he') || nz(a.first_name_he).localeCompare(nz(b.first_name_he), 'he');
  if (sortBy === 'name') list.sort(byName);
  else if (sortBy === 'zip') list.sort((a, b) => nz(a.zip).localeCompare(nz(b.zip)) || nz(a.address).localeCompare(nz(b.address)));
  else if (sortBy === 'area') list.sort((a, b) => areaOf(a).localeCompare(areaOf(b), 'he') || byName(a, b));
  rows = list.filter((c) => !skipIds.has(keyOf(c)));
}

// ---------- פראבלעמען ----------
function usedTokens() {
  if (D.kind === 'ltr') return `${D.ltr.html} ${D.ltr.window ? (D.ltr.winLang !== 'en' ? D.rcp.templateHe : '') + (D.ltr.winLang !== 'he' ? D.rcp.template : '') : ''} ${(D.boxes || []).map((b) => b.html).join(' ')}`;
  if (D.kind === 'lbl') return `${D.lang !== 'he' ? D.rcp.template : ''} ${D.lang !== 'en' ? D.rcp.templateHe : ''}`;
  return `${D.lang !== 'he' ? D.rcp.template : ''} ${D.lang !== 'en' ? D.rcp.templateHe : ''} ${(D.boxes || []).map((b) => b.html).join(' ')}`;
}
function computeProblems() {
  probs = new Map();
  byRow = new Map();
  const add = (type, sev, c, note = '') => {
    if (!probs.has(type)) probs.set(type, { sev, items: [] });
    probs.get(type).items.push({ c, note });
    if (sev !== 'info') { const k = keyOf(c); if (!byRow.has(k)) byRow.set(k, []); byRow.get(k).push(type); }
  };
  const used = usedTokens();
  const usesEn = /\{(Name|First|Last|Wife|mailing|first|last|wife|legal)\}/.test(used);
  const usesHe = /\{(תואר|שם|שם_מלא|שם_פרטי|משפחה|hebrew)\}/.test(used);
  const seen = new Map();
  rows.forEach((c) => {
    if (isDeceased(c)) add('dead', 'red', c);
    if (needsAddr()) {
      if (!hasAddr(c)) add('noaddr', 'red', c);
      else if (partAddr(c)) add('partaddr', 'yellow', c);
    }
    if (usesEn && !nz(c.first_name_en) && !nz(c.last_name_en) && !c._mailing) add('noen', 'yellow', c);
    if (usesHe && !c._ext && !(nz(c.title_he) && nz(c.first_name_he) && nz(c.last_name_he))) add('nohe', 'yellow', c);
    if (D.link?.name && !c._ext) { const x = donationCtx(D, c); if (!x || !x.n) add('nodon', 'yellow', c); }
    const em = new Set();
    const vals = valuesFor(D, c);
    fillText(D.rcp.template, vals, D.kind !== 'ltr' && D.lang !== 'he' ? em : null);
    fillText(D.rcp.templateHe, vals, D.kind !== 'ltr' && D.lang !== 'en' ? em : null);
    if (D.kind === 'ltr') fillHtml(D.ltr.html, vals, em);
    (D.boxes || []).forEach((b) => fillHtml(b.html, vals, em));
    ['Country', 'country', 'Wife', 'wife'].forEach((k) => em.delete(k)); // נישט קיין פראבלעם
    if (em.size) add('empty', 'yellow', c, [...em].map((k) => `{${k}}`).join(' '));
    if (hasAddr(c) && D.kind !== 'ltr') {
      const k = addrKey(c);
      if (seen.has(k)) add('dupaddr', 'yellow', c, nameOf(seen.get(k)));
      else seen.set(k, c);
    }
  });
  info.excluded.forEach((c) => add('excluded', 'info', c));
  info.nosend.forEach((c) => add('nosend', 'info', c));
}
const nameOf = (c) => (c ? (ui.fullNameHe(c) || [c.first_name_en, c.last_name_en].filter(Boolean).join(' ') || c._mailing || '') : '');
const PROB_LABEL = {
  dead: 'mxPDead', noaddr: 'mxPNoAddr', partaddr: 'mxPPartAddr', noen: 'mxPNoEn', nohe: 'mxPNoHe', nodon: 'mxPNoDon',
  empty: 'mxPEmpty', dupaddr: 'mxPDupAddr', overflow: 'mxPOverflow', excluded: 'mxPExcluded', nosend: 'mxPNoSend',
};
function worst() { let w = 0; probs.forEach((p) => { w = Math.max(w, SEV[p.sev]); }); return w; }
function barHtml() {
  if (D.kind === 'lbl' && D.lbl.mode === 'same') return '';
  const w = worst();
  const cls = w >= 3 ? 'red' : w === 2 ? 'yellow' : 'green';
  const chips = [...probs.entries()].sort((a, b) => SEV[b[1].sev] - SEV[a[1].sev]).map(([k, p]) => `<button type="button" class="mx-pchip ${p.sev}${onlyType === k ? ' on' : ''}" data-ptype="${k}">${h(t(PROB_LABEL[k]))} <b>${p.items.length}</b></button>`).join('');
  return `<div class="mx-bar ${cls}">${w ? '' : `✓ ${h(t('mxAllGood'))}`}${chips}
    ${byRow.size ? `<label class="check small"><input type="checkbox" id="mx-only" ${onlyType ? 'checked' : ''}> ${h(t('mxOnlyProblems'))}</label>` : ''}</div>`;
}
/** די נמענים וואס מ'ווייזט אין דער פאָרויסזיכט */
function viewRows() {
  if (!onlyType) return rows;
  if (onlyType === '*') return rows.filter((c) => byRow.has(keyOf(c)));
  return rows.filter((c) => (byRow.get(keyOf(c)) || []).includes(onlyType));
}

// ---------- מעסטן: צו פיל טעקסט? (און לעיבלס: קלענער מאכן) ----------
let measureBox = null;
function measureEl() {
  if (!measureBox) {
    measureBox = document.createElement('div');
    measureBox.id = 'mx-measure';
    document.body.append(measureBox);
  }
  return measureBox;
}
/** לעיבלס / נמען: מאכט דעם שריפט קלענער ביז עס פאסט (ביז 6pt). גיט צוריק צי עס פאסט נאך אלץ נישט */
function fitIn(root) {
  let over = false;
  $$('.mx-lbl-text', root).forEach((el) => {
    const box = el.closest('.lbl');
    const tooBig = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    let guard = 0;
    while (tooBig() && guard < 16) {
      $$('.mx-rcp-part', el).forEach((p) => { const s = parseFloat(p.style.fontSize) || 10; p.style.fontSize = `${Math.max(5.5, s - 0.5)}pt`; });
      guard += 1;
    }
    if (tooBig()) { over = true; box.classList.add('mx-over'); }
  });
  $$('.mx-body', root).forEach((el) => { if (el.scrollHeight > el.clientHeight + 2) { over = true; el.classList.add('mx-over'); } });
  $$('.mx-win', root).forEach((el) => { if (el.scrollHeight > el.clientHeight + 2) { over = true; el.classList.add('mx-over'); } });
  $$('.env-rcp', root).forEach((el) => {
    const page = el.closest('.mx-page');
    if (el.offsetTop + el.offsetHeight > page.clientHeight + 1 || el.offsetLeft + el.scrollWidth > page.clientWidth + 1) { over = true; el.classList.add('mx-over'); }
  });
  return over;
}
/** פאר יעדן נמען — פאסט עס? (אין הינטערגרונט, שטיקלעכווייז) */
async function measureAll() {
  const run = ++measureRun;
  const box = measureEl();
  const over = [];
  if (D.kind === 'lbl' && D.lbl.mode === 'same') return;
  for (let i = 0; i < rows.length; i += 1) {
    if (run !== measureRun) return;
    const c = rows[i];
    box.innerHTML = D.kind === 'lbl' ? labelPages({ ...D, lbl: { ...D.lbl, skip: 0 } }, [c], { all: false })[0] : D.kind === 'ltr' ? letterPages(D, c).join('') : envHtml(D, c);
    if (fitIn(box)) over.push(c);
    if (i % 25 === 24) await new Promise((r) => setTimeout(r, 0));
  }
  box.innerHTML = '';
  if (run !== measureRun) return;
  probs.delete('overflow');
  byRow.forEach((v, k) => { const j = v.indexOf('overflow'); if (j >= 0) v.splice(j, 1); if (!v.length) byRow.delete(k); });
  if (over.length) {
    probs.set('overflow', { sev: 'yellow', items: over.map((c) => ({ c })) });
    over.forEach((c) => { const k = keyOf(c); if (!byRow.has(k)) byRow.set(k, []); byRow.get(k).push('overflow'); });
  }
  const bar = $('#mx-bar-wrap');
  if (bar) { bar.innerHTML = barHtml(); wireBar($('#mailmerge-main')); }
}

// ---------- דער עדיטאר ----------
function sel(path, opts, val) {
  return `<select data-k="${path}">${opts.map(([v, l]) => `<option value="${h(v)}"${String(v) === String(val) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`;
}
const num = (path, val, min, max, step = 'any') => `<input type="number" data-k="${path}" value="${h(val)}" min="${min}" max="${max}" step="${step}">`;
const chk = (path, val, label) => `<label class="check"><input type="checkbox" data-k="${path}" ${val ? 'checked' : ''}> ${h(label)}</label>`;
const fontOpts = (he) => [...customFontNames(), ...(he ? FONTS_HE : FONTS_EN)].map((f) => [f, f]);
const logoOpts = () => [['', t('mmNone')], ['crown', umbrellaName()], ['neshei', t('nesheiFull')],
  ...Object.keys(state.orgLogos || {}).map((o) => [`org:${o}`, o]), ['custom', t('mmCustomImage')]];
function tokensHtml(target, he = true, en = true) {
  return `<div class="mm-tokens">${[...(he ? TOKENS_HE : []), ...(en ? TOKENS_EN : [])].map((k) => `<button type="button" class="chip mini" data-token="{${k}}" data-target="${target}">{${k}}</button>`).join('')}</div>`;
}
function orgOptions() {
  const lists = ['beis_medrash', 'kollel', 'organization'].flatMap((n) => state.lists[n] || []);
  return [...new Set([umbrellaName(), ...lists, ...state.orgDetails.map((o) => o.org)].filter(Boolean))];
}

function recipientsHtml() {
  const s = D.src;
  if (D.kind === 'lbl' && D.lbl.mode === 'same') return '';
  const M = matchedLetter();
  if (M) {
    return `<details open><summary>${h(t('mxRecipients'))}</summary>
      <p class="mx-pending small">📄 ${h(t('mxMatchedTo', { name: M.name }))}</p>
      <button type="button" class="linkish small" id="mx-unmatch">${h(t('mxUnmatch'))}</button>
      <p class="muted small" id="mx-count">${h(t('mmCount', { n: rows.length }))}</p></details>`;
  }
  if (D._ids) {
    return `<details open><summary>${h(t('mxRecipients'))}</summary>
      <p class="mx-pending small">📬 ${h(t('mxFromReceipts', { n: D._ids.length }))} <button type="button" class="linkish" id="mx-ids-x">${h(t('mxPendingCancel'))}</button></p>
      ${sortHtml()}</details>`;
  }
  const lists = savedInScope().map((l) => [`saved:${l.list_id}`, l.name]);
  const contact = s.contact ? ui.contactById(s.contact) : null;
  return `<details open><summary>${h(t('mxRecipients'))}</summary>
    <div class="seg mx-src">${[['list', t('mxSrcList')], ['contact', t('mxSrcContact')], ['paste', t('mxSrcPaste')]].map(([v, l]) => `<button type="button" data-src="${v}" class="${s.type === v ? 'on' : ''}">${h(l)}</button>`).join('')}</div>
    ${s.type === 'list' ? `${lists.length ? sel('src.list', lists, listKey()) : `<p class="muted small">${h(t('mxNoLists'))}</p>`}
      ${sel('src.mailMode', [['', t('mxModeList')], ['one', t('L2mmOne')], ['all', t('L2mmAll')], ['each', t('L2mmEach')]], s.mailMode)}` : ''}
    ${s.type === 'contact' ? `<input id="mx-contact" list="dl-mx-contacts" autocomplete="off" placeholder="${h(t('pickContact'))}" value="${contact ? h(ui.pickerLabel(contact)) : ''}">
      <datalist id="dl-mx-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>` : ''}
    ${s.type === 'paste' ? `<textarea data-k="src.paste" rows="6" dir="auto" placeholder="${h(t('mxPastePh'))}">${h(s.paste)}</textarea>` : ''}
    ${chk('src.toWife', s.toWife, t('mmToWife'))}
    ${D.kind === 'ltr' ? chk('src.email', s.email, t('mxByEmail')) : ''}
    ${sortHtml()}
    </details>`;
}
function sortHtml() {
  return `<label class="mm-l">${h(t('mxSort'))}${sel('sort', [['list', t('mxSortList')], ['name', t('mxSortName')], ['zip', 'ZIP'], ['area', t('area')]], D.sort)}</label>
    <p class="muted small" id="mx-count">${h(t('mmCount', { n: rows.length }))}</p>`;
}

function rcpEditHtml(withPos = true) {
  const r = D.rcp;
  return `<details open><summary>${h(t('mxRcpBlock'))}</summary>
    <label class="mm-l">${h(t('mxLang'))}${sel('lang', [['en', 'English'], ['he', 'לשון קודש'], ['both', t('mxBoth')]], D.lang)}</label>
    ${D.lang !== 'en' ? `<label class="mm-l">${h(t('mxTplHe'))}<textarea data-k="rcp.templateHe" id="mx-tpl-he" rows="3" dir="rtl">${h(r.templateHe)}</textarea></label>
      ${tokensHtml('mx-tpl-he', true, false)}
      <div class="mm-grid"><label>${h(t('mmFont'))}${sel('rcp.fontHe', fontOpts(true), r.fontHe)}</label>
      ${D.kind === 'env' ? `<label>${h(t('mmSize'))}${num('rcp.sizeHe', r.sizeHe, 6, 40)}</label>` : ''}</div>` : ''}
    ${D.lang !== 'he' ? `<label class="mm-l">${h(t('mmRcpTemplate'))}<textarea data-k="rcp.template" id="mx-tpl-en" rows="4" dir="ltr">${h(r.template)}</textarea></label>
      ${tokensHtml('mx-tpl-en', false, true)}
      <div class="mm-grid"><label>${h(t('mmFont'))}${sel('rcp.font', fontOpts(false), r.font)}</label>
      ${D.kind === 'env' ? `<label>${h(t('mmSize'))}${num('rcp.size', r.size, 6, 40)}</label>` : ''}</div>` : ''}
    ${withPos ? `<div class="mm-grid"><label>${h(t('mmAlign'))}${sel('rcp.align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], r.align)}</label>
      ${chk('rcp.bold', r.bold, t('mmBoldFirst'))}</div>` : ''}
    </details>`;
}
function boxesEditHtml() {
  const b = (D.boxes || []).find((x) => x.id === selBox);
  return `<details${D.boxes?.length ? ' open' : ''}><summary>${h(t('mxBoxes'))}</summary>
    <p class="muted small">${h(t('mxBoxesHint'))}</p>
    <div class="mx-boxlist">${(D.boxes || []).map((x, i) => `<button type="button" class="chip${x.id === selBox ? ' on' : ''}" data-selbox="${h(x.id)}">${i + 1}. ${h(String(x.html || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 18) || '…')}</button>`).join('')}
      <button type="button" class="btn small-btn" id="mx-addbox">+ ${h(t('mxAddBox'))}</button></div>
    ${b ? `${rteHtml(`box:${b.id}`, b.html, b.dir || 'rtl')}
      <div class="mm-grid"><label>${h(t('mmFont'))}<select data-box="font">${fontOpts(true).concat(fontOpts(false)).map(([v]) => `<option${v === b.font ? ' selected' : ''}>${h(v)}</option>`).join('')}</select></label>
      <label>${h(t('mmSize'))}<input type="number" data-box="size" min="6" max="60" value="${b.size || 12}"></label>
      <label>${h(t('mxWidth'))}<input type="number" data-box="w" min="0.5" max="12" step="0.1" value="${b.w}"></label>
      <label>${h(t('mxDir'))}<select data-box="dir"><option value="rtl"${b.dir !== 'ltr' ? ' selected' : ''}>RTL</option><option value="ltr"${b.dir === 'ltr' ? ' selected' : ''}>LTR</option></select></label></div>
      <button type="button" class="btn small-btn danger" id="mx-delbox">${h(t('deleteBtn'))}</button>` : ''}
    </details>`;
}
/** א קליינער עדיטאר פאר רייכן טעקסט */
function rteHtml(target, html, dir) {
  const fonts = [...new Set([...customFontNames(), ...FONTS_HE, ...FONTS_EN])];
  return `<div class="mx-rte-wrap" data-rte="${h(target)}">
    <div class="mx-tools">
      <button type="button" data-cmd="bold"><b>B</b></button><button type="button" data-cmd="italic"><i>I</i></button><button type="button" data-cmd="underline"><u>U</u></button>
      <select data-cmdsel="fontName" title="${h(t('mmFont'))}"><option value="">${h(t('mmFont'))}</option>${fonts.map((f) => `<option>${h(f)}</option>`).join('')}</select>
      <select data-cmdsel="size" title="${h(t('mmSize'))}"><option value="">pt</option>${[9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40].map((n) => `<option>${n}</option>`).join('')}</select>
      <input type="color" data-cmdsel="foreColor" value="#1f1a17" title="${h(t('mxColor'))}">
      <button type="button" data-cmd="justifyRight">⇥</button><button type="button" data-cmd="justifyCenter">≡</button><button type="button" data-cmd="justifyLeft">⇤</button><button type="button" data-cmd="justifyFull">☰</button>
      <button type="button" data-cmd="insertUnorderedList">•</button><button type="button" data-cmd="insertOrderedList">1.</button>
      <button type="button" data-cmd="removeFormat" title="${h(t('mxClearFmt'))}">⌫</button>
    </div>
    <div class="mx-rte" contenteditable="true" dir="${dir}">${cleanHtml(html)}</div>
    ${tokensHtml('rte', true, true)}
  </div>`;
}
function letterEditHtml() {
  const L = D.ltr;
  const camps = allCampaigns().map((c) => [c.name, c.name]);
  const envs = [...templatesOf('env').map((x) => [x.template_id, `✉ ${x.name}`]), ...templatesOf('lbl').map((x) => [x.template_id, `🏷 ${x.name}`])];
  return `<!--@R--><details open><summary>${h(t('mxLetterLang'))}</summary>
      <div class="mm-grid"><label>${h(t('mxLang'))}${sel('ltr.lang', [['yi', 'אידיש'], ['he', 'עברית'], ['en', 'English']], L.lang)}</label>
      <label>${h(t('mxDir'))}${sel('ltr.dir', [['rtl', t('mxRtl')], ['ltr', t('mxLtr')]], L.dir)}</label></div>
    </details>
    <!--@L--><details open><summary>${h(t('mxDesign'))}</summary>
      ${sel('ltr.design', [['org', t('mxDesignOrg')], ['bg', t('mxDesignBg')], ['none', t('mxDesignNone')]], L.design)}
      ${L.design === 'org' ? `<label class="mm-l">${h(t('mxOrg'))}${sel('ltr.org', orgOptions().map((o) => [o, o]), L.org)}</label>
        <label class="mm-l">${h(t('mxBannerH'))}${num('ltr.bannerH', L.bannerH, 0.5, 4, 0.1)}</label>
        ${chk('ltr.sig', L.sig, t('mxSig'))}` : ''}
      ${L.design === 'bg' ? `<input type="file" accept="image/*" data-upload="background_data">
        ${D.background_data ? `<button type="button" class="btn small-btn" data-clear="background_data">${h(t('mmRemoveBg'))}</button>` : ''}
        <label class="mm-l">${h(t('mmOpacity'))}<input type="range" data-k="bg.opacity" min="0.05" max="1" step="0.01" value="${D.bg.opacity}"></label>` : ''}
    </details>
    <!--@R--><details open><summary>${h(t('mxLink'))}</summary>
      <p class="muted small">${h(t('mxLinkHint'))}</p>
      ${sel('link.name', [['', t('mmNone')], ...camps], D.link.name)}
    </details>
    <!--@L--><details open data-sec="body"><summary>${h(t('mxBody'))}</summary>
      <label class="mm-l">${h(t('mxSalutation'))}<input data-k="ltr.salutation" dir="rtl" value="${h(L.salutation)}"></label>
      <p class="muted small">✏️ ${h(t('wrWriteOnPage'))}</p>
      <div class="mm-grid"><label>${h(t('mmFont'))}${sel('ltr.font', [...new Set([...customFontNames(), ...FONTS_HE, ...FONTS_EN])].map((f) => [f, f]), L.font)}</label>
      <label>${h(t('mmSize'))}${num('ltr.size', L.size, 8, 30, 0.5)}</label>
      <label>${h(t('mxLineH'))}${sel('ltr.lineH', [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2].map((n) => [n, n]), L.lineH)}</label></div>
      <div class="mm-grid" data-sec="margins"><label>${h(t('mxMarginTop'))}${num('ltr.margins.top', L.margins.top, 0.2, 4, 0.05)}</label>
      <label>${h(t('mxMarginSide'))}${num('ltr.margins.side', L.margins.side, 0.2, 2.5, 0.05)}</label>
      <label>${h(t('mxMarginBottom'))}${num('ltr.margins.bottom', L.margins.bottom, 0.2, 3, 0.05)}</label></div>
    </details>
    <!--@R--><details${L.window ? ' open' : ''}><summary>${h(t('mxWindow'))}</summary>
      ${chk('ltr.window', L.window, t('mxWindowOn'))}
      ${L.window ? `<p class="muted small">${h(t('mxWindowHint'))}</p>
        <label class="mm-l">${h(t('mxLang'))}${sel('ltr.winLang', [['en', 'English'], ['he', 'לשון קודש'], ['both', t('mxBoth')]], L.winLang)}</label>
        <div class="mm-grid"><label>X (in)${num('ltr.win.x', L.win.x, 0, 7, 0.05)}</label><label>Y (in)${num('ltr.win.y', L.win.y, 0, 9, 0.05)}</label>
        <label>${h(t('mxWidth'))}${num('ltr.win.w', L.win.w, 1, 7, 0.05)}</label><label>${h(t('mxHeight'))}${num('ltr.win.h', L.win.h, 0.5, 3, 0.05)}</label></div>` : ''}
    </details>
    <!--@R-->${D.src.email ? `<details open><summary>${h(t('mxEmail'))}</summary>
      <label class="mm-l">${h(t('mxSubject'))}<input data-k="ltr.subject" dir="auto" value="${h(L.subject)}"></label></details>` : ''}
    <!--@R--><details><summary>${h(t('mxPair'))}</summary>
      <p class="muted small">${h(t('mxPairHint'))}</p>
      ${sel('ltr.pairEnv', [['', t('mmNone')], ...envs], L.pairEnv)}
    </details>`;
}
/** מכתב: R = הגדרות (מימין לתצוגה), L = עיצוב (משמאל) */
function letterSide(side) {
  return letterEditHtml().split(/<!--@([RL])-->/).reduce((acc, part, i, arr) => (i % 2 === 1 && part === side ? acc + arr[i + 1] : acc), '');
}
function envEditHtml() {
  const [W, H] = envSize(D);
  return `<details open><summary>${h(t('mxSize'))}</summary>
      ${sel('format', [...ENVELOPES.map(([k, n]) => [k, n]), ['custom', t('mxCustomSize')]], D.format)}
      ${D.format === 'custom' ? `<div class="mm-grid"><label>${h(t('mxWidth'))} (in)${num('size.w', W, 2, 16, 0.05)}</label><label>${h(t('mxHeight'))} (in)${num('size.h', H, 2, 14, 0.05)}</label></div>` : ''}
    </details>
    ${rcpEditHtml()}
    <details open><summary>${h(t('mmReturn'))}</summary>
      ${chk('ret.show', D.ret.show, t('mmShowReturn'))}
      <label class="mm-l">${h(t('mmLogo'))}${sel('ret.logo', logoOpts(), D.ret.logo)}</label>
      ${D.ret.logo === 'custom' ? '<input type="file" accept="image/*" data-upload="logo_data">' : ''}
      <label class="mm-l">${h(t('mmLogoSize'))}<input type="range" data-k="ret.logoH" min="0.2" max="1.5" step="0.05" value="${D.ret.logoH}"></label>
      <label class="mm-l">${h(t('mmReturnText'))}<textarea data-k="ret.text" rows="4" dir="auto">${h(D.ret.text)}</textarea></label>
      <div class="mm-grid"><label>${h(t('mmFont'))}${sel('ret.font', fontOpts(false).concat(fontOpts(true)), D.ret.font)}</label>
      <label>${h(t('mmSize'))}${num('ret.size', D.ret.size, 5, 20)}</label>
      <label>${h(t('mxDir'))}${sel('ret.dir', [['ltr', 'LTR'], ['rtl', 'RTL']], D.ret.dir)}</label></div>
    </details>
    <details open><summary>${h(t('mmPostage'))}</summary>
      ${sel('post.mode', [['stamp', t('mmStamp')], ['text', t('mmIndicia')], ['image', t('mmPostageImage')], ['none', t('mmNone')]], D.post.mode)}
      ${D.post.mode === 'text' ? `<textarea data-k="post.text" rows="4" dir="ltr">${h(D.post.text)}</textarea><label>${h(t('mmSize'))}${num('post.size', D.post.size, 5, 14)}</label>` : ''}
      ${D.post.mode === 'image' ? '<input type="file" accept="image/*" data-upload="postage_data">' : ''}
      ${chk('post.border', D.post.border, t('mmBorder'))}
    </details>
    <details><summary>${h(t('mmBackground'))}</summary>
      <input type="file" accept="image/*" data-upload="background_data">
      ${D.background_data ? `<button type="button" class="btn small-btn" data-clear="background_data">${h(t('mmRemoveBg'))}</button>` : ''}
      <label class="mm-l">${h(t('mmOpacity'))}<input type="range" data-k="bg.opacity" min="0.03" max="1" step="0.01" value="${D.bg.opacity}"></label>
    </details>
    ${boxesEditHtml()}`;
}
function lblEditHtml() {
  const L = D.lbl;
  return `<details open><summary>${h(t('mxSheet'))}</summary>
      ${sel('lbl.sheet', allSheets().map((s) => [s.id, `${s.shape === 'round' ? '◯ ' : ''}${s.name}`]), L.sheet)}
      <button type="button" class="btn small-btn" id="mx-sheets">⚙ ${h(t('mxManageSheets'))}</button>
      <label class="mm-l">${h(t('mmLabelMode'))}${sel('lbl.mode', [['list', t('mmModeList')], ['same', t('mmModeSame')]], L.mode)}</label>
      ${L.mode === 'same' ? `<label class="mm-l">${h(t('mmSameText'))}<textarea data-k="lbl.text" rows="4" dir="auto">${h(L.text)}</textarea></label>
        <div class="mm-grid"><label>${h(t('mmFont'))}${sel('lbl.font', fontOpts(false).concat(fontOpts(true)), L.font)}</label>
        <label>${h(t('mxDir'))}${sel('lbl.dir', [['ltr', 'LTR'], ['rtl', 'RTL']], L.dir)}</label>
        <label>${h(t('mmSheets'))}${num('lbl.sheets', L.sheets || 1, 1, 50, 1)}</label></div>` : ''}
      <label class="mm-l">${h(t('mmSkipLabels'))}${num('lbl.skip', L.skip || 0, 0, labelsPerSheet(D) - 1, 1)}</label>
    </details>
    ${L.mode === 'list' ? rcpEditHtml(false) : ''}
    <details open><summary>${h(t('mmLabelText'))}</summary>
      <div class="mm-grid"><label>${h(t('mmSize'))}${num('lbl.size', L.size, 5, 24, 0.5)}</label>
      <label>${h(t('mmAlign'))}${sel('lbl.align', [['center', 'Center'], ['left', 'Left'], ['right', 'Right']], L.align)}</label>
      <label>${h(t('mxPad'))}${num('lbl.pad', L.pad, 0, 0.5, 0.01)}</label>
      ${chk('rcp.bold', D.rcp.bold, t('mmBoldFirst'))}</div>
    </details>
    <details><summary>${h(t('mmLogo'))}</summary>
      ${sel('lbl.logo', logoOpts(), L.logo)}
      ${L.logo === 'custom' ? '<input type="file" accept="image/*" data-upload="logo_data">' : ''}
      <div class="mm-grid"><label>${h(t('mxLogoPos'))}${sel('lbl.logoPos', [['left', t('mxLeft')], ['right', t('mxRight')], ['top', t('mxTop')]], L.logoPos)}</label>
      ${L.mode === 'list' ? chk('lbl.logoAll', L.logoAll, t('mxLogoOnAll')) : ''}</div>
    </details>
    <details><summary>${h(t('mmBackground'))}</summary>
      <p class="muted small">${h(t('mxLblBgHint'))}</p>
      <input type="file" accept="image/*" data-upload="background_data">
      ${D.background_data ? `<button type="button" class="btn small-btn" data-clear="background_data">${h(t('mmRemoveBg'))}</button>` : ''}
      <label class="mm-l">${h(t('mmOpacity'))}<input type="range" data-k="bg.opacity" min="0.03" max="1" step="0.01" value="${D.bg.opacity}"></label>
    </details>
    <details><summary>${h(t('mxAlign'))}</summary>
      <p class="muted small">${h(t('mxAlignHint'))}</p>
      <div class="mm-grid"><label>${h(t('mxNudgeX'))}${num('lbl.nudgeX', L.nudgeX || 0, -0.5, 0.5, 0.01)}</label>
      <label>${h(t('mxNudgeY'))}${num('lbl.nudgeY', L.nudgeY || 0, -0.5, 0.5, 0.01)}</label></div>
      <button type="button" class="btn small-btn" id="mx-testsheet">🖨 ${h(t('mxTestSheet'))}</button>
    </details>`;
}

function stageHtml() {
  if (D.kind === 'ltr') return wordStageHtml();
  const vr = viewRows();
  if (idx >= vr.length) idx = Math.max(0, vr.length - 1);
  const c = vr[idx];
  let page;
  if (D.kind === 'lbl') {
    if (D.lbl.mode === 'same') page = labelPages(D, [])[0];
    else {
      // דער בויגן וואו דער איצטיגער נמען איז
      const per = labelsPerSheet(D);
      const skip = Number(D.lbl.skip) || 0;
      const pos = rows.indexOf(c) + skip;
      const sheetNo = Math.max(0, Math.floor(pos / per));
      const pages = labelPages(D, rows);
      page = pages[sheetNo] || pages[0];
    }
  } else page = D.kind === 'ltr' ? `<div class="mx-pages">${letterPages(D, c, { edit: true }).join('')}</div>` : envHtml(D, c, { edit: true });
  const red = worst() >= 3;
  const nav = D.kind === 'lbl' && D.lbl.mode === 'same' ? '' : `<button type="button" class="btn small-btn" id="mx-prev">‹</button>
      <span>${vr.length ? h(t('mmRecordOf', { i: idx + 1, n: vr.length })) : h(t('mmNoRecords'))}</span>
      <button type="button" class="btn small-btn" id="mx-next">›</button>
      ${c ? `<span class="muted small mx-who">${h(nameOf(c))}${(byRow.get(keyOf(c)) || []).length ? ` · ⚠ ${(byRow.get(keyOf(c)) || []).map((k) => h(t(PROB_LABEL[k]))).join(', ')}` : ''}</span>
        ${c.contact_id && !c._ext ? `<button type="button" class="linkish small" data-card="${h(c.contact_id)}">${h(t('mxOpenCard'))}</button>` : ''}
        <button type="button" class="linkish small" id="mx-skip">${h(t('mxSkipOne'))}</button>` : ''}
      ${skipIds.size ? `<button type="button" class="linkish small" id="mx-unskip">${h(t('mxUnskip', { n: skipIds.size }))}</button>` : ''}`;
  const total = D.kind === 'lbl' && D.lbl.mode === 'same' ? `${D.lbl.sheets || 1} × ${labelsPerSheet(D)}` : rows.length;
  return `<div class="mm-nav">${nav}<span class="spacer"></span>
      <span class="mx-zoom"><button type="button" class="btn small-btn" id="mx-zoom-out" title="−">−</button>
      <button type="button" class="linkish small" id="mx-zoom-fit" title="${h(t('mxZoomFit'))}"><span id="mx-zoom-val">${Math.round(zoom * 100)}%</span></button>
      <button type="button" class="btn small-btn" id="mx-zoom-in" title="+">+</button></span></div>
    <div class="mm-canvas" id="mm-canvas" dir="ltr">${page}</div>
    <div class="mx-print">
      <button type="button" class="btn primary" id="mx-print">🖨 ${h(t('mxPrint', { n: total }))}</button>
      <button type="button" class="btn" id="mx-pdf">⬇ PDF</button>
      <button type="button" class="btn" id="mx-test">${h(t('mxTestOne'))}</button>
      ${D.kind === 'lbl' && D.lbl.mode === 'same' ? '' : `<span class="mx-range">${h(t('mxRange'))} <input type="number" id="mx-from" min="1" value="1"> – <input type="number" id="mx-to" min="1" value="${rows.length || 1}"></span>`}
      ${D.kind === 'ltr' && D.ltr.pairEnv ? `<button type="button" class="btn" id="mx-pair">✉+📄 ${h(t('mxPairBtn'))}</button>` : ''}
      ${D.kind === 'ltr' && D.src.email ? `<button type="button" class="btn" id="mx-send">📧 ${h(t('mxSendEmail'))}</button>` : ''}
      ${red ? `<span class="mx-redwarn">⚠ ${h(t('mxRedWarn'))}</span>` : ''}
    </div>`;
}

// ================= מכתב: עורך כמו Word =================
let ltrEdit = true;   // false = "תצוגה מקדימה של תוצאות"
let wrTab = (() => { try { return localStorage.getItem('khal-wr-tab') || 'home'; } catch { return 'home'; } })();
let wrDrawer = false; // דער פענצטערל פון די נמענים
let wrRange = null;   // וואו דער קורסאר איז געווען
let wrTimer = null;
let wrCtx = '';       // 'table' / 'img' — א לשונית וואס ווייזט זיך נאר דעמאלט
let selImg = null;    // די אויסגעקליבענע בילד
let painter = null;   // מברשת עיצוב: { st, sticky }
let openSnap = null;  // ווי דער עיצוב איז געווען ביים עפענען (פאר "שמור בשם")
const GAP = 0.3;      // צווישן בלעטער (אינטש)
const PX = 96;
const WORD_COLORS = ['#000000', '#7a1219', '#c00000', '#ff0000', '#ffc000', '#c9a23f', '#00b050', '#0070c0', '#002060', '#7030a0', '#7f7f7f'];
const HILITE = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffc000', '#d9d9d9'];
const SHADES = ['#f1e7d3', '#f3e3b8', '#f6e5d5', '#e2efda', '#ddebf7', '#ededed', '#ffffff'];
const SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const MARGINS = { normal: { top: 1, side: 1, bottom: 1 }, narrow: { top: 0.5, side: 0.5, bottom: 0.5 }, moderate: { top: 1, side: 0.75, bottom: 1 }, wide: { top: 1, side: 2, bottom: 1 } };
const LINE_SP = [1, 1.15, 1.5, 2, 2.5, 3];
const PARA_SP = [0, 3, 6, 9, 12, 18, 24];
const CELL = 'border:1px solid #888888;padding:2px 6px';
const TABS = [['home', 'wrHome'], ['settings', 'wrLetterSettings'], ['insert', 'wrInsert'], ['design', 'wrDesignLayout'], ['mail', 'wrMailings'], ['fields', 'wrFields']];
// קליינע בילדלעך (ווי אין Word)
const ICON = {
  copy: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="5" width="9" height="11" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 12.5V3.2c0-.4.3-.7.7-.7H11" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  cut: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="5" cy="13.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="13" cy="13.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.6 11.6 13 2.5M11.4 11.6 5 2.5" stroke="currentColor" stroke-width="1.4"/></svg>',
  painter: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2.5" y="2" width="11" height="5" rx="1" fill="#f3e3b8" stroke="currentColor" stroke-width="1.4"/><path d="M13.5 4.5h2v4H8.5v2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="7" y="11" width="3" height="5.5" rx="1" fill="currentColor"/></svg>',
};

/** {שדה} → «שדה» (א קעסטל וואס מען קען נישט טוישן, נאר אויסמעקן) */
const chipOf = (k) => `<span class="mx-tok" contenteditable="false" data-tok="${h(k)}">«${h(k)}»</span>`;
function tokensToChips(html) {
  const src = String(html || '');
  if (!/\{[^{}\s]{1,24}\}/.test(src)) return src;
  // נאר אינעם טעקסט (נישט אין an attribute ווי href="...{x}")
  const tpl = document.createElement('template');
  tpl.innerHTML = `<div>${src}</div>`;
  const root = tpl.content.firstElementChild;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (w.nextNode()) if (/\{[^{}\s]{1,24}\}/.test(w.currentNode.textContent)) nodes.push(w.currentNode);
  nodes.forEach((n) => {
    const box = document.createElement('template');
    box.innerHTML = h(n.textContent).replace(TOKEN_RE, (m, k) => chipOf(k.replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
    n.replaceWith(box.content);
  });
  return root.innerHTML;
}
/** דער טעקסט פונעם בלאט → HTML צום שפייכלערן */
function chipsToTokens(root) {
  // א <template> — די בילדער ווערן נישט געלאדן (src="drv:...")
  const tpl = document.createElement('template');
  tpl.innerHTML = `<div>${root.innerHTML}</div>`;
  const el = tpl.content.firstElementChild;
  el.querySelectorAll('[data-wrsp]').forEach((x) => x.remove());
  el.querySelectorAll('.mx-tok').forEach((x) => x.replaceWith(document.createTextNode(`{${x.dataset.tok}}`)));
  el.querySelectorAll('img[data-drv]').forEach((x) => x.setAttribute('src', `drv:${x.dataset.drv}`));
  el.querySelectorAll('[data-pbm]').forEach((x) => {
    x.style.marginTop = x.dataset.pbm;
    x.removeAttribute('data-pbm');
    if (!x.getAttribute('style')) x.removeAttribute('style');
  });
  return el.innerHTML;
}

// ---------- קנעפלעך ----------
const btn = (cmd, label, title, extra = '') => `<button type="button" class="wr-b" data-wcmd="${cmd}" title="${h(title)}"${extra}>${label}</button>`;
const big = (id, icon, label, extra = '') => `<button type="button" class="wr-big" id="${id}"${extra}><span class="wr-ic">${icon}</span><span>${h(label)}</span></button>`;
const group = (label, inner) => `<div class="wr-group"><div class="wr-gbody">${inner}</div><div class="wr-glabel">${h(label)}</div></div>`;
const dd = (cls, summary, title, menu) => `<details class="wr-dd ${cls}"><summary title="${h(title)}">${summary}</summary><div class="wr-menu">${menu}</div></details>`;
const bigdd = (icon, label, menu, cls = '') => dd(`wr-bigdd ${cls}`, `<span class="wr-ic">${icon}</span><span>${h(label)} ▾</span>`, label, menu);
const mi = (attrs, label, on = false) => `<button type="button" class="wr-mi${on ? ' on' : ''}" ${attrs}>${label}</button>`;
const fontList = () => [...new Set([...customFontNames(), ...FONTS_HE, ...FONTS_EN])];

function ribbonHome() {
  const fonts = fontList();
  const sz = Number(D.ltr.size) || 13;
  return group(t('wrClipboard'), `${big('wr-paste', '📋', t('wrPaste'))}
      <div class="wr-col wr-small">
        <button type="button" class="wr-b wr-wide" data-wcmd="cut" title="${h(t('wrCut'))} (Ctrl+X)">${ICON.cut} ${h(t('wrCut'))}</button>
        <button type="button" class="wr-b wr-wide" data-wcmd="copy" title="${h(t('wrCopy'))} (Ctrl+C)">${ICON.copy} ${h(t('wrCopy'))}</button>
        <button type="button" class="wr-b wr-wide${painter ? ' on' : ''}" id="wr-painter" title="${h(t('wrPainter'))}">${ICON.painter} ${h(t('wrPainterShort'))}</button></div>`)
    + group(t('wrFontGroup'), `
      <div class="wr-row">
        <select id="wr-font" title="${h(t('mmFont'))}">${fonts.map((f) => `<option style="font-family:'${h(f)}'"${f === D.ltr.font ? ' selected' : ''}>${h(f)}</option>`).join('')}</select>
        <select id="wr-size" title="${h(t('mmSize'))}">${[...new Set([...SIZES, sz])].sort((a, b) => a - b).map((n) => `<option${n === sz ? ' selected' : ''}>${n}</option>`).join('')}</select>
        ${dd('', 'Aa▾', t('wrCase'), [['lower', 'wrCaseLower'], ['upper', 'wrCaseUpper'], ['title', 'wrCaseTitle'], ['sentence', 'wrCaseSentence']].map(([k, l]) => mi(`data-case="${k}"`, h(t(l)))).join(''))}
      </div>
      <div class="wr-row">
        ${btn('bold', '<b>B</b>', `${t('wrBold')} (Ctrl+B)`)}${btn('italic', '<i>I</i>', `${t('wrItalic')} (Ctrl+I)`)}${btn('underline', '<u>U</u>', `${t('wrUnderline')} (Ctrl+U)`)}
        ${dd('wr-color', '<span class="wr-hl">ab</span>▾', t('wrHighlight'), `${HILITE.map((c) => `<button type="button" class="wr-sw" data-hilite="${c}" style="background:${c}"></button>`).join('')}
          ${mi('data-hilite="transparent"', h(t('wrNoColor')))}`)}
        ${foreColorDd()}
        ${btn('removeFormat', '<span class="wr-clear">A</span>', t('wrClear'))}
      </div>`)
    + group(t('wrParaGroup'), `
      <div class="wr-row">
        ${btn('insertUnorderedList', '•≡', t('wrBullets'))}${btn('insertOrderedList', '1≡', t('wrNumbering'))}
        ${btn('outdent', '⇤', t('wrIndentLess'))}${btn('indent', '⇥', t('wrIndentMore'))}
        ${dd('', '↕▾', t('wrLineSp'), LINE_SP.map((n) => mi(`data-linesp="${n}"`, String(n))).join(''))}
      </div>
      <div class="wr-row">
        ${btn('justifyRight', alignIcon('r'), t('wrAlignR'))}${btn('justifyCenter', alignIcon('c'), t('wrAlignC'))}${btn('justifyLeft', alignIcon('l'), t('wrAlignL'))}${btn('justifyFull', alignIcon('j'), t('wrJustify'))}
        ${btn('pdir-rtl', '¶◂', t('wrRtl'))}${btn('pdir-ltr', '▸¶', t('wrLtr'))}
      </div>`)
    + group(t('wrEditing'), `<div class="wr-col">
      <button type="button" class="wr-b wr-wide" id="wr-find" title="Ctrl+F">🔍 ${h(t('wrFind'))}</button>
      <button type="button" class="wr-b wr-wide" id="wr-replace" title="Ctrl+H">⇄ ${h(t('wrReplace'))}</button>
      <button type="button" class="wr-b wr-wide" data-wcmd="selectAll" title="Ctrl+A">⬚ ${h(t('wrSelectAll'))}</button></div>`)
    + group(t('wrFields'), bigdd('«»', t('wrFieldsBtn'), allFieldsMenu(), 'wr-allfields'));
}
/** אלע פעלדער: פערזענליך, נדבות, סכומים */
function allFieldsMenu() {
  return `<div class="wr-mh">${h(t('wrPersonal'))}</div>${TOKENS_HE.map((k) => mi(`data-field="${h(k)}"`, `«${h(k)}»`)).join('')}
    ${TOKENS_EN.map((k) => mi(`dir="ltr" data-field="${h(k)}"`, `«${h(k)}»`)).join('')}
    <div class="wr-mh">${h(t('wrDonations'))} (${h(t('wrRepRow'))})</div>${DON_TOKENS.map((k) => mi(`data-field="${h(k)}"`, `«${h(k)}»`)).join('')}
    <div class="wr-mh">${h(t('wrTotals'))}</div>${[...TOTAL_TOKENS, ...TOTAL_TOKENS_EN].map((k) => mi(`data-field="${h(k)}"`, `«${h(k)}»`)).join('')}`;
}
function foreColorDd() {
  return dd('wr-color', '<span class="wr-fc">A</span>▾', t('wrFontColor'), `${mi('data-fore="#000000"', h(t('wrAuto')))}
    ${WORD_COLORS.map((c) => `<button type="button" class="wr-sw" data-fore="${c}" style="background:${c}"></button>`).join('')}
    <label class="wr-mi">… <input type="color" class="wr-forecustom" value="#7a1219"></label>`);
}
function alignIcon(k) {
  const w = { r: [14, 9, 14, 9], c: [14, 9, 14, 9], l: [14, 9, 14, 9], j: [14, 14, 14, 14] }[k];
  const x = (len) => (k === 'r' ? 16 - len : k === 'c' ? (16 - len) / 2 : 1);
  return `<svg width="16" height="14" viewBox="0 0 17 14" aria-hidden="true">${w.map((len, i) => `<rect x="${x(len)}" y="${1 + i * 3.4}" width="${len}" height="1.6" fill="currentColor"/>`).join('')}</svg>`;
}
/** הגדרות המכתב — אלעס וואס איז נישט דער טעקסט */
function ribbonSettings() {
  const L = D.ltr;
  const camps = allCampaigns().map((c) => [c.name, c.name]);
  const envs = [...templatesOf('env').map((x) => [x.template_id, `✉ ${x.name}`]), ...templatesOf('lbl').map((x) => [x.template_id, `🏷 ${x.name}`])];
  return group(t('mxRecipients'), `${big('wr-rcp', '👥', t('wrEditRcp'))}<span class="wr-note">${h(t('mmCount', { n: rows.length }))}</span>`)
    + group(t('mxLetterLang'), `<label class="wr-lbl">${h(t('mxLang'))}${sel('ltr.lang', [['yi', 'אידיש'], ['he', 'עברית'], ['en', 'English']], L.lang)}</label>
      <label class="wr-lbl">${h(t('mxDir'))}${sel('ltr.dir', [['rtl', t('mxRtl')], ['ltr', t('mxLtr')]], L.dir)}</label>`)
    + group(t('mxLink'), `<label class="wr-lbl" title="${h(t('mxLinkHint'))}">${h(t('wrCampaign'))}${sel('link.name', [['', t('mmNone')], ...camps], D.link.name)}</label>`)
    + group(t('mxDesign'), `<label class="wr-lbl">${h(t('mxDesign'))}${sel('ltr.design', [['org', t('mxDesignOrg')], ['bg', t('mxDesignBg')], ['none', t('mxDesignNone')]], L.design)}</label>
      ${L.design === 'org' ? `<label class="wr-lbl">${h(t('mxOrg'))}${sel('ltr.org', orgOptions().map((o) => [o, o]), L.org)}</label>
        <div class="wr-col"><label class="wr-lbl">${h(t('mxBannerH'))}${num('ltr.bannerH', L.bannerH, 0.5, 4, 0.1)}</label>${chk('ltr.sig', L.sig, t('mxSig'))}</div>` : ''}
      ${L.design === 'bg' ? `<div class="wr-col"><label class="wr-b wr-wide wr-file">🖼 ${h(t('wrBgImage'))}<input type="file" accept="image/*" data-upload="background_data" hidden></label>
        ${D.background_data ? `<button type="button" class="wr-b wr-wide" data-clear="background_data">${h(t('mmRemoveBg'))}</button>` : ''}
        <label class="wr-lbl">${h(t('mmOpacity'))}<input type="range" data-k="bg.opacity" min="0.05" max="1" step="0.01" value="${D.bg.opacity}"></label></div>` : ''}`)
    + group(t('wrEnvGroup'), `<div class="wr-col">${chk('ltr.window', L.window, t('mxWindowOn'))}
      ${L.window ? `<label class="wr-lbl">${h(t('mxLang'))}${sel('ltr.winLang', [['en', 'English'], ['he', 'לשון קודש'], ['both', t('mxBoth')]], L.winLang)}</label>` : ''}</div>
      <label class="wr-lbl" title="${h(t('mxPairHint'))}">${h(t('mxPair'))}${sel('ltr.pairEnv', [['', t('mmNone')], ...envs], L.pairEnv)}</label>`)
    + (D.src.email ? group(t('mxEmail'), `<label class="wr-lbl">${h(t('mxSubject'))}<input data-k="ltr.subject" dir="auto" value="${h(L.subject)}"></label>`) : '')
    + group(t('wrDefaults'), `<label class="wr-lbl">${h(t('mxSalutation'))}<input data-k="ltr.salutation" dir="rtl" value="${h(L.salutation)}"></label>
      <div class="wr-col"><label class="wr-lbl">${h(t('mmFont'))}${sel('ltr.font', fontList().map((f) => [f, f]), L.font)}</label>
      <div class="wr-row"><label class="wr-lbl">${h(t('mmSize'))}${num('ltr.size', L.size, 8, 30, 0.5)}</label>
      <label class="wr-lbl">${h(t('mxLineH'))}${sel('ltr.lineH', [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2].map((n) => [n, n]), L.lineH)}</label></div></div>`);
}
function ribbonInsert() {
  const L = D.ltr;
  return group(t('wrPages'), big('wr-pgbrk', '⤓', t('wrPageBreak'), ' title="Ctrl+Enter"'))
    + group(t('wrTables'), bigdd('▦', t('wrTable'), `<div class="wr-grid" id="wr-grid">${Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (__, c) => `<span data-gr="${r + 1}" data-gc="${c + 1}"></span>`).join('')).join('')}</div>
      <div class="wr-gridlbl" id="wr-gridlbl">${h(t('wrTable'))}</div>
      ${mi('id="wr-table-dlg"', h(t('wrInsertTable')))}`))
    + group(t('wrIllus'), bigdd('🖼', t('wrPicture'), `${mi('id="wr-img-pc"', `💻 ${h(t('wrPicPc'))}`)}${mi('id="wr-img-drive"', `📁 ${h(t('wrPicDrive'))}`)}
      <input type="file" accept="image/*" id="wr-img-file" hidden>`))
    + group(t('wrLinks'), big('wr-link', '🔗', t('wrLink'), ' title="Ctrl+K"'))
    + group(t('rcReceipt'), big('wr-rcslot', '🧾', t('wrRcSlot'), `${D.ltr.rcSlot ? ' aria-pressed="true"' : ''} title="${h(t('wrRcSlotTip'))}"`))
    + group(t('wrTextGroup'), `${bigdd('📅', t('wrDate'), `${mi('data-date="he"', `${h(t('wrDateTodayHe'))} <span class="muted small">«תאריך»</span>`)}
        ${mi('data-date="greg"', `${h(t('wrDateTodayGreg'))} <span class="muted small">«${D.ltr.dir === 'ltr' ? 'Date' : 'תאריך_לועזי'}»</span>`)}
        ${mi('id="wr-date-other"', `🗓 ${h(t('wrDateOther'))}`)}`)}
      ${bigdd('✍', t('wrSignature'), `${mi('id="wr-sig-mine"', `✍ ${h(t('wrMySig'))}${mySig() ? '' : ` <span class="muted small">(${h(t('wrSigNone'))})</span>`}`)}
        ${mi('id="wr-sig-temp"', `✍ ${h(t('wrSigTemp'))}...`)}
        ${mi('id="wr-sig-setup"', h(t('wrSigSetup')))}
        ${L.design === 'org' ? mi('id="wr-sig"', `${L.sig ? '✓ ' : ''}${h(t('wrOrgSig'))}`, L.sig) : ''}`)}`);
}
function ribbonDesign() {
  const L = D.ltr;
  const w = L.wm || {};
  return group(t('wrFontGroup'), `<div class="wr-row">${foreColorDd()}
      ${dd('wr-color', '<span class="wr-outl">A</span>▾', t('wrOutline'), `${mi('data-outline=""', h(t('wrNoOutline')))}
        ${WORD_COLORS.map((c) => `<button type="button" class="wr-sw" data-outline="${c}" style="background:${c}"></button>`).join('')}
        <div class="wr-mh">${h(t('wrOutlineW'))}</div>${[['0.5', 'wrThin'], ['1', 'wrMedium'], ['1.6', 'wrThick']].map(([v, l]) => mi(`data-outw="${v}"`, h(t(l)))).join('')}`)}
      ${dd('wr-color', '<span class="wr-hl">ab</span>▾', t('wrHighlight'), `${HILITE.map((c) => `<button type="button" class="wr-sw" data-hilite="${c}" style="background:${c}"></button>`).join('')}
        ${mi('data-hilite="transparent"', h(t('wrNoColor')))}`)}</div>`)
    + group(t('wrParaSpacing'), `<div class="wr-col">
      ${dd('', `↥ ${h(t('wrSpBefore'))} ▾`, t('wrSpBefore'), PARA_SP.map((n) => mi(`data-spb="${n}"`, `${n} pt`)).join(''))}
      ${dd('', `↧ ${h(t('wrSpAfter'))} ▾`, t('wrSpAfter'), PARA_SP.map((n) => mi(`data-spa="${n}"`, `${n} pt`)).join(''))}
      <label class="wr-lbl">${h(t('wrSpDefault'))}${sel('ltr.paraAfter', [[0, '0'], [0.3, '0.3'], [0.55, '0.55'], [0.8, '0.8'], [1.2, '1.2']], L.paraAfter ?? 0.55)}</label></div>`)
    + group(t('wrPageBg'), bigdd('💧', t('wrWatermark'), `${mi('data-wm=""', h(t('wrNoWm')), !w.on)}
      ${['טיוטה', 'דוגמה', 'העתק', 'DRAFT', 'COPY', 'SAMPLE'].map((x) => mi(`data-wm="${h(x)}"`, `<span class="wr-wmprev">${h(x)}</span>`, w.on && w.type !== 'img' && w.text === x)).join('')}
      ${mi('id="wr-wm-custom"', h(t('wrWmCustom')))}${mi('id="wr-wm-img"', `🖼 ${h(t('wrWmImage'))}`)}
      <input type="file" accept="image/*" id="wr-wm-file" hidden>`));
}
function ribbonLayout() {
  const L = D.ltr;
  const m = L.margins || {};
  const cur = Object.entries(MARGINS).find(([, v]) => v.top === m.top && v.side === m.side && v.bottom === m.bottom)?.[0];
  const [W, H] = letterDims(D);
  return group(t('wrPageSetup'), `${bigdd('▭', t('wrMargins'),
    `${Object.entries(MARGINS).map(([k, v]) => mi(`data-margins="${k}"`, `<b>${h(t(`wrM_${k}`))}</b><span class="muted small"> ${v.top}" · ${v.side}"</span>`, cur === k)).join('')}
     ${mi('id="wr-margins-dlg"', h(t('wrMCustom')))}`)}
     ${bigdd('⤢', t('wrOrient'), `${mi('data-orient="p"', `▯ ${h(t('wrPortrait'))}`, L.orient !== 'l')}${mi('data-orient="l"', `▭ ${h(t('wrLandscape'))}`, L.orient === 'l')}`)}
     ${bigdd('📄', t('wrSize'), `${PAGE_SIZES.map(([k, n]) => mi(`data-psize="${k}"`, h(n), (L.page || 'letter') === k)).join('')}${mi('id="wr-size-dlg"', h(t('wrSizeCustom')), L.page === 'custom')}`)}
     ${bigdd('▥', t('wrColumns'), `${[[1, 'wrCol1'], [2, 'wrCol2'], [3, 'wrCol3']].map(([n, l]) => mi(`data-cols="${n}"`, h(t(l)))).join('')}${mi('data-cols="2r"', h(t('wrCol2Line')))}`)}
     <span class="wr-note" dir="ltr">${W}" × ${H}"</span>`)
    + group(t('wrDirection'), `<div class="wr-row">
      <button type="button" class="wr-b wr-wide${L.dir === 'rtl' ? ' on' : ''}" data-docdir="rtl">${h(t('mxRtl'))}</button>
      <button type="button" class="wr-b wr-wide${L.dir === 'ltr' ? ' on' : ''}" data-docdir="ltr">${h(t('mxLtr'))}</button></div>`);
}
function fieldMenu(he, en) {
  return `<div class="wr-mh">${h(t('wrFieldsHe'))}</div>${he.map((k) => mi(`data-field="${h(k)}"`, `«${h(k)}»`)).join('')}
    <div class="wr-mh">${h(t('wrFieldsEn'))}</div>${en.map((k) => mi(`dir="ltr" data-field="${h(k)}"`, `«${h(k)}»`)).join('')}`;
}
function ribbonMail(c, vr) {
  return group(t('wrStartGroup'), big('wr-rcp', '👥', t('wrSelectRcp')) + `<span class="wr-note">${h(t('mmCount', { n: rows.length }))}</span>`)
    + group(t('wrWriteGroup'), `${bigdd('«»', t('wrInsertField'), fieldMenu(TOKENS_HE, TOKENS_EN))}
      ${big('wr-win', '🪟', t('mxWindow'), D.ltr.window ? ' aria-pressed="true"' : '')}`)
    + group(t('wrPreviewGroup'), `${big('wr-preview', '«ABC»', t('wrPreview'), ltrEdit ? '' : ' aria-pressed="true"')}
      <div class="wr-nav">
        <button type="button" class="wr-b" id="mx-first" title="⏮">⏮</button><button type="button" class="wr-b" id="mx-prev">◀</button>
        <input id="wr-rec" type="number" min="1" max="${vr.length || 1}" value="${vr.length ? idx + 1 : 0}">
        <button type="button" class="wr-b" id="mx-next">▶</button><button type="button" class="wr-b" id="mx-last" title="⏭">⏭</button>
      </div>
      <div class="wr-who">${c ? `${h(nameOf(c))}${(byRow.get(keyOf(c)) || []).length ? ` · ⚠ ${(byRow.get(keyOf(c)) || []).map((k) => h(t(PROB_LABEL[k]))).join(', ')}` : ''}
        ${c.contact_id && !c._ext ? ` · <button type="button" class="linkish small" data-card="${h(c.contact_id)}">${h(t('mxOpenCard'))}</button>` : ''}
        · <button type="button" class="linkish small" id="mx-skip">${h(t('mxSkipOne'))}</button>` : h(t('mmNoRecords'))}
        ${skipIds.size ? ` · <button type="button" class="linkish small" id="mx-unskip">${h(t('mxUnskip', { n: skipIds.size }))}</button>` : ''}</div>`);
}
function ribbonFields() {
  const F = D.ltr.reps?.don || {};
  const camps = allCampaigns().map((c) => c.name);
  return group(t('wrPersonal'), bigdd('«»', t('wrFieldsBtn'), fieldMenu(TOKENS_HE, TOKENS_EN)))
    + group(t('wrDonations'), `${big('wr-rep-don', '🔁', t('wrRepRow'))}
      ${bigdd('«»', t('wrFieldsBtn'), fieldMenu(DON_TOKENS, DON_TOKENS_EN))}
      ${bigdd('Σ', t('wrTotals'), fieldMenu(TOTAL_TOKENS, TOTAL_TOKENS_EN))}
      ${bigdd('⚙', t('wrFilter'), `<div class="wr-form" id="wr-don-filter">
        <label>${h(t('wrFCamp'))}<select data-f="camp"><option value="link"${!F.camp || F.camp === 'link' ? ' selected' : ''}>${h(t('wrFCampLink'))}</option>
          <option value="all"${F.camp === 'all' ? ' selected' : ''}>${h(t('wrFCampAll'))}</option>${camps.map((n) => `<option${F.camp === n ? ' selected' : ''}>${h(n)}</option>`).join('')}</select></label>
        <label>${h(t('rcFrom'))}<input type="date" data-f="from" value="${h(F.from || '')}"></label>
        <label>${h(t('rcTo'))}<input type="date" data-f="to" value="${h(F.to || '')}"></label>
        <label class="check"><input type="checkbox" data-f="unpaid"${F.unpaid ? ' checked' : ''}> ${h(t('wrFUnpaid'))}</label>
        <label>${h(t('wrFOrder'))}<select data-f="order"><option value="asc">${h(t('wrFAsc'))}</option><option value="desc"${F.order === 'desc' ? ' selected' : ''}>${h(t('wrFDesc'))}</option></select></label>
      </div>`)}`)
    + `<div class="wr-group wr-soon"><div class="wr-gbody"><span class="wr-note">${h(t('wrMoreLists'))}</span></div><div class="wr-glabel">&nbsp;</div></div>`;
}
function ribbonTable() {
  return group(t('wrRowsCols'), `<div class="wr-col">
      <button type="button" class="wr-b wr-wide" data-tbl="rowAbove">⬆ ${h(t('wrRowAbove'))}</button>
      <button type="button" class="wr-b wr-wide" data-tbl="rowBelow">⬇ ${h(t('wrRowBelow'))}</button></div>
      <div class="wr-col">
      <button type="button" class="wr-b wr-wide" data-tbl="colRight">➡ ${h(t('wrColRight'))}</button>
      <button type="button" class="wr-b wr-wide" data-tbl="colLeft">⬅ ${h(t('wrColLeft'))}</button></div>
      ${bigdd('✖', t('wrDelete'), `${mi('data-tbl="delRow"', h(t('wrDelRow')))}${mi('data-tbl="delCol"', h(t('wrDelCol')))}${mi('data-tbl="delTable"', h(t('wrDelTable')))}`)}`)
    + group(t('wrMerge'), `<div class="wr-col"><button type="button" class="wr-b wr-wide" data-tbl="merge">⊞ ${h(t('wrMergeNext'))}</button>
      <button type="button" class="wr-b wr-wide" data-tbl="split">⊟ ${h(t('wrSplit'))}</button></div>`)
    + group(t('wrRowsKind'), `<div class="wr-col"><button type="button" class="wr-b wr-wide" data-tbl="header">▤ ${h(t('wrHeaderRow'))}</button>
      <button type="button" class="wr-b wr-wide" data-tbl="repeat">🔁 ${h(t('wrRepRow'))}</button></div>`)
    + group(t('wrTblStyle'), `${bigdd('▦', t('wrBorders'), `${mi('data-tbl="bAll"', h(t('wrBAll')))}${mi('data-tbl="bNone"', h(t('wrBNone')))}${mi('data-tbl="bOut"', h(t('wrBOut')))}`)}
      ${bigdd('🎨', t('wrShading'), `${SHADES.map((c) => `<button type="button" class="wr-sw" data-shade="${c}" style="background:${c}"></button>`).join('')}${mi('data-shade=""', h(t('wrNoColor')))}`)}`);
}
function ribbonImg() {
  const w = selImg ? (parseFloat(selImg.style.width) || Math.round((selImg.offsetWidth / PX) * 100) / 100) : 3;
  const fl = selImg?.style.float || '';
  return group(t('wrPicSize'), `<label class="wr-lbl">${h(t('mxWidth'))} (in)<input type="number" id="wr-img-w" min="0.3" max="20" step="0.1" value="${w}"></label>`)
    + group(t('wrWrap'), `<div class="wr-col">
      <button type="button" class="wr-b wr-wide${!fl && selImg?.style.display !== 'block' ? ' on' : ''}" data-imgwrap="inline">▭ ${h(t('wrWrapInline'))}</button>
      <button type="button" class="wr-b wr-wide${fl === 'right' ? ' on' : ''}" data-imgwrap="right">⇥ ${h(t('wrWrapRight'))}</button>
      <button type="button" class="wr-b wr-wide${fl === 'left' ? ' on' : ''}" data-imgwrap="left">⇤ ${h(t('wrWrapLeft'))}</button></div>
      <button type="button" class="wr-b wr-wide${selImg?.style.display === 'block' ? ' on' : ''}" data-imgwrap="center">≡ ${h(t('wrWrapCenter'))}</button>`)
    + group(t('wrDelete'), big('wr-img-del', '🗑', t('wrDelPic')));
}

/** די בלעטער הינטער'ן טעקסט (לאָגאָ, פענצטער, אונטערשריפט, סימן מים...) */
function sheetsHtml(n, c) {
  const [, H] = letterDims(D);
  return Array.from({ length: n }, (_, i) => `<div class="wr-sheet" style="top:${i * (H + GAP)}in">${letterHtml(D, c, { edit: true, cont: i, bodyOverride: '' })}</div>`).join('');
}
function wordDocHtml(c, ro) {
  const L = D.ltr;
  const G = letterGeo(D);
  const body = resolveImgs(tokensToChips(cleanHtml(L.html))).trim() || '<p><br></p>';
  return `<div class="wr-doc" data-n="1" style="width:${G.W}in;height:${G.H}in">
      <div class="wr-sheets">${sheetsHtml(1, c)}</div>
      <div class="wr-flow" style="left:${G.m.side}in;right:${G.m.side}in;top:${G.top1}in">
        <div class="wr-body mx-body-ed" contenteditable="${ro ? 'false' : 'true'}" spellcheck="false" dir="${L.dir === 'ltr' ? 'ltr' : 'rtl'}" style="${bodyStyle(L)}">${body}</div>
        ${sigHtml(D)}
      </div>
    </div>`;
}
function tabsHtml() {
  const ctx = wrCtx === 'table' ? [['table', 'wrTableTab']] : wrCtx === 'img' ? [['img', 'wrPicTab']] : [];
  return [...TABS, ...ctx].map(([k, lbl]) => `<button type="button" class="wr-tab${wrTab === k ? ' on' : ''}${ctx.some(([x]) => x === k) ? ' wr-ctx' : ''}" data-wrtab="${k}">${h(t(lbl))}</button>`).join('');
}
function ribbonFor(tab) {
  const vr = viewRows();
  return ({
    home: ribbonHome, settings: ribbonSettings, insert: ribbonInsert, design: () => ribbonDesign() + ribbonLayout(),
    mail: () => ribbonMail(vr[idx] || null, vr), fields: ribbonFields, table: ribbonTable, img: ribbonImg,
  }[tab] || ribbonHome)();
}
function wordStageHtml() {
  const ro = !canEditT(current());
  const vr = viewRows();
  if (idx >= vr.length) idx = Math.max(0, vr.length - 1);
  const c = vr[idx] || null;
  if ((wrTab === 'table' && wrCtx !== 'table') || (wrTab === 'img' && wrCtx !== 'img')) wrTab = 'home';
  const doc = ltrEdit ? wordDocHtml(c, ro) : `<div class="mx-pages">${letterPages(D, c, { edit: true }).join('')}</div>`;
  return `<div class="wr" dir="${document.documentElement.dir || 'rtl'}">
    <div class="wr-tabs">
      <span class="wr-qat">
        ${dd('wr-savedd', '<span class="wr-q-ic">💾</span>▾', t('wrSave'), `${mi('data-wcmd="save"', `💾 ${h(t('wrSave'))} <span class="muted small">Ctrl+S</span>`)}${mi('id="wr-saveas"', `${h(t('wrSaveAs'))} <span class="muted small">F12</span>`)}`)}
        <button type="button" class="wr-q" data-wcmd="undo" title="${h(t('wrUndo'))} (Ctrl+Z)">↶</button>
        <button type="button" class="wr-q" data-wcmd="redo" title="${h(t('wrRedo'))} (Ctrl+Y)">↷</button>
        <span class="wr-qsep"></span>
        <button type="button" class="wr-q" id="wr-print" title="${h(t('wrPrint'))} (Ctrl+P)">🖨</button>
        <button type="button" class="wr-q wr-q-txt" id="wr-finish" title="${h(t('wrFinish'))}">⎙ ${h(t('wrFinish'))}</button>
      </span>
      <span class="wr-tabnames">${tabsHtml()}</span>
    </div>
    <div class="wr-ribbon"${ro || (!ltrEdit && !['mail', 'settings'].includes(wrTab)) ? ' inert' : ''}>${ribbonFor(wrTab)}</div>
    ${ltrEdit ? '' : `<div class="wr-previewbar">👁 ${h(t('wrPreviewOn'))} <button type="button" class="btn small-btn" id="wr-back-edit">✏️ ${h(t('wrBackToEdit'))}</button></div>`}
    <div class="mm-canvas wr-canvas" id="mm-canvas" dir="ltr"><div class="wr-scaler">${doc}</div></div>
    <div class="wr-status">
      <span id="wr-pages">${h(t('wrPageOf', { i: 1, n: 1 }))}</span>
      <span id="wr-words"></span>
      <span id="wr-painter-note">${painter ? `🖌 ${h(t('wrPainterOn'))}` : ''}</span>
      <span class="spacer"></span>
      <span class="mx-zoom"><button type="button" class="wr-b" id="mx-zoom-out" title="−">−</button>
      <input type="range" id="wr-zoom" min="50" max="300" step="10" value="${Math.round(zoom * 100)}">
      <button type="button" class="wr-b" id="mx-zoom-in" title="+">+</button>
      <button type="button" class="linkish small" id="mx-zoom-fit" title="${h(t('mxZoomFit'))}"><span id="mx-zoom-val">${Math.round(zoom * 100)}%</span></button></span>
    </div>
  </div>`;
}
function fitWord() {
  const canvas = $('#mm-canvas');
  const sc = $('.wr-scaler', canvas);
  const doc = sc?.firstElementChild;
  if (!doc) return;
  fitIn(canvas);
  const avail = canvas.clientWidth - 40;
  const fit = Math.min(1.3, avail / doc.offsetWidth);
  const scale = fit * zoom;
  doc.style.transform = `scale(${scale})`;
  doc.style.transformOrigin = 'top left';
  sc.style.width = `${doc.offsetWidth * scale}px`;
  sc.style.height = `${doc.offsetHeight * scale}px`;
  canvas.dataset.scale = scale;
  const lbl = $('#mx-zoom-val');
  if (lbl) lbl.textContent = `${Math.round(zoom * 100)}%`;
  const zr = $('#wr-zoom');
  if (zr) zr.value = Math.round(zoom * 100);
  if (!ltrEdit) {
    const n = $$('.mx-page', doc).length;
    const p = $('#wr-pages');
    if (p) p.textContent = t('wrPageOf', { i: 1, n });
  }
}
/** צעטיילן אויף בלעטער — פונקט ווי ביים דרוקן: וואס פאסט נישט אריין גייט אריבער צום קומענדיגן בלאט */
function layoutPages() {
  const doc = $('#mm-canvas .wr-doc');
  if (!doc) return;
  const flow = $('.wr-flow', doc);
  const body = $('.wr-body', doc);
  const G = letterGeo(D);
  const scale = Number($('#mm-canvas').dataset.scale || 1);
  $$('[data-wrsp]', flow).forEach((el) => el.remove());
  $$('[data-pbm]', flow).forEach((el) => {
    el.style.marginTop = el.dataset.pbm;
    el.removeAttribute('data-pbm');
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
  const fr = () => flow.getBoundingClientRect().top;
  const topOf = (el) => (el.getBoundingClientRect().top - fr()) / scale + G.top1 * PX;
  const bottomOf = (el) => {
    let b = el.getBoundingClientRect().bottom;
    el.querySelectorAll?.('img').forEach((im) => { b = Math.max(b, im.getBoundingClientRect().bottom); });
    return (b - fr()) / scale + G.top1 * PX;
  };
  const limit = (p) => (p * (G.H + GAP) + G.H - (p === 0 ? G.bottom1 : G.bottom)) * PX;
  const pageTop = (p) => (p * (G.H + GAP) + G.topN) * PX;
  let page = 0;
  let onPage = 0;
  let force = false;
  const push = (el) => {
    const y = topOf(el);
    page += 1;
    onPage = 0;
    const target = pageTop(page);
    el.dataset.pbm = el.style.marginTop || '';
    const cur = parseFloat(getComputedStyle(el).marginTop) || 0;
    el.style.marginTop = `${cur + target - y}px`;
    const y2 = topOf(el);
    if (Math.abs(y2 - target) > 0.5) el.style.marginTop = `${parseFloat(el.style.marginTop) + target - y2}px`;
  };
  const items = [...body.children, ...$$(':scope > .mx-sig', flow)];
  items.forEach((el) => {
    if (isPgBrk(el)) { force = true; return; }
    if (el.tagName === 'TABLE' && !force) {
      // א טאבעלע: שורה ביי שורה (ווי ביים דרוקן)
      const bodyRows = [...el.rows].filter((r) => r.parentElement.tagName !== 'THEAD');
      const head = el.tHead ? el.tHead.getBoundingClientRect().height / scale : 0;
      const firstBottom = bodyRows[0] ? bottomOf(bodyRows[0]) : bottomOf(el);
      if (onPage && firstBottom > limit(page) + 2) push(el);
      onPage += 1;
      bodyRows.forEach((r, i) => {
        if (i === 0) return;
        const y = topOf(r);
        if (bottomOf(r) > limit(page) + 2) {
          page += 1;
          const target = pageTop(page) + head;
          const sp = document.createElement('tr');
          sp.setAttribute('data-wrsp', '1');
          sp.contentEditable = 'false';
          sp.innerHTML = `<td colspan="99" style="border:none;padding:0;height:${Math.max(0, target - y)}px"></td>`;
          r.before(sp);
        }
      });
      return;
    }
    const mb = parseFloat(getComputedStyle(el).marginBottom) || 0; // אזוי ווי ביים דרוקן
    if (force || (onPage && bottomOf(el) + mb > limit(page) + 2)) push(el);
    force = false;
    onPage += 1;
  });
  const n = page + 1;
  if (Number(doc.dataset.n) !== n) {
    doc.dataset.n = n;
    const vr = viewRows();
    $('.wr-sheets', doc).innerHTML = sheetsHtml(n, vr[idx] || null);
    doc.style.height = `${n * G.H + (n - 1) * GAP}in`;
    fitWord();
    wireDrag();
  }
  // וואו דער קורסאר איז
  let at = 1;
  const s = window.getSelection();
  if (s.rangeCount && body.contains(s.anchorNode)) {
    const r = s.getRangeAt(0).getBoundingClientRect();
    const d = doc.getBoundingClientRect();
    if (r.height) at = Math.min(n, Math.floor((r.top - d.top) / scale / ((G.H + GAP) * PX)) + 1);
  }
  const p = $('#wr-pages');
  if (p) p.textContent = t('wrPageOf', { i: at, n });
  const w = $('#wr-words');
  if (w) w.textContent = t('wrWords', { n: (body.innerText.match(/\S+/g) || []).length });
}

const wbody = () => $('#mm-canvas .wr-body');
const cellAt = () => {
  const b = wbody();
  const n = wrRange?.startContainer;
  if (!b || !n || !b.contains(n)) return null;
  const el = n.nodeType === 1 ? n : n.parentElement;
  const c = el.closest('td, th');
  return c && b.contains(c) ? c : null;
};
/** דער ריבן ווייזט וואס איז אויסגעקליבן (שריפט, גרייס, B/I/U); א טאבעלע → די לשונית "טבלה" */
function syncRibbon() {
  const body = wbody();
  const s = window.getSelection();
  if (!body || !s.rangeCount || !body.contains(s.anchorNode)) return;
  wrRange = s.getRangeAt(0).cloneRange();
  const node = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
  const cs = getComputedStyle(node);
  const f = $('#wr-font');
  if (f && document.activeElement !== f) {
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if ([...f.options].some((o) => o.value === fam)) f.value = fam;
  }
  const z = $('#wr-size');
  if (z && document.activeElement !== z) {
    const pt = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
    if (![...z.options].some((o) => Number(o.value) === pt)) z.append(new Option(String(pt)));
    z.value = String(pt);
  }
  ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList', 'justifyRight', 'justifyCenter', 'justifyLeft', 'justifyFull'].forEach((cmd) => {
    const b = $(`.wr-ribbon [data-wcmd="${cmd}"]`);
    if (b) { let on = false; try { on = document.queryCommandState(cmd); } catch { /* */ } b.classList.toggle('on', on); }
  });
  const ctx = selImg && body.contains(selImg) ? 'img' : cellAt() ? 'table' : '';
  if (ctx !== wrCtx) {
    const was = wrCtx;
    wrCtx = ctx;
    if (ctx) setTab(ctx);
    else if (wrTab === was) setTab('home');
    else renderTabs();
  }
}
function renderTabs() {
  const tn = $('#mx-stage .wr-tabnames');
  if (!tn) return;
  tn.innerHTML = tabsHtml();
  $$('[data-wrtab]', tn).forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.onclick = () => setTab(b.dataset.wrtab);
  });
}
function setTab(tab) {
  wrTab = tab;
  if (!['table', 'img'].includes(tab)) { try { localStorage.setItem('khal-wr-tab', tab); } catch { /* */ } }
  const r = $('#mx-stage .wr-ribbon');
  if (!r) return;
  r.innerHTML = ribbonFor(tab);
  r.inert = !canEditT(current()) || (!ltrEdit && !['mail', 'settings'].includes(tab));
  renderTabs();
  wireRibbon($('#mailmerge-main'));
}
let wrGlobal = false;
function wireWordGlobal() {
  if (wrGlobal) return;
  wrGlobal = true;
  document.addEventListener('selectionchange', syncRibbon);
  document.addEventListener('click', (e) => {
    $$('.wr-dd[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });
  // קיצורים ווי אין Word (נאר ווען דער עדיטאר איז אפן)
  document.addEventListener('keydown', (e) => {
    if (!$('#mx-stage .wr') || view !== 'edit' || D?.kind !== 'ltr') return;
    if ($('dialog[open]') && !$('dialog[open].wr-find-dlg')) return;
    const k = e.key.toLowerCase();
    const ctl = e.ctrlKey || e.metaKey;
    if (k === 'f12') { e.preventDefault(); saveAsDialog(); }
    else if (ctl && k === 's') { e.preventDefault(); saveCmd(); }
    else if (ctl && k === 'p') { e.preventDefault(); printDialog('draft'); }
    else if (ctl && (k === 'f' || k === 'h')) { e.preventDefault(); findDialog(k === 'h'); }
    else if (ctl && k === 'k' && ltrEdit) { e.preventDefault(); linkDialog(); }
    else if (k === 'escape' && painter) { painter = null; updatePainter(); }
  });
  window.addEventListener('beforeunload', (e) => {
    if (!D || view !== 'edit') return;
    if (['dirty', 'saving', 'unnamed'].includes(saveState)) {
      if (saveState === 'dirty') persist().catch(() => {});
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
function restoreSel(body) {
  body.focus();
  if (wrRange && body.contains(wrRange.startContainer)) {
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(wrRange);
  }
}
/** די פסקאות וואס זענען אויסגעקליבן */
function selBlocks(body) {
  const r = wrRange;
  if (!r) return [];
  return [...body.children].filter((k) => r.intersectsNode(k));
}
function setDrawer(open) {
  wrDrawer = open;
  const dr = $('#mailmerge-main .wr-drawer');
  if (dr) dr.hidden = !open;
}
function wireWord(main) {
  wireWordGlobal();
  const st = $('#mx-stage', main);
  renderTabs();
  $('#wr-back-edit', st)?.addEventListener('click', () => { ltrEdit = true; refreshStage(); });
  const zr = $('#wr-zoom', st);
  if (zr) zr.oninput = () => setZoom(Number(zr.value) / 100);
  // דער אויבערשטער שטרייף (שמור, בטל, הדפסה...)
  const qat = $('.wr-qat', st);
  $$('button, summary', qat).forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  $$('[data-wcmd]', qat).forEach((b) => { b.onclick = () => qatCmd(b.dataset.wcmd); });
  $('#wr-saveas', qat).onclick = () => { $('.wr-savedd', qat).open = false; saveAsDialog(); };
  $('#wr-print', qat).onclick = () => printDialog('draft');
  $('#wr-finish', qat).onclick = () => printDialog('all');
  wireRibbon(main);
  const body = $('.wr-body', st);
  if (!body) { fitWord(); return; }
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* */ }
  const save = () => {
    if (!body.firstElementChild && !body.textContent.trim()) body.innerHTML = '<p><br></p>';
    normalizeTop(body);
    D.ltr.html = cleanHtml(chipsToTokens(body));
    scheduleSave();
    clearTimeout(wrTimer);
    wrTimer = setTimeout(() => {
      layoutPages();
      computeProblems();
      const bar = $('#mx-bar-wrap');
      if (bar) { bar.innerHTML = barHtml(); wireBar(main); }
    }, 150);
  };
  body._save = save;
  body.addEventListener('input', save);
  body.addEventListener('paste', (e) => {
    e.preventDefault();
    pasteInto(body, e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'));
  });
  body.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'enter') { e.preventDefault(); insertPageBreak(body); }
    else if ((k === 'backspace' || k === 'delete') && removeBreakAt(body, k === 'backspace')) { e.preventDefault(); save(); }
    else if ((k === 'backspace' || k === 'delete') && selImg && body.contains(selImg)) { e.preventDefault(); selImg.remove(); selImg = null; save(); syncRibbon(); }
    else if (k === 'tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const c = cellAt();
      // אין א טאבעלע: צום קומענדיגן תא (ווי אין Word)
      if (c) {
        const cells = [...c.closest('table').querySelectorAll('td, th')];
        let nx = cells[cells.indexOf(c) + (e.shiftKey ? -1 : 1)];
        if (!nx && !e.shiftKey) { tableOp('rowBelow'); nx = c.closest('tr').nextElementSibling?.cells[0]; }
        if (nx) { const r = document.createRange(); r.selectNodeContents(nx); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      } else document.execCommand('insertText', false, '    ');
    }
  });
  // א בילד: קליקן = אויסקלייבן (די לשונית "תמונה")
  body.addEventListener('mousedown', (e) => {
    const im = e.target.closest?.('img');
    $$('img.wr-selimg', body).forEach((x) => x.classList.remove('wr-selimg'));
    selImg = im && body.contains(im) ? im : null;
    if (selImg) {
      selImg.classList.add('wr-selimg');
      const r = document.createRange();
      r.selectNode(selImg);
      setTimeout(() => { const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); syncRibbon(); }, 0);
    }
  });
  body.addEventListener('mouseup', () => { if (painter) setTimeout(applyPainter, 0); });
  // נאך די בילדער/שריפטן — נאכאמאל צעטיילן
  fitWord();
  layoutPages();
  (document.fonts?.ready || Promise.resolve()).then(() => { layoutPages(); fitWord(); });
  $$('img', st).forEach((im) => { if (!im.complete) im.addEventListener('load', () => layoutPages(), { once: true }); });
  ensureBodyImages();
}
/** בילדער אינעם טעקסט וואס זענען נאך נישט געלאדן (drv:) */
function ensureBodyImages() {
  const ids = [...String(D.ltr.html || '').matchAll(/src="drv:([\w-]+)"/g)].map((m) => m[1]);
  if (D.ltr.wm?.img && isDrv(D.ltr.wm.img)) ids.push(String(D.ltr.wm.img).slice(4));
  const missing = ids.filter((id) => !imageOf(`drv:${id}`));
  if (!missing.length) return;
  fetchImages(missing).then(() => { if (missing.some((id) => imageOf(`drv:${id}`))) refreshStage(); });
}
function qatCmd(cmd) {
  const body = wbody();
  if (cmd === 'save') { $('.wr-savedd')?.removeAttribute('open'); saveCmd(); return; }
  if (body) { restoreSel(body); document.execCommand(cmd); body._save?.(); }
}

// ---------- שמירה / שמור בשם ----------
function saveCmd() {
  if (!canEditT(current())) return;
  if (!nz(D.name)) { saveAsDialog(); return; }
  persist().then(() => ui.toast(t('mxSavedAuto'))).catch((err) => ui.toast(ui.friendlyError(err), 'error'));
}
function saveAsDialog() {
  const dlg = dialog(`<h3>💾 ${h(t('wrSaveAs'))}</h3>
    <label class="mm-l">${h(t('mmDesignName'))}<input id="wrsa-name" value="${h(nz(D.name) ? `${D.name} (2)` : '')}" dir="auto"></label>
    <label class="mm-l">${h(t('mxVisibility'))}<select id="wrsa-vis"><option value="public"${D.meta?.visibility !== 'private' ? ' selected' : ''}>${h(t('mxPublic'))}</option><option value="private"${D.meta?.visibility === 'private' ? ' selected' : ''}>${h(t('mxPrivate'))}</option></select></label>
    ${D.template_id && openSnap ? `<p class="muted small">${h(t('wrSaveAsNote', { name: D.name }))}</p>` : ''}
    <div class="dialog-actions"><button type="button" class="btn primary" id="wrsa-ok">${h(t('saveBtn'))}</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  const inp = $('#wrsa-name', dlg);
  inp.focus();
  inp.select();
  const go = async () => {
    const name = nz(inp.value);
    if (!name) { inp.focus(); return; }
    const vis = $('#wrsa-vis', dlg).value;
    dlg.close();
    try { await saveAs(name, vis); ui.toast(t('mxSavedAuto')); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  $('#wrsa-ok', dlg).onclick = go;
  inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
}
/** א נייער עיצוב מיט די טוישן; דער אלטער — צוריק ווי ער איז געווען ביים עפענען (ווי אין Word) */
async function saveAs(name, vis) {
  clearTimeout(saveTimer);
  again = false;
  while (saving) await saving.catch(() => {}); // eslint-disable-line no-await-in-loop
  const orig = current();
  const snap = openSnap;
  const ndoc = JSON.parse(JSON.stringify(D));
  ndoc.template_id = '';
  ndoc.name = name;
  ndoc.meta = { ...(D.meta || {}), visibility: vis };
  if (!canEditT(orig) || !orig) ndoc.meta.editors = [];
  D = ndoc;
  saving = persistNow().finally(() => { saving = null; });
  await saving;
  if (orig && snap && canEditT(orig) && JSON.stringify(snap) !== JSON.stringify(orig)) {
    await saveRecord('MailTemplates', 'template_id', snap);
    Object.keys(orig).forEach((k) => { if (!(k in snap)) delete orig[k]; });
    Object.assign(orig, snap);
  }
  openSnap = { ...current() };
  renderMailMerge();
}
/** איידער מ'גייט אוועק פון Mail Merge (אן אנדער בלאט אינעם אתר) */
export function mailMergeCanLeave() {
  if (!D || view !== 'edit') return true;
  if (saveState === 'unnamed' && !confirm(t('mxLeaveUnsaved'))) return false;
  if (saveState === 'dirty') persist().catch(() => {});
  return true;
}

// ---------- דרוקן ----------
function printDialog(which = 'draft') {
  const vr = viewRows();
  const c = vr[idx];
  const red = worst() >= 3;
  const dlg = dialog(`<h3>🖨 ${h(t('wrPrint'))}</h3>
    <div class="wr-pd">
      <b>${h(t('wrPdWhat'))}</b>
      <label class="check"><input type="radio" name="wrpd" value="draft"${which === 'draft' ? ' checked' : ''}> ${h(t('wrPdDraft'))}</label>
      <label class="check"><input type="radio" name="wrpd" value="one"${which === 'one' ? ' checked' : ''}${c ? '' : ' disabled'}> ${h(t('wrPdOne'))}${c ? ` — ${h(nameOf(c))}` : ''}</label>
      <label class="check"><input type="radio" name="wrpd" value="all"${which === 'all' ? ' checked' : ''}${rows.length ? '' : ' disabled'}> ${h(t('wrPdAll', { n: rows.length }))}</label>
      <div class="mx-range wr-pd-range">${h(t('mxRange'))} <input type="number" id="mx-from" min="1" value="1"> – <input type="number" id="mx-to" min="1" value="${rows.length || 1}"></div>
      ${red ? `<div class="mx-redwarn">⚠ ${h(t('mxRedWarn'))}</div>` : ''}
      ${D.ltr.rcSlot ? `<p class="mx-pending small">🧾 ${h(t('wrRcFromReceipts'))} <button type="button" class="btn small-btn" id="wrpd-rc">${h(t('wrOpenReceipts'))}</button></p>` : ''}
      ${D.ltr.page && D.ltr.page !== 'letter' ? `<p class="muted small">📄 ${h(t('wrPdPaper', { size: letterDims(D).join('" × ') }))}"</p>` : ''}
    </div>
    <div class="dialog-actions">
      <button type="button" class="btn primary" id="wrpd-print">🖨 ${h(t('wrPrint'))}</button>
      <button type="button" class="btn" id="wrpd-pdf">⬇ PDF</button>
      ${D.src.email ? `<button type="button" class="btn" id="wrpd-mail">📧 ${h(t('mxSendEmail'))}</button>` : ''}
      ${D.ltr.pairEnv ? `<button type="button" class="btn" id="wrpd-pair">✉+📄 ${h(t('mxPairBtn'))}</button>` : ''}
      <button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  const what = () => $('input[name=wrpd]:checked', dlg)?.value || 'draft';
  const sync = () => { $('.wr-pd-range', dlg).hidden = what() !== 'all'; const m = $('#wrpd-mail', dlg); if (m) m.disabled = what() !== 'all'; const p = $('#wrpd-pair', dlg); if (p) p.disabled = what() !== 'all'; };
  $$('input[name=wrpd]', dlg).forEach((r) => { r.onchange = sync; });
  sync();
  const run = async (how) => {
    const w = what();
    if (w === 'all' && how !== 'pdf' && how !== 'print') {
      // די אלטע פונקציעס לייענען #mx-from / #mx-to
      if (how === 'mail') await sendEmails(); else await outputPair();
      dlg.close();
      return;
    }
    // א בריוו מיט א קבלה: די קבלות קומען נאר פונעם בלאט פון די קבלות (נומערן, יומן)
    if (D.ltr.rcSlot && w !== 'draft') { ui.toast(t('wrRcFromReceipts'), 'error'); return; }
    let pages;
    if (w === 'draft') pages = letterPages(D, null, { draft: true });
    else if (w === 'one') pages = letterPages(D, c);
    else {
      if (!confirmRed()) return;
      pages = pagesFor(D, rangeRows());
    }
    dlg.close();
    const size = pageSize(D);
    if (how === 'print') printPages(pages, size);
    else await downloadPdf(pages, size, w === 'draft' ? `${D.name || 'letter'} – draft` : D.name);
  };
  $('#wrpd-rc', dlg)?.addEventListener('click', () => { dlg.close(); openReceipts({ letter: D.template_id }); });
  $('#wrpd-print', dlg).onclick = () => run('print');
  $('#wrpd-pdf', dlg).onclick = () => run('pdf');
  $('#wrpd-mail', dlg)?.addEventListener('click', () => run('mail'));
  $('#wrpd-pair', dlg)?.addEventListener('click', () => run('pair'));
}

// ---------- טעקסט ----------
/** טעקסט וואס ליגט גלייך אין בלאט (נישט אין א פסקה) → אריין אין א <p>, כדי מ'זאל קענען צעטיילן אויף בלעטער */
function normalizeTop(body) {
  const inline = (n) => (n.nodeType === 3 ? n.textContent.length > 0 : n.nodeType === 1 && /^(B|I|U|SPAN|FONT|STRONG|EM|SUB|SUP|BR|A|IMG)$/.test(n.tagName));
  if (![...body.childNodes].some((n) => inline(n) && (n.nodeType !== 3 || n.textContent.trim()))) return;
  const s = window.getSelection();
  const an = s.anchorNode;
  const ao = s.anchorOffset;
  let cur = null;
  [...body.childNodes].forEach((n) => {
    if (inline(n)) {
      if (!cur) { cur = document.createElement('p'); n.before(cur); }
      cur.append(n);
    } else cur = null;
  });
  [...body.querySelectorAll(':scope > p')].forEach((pp) => { if (!pp.textContent.trim() && !pp.querySelector('br, .mx-tok, img')) pp.remove(); });
  if (an && body.contains(an)) { try { s.collapse(an, ao); } catch { /* */ } }
}
/** {שדה} וואס איז אריינגעקומען אלס טעקסט → «שדה» */
function chipify(body) {
  const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.mx-tok') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes = [];
  while (w.nextNode()) if (/\{[^{}\s]{1,24}\}/.test(w.currentNode.textContent)) nodes.push(w.currentNode);
  let last = null;
  nodes.forEach((n) => {
    const tmp = document.createElement('span');
    tmp.innerHTML = tokensToChips(h(n.textContent));
    last = tmp.lastChild;
    n.replaceWith(...tmp.childNodes);
  });
  if (last) { const s = window.getSelection(); s.removeAllRanges(); const r = document.createRange(); r.setStartAfter(last); s.addRange(r); }
}
function pasteInto(body, html, txt) {
  if (html) {
    // פון Word: אן "<!-- -->", אן די Word סטיילס
    const d = new DOMParser().parseFromString(String(html).replace(/<!--[\s\S]*?-->/g, ''), 'text/html');
    // פון דעם עדיטאר אליין: נישט מיטנעמען די צעטיילונג אויף בלעטער
    d.querySelectorAll('[data-wrsp]').forEach((x) => x.remove());
    d.querySelectorAll('[data-pbm]').forEach((x) => { x.style.marginTop = x.getAttribute('data-pbm'); });
    d.querySelectorAll('img').forEach((im) => { if (!/^data:image\//.test(im.getAttribute('src') || '')) im.remove(); });
    document.execCommand('insertHTML', false, cleanHtml(d.body.innerHTML));
  } else document.execCommand('insertText', false, txt || '');
  chipify(body);
  normalizeTop(body);
  // בילדער וואס זענען אריינגעקומען מיטן טעקסט → אין דרייב
  $$('img', body).forEach((im) => { if (!im.dataset.drv && !im.dataset.up && /^data:/.test(im.src)) { im.dataset.up = '1'; uploadInline(im); } });
  body._save?.();
}
async function uploadInline(im) {
  const v = await storeImage(im.src, 'letter');
  delete im.dataset.up;
  if (isDrv(v)) { im.dataset.drv = v.slice(4); wbody()?._save?.(); } else { im.remove(); ui.toast(t('wrImgNoHelper'), 'error'); wbody()?._save?.(); }
}
/** Backspace / Delete ביי א "מעבר עמוד" — אים אויסמעקן (ווי אין Word) */
function removeBreakAt(body, back) {
  const s = window.getSelection();
  if (!s.rangeCount || !s.isCollapsed) return false;
  const r = s.getRangeAt(0);
  let blk = r.startContainer;
  while (blk && blk.parentNode !== body) blk = blk.parentNode;
  if (!blk || blk === body) return false;
  const probe = document.createRange();
  probe.selectNodeContents(blk);
  if (back) probe.setEnd(r.startContainer, r.startOffset); else probe.setStart(r.startContainer, r.startOffset);
  if (probe.toString().length || probe.cloneContents().querySelector('.mx-tok')) return false;
  const nb = back ? blk.previousElementSibling : blk.nextElementSibling;
  if (!isPgBrk(nb)) return false;
  nb.remove();
  return true;
}
function insertPageBreak(body) {
  restoreSel(body);
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  r.deleteContents();
  // די פסקה וואו דער קורסאר איז: וואס נאך אים גייט אויפן נייעם בלאט
  let blk = r.startContainer;
  while (blk && blk.parentNode !== body) blk = blk.parentNode;
  const brk = document.createElement('div');
  brk.setAttribute('style', 'page-break-before:always');
  const np = document.createElement('p');
  if (blk && blk !== body) {
    const tail = document.createRange();
    tail.setStart(r.startContainer, r.startOffset);
    tail.setEnd(blk, blk.childNodes.length);
    np.append(tail.extractContents());
    blk.after(brk, np);
    if (!blk.textContent.trim() && !blk.querySelector('.mx-tok, img')) blk.innerHTML = '<br>';
  } else body.append(brk, np);
  if (!np.textContent.trim() && !np.querySelector('.mx-tok, img')) np.innerHTML = '<br>';
  const c = document.createRange();
  c.setStart(np, 0);
  c.collapse(true);
  sel.removeAllRanges();
  sel.addRange(c);
  body._save?.();
}
/** די טעקסט-נאודס אינעם אויסגעקליבענעם טייל (צעשניטן ביי די ראנדן) */
function selectedTextNodes(body) {
  const r = wrRange;
  if (!r || r.collapsed) return [];
  if (r.startContainer.nodeType === 3 && r.startOffset > 0) {
    const tail = r.startContainer.splitText(r.startOffset);
    if (r.endContainer === r.startContainer) r.setEnd(tail, r.endOffset - r.startOffset);
    r.setStart(tail, 0);
  }
  if (r.endContainer.nodeType === 3 && r.endOffset < r.endContainer.length) r.endContainer.splitText(r.endOffset);
  const out = [];
  const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; if (r.intersectsNode(n) && !n.parentElement.closest('.mx-tok') && n.textContent) out.push(n); }
  return out;
}
function changeCase(body, kind) {
  restoreSel(body);
  const nodes = selectedTextNodes(body);
  if (!nodes.length) return;
  const txt = nodes.map((n) => n.textContent).join('');
  let out;
  if (kind === 'lower') out = txt.toLowerCase();
  else if (kind === 'upper') out = txt.toUpperCase();
  else if (kind === 'title') out = txt.toLowerCase().replace(/(^|[\s(\-"'])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  else out = txt.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  let pos = 0;
  nodes.forEach((n) => { const len = n.textContent.length; n.textContent = out.slice(pos, pos + len); pos += len; });
  const r = document.createRange();
  r.setStart(nodes[0], 0);
  r.setEnd(nodes.at(-1), nodes.at(-1).length);
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
  body._save?.();
}
/** אן אייגענע סטייל אויפן אויסגעקליבענעם טעקסט (ווען עס איז נישטא קיין execCommand) */
function styleSelection(body, styles) {
  restoreSel(body);
  const nodes = selectedTextNodes(body);
  nodes.forEach((n) => {
    const p = n.parentElement;
    if (p.tagName === 'SPAN' && p.childNodes.length === 1 && p !== body) { Object.assign(p.style, styles); return; }
    const sp = document.createElement('span');
    Object.assign(sp.style, styles);
    n.replaceWith(sp);
    sp.append(n);
  });
  body._save?.();
}
// ---------- מברשת עיצוב ----------
function updatePainter() {
  $('#wr-painter')?.classList.toggle('on', Boolean(painter));
  const n = $('#wr-painter-note');
  if (n) n.textContent = painter ? `🖌 ${t('wrPainterOn')}` : '';
  wbody()?.classList.toggle('wr-painting', Boolean(painter));
}
function takePainter(body, sticky) {
  const s = window.getSelection();
  if (!s.rangeCount || !body.contains(s.anchorNode)) { restoreSel(body); }
  // דער ערשטער אות פונעם אויסגעקליבענעם טעקסט (ווי אין Word)
  const sel2 = window.getSelection();
  let node = sel2.rangeCount ? sel2.getRangeAt(0).startContainer : body;
  if (node.nodeType === 1 && sel2.rangeCount) node = node.childNodes[sel2.getRangeAt(0).startOffset] || node;
  if (node.nodeType === 1) { const tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); if (tw.nextNode()) node = tw.currentNode; }
  const el = node.nodeType === 1 ? node : node.parentElement;
  const cs = getComputedStyle(el);
  const hl = (() => { let x = el; while (x && x !== body) { const bg = getComputedStyle(x).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; x = x.parentElement; } return ''; })();
  painter = {
    sticky,
    st: {
      font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), pt: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2, color: cs.color,
      bold: Number(cs.fontWeight) >= 600, italic: cs.fontStyle === 'italic', underline: Boolean(el.closest('u')) || /underline/.test(cs.textDecorationLine), hl,
    },
  };
  updatePainter();
}
function applyPainter() {
  const body = wbody();
  const s = window.getSelection();
  if (!painter || !body || !s.rangeCount || s.isCollapsed || !body.contains(s.anchorNode)) return;
  wrRange = s.getRangeAt(0).cloneRange();
  const p = painter.st;
  const ex = (c, v = null, css = false) => { document.execCommand('styleWithCSS', false, css); document.execCommand(c, false, v); };
  ex('removeFormat');
  ex('fontName', p.font);
  ex('foreColor', p.color, true);
  if (p.hl) ex('hiliteColor', p.hl, true);
  if (p.bold) ex('bold');
  if (p.italic) ex('italic');
  if (p.underline) ex('underline');
  // די גרייס — צום סוף (דאס טוישט די עלעמענטן)
  ex('fontSize', '7');
  $$('font[size="7"]', body).forEach((x) => { const sp = document.createElement('span'); sp.style.fontSize = `${p.pt}pt`; sp.innerHTML = x.innerHTML; x.replaceWith(sp); });
  document.execCommand('styleWithCSS', false, false);
  if (!painter.sticky) painter = null;
  updatePainter();
  body._save?.();
}
// ---------- חיפוש והחלפה ----------
function findDialog(replace = false) {
  $('dialog.wr-find-dlg')?.close();
  const body = wbody();
  if (!body) return;
  const pre = window.getSelection().toString().slice(0, 80);
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet mx-dlg wr-find-dlg';
  dlg.innerHTML = `<h3>🔍 ${h(t('wrFindTitle'))}</h3>
    <label class="mm-l">${h(t('wrFindWhat'))}<input id="wrf-q" dir="auto" value="${h(pre)}"></label>
    <label class="mm-l"${replace ? '' : ' hidden'} id="wrf-rl">${h(t('wrReplaceWith'))}<input id="wrf-r" dir="auto"></label>
    <label class="check"><input type="checkbox" id="wrf-case"> ${h(t('wrMatchCase'))}</label>
    <p class="muted small" id="wrf-msg"></p>
    <div class="dialog-actions">
      <button type="button" class="btn primary" id="wrf-next">${h(t('wrFindNext'))}</button>
      <button type="button" class="btn" id="wrf-one">${h(t('wrReplace'))}</button>
      <button type="button" class="btn" id="wrf-all">${h(t('wrReplaceAll'))}</button>
      <button type="button" class="btn" data-x>${h(t('close'))}</button></div>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  $('[data-x]', dlg).onclick = () => dlg.close();
  dlg.show();
  const q = $('#wrf-q', dlg);
  q.focus();
  const msg = (m) => { $('#wrf-msg', dlg).textContent = m; };
  const showRep = () => { $('#wrf-rl', dlg).hidden = false; };
  const opts = () => ({ q: q.value, cs: $('#wrf-case', dlg).checked });
  const next = () => {
    const { q: s, cs } = opts();
    if (!s) return false;
    const r = findNext(body, s, cs);
    if (!r) { msg(t('wrNotFound')); return false; }
    msg('');
    return true;
  };
  $('#wrf-next', dlg).onclick = next;
  q.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
  $('#wrf-one', dlg).onclick = () => {
    showRep();
    const { q: s, cs } = opts();
    const cur = window.getSelection().toString();
    if (s && body.contains(window.getSelection().anchorNode) && (cs ? cur === s : cur.toLowerCase() === s.toLowerCase())) {
      document.execCommand('insertText', false, $('#wrf-r', dlg).value);
      body._save?.();
    }
    next();
  };
  $('#wrf-all', dlg).onclick = () => {
    showRep();
    const { q: s, cs } = opts();
    if (!s) return;
    const rep = $('#wrf-r', dlg).value;
    // פונעם אנהייב
    const r0 = document.createRange();
    r0.setStart(body, 0);
    r0.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(r0);
    let n = 0;
    while (n < 1000 && findNext(body, s, cs, false)) { document.execCommand('insertText', false, rep); n += 1; }
    body._save?.();
    msg(t('wrReplacedN', { n }));
  };
}
/** די קומענדיגע שטעלע וואו דער טעקסט קומט פאר (נאך'ן קורסאר); wrap = נאכאמאל פונעם אנהייב */
function findNext(body, q, cs, wrap = true) {
  const nodes = [];
  const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.mx-tok, [data-wrsp]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let all = '';
  while (w.nextNode()) { nodes.push([w.currentNode, all.length]); all += w.currentNode.textContent; }
  const hay = cs ? all : all.toLowerCase();
  const needle = cs ? q : q.toLowerCase();
  // וואו מיר זענען יעצט
  let from = 0;
  const s = window.getSelection();
  if (s.rangeCount && body.contains(s.focusNode)) {
    const r = s.getRangeAt(0);
    const hit = nodes.find(([n]) => n === r.endContainer);
    if (hit) from = hit[1] + r.endOffset;
    else { const pre = document.createRange(); pre.setStart(body, 0); pre.setEnd(r.endContainer, r.endOffset); from = pre.toString().length; }
  }
  let i = hay.indexOf(needle, from);
  if (i < 0 && wrap) i = hay.indexOf(needle);
  if (i < 0) return null;
  const at = (pos, end) => {
    for (let k = nodes.length - 1; k >= 0; k -= 1) {
      const [n, off] = nodes[k];
      if (off < pos || (end && off === pos && k > 0 && off + n.textContent.length > pos) || (!end && off <= pos)) {
        if (off <= pos && pos <= off + n.textContent.length) return [n, pos - off];
      }
    }
    return [nodes[0][0], 0];
  };
  const [sn, so] = at(i, false);
  const [en, eo] = at(i + needle.length, true);
  const r = document.createRange();
  r.setStart(sn, so);
  r.setEnd(en, eo);
  s.removeAllRanges();
  s.addRange(r);
  wrRange = r.cloneRange();
  sn.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return r;
}
// ---------- טאבעלעס ----------
function insertTable(rowsN, colsN, header = true) {
  const body = wbody();
  if (!body) return;
  const cell = (tag) => `<${tag} style="${CELL}${tag === 'th' ? ';background-color:#f1e7d3;font-weight:bold' : ''}"><br></${tag}>`;
  const row = (tag) => `<tr>${Array.from({ length: colsN }, () => cell(tag)).join('')}</tr>`;
  const html = `<table style="border-collapse:collapse;width:100%">${header ? `<thead>${row('th')}</thead>` : ''}<tbody>${Array.from({ length: Math.max(1, rowsN - (header ? 1 : 0)) }, () => row('td')).join('')}</tbody></table><p><br></p>`;
  restoreSel(body);
  document.execCommand('insertHTML', false, html);
  normalizeTop(body);
  body._save?.();
}
function tableOp(op, val) {
  const body = wbody();
  const c = cellAt();
  if (!body || !c) return;
  const tr = c.parentElement;
  const tbl = c.closest('table');
  const blank = (x, tag) => { const n = document.createElement(tag || x.tagName); n.setAttribute('style', x.getAttribute('style') || CELL); n.innerHTML = '<br>'; return n; };
  const newRow = (like, tag = 'TD') => { const r = document.createElement('tr'); [...like.cells].forEach((x) => r.append(blank(x, tag))); return r; };
  const rtl = getComputedStyle(tbl).direction === 'rtl';
  const ci = c.cellIndex;
  if (op === 'rowAbove' || op === 'rowBelow') {
    if (tr.parentElement.tagName === 'THEAD') {
      const tb = tbl.tBodies[0] || tbl.appendChild(document.createElement('tbody'));
      tb.prepend(newRow(tr));
    } else if (op === 'rowAbove') tr.before(newRow(tr)); else tr.after(newRow(tr));
  } else if (op === 'colRight' || op === 'colLeft') {
    const after = (op === 'colLeft') === rtl;
    [...tbl.rows].forEach((r) => {
      const ref = r.cells[Math.min(ci, r.cells.length - 1)];
      if (!ref) return;
      const n = blank(ref);
      if (after) ref.after(n); else ref.before(n);
    });
  } else if (op === 'delRow') {
    if (tbl.rows.length <= 1) tbl.remove(); else tr.remove();
  } else if (op === 'delCol') {
    [...tbl.rows].forEach((r) => r.cells[Math.min(ci, r.cells.length - 1)]?.remove());
    if (!tbl.rows[0]?.cells.length) tbl.remove();
  } else if (op === 'delTable') tbl.remove();
  else if (op === 'merge') {
    const nx = c.nextElementSibling;
    if (nx) { c.colSpan = (c.colSpan || 1) + (nx.colSpan || 1); if (nx.textContent.trim()) c.append(' ', ...nx.childNodes); nx.remove(); }
  } else if (op === 'split') {
    if ((c.colSpan || 1) > 1) { c.colSpan -= 1; c.after(blank(c)); }
  } else if (op === 'header') {
    if (tbl.tHead) {
      const tb = tbl.tBodies[0] || tbl.appendChild(document.createElement('tbody'));
      [...tbl.tHead.rows].reverse().forEach((r) => { [...r.cells].forEach((x) => { const td = document.createElement('td'); td.setAttribute('style', (x.getAttribute('style') || CELL).replace(/;?background-color:[^;]+|;?font-weight:bold/g, '')); td.innerHTML = x.innerHTML; x.replaceWith(td); }); tb.prepend(r); });
      tbl.tHead.remove();
    } else {
      const first = tbl.rows[0];
      const th = tbl.createTHead();
      [...first.cells].forEach((x) => { const n = document.createElement('th'); n.setAttribute('style', `${x.getAttribute('style') || CELL};background-color:#f1e7d3;font-weight:bold`); n.innerHTML = x.innerHTML; x.replaceWith(n); });
      first.removeAttribute('data-rep');
      th.append(first);
    }
  } else if (op === 'repeat') {
    if (tr.parentElement.tagName === 'THEAD') { ui.toast(t('wrRepNotHead'), 'error'); return; }
    if (tr.dataset.rep) tr.removeAttribute('data-rep'); else { $$('tr[data-rep]', tbl).forEach((x) => x.removeAttribute('data-rep')); tr.dataset.rep = val || 'don'; }
  } else if (op === 'bAll' || op === 'bNone' || op === 'bOut') {
    $$('td, th', tbl).forEach((x) => { x.style.border = op === 'bAll' ? '1px solid #888888' : 'none'; });
    tbl.style.border = op === 'bOut' ? '1px solid #888888' : '';
  } else if (op === 'shade') {
    const cells = wrRange && !wrRange.collapsed ? $$('td, th', tbl).filter((x) => wrRange.intersectsNode(x)) : [c];
    cells.forEach((x) => { x.style.backgroundColor = val || ''; });
  }
  normalizeTop(body);
  body._save?.();
  syncRibbon();
}
/** "שורה חוזרת" פון די לשונית "שדות": אין א טאבעלע — די שורה; אנדערש — א פארטיגע טאבעלע */
function repeatRow(type) {
  const body = wbody();
  if (!body) return;
  if (cellAt()) { tableOp('repeat', type); return; }
  const he = D.ltr.dir !== 'ltr';
  const cols = he ? [['תאריך', 'נדבה_תאריך'], ['סכום', 'נדבה_סכום'], ['שולם', 'נדבה_שולם'], ['הקדשה', 'נדבה_הקדשה']]
    : [['Date', 'DonDate'], ['Amount', 'DonAmount'], ['Paid', 'DonPaid'], ['Dedication', 'DonDedication']];
  const th = cols.map(([l]) => `<th style="${CELL};background-color:#f1e7d3;font-weight:bold">${h(l)}</th>`).join('');
  const td = cols.map(([, k]) => `<td style="${CELL}">${tokensToChips(`{${k}}`)}</td>`).join('');
  const tot = he ? `<tr><td style="${CELL};font-weight:bold" colspan="${cols.length - 1}">סה"כ</td><td style="${CELL};font-weight:bold">${tokensToChips('{סה"כ_סכום}')}</td></tr>`
    : `<tr><td style="${CELL};font-weight:bold" colspan="${cols.length - 1}">Total</td><td style="${CELL};font-weight:bold">${tokensToChips('{TotalAmount}')}</td></tr>`;
  restoreSel(body);
  document.execCommand('insertHTML', false, `<table style="border-collapse:collapse;width:100%"><thead><tr>${th}</tr></thead><tbody><tr data-rep="${type}">${td}</tr>${tot}</tbody></table><p><br></p>`);
  normalizeTop(body);
  body._save?.();
}
// ---------- בילדער ----------
async function insertImageData(data, drvId) {
  const body = wbody();
  if (!body) return;
  restoreSel(body);
  document.execCommand('insertHTML', false, `<img src="${h(data)}" data-drv="${h(drvId)}" style="width:3in;max-width:100%" alt="">`);
  body._save?.();
  setTimeout(() => layoutPages(), 300);
}
async function imageFromPc(file) {
  if (!helperOn()) { ui.toast(t('wrImgNoHelper'), 'error'); return; }
  try {
    const data = await shrinkImage(file, 1600, 1500000);
    const v = await storeImage(data, 'letter');
    if (!isDrv(v)) { ui.toast(t('wrImgNoHelper'), 'error'); return; }
    insertImageData(data, v.slice(4));
  } catch (err) { ui.toast(t(err.message === 'too-big' ? 'mmImageTooBig' : 'mmImageBad'), 'error'); }
}
async function imageFromDrive() {
  const dlg = dialog(`<h3>📁 ${h(t('wrPicDrive'))}</h3><p class="muted small" id="wrd-msg">${h(t('loading'))}</p><div class="wr-thumbs" id="wrd-list"></div>
    <div class="dialog-actions"><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`, true);
  const r = await listImages();
  const box = $('#wrd-list', dlg);
  if (!dlg.open) return;
  if (r.error) { $('#wrd-msg', dlg).textContent = r.error === 'unknown-action' ? t('wrHelperUpdate') : t('wrImgNoHelper'); return; }
  $('#wrd-msg', dlg).textContent = r.files.length ? t('wrPickPic') : t('wrNoPics');
  box.innerHTML = r.files.map((f) => `<button type="button" class="wr-thumb" data-id="${h(f.id)}" title="${h(f.name)}">${f.thumb ? `<img src="${h(f.thumb)}" alt="">` : '🖼'}<span>${h(f.name)}</span></button>`).join('');
  $$('.wr-thumb', box).forEach((b) => {
    b.onclick = async () => {
      $('#wrd-msg', dlg).textContent = t('loading');
      await fetchImages([b.dataset.id]);
      const data = imageOf(`drv:${b.dataset.id}`);
      dlg.close();
      if (data) insertImageData(data, b.dataset.id); else ui.toast(t('wrImgNoHelper'), 'error');
    };
  });
}
/** א פעלד «...» אויפן קורסאר (execCommand מאכט א נייע פסקה ביים סוף פון א שורה) */
function insertChip(body, k) { insertHtmlAt(body, `${tokensToChips(`{${k}}`)}\u00a0`); }
/** HTML אויפן קורסאר, אזוי ווי עס איז (אן די טויש פון execCommand) */
function insertHtmlAt(body, html) {
  restoreSel(body);
  const s = window.getSelection();
  if (!s.rangeCount || !body.contains(s.anchorNode)) return;
  const r = s.getRangeAt(0);
  r.deleteContents();
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const last = tpl.content.lastChild;
  r.insertNode(tpl.content);
  const c = document.createRange();
  c.setStartAfter(last);
  c.collapse(true);
  s.removeAllRanges();
  s.addRange(c);
  wrRange = c.cloneRange();
  body._save?.();
}
// ---------- תאריך ----------
function dateDialog(body) {
  const saved = wrRange;
  const dlg = dialog(`<h3>🗓 ${h(t('wrDateOther'))}</h3>
    <input type="date" id="wrdt-d" value="${todayIso()}" class="wr-cal">
    <div class="seg" style="margin:8px 0"><button type="button" data-df="he" class="on">${h(t('wrDateHeb'))}</button><button type="button" data-df="greg">${h(t('wrDateGreg'))}</button></div>
    <p class="wr-dprev" id="wrdt-prev"></p>
    <div class="dialog-actions"><button type="button" class="btn primary" id="wrdt-ok">OK</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  let fmt = 'he';
  const text = () => {
    const iso = $('#wrdt-d', dlg).value;
    if (!iso) return '';
    if (fmt === 'he') { const x = isoToHebrewText(iso); return x ? `${x} לפ"ק` : ''; }
    return D.ltr.dir === 'ltr' ? longDateEn(iso) : gregHe(iso);
  };
  const show = () => { $('#wrdt-prev', dlg).textContent = text(); };
  $$('[data-df]', dlg).forEach((b) => { b.onclick = () => { fmt = b.dataset.df; $$('[data-df]', dlg).forEach((x) => x.classList.toggle('on', x === b)); show(); }; });
  $('#wrdt-d', dlg).oninput = show;
  show();
  $('#wrdt-ok', dlg).onclick = () => {
    const v = text();
    dlg.close();
    if (!v) return;
    wrRange = saved;
    restoreSel(body);
    document.execCommand('insertText', false, v);
    body._save?.();
  };
}
// ---------- די אייגענע חתימה פונעם גבאי ----------
const SIG_FONTS = ['Playpen Sans Hebrew', 'Amatic SC', 'Noto Rashi Hebrew', 'Frank Ruhl Libre'];
function mySigRow() { return state.mailTemplates.find((x) => x.format === 'sig' && String(x.created_by || '').toLowerCase() === state.email); }
function mySig() { const r = mySigRow(); return r ? settingsOf(r).sig || null : null; }
async function saveMySig(sig) {
  const row = mySigRow();
  const rec = {
    ...(row || {}), template_id: row?.template_id || '', name: `__sig__:${state.email}`, format: 'sig',
    settings: JSON.stringify({ kind: 'sig', meta: { visibility: 'private' }, sig }), logo_data: '', background_data: '', postage_data: '',
  };
  const id = await saveRecord('MailTemplates', 'template_id', rec);
  const stamp = nowStamp();
  if (row) Object.assign(row, rec, { updated_at: stamp, updated_by: state.email });
  else state.mailTemplates.push({ ...rec, template_id: id, created_at: stamp, created_by: state.email, updated_at: stamp, updated_by: state.email });
}
function sigHtmlOf(sig) {
  if (!sig) return '';
  if (sig.type === 'img') {
    const d = imageOf(sig.img);
    return d ? `<span data-sig="1"><img src="${h(d)}" data-drv="${h(String(sig.img).slice(4))}" style="height:${Number(sig.h) || 0.8}in;width:auto" alt=""></span>` : '';
  }
  return `<span data-sig="1" style="font-family:'${h(sig.font || SIG_FONTS[0])}';font-size:${Number(sig.size) || 22}pt">${h(sig.text || '')}</span>`;
}
async function insertMySig(body) {
  const sig = mySig();
  if (!sig) { sigDialog('mine', () => insertMySig(body)); return; }
  await placeSig(body, sig);
}
/** א חתימה אינעם בריוו: ווען ס'איז שוין דא א חתימה — זי פארביטן (נאך א פראגע) */
async function placeSig(body, sig) {
  if (sig.type === 'img' && !imageOf(sig.img) && isDrv(sig.img)) await fetchImages([String(sig.img).slice(4)]);
  const html = sigHtmlOf(sig);
  if (!html) { ui.toast(t('wrImgNoHelper'), 'error'); return; }
  const old = $('[data-sig]', body);
  if (old && confirm(t('wrSigReplace'))) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    old.replaceWith(tpl.content);
  } else insertHtmlAt(body, html);
  body._save?.();
}
/** mode: 'mine' = מיין חתימה (ווערט אפגעהיט); 'temp' = נאר פאר דעם בריוו (למשל אין נאמען פון אן אנדערן, אדער ענגליש) */
function sigDialog(mode = 'mine', after = null) {
  const temp = mode === 'temp';
  const cur = (temp ? null : mySig()) || { type: 'text', text: '', font: SIG_FONTS[0], size: 22 };
  let img = cur.type === 'img' ? cur.img : '';
  const fonts = [...new Set([...SIG_FONTS, ...customFontNames()])];
  const dlg = dialog(`<h3>✍ ${h(t(temp ? 'wrSigTemp' : 'wrSigSetup'))}</h3>
    <p class="muted small">${h(t(temp ? 'wrSigTempHint' : 'wrSigPrivate'))}</p>
    <div class="seg"><button type="button" data-st="text" class="${cur.type !== 'img' ? 'on' : ''}">${h(t('wrSigTyped'))}</button><button type="button" data-st="img" class="${cur.type === 'img' ? 'on' : ''}">${h(t('wrSigImage'))}</button></div>
    <div id="wrs-text"${cur.type === 'img' ? ' hidden' : ''}>
      <label class="mm-l">${h(t('wrSigText'))}<input id="wrs-t" dir="auto" value="${h(cur.text || '')}"></label>
      <div class="mm-grid"><label>${h(t('mmFont'))}<select id="wrs-f">${fonts.map((f) => `<option style="font-family:'${h(f)}'"${f === cur.font ? ' selected' : ''}>${h(f)}</option>`).join('')}</select></label>
      <label>${h(t('mmSize'))}<input type="number" id="wrs-s" min="10" max="60" value="${Number(cur.size) || 22}"></label></div>
    </div>
    <div id="wrs-img"${cur.type === 'img' ? '' : ' hidden'}>
      <label class="btn">🖼 ${h(t('wrSigUpload'))}<input type="file" accept="image/*" id="wrs-file" hidden></label>
      <label class="mm-l">${h(t('mxHeight'))} (in)<input type="number" id="wrs-h" min="0.3" max="3" step="0.1" value="${Number(cur.h) || 0.8}"></label>
    </div>
    <div class="wr-sigprev" id="wrs-prev"></div>
    ${temp ? `<label class="check"><input type="checkbox" id="wrs-keep"> ${h(t('wrSigKeepMine'))}</label>` : ''}
    <div class="dialog-actions"><button type="button" class="btn primary" id="wrs-ok">${h(t('saveBtn'))}</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  let type = cur.type === 'img' ? 'img' : 'text';
  const val = () => (type === 'img' ? { type, img, h: Number($('#wrs-h', dlg).value) || 0.8 }
    : { type, text: nz($('#wrs-t', dlg).value), font: $('#wrs-f', dlg).value, size: Number($('#wrs-s', dlg).value) || 22 });
  const show = () => { $('#wrs-prev', dlg).innerHTML = sigHtmlOf(val()) || `<span class="muted small">—</span>`; };
  $$('[data-st]', dlg).forEach((b) => {
    b.onclick = () => {
      type = b.dataset.st;
      $$('[data-st]', dlg).forEach((x) => x.classList.toggle('on', x === b));
      $('#wrs-text', dlg).hidden = type === 'img';
      $('#wrs-img', dlg).hidden = type !== 'img';
      show();
    };
  });
  ['#wrs-t', '#wrs-f', '#wrs-s', '#wrs-h'].forEach((s) => { $(s, dlg).addEventListener('input', show); $(s, dlg).addEventListener('change', show); });
  $('#wrs-file', dlg).onchange = async () => {
    const f = $('#wrs-file', dlg).files[0];
    if (!f) return;
    try {
      const data = await shrinkImage(f, 900, 1500000);
      const v = await storeImage(data, 'signature');
      if (!isDrv(v)) { ui.toast(t('wrImgNoHelper'), 'error'); return; }
      img = v;
      show();
    } catch (err) { ui.toast(t(err.message === 'too-big' ? 'mmImageTooBig' : 'mmImageBad'), 'error'); }
  };
  if (type === 'img' && img && !imageOf(img) && isDrv(img)) fetchImages([String(img).slice(4)]).then(show);
  show();
  $('#wrs-ok', dlg).onclick = async () => {
    const v = val();
    if ((v.type === 'text' && !v.text) || (v.type === 'img' && !v.img)) return;
    const keep = !temp || $('#wrs-keep', dlg)?.checked;
    dlg.close();
    try {
      if (keep) { await saveMySig(v); ui.toast(t('mxSavedAuto')); }
      if (temp) { const body = wbody(); if (body) await placeSig(body, v); }
      if (after) after(); else setTab(wrTab);
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
}
// ---------- קישור ----------
function linkDialog() {
  const body = wbody();
  if (!body) return;
  restoreSel(body);
  const s = window.getSelection();
  const a = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('a');
  const dlg = dialog(`<h3>🔗 ${h(t('wrLink'))}</h3>
    <label class="mm-l">${h(t('wrLinkText'))}<input id="wrl-t" dir="auto" value="${h(a ? a.textContent : s.toString())}"></label>
    <label class="mm-l">${h(t('wrLinkUrl'))}<input id="wrl-u" dir="ltr" placeholder="https://" value="${h(a ? a.getAttribute('href') : '')}"></label>
    <div class="dialog-actions"><button type="button" class="btn primary" id="wrl-ok">OK</button>
    ${a ? `<button type="button" class="btn" id="wrl-del">${h(t('wrUnlink'))}</button>` : ''}<button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  const saved = wrRange;
  $('#wrl-u', dlg).focus();
  $('#wrl-ok', dlg).onclick = () => {
    let u = nz($('#wrl-u', dlg).value);
    const txt = nz($('#wrl-t', dlg).value) || u;
    if (!u) return;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(u)) u = /@/.test(u) ? `mailto:${u}` : `https://${u}`;
    dlg.close();
    wrRange = saved;
    restoreSel(body);
    if (a) { a.setAttribute('href', u); a.textContent = txt; } else document.execCommand('insertHTML', false, `<a href="${h(u)}">${h(txt)}</a>`);
    body._save?.();
  };
  $('#wrl-del', dlg)?.addEventListener('click', () => { dlg.close(); a.replaceWith(...a.childNodes); body._save?.(); });
}
// ---------- טורים ----------
function setColumns(body, n) {
  restoreSel(body);
  const s = window.getSelection();
  const node = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
  const wrap = node?.closest('div[style*="column-count"]');
  if (wrap && body.contains(wrap)) {
    if (n === '1') wrap.replaceWith(...wrap.childNodes);
    else { wrap.style.columnCount = String(parseInt(n, 10)); wrap.style.columnRule = n === '2r' ? '1px solid #bbbbbb' : ''; }
    body._save?.();
    return;
  }
  if (n === '1') return;
  const blocks = selBlocks(body).filter((b) => !isPgBrk(b));
  if (!blocks.length) return;
  const div = document.createElement('div');
  div.setAttribute('style', `column-count:${parseInt(n, 10)};column-gap:0.3in${n === '2r' ? ';column-rule:1px solid #bbbbbb' : ''}`);
  blocks[0].before(div);
  blocks.forEach((b) => div.append(b));
  body._save?.();
}
// ---------- סימן מים ----------
function wmCustomDialog() {
  const w = D.ltr.wm || {};
  const dlg = dialog(`<h3>💧 ${h(t('wrWatermark'))}</h3>
    <label class="mm-l">${h(t('wrWmText'))}<input id="wrw-t" dir="auto" value="${h(w.type !== 'img' ? w.text || '' : '')}"></label>
    <div class="mm-grid"><label>${h(t('wrFontColor'))}<input type="color" id="wrw-c" value="${h(w.color || '#888888')}"></label>
    <label>${h(t('mmSize'))}<input type="number" id="wrw-s" min="12" max="200" value="${Number(w.size) || 90}"></label>
    <label>${h(t('mmOpacity'))}<input type="range" id="wrw-o" min="0.03" max="0.6" step="0.01" value="${Number(w.op) || 0.15}"></label></div>
    <label class="check"><input type="checkbox" id="wrw-d"${w.diag === false ? '' : ' checked'}> ${h(t('wrWmDiag'))}</label>
    <div class="dialog-actions"><button type="button" class="btn primary" id="wrw-ok">OK</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  $('#wrw-ok', dlg).onclick = () => {
    D.ltr.wm = { on: Boolean(nz($('#wrw-t', dlg).value)), type: 'text', text: nz($('#wrw-t', dlg).value), color: $('#wrw-c', dlg).value, size: Number($('#wrw-s', dlg).value), op: Number($('#wrw-o', dlg).value), diag: $('#wrw-d', dlg).checked };
    dlg.close();
    scheduleSave();
    refreshStage();
  };
}
function numDialog(title, fields, onOk) {
  const dlg = dialog(`<h3>${h(title)}</h3><div class="mm-grid">${fields.map(([k, l, v, min, max, step]) => `<label>${h(l)}<input type="number" data-nf="${k}" value="${v}" min="${min}" max="${max}" step="${step}"></label>`).join('')}</div>
    <div class="dialog-actions"><button type="button" class="btn primary" id="wrn-ok">OK</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  $('#wrn-ok', dlg).onclick = () => {
    const o = {};
    $$('[data-nf]', dlg).forEach((i) => { o[i.dataset.nf] = Number(i.value); });
    dlg.close();
    onOk(o);
  };
}

function wireRibbon(main) {
  const st = $('#mx-stage', main);
  const rb = $('.wr-ribbon', st);
  const body = $('.wr-body', st);
  const exec = (cmd, val = null, css = false) => {
    if (!body) return;
    restoreSel(body);
    document.execCommand('styleWithCSS', false, css);
    document.execCommand(cmd, false, val);
    document.execCommand('styleWithCSS', false, false);
    body._save?.();
    syncRibbon();
  };
  const closeDd = (b) => { const d = b.closest('details'); if (d) d.open = false; };
  // קנעפלעך זאלן נישט צונעמען דעם קורסאר
  $$('button, summary, .wr-grid span', rb).forEach((b) => { b.addEventListener('mousedown', (e) => e.preventDefault()); });
  $$('[data-wcmd]', rb).forEach((b) => {
    b.onclick = () => {
      const cmd = b.dataset.wcmd;
      if (cmd.startsWith('pdir-')) {
        if (!body) return;
        restoreSel(body);
        const dir = cmd.slice(5);
        (selBlocks(body).length ? selBlocks(body) : [body.firstElementChild]).forEach((el) => {
          if (!el) return;
          el.setAttribute('dir', dir);
          el.style.textAlign = dir === 'rtl' ? 'right' : 'left';
        });
        body._save?.();
        return;
      }
      if (cmd === 'cut' || cmd === 'copy') { if (body) { restoreSel(body); document.execCommand(cmd); if (cmd === 'cut') body._save?.(); } return; }
      exec(cmd);
    };
  });
  $('#wr-paste', rb)?.addEventListener('click', async () => {
    if (!body) return;
    try {
      let html = '';
      let txt = '';
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
          else if (it.types.includes('text/plain')) txt = await (await it.getType('text/plain')).text();
        }
      } else txt = await navigator.clipboard.readText();
      restoreSel(body);
      pasteInto(body, html, txt);
    } catch { ui.toast(t('wrPasteKeys')); }
  });
  const pb = $('#wr-painter', rb);
  if (pb) {
    let clickT = null;
    pb.onclick = () => {
      if (!body) return;
      clearTimeout(clickT);
      if (painter) { painter = null; updatePainter(); return; }
      clickT = setTimeout(() => takePainter(body, false), 220);
    };
    pb.ondblclick = () => { clearTimeout(clickT); if (body) takePainter(body, true); };
  }
  $$('[data-case]', rb).forEach((b) => { b.onclick = () => { closeDd(b); if (body) changeCase(body, b.dataset.case); }; });
  $('#wr-find', rb)?.addEventListener('click', () => findDialog(false));
  $('#wr-replace', rb)?.addEventListener('click', () => findDialog(true));
  const f = $('#wr-font', rb);
  if (f) f.onchange = () => exec('fontName', f.value);
  const z = $('#wr-size', rb);
  if (z) {
    z.onchange = () => {
      if (!body) return;
      restoreSel(body);
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontSize', false, '7');
      $$('font[size="7"]', body).forEach((x) => { const sp = document.createElement('span'); sp.style.fontSize = `${z.value}pt`; sp.innerHTML = x.innerHTML; x.replaceWith(sp); });
      body._save?.();
    };
  }
  $$('[data-hilite]', rb).forEach((b) => { b.onclick = () => { exec('hiliteColor', b.dataset.hilite, true); closeDd(b); }; });
  $$('[data-fore]', rb).forEach((b) => { b.onclick = () => { exec('foreColor', b.dataset.fore, true); $$('.wr-fc', rb).forEach((x) => { x.style.borderColor = b.dataset.fore; }); closeDd(b); }; });
  $$('.wr-forecustom', rb).forEach((fc) => { fc.onchange = () => exec('foreColor', fc.value, true); });
  $$('[data-outline]', rb).forEach((b) => { b.onclick = () => { closeDd(b); if (body) styleSelection(body, { webkitTextStroke: b.dataset.outline ? `0.6px ${b.dataset.outline}` : '' }); }; });
  $$('[data-outw]', rb).forEach((b) => {
    b.onclick = () => {
      closeDd(b);
      if (!body) return;
      restoreSel(body);
      const node = window.getSelection().anchorNode;
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      const color = (el && getComputedStyle(el).webkitTextStrokeColor) || '#000000';
      styleSelection(body, { webkitTextStroke: `${b.dataset.outw}px ${color}` });
    };
  });
  $$('[data-linesp]', rb).forEach((b) => {
    b.onclick = () => {
      closeDd(b);
      if (!body) return;
      restoreSel(body);
      const bl = selBlocks(body);
      if (bl.length) { bl.forEach((el) => { el.style.lineHeight = b.dataset.linesp; }); body._save?.(); }
      else { D.ltr.lineH = Number(b.dataset.linesp); scheduleSave(); refreshStage(); }
    };
  });
  const paraSp = (attr, prop) => $$(`[data-${attr}]`, rb).forEach((b) => {
    b.onclick = () => {
      closeDd(b);
      if (!body) return;
      restoreSel(body);
      selBlocks(body).forEach((el) => {
        const v = `${b.dataset[attr]}pt`;
        if (prop === 'marginTop' && el.dataset.pbm !== undefined) el.dataset.pbm = v; else el.style[prop] = v;
      });
      body._save?.();
    };
  });
  paraSp('spb', 'marginTop');
  paraSp('spa', 'marginBottom');
  // הוספה
  $('#wr-pgbrk', rb)?.addEventListener('click', () => body && insertPageBreak(body));
  $$('[data-date]', rb).forEach((b) => {
    b.onclick = () => {
      closeDd(b);
      if (!body) return;
      const k = b.dataset.date === 'he' ? 'תאריך' : D.ltr.dir === 'ltr' ? 'Date' : 'תאריך_לועזי';
      insertChip(body, k);
    };
  });
  $('#wr-date-other', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); if (body) dateDialog(body); });
  $('#wr-sig-mine', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); if (body) insertMySig(body); });
  $('#wr-sig-setup', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); sigDialog('mine'); });
  $('#wr-sig-temp', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); sigDialog('temp'); });
  $$('[data-field]', rb).forEach((b) => {
    b.onclick = () => {
      closeDd(b);
      if (!body) return;
      insertChip(body, b.dataset.field);
    };
  });
  const grid = $('#wr-grid', rb);
  if (grid) {
    const mark = (r, c) => { $$('span', grid).forEach((x) => x.classList.toggle('on', Number(x.dataset.gr) <= r && Number(x.dataset.gc) <= c)); $('#wr-gridlbl', rb).textContent = r ? `${c} × ${r}` : t('wrTable'); };
    $$('span', grid).forEach((x) => {
      x.onmouseenter = () => mark(Number(x.dataset.gr), Number(x.dataset.gc));
      x.onclick = () => { closeDd(x); insertTable(Number(x.dataset.gr), Number(x.dataset.gc), true); };
    });
    grid.onmouseleave = () => mark(0, 0);
  }
  $('#wr-table-dlg', rb)?.addEventListener('click', (e) => {
    closeDd(e.currentTarget);
    const dlg = dialog(`<h3>▦ ${h(t('wrInsertTable'))}</h3><div class="mm-grid"><label>${h(t('wrColsN'))}<input type="number" id="wrt-c" value="3" min="1" max="20"></label>
      <label>${h(t('wrRowsN'))}<input type="number" id="wrt-r" value="3" min="1" max="200"></label></div>
      <label class="check"><input type="checkbox" id="wrt-h" checked> ${h(t('wrHeaderRow'))}</label>
      <div class="dialog-actions"><button type="button" class="btn primary" id="wrt-ok">OK</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
    $('#wrt-ok', dlg).onclick = () => { const r = Number($('#wrt-r', dlg).value) || 3; const c = Number($('#wrt-c', dlg).value) || 3; const hh = $('#wrt-h', dlg).checked; dlg.close(); insertTable(Math.min(200, r), Math.min(20, c), hh); };
  });
  const imgFile = $('#wr-img-file', rb);
  $('#wr-img-pc', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); imgFile.click(); });
  if (imgFile) imgFile.onchange = () => { if (imgFile.files[0]) imageFromPc(imgFile.files[0]); };
  $('#wr-img-drive', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); imageFromDrive(); });
  $('#wr-link', rb)?.addEventListener('click', () => linkDialog());
  $('#wr-rcslot', rb)?.addEventListener('click', () => { D.ltr.rcSlot = !D.ltr.rcSlot; scheduleSave(); refreshStage(); });
  $('#wr-sig', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); D.ltr.sig = !D.ltr.sig; scheduleSave(); refreshStage(); });
  // עיצוב: סימן מים
  $$('[data-wm]', rb).forEach((b) => {
    b.onclick = () => {
      closeDd(b);
      const x = b.dataset.wm;
      D.ltr.wm = x ? { ...(D.ltr.wm?.type === 'text' ? D.ltr.wm : {}), on: true, type: 'text', text: x } : { ...(D.ltr.wm || {}), on: false };
      scheduleSave();
      refreshStage();
    };
  });
  $('#wr-wm-custom', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); wmCustomDialog(); });
  const wmFile = $('#wr-wm-file', rb);
  $('#wr-wm-img', rb)?.addEventListener('click', (e) => { closeDd(e.currentTarget); wmFile.click(); });
  if (wmFile) {
    wmFile.onchange = async () => {
      const file = wmFile.files[0];
      if (!file) return;
      try {
        const data = await shrinkImage(file, 1600, 1500000);
        const v = await storeImage(data, 'watermark');
        if (!isDrv(v)) { ui.toast(t('wrImgNoHelper'), 'error'); return; }
        D.ltr.wm = { on: true, type: 'img', img: v, op: 0.15, scale: 60 };
        scheduleSave();
        refreshStage();
      } catch (err) { ui.toast(t(err.message === 'too-big' ? 'mmImageTooBig' : 'mmImageBad'), 'error'); }
    };
  }
  // פריסה
  $$('[data-margins]', rb).forEach((b) => { b.onclick = () => { D.ltr.margins = { ...MARGINS[b.dataset.margins] }; scheduleSave(); renderMailMerge(); }; });
  $('#wr-margins-dlg', rb)?.addEventListener('click', (e) => {
    closeDd(e.currentTarget);
    const m = D.ltr.margins;
    numDialog(t('wrMCustom'), [['top', t('mxMarginTop'), m.top, 0.2, 4, 0.05], ['side', t('mxMarginSide'), m.side, 0.2, 2.5, 0.05], ['bottom', t('mxMarginBottom'), m.bottom, 0.2, 3, 0.05]],
      (o) => { D.ltr.margins = o; scheduleSave(); renderMailMerge(); });
  });
  $$('[data-orient]', rb).forEach((b) => { b.onclick = () => { D.ltr.orient = b.dataset.orient; scheduleSave(); renderMailMerge(); }; });
  $$('[data-psize]', rb).forEach((b) => { b.onclick = () => { D.ltr.page = b.dataset.psize; scheduleSave(); renderMailMerge(); }; });
  $('#wr-size-dlg', rb)?.addEventListener('click', (e) => {
    closeDd(e.currentTarget);
    numDialog(t('wrSizeCustom'), [['pw', `${t('mxWidth')} (in)`, D.ltr.pw || 8.5, 3, 30, 0.01], ['ph', `${t('mxHeight')} (in)`, D.ltr.ph || 11, 3, 30, 0.01]],
      (o) => { D.ltr.page = 'custom'; D.ltr.pw = o.pw; D.ltr.ph = o.ph; scheduleSave(); renderMailMerge(); });
  });
  $$('[data-cols]', rb).forEach((b) => { b.onclick = () => { closeDd(b); if (body) setColumns(body, b.dataset.cols); }; });
  $$('[data-docdir]', rb).forEach((b) => { b.onclick = () => { D.ltr.dir = b.dataset.docdir; scheduleSave(); renderMailMerge(); }; });
  // דברי דואר
  $('#wr-win', rb)?.addEventListener('click', () => { D.ltr.window = !D.ltr.window; scheduleSave(); renderMailMerge(); });
  $('#wr-rcp', rb)?.addEventListener('click', () => setDrawer(true));
  $('#wr-preview', rb)?.addEventListener('click', () => { ltrEdit = !ltrEdit; refreshStage(); });
  const vr = () => viewRows();
  $('#mx-first', rb)?.addEventListener('click', () => { idx = 0; refreshStage(); });
  $('#mx-last', rb)?.addEventListener('click', () => { idx = Math.max(0, vr().length - 1); refreshStage(); });
  const rec = $('#wr-rec', rb);
  if (rec) rec.onchange = () => { idx = Math.min(vr().length - 1, Math.max(0, Number(rec.value) - 1)); refreshStage(); };
  // שדות
  $('#wr-rep-don', rb)?.addEventListener('click', () => repeatRow('don'));
  const flt = $('#wr-don-filter', rb);
  if (flt) {
    $$('[data-f]', flt).forEach((el) => {
      el.onchange = () => {
        const F = { ...(D.ltr.reps?.don || {}) };
        F[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
        D.ltr.reps = { ...(D.ltr.reps || {}), don: F };
        scheduleSave();
        refreshAll();
      };
    });
  }
  // טבלה
  $$('[data-tbl]', rb).forEach((b) => { b.onclick = () => { closeDd(b); tableOp(b.dataset.tbl); }; });
  $$('[data-shade]', rb).forEach((b) => { b.onclick = () => { closeDd(b); tableOp('shade', b.dataset.shade); }; });
  // תמונה
  const iw = $('#wr-img-w', rb);
  if (iw) iw.onchange = () => { if (selImg) { selImg.style.width = `${Number(iw.value) || 3}in`; selImg.style.maxWidth = '100%'; body?._save?.(); } };
  $$('[data-imgwrap]', rb).forEach((b) => {
    b.onclick = () => {
      if (!selImg) return;
      const k = b.dataset.imgwrap;
      Object.assign(selImg.style, { float: '', display: '', margin: '' });
      if (k === 'right') Object.assign(selImg.style, { float: 'right', margin: '0 0 6px 12px' });
      if (k === 'left') Object.assign(selImg.style, { float: 'left', margin: '0 12px 6px 0' });
      if (k === 'center') Object.assign(selImg.style, { display: 'block', margin: '6px auto' });
      body?._save?.();
      setTab('img');
    };
  });
  $('#wr-img-del', rb)?.addEventListener('click', () => { if (selImg) { selImg.remove(); selImg = null; body?._save?.(); syncRibbon(); } });
  // הגדרות: [data-k], בילדער
  $$('[data-k]', rb).forEach((el) => { el.addEventListener('change', () => applyK(el)); });
  wireUploads(rb);
  wireStageButtons(main, rb);
}

function renderEditor(main) {
  computeRows();
  computeProblems();
  const ro = !canEditT(current());
  main.innerHTML = `
    <div class="camp-page-head mx-head">
      <button type="button" class="btn ghost" id="mx-back">→ ${h(t('mxBack'))}</button>
      <span class="mx-kind">${KINDS.find(([k]) => k === D.kind)[1]}</span>
      <input id="mx-name" value="${h(D.name)}" placeholder="${h(t('mmDesignName'))}" ${ro ? 'disabled' : ''}>
      <span id="mx-save-state" class="mx-save"></span>
      <span class="spacer"></span>
      ${ro ? '' : `<button type="button" class="btn" id="mx-settings">⚙ ${h(t('mxSettings'))}</button>`}
    </div>
    <div id="mx-bar-wrap">${barHtml()}</div>
    ${D.kind === 'ltr' ? `<div class="mm-layout mx-wordlay">
      <aside class="mm-panel wr-drawer"${wrDrawer ? '' : ' hidden'}${ro ? ' inert' : ''}>
        <div class="wr-drawer-head"><b>👥 ${h(t('mxRecipients'))}</b><button type="button" class="btn small-btn" id="wr-drawer-x">✓ ${h(t('close'))}</button></div>
        <div data-sec="rcp">${recipientsHtml()}</div>
      </aside>
      <section class="mm-stage" id="mx-stage">${stageHtml()}</section>
    </div>` : `<div class="mm-layout">
      <aside class="mm-panel"${ro ? ' inert' : ''}>
        ${recipientsHtml()}
        ${D.kind === 'env' ? envEditHtml() : lblEditHtml()}
      </aside>
      <section class="mm-stage" id="mx-stage">${stageHtml()}</section>
    </div>`}`;
  showSaveState();
  fitPreview();
  wireEditor(main);
  measureAll();
}

function fitPreview() {
  if (D?.kind === 'ltr' && $('#mm-canvas.wr-canvas')) { fitWord(); return; }
  const canvas = $('#mm-canvas');
  const inner = canvas?.firstElementChild;
  if (!inner) return;
  fitIn(canvas);
  const avail = canvas.clientWidth - 20;
  const fit = Math.min(1.3, avail / inner.offsetWidth);
  const scale = fit * zoom;
  inner.style.transform = `scale(${scale})`;
  inner.style.transformOrigin = 'top left';
  // גרעסער ווי דער פלאץ: מען קען שלעפן (scroll) אין דער תצוגה
  canvas.style.height = `${inner.offsetHeight * scale + 20}px`;
  inner.style.marginBottom = '0';
  canvas.classList.toggle('mx-zoomed', zoom > 1.01);
  const sizer = canvas.querySelector('.mx-sizer') || canvas.appendChild(Object.assign(document.createElement('div'), { className: 'mx-sizer' }));
  sizer.style.width = `${inner.offsetWidth * scale + 20}px`;
  sizer.style.height = `${inner.offsetHeight * scale + 20}px`;
  canvas.dataset.scale = scale;
  const lbl = $('#mx-zoom-val');
  if (lbl) lbl.textContent = `${Math.round(zoom * 100)}%`;
}
let zoom = (() => { try { return Number(localStorage.getItem('khal-mx-zoom')) || 1; } catch { return 1; } })();
function setZoom(z) {
  zoom = Math.max(0.5, Math.min(3, Math.round(z * 100) / 100));
  try { localStorage.setItem('khal-mx-zoom', String(zoom)); } catch { /* */ }
  fitPreview();
  // טעקסט פון רעכטס: אנהייבן פון דער רעכטער זייט
  const cv = $('#mm-canvas');
  if (cv && (D?.kind !== 'ltr' || D.ltr.dir !== 'ltr')) cv.scrollLeft = cv.scrollWidth;
}
function refreshStage() {
  const st = $('#mx-stage');
  if (!st) return;
  st.innerHTML = stageHtml();
  fitPreview();
  wireStage($('#mailmerge-main'));
}
function refreshAll() {
  computeRows();
  computeProblems();
  const bar = $('#mx-bar-wrap');
  if (bar) bar.innerHTML = barHtml();
  const cnt = $('#mx-count');
  if (cnt) cnt.textContent = t('mmCount', { n: rows.length });
  refreshStage();
  wireBar($('#mailmerge-main'));
  measureAll();
}

function setPath(path, value) {
  const keys = path.split('.');
  let o = D;
  keys.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
  o[keys.at(-1)] = value;
}
// וואס טוישט דעם פאנעל — גאנץ פון ניי
const REBUILD = new Set(['format', 'lang', 'src.list', 'src.mailMode', 'src.toWife', 'src.email', 'sort', 'post.mode', 'ret.logo', 'lbl.mode', 'lbl.logo', 'lbl.sheet',
  'ltr.design', 'ltr.window', 'ltr.lang', 'link.name', 'ltr.dir']);
const ROWS = new Set(['src.paste', 'lang', 'ltr.window', 'ltr.winLang']);

function applyK(el) {
  const k = el.dataset.k;
  let val = el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range') ? Number(el.value) : el.value;
  if (k === 'ltr.lineH') val = Number(val);
  setPath(k, val);
  if (k === 'format' && D.kind === 'env') {
    const [W, H] = envSize(D);
    D.rcp.x = Math.round(W * 0.4 * 100) / 100;
    D.rcp.y = Math.round(H * 0.46 * 100) / 100;
  }
  if (k === 'ltr.lang') D.ltr.dir = val === 'en' ? 'ltr' : 'rtl';
  if (k === 'link.name') D.link.series = allCampaigns().find((x) => x.name === val)?.series || '';
  if (k === 'src.list') pendingList = '';
  scheduleSave();
  if (REBUILD.has(k)) renderMailMerge();
  else if (ROWS.has(k) || k.startsWith('rcp.template') || k === 'ltr.salutation') refreshAll();
  else refreshStage();
}
function wireUploads(root, skipStage = false) {
  $$('[data-upload]', root).filter((el) => !skipStage || !el.closest('#mx-stage')).forEach((inp) => {
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      const big = helperOn();
      const isBg = inp.dataset.upload === 'background_data';
      try {
        // מיט דעם עוזר התמונות (דרייב) — א גרעסערע בילד, שיין פאר דרוקן
        D[inp.dataset.upload] = await shrinkImage(file, big ? (isBg ? 2400 : 900) : (isBg ? 900 : 500), big ? 1500000 : 45000);
        scheduleSave(300);
        renderMailMerge();
      } catch (err) { ui.toast(t(err.message === 'too-big' ? 'mmImageTooBig' : 'mmImageBad'), 'error'); }
    };
  });
  $$('[data-clear]', root).filter((el) => !skipStage || !el.closest('#mx-stage')).forEach((b) => { b.onclick = () => { D[b.dataset.clear] = ''; scheduleSave(); renderMailMerge(); }; });
}
function wireEditor(main) {
  $('#mx-back', main).onclick = async () => {
    if (!D.template_id && !nz(D.name) && !confirm(t('mxLeaveUnsaved'))) return;
    if (saveState === 'dirty') { try { await persist(); } catch { /* */ } }
    view = 'home';
    D = null;
    renderMailMerge();
  };
  $('#mx-name', main)?.addEventListener('input', (e) => { D.name = e.target.value; scheduleSave(); });
  $('#mx-settings', main)?.addEventListener('click', openSettings);
  $('#mx-unmatch', main)?.addEventListener('click', () => {
    const M = matchedLetter();
    if (M) { D.src = { ...M.src, email: false }; D.sort = M.sort; }
    D.matchOf = '';
    scheduleSave();
    renderMailMerge();
  });
  $('#mx-ids-x', main)?.addEventListener('click', () => { delete D._ids; pending = null; renderMailMerge(); });
  $$('[data-src]', main).forEach((b) => { b.onclick = () => { D.src.type = b.dataset.src; D._ids = undefined; scheduleSave(); renderMailMerge(); }; });
  const ci = $('#mx-contact', main);
  if (ci) {
    ci.onchange = () => {
      const c = state.contacts.find((x) => ui.pickerLabel(x) === ci.value.trim());
      if (!c) return;
      D.src.contact = String(c.contact_id);
      scheduleSave();
      idx = 0;
      refreshAll();
    };
  }
  $('#wr-drawer-x', main)?.addEventListener('click', () => setDrawer(false));
  $$('[data-k]', main).filter((el) => !el.closest('#mx-stage')).forEach((el) => {
    const live = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'color', 'file'].includes(el.type));
    el.addEventListener(live ? 'input' : 'change', () => applyK(el));
  });
  $$('[data-token]', main).forEach((b) => {
    b.onmousedown = (e) => e.preventDefault(); // נישט פארלירן די אויסגעקליבענע שטעלע אין דעם עדיטאר
    b.onclick = () => {
      const tok = b.dataset.token;
      if (b.dataset.target === 'rte') {
        const rte = b.closest('.mx-rte-wrap').querySelector('.mx-rte');
        rte.focus();
        document.execCommand('insertText', false, tok);
        rte.dispatchEvent(new Event('input'));
        return;
      }
      const ta = $(`#${b.dataset.target}`, main);
      const pos = ta.selectionStart ?? ta.value.length;
      ta.value = `${ta.value.slice(0, pos)}${tok}${ta.value.slice(pos)}`;
      ta.dispatchEvent(new Event('input'));
      ta.focus();
    };
  });
  wireUploads(main, true);
  // טעקסט קעסטלעך
  $('#mx-addbox', main)?.addEventListener('click', () => {
    const id = `b${Date.now().toString(36)}`;
    const [W] = pageSize(D);
    D.boxes = [...(D.boxes || []), { id, x: Math.round(W * 0.3 * 10) / 10, y: 0.5, w: 3, html: '…', dir: D.kind === 'ltr' ? D.ltr.dir : 'rtl', font: 'Frank Ruhl Libre', size: 12 }];
    selBox = id;
    scheduleSave();
    renderMailMerge();
  });
  $$('[data-selbox]', main).forEach((b) => { b.onclick = () => { selBox = selBox === b.dataset.selbox ? '' : b.dataset.selbox; renderMailMerge(); }; });
  $('#mx-delbox', main)?.addEventListener('click', () => { D.boxes = D.boxes.filter((x) => x.id !== selBox); selBox = ''; scheduleSave(); renderMailMerge(); });
  $$('[data-box]', main).forEach((el) => {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const b = D.boxes.find((x) => x.id === selBox);
      if (!b) return;
      b[el.dataset.box] = el.type === 'number' ? Number(el.value) : el.value;
      if (el.dataset.box === 'dir') { const r = $(`[data-rte="box:${selBox}"] .mx-rte`, main); if (r) r.dir = el.value; }
      scheduleSave();
      refreshStage();
    });
  });
  wireRte(main);
  $('#mx-sheets', main)?.addEventListener('click', openSheets);
  $('#mx-testsheet', main)?.addEventListener('click', () => printPages(labelPages(D, [], { test: true }), [8.5, 11]));
  wireBar(main);
  wireStage(main);
}
function wireRte(main) {
  $$('.mx-rte-wrap', main).forEach((wrap) => {
    const target = wrap.dataset.rte;
    const rte = $('.mx-rte', wrap);
    let tmr = null;
    const save = () => {
      const html = cleanHtml(rte.innerHTML);
      if (target === 'ltr') D.ltr.html = html;
      else { const b = D.boxes.find((x) => `box:${x.id}` === target); if (b) b.html = html; }
      scheduleSave();
      clearTimeout(tmr);
      tmr = setTimeout(() => { if (target === 'ltr') refreshAll(); else refreshStage(); }, 400);
    };
    rte.addEventListener('input', save);
    $$('[data-cmd]', wrap).forEach((b) => {
      b.onmousedown = (e) => e.preventDefault();
      b.onclick = () => { rte.focus(); document.execCommand(b.dataset.cmd, false, null); save(); };
    });
    $$('[data-cmdsel]', wrap).forEach((s) => {
      s.onmousedown = (e) => { if (s.tagName !== 'SELECT' && s.type !== 'color') e.preventDefault(); };
      s.onchange = () => {
        const v = s.value;
        if (!v) return;
        rte.focus();
        if (s.dataset.cmdsel === 'size') {
          document.execCommand('fontSize', false, '7');
          $$('font[size="7"]', rte).forEach((f) => { const sp = document.createElement('span'); sp.style.fontSize = `${v}pt`; sp.innerHTML = f.innerHTML; f.replaceWith(sp); });
        } else document.execCommand(s.dataset.cmdsel, false, v);
        if (s.tagName === 'SELECT') s.value = '';
        save();
      };
    });
  });
}
function wireBar(main) {
  $$('[data-ptype]', main).forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.ptype;
      if (['excluded', 'nosend'].includes(k)) { showProblemList(k); return; }
      onlyType = onlyType === k ? '' : k;
      idx = 0;
      $('#mx-bar-wrap').innerHTML = barHtml();
      wireBar(main);
      refreshStage();
    };
  });
  const only = $('#mx-only', main);
  if (only) only.onchange = () => { onlyType = only.checked ? '*' : ''; idx = 0; $('#mx-bar-wrap').innerHTML = barHtml(); wireBar(main); refreshStage(); };
}
function showProblemList(k) {
  const p = probs.get(k);
  if (!p) return;
  const dlg = dialog(`<h3>${h(t(PROB_LABEL[k]))} (${p.items.length})</h3>
    <ul class="mx-plist">${p.items.map(({ c, note }) => `<li>${h(nameOf(c))}${note ? ` <span class="muted small">— ${h(note)}</span>` : ''}
      ${c.contact_id && !c._ext ? `<button type="button" class="linkish small" data-card="${h(c.contact_id)}">${h(t('mxOpenCard'))}</button>` : ''}</li>`).join('')}</ul>
    <div class="dialog-actions"><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`);
  $$('[data-card]', dlg).forEach((b) => { b.onclick = () => { dlg.close(); ui.openCard(b.dataset.card); }; });
}
function wireStage(main) {
  $('#mx-zoom-in', main)?.addEventListener('click', () => setZoom(zoom + 0.25));
  $('#mx-zoom-out', main)?.addEventListener('click', () => setZoom(zoom - 0.25));
  $('#mx-zoom-fit', main)?.addEventListener('click', () => setZoom(1));
  if (D.kind === 'ltr') wireWord(main);
  else wireStageButtons(main, $('#mx-stage', main));
  wireDrag();
}
function wireStageButtons(main, sc) {
  const vr = () => viewRows();
  $('#mx-prev', sc)?.addEventListener('click', () => { idx = Math.max(0, idx - 1); refreshStage(); });
  $('#mx-next', sc)?.addEventListener('click', () => { idx = Math.min(vr().length - 1, idx + 1); refreshStage(); });
  $$('[data-card]', sc).forEach((b) => { b.onclick = () => ui.openCard(b.dataset.card); });
  $('#mx-skip', sc)?.addEventListener('click', () => { const c = vr()[idx]; if (c) skipIds.add(keyOf(c)); refreshAll(); });
  $('#mx-unskip', sc)?.addEventListener('click', () => { skipIds = new Set(); refreshAll(); });
  $('#mx-print', sc)?.addEventListener('click', () => output('print'));
  $('#mx-pdf', sc)?.addEventListener('click', () => output('pdf'));
  $('#mx-test', sc)?.addEventListener('click', () => output('print', { test: true }));
  $('#mx-pair', sc)?.addEventListener('click', () => outputPair());
  $('#mx-send', sc)?.addEventListener('click', () => sendEmails());
}

/** שלעפן מיטן מויז: צוריק-אדרעס, נמען, פענצטער, טעקסט קעסטלעך */
function wireDrag() {
  const canvas = $('#mm-canvas');
  if (!canvas || !canEditT(current())) return;
  $$('.mx-drag', canvas).forEach((el) => {
    el.onpointerdown = (e) => {
      const partKey = el.dataset.part;
      const part = partKey === 'ret' ? D.ret : partKey === 'rcp' ? D.rcp : partKey === 'win' ? D.ltr.win : D.boxes.find((b) => `box:${b.id}` === partKey);
      if (!part) return;
      e.preventDefault();
      if (partKey.startsWith('box:') && selBox !== partKey.slice(4)) { selBox = partKey.slice(4); }
      const scale = Number(canvas.dataset.scale || 1);
      const ppi = 96 * scale;
      const start = { x: e.clientX, y: e.clientY, px: Number(part.x) || 0, py: Number(part.y) || 0 };
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      el.onpointermove = (ev) => {
        part.x = Math.max(0, Math.round((start.px + (ev.clientX - start.x) / ppi) * 100) / 100);
        part.y = Math.max(0, Math.round((start.py + (ev.clientY - start.y) / ppi) * 100) / 100);
        el.style.left = `${part.x}in`;
        el.style.top = `${part.y}in`;
      };
      el.onpointerup = () => {
        el.onpointermove = null;
        el.classList.remove('dragging');
        if (start.px !== part.x || start.py !== part.y) {
          scheduleSave();
          if (partKey === 'win') renderMailMerge();
          else if (partKey.startsWith('box:')) renderMailMerge();
        }
      };
    };
  });
}

// ---------- א קליינער דיאלאג ----------
function dialog(html, wide = false) {
  const dlg = document.createElement('dialog');
  dlg.className = `sheet${wide ? ' wide' : ''} mx-dlg`;
  dlg.innerHTML = html;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  $$('[data-x]', dlg).forEach((b) => { b.onclick = () => dlg.close(); });
  dlg.showModal();
  return dlg;
}

// ---------- הגדרות: ווער זעט / ווער רעדאגירט / שייך צו ---------
function openSettings() {
  const m = D.meta;
  const users = allUsers().filter((u) => u.email !== state.email);
  const dlg = dialog(`<h3>⚙ ${h(t('mxSettings'))}</h3>
    <label class="mm-l">${h(t('mxVisibility'))}<select id="mxs-vis"><option value="public"${m.visibility !== 'private' ? ' selected' : ''}>${h(t('mxPublic'))}</option><option value="private"${m.visibility === 'private' ? ' selected' : ''}>${h(t('mxPrivate'))}</option></select></label>
    <label class="mm-l">${h(t('mxOrgOf'))}<select id="mxs-org"><option value="">${h(t('mxOrgAll'))}</option>${orgOptions().map((o) => `<option${o === m.org ? ' selected' : ''}>${h(o)}</option>`).join('')}</select></label>
    <div class="mm-l">${h(t('mxEditors'))}<div class="mx-users">${users.map((u) => `<label class="check"><input type="checkbox" value="${h(u.email)}" ${(m.editors || []).includes(u.email) ? 'checked' : ''}> ${h(u.name || u.email)}</label>`).join('') || `<span class="muted small">—</span>`}</div></div>
    <div class="dialog-actions"><button type="button" class="btn primary" id="mxs-ok">${h(t('saveBtn'))}</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
  $('#mxs-ok', dlg).onclick = () => {
    D.meta = { ...m, visibility: $('#mxs-vis', dlg).value, org: $('#mxs-org', dlg).value, editors: $$('.mx-users input:checked', dlg).map((x) => x.value) };
    dlg.close();
    persist().then(() => ui.toast(t('mxSavedAuto'))).catch((err) => ui.toast(ui.friendlyError(err), 'error'));
  };
}

// ---------- די ביבליאטעק פון לעיבל-בויגנס ----------
function openSheets() {
  const lib = (settingsOf(sheetsRow()).sheets || []).map((s) => ({ ...s }));
  const F = [['name', t('mxSheetName'), 'text'], ['cols', t('mxCols'), 1], ['rows', t('mxRows'), 1], ['w', t('mxWidth'), 0.01], ['h', t('mxHeight'), 0.01],
    ['top', t('mxTopMargin'), 0.01], ['left', t('mxLeftMargin'), 0.01], ['hgap', t('mxHGap'), 0.01], ['vgap', t('mxVGap'), 0.01]];
  const formHtml = (s = {}) => `<div class="mx-sheetform">${F.map(([k, l, step]) => `<label>${h(l)}<input data-f="${k}" ${step === 'text' ? '' : `type="number" step="${step}" min="0"`} value="${h(s[k] ?? '')}"></label>`).join('')}
    <label>${h(t('mxShape'))}<select data-f="shape"><option value="rect"${s.shape !== 'round' ? ' selected' : ''}>▭ ${h(t('mxRect'))}</option><option value="round"${s.shape === 'round' ? ' selected' : ''}>◯ ${h(t('mxRound'))}</option></select></label></div>`;
  const dlg = dialog(`<h3>🏷 ${h(t('mxManageSheets'))}</h3>
    <p class="muted small">${h(t('mxSheetsHint'))}</p>
    <ul class="mx-plist">${lib.map((s) => `<li>${s.shape === 'round' ? '◯' : '▭'} <b>${h(s.name)}</b> <span class="muted small">${s.cols}×${s.rows} · ${s.w}″×${s.h}″</span>
      <button type="button" class="linkish small" data-edit="${h(s.id)}">${h(t('mxEdit'))}</button> <button type="button" class="linkish small danger" data-rm="${h(s.id)}">${h(t('deleteBtn'))}</button></li>`).join('') || `<li class="muted">—</li>`}</ul>
    <h4 id="mxsh-title">+ ${h(t('mxNewSheet'))}</h4>
    <div id="mxsh-form">${formHtml({ shape: 'rect', cols: 3, rows: 10, w: 2.625, h: 1, top: 0.5, left: 0.19, hgap: 0.125, vgap: 0 })}</div>
    <div class="dialog-actions"><button type="button" class="btn primary" id="mxsh-save">${h(t('saveBtn'))}</button><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`, true);
  let editing = '';
  $$('[data-edit]', dlg).forEach((b) => { b.onclick = () => { editing = b.dataset.edit; $('#mxsh-form', dlg).innerHTML = formHtml(lib.find((s) => s.id === editing)); $('#mxsh-title', dlg).textContent = t('mxEdit'); }; });
  $$('[data-rm]', dlg).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(t('mmConfirmDelete', { name: lib.find((s) => s.id === b.dataset.rm)?.name || '' }))) return;
      try { await saveSheetsLib(lib.filter((s) => s.id !== b.dataset.rm)); dlg.close(); renderMailMerge(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
  $('#mxsh-save', dlg).onclick = async () => {
    const s = { id: editing || `sh${Date.now().toString(36)}` };
    $$('[data-f]', dlg).forEach((el) => { s[el.dataset.f] = el.type === 'number' ? Number(el.value) : el.value.trim(); });
    if (!s.name || !(s.cols > 0) || !(s.rows > 0) || !(s.w > 0) || !(s.h > 0)) { ui.toast(t('mxSheetInvalid'), 'error'); return; }
    if (s.left + s.cols * s.w + (s.cols - 1) * s.hgap > 8.55 || s.top + s.rows * s.h + (s.rows - 1) * s.vgap > 11.05) { ui.toast(t('mxSheetTooBig'), 'error'); return; }
    const next = editing ? lib.map((x) => (x.id === editing ? s : x)) : [...lib, s];
    try {
      await saveSheetsLib(next);
      if (D.kind === 'lbl') { D.lbl.sheet = s.id; scheduleSave(); }
      dlg.close();
      renderMailMerge();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
}

// ---------- דרוקן / PDF ----------
function rangeRows() {
  const from = Math.max(1, Number($('#mx-from')?.value) || 1);
  const to = Math.min(rows.length, Number($('#mx-to')?.value) || rows.length);
  return rows.slice(from - 1, Math.max(from - 1, to));
}
function pagesFor(D2, list, { nums = false, start = 0 } = {}) {
  if (D2.kind === 'lbl') return labelPages(D2, list, { all: false, nums: nums ? list.map((_, i) => String(start + i + 1)) : null });
  return list.flatMap((c, i) => (D2.kind === 'ltr' ? letterPages(D2, c, { num: nums ? String(start + i + 1) : '' }) : [envHtml(D2, c, { num: nums ? String(start + i + 1) : '' })]));
}
function confirmRed() {
  if (worst() < 3) return true;
  const n = [...probs.values()].filter((p) => p.sev === 'red').reduce((s, p) => s + p.items.length, 0);
  return confirm(t('mxRedConfirm', { n }));
}
async function output(mode, { test = false } = {}) {
  if (D.kind === 'lbl' && D.lbl.mode === 'same') {
    const pages = labelPages(D, []);
    if (mode === 'print') printPages(test ? pages.slice(0, 1) : pages, [8.5, 11]);
    else await downloadPdf(pages, [8.5, 11], D.name);
    return;
  }
  if (!rows.length) { ui.toast(t('mmNoRecords'), 'error'); return; }
  if (!test && !confirmRed()) return;
  const list = test ? [viewRows()[idx] || rows[0]] : rangeRows();
  const pages = pagesFor(D, list);
  const size = pageSize(D);
  if (mode === 'print') printPages(test && D.kind === 'lbl' ? pages.slice(0, 1) : pages, size);
  else await downloadPdf(pages, size, D.name);
}
/** "א פּאָר": בריוו + קאנווערטן — צוויי PDF אין דער זעלבער ריי, מיט קליינע נומערן */
async function outputPair() {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(D.ltr.pairEnv));
  if (!x) { ui.toast(t('mxPairMissing'), 'error'); return; }
  if (!confirmRed()) return;
  const E = fromRow(x);
  const list = rangeRows();
  const start = Math.max(0, (Number($('#mx-from')?.value) || 1) - 1);
  await downloadPdf(pagesFor(D, list, { nums: true, start }), pageSize(D), `${D.name} – letters`);
  await downloadPdf(pagesFor(E, list, { nums: true, start }), pageSize(E), `${D.name} – ${E.kind === 'lbl' ? 'labels' : 'envelopes'}`);
}
/** די בלעטער אין א פארבארגענעם פלאץ, פאסן (לעיבלס), און גיט צוריק דעם HTML */
async function fitted(pages) {
  const box = measureEl();
  const out = [];
  for (const p of pages) {
    box.innerHTML = p;
    fitIn(box);
    $$('.mx-over', box).forEach((el) => el.classList.remove('mx-over'));
    out.push(box.innerHTML);
  }
  box.innerHTML = '';
  return out;
}
async function printPages(pages, [W, H]) {
  let area = $('#mx-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'mx-print-area'; area.dir = 'ltr'; document.body.append(area); }
  area.innerHTML = (await fitted(pages)).join('');
  let st = $('#mx-page-style');
  if (!st) { st = document.createElement('style'); st.id = 'mx-page-style'; document.head.append(st); }
  st.textContent = `@page { size: ${W}in ${H}in; margin: 0; }`;
  document.body.classList.add('printing-mx');
  const done = () => { document.body.classList.remove('printing-mx'); area.innerHTML = ''; st.textContent = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  await Promise.all($$('img', area).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  if (document.fonts?.ready) await document.fonts.ready;
  window.print();
}
async function downloadPdf(pages, [W, H], name) {
  const prog = dialog(`<h3>⬇ PDF</h3><p id="mx-prog">0 / ${pages.length}</p>`);
  try {
    const html = await fitted(pages);
    const jpgs = [];
    for (let i = 0; i < html.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      jpgs.push(await htmlToJpeg(`<div dir="ltr" class="mx-out" style="width:${W}in;height:${H}in">${html[i]}</div>`, { widthIn: W, heightIn: H, scale: html.length > 60 ? 1.6 : 2 }));
      const p = $('#mx-prog', prog);
      if (p) p.textContent = `${i + 1} / ${html.length}`;
    }
    const bytes = jpegsToPdf(jpgs, { pageW: W * 72, pageH: H * 72, margin: 0 });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = `${String(name || 'mail-merge').replace(/[\\/:*?"<>|]+/g, '_')}.pdf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); } finally { prog.close(); }
}

// ---------- בריוו אין אימעיל ----------
async function sendEmails() {
  const list = rangeRows();
  const withMail = list.filter((c) => emailOf(c));
  const without = list.filter((c) => !emailOf(c));
  if (!withMail.length) { ui.toast(t('mxNoEmails'), 'error'); return; }
  if (!nz(D.ltr.subject)) { ui.toast(t('mxSubjectRequired'), 'error'); return; }
  if (!confirm(t('mxSendConfirm', { n: withMail.length, m: without.length }))) return;
  try { await ensureGmailScope(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); return; }
  const prog = dialog(`<h3>📧 ${h(t('mxSendEmail'))}</h3><p id="mx-prog">0 / ${withMail.length}</p>`);
  try {
    const jobs = [];
    for (const c of withMail) {
      const vals = valuesFor(D, c);
      // בילדער אינעם טעקסט → "cid:" (אימעיל פראגראמען ווייזן נישט קיין data:)
      const imgs = [];
      const filled = resolveImgs(fillHtml(expandRepeats(cleanHtml(D.ltr.html), D, c), vals)).replace(/src="(data:image\/[^"]+)" data-drv="([\w-]+)"/g, (m, d) => { imgs.push(d); return `src="cid:bimg${imgs.length}" style="max-width:100%"`; });
      const body = `<div dir="${D.ltr.dir}" style="text-align:${D.ltr.dir === 'rtl' ? 'right' : 'left'}">${filled}</div>`;
      const org = D.ltr.design === 'org' ? D.ltr.org : umbrellaName();
      const { html, inline } = emailLayout(org, body);
      imgs.forEach((d, i) => inline.push({ cid: `bimg${i + 1}`, dataUrl: d }));
      const pgs = await fitted(letterPages(D, c));
      const jpgs = [];
      const [PW, PH] = pageSize(D);
      // eslint-disable-next-line no-await-in-loop
      for (const pg of pgs) jpgs.push(await htmlToJpeg(`<div dir="ltr" class="mx-out" style="width:${PW}in;height:${PH}in">${pg}</div>`, { widthIn: PW, heightIn: PH, scale: 1.6 }));
      const bytes = jpegsToPdf(jpgs, { pageW: PW * 72, pageH: PH * 72, margin: 0 });
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      jobs.push({
        to: emailOf(c), contact_id: c.contact_id, subject: fillText(D.ltr.subject, vals), html, inline, text: body.replace(/<[^>]+>/g, ' '),
        kind: 'letter', org, attachments: [{ name: `${String(D.name).replace(/[\\/:*?"<>|]+/g, '_')}.pdf`, mime: 'application/pdf', b64: btoa(bin) }],
      });
      const p = $('#mx-prog', prog);
      if (p) p.textContent = `${t('mxPreparing')} ${jobs.length} / ${withMail.length}`;
    }
    const det = orgDetailsOf(jobs[0].org) || {};
    const res = await sendJobs(jobs, { fromName: det.org_name_he || jobs[0].org, onProgress: (d, n) => { const p = $('#mx-prog', prog); if (p) p.textContent = `${d} / ${n}`; } });
    prog.close();
    ui.toast(t('mxSent', { n: res.done - res.errors, e: res.errors }));
    if (without.length && confirm(t('mxPrintRest', { n: without.length }))) printPages(pagesFor(D, without), pageSize(D));
  } catch (err) { prog.close(); ui.toast(ui.friendlyError(err), 'error'); }
}

// ---------- פאר די קבלות: א בריוו פון א מוסטער ----------
export function letterTemplates() {
  return templatesOf('ltr').map((x) => ({ id: x.template_id, name: x.name }));
}
/** א בריוו-בלאט (8.5×11) פאר א מענטש, מיט די נדבה-פרטים פון דער קבלה */
export function letterPage(templateId, c, ctx = null) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(templateId));
  if (!x || !c) return '';
  return letterPagesFor(templateId, c, ctx).join('');
}
/** די בלעטער פון א מכתב (איינס אדער מער) */
/** האט דער בריוו "ייבוא קבלה" (די קבלה אינעם אונטערשטן דריטל)? */
export function letterHasReceipt(templateId) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(templateId));
  return Boolean(x && fromRow(x).ltr.rcSlot);
}
/** מיין חתימה (פאר די קבלות) */
export const mySigObj = () => mySig();
/** די גרייס פונעם בלאט פון א בריוו (אינטשעס) */
export function letterSizeFor(templateId) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(templateId));
  return x ? letterDims(fromRow(x)) : [8.5, 11];
}
export function letterPagesFor(templateId, c, ctx = null) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(templateId));
  if (!x || !c) return [];
  return letterPages(fromRow(x), c, { ctx });
}
