// 📦 המחסן: הרשימה הישנה (לשונית Machsan). לא נטען בכניסה — רק כשמחפשים (שם, עיר, 4 ספרות אחרונות של טלפון).
// בחיפוש: באפור, בנפרד, עם 📦. לחיצה → כל הפרטים (נטענים רק אז) + "➕ להוסיף למאגר" (עם בדיקת כפילות).
// מי שכבר במאגר (contact_id) או שכבר נוסף — לא מופיע.
import { otherSheet, updateRange } from './google.js';
import { CONFIG } from './config.js';
import { state as dstate, saveDonations, saveContact } from './data.js';
import { fromHebrew, yearLabel, toHebrew } from './hebdate.js';

export const MCOLS = ['m_id', 'title', 'first', 'last', 'last_he', 'city', 'ph4', 'decision', 'contact_id', 'status', 'wife', 'c_o', 'address', 'state', 'zip', 'country',
  'phones', 'email', 'comments', 'son', 'added', 'codes', 'tags', 'gift_total', 'gift_years', 'gift_first', 'gift_last', 'gift_max', 'gifts', 'reason', 'match', 'updated_at', 'updated_by'];
const letter = (n) => (n < 26 ? String.fromCharCode(65 + n) : String.fromCharCode(64 + Math.floor(n / 26)) + String.fromCharCode(65 + (n % 26)));
const col = (k) => letter(MCOLS.indexOf(k));
let ui = null; let IDX = null; let loading = null;
export function initMachsan(helpers) { ui = helpers; }
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').toLowerCase().replace(/["'׳״.\-,]/g, '').replace(/\s+/g, ' ').trim();
const sheet = () => otherSheet(CONFIG.SPREADSHEET_ID);

async function loadIdx() {
  if (IDX) return IDX;
  loading ||= sheet().read(`Machsan!A2:${col('status')}`).then((rows) => {
    IDX = rows.map((r, i) => ({ row: i + 2, m_id: r[0], title: r[1] || '', first: r[2] || '', last: r[3] || '', last_he: r[4] || '', city: r[5] || '', ph4: String(r[6] || ''), decision: r[7] || '', contact_id: String(r[8] || ''), status: r[9] || '' }));
    IDX.forEach((x) => { x.hay = `${norm(x.first)} ${norm(x.last)} ${x.last_he} ${norm(x.city)}`; });
    return IDX;
  }).catch((e) => { loading = null; throw e; });
  return loading;
}
export const machsanLoaded = () => Boolean(IDX);

/** חיפוש: כל מילה צריכה להופיע (שם / עיר), או 4 ספרות של טלפון */
export async function machsanSearch(q, n = 10) {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length || q.trim().length < 2) return [];
  const idx = await loadIdx();
  return idx.filter((x) => !x.contact_id && x.status !== 'added' && toks.every((t) => { const d = t.replace(/\D/g, ''); return x.hay.includes(t) || (d.length === 4 && d === t && x.ph4.includes(d)); })).slice(0, n);
}
export function hitsHtml(hits) {
  if (!hits.length) return '';
  return `<div class="mx-old"><div class="mx-old-h">📦 מהרשימה הישנה <span class="muted small">(לא במאגר)</span></div>
    ${hits.map((x) => `<button type="button" class="mx-old-hit" data-mx="${x.row}">📦 <b dir="ltr">${h([x.title, x.first, x.last].filter(Boolean).join(' '))}</b>
      <span class="muted small">${h([x.last_he, x.city].filter(Boolean).join(' · '))}</span></button>`).join('')}</div>`;
}

const L = { title: 'Title', first: 'שם פרטי', last: 'משפחה', last_he: 'משפחה (עברית, מהקובץ)', wife: 'שם האשה', c_o: 'C/O', address: 'כתובת', city: 'עיר', state: 'מדינה', zip: 'מיקוד', country: 'ארץ',
  phones: 'טלפונים', email: 'אימייל', comments: 'הערות', son: 'בן', added: 'נוסף לרשימה', tags: 'תגיות (קודים)', m_id: 'ID ישן' };
const GIFT = { MM: 'מלוה מלכה', SEAT: 'מקומות ר"ה', DINNER: 'דינר', LUACH: 'לוח', LOCKER: 'לוקר', YG: 'YG', YBS: 'YBS', PM: 'PM' };
function giftsHtml(s) {
  const L2 = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']; const T = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const heb = (n) => { const [t, u] = [Math.floor(n / 10), n % 10]; let x = T[t] + L2[u]; x = ({ יה: 'טו', יו: 'טז' })[x] || x; x = `תש${x}`; return `${x.slice(0, -1)}"${x.slice(-1)}`; };
  const items = String(s || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^([A-Z_]+?)(\d\d)?:(.+)$/); return m ? { k: m[1], y: Number(m[2] || 0), v: m[3] } : null; }).filter(Boolean)
    .sort((a, b) => b.y - a.y);
  return items.map((x) => `<span class="mx-gift">${h(x.y ? heb(x.y) : '')} ${h(GIFT[x.k] || x.k)} <b dir="ltr">$${h(x.v)}</b></span>`).join(' ');
}

/** 📦 כרטיס (לקריאה בלבד) — כל הפרטים נטענים רק עכשיו */
export async function openMachsan(row) {
  let d = document.getElementById('mx-dlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'mx-dlg'; d.className = 'sheet mx-dlg'; document.body.append(d); }
  d.innerHTML = '<p class="muted">טוען…</p>'; if (!d.open) d.showModal();
  let r;
  try { r = (await sheet().read(`Machsan!A${row}:${letter(MCOLS.length - 1)}${row}`))[0] || []; } catch (err) { d.innerHTML = `<p class="err">${h(err.message)}</p><button type="button" class="btn" data-x>סגירה</button>`; d.querySelector('[data-x]').onclick = () => d.close(); return; }
  const x = Object.fromEntries(MCOLS.map((k, i) => [k, r[i] ?? '']));
  const rowF = (k) => (String(x[k] || '').trim() ? `<div class="mx-f"><span>${h(L[k])}</span><b${/[a-z0-9]/i.test(String(x[k])) ? ' dir="auto"' : ''}>${h(x[k])}</b></div>` : '');
  d.innerHTML = `<button type="button" class="x-close" data-x aria-label="סגירה">✕</button>
    <div class="mx-banner">📦 מהרשימה הישנה — לא במאגר. לקריאה בלבד.</div>
    <h2 dir="ltr" style="text-align:right">${h([x.title, x.first, x.last].filter(Boolean).join(' '))}${x.last_he ? ` <span dir="rtl">· ${h(x.last_he)}</span>` : ''}</h2>
    <div class="mx-grid">${['address', 'city', 'state', 'zip', 'country', 'c_o', 'phones', 'email', 'wife', 'son', 'comments', 'added', 'm_id'].map(rowF).join('')}</div>
    ${x.tags ? `<h4>🏷 תגיות</h4><div class="mx-tags">${String(x.tags).split(';').map((t) => t.trim()).filter(Boolean).map((t) => `<span class="chip">${h(t)}</span>`).join(' ')}</div>` : ''}
    <h4>💝 תרומות</h4>${x.gift_total ? `<p class="small">סה"כ <b dir="ltr">$${h(x.gift_total)}</b> · ${h(x.gift_years)} שנים · ${h(x.gift_first)}–${h(x.gift_last)} · הכי גבוה <b dir="ltr">$${h(x.gift_max)}</b></p><div class="mx-gifts">${giftsHtml(x.gifts)}</div>` : '<p class="muted small">לא תרם.</p>'}
    <div class="actions"><button type="button" class="btn primary" id="mx-add">➕ להוסיף למאגר</button><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`;
  d.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => d.close(); });
  d.querySelector('#mx-add').onclick = () => addToDb(x, row, d);
}

/** ➕ להוסיף למאגר: קודם "אולי זה הוא?" (אותו שם משפחה / טלפון), ואז טופס איש קשר מלא */
function addToDb(x, row, d) {
  const dig = (s) => String(s || '').replace(/\D/g, '');
  const my7 = String(x.phones || '').split(',').map((p) => dig(p).slice(-7)).filter((p) => p.length === 7);
  const ln = norm(x.last);
  const cands = ui.state.contacts.filter((c) => {
    if (ln && norm(c.last_name_en) === ln && (!x.first || norm(c.first_name_en).slice(0, 3) === norm(x.first).slice(0, 3))) return true;
    const p = ui.state.phones.get(String(c.contact_id)) || {};
    return ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].some((k) => my7.includes(dig(p[k]).slice(-7)));
  }).slice(0, 8);
  const go = () => {
    d.close();
    const ph = String(x.phones || '').split(',').map((s) => s.trim()).filter(Boolean);
    const pre = { first_name_en: x.first, last_name_en: x.last, last_name_he: x.last_he, wife_name_en: x.wife, address: x.address, city: x.city, state: x.state, zip: x.zip, country: x.country || '',
      _phones: { home_phone: ph[0] || '', other_phone: ph[1] || '', email_1: x.email || '' } };
    if (ui.state.lists?.title_en?.includes(x.title)) pre.title_en = x.title;
    ui.openForm(pre, { onSaved: async (id) => { await mark(row, id, 'added'); } });
  };
  if (!cands.length) { go(); return; }
  d.innerHTML = `<button type="button" class="x-close" data-x aria-label="סגירה">✕</button><h2>אולי הוא כבר במאגר?</h2>
    <p class="muted small">נמצאו אנשי קשר דומים ל-<b dir="ltr">${h([x.first, x.last].join(' '))}</b>. אם זה אחד מהם — מקשרים, ולא נוצר כפול.</p>
    <div class="mx-cands">${cands.map((c) => `<button type="button" class="mx-old-hit" data-link="${h(c.contact_id)}"><b>${h(ui.fullNameHe(c))}</b> <span class="muted small" dir="ltr">${h([c.first_name_en, c.last_name_en].join(' '))} · ${h(c.address || c.city || '')}</span> — זה הוא</button>`).join('')}</div>
    <div class="actions"><button type="button" class="btn primary" id="mx-new">➕ לא, איש קשר חדש</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`;
  d.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => d.close(); });
  d.querySelector('#mx-new').onclick = go;
  d.querySelectorAll('[data-link]').forEach((b) => { b.onclick = async () => { await mark(row, b.dataset.link, 'linked'); d.close(); ui.toast('קושר — הוא כבר במאגר.'); ui.openCard(b.dataset.link); }; });
}
// ---------- 💝 התרומות מהרשימה הישנה → תרומות (כמו בייבוא הגדול; בלי כפולים) ----------
const SER = { MM: 'דינער השנתי', DINNER: 'דינער השנתי', SEAT: 'סיעטס' };
const TAG = { LH: 'לוח', LUACH: 'לוח', YG: 'ישיבה גדולה דבארא פארק', PM: 'Parlor meeting', LOCKER: 'לוקר', CL: 'חברה ליאדי' };
const ORG = 'כלל מוסדות אונגוואר';
const rh = (y) => fromHebrew(1, 'Tishri', y);
function oneDon(cid, code, y, amt, extra = '', date = '') {
  const lab = yearLabel(y); const dt = date || rh(y);
  const o = { contact_id: cid, date: dt, event_year: lab, event_note: `פון אלטע רשימה${extra ? ` · ${extra}` : ''}`, amount_usd: amt, is_paid: 'TRUE', paid_date: dt, campaign: '', event_tags: '', org: '' };
  if (SER[code]) o.campaign = `${SER[code]} ${lab}`;
  else { o.event_tags = TAG[code] || code; o.org = code === 'CL' ? '' : ORG; }
  return o;
}
const fmtAmt = (s) => { const v = Number(String(s).replace(/,/g, '')); return Number.isInteger(v) ? String(v) : v.toFixed(2); };
export function oldDonations(x, cid) {
  const out = [];
  String(x.gifts || '').split(',').map((g) => g.trim()).filter(Boolean).forEach((g) => {
    const m = g.match(/^([A-Z]+?)(\d\d):(.+)$/); if (m) out.push(oneDon(cid, m[1], 5700 + Number(m[2]), fmtAmt(m[3])));
  });
  const c = String(x.comments || '');
  for (const m of c.matchAll(/\$\s?([\d,]+(?:\.\d+)?)\s*([A-Za-z]{2,})\s?(\d\d(?:\s?&\s?\d\d)*)\b/g)) {
    const yys = m[3].match(/\d\d/g); if (yys.some((q) => q < 45 || q > 87)) continue;
    yys.forEach((q) => out.push(oneDon(cid, m[2].toUpperCase(), 5700 + Number(q), fmtAmt(m[1]), 'הערה')));
  }
  for (const m of c.matchAll(/\b([A-Z]{2,})\s?(\d\d(?:\s?&\s?\d\d)*)\s*\$\s?([\d,]+(?:\.\d+)?)/g)) {
    const yys = m[2].match(/\d\d/g); if (yys.some((q) => q < 45 || q > 87)) continue;
    yys.forEach((q) => out.push(oneDon(cid, m[1], 5700 + Number(q), fmtAmt(m[3]), 'הערה')));
  }
  for (const m of c.matchAll(/\$\s?([\d,]+(?:\.\d+)?)\s+(\d{1,2})-(\d{1,2})-(\d{2})\b/g)) {
    const yr = (Number(m[4]) > 40 ? 1900 : 2000) + Number(m[4]);
    const date = `${yr}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    const o = oneDon(cid, 'GEN', toHebrew(date).y, fmtAmt(m[1]), 'הערה', date); o.event_tags = ''; o.org = ORG; out.push(o);
  }
  const key = (d) => [String(d.contact_id), d.campaign || '', d.event_tags || '', d.event_year || ''].join('|');
  const seen = new Set((dstate.donations || []).filter((d) => String(d.contact_id) === String(cid)).map(key));
  return out.filter((d) => { const k = key(d); if (seen.has(k)) return false; seen.add(k); return true; });
}
async function bringDonations(row, cid) {
  try {
    const r = (await sheet().read(`Machsan!A${row}:${letter(MCOLS.length - 1)}${row}`))[0] || [];
    const x = Object.fromEntries(MCOLS.map((k, i) => [k, r[i] ?? '']));
    const list = oldDonations(x, cid);
    if (list.length) { const n = await saveDonations(list); ui.toast(`💝 ${n} תרומות ישנות נוספו`); }
  } catch (err) { ui.toast(`תרומות ישנות: ${err.message}`, 'error'); }
}

async function mark(row, contactId, status) {
  await updateRange(`Machsan!${col('contact_id')}${row}:${col('status')}${row}`, [[String(contactId), status]]);
  await updateRange(`Machsan!${col('updated_at')}${row}:${col('updated_by')}${row}`, [[new Date().toISOString().slice(0, 16).replace('T', ' '), ui.state.email || '']]);
  const x = IDX?.find((y) => y.row === Number(row)); if (x) { x.contact_id = String(contactId); x.status = status; }
  await bringDonations(row, contactId);
}

// ---------- 👪 קשר משפחתי: לבחור מישהו מהמחסן (למשל אבא שנפטר) ----------
/** HTML של תוצאות מהמחסן לבוחר של קשר משפחתי (data-mxrel) */
export function relHitsHtml(hits) {
  if (!hits.length) return '';
  return `<div class="mx-old mx-rel"><div class="mx-old-h">📦 מהרשימה הישנה <span class="muted small">(לא במאגר — לחיצה מוסיפה אותו)</span></div>
    ${hits.map((x) => `<button type="button" class="mx-old-hit" data-mxrel="${x.row}">📦 <b dir="ltr">${h([x.title, x.first, x.last].filter(Boolean).join(' '))}</b>
      <span class="muted small">${h([x.last_he, x.city].filter(Boolean).join(' · '))}</span></button>`).join('')}</div>`;
}
/** מחפש במחסן מתחת לשדה של בוחר הקשר, ומחזיר את ה-ID של איש הקשר (קיים או חדש) דרך onPick */
export function wireRelMachsan(input, onPick) {
  if (!input) return;
  let box = input.closest('.add-family-row')?.parentElement?.querySelector('.mx-relbox');
  if (!box) { box = document.createElement('div'); box.className = 'mx-relbox'; input.closest('.add-family-row').after(box); }
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2 || /\(#\d+\)/.test(q)) { box.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try { const hits = await machsanSearch(q, 6); if (input.value.trim() === q) box.innerHTML = relHitsHtml(hits); } catch { box.innerHTML = ''; }
    }, 250);
  });
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mxrel]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const id = await pickMachsan(Number(b.dataset.mxrel));
    if (id) { box.innerHTML = ''; onPick(String(id)); }
  });
}
/** חלון קטן: פרטים מהמחסן → "זה הוא" (מישהו שכבר במאגר) או "➕ ליצור" (עם ☐ נפטר). מחזיר ID או null. */
export function pickMachsan(row) {
  return new Promise((resolve) => {
    let d = document.getElementById('mx-pick');
    if (!d) { d = document.createElement('dialog'); d.id = 'mx-pick'; d.className = 'sheet mx-dlg'; document.body.append(d); }
    let done = false; const fin = (v) => { if (done) return; done = true; d.close(); resolve(v); };
    d.onclose = () => fin(null);
    d.innerHTML = '<p class="muted">טוען…</p>'; if (!d.open) d.showModal();
    sheet().read(`Machsan!A${row}:${letter(MCOLS.length - 1)}${row}`).then((rows) => {
      const r = rows[0] || []; const x = Object.fromEntries(MCOLS.map((k, i) => [k, r[i] ?? '']));
      const dig = (s) => String(s || '').replace(/\D/g, '');
      const my7 = String(x.phones || '').split(',').map((p) => dig(p).slice(-7)).filter((p) => p.length === 7);
      const ln = norm(x.last);
      const cands = ui.state.contacts.filter((c) => {
        if (ln && norm(c.last_name_en) === ln && (!x.first || norm(c.first_name_en).slice(0, 3) === norm(x.first).slice(0, 3))) return true;
        const p = ui.state.phones.get(String(c.contact_id)) || {};
        return ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].some((k) => my7.includes(dig(p[k]).slice(-7)));
      }).slice(0, 6);
      d.innerHTML = `<button type="button" class="x-close" data-x aria-label="סגירה">✕</button>
        <div class="mx-banner">📦 מהרשימה הישנה</div>
        <h2 dir="ltr" style="text-align:right">${h([x.title, x.first, x.last].filter(Boolean).join(' '))}${x.last_he ? ` <span dir="rtl">· ${h(x.last_he)}</span>` : ''}</h2>
        <p class="muted small" dir="auto">${h([x.address, x.city, x.state, x.zip].filter(Boolean).join(', '))}${x.comments ? ` · ${h(x.comments)}` : ''}</p>
        ${cands.length ? `<h4>אולי הוא כבר במאגר?</h4><div class="mx-cands">${cands.map((c) => `<button type="button" class="mx-old-hit" data-link="${h(c.contact_id)}"><b>${h(ui.fullNameHe(c))}</b> <span class="muted small" dir="ltr">${h([c.first_name_en, c.last_name_en].join(' '))} · ${h(c.address || c.city || '')}</span> — זה הוא</button>`).join('')}</div>` : ''}
        <div class="mx-new"><label>שם פרטי (עברית) <input id="mxp-fhe"></label><label>משפחה (עברית) <input id="mxp-lhe" value="${h(x.last_he)}"></label>
          <label class="check"><input type="checkbox" id="mxp-dead"> נפטר</label></div>
        <div class="actions"><button type="button" class="btn primary" id="mxp-new">➕ ליצור איש קשר ולקשר</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button></div>`;
      d.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => fin(null); });
      d.querySelectorAll('[data-link]').forEach((b) => { b.onclick = async () => { b.disabled = true; await mark(row, b.dataset.link, 'linked'); fin(b.dataset.link); }; });
      d.querySelector('#mxp-new').onclick = async (e) => {
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'שומר…';
        const ph = String(x.phones || '').split(',').map((s) => s.trim()).filter(Boolean);
        const dead = d.querySelector('#mxp-dead').checked;
        const c = { first_name_he: d.querySelector('#mxp-fhe').value.trim(), last_name_he: d.querySelector('#mxp-lhe').value.trim(), first_name_en: x.first, last_name_en: x.last,
          wife_name_en: x.wife, address: dead ? '' : x.address, city: dead ? '' : x.city, state: dead ? '' : x.state, zip: dead ? '' : x.zip, country: dead ? '' : x.country,
          is_alive: dead ? 'FALSE' : true, is_active: true };
        if (ui.state.lists?.title_en?.includes(x.title)) c.title_en = x.title;
        try {
          const id = await saveContact(c, dead ? {} : { home_phone: ph[0] || '', other_phone: ph[1] || '', email_1: x.email || '' });
          await mark(row, id, 'added');
          fin(id);
        } catch (err) { btn.disabled = false; btn.textContent = '➕ ליצור איש קשר ולקשר'; ui.toast(err.message, 'error'); }
      };
    }).catch((err) => { d.innerHTML = `<p class="err">${h(err.message)}</p>`; });
  });
}
