// Invoice & Receipt: קבלות אויף נדבות, Invoices אויף נישט-באצאלטע, יערליכע סיכומים (פאר טעקס), און קבלות פאר א קאמפיין.
// יעדער ארגון מיט זיינע אייגענע פרטים (לשונית OrgDetails); יעדער דאקומענט באקומט א נומער (לשונית Receipts),
// און ביים נאכאמאל דרוקן — דער זעלבער נומער.
import { customFontNames } from './fonts.js';
import {
  state, loadAll, orgDetailsOf, issueDocs, saveDonation, findIssued, voidReceipt, metaOfReceipt, orgLogo, saveOrgDetails, saveYearly, saveOrgLogo, deleteDonation,
} from './data.js';
import { t } from './i18n.js';
import { careOf } from './data.js';
import { isTrue, escapeHtml as h, mailingName, splitTags, shrinkImage } from './util.js';
import { isoToHebrewText } from './hebdate.js';
import { effectiveOrg, umbrellaName, entityOrgs, isEntityOrg, campaignOrg } from './scope.js';
import { money, orgSelect } from './donations.js';
import { campaignOptions } from './campaigns.js';
import { allCampaigns } from './campaigns.js';
import { downloadXlsx } from './excel.js';
import { emailOf, emailLayout, sendJobs } from './mail.js';
import { ensureGmailScope, hasGmailScope } from './google.js';
import { htmlToJpeg, jpegsToPdf } from './pdf.js';
import { savedInScope, parseSaved, evaluate } from './lists.js';
import { submitRequest } from './requests.js';
import { letterSizeFor, letterTemplates, letterPagesFor, letterHasReceipt, openMailMergeFor, mySigObj } from './mailmerge.js';
import { imageOf } from './images.js';
import { workOf } from './work.js';
import { bookPickerHtml, wireBookPicker, BOOKS_ORG, booksOf, bookById } from './books.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const KINDS = [['receipt', 'rcKindReceipt'], ['invoice', 'rcKindInvoice'], ['year', 'rcKindYear'], ['campaign', 'rcKindCampaign']];
/** א קבלה (נישט בטל) וואס האט אין זיך די נדבה (אויך מיט נאך נדבות) */
const receiptWith = (id) => state.receipts.find((r) => !isTrue(r.void) && !['invoice', 'year', 'campaign'].includes(r.kind) && String(r.donation_ids || '').split(',').includes(String(id))) || null;
const DEFAULT_ORG = 'ביהמ"ד בארא פארק';
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
  return [umbrellaName(), ...lists, ...entityOrgs()].filter(Boolean);
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
    ? D.filter((d) => inOrg(d) && isTrue(d.is_paid) && d.kind !== 'sale' && paidDate(d).startsWith(`${f.year}-`))
    : D.filter((d) => f.campaign && d.campaign === f.campaign && isTrue(d.is_paid) && d.kind !== 'sale');
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
  // ברירת מחדל: ביהמ"ד בארא פארק (דער "כלל" איז נישט קיין באזונדער מוסד)
  if (!f.org || !orgs.includes(f.org)) f.org = orgs.find((o) => o === DEFAULT_ORG) || orgs.find((o) => o !== umbrellaName()) || orgs[0] || '';
  if (f.kind === 'campaign') {
    const c = allCampaigns().find((x) => x.name === f.campaign);
    if (c?.org) f.org = c.org;
  }
  const det = orgDetailsOf(f.org);
  const missing = !det || !det.legal_name || !det.address;
  const whoSet = whoFilter();
  const list = candidates().filter((c) => !whoSet || whoSet.has(String(c.contact_id)))
    .map((c) => ({ ...c, issued: findIssued(c.kind, c.org, c.ids, c.period, c.contact_id || c.donor_name) || (c.kind === 'receipt' ? receiptWith(c.ids[0]) : null) }));
  const whoC = f.whoC ? ui.contactById(f.whoC) : null;
  const lists = savedInScope();
  // לינקס: נאך אן א קבלה; רעכטס: וואס איז שוין ארויס
  const shown = list.filter((c) => !c.issued);
  const years = [...new Set(state.donations.map((d) => paidDate(d).slice(0, 4)).filter(Boolean).concat(String(new Date().getFullYear())))].sort().reverse();
  const camps = allCampaigns().filter((c) => c.list.length);
  main.innerHTML = `<div class="camp-page-head"><h2>🧾 Invoice &amp; Receipt</h2><span class="spacer"></span>
      <button type="button" class="btn" id="rc-lobby">${h(t('lobbyBack'))}</button></div>
    <div class="rc-kinds">${KINDS.map(([k, l]) => `<button type="button" class="nc-kind${f.kind === k ? ' on' : ''}" data-kind="${k}"><b>${h(t(l))}</b><span>${h(t(`${l}Help`))}</span></button>`).join('')}</div>
    <div class="toolbar rc-filters">
      ${f.kind === 'campaign'
        ? `<label>${h(t('xlCampaign'))} <select id="rc-campaign"><option value=""></option>${camps.map((c) => `<option${c.name === f.campaign ? ' selected' : ''}>${h(c.name)}</option>`).join('')}</select></label>
           <span class="muted">${f.org ? `${h(t('forOrg'))}: <b>${h(f.org)}</b>` : ''}</span>`
        : `<label>${h(t('forOrg'))} <select id="rc-org">${orgs.map((o) => `<option value="${h(o)}"${o === f.org ? ' selected' : ''}>${h(o)}${isEntityOrg(o) ? ` · ${h(t('entityTag'))}` : ''}</option>`).join('')}</select></label>`}
      ${f.kind === 'receipt' ? `<label>${h(t('rcFrom'))} <input type="date" id="rc-from" value="${h(f.from)}"></label><label>${h(t('rcTo'))} <input type="date" id="rc-to" value="${h(f.to)}"></label>` : ''}
      ${f.kind === 'year' ? `<label>${h(t('rcTaxYear'))} <select id="rc-year">${years.map((y) => `<option${y === f.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>` : ''}
      <span class="rc-who">${h(t('rcWho'))}
        <input id="rc-who-c" list="dl-rc-contacts" autocomplete="off" placeholder="${h(t('rcWhoPh'))}" value="${whoC ? h(ui.pickerLabel(whoC)) : ''}">
        <datalist id="dl-rc-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
        <select id="rc-who-l"><option value="">${h(t('rcWhoAll'))}</option>${lists.map((l) => `<option value="${h(l.list_id)}"${String(l.list_id) === String(f.whoL || '') ? ' selected' : ''}>📋 ${h(l.name)}</option>`).join('')}</select>
        ${f.whoC || f.whoL ? `<button type="button" class="linkish" id="rc-who-x">✕</button>` : ''}</span>
      ${f.kind !== 'year' ? `<label class="rc-for">${h(t('rcForLabel'))} <input id="rc-for" value="${h(f.forText || '')}" placeholder="${h(t('rcForPh'))}" dir="rtl"></label>` : ''}
    </div>
    ${missing ? `<p class="drive-warn">⚠ ${h(t('rcMissingDetails', { org: f.org }))} <button type="button" class="btn small-btn primary" id="rc-edit-org">${h(t('rcEditDetails'))}</button></p>`
      : `<p class="muted small">${h(det.legal_name)} · EIN ${h(det.ein || '—')} <button type="button" class="linkish" id="rc-edit-org">${h(t('rcEditDetails'))}</button></p>`}

    ${f.kind === 'invoice' && !missing ? `<p><button type="button" class="btn" id="rc-newinv">+ ${h(t('ivNew'))}</button> <span class="muted small">${h(t('ivNewHint'))}</span></p>` : ''}
    ${f.kind === 'receipt' ? `<p><button type="button" class="btn primary" id="rc-quick">+ ${h(t('rqTitle'))}</button> <span class="muted small">${h(t('rqHint'))}</span></p>` : ''}
    <div class="rc-search"><input id="rc-q" type="search" placeholder="🔍 ${h(t('rcSearchPh'))}" value="${h(f.q || '')}"></div>
    <div class="rc-cols">
    <section class="rc-col">
    <h3 class="rc-colh">${h(t(f.kind === 'invoice' ? 'rcColPending' : 'rcColNoReceipt'))} <span class="muted small">(${shown.length})</span></h3>
    <div class="rc-actions">
      <label class="check"><input type="checkbox" id="rc-all"> ${h(t('rcSelectAll'))}</label>
      <span class="muted" id="rc-count"></span>
      <span class="spacer"></span>
      ${f.kind !== 'invoice' ? `<select id="rc-letter" title="${h(t('rcWithLetterTip'))}"><option value="">📄 ${h(t('rcNoLetter'))}</option>${letterTemplates().map((x) => `<option value="${h(x.id)}"${String(x.id) === String(f.letter || '') ? ' selected' : ''}>📄 ${h(x.name)}</option>`).join('')}</select>` : ''}

      <button type="button" class="btn" id="rc-env">✉ ${h(t('rcEnvelopes'))}</button>
      <button type="button" class="btn" id="rc-sample">👁 ${h(t('rcPreview'))}</button>
      <button type="button" class="btn" id="rc-xl">Excel</button>
      <button type="button" class="btn" id="rc-mail" disabled>✉ ${h(t('rcMailBtn'))}</button>
      <button type="button" class="btn primary" id="rc-print" disabled>🖨 ${h(t('rcPrint'))}</button>
    </div>
    ${shown.length ? `<table class="lapsed-table rc-table no-sort"><thead><tr><th></th><th>${h(t('xlDonor'))}</th><th>${h(t('rcWhat'))}</th><th>${h(t('xlAmount'))}</th></tr></thead>
      <tbody>${shown.map((c, i) => `<tr data-q="${h(qText(donorLabel(c), englishName(c), whatText(c), c.amount))}"><td><input type="checkbox" class="rc-pick" data-i="${i}"></td>
        <td>${h(donorLabel(c))}${addrOf(c) ? '' : ` <span class="badge muted" title="${h(t('rcNoAddress'))}">✉?</span>`}
          <button type="button" class="linkish small rc-formbtn" data-form="${i}" title="${h(t(c.kind === 'invoice' ? 'ivFormTip' : 'rcFormTip'))}">${c.kind === 'invoice' ? '📄' : '🧾'} ${h(t('rcForm'))}</button></td>
        <td class="muted small">${h(whatText(c))}</td>
        <td class="num" dir="ltr">${money(c.amount)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="empty">${h(t(f.kind === 'campaign' && !f.campaign ? 'rcPickCampaign' : 'rcNothing'))}</p>`}
    </section>
    <section class="rc-col">${issuedLogHtml()}</section>
    </div>`;
  // חיפוש — אין ביידע טורים
  const doSearch = () => {
    const q = String($('#rc-q', main).value || '').trim().toLowerCase();
    f.q = q;
    $$('tr[data-q]', main).forEach((tr) => { tr.hidden = Boolean(q) && !tr.dataset.q.includes(q); });
  };
  $('#rc-q', main).addEventListener('input', doSearch);
  doSearch();
  const rerender = () => renderReceipts();
  $('#rc-lobby', main).onclick = () => ui.showView('lobby');
  $$('[data-kind]', main).forEach((b) => { b.onclick = () => { f.kind = b.dataset.kind; rerender(); }; });
  $('#rc-org', main)?.addEventListener('change', (e) => { f.org = e.target.value; rerender(); });
  $('#rc-campaign', main)?.addEventListener('change', (e) => { f.campaign = e.target.value; rerender(); });
  $('#rc-from', main)?.addEventListener('change', (e) => { f.from = e.target.value; rerender(); });
  $('#rc-to', main)?.addEventListener('change', (e) => { f.to = e.target.value; rerender(); });
  $('#rc-year', main)?.addEventListener('change', (e) => { f.year = e.target.value; rerender(); });
  $('#rc-who-c', main).addEventListener('change', (e) => {
    const v = e.target.value.trim();
    const c = state.contacts.find((x) => ui.pickerLabel(x) === v);
    if (v && !c) { ui.toast(t('rcWhoNotFound'), 'error'); return; }
    f.whoC = c ? String(c.contact_id) : ''; f.whoL = '';
    rerender();
  });
  $('#rc-who-l', main).addEventListener('change', (e) => { f.whoL = e.target.value; f.whoC = ''; rerender(); });
  $('#rc-who-x', main)?.addEventListener('click', () => { f.whoC = ''; f.whoL = ''; rerender(); });
  $('#rc-for', main)?.addEventListener('input', (e) => { f.forText = e.target.value; });
  $('#rc-onlynew', main)?.addEventListener('change', (e) => { f.onlyNew = e.target.checked; rerender(); });

  $('#rc-sample', main).onclick = () => {
    const d = picked()[0] || shown[0];
    if (!d) return;
    printDocs([{ ...d, receipt_no: d.issued?.receipt_no || '—', issued_at: new Date().toISOString().slice(0, 10), forText: f.kind !== 'year' ? String(f.forText || '').trim() : '' }], { letter: f.letter });
  };
  $('#rc-edit-org', main).onclick = () => openOrgDetails(f.org);
  $('#rc-letter', main)?.addEventListener('change', (e) => { f.letter = e.target.value; });
  $('#rc-quick', main)?.addEventListener('click', () => openQuickReceipt(f.org, rerender));
  $('#rc-newinv', main)?.addEventListener('click', () => { if (missing) { openOrgDetails(f.org); return; } openInvoiceForm({ kind: 'invoice', org: f.org, contact_id: '', donor_name: '', list: [], ids: [], amount: 0, period: '' }, { done: rerender }); });
  $$('[data-form]', main).forEach((b) => { b.onclick = () => { if (missing) { openOrgDetails(f.org); return; } const c = shown[Number(b.dataset.form)]; if (c.kind === 'invoice') { openInvoiceForm(c, { done: rerender }); return; } openReceiptForm(shown[Number(b.dataset.form)], { letter: f.letter, forText: f.kind !== 'year' ? String(f.forText || '').trim() : '', done: rerender }); }; });
  $('#rc-env', main).onclick = () => {
    const docs = picked().length ? picked() : shown;
    const ids = [...new Set(docs.map((d) => String(d.contact_id || '')).filter(Boolean))];
    if (!ids.length) { ui.toast(t('rcNothing'), 'error'); return; }
    openMailMergeFor(ids, `${t(KINDS.find(([k]) => k === f.kind)[1])} · ${f.org}`);
  };
  const picked = () => $$('.rc-pick:checked', main).map((x) => shown[Number(x.dataset.i)]);
  const sync = () => {
    const n = picked().length;
    $('#rc-count', main).textContent = n ? t('rcPicked', { n }) : '';
    $('#rc-print', main).disabled = !n || missing;
    $('#rc-mail', main).disabled = !n || missing;
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
      const forText = f.kind !== 'year' ? String(f.forText || '').trim() : '';
      printDocs(await prepareDocs(docs, forText), { letter: f.letter });
      await loadAll();
      rerender();
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
      btn.disabled = false;
    }
  };
  $('#rc-mail', main).onclick = () => {
    const docs = picked();
    if (!docs.length) return;
    const withMail = docs.filter((d) => emailOf(ui.contactById(d.contact_id)));
    if (!withMail.length) { ui.toast(t('rcMailNone'), 'error'); return; }
    if (!confirm(t('rcMailConfirm', { n: withMail.length, m: docs.length - withMail.length }))) return;
    const btn = $('#rc-mail', main);
    const forText = f.kind !== 'year' ? String(f.forText || '').trim() : '';
    withGmail(async () => {
      btn.disabled = true;
      try {
        if (f.kind !== 'invoice') await rememberLetter(f.org);
        const full = await prepareDocs(withMail, forText);
        const r = await mailDocs(full.map((c) => ({ c, to: emailOf(ui.contactById(c.contact_id)) })), (done, total) => { btn.textContent = `✉ ${done}/${total}`; }, f.letter);
        ui.toast(t('mailDone', { n: r.done - r.errors, errors: r.errors }), r.errors ? 'error' : '');
        await loadAll();
        rerender();
      } catch (err) {
        ui.toast(ui.friendlyError(err), 'error');
        btn.disabled = false;
        btn.textContent = `✉ ${t('rcMailBtn')}`;
      }
    });
  };
  wireLog(main);
  sync();
}

// ---------- שיקן אין אימעיל: א שיינער בריוו + די קבלה אלס PDF ----------
/** די הרשאה פון Gmail מוז מען בעטן גלייך ביים קליק (אנדערש בלאקירט דער בלעטערער דאס פענצטערל). */
function withGmail(fn) {
  const p = hasGmailScope() ? Promise.resolve() : ensureGmailScope();
  p.then(fn, (err) => ui.toast(ui.friendlyError(err), 'error'));
}

/** פרעגט צו וועמען (מיט דעם אדרעס פונעם קאנטאקט, אויב דא). '' = אפגעזאגט */
function askAddress(contactId) {
  const ans = window.prompt(t('rcMailTo'), emailOf(ui.contactById(contactId)));
  if (ans === null) return '';
  const e = ans.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { ui.toast(t('rcMailBad'), 'error'); return ''; }
  return e;
}

export async function receiptPdf(c, letter = '') {
  const pages = [];
  const page = async (html, W, H, scale = 1.8) => {
    const j = await htmlToJpeg(`<div class="mx-out" dir="ltr" style="width:${W}in;height:${H}in">${html}</div>`, { widthIn: W, heightIn: H, scale });
    pages.push(Object.assign(j, { pageW: W * 72, pageH: H * 72 }));
  };
  const ct = letter && c.contact_id ? ui.contactById(c.contact_id) : null;
  if (ct) {
    // דער בריוו (מיט דער קבלה אונטן, ווען ער האט "ייבוא קבלה"); אנדערש — דער בריוו און נאכדעם די קבלה
    const slot = letterHasReceipt(letter);
    const [W, H] = letterSizeFor(letter);
    for (const lp of letterPagesFor(letter, ct, { ...letterCtx(c), receipt: slot && c.kind !== 'invoice' ? receiptSlotHtml(c) : '' })) await page(lp, W, H);
    if (c.kind === 'invoice') await page(invoiceHtml(c), 8.5, 11);
    else if (needsFullPage(c)) { for (const x of receiptFullPages(c)) await page(x, 8.5, 11); } else if (!slot) await page(receiptHtml(c), 8.5, RX_H);
  } else if (c.kind === 'invoice') await page(invoiceHtml(c), 8.5, 11);
  else if (needsFullPage(c)) { for (const x of receiptFullPages(c)) await page(x, 8.5, 11); }
  else await page(receiptHtml(c), 8.5, RX_H, 2.2); // א PDF אין דער גרייס פון א דריטל בלאט
  const bytes = jpegsToPdf(pages, { margin: 0 });
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function mailContent(c) {
  const L = letterParts(c);
  const no = c.receipt_no;
  const kindEn = { receipt: 'Receipt', invoice: 'Invoice', year: `Year-End Statement ${c.period}`, campaign: 'Receipt', tuition: 'Tuition Receipt' }[c.kind];
  const subject = `${L.he || L.legal} · ${kindEn} #${no}`;
  const row = (k, v) => `<tr><td style="padding:4px 10px;color:#6b5a3a;font-size:14px;text-align:left;direction:ltr;width:110px">${k}</td><td style="padding:4px 10px;font-weight:bold;text-align:left" dir="auto">${v}</td></tr>`;
  const html = `<div style="color:#555;font-size:14px;margin-bottom:8px">${h(L.heDate)}</div>
    <div style="font-weight:bold;margin-bottom:8px">${h(L.salLine)}</div>
    ${para(L.body).replace(/<p>/g, '<p style="margin:0 0 12px;text-align:justify">')}
    <div style="margin-top:14px">${h(L.closing)}</div>
    ${L.sigText ? `<div style="font-family:${L.sigFont};font-size:26px;color:#1f2a5a">${h(L.sigText)}</div>` : ''}
    <div>${h(L.signer)}</div>
    <table role="presentation" style="margin:18px 0 6px;background:#fbf5e6;border:1px solid #e3d3ad;border-radius:8px;width:100%" dir="ltr">
      ${row(c.kind === 'invoice' ? 'Amount due' : 'Amount', `<span style="color:#7a1219;font-size:18px">${money(c.amount)}</span>`)}
      ${row(c.kind === 'invoice' ? 'Invoice #' : 'Receipt #', h(no))}
      ${row('For', h(c.forText || forWhat(c)))}
    </table>
    <p style="font-size:13px;color:#6b5a3a;margin:6px 0 0">📎 ${h(t('rcMailAttached'))}</p>`;
  const text = [L.heDate, L.salLine, L.body, L.closing, L.sigText, L.signer, '', `${kindEn} #${no}: ${money(c.amount)}`].filter((x) => x != null).join('\n\n');
  return { subject, html, text, banner: L.banner, fromName: L.he || L.legal };
}

/** items = [{ c, to }] — יעדע קבלה צו איר אדרעס */
async function mailDocs(items, onProgress = () => {}, letter = '') {
  const jobs = [];
  for (const { c, to } of items) {
    const m = mailContent(c);
    const b64 = await receiptPdf(c, letter);
    const { html, inline } = emailLayout(c.org, m.html, [], '', { banner: m.banner });
    jobs.push({ to, contact_id: c.contact_id, subject: m.subject, html, text: m.text, inline, kind: c.kind, org: c.org, fromName: m.fromName,
      attachments: [{ name: `${c.receipt_no}.pdf`, mime: 'application/pdf', b64 }] });
  }
  return sendJobs(jobs, { onProgress, fromName: jobs[0]?.fromName || '' });
}

/** "פאר וועמען": איין קאנטאקט אדער א רשימה → א סעט פון contact_id (null = אלע) */
function whoFilter() {
  if (f.whoC) return new Set([String(f.whoC)]);
  if (f.whoL) {
    const l = state.savedLists.find((x) => String(x.list_id) === String(f.whoL));
    if (!l) return null;
    return new Set(evaluate(parseSaved(l).cr).map((r) => String(r.c.contact_id)));
  }
  return null;
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

// ---------- ביטול: די קבלה (בטל) און די נדבות (אויסמעקן) — מיט א חלון פון אישור; א גבאי → צום מנהל ----------
/** c = { receipt_no?, kind, list, contact_id, donor_name }. מחזיר true ווען עס איז געטון (אדער געשיקט צום מנהל) */
export function cancelDoc(c) {
  return new Promise((resolve) => {
    const no = c.receipt_no && c.receipt_no !== '—' ? String(c.receipt_no) : '';
    const list = (c.list || []).filter((d) => d && d.donation_id && !String(d.donation_id).startsWith('T'));
    // א יערליכער / קאמפיין סיכום: נאר די קבלה בטל — די נדבות בלייבן
    const canDel = list.length && !['year', 'campaign', 'tuition'].includes(c.kind);
    const sale = list.some((d) => d.kind === 'sale');
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet rc-cancel-dlg';
    document.body.append(dlg);
    let ok = false;
    dlg.addEventListener('close', () => { dlg.remove(); resolve(ok); });
    const total = list.reduce((s2, d) => s2 + (Number(d.amount_usd) || 0), 0);
    dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
      <h2>🗑 ${h(t(sale ? 'rcCancelSaleT' : 'rcCancelT'))}</h2>
      <p><b>${h(donorLabel(c))}</b>${no ? ` · ${h(t('rcNumber'))} <b dir="ltr">#${h(no)}</b>` : ''}</p>
      ${list.length ? `<ul class="rc-cancel-list">${list.slice(0, 12).map((d) => `<li><span dir="ltr">${h(paidDate(d))}</span> · ${h(d.goods_desc || descText(d) || '—')} · <b dir="ltr">${money(d.amount_usd)}</b></li>`).join('')}${list.length > 12 ? `<li>… +${list.length - 12}</li>` : ''}</ul>` : ''}
      <div class="rc-cancel-opts">
        ${no ? `<p>🧾 ${h(t('rcCancelVoid', { no }))}</p>` : ''}
        ${canDel ? `<label class="check"><input type="checkbox" id="rcc-del" checked> ${h(t(sale ? 'rcCancelDelSale' : 'rcCancelDel', { n: list.length, amt: money(total) }))}</label>` : ''}
      </div>
      ${state.isAdmin ? '' : `<p class="mx-pending">⏳ ${h(t('rcCancelAdmin'))}</p>`}
      <div class="actions"><span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('rcCancelNo'))}</button>
        <button type="button" class="btn danger" id="rcc-yes">🗑 ${h(t(state.isAdmin ? 'rcCancelYes' : 'rcCancelSend'))}</button></div>`;
    $$('[data-x]', dlg).forEach((b) => { b.onclick = () => dlg.close(); });
    $('#rcc-yes', dlg).onclick = async () => {
      const del = canDel && ($('#rcc-del', dlg)?.checked ?? false);
      if (!no && !del) { dlg.close(); return; }
      const ids = del ? list.map((d) => String(d.donation_id)) : [];
      const btn = $('#rcc-yes', dlg); btn.disabled = true;
      try {
        if (!state.isAdmin) {
          await submitRequest('cancel_doc', { receipt_no: no, donation_ids: ids },
            `${t(sale ? 'rcCancelSaleT' : 'rcCancelT')}: ${no ? `#${no} · ` : ''}${donorLabel(c)} · ${money(total)}`);
          ui.toast(t('bkCancelReq'));
        } else {
          if (no) await voidReceipt(no);
          for (const d of list.filter((x) => ids.includes(String(x.donation_id)))) await deleteDonation(d);
          await loadAll();
          ui.toast(t(del ? (sale ? 'bkCanceled' : 'rcCanceled') : 'rcVoidedT'));
          ui.refreshAll?.();
        }
        ok = true;
        dlg.close();
      } catch (err) { btn.disabled = false; ui.toast(ui.friendlyError(err), 'error'); }
    };
    dlg.showModal();
  });
}

// ---------- ליסטע פון וואס איז שוין ארויסגעגעבן ----------
function issuedLogHtml() {
  const kinds = f.kind === 'invoice' ? ['invoice'] : f.kind === 'year' ? ['year'] : f.kind === 'campaign' ? ['campaign'] : ['receipt', 'tuition'];
  const mine = state.receipts.filter((r) => kinds.includes(r.kind) && (r.org === f.org || (f.kind === 'campaign' && r.period === f.campaign))).slice(-300).reverse();
  const kindLabel = (k) => t(k === 'tuition' ? 'rcKindTuition' : KINDS.find(([x]) => x === k)?.[1] || 'rcKindReceipt');
  const who = (r) => (r.contact_id ? (ui.contactById(r.contact_id) ? ui.fullNameHe(ui.contactById(r.contact_id)) : `#${r.contact_id}`) : r.donor_name);
  const en = (r) => { const ct = r.contact_id ? ui.contactById(r.contact_id) : null; return ct ? (mailingName(ct) || '') : ''; };
  if (!mine.length) return `<h3 class="rc-colh">${h(t(f.kind === 'invoice' ? 'rcColInvoices' : 'rcColIssued'))} <span class="muted small">(0)</span></h3><p class="empty">—</p>`;
  return `<h3 class="rc-colh">${h(t(f.kind === 'invoice' ? 'rcColInvoices' : 'rcColIssued'))} <span class="muted small">(${mine.length})</span></h3>
    <table class="lapsed-table rc-issued no-sort"><thead><tr><th>${h(t('rcNumber'))}</th><th>${h(t('xlType'))}</th><th>${h(t('xlDonor'))}</th><th>${h(t('xlAmount'))}</th><th>${h(t('rcIssued'))}</th><th></th></tr></thead>
    <tbody>${mine.map((r) => `<tr class="${isTrue(r.void) ? 'rc-void' : ''}" data-q="${h(qText(r.receipt_no, who(r), en(r), r.amount, r.period))}"><td dir="ltr">${h(r.receipt_no)}</td><td>${h(kindLabel(r.kind))}${r.period && !/^M\d+$/.test(r.period) ? ` · ${h(r.period)}` : ''}${r.kind === 'invoice' && paidBy(r) ? ` · <b class="rc-paid">✓ ${h(t('ivPaid', { no: paidBy(r) }))}</b>` : ''}</td>
      <td>${h(r.contact_id ? (ui.contactById(r.contact_id) ? ui.fullNameHe(ui.contactById(r.contact_id)) : `#${r.contact_id}`) : r.donor_name)}</td>
      <td class="num" dir="ltr">${money(r.amount)}</td><td class="small muted" dir="ltr">${h(r.issued_at)}</td>
      <td>${isTrue(r.void) ? h(t('rcVoided')) : `<button type="button" class="btn small-btn" data-reprint="${h(r.receipt_no)}">🖨</button>
        <button type="button" class="btn small-btn" data-remail="${h(r.receipt_no)}" title="${h(t('rcMailBtn'))}">✉</button>
        <button type="button" class="linkish rc-cancel-btn" data-void="${h(r.receipt_no)}" title="${h(t('rcCancelT'))}">🗑 ${h(t('rcVoid'))}</button>`}</td></tr>`).join('')}</tbody></table>`;
}
/** טעקסט פאר'ן חיפוש (קליינע אותיות) */
const qText = (...xs) => xs.map((x) => String(x ?? '')).join(' ').toLowerCase();
function englishName(c) { const ct = c.contact_id ? ui.contactById(c.contact_id) : null; return ct ? (mailingName(ct) || '') : ''; }

function fromLog(no) {
  const r = state.receipts.find((x) => x.receipt_no === no);
  const ids = String(r.donation_ids || '').split(',').filter(Boolean);
  if (r.kind === 'tuition') {
    const p = (state.tuition || []).find((x) => ids.includes(`T${x.payment_id}`));
    if (!p) { ui.toast(t('rcGone'), 'error'); return null; }
    return { ...tuitionDoc(p), receipt_no: r.receipt_no, issued_at: r.issued_at, reprint: true };
  }
  const list = ids.map((id) => state.donations.find((d) => String(d.donation_id) === id)).filter(Boolean);
  if (!list.length) { ui.toast(t('rcGone'), 'error'); return null; }
  return { kind: r.kind, org: r.org, contact_id: r.contact_id, donor_name: r.donor_name, ids, amount: Number(r.amount), period: r.period, list, receipt_no: r.receipt_no, issued_at: r.issued_at, reprint: true, meta: metaOfReceipt(r) };
}

function wireLog(main) {
  main.querySelectorAll('[data-reprint]').forEach((b) => {
    b.onclick = () => { const c = fromLog(b.dataset.reprint); if (c) printDocs([c]); };
  });
  main.querySelectorAll('[data-remail]').forEach((b) => {
    b.onclick = () => {
      const c = fromLog(b.dataset.remail);
      if (!c) return;
      const to = askAddress(c.contact_id);
      if (!to) return;
      withGmail(async () => {
        b.disabled = true; b.textContent = '…';
        try {
          const r = await mailDocs([{ c: { ...c, reprint: false }, to }]);
          ui.toast(r.errors ? t('mailFailed') : t('rcMailSent', { to }), r.errors ? 'error' : '');
        } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
        b.disabled = false; b.textContent = '✉';
      });
    };
  });
  main.querySelectorAll('[data-void]').forEach((b) => {
    b.onclick = async () => {
      const r = state.receipts.find((x) => x.receipt_no === b.dataset.void);
      if (!r) return;
      const ids = String(r.donation_ids || '').split(',').filter(Boolean);
      const list = ids.map((id) => state.donations.find((d) => String(d.donation_id) === id)).filter(Boolean);
      if (await cancelDoc({ ...r, list })) renderReceipts();
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
  const map = { "צ'ק": 'Check', 'כרטיס אשראי': 'Credit card', 'קאש': 'Cash', 'מזומן': 'Cash', 'אחר': 'Other' };
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
const TUITION_A = 'בזה הננו לאשר בתודה את קבלת תשלומכם';
const TUITION_B = 'ובברכה שתזכו לרוב נחת דקדושה מצאצאיכם, ולראותם גדלים לתורה ולמעשים טובים.';

function yearlyFor(c) {
  const camp = c.list.find((d) => d.campaign)?.campaign || (c.kind === 'campaign' ? c.period : '');
  if (!camp) return null;
  return state.yearly.find((y) => camp.startsWith(`${y.series} `)) || null;
}

/** וואס די נדבה איז געווען: קאמפיין / סיבה (פאר דעם בריוו). */
function forWhat(c) {
  if (c.kind === 'year') return `שנת ${c.period}`;
  const d = c.list?.[0] || {};
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

function letterParts(c) {
  const det = { ...(orgDetailsOf(c.org) || {}), ...(letterState[c.org] || {}) };
  // אלע ארגונים אין אמעריקע זענען אונטער דעם EIN פון קהל אונגוואר (דער כלל-ארגון) — ווען א ארגון האט נישט קיין אייגענעם
  const um = orgDetailsOf(umbrellaName()) || {};
  // "-" = דער ארגון האט נישט קיין EIN (נישט אונטער דעם כלל)
  const noEin = String(det.ein || '').trim() === '-';
  const ein = noEin ? '' : (det.ein || um.ein || '');
  const taxEntity = det.ein && !noEin ? (det.legal_name || c.org) : noEin ? (det.legal_name || c.org) : (um.legal_name || det.legal_name || c.org);
  const yc = yearlyFor(c);
  const ct = c.contact_id ? ui.contactById(c.contact_id) : null;
  const name = ct ? (mailingName(ct) || [ct.legal_first_name || ct.first_name_en, ct.last_name_en].filter(Boolean).join(' ') || ui.fullNameHe(ct)) : c.donor_name;
  let addr = ct ? [careOf(ct), ct.address, [ct.city, ct.state].filter(Boolean).join(', ') + (ct.zip ? ` ${ct.zip}` : '')].filter((x) => String(x || '').trim()) : [];
  // א קבלה מיט אן אנדער אדרעס: פון דער ארבעט, אדער א פרייער טעקסט
  const AD = c.meta?.addr;
  if (AD?.mode === 'free') addr = String(AD.text || '').split('\n').map((x) => x.trim()).filter(Boolean);
  else if (AD?.mode === 'work' && ct) {
    const w = workOf(ct)[Number(AD.i) || 0];
    if (w?.ad) { const parts = String(w.ad).split(/\s*,\s*/); addr = [w.t, parts[0], parts.slice(1).join(', ')].filter((x) => String(x || '').trim()); }
  }
  const banner = joinImg(yc, 'header_img') || joinImg(det, 'header_img');
  const sig = String(det.signature_img || '');
  const logo = orgLogo(c.org);
  const legal = det.legal_name || c.org;
  const he = det.org_name_he || '';
  const isInv = c.kind === 'invoice';
  const isTu = c.kind === 'tuition';
  const issued = String(c.issued_at || '').slice(0, 10);
  const heDate = issued ? `${isoToHebrewText(issued)} לפ"ק` : '';
  const A = isInv ? INVOICE_A : isTu ? TUITION_A : (det.letter_a || DEFAULTS.letter_a);
  const B = isInv ? INVOICE_B : isTu ? TUITION_B : (det.letter_b || DEFAULTS.letter_b);
  // "אל מע"כ ידידנו" + טיטל + פרטי נאמען + משפחה (לשון קודש) + הי"ו
  const toName = ct ? [ct.title_he, ct.first_name_he, ct.last_name_he].filter(Boolean).join(' ') : (c.donor_name || '');
  const salLine = [det.letter_salutation || DEFAULTS.letter_salutation, toName, det.salutation_suffix || DEFAULTS.salutation_suffix].filter(Boolean).join(' ');
  // נישט קיין קאמפיין? מ'קען שרייבן וואס עס איז (c.forText) — דאן גייט עס גלייך נאך "בסך של $..."
  const middle = c.forText ? `בסך של ${money(c.amount)} ${c.forText}` : `בסך של ${money(c.amount)} ב${forWhat(c)}`;
  const body = `${fillText(A, c, ct)} ${middle} ${fillText(B, c, ct)}`;
  const multi = c.list.length > 1;
  const title = { receipt: det.coupon_title || 'OFFICIAL RECEIPT', invoice: 'INVOICE · PLEDGE', year: `YEAR-END STATEMENT ${c.period}`, campaign: det.coupon_title || 'OFFICIAL RECEIPT', tuition: 'TUITION RECEIPT' }[c.kind];
  const taxLine = isInv ? `Please make checks payable to ${legal}.` : isTu ? 'Tuition payment. This is not a tax-deductible charitable contribution.'
    : String(det.tax_text || TAX_DEFAULT).replace(/\{NAME\}/g, taxEntity).replace(/\{EIN\}/g, ein || '—')
      .replace('this contribution', multi ? 'these contributions' : 'this contribution');
  const sigText = det.signature_text || '';
  return { det, ein, taxEntity, ct, name, addr, banner, sig, logo, legal, he, isInv, heDate, salLine, body, multi, title, taxLine,
    closing: det.letter_closing || DEFAULTS.letter_closing, signer: det.signer_he || DEFAULTS.signer_he, sigText, sigFont: sigFont(det.signature_font) };
}

function docHtml(c) {
  const { det, ein, name, addr, banner, sig, logo, legal, he, isInv, heDate, salLine, body, multi, title, taxLine } = letterParts(c);
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

/** די נדבה-פרטים פון א קבלה — פאר די פעלדער אינעם בריוו */
function letterCtx(c) {
  const dates = c.list.map(paidDate).filter(Boolean).sort();
  return {
    list: c.list, total: Number(c.amount) || 0, paid: c.kind === 'invoice' ? 0 : Number(c.amount) || 0, remaining: c.kind === 'invoice' ? Number(c.amount) || 0 : 0,
    date: dates.at(-1) || '', campaign: c.forText || forWhat(c),
    dedication: [...new Set(c.list.map((d) => [d.dedication_type, d.dedication_text].filter(Boolean).join(' ')).filter(Boolean))].join(' · '),
  };
}
/** קאנווערט מיט א פענצטער: דער אדרעס אויפן ריכטיגן פלאץ (אין דער קבלה; די בלאט-ראנד איז 0.5in) */
function windowBlock(c) {
  const { name, addr } = letterParts(c);
  return `<div class="rc-winaddr" dir="ltr"><b>${h(name)}</b>${addr.map((l) => `<br>${h(l)}`).join('')}</div>`;
}
const WIN_BOTTOM = 3.35; // אינטשעס פונעם אויבן פונעם בלאט: אונטער דעם — דער טעקסט פונעם בריוו

/** דרוקט: יעדע קבלה אויף איר בלאט (אויבן די קבלה, אונטן דער אדרעס פאר'ן פענצטער). opts.letter = א בריוו פון Mail Merge פאר יעדן */
export function printDocs(docs, opts = {}) {
  const letter = opts.letter || '';
  let area = $('#rc-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'rc-print-area'; document.body.append(area); }
  const slot = letter ? letterHasReceipt(letter) : false;
  const pages = [];
  docs.forEach((c) => {
    const ct = letter && c.contact_id ? ui.contactById(c.contact_id) : null;
    const lps = ct ? letterPagesFor(letter, ct, { ...letterCtx(c), receipt: slot && c.kind !== 'invoice' ? receiptSlotHtml(c) : '' }) : [];
    lps.forEach((p) => pages.push(`<div class="rx-sheet rx-ltr">${p}</div>`));
    if (!lps.length || !slot || needsFullPage(c) || c.kind === 'invoice') pages.push(receiptSheetHtml(c));
  });
  area.innerHTML = pages.join('');
  area.classList.add('rx-area');
  let st = $('#rc-page-style');
  if (!st) { st = document.createElement('style'); st.id = 'rc-page-style'; document.head.append(st); }
  st.textContent = '@page { size: letter; margin: 0; }';
  document.body.classList.add('printing-rc');
  const done = () => { document.body.classList.remove('printing-rc'); area.innerHTML = ''; st.textContent = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // די בילדער און די שריפטן (כתב-יד) מוזן זיך אויסלאדן פארן דרוקן
  const fonts = ["24px 'Playpen Sans Hebrew'", "24px 'Amatic SC'", "24px 'Noto Rashi Hebrew'", "16px 'Frank Ruhl Libre'", "bold 16px 'Frank Ruhl Libre'"]
    .map((f2) => (document.fonts?.load ? document.fonts.load(f2, 'אבג').catch(() => null) : null));
  Promise.all([...fonts, ...$$('img', area).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; })))])
    .then(() => (document.fonts?.ready || null))
    .then(() => window.print());
}

/** א Invoice וואס איז באצאלט: די קבלה וואס האט אלע זיינע נדבות */
function paidBy(r) {
  const ids = String(r.donation_ids || '').split(',').filter(Boolean);
  if (!ids.length) return '';
  const rc = state.receipts.filter((x) => !isTrue(x.void) && x.kind !== 'invoice' && ids.some((id) => String(x.donation_ids || '').split(',').includes(id)));
  const covered = ids.every((id) => rc.some((x) => String(x.donation_ids || '').split(',').includes(id)));
  return covered ? [...new Set(rc.map((x) => x.receipt_no))].join(', ') : '';
}
/** פאר'ן דרוקן/שיקן: וואס האט שוין א קבלה — די זעלבע קבלה (א קאפיע); די אנדערע — נייע נומערן */
async function prepareDocs(docs, forText = '') {
  const out = docs.map((d) => (d.issued && d.kind !== 'invoice' ? fromLog(d.issued.receipt_no) : null));
  const todo = docs.filter((d, i) => !out[i]);
  const issued = todo.length ? await issueDocs(todo.map((d) => issueOf(d))) : [];
  let k = 0;
  return docs.map((d, i) => {
    if (out[i]) return { ...out[i], forText };
    const x = issued[k++];
    return { ...d, receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint, meta: x.meta, forText };
  }).filter(Boolean);
}
/** וואו די לעצטע קבלה פון דעם מענטש איז געשיקט געווארן (ער וויל אפשר אן אנדער אדרעס) */
function lastAddr(contactId) {
  if (!contactId) return null;
  const r = [...state.receipts].reverse().find((x) => String(x.contact_id) === String(contactId) && !isTrue(x.void) && metaOfReceipt(x).addr);
  return r ? metaOfReceipt(r).addr : null;
}
/** קלייבן דעם אדרעס פאר דער קבלה: אינדערהיים / די ארבעט / פרייער טעקסט */
function addrPickerHtml(contactId, A) {
  const ct = contactId ? ui.contactById(contactId) : null;
  const home = ct ? [ct.address, [ct.city, ct.state].filter(Boolean).join(', '), ct.zip].filter(Boolean).join(' ') : '';
  const works = ct ? workOf(ct).map((w, i) => ({ w, i })).filter((x) => x.w.ad) : [];
  const mode = A?.mode || (ct ? 'home' : 'free');
  const cur = mode === 'work' ? `work:${Number(A.i) || 0}` : mode;
  const opt = (v, l) => `<option value="${h(v)}"${v === cur ? ' selected' : ''}>${l}</option>`;
  return `<label class="rxf-addr">${h(t('rcAddr'))} <select id="rxf-addr">
      ${ct ? opt('home', `🏠 ${h(t('rcAddrHome'))}${home ? `: ${h(home)}` : ` (${h(t('rcAddrNone'))})`}`) : ''}
      ${works.map((x) => opt(`work:${x.i}`, `💼 ${h(x.w.t || t('rcAddrWork'))}: ${h(x.w.ad)}`)).join('')}
      ${opt('free', `✏️ ${h(t('rcAddrFree'))}`)}</select></label>
    ${mode === 'free' ? `<textarea id="rxf-addrtxt" rows="3" dir="ltr" placeholder="${h(t('rcAddrFreePh'))}">${h(A?.text || '')}</textarea>` : ''}
    ${ct && !works.length ? `<span class="muted small">${h(t('rcAddrWorkHint'))}</span>` : ''}`;
}
function wireAddrPicker(dlg, F, render) {
  $('#rxf-addr', dlg)?.addEventListener('change', (e) => {
    const v = e.target.value;
    F.addr = v === 'home' ? { mode: 'home' } : v.startsWith('work:') ? { mode: 'work', i: Number(v.slice(5)) } : { mode: 'free', text: F.addr?.text || '' };
    render();
  });
  $('#rxf-addrtxt', dlg)?.addEventListener('change', (e) => { F.addr = { mode: 'free', text: e.target.value }; render(); });
}
/** וואס מ'שרייבט אריין אין לשונית Receipts */
function issueOf(d) {
  return { kind: d.kind, org: d.org, contact_id: d.contact_id, donor_name: d.donor_name, ids: d.ids, amount: d.amount, period: d.period, note: d.note || '', meta: d.meta || defaultMeta(d) };
}
function defaultMeta(d) {
  const a = lastAddr(d.contact_id);
  return { type: d.list?.[0]?.kind === 'sale' ? 'sale' : 'donation', sig: { mode: 'org' }, ...(a ? { addr: a } : {}) };
}

// ---------- "קבלה בודדת": ערשט די פרטים → א נדבה (באצאלט) → דער טופס פון דער קבלה ----------
export function openQuickReceipt(org0 = '', done = null, opts = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet rq-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const methods = state.lists.payment_method || [];
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>🧾 ${h(t('rqTitle'))}</h2>
    <p class="muted small">${h(t('rqHint'))}</p>
    <form class="rq-form" autocomplete="off">
      <div class="seg">${[['', 'donKindDonation'], ['sale', 'donKindSale']].map(([k, l], i) => `<button type="button" data-qk="${k}" class="${(opts.sale ? i : !i) ? 'on' : ''}">${h(t(l))}</button>`).join('')}</div>
      <label class="wide">${h(t('donor'))} *<input name="who" list="dl-rq" placeholder="${h(t('rqWhoPh'))}" required>
        <datalist id="dl-rq">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist></label>
      <div class="rq-addrbox" hidden></div>
      <div class="rq-books"${opts.sale ? '' : ' hidden'}>${bookPickerHtml()}</div>
      <div class="grid">
        <label>${h(t('amount'))} *<input name="amount" type="number" min="0.01" step="0.01" dir="ltr" required></label>
        <label>${h(t('dateLegend'))}<input name="date" type="date" value="${today}"></label>
        <label>${h(t('paymentMethod'))}<select name="method"><option value=""></option>${methods.map((m) => `<option>${h(m)}</option>`).join('')}</select></label>
        <label class="rq-check" hidden>${h(t('checkNumber'))}<input name="check" dir="ltr"></label>
        <label class="rq-card" hidden>${h(t('cardLast4'))}<input name="card" dir="ltr" maxlength="4"></label>
      </div>
      <label class="wide">${h(t('campaignOptional'))}<select name="campaign">${campaignOptions('')}</select></label>
      <label class="wide">${h(t('forOrg'))} *${orgSelect('org', org0)}</label>
      <label class="wide"><span class="rq-for-don">${h(t('rqFor'))}</span><span class="rq-for-sale" hidden>${h(t('saleWhat'))}</span><input name="for" dir="auto"></label>
      <div class="grid rq-goods">
        <label class="wide">${h(t('goodsDesc'))}<input name="gdesc" dir="auto" placeholder="${h(t('goodsDescPh'))}"></label>
        <label>${h(t('goodsValue'))}<input name="gval" type="number" min="0" step="0.01" dir="ltr" placeholder="$"></label>
      </div>
      <div class="actions"><span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('rqNext'))} →</button></div>
    </form>`;
  const form = $('form', dlg);
  const el = (n) => form.elements[n];
  let kind = opts.sale ? 'sale' : '';
  $$('[data-x]', dlg).forEach((b) => { b.onclick = () => dlg.close(); });
  // מכירה פון ספרים (מכון משנה הלכות): דער סכום און "וואס" ווערן אויסגעפילט פון די ספרים
  let bookLines = [];
  wireBookPicker(dlg, (lines, total, desc) => {
    bookLines = lines;
    if (!lines.length) return;
    el('amount').value = total || '';
    el('for').value = desc;
    if ([...el('org').options].some((o) => o.value === BOOKS_ORG)) el('org').value = BOOKS_ORG;
  });
  $$('[data-qk]', dlg).forEach((b) => {
    b.onclick = () => {
      kind = b.dataset.qk;
      $$('[data-qk]', dlg).forEach((x) => x.classList.toggle('on', x === b));
      $('.rq-goods', dlg).hidden = kind === 'sale';
      $('.rq-books', dlg).hidden = kind !== 'sale';
      $('.rq-for-don', dlg).hidden = kind === 'sale';
      $('.rq-for-sale', dlg).hidden = kind !== 'sale';
    };
  });
  if (opts.sale) $('[data-qk="sale"]', dlg).click();
  // דער אדרעס: פון כרטיס (✓) אדער אן אנדערער (טעקסט); א מענטש וואס איז נישט אין דער ליסטע — נאר טעקסט
  let addrSel = 'home';
  let addrText = '';
  const whoCt = () => { const m = el('who').value.match(/\(#(\d+)\)/); return m ? ui.contactById(m[1]) : null; };
  const renderAddr = () => {
    const box = $('.rq-addrbox', dlg);
    const ct = whoCt();
    const name = el('who').value.trim();
    box.hidden = !name;
    if (!name) return;
    const homeTxt = ct ? [ct.address, [ct.city, ct.state].filter(Boolean).join(', '), ct.zip].filter(Boolean).join(' ') : '';
    const works = ct ? workOf(ct).map((w, i) => ({ w, i })).filter((x) => x.w.ad) : [];
    if (!ct) addrSel = 'free';
    else if (addrSel === 'home' && !homeTxt) addrSel = 'free';
    const chk = (v, label) => `<label class="check rq-opt"><input type="checkbox" data-as="${h(v)}"${addrSel === v ? ' checked' : ''}> ${label}</label>`;
    box.innerHTML = `<b class="rq-addrh">${h(t('rcAddr'))}</b>
      ${ct && homeTxt ? chk('home', `🏠 <span dir="ltr">${h(homeTxt)}</span>`) : ''}
      ${works.map((x) => chk(`work:${x.i}`, `💼 ${h(x.w.t || '')}: <span dir="ltr">${h(x.w.ad)}</span>`)).join('')}
      ${ct ? chk('free', `✏️ ${h(t('rcAddrOther'))}`) : ''}
      <textarea name="addr" rows="3" dir="ltr" placeholder="${h(t('rcAddrFreePh'))}"${addrSel === 'free' ? '' : ' hidden'}>${h(addrText)}</textarea>`;
    $$('[data-as]', box).forEach((cb) => {
      cb.onchange = () => {
        addrSel = cb.checked ? cb.dataset.as : (homeTxt ? 'home' : 'free');
        addrText = el('addr')?.value || addrText;
        renderAddr();
        if (addrSel === 'free') el('addr')?.focus();
      };
    });
    el('addr')?.addEventListener('input', () => { addrText = el('addr').value; });
  };
  // נאר ווען דער מענטש האט זיך געטוישט — אנדערש מעקט דער "change" (ביים פארלאזן דאס פעלד) דעם קליק אויף א ✓
  let whoKey = null;
  const onWho = () => {
    const ct = whoCt();
    const k = ct ? `#${ct.contact_id}` : (el('who').value.trim() ? 'free' : '');
    if (k === whoKey) return;
    if (ct && whoKey !== null) addrSel = 'home';
    whoKey = k; renderAddr();
  };
  el('who').addEventListener('input', onWho);
  el('who').addEventListener('change', onWho);
  el('method').onchange = () => {
    $('.rq-check', dlg).hidden = el('method').value !== "צ'ק";
    $('.rq-card', dlg).hidden = el('method').value !== 'כרטיס אשראי';
  };
  el('campaign').onchange = () => {
    const co = campaignOrg(el('campaign').value);
    if (co) el('org').value = co;
    // די "תמורה" פונעם קאמפיין
    const cr = state.campaigns.find((x) => x.campaign === el('campaign').value);
    if (cr?.goods_desc && !el('gdesc').value) { el('gdesc').value = cr.goods_desc; if (cr.goods_value !== '' && cr.goods_value != null) el('gval').value = cr.goods_value; }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const who = el('who').value.trim();
    const m = who.match(/\(#(\d+)\)/);
    const ct = m ? ui.contactById(m[1]) : null;
    const amount = Number(el('amount').value);
    const org = campaignOrg(el('campaign').value) || el('org').value;
    if (!who) { el('who').focus(); return; }
    if (!(amount > 0)) { el('amount').focus(); return; }
    if (!org) { ui.toast(t('orgRequired'), 'error'); el('org').focus(); return; }
    const date = el('date').value || today;
    const method = el('method').value;
    const sale = kind === 'sale';
    const d = {
      contact_id: ct ? Number(ct.contact_id) : '', donor_name: ct ? '' : who,
      date, hebrew_date: isoToHebrewText(date) || '', event_tags: '', event_year: '', event_note: sale ? '' : el('for').value.trim(),
      campaign: el('campaign').value, org, amount_usd: amount, is_paid: true, paid_date: date, paid_note: '',
      payment_method: method, check_number: method === "צ'ק" ? el('check').value.trim() : '', card_last4: method === 'כרטיס אשראי' ? el('card').value.trim() : '',
      payment_note: '', dedication_type: '', dedication_text: '',
      kind, goods_desc: sale ? el('for').value.trim() : el('gdesc').value.trim(), goods_value: sale || el('gval').value === '' ? '' : Number(el('gval').value),
      books: sale && bookLines.length ? JSON.stringify(bookLines) : '',
    };
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const id = await saveDonation(d);
      await loadAll();
      const dd = state.donations.find((x) => String(x.donation_id) === String(id)) || { ...d, donation_id: id };
      dlg.close();
      const det = orgDetailsOf(effectiveOrg(dd));
      if (!det || !det.legal_name) { ui.toast(t('rcMissingDetails', { org: effectiveOrg(dd) }), 'error'); openOrgDetails(effectiveOrg(dd)); return; }
      if (done) done();
      const txt = String(addrText || '').trim();
      const chosen = addrSel === 'free' ? (txt ? { mode: 'free', text: txt } : null) : addrSel.startsWith('work:') ? { mode: 'work', i: Number(addrSel.slice(5)) } : (ct ? { mode: 'home' } : null);
      openReceiptForm({ kind: 'receipt', org: effectiveOrg(dd), contact_id: dd.contact_id || '', donor_name: dd.contact_id ? '' : dd.donor_name, ids: [String(id)], amount, period: '', list: [dd],
        ...(chosen ? { meta: { type: sale ? 'sale' : 'donation', sig: { mode: 'org' }, addr: chosen } } : {}) },
        { forText: sale ? '' : el('for').value.trim(), done });
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; }
  };
  dlg.showModal();
  el('who').focus();
}

// ---------- דער טופס פון א קבלה: סארט, שורות, תמורה, חתימה ----------
export function openReceiptForm(c0, { letter = '', forText = '', done = null } = {}) {
  const det = orgDetailsOf(c0.org) || {};
  const um = orgDetailsOf(umbrellaName()) || {};
  const rateOf = (o) => (o.sales_tax_rate !== '' && o.sales_tax_rate != null && !Number.isNaN(Number(o.sales_tax_rate)) ? Number(o.sales_tax_rate) : null);
  const rate0 = rateOf(det) ?? rateOf(um) ?? 8.875;
  // א קבלה וואס איז שוין ארויס: נאר נאכאמאל דרוקן/שיקן (א קאפיע), ווי זי איז אפגעהיט
  const prior = c0.issued ? fromLog(c0.issued.receipt_no) : null;
  if (c0.issued && !prior) return;
  if (prior) c0 = prior;
  const locked = Boolean(prior);
  const st0 = c0.meta && Object.keys(c0.meta).length ? c0.meta : defaultMeta(c0);
  const F = {
    type: st0.type || 'donation', tax: Boolean(st0.tax), taxRate: Number(st0.taxRate) || rate0, sig: st0.sig || { mode: 'org' },
    list: [...c0.list], lines: { ...(st0.lines || {}) }, letter, addr: st0.addr || lastAddr(c0.contact_id),
  };
  const mine = mySigObj();
  const sameWho = (d) => (c0.contact_id ? String(d.contact_id) === String(c0.contact_id) : !d.contact_id && String(d.donor_name || '').trim() === String(c0.donor_name || '').trim());
  // נדבות פון דעם זעלבן מענטש (זעלבער ארגון) וואס האבן נאך נישט קיין קבלה
  const inReceipt = new Set(state.receipts.filter((r) => !isTrue(r.void) && r.kind !== 'invoice').flatMap((r) => String(r.donation_ids || '').split(',')));
  const others = () => state.donations.filter((d) => sameWho(d) && effectiveOrg(d) === c0.org && isTrue(d.is_paid) && ((d.kind === 'sale') === (F.type === 'sale'))
    && !F.list.some((x) => String(x.donation_id) === String(d.donation_id)) && !inReceipt.has(String(d.donation_id)))
    .sort((a, b) => paidDate(b).localeCompare(paidDate(a)));
  const docOf = () => {
    const base = F.list.reduce((s, d) => s + (Number(d.amount_usd) || 0), 0);
    // מיט Sales Tax: דער סכום פון דער קבלה איז מיט דעם טעקס
    const amount = F.type === 'sale' && F.tax ? base + Math.round(base * F.taxRate) / 100 : base;
    return {
      ...c0, list: F.list, ids: F.list.map((d) => String(d.donation_id)), amount, forText: F.list.length === 1 ? forText : '',
      meta: { type: F.type, tax: F.type === 'sale' && F.tax, taxRate: F.taxRate, sig: F.sig, lines: F.lines, ...(F.addr ? { addr: F.addr } : {}) },
    };
  };
  const sigSel = (m) => (F.sig.mode === m ? ' selected' : '');
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet wide rx-form-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const render = () => {
    const sale = F.type === 'sale';
    const c = locked ? c0 : docOf();
    const tot = c.amount;
    dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
      <h2>🧾 ${h(t('rcFormTitle'))} — ${h(donorLabel(c0))}</h2>
      ${locked ? `<p class="mx-pending">🔒 ${h(t('rcLockedNote', { no: c0.receipt_no }))}</p>` : ''}
      <div class="rx-form${locked ? ' rx-locked' : ''}">
        <div class="rx-form-prev"><div class="rx-prev-scale">${receiptHtml(locked ? c : { ...c, receipt_no: '—', issued_at: new Date().toISOString().slice(0, 10) })}</div></div>
        <div class="rx-form-side"${locked ? ' inert' : ''}>
          <div class="seg">${[['donation', 'donKindDonation'], ['sale', 'donKindSale']].map(([k, l]) => `<button type="button" data-ft="${k}" class="${F.type === k ? 'on' : ''}">${h(t(l))}</button>`).join('')}</div>
          ${sale ? `<label class="check"><input type="checkbox" id="rxf-tax"${F.tax ? ' checked' : ''}> Sales Tax</label>
            <label class="rxf-rate"${F.tax ? '' : ' hidden'}>% <input type="number" id="rxf-rate" step="0.001" min="0" max="30" value="${F.taxRate}" dir="ltr"></label>` : ''}
          <table class="rxf-lines no-sort"><thead><tr><th>${h(t('dateLegend'))}</th><th>${h(t(sale ? 'saleWhat' : 'rcWhat'))}</th><th>${h(t('amount'))}</th>${sale ? '' : `<th>${h(t('goodsDesc'))}</th><th>${h(t('goodsValue'))}</th>`}<th></th></tr></thead>
          <tbody>${F.list.map((d, i) => {
            const o = F.lines[String(d.donation_id)] || {};
            return `<tr><td dir="ltr">${h(paidDate(d))}</td><td>${h(sale ? (o.goods_desc ?? d.goods_desc ?? '') || descText(d) : descText(d))}</td><td dir="ltr">${money(d.amount_usd)}</td>
              ${sale ? '' : `<td><input data-gd="${i}" value="${h(o.goods_desc ?? d.goods_desc ?? '')}" placeholder="${h(t('goodsDescPh'))}"></td>
                <td><input data-gv="${i}" type="number" min="0" step="0.01" dir="ltr" value="${h(o.goods_value ?? d.goods_value ?? '')}" placeholder="$"></td>`}
              <td>${F.list.length > 1 ? `<button type="button" class="linkish" data-rm="${i}" title="${h(t('deleteBtn'))}">✕</button>` : ''}</td></tr>`;
          }).join('')}</tbody></table>
          ${others().length ? `<label class="rxf-add">+ ${h(t('rcAddDonation'))} <select id="rxf-add"><option value=""></option>${others().map((d) => `<option value="${h(d.donation_id)}">${h(paidDate(d))} · ${money(d.amount_usd)} · ${h(descText(d))}</option>`).join('')}</select></label>`
            : `<p class="muted small">${h(t('rcNoMore'))}</p>`}
          <p class="rxf-total"><b>${h(t('rcTotal'))}: ${money(tot)}</b> <span class="muted small" dir="ltr">${h(amountWords(tot))}</span></p>
          ${addrPickerHtml(c0.contact_id, F.addr)}
          <label>${h(t('wrSignature'))} <select id="rxf-sig">
            <option value="org"${sigSel('org')}>${h(t('rcSigOrg'))}</option>
            <option value="mine"${sigSel('mine')}${mine ? '' : ' disabled'}>${h(t('wrMySig'))}${mine ? '' : ` (${h(t('wrSigNone'))})`}</option>
            <option value="temp"${sigSel('temp')}>${h(t('wrSigTemp'))}</option>
            <option value="none"${sigSel('none')}>${h(t('rcSigNone'))}</option></select></label>
          ${F.sig.mode === 'temp' ? `<div class="rxf-temp"><input id="rxf-tt" dir="auto" placeholder="${h(t('wrSigText'))}" value="${h(F.sig.sig?.text || '')}">
            <select id="rxf-tf">${['Playpen Sans Hebrew', 'Amatic SC', 'Noto Rashi Hebrew', 'Frank Ruhl Libre', ...customFontNames()].map((x) => `<option${x === F.sig.sig?.font ? ' selected' : ''}>${h(x)}</option>`).join('')}</select></div>` : ''}
          ${locked ? '</div><div class="rx-form-side">' : ''}
          <label>📄 ${h(t('rcWithLetterTip'))} <select id="rxf-letter"><option value="">${h(t('rcNoLetter'))}</option>${letterTemplates().map((x) => `<option value="${h(x.id)}"${String(x.id) === String(F.letter || '') ? ' selected' : ''}>${h(x.name)}${letterHasReceipt(x.id) ? ' 🧾' : ''}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="actions"><button type="button" class="btn danger" id="rxf-cancel-sale">🗑 ${h(t(sale ? 'bkCancelSale' : (locked ? 'rcCancelT' : 'rcCancelDon')))}</button><span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="button" class="btn" id="rxf-mail">✉ ${h(t('rcMailBtn'))}</button>
        <button type="button" class="btn" id="rxf-pdf">⬇ PDF</button>
        <button type="button" class="btn primary" id="rxf-print">🖨 ${h(t('rcPrint'))}</button></div>`;
    wire();
    // די קבלה — אזוי ברייט ווי דער פלאץ
    requestAnimationFrame(() => { const box = $('.rx-form-prev', dlg); const sc = $('.rx-prev-scale', dlg); if (box && sc) sc.style.zoom = String(Math.min(1, (box.clientWidth - 24) / 816)); });
  };
  const keepLine = (i, k, v) => { const id = String(F.list[i].donation_id); F.lines[id] = { ...(F.lines[id] || {}), [k]: v }; };
  const wire = () => {
    $$('[data-x]', dlg).forEach((b) => { b.onclick = () => dlg.close(); });
    $$('[data-ft]', dlg).forEach((b) => { b.onclick = () => { F.type = b.dataset.ft; render(); }; });
    $('#rxf-tax', dlg)?.addEventListener('change', (e) => { F.tax = e.target.checked; render(); });
    $('#rxf-rate', dlg)?.addEventListener('change', (e) => { F.taxRate = Number(e.target.value) || 0; render(); });
    $$('[data-gd]', dlg).forEach((el) => { el.onchange = () => { keepLine(Number(el.dataset.gd), 'goods_desc', el.value.trim()); render(); }; });
    $$('[data-gv]', dlg).forEach((el) => { el.onchange = () => { keepLine(Number(el.dataset.gv), 'goods_value', el.value === '' ? '' : Number(el.value)); render(); }; });
    $$('[data-rm]', dlg).forEach((b) => { b.onclick = () => { F.list.splice(Number(b.dataset.rm), 1); render(); }; });
    $('#rxf-add', dlg)?.addEventListener('change', (e) => { const d = state.donations.find((x) => String(x.donation_id) === e.target.value); if (d) { F.list.push(d); F.list.sort((a, b) => paidDate(a).localeCompare(paidDate(b))); } render(); });
    wireAddrPicker(dlg, F, render);
    $('#rxf-sig', dlg).onchange = (e) => {
      const m = e.target.value;
      F.sig = m === 'mine' ? { mode: 'mine', sig: mine } : m === 'temp' ? { mode: 'temp', sig: { type: 'text', text: '', font: 'Playpen Sans Hebrew' } } : { mode: m };
      render();
    };
    const tt = () => { F.sig = { mode: 'temp', sig: { type: 'text', text: $('#rxf-tt', dlg).value.trim(), font: $('#rxf-tf', dlg).value } }; };
    $('#rxf-tt', dlg)?.addEventListener('change', () => { tt(); render(); });
    $('#rxf-tf', dlg)?.addEventListener('change', () => { tt(); render(); });
    $('#rxf-letter', dlg).onchange = (e) => { F.letter = e.target.value; };
    const go = async (mode) => {
      const c = locked ? c0 : docOf();
      if (!c.list.length) return;
      let to = '';
      if (mode === 'mail') { to = askAddress(c.contact_id); if (!to) return; }
      const run = async () => {
        try {
          const [x] = locked ? [{ receipt_no: c0.receipt_no, issued_at: c0.issued_at, reprint: true }] : await issueDocs([issueOf(c)]);
          const full = { ...c, receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint, meta: c.meta };
          dlg.close();
          if (mode === 'print') printDocs([full], { letter: F.letter });
          else if (mode === 'pdf') {
            const b64 = await receiptPdf(full, F.letter);
            const a = document.createElement('a');
            a.href = `data:application/pdf;base64,${b64}`;
            a.download = `${x.receipt_no}.pdf`;
            document.body.append(a); a.click(); a.remove();
          } else {
            const r = await mailDocs([{ c: { ...full, reprint: false }, to }], () => {}, F.letter);
            ui.toast(r.errors ? t('mailFailed') : t('rcMailSent', { to }), r.errors ? 'error' : '');
          }
          await loadAll();
          if (done) done();
        } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
      };
      if (mode === 'mail') withGmail(run); else run();
    };
    // ביטול: די נדבה/מכירה און די קבלה (מיט אישור; א גבאי → צום מנהל)
    $('#rxf-cancel-sale', dlg)?.addEventListener('click', async () => {
      const c = locked ? c0 : { ...docOf(), receipt_no: '' };
      if (await cancelDoc(c)) { dlg.close(); if (done) done(); }
    });
    $('#rxf-print', dlg).onclick = () => go('print');
    $('#rxf-pdf', dlg).onclick = () => go('pdf');
    $('#rxf-mail', dlg).onclick = () => go('mail');
  };
  render();
  dlg.showModal();
}

export async function printForDonation(d) {
  const org = effectiveOrg(d);
  if (!org) { ui.toast(t('rcNoOrg'), 'error'); return; }
  const det = orgDetailsOf(org);
  if (!det || !det.legal_name) { ui.toast(t('rcMissingDetails', { org }), 'error'); openOrgDetails(org); return; }
  const kind = isTrue(d.is_paid) ? 'receipt' : 'invoice';
  const base = { kind, org, contact_id: d.contact_id || '', donor_name: d.contact_id ? '' : String(d.donor_name || ''), ids: [String(d.donation_id)], amount: Number(d.amount_usd || 0), period: '', list: [d] };
  if (kind === 'invoice') { openInvoiceForm({ ...base, issued: findIssued('invoice', org, base.ids, '', base.contact_id || base.donor_name) }); return; }
  openReceiptForm({ ...base, issued: findIssued('receipt', org, base.ids, '', base.contact_id || base.donor_name) });
}

/** א תשלום פון שכר לימוד → א דאקומענט (קבלה) */
function tuitionDoc(p) {
  const forText = p.for_text || 'עבור שכר לימוד';
  return {
    kind: 'tuition', org: p.org, contact_id: p.payer_id || p.contact_id, donor_name: '', ids: [`T${p.payment_id}`], amount: Number(p.amount || 0), period: '', note: forText, forText,
    list: [{ donation_id: `T${p.payment_id}`, paid_date: p.date, date: p.date, payment_method: p.method, check_number: p.check_number, card_last4: p.card_last4, amount_usd: p.amount }],
  };
}

/** קבלה אויף שכר לימוד: דרוקן אדער שיקן. גיט צוריק דעם נומער. */
export async function tuitionReceipt(p, mode = 'print') {
  const det = orgDetailsOf(p.org);
  if (!det || !det.legal_name) { ui.toast(t('rcMissingDetails', { org: p.org }), 'error'); openOrgDetails(p.org); return ''; }
  const base = tuitionDoc(p);
  const issue = { kind: base.kind, org: base.org, contact_id: base.contact_id, donor_name: '', ids: base.ids, amount: base.amount, period: '', note: base.note };
  if (mode === 'mail') {
    const to = askAddress(base.contact_id);
    if (!to) return '';
    return new Promise((resolve) => {
      withGmail(async () => {
        try {
          const [x] = await issueDocs([issue]);
          const r = await mailDocs([{ c: { ...base, receipt_no: x.receipt_no, issued_at: x.issued_at }, to }]);
          ui.toast(r.errors ? t('mailFailed') : t('rcMailSent', { to }), r.errors ? 'error' : '');
          resolve(x.receipt_no);
        } catch (err) { ui.toast(ui.friendlyError(err), 'error'); resolve(''); }
      });
    });
  }
  try {
    const [x] = await issueDocs([issue]);
    printDocs([{ ...base, receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint }]);
    return x.receipt_no;
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); return ''; }
}

// ================= די נייע קבלה: א דריטל בלאט (ווי א טשעק), אדער א גאנצער בלאט ווען ס'זענען מער ווי 5 שורות =================
export const RX_H = 3.667;
/** $1,234.50 — אויף א קבלה אלעמאל מיט סענט */
const usd = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;   // א דריטל פון 11 אינטש
const RX_MAX_LINES = 5;
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function words999(n) {
  const hnd = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ''}`;
  return [hnd ? `${ONES[hnd]} Hundred` : '', rest].filter(Boolean).join(' ');
}
/** 1234.5 → "One Thousand Two Hundred Thirty-Four Dollars and 50/100" (ווי אויף א טשעק) */
export function amountWords(v) {
  const x = Math.round((Number(v) || 0) * 100);
  const dollars = Math.floor(x / 100);
  const cents = String(x % 100).padStart(2, '0');
  if (!dollars) return `Zero Dollars and ${cents}/100`;
  const parts = [];
  [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand'], [1, '']].reduce((left, [unit, name]) => {
    const q = Math.floor(left / unit);
    if (q) parts.push(`${words999(q)}${name ? ` ${name}` : ''}`);
    return left % unit;
  }, dollars);
  return `${parts.join(' ')} Dollar${dollars === 1 ? '' : 's'} and ${cents}/100`;
}
const rxMeta = (c) => c.meta || {};
/** די שורות פון דער קבלה — מיט דער "תמורה" פון יעדער נדבה (אדער ווי מ'האט עס געטוישט אין טופס) */
/** די שורות וואס מ'ווייזט אויף דער קבלה: א מכירה פון ספרים — א שורה פאר יעדן ספר (וויפל × פרייז) */
function rxDisp(lines) {
  const out = [];
  lines.forEach((l) => {
    const bl = l.d.kind === 'sale' ? booksOf(l.d) : [];
    if (!bl.length) { out.push({ l, first: true }); return; }
    bl.forEach((x, i) => {
      const b = bookById(x.id);
      const name = `${b ? b.name : x.n || `#${x.id}`}${x.v === 'vol' ? ' (כרך בודד)' : x.v === 'old' ? ' (מהדורה קודמת)' : ''}`;
      out.push({ l, first: !i, item: name, qty: Number(x.q) || 1, price: Number(x.p) || 0 });
    });
    // א סכום וואס איז אנדערש ווי די ספרים (מ'האט עס געטוישט) — א שורה פאר דעם חילוק
    const diff = Math.round(((Number(l.d.amount_usd) || 0) - bl.reduce((s2, x) => s2 + (Number(x.q) || 1) * (Number(x.p) || 0), 0)) * 100) / 100;
    if (diff) out.push({ l, first: false, item: diff < 0 ? 'Discount' : 'Other', qty: '', price: diff, amt: diff });
  });
  return out;
}
const rxCount = (c) => rxDisp(rxLines(c)).length;
function rxLines(c) {
  const ov = rxMeta(c).lines || {};
  return c.list.map((d) => {
    const o = ov[String(d.donation_id)] || {};
    const gv = o.goods_value ?? d.goods_value;
    return { d, goods_desc: String(o.goods_desc ?? d.goods_desc ?? '').trim(), goods_value: gv === '' || gv == null ? 0 : Number(gv) || 0 };
  });
}
export const isSaleDoc = (c) => c.kind === 'receipt' && (rxMeta(c).type || (c.list?.[0]?.kind === 'sale' ? 'sale' : '')) === 'sale';
/** די חתימה אויף דער קבלה: org / mine / temp / none */
function rxSig(c, det) {
  const s = rxMeta(c).sig || { mode: 'org' };
  if (s.mode === 'none') return '';
  if ((s.mode === 'mine' || s.mode === 'temp') && s.sig) {
    const g = s.sig;
    if (g.type === 'img') { const src = imageOf(g.img); return src ? `<img src="${h(src)}" alt="">` : ''; }
    return `<div class="rx-sigtext" style="font-family:'${h(String(g.font || 'Playpen Sans Hebrew').replace(/['"<>;]/g, ''))}'">${h(g.text || '')}</div>`;
  }
  if (det.signature_text) return `<div class="rx-sigtext" style="font-family:${sigFont(det.signature_font)}">${h(det.signature_text)}</div>`;
  return det.signature_img ? `<img src="${h(imageOf(det.signature_img) || det.signature_img)}" alt="">` : '';
}
const shortDateEn = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : String(iso || ''); };
/** די קבלה אליין (HTML). opts.full = גאנצער בלאט; opts.window = מיט'ן אדרעס אויפן פלאץ פונעם פענצטער (נאר אויפן גאנצן בלאט) */
export function receiptHtml(c, opts = {}) {
  const P = letterParts(c);
  const { det, ein, taxEntity, name, logo, legal, he } = P;
  const lines = rxLines(c);
  const sale = isSaleDoc(c);
  const isInv = c.kind === 'invoice';
  const isTu = c.kind === 'tuition';
  const allDisp = rxDisp(lines);
  const hasQty = allDisp.some((r) => r.item != null);
  const full = opts.full ?? allDisp.length > RX_MAX_LINES;
  const issued = String(c.issued_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const total = lines.reduce((s, l) => s + (Number(l.d.amount_usd) || 0), 0) || Number(c.amount) || 0;
  const M = rxMeta(c);
  const taxRate = sale && M.tax ? Number(M.taxRate) || 0 : 0;
  const taxAmt = Math.round(total * taxRate) / 100;
  const grand = total + taxAmt;
  const goods = sale ? [] : lines.filter((l) => l.goods_desc || l.goods_value);
  const gVal = goods.reduce((s, l) => s + l.goods_value, 0);
  const title = isInv ? 'INVOICE' : isTu ? 'TUITION RECEIPT' : sale ? 'SALES RECEIPT'
    : c.kind === 'year' ? `YEAR-END STATEMENT ${c.period}` : (det.coupon_title || 'DONATION RECEIPT');
  const forOf = (l) => (sale ? (l.goods_desc || descText(l.d)) : lines.length === 1 && c.forText ? c.forText : descText(l.d));
  const exempt = `${taxEntity} is a 501(c)(3) tax-exempt organization${ein ? ` (EIN ${ein})` : ''}.`;
  let stmt;
  if (isInv) stmt = `Please make checks payable to ${legal}.`;
  else if (isTu) stmt = 'Tuition payment. This is not a tax-deductible charitable contribution.';
  else if (sale) stmt = 'Sale of goods — this payment is not a tax-deductible charitable contribution.';
  else if (goods.length) {
    stmt = `${exempt} In exchange for ${lines.length > 1 ? 'these contributions' : 'this contribution'} the donor received: ${goods.map((l) => l.goods_desc || 'goods/services').join(', ')}, with an estimated fair market value of ${usd(gVal)}. The tax-deductible amount is ${usd(Math.max(0, total - gVal))}.`;
  } else {
    stmt = String(det.tax_text || TAX_DEFAULT).replace(/\s*\((EIN )?\{EIN\}\)/g, ein ? ' (EIN {EIN})' : '').replace(/\{NAME\}/g, taxEntity).replace(/\{EIN\}/g, ein || '')
      .replace('this contribution', lines.length > 1 ? 'these contributions' : 'this contribution');
  }
  const addr = P.addr;
  const side = `<div class="rx-side">
      ${logo ? `<div class="rx-logo"><img src="${h(logo)}" alt=""></div>` : ''}
      ${he ? `<div class="rx-he" dir="rtl">${h(he)}</div>` : ''}
      ${[det.sub_line, det.thanks_yi].filter((x) => String(x || '').trim()).map((x) => `<div class="rx-heline" dir="rtl">${h(x)}</div>`).join('')}
      <div class="rx-en">${h(legal)}</div>
      <div class="rx-det">${[det.address, det.city_state_zip, det.phone ? `Tel ${det.phone}` : '', det.email, det.website, ein ? `EIN ${ein}` : ''].filter(Boolean).map(h).join('<br>')}</div>
    </div>`;
  // א לאנגע קבלה אויף עטליכע בלעטער: opts.rows = די שורות פון דעם בלאט, opts.pg = {i, n}, opts.last = מיט'ן סך הכל
  const pg = opts.pg || { i: 0, n: 1 };
  const last = opts.last ?? true;
  const rows = (opts.rows || allDisp).map((r) => {
    const { l } = r;
    const date = r.first ? h(shortDateEn(isInv ? l.d.date : paidDate(l.d))) : '';
    const pay = r.first && !isInv ? h(payText(l.d)) : '';
    if (r.item == null) {
      return `<tr><td>${date}</td><td><bdi dir="auto">${h(forOf(l))}</bdi></td>${hasQty ? '<td></td><td></td>' : ''}
      <td>${pay}</td><td class="amt">${usd(l.d.amount_usd)}</td></tr>`;
    }
    return `<tr><td>${date}</td><td><bdi dir="auto">${h(r.item)}</bdi></td><td class="qty">${h(r.qty)}</td><td class="amt">${r.qty === '' ? '' : usd(r.price)}</td>
      <td>${pay}</td><td class="amt">${usd(r.amt ?? r.qty * r.price)}</td></tr>`;
  }).join('');
  return `<div class="rx${full ? ' rx-full' : ''}${pg.i ? ' rx-cont' : ''}" dir="ltr" style="width:8.5in;height:${full ? 11 : RX_H}in">
    <div class="rx-main">
      <div class="rx-head"><div class="rx-title">${h(title)}</div>
        <div class="rx-no">${isInv ? 'Invoice' : 'Receipt'} No. <b>${h(c.receipt_no || '—')}</b>${c.reprint ? ' <span class="rx-copy">(copy)</span>' : ''}${pg.n > 1 ? ` <span class="rx-pg">· Page ${pg.i + 1} of ${pg.n}</span>` : ''}</div></div>
      ${full && opts.window && !pg.i ? `<div class="rx-winaddr" style="left:${0.875 + (Number(det.addr_dx) || 0)}in;top:${2.1 + (Number(det.addr_dy) || 0)}in"><b>${h(name)}</b>${addr.map((x) => `<br>${h(x)}`).join('')}</div>` : ''}
      <div class="rx-body">
        <div class="rx-info"><span><span class="rx-l">Date</span> ${h(longDate(issued))} <span class="rx-hed" dir="rtl">${h(P.heDate)}</span></span>
          <span><span class="rx-l">${isInv ? 'Bill to' : h(det.received_label || 'Received from')}</span> <b><bdi dir="auto">${h(name)}</bdi></b></span></div>
        <table class="rx-lines no-sort"><thead><tr><th>Date</th><th>${sale ? 'Item' : 'For'}</th>${hasQty ? '<th class="qty">Qty</th><th class="amt">Price</th>' : ''}<th>${isInv ? '' : 'Payment'}</th><th class="amt">Amount</th></tr></thead><tbody>${rows}</tbody></table>
        ${last ? `${taxRate ? `<div class="rx-sub"><span>Subtotal ${usd(total)}</span><span>Sales tax ${taxRate}% ${usd(taxAmt)}</span></div>` : ''}
        <div class="rx-total"><span class="rx-l">${isInv ? 'Amount due' : 'Total'}</span><b>${usd(grand)}</b><span class="rx-words">${h(amountWords(grand))}</span></div>
        <div class="rx-foot"><div class="rx-tax">${h(stmt)}${det.receipt_note ? ` ${h(det.receipt_note)}` : ''}</div>
          <div class="rx-sig">${rxSig(c, det)}<div class="rx-sigline">Authorized signature</div></div></div>` : '<div class="rx-more">Continued on next page →</div>'}
      </div>
    </div>
    ${side}
  </div>`;
}
/** צי די קבלה פאסט אריין אין איר בלאט (געמאסטן אין א באהאלטענעם קאסטן) */
function rxFits(html) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-30000px;top:0;visibility:hidden;pointer-events:none';
  box.innerHTML = html;
  document.body.appendChild(box);
  try {
    const main = box.querySelector('.rx-main');
    const bottom = main.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(main).paddingBottom) || 0) + 1;
    return [...main.querySelectorAll('.rx-lines tbody tr:last-child, .rx-total, .rx-foot, .rx-more')].every((e) => e.getBoundingClientRect().bottom <= bottom);
  } finally { box.remove(); }
}
/** א גאנצע-בלאט קבלה — ווען זי פאסט נישט אריין אין איין בלאט, גייט זי ווייטער אויף נאך בלעטער (סך הכל נאר אויפן לעצטן) */
export function receiptFullPages(c, opts = {}) {
  const all = rxDisp(rxLines(c));
  const mk = (rows, i, n, last) => receiptHtml(c, { ...opts, full: true, rows, pg: { i, n }, last });
  if (typeof document === 'undefined' || !document.body) return [mk(all, 0, 1, true)];
  const chunks = [];
  let rest = all;
  while (rest.length && chunks.length < 100) {
    const i = chunks.length;
    if (rxFits(mk(rest, i, 9, true))) { chunks.push(rest); break; }
    let lo = 1; let hi = rest.length - 1; // די מערסטע שורות וואס פאסן (לכל הפחות איינע בלייבט פארן לעצטן בלאט)
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (rxFits(mk(rest.slice(0, mid), i, 9, false))) lo = mid; else hi = mid - 1; }
    if (rest.length - lo < 3 && lo > 3) lo = Math.max(3, rest.length - 3); // נישט לאזן איין איינזאמע שורה אויפן לעצטן בלאט
    chunks.push(rest.slice(0, Math.max(1, lo)));
    rest = rest.slice(Math.max(1, lo));
  }
  return chunks.map((rows, i) => mk(rows, i, chunks.length, i === chunks.length - 1));
}
/** א קבלה לבד אויף א בלאט: אויבן די קבלה, אין מיטן ליידיג, אונטן דער אדרעס פאר א #10 קאנווערט מיט א פענצטער */
export function receiptSheetHtml(c) {
  if (c.kind === 'invoice') return `<div class="rx-sheet">${invoiceHtml(c)}</div>`;
  if (rxCount(c) > RX_MAX_LINES) return receiptFullPages(c, { window: true }).map((x) => `<div class="rx-sheet">${x}</div>`).join('');
  const P = letterParts(c);
  const det = P.det;
  return `<div class="rx-sheet">${receiptHtml(c)}
    <div class="rx-cut" style="top:${RX_H}in"><span>✂</span></div>
    <div class="rx-addr" style="left:${0.875 + (Number(det.addr_dx) || 0)}in;top:${2 * RX_H + 1 + (Number(det.addr_dy) || 0)}in"><b>${h(P.name)}</b>${P.addr.map((x) => `<br>${h(x)}`).join('')}</div>
  </div>`;
}
/** פאר א בריוו מיט "ייבוא קבלה": די קבלה אינעם אונטערשטן דריטל (ביז 5 שורות; מער — א סיכום, און דער גאנצער בלאט קומט נאכן בריוו) */
export function receiptSlotHtml(c) {
  if (rxCount(c) <= RX_MAX_LINES) return receiptHtml(c, { full: false });
  const lines = rxLines(c);
  const gd = lines.filter((l) => l.goods_desc || l.goods_value);
  const short = { ...c, meta: { ...rxMeta(c), lines: {} }, list: [{ ...lines[0].d, amount_usd: lines.reduce((s, l) => s + (Number(l.d.amount_usd) || 0), 0), campaign: '', event_tags: '', books: '', dedication_text: `${lines.length} ${isSaleDoc(c) ? 'items' : 'contributions'} — see attached statement`, date: lines[0].d.date, paid_date: paidDate(lines.at(-1).d), payment_method: '', check_number: '', card_last4: '',
    goods_desc: gd.map((l) => l.goods_desc).filter(Boolean).join(', '), goods_value: gd.reduce((s, l) => s + l.goods_value, 0) || '' }] };
  return receiptHtml(short, { full: false });
}
export const needsFullPage = (c) => rxCount(c) > RX_MAX_LINES;
/** א קבלה לדוגמא (פאר די תצוגה מקדימה פון א בריוו) */
export function sampleReceiptHtml(org = '') {
  const o = org || umbrellaName();
  return receiptHtml({
    kind: 'receipt', org: o, contact_id: '', donor_name: 'Sample Donor', amount: 180, receipt_no: '1001', issued_at: new Date().toISOString().slice(0, 10),
    list: [{ donation_id: 'x', paid_date: new Date().toISOString().slice(0, 10), amount_usd: 180, campaign: 'דוגמא', payment_method: "צ'ק", check_number: '123' }],
  });
}

// ================= Invoice: א גאנצער בלאט (לויט דער מוסטער) =================
/** די שורות פון א Invoice: נדבות (נישט באצאלט) + שורות מיט דער האנט (למשל דירה-געלט) */
function invLines(c) {
  const don = (c.list || []).map((d) => ({ desc: descText(d), date: d.date, amount: Number(d.amount_usd) || 0 }));
  const man = (rxMeta(c).manual || []).filter((x) => String(x.desc || '').trim() || Number(x.amount)).map((x) => ({ desc: String(x.desc || ''), amount: Number(x.amount) || 0 }));
  return [...don, ...man];
}
export const invTotal = (c) => invLines(c).reduce((s, l) => s + l.amount, 0);
export function invoiceHtml(c) {
  const P = letterParts(c);
  const { det, ein, name, he, legal, logo } = P;
  const M = rxMeta(c);
  const lines = invLines(c);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const issued = String(c.issued_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const fill = Math.max(0, 3 - lines.length);
  const pay = String(det.pay_text || 'Please make checks payable to {NAME}.').replace(/\{NAME\}/g, legal).replace(/\.\.+/g, '.');
  const addrLine = [det.address, det.city_state_zip].filter(Boolean).join(' • ');
  return `<div class="iv" dir="ltr">
    <div class="iv-bsd" dir="rtl">בס"ד</div>
    <div class="iv-top">
      ${logo ? `<img class="iv-logo" src="${h(logo)}" alt="">` : ''}
      ${he ? `<div class="iv-he" dir="rtl">${h(he)}</div>` : ''}
      ${[det.sub_line, det.thanks_yi].filter((x) => String(x || '').trim()).map((x) => `<div class="iv-heline" dir="rtl">${h(x)}</div>`).join('')}
      <div class="iv-en">${h(legal)}</div>
      ${det.tagline_en ? `<div class="iv-tag">${h(det.tagline_en)}</div>` : ''}
      ${det.established ? `<div class="iv-est">${h(det.established)}</div>` : ''}
    </div>
    <div class="iv-rule"><span>${h(addrLine)}</span></div>
    <div class="iv-sub">${[det.phone ? `Tel ${det.phone}` : '', det.email, det.website, ein ? `EIN ${ein}` : ''].filter(Boolean).map(h).join(' · ')}</div>
    <div class="iv-head">
      <div class="iv-title">INVOICE</div>
      <div class="iv-boxes">
        <div class="iv-box"><div class="iv-lbl">DATE</div><div class="iv-val">${h(shortDateEn(issued))}</div></div>
        <div class="iv-box"><div class="iv-lbl">INVOICE #</div><div class="iv-val">${h(c.receipt_no || '—')}${c.reprint ? ' <small>(copy)</small>' : ''}</div></div>
        ${M.due ? `<div class="iv-box"><div class="iv-lbl">DUE DATE</div><div class="iv-val">${h(shortDateEn(M.due))}</div></div>` : ''}
      </div>
    </div>
    <div class="iv-bill" style="left:${0.875 + (Number(det.addr_dx) || 0)}in;top:${2.75 + (Number(det.addr_dy) || 0)}in">
      <div class="iv-lbl">BILL TO</div>
      <div class="iv-to"><bdi dir="auto">${h(name)}</bdi>${P.addr.map((x) => `<br>${h(x)}`).join('')}</div>
    </div>
    <div class="iv-body">
    <table class="iv-table no-sort"><thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
      <tbody>${lines.map((l) => `<tr><td><bdi dir="auto">${h(l.desc)}</bdi>${l.date ? ` <span class="iv-date">${h(shortDateEn(l.date))}</span>` : ''}</td><td class="amt">${usd(l.amount)}</td></tr>`).join('')}
      ${'<tr><td>&nbsp;</td><td class="amt"></td></tr>'.repeat(fill)}</tbody></table>
    <div class="iv-due"><div class="iv-lbl">AMOUNT DUE</div><div class="iv-dueval"><span>$</span>${(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
    <div class="iv-words">${h(amountWords(total))}</div>
    ${M.note ? `<div class="iv-note"><bdi dir="auto">${h(M.note)}</bdi></div>` : ''}
    </div>
    <div class="iv-pay">${h(pay)}${M.due ? ` Payment is due by ${h(longDate(M.due))}.` : ''} Thank you!</div>
  </div>`;
}

// ---------- דער טופס פון א Invoice ----------
export function openInvoiceForm(c0, { done = null } = {}) {
  const prior = c0.issued ? fromLog(c0.issued.receipt_no) : null;
  if (prior) c0 = prior;
  const locked = Boolean(prior);
  const M0 = c0.meta || {};
  const F = { list: [...(c0.list || [])], manual: [...(M0.manual || [])], due: M0.due || '', note: M0.note || '', who: c0.contact_id || '', addr: M0.addr || lastAddr(c0.contact_id) };
  const sameWho = (d) => (F.who ? String(d.contact_id) === String(F.who) : false);
  const others = () => state.donations.filter((d) => sameWho(d) && effectiveOrg(d) === c0.org && !isTrue(d.is_paid)
    && !F.list.some((x) => String(x.donation_id) === String(d.donation_id)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const docOf = () => {
    const c = {
      ...c0, kind: 'invoice', contact_id: F.who || c0.contact_id || '', list: F.list, ids: F.list.map((d) => String(d.donation_id)),
      meta: { manual: F.manual.filter((x) => String(x.desc || '').trim() || Number(x.amount)), due: F.due, note: F.note, ...(F.addr ? { addr: F.addr } : {}) },
    };
    c.amount = invTotal(c);
    // שורות מיט דער האנט: יעדער Invoice באזונדער (נישט דער זעלבער ווי א פריערדיגער)
    if (c.meta.manual.length && !locked) c.period = c.period || `M${Date.now()}`;
    return c;
  };
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet wide rx-form-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const render = () => {
    const c = locked ? c0 : docOf();
    const ct = c.contact_id ? ui.contactById(c.contact_id) : null;
    dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
      <h2>📄 Invoice${ct ? ` — ${h(ui.fullNameHe(ct))}` : ''}</h2>
      ${locked ? `<p class="mx-pending">🔒 ${h(t('ivLockedNote', { no: c0.receipt_no }))}</p>` : ''}
      <div class="rx-form">
        <div class="rx-form-prev"><div class="rx-prev-scale iv-prev">${invoiceHtml(locked ? c : { ...c, receipt_no: '—', issued_at: new Date().toISOString().slice(0, 10) })}</div></div>
        <div class="rx-form-side"${locked ? ' inert' : ''}>
          ${!c0.contact_id ? `<label class="rxf-who">${h(t('rcWho'))} <input id="ivf-who" list="dl-ivf" autocomplete="off" value="${ct ? h(ui.pickerLabel(ct)) : ''}">
            <datalist id="dl-ivf">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist></label>` : ''}
          <table class="rxf-lines no-sort"><thead><tr><th>${h(t('ivDesc'))}</th><th>${h(t('amount'))}</th><th></th></tr></thead><tbody>
            ${F.list.map((d, i) => `<tr><td>${h(descText(d))} <span class="muted small" dir="ltr">${h(String(d.date || ''))}</span></td><td dir="ltr">${usd(d.amount_usd)}</td><td><button type="button" class="linkish" data-rmd="${i}">✕</button></td></tr>`).join('')}
            ${F.manual.map((x, i) => `<tr><td><input data-md="${i}" dir="auto" value="${h(x.desc || '')}" placeholder="${h(t('ivDescPh'))}"></td><td><input data-ma="${i}" type="number" step="0.01" min="0" dir="ltr" value="${h(x.amount ?? '')}" placeholder="$"></td><td><button type="button" class="linkish" data-rmm="${i}">✕</button></td></tr>`).join('')}
          </tbody></table>
          <div class="rxf-add">
            ${others().length ? `<label>+ ${h(t('ivAddPledge'))} <select id="ivf-add"><option value=""></option>${others().map((d) => `<option value="${h(d.donation_id)}">${h(String(d.date || ''))} · ${usd(d.amount_usd)} · ${h(descText(d))}</option>`).join('')}</select></label>` : ''}
            <button type="button" class="btn small-btn" id="ivf-line">+ ${h(t('ivAddLine'))}</button>
          </div>
          <p class="rxf-total"><b>${h(t('rcTotal'))}: ${usd(c.amount)}</b></p>
          ${addrPickerHtml(F.who || c0.contact_id, F.addr)}
          <label>${h(t('ivDue'))} <input type="date" id="ivf-due" value="${h(F.due)}"></label>
          <label>${h(t('ivNote'))} <input id="ivf-note" dir="auto" value="${h(F.note)}"></label>
        </div>
      </div>
      <div class="actions"><button type="button" class="btn danger" id="ivf-cancel">🗑 ${h(t(locked ? 'rcCancelT' : 'rcCancelDon'))}</button><span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="button" class="btn" id="ivf-mail">✉ ${h(t('rcMailBtn'))}</button>
        <button type="button" class="btn" id="ivf-pdf">⬇ PDF</button>
        <button type="button" class="btn primary" id="ivf-print">🖨 ${h(t('rcPrint'))}</button></div>`;
    wire();
    requestAnimationFrame(() => { const box = $('.rx-form-prev', dlg); const sc = $('.rx-prev-scale', dlg); if (box && sc) sc.style.zoom = String(Math.min(1, (box.clientWidth - 24) / 816)); });
  };
  const wire = () => {
    $$('[data-x]', dlg).forEach((b) => { b.onclick = () => dlg.close(); });
    $('#ivf-who', dlg)?.addEventListener('change', (e) => { const x = state.contacts.find((y) => ui.pickerLabel(y) === e.target.value.trim()); F.who = x ? String(x.contact_id) : ''; render(); });
    $$('[data-rmd]', dlg).forEach((b) => { b.onclick = () => { F.list.splice(Number(b.dataset.rmd), 1); render(); }; });
    $$('[data-rmm]', dlg).forEach((b) => { b.onclick = () => { F.manual.splice(Number(b.dataset.rmm), 1); render(); }; });
    $$('[data-md]', dlg).forEach((el) => { el.onchange = () => { F.manual[Number(el.dataset.md)].desc = el.value; render(); }; });
    $$('[data-ma]', dlg).forEach((el) => { el.onchange = () => { F.manual[Number(el.dataset.ma)].amount = el.value === '' ? '' : Number(el.value); render(); }; });
    $('#ivf-add', dlg)?.addEventListener('change', (e) => { const d = state.donations.find((x) => String(x.donation_id) === e.target.value); if (d) F.list.push(d); render(); });
    $('#ivf-line', dlg)?.addEventListener('click', () => { F.manual.push({ desc: '', amount: '' }); render(); });
    wireAddrPicker(dlg, F, render);
    $('#ivf-due', dlg)?.addEventListener('change', (e) => { F.due = e.target.value; render(); });
    $('#ivf-note', dlg)?.addEventListener('change', (e) => { F.note = e.target.value.trim(); render(); });
    const go = async (mode) => {
      const c = locked ? c0 : docOf();
      if (!c.contact_id && !c.donor_name) { ui.toast(t('ivNeedWho'), 'error'); return; }
      if (!invLines(c).length) { ui.toast(t('ivNeedLines'), 'error'); return; }
      let to = '';
      if (mode === 'mail') { to = askAddress(c.contact_id); if (!to) return; }
      const run = async () => {
        try {
          const [x] = locked ? [{ receipt_no: c0.receipt_no, issued_at: c0.issued_at, reprint: true }] : await issueDocs([{ ...issueOf(c), meta: c.meta }]);
          const full = { ...c, receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint };
          dlg.close();
          if (mode === 'print') printDocs([full]);
          else if (mode === 'pdf') {
            const b64 = await receiptPdf(full);
            const a = document.createElement('a');
            a.href = `data:application/pdf;base64,${b64}`;
            a.download = `${x.receipt_no}.pdf`;
            document.body.append(a); a.click(); a.remove();
          } else {
            const r = await mailDocs([{ c: { ...full, reprint: false }, to }]);
            ui.toast(r.errors ? t('mailFailed') : t('rcMailSent', { to }), r.errors ? 'error' : '');
          }
          await loadAll();
          if (done) done();
        } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
      };
      if (mode === 'mail') withGmail(run); else run();
    };
    $('#ivf-cancel', dlg).onclick = async () => {
      const c = locked ? c0 : { ...docOf(), receipt_no: '' };
      if (!c.receipt_no && !(c.list || []).length) { dlg.close(); return; }
      if (await cancelDoc(c)) { dlg.close(); if (done) done(); }
    };
    $('#ivf-print', dlg).onclick = () => go('print');
    $('#ivf-pdf', dlg).onclick = () => go('pdf');
    $('#ivf-mail', dlg).onclick = () => go('mail');
  };
  render();
  dlg.showModal();
}

// ---------- די פרטים פון א ארגון (וואס שטייט אויף דער קבלה) ----------
// אלע פעלדער, אין דער סדר ווי זיי שטייען אויף דער קבלה (פון אויבן ביז אונטן).
// [שליסל, באשרייבונג, דיפאלט (ווערט אריינגעשטעלט אין פעלד), סארט, ריכטונג]
const TAX_DEFAULT = '{NAME} is a 501(c)(3) tax-exempt organization (EIN {EIN}). All contributions are tax deductible. No goods or services were provided by the above donee organization in consideration in whole or in part for this contribution.';
const SECTIONS = [
  ['rcS3', [
    ['coupon_title', 'rcfCouponTitle', 'DONATION RECEIPT', '', 'ltr'],
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
  ['rcS8', [
    ['tagline_en', 'rcfTagline', '', '', 'ltr'],
    ['established', 'rcfEstablished', '', '', 'ltr'],
    ['pay_text', 'rcfPayText', 'Please make checks payable to {NAME}.', 'wide', 'ltr'],
  ]],
  ['rcS7', [
    ['sales_tax_rate', 'rcfTaxRate', '8.875', '', 'ltr'],
    ['addr_dx', 'rcfAddrDx', '0', '', 'ltr'],
    ['addr_dy', 'rcfAddrDy', '0', '', 'ltr'],
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
const allSigFonts = () => [...SIG_FONTS, ...customFontNames().map((n) => [`f:${n}`, `'${n.replace(/['"<>;\\]/g, '')}'`, n])];
const sigFont = (key) => (allSigFonts().find(([k]) => k === key) || SIG_FONTS[0])[1];

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
        <select data-l="signature_font">${allSigFonts().map(([k, , l]) => `<option value="${h(k)}"${k === L.signature_font ? ' selected' : ''}>${h(k.startsWith('f:') ? l : t(l))}</option>`).join('')}</select>
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
    // EIN: א לחצן — דער פון כלל (ברירת מחדל), אדער אן אייגענער / אן
    if (k === 'ein') {
      const own = det.ein && det.ein !== '-' ? det.ein : '';
      return `<div class="wide od-ein"><b>${h(t(l))}</b>
        <label class="check"><input type="checkbox" id="od-ein-um"${det.ein ? '' : ' checked'}> ${h(t('rcfEinUm', { ein: um.ein || '—' }))}</label>
        <input name="ein" dir="ltr" value="${h(own)}" placeholder="${h(t('rcfEinOwnPh'))}"${det.ein ? '' : ' hidden'}></div>`;
    }
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
  $('#od-ein-um', form)?.addEventListener('change', (e) => { form.elements.ein.hidden = e.target.checked; if (!e.target.checked) form.elements.ein.focus(); });
  $('#od-org', form).onchange = (e) => { dlg.close(); openOrgDetails(e.target.value); };
  const changedY = new Set();
  let logoChanged = false;
  const collect = () => {
    const o = { org: $('#od-org', form).value };
    ALL_FIELDS.forEach((k) => { o[k] = form.elements[k].value.trim(); });
    o.ein = $('#od-ein-um', form)?.checked ? '' : (o.ein || '-');
    ['sales_tax_rate', 'addr_dx', 'addr_dy'].forEach((k) => { o[k] = o[k] === '' ? '' : String(Number(o[k]) || 0); });
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
      return fn({ kind: 'receipt', org: o.org, contact_id: '', donor_name: 'Mr. & Mrs. Sample Donor', ids: [], amount: 180, period: '', list: [fake], receipt_no: '1001', issued_at: new Date().toISOString().slice(0, 10), reprint: false });
    } finally {
      state.orgDetails = keep;
      if (logoChanged && state.orgLogos) state.orgLogos[o.org] = keepLogo;
      if (y) Object.assign(y, savedY);
    }
  };
  let timer = null;
  const live = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { $('.od-live-scale', form).innerHTML = sample((d) => receiptSheetHtml(d)); }, 150);
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
