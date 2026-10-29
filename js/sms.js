// Calls & SMS: שליחות צום עולם (SMS / א הקלטה), קרעדיטן, הקלטות, און ניהול.
// דער "מוח" איז אן Apps Script (CONFIG.SMS_URL); דא לייענט מען די לשוניות גלייך פונעם גיליון.
import { CONFIG } from './config.js';
import { state, allUsers } from './data.js';
import { readTabs, appendRows, updateRow, currentToken } from './google.js';
import { t } from './i18n.js';
import { escapeHtml as h, nowStamp, digits } from './util.js';
import { evaluate, parseSaved, savedInScope, channel, openBuilder } from './lists.js';
import { fromHebrew, toHebrew, todayIso } from './hebdate.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const last10 = (p) => { const d = digits(p); return d.length >= 10 ? d.slice(-10) : ''; };
const fmtPhone = (p) => { const d = last10(p); return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : ''; };

let view = 'home'; // home | sms | auto | calls | track | credits | perms | lists | gabbai | admin
let data = null; // { opt: Map, optRows, jobs, credits, recs, config }
let draft = { kind: 'sms', list: '', text: '', title: '', when: '', rec: '' };
const OPT_HEAD = ['phone', 'status', 'source', 'contact_id', 'name', 'at', 'by'];
export const SOURCES = [['old_list', 'smsSrcOld'], ['verbal', 'smsSrcVerbal'], ['join', 'smsSrcJoin'], ['other', 'smsSrcOther']];

export function initSms(helpers) { ui = helpers; }
export const smsOn = () => Boolean(CONFIG.SMS_URL);

async function call(action, body = {}) {
  if (!CONFIG.SMS_URL) throw new Error(t('smsNotConnected'));
  const res = await fetch(CONFIG.SMS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, action, token: currentToken() }) });
  const r = await res.json();
  if (r.error) throw new Error(errText(r));
  return r;
}
function errText(r) {
  const map = { 'no-credits': t('smsNoCredits', { need: money(r.need), have: money(r.have) }), 'not-allowed': t('smsNotAllowed'), 'no-recipients': t('smsNoRecipients'), 'no-stripe': t('smsNoStripe'), 'admin-only': t('adminOnly') };
  return map[r.error] || r.error;
}
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/** לייענט די SMS לשוניות (יעדע באזונדער — א לשונית וואס איז נאך נישטא איז נישט קיין פראבלעם) */
export async function loadSms(force = false) {
  if (data && !force) return data;
  const get = async (name) => { try { return (await readTabs([name]))[name] || []; } catch { return []; } };
  const [opt, jobs, credits, recs, cfg] = await Promise.all(['SmsOptIn', 'SmsJobs', 'Credits', 'SmsRecordings', 'SmsConfig'].map(get));
  const objs = (rows) => { const [hd = [], ...b] = rows; return b.map((r, i) => ({ _row: i + 2, ...Object.fromEntries(hd.map((k, j) => [k, r[j] ?? ''])) })).filter((o) => Object.values(o).some((v, j) => j && v !== '')); };
  const optRows = objs(opt);
  data = {
    optHead: opt[0] || [], optRows, opt: new Map(optRows.map((o) => [last10(o.phone), o])),
    jobs: objs(jobs), credits: objs(credits), recs: objs(recs), config: Object.fromEntries(objs(cfg).map((o) => [o.key, String(o.value)])),
  };
  return data;
}
const myCredits = () => Math.round((data?.credits || []).filter((r) => String(r.email).toLowerCase() === state.email).reduce((s, r) => s + (Number(r.delta) || 0), 0) * 10000) / 10000;
// יעדע מעסעדזש צום עולם הייבט זיך אן מיטן נאמען ("Khal Ungvar: ...") — ווי אין sms.gs
const brandOf = () => String(data?.config?.sms_brand || '').trim() || 'Khal Ungvar';
const branded = (text) => { const b = brandOf(); const s = String(text || '').trim(); return s.toLowerCase().startsWith(b.toLowerCase()) ? s : `${b}: ${s}`; };
const price = (kind, text) => {
  const c = data?.config || {};
  if (kind === 'call') return Number(c.price_call) || 0.03;
  const s = branded(text);
  const seg = /[^\x00-\x7F]/.test(s) ? (s.length <= 70 ? 1 : Math.ceil(s.length / 67)) : (s.length <= 160 ? 1 : Math.ceil(s.length / 153));
  return (Number(c.price_sms) || 0.01) * Math.max(1, seg);
};
const segCount = (s) => (/[^\x00-\x7F]/.test(s) ? (s.length <= 70 ? 1 : Math.ceil(s.length / 67)) : (s.length <= 160 ? 1 : Math.ceil(s.length / 153)));

// ---------- וועמען מ'שיקט ----------
const phonesOf = (c) => c._phones || state.phones.get(String(c.contact_id)) || {};
const nm = (c) => ui.fullNameHe(c) || [c.first_name_en, c.last_name_en].filter(Boolean).join(' ');
export function recipientsOf(listId, kind) {
  const l = state.savedLists.find((x) => String(x.list_id) === String(listId));
  const st = { total: 0, nophone: [], nosend: [], noconsent: [], out: [], dup: 0 };
  if (!l) return { list: [], st };
  const { cr } = parseSaved(l);
  const all = evaluate(cr);
  st.total = all.length;
  const okKeys = new Set(channel(all, 'phones', cr.includeNoSend).rows.map((r) => r.key));
  const seen = new Set();
  const list = [];
  all.forEach((r) => {
    const p = phonesOf(r.c);
    const d = last10(kind === 'call' ? (p.mobile || p.home_phone) : p.mobile);
    if (!d) { st.nophone.push(r.c); return; }
    const o = data?.opt.get(d);
    if (o && String(o.status) === 'out') { st.out.push(r.c); return; }
    const self = o && String(o.source) === 'join' && String(o.status) === 'in';
    if (!okKeys.has(r.key) && !self) { st.nosend.push(r.c); return; }
    if (!o || String(o.status) !== 'in') { st.noconsent.push({ c: r.c, d }); return; }
    if (seen.has(d)) { st.dup += 1; return; }
    seen.add(d);
    list.push({ phone: d, contact_id: r.c.contact_id, name: nm(r.c) });
  });
  return { list, st };
}

// ---------- שבת / יום טוב ----------
/** די ימים טובים (חוץ לארץ) + ערב יום טוב, פאר צוויי יאר */
export function ytDates() {
  const h = toHebrew(todayIso());
  const yt = []; const erev = [];
  [h.y, h.y + 1].forEach((y) => {
    [[1, 'Tishri'], [2, 'Tishri'], [10, 'Tishri'], [15, 'Tishri'], [16, 'Tishri'], [22, 'Tishri'], [23, 'Tishri'],
      [15, 'Nisan'], [16, 'Nisan'], [21, 'Nisan'], [22, 'Nisan'], [6, 'Sivan'], [7, 'Sivan']].forEach(([d, m]) => yt.push(fromHebrew(d, m, y)));
    [[9, 'Tishri'], [14, 'Tishri'], [21, 'Tishri'], [14, 'Nisan'], [20, 'Nisan'], [5, 'Sivan']].forEach(([d, m]) => erev.push(fromHebrew(d, m, y)));
    erev.push(fromHebrew(29, 'Elul', y - 1));
  });
  return { yt: yt.filter(Boolean).sort(), erev: erev.filter(Boolean).sort() };
}
function blockedReason(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = iso.slice(0, 10);
  const hr = d.getHours() + d.getMinutes() / 60;
  const c = data?.config || {};
  const { yt, erev } = ytDates();
  if (d.getDay() === 6 || yt.includes(day)) return t('smsBlockedShabbos');
  if ((d.getDay() === 5 || erev.includes(day)) && hr >= (Number(c.friday_cutoff) || 13)) return t('smsBlockedErev');
  if (hr < (Number(c.quiet_to) || 8) || hr >= (Number(c.quiet_from) || 21)) return t('smsBlockedHours');
  return '';
}

// ---------- דער בלאט ----------
export async function openCalls() {
  view = 'home';
  document.body.classList.add('solo-mode');
  ui.showView('calls');
}
// די כפתורים פונעם הויפט־בלאט: [view, icon, label, sub]
const BIG = [
  [['sms', '💬', 'csSms', 'csSmsSub'], ['auto', '🔁', 'csAuto', 'csAutoSub']],
  [['calls', '📞', 'csCalls', 'csCallsSub'], ['track', '📋', 'csTrack', 'csTrackSub']],
];
const WIDE = ['lists', '📇', 'csLists']; // מתחת די צוויי טורן, איבער דער גאנצער ברייט
const SMALL = () => [['credits', '💳', 'csCredits'], ['perms', '✅', 'csPerms'], ['gabbai', '🤖', 'csGabbai'],
  ...(state.isAdmin ? [['admin', '⚙', 'csAdmin']] : [])];
const viewTitle = (v) => { const all = [...BIG.flat(), WIDE, ...SMALL()]; const x = all.find(([k]) => k === v); return x ? `${x[1]} ${t(x[2])}` : ''; };

export async function renderCalls() {
  const main = $('#calls-main');
  if (!main) return;
  if (!smsOn()) {
    main.innerHTML = `<div class="camp-page-head"><h2>📞 Calls &amp; SMS</h2></div><div class="soon-box"><p>${h(t('smsNotConnected'))}</p><p class="muted small">${h(t('smsSetupHint'))}</p></div>`;
    return;
  }
  if (!data) main.innerHTML = `<p class="muted">${h(t('loading'))}</p>`;
  await loadSms();
  if (new URLSearchParams(location.search).get('credits') === 'ok') { ui.toast(t('smsPaidThanks')); history.replaceState(null, '', location.pathname); view = 'credits'; }
  if (view === 'admin' && !state.isAdmin) view = 'home';
  main.innerHTML = `<div class="camp-page-head">
      ${view !== 'home' ? `<button type="button" class="btn cs-back" id="cs-back">→ ${h(t('csBack'))}</button>` : ''}
      <h2>${view === 'home' ? '📞 Calls &amp; SMS' : h(viewTitle(view))}</h2><span class="spacer"></span>
      <span class="sms-credits">💳 ${h(t('smsMyCredits'))}: <b>${money(myCredits())}</b></span></div>
    <div id="sms-body"></div>`;
  $('#cs-back', main)?.addEventListener('click', () => { view = 'home'; renderCalls(); });
  const body = $('#sms-body', main);
  if (view === 'home') homeView(body);
  else if (view === 'sms') sendTab(body, 'sms');
  else if (view === 'calls') { sendTab(body, 'call'); recsTab(body); }
  else if (view === 'track') jobsTab(body);
  else if (view === 'credits') creditsTab(body);
  else if (view === 'perms') permsView(body);
  else if (view === 'lists') listsView(body);
  else if (view === 'gabbai') gabbaiView(body);
  else if (view === 'auto') soonView(body, 'csAutoSoon');
  else adminTab(body);
}

function homeView(body) {
  const big = ([k, i, l, sub]) => `<button type="button" class="cs-big" data-go="${k}"><span class="cs-ic">${i}</span><b>${h(t(l))}</b><span class="muted small">${h(t(sub))}</span></button>`;
  body.innerHTML = `<div class="cs-home">
    ${BIG.map((col) => `<div class="cs-col">${col.map(big).join('')}</div>`).join('')}
    <button type="button" class="cs-sm cs-wide" data-go="${WIDE[0]}"><span>${WIDE[1]}</span> ${h(t(WIDE[2]))}</button>
    <div class="cs-small">${SMALL().map(([k, i, l]) => `<button type="button" class="cs-sm" data-go="${k}"><span>${i}</span> ${h(t(l))}</button>`).join('')}</div>
  </div>`;
  $$('[data-go]', body).forEach((b) => { b.onclick = () => { view = b.dataset.go; renderCalls(); }; });
}
function soonView(body, key) {
  body.innerHTML = `<div class="soon-box"><p>🚧 ${h(t('csSoon'))}</p><p class="muted small">${h(t(key))}</p></div>`;
}

/** הרשאות שליחה: ווער איז מסכים, ווער האט געזאגט STOP */
function permsView(body) {
  const rows = data.optRows.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const ins = rows.filter((o) => String(o.status) === 'in');
  const outs = rows.filter((o) => String(o.status) === 'out');
  const srcName = (k) => t((SOURCES.find(([x]) => x === k) || [, k === 'stop' ? 'smsSrcStop' : k === 'start' ? 'smsSrcStart' : 'smsSrcOther'])[1]);
  const who = (o) => { const c = o.contact_id ? state.contacts.find((x) => String(x.contact_id) === String(o.contact_id)) : null; return c ? nm(c) : (o.name || ''); };
  const table = (arr) => (arr.length ? `<table class="lapsed-table"><tbody>${arr.map((o) => `<tr data-q="${h(`${who(o)} ${digits(o.phone)}`.toLowerCase())}">
      <td>${h(who(o)) || '<span class="muted">—</span>'}${o.contact_id ? ` <button type="button" class="linkish small" data-card="${h(o.contact_id)}">${h(t('mxOpenCard'))}</button>` : ''}</td>
      <td dir="ltr" class="small">${h(fmtPhone(o.phone) || o.phone)}</td><td class="small">${h(srcName(String(o.source)))}</td>
      <td dir="ltr" class="muted small">${h(String(o.at).slice(0, 10))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">—</p>');
  body.innerHTML = `<p class="muted small">${h(t('csPermsHint'))}</p>
    <input id="pm-q" class="cs-search" placeholder="${h(t('csSearch'))}">
    <section class="cs-sec"><h3>✓ ${h(t('csPermsIn'))} (${ins.length})</h3>${table(ins)}</section>
    <section class="cs-sec"><h3>⛔ ${h(t('smsOptOuts'))} (${outs.length})</h3>${table(outs)}</section>`;
  $$('[data-card]', body).forEach((b) => { b.onclick = () => ui.openCard(b.dataset.card); });
  $('#pm-q', body).oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('tr[data-q]', body).forEach((tr) => { tr.hidden = q && !tr.dataset.q.includes(q); }); };
}

/** רשימות פאר הודעות און צלצולים (גרייטע רשימות מיטן ציל "טעלעפאנען") */
function listsView(body) {
  const mine = savedInScope().filter((l) => parseSaved(l).cr.meta?.firstTab === 'phones');
  body.innerHTML = `<p class="muted small">${h(t('csListsHint'))}</p>
    <button type="button" class="btn primary" id="cl-new">➕ ${h(t('csListNew'))}</button>
    ${mine.length ? `<table class="lapsed-table"><tbody>${mine.map((l) => {
    const sms = recipientsOf(l.list_id, 'sms').list.length; const calls = recipientsOf(l.list_id, 'call').list.length;
    return `<tr><td>${l.visibility === 'private' ? '🔒 ' : ''}<b>${h(l.name)}</b></td><td class="small">💬 ${sms} · 📞 ${calls}</td>
      <td><button type="button" class="linkish" data-open="${h(l.list_id)}">${h(t('csOpen'))}</button>
        <button type="button" class="linkish" data-send="${h(l.list_id)}">💬 ${h(t('csSendTo'))}</button></td></tr>`;
  }).join('')}</tbody></table>` : `<p class="empty">${h(t('csNoLists'))}</p>`}`;
  $('#cl-new', body).onclick = () => openBuilder(null, { name: '', criteria: { v: 2, meta: { firstTab: 'phones' } } });
  $$('[data-open]', body).forEach((b) => { b.onclick = () => openBuilder(state.savedLists.find((x) => String(x.list_id) === b.dataset.open)); });
  $$('[data-send]', body).forEach((b) => { b.onclick = () => { draft.list = b.dataset.send; view = 'sms'; renderCalls(); }; });
}

/** די גבאים אין SMS: הצטרפויות, וואס איז געטון געווארן, וואס האט נישט געקלאפט, און די שמועסן */
let glog = null; // { events, log }
async function loadGabbaiLog(force = false) {
  if (glog && !force) return glog;
  const get = async (name) => { try { return (await readTabs([name]))[name] || []; } catch { return []; } };
  const [evs, log] = await Promise.all([get('SmsEvents'), get('SmsLog')]);
  const objs = (rows) => { const [hd = [], ...b] = rows; return b.map((r) => Object.fromEntries(hd.map((k, j) => [k, r[j] ?? '']))); };
  glog = { events: objs(evs).reverse(), log: objs(log).filter((r) => String(r.line) === 'gabbai') };
  return glog;
}
async function gabbaiView(body) {
  const joins = data.optRows.filter((o) => String(o.source) === 'join' && String(o.status) === 'in' && !String(o.contact_id || '').trim());
  body.innerHTML = `<p class="muted">${h(t('loading'))}</p>`;
  const L = await loadGabbaiLog(true);
  const users = Object.fromEntries(allUsers().map((u) => [u.email, u.name]));
  const who = (e) => users[String(e).toLowerCase()] || e || '';
  const cName = (id) => { const c = id ? state.contacts.find((x) => String(x.contact_id) === String(id)) : null; return c ? nm(c) : ''; };
  const KL = { fail: '❓', error: '⚠', canceled: '✕', unregistered: '🚫', action: '✓', join_phone: '📱', join_name: '🔎', join_review: '🙋' };
  const evRow = (e) => `<tr><td dir="ltr" class="small muted">${h(String(e.at).slice(0, 16))}</td>
      <td>${KL[e.kind] || ''} ${h(t(`csGbK_${e.kind}`))}</td>
      <td>${h(who(e.gabbai_email)) || `<span dir="ltr">${h(e.phone)}</span>`}</td>
      <td>${e.contact_id ? `<button type="button" class="linkish" data-card="${h(e.contact_id)}">${h(cName(e.contact_id) || e.name)}</button>` : h(e.name)}</td>
      <td class="small">${e.text ? `<div dir="auto">“${h(e.text)}”</div>` : ''}<div class="muted" dir="auto">${h(e.detail)}</div></td></tr>`;
  const table = (arr) => (arr.length ? `<table class="lapsed-table"><tbody>${arr.map(evRow).join('')}</tbody></table>` : `<p class="muted small">—</p>`);
  const pick = (kinds, n = 60) => L.events.filter((e) => kinds.includes(String(e.kind))).slice(0, n);
  const review = (phone) => L.events.find((e) => e.kind === 'join_review' && last10(e.phone) === last10(phone));
  // שמועסן: לויט דעם טעלעפאן פונעם גבאי
  const chats = {};
  L.log.forEach((r) => { const p = last10(r.dir === 'in' ? r.from : r.to); if (p) (chats[p] = chats[p] || []).push(r); });
  const fails = pick(['fail', 'error', 'canceled', 'unregistered']);
  body.innerHTML = `
    <section class="cs-sec"><h3>🙋 ${h(t('smsJoins'))} (${joins.length})</h3>
      ${joins.length ? `<ul class="mx-plist">${joins.map((o) => { const r = review(o.phone); return `<li><b>${h(o.name)}</b> <span dir="ltr" class="muted small">${h(o.phone)}</span>
        ${r ? `<div class="muted small" dir="auto">${h(r.detail)}</div>` : ''}
        <input class="join-pick" data-row="${o._row}" list="dl-sms-c" placeholder="${h(t('pickContact'))}"></li>`; }).join('')}</ul>
        <datalist id="dl-sms-c">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>` : '<p class="muted small">—</p>'}</section>
    <section class="cs-sec"><h3>⚠ ${h(t('csGbFail'))} (${fails.length})</h3>${table(fails)}</section>
    <section class="cs-sec"><h3>✓ ${h(t('csGbActions'))}</h3>${table(pick(['action']))}</section>
    <section class="cs-sec"><h3>📱 ${h(t('csGbAuto'))}</h3>${table(pick(['join_phone', 'join_name'], 40))}</section>
    <section class="cs-sec"><h3>💬 ${h(t('csGbChats'))}</h3>
      ${Object.keys(chats).length ? Object.entries(chats).map(([p, rows]) => `<details class="cs-chat"><summary><span dir="ltr">${h(fmtPhone(p))}</span> · ${rows.length}</summary>
        ${rows.slice(-60).map((r) => `<div class="cs-msg ${r.dir === 'in' ? 'in' : 'out'}"><div dir="auto">${h(r.text)}</div><span class="muted small" dir="ltr">${h(String(r.at).slice(5, 16))}</span></div>`).join('')}</details>`).join('')
    : '<p class="muted small">—</p>'}</section>`;
  $$('[data-card]', body).forEach((b) => { b.onclick = () => ui.openCard(b.dataset.card); });
  $$('.join-pick', body).forEach((inp) => {
    inp.onchange = async () => {
      const c = state.contacts.find((x) => ui.pickerLabel(x) === inp.value.trim());
      if (!c) return;
      const o = data.optRows.find((x) => String(x._row) === inp.dataset.row);
      try { await setConsent([{ phone: o.phone, contact_id: c.contact_id, name: o.name }], 'in', 'join'); renderCalls(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
}

function sendTab(body, kind) {
  draft.kind = kind;
  const lists = savedInScope().map((l) => [l.list_id, l.name, parseSaved(l).cr.meta?.firstTab]);
  if (!draft.list && lists.length) draft.list = String((lists.find((x) => x[2] === 'phones') || lists[0])[0]);
  const { list, st } = recipientsOf(draft.list, draft.kind);
  const unit = price(draft.kind, draft.text);
  const est = list.length * unit;
  const blocked = blockedReason(draft.when);
  const recs = data.recs;
  body.innerHTML = `<div class="sms-send">
    <label class="mm-l">${h(t('smsList'))}<select id="sms-list">${lists.map(([id, n, ft]) => `<option value="${h(id)}"${String(id) === String(draft.list) ? ' selected' : ''}>${ft === 'phones' ? '📱 ' : ''}${h(n)}</option>`).join('')}</select></label>
    <div class="sms-stats">
      <span class="ok">✓ ${h(t('smsWillGet', { n: list.length }))}</span>
      ${st.noconsent.length ? `<button type="button" class="linkish warn" data-show="noconsent">⚠ ${h(t('smsNoConsent', { n: st.noconsent.length }))}</button>` : ''}
      ${st.out.length ? `<button type="button" class="linkish" data-show="out">⛔ ${h(t('smsOptedOut', { n: st.out.length }))}</button>` : ''}
      ${st.nophone.length ? `<button type="button" class="linkish" data-show="nophone">📵 ${h(t('smsNoPhone', { n: st.nophone.length }))}</button>` : ''}
      ${st.nosend.length ? `<button type="button" class="linkish" data-show="nosend">📭 ${h(t('smsNoSend', { n: st.nosend.length }))}</button>` : ''}
      ${st.dup ? `<span class="muted small">${h(t('smsDupPhones', { n: st.dup }))}</span>` : ''}
    </div>
    <label class="mm-l">${h(t('smsTitle'))}<input id="sms-title" value="${h(draft.title)}" placeholder="${h(t('smsTitlePh'))}"></label>
    ${draft.kind === 'sms' ? `<label class="mm-l">${h(t('smsText'))}<textarea id="sms-text" rows="6" dir="auto">${h(draft.text)}</textarea></label>
      <p class="muted small" id="sms-seg">${h(t('smsSegments', { c: branded(draft.text).length, s: segCount(branded(draft.text)) }))}</p>
      <p class="muted small">${h(t('smsBrandHint', { b: brandOf() }))}</p>`
      : `<label class="mm-l">${h(t('smsRecording'))}<select id="sms-rec"><option value="">—</option>${recs.slice().reverse().map((r) => `<option value="${h(r.rec_id)}"${r.rec_id === draft.rec ? ' selected' : ''}>${h(r.name || r.rec_id)} · ${h(String(r.created_at).slice(0, 10))}</option>`).join('')}</select></label>`}
    <label class="mm-l">${h(t('smsWhen'))}<input type="datetime-local" id="sms-when" value="${h(draft.when)}"> <span class="muted small">${h(t('smsWhenHint'))}</span></label>
    ${blocked ? `<p class="drive-warn">⛔ ${h(blocked)} — ${h(t('smsWillWait'))}</p>` : ''}
    <p>${h(t('smsCost', { n: list.length, unit: money(unit), total: money(est) }))} · ${h(t('smsMyCredits'))}: <b>${money(myCredits())}</b>
      ${myCredits() < est ? ` <span class="warn">⚠ ${h(t('smsNeedMore'))}</span>` : ''}</p>
    <button type="button" class="btn primary" id="sms-go"${list.length ? '' : ' disabled'}>${draft.kind === 'sms' ? '💬' : '📞'} ${h(t('smsSendBtn', { n: list.length }))}</button>
  </div>`;
  $('#sms-list', body).onchange = (e) => { draft.list = e.target.value; renderCalls(); };
  $('#sms-title', body).oninput = (e) => { draft.title = e.target.value; };
  const ta = $('#sms-text', body);
  if (ta) ta.oninput = () => { draft.text = ta.value; $('#sms-seg', body).textContent = t('smsSegments', { c: branded(ta.value).length, s: segCount(branded(ta.value)) }); };
  if (ta) ta.onchange = () => renderCalls();
  $('#sms-rec', body)?.addEventListener('change', (e) => { draft.rec = e.target.value; });
  $('#sms-when', body).onchange = (e) => { draft.when = e.target.value; renderCalls(); };
  $$('[data-show]', body).forEach((b) => { b.onclick = () => showList(b.dataset.show, st); });
  $('#sms-go', body).onclick = async () => {
    if (draft.kind === 'sms' && !draft.text.trim()) { ui.toast(t('smsNoText'), 'error'); return; }
    if (draft.kind === 'call' && !draft.rec) { ui.toast(t('smsNoRec'), 'error'); return; }
    if (!confirm(t('smsConfirm', { n: list.length, total: money(est) }))) return;
    const btn = $('#sms-go', body);
    btn.disabled = true;
    try {
      const l = state.savedLists.find((x) => String(x.list_id) === String(draft.list));
      const r = await call('job_create', {
        kind: draft.kind, text: draft.text, recording_id: draft.rec, title: draft.title || (l?.name || ''), list_name: l?.name || '',
        send_at: draft.when ? draft.when.replace('T', ' ') : '', recipients: list,
      });
      ui.toast(t('smsQueued', { n: list.length }));
      draft = { ...draft, text: '', title: '', when: '' };
      view = 'track';
      await loadSms(true);
      renderCalls();
      return r;
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; }
    return null;
  };
}

function dialog(html) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet mx-dlg';
  dlg.innerHTML = html;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  $$('[data-x]', dlg).forEach((b) => { b.onclick = () => dlg.close(); });
  dlg.showModal();
  return dlg;
}
function showList(kind, st) {
  const items = kind === 'noconsent' ? st.noconsent.map((x) => x.c) : st[kind];
  const canMark = kind === 'noconsent';
  const dlg = dialog(`<h3>${h(t({ noconsent: 'smsNoConsentT', out: 'smsOptedOutT', nophone: 'smsNoPhoneT', nosend: 'smsNoSendT' }[kind]))} (${items.length})</h3>
    ${kind === 'noconsent' ? `<p class="muted small">${h(t('smsConsentHint'))}</p>` : ''}
    <ul class="mx-plist">${items.map((c) => `<li>${h(nm(c))} <span class="muted small" dir="ltr">${h(fmtPhone(phonesOf(c).mobile || phonesOf(c).home_phone))}</span>
      <button type="button" class="linkish small" data-card="${h(c.contact_id)}">${h(t('mxOpenCard'))}</button></li>`).join('')}</ul>
    ${canMark ? `<div class="sms-mark"><label>${h(t('smsSource'))} <select id="sms-src">${SOURCES.filter(([k]) => k !== 'join').map(([k, l]) => `<option value="${k}">${h(t(l))}</option>`).join('')}</select></label>
      <button type="button" class="btn primary" id="sms-mark">✓ ${h(t('smsMarkAll', { n: items.length }))}</button></div>` : ''}
    <div class="dialog-actions"><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`);
  $$('[data-card]', dlg).forEach((b) => { b.onclick = () => { dlg.close(); ui.openCard(b.dataset.card); }; });
  $('#sms-mark', dlg)?.addEventListener('click', async () => {
    try {
      await setConsent(st.noconsent.map((x) => ({ phone: x.d, contact_id: x.c.contact_id, name: nm(x.c) })), 'in', $('#sms-src', dlg).value);
      dlg.close();
      renderCalls();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
}

/** "מאשר SMS" (אדער נישט): גלייך אינעם גיליון (לשונית SmsOptIn) */
export async function setConsent(people, status, source) {
  await loadSms();
  const head = data.optHead.length ? data.optHead : OPT_HEAD;
  const needHead = !data.optHead.length;
  const add = [];
  for (const p of people) {
    const d = last10(p.phone);
    if (!d) continue;
    const row = { phone: fmtPhone(d), status, source, contact_id: p.contact_id || '', name: p.name || '', at: nowStamp(), by: state.email };
    const ex = data.opt.get(d);
    if (ex) {
      if (String(ex.status) === 'out' && status === 'in' && source !== 'join') continue; // מי שהאט געזאגט STOP — נאר ער אליין (START)
      await updateRow('SmsOptIn', ex._row, head.map((k) => (k in row ? row[k] : ex[k] ?? '')));
    } else add.push(head.map((k) => row[k] ?? ''));
  }
  if (add.length) {
    if (needHead) add.unshift(OPT_HEAD);
    await appendRows('SmsOptIn', add);
  }
  await loadSms(true);
  ui.toast(t('smsConsentSaved'));
}

function jobsTab(body) {
  const jobs = data.jobs.filter((j) => state.isAdmin || String(j.created_by).toLowerCase() === state.email).slice().reverse();
  const st = (s) => ({ scheduled: '⏳', running: '▶', done: '✓', canceled: '✕', no_credits: '💳' }[s] || '') + ' ' + t(`smsSt_${s}`);
  body.innerHTML = jobs.length ? `<table class="lapsed-table"><thead><tr><th>${h(t('smsWhenCol'))}</th><th>${h(t('smsTitle'))}</th><th></th><th>${h(t('smsStatus'))}</th><th>${h(t('smsSentCol'))}</th><th>$</th><th></th></tr></thead>
    <tbody>${jobs.map((j) => `<tr><td dir="ltr" class="small">${h(String(j.send_at || j.created_at).slice(0, 16))}</td>
      <td>${h(j.title || j.list_name)}<div class="muted small">${h(String(j.text || '').slice(0, 60))}</div></td>
      <td>${j.kind === 'call' ? '📞' : '💬'}</td><td>${h(st(String(j.status)))}</td>
      <td>${h(`${j.sent || 0} / ${j.total || 0}`)}${Number(j.skipped) ? ` <span class="muted small">(⛔${j.skipped})</span>` : ''}${Number(j.failed) ? ` <span class="warn small">(✕${j.failed})</span>` : ''}</td>
      <td dir="ltr">${money(j.credits)}</td>
      <td>${['scheduled', 'running', 'no_credits'].includes(String(j.status)) ? `<button type="button" class="linkish danger" data-cancel="${h(j.job_id)}">${h(t('cancel'))}</button>` : ''}</td></tr>`).join('')}</tbody></table>`
    : `<p class="empty">${h(t('smsNoJobs'))}</p>`;
  body.insertAdjacentHTML('beforeend', `<p class="muted small">💬 ${h(t('smsRepliesHint'))}</p>`);
  $$('[data-cancel]', body).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(t('smsCancelConfirm'))) return;
      try { await call('job_cancel', { id: b.dataset.cancel }); await loadSms(true); renderCalls(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
}

function creditsTab(body) {
  const mine = data.credits.filter((r) => String(r.email).toLowerCase() === state.email).slice().reverse();
  body.innerHTML = `<div class="sms-buy"><h3>💳 ${h(t('smsBuy'))}</h3>
      <p class="muted small">${h(t('smsBuyHint', { p: money(data.config.price_sms || 0.01) }))}</p>
      <div class="seg">${[10, 20, 50, 100].map((n) => `<button type="button" data-usd="${n}">$${n}</button>`).join('')}</div></div>
    <h3>${h(t('smsLedger'))}</h3>
    ${mine.length ? `<table class="lapsed-table"><tbody>${mine.map((r) => `<tr><td dir="ltr" class="small">${h(String(r.at).slice(0, 16))}</td><td>${h(r.note || r.kind)}</td>
      <td dir="ltr" class="${Number(r.delta) < 0 ? 'warn' : 'ok'}">${Number(r.delta) < 0 ? '−' : '+'}${money(Math.abs(r.delta))}</td></tr>`).join('')}</tbody></table>` : `<p class="empty">—</p>`}`;
  $$('[data-usd]', body).forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try { const r = await call('checkout', { usd: Number(b.dataset.usd) }); location.href = r.url; } catch (err) { ui.toast(ui.friendlyError(err), 'error'); b.disabled = false; }
    };
  });
}

function recsTab(outer) {
  const W = CONFIG.SMS_WORKER_URL || '';
  const body = document.createElement('section');
  body.className = 'cs-sec cs-recs';
  outer.append(body);
  body.innerHTML = `<h2>🎙 ${h(t('smsTabRecs'))}</h2><div class="sms-buy"><h3>🎙 ${h(t('smsRecUpload'))}</h3>
      <p class="muted small">${h(t('smsRecHint'))}</p>
      <input id="rec-name" placeholder="${h(t('smsRecName'))}"> <input type="file" id="rec-file" accept="audio/*"></div>
    ${data.recs.length ? `<table class="lapsed-table"><tbody>${data.recs.slice().reverse().map((r) => `<tr><td>${h(r.name || r.rec_id)}</td>
      <td class="muted small">${h(String(r.created_at).slice(0, 16))} · ${h(r.source === 'phone' ? '📞' : '⬆')}</td>
      <td>${W ? `<audio controls preload="none" src="${h(W)}/audio/${encodeURIComponent(r.rec_id)}"></audio>` : ''}</td></tr>`).join('')}</tbody></table>` : `<p class="empty">—</p>`}`;
  $('#rec-file', body).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { ui.toast(t('smsRecTooBig'), 'error'); return; }
    const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
    try {
      await call('rec_upload', { data: dataUrl, name: $('#rec-name', body).value.trim() || file.name });
      ui.toast(t('smsRecSaved'));
      await loadSms(true);
      renderCalls();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
}

async function adminTab(body) {
  const c = data.config;
  const fields = [['price_sms', 'smsCfgPriceSms'], ['price_call', 'smsCfgPriceCall'], ['quiet_to', 'smsCfgFrom'], ['quiet_from', 'smsCfgTo'], ['friday_cutoff', 'smsCfgFriday']];
  const users = allUsers();
  body.innerHTML = `<div class="sms-admin">
    <section><h3>💲 ${h(t('smsCfgTitle'))}</h3><div class="mm-grid">${fields.map(([k, l]) => `<label>${h(t(l))}<input data-cfg="${k}" value="${h(c[k] ?? '')}" dir="ltr"></label>`).join('')}</div>
      <label class="mm-l">${h(t('smsCfgBrand'))}<input data-cfg="sms_brand" value="${h(c.sms_brand || 'Khal Ungvar')}" dir="ltr"></label>
      <label class="mm-l">${h(t('smsCfgCallText'))}<textarea data-cfg="call_text" rows="2" dir="ltr">${h(c.call_text || '')}</textarea></label>
      <label class="mm-l">${h(t('smsCfgZmanim'))}<textarea data-cfg="zmanim_text" rows="3" dir="ltr">${h(c.zmanim_text || '')}</textarea></label>
      <button type="button" class="btn primary" id="cfg-save">${h(t('saveBtn'))}</button>
      <button type="button" class="btn" id="cfg-yt">📅 ${h(t('smsCfgYt'))}</button></section>
    <section><h3>📊 ${h(t('smsReport'))}</h3><div id="sms-report" class="muted">…</div></section>
    <section><h3>➕ ${h(t('smsAddCredit'))}</h3>
      <select id="cr-user">${users.map((u) => `<option value="${h(u.email)}">${h(u.name)}</option>`).join('')}</select>
      <input type="number" id="cr-amt" step="0.01" placeholder="$" style="width:90px"> <input id="cr-note" placeholder="${h(t('smsCreditNote'))}">
      <button type="button" class="btn" id="cr-add">${h(t('smsAddCreditBtn'))}</button>
      <table class="lapsed-table small">${users.map((u) => `<tr><td>${h(u.name)}</td><td dir="ltr">${money(data.credits.filter((r) => String(r.email).toLowerCase() === u.email).reduce((s, r) => s + (Number(r.delta) || 0), 0))}</td></tr>`).join('')}</table></section>
  </div>`;
  const vals = () => Object.fromEntries($$('[data-cfg]', body).map((el) => [el.dataset.cfg, el.value.trim()]));
  $('#cfg-save', body).onclick = async () => { try { await call('config_set', { values: vals() }); await loadSms(true); ui.toast(t('saved')); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); } };
  $('#cfg-yt', body).onclick = async () => {
    const { yt, erev } = ytDates();
    try { await call('config_set', { values: { blocked_dates: yt.join(','), erev_dates: erev.join(',') } }); await loadSms(true); ui.toast(t('smsCfgYtDone', { n: yt.length })); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  $('#cr-add', body).onclick = async () => {
    const amount = Number($('#cr-amt', body).value);
    if (!amount) return;
    try { await call('credit_add', { email: $('#cr-user', body).value, amount, note: $('#cr-note', body).value }); await loadSms(true); renderCalls(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  try {
    const [rep, bal] = await Promise.all([call('report'), call('balance').catch((e) => ({ error: e.message }))]);
    const warn = rep.avg_cost && rep.avg_cost >= (Number(c.price_sms) || 0.01) * 0.85;
    $('#sms-report', body).innerHTML = `<p>${h(t('smsRepLine', { m: rep.month, n: rep.messages, sold: money(rep.sold), used: money(rep.used) }))}</p>
      <p>${h(t('smsRepCost'))}: ${Object.entries(rep.cost || {}).map(([k, v]) => `${h(k)} ${money(v)}`).join(' · ')}</p>
      ${rep.avg_cost ? `<p class="${warn ? 'warn' : ''}">${warn ? '⚠ ' : ''}${h(t('smsRepAvg', { a: `${(rep.avg_cost * 100).toFixed(2)}¢`, p: `${((Number(c.price_sms) || 0.01) * 100).toFixed(2)}¢` }))}</p>` : ''}
      <p>Telnyx: ${bal.balance ? `<b>${money(bal.balance.balance)}</b>${Number(bal.balance.balance) < 10 ? ` <span class="warn">⚠ ${h(t('smsLowBalance'))}</span>` : ''}` : h(bal.error || '—')}</p>`;
  } catch (err) { $('#sms-report', body).textContent = ui.friendlyError(err); }
}

// ---------- אינעם כרטיס: "מאשר SMS" ----------
export function smsCardHtml(c) {
  if (!smsOn()) return '';
  const p = phonesOf(c);
  const d = last10(p.mobile);
  if (!d) return '';
  const o = data?.opt.get(d);
  const label = !data ? '…' : !o ? t('smsCardNone') : String(o.status) === 'out' ? t('smsCardOut') : `${t('smsCardIn')} · ${t((SOURCES.find(([k]) => k === o.source) || [, 'smsSrcOther'])[1])}`;
  return `<p class="sms-card small" id="sms-card-line">📱 SMS: <span class="${o && String(o.status) === 'in' ? 'ok' : o ? 'warn' : 'muted'}">${h(label)}</span>
    ${data && (!o || String(o.status) !== 'out') ? ` <button type="button" class="linkish small" id="sms-card-btn">${h(t(o && String(o.status) === 'in' ? 'smsCardRemove' : 'smsCardAdd'))}</button>` : ''}</p>`;
}
export function wireSmsCard(c) {
  if (!smsOn()) return;
  const refresh = () => { const el = $('#sms-card-line'); if (el) { el.outerHTML = smsCardHtml(c); wireSmsCard(c); } };
  if (!data) { loadSms().then(refresh).catch(() => {}); return; }
  $('#sms-card-btn')?.addEventListener('click', async () => {
    const p = phonesOf(c);
    const o = data.opt.get(last10(p.mobile));
    try {
      if (o && String(o.status) === 'in') await setConsent([{ phone: p.mobile, contact_id: c.contact_id, name: nm(c) }], 'none', 'removed');
      else {
        const dlg = dialog(`<h3>📱 ${h(t('smsCardAdd'))}</h3><label>${h(t('smsSource'))} <select id="sc-src">${SOURCES.filter(([k]) => k !== 'join').map(([k, l]) => `<option value="${k}">${h(t(l))}</option>`).join('')}</select></label>
          <div class="dialog-actions"><button type="button" class="btn primary" id="sc-ok">${h(t('saveBtn'))}</button><button type="button" class="btn" data-x>${h(t('cancel'))}</button></div>`);
        await new Promise((res) => { $('#sc-ok', dlg).onclick = async () => { const src = $('#sc-src', dlg).value; dlg.close(); await setConsent([{ phone: p.mobile, contact_id: c.contact_id, name: nm(c) }], 'in', src); res(); }; dlg.addEventListener('close', res); });
      }
      refresh();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
}
