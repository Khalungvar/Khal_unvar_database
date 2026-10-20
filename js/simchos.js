// "שהשמחה במעונם" — די מזל טובים פון דער וואך פארן גליון (האלב בלאט אמעריקאנער, 5.5×8.5).
// יעדע שמחה: בעלי השמחה (קאנטאקטן פון מאגר) + סוג + דער ילד/חתן + צד שני. דער טעקסט ווערט געבויט פון די כרטיסן:
// תואר + נאמען (משפחה פעט) + סיומת (שליט"א א.א.וו.), און "לרגל ..." מיט דער קרבה (בנו-נכדו...) וואס ווערט אויסגערעכנט
// פון די קשרים אין די כרטיסן. נייע קשרים צווישן בעלי השמחה ווערן אריינגעלייגט אין די כרטיסן.
// לשונית Simchos (גיליון). די הערה נאכן נאמען (למשל "אב"ד בערז'אן") — אין כרטיס, קאלום name_note.
import { state, loadAll, saveRecord, deleteRecord, saveContact, addRelation, removeRelation } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h } from './util.js';
import { toHebrew, monthHe, hebrewNumber, todayIso } from './hebdate.js';
import { parashaOf, shabbatOfWeek } from './parasha.js';
import { customFontNames } from './fonts.js';
import { htmlToJpeg, jpegsToPdf } from './pdf.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function initSimchos(helpers) { ui = helpers; }

const TYPES = {
  birth: { label: 'הולדת', pre: 'לרגל הולדת', post: '' },
  upsherin: { label: 'אפשערן', pre: 'לרגל שמחת האפשערן של', post: '' },
  barmitzvah: { label: 'בר מצוה', pre: 'לרגל הכנסת', post: 'לעול התורה והמצוות' },
  erusin: { label: 'אירוסין', pre: 'לרגל אירוסי', post: '', other: true },
  nisuin: { label: 'נישואין', pre: 'לרגל נישואי', post: '', other: true },
};
const SUFFIXES = ['ני"ו', 'הי"ו', 'שליט"א'];
// "א TYPE ב": א איז מיט אזויפיל דורות העכער ווי ב
const DELTA = { 'טאטע פון': 1, 'זון פון': -1, 'שווער פון': 1, 'איידעם פון': -1, 'זיידע פון': 2, 'אייניקל פון': -2, 'ברודער פון': 0, 'שוואגער פון': 0 };
const TO_CHILD = [['1', 'טאטע'], ['2', 'זיידע'], ['3', 'עלטער-זיידע']];
const WORDS = {
  m: { 1: ['בנו', 'בנם'], 2: ['נכדו', 'נכדם'], 3: ['נינו', 'נינם'] },
  f: { 1: ['בתו', 'בתם'], 2: ['נכדתו', 'נכדתם'], 3: ['נינתו', 'נינתם'] },
};

const cur = { week: '' };
const weekNow = () => shabbatOfWeek(todayIso());
const contactOf = (id) => (id ? ui.contactById(id) : null);
const simchosOf = (week) => (state.simchos || []).filter((s) => s.week === week)
  .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || Number(a.simcha_id) - Number(b.simcha_id));
const parseH = (s) => { try { const v = JSON.parse(s.honorees || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

// ---------- קשרים: דורות צווישן מענטשן (דורך די קשרים אין די כרטיסן) ----------
function graph(extra = []) {
  const g = new Map();
  const add = (a, b, d) => { if (!g.has(a)) g.set(a, []); g.get(a).push([b, d]); };
  [...(state.relations || []), ...extra].forEach((r) => {
    const d = DELTA[r.relation_type];
    if (d === undefined || !r.contact_id_a || !r.contact_id_b) return;
    const a = String(r.contact_id_a); const b = String(r.contact_id_b);
    add(a, b, d); add(b, a, -d);
  });
  return g;
}
/** וויפיל דורות "from" איז העכער ווי "to" (אדער null — נישט פארבונדן, ביז 4 שריט) */
function genDelta(g, from, to) {
  if (from === to) return 0;
  const seen = new Map([[from, 0]]); let q = [from];
  for (let depth = 0; depth < 4 && q.length; depth += 1) {
    const nq = [];
    q.forEach((x) => (g.get(x) || []).forEach(([y, d]) => {
      if (seen.has(y)) return;
      seen.set(y, seen.get(x) + d); nq.push(y);
    }));
    if (seen.has(to)) return seen.get(to);
    q = nq;
  }
  return null;
}
const directRel = (a, b) => (state.relations || []).find((r) => String(r.contact_id_a) === String(a) && String(r.contact_id_b) === String(b));

/** דער סדר און די קרבה: { rows (פון ווייט צו נאענט), rel: "נינו-בנו" / "צאצאיהם" } */
function compose(s) {
  const hs = parseH(s).filter((x) => x.id);
  if (!hs.length) return { rows: [], rel: '' };
  const extra = hs.filter((x) => x.link && x.link.type && x.link.to).map((x) => ({ contact_id_a: x.id, relation_type: x.link.type, contact_id_b: x.link.to }));
  const g = graph(extra);
  // גרופעס: ווער איז פארבונדן מיט וועמען
  const groups = [];
  hs.forEach((x) => {
    if (x.unrelated) { groups.push([x]); return; }
    const gr = groups.find((grp) => grp.some((y) => genDelta(g, String(y.id), String(x.id)) !== null));
    if (gr) gr.push(x); else groups.push([x]);
  });
  // דורות קעגן דעם ערשטן אין יעדער גרופע
  groups.forEach((grp) => {
    const base = String(grp[0].id);
    grp.forEach((x) => { x._g = genDelta(g, String(x.id), base) ?? 0; });
    grp.sort((a, b) => b._g - a._g);
  });
  const rows = groups.flat();
  if (groups.length > 1) return { rows, rel: 'צאצאיהם' };
  const grp = groups[0];
  const first = hs[0];
  const baseChild = Number(first.toChild || 1);
  const byGen = new Map(); // דור קעגן דעם ילד → וויפיל מענטשן
  grp.forEach((x) => {
    const gen = baseChild + (genDelta(g, String(x.id), String(first.id)) ?? 0);
    byGen.set(gen, (byGen.get(gen) || 0) + 1);
  });
  const sex = s.child_gender === 'f' ? 'f' : 'm';
  const rel = [...byGen].sort((a, b) => b[0] - a[0])
    .map(([gen, n]) => (WORDS[sex][gen] ? WORDS[sex][gen][n > 1 ? 1 : 0] : '')).filter(Boolean).join('-');
  return { rows, rel };
}

/** פעט: אלעס נאך דעם ערשטן ווארט, ווען דאס ערשטע ווארט איז א ראשי תיבות (הבה"ח, ה"ה) */
function boldName(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = /^(\S*["״'׳]\S*)\s+(.+)$/.exec(s);
  return m ? `${h(m[1])} <b>${h(m[2])}</b>` : `<b>${h(s)}</b>`;
}

/** איין שמחה אלס HTML פארן גליון */
export function simchaHtml(s) {
  const { rows, rel } = compose(s);
  const ty = TYPES[s.type] || TYPES.birth;
  const lines = rows.map((x) => {
    const c = contactOf(x.id) || {};
    const name = `${h(x.title || '')} <b>${h(c.first_name_he || '')} ${h(c.last_name_he || '')}</b> ${h(x.suffix || '')}`.replace(/\s+/g, ' ').trim();
    return `<div class="sg-name">${name}</div>${x.noteOn && x.note ? `<div class="sg-note">${h(x.note)}</div>` : ''}`;
  }).join('');
  const forLine = String(s.text_override || '').trim() ? h(s.text_override)
    : [h(ty.pre), h(rel), boldName(s.child_name), ty.other ? `עב"ג ${boldName(s.other_side)}`.trim() : '', h(ty.post), 'בשעטו"מ']
      .filter((x) => String(x).trim()).join(' ');
  return `<div class="sg-entry">${lines}<div class="sg-for">${forLine}</div></div>`;
}

// ---------- דער בלאט ----------
const SCALE = 0.909; // די שוליים (sg-inner)
const MAX_PT = Math.round((11 / SCALE) * 100) / 100;
const fontKey = 'sg-font';
const defFont = () => customFontNames().find((n) => !/bold/i.test(n)) || 'Frank Ruhl Libre';
const getFont = () => { let f = ''; try { f = localStorage.getItem(fontKey) || ''; } catch { /* */ } return f && (f === 'Frank Ruhl Libre' || customFontNames().includes(f)) ? f : defFont(); };
const setFont = (f) => { try { localStorage.setItem(fontKey, f); } catch { /* */ } };

function weekLabel(iso) {
  const p = parashaOf(iso);
  const x = toHebrew(iso);
  const d = x ? `${hebrewNumber(x.d)} ${monthHe(x.m)}` : iso;
  return p ? `${t('sgParsha')} ${p.he} · ${d}` : `${t('sgShabbat')} ${d}`;
}

function pageHtml(list, fontPt, cols = 1, pageNo = 0) {
  const font = getFont().replace(/'/g, '');
  return `<div class="sg-page" style="font-family:'${h(font)}','Frank Ruhl Libre',serif">
    <div class="sg-inner">
    <img class="sg-bg" src="img/simcha-bg2.jpg" alt="">
    ${parashaOf(cur.week) ? `<div class="sg-parsha">${h(t('sgParsha'))} ${h(parashaOf(cur.week).he)}</div>` : ''}
    <div class="sg-body${cols > 1 ? ' sg-cols' : ''}" style="font-size:${fontPt}pt">${list.map(simchaHtml).join('')}</div></div>
    ${pageNo ? `<div class="sg-pageno">${h(t('lobbySimchos'))} ${h(t('sgPageNo', { n: pageNo }))}</div>` : ''}</div>`;
}

// ---------- אויסלייג: איין/צוויי שפאלטן, קלענערער שריפט (ביז 2.5 נקודות), און דערנאך א צווייטער בלאט ----------
const MIN_PT = Math.round(((11 - 2.5) / SCALE) * 100) / 100;
const colsKey = 'sg-cols';
const getCols = () => { try { return localStorage.getItem(colsKey) || 'auto'; } catch { return 'auto'; } };
const setCols = (v) => { try { localStorage.setItem(colsKey, v); } catch { /* */ } };
let lastPages = [];

let meas = null;
function fits(list, pt, cols) {
  if (!meas) { meas = document.createElement('div'); meas.className = 'sg-measure'; document.body.appendChild(meas); }
  meas.innerHTML = pageHtml(list, pt, cols);
  const body = $('.sg-body', meas);
  const b = body.getBoundingClientRect();
  return $$('.sg-entry', body).every((e) => { const r = e.getBoundingClientRect(); return r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1; });
}
/** פאר א גרופע שמחות: { cols, pt } אדער null (גייט נישט אריין אויף איין בלאט) */
function layoutFor(list, mode = getCols()) {
  const tries = [];
  const shrink = (cols) => { for (let pt = MAX_PT; pt >= MIN_PT - 0.001; pt = Math.round((pt - 0.25) * 100) / 100) tries.push([cols, pt]); };
  if (mode === '1') shrink(1);
  else if (mode === '2') shrink(2);
  else { tries.push([1, MAX_PT]); shrink(2); }
  const ok = tries.find(([c, pt]) => fits(list, pt, c));
  return ok ? { cols: ok[0], pt: ok[1] } : null;
}
/** צוטיילן אויף בלעטער: [{ list, cols, pt }] */
function paginateWith(all, mode) {
  const pages = [];
  let rest = all.slice();
  for (let guard = 0; rest.length && guard < 6; guard += 1) {
    let k = rest.length; let lay = layoutFor(rest, mode);
    while (!lay && k > 1) { k -= 1; lay = layoutFor(rest.slice(0, k), mode); }
    if (!lay) lay = { cols: mode === '2' ? 2 : 1, pt: MIN_PT };
    pages.push({ list: rest.slice(0, k), ...lay });
    rest = rest.slice(k);
  }
  return pages;
}
function paginate(all) {
  const mode = getCols();
  let pages = paginateWith(all, mode);
  // ווען ס'דארף סיי ווי צוויי בלעטער: בעסער אלע בלעטער מיט איין שפאלט (אויב ס'גייט אריין אין אזויפיל בלעטער)
  if (mode === 'auto' && pages.length > 1) {
    const one = paginateWith(all, '1');
    if (one.length <= pages.length) pages = one;
  }
  if (meas) meas.innerHTML = '';
  return pages;
}
const pagesHtml = (pages) => pages.map((p, i) => pageHtml(p.list, p.pt, p.cols, pages.length > 1 ? i + 1 : 0)).join('');

export function openSimchos() {
  if (!cur.week) cur.week = weekNow();
  ui.showView('simchos');
}

export function renderSimchos() {
  const main = $('#simchos-main');
  if (!main) return;
  if (!cur.week) cur.week = weekNow();
  const list = simchosOf(cur.week);
  const fonts = ['Frank Ruhl Libre', ...customFontNames().filter((n) => !/bold/i.test(n))];
  main.innerHTML = `<div class="sc-head sg-head">
      <span class="sc-logo-ph">🎉</span>
      <div><h1>${h(t('lobbySimchos'))}</h1><p class="muted small">${h(t('lobbySimchosSub'))}</p></div>
      <span class="spacer"></span>
      <button type="button" class="btn primary" id="sg-new">＋ ${h(t('sgNew'))}</button>
      <button type="button" class="btn" id="sg-back">← ${h(t('lobbyBack'))}</button>
    </div>
    <div class="sg-week">
      <button type="button" class="btn small-btn" id="sg-prev" title="${h(t('sgPrev'))}">›</button>
      <b>${h(weekLabel(cur.week))}</b>
      <button type="button" class="btn small-btn" id="sg-next" title="${h(t('sgNext'))}">‹</button>
      ${cur.week !== weekNow() ? `<button type="button" class="linkish" id="sg-today">${h(t('sgThisWeek'))}</button>` : ''}
      <span class="spacer"></span>
      <label class="small">${h(t('sgFont'))} <select id="sg-font">${fonts.map((f) => `<option${f === getFont() ? ' selected' : ''}>${h(f)}</option>`).join('')}</select></label>
      <label class="small">${h(t('sgCols'))} <select id="sg-cols">${[['auto', t('sgColsAuto')], ['1', '1'], ['2', '2']].map(([v, l]) => `<option value="${v}"${getCols() === v ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>
      <button type="button" class="btn small-btn" id="sg-print"${list.length ? '' : ' disabled'}>🖨 ${h(t('sgPrint'))}</button>
      <button type="button" class="btn small-btn" id="sg-pdf"${list.length ? '' : ' disabled'} title="${h(t('sgPdfHint'))}">⬇ Print to PDF</button>
    </div>
    <div class="sg-wrap">
      <div class="sg-list">${list.length ? list.map((s, i) => `<div class="sg-item">
          <div class="sg-item-text">${simchaHtml(s)}</div>
          <div class="sg-item-acts">
            <button type="button" class="btn small-btn" data-sg-edit="${h(s.simcha_id)}" title="${h(t('scEdit'))}">✎</button>
            <button type="button" class="btn small-btn" data-sg-up="${h(s.simcha_id)}"${i ? '' : ' disabled'}>▲</button>
            <button type="button" class="btn small-btn" data-sg-down="${h(s.simcha_id)}"${i < list.length - 1 ? '' : ' disabled'}>▼</button>
            <button type="button" class="btn small-btn danger" data-sg-del="${h(s.simcha_id)}" title="${h(t('deleteBtn'))}">🗑</button>
          </div></div>`).join('') : `<p class="muted">${h(t('sgNone'))}</p>`}</div>
      <div class="sg-preview-wrap"><div class="sg-preview" id="sg-preview"></div><p class="muted small" id="sg-layout"></p></div>
    </div>`;
  lastPages = list.length ? paginate(list) : [{ list: [], cols: 1, pt: MAX_PT }];
  $('#sg-preview', main).innerHTML = pagesHtml(lastPages);
  $('#sg-preview', main).style.setProperty('--pages', lastPages.length);
  $('#sg-layout', main).textContent = list.length ? t('sgLayout', { p: lastPages.length, c: lastPages.map((p) => p.cols).join('/'), s: lastPages.map((p) => Math.round(p.pt * SCALE * 10) / 10).join('/') }) : '';
  wire(main, list);
}

function wire(main, list) {
  $('#sg-back', main).onclick = () => ui.showView('lobby');
  $('#sg-new', main).onclick = () => openSimchaForm({ week: cur.week });
  $('#sg-prev', main).onclick = () => { cur.week = shift(cur.week, -7); renderSimchos(); };
  $('#sg-next', main).onclick = () => { cur.week = shift(cur.week, 7); renderSimchos(); };
  const td = $('#sg-today', main); if (td) td.onclick = () => { cur.week = weekNow(); renderSimchos(); };
  $('#sg-font', main).onchange = (e) => { setFont(e.target.value); renderSimchos(); };
  $('#sg-cols', main).onchange = (e) => { setCols(e.target.value); renderSimchos(); };
  $('#sg-print', main).onclick = () => printPage(list);
  $('#sg-pdf', main).onclick = () => { ui.toast(t('sgPdfHint')); printPage(list); };
  void pdfPage; // דער אלטער PDF (בילד) — אויב מ'וועט עס דארפן
  $$('[data-sg-edit]', main).forEach((b) => { b.onclick = () => openSimchaForm(list.find((s) => String(s.simcha_id) === b.dataset.sgEdit)); });
  $$('[data-sg-del]', main).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(t('sgDelConfirm'))) return;
      try { await deleteSimcha(list.find((s) => String(s.simcha_id) === b.dataset.sgDel)); await loadAll(); ui.refreshAll(); renderSimchos(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    };
  });
  const move = async (id, dir) => {
    const i = list.findIndex((s) => String(s.simcha_id) === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const order = list.map((s) => s); [order[i], order[j]] = [order[j], order[i]];
    try {
      for (let k = 0; k < order.length; k += 1) if (Number(order[k].sort) !== k + 1) await saveRecord('Simchos', 'simcha_id', { ...order[k], sort: k + 1 });
      await loadAll(); renderSimchos();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  };
  $$('[data-sg-up]', main).forEach((b) => { b.onclick = () => move(b.dataset.sgUp, -1); });
  $$('[data-sg-down]', main).forEach((b) => { b.onclick = () => move(b.dataset.sgDown, 1); });
}
const shift = (iso, days) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + days * 86400000).toISOString().slice(0, 10);

function printPage(list) {
  void list;
  let area = $('#sg-print-area');
  if (!area) { area = document.createElement('div'); area.id = 'sg-print-area'; document.body.appendChild(area); }
  area.innerHTML = pagesHtml(lastPages);
  const st = document.createElement('style');
  st.textContent = '@page { size: 5.5in 8.5in; margin: 0; }';
  document.head.appendChild(st);
  document.body.classList.add('printing-sg');
  const done = () => { document.body.classList.remove('printing-sg'); st.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 300);
}

async function pdfPage(list) {
  const btn = $('#sg-pdf'); btn.disabled = true;
  try {
    void list;
    const jpgs = [];
    for (const [i, p] of lastPages.entries()) jpgs.push(await htmlToJpeg(pageHtml(p.list, p.pt, p.cols, lastPages.length > 1 ? i + 1 : 0), { widthIn: 5.5, heightIn: 8.5, scale: 3, quality: 0.9 }));
    const pdf = jpegsToPdf(jpgs, { pageW: 396, pageH: 612, margin: 0 });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    const p = parashaOf(cur.week);
    a.download = `שהשמחה במעונם - ${p ? p.he : cur.week}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  btn.disabled = false;
}

// ---------- אויסמעקן: אויך וואס די שמחה האט אריינגעלייגט אין די כרטיסן (קשרים, הערה נאכן נאמען) ----------
function parseMade(s) {
  try { const m = JSON.parse(s.made || '{}'); return { rels: Array.isArray(m.rels) ? m.rels : [], notes: Array.isArray(m.notes) ? m.notes : [] }; } catch { return { rels: [], notes: [] }; }
}
async function deleteSimcha(s) {
  if (!s) return;
  const made = parseMade(s);
  const others = (state.simchos || []).filter((x) => x !== s && String(x.simcha_id) !== String(s.simcha_id)).map(parseMade);
  const usedElsewhere = (a, ty, b) => others.some((m) => m.rels.some(([x, y, z]) => String(x) === String(a) && y === ty && String(z) === String(b)));
  for (const [a, ty, b] of made.rels) {
    if (usedElsewhere(a, ty, b)) continue;
    const rel = state.relations.find((r) => String(r.contact_id_a) === String(a) && r.relation_type === ty && String(r.contact_id_b) === String(b));
    if (rel) await removeRelation(rel);
  }
  for (const n of made.notes) {
    const c = contactOf(n.id);
    if (c && (c.name_note || '') === n.after && !others.some((m) => m.notes.some((o) => o.id === n.id))) {
      await saveContact({ ...c, name_note: n.before }, state.phones.get(String(c.contact_id)) || {});
    }
  }
  await deleteRecord('Simchos', 'simcha_id', s);
}

// ---------- דער טופס ----------
function honoreeRow(x, i) {
  const c = contactOf(x.id);
  const suf = x.suffix || 'שליט"א';
  const isOther = suf && !SUFFIXES.includes(suf);
  return `<fieldset class="sg-h" data-i="${i}">
    <div class="sg-h-line">
      <input class="sg-title" placeholder="${h(t('sgTitle'))}" value="${h(x.title ?? (c?.title_he || ''))}">
      <input class="sg-pick" list="dl-sg-contacts" autocomplete="off" placeholder="${h(t('pickContact'))}" value="${c ? h(ui.pickerLabel(c)) : ''}">
      <span class="sg-suf">${SUFFIXES.map((sx) => `<label class="chip-radio"><input type="radio" name="suf${i}" value="${h(sx)}"${suf === sx ? ' checked' : ''}> ${h(sx)}</label>`).join('')}
        <label class="chip-radio"><input type="radio" name="suf${i}" value="__other"${isOther ? ' checked' : ''}> ${h(t('sgOther'))}</label>
        <input class="sg-suf-other" value="${isOther ? h(suf) : ''}"${isOther ? '' : ' hidden'}></span>
      ${i === 0 ? `<label class="small">${h(t('sgToChild'))} <select class="sg-tochild">${TO_CHILD.map(([v, l]) => `<option value="${v}"${String(x.toChild || '1') === v ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>` : ''}
      ${i > 0 ? '<button type="button" class="linkish sg-remove">✕</button>' : ''}
    </div>
    ${i > 0 ? `<div class="sg-link" data-link></div>` : ''}
    <div class="sg-h-line"><label class="check small"><input type="checkbox" class="sg-note-on"${x.noteOn ? ' checked' : ''}> ${h(t('sgNote'))}</label>
      <input class="sg-note" placeholder="${h(t('sgNotePh'))}" value="${h(x.note ?? (c?.name_note || ''))}"${x.noteOn ? '' : ' hidden'}></div>
  </fieldset>`;
}

export function openSimchaForm(s = {}) {
  const rec = { type: 'birth', child_gender: 'm', week: cur.week || weekNow(), ...s };
  let hs = parseH(rec);
  if (!hs.length) hs = [{}];
  const dlg = $('#simcha-dialog'); const form = $('#simcha-form');
  const relTypes = Object.keys(DELTA);
  const draw = () => {
    form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
      <h2>🎉 ${h(rec.simcha_id ? t('sgEdit') : t('sgNew'))}</h2>
      <p class="muted small">${h(weekLabel(rec.week))}</p>
      <datalist id="dl-sg-contacts">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
      <div class="sg-types">${Object.entries(TYPES).map(([k, v]) => `<label class="chip-radio big"><input type="radio" name="type" value="${k}"${rec.type === k ? ' checked' : ''}> ${h(v.label)}</label>`).join('')}</div>
      <h3>${h(t('sgHonorees'))}</h3>
      <div id="sg-hs">${hs.map(honoreeRow).join('')}</div>
      <button type="button" class="btn small-btn" id="sg-add-h">＋ ${h(t('sgAddH'))}</button>
      <h3>${h(t('sgChild'))}</h3>
      <div class="grid">
        <label>${h(t('sgGender'))}<select name="child_gender"><option value="m"${rec.child_gender !== 'f' ? ' selected' : ''}>${h(t('sgBoy'))}</option><option value="f"${rec.child_gender === 'f' ? ' selected' : ''}>${h(t('sgGirl'))}</option></select></label>
        <label>${h(t('sgChildName'))}<input name="child_name" value="${h(rec.child_name || '')}" placeholder="${h(t('sgChildPh'))}"></label>
        <label data-other${TYPES[rec.type]?.other ? '' : ' hidden'}>${h(t('sgOtherSide'))}<input name="other_side" value="${h(rec.other_side || '')}" placeholder="${h(t('sgOtherPh'))}"></label>
      </div>
      <h3>${h(t('sgPreview'))}</h3>
      <div class="sg-live" id="sg-live"></div>
      <label class="wide">${h(t('sgOverride'))}<input name="text_override" value="${h(rec.text_override || '')}" placeholder="${h(t('sgOverridePh'))}"></label>
      <div class="actions"><span class="spacer"></span>
        <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>`;
    wireForm();
  };
  const contactByLabel = (v) => state.contacts.find((x) => ui.pickerLabel(x) === String(v || '').trim());
  // לייענט דעם טופס צוריק אין "hs" / "rec"
  const read = () => {
    rec.type = form.elements.type.value || rec.type;
    rec.child_gender = form.elements.child_gender.value;
    rec.child_name = form.elements.child_name.value.trim();
    rec.other_side = form.elements.other_side.value.trim();
    rec.text_override = form.elements.text_override.value.trim();
    hs = $$('.sg-h', form).map((fs, i) => {
      const c = contactByLabel($('.sg-pick', fs).value);
      const r = $(`input[name="suf${i}"]:checked`, fs);
      const suffix = r ? (r.value === '__other' ? $('.sg-suf-other', fs).value.trim() : r.value) : '';
      const prev = hs[i] || {};
      const x = {
        id: c ? String(c.contact_id) : '', title: $('.sg-title', fs).value.trim(), suffix,
        noteOn: $('.sg-note-on', fs).checked, note: $('.sg-note', fs).value.trim(),
      };
      if (i === 0) x.toChild = $('.sg-tochild', fs).value;
      const lt = $('.sg-link-type', fs); const lto = $('.sg-link-to', fs); const un = $('.sg-unrel', fs);
      if (un && un.checked) x.unrelated = true;
      else if (lt && lt.value && lto && lto.value) x.link = { type: lt.value, to: lto.value };
      else if (prev.link && !lt) x.link = prev.link;
      return x;
    });
  };
  const refreshLinks = () => {
    const g = graph();
    $$('.sg-h', form).forEach((fs, i) => {
      if (!i) return;
      const box = $('[data-link]', fs);
      const x = hs[i];
      const prevIds = hs.slice(0, i).map((y) => y.id).filter(Boolean);
      if (!x.id || !prevIds.length) { box.innerHTML = ''; return; }
      const known = prevIds.find((p) => genDelta(g, x.id, p) !== null);
      if (known) {
        const d = directRel(x.id, known);
        box.innerHTML = `<span class="muted small">✓ ${h(d ? `${d.relation_type} ${ui.fullNameHe(contactOf(known))}` : t('sgLinked', { name: ui.fullNameHe(contactOf(known)) }))}</span>`;
        return;
      }
      const lk = x.link || {};
      box.innerHTML = `<span class="small">${h(t('sgWhatIs'))}</span>
        <select class="sg-link-type"${x.unrelated ? ' disabled' : ''}><option value=""></option>${relTypes.map((r) => `<option${lk.type === r ? ' selected' : ''}>${h(r)}</option>`).join('')}</select>
        <select class="sg-link-to"${x.unrelated ? ' disabled' : ''}>${prevIds.map((p) => `<option value="${h(p)}"${lk.to === p ? ' selected' : ''}>${h(ui.fullNameHe(contactOf(p)))}</option>`).join('')}</select>
        <label class="check small"><input type="checkbox" class="sg-unrel"${x.unrelated ? ' checked' : ''}> ${h(t('sgUnrelated'))}</label>`;
      $$('select, input', box).forEach((el) => { el.onchange = () => { read(); refreshLinks(); live(); }; });
    });
  };
  const live = () => {
    $('[data-other]', form).hidden = !TYPES[rec.type]?.other;
    $('#sg-live', form).innerHTML = hs.some((x) => x.id) ? simchaHtml({ ...rec, honorees: JSON.stringify(hs) }) : `<span class="muted">${h(t('sgPickFirst'))}</span>`;
  };
  const wireForm = () => {
    $$('[data-close]', form).forEach((b) => { b.onclick = () => dlg.close(); });
    $('#sg-add-h', form).onclick = () => { read(); hs.push({}); draw(); };
    $$('.sg-remove', form).forEach((b) => { b.onclick = () => { read(); hs.splice(Number(b.closest('.sg-h').dataset.i), 1); draw(); }; });
    $$('.sg-h', form).forEach((fs) => {
      $('.sg-pick', fs).addEventListener('change', () => {
        const c = contactByLabel($('.sg-pick', fs).value);
        if (c) {
          if (!$('.sg-title', fs).value.trim()) $('.sg-title', fs).value = c.title_he || '';
          $('.sg-note', fs).value = c.name_note || '';
          if (c.name_note) { $('.sg-note-on', fs).checked = true; $('.sg-note', fs).hidden = false; }
        }
        read(); refreshLinks(); live();
      });
      $('.sg-note-on', fs).addEventListener('change', (e) => { $('.sg-note', fs).hidden = !e.target.checked; });
      $$('input[type=radio]', fs).forEach((r) => r.addEventListener('change', () => { $('.sg-suf-other', fs).hidden = r.value !== '__other' || !r.checked; }));
    });
    form.oninput = () => { read(); live(); };
    form.onchange = () => { read(); live(); };
    read(); refreshLinks(); live();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      read();
      const btn = form.querySelector('[type=submit]');
      if (!hs.some((x) => x.id)) { ui.toast(t('sgPickFirst'), 'error'); return; }
      btn.disabled = true;
      try {
        const clean = hs.filter((x) => x.id);
        const out = { ...rec, honorees: JSON.stringify(clean) };
        if (!out.simcha_id) out.sort = simchosOf(out.week).length + 1;
        // וואס די שמחה לייגט אריין אין די כרטיסן — געדענקט אין "made", כדי ביים אויסמעקן עס צוריקצונעמען
        const made = parseMade(rec);
        // נייע קשרים צווישן בעלי השמחה → אין די כרטיסן
        for (const x of clean) {
          if (x.link && x.link.type && x.link.to && genDelta(graph(), x.id, x.link.to) === null) {
            await addRelation(x.id, x.link.type, x.link.to);
            made.rels.push([x.id, x.link.type, x.link.to]);
          }
        }
        // די הערה נאכן נאמען → אין כרטיס
        for (const x of clean) {
          const c = contactOf(x.id);
          if (c && x.noteOn && x.note && x.note !== (c.name_note || '')) {
            await saveContact({ ...c, name_note: x.note }, state.phones.get(String(c.contact_id)) || {});
            if (!made.notes.some((n) => n.id === x.id)) made.notes.push({ id: x.id, before: c.name_note || '', after: x.note });
            else made.notes = made.notes.map((n) => (n.id === x.id ? { ...n, after: x.note } : n));
          }
        }
        out.made = JSON.stringify(made);
        await saveRecord('Simchos', 'simcha_id', out);
        await loadAll();
        dlg.close();
        cur.week = out.week;
        ui.refreshAll();
        renderSimchos();
        ui.toast(t('saved'));
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); btn.disabled = false; }
    };
  };
  draw();
  if (!dlg.open) dlg.showModal();
}
