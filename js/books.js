// מכון משנה הלכות: די ספרים — מחיר, מבצע (פון/ביז), כרך בודד, מהדורה קודמת, מלאי.
// לשונית Books. דער מלאי = stock_base − וויפל מ'האט פארקויפט (פון די "מכירה" נדבות, קאלום books = JSON [{id, v, q, p}]).
// אזוי ווען מ'מעקט אויס א מכירה קומט דער ספר צוריק אין מלאי, אן קיין באזונדער חשבון.
// v: '' = דער ספר (סט) · 'vol' = כרך בודד · 'old' = מהדורה קודמת (די צוויי — אן מלאי).
import { state, saveRecord, deleteRecord } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, isTrue } from './util.js';
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
  const n = sold.get(String(b.book_id)) || 0;
  const g = given.get(String(b.book_id)) || 0;
  const img = imgOf(b);
  const id = h(b.book_id);
  const extras = [num(b.vol_price) != null ? `${t('bkVol')} ${money(b.vol_price)}` : '', num(b.old_price) != null ? `${t('bkOld')} ${money(b.old_price)}` : ''].filter(Boolean);
  const range = [shortDate(b.sale_from), shortDate(b.sale_to)].filter(Boolean).join('–');
  return `<div class="bk-card${s === 'on' ? ' bk-onsale' : ''}" data-id="${id}">
    <div class="bk-img">${img ? `<img src="${h(img)}" alt="" loading="lazy">` : '<span class="bk-noimg">📖</span>'}</div>
    <div class="bk-body">
      <div class="bk-title"><b>${h(b.name)}</b>${num(b.old_price) != null ? ` <span class="bk-new" title="${h(t('bkNewEd'))}">✱</span>` : ''}
        <button type="button" class="linkish bk-edbtn" data-edit="${id}" title="${h(t('bkEdit'))}">✎</button></div>
      ${b.subtitle || Number(b.volumes) > 1 ? `<div class="muted small bk-sub">${h([b.subtitle, Number(b.volumes) > 1 && !/כרכים|חלקים/.test(b.subtitle || '') ? t('bkVolsN', { n: b.volumes }) : ''].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="bk-nums">
        <label>${h(t('bkPrice'))}<span class="bk-money">$<input type="number" min="0" step="0.01" dir="ltr" data-f="price" value="${h(b.price ?? '')}"></span></label>
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
      <div class="bk-grid">${l.map((b) => bookCard(b, sold, out, given)).join('')}</div>`).join('') || `<p class="muted">${h(t('noResults'))}</p>`}`;
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
    const gv = e.target.closest('[data-give]');
    if (gv) { const b = bookById(gv.dataset.give); if (b) giveDialog(b); return; }
    const hs = e.target.closest('[data-hist]');
    if (hs) { const b = bookById(hs.dataset.hist); if (b) histDialog(b); return; }
    const sb = e.target.closest('[data-sale]');
    if (sb) { const b = bookById(sb.dataset.sale); if (b) saleDialog(b); }
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
      saveBook({ ...b, stock_base: v === '' ? '' : Math.round(Number(v)) + (outMap().get(String(b.book_id)) || 0) });
      return;
    }
    saveBook({ ...b, [f]: v === '' ? '' : Number(v) });
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
        <td>${r.d ? `<button type="button" class="linkish" data-rc="${i}">🧾 ${r.rc ? `#${h(r.rc.receipt_no)}` : h(t('bkMakeRc'))}</button>` : `<button type="button" class="linkish" data-undo="${i}" title="${h(t('deleteBtn'))}">✕</button>`}</td></tr>`).join('')}
      </tbody></table>` : `<p class="muted">${h(t('bkHistNone'))}</p>`}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`);
  dlg.onclick = async (e) => {
    const rc = e.target.closest('[data-rc]');
    if (rc) { const r = rows[Number(rc.dataset.rc)]; dlg.close(); ui.receiptFor(r.d); return; }
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
