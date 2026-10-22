// Mail Merge (נייע): דריי זאכן — ✉ קאנווערטן, 🏷 לעיבלס, 📄 בריוו.
// א הויפט-בלאט מיט דריי קאלומען (יעדע מיט אירע געשפייכלערטע עיצובים), און א עדיטאר פאר יעדן סארט.
// די נמענים: א רשימה / איין מענטש / אריינקלעבן. א פראבלעמען-שטרייף, פאָרויסזיכט, דרוקן / PDF, און אליין-שפייכלערן.
import { customFontNames } from './fonts.js';
import { state, saveRecord, deleteRecord, allUsers, orgDetailsOf } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, shrinkImage, nowStamp, detectArea } from './util.js';
import { evaluate, parseSaved, savedInScope, channel, mailRecipients } from './lists.js';
import { umbrellaName, getScope } from './scope.js';
import { allCampaigns } from './campaigns.js';
import { htmlToJpeg, jpegsToPdf } from './pdf.js';
import { emailOf, emailLayout, sendJobs } from './mail.js';
import { ensureGmailScope } from './google.js';
import { helperOn } from './images.js';
import {
  ENVELOPES, FONTS_EN, FONTS_HE, allSheets, sheetOf, setCustomSheets, envSize, pageSize, envHtml, labelPages, letterHtml,
  labelsPerSheet, valuesFor, fillText, fillHtml, cleanHtml, donationCtx, hasAddr, partAddr, addrKey, isDeceased,
} from './mm-render.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const KINDS = [['env', '✉', 'mxEnvelopes'], ['lbl', '🏷', 'mxLabels'], ['ltr', '📄', 'mxLetters']];
const SHEETS_NAME = '__label_sheets__';
const TOKENS_HE = ['פנייה', 'תואר', 'שם_מלא', 'שם', 'שם_פרטי', 'משפחה', 'אשה', 'תאריך', 'סכום', 'שולם', 'נשאר', 'תאריך_נדבה', 'הקדשה', 'קאמפיין'];
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
  saveState = 'dirty';
  showSaveState();
  saveTimer = setTimeout(() => { persist().catch((err) => { saveState = 'error'; showSaveState(); ui.toast(ui.friendlyError(err), 'error'); }); }, ms);
}
async function persist() {
  if (!D) return;
  clearTimeout(saveTimer);
  saveState = 'saving';
  showSaveState();
  const {
    template_id: tid, name, format, logo_data: ld, background_data: bd, postage_data: pd, _ids, ...rest
  } = D;
  const settings = JSON.stringify({ ...rest, _v: 2 });
  const fmt = D.kind === 'lbl' ? D.lbl.sheet : D.kind === 'ltr' ? 'letter' : format;
  const prev = current();
  const rec = { ...(prev || {}), template_id: tid || '', name: nz(name) || t('mxUntitled'), format: fmt, settings, logo_data: ld, background_data: bd, postage_data: pd };
  const id = await saveRecord('MailTemplates', 'template_id', rec);
  const stamp = nowStamp();
  if (prev) Object.assign(prev, rec, { updated_at: stamp, updated_by: state.email });
  else state.mailTemplates.push({ ...rec, template_id: id, created_at: stamp, created_by: state.email, updated_at: stamp, updated_by: state.email });
  D.template_id = id;
  saveState = 'saved';
  showSaveState();
}
function showSaveState() {
  const el = $('#mx-save-state');
  if (!el) return;
  el.textContent = { dirty: '…', saving: t('mxSaving'), saved: `✓ ${t('mxSavedAuto')}`, error: `⚠ ${t('mxSaveFail')}`, ro: t('mxReadOnly') }[saveState] || '';
  el.className = `mx-save ${saveState}`;
}

// ---------- דער הויפט-בלאט ----------
function renderHome(main) {
  const who = (x) => { const e = String(x.created_by || ''); return e.split('@')[0]; };
  const card = (x) => {
    const m = metaOf(x);
    return `<div class="mx-card" data-id="${h(x.template_id)}">
      <div class="mx-card-name">${m.visibility === 'private' ? '🔒 ' : ''}${h(x.name || t('mxUntitled'))}</div>
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
      <button type="button" class="btn primary mx-new" data-new="${k}">+ ${h(t('mxNew'))}</button>
      <div class="mx-list">${templatesOf(k).map(card).join('') || `<p class="muted small">${h(t('mxNone'))}</p>`}</div>
    </section>`).join('')}</div>`;
  $('#mx-pending-x', main)?.addEventListener('click', () => { pending = null; pendingList = ''; renderHome(main); });
  $$('[data-new]', main).forEach((b) => { b.onclick = () => createNew(b.dataset.new); });
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

async function createNew(kind) {
  D = defaults(kind);
  D.name = `${t(KINDS.find(([k]) => k === kind)[2])} ${nowStamp().slice(0, 10)}`;
  applyPending();
  view = 'edit';
  idx = 0;
  skipIds = new Set();
  renderMailMerge();
  try { await persist(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}
function openTemplate(id) {
  const x = state.mailTemplates.find((r) => String(r.template_id) === String(id));
  if (!x) return;
  D = fromRow(x);
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
function computeRows() {
  info = { excluded: [], nosend: [] };
  let list = [];
  const s = D.src;
  if (D.kind === 'lbl' && D.lbl.mode === 'same') { rows = []; return; }
  if (D._ids) list = D._ids.map((id) => ui.contactById(id)).filter(Boolean);
  else if (s.type === 'contact') { const c = s.contact ? ui.contactById(s.contact) : null; list = c ? [c] : []; }
  else if (s.type === 'paste') list = parsePaste(s.paste);
  else {
    const id = listKey().split(':')[1];
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
  if (D.sort === 'name') list.sort(byName);
  else if (D.sort === 'zip') list.sort((a, b) => nz(a.zip).localeCompare(nz(b.zip)) || nz(a.address).localeCompare(nz(b.address)));
  else if (D.sort === 'area') list.sort((a, b) => areaOf(a).localeCompare(areaOf(b), 'he') || byName(a, b));
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
    box.innerHTML = D.kind === 'lbl' ? labelPages({ ...D, lbl: { ...D.lbl, skip: 0 } }, [c], { all: false })[0] : D.kind === 'ltr' ? letterHtml(D, c) : envHtml(D, c);
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
  const envs = templatesOf('env').map((x) => [x.template_id, x.name]);
  return `<details open><summary>${h(t('mxLetterLang'))}</summary>
      <div class="mm-grid"><label>${h(t('mxLang'))}${sel('ltr.lang', [['yi', 'אידיש'], ['he', 'עברית'], ['en', 'English']], L.lang)}</label>
      <label>${h(t('mxDir'))}${sel('ltr.dir', [['rtl', t('mxRtl')], ['ltr', t('mxLtr')]], L.dir)}</label></div>
    </details>
    <details open><summary>${h(t('mxDesign'))}</summary>
      ${sel('ltr.design', [['org', t('mxDesignOrg')], ['bg', t('mxDesignBg')], ['none', t('mxDesignNone')]], L.design)}
      ${L.design === 'org' ? `<label class="mm-l">${h(t('mxOrg'))}${sel('ltr.org', orgOptions().map((o) => [o, o]), L.org)}</label>
        <label class="mm-l">${h(t('mxBannerH'))}${num('ltr.bannerH', L.bannerH, 0.5, 4, 0.1)}</label>
        ${chk('ltr.sig', L.sig, t('mxSig'))}` : ''}
      ${L.design === 'bg' ? `<input type="file" accept="image/*" data-upload="background_data">
        ${D.background_data ? `<button type="button" class="btn small-btn" data-clear="background_data">${h(t('mmRemoveBg'))}</button>` : ''}
        <label class="mm-l">${h(t('mmOpacity'))}<input type="range" data-k="bg.opacity" min="0.05" max="1" step="0.01" value="${D.bg.opacity}"></label>` : ''}
    </details>
    <details open><summary>${h(t('mxLink'))}</summary>
      <p class="muted small">${h(t('mxLinkHint'))}</p>
      ${sel('link.name', [['', t('mmNone')], ...camps], D.link.name)}
    </details>
    <details open><summary>${h(t('mxBody'))}</summary>
      <label class="mm-l">${h(t('mxSalutation'))}<input data-k="ltr.salutation" dir="rtl" value="${h(L.salutation)}"></label>
      ${rteHtml('ltr', L.html, L.dir)}
      <div class="mm-grid"><label>${h(t('mmFont'))}${sel('ltr.font', [...new Set([...customFontNames(), ...FONTS_HE, ...FONTS_EN])].map((f) => [f, f]), L.font)}</label>
      <label>${h(t('mmSize'))}${num('ltr.size', L.size, 8, 30, 0.5)}</label>
      <label>${h(t('mxLineH'))}${sel('ltr.lineH', [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2].map((n) => [n, n]), L.lineH)}</label></div>
      <div class="mm-grid"><label>${h(t('mxMarginTop'))}${num('ltr.margins.top', L.margins.top, 0.2, 4, 0.05)}</label>
      <label>${h(t('mxMarginSide'))}${num('ltr.margins.side', L.margins.side, 0.2, 2.5, 0.05)}</label>
      <label>${h(t('mxMarginBottom'))}${num('ltr.margins.bottom', L.margins.bottom, 0.2, 3, 0.05)}</label></div>
    </details>
    <details${L.window ? ' open' : ''}><summary>${h(t('mxWindow'))}</summary>
      ${chk('ltr.window', L.window, t('mxWindowOn'))}
      ${L.window ? `<p class="muted small">${h(t('mxWindowHint'))}</p>
        <label class="mm-l">${h(t('mxLang'))}${sel('ltr.winLang', [['en', 'English'], ['he', 'לשון קודש'], ['both', t('mxBoth')]], L.winLang)}</label>
        <div class="mm-grid"><label>X (in)${num('ltr.win.x', L.win.x, 0, 7, 0.05)}</label><label>Y (in)${num('ltr.win.y', L.win.y, 0, 9, 0.05)}</label>
        <label>${h(t('mxWidth'))}${num('ltr.win.w', L.win.w, 1, 7, 0.05)}</label><label>${h(t('mxHeight'))}${num('ltr.win.h', L.win.h, 0.5, 3, 0.05)}</label></div>` : ''}
    </details>
    ${D.src.email ? `<details open><summary>${h(t('mxEmail'))}</summary>
      <label class="mm-l">${h(t('mxSubject'))}<input data-k="ltr.subject" dir="auto" value="${h(L.subject)}"></label></details>` : ''}
    <details><summary>${h(t('mxPair'))}</summary>
      <p class="muted small">${h(t('mxPairHint'))}</p>
      ${sel('ltr.pairEnv', [['', t('mmNone')], ...envs], L.pairEnv)}
    </details>`;
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
  } else page = D.kind === 'ltr' ? letterHtml(D, c, { edit: true }) : envHtml(D, c, { edit: true });
  const red = worst() >= 3;
  const nav = D.kind === 'lbl' && D.lbl.mode === 'same' ? '' : `<button type="button" class="btn small-btn" id="mx-prev">‹</button>
      <span>${vr.length ? h(t('mmRecordOf', { i: idx + 1, n: vr.length })) : h(t('mmNoRecords'))}</span>
      <button type="button" class="btn small-btn" id="mx-next">›</button>
      ${c ? `<span class="muted small mx-who">${h(nameOf(c))}${(byRow.get(keyOf(c)) || []).length ? ` · ⚠ ${(byRow.get(keyOf(c)) || []).map((k) => h(t(PROB_LABEL[k]))).join(', ')}` : ''}</span>
        ${c.contact_id && !c._ext ? `<button type="button" class="linkish small" data-card="${h(c.contact_id)}">${h(t('mxOpenCard'))}</button>` : ''}
        <button type="button" class="linkish small" id="mx-skip">${h(t('mxSkipOne'))}</button>` : ''}
      ${skipIds.size ? `<button type="button" class="linkish small" id="mx-unskip">${h(t('mxUnskip', { n: skipIds.size }))}</button>` : ''}`;
  const total = D.kind === 'lbl' && D.lbl.mode === 'same' ? `${D.lbl.sheets || 1} × ${labelsPerSheet(D)}` : rows.length;
  return `<div class="mm-nav">${nav}</div>
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
    <div class="mm-layout">
      <aside class="mm-panel"${ro ? ' inert' : ''}>
        ${recipientsHtml()}
        ${D.kind === 'env' ? envEditHtml() : D.kind === 'lbl' ? lblEditHtml() : letterEditHtml()}
      </aside>
      <section class="mm-stage" id="mx-stage">${stageHtml()}</section>
    </div>`;
  showSaveState();
  fitPreview();
  wireEditor(main);
  measureAll();
}

function fitPreview() {
  const canvas = $('#mm-canvas');
  const inner = canvas?.firstElementChild;
  if (!inner) return;
  fitIn(canvas);
  const avail = canvas.clientWidth - 20;
  const scale = Math.min(1.3, avail / inner.offsetWidth);
  inner.style.transform = `scale(${scale})`;
  inner.style.transformOrigin = 'top left';
  canvas.style.height = `${inner.offsetHeight * scale + 20}px`;
  canvas.dataset.scale = scale;
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

function wireEditor(main) {
  $('#mx-back', main).onclick = async () => {
    if (saveState === 'dirty') { try { await persist(); } catch { /* */ } }
    view = 'home';
    D = null;
    renderMailMerge();
  };
  $('#mx-name', main)?.addEventListener('input', (e) => { D.name = e.target.value; scheduleSave(); });
  $('#mx-settings', main)?.addEventListener('click', openSettings);
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
  $$('[data-k]', main).forEach((el) => {
    const apply = () => {
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
    };
    const live = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'color', 'file'].includes(el.type));
    el.addEventListener(live ? 'input' : 'change', apply);
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
  $$('[data-upload]', main).forEach((inp) => {
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
  $$('[data-clear]', main).forEach((b) => { b.onclick = () => { D[b.dataset.clear] = ''; scheduleSave(); renderMailMerge(); }; });
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
  const vr = () => viewRows();
  $('#mx-prev', main)?.addEventListener('click', () => { idx = Math.max(0, idx - 1); refreshStage(); });
  $('#mx-next', main)?.addEventListener('click', () => { idx = Math.min(vr().length - 1, idx + 1); refreshStage(); });
  $$('#mx-stage [data-card]', main).forEach((b) => { b.onclick = () => ui.openCard(b.dataset.card); });
  $('#mx-skip', main)?.addEventListener('click', () => { const c = vr()[idx]; if (c) skipIds.add(keyOf(c)); refreshAll(); });
  $('#mx-unskip', main)?.addEventListener('click', () => { skipIds = new Set(); refreshAll(); });
  $('#mx-print', main)?.addEventListener('click', () => output('print'));
  $('#mx-pdf', main)?.addEventListener('click', () => output('pdf'));
  $('#mx-test', main)?.addEventListener('click', () => output('print', { test: true }));
  $('#mx-pair', main)?.addEventListener('click', () => outputPair());
  $('#mx-send', main)?.addEventListener('click', () => sendEmails());
  wireDrag();
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
  return list.map((c, i) => (D2.kind === 'ltr' ? letterHtml(D2, c, { num: nums ? String(start + i + 1) : '' }) : envHtml(D2, c, { num: nums ? String(start + i + 1) : '' })));
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
      const body = `<div dir="${D.ltr.dir}" style="text-align:${D.ltr.dir === 'rtl' ? 'right' : 'left'}">${fillHtml(cleanHtml(D.ltr.html), vals)}</div>`;
      const org = D.ltr.design === 'org' ? D.ltr.org : umbrellaName();
      const { html, inline } = emailLayout(org, body);
      const [pg] = await fitted([letterHtml(D, c)]);
      // eslint-disable-next-line no-await-in-loop
      const jpg = await htmlToJpeg(`<div dir="ltr" class="mx-out" style="width:8.5in;height:11in">${pg}</div>`, { widthIn: 8.5, heightIn: 11, scale: 1.6 });
      const bytes = jpegsToPdf([jpg], { pageW: 612, pageH: 792, margin: 0 });
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
    if (without.length && confirm(t('mxPrintRest', { n: without.length }))) printPages(pagesFor(D, without), [8.5, 11]);
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
  const T = fromRow(x);
  return letterHtml(T, c, { ctx });
}
