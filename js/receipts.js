// Invoice & Receipt: קבלות אויף נדבות, Invoices אויף נישט-באצאלטע, יערליכע סיכומים (פאר טעקס), און קבלות פאר א קאמפיין.
// יעדער ארגון מיט זיינע אייגענע פרטים (לשונית OrgDetails); יעדער דאקומענט באקומט א נומער (לשונית Receipts),
// און ביים נאכאמאל דרוקן — דער זעלבער נומער.
import {
  state, loadAll, orgDetailsOf, issueDocs, findIssued, voidReceipt, orgLogo, saveOrgDetails,
} from './data.js';
import { t } from './i18n.js';
import { isTrue, escapeHtml as h, mailingName, splitTags } from './util.js';
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
      ${f.kind !== 'invoice' ? `<label class="check"><input type="checkbox" id="rc-onlynew"${f.onlyNew ? ' checked' : ''}> ${h(t('rcOnlyNew'))}</label>` : ''}
    </div>
    ${missing ? `<p class="drive-warn">⚠ ${h(t('rcMissingDetails', { org: f.org }))} <button type="button" class="btn small-btn primary" id="rc-edit-org">${h(t('rcEditDetails'))}</button></p>`
      : `<p class="muted small">${h(det.legal_name)} · EIN ${h(det.ein || '—')} <button type="button" class="linkish" id="rc-edit-org">${h(t('rcEditDetails'))}</button></p>`}
    <div class="rc-actions">
      <label class="check"><input type="checkbox" id="rc-all"> ${h(t('rcSelectAll'))}</label>
      <span class="muted" id="rc-count"></span>
      <span class="spacer"></span>
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
  $('#rc-onlynew', main)?.addEventListener('change', (e) => { f.onlyNew = e.target.checked; rerender(); });
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
      const issued = await issueDocs(docs.map((d) => ({ kind: d.kind, org: d.org, contact_id: d.contact_id, donor_name: d.donor_name, ids: d.ids, amount: d.amount, period: d.period })));
      printDocs(issued.map((x, i) => ({ ...docs[i], receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint })));
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

function docHtml(c) {
  const det = orgDetailsOf(c.org) || {};
  const ct = c.contact_id ? ui.contactById(c.contact_id) : null;
  const name = ct ? (mailingName(ct) || [ct.legal_first_name || ct.first_name_en, ct.last_name_en].filter(Boolean).join(' ') || ui.fullNameHe(ct)) : c.donor_name;
  const addr = ct ? [ct.address, [ct.city, ct.state].filter(Boolean).join(', ') + (ct.zip ? ` ${ct.zip}` : '')].filter((x) => String(x || '').trim()) : [];
  const logo = orgLogo(c.org);
  const title = { receipt: 'Donation Receipt', invoice: 'Invoice', year: `Year-End Giving Statement — ${c.period}`, campaign: 'Donation Receipt' }[c.kind];
  const is501 = det.is_501c3 === '' || det.is_501c3 == null || isTrue(det.is_501c3);
  const legal = det.legal_name || c.org;
  const dateCol = c.kind === 'invoice' ? 'Date pledged' : 'Date';
  const rows = c.list.map((d) => `<tr><td>${h(longDate(c.kind === 'invoice' ? d.date : paidDate(d)))}</td><td><bdi dir="auto">${h(descText(d))}</bdi></td><td>${h(c.kind === 'invoice' ? '' : payText(d))}</td><td class="amt">${money(d.amount_usd)}</td></tr>`).join('');
  const taxText = c.kind === 'invoice'
    ? `Please make checks payable to <b>${h(legal)}</b>. Thank you for your generous pledge.`
    : `Thank you for your generous contribution. ${is501 ? `${h(legal)} is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code${det.ein ? ` (EIN ${h(det.ein)})` : ''}. ` : ''}No goods or services were provided in exchange for ${c.list.length > 1 ? 'these contributions' : 'this contribution'}. Please keep this ${c.kind === 'year' ? 'statement' : 'receipt'} for your tax records.`;
  return `<section class="rc-doc">
    <header class="rc-head">
      ${logo ? `<img class="rc-logo" src="${logo}" alt="">` : ''}
      <div class="rc-org"><div class="rc-legal">${h(legal)}</div>
        <div>${[det.address, det.city_state_zip].filter(Boolean).map(h).join(' · ')}</div>
        <div>${[det.phone, det.email, det.website].filter(Boolean).map(h).join(' · ')}</div>
        ${det.ein ? `<div>Tax ID (EIN): ${h(det.ein)}</div>` : ''}</div>
      <div class="rc-yi" dir="rtl">${h(det.thanks_yi || 'בס"ד')}</div>
    </header>
    <div class="rc-titlebar"><h1>${h(title)}</h1>
      <table class="rc-meta"><tr><td>${c.kind === 'invoice' ? 'Invoice #' : c.kind === 'year' ? 'Statement #' : 'Receipt #'}</td><td><b>${h(c.receipt_no)}</b>${c.reprint ? ' <span class="rc-copy">(copy)</span>' : ''}</td></tr>
        <tr><td>Date issued</td><td>${h(longDate(String(c.issued_at || '').slice(0, 10)))}</td></tr>
        ${c.kind === 'campaign' ? `<tr><td>Campaign</td><td><bdi dir="auto">${h(c.period)}</bdi></td></tr>` : ''}</table></div>
    <div class="rc-to"><div class="rc-label">${c.kind === 'invoice' ? 'Bill to' : 'Received from'}</div>
      <div class="rc-name"><bdi dir="auto">${h(name)}</bdi></div>${addr.map((l) => `<div>${h(l)}</div>`).join('')}</div>
    <table class="rc-lines"><thead><tr><th>${dateCol}</th><th>Description</th><th>${c.kind === 'invoice' ? '' : 'Payment'}</th><th class="amt">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">${c.kind === 'invoice' ? 'Amount due' : 'Total'}</td><td class="amt">${money(c.amount)}</td></tr></tfoot></table>
    <p class="rc-tax">${taxText}</p>
    ${det.receipt_note ? `<p class="rc-note">${h(det.receipt_note)}</p>` : ''}
    <div class="rc-sign"><div class="rc-sigline"></div><div>${h(det.signer_name || '')}</div><div class="rc-muted">${h(det.signer_title || '')}</div></div>
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
  Promise.all($$('img', area).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))))
    .then(() => window.print());
}

/** פון דער נדבה: א קבלה (באצאלט) אדער Invoice (נישט באצאלט) — גלייך דרוקן. */
export async function printForDonation(d) {
  const org = effectiveOrg(d);
  if (!org) { ui.toast(t('rcNoOrg'), 'error'); return; }
  const det = orgDetailsOf(org);
  if (!det || !det.legal_name) { ui.toast(t('rcMissingDetails', { org }), 'error'); openOrgDetails(org); return; }
  const kind = isTrue(d.is_paid) ? 'receipt' : 'invoice';
  const base = { kind, org, contact_id: d.contact_id || '', donor_name: d.contact_id ? '' : String(d.donor_name || ''), ids: [String(d.donation_id)], amount: Number(d.amount_usd || 0), period: '' };
  try {
    const [x] = await issueDocs([base]);
    printDocs([{ ...base, list: [d], receipt_no: x.receipt_no, issued_at: x.issued_at, reprint: x.reprint }]);
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
}


// ---------- די פרטים פון א ארגון (וואס שטייט אויף דער קבלה) ----------
const DET_FIELDS = [
  ['legal_name', 'rcfLegal', 'Khal Ungvar Inc.', true],
  ['address', 'rcfAddress', '1234 53rd Street', true],
  ['city_state_zip', 'rcfCity', 'Brooklyn, NY 11219', true],
  ['phone', 'rcfPhone', '(718) 000-0000'],
  ['email', 'rcfEmail', 'office@example.org'],
  ['website', 'rcfWebsite', ''],
  ['ein', 'rcfEin', '00-0000000'],
  ['signer_name', 'rcfSigner', ''],
  ['signer_title', 'rcfSignerTitle', 'Treasurer'],
  ['receipt_prefix', 'rcfPrefix', 'BP'],
  ['thanks_yi', 'rcfThanks', 'בס"ד'],
  ['receipt_note', 'rcfNote', ''],
];

export function openOrgDetails(org) {
  const dlg = $('#orgdet-dialog');
  const form = $('#orgdet-form');
  const det = orgDetailsOf(org) || {};
  const is501 = det.is_501c3 === '' || det.is_501c3 == null || isTrue(det.is_501c3);
  form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>🧾 ${h(t('rcDetailsTitle'))}</h2>
    <label class="wide org-pick">${h(t('forOrg'))} ${orgSelect('org', org, 'id="od-org"')}</label>
    <p class="hint-line">${h(t('rcDetailsHint'))}</p>
    <div class="grid od-grid">${DET_FIELDS.map(([k, l, ph, req]) => `<label class="${k === 'receipt_note' || k === 'legal_name' ? 'wide' : ''}">${h(t(l))}${req ? ' *' : ''}
      ${k === 'receipt_note' ? `<textarea name="${k}" rows="2" dir="ltr" placeholder="${h(ph)}">${h(det[k] || '')}</textarea>`
        : `<input name="${k}" value="${h(det[k] || '')}" placeholder="${h(ph)}" dir="${k === 'thanks_yi' ? 'rtl' : 'ltr'}"${req ? ' required' : ''}>`}</label>`).join('')}</div>
    <label class="check"><input type="checkbox" name="is_501c3"${is501 ? ' checked' : ''}> ${h(t('rcf501'))}</label>
    <div class="actions"><span class="spacer"></span>
      <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>`;
  $$('[data-close]', form).forEach((b) => { b.onclick = () => dlg.close(); });
  $('#od-org', form).onchange = (e) => { dlg.close(); openOrgDetails(e.target.value); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const o = { org: $('#od-org', form).value, is_501c3: form.elements.is_501c3.checked };
    DET_FIELDS.forEach(([k]) => { o[k] = form.elements[k].value.trim(); });
    o.receipt_prefix = o.receipt_prefix.toUpperCase().replace(/[^A-Z0-9]/g, '');
    try {
      await saveOrgDetails(o);
      await loadAll();
      dlg.close();
      ui.toast(t('saved'));
      if (!$('.view[data-view="receipts"]').hidden) renderReceipts();
      if (!$('.view[data-view="admin"]').hidden) ui.refreshAdmin?.();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  if (!dlg.open) dlg.showModal();
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
