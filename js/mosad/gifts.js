// אתר פון א מוסד — 💝 נדבות וקבלות: נדבות גלייך פאר דעם מוסד.
// מיט אן איש קשר → אינעם הויפט-גיליון (ווייזט זיך אויך אינעם הויפט-אתר, און דער נדבן באקומט "תורמים ← דער מוסד");
// אן איש קשר → נאר אינעם גיליון פונעם מוסד. קבלה פון אמעריקע: מיטן EIN פון קהל אונגוואר, אין דער זעלבער סעריע ווי אינעם הויפט-אתר.
// א קבלה פון ארץ ישראל (סעיף 46) גייט נישט פון דא — מ'שרייבט נאר איר נומער.
import { CURRENCIES, isForeign, fmtCur, amountLabel, usdRate, toUsd } from '../fx.js?v=379';
import { downloadXlsx } from '../excel.js?v=379';
import { isoToHebrewText, todayIso } from '../hebdate.js?v=379';

let X = null;
export function initGifts(ctx) { X = ctx; }
const g = { data: null, q: '', year: '' };
const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const usd = (n) => `$${NF.format(Number(n || 0))}`;
const CHECK = "צ'ק"; const CARD = 'כרטיס אשראי';
const TAX_DEFAULT = '{NAME} is a 501(c)(3) tax-exempt organization (EIN {EIN}). All contributions are tax deductible. No goods or services were provided by the above donee organization in consideration in whole or in part for this contribution.';

async function load() { g.data = await X.call(X.KEY, 'gifts'); }
const donorOf = (x) => {
  if (x.contact_id) { const p = X.pById(x.contact_id); if (p) return X.nameOf(p); const n = g.data?.names?.[x.contact_id]; return n ? n.he || n.en : `#${x.contact_id}`; }
  return x.donor_name || '—';
};
const norm = (v) => String(v ?? '').toLowerCase().replace(/["'״׳]/g, '');

export function renderGifts(box) {
  if (!g.data) {
    box.innerHTML = '<p class="muted">טוען…</p>';
    load().then(() => renderGifts(box)).catch((err) => { box.innerHTML = `<p class="ms-note err">${X.h(X.msg(err))}</p>`; });
    return;
  }
  const { h } = X;
  const all = g.data.gifts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id));
  const years = [...new Set(all.map((x) => String(x.date).slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort().reverse();
  const words = norm(g.q).split(/\s+/).filter(Boolean);
  const rows = all.filter((x) => (!g.year || String(x.date).startsWith(g.year))
    && (!words.length || words.every((w) => norm([donorOf(x), x.amount_usd, x.amount_orig, x.check_number, x.receipt_no, x.il_receipt_no, x.dedication_text, x.note].join(' ')).includes(w))));
  const now = todayIso();
  const sumBy = (list) => list.reduce((s, x) => s + Number(x.amount_usd || 0), 0);
  const month = all.filter((x) => String(x.date).slice(0, 7) === now.slice(0, 7));
  const year = all.filter((x) => String(x.date).slice(0, 4) === now.slice(0, 4));
  box.innerHTML = `<h2 class="ms-h">💝 נדבות וקבלות <span class="count-pill">${all.length}</span></h2>
    <div class="ms-stats">
      <div class="ms-stat"><span class="muted small">החודש</span><b dir="ltr">${usd(sumBy(month))}</b><span class="small">${month.length} נדבות</span></div>
      <div class="ms-stat"><span class="muted small">השנה (${now.slice(0, 4)})</span><b dir="ltr">${usd(sumBy(year))}</b><span class="small">${year.length} נדבות</span></div>
      <div class="ms-stat"><span class="muted small">בתצוגה</span><b dir="ltr">${usd(sumBy(rows))}</b><span class="small">${rows.length} נדבות</span></div>
    </div>
    <div class="ms-bar">
      <input type="search" id="gf-q" placeholder="חיפוש: שם, סכום, צ'ק, מס' קבלה…" value="${h(g.q)}">
      <select id="gf-year"><option value="">כל השנים</option>${years.map((y) => `<option${y === g.year ? ' selected' : ''}>${y}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="gf-new">＋ נדבה חדשה</button>
      <button type="button" class="btn" id="gf-xl">⬇ Excel</button>
      <button type="button" class="btn" id="gf-reload" title="רענון">⟳</button>
    </div>
    <p class="muted small">נדבה עם איש קשר מופיעה גם באתר הכללי (ובכרטיס של התורם). קבלה אמריקאית 🧾 — עם ה-EIN של קהל אונגוואר, באותה סדרה של האתר הכללי. קבלה ישראלית — מוציאים במשרד, וכותבים כאן את המספר שלה.</p>
    ${rows.length ? `<div class="ms-wrap"><table class="ms-table"><thead><tr><th>תאריך</th><th>תורם</th><th>סכום</th><th>אמצעי</th><th>הקדשה</th><th>קבלה 🇺🇸</th><th>קבלה 🇮🇱</th><th></th></tr></thead><tbody>
      ${rows.slice(0, 500).map((x) => `<tr>
        <td class="small">${h(x.date)}<div class="muted small">${h(x.date ? isoToHebrewText(x.date) : '')}</div></td>
        <td>${x.contact_id ? `<a href="#" data-open="${h(x.contact_id)}"><b>${h(donorOf(x))}</b></a>` : `<b>${h(donorOf(x))}</b> <span class="ms-kind">בלי איש קשר</span>`}</td>
        <td class="num" dir="ltr">${h(amountLabel(x))}</td>
        <td class="small">${h([x.payment_method, x.check_number ? `#${x.check_number}` : '', x.card_last4 ? `****${x.card_last4}` : ''].filter(Boolean).join(' '))}</td>
        <td class="small">${h([x.dedication_type, x.dedication_text].filter(Boolean).join(' '))}</td>
        <td dir="ltr" class="small">${h(x.receipt_no)}</td><td dir="ltr" class="small">${h(x.il_receipt_no)}</td>
        <td class="ms-acts">${x.src === 'm' ? `<button type="button" class="btn small-btn" data-rc="${h(x.id)}" title="${x.receipt_no ? 'הדפסת הקבלה שוב' : 'קבלה אמריקאית'}">🧾</button>` : ''}
          <button type="button" class="btn small-btn" data-ed="${h(x.src)}:${h(x.id)}" title="עריכה">✎</button></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="muted ms-empty">${all.length ? 'אין תוצאות.' : 'אין עדיין נדבות.'}</p>`}`;
  const q = X.$('#gf-q', box);
  q.oninput = () => { g.q = q.value; const pos = q.selectionStart; renderGifts(box); const n = X.$('#gf-q'); n.focus(); n.setSelectionRange(pos, pos); };
  X.$('#gf-year', box).onchange = (e) => { g.year = e.target.value; renderGifts(box); };
  X.$('#gf-new', box).onclick = () => giftDialog(null, box);
  X.$('#gf-reload', box).onclick = () => load().then(() => { renderGifts(box); X.toast('עודכן'); }).catch((err) => X.toast(X.msg(err), 'err'));
  X.$('#gf-xl', box).onclick = () => downloadXlsx(`${X.st.mosad?.name || 'מוסד'} - נדבות`,
    ['תאריך', 'תורם', 'מס\' איש קשר', 'מטבע', 'סכום', 'שער', 'בדולר', 'אמצעי', "מס' צ'ק", 'כרטיס', 'הקדשה', 'קבלה ארה"ב', 'קבלה ישראלית', 'הערה'],
    rows.map((x) => [x.date, donorOf(x), x.contact_id || '', isForeign(x) ? x.currency : 'USD', isForeign(x) ? Number(x.amount_orig) : Number(x.amount_usd), isForeign(x) ? Number(x.fx_rate) : 1,
      Number(x.amount_usd || 0), x.payment_method, x.check_number, x.card_last4 ? `****${x.card_last4}` : '', [x.dedication_type, x.dedication_text].filter(Boolean).join(' '), x.receipt_no, x.il_receipt_no, x.note]), { rtl: true });
  X.$$('[data-open]', box).forEach((a) => { a.onclick = (ev) => { ev.preventDefault(); const p = X.pById(a.dataset.open); if (p) X.personDialog(p); else X.toast('הוא לא ברשימה של המוסד.'); }; });
  X.$$('[data-ed]', box).forEach((b) => { b.onclick = () => { const [src, id] = b.dataset.ed.split(':'); giftDialog(all.find((x) => x.src === src && String(x.id) === id), box); }; });
  X.$$('[data-rc]', box).forEach((b) => { b.onclick = () => printUsReceipt(b.dataset.rc).then(() => load()).then(() => renderGifts(box)); });
}

function giftDialog(x0, box) {
  const { h, S } = X;
  const x = x0 || { date: todayIso(), currency: 'USD' };
  const isNew = !x0;
  const fr = isForeign(x);
  const label = (id) => (id ? `${donorOf({ contact_id: id })} (#${id})` : '');
  const methods = g.data.methods?.length ? g.data.methods : [CHECK, CARD, 'מזומן', 'Zelle', 'אחר'];
  const deds = g.data.dedications || [];
  const people = X.st.people.slice().sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he'));
  const locked = Boolean(x.receipt_no);
  const d = X.dialog(`<h2>💝 ${isNew ? 'נדבה חדשה' : 'עריכת נדבה'}</h2>
    <form autocomplete="off" class="ms-form">
      <label class="wide">תורם<input name="donor" list="gf-dl" value="${h(x.contact_id ? label(x.contact_id) : x.donor_name || '')}" placeholder="בחר מהרשימה, או כתוב שם (בלי איש קשר)"></label>
      <datalist id="gf-dl">${people.map((p) => `<option value="${h(`${X.nameOf(p)} (#${p.contact_id})`)}">`).join('')}</datalist>
      <div class="ms-find"><input id="gf-fq" placeholder="חיפוש במאגר הכללי: שם או טלפון"><button type="button" class="btn" id="gf-fgo">🔍 חיפוש</button>
        ${X.can('people_edit') ? '<button type="button" class="btn" id="gf-newc">➕ איש קשר חדש</button>' : ''}</div>
      <div id="gf-fout"></div>
      <p class="muted small" id="gf-who"></p>
      <div class="grid">
        <label>תאריך<input name="date" type="date" value="${h(x.date || todayIso())}"></label>
        <label>סכום *<span class="amount-wrap"><select name="currency" class="cur-sel"${locked ? ' disabled' : ''}>${CURRENCIES.map((c) => `<option value="${c.code}"${(fr ? x.currency : 'USD') === c.code ? ' selected' : ''}>${c.sym} ${c.he}</option>`).join('')}</select>
          <input name="amount" type="number" min="0" step="0.01" dir="ltr" value="${h(fr ? x.amount_orig : x.amount_usd || '')}"${locked ? ' disabled' : ''}></span></label>
        <label class="gf-usd"${fr ? '' : ' hidden'}>≈ בדולר<input name="usd" type="number" min="0" step="0.01" dir="ltr" value="${fr ? h(x.amount_usd) : ''}"${locked ? ' disabled' : ''}><span class="muted small gf-rate">${fr && Number(x.fx_rate) ? `שער ${Number(x.fx_rate).toFixed(4)}` : ''}</span></label>
        <label>אמצעי תשלום<select name="payment_method"><option value=""></option>${methods.map((m) => `<option${m === x.payment_method ? ' selected' : ''}>${h(m)}</option>`).join('')}</select></label>
        <label>מס' צ'ק<input name="check_number" dir="ltr" value="${h(x.check_number || '')}"></label>
        <label>4 ספרות אחרונות של הכרטיס<input name="card_last4" dir="ltr" maxlength="4" inputmode="numeric" value="${h(x.card_last4 || '')}"></label>
        <label>הקדשה<select name="dedication_type"><option value=""></option>${deds.map((m) => `<option${m === x.dedication_type ? ' selected' : ''}>${h(m)}</option>`).join('')}</select></label>
        <label>נוסח ההקדשה<input name="dedication_text" value="${h(x.dedication_text || '')}"></label>
        <label>מס' קבלה ישראלית<input name="il_receipt_no" dir="ltr" value="${h(x.il_receipt_no || '')}"></label>
        <label class="wide">הערה<input name="note" value="${h(x.note || '')}"></label>
      </div>
      ${locked ? `<p class="muted small">יצאה קבלה ${h(x.receipt_no)} — אי אפשר לשנות את הסכום. ביטול קבלה — באתר הכללי.</p>` : ''}
      <p class="muted small">לעולם לא רושמים מספר כרטיס מלא — רק 4 ספרות אחרונות.</p>
      <div class="actions">
        ${!isNew && !locked ? '<button type="button" class="btn danger" id="gf-del">🗑 מחיקה</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-x>ביטול</button>
        <button type="submit" class="btn" data-mode="save">💾 שמירה</button>
        ${locked ? '' : '<button type="submit" class="btn primary" data-mode="receipt" id="gf-saverc">💾 + 🧾 קבלה אמריקאית</button>'}
      </div>
    </form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d); const el = form.elements;
  const idOf = () => (S(el.donor.value).match(/\(#(\d+)\)$/) || [])[1] || '';
  const who = () => {
    const id = idOf();
    X.$('#gf-who', d).textContent = id ? '✓ עם איש קשר — יופיע גם באתר הכללי.' : S(el.donor.value) ? 'בלי איש קשר — יישמר רק כאן. (קבלה אמריקאית — רק עם איש קשר.)' : '';
    const rb = X.$('#gf-saverc', d); if (rb) rb.hidden = !id;
  };
  el.donor.oninput = who; who();
  // מטבע → שווי אין דולער
  let seq = 0;
  const fx = async () => {
    const cur = el.currency.value;
    X.$('.gf-usd', d).hidden = cur === 'USD';
    if (cur === 'USD' || el.usd.dataset.manual) return;
    const s0 = ++seq;
    X.$('.gf-rate', d).textContent = 'מחפש שער…';
    const r = await usdRate(cur, el.date.value || todayIso());
    if (s0 !== seq) return;
    if (!r) { X.$('.gf-rate', d).textContent = 'לא נמצא שער — כתוב את השווי בדולר'; return; }
    el.usd.value = Number(el.amount.value) ? toUsd(el.amount.value, r.rate) : '';
    X.$('.gf-rate', d).textContent = `שער ${r.rate.toFixed(4)} ליום ${r.date}`;
  };
  el.currency.onchange = () => { delete el.usd.dataset.manual; fx(); };
  el.amount.oninput = () => fx();
  el.date.onchange = () => { delete el.usd.dataset.manual; fx(); };
  el.usd.oninput = () => { el.usd.dataset.manual = '1'; };
  // חיפוש אינעם הויפט-מאגר
  const go = async () => {
    const q = X.$('#gf-fq', d).value.trim();
    const out = X.$('#gf-fout', d);
    if (q.length < 2) { out.innerHTML = '<p class="muted small">כתוב לפחות 2 אותיות.</p>'; return; }
    out.innerHTML = '<p class="muted small">מחפש…</p>';
    try {
      const digits = q.replace(/\D/g, '');
      const r = await X.call(X.KEY, 'find', digits.length >= 7 ? { q: '', phone: q } : { q, phone: '' });
      out.innerHTML = r.found.length ? `<div class="ms-found">${r.found.map((f) => `<div class="ms-fr"><span><b>${h(f.name)}</b> <span class="muted small" dir="ltr">${h(f.en)}</span> ${f.city ? `· ${h(f.city)}` : ''} <span class="muted small">#${h(f.contact_id)}</span></span>
        <button type="button" class="btn small-btn primary" data-pick="${h(f.contact_id)}" data-name="${h(f.name || f.en)}">זה הוא</button></div>`).join('')}</div>` : '<p class="muted small">לא נמצא.</p>';
      X.$$('[data-pick]', out).forEach((b) => { b.onclick = () => { el.donor.value = `${b.dataset.name} (#${b.dataset.pick})`; out.innerHTML = ''; who(); }; });
    } catch (err) { out.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; }
  };
  X.$('#gf-fgo', d).onclick = go;
  X.$('#gf-fq', d).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  X.$('#gf-newc', d)?.addEventListener('click', () => { d.close(); X.addDialog('donor'); X.toast('אחרי שמירת איש הקשר — חזור ל"נדבה חדשה" ובחר אותו מהרשימה.'); });
  X.$('#gf-del', d)?.addEventListener('click', async () => {
    if (!window.confirm('למחוק את הנדבה?')) return;
    try { await X.call(X.KEY, 'giftDelete', { src: x.src, id: x.id }); d.close(); await load(); renderGifts(box); X.toast('נמחק.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  });
  let mode = 'save';
  X.$$('[data-mode]', form).forEach((b) => { b.onclick = () => { mode = b.dataset.mode; }; });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const cid = idOf();
    if (!S(el.donor.value)) { X.toast('חסר שם התורם.', 'err'); return; }
    if (/\(#\d+\)$/.test(S(el.donor.value)) === false && /#\d/.test(el.donor.value)) { X.toast('בחר את התורם מהרשימה.', 'err'); return; }
    const cur = el.currency.value;
    const amt = Number(el.amount.value);
    if (!(amt > 0)) { X.toast('חסר סכום.', 'err'); return; }
    let usdVal = cur === 'USD' ? amt : Number(el.usd.value);
    if (cur !== 'USD' && !(usdVal > 0)) { const r = await usdRate(cur, el.date.value); usdVal = r ? toUsd(amt, r.rate) : 0; }
    if (!(usdVal > 0)) { X.toast('לא נמצא שער — כתוב את השווי בדולר.', 'err'); return; }
    const last4 = S(el.card_last4.value).replace(/\D/g, '');
    if (last4 && last4.length !== 4) { X.toast('רק 4 ספרות אחרונות.', 'err'); return; }
    const w = mode === 'receipt' && cid ? window.open('', '_blank') : null;
    X.$$('button', form).forEach((b) => { b.disabled = true; });
    try {
      const r = await X.call(X.KEY, 'giftSave', { gift: { src: x.src || '', id: x.id || '', contact_id: cid, donor_name: cid ? '' : S(el.donor.value), date: el.date.value,
        currency: cur, amount_orig: amt, amount_usd: usdVal, payment_method: el.payment_method.value, check_number: S(el.check_number.value), card_last4: last4,
        dedication_type: el.dedication_type.value, dedication_text: S(el.dedication_text.value), note: S(el.note.value), il_receipt_no: S(el.il_receipt_no.value) } });
      d.close();
      if (w && r.src === 'm') await printUsReceipt(r.id, w);
      if (cid && !X.pById(cid)) await X.loadPeople();
      await load(); renderGifts(box);
      X.toast('נשמר.');
    } catch (err) { if (w) w.close(); X.$$('button', form).forEach((b) => { b.disabled = false; }); X.toast(X.msg(err), 'err'); }
  };
  fx();
}

// ---------- קבלה פון אמעריקע ----------
const longDate = (iso) => { const s = String(iso || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const [y, m, dd] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
async function printUsReceipt(id, win = null) {
  const w = win || window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש — אפשר חלונות קופצים לאתר הזה.', 'err'); return; }
  w.document.write('<p style="font-family:sans-serif;padding:20px">טוען את הקבלה…</p>');
  let r;
  try { r = await X.call(X.KEY, 'giftReceipt', { id }); } catch (err) { w.close(); X.toast(X.msg(err), 'err'); return; }
  const { h } = X;
  const det = r.org || {}; const um = r.umbrella || {};
  // ווי אינעם הויפט-אתר: אן אן אייגענעם EIN — אונטער דעם EIN פון קהל אונגוואר
  const noEin = String(det.ein || '').trim() === '-';
  const ein = noEin ? '' : (det.ein || um.ein || '');
  const entity = det.ein && !noEin ? (det.legal_name || X.st.mosad?.org) : (um.legal_name || det.legal_name || X.st.mosad?.org);
  const legal = det.legal_name || um.legal_name || '';
  const he = det.org_name_he || X.st.mosad?.name || '';
  const addrSrc = det.address ? det : um;
  const gift = r.gift; const c = r.donor || {};
  const name = [c.title_en, c.first_name_en, c.last_name_en].filter(Boolean).join(' ') || [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ');
  const heName = [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ');
  const tax = String(det.tax_text || um.tax_text || TAX_DEFAULT).replace(/\{NAME\}/g, entity || '').replace(/\{EIN\}/g, ein || '—');
  const method = [gift.payment_method, gift.check_number ? `#${gift.check_number}` : '', gift.card_last4 ? `****${gift.card_last4}` : ''].filter(Boolean).join(' ');
  const logo = det.logo || X.st.logo || '';
  w.document.open();
  w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Receipt ${h(r.receipt.receipt_no)}</title>
    <style>
      @page { size: letter; margin: 0.6in; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #222; margin: 0; }
      .bar { font-family: sans-serif; padding: 10px; background: #f3efe6; display: flex; gap: 10px; justify-content: center; }
      .bar button { font-size: 16px; padding: 6px 16px; }
      .doc { max-width: 7.2in; margin: 20px auto; border: 2px solid #7a5a2f; border-radius: 10px; padding: 26px 30px; }
      .top { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #c9b48d; padding-bottom: 14px; }
      .top img { width: 74px; height: 74px; object-fit: contain; }
      .he { font-size: 22px; font-weight: bold; direction: rtl; }
      .en { font-size: 16px; letter-spacing: .5px; }
      .addr { font-size: 12.5px; color: #555; }
      .tag { margin: 18px 0 8px; text-align: center; font: bold 18px sans-serif; letter-spacing: 3px; color: #7a5a2f; }
      table { width: 100%; border-collapse: collapse; font-size: 15px; }
      td { padding: 7px 4px; border-bottom: 1px dotted #ccc; vertical-align: top; }
      td.l { width: 30%; color: #666; font-family: sans-serif; font-size: 13px; }
      .amt { font-size: 22px; font-weight: bold; }
      .note { margin-top: 16px; font-size: 12px; color: #444; }
      .sig { margin-top: 34px; display: flex; justify-content: space-between; font-size: 13px; }
      .sig div { border-top: 1px solid #555; padding-top: 4px; min-width: 2.4in; text-align: center; }
      .copy { color: #a33; font: bold 13px sans-serif; }
      @media print { .bar { display: none; } .doc { margin: 0 auto; } }
    </style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 Print · הדפסה</button><button onclick="window.close()">Close · סגירה</button></div>
    <div class="doc">
      <div class="top">${logo ? `<img src="${logo}" alt="">` : ''}<div>
        <div class="he">${h(he)}</div><div class="en">${h(legal)}</div>
        <div class="addr">${[addrSrc.address, addrSrc.city_state_zip, addrSrc.phone ? `Tel: ${addrSrc.phone}` : '', ein ? `EIN: ${ein}` : ''].filter(Boolean).map(h).join(' · ')}</div></div></div>
      <div class="tag">OFFICIAL RECEIPT${r.receipt.copy ? ' <span class="copy">(COPY)</span>' : ''}</div>
      <table>
        <tr><td class="l">Receipt #</td><td><b>${h(r.receipt.receipt_no)}</b></td></tr>
        <tr><td class="l">Date</td><td>${h(longDate(gift.date))}</td></tr>
        <tr><td class="l">Received from</td><td><b>${h(name)}</b>${heName && heName !== name ? ` · <span dir="rtl">${h(heName)}</span>` : ''}
          ${c.address ? `<br><small>${h(c.address)}${c.city ? `, ${h(c.city)}` : ''}${c.state ? ` ${h(c.state)}` : ''} ${h(c.zip || '')}</small>` : ''}</td></tr>
        <tr><td class="l">Amount</td><td class="amt">${usd(gift.amount_usd)}</td></tr>
        ${isForeign(gift) ? `<tr><td class="l">Received</td><td>${h(fmtCur(gift.amount_orig, gift.currency))} = ${usd(gift.amount_usd)} <small>(exchange rate of ${h(longDate(gift.date))}${Number(gift.fx_rate) ? `: ${Number(gift.fx_rate).toFixed(4)}` : ''})</small></td></tr>` : ''}
        ${method ? `<tr><td class="l">Payment</td><td>${h(method)}</td></tr>` : ''}
        ${gift.dedication_text ? `<tr><td class="l">Dedication</td><td dir="rtl">${h([gift.dedication_type, gift.dedication_text].filter(Boolean).join(' '))}</td></tr>` : ''}
      </table>
      <div class="note">${h(tax)}${det.receipt_note ? ` ${h(det.receipt_note)}` : ''}</div>
      <div class="sig"><span></span><div>${h(det.signer_name || um.signer_name || '')}${(det.signer_title || um.signer_title) ? `, ${h(det.signer_title || um.signer_title)}` : ''}<br><small>${h(legal)}</small></div></div>
    </div></body></html>`);
  w.document.close();
}
