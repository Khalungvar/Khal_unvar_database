// מכון משנה הלכות: די ספרים — מחיר, מבצע (פון/ביז), כרך בודד, מהדורה קודמת, מלאי.
// לשונית Books. דער מלאי = stock_base − וויפל מ'האט פארקויפט (פון די "מכירה" נדבות, קאלום books = JSON [{id, v, q, p}]).
// אזוי ווען מ'מעקט אויס א מכירה קומט דער ספר צוריק אין מלאי, אן קיין באזונדער חשבון.
// v: '' = דער ספר (סט) · 'vol' = כרך בודד · 'old' = מהדורה קודמת (די צוויי — אן מלאי).
import { state, saveRecord, deleteRecord } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, isTrue } from './util.js';
import { imageOf } from './images.js';
import { htmlToJpeg, jpegsToPdf } from './pdf.js';
import { isoToHebrewText, todayIso } from './hebdate.js';

export const BOOKS_ORG = 'מכון משנה הלכות';
const CATS = ['mechon', 'kovetz', 'rabbis', 'other'];
let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const cur = { q: '' };
export function initBooks(helpers) { ui = helpers; }

const today = () => todayIso();
const num = (v) => (v === '' || v == null ? null : Number(v));
const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
// א מבצע אויף דעם גאנצן מכון ווערט געהאלטן אין א שורה פון Books מיט category = '__all__':
// sale_price = פראצענט, vol_price = 1 → ארומרונדן צו א האלבן דאלער, sale_from / sale_to
const ALL = '__all__';
export const globalSale = () => (state.books || []).find((b) => b.category === ALL) || null;
export const allBooks = () => [...(state.books || [])].filter((b) => b.category !== ALL).sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || Number(a.book_id) - Number(b.book_id));
export const bookById = (id) => (state.books || []).find((b) => String(b.book_id) === String(id));
// (די ערשטע בילדער זענען געווען jpg מיט א ווייסן הינטערגרונט — יעצט webp אן הינטערגרונט)
const imgOf = (b) => (imageOf(b.image) || '').replace(/^(img\/books\/\d+)\.jpg$/, '$1.webp');
export const BOOKS_LOGO = 'img/mishne-halachos-logo.png';

/** איז דער מבצע אקטיוו (היינט צווישן פון און ביז; א ליידיגער טאג = אן גרענעץ)? 'on' / 'soon' / 'over' / '' */
export function saleState(b, day = today()) {
  if (num(b.sale_price) == null) return '';
  if (b.sale_from && day < b.sale_from) return 'soon';
  if (b.sale_to && day > b.sale_to) return 'over';
  return 'on';
}
const roundHalf = (v) => Math.round(v * 2) / 2;
/** דער מבצע וואס גילט היינט: פונעם ספר אליין (גייט פאר), אדער פונעם גאנצן מכון (פראצענט) */
export function effSale(b, day = today()) {
  if (saleState(b, day) === 'on') return { on: true, price: Number(b.sale_price), src: 'book' };
  const g = globalSale();
  if (g && saleState(g, day) === 'on' && num(b.price) != null) {
    const raw = Number(b.price) * (1 - (Number(g.sale_price) || 0) / 100);
    return { on: true, price: g.vol_price ? roundHalf(raw) : Math.round(raw * 100) / 100, src: 'all', pct: Number(g.sale_price) };
  }
  return { on: false };
}
/** דער פרייז היינט: פון מבצע אדער דער רעגולערער */
export function priceNow(b, v = '', day = today()) {
  if (v === 'vol') return num(b.vol_price) ?? 0;
  if (v === 'old') return num(b.old_price) ?? 0;
  const e = effSale(b, day);
  return e.on ? e.price : (num(b.price) ?? 0);
}

/** די ספרים פון א מכירה (נדבה) */
export function booksOf(d) {
  try { const v = JSON.parse(String(d?.books || '') || '[]'); return Array.isArray(v) ? v.filter((x) => x && x.id) : []; } catch { return []; }
}
/** וויפל יעדער ספר האט מען פארקויפט (נאר דער ספר אליין, נישט כרך בודד / מהדורה קודמת) */
export function soldMap() {
  const m = new Map();
  (state.donations || []).forEach((d) => booksOf(d).forEach((l) => {
    if (l.v) return;
    m.set(String(l.id), (m.get(String(l.id)) || 0) + (Number(l.q) || 0));
  }));
  return m;
}
/** וויפל מ'האט אראפגענומען פון מלאי אן א קבלה (א מתנה פונעם רבי'ן, געגעבן אן קבלה...) — לשונית BookMoves */
export function givenMap() {
  const m = new Map();
  (state.bookMoves || []).forEach((x) => m.set(String(x.book_id), (m.get(String(x.book_id)) || 0) + (Number(x.qty) || 0)));
  return m;
}
/** פארקויפט + אראפגענומען — וואס איז ארויס פון מלאי */
export function outMap() {
  const m = soldMap();
  givenMap().forEach((v, k) => m.set(k, (m.get(k) || 0) + v));
  return m;
}
/** דער מלאי איצט (null = נאך נישט באשטימט) */
export function stockOf(b, out = outMap()) {
  const base = num(b.stock_base);
  return base == null ? null : base - (out.get(String(b.book_id)) || 0);
}
const varLabel = (v) => (v === 'vol' ? t('bkVol') : v === 'old' ? t('bkOld') : '');
/** "שו"ת משנה הלכות ×2, הגדה של פסח (מהדורה קודמת)" — פאר דער קבלה */
export function booksDesc(lines) {
  return lines.map((l) => {
    const b = bookById(l.id);
    const n = b ? b.name : (l.n || '');
    return `${n}${l.v ? ` (${varLabel(l.v)})` : ''}${Number(l.q) > 1 ? ` ×${l.q}` : ''}`;
  }).filter(Boolean).join(', ');
}

// ---------- אויסקלייבן ספרים אין א מכירה (טופס נדבה / קבלה בודדת) ----------
function optionsHtml(sel) {
  const sold = outMap();
  const opt = (val, label) => `<option value="${h(val)}"${val === sel ? ' selected' : ''}>${h(label)}</option>`;
  return `<option value="">— ${h(t('bkPick'))} —</option>${allBooks().map((b) => {
    const st = stockOf(b, sold);
    const sale = effSale(b).on ? ' 🏷' : '';
    const out = [opt(String(b.book_id), `${b.name} · ${money(priceNow(b))}${sale}${st != null ? (st <= 0 ? ` · ⛔ ${t('bkOutOfStock')}` : ` · ${t('bkStockShort')} ${st}`) : ''}`)];
    if (num(b.vol_price) != null) out.push(opt(`${b.book_id}:vol`, `${b.name} · ${t('bkVol')} · ${money(b.vol_price)}`));
    if (num(b.old_price) != null) out.push(opt(`${b.book_id}:old`, `${b.name} · ${t('bkOld')} · ${money(b.old_price)}`));
    return out.join('');
  }).join('')}`;
}
function lineHtml(l = {}) {
  const val = l.id ? `${l.id}${l.v ? `:${l.v}` : ''}` : '';
  return `<div class="bk-line"><select class="bk-sel">${optionsHtml(val)}</select>
    <input class="bk-q" type="number" min="1" step="1" dir="ltr" value="${h(l.q || 1)}" title="${h(t('bkQty'))}">
    <span class="muted">×</span><span class="bk-pw">$<input class="bk-p" type="number" min="0" step="0.01" dir="ltr" value="${h(l.p ?? '')}"></span>
    <b class="bk-sum" dir="ltr"></b><button type="button" class="linkish bk-rm" title="✕">✕</button></div>`;
}
export function bookPickerHtml(lines = []) {
  if (!(state.books || []).length) return '';
  return `<div class="bk-pick"><b class="bk-pick-h">📚 ${h(t('bkPickTitle'))}</b>
    <div class="bk-lines">${(lines.length ? lines : []).map(lineHtml).join('')}</div>
    <button type="button" class="linkish bk-add">＋ ${h(t('bkAddLine'))}</button></div>`;
}
export function readBookPicker(root) {
  return $$('.bk-line', root).map((r) => {
    const [id, v = ''] = $('.bk-sel', r).value.split(':');
    return { id, v, q: Math.max(1, Math.round(Number($('.bk-q', r).value) || 1)), p: Number($('.bk-p', r).value) || 0 };
  }).filter((l) => l.id);
}
/** onChange(lines, total, desc) — ווען עפעס האט זיך געטוישט */
export function wireBookPicker(root, onChange) {
  const box = $('.bk-pick', root);
  if (!box) return;
  const sold = outMap();
  const refresh = () => {
    $$('.bk-line', box).forEach((r) => {
      const [id, v = ''] = $('.bk-sel', r).value.split(':');
      const q = Number($('.bk-q', r).value) || 0;
      $('.bk-sum', r).textContent = id ? money(q * (Number($('.bk-p', r).value) || 0)) : '';
      const b = id && !v ? bookById(id) : null;
      const st = b ? stockOf(b, sold) : null;
      r.classList.toggle('bk-low', st != null && q > st);
    });
    const lines = readBookPicker(box);
    onChange(lines, Math.round(lines.reduce((s, l) => s + l.q * l.p, 0) * 100) / 100, booksDesc(lines));
  };
  box.addEventListener('click', (e) => {
    if (e.target.closest('.bk-add')) { $('.bk-lines', box).insertAdjacentHTML('beforeend', lineHtml()); $('.bk-line:last-child .bk-sel', box).focus(); return; }
    const rm = e.target.closest('.bk-rm');
    if (rm) { rm.closest('.bk-line').remove(); refresh(); }
  });
  box.addEventListener('change', (e) => {
    const sel = e.target.closest('.bk-sel');
    if (sel) {
      const [id, v = ''] = sel.value.split(':');
      const b = bookById(id);
      $('.bk-p', sel.closest('.bk-line')).value = b ? priceNow(b, v) : '';
    }
    refresh();
  });
  box.addEventListener('input', (e) => { if (e.target.closest('.bk-q, .bk-p')) refresh(); });
  if (!$('.bk-line', box)) $('.bk-lines', box).insertAdjacentHTML('beforeend', lineHtml());
  else refresh();
}

// ---------- דער בלאט ----------
export function openBooks() { ui.showView('books'); }

const SALE_TXT = { on: 'bkSaleOn', soon: 'bkSaleSoon', over: 'bkSaleOver' };
const shortDate = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[2])}/${Number(m[3])}` : ''; };
function bookCard(b, sold, out, given) {
  const st = stockOf(b, out);
  const s = saleState(b);
  const e = effSale(b);
  const n = sold.get(String(b.book_id)) || 0;
  const g = given.get(String(b.book_id)) || 0;
  const img = imgOf(b);
  const id = h(b.book_id);
  const extras = [num(b.vol_price) != null ? `${t('bkVol')} ${money(b.vol_price)}` : '', num(b.old_price) != null ? `${t('bkOld')} ${money(b.old_price)}` : ''].filter(Boolean);
  const range = [shortDate(b.sale_from), shortDate(b.sale_to)].filter(Boolean).join('–');
  const gone = st != null && st <= 0;
  return `<div class="bk-card${e.on ? ' bk-onsale' : ''}${gone ? ' bk-gone' : ''}" data-id="${id}">
    <div class="bk-img">${img ? `<img src="${h(img)}" alt="" loading="lazy">` : '<span class="bk-noimg">📖</span>'}</div>
    <div class="bk-body">
      <div class="bk-title"><b>${h(b.name)}</b>${num(b.old_price) != null ? ` <span class="bk-new" title="${h(t('bkNewEd'))}">✱</span>` : ''}
        ${gone ? `<span class="bk-oos">${h(t('bkOutOfStock'))}</span>` : ''}<button type="button" class="linkish bk-edbtn" data-edit="${id}" title="${h(t('bkEdit'))}">✎</button></div>
      ${b.subtitle || Number(b.volumes) > 1 ? `<div class="muted small bk-sub">${h([b.subtitle, Number(b.volumes) > 1 && !/כרכים|חלקים/.test(b.subtitle || '') ? t('bkVolsN', { n: b.volumes }) : ''].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="bk-nums">
        <label>${h(t('bkPrice'))}<span class="bk-money">$<input type="number" min="0" step="0.01" dir="ltr" data-f="price" value="${h(b.price ?? '')}"></span>
          ${e.on ? `<span class="bk-now">${h(t('bkNow'))} <b>${money(e.price)}</b>${e.src === 'all' ? ` (−${e.pct}%)` : ''}</span>` : ''}</label>
        <label>${h(t('bkStock'))}<input type="number" step="1" dir="ltr" data-f="stock" value="${st == null ? '' : st}" placeholder="—" class="bk-stockin${st != null && st <= 0 ? ' bk-zero' : ''}"></label>
        <div class="bk-out">
          <button type="button" class="bk-soldbtn" data-hist="${id}" title="${h(t('bkHist'))}">${h(t('bkSoldBtn', { n }))}${g ? ` · 🎁${g}` : ''}</button>
          <span class="bk-outrow"><button type="button" class="bk-minus" data-give="${id}" title="${h(t('bkGiveTitle'))}">➖ ${h(t('bkGiveShort'))}</button>
            <button type="button" class="bk-listbtn" data-hist="${id}" title="${h(t('bkHist'))}">📋</button></span>
        </div>
      </div>
      <div class="bk-foot">
        <button type="button" class="bk-salebtn${s ? ` bk-s-${s}` : ''}" data-sale="${id}" title="${h(s ? t(SALE_TXT[s]) : t('bkSaleAdd'))}">🏷 ${s ? `${money(b.sale_price)}${range ? ` <span dir="ltr">${h(range)}</span>` : ''}` : h(t('bkSaleAdd'))}</button>
      </div>
      ${extras.length ? `<div class="muted small bk-extras">${h(extras.join(' · '))}</div>` : ''}
    </div></div>`;
}

// ---------- 📄 מחירון (PDF) לויט א טאג — למשל צו זען ווי א מבצע וועט אויסזען ----------
function pdfDialog() {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet bk-saledlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>📄 ${h(t('bkPdf'))}</h2>
    <p class="muted small">${h(t('bkPdfHint'))}</p>
    <form class="bk-pdfform">
      <label>${h(t('bkPdfDate'))}<input name="day" type="date" value="${today()}" required></label>
      <label class="check"><input type="checkbox" name="imgs" checked> ${h(t('bkPdfImgs'))}</label>
      <div class="actions"><span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">⬇ ${h(t('bkPdfMake'))}</button></div>
    </form>`;
  const form = $('form', dlg);
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    btn.disabled = true; btn.textContent = t('bkPdfWorking');
    try { await makePricePdf(form.elements.day.value || today(), form.elements.imgs.checked); dlg.close(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; btn.textContent = `⬇ ${t('bkPdfMake')}`; }
  };
  dlg.showModal();
}

const fmtUs = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : ''; };
async function makePricePdf(day, withImgs) {
  const det = (state.orgDetails || []).find((o) => o.org === BOOKS_ORG) || {};
  const books = allBooks();
  const anySale = books.some((b) => effSale(b, day).on);
  const G = globalSale();
  const gOn = G && saleState(G, day) === 'on';
  const he = isoToHebrewText(day) || '';
  // שורות: א קעפל פאר יעדן סארט, דערנאך די ספרים
  const items = [];
  CATS.forEach((c) => {
    const l = books.filter((b) => (CATS.includes(b.category) ? b.category : 'other') === c);
    if (!l.length) return;
    items.push({ head: t(`bkCat_${c}`) });
    l.forEach((b) => items.push({ b }));
  });
  const rowH = withImgs ? 0.5 : 0.34;
  const pages = [];
  let curP = []; let used = 0;
  items.forEach((it) => {
    const cap = 8.45 - (pages.length || !gOn ? 0 : 0.35);
    const hgt = it.head ? 0.45 : rowH;
    if (used + hgt > cap || (it.head && used + hgt + rowH > cap)) { pages.push(curP); curP = []; used = 0; }
    curP.push(it); used += hgt;
  });
  if (curP.length) pages.push(curP);
  const cols = 3 + (withImgs ? 1 : 0) + (anySale ? 1 : 0);
  const row = (it) => {
    if (it.head) return `<tr class="pp-cat"><td colspan="${cols}">${h(it.head)}</td></tr>`;
    const { b } = it;
    const e = effSale(b, day);
    const ex = [num(b.vol_price) != null ? `${t('bkVol')} ${money(b.vol_price)}` : '', num(b.old_price) != null ? `${t('bkOld')} ${money(b.old_price)}` : ''].filter(Boolean).join(' · ');
    const img = imgOf(b);
    const st = stockOf(b);
    const gone = st != null && st <= 0;
    return `<tr class="${gone ? 'pp-gone' : ''}">${withImgs ? `<td class="pp-img">${img ? `<img src="${h(img)}">` : ''}</td>` : ''}
      <td class="pp-name"><b>${h(b.name)}</b>${num(b.old_price) != null ? ' <span class="pp-star">✱</span>' : ''}${b.subtitle ? `<div class="pp-sub">${h(b.subtitle)}</div>` : ''}</td>
      <td class="pp-ex">${gone ? `<div class="pp-oos">${h(t('bkOutOfStock'))}</div>` : ''}${h(ex)}</td>
      <td class="pp-price${e.on ? ' pp-was' : ''}">${num(b.price) != null ? money(b.price) : ''}</td>
      ${anySale ? `<td class="pp-sale">${e.on ? `${money(e.price)}${e.src === 'all' ? `<div class="pp-pct">−${e.pct}%</div>` : ''}` : ''}</td>` : ''}</tr>`;
  };
  const css = `<style>.pp{width:8.5in;height:11in;box-sizing:border-box;padding:0.45in 0.5in;font-family:'Frank Ruhl Libre',serif;color:#2b2118;direction:rtl;position:relative;background:#fff}
    .pp-top{display:flex;align-items:center;gap:16px;border-bottom:2px solid #7a1219;padding-bottom:8px;margin-bottom:6px}
    .pp-top img{height:62px}.pp-top h1{margin:0;font-size:24pt;color:#7a1219}.pp-top .pp-d{margin-inline-start:auto;text-align:left;font-size:11pt;color:#5a4a3a;line-height:1.4}
    .pp-note{background:#eaf6ed;color:#1f6b35;border-radius:6px;padding:4px 10px;font-size:11pt;margin:6px 0;font-weight:bold}
    .pp table{width:100%;border-collapse:collapse;font-size:12pt}.pp th{font-size:9pt;color:#7a6a5c;text-align:right;border-bottom:1px solid #d9c9a3;padding:2px 6px;font-weight:normal}
    .pp td{border-bottom:1px dotted #d9c9a3;padding:0 6px;box-sizing:border-box;vertical-align:middle;height:${rowH}in}
    .pp-cat td{border:0;height:auto;padding:10px 4px 3px;font-size:13pt;font-weight:bold;color:#7a1219}
    .pp-img{width:0.55in;text-align:center}.pp-img img{max-height:${rowH - 0.06}in;max-width:0.5in;display:block;margin:auto}
    .pp-sub{font-size:9pt;color:#7a6a5c}.pp-star{color:#b8860b}.pp-ex{font-size:9pt;color:#6b5a3a;width:1.6in}
    .pp-price,.pp-sale{text-align:left;direction:ltr;width:0.85in;font-weight:bold;white-space:nowrap}.pp-was{text-decoration:line-through;color:#999;font-weight:normal}
    .pp-sale{color:#1f6b35}.pp-oos{color:#b3261e;font-weight:bold;font-size:11pt}.pp-gone .pp-img img{opacity:.45}.pp-gone .pp-name b{color:#8a7f74}.pp-pct{font-size:8pt;font-weight:normal}
    .pp-foot{position:absolute;bottom:0.35in;left:0.5in;right:0.5in;display:flex;justify-content:space-between;font-size:9pt;color:#7a6a5c;border-top:1px solid #d9c9a3;padding-top:4px}</style>`;
  const contact = [det.phone, det.email, det.website].filter(Boolean).join(' · ');
  const jpgs = [];
  for (const [i, pg] of pages.entries()) {
    const html = `${css}<div class="pp">
      <div class="pp-top"><img src="${BOOKS_LOGO}"><div><h1>${h(t('bkPdfTitle'))}</h1><div>${h(BOOKS_ORG)}</div></div>
        <div class="pp-d">${h(t('bkPdfAsOf'))} <b dir="ltr">${h(fmtUs(day))}</b><br>${h(he)}</div></div>
      ${i === 0 && gOn ? `<div class="pp-note">🏷 ${h(t('bkAllSale'))} −${h(G.sale_price)}%${G.sale_to ? ` · ${h(t('bkTo'))} ${h(fmtUs(G.sale_to))}` : ''}</div>` : ''}
      <table><thead><tr>${withImgs ? '<th></th>' : ''}<th>${h(t('bkName'))}</th><th></th><th style="text-align:left">${h(t('bkPrice'))}</th>${anySale ? `<th style="text-align:left">${h(t('bkSale'))}</th>` : ''}</tr></thead>
      <tbody>${pg.map(row).join('')}</tbody></table>
      <div class="pp-foot"><span>✱ ${h(t('bkNewEd'))}${contact ? ` · <span dir="ltr">${h(contact)}</span>` : ''}</span><span dir="ltr">${pages.length > 1 ? `${i + 1} / ${pages.length}` : ''}</span></div></div>`;
    jpgs.push(await htmlToJpeg(html, { widthIn: 8.5, heightIn: 11, scale: 2, quality: 0.9 }));
  }
  const pdf = jpegsToPdf(jpgs, { margin: 0 });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  a.download = `${BOOKS_ORG} - ${t('bkPdfTitle')} ${day}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** 🏷 א מבצע אויף דעם גאנצן מכון: פראצענט, ארומרונדן צו א האלבן דאלער, פון / ביז */
function allSaleDialog() {
  const G = globalSale();
  const gs = G ? saleState(G) : '';
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet bk-saledlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>🏷 ${h(t('bkAllSale'))}</h2>
    <p class="muted small">${h(t('bkAllSaleHint'))}${gs ? ` · <span class="bk-badge bk-${gs}">${h(t(SALE_TXT[gs]))}</span>` : ''}</p>
    <form class="bk-allform">
      <div class="grid">
        <label>${h(t('bkPct'))} *<input name="pct" type="number" min="1" max="99" step="0.5" dir="ltr" value="${h(G?.sale_price ?? '')}" required></label>
        <label>${h(t('bkFrom'))}<input name="from" type="date" value="${h(G?.sale_from || today())}"></label>
        <label>${h(t('bkTo'))}<input name="to" type="date" value="${h(G?.sale_to || '')}"></label>
      </div>
      <label class="check"><input type="checkbox" name="round"${!G || G.vol_price ? ' checked' : ''}> ${h(t('bkRoundHalf'))}</label>
      <div class="bk-allprev muted small"></div>
      <div class="actions">${G ? `<button type="button" class="btn danger" id="bk-all-del">✕ ${h(t('bkSaleClear'))}</button>` : ''}<span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>
    </form>`;
  const form = $('form', dlg);
  const el = (n) => form.elements[n];
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  const prev = () => {
    const pct = Number(el('pct').value) || 0;
    const ex = allBooks().filter((b) => num(b.price) != null).slice(0, 3).map((b) => {
      const raw = Number(b.price) * (1 - pct / 100);
      return `${b.name}: ${money(b.price)} → ${money(el('round').checked ? roundHalf(raw) : Math.round(raw * 100) / 100)}`;
    });
    $('.bk-allprev', dlg).innerHTML = pct ? ex.map((x) => `<div>${h(x)}</div>`).join('') : '';
  };
  el('pct').oninput = prev; el('round').onchange = prev; prev();
  const del = $('#bk-all-del', dlg);
  if (del) {
    del.onclick = async () => {
      try {
        await deleteRecord('Books', 'book_id', G);
        state.books = state.books.filter((x) => x !== G);
        dlg.close(); renderBooks(); ui.toast(t('bkSaved'));
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const pct = Number(el('pct').value);
    if (!(pct > 0 && pct < 100)) { el('pct').focus(); return; }
    const from = el('from').value; const to = el('to').value;
    if (from && to && from > to) { ui.toast(t('bkDatesBad'), 'error'); el('to').focus(); return; }
    dlg.close();
    await saveBook({ ...(G || {}), category: ALL, name: t('bkAllSale'), sale_price: pct, vol_price: el('round').checked ? 1 : '', sale_from: from, sale_to: to, sort: 99999 });
  };
  dlg.showModal();
  el('pct').focus();
}

/** דער מבצע פון א ספר: פרייז, פון, ביז — און אויסמעקן */
function saleDialog(b) {
  const has = num(b.sale_price) != null;
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet bk-saledlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const s = saleState(b);
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>🏷 ${h(t('bkSale'))} · ${h(b.name)}</h2>
    <p class="muted small">${h(t('bkPrice'))}: ${money(b.price)}${s ? ` · <span class="bk-badge bk-${s}">${h(t(SALE_TXT[s]))}</span>` : ''}</p>
    <form class="bk-saleform">
      <div class="grid">
        <label>${h(t('bkSalePrice'))} *<input name="sp" type="number" min="0" step="0.01" dir="ltr" value="${h(b.sale_price ?? '')}" required></label>
        <label>${h(t('bkFrom'))}<input name="from" type="date" value="${h(b.sale_from || today())}"></label>
        <label>${h(t('bkTo'))}<input name="to" type="date" value="${h(b.sale_to || '')}"></label>
      </div>
      <div class="actions">${has ? `<button type="button" class="btn danger" id="bk-sale-del">✕ ${h(t('bkSaleClear'))}</button>` : ''}<span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>
    </form>`;
  const form = $('form', dlg);
  const el = (n) => form.elements[n];
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  const del = $('#bk-sale-del', dlg);
  if (del) del.onclick = async () => { dlg.close(); await saveBook({ ...b, sale_price: '', sale_from: '', sale_to: '' }); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const from = el('from').value; const to = el('to').value;
    if (from && to && from > to) { ui.toast(t('bkDatesBad'), 'error'); el('to').focus(); return; }
    dlg.close();
    await saveBook({ ...b, sale_price: Number(el('sp').value), sale_from: from, sale_to: to });
  };
  dlg.showModal();
  el('sp').focus();
}

export function renderBooks() {
  const main = $('#books-main');
  if (!main) return;
  const sold = soldMap();
  const given = givenMap();
  const out = outMap();
  const q = cur.q.trim();
  const list = allBooks().filter((b) => !q || `${b.name} ${b.subtitle} ${b.notes}`.includes(q));
  const groups = CATS.map((c) => [c, list.filter((b) => (CATS.includes(b.category) ? b.category : 'other') === c)]).filter(([, l]) => l.length);
  const onSale = list.filter((b) => effSale(b).on).length;
  const G = globalSale();
  const gs = G ? saleState(G) : '';
  const sales = (state.donations || []).filter((d) => booksOf(d).length);
  main.innerHTML = `<div class="sc-head bk-head">
      <img class="bk-logo" src="${BOOKS_LOGO}" alt="">
      <div><h1>${h(BOOKS_ORG)}</h1><p class="muted small">${h(t('bkSub', { n: allBooks().length }))}${onSale ? ` · 🏷 ${h(t('bkOnSaleN', { n: onSale }))}` : ''}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn" id="bk-back">← ${h(t('lobbyBack'))}</button>
    </div>
    <div class="bk-bar">
      <button type="button" class="btn primary" id="bk-sell">🧾 ${h(t('bkSell'))}</button>
      <button type="button" class="btn" id="bk-new">＋ ${h(t('bkNew'))}</button>
      <button type="button" class="btn" id="bk-pdf">📄 ${h(t('bkPdf'))}</button>
      <button type="button" class="btn bk-allsale${gs ? ` bk-s-${gs}` : ''}" id="bk-allsale" title="${h(gs ? t(SALE_TXT[gs]) : t('bkAllSale'))}">🏷 ${G ? `${h(t('bkAllSale'))} −${h(G.sale_price)}%${[shortDate(G.sale_from), shortDate(G.sale_to)].filter(Boolean).length ? ` <span dir="ltr">${h([shortDate(G.sale_from), shortDate(G.sale_to)].filter(Boolean).join('–'))}</span>` : ''}` : h(t('bkAllSale'))}</button>
      <input type="search" id="bk-q" placeholder="🔍 ${h(t('bkSearch'))}" value="${h(cur.q)}">
      <span class="spacer"></span>
      <span class="muted small">${h(t('bkSalesN', { n: sales.length }))}</span>
    </div>
    <p class="muted small bk-hint">${h(t('bkHint'))}</p>
    ${groups.map(([c, l]) => `<h3 class="bk-group">${h(t(`bkCat_${c}`))}</h3>
      <div class="bk-grid">${l.map((b) => bookCard(b, sold, out, given)).join('')}</div>`).join('') || `<p class="muted">${h(t('noResults'))}</p>`}`;
  $('#bk-back').onclick = () => ui.showView('lobby');
  $('#bk-new').onclick = () => editBook({});
  $('#bk-allsale').onclick = () => allSaleDialog();
  $('#bk-pdf').onclick = () => pdfDialog();
  $('#bk-sell').onclick = () => {
    ui.quickSale(BOOKS_ORG, () => renderBooks());
    // ווען דער דיאלאג מאכט זיך צו — דער מלאי איז שוין אנדערש
    document.querySelector('dialog.rq-dlg[open]')?.addEventListener('close', () => setTimeout(renderBooks, 50));
  };
  $('#bk-q').oninput = (e) => {
    cur.q = e.target.value;
    const pos = e.target.selectionStart;
    renderBooks();
    const qi = $('#bk-q'); qi.focus(); qi.setSelectionRange(pos, pos);
  };
  main.onclick = (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) { editBook(bookById(ed.dataset.edit) || {}); return; }
    const gv = e.target.closest('[data-give]');
    if (gv) { const b = bookById(gv.dataset.give); if (b) giveDialog(b); return; }
    const hs = e.target.closest('[data-hist]');
    if (hs) { const b = bookById(hs.dataset.hist); if (b) histDialog(b); return; }
    const sb = e.target.closest('[data-sale]');
    if (sb) { const b = bookById(sb.dataset.sale); if (b) saleDialog(b); }
  };
  main.onfocusout = (e) => {
    if (pendingRender && !e.relatedTarget?.matches?.('#books-main [data-f]')) { pendingRender = false; setTimeout(renderBooks, 0); }
  };
  main.onchange = (e) => {
    const inp = e.target.closest('[data-f]');
    if (!inp) return;
    const b = bookById(inp.closest('[data-id]').dataset.id);
    if (!b) return;
    const f = inp.dataset.f;
    const v = inp.value.trim();
    // דער גבאי שרייבט וויפל עס איז דא איצט → stock_base = דאס + וויפל מ'האט שוין פארקויפט
    const patch = f === 'stock' ? { stock_base: v === '' ? '' : Math.round(Number(v)) + (outMap().get(String(b.book_id)) || 0) } : { [f]: v === '' ? '' : Number(v) };
    // גלייך אין state (אז א צווייטע ענדערונג אינעם זעלבן ספר זאל נישט צוריקשרייבן די ערשטע); דאס שפייכלערן — איינס נאך דאס אנדערע
    Object.assign(b, patch);
    saveBook(b, { inline: true });
  };
}

const REASONS = ['bkWhyGift', 'bkWhyNoRc', 'bkWhyOther'];
function newDlg(cls, html) {
  const dlg = document.createElement('dialog');
  dlg.className = `sheet ${cls}`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>${html}`;
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  return dlg;
}
/** ➖ אראפנעמען פון מלאי אן א קבלה */
function giveDialog(b) {
  const st = stockOf(b);
  const dlg = newDlg('bk-givedlg', `<h2>➖ ${h(t('bkGiveTitle'))} · ${h(b.name)}</h2>
    ${st != null ? `<p class="muted small">${h(t('bkStock'))}: ${st}</p>` : ''}
    <form class="bk-giveform" autocomplete="off">
      <div class="grid">
        <label>${h(t('bkQty'))} *<input name="qty" type="number" min="1" step="1" dir="ltr" value="1" required></label>
        <label>${h(t('dateLegend'))}<input name="date" type="date" value="${today()}"></label>
      </div>
      <label class="wide">${h(t('bkWhy'))}<select name="reason">${REASONS.map((r) => `<option value="${h(t(r))}">${h(t(r))}</option>`).join('')}</select></label>
      <label class="wide">${h(t('bkToWhom'))}<input name="to" dir="auto"></label>
      <label class="wide">${h(t('bkNotes'))}<input name="note" dir="auto"></label>
      <div class="actions"><span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>
    </form>`);
  const form = $('form', dlg);
  const el = (n) => form.elements[n];
  form.onsubmit = async (e) => {
    e.preventDefault();
    const qty = Math.round(Number(el('qty').value) || 0);
    if (qty < 1) { el('qty').focus(); return; }
    const btn = $('button[type=submit]', form); btn.disabled = true;
    const rec = { book_id: b.book_id, date: el('date').value || today(), qty, reason: el('reason').value, to_name: el('to').value.trim(), note: el('note').value.trim() };
    try {
      const id = await saveRecord('BookMoves', 'move_id', rec);
      (state.bookMoves ||= []).push({ ...rec, move_id: id });
      dlg.close(); ui.toast(t('bkSaved')); renderBooks();
    } catch (err) { btn.disabled = false; ui.toast(ui.friendlyError(err), 'error'); }
  };
  dlg.showModal();
  el('qty').select();
}

/** 📋 די רשימה: ווען, וויפל, צו וועמען — א מכירה מיט א לינק צו דער קבלה */
function histDialog(b) {
  const bid = String(b.book_id);
  const rcOf = (d) => (state.receipts || []).find((r) => !isTrue(r.void) && String(r.donation_ids || '').split(',').includes(String(d.donation_id)));
  const rows = [];
  (state.donations || []).forEach((d) => booksOf(d).forEach((l) => {
    if (String(l.id) !== bid) return;
    const ct = d.contact_id ? ui.contactById(d.contact_id) : null;
    rows.push({ date: String(d.paid_date || d.date || '').slice(0, 10), qty: Number(l.q) || 0, what: `${t('bkSold')}${l.v ? ` · ${varLabel(l.v)}` : ''}`, who: ct ? ui.fullNameHe(ct) : (d.donor_name || ''), d, rc: rcOf(d), price: Number(l.p) || 0 });
  }));
  (state.bookMoves || []).filter((x) => String(x.book_id) === bid).forEach((x) => rows.push({ date: x.date, qty: Number(x.qty) || 0, what: x.reason || t('bkGive'), who: x.to_name || '', note: x.note, move: x }));
  rows.sort((a, c) => String(c.date).localeCompare(String(a.date)));
  const tot = (f) => rows.filter(f).reduce((s, r) => s + r.qty, 0);
  const fmtDate = (iso) => { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}/${Number(m[2])}/${m[1]}` : iso; };
  const dlg = newDlg('bk-histdlg', `<h2>📋 ${h(b.name)}</h2>
    <p class="muted small">${h(t('bkSoldN', { n: tot((r) => r.d) }))} · ${h(t('bkGivenN', { n: tot((r) => r.move) }))}${stockOf(b) != null ? ` · ${h(t('bkStock'))}: ${stockOf(b)}` : ''}</p>
    ${rows.length ? `<table class="bk-hist no-sort"><thead><tr><th>${h(t('dateLegend'))}</th><th>${h(t('bkQty'))}</th><th></th><th>${h(t('bkToWhom'))}</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr class="${r.move ? 'bk-h-give' : 'bk-h-sale'}"><td dir="ltr">${h(fmtDate(r.date))}</td><td class="bk-h-q">${r.qty}</td>
        <td>${h(r.what)}${r.d ? ` <span class="muted small" dir="ltr">${h(money(r.price))}</span>` : ''}</td>
        <td>${h(r.who)}${r.note ? ` <span class="muted small">· ${h(r.note)}</span>` : ''}</td>
        <td class="bk-h-act">${r.d ? `<button type="button" class="linkish" data-rc="${i}">🧾 ${r.rc ? `#${h(r.rc.receipt_no)}` : h(t('bkMakeRc'))}</button>
          <button type="button" class="linkish bk-h-cancel" data-cancel="${i}" title="${h(t('bkCancelSale'))}">✕ ${h(t('bkCancelSale'))}</button>` : `<button type="button" class="linkish" data-undo="${i}" title="${h(t('deleteBtn'))}">✕</button>`}</td></tr>`).join('')}
      </tbody></table>` : `<p class="muted">${h(t('bkHistNone'))}</p>`}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`);
  dlg.onclick = async (e) => {
    const rc = e.target.closest('[data-rc]');
    if (rc) { const r = rows[Number(rc.dataset.rc)]; dlg.close(); ui.receiptFor(r.d); return; }
    const cn = e.target.closest('[data-cancel]');
    if (cn) {
      const r = rows[Number(cn.dataset.cancel)];
      const ids = r.rc ? String(r.rc.donation_ids || '').split(',').filter(Boolean) : [String(r.d.donation_id)];
      const list = ids.map((x) => (state.donations || []).find((d) => String(d.donation_id) === x)).filter(Boolean);
      const done = await ui.cancelDoc({ receipt_no: r.rc ? r.rc.receipt_no : '', kind: r.rc ? r.rc.kind : 'receipt', contact_id: r.d.contact_id, donor_name: r.d.donor_name, list });
      if (done) { dlg.close(); renderBooks(); }
      return;
    }
    const un = e.target.closest('[data-undo]');
    if (un) {
      const r = rows[Number(un.dataset.undo)];
      if (!confirm(t('bkUndoAsk', { n: r.qty }))) return;
      try {
        await deleteRecord('BookMoves', 'move_id', r.move);
        state.bookMoves = state.bookMoves.filter((x) => x !== r.move);
        dlg.close(); renderBooks(); histDialog(b);
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    }
  };
  dlg.showModal();
}

let saving = Promise.resolve();
let pendingRender = false;
function saveBook(rec, { inline = false } = {}) {
  // איינס נאך דאס אנדערע (א שנעלער טאב פון פעלד צו פעלד)
  saving = saving.then(async () => {
    if (inline) rec = bookById(rec.book_id) || rec; // די לעצטע ווערטן (אויך פון א צווייטער ענדערונג)
    try {
      if (/^img\/books\/\d+\.jpg$/.test(String(rec.image || ''))) rec = { ...rec, image: rec.image.replace(/\.jpg$/, '.webp') };
      const id = await saveRecord('Books', 'book_id', { ...rec });
      const i = state.books.findIndex((x) => String(x.book_id) === String(id));
      const fresh = { ...rec, book_id: id };
      if (i >= 0) state.books[i] = { ...state.books[i], ...fresh }; else state.books.push(fresh);
      ui.toast(t('bkSaved'));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    // מ'שרייבט שוין אינעם קומענדיגן פעלד — נישט איבערבויען (עס וואלט אויסגעמעקט וואס מ'שרייבט)
    const busy = inline && document.activeElement?.matches?.('#books-main [data-f]');
    if (!busy) renderBooks(); else pendingRender = true;
  });
  return saving;
}

// ---------- א ספר: נייער / טוישן ----------
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 360 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    // אן הינטערגרונט (א PNG מיט א דורכזיכטיגן הינטערגרונט בלייבט אזוי)
    const webp = c.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

function editBook(b0) {
  const b = { category: 'mechon', volumes: 1, ...b0 };
  const isNew = !b.book_id;
  let image = b.image || '';
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet bk-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const v = (k) => h(b[k] ?? '');
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>📚 ${h(isNew ? t('bkNew') : t('bkEdit'))}</h2>
    <form class="bk-form" autocomplete="off">
      <div class="bk-form-top">
        <div class="bk-imgbox"><div class="bk-imgprev">${imgOf({ image }) ? `<img src="${h(imgOf({ image }))}" alt="">` : '📖'}</div>
          <label class="btn small-btn">🖼 ${h(t('bkImg'))}<input type="file" accept="image/*" hidden name="img"></label>
          <button type="button" class="linkish bk-imgdel"${image ? '' : ' hidden'}>✕ ${h(t('bkImgDel'))}</button></div>
        <div class="bk-form-fields">
          <label class="wide">${h(t('bkName'))} *<input name="name" value="${v('name')}" required dir="rtl"></label>
          <label class="wide">${h(t('bkSubtitle'))}<input name="subtitle" value="${v('subtitle')}" dir="rtl"></label>
          <div class="grid">
            <label>${h(t('bkVolumes'))}<input name="volumes" type="number" min="1" step="1" dir="ltr" value="${v('volumes')}"></label>
            <label>${h(t('bkCategory'))}<select name="category">${CATS.map((c) => `<option value="${c}"${(b.category || 'other') === c ? ' selected' : ''}>${h(t(`bkCat_${c}`))}</option>`).join('')}</select></label>
          </div>
        </div>
      </div>
      <div class="grid">
        <label>${h(t('bkPrice'))} *<input name="price" type="number" min="0" step="0.01" dir="ltr" value="${v('price')}" required></label>
        <label>${h(t('bkVolPrice'))}<input name="vol_price" type="number" min="0" step="0.01" dir="ltr" value="${v('vol_price')}" placeholder="—"></label>
        <label>${h(t('bkOldPrice'))}<input name="old_price" type="number" min="0" step="0.01" dir="ltr" value="${v('old_price')}" placeholder="—"></label>
        <label>${h(t('bkSortN'))}<input name="sort" type="number" step="1" dir="ltr" value="${v('sort')}"></label>
      </div>
      <label class="wide">${h(t('bkNotes'))}<input name="notes" value="${v('notes')}" dir="auto"></label>
      <p class="muted small">${h(t('bkFormHint'))}</p>
      <div class="actions">${isNew ? '' : `<button type="button" class="btn danger" id="bk-del">🗑 ${h(t('deleteBtn'))}</button>`}<span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>
    </form>`;
  const form = $('form', dlg);
  const el = (n) => form.elements[n];
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  el('img').onchange = async () => {
    const f = el('img').files[0];
    if (!f) return;
    try {
      image = await shrinkImage(f);
      $('.bk-imgprev', dlg).innerHTML = `<img src="${h(image)}" alt="">`;
      $('.bk-imgdel', dlg).hidden = false;
    } catch { ui.toast(t('bkImgBad'), 'error'); }
  };
  $('.bk-imgdel', dlg).onclick = () => { image = ''; $('.bk-imgprev', dlg).textContent = '📖'; $('.bk-imgdel', dlg).hidden = true; };
  const del = $('#bk-del', dlg);
  if (del) {
    del.onclick = async () => {
      const sold = soldMap().get(String(b.book_id)) || 0;
      if (!confirm(sold ? t('bkDelSold', { name: b.name, n: sold }) : t('bkDelAsk', { name: b.name }))) return;
      try {
        await deleteRecord('Books', 'book_id', b);
        state.books = state.books.filter((x) => String(x.book_id) !== String(b.book_id));
        dlg.close(); renderBooks(); ui.toast(t('bkDeleted'));
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const n = (k) => (el(k).value.trim() === '' ? '' : Number(el(k).value));
    const maxSort = Math.max(0, ...allBooks().map((x) => Number(x.sort) || 0));
    const rec = { ...b, name: el('name').value.trim(), subtitle: el('subtitle').value.trim(), volumes: n('volumes') || 1, category: el('category').value,
      price: n('price'), vol_price: n('vol_price'), old_price: n('old_price'), notes: el('notes').value.trim(), image,
      sort: n('sort') === '' ? (isNew ? maxSort + 1 : b.sort) : n('sort') };
    if (!rec.name) { el('name').focus(); return; }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    await saveBook(rec);
    dlg.close();
  };
  dlg.showModal();
  el('name').focus();
}
