// Invoice & Receipt: קבלות אויף נדבות, Invoices אויף נישט-באצאלטע, יערליכע סיכומים (פאר טעקס), און קבלות פאר א קאמפיין.
// יעדער ארגון מיט זיינע אייגענע פרטים (לשונית OrgDetails); יעדער דאקומענט באקומט א נומער (לשונית Receipts),
// און ביים נאכאמאל דרוקן — דער זעלבער נומער.
import {
  state, loadAll, orgDetailsOf, issueDocs, findIssued, voidReceipt, orgLogo, saveOrgDetails, saveYearly, saveOrgLogo,
} from './data.js';
import { t } from './i18n.js';
import { isTrue, escapeHtml as h, mailingName, splitTags, shrinkImage } from './util.js';
import { isoToHebrewText } from './hebdate.js';
import { effectiveOrg, umbrellaName } from './scope.js';
import { money, orgSelect } from './donations.js';
import { allCampaigns } from './campaigns.js';
import { downloadXlsx } from './excel.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const KINDS = [['receipt', 'rcKindReceipt'], ['invoice', 'rcKindInvoice'], ['year', 'rcKindYear'], ['campaign', 'rcKindCampaign']];
let f = null; // די פילטערס: { kind, org, from, to, year, campaign, onlyNew }

function defaults() {
  const y = new Date().getFullYear();
  return { kind: 'receipt', org: '', from: `${y}-01-01`, to: `${y}-12-31`, year: String(y - (new Date().getMonth() < 3 ? 1 : 0)), campaign: '', onlyNew: true };
}

export function initReceipts(helpers) {
  ui = helpers;
}

/** עפנט דעם בלאט. preset = { kind, org, campaign, ... } */
export function openReceipts(preset = {}) {
  f = { ...(f || defaults()), ...preset };
  ui.showView('receipts');
}

function allOrgs() {
  const lists = ['beis_medrash', 'kollel', 'organization'].flatMap((n) => state.lists[n] || []);
  return [umbrellaName(), ...lists].filter(Boolean);
}

const paidDate = (d) => String(d.paid_date || d.date || '').slice(0, 10);
const who = (d) => (d.contact_id ? `c:${d.contact_id}` : `n:${String(d.donor_name || '').trim()}`);

/** וואס מ'קען ארויסגעבן לויט די פילטערס: [{ kind, org, contact_id, donor_name, ids, amount, period, list }] */
function candidates() {
  const inOrg = (d) => effectiveOrg(d) === f.org;
  const D = state.donations;
  if (f.kind === 'receipt') {
    return D.filter((d) => inOrg(d) && isTrue(d.is_paid) && paidDate(d) >= f.from && paidDate(d) <= f.to)
      .sort((a, b) => paidDate(b).localeCompare(paidDate(a)))
      .map((d) => doc('receipt', [d], ''));
  }
  if (f.kind === 'invoice') {
    return D.filter((d) => inOrg(d) && !isTrue(d.is_paid))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((d) => doc('invoice', [d], ''));
  }
  const groups = new Map();
  const list = f.kind === 'year'
    ? D.filter((d) => inOrg(d) && isTrue(d.is_paid) && paidDate(d).startsWith(`${f.year}-`))
    : D.filter((d) => f.campaign && d.campaign === f.campaign && isTrue(d.is_paid));
  list.forEach((d) => { const k = who(d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
  return [...groups.values()].map((g) => doc(f.kind, g.sort((a, b) => paidDate(a).localeCompare(paidDate(b))), f.kind === 'year' ? f.year : f.campaign))
    .sort((a, b) => b.amount - a.amount);
}

function doc(kind, list, period) {
  const d0 = list[0];
  return {
    kind, org: kind === 'campaign' ? (effectiveOrg(d0) || f.org) : f.org, contact_id: d0.contact_id || '', donor_name: d0.contact_id ? '' : String(d0.donor_name || ''),
    ids: list.map((d) => String(d.donation_id)), amount: list.reduce((s, d) => s + Number(d.amount_usd || 0), 0), period, list,
  };
}

// ---------- דער בלאט ----------
export function renderReceipts() {
  const main = $('#receipts-main');
  if (!main) return;
  if (!f) f = defaults();
  const orgs = allOrgs();
  if (!f.org || !orgs.includes(f.org)) f.org = orgs[0] || '';
  if (f.kind === 'campaign') {
    const c = allCampaigns().find((x) => x.name === f.campaign);
    if (c?.org) f.org = c.org;
  }
  const det = orgDetailsOf(f.org);
  const missing = !det || !det.legal_name || !det.address;
  const list = candidates().map((c) => ({ ...c, issued: findIssued(c.kind, c.org, c.ids, c.period, c.contact_id || c.donor_name) }));
  const shown = f.onlyNew && f.kind !== 'invoice' ? list.filter((c) => !c.issued) : list;
  const years = [...new Set(state.donations.map((d) => paidDate(d).slice(0, 4)).filter(Boolean).concat(String(new Date().getFullYear())))].sort().reverse();
  const camps = allCampaigns().filter((c) => c.list.length);
  main.innerHTML = `<div class="camp-page-head"><h2>🧾 Invoice &amp; Receipt</h2><span class="spacer"></span>
      <button type="button" class="btn" id="rc-lobby">${h(t('lobbyBack'))}</button></div>
    <div class="rc-kinds">${KINDS.map(([k, l]) => `<button type="button" class="nc-kind${f.kind === k ? ' on' : ''}" data-kind="${k}"><b>${h(t(l))}</b><span>${h(t(`${l}Help`))}</span></button>`).join('')}</div>
    <div class="toolbar rc-filters">
      ${f.kind === 'campaign'
        ? `<label>${h(t('xlCampaign'))} <select id="rc-campaign"><option value=""></option>${camps.map((c) => `<option${c.name === f.campaign ? ' selected' : ''}>${h(c.name)}</option>`).join('')}</select></label>
           <span class="muted">${f.org ? `${h(t('forOrg'))}: <b>${h(f.org)}</b>` : ''}</span>`
        : `<label>${h(t('forOrg'))} <select id="rc-org">${orgs.map((o) => `<option${o === f.org ? ' selected' : ''}>${h(o)}</option>`).join('')}</select></label>`}
      ${f.kind === 'receipt' ? `<label>${h(t('rcFrom'))} <input type="date" id="rc-from" value="${h(f.from)}"></label><label>${h(t('rcTo'))} <input type="date" id="rc-to" value="${h(f.to)}"></label>` : ''}
      ${f.kind === 'year' ? `<label>${h(t('rcTaxYear'))} <select id="rc-year">${years.map((y) => `<option${y === f.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>` : ''}
      ${f.kind !== 'year' ? `<label class="rc-for">${h(t('rcForLabel'))} <input id="rc-for" value="${h(f.forText || '')}" placeholder="${h(t('rcForPh'))}" dir="rtl"></label>` : ''}
      ${f.kind !== 'invoice' ? `<label class="check"><input type="checkbox" id="rc-onlynew"${f.onlyNew ? ' checked' : ''}> ${h(t('rcOnlyNew'))}</label>` : ''}
    </div>
    ${missing ? `<p class="drive-warn">⚠ ${h(t('rcMissingDetails', { org: f.org }))} <button type="button" class="btn small-btn primary" id="rc-edit-org">${h(t('rcEditDetails'))}</button></p>`
      : `<p class="muted small">${h(det.legal_name)} · EIN ${h(det.ein || '—')} <button type="button" class="linkish" id="rc-edit-org">${h(t('rcEditDetails'))}</button></p>`}
    ${!missing && f.kind !== 'invoice' && f.org ? letterPanelHtml(f.org) : ''}
    <div class="rc-actions">
      <label class="check"><input type="checkbox" id="rc-all"> ${h(t('rcSelectAll'))}</label>
      <span class="muted" id="rc-count"></span>
      <span class="spacer"></span>
      <button type="button" class="btn" id="rc-sample">👁 ${h(t('rcPreview'))}</button>
      <button type="button" class="btn" id="rc-xl">Excel</button>
      <button type="button" class="btn primary" id="rc-print" disabled>🖨 ${h(t('rcPrint'))}</button>
    </div>
    ${shown.length ? `<table class="lapsed-table rc-table"><thead><tr><th></th><th>${h(t('xlDonor'))}</th><th>${h(t('rcWhat'))}</th><th>${h(t('xlAmount'))}</th><th>${h(t('rcNumber'))}</th></tr></thead>
      <tbody>${shown.map((c, i) => `<tr><td><input type="checkbox" class="rc-pick" data-i="${i}"></td>
        <td>${h(donorLabel(c))}${addrOf(c) ? '' : ` <span class="badge muted" title="${h(t('rcNoAddress'))}">✉?</span>`}</td>
        <td class="muted small">${h(whatText(c))}</td>
        <td class="num" dir="ltr">${money(c.amount)}</td>
        <td class="small" dir="ltr">${c.issued ? h(c.issued.receipt_no) : '—'}</td></tr>`).join('')}</tbody></table>`
      : `<p class="empty">${h(t(f.kind === 'campaign' && !f.campaign ? 'rcPickCampaign' : 'rcNothing'))}</p>`}
    ${issuedLogHtml()}`;
  const rerender = () => renderReceipts();
  $('#rc-lobby', main).onclick = () => ui.showView('lobby');
  $$('[data-kind]', main).forEach((b) => { b.onclick = () => { f.kind = b.dataset.kind; rerender(); }; });
  $('#rc-org', main)?.addEventListener('change', (e) => { f.org = e.target.value; rerender(); });
  $('#rc-campaign', main)?.addEventListener('change', (e) => { f.campaign = e.target.value; rerender(); });
  $('#rc-from', main)?.addEventListener('change', (e) => { f.from = e.target.value; rerender(); });
  $('#rc-to', main)?.addEventListener('change', (e) => { f.to = e.target.value; rerender(); });
  $('#rc-year', main)?.addEventListener('change', (e) => { f.year = e.target.value; rerender(); });
  $('#rc-for', main)?.addEventListener('input', (e) => { f.forText = e.target.value; });
  $('#rc-onlynew', main)?.addEventListener('change', (e) => { f.onlyNew = e.target.checked; rerender(); });
  if (!missing && f.kind !== 'invoice' && f.org) wireLetterPanel(main, f.org, rerender);
  $('#rc-sample', main).onclick = () => {
    const d = picked()[0] || shown[0];
    if (!d) return;
    printDocs([{ ...d, receipt_no: d.issued?.receipt_no || '—', issued_at: new Date().toISOString().slice(0, 10), forText: f.kind !== 'year' ? String(f.forText || '').trim() : '' }]);
  };
  $('#rc-edit-org', main).onclick = () => openOrgDetails(f.org);
  const picked = () => $$('.rc-pick:checked', main).map((x) => shown[Number(x.dataset.i)]);
  const sync = () => {
    const n = picked().length;
    $('#rc-count', main).textContent = n ? t('rcPicked', { n }) : '';
    $('#rc-print', main).disabled = !n || missing;
  };
  main.addEventListener('change', (e) => { if (e.target.classList?.contains('rc-pick')) sync(); });
  $('#rc-all', main).onchange = (e) => { $$('.rc-pick', main).forEach((x) => { x.checked = e.target.checked; }); sync(); };
  $('#rc-xl', main).onclick = () => downloadXlsx(`${t(KINDS.find(([k]) => k === f.kind)[1])} ${f.org}`,
    [t('xlDonor'), t('rcWhat'), t('xlAmount'), t('rcNumber')], shown.map((c) => [donorLabel(c), whatText(c), c.amount, c.issued?.receipt_no || '']));
  $('#rc-print', main).onclick = async () => {
    const docs = picked();
    if (!docs.length) return;
    const btn = $('#rc-print', main);
    btn.disabled = true;
    try {
      if (f.kind !== 'invoice') await rememberLetter(f.org);
      const issued = await issueDocs(docs.map((d) => ({ kind: d.kind, org: d.org, contact_id: d.contact_id, donor_name: d.donor_name, ids: d.ids, amount: d.amount, period: d.period })));
      const forText = f.kind !== 'year' ? String(f.forText || '').trim() : '';
      printDocs(issued.map((x, i) => ({
        ...docs[i], receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint,
        forText,
      })));
      await loadAll();
      rerender();
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
      btn.disabled = false;
    }
  };
  wireLog(main);
  sync();
}

function donorLabel(c) {
  const ct = c.contact_id ? ui.contactById(c.contact_id) : null;
  return ct ? ui.fullNameHe(ct) : c.donor_name;
}

function whatText(c) {
  if (c.kind === 'year') return t('rcYearLine', { n: c.list.length, year: c.period });
  if (c.kind === 'campaign') return t('rcCampLine', { n: c.list.length, name: c.period });
  const d = c.list[0];
  return [paidDate(d), d.campaign || splitTags(d.event_tags).join(', ')].filter(Boolean).join(' · ');
}

function addrOf(c) {
  const ct = c.contact_id ? ui.contactById(c.contact_id) : null;
  return ct && ct.address ? ct : null;
}

// ---------- ליסטע פון וואס איז שוין ארויסגעגעבן ----------
function issuedLogHtml() {
  const mine = state.receipts.filter((r) => r.org === f.org || (f.kind === 'campaign' && r.period === f.campaign)).slice(-40).reverse();
  if (!mine.length) return '';
  const kindLabel = (k) => t(KINDS.find(([x]) => x === k)?.[1] || 'rcKindReceipt');
  return `<details class="rc-log"><summary>${h(t('rcLog', { n: mine.length }))}</summary>
    <table class="lapsed-table"><thead><tr><th>${h(t('rcNumber'))}</th><th>${h(t('xlType'))}</th><th>${h(t('xlDonor'))}</th><th>${h(t('xlAmount'))}</th><th>${h(t('rcIssued'))}</th><th></th></tr></thead>
    <tbody>${mine.map((r) => `<tr class="${isTrue(r.void) ? 'rc-void' : ''}"><td dir="ltr">${h(r.receipt_no)}</td><td>${h(kindLabel(r.kind))}${r.period ? ` · ${h(r.period)}` : ''}</td>
      <td>${h(r.contact_id ? (ui.contactById(r.contact_id) ? ui.fullNameHe(ui.contactById(r.contact_id)) : `#${r.contact_id}`) : r.donor_name)}</td>
      <td class="num" dir="ltr">${money(r.amount)}</td><td class="small muted" dir="ltr">${h(r.issued_at)}</td>
      <td>${isTrue(r.void) ? h(t('rcVoided')) : `<button type="button" class="btn small-btn" data-reprint="${h(r.receipt_no)}">🖨</button>
        ${state.isAdmin ? `<button type="button" class="linkish" data-void="${h(r.receipt_no)}">${h(t('rcVoid'))}</button>` : ''}`}</td></tr>`).join('')}</tbody></table></details>`;
}

function wireLog(main) {
  main.querySelectorAll('[data-reprint]').forEach((b) => {
    b.onclick = () => {
      const r = state.receipts.find((x) => x.receipt_no === b.dataset.reprint);
      const ids = String(r.donation_ids || '').split(',').filter(Boolean);
      const list = ids.map((id) => state.donations.find((d) => String(d.donation_id) === id)).filter(Boolean);
      if (!list.length) { ui.toast(t('rcGone'), 'error'); return; }
      printDocs([{ kind: r.kind, org: r.org, contact_id: r.contact_id, donor_name: r.donor_name, ids, amount: Number(r.amount), period: r.period, list, receipt_no: r.receipt_no, issued_at: r.issued_at, reprint: true }]);
    };
  });
  main.querySelectorAll('[data-void]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm(t('rcVoidConfirm', { no: b.dataset.void }))) return;
      try { await voidReceipt(b.dataset.void); await loadAll(); renderReceipts(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
}

// ---------- דער דאקומענט (ענגליש, פאר טעקס) ----------
const longDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

function payText(d) {
  const m = String(d.payment_method || '');
  const map = { "צ'ק": 'Check', 'כרטיס אשראי': 'Credit card', 'קאש': 'Cash', 'אחר': 'Other' };
  const base = map[m] || m;
  if (d.check_number) return `${base || 'Check'} #${d.check_number}`;
  if (d.card_last4) return `${base || 'Card'} ****${d.card_last4}`;
  return base;
}

function descText(d) {
  const parts = [];
  if (d.campaign) parts.push(d.campaign);
  else {
    const tags = splitTags(d.event_tags).join(', ');
    if (tags) parts.push([tags, d.event_year].filter(Boolean).join(' '));
  }
  if (d.dedication_text) parts.push(`${d.dedication_type || ''} ${d.dedication_text}`.trim());
  return parts.join(' — ') || 'Donation';
}

// ---------- די בילדער (באנער, אונטערשריפט): א בילד קען זיין לענגער ווי איין צעל — צעטיילט אויף 3 ----------
const CELL = 49000;
export function joinImg(o, base) {
  return [o?.[base], o?.[`${base}_2`], o?.[`${base}_3`]].map((x) => String(x || '')).join('');
}
function splitImg(data, base) {
  const out = {};
  out[base] = data.slice(0, CELL);
  out[`${base}_2`] = data.slice(CELL, CELL * 2);
  out[`${base}_3`] = data.slice(CELL * 2, CELL * 3);
  return out;
}

const DEFAULTS = {
  letter_salutation: 'אל מע"כ ידידנו',
  salutation_suffix: 'הי"ו,',
  letter_a: 'במילין זעירין אלו הננו להודות לכם בשם הנהלת הקהילה על השתתפותכם הנדיבה',
  letter_b: 'לחזק ולבסס את מוסדותינו הקדושים.\n\nוהברכה אחת היא לכם: בזכות החזקת התורה תזכו לרב טוב, ויתמלא כל משאלות לבכם לטובה ולברכה בכל מילי דמיטב.',
  letter_closing: 'בכבוד ובהערצה,',
  signer_he: 'בשם הנהלת הקהילה',
  footer_line: 'תזכו למצוות, זכות המצוה תגן עליו ועל בני ביתו להתברך ממקור הברכות בכל מילי דמיטב.',
};
const INVOICE_A = 'בזה הננו להזכיר בכבוד על התחייבותכם הנדיבה';
const INVOICE_B = 'ונודה לכם מאד על סילוקה בהקדם, ושכרכם כפול מן השמים.';

function yearlyFor(c) {
  const camp = c.list.find((d) => d.campaign)?.campaign || (c.kind === 'campaign' ? c.period : '');
  if (!camp) return null;
  return state.yearly.find((y) => camp.startsWith(`${y.series} `)) || null;
}

/** וואס די נדבה איז געווען: קאמפיין / סיבה (פאר דעם בריוו). */
function forWhat(c) {
  if (c.kind === 'year') return `שנת ${c.period}`;
  const d = c.list[0];
  return c.period && c.kind === 'campaign' ? c.period : (d.campaign || splitTags(d.event_tags).join(', ') || 'נדבה');
}

function fillText(text, c, ct) {
  const v = {
    סכום: money(c.amount), amount: money(c.amount), קאמפיין: forWhat(c), campaign: forWhat(c),
    נאמען: ct ? ui.fullNameHe(ct) : (c.donor_name || ''), name: ct ? ui.fullNameHe(ct) : (c.donor_name || ''),
    יאר: c.kind === 'year' ? c.period : '', year: c.period || '',
  };
  return String(text || '').replace(/\{([^}]+)\}/g, (m, k) => v[k.trim()] ?? m);
}

const para = (txt) => String(txt || '').split(/\n\s*\n/)
  .map((p) => `<p>${h(p).replace(/\n/g, '<br>').replace(/\$[\d,.]+/g, (m) => `<bdi dir="ltr">${m}</bdi>`)}</p>`).join('');

function payBoxes(c) {
  const ms = new Set(c.list.map((d) => String(d.payment_method || '')));
  const cash = [...ms].some((m) => /קאש|cash|מזומן/i.test(m));
  const cc = ms.has('כרטיס אשראי') || c.list.some((d) => d.card_last4);
  const check = ms.has("צ'ק") || c.list.some((d) => d.check_number);
  const nums = c.list.map((d) => d.check_number).filter(Boolean);
  const box = (on, label) => `<span class="cp-box${on ? ' on' : ''}">${on ? '☑' : '☐'} ${label}</span>`;
  return `${box(cash, 'Cash')}${box(cc, 'CC')}${box(check, `Check${nums.length ? ` #${nums.join(', #')}` : ''}`)}`;
}

function docHtml(c) {
  const det = { ...(orgDetailsOf(c.org) || {}), ...(letterState[c.org] || {}) };
  // אלע ארגונים אין אמעריקע זענען אונטער דעם EIN פון קהל אונגוואר (דער כלל-ארגון) — ווען א ארגון האט נישט קיין אייגענעם
  const um = orgDetailsOf(umbrellaName()) || {};
  const ein = det.ein || um.ein || '';
  const taxEntity = det.ein ? (det.legal_name || c.org) : (um.legal_name || det.legal_name || c.org);
  const yc = yearlyFor(c);
  const ct = c.contact_id ? ui.contactById(c.contact_id) : null;
  const name = ct ? (mailingName(ct) || [ct.legal_first_name || ct.first_name_en, ct.last_name_en].filter(Boolean).join(' ') || ui.fullNameHe(ct)) : c.donor_name;
  const addr = ct ? [ct.address, [ct.city, ct.state].filter(Boolean).join(', ') + (ct.zip ? ` ${ct.zip}` : '')].filter((x) => String(x || '').trim()) : [];
  const banner = joinImg(yc, 'header_img') || joinImg(det, 'header_img');
  const sig = String(det.signature_img || '');
  const logo = orgLogo(c.org);
  const legal = det.legal_name || c.org;
  const he = det.org_name_he || '';
  const isInv = c.kind === 'invoice';
  const issued = String(c.issued_at || '').slice(0, 10);
  const heDate = issued ? `${isoToHebrewText(issued)} לפ"ק` : '';
  const A = isInv ? INVOICE_A : (det.letter_a || DEFAULTS.letter_a);
  const B = isInv ? INVOICE_B : (det.letter_b || DEFAULTS.letter_b);
  // "אל מע"כ ידידנו" + טיטל + פרטי נאמען + משפחה (לשון קודש) + הי"ו
  const toName = ct ? [ct.title_he, ct.first_name_he, ct.last_name_he].filter(Boolean).join(' ') : (c.donor_name || '');
  const salLine = [det.letter_salutation || DEFAULTS.letter_salutation, toName, det.salutation_suffix || DEFAULTS.salutation_suffix].filter(Boolean).join(' ');
  // נישט קיין קאמפיין? מ'קען שרייבן וואס עס איז (c.forText) — דאן גייט עס גלייך נאך "בסך של $..."
  const middle = c.forText ? `בסך של ${money(c.amount)} ${c.forText}` : `בסך של ${money(c.amount)} ב${forWhat(c)}`;
  const body = `${fillText(A, c, ct)} ${middle} ${fillText(B, c, ct)}`;
  const multi = c.list.length > 1;
  const title = { receipt: det.coupon_title || 'OFFICIAL RECEIPT', invoice: 'INVOICE · PLEDGE', year: `YEAR-END STATEMENT ${c.period}`, campaign: det.coupon_title || 'OFFICIAL RECEIPT' }[c.kind];
  const taxLine = isInv ? `Please make checks payable to ${legal}.`
    : String(det.tax_text || TAX_DEFAULT).replace(/\{NAME\}/g, taxEntity).replace(/\{EIN\}/g, ein || '—')
      .replace('this contribution', multi ? 'these contributions' : 'this contribution');
  return `<section class="rc-doc">
    ${banner ? `<div class="rd-banner"><img src="${banner}" alt=""></div>`
      : `<div class="rd-band">${logo ? `<img src="${logo}" alt="">` : ''}<div>${he ? `<div class="rd-band-he" dir="rtl">${h(he)}</div>` : ''}<div class="rd-band-en">${h(legal)}</div></div></div>`}
    <div class="rd-letter" dir="rtl">
      <div class="rd-date">${h(heDate)}</div>
      <div class="rd-sal">${h(salLine)}</div>
      ${para(body)}
      <div class="rd-close">${h(det.letter_closing || DEFAULTS.letter_closing)}</div>
      <div class="rd-sig">${det.signature_text ? `<div class="rd-sigtext" style="font-family:${sigFont(det.signature_font)}">${h(det.signature_text)}</div>`
        : sig ? `<img src="${sig}" alt="">` : '<div class="rd-sigspace"></div>'}<div>${h(det.signer_he || DEFAULTS.signer_he)}</div></div>
    </div>
    <div class="rd-cut"><span>✂</span></div>
    <div class="cp">
      <div class="cp-main">
        <div class="cp-left">
          <div class="cp-tag">${h(title)}</div>
          <div class="cp-org">${h(legal)}</div>
          <div class="cp-addr">${[det.address, det.city_state_zip].filter(Boolean).map(h).join('<br>')}</div>
          <div class="cp-tel">${[det.phone ? `TEL: ${h(det.phone)}` : '', det.fax ? `FAX: ${h(det.fax)}` : '', det.email ? h(det.email) : '', det.website ? h(det.website) : '', ein ? `EIN: ${h(ein)}` : ''].filter(Boolean).join('<br>')}</div>
          <div class="cp-from-label">${isInv ? 'Bill to' : h(det.received_label || 'Received from')}</div>
          <div class="cp-from"><b><bdi dir="auto">${h(name)}</bdi></b>${addr.map((l) => `<br>${h(l)}`).join('')}</div>
        </div>
        <div class="cp-mid">
          <div class="cp-row"><span class="cp-lbl">${isInv ? 'Amount due' : 'Amount'}</span><span class="cp-amount">${money(c.amount)}</span></div>
          ${isInv ? '' : `<div class="cp-pay">${payBoxes(c)}</div>`}
          <div class="cp-row"><span class="cp-lbl">Date</span><span class="cp-field">${h(multi ? `${longDate(paidDate(c.list[0]))} – ${longDate(paidDate(c.list[c.list.length - 1]))}` : longDate(isInv ? c.list[0].date : paidDate(c.list[0])))}</span></div>
          <div class="cp-row"><span class="cp-lbl">${isInv ? 'Invoice #' : 'Receipt #'}</span><span class="cp-field">${h(c.receipt_no)}${c.reprint ? ' <small>(copy)</small>' : ''}</span></div>
          ${multi ? `<table class="cp-lines">${c.list.map((d) => `<tr><td>${h(longDate(paidDate(d)))}</td><td><bdi dir="auto">${h(descText(d))}</bdi></td><td class="amt">${money(d.amount_usd)}</td></tr>`).join('')}</table>`
            : `<div class="cp-row"><span class="cp-lbl">For</span><span class="cp-field cp-for" dir="rtl">${h(c.forText || forWhat(c))}</span></div>`}
          ${!multi && (c.list[0].dedication_text || c.list[0].event_note) ? `<div class="cp-note" dir="rtl">${h([c.list[0].dedication_type, c.list[0].dedication_text, c.list[0].event_note].filter(Boolean).join(' '))}</div>` : ''}
          <div class="cp-tax">${h(taxLine)}${det.receipt_note ? ` ${h(det.receipt_note)}` : ''}</div>
        </div>
        <div class="cp-side">
          ${logo ? `<div class="cp-logo"><img src="${logo}" alt=""></div>` : ''}
          ${he ? `<div class="cp-he" dir="rtl">${h(he)}</div>` : ''}
          ${det.sub_line ? `<div class="cp-sub" dir="rtl">${h(det.sub_line)}</div>` : ''}
          ${det.thanks_yi ? `<div class="cp-yi" dir="rtl">${h(det.thanks_yi)}</div>` : ''}
        </div>
      </div>
      <div class="cp-foot" dir="rtl">${h(det.footer_line || DEFAULTS.footer_line)}</div>
    </div>
  </section>`;
}

/** דרוקט (אדער PDF): יעדער דאקומענט אויף א באזונדערן בלאט. */
export function printDocs(docs) {
  let area = $('#rc-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'rc-print-area'; document.body.append(area); }
  area.innerHTML = docs.map(docHtml).join('');
  document.body.classList.add('printing-rc');
  const done = () => { document.body.classList.remove('printing-rc'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // די בילדער און די שריפטן (כתב-יד) מוזן זיך אויסלאדן פארן דרוקן
  const fonts = ["24px 'Playpen Sans Hebrew'", "24px 'Amatic SC'", "24px 'Noto Rashi Hebrew'", "16px 'Frank Ruhl Libre'", "bold 16px 'Frank Ruhl Libre'"]
    .map((f) => (document.fonts?.load ? document.fonts.load(f, 'אבג').catch(() => null) : null));
  Promise.all([...fonts, ...$$('img', area).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; })))])
    .then(() => (document.fonts?.ready || null))
    .then(() => window.print());
}

/** פון דער נדבה: א קבלה (באצאלט) אדער Invoice (נישט באצאלט) — גלייך דרוקן. */
export async function printForDonation(d) {
  const org = effectiveOrg(d);
  if (!org) { ui.toast(t('rcNoOrg'), 'error'); return; }
  const det = orgDetailsOf(org);
  if (!det || !det.legal_name) { ui.toast(t('rcMissingDetails', { org }), 'error'); openOrgDetails(org); return; }
  const kind = isTrue(d.is_paid) ? 'receipt' : 'invoice';
  // וואס שטייט נאך "בסך של $..." (דער קאמפיין, אדער וואס מ'שרייבט אליין)
  const def = `ב${d.campaign || [splitTags(d.event_tags).join(', '), d.event_note].filter(Boolean).join(' – ') || 'נדבה'}`;
  const ans = window.prompt(t('rcForPrompt'), def);
  if (ans === null) return;
  const forText = ans.trim() === def ? '' : ans.trim();
  const base = { kind, org, contact_id: d.contact_id || '', donor_name: d.contact_id ? '' : String(d.donor_name || ''), ids: [String(d.donation_id)], amount: Number(d.amount_usd || 0), period: '' };
  try {
    const [x] = await issueDocs([base]);
    printDocs([{ ...base, list: [d], receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint, forText }]);
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}


// ---------- די פרטים פון א ארגון (וואס שטייט אויף דער קבלה) ----------
// אלע פעלדער, אין דער סדר ווי זיי שטייען אויף דער קבלה (פון אויבן ביז אונטן).
// [שליסל, באשרייבונג, דיפאלט (ווערט אריינגעשטעלט אין פעלד), סארט, ריכטונג]
const TAX_DEFAULT = '{NAME} is a 501(c)(3) tax-exempt organization (EIN {EIN}). All contributions are tax deductible. No goods or services were provided by the above donee organization in consideration in whole or in part for this contribution.';
const SECTIONS = [
  ['rcS3', [
    ['coupon_title', 'rcfCouponTitle', 'OFFICIAL RECEIPT', '', 'ltr'],
    ['legal_name', 'rcfLegal', '', 'req', 'ltr'],
    ['address', 'rcfAddress', '', 'req', 'ltr'],
    ['city_state_zip', 'rcfCity', '', 'req', 'ltr'],
    ['phone', 'rcfPhone', '', '', 'ltr'],
    ['fax', 'rcfFax', '', '', 'ltr'],
    ['email', 'rcfEmail', '', '', 'ltr'],
    ['website', 'rcfWebsite', '', '', 'ltr'],
    ['ein', 'rcfEin', '', '', 'ltr'],
    ['received_label', 'rcfReceivedLabel', 'Received from', '', 'ltr'],
  ]],
  ['rcS4', [
    ['tax_text', 'rcfTax', TAX_DEFAULT, 'area', 'ltr'],
    ['receipt_note', 'rcfNote', '', '', 'ltr'],
  ]],
  ['rcS5', [
    ['org_name_he', 'rcfNameHe', '', '', 'rtl'],
    ['sub_line', 'rcfSubLine', '', '', 'rtl'],
    ['thanks_yi', 'rcfThanks', '', '', 'rtl'],
  ]],
  ['rcS6', [
    ['footer_line', 'rcfFooter', DEFAULTS.footer_line, 'wide', 'rtl'],
  ]],
  ['rcS7', [
    ['receipt_prefix', 'rcfPrefix', '', '', 'ltr'],
  ]],
];
const ALL_FIELDS = SECTIONS.flatMap(([, f]) => f.map((x) => x[0]));
// דער בריוו
const LETTER = ['letter_salutation', 'salutation_suffix', 'letter_a', 'letter_b', 'letter_closing', 'signer_he'];

// ---------- דער בריוו: מ'קלייבט / שרייבט יעדעס מאל ביים דרוקן; דער לעצטער ווערט געדענקט ----------
const letterState = {}; // { org: { letter_salutation, ..., signature_text, signature_font } }
// חתימה אין כתב-יד: די שריפטן (פון Google Fonts)
const SIG_FONTS = [
  ['playpen', "'Playpen Sans Hebrew', cursive", 'rcSigFontHand'],
  ['amatic', "'Amatic SC', cursive", 'rcSigFontAmatic'],
  ['rashi', "'Noto Rashi Hebrew', serif", 'rcSigFontRashi'],
];
const sigFont = (key) => (SIG_FONTS.find(([k]) => k === key) || SIG_FONTS[0])[1];

function letterOf(org) {
  if (!letterState[org]) {
    const det = orgDetailsOf(org) || {};
    const v = (k, d) => (det[k] != null && det[k] !== '' ? det[k] : d);
    letterState[org] = {
      letter_salutation: v('letter_salutation', DEFAULTS.letter_salutation),
      salutation_suffix: v('salutation_suffix', DEFAULTS.salutation_suffix),
      letter_a: v('letter_a', DEFAULTS.letter_a),
      letter_b: v('letter_b', DEFAULTS.letter_b),
      letter_closing: v('letter_closing', DEFAULTS.letter_closing),
      signer_he: v('signer_he', DEFAULTS.signer_he),
      signature_text: v('signature_text', ''),
      signature_font: v('signature_font', 'playpen'),
    };
  }
  return letterState[org];
}

function letterPanelHtml(org) {
  const L = letterOf(org);
  const hist = historyOf(orgDetailsOf(org) || {});
  return `<details class="rc-letter-box" open><summary>✉ ${h(t('rcLetterPanel'))}</summary>
    <div class="od-letter" dir="rtl">
      <div class="od-date">📅 ${h(isoToHebrewText(new Date().toISOString().slice(0, 10)))} לפ"ק <span class="muted small">(${h(t('rcAuto'))})</span></div>
      <div class="od-sal">
        <input data-l="letter_salutation" value="${h(L.letter_salutation)}">
        <span class="od-auto">${h(t('rcSalName'))}</span>
        <input data-l="salutation_suffix" class="od-short" value="${h(L.salutation_suffix)}">
      </div>
      ${hist.length ? `<label class="od-hist">${h(t('rcHistory'))}
        <select id="lt-history"><option value=""></option>${hist.map((x, i) => `<option value="${i}">${h(`${x.a} … ${x.b}`.slice(0, 90))}</option>`).join('')}</select></label>` : ''}
      <textarea data-l="letter_a" rows="3">${h(L.letter_a)}</textarea>
      <div class="od-auto od-middle">${h(t('rcMiddle'))}</div>
      <textarea data-l="letter_b" rows="5">${h(L.letter_b)}</textarea>
      <div class="od-center"><input data-l="letter_closing" value="${h(L.letter_closing)}"></div>
      <div class="od-center lt-sigrow">
        <input data-l="signature_text" class="lt-sigtext" value="${h(L.signature_text)}" placeholder="${h(t('rcSigPh'))}" style="font-family:${sigFont(L.signature_font)}">
        <select data-l="signature_font">${SIG_FONTS.map(([k, , l]) => `<option value="${k}"${k === L.signature_font ? ' selected' : ''}>${h(t(l))}</option>`).join('')}</select>
      </div>
      <div class="od-center"><input data-l="signer_he" value="${h(L.signer_he)}"></div>
      <p class="hint-line">${h(t('rcLetterRemember'))}</p>
    </div></details>`;
}

function wireLetterPanel(main, org, rerender) {
  const L = letterOf(org);
  $$('[data-l]', main).forEach((el) => {
    el.oninput = () => { L[el.dataset.l] = el.value; };
    el.onchange = () => {
      L[el.dataset.l] = el.value;
      if (el.dataset.l === 'signature_font') $('.lt-sigtext', main).style.fontFamily = sigFont(el.value);
    };
  });
  $('#lt-history', main)?.addEventListener('change', (e) => {
    const x = historyOf(orgDetailsOf(org) || {})[Number(e.target.value)];
    if (!x) return;
    L.letter_a = x.a; L.letter_b = x.b;
    $('[data-l=letter_a]', main).value = x.a;
    $('[data-l=letter_b]', main).value = x.b;
  });
}

/** היט אפ דעם בריוו (ווען ער האט זיך געטוישט) — כדי דאס קומענדיגע מאל זאל עס שוין זיין דא, און אין דער היסטאריע. */
async function rememberLetter(org) {
  const L = letterOf(org);
  const det = orgDetailsOf(org) || {};
  const keys = Object.keys(L);
  if (keys.every((k) => String(det[k] ?? '') === String(L[k] ?? ''))) return;
  const hist = historyOf(det).filter((x) => !(x.a === L.letter_a && x.b === L.letter_b));
  const o = { org, ...L, letter_history: JSON.stringify([{ a: L.letter_a, b: L.letter_b }, ...hist].slice(0, 12)) };
  await saveOrgDetails(o);
  const i = state.orgDetails.findIndex((x) => x.org === org);
  if (i >= 0) state.orgDetails[i] = { ...state.orgDetails[i], ...o };
}

function historyOf(det) {
  try { const x = JSON.parse(det.letter_history || '[]'); return Array.isArray(x) ? x : []; } catch { return []; }
}

export function openOrgDetails(org) {
  const dlg = $('#orgdet-dialog');
  const form = $('#orgdet-form');
  const det = orgDetailsOf(org) || {};
  const um = orgDetailsOf(umbrellaName()) || {};
  const img = { header_img: joinImg(det, 'header_img'), logo: orgLogo(org) };
  const yearly = state.yearly.filter((y) => y.org === org);
  const yimg = Object.fromEntries(yearly.map((y) => [y.series, joinImg(y, 'header_img')]));
  const val = (k, def) => (det[k] != null && det[k] !== '' ? det[k] : def);
  const field = ([k, l, def, kind, dir]) => {
    const hint = k === 'ein' ? t('rcfEinHint', { ein: um.ein || '—' }) : k === 'org_name_he' ? t('rcfNameHeHint', { org }) : k === 'tax_text' ? t('rcfTaxHint', { NAME: '{NAME}', EIN: '{EIN}' }) : '';
    return `<label class="${kind === 'area' || kind === 'wide' || k === 'legal_name' ? 'wide' : ''}">${h(t(l))}${kind === 'req' ? ' *' : ''}
      ${kind === 'area' ? `<textarea name="${k}" rows="4" dir="${dir}">${h(val(k, def))}</textarea>`
        : `<input name="${k}" value="${h(val(k, def))}" dir="${dir}"${kind === 'req' ? ' required' : ''}>`}
      ${hint ? `<span class="hint-line">${h(hint)}</span>` : ''}</label>`;
  };
  const imgBox = (key, label, src, hint) => `<div class="od-img" data-img="${key}"><b>${h(label)}</b>${hint ? `<span class="hint-line">${h(hint)}</span>` : ''}
      <div class="od-prev">${src ? `<img src="${src}" alt="">` : '<span class="muted small">—</span>'}</div>
      <div class="od-img-btns"><label class="btn small-btn">${h(t(src ? 'admLogoChange' : 'admLogoUpload'))}<input type="file" accept="image/*" hidden></label>
      ${src ? `<button type="button" class="linkish" data-img-del>${h(t('admLogoRemove'))}</button>` : ''}</div></div>`;
  const sec = (key, inner) => `<section class="od-section"><h3 class="od-sec">${h(t(key))}</h3>${inner}</section>`;
  form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>🧾 ${h(t('rcDetailsTitle'))}</h2>
    <label class="wide org-pick">${h(t('forOrg'))} ${orgSelect('org', org, 'id="od-org"')}</label>
    <p class="hint-line">${h(t('rcDetailsHint2', { org }))}</p>
    <div class="od-layout">
      <div class="od-fields">
        ${sec('rcS1', `<div class="od-imgs">${imgBox('header_img', t('rcfBanner'), img.header_img, t('rcfBannerHint'))}
          ${yearly.map((y) => imgBox(`y:${y.series}`, `🔁 ${y.series}`, yimg[y.series], t('rcCampBannersHint'))).join('')}</div>`)}
        ${SECTIONS.map(([key, fields]) => sec(key, `${key === 'rcS5' ? `<div class="od-imgs">${imgBox('logo', t('rcfLogo'), img.logo, t('rcfLogoHint'))}</div>` : ''}
          <div class="grid od-grid">${fields.map(field).join('')}</div>`)).join('')}
      </div>
      <aside class="od-live"><div class="od-live-head">👁 ${h(t('rcLive'))}</div><div class="od-live-box"><div class="od-live-scale"></div></div></aside>
    </div>
    <div class="actions"><span class="spacer"></span>
      <button type="button" class="btn" id="od-preview">🖨 ${h(t('rcPreview'))}</button>
      <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>`;
  $$('[data-close]', form).forEach((b) => { b.onclick = () => dlg.close(); });
  $('#od-org', form).onchange = (e) => { dlg.close(); openOrgDetails(e.target.value); };
  const changedY = new Set();
  let logoChanged = false;
  const collect = () => {
    const o = { org: $('#od-org', form).value };
    ALL_FIELDS.forEach((k) => { o[k] = form.elements[k].value.trim(); });
    o.receipt_prefix = o.receipt_prefix.toUpperCase().replace(/[^A-Z0-9]/g, '');
    Object.assign(o, splitImg(img.header_img || '', 'header_img'));
    return o;
  };
  // א פראבע-קבלה מיט וואס שטייט יעצט אינעם פארם (נישט אפגעהיט)
  const sample = (fn) => {
    const o = collect();
    const keep = state.orgDetails;
    const keepLogo = state.orgLogos?.[o.org];
    if (logoChanged && state.orgLogos) state.orgLogos[o.org] = img.logo;
    state.orgDetails = [...keep.filter((x) => x.org !== o.org), { ...(keep.find((x) => x.org === o.org) || {}), ...o }];
    const y = state.yearly.find((x) => x.org === o.org && yimg[x.series]);
    const savedY = y ? { ...y } : null;
    if (y) Object.assign(y, splitImg(yimg[y.series], 'header_img'));
    const fake = { donation_id: 0, amount_usd: 180, is_paid: true, paid_date: new Date().toISOString().slice(0, 10), payment_method: "צ'ק", check_number: '1001', campaign: y ? `${y.series} תשפ"ז` : '', event_tags: 'נדבה' };
    try {
      return fn({ kind: 'receipt', org: o.org, contact_id: '', donor_name: 'Mr. & Mrs. Sample Donor', ids: [], amount: 180, period: '', list: [fake], receipt_no: `${o.receipt_prefix || 'R'}-0000`, issued_at: new Date().toISOString().slice(0, 10), reprint: false });
    } finally {
      state.orgDetails = keep;
      if (logoChanged && state.orgLogos) state.orgLogos[o.org] = keepLogo;
      if (y) Object.assign(y, savedY);
    }
  };
  let timer = null;
  const live = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { $('.od-live-scale', form).innerHTML = sample((d) => docHtml(d)); }, 150);
  };
  form.oninput = live;
  $$('.od-img[data-img]', form).forEach((box) => {
    const key = box.dataset.img;
    const show = (src) => { $('.od-prev', box).innerHTML = src ? `<img src="${src}" alt="">` : '<span class="muted small">—</span>'; };
    const set = (src) => {
      if (key.startsWith('y:')) { yimg[key.slice(2)] = src; changedY.add(key.slice(2)); } else img[key] = src;
      if (key === 'logo') logoChanged = true;
      show(src);
      live();
    };
    $('input[type=file]', box).onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        set(key === 'signature_img' ? await shrinkImage(file, 600, 45000)
          : key === 'logo' ? await shrinkImage(file, 320) : await shrinkImage(file, 1700, CELL * 3 - 100, true));
      } catch (err) { ui.toast(err.message === 'too-big' ? t('mmImageTooBig') : t('mmImageBad'), 'error'); }
    };
    $('[data-img-del]', box)?.addEventListener('click', () => set(''));
  });
  $('#od-preview', form).onclick = () => sample((d) => printDocs([d]));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const o = collect();
    try {
      await saveOrgDetails(o);
      if (logoChanged) await saveOrgLogo(o.org, img.logo || '');
      for (const series of changedY) {
        await saveYearly({ series, ...splitImg(yimg[series] || '', 'header_img') });
      }
      await loadAll();
      dlg.close();
      ui.toast(t('saved'));
      if (!$('.view[data-view="receipts"]').hidden) renderReceipts();
      if (!$('.view[data-view="admin"]').hidden) ui.refreshAdmin?.();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  if (!dlg.open) dlg.showModal();
  live();
}

/** פאר אדמין: א ליסטע פון אלע ארגונים — ווער האט שוין פרטים פאר קבלות. */
export function orgDetailsAdminHtml() {
  return `<div class="adm-group" data-tab="lists"><h3 class="adm-group-title">🧾 ${h(t('rcDetailsTitle'))}</h3>
    <p class="hint-line">${h(t('rcDetailsHint'))}</p>
    <div class="od-list">${allOrgs().map((o) => {
      const d = orgDetailsOf(o);
      const ok = d && d.legal_name && d.address;
      return `<button type="button" class="od-item${ok ? ' ok' : ''}" data-org-details="${h(o)}"><b>${h(o)}</b>
        <span class="small ${ok ? 'share-ok' : 'share-no'}">${ok ? `✓ ${h(d.legal_name)}${d.ein ? ` · EIN ${h(d.ein)}` : ''}` : `⚠ ${h(t('rcNoDetails'))}`}</span></button>`;
    }).join('')}</div></div>`;
}
