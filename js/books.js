// מכון משנה הלכות: די ספרים — מחיר, מבצע (פון/ביז), כרך בודד, מהדורה קודמת, מלאי.
// לשונית Books. דער מלאי = stock_base − וויפל מ'האט פארקויפט (פון די "מכירה" נדבות, קאלום books = JSON [{id, v, q, p}]).
// אזוי ווען מ'מעקט אויס א מכירה קומט דער ספר צוריק אין מלאי, אן קיין באזונדער חשבון.
// v: '' = דער ספר (סט) · 'vol' = כרך בודד · 'old' = מהדורה קודמת (די צוויי — אן מלאי).
import { state, saveRecord, deleteRecord } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h } from './util.js';
import { imageOf } from './images.js';

export const BOOKS_ORG = 'מכון משנה הלכות';
const CATS = ['mechon', 'kovetz', 'rabbis', 'other'];
let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const cur = { q: '' };
export function initBooks(helpers) { ui = helpers; }

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v === '' || v == null ? null : Number(v));
const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const allBooks = () => [...(state.books || [])].sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || Number(a.book_id) - Number(b.book_id));
export const bookById = (id) => (state.books || []).find((b) => String(b.book_id) === String(id));
const imgOf = (b) => imageOf(b.image) || '';

/** איז דער מבצע אקטיוו (היינט צווישן פון און ביז; א ליידיגער טאג = אן גרענעץ)? 'on' / 'soon' / 'over' / '' */
export function saleState(b, day = today()) {
  if (num(b.sale_price) == null) return '';
  if (b.sale_from && day < b.sale_from) return 'soon';
  if (b.sale_to && day > b.sale_to) return 'over';
  return 'on';
}
/** דער פרייז היינט: פון מבצע אדער דער רעגולערער */
export function priceNow(b, v = '', day = today()) {
  if (v === 'vol') return num(b.vol_price) ?? 0;
  if (v === 'old') return num(b.old_price) ?? 0;
  return saleState(b, day) === 'on' ? Number(b.sale_price) : (num(b.price) ?? 0);
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
/** דער מלאי איצט (null = נאך נישט באשטימט) */
export function stockOf(b, sold = soldMap()) {
  const base = num(b.stock_base);
  return base == null ? null : base - (sold.get(String(b.book_id)) || 0);
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
  const sold = soldMap();
  const opt = (val, label) => `<option value="${h(val)}"${val === sel ? ' selected' : ''}>${h(label)}</option>`;
  return `<option value="">— ${h(t('bkPick'))} —</option>${allBooks().map((b) => {
    const st = stockOf(b, sold);
    const sale = saleState(b) === 'on' ? ' 🏷' : '';
    const out = [opt(String(b.book_id), `${b.name} · ${money(priceNow(b))}${sale}${st != null ? ` · ${t('bkStockShort')} ${st}` : ''}`)];
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
  const sold = soldMap();
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
function bookRows(b, sold) {
  const st = stockOf(b, sold);
  const s = saleState(b);
  const n = sold.get(String(b.book_id)) || 0;
  const img = imgOf(b);
  const id = h(b.book_id);
  return `<tbody class="bk-book${s === 'on' ? ' bk-onsale' : ''}" data-id="${id}">
    <tr class="bk-r1">
      <td class="bk-img" rowspan="2">${img ? `<img src="${h(img)}" alt="" loading="lazy">` : '<span class="bk-noimg">📖</span>'}</td>
      <td class="bk-name"><b>${h(b.name)}</b>${num(b.old_price) != null ? ` <span class="bk-new" title="${h(t('bkNewEd'))}">✱</span>` : ''}
        ${b.subtitle ? `<div class="muted small">${h(b.subtitle)}</div>` : ''}${b.notes ? `<div class="bk-note small">${h(b.notes)}</div>` : ''}</td>
      <td class="bk-vols">${Number(b.volumes) > 1 ? h(t('bkVolsN', { n: b.volumes })) : ''}</td>
      <td class="bk-price"><label>${h(t('bkPrice'))}<span class="bk-money">$<input type="number" min="0" step="0.01" dir="ltr" data-f="price" value="${h(b.price ?? '')}"></span></label>
        ${s === 'on' ? `<div class="bk-now">🏷 ${h(t('bkNow'))} <b>${money(b.sale_price)}</b></div>` : ''}</td>
      <td class="bk-stock"><label>${h(t('bkStock'))}<input type="number" step="1" dir="ltr" data-f="stock" value="${st == null ? '' : st}" placeholder="—" class="${st != null && st <= 0 ? 'bk-zero' : ''}"></label>
        ${n ? `<div class="muted small">${h(t('bkSoldN', { n }))}</div>` : ''}</td>
      <td class="bk-ed"><button type="button" class="linkish" data-edit="${id}" title="${h(t('bkEdit'))}">✎</button></td>
    </tr>
    <tr class="bk-r2"><td colspan="5"><div class="bk-r2-in">
      <span class="bk-sale">🏷 ${h(t('bkSale'))} <span class="bk-money">$<input type="number" min="0" step="0.01" dir="ltr" data-f="sale_price" value="${h(b.sale_price ?? '')}"></span>
        ${h(t('bkFrom'))} <input type="date" data-f="sale_from" value="${h(b.sale_from || '')}">
        ${h(t('bkTo'))} <input type="date" data-f="sale_to" value="${h(b.sale_to || '')}">
        ${s ? `<span class="bk-badge bk-${s}">${h(t(SALE_TXT[s]))}</span>` : ''}
        ${num(b.sale_price) != null || b.sale_from || b.sale_to ? `<button type="button" class="linkish bk-clear" data-clear="${id}" title="${h(t('bkSaleClear'))}">✕</button>` : ''}</span>
      ${num(b.vol_price) != null ? `<span class="bk-extra">${h(t('bkVol'))} <span class="bk-money">$<input type="number" min="0" step="0.01" dir="ltr" data-f="vol_price" value="${h(b.vol_price)}"></span></span>` : ''}
      ${num(b.old_price) != null ? `<span class="bk-extra">${h(t('bkOld'))} <span class="bk-money">$<input type="number" min="0" step="0.01" dir="ltr" data-f="old_price" value="${h(b.old_price)}"></span></span>` : ''}
    </div></td></tr></tbody>`;
}

export function renderBooks() {
  const main = $('#books-main');
  if (!main) return;
  const sold = soldMap();
  const q = cur.q.trim();
  const list = allBooks().filter((b) => !q || `${b.name} ${b.subtitle} ${b.notes}`.includes(q));
  const groups = CATS.map((c) => [c, list.filter((b) => (CATS.includes(b.category) ? b.category : 'other') === c)]).filter(([, l]) => l.length);
  const onSale = list.filter((b) => saleState(b) === 'on').length;
  const sales = (state.donations || []).filter((d) => booksOf(d).length);
  main.innerHTML = `<div class="sc-head bk-head">
      <span class="sc-logo-ph">📚</span>
      <div><h1>${h(BOOKS_ORG)}</h1><p class="muted small">${h(t('bkSub', { n: (state.books || []).length }))}${onSale ? ` · 🏷 ${h(t('bkOnSaleN', { n: onSale }))}` : ''}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn" id="bk-back">← ${h(t('lobbyBack'))}</button>
    </div>
    <div class="bk-bar">
      <button type="button" class="btn primary" id="bk-sell">🧾 ${h(t('bkSell'))}</button>
      <button type="button" class="btn" id="bk-new">＋ ${h(t('bkNew'))}</button>
      <input type="search" id="bk-q" placeholder="🔍 ${h(t('bkSearch'))}" value="${h(cur.q)}">
      <span class="spacer"></span>
      <span class="muted small">${h(t('bkSalesN', { n: sales.length }))}</span>
    </div>
    <p class="muted small bk-hint">${h(t('bkHint'))}</p>
    ${groups.map(([c, l]) => `<h3 class="bk-group">${h(t(`bkCat_${c}`))}</h3>
      <table class="bk-table no-sort">${l.map((b) => bookRows(b, sold)).join('')}</table>`).join('') || `<p class="muted">${h(t('noResults'))}</p>`}`;
  $('#bk-back').onclick = () => ui.showView('lobby');
  $('#bk-new').onclick = () => editBook({});
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
    const cl = e.target.closest('[data-clear]');
    if (cl) { const b = bookById(cl.dataset.clear); if (b) saveBook({ ...b, sale_price: '', sale_from: '', sale_to: '' }); }
  };
  main.onchange = (e) => {
    const inp = e.target.closest('[data-f]');
    if (!inp) return;
    const b = bookById(inp.closest('[data-id]').dataset.id);
    if (!b) return;
    const f = inp.dataset.f;
    const v = inp.value.trim();
    if (f === 'stock') {
      // דער גבאי שרייבט וויפל עס איז דא איצט → stock_base = דאס + וויפל מ'האט שוין פארקויפט
      saveBook({ ...b, stock_base: v === '' ? '' : Math.round(Number(v)) + (soldMap().get(String(b.book_id)) || 0) });
      return;
    }
    if (f === 'sale_from' || f === 'sale_to') {
      const other = f === 'sale_from' ? b.sale_to : b.sale_from;
      if (v && other && (f === 'sale_from' ? v > other : v < other)) { ui.toast(t('bkDatesBad'), 'error'); inp.value = b[f] || ''; return; }
      saveBook({ ...b, [f]: v });
      return;
    }
    saveBook({ ...b, [f]: v === '' ? '' : Number(v) });
  };
}

let saving = Promise.resolve();
function saveBook(rec) {
  // איינס נאך דאס אנדערע (א שנעלער טאב פון פעלד צו פעלד)
  saving = saving.then(async () => {
    try {
      const id = await saveRecord('Books', 'book_id', { ...rec });
      const i = state.books.findIndex((x) => String(x.book_id) === String(id));
      const fresh = { ...rec, book_id: id };
      if (i >= 0) state.books[i] = { ...state.books[i], ...fresh }; else state.books.push(fresh);
      ui.toast(t('bkSaved'));
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    renderBooks();
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
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
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
        <div class="bk-imgbox"><div class="bk-imgprev">${imageOf(image) ? `<img src="${h(imageOf(image))}" alt="">` : '📖'}</div>
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
    const maxSort = Math.max(0, ...(state.books || []).map((x) => Number(x.sort) || 0));
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
